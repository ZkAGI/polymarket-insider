/**
 * Core notification queue types for the Polymarket Tracker
 * Defines interfaces and types for the notification queue system
 */

/**
 * Notification channel types
 */
export enum NotificationChannel {
  EMAIL = "email",
  TELEGRAM = "telegram",
  DISCORD = "discord",
  PUSH = "push",
  SMS = "sms",
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Notification queue item status
 */
export enum NotificationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SENT = "sent",
  FAILED = "failed",
  RETRYING = "retrying",
  DEAD_LETTER = "dead_letter",
}

/**
 * Queue processor status
 */
export enum QueueProcessorStatus {
  IDLE = "idle",
  RUNNING = "running",
  PAUSED = "paused",
  STOPPED = "stopped",
}

/**
 * Base notification payload
 */
export interface BaseNotificationPayload {
  /** Title of the notification */
  title: string;
  /** Body/message of the notification */
  body: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Email-specific notification payload
 */
export interface EmailNotificationPayload extends BaseNotificationPayload {
  channel: NotificationChannel.EMAIL;
  /** Email recipient(s) */
  to: string | string[];
  /** Email subject (uses title if not provided) */
  subject?: string;
  /** HTML content */
  html?: string;
  /** Reply-to address */
  replyTo?: string;
  /** Email template ID */
  templateId?: string;
  /** Template variables */
  templateVars?: Record<string, unknown>;
}

/**
 * Telegram-specific notification payload
 */
export interface TelegramNotificationPayload extends BaseNotificationPayload {
  channel: NotificationChannel.TELEGRAM;
  /** Chat ID to send to */
  chatId: string | number;
  /** Parse mode (HTML, Markdown, MarkdownV2) */
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  /** Inline keyboard buttons */
  buttons?: Array<Array<{ text: string; url?: string; callbackData?: string }>>;
  /** Disable web page preview */
  disableWebPagePreview?: boolean;
  /** Disable notification sound */
  disableNotification?: boolean;
}

/**
 * Discord-specific notification payload
 */
export interface DiscordNotificationPayload extends BaseNotificationPayload {
  channel: NotificationChannel.DISCORD;
  /** Webhook URL (if not using default) */
  webhookUrl?: string;
  /** Discord embeds */
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string; icon_url?: string };
    timestamp?: string;
  }>;
  /** Override username */
  username?: string;
  /** Override avatar URL */
  avatarUrl?: string;
}

/**
 * Push notification payload
 */
export interface PushNotificationPayload extends BaseNotificationPayload {
  channel: NotificationChannel.PUSH;
  /** Subscription endpoint(s) or user ID(s) */
  target: string | string[];
  /** Icon URL */
  icon?: string;
  /** Badge URL */
  badge?: string;
  /** Image URL */
  image?: string;
  /** Notification tag */
  tag?: string;
  /** URL to open on click */
  url?: string;
  /** Action buttons */
  actions?: Array<{ action: string; title: string; icon?: string }>;
  /** Require user interaction */
  requireInteraction?: boolean;
}

/**
 * SMS notification payload
 */
export interface SmsNotificationPayload extends BaseNotificationPayload {
  channel: NotificationChannel.SMS;
  /** Phone number(s) */
  phoneNumber: string | string[];
}

/**
 * Union type of all notification payloads
 */
export type NotificationPayload =
  | EmailNotificationPayload
  | TelegramNotificationPayload
  | DiscordNotificationPayload
  | PushNotificationPayload
  | SmsNotificationPayload;

/**
 * Notification queue item
 */
export interface QueueItem {
  /** Unique identifier */
  id: string;
  /** Notification payload */
  payload: NotificationPayload;
  /** Priority level */
  priority: NotificationPriority;
  /** Current status */
  status: NotificationStatus;
  /** Number of delivery attempts */
  attempts: number;
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Scheduled delivery time (null = immediate) */
  scheduledAt?: Date | null;
  /** Last processing started timestamp */
  processingStartedAt?: Date | null;
  /** Completion timestamp */
  completedAt?: Date | null;
  /** Error message if failed */
  error?: string | null;
  /** Correlation ID for tracking related notifications */
  correlationId?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Queue item creation input
 */
export interface CreateQueueItemInput {
  /** Notification payload */
  payload: NotificationPayload;
  /** Priority level (default: NORMAL) */
  priority?: NotificationPriority;
  /** Maximum retry attempts (default: 3) */
  maxAttempts?: number;
  /** Scheduled delivery time */
  scheduledAt?: Date | null;
  /** Correlation ID */
  correlationId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Queue item update input
 */
export interface UpdateQueueItemInput {
  /** New status */
  status?: NotificationStatus;
  /** Increment attempts */
  incrementAttempts?: boolean;
  /** Error message */
  error?: string | null;
  /** Processing started timestamp */
  processingStartedAt?: Date | null;
  /** Completion timestamp */
  completedAt?: Date | null;
  /** Scheduled time (for retry scheduling) */
  scheduledAt?: Date | null;
}

/**
 * Queue filter options
 */
export interface QueueFilterOptions {
  /** Filter by status(es) */
  status?: NotificationStatus | NotificationStatus[];
  /** Filter by channel(s) */
  channel?: NotificationChannel | NotificationChannel[];
  /** Filter by priority(ies) */
  priority?: NotificationPriority | NotificationPriority[];
  /** Filter by correlation ID */
  correlationId?: string;
  /** Items created after this date */
  createdAfter?: Date;
  /** Items created before this date */
  createdBefore?: Date;
  /** Items scheduled before this time */
  scheduledBefore?: Date;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total items in queue */
  total: number;
  /** Items by status */
  byStatus: Record<NotificationStatus, number>;
  /** Items by channel */
  byChannel: Record<NotificationChannel, number>;
  /** Items by priority */
  byPriority: Record<NotificationPriority, number>;
  /** Average processing time (ms) */
  avgProcessingTime: number;
  /** Success rate (percentage) */
  successRate: number;
  /** Current queue depth (pending + processing) */
  queueDepth: number;
  /** Items processed in last hour */
  processedLastHour: number;
  /** Timestamp of statistics */
  timestamp: Date;
}

/**
 * Queue processor configuration
 */
export interface QueueProcessorConfig {
  /** Maximum concurrent processing */
  concurrency?: number;
  /** Polling interval in milliseconds */
  pollInterval?: number;
  /** Batch size for fetching items */
  batchSize?: number;
  /** Processing timeout per item (ms) */
  processingTimeout?: number;
  /** Retry delay in milliseconds (or function for backoff) */
  retryDelay?: number | ((attempt: number) => number);
  /** Maximum items per minute per channel */
  rateLimitPerChannel?: Partial<Record<NotificationChannel, number>>;
  /** Whether to process high priority items first */
  priorityProcessing?: boolean;
  /** Dead letter queue enabled */
  deadLetterEnabled?: boolean;
  /** Maximum time in queue before expiring (ms) */
  maxQueueAge?: number;
}

/**
 * Queue event types
 */
export type QueueEventType =
  | "queue:item_added"
  | "queue:item_processing"
  | "queue:item_sent"
  | "queue:item_failed"
  | "queue:item_retrying"
  | "queue:item_dead_letter"
  | "queue:item_expired"
  | "queue:processor_started"
  | "queue:processor_stopped"
  | "queue:processor_paused"
  | "queue:processor_resumed"
  | "queue:depth_warning"
  | "queue:depth_critical"
  | "queue:rate_limited"
  | "queue:error";

/**
 * Queue event data
 */
export interface QueueEvent {
  /** Event type */
  type: QueueEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Queue item ID if applicable */
  itemId?: string;
  /** Channel if applicable */
  channel?: NotificationChannel;
  /** Error message if applicable */
  error?: string;
  /** Current queue depth */
  queueDepth?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Queue event handler
 */
export type QueueEventHandler = (event: QueueEvent) => void | Promise<void>;

/**
 * Channel send result
 */
export interface ChannelSendResult {
  /** Whether send was successful */
  success: boolean;
  /** Channel identifier */
  channel: NotificationChannel;
  /** External message/result ID */
  externalId?: string;
  /** Error message if failed */
  error?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Processing duration (ms) */
  duration?: number;
  /** Whether to retry */
  shouldRetry?: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Channel send handler interface
 * Each channel implements this to process notifications
 */
export interface ChannelHandler {
  /** Channel type */
  channel: NotificationChannel;
  /** Send a notification */
  send(payload: NotificationPayload): Promise<ChannelSendResult>;
  /** Check if handler is available/configured */
  isAvailable(): boolean;
  /** Get handler status */
  getStatus(): "available" | "unavailable" | "rate_limited";
}

/**
 * Queue storage interface
 * Implement for different storage backends (in-memory, Redis, database)
 */
export interface QueueStorage {
  /** Add item to queue */
  add(item: QueueItem): Promise<void>;
  /** Get item by ID */
  get(id: string): Promise<QueueItem | null>;
  /** Update item */
  update(id: string, updates: UpdateQueueItemInput): Promise<QueueItem | null>;
  /** Remove item */
  remove(id: string): Promise<boolean>;
  /** Get items matching filter */
  find(filter: QueueFilterOptions): Promise<QueueItem[]>;
  /** Get count of items matching filter */
  count(filter: QueueFilterOptions): Promise<number>;
  /** Get next items ready for processing */
  getReadyForProcessing(limit: number): Promise<QueueItem[]>;
  /** Mark item as processing (atomic operation) */
  markProcessing(id: string): Promise<boolean>;
  /** Get queue statistics */
  getStats(): Promise<QueueStats>;
  /** Clear items matching filter */
  clear(filter?: QueueFilterOptions): Promise<number>;
  /** Get dead letter items */
  getDeadLetter(limit?: number): Promise<QueueItem[]>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique queue item ID
 */
export function generateQueueItemId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `notif_${timestamp}_${random}`;
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (1-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000
): number {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Check if an item should be retried
 */
export function shouldRetry(item: QueueItem): boolean {
  return (
    item.status === NotificationStatus.FAILED &&
    item.attempts < item.maxAttempts
  );
}

/**
 * Check if an item should go to dead letter queue
 */
export function shouldDeadLetter(item: QueueItem): boolean {
  return (
    item.status === NotificationStatus.FAILED &&
    item.attempts >= item.maxAttempts
  );
}

/**
 * Check if an item is ready for processing
 */
export function isReadyForProcessing(item: QueueItem): boolean {
  if (item.status !== NotificationStatus.PENDING) {
    return false;
  }
  if (item.scheduledAt && item.scheduledAt > new Date()) {
    return false;
  }
  return true;
}

/**
 * Get channel from notification payload
 */
export function getChannelFromPayload(payload: NotificationPayload): NotificationChannel {
  return payload.channel;
}

/**
 * Create a queue item from input
 */
export function createQueueItem(input: CreateQueueItemInput): QueueItem {
  const now = new Date();
  return {
    id: generateQueueItemId(),
    payload: input.payload,
    priority: input.priority ?? NotificationPriority.NORMAL,
    status: NotificationStatus.PENDING,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    updatedAt: now,
    scheduledAt: input.scheduledAt ?? null,
    processingStartedAt: null,
    completedAt: null,
    error: null,
    correlationId: input.correlationId,
    context: input.context,
  };
}

/**
 * Format queue item for logging
 */
export function formatQueueItemForLog(item: QueueItem): string {
  return `[${item.id}] ${item.payload.channel} (${NotificationPriority[item.priority]}) - ${item.status} (${item.attempts}/${item.maxAttempts})`;
}

/**
 * Check if queue stats indicate high load
 */
export function isQueueOverloaded(stats: QueueStats, threshold: number = 1000): boolean {
  return stats.queueDepth > threshold;
}

/**
 * Default queue processor configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueProcessorConfig = {
  concurrency: 5,
  pollInterval: 1000,
  batchSize: 10,
  processingTimeout: 30000,
  retryDelay: (attempt: number) => calculateBackoff(attempt, 1000, 60000),
  priorityProcessing: true,
  deadLetterEnabled: true,
  maxQueueAge: 24 * 60 * 60 * 1000, // 24 hours
  rateLimitPerChannel: {
    [NotificationChannel.EMAIL]: 60, // 60 per minute
    [NotificationChannel.TELEGRAM]: 30, // 30 per minute
    [NotificationChannel.DISCORD]: 30, // 30 per minute
    [NotificationChannel.PUSH]: 120, // 120 per minute
    [NotificationChannel.SMS]: 10, // 10 per minute
  },
};
