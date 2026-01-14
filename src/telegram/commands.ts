// /**
//  * Telegram Bot Command Handlers
//  *
//  * Implements command handlers for the Telegram bot including user registration.
//  */

// import { Context } from "grammy";
// import {
//   TelegramSubscriberService,
//   telegramSubscriberService,
//   TelegramChatType,
//   type CreateSubscriberInput,
//   type TelegramSubscriber,
//   type AlertPreferences,
// } from "../db/telegram-subscribers";
// import { env } from "../../config/env";

// /**
//  * Result of a registration attempt
//  */
// export interface RegistrationResult {
//   success: boolean;
//   isNewUser: boolean;
//   wasReactivated: boolean;
//   subscriber?: TelegramSubscriber;
//   error?: string;
// }

// /**
//  * Chat type mapping from Telegram API to our enum
//  */
// function mapChatType(chatType: string): TelegramChatType {
//   switch (chatType) {
//     case "private":
//       return TelegramChatType.PRIVATE;
//     case "group":
//       return TelegramChatType.GROUP;
//     case "supergroup":
//       return TelegramChatType.SUPERGROUP;
//     case "channel":
//       return TelegramChatType.CHANNEL;
//     default:
//       return TelegramChatType.PRIVATE;
//   }
// }

// /**
//  * Get the display name for a chat
//  */
// function getDisplayName(ctx: Context): string {
//   const chat = ctx.chat;
//   if (!chat) return "Unknown";

//   if (chat.type === "private") {
//     const from = ctx.from;
//     if (from?.first_name) {
//       return from.last_name
//         ? `${from.first_name} ${from.last_name}`
//         : from.first_name;
//     }
//     return from?.username || "User";
//   }

//   // For groups and channels, use title
//   if ("title" in chat && chat.title) {
//     return chat.title;
//   }

//   return "Group";
// }

// /**
//  * Welcome message for new users
//  */
// export function getWelcomeMessage(isNew: boolean, displayName: string): string {
//   const greeting = isNew
//     ? `Welcome to Polymarket Whale Tracker, ${displayName}! 🐋`
//     : `Welcome back, ${displayName}! 🐋`;

//   return `${greeting}

// I track insider and whale activity on Polymarket and send you real-time alerts.

// What I can do:
// • 🔔 Send alerts when whales make large trades
// • 🕵️ Detect potential insider trading patterns
// • 📊 Track suspicious wallet activity
// • 🎯 Monitor specific markets you care about

// Commands:
// • /start - Subscribe to alerts
// • /stop - Unsubscribe from alerts
// • /settings - Configure alert preferences
// • /status - Check your subscription status
// • /help - Show this help message

// You're now subscribed to receive alerts!`;
// }

// /**
//  * Register a user from a Telegram context
//  */
// export async function registerUserFromContext(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<RegistrationResult> {
//   const chat = ctx.chat;
//   const from = ctx.from;

//   if (!chat) {
//     return {
//       success: false,
//       isNewUser: false,
//       wasReactivated: false,
//       error: "No chat information available",
//     };
//   }

//   try {
//     const chatId = BigInt(chat.id);
//     const chatType = mapChatType(chat.type);

//     // Check if subscriber already exists
//     const existingSubscriber = await subscriberService.findByChatId(chatId);

//     if (existingSubscriber) {
//       // User exists - check if they need reactivation
//       if (!existingSubscriber.isActive || existingSubscriber.isBlocked) {
//         // Reactivate the user
//         const reactivated = await subscriberService.activate(chatId);

//         // Update user info if available
//         if (from) {
//           await subscriberService.updateByChatId(chatId, {
//             username: from.username || null,
//             firstName: from.first_name || null,
//             lastName: from.last_name || null,
//             languageCode: from.language_code || null,
//           });
//         }

//         console.log(
//           `[TG-BOT] Reactivated subscriber: chatId=${chatId}, type=${chatType}`
//         );

//         return {
//           success: true,
//           isNewUser: false,
//           wasReactivated: true,
//           subscriber: reactivated,
//         };
//       }

//       // User is already active - just update their info
//       if (from) {
//         const updated = await subscriberService.updateByChatId(chatId, {
//           username: from.username || null,
//           firstName: from.first_name || null,
//           lastName: from.last_name || null,
//           languageCode: from.language_code || null,
//         });

//         return {
//           success: true,
//           isNewUser: false,
//           wasReactivated: false,
//           subscriber: updated,
//         };
//       }

//       return {
//         success: true,
//         isNewUser: false,
//         wasReactivated: false,
//         subscriber: existingSubscriber,
//       };
//     }

//     // Create new subscriber
//     const input: CreateSubscriberInput = {
//       chatId,
//       chatType,
//       username: from?.username,
//       firstName: from?.first_name,
//       lastName: from?.last_name,
//       languageCode: from?.language_code,
//       title: "title" in chat ? chat.title : undefined,
//       isActive: true,
//       isAdmin: false,
//       alertPreferences: {
//         whaleAlerts: true,
//         insiderAlerts: true,
//         marketResolutionAlerts: false,
//         priceMovementAlerts: false,
//         minTradeValue: 10000, // Default $10,000 minimum
//         watchedMarkets: [],
//         watchedWallets: [],
//       },
//     };

//     const newSubscriber = await subscriberService.create(input);

//     console.log(
//       `[TG-BOT] New subscriber registered: chatId=${chatId}, type=${chatType}, username=${from?.username || "N/A"}`
//     );

//     return {
//       success: true,
//       isNewUser: true,
//       wasReactivated: false,
//       subscriber: newSubscriber,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Registration error:`, error);

//     return {
//       success: false,
//       isNewUser: false,
//       wasReactivated: false,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Handle /start command
//  *
//  * Registers the user and sends a welcome message
//  */
// export async function handleStartCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   const displayName = getDisplayName(ctx);
//   const result = await registerUserFromContext(ctx, subscriberService);

//   if (!result.success) {
//     await ctx.reply(
//       `Sorry, there was an error setting up your account. Please try again later.\n\nError: ${result.error}`
//     );
//     return;
//   }

//   const welcomeMessage = getWelcomeMessage(result.isNewUser, displayName);
//   await ctx.reply(welcomeMessage);
// }

// /**
//  * Create the /start command handler
//  *
//  * Factory function that returns a handler with injected dependencies
//  */
// export function createStartCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleStartCommand(ctx, subscriberService);
// }

// /**
//  * Result of a group registration or removal attempt
//  */
// export interface GroupMembershipResult {
//   success: boolean;
//   action: "registered" | "deactivated" | "reactivated" | "none";
//   chatId?: bigint;
//   chatTitle?: string;
//   error?: string;
// }

// /**
//  * Welcome message for groups when bot is added
//  */
// export function getGroupWelcomeMessage(groupTitle: string): string {
//   return `Hello, ${groupTitle}! 🐋

// I'm the Polymarket Whale Tracker bot. I'll send alerts about:

// • 🔔 Large whale trades
// • 🕵️ Potential insider trading patterns
// • 📊 Suspicious wallet activity

// Use /settings to configure which alerts this group receives.
// Use /help for more commands.

// Happy trading!`;
// }

// /**
//  * Farewell message when bot is removed (logged, not sent)
//  */
// export function getGroupFarewellMessage(groupTitle: string): string {
//   return `Bot was removed from group: ${groupTitle}`;
// }

// /**
//  * Check if the status indicates the bot is a member of the chat
//  */
// export function isBotMember(status: string): boolean {
//   return status === "member" || status === "administrator";
// }

// /**
//  * Check if the status indicates the bot was removed from the chat
//  */
// export function isBotRemoved(status: string): boolean {
//   return status === "left" || status === "kicked";
// }

// /**
//  * Handle my_chat_member update for group registration/deregistration
//  *
//  * This is called when the bot's membership status changes in a chat.
//  * - When added to a group (member/administrator): Register the group
//  * - When removed from a group (left/kicked): Deactivate the group subscription
//  */
// export async function handleMyChatMember(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<GroupMembershipResult> {
//   const update = ctx.update;

//   // Ensure we have the my_chat_member update
//   if (!("my_chat_member" in update) || !update.my_chat_member) {
//     return {
//       success: false,
//       action: "none",
//       error: "Not a my_chat_member update",
//     };
//   }

//   const chatMember = update.my_chat_member;
//   const chat = chatMember.chat;
//   const newStatus = chatMember.new_chat_member.status;
//   const oldStatus = chatMember.old_chat_member.status;

//   // Only handle groups and supergroups
//   if (chat.type !== "group" && chat.type !== "supergroup") {
//     return {
//       success: true,
//       action: "none",
//     };
//   }

//   const chatId = BigInt(chat.id);
//   const chatTitle = chat.title || "Unknown Group";
//   const chatType = mapChatType(chat.type);

//   try {
//     // Bot was added to the group
//     if (!isBotMember(oldStatus) && isBotMember(newStatus)) {
//       // Check if group already exists in database
//       const existingSubscriber = await subscriberService.findByChatId(chatId);

//       if (existingSubscriber) {
//         // Reactivate if it was previously deactivated
//         if (!existingSubscriber.isActive) {
//           await subscriberService.activate(chatId);
//           await subscriberService.updateByChatId(chatId, {
//             title: chatTitle,
//           });

//           console.log(
//             `[TG-BOT] Reactivated group: chatId=${chatId}, title="${chatTitle}"`
//           );

//           // Send welcome message
//           await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle));

//           return {
//             success: true,
//             action: "reactivated",
//             chatId,
//             chatTitle,
//           };
//         }

//         // Already active, just update title
//         await subscriberService.updateByChatId(chatId, {
//           title: chatTitle,
//         });

//         return {
//           success: true,
//           action: "none",
//           chatId,
//           chatTitle,
//         };
//       }

//       // Create new group subscription
//       const input: CreateSubscriberInput = {
//         chatId,
//         chatType,
//         title: chatTitle,
//         isActive: true,
//         isAdmin: false,
//         alertPreferences: {
//           whaleAlerts: true,
//           insiderAlerts: true,
//           marketResolutionAlerts: false,
//           priceMovementAlerts: false,
//           minTradeValue: 10000, // Default $10,000 minimum
//           watchedMarkets: [],
//           watchedWallets: [],
//         },
//       };

//       await subscriberService.create(input);

//       console.log(
//         `[TG-BOT] New group registered: chatId=${chatId}, title="${chatTitle}", type=${chatType}`
//       );

//       // Send welcome message
//       await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle));

//       return {
//         success: true,
//         action: "registered",
//         chatId,
//         chatTitle,
//       };
//     }

//     // Bot was removed from the group
//     if (isBotMember(oldStatus) && isBotRemoved(newStatus)) {
//       const existingSubscriber = await subscriberService.findByChatId(chatId);

//       if (existingSubscriber && existingSubscriber.isActive) {
//         await subscriberService.deactivate(chatId, "Bot was removed from group");

//         console.log(
//           `[TG-BOT] Group deactivated: chatId=${chatId}, title="${chatTitle}"`
//         );

//         return {
//           success: true,
//           action: "deactivated",
//           chatId,
//           chatTitle,
//         };
//       }

//       return {
//         success: true,
//         action: "none",
//         chatId,
//         chatTitle,
//       };
//     }

//     // No relevant status change
//     return {
//       success: true,
//       action: "none",
//       chatId,
//       chatTitle,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Group membership error:`, error);

//     return {
//       success: false,
//       action: "none",
//       chatId,
//       chatTitle,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Create the my_chat_member handler
//  *
//  * Factory function that returns a handler with injected dependencies
//  */
// export function createMyChatMemberHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<GroupMembershipResult> {
//   return (ctx: Context) => handleMyChatMember(ctx, subscriberService);
// }

// /**
//  * Result of an unsubscribe attempt
//  */
// export interface UnsubscribeResult {
//   success: boolean;
//   wasAlreadyInactive: boolean;
//   subscriber?: TelegramSubscriber;
//   error?: string;
// }

// /**
//  * Get the confirmation message for unsubscribe
//  */
// export function getUnsubscribeMessage(displayName: string): string {
//   return `Goodbye, ${displayName}! 👋

// You have been unsubscribed from Polymarket Whale Tracker alerts.

// You will no longer receive notifications about:
// • 🔔 Whale trades
// • 🕵️ Insider activity patterns
// • 📊 Suspicious wallet activity

// To resubscribe at any time, simply send /start.

// See you next time!`;
// }

// /**
//  * Get the message when user is already unsubscribed
//  */
// export function getAlreadyUnsubscribedMessage(displayName: string): string {
//   return `Hi ${displayName}! 👋

// You're not currently subscribed to alerts.

// To subscribe and start receiving whale and insider activity alerts, send /start.`;
// }

// /**
//  * Get the message when subscriber is not found
//  */
// export function getNotFoundMessage(): string {
//   return `You're not currently subscribed to alerts.

// To subscribe and start receiving whale and insider activity alerts, send /start.`;
// }

// /**
//  * Unsubscribe a user from alerts
//  */
// export async function unsubscribeUser(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<UnsubscribeResult> {
//   const chat = ctx.chat;

//   if (!chat) {
//     return {
//       success: false,
//       wasAlreadyInactive: false,
//       error: "No chat information available",
//     };
//   }

//   try {
//     const chatId = BigInt(chat.id);

//     // Find the subscriber
//     const existingSubscriber = await subscriberService.findByChatId(chatId);

//     if (!existingSubscriber) {
//       return {
//         success: false,
//         wasAlreadyInactive: false,
//         error: "Subscriber not found",
//       };
//     }

//     // Check if already inactive
//     if (!existingSubscriber.isActive) {
//       return {
//         success: true,
//         wasAlreadyInactive: true,
//         subscriber: existingSubscriber,
//       };
//     }

//     // Deactivate the subscriber
//     const deactivatedSubscriber = await subscriberService.deactivate(
//       chatId,
//       "User sent /stop command"
//     );

//     console.log(
//       `[TG-BOT] Subscriber unsubscribed: chatId=${chatId}, type=${existingSubscriber.chatType}`
//     );

//     return {
//       success: true,
//       wasAlreadyInactive: false,
//       subscriber: deactivatedSubscriber,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Unsubscribe error:`, error);

//     return {
//       success: false,
//       wasAlreadyInactive: false,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Handle /stop command
//  *
//  * Unsubscribes the user from receiving alerts
//  */
// export async function handleStopCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   const displayName = getDisplayName(ctx);
//   const result = await unsubscribeUser(ctx, subscriberService);

//   if (!result.success) {
//     if (result.error === "Subscriber not found") {
//       await ctx.reply(getNotFoundMessage());
//       return;
//     }

//     await ctx.reply(
//       `Sorry, there was an error processing your request. Please try again later.\n\nError: ${result.error}`
//     );
//     return;
//   }

//   if (result.wasAlreadyInactive) {
//     await ctx.reply(getAlreadyUnsubscribedMessage(displayName));
//     return;
//   }

//   await ctx.reply(getUnsubscribeMessage(displayName));
// }

// /**
//  * Create the /stop command handler
//  *
//  * Factory function that returns a handler with injected dependencies
//  */
// export function createStopCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleStopCommand(ctx, subscriberService);
// }

// // =============================================================================
// // /settings Command - Alert Preferences
// // =============================================================================

// /**
//  * Minimum trade size options in USD
//  */
// export const MIN_TRADE_SIZE_OPTIONS = [
//   { label: "$1K", value: 1000 },
//   { label: "$10K", value: 10000 },
//   { label: "$50K", value: 50000 },
//   { label: "$100K", value: 100000 },
// ] as const;

// /**
//  * Severity level options
//  */
// export const SEVERITY_OPTIONS = [
//   { label: "All", value: "all" },
//   { label: "High+Critical", value: "high" },
//   { label: "Critical only", value: "critical" },
// ] as const;

// /**
//  * Callback data prefixes for inline keyboard
//  */
// export const CALLBACK_PREFIX = {
//   WHALE_ALERTS: "settings:whale:",
//   INSIDER_ALERTS: "settings:insider:",
//   MIN_TRADE_SIZE: "settings:minsize:",
//   SEVERITY: "settings:severity:",
// } as const;

// /**
//  * Result of a settings operation
//  */
// export interface SettingsResult {
//   success: boolean;
//   preferences?: AlertPreferences;
//   error?: string;
// }

// /**
//  * Result of a preference update from callback
//  */
// export interface PreferenceUpdateResult {
//   success: boolean;
//   updated: boolean;
//   field?: string;
//   newValue?: string | number | boolean;
//   preferences?: AlertPreferences;
//   error?: string;
// }

// /**
//  * Get the current alert preferences for a chat
//  */
// export async function getAlertPreferences(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<SettingsResult> {
//   const chat = ctx.chat;

//   if (!chat) {
//     return {
//       success: false,
//       error: "No chat information available",
//     };
//   }

//   try {
//     const chatId = BigInt(chat.id);
//     const subscriber = await subscriberService.findByChatId(chatId);

//     if (!subscriber) {
//       return {
//         success: false,
//         error: "Subscriber not found. Please /start first to subscribe.",
//       };
//     }

//     // Parse alert preferences from JSON
//     const preferences = (subscriber.alertPreferences as AlertPreferences) || {
//       whaleAlerts: true,
//       insiderAlerts: true,
//       minTradeValue: 10000,
//     };

//     return {
//       success: true,
//       preferences,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Get preferences error:`, error);

//     return {
//       success: false,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Format preference value for display
//  */
// export function formatPreferenceValue(
//   key: string,
//   value: unknown
// ): string {
//   switch (key) {
//     case "whaleAlerts":
//     case "insiderAlerts":
//       return value ? "ON" : "OFF";
//     case "minTradeValue":
//       if (typeof value === "number") {
//         if (value >= 100000) return "$100K";
//         if (value >= 50000) return "$50K";
//         if (value >= 10000) return "$10K";
//         return "$1K";
//       }
//       return "$10K";
//     case "severity":
//       if (value === "critical") return "Critical only";
//       if (value === "high") return "High+Critical";
//       return "All";
//     default:
//       return String(value);
//   }
// }

// /**
//  * Get the inline keyboard for settings
//  */
// export function getSettingsKeyboard(
//   preferences: AlertPreferences
// ): InlineKeyboard {
//   const whaleOn = preferences.whaleAlerts !== false;
//   const insiderOn = preferences.insiderAlerts !== false;
//   const minSize = preferences.minTradeValue || 10000;
//   const severity = (preferences as Record<string, unknown>).severity || "all";

//   return {
//     inline_keyboard: [
//       [
//         {
//           text: `Whale Alerts: ${whaleOn ? "ON ✅" : "OFF ❌"}`,
//           callback_data: `${CALLBACK_PREFIX.WHALE_ALERTS}${whaleOn ? "off" : "on"}`,
//         },
//       ],
//       [
//         {
//           text: `Insider Alerts: ${insiderOn ? "ON ✅" : "OFF ❌"}`,
//           callback_data: `${CALLBACK_PREFIX.INSIDER_ALERTS}${insiderOn ? "off" : "on"}`,
//         },
//       ],
//       [
//         {
//           text: `Min Trade Size: ${formatPreferenceValue("minTradeValue", minSize)}`,
//           callback_data: `${CALLBACK_PREFIX.MIN_TRADE_SIZE}menu`,
//         },
//       ],
//       [
//         {
//           text: `Severity: ${formatPreferenceValue("severity", severity)}`,
//           callback_data: `${CALLBACK_PREFIX.SEVERITY}menu`,
//         },
//       ],
//     ],
//   };
// }

// /**
//  * Inline keyboard type for Telegram
//  */
// interface InlineKeyboard {
//   inline_keyboard: Array<
//     Array<{
//       text: string;
//       callback_data: string;
//     }>
//   >;
// }

// /**
//  * Get the min trade size selection keyboard
//  */
// export function getMinTradeSizeKeyboard(currentValue: number): InlineKeyboard {
//   return {
//     inline_keyboard: [
//       MIN_TRADE_SIZE_OPTIONS.map((option) => ({
//         text: `${option.label}${option.value === currentValue ? " ✓" : ""}`,
//         callback_data: `${CALLBACK_PREFIX.MIN_TRADE_SIZE}${option.value}`,
//       })),
//       [
//         {
//           text: "« Back to Settings",
//           callback_data: "settings:back",
//         },
//       ],
//     ],
//   };
// }

// /**
//  * Get the severity selection keyboard
//  */
// export function getSeverityKeyboard(currentValue: string): InlineKeyboard {
//   return {
//     inline_keyboard: [
//       SEVERITY_OPTIONS.map((option) => ({
//         text: `${option.label}${option.value === currentValue ? " ✓" : ""}`,
//         callback_data: `${CALLBACK_PREFIX.SEVERITY}${option.value}`,
//       })),
//       [
//         {
//           text: "« Back to Settings",
//           callback_data: "settings:back",
//         },
//       ],
//     ],
//   };
// }

// /**
//  * Get the settings message text
//  */
// export function getSettingsMessage(displayName: string): string {
//   return `⚙️ Alert Settings for ${displayName}

// Configure which alerts you want to receive. Tap a button to toggle or change a setting.

// Current Settings:`;
// }

// /**
//  * Handle /settings command
//  *
//  * Shows the current alert preferences with inline keyboard buttons
//  */
// export async function handleSettingsCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   const displayName = getDisplayName(ctx);
//   const result = await getAlertPreferences(ctx, subscriberService);

//   if (!result.success) {
//     if (result.error?.includes("not found")) {
//       await ctx.reply(
//         `You're not currently subscribed to alerts.\n\nUse /start to subscribe and configure your alert preferences.`
//       );
//       return;
//     }

//     await ctx.reply(
//       `Sorry, there was an error loading your settings. Please try again later.\n\nError: ${result.error}`
//     );
//     return;
//   }

//   const preferences = result.preferences!;
//   const keyboard = getSettingsKeyboard(preferences);

//   await ctx.reply(getSettingsMessage(displayName), {
//     reply_markup: keyboard,
//   });
// }

// /**
//  * Parse callback data for settings updates
//  */
// export function parseSettingsCallback(callbackData: string): {
//   type: "whale" | "insider" | "minsize" | "severity" | "back" | "unknown";
//   value: string;
// } {
//   if (callbackData === "settings:back") {
//     return { type: "back", value: "" };
//   }

//   if (callbackData.startsWith(CALLBACK_PREFIX.WHALE_ALERTS)) {
//     return {
//       type: "whale",
//       value: callbackData.replace(CALLBACK_PREFIX.WHALE_ALERTS, ""),
//     };
//   }

//   if (callbackData.startsWith(CALLBACK_PREFIX.INSIDER_ALERTS)) {
//     return {
//       type: "insider",
//       value: callbackData.replace(CALLBACK_PREFIX.INSIDER_ALERTS, ""),
//     };
//   }

//   if (callbackData.startsWith(CALLBACK_PREFIX.MIN_TRADE_SIZE)) {
//     return {
//       type: "minsize",
//       value: callbackData.replace(CALLBACK_PREFIX.MIN_TRADE_SIZE, ""),
//     };
//   }

//   if (callbackData.startsWith(CALLBACK_PREFIX.SEVERITY)) {
//     return {
//       type: "severity",
//       value: callbackData.replace(CALLBACK_PREFIX.SEVERITY, ""),
//     };
//   }

//   return { type: "unknown", value: "" };
// }

// /**
//  * Update alert preferences based on callback data
//  */
// export async function updatePreferenceFromCallback(
//   ctx: Context,
//   callbackData: string,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<PreferenceUpdateResult> {
//   const chat = ctx.chat;

//   if (!chat) {
//     return {
//       success: false,
//       updated: false,
//       error: "No chat information available",
//     };
//   }

//   try {
//     const chatId = BigInt(chat.id);
//     const subscriber = await subscriberService.findByChatId(chatId);

//     if (!subscriber) {
//       return {
//         success: false,
//         updated: false,
//         error: "Subscriber not found",
//       };
//     }

//     const currentPreferences =
//       (subscriber.alertPreferences as AlertPreferences) || {};
//     const parsed = parseSettingsCallback(callbackData);

//     // Handle back to main settings
//     if (parsed.type === "back") {
//       return {
//         success: true,
//         updated: false,
//         preferences: currentPreferences,
//       };
//     }

//     // Handle menu selections (show submenu, don't update)
//     if (parsed.value === "menu") {
//       return {
//         success: true,
//         updated: false,
//         preferences: currentPreferences,
//         field: parsed.type,
//       };
//     }

//     let updatedPreferences: AlertPreferences = { ...currentPreferences };
//     let field = "";
//     let newValue: string | number | boolean = "";

//     switch (parsed.type) {
//       case "whale":
//         updatedPreferences.whaleAlerts = parsed.value === "on";
//         field = "whaleAlerts";
//         newValue = parsed.value === "on";
//         break;

//       case "insider":
//         updatedPreferences.insiderAlerts = parsed.value === "on";
//         field = "insiderAlerts";
//         newValue = parsed.value === "on";
//         break;

//       case "minsize":
//         const sizeValue = parseInt(parsed.value, 10);
//         if (!isNaN(sizeValue) && [1000, 10000, 50000, 100000].includes(sizeValue)) {
//           updatedPreferences.minTradeValue = sizeValue;
//           field = "minTradeValue";
//           newValue = sizeValue;
//         } else {
//           return {
//             success: false,
//             updated: false,
//             error: "Invalid min trade size value",
//           };
//         }
//         break;

//       case "severity":
//         if (["all", "high", "critical"].includes(parsed.value)) {
//           (updatedPreferences as Record<string, unknown>).severity = parsed.value;
//           field = "severity";
//           newValue = parsed.value;
//         } else {
//           return {
//             success: false,
//             updated: false,
//             error: "Invalid severity value",
//           };
//         }
//         break;

//       default:
//         return {
//           success: false,
//           updated: false,
//           error: "Unknown preference type",
//         };
//     }

//     // Update in database
//     await subscriberService.updateAlertPreferences(chatId, updatedPreferences);

//     console.log(
//       `[TG-BOT] Updated preference: chatId=${chatId}, field=${field}, value=${newValue}`
//     );

//     return {
//       success: true,
//       updated: true,
//       field,
//       newValue,
//       preferences: updatedPreferences,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Update preference error:`, error);

//     return {
//       success: false,
//       updated: false,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Handle callback query for settings updates
//  *
//  * This should be called when user taps an inline button in the settings message
//  */
// export async function handleSettingsCallback(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   // Get callback query from context
//   const callbackQuery = ctx.callbackQuery;
//   if (!callbackQuery || !("data" in callbackQuery) || !callbackQuery.data) {
//     return;
//   }

//   const callbackData: string = callbackQuery.data;

//   // Parse the callback to determine action
//   const parsed = parseSettingsCallback(callbackData);

//   // Get current preferences first
//   const prefsResult = await getAlertPreferences(ctx, subscriberService);
//   if (!prefsResult.success) {
//     await ctx.answerCallbackQuery({
//       text: "Error loading settings",
//       show_alert: true,
//     });
//     return;
//   }

//   const currentPreferences = prefsResult.preferences!;

//   // Handle submenu requests
//   if (parsed.value === "menu") {
//     if (parsed.type === "minsize") {
//       const minSize = currentPreferences.minTradeValue || 10000;
//       await ctx.editMessageReplyMarkup({
//         reply_markup: getMinTradeSizeKeyboard(minSize),
//       });
//       await ctx.answerCallbackQuery();
//       return;
//     }

//     if (parsed.type === "severity") {
//       const severity =
//         ((currentPreferences as Record<string, unknown>).severity as string) || "all";
//       await ctx.editMessageReplyMarkup({
//         reply_markup: getSeverityKeyboard(severity),
//       });
//       await ctx.answerCallbackQuery();
//       return;
//     }
//   }

//   // Handle back to main settings
//   if (parsed.type === "back") {
//     await ctx.editMessageReplyMarkup({
//       reply_markup: getSettingsKeyboard(currentPreferences),
//     });
//     await ctx.answerCallbackQuery();
//     return;
//   }

//   // Handle preference updates
//   const updateResult = await updatePreferenceFromCallback(
//     ctx,
//     callbackData,
//     subscriberService
//   );

//   if (!updateResult.success) {
//     await ctx.answerCallbackQuery({
//       text: updateResult.error || "Failed to update setting",
//       show_alert: true,
//     });
//     return;
//   }

//   if (updateResult.updated && updateResult.preferences) {
//     // Update the keyboard to reflect new values
//     await ctx.editMessageReplyMarkup({
//       reply_markup: getSettingsKeyboard(updateResult.preferences),
//     });

//     // Show confirmation
//     const fieldDisplay = getFieldDisplayName(updateResult.field || "");
//     const valueDisplay =
//       typeof updateResult.newValue === "boolean"
//         ? updateResult.newValue
//           ? "ON"
//           : "OFF"
//         : formatPreferenceValue(updateResult.field || "", updateResult.newValue);

//     await ctx.answerCallbackQuery({
//       text: `${fieldDisplay} set to ${valueDisplay}`,
//     });
//   } else {
//     await ctx.answerCallbackQuery();
//   }
// }

// /**
//  * Get human-readable field name
//  */
// export function getFieldDisplayName(field: string): string {
//   switch (field) {
//     case "whaleAlerts":
//       return "Whale Alerts";
//     case "insiderAlerts":
//       return "Insider Alerts";
//     case "minTradeValue":
//       return "Min Trade Size";
//     case "severity":
//       return "Severity";
//     default:
//       return field;
//   }
// }

// /**
//  * Create the /settings command handler
//  *
//  * Factory function that returns a handler with injected dependencies
//  */
// export function createSettingsCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleSettingsCommand(ctx, subscriberService);
// }

// /**
//  * Create the settings callback handler
//  *
//  * Factory function that returns a handler with injected dependencies
//  */
// export function createSettingsCallbackHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleSettingsCallback(ctx, subscriberService);
// }

// /**
//  * Check if callback data is a settings callback
//  */
// export function isSettingsCallback(callbackData: string): boolean {
//   return callbackData.startsWith("settings:");
// }

// // =============================================================================
// // /help Command - Show all available commands
// // =============================================================================

// /**
//  * Get the help message with all available commands
//  */
// export function getHelpMessage(): string {
//   return `🐋 *Polymarket Whale Tracker* - Help

// *Available Commands:*

// 📌 *Basic Commands:*
// /start - Subscribe to alerts
// /stop - Unsubscribe from alerts
// /status - Check your subscription status
// /settings - Configure alert preferences
// /help - Show this help message

// 📊 *What I Track:*
// • Large whale trades (configurable threshold)
// • Potential insider trading patterns
// • Suspicious wallet activity
// • Market movements and resolutions

// ⚙️ *Alert Settings:*
// Use /settings to customize:
// • Enable/disable whale alerts
// • Enable/disable insider alerts
// • Set minimum trade size ($1K-$100K)
// • Set alert severity level

// 💡 *Tips:*
// • Use /settings to reduce noise
// • Higher min trade size = fewer alerts
// • "Critical only" severity = most important alerts

// Need more help? Visit our documentation or contact support.`;
// }

// /**
//  * Handle /help command
//  *
//  * Shows all available commands and their descriptions
//  */
// export async function handleHelpCommand(ctx: Context): Promise<void> {
//   await ctx.reply(getHelpMessage(), { parse_mode: "Markdown" });
// }

// /**
//  * Create the /help command handler
//  */
// export function createHelpCommandHandler(): (ctx: Context) => Promise<void> {
//   return handleHelpCommand;
// }

// // =============================================================================
// // /status Command - Show subscription status
// // =============================================================================

// /**
//  * Result of a status check
//  */
// export interface StatusResult {
//   success: boolean;
//   isSubscribed: boolean;
//   subscriber?: TelegramSubscriber;
//   error?: string;
// }

// /**
//  * Get subscription status for a chat
//  */
// export async function getSubscriptionStatus(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<StatusResult> {
//   const chat = ctx.chat;

//   if (!chat) {
//     return {
//       success: false,
//       isSubscribed: false,
//       error: "No chat information available",
//     };
//   }

//   try {
//     const chatId = BigInt(chat.id);
//     const subscriber = await subscriberService.findByChatId(chatId);

//     if (!subscriber) {
//       return {
//         success: true,
//         isSubscribed: false,
//       };
//     }

//     return {
//       success: true,
//       isSubscribed: subscriber.isActive && !subscriber.isBlocked,
//       subscriber,
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Status check error:`, error);

//     return {
//       success: false,
//       isSubscribed: false,
//       error: errorMessage,
//     };
//   }
// }

// /**
//  * Format date for display
//  */
// export function formatDate(date: Date | null): string {
//   if (!date) return "Never";
//   return date.toLocaleDateString("en-US", {
//     year: "numeric",
//     month: "short",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// /**
//  * Get the status message for a subscriber
//  */
// export function getStatusMessage(
//   displayName: string,
//   isSubscribed: boolean,
//   subscriber?: TelegramSubscriber
// ): string {
//   if (!isSubscribed || !subscriber) {
//     return `📊 *Status for ${escapeMarkdown(displayName)}*

// 🔴 *Not Subscribed*

// You are not currently subscribed to alerts.
// Use /start to subscribe and receive whale and insider activity notifications.`;
//   }

//   const prefs = (subscriber.alertPreferences as AlertPreferences) || {};
//   const whaleStatus = prefs.whaleAlerts !== false ? "✅ ON" : "❌ OFF";
//   const insiderStatus = prefs.insiderAlerts !== false ? "✅ ON" : "❌ OFF";
//   const minTrade = formatPreferenceValue("minTradeValue", prefs.minTradeValue || 10000);
//   const severity = formatPreferenceValue(
//     "severity",
//     (prefs as Record<string, unknown>).severity || "all"
//   );

//   return `📊 *Status for ${escapeMarkdown(displayName)}*

// 🟢 *Subscribed*

// *Alert Settings:*
// • Whale Alerts: ${whaleStatus}
// • Insider Alerts: ${insiderStatus}
// • Min Trade Size: ${minTrade}
// • Severity: ${severity}

// *Statistics:*
// • Alerts Received: ${subscriber.alertsSent}
// • Last Alert: ${formatDate(subscriber.lastAlertAt)}
// • Subscribed Since: ${formatDate(subscriber.createdAt)}

// Use /settings to change your preferences.
// Use /stop to unsubscribe.`;
// }

// /**
//  * Escape special characters for Telegram Markdown
//  */
// export function escapeMarkdown(text: string): string {
//   return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
// }

// /**
//  * Handle /status command
//  *
//  * Shows the user's subscription status and statistics
//  */
// export async function handleStatusCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   const displayName = getDisplayName(ctx);
//   const result = await getSubscriptionStatus(ctx, subscriberService);

//   if (!result.success) {
//     await ctx.reply(
//       `Sorry, there was an error checking your status. Please try again later.\n\nError: ${result.error}`
//     );
//     return;
//   }

//   const message = getStatusMessage(displayName, result.isSubscribed, result.subscriber);
//   await ctx.reply(message, { parse_mode: "Markdown" });
// }

// /**
//  * Create the /status command handler
//  */
// export function createStatusCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleStatusCommand(ctx, subscriberService);
// }

// // =============================================================================
// // /stats Command (Admin Only) - Show bot statistics
// // =============================================================================

// /**
//  * Result of admin verification
//  */
// export interface AdminCheckResult {
//   isAdmin: boolean;
//   userId?: number;
//   reason?: string;
// }

// /**
//  * Check if the user is an admin (by Telegram user ID from env)
//  */
// export function checkIsAdmin(ctx: Context): AdminCheckResult {
//   const from = ctx.from;

//   if (!from) {
//     return {
//       isAdmin: false,
//       reason: "No user information available",
//     };
//   }

//   const userId = from.id;
//   const adminIds = env.TELEGRAM_ADMIN_IDS;

//   // If no admin IDs configured, no one is admin
//   if (!adminIds || adminIds.length === 0) {
//     return {
//       isAdmin: false,
//       userId,
//       reason: "No admin IDs configured",
//     };
//   }

//   const isAdmin = adminIds.includes(userId);

//   return {
//     isAdmin,
//     userId,
//     reason: isAdmin ? undefined : "User ID not in admin list",
//   };
// }

// /**
//  * Get the unauthorized message for non-admins
//  */
// export function getUnauthorizedMessage(): string {
//   return `⛔ *Access Denied*

// This command is only available to bot administrators.

// If you believe you should have admin access, please contact the bot owner.`;
// }

// /**
//  * Stats result from the service
//  */
// export interface BotStats {
//   total: number;
//   active: number;
//   blocked: number;
//   byType: {
//     PRIVATE: number;
//     GROUP: number;
//     SUPERGROUP: number;
//     CHANNEL: number;
//   };
// }

// /**
//  * Get the stats message for admins
//  */
// export function getStatsMessage(stats: BotStats, uptime: string): string {
//   const { total, active, blocked, byType } = stats;
//   const inactive = total - active - blocked;

//   return `📈 *Bot Statistics*

// *Subscribers:*
// • Total: ${total}
// • Active: ${active}
// • Inactive: ${inactive}
// • Blocked: ${blocked}

// *By Type:*
// • Private Chats: ${byType.PRIVATE}
// • Groups: ${byType.GROUP}
// • Supergroups: ${byType.SUPERGROUP}
// • Channels: ${byType.CHANNEL}

// *System:*
// • Status: 🟢 Online
// • Uptime: ${uptime}

// Use /broadcast <message> to send announcements to all subscribers.`;
// }

// /**
//  * Calculate uptime string from process start time
//  */
// export function getUptimeString(): string {
//   const uptimeSeconds = process.uptime();
//   const days = Math.floor(uptimeSeconds / 86400);
//   const hours = Math.floor((uptimeSeconds % 86400) / 3600);
//   const minutes = Math.floor((uptimeSeconds % 3600) / 60);

//   const parts: string[] = [];
//   if (days > 0) parts.push(`${days}d`);
//   if (hours > 0) parts.push(`${hours}h`);
//   if (minutes > 0) parts.push(`${minutes}m`);
//   if (parts.length === 0) parts.push("< 1m");

//   return parts.join(" ");
// }

// /**
//  * Handle /stats command (admin only)
//  *
//  * Shows bot statistics including subscriber counts and system health
//  */
// export async function handleStatsCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<void> {
//   // Check if user is admin
//   const adminCheck = checkIsAdmin(ctx);

//   if (!adminCheck.isAdmin) {
//     console.log(
//       `[TG-BOT] Unauthorized /stats attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
//     );
//     await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
//     return;
//   }

//   try {
//     const stats = await subscriberService.getStats();
//     const uptime = getUptimeString();

//     // Map the stats to the expected format
//     const formattedStats: BotStats = {
//       total: stats.total,
//       active: stats.active,
//       blocked: stats.blocked,
//       byType: {
//         PRIVATE: stats.byType.PRIVATE,
//         GROUP: stats.byType.GROUP,
//         SUPERGROUP: stats.byType.SUPERGROUP,
//         CHANNEL: stats.byType.CHANNEL,
//       },
//     };

//     const message = getStatsMessage(formattedStats, uptime);
//     await ctx.reply(message, { parse_mode: "Markdown" });

//     console.log(`[TG-BOT] Admin ${adminCheck.userId} viewed stats`);
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error occurred";
//     console.error(`[TG-BOT] Stats error:`, error);

//     await ctx.reply(
//       `Sorry, there was an error fetching statistics. Please try again later.\n\nError: ${errorMessage}`
//     );
//   }
// }

// /**
//  * Create the /stats command handler (admin only)
//  */
// export function createStatsCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleStatsCommand(ctx, subscriberService);
// }

// // =============================================================================
// // /broadcast Command (Admin Only) - Send announcements to all subscribers
// // =============================================================================

// /**
//  * Result of a broadcast operation
//  */
// export interface AdminBroadcastResult {
//   success: boolean;
//   sent: number;
//   failed: number;
//   total: number;
//   errors: Array<{ chatId: bigint; error: string }>;
//   duration: number;
// }

// /**
//  * Parse broadcast message from command text
//  * The format is: /broadcast <message>
//  */
// export function parseBroadcastMessage(text: string): string | null {
//   // Match /broadcast followed by the message
//   const match = text.match(/^\/broadcast(?:@\w+)?\s+(.+)$/s);
//   if (!match || !match[1]) {
//     return null;
//   }
//   const trimmed = match[1].trim();
//   // Return null if the message is empty after trimming
//   if (!trimmed) {
//     return null;
//   }
//   return trimmed;
// }

// /**
//  * Format the broadcast report message
//  */
// export function getBroadcastReportMessage(result: AdminBroadcastResult): string {
//   const statusEmoji = result.failed === 0 ? "✅" : "⚠️";
//   const successRate = result.total > 0
//     ? Math.round((result.sent / result.total) * 100)
//     : 0;

//   let message = `${statusEmoji} *Broadcast Complete*

// 📊 *Results:*
// • Total subscribers: ${result.total}
// • Successfully sent: ${result.sent}
// • Failed: ${result.failed}
// • Success rate: ${successRate}%
// • Duration: ${result.duration}ms`;

//   if (result.errors.length > 0 && result.errors.length <= 5) {
//     message += `

// ❌ *Errors:*`;
//     for (const err of result.errors) {
//       message += `\n• Chat ${err.chatId}: ${escapeMarkdown(err.error)}`;
//     }
//   } else if (result.errors.length > 5) {
//     message += `

// ❌ *Errors:* ${result.errors.length} failures (showing first 5)`;
//     for (const err of result.errors.slice(0, 5)) {
//       message += `\n• Chat ${err.chatId}: ${escapeMarkdown(err.error)}`;
//     }
//   }

//   return message;
// }

// /**
//  * Get message for empty broadcast
//  */
// export function getEmptyBroadcastMessage(): string {
//   return `⚠️ *Usage:* /broadcast <message>

// Send an announcement to all active subscribers.

// *Example:*
// \`/broadcast Hello! This is a test announcement.\`

// The message will be sent to all active subscribers.`;
// }

// /**
//  * Broadcast a message to all active subscribers
//  */
// export async function broadcastMessage(
//   message: string,
//   botClient: import("./bot").TelegramBotClient,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService
// ): Promise<AdminBroadcastResult> {
//   const startTime = Date.now();
//   const errors: Array<{ chatId: bigint; error: string }> = [];
//   let sent = 0;
//   let failed = 0;

//   // Get all active subscribers
//   const activeSubscribers = await subscriberService.findActive();
//   const total = activeSubscribers.length;

//   // Prepare the broadcast message
//   const broadcastText = `📢 *Announcement*

// ${message}`;

//   // Send to each subscriber with rate limiting
//   for (const subscriber of activeSubscribers) {
//     try {
//       const result = await botClient.sendMessage(
//         subscriber.chatId.toString(),
//         broadcastText,
//         {
//           parseMode: "Markdown",
//           disableWebPagePreview: true,
//         }
//       );

//       if (result.success) {
//         sent++;
//         // Increment alerts sent counter
//         await subscriberService.incrementAlertsSent(subscriber.chatId);
//       } else {
//         failed++;
//         errors.push({ chatId: subscriber.chatId, error: result.error || "Unknown error" });

//         // Check if we should deactivate the subscriber
//         const { shouldDeactivateOnError, logDeactivation } = await import("./broadcaster");
//         const deactivateCheck = shouldDeactivateOnError(result.error || "");
//         if (deactivateCheck.shouldDeactivate && deactivateCheck.reason && deactivateCheck.reasonType) {
//           logDeactivation(subscriber.chatId, deactivateCheck.reason, deactivateCheck.reasonType, result.error);
//           await subscriberService.markBlockedWithReason(
//             subscriber.chatId,
//             deactivateCheck.reason,
//             deactivateCheck.reasonType
//           );
//         }
//       }
//     } catch (error) {
//       failed++;
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       errors.push({ chatId: subscriber.chatId, error: errorMessage });

//       // Check if we should deactivate the subscriber
//       const { shouldDeactivateOnError, logDeactivation } = await import("./broadcaster");
//       const deactivateCheck = shouldDeactivateOnError(errorMessage);
//       if (deactivateCheck.shouldDeactivate && deactivateCheck.reason && deactivateCheck.reasonType) {
//         try {
//           logDeactivation(subscriber.chatId, deactivateCheck.reason, deactivateCheck.reasonType, errorMessage);
//           await subscriberService.markBlockedWithReason(
//             subscriber.chatId,
//             deactivateCheck.reason,
//             deactivateCheck.reasonType
//           );
//         } catch {
//           // Ignore errors when marking blocked
//         }
//       }
//     }

//     // Add small delay between sends to avoid rate limiting (50ms)
//     if (activeSubscribers.indexOf(subscriber) < activeSubscribers.length - 1) {
//       await new Promise((resolve) => setTimeout(resolve, 50));
//     }
//   }

//   const duration = Date.now() - startTime;

//   return {
//     success: failed === 0,
//     sent,
//     failed,
//     total,
//     errors,
//     duration,
//   };
// }

// /**
//  * Handle /broadcast command (admin only)
//  *
//  * Sends an announcement to all active subscribers
//  */
// export async function handleBroadcastCommand(
//   ctx: Context,
//   subscriberService: TelegramSubscriberService = telegramSubscriberService,
//   botClient?: import("./bot").TelegramBotClient
// ): Promise<void> {
//   // Check if user is admin
//   const adminCheck = checkIsAdmin(ctx);

//   if (!adminCheck.isAdmin) {
//     console.log(
//       `[TG-BOT] Unauthorized /broadcast attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
//     );
//     await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
//     return;
//   }

//   // Parse the message from command
//   const text = ctx.message?.text || "";
//   const message = parseBroadcastMessage(text);

//   if (!message) {
//     await ctx.reply(getEmptyBroadcastMessage(), { parse_mode: "Markdown" });
//     return;
//   }

//   // Send initial status message
//   const statusMsg = await ctx.reply("📤 *Broadcasting...*\n\nPlease wait while the message is being sent to all subscribers.", {
//     parse_mode: "Markdown",
//   });

//   try {
//     // Get bot client
//     const { getTelegramBot } = await import("./bot");
//     const client = botClient ?? getTelegramBot();

//     // Perform the broadcast
//     const result = await broadcastMessage(message, client, subscriberService);

//     // Update status message with report
//     const report = getBroadcastReportMessage(result);
//     await ctx.api.editMessageText(
//       ctx.chat!.id,
//       statusMsg.message_id,
//       report,
//       { parse_mode: "Markdown" }
//     );

//     console.log(
//       `[TG-BOT] Admin ${adminCheck.userId} broadcast message: sent=${result.sent}, failed=${result.failed}, duration=${result.duration}ms`
//     );
//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : "Unknown error";
//     console.error(`[TG-BOT] Broadcast error:`, error);

//     await ctx.api.editMessageText(
//       ctx.chat!.id,
//       statusMsg.message_id,
//       `❌ *Broadcast Failed*\n\nError: ${escapeMarkdown(errorMessage)}`,
//       { parse_mode: "Markdown" }
//     );
//   }
// }

// /**
//  * Create the /broadcast command handler (admin only)
//  */
// export function createBroadcastCommandHandler(
//   subscriberService: TelegramSubscriberService = telegramSubscriberService,
//   botClient?: import("./bot").TelegramBotClient
// ): (ctx: Context) => Promise<void> {
//   return (ctx: Context) => handleBroadcastCommand(ctx, subscriberService, botClient);
// }

// // =============================================================================
// // /test Command (Admin Only) - Send test alert to yourself
// // =============================================================================

// /**
//  * Result of a test alert operation
//  */
// export interface TestAlertResult {
//   success: boolean;
//   messageId?: number;
//   error?: string;
// }

// /**
//  * Get the test alert message
//  */
// export function getTestAlertMessage(): string {
//   const timestamp = new Date().toLocaleString("en-US", {
//     month: "short",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: true,
//   });

//   return `🔴 🐋 *Test Whale Trade Alert*

// A test whale just made a massive trade on Polymarket\\!

// 📊 Severity: Critical
// 🏷️ Type: Whale Trade
// 💵 Trade Value: $1,234,567
// 👛 Wallet: \`0xTest...1234\`
// ❓ Market: Will this test alert work?

// 🕐 ${escapeMarkdown(timestamp)}

// _This is a test alert\\. If you can see this, alerts are working correctly\\!_`;
// }

// /**
//  * Handle /test command (admin only)
//  *
//  * Sends a test alert to the requesting admin only
//  */
// export async function handleTestCommand(
//   ctx: Context,
//   botClient?: import("./bot").TelegramBotClient
// ): Promise<TestAlertResult> {
//   // Check if user is admin
//   const adminCheck = checkIsAdmin(ctx);

//   if (!adminCheck.isAdmin) {
//     console.log(
//       `[TG-BOT] Unauthorized /test attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
//     );
//     await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
//     return { success: false, error: "Unauthorized" };
//   }

//   try {
//     // Get bot client
//     const { getTelegramBot } = await import("./bot");
//     const client = botClient ?? getTelegramBot();

//     // Send test alert to the requesting user
//     const chatId = ctx.chat?.id;
//     if (!chatId) {
//       return { success: false, error: "No chat ID available" };
//     }

//     const result = await client.sendMessage(
//       chatId.toString(),
//       getTestAlertMessage(),
//       {
//         parseMode: "MarkdownV2",
//         disableWebPagePreview: true,
//       }
//     );

//     if (result.success) {
//       console.log(
//         `[TG-BOT] Admin ${adminCheck.userId} sent test alert`
//       );
//       return { success: true, messageId: result.messageId };
//     } else {
//       return { success: false, error: result.error };
//     }
//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : "Unknown error";
//     console.error(`[TG-BOT] Test alert error:`, error);
//     await ctx.reply(`❌ Failed to send test alert: ${errorMessage}`);
//     return { success: false, error: errorMessage };
//   }
// }

// /**
//  * Create the /test command handler (admin only)
//  */
// export function createTestCommandHandler(
//   botClient?: import("./bot").TelegramBotClient
// ): (ctx: Context) => Promise<TestAlertResult> {
//   return (ctx: Context) => handleTestCommand(ctx, botClient);
// }

// // =============================================================================
// // /whales Command - Show recent whale trades
// // =============================================================================

// /**
//  * Get the whales message with recent large trades
//  */
// export async function getWhalesMessage(): Promise<string> {
//   try {
//     const { PrismaClient } = await import("@prisma/client");
//     const prisma = new PrismaClient();
    
//     const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
//     const trades = await prisma.trade.findMany({
//       where: {
//         createdAt: { gte: oneDayAgo },
//         usdValue: { gte: 10000 },
//       },
//       orderBy: { usdValue: "desc" },
//       take: 10,
//       include: {
//         market: { select: { question: true } },
//         wallet: { select: { address: true } },
//       },
//     });

//     await prisma.$disconnect();

//     if (trades.length === 0) {
//       return `🐋 *Recent Whale Trades*

// No whale trades (>$10K) in the last 24 hours.

// Check back later or adjust your threshold in /settings.`;
//     }

//     let message = `🐋 *Recent Whale Trades* (24h)\n\n`;

//     for (const trade of trades) {
//       const size = trade.usdValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
//       const walletAddr = (trade as any).wallet?.address || trade.walletId;
//       const wallet = walletAddr.slice(0, 6) + "..." + walletAddr.slice(-4);
//       const marketQuestion = (trade as any).market?.question || "Unknown Market";
//       const marketDisplay = marketQuestion.slice(0, 40);
//       const side = trade.side === "BUY" ? "🟢 BUY" : "🔴 SELL";
      
//       message += `${side} *${size}*\n`;
//       message += `└ ${marketDisplay}${marketQuestion.length > 40 ? "..." : ""}\n`;
//       message += `└ Wallet: \`${wallet}\`\n\n`;
//     }

//     message += `_Updated: ${new Date().toLocaleTimeString()}_`;
//     return message;
//   } catch (error) {
//     console.error("[TG-BOT] Error fetching whales:", error);
//     return `🐋 *Recent Whale Trades*

// ⚠️ Error fetching whale trades. Please try again later.`;
//   }
// }

// /**
//  * Handle /whales command
//  */
// export async function handleWhalesCommand(ctx: Context): Promise<void> {
//   await ctx.reply("🔄 Fetching whale trades...");
//   const message = await getWhalesMessage();
//   await ctx.reply(message, { parse_mode: "Markdown" });
// }

// /**
//  * Create the /whales command handler
//  */
// export function createWhalesCommandHandler(): (ctx: Context) => Promise<void> {
//   return handleWhalesCommand;
// }

// // =============================================================================
// // /markets Command - Show hot markets
// // =============================================================================

// /**
//  * Get the markets message with trending markets
//  */
// export async function getMarketsMessage(): Promise<string> {
//   try {
//     const { PrismaClient } = await import("@prisma/client");
//     const prisma = new PrismaClient();
    
//     const markets = await prisma.market.findMany({
//       where: { active: true },
//       orderBy: { volume: "desc" },
//       take: 10,
//     });

//     await prisma.$disconnect();

//     if (markets.length === 0) {
//       return `📊 *Hot Markets*

// No active markets found.

// Markets will appear here once data is synced.`;
//     }

//     let message = `📊 *Hot Markets*\n\n`;

//     for (let i = 0; i < markets.length; i++) {
//   const market = markets[i];
//   if (!market) continue;
  
//   const question = market.question.slice(0, 45);
//   const volume = market.volume?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) || "$0";
  
//   message += `*${i + 1}.* ${question}${market.question.length > 45 ? "..." : ""}\n`;
//   message += `   💰 Volume: ${volume}\n\n`;
// }

//     message += `_Updated: ${new Date().toLocaleTimeString()}_`;
//     return message;
//   } catch (error) {
//     console.error("[TG-BOT] Error fetching markets:", error);
//     return `📊 *Hot Markets*

// ⚠️ Error fetching markets. Please try again later.`;
//   }
// }

// /**
//  * Handle /markets command
//  */
// export async function handleMarketsCommand(ctx: Context): Promise<void> {
//   await ctx.reply("🔄 Fetching hot markets...");
//   const message = await getMarketsMessage();
//   await ctx.reply(message, { parse_mode: "Markdown" });
// }

// /**
//  * Create the /markets command handler
//  */
// export function createMarketsCommandHandler(): (ctx: Context) => Promise<void> {
//   return handleMarketsCommand;
// }

/**
 * Telegram Bot Command Handlers
 *
 * Implements command handlers for the Telegram bot including user registration.
 * IMPROVED VERSION with better UI, Polymarket links, and whale context.
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
import { env } from "../../config/env";

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
 * Welcome message for new users - IMPROVED
 */
export function getWelcomeMessage(isNew: boolean, displayName: string): string {
  const greeting = isNew
    ? `🐋 Welcome to PolyWhale, ${displayName}!`
    : `🐋 Welcome back, ${displayName}!`;

  return `${greeting}

Your real-time Polymarket intelligence platform.

━━━━━━━━━━━━━━━━━━━━━━

📊 *Commands:*
/markets - Hot markets by volume
/whales - Recent whale trades
/settings - Configure alerts
/help - All commands

━━━━━━━━━━━━━━━━━━━━━━

📈 *What I Track:*
• 🐋 Whale trades ($10K+ positions)
• 🕵️ Insider trading patterns
• 📊 Suspicious wallet activity

━━━━━━━━━━━━━━━━━━━━━━

${isNew ? "✅ You're now subscribed to whale alerts!" : "✅ Your subscription is active!"}

_Powered by ZkAGI Digital Limited_`;
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
  await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
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
 * Welcome message for groups when bot is added - IMPROVED
 */
export function getGroupWelcomeMessage(groupTitle: string): string {
  return `🐋 *PolyWhale has joined ${groupTitle}!*

━━━━━━━━━━━━━━━━━━━━━━

I'll send real-time alerts about:

🐋 *Whale Trades* - Large positions ($10K+)
🕵️ *Insider Patterns* - Suspicious activity
📊 *Market Movements* - Volume spikes

━━━━━━━━━━━━━━━━━━━━━━

*Commands:*
/markets - Hot markets by volume
/whales - Recent whale trades
/settings - Configure group alerts
/help - All commands

━━━━━━━━━━━━━━━━━━━━━━

_Powered by ZkAGI Digital Limited_`;
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
          await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle), {
            parse_mode: "Markdown",
          });

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
      await ctx.api.sendMessage(chat.id, getGroupWelcomeMessage(chatTitle), {
        parse_mode: "Markdown",
      });

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

You have been unsubscribed from PolyWhale alerts.

You will no longer receive notifications about:
• 🐋 Whale trades
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

// =============================================================================
// /help Command - Show all available commands - IMPROVED
// =============================================================================

/**
 * Get the help message with all available commands
 */
export function getHelpMessage(): string {
  return `🐋 *PolyWhale - Help Center*

━━━━━━━━━━━━━━━━━━━━━━

📊 *Market Commands:*
/markets - View hot markets by volume
/whales - Recent whale trades (24h)

🔔 *Alert Commands:*
/start - Subscribe to alerts
/stop - Unsubscribe from alerts
/status - Check subscription status
/settings - Configure alert preferences
/help - Show this help message

━━━━━━━━━━━━━━━━━━━━━━

📈 *What I Track:*

🐋 *Whale Trades*
Large positions ($10K+) that may indicate smart money movements

🕵️ *Insider Patterns*
Unusual timing, fresh wallets, concentrated bets before events

📊 *Suspicious Activity*
New wallets making large trades, unusual market concentration

━━━━━━━━━━━━━━━━━━━━━━

⚙️ *Customize Alerts:*
Use /settings to:
• Set minimum trade size ($1K-$100K)
• Enable/disable alert types
• Choose severity level

━━━━━━━━━━━━━━━━━━━━━━

🔗 *Links:*
• [Polymarket](https://polymarket.com)
• [PolygonScan](https://polygonscan.com)

━━━━━━━━━━━━━━━━━━━━━━

_© ZkAGI Digital Limited_
_Not affiliated with Polymarket_`;
}

/**
 * Handle /help command
 *
 * Shows all available commands and their descriptions
 */
export async function handleHelpCommand(ctx: Context): Promise<void> {
  await ctx.reply(getHelpMessage(), { 
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Create the /help command handler
 */
export function createHelpCommandHandler(): (ctx: Context) => Promise<void> {
  return handleHelpCommand;
}

// =============================================================================
// /status Command - Show subscription status
// =============================================================================

/**
 * Result of a status check
 */
export interface StatusResult {
  success: boolean;
  isSubscribed: boolean;
  subscriber?: TelegramSubscriber;
  error?: string;
}

/**
 * Get subscription status for a chat
 */
export async function getSubscriptionStatus(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<StatusResult> {
  const chat = ctx.chat;

  if (!chat) {
    return {
      success: false,
      isSubscribed: false,
      error: "No chat information available",
    };
  }

  try {
    const chatId = BigInt(chat.id);
    const subscriber = await subscriberService.findByChatId(chatId);

    if (!subscriber) {
      return {
        success: true,
        isSubscribed: false,
      };
    }

    return {
      success: true,
      isSubscribed: subscriber.isActive && !subscriber.isBlocked,
      subscriber,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Status check error:`, error);

    return {
      success: false,
      isSubscribed: false,
      error: errorMessage,
    };
  }
}

/**
 * Format date for display
 */
export function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get the status message for a subscriber
 */
export function getStatusMessage(
  displayName: string,
  isSubscribed: boolean,
  subscriber?: TelegramSubscriber
): string {
  if (!isSubscribed || !subscriber) {
    return `📊 *Status for ${escapeMarkdown(displayName)}*

🔴 *Not Subscribed*

You are not currently subscribed to alerts.
Use /start to subscribe and receive whale and insider activity notifications.`;
  }

  const prefs = (subscriber.alertPreferences as AlertPreferences) || {};
  const whaleStatus = prefs.whaleAlerts !== false ? "✅ ON" : "❌ OFF";
  const insiderStatus = prefs.insiderAlerts !== false ? "✅ ON" : "❌ OFF";
  const minTrade = formatPreferenceValue("minTradeValue", prefs.minTradeValue || 10000);
  const severity = formatPreferenceValue(
    "severity",
    (prefs as Record<string, unknown>).severity || "all"
  );

  return `📊 *Status for ${escapeMarkdown(displayName)}*

🟢 *Subscribed*

*Alert Settings:*
• Whale Alerts: ${whaleStatus}
• Insider Alerts: ${insiderStatus}
• Min Trade Size: ${minTrade}
• Severity: ${severity}

*Statistics:*
• Alerts Received: ${subscriber.alertsSent}
• Last Alert: ${formatDate(subscriber.lastAlertAt)}
• Subscribed Since: ${formatDate(subscriber.createdAt)}

Use /settings to change your preferences.
Use /stop to unsubscribe.`;
}

/**
 * Escape special characters for Telegram Markdown
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

/**
 * Handle /status command
 *
 * Shows the user's subscription status and statistics
 */
export async function handleStatusCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  const displayName = getDisplayName(ctx);
  const result = await getSubscriptionStatus(ctx, subscriberService);

  if (!result.success) {
    await ctx.reply(
      `Sorry, there was an error checking your status. Please try again later.\n\nError: ${result.error}`
    );
    return;
  }

  const message = getStatusMessage(displayName, result.isSubscribed, result.subscriber);
  await ctx.reply(message, { parse_mode: "Markdown" });
}

/**
 * Create the /status command handler
 */
export function createStatusCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleStatusCommand(ctx, subscriberService);
}

// =============================================================================
// /stats Command (Admin Only) - Show bot statistics
// =============================================================================

/**
 * Result of admin verification
 */
export interface AdminCheckResult {
  isAdmin: boolean;
  userId?: number;
  reason?: string;
}

/**
 * Check if the user is an admin (by Telegram user ID from env)
 */
export function checkIsAdmin(ctx: Context): AdminCheckResult {
  const from = ctx.from;

  if (!from) {
    return {
      isAdmin: false,
      reason: "No user information available",
    };
  }

  const userId = from.id;
  const adminIds = env.TELEGRAM_ADMIN_IDS;

  // If no admin IDs configured, no one is admin
  if (!adminIds || adminIds.length === 0) {
    return {
      isAdmin: false,
      userId,
      reason: "No admin IDs configured",
    };
  }

  const isAdmin = adminIds.includes(userId);

  return {
    isAdmin,
    userId,
    reason: isAdmin ? undefined : "User ID not in admin list",
  };
}

/**
 * Get the unauthorized message for non-admins
 */
export function getUnauthorizedMessage(): string {
  return `⛔ *Access Denied*

This command is only available to bot administrators.

If you believe you should have admin access, please contact the bot owner.`;
}

/**
 * Stats result from the service
 */
export interface BotStats {
  total: number;
  active: number;
  blocked: number;
  byType: {
    PRIVATE: number;
    GROUP: number;
    SUPERGROUP: number;
    CHANNEL: number;
  };
}

/**
 * Get the stats message for admins
 */
export function getStatsMessage(stats: BotStats, uptime: string): string {
  const { total, active, blocked, byType } = stats;
  const inactive = total - active - blocked;

  return `📈 *Bot Statistics*

*Subscribers:*
• Total: ${total}
• Active: ${active}
• Inactive: ${inactive}
• Blocked: ${blocked}

*By Type:*
• Private Chats: ${byType.PRIVATE}
• Groups: ${byType.GROUP}
• Supergroups: ${byType.SUPERGROUP}
• Channels: ${byType.CHANNEL}

*System:*
• Status: 🟢 Online
• Uptime: ${uptime}

Use /broadcast <message> to send announcements to all subscribers.`;
}

/**
 * Calculate uptime string from process start time
 */
export function getUptimeString(): string {
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("< 1m");

  return parts.join(" ");
}

/**
 * Handle /stats command (admin only)
 *
 * Shows bot statistics including subscriber counts and system health
 */
export async function handleStatsCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<void> {
  // Check if user is admin
  const adminCheck = checkIsAdmin(ctx);

  if (!adminCheck.isAdmin) {
    console.log(
      `[TG-BOT] Unauthorized /stats attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
    );
    await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
    return;
  }

  try {
    const stats = await subscriberService.getStats();
    const uptime = getUptimeString();

    // Map the stats to the expected format
    const formattedStats: BotStats = {
      total: stats.total,
      active: stats.active,
      blocked: stats.blocked,
      byType: {
        PRIVATE: stats.byType.PRIVATE,
        GROUP: stats.byType.GROUP,
        SUPERGROUP: stats.byType.SUPERGROUP,
        CHANNEL: stats.byType.CHANNEL,
      },
    };

    const message = getStatsMessage(formattedStats, uptime);
    await ctx.reply(message, { parse_mode: "Markdown" });

    console.log(`[TG-BOT] Admin ${adminCheck.userId} viewed stats`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[TG-BOT] Stats error:`, error);

    await ctx.reply(
      `Sorry, there was an error fetching statistics. Please try again later.\n\nError: ${errorMessage}`
    );
  }
}

/**
 * Create the /stats command handler (admin only)
 */
export function createStatsCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleStatsCommand(ctx, subscriberService);
}

// =============================================================================
// /broadcast Command (Admin Only) - Send announcements to all subscribers
// =============================================================================

/**
 * Result of a broadcast operation
 */
export interface AdminBroadcastResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  errors: Array<{ chatId: bigint; error: string }>;
  duration: number;
}

/**
 * Parse broadcast message from command text
 * The format is: /broadcast <message>
 */
export function parseBroadcastMessage(text: string): string | null {
  // Match /broadcast followed by the message
  const match = text.match(/^\/broadcast(?:@\w+)?\s+(.+)$/s);
  if (!match || !match[1]) {
    return null;
  }
  const trimmed = match[1].trim();
  // Return null if the message is empty after trimming
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

/**
 * Format the broadcast report message
 */
export function getBroadcastReportMessage(result: AdminBroadcastResult): string {
  const statusEmoji = result.failed === 0 ? "✅" : "⚠️";
  const successRate = result.total > 0
    ? Math.round((result.sent / result.total) * 100)
    : 0;

  let message = `${statusEmoji} *Broadcast Complete*

📊 *Results:*
• Total subscribers: ${result.total}
• Successfully sent: ${result.sent}
• Failed: ${result.failed}
• Success rate: ${successRate}%
• Duration: ${result.duration}ms`;

  if (result.errors.length > 0 && result.errors.length <= 5) {
    message += `

❌ *Errors:*`;
    for (const err of result.errors) {
      message += `\n• Chat ${err.chatId}: ${escapeMarkdown(err.error)}`;
    }
  } else if (result.errors.length > 5) {
    message += `

❌ *Errors:* ${result.errors.length} failures (showing first 5)`;
    for (const err of result.errors.slice(0, 5)) {
      message += `\n• Chat ${err.chatId}: ${escapeMarkdown(err.error)}`;
    }
  }

  return message;
}

/**
 * Get message for empty broadcast
 */
export function getEmptyBroadcastMessage(): string {
  return `⚠️ *Usage:* /broadcast <message>

Send an announcement to all active subscribers.

*Example:*
\`/broadcast Hello! This is a test announcement.\`

The message will be sent to all active subscribers.`;
}

/**
 * Broadcast a message to all active subscribers
 */
export async function broadcastMessage(
  message: string,
  botClient: import("./bot").TelegramBotClient,
  subscriberService: TelegramSubscriberService = telegramSubscriberService
): Promise<AdminBroadcastResult> {
  const startTime = Date.now();
  const errors: Array<{ chatId: bigint; error: string }> = [];
  let sent = 0;
  let failed = 0;

  // Get all active subscribers
  const activeSubscribers = await subscriberService.findActive();
  const total = activeSubscribers.length;

  // Prepare the broadcast message
  const broadcastText = `📢 *Announcement*

${message}`;

  // Send to each subscriber with rate limiting
  for (const subscriber of activeSubscribers) {
    try {
      const result = await botClient.sendMessage(
        subscriber.chatId.toString(),
        broadcastText,
        {
          parseMode: "Markdown",
          disableWebPagePreview: true,
        }
      );

      if (result.success) {
        sent++;
        // Increment alerts sent counter
        await subscriberService.incrementAlertsSent(subscriber.chatId);
      } else {
        failed++;
        errors.push({ chatId: subscriber.chatId, error: result.error || "Unknown error" });

        // Check if we should deactivate the subscriber
        const { shouldDeactivateOnError, logDeactivation } = await import("./broadcaster");
        const deactivateCheck = shouldDeactivateOnError(result.error || "");
        if (deactivateCheck.shouldDeactivate && deactivateCheck.reason && deactivateCheck.reasonType) {
          logDeactivation(subscriber.chatId, deactivateCheck.reason, deactivateCheck.reasonType, result.error);
          await subscriberService.markBlockedWithReason(
            subscriber.chatId,
            deactivateCheck.reason,
            deactivateCheck.reasonType
          );
        }
      }
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ chatId: subscriber.chatId, error: errorMessage });

      // Check if we should deactivate the subscriber
      const { shouldDeactivateOnError, logDeactivation } = await import("./broadcaster");
      const deactivateCheck = shouldDeactivateOnError(errorMessage);
      if (deactivateCheck.shouldDeactivate && deactivateCheck.reason && deactivateCheck.reasonType) {
        try {
          logDeactivation(subscriber.chatId, deactivateCheck.reason, deactivateCheck.reasonType, errorMessage);
          await subscriberService.markBlockedWithReason(
            subscriber.chatId,
            deactivateCheck.reason,
            deactivateCheck.reasonType
          );
        } catch {
          // Ignore errors when marking blocked
        }
      }
    }

    // Add small delay between sends to avoid rate limiting (50ms)
    if (activeSubscribers.indexOf(subscriber) < activeSubscribers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: failed === 0,
    sent,
    failed,
    total,
    errors,
    duration,
  };
}

/**
 * Handle /broadcast command (admin only)
 *
 * Sends an announcement to all active subscribers
 */
export async function handleBroadcastCommand(
  ctx: Context,
  subscriberService: TelegramSubscriberService = telegramSubscriberService,
  botClient?: import("./bot").TelegramBotClient
): Promise<void> {
  // Check if user is admin
  const adminCheck = checkIsAdmin(ctx);

  if (!adminCheck.isAdmin) {
    console.log(
      `[TG-BOT] Unauthorized /broadcast attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
    );
    await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
    return;
  }

  // Parse the message from command
  const text = ctx.message?.text || "";
  const message = parseBroadcastMessage(text);

  if (!message) {
    await ctx.reply(getEmptyBroadcastMessage(), { parse_mode: "Markdown" });
    return;
  }

  // Send initial status message
  const statusMsg = await ctx.reply("📤 *Broadcasting...*\n\nPlease wait while the message is being sent to all subscribers.", {
    parse_mode: "Markdown",
  });

  try {
    // Get bot client
    const { getTelegramBot } = await import("./bot");
    const client = botClient ?? getTelegramBot();

    // Perform the broadcast
    const result = await broadcastMessage(message, client, subscriberService);

    // Update status message with report
    const report = getBroadcastReportMessage(result);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      report,
      { parse_mode: "Markdown" }
    );

    console.log(
      `[TG-BOT] Admin ${adminCheck.userId} broadcast message: sent=${result.sent}, failed=${result.failed}, duration=${result.duration}ms`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[TG-BOT] Broadcast error:`, error);

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ *Broadcast Failed*\n\nError: ${escapeMarkdown(errorMessage)}`,
      { parse_mode: "Markdown" }
    );
  }
}

/**
 * Create the /broadcast command handler (admin only)
 */
export function createBroadcastCommandHandler(
  subscriberService: TelegramSubscriberService = telegramSubscriberService,
  botClient?: import("./bot").TelegramBotClient
): (ctx: Context) => Promise<void> {
  return (ctx: Context) => handleBroadcastCommand(ctx, subscriberService, botClient);
}

// =============================================================================
// /test Command (Admin Only) - Send test alert to yourself
// =============================================================================

/**
 * Result of a test alert operation
 */
export interface TestAlertResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Get the test alert message
 */
export function getTestAlertMessage(): string {
  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `🔴 🐋 *Test Whale Trade Alert*

A test whale just made a massive trade on Polymarket\\!

📊 Severity: Critical
🏷️ Type: Whale Trade
💵 Trade Value: $1,234,567
👛 Wallet: \`0xTest...1234\`
❓ Market: Will this test alert work?

🕐 ${escapeMarkdown(timestamp)}

_This is a test alert\\. If you can see this, alerts are working correctly\\!_`;
}

/**
 * Handle /test command (admin only)
 *
 * Sends a test alert to the requesting admin only
 */
export async function handleTestCommand(
  ctx: Context,
  botClient?: import("./bot").TelegramBotClient
): Promise<TestAlertResult> {
  // Check if user is admin
  const adminCheck = checkIsAdmin(ctx);

  if (!adminCheck.isAdmin) {
    console.log(
      `[TG-BOT] Unauthorized /test attempt from user ${adminCheck.userId}: ${adminCheck.reason}`
    );
    await ctx.reply(getUnauthorizedMessage(), { parse_mode: "Markdown" });
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get bot client
    const { getTelegramBot } = await import("./bot");
    const client = botClient ?? getTelegramBot();

    // Send test alert to the requesting user
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return { success: false, error: "No chat ID available" };
    }

    const result = await client.sendMessage(
      chatId.toString(),
      getTestAlertMessage(),
      {
        parseMode: "MarkdownV2",
        disableWebPagePreview: true,
      }
    );

    if (result.success) {
      console.log(
        `[TG-BOT] Admin ${adminCheck.userId} sent test alert`
      );
      return { success: true, messageId: result.messageId };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[TG-BOT] Test alert error:`, error);
    await ctx.reply(`❌ Failed to send test alert: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Create the /test command handler (admin only)
 */
export function createTestCommandHandler(
  botClient?: import("./bot").TelegramBotClient
): (ctx: Context) => Promise<TestAlertResult> {
  return (ctx: Context) => handleTestCommand(ctx, botClient);
}

// =============================================================================
// /whales Command - Show recent whale trades - IMPROVED
// =============================================================================

/**
 * Get the whales message with recent large trades - IMPROVED with links and context
 */
export async function getWhalesMessage(): Promise<string> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const trades = await prisma.trade.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        usdValue: { gte: 10000 },
      },
      orderBy: { usdValue: "desc" },
      take: 10,
      include: {
        market: { select: { question: true, slug: true, conditionId: true } },
        wallet: { select: { address: true, tradeCount: true, isWhale: true } },
      },
    });

    await prisma.$disconnect();

    if (trades.length === 0) {
      return `🐋 *Recent Whale Trades* (24h)

━━━━━━━━━━━━━━━━━━━━━━

No whale trades (>$10K) in the last 24 hours.

💡 Adjust threshold in /settings

_Updated: ${new Date().toLocaleTimeString()}_`;
    }

    let message = `🐋 *Recent Whale Trades* (24h)\n\n`;

    for (const trade of trades) {
      const wallet = (trade as any).wallet;
      const market = (trade as any).market;
      
      // Severity emoji based on size
      const severity = trade.usdValue >= 100000 ? "🔴" : trade.usdValue >= 50000 ? "🟠" : trade.usdValue >= 25000 ? "🟡" : "🟢";
      const side = trade.side === "BUY" ? "🟢 BUY" : "🔴 SELL";
      const size = trade.usdValue >= 1000000 
        ? `$${(trade.usdValue / 1000000).toFixed(2)}M`
        : `$${(trade.usdValue / 1000).toFixed(1)}K`;
      
      const walletAddr = wallet?.address || trade.walletId;
      const walletShort = `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
      const marketQuestion = market?.question || "Unknown Market";
      const marketDisplay = marketQuestion.length > 35 ? marketQuestion.slice(0, 35) + "..." : marketQuestion;
      const marketSlug = market?.slug || "";
      const conditionId = market?.conditionId || "";
      
      // Use conditionId if available (more reliable), fallback to slug
      const polymarketUrl = conditionId 
        ? `https://polymarket.com/markets/${conditionId}`
        : marketSlug 
          ? `https://polymarket.com/event/${marketSlug}`
          : `https://polymarket.com`;
      
      // Context badges
      const badges: string[] = [];
      if (wallet?.tradeCount && wallet.tradeCount < 10) badges.push("🆕");
      if (wallet?.isWhale) badges.push("🐋");
      const badgeStr = badges.length > 0 ? ` ${badges.join("")}` : "";
      
      message += `${severity} ${side} *${size}*${badgeStr}\n`;
      message += `├ ${marketDisplay}\n`;
      message += `├ 👛 [${walletShort}](https://polygonscan.com/address/${walletAddr})\n`;
      message += `└ [View on Polymarket](${polymarketUrl})\n\n`;
    }

    message += `_Updated: ${new Date().toLocaleTimeString()}_`;
    return message;
  } catch (error) {
    console.error("[TG-BOT] Error fetching whales:", error);
    return `🐋 *Recent Whale Trades*\n\n⚠️ Error fetching trades. Try again later.`;
  }
}

/**
 * Handle /whales command
 */
export async function handleWhalesCommand(ctx: Context): Promise<void> {
  await ctx.reply("🔄 Fetching whale trades...");
  const message = await getWhalesMessage();
  await ctx.reply(message, { 
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Create the /whales command handler
 */
export function createWhalesCommandHandler(): (ctx: Context) => Promise<void> {
  return handleWhalesCommand;
}

// =============================================================================
// /markets Command - Show hot markets - IMPROVED
// =============================================================================

/**
 * Get the markets message with trending markets - IMPROVED with links
 */
export async function getMarketsMessage(): Promise<string> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    
    const markets = await prisma.market.findMany({
      where: { active: true },
      orderBy: { volume: "desc" },
      take: 10,
      select: {
        question: true,
        slug: true,
        conditionId: true,
        volume: true,
      },
    });

    await prisma.$disconnect();

    if (markets.length === 0) {
      return `📊 *Hot Markets*

━━━━━━━━━━━━━━━━━━━━━━

No active markets found.

Markets will appear here once data is synced.

_Updated: ${new Date().toLocaleTimeString()}_`;
    }

    let message = `📊 *Hot Markets by Volume*\n\n`;

    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      if (!market) continue;
      
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      const question = market.question.length > 40 ? market.question.slice(0, 40) + "..." : market.question;
      const volume = market.volume >= 1000000 
        ? `$${(market.volume / 1000000).toFixed(2)}M`
        : `$${(market.volume / 1000).toFixed(0)}K`;
      
      // Use conditionId if available, fallback to slug
      const polymarketUrl = market.conditionId 
        ? `https://polymarket.com/markets/${market.conditionId}`
        : market.slug 
          ? `https://polymarket.com/event/${market.slug}`
          : `https://polymarket.com`;
      
      message += `${medal} ${question}\n`;
      message += `   💰 Volume: ${volume}\n`;
      message += `   🔗 [View Market](${polymarketUrl})\n\n`;
    }

    message += `_Updated: ${new Date().toLocaleTimeString()}_`;
    return message;
  } catch (error) {
    console.error("[TG-BOT] Error fetching markets:", error);
    return `📊 *Hot Markets*\n\n⚠️ Error fetching markets. Try again later.`;
  }
}

/**
 * Handle /markets command
 */
export async function handleMarketsCommand(ctx: Context): Promise<void> {
  await ctx.reply("🔄 Fetching hot markets...");
  const message = await getMarketsMessage();
  await ctx.reply(message, { 
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * Create the /markets command handler
 */
export function createMarketsCommandHandler(): (ctx: Context) => Promise<void> {
  return handleMarketsCommand;
}