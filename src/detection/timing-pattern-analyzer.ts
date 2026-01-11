/**
 * Timing Pattern Analyzer (DET-PAT-003)
 *
 * Analyze timing patterns of wallet trades to detect suspicious behavior.
 *
 * Features:
 * - Extract trade timestamps and analyze patterns
 * - Analyze time-of-day patterns
 * - Detect unusual timing (e.g., pre-news trading)
 * - Score timing suspicion (0-100 scale)
 * - Support batch analysis and caching
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

// ============================================================================
// Types
// ============================================================================

/**
 * Time of day classification
 */
export enum TimeOfDayPeriod {
  /** Early morning (4am-8am UTC) */
  EARLY_MORNING = "EARLY_MORNING",
  /** Morning (8am-12pm UTC) */
  MORNING = "MORNING",
  /** Afternoon (12pm-4pm UTC) */
  AFTERNOON = "AFTERNOON",
  /** Evening (4pm-8pm UTC) */
  EVENING = "EVENING",
  /** Night (8pm-12am UTC) */
  NIGHT = "NIGHT",
  /** Late night (12am-4am UTC) */
  LATE_NIGHT = "LATE_NIGHT",
}

/**
 * Day of week
 */
export enum DayOfWeekType {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

/**
 * Timing pattern type
 */
export enum TimingPatternType {
  /** Normal trading hours */
  NORMAL = "NORMAL",
  /** Off-hours trading (nights/weekends) */
  OFF_HOURS = "OFF_HOURS",
  /** Concentrated in specific hours */
  CONCENTRATED = "CONCENTRATED",
  /** Evenly distributed */
  DISTRIBUTED = "DISTRIBUTED",
  /** Trades before events */
  PRE_EVENT = "PRE_EVENT",
  /** Trades at unusual times */
  UNUSUAL = "UNUSUAL",
  /** Bot-like precision timing */
  BOT_LIKE = "BOT_LIKE",
  /** Unknown pattern */
  UNKNOWN = "UNKNOWN",
}

/**
 * Timing suspicion level
 */
export enum TimingSuspicionLevel {
  /** Normal timing, no concerns */
  NONE = "NONE",
  /** Low suspicion */
  LOW = "LOW",
  /** Medium suspicion */
  MEDIUM = "MEDIUM",
  /** High suspicion */
  HIGH = "HIGH",
  /** Very high suspicion */
  CRITICAL = "CRITICAL",
}

/**
 * Timing anomaly type
 */
export enum TimingAnomalyType {
  /** Trades right before news events */
  PRE_NEWS_TRADING = "PRE_NEWS_TRADING",
  /** Trades at unusual hours for the market */
  UNUSUAL_HOURS = "UNUSUAL_HOURS",
  /** Trades clustered in short time windows */
  CLUSTERED_TRADES = "CLUSTERED_TRADES",
  /** Perfect timing on market moves */
  PERFECT_TIMING = "PERFECT_TIMING",
  /** Bot-like regular intervals */
  REGULAR_INTERVALS = "REGULAR_INTERVALS",
  /** Unusual day of week patterns */
  UNUSUAL_DAY_PATTERN = "UNUSUAL_DAY_PATTERN",
  /** Trades against time zone expectations */
  TIME_ZONE_ANOMALY = "TIME_ZONE_ANOMALY",
}

/**
 * Trade data for timing analysis
 */
export interface TimingTrade {
  /** Unique trade ID */
  tradeId: string;
  /** Market ID */
  marketId: string;
  /** Trade timestamp */
  timestamp: Date;
  /** Trade side (buy/sell) */
  side: "buy" | "sell";
  /** Trade size in USD */
  sizeUsd: number;
  /** Whether trade was a winner (if resolved) */
  isWinner?: boolean | null;
  /** Time until market resolution (in hours, if known) */
  timeToResolution?: number;
  /** Whether there was news around this trade time */
  hadNearbyNews?: boolean;
}

/**
 * Hour of day distribution
 */
export interface HourDistribution {
  /** Hour (0-23) */
  hour: number;
  /** Number of trades in this hour */
  count: number;
  /** Percentage of total trades */
  percentage: number;
  /** Total volume in this hour */
  volume: number;
  /** Volume percentage */
  volumePercentage: number;
}

/**
 * Day of week distribution
 */
export interface DayDistribution {
  /** Day of week (0-6, Sunday = 0) */
  day: DayOfWeekType;
  /** Number of trades on this day */
  count: number;
  /** Percentage of total trades */
  percentage: number;
  /** Total volume on this day */
  volume: number;
  /** Volume percentage */
  volumePercentage: number;
}

/**
 * Time of day period distribution
 */
export interface PeriodDistribution {
  /** Time period */
  period: TimeOfDayPeriod;
  /** Number of trades in this period */
  count: number;
  /** Percentage of total trades */
  percentage: number;
  /** Total volume in this period */
  volume: number;
  /** Volume percentage */
  volumePercentage: number;
}

/**
 * Trade interval statistics
 */
export interface IntervalStats {
  /** Average time between trades (ms) */
  avgInterval: number;
  /** Median time between trades (ms) */
  medianInterval: number;
  /** Standard deviation of intervals (ms) */
  stdDevInterval: number;
  /** Minimum interval (ms) */
  minInterval: number;
  /** Maximum interval (ms) */
  maxInterval: number;
  /** Coefficient of variation */
  coefficientOfVariation: number;
  /** Number of trades within 1 minute of each other */
  rapidTradeCount: number;
  /** Number of trades within 5 minutes of each other */
  quickSuccessionCount: number;
}

/**
 * Detected timing anomaly
 */
export interface TimingAnomaly {
  /** Anomaly type */
  type: TimingAnomalyType;
  /** Description of the anomaly */
  description: string;
  /** Severity (0-100) */
  severity: number;
  /** Specific trades involved (trade IDs) */
  involvedTradeIds: string[];
  /** Evidence supporting this anomaly */
  evidence: string[];
}

/**
 * Timing pattern analysis result
 */
export interface TimingPatternResult {
  /** Wallet address */
  address: string;
  /** Overall timing pattern type */
  patternType: TimingPatternType;
  /** Suspicion level */
  suspicionLevel: TimingSuspicionLevel;
  /** Timing suspicion score (0-100) */
  suspicionScore: number;
  /** Hour of day distribution */
  hourDistribution: HourDistribution[];
  /** Day of week distribution */
  dayDistribution: DayDistribution[];
  /** Time of day period distribution */
  periodDistribution: PeriodDistribution[];
  /** Trade interval statistics */
  intervalStats: IntervalStats;
  /** Peak trading hour (most trades) */
  peakHour: number;
  /** Peak trading day */
  peakDay: DayOfWeekType;
  /** Peak trading period */
  peakPeriod: TimeOfDayPeriod;
  /** Percentage of trades during market hours (9am-5pm ET) */
  marketHoursPercentage: number;
  /** Percentage of trades during off-hours */
  offHoursPercentage: number;
  /** Percentage of trades on weekends */
  weekendPercentage: number;
  /** Detected anomalies */
  anomalies: TimingAnomaly[];
  /** Concentration score (0-1, how concentrated timing is) */
  concentrationScore: number;
  /** Regularity score (0-1, how regular/bot-like intervals are) */
  regularityScore: number;
  /** Pre-event trading percentage */
  preEventPercentage: number;
  /** Number of trades analyzed */
  tradeCount: number;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Confidence level based on data */
  confidence: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  /** Insights about timing patterns */
  insights: string[];
}

/**
 * Timing analyzer configuration
 */
export interface TimingPatternAnalyzerConfig {
  /** Minimum trades required for analysis */
  minTradesForAnalysis?: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Enable event emission */
  enableEvents?: boolean;
  /** Market hours start (UTC hour, default 14 = 9am ET) */
  marketHoursStartUtc?: number;
  /** Market hours end (UTC hour, default 21 = 4pm ET) */
  marketHoursEndUtc?: number;
  /** Suspicion thresholds */
  suspicionThresholds?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };
  /** Pre-event window in hours */
  preEventWindowHours?: number;
  /** Regular interval tolerance (ms) */
  regularIntervalToleranceMs?: number;
  /** Concentrated threshold (percentage in single hour) */
  concentratedThreshold?: number;
}

/**
 * Analyze timing options
 */
export interface AnalyzeTimingOptions {
  /** Force re-analysis even if cached */
  forceRefresh?: boolean;
}

/**
 * Batch analysis result
 */
export interface BatchTimingAnalysisResult {
  /** Results by wallet address */
  results: Map<string, TimingPatternResult>;
  /** Errors by wallet address */
  errors: Map<string, string>;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Timing analyzer summary
 */
export interface TimingAnalyzerSummary {
  /** Total wallets analyzed */
  totalWalletsAnalyzed: number;
  /** Cached analyses */
  cachedAnalyses: number;
  /** Wallets with high suspicion */
  highSuspicionCount: number;
  /** Wallets with critical suspicion */
  criticalSuspicionCount: number;
  /** Most common pattern type */
  mostCommonPattern: TimingPatternType;
  /** Pattern type distribution */
  patternDistribution: Record<TimingPatternType, number>;
  /** Average suspicion score */
  avgSuspicionScore: number;
  /** Recent analyses */
  recentAnalyses: Array<{
    address: string;
    suspicionScore: number;
    patternType: TimingPatternType;
    analyzedAt: Date;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum trades for analysis */
const DEFAULT_MIN_TRADES = 5;

/** Default cache TTL (1 hour) */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Default market hours (UTC) - approximately 9am-4pm ET */
const DEFAULT_MARKET_HOURS_START_UTC = 14;
const DEFAULT_MARKET_HOURS_END_UTC = 21;

/** Default suspicion thresholds */
const DEFAULT_SUSPICION_THRESHOLDS = {
  low: 30,
  medium: 50,
  high: 70,
  critical: 85,
};

/** Default pre-event window (2 hours) */
const DEFAULT_PRE_EVENT_WINDOW_HOURS = 2;

/** Default regular interval tolerance (1 second) */
const DEFAULT_REGULAR_INTERVAL_TOLERANCE_MS = 1000;

/** Default concentrated threshold (30% in one hour) */
const DEFAULT_CONCENTRATED_THRESHOLD = 0.3;

/** Default analyzer config */
export const DEFAULT_TIMING_ANALYZER_CONFIG: Required<TimingPatternAnalyzerConfig> = {
  minTradesForAnalysis: DEFAULT_MIN_TRADES,
  cacheTtlMs: DEFAULT_CACHE_TTL_MS,
  enableEvents: true,
  marketHoursStartUtc: DEFAULT_MARKET_HOURS_START_UTC,
  marketHoursEndUtc: DEFAULT_MARKET_HOURS_END_UTC,
  suspicionThresholds: DEFAULT_SUSPICION_THRESHOLDS,
  preEventWindowHours: DEFAULT_PRE_EVENT_WINDOW_HOURS,
  regularIntervalToleranceMs: DEFAULT_REGULAR_INTERVAL_TOLERANCE_MS,
  concentratedThreshold: DEFAULT_CONCENTRATED_THRESHOLD,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize wallet address
 */
function normalizeAddress(address: string): string | null {
  if (!address || address.trim() === "") return null;
  try {
    if (!isAddress(address)) return null;
    return getAddress(address);
  } catch {
    return null;
  }
}

/**
 * Get time of day period from hour (UTC)
 */
function getTimeOfDayPeriod(hour: number): TimeOfDayPeriod {
  if (hour >= 4 && hour < 8) return TimeOfDayPeriod.EARLY_MORNING;
  if (hour >= 8 && hour < 12) return TimeOfDayPeriod.MORNING;
  if (hour >= 12 && hour < 16) return TimeOfDayPeriod.AFTERNOON;
  if (hour >= 16 && hour < 20) return TimeOfDayPeriod.EVENING;
  if (hour >= 20 && hour < 24) return TimeOfDayPeriod.NIGHT;
  return TimeOfDayPeriod.LATE_NIGHT;
}

/**
 * Check if hour is within market hours
 */
function isMarketHour(hour: number, startUtc: number, endUtc: number): boolean {
  if (startUtc <= endUtc) {
    return hour >= startUtc && hour < endUtc;
  }
  // Handle wrap-around (e.g., 22-6)
  return hour >= startUtc || hour < endUtc;
}

/**
 * Check if day is weekend
 */
function isWeekend(day: DayOfWeekType): boolean {
  return day === DayOfWeekType.SATURDAY || day === DayOfWeekType.SUNDAY;
}

/**
 * Calculate median from array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate concentration score (entropy-based)
 */
function calculateConcentrationScore(distribution: number[]): number {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const probabilities = distribution.map((v) => v / total);
  const maxEntropy = Math.log(distribution.filter((v) => v > 0).length || 1);
  if (maxEntropy === 0) return 1;

  const entropy = probabilities
    .filter((p) => p > 0)
    .reduce((sum, p) => sum - p * Math.log(p), 0);

  // Return 1 - normalized entropy (higher = more concentrated)
  return 1 - entropy / maxEntropy;
}

/**
 * Calculate regularity score based on interval consistency
 */
function calculateRegularityScore(intervals: number[], toleranceMs: number): number {
  if (intervals.length < 2) return 0;

  // Group intervals by similar values
  const groups: number[][] = [];
  const sortedIntervals = [...intervals].sort((a, b) => a - b);

  for (const interval of sortedIntervals) {
    const existingGroup = groups.find(
      (g) => Math.abs((g[0] ?? 0) - interval) <= toleranceMs
    );
    if (existingGroup) {
      existingGroup.push(interval);
    } else {
      groups.push([interval]);
    }
  }

  // Find largest group
  const largestGroup = groups.reduce(
    (max, g) => (g.length > max.length ? g : max),
    []
  );

  // Regularity score based on how many intervals are similar
  return largestGroup.length / intervals.length;
}

/**
 * Determine timing pattern type from analysis
 */
function determinePatternType(
  hourDistribution: HourDistribution[],
  preEventPercentage: number,
  concentrationScore: number,
  regularityScore: number,
  offHoursPercentage: number,
  config: Required<TimingPatternAnalyzerConfig>
): TimingPatternType {
  // Check for pre-event pattern
  if (preEventPercentage > 0.3) {
    return TimingPatternType.PRE_EVENT;
  }

  // Check for bot-like pattern
  if (regularityScore > 0.7) {
    return TimingPatternType.BOT_LIKE;
  }

  // Check for concentrated pattern
  const maxHourPercentage = Math.max(...hourDistribution.map((h) => h.percentage));
  if (maxHourPercentage > config.concentratedThreshold * 100) {
    return TimingPatternType.CONCENTRATED;
  }

  // Check for off-hours pattern
  if (offHoursPercentage > 50) {
    return TimingPatternType.OFF_HOURS;
  }

  // Check for unusual pattern
  if (concentrationScore > 0.7) {
    return TimingPatternType.UNUSUAL;
  }

  // Check for distributed pattern
  if (concentrationScore < 0.3) {
    return TimingPatternType.DISTRIBUTED;
  }

  return TimingPatternType.NORMAL;
}

/**
 * Detect timing anomalies
 */
function detectAnomalies(
  trades: TimingTrade[],
  _hourDistribution: HourDistribution[],
  _dayDistribution: DayDistribution[],
  intervalStats: IntervalStats,
  config: Required<TimingPatternAnalyzerConfig>
): TimingAnomaly[] {
  const anomalies: TimingAnomaly[] = [];

  // Check for pre-news trading
  const preNewsTrades = trades.filter((t) => t.hadNearbyNews === true);
  if (preNewsTrades.length > 0 && preNewsTrades.length / trades.length > 0.3) {
    anomalies.push({
      type: TimingAnomalyType.PRE_NEWS_TRADING,
      description: `${preNewsTrades.length} trades (${((preNewsTrades.length / trades.length) * 100).toFixed(1)}%) made around news events`,
      severity: Math.min(100, (preNewsTrades.length / trades.length) * 150),
      involvedTradeIds: preNewsTrades.map((t) => t.tradeId),
      evidence: [
        `High proportion of trades near news events`,
        `${preNewsTrades.length} of ${trades.length} trades had nearby news`,
      ],
    });
  }

  // Check for unusual hours
  const lateNightTrades = trades.filter((t) => {
    const hour = t.timestamp.getUTCHours();
    return hour >= 0 && hour < 6;
  });
  if (lateNightTrades.length > 0 && lateNightTrades.length / trades.length > 0.3) {
    anomalies.push({
      type: TimingAnomalyType.UNUSUAL_HOURS,
      description: `${lateNightTrades.length} trades (${((lateNightTrades.length / trades.length) * 100).toFixed(1)}%) made during late night hours (0-6 UTC)`,
      severity: Math.min(100, (lateNightTrades.length / trades.length) * 100),
      involvedTradeIds: lateNightTrades.map((t) => t.tradeId),
      evidence: [
        `High proportion of trades during typically inactive hours`,
        `Average person would be sleeping during these times`,
      ],
    });
  }

  // Check for clustered trades
  if (intervalStats.rapidTradeCount > 3 && intervalStats.rapidTradeCount / trades.length > 0.2) {
    anomalies.push({
      type: TimingAnomalyType.CLUSTERED_TRADES,
      description: `${intervalStats.rapidTradeCount} rapid trades within 1 minute of each other`,
      severity: Math.min(100, (intervalStats.rapidTradeCount / trades.length) * 120),
      involvedTradeIds: [], // Would need to identify specific clustered trades
      evidence: [
        `${intervalStats.rapidTradeCount} trades occurred within 1 minute of previous trade`,
        `Suggests automated or pre-planned trading`,
      ],
    });
  }

  // Check for perfect timing
  const winningTrades = trades.filter((t) => t.isWinner === true);
  const tradesNearResolution = trades.filter(
    (t) => t.timeToResolution !== undefined && t.timeToResolution < config.preEventWindowHours
  );
  if (tradesNearResolution.length > 0 && winningTrades.length > 0) {
    const nearResolutionWinners = tradesNearResolution.filter((t) => t.isWinner === true);
    if (nearResolutionWinners.length / Math.max(1, tradesNearResolution.length) > 0.7) {
      anomalies.push({
        type: TimingAnomalyType.PERFECT_TIMING,
        description: `${nearResolutionWinners.length} of ${tradesNearResolution.length} trades near resolution were winners`,
        severity: Math.min(
          100,
          (nearResolutionWinners.length / tradesNearResolution.length) * 100
        ),
        involvedTradeIds: nearResolutionWinners.map((t) => t.tradeId),
        evidence: [
          `High win rate on trades made close to market resolution`,
          `Suggests possible knowledge of outcome`,
        ],
      });
    }
  }

  // Check for regular intervals (bot-like)
  if (intervalStats.coefficientOfVariation < 0.2 && trades.length >= 10) {
    anomalies.push({
      type: TimingAnomalyType.REGULAR_INTERVALS,
      description: `Trades occur at unusually regular intervals (CV: ${intervalStats.coefficientOfVariation.toFixed(2)})`,
      severity: Math.min(100, (1 - intervalStats.coefficientOfVariation) * 80),
      involvedTradeIds: [],
      evidence: [
        `Very low variation in time between trades`,
        `Coefficient of variation: ${intervalStats.coefficientOfVariation.toFixed(3)}`,
        `Suggests automated trading system`,
      ],
    });
  }

  // Check for unusual day patterns
  const weekendTrades = trades.filter((t) =>
    isWeekend(t.timestamp.getUTCDay() as DayOfWeekType)
  );
  if (weekendTrades.length > 0 && weekendTrades.length / trades.length > 0.4) {
    anomalies.push({
      type: TimingAnomalyType.UNUSUAL_DAY_PATTERN,
      description: `${weekendTrades.length} trades (${((weekendTrades.length / trades.length) * 100).toFixed(1)}%) made on weekends`,
      severity: Math.min(100, (weekendTrades.length / trades.length) * 80),
      involvedTradeIds: weekendTrades.map((t) => t.tradeId),
      evidence: [
        `Higher than expected weekend trading activity`,
        `May indicate different time zone or automated trading`,
      ],
    });
  }

  return anomalies;
}

/**
 * Calculate timing suspicion score
 */
function calculateSuspicionScore(
  anomalies: TimingAnomaly[],
  concentrationScore: number,
  regularityScore: number,
  offHoursPercentage: number,
  preEventPercentage: number
): number {
  let score = 0;

  // Add anomaly scores (max 60 points from anomalies)
  if (anomalies.length > 0) {
    const maxAnomalySeverity = Math.max(...anomalies.map((a) => a.severity));
    const avgAnomalySeverity =
      anomalies.reduce((sum, a) => sum + a.severity, 0) / anomalies.length;
    score += Math.min(60, maxAnomalySeverity * 0.4 + avgAnomalySeverity * 0.2);
  }

  // Add concentration score (max 15 points)
  score += concentrationScore * 15;

  // Add regularity score (max 10 points - only suspicious if very regular)
  if (regularityScore > 0.5) {
    score += (regularityScore - 0.5) * 20;
  }

  // Add off-hours penalty (max 10 points)
  if (offHoursPercentage > 30) {
    score += ((offHoursPercentage - 30) / 70) * 10;
  }

  // Add pre-event penalty (max 20 points)
  score += preEventPercentage * 100 * 0.2;

  return Math.min(100, Math.round(score));
}

/**
 * Determine suspicion level from score
 */
function getSuspicionLevel(
  score: number,
  thresholds: Required<TimingPatternAnalyzerConfig>["suspicionThresholds"]
): TimingSuspicionLevel {
  const critical = thresholds.critical ?? DEFAULT_SUSPICION_THRESHOLDS.critical;
  const high = thresholds.high ?? DEFAULT_SUSPICION_THRESHOLDS.high;
  const medium = thresholds.medium ?? DEFAULT_SUSPICION_THRESHOLDS.medium;
  const low = thresholds.low ?? DEFAULT_SUSPICION_THRESHOLDS.low;

  if (score >= critical) return TimingSuspicionLevel.CRITICAL;
  if (score >= high) return TimingSuspicionLevel.HIGH;
  if (score >= medium) return TimingSuspicionLevel.MEDIUM;
  if (score >= low) return TimingSuspicionLevel.LOW;
  return TimingSuspicionLevel.NONE;
}

/**
 * Determine confidence level based on trade count
 */
function getConfidenceLevel(tradeCount: number): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
  if (tradeCount >= 100) return "VERY_HIGH";
  if (tradeCount >= 50) return "HIGH";
  if (tradeCount >= 20) return "MEDIUM";
  return "LOW";
}

/**
 * Generate insights from analysis
 */
function generateInsights(
  result: Omit<TimingPatternResult, "insights">
): string[] {
  const insights: string[] = [];

  // Pattern type insight
  switch (result.patternType) {
    case TimingPatternType.PRE_EVENT:
      insights.push("Significant portion of trades occur before known events");
      break;
    case TimingPatternType.BOT_LIKE:
      insights.push("Trading intervals suggest automated/algorithmic activity");
      break;
    case TimingPatternType.CONCENTRATED:
      insights.push(
        `Trading activity concentrated around hour ${result.peakHour} UTC`
      );
      break;
    case TimingPatternType.OFF_HOURS:
      insights.push("Majority of trading occurs outside standard market hours");
      break;
    case TimingPatternType.UNUSUAL:
      insights.push("Unusual timing patterns detected");
      break;
    case TimingPatternType.DISTRIBUTED:
      insights.push("Trading activity distributed across various times");
      break;
    default:
      insights.push("Normal timing patterns observed");
  }

  // Peak hour insight
  const periodNames: Record<TimeOfDayPeriod, string> = {
    [TimeOfDayPeriod.EARLY_MORNING]: "early morning",
    [TimeOfDayPeriod.MORNING]: "morning",
    [TimeOfDayPeriod.AFTERNOON]: "afternoon",
    [TimeOfDayPeriod.EVENING]: "evening",
    [TimeOfDayPeriod.NIGHT]: "night",
    [TimeOfDayPeriod.LATE_NIGHT]: "late night",
  };
  insights.push(
    `Most active during ${periodNames[result.peakPeriod]} (${result.periodDistribution.find((p) => p.period === result.peakPeriod)?.percentage.toFixed(1)}% of trades)`
  );

  // Weekend insight
  if (result.weekendPercentage > 25) {
    insights.push(
      `Notable weekend activity: ${result.weekendPercentage.toFixed(1)}% of trades`
    );
  }

  // Off-hours insight
  if (result.offHoursPercentage > 40) {
    insights.push(
      `High off-hours trading: ${result.offHoursPercentage.toFixed(1)}% outside market hours`
    );
  }

  // Anomaly insights
  if (result.anomalies.length > 0) {
    insights.push(
      `${result.anomalies.length} timing anomalies detected`
    );
    const criticalAnomalies = result.anomalies.filter((a) => a.severity >= 70);
    if (criticalAnomalies.length > 0) {
      insights.push(
        `${criticalAnomalies.length} high-severity anomalies require attention`
      );
    }
  }

  // Interval regularity insight
  if (result.regularityScore > 0.6) {
    insights.push(
      `Highly regular trade intervals (${(result.regularityScore * 100).toFixed(0)}% regularity) - possible automation`
    );
  }

  // Quick succession insight
  if (result.intervalStats.quickSuccessionCount > 5) {
    insights.push(
      `${result.intervalStats.quickSuccessionCount} trades made within 5 minutes of previous trade`
    );
  }

  return insights;
}

// ============================================================================
// TimingPatternAnalyzer Class
// ============================================================================

/**
 * Events emitted by TimingPatternAnalyzer
 */
export interface TimingPatternAnalyzerEvents {
  analyzed: (result: TimingPatternResult) => void;
  suspicious: (result: TimingPatternResult) => void;
  anomalyDetected: (anomaly: TimingAnomaly, address: string) => void;
}

/**
 * Analyzer for wallet trading timing patterns
 */
export class TimingPatternAnalyzer extends EventEmitter {
  private readonly config: Required<TimingPatternAnalyzerConfig>;
  private readonly cache: Map<string, { result: TimingPatternResult; expiresAt: number }> =
    new Map();
  private readonly tradeData: Map<string, TimingTrade[]> = new Map();
  private readonly analysisHistory: Array<{
    address: string;
    suspicionScore: number;
    patternType: TimingPatternType;
    analyzedAt: Date;
  }> = [];

  constructor(config?: TimingPatternAnalyzerConfig) {
    super();
    this.config = {
      ...DEFAULT_TIMING_ANALYZER_CONFIG,
      ...config,
      suspicionThresholds: {
        ...DEFAULT_TIMING_ANALYZER_CONFIG.suspicionThresholds,
        ...config?.suspicionThresholds,
      },
    };
  }

  /**
   * Add trade data for a wallet
   */
  addTrades(address: string, trades: TimingTrade[]): void {
    const normalized = normalizeAddress(address);
    if (!normalized) return;

    const existing = this.tradeData.get(normalized) ?? [];
    this.tradeData.set(normalized, [...existing, ...trades]);

    // Invalidate cache
    this.cache.delete(normalized);
  }

  /**
   * Clear trade data for a wallet
   */
  clearTrades(address: string): void {
    const normalized = normalizeAddress(address);
    if (!normalized) return;

    this.tradeData.delete(normalized);
    this.cache.delete(normalized);
  }

  /**
   * Analyze timing patterns for a wallet
   */
  analyze(address: string, trades?: TimingTrade[], options?: AnalyzeTimingOptions): TimingPatternResult | null {
    const normalized = normalizeAddress(address);
    if (!normalized) return null;

    // Check cache
    if (!options?.forceRefresh) {
      const cached = this.cache.get(normalized);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    // Get trades
    const tradesToAnalyze = trades ?? this.tradeData.get(normalized) ?? [];
    if (tradesToAnalyze.length < this.config.minTradesForAnalysis) {
      return null;
    }

    // Sort trades by timestamp
    const sortedTrades = [...tradesToAnalyze].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate distributions
    const hourDistribution = this.calculateHourDistribution(sortedTrades);
    const dayDistribution = this.calculateDayDistribution(sortedTrades);
    const periodDistribution = this.calculatePeriodDistribution(sortedTrades);

    // Calculate interval statistics
    const intervalStats = this.calculateIntervalStats(sortedTrades);

    // Find peaks
    const peakHour = hourDistribution.reduce(
      (max, h) => (h.count > (max?.count ?? 0) ? h : max),
      hourDistribution[0]!
    ).hour;
    const peakDay = dayDistribution.reduce(
      (max, d) => (d.count > (max?.count ?? 0) ? d : max),
      dayDistribution[0]!
    ).day;
    const peakPeriod = periodDistribution.reduce(
      (max, p) => (p.count > (max?.count ?? 0) ? p : max),
      periodDistribution[0]!
    ).period;

    // Calculate percentages
    const marketHoursTrades = sortedTrades.filter((t) =>
      isMarketHour(
        t.timestamp.getUTCHours(),
        this.config.marketHoursStartUtc,
        this.config.marketHoursEndUtc
      )
    );
    const weekdayTrades = sortedTrades.filter(
      (t) => !isWeekend(t.timestamp.getUTCDay() as DayOfWeekType)
    );
    const marketHoursWeekdayTrades = marketHoursTrades.filter(
      (t) => !isWeekend(t.timestamp.getUTCDay() as DayOfWeekType)
    );

    const marketHoursPercentage = (marketHoursWeekdayTrades.length / sortedTrades.length) * 100;
    const offHoursPercentage = 100 - marketHoursPercentage;
    const weekendPercentage =
      ((sortedTrades.length - weekdayTrades.length) / sortedTrades.length) * 100;

    // Calculate pre-event percentage
    const preEventTrades = sortedTrades.filter(
      (t) =>
        t.timeToResolution !== undefined &&
        t.timeToResolution < this.config.preEventWindowHours
    );
    const preEventPercentage = preEventTrades.length / sortedTrades.length;

    // Calculate scores
    const concentrationScore = calculateConcentrationScore(
      hourDistribution.map((h) => h.count)
    );
    const intervals = sortedTrades.slice(1).map((t, i) =>
      t.timestamp.getTime() - (sortedTrades[i]?.timestamp.getTime() ?? 0)
    );
    const regularityScore = calculateRegularityScore(
      intervals,
      this.config.regularIntervalToleranceMs
    );

    // Detect anomalies
    const anomalies = detectAnomalies(
      sortedTrades,
      hourDistribution,
      dayDistribution,
      intervalStats,
      this.config
    );

    // Determine pattern type
    const patternType = determinePatternType(
      hourDistribution,
      preEventPercentage,
      concentrationScore,
      regularityScore,
      offHoursPercentage,
      this.config
    );

    // Calculate suspicion score
    const suspicionScore = calculateSuspicionScore(
      anomalies,
      concentrationScore,
      regularityScore,
      offHoursPercentage,
      preEventPercentage
    );

    const suspicionLevel = getSuspicionLevel(
      suspicionScore,
      this.config.suspicionThresholds
    );

    const resultWithoutInsights: Omit<TimingPatternResult, "insights"> = {
      address: normalized,
      patternType,
      suspicionLevel,
      suspicionScore,
      hourDistribution,
      dayDistribution,
      periodDistribution,
      intervalStats,
      peakHour,
      peakDay,
      peakPeriod,
      marketHoursPercentage,
      offHoursPercentage,
      weekendPercentage,
      anomalies,
      concentrationScore,
      regularityScore,
      preEventPercentage,
      tradeCount: sortedTrades.length,
      analyzedAt: new Date(),
      confidence: getConfidenceLevel(sortedTrades.length),
    };

    const result: TimingPatternResult = {
      ...resultWithoutInsights,
      insights: generateInsights(resultWithoutInsights),
    };

    // Cache result
    this.cache.set(normalized, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });

    // Update history
    this.analysisHistory.push({
      address: normalized,
      suspicionScore: result.suspicionScore,
      patternType: result.patternType,
      analyzedAt: result.analyzedAt,
    });
    if (this.analysisHistory.length > 100) {
      this.analysisHistory.shift();
    }

    // Emit events
    if (this.config.enableEvents) {
      this.emit("analyzed", result);

      if (suspicionLevel === TimingSuspicionLevel.HIGH ||
          suspicionLevel === TimingSuspicionLevel.CRITICAL) {
        this.emit("suspicious", result);
      }

      for (const anomaly of anomalies) {
        if (anomaly.severity >= 50) {
          this.emit("anomalyDetected", anomaly, normalized);
        }
      }
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    entries: Array<{ address: string; trades: TimingTrade[] }>,
    options?: AnalyzeTimingOptions
  ): BatchTimingAnalysisResult {
    const startTime = Date.now();
    const results = new Map<string, TimingPatternResult>();
    const errors = new Map<string, string>();

    for (const entry of entries) {
      try {
        const result = this.analyze(entry.address, entry.trades, options);
        if (result) {
          results.set(result.address, result);
        } else {
          errors.set(entry.address, "Insufficient data for analysis");
        }
      } catch (error) {
        errors.set(
          entry.address,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return {
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get cached analysis result
   */
  getCachedResult(address: string): TimingPatternResult | null {
    const normalized = normalizeAddress(address);
    if (!normalized) return null;

    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    return null;
  }

  /**
   * Check if a wallet has suspicious timing
   */
  hasSuspiciousTiming(address: string, trades?: TimingTrade[]): boolean {
    const result = this.analyze(address, trades);
    if (!result) return false;

    return (
      result.suspicionLevel === TimingSuspicionLevel.HIGH ||
      result.suspicionLevel === TimingSuspicionLevel.CRITICAL
    );
  }

  /**
   * Get wallets with high suspicion timing
   */
  getHighSuspicionWallets(): string[] {
    const highSuspicion: string[] = [];
    for (const [address, cached] of this.cache) {
      if (cached.expiresAt > Date.now()) {
        if (
          cached.result.suspicionLevel === TimingSuspicionLevel.HIGH ||
          cached.result.suspicionLevel === TimingSuspicionLevel.CRITICAL
        ) {
          highSuspicion.push(address);
        }
      }
    }
    return highSuspicion;
  }

  /**
   * Get summary of analyzer state
   */
  getSummary(): TimingAnalyzerSummary {
    const validCached = Array.from(this.cache.values()).filter(
      (c) => c.expiresAt > Date.now()
    );

    const patternDistribution: Record<TimingPatternType, number> = {
      [TimingPatternType.NORMAL]: 0,
      [TimingPatternType.OFF_HOURS]: 0,
      [TimingPatternType.CONCENTRATED]: 0,
      [TimingPatternType.DISTRIBUTED]: 0,
      [TimingPatternType.PRE_EVENT]: 0,
      [TimingPatternType.UNUSUAL]: 0,
      [TimingPatternType.BOT_LIKE]: 0,
      [TimingPatternType.UNKNOWN]: 0,
    };

    let totalSuspicionScore = 0;
    let highSuspicionCount = 0;
    let criticalSuspicionCount = 0;

    for (const cached of validCached) {
      patternDistribution[cached.result.patternType]++;
      totalSuspicionScore += cached.result.suspicionScore;
      if (cached.result.suspicionLevel === TimingSuspicionLevel.HIGH) {
        highSuspicionCount++;
      }
      if (cached.result.suspicionLevel === TimingSuspicionLevel.CRITICAL) {
        criticalSuspicionCount++;
      }
    }

    const mostCommonPattern = Object.entries(patternDistribution).reduce(
      (max, [pattern, count]) =>
        count > (patternDistribution[max as TimingPatternType] ?? 0)
          ? (pattern as TimingPatternType)
          : max,
      TimingPatternType.UNKNOWN
    );

    return {
      totalWalletsAnalyzed: this.analysisHistory.length,
      cachedAnalyses: validCached.length,
      highSuspicionCount,
      criticalSuspicionCount,
      mostCommonPattern,
      patternDistribution,
      avgSuspicionScore:
        validCached.length > 0 ? totalSuspicionScore / validCached.length : 0,
      recentAnalyses: this.analysisHistory.slice(-10),
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.cache.clear();
    this.tradeData.clear();
    this.analysisHistory.length = 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateHourDistribution(trades: TimingTrade[]): HourDistribution[] {
    const hourCounts: number[] = Array.from({ length: 24 }, () => 0);
    const hourVolumes: number[] = Array.from({ length: 24 }, () => 0);

    for (const trade of trades) {
      const hour = trade.timestamp.getUTCHours();
      hourCounts[hour]!++;
      hourVolumes[hour]! += trade.sizeUsd;
    }

    const totalTrades = trades.length;
    const totalVolume = hourVolumes.reduce((a, b) => a + b, 0);

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourCounts[hour] ?? 0,
      percentage: totalTrades > 0 ? ((hourCounts[hour] ?? 0) / totalTrades) * 100 : 0,
      volume: hourVolumes[hour] ?? 0,
      volumePercentage: totalVolume > 0 ? ((hourVolumes[hour] ?? 0) / totalVolume) * 100 : 0,
    }));
  }

  private calculateDayDistribution(trades: TimingTrade[]): DayDistribution[] {
    const dayCounts: number[] = Array.from({ length: 7 }, () => 0);
    const dayVolumes: number[] = Array.from({ length: 7 }, () => 0);

    for (const trade of trades) {
      const day = trade.timestamp.getUTCDay();
      dayCounts[day]!++;
      dayVolumes[day]! += trade.sizeUsd;
    }

    const totalTrades = trades.length;
    const totalVolume = dayVolumes.reduce((a, b) => a + b, 0);

    return Array.from({ length: 7 }, (_, day) => ({
      day: day as DayOfWeekType,
      count: dayCounts[day] ?? 0,
      percentage: totalTrades > 0 ? ((dayCounts[day] ?? 0) / totalTrades) * 100 : 0,
      volume: dayVolumes[day] ?? 0,
      volumePercentage: totalVolume > 0 ? ((dayVolumes[day] ?? 0) / totalVolume) * 100 : 0,
    }));
  }

  private calculatePeriodDistribution(trades: TimingTrade[]): PeriodDistribution[] {
    const periodCounts: Record<TimeOfDayPeriod, number> = {
      [TimeOfDayPeriod.EARLY_MORNING]: 0,
      [TimeOfDayPeriod.MORNING]: 0,
      [TimeOfDayPeriod.AFTERNOON]: 0,
      [TimeOfDayPeriod.EVENING]: 0,
      [TimeOfDayPeriod.NIGHT]: 0,
      [TimeOfDayPeriod.LATE_NIGHT]: 0,
    };
    const periodVolumes: Record<TimeOfDayPeriod, number> = {
      [TimeOfDayPeriod.EARLY_MORNING]: 0,
      [TimeOfDayPeriod.MORNING]: 0,
      [TimeOfDayPeriod.AFTERNOON]: 0,
      [TimeOfDayPeriod.EVENING]: 0,
      [TimeOfDayPeriod.NIGHT]: 0,
      [TimeOfDayPeriod.LATE_NIGHT]: 0,
    };

    for (const trade of trades) {
      const period = getTimeOfDayPeriod(trade.timestamp.getUTCHours());
      periodCounts[period]++;
      periodVolumes[period] += trade.sizeUsd;
    }

    const totalTrades = trades.length;
    const totalVolume = Object.values(periodVolumes).reduce((a, b) => a + b, 0);

    return Object.values(TimeOfDayPeriod).map((period) => ({
      period,
      count: periodCounts[period],
      percentage: totalTrades > 0 ? (periodCounts[period] / totalTrades) * 100 : 0,
      volume: periodVolumes[period],
      volumePercentage: totalVolume > 0 ? (periodVolumes[period] / totalVolume) * 100 : 0,
    }));
  }

  private calculateIntervalStats(trades: TimingTrade[]): IntervalStats {
    if (trades.length < 2) {
      return {
        avgInterval: 0,
        medianInterval: 0,
        stdDevInterval: 0,
        minInterval: 0,
        maxInterval: 0,
        coefficientOfVariation: 0,
        rapidTradeCount: 0,
        quickSuccessionCount: 0,
      };
    }

    const intervals: number[] = [];
    let rapidTradeCount = 0;
    let quickSuccessionCount = 0;

    for (let i = 1; i < trades.length; i++) {
      const interval = trades[i]!.timestamp.getTime() - trades[i - 1]!.timestamp.getTime();
      intervals.push(interval);

      if (interval < 60 * 1000) {
        rapidTradeCount++;
      }
      if (interval < 5 * 60 * 1000) {
        quickSuccessionCount++;
      }
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const medianInterval = calculateMedian(intervals);
    const stdDevInterval = calculateStdDev(intervals, avgInterval);

    return {
      avgInterval,
      medianInterval,
      stdDevInterval,
      minInterval: Math.min(...intervals),
      maxInterval: Math.max(...intervals),
      coefficientOfVariation: avgInterval > 0 ? stdDevInterval / avgInterval : 0,
      rapidTradeCount,
      quickSuccessionCount,
    };
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedAnalyzer: TimingPatternAnalyzer | null = null;

/**
 * Create a new TimingPatternAnalyzer instance
 */
export function createTimingPatternAnalyzer(
  config?: TimingPatternAnalyzerConfig
): TimingPatternAnalyzer {
  return new TimingPatternAnalyzer(config);
}

/**
 * Get the shared TimingPatternAnalyzer instance
 */
export function getSharedTimingPatternAnalyzer(): TimingPatternAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new TimingPatternAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared TimingPatternAnalyzer instance
 */
export function setSharedTimingPatternAnalyzer(analyzer: TimingPatternAnalyzer): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared TimingPatternAnalyzer instance
 */
export function resetSharedTimingPatternAnalyzer(): void {
  if (sharedAnalyzer) {
    sharedAnalyzer.clearAll();
    sharedAnalyzer.removeAllListeners();
  }
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze timing patterns for a wallet (convenience function)
 */
export function analyzeTimingPattern(
  address: string,
  trades: TimingTrade[],
  options?: AnalyzeTimingOptions & { analyzer?: TimingPatternAnalyzer }
): TimingPatternResult | null {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.analyze(address, trades, options);
}

/**
 * Batch analyze timing patterns (convenience function)
 */
export function batchAnalyzeTimingPatterns(
  entries: Array<{ address: string; trades: TimingTrade[] }>,
  options?: AnalyzeTimingOptions & { analyzer?: TimingPatternAnalyzer }
): BatchTimingAnalysisResult {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.batchAnalyze(entries, options);
}

/**
 * Check if a wallet has suspicious timing (convenience function)
 */
export function hasSuspiciousTiming(
  address: string,
  trades: TimingTrade[],
  options?: { analyzer?: TimingPatternAnalyzer }
): boolean {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.hasSuspiciousTiming(address, trades);
}

/**
 * Get cached timing analysis result (convenience function)
 */
export function getCachedTimingAnalysis(
  address: string,
  options?: { analyzer?: TimingPatternAnalyzer }
): TimingPatternResult | null {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.getCachedResult(address);
}

/**
 * Get wallets with suspicious timing (convenience function)
 */
export function getWalletsWithSuspiciousTiming(options?: {
  analyzer?: TimingPatternAnalyzer;
}): string[] {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.getHighSuspicionWallets();
}

/**
 * Get timing analyzer summary (convenience function)
 */
export function getTimingAnalyzerSummary(options?: {
  analyzer?: TimingPatternAnalyzer;
}): TimingAnalyzerSummary {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  return analyzer.getSummary();
}

/**
 * Add trades for timing analysis (convenience function)
 */
export function addTradesForTimingAnalysis(
  address: string,
  trades: TimingTrade[],
  options?: { analyzer?: TimingPatternAnalyzer }
): void {
  const analyzer = options?.analyzer ?? getSharedTimingPatternAnalyzer();
  analyzer.addTrades(address, trades);
}

/**
 * Get timing pattern description
 */
export function getTimingPatternDescription(pattern: TimingPatternType): string {
  const descriptions: Record<TimingPatternType, string> = {
    [TimingPatternType.NORMAL]: "Normal trading hours pattern",
    [TimingPatternType.OFF_HOURS]: "Predominantly off-hours trading",
    [TimingPatternType.CONCENTRATED]: "Trading concentrated in specific hours",
    [TimingPatternType.DISTRIBUTED]: "Trading distributed across various times",
    [TimingPatternType.PRE_EVENT]: "Trading activity before known events",
    [TimingPatternType.UNUSUAL]: "Unusual timing patterns detected",
    [TimingPatternType.BOT_LIKE]: "Bot-like precision timing",
    [TimingPatternType.UNKNOWN]: "Unknown or insufficient data",
  };
  return descriptions[pattern];
}

/**
 * Get suspicion level description
 */
export function getSuspicionLevelDescription(level: TimingSuspicionLevel): string {
  const descriptions: Record<TimingSuspicionLevel, string> = {
    [TimingSuspicionLevel.NONE]: "No timing concerns",
    [TimingSuspicionLevel.LOW]: "Minor timing irregularities",
    [TimingSuspicionLevel.MEDIUM]: "Notable timing patterns worth monitoring",
    [TimingSuspicionLevel.HIGH]: "Suspicious timing patterns detected",
    [TimingSuspicionLevel.CRITICAL]: "Critical timing anomalies requiring investigation",
  };
  return descriptions[level];
}
