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
