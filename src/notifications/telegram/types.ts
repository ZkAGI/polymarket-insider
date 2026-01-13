/**
 * Telegram notification types for the Polymarket Tracker
 * Defines interfaces and types for Telegram bot integration
 */

/**
 * Telegram message parse modes
 */
export enum TelegramParseMode {
  HTML = "HTML",
  MARKDOWN = "Markdown",
  MARKDOWN_V2 = "MarkdownV2",
}

/**
 * Telegram message delivery status
 */
export enum TelegramMessageStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
}

/**
 * Telegram chat type
 */
export enum TelegramChatType {
  PRIVATE = "private",
  GROUP = "group",
  SUPERGROUP = "supergroup",
  CHANNEL = "channel",
}

/**
 * Telegram bot configuration
 */
export interface TelegramBotConfig {
  /** Bot token from BotFather */
  botToken: string;
  /** Default parse mode for messages */
  defaultParseMode?: TelegramParseMode;
  /** Whether to enable development mode (logs instead of sending) */
  devMode?: boolean;
  /** Rate limit (messages per second) */
  rateLimit?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Base URL for Telegram API (useful for testing) */
  baseUrl?: string;
}

/**
 * Telegram inline keyboard button
 */
export interface TelegramInlineButton {
  text: string;
  url?: string;
  callbackData?: string;
}

/**
 * Telegram inline keyboard markup
 */
export interface TelegramInlineKeyboard {
  buttons: TelegramInlineButton[][];
}

/**
 * Telegram message options
 */
export interface TelegramMessageOptions {
  /** Parse mode for the message */
  parseMode?: TelegramParseMode;
  /** Disable web page preview */
  disableWebPagePreview?: boolean;
  /** Disable notification sound */
  disableNotification?: boolean;
  /** Reply to message ID */
  replyToMessageId?: number;
  /** Inline keyboard markup */
  inlineKeyboard?: TelegramInlineKeyboard;
  /** Protect content from forwarding/saving */
  protectContent?: boolean;
}

/**
 * Telegram message to send
 */
export interface TelegramMessage {
  /** Chat ID or username to send message to */
  chatId: string | number;
  /** Message text */
  text: string;
  /** Optional message options */
  options?: TelegramMessageOptions;
}

/**
 * Telegram send result
 */
export interface TelegramSendResult {
  /** Message ID */
  messageId: number;
  /** Message status */
  status: TelegramMessageStatus;
  /** Timestamp when the message was sent */
  timestamp: Date;
  /** Chat ID */
  chatId: string | number;
  /** Error message if failed */
  error?: string;
}

/**
 * Telegram API response (generic)
 */
export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

/**
 * Telegram User object from API
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat object from API
 */
export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram Message object from API
 */
export interface TelegramApiMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
}

/**
 * Telegram Message Entity
 */
export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

/**
 * Telegram Update object from API
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramApiMessage;
  edited_message?: TelegramApiMessage;
  channel_post?: TelegramApiMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Telegram Callback Query from inline button press
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramApiMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

/**
 * Telegram bot commands
 */
export interface TelegramBotCommand {
  command: string;
  description: string;
}

/**
 * Telegram event types
 */
export type TelegramEventType =
  | "message:sending"
  | "message:sent"
  | "message:failed"
  | "message:rate_limited"
  | "bot:started"
  | "bot:stopped"
  | "command:received"
  | "callback:received";

/**
 * Telegram event data
 */
export interface TelegramEvent {
  type: TelegramEventType;
  timestamp: Date;
  messageId?: number;
  chatId?: string | number;
  text?: string;
  error?: string;
  command?: string;
  callbackData?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Telegram event handler
 */
export type TelegramEventHandler = (event: TelegramEvent) => void | Promise<void>;

/**
 * Command handler for bot commands
 */
export type TelegramCommandHandler = (
  chatId: string | number,
  args: string[],
  message: TelegramApiMessage
) => void | Promise<void>;

/**
 * Callback query handler for inline button presses
 */
export type TelegramCallbackHandler = (
  query: TelegramCallbackQuery
) => void | Promise<void>;

/**
 * Batch message options
 */
export interface TelegramBatchOptions {
  /** Maximum messages per batch */
  batchSize?: number;
  /** Delay between batches in milliseconds */
  batchDelay?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
}

/**
 * Batch message result
 */
export interface TelegramBatchResult {
  total: number;
  sent: number;
  failed: number;
  results: TelegramSendResult[];
  errors: Array<{ chatId: string | number; error: string }>;
}

/**
 * Validate Telegram bot token format
 * Token format: {bot_id}:{secret}
 */
export function isValidBotToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  // Bot tokens are in format: <bot_id>:<secret>
  // bot_id is numeric, secret is alphanumeric with hyphens/underscores
  const tokenRegex = /^\d+:[A-Za-z0-9_-]{35,}$/;
  return tokenRegex.test(token);
}

/**
 * Validate chat ID format
 * Chat IDs can be:
 * - Numeric (positive for users, negative for groups/channels)
 * - Username starting with @
 */
export function isValidChatId(chatId: string | number): boolean {
  if (chatId === null || chatId === undefined) return false;

  if (typeof chatId === "number") {
    return Number.isInteger(chatId) && chatId !== 0;
  }

  if (typeof chatId === "string") {
    // Check for username format (@username)
    if (chatId.startsWith("@")) {
      return chatId.length > 1 && /^@[A-Za-z][A-Za-z0-9_]{4,}$/.test(chatId);
    }
    // Check for numeric string
    const numericId = parseInt(chatId, 10);
    return !isNaN(numericId) && numericId !== 0;
  }

  return false;
}

/**
 * Escape special characters for MarkdownV2 parse mode
 */
export function escapeMarkdownV2(text: string): string {
  // Characters that need to be escaped in MarkdownV2
  const specialChars = [
    "_",
    "*",
    "[",
    "]",
    "(",
    ")",
    "~",
    "`",
    ">",
    "#",
    "+",
    "-",
    "=",
    "|",
    "{",
    "}",
    ".",
    "!",
  ];
  let escaped = text;
  for (const char of specialChars) {
    escaped = escaped.split(char).join("\\" + char);
  }
  return escaped;
}

/**
 * Escape special characters for HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format chat ID for display
 */
export function formatChatId(chatId: string | number): string {
  if (typeof chatId === "string" && chatId.startsWith("@")) {
    return chatId;
  }
  return String(chatId);
}
