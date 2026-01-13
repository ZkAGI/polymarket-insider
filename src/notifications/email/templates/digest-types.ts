/**
 * Type definitions for daily digest email templates
 */

import { AlertSeverity, AlertType } from './types';

/**
 * Alert summary for digest
 */
export interface DigestAlertSummary {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** When the alert occurred */
  timestamp: Date;
  /** Associated wallet address */
  walletAddress?: string;
  /** Associated market title */
  marketTitle?: string;
}

/**
 * Suspicious wallet summary for digest
 */
export interface DigestWalletSummary {
  /** Wallet address */
  address: string;
  /** Suspicion score (0-100) */
  score: number;
  /** Number of alerts triggered */
  alertCount: number;
  /** Total trading volume */
  volume?: number;
  /** Number of trades */
  tradeCount?: number;
  /** Whether this is a fresh wallet */
  isFresh?: boolean;
  /** Labels/tags */
  labels?: string[];
}

/**
 * Hot market summary for digest
 */
export interface DigestMarketSummary {
  /** Market ID */
  id: string;
  /** Market title/question */
  title: string;
  /** Number of alerts */
  alertCount: number;
  /** Current probability (0-100) */
  probability?: number;
  /** 24h probability change */
  probabilityChange?: number;
  /** 24h volume */
  volume?: number;
  /** Market category */
  category?: string;
}

/**
 * Alert counts by severity
 */
export interface DigestAlertCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/**
 * Alert counts by type
 */
export interface DigestAlertsByType {
  whale_trade: number;
  price_movement: number;
  insider_activity: number;
  fresh_wallet: number;
  wallet_reactivation: number;
  coordinated_activity: number;
  unusual_pattern: number;
  market_resolved: number;
  new_market: number;
  suspicious_funding: number;
  sanctioned_activity: number;
  system: number;
}

/**
 * Trading activity statistics
 */
export interface DigestTradingStats {
  /** Total trading volume in USD */
  totalVolume: number;
  /** Number of whale trades (above threshold) */
  whaleTradeCount: number;
  /** Number of unique traders */
  uniqueTraders: number;
  /** Average trade size */
  averageTradeSize: number;
  /** Largest single trade */
  largestTrade: number;
  /** Total number of trades */
  totalTrades: number;
}

/**
 * Period comparison data
 */
export interface DigestPeriodComparison {
  /** Alert count change percentage */
  alertChange: number;
  /** Volume change percentage */
  volumeChange: number;
  /** Whale activity change percentage */
  whaleActivityChange: number;
  /** New suspicious wallets */
  newSuspiciousWallets: number;
}

/**
 * Highlighted event for the digest
 */
export interface DigestHighlight {
  /** Type of highlight */
  type: 'critical_alert' | 'whale_trade' | 'insider_signal' | 'market_resolved' | 'new_pattern';
  /** Title of the highlight */
  title: string;
  /** Description */
  description: string;
  /** Associated URL */
  url?: string;
  /** Time of the event */
  timestamp: Date;
}

/**
 * Complete daily digest data
 */
export interface DailyDigestData {
  /** Digest identifier */
  digestId: string;
  /** Recipient name for personalization */
  recipientName?: string;
  /** The date this digest covers */
  digestDate: Date;
  /** When the digest was generated */
  generatedAt: Date;
  /** Alert counts by severity */
  alertCounts: DigestAlertCounts;
  /** Alert counts by type */
  alertsByType: Partial<DigestAlertsByType>;
  /** Recent alerts (limited list for email) */
  recentAlerts: DigestAlertSummary[];
  /** Top suspicious wallets */
  topSuspiciousWallets: DigestWalletSummary[];
  /** Hot markets with activity */
  hotMarkets: DigestMarketSummary[];
  /** Trading statistics */
  tradingStats: DigestTradingStats;
  /** Comparison with previous period */
  comparison?: DigestPeriodComparison;
  /** Key highlights of the day */
  highlights?: DigestHighlight[];
  /** URL to the dashboard */
  dashboardUrl?: string;
  /** Base URL for links */
  baseUrl?: string;
  /** Unsubscribe URL */
  unsubscribeUrl?: string;
  /** User's timezone */
  timezone?: string;
}

/**
 * Digest email rendering options
 */
export interface DigestEmailOptions {
  /** Include plain text version */
  includePlainText?: boolean;
  /** Custom CSS styles to inject */
  customStyles?: string;
  /** Show footer with unsubscribe link */
  showFooter?: boolean;
  /** Show Polymarket Tracker branding */
  showBranding?: boolean;
  /** Locale for formatting */
  locale?: string;
  /** Timezone for date display */
  timezone?: string;
  /** Maximum alerts to show */
  maxAlerts?: number;
  /** Maximum wallets to show */
  maxWallets?: number;
  /** Maximum markets to show */
  maxMarkets?: number;
  /** Show comparison with previous period */
  showComparison?: boolean;
  /** Show trading statistics */
  showTradingStats?: boolean;
  /** Show highlights section */
  showHighlights?: boolean;
}

/**
 * Default options for digest rendering
 */
export const DEFAULT_DIGEST_OPTIONS: DigestEmailOptions = {
  includePlainText: true,
  showFooter: true,
  showBranding: true,
  locale: 'en-US',
  timezone: 'UTC',
  maxAlerts: 10,
  maxWallets: 5,
  maxMarkets: 5,
  showComparison: true,
  showTradingStats: true,
  showHighlights: true,
};

/**
 * Digest schedule configuration
 */
export interface DigestScheduleConfig {
  /** Whether digest is enabled */
  enabled: boolean;
  /** Hour of day to send (0-23) */
  sendHour: number;
  /** Minute of hour to send (0-59) */
  sendMinute: number;
  /** User's timezone */
  timezone: string;
  /** Days of week to send (0=Sunday, 6=Saturday) */
  daysOfWeek: number[];
  /** Email address to send to */
  recipientEmail: string;
  /** Recipient name */
  recipientName?: string;
}

/**
 * Default schedule configuration
 */
export const DEFAULT_SCHEDULE_CONFIG: Omit<DigestScheduleConfig, 'recipientEmail'> = {
  enabled: true,
  sendHour: 8,
  sendMinute: 0,
  timezone: 'UTC',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every day
};
