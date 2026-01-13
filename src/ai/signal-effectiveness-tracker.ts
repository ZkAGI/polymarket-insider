/**
 * Signal Effectiveness Tracker (AI-PRED-003)
 *
 * Tracks which signals historically predicted market outcomes accurately.
 * Provides metrics for evaluating signal quality and ranking signals by
 * their predictive value.
 *
 * Features:
 * - Log signal occurrences with market context
 * - Track subsequent market outcomes after signals
 * - Calculate signal effectiveness metrics (precision, recall, lift, etc.)
 * - Rank signals by predictive value
 * - Support filtering by time window and market category
 * - Historical effectiveness trends over time
 * - Event emission for monitoring
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Signal types that can be tracked for effectiveness
 */
export enum TrackedSignalType {
  /** Large trade from potential insider */
  INSIDER_TRADE = "INSIDER_TRADE",
  /** Volume spike in market */
  VOLUME_SPIKE = "VOLUME_SPIKE",
  /** Fresh wallet activity */
  FRESH_WALLET = "FRESH_WALLET",
  /** Whale trade */
  WHALE_TRADE = "WHALE_TRADE",
  /** Coordinated trading cluster */
  COORDINATED_CLUSTER = "COORDINATED_CLUSTER",
  /** Pre-event timing signal */
  PRE_EVENT_TIMING = "PRE_EVENT_TIMING",
  /** Price movement anomaly */
  PRICE_ANOMALY = "PRICE_ANOMALY",
  /** Order book imbalance */
  ORDER_BOOK_IMBALANCE = "ORDER_BOOK_IMBALANCE",
  /** Unusual market selection pattern */
  MARKET_SELECTION = "MARKET_SELECTION",
  /** High win rate trader activity */
  HIGH_WIN_RATE = "HIGH_WIN_RATE",
  /** Sybil attack detected */
  SYBIL_DETECTION = "SYBIL_DETECTION",
  /** Wallet reactivation after dormancy */
  WALLET_REACTIVATION = "WALLET_REACTIVATION",
}

/**
 * Signal direction prediction
 */
export enum SignalPrediction {
  /** Signal suggests YES outcome */
  YES = "YES",
  /** Signal suggests NO outcome */
  NO = "NO",
  /** Signal is directionally neutral (just indicates activity) */
  NEUTRAL = "NEUTRAL",
}

/**
 * Signal outcome verification status
 */
export enum SignalOutcomeStatus {
  /** Market not yet resolved */
  PENDING = "PENDING",
  /** Market resolved, outcome verified */
  VERIFIED = "VERIFIED",
  /** Market cancelled or voided */
  CANCELLED = "CANCELLED",
  /** Signal expired (too old or market didn't resolve in expected time) */
  EXPIRED = "EXPIRED",
}

/**
 * Time window for effectiveness analysis
 */
export enum EffectivenessTimeWindow {
  /** Last 24 hours */
  LAST_24H = "LAST_24H",
  /** Last 7 days */
  LAST_7D = "LAST_7D",
  /** Last 30 days */
  LAST_30D = "LAST_30D",
  /** Last 90 days */
  LAST_90D = "LAST_90D",
  /** Last year */
  LAST_YEAR = "LAST_YEAR",
  /** All time */
  ALL_TIME = "ALL_TIME",
}

/**
 * Effectiveness ranking tier
 */
export enum EffectivenessTier {
  /** Exceptional effectiveness (top performer) */
  EXCEPTIONAL = "EXCEPTIONAL",
  /** High effectiveness */
  HIGH = "HIGH",
  /** Medium effectiveness */
  MEDIUM = "MEDIUM",
  /** Low effectiveness */
  LOW = "LOW",
  /** Poor effectiveness (below baseline) */
  POOR = "POOR",
  /** Insufficient data for tier assessment */
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}

/**
 * Individual signal occurrence record
 */
export interface SignalOccurrence {
  /** Unique occurrence ID */
  occurrenceId: string;
  /** Signal type */
  signalType: TrackedSignalType;
  /** Market ID */
  marketId: string;
  /** Market category */
  marketCategory?: string;
  /** Predicted direction (what outcome does signal suggest) */
  predictedDirection: SignalPrediction;
  /** Signal strength (0-1) */
  strength: number;
  /** Signal confidence (0-1) */
  confidence: number;
  /** Associated wallet address if applicable */
  walletAddress?: string;
  /** Trade size in USD if applicable */
  tradeSizeUsd?: number;
  /** Additional signal metadata */
  metadata?: Record<string, unknown>;
  /** Signal timestamp */
  timestamp: Date;
  /** Time until market resolution when signal occurred (hours) */
  hoursUntilResolution?: number;
  /** Outcome status */
  outcomeStatus: SignalOutcomeStatus;
  /** Actual market outcome (YES/NO) if resolved */
  actualOutcome?: "YES" | "NO" | null;
  /** Resolution timestamp if resolved */
  resolvedAt?: Date;
  /** Was the prediction correct */
  wasCorrect?: boolean;
}

/**
 * Effectiveness metrics for a signal type
 */
export interface SignalEffectivenessMetrics {
  /** Signal type */
  signalType: TrackedSignalType;
  /** Total occurrences tracked */
  totalOccurrences: number;
  /** Verified outcomes (market resolved) */
  verifiedOutcomes: number;
  /** Correct predictions count */
  correctPredictions: number;
  /** Incorrect predictions count */
  incorrectPredictions: number;
  /** Accuracy rate (correct / verified) */
  accuracy: number;
  /** Precision (true positives / predicted positives) */
  precision: number;
  /** Recall (true positives / actual positives) */
  recall: number;
  /** F1 score (harmonic mean of precision and recall) */
  f1Score: number;
  /** Lift (how much better than random) */
  lift: number;
  /** Average signal strength when correct */
  avgStrengthWhenCorrect: number;
  /** Average signal strength when incorrect */
  avgStrengthWhenIncorrect: number;
  /** Average confidence when correct */
  avgConfidenceWhenCorrect: number;
  /** Average confidence when incorrect */
  avgConfidenceWhenIncorrect: number;
  /** Hit rate by strength quartile */
  hitRateByStrength: {
    low: number; // 0-0.25
    medium: number; // 0.25-0.5
    high: number; // 0.5-0.75
    veryHigh: number; // 0.75-1.0
  };
  /** Average hours before resolution for correct signals */
  avgHoursBeforeResolutionWhenCorrect: number;
  /** Profitability score (if we traded on this signal) */
  profitabilityScore: number;
  /** Effectiveness tier */
  tier: EffectivenessTier;
  /** Confidence interval (95%) */
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  /** Trend (is effectiveness improving or declining) */
  trend: "IMPROVING" | "STABLE" | "DECLINING" | "UNKNOWN";
  /** Time window this analysis covers */
  timeWindow: EffectivenessTimeWindow;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Effectiveness metrics by category
 */
export interface CategoryEffectivenessMetrics {
  /** Market category */
  category: string;
  /** Signal type */
  signalType: TrackedSignalType;
  /** Total occurrences in this category */
  totalOccurrences: number;
  /** Verified outcomes */
  verifiedOutcomes: number;
  /** Accuracy rate */
  accuracy: number;
  /** Lift compared to overall */
  liftVsOverall: number;
  /** Is this signal particularly effective in this category */
  isStrong: boolean;
}

/**
 * Signal ranking entry
 */
export interface SignalRanking {
  /** Rank position (1 = best) */
  rank: number;
  /** Signal type */
  signalType: TrackedSignalType;
  /** Effectiveness score (composite) */
  effectivenessScore: number;
  /** Accuracy rate */
  accuracy: number;
  /** Lift */
  lift: number;
  /** Sample size */
  sampleSize: number;
  /** Effectiveness tier */
  tier: EffectivenessTier;
  /** Rank change from previous period */
  rankChange?: number;
  /** Description of signal value */
  description: string;
}

/**
 * Historical effectiveness point
 */
export interface HistoricalEffectivenessPoint {
  /** Date */
  date: Date;
  /** Accuracy at this point */
  accuracy: number;
  /** Cumulative sample size */
  sampleSize: number;
  /** 7-day rolling accuracy */
  rollingAccuracy7d: number;
  /** 30-day rolling accuracy */
  rollingAccuracy30d: number;
}

/**
 * Historical effectiveness trend
 */
export interface HistoricalEffectivenessTrend {
  /** Signal type */
  signalType: TrackedSignalType;
  /** Data points */
  dataPoints: HistoricalEffectivenessPoint[];
  /** Overall trend direction */
  trendDirection: "UP" | "DOWN" | "STABLE" | "VOLATILE";
  /** Slope of trend line */
  trendSlope: number;
  /** Trend confidence */
  trendConfidence: number;
  /** Best performing period */
  bestPeriod?: {
    start: Date;
    end: Date;
    accuracy: number;
  };
  /** Worst performing period */
  worstPeriod?: {
    start: Date;
    end: Date;
    accuracy: number;
  };
}

/**
 * Batch update result
 */
export interface BatchOutcomeUpdateResult {
  /** Total updates processed */
  totalProcessed: number;
  /** Successfully updated */
  updated: number;
  /** Skipped (not found or already verified) */
  skipped: number;
  /** Errors encountered */
  errors: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Signal comparison result
 */
export interface SignalComparisonResult {
  /** First signal type */
  signalA: TrackedSignalType;
  /** Second signal type */
  signalB: TrackedSignalType;
  /** Accuracy difference (A - B) */
  accuracyDifference: number;
  /** Lift difference (A - B) */
  liftDifference: number;
  /** Is difference statistically significant */
  isSignificant: boolean;
  /** P-value of comparison */
  pValue: number;
  /** Recommended signal */
  recommended: TrackedSignalType;
  /** Recommendation confidence */
  recommendationConfidence: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Tracker configuration
 */
export interface SignalEffectivenessTrackerConfig {
  /** Minimum samples required for tier assessment */
  minSamplesForTier: number;
  /** Minimum samples for statistical significance */
  minSamplesForSignificance: number;
  /** Baseline accuracy (random guess) */
  baselineAccuracy: number;
  /** Tier thresholds */
  tierThresholds: {
    exceptional: number; // accuracy >= this
    high: number;
    medium: number;
    low: number;
    // below low = poor
  };
  /** Enable caching */
  cacheEnabled: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
  /** Cache max size */
  cacheMaxSize: number;
  /** Auto-expire pending signals older than this (hours) */
  pendingExpirationHours: number;
  /** Historical data retention days */
  historicalRetentionDays: number;
}

/**
 * Tracker events
 */
export interface SignalEffectivenessTrackerEvents {
  /** Signal logged */
  signal_logged: SignalOccurrence;
  /** Outcome recorded */
  outcome_recorded: {
    occurrenceId: string;
    signalType: TrackedSignalType;
    marketId: string;
    predictedDirection: SignalPrediction;
    actualOutcome: "YES" | "NO";
    wasCorrect: boolean;
  };
  /** Batch outcomes updated */
  batch_updated: BatchOutcomeUpdateResult;
  /** Metrics calculated */
  metrics_calculated: SignalEffectivenessMetrics;
  /** Ranking updated */
  ranking_updated: SignalRanking[];
  /** Signal promoted to higher tier */
  tier_promotion: {
    signalType: TrackedSignalType;
    fromTier: EffectivenessTier;
    toTier: EffectivenessTier;
  };
  /** Signal demoted to lower tier */
  tier_demotion: {
    signalType: TrackedSignalType;
    fromTier: EffectivenessTier;
    toTier: EffectivenessTier;
  };
  /** Cache hit */
  cache_hit: { key: string };
  /** Cache miss */
  cache_miss: { key: string };
  /** Error */
  error: { message: string; context?: string };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_TRACKER_CONFIG: SignalEffectivenessTrackerConfig = {
  minSamplesForTier: 30,
  minSamplesForSignificance: 100,
  baselineAccuracy: 0.5, // Random guess for binary outcome
  tierThresholds: {
    exceptional: 0.75,
    high: 0.65,
    medium: 0.55,
    low: 0.45,
  },
  cacheEnabled: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  cacheMaxSize: 1000,
  pendingExpirationHours: 168 * 2, // 2 weeks
  historicalRetentionDays: 365,
};

/**
 * Signal type descriptions
 */
export const SIGNAL_TYPE_DESCRIPTIONS: Record<TrackedSignalType, string> = {
  [TrackedSignalType.INSIDER_TRADE]: "Large trades from wallets with high insider probability",
  [TrackedSignalType.VOLUME_SPIKE]: "Unusual volume spikes in market trading",
  [TrackedSignalType.FRESH_WALLET]: "Trading activity from newly created wallets",
  [TrackedSignalType.WHALE_TRADE]: "Very large trades from high-net-worth wallets",
  [TrackedSignalType.COORDINATED_CLUSTER]: "Coordinated trading from wallet clusters",
  [TrackedSignalType.PRE_EVENT_TIMING]: "Trading concentrated before scheduled events",
  [TrackedSignalType.PRICE_ANOMALY]: "Unusual price movements or patterns",
  [TrackedSignalType.ORDER_BOOK_IMBALANCE]: "Significant imbalance in buy/sell orders",
  [TrackedSignalType.MARKET_SELECTION]: "Unusual focus on specific market categories",
  [TrackedSignalType.HIGH_WIN_RATE]: "Activity from wallets with exceptional win rates",
  [TrackedSignalType.SYBIL_DETECTION]: "Suspected sybil attack activity",
  [TrackedSignalType.WALLET_REACTIVATION]: "Dormant wallets suddenly becoming active",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique occurrence ID
 */
export function generateOccurrenceId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get signal type description
 */
export function getSignalTypeDescription(type: TrackedSignalType): string {
  return SIGNAL_TYPE_DESCRIPTIONS[type] || "Unknown signal type";
}

/**
 * Get effectiveness tier from accuracy
 */
export function getEffectivenessTier(
  accuracy: number,
  sampleSize: number,
  config: SignalEffectivenessTrackerConfig
): EffectivenessTier {
  if (sampleSize < config.minSamplesForTier) {
    return EffectivenessTier.INSUFFICIENT_DATA;
  }

  if (accuracy >= config.tierThresholds.exceptional) {
    return EffectivenessTier.EXCEPTIONAL;
  }
  if (accuracy >= config.tierThresholds.high) {
    return EffectivenessTier.HIGH;
  }
  if (accuracy >= config.tierThresholds.medium) {
    return EffectivenessTier.MEDIUM;
  }
  if (accuracy >= config.tierThresholds.low) {
    return EffectivenessTier.LOW;
  }
  return EffectivenessTier.POOR;
}

/**
 * Get tier description
 */
export function getEffectivenessTierDescription(tier: EffectivenessTier): string {
  switch (tier) {
    case EffectivenessTier.EXCEPTIONAL:
      return "Exceptional predictor - highly valuable signal";
    case EffectivenessTier.HIGH:
      return "High effectiveness - reliable signal";
    case EffectivenessTier.MEDIUM:
      return "Medium effectiveness - useful with other signals";
    case EffectivenessTier.LOW:
      return "Low effectiveness - limited predictive value";
    case EffectivenessTier.POOR:
      return "Poor effectiveness - may be counterproductive";
    case EffectivenessTier.INSUFFICIENT_DATA:
      return "Insufficient data - need more samples";
    default:
      return "Unknown tier";
  }
}

/**
 * Get tier color for UI
 */
export function getEffectivenessTierColor(tier: EffectivenessTier): string {
  switch (tier) {
    case EffectivenessTier.EXCEPTIONAL:
      return "#10B981"; // Green
    case EffectivenessTier.HIGH:
      return "#3B82F6"; // Blue
    case EffectivenessTier.MEDIUM:
      return "#F59E0B"; // Yellow
    case EffectivenessTier.LOW:
      return "#F97316"; // Orange
    case EffectivenessTier.POOR:
      return "#EF4444"; // Red
    case EffectivenessTier.INSUFFICIENT_DATA:
      return "#9CA3AF"; // Gray
    default:
      return "#6B7280";
  }
}

/**
 * Calculate lift (improvement over baseline)
 */
export function calculateLift(accuracy: number, baseline: number): number {
  if (baseline === 0) return accuracy > 0 ? Infinity : 1;
  return accuracy / baseline;
}

/**
 * Calculate confidence interval for accuracy (Wilson score interval)
 */
export function calculateConfidenceInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  if (total === 0) {
    return { lower: 0, upper: 1 };
  }

  // Z-score for confidence level
  const z = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;

  const phat = successes / total;
  const denominator = 1 + (z * z) / total;

  const center = (phat + (z * z) / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) / denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/**
 * Calculate F1 score from precision and recall
 */
export function calculateF1Score(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Get time window in milliseconds
 */
export function getTimeWindowMs(window: EffectivenessTimeWindow): number {
  switch (window) {
    case EffectivenessTimeWindow.LAST_24H:
      return 24 * 60 * 60 * 1000;
    case EffectivenessTimeWindow.LAST_7D:
      return 7 * 24 * 60 * 60 * 1000;
    case EffectivenessTimeWindow.LAST_30D:
      return 30 * 24 * 60 * 60 * 1000;
    case EffectivenessTimeWindow.LAST_90D:
      return 90 * 24 * 60 * 60 * 1000;
    case EffectivenessTimeWindow.LAST_YEAR:
      return 365 * 24 * 60 * 60 * 1000;
    case EffectivenessTimeWindow.ALL_TIME:
      return Infinity;
    default:
      return Infinity;
  }
}

/**
 * Get cutoff date for time window
 */
export function getTimeWindowCutoff(window: EffectivenessTimeWindow): Date {
  const ms = getTimeWindowMs(window);
  if (ms === Infinity) {
    return new Date(0); // Beginning of time
  }
  return new Date(Date.now() - ms);
}

/**
 * Format accuracy as percentage
 */
export function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1)}%`;
}

/**
 * Format lift value
 */
export function formatLift(lift: number): string {
  if (!isFinite(lift)) return "∞";
  return `${lift.toFixed(2)}x`;
}

/**
 * Determine trend direction from data points
 */
export function determineTrend(
  dataPoints: number[],
  minPoints: number = 5
): "UP" | "DOWN" | "STABLE" | "VOLATILE" {
  if (dataPoints.length < minPoints) {
    return "STABLE";
  }

  // Calculate linear regression slope
  const n = dataPoints.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const val = dataPoints[i]!;
    sumX += i;
    sumY += val;
    sumXY += i * val;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Calculate variance to detect volatility
  const mean = sumY / n;
  let variance = 0;
  for (const val of dataPoints) {
    variance += (val - mean) ** 2;
  }
  variance /= n;
  const stdDev = Math.sqrt(variance);

  // High variance relative to mean indicates volatility
  if (stdDev / Math.abs(mean) > 0.3) {
    return "VOLATILE";
  }

  // Threshold for slope significance
  if (slope > 0.01) return "UP";
  if (slope < -0.01) return "DOWN";
  return "STABLE";
}

/**
 * Calculate statistical significance (simplified chi-square test)
 */
export function isStatisticallySignificant(
  successesA: number,
  totalA: number,
  successesB: number,
  totalB: number,
  alpha: number = 0.05
): { significant: boolean; pValue: number } {
  if (totalA === 0 || totalB === 0) {
    return { significant: false, pValue: 1.0 };
  }

  const pA = successesA / totalA;
  const pB = successesB / totalB;
  const pPooled = (successesA + successesB) / (totalA + totalB);

  if (pPooled === 0 || pPooled === 1) {
    return { significant: false, pValue: 1.0 };
  }

  // Z-test for two proportions
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / totalA + 1 / totalB));
  if (se === 0) {
    return { significant: false, pValue: 1.0 };
  }

  const z = (pA - pB) / se;

  // Two-tailed p-value approximation
  const absZ = Math.abs(z);
  const pValue = 2 * (1 - normalCDF(absZ));

  return {
    significant: pValue < alpha,
    pValue,
  };
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Signal Effectiveness Tracker
 *
 * Tracks signal occurrences and their outcomes to measure effectiveness.
 */
export class SignalEffectivenessTracker extends EventEmitter {
  private config: SignalEffectivenessTrackerConfig;
  private occurrences: Map<string, SignalOccurrence> = new Map();
  private occurrencesBySignalType: Map<TrackedSignalType, Set<string>> = new Map();
  private occurrencesByMarket: Map<string, Set<string>> = new Map();
  private metricsCache: Map<string, { metrics: SignalEffectivenessMetrics; expiresAt: number }> =
    new Map();
  private rankingCache: { rankings: SignalRanking[]; expiresAt: number } | null = null;
  private previousTiers: Map<TrackedSignalType, EffectivenessTier> = new Map();

  constructor(config: Partial<SignalEffectivenessTrackerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };

    // Initialize signal type maps
    for (const signalType of Object.values(TrackedSignalType)) {
      this.occurrencesBySignalType.set(signalType, new Set());
    }
  }

  // --------------------------------------------------------------------------
  // Signal Logging
  // --------------------------------------------------------------------------

  /**
   * Log a new signal occurrence
   */
  logSignal(params: {
    signalType: TrackedSignalType;
    marketId: string;
    predictedDirection: SignalPrediction;
    strength: number;
    confidence: number;
    marketCategory?: string;
    walletAddress?: string;
    tradeSizeUsd?: number;
    hoursUntilResolution?: number;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
  }): SignalOccurrence {
    const occurrence: SignalOccurrence = {
      occurrenceId: generateOccurrenceId(),
      signalType: params.signalType,
      marketId: params.marketId,
      marketCategory: params.marketCategory,
      predictedDirection: params.predictedDirection,
      strength: Math.max(0, Math.min(1, params.strength)),
      confidence: Math.max(0, Math.min(1, params.confidence)),
      walletAddress: params.walletAddress,
      tradeSizeUsd: params.tradeSizeUsd,
      hoursUntilResolution: params.hoursUntilResolution,
      metadata: params.metadata,
      timestamp: params.timestamp || new Date(),
      outcomeStatus: SignalOutcomeStatus.PENDING,
    };

    // Store occurrence
    this.occurrences.set(occurrence.occurrenceId, occurrence);

    // Index by signal type
    const typeSet = this.occurrencesBySignalType.get(params.signalType);
    if (typeSet) {
      typeSet.add(occurrence.occurrenceId);
    }

    // Index by market
    let marketSet = this.occurrencesByMarket.get(params.marketId);
    if (!marketSet) {
      marketSet = new Set();
      this.occurrencesByMarket.set(params.marketId, marketSet);
    }
    marketSet.add(occurrence.occurrenceId);

    // Invalidate caches
    this.invalidateCaches(params.signalType);

    // Emit event
    this.emit("signal_logged", occurrence);

    return occurrence;
  }

  /**
   * Log multiple signals at once
   */
  logSignalBatch(
    signals: Array<{
      signalType: TrackedSignalType;
      marketId: string;
      predictedDirection: SignalPrediction;
      strength: number;
      confidence: number;
      marketCategory?: string;
      walletAddress?: string;
      tradeSizeUsd?: number;
      hoursUntilResolution?: number;
      metadata?: Record<string, unknown>;
      timestamp?: Date;
    }>
  ): SignalOccurrence[] {
    return signals.map((signal) => this.logSignal(signal));
  }

  // --------------------------------------------------------------------------
  // Outcome Recording
  // --------------------------------------------------------------------------

  /**
   * Record market outcome for a specific signal occurrence
   */
  recordOutcome(occurrenceId: string, actualOutcome: "YES" | "NO"): boolean {
    const occurrence = this.occurrences.get(occurrenceId);
    if (!occurrence) {
      this.emit("error", { message: `Occurrence not found: ${occurrenceId}` });
      return false;
    }

    if (occurrence.outcomeStatus === SignalOutcomeStatus.VERIFIED) {
      // Already verified
      return false;
    }

    // Determine if prediction was correct
    let wasCorrect: boolean;
    if (occurrence.predictedDirection === SignalPrediction.NEUTRAL) {
      // Neutral signals are always considered "correct" as they don't predict direction
      wasCorrect = true;
    } else {
      const predictedYes = occurrence.predictedDirection === SignalPrediction.YES;
      wasCorrect = (predictedYes && actualOutcome === "YES") || (!predictedYes && actualOutcome === "NO");
    }

    // Update occurrence
    occurrence.actualOutcome = actualOutcome;
    occurrence.outcomeStatus = SignalOutcomeStatus.VERIFIED;
    occurrence.resolvedAt = new Date();
    occurrence.wasCorrect = wasCorrect;

    // Invalidate caches
    this.invalidateCaches(occurrence.signalType);

    // Emit event
    this.emit("outcome_recorded", {
      occurrenceId,
      signalType: occurrence.signalType,
      marketId: occurrence.marketId,
      predictedDirection: occurrence.predictedDirection,
      actualOutcome,
      wasCorrect,
    });

    return true;
  }

  /**
   * Record outcome for all signals in a market
   */
  recordMarketOutcome(marketId: string, actualOutcome: "YES" | "NO"): number {
    const marketOccurrences = this.occurrencesByMarket.get(marketId);
    if (!marketOccurrences) {
      return 0;
    }

    let updatedCount = 0;
    for (const occurrenceId of marketOccurrences) {
      if (this.recordOutcome(occurrenceId, actualOutcome)) {
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Batch update outcomes for multiple markets
   */
  recordOutcomesBatch(
    outcomes: Array<{ marketId: string; outcome: "YES" | "NO" }>
  ): BatchOutcomeUpdateResult {
    const startTime = Date.now();
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const { marketId, outcome } of outcomes) {
      try {
        const count = this.recordMarketOutcome(marketId, outcome);
        if (count > 0) {
          updated += count;
        } else {
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    const result: BatchOutcomeUpdateResult = {
      totalProcessed: outcomes.length,
      updated,
      skipped,
      errors,
      processingTimeMs: Date.now() - startTime,
    };

    this.emit("batch_updated", result);

    return result;
  }

  /**
   * Mark signal as expired (market didn't resolve in expected time)
   */
  expireSignal(occurrenceId: string): boolean {
    const occurrence = this.occurrences.get(occurrenceId);
    if (!occurrence || occurrence.outcomeStatus !== SignalOutcomeStatus.PENDING) {
      return false;
    }

    occurrence.outcomeStatus = SignalOutcomeStatus.EXPIRED;
    this.invalidateCaches(occurrence.signalType);

    return true;
  }

  /**
   * Expire all pending signals older than threshold
   */
  expireOldSignals(): number {
    const cutoffTime = Date.now() - this.config.pendingExpirationHours * 60 * 60 * 1000;
    let expiredCount = 0;

    for (const [occurrenceId, occurrence] of this.occurrences) {
      if (
        occurrence.outcomeStatus === SignalOutcomeStatus.PENDING &&
        occurrence.timestamp.getTime() < cutoffTime
      ) {
        if (this.expireSignal(occurrenceId)) {
          expiredCount++;
        }
      }
    }

    return expiredCount;
  }

  // --------------------------------------------------------------------------
  // Effectiveness Metrics
  // --------------------------------------------------------------------------

  /**
   * Calculate effectiveness metrics for a signal type
   */
  calculateEffectiveness(
    signalType: TrackedSignalType,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME,
    category?: string
  ): SignalEffectivenessMetrics {
    // Check cache
    const cacheKey = `${signalType}_${timeWindow}_${category || "all"}`;
    if (this.config.cacheEnabled) {
      const cached = this.metricsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.emit("cache_hit", { key: cacheKey });
        return cached.metrics;
      }
      this.emit("cache_miss", { key: cacheKey });
    }

    const cutoff = getTimeWindowCutoff(timeWindow);
    const occurrenceIds = this.occurrencesBySignalType.get(signalType) || new Set();

    // Filter occurrences by time window and category
    const filtered: SignalOccurrence[] = [];
    for (const id of occurrenceIds) {
      const occ = this.occurrences.get(id);
      if (!occ) continue;
      if (occ.timestamp < cutoff) continue;
      if (category && occ.marketCategory !== category) continue;
      filtered.push(occ);
    }

    // Calculate metrics
    const verified = filtered.filter((o) => o.outcomeStatus === SignalOutcomeStatus.VERIFIED);
    const correct = verified.filter((o) => o.wasCorrect);
    const incorrect = verified.filter((o) => !o.wasCorrect);

    // For directional signals only (exclude NEUTRAL for accuracy calculation)
    const directional = verified.filter((o) => o.predictedDirection !== SignalPrediction.NEUTRAL);
    const directionalCorrect = directional.filter((o) => o.wasCorrect);

    // Calculate accuracy
    const accuracy = directional.length > 0 ? directionalCorrect.length / directional.length : 0;

    // Calculate precision and recall for YES predictions
    const predictedYes = directional.filter((o) => o.predictedDirection === SignalPrediction.YES);
    const actualYes = directional.filter((o) => o.actualOutcome === "YES");
    const truePositives = predictedYes.filter(
      (o) => o.actualOutcome === "YES" && o.wasCorrect
    ).length;
    const falsePositives = predictedYes.filter(
      (o) => o.actualOutcome === "NO" && !o.wasCorrect
    ).length;
    const falseNegatives = actualYes.filter(
      (o) => o.predictedDirection === SignalPrediction.NO
    ).length;

    const precision =
      truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall =
      truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = calculateF1Score(precision, recall);

    // Calculate lift
    const lift = calculateLift(accuracy, this.config.baselineAccuracy);

    // Calculate average strengths
    const avgStrengthWhenCorrect =
      correct.length > 0 ? correct.reduce((sum, o) => sum + o.strength, 0) / correct.length : 0;
    const avgStrengthWhenIncorrect =
      incorrect.length > 0
        ? incorrect.reduce((sum, o) => sum + o.strength, 0) / incorrect.length
        : 0;

    // Calculate average confidence
    const avgConfidenceWhenCorrect =
      correct.length > 0 ? correct.reduce((sum, o) => sum + o.confidence, 0) / correct.length : 0;
    const avgConfidenceWhenIncorrect =
      incorrect.length > 0
        ? incorrect.reduce((sum, o) => sum + o.confidence, 0) / incorrect.length
        : 0;

    // Hit rate by strength quartile
    const hitRateByStrength = this.calculateHitRateByStrength(directional);

    // Average hours before resolution when correct
    const correctWithHours = correct.filter((o) => o.hoursUntilResolution !== undefined);
    const avgHoursBeforeResolutionWhenCorrect =
      correctWithHours.length > 0
        ? correctWithHours.reduce((sum, o) => sum + (o.hoursUntilResolution || 0), 0) /
          correctWithHours.length
        : 0;

    // Profitability score (simplified: accuracy * average trade size normalized)
    const avgTradeSize =
      verified.length > 0
        ? verified.reduce((sum, o) => sum + (o.tradeSizeUsd || 0), 0) / verified.length
        : 0;
    const profitabilityScore = accuracy * Math.log10(avgTradeSize + 1) / 5; // Normalized

    // Calculate confidence interval
    const confidenceInterval = calculateConfidenceInterval(
      directionalCorrect.length,
      directional.length
    );

    // Determine tier
    const tier = getEffectivenessTier(accuracy, directional.length, this.config);

    // Check for tier changes
    this.checkTierChange(signalType, tier);

    // Determine trend
    const trend = this.calculateTrendDirection(signalType, timeWindow);

    const metrics: SignalEffectivenessMetrics = {
      signalType,
      totalOccurrences: filtered.length,
      verifiedOutcomes: verified.length,
      correctPredictions: correct.length,
      incorrectPredictions: incorrect.length,
      accuracy,
      precision,
      recall,
      f1Score,
      lift,
      avgStrengthWhenCorrect,
      avgStrengthWhenIncorrect,
      avgConfidenceWhenCorrect,
      avgConfidenceWhenIncorrect,
      hitRateByStrength,
      avgHoursBeforeResolutionWhenCorrect,
      profitabilityScore,
      tier,
      confidenceInterval,
      trend,
      timeWindow,
      analyzedAt: new Date(),
    };

    // Cache result
    if (this.config.cacheEnabled) {
      this.metricsCache.set(cacheKey, {
        metrics,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });

      // Enforce cache size limit
      if (this.metricsCache.size > this.config.cacheMaxSize) {
        const oldestKey = this.metricsCache.keys().next().value;
        if (oldestKey) {
          this.metricsCache.delete(oldestKey);
        }
      }
    }

    this.emit("metrics_calculated", metrics);

    return metrics;
  }

  /**
   * Calculate hit rate by strength quartile
   */
  private calculateHitRateByStrength(occurrences: SignalOccurrence[]): {
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  } {
    const quartiles = {
      low: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      high: { correct: 0, total: 0 },
      veryHigh: { correct: 0, total: 0 },
    };

    for (const occ of occurrences) {
      let quartile: keyof typeof quartiles;
      if (occ.strength < 0.25) quartile = "low";
      else if (occ.strength < 0.5) quartile = "medium";
      else if (occ.strength < 0.75) quartile = "high";
      else quartile = "veryHigh";

      quartiles[quartile].total++;
      if (occ.wasCorrect) {
        quartiles[quartile].correct++;
      }
    }

    return {
      low: quartiles.low.total > 0 ? quartiles.low.correct / quartiles.low.total : 0,
      medium: quartiles.medium.total > 0 ? quartiles.medium.correct / quartiles.medium.total : 0,
      high: quartiles.high.total > 0 ? quartiles.high.correct / quartiles.high.total : 0,
      veryHigh:
        quartiles.veryHigh.total > 0 ? quartiles.veryHigh.correct / quartiles.veryHigh.total : 0,
    };
  }

  /**
   * Check for tier changes and emit events
   */
  private checkTierChange(signalType: TrackedSignalType, newTier: EffectivenessTier): void {
    const previousTier = this.previousTiers.get(signalType);
    if (previousTier && previousTier !== newTier) {
      const tierRanks: Record<EffectivenessTier, number> = {
        [EffectivenessTier.EXCEPTIONAL]: 5,
        [EffectivenessTier.HIGH]: 4,
        [EffectivenessTier.MEDIUM]: 3,
        [EffectivenessTier.LOW]: 2,
        [EffectivenessTier.POOR]: 1,
        [EffectivenessTier.INSUFFICIENT_DATA]: 0,
      };

      if (tierRanks[newTier] > tierRanks[previousTier]) {
        this.emit("tier_promotion", {
          signalType,
          fromTier: previousTier,
          toTier: newTier,
        });
      } else {
        this.emit("tier_demotion", {
          signalType,
          fromTier: previousTier,
          toTier: newTier,
        });
      }
    }
    this.previousTiers.set(signalType, newTier);
  }

  /**
   * Calculate trend direction for a signal type
   */
  private calculateTrendDirection(
    signalType: TrackedSignalType,
    _timeWindow: EffectivenessTimeWindow
  ): "IMPROVING" | "STABLE" | "DECLINING" | "UNKNOWN" {
    const occurrenceIds = this.occurrencesBySignalType.get(signalType) || new Set();
    const verified: SignalOccurrence[] = [];

    for (const id of occurrenceIds) {
      const occ = this.occurrences.get(id);
      if (occ && occ.outcomeStatus === SignalOutcomeStatus.VERIFIED) {
        verified.push(occ);
      }
    }

    if (verified.length < 10) {
      return "UNKNOWN";
    }

    // Sort by timestamp
    verified.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate rolling accuracy (last 10 samples at each point)
    const accuracies: number[] = [];
    for (let i = 9; i < verified.length; i++) {
      const window = verified.slice(i - 9, i + 1);
      const correct = window.filter((o) => o.wasCorrect).length;
      accuracies.push(correct / window.length);
    }

    const trend = determineTrend(accuracies);

    switch (trend) {
      case "UP":
        return "IMPROVING";
      case "DOWN":
        return "DECLINING";
      case "STABLE":
        return "STABLE";
      default:
        return "UNKNOWN";
    }
  }

  /**
   * Get effectiveness metrics for all signal types
   */
  calculateAllEffectiveness(
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME,
    category?: string
  ): Map<TrackedSignalType, SignalEffectivenessMetrics> {
    const results = new Map<TrackedSignalType, SignalEffectivenessMetrics>();

    for (const signalType of Object.values(TrackedSignalType)) {
      const metrics = this.calculateEffectiveness(signalType, timeWindow, category);
      results.set(signalType, metrics);
    }

    return results;
  }

  /**
   * Get effectiveness by category for a signal type
   */
  calculateEffectivenessByCategory(
    signalType: TrackedSignalType,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME
  ): CategoryEffectivenessMetrics[] {
    const occurrenceIds = this.occurrencesBySignalType.get(signalType) || new Set();
    const cutoff = getTimeWindowCutoff(timeWindow);

    // Group by category
    const byCategory = new Map<
      string,
      { total: number; verified: number; correct: number }
    >();

    for (const id of occurrenceIds) {
      const occ = this.occurrences.get(id);
      if (!occ || occ.timestamp < cutoff) continue;

      const category = occ.marketCategory || "UNKNOWN";
      let stats = byCategory.get(category);
      if (!stats) {
        stats = { total: 0, verified: 0, correct: 0 };
        byCategory.set(category, stats);
      }

      stats.total++;
      if (occ.outcomeStatus === SignalOutcomeStatus.VERIFIED) {
        stats.verified++;
        if (occ.wasCorrect) {
          stats.correct++;
        }
      }
    }

    // Get overall accuracy for comparison
    const overallMetrics = this.calculateEffectiveness(signalType, timeWindow);

    const results: CategoryEffectivenessMetrics[] = [];
    for (const [category, stats] of byCategory) {
      const accuracy = stats.verified > 0 ? stats.correct / stats.verified : 0;
      const liftVsOverall =
        overallMetrics.accuracy > 0 ? accuracy / overallMetrics.accuracy : 1;

      results.push({
        category,
        signalType,
        totalOccurrences: stats.total,
        verifiedOutcomes: stats.verified,
        accuracy,
        liftVsOverall,
        isStrong: liftVsOverall > 1.1 && stats.verified >= 10, // 10%+ better and sufficient samples
      });
    }

    // Sort by accuracy
    results.sort((a, b) => b.accuracy - a.accuracy);

    return results;
  }

  // --------------------------------------------------------------------------
  // Signal Ranking
  // --------------------------------------------------------------------------

  /**
   * Get ranked list of signals by effectiveness
   */
  getRankedSignals(
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME,
    category?: string
  ): SignalRanking[] {
    // Check cache (cacheKey reserved for future per-category caching)
    const _cacheKey = `ranking_${timeWindow}_${category || "all"}`;
    void _cacheKey; // Acknowledge intentionally unused
    if (this.config.cacheEnabled && this.rankingCache && this.rankingCache.expiresAt > Date.now()) {
      return this.rankingCache.rankings;
    }

    const allMetrics = this.calculateAllEffectiveness(timeWindow, category);

    const rankings: SignalRanking[] = [];
    for (const [signalType, metrics] of allMetrics) {
      // Calculate composite score
      // Weights: accuracy (40%), lift (30%), sample size (20%), F1 (10%)
      const normalizedSampleSize = Math.min(metrics.verifiedOutcomes / 100, 1);
      const effectivenessScore =
        metrics.accuracy * 0.4 +
        Math.min(metrics.lift / 2, 1) * 0.3 +
        normalizedSampleSize * 0.2 +
        metrics.f1Score * 0.1;

      rankings.push({
        rank: 0, // Will be set after sorting
        signalType,
        effectivenessScore,
        accuracy: metrics.accuracy,
        lift: metrics.lift,
        sampleSize: metrics.verifiedOutcomes,
        tier: metrics.tier,
        description: SIGNAL_TYPE_DESCRIPTIONS[signalType],
      });
    }

    // Sort by effectiveness score
    rankings.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

    // Assign ranks
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    // Cache result
    if (this.config.cacheEnabled) {
      this.rankingCache = {
        rankings,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      };
    }

    this.emit("ranking_updated", rankings);

    return rankings;
  }

  /**
   * Get top N most effective signals
   */
  getTopSignals(
    n: number = 5,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME
  ): SignalRanking[] {
    return this.getRankedSignals(timeWindow).slice(0, n);
  }

  /**
   * Get signals above a certain tier
   */
  getSignalsAboveTier(
    minTier: EffectivenessTier,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME
  ): SignalRanking[] {
    const tierRanks: Record<EffectivenessTier, number> = {
      [EffectivenessTier.EXCEPTIONAL]: 5,
      [EffectivenessTier.HIGH]: 4,
      [EffectivenessTier.MEDIUM]: 3,
      [EffectivenessTier.LOW]: 2,
      [EffectivenessTier.POOR]: 1,
      [EffectivenessTier.INSUFFICIENT_DATA]: 0,
    };

    const minRank = tierRanks[minTier];
    return this.getRankedSignals(timeWindow).filter((r) => tierRanks[r.tier] >= minRank);
  }

  // --------------------------------------------------------------------------
  // Signal Comparison
  // --------------------------------------------------------------------------

  /**
   * Compare effectiveness of two signals
   */
  compareSignals(
    signalA: TrackedSignalType,
    signalB: TrackedSignalType,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.ALL_TIME
  ): SignalComparisonResult {
    const metricsA = this.calculateEffectiveness(signalA, timeWindow);
    const metricsB = this.calculateEffectiveness(signalB, timeWindow);

    const accuracyDifference = metricsA.accuracy - metricsB.accuracy;
    const liftDifference = metricsA.lift - metricsB.lift;

    // Statistical significance test
    const { significant, pValue } = isStatisticallySignificant(
      metricsA.correctPredictions,
      metricsA.verifiedOutcomes,
      metricsB.correctPredictions,
      metricsB.verifiedOutcomes
    );

    // Determine recommendation
    let recommended: TrackedSignalType;
    let recommendationConfidence: "HIGH" | "MEDIUM" | "LOW";

    if (
      significant &&
      Math.abs(accuracyDifference) > 0.05 &&
      metricsA.verifiedOutcomes >= this.config.minSamplesForSignificance &&
      metricsB.verifiedOutcomes >= this.config.minSamplesForSignificance
    ) {
      recommended = accuracyDifference > 0 ? signalA : signalB;
      recommendationConfidence = "HIGH";
    } else if (Math.abs(accuracyDifference) > 0.1) {
      recommended = accuracyDifference > 0 ? signalA : signalB;
      recommendationConfidence = "MEDIUM";
    } else {
      recommended = metricsA.verifiedOutcomes > metricsB.verifiedOutcomes ? signalA : signalB;
      recommendationConfidence = "LOW";
    }

    return {
      signalA,
      signalB,
      accuracyDifference,
      liftDifference,
      isSignificant: significant,
      pValue,
      recommended,
      recommendationConfidence,
    };
  }

  // --------------------------------------------------------------------------
  // Historical Analysis
  // --------------------------------------------------------------------------

  /**
   * Get historical effectiveness trend for a signal type
   */
  getHistoricalTrend(
    signalType: TrackedSignalType,
    timeWindow: EffectivenessTimeWindow = EffectivenessTimeWindow.LAST_90D
  ): HistoricalEffectivenessTrend {
    const occurrenceIds = this.occurrencesBySignalType.get(signalType) || new Set();
    const cutoff = getTimeWindowCutoff(timeWindow);

    // Collect verified occurrences
    const verified: SignalOccurrence[] = [];
    for (const id of occurrenceIds) {
      const occ = this.occurrences.get(id);
      if (occ && occ.outcomeStatus === SignalOutcomeStatus.VERIFIED && occ.timestamp >= cutoff) {
        verified.push(occ);
      }
    }

    // Sort by timestamp
    verified.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Group by day
    const byDay = new Map<string, { correct: number; total: number }>();
    for (const occ of verified) {
      const dayKey = occ.timestamp.toISOString().split("T")[0] || "unknown";
      let stats = byDay.get(dayKey);
      if (!stats) {
        stats = { correct: 0, total: 0 };
        byDay.set(dayKey, stats);
      }
      stats.total++;
      if (occ.wasCorrect) {
        stats.correct++;
      }
    }

    // Generate data points
    const dataPoints: HistoricalEffectivenessPoint[] = [];
    let cumulativeCorrect = 0;
    let cumulativeTotal = 0;
    const accuracyHistory: number[] = [];

    const sortedDays = Array.from(byDay.keys()).sort();
    for (const day of sortedDays) {
      const stats = byDay.get(day)!;
      cumulativeCorrect += stats.correct;
      cumulativeTotal += stats.total;

      const accuracy = cumulativeTotal > 0 ? cumulativeCorrect / cumulativeTotal : 0;
      accuracyHistory.push(accuracy);

      // Calculate rolling averages
      const last7 = accuracyHistory.slice(-7);
      const last30 = accuracyHistory.slice(-30);

      const rollingAccuracy7d =
        last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
      const rollingAccuracy30d =
        last30.length > 0 ? last30.reduce((a, b) => a + b, 0) / last30.length : 0;

      dataPoints.push({
        date: new Date(day),
        accuracy,
        sampleSize: cumulativeTotal,
        rollingAccuracy7d,
        rollingAccuracy30d,
      });
    }

    // Determine trend
    const recentAccuracies = dataPoints.slice(-30).map((p) => p.accuracy);
    const trendDirection = determineTrend(recentAccuracies);

    // Calculate trend slope
    let trendSlope = 0;
    if (recentAccuracies.length >= 2) {
      const n = recentAccuracies.length;
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0;
      for (let i = 0; i < n; i++) {
        const val = recentAccuracies[i]!;
        sumX += i;
        sumY += val;
        sumXY += i * val;
        sumX2 += i * i;
      }
      trendSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    // Find best and worst periods (7-day windows)
    let bestPeriod: { start: Date; end: Date; accuracy: number } | undefined;
    let worstPeriod: { start: Date; end: Date; accuracy: number } | undefined;
    let bestAccuracy = -Infinity;
    let worstAccuracy = Infinity;

    for (let i = 6; i < dataPoints.length; i++) {
      const windowSlice = dataPoints.slice(i - 6, i + 1);
      const lastPoint = windowSlice[windowSlice.length - 1];
      const firstPoint = windowSlice[0];
      if (!lastPoint || !firstPoint) continue;

      const windowAccuracy = lastPoint.rollingAccuracy7d;

      if (windowAccuracy > bestAccuracy && windowSlice.length >= 7) {
        bestAccuracy = windowAccuracy;
        bestPeriod = {
          start: firstPoint.date,
          end: lastPoint.date,
          accuracy: windowAccuracy,
        };
      }

      if (windowAccuracy < worstAccuracy && windowSlice.length >= 7) {
        worstAccuracy = windowAccuracy;
        worstPeriod = {
          start: firstPoint.date,
          end: lastPoint.date,
          accuracy: windowAccuracy,
        };
      }
    }

    // Trend confidence based on sample size and consistency
    const trendConfidence = Math.min(
      1,
      Math.sqrt(verified.length / 100) * (1 - Math.abs(trendSlope))
    );

    return {
      signalType,
      dataPoints,
      trendDirection:
        trendDirection === "UP"
          ? "UP"
          : trendDirection === "DOWN"
            ? "DOWN"
            : trendDirection === "VOLATILE"
              ? "VOLATILE"
              : "STABLE",
      trendSlope,
      trendConfidence,
      bestPeriod,
      worstPeriod,
    };
  }

  // --------------------------------------------------------------------------
  // Data Access
  // --------------------------------------------------------------------------

  /**
   * Get occurrence by ID
   */
  getOccurrence(occurrenceId: string): SignalOccurrence | undefined {
    return this.occurrences.get(occurrenceId);
  }

  /**
   * Get all occurrences for a signal type
   */
  getOccurrencesByType(signalType: TrackedSignalType): SignalOccurrence[] {
    const ids = this.occurrencesBySignalType.get(signalType) || new Set();
    const results: SignalOccurrence[] = [];
    for (const id of ids) {
      const occ = this.occurrences.get(id);
      if (occ) results.push(occ);
    }
    return results;
  }

  /**
   * Get all occurrences for a market
   */
  getOccurrencesByMarket(marketId: string): SignalOccurrence[] {
    const ids = this.occurrencesByMarket.get(marketId) || new Set();
    const results: SignalOccurrence[] = [];
    for (const id of ids) {
      const occ = this.occurrences.get(id);
      if (occ) results.push(occ);
    }
    return results;
  }

  /**
   * Get pending occurrences (awaiting outcome)
   */
  getPendingOccurrences(): SignalOccurrence[] {
    const results: SignalOccurrence[] = [];
    for (const occ of this.occurrences.values()) {
      if (occ.outcomeStatus === SignalOutcomeStatus.PENDING) {
        results.push(occ);
      }
    }
    return results;
  }

  /**
   * Get statistics summary
   */
  getStatistics(): {
    totalOccurrences: number;
    pendingOccurrences: number;
    verifiedOccurrences: number;
    expiredOccurrences: number;
    uniqueMarkets: number;
    signalTypeCounts: Record<TrackedSignalType, number>;
  } {
    const stats = {
      totalOccurrences: this.occurrences.size,
      pendingOccurrences: 0,
      verifiedOccurrences: 0,
      expiredOccurrences: 0,
      uniqueMarkets: this.occurrencesByMarket.size,
      signalTypeCounts: {} as Record<TrackedSignalType, number>,
    };

    for (const occ of this.occurrences.values()) {
      if (occ.outcomeStatus === SignalOutcomeStatus.PENDING) {
        stats.pendingOccurrences++;
      } else if (occ.outcomeStatus === SignalOutcomeStatus.VERIFIED) {
        stats.verifiedOccurrences++;
      } else if (occ.outcomeStatus === SignalOutcomeStatus.EXPIRED) {
        stats.expiredOccurrences++;
      }
    }

    for (const [type, ids] of this.occurrencesBySignalType) {
      stats.signalTypeCounts[type] = ids.size;
    }

    return stats;
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  /**
   * Invalidate caches for a signal type
   */
  private invalidateCaches(signalType?: TrackedSignalType): void {
    if (signalType) {
      // Remove metrics caches for this signal type
      for (const key of this.metricsCache.keys()) {
        if (key.startsWith(signalType)) {
          this.metricsCache.delete(key);
        }
      }
    } else {
      // Clear all metrics caches
      this.metricsCache.clear();
    }

    // Always invalidate ranking cache
    this.rankingCache = null;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.metricsCache.clear();
    this.rankingCache = null;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Get current configuration
   */
  getConfig(): SignalEffectivenessTrackerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SignalEffectivenessTrackerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.clearCaches();
  }

  // --------------------------------------------------------------------------
  // Data Management
  // --------------------------------------------------------------------------

  /**
   * Clear all data
   */
  clear(): void {
    this.occurrences.clear();
    for (const set of this.occurrencesBySignalType.values()) {
      set.clear();
    }
    this.occurrencesByMarket.clear();
    this.clearCaches();
    this.previousTiers.clear();
  }

  /**
   * Export data for persistence
   */
  exportData(): {
    occurrences: SignalOccurrence[];
    config: SignalEffectivenessTrackerConfig;
  } {
    return {
      occurrences: Array.from(this.occurrences.values()),
      config: this.config,
    };
  }

  /**
   * Import data from persistence
   */
  importData(data: { occurrences: SignalOccurrence[]; config?: Partial<SignalEffectivenessTrackerConfig> }): void {
    this.clear();

    if (data.config) {
      this.config = { ...DEFAULT_TRACKER_CONFIG, ...data.config };
    }

    for (const occ of data.occurrences) {
      // Restore dates
      occ.timestamp = new Date(occ.timestamp);
      if (occ.resolvedAt) {
        occ.resolvedAt = new Date(occ.resolvedAt);
      }

      this.occurrences.set(occ.occurrenceId, occ);

      const typeSet = this.occurrencesBySignalType.get(occ.signalType);
      if (typeSet) {
        typeSet.add(occ.occurrenceId);
      }

      let marketSet = this.occurrencesByMarket.get(occ.marketId);
      if (!marketSet) {
        marketSet = new Set();
        this.occurrencesByMarket.set(occ.marketId, marketSet);
      }
      marketSet.add(occ.occurrenceId);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new SignalEffectivenessTracker instance
 */
export function createSignalEffectivenessTracker(
  config: Partial<SignalEffectivenessTrackerConfig> = {}
): SignalEffectivenessTracker {
  return new SignalEffectivenessTracker(config);
}

// Shared instance
let sharedInstance: SignalEffectivenessTracker | null = null;

/**
 * Get the shared SignalEffectivenessTracker instance
 */
export function getSharedSignalEffectivenessTracker(): SignalEffectivenessTracker {
  if (!sharedInstance) {
    sharedInstance = createSignalEffectivenessTracker();
  }
  return sharedInstance;
}

/**
 * Set the shared SignalEffectivenessTracker instance
 */
export function setSharedSignalEffectivenessTracker(
  tracker: SignalEffectivenessTracker
): void {
  sharedInstance = tracker;
}

/**
 * Reset the shared SignalEffectivenessTracker instance
 */
export function resetSharedSignalEffectivenessTracker(): void {
  sharedInstance = null;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create a mock signal occurrence
 */
export function createMockSignalOccurrence(
  overrides: Partial<SignalOccurrence> = {}
): SignalOccurrence {
  const signalTypes = Object.values(TrackedSignalType);
  const predictions: SignalPrediction[] = [SignalPrediction.YES, SignalPrediction.NO, SignalPrediction.NEUTRAL];
  const categories = ["POLITICS", "CRYPTO", "SPORTS", "FINANCE", "ENTERTAINMENT"];

  const randomPrediction = predictions[Math.floor(Math.random() * predictions.length)] ?? SignalPrediction.YES;
  const predictedDirection = overrides.predictedDirection ?? randomPrediction;
  const actualOutcome = overrides.actualOutcome !== undefined
    ? overrides.actualOutcome
    : Math.random() > 0.5
      ? "YES"
      : "NO";

  let wasCorrect: boolean;
  if (predictedDirection === SignalPrediction.NEUTRAL) {
    wasCorrect = true;
  } else {
    const predictedYes = predictedDirection === SignalPrediction.YES;
    wasCorrect = (predictedYes && actualOutcome === "YES") || (!predictedYes && actualOutcome === "NO");
  }

  const randomSignalType = signalTypes[Math.floor(Math.random() * signalTypes.length)] ?? TrackedSignalType.INSIDER_TRADE;
  const randomCategory = categories[Math.floor(Math.random() * categories.length)] ?? "POLITICS";

  return {
    occurrenceId: generateOccurrenceId(),
    signalType: overrides.signalType ?? randomSignalType,
    marketId: overrides.marketId ?? `market_${Math.random().toString(36).substring(2, 8)}`,
    marketCategory: overrides.marketCategory ?? randomCategory,
    predictedDirection,
    strength: overrides.strength ?? Math.random(),
    confidence: overrides.confidence ?? Math.random(),
    walletAddress: overrides.walletAddress ?? `0x${Math.random().toString(16).substring(2, 42)}`,
    tradeSizeUsd: overrides.tradeSizeUsd ?? Math.random() * 100000,
    timestamp: overrides.timestamp ?? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    hoursUntilResolution: overrides.hoursUntilResolution ?? Math.random() * 168,
    outcomeStatus: overrides.outcomeStatus ?? SignalOutcomeStatus.VERIFIED,
    actualOutcome,
    resolvedAt: overrides.resolvedAt ?? new Date(),
    wasCorrect: overrides.wasCorrect ?? wasCorrect,
    metadata: overrides.metadata,
  };
}

/**
 * Create mock signal occurrences batch
 */
export function createMockSignalOccurrenceBatch(
  count: number,
  overrides: Partial<SignalOccurrence> = {}
): SignalOccurrence[] {
  return Array.from({ length: count }, () => createMockSignalOccurrence(overrides));
}

/**
 * Create mock occurrences with specific accuracy
 */
export function createMockOccurrencesWithAccuracy(
  signalType: TrackedSignalType,
  count: number,
  accuracy: number
): SignalOccurrence[] {
  const correctCount = Math.round(count * accuracy);
  const occurrences: SignalOccurrence[] = [];

  for (let i = 0; i < count; i++) {
    const isCorrect = i < correctCount;
    const predictedDirection =
      Math.random() > 0.5 ? SignalPrediction.YES : SignalPrediction.NO;

    let actualOutcome: "YES" | "NO";
    if (isCorrect) {
      actualOutcome = predictedDirection === SignalPrediction.YES ? "YES" : "NO";
    } else {
      actualOutcome = predictedDirection === SignalPrediction.YES ? "NO" : "YES";
    }

    occurrences.push(
      createMockSignalOccurrence({
        signalType,
        predictedDirection,
        actualOutcome,
        wasCorrect: isCorrect,
      })
    );
  }

  // Shuffle to randomize order
  for (let i = occurrences.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = occurrences[i];
    const swapVal = occurrences[j];
    if (temp !== undefined && swapVal !== undefined) {
      occurrences[i] = swapVal;
      occurrences[j] = temp;
    }
  }

  return occurrences;
}
