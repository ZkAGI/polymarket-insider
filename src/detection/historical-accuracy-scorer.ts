/**
 * Historical Accuracy Scorer (DET-PAT-010)
 *
 * Score wallets based on historical prediction accuracy to identify consistently
 * accurate traders who may have informational advantages.
 *
 * Features:
 * - Track prediction outcomes for each wallet
 * - Calculate accuracy rate with conviction weighting
 * - Rank wallets by accuracy scores
 * - Detect unusually high accuracy patterns
 * - Support time-window analysis and category breakdowns
 * - Event emission for accuracy anomalies
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Prediction outcome status
 */
export enum PredictionOutcome {
  /** Prediction was correct */
  CORRECT = "CORRECT",
  /** Prediction was incorrect */
  INCORRECT = "INCORRECT",
  /** Market was invalidated/cancelled */
  CANCELLED = "CANCELLED",
  /** Prediction is still pending (market not resolved) */
  PENDING = "PENDING",
}

/**
 * Conviction level of the prediction (based on position size relative to wallet)
 */
export enum ConvictionLevel {
  /** Very low conviction (< 5% of typical position) */
  VERY_LOW = "VERY_LOW",
  /** Low conviction (5-15% of typical position) */
  LOW = "LOW",
  /** Medium conviction (15-40% of typical position) */
  MEDIUM = "MEDIUM",
  /** High conviction (40-75% of typical position) */
  HIGH = "HIGH",
  /** Very high conviction (> 75% of typical position) */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Accuracy tier based on overall prediction accuracy
 */
export enum AccuracyTier {
  /** Unknown - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Very poor accuracy (< 40%) */
  VERY_POOR = "VERY_POOR",
  /** Poor accuracy (40-50%) */
  POOR = "POOR",
  /** Average accuracy (50-55%) - expected for random */
  AVERAGE = "AVERAGE",
  /** Above average (55-60%) */
  ABOVE_AVERAGE = "ABOVE_AVERAGE",
  /** Good accuracy (60-70%) */
  GOOD = "GOOD",
  /** Very good accuracy (70-80%) */
  VERY_GOOD = "VERY_GOOD",
  /** Excellent accuracy (80-90%) */
  EXCELLENT = "EXCELLENT",
  /** Exceptional accuracy (> 90%) - potential insider */
  EXCEPTIONAL = "EXCEPTIONAL",
}

/**
 * Suspicion level based on accuracy analysis
 */
export enum AccuracySuspicionLevel {
  /** Normal accuracy patterns */
  NONE = "NONE",
  /** Slightly above average */
  LOW = "LOW",
  /** Notable accuracy worth monitoring */
  MEDIUM = "MEDIUM",
  /** Suspicious accuracy patterns */
  HIGH = "HIGH",
  /** Very suspicious - likely informational advantage */
  CRITICAL = "CRITICAL",
}

/**
 * Time window for accuracy analysis
 */
export enum AccuracyWindow {
  /** All time */
  ALL_TIME = "ALL_TIME",
  /** Last 24 hours */
  DAY = "DAY",
  /** Last 7 days */
  WEEK = "WEEK",
  /** Last 30 days */
  MONTH = "MONTH",
  /** Last 90 days */
  QUARTER = "QUARTER",
  /** Last 365 days */
  YEAR = "YEAR",
}

/**
 * Window durations in milliseconds
 */
export const ACCURACY_WINDOW_DURATION_MS: Record<AccuracyWindow, number> = {
  [AccuracyWindow.ALL_TIME]: Infinity,
  [AccuracyWindow.DAY]: 24 * 60 * 60 * 1000,
  [AccuracyWindow.WEEK]: 7 * 24 * 60 * 60 * 1000,
  [AccuracyWindow.MONTH]: 30 * 24 * 60 * 60 * 1000,
  [AccuracyWindow.QUARTER]: 90 * 24 * 60 * 60 * 1000,
  [AccuracyWindow.YEAR]: 365 * 24 * 60 * 60 * 1000,
};

/**
 * A tracked prediction for accuracy scoring
 */
export interface TrackedPrediction {
  /** Unique prediction ID */
  predictionId: string;

  /** Market ID */
  marketId: string;

  /** Market title (optional) */
  marketTitle?: string;

  /** Market category (if known) */
  marketCategory?: MarketCategory | string;

  /** Wallet address */
  walletAddress: string;

  /** The predicted outcome (what the wallet bet on) */
  predictedOutcome: string;

  /** The actual outcome after resolution */
  actualOutcome?: string;

  /** Prediction outcome status */
  outcome: PredictionOutcome;

  /** Position size in USD */
  positionSize: number;

  /** Conviction level */
  conviction: ConvictionLevel;

  /** Entry price/probability when prediction was made (0-1) */
  entryProbability: number;

  /** Resolution price (0 or 1 for binary) */
  resolutionProbability?: number;

  /** Timestamp when prediction was made */
  predictionTimestamp: Date;

  /** Timestamp when market resolved */
  resolutionTimestamp?: Date;

  /** Time until resolution when prediction was made (hours) */
  hoursUntilResolution?: number;

  /** Realized P&L from this prediction */
  realizedPnl?: number;

  /** Return on investment */
  roi?: number;
}

/**
 * Accuracy statistics for a time window
 */
export interface WindowAccuracyStats {
  /** Time window */
  window: AccuracyWindow;

  /** Total resolved predictions */
  totalPredictions: number;

  /** Correct predictions */
  correctPredictions: number;

  /** Incorrect predictions */
  incorrectPredictions: number;

  /** Cancelled/invalidated predictions */
  cancelledPredictions: number;

  /** Raw accuracy rate (correct / total) */
  rawAccuracy: number;

  /** Conviction-weighted accuracy */
  weightedAccuracy: number;

  /** High conviction accuracy (for high/very high conviction only) */
  highConvictionAccuracy: number;

  /** High conviction prediction count */
  highConvictionCount: number;

  /** Average conviction level (0-1 scale) */
  avgConviction: number;

  /** Average entry probability (how contrarian were predictions) */
  avgEntryProbability: number;

  /** Total realized P&L from predictions */
  totalPnl: number;

  /** Average ROI */
  avgRoi: number;

  /** Brier score (lower is better, 0 is perfect) */
  brierScore: number;

  /** Window start timestamp */
  windowStart: Date;

  /** Window end timestamp */
  windowEnd: Date;
}

/**
 * Category-specific accuracy stats
 */
export interface CategoryAccuracyStats {
  /** Market category */
  category: MarketCategory | string;

  /** Total predictions in this category */
  totalPredictions: number;

  /** Correct predictions */
  correctPredictions: number;

  /** Raw accuracy */
  rawAccuracy: number;

  /** Weighted accuracy */
  weightedAccuracy: number;

  /** Total P&L in this category */
  totalPnl: number;

  /** Average ROI */
  avgRoi: number;
}

/**
 * Accuracy data point for historical tracking
 */
export interface AccuracyDataPoint {
  /** Date of data point */
  date: Date;

  /** Cumulative raw accuracy at this point */
  cumulativeAccuracy: number;

  /** Cumulative weighted accuracy */
  cumulativeWeightedAccuracy: number;

  /** Total predictions to date */
  totalPredictions: number;

  /** Correct predictions to date */
  correctPredictions: number;
}

/**
 * Accuracy trend information
 */
export interface AccuracyTrend {
  /** Direction of trend */
  direction: "improving" | "declining" | "stable";

  /** Magnitude of change (percentage points) */
  magnitude: number;

  /** Statistical significance (0-1) */
  significance: number;

  /** Recent accuracy (last 30% of predictions) */
  recentAccuracy: number;

  /** Historical accuracy (first 70% of predictions) */
  historicalAccuracy: number;
}

/**
 * Accuracy anomaly detection
 */
export interface AccuracyAnomaly {
  /** Type of anomaly */
  type:
    | "exceptional_accuracy"
    | "sudden_improvement"
    | "perfect_high_conviction"
    | "category_expertise"
    | "timing_advantage"
    | "contrarian_success";

  /** Severity (0-100) */
  severity: number;

  /** Description of the anomaly */
  description: string;

  /** Supporting data */
  data: Record<string, unknown>;
}

/**
 * Complete accuracy analysis result
 */
export interface AccuracyResult {
  /** Wallet address (checksummed) */
  walletAddress: string;

  /** Accuracy tier */
  tier: AccuracyTier;

  /** Suspicion level based on analysis */
  suspicionLevel: AccuracySuspicionLevel;

  /** Suspicion score (0-100) */
  suspicionScore: number;

  /** Statistics for each time window */
  windowStats: Record<AccuracyWindow, WindowAccuracyStats>;

  /** Category-specific accuracy */
  categoryStats: CategoryAccuracyStats[];

  /** Top performing categories */
  topCategories: string[];

  /** Accuracy trend */
  trend: AccuracyTrend;

  /** Historical accuracy data points */
  history: AccuracyDataPoint[];

  /** Detected anomalies */
  anomalies: AccuracyAnomaly[];

  /** Total predictions analyzed */
  totalPredictions: number;

  /** Overall accuracy rank (1 = best) */
  accuracyRank?: number;

  /** Percentile rank (0-100, 100 = top) */
  percentileRank?: number;

  /** Data quality score (0-100) based on sample size */
  dataQuality: number;

  /** Whether flagged as potential insider */
  isPotentialInsider: boolean;

  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Options for accuracy analysis
 */
export interface AnalyzeAccuracyOptions {
  /** Include historical data points */
  includeHistory?: boolean;

  /** Include category breakdown */
  includeCategoryBreakdown?: boolean;

  /** Include trend analysis */
  includeTrendAnalysis?: boolean;

  /** Minimum predictions for valid analysis */
  minPredictions?: number;

  /** Calculate rank among all wallets */
  calculateRank?: boolean;
}

/**
 * Batch analysis result
 */
export interface BatchAccuracyResult {
  /** Individual results by wallet address */
  results: Map<string, AccuracyResult>;

  /** Wallets that couldn't be analyzed */
  failed: Map<string, Error>;

  /** Total wallets processed */
  totalProcessed: number;

  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Wallet ranking entry
 */
export interface WalletAccuracyRanking {
  /** Wallet address */
  walletAddress: string;

  /** Raw accuracy */
  rawAccuracy: number;

  /** Weighted accuracy */
  weightedAccuracy: number;

  /** Total predictions */
  totalPredictions: number;

  /** Total P&L */
  totalPnl: number;

  /** Rank (1 = best) */
  rank: number;

  /** Percentile (0-100) */
  percentile: number;
}

/**
 * Historical accuracy scorer summary
 */
export interface AccuracyScorerSummary {
  /** Total wallets tracked */
  totalWallets: number;

  /** Total predictions tracked */
  totalPredictions: number;

  /** Resolved predictions */
  resolvedPredictions: number;

  /** Pending predictions */
  pendingPredictions: number;

  /** Wallets with exceptional accuracy */
  exceptionalAccuracyCount: number;

  /** Wallets flagged as potential insiders */
  potentialInsiderCount: number;

  /** Average accuracy across all wallets */
  averageAccuracy: number;

  /** Accuracy tier distribution */
  tierDistribution: Record<AccuracyTier, number>;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Last updated */
  lastUpdated: Date;
}

/**
 * Historical accuracy scorer configuration
 */
export interface HistoricalAccuracyScorerConfig {
  /** Minimum predictions for valid analysis */
  minPredictionsForAnalysis: number;

  /** Minimum predictions for high confidence */
  minPredictionsForHighConfidence: number;

  /** Accuracy threshold for exceptional tier */
  exceptionalAccuracyThreshold: number;

  /** Accuracy threshold for potential insider flag */
  potentialInsiderAccuracyThreshold: number;

  /** Minimum high conviction predictions for insider flag */
  minHighConvictionForInsider: number;

  /** High conviction accuracy threshold */
  highConvictionAccuracyThreshold: number;

  /** Cache TTL in milliseconds */
  cacheTtl: number;

  /** Maximum predictions per wallet */
  maxPredictionsPerWallet: number;

  /** Enable event emission */
  enableEvents: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_ACCURACY_CONFIG: HistoricalAccuracyScorerConfig = {
  minPredictionsForAnalysis: 10,
  minPredictionsForHighConfidence: 30,
  exceptionalAccuracyThreshold: 80,
  potentialInsiderAccuracyThreshold: 75,
  minHighConvictionForInsider: 5,
  highConvictionAccuracyThreshold: 85,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxPredictionsPerWallet: 10000,
  enableEvents: true,
};

/**
 * Accuracy tier thresholds (percentage)
 */
export const ACCURACY_TIER_THRESHOLDS: Record<AccuracyTier, number> = {
  [AccuracyTier.UNKNOWN]: 0,
  [AccuracyTier.VERY_POOR]: 40,
  [AccuracyTier.POOR]: 50,
  [AccuracyTier.AVERAGE]: 55,
  [AccuracyTier.ABOVE_AVERAGE]: 60,
  [AccuracyTier.GOOD]: 70,
  [AccuracyTier.VERY_GOOD]: 80,
  [AccuracyTier.EXCELLENT]: 90,
  [AccuracyTier.EXCEPTIONAL]: 100,
};

/**
 * Conviction level weights for weighted accuracy
 */
export const CONVICTION_WEIGHTS: Record<ConvictionLevel, number> = {
  [ConvictionLevel.VERY_LOW]: 0.2,
  [ConvictionLevel.LOW]: 0.5,
  [ConvictionLevel.MEDIUM]: 1.0,
  [ConvictionLevel.HIGH]: 1.5,
  [ConvictionLevel.VERY_HIGH]: 2.0,
};

/**
 * Suspicion score weights
 */
const SUSPICION_WEIGHTS = {
  accuracy: 0.3,
  highConvictionAccuracy: 0.25,
  categoryExpertise: 0.15,
  trend: 0.1,
  contrarianSuccess: 0.1,
  anomalyCount: 0.1,
};

// ============================================================================
// Historical Accuracy Scorer Class
// ============================================================================

/**
 * Historical Accuracy Scorer
 *
 * Tracks and scores wallet prediction accuracy over time.
 */
export class HistoricalAccuracyScorer extends EventEmitter {
  private config: HistoricalAccuracyScorerConfig;
  private predictions: Map<string, TrackedPrediction[]>; // walletAddress -> predictions
  private cache: Map<string, { result: AccuracyResult; timestamp: number }>;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<HistoricalAccuracyScorerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ACCURACY_CONFIG, ...config };
    this.predictions = new Map();
    this.cache = new Map();
  }

  /**
   * Add a prediction for tracking
   */
  addPrediction(prediction: TrackedPrediction): void {
    const address = this.normalizeAddress(prediction.walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${prediction.walletAddress}`);
    }

    const normalizedPrediction = {
      ...prediction,
      walletAddress: address,
    };

    let walletPredictions = this.predictions.get(address);
    if (!walletPredictions) {
      walletPredictions = [];
      this.predictions.set(address, walletPredictions);
    }

    // Check if prediction already exists (update if so)
    const existingIndex = walletPredictions.findIndex(
      (p) => p.predictionId === prediction.predictionId
    );
    if (existingIndex >= 0) {
      walletPredictions[existingIndex] = normalizedPrediction;
    } else {
      walletPredictions.push(normalizedPrediction);
    }

    // Trim if over limit
    if (walletPredictions.length > this.config.maxPredictionsPerWallet) {
      walletPredictions.sort(
        (a, b) =>
          a.predictionTimestamp.getTime() - b.predictionTimestamp.getTime()
      );
      walletPredictions.splice(
        0,
        walletPredictions.length - this.config.maxPredictionsPerWallet
      );
    }

    // Invalidate cache
    this.cache.delete(address);

    if (this.config.enableEvents) {
      this.emit("prediction-added", {
        address,
        prediction: normalizedPrediction,
      });
    }
  }

  /**
   * Add multiple predictions at once
   */
  addPredictions(predictions: TrackedPrediction[]): void {
    for (const prediction of predictions) {
      this.addPrediction(prediction);
    }
  }

  /**
   * Update prediction outcome after market resolution
   */
  updatePredictionOutcome(
    walletAddress: string,
    predictionId: string,
    actualOutcome: string,
    resolutionTimestamp: Date = new Date(),
    realizedPnl?: number,
    roi?: number
  ): void {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return;

    const walletPredictions = this.predictions.get(address);
    if (!walletPredictions) return;

    const prediction = walletPredictions.find(
      (p) => p.predictionId === predictionId
    );
    if (prediction && prediction.outcome === PredictionOutcome.PENDING) {
      prediction.actualOutcome = actualOutcome;
      prediction.resolutionTimestamp = resolutionTimestamp;
      prediction.realizedPnl = realizedPnl;
      prediction.roi = roi;

      // Determine outcome
      if (actualOutcome === "CANCELLED") {
        prediction.outcome = PredictionOutcome.CANCELLED;
      } else if (prediction.predictedOutcome === actualOutcome) {
        prediction.outcome = PredictionOutcome.CORRECT;
      } else {
        prediction.outcome = PredictionOutcome.INCORRECT;
      }

      // Set resolution probability
      prediction.resolutionProbability =
        prediction.outcome === PredictionOutcome.CORRECT ? 1 : 0;

      // Invalidate cache
      this.cache.delete(address);

      if (this.config.enableEvents) {
        this.emit("prediction-resolved", { address, prediction });
      }
    }
  }

  /**
   * Get predictions for a wallet
   */
  getPredictions(walletAddress: string): TrackedPrediction[] {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return [];
    return this.predictions.get(address) || [];
  }

  /**
   * Get resolved predictions for a wallet
   */
  getResolvedPredictions(walletAddress: string): TrackedPrediction[] {
    return this.getPredictions(walletAddress).filter(
      (p) =>
        p.outcome !== PredictionOutcome.PENDING &&
        p.outcome !== PredictionOutcome.CANCELLED
    );
  }

  /**
   * Clear predictions for a wallet
   */
  clearPredictions(walletAddress: string): void {
    const address = this.normalizeAddress(walletAddress);
    if (address) {
      this.predictions.delete(address);
      this.cache.delete(address);
    }
  }

  /**
   * Analyze accuracy for a wallet
   */
  analyze(
    walletAddress: string,
    options: AnalyzeAccuracyOptions = {}
  ): AccuracyResult {
    const address = this.normalizeAddress(walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    // Check cache
    const cached = this.cache.get(address);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
      this.cacheHits++;
      return cached.result;
    }
    this.cacheMisses++;

    const predictions = this.predictions.get(address) || [];
    const resolvedPredictions = predictions.filter(
      (p) =>
        p.outcome !== PredictionOutcome.PENDING &&
        p.outcome !== PredictionOutcome.CANCELLED
    );

    const result = this.computeAccuracy(
      address,
      predictions,
      resolvedPredictions,
      options
    );

    // Cache result
    this.cache.set(address, { result, timestamp: Date.now() });

    if (this.config.enableEvents) {
      this.emit("analysis-complete", { address, result });

      if (result.isPotentialInsider) {
        this.emit("potential-insider", { address, result });
      }
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    walletAddresses: string[],
    options: AnalyzeAccuracyOptions = {}
  ): BatchAccuracyResult {
    const results = new Map<string, AccuracyResult>();
    const failed = new Map<string, Error>();

    for (const address of walletAddresses) {
      try {
        const result = this.analyze(address, options);
        results.set(result.walletAddress, result);
      } catch (error) {
        failed.set(address, error as Error);
      }
    }

    // Calculate ranks if requested
    if (options.calculateRank !== false && results.size > 0) {
      this.calculateRanks(results);
    }

    return {
      results,
      failed,
      totalProcessed: walletAddresses.length,
      processedAt: new Date(),
    };
  }

  /**
   * Check if wallet has exceptional accuracy
   */
  hasExceptionalAccuracy(walletAddress: string): boolean {
    try {
      const result = this.analyze(walletAddress);
      return (
        result.tier === AccuracyTier.EXCEPTIONAL ||
        result.tier === AccuracyTier.EXCELLENT
      );
    } catch {
      return false;
    }
  }

  /**
   * Get wallets with high accuracy
   */
  getHighAccuracyWallets(minAccuracy: number = 70): AccuracyResult[] {
    const results: AccuracyResult[] = [];
    for (const address of this.predictions.keys()) {
      try {
        const result = this.analyze(address);
        const allTimeStats = result.windowStats[AccuracyWindow.ALL_TIME];
        if (allTimeStats && allTimeStats.rawAccuracy >= minAccuracy) {
          results.push(result);
        }
      } catch {
        // Skip invalid wallets
      }
    }
    return results.sort(
      (a, b) =>
        b.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy -
        a.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy
    );
  }

  /**
   * Get potential insider wallets
   */
  getPotentialInsiders(): AccuracyResult[] {
    const results: AccuracyResult[] = [];
    for (const address of this.predictions.keys()) {
      try {
        const result = this.analyze(address);
        if (result.isPotentialInsider) {
          results.push(result);
        }
      } catch {
        // Skip invalid wallets
      }
    }
    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get accuracy rankings for all tracked wallets
   */
  getAccuracyRankings(
    minPredictions: number = 10
  ): WalletAccuracyRanking[] {
    const rankings: WalletAccuracyRanking[] = [];

    for (const address of this.predictions.keys()) {
      try {
        const result = this.analyze(address);
        const allTimeStats = result.windowStats[AccuracyWindow.ALL_TIME];
        if (allTimeStats.totalPredictions >= minPredictions) {
          rankings.push({
            walletAddress: result.walletAddress,
            rawAccuracy: allTimeStats.rawAccuracy,
            weightedAccuracy: allTimeStats.weightedAccuracy,
            totalPredictions: allTimeStats.totalPredictions,
            totalPnl: allTimeStats.totalPnl,
            rank: 0,
            percentile: 0,
          });
        }
      } catch {
        // Skip invalid wallets
      }
    }

    // Sort by weighted accuracy
    rankings.sort((a, b) => b.weightedAccuracy - a.weightedAccuracy);

    // Assign ranks and percentiles
    for (let i = 0; i < rankings.length; i++) {
      const ranking = rankings[i];
      if (ranking) {
        ranking.rank = i + 1;
        ranking.percentile =
          rankings.length > 1
            ? ((rankings.length - 1 - i) / (rankings.length - 1)) * 100
            : 100;
      }
    }

    return rankings;
  }

  /**
   * Get summary statistics
   */
  getSummary(): AccuracyScorerSummary {
    const tierDistribution: Record<AccuracyTier, number> = {
      [AccuracyTier.UNKNOWN]: 0,
      [AccuracyTier.VERY_POOR]: 0,
      [AccuracyTier.POOR]: 0,
      [AccuracyTier.AVERAGE]: 0,
      [AccuracyTier.ABOVE_AVERAGE]: 0,
      [AccuracyTier.GOOD]: 0,
      [AccuracyTier.VERY_GOOD]: 0,
      [AccuracyTier.EXCELLENT]: 0,
      [AccuracyTier.EXCEPTIONAL]: 0,
    };

    let totalPredictions = 0;
    let resolvedPredictions = 0;
    let pendingPredictions = 0;
    let totalAccuracy = 0;
    let validWallets = 0;
    let exceptionalCount = 0;
    let potentialInsiderCount = 0;

    for (const address of this.predictions.keys()) {
      const walletPredictions = this.predictions.get(address) || [];
      totalPredictions += walletPredictions.length;

      for (const p of walletPredictions) {
        if (p.outcome === PredictionOutcome.PENDING) {
          pendingPredictions++;
        } else if (p.outcome !== PredictionOutcome.CANCELLED) {
          resolvedPredictions++;
        }
      }

      try {
        const result = this.analyze(address);
        tierDistribution[result.tier]++;

        if (result.totalPredictions >= this.config.minPredictionsForAnalysis) {
          totalAccuracy +=
            result.windowStats[AccuracyWindow.ALL_TIME]?.rawAccuracy || 0;
          validWallets++;
        }

        if (
          result.tier === AccuracyTier.EXCEPTIONAL ||
          result.tier === AccuracyTier.EXCELLENT
        ) {
          exceptionalCount++;
        }

        if (result.isPotentialInsider) {
          potentialInsiderCount++;
        }
      } catch {
        tierDistribution[AccuracyTier.UNKNOWN]++;
      }
    }

    return {
      totalWallets: this.predictions.size,
      totalPredictions,
      resolvedPredictions,
      pendingPredictions,
      exceptionalAccuracyCount: exceptionalCount,
      potentialInsiderCount,
      averageAccuracy: validWallets > 0 ? totalAccuracy / validWallets : 0,
      tierDistribution,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.predictions.clear();
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
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

  private computeAccuracy(
    walletAddress: string,
    allPredictions: TrackedPrediction[],
    resolvedPredictions: TrackedPrediction[],
    options: AnalyzeAccuracyOptions
  ): AccuracyResult {
    const {
      includeHistory = true,
      includeCategoryBreakdown = true,
      includeTrendAnalysis = true,
      minPredictions = this.config.minPredictionsForAnalysis,
    } = options;

    // Calculate window stats for each time window
    const windowStats = this.calculateWindowStats(resolvedPredictions);

    // Calculate category breakdown
    const categoryStats = includeCategoryBreakdown
      ? this.calculateCategoryStats(resolvedPredictions)
      : [];

    // Get top categories
    const topCategories = categoryStats
      .filter((c) => c.totalPredictions >= 3)
      .sort((a, b) => b.weightedAccuracy - a.weightedAccuracy)
      .slice(0, 5)
      .map((c) => c.category as string);

    // Calculate trend
    const trend = includeTrendAnalysis
      ? this.calculateTrend(resolvedPredictions)
      : {
          direction: "stable" as const,
          magnitude: 0,
          significance: 0,
          recentAccuracy: 0,
          historicalAccuracy: 0,
        };

    // Calculate history
    const history = includeHistory
      ? this.calculateHistory(resolvedPredictions)
      : [];

    // Detect anomalies
    const anomalies = this.detectAnomalies(
      resolvedPredictions,
      windowStats,
      categoryStats,
      trend
    );

    // Determine tier
    const allTimeStats = windowStats[AccuracyWindow.ALL_TIME];
    const tier = this.determineTier(
      allTimeStats.rawAccuracy,
      resolvedPredictions.length,
      minPredictions
    );

    // Calculate suspicion
    const { suspicionLevel, suspicionScore, isPotentialInsider } =
      this.calculateSuspicion(
        resolvedPredictions,
        allTimeStats,
        categoryStats,
        trend,
        anomalies
      );

    // Calculate data quality
    const dataQuality = this.calculateDataQuality(resolvedPredictions.length);

    return {
      walletAddress,
      tier,
      suspicionLevel,
      suspicionScore,
      windowStats,
      categoryStats,
      topCategories,
      trend,
      history,
      anomalies,
      totalPredictions: allPredictions.length,
      dataQuality,
      isPotentialInsider,
      analyzedAt: new Date(),
    };
  }

  private calculateWindowStats(
    predictions: TrackedPrediction[]
  ): Record<AccuracyWindow, WindowAccuracyStats> {
    const now = new Date();
    const result: Record<AccuracyWindow, WindowAccuracyStats> = {} as Record<
      AccuracyWindow,
      WindowAccuracyStats
    >;

    for (const window of Object.values(AccuracyWindow)) {
      const duration = ACCURACY_WINDOW_DURATION_MS[window];
      const windowStart = new Date(
        duration === Infinity ? 0 : now.getTime() - duration
      );

      const windowPredictions = predictions.filter(
        (p) =>
          p.resolutionTimestamp && p.resolutionTimestamp >= windowStart
      );

      const correct = windowPredictions.filter(
        (p) => p.outcome === PredictionOutcome.CORRECT
      );
      const incorrect = windowPredictions.filter(
        (p) => p.outcome === PredictionOutcome.INCORRECT
      );
      const cancelled = windowPredictions.filter(
        (p) => p.outcome === PredictionOutcome.CANCELLED
      );

      const totalDecisive = correct.length + incorrect.length;
      const rawAccuracy =
        totalDecisive > 0 ? (correct.length / totalDecisive) * 100 : 0;

      // Calculate weighted accuracy
      let weightedCorrect = 0;
      let weightedTotal = 0;
      for (const p of windowPredictions) {
        const weight = CONVICTION_WEIGHTS[p.conviction] || 1;
        weightedTotal += weight;
        if (p.outcome === PredictionOutcome.CORRECT) {
          weightedCorrect += weight;
        }
      }
      const weightedAccuracy =
        weightedTotal > 0 ? (weightedCorrect / weightedTotal) * 100 : 0;

      // High conviction accuracy
      const highConvictionPredictions = windowPredictions.filter(
        (p) =>
          p.conviction === ConvictionLevel.HIGH ||
          p.conviction === ConvictionLevel.VERY_HIGH
      );
      const highConvictionCorrect = highConvictionPredictions.filter(
        (p) => p.outcome === PredictionOutcome.CORRECT
      ).length;
      const highConvictionDecisive = highConvictionPredictions.filter(
        (p) =>
          p.outcome === PredictionOutcome.CORRECT ||
          p.outcome === PredictionOutcome.INCORRECT
      ).length;
      const highConvictionAccuracy =
        highConvictionDecisive > 0
          ? (highConvictionCorrect / highConvictionDecisive) * 100
          : 0;

      // Average conviction level (0-1 scale)
      const avgConviction =
        windowPredictions.length > 0
          ? windowPredictions.reduce(
              (sum, p) => sum + (CONVICTION_WEIGHTS[p.conviction] || 1) / 2,
              0
            ) / windowPredictions.length
          : 0;

      // Average entry probability
      const avgEntryProbability =
        windowPredictions.length > 0
          ? windowPredictions.reduce((sum, p) => sum + p.entryProbability, 0) /
            windowPredictions.length
          : 0.5;

      // P&L stats
      const totalPnl = windowPredictions.reduce(
        (sum, p) => sum + (p.realizedPnl || 0),
        0
      );
      const validRoiPredictions = windowPredictions.filter(
        (p) => p.roi !== undefined
      );
      const avgRoi =
        validRoiPredictions.length > 0
          ? validRoiPredictions.reduce((sum, p) => sum + (p.roi || 0), 0) /
            validRoiPredictions.length
          : 0;

      // Brier score
      const brierScore = this.calculateBrierScore(windowPredictions);

      result[window] = {
        window,
        totalPredictions: windowPredictions.length,
        correctPredictions: correct.length,
        incorrectPredictions: incorrect.length,
        cancelledPredictions: cancelled.length,
        rawAccuracy,
        weightedAccuracy,
        highConvictionAccuracy,
        highConvictionCount: highConvictionPredictions.length,
        avgConviction,
        avgEntryProbability,
        totalPnl,
        avgRoi,
        brierScore,
        windowStart,
        windowEnd: now,
      };
    }

    return result;
  }

  private calculateBrierScore(predictions: TrackedPrediction[]): number {
    if (predictions.length === 0) return 0;

    let totalBrierScore = 0;
    let count = 0;

    for (const p of predictions) {
      if (
        p.outcome === PredictionOutcome.CORRECT ||
        p.outcome === PredictionOutcome.INCORRECT
      ) {
        const actualOutcome = p.outcome === PredictionOutcome.CORRECT ? 1 : 0;
        const predictedProbability = p.entryProbability;
        totalBrierScore += Math.pow(predictedProbability - actualOutcome, 2);
        count++;
      }
    }

    return count > 0 ? totalBrierScore / count : 0;
  }

  private calculateCategoryStats(
    predictions: TrackedPrediction[]
  ): CategoryAccuracyStats[] {
    const categoryMap = new Map<
      string,
      {
        total: number;
        correct: number;
        weightedCorrect: number;
        weightedTotal: number;
        pnl: number;
        roi: number;
        roiCount: number;
      }
    >();

    for (const prediction of predictions) {
      const category = prediction.marketCategory || "unknown";
      let stats = categoryMap.get(category);
      if (!stats) {
        stats = {
          total: 0,
          correct: 0,
          weightedCorrect: 0,
          weightedTotal: 0,
          pnl: 0,
          roi: 0,
          roiCount: 0,
        };
        categoryMap.set(category, stats);
      }

      if (
        prediction.outcome === PredictionOutcome.CORRECT ||
        prediction.outcome === PredictionOutcome.INCORRECT
      ) {
        stats.total++;
        const weight = CONVICTION_WEIGHTS[prediction.conviction] || 1;
        stats.weightedTotal += weight;

        if (prediction.outcome === PredictionOutcome.CORRECT) {
          stats.correct++;
          stats.weightedCorrect += weight;
        }

        stats.pnl += prediction.realizedPnl || 0;
        if (prediction.roi !== undefined) {
          stats.roi += prediction.roi;
          stats.roiCount++;
        }
      }
    }

    const result: CategoryAccuracyStats[] = [];
    for (const [category, stats] of categoryMap) {
      result.push({
        category,
        totalPredictions: stats.total,
        correctPredictions: stats.correct,
        rawAccuracy:
          stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        weightedAccuracy:
          stats.weightedTotal > 0
            ? (stats.weightedCorrect / stats.weightedTotal) * 100
            : 0,
        totalPnl: stats.pnl,
        avgRoi: stats.roiCount > 0 ? stats.roi / stats.roiCount : 0,
      });
    }

    return result.sort((a, b) => b.totalPredictions - a.totalPredictions);
  }

  private calculateTrend(predictions: TrackedPrediction[]): AccuracyTrend {
    if (predictions.length < 10) {
      return {
        direction: "stable",
        magnitude: 0,
        significance: 0,
        recentAccuracy: 0,
        historicalAccuracy: 0,
      };
    }

    // Sort by resolution timestamp
    const sorted = [...predictions].sort((a, b) => {
      const aTime = a.resolutionTimestamp?.getTime() || 0;
      const bTime = b.resolutionTimestamp?.getTime() || 0;
      return aTime - bTime;
    });

    // Split into historical (first 70%) and recent (last 30%)
    const splitIndex = Math.floor(sorted.length * 0.7);
    const historical = sorted.slice(0, splitIndex);
    const recent = sorted.slice(splitIndex);

    const historicalCorrect = historical.filter(
      (p) => p.outcome === PredictionOutcome.CORRECT
    ).length;
    const recentCorrect = recent.filter(
      (p) => p.outcome === PredictionOutcome.CORRECT
    ).length;

    const historicalDecisive = historical.filter(
      (p) =>
        p.outcome === PredictionOutcome.CORRECT ||
        p.outcome === PredictionOutcome.INCORRECT
    ).length;
    const recentDecisive = recent.filter(
      (p) =>
        p.outcome === PredictionOutcome.CORRECT ||
        p.outcome === PredictionOutcome.INCORRECT
    ).length;

    const historicalAccuracy =
      historicalDecisive > 0 ? (historicalCorrect / historicalDecisive) * 100 : 0;
    const recentAccuracy =
      recentDecisive > 0 ? (recentCorrect / recentDecisive) * 100 : 0;

    const magnitude = Math.abs(recentAccuracy - historicalAccuracy);

    // Simple significance based on sample size and magnitude
    const minSample = Math.min(historicalDecisive, recentDecisive);
    const significance = Math.min(1, (minSample / 20) * (magnitude / 20));

    let direction: "improving" | "declining" | "stable";
    if (recentAccuracy > historicalAccuracy + 5) {
      direction = "improving";
    } else if (recentAccuracy < historicalAccuracy - 5) {
      direction = "declining";
    } else {
      direction = "stable";
    }

    return {
      direction,
      magnitude,
      significance,
      recentAccuracy,
      historicalAccuracy,
    };
  }

  private calculateHistory(
    predictions: TrackedPrediction[]
  ): AccuracyDataPoint[] {
    if (predictions.length === 0) return [];

    const sorted = [...predictions].sort((a, b) => {
      const aTime = a.resolutionTimestamp?.getTime() || 0;
      const bTime = b.resolutionTimestamp?.getTime() || 0;
      return aTime - bTime;
    });

    const history: AccuracyDataPoint[] = [];
    let cumulativeCorrect = 0;
    let cumulativeWeightedCorrect = 0;
    let cumulativeWeightedTotal = 0;
    let cumulativeDecisive = 0;

    for (const prediction of sorted) {
      if (!prediction.resolutionTimestamp) continue;

      if (
        prediction.outcome === PredictionOutcome.CORRECT ||
        prediction.outcome === PredictionOutcome.INCORRECT
      ) {
        cumulativeDecisive++;
        const weight = CONVICTION_WEIGHTS[prediction.conviction] || 1;
        cumulativeWeightedTotal += weight;

        if (prediction.outcome === PredictionOutcome.CORRECT) {
          cumulativeCorrect++;
          cumulativeWeightedCorrect += weight;
        }

        const cumulativeAccuracy =
          cumulativeDecisive > 0
            ? (cumulativeCorrect / cumulativeDecisive) * 100
            : 0;
        const cumulativeWeightedAccuracy =
          cumulativeWeightedTotal > 0
            ? (cumulativeWeightedCorrect / cumulativeWeightedTotal) * 100
            : 0;

        history.push({
          date: prediction.resolutionTimestamp,
          cumulativeAccuracy,
          cumulativeWeightedAccuracy,
          totalPredictions: cumulativeDecisive,
          correctPredictions: cumulativeCorrect,
        });
      }
    }

    return history;
  }

  private detectAnomalies(
    predictions: TrackedPrediction[],
    windowStats: Record<AccuracyWindow, WindowAccuracyStats>,
    categoryStats: CategoryAccuracyStats[],
    trend: AccuracyTrend
  ): AccuracyAnomaly[] {
    const anomalies: AccuracyAnomaly[] = [];
    const allTimeStats = windowStats[AccuracyWindow.ALL_TIME];

    // Exceptional overall accuracy
    if (
      allTimeStats.rawAccuracy >= this.config.exceptionalAccuracyThreshold &&
      allTimeStats.totalPredictions >= this.config.minPredictionsForAnalysis
    ) {
      anomalies.push({
        type: "exceptional_accuracy",
        severity: Math.min(
          100,
          (allTimeStats.rawAccuracy - this.config.exceptionalAccuracyThreshold) *
            5 +
            50
        ),
        description: `Exceptional accuracy of ${allTimeStats.rawAccuracy.toFixed(1)}% across ${allTimeStats.totalPredictions} predictions`,
        data: {
          accuracy: allTimeStats.rawAccuracy,
          totalPredictions: allTimeStats.totalPredictions,
        },
      });
    }

    // Sudden improvement in accuracy
    if (
      trend.direction === "improving" &&
      trend.magnitude > 15 &&
      trend.significance > 0.5
    ) {
      anomalies.push({
        type: "sudden_improvement",
        severity: Math.min(100, trend.magnitude * 2 + trend.significance * 30),
        description: `Accuracy improved significantly from ${trend.historicalAccuracy.toFixed(1)}% to ${trend.recentAccuracy.toFixed(1)}%`,
        data: {
          historicalAccuracy: trend.historicalAccuracy,
          recentAccuracy: trend.recentAccuracy,
          magnitude: trend.magnitude,
        },
      });
    }

    // Perfect high conviction accuracy
    if (
      allTimeStats.highConvictionCount >= 5 &&
      allTimeStats.highConvictionAccuracy >= this.config.highConvictionAccuracyThreshold
    ) {
      anomalies.push({
        type: "perfect_high_conviction",
        severity: Math.min(
          100,
          (allTimeStats.highConvictionAccuracy -
            this.config.highConvictionAccuracyThreshold) *
            3 +
            60
        ),
        description: `High conviction predictions have ${allTimeStats.highConvictionAccuracy.toFixed(1)}% accuracy across ${allTimeStats.highConvictionCount} predictions`,
        data: {
          highConvictionAccuracy: allTimeStats.highConvictionAccuracy,
          highConvictionCount: allTimeStats.highConvictionCount,
        },
      });
    }

    // Category expertise
    for (const catStats of categoryStats) {
      if (catStats.totalPredictions >= 5 && catStats.rawAccuracy >= 80) {
        anomalies.push({
          type: "category_expertise",
          severity: Math.min(100, (catStats.rawAccuracy - 70) * 3 + 30),
          description: `High accuracy of ${catStats.rawAccuracy.toFixed(1)}% in ${catStats.category} category (${catStats.totalPredictions} predictions)`,
          data: {
            category: catStats.category,
            accuracy: catStats.rawAccuracy,
            predictions: catStats.totalPredictions,
          },
        });
      }
    }

    // Timing advantage (predictions made close to resolution with high accuracy)
    const shortTimePredictions = predictions.filter(
      (p) =>
        p.hoursUntilResolution !== undefined && p.hoursUntilResolution <= 24
    );
    if (shortTimePredictions.length >= 5) {
      const shortTimeCorrect = shortTimePredictions.filter(
        (p) => p.outcome === PredictionOutcome.CORRECT
      ).length;
      const shortTimeDecisive = shortTimePredictions.filter(
        (p) =>
          p.outcome === PredictionOutcome.CORRECT ||
          p.outcome === PredictionOutcome.INCORRECT
      ).length;
      const shortTimeAccuracy =
        shortTimeDecisive > 0
          ? (shortTimeCorrect / shortTimeDecisive) * 100
          : 0;

      if (shortTimeAccuracy >= 80) {
        anomalies.push({
          type: "timing_advantage",
          severity: Math.min(100, (shortTimeAccuracy - 70) * 3 + 50),
          description: `${shortTimeAccuracy.toFixed(1)}% accuracy on predictions made within 24 hours of resolution (${shortTimePredictions.length} predictions)`,
          data: {
            shortTimeAccuracy,
            shortTimePredictions: shortTimePredictions.length,
          },
        });
      }
    }

    // Contrarian success (betting against low probability outcomes and winning)
    const contrarianPredictions = predictions.filter(
      (p) =>
        p.entryProbability <= 0.3 && p.outcome === PredictionOutcome.CORRECT
    );
    if (contrarianPredictions.length >= 5) {
      const totalContrarianBets = predictions.filter(
        (p) =>
          p.entryProbability <= 0.3 &&
          (p.outcome === PredictionOutcome.CORRECT ||
            p.outcome === PredictionOutcome.INCORRECT)
      ).length;
      const contrarianAccuracy =
        totalContrarianBets > 0
          ? (contrarianPredictions.length / totalContrarianBets) * 100
          : 0;

      if (contrarianAccuracy >= 60) {
        anomalies.push({
          type: "contrarian_success",
          severity: Math.min(
            100,
            (contrarianAccuracy - 30) * 2 + contrarianPredictions.length * 5
          ),
          description: `${contrarianAccuracy.toFixed(1)}% success rate on contrarian bets (entry probability ≤30%) across ${contrarianPredictions.length} wins`,
          data: {
            contrarianAccuracy,
            contrarianWins: contrarianPredictions.length,
            totalContrarianBets,
          },
        });
      }
    }

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  private determineTier(
    accuracy: number,
    totalPredictions: number,
    minPredictions: number
  ): AccuracyTier {
    if (totalPredictions < minPredictions) {
      return AccuracyTier.UNKNOWN;
    }

    if (accuracy >= 90) return AccuracyTier.EXCEPTIONAL;
    if (accuracy >= 80) return AccuracyTier.EXCELLENT;
    if (accuracy >= 70) return AccuracyTier.VERY_GOOD;
    if (accuracy >= 60) return AccuracyTier.GOOD;
    if (accuracy >= 55) return AccuracyTier.ABOVE_AVERAGE;
    if (accuracy >= 50) return AccuracyTier.AVERAGE;
    if (accuracy >= 40) return AccuracyTier.POOR;
    return AccuracyTier.VERY_POOR;
  }

  private calculateSuspicion(
    predictions: TrackedPrediction[],
    allTimeStats: WindowAccuracyStats,
    categoryStats: CategoryAccuracyStats[],
    trend: AccuracyTrend,
    anomalies: AccuracyAnomaly[]
  ): {
    suspicionLevel: AccuracySuspicionLevel;
    suspicionScore: number;
    isPotentialInsider: boolean;
  } {
    if (
      allTimeStats.totalPredictions < this.config.minPredictionsForAnalysis
    ) {
      return {
        suspicionLevel: AccuracySuspicionLevel.NONE,
        suspicionScore: 0,
        isPotentialInsider: false,
      };
    }

    // Calculate component scores
    let accuracyScore = 0;
    if (allTimeStats.rawAccuracy >= 90) accuracyScore = 100;
    else if (allTimeStats.rawAccuracy >= 80) accuracyScore = 70;
    else if (allTimeStats.rawAccuracy >= 70) accuracyScore = 40;
    else if (allTimeStats.rawAccuracy >= 60) accuracyScore = 20;

    // High conviction accuracy score
    let hcScore = 0;
    if (allTimeStats.highConvictionCount >= 5) {
      if (allTimeStats.highConvictionAccuracy >= 90) hcScore = 100;
      else if (allTimeStats.highConvictionAccuracy >= 80) hcScore = 60;
      else if (allTimeStats.highConvictionAccuracy >= 70) hcScore = 30;
    }

    // Category expertise score
    let catScore = 0;
    const topCatAccuracies = categoryStats
      .filter((c) => c.totalPredictions >= 5)
      .map((c) => c.rawAccuracy);
    if (topCatAccuracies.some((acc) => acc >= 85)) catScore = 80;
    else if (topCatAccuracies.some((acc) => acc >= 75)) catScore = 50;
    else if (topCatAccuracies.some((acc) => acc >= 65)) catScore = 25;

    // Trend score
    let trendScore = 0;
    if (trend.direction === "improving" && trend.magnitude > 20) {
      trendScore = Math.min(80, trend.magnitude * 2);
    }

    // Contrarian success score
    let contrarianScore = 0;
    const contrarianWins = predictions.filter(
      (p) =>
        p.entryProbability <= 0.3 && p.outcome === PredictionOutcome.CORRECT
    ).length;
    const contrarianTotal = predictions.filter(
      (p) =>
        p.entryProbability <= 0.3 &&
        (p.outcome === PredictionOutcome.CORRECT ||
          p.outcome === PredictionOutcome.INCORRECT)
    ).length;
    if (contrarianTotal >= 5) {
      const contrarianAcc = (contrarianWins / contrarianTotal) * 100;
      if (contrarianAcc >= 60) contrarianScore = 80;
      else if (contrarianAcc >= 50) contrarianScore = 50;
      else if (contrarianAcc >= 40) contrarianScore = 25;
    }

    // Anomaly score
    const anomalyScore = Math.min(
      100,
      anomalies.reduce((sum, a) => sum + a.severity, 0) / 3
    );

    // Weighted total
    const suspicionScore =
      accuracyScore * SUSPICION_WEIGHTS.accuracy +
      hcScore * SUSPICION_WEIGHTS.highConvictionAccuracy +
      catScore * SUSPICION_WEIGHTS.categoryExpertise +
      trendScore * SUSPICION_WEIGHTS.trend +
      contrarianScore * SUSPICION_WEIGHTS.contrarianSuccess +
      anomalyScore * SUSPICION_WEIGHTS.anomalyCount;

    // Determine level
    let suspicionLevel: AccuracySuspicionLevel;
    if (suspicionScore >= 80) suspicionLevel = AccuracySuspicionLevel.CRITICAL;
    else if (suspicionScore >= 60) suspicionLevel = AccuracySuspicionLevel.HIGH;
    else if (suspicionScore >= 40)
      suspicionLevel = AccuracySuspicionLevel.MEDIUM;
    else if (suspicionScore >= 20) suspicionLevel = AccuracySuspicionLevel.LOW;
    else suspicionLevel = AccuracySuspicionLevel.NONE;

    // Determine if potential insider
    const isPotentialInsider =
      allTimeStats.rawAccuracy >=
        this.config.potentialInsiderAccuracyThreshold &&
      allTimeStats.totalPredictions >=
        this.config.minPredictionsForHighConfidence;

    // Also flag if high conviction accuracy is very high
    const hasHighConvictionInsiderPattern =
      allTimeStats.highConvictionCount >=
        this.config.minHighConvictionForInsider &&
      allTimeStats.highConvictionAccuracy >=
        this.config.highConvictionAccuracyThreshold;

    return {
      suspicionLevel,
      suspicionScore: Math.round(suspicionScore),
      isPotentialInsider: isPotentialInsider || hasHighConvictionInsiderPattern,
    };
  }

  private calculateDataQuality(predictionCount: number): number {
    if (predictionCount >= 100) return 100;
    if (predictionCount >= 50) return 80;
    if (predictionCount >= 30) return 60;
    if (predictionCount >= 15) return 40;
    if (predictionCount >= 10) return 20;
    return 0;
  }

  private calculateRanks(results: Map<string, AccuracyResult>): void {
    const rankings: Array<{ address: string; accuracy: number }> = [];

    for (const [address, result] of results) {
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];
      if (stats.totalPredictions >= this.config.minPredictionsForAnalysis) {
        rankings.push({ address, accuracy: stats.weightedAccuracy });
      }
    }

    rankings.sort((a, b) => b.accuracy - a.accuracy);

    for (let i = 0; i < rankings.length; i++) {
      const entry = rankings[i];
      if (!entry) continue;

      const result = results.get(entry.address);
      if (result) {
        result.accuracyRank = i + 1;
        result.percentileRank =
          rankings.length > 1
            ? ((rankings.length - 1 - i) / (rankings.length - 1)) * 100
            : 100;
      }
    }
  }
}

// ============================================================================
// Factory and Convenience Functions
// ============================================================================

/**
 * Create a new HistoricalAccuracyScorer instance
 */
export function createHistoricalAccuracyScorer(
  config?: Partial<HistoricalAccuracyScorerConfig>
): HistoricalAccuracyScorer {
  return new HistoricalAccuracyScorer(config);
}

// Shared instance
let sharedScorer: HistoricalAccuracyScorer | null = null;

/**
 * Get the shared HistoricalAccuracyScorer instance
 */
export function getSharedHistoricalAccuracyScorer(): HistoricalAccuracyScorer {
  if (!sharedScorer) {
    sharedScorer = new HistoricalAccuracyScorer();
  }
  return sharedScorer;
}

/**
 * Set the shared HistoricalAccuracyScorer instance
 */
export function setSharedHistoricalAccuracyScorer(
  scorer: HistoricalAccuracyScorer
): void {
  sharedScorer = scorer;
}

/**
 * Reset the shared HistoricalAccuracyScorer instance
 */
export function resetSharedHistoricalAccuracyScorer(): void {
  sharedScorer = null;
}

/**
 * Add a prediction to the shared scorer
 */
export function addPredictionForAccuracy(prediction: TrackedPrediction): void {
  getSharedHistoricalAccuracyScorer().addPrediction(prediction);
}

/**
 * Add multiple predictions to the shared scorer
 */
export function addPredictionsForAccuracy(
  predictions: TrackedPrediction[]
): void {
  getSharedHistoricalAccuracyScorer().addPredictions(predictions);
}

/**
 * Update prediction outcome in the shared scorer
 */
export function updatePredictionOutcomeForAccuracy(
  walletAddress: string,
  predictionId: string,
  actualOutcome: string,
  resolutionTimestamp?: Date,
  realizedPnl?: number,
  roi?: number
): void {
  getSharedHistoricalAccuracyScorer().updatePredictionOutcome(
    walletAddress,
    predictionId,
    actualOutcome,
    resolutionTimestamp,
    realizedPnl,
    roi
  );
}

/**
 * Analyze accuracy for a wallet using the shared scorer
 */
export function analyzeAccuracy(
  walletAddress: string,
  options?: AnalyzeAccuracyOptions
): AccuracyResult {
  return getSharedHistoricalAccuracyScorer().analyze(walletAddress, options);
}

/**
 * Batch analyze accuracy using the shared scorer
 */
export function batchAnalyzeAccuracy(
  walletAddresses: string[],
  options?: AnalyzeAccuracyOptions
): BatchAccuracyResult {
  return getSharedHistoricalAccuracyScorer().batchAnalyze(
    walletAddresses,
    options
  );
}

/**
 * Check if wallet has exceptional accuracy
 */
export function hasExceptionalAccuracy(walletAddress: string): boolean {
  return getSharedHistoricalAccuracyScorer().hasExceptionalAccuracy(
    walletAddress
  );
}

/**
 * Get wallets with high accuracy
 */
export function getHighAccuracyWallets(
  minAccuracy?: number
): AccuracyResult[] {
  return getSharedHistoricalAccuracyScorer().getHighAccuracyWallets(
    minAccuracy
  );
}

/**
 * Get potential insider wallets by accuracy
 */
export function getPotentialInsidersByAccuracy(): AccuracyResult[] {
  return getSharedHistoricalAccuracyScorer().getPotentialInsiders();
}

/**
 * Get accuracy rankings
 */
export function getAccuracyRankings(
  minPredictions?: number
): WalletAccuracyRanking[] {
  return getSharedHistoricalAccuracyScorer().getAccuracyRankings(minPredictions);
}

/**
 * Get accuracy scorer summary
 */
export function getAccuracyScorerSummary(): AccuracyScorerSummary {
  return getSharedHistoricalAccuracyScorer().getSummary();
}

/**
 * Get accuracy tier description
 */
export function getAccuracyTierDescription(tier: AccuracyTier): string {
  switch (tier) {
    case AccuracyTier.UNKNOWN:
      return "Unknown - insufficient data for analysis";
    case AccuracyTier.VERY_POOR:
      return "Very poor accuracy (below 40%)";
    case AccuracyTier.POOR:
      return "Poor accuracy (40-50%)";
    case AccuracyTier.AVERAGE:
      return "Average accuracy (50-55%) - expected for random";
    case AccuracyTier.ABOVE_AVERAGE:
      return "Above average accuracy (55-60%)";
    case AccuracyTier.GOOD:
      return "Good accuracy (60-70%)";
    case AccuracyTier.VERY_GOOD:
      return "Very good accuracy (70-80%)";
    case AccuracyTier.EXCELLENT:
      return "Excellent accuracy (80-90%)";
    case AccuracyTier.EXCEPTIONAL:
      return "Exceptional accuracy (90%+) - potential insider";
  }
}

/**
 * Get suspicion level description
 */
export function getAccuracySuspicionDescription(
  level: AccuracySuspicionLevel
): string {
  switch (level) {
    case AccuracySuspicionLevel.NONE:
      return "No suspicious accuracy patterns detected";
    case AccuracySuspicionLevel.LOW:
      return "Slightly above average accuracy";
    case AccuracySuspicionLevel.MEDIUM:
      return "Notable accuracy worth monitoring";
    case AccuracySuspicionLevel.HIGH:
      return "Suspicious accuracy patterns";
    case AccuracySuspicionLevel.CRITICAL:
      return "Highly suspicious - likely informational advantage";
  }
}

/**
 * Get conviction level description
 */
export function getConvictionLevelDescription(level: ConvictionLevel): string {
  switch (level) {
    case ConvictionLevel.VERY_LOW:
      return "Very low conviction (< 5% of typical position)";
    case ConvictionLevel.LOW:
      return "Low conviction (5-15% of typical position)";
    case ConvictionLevel.MEDIUM:
      return "Medium conviction (15-40% of typical position)";
    case ConvictionLevel.HIGH:
      return "High conviction (40-75% of typical position)";
    case ConvictionLevel.VERY_HIGH:
      return "Very high conviction (> 75% of typical position)";
  }
}
