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
