/**
 * AI-NLP-001: Alert Summary Generator
 *
 * Generates natural language summaries for alerts, providing
 * readable descriptions of suspicious activity for users.
 */

import { EventEmitter } from "events";

// ============================================================================
// Enums
// ============================================================================

/**
 * Alert types supported by the summary generator
 */
export enum AlertType {
  WHALE_TRADE = "whale_trade",
  PRICE_MOVEMENT = "price_movement",
  INSIDER_ACTIVITY = "insider_activity",
  FRESH_WALLET = "fresh_wallet",
  WALLET_REACTIVATION = "wallet_reactivation",
  COORDINATED_ACTIVITY = "coordinated_activity",
  UNUSUAL_PATTERN = "unusual_pattern",
  MARKET_RESOLVED = "market_resolved",
  NEW_MARKET = "new_market",
  SUSPICIOUS_FUNDING = "suspicious_funding",
  SANCTIONED_ACTIVITY = "sanctioned_activity",
  SYSTEM = "system",
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  INFO = "info",
}

/**
 * Summary style variants
 */
export enum SummaryStyle {
  /** Brief one-liner summary */
  BRIEF = "brief",
  /** Standard summary with key details */
  STANDARD = "standard",
  /** Detailed summary with all context */
  DETAILED = "detailed",
  /** Technical summary for analysts */
  TECHNICAL = "technical",
  /** Casual summary for notifications */
  CASUAL = "casual",
}

/**
 * Summary language for localization
 */
export enum SummaryLanguage {
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  ZH = "zh",
  JA = "ja",
  KO = "ko",
  PT = "pt",
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Alert data structure for summary generation
 */
export interface AlertData {
  /** Unique alert identifier */
  id: string;
  /** Type of alert */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** Raw alert message */
  message?: string;
  /** When the alert was generated */
  timestamp: Date;
  /** Associated wallet address */
  walletAddress?: string;
  /** Associated market ID */
  marketId?: string;
  /** Associated market title/question */
  marketTitle?: string;
  /** Trade size in USD */
  tradeSize?: number;
  /** Price/probability change percentage */
  priceChange?: number;
  /** Suspicion score (0-100) */
  suspicionScore?: number;
  /** Number of coordinated wallets */
  coordinatedWallets?: number;
  /** Wallet age in days */
  walletAge?: number;
  /** Historical win rate percentage */
  winRate?: number;
  /** Total trading volume */
  totalVolume?: number;
  /** Pre-event time in hours */
  preEventHours?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generated summary result
 */
export interface AlertSummary {
  /** The generated summary text */
  summary: string;
  /** Key insights extracted from the alert */
  keyInsights: string[];
  /** Suggested actions for the user */
  suggestedActions: string[];
  /** Risk assessment description */
  riskAssessment: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Summary style used */
  style: SummaryStyle;
  /** Language of the summary */
  language: SummaryLanguage;
  /** Time taken to generate (ms) */
  generationTime: number;
}

/**
 * Summary generation options
 */
export interface SummaryOptions {
  /** Summary style to use */
  style?: SummaryStyle;
  /** Target language */
  language?: SummaryLanguage;
  /** Include risk assessment */
  includeRiskAssessment?: boolean;
  /** Include suggested actions */
  includeSuggestedActions?: boolean;
  /** Include key insights */
  includeKeyInsights?: boolean;
  /** Maximum summary length (characters) */
  maxLength?: number;
  /** Custom template overrides */
  customTemplates?: Partial<Record<AlertType, string>>;
}

/**
 * Batch summary result
 */
export interface BatchSummaryResult {
  /** Array of generated summaries */
  summaries: AlertSummary[];
  /** Total alerts processed */
  totalProcessed: number;
  /** Alerts that failed to process */
  failed: number;
  /** Average generation time (ms) */
  avgGenerationTime: number;
  /** Total batch time (ms) */
  totalTime: number;
}

/**
 * Summary generator configuration
 */
export interface SummaryGeneratorConfig {
  /** Default summary style */
  defaultStyle?: SummaryStyle;
  /** Default language */
  defaultLanguage?: SummaryLanguage;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
}

/**
 * Summary generator events
 */
export interface SummaryGeneratorEvents {
  summary_generated: (alertId: string, summary: AlertSummary) => void;
  batch_started: (count: number) => void;
  batch_completed: (result: BatchSummaryResult) => void;
  error: (alertId: string, error: Error) => void;
  cache_hit: (alertId: string) => void;
  cache_miss: (alertId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_SUMMARY_CONFIG: SummaryGeneratorConfig = {
  defaultStyle: SummaryStyle.STANDARD,
  defaultLanguage: SummaryLanguage.EN,
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  maxCacheSize: 1000,
};

/**
 * Alert type descriptions for natural language
 */
export const ALERT_TYPE_DESCRIPTIONS: Record<AlertType, string> = {
  [AlertType.WHALE_TRADE]: "large trade activity",
  [AlertType.PRICE_MOVEMENT]: "significant price movement",
  [AlertType.INSIDER_ACTIVITY]: "potential insider trading",
  [AlertType.FRESH_WALLET]: "new wallet activity",
  [AlertType.WALLET_REACTIVATION]: "dormant wallet reactivation",
  [AlertType.COORDINATED_ACTIVITY]: "coordinated trading pattern",
  [AlertType.UNUSUAL_PATTERN]: "unusual trading pattern",
  [AlertType.MARKET_RESOLVED]: "market resolution",
  [AlertType.NEW_MARKET]: "new market creation",
  [AlertType.SUSPICIOUS_FUNDING]: "suspicious funding activity",
  [AlertType.SANCTIONED_ACTIVITY]: "sanctioned entity activity",
  [AlertType.SYSTEM]: "system notification",
};

/**
 * Severity descriptors for natural language
 */
export const SEVERITY_DESCRIPTORS: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITICAL]: "requires immediate attention",
  [AlertSeverity.HIGH]: "is highly significant",
  [AlertSeverity.MEDIUM]: "warrants investigation",
  [AlertSeverity.LOW]: "is worth monitoring",
  [AlertSeverity.INFO]: "is for informational purposes",
};

/**
 * Risk level thresholds
 */
export const RISK_THRESHOLDS = {
  critical: 85,
  high: 70,
  medium: 50,
  low: 25,
};

// ============================================================================
// Template Generators
// ============================================================================

/**
 * Generate brief summary
 */
function generateBriefSummary(alert: AlertData): string {
  const typeDesc = ALERT_TYPE_DESCRIPTIONS[alert.type] || "alert";

  if (alert.walletAddress && alert.tradeSize) {
    const shortAddr = truncateAddress(alert.walletAddress);
    return `${capitalize(typeDesc)} detected: ${shortAddr} traded $${formatNumber(alert.tradeSize)}`;
  }

  if (alert.marketTitle) {
    const shortTitle = truncateText(alert.marketTitle, 40);
    return `${capitalize(typeDesc)} in "${shortTitle}"`;
  }

  return `${capitalize(typeDesc)} ${SEVERITY_DESCRIPTORS[alert.severity] || "detected"}`;
}

/**
 * Generate standard summary
 */
function generateStandardSummary(alert: AlertData): string {
  const parts: string[] = [];
  const typeDesc = ALERT_TYPE_DESCRIPTIONS[alert.type] || "alert";

  // Opening statement
  parts.push(`A ${alert.severity} ${typeDesc} has been detected`);

  // Add wallet context
  if (alert.walletAddress) {
    const shortAddr = truncateAddress(alert.walletAddress);
    parts.push(`involving wallet ${shortAddr}`);

    if (alert.walletAge !== undefined && alert.walletAge < 7) {
      parts.push(`(only ${alert.walletAge} days old)`);
    }
  }

  // Add market context
  if (alert.marketTitle) {
    parts.push(`on the market "${truncateText(alert.marketTitle, 50)}"`);
  }

  // Add trade details
  if (alert.tradeSize) {
    parts.push(`with a trade size of $${formatNumber(alert.tradeSize)}`);
  }

  // Add price change
  if (alert.priceChange !== undefined) {
    const direction = alert.priceChange >= 0 ? "increase" : "decrease";
    parts.push(`causing a ${Math.abs(alert.priceChange).toFixed(1)}% price ${direction}`);
  }

  // Add suspicion context
  if (alert.suspicionScore !== undefined && alert.suspicionScore >= RISK_THRESHOLDS.medium) {
    parts.push(`with a suspicion score of ${alert.suspicionScore}/100`);
  }

  return parts.join(" ") + ".";
}

/**
 * Generate detailed summary
 */
function generateDetailedSummary(alert: AlertData): string {
  const sections: string[] = [];
  const typeDesc = ALERT_TYPE_DESCRIPTIONS[alert.type] || "alert";

  // Header
  sections.push(`ALERT SUMMARY: ${capitalize(typeDesc)}`);
  sections.push("");

  // Overview
  sections.push(`Overview: This ${alert.severity}-severity alert was triggered at ${formatTimestamp(alert.timestamp)}.`);

  // Wallet analysis
  if (alert.walletAddress) {
    sections.push("");
    sections.push("Wallet Analysis:");
    sections.push(`- Address: ${alert.walletAddress}`);
    if (alert.walletAge !== undefined) {
      sections.push(`- Wallet Age: ${alert.walletAge} days`);
      if (alert.walletAge < 7) {
        sections.push("  (Warning: Fresh wallet with limited history)");
      }
    }
    if (alert.winRate !== undefined) {
      sections.push(`- Historical Win Rate: ${alert.winRate.toFixed(1)}%`);
      if (alert.winRate > 70) {
        sections.push("  (Note: Unusually high success rate)");
      }
    }
    if (alert.totalVolume !== undefined) {
      sections.push(`- Total Trading Volume: $${formatNumber(alert.totalVolume)}`);
    }
    if (alert.suspicionScore !== undefined) {
      sections.push(`- Suspicion Score: ${alert.suspicionScore}/100`);
    }
  }

  // Market analysis
  if (alert.marketTitle || alert.marketId) {
    sections.push("");
    sections.push("Market Context:");
    if (alert.marketTitle) {
      sections.push(`- Market: "${alert.marketTitle}"`);
    }
    if (alert.marketId) {
      sections.push(`- Market ID: ${alert.marketId}`);
    }
    if (alert.priceChange !== undefined) {
      const direction = alert.priceChange >= 0 ? "increased" : "decreased";
      sections.push(`- Price ${direction} by ${Math.abs(alert.priceChange).toFixed(2)}%`);
    }
  }

  // Trade details
  if (alert.tradeSize !== undefined) {
    sections.push("");
    sections.push("Trade Details:");
    sections.push(`- Trade Size: $${formatNumber(alert.tradeSize)}`);
    if (alert.tradeSize >= 100000) {
      sections.push("  (Whale-level transaction)");
    } else if (alert.tradeSize >= 10000) {
      sections.push("  (Large transaction)");
    }
  }

  // Coordination analysis
  if (alert.coordinatedWallets !== undefined && alert.coordinatedWallets > 1) {
    sections.push("");
    sections.push("Coordination Analysis:");
    sections.push(`- Wallets Involved: ${alert.coordinatedWallets}`);
    sections.push(`- Pattern: Multiple wallets trading in synchronized manner`);
  }

  // Timing analysis
  if (alert.preEventHours !== undefined) {
    sections.push("");
    sections.push("Timing Analysis:");
    sections.push(`- Time Before Event: ${alert.preEventHours.toFixed(1)} hours`);
    if (alert.preEventHours < 24) {
      sections.push("  (Alert: Trade occurred shortly before event resolution)");
    }
  }

  return sections.join("\n");
}

/**
 * Generate technical summary
 */
function generateTechnicalSummary(alert: AlertData): string {
  const data: string[] = [];

  data.push(`[${alert.id}] ${alert.type.toUpperCase()} | SEV:${alert.severity.toUpperCase()}`);
  data.push(`TS: ${alert.timestamp.toISOString()}`);

  if (alert.walletAddress) {
    data.push(`ADDR: ${alert.walletAddress}`);
  }
  if (alert.marketId) {
    data.push(`MKT: ${alert.marketId}`);
  }
  if (alert.tradeSize !== undefined) {
    data.push(`SIZE: $${alert.tradeSize.toFixed(2)}`);
  }
  if (alert.priceChange !== undefined) {
    data.push(`DELTA: ${alert.priceChange >= 0 ? "+" : ""}${alert.priceChange.toFixed(4)}%`);
  }
  if (alert.suspicionScore !== undefined) {
    data.push(`SUSP: ${alert.suspicionScore}/100`);
  }
  if (alert.coordinatedWallets !== undefined) {
    data.push(`COORD: ${alert.coordinatedWallets}`);
  }
  if (alert.walletAge !== undefined) {
    data.push(`AGE: ${alert.walletAge}d`);
  }
  if (alert.winRate !== undefined) {
    data.push(`WR: ${alert.winRate.toFixed(1)}%`);
  }

  return data.join(" | ");
}

/**
 * Generate casual summary
 */
function generateCasualSummary(alert: AlertData): string {
  const emoji = getSeverityEmoji(alert.severity);
  const typeVerb = getTypeVerb(alert.type);

  let summary = `${emoji} ${typeVerb}`;

  if (alert.walletAddress) {
    summary += ` by ${truncateAddress(alert.walletAddress)}`;
  }

  if (alert.tradeSize && alert.tradeSize >= 10000) {
    summary += ` - $${formatNumber(alert.tradeSize)} trade`;
  }

  if (alert.marketTitle) {
    summary += ` on "${truncateText(alert.marketTitle, 30)}"`;
  }

  if (alert.suspicionScore && alert.suspicionScore >= RISK_THRESHOLDS.high) {
    summary += ` (suspicious!)`;
  }

  return summary;
}

// ============================================================================
// Key Insights Generator
// ============================================================================

/**
 * Generate key insights from alert data
 */
function generateKeyInsights(alert: AlertData): string[] {
  const insights: string[] = [];

  // Fresh wallet insight
  if (alert.walletAge !== undefined && alert.walletAge < 7) {
    insights.push(`This is a fresh wallet (${alert.walletAge} days old) with limited trading history`);
  }

  // High win rate insight
  if (alert.winRate !== undefined && alert.winRate > 70) {
    insights.push(`Wallet has an unusually high win rate of ${alert.winRate.toFixed(1)}%, significantly above average`);
  }

  // Whale activity insight
  if (alert.tradeSize !== undefined) {
    if (alert.tradeSize >= 100000) {
      insights.push(`This is a whale-level transaction exceeding $100,000`);
    } else if (alert.tradeSize >= 25000) {
      insights.push(`This is a very large transaction in the top percentile of trade sizes`);
    }
  }

  // Price impact insight
  if (alert.priceChange !== undefined && Math.abs(alert.priceChange) >= 5) {
    const direction = alert.priceChange >= 0 ? "increase" : "decrease";
    insights.push(`Trade caused significant market ${direction} of ${Math.abs(alert.priceChange).toFixed(1)}%`);
  }

  // Coordination insight
  if (alert.coordinatedWallets !== undefined && alert.coordinatedWallets > 2) {
    insights.push(`${alert.coordinatedWallets} wallets appear to be trading in coordination`);
  }

  // Pre-event timing insight
  if (alert.preEventHours !== undefined && alert.preEventHours < 24) {
    insights.push(`Trade occurred ${alert.preEventHours.toFixed(1)} hours before event resolution`);
  }

  // Suspicion score insight
  if (alert.suspicionScore !== undefined) {
    if (alert.suspicionScore >= RISK_THRESHOLDS.critical) {
      insights.push(`Suspicion score of ${alert.suspicionScore} indicates critical-level risk`);
    } else if (alert.suspicionScore >= RISK_THRESHOLDS.high) {
      insights.push(`Suspicion score of ${alert.suspicionScore} indicates high-level risk`);
    }
  }

  // Type-specific insights
  switch (alert.type) {
    case AlertType.INSIDER_ACTIVITY:
      insights.push("Trading pattern matches known insider trading behaviors");
      break;
    case AlertType.COORDINATED_ACTIVITY:
      insights.push("Multiple wallets showing synchronized trading behavior");
      break;
    case AlertType.SUSPICIOUS_FUNDING:
      insights.push("Wallet funding source raises compliance concerns");
      break;
    case AlertType.WALLET_REACTIVATION:
      insights.push("Previously dormant wallet suddenly became active");
      break;
    case AlertType.SANCTIONED_ACTIVITY:
      insights.push("Activity linked to potentially sanctioned entities");
      break;
  }

  return insights;
}

// ============================================================================
// Suggested Actions Generator
// ============================================================================

/**
 * Generate suggested actions based on alert
 */
function generateSuggestedActions(alert: AlertData): string[] {
  const actions: string[] = [];

  // Critical severity actions
  if (alert.severity === AlertSeverity.CRITICAL) {
    actions.push("Review immediately and consider escalation");
    actions.push("Check for related alerts in the same timeframe");
  }

  // High severity actions
  if (alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) {
    actions.push("Add wallet to monitoring watchlist");
    actions.push("Review wallet's complete trading history");
  }

  // Wallet-related actions
  if (alert.walletAddress) {
    actions.push("Investigate wallet's funding sources");
    actions.push("Check for connections to other flagged wallets");
  }

  // Market-related actions
  if (alert.marketId || alert.marketTitle) {
    actions.push("Monitor this market for additional suspicious activity");
    actions.push("Review other large trades in this market");
  }

  // Coordination actions
  if (alert.coordinatedWallets && alert.coordinatedWallets > 1) {
    actions.push("Map the full network of coordinated wallets");
    actions.push("Check for common funding sources among coordinated wallets");
  }

  // Type-specific actions
  switch (alert.type) {
    case AlertType.FRESH_WALLET:
      actions.push("Monitor wallet for pattern development over next 7 days");
      break;
    case AlertType.INSIDER_ACTIVITY:
      actions.push("Document for potential regulatory reporting");
      actions.push("Cross-reference with known insider lists");
      break;
    case AlertType.SANCTIONED_ACTIVITY:
      actions.push("Verify against sanctions databases");
      actions.push("Consider immediate compliance review");
      break;
    case AlertType.WHALE_TRADE:
      actions.push("Analyze order book impact of the trade");
      break;
  }

  // Ensure we have at least one action
  if (actions.length === 0) {
    actions.push("Continue monitoring for pattern development");
  }

  return [...new Set(actions)]; // Remove duplicates
}

// ============================================================================
// Risk Assessment Generator
// ============================================================================

/**
 * Generate risk assessment description
 */
function generateRiskAssessment(alert: AlertData): string {
  const factors: string[] = [];
  let riskScore = 0;

  // Severity contribution
  switch (alert.severity) {
    case AlertSeverity.CRITICAL:
      riskScore += 40;
      factors.push("critical severity level");
      break;
    case AlertSeverity.HIGH:
      riskScore += 30;
      factors.push("high severity level");
      break;
    case AlertSeverity.MEDIUM:
      riskScore += 20;
      factors.push("medium severity level");
      break;
    case AlertSeverity.LOW:
      riskScore += 10;
      break;
  }

  // Suspicion score contribution
  if (alert.suspicionScore !== undefined) {
    riskScore += Math.min(alert.suspicionScore * 0.3, 30);
    if (alert.suspicionScore >= RISK_THRESHOLDS.high) {
      factors.push(`high suspicion score (${alert.suspicionScore})`);
    }
  }

  // Wallet age contribution
  if (alert.walletAge !== undefined && alert.walletAge < 7) {
    riskScore += 15;
    factors.push("very new wallet");
  } else if (alert.walletAge !== undefined && alert.walletAge < 30) {
    riskScore += 5;
  }

  // Trade size contribution
  if (alert.tradeSize !== undefined) {
    if (alert.tradeSize >= 100000) {
      riskScore += 15;
      factors.push("whale-level trade size");
    } else if (alert.tradeSize >= 25000) {
      riskScore += 10;
    }
  }

  // Coordination contribution
  if (alert.coordinatedWallets !== undefined && alert.coordinatedWallets > 1) {
    riskScore += Math.min(alert.coordinatedWallets * 5, 20);
    factors.push(`${alert.coordinatedWallets} coordinated wallets`);
  }

  // Type contribution
  if (
    alert.type === AlertType.INSIDER_ACTIVITY ||
    alert.type === AlertType.SANCTIONED_ACTIVITY
  ) {
    riskScore += 20;
    factors.push(`${ALERT_TYPE_DESCRIPTIONS[alert.type]}`);
  }

  // Normalize score
  riskScore = Math.min(riskScore, 100);

  // Generate assessment text
  let level: string;
  if (riskScore >= RISK_THRESHOLDS.critical) {
    level = "CRITICAL";
  } else if (riskScore >= RISK_THRESHOLDS.high) {
    level = "HIGH";
  } else if (riskScore >= RISK_THRESHOLDS.medium) {
    level = "MEDIUM";
  } else if (riskScore >= RISK_THRESHOLDS.low) {
    level = "LOW";
  } else {
    level = "MINIMAL";
  }

  const factorList =
    factors.length > 0 ? ` Contributing factors: ${factors.join(", ")}.` : "";

  return `Overall Risk Level: ${level} (${riskScore}/100).${factorList}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Truncate wallet address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toFixed(2);
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Get emoji for severity level
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return "🚨";
    case AlertSeverity.HIGH:
      return "⚠️";
    case AlertSeverity.MEDIUM:
      return "🔔";
    case AlertSeverity.LOW:
      return "📢";
    case AlertSeverity.INFO:
      return "ℹ️";
    default:
      return "📌";
  }
}

/**
 * Get action verb for alert type
 */
export function getTypeVerb(type: AlertType): string {
  switch (type) {
    case AlertType.WHALE_TRADE:
      return "Whale trade detected";
    case AlertType.PRICE_MOVEMENT:
      return "Price spike detected";
    case AlertType.INSIDER_ACTIVITY:
      return "Potential insider activity";
    case AlertType.FRESH_WALLET:
      return "Fresh wallet trading";
    case AlertType.WALLET_REACTIVATION:
      return "Dormant wallet reactivated";
    case AlertType.COORDINATED_ACTIVITY:
      return "Coordinated trading detected";
    case AlertType.UNUSUAL_PATTERN:
      return "Unusual pattern found";
    case AlertType.MARKET_RESOLVED:
      return "Market resolved";
    case AlertType.NEW_MARKET:
      return "New market created";
    case AlertType.SUSPICIOUS_FUNDING:
      return "Suspicious funding detected";
    case AlertType.SANCTIONED_ACTIVITY:
      return "Sanctioned activity flagged";
    case AlertType.SYSTEM:
      return "System notification";
    default:
      return "Alert triggered";
  }
}

/**
 * Calculate confidence score for summary
 */
export function calculateConfidence(alert: AlertData): number {
  let confidence = 70; // Base confidence

  // More data = higher confidence
  if (alert.walletAddress) confidence += 5;
  if (alert.marketTitle) confidence += 5;
  if (alert.tradeSize !== undefined) confidence += 5;
  if (alert.suspicionScore !== undefined) confidence += 5;
  if (alert.priceChange !== undefined) confidence += 3;
  if (alert.walletAge !== undefined) confidence += 3;
  if (alert.winRate !== undefined) confidence += 2;
  if (alert.message) confidence += 2;

  return Math.min(confidence, 100);
}

/**
 * Validate alert data
 */
export function validateAlertData(alert: unknown): alert is AlertData {
  if (!alert || typeof alert !== "object") return false;
  const a = alert as Record<string, unknown>;

  // Required fields
  if (typeof a.id !== "string" || !a.id) return false;
  if (!Object.values(AlertType).includes(a.type as AlertType)) return false;
  if (!Object.values(AlertSeverity).includes(a.severity as AlertSeverity)) return false;
  if (typeof a.title !== "string") return false;
  if (!(a.timestamp instanceof Date) && typeof a.timestamp !== "string") return false;

  return true;
}

/**
 * Parse alert type from string
 */
export function parseAlertType(type: string): AlertType | null {
  const normalized = type.toLowerCase().replace(/[-_\s]/g, "_");
  const values = Object.values(AlertType);
  return values.find((v) => v === normalized) || null;
}

/**
 * Parse alert severity from string
 */
export function parseAlertSeverity(severity: string): AlertSeverity | null {
  const normalized = severity.toLowerCase();
  const values = Object.values(AlertSeverity);
  return values.find((v) => v === normalized) || null;
}

// ============================================================================
// Alert Summary Generator Class
// ============================================================================

/**
 * Alert Summary Generator
 *
 * Generates natural language summaries for alerts using templates
 * and contextual analysis.
 */
export class AlertSummaryGenerator extends EventEmitter {
  private config: SummaryGeneratorConfig;
  private cache: Map<string, { summary: AlertSummary; expiry: number }>;
  private stats: {
    totalGenerated: number;
    cacheHits: number;
    cacheMisses: number;
    avgGenerationTime: number;
    errorCount: number;
  };

  constructor(config: Partial<SummaryGeneratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SUMMARY_CONFIG, ...config };
    this.cache = new Map();
    this.stats = {
      totalGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgGenerationTime: 0,
      errorCount: 0,
    };
  }

  /**
   * Generate a summary for an alert
   */
  generateSummary(alert: AlertData, options: SummaryOptions = {}): AlertSummary {
    const startTime = Date.now();
    const style = options.style || this.config.defaultStyle || SummaryStyle.STANDARD;
    const language = options.language || this.config.defaultLanguage || SummaryLanguage.EN;

    // Check cache
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(alert.id, style, language);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        this.stats.cacheHits++;
        this.emit("cache_hit", alert.id);
        return cached.summary;
      }
      this.stats.cacheMisses++;
      this.emit("cache_miss", alert.id);
    }

    try {
      // Ensure timestamp is a Date object
      const normalizedAlert = {
        ...alert,
        timestamp:
          alert.timestamp instanceof Date
            ? alert.timestamp
            : new Date(alert.timestamp),
      };

      // Generate summary based on style
      let summaryText: string;
      switch (style) {
        case SummaryStyle.BRIEF:
          summaryText = generateBriefSummary(normalizedAlert);
          break;
        case SummaryStyle.DETAILED:
          summaryText = generateDetailedSummary(normalizedAlert);
          break;
        case SummaryStyle.TECHNICAL:
          summaryText = generateTechnicalSummary(normalizedAlert);
          break;
        case SummaryStyle.CASUAL:
          summaryText = generateCasualSummary(normalizedAlert);
          break;
        case SummaryStyle.STANDARD:
        default:
          summaryText = generateStandardSummary(normalizedAlert);
      }

      // Apply max length if specified
      if (options.maxLength && summaryText.length > options.maxLength) {
        summaryText = truncateText(summaryText, options.maxLength);
      }

      // Generate additional components
      const keyInsights =
        options.includeKeyInsights !== false
          ? generateKeyInsights(normalizedAlert)
          : [];

      const suggestedActions =
        options.includeSuggestedActions !== false
          ? generateSuggestedActions(normalizedAlert)
          : [];

      const riskAssessment =
        options.includeRiskAssessment !== false
          ? generateRiskAssessment(normalizedAlert)
          : "";

      const generationTime = Date.now() - startTime;

      const result: AlertSummary = {
        summary: summaryText,
        keyInsights,
        suggestedActions,
        riskAssessment,
        confidence: calculateConfidence(normalizedAlert),
        style,
        language,
        generationTime,
      };

      // Update stats
      this.stats.totalGenerated++;
      this.stats.avgGenerationTime =
        (this.stats.avgGenerationTime * (this.stats.totalGenerated - 1) +
          generationTime) /
        this.stats.totalGenerated;

      // Cache result
      if (this.config.enableCache) {
        this.cacheResult(alert.id, style, language, result);
      }

      this.emit("summary_generated", alert.id, result);
      return result;
    } catch (error) {
      this.stats.errorCount++;
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", alert.id, err);
      throw err;
    }
  }

  /**
   * Generate summaries for multiple alerts
   */
  generateBatchSummaries(
    alerts: AlertData[],
    options: SummaryOptions = {}
  ): BatchSummaryResult {
    const startTime = Date.now();
    this.emit("batch_started", alerts.length);

    const summaries: AlertSummary[] = [];
    let failed = 0;

    for (const alert of alerts) {
      try {
        summaries.push(this.generateSummary(alert, options));
      } catch {
        failed++;
      }
    }

    const totalTime = Date.now() - startTime;
    const result: BatchSummaryResult = {
      summaries,
      totalProcessed: alerts.length,
      failed,
      avgGenerationTime:
        summaries.length > 0
          ? summaries.reduce((sum, s) => sum + s.generationTime, 0) /
            summaries.length
          : 0,
      totalTime,
    };

    this.emit("batch_completed", result);
    return result;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    alertId: string,
    style: SummaryStyle,
    language: SummaryLanguage
  ): string {
    return `${alertId}:${style}:${language}`;
  }

  /**
   * Cache a summary result
   */
  private cacheResult(
    alertId: string,
    style: SummaryStyle,
    language: SummaryLanguage,
    summary: AlertSummary
  ): void {
    // Enforce max cache size
    if (this.cache.size >= (this.config.maxCacheSize || 1000)) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      const toRemove = entries.slice(0, Math.floor(this.cache.size * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    const cacheKey = this.getCacheKey(alertId, style, language);
    this.cache.set(cacheKey, {
      summary,
      expiry: Date.now() + (this.config.cacheTTL || 300000),
    });
  }

  /**
   * Clear the summary cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.cacheHits / total : 0,
    };
  }

  /**
   * Get generator statistics
   */
  getStats(): typeof this.stats & { cacheSize: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgGenerationTime: 0,
      errorCount: 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SummaryGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SummaryGeneratorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Shared instance */
let sharedInstance: AlertSummaryGenerator | null = null;

/**
 * Create a new AlertSummaryGenerator instance
 */
export function createAlertSummaryGenerator(
  config?: Partial<SummaryGeneratorConfig>
): AlertSummaryGenerator {
  return new AlertSummaryGenerator(config);
}

/**
 * Get the shared AlertSummaryGenerator instance
 */
export function getSharedAlertSummaryGenerator(): AlertSummaryGenerator {
  if (!sharedInstance) {
    sharedInstance = new AlertSummaryGenerator();
  }
  return sharedInstance;
}

/**
 * Set the shared AlertSummaryGenerator instance
 */
export function setSharedAlertSummaryGenerator(
  generator: AlertSummaryGenerator
): void {
  sharedInstance = generator;
}

/**
 * Reset the shared AlertSummaryGenerator instance
 */
export function resetSharedAlertSummaryGenerator(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick summary generation using shared instance
 */
export function generateAlertSummary(
  alert: AlertData,
  options?: SummaryOptions
): AlertSummary {
  return getSharedAlertSummaryGenerator().generateSummary(alert, options);
}

/**
 * Generate brief summary string
 */
export function getBriefSummary(alert: AlertData): string {
  return generateBriefSummary(alert);
}

/**
 * Generate standard summary string
 */
export function getStandardSummary(alert: AlertData): string {
  return generateStandardSummary(alert);
}

/**
 * Generate detailed summary string
 */
export function getDetailedSummary(alert: AlertData): string {
  return generateDetailedSummary(alert);
}

/**
 * Generate technical summary string
 */
export function getTechnicalSummary(alert: AlertData): string {
  return generateTechnicalSummary(alert);
}

/**
 * Generate casual summary string
 */
export function getCasualSummary(alert: AlertData): string {
  return generateCasualSummary(alert);
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create mock alert data for testing
 */
export function createMockAlert(overrides: Partial<AlertData> = {}): AlertData {
  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: AlertType.WHALE_TRADE,
    severity: AlertSeverity.HIGH,
    title: "Large Trade Detected",
    message: "A significant whale trade has been detected on the market.",
    timestamp: new Date(),
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
    marketId: "market_123",
    marketTitle: "Will Bitcoin reach $100k by end of 2024?",
    tradeSize: 50000,
    priceChange: 3.5,
    suspicionScore: 65,
    walletAge: 45,
    winRate: 72.5,
    totalVolume: 250000,
    ...overrides,
  };
}

/**
 * Create multiple mock alerts
 */
export function createMockAlertBatch(
  count: number,
  baseOverrides: Partial<AlertData> = {}
): AlertData[] {
  const types = Object.values(AlertType);
  const severities = Object.values(AlertSeverity);

  return Array.from({ length: count }, (_, i) => {
    return createMockAlert({
      ...baseOverrides,
      id: `alert_batch_${i}_${Date.now()}`,
      type: types[i % types.length],
      severity: severities[i % severities.length],
      tradeSize: Math.random() * 100000 + 5000,
      suspicionScore: Math.floor(Math.random() * 100),
      walletAge: Math.floor(Math.random() * 365) + 1,
    });
  });
}
