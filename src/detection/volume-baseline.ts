/**
 * Market Baseline Volume Calculator (DET-VOL-001)
 *
 * Calculate normal volume baseline for each market to enable anomaly detection.
 *
 * Features:
 * - Collect historical volume data for markets
 * - Calculate rolling averages over configurable windows
 * - Account for market maturity (new markets may have different patterns)
 * - Update baselines periodically with configurable intervals
 * - In-memory caching with configurable TTL
 * - Support for multiple time windows (hourly, daily, weekly)
 */

import {
  type VolumeDataPoint,
  type TimeInterval,
  type TimeRange,
} from "../api/gamma/types";
import {
  getMarketById,
  getMarketVolumeHistory,
  type GetMarketByIdOptions,
  type GetMarketVolumeHistoryOptions,
} from "../api/gamma/markets";

// ============================================================================
// Types
// ============================================================================

/**
 * Market maturity classification based on age
 */
export enum MarketMaturity {
  /** Market is less than 24 hours old */
  VERY_NEW = "VERY_NEW",
  /** Market is 1-7 days old */
  NEW = "NEW",
  /** Market is 7-30 days old */
  YOUNG = "YOUNG",
  /** Market is 30-90 days old */
  ESTABLISHED = "ESTABLISHED",
  /** Market is older than 90 days */
  MATURE = "MATURE",
}

/**
 * Volume baseline time window type
 */
export enum BaselineWindow {
  /** 1-hour rolling window */
  HOURLY = "HOURLY",
  /** 4-hour rolling window */
  FOUR_HOUR = "FOUR_HOUR",
  /** 24-hour rolling window */
  DAILY = "DAILY",
  /** 7-day rolling window */
  WEEKLY = "WEEKLY",
  /** 30-day rolling window */
  MONTHLY = "MONTHLY",
}

/**
 * Volume statistics for a specific time window
 */
export interface WindowVolumeStats {
  /** The time window this stat covers */
  window: BaselineWindow;

  /** Average volume per period */
  averageVolume: number;

  /** Median volume per period */
  medianVolume: number;

  /** Standard deviation of volume */
  standardDeviation: number;

  /** Minimum volume observed */
  minVolume: number;

  /** Maximum volume observed */
  maxVolume: number;

  /** Total volume in window */
  totalVolume: number;

  /** Number of data points used */
  dataPointCount: number;

  /** 25th percentile volume */
  percentile25: number;

  /** 75th percentile volume */
  percentile75: number;

  /** 95th percentile volume (for spike detection) */
  percentile95: number;

  /** Average trade count per period (if available) */
  averageTradeCount: number | null;

  /** Coefficient of variation (stddev/mean) */
  coefficientOfVariation: number;
}

/**
 * Volume baseline for a specific market
 */
export interface MarketVolumeBaseline {
  /** Market ID */
  marketId: string;

  /** Market question (for reference) */
  question: string;

  /** Market category */
  category: string;

  /** Market maturity classification */
  maturity: MarketMaturity;

  /** Market age in days */
  marketAgeDays: number;

  /** Whether the market is active */
  isActive: boolean;

  /** Current total market volume */
  currentVolume: number;

  /** Current market liquidity (if available) */
  currentLiquidity: number | null;

  /** Volume statistics by time window */
  windowStats: Record<BaselineWindow, WindowVolumeStats>;

  /** Timestamp when baseline was calculated */
  calculatedAt: Date;

  /** Time range used for calculation */
  calculationTimeRange: {
    startDate: string;
    endDate: string;
  };

  /** Whether this result came from cache */
  fromCache: boolean;

  /** Expiration time for this baseline */
  expiresAt: Date;
}

/**
 * Options for calculating market volume baseline
 */
export interface CalculateBaselineOptions extends GetMarketByIdOptions {
  /** Number of days of historical data to use (default: 30) */
  lookbackDays?: number;

  /** Which windows to calculate (default: all) */
  windows?: BaselineWindow[];

  /** Bypass cache and force recalculation */
  bypassCache?: boolean;

  /** Custom cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Batch result for multiple market baseline calculations
 */
export interface BatchBaselineResult {
  /** Successful results by market ID */
  results: Map<string, MarketVolumeBaseline>;

  /** Failed market IDs with error messages */
  errors: Map<string, string>;

  /** Total markets processed */
  totalProcessed: number;

  /** Number of successful calculations */
  successCount: number;

  /** Number of failed calculations */
  errorCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for multiple baselines
 */
export interface BaselineSummary {
  /** Total markets analyzed */
  totalMarkets: number;

  /** Count by market maturity */
  byMaturity: Record<MarketMaturity, number>;

  /** Average daily volume across all markets */
  averageDailyVolume: number;

  /** Median daily volume across all markets */
  medianDailyVolume: number;

  /** Total volume across all markets */
  totalMarketVolume: number;

  /** Markets with highest daily volume */
  topMarketsByVolume: Array<{
    marketId: string;
    question: string;
    averageDailyVolume: number;
  }>;

  /** Markets with highest volume variability */
  mostVolatileMarkets: Array<{
    marketId: string;
    question: string;
    coefficientOfVariation: number;
  }>;
}

/**
 * Configuration for VolumeBaselineCalculator
 */
export interface VolumeBaselineCalculatorConfig {
  /** Default lookback period in days */
  defaultLookbackDays?: number;

  /** Default windows to calculate */
  defaultWindows?: BaselineWindow[];

  /** Cache configuration */
  cacheConfig?: {
    /** Enable caching (default: true) */
    enabled?: boolean;
    /** TTL in milliseconds (default: 15 minutes) */
    ttlMs?: number;
    /** Maximum cache entries (default: 1000) */
    maxSize?: number;
  };

  /** Update interval in milliseconds (default: 15 minutes) */
  updateIntervalMs?: number;

  /** Gamma client options */
  clientOptions?: GetMarketByIdOptions;
}

// ============================================================================
// Constants
// ============================================================================

/** Default lookback period in days */
const DEFAULT_LOOKBACK_DAYS = 30;

/** Default cache TTL in milliseconds (15 minutes) */
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

/** Maximum cache entries */
const DEFAULT_CACHE_MAX_SIZE = 1000;

/** Window duration in milliseconds */
const WINDOW_DURATION_MS: Record<BaselineWindow, number> = {
  [BaselineWindow.HOURLY]: 60 * 60 * 1000,
  [BaselineWindow.FOUR_HOUR]: 4 * 60 * 60 * 1000,
  [BaselineWindow.DAILY]: 24 * 60 * 60 * 1000,
  [BaselineWindow.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [BaselineWindow.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

/** Time interval to use for each window */
const WINDOW_INTERVAL: Record<BaselineWindow, TimeInterval> = {
  [BaselineWindow.HOURLY]: "1h",
  [BaselineWindow.FOUR_HOUR]: "4h",
  [BaselineWindow.DAILY]: "1d",
  [BaselineWindow.WEEKLY]: "1d", // Use daily data for weekly aggregation
  [BaselineWindow.MONTHLY]: "1d", // Use daily data for monthly aggregation
};

/** Maturity thresholds in days */
const MATURITY_THRESHOLDS = {
  veryNew: 1, // Less than 1 day
  new: 7, // 1-7 days
  young: 30, // 7-30 days
  established: 90, // 30-90 days
};

/** All baseline windows */
const ALL_WINDOWS: BaselineWindow[] = [
  BaselineWindow.HOURLY,
  BaselineWindow.FOUR_HOUR,
  BaselineWindow.DAILY,
  BaselineWindow.WEEKLY,
  BaselineWindow.MONTHLY,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate market maturity based on creation date
 */
function calculateMarketMaturity(createdAt: string): MarketMaturity {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const ageMs = now.getTime() - createdDate.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays < MATURITY_THRESHOLDS.veryNew) {
    return MarketMaturity.VERY_NEW;
  }
  if (ageDays < MATURITY_THRESHOLDS.new) {
    return MarketMaturity.NEW;
  }
  if (ageDays < MATURITY_THRESHOLDS.young) {
    return MarketMaturity.YOUNG;
  }
  if (ageDays < MATURITY_THRESHOLDS.established) {
    return MarketMaturity.ESTABLISHED;
  }
  return MarketMaturity.MATURE;
}

/**
 * Calculate market age in days
 */
function calculateMarketAgeDays(createdAt: string): number {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const ageMs = now.getTime() - createdDate.getTime();
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
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
 * Aggregate volume data points into window-sized buckets
 */
function aggregateVolumeByWindow(
  dataPoints: VolumeDataPoint[],
  windowMs: number
): number[] {
  if (dataPoints.length === 0) return [];

  const volumes: Map<number, number> = new Map();

  for (const point of dataPoints) {
    const timestamp = new Date(point.timestamp).getTime();
    const bucket = Math.floor(timestamp / windowMs);
    const current = volumes.get(bucket) ?? 0;
    volumes.set(bucket, current + point.volume);
  }

  return Array.from(volumes.values());
}

/**
 * Calculate window volume statistics from aggregated volumes
 */
function calculateWindowStats(
  window: BaselineWindow,
  volumes: number[],
  tradeCounts: (number | undefined)[]
): WindowVolumeStats {
  if (volumes.length === 0) {
    return {
      window,
      averageVolume: 0,
      medianVolume: 0,
      standardDeviation: 0,
      minVolume: 0,
      maxVolume: 0,
      totalVolume: 0,
      dataPointCount: 0,
      percentile25: 0,
      percentile75: 0,
      percentile95: 0,
      averageTradeCount: null,
      coefficientOfVariation: 0,
    };
  }

  const sortedVolumes = [...volumes].sort((a, b) => a - b);
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const averageVolume = totalVolume / volumes.length;
  const standardDeviation = calculateStdDev(volumes, averageVolume);

  // Calculate trade count average if available
  const validTradeCounts = tradeCounts.filter(
    (tc): tc is number => tc !== undefined
  );
  const averageTradeCount =
    validTradeCounts.length > 0
      ? validTradeCounts.reduce((a, b) => a + b, 0) / validTradeCounts.length
      : null;

  return {
    window,
    averageVolume,
    medianVolume: calculatePercentile(sortedVolumes, 50),
    standardDeviation,
    minVolume: sortedVolumes[0] ?? 0,
    maxVolume: sortedVolumes[sortedVolumes.length - 1] ?? 0,
    totalVolume,
    dataPointCount: volumes.length,
    percentile25: calculatePercentile(sortedVolumes, 25),
    percentile75: calculatePercentile(sortedVolumes, 75),
    percentile95: calculatePercentile(sortedVolumes, 95),
    averageTradeCount,
    coefficientOfVariation:
      averageVolume > 0 ? standardDeviation / averageVolume : 0,
  };
}

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class BaselineCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  constructor(maxSize: number = DEFAULT_CACHE_MAX_SIZE, defaultTtlMs: number = DEFAULT_CACHE_TTL_MS) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.defaultTtlMs,
    };
  }
}

// ============================================================================
// VolumeBaselineCalculator Class
// ============================================================================

/**
 * Calculator for market volume baselines
 */
export class VolumeBaselineCalculator {
  private readonly cache: BaselineCache<MarketVolumeBaseline>;
  private readonly cacheEnabled: boolean;
  private readonly defaultLookbackDays: number;
  private readonly defaultWindows: BaselineWindow[];
  private readonly cacheTtlMs: number;
  private readonly clientOptions: GetMarketByIdOptions;

  constructor(config?: VolumeBaselineCalculatorConfig) {
    this.defaultLookbackDays = config?.defaultLookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    this.defaultWindows = config?.defaultWindows ?? ALL_WINDOWS;
    this.cacheTtlMs = config?.cacheConfig?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    this.cacheEnabled = config?.cacheConfig?.enabled ?? true;
    this.clientOptions = config?.clientOptions ?? {};

    this.cache = new BaselineCache<MarketVolumeBaseline>(
      config?.cacheConfig?.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      this.cacheTtlMs
    );
  }

  /**
   * Calculate volume baseline for a single market
   *
   * @param marketId - The market ID to calculate baseline for
   * @param options - Calculation options
   * @returns Market volume baseline or null if market not found
   */
  async calculateBaseline(
    marketId: string,
    options: CalculateBaselineOptions = {}
  ): Promise<MarketVolumeBaseline | null> {
    if (!marketId || marketId.trim() === "") {
      return null;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(marketId, options);
    if (this.cacheEnabled && !options.bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Fetch market data
    const market = await getMarketById(marketId, {
      client: options.client ?? this.clientOptions.client,
    });

    if (!market) {
      return null;
    }

    // Calculate time range for historical data
    const lookbackDays = options.lookbackDays ?? this.defaultLookbackDays;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const timeRange: TimeRange = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    // Determine which windows to calculate
    const windows = options.windows ?? this.defaultWindows;

    // Fetch volume history and calculate stats for each window
    const windowStats = await this.calculateAllWindowStats(
      marketId,
      timeRange,
      windows,
      options
    );

    // Calculate market maturity
    const maturity = calculateMarketMaturity(market.createdAt);
    const marketAgeDays = calculateMarketAgeDays(market.createdAt);

    const baseline: MarketVolumeBaseline = {
      marketId: market.id,
      question: market.question,
      category: market.category,
      maturity,
      marketAgeDays,
      isActive: market.active && !market.closed,
      currentVolume: market.volume ?? 0,
      currentLiquidity: market.liquidity ?? null,
      windowStats,
      calculatedAt: new Date(),
      calculationTimeRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      fromCache: false,
      expiresAt: new Date(Date.now() + (options.cacheTtlMs ?? this.cacheTtlMs)),
    };

    // Store in cache
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, baseline, options.cacheTtlMs);
    }

    return baseline;
  }

  /**
   * Calculate baselines for multiple markets
   *
   * @param marketIds - Array of market IDs
   * @param options - Calculation options
   * @returns Batch result with successes and failures
   */
  async batchCalculateBaselines(
    marketIds: string[],
    options: CalculateBaselineOptions = {}
  ): Promise<BatchBaselineResult> {
    const startTime = Date.now();
    const results = new Map<string, MarketVolumeBaseline>();
    const errors = new Map<string, string>();

    for (const marketId of marketIds) {
      try {
        const result = await this.calculateBaseline(marketId, options);
        if (result) {
          results.set(marketId, result);
        } else {
          errors.set(marketId, "Market not found");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.set(marketId, errorMessage);
      }
    }

    return {
      results,
      errors,
      totalProcessed: marketIds.length,
      successCount: results.size,
      errorCount: errors.size,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics from multiple baselines
   *
   * @param baselines - Array of market volume baselines
   * @returns Summary statistics
   */
  getSummary(baselines: MarketVolumeBaseline[]): BaselineSummary {
    if (baselines.length === 0) {
      return {
        totalMarkets: 0,
        byMaturity: {
          [MarketMaturity.VERY_NEW]: 0,
          [MarketMaturity.NEW]: 0,
          [MarketMaturity.YOUNG]: 0,
          [MarketMaturity.ESTABLISHED]: 0,
          [MarketMaturity.MATURE]: 0,
        },
        averageDailyVolume: 0,
        medianDailyVolume: 0,
        totalMarketVolume: 0,
        topMarketsByVolume: [],
        mostVolatileMarkets: [],
      };
    }

    // Count by maturity
    const byMaturity: Record<MarketMaturity, number> = {
      [MarketMaturity.VERY_NEW]: 0,
      [MarketMaturity.NEW]: 0,
      [MarketMaturity.YOUNG]: 0,
      [MarketMaturity.ESTABLISHED]: 0,
      [MarketMaturity.MATURE]: 0,
    };

    for (const baseline of baselines) {
      byMaturity[baseline.maturity]++;
    }

    // Calculate daily volume statistics
    const dailyVolumes = baselines.map(
      (b) => b.windowStats[BaselineWindow.DAILY]?.averageVolume ?? 0
    );
    const sortedDailyVolumes = [...dailyVolumes].sort((a, b) => a - b);
    const totalDailyVolume = dailyVolumes.reduce((a, b) => a + b, 0);
    const averageDailyVolume = totalDailyVolume / dailyVolumes.length;
    const medianDailyVolume = calculatePercentile(sortedDailyVolumes, 50);

    // Total market volume
    const totalMarketVolume = baselines.reduce((sum, b) => sum + b.currentVolume, 0);

    // Top markets by volume
    const sortedByVolume = [...baselines].sort(
      (a, b) =>
        (b.windowStats[BaselineWindow.DAILY]?.averageVolume ?? 0) -
        (a.windowStats[BaselineWindow.DAILY]?.averageVolume ?? 0)
    );
    const topMarketsByVolume = sortedByVolume.slice(0, 10).map((b) => ({
      marketId: b.marketId,
      question: b.question,
      averageDailyVolume: b.windowStats[BaselineWindow.DAILY]?.averageVolume ?? 0,
    }));

    // Most volatile markets (highest coefficient of variation)
    const sortedByVolatility = [...baselines].sort(
      (a, b) =>
        (b.windowStats[BaselineWindow.DAILY]?.coefficientOfVariation ?? 0) -
        (a.windowStats[BaselineWindow.DAILY]?.coefficientOfVariation ?? 0)
    );
    const mostVolatileMarkets = sortedByVolatility.slice(0, 10).map((b) => ({
      marketId: b.marketId,
      question: b.question,
      coefficientOfVariation:
        b.windowStats[BaselineWindow.DAILY]?.coefficientOfVariation ?? 0,
    }));

    return {
      totalMarkets: baselines.length,
      byMaturity,
      averageDailyVolume,
      medianDailyVolume,
      totalMarketVolume,
      topMarketsByVolume,
      mostVolatileMarkets,
    };
  }

  /**
   * Check if a volume is anomalous compared to baseline
   *
   * @param baseline - The market volume baseline
   * @param volume - The volume to check
   * @param window - The time window to compare against
   * @param stdDevMultiplier - Number of standard deviations for anomaly threshold (default: 2)
   * @returns Object indicating if volume is anomalous and by how much
   */
  isVolumeAnomalous(
    baseline: MarketVolumeBaseline,
    volume: number,
    window: BaselineWindow = BaselineWindow.DAILY,
    stdDevMultiplier: number = 2
  ): {
    isAnomalous: boolean;
    isHigh: boolean;
    isLow: boolean;
    zScore: number;
    percentileRank: number;
    thresholds: { low: number; high: number };
  } {
    const stats = baseline.windowStats[window];

    if (!stats || stats.dataPointCount === 0 || stats.averageVolume === 0) {
      return {
        isAnomalous: false,
        isHigh: false,
        isLow: false,
        zScore: 0,
        percentileRank: 50,
        thresholds: { low: 0, high: 0 },
      };
    }

    // Calculate z-score
    const zScore =
      stats.standardDeviation > 0
        ? (volume - stats.averageVolume) / stats.standardDeviation
        : 0;

    // Calculate thresholds
    const lowThreshold = stats.averageVolume - stdDevMultiplier * stats.standardDeviation;
    const highThreshold = stats.averageVolume + stdDevMultiplier * stats.standardDeviation;

    // Determine if anomalous
    const isHigh = volume > highThreshold;
    const isLow = volume < lowThreshold && volume >= 0;
    const isAnomalous = isHigh || isLow;

    // Estimate percentile rank
    let percentileRank = 50;
    if (volume <= stats.percentile25) {
      percentileRank = 25 * (volume / stats.percentile25);
    } else if (volume <= stats.medianVolume) {
      percentileRank = 25 + 25 * ((volume - stats.percentile25) / (stats.medianVolume - stats.percentile25));
    } else if (volume <= stats.percentile75) {
      percentileRank = 50 + 25 * ((volume - stats.medianVolume) / (stats.percentile75 - stats.medianVolume));
    } else if (volume <= stats.percentile95) {
      percentileRank = 75 + 20 * ((volume - stats.percentile75) / (stats.percentile95 - stats.percentile75));
    } else {
      percentileRank = 95 + 5 * Math.min(1, (volume - stats.percentile95) / stats.percentile95);
    }

    return {
      isAnomalous,
      isHigh,
      isLow,
      zScore,
      percentileRank: Math.min(100, Math.max(0, percentileRank)),
      thresholds: { low: Math.max(0, lowThreshold), high: highThreshold },
    };
  }

  /**
   * Get the appropriate comparison window based on market maturity
   *
   * @param maturity - Market maturity level
   * @returns Recommended baseline window for comparison
   */
  getRecommendedWindow(maturity: MarketMaturity): BaselineWindow {
    switch (maturity) {
      case MarketMaturity.VERY_NEW:
        return BaselineWindow.HOURLY;
      case MarketMaturity.NEW:
        return BaselineWindow.FOUR_HOUR;
      case MarketMaturity.YOUNG:
        return BaselineWindow.DAILY;
      case MarketMaturity.ESTABLISHED:
      case MarketMaturity.MATURE:
        return BaselineWindow.WEEKLY;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number; enabled: boolean } {
    const stats = this.cache.getStats();
    return { ...stats, enabled: this.cacheEnabled };
  }

  /**
   * Invalidate cache entry for a specific market
   */
  invalidateCacheEntry(marketId: string): boolean {
    // Since cache key includes options, we need to invalidate all variants
    // For simplicity, we'll just delete the default key
    const cacheKey = this.getCacheKey(marketId, {});
    return this.cache.delete(cacheKey);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate cache key for a market and options
   */
  private getCacheKey(marketId: string, options: CalculateBaselineOptions): string {
    const lookback = options.lookbackDays ?? this.defaultLookbackDays;
    const windows = (options.windows ?? this.defaultWindows).sort().join(",");
    return `baseline:${marketId}:${lookback}:${windows}`;
  }

  /**
   * Calculate volume statistics for all requested windows
   */
  private async calculateAllWindowStats(
    marketId: string,
    timeRange: TimeRange,
    windows: BaselineWindow[],
    options: CalculateBaselineOptions
  ): Promise<Record<BaselineWindow, WindowVolumeStats>> {
    const result: Record<BaselineWindow, WindowVolumeStats> = {} as Record<
      BaselineWindow,
      WindowVolumeStats
    >;

    // Group windows by required interval to minimize API calls
    const intervalGroups: Map<TimeInterval, BaselineWindow[]> = new Map();
    for (const window of windows) {
      const interval = WINDOW_INTERVAL[window];
      const group = intervalGroups.get(interval) ?? [];
      group.push(window);
      intervalGroups.set(interval, group);
    }

    // Fetch data and calculate stats for each interval group
    for (const [interval, windowGroup] of intervalGroups) {
      const volumeHistoryOptions: GetMarketVolumeHistoryOptions = {
        timeRange,
        interval,
        client: options.client ?? this.clientOptions.client,
      };

      const volumeHistory = await getMarketVolumeHistory(marketId, volumeHistoryOptions);

      if (!volumeHistory) {
        // Create empty stats for all windows in this group
        for (const window of windowGroup) {
          result[window] = calculateWindowStats(window, [], []);
        }
        continue;
      }

      // Calculate stats for each window using the fetched data
      for (const window of windowGroup) {
        const windowMs = WINDOW_DURATION_MS[window];
        const aggregatedVolumes = aggregateVolumeByWindow(
          volumeHistory.dataPoints,
          windowMs
        );
        const tradeCounts = volumeHistory.dataPoints.map((dp) => dp.tradeCount);

        result[window] = calculateWindowStats(window, aggregatedVolumes, tradeCounts);
      }
    }

    // Initialize any missing windows with empty stats
    for (const window of ALL_WINDOWS) {
      if (!result[window]) {
        result[window] = calculateWindowStats(window, [], []);
      }
    }

    return result;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedCalculator: VolumeBaselineCalculator | null = null;

/**
 * Create a new VolumeBaselineCalculator instance
 */
export function createVolumeBaselineCalculator(
  config?: VolumeBaselineCalculatorConfig
): VolumeBaselineCalculator {
  return new VolumeBaselineCalculator(config);
}

/**
 * Get the shared VolumeBaselineCalculator instance
 */
export function getSharedVolumeBaselineCalculator(): VolumeBaselineCalculator {
  if (!sharedCalculator) {
    sharedCalculator = new VolumeBaselineCalculator();
  }
  return sharedCalculator;
}

/**
 * Set the shared VolumeBaselineCalculator instance
 */
export function setSharedVolumeBaselineCalculator(
  calculator: VolumeBaselineCalculator
): void {
  sharedCalculator = calculator;
}

/**
 * Reset the shared VolumeBaselineCalculator instance
 */
export function resetSharedVolumeBaselineCalculator(): void {
  sharedCalculator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate market volume baseline (convenience function)
 */
export async function calculateMarketVolumeBaseline(
  marketId: string,
  options?: CalculateBaselineOptions & { calculator?: VolumeBaselineCalculator }
): Promise<MarketVolumeBaseline | null> {
  const calculator = options?.calculator ?? getSharedVolumeBaselineCalculator();
  return calculator.calculateBaseline(marketId, options);
}

/**
 * Calculate baselines for multiple markets (convenience function)
 */
export async function batchCalculateMarketVolumeBaselines(
  marketIds: string[],
  options?: CalculateBaselineOptions & { calculator?: VolumeBaselineCalculator }
): Promise<BatchBaselineResult> {
  const calculator = options?.calculator ?? getSharedVolumeBaselineCalculator();
  return calculator.batchCalculateBaselines(marketIds, options);
}

/**
 * Check if a volume is anomalous for a market (convenience function)
 */
export async function checkVolumeAnomaly(
  marketId: string,
  volume: number,
  options?: CalculateBaselineOptions & {
    calculator?: VolumeBaselineCalculator;
    window?: BaselineWindow;
    stdDevMultiplier?: number;
  }
): Promise<{
  baseline: MarketVolumeBaseline | null;
  analysis: ReturnType<VolumeBaselineCalculator["isVolumeAnomalous"]> | null;
}> {
  const calculator = options?.calculator ?? getSharedVolumeBaselineCalculator();
  const baseline = await calculator.calculateBaseline(marketId, options);

  if (!baseline) {
    return { baseline: null, analysis: null };
  }

  const window = options?.window ?? calculator.getRecommendedWindow(baseline.maturity);
  const analysis = calculator.isVolumeAnomalous(
    baseline,
    volume,
    window,
    options?.stdDevMultiplier
  );

  return { baseline, analysis };
}

/**
 * Get baseline summary for multiple markets (convenience function)
 */
export async function getMarketBaselineSummary(
  marketIds: string[],
  options?: CalculateBaselineOptions & { calculator?: VolumeBaselineCalculator }
): Promise<BaselineSummary> {
  const calculator = options?.calculator ?? getSharedVolumeBaselineCalculator();
  const batchResult = await calculator.batchCalculateBaselines(marketIds, options);
  return calculator.getSummary(Array.from(batchResult.results.values()));
}
