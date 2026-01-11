/**
 * Individual Trade Size Analyzer (DET-VOL-004)
 *
 * Flag individual trades significantly larger than average for whale detection.
 *
 * Features:
 * - Calculate trade size percentiles per market
 * - Define large trade thresholds dynamically
 * - Flag outlier trades above configurable thresholds
 * - Track large trade frequency per wallet and market
 * - Support for multiple threshold strategies (percentile, z-score, absolute)
 * - Event emission for large trade detection
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Category of trade size relative to market norms
 */
export enum TradeSizeCategory {
  /** Below average trade size */
  SMALL = "SMALL",
  /** Average trade size */
  MEDIUM = "MEDIUM",
  /** Above average but not unusual */
  LARGE = "LARGE",
  /** Significantly above average */
  VERY_LARGE = "VERY_LARGE",
  /** Extreme outlier trade */
  WHALE = "WHALE",
}

/**
 * Severity level for flagged trades
 */
export enum TradeSizeSeverity {
  /** Noteworthy but not concerning */
  LOW = "LOW",
  /** Moderately unusual trade */
  MEDIUM = "MEDIUM",
  /** Significantly unusual trade */
  HIGH = "HIGH",
  /** Extreme outlier requiring attention */
  CRITICAL = "CRITICAL",
}

/**
 * Method used to determine if a trade is large
 */
export enum ThresholdMethod {
  /** Based on percentile ranking */
  PERCENTILE = "PERCENTILE",
  /** Based on z-score deviation */
  Z_SCORE = "Z_SCORE",
  /** Based on absolute USD value */
  ABSOLUTE = "ABSOLUTE",
  /** Combined methods */
  COMBINED = "COMBINED",
}

/**
 * A single trade entry for analysis
 */
export interface TradeEntry {
  /** Unique trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address that made the trade */
  walletAddress: string;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade timestamp in milliseconds */
  timestamp: number;

  /** Trade side (buy/sell) */
  side?: "BUY" | "SELL";

  /** Price at time of trade */
  price?: number;

  /** Outcome token traded */
  outcome?: string;
}

/**
 * Percentile statistics for trade sizes
 */
export interface TradeSizePercentiles {
  /** 10th percentile */
  p10: number;

  /** 25th percentile */
  p25: number;

  /** 50th percentile (median) */
  p50: number;

  /** 75th percentile */
  p75: number;

  /** 90th percentile */
  p90: number;

  /** 95th percentile */
  p95: number;

  /** 99th percentile */
  p99: number;

  /** 99.5th percentile */
  p995: number;

  /** 99.9th percentile */
  p999: number;
}

/**
 * Statistics for a market's trade sizes
 */
export interface MarketTradeSizeStats {
  /** Market identifier */
  marketId: string;

  /** Total number of trades analyzed */
  tradeCount: number;

  /** Average trade size in USD */
  averageSizeUsd: number;

  /** Standard deviation of trade sizes */
  standardDeviation: number;

  /** Minimum trade size observed */
  minSizeUsd: number;

  /** Maximum trade size observed */
  maxSizeUsd: number;

  /** Total volume analyzed */
  totalVolumeUsd: number;

  /** Percentile distribution */
  percentiles: TradeSizePercentiles;

  /** Coefficient of variation */
  coefficientOfVariation: number;

  /** Skewness of distribution */
  skewness: number;

  /** Time range of data */
  timeRange: {
    startTime: Date;
    endTime: Date;
  };

  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Configuration for trade size thresholds
 */
export interface TradeSizeThresholdConfig {
  /** Percentile thresholds for each category */
  percentileThresholds: {
    /** Percentile for LARGE threshold (default: 75) */
    large: number;
    /** Percentile for VERY_LARGE threshold (default: 90) */
    veryLarge: number;
    /** Percentile for WHALE threshold (default: 99) */
    whale: number;
  };

  /** Z-score thresholds for each severity */
  zScoreThresholds: {
    /** Z-score for LOW severity (default: 2.0) */
    low: number;
    /** Z-score for MEDIUM severity (default: 2.5) */
    medium: number;
    /** Z-score for HIGH severity (default: 3.0) */
    high: number;
    /** Z-score for CRITICAL severity (default: 4.0) */
    critical: number;
  };

  /** Absolute USD thresholds */
  absoluteThresholds: {
    /** USD value for LARGE (default: 10000) */
    large: number;
    /** USD value for VERY_LARGE (default: 50000) */
    veryLarge: number;
    /** USD value for WHALE (default: 100000) */
    whale: number;
  };

  /** Method to use for threshold determination */
  method: ThresholdMethod;

  /** Minimum trades required for reliable statistics (default: 30) */
  minTradesForReliableStats: number;
}

/**
 * Result of analyzing a single trade
 */
export interface TradeSizeAnalysisResult {
  /** The trade analyzed */
  trade: TradeEntry;

  /** Category of trade size */
  category: TradeSizeCategory;

  /** Whether this trade is flagged as an outlier */
  isFlagged: boolean;

  /** Severity if flagged */
  severity: TradeSizeSeverity | null;

  /** Percentile ranking (0-100) */
  percentileRank: number;

  /** Z-score relative to market average */
  zScore: number;

  /** Market statistics used for analysis */
  marketStats: MarketTradeSizeStats | null;

  /** How many times larger than median */
  timesMedian: number;

  /** How many times larger than average */
  timesAverage: number;

  /** Threshold that was exceeded (if flagged) */
  exceededThreshold: {
    method: ThresholdMethod;
    threshold: number;
    value: number;
  } | null;

  /** Analysis timestamp */
  analyzedAt: Date;

  /** Whether statistics are reliable */
  statsReliable: boolean;
}

/**
 * Large trade event emitted when significant trade detected
 */
export interface LargeTradeEvent {
  /** Event identifier */
  eventId: string;

  /** Trade information */
  trade: TradeEntry;

  /** Severity level */
  severity: TradeSizeSeverity;

  /** Trade size category */
  category: TradeSizeCategory;

  /** Percentile ranking */
  percentileRank: number;

  /** Z-score */
  zScore: number;

  /** Times larger than median */
  timesMedian: number;

  /** Detection timestamp */
  detectedAt: Date;

  /** Market statistics snapshot */
  marketStats: {
    averageSizeUsd: number;
    medianSizeUsd: number;
    tradeCount: number;
  };

  /** Context information */
  context: {
    /** Wallet's recent large trade count */
    walletRecentLargeTradeCount: number;
    /** Market's recent large trade count */
    marketRecentLargeTradeCount: number;
    /** Is this wallet a repeat large trader */
    isRepeatLargeTrader: boolean;
  };
}

/**
 * Wallet large trade tracking
 */
export interface WalletLargeTradeStats {
  /** Wallet address */
  walletAddress: string;

  /** Total large trades */
  totalLargeTrades: number;

  /** Large trades by severity */
  bySeverity: Record<TradeSizeSeverity, number>;

  /** Total USD volume of large trades */
  totalLargeTradeVolumeUsd: number;

  /** Average large trade size */
  averageLargeTradeSizeUsd: number;

  /** Recent large trades (within tracking window) */
  recentLargeTrades: Array<{
    tradeId: string;
    marketId: string;
    sizeUsd: number;
    severity: TradeSizeSeverity;
    timestamp: Date;
  }>;

  /** First large trade timestamp */
  firstLargeTradeTime: Date | null;

  /** Last large trade timestamp */
  lastLargeTradeTime: Date | null;
}

/**
 * Market large trade tracking
 */
export interface MarketLargeTradeStats {
  /** Market identifier */
  marketId: string;

  /** Total large trades */
  totalLargeTrades: number;

  /** Large trades by severity */
  bySeverity: Record<TradeSizeSeverity, number>;

  /** Unique wallets making large trades */
  uniqueLargeTraders: number;

  /** Total USD volume of large trades */
  totalLargeTradeVolumeUsd: number;

  /** Recent large trades */
  recentLargeTrades: Array<{
    tradeId: string;
    walletAddress: string;
    sizeUsd: number;
    severity: TradeSizeSeverity;
    timestamp: Date;
  }>;
}

/**
 * Batch analysis result
 */
export interface BatchTradeSizeAnalysisResult {
  /** Results by trade ID */
  results: Map<string, TradeSizeAnalysisResult>;

  /** Flagged trade IDs */
  flaggedTradeIds: string[];

  /** Summary statistics */
  summary: {
    totalAnalyzed: number;
    totalFlagged: number;
    bySeverity: Record<TradeSizeSeverity, number>;
    byCategory: Record<TradeSizeCategory, number>;
    largestTrade: TradeEntry | null;
    highestZScore: number;
  };

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for the analyzer
 */
export interface TradeSizeAnalyzerSummary {
  /** Total markets tracked */
  totalMarkets: number;

  /** Total trades analyzed */
  totalTradesAnalyzed: number;

  /** Total flagged trades */
  totalFlaggedTrades: number;

  /** Flagged trades by severity */
  flaggedBySeverity: Record<TradeSizeSeverity, number>;

  /** Markets with most large trades */
  topMarketsByLargeTrades: Array<{
    marketId: string;
    largeTradeCount: number;
    totalVolumeUsd: number;
  }>;

  /** Wallets with most large trades */
  topWalletsByLargeTrades: Array<{
    walletAddress: string;
    largeTradeCount: number;
    totalVolumeUsd: number;
  }>;

  /** Recent large trade events */
  recentLargeTradeEvents: LargeTradeEvent[];
}

/**
 * Configuration for TradeSizeAnalyzer
 */
export interface TradeSizeAnalyzerConfig {
  /** Threshold configuration */
  thresholds?: Partial<TradeSizeThresholdConfig>;

  /** Maximum trades to store per market (default: 10000) */
  maxTradesPerMarket?: number;

  /** Recent large trades window in milliseconds (default: 1 hour) */
  recentLargeTradesWindowMs?: number;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown between alerts for same wallet/market (default: 5 minutes) */
  alertCooldownMs?: number;

  /** Maximum recent large trade events to store (default: 100) */
  maxRecentLargeTradeEvents?: number;
}

/**
 * Options for analyzing trades
 */
export interface AnalyzeTradeOptions {
  /** Override analysis timestamp */
  timestamp?: number;

  /** Bypass alert cooldown */
  bypassCooldown?: boolean;

  /** Force stats recalculation */
  forceRecalculate?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default percentile thresholds */
export const DEFAULT_PERCENTILE_THRESHOLDS = {
  large: 75,
  veryLarge: 90,
  whale: 99,
};

/** Default z-score thresholds */
export const DEFAULT_ZSCORE_THRESHOLDS = {
  low: 2.0,
  medium: 2.5,
  high: 3.0,
  critical: 4.0,
};

/** Default absolute thresholds */
export const DEFAULT_ABSOLUTE_THRESHOLDS = {
  large: 10000, // $10,000
  veryLarge: 50000, // $50,000
  whale: 100000, // $100,000
};

/** Default threshold configuration */
export const DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG: TradeSizeThresholdConfig = {
  percentileThresholds: DEFAULT_PERCENTILE_THRESHOLDS,
  zScoreThresholds: DEFAULT_ZSCORE_THRESHOLDS,
  absoluteThresholds: DEFAULT_ABSOLUTE_THRESHOLDS,
  method: ThresholdMethod.COMBINED,
  minTradesForReliableStats: 30,
};

/** Default maximum trades per market */
const DEFAULT_MAX_TRADES_PER_MARKET = 10000;

/** Default recent large trades window (1 hour) */
const DEFAULT_RECENT_LARGE_TRADES_WINDOW_MS = 60 * 60 * 1000;

/** Default alert cooldown (5 minutes) */
const DEFAULT_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

/** Default max recent large trade events */
const DEFAULT_MAX_RECENT_LARGE_TRADE_EVENTS = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `large_trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower] ?? 0;
  }

  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? 0;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
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
 * Calculate skewness (measure of distribution asymmetry)
 */
function calculateSkewness(values: number[], mean: number, stdDev: number): number {
  if (values.length < 3 || stdDev === 0) return 0;

  const n = values.length;
  const cubedDiffs = values.map((v) => Math.pow((v - mean) / stdDev, 3));
  const sumCubedDiffs = cubedDiffs.reduce((a, b) => a + b, 0);

  return (n / ((n - 1) * (n - 2))) * sumCubedDiffs;
}

/**
 * Find percentile rank of a value in sorted array
 */
function findPercentileRank(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 50;

  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
    else break;
  }

  return (count / sortedValues.length) * 100;
}

/**
 * Determine trade size category from percentile and z-score
 */
function determineSizeCategory(
  percentileRank: number,
  zScore: number,
  sizeUsd: number,
  config: TradeSizeThresholdConfig
): TradeSizeCategory {
  const { percentileThresholds, absoluteThresholds, method } = config;

  // Check absolute thresholds first for very large trades
  if (sizeUsd >= absoluteThresholds.whale) {
    return TradeSizeCategory.WHALE;
  }
  if (sizeUsd >= absoluteThresholds.veryLarge) {
    return TradeSizeCategory.VERY_LARGE;
  }

  // Use configured method
  switch (method) {
    case ThresholdMethod.PERCENTILE:
      if (percentileRank >= percentileThresholds.whale) return TradeSizeCategory.WHALE;
      if (percentileRank >= percentileThresholds.veryLarge) return TradeSizeCategory.VERY_LARGE;
      if (percentileRank >= percentileThresholds.large) return TradeSizeCategory.LARGE;
      if (percentileRank >= 25) return TradeSizeCategory.MEDIUM;
      return TradeSizeCategory.SMALL;

    case ThresholdMethod.Z_SCORE:
      if (zScore >= 4.0) return TradeSizeCategory.WHALE;
      if (zScore >= 3.0) return TradeSizeCategory.VERY_LARGE;
      if (zScore >= 2.0) return TradeSizeCategory.LARGE;
      if (zScore >= -1.0) return TradeSizeCategory.MEDIUM;
      return TradeSizeCategory.SMALL;

    case ThresholdMethod.ABSOLUTE:
      if (sizeUsd >= absoluteThresholds.veryLarge) return TradeSizeCategory.VERY_LARGE;
      if (sizeUsd >= absoluteThresholds.large) return TradeSizeCategory.LARGE;
      return TradeSizeCategory.MEDIUM;

    case ThresholdMethod.COMBINED:
    default:
      // Use highest category from all methods
      const fromPercentile =
        percentileRank >= percentileThresholds.whale
          ? 4
          : percentileRank >= percentileThresholds.veryLarge
            ? 3
            : percentileRank >= percentileThresholds.large
              ? 2
              : percentileRank >= 25
                ? 1
                : 0;

      const fromZScore =
        zScore >= 4.0 ? 4 : zScore >= 3.0 ? 3 : zScore >= 2.0 ? 2 : zScore >= -1.0 ? 1 : 0;

      const fromAbsolute =
        sizeUsd >= absoluteThresholds.whale
          ? 4
          : sizeUsd >= absoluteThresholds.veryLarge
            ? 3
            : sizeUsd >= absoluteThresholds.large
              ? 2
              : 1;

      const maxLevel = Math.max(fromPercentile, fromZScore, fromAbsolute);

      switch (maxLevel) {
        case 4:
          return TradeSizeCategory.WHALE;
        case 3:
          return TradeSizeCategory.VERY_LARGE;
        case 2:
          return TradeSizeCategory.LARGE;
        case 1:
          return TradeSizeCategory.MEDIUM;
        default:
          return TradeSizeCategory.SMALL;
      }
  }
}

/**
 * Determine severity from z-score
 */
function determineSeverity(
  zScore: number,
  config: TradeSizeThresholdConfig
): TradeSizeSeverity | null {
  const { zScoreThresholds } = config;

  if (zScore >= zScoreThresholds.critical) return TradeSizeSeverity.CRITICAL;
  if (zScore >= zScoreThresholds.high) return TradeSizeSeverity.HIGH;
  if (zScore >= zScoreThresholds.medium) return TradeSizeSeverity.MEDIUM;
  if (zScore >= zScoreThresholds.low) return TradeSizeSeverity.LOW;

  return null;
}

/**
 * Check if trade should be flagged
 */
function shouldFlagTrade(
  percentileRank: number,
  zScore: number,
  sizeUsd: number,
  config: TradeSizeThresholdConfig
): boolean {
  const { percentileThresholds, zScoreThresholds, absoluteThresholds, method } = config;

  switch (method) {
    case ThresholdMethod.PERCENTILE:
      return percentileRank >= percentileThresholds.large;

    case ThresholdMethod.Z_SCORE:
      return zScore >= zScoreThresholds.low;

    case ThresholdMethod.ABSOLUTE:
      return sizeUsd >= absoluteThresholds.large;

    case ThresholdMethod.COMBINED:
    default:
      return (
        percentileRank >= percentileThresholds.large ||
        zScore >= zScoreThresholds.low ||
        sizeUsd >= absoluteThresholds.large
      );
  }
}

// ============================================================================
// Ring Buffer for Trade Storage
// ============================================================================

/**
 * Efficient ring buffer for storing trade data
 */
class TradeRingBuffer {
  private buffer: TradeEntry[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  add(entry: TradeEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): TradeEntry[] {
    const result: TradeEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.capacity) % this.capacity;
      const entry = this.buffer[index];
      if (entry) {
        result.push(entry);
      }
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  getCount(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }
}

// ============================================================================
// TradeSizeAnalyzer Class
// ============================================================================

/**
 * Event types emitted by TradeSizeAnalyzer
 */
export interface TradeSizeAnalyzerEvents {
  largeTradeDetected: (event: LargeTradeEvent) => void;
  whaleTradeDetected: (event: LargeTradeEvent) => void;
  statsUpdated: (marketId: string, stats: MarketTradeSizeStats) => void;
}

/**
 * Analyzer for individual trade sizes to detect whale activity
 */
export class TradeSizeAnalyzer extends EventEmitter {
  private readonly config: TradeSizeThresholdConfig;
  private readonly maxTradesPerMarket: number;
  private readonly recentLargeTradesWindowMs: number;
  private readonly enableEvents: boolean;
  private readonly alertCooldownMs: number;
  private readonly maxRecentLargeTradeEvents: number;

  // Trade storage by market
  private readonly marketTrades: Map<string, TradeRingBuffer> = new Map();

  // Statistics cache
  private readonly marketStats: Map<string, MarketTradeSizeStats> = new Map();

  // Large trade tracking
  private readonly walletLargeTradeStats: Map<string, WalletLargeTradeStats> = new Map();
  private readonly marketLargeTradeStats: Map<string, MarketLargeTradeStats> = new Map();

  // Recent large trade events
  private readonly recentLargeTradeEvents: LargeTradeEvent[] = [];

  // Alert cooldown tracking
  private readonly lastAlertTime: Map<string, number> = new Map();

  constructor(config?: TradeSizeAnalyzerConfig) {
    super();

    this.config = {
      ...DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG,
      ...config?.thresholds,
      percentileThresholds: {
        ...DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG.percentileThresholds,
        ...config?.thresholds?.percentileThresholds,
      },
      zScoreThresholds: {
        ...DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG.zScoreThresholds,
        ...config?.thresholds?.zScoreThresholds,
      },
      absoluteThresholds: {
        ...DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG.absoluteThresholds,
        ...config?.thresholds?.absoluteThresholds,
      },
    };

    this.maxTradesPerMarket = config?.maxTradesPerMarket ?? DEFAULT_MAX_TRADES_PER_MARKET;
    this.recentLargeTradesWindowMs =
      config?.recentLargeTradesWindowMs ?? DEFAULT_RECENT_LARGE_TRADES_WINDOW_MS;
    this.enableEvents = config?.enableEvents ?? true;
    this.alertCooldownMs = config?.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
    this.maxRecentLargeTradeEvents =
      config?.maxRecentLargeTradeEvents ?? DEFAULT_MAX_RECENT_LARGE_TRADE_EVENTS;
  }

  /**
   * Add a trade to the analyzer and get analysis result
   */
  analyzeTrade(trade: TradeEntry, options?: AnalyzeTradeOptions): TradeSizeAnalysisResult {
    const now = options?.timestamp ?? Date.now();

    // Validate trade
    if (!trade.tradeId || !trade.marketId || !trade.walletAddress || trade.sizeUsd < 0) {
      return this.createInvalidResult(trade, now);
    }

    // Add to market trades
    this.addTradeToMarket(trade);

    // Get or calculate market stats
    const stats = options?.forceRecalculate
      ? this.calculateMarketStats(trade.marketId)
      : this.getOrCalculateMarketStats(trade.marketId);

    // Analyze the trade
    const result = this.performAnalysis(trade, stats, now);

    // If flagged, update tracking and emit events
    if (result.isFlagged && result.severity) {
      this.trackLargeTrade(trade, result.severity, now);

      // Check cooldown before emitting
      if (this.enableEvents && this.canEmitAlert(trade, options?.bypassCooldown ?? false, now)) {
        this.emitLargeTradeEvent(trade, result, now);
        this.updateCooldown(trade, now);
      }
    }

    return result;
  }

  /**
   * Analyze multiple trades
   */
  analyzeTrades(
    trades: TradeEntry[],
    options?: AnalyzeTradeOptions
  ): BatchTradeSizeAnalysisResult {
    const startTime = Date.now();
    const results = new Map<string, TradeSizeAnalysisResult>();
    const flaggedTradeIds: string[] = [];

    const summary = {
      totalAnalyzed: trades.length,
      totalFlagged: 0,
      bySeverity: {
        [TradeSizeSeverity.LOW]: 0,
        [TradeSizeSeverity.MEDIUM]: 0,
        [TradeSizeSeverity.HIGH]: 0,
        [TradeSizeSeverity.CRITICAL]: 0,
      } as Record<TradeSizeSeverity, number>,
      byCategory: {
        [TradeSizeCategory.SMALL]: 0,
        [TradeSizeCategory.MEDIUM]: 0,
        [TradeSizeCategory.LARGE]: 0,
        [TradeSizeCategory.VERY_LARGE]: 0,
        [TradeSizeCategory.WHALE]: 0,
      } as Record<TradeSizeCategory, number>,
      largestTrade: null as TradeEntry | null,
      highestZScore: 0,
    };

    for (const trade of trades) {
      const result = this.analyzeTrade(trade, options);
      results.set(trade.tradeId, result);

      summary.byCategory[result.category]++;

      if (result.isFlagged) {
        flaggedTradeIds.push(trade.tradeId);
        summary.totalFlagged++;
        if (result.severity) {
          summary.bySeverity[result.severity]++;
        }
      }

      if (!summary.largestTrade || trade.sizeUsd > summary.largestTrade.sizeUsd) {
        summary.largestTrade = trade;
      }

      if (result.zScore > summary.highestZScore) {
        summary.highestZScore = result.zScore;
      }
    }

    return {
      results,
      flaggedTradeIds,
      summary,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get market trade size statistics
   */
  getMarketStats(marketId: string): MarketTradeSizeStats | null {
    return this.getOrCalculateMarketStats(marketId);
  }

  /**
   * Get percentiles for a market
   */
  getMarketPercentiles(marketId: string): TradeSizePercentiles | null {
    const stats = this.getOrCalculateMarketStats(marketId);
    return stats?.percentiles ?? null;
  }

  /**
   * Check if a trade size is an outlier for a market
   */
  isOutlierTrade(marketId: string, sizeUsd: number): boolean {
    const stats = this.getOrCalculateMarketStats(marketId);
    if (!stats || stats.tradeCount < this.config.minTradesForReliableStats) {
      // Fall back to absolute threshold
      return sizeUsd >= this.config.absoluteThresholds.large;
    }

    const zScore =
      stats.standardDeviation > 0 ? (sizeUsd - stats.averageSizeUsd) / stats.standardDeviation : 0;

    return shouldFlagTrade(
      findPercentileRank(
        this.marketTrades
          .get(marketId)
          ?.getAll()
          .map((t) => t.sizeUsd)
          .sort((a, b) => a - b) ?? [],
        sizeUsd
      ),
      zScore,
      sizeUsd,
      this.config
    );
  }

  /**
   * Get percentile rank for a trade size
   */
  getPercentileRank(marketId: string, sizeUsd: number): number {
    const trades = this.marketTrades.get(marketId)?.getAll() ?? [];
    const sortedSizes = trades.map((t) => t.sizeUsd).sort((a, b) => a - b);
    return findPercentileRank(sortedSizes, sizeUsd);
  }

  /**
   * Get z-score for a trade size
   */
  getZScore(marketId: string, sizeUsd: number): number {
    const stats = this.getOrCalculateMarketStats(marketId);
    if (!stats || stats.standardDeviation === 0) return 0;
    return (sizeUsd - stats.averageSizeUsd) / stats.standardDeviation;
  }

  /**
   * Get large trade stats for a wallet
   */
  getWalletLargeTradeStats(walletAddress: string): WalletLargeTradeStats | null {
    return this.walletLargeTradeStats.get(walletAddress.toLowerCase()) ?? null;
  }

  /**
   * Get large trade stats for a market
   */
  getMarketLargeTradeStats(marketId: string): MarketLargeTradeStats | null {
    return this.marketLargeTradeStats.get(marketId) ?? null;
  }

  /**
   * Get recent large trade events
   */
  getRecentLargeTradeEvents(limit: number = 20): LargeTradeEvent[] {
    return this.recentLargeTradeEvents.slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(): TradeSizeAnalyzerSummary {
    // Count flagged trades by severity
    const flaggedBySeverity: Record<TradeSizeSeverity, number> = {
      [TradeSizeSeverity.LOW]: 0,
      [TradeSizeSeverity.MEDIUM]: 0,
      [TradeSizeSeverity.HIGH]: 0,
      [TradeSizeSeverity.CRITICAL]: 0,
    };

    let totalFlaggedTrades = 0;

    for (const stats of this.marketLargeTradeStats.values()) {
      totalFlaggedTrades += stats.totalLargeTrades;
      for (const [severity, count] of Object.entries(stats.bySeverity)) {
        flaggedBySeverity[severity as TradeSizeSeverity] += count;
      }
    }

    // Top markets by large trades
    const topMarketsByLargeTrades = Array.from(this.marketLargeTradeStats.entries())
      .map(([marketId, stats]) => ({
        marketId,
        largeTradeCount: stats.totalLargeTrades,
        totalVolumeUsd: stats.totalLargeTradeVolumeUsd,
      }))
      .sort((a, b) => b.largeTradeCount - a.largeTradeCount)
      .slice(0, 10);

    // Top wallets by large trades
    const topWalletsByLargeTrades = Array.from(this.walletLargeTradeStats.entries())
      .map(([walletAddress, stats]) => ({
        walletAddress,
        largeTradeCount: stats.totalLargeTrades,
        totalVolumeUsd: stats.totalLargeTradeVolumeUsd,
      }))
      .sort((a, b) => b.largeTradeCount - a.largeTradeCount)
      .slice(0, 10);

    // Total trades analyzed
    let totalTradesAnalyzed = 0;
    for (const buffer of this.marketTrades.values()) {
      totalTradesAnalyzed += buffer.getCount();
    }

    return {
      totalMarkets: this.marketTrades.size,
      totalTradesAnalyzed,
      totalFlaggedTrades,
      flaggedBySeverity,
      topMarketsByLargeTrades,
      topWalletsByLargeTrades,
      recentLargeTradeEvents: this.recentLargeTradeEvents.slice(0, 20),
    };
  }

  /**
   * Get threshold configuration
   */
  getThresholdConfig(): TradeSizeThresholdConfig {
    return { ...this.config };
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    trackedMarkets: number;
    totalTrades: number;
    totalLargeTrades: number;
    trackedWallets: number;
    recentLargeTradeEvents: number;
    maxTradesPerMarket: number;
    alertCooldownMs: number;
  } {
    let totalTrades = 0;
    let totalLargeTrades = 0;

    for (const buffer of this.marketTrades.values()) {
      totalTrades += buffer.getCount();
    }

    for (const stats of this.marketLargeTradeStats.values()) {
      totalLargeTrades += stats.totalLargeTrades;
    }

    return {
      trackedMarkets: this.marketTrades.size,
      totalTrades,
      totalLargeTrades,
      trackedWallets: this.walletLargeTradeStats.size,
      recentLargeTradeEvents: this.recentLargeTradeEvents.length,
      maxTradesPerMarket: this.maxTradesPerMarket,
      alertCooldownMs: this.alertCooldownMs,
    };
  }

  /**
   * Clear data for a specific market
   */
  clearMarket(marketId: string): boolean {
    const deleted =
      this.marketTrades.delete(marketId) ||
      this.marketStats.delete(marketId) ||
      this.marketLargeTradeStats.delete(marketId);

    return deleted;
  }

  /**
   * Clear data for a specific wallet
   */
  clearWallet(walletAddress: string): boolean {
    return this.walletLargeTradeStats.delete(walletAddress.toLowerCase());
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.marketTrades.clear();
    this.marketStats.clear();
    this.walletLargeTradeStats.clear();
    this.marketLargeTradeStats.clear();
    this.recentLargeTradeEvents.length = 0;
    this.lastAlertTime.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private addTradeToMarket(trade: TradeEntry): void {
    let buffer = this.marketTrades.get(trade.marketId);
    if (!buffer) {
      buffer = new TradeRingBuffer(this.maxTradesPerMarket);
      this.marketTrades.set(trade.marketId, buffer);
    }
    buffer.add(trade);

    // Invalidate cached stats
    this.marketStats.delete(trade.marketId);
  }

  private getOrCalculateMarketStats(marketId: string): MarketTradeSizeStats | null {
    const cached = this.marketStats.get(marketId);
    if (cached) return cached;

    return this.calculateMarketStats(marketId);
  }

  private calculateMarketStats(marketId: string): MarketTradeSizeStats | null {
    const buffer = this.marketTrades.get(marketId);
    if (!buffer || buffer.getCount() === 0) return null;

    const trades = buffer.getAll();
    const sizes = trades.map((t) => t.sizeUsd);
    const sortedSizes = [...sizes].sort((a, b) => a - b);

    const totalVolumeUsd = sizes.reduce((a, b) => a + b, 0);
    const averageSizeUsd = totalVolumeUsd / sizes.length;
    const standardDeviation = calculateStdDev(sizes, averageSizeUsd);
    const skewness = calculateSkewness(sizes, averageSizeUsd, standardDeviation);

    const percentiles: TradeSizePercentiles = {
      p10: calculatePercentile(sortedSizes, 10),
      p25: calculatePercentile(sortedSizes, 25),
      p50: calculatePercentile(sortedSizes, 50),
      p75: calculatePercentile(sortedSizes, 75),
      p90: calculatePercentile(sortedSizes, 90),
      p95: calculatePercentile(sortedSizes, 95),
      p99: calculatePercentile(sortedSizes, 99),
      p995: calculatePercentile(sortedSizes, 99.5),
      p999: calculatePercentile(sortedSizes, 99.9),
    };

    const timestamps = trades.map((t) => t.timestamp);
    const stats: MarketTradeSizeStats = {
      marketId,
      tradeCount: trades.length,
      averageSizeUsd,
      standardDeviation,
      minSizeUsd: sortedSizes[0] ?? 0,
      maxSizeUsd: sortedSizes[sortedSizes.length - 1] ?? 0,
      totalVolumeUsd,
      percentiles,
      coefficientOfVariation: averageSizeUsd > 0 ? standardDeviation / averageSizeUsd : 0,
      skewness,
      timeRange: {
        startTime: new Date(Math.min(...timestamps)),
        endTime: new Date(Math.max(...timestamps)),
      },
      lastUpdated: new Date(),
    };

    this.marketStats.set(marketId, stats);

    if (this.enableEvents) {
      this.emit("statsUpdated", marketId, stats);
    }

    return stats;
  }

  private performAnalysis(
    trade: TradeEntry,
    stats: MarketTradeSizeStats | null,
    now: number
  ): TradeSizeAnalysisResult {
    const statsReliable = (stats?.tradeCount ?? 0) >= this.config.minTradesForReliableStats;

    // Get trade sizes for percentile calculation
    const trades = this.marketTrades.get(trade.marketId)?.getAll() ?? [];
    const sortedSizes = trades.map((t) => t.sizeUsd).sort((a, b) => a - b);

    // Calculate metrics
    const percentileRank = findPercentileRank(sortedSizes, trade.sizeUsd);
    const zScore =
      stats && stats.standardDeviation > 0
        ? (trade.sizeUsd - stats.averageSizeUsd) / stats.standardDeviation
        : 0;

    // Determine category and severity
    const category = determineSizeCategory(percentileRank, zScore, trade.sizeUsd, this.config);
    const isFlagged = shouldFlagTrade(percentileRank, zScore, trade.sizeUsd, this.config);
    const severity = isFlagged ? determineSeverity(zScore, this.config) : null;

    // Calculate comparison metrics
    const medianSize = stats?.percentiles.p50 ?? 0;
    const timesMedian = medianSize > 0 ? trade.sizeUsd / medianSize : 0;
    const timesAverage = stats && stats.averageSizeUsd > 0 ? trade.sizeUsd / stats.averageSizeUsd : 0;

    // Determine which threshold was exceeded
    let exceededThreshold: TradeSizeAnalysisResult["exceededThreshold"] = null;
    if (isFlagged) {
      if (percentileRank >= this.config.percentileThresholds.large) {
        exceededThreshold = {
          method: ThresholdMethod.PERCENTILE,
          threshold: this.config.percentileThresholds.large,
          value: percentileRank,
        };
      } else if (zScore >= this.config.zScoreThresholds.low) {
        exceededThreshold = {
          method: ThresholdMethod.Z_SCORE,
          threshold: this.config.zScoreThresholds.low,
          value: zScore,
        };
      } else if (trade.sizeUsd >= this.config.absoluteThresholds.large) {
        exceededThreshold = {
          method: ThresholdMethod.ABSOLUTE,
          threshold: this.config.absoluteThresholds.large,
          value: trade.sizeUsd,
        };
      }
    }

    return {
      trade,
      category,
      isFlagged,
      severity,
      percentileRank,
      zScore,
      marketStats: stats,
      timesMedian,
      timesAverage,
      exceededThreshold,
      analyzedAt: new Date(now),
      statsReliable,
    };
  }

  private trackLargeTrade(trade: TradeEntry, severity: TradeSizeSeverity, now: number): void {
    // Track by wallet
    const walletKey = trade.walletAddress.toLowerCase();
    let walletStats = this.walletLargeTradeStats.get(walletKey);
    if (!walletStats) {
      walletStats = {
        walletAddress: trade.walletAddress,
        totalLargeTrades: 0,
        bySeverity: {
          [TradeSizeSeverity.LOW]: 0,
          [TradeSizeSeverity.MEDIUM]: 0,
          [TradeSizeSeverity.HIGH]: 0,
          [TradeSizeSeverity.CRITICAL]: 0,
        },
        totalLargeTradeVolumeUsd: 0,
        averageLargeTradeSizeUsd: 0,
        recentLargeTrades: [],
        firstLargeTradeTime: null,
        lastLargeTradeTime: null,
      };
      this.walletLargeTradeStats.set(walletKey, walletStats);
    }

    walletStats.totalLargeTrades++;
    walletStats.bySeverity[severity]++;
    walletStats.totalLargeTradeVolumeUsd += trade.sizeUsd;
    walletStats.averageLargeTradeSizeUsd =
      walletStats.totalLargeTradeVolumeUsd / walletStats.totalLargeTrades;

    if (!walletStats.firstLargeTradeTime) {
      walletStats.firstLargeTradeTime = new Date(trade.timestamp);
    }
    walletStats.lastLargeTradeTime = new Date(trade.timestamp);

    // Add to recent trades (keep window)
    walletStats.recentLargeTrades.push({
      tradeId: trade.tradeId,
      marketId: trade.marketId,
      sizeUsd: trade.sizeUsd,
      severity,
      timestamp: new Date(trade.timestamp),
    });

    // Clean old entries
    walletStats.recentLargeTrades = walletStats.recentLargeTrades.filter(
      (t) => now - t.timestamp.getTime() < this.recentLargeTradesWindowMs
    );

    // Track by market
    let marketStats = this.marketLargeTradeStats.get(trade.marketId);
    if (!marketStats) {
      marketStats = {
        marketId: trade.marketId,
        totalLargeTrades: 0,
        bySeverity: {
          [TradeSizeSeverity.LOW]: 0,
          [TradeSizeSeverity.MEDIUM]: 0,
          [TradeSizeSeverity.HIGH]: 0,
          [TradeSizeSeverity.CRITICAL]: 0,
        },
        uniqueLargeTraders: 0,
        totalLargeTradeVolumeUsd: 0,
        recentLargeTrades: [],
      };
      this.marketLargeTradeStats.set(trade.marketId, marketStats);
    }

    marketStats.totalLargeTrades++;
    marketStats.bySeverity[severity]++;
    marketStats.totalLargeTradeVolumeUsd += trade.sizeUsd;

    // Add to recent trades
    marketStats.recentLargeTrades.push({
      tradeId: trade.tradeId,
      walletAddress: trade.walletAddress,
      sizeUsd: trade.sizeUsd,
      severity,
      timestamp: new Date(trade.timestamp),
    });

    // Clean old entries
    marketStats.recentLargeTrades = marketStats.recentLargeTrades.filter(
      (t) => now - t.timestamp.getTime() < this.recentLargeTradesWindowMs
    );

    // Count unique traders
    const uniqueTraders = new Set(marketStats.recentLargeTrades.map((t) => t.walletAddress.toLowerCase()));
    marketStats.uniqueLargeTraders = uniqueTraders.size;
  }

  private canEmitAlert(trade: TradeEntry, bypassCooldown: boolean, now: number): boolean {
    if (bypassCooldown) return true;

    const cooldownKey = `${trade.walletAddress.toLowerCase()}_${trade.marketId}`;
    const lastAlert = this.lastAlertTime.get(cooldownKey);

    if (!lastAlert) return true;
    return now - lastAlert >= this.alertCooldownMs;
  }

  private updateCooldown(trade: TradeEntry, now: number): void {
    const cooldownKey = `${trade.walletAddress.toLowerCase()}_${trade.marketId}`;
    this.lastAlertTime.set(cooldownKey, now);
  }

  private emitLargeTradeEvent(
    trade: TradeEntry,
    result: TradeSizeAnalysisResult,
    now: number
  ): void {
    const walletStats = this.walletLargeTradeStats.get(trade.walletAddress.toLowerCase());
    const marketStats = this.marketLargeTradeStats.get(trade.marketId);

    const event: LargeTradeEvent = {
      eventId: generateEventId(),
      trade,
      severity: result.severity!,
      category: result.category,
      percentileRank: result.percentileRank,
      zScore: result.zScore,
      timesMedian: result.timesMedian,
      detectedAt: new Date(now),
      marketStats: {
        averageSizeUsd: result.marketStats?.averageSizeUsd ?? 0,
        medianSizeUsd: result.marketStats?.percentiles.p50 ?? 0,
        tradeCount: result.marketStats?.tradeCount ?? 0,
      },
      context: {
        walletRecentLargeTradeCount: walletStats?.recentLargeTrades.length ?? 0,
        marketRecentLargeTradeCount: marketStats?.recentLargeTrades.length ?? 0,
        isRepeatLargeTrader: (walletStats?.totalLargeTrades ?? 0) > 1,
      },
    };

    // Store recent event
    this.recentLargeTradeEvents.unshift(event);
    if (this.recentLargeTradeEvents.length > this.maxRecentLargeTradeEvents) {
      this.recentLargeTradeEvents.pop();
    }

    // Emit events
    this.emit("largeTradeDetected", event);

    if (result.category === TradeSizeCategory.WHALE) {
      this.emit("whaleTradeDetected", event);
    }
  }

  private createInvalidResult(trade: TradeEntry, now: number): TradeSizeAnalysisResult {
    return {
      trade,
      category: TradeSizeCategory.MEDIUM,
      isFlagged: false,
      severity: null,
      percentileRank: 50,
      zScore: 0,
      marketStats: null,
      timesMedian: 0,
      timesAverage: 0,
      exceededThreshold: null,
      analyzedAt: new Date(now),
      statsReliable: false,
    };
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedAnalyzer: TradeSizeAnalyzer | null = null;

/**
 * Create a new TradeSizeAnalyzer instance
 */
export function createTradeSizeAnalyzer(config?: TradeSizeAnalyzerConfig): TradeSizeAnalyzer {
  return new TradeSizeAnalyzer(config);
}

/**
 * Get the shared TradeSizeAnalyzer instance
 */
export function getSharedTradeSizeAnalyzer(): TradeSizeAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new TradeSizeAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared TradeSizeAnalyzer instance
 */
export function setSharedTradeSizeAnalyzer(analyzer: TradeSizeAnalyzer): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared TradeSizeAnalyzer instance
 */
export function resetSharedTradeSizeAnalyzer(): void {
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
 * Analyze a single trade (convenience function)
 */
export function analyzeTrade(
  trade: TradeEntry,
  options?: AnalyzeTradeOptions & { analyzer?: TradeSizeAnalyzer }
): TradeSizeAnalysisResult {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.analyzeTrade(trade, options);
}

/**
 * Analyze multiple trades (convenience function)
 */
export function analyzeTrades(
  trades: TradeEntry[],
  options?: AnalyzeTradeOptions & { analyzer?: TradeSizeAnalyzer }
): BatchTradeSizeAnalysisResult {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.analyzeTrades(trades, options);
}

/**
 * Check if a trade is an outlier (convenience function)
 */
export function isTradeOutlier(
  marketId: string,
  sizeUsd: number,
  options?: { analyzer?: TradeSizeAnalyzer }
): boolean {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.isOutlierTrade(marketId, sizeUsd);
}

/**
 * Get trade size percentile rank (convenience function)
 */
export function getTradeSizePercentileRank(
  marketId: string,
  sizeUsd: number,
  options?: { analyzer?: TradeSizeAnalyzer }
): number {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.getPercentileRank(marketId, sizeUsd);
}

/**
 * Get market trade size statistics (convenience function)
 */
export function getMarketTradeSizeStats(
  marketId: string,
  options?: { analyzer?: TradeSizeAnalyzer }
): MarketTradeSizeStats | null {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.getMarketStats(marketId);
}

/**
 * Get trade size analyzer summary (convenience function)
 */
export function getTradeSizeAnalyzerSummary(options?: {
  analyzer?: TradeSizeAnalyzer;
}): TradeSizeAnalyzerSummary {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.getSummary();
}

/**
 * Get recent large trade events (convenience function)
 */
export function getRecentLargeTrades(
  limit?: number,
  options?: { analyzer?: TradeSizeAnalyzer }
): LargeTradeEvent[] {
  const analyzer = options?.analyzer ?? getSharedTradeSizeAnalyzer();
  return analyzer.getRecentLargeTradeEvents(limit);
}
