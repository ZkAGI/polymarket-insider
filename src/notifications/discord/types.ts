/**
 * Discord notification types for the Polymarket Tracker
 * Defines interfaces and types for Discord webhook integration
 */

/**
 * Discord embed color presets (decimal values)
 */
export enum DiscordEmbedColor {
  DEFAULT = 0,
  AQUA = 1752220,
  DARK_AQUA = 1146986,
  GREEN = 5763719,
  DARK_GREEN = 2067276,
  BLUE = 3447003,
  DARK_BLUE = 2123412,
  PURPLE = 10181046,
  DARK_PURPLE = 7419530,
  LUMINOUS_VIVID_PINK = 15277667,
  DARK_VIVID_PINK = 11342935,
  GOLD = 15844367,
  DARK_GOLD = 12745742,
  ORANGE = 15105570,
  DARK_ORANGE = 11027200,
  RED = 15548997,
  DARK_RED = 10038562,
  GREY = 9807270,
  DARK_GREY = 9936031,
  DARKER_GREY = 8359053,
  LIGHT_GREY = 12370112,
  NAVY = 3426654,
  DARK_NAVY = 2899536,
  YELLOW = 16776960,
  WHITE = 16777215,
  BLACK = 0,
}

/**
 * Discord message delivery status
 */
export enum DiscordMessageStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  RATE_LIMITED = "rate_limited",
}

/**
 * Discord webhook configuration
 */
export interface DiscordWebhookConfig {
  /** Webhook URL from Discord */
  webhookUrl: string;
  /** Custom username to display for the bot (optional) */
  username?: string;
  /** Custom avatar URL for the bot (optional) */
  avatarUrl?: string;
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
  /** Whether to enable thread support */
  enableThreads?: boolean;
}

/**
 * Discord embed footer
 */
export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

/**
 * Discord embed image
 */
export interface DiscordEmbedImage {
  url: string;
  height?: number;
  width?: number;
}

/**
 * Discord embed thumbnail
 */
export interface DiscordEmbedThumbnail {
  url: string;
  height?: number;
  width?: number;
}

/**
 * Discord embed author
 */
export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

/**
 * Discord embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord embed structure
 * @see https://discord.com/developers/docs/resources/message#embed-object
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

/**
 * Discord message payload for webhook
 */
export interface DiscordMessage {
  /** Plain text content (max 2000 chars) */
  content?: string;
  /** Custom username for this message */
  username?: string;
  /** Custom avatar URL for this message */
  avatar_url?: string;
  /** Whether this is a text-to-speech message */
  tts?: boolean;
  /** Array of embeds (max 10) */
  embeds?: DiscordEmbed[];
  /** Allowed mentions configuration */
  allowed_mentions?: DiscordAllowedMentions;
  /** Thread name (for forum channels) */
  thread_name?: string;
}

/**
 * Discord allowed mentions configuration
 */
export interface DiscordAllowedMentions {
  /** Array of allowed mention types */
  parse?: ("roles" | "users" | "everyone")[];
  /** Array of role IDs to allow */
  roles?: string[];
  /** Array of user IDs to allow */
  users?: string[];
  /** Whether to mention the author of the replied message */
  replied_user?: boolean;
}

/**
 * Discord webhook send result
 */
export interface DiscordSendResult {
  /** Unique result ID (local) */
  id: string;
  /** Message status */
  status: DiscordMessageStatus;
  /** Timestamp when the message was sent */
  timestamp: Date;
  /** Webhook URL (masked) */
  webhookUrl: string;
  /** Error message if failed */
  error?: string;
  /** Rate limit retry after (seconds) */
  retryAfter?: number;
  /** Whether the message was sent via thread */
  threadId?: string;
}

/**
 * Discord API rate limit headers
 */
export interface DiscordRateLimitInfo {
  /** Total number of requests that can be made */
  limit: number;
  /** Number of remaining requests */
  remaining: number;
  /** When the rate limit resets (Unix timestamp) */
  reset: number;
  /** Time until reset in seconds */
  resetAfter: number;
  /** The bucket this rate limit belongs to */
  bucket: string;
  /** Whether this is a global rate limit */
  global: boolean;
}

/**
 * Discord event types
 */
export type DiscordEventType =
  | "message:sending"
  | "message:sent"
  | "message:failed"
  | "message:rate_limited"
  | "webhook:connected"
  | "webhook:disconnected"
  | "webhook:error";

/**
 * Discord event data
 */
export interface DiscordEvent {
  type: DiscordEventType;
  timestamp: Date;
  resultId?: string;
  webhookUrl?: string;
  error?: string;
  rateLimitInfo?: DiscordRateLimitInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Discord event handler
 */
export type DiscordEventHandler = (event: DiscordEvent) => void | Promise<void>;

/**
 * Batch message options
 */
export interface DiscordBatchOptions {
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
export interface DiscordBatchResult {
  total: number;
  sent: number;
  failed: number;
  results: DiscordSendResult[];
  errors: Array<{ index: number; error: string }>;
}

/**
 * Webhook information returned by Discord API
 */
export interface DiscordWebhookInfo {
  id: string;
  type: number;
  guild_id?: string;
  channel_id: string;
  name?: string;
  avatar?: string;
  token: string;
  application_id?: string;
  url?: string;
}

/**
 * Validate Discord webhook URL format
 * @param url - The URL to validate
 * @returns true if valid Discord webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const parsedUrl = new URL(url);

    // Discord webhook URLs must be HTTPS
    if (parsedUrl.protocol !== "https:") return false;

    // Must be discord.com or discordapp.com
    const validHosts = ["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"];
    if (!validHosts.includes(parsedUrl.hostname)) return false;

    // Path should match /api/webhooks/{webhook_id}/{webhook_token}
    const pathRegex = /^\/api\/webhooks\/\d+\/[\w-]+$/;
    return pathRegex.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

/**
 * Extract webhook ID from webhook URL
 * @param url - The webhook URL
 * @returns Webhook ID or null if invalid
 */
export function extractWebhookId(url: string): string | null {
  if (!isValidWebhookUrl(url)) return null;

  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/");
    // Path: /api/webhooks/{id}/{token}
    const idIndex = parts.indexOf("webhooks") + 1;
    return parts[idIndex] || null;
  } catch {
    return null;
  }
}

/**
 * Mask webhook URL for safe display (hides token)
 * @param url - The webhook URL
 * @returns Masked URL
 */
export function maskWebhookUrl(url: string): string {
  if (!url || typeof url !== "string") return "****";

  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/");
    // Replace token with asterisks
    const tokenIndex = parts.indexOf("webhooks") + 2;
    if (parts[tokenIndex]) {
      parts[tokenIndex] = "****";
    }
    return `${parsedUrl.origin}${parts.join("/")}`;
  } catch {
    return "****";
  }
}

/**
 * Validate embed field value length
 * @param value - The field value
 * @returns true if within Discord limits
 */
export function isValidFieldValue(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

/**
 * Validate embed field name length
 * @param name - The field name
 * @returns true if within Discord limits
 */
export function isValidFieldName(name: string): boolean {
  return typeof name === "string" && name.length > 0 && name.length <= 256;
}

/**
 * Validate embed title length
 * @param title - The embed title
 * @returns true if within Discord limits
 */
export function isValidEmbedTitle(title: string): boolean {
  return typeof title === "string" && title.length <= 256;
}

/**
 * Validate embed description length
 * @param description - The embed description
 * @returns true if within Discord limits
 */
export function isValidEmbedDescription(description: string): boolean {
  return typeof description === "string" && description.length <= 4096;
}

/**
 * Validate message content length
 * @param content - The message content
 * @returns true if within Discord limits
 */
export function isValidMessageContent(content: string): boolean {
  return typeof content === "string" && content.length <= 2000;
}

/**
 * Calculate total embed characters
 * @param embed - The embed object
 * @returns Total character count
 */
export function calculateEmbedCharacterCount(embed: DiscordEmbed): number {
  let count = 0;

  if (embed.title) count += embed.title.length;
  if (embed.description) count += embed.description.length;
  if (embed.footer?.text) count += embed.footer.text.length;
  if (embed.author?.name) count += embed.author.name.length;

  if (embed.fields) {
    for (const field of embed.fields) {
      count += field.name.length;
      count += field.value.length;
    }
  }

  return count;
}

/**
 * Validate total embed character count (max 6000)
 * @param embeds - Array of embeds
 * @returns true if within Discord limits
 */
export function isValidEmbedTotal(embeds: DiscordEmbed[]): boolean {
  let totalChars = 0;
  for (const embed of embeds) {
    totalChars += calculateEmbedCharacterCount(embed);
  }
  return totalChars <= 6000;
}

/**
 * Truncate string to fit Discord limits
 * @param str - The string to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated string
 */
export function truncateForDiscord(
  str: string,
  maxLength: number,
  suffix: string = "..."
): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Format timestamp for Discord embed
 * @param date - The date to format
 * @returns ISO 8601 formatted string
 */
export function formatTimestampForEmbed(date: Date): string {
  return date.toISOString();
}

/**
 * Generate unique result ID
 * @returns Unique ID string
 */
export function generateResultId(): string {
  return `discord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
