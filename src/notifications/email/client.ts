/**
 * Email client for the Polymarket Tracker
 * Uses Resend as the email service provider
 */

import { Resend } from 'resend';
import {
  EmailClientConfig,
  EmailMessage,
  EmailSendResult,
  EmailStatus,
  EmailPriority,
  EmailEvent,
  EmailEventHandler,
  EmailEventType,
  BatchEmailOptions,
  BatchEmailResult,
  normalizeRecipients,
  extractEmails,
  isValidEmail,
  EmailRecipient,
} from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<EmailClientConfig> = {
  defaultFrom: 'noreply@polymarket-tracker.local',
  defaultFromName: 'Polymarket Tracker',
  devMode: process.env.NODE_ENV !== 'production',
  rateLimit: 10,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Email client error
 */
export class EmailClientError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options: { statusCode?: number; retryable?: boolean; cause?: Error } = {}
  ) {
    super(message);
    this.name = 'EmailClientError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Rate limiter for email sending
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Email client for sending emails via Resend
 */
export class EmailClient {
  private readonly config: Required<EmailClientConfig>;
  private readonly resend: Resend | null;
  private readonly rateLimiter: RateLimiter;
  private readonly eventHandlers: Map<EmailEventType, Set<EmailEventHandler>>;
  private sentCount: number = 0;
  private failedCount: number = 0;

  constructor(config: EmailClientConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      defaultFrom: config.defaultFrom ?? DEFAULT_CONFIG.defaultFrom!,
      defaultFromName: config.defaultFromName ?? DEFAULT_CONFIG.defaultFromName!,
      defaultReplyTo: config.defaultReplyTo ?? '',
      devMode: config.devMode ?? DEFAULT_CONFIG.devMode!,
      rateLimit: config.rateLimit ?? DEFAULT_CONFIG.rateLimit!,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries!,
      retryDelay: config.retryDelay ?? DEFAULT_CONFIG.retryDelay!,
    };

    // Initialize Resend client (null in dev mode without API key)
    if (this.config.apiKey && !this.config.devMode) {
      this.resend = new Resend(this.config.apiKey);
    } else {
      this.resend = null;
    }

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.config.rateLimit);

    // Initialize event handlers
    this.eventHandlers = new Map();
  }

  /**
   * Get the current configuration (read-only)
   */
  getConfig(): Readonly<EmailClientConfig> {
    return { ...this.config };
  }

  /**
   * Check if the client is in development mode
   */
  isDevMode(): boolean {
    return this.config.devMode;
  }

  /**
   * Get email statistics
   */
  getStats(): { sent: number; failed: number; total: number } {
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      total: this.sentCount + this.failedCount,
    };
  }

  /**
   * Reset email statistics
   */
  resetStats(): void {
    this.sentCount = 0;
    this.failedCount = 0;
  }

  /**
   * Subscribe to email events
   */
  on(event: EmailEventType, handler: EmailEventHandler): () => void {
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
  private async emitEvent(event: EmailEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async handler => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in email event handler for ${event.type}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Send a single email
   */
  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Validate message
    this.validateMessage(message);

    // Normalize recipients
    const toRecipients = normalizeRecipients(message.to);
    const recipientEmails = extractEmails(toRecipients);

    // Emit sending event
    await this.emitEvent({
      type: 'email:sending',
      timestamp: new Date(),
      recipients: recipientEmails,
      subject: message.subject,
    });

    // Acquire rate limit token
    await this.rateLimiter.acquire();

    // Handle development mode
    if (this.config.devMode || !this.resend) {
      return this.handleDevModeSend(message, recipientEmails);
    }

    // Send via Resend with retries
    return this.sendWithRetry(message, toRecipients, recipientEmails);
  }

  /**
   * Send multiple emails in batches
   */
  async sendBatch(
    messages: EmailMessage[],
    options: BatchEmailOptions = {}
  ): Promise<BatchEmailResult> {
    const { batchSize = 10, batchDelay = 100, stopOnError = false } = options;

    const result: BatchEmailResult = {
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
      const batchResults = await Promise.allSettled(batch.map(msg => this.send(msg)));

      // Process results
      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j]!;
        const message = batch[j]!;
        const recipients = extractEmails(normalizeRecipients(message.to));

        if (batchResult.status === 'fulfilled') {
          result.results.push(batchResult.value);
          if (batchResult.value.status === EmailStatus.SENT) {
            result.sent++;
          } else {
            result.failed++;
            result.errors.push({
              recipient: recipients.join(', '),
              error: batchResult.value.error || 'Unknown error',
            });
          }
        } else {
          result.failed++;
          result.errors.push({
            recipient: recipients.join(', '),
            error: (batchResult as PromiseRejectedResult).reason?.message || 'Unknown error',
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
   * Validate email message
   */
  private validateMessage(message: EmailMessage): void {
    if (!message.to) {
      throw new EmailClientError('Recipient (to) is required', 'INVALID_RECIPIENT');
    }

    const recipients = normalizeRecipients(message.to);
    if (recipients.length === 0) {
      throw new EmailClientError('At least one recipient is required', 'INVALID_RECIPIENT');
    }

    // Validate all recipient emails
    for (const recipient of recipients) {
      if (!isValidEmail(recipient.email)) {
        throw new EmailClientError(
          `Invalid email address: ${recipient.email}`,
          'INVALID_EMAIL_FORMAT'
        );
      }
    }

    if (!message.subject || message.subject.trim() === '') {
      throw new EmailClientError('Subject is required', 'INVALID_SUBJECT');
    }

    if (!message.html && !message.text) {
      throw new EmailClientError(
        'Either html or text content is required',
        'INVALID_CONTENT'
      );
    }
  }

  /**
   * Handle sending in development mode (logs instead of actual sending)
   */
  private async handleDevModeSend(
    message: EmailMessage,
    recipientEmails: string[]
  ): Promise<EmailSendResult> {
    const emailId = `dev_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log('[EMAIL DEV MODE] Would send email:', {
      id: emailId,
      to: recipientEmails,
      from: this.getFromAddress(message),
      subject: message.subject,
      hasHtml: !!message.html,
      hasText: !!message.text,
      priority: message.priority || EmailPriority.NORMAL,
    });

    const result: EmailSendResult = {
      id: emailId,
      status: EmailStatus.SENT,
      timestamp: new Date(),
      recipients: recipientEmails,
    };

    this.sentCount++;

    await this.emitEvent({
      type: 'email:sent',
      timestamp: result.timestamp,
      emailId: result.id,
      recipients: recipientEmails,
      subject: message.subject,
    });

    return result;
  }

  /**
   * Send email with retry logic
   */
  private async sendWithRetry(
    message: EmailMessage,
    toRecipients: EmailRecipient[],
    recipientEmails: string[]
  ): Promise<EmailSendResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.sendViaResend(message, toRecipients, recipientEmails);
        this.sentCount++;

        await this.emitEvent({
          type: 'email:sent',
          timestamp: result.timestamp,
          emailId: result.id,
          recipients: recipientEmails,
          subject: message.subject,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable =
          error instanceof EmailClientError
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

    const failedResult: EmailSendResult = {
      id: `failed_${Date.now()}`,
      status: EmailStatus.FAILED,
      timestamp: new Date(),
      recipients: recipientEmails,
      error: lastError?.message || 'Unknown error',
    };

    await this.emitEvent({
      type: 'email:failed',
      timestamp: failedResult.timestamp,
      emailId: failedResult.id,
      recipients: recipientEmails,
      subject: message.subject,
      error: failedResult.error,
    });

    return failedResult;
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(
    message: EmailMessage,
    _toRecipients: EmailRecipient[],
    recipientEmails: string[]
  ): Promise<EmailSendResult> {
    if (!this.resend) {
      throw new EmailClientError(
        'Resend client not initialized',
        'CLIENT_NOT_INITIALIZED'
      );
    }

    try {
      // Build the email payload
      const payload = {
        from: this.getFromAddress(message),
        to: recipientEmails,
        subject: message.subject,
        html: message.html || undefined,
        text: message.text || undefined,
        replyTo: this.getReplyTo(message),
        cc: message.cc ? extractEmails(normalizeRecipients(message.cc)) : undefined,
        bcc: message.bcc ? extractEmails(normalizeRecipients(message.bcc)) : undefined,
        headers: message.headers,
        tags: message.tags
          ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
          : undefined,
      };

      // Use type assertion to handle Resend's strict types
      const response = await this.resend.emails.send(payload as Parameters<typeof this.resend.emails.send>[0]);

      if (response.error) {
        throw new EmailClientError(
          response.error.message,
          'RESEND_API_ERROR',
          { statusCode: 400, retryable: false }
        );
      }

      return {
        id: response.data?.id || `sent_${Date.now()}`,
        status: EmailStatus.SENT,
        timestamp: new Date(),
        recipients: recipientEmails,
      };
    } catch (error) {
      if (error instanceof EmailClientError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new EmailClientError(
        `Failed to send email: ${errorMessage}`,
        'SEND_FAILED',
        { retryable: this.isRetryableError(error), cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Get the from address for an email
   */
  private getFromAddress(message: EmailMessage): string {
    if (message.from) {
      if (typeof message.from === 'string') {
        return message.from;
      }
      return message.from.name
        ? `${message.from.name} <${message.from.email}>`
        : message.from.email;
    }

    return this.config.defaultFromName
      ? `${this.config.defaultFromName} <${this.config.defaultFrom}>`
      : this.config.defaultFrom;
  }

  /**
   * Get the reply-to address for an email
   */
  private getReplyTo(message: EmailMessage): string | undefined {
    if (message.replyTo) {
      if (typeof message.replyTo === 'string') {
        return message.replyTo;
      }
      return message.replyTo.email;
    }

    return this.config.defaultReplyTo || undefined;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof EmailClientError) {
      return error.retryable;
    }

    // Network errors are retryable
    if (error instanceof Error) {
      const retryableMessages = [
        'network',
        'timeout',
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'rate limit',
        '429',
        '500',
        '502',
        '503',
        '504',
      ];

      return retryableMessages.some(msg =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton email client instance
 */
let emailClientInstance: EmailClient | null = null;

/**
 * Get or create the email client singleton
 */
export function getEmailClient(): EmailClient {
  if (!emailClientInstance) {
    const apiKey = process.env.RESEND_API_KEY || '';
    const defaultFrom = process.env.EMAIL_FROM || 'noreply@polymarket-tracker.local';
    const defaultFromName = process.env.EMAIL_FROM_NAME || 'Polymarket Tracker';

    emailClientInstance = new EmailClient({
      apiKey,
      defaultFrom,
      defaultFromName,
      devMode: !apiKey || process.env.NODE_ENV !== 'production',
    });
  }

  return emailClientInstance;
}

/**
 * Create a new email client instance
 */
export function createEmailClient(config: EmailClientConfig): EmailClient {
  return new EmailClient(config);
}

/**
 * Reset the singleton email client (useful for testing)
 */
export function resetEmailClient(): void {
  emailClientInstance = null;
}
