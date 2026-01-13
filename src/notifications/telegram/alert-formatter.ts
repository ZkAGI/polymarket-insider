/**
 * Telegram Alert Message Formatter
 * Formats alert notifications for Telegram using HTML/Markdown formatting
 */

import {
  TelegramMessage,
  TelegramInlineKeyboard,
  TelegramParseMode,
  escapeHtml,
} from "./types";

/**
 * Alert severity levels
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Alert types for categorization
 */
export type AlertType =
  | "whale_trade"
  | "price_movement"
  | "insider_activity"
  | "fresh_wallet"
  | "wallet_reactivation"
  | "coordinated_activity"
  | "unusual_pattern"
  | "market_resolved"
  | "new_market"
  | "suspicious_funding"
  | "sanctioned_activity"
  | "system";

/**
 * Alert data structure for Telegram formatting
 */
export interface TelegramAlertData {
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
  /** Additional metadata key-value pairs */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Telegram alert formatting options
 */
export interface TelegramAlertOptions {
  /** Parse mode for the message (HTML recommended for better formatting) */
  parseMode?: TelegramParseMode;
  /** Include action buttons */
  includeButtons?: boolean;
  /** Include timestamp in message */
  includeTimestamp?: boolean;
  /** Include wallet address (may be truncated) */
  includeWallet?: boolean;
  /** Include market info */
  includeMarket?: boolean;
  /** Include suspicion score */
  includeSuspicionScore?: boolean;
  /** Timezone for date display */
  timezone?: string;
  /** Locale for formatting */
  locale?: string;
  /** Disable web page preview for links */
  disableWebPagePreview?: boolean;
  /** Maximum message length (Telegram limit is 4096) */
  maxLength?: number;
}

/**
 * Formatted Telegram alert result
 */
export interface FormattedTelegramAlert {
  /** Formatted message text */
  text: string;
  /** Inline keyboard buttons (if enabled) */
  inlineKeyboard?: TelegramInlineKeyboard;
  /** Parse mode used */
  parseMode: TelegramParseMode;
  /** Whether web page preview is disabled */
  disableWebPagePreview: boolean;
}

/**
 * Alert type configuration with emoji and labels
 */
export interface AlertTypeConfig {
  emoji: string;
  label: string;
  description: string;
}

/**
 * Severity configuration with emoji
 */
export interface SeverityConfig {
  emoji: string;
  label: string;
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: TelegramAlertOptions = {
  parseMode: TelegramParseMode.HTML,
  includeButtons: true,
  includeTimestamp: true,
  includeWallet: true,
  includeMarket: true,
  includeSuspicionScore: true,
  timezone: "UTC",
  locale: "en-US",
  disableWebPagePreview: true,
  maxLength: 4096,
};

/**
 * Alert type configurations
 */
export const ALERT_TYPE_CONFIG: Record<AlertType, AlertTypeConfig> = {
  whale_trade: {
    emoji: "🐋",
    label: "Whale Trade",
    description: "Large trade detected",
  },
  price_movement: {
    emoji: "📈",
    label: "Price Movement",
    description: "Significant price change",
  },
  insider_activity: {
    emoji: "🔍",
    label: "Insider Activity",
    description: "Potential insider trading detected",
  },
  fresh_wallet: {
    emoji: "🆕",
    label: "Fresh Wallet",
    description: "New wallet activity detected",
  },
  wallet_reactivation: {
    emoji: "⏰",
    label: "Wallet Reactivation",
    description: "Dormant wallet became active",
  },
  coordinated_activity: {
    emoji: "🔗",
    label: "Coordinated Activity",
    description: "Coordinated trading detected",
  },
  unusual_pattern: {
    emoji: "⚠️",
    label: "Unusual Pattern",
    description: "Unusual trading pattern detected",
  },
  market_resolved: {
    emoji: "✅",
    label: "Market Resolved",
    description: "Market has been resolved",
  },
  new_market: {
    emoji: "🎯",
    label: "New Market",
    description: "New market created",
  },
  suspicious_funding: {
    emoji: "💰",
    label: "Suspicious Funding",
    description: "Suspicious funding pattern detected",
  },
  sanctioned_activity: {
    emoji: "🚫",
    label: "Sanctioned Activity",
    description: "Activity from sanctioned address",
  },
  system: {
    emoji: "ℹ️",
    label: "System Alert",
    description: "System notification",
  },
};

/**
 * Severity configurations
 */
export const SEVERITY_CONFIG: Record<AlertSeverity, SeverityConfig> = {
  critical: {
    emoji: "🔴",
    label: "CRITICAL",
  },
  high: {
    emoji: "🟠",
    label: "HIGH",
  },
  medium: {
    emoji: "🟡",
    label: "MEDIUM",
  },
  low: {
    emoji: "🟢",
    label: "LOW",
  },
  info: {
    emoji: "🔵",
    label: "INFO",
  },
};

/**
 * Format a number as currency
 */
function formatCurrency(value: number, locale: string = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage
 */
function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format a date for display
 */
function formatDate(date: Date, timezone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    // Fallback if timezone is invalid
    return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  }
}

/**
 * Truncate wallet address for display
 */
function truncateWallet(address: string): string {
  if (address.length <= 13) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format alert message for Telegram using HTML
 */
export function formatAlertMessageHtml(
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const alertConfig = ALERT_TYPE_CONFIG[alert.alertType];
  const severityConfig = SEVERITY_CONFIG[alert.severity];

  const lines: string[] = [];

  // Header with severity and type
  lines.push(
    `${severityConfig.emoji} <b>${severityConfig.label}</b> | ${alertConfig.emoji} <b>${alertConfig.label}</b>`
  );
  lines.push("");

  // Title
  lines.push(`<b>${escapeHtml(alert.title)}</b>`);
  lines.push("");

  // Message
  lines.push(escapeHtml(alert.message));
  lines.push("");

  // Details section
  const details: string[] = [];

  // Market info
  if (opts.includeMarket && alert.marketTitle) {
    details.push(`📊 <b>Market:</b> ${escapeHtml(truncateText(alert.marketTitle, 50))}`);
  }

  // Wallet address
  if (opts.includeWallet && alert.walletAddress) {
    details.push(
      `👛 <b>Wallet:</b> <code>${truncateWallet(alert.walletAddress)}</code>`
    );
  }

  // Trade size
  if (alert.tradeSize !== undefined && alert.tradeSize > 0) {
    details.push(`💵 <b>Trade Size:</b> ${formatCurrency(alert.tradeSize, opts.locale)}`);
  }

  // Price change
  if (alert.priceChange !== undefined) {
    const changeEmoji = alert.priceChange >= 0 ? "📈" : "📉";
    details.push(`${changeEmoji} <b>Price Change:</b> ${formatPercentage(alert.priceChange)}`);
  }

  // Suspicion score
  if (opts.includeSuspicionScore && alert.suspicionScore !== undefined) {
    const scoreEmoji = alert.suspicionScore >= 70 ? "🚨" : alert.suspicionScore >= 40 ? "⚠️" : "✓";
    details.push(`${scoreEmoji} <b>Suspicion Score:</b> ${alert.suspicionScore}/100`);
  }

  // Timestamp
  if (opts.includeTimestamp) {
    details.push(
      `🕐 <b>Time:</b> ${formatDate(alert.timestamp, opts.timezone!, opts.locale!)}`
    );
  }

  // Add details if any
  if (details.length > 0) {
    lines.push("─────────────────");
    lines.push(...details);
  }

  // Alert ID (small, at bottom)
  lines.push("");
  lines.push(`<i>Alert ID: ${alert.alertId}</i>`);

  return lines.join("\n");
}

/**
 * Format alert message for Telegram using plain text (no formatting)
 */
export function formatAlertMessagePlain(
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const alertConfig = ALERT_TYPE_CONFIG[alert.alertType];
  const severityConfig = SEVERITY_CONFIG[alert.severity];

  const lines: string[] = [];

  // Header
  lines.push(`${severityConfig.emoji} ${severityConfig.label} | ${alertConfig.emoji} ${alertConfig.label}`);
  lines.push("");

  // Title
  lines.push(alert.title);
  lines.push("");

  // Message
  lines.push(alert.message);
  lines.push("");

  // Details
  if (opts.includeMarket && alert.marketTitle) {
    lines.push(`Market: ${truncateText(alert.marketTitle, 50)}`);
  }

  if (opts.includeWallet && alert.walletAddress) {
    lines.push(`Wallet: ${truncateWallet(alert.walletAddress)}`);
  }

  if (alert.tradeSize !== undefined && alert.tradeSize > 0) {
    lines.push(`Trade Size: ${formatCurrency(alert.tradeSize, opts.locale)}`);
  }

  if (alert.priceChange !== undefined) {
    lines.push(`Price Change: ${formatPercentage(alert.priceChange)}`);
  }

  if (opts.includeSuspicionScore && alert.suspicionScore !== undefined) {
    lines.push(`Suspicion Score: ${alert.suspicionScore}/100`);
  }

  if (opts.includeTimestamp) {
    lines.push(`Time: ${formatDate(alert.timestamp, opts.timezone!, opts.locale!)}`);
  }

  lines.push("");
  lines.push(`Alert ID: ${alert.alertId}`);

  return lines.join("\n");
}

/**
 * Create inline keyboard buttons for the alert
 */
export function createAlertButtons(alert: TelegramAlertData): TelegramInlineKeyboard {
  const buttons: TelegramInlineKeyboard = { buttons: [] };

  // First row: View Alert and Dashboard
  const row1: Array<{ text: string; url?: string; callbackData?: string }> = [];

  if (alert.actionUrl) {
    row1.push({
      text: "🔍 View Details",
      url: alert.actionUrl,
    });
  }

  if (alert.dashboardUrl) {
    row1.push({
      text: "📊 Dashboard",
      url: alert.dashboardUrl,
    });
  }

  if (row1.length > 0) {
    buttons.buttons.push(row1);
  }

  // Second row: Market and Wallet links
  const row2: Array<{ text: string; url?: string; callbackData?: string }> = [];

  if (alert.marketId) {
    row2.push({
      text: "🎯 View Market",
      url: `https://polymarket.com/event/${alert.marketId}`,
    });
  }

  if (alert.walletAddress) {
    row2.push({
      text: "👛 View Wallet",
      url: `https://polygonscan.com/address/${alert.walletAddress}`,
    });
  }

  if (row2.length > 0) {
    buttons.buttons.push(row2);
  }

  // Third row: Callback actions (for bot interaction)
  buttons.buttons.push([
    {
      text: "✅ Acknowledge",
      callbackData: `alert_ack:${alert.alertId}`,
    },
    {
      text: "🔕 Mute Similar",
      callbackData: `alert_mute:${alert.alertType}`,
    },
  ]);

  return buttons;
}

/**
 * Format an alert for Telegram
 */
export function formatTelegramAlert(
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): FormattedTelegramAlert {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Format message based on parse mode
  let text: string;
  if (opts.parseMode === TelegramParseMode.HTML) {
    text = formatAlertMessageHtml(alert, opts);
  } else {
    text = formatAlertMessagePlain(alert, opts);
  }

  // Truncate if too long
  if (text.length > opts.maxLength!) {
    text = truncateText(text, opts.maxLength!);
  }

  // Create result
  const result: FormattedTelegramAlert = {
    text,
    parseMode: opts.parseMode!,
    disableWebPagePreview: opts.disableWebPagePreview!,
  };

  // Add buttons if enabled
  if (opts.includeButtons) {
    result.inlineKeyboard = createAlertButtons(alert);
  }

  return result;
}

/**
 * Create a TelegramMessage ready to send from alert data
 */
export function createAlertMessage(
  chatId: string | number,
  alert: TelegramAlertData,
  options: TelegramAlertOptions = {}
): TelegramMessage {
  const formatted = formatTelegramAlert(alert, options);

  return {
    chatId,
    text: formatted.text,
    options: {
      parseMode: formatted.parseMode,
      disableWebPagePreview: formatted.disableWebPagePreview,
      inlineKeyboard: formatted.inlineKeyboard,
    },
  };
}

/**
 * Format multiple alerts into a summary message
 */
export function formatAlertSummary(
  alerts: TelegramAlertData[],
  options: TelegramAlertOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (alerts.length === 0) {
    return "No alerts to display.";
  }

  // Group by severity
  const bySeverity: Record<AlertSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  // Group by type
  const byType: Partial<Record<AlertType, number>> = {};

  for (const alert of alerts) {
    bySeverity[alert.severity]++;
    byType[alert.alertType] = (byType[alert.alertType] || 0) + 1;
  }

  const lines: string[] = [];

  // Header
  lines.push(`📊 <b>Alert Summary</b> (${alerts.length} alerts)`);
  lines.push("");

  // Severity breakdown
  lines.push("<b>By Severity:</b>");
  for (const [severity, count] of Object.entries(bySeverity)) {
    if (count > 0) {
      const config = SEVERITY_CONFIG[severity as AlertSeverity];
      lines.push(`  ${config.emoji} ${config.label}: ${count}`);
    }
  }
  lines.push("");

  // Type breakdown
  lines.push("<b>By Type:</b>");
  for (const [type, count] of Object.entries(byType)) {
    const config = ALERT_TYPE_CONFIG[type as AlertType];
    lines.push(`  ${config.emoji} ${config.label}: ${count}`);
  }

  // Timestamp
  if (opts.includeTimestamp) {
    lines.push("");
    lines.push(
      `<i>Generated: ${formatDate(new Date(), opts.timezone!, opts.locale!)}</i>`
    );
  }

  return lines.join("\n");
}

/**
 * Create a summary message ready to send
 */
export function createAlertSummaryMessage(
  chatId: string | number,
  alerts: TelegramAlertData[],
  options: TelegramAlertOptions = {}
): TelegramMessage {
  const text = formatAlertSummary(alerts, options);

  return {
    chatId,
    text,
    options: {
      parseMode: TelegramParseMode.HTML,
      disableWebPagePreview: true,
    },
  };
}

/**
 * Get severity emoji for quick display
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  return SEVERITY_CONFIG[severity].emoji;
}

/**
 * Get alert type emoji for quick display
 */
export function getAlertTypeEmoji(alertType: AlertType): string {
  return ALERT_TYPE_CONFIG[alertType].emoji;
}

/**
 * Get alert type label
 */
export function getAlertTypeLabel(alertType: AlertType): string {
  return ALERT_TYPE_CONFIG[alertType].label;
}

/**
 * Validate alert data
 */
export function validateAlertData(alert: TelegramAlertData): string[] {
  const errors: string[] = [];

  if (!alert.alertId) {
    errors.push("alertId is required");
  }

  if (!alert.alertType || !ALERT_TYPE_CONFIG[alert.alertType]) {
    errors.push("Valid alertType is required");
  }

  if (!alert.severity || !SEVERITY_CONFIG[alert.severity]) {
    errors.push("Valid severity is required");
  }

  if (!alert.title) {
    errors.push("title is required");
  }

  if (!alert.message) {
    errors.push("message is required");
  }

  if (!alert.timestamp || !(alert.timestamp instanceof Date)) {
    errors.push("Valid timestamp is required");
  }

  return errors;
}
