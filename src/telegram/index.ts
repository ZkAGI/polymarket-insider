/**
 * Telegram Bot Module
 *
 * Exports the Telegram bot client and related utilities.
 */

export {
  TelegramBotClient,
  getTelegramBot,
  createTelegramBot,
  startTelegramBot,
  stopTelegramBot,
  type BotStatus,
  type BotInitResult,
  type Bot,
  type Context,
} from "./bot";

export {
  handleStartCommand,
  createStartCommandHandler,
  registerUserFromContext,
  getWelcomeMessage,
  handleMyChatMember,
  createMyChatMemberHandler,
  getGroupWelcomeMessage,
  getGroupFarewellMessage,
  isBotMember,
  isBotRemoved,
  type RegistrationResult,
  type GroupMembershipResult,
} from "./commands";
