/**
 * First Trade Size Analyzer (DET-FRESH-004)
 *
 * Flags when a wallet's first trade on Polymarket is unusually large.
 * This can be an indicator of insider trading or whale activity.
 *
 * Features:
 * - Track first trade per wallet
 * - Compare to average first trades
 * - Calculate size percentile
 * - Flag outliers based on configurable thresholds
 * - Batch processing for multiple wallets
 */

import { isAddress, getAddress } from "viem";
import { type Trade } from "../api/clob/types";
import { getAllTradesByWallet } from "../api/clob/trades";
import { type ClobClient } from "../api/clob/client";
import {
  FreshWalletAlertSeverity,
  getSharedFreshWalletConfigManager,
  type FreshWalletConfigManager,
} from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Size category for first trade classification
 */
export enum FirstTradeSizeCategory {
  /** Very small first trade (below average) */
  SMALL = "SMALL",
  /** Normal first trade size */
  NORMAL = "NORMAL",
  /** Above average first trade */
  LARGE = "LARGE",
  /** Very large first trade (potential whale) */
  VERY_LARGE = "VERY_LARGE",
  /** Exceptionally large first trade (outlier) */
  OUTLIER = "OUTLIER",
}

/**
 * Result of first trade size analysis
 */
export interface FirstTradeSizeResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Whether this wallet has made any trades on Polymarket */
  hasTrades: boolean;

  /** Whether this is flagged as unusually large */
  isOutlier: boolean;

  /** The first trade made by this wallet (if any) */
  firstTrade: FirstTradeInfo | null;

  /** Size category classification */
  sizeCategory: FirstTradeSizeCategory;

  /** Percentile rank of the first trade size (0-100) */
  percentile: number | null;

  /** How many standard deviations from mean */
  zScore: number | null;

  /** Multiple of average first trade size */
  multipleOfAverage: number | null;

  /** Alert severity based on analysis */
  severity: FreshWalletAlertSeverity;

  /** Reasons why this was flagged (if any) */
  flagReasons: string[];

  /** Statistics used for comparison */
  comparisonStats: FirstTradeStats | null;

  /** Whether result was from cache */
  fromCache: boolean;

  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Information about a wallet's first trade
 */
export interface FirstTradeInfo {
  /** Trade ID */
  id: string;

  /** Asset/token ID traded */
  assetId: string;

  /** Trade size in raw units */
  size: number;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade price */
  price: number;

  /** Trade direction (buy/sell) */
  side: "buy" | "sell";

  /** Timestamp of the trade */
  timestamp: string;

  /** Transaction hash (if available) */
  transactionHash: string | null;
}

/**
 * Statistics for first trade comparisons
 */
export interface FirstTradeStats {
  /** Number of wallets in the sample */
  sampleSize: number;

  /** Average first trade size in USD */
  averageSizeUsd: number;

  /** Median first trade size in USD */
  medianSizeUsd: number;

  /** Standard deviation of first trade sizes */
  stdDeviation: number;

  /** 75th percentile threshold */
  percentile75: number;

  /** 90th percentile threshold */
  percentile90: number;

  /** 95th percentile threshold */
  percentile95: number;

  /** 99th percentile threshold */
  percentile99: number;

  /** Minimum first trade size observed */
  minSizeUsd: number;

  /** Maximum first trade size observed */
  maxSizeUsd: number;

  /** When these stats were calculated */
  calculatedAt: Date;
}

/**
 * Thresholds for flagging first trades
 */
export interface FirstTradeSizeThresholds {
  /** Minimum trade size (USD) to consider for analysis (default: 10) */
  minSizeUsd: number;

  /** Z-score threshold for flagging as outlier (default: 2.5) */
  outlierZScore: number;

  /** Percentile threshold for LARGE category (default: 75) */
  largePercentile: number;

  /** Percentile threshold for VERY_LARGE category (default: 90) */
  veryLargePercentile: number;

  /** Percentile threshold for OUTLIER category (default: 95) */
  outlierPercentile: number;

  /** Multiple of average to flag as suspicious (default: 5) */
  suspiciousMultiple: number;

  /** Absolute USD threshold for automatic flagging (default: 10000) */
  absoluteThresholdUsd: number;
}

/**
 * Options for first trade size analysis
 */
export interface FirstTradeSizeOptions {
  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Custom thresholds */
  thresholds?: Partial<FirstTradeSizeThresholds>;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;

  /** Custom comparison stats (for testing or pre-computed stats) */
  comparisonStats?: FirstTradeStats;
}

/**
 * Batch result for multiple wallet analyses
 */
export interface BatchFirstTradeSizeResult {
  /** Successful analysis results by address */
  results: Map<string, FirstTradeSizeResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful analyses */
  successCount: number;

  /** Number of failed analyses */
  errorCount: number;

  /** Number flagged as outliers */
  outlierCount: number;

  /** Count by size category */
  bySizeCategory: Record<FirstTradeSizeCategory, number>;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for first trade analysis
 */
export interface FirstTradeSizeSummary {
  /** Total wallets analyzed */
  total: number;

  /** Wallets with trades */
  withTrades: number;

  /** Wallets without trades */
  withoutTrades: number;

  /** Count by size category */
  bySizeCategory: Record<FirstTradeSizeCategory, number>;

  /** Count by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Percentage flagged as outliers */
  outlierPercentage: number;

  /** Average first trade size USD */
  averageFirstTradeSizeUsd: number | null;

  /** Median first trade size USD */
  medianFirstTradeSizeUsd: number | null;
}

/**
 * Configuration for FirstTradeSizeAnalyzer
 */
export interface FirstTradeSizeAnalyzerConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Default thresholds */
  thresholds?: Partial<FirstTradeSizeThresholds>;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Historical first trade samples for statistics (optional) */
  historicalSamples?: number[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/** Default thresholds for first trade analysis */
export const DEFAULT_FIRST_TRADE_THRESHOLDS: FirstTradeSizeThresholds = {
  minSizeUsd: 10,
  outlierZScore: 2.5,
  largePercentile: 75,
  veryLargePercentile: 90,
  outlierPercentile: 95,
  suspiciousMultiple: 5,
  absoluteThresholdUsd: 10000,
};

/**
 * Default first trade statistics based on typical Polymarket behavior
 * These serve as fallback when no historical data is available
 */
export const DEFAULT_FIRST_TRADE_STATS: FirstTradeStats = {
  sampleSize: 1000,
  averageSizeUsd: 150,
  medianSizeUsd: 50,
  stdDeviation: 500,
  percentile75: 200,
  percentile90: 500,
  percentile95: 1000,
  percentile99: 5000,
  minSizeUsd: 1,
  maxSizeUsd: 50000,
  calculatedAt: new Date(),
};

// ============================================================================
// FirstTradeSizeAnalyzer Class
// ============================================================================

/**
 * Analyzer for first trade sizes to detect unusually large initial trades
 */
export class FirstTradeSizeAnalyzer {
  private readonly cache: Map<string, { result: FirstTradeSizeResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly thresholds: FirstTradeSizeThresholds;
  private readonly clobClient?: ClobClient;
  // Config manager stored for future integration with FreshWalletConfig thresholds
  private readonly _configManager: FreshWalletConfigManager;
  private historicalStats: FirstTradeStats;
  private readonly historicalSamples: number[];

  constructor(config?: FirstTradeSizeAnalyzerConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.thresholds = {
      ...DEFAULT_FIRST_TRADE_THRESHOLDS,
      ...config?.thresholds,
    };
    this.clobClient = config?.clobClient;
    this._configManager = config?.configManager ?? getSharedFreshWalletConfigManager();
    this.historicalStats = { ...DEFAULT_FIRST_TRADE_STATS };
    this.historicalSamples = config?.historicalSamples ?? [];

    // Recalculate stats if historical samples provided
    if (this.historicalSamples.length > 0) {
      this.recalculateStats();
    }
  }

  /**
   * Analyze a wallet's first trade size
   */
  async analyzeWallet(
    address: string,
    options: FirstTradeSizeOptions = {}
  ): Promise<FirstTradeSizeResult> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const normalizedAddress = getAddress(address);

    // Check cache first
    if (!options.bypassCache) {
      const cached = this.getCachedResult(normalizedAddress);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    const {
      clobClient = this.clobClient,
      thresholds: customThresholds,
      comparisonStats = this.historicalStats,
    } = options;

    const effectiveThresholds = {
      ...this.thresholds,
      ...customThresholds,
    };

    // Fetch wallet trades
    const trades = await getAllTradesByWallet(normalizedAddress, {
      maxTrades: 100,
      client: clobClient,
    });

    // Handle case where wallet has no trades
    if (!trades || trades.length === 0) {
      const result: FirstTradeSizeResult = {
        address: normalizedAddress,
        hasTrades: false,
        isOutlier: false,
        firstTrade: null,
        sizeCategory: FirstTradeSizeCategory.SMALL,
        percentile: null,
        zScore: null,
        multipleOfAverage: null,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        comparisonStats,
        fromCache: false,
        analyzedAt: new Date(),
      };

      this.setCachedResult(normalizedAddress, result);
      return result;
    }

    // Sort trades by timestamp to get the first one
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const firstTrade = sortedTrades[0]!;
    const firstTradeInfo = this.parseTradeInfo(firstTrade);

    // Skip analysis if trade is below minimum size
    if (firstTradeInfo.sizeUsd < effectiveThresholds.minSizeUsd) {
      const result: FirstTradeSizeResult = {
        address: normalizedAddress,
        hasTrades: true,
        isOutlier: false,
        firstTrade: firstTradeInfo,
        sizeCategory: FirstTradeSizeCategory.SMALL,
        percentile: this.calculatePercentile(firstTradeInfo.sizeUsd, comparisonStats),
        zScore: this.calculateZScore(firstTradeInfo.sizeUsd, comparisonStats),
        multipleOfAverage: firstTradeInfo.sizeUsd / comparisonStats.averageSizeUsd,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        comparisonStats,
        fromCache: false,
        analyzedAt: new Date(),
      };

      this.setCachedResult(normalizedAddress, result);
      return result;
    }

    // Calculate statistics
    const percentile = this.calculatePercentile(firstTradeInfo.sizeUsd, comparisonStats);
    const zScore = this.calculateZScore(firstTradeInfo.sizeUsd, comparisonStats);
    const multipleOfAverage = firstTradeInfo.sizeUsd / comparisonStats.averageSizeUsd;

    // Determine size category
    const sizeCategory = this.determineSizeCategory(
      percentile,
      firstTradeInfo.sizeUsd,
      effectiveThresholds
    );

    // Check for outlier flags
    const { isOutlier, flagReasons } = this.checkOutlierFlags(
      firstTradeInfo.sizeUsd,
      percentile,
      zScore,
      multipleOfAverage,
      effectiveThresholds
    );

    // Determine severity
    const severity = this.determineSeverity(sizeCategory, isOutlier, flagReasons.length);

    // Add sample to historical data for future calculations
    this.addSample(firstTradeInfo.sizeUsd);

    const result: FirstTradeSizeResult = {
      address: normalizedAddress,
      hasTrades: true,
      isOutlier,
      firstTrade: firstTradeInfo,
      sizeCategory,
      percentile,
      zScore,
      multipleOfAverage,
      severity,
      flagReasons,
      comparisonStats,
      fromCache: false,
      analyzedAt: new Date(),
    };

    this.setCachedResult(normalizedAddress, result);
    return result;
  }

  /**
   * Analyze multiple wallets
   */
  async analyzeWallets(
    addresses: string[],
    options: FirstTradeSizeOptions = {}
  ): Promise<BatchFirstTradeSizeResult> {
    const startTime = Date.now();
    const results = new Map<string, FirstTradeSizeResult>();
    const errors = new Map<string, string>();
    let outlierCount = 0;
    const bySizeCategory: Record<FirstTradeSizeCategory, number> = {
      [FirstTradeSizeCategory.SMALL]: 0,
      [FirstTradeSizeCategory.NORMAL]: 0,
      [FirstTradeSizeCategory.LARGE]: 0,
      [FirstTradeSizeCategory.VERY_LARGE]: 0,
      [FirstTradeSizeCategory.OUTLIER]: 0,
    };

    for (const address of addresses) {
      try {
        const result = await this.analyzeWallet(address, options);
        results.set(result.address, result);

        if (result.isOutlier) {
          outlierCount++;
        }
        bySizeCategory[result.sizeCategory]++;
      } catch (error) {
        const normalizedAddress = isAddress(address) ? getAddress(address) : address;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.set(normalizedAddress, errorMessage);
      }
    }

    return {
      results,
      errors,
      totalProcessed: addresses.length,
      successCount: results.size,
      errorCount: errors.size,
      outlierCount,
      bySizeCategory,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for analyzed results
   */
  getSummary(results: FirstTradeSizeResult[]): FirstTradeSizeSummary {
    const bySizeCategory: Record<FirstTradeSizeCategory, number> = {
      [FirstTradeSizeCategory.SMALL]: 0,
      [FirstTradeSizeCategory.NORMAL]: 0,
      [FirstTradeSizeCategory.LARGE]: 0,
      [FirstTradeSizeCategory.VERY_LARGE]: 0,
      [FirstTradeSizeCategory.OUTLIER]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const firstTradeSizes: number[] = [];
    let outlierCount = 0;
    let withTrades = 0;
    let withoutTrades = 0;

    for (const result of results) {
      bySizeCategory[result.sizeCategory]++;
      bySeverity[result.severity]++;

      if (result.isOutlier) {
        outlierCount++;
      }

      if (result.hasTrades && result.firstTrade) {
        withTrades++;
        firstTradeSizes.push(result.firstTrade.sizeUsd);
      } else {
        withoutTrades++;
      }
    }

    // Calculate average and median
    firstTradeSizes.sort((a, b) => a - b);
    const averageFirstTradeSizeUsd =
      firstTradeSizes.length > 0
        ? firstTradeSizes.reduce((a, b) => a + b, 0) / firstTradeSizes.length
        : null;
    const medianFirstTradeSizeUsd =
      firstTradeSizes.length > 0
        ? firstTradeSizes.length % 2 === 0
          ? (firstTradeSizes[firstTradeSizes.length / 2 - 1]! +
              firstTradeSizes[firstTradeSizes.length / 2]!) /
            2
          : firstTradeSizes[Math.floor(firstTradeSizes.length / 2)]!
        : null;

    return {
      total: results.length,
      withTrades,
      withoutTrades,
      bySizeCategory,
      bySeverity,
      outlierPercentage:
        results.length > 0 ? Math.round((outlierCount / results.length) * 10000) / 100 : 0,
      averageFirstTradeSizeUsd:
        averageFirstTradeSizeUsd !== null ? Math.round(averageFirstTradeSizeUsd * 100) / 100 : null,
      medianFirstTradeSizeUsd:
        medianFirstTradeSizeUsd !== null ? Math.round(medianFirstTradeSizeUsd * 100) / 100 : null,
    };
  }

  /**
   * Check if a wallet's first trade is an outlier
   */
  async isFirstTradeOutlier(
    address: string,
    options?: FirstTradeSizeOptions
  ): Promise<boolean> {
    const result = await this.analyzeWallet(address, options);
    return result.isOutlier;
  }

  /**
   * Get first trade info for a wallet
   */
  async getFirstTrade(
    address: string,
    options?: Pick<FirstTradeSizeOptions, "clobClient" | "bypassCache">
  ): Promise<FirstTradeInfo | null> {
    const result = await this.analyzeWallet(address, options);
    return result.firstTrade;
  }

  /**
   * Get current thresholds
   */
  getThresholds(): FirstTradeSizeThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get current historical statistics
   */
  getHistoricalStats(): FirstTradeStats {
    return { ...this.historicalStats };
  }

  /**
   * Get the config manager for fresh wallet detection integration
   */
  getConfigManager(): FreshWalletConfigManager {
    return this._configManager;
  }

  /**
   * Add a sample to historical data and recalculate stats
   */
  addSample(sizeUsd: number): void {
    this.historicalSamples.push(sizeUsd);

    // Keep a rolling window of samples (max 10000)
    if (this.historicalSamples.length > 10000) {
      this.historicalSamples.shift();
    }

    // Recalculate stats if we have enough samples
    if (this.historicalSamples.length >= 10) {
      this.recalculateStats();
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
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTtlMs,
    };
  }

  /**
   * Invalidate cache entry for a specific address
   */
  invalidateCacheEntry(address: string): boolean {
    if (!isAddress(address)) {
      return false;
    }
    const normalizedAddress = getAddress(address);
    return this.cache.delete(normalizedAddress);
  }

  /**
   * Reset historical statistics to defaults
   */
  resetStats(): void {
    this.historicalSamples.length = 0;
    this.historicalStats = { ...DEFAULT_FIRST_TRADE_STATS };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Parse trade into FirstTradeInfo
   */
  private parseTradeInfo(trade: Trade): FirstTradeInfo {
    const size = parseFloat(trade.size);
    const price = parseFloat(trade.price);
    const sizeUsd = size * price;

    return {
      id: trade.id,
      assetId: trade.asset_id,
      size,
      sizeUsd,
      price,
      side: trade.side,
      timestamp: trade.created_at,
      transactionHash: trade.transaction_hash ?? null,
    };
  }

  /**
   * Calculate percentile of a value within the distribution
   */
  private calculatePercentile(value: number, stats: FirstTradeStats): number {
    // Approximate percentile using provided thresholds
    if (value <= stats.minSizeUsd) return 0;
    if (value >= stats.percentile99) return 99;
    if (value >= stats.percentile95) return 95 + (4 * (value - stats.percentile95)) / (stats.percentile99 - stats.percentile95);
    if (value >= stats.percentile90) return 90 + (5 * (value - stats.percentile90)) / (stats.percentile95 - stats.percentile90);
    if (value >= stats.percentile75) return 75 + (15 * (value - stats.percentile75)) / (stats.percentile90 - stats.percentile75);
    if (value >= stats.medianSizeUsd) return 50 + (25 * (value - stats.medianSizeUsd)) / (stats.percentile75 - stats.medianSizeUsd);
    return (50 * value) / stats.medianSizeUsd;
  }

  /**
   * Calculate z-score of a value
   */
  private calculateZScore(value: number, stats: FirstTradeStats): number {
    if (stats.stdDeviation === 0) return 0;
    return (value - stats.averageSizeUsd) / stats.stdDeviation;
  }

  /**
   * Determine size category based on percentile and thresholds
   */
  private determineSizeCategory(
    percentile: number,
    sizeUsd: number,
    thresholds: FirstTradeSizeThresholds
  ): FirstTradeSizeCategory {
    // Check absolute threshold first
    if (sizeUsd >= thresholds.absoluteThresholdUsd) {
      return FirstTradeSizeCategory.OUTLIER;
    }

    if (percentile >= thresholds.outlierPercentile) {
      return FirstTradeSizeCategory.OUTLIER;
    }
    if (percentile >= thresholds.veryLargePercentile) {
      return FirstTradeSizeCategory.VERY_LARGE;
    }
    if (percentile >= thresholds.largePercentile) {
      return FirstTradeSizeCategory.LARGE;
    }
    if (percentile >= 25) {
      return FirstTradeSizeCategory.NORMAL;
    }
    return FirstTradeSizeCategory.SMALL;
  }

  /**
   * Check for outlier flags
   */
  private checkOutlierFlags(
    sizeUsd: number,
    percentile: number,
    zScore: number,
    multipleOfAverage: number,
    thresholds: FirstTradeSizeThresholds
  ): { isOutlier: boolean; flagReasons: string[] } {
    const flagReasons: string[] = [];

    // Check absolute threshold
    if (sizeUsd >= thresholds.absoluteThresholdUsd) {
      flagReasons.push(
        `Trade size ($${sizeUsd.toFixed(2)}) exceeds absolute threshold ($${thresholds.absoluteThresholdUsd})`
      );
    }

    // Check percentile
    if (percentile >= thresholds.outlierPercentile) {
      flagReasons.push(
        `Trade is in the ${percentile.toFixed(1)}th percentile (threshold: ${thresholds.outlierPercentile})`
      );
    }

    // Check z-score
    if (zScore >= thresholds.outlierZScore) {
      flagReasons.push(
        `Z-score of ${zScore.toFixed(2)} exceeds threshold (${thresholds.outlierZScore})`
      );
    }

    // Check multiple of average
    if (multipleOfAverage >= thresholds.suspiciousMultiple) {
      flagReasons.push(
        `Trade is ${multipleOfAverage.toFixed(1)}x the average first trade size (threshold: ${thresholds.suspiciousMultiple}x)`
      );
    }

    return {
      isOutlier: flagReasons.length > 0,
      flagReasons,
    };
  }

  /**
   * Determine severity based on category and flags
   */
  private determineSeverity(
    category: FirstTradeSizeCategory,
    isOutlier: boolean,
    flagCount: number
  ): FreshWalletAlertSeverity {
    if (category === FirstTradeSizeCategory.OUTLIER || flagCount >= 3) {
      return FreshWalletAlertSeverity.CRITICAL;
    }
    if (category === FirstTradeSizeCategory.VERY_LARGE || flagCount >= 2) {
      return FreshWalletAlertSeverity.HIGH;
    }
    if (category === FirstTradeSizeCategory.LARGE || isOutlier) {
      return FreshWalletAlertSeverity.MEDIUM;
    }
    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Recalculate historical statistics from samples
   */
  private recalculateStats(): void {
    if (this.historicalSamples.length < 2) {
      return;
    }

    const sorted = [...this.historicalSamples].sort((a, b) => a - b);
    const n = sorted.length;

    // Calculate mean
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Calculate standard deviation
    const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Calculate percentiles
    const getPercentile = (p: number): number => {
      const idx = (p / 100) * (n - 1);
      const lower = Math.floor(idx);
      const upper = Math.ceil(idx);
      if (lower === upper) return sorted[lower]!;
      return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
    };

    this.historicalStats = {
      sampleSize: n,
      averageSizeUsd: Math.round(mean * 100) / 100,
      medianSizeUsd: getPercentile(50),
      stdDeviation: Math.round(stdDev * 100) / 100,
      percentile75: getPercentile(75),
      percentile90: getPercentile(90),
      percentile95: getPercentile(95),
      percentile99: getPercentile(99),
      minSizeUsd: sorted[0]!,
      maxSizeUsd: sorted[n - 1]!,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): FirstTradeSizeResult | null {
    const cached = this.cache.get(address);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached result
   */
  private setCachedResult(address: string, result: FirstTradeSizeResult): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(address, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedAnalyzer: FirstTradeSizeAnalyzer | null = null;

/**
 * Create a new FirstTradeSizeAnalyzer instance
 */
export function createFirstTradeSizeAnalyzer(
  config?: FirstTradeSizeAnalyzerConfig
): FirstTradeSizeAnalyzer {
  return new FirstTradeSizeAnalyzer(config);
}

/**
 * Get the shared FirstTradeSizeAnalyzer instance
 */
export function getSharedFirstTradeSizeAnalyzer(): FirstTradeSizeAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new FirstTradeSizeAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared FirstTradeSizeAnalyzer instance
 */
export function setSharedFirstTradeSizeAnalyzer(analyzer: FirstTradeSizeAnalyzer): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared FirstTradeSizeAnalyzer instance
 */
export function resetSharedFirstTradeSizeAnalyzer(): void {
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze a wallet's first trade size (convenience function)
 */
export async function analyzeFirstTradeSize(
  address: string,
  options?: FirstTradeSizeOptions & { analyzer?: FirstTradeSizeAnalyzer }
): Promise<FirstTradeSizeResult> {
  const analyzer = options?.analyzer ?? getSharedFirstTradeSizeAnalyzer();
  return analyzer.analyzeWallet(address, options);
}

/**
 * Analyze multiple wallets' first trade sizes (convenience function)
 */
export async function batchAnalyzeFirstTradeSize(
  addresses: string[],
  options?: FirstTradeSizeOptions & { analyzer?: FirstTradeSizeAnalyzer }
): Promise<BatchFirstTradeSizeResult> {
  const analyzer = options?.analyzer ?? getSharedFirstTradeSizeAnalyzer();
  return analyzer.analyzeWallets(addresses, options);
}

/**
 * Check if a wallet's first trade is an outlier (convenience function)
 */
export async function isFirstTradeOutlier(
  address: string,
  options?: FirstTradeSizeOptions & { analyzer?: FirstTradeSizeAnalyzer }
): Promise<boolean> {
  const analyzer = options?.analyzer ?? getSharedFirstTradeSizeAnalyzer();
  return analyzer.isFirstTradeOutlier(address, options);
}

/**
 * Get first trade info for a wallet (convenience function)
 */
export async function getFirstTradeInfo(
  address: string,
  options?: Pick<FirstTradeSizeOptions, "clobClient" | "bypassCache"> & {
    analyzer?: FirstTradeSizeAnalyzer;
  }
): Promise<FirstTradeInfo | null> {
  const analyzer = options?.analyzer ?? getSharedFirstTradeSizeAnalyzer();
  return analyzer.getFirstTrade(address, options);
}

/**
 * Get summary statistics for first trade results (convenience function)
 */
export function getFirstTradeSizeSummary(
  results: FirstTradeSizeResult[],
  analyzer?: FirstTradeSizeAnalyzer
): FirstTradeSizeSummary {
  const a = analyzer ?? getSharedFirstTradeSizeAnalyzer();
  return a.getSummary(results);
}
