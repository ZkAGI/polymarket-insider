/**
 * Core notification queue system exports
 */

// Types - Enums (values)
export {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  QueueProcessorStatus,
} from "./types";

// Types - Interfaces and type aliases
export type {
  BaseNotificationPayload,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
  NotificationPayload,
  QueueItem,
  CreateQueueItemInput,
  UpdateQueueItemInput,
  QueueFilterOptions,
  QueueStats,
  QueueProcessorConfig,
  QueueEventType,
  QueueEvent,
  QueueEventHandler,
  ChannelSendResult,
  ChannelHandler,
  QueueStorage,
} from "./types";

// Utility functions
export {
  generateQueueItemId,
  calculateBackoff,
  shouldRetry,
  shouldDeadLetter,
  isReadyForProcessing,
  getChannelFromPayload,
  createQueueItem,
  formatQueueItemForLog,
  isQueueOverloaded,
  DEFAULT_QUEUE_CONFIG,
} from "./types";

// Storage
export {
  InMemoryQueueStorage,
  getQueueStorage,
  resetQueueStorage,
  setQueueStorage,
} from "./storage";

// Processor
export {
  QueueProcessor,
  getQueueProcessor,
  resetQueueProcessor,
  setQueueProcessor,
} from "./processor";

// Queue Manager
export {
  NotificationQueue,
  getNotificationQueue,
  resetNotificationQueue,
  setNotificationQueue,
  queueNotification,
  queueEmail,
  queueTelegram,
  queueDiscord,
  queuePush,
} from "./queue";

export type { NotificationQueueConfig } from "./queue";
