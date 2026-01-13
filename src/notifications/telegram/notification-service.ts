/**
 * Telegram Instant Notification Service
 * High-level service for sending instant alerts via Telegram
 */

import {
  TelegramClient,
  getTelegramClient,
} from "./client";
import {
  TelegramAlertData,
  TelegramAlertOptions,
  AlertSeverity,
  AlertType,
  createAlertMessage,
  createAlertSummaryMessage,
  validateAlertData,
} from "./alert-formatter";
import {
  TelegramMessageStatus,
} from "./types";

/**
 * Notification priority levels
 */
export type NotificationPriority = "urgent" | "high" | "normal" | "low";

/**
 * Priority to severity mapping for filtering
 */
const PRIORITY_SEVERITY_MAP: Record<NotificationPriority, AlertSeverity[]> = {
  urgent: ["critical"],
  high: ["critical", "high"],
  normal: ["critical", "high", "medium"],
  low: ["critical", "high", "medium", "low", "info"],
};

/**
 * Notification recipient configuration
 */
export interface NotificationRecipient {
  /** Telegram chat ID (user, group, or channel) */
  chatId: string | number;
  /** User-friendly name for logging */
  name?: string;
  /** Minimum priority level to receive (default: normal) */
  minPriority?: NotificationPriority;
  /** Alert types to receive (undefined = all) */
  allowedTypes?: AlertType[];
  /** Alert types to mute */
  mutedTypes?: AlertType[];
  /** Whether notifications are enabled */
  enabled?: boolean;
  /** Custom formatting options */
  formatOptions?: TelegramAlertOptions;
}

/**
 * Notification delivery result
 */
export interface NotificationDeliveryResult {
  /** Whether the notification was sent successfully */
  success: boolean;
  /** Recipient chat ID */
  chatId: string | number;
  /** Message ID if sent */
  messageId?: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp of delivery attempt */
  timestamp: Date;
  /** Whether notification was skipped (filtered, muted, disabled) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Batch notification result
 */
export interface BatchNotificationResult {
  /** Alert ID that was sent */
  alertId: string;
  /** Total recipients attempted */
  total: number;
  /** Successfully delivered */
  delivered: number;
  /** Failed deliveries */
  failed: number;
  /** Skipped (filtered/muted) */
  skipped: number;
  /** Individual delivery results */
  results: NotificationDeliveryResult[];
  /** Timestamp when batch started */
  startedAt: Date;
  /** Timestamp when batch completed */
  completedAt: Date;
}

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
  /** Custom Telegram client (default: singleton) */
  client?: TelegramClient;
  /** Default formatting options for all notifications */
  defaultFormatOptions?: TelegramAlertOptions;
  /** Whether to validate alert data before sending */
  validateAlerts?: boolean;
  /** Whether to stop sending batch on first error */
  stopOnError?: boolean;
  /** Delay between batch messages (ms) */
  batchDelay?: number;
  /** Maximum concurrent sends */
  maxConcurrent?: number;
}

/**
 * Notification service event types
 */
export type NotificationServiceEventType =
  | "notification:sending"
  | "notification:sent"
  | "notification:failed"
  | "notification:skipped"
  | "batch:started"
  | "batch:completed";

/**
 * Notification service event
 */
export interface NotificationServiceEvent {
  type: NotificationServiceEventType;
  timestamp: Date;
  alertId?: string;
  chatId?: string | number;
  error?: string;
  skipReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type NotificationServiceEventHandler = (
  event: NotificationServiceEvent
) => void | Promise<void>;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<NotificationServiceConfig, "client">> = {
  defaultFormatOptions: {},
  validateAlerts: true,
  stopOnError: false,
  batchDelay: 50,
  maxConcurrent: 5,
};

/**
 * Telegram Notification Service
 * Manages sending instant alerts to Telegram recipients
 */
export class TelegramNotificationService {
  private readonly client: TelegramClient;
  private readonly config: Required<Omit<NotificationServiceConfig, "client">>;
  private readonly eventHandlers: Map<
    NotificationServiceEventType,
    Set<NotificationServiceEventHandler>
  >;

  // Delivery tracking
  private deliveryHistory: Map<
    string,
    { result: BatchNotificationResult; timestamp: Date }
  > = new Map();
  private readonly maxHistorySize = 1000;

  // Statistics
  private stats = {
    totalSent: 0,
    totalFailed: 0,
    totalSkipped: 0,
    lastSentAt: null as Date | null,
  };

  constructor(config: NotificationServiceConfig = {}) {
    this.client = config.client ?? getTelegramClient();
    this.config = {
      defaultFormatOptions: config.defaultFormatOptions ?? DEFAULT_CONFIG.defaultFormatOptions,
      validateAlerts: config.validateAlerts ?? DEFAULT_CONFIG.validateAlerts,
      stopOnError: config.stopOnError ?? DEFAULT_CONFIG.stopOnError,
      batchDelay: config.batchDelay ?? DEFAULT_CONFIG.batchDelay,
      maxConcurrent: config.maxConcurrent ?? DEFAULT_CONFIG.maxConcurrent,
    };
    this.eventHandlers = new Map();
  }

  /**
   * Subscribe to notification service events
   */
  on(
    event: NotificationServiceEventType,
    handler: NotificationServiceEventHandler
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribed handlers
   */
  private async emitEvent(event: NotificationServiceEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(
          `Error in notification service event handler for ${event.type}:`,
          error
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Send an instant alert to a single recipient
   */
  async sendAlert(
    recipient: NotificationRecipient,
    alert: TelegramAlertData,
    options: TelegramAlertOptions = {}
  ): Promise<NotificationDeliveryResult> {
    const timestamp = new Date();

    // Check if recipient is enabled
    if (recipient.enabled === false) {
      return this.createSkippedResult(
        recipient.chatId,
        "Recipient disabled",
        timestamp
      );
    }

    // Check priority filter
    if (!this.shouldSendByPriority(alert.severity, recipient.minPriority)) {
      return this.createSkippedResult(
        recipient.chatId,
        `Below minimum priority (${recipient.minPriority})`,
        timestamp
      );
    }

    // Check allowed types
    if (
      recipient.allowedTypes &&
      !recipient.allowedTypes.includes(alert.alertType)
    ) {
      return this.createSkippedResult(
        recipient.chatId,
        `Alert type ${alert.alertType} not in allowed types`,
        timestamp
      );
    }

    // Check muted types
    if (
      recipient.mutedTypes &&
      recipient.mutedTypes.includes(alert.alertType)
    ) {
      return this.createSkippedResult(
        recipient.chatId,
        `Alert type ${alert.alertType} is muted`,
        timestamp
      );
    }

    // Validate alert data
    if (this.config.validateAlerts) {
      const errors = validateAlertData(alert);
      if (errors.length > 0) {
        return {
          success: false,
          chatId: recipient.chatId,
          timestamp,
          error: `Validation failed: ${errors.join(", ")}`,
        };
      }
    }

    // Merge formatting options
    const formatOptions: TelegramAlertOptions = {
      ...this.config.defaultFormatOptions,
      ...recipient.formatOptions,
      ...options,
    };

    // Emit sending event
    await this.emitEvent({
      type: "notification:sending",
      timestamp,
      alertId: alert.alertId,
      chatId: recipient.chatId,
    });

    try {
      // Create and send the message
      const message = createAlertMessage(
        recipient.chatId,
        alert,
        formatOptions
      );
      const result = await this.client.sendMessage(message);

      if (result.status === TelegramMessageStatus.SENT) {
        this.stats.totalSent++;
        this.stats.lastSentAt = new Date();

        await this.emitEvent({
          type: "notification:sent",
          timestamp: result.timestamp,
          alertId: alert.alertId,
          chatId: recipient.chatId,
          metadata: { messageId: result.messageId },
        });

        return {
          success: true,
          chatId: recipient.chatId,
          messageId: result.messageId,
          timestamp: result.timestamp,
        };
      } else {
        this.stats.totalFailed++;

        await this.emitEvent({
          type: "notification:failed",
          timestamp: new Date(),
          alertId: alert.alertId,
          chatId: recipient.chatId,
          error: result.error,
        });

        return {
          success: false,
          chatId: recipient.chatId,
          timestamp: new Date(),
          error: result.error || "Unknown error",
        };
      }
    } catch (error) {
      this.stats.totalFailed++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.emitEvent({
        type: "notification:failed",
        timestamp: new Date(),
        alertId: alert.alertId,
        chatId: recipient.chatId,
        error: errorMessage,
      });

      return {
        success: false,
        chatId: recipient.chatId,
        timestamp: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Send an alert to multiple recipients
   */
  async sendAlertToMany(
    recipients: NotificationRecipient[],
    alert: TelegramAlertData,
    options: TelegramAlertOptions = {}
  ): Promise<BatchNotificationResult> {
    const startedAt = new Date();
    const results: NotificationDeliveryResult[] = [];

    await this.emitEvent({
      type: "batch:started",
      timestamp: startedAt,
      alertId: alert.alertId,
      metadata: { recipientCount: recipients.length },
    });

    // Process in chunks for concurrency control
    const chunks = this.chunkArray(recipients, this.config.maxConcurrent);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((recipient) => this.sendAlert(recipient, alert, options))
      );

      results.push(...chunkResults);

      // Check for stop on error
      if (
        this.config.stopOnError &&
        chunkResults.some((r) => !r.success && !r.skipped)
      ) {
        break;
      }

      // Delay between chunks
      if (this.config.batchDelay > 0 && chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(this.config.batchDelay);
      }
    }

    const completedAt = new Date();

    const batchResult: BatchNotificationResult = {
      alertId: alert.alertId,
      total: recipients.length,
      delivered: results.filter((r) => r.success && !r.skipped).length,
      failed: results.filter((r) => !r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
      startedAt,
      completedAt,
    };

    // Store in history
    this.addToHistory(alert.alertId, batchResult);

    await this.emitEvent({
      type: "batch:completed",
      timestamp: completedAt,
      alertId: alert.alertId,
      metadata: {
        delivered: batchResult.delivered,
        failed: batchResult.failed,
        skipped: batchResult.skipped,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });

    return batchResult;
  }

  /**
   * Send a summary of alerts to a recipient
   */
  async sendAlertSummary(
    recipient: NotificationRecipient,
    alerts: TelegramAlertData[],
    options: TelegramAlertOptions = {}
  ): Promise<NotificationDeliveryResult> {
    const timestamp = new Date();

    // Check if recipient is enabled
    if (recipient.enabled === false) {
      return this.createSkippedResult(
        recipient.chatId,
        "Recipient disabled",
        timestamp
      );
    }

    // Merge formatting options
    const formatOptions: TelegramAlertOptions = {
      ...this.config.defaultFormatOptions,
      ...recipient.formatOptions,
      ...options,
    };

    try {
      const message = createAlertSummaryMessage(
        recipient.chatId,
        alerts,
        formatOptions
      );
      const result = await this.client.sendMessage(message);

      if (result.status === TelegramMessageStatus.SENT) {
        this.stats.totalSent++;
        this.stats.lastSentAt = new Date();

        return {
          success: true,
          chatId: recipient.chatId,
          messageId: result.messageId,
          timestamp: result.timestamp,
        };
      } else {
        this.stats.totalFailed++;
        return {
          success: false,
          chatId: recipient.chatId,
          timestamp: new Date(),
          error: result.error || "Unknown error",
        };
      }
    } catch (error) {
      this.stats.totalFailed++;
      return {
        success: false,
        chatId: recipient.chatId,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get delivery result for an alert
   */
  getDeliveryResult(alertId: string): BatchNotificationResult | undefined {
    return this.deliveryHistory.get(alertId)?.result;
  }

  /**
   * Get all delivery history
   */
  getDeliveryHistory(): Array<{
    alertId: string;
    result: BatchNotificationResult;
    timestamp: Date;
  }> {
    return Array.from(this.deliveryHistory.entries()).map(
      ([alertId, data]) => ({
        alertId,
        ...data,
      })
    );
  }

  /**
   * Clear delivery history
   */
  clearDeliveryHistory(): void {
    this.deliveryHistory.clear();
  }

  /**
   * Get service statistics
   */
  getStats(): typeof this.stats & { successRate: number } {
    const total = this.stats.totalSent + this.stats.totalFailed;
    return {
      ...this.stats,
      successRate: total > 0 ? this.stats.totalSent / total : 0,
    };
  }

  /**
   * Reset service statistics
   */
  resetStats(): void {
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      totalSkipped: 0,
      lastSentAt: null,
    };
  }

  /**
   * Get the underlying Telegram client
   */
  getClient(): TelegramClient {
    return this.client;
  }

  /**
   * Check if client is in development mode
   */
  isDevMode(): boolean {
    return this.client.isDevMode();
  }

  /**
   * Check if alert should be sent based on priority
   */
  private shouldSendByPriority(
    severity: AlertSeverity,
    minPriority: NotificationPriority = "normal"
  ): boolean {
    const allowedSeverities = PRIORITY_SEVERITY_MAP[minPriority];
    return allowedSeverities.includes(severity);
  }

  /**
   * Create a skipped delivery result
   */
  private createSkippedResult(
    chatId: string | number,
    reason: string,
    timestamp: Date
  ): NotificationDeliveryResult {
    this.stats.totalSkipped++;

    this.emitEvent({
      type: "notification:skipped",
      timestamp,
      chatId,
      skipReason: reason,
    });

    return {
      success: true, // Skipped is considered successful (not a failure)
      chatId,
      timestamp,
      skipped: true,
      skipReason: reason,
    };
  }

  /**
   * Add result to delivery history
   */
  private addToHistory(alertId: string, result: BatchNotificationResult): void {
    // Remove oldest entries if at capacity
    if (this.deliveryHistory.size >= this.maxHistorySize) {
      const oldestKey = this.deliveryHistory.keys().next().value;
      if (oldestKey) {
        this.deliveryHistory.delete(oldestKey);
      }
    }

    this.deliveryHistory.set(alertId, {
      result,
      timestamp: new Date(),
    });
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton notification service instance
 */
let notificationServiceInstance: TelegramNotificationService | null = null;

/**
 * Get or create the notification service singleton
 */
export function getNotificationService(): TelegramNotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new TelegramNotificationService();
  }
  return notificationServiceInstance;
}

/**
 * Create a new notification service instance
 */
export function createNotificationService(
  config: NotificationServiceConfig = {}
): TelegramNotificationService {
  return new TelegramNotificationService(config);
}

/**
 * Reset the singleton notification service (useful for testing)
 */
export function resetNotificationService(): void {
  notificationServiceInstance = null;
}

/**
 * Send instant alert helper function
 * Convenience function for one-off alert sending
 */
export async function sendInstantAlert(
  chatId: string | number,
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): Promise<NotificationDeliveryResult> {
  const service = getNotificationService();
  return service.sendAlert({ chatId }, alert, options);
}

/**
 * Send instant alert to multiple recipients helper function
 */
export async function sendInstantAlertToMany(
  chatIds: Array<string | number>,
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): Promise<BatchNotificationResult> {
  const service = getNotificationService();
  const recipients: NotificationRecipient[] = chatIds.map((chatId) => ({
    chatId,
  }));
  return service.sendAlertToMany(recipients, alert, options);
}
