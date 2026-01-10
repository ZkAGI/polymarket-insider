/**
 * WebSocket Message Queue (API-WS-008)
 *
 * Provides a high-performance message queue for handling incoming WebSocket messages
 * during high load situations. Features include:
 * - Asynchronous message processing
 * - Backpressure handling with configurable limits
 * - Queue depth monitoring
 * - Priority message support
 * - Statistics tracking
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Message priority levels
 */
export type MessagePriority = "high" | "normal" | "low";

/**
 * Priority values for sorting
 */
export const PRIORITY_VALUES: Record<MessagePriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
} as const;

/**
 * Queued message structure
 */
export interface QueuedMessage<T = unknown> {
  /** Unique message ID */
  id: string;

  /** Message data */
  data: T;

  /** Message priority */
  priority: MessagePriority;

  /** When the message was queued */
  queuedAt: Date;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message processor function type
 */
export type MessageProcessor<T = unknown> = (message: QueuedMessage<T>) => void | Promise<void>;

/**
 * Backpressure strategy
 */
export type BackpressureStrategy =
  /** Drop oldest messages when queue is full */
  | "dropOldest"
  /** Drop newest messages (incoming) when queue is full */
  | "dropNewest"
  /** Block/pause until queue has space */
  | "block"
  /** Throw error when queue is full */
  | "error";

/**
 * Queue state
 */
export type QueueState =
  | "idle"
  | "processing"
  | "paused"
  | "blocked"
  | "disposed";

/**
 * Message queue configuration
 */
export interface MessageQueueConfig {
  /** Maximum queue size (default: 10000) */
  maxSize?: number;

  /** Batch size for processing (default: 100) */
  batchSize?: number;

  /** Processing interval in ms (default: 10) */
  processingInterval?: number;

  /** Backpressure strategy (default: "dropOldest") */
  backpressureStrategy?: BackpressureStrategy;

  /** High water mark for backpressure (default: 80% of maxSize) */
  highWaterMark?: number;

  /** Low water mark to resume after backpressure (default: 50% of maxSize) */
  lowWaterMark?: number;

  /** Enable priority queue (default: false) */
  enablePriority?: boolean;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: QueueLogger;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Current queue size */
  currentSize: number;

  /** Maximum queue size */
  maxSize: number;

  /** Total messages enqueued */
  totalEnqueued: number;

  /** Total messages processed */
  totalProcessed: number;

  /** Total messages dropped */
  totalDropped: number;

  /** Total processing errors */
  totalErrors: number;

  /** Messages processed per second (rolling average) */
  processingRate: number;

  /** Average queue wait time in ms */
  avgWaitTime: number;

  /** Maximum queue wait time in ms */
  maxWaitTime: number;

  /** Current queue state */
  state: QueueState;

  /** Whether backpressure is active */
  backpressureActive: boolean;

  /** Time in backpressure state (ms) */
  backpressureTime: number;

  /** Queue utilization percentage */
  utilization: number;
}

/**
 * Queue event types
 */
export const QueueEventType = {
  MESSAGE_ENQUEUED: "messageEnqueued",
  MESSAGE_PROCESSED: "messageProcessed",
  MESSAGE_DROPPED: "messageDropped",
  PROCESSING_ERROR: "processingError",
  BACKPRESSURE_START: "backpressureStart",
  BACKPRESSURE_END: "backpressureEnd",
  QUEUE_EMPTY: "queueEmpty",
  QUEUE_FULL: "queueFull",
  STATE_CHANGE: "stateChange",
  BATCH_PROCESSED: "batchProcessed",
} as const;

export type QueueEventTypeValue = (typeof QueueEventType)[keyof typeof QueueEventType];

/**
 * Base queue event
 */
export interface QueueEvent {
  type: QueueEventTypeValue;
  timestamp: Date;
  queueSize: number;
}

/**
 * Message enqueued event
 */
export interface MessageEnqueuedEvent extends QueueEvent {
  type: typeof QueueEventType.MESSAGE_ENQUEUED;
  messageId: string;
  priority: MessagePriority;
}

/**
 * Message processed event
 */
export interface MessageProcessedEvent extends QueueEvent {
  type: typeof QueueEventType.MESSAGE_PROCESSED;
  messageId: string;
  waitTime: number;
  processingTime: number;
}

/**
 * Message dropped event
 */
export interface MessageDroppedEvent extends QueueEvent {
  type: typeof QueueEventType.MESSAGE_DROPPED;
  messageId: string;
  reason: "backpressure" | "queueFull" | "disposed";
}

/**
 * Processing error event
 */
export interface ProcessingErrorEvent extends QueueEvent {
  type: typeof QueueEventType.PROCESSING_ERROR;
  messageId: string;
  error: Error;
}

/**
 * Backpressure start event
 */
export interface BackpressureStartEvent extends QueueEvent {
  type: typeof QueueEventType.BACKPRESSURE_START;
  strategy: BackpressureStrategy;
}

/**
 * Backpressure end event
 */
export interface BackpressureEndEvent extends QueueEvent {
  type: typeof QueueEventType.BACKPRESSURE_END;
  duration: number;
}

/**
 * Queue empty event
 */
export interface QueueEmptyEvent extends QueueEvent {
  type: typeof QueueEventType.QUEUE_EMPTY;
  totalProcessed: number;
}

/**
 * Queue full event
 */
export interface QueueFullEvent extends QueueEvent {
  type: typeof QueueEventType.QUEUE_FULL;
  droppedCount: number;
}

/**
 * State change event
 */
export interface StateChangeEvent extends QueueEvent {
  type: typeof QueueEventType.STATE_CHANGE;
  previousState: QueueState;
  currentState: QueueState;
}

/**
 * Batch processed event
 */
export interface BatchProcessedEvent extends QueueEvent {
  type: typeof QueueEventType.BATCH_PROCESSED;
  batchSize: number;
  processingTime: number;
}

/**
 * All queue event types
 */
export type QueueEventUnion =
  | MessageEnqueuedEvent
  | MessageProcessedEvent
  | MessageDroppedEvent
  | ProcessingErrorEvent
  | BackpressureStartEvent
  | BackpressureEndEvent
  | QueueEmptyEvent
  | QueueFullEvent
  | StateChangeEvent
  | BatchProcessedEvent;

/**
 * Event listener map for queue events
 */
export interface QueueEventListenerMap {
  [QueueEventType.MESSAGE_ENQUEUED]: ((event: MessageEnqueuedEvent) => void)[];
  [QueueEventType.MESSAGE_PROCESSED]: ((event: MessageProcessedEvent) => void)[];
  [QueueEventType.MESSAGE_DROPPED]: ((event: MessageDroppedEvent) => void)[];
  [QueueEventType.PROCESSING_ERROR]: ((event: ProcessingErrorEvent) => void)[];
  [QueueEventType.BACKPRESSURE_START]: ((event: BackpressureStartEvent) => void)[];
  [QueueEventType.BACKPRESSURE_END]: ((event: BackpressureEndEvent) => void)[];
  [QueueEventType.QUEUE_EMPTY]: ((event: QueueEmptyEvent) => void)[];
  [QueueEventType.QUEUE_FULL]: ((event: QueueFullEvent) => void)[];
  [QueueEventType.STATE_CHANGE]: ((event: StateChangeEvent) => void)[];
  [QueueEventType.BATCH_PROCESSED]: ((event: BatchProcessedEvent) => void)[];
}

/**
 * Logger interface
 */
export interface QueueLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Enqueue options
 */
export interface EnqueueOptions {
  /** Message priority (default: "normal") */
  priority?: MessagePriority;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Custom message ID (auto-generated if not provided) */
  id?: string;
}

/**
 * Enqueue result
 */
export interface EnqueueResult {
  /** Whether the message was enqueued successfully */
  success: boolean;

  /** Message ID */
  messageId: string;

  /** Current queue position (if enqueued) */
  position?: number;

  /** Reason if not enqueued */
  reason?: "queueFull" | "disposed" | "blocked";
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_MAX_SIZE = 10000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_PROCESSING_INTERVAL = 10;
const DEFAULT_HIGH_WATER_MARK_RATIO = 0.8;
const DEFAULT_LOW_WATER_MARK_RATIO = 0.5;

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger: QueueLogger = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const debugLogger: QueueLogger = {
  debug: (...args) => console.debug("[MessageQueue]", ...args),
  info: (...args) => console.info("[MessageQueue]", ...args),
  warn: (...args) => console.warn("[MessageQueue]", ...args),
  error: (...args) => console.error("[MessageQueue]", ...args),
};

// ============================================================================
// Message Queue Class
// ============================================================================

/**
 * High-performance message queue for WebSocket message handling
 */
export class MessageQueue<T = unknown> {
  private readonly config: Required<MessageQueueConfig>;
  private readonly logger: QueueLogger;

  private queue: QueuedMessage<T>[] = [];
  private state: QueueState = "idle";
  private processor: MessageProcessor<T> | null = null;
  private processingTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  // Statistics tracking
  private totalEnqueued = 0;
  private totalProcessed = 0;
  private totalDropped = 0;
  private totalErrors = 0;
  private waitTimes: number[] = [];
  private processingStartTime: number | null = null;
  private recentProcessedCounts: Array<{ time: number; count: number }> = [];

  // Backpressure tracking
  private backpressureActive = false;
  private backpressureStartTime: number | null = null;
  private totalBackpressureTime = 0;
  private blockedEnqueueResolvers: Array<() => void> = [];

  // Event listeners
  private readonly listeners: QueueEventListenerMap = {
    [QueueEventType.MESSAGE_ENQUEUED]: [],
    [QueueEventType.MESSAGE_PROCESSED]: [],
    [QueueEventType.MESSAGE_DROPPED]: [],
    [QueueEventType.PROCESSING_ERROR]: [],
    [QueueEventType.BACKPRESSURE_START]: [],
    [QueueEventType.BACKPRESSURE_END]: [],
    [QueueEventType.QUEUE_EMPTY]: [],
    [QueueEventType.QUEUE_FULL]: [],
    [QueueEventType.STATE_CHANGE]: [],
    [QueueEventType.BATCH_PROCESSED]: [],
  };

  constructor(config: MessageQueueConfig = {}) {
    const maxSize = config.maxSize ?? DEFAULT_MAX_SIZE;

    this.config = {
      maxSize,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      processingInterval: config.processingInterval ?? DEFAULT_PROCESSING_INTERVAL,
      backpressureStrategy: config.backpressureStrategy ?? "dropOldest",
      highWaterMark: config.highWaterMark ?? Math.floor(maxSize * DEFAULT_HIGH_WATER_MARK_RATIO),
      lowWaterMark: config.lowWaterMark ?? Math.floor(maxSize * DEFAULT_LOW_WATER_MARK_RATIO),
      enablePriority: config.enablePriority ?? false,
      debug: config.debug ?? false,
      logger: config.logger ?? (config.debug ? debugLogger : defaultLogger),
    };

    this.logger = this.config.logger;
  }

  // ==========================================================================
  // Public Properties
  // ==========================================================================

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.config.maxSize;
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return this.state;
  }

  /**
   * Check if backpressure is active
   */
  isBackpressureActive(): boolean {
    return this.backpressureActive;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const processingRate = this.calculateProcessingRate();
    const avgWaitTime = this.calculateAverageWaitTime();
    const maxWaitTime = this.calculateMaxWaitTime();

    return {
      currentSize: this.queue.length,
      maxSize: this.config.maxSize,
      totalEnqueued: this.totalEnqueued,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      totalErrors: this.totalErrors,
      processingRate,
      avgWaitTime,
      maxWaitTime,
      state: this.state,
      backpressureActive: this.backpressureActive,
      backpressureTime: this.totalBackpressureTime + this.getCurrentBackpressureDuration(),
      utilization: (this.queue.length / this.config.maxSize) * 100,
    };
  }

  /**
   * Get queue configuration
   */
  getConfig(): Readonly<Required<MessageQueueConfig>> {
    return { ...this.config };
  }

  // ==========================================================================
  // Queue Operations
  // ==========================================================================

  /**
   * Enqueue a message for processing
   */
  async enqueue(data: T, options: EnqueueOptions = {}): Promise<EnqueueResult> {
    const messageId = options.id ?? generateMessageId();

    if (this.state === "disposed") {
      return { success: false, messageId, reason: "disposed" };
    }

    // Check backpressure
    if (this.backpressureActive || this.queue.length >= this.config.highWaterMark) {
      if (!this.backpressureActive) {
        this.startBackpressure();
      }

      const result = await this.handleBackpressure(data, messageId, options);
      if (!result.success) {
        return result;
      }
    }

    // Check queue full
    if (this.isFull()) {
      this.emit(QueueEventType.QUEUE_FULL, {
        type: QueueEventType.QUEUE_FULL,
        timestamp: new Date(),
        queueSize: this.queue.length,
        droppedCount: this.totalDropped,
      });

      return { success: false, messageId, reason: "queueFull" };
    }

    // Create queued message
    const message: QueuedMessage<T> = {
      id: messageId,
      data,
      priority: options.priority ?? "normal",
      queuedAt: new Date(),
      metadata: options.metadata,
    };

    // Add to queue
    if (this.config.enablePriority) {
      this.insertByPriority(message);
    } else {
      this.queue.push(message);
    }

    this.totalEnqueued++;

    this.emit(QueueEventType.MESSAGE_ENQUEUED, {
      type: QueueEventType.MESSAGE_ENQUEUED,
      timestamp: new Date(),
      queueSize: this.queue.length,
      messageId,
      priority: message.priority,
    });

    this.logger.debug(`Enqueued message ${messageId}, queue size: ${this.queue.length}`);

    // Start processing if not already
    this.ensureProcessing();

    return {
      success: true,
      messageId,
      position: this.queue.length,
    };
  }

  /**
   * Enqueue multiple messages at once
   */
  async enqueueBatch(items: Array<{ data: T; options?: EnqueueOptions }>): Promise<EnqueueResult[]> {
    const results: EnqueueResult[] = [];

    for (const item of items) {
      const result = await this.enqueue(item.data, item.options);
      results.push(result);
    }

    return results;
  }

  /**
   * Set the message processor function
   */
  setProcessor(processor: MessageProcessor<T>): void {
    this.processor = processor;
    this.logger.debug("Message processor set");
  }

  /**
   * Start processing messages
   */
  start(): void {
    if (this.state === "disposed") {
      this.logger.warn("Cannot start disposed queue");
      return;
    }

    if (this.processingTimer !== null) {
      return;
    }

    this.processingTimer = setInterval(() => {
      this.processNextBatch();
    }, this.config.processingInterval);

    this.setState("processing");
    this.logger.info("Queue processing started");
  }

  /**
   * Stop processing messages
   */
  stop(): void {
    if (this.processingTimer !== null) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    this.setState("idle");
    this.logger.info("Queue processing stopped");
  }

  /**
   * Pause processing (keeps timer running but skips processing)
   */
  pause(): void {
    if (this.state === "processing") {
      this.setState("paused");
      this.logger.info("Queue processing paused");
    }
  }

  /**
   * Resume processing after pause
   */
  resume(): void {
    if (this.state === "paused") {
      this.setState("processing");
      this.logger.info("Queue processing resumed");
    }
  }

  /**
   * Clear all messages from the queue
   */
  clear(): number {
    const count = this.queue.length;
    this.queue = [];

    if (this.backpressureActive) {
      this.endBackpressure();
    }

    // Resolve any blocked enqueuers
    this.resolveBlockedEnqueuers();

    this.logger.info(`Queue cleared, ${count} messages removed`);
    return count;
  }

  /**
   * Peek at the next message without removing it
   */
  peek(): QueuedMessage<T> | undefined {
    return this.queue[0];
  }

  /**
   * Get all messages in the queue (for inspection)
   */
  getMessages(): ReadonlyArray<QueuedMessage<T>> {
    return [...this.queue];
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<K extends QueueEventTypeValue>(
    event: K,
    listener: QueueEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends QueueEventTypeValue>(
    event: K,
    listener: QueueEventListenerMap[K][number]
  ): void {
    const listeners = this.listeners[event];
    const index = listeners.indexOf(listener as never);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends QueueEventTypeValue>(
    event: K,
    listener: QueueEventListenerMap[K][number]
  ): () => void {
    const wrapper = ((eventData: Parameters<QueueEventListenerMap[K][number]>[0]) => {
      this.off(event, wrapper as QueueEventListenerMap[K][number]);
      (listener as (e: Parameters<QueueEventListenerMap[K][number]>[0]) => void)(eventData);
    }) as QueueEventListenerMap[K][number];

    return this.on(event, wrapper);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: QueueEventTypeValue): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners)) {
        this.listeners[key as QueueEventTypeValue] = [];
      }
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of the queue and clean up resources
   */
  dispose(): void {
    this.stop();
    this.clear();
    this.removeAllListeners();
    this.processor = null;
    this.setState("disposed");
    this.logger.info("Queue disposed");
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setState(newState: QueueState): void {
    const previousState = this.state;
    if (previousState === newState) {
      return;
    }

    this.state = newState;

    this.emit(QueueEventType.STATE_CHANGE, {
      type: QueueEventType.STATE_CHANGE,
      timestamp: new Date(),
      queueSize: this.queue.length,
      previousState,
      currentState: newState,
    });
  }

  private emit<K extends QueueEventTypeValue>(
    event: K,
    data: Parameters<QueueEventListenerMap[K][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`Error in ${event} listener:`, error);
      }
    }
  }

  private ensureProcessing(): void {
    if (this.processingTimer === null && this.processor !== null && this.state !== "disposed") {
      this.start();
    }
  }

  private async processNextBatch(): Promise<void> {
    if (this.state === "paused" || this.state === "disposed" || this.isProcessing) {
      return;
    }

    if (this.queue.length === 0) {
      if (this.state === "processing") {
        this.emit(QueueEventType.QUEUE_EMPTY, {
          type: QueueEventType.QUEUE_EMPTY,
          timestamp: new Date(),
          queueSize: 0,
          totalProcessed: this.totalProcessed,
        });
      }
      return;
    }

    if (!this.processor) {
      return;
    }

    this.isProcessing = true;
    this.processingStartTime = Date.now();

    const batchSize = Math.min(this.config.batchSize, this.queue.length);
    const batch = this.queue.splice(0, batchSize);
    let processedCount = 0;

    for (const message of batch) {
      const waitTime = Date.now() - message.queuedAt.getTime();
      const processStartTime = Date.now();

      try {
        await this.processor(message);
        this.totalProcessed++;
        processedCount++;

        const processingTime = Date.now() - processStartTime;
        this.waitTimes.push(waitTime);
        if (this.waitTimes.length > 1000) {
          this.waitTimes.shift();
        }

        this.emit(QueueEventType.MESSAGE_PROCESSED, {
          type: QueueEventType.MESSAGE_PROCESSED,
          timestamp: new Date(),
          queueSize: this.queue.length,
          messageId: message.id,
          waitTime,
          processingTime,
        });
      } catch (error) {
        this.totalErrors++;
        const err = error instanceof Error ? error : new Error(String(error));

        this.emit(QueueEventType.PROCESSING_ERROR, {
          type: QueueEventType.PROCESSING_ERROR,
          timestamp: new Date(),
          queueSize: this.queue.length,
          messageId: message.id,
          error: err,
        });

        this.logger.error(`Error processing message ${message.id}:`, err);
      }
    }

    const batchTime = Date.now() - this.processingStartTime!;

    this.emit(QueueEventType.BATCH_PROCESSED, {
      type: QueueEventType.BATCH_PROCESSED,
      timestamp: new Date(),
      queueSize: this.queue.length,
      batchSize: processedCount,
      processingTime: batchTime,
    });

    // Track processing rate
    this.recentProcessedCounts.push({ time: Date.now(), count: processedCount });
    const oneSecondAgo = Date.now() - 1000;
    this.recentProcessedCounts = this.recentProcessedCounts.filter((r) => r.time > oneSecondAgo);

    this.isProcessing = false;
    this.processingStartTime = null;

    // Check if backpressure can be released
    if (this.backpressureActive && this.queue.length <= this.config.lowWaterMark) {
      this.endBackpressure();
    }
  }

  private insertByPriority(message: QueuedMessage<T>): void {
    const priority = PRIORITY_VALUES[message.priority];

    // Find insertion point
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = PRIORITY_VALUES[this.queue[i]!.priority];
      if (priority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, message);
  }

  private async handleBackpressure(
    _data: T,
    messageId: string,
    _options: EnqueueOptions
  ): Promise<EnqueueResult> {
    switch (this.config.backpressureStrategy) {
      case "dropOldest":
        if (this.isFull()) {
          const dropped = this.queue.shift();
          if (dropped) {
            this.totalDropped++;
            this.emit(QueueEventType.MESSAGE_DROPPED, {
              type: QueueEventType.MESSAGE_DROPPED,
              timestamp: new Date(),
              queueSize: this.queue.length,
              messageId: dropped.id,
              reason: "backpressure",
            });
          }
        }
        return { success: true, messageId };

      case "dropNewest":
        if (this.isFull()) {
          this.totalDropped++;
          this.emit(QueueEventType.MESSAGE_DROPPED, {
            type: QueueEventType.MESSAGE_DROPPED,
            timestamp: new Date(),
            queueSize: this.queue.length,
            messageId,
            reason: "backpressure",
          });
          return { success: false, messageId, reason: "queueFull" };
        }
        return { success: true, messageId };

      case "block":
        if (this.isFull()) {
          this.setState("blocked");
          await new Promise<void>((resolve) => {
            this.blockedEnqueueResolvers.push(resolve);
          });
          this.setState("processing");
        }
        return { success: true, messageId };

      case "error":
        if (this.isFull()) {
          throw new Error(`Queue is full (${this.config.maxSize} messages)`);
        }
        return { success: true, messageId };

      default:
        return { success: true, messageId };
    }
  }

  private startBackpressure(): void {
    this.backpressureActive = true;
    this.backpressureStartTime = Date.now();

    this.emit(QueueEventType.BACKPRESSURE_START, {
      type: QueueEventType.BACKPRESSURE_START,
      timestamp: new Date(),
      queueSize: this.queue.length,
      strategy: this.config.backpressureStrategy,
    });

    this.logger.warn(
      `Backpressure activated at queue size ${this.queue.length} (high water mark: ${this.config.highWaterMark})`
    );
  }

  private endBackpressure(): void {
    const duration = this.getCurrentBackpressureDuration();
    this.totalBackpressureTime += duration;

    this.backpressureActive = false;
    this.backpressureStartTime = null;

    // Resolve blocked enqueuers
    this.resolveBlockedEnqueuers();

    this.emit(QueueEventType.BACKPRESSURE_END, {
      type: QueueEventType.BACKPRESSURE_END,
      timestamp: new Date(),
      queueSize: this.queue.length,
      duration,
    });

    this.logger.info(
      `Backpressure released after ${duration}ms, queue size: ${this.queue.length}`
    );
  }

  private resolveBlockedEnqueuers(): void {
    const resolvers = this.blockedEnqueueResolvers;
    this.blockedEnqueueResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }

  private getCurrentBackpressureDuration(): number {
    if (!this.backpressureStartTime) {
      return 0;
    }
    return Date.now() - this.backpressureStartTime;
  }

  private calculateProcessingRate(): number {
    if (this.recentProcessedCounts.length === 0) {
      return 0;
    }

    const total = this.recentProcessedCounts.reduce((sum, r) => sum + r.count, 0);
    return total;
  }

  private calculateAverageWaitTime(): number {
    if (this.waitTimes.length === 0) {
      return 0;
    }

    const sum = this.waitTimes.reduce((a, b) => a + b, 0);
    return sum / this.waitTimes.length;
  }

  private calculateMaxWaitTime(): number {
    if (this.waitTimes.length === 0) {
      return 0;
    }

    return Math.max(...this.waitTimes);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Factory Functions
// ============================================================================

let sharedMessageQueue: MessageQueue | null = null;

/**
 * Create a new message queue
 */
export function createMessageQueue<T = unknown>(config?: MessageQueueConfig): MessageQueue<T> {
  return new MessageQueue<T>(config);
}

/**
 * Get the shared message queue instance
 */
export function getSharedMessageQueue<T = unknown>(): MessageQueue<T> {
  if (!sharedMessageQueue) {
    sharedMessageQueue = new MessageQueue();
  }
  return sharedMessageQueue as MessageQueue<T>;
}

/**
 * Set the shared message queue instance
 */
export function setSharedMessageQueue<T = unknown>(queue: MessageQueue<T>): void {
  sharedMessageQueue = queue as MessageQueue;
}

/**
 * Reset the shared message queue instance
 */
export function resetSharedMessageQueue(): void {
  if (sharedMessageQueue) {
    sharedMessageQueue.dispose();
    sharedMessageQueue = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a message processor that filters by message type
 */
export function createFilteredProcessor<T extends { type: string }>(
  handlers: Record<string, MessageProcessor<T>>
): MessageProcessor<T> {
  return async (message: QueuedMessage<T>) => {
    const type = message.data.type;
    const handler = handlers[type];
    if (handler) {
      await handler(message);
    }
  };
}

/**
 * Create a message processor that batches messages before processing
 */
export function createBatchProcessor<T>(
  batchHandler: (messages: QueuedMessage<T>[]) => void | Promise<void>,
  batchSize: number,
  flushInterval: number
): {
  processor: MessageProcessor<T>;
  flush: () => Promise<void>;
  dispose: () => void;
} {
  let batch: QueuedMessage<T>[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) {
      return;
    }

    const toProcess = batch;
    batch = [];

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    await batchHandler(toProcess);
  };

  const scheduleFlush = (): void => {
    if (flushTimer === null) {
      flushTimer = setTimeout(flush, flushInterval);
    }
  };

  const processor: MessageProcessor<T> = async (message: QueuedMessage<T>) => {
    batch.push(message);

    if (batch.length >= batchSize) {
      await flush();
    } else {
      scheduleFlush();
    }
  };

  const dispose = (): void => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    batch = [];
  };

  return { processor, flush, dispose };
}

/**
 * Calculate queue health score (0-100)
 */
export function calculateQueueHealth(stats: QueueStats): number {
  let score = 100;

  // Penalize high utilization
  if (stats.utilization > 90) {
    score -= 40;
  } else if (stats.utilization > 70) {
    score -= 20;
  } else if (stats.utilization > 50) {
    score -= 10;
  }

  // Penalize errors
  const errorRate = stats.totalErrors / Math.max(stats.totalProcessed, 1);
  if (errorRate > 0.1) {
    score -= 30;
  } else if (errorRate > 0.05) {
    score -= 15;
  } else if (errorRate > 0.01) {
    score -= 5;
  }

  // Penalize high wait times
  if (stats.avgWaitTime > 5000) {
    score -= 20;
  } else if (stats.avgWaitTime > 1000) {
    score -= 10;
  } else if (stats.avgWaitTime > 500) {
    score -= 5;
  }

  // Penalize backpressure
  if (stats.backpressureActive) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
