/**
 * Email notification types for the Polymarket Tracker
 * Defines interfaces and types for email service integration
 */

/**
 * Email priority levels
 */
export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

/**
 * Email delivery status
 */
export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
}

/**
 * Email recipient configuration
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

/**
 * Email message configuration
 */
export interface EmailMessage {
  to: EmailRecipient | EmailRecipient[] | string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: EmailRecipient | string;
  replyTo?: EmailRecipient | string;
  cc?: EmailRecipient | EmailRecipient[] | string | string[];
  bcc?: EmailRecipient | EmailRecipient[] | string | string[];
  attachments?: EmailAttachment[];
  priority?: EmailPriority;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  id: string;
  status: EmailStatus;
  timestamp: Date;
  recipients: string[];
  error?: string;
}

/**
 * Email client configuration
 */
export interface EmailClientConfig {
  /** API key for the email service */
  apiKey: string;
  /** Default sender email address */
  defaultFrom?: string;
  /** Default sender name */
  defaultFromName?: string;
  /** Default reply-to email address */
  defaultReplyTo?: string;
  /** Whether to enable development mode (logs instead of sending) */
  devMode?: boolean;
  /** Rate limit (emails per second) */
  rateLimit?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Email service events
 */
export type EmailEventType =
  | 'email:sending'
  | 'email:sent'
  | 'email:delivered'
  | 'email:bounced'
  | 'email:failed'
  | 'email:rate_limited';

/**
 * Email event data
 */
export interface EmailEvent {
  type: EmailEventType;
  timestamp: Date;
  emailId?: string;
  recipients?: string[];
  subject?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Email event handler
 */
export type EmailEventHandler = (event: EmailEvent) => void | Promise<void>;

/**
 * Batch email options
 */
export interface BatchEmailOptions {
  /** Maximum emails per batch */
  batchSize?: number;
  /** Delay between batches in milliseconds */
  batchDelay?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
}

/**
 * Batch email result
 */
export interface BatchEmailResult {
  total: number;
  sent: number;
  failed: number;
  results: EmailSendResult[];
  errors: Array<{ recipient: string; error: string }>;
}

/**
 * Email template data for alerts
 */
export interface AlertEmailData {
  alertId: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  walletAddress?: string;
  marketId?: string;
  marketTitle?: string;
  timestamp: Date;
  actionUrl?: string;
}

/**
 * Email template data for daily digest
 */
export interface DigestEmailData {
  recipientName?: string;
  date: Date;
  totalAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  topSuspiciousWallets: Array<{
    address: string;
    score: number;
    alertCount: number;
  }>;
  hotMarkets: Array<{
    id: string;
    title: string;
    alertCount: number;
  }>;
  totalVolume: number;
  whaleTradeCount: number;
  dashboardUrl?: string;
}

/**
 * Helper type for normalizing recipient input
 */
export type RecipientInput = EmailRecipient | EmailRecipient[] | string | string[];

/**
 * Helper function type for normalizing recipients
 */
export function normalizeRecipients(input: RecipientInput): EmailRecipient[] {
  if (!input) return [];

  const inputs = Array.isArray(input) ? input : [input];

  return inputs.map(item => {
    if (typeof item === 'string') {
      return { email: item };
    }
    return item;
  });
}

/**
 * Extract email addresses from recipients
 */
export function extractEmails(recipients: EmailRecipient[]): string[] {
  return recipients.map(r => r.email);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format email recipient for display
 */
export function formatRecipient(recipient: EmailRecipient): string {
  if (recipient.name) {
    return `${recipient.name} <${recipient.email}>`;
  }
  return recipient.email;
}
