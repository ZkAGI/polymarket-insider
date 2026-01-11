/**
 * Position Sizing Pattern Analyzer (DET-PAT-006)
 *
 * Analyze how wallets size their positions to identify suspicious patterns.
 * This module tracks position sizes, calculates distributions, detects anomalies,
 * and scores sizing patterns for potential insider detection.
 *
 * Features:
 * - Track position sizes across markets
 * - Calculate size distribution and percentiles
 * - Detect size anomalies (unusually large/consistent/patterned)
 * - Score sizing patterns for suspicion signals
 * - Support batch analysis and caching
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Position sizing category based on relative size
 */
export enum SizingCategory {
  /** Very small position (< 10th percentile) */
  MICRO = "MICRO",
  /** Small position (10th-25th percentile) */
  SMALL = "SMALL",
  /** Medium position (25th-75th percentile) */
  MEDIUM = "MEDIUM",
  /** Large position (75th-90th percentile) */
  LARGE = "LARGE",
  /** Very large position (90th-99th percentile) */
  WHALE = "WHALE",
  /** Extreme position (> 99th percentile) */
  EXTREME = "EXTREME",
}

/**
 * Sizing pattern type
 */
export enum SizingPatternType {
  /** Unknown - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Consistent - similar size positions */
  CONSISTENT = "CONSISTENT",
  /** Variable - sizes vary widely */
  VARIABLE = "VARIABLE",
  /** Scaling up - positions getting larger over time */
  SCALING_UP = "SCALING_UP",
  /** Scaling down - positions getting smaller over time */
  SCALING_DOWN = "SCALING_DOWN",
  /** Round numbers - positions in round amounts */
  ROUND_NUMBERS = "ROUND_NUMBERS",
  /** Kelly criterion - appears to follow optimal sizing */
  KELLY_LIKE = "KELLY_LIKE",
  /** Fixed fraction - consistent percentage of portfolio */
  FIXED_FRACTION = "FIXED_FRACTION",
  /** Martingale - doubling after losses */
  MARTINGALE = "MARTINGALE",
  /** Anti-martingale - increasing after wins */
  ANTI_MARTINGALE = "ANTI_MARTINGALE",
  /** Pyramiding - adding to winning positions */
  PYRAMIDING = "PYRAMIDING",
  /** Split sizing - multiple positions in same market */
  SPLIT_SIZING = "SPLIT_SIZING",
  /** Confidence-based - larger when more confident */
  CONFIDENCE_BASED = "CONFIDENCE_BASED",
  /** Bot-like - very precise, repeating sizes */
  BOT_LIKE = "BOT_LIKE",
}

/**
 * Sizing anomaly type
 */
export enum SizingAnomalyType {
  /** Single position unusually large */
  UNUSUALLY_LARGE = "UNUSUALLY_LARGE",
  /** Sizes too consistent (suspicious precision) */
  SUSPICIOUS_CONSISTENCY = "SUSPICIOUS_CONSISTENCY",
  /** Round number bias */
  ROUND_NUMBER_BIAS = "ROUND_NUMBER_BIAS",
  /** Sudden size increase */
  SUDDEN_SIZE_INCREASE = "SUDDEN_SIZE_INCREASE",
  /** Large positions only on winners */
  LARGE_ON_WINNERS = "LARGE_ON_WINNERS",
  /** Position sizes correlated with outcomes */
  SIZE_OUTCOME_CORRELATION = "SIZE_OUTCOME_CORRELATION",
  /** Category-specific large positions */
  CATEGORY_CONCENTRATED_LARGE = "CATEGORY_CONCENTRATED_LARGE",
  /** Timing correlated with size */
  TIMING_SIZE_CORRELATION = "TIMING_SIZE_CORRELATION",
  /** Bot-like precision */
  PRECISION_ANOMALY = "PRECISION_ANOMALY",
}

/**
 * Suspicion level based on sizing patterns
 */
export enum SizingSuspicionLevel {
  /** Normal sizing behavior */
  NONE = "NONE",
  /** Slightly unusual */
  LOW = "LOW",
  /** Notable patterns */
  MEDIUM = "MEDIUM",
  /** Suspicious patterns */
  HIGH = "HIGH",
  /** Very suspicious - likely informed trading */
  CRITICAL = "CRITICAL",
}

/**
 * Position entry for sizing analysis
 */
export interface SizingPosition {
  /** Unique position ID */
  positionId: string;
  /** Market ID */
  marketId: string;
  /** Market category (optional) */
  marketCategory?: MarketCategory | string;
  /** Market title (optional) */
  marketTitle?: string;
  /** Position size in USD */
  sizeUsd: number;
  /** Position size in shares/contracts */
  shares?: number;
  /** Entry price (0-1 for binary markets) */
  entryPrice: number;
  /** Side (buy/sell) */
  side: "buy" | "sell";
  /** Entry timestamp */
  entryTimestamp: Date;
  /** Was this a winning position */
  isWinner?: boolean | null;
  /** Profit/loss in USD */
  pnl?: number | null;
  /** Time until market resolution (if known) */
  timeToResolution?: number;
  /** Confidence level indicated (if available) */
  confidenceLevel?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Size distribution statistics
 */
export interface SizeDistribution {
  /** Minimum size */
  min: number;
  /** Maximum size */
  max: number;
  /** Mean size */
  mean: number;
  /** Median size */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** Coefficient of variation */
  coefficientOfVariation: number;
  /** Skewness */
  skewness: number;
  /** Kurtosis */
  kurtosis: number;
  /** Percentiles */
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** Number of positions */
  count: number;
  /** Total volume */
  totalVolume: number;
}

/**
 * Sizing pattern match
 */
export interface SizingPatternMatch {
  /** Pattern type */
  pattern: SizingPatternType;
  /** Match score (0-100) */
  score: number;
  /** Evidence supporting the pattern */
  evidence: string[];
  /** Whether this is the primary pattern */
  isPrimary: boolean;
}

/**
 * Sizing anomaly detection result
 */
export interface SizingAnomaly {
  /** Anomaly type */
  type: SizingAnomalyType;
  /** Severity (0-100) */
  severity: number;
  /** Description */
  description: string;
  /** Related positions */
  relatedPositions: string[];
  /** Supporting data */
  data: Record<string, unknown>;
}

/**
 * Category-specific sizing stats
 */
export interface CategorySizingStats {
  /** Category */
  category: MarketCategory | string;
  /** Number of positions */
  positionCount: number;
  /** Average size */
  avgSize: number;
  /** Total volume */
  totalVolume: number;
  /** Win rate for this category */
  winRate: number;
  /** Average winning position size */
  avgWinnerSize: number;
  /** Average losing position size */
  avgLoserSize: number;
  /** Size ratio (winner/loser) */
  sizeRatio: number;
}

/**
 * Sizing trend over time
 */
export interface SizingTrend {
  /** Direction of trend */
  direction: "increasing" | "decreasing" | "stable" | "cyclical";
  /** Magnitude of change per position */
  magnitudePerPosition: number;
  /** Recent average (last 30%) */
  recentAvg: number;
  /** Historical average (first 70%) */
  historicalAvg: number;
  /** Change percentage */
  changePercent: number;
  /** Is trend statistically significant */
  isSignificant: boolean;
}

/**
 * Complete sizing analysis result
 */
export interface SizingAnalysisResult {
  /** Wallet address (checksummed) */
  walletAddress: string;
  /** Primary sizing pattern */
  primaryPattern: SizingPatternType;
  /** All pattern matches */
  patternMatches: SizingPatternMatch[];
  /** Size distribution stats */
  distribution: SizeDistribution;
  /** Sizing category (based on median position) */
  category: SizingCategory;
  /** Category-specific stats */
  categoryStats: CategorySizingStats[];
  /** Detected anomalies */
  anomalies: SizingAnomaly[];
  /** Sizing trend over time */
  trend: SizingTrend;
  /** Suspicion level */
  suspicionLevel: SizingSuspicionLevel;
  /** Suspicion score (0-100) */
  suspicionScore: number;
  /** Risk flags */
  riskFlags: string[];
  /** Insights about sizing behavior */
  insights: string[];
  /** Data quality score (0-100) */
  dataQuality: number;
  /** Is potentially suspicious */
  isPotentiallySuspicious: boolean;
  /** Total positions analyzed */
  totalPositions: number;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Batch analysis result
 */
export interface BatchSizingAnalysisResult {
  /** Results by wallet */
  results: Map<string, SizingAnalysisResult>;
  /** Failed analyses */
  failed: Map<string, Error>;
  /** Total processed */
  totalProcessed: number;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Analyzer summary statistics
 */
export interface SizingAnalyzerSummary {
  /** Total wallets tracked */
  totalWallets: number;
  /** Total positions tracked */
  totalPositions: number;
  /** Total volume tracked */
  totalVolume: number;
  /** Distribution by sizing category */
  categoryDistribution: Record<SizingCategory, number>;
  /** Pattern type distribution */
  patternDistribution: Record<SizingPatternType, number>;
  /** Suspicion level distribution */
  suspicionDistribution: Record<SizingSuspicionLevel, number>;
  /** Number of suspicious wallets */
  suspiciousWalletCount: number;
  /** Average suspicion score */
  avgSuspicionScore: number;
  /** Most common anomaly types */
  topAnomalyTypes: { type: SizingAnomalyType; count: number }[];
  /** Cache hit rate */
  cacheHitRate: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Configuration for the analyzer
 */
export interface PositionSizingAnalyzerConfig {
  /** Minimum positions for analysis */
  minPositions: number;
  /** Minimum positions for high confidence */
  minPositionsHighConfidence: number;
  /** Large position threshold percentile */
  largePositionPercentile: number;
  /** Consistency threshold (CV below this is consistent) */
  consistencyThreshold: number;
  /** Round number tolerance */
  roundNumberTolerance: number;
  /** Size correlation threshold for suspicion */
  sizeCorrelationThreshold: number;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Maximum positions per wallet */
  maxPositionsPerWallet: number;
  /** Enable events */
  enableEvents: boolean;
}

/**
 * Options for analyzing sizing
 */
export interface AnalyzeSizingOptions {
  /** Include category breakdown */
  includeCategoryBreakdown?: boolean;
  /** Include position details */
  includePositionDetails?: boolean;
  /** Minimum positions for analysis */
  minPositions?: number;
  /** Force refresh (bypass cache) */
  forceRefresh?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_SIZING_ANALYZER_CONFIG: PositionSizingAnalyzerConfig = {
  minPositions: 5,
  minPositionsHighConfidence: 20,
  largePositionPercentile: 90,
  consistencyThreshold: 0.3, // CV below 30% is considered consistent
  roundNumberTolerance: 0.01, // 1% tolerance for round numbers
  sizeCorrelationThreshold: 0.7, // 70% correlation for suspicion
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxPositionsPerWallet: 10000,
  enableEvents: true,
};

/**
 * Sizing category thresholds (percentiles)
 */
export const SIZING_CATEGORY_THRESHOLDS: Record<
  SizingCategory,
  { min: number; max: number }
> = {
  [SizingCategory.MICRO]: { min: 0, max: 10 },
  [SizingCategory.SMALL]: { min: 10, max: 25 },
  [SizingCategory.MEDIUM]: { min: 25, max: 75 },
  [SizingCategory.LARGE]: { min: 75, max: 90 },
  [SizingCategory.WHALE]: { min: 90, max: 99 },
  [SizingCategory.EXTREME]: { min: 99, max: 100 },
};

/**
 * Suspicion weights
 */
const SUSPICION_WEIGHTS = {
  sizeOutcomeCorrelation: 0.3,
  anomalyScore: 0.25,
  patternSuspicion: 0.2,
  consistencyAnomaly: 0.15,
  categoryConcentration: 0.1,
};

/**
 * Round numbers to check for
 */
const ROUND_NUMBERS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// ============================================================================
// Position Sizing Analyzer Class
// ============================================================================

/**
 * Position Sizing Pattern Analyzer
 *
 * Analyzes wallet position sizing patterns for suspicious activity.
 */
export class PositionSizingAnalyzer extends EventEmitter {
  private config: PositionSizingAnalyzerConfig;
  private positions: Map<string, SizingPosition[]>; // walletAddress -> positions
  private cache: Map<string, { result: SizingAnalysisResult; timestamp: number }>;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<PositionSizingAnalyzerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SIZING_ANALYZER_CONFIG, ...config };
    this.positions = new Map();
    this.cache = new Map();
  }

  /**
   * Add a position for tracking
   */
  addPosition(walletAddress: string, position: SizingPosition): void {
    const address = this.normalizeAddress(walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    let walletPositions = this.positions.get(address);
    if (!walletPositions) {
      walletPositions = [];
      this.positions.set(address, walletPositions);
    }

    // Check if position already exists (update if so)
    const existingIndex = walletPositions.findIndex(
      (p) => p.positionId === position.positionId
    );
    if (existingIndex >= 0) {
      walletPositions[existingIndex] = position;
    } else {
      walletPositions.push(position);
    }

    // Trim if over limit
    if (walletPositions.length > this.config.maxPositionsPerWallet) {
      walletPositions.sort(
        (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
      );
      walletPositions.splice(
        0,
        walletPositions.length - this.config.maxPositionsPerWallet
      );
    }

    // Invalidate cache
    this.cache.delete(address);

    if (this.config.enableEvents) {
      this.emit("position-added", { address, position });
    }
  }

  /**
   * Add multiple positions for a wallet
   */
  addPositions(walletAddress: string, positions: SizingPosition[]): void {
    for (const position of positions) {
      this.addPosition(walletAddress, position);
    }
  }

  /**
   * Get positions for a wallet
   */
  getPositions(walletAddress: string): SizingPosition[] {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return [];
    return this.positions.get(address) || [];
  }

  /**
   * Clear positions for a wallet
   */
  clearPositions(walletAddress: string): void {
    const address = this.normalizeAddress(walletAddress);
    if (address) {
      this.positions.delete(address);
      this.cache.delete(address);

      if (this.config.enableEvents) {
        this.emit("positions-cleared", { address });
      }
    }
  }

  /**
   * Analyze position sizing patterns for a wallet
   */
  analyze(
    walletAddress: string,
    options: AnalyzeSizingOptions = {}
  ): SizingAnalysisResult {
    const address = this.normalizeAddress(walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    const { forceRefresh = false } = options;

    // Check cache
    if (!forceRefresh) {
      const cached = this.cache.get(address);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
        this.cacheHits++;
        return cached.result;
      }
    }
    this.cacheMisses++;

    const positions = this.positions.get(address) || [];
    const result = this.computeAnalysis(address, positions, options);

    // Cache result
    this.cache.set(address, { result, timestamp: Date.now() });

    if (this.config.enableEvents) {
      this.emit("analysis-complete", { address, result });

      if (result.isPotentiallySuspicious) {
        this.emit("suspicious-sizing", { address, result });
      }
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    walletAddresses: string[],
    options: AnalyzeSizingOptions = {}
  ): BatchSizingAnalysisResult {
    const results = new Map<string, SizingAnalysisResult>();
    const failed = new Map<string, Error>();

    for (const address of walletAddresses) {
      try {
        const result = this.analyze(address, options);
        results.set(result.walletAddress, result);
      } catch (error) {
        failed.set(address, error as Error);
      }
    }

    return {
      results,
      failed,
      totalProcessed: walletAddresses.length,
      processedAt: new Date(),
    };
  }

  /**
   * Check if wallet has suspicious sizing patterns
   */
  hasSuspiciousSizing(walletAddress: string): boolean {
    try {
      const result = this.analyze(walletAddress);
      return result.isPotentiallySuspicious;
    } catch {
      return false;
    }
  }

  /**
   * Get wallets with suspicious sizing patterns
   */
  getSuspiciousWallets(minScore: number = 60): SizingAnalysisResult[] {
    const results: SizingAnalysisResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        if (result.suspicionScore >= minScore) {
          results.push(result);
        }
      } catch {
        // Skip
      }
    }
    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get high-conviction traders (large positions with high win rates)
   */
  getHighConvictionTraders(): SizingAnalysisResult[] {
    const results: SizingAnalysisResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        if (
          result.patternMatches.some(
            (m) =>
              m.pattern === SizingPatternType.CONFIDENCE_BASED && m.score >= 70
          ) ||
          result.anomalies.some(
            (a) => a.type === SizingAnomalyType.LARGE_ON_WINNERS && a.severity >= 60
          )
        ) {
          results.push(result);
        }
      } catch {
        // Skip
      }
    }
    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get summary statistics
   */
  getSummary(): SizingAnalyzerSummary {
    const categoryDistribution: Record<SizingCategory, number> = {
      [SizingCategory.MICRO]: 0,
      [SizingCategory.SMALL]: 0,
      [SizingCategory.MEDIUM]: 0,
      [SizingCategory.LARGE]: 0,
      [SizingCategory.WHALE]: 0,
      [SizingCategory.EXTREME]: 0,
    };

    const patternDistribution: Record<SizingPatternType, number> = {
      [SizingPatternType.UNKNOWN]: 0,
      [SizingPatternType.CONSISTENT]: 0,
      [SizingPatternType.VARIABLE]: 0,
      [SizingPatternType.SCALING_UP]: 0,
      [SizingPatternType.SCALING_DOWN]: 0,
      [SizingPatternType.ROUND_NUMBERS]: 0,
      [SizingPatternType.KELLY_LIKE]: 0,
      [SizingPatternType.FIXED_FRACTION]: 0,
      [SizingPatternType.MARTINGALE]: 0,
      [SizingPatternType.ANTI_MARTINGALE]: 0,
      [SizingPatternType.PYRAMIDING]: 0,
      [SizingPatternType.SPLIT_SIZING]: 0,
      [SizingPatternType.CONFIDENCE_BASED]: 0,
      [SizingPatternType.BOT_LIKE]: 0,
    };

    const suspicionDistribution: Record<SizingSuspicionLevel, number> = {
      [SizingSuspicionLevel.NONE]: 0,
      [SizingSuspicionLevel.LOW]: 0,
      [SizingSuspicionLevel.MEDIUM]: 0,
      [SizingSuspicionLevel.HIGH]: 0,
      [SizingSuspicionLevel.CRITICAL]: 0,
    };

    const anomalyTypeCounts = new Map<SizingAnomalyType, number>();
    let totalPositions = 0;
    let totalVolume = 0;
    let suspiciousCount = 0;
    let totalSuspicionScore = 0;
    let analyzedCount = 0;

    for (const address of this.positions.keys()) {
      const walletPositions = this.positions.get(address) || [];
      totalPositions += walletPositions.length;
      totalVolume += walletPositions.reduce((sum, p) => sum + p.sizeUsd, 0);

      try {
        const result = this.analyze(address);
        analyzedCount++;

        categoryDistribution[result.category]++;
        patternDistribution[result.primaryPattern]++;
        suspicionDistribution[result.suspicionLevel]++;
        totalSuspicionScore += result.suspicionScore;

        if (result.isPotentiallySuspicious) {
          suspiciousCount++;
        }

        for (const anomaly of result.anomalies) {
          const count = anomalyTypeCounts.get(anomaly.type) || 0;
          anomalyTypeCounts.set(anomaly.type, count + 1);
        }
      } catch {
        patternDistribution[SizingPatternType.UNKNOWN]++;
      }
    }

    const topAnomalyTypes = Array.from(anomalyTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    const totalCacheAccesses = this.cacheHits + this.cacheMisses;

    return {
      totalWallets: this.positions.size,
      totalPositions,
      totalVolume,
      categoryDistribution,
      patternDistribution,
      suspicionDistribution,
      suspiciousWalletCount: suspiciousCount,
      avgSuspicionScore:
        analyzedCount > 0 ? totalSuspicionScore / analyzedCount : 0,
      topAnomalyTypes,
      cacheHitRate:
        totalCacheAccesses > 0 ? this.cacheHits / totalCacheAccesses : 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.positions.clear();
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;

    if (this.config.enableEvents) {
      this.emit("all-cleared");
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private normalizeAddress(address: string): string | null {
    try {
      if (!isAddress(address)) return null;
      return getAddress(address);
    } catch {
      return null;
    }
  }

  private computeAnalysis(
    walletAddress: string,
    positions: SizingPosition[],
    options: AnalyzeSizingOptions
  ): SizingAnalysisResult {
    const { includeCategoryBreakdown = true } = options;

    // Calculate size distribution
    const distribution = this.calculateDistribution(positions);

    // Determine sizing category
    const category = this.determineSizingCategory(distribution, positions.length);

    // Detect patterns
    const patternMatches = this.detectPatterns(positions, distribution);
    const primaryPattern =
      patternMatches.length > 0
        ? patternMatches[0]!.pattern
        : SizingPatternType.UNKNOWN;

    // Calculate category-specific stats
    const categoryStats = includeCategoryBreakdown
      ? this.calculateCategoryStats(positions)
      : [];

    // Detect anomalies
    const anomalies = this.detectAnomalies(
      positions,
      distribution,
      categoryStats
    );

    // Calculate trend
    const trend = this.calculateTrend(positions);

    // Calculate suspicion
    const { suspicionLevel, suspicionScore, isPotentiallySuspicious, riskFlags } =
      this.calculateSuspicion(
        positions,
        distribution,
        patternMatches,
        anomalies,
        categoryStats
      );

    // Generate insights
    const insights = this.generateInsights(
      positions,
      distribution,
      patternMatches,
      anomalies,
      trend
    );

    // Data quality
    const dataQuality = this.calculateDataQuality(positions.length);

    return {
      walletAddress,
      primaryPattern,
      patternMatches,
      distribution,
      category,
      categoryStats,
      anomalies,
      trend,
      suspicionLevel,
      suspicionScore,
      riskFlags,
      insights,
      dataQuality,
      isPotentiallySuspicious,
      totalPositions: positions.length,
      analyzedAt: new Date(),
    };
  }

  private calculateDistribution(positions: SizingPosition[]): SizeDistribution {
    if (positions.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        coefficientOfVariation: 0,
        skewness: 0,
        kurtosis: 0,
        percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
        count: 0,
        totalVolume: 0,
      };
    }

    const sizes = positions.map((p) => p.sizeUsd).sort((a, b) => a - b);
    const n = sizes.length;
    const totalVolume = sizes.reduce((sum, s) => sum + s, 0);
    const mean = totalVolume / n;
    const min = sizes[0]!;
    const max = sizes[n - 1]!;
    const median = this.getPercentile(sizes, 50);

    // Standard deviation
    const variance =
      n > 1
        ? sizes.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (n - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    // Skewness (Fisher's)
    let skewness = 0;
    if (n > 2 && stdDev > 0) {
      const m3 = sizes.reduce((sum, s) => sum + Math.pow(s - mean, 3), 0) / n;
      skewness = m3 / Math.pow(stdDev, 3);
    }

    // Kurtosis (excess)
    let kurtosis = 0;
    if (n > 3 && stdDev > 0) {
      const m4 = sizes.reduce((sum, s) => sum + Math.pow(s - mean, 4), 0) / n;
      kurtosis = m4 / Math.pow(stdDev, 4) - 3;
    }

    return {
      min,
      max,
      mean,
      median,
      stdDev,
      coefficientOfVariation,
      skewness,
      kurtosis,
      percentiles: {
        p10: this.getPercentile(sizes, 10),
        p25: this.getPercentile(sizes, 25),
        p50: median,
        p75: this.getPercentile(sizes, 75),
        p90: this.getPercentile(sizes, 90),
        p95: this.getPercentile(sizes, 95),
        p99: this.getPercentile(sizes, 99),
      },
      count: n,
      totalVolume,
    };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower]!;
    const weight = index - lower;
    return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
  }

  private determineSizingCategory(
    distribution: SizeDistribution,
    positionCount: number
  ): SizingCategory {
    if (positionCount < this.config.minPositions) {
      return SizingCategory.MEDIUM; // Default
    }

    // Use median as representative size
    const medianSize = distribution.median;

    // Simple heuristics based on absolute values
    if (medianSize < 50) return SizingCategory.MICRO;
    if (medianSize < 200) return SizingCategory.SMALL;
    if (medianSize < 1000) return SizingCategory.MEDIUM;
    if (medianSize < 5000) return SizingCategory.LARGE;
    if (medianSize < 25000) return SizingCategory.WHALE;
    return SizingCategory.EXTREME;
  }

  private detectPatterns(
    positions: SizingPosition[],
    distribution: SizeDistribution
  ): SizingPatternMatch[] {
    const matches: SizingPatternMatch[] = [];

    if (positions.length < this.config.minPositions) {
      matches.push({
        pattern: SizingPatternType.UNKNOWN,
        score: 100,
        evidence: ["Insufficient positions for pattern detection"],
        isPrimary: true,
      });
      return matches;
    }

    // Check for consistent sizing
    const consistencyMatch = this.checkConsistentPattern(distribution);
    if (consistencyMatch) matches.push(consistencyMatch);

    // Check for variable sizing
    const variableMatch = this.checkVariablePattern(distribution);
    if (variableMatch) matches.push(variableMatch);

    // Check for round numbers
    const roundMatch = this.checkRoundNumberPattern(positions);
    if (roundMatch) matches.push(roundMatch);

    // Check for scaling patterns
    const scalingMatch = this.checkScalingPattern(positions);
    if (scalingMatch) matches.push(scalingMatch);

    // Check for bot-like patterns
    const botMatch = this.checkBotLikePattern(positions, distribution);
    if (botMatch) matches.push(botMatch);

    // Check for confidence-based sizing
    const confidenceMatch = this.checkConfidenceBasedPattern(positions);
    if (confidenceMatch) matches.push(confidenceMatch);

    // Check for martingale patterns
    const martingaleMatch = this.checkMartingalePattern(positions);
    if (martingaleMatch) matches.push(martingaleMatch);

    // Check for pyramiding
    const pyramidingMatch = this.checkPyramidingPattern(positions);
    if (pyramidingMatch) matches.push(pyramidingMatch);

    // Sort by score and mark primary
    matches.sort((a, b) => b.score - a.score);
    if (matches.length > 0) {
      matches[0]!.isPrimary = true;
    }

    return matches;
  }

  private checkConsistentPattern(
    distribution: SizeDistribution
  ): SizingPatternMatch | null {
    if (distribution.coefficientOfVariation < this.config.consistencyThreshold) {
      const score = Math.min(
        100,
        (1 - distribution.coefficientOfVariation / this.config.consistencyThreshold) * 100
      );
      return {
        pattern: SizingPatternType.CONSISTENT,
        score,
        evidence: [
          `Low coefficient of variation: ${distribution.coefficientOfVariation.toFixed(3)}`,
          `Positions cluster around ${distribution.mean.toFixed(2)} USD`,
        ],
        isPrimary: false,
      };
    }
    return null;
  }

  private checkVariablePattern(
    distribution: SizeDistribution
  ): SizingPatternMatch | null {
    if (distribution.coefficientOfVariation > 1.0) {
      const score = Math.min(100, distribution.coefficientOfVariation * 50);
      return {
        pattern: SizingPatternType.VARIABLE,
        score,
        evidence: [
          `High coefficient of variation: ${distribution.coefficientOfVariation.toFixed(3)}`,
          `Range from ${distribution.min.toFixed(2)} to ${distribution.max.toFixed(2)} USD`,
        ],
        isPrimary: false,
      };
    }
    return null;
  }

  private checkRoundNumberPattern(
    positions: SizingPosition[]
  ): SizingPatternMatch | null {
    let roundCount = 0;
    for (const pos of positions) {
      for (const round of ROUND_NUMBERS) {
        const ratio = pos.sizeUsd / round;
        if (
          Math.abs(ratio - Math.round(ratio)) < this.config.roundNumberTolerance
        ) {
          roundCount++;
          break;
        }
      }
    }

    const roundPercentage = roundCount / positions.length;
    if (roundPercentage >= 0.5) {
      return {
        pattern: SizingPatternType.ROUND_NUMBERS,
        score: roundPercentage * 100,
        evidence: [
          `${(roundPercentage * 100).toFixed(1)}% of positions are round numbers`,
          `${roundCount} of ${positions.length} positions`,
        ],
        isPrimary: false,
      };
    }
    return null;
  }

  private checkScalingPattern(
    positions: SizingPosition[]
  ): SizingPatternMatch | null {
    if (positions.length < 5) return null;

    const sorted = [...positions].sort(
      (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
    );

    // Simple linear regression on size over time
    const n = sorted.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += sorted[i]!.sizeUsd;
      sumXY += i * sorted[i]!.sizeUsd;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgSize = sumY / n;
    const slopePercent = avgSize > 0 ? (slope / avgSize) * 100 : 0;

    if (slopePercent > 5) {
      // 5% increase per position
      return {
        pattern: SizingPatternType.SCALING_UP,
        score: Math.min(100, slopePercent * 5),
        evidence: [
          `Size increasing by ${slopePercent.toFixed(1)}% per position`,
          `From avg ${sorted.slice(0, 3).reduce((s, p) => s + p.sizeUsd, 0) / 3} to ${sorted.slice(-3).reduce((s, p) => s + p.sizeUsd, 0) / 3} USD`,
        ],
        isPrimary: false,
      };
    } else if (slopePercent < -5) {
      return {
        pattern: SizingPatternType.SCALING_DOWN,
        score: Math.min(100, Math.abs(slopePercent) * 5),
        evidence: [
          `Size decreasing by ${Math.abs(slopePercent).toFixed(1)}% per position`,
        ],
        isPrimary: false,
      };
    }

    return null;
  }

  private checkBotLikePattern(
    positions: SizingPosition[],
    distribution: SizeDistribution
  ): SizingPatternMatch | null {
    if (positions.length < 10) return null;

    // Check for exact repeated sizes
    const sizeMap = new Map<string, number>();
    for (const pos of positions) {
      const roundedSize = pos.sizeUsd.toFixed(2);
      sizeMap.set(roundedSize, (sizeMap.get(roundedSize) || 0) + 1);
    }

    const maxRepeats = Math.max(...sizeMap.values());
    const repeatRatio = maxRepeats / positions.length;

    // Check for decimal precision patterns
    const precisionCounts = new Map<number, number>();
    for (const pos of positions) {
      const decimalPlaces = (pos.sizeUsd.toString().split(".")[1] || "").length;
      precisionCounts.set(decimalPlaces, (precisionCounts.get(decimalPlaces) || 0) + 1);
    }

    const maxPrecision = Math.max(...precisionCounts.values());
    const precisionRatio = maxPrecision / positions.length;

    if (repeatRatio > 0.3 || (precisionRatio > 0.8 && distribution.coefficientOfVariation < 0.2)) {
      const score = Math.max(repeatRatio, precisionRatio) * 100;
      return {
        pattern: SizingPatternType.BOT_LIKE,
        score,
        evidence: [
          repeatRatio > 0.3 ? `${(repeatRatio * 100).toFixed(1)}% of positions have identical sizes` : "",
          precisionRatio > 0.8 ? `Consistent decimal precision in ${(precisionRatio * 100).toFixed(1)}% of positions` : "",
        ].filter(Boolean),
        isPrimary: false,
      };
    }

    return null;
  }

  private checkConfidenceBasedPattern(
    positions: SizingPosition[]
  ): SizingPatternMatch | null {
    const withOutcomes = positions.filter((p) => p.isWinner !== undefined && p.isWinner !== null);
    if (withOutcomes.length < 10) return null;

    const winners = withOutcomes.filter((p) => p.isWinner === true);
    const losers = withOutcomes.filter((p) => p.isWinner === false);

    if (winners.length < 3 || losers.length < 3) return null;

    const avgWinnerSize =
      winners.reduce((sum, p) => sum + p.sizeUsd, 0) / winners.length;
    const avgLoserSize =
      losers.reduce((sum, p) => sum + p.sizeUsd, 0) / losers.length;

    const sizeRatio = avgWinnerSize / avgLoserSize;

    if (sizeRatio > 1.5) {
      const score = Math.min(100, (sizeRatio - 1) * 50);
      return {
        pattern: SizingPatternType.CONFIDENCE_BASED,
        score,
        evidence: [
          `Winning positions ${sizeRatio.toFixed(2)}x larger than losers`,
          `Avg winner: ${avgWinnerSize.toFixed(2)} USD, avg loser: ${avgLoserSize.toFixed(2)} USD`,
        ],
        isPrimary: false,
      };
    }

    return null;
  }

  private checkMartingalePattern(
    positions: SizingPosition[]
  ): SizingPatternMatch | null {
    const withOutcomes = positions.filter(
      (p) => p.isWinner !== undefined && p.isWinner !== null
    );
    if (withOutcomes.length < 10) return null;

    const sorted = [...withOutcomes].sort(
      (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
    );

    let doublingAfterLoss = 0;
    let lossFollowedByTrade = 0;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;

      if (prev.isWinner === false) {
        lossFollowedByTrade++;
        const ratio = curr.sizeUsd / prev.sizeUsd;
        if (ratio >= 1.8 && ratio <= 2.2) {
          doublingAfterLoss++;
        }
      }
    }

    if (lossFollowedByTrade >= 5) {
      const martingaleRatio = doublingAfterLoss / lossFollowedByTrade;
      if (martingaleRatio >= 0.4) {
        return {
          pattern: SizingPatternType.MARTINGALE,
          score: martingaleRatio * 100,
          evidence: [
            `${(martingaleRatio * 100).toFixed(1)}% of trades after losses are doubled`,
            `${doublingAfterLoss} doubling events detected`,
          ],
          isPrimary: false,
        };
      }
    }

    return null;
  }

  private checkPyramidingPattern(
    positions: SizingPosition[]
  ): SizingPatternMatch | null {
    // Group positions by market
    const marketPositions = new Map<string, SizingPosition[]>();
    for (const pos of positions) {
      const existing = marketPositions.get(pos.marketId) || [];
      existing.push(pos);
      marketPositions.set(pos.marketId, existing);
    }

    let pyramidingCount = 0;
    let multiPositionMarkets = 0;

    for (const [, mPositions] of marketPositions) {
      if (mPositions.length < 2) continue;
      multiPositionMarkets++;

      // Sort by time
      const sorted = [...mPositions].sort(
        (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
      );

      // Check if subsequent positions are larger and same side
      let isPyramiding = true;
      const firstSide = sorted[0]!.side;
      for (let i = 1; i < sorted.length; i++) {
        if (
          sorted[i]!.side !== firstSide ||
          sorted[i]!.sizeUsd <= sorted[i - 1]!.sizeUsd
        ) {
          isPyramiding = false;
          break;
        }
      }

      if (isPyramiding) {
        pyramidingCount++;
      }
    }

    if (multiPositionMarkets >= 3) {
      const pyramidingRatio = pyramidingCount / multiPositionMarkets;
      if (pyramidingRatio >= 0.3) {
        return {
          pattern: SizingPatternType.PYRAMIDING,
          score: pyramidingRatio * 100,
          evidence: [
            `${(pyramidingRatio * 100).toFixed(1)}% of multi-position markets show pyramiding`,
            `${pyramidingCount} markets with increasing position sizes`,
          ],
          isPrimary: false,
        };
      }
    }

    return null;
  }

  private calculateCategoryStats(
    positions: SizingPosition[]
  ): CategorySizingStats[] {
    const categoryMap = new Map<
      string,
      { positions: SizingPosition[]; winners: number; losers: number }
    >();

    for (const pos of positions) {
      const category = (pos.marketCategory || "unknown") as string;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { positions: [], winners: 0, losers: 0 });
      }
      const data = categoryMap.get(category)!;
      data.positions.push(pos);
      if (pos.isWinner === true) data.winners++;
      if (pos.isWinner === false) data.losers++;
    }

    const result: CategorySizingStats[] = [];
    for (const [category, data] of categoryMap) {
      const totalVolume = data.positions.reduce((sum, p) => sum + p.sizeUsd, 0);
      const avgSize = totalVolume / data.positions.length;

      const winners = data.positions.filter((p) => p.isWinner === true);
      const losers = data.positions.filter((p) => p.isWinner === false);

      const avgWinnerSize =
        winners.length > 0
          ? winners.reduce((sum, p) => sum + p.sizeUsd, 0) / winners.length
          : 0;
      const avgLoserSize =
        losers.length > 0
          ? losers.reduce((sum, p) => sum + p.sizeUsd, 0) / losers.length
          : 0;

      const resolved = data.winners + data.losers;
      const winRate = resolved > 0 ? (data.winners / resolved) * 100 : 0;

      result.push({
        category,
        positionCount: data.positions.length,
        avgSize,
        totalVolume,
        winRate,
        avgWinnerSize,
        avgLoserSize,
        sizeRatio: avgLoserSize > 0 ? avgWinnerSize / avgLoserSize : 0,
      });
    }

    return result.sort((a, b) => b.totalVolume - a.totalVolume);
  }

  private detectAnomalies(
    positions: SizingPosition[],
    distribution: SizeDistribution,
    categoryStats: CategorySizingStats[]
  ): SizingAnomaly[] {
    const anomalies: SizingAnomaly[] = [];

    if (positions.length < this.config.minPositions) {
      return anomalies;
    }

    // Check for unusually large positions
    const largeThreshold = distribution.percentiles.p90;
    const largePositions = positions.filter((p) => p.sizeUsd > largeThreshold);
    if (
      largePositions.length > 0 &&
      largePositions.some(
        (p) => p.sizeUsd > distribution.mean + 3 * distribution.stdDev
      )
    ) {
      const extremePositions = largePositions.filter(
        (p) => p.sizeUsd > distribution.mean + 3 * distribution.stdDev
      );
      anomalies.push({
        type: SizingAnomalyType.UNUSUALLY_LARGE,
        severity: Math.min(100, (extremePositions.length / positions.length) * 200),
        description: `${extremePositions.length} positions are 3+ standard deviations above mean`,
        relatedPositions: extremePositions.map((p) => p.positionId),
        data: {
          extremeCount: extremePositions.length,
          maxSize: Math.max(...extremePositions.map((p) => p.sizeUsd)),
          threshold: distribution.mean + 3 * distribution.stdDev,
        },
      });
    }

    // Check for suspicious consistency
    if (
      distribution.coefficientOfVariation < 0.1 &&
      positions.length >= 10
    ) {
      anomalies.push({
        type: SizingAnomalyType.SUSPICIOUS_CONSISTENCY,
        severity: Math.min(100, (0.1 - distribution.coefficientOfVariation) * 500),
        description: `Suspiciously consistent position sizes (CV: ${distribution.coefficientOfVariation.toFixed(3)})`,
        relatedPositions: [],
        data: {
          coefficientOfVariation: distribution.coefficientOfVariation,
          mean: distribution.mean,
          stdDev: distribution.stdDev,
        },
      });
    }

    // Check for round number bias
    let roundCount = 0;
    const roundPositions: string[] = [];
    for (const pos of positions) {
      for (const round of ROUND_NUMBERS) {
        const ratio = pos.sizeUsd / round;
        if (Math.abs(ratio - Math.round(ratio)) < this.config.roundNumberTolerance) {
          roundCount++;
          roundPositions.push(pos.positionId);
          break;
        }
      }
    }
    if (roundCount / positions.length > 0.7) {
      anomalies.push({
        type: SizingAnomalyType.ROUND_NUMBER_BIAS,
        severity: Math.min(100, (roundCount / positions.length - 0.5) * 200),
        description: `${(roundCount / positions.length * 100).toFixed(1)}% of positions are round numbers`,
        relatedPositions: roundPositions.slice(0, 10),
        data: {
          roundCount,
          totalCount: positions.length,
          percentage: roundCount / positions.length,
        },
      });
    }

    // Check for large positions only on winners
    const withOutcomes = positions.filter(
      (p) => p.isWinner !== undefined && p.isWinner !== null
    );
    if (withOutcomes.length >= 10) {
      const winners = withOutcomes.filter((p) => p.isWinner === true);
      const losers = withOutcomes.filter((p) => p.isWinner === false);

      if (winners.length >= 3 && losers.length >= 3) {
        const avgWinnerSize =
          winners.reduce((sum, p) => sum + p.sizeUsd, 0) / winners.length;
        const avgLoserSize =
          losers.reduce((sum, p) => sum + p.sizeUsd, 0) / losers.length;
        const sizeRatio = avgWinnerSize / avgLoserSize;

        if (sizeRatio > 2) {
          anomalies.push({
            type: SizingAnomalyType.LARGE_ON_WINNERS,
            severity: Math.min(100, (sizeRatio - 1) * 30),
            description: `Winning positions are ${sizeRatio.toFixed(2)}x larger than losing positions`,
            relatedPositions: winners.slice(0, 10).map((p) => p.positionId),
            data: {
              avgWinnerSize,
              avgLoserSize,
              sizeRatio,
              winnerCount: winners.length,
              loserCount: losers.length,
            },
          });
        }

        // Check for size-outcome correlation
        const correlation = this.calculateSizeOutcomeCorrelation(withOutcomes);
        if (correlation > this.config.sizeCorrelationThreshold) {
          anomalies.push({
            type: SizingAnomalyType.SIZE_OUTCOME_CORRELATION,
            severity: Math.min(100, correlation * 100),
            description: `Position size strongly correlates with outcomes (r=${correlation.toFixed(3)})`,
            relatedPositions: [],
            data: {
              correlation,
              threshold: this.config.sizeCorrelationThreshold,
            },
          });
        }
      }
    }

    // Check for category-concentrated large positions
    for (const cat of categoryStats) {
      if (cat.positionCount >= 5 && cat.sizeRatio > 2.5 && cat.winRate > 60) {
        anomalies.push({
          type: SizingAnomalyType.CATEGORY_CONCENTRATED_LARGE,
          severity: Math.min(100, cat.sizeRatio * 20 + (cat.winRate - 50)),
          description: `Large positions concentrated in ${cat.category} with ${cat.winRate.toFixed(1)}% win rate`,
          relatedPositions: [],
          data: {
            category: cat.category,
            avgWinnerSize: cat.avgWinnerSize,
            avgLoserSize: cat.avgLoserSize,
            sizeRatio: cat.sizeRatio,
            winRate: cat.winRate,
          },
        });
      }
    }

    // Check for precision anomaly (too many decimal places or exact values)
    const precisionMap = new Map<number, number>();
    for (const pos of positions) {
      const decimals = (pos.sizeUsd.toString().split(".")[1] || "").length;
      precisionMap.set(decimals, (precisionMap.get(decimals) || 0) + 1);
    }
    const maxPrecision = Math.max(...precisionMap.values());
    if (maxPrecision / positions.length > 0.9 && positions.length >= 10) {
      anomalies.push({
        type: SizingAnomalyType.PRECISION_ANOMALY,
        severity: Math.min(100, (maxPrecision / positions.length - 0.5) * 100),
        description: `${(maxPrecision / positions.length * 100).toFixed(1)}% of positions have identical decimal precision`,
        relatedPositions: [],
        data: {
          precisionDistribution: Object.fromEntries(precisionMap),
          dominantPrecisionRatio: maxPrecision / positions.length,
        },
      });
    }

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  private calculateSizeOutcomeCorrelation(positions: SizingPosition[]): number {
    if (positions.length < 5) return 0;

    const sizes = positions.map((p) => p.sizeUsd);
    const outcomes: number[] = positions.map((p) => (p.isWinner === true ? 1 : 0));

    const n = positions.length;
    const sumX = sizes.reduce((a, b) => a + b, 0);
    const sumY = outcomes.reduce((a: number, b: number) => a + b, 0);
    const sumXY = sizes.reduce((sum, x, i) => sum + x * outcomes[i]!, 0);
    const sumX2 = sizes.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = outcomes.reduce((sum: number, y: number) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  private calculateTrend(positions: SizingPosition[]): SizingTrend {
    if (positions.length < 5) {
      return {
        direction: "stable",
        magnitudePerPosition: 0,
        recentAvg: 0,
        historicalAvg: 0,
        changePercent: 0,
        isSignificant: false,
      };
    }

    const sorted = [...positions].sort(
      (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
    );

    const splitIndex = Math.floor(sorted.length * 0.7);
    const historical = sorted.slice(0, splitIndex);
    const recent = sorted.slice(splitIndex);

    const historicalAvg =
      historical.reduce((sum, p) => sum + p.sizeUsd, 0) / historical.length;
    const recentAvg =
      recent.reduce((sum, p) => sum + p.sizeUsd, 0) / recent.length;

    const changePercent =
      historicalAvg > 0 ? ((recentAvg - historicalAvg) / historicalAvg) * 100 : 0;

    // Linear regression for magnitude
    const n = sorted.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += sorted[i]!.sizeUsd;
      sumXY += i * sorted[i]!.sizeUsd;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction: SizingTrend["direction"];
    if (changePercent > 20) {
      direction = "increasing";
    } else if (changePercent < -20) {
      direction = "decreasing";
    } else {
      direction = "stable";
    }

    // Check for cyclical pattern
    const avgSize = sumY / n;
    let crossings = 0;
    for (let i = 1; i < n; i++) {
      const prev = sorted[i - 1]!.sizeUsd;
      const curr = sorted[i]!.sizeUsd;
      if ((prev < avgSize && curr >= avgSize) || (prev >= avgSize && curr < avgSize)) {
        crossings++;
      }
    }
    if (crossings > n * 0.3) {
      direction = "cyclical";
    }

    return {
      direction,
      magnitudePerPosition: slope,
      recentAvg,
      historicalAvg,
      changePercent,
      isSignificant: Math.abs(changePercent) > 30,
    };
  }

  private calculateSuspicion(
    positions: SizingPosition[],
    distribution: SizeDistribution,
    patternMatches: SizingPatternMatch[],
    anomalies: SizingAnomaly[],
    categoryStats: CategorySizingStats[]
  ): {
    suspicionLevel: SizingSuspicionLevel;
    suspicionScore: number;
    isPotentiallySuspicious: boolean;
    riskFlags: string[];
  } {
    if (positions.length < this.config.minPositions) {
      return {
        suspicionLevel: SizingSuspicionLevel.NONE,
        suspicionScore: 0,
        isPotentiallySuspicious: false,
        riskFlags: [],
      };
    }

    const riskFlags: string[] = [];

    // Size-outcome correlation score
    const withOutcomes = positions.filter(
      (p) => p.isWinner !== undefined && p.isWinner !== null
    );
    let correlationScore = 0;
    if (withOutcomes.length >= 10) {
      const correlation = this.calculateSizeOutcomeCorrelation(withOutcomes);
      if (correlation > 0.5) {
        correlationScore = correlation * 100;
        riskFlags.push(`High size-outcome correlation: ${correlation.toFixed(3)}`);
      }
    }

    // Anomaly score
    const anomalyScore = Math.min(
      100,
      anomalies.reduce((sum, a) => sum + a.severity, 0) / 3
    );
    if (anomalyScore > 50) {
      riskFlags.push(`Multiple sizing anomalies detected`);
    }

    // Pattern suspicion score
    let patternScore = 0;
    const suspiciousPatterns: SizingPatternType[] = [
      SizingPatternType.BOT_LIKE,
      SizingPatternType.CONFIDENCE_BASED,
    ];
    for (const match of patternMatches) {
      if (suspiciousPatterns.includes(match.pattern)) {
        patternScore = Math.max(patternScore, match.score * 0.8);
        riskFlags.push(`Suspicious pattern: ${match.pattern}`);
      }
    }

    // Consistency anomaly score
    let consistencyScore = 0;
    if (
      distribution.coefficientOfVariation < 0.15 &&
      positions.length >= 10
    ) {
      consistencyScore = (0.15 - distribution.coefficientOfVariation) * 500;
      riskFlags.push(`Suspiciously consistent sizing`);
    }

    // Category concentration score
    let categoryScore = 0;
    for (const cat of categoryStats) {
      if (cat.sizeRatio > 2 && cat.winRate > 70 && cat.positionCount >= 5) {
        categoryScore = Math.max(
          categoryScore,
          (cat.sizeRatio - 1) * 20 + (cat.winRate - 50)
        );
        riskFlags.push(`High concentration in ${cat.category}`);
      }
    }

    // Weighted total
    const suspicionScore = Math.min(
      100,
      correlationScore * SUSPICION_WEIGHTS.sizeOutcomeCorrelation +
        anomalyScore * SUSPICION_WEIGHTS.anomalyScore +
        patternScore * SUSPICION_WEIGHTS.patternSuspicion +
        consistencyScore * SUSPICION_WEIGHTS.consistencyAnomaly +
        categoryScore * SUSPICION_WEIGHTS.categoryConcentration
    );

    // Determine level
    let suspicionLevel: SizingSuspicionLevel;
    if (suspicionScore >= 80) suspicionLevel = SizingSuspicionLevel.CRITICAL;
    else if (suspicionScore >= 60) suspicionLevel = SizingSuspicionLevel.HIGH;
    else if (suspicionScore >= 40) suspicionLevel = SizingSuspicionLevel.MEDIUM;
    else if (suspicionScore >= 20) suspicionLevel = SizingSuspicionLevel.LOW;
    else suspicionLevel = SizingSuspicionLevel.NONE;

    const isPotentiallySuspicious =
      suspicionScore >= 50 ||
      riskFlags.length >= 3 ||
      anomalies.some((a) => a.severity >= 70);

    return {
      suspicionLevel,
      suspicionScore: Math.round(suspicionScore),
      isPotentiallySuspicious,
      riskFlags,
    };
  }

  private generateInsights(
    positions: SizingPosition[],
    distribution: SizeDistribution,
    patternMatches: SizingPatternMatch[],
    anomalies: SizingAnomaly[],
    trend: SizingTrend
  ): string[] {
    const insights: string[] = [];

    if (positions.length < this.config.minPositions) {
      insights.push(`Only ${positions.length} positions - insufficient for detailed analysis`);
      return insights;
    }

    // Distribution insights
    insights.push(
      `Average position size: $${distribution.mean.toFixed(2)} (median: $${distribution.median.toFixed(2)})`
    );

    if (distribution.coefficientOfVariation < 0.3) {
      insights.push(`Highly consistent position sizing (CV: ${distribution.coefficientOfVariation.toFixed(3)})`);
    } else if (distribution.coefficientOfVariation > 1.0) {
      insights.push(`Highly variable position sizing (CV: ${distribution.coefficientOfVariation.toFixed(3)})`);
    }

    if (distribution.skewness > 1) {
      insights.push(`Right-skewed distribution - occasional large positions`);
    } else if (distribution.skewness < -1) {
      insights.push(`Left-skewed distribution - occasional small positions`);
    }

    // Pattern insights
    const primaryPattern = patternMatches.find((m) => m.isPrimary);
    if (primaryPattern && primaryPattern.pattern !== SizingPatternType.UNKNOWN) {
      insights.push(`Primary sizing pattern: ${this.getPatternDescription(primaryPattern.pattern)}`);
    }

    // Trend insights
    if (trend.isSignificant) {
      insights.push(
        `Position sizes ${trend.direction === "increasing" ? "increasing" : "decreasing"} by ${Math.abs(trend.changePercent).toFixed(1)}%`
      );
    }

    // Anomaly insights
    for (const anomaly of anomalies.slice(0, 3)) {
      insights.push(`⚠️ ${anomaly.description}`);
    }

    // Win rate correlation
    const withOutcomes = positions.filter(
      (p) => p.isWinner !== undefined && p.isWinner !== null
    );
    if (withOutcomes.length >= 10) {
      const winners = withOutcomes.filter((p) => p.isWinner === true);
      const losers = withOutcomes.filter((p) => p.isWinner === false);
      if (winners.length > 0 && losers.length > 0) {
        const avgWinner = winners.reduce((s, p) => s + p.sizeUsd, 0) / winners.length;
        const avgLoser = losers.reduce((s, p) => s + p.sizeUsd, 0) / losers.length;
        const ratio = avgWinner / avgLoser;
        if (ratio > 1.5) {
          insights.push(
            `Winning positions are ${ratio.toFixed(2)}x larger than losing positions`
          );
        } else if (ratio < 0.7) {
          insights.push(
            `Losing positions are ${(1 / ratio).toFixed(2)}x larger than winning positions`
          );
        }
      }
    }

    return insights;
  }

  private getPatternDescription(pattern: SizingPatternType): string {
    const descriptions: Record<SizingPatternType, string> = {
      [SizingPatternType.UNKNOWN]: "Unknown pattern",
      [SizingPatternType.CONSISTENT]: "Consistent sizing",
      [SizingPatternType.VARIABLE]: "Variable sizing",
      [SizingPatternType.SCALING_UP]: "Increasing position sizes",
      [SizingPatternType.SCALING_DOWN]: "Decreasing position sizes",
      [SizingPatternType.ROUND_NUMBERS]: "Round number preference",
      [SizingPatternType.KELLY_LIKE]: "Kelly criterion-like sizing",
      [SizingPatternType.FIXED_FRACTION]: "Fixed fraction of portfolio",
      [SizingPatternType.MARTINGALE]: "Martingale (doubling after losses)",
      [SizingPatternType.ANTI_MARTINGALE]: "Anti-martingale (increasing after wins)",
      [SizingPatternType.PYRAMIDING]: "Pyramiding (adding to winners)",
      [SizingPatternType.SPLIT_SIZING]: "Split position sizing",
      [SizingPatternType.CONFIDENCE_BASED]: "Confidence-based sizing",
      [SizingPatternType.BOT_LIKE]: "Bot-like precision",
    };
    return descriptions[pattern] || pattern;
  }

  private calculateDataQuality(positionCount: number): number {
    if (positionCount >= 100) return 100;
    if (positionCount >= 50) return 80;
    if (positionCount >= 20) return 60;
    if (positionCount >= 10) return 40;
    if (positionCount >= 5) return 20;
    return 0;
  }
}

// ============================================================================
// Factory and Convenience Functions
// ============================================================================

/**
 * Create a new PositionSizingAnalyzer instance
 */
export function createPositionSizingAnalyzer(
  config?: Partial<PositionSizingAnalyzerConfig>
): PositionSizingAnalyzer {
  return new PositionSizingAnalyzer(config);
}

// Shared instance
let sharedAnalyzer: PositionSizingAnalyzer | null = null;

/**
 * Get the shared PositionSizingAnalyzer instance
 */
export function getSharedPositionSizingAnalyzer(): PositionSizingAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new PositionSizingAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared PositionSizingAnalyzer instance
 */
export function setSharedPositionSizingAnalyzer(
  analyzer: PositionSizingAnalyzer
): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared PositionSizingAnalyzer instance
 */
export function resetSharedPositionSizingAnalyzer(): void {
  sharedAnalyzer = null;
}

/**
 * Add a position to the shared analyzer
 */
export function addPositionForSizing(
  walletAddress: string,
  position: SizingPosition
): void {
  getSharedPositionSizingAnalyzer().addPosition(walletAddress, position);
}

/**
 * Add multiple positions to the shared analyzer
 */
export function addPositionsForSizing(
  walletAddress: string,
  positions: SizingPosition[]
): void {
  getSharedPositionSizingAnalyzer().addPositions(walletAddress, positions);
}

/**
 * Analyze position sizing using the shared analyzer
 */
export function analyzePositionSizing(
  walletAddress: string,
  options?: AnalyzeSizingOptions
): SizingAnalysisResult {
  return getSharedPositionSizingAnalyzer().analyze(walletAddress, options);
}

/**
 * Batch analyze position sizing using the shared analyzer
 */
export function batchAnalyzePositionSizing(
  walletAddresses: string[],
  options?: AnalyzeSizingOptions
): BatchSizingAnalysisResult {
  return getSharedPositionSizingAnalyzer().batchAnalyze(walletAddresses, options);
}

/**
 * Check if wallet has suspicious sizing patterns
 */
export function hasSuspiciousSizingPattern(walletAddress: string): boolean {
  return getSharedPositionSizingAnalyzer().hasSuspiciousSizing(walletAddress);
}

/**
 * Get wallets with suspicious sizing patterns
 */
export function getWalletsWithSuspiciousSizing(
  minScore?: number
): SizingAnalysisResult[] {
  return getSharedPositionSizingAnalyzer().getSuspiciousWallets(minScore);
}

/**
 * Get high-conviction traders
 */
export function getHighConvictionTradersFromSizing(): SizingAnalysisResult[] {
  return getSharedPositionSizingAnalyzer().getHighConvictionTraders();
}

/**
 * Get sizing analyzer summary
 */
export function getPositionSizingAnalyzerSummary(): SizingAnalyzerSummary {
  return getSharedPositionSizingAnalyzer().getSummary();
}

/**
 * Get sizing category description
 */
export function getSizingCategoryDescription(category: SizingCategory): string {
  const descriptions: Record<SizingCategory, string> = {
    [SizingCategory.MICRO]: "Micro trader (very small positions)",
    [SizingCategory.SMALL]: "Small trader",
    [SizingCategory.MEDIUM]: "Medium trader",
    [SizingCategory.LARGE]: "Large trader",
    [SizingCategory.WHALE]: "Whale (very large positions)",
    [SizingCategory.EXTREME]: "Extreme whale (massive positions)",
  };
  return descriptions[category];
}

/**
 * Get sizing pattern description
 */
export function getSizingPatternDescription(pattern: SizingPatternType): string {
  const descriptions: Record<SizingPatternType, string> = {
    [SizingPatternType.UNKNOWN]: "Unknown pattern - insufficient data",
    [SizingPatternType.CONSISTENT]: "Consistent sizing - similar position sizes",
    [SizingPatternType.VARIABLE]: "Variable sizing - diverse position sizes",
    [SizingPatternType.SCALING_UP]: "Scaling up - position sizes increasing over time",
    [SizingPatternType.SCALING_DOWN]: "Scaling down - position sizes decreasing over time",
    [SizingPatternType.ROUND_NUMBERS]: "Round numbers - prefers round position sizes",
    [SizingPatternType.KELLY_LIKE]: "Kelly-like - optimal sizing strategy",
    [SizingPatternType.FIXED_FRACTION]: "Fixed fraction - consistent percentage of portfolio",
    [SizingPatternType.MARTINGALE]: "Martingale - doubles after losses (risky)",
    [SizingPatternType.ANTI_MARTINGALE]: "Anti-martingale - increases after wins",
    [SizingPatternType.PYRAMIDING]: "Pyramiding - adds to winning positions",
    [SizingPatternType.SPLIT_SIZING]: "Split sizing - multiple entries in same market",
    [SizingPatternType.CONFIDENCE_BASED]: "Confidence-based - larger on winners",
    [SizingPatternType.BOT_LIKE]: "Bot-like - very precise, repetitive sizing",
  };
  return descriptions[pattern];
}

/**
 * Get sizing suspicion level description
 */
export function getSizingSuspicionDescription(
  level: SizingSuspicionLevel
): string {
  const descriptions: Record<SizingSuspicionLevel, string> = {
    [SizingSuspicionLevel.NONE]: "No suspicious sizing patterns detected",
    [SizingSuspicionLevel.LOW]: "Slightly unusual sizing patterns",
    [SizingSuspicionLevel.MEDIUM]: "Notable sizing patterns worth monitoring",
    [SizingSuspicionLevel.HIGH]: "Suspicious sizing patterns detected",
    [SizingSuspicionLevel.CRITICAL]: "Highly suspicious - likely informed trading",
  };
  return descriptions[level];
}
