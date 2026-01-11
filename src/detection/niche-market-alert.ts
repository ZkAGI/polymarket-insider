/**
 * Niche Market Alert Generator (DET-NICHE-010)
 *
 * Generates alerts for suspicious niche market activity.
 *
 * Features:
 * - Define niche alert conditions based on various niche detection signals
 * - Create alerts with rich market context (category, insider potential, liquidity)
 * - Include category information and classification confidence
 * - Set niche-specific severity based on insider advantage potential
 * - Integration with watchlist, concentration, correlation, and other detectors
 * - Event emission for generated alerts
 * - Configurable alert conditions and thresholds
 */

import { EventEmitter } from "events";
import { MarketCategory } from "../api/gamma/types";
import {
  WatchlistPriority,
  type WatchlistEntry,
  type NicheMarketWatchlist,
} from "./niche-market-watchlist";
import {
  ConcentrationLevel,
  SpecialistType,
  ConcentrationSuspicion,
  type WalletConcentrationResult,
  type WalletConcentrationAnalyzer,
} from "./wallet-concentration";
import {
  CorrelationType,
  CorrelationSeverity,
  type CrossMarketCorrelation,
  type CrossMarketCorrelationDetector,
} from "./cross-market-correlation";
import {
  LiquidityCategory,
  ThinMarketSeverity,
  type MarketLiquidityScore,
  type MarketLiquidityScorer,
  type ThinMarketAlert,
} from "./market-liquidity-scorer";
import {
  InformationAdvantageTier,
  type InformationAdvantageResult,
  type InformationAdvantageIdentifier,
} from "./information-advantage-identifier";
import {
  RegulatoryAgency,
  RegulatoryDecisionType,
  InsiderAdvantageLevel,
  type RegulatoryMarketResult,
  type RegulatoryDecisionDetector,
} from "./regulatory-decision-detector";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of niche market alert
 */
export enum NicheMarketAlertType {
  /** High insider potential market detected */
  HIGH_INSIDER_POTENTIAL = "HIGH_INSIDER_POTENTIAL",
  /** Wallet specializing in niche category */
  SPECIALIST_WALLET = "SPECIALIST_WALLET",
  /** Cross-market correlation detected */
  CROSS_MARKET_CORRELATION = "CROSS_MARKET_CORRELATION",
  /** Thin liquidity market activity */
  THIN_MARKET_ACTIVITY = "THIN_MARKET_ACTIVITY",
  /** Regulatory market approaching deadline */
  REGULATORY_DEADLINE = "REGULATORY_DEADLINE",
  /** Pre-event suspicious activity */
  PRE_EVENT_ACTIVITY = "PRE_EVENT_ACTIVITY",
  /** Watchlist market triggered */
  WATCHLIST_TRIGGER = "WATCHLIST_TRIGGER",
  /** Coordinated activity in niche category */
  COORDINATED_NICHE_ACTIVITY = "COORDINATED_NICHE_ACTIVITY",
  /** Multiple specialists converging on market */
  SPECIALIST_CONVERGENCE = "SPECIALIST_CONVERGENCE",
  /** Information asymmetry indicator */
  INFORMATION_ASYMMETRY = "INFORMATION_ASYMMETRY",
  /** General niche anomaly */
  GENERAL_NICHE_ANOMALY = "GENERAL_NICHE_ANOMALY",
}

/**
 * Alert severity levels
 */
export enum NicheAlertSeverity {
  /** Low severity - minor signal */
  LOW = "LOW",
  /** Medium severity - notable signal */
  MEDIUM = "MEDIUM",
  /** High severity - significant signal */
  HIGH = "HIGH",
  /** Critical severity - requires immediate attention */
  CRITICAL = "CRITICAL",
}

/**
 * Alert status
 */
export enum NicheAlertStatus {
  /** Alert is new/unread */
  NEW = "NEW",
  /** Alert has been read */
  READ = "READ",
  /** Alert has been acknowledged */
  ACKNOWLEDGED = "ACKNOWLEDGED",
  /** Alert is under investigation */
  INVESTIGATING = "INVESTIGATING",
  /** Alert has been dismissed */
  DISMISSED = "DISMISSED",
  /** Alert has been resolved */
  RESOLVED = "RESOLVED",
}

/**
 * Market context data for the alert
 */
export interface NicheMarketContext {
  /** Market ID */
  marketId: string;
  /** Market question/title */
  marketQuestion: string;
  /** Market category */
  category: MarketCategory;
  /** Information advantage tier */
  informationAdvantageTier: InformationAdvantageTier | null;
  /** Information advantage score (0-100) */
  informationAdvantageScore: number | null;
  /** Liquidity category */
  liquidityCategory: LiquidityCategory | null;
  /** Liquidity score (0-100) */
  liquidityScore: number | null;
  /** Whether it's a thin market */
  isThinMarket: boolean;
  /** Regulatory agency if applicable */
  regulatoryAgency: RegulatoryAgency | null;
  /** Regulatory decision type if applicable */
  regulatoryDecisionType: RegulatoryDecisionType | null;
  /** Days until event/deadline */
  daysUntilEvent: number | null;
  /** Whether on watchlist */
  isOnWatchlist: boolean;
  /** Watchlist priority if on watchlist */
  watchlistPriority: WatchlistPriority | null;
  /** Current 24h volume */
  volume24hUsd: number | null;
}

/**
 * Wallet context data for specialist alerts
 */
export interface NicheWalletContext {
  /** Wallet address */
  walletAddress: string;
  /** Concentration level */
  concentrationLevel: ConcentrationLevel;
  /** Concentration score (0-100) */
  concentrationScore: number;
  /** Specialist type */
  specialistType: SpecialistType;
  /** Suspicion level */
  suspicionLevel: ConcentrationSuspicion;
  /** Primary category focus */
  primaryCategory: MarketCategory | null;
  /** Total trades analyzed */
  totalTrades: number;
  /** Total volume traded */
  totalVolume: number;
}

/**
 * Correlation context data
 */
export interface NicheCorrelationContext {
  /** Correlation ID */
  correlationId: string;
  /** Related market IDs */
  marketIds: [string, string];
  /** Correlation type */
  correlationType: CorrelationType;
  /** Correlation severity */
  correlationSeverity: CorrelationSeverity;
  /** Correlation score (0-100) */
  correlationScore: number;
  /** Number of wallets involved */
  walletCount: number;
  /** Total volume involved */
  totalVolume: number;
  /** Flag reasons from detector */
  flagReasons: string[];
}

/**
 * Full alert context
 */
export interface NicheAlertContext {
  /** Market context (always present) */
  market: NicheMarketContext;
  /** Wallet context (for wallet-specific alerts) */
  wallet: NicheWalletContext | null;
  /** Correlation context (for correlation alerts) */
  correlation: NicheCorrelationContext | null;
  /** Related market IDs */
  relatedMarkets: string[];
  /** Related wallet addresses */
  relatedWallets: string[];
  /** Insider advantage multiplier */
  insiderAdvantageMultiplier: number;
  /** Additional flags/notes */
  flags: string[];
  /** Historical alert count for this market */
  recentAlertCount: number;
  /** Is this a recurring alert pattern */
  isRecurring: boolean;
}

/**
 * Niche market alert structure
 */
export interface NicheMarketAlert {
  /** Unique alert identifier */
  id: string;
  /** Alert type classification */
  type: NicheMarketAlertType;
  /** Alert severity */
  severity: NicheAlertSeverity;
  /** Market identifier */
  marketId: string;
  /** Alert title */
  title: string;
  /** Detailed alert message */
  message: string;
  /** Alert context data */
  context: NicheAlertContext;
  /** Alert tags for filtering */
  tags: string[];
  /** Alert status */
  status: NicheAlertStatus;
  /** When the alert was created */
  createdAt: Date;
  /** When the alert expires */
  expiresAt: Date | null;
  /** Source detector that triggered this alert */
  sourceDetector: string;
  /** Source event ID from the detector */
  sourceEventId: string | null;
  /** Priority score for sorting (0-100) */
  priorityScore: number;
}

/**
 * Alert condition definition
 */
export interface NicheAlertCondition {
  /** Condition identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Condition description */
  description: string;
  /** Whether this condition is enabled */
  enabled: boolean;
  /** Alert type to generate */
  alertType: NicheMarketAlertType;
  /** Minimum insider advantage score to trigger */
  minInsiderAdvantageScore?: number;
  /** Minimum concentration score to trigger */
  minConcentrationScore?: number;
  /** Minimum correlation score to trigger */
  minCorrelationScore?: number;
  /** Minimum liquidity score (lower = thinner) */
  maxLiquidityScore?: number;
  /** Required categories */
  requiredCategories?: MarketCategory[];
  /** Required information advantage tier */
  requiredAdvantageLevel?: InformationAdvantageTier;
  /** Required watchlist priority */
  requiredWatchlistPriority?: WatchlistPriority;
  /** Override severity for this condition */
  overrideSeverity?: NicheAlertSeverity;
  /** Tags to add to alerts from this condition */
  tags?: string[];
  /** Custom predicate function */
  predicate?: (context: NicheAlertContext) => boolean;
}

/**
 * Options for generating alerts
 */
export interface GenerateNicheAlertOptions {
  /** Current timestamp override */
  timestamp?: number;
  /** Market ID for single market generation */
  marketId?: string;
  /** Alert expiration time in milliseconds */
  expirationMs?: number;
  /** Override alert severity */
  overrideSeverity?: NicheAlertSeverity;
  /** Additional tags to add */
  additionalTags?: string[];
  /** Bypass cooldown check */
  bypassCooldown?: boolean;
}

/**
 * Result of processing an alert trigger
 */
export interface ProcessAlertResult {
  /** Generated alert (if any) */
  alert: NicheMarketAlert | null;
  /** Whether conditions were met */
  conditionsMet: boolean;
  /** Matched condition IDs */
  matchedConditions: string[];
}

/**
 * Batch alert generation result
 */
export interface BatchNicheAlertResult {
  /** Generated alerts by market ID */
  alerts: Map<string, NicheMarketAlert[]>;
  /** Markets that didn't trigger any alerts */
  noAlerts: string[];
  /** Failed markets with error messages */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Total alerts generated */
  totalAlerts: number;
  /** Alerts by type */
  byType: Record<NicheMarketAlertType, number>;
  /** Alerts by severity */
  bySeverity: Record<NicheAlertSeverity, number>;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Alert summary statistics
 */
export interface NicheAlertSummary {
  /** Total alerts */
  totalAlerts: number;
  /** Alerts by type */
  byType: Record<NicheMarketAlertType, number>;
  /** Alerts by severity */
  bySeverity: Record<NicheAlertSeverity, number>;
  /** Alerts by status */
  byStatus: Record<NicheAlertStatus, number>;
  /** Alerts by category */
  byCategory: Record<MarketCategory, number>;
  /** Recent alerts */
  recentAlerts: NicheMarketAlert[];
  /** Markets with most alerts */
  topAlertMarkets: Array<{
    marketId: string;
    alertCount: number;
    highestSeverity: NicheAlertSeverity;
  }>;
  /** Average insider advantage score for alerted markets */
  averageInsiderAdvantageScore: number | null;
  /** Most common alert type */
  mostCommonType: NicheMarketAlertType | null;
  /** Highest severity seen */
  highestSeverity: NicheAlertSeverity | null;
  /** Critical alert count */
  criticalAlertCount: number;
}

/**
 * Alert listener callback type
 */
export type NicheAlertListener = (alert: NicheMarketAlert) => void | Promise<void>;

/**
 * Configuration for NicheMarketAlertGenerator
 */
export interface NicheMarketAlertGeneratorConfig {
  /** Watchlist manager */
  watchlist?: NicheMarketWatchlist;
  /** Concentration analyzer */
  concentrationAnalyzer?: WalletConcentrationAnalyzer;
  /** Correlation detector */
  correlationDetector?: CrossMarketCorrelationDetector;
  /** Liquidity scorer */
  liquidityScorer?: MarketLiquidityScorer;
  /** Information advantage identifier */
  informationAdvantageIdentifier?: InformationAdvantageIdentifier;
  /** Regulatory detector */
  regulatoryDetector?: RegulatoryDecisionDetector;
  /** Custom alert conditions (merged with defaults) */
  customConditions?: NicheAlertCondition[];
  /** Replace default conditions entirely */
  replaceDefaultConditions?: boolean;
  /** Enable event emission (default: true) */
  enableEvents?: boolean;
  /** Default alert expiration in milliseconds (default: 48 hours) */
  defaultExpirationMs?: number;
  /** Cooldown between alerts for same market in milliseconds (default: 5 minutes) */
  cooldownMs?: number;
  /** Maximum alerts to store (default: 1000) */
  maxStoredAlerts?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default alert expiration: 48 hours */
const DEFAULT_EXPIRATION_MS = 48 * 60 * 60 * 1000;

/** Default cooldown period: 5 minutes */
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

/** Default maximum stored alerts */
const DEFAULT_MAX_STORED_ALERTS = 1000;

/** Recent alert window for frequency tracking (4 hours) */
const RECENT_ALERT_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Severity ordering for comparisons */
const SEVERITY_ORDER: Record<NicheAlertSeverity, number> = {
  [NicheAlertSeverity.LOW]: 1,
  [NicheAlertSeverity.MEDIUM]: 2,
  [NicheAlertSeverity.HIGH]: 3,
  [NicheAlertSeverity.CRITICAL]: 4,
};

/** High-value categories for insider trading */
const HIGH_VALUE_CATEGORIES: Set<MarketCategory> = new Set([
  MarketCategory.POLITICS,
  MarketCategory.CRYPTO,
  MarketCategory.BUSINESS,
  MarketCategory.LEGAL,
]);

/** Default alert conditions */
export const DEFAULT_NICHE_ALERT_CONDITIONS: NicheAlertCondition[] = [
  {
    id: "critical_insider_potential",
    name: "Critical Insider Potential",
    description: "Market with extreme insider potential detected (score >= 85)",
    enabled: true,
    alertType: NicheMarketAlertType.HIGH_INSIDER_POTENTIAL,
    minInsiderAdvantageScore: 85,
    overrideSeverity: NicheAlertSeverity.CRITICAL,
    tags: ["critical", "insider_potential", "high_value"],
  },
  {
    id: "high_insider_potential",
    name: "High Insider Potential",
    description: "Market with high insider potential detected (score >= 70)",
    enabled: true,
    alertType: NicheMarketAlertType.HIGH_INSIDER_POTENTIAL,
    minInsiderAdvantageScore: 70,
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["high", "insider_potential"],
  },
  {
    id: "critical_specialist_activity",
    name: "Critical Specialist Activity",
    description: "Extreme category specialist with high suspicion trading",
    enabled: true,
    alertType: NicheMarketAlertType.SPECIALIST_WALLET,
    minConcentrationScore: 85,
    predicate: (ctx) =>
      ctx.wallet !== null &&
      ctx.wallet.suspicionLevel === ConcentrationSuspicion.CRITICAL,
    overrideSeverity: NicheAlertSeverity.CRITICAL,
    tags: ["critical", "specialist", "suspicious"],
  },
  {
    id: "high_specialist_activity",
    name: "High Specialist Activity",
    description: "Category specialist trading in high-value market",
    enabled: true,
    alertType: NicheMarketAlertType.SPECIALIST_WALLET,
    minConcentrationScore: 60,
    predicate: (ctx) =>
      ctx.wallet !== null &&
      (ctx.wallet.suspicionLevel === ConcentrationSuspicion.HIGH ||
        ctx.wallet.suspicionLevel === ConcentrationSuspicion.CRITICAL) &&
      ctx.wallet.primaryCategory !== null &&
      HIGH_VALUE_CATEGORIES.has(ctx.wallet.primaryCategory),
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["high", "specialist", "high_value_category"],
  },
  {
    id: "critical_correlation",
    name: "Critical Cross-Market Correlation",
    description: "Critical severity cross-market correlation detected",
    enabled: true,
    alertType: NicheMarketAlertType.CROSS_MARKET_CORRELATION,
    predicate: (ctx) =>
      ctx.correlation !== null &&
      ctx.correlation.correlationSeverity === CorrelationSeverity.CRITICAL,
    overrideSeverity: NicheAlertSeverity.CRITICAL,
    tags: ["critical", "correlation", "cross_market"],
  },
  {
    id: "high_correlation",
    name: "High Cross-Market Correlation",
    description: "High severity cross-market correlation detected",
    enabled: true,
    alertType: NicheMarketAlertType.CROSS_MARKET_CORRELATION,
    minCorrelationScore: 70,
    predicate: (ctx) =>
      ctx.correlation !== null &&
      (ctx.correlation.correlationSeverity === CorrelationSeverity.HIGH ||
        ctx.correlation.correlationSeverity === CorrelationSeverity.CRITICAL),
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["high", "correlation", "cross_market"],
  },
  {
    id: "thin_market_high_value",
    name: "Thin Market High Value Activity",
    description: "Activity in thin liquidity market with high insider potential",
    enabled: true,
    alertType: NicheMarketAlertType.THIN_MARKET_ACTIVITY,
    maxLiquidityScore: 25,
    predicate: (ctx) =>
      ctx.market.isThinMarket &&
      ctx.market.informationAdvantageScore !== null &&
      ctx.market.informationAdvantageScore >= 60,
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["thin_market", "high_insider_potential"],
  },
  {
    id: "regulatory_deadline_approaching",
    name: "Regulatory Deadline Approaching",
    description: "Regulatory market with upcoming deadline and activity",
    enabled: true,
    alertType: NicheMarketAlertType.REGULATORY_DEADLINE,
    predicate: (ctx) =>
      ctx.market.regulatoryAgency !== null &&
      ctx.market.daysUntilEvent !== null &&
      ctx.market.daysUntilEvent <= 7,
    tags: ["regulatory", "deadline"],
  },
  {
    id: "watchlist_critical_trigger",
    name: "Critical Watchlist Trigger",
    description: "Activity on critical priority watchlist market",
    enabled: true,
    alertType: NicheMarketAlertType.WATCHLIST_TRIGGER,
    requiredWatchlistPriority: WatchlistPriority.CRITICAL,
    overrideSeverity: NicheAlertSeverity.CRITICAL,
    tags: ["watchlist", "critical"],
  },
  {
    id: "watchlist_high_trigger",
    name: "High Watchlist Trigger",
    description: "Activity on high priority watchlist market",
    enabled: true,
    alertType: NicheMarketAlertType.WATCHLIST_TRIGGER,
    requiredWatchlistPriority: WatchlistPriority.HIGH,
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["watchlist", "high_priority"],
  },
  {
    id: "coordinated_niche_activity",
    name: "Coordinated Niche Activity",
    description: "Multiple specialists coordinating in same niche category",
    enabled: true,
    alertType: NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY,
    predicate: (ctx) =>
      ctx.relatedWallets.length >= 3 &&
      ctx.correlation !== null &&
      ctx.correlation.walletCount >= 3,
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["coordinated", "niche", "multi_wallet"],
  },
  {
    id: "specialist_convergence",
    name: "Specialist Convergence",
    description: "Multiple specialists converging on single market",
    enabled: true,
    alertType: NicheMarketAlertType.SPECIALIST_CONVERGENCE,
    predicate: (ctx) =>
      ctx.relatedWallets.length >= 2 &&
      ctx.insiderAdvantageMultiplier >= 1.5,
    overrideSeverity: NicheAlertSeverity.HIGH,
    tags: ["convergence", "multiple_specialists"],
  },
  {
    id: "information_asymmetry",
    name: "Information Asymmetry Indicator",
    description: "Patterns suggesting information asymmetry",
    enabled: true,
    alertType: NicheMarketAlertType.INFORMATION_ASYMMETRY,
    predicate: (ctx) =>
      ctx.market.informationAdvantageTier === InformationAdvantageTier.CRITICAL &&
      ctx.market.isThinMarket &&
      ctx.insiderAdvantageMultiplier >= 2.0,
    overrideSeverity: NicheAlertSeverity.CRITICAL,
    tags: ["information_asymmetry", "extreme"],
  },
  {
    id: "medium_insider_potential",
    name: "Medium Insider Potential",
    description: "Market with moderate insider potential detected",
    enabled: true,
    alertType: NicheMarketAlertType.HIGH_INSIDER_POTENTIAL,
    minInsiderAdvantageScore: 50,
    overrideSeverity: NicheAlertSeverity.MEDIUM,
    tags: ["medium", "insider_potential"],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `nma_${timestamp}_${random}`;
}

/**
 * Map correlation severity to alert severity
 */
function mapCorrelationSeverity(severity: CorrelationSeverity): NicheAlertSeverity {
  switch (severity) {
    case CorrelationSeverity.CRITICAL:
      return NicheAlertSeverity.CRITICAL;
    case CorrelationSeverity.HIGH:
      return NicheAlertSeverity.HIGH;
    case CorrelationSeverity.MEDIUM:
      return NicheAlertSeverity.MEDIUM;
    case CorrelationSeverity.LOW:
    default:
      return NicheAlertSeverity.LOW;
  }
}

/**
 * Map concentration suspicion to alert severity
 */
function mapConcentrationSuspicion(suspicion: ConcentrationSuspicion): NicheAlertSeverity {
  switch (suspicion) {
    case ConcentrationSuspicion.CRITICAL:
      return NicheAlertSeverity.CRITICAL;
    case ConcentrationSuspicion.HIGH:
      return NicheAlertSeverity.HIGH;
    case ConcentrationSuspicion.MEDIUM:
      return NicheAlertSeverity.MEDIUM;
    case ConcentrationSuspicion.LOW:
    case ConcentrationSuspicion.MINIMAL:
    default:
      return NicheAlertSeverity.LOW;
  }
}

/**
 * Map information advantage tier to alert severity
 */
function mapAdvantageLevel(tier: InformationAdvantageTier): NicheAlertSeverity {
  switch (tier) {
    case InformationAdvantageTier.CRITICAL:
      return NicheAlertSeverity.CRITICAL;
    case InformationAdvantageTier.VERY_HIGH:
    case InformationAdvantageTier.HIGH:
      return NicheAlertSeverity.HIGH;
    case InformationAdvantageTier.MEDIUM:
      return NicheAlertSeverity.MEDIUM;
    case InformationAdvantageTier.LOW:
    case InformationAdvantageTier.MINIMAL:
    default:
      return NicheAlertSeverity.LOW;
  }
}

/**
 * Map watchlist priority to alert severity
 */
function mapWatchlistPriority(priority: WatchlistPriority): NicheAlertSeverity {
  switch (priority) {
    case WatchlistPriority.CRITICAL:
      return NicheAlertSeverity.CRITICAL;
    case WatchlistPriority.HIGH:
      return NicheAlertSeverity.HIGH;
    case WatchlistPriority.MEDIUM:
      return NicheAlertSeverity.MEDIUM;
    case WatchlistPriority.LOW:
    case WatchlistPriority.MINIMAL:
    default:
      return NicheAlertSeverity.LOW;
  }
}

/**
 * Get higher of two severities
 */
function getHigherSeverity(
  s1: NicheAlertSeverity | null,
  s2: NicheAlertSeverity | null
): NicheAlertSeverity | null {
  if (s1 === null) return s2;
  if (s2 === null) return s1;
  return SEVERITY_ORDER[s1] >= SEVERITY_ORDER[s2] ? s1 : s2;
}

/**
 * Calculate priority score from context (0-100)
 */
function calculatePriorityScore(context: NicheAlertContext): number {
  let score = 0;

  // Information advantage score (up to 30 points)
  if (context.market.informationAdvantageScore !== null) {
    score += (context.market.informationAdvantageScore / 100) * 30;
  }

  // Liquidity score - lower is more urgent (up to 20 points)
  if (context.market.liquidityScore !== null) {
    score += ((100 - context.market.liquidityScore) / 100) * 20;
  }

  // Thin market bonus (10 points)
  if (context.market.isThinMarket) {
    score += 10;
  }

  // Watchlist priority (up to 20 points)
  if (context.market.isOnWatchlist && context.market.watchlistPriority !== null) {
    const priorityMap: Record<WatchlistPriority, number> = {
      [WatchlistPriority.CRITICAL]: 20,
      [WatchlistPriority.HIGH]: 15,
      [WatchlistPriority.MEDIUM]: 10,
      [WatchlistPriority.LOW]: 5,
      [WatchlistPriority.MINIMAL]: 2,
    };
    score += priorityMap[context.market.watchlistPriority] ?? 0;
  }

  // Concentration score (up to 15 points)
  if (context.wallet !== null) {
    score += (context.wallet.concentrationScore / 100) * 15;
  }

  // Correlation score (up to 15 points)
  if (context.correlation !== null) {
    score += (context.correlation.correlationScore / 100) * 15;
  }

  // Insider advantage multiplier bonus (up to 10 points)
  score += Math.min(10, (context.insiderAdvantageMultiplier - 1) * 5);

  // Recurring alerts penalty (-10 points)
  if (context.isRecurring) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// NicheMarketAlertGenerator Class
// ============================================================================

/**
 * Event types emitted by NicheMarketAlertGenerator
 */
export interface NicheMarketAlertGeneratorEvents {
  alertGenerated: (alert: NicheMarketAlert) => void;
  criticalAlert: (alert: NicheMarketAlert) => void;
  highAlert: (alert: NicheMarketAlert) => void;
}

/**
 * Generator for niche market alerts
 */
export class NicheMarketAlertGenerator extends EventEmitter {
  private readonly conditions: NicheAlertCondition[];
  private readonly enableEvents: boolean;
  private readonly defaultExpirationMs: number;
  private readonly cooldownMs: number;
  private readonly maxStoredAlerts: number;

  // Alert storage
  private readonly storedAlerts: Map<string, NicheMarketAlert> = new Map();

  // Listeners
  private readonly alertListeners: Set<NicheAlertListener> = new Set();

  // Cooldown tracking per market
  private readonly lastAlertTimes: Map<string, number> = new Map();

  // Alert counter for unique IDs
  private alertCounter = 0;

  constructor(config?: NicheMarketAlertGeneratorConfig) {
    super();

    // Build conditions list
    if (config?.replaceDefaultConditions && config?.customConditions) {
      this.conditions = [...config.customConditions];
    } else {
      this.conditions = [
        ...DEFAULT_NICHE_ALERT_CONDITIONS,
        ...(config?.customConditions ?? []),
      ];
    }

    this.enableEvents = config?.enableEvents ?? true;
    this.defaultExpirationMs = config?.defaultExpirationMs ?? DEFAULT_EXPIRATION_MS;
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.maxStoredAlerts = config?.maxStoredAlerts ?? DEFAULT_MAX_STORED_ALERTS;
  }

  /**
   * Process an information advantage result and generate alerts if conditions are met
   */
  processInformationAdvantageResult(
    result: InformationAdvantageResult,
    marketQuestion: string,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build market context
    const marketContext: NicheMarketContext = {
      marketId: result.marketId,
      marketQuestion,
      category: result.category,
      informationAdvantageTier: result.tier,
      informationAdvantageScore: result.score,
      liquidityCategory: null,
      liquidityScore: null,
      isThinMarket: false,
      regulatoryAgency: null,
      regulatoryDecisionType: null,
      daysUntilEvent: null,
      isOnWatchlist: false,
      watchlistPriority: null,
      volume24hUsd: null,
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketContext,
      wallet: null,
      correlation: null,
      relatedMarkets: [],
      relatedWallets: [],
      insiderAdvantageMultiplier: 1 + (result.score / 100), // Calculate multiplier from score
      flags: result.factors.map((f) => `${f.name}${f.evidence ? ': ' + f.evidence : ''}`),
      recentAlertCount: this.getRecentAlertCount(result.marketId, now),
      isRecurring: this.getRecentAlertCount(result.marketId, now) > 2,
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(result.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.HIGH_INSIDER_POTENTIAL;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isInsiderAdvantageConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          mapAdvantageLevel(result.tier);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      result.marketId,
      context,
      "InformationAdvantageIdentifier",
      null,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(result.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a wallet concentration result and generate alerts if conditions are met
   */
  processWalletConcentrationResult(
    result: WalletConcentrationResult,
    marketContext: NicheMarketContext,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build wallet context
    const walletContext: NicheWalletContext = {
      walletAddress: result.walletAddress,
      concentrationLevel: result.concentrationLevel,
      concentrationScore: result.concentrationScore,
      specialistType: result.specialistType,
      suspicionLevel: result.suspicionLevel,
      primaryCategory: result.primaryCategory,
      totalTrades: result.totalTrades,
      totalVolume: result.totalVolume,
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketContext,
      wallet: walletContext,
      correlation: null,
      relatedMarkets: [],
      relatedWallets: [result.walletAddress],
      insiderAdvantageMultiplier: marketContext.informationAdvantageScore !== null
        ? 1 + (marketContext.informationAdvantageScore / 100)
        : 1,
      flags: result.flagReasons,
      recentAlertCount: this.getRecentAlertCount(marketContext.marketId, now),
      isRecurring: this.getRecentAlertCount(marketContext.marketId, now) > 2,
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(marketContext.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.SPECIALIST_WALLET;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isConcentrationConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          mapConcentrationSuspicion(result.suspicionLevel);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      marketContext.marketId,
      context,
      "WalletConcentrationAnalyzer",
      null,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(marketContext.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a cross-market correlation and generate alerts if conditions are met
   */
  processCorrelation(
    correlation: CrossMarketCorrelation,
    marketAContext: NicheMarketContext,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build correlation context
    const correlationContext: NicheCorrelationContext = {
      correlationId: correlation.correlationId,
      marketIds: [correlation.marketIdA, correlation.marketIdB],
      correlationType: correlation.correlationType,
      correlationSeverity: correlation.severity,
      correlationScore: correlation.correlationScore,
      walletCount: correlation.walletCount,
      totalVolume: correlation.volumeMarketA + correlation.volumeMarketB,
      flagReasons: correlation.flagReasons ?? [],
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketAContext,
      wallet: null,
      correlation: correlationContext,
      relatedMarkets: [correlation.marketIdB],
      relatedWallets: [...correlation.walletAddresses],
      insiderAdvantageMultiplier: marketAContext.informationAdvantageScore !== null
        ? 1 + (marketAContext.informationAdvantageScore / 100)
        : 1,
      flags: correlation.flagReasons ?? [],
      recentAlertCount: this.getRecentAlertCount(correlation.marketIdA, now),
      isRecurring: this.getRecentAlertCount(correlation.marketIdA, now) > 2,
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(correlation.marketIdA, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.CROSS_MARKET_CORRELATION;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isCorrelationConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          mapCorrelationSeverity(correlation.severity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      correlation.marketIdA,
      context,
      "CrossMarketCorrelationDetector",
      correlation.correlationId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(correlation.marketIdA, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a watchlist entry and generate alerts if conditions are met
   */
  processWatchlistEntry(
    entry: WatchlistEntry,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build market context from watchlist entry
    const marketContext: NicheMarketContext = {
      marketId: entry.market.marketId,
      marketQuestion: entry.market.question,
      category: entry.market.category,
      informationAdvantageTier: entry.market.informationAdvantageTier ?? null,
      informationAdvantageScore: entry.market.informationAdvantageScore ?? null,
      liquidityCategory: entry.market.liquidityCategory ?? null,
      liquidityScore: entry.market.liquidityScore ?? null,
      isThinMarket: entry.market.isThinMarket ?? false,
      regulatoryAgency: null,
      regulatoryDecisionType: null,
      daysUntilEvent: entry.market.endDate
        ? Math.ceil((entry.market.endDate.getTime() - now) / (24 * 60 * 60 * 1000))
        : null,
      isOnWatchlist: true,
      watchlistPriority: entry.priority,
      volume24hUsd: entry.market.volume24hUsd ?? null,
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketContext,
      wallet: null,
      correlation: null,
      relatedMarkets: [],
      relatedWallets: [],
      insiderAdvantageMultiplier: entry.market.insiderAdvantageMultiplier ?? 1,
      flags: entry.notes,
      recentAlertCount: this.getRecentAlertCount(entry.market.marketId, now),
      isRecurring: this.getRecentAlertCount(entry.market.marketId, now) > 2,
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(entry.market.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.WATCHLIST_TRIGGER;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isWatchlistConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          mapWatchlistPriority(entry.priority);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      entry.market.marketId,
      context,
      "NicheMarketWatchlist",
      entry.entryId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(entry.market.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a thin market liquidity score and generate alerts if conditions are met
   */
  processThinMarketScore(
    score: MarketLiquidityScore,
    marketQuestion: string,
    marketCategory: MarketCategory,
    informationAdvantageScore?: number,
    thinMarketAlert?: ThinMarketAlert,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build market context
    const marketContext: NicheMarketContext = {
      marketId: score.marketId,
      marketQuestion,
      category: marketCategory,
      informationAdvantageTier: null,
      informationAdvantageScore: informationAdvantageScore ?? null,
      liquidityCategory: score.category,
      liquidityScore: score.liquidityScore,
      isThinMarket: score.isThinMarket,
      regulatoryAgency: null,
      regulatoryDecisionType: null,
      daysUntilEvent: null,
      isOnWatchlist: false,
      watchlistPriority: null,
      volume24hUsd: null,
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketContext,
      wallet: null,
      correlation: null,
      relatedMarkets: [],
      relatedWallets: [],
      insiderAdvantageMultiplier: informationAdvantageScore
        ? 1 + (informationAdvantageScore / 100)
        : 1,
      flags: thinMarketAlert?.reasons ?? [],
      recentAlertCount: this.getRecentAlertCount(score.marketId, now),
      isRecurring: this.getRecentAlertCount(score.marketId, now) > 2,
    };

    // Only process if it's a thin market
    if (!score.isThinMarket) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(score.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.THIN_MARKET_ACTIVITY;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isThinMarketConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          this.mapThinMarketSeverity(thinMarketAlert?.severity ?? score.thinMarketSeverity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      score.marketId,
      context,
      "MarketLiquidityScorer",
      null,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(score.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a regulatory market result and generate alerts if conditions are met
   */
  processRegulatoryMarketResult(
    result: RegulatoryMarketResult,
    options?: GenerateNicheAlertOptions
  ): ProcessAlertResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Calculate days until deadline
    let daysUntilEvent: number | null = null;
    const firstDeadline = result.deadlines[0];
    if (firstDeadline?.expectedDate) {
      daysUntilEvent = Math.ceil(
        (new Date(firstDeadline.expectedDate).getTime() - now) / (24 * 60 * 60 * 1000)
      );
    }

    // Build market context
    const marketContext: NicheMarketContext = {
      marketId: result.marketId,
      marketQuestion: result.question ?? "",
      category: MarketCategory.LEGAL, // Regulatory markets are legal category
      informationAdvantageTier: null,
      informationAdvantageScore: null,
      liquidityCategory: null,
      liquidityScore: null,
      isThinMarket: false,
      regulatoryAgency: result.primaryAgency ?? null,
      regulatoryDecisionType: result.primaryDecisionType ?? null,
      daysUntilEvent,
      isOnWatchlist: false,
      watchlistPriority: null,
      volume24hUsd: null,
    };

    // Build full context
    const context: NicheAlertContext = {
      market: marketContext,
      wallet: null,
      correlation: null,
      relatedMarkets: [],
      relatedWallets: [],
      insiderAdvantageMultiplier: this.mapInsiderAdvantageLevel(result.insiderAdvantageLevel),
      flags: [],
      recentAlertCount: this.getRecentAlertCount(result.marketId, now),
      isRecurring: this.getRecentAlertCount(result.marketId, now) > 2,
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(result.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: NicheAlertSeverity | null = null;
    let alertType: NicheMarketAlertType = NicheMarketAlertType.REGULATORY_DEADLINE;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isRegulatoryConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ??
          condition.overrideSeverity ??
          this.mapRegulatoryInsiderAdvantage(result.insiderAdvantageLevel);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? NicheAlertSeverity.LOW,
      result.marketId,
      context,
      "RegulatoryDecisionDetector",
      null,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(result.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Get alerts for a specific market
   */
  getAlertsForMarket(marketId: string): NicheMarketAlert[] {
    const alerts: NicheMarketAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.marketId === marketId) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all stored alerts
   */
  getAllAlerts(): NicheMarketAlert[] {
    return Array.from(this.storedAlerts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: NicheMarketAlertType): NicheMarketAlert[] {
    const alerts: NicheMarketAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.type === type) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: NicheAlertSeverity): NicheMarketAlert[] {
    const alerts: NicheMarketAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.severity === severity) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get alerts by category
   */
  getAlertsByCategory(category: MarketCategory): NicheMarketAlert[] {
    const alerts: NicheMarketAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.context.market.category === category) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): NicheMarketAlert[] {
    return this.getAllAlerts().slice(0, limit);
  }

  /**
   * Get high priority alerts (sorted by priority score)
   */
  getHighPriorityAlerts(limit: number = 20): NicheMarketAlert[] {
    return this.getAllAlerts()
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): NicheMarketAlert[] {
    return this.getAlertsBySeverity(NicheAlertSeverity.CRITICAL);
  }

  /**
   * Get alert by ID
   */
  getAlertById(id: string): NicheMarketAlert | null {
    return this.storedAlerts.get(id) ?? null;
  }

  /**
   * Update alert status
   */
  updateAlertStatus(id: string, status: NicheAlertStatus): boolean {
    const alert = this.storedAlerts.get(id);
    if (!alert) {
      return false;
    }

    alert.status = status;
    return true;
  }

  /**
   * Delete an alert
   */
  deleteAlert(id: string): boolean {
    return this.storedAlerts.delete(id);
  }

  /**
   * Clear all stored alerts
   */
  clearAlerts(): void {
    this.storedAlerts.clear();
    this.lastAlertTimes.clear();
  }

  /**
   * Clear expired alerts
   */
  clearExpiredAlerts(): number {
    const now = Date.now();
    let clearedCount = 0;

    for (const [id, alert] of this.storedAlerts.entries()) {
      if (alert.expiresAt && alert.expiresAt.getTime() < now) {
        this.storedAlerts.delete(id);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get alert summary statistics
   */
  getSummary(): NicheAlertSummary {
    const alerts = Array.from(this.storedAlerts.values());
    const now = Date.now();

    const byType: Record<NicheMarketAlertType, number> = {
      [NicheMarketAlertType.HIGH_INSIDER_POTENTIAL]: 0,
      [NicheMarketAlertType.SPECIALIST_WALLET]: 0,
      [NicheMarketAlertType.CROSS_MARKET_CORRELATION]: 0,
      [NicheMarketAlertType.THIN_MARKET_ACTIVITY]: 0,
      [NicheMarketAlertType.REGULATORY_DEADLINE]: 0,
      [NicheMarketAlertType.PRE_EVENT_ACTIVITY]: 0,
      [NicheMarketAlertType.WATCHLIST_TRIGGER]: 0,
      [NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY]: 0,
      [NicheMarketAlertType.SPECIALIST_CONVERGENCE]: 0,
      [NicheMarketAlertType.INFORMATION_ASYMMETRY]: 0,
      [NicheMarketAlertType.GENERAL_NICHE_ANOMALY]: 0,
    };

    const bySeverity: Record<NicheAlertSeverity, number> = {
      [NicheAlertSeverity.LOW]: 0,
      [NicheAlertSeverity.MEDIUM]: 0,
      [NicheAlertSeverity.HIGH]: 0,
      [NicheAlertSeverity.CRITICAL]: 0,
    };

    const byStatus: Record<NicheAlertStatus, number> = {
      [NicheAlertStatus.NEW]: 0,
      [NicheAlertStatus.READ]: 0,
      [NicheAlertStatus.ACKNOWLEDGED]: 0,
      [NicheAlertStatus.INVESTIGATING]: 0,
      [NicheAlertStatus.DISMISSED]: 0,
      [NicheAlertStatus.RESOLVED]: 0,
    };

    const byCategory: Record<MarketCategory, number> = {
      [MarketCategory.POLITICS]: 0,
      [MarketCategory.CRYPTO]: 0,
      [MarketCategory.SPORTS]: 0,
      [MarketCategory.BUSINESS]: 0,
      [MarketCategory.SCIENCE]: 0,
      [MarketCategory.ENTERTAINMENT]: 0,
      [MarketCategory.LEGAL]: 0,
      [MarketCategory.TECH]: 0,
      [MarketCategory.WEATHER]: 0,
      [MarketCategory.GEOPOLITICS]: 0,
      [MarketCategory.HEALTH]: 0,
      [MarketCategory.ECONOMY]: 0,
      [MarketCategory.CULTURE]: 0,
      [MarketCategory.OTHER]: 0,
    };

    let totalInsiderScore = 0;
    let insiderScoreCount = 0;
    let highestSeverityOrder = 0;
    let highestSeverity: NicheAlertSeverity | null = null;
    let criticalCount = 0;

    // Market alert counts
    const marketAlertCounts = new Map<
      string,
      { count: number; highestSeverity: NicheAlertSeverity }
    >();

    for (const alert of alerts) {
      byType[alert.type]++;
      bySeverity[alert.severity]++;
      byStatus[alert.status]++;
      byCategory[alert.context.market.category]++;

      if (alert.context.market.informationAdvantageScore !== null) {
        totalInsiderScore += alert.context.market.informationAdvantageScore;
        insiderScoreCount++;
      }

      const severityOrder = SEVERITY_ORDER[alert.severity];
      if (severityOrder > highestSeverityOrder) {
        highestSeverityOrder = severityOrder;
        highestSeverity = alert.severity;
      }

      if (alert.severity === NicheAlertSeverity.CRITICAL) {
        criticalCount++;
      }

      // Track market alerts
      const existing = marketAlertCounts.get(alert.marketId);
      if (existing) {
        existing.count++;
        if (SEVERITY_ORDER[alert.severity] > SEVERITY_ORDER[existing.highestSeverity]) {
          existing.highestSeverity = alert.severity;
        }
      } else {
        marketAlertCounts.set(alert.marketId, {
          count: 1,
          highestSeverity: alert.severity,
        });
      }
    }

    // Find most common type
    let mostCommonType: NicheMarketAlertType | null = null;
    let maxTypeCount = 0;
    for (const [type, count] of Object.entries(byType)) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        mostCommonType = type as NicheMarketAlertType;
      }
    }

    // Get top alert markets
    const topAlertMarkets = Array.from(marketAlertCounts.entries())
      .map(([marketId, data]) => ({
        marketId,
        alertCount: data.count,
        highestSeverity: data.highestSeverity,
      }))
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, 10);

    // Get recent alerts
    const recentAlerts = alerts
      .filter((a) => now - a.createdAt.getTime() < RECENT_ALERT_WINDOW_MS)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    return {
      totalAlerts: alerts.length,
      byType,
      bySeverity,
      byStatus,
      byCategory,
      recentAlerts,
      topAlertMarkets,
      averageInsiderAdvantageScore:
        insiderScoreCount > 0 ? totalInsiderScore / insiderScoreCount : null,
      mostCommonType,
      highestSeverity,
      criticalAlertCount: criticalCount,
    };
  }

  /**
   * Add an alert listener
   */
  addAlertListener(listener: NicheAlertListener): void {
    this.alertListeners.add(listener);
  }

  /**
   * Remove an alert listener
   */
  removeAlertListener(listener: NicheAlertListener): void {
    this.alertListeners.delete(listener);
  }

  /**
   * Get the number of stored alerts
   */
  getAlertCount(): number {
    return this.storedAlerts.size;
  }

  /**
   * Get all conditions
   */
  getConditions(): NicheAlertCondition[] {
    return [...this.conditions];
  }

  /**
   * Get enabled conditions
   */
  getEnabledConditions(): NicheAlertCondition[] {
    return this.conditions.filter((c) => c.enabled);
  }

  /**
   * Enable a condition by ID
   */
  enableCondition(id: string): boolean {
    const condition = this.conditions.find((c) => c.id === id);
    if (condition) {
      condition.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a condition by ID
   */
  disableCondition(id: string): boolean {
    const condition = this.conditions.find((c) => c.id === id);
    if (condition) {
      condition.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): {
    storedAlerts: number;
    enabledConditions: number;
    totalConditions: number;
    cooldownMs: number;
    recentAlertWindow: number;
  } {
    return {
      storedAlerts: this.storedAlerts.size,
      enabledConditions: this.conditions.filter((c) => c.enabled).length,
      totalConditions: this.conditions.length,
      cooldownMs: this.cooldownMs,
      recentAlertWindow: RECENT_ALERT_WINDOW_MS,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private evaluateCondition(
    condition: NicheAlertCondition,
    context: NicheAlertContext
  ): boolean {
    // Check insider advantage score threshold
    if (
      condition.minInsiderAdvantageScore !== undefined &&
      (context.market.informationAdvantageScore === null ||
        context.market.informationAdvantageScore < condition.minInsiderAdvantageScore)
    ) {
      return false;
    }

    // Check concentration score threshold
    if (
      condition.minConcentrationScore !== undefined &&
      (context.wallet === null ||
        context.wallet.concentrationScore < condition.minConcentrationScore)
    ) {
      return false;
    }

    // Check correlation score threshold
    if (
      condition.minCorrelationScore !== undefined &&
      (context.correlation === null ||
        context.correlation.correlationScore < condition.minCorrelationScore)
    ) {
      return false;
    }

    // Check max liquidity score (lower liquidity = more concerning)
    if (
      condition.maxLiquidityScore !== undefined &&
      context.market.liquidityScore !== null &&
      context.market.liquidityScore > condition.maxLiquidityScore
    ) {
      return false;
    }

    // Check required categories
    if (
      condition.requiredCategories !== undefined &&
      condition.requiredCategories.length > 0 &&
      !condition.requiredCategories.includes(context.market.category)
    ) {
      return false;
    }

    // Check required advantage level
    if (
      condition.requiredAdvantageLevel !== undefined &&
      context.market.informationAdvantageTier !== condition.requiredAdvantageLevel
    ) {
      return false;
    }

    // Check required watchlist priority
    if (
      condition.requiredWatchlistPriority !== undefined &&
      (!context.market.isOnWatchlist ||
        context.market.watchlistPriority !== condition.requiredWatchlistPriority)
    ) {
      return false;
    }

    // Check custom predicate
    if (condition.predicate && !condition.predicate(context)) {
      return false;
    }

    return true;
  }

  private isInsiderAdvantageConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.HIGH_INSIDER_POTENTIAL ||
      condition.alertType === NicheMarketAlertType.INFORMATION_ASYMMETRY ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private isConcentrationConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.SPECIALIST_WALLET ||
      condition.alertType === NicheMarketAlertType.SPECIALIST_CONVERGENCE ||
      condition.alertType === NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private isCorrelationConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.CROSS_MARKET_CORRELATION ||
      condition.alertType === NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private isWatchlistConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.WATCHLIST_TRIGGER ||
      condition.alertType === NicheMarketAlertType.PRE_EVENT_ACTIVITY ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private isThinMarketConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.THIN_MARKET_ACTIVITY ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private isRegulatoryConditionRelevant(condition: NicheAlertCondition): boolean {
    return (
      condition.alertType === NicheMarketAlertType.REGULATORY_DEADLINE ||
      condition.alertType === NicheMarketAlertType.HIGH_INSIDER_POTENTIAL ||
      condition.alertType === NicheMarketAlertType.GENERAL_NICHE_ANOMALY
    );
  }

  private checkCooldown(marketId: string, now: number): boolean {
    const lastAlertTime = this.lastAlertTimes.get(marketId);
    if (lastAlertTime === undefined) {
      return true;
    }
    return now - lastAlertTime >= this.cooldownMs;
  }

  private updateCooldown(marketId: string, now: number): void {
    this.lastAlertTimes.set(marketId, now);
  }

  private getRecentAlertCount(marketId: string, now: number): number {
    let count = 0;
    for (const alert of this.storedAlerts.values()) {
      if (
        alert.marketId === marketId &&
        now - alert.createdAt.getTime() < RECENT_ALERT_WINDOW_MS
      ) {
        count++;
      }
    }
    return count;
  }

  private mapThinMarketSeverity(severity?: ThinMarketSeverity | null): NicheAlertSeverity {
    if (!severity) return NicheAlertSeverity.LOW;
    switch (severity) {
      case ThinMarketSeverity.CRITICAL:
        return NicheAlertSeverity.CRITICAL;
      case ThinMarketSeverity.HIGH:
        return NicheAlertSeverity.HIGH;
      case ThinMarketSeverity.MEDIUM:
        return NicheAlertSeverity.MEDIUM;
      case ThinMarketSeverity.LOW:
      default:
        return NicheAlertSeverity.LOW;
    }
  }

  private mapInsiderAdvantageLevel(level: InsiderAdvantageLevel): number {
    switch (level) {
      case InsiderAdvantageLevel.VERY_HIGH:
        return 3.0;
      case InsiderAdvantageLevel.HIGH:
        return 2.0;
      case InsiderAdvantageLevel.MEDIUM:
        return 1.5;
      case InsiderAdvantageLevel.LOW:
      default:
        return 1.0;
    }
  }

  private mapRegulatoryInsiderAdvantage(level: InsiderAdvantageLevel): NicheAlertSeverity {
    switch (level) {
      case InsiderAdvantageLevel.VERY_HIGH:
        return NicheAlertSeverity.CRITICAL;
      case InsiderAdvantageLevel.HIGH:
        return NicheAlertSeverity.HIGH;
      case InsiderAdvantageLevel.MEDIUM:
        return NicheAlertSeverity.MEDIUM;
      case InsiderAdvantageLevel.LOW:
      default:
        return NicheAlertSeverity.LOW;
    }
  }

  private createAlert(
    type: NicheMarketAlertType,
    severity: NicheAlertSeverity,
    marketId: string,
    context: NicheAlertContext,
    sourceDetector: string,
    sourceEventId: string | null,
    options?: GenerateNicheAlertOptions
  ): NicheMarketAlert {
    this.alertCounter++;
    const id = generateAlertId();

    const title = this.generateTitle(type, severity, context);
    const message = this.generateMessage(type, context);

    const tags = this.generateTags(type, severity, context);
    if (options?.additionalTags) {
      tags.push(...options.additionalTags);
    }

    const expirationMs = options?.expirationMs ?? this.defaultExpirationMs;
    const expiresAt = new Date(Date.now() + expirationMs);

    const priorityScore = calculatePriorityScore(context);

    return {
      id,
      type,
      severity,
      marketId,
      title,
      message,
      context,
      tags,
      status: NicheAlertStatus.NEW,
      createdAt: new Date(),
      expiresAt,
      sourceDetector,
      sourceEventId,
      priorityScore,
    };
  }

  private generateTitle(
    type: NicheMarketAlertType,
    severity: NicheAlertSeverity,
    context: NicheAlertContext
  ): string {
    const severityPrefix = this.getSeverityPrefix(severity);

    switch (type) {
      case NicheMarketAlertType.HIGH_INSIDER_POTENTIAL:
        return `${severityPrefix}High Insider Potential - ${context.market.category}`;

      case NicheMarketAlertType.SPECIALIST_WALLET:
        return `${severityPrefix}Specialist Wallet Activity - ${context.wallet?.specialistType ?? "Unknown"}`;

      case NicheMarketAlertType.CROSS_MARKET_CORRELATION:
        return `${severityPrefix}Cross-Market Correlation Detected`;

      case NicheMarketAlertType.THIN_MARKET_ACTIVITY:
        return `${severityPrefix}Thin Market Activity`;

      case NicheMarketAlertType.REGULATORY_DEADLINE:
        if (context.market.daysUntilEvent !== null) {
          return `${severityPrefix}Regulatory Market - ${context.market.daysUntilEvent} Days to Deadline`;
        }
        return `${severityPrefix}Regulatory Market Activity`;

      case NicheMarketAlertType.PRE_EVENT_ACTIVITY:
        return `${severityPrefix}Pre-Event Activity Detected`;

      case NicheMarketAlertType.WATCHLIST_TRIGGER:
        return `${severityPrefix}Watchlist Market Triggered - ${context.market.watchlistPriority} Priority`;

      case NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY:
        return `${severityPrefix}Coordinated Niche Activity - ${context.relatedWallets.length} Wallets`;

      case NicheMarketAlertType.SPECIALIST_CONVERGENCE:
        return `${severityPrefix}Specialist Convergence - ${context.relatedWallets.length} Specialists`;

      case NicheMarketAlertType.INFORMATION_ASYMMETRY:
        return `${severityPrefix}Information Asymmetry Indicator`;

      case NicheMarketAlertType.GENERAL_NICHE_ANOMALY:
      default:
        return `${severityPrefix}Niche Market Anomaly - ${context.market.category}`;
    }
  }

  private generateMessage(
    type: NicheMarketAlertType,
    context: NicheAlertContext
  ): string {
    const parts: string[] = [];

    // Market information
    parts.push(`Market: ${context.market.marketId}`);
    parts.push(`Question: ${context.market.marketQuestion}`);
    parts.push(`Category: ${context.market.category}`);

    // Type-specific details
    switch (type) {
      case NicheMarketAlertType.HIGH_INSIDER_POTENTIAL:
      case NicheMarketAlertType.INFORMATION_ASYMMETRY:
        if (context.market.informationAdvantageScore !== null) {
          parts.push(`Insider Advantage Score: ${context.market.informationAdvantageScore.toFixed(1)}/100`);
        }
        if (context.market.informationAdvantageTier !== null) {
          parts.push(`Advantage Tier: ${context.market.informationAdvantageTier}`);
        }
        parts.push(`Advantage Multiplier: ${context.insiderAdvantageMultiplier.toFixed(2)}x`);
        break;

      case NicheMarketAlertType.SPECIALIST_WALLET:
        if (context.wallet) {
          parts.push("");
          parts.push("Wallet Analysis:");
          parts.push(`  Address: ${context.wallet.walletAddress}`);
          parts.push(`  Specialist Type: ${context.wallet.specialistType}`);
          parts.push(`  Concentration Level: ${context.wallet.concentrationLevel}`);
          parts.push(`  Concentration Score: ${context.wallet.concentrationScore.toFixed(1)}/100`);
          parts.push(`  Suspicion Level: ${context.wallet.suspicionLevel}`);
          parts.push(`  Total Trades: ${context.wallet.totalTrades}`);
          parts.push(`  Total Volume: $${context.wallet.totalVolume.toLocaleString()}`);
        }
        break;

      case NicheMarketAlertType.CROSS_MARKET_CORRELATION:
        if (context.correlation) {
          parts.push("");
          parts.push("Correlation Details:");
          parts.push(`  Markets: ${context.correlation.marketIds[0]} <-> ${context.correlation.marketIds[1]}`);
          parts.push(`  Correlation Type: ${context.correlation.correlationType}`);
          parts.push(`  Correlation Score: ${context.correlation.correlationScore.toFixed(1)}/100`);
          parts.push(`  Wallets Involved: ${context.correlation.walletCount}`);
          parts.push(`  Total Volume: $${context.correlation.totalVolume.toLocaleString()}`);
        }
        break;

      case NicheMarketAlertType.THIN_MARKET_ACTIVITY:
        if (context.market.liquidityScore !== null) {
          parts.push(`Liquidity Score: ${context.market.liquidityScore.toFixed(1)}/100`);
        }
        if (context.market.liquidityCategory !== null) {
          parts.push(`Liquidity Category: ${context.market.liquidityCategory}`);
        }
        parts.push(`Thin Market: Yes`);
        break;

      case NicheMarketAlertType.REGULATORY_DEADLINE:
        if (context.market.regulatoryAgency !== null) {
          parts.push(`Agency: ${context.market.regulatoryAgency}`);
        }
        if (context.market.regulatoryDecisionType !== null) {
          parts.push(`Decision Type: ${context.market.regulatoryDecisionType}`);
        }
        if (context.market.daysUntilEvent !== null) {
          parts.push(`Days Until Deadline: ${context.market.daysUntilEvent}`);
        }
        break;

      case NicheMarketAlertType.WATCHLIST_TRIGGER:
        parts.push(`Watchlist Priority: ${context.market.watchlistPriority}`);
        break;

      case NicheMarketAlertType.COORDINATED_NICHE_ACTIVITY:
      case NicheMarketAlertType.SPECIALIST_CONVERGENCE:
        parts.push(`Wallets Involved: ${context.relatedWallets.length}`);
        if (context.relatedMarkets.length > 0) {
          parts.push(`Related Markets: ${context.relatedMarkets.length}`);
        }
        break;
    }

    // Additional context
    if (context.market.volume24hUsd !== null) {
      parts.push(`24h Volume: $${context.market.volume24hUsd.toLocaleString()}`);
    }

    // Flags/Notes
    if (context.flags.length > 0) {
      parts.push("");
      parts.push("Flags:");
      for (const flag of context.flags.slice(0, 5)) {
        parts.push(`  - ${flag}`);
      }
    }

    // Recurring indicator
    if (context.isRecurring) {
      parts.push("");
      parts.push(`Recurring alert (${context.recentAlertCount} alerts in recent window)`);
    }

    return parts.join("\n");
  }

  private generateTags(
    type: NicheMarketAlertType,
    severity: NicheAlertSeverity,
    context: NicheAlertContext
  ): string[] {
    const tags: string[] = [
      type.toLowerCase(),
      severity.toLowerCase(),
      context.market.category.toLowerCase(),
    ];

    if (context.market.isThinMarket) {
      tags.push("thin_market");
    }

    if (context.market.isOnWatchlist) {
      tags.push("watchlist");
    }

    if (context.wallet !== null) {
      tags.push("wallet_specific");
      tags.push(context.wallet.specialistType.toLowerCase());
    }

    if (context.correlation !== null) {
      tags.push("cross_market");
      tags.push(context.correlation.correlationType.toLowerCase());
    }

    if (context.market.regulatoryAgency !== null) {
      tags.push("regulatory");
    }

    if (context.isRecurring) {
      tags.push("recurring");
    }

    if (context.insiderAdvantageMultiplier >= 2.0) {
      tags.push("high_insider_multiplier");
    }

    return tags;
  }

  private getSeverityPrefix(severity: NicheAlertSeverity): string {
    switch (severity) {
      case NicheAlertSeverity.CRITICAL:
        return "[CRITICAL] ";
      case NicheAlertSeverity.HIGH:
        return "[HIGH] ";
      case NicheAlertSeverity.MEDIUM:
        return "[MEDIUM] ";
      case NicheAlertSeverity.LOW:
      default:
        return "";
    }
  }

  private storeAlert(alert: NicheMarketAlert): void {
    // Enforce max stored alerts
    if (this.storedAlerts.size >= this.maxStoredAlerts) {
      // Remove oldest alert
      const oldestId = this.storedAlerts.keys().next().value;
      if (oldestId) {
        this.storedAlerts.delete(oldestId);
      }
    }

    this.storedAlerts.set(alert.id, alert);
  }

  private async notifyListeners(alert: NicheMarketAlert): Promise<void> {
    // Emit events
    if (this.enableEvents) {
      this.emit("alertGenerated", alert);

      if (alert.severity === NicheAlertSeverity.CRITICAL) {
        this.emit("criticalAlert", alert);
      } else if (alert.severity === NicheAlertSeverity.HIGH) {
        this.emit("highAlert", alert);
      }
    }

    // Notify custom listeners
    for (const listener of this.alertListeners) {
      try {
        await listener(alert);
      } catch {
        // Silently ignore listener errors
      }
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedGenerator: NicheMarketAlertGenerator | null = null;

/**
 * Create a new NicheMarketAlertGenerator instance
 */
export function createNicheMarketAlertGenerator(
  config?: NicheMarketAlertGeneratorConfig
): NicheMarketAlertGenerator {
  return new NicheMarketAlertGenerator(config);
}

/**
 * Get the shared NicheMarketAlertGenerator instance
 */
export function getSharedNicheMarketAlertGenerator(): NicheMarketAlertGenerator {
  if (!sharedGenerator) {
    sharedGenerator = new NicheMarketAlertGenerator();
  }
  return sharedGenerator;
}

/**
 * Set the shared NicheMarketAlertGenerator instance
 */
export function setSharedNicheMarketAlertGenerator(
  generator: NicheMarketAlertGenerator
): void {
  sharedGenerator = generator;
}

/**
 * Reset the shared NicheMarketAlertGenerator instance
 */
export function resetSharedNicheMarketAlertGenerator(): void {
  if (sharedGenerator) {
    sharedGenerator.clearAlerts();
    sharedGenerator.removeAllListeners();
  }
  sharedGenerator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate niche market alerts (convenience function)
 */
export function generateNicheMarketAlerts(
  options?: { generator?: NicheMarketAlertGenerator }
): NicheMarketAlert[] {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  return generator.getAllAlerts();
}

/**
 * Get niche market alerts by type (convenience function)
 */
export function getNicheMarketAlertsByType(
  type: NicheMarketAlertType,
  options?: { generator?: NicheMarketAlertGenerator }
): NicheMarketAlert[] {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  return generator.getAlertsByType(type);
}

/**
 * Get niche market alerts by severity (convenience function)
 */
export function getNicheMarketAlertsBySeverity(
  severity: NicheAlertSeverity,
  options?: { generator?: NicheMarketAlertGenerator }
): NicheMarketAlert[] {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  return generator.getAlertsBySeverity(severity);
}

/**
 * Get niche market alert summary (convenience function)
 */
export function getNicheMarketAlertSummary(
  options?: { generator?: NicheMarketAlertGenerator }
): NicheAlertSummary {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  return generator.getSummary();
}

/**
 * Check if niche alert should be triggered (convenience function)
 */
export function shouldTriggerNicheAlert(
  context: NicheAlertContext,
  options?: { generator?: NicheMarketAlertGenerator }
): boolean {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  const conditions = generator.getEnabledConditions();

  for (const condition of conditions) {
    if (condition.predicate?.(context) ?? false) {
      return true;
    }

    // Check other thresholds
    if (
      condition.minInsiderAdvantageScore !== undefined &&
      context.market.informationAdvantageScore !== null &&
      context.market.informationAdvantageScore >= condition.minInsiderAdvantageScore
    ) {
      return true;
    }

    if (
      condition.minConcentrationScore !== undefined &&
      context.wallet !== null &&
      context.wallet.concentrationScore >= condition.minConcentrationScore
    ) {
      return true;
    }

    if (
      condition.minCorrelationScore !== undefined &&
      context.correlation !== null &&
      context.correlation.correlationScore >= condition.minCorrelationScore
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get niche market alerts for a market (convenience function)
 */
export function getNicheMarketAlertsForMarket(
  marketId: string,
  options?: { generator?: NicheMarketAlertGenerator }
): NicheMarketAlert[] {
  const generator = options?.generator ?? getSharedNicheMarketAlertGenerator();
  return generator.getAlertsForMarket(marketId);
}
