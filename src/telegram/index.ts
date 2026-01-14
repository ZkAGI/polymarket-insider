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
  handleStopCommand,
  createStopCommandHandler,
  unsubscribeUser,
  getUnsubscribeMessage,
  getAlreadyUnsubscribedMessage,
  getNotFoundMessage,
  // Settings command exports
  handleSettingsCommand,
  createSettingsCommandHandler,
  handleSettingsCallback,
  createSettingsCallbackHandler,
  getAlertPreferences,
  updatePreferenceFromCallback,
  parseSettingsCallback,
  getSettingsKeyboard,
  getMinTradeSizeKeyboard,
  getSeverityKeyboard,
  getSettingsMessage,
  formatPreferenceValue,
  getFieldDisplayName,
  isSettingsCallback,
  MIN_TRADE_SIZE_OPTIONS,
  SEVERITY_OPTIONS,
  CALLBACK_PREFIX,
  type RegistrationResult,
  type GroupMembershipResult,
  type UnsubscribeResult,
  type SettingsResult,
  type PreferenceUpdateResult,
} from "./commands";
