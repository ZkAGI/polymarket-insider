/**
 * Discord Alert Embed Formatter
 * Formats alert notifications as Discord embeds with rich formatting
 */

import {
  DiscordEmbed,
  DiscordEmbedField,
  DiscordEmbedColor,
  DiscordMessage,
  truncateForDiscord,
  formatTimestampForEmbed,
  isValidFieldValue,
  isValidFieldName,
  isValidEmbedDescription,
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
 * Alert data structure for Discord formatting
 */
export interface DiscordAlertData {
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
  /** Thumbnail image URL (optional) */
  thumbnailUrl?: string;
  /** Additional metadata key-value pairs */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Discord alert formatting options
 */
export interface DiscordAlertOptions {
  /** Include footer with alert ID and timestamp */
  includeFooter?: boolean;
  /** Include timestamp in embed */
  includeTimestamp?: boolean;
  /** Include wallet address field */
  includeWallet?: boolean;
  /** Include market info field */
  includeMarket?: boolean;
  /** Include suspicion score field */
  includeSuspicionScore?: boolean;
  /** Include trade size field */
  includeTradeSize?: boolean;
  /** Include price change field */
  includePriceChange?: boolean;
  /** Include thumbnail */
  includeThumbnail?: boolean;
  /** Include author section */
  includeAuthor?: boolean;
  /** Custom author name */
  authorName?: string;
  /** Custom author icon URL */
  authorIconUrl?: string;
  /** Custom footer icon URL */
  footerIconUrl?: string;
  /** Locale for number formatting */
  locale?: string;
  /** Use inline fields where applicable */
  useInlineFields?: boolean;
  /** Maximum description length */
  maxDescriptionLength?: number;
}

/**
 * Formatted Discord embed result
 */
export interface FormattedDiscordEmbed {
  /** The formatted embed */
  embed: DiscordEmbed;
  /** Plain text content (optional) */
  content?: string;
}

/**
 * Alert type configuration with emoji, label, and color
 */
export interface AlertTypeConfig {
  emoji: string;
  label: string;
  description: string;
  color: DiscordEmbedColor;
}

/**
 * Severity configuration with emoji and color
 */
export interface SeverityConfig {
  emoji: string;
  label: string;
  color: DiscordEmbedColor;
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: DiscordAlertOptions = {
  includeFooter: true,
  includeTimestamp: true,
  includeWallet: true,
  includeMarket: true,
  includeSuspicionScore: true,
  includeTradeSize: true,
  includePriceChange: true,
  includeThumbnail: true,
  includeAuthor: true,
  authorName: "Polymarket Tracker",
  locale: "en-US",
  useInlineFields: true,
  maxDescriptionLength: 4096,
};

/**
 * Alert type configurations
 */
export const ALERT_TYPE_CONFIG: Record<AlertType, AlertTypeConfig> = {
  whale_trade: {
    emoji: "🐋",
    label: "Whale Trade",
    description: "Large trade detected",
    color: DiscordEmbedColor.BLUE,
  },
  price_movement: {
    emoji: "📈",
    label: "Price Movement",
    description: "Significant price change",
    color: DiscordEmbedColor.GREEN,
  },
  insider_activity: {
    emoji: "🔍",
    label: "Insider Activity",
    description: "Potential insider trading detected",
    color: DiscordEmbedColor.RED,
  },
  fresh_wallet: {
    emoji: "🆕",
    label: "Fresh Wallet",
    description: "New wallet activity detected",
    color: DiscordEmbedColor.AQUA,
  },
  wallet_reactivation: {
    emoji: "⏰",
    label: "Wallet Reactivation",
    description: "Dormant wallet became active",
    color: DiscordEmbedColor.PURPLE,
  },
  coordinated_activity: {
    emoji: "🔗",
    label: "Coordinated Activity",
    description: "Coordinated trading detected",
    color: DiscordEmbedColor.ORANGE,
  },
  unusual_pattern: {
    emoji: "⚠️",
    label: "Unusual Pattern",
    description: "Unusual trading pattern detected",
    color: DiscordEmbedColor.GOLD,
  },
  market_resolved: {
    emoji: "✅",
    label: "Market Resolved",
    description: "Market has been resolved",
    color: DiscordEmbedColor.DARK_GREEN,
  },
  new_market: {
    emoji: "🎯",
    label: "New Market",
    description: "New market created",
    color: DiscordEmbedColor.DARK_AQUA,
  },
  suspicious_funding: {
    emoji: "💰",
    label: "Suspicious Funding",
    description: "Suspicious funding pattern detected",
    color: DiscordEmbedColor.DARK_ORANGE,
  },
  sanctioned_activity: {
    emoji: "🚫",
    label: "Sanctioned Activity",
    description: "Activity from sanctioned address",
    color: DiscordEmbedColor.DARK_RED,
  },
  system: {
    emoji: "ℹ️",
    label: "System Alert",
    description: "System notification",
    color: DiscordEmbedColor.GREY,
  },
};

/**
 * Severity configurations with colors
 */
export const SEVERITY_CONFIG: Record<AlertSeverity, SeverityConfig> = {
  critical: {
    emoji: "🔴",
    label: "CRITICAL",
    color: DiscordEmbedColor.RED,
  },
  high: {
    emoji: "🟠",
    label: "HIGH",
    color: DiscordEmbedColor.ORANGE,
  },
  medium: {
    emoji: "🟡",
    label: "MEDIUM",
    color: DiscordEmbedColor.GOLD,
  },
  low: {
    emoji: "🟢",
    label: "LOW",
    color: DiscordEmbedColor.GREEN,
  },
  info: {
    emoji: "🔵",
    label: "INFO",
    color: DiscordEmbedColor.BLUE,
  },
};

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, locale: string = "en-US"): string {
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
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Truncate wallet address for display
 */
export function truncateWallet(address: string): string {
  if (address.length <= 13) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Get the color for an alert based on severity (takes precedence) and type
 */
export function getAlertColor(severity: AlertSeverity, alertType: AlertType): number {
  // Critical and high severity always override type color
  if (severity === "critical" || severity === "high") {
    return SEVERITY_CONFIG[severity].color;
  }
  // For medium and below, use the alert type color
  return ALERT_TYPE_CONFIG[alertType].color;
}

/**
 * Create a Discord embed field with validation
 */
export function createEmbedField(
  name: string,
  value: string,
  inline: boolean = false
): DiscordEmbedField | null {
  // Validate and truncate if needed
  const truncatedName = truncateForDiscord(name, 256);
  const truncatedValue = truncateForDiscord(value, 1024);

  if (!isValidFieldName(truncatedName) || !isValidFieldValue(truncatedValue)) {
    return null;
  }

  return {
    name: truncatedName,
    value: truncatedValue,
    inline,
  };
}

/**
 * Create alert embed fields based on alert data and options
 */
export function createAlertFields(
  alert: DiscordAlertData,
  options: DiscordAlertOptions = {}
): DiscordEmbedField[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const fields: DiscordEmbedField[] = [];

  // Severity field
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const severityField = createEmbedField(
    "Severity",
    `${severityConfig.emoji} ${severityConfig.label}`,
    opts.useInlineFields
  );
  if (severityField) fields.push(severityField);

  // Alert type field
  const typeConfig = ALERT_TYPE_CONFIG[alert.alertType];
  const typeField = createEmbedField(
    "Type",
    `${typeConfig.emoji} ${typeConfig.label}`,
    opts.useInlineFields
  );
  if (typeField) fields.push(typeField);

  // Market field
  if (opts.includeMarket && alert.marketTitle) {
    const marketValue = alert.marketId
      ? `[${truncateForDiscord(alert.marketTitle, 50)}](https://polymarket.com/event/${alert.marketId})`
      : truncateForDiscord(alert.marketTitle, 50);
    const marketField = createEmbedField("📊 Market", marketValue, false);
    if (marketField) fields.push(marketField);
  }

  // Wallet field
  if (opts.includeWallet && alert.walletAddress) {
    const walletValue = `[\`${truncateWallet(alert.walletAddress)}\`](https://polygonscan.com/address/${alert.walletAddress})`;
    const walletField = createEmbedField("👛 Wallet", walletValue, opts.useInlineFields);
    if (walletField) fields.push(walletField);
  }

  // Trade size field
  if (opts.includeTradeSize && alert.tradeSize !== undefined && alert.tradeSize > 0) {
    const tradeSizeField = createEmbedField(
      "💵 Trade Size",
      formatCurrency(alert.tradeSize, opts.locale),
      opts.useInlineFields
    );
    if (tradeSizeField) fields.push(tradeSizeField);
  }

  // Price change field
  if (opts.includePriceChange && alert.priceChange !== undefined) {
    const changeEmoji = alert.priceChange >= 0 ? "📈" : "📉";
    const priceField = createEmbedField(
      `${changeEmoji} Price Change`,
      formatPercentage(alert.priceChange),
      opts.useInlineFields
    );
    if (priceField) fields.push(priceField);
  }

  // Suspicion score field
  if (opts.includeSuspicionScore && alert.suspicionScore !== undefined) {
    const scoreEmoji =
      alert.suspicionScore >= 70 ? "🚨" : alert.suspicionScore >= 40 ? "⚠️" : "✓";
    const scoreValue = `${scoreEmoji} ${alert.suspicionScore}/100`;
    const scoreField = createEmbedField("Suspicion Score", scoreValue, opts.useInlineFields);
    if (scoreField) fields.push(scoreField);
  }

  // Add metadata fields if present
  if (alert.metadata) {
    for (const [key, value] of Object.entries(alert.metadata)) {
      const metaField = createEmbedField(key, String(value), opts.useInlineFields);
      if (metaField) fields.push(metaField);
    }
  }

  return fields;
}

/**
 * Build a Discord embed for an alert
 */
export function buildAlertEmbed(
  alert: DiscordAlertData,
  options: DiscordAlertOptions = {}
): DiscordEmbed {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const typeConfig = ALERT_TYPE_CONFIG[alert.alertType];

  // Build the embed
  const embed: DiscordEmbed = {
    color: getAlertColor(alert.severity, alert.alertType),
  };

  // Title with emoji
  embed.title = truncateForDiscord(`${typeConfig.emoji} ${alert.title}`, 256);

  // Description
  let description = alert.message;
  if (!isValidEmbedDescription(description)) {
    description = truncateForDiscord(description, opts.maxDescriptionLength || 4096);
  }
  embed.description = description;

  // URL to alert details
  if (alert.actionUrl) {
    embed.url = alert.actionUrl;
  }

  // Timestamp
  if (opts.includeTimestamp) {
    embed.timestamp = formatTimestampForEmbed(alert.timestamp);
  }

  // Author
  if (opts.includeAuthor) {
    embed.author = {
      name: opts.authorName || "Polymarket Tracker",
    };
    if (opts.authorIconUrl) {
      embed.author.icon_url = opts.authorIconUrl;
    }
  }

  // Fields
  embed.fields = createAlertFields(alert, opts);

  // Footer
  if (opts.includeFooter) {
    embed.footer = {
      text: `Alert ID: ${alert.alertId}`,
    };
    if (opts.footerIconUrl) {
      embed.footer.icon_url = opts.footerIconUrl;
    }
  }

  // Thumbnail
  if (opts.includeThumbnail && alert.thumbnailUrl) {
    embed.thumbnail = {
      url: alert.thumbnailUrl,
    };
  }

  return embed;
}

/**
 * Format an alert for Discord as a complete embed
 */
export function formatDiscordAlert(
  alert: DiscordAlertData,
  options: DiscordAlertOptions = {}
): FormattedDiscordEmbed {
  const embed = buildAlertEmbed(alert, options);

  // For critical alerts, add mention text
  let content: string | undefined;
  if (alert.severity === "critical") {
    content = "🚨 **Critical Alert Detected!**";
  }

  return {
    embed,
    content,
  };
}

/**
 * Create a Discord message ready to send from alert data
 */
export function createAlertMessage(
  alert: DiscordAlertData,
  options: DiscordAlertOptions = {}
): DiscordMessage {
  const formatted = formatDiscordAlert(alert, options);

  return {
    content: formatted.content,
    embeds: [formatted.embed],
  };
}

/**
 * Create multiple alert embeds (for batch sending)
 */
export function createAlertEmbeds(
  alerts: DiscordAlertData[],
  options: DiscordAlertOptions = {}
): DiscordEmbed[] {
  // Discord allows max 10 embeds per message
  const maxEmbeds = Math.min(alerts.length, 10);
  const embeds: DiscordEmbed[] = [];

  for (let i = 0; i < maxEmbeds; i++) {
    const alert = alerts[i]!;
    embeds.push(buildAlertEmbed(alert, options));
  }

  return embeds;
}

/**
 * Create a summary embed for multiple alerts
 */
export function createAlertSummaryEmbed(
  alerts: DiscordAlertData[],
  options: DiscordAlertOptions = {}
): DiscordEmbed {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (alerts.length === 0) {
    return {
      title: "📊 Alert Summary",
      description: "No alerts to display.",
      color: DiscordEmbedColor.GREY,
      timestamp: formatTimestampForEmbed(new Date()),
    };
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

  // Find highest severity for color
  let highestSeverity: AlertSeverity = "info";
  const severityOrder: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

  for (const alert of alerts) {
    bySeverity[alert.severity]++;
    byType[alert.alertType] = (byType[alert.alertType] || 0) + 1;

    // Track highest severity
    if (severityOrder.indexOf(alert.severity) < severityOrder.indexOf(highestSeverity)) {
      highestSeverity = alert.severity;
    }
  }

  // Build severity breakdown
  const severityLines: string[] = [];
  for (const [severity, count] of Object.entries(bySeverity)) {
    if (count > 0) {
      const config = SEVERITY_CONFIG[severity as AlertSeverity];
      severityLines.push(`${config.emoji} **${config.label}:** ${count}`);
    }
  }

  // Build type breakdown
  const typeLines: string[] = [];
  for (const [type, count] of Object.entries(byType)) {
    const config = ALERT_TYPE_CONFIG[type as AlertType];
    typeLines.push(`${config.emoji} ${config.label}: ${count}`);
  }

  // Build fields
  const fields: DiscordEmbedField[] = [];

  const severityField = createEmbedField(
    "By Severity",
    severityLines.join("\n") || "None",
    true
  );
  if (severityField) fields.push(severityField);

  const typeField = createEmbedField(
    "By Type",
    typeLines.join("\n") || "None",
    true
  );
  if (typeField) fields.push(typeField);

  // Build embed
  const embed: DiscordEmbed = {
    title: `📊 Alert Summary (${alerts.length} alerts)`,
    color: SEVERITY_CONFIG[highestSeverity].color,
    fields,
  };

  if (opts.includeTimestamp) {
    embed.timestamp = formatTimestampForEmbed(new Date());
  }

  if (opts.includeFooter) {
    embed.footer = {
      text: "Polymarket Tracker",
    };
    if (opts.footerIconUrl) {
      embed.footer.icon_url = opts.footerIconUrl;
    }
  }

  return embed;
}

/**
 * Create a Discord message with a summary of alerts
 */
export function createAlertSummaryMessage(
  alerts: DiscordAlertData[],
  options: DiscordAlertOptions = {}
): DiscordMessage {
  const embed = createAlertSummaryEmbed(alerts, options);

  return {
    embeds: [embed],
  };
}

/**
 * Get severity emoji for quick display
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  return SEVERITY_CONFIG[severity].emoji;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: AlertSeverity): number {
  return SEVERITY_CONFIG[severity].color;
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
 * Get alert type color
 */
export function getAlertTypeColor(alertType: AlertType): number {
  return ALERT_TYPE_CONFIG[alertType].color;
}

/**
 * Validate alert data
 */
export function validateAlertData(alert: DiscordAlertData): string[] {
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

/**
 * Create a simple notification embed (non-alert)
 */
export function createSimpleEmbed(
  title: string,
  description: string,
  color: DiscordEmbedColor = DiscordEmbedColor.BLUE,
  options: { url?: string; thumbnail?: string; footer?: string } = {}
): DiscordEmbed {
  const embed: DiscordEmbed = {
    title: truncateForDiscord(title, 256),
    description: truncateForDiscord(description, 4096),
    color,
    timestamp: formatTimestampForEmbed(new Date()),
  };

  if (options.url) {
    embed.url = options.url;
  }

  if (options.thumbnail) {
    embed.thumbnail = { url: options.thumbnail };
  }

  if (options.footer) {
    embed.footer = { text: truncateForDiscord(options.footer, 2048) };
  }

  return embed;
}

/**
 * Create an error embed
 */
export function createErrorEmbed(
  title: string,
  errorMessage: string,
  details?: string
): DiscordEmbed {
  const fields: DiscordEmbedField[] = [];

  const errorField = createEmbedField("Error", errorMessage, false);
  if (errorField) fields.push(errorField);

  if (details) {
    const detailsField = createEmbedField("Details", details, false);
    if (detailsField) fields.push(detailsField);
  }

  return {
    title: `❌ ${truncateForDiscord(title, 250)}`,
    color: DiscordEmbedColor.RED,
    fields,
    timestamp: formatTimestampForEmbed(new Date()),
  };
}

/**
 * Create a success embed
 */
export function createSuccessEmbed(
  title: string,
  message: string
): DiscordEmbed {
  return {
    title: `✅ ${truncateForDiscord(title, 250)}`,
    description: truncateForDiscord(message, 4096),
    color: DiscordEmbedColor.GREEN,
    timestamp: formatTimestampForEmbed(new Date()),
  };
}

/**
 * Create an info embed
 */
export function createInfoEmbed(
  title: string,
  message: string
): DiscordEmbed {
  return {
    title: `ℹ️ ${truncateForDiscord(title, 250)}`,
    description: truncateForDiscord(message, 4096),
    color: DiscordEmbedColor.BLUE,
    timestamp: formatTimestampForEmbed(new Date()),
  };
}

/**
 * Create a warning embed
 */
export function createWarningEmbed(
  title: string,
  message: string
): DiscordEmbed {
  return {
    title: `⚠️ ${truncateForDiscord(title, 250)}`,
    description: truncateForDiscord(message, 4096),
    color: DiscordEmbedColor.GOLD,
    timestamp: formatTimestampForEmbed(new Date()),
  };
}
