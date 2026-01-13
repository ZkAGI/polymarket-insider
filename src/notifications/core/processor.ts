/**
 * Notification Queue Processor
 * Handles asynchronous processing of queued notifications with concurrency control
 */

import {
  QueueItem,
  QueueStorage,
  QueueProcessorConfig,
  QueueProcessorStatus,
  QueueEvent,
  QueueEventHandler,
  ChannelHandler,
  ChannelSendResult,
  NotificationStatus,
  NotificationChannel,
  QueueStats,
  DEFAULT_QUEUE_CONFIG,
  shouldRetry,
  shouldDeadLetter,
} from "./types";

/**
 * Rate limiter for channel-based throttling
 */
class ChannelRateLimiter {
  private counts: Map<NotificationChannel, { count: number; resetAt: number }> = new Map();
  private limits: Partial<Record<NotificationChannel, number>>;

  constructor(limits: Partial<Record<NotificationChannel, number>> = {}) {
    this.limits = limits;
  }

  /**
   * Check if channel is rate limited
   */
  isRateLimited(channel: NotificationChannel): boolean {
    const limit = this.limits[channel];
    if (!limit) return false;

    const now = Date.now();
    const state = this.counts.get(channel);

    if (!state || state.resetAt <= now) {
      // Reset window
      this.counts.set(channel, { count: 0, resetAt: now + 60000 });
      return false;
    }

    return state.count >= limit;
  }

  /**
   * Increment counter for channel
   */
  increment(channel: NotificationChannel): void {
    const now = Date.now();
    const state = this.counts.get(channel);

    if (!state || state.resetAt <= now) {
      this.counts.set(channel, { count: 1, resetAt: now + 60000 });
    } else {
      state.count++;
    }
  }

  /**
   * Get remaining capacity for channel
   */
  getRemaining(channel: NotificationChannel): number {
    const limit = this.limits[channel];
    if (!limit) return Infinity;

    const now = Date.now();
    const state = this.counts.get(channel);

    if (!state || state.resetAt <= now) {
      return limit;
    }

    return Math.max(0, limit - state.count);
  }

  /**
   * Get time until rate limit resets (ms)
   */
  getResetTime(channel: NotificationChannel): number {
    const now = Date.now();
    const state = this.counts.get(channel);

    if (!state || state.resetAt <= now) {
      return 0;
    }

    return state.resetAt - now;
  }
}

/**
 * Queue Processor
 * Main class for processing notification queue
 */
export class QueueProcessor {
  private storage: QueueStorage;
  private config: Required<QueueProcessorConfig>;
  private status: QueueProcessorStatus = QueueProcessorStatus.IDLE;
  private handlers: Map<NotificationChannel, ChannelHandler> = new Map();
  private eventHandlers: Set<QueueEventHandler> = new Set();
  private rateLimiter: ChannelRateLimiter;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private activeProcessing: Map<string, Promise<void>> = new Map();
  private processingCount = 0;
  private lastStatsCheck: Date | null = null;
  private depthWarningThreshold = 500;
  private depthCriticalThreshold = 1000;

  constructor(storage: QueueStorage, config: Partial<QueueProcessorConfig> = {}) {
    this.storage = storage;
    this.config = {
      ...DEFAULT_QUEUE_CONFIG,
      ...config,
    } as Required<QueueProcessorConfig>;

    this.rateLimiter = new ChannelRateLimiter(this.config.rateLimitPerChannel);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Register a channel handler
   */
  registerHandler(handler: ChannelHandler): void {
    this.handlers.set(handler.channel, handler);
  }

  /**
   * Unregister a channel handler
   */
  unregisterHandler(channel: NotificationChannel): void {
    this.handlers.delete(channel);
  }

  /**
   * Get registered handlers
   */
  getHandlers(): Map<NotificationChannel, ChannelHandler> {
    return new Map(this.handlers);
  }

  /**
   * Add event listener
   */
  on(handler: QueueEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event listener
   */
  off(handler: QueueEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    if (this.status === QueueProcessorStatus.RUNNING) {
      return;
    }

    this.status = QueueProcessorStatus.RUNNING;
    await this.emitEvent({
      type: "queue:processor_started",
      timestamp: new Date(),
    });

    this.schedulePoll();
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    if (this.status === QueueProcessorStatus.STOPPED) {
      return;
    }

    this.status = QueueProcessorStatus.STOPPED;

    // Stop polling
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active processing to complete
    if (this.activeProcessing.size > 0) {
      await Promise.all(this.activeProcessing.values());
    }

    await this.emitEvent({
      type: "queue:processor_stopped",
      timestamp: new Date(),
    });
  }

  /**
   * Pause the queue processor
   */
  async pause(): Promise<void> {
    if (this.status !== QueueProcessorStatus.RUNNING) {
      return;
    }

    this.status = QueueProcessorStatus.PAUSED;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    await this.emitEvent({
      type: "queue:processor_paused",
      timestamp: new Date(),
    });
  }

  /**
   * Resume the queue processor
   */
  async resume(): Promise<void> {
    if (this.status !== QueueProcessorStatus.PAUSED) {
      return;
    }

    this.status = QueueProcessorStatus.RUNNING;

    await this.emitEvent({
      type: "queue:processor_resumed",
      timestamp: new Date(),
    });

    this.schedulePoll();
  }

  /**
   * Get current processor status
   */
  getStatus(): QueueProcessorStatus {
    return this.status;
  }

  /**
   * Get current processing count
   */
  getProcessingCount(): number {
    return this.processingCount;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return this.storage.getStats();
  }

  /**
   * Manually process a single item (useful for testing)
   */
  async processItem(itemId: string): Promise<ChannelSendResult | null> {
    const item = await this.storage.get(itemId);
    if (!item) return null;

    return this.processQueueItem(item);
  }

  /**
   * Force process pending items immediately
   */
  async processPending(): Promise<number> {
    const items = await this.storage.getReadyForProcessing(this.config.batchSize);
    let processed = 0;

    for (const item of items) {
      const canProcess = await this.storage.markProcessing(item.id);
      if (canProcess) {
        await this.processQueueItem(item);
        processed++;
      }
    }

    return processed;
  }

  /**
   * Retry failed items
   */
  async retryFailed(limit: number = 10): Promise<number> {
    const failed = await this.storage.find({
      status: NotificationStatus.FAILED,
      limit,
    });

    let retried = 0;
    for (const item of failed) {
      if (shouldRetry(item)) {
        await this.storage.update(item.id, {
          status: NotificationStatus.PENDING,
          error: null,
        });
        retried++;
      } else if (shouldDeadLetter(item) && this.config.deadLetterEnabled) {
        await this.storage.update(item.id, {
          status: NotificationStatus.DEAD_LETTER,
        });
      }
    }

    return retried;
  }

  /**
   * Clean up expired items
   */
  async cleanupExpired(): Promise<number> {
    if (!this.config.maxQueueAge) return 0;

    const expireTime = new Date(Date.now() - this.config.maxQueueAge);
    const expired = await this.storage.find({
      status: [NotificationStatus.PENDING, NotificationStatus.RETRYING],
      createdBefore: expireTime,
    });

    for (const item of expired) {
      await this.storage.update(item.id, {
        status: NotificationStatus.DEAD_LETTER,
        error: "Expired in queue",
      });

      await this.emitEvent({
        type: "queue:item_expired",
        timestamp: new Date(),
        itemId: item.id,
        channel: item.payload.channel,
      });
    }

    return expired.length;
  }

  // ============================================================================
  // Private Processing Methods
  // ============================================================================

  private schedulePoll(): void {
    if (this.status !== QueueProcessorStatus.RUNNING) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, this.config.pollInterval);
  }

  private async poll(): Promise<void> {
    if (this.status !== QueueProcessorStatus.RUNNING) {
      return;
    }

    // Check queue depth periodically
    await this.checkQueueDepth();

    // Calculate available processing slots
    const availableSlots = this.config.concurrency - this.processingCount;
    if (availableSlots <= 0) {
      return;
    }

    // Get items ready for processing
    const items = await this.storage.getReadyForProcessing(
      Math.min(availableSlots, this.config.batchSize)
    );

    // Process items
    for (const item of items) {
      if (this.processingCount >= this.config.concurrency) {
        break;
      }

      // Check rate limit
      if (this.rateLimiter.isRateLimited(item.payload.channel)) {
        await this.emitEvent({
          type: "queue:rate_limited",
          timestamp: new Date(),
          itemId: item.id,
          channel: item.payload.channel,
          metadata: {
            resetTime: this.rateLimiter.getResetTime(item.payload.channel),
          },
        });
        continue;
      }

      // Try to mark as processing (atomic)
      const canProcess = await this.storage.markProcessing(item.id);
      if (!canProcess) {
        continue; // Already being processed by another worker
      }

      // Process asynchronously
      this.processingCount++;
      const promise = this.processQueueItem(item)
        .then(() => {}) // Convert to Promise<void>
        .finally(() => {
          this.processingCount--;
          this.activeProcessing.delete(item.id);
        });
      this.activeProcessing.set(item.id, promise);
    }
  }

  private async processQueueItem(item: QueueItem): Promise<ChannelSendResult> {
    const startTime = Date.now();

    await this.emitEvent({
      type: "queue:item_processing",
      timestamp: new Date(),
      itemId: item.id,
      channel: item.payload.channel,
    });

    // Get handler for channel
    const handler = this.handlers.get(item.payload.channel);
    if (!handler) {
      const result: ChannelSendResult = {
        success: false,
        channel: item.payload.channel,
        error: `No handler registered for channel: ${item.payload.channel}`,
        shouldRetry: false,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      await this.handleFailure(item, result);
      return result;
    }

    // Check handler availability
    if (!handler.isAvailable()) {
      const result: ChannelSendResult = {
        success: false,
        channel: item.payload.channel,
        error: `Handler for ${item.payload.channel} is not available`,
        shouldRetry: true,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      await this.handleFailure(item, result);
      return result;
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Processing timeout")),
        this.config.processingTimeout
      );
    });

    try {
      // Send with timeout
      const result = await Promise.race([handler.send(item.payload), timeoutPromise]);

      // Increment rate limit counter on success
      this.rateLimiter.increment(item.payload.channel);

      if (result.success) {
        await this.handleSuccess(item, result);
      } else {
        await this.handleFailure(item, result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ChannelSendResult = {
        success: false,
        channel: item.payload.channel,
        error: errorMessage,
        shouldRetry: errorMessage !== "Processing timeout",
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      await this.handleFailure(item, result);
      return result;
    }
  }

  private async handleSuccess(item: QueueItem, result: ChannelSendResult): Promise<void> {
    await this.storage.update(item.id, {
      status: NotificationStatus.SENT,
      completedAt: new Date(),
      error: null,
      incrementAttempts: true, // Track that we made an attempt
    });

    await this.emitEvent({
      type: "queue:item_sent",
      timestamp: new Date(),
      itemId: item.id,
      channel: item.payload.channel,
      metadata: {
        externalId: result.externalId,
        duration: result.duration,
      },
    });
  }

  private async handleFailure(item: QueueItem, result: ChannelSendResult): Promise<void> {
    // Increment attempt count
    const updatedItem = await this.storage.update(item.id, {
      incrementAttempts: true,
      error: result.error,
    });

    if (!updatedItem) return;

    // Check if should retry
    const canRetry = result.shouldRetry !== false && updatedItem.attempts < updatedItem.maxAttempts;

    if (canRetry) {
      // Calculate retry delay
      const retryDelay =
        typeof this.config.retryDelay === "function"
          ? this.config.retryDelay(updatedItem.attempts)
          : this.config.retryDelay;

      const scheduledAt = new Date(Date.now() + retryDelay);

      // Update status to pending with new scheduled time for retry
      await this.storage.update(item.id, {
        status: NotificationStatus.PENDING,
        processingStartedAt: null,
        scheduledAt: scheduledAt,
      });

      await this.emitEvent({
        type: "queue:item_retrying",
        timestamp: new Date(),
        itemId: item.id,
        channel: item.payload.channel,
        error: result.error,
        metadata: {
          attempt: updatedItem.attempts,
          maxAttempts: updatedItem.maxAttempts,
          nextRetry: scheduledAt,
          retryDelay,
        },
      });
    } else if (this.config.deadLetterEnabled) {
      // Move to dead letter queue
      await this.storage.update(item.id, {
        status: NotificationStatus.DEAD_LETTER,
      });

      await this.emitEvent({
        type: "queue:item_dead_letter",
        timestamp: new Date(),
        itemId: item.id,
        channel: item.payload.channel,
        error: result.error,
        metadata: {
          attempts: updatedItem.attempts,
        },
      });
    } else {
      // Mark as permanently failed
      await this.storage.update(item.id, {
        status: NotificationStatus.FAILED,
      });

      await this.emitEvent({
        type: "queue:item_failed",
        timestamp: new Date(),
        itemId: item.id,
        channel: item.payload.channel,
        error: result.error,
        metadata: {
          attempts: updatedItem.attempts,
        },
      });
    }
  }

  private async checkQueueDepth(): Promise<void> {
    // Only check every 10 seconds
    const now = new Date();
    if (
      this.lastStatsCheck &&
      now.getTime() - this.lastStatsCheck.getTime() < 10000
    ) {
      return;
    }
    this.lastStatsCheck = now;

    const stats = await this.storage.getStats();

    if (stats.queueDepth >= this.depthCriticalThreshold) {
      await this.emitEvent({
        type: "queue:depth_critical",
        timestamp: new Date(),
        queueDepth: stats.queueDepth,
        metadata: {
          threshold: this.depthCriticalThreshold,
          byStatus: stats.byStatus,
        },
      });
    } else if (stats.queueDepth >= this.depthWarningThreshold) {
      await this.emitEvent({
        type: "queue:depth_warning",
        timestamp: new Date(),
        queueDepth: stats.queueDepth,
        metadata: {
          threshold: this.depthWarningThreshold,
          byStatus: stats.byStatus,
        },
      });
    }
  }

  private async emitEvent(event: QueueEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        // Emit error event for handler failures
        if (event.type !== "queue:error") {
          this.emitEvent({
            type: "queue:error",
            timestamp: new Date(),
            error: error instanceof Error ? error.message : String(error),
            metadata: {
              originalEvent: event.type,
            },
          });
        }
      }
    }
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedProcessor: QueueProcessor | null = null;

/**
 * Get or create shared queue processor instance
 */
export function getQueueProcessor(
  storage: QueueStorage,
  config?: Partial<QueueProcessorConfig>
): QueueProcessor {
  if (!sharedProcessor) {
    sharedProcessor = new QueueProcessor(storage, config);
  }
  return sharedProcessor;
}

/**
 * Reset shared queue processor instance
 */
export function resetQueueProcessor(): void {
  if (sharedProcessor) {
    sharedProcessor.stop();
  }
  sharedProcessor = null;
}

/**
 * Set custom queue processor instance
 */
export function setQueueProcessor(processor: QueueProcessor): void {
  sharedProcessor = processor;
}
