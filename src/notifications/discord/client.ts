/**
 * Discord webhook client for the Polymarket Tracker
 * Provides functionality for sending messages via Discord webhooks
 */

import {
  DiscordWebhookConfig,
  DiscordMessage,
  DiscordSendResult,
  DiscordMessageStatus,
  DiscordRateLimitInfo,
  DiscordEventType,
  DiscordEvent,
  DiscordEventHandler,
  DiscordBatchOptions,
  DiscordBatchResult,
  DiscordWebhookInfo,
  isValidWebhookUrl,
  maskWebhookUrl,
  generateResultId,
  isValidMessageContent,
  isValidEmbedTotal,
} from "./types";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<DiscordWebhookConfig> = {
  devMode: process.env.NODE_ENV !== "production",
  rateLimit: 5, // Discord webhooks allow ~5 requests per 2 seconds per webhook
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  enableThreads: false,
};

/**
 * Discord client error
 */
export class DiscordClientError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    code: string,
    options: {
      statusCode?: number;
      retryable?: boolean;
      retryAfter?: number;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = "DiscordClientError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Rate limiter for Discord API calls
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
 * Discord webhook client for sending messages
 */
export class DiscordClient {
  private readonly config: Required<DiscordWebhookConfig>;
  private readonly rateLimiter: RateLimiter;
  private readonly eventHandlers: Map<DiscordEventType, Set<DiscordEventHandler>>;
  private sentCount: number = 0;
  private failedCount: number = 0;
  private connected: boolean = false;
  private lastRateLimitInfo: DiscordRateLimitInfo | null = null;

  constructor(config: DiscordWebhookConfig) {
    // Determine dev mode first (before URL validation)
    const isDevMode = config.devMode ?? DEFAULT_CONFIG.devMode!;

    // Validate webhook URL - required in production mode, optional in dev mode
    if (!config.webhookUrl && !isDevMode) {
      throw new DiscordClientError("Webhook URL is required", "MISSING_WEBHOOK_URL");
    }

    if (config.webhookUrl && !isDevMode && !isValidWebhookUrl(config.webhookUrl)) {
      throw new DiscordClientError(
        "Invalid webhook URL format",
        "INVALID_WEBHOOK_URL"
      );
    }

    // Merge with defaults
    this.config = {
      webhookUrl: config.webhookUrl || "",
      username: config.username || "Polymarket Tracker",
      avatarUrl: config.avatarUrl || "",
      devMode: isDevMode,
      rateLimit: config.rateLimit ?? DEFAULT_CONFIG.rateLimit!,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries!,
      retryDelay: config.retryDelay ?? DEFAULT_CONFIG.retryDelay!,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout!,
      enableThreads: config.enableThreads ?? DEFAULT_CONFIG.enableThreads!,
    };

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.config.rateLimit);

    // Initialize handlers
    this.eventHandlers = new Map();
  }

  /**
   * Get the current configuration (read-only, with URL masked)
   */
  getConfig(): Readonly<Omit<DiscordWebhookConfig, "webhookUrl">> & {
    webhookUrl: string;
  } {
    return {
      ...this.config,
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
    };
  }

  /**
   * Check if the client is in development mode
   */
  isDevMode(): boolean {
    return this.config.devMode;
  }

  /**
   * Check if webhook is connected (verified)
   */
  isConnected(): boolean {
    return this.connected;
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
   * Get the last rate limit info
   */
  getRateLimitInfo(): DiscordRateLimitInfo | null {
    return this.lastRateLimitInfo;
  }

  /**
   * Subscribe to Discord events
   */
  on(event: DiscordEventType, handler: DiscordEventHandler): () => void {
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
   * Emit an event to all subscribed handlers
   */
  private async emitEvent(event: DiscordEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in Discord event handler for ${event.type}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Test webhook connection by fetching webhook info
   */
  async testConnection(): Promise<DiscordWebhookInfo | null> {
    if (this.config.devMode) {
      console.log("[DISCORD DEV MODE] Would test webhook connection");
      this.connected = true;

      await this.emitEvent({
        type: "webhook:connected",
        timestamp: new Date(),
        webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      });

      return {
        id: "123456789",
        type: 1,
        channel_id: "987654321",
        name: "Polymarket Tracker (Dev)",
        token: "****",
      };
    }

    try {
      const webhookInfo = await this.getWebhookInfo();
      this.connected = true;

      await this.emitEvent({
        type: "webhook:connected",
        timestamp: new Date(),
        webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      });

      return webhookInfo;
    } catch (error) {
      this.connected = false;

      await this.emitEvent({
        type: "webhook:error",
        timestamp: new Date(),
        webhookUrl: maskWebhookUrl(this.config.webhookUrl),
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  /**
   * Get webhook information from Discord API
   */
  async getWebhookInfo(): Promise<DiscordWebhookInfo> {
    if (this.config.devMode) {
      return {
        id: "123456789",
        type: 1,
        channel_id: "987654321",
        name: "Polymarket Tracker (Dev)",
        token: "****",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new DiscordClientError(
          `Failed to get webhook info: ${response.status} ${response.statusText}`,
          `DISCORD_API_${response.status}`,
          {
            statusCode: response.status,
            retryable: response.status >= 500,
          }
        );
      }

      const data = (await response.json()) as DiscordWebhookInfo;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DiscordClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new DiscordClientError("Request timeout", "TIMEOUT", {
          retryable: true,
        });
      }

      throw new DiscordClientError(
        `Failed to get webhook info: ${error instanceof Error ? error.message : String(error)}`,
        "API_CALL_FAILED",
        {
          retryable: true,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Send a message via the webhook
   */
  async sendMessage(message: DiscordMessage): Promise<DiscordSendResult> {
    const resultId = generateResultId();

    // Validate message content
    if (message.content && !isValidMessageContent(message.content)) {
      throw new DiscordClientError(
        "Message content exceeds 2000 characters",
        "CONTENT_TOO_LONG"
      );
    }

    // Validate embeds
    if (message.embeds) {
      if (message.embeds.length > 10) {
        throw new DiscordClientError(
          "Maximum 10 embeds allowed per message",
          "TOO_MANY_EMBEDS"
        );
      }

      if (!isValidEmbedTotal(message.embeds)) {
        throw new DiscordClientError(
          "Total embed characters exceed 6000",
          "EMBEDS_TOO_LONG"
        );
      }
    }

    // Must have content or embeds
    if (!message.content && (!message.embeds || message.embeds.length === 0)) {
      throw new DiscordClientError(
        "Message must have content or embeds",
        "EMPTY_MESSAGE"
      );
    }

    // Emit sending event
    await this.emitEvent({
      type: "message:sending",
      timestamp: new Date(),
      resultId,
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
    });

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    // Handle development mode
    if (this.config.devMode) {
      return this.handleDevModeSend(message, resultId);
    }

    // Send via Discord webhook with retries
    return this.sendWithRetry(message, resultId);
  }

  /**
   * Send multiple messages in batches
   */
  async sendBatch(
    messages: DiscordMessage[],
    options: DiscordBatchOptions = {}
  ): Promise<DiscordBatchResult> {
    const { batchSize = 5, batchDelay = 500, stopOnError = false } = options;

    const result: DiscordBatchResult = {
      total: messages.length,
      sent: 0,
      failed: 0,
      results: [],
      errors: [],
    };

    // Process in batches
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      // Send batch sequentially (Discord rate limits are strict)
      for (let j = 0; j < batch.length; j++) {
        const message = batch[j]!;
        const absoluteIndex = i + j;

        try {
          const sendResult = await this.sendMessage(message);
          result.results.push(sendResult);

          if (sendResult.status === DiscordMessageStatus.SENT) {
            result.sent++;
          } else {
            result.failed++;
            result.errors.push({
              index: absoluteIndex,
              error: sendResult.error || "Unknown error",
            });

            if (stopOnError) {
              return result;
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            index: absoluteIndex,
            error: error instanceof Error ? error.message : String(error),
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
   * Handle sending in development mode
   */
  private async handleDevModeSend(
    message: DiscordMessage,
    resultId: string
  ): Promise<DiscordSendResult> {
    console.log("[DISCORD DEV MODE] Would send message:", {
      resultId,
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      username: message.username || this.config.username,
      hasContent: !!message.content,
      contentPreview: message.content?.substring(0, 100),
      embedCount: message.embeds?.length || 0,
      tts: message.tts || false,
    });

    const result: DiscordSendResult = {
      id: resultId,
      status: DiscordMessageStatus.SENT,
      timestamp: new Date(),
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
    };

    this.sentCount++;

    await this.emitEvent({
      type: "message:sent",
      timestamp: result.timestamp,
      resultId,
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
    });

    return result;
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry(
    message: DiscordMessage,
    resultId: string
  ): Promise<DiscordSendResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.sendViaWebhook(message, resultId);
        this.sentCount++;

        await this.emitEvent({
          type: "message:sent",
          timestamp: result.timestamp,
          resultId,
          webhookUrl: maskWebhookUrl(this.config.webhookUrl),
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof DiscordClientError
            ? error.retryable
            : this.isRetryableError(error);

        // Handle rate limiting
        if (
          error instanceof DiscordClientError &&
          error.code === "DISCORD_API_429"
        ) {
          const waitTime = error.retryAfter
            ? error.retryAfter * 1000
            : this.config.retryDelay * Math.pow(2, attempt);

          await this.emitEvent({
            type: "message:rate_limited",
            timestamp: new Date(),
            resultId,
            webhookUrl: maskWebhookUrl(this.config.webhookUrl),
            rateLimitInfo: this.lastRateLimitInfo || undefined,
          });

          await this.sleep(waitTime);
          continue;
        }

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

    const failedResult: DiscordSendResult = {
      id: resultId,
      status: DiscordMessageStatus.FAILED,
      timestamp: new Date(),
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      error: lastError?.message || "Unknown error",
    };

    await this.emitEvent({
      type: "message:failed",
      timestamp: failedResult.timestamp,
      resultId,
      webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      error: failedResult.error,
    });

    return failedResult;
  }

  /**
   * Send message via Discord webhook
   */
  private async sendViaWebhook(
    message: DiscordMessage,
    resultId: string
  ): Promise<DiscordSendResult> {
    const payload: DiscordMessage = {
      ...message,
      username: message.username || this.config.username,
      avatar_url: message.avatar_url || this.config.avatarUrl || undefined,
    };

    // Remove undefined values
    if (!payload.avatar_url) {
      delete payload.avatar_url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Use ?wait=true to get the message object back
      const url = `${this.config.webhookUrl}?wait=true`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse rate limit headers
      this.parseRateLimitHeaders(response.headers);

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("retry-after") || "5",
            10
          );

          throw new DiscordClientError(
            "Rate limited by Discord",
            "DISCORD_API_429",
            {
              statusCode: 429,
              retryable: true,
              retryAfter,
            }
          );
        }

        // Handle other errors
        let errorMessage = `Discord API error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (typeof errorData === "object" && errorData !== null) {
            const errorObj = errorData as { message?: string };
            if (errorObj.message) {
              errorMessage = errorObj.message;
            }
          }
        } catch {
          // Ignore JSON parse errors
        }

        throw new DiscordClientError(
          errorMessage,
          `DISCORD_API_${response.status}`,
          {
            statusCode: response.status,
            retryable: response.status >= 500,
          }
        );
      }

      return {
        id: resultId,
        status: DiscordMessageStatus.SENT,
        timestamp: new Date(),
        webhookUrl: maskWebhookUrl(this.config.webhookUrl),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DiscordClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new DiscordClientError("Request timeout", "TIMEOUT", {
          retryable: true,
        });
      }

      throw new DiscordClientError(
        `Webhook call failed: ${error instanceof Error ? error.message : String(error)}`,
        "WEBHOOK_CALL_FAILED",
        {
          retryable: true,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(headers: Headers): void {
    const limit = headers.get("x-ratelimit-limit");
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    const resetAfter = headers.get("x-ratelimit-reset-after");
    const bucket = headers.get("x-ratelimit-bucket");
    const global = headers.get("x-ratelimit-global");

    if (limit || remaining || reset) {
      this.lastRateLimitInfo = {
        limit: limit ? parseInt(limit, 10) : 0,
        remaining: remaining ? parseInt(remaining, 10) : 0,
        reset: reset ? parseFloat(reset) : 0,
        resetAfter: resetAfter ? parseFloat(resetAfter) : 0,
        bucket: bucket || "",
        global: global === "true",
      };
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof DiscordClientError) {
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
 * Singleton Discord client instance
 */
let discordClientInstance: DiscordClient | null = null;

/**
 * Get or create the Discord client singleton
 */
export function getDiscordClient(): DiscordClient {
  if (!discordClientInstance) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || "";

    discordClientInstance = new DiscordClient({
      webhookUrl,
      devMode: !webhookUrl || process.env.NODE_ENV !== "production",
    });
  }

  return discordClientInstance;
}

/**
 * Create a new Discord client instance
 */
export function createDiscordClient(config: DiscordWebhookConfig): DiscordClient {
  return new DiscordClient(config);
}

/**
 * Reset the singleton Discord client (useful for testing)
 */
export function resetDiscordClient(): void {
  discordClientInstance = null;
}
