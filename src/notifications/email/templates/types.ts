/**
 * Type definitions for email templates
 */

/**
 * Alert severity levels for email styling
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Alert types for categorization
 */
export type AlertType =
  | 'whale_trade'
  | 'price_movement'
  | 'insider_activity'
  | 'fresh_wallet'
  | 'wallet_reactivation'
  | 'coordinated_activity'
  | 'unusual_pattern'
  | 'market_resolved'
  | 'new_market'
  | 'suspicious_funding'
  | 'sanctioned_activity'
  | 'system';

/**
 * Data structure for alert email template
 */
export interface AlertTemplateData {
  /** Unique alert identifier */
  alertId: string;
  /** Type of alert */
  alertType: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert title/headline */
  title: string;
  /** Detailed alert message */
  message: string;
  /** When the alert was generated */
  timestamp: Date;
  /** Associated wallet address (optional) */
  walletAddress?: string;
  /** Associated market ID (optional) */
  marketId?: string;
  /** Associated market title (optional) */
  marketTitle?: string;
  /** Trade/transaction size in USD (optional) */
  tradeSize?: number;
  /** Probability/price change percentage (optional) */
  priceChange?: number;
  /** Suspicion score if applicable (optional) */
  suspicionScore?: number;
  /** URL to view alert details */
  actionUrl?: string;
  /** URL to the dashboard */
  dashboardUrl?: string;
  /** Base URL for the application */
  baseUrl?: string;
  /** Recipient name for personalization */
  recipientName?: string;
  /** Unsubscribe URL */
  unsubscribeUrl?: string;
  /** Additional metadata key-value pairs */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Alert email rendering options
 */
export interface AlertEmailOptions {
  /** Include plain text version */
  includePlainText?: boolean;
  /** Custom CSS styles to inject */
  customStyles?: string;
  /** Show footer with unsubscribe link */
  showFooter?: boolean;
  /** Show Polymarket Tracker branding */
  showBranding?: boolean;
  /** Locale for date formatting */
  locale?: string;
  /** Timezone for date display */
  timezone?: string;
}

/**
 * Rendered email template result
 */
export interface RenderedEmail {
  /** HTML version of the email */
  html: string;
  /** Plain text version of the email */
  text: string;
  /** Email subject line */
  subject: string;
}

/**
 * Color configuration for severity levels
 */
export interface SeverityColors {
  background: string;
  text: string;
  border: string;
  icon: string;
}

/**
 * Alert type display configuration
 */
export interface AlertTypeConfig {
  label: string;
  icon: string;
  description: string;
}
