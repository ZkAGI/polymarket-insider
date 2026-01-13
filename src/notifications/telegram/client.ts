/**
 * Telegram bot client for the Polymarket Tracker
 * Provides functionality for sending messages and handling bot interactions
 */

import {
  TelegramBotConfig,
  TelegramMessage,
  TelegramSendResult,
  TelegramMessageStatus,
  TelegramApiResponse,
  TelegramApiMessage,
  TelegramParseMode,
  TelegramEventType,
  TelegramEvent,
  TelegramEventHandler,
  TelegramCommandHandler,
  TelegramCallbackHandler,
  TelegramBatchOptions,
  TelegramBatchResult,
  TelegramUser,
  TelegramUpdate,
  TelegramBotCommand,
  isValidBotToken,
  isValidChatId,
  formatChatId,
} from "./types";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<TelegramBotConfig> = {
  defaultParseMode: TelegramParseMode.HTML,
  devMode: process.env.NODE_ENV !== "production",
  rateLimit: 30, // Telegram allows 30 messages/second in private chats
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  baseUrl: "https://api.telegram.org",
};

/**
 * Telegram bot client error
 */
export class TelegramClientError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options: { statusCode?: number; retryable?: boolean; cause?: Error } = {}
  ) {
    super(message);
    this.name = "TelegramClientError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Rate limiter for Telegram API calls
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(tokensPerSecond: number) {
    this.maxTokens = tokensPerSecond;
    this.tokens = tokensPerSecond;
    this.refillRate = tokensPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = Math.ceil((1 - this.tokens) * (1000 / this.refillRate));
      await this.sleep(waitTime);
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Telegram bot client for sending messages and handling interactions
 */
export class TelegramClient {
  private readonly config: Required<TelegramBotConfig>;
  private readonly rateLimiter: RateLimiter;
  private readonly eventHandlers: Map<TelegramEventType, Set<TelegramEventHandler>>;
  private readonly commandHandlers: Map<string, TelegramCommandHandler>;
  private readonly callbackHandlers: Map<string, TelegramCallbackHandler>;
  private sentCount: number = 0;
  private failedCount: number = 0;
  private pollingActive: boolean = false;
  private pollingOffset: number = 0;

  constructor(config: TelegramBotConfig) {
    // Determine dev mode first (before token validation)
    const isDevMode = config.devMode ?? DEFAULT_CONFIG.devMode!;

    // Validate bot token - required in production mode, optional in dev mode
    if (!config.botToken && !isDevMode) {
      throw new TelegramClientError("Bot token is required", "MISSING_TOKEN");
    }

    if (config.botToken && !isDevMode && !isValidBotToken(config.botToken)) {
      throw new TelegramClientError(
        "Invalid bot token format",
        "INVALID_TOKEN_FORMAT"
      );
    }

    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      defaultParseMode: config.defaultParseMode ?? DEFAULT_CONFIG.defaultParseMode!,
      devMode: config.devMode ?? DEFAULT_CONFIG.devMode!,
      rateLimit: config.rateLimit ?? DEFAULT_CONFIG.rateLimit!,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries!,
      retryDelay: config.retryDelay ?? DEFAULT_CONFIG.retryDelay!,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout!,
      baseUrl: config.baseUrl ?? DEFAULT_CONFIG.baseUrl!,
    };

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.config.rateLimit);

    // Initialize handlers
    this.eventHandlers = new Map();
    this.commandHandlers = new Map();
    this.callbackHandlers = new Map();
  }

  /**
   * Get the current configuration (read-only, with token masked)
   */
  getConfig(): Readonly<Omit<TelegramBotConfig, "botToken">> & { botToken: string } {
    return {
      ...this.config,
      botToken: this.maskToken(this.config.botToken),
    };
  }

  /**
   * Mask bot token for safe display
   */
  private maskToken(token: string): string {
    if (!token || token.length < 10) return "****";
    const parts = token.split(":");
    if (parts.length !== 2) return "****";
    return `${parts[0]}:****`;
  }

  /**
   * Check if the client is in development mode
   */
  isDevMode(): boolean {
    return this.config.devMode;
  }

  /**
   * Get message statistics
   */
  getStats(): { sent: number; failed: number; total: number } {
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      total: this.sentCount + this.failedCount,
    };
  }

  /**
   * Reset message statistics
   */
  resetStats(): void {
    this.sentCount = 0;
    this.failedCount = 0;
  }

  /**
   * Subscribe to Telegram events
   */
  on(event: TelegramEventType, handler: TelegramEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Register a command handler
   * Command should be without the leading slash
   */
  onCommand(command: string, handler: TelegramCommandHandler): () => void {
    const normalizedCommand = command.toLowerCase().replace(/^\//, "");
    this.commandHandlers.set(normalizedCommand, handler);

    return () => {
      this.commandHandlers.delete(normalizedCommand);
    };
  }

  /**
   * Register a callback query handler
   */
  onCallback(pattern: string, handler: TelegramCallbackHandler): () => void {
    this.callbackHandlers.set(pattern, handler);

    return () => {
      this.callbackHandlers.delete(pattern);
    };
  }

  /**
   * Emit an event to all subscribed handlers
   */
  private async emitEvent(event: TelegramEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in Telegram event handler for ${event.type}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<TelegramUser> {
    if (this.config.devMode) {
      return {
        id: 123456789,
        is_bot: true,
        first_name: "Test Bot",
        username: "test_bot",
      };
    }

    const response = await this.callApi<TelegramUser>("getMe");
    return response;
  }

  /**
   * Send a message
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramSendResult> {
    // Validate chat ID
    if (!isValidChatId(message.chatId)) {
      throw new TelegramClientError(
        `Invalid chat ID: ${message.chatId}`,
        "INVALID_CHAT_ID"
      );
    }

    // Validate message text
    if (!message.text || message.text.trim() === "") {
      throw new TelegramClientError("Message text is required", "EMPTY_MESSAGE");
    }

    // Emit sending event
    await this.emitEvent({
      type: "message:sending",
      timestamp: new Date(),
      chatId: message.chatId,
      text: message.text.substring(0, 100),
    });

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    // Handle development mode
    if (this.config.devMode) {
      return this.handleDevModeSend(message);
    }

    // Send via Telegram API with retries
    return this.sendWithRetry(message);
  }

  /**
   * Send multiple messages in batches
   */
  async sendBatch(
    messages: TelegramMessage[],
    options: TelegramBatchOptions = {}
  ): Promise<TelegramBatchResult> {
    const { batchSize = 10, batchDelay = 100, stopOnError = false } = options;

    const result: TelegramBatchResult = {
      total: messages.length,
      sent: 0,
      failed: 0,
      results: [],
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      // Send batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((msg) => this.sendMessage(msg))
      );

      // Process results
      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j]!;
        const message = batch[j]!;

        if (batchResult.status === "fulfilled") {
          result.results.push(batchResult.value);
          if (batchResult.value.status === TelegramMessageStatus.SENT) {
            result.sent++;
          } else {
            result.failed++;
            result.errors.push({
              chatId: message.chatId,
              error: batchResult.value.error || "Unknown error",
            });
          }
        } else {
          result.failed++;
          result.errors.push({
            chatId: message.chatId,
            error:
              (batchResult as PromiseRejectedResult).reason?.message || "Unknown error",
          });

          if (stopOnError) {
            return result;
          }
        }
      }

      // Delay between batches
      if (i + batchSize < messages.length && batchDelay > 0) {
        await this.sleep(batchDelay);
      }
    }

    return result;
  }

  /**
   * Set bot commands (shown in Telegram menu)
   */
  async setCommands(commands: TelegramBotCommand[]): Promise<boolean> {
    if (this.config.devMode) {
      console.log("[TELEGRAM DEV MODE] Would set commands:", commands);
      return true;
    }

    try {
      await this.callApi("setMyCommands", {
        commands: commands.map((cmd) => ({
          command: cmd.command.replace(/^\//, ""),
          description: cmd.description,
        })),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all bot commands
   */
  async deleteCommands(): Promise<boolean> {
    if (this.config.devMode) {
      console.log("[TELEGRAM DEV MODE] Would delete commands");
      return true;
    }

    try {
      await this.callApi("deleteMyCommands");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Answer callback query (acknowledge inline button press)
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options: { text?: string; showAlert?: boolean; cacheTime?: number } = {}
  ): Promise<boolean> {
    if (this.config.devMode) {
      console.log("[TELEGRAM DEV MODE] Would answer callback query:", callbackQueryId);
      return true;
    }

    try {
      await this.callApi("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text: options.text,
        show_alert: options.showAlert,
        cache_time: options.cacheTime,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start polling for updates
   */
  async startPolling(): Promise<void> {
    if (this.pollingActive) {
      return;
    }

    this.pollingActive = true;

    await this.emitEvent({
      type: "bot:started",
      timestamp: new Date(),
    });

    if (this.config.devMode) {
      console.log("[TELEGRAM DEV MODE] Polling started (simulated)");
      return;
    }

    // Start polling loop
    this.pollLoop();
  }

  /**
   * Stop polling for updates
   */
  async stopPolling(): Promise<void> {
    this.pollingActive = false;

    await this.emitEvent({
      type: "bot:stopped",
      timestamp: new Date(),
    });

    if (this.config.devMode) {
      console.log("[TELEGRAM DEV MODE] Polling stopped (simulated)");
    }
  }

  /**
   * Check if polling is active
   */
  isPolling(): boolean {
    return this.pollingActive;
  }

  /**
   * Polling loop for updates
   */
  private async pollLoop(): Promise<void> {
    while (this.pollingActive) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error("Error in Telegram polling loop:", error);
        // Wait before retrying on error
        await this.sleep(5000);
      }
    }
  }

  /**
   * Get updates from Telegram API
   */
  private async getUpdates(): Promise<TelegramUpdate[]> {
    const response = await this.callApi<TelegramUpdate[]>("getUpdates", {
      offset: this.pollingOffset,
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    });

    if (response.length > 0) {
      // Update offset to last update ID + 1
      this.pollingOffset = response[response.length - 1]!.update_id + 1;
    }

    return response;
  }

  /**
   * Handle incoming update
   */
  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: TelegramApiMessage): Promise<void> {
    // Check if it's a command
    if (message.text?.startsWith("/")) {
      const parts = message.text.slice(1).split(/\s+/);
      const command = parts[0]?.toLowerCase().split("@")[0]; // Remove bot username if present
      const args = parts.slice(1);

      if (command) {
        await this.emitEvent({
          type: "command:received",
          timestamp: new Date(),
          chatId: message.chat.id,
          command,
          metadata: { args },
        });

        const handler = this.commandHandlers.get(command);
        if (handler) {
          try {
            await handler(message.chat.id, args, message);
          } catch (error) {
            console.error(`Error handling command /${command}:`, error);
          }
        }
      }
    }
  }

  /**
   * Handle callback query
   */
  private async handleCallbackQuery(
    query: import("./types").TelegramCallbackQuery
  ): Promise<void> {
    await this.emitEvent({
      type: "callback:received",
      timestamp: new Date(),
      chatId: query.message?.chat.id,
      callbackData: query.data,
    });

    // Find matching handler
    for (const [pattern, handler] of this.callbackHandlers) {
      if (query.data?.startsWith(pattern)) {
        try {
          await handler(query);
        } catch (error) {
          console.error(`Error handling callback ${pattern}:`, error);
        }
        break;
      }
    }
  }

  /**
   * Handle sending in development mode
   */
  private async handleDevModeSend(
    message: TelegramMessage
  ): Promise<TelegramSendResult> {
    const messageId = Math.floor(Math.random() * 1000000);

    console.log("[TELEGRAM DEV MODE] Would send message:", {
      messageId,
      chatId: formatChatId(message.chatId),
      text: message.text.substring(0, 100) + (message.text.length > 100 ? "..." : ""),
      parseMode: message.options?.parseMode || this.config.defaultParseMode,
      hasKeyboard: !!message.options?.inlineKeyboard,
    });

    const result: TelegramSendResult = {
      messageId,
      status: TelegramMessageStatus.SENT,
      timestamp: new Date(),
      chatId: message.chatId,
    };

    this.sentCount++;

    await this.emitEvent({
      type: "message:sent",
      timestamp: result.timestamp,
      messageId: result.messageId,
      chatId: message.chatId,
      text: message.text.substring(0, 100),
    });

    return result;
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry(message: TelegramMessage): Promise<TelegramSendResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.sendViaTelegramApi(message);
        this.sentCount++;

        await this.emitEvent({
          type: "message:sent",
          timestamp: result.timestamp,
          messageId: result.messageId,
          chatId: message.chatId,
          text: message.text.substring(0, 100),
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof TelegramClientError
            ? error.retryable
            : this.isRetryableError(error);

        if (!isRetryable || attempt === this.config.maxRetries - 1) {
          break;
        }

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    // All retries failed
    this.failedCount++;

    const failedResult: TelegramSendResult = {
      messageId: 0,
      status: TelegramMessageStatus.FAILED,
      timestamp: new Date(),
      chatId: message.chatId,
      error: lastError?.message || "Unknown error",
    };

    await this.emitEvent({
      type: "message:failed",
      timestamp: failedResult.timestamp,
      chatId: message.chatId,
      text: message.text.substring(0, 100),
      error: failedResult.error,
    });

    return failedResult;
  }

  /**
   * Send message via Telegram API
   */
  private async sendViaTelegramApi(
    message: TelegramMessage
  ): Promise<TelegramSendResult> {
    const payload: Record<string, unknown> = {
      chat_id: message.chatId,
      text: message.text,
      parse_mode: message.options?.parseMode || this.config.defaultParseMode,
    };

    if (message.options?.disableWebPagePreview) {
      payload.disable_web_page_preview = true;
    }

    if (message.options?.disableNotification) {
      payload.disable_notification = true;
    }

    if (message.options?.replyToMessageId) {
      payload.reply_to_message_id = message.options.replyToMessageId;
    }

    if (message.options?.protectContent) {
      payload.protect_content = true;
    }

    if (message.options?.inlineKeyboard) {
      payload.reply_markup = {
        inline_keyboard: message.options.inlineKeyboard.buttons.map((row) =>
          row.map((btn) => ({
            text: btn.text,
            url: btn.url,
            callback_data: btn.callbackData,
          }))
        ),
      };
    }

    const apiMessage = await this.callApi<TelegramApiMessage>("sendMessage", payload);

    return {
      messageId: apiMessage.message_id,
      status: TelegramMessageStatus.SENT,
      timestamp: new Date(apiMessage.date * 1000),
      chatId: message.chatId,
    };
  }

  /**
   * Make API call to Telegram
   */
  private async callApi<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.config.baseUrl}/bot${this.config.botToken}/${method}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: params ? JSON.stringify(params) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as TelegramApiResponse<T>;

      if (!data.ok) {
        const errorCode = data.error_code || response.status;
        const errorMessage = data.description || "Unknown Telegram API error";

        throw new TelegramClientError(errorMessage, `TELEGRAM_API_${errorCode}`, {
          statusCode: errorCode,
          retryable: this.isRetryableStatusCode(errorCode),
        });
      }

      return data.result as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof TelegramClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TelegramClientError("Request timeout", "TIMEOUT", {
          retryable: true,
        });
      }

      throw new TelegramClientError(
        `API call failed: ${error instanceof Error ? error.message : String(error)}`,
        "API_CALL_FAILED",
        {
          retryable: true,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatusCode(statusCode: number): boolean {
    // Retry on server errors and rate limiting
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TelegramClientError) {
      return error.retryable;
    }

    // Network errors are retryable
    if (error instanceof Error) {
      const retryableMessages = [
        "network",
        "timeout",
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "rate limit",
        "429",
        "500",
        "502",
        "503",
        "504",
      ];

      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton Telegram client instance
 */
let telegramClientInstance: TelegramClient | null = null;

/**
 * Get or create the Telegram client singleton
 */
export function getTelegramClient(): TelegramClient {
  if (!telegramClientInstance) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    telegramClientInstance = new TelegramClient({
      botToken,
      devMode: !botToken || process.env.NODE_ENV !== "production",
    });
  }

  return telegramClientInstance;
}

/**
 * Create a new Telegram client instance
 */
export function createTelegramClient(config: TelegramBotConfig): TelegramClient {
  return new TelegramClient(config);
}

/**
 * Reset the singleton Telegram client (useful for testing)
 */
export function resetTelegramClient(): void {
  telegramClientInstance = null;
}
