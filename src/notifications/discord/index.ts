/**
 * Discord notification module exports
 */

// Types
export {
  DiscordEmbedColor,
  DiscordMessageStatus,
  type DiscordWebhookConfig,
  type DiscordEmbedFooter,
  type DiscordEmbedImage,
  type DiscordEmbedThumbnail,
  type DiscordEmbedAuthor,
  type DiscordEmbedField,
  type DiscordEmbed,
  type DiscordMessage,
  type DiscordAllowedMentions,
  type DiscordSendResult,
  type DiscordRateLimitInfo,
  type DiscordEventType,
  type DiscordEvent,
  type DiscordEventHandler,
  type DiscordBatchOptions,
  type DiscordBatchResult,
  type DiscordWebhookInfo,
  // Validation functions
  isValidWebhookUrl,
  extractWebhookId,
  maskWebhookUrl,
  isValidFieldValue,
  isValidFieldName,
  isValidEmbedTitle,
  isValidEmbedDescription,
  isValidMessageContent,
  calculateEmbedCharacterCount,
  isValidEmbedTotal,
  truncateForDiscord,
  formatTimestampForEmbed,
  generateResultId,
} from "./types";

// Client
export {
  DiscordClient,
  DiscordClientError,
  getDiscordClient,
  createDiscordClient,
  resetDiscordClient,
} from "./client";
