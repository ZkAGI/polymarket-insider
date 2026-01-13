/**
 * Telegram notification module for the Polymarket Tracker
 * Re-exports all Telegram-related types, classes, and functions
 */

// Types
export {
  TelegramParseMode,
  TelegramMessageStatus,
  TelegramChatType,
  type TelegramBotConfig,
  type TelegramInlineButton,
  type TelegramInlineKeyboard,
  type TelegramMessageOptions,
  type TelegramMessage,
  type TelegramSendResult,
  type TelegramApiResponse,
  type TelegramUser,
  type TelegramChat,
  type TelegramApiMessage,
  type TelegramMessageEntity,
  type TelegramUpdate,
  type TelegramCallbackQuery,
  type TelegramBotCommand,
  type TelegramEventType,
  type TelegramEvent,
  type TelegramEventHandler,
  type TelegramCommandHandler,
  type TelegramCallbackHandler,
  type TelegramBatchOptions,
  type TelegramBatchResult,
  isValidBotToken,
  isValidChatId,
  escapeMarkdownV2,
  escapeHtml,
  formatChatId,
} from "./types";

// Client
export {
  TelegramClient,
  TelegramClientError,
  getTelegramClient,
  createTelegramClient,
  resetTelegramClient,
} from "./client";

// Alert Formatter
export {
  type AlertSeverity,
  type AlertType,
  type TelegramAlertData,
  type TelegramAlertOptions,
  type FormattedTelegramAlert,
  type AlertTypeConfig,
  type SeverityConfig,
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  formatAlertMessageHtml,
  formatAlertMessagePlain,
  createAlertButtons,
  formatTelegramAlert,
  createAlertMessage,
  formatAlertSummary,
  createAlertSummaryMessage,
  getSeverityEmoji,
  getAlertTypeEmoji,
  getAlertTypeLabel,
  validateAlertData,
} from "./alert-formatter";

// Notification Service
export {
  type NotificationPriority,
  type NotificationRecipient,
  type NotificationDeliveryResult,
  type BatchNotificationResult,
  type NotificationServiceConfig,
  type NotificationServiceEventType,
  type NotificationServiceEvent,
  type NotificationServiceEventHandler,
  TelegramNotificationService,
  getNotificationService,
  createNotificationService,
  resetNotificationService,
  sendInstantAlert,
  sendInstantAlertToMany,
} from "./notification-service";
