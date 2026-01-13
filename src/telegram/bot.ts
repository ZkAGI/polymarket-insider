/**
 * Telegram Bot Client
 *
 * Initializes and manages the Telegram bot using grammy library.
 * Provides bot instance for sending notifications and handling commands.
 */

import { Bot, Context, GrammyError, HttpError } from "grammy";
import { env } from "../../config/env";

/**
 * Bot status for health checks
 */
export type BotStatus = "stopped" | "starting" | "running" | "stopping" | "error";

/**
 * Bot initialization result
 */
export interface BotInitResult {
  success: boolean;
  botInfo?: {
    id: number;
    username: string;
    firstName: string;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
    supportsInlineQueries: boolean;
  };
  error?: string;
}

/**
 * TelegramBotClient class manages the bot lifecycle
 */
export class TelegramBotClient {
  private bot: Bot | null = null;
  private status: BotStatus = "stopped";
  private startedAt: Date | null = null;
  private lastError: Error | null = null;

  /**
   * Get the bot token from environment
   */
  private getToken(): string | null {
    return env.TELEGRAM_BOT_TOKEN ?? null;
  }

  /**
   * Check if the bot token is configured
   */
  public hasToken(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Get the current bot status
   */
  public getStatus(): BotStatus {
    return this.status;
  }

  /**
   * Get the bot instance (throws if not initialized)
   */
  public getBot(): Bot {
    if (!this.bot) {
      throw new Error("Bot is not initialized. Call initialize() first.");
    }
    return this.bot;
  }

  /**
   * Get the raw bot instance (may be null)
   */
  public getRawBot(): Bot | null {
    return this.bot;
  }

  /**
   * Get the last error if any
   */
  public getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get the time when the bot started
   */
  public getStartedAt(): Date | null {
    return this.startedAt;
  }

  /**
   * Get uptime in milliseconds
   */
  public getUptime(): number {
    if (!this.startedAt || this.status !== "running") {
      return 0;
    }
    return Date.now() - this.startedAt.getTime();
  }

  /**
   * Initialize the bot (creates instance but doesn't start polling)
   */
  public async initialize(): Promise<BotInitResult> {
    const token = this.getToken();

    if (!token) {
      this.status = "error";
      this.lastError = new Error("TELEGRAM_BOT_TOKEN is not configured");
      return {
        success: false,
        error: "TELEGRAM_BOT_TOKEN is not configured",
      };
    }

    try {
      this.status = "starting";

      // Create the bot instance
      this.bot = new Bot(token);

      // Get bot info to verify token is valid
      const me = await this.bot.api.getMe();

      return {
        success: true,
        botInfo: {
          id: me.id,
          username: me.username || "",
          firstName: me.first_name,
          canJoinGroups: me.can_join_groups || false,
          canReadAllGroupMessages: me.can_read_all_group_messages || false,
          supportsInlineQueries: me.supports_inline_queries || false,
        },
      };
    } catch (error) {
      this.status = "error";
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.bot = null;

      let errorMessage = "Failed to initialize bot";
      if (error instanceof GrammyError) {
        errorMessage = `Telegram API error: ${error.message}`;
      } else if (error instanceof HttpError) {
        errorMessage = `Network error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Start the bot (begin polling for updates)
   */
  public async start(): Promise<void> {
    if (!this.bot) {
      throw new Error("Bot is not initialized. Call initialize() first.");
    }

    if (this.status === "running") {
      return;
    }

    this.status = "starting";

    // Set up error handler
    this.bot.catch((err) => {
      const ctx = err.ctx;
      console.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error;
      if (e instanceof GrammyError) {
        console.error("Telegram API error:", e.description);
      } else if (e instanceof HttpError) {
        console.error("Network error:", e);
      } else {
        console.error("Unknown error:", e);
      }
      this.lastError = e instanceof Error ? e : new Error(String(e));
    });

    // Start the bot (non-blocking)
    this.bot.start({
      onStart: (botInfo) => {
        this.status = "running";
        this.startedAt = new Date();
        console.log(`Bot @${botInfo.username} is now running`);
      },
    });
  }

  /**
   * Stop the bot gracefully
   */
  public async stop(): Promise<void> {
    if (!this.bot || this.status === "stopped") {
      return;
    }

    this.status = "stopping";

    try {
      await this.bot.stop();
      this.status = "stopped";
      this.startedAt = null;
      console.log("Bot stopped gracefully");
    } catch (error) {
      this.status = "error";
      this.lastError = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Send a message to a specific chat
   */
  public async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parseMode?: "HTML" | "Markdown" | "MarkdownV2";
      disableNotification?: boolean;
      disableWebPagePreview?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.bot) {
      return { success: false, error: "Bot is not initialized" };
    }

    try {
      const result = await this.bot.api.sendMessage(chatId, text, {
        parse_mode: options?.parseMode,
        disable_notification: options?.disableNotification,
        link_preview_options: options?.disableWebPagePreview
          ? { is_disabled: true }
          : undefined,
      });

      return { success: true, messageId: result.message_id };
    } catch (error) {
      let errorMessage = "Failed to send message";
      if (error instanceof GrammyError) {
        errorMessage = `Telegram API error: ${error.description}`;
      } else if (error instanceof HttpError) {
        errorMessage = `Network error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Register a command handler
   */
  public onCommand(
    command: string,
    handler: (ctx: Context) => void | Promise<void>
  ): void {
    if (!this.bot) {
      throw new Error("Bot is not initialized. Call initialize() first.");
    }
    this.bot.command(command, handler);
  }

  /**
   * Register a message handler
   */
  public onMessage(handler: (ctx: Context) => void | Promise<void>): void {
    if (!this.bot) {
      throw new Error("Bot is not initialized. Call initialize() first.");
    }
    this.bot.on("message", handler);
  }

  /**
   * Register a callback query handler
   */
  public onCallbackQuery(
    pattern: string | RegExp,
    handler: (ctx: Context) => void | Promise<void>
  ): void {
    if (!this.bot) {
      throw new Error("Bot is not initialized. Call initialize() first.");
    }
    this.bot.callbackQuery(pattern, handler);
  }

  /**
   * Check if a user is an admin
   */
  public isAdmin(userId: number): boolean {
    return env.TELEGRAM_ADMIN_IDS.includes(userId);
  }

  /**
   * Get bot health info for monitoring
   */
  public getHealthInfo(): {
    status: BotStatus;
    hasToken: boolean;
    uptime: number;
    lastError: string | null;
    startedAt: string | null;
  } {
    return {
      status: this.status,
      hasToken: this.hasToken(),
      uptime: this.getUptime(),
      lastError: this.lastError?.message ?? null,
      startedAt: this.startedAt?.toISOString() ?? null,
    };
  }
}

// Singleton instance
let botClient: TelegramBotClient | null = null;

/**
 * Get the singleton bot client instance
 */
export function getTelegramBot(): TelegramBotClient {
  if (!botClient) {
    botClient = new TelegramBotClient();
  }
  return botClient;
}

/**
 * Create a new bot client instance (for testing)
 */
export function createTelegramBot(): TelegramBotClient {
  return new TelegramBotClient();
}

/**
 * Initialize and start the bot
 * Convenience function that combines initialize() and start()
 */
export async function startTelegramBot(): Promise<BotInitResult> {
  const client = getTelegramBot();

  const initResult = await client.initialize();
  if (!initResult.success) {
    return initResult;
  }

  await client.start();
  return initResult;
}

/**
 * Stop the singleton bot instance
 */
export async function stopTelegramBot(): Promise<void> {
  if (botClient) {
    await botClient.stop();
  }
}

// Export types
export type { Bot, Context };
