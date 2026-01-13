/**
 * Notification Queue Manager
 * High-level API for managing the notification queue
 */

import {
  QueueItem,
  QueueStorage,
  QueueProcessorConfig,
  QueueEventHandler,
  ChannelHandler,
  NotificationStatus,
  NotificationChannel,
  NotificationPriority,
  QueueStats,
  QueueFilterOptions,
  CreateQueueItemInput,
  createQueueItem,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
  QueueProcessorStatus,
} from "./types";
import { InMemoryQueueStorage, resetQueueStorage } from "./storage";
import { QueueProcessor, resetQueueProcessor } from "./processor";

/**
 * Notification Queue Manager configuration
 */
export interface NotificationQueueConfig extends Partial<QueueProcessorConfig> {
  /** Whether to auto-start the processor */
  autoStart?: boolean;
  /** Custom storage implementation */
  storage?: QueueStorage;
  /** Channel handlers to register */
  handlers?: ChannelHandler[];
}

/**
 * Notification Queue Manager
 * Main entry point for the notification queue system
 */
export class NotificationQueue {
  private storage: QueueStorage;
  private processor: QueueProcessor;

  constructor(config: NotificationQueueConfig = {}) {
    // Use provided storage or create in-memory storage
    this.storage = config.storage || new InMemoryQueueStorage();

    // Create processor with configuration
    this.processor = new QueueProcessor(this.storage, config);

    // Register provided handlers
    if (config.handlers) {
      for (const handler of config.handlers) {
        this.processor.registerHandler(handler);
      }
    }

    // Auto-start if configured
    if (config.autoStart) {
      this.start();
    }
  }

  // ============================================================================
  // Queue Operations
  // ============================================================================

  /**
   * Add a notification to the queue
   */
  async add(input: CreateQueueItemInput): Promise<QueueItem> {
    const item = createQueueItem(input);
    await this.storage.add(item);

    return item;
  }

  /**
   * Add email notification to the queue
   */
  async addEmail(
    to: string | string[],
    subject: string,
    body: string,
    options?: {
      html?: string;
      priority?: NotificationPriority;
      scheduledAt?: Date;
      correlationId?: string;
      templateId?: string;
      templateVars?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ): Promise<QueueItem> {
    const payload: EmailNotificationPayload = {
      channel: NotificationChannel.EMAIL,
      to,
      subject,
      title: subject,
      body,
      html: options?.html,
      templateId: options?.templateId,
      templateVars: options?.templateVars,
      metadata: options?.metadata,
    };

    return this.add({
      payload,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Add Telegram notification to the queue
   */
  async addTelegram(
    chatId: string | number,
    message: string,
    options?: {
      parseMode?: "HTML" | "Markdown" | "MarkdownV2";
      priority?: NotificationPriority;
      scheduledAt?: Date;
      correlationId?: string;
      buttons?: Array<Array<{ text: string; url?: string; callbackData?: string }>>;
      disableWebPagePreview?: boolean;
      disableNotification?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<QueueItem> {
    const payload: TelegramNotificationPayload = {
      channel: NotificationChannel.TELEGRAM,
      chatId,
      title: "Polymarket Alert",
      body: message,
      parseMode: options?.parseMode,
      buttons: options?.buttons,
      disableWebPagePreview: options?.disableWebPagePreview,
      disableNotification: options?.disableNotification,
      metadata: options?.metadata,
    };

    return this.add({
      payload,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Add Discord notification to the queue
   */
  async addDiscord(
    content: string,
    options?: {
      webhookUrl?: string;
      embeds?: Array<{
        title?: string;
        description?: string;
        color?: number;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
        footer?: { text: string; icon_url?: string };
        timestamp?: string;
      }>;
      username?: string;
      avatarUrl?: string;
      priority?: NotificationPriority;
      scheduledAt?: Date;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<QueueItem> {
    const payload: DiscordNotificationPayload = {
      channel: NotificationChannel.DISCORD,
      title: "Polymarket Alert",
      body: content,
      webhookUrl: options?.webhookUrl,
      embeds: options?.embeds,
      username: options?.username,
      avatarUrl: options?.avatarUrl,
      metadata: options?.metadata,
    };

    return this.add({
      payload,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Add push notification to the queue
   */
  async addPush(
    target: string | string[],
    title: string,
    body: string,
    options?: {
      icon?: string;
      badge?: string;
      image?: string;
      tag?: string;
      url?: string;
      actions?: Array<{ action: string; title: string; icon?: string }>;
      requireInteraction?: boolean;
      priority?: NotificationPriority;
      scheduledAt?: Date;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<QueueItem> {
    const payload: PushNotificationPayload = {
      channel: NotificationChannel.PUSH,
      target,
      title,
      body,
      icon: options?.icon,
      badge: options?.badge,
      image: options?.image,
      tag: options?.tag,
      url: options?.url,
      actions: options?.actions,
      requireInteraction: options?.requireInteraction,
      metadata: options?.metadata,
    };

    return this.add({
      payload,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Add SMS notification to the queue
   */
  async addSms(
    phoneNumber: string | string[],
    message: string,
    options?: {
      priority?: NotificationPriority;
      scheduledAt?: Date;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<QueueItem> {
    const payload: SmsNotificationPayload = {
      channel: NotificationChannel.SMS,
      phoneNumber,
      title: "Polymarket Alert",
      body: message,
      metadata: options?.metadata,
    };

    return this.add({
      payload,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Add multiple notifications at once
   */
  async addBatch(inputs: CreateQueueItemInput[]): Promise<QueueItem[]> {
    const items: QueueItem[] = [];
    for (const input of inputs) {
      const item = await this.add(input);
      items.push(item);
    }
    return items;
  }

  /**
   * Get a queue item by ID
   */
  async get(id: string): Promise<QueueItem | null> {
    return this.storage.get(id);
  }

  /**
   * Find queue items matching filter
   */
  async find(filter: QueueFilterOptions): Promise<QueueItem[]> {
    return this.storage.find(filter);
  }

  /**
   * Count queue items matching filter
   */
  async count(filter: QueueFilterOptions): Promise<number> {
    return this.storage.count(filter);
  }

  /**
   * Remove a queue item
   */
  async remove(id: string): Promise<boolean> {
    return this.storage.remove(id);
  }

  /**
   * Clear queue items
   */
  async clear(filter?: QueueFilterOptions): Promise<number> {
    return this.storage.clear(filter);
  }

  // ============================================================================
  // Processor Control
  // ============================================================================

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    await this.processor.start();
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    await this.processor.stop();
  }

  /**
   * Pause the queue processor
   */
  async pause(): Promise<void> {
    await this.processor.pause();
  }

  /**
   * Resume the queue processor
   */
  async resume(): Promise<void> {
    await this.processor.resume();
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.processor.getStatus() === QueueProcessorStatus.RUNNING;
  }

  /**
   * Get processor status
   */
  getProcessorStatus(): QueueProcessorStatus {
    return this.processor.getStatus();
  }

  /**
   * Process pending items immediately
   */
  async processPending(): Promise<number> {
    return this.processor.processPending();
  }

  /**
   * Retry failed items
   */
  async retryFailed(limit?: number): Promise<number> {
    return this.processor.retryFailed(limit);
  }

  /**
   * Clean up expired items
   */
  async cleanupExpired(): Promise<number> {
    return this.processor.cleanupExpired();
  }

  // ============================================================================
  // Handler Management
  // ============================================================================

  /**
   * Register a channel handler
   */
  registerHandler(handler: ChannelHandler): void {
    this.processor.registerHandler(handler);
  }

  /**
   * Unregister a channel handler
   */
  unregisterHandler(channel: NotificationChannel): void {
    this.processor.unregisterHandler(channel);
  }

  /**
   * Get registered handlers
   */
  getHandlers(): Map<NotificationChannel, ChannelHandler> {
    return this.processor.getHandlers();
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Add event listener
   */
  on(handler: QueueEventHandler): void {
    this.processor.on(handler);
  }

  /**
   * Remove event listener
   */
  off(handler: QueueEventHandler): void {
    this.processor.off(handler);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return this.storage.getStats();
  }

  /**
   * Get pending count
   */
  async getPendingCount(): Promise<number> {
    return this.storage.count({ status: NotificationStatus.PENDING });
  }

  /**
   * Get processing count
   */
  getProcessingCount(): number {
    return this.processor.getProcessingCount();
  }

  /**
   * Get dead letter items
   */
  async getDeadLetter(limit?: number): Promise<QueueItem[]> {
    return this.storage.getDeadLetter(limit);
  }

  /**
   * Get queue depth (pending + processing + retrying)
   */
  async getQueueDepth(): Promise<number> {
    const stats = await this.getStats();
    return stats.queueDepth;
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedQueue: NotificationQueue | null = null;

/**
 * Get or create shared notification queue instance
 */
export function getNotificationQueue(config?: NotificationQueueConfig): NotificationQueue {
  if (!sharedQueue) {
    sharedQueue = new NotificationQueue(config);
  }
  return sharedQueue;
}

/**
 * Reset shared notification queue instance
 */
export function resetNotificationQueue(): void {
  if (sharedQueue) {
    sharedQueue.stop();
  }
  sharedQueue = null;
  resetQueueStorage();
  resetQueueProcessor();
}

/**
 * Set custom notification queue instance
 */
export function setNotificationQueue(queue: NotificationQueue): void {
  sharedQueue = queue;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add a notification to the shared queue
 */
export async function queueNotification(input: CreateQueueItemInput): Promise<QueueItem> {
  const queue = getNotificationQueue();
  return queue.add(input);
}

/**
 * Add an email notification to the shared queue
 */
export async function queueEmail(
  to: string | string[],
  subject: string,
  body: string,
  options?: Parameters<NotificationQueue["addEmail"]>[3]
): Promise<QueueItem> {
  const queue = getNotificationQueue();
  return queue.addEmail(to, subject, body, options);
}

/**
 * Add a Telegram notification to the shared queue
 */
export async function queueTelegram(
  chatId: string | number,
  message: string,
  options?: Parameters<NotificationQueue["addTelegram"]>[2]
): Promise<QueueItem> {
  const queue = getNotificationQueue();
  return queue.addTelegram(chatId, message, options);
}

/**
 * Add a Discord notification to the shared queue
 */
export async function queueDiscord(
  content: string,
  options?: Parameters<NotificationQueue["addDiscord"]>[1]
): Promise<QueueItem> {
  const queue = getNotificationQueue();
  return queue.addDiscord(content, options);
}

/**
 * Add a push notification to the shared queue
 */
export async function queuePush(
  target: string | string[],
  title: string,
  body: string,
  options?: Parameters<NotificationQueue["addPush"]>[3]
): Promise<QueueItem> {
  const queue = getNotificationQueue();
  return queue.addPush(target, title, body, options);
}
