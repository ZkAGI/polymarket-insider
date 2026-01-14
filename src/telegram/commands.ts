/**
 * Telegram Bot Command Handlers
 *
 * Implements command handlers for the Telegram bot including user registration.
 */

import { Context } from "grammy";
import {
  TelegramSubscriberService,
  telegramSubscriberService,
  TelegramChatType,
  type CreateSubscriberInput,
  type TelegramSubscriber,
  type AlertPreferences,
} from "../db/telegram-subscribers";

/**
 * Result of a registration attempt
 */
export interface RegistrationResult {
  success: boolean;
  isNewUser: boolean;
  wasReactivated: boolean;
  subscriber?: TelegramSubscriber;
  error?: string;
}

/**
 * Chat type mapping from Telegram API to our enum
 */
function mapChatType(chatType: string): TelegramChatType {
  switch (chatType) {
    case "private":
      return TelegramChatType.PRIVATE;
    case "group":
      return TelegramChatType.GROUP;
    case "supergroup":
      return TelegramChatType.SUPERGROUP;
    case "channel":
      return TelegramChatType.CHANNEL;
    default:
      return TelegramChatType.PRIVATE;
  }
}

/**
 * Get the display name for a chat
 */
function getDisplayName(ctx: Context): string {
  const chat = ctx.chat;
  if (!chat) return "Unknown";

  if (chat.type === "private") {
    const from = ctx.from;
    if (from?.first_name) {
      return from.last_name
        ? `${from.first_name} ${from.last_name}`
        : from.first_name;
    }
    return from?.username || "User";
  }

  // For groups and channels, use title
  if ("title" in chat && chat.title) {
    return chat.title;
  }

  return "Group";
}

/**
 * Welcome message for new users
 */
export function getWelcomeMessage(isNew: boolean, displayName: string): string {
  const greeting = isNew
    ? `Welcome to Polymarket Whale Tracker, ${displayName}! 🐋`
    : `Welcome back, ${displayName}! 🐋`;

  return `${greeting}

I track insider and whale activity on Polymarket and send you real-time alerts.

What I can do:
• 🔔 Send alerts when whales make large trades
• 🕵️ Detect potential insider trading patterns
• 📊 Track suspicious wallet activity
• 🎯 Monitor specific markets you care about

Commands:
• /start - Subscribe to alerts
• /stop - Unsubscribe from alerts
• /settings - Configure alert preferences
• /status - Check your subscription status
• /help - Show this help message

You're now subscribed to receive alerts!`;
}

/**
 * Register a user from a Telegram context
 */
export async function registerUserFromContext(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<RegistrationResult> {
  const chat = ctx.chat;
  const from = ctx.from;

  if (!chat) {
    return {
      success: false,
      isNewUser: false,
      wasReactivated: false,
      error: "No chat information available",
    };
  }

  try {
    const chatId = BigInt(chat.id);
    const chatType = mapChatType(chat.type);

    // Check if subscriber already exists
    const existingSubscriber = await subscriberService.findByChatId(chatId);

    if (existingSubscriber) {
      // User exists - check if they need reactivation
      if (!existingSubscriber.isActive || existingSubscriber.isBlocked) {
        // Reactivate the user
        const reactivated = await subscriberService.activate(chatId);

        // Update user info if available
        if (from) {
          await subscriberService.updateByChatId(chatId, {
            username: from.username || null,
            firstName: from.first_name || null,
            lastName: from.last_name || null,
            languageCode: from.language_code || null,
          });
        }

        console.log(
          `[TG-BOT] Reactivated subscriber: chatId=${chatId}, type=${chatType}`
        );

        return {
          success: true,
          isNewUser: false,
          wasReactivated: true,
          subscriber: reactivated,
        };
      }

      // User is already active - just update their info
      if (from) {
        const updated = await subscriberService.updateByChatId(chatId, {
          username: from.username || null,
          firstName: from.first_name || null,
          lastName: from.last_name || null,
          languageCode: from.language_code || null,
        });

        return {
          success: true,
          isNewUser: false,
          wasReactivated: false,
          subscriber: updated,
        };
      }

      return {
        success: true,
        isNewUser: false,
        wasReactivated: false,
        subscriber: existingSubscriber,
      };
    }

    // Create new subscriber
    const input: CreateSubscriberInput = {
      chatId,
      chatType,
      username: from?.username,
      firstName: from?.first_name,
      lastName: from?.last_name,
      languageCode: from?.language_code,
      title: "title" in chat ? chat.title : undefined,
      isActive: true,
      isAdmin: false,
      alertPreferences: {
        whaleAlerts: true,
        insiderAlerts: true,
        marketResolutionAlerts: false,
        priceMovementAlerts: false,
        minTradeValue: 10000, // Default $10,000 minimum
        watchedMarkets: [],
        watchedWallets: [],
      },
    };

    const newSubscriber = await subscriberService.create(input);

    console.log(
      `[TG-BOT] New subscriber registered: chatId=${chatId}, type=${chatType}, username=${from?.username || "N/A"}`
    );

    return {
      success: true,
      isNewUser: true,
      wasReactivated: false,
      subscriber: newSubscriber,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Registration error:`, error);

    return {
      success: false,
      isNewUser: false,
      wasReactivated: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle /start command
 *
 * Registers the user and sends a welcome message
 */
export async function handleStartCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  const displayName = getDisplayName(ctx);
  const result = await registerUserFromContext(ctx, subscriberService);

  if (!result.success) {
    await ctx.reply(
      `Sorry, there was an error setting up your account. Please try again later.\n\nError: ${result.error}`
    );
    return;
  }

  const welcomeMessage = getWelcomeMessage(result.isNewUser, displayName);
  await ctx.reply(welcomeMessage);
}

/**
 * Create the /start command handler
 *
 * Factory function that returns a handler with injected dependencies
 */
export function createStartCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleStartCommand(ctx, subscriberService);
}

/**
 * Result of a group registration or removal attempt
 */
export interface GroupMembershipResult {
  success: boolean;
  action: "registered" | "deactivated" | "reactivated" | "none";
  chatId?: bigint;
  chatTitle?: string;
  error?: string;
}

/**
 * Welcome message for groups when bot is added
 */
export function getGroupWelcomeMessage(groupTitle: string): string {
  return `Hello, ${groupTitle}! 🐋

I'm the Polymarket Whale Tracker bot. I'll send alerts about:

• 🔔 Large whale trades
• 🕵️ Potential insider trading patterns
• 📊 Suspicious wallet activity

Use /settings to configure which alerts this group receives.
Use /help for more commands.

Happy trading!`;
}

/**
 * Farewell message when bot is removed (logged, not sent)
 */
export function getGroupFarewellMessage(groupTitle: string): string {
  return `Bot was removed from group: ${groupTitle}`;
}

/**
 * Check if the status indicates the bot is a member of the chat
 */
export function isBotMember(status: string): boolean {
  return status === "member" || status === "administrator";
}

/**
 * Check if the status indicates the bot was removed from the chat
 */
export function isBotRemoved(status: string): boolean {
  return status === "left" || status === "kicked";
}

/**
 * Handle my_chat_member update for group registration/deregistration
 *
 * This is called when the bot's membership status changes in a chat.
 * - When added to a group (member/administrator): Register the group
 * - When removed from a group (left/kicked): Deactivate the group subscription
 */
export async function handleMyChatMember(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<GroupMembershipResult> {
  const update = ctx.update;

  // Ensure we have the my_chat_member update
  if (!("my_chat_member" in update) || !update.my_chat_member) {
    return {
      success: false,
      action: "none",
      error: "Not a my_chat_member update",
    };
  }

  const chatMember = update.my_chat_member;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member.status;

  // Only handle groups and supergroups
  if (chat.type !== "group" && chat.type !== "supergroup") {
    return {
      success: true,
      action: "none",
    };
  }

  const chatId = BigInt(chat.id);
  const chatTitle = chat.title || "Unknown Group";
  const chatType = mapChatType(chat.type);

  try {
    // Bot was added to the group
    if (!isBotMember(oldStatus) && isBotMember(newStatus)) {
      // Check if group already exists in database
      const existingSubscriber = await subscriberService.findByChatId(chatId);

      if (existingSubscriber) {
        // Reactivate if it was previously deactivated
        if (!existingSubscriber.isActive) {
          await subscriberService.activate(chatId);
          await subscriberService.updateByChatId(chatId, {
            title: chatTitle,
          });

          console.log(
            `[TG-BOT] Reactivated group: chatId=${chatId}, title="${chatTitle}"`
          );

          // Send welcome message
          await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle));

          return {
            success: true,
            action: "reactivated",
            chatId,
            chatTitle,
          };
        }

        // Already active, just update title
        await subscriberService.updateByChatId(chatId, {
          title: chatTitle,
        });

        return {
          success: true,
          action: "none",
          chatId,
          chatTitle,
        };
      }

      // Create new group subscription
      const input: CreateSubscriberInput = {
        chatId,
        chatType,
        title: chatTitle,
        isActive: true,
        isAdmin: false,
        alertPreferences: {
          whaleAlerts: true,
          insiderAlerts: true,
          marketResolutionAlerts: false,
          priceMovementAlerts: false,
          minTradeValue: 10000, // Default $10,000 minimum
          watchedMarkets: [],
          watchedWallets: [],
        },
      };

      await subscriberService.create(input);

      console.log(
        `[TG-BOT] New group registered: chatId=${chatId}, title="${chatTitle}", type=${chatType}`
      );

      // Send welcome message
      await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle));

      return {
        success: true,
        action: "registered",
        chatId,
        chatTitle,
      };
    }

    // Bot was removed from the group
    if (isBotMember(oldStatus) && isBotRemoved(newStatus)) {
      const existingSubscriber = await subscriberService.findByChatId(chatId);

      if (existingSubscriber && existingSubscriber.isActive) {
        await subscriberService.deactivate(chatId, "Bot was removed from group");

        console.log(
          `[TG-BOT] Group deactivated: chatId=${chatId}, title="${chatTitle}"`
        );

        return {
          success: true,
          action: "deactivated",
          chatId,
          chatTitle,
        };
      }

      return {
        success: true,
        action: "none",
        chatId,
        chatTitle,
      };
    }

    // No relevant status change
    return {
      success: true,
      action: "none",
      chatId,
      chatTitle,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Group membership error:`, error);

    return {
      success: false,
      action: "none",
      chatId,
      chatTitle,
      error: errorMessage,
    };
  }
}

/**
 * Create the my_chat_member handler
 *
 * Factory function that returns a handler with injected dependencies
 */
export function createMyChatMemberHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<GroupMembershipResult> {
  return (ctx: Context) => handleMyChatMember(ctx, subscriberService);
}

/**
 * Result of an unsubscribe attempt
 */
export interface UnsubscribeResult {
  success: boolean;
  wasAlreadyInactive: boolean;
  subscriber?: TelegramSubscriber;
  error?: string;
}

/**
 * Get the confirmation message for unsubscribe
 */
export function getUnsubscribeMessage(displayName: string): string {
  return `Goodbye, ${displayName}! 👋

You have been unsubscribed from Polymarket Whale Tracker alerts.

You will no longer receive notifications about:
• 🔔 Whale trades
• 🕵️ Insider activity patterns
• 📊 Suspicious wallet activity

To resubscribe at any time, simply send /start.

See you next time!`;
}

/**
 * Get the message when user is already unsubscribed
 */
export function getAlreadyUnsubscribedMessage(displayName: string): string {
  return `Hi ${displayName}! 👋

You're not currently subscribed to alerts.

To subscribe and start receiving whale and insider activity alerts, send /start.`;
}

/**
 * Get the message when subscriber is not found
 */
export function getNotFoundMessage(): string {
  return `You're not currently subscribed to alerts.

To subscribe and start receiving whale and insider activity alerts, send /start.`;
}

/**
 * Unsubscribe a user from alerts
 */
export async function unsubscribeUser(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<UnsubscribeResult> {
  const chat = ctx.chat;

  if (!chat) {
    return {
      success: false,
      wasAlreadyInactive: false,
      error: "No chat information available",
    };
  }

  try {
    const chatId = BigInt(chat.id);

    // Find the subscriber
    const existingSubscriber = await subscriberService.findByChatId(chatId);

    if (!existingSubscriber) {
      return {
        success: false,
        wasAlreadyInactive: false,
        error: "Subscriber not found",
      };
    }

    // Check if already inactive
    if (!existingSubscriber.isActive) {
      return {
        success: true,
        wasAlreadyInactive: true,
        subscriber: existingSubscriber,
      };
    }

    // Deactivate the subscriber
    const deactivatedSubscriber = await subscriberService.deactivate(
      chatId,
      "User sent /stop command"
    );

    console.log(
      `[TG-BOT] Subscriber unsubscribed: chatId=${chatId}, type=${existingSubscriber.chatType}`
    );

    return {
      success: true,
      wasAlreadyInactive: false,
      subscriber: deactivatedSubscriber,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Unsubscribe error:`, error);

    return {
      success: false,
      wasAlreadyInactive: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle /stop command
 *
 * Unsubscribes the user from receiving alerts
 */
export async function handleStopCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  const displayName = getDisplayName(ctx);
  const result = await unsubscribeUser(ctx, subscriberService);

  if (!result.success) {
    if (result.error === "Subscriber not found") {
      await ctx.reply(getNotFoundMessage());
      return;
    }

    await ctx.reply(
      `Sorry, there was an error processing your request. Please try again later.\n\nError: ${result.error}`
    );
    return;
  }

  if (result.wasAlreadyInactive) {
    await ctx.reply(getAlreadyUnsubscribedMessage(displayName));
    return;
  }

  await ctx.reply(getUnsubscribeMessage(displayName));
}

/**
 * Create the /stop command handler
 *
 * Factory function that returns a handler with injected dependencies
 */
export function createStopCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleStopCommand(ctx, subscriberService);
}

// =============================================================================
// /settings Command - Alert Preferences
// =============================================================================

/**
 * Minimum trade size options in USD
 */
export const MIN_TRADE_SIZE_OPTIONS = [
  { label: "$1K", value: 1000 },
  { label: "$10K", value: 10000 },
  { label: "$50K", value: 50000 },
  { label: "$100K", value: 100000 },
] as const;

/**
 * Severity level options
 */
export const SEVERITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "High+Critical", value: "high" },
  { label: "Critical only", value: "critical" },
] as const;

/**
 * Callback data prefixes for inline keyboard
 */
export const CALLBACK_PREFIX = {
  WHALE_ALERTS: "settings:whale:",
  INSIDER_ALERTS: "settings:insider:",
  MIN_TRADE_SIZE: "settings:minsize:",
  SEVERITY: "settings:severity:",
} as const;

/**
 * Result of a settings operation
 */
export interface SettingsResult {
  success: boolean;
  preferences?: AlertPreferences;
  error?: string;
}

/**
 * Result of a preference update from callback
 */
export interface PreferenceUpdateResult {
  success: boolean;
  updated: boolean;
  field?: string;
  newValue?: string | number | boolean;
  preferences?: AlertPreferences;
  error?: string;
}

/**
 * Get the current alert preferences for a chat
 */
export async function getAlertPreferences(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<SettingsResult> {
  const chat = ctx.chat;

  if (!chat) {
    return {
      success: false,
      error: "No chat information available",
    };
  }

  try {
    const chatId = BigInt(chat.id);
    const subscriber = await subscriberService.findByChatId(chatId);

    if (!subscriber) {
      return {
        success: false,
        error: "Subscriber not found. Please /start first to subscribe.",
      };
    }

    // Parse alert preferences from JSON
    const preferences = (subscriber.alertPreferences as AlertPreferences) || {
      whaleAlerts: true,
      insiderAlerts: true,
      minTradeValue: 10000,
    };

    return {
      success: true,
      preferences,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Get preferences error:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Format preference value for display
 */
export function formatPreferenceValue(
  key: string,
  value: unknown
): string {
  switch (key) {
    case "whaleAlerts":
    case "insiderAlerts":
      return value ? "ON" : "OFF";
    case "minTradeValue":
      if (typeof value === "number") {
        if (value >= 100000) return "$100K";
        if (value >= 50000) return "$50K";
        if (value >= 10000) return "$10K";
        return "$1K";
      }
      return "$10K";
    case "severity":
      if (value === "critical") return "Critical only";
      if (value === "high") return "High+Critical";
      return "All";
    default:
      return String(value);
  }
}

/**
 * Get the inline keyboard for settings
 */
export function getSettingsKeyboard(
  preferences: AlertPreferences
): InlineKeyboard {
  const whaleOn = preferences.whaleAlerts !== false;
  const insiderOn = preferences.insiderAlerts !== false;
  const minSize = preferences.minTradeValue || 10000;
  const severity = (preferences as Record<string, unknown>).severity || "all";

  return {
    inline_keyboard: [
      [
        {
          text: `Whale Alerts: ${whaleOn ? "ON ✅" : "OFF ❌"}`,
          callback_data: `${CALLBACK_PREFIX.WHALE_ALERTS}${whaleOn ? "off" : "on"}`,
        },
      ],
      [
        {
          text: `Insider Alerts: ${insiderOn ? "ON ✅" : "OFF ❌"}`,
          callback_data: `${CALLBACK_PREFIX.INSIDER_ALERTS}${insiderOn ? "off" : "on"}`,
        },
      ],
      [
        {
          text: `Min Trade Size: ${formatPreferenceValue("minTradeValue", minSize)}`,
          callback_data: `${CALLBACK_PREFIX.MIN_TRADE_SIZE}menu`,
        },
      ],
      [
        {
          text: `Severity: ${formatPreferenceValue("severity", severity)}`,
          callback_data: `${CALLBACK_PREFIX.SEVERITY}menu`,
        },
      ],
    ],
  };
}

/**
 * Inline keyboard type for Telegram
 */
interface InlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data: string;
    }>
  >;
}

/**
 * Get the min trade size selection keyboard
 */
export function getMinTradeSizeKeyboard(currentValue: number): InlineKeyboard {
  return {
    inline_keyboard: [
      MIN_TRADE_SIZE_OPTIONS.map((option) => ({
        text: `${option.label}${option.value === currentValue ? " ✓" : ""}`,
        callback_data: `${CALLBACK_PREFIX.MIN_TRADE_SIZE}${option.value}`,
      })),
      [
        {
          text: "« Back to Settings",
          callback_data: "settings:back",
        },
      ],
    ],
  };
}

/**
 * Get the severity selection keyboard
 */
export function getSeverityKeyboard(currentValue: string): InlineKeyboard {
  return {
    inline_keyboard: [
      SEVERITY_OPTIONS.map((option) => ({
        text: `${option.label}${option.value === currentValue ? " ✓" : ""}`,
        callback_data: `${CALLBACK_PREFIX.SEVERITY}${option.value}`,
      })),
      [
        {
          text: "« Back to Settings",
          callback_data: "settings:back",
        },
      ],
    ],
  };
}

/**
 * Get the settings message text
 */
export function getSettingsMessage(displayName: string): string {
  return `⚙️ Alert Settings for ${displayName}

Configure which alerts you want to receive. Tap a button to toggle or change a setting.

Current Settings:`;
}

/**
 * Handle /settings command
 *
 * Shows the current alert preferences with inline keyboard buttons
 */
export async function handleSettingsCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  const displayName = getDisplayName(ctx);
  const result = await getAlertPreferences(ctx, subscriberService);

  if (!result.success) {
    if (result.error?.includes("not found")) {
      await ctx.reply(
        `You're not currently subscribed to alerts.\n\nUse /start to subscribe and configure your alert preferences.`
      );
      return;
    }

    await ctx.reply(
      `Sorry, there was an error loading your settings. Please try again later.\n\nError: ${result.error}`
    );
    return;
  }

  const preferences = result.preferences!;
  const keyboard = getSettingsKeyboard(preferences);

  await ctx.reply(getSettingsMessage(displayName), {
    reply_markup: keyboard,
  });
}

/**
 * Parse callback data for settings updates
 */
export function parseSettingsCallback(callbackData: string): {
  type: "whale" | "insider" | "minsize" | "severity" | "back" | "unknown";
  value: string;
} {
  if (callbackData === "settings:back") {
    return { type: "back", value: "" };
  }

  if (callbackData.startsWith(CALLBACK_PREFIX.WHALE_ALERTS)) {
    return {
      type: "whale",
      value: callbackData.replace(CALLBACK_PREFIX.WHALE_ALERTS, ""),
    };
  }

  if (callbackData.startsWith(CALLBACK_PREFIX.INSIDER_ALERTS)) {
    return {
      type: "insider",
      value: callbackData.replace(CALLBACK_PREFIX.INSIDER_ALERTS, ""),
    };
  }

  if (callbackData.startsWith(CALLBACK_PREFIX.MIN_TRADE_SIZE)) {
    return {
      type: "minsize",
      value: callbackData.replace(CALLBACK_PREFIX.MIN_TRADE_SIZE, ""),
    };
  }

  if (callbackData.startsWith(CALLBACK_PREFIX.SEVERITY)) {
    return {
      type: "severity",
      value: callbackData.replace(CALLBACK_PREFIX.SEVERITY, ""),
    };
  }

  return { type: "unknown", value: "" };
}

/**
 * Update alert preferences based on callback data
 */
export async function updatePreferenceFromCallback(
  ctx: Context,
  callbackData: string,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<PreferenceUpdateResult> {
  const chat = ctx.chat;

  if (!chat) {
    return {
      success: false,
      updated: false,
      error: "No chat information available",
    };
  }

  try {
    const chatId = BigInt(chat.id);
    const subscriber = await subscriberService.findByChatId(chatId);

    if (!subscriber) {
      return {
        success: false,
        updated: false,
        error: "Subscriber not found",
      };
    }

    const currentPreferences =
      (subscriber.alertPreferences as AlertPreferences) || {};
    const parsed = parseSettingsCallback(callbackData);

    // Handle back to main settings
    if (parsed.type === "back") {
      return {
        success: true,
        updated: false,
        preferences: currentPreferences,
      };
    }

    // Handle menu selections (show submenu, don't update)
    if (parsed.value === "menu") {
      return {
        success: true,
        updated: false,
        preferences: currentPreferences,
        field: parsed.type,
      };
    }

    let updatedPreferences: AlertPreferences = { ...currentPreferences };
    let field = "";
    let newValue: string | number | boolean = "";

    switch (parsed.type) {
      case "whale":
        updatedPreferences.whaleAlerts = parsed.value === "on";
        field = "whaleAlerts";
        newValue = parsed.value === "on";
        break;

      case "insider":
        updatedPreferences.insiderAlerts = parsed.value === "on";
        field = "insiderAlerts";
        newValue = parsed.value === "on";
        break;

      case "minsize":
        const sizeValue = parseInt(parsed.value, 10);
        if (!isNaN(sizeValue) && [1000, 10000, 50000, 100000].includes(sizeValue)) {
          updatedPreferences.minTradeValue = sizeValue;
          field = "minTradeValue";
          newValue = sizeValue;
        } else {
          return {
            success: false,
            updated: false,
            error: "Invalid min trade size value",
          };
        }
        break;

      case "severity":
        if (["all", "high", "critical"].includes(parsed.value)) {
          (updatedPreferences as Record<string, unknown>).severity = parsed.value;
          field = "severity";
          newValue = parsed.value;
        } else {
          return {
            success: false,
            updated: false,
            error: "Invalid severity value",
          };
        }
        break;

      default:
        return {
          success: false,
          updated: false,
          error: "Unknown preference type",
        };
    }

    // Update in database
    await subscriberService.updateAlertPreferences(chatId, updatedPreferences);

    console.log(
      `[TG-BOT] Updated preference: chatId=${chatId}, field=${field}, value=${newValue}`
    );

    return {
      success: true,
      updated: true,
      field,
      newValue,
      preferences: updatedPreferences,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Update preference error:`, error);

    return {
      success: false,
      updated: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle callback query for settings updates
 *
 * This should be called when user taps an inline button in the settings message
 */
export async function handleSettingsCallback(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  // Get callback query from context
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery || !("data" in callbackQuery) || !callbackQuery.data) {
    return;
  }

  const callbackData: string = callbackQuery.data;

  // Parse the callback to determine action
  const parsed = parseSettingsCallback(callbackData);

  // Get current preferences first
  const prefsResult = await getAlertPreferences(ctx, subscriberService);
  if (!prefsResult.success) {
    await ctx.answerCallbackQuery({
      text: "Error loading settings",
      show_alert: true,
    });
    return;
  }

  const currentPreferences = prefsResult.preferences!;

  // Handle submenu requests
  if (parsed.value === "menu") {
    if (parsed.type === "minsize") {
      const minSize = currentPreferences.minTradeValue || 10000;
      await ctx.editMessageReplyMarkup({
        reply_markup: getMinTradeSizeKeyboard(minSize),
      });
      await ctx.answerCallbackQuery();
      return;
    }

    if (parsed.type === "severity") {
      const severity =
        ((currentPreferences as Record<string, unknown>).severity as string) || "all";
      await ctx.editMessageReplyMarkup({
        reply_markup: getSeverityKeyboard(severity),
      });
      await ctx.answerCallbackQuery();
      return;
    }
  }

  // Handle back to main settings
  if (parsed.type === "back") {
    await ctx.editMessageReplyMarkup({
      reply_markup: getSettingsKeyboard(currentPreferences),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  // Handle preference updates
  const updateResult = await updatePreferenceFromCallback(
    ctx,
    callbackData,
    subscriberService
  );

  if (!updateResult.success) {
    await ctx.answerCallbackQuery({
      text: updateResult.error || "Failed to update setting",
      show_alert: true,
    });
    return;
  }

  if (updateResult.updated && updateResult.preferences) {
    // Update the keyboard to reflect new values
    await ctx.editMessageReplyMarkup({
      reply_markup: getSettingsKeyboard(updateResult.preferences),
    });

    // Show confirmation
    const fieldDisplay = getFieldDisplayName(updateResult.field || "");
    const valueDisplay =
      typeof updateResult.newValue === "boolean"
        ? updateResult.newValue
          ? "ON"
          : "OFF"
        : formatPreferenceValue(updateResult.field || "", updateResult.newValue);

    await ctx.answerCallbackQuery({
      text: `${fieldDisplay} set to ${valueDisplay}`,
    });
  } else {
    await ctx.answerCallbackQuery();
  }
}

/**
 * Get human-readable field name
 */
export function getFieldDisplayName(field: string): string {
  switch (field) {
    case "whaleAlerts":
      return "Whale Alerts";
    case "insiderAlerts":
      return "Insider Alerts";
    case "minTradeValue":
      return "Min Trade Size";
    case "severity":
      return "Severity";
    default:
      return field;
  }
}

/**
 * Create the /settings command handler
 *
 * Factory function that returns a handler with injected dependencies
 */
export function createSettingsCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleSettingsCommand(ctx, subscriberService);
}

/**
 * Create the settings callback handler
 *
 * Factory function that returns a handler with injected dependencies
 */
export function createSettingsCallbackHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleSettingsCallback(ctx, subscriberService);
}

/**
 * Check if callback data is a settings callback
 */
export function isSettingsCallback(callbackData: string): boolean {
  return callbackData.startsWith("settings:");
}
