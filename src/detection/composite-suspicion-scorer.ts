/**
 * Composite Suspicion Score Calculator (DET-SCORE-001)
 *
 * Calculate overall suspicion score from multiple detection signals.
 * Combines scores from all detectors with configurable weights and
 * normalizes to a 0-100 scale.
 *
 * Features:
 * - Collect all signal scores from various detectors
 * - Apply configurable signal weights
 * - Combine into composite score
 * - Normalize to 0-100 scale
 * - Provide detailed breakdown
 * - Support batch analysis
 * - Event emission for high suspicion
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

import {
  type FreshWalletConfidenceResult,
  ConfidenceLevel,
  getSharedFreshWalletConfidenceScorer,
  type FreshWalletConfidenceScorer,
} from "./fresh-wallet-confidence";
import {
  type WinRateResult,
  WinRateSuspicionLevel,
  getSharedWinRateTracker,
  type WinRateTracker,
} from "./win-rate-tracker";
import {
  type PnlResult,
  getSharedProfitLossCalculator,
  type ProfitLossCalculator,
} from "./profit-loss-calculator";
import {
  type TimingPatternResult,
  TimingSuspicionLevel,
  getSharedTimingPatternAnalyzer,
  type TimingPatternAnalyzer,
} from "./timing-pattern-analyzer";
import {
  type SizingAnalysisResult,
  SizingSuspicionLevel,
  getSharedPositionSizingAnalyzer,
  type PositionSizingAnalyzer,
} from "./position-sizing-analyzer";
import {
  type SelectionAnalysisResult,
  SelectionSuspicionLevel,
  getSharedMarketSelectionAnalyzer,
  type MarketSelectionAnalyzer,
} from "./market-selection-analyzer";
import {
  type CoordinationAnalysisResult,
  CoordinationRiskLevel,
  getSharedCoordinatedTradingDetector,
  type CoordinatedTradingDetector,
} from "./coordinated-trading-detector";
import {
  type SybilAnalysisResult,
  getSharedSybilAttackDetector,
  type SybilAttackDetector,
} from "./sybil-attack-detector";
import {
  type AccuracyResult,
  getSharedHistoricalAccuracyScorer,
  type HistoricalAccuracyScorer,
} from "./historical-accuracy-scorer";
import {
  type PatternClassificationResult,
  PatternRiskFlag,
  getSharedTradingPatternClassifier,
  type TradingPatternClassifier,
} from "./trading-pattern-classifier";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Signal source identifier
 */
export enum SignalSource {
  /** Fresh wallet confidence score */
  FRESH_WALLET = "FRESH_WALLET",
  /** Win rate analysis */
  WIN_RATE = "WIN_RATE",
  /** Profit/loss analysis */
  PROFIT_LOSS = "PROFIT_LOSS",
  /** Timing pattern analysis */
  TIMING_PATTERN = "TIMING_PATTERN",
  /** Position sizing analysis */
  POSITION_SIZING = "POSITION_SIZING",
  /** Market selection analysis */
  MARKET_SELECTION = "MARKET_SELECTION",
  /** Coordination detection */
  COORDINATION = "COORDINATION",
  /** Sybil attack detection */
  SYBIL = "SYBIL",
  /** Historical accuracy */
  ACCURACY = "ACCURACY",
  /** Trading pattern classification */
  TRADING_PATTERN = "TRADING_PATTERN",
}

/**
 * Signal category for grouping (for composite scoring)
 */
export enum CompositeSignalCategory {
  /** Wallet characteristics signals */
  WALLET_PROFILE = "WALLET_PROFILE",
  /** Performance-based signals */
  PERFORMANCE = "PERFORMANCE",
  /** Behavioral pattern signals */
  BEHAVIOR = "BEHAVIOR",
  /** Coordination/network signals */
  NETWORK = "NETWORK",
}

/**
 * Overall suspicion level
 */
export enum CompositeSuspicionLevel {
  /** Normal activity (0-20) */
  NONE = "NONE",
  /** Slightly suspicious (20-40) */
  LOW = "LOW",
  /** Notable concerns (40-60) */
  MEDIUM = "MEDIUM",
  /** Highly suspicious (60-80) */
  HIGH = "HIGH",
  /** Critical - likely insider/manipulation (80-100) */
  CRITICAL = "CRITICAL",
}

/**
 * Signal confidence level
 */
export enum SignalConfidence {
  /** Low confidence - limited data */
  LOW = "LOW",
  /** Medium confidence - moderate data */
  MEDIUM = "MEDIUM",
  /** High confidence - sufficient data */
  HIGH = "HIGH",
}

/**
 * Individual signal contribution to composite score
 */
export interface CompositeSignalContribution {
  /** Signal source */
  source: SignalSource;
  /** Signal category */
  category: CompositeSignalCategory;
  /** Human-readable name */
  name: string;
  /** Raw score from detector (0-100) */
  rawScore: number;
  /** Configured weight for this signal (0-1) */
  weight: number;
  /** Weighted contribution to final score */
  weightedScore: number;
  /** Confidence in this signal */
  confidence: SignalConfidence;
  /** Data quality score (0-100) */
  dataQuality: number;
  /** Whether signal was available/applicable */
  available: boolean;
  /** Brief explanation of the score */
  reason: string;
  /** Flags detected by this signal */
  flags: string[];
}

/**
 * Category breakdown in composite score
 */
export interface CategoryBreakdown {
  /** Category identifier */
  category: CompositeSignalCategory;
  /** Category display name */
  name: string;
  /** Aggregate score for this category (0-100) */
  score: number;
  /** Weight of this category in final score */
  weight: number;
  /** Number of signals in this category */
  signalCount: number;
  /** Number of available signals */
  availableSignals: number;
  /** Individual signal contributions */
  signals: CompositeSignalContribution[];
}

/**
 * Risk flag summary
 */
export interface RiskFlagSummary {
  /** Flag category */
  category: string;
  /** Flag severity (0-100) */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Contributing signals */
  sources: SignalSource[];
}

/**
 * Composite score result
 */
export interface CompositeScoreResult {
  /** Wallet address (checksummed) */
  walletAddress: string;
  /** Composite suspicion score (0-100) */
  compositeScore: number;
  /** Suspicion level classification */
  suspicionLevel: CompositeSuspicionLevel;
  /** Whether this wallet should be flagged for review */
  shouldFlag: boolean;
  /** Whether this is a potential insider */
  isPotentialInsider: boolean;
  /** Category breakdown */
  categoryBreakdown: CategoryBreakdown[];
  /** All signal contributions */
  signalContributions: CompositeSignalContribution[];
  /** Top contributing signals (sorted by weighted score) */
  topSignals: CompositeSignalContribution[];
  /** Aggregated risk flags */
  riskFlags: RiskFlagSummary[];
  /** Overall data quality (0-100) */
  dataQuality: number;
  /** Number of available signals */
  availableSignals: number;
  /** Total possible signals */
  totalSignals: number;
  /** Human-readable summary */
  summary: string[];
  /** Key findings list */
  keyFindings: string[];
  /** Underlying results from each detector */
  underlyingResults: {
    freshWallet: FreshWalletConfidenceResult | null;
    winRate: WinRateResult | null;
    profitLoss: PnlResult | null;
    timing: TimingPatternResult | null;
    sizing: SizingAnalysisResult | null;
    selection: SelectionAnalysisResult | null;
    coordination: CoordinationAnalysisResult | null;
    sybil: SybilAnalysisResult | null;
    accuracy: AccuracyResult | null;
    pattern: PatternClassificationResult | null;
  };
  /** Whether result was from cache */
  fromCache: boolean;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Configuration for signal weights
 */
export interface SignalWeightConfig {
  /** Weight for each signal source (0-1) */
  signalWeights: Partial<Record<SignalSource, number>>;
  /** Weight for each category (0-1) */
  categoryWeights: Partial<Record<CompositeSignalCategory, number>>;
}

/**
 * Default signal weights
 */
export const COMPOSITE_DEFAULT_SIGNAL_WEIGHTS: Record<SignalSource, number> = {
  [SignalSource.FRESH_WALLET]: 0.10,
  [SignalSource.WIN_RATE]: 0.12,
  [SignalSource.PROFIT_LOSS]: 0.12,
  [SignalSource.TIMING_PATTERN]: 0.10,
  [SignalSource.POSITION_SIZING]: 0.08,
  [SignalSource.MARKET_SELECTION]: 0.10,
  [SignalSource.COORDINATION]: 0.12,
  [SignalSource.SYBIL]: 0.10,
  [SignalSource.ACCURACY]: 0.10,
  [SignalSource.TRADING_PATTERN]: 0.06,
};

/**
 * Default category weights
 */
export const DEFAULT_CATEGORY_WEIGHTS: Record<CompositeSignalCategory, number> = {
  [CompositeSignalCategory.WALLET_PROFILE]: 0.15,
  [CompositeSignalCategory.PERFORMANCE]: 0.35,
  [CompositeSignalCategory.BEHAVIOR]: 0.25,
  [CompositeSignalCategory.NETWORK]: 0.25,
};

/**
 * Signal to category mapping
 */
export const SIGNAL_CATEGORY_MAP: Record<SignalSource, CompositeSignalCategory> = {
  [SignalSource.FRESH_WALLET]: CompositeSignalCategory.WALLET_PROFILE,
  [SignalSource.WIN_RATE]: CompositeSignalCategory.PERFORMANCE,
  [SignalSource.PROFIT_LOSS]: CompositeSignalCategory.PERFORMANCE,
  [SignalSource.TIMING_PATTERN]: CompositeSignalCategory.BEHAVIOR,
  [SignalSource.POSITION_SIZING]: CompositeSignalCategory.BEHAVIOR,
  [SignalSource.MARKET_SELECTION]: CompositeSignalCategory.BEHAVIOR,
  [SignalSource.COORDINATION]: CompositeSignalCategory.NETWORK,
  [SignalSource.SYBIL]: CompositeSignalCategory.NETWORK,
  [SignalSource.ACCURACY]: CompositeSignalCategory.PERFORMANCE,
  [SignalSource.TRADING_PATTERN]: CompositeSignalCategory.BEHAVIOR,
};

/**
 * Suspicion level thresholds
 */
export const SUSPICION_THRESHOLDS = {
  low: 20,
  medium: 40,
  high: 60,
  critical: 80,
};

/**
 * Options for composite scoring
 */
export interface CompositeScoreOptions {
  /** Custom signal weights */
  signalWeights?: Partial<Record<SignalSource, number>>;
  /** Custom category weights */
  categoryWeights?: Partial<Record<CompositeSignalCategory, number>>;
  /** Minimum signals required for valid score */
  minSignals?: number;
  /** Include underlying detector results */
  includeUnderlyingResults?: boolean;
  /** Use cached results where available */
  useCache?: boolean;
  /** Skip specific signals */
  skipSignals?: SignalSource[];
}

/**
 * Batch scoring result
 */
export interface BatchCompositeScoreResult {
  /** Results by wallet address */
  results: Map<string, CompositeScoreResult>;
  /** Failed wallets */
  failed: Map<string, Error>;
  /** Total processed */
  totalProcessed: number;
  /** Average composite score */
  averageScore: number;
  /** Wallets by suspicion level */
  byLevel: Record<CompositeSuspicionLevel, number>;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Scorer summary statistics
 */
export interface CompositeScorerSummary {
  /** Total wallets scored */
  totalWalletsScored: number;
  /** Wallets by suspicion level */
  byLevel: Record<CompositeSuspicionLevel, number>;
  /** Average composite score */
  averageScore: number;
  /** Median score */
  medianScore: number | null;
  /** Signal availability stats */
  signalAvailability: Record<SignalSource, { available: number; total: number }>;
  /** Most common risk flags */
  commonFlags: Array<{ flag: string; count: number }>;
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
  };
}

/**
 * Composite scorer configuration
 */
export interface CompositeSuspicionScorerConfig {
  /** Signal weights */
  signalWeights: Record<SignalSource, number>;
  /** Category weights */
  categoryWeights: Record<CompositeSignalCategory, number>;
  /** Suspicion level thresholds */
  thresholds: typeof SUSPICION_THRESHOLDS;
  /** Minimum signals for valid analysis */
  minSignals: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Flag threshold (score above which to flag) */
  flagThreshold: number;
  /** Insider threshold (score above which to mark potential insider) */
  insiderThreshold: number;
}

/**
 * Default configuration
 */
export const DEFAULT_COMPOSITE_CONFIG: CompositeSuspicionScorerConfig = {
  signalWeights: { ...COMPOSITE_DEFAULT_SIGNAL_WEIGHTS },
  categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
  thresholds: { ...SUSPICION_THRESHOLDS },
  minSignals: 3,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  flagThreshold: 50,
  insiderThreshold: 70,
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: CompositeScoreResult;
  timestamp: number;
}

// ============================================================================
// Composite Suspicion Scorer Class
// ============================================================================

/**
 * Main composite suspicion scorer class
 */
export class CompositeSuspicionScorer extends EventEmitter {
  private readonly config: CompositeSuspicionScorerConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly signalAvailability: Map<
    SignalSource,
    { available: number; total: number }
  > = new Map();
  private readonly flagCounts: Map<string, number> = new Map();

  // Optional detector instances
  private freshWalletScorer?: FreshWalletConfidenceScorer;
  private winRateTracker?: WinRateTracker;
  private pnlCalculator?: ProfitLossCalculator;
  private timingAnalyzer?: TimingPatternAnalyzer;
  private sizingAnalyzer?: PositionSizingAnalyzer;
  private selectionAnalyzer?: MarketSelectionAnalyzer;
  private coordinationDetector?: CoordinatedTradingDetector;
  private sybilDetector?: SybilAttackDetector;
  private accuracyScorer?: HistoricalAccuracyScorer;
  private patternClassifier?: TradingPatternClassifier;

  constructor(config: Partial<CompositeSuspicionScorerConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_COMPOSITE_CONFIG,
      ...config,
      signalWeights: { ...COMPOSITE_DEFAULT_SIGNAL_WEIGHTS, ...config.signalWeights },
      categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS, ...config.categoryWeights },
      thresholds: { ...SUSPICION_THRESHOLDS, ...config.thresholds },
    };

    // Initialize signal availability tracking
    for (const signal of Object.values(SignalSource)) {
      this.signalAvailability.set(signal, { available: 0, total: 0 });
    }
  }

  /**
   * Set custom detector instances
   */
  setDetectors(detectors: {
    freshWalletScorer?: FreshWalletConfidenceScorer;
    winRateTracker?: WinRateTracker;
    pnlCalculator?: ProfitLossCalculator;
    timingAnalyzer?: TimingPatternAnalyzer;
    sizingAnalyzer?: PositionSizingAnalyzer;
    selectionAnalyzer?: MarketSelectionAnalyzer;
    coordinationDetector?: CoordinatedTradingDetector;
    sybilDetector?: SybilAttackDetector;
    accuracyScorer?: HistoricalAccuracyScorer;
    patternClassifier?: TradingPatternClassifier;
  }): void {
    if (detectors.freshWalletScorer) this.freshWalletScorer = detectors.freshWalletScorer;
    if (detectors.winRateTracker) this.winRateTracker = detectors.winRateTracker;
    if (detectors.pnlCalculator) this.pnlCalculator = detectors.pnlCalculator;
    if (detectors.timingAnalyzer) this.timingAnalyzer = detectors.timingAnalyzer;
    if (detectors.sizingAnalyzer) this.sizingAnalyzer = detectors.sizingAnalyzer;
    if (detectors.selectionAnalyzer) this.selectionAnalyzer = detectors.selectionAnalyzer;
    if (detectors.coordinationDetector)
      this.coordinationDetector = detectors.coordinationDetector;
    if (detectors.sybilDetector) this.sybilDetector = detectors.sybilDetector;
    if (detectors.accuracyScorer) this.accuracyScorer = detectors.accuracyScorer;
    if (detectors.patternClassifier) this.patternClassifier = detectors.patternClassifier;
  }

  /**
   * Get effective weight for a signal
   */
  private getSignalWeight(source: SignalSource): number {
    return this.config.signalWeights[source] ?? COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[source];
  }

  /**
   * Get effective weight for a category
   */
  private getCategoryWeight(category: CompositeSignalCategory): number {
    return this.config.categoryWeights[category] ?? DEFAULT_CATEGORY_WEIGHTS[category];
  }

  /**
   * Calculate composite suspicion score for a wallet
   */
  async calculateScore(
    walletAddress: string,
    options: CompositeScoreOptions = {}
  ): Promise<CompositeScoreResult> {
    // Validate address
    if (!isAddress(walletAddress)) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    const checksummedAddress = getAddress(walletAddress);

    // Check cache
    if (options.useCache !== false) {
      const cached = this.cache.get(checksummedAddress);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
        return { ...cached.result, fromCache: true };
      }
    }

    const skipSignals = new Set(options.skipSignals ?? []);
    const signalContributions: CompositeSignalContribution[] = [];
    const underlyingResults: CompositeScoreResult["underlyingResults"] = {
      freshWallet: null,
      winRate: null,
      profitLoss: null,
      timing: null,
      sizing: null,
      selection: null,
      coordination: null,
      sybil: null,
      accuracy: null,
      pattern: null,
    };

    // Collect signals from all detectors
    const signalPromises: Promise<void>[] = [];

    // Fresh wallet signal
    if (!skipSignals.has(SignalSource.FRESH_WALLET)) {
      signalPromises.push(
        this.collectFreshWalletSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Win rate signal
    if (!skipSignals.has(SignalSource.WIN_RATE)) {
      signalPromises.push(
        this.collectWinRateSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // P&L signal
    if (!skipSignals.has(SignalSource.PROFIT_LOSS)) {
      signalPromises.push(
        this.collectPnlSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Timing pattern signal
    if (!skipSignals.has(SignalSource.TIMING_PATTERN)) {
      signalPromises.push(
        this.collectTimingSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Position sizing signal
    if (!skipSignals.has(SignalSource.POSITION_SIZING)) {
      signalPromises.push(
        this.collectSizingSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Market selection signal
    if (!skipSignals.has(SignalSource.MARKET_SELECTION)) {
      signalPromises.push(
        this.collectSelectionSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Coordination signal
    if (!skipSignals.has(SignalSource.COORDINATION)) {
      signalPromises.push(
        this.collectCoordinationSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Sybil signal
    if (!skipSignals.has(SignalSource.SYBIL)) {
      signalPromises.push(
        this.collectSybilSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Accuracy signal
    if (!skipSignals.has(SignalSource.ACCURACY)) {
      signalPromises.push(
        this.collectAccuracySignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Trading pattern signal
    if (!skipSignals.has(SignalSource.TRADING_PATTERN)) {
      signalPromises.push(
        this.collectPatternSignal(checksummedAddress, signalContributions, underlyingResults)
      );
    }

    // Wait for all signals to be collected
    await Promise.all(signalPromises);

    // Calculate composite score
    const result = this.computeCompositeResult(
      checksummedAddress,
      signalContributions,
      underlyingResults,
      options
    );

    // Cache result
    this.cache.set(checksummedAddress, {
      result,
      timestamp: Date.now(),
    });
    this.maintainCacheSize();

    // Emit events
    if (result.shouldFlag) {
      this.emit("wallet-flagged", {
        walletAddress: checksummedAddress,
        score: result.compositeScore,
        level: result.suspicionLevel,
      });
    }

    if (result.isPotentialInsider) {
      this.emit("potential-insider", {
        walletAddress: checksummedAddress,
        score: result.compositeScore,
        keyFindings: result.keyFindings,
      });
    }

    return result;
  }

  /**
   * Batch calculate scores for multiple wallets
   */
  async batchCalculateScores(
    walletAddresses: string[],
    options: CompositeScoreOptions = {}
  ): Promise<BatchCompositeScoreResult> {
    const results = new Map<string, CompositeScoreResult>();
    const failed = new Map<string, Error>();
    let totalScore = 0;

    const promises = walletAddresses.map(async (address) => {
      try {
        const result = await this.calculateScore(address, options);
        results.set(result.walletAddress, result);
        totalScore += result.compositeScore;
      } catch (error) {
        failed.set(address, error instanceof Error ? error : new Error(String(error)));
      }
    });

    await Promise.all(promises);

    // Calculate by level
    const byLevel: Record<CompositeSuspicionLevel, number> = {
      [CompositeSuspicionLevel.NONE]: 0,
      [CompositeSuspicionLevel.LOW]: 0,
      [CompositeSuspicionLevel.MEDIUM]: 0,
      [CompositeSuspicionLevel.HIGH]: 0,
      [CompositeSuspicionLevel.CRITICAL]: 0,
    };

    for (const result of results.values()) {
      byLevel[result.suspicionLevel]++;
    }

    return {
      results,
      failed,
      totalProcessed: walletAddresses.length,
      averageScore: results.size > 0 ? totalScore / results.size : 0,
      byLevel,
      processedAt: new Date(),
    };
  }

  /**
   * Get scorer summary statistics
   */
  getSummary(): CompositeScorerSummary {
    const scores: number[] = [];
    const byLevel: Record<CompositeSuspicionLevel, number> = {
      [CompositeSuspicionLevel.NONE]: 0,
      [CompositeSuspicionLevel.LOW]: 0,
      [CompositeSuspicionLevel.MEDIUM]: 0,
      [CompositeSuspicionLevel.HIGH]: 0,
      [CompositeSuspicionLevel.CRITICAL]: 0,
    };

    for (const entry of this.cache.values()) {
      scores.push(entry.result.compositeScore);
      byLevel[entry.result.suspicionLevel]++;
    }

    // Calculate median
    let medianScore: number | null = null;
    if (scores.length > 0) {
      const sorted = [...scores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianScore =
        sorted.length % 2 === 0
          ? (sorted[mid - 1]! + sorted[mid]!) / 2
          : sorted[mid]!;
    }

    // Get common flags
    const commonFlags = Array.from(this.flagCounts.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Signal availability
    const signalAvailability: Record<SignalSource, { available: number; total: number }> =
      {} as Record<SignalSource, { available: number; total: number }>;
    for (const [signal, stats] of this.signalAvailability.entries()) {
      signalAvailability[signal] = { ...stats };
    }

    return {
      totalWalletsScored: this.cache.size,
      byLevel,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      medianScore,
      signalAvailability,
      commonFlags,
      cacheStats: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate(),
      },
    };
  }

  /**
   * Get cached result for a wallet
   */
  getCachedResult(walletAddress: string): CompositeScoreResult | null {
    if (!isAddress(walletAddress)) {
      return null;
    }
    const cached = this.cache.get(getAddress(walletAddress));
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
      return cached.result;
    }
    return null;
  }

  /**
   * Get high suspicion wallets
   */
  getHighSuspicionWallets(minLevel: CompositeSuspicionLevel = CompositeSuspicionLevel.HIGH): CompositeScoreResult[] {
    const levelOrder = [
      CompositeSuspicionLevel.NONE,
      CompositeSuspicionLevel.LOW,
      CompositeSuspicionLevel.MEDIUM,
      CompositeSuspicionLevel.HIGH,
      CompositeSuspicionLevel.CRITICAL,
    ];
    const minIndex = levelOrder.indexOf(minLevel);

    const results: CompositeScoreResult[] = [];
    for (const entry of this.cache.values()) {
      const entryIndex = levelOrder.indexOf(entry.result.suspicionLevel);
      if (entryIndex >= minIndex) {
        results.push(entry.result);
      }
    }

    return results.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Get potential insiders from cache
   */
  getPotentialInsiders(): CompositeScoreResult[] {
    const results: CompositeScoreResult[] = [];
    for (const entry of this.cache.values()) {
      if (entry.result.isPotentialInsider) {
        results.push(entry.result);
      }
    }
    return results.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific wallet
   */
  invalidateCache(walletAddress: string): boolean {
    if (!isAddress(walletAddress)) {
      return false;
    }
    return this.cache.delete(getAddress(walletAddress));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompositeSuspicionScorerConfig>): void {
    if (config.signalWeights) {
      Object.assign(this.config.signalWeights, config.signalWeights);
    }
    if (config.categoryWeights) {
      Object.assign(this.config.categoryWeights, config.categoryWeights);
    }
    if (config.thresholds) {
      Object.assign(this.config.thresholds, config.thresholds);
    }
    if (config.minSignals !== undefined) {
      this.config.minSignals = config.minSignals;
    }
    if (config.cacheTtlMs !== undefined) {
      this.config.cacheTtlMs = config.cacheTtlMs;
    }
    if (config.maxCacheSize !== undefined) {
      this.config.maxCacheSize = config.maxCacheSize;
    }
    if (config.flagThreshold !== undefined) {
      this.config.flagThreshold = config.flagThreshold;
    }
    if (config.insiderThreshold !== undefined) {
      this.config.insiderThreshold = config.insiderThreshold;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CompositeSuspicionScorerConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private: Signal Collection Methods
  // ============================================================================

  private async collectFreshWalletSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.FRESH_WALLET, false);

    try {
      const scorer = this.freshWalletScorer ?? getSharedFreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(address);

      underlyingResults.freshWallet = result;
      this.updateSignalAvailability(SignalSource.FRESH_WALLET, true);

      contributions.push({
        source: SignalSource.FRESH_WALLET,
        category: SIGNAL_CATEGORY_MAP[SignalSource.FRESH_WALLET],
        name: "Fresh Wallet Analysis",
        rawScore: result.confidenceScore,
        weight: this.getSignalWeight(SignalSource.FRESH_WALLET),
        weightedScore: result.confidenceScore * this.getSignalWeight(SignalSource.FRESH_WALLET),
        confidence: this.mapConfidenceLevel(result.confidenceLevel),
        dataQuality: 100, // Fresh wallet analysis always has full data
        available: true,
        reason: result.isSuspicious ? "Suspicious fresh wallet activity detected" : "Normal wallet activity",
        flags: result.summary,
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.FRESH_WALLET, "Fresh Wallet Analysis"));
    }
  }

  private async collectWinRateSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.WIN_RATE, false);

    try {
      const tracker = this.winRateTracker ?? getSharedWinRateTracker();
      const result = tracker.analyze(address);

      if (!result || result.totalPositions < 5) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.WIN_RATE, "Win Rate Analysis", "Insufficient trading history")
        );
        return;
      }

      underlyingResults.winRate = result;
      this.updateSignalAvailability(SignalSource.WIN_RATE, true);

      contributions.push({
        source: SignalSource.WIN_RATE,
        category: SIGNAL_CATEGORY_MAP[SignalSource.WIN_RATE],
        name: "Win Rate Analysis",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.WIN_RATE),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.WIN_RATE),
        confidence: this.mapDataQualityToConfidence(result.dataQuality),
        dataQuality: result.dataQuality,
        available: true,
        reason: this.getWinRateReason(result),
        flags: result.anomalies.map((a) => a.description),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.WIN_RATE, "Win Rate Analysis"));
    }
  }

  private async collectPnlSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.PROFIT_LOSS, false);

    try {
      const calculator = this.pnlCalculator ?? getSharedProfitLossCalculator();
      const result = calculator.analyze(address);

      if (!result || result.totalPositions < 5) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.PROFIT_LOSS, "Profit/Loss Analysis", "Insufficient trading history")
        );
        return;
      }

      underlyingResults.profitLoss = result;
      this.updateSignalAvailability(SignalSource.PROFIT_LOSS, true);

      contributions.push({
        source: SignalSource.PROFIT_LOSS,
        category: SIGNAL_CATEGORY_MAP[SignalSource.PROFIT_LOSS],
        name: "Profit/Loss Analysis",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.PROFIT_LOSS),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.PROFIT_LOSS),
        confidence: this.mapDataQualityToConfidence(result.dataQuality),
        dataQuality: result.dataQuality,
        available: true,
        reason: this.getPnlReason(result),
        flags: result.anomalies.map((a) => a.description),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.PROFIT_LOSS, "Profit/Loss Analysis"));
    }
  }

  private async collectTimingSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.TIMING_PATTERN, false);

    try {
      const analyzer = this.timingAnalyzer ?? getSharedTimingPatternAnalyzer();
      const result = analyzer.analyze(address);

      if (!result) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.TIMING_PATTERN, "Timing Pattern Analysis", "No timing data available")
        );
        return;
      }

      underlyingResults.timing = result;
      this.updateSignalAvailability(SignalSource.TIMING_PATTERN, true);

      contributions.push({
        source: SignalSource.TIMING_PATTERN,
        category: SIGNAL_CATEGORY_MAP[SignalSource.TIMING_PATTERN],
        name: "Timing Pattern Analysis",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.TIMING_PATTERN),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.TIMING_PATTERN),
        confidence: SignalConfidence.MEDIUM,
        dataQuality: 70,
        available: true,
        reason: this.getTimingReason(result),
        flags: result.anomalies.map((a) => a.description),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.TIMING_PATTERN, "Timing Pattern Analysis"));
    }
  }

  private async collectSizingSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.POSITION_SIZING, false);

    try {
      const analyzer = this.sizingAnalyzer ?? getSharedPositionSizingAnalyzer();
      const result = analyzer.analyze(address);

      if (!result || result.totalPositions < 5) {
        contributions.push(
          this.createUnavailableSignal(
            SignalSource.POSITION_SIZING,
            "Position Sizing Analysis",
            "Insufficient position data"
          )
        );
        return;
      }

      underlyingResults.sizing = result;
      this.updateSignalAvailability(SignalSource.POSITION_SIZING, true);

      contributions.push({
        source: SignalSource.POSITION_SIZING,
        category: SIGNAL_CATEGORY_MAP[SignalSource.POSITION_SIZING],
        name: "Position Sizing Analysis",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.POSITION_SIZING),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.POSITION_SIZING),
        confidence: this.mapDataQualityToConfidence(result.dataQuality),
        dataQuality: result.dataQuality,
        available: true,
        reason: this.getSizingReason(result),
        flags: result.riskFlags,
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.POSITION_SIZING, "Position Sizing Analysis"));
    }
  }

  private async collectSelectionSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.MARKET_SELECTION, false);

    try {
      const analyzer = this.selectionAnalyzer ?? getSharedMarketSelectionAnalyzer();
      const result = analyzer.analyze(address);

      if (!result) {
        contributions.push(
          this.createUnavailableSignal(
            SignalSource.MARKET_SELECTION,
            "Market Selection Analysis",
            "No selection data available"
          )
        );
        return;
      }

      underlyingResults.selection = result;
      this.updateSignalAvailability(SignalSource.MARKET_SELECTION, true);

      contributions.push({
        source: SignalSource.MARKET_SELECTION,
        category: SIGNAL_CATEGORY_MAP[SignalSource.MARKET_SELECTION],
        name: "Market Selection Analysis",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.MARKET_SELECTION),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.MARKET_SELECTION),
        confidence: this.mapDataQualityToConfidence(result.dataQuality),
        dataQuality: result.dataQuality,
        available: true,
        reason: this.getSelectionReason(result),
        flags: result.riskFlags,
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.MARKET_SELECTION, "Market Selection Analysis"));
    }
  }

  private async collectCoordinationSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.COORDINATION, false);

    try {
      const detector = this.coordinationDetector ?? getSharedCoordinatedTradingDetector();
      const result = detector.analyze(address);

      if (!result) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.COORDINATION, "Coordination Detection", "No coordination data")
        );
        return;
      }

      underlyingResults.coordination = result;
      this.updateSignalAvailability(SignalSource.COORDINATION, true);

      const rawScore = this.mapCoordinationRiskToScore(result.highestRiskLevel, result.groupCount);

      contributions.push({
        source: SignalSource.COORDINATION,
        category: SIGNAL_CATEGORY_MAP[SignalSource.COORDINATION],
        name: "Coordination Detection",
        rawScore,
        weight: this.getSignalWeight(SignalSource.COORDINATION),
        weightedScore: rawScore * this.getSignalWeight(SignalSource.COORDINATION),
        confidence: SignalConfidence.MEDIUM,
        dataQuality: 70,
        available: true,
        reason: this.getCoordinationReason(result),
        flags: result.isCoordinated
          ? [`Part of ${result.groupCount} coordinated group(s)`]
          : [],
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.COORDINATION, "Coordination Detection"));
    }
  }

  private async collectSybilSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.SYBIL, false);

    try {
      const detector = this.sybilDetector ?? getSharedSybilAttackDetector();
      const result = detector.analyzeWallet(address);

      if (!result) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.SYBIL, "Sybil Attack Detection", "No sybil data available")
        );
        return;
      }

      underlyingResults.sybil = result;
      this.updateSignalAvailability(SignalSource.SYBIL, true);

      contributions.push({
        source: SignalSource.SYBIL,
        category: SIGNAL_CATEGORY_MAP[SignalSource.SYBIL],
        name: "Sybil Attack Detection",
        rawScore: result.sybilProbability,
        weight: this.getSignalWeight(SignalSource.SYBIL),
        weightedScore: result.sybilProbability * this.getSignalWeight(SignalSource.SYBIL),
        confidence: this.mapSybilConfidenceToSignalConfidence(result.confidence),
        dataQuality: 80,
        available: true,
        reason: result.summary,
        flags: result.flags.map((f) => f.toString()),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.SYBIL, "Sybil Attack Detection"));
    }
  }

  private async collectAccuracySignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.ACCURACY, false);

    try {
      const scorer = this.accuracyScorer ?? getSharedHistoricalAccuracyScorer();
      const result = scorer.analyze(address);

      if (!result || result.totalPredictions < 5) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.ACCURACY, "Historical Accuracy", "Insufficient prediction history")
        );
        return;
      }

      underlyingResults.accuracy = result;
      this.updateSignalAvailability(SignalSource.ACCURACY, true);

      contributions.push({
        source: SignalSource.ACCURACY,
        category: SIGNAL_CATEGORY_MAP[SignalSource.ACCURACY],
        name: "Historical Accuracy",
        rawScore: result.suspicionScore,
        weight: this.getSignalWeight(SignalSource.ACCURACY),
        weightedScore: result.suspicionScore * this.getSignalWeight(SignalSource.ACCURACY),
        confidence: this.mapDataQualityToConfidence(result.dataQuality),
        dataQuality: result.dataQuality,
        available: true,
        reason: this.getAccuracyReason(result),
        flags: result.anomalies.map((a) => a.description),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.ACCURACY, "Historical Accuracy"));
    }
  }

  private async collectPatternSignal(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): Promise<void> {
    this.updateSignalAvailability(SignalSource.TRADING_PATTERN, false);

    try {
      const classifier = this.patternClassifier ?? getSharedTradingPatternClassifier();
      const result = classifier.getClassification(address);

      if (!result) {
        contributions.push(
          this.createUnavailableSignal(SignalSource.TRADING_PATTERN, "Trading Pattern", "No pattern data available")
        );
        return;
      }

      underlyingResults.pattern = result;
      this.updateSignalAvailability(SignalSource.TRADING_PATTERN, true);

      const rawScore = this.mapPatternRiskToScore(result.riskFlags);

      contributions.push({
        source: SignalSource.TRADING_PATTERN,
        category: SIGNAL_CATEGORY_MAP[SignalSource.TRADING_PATTERN],
        name: "Trading Pattern",
        rawScore,
        weight: this.getSignalWeight(SignalSource.TRADING_PATTERN),
        weightedScore: rawScore * this.getSignalWeight(SignalSource.TRADING_PATTERN),
        confidence: SignalConfidence.MEDIUM,
        dataQuality: 70,
        available: true,
        reason: `Identified as ${result.primaryPattern} pattern`,
        flags: result.riskFlags.map((f) => f.toString()),
      });
    } catch {
      contributions.push(this.createUnavailableSignal(SignalSource.TRADING_PATTERN, "Trading Pattern"));
    }
  }

  // ============================================================================
  // Private: Score Computation
  // ============================================================================

  private computeCompositeResult(
    address: string,
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"],
    options: CompositeScoreOptions
  ): CompositeScoreResult {
    const availableSignals = contributions.filter((c) => c.available);
    const minSignals = options.minSignals ?? this.config.minSignals;

    // Build category breakdown
    const categoryBreakdown = this.buildCategoryBreakdown(contributions);

    // Calculate composite score
    let compositeScore = 0;
    let totalWeight = 0;

    if (availableSignals.length >= minSignals) {
      // Use weighted average of available signals
      for (const signal of availableSignals) {
        compositeScore += signal.weightedScore;
        totalWeight += signal.weight;
      }

      // Normalize by actual weight used
      if (totalWeight > 0) {
        compositeScore = (compositeScore / totalWeight) * 1.0; // Keep as percentage
      }

      // Apply category-level boosting for correlated signals
      compositeScore = this.applyCorrelationBoost(compositeScore, availableSignals);
    }

    // Clamp to 0-100
    compositeScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

    // Determine suspicion level
    const suspicionLevel = this.determineSuspicionLevel(compositeScore);

    // Get top signals
    const topSignals = [...availableSignals]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 5);

    // Aggregate risk flags
    const riskFlags = this.aggregateRiskFlags(contributions);

    // Calculate data quality
    const dataQuality = this.calculateOverallDataQuality(contributions);

    // Generate summary
    const summary = this.generateSummary(compositeScore, suspicionLevel, topSignals, riskFlags);

    // Generate key findings
    const keyFindings = this.generateKeyFindings(contributions, underlyingResults);

    // Track flags
    for (const flag of riskFlags) {
      this.flagCounts.set(flag.description, (this.flagCounts.get(flag.description) ?? 0) + 1);
    }

    return {
      walletAddress: address,
      compositeScore,
      suspicionLevel,
      shouldFlag: compositeScore >= this.config.flagThreshold,
      isPotentialInsider: compositeScore >= this.config.insiderThreshold,
      categoryBreakdown,
      signalContributions: contributions,
      topSignals,
      riskFlags,
      dataQuality,
      availableSignals: availableSignals.length,
      totalSignals: contributions.length,
      summary,
      keyFindings,
      underlyingResults: options.includeUnderlyingResults !== false ? underlyingResults : {
        freshWallet: null,
        winRate: null,
        profitLoss: null,
        timing: null,
        sizing: null,
        selection: null,
        coordination: null,
        sybil: null,
        accuracy: null,
        pattern: null,
      },
      fromCache: false,
      analyzedAt: new Date(),
    };
  }

  private buildCategoryBreakdown(contributions: CompositeSignalContribution[]): CategoryBreakdown[] {
    const categoryMap = new Map<CompositeSignalCategory, CompositeSignalContribution[]>();

    for (const contribution of contributions) {
      const existing = categoryMap.get(contribution.category) ?? [];
      existing.push(contribution);
      categoryMap.set(contribution.category, existing);
    }

    const breakdown: CategoryBreakdown[] = [];

    for (const [category, signals] of categoryMap.entries()) {
      const availableSignals = signals.filter((s) => s.available);
      let categoryScore = 0;

      if (availableSignals.length > 0) {
        const totalWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0);
        const weightedSum = availableSignals.reduce((sum, s) => sum + s.weightedScore, 0);
        categoryScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
      }

      breakdown.push({
        category,
        name: this.getCategoryName(category),
        score: Math.round(categoryScore),
        weight: this.getCategoryWeight(category),
        signalCount: signals.length,
        availableSignals: availableSignals.length,
        signals,
      });
    }

    return breakdown.sort((a, b) => b.score - a.score);
  }

  private applyCorrelationBoost(baseScore: number, signals: CompositeSignalContribution[]): number {
    // Boost score if multiple high-scoring signals are correlated
    const highScoreSignals = signals.filter((s) => s.rawScore >= 60);

    if (highScoreSignals.length >= 3) {
      // Multiple concerning signals - apply boost
      const boostFactor = 1 + (highScoreSignals.length - 2) * 0.05; // 5% boost per additional high signal
      return baseScore * Math.min(boostFactor, 1.25); // Cap at 25% boost
    }

    // Check for network + performance correlation
    const hasNetworkConcern = signals.some(
      (s) => s.category === CompositeSignalCategory.NETWORK && s.rawScore >= 50
    );
    const hasPerformanceConcern = signals.some(
      (s) => s.category === CompositeSignalCategory.PERFORMANCE && s.rawScore >= 50
    );

    if (hasNetworkConcern && hasPerformanceConcern) {
      return baseScore * 1.1; // 10% boost for correlated concerns
    }

    return baseScore;
  }

  private determineSuspicionLevel(score: number): CompositeSuspicionLevel {
    if (score >= this.config.thresholds.critical) return CompositeSuspicionLevel.CRITICAL;
    if (score >= this.config.thresholds.high) return CompositeSuspicionLevel.HIGH;
    if (score >= this.config.thresholds.medium) return CompositeSuspicionLevel.MEDIUM;
    if (score >= this.config.thresholds.low) return CompositeSuspicionLevel.LOW;
    return CompositeSuspicionLevel.NONE;
  }

  private aggregateRiskFlags(contributions: CompositeSignalContribution[]): RiskFlagSummary[] {
    const flagMap = new Map<string, { sources: SignalSource[]; severity: number }>();

    for (const contribution of contributions) {
      if (!contribution.available) continue;

      for (const flag of contribution.flags) {
        const existing = flagMap.get(flag);
        if (existing) {
          existing.sources.push(contribution.source);
          existing.severity = Math.max(existing.severity, contribution.rawScore);
        } else {
          flagMap.set(flag, {
            sources: [contribution.source],
            severity: contribution.rawScore,
          });
        }
      }
    }

    return Array.from(flagMap.entries())
      .map(([description, data]) => ({
        category: this.categorizeFlag(description),
        severity: data.severity,
        description,
        sources: data.sources,
      }))
      .sort((a, b) => b.severity - a.severity);
  }

  private calculateOverallDataQuality(contributions: CompositeSignalContribution[]): number {
    const availableSignals = contributions.filter((c) => c.available);
    if (availableSignals.length === 0) return 0;

    const totalQuality = availableSignals.reduce((sum, c) => sum + c.dataQuality, 0);
    const avgQuality = totalQuality / availableSignals.length;

    // Penalize for missing signals
    const availabilityFactor = availableSignals.length / contributions.length;

    return Math.round(avgQuality * availabilityFactor);
  }

  private generateSummary(
    score: number,
    level: CompositeSuspicionLevel,
    topSignals: CompositeSignalContribution[],
    riskFlags: RiskFlagSummary[]
  ): string[] {
    const summary: string[] = [];

    summary.push(`Composite suspicion score: ${score}/100 (${level})`);

    if (topSignals.length > 0) {
      const topContributor = topSignals[0]!;
      summary.push(
        `Top signal: ${topContributor.name} (${Math.round(topContributor.rawScore)}/100)`
      );
    }

    if (riskFlags.length > 0) {
      summary.push(`${riskFlags.length} risk flag(s) identified`);
    }

    if (level === CompositeSuspicionLevel.CRITICAL) {
      summary.push("CRITICAL: This wallet shows strong indicators of insider activity");
    } else if (level === CompositeSuspicionLevel.HIGH) {
      summary.push("HIGH SUSPICION: Multiple concerning patterns detected");
    }

    return summary;
  }

  private generateKeyFindings(
    contributions: CompositeSignalContribution[],
    underlyingResults: CompositeScoreResult["underlyingResults"]
  ): string[] {
    const findings: string[] = [];

    // Check for exceptional accuracy
    if (underlyingResults.accuracy?.isPotentialInsider) {
      findings.push("Exceptionally high prediction accuracy indicates possible informational advantage");
    }

    // Check for unusual win rate
    if (
      underlyingResults.winRate?.isPotentialInsider ||
      underlyingResults.winRate?.suspicionLevel === WinRateSuspicionLevel.CRITICAL
    ) {
      findings.push("Win rate significantly above market expectations");
    }

    // Check for sybil cluster membership
    if (underlyingResults.sybil?.isLikelySybil) {
      findings.push(`Likely part of sybil cluster with ${underlyingResults.sybil.relatedWallets.length} related wallets`);
    }

    // Check for coordinated trading
    if (underlyingResults.coordination?.isCoordinated) {
      findings.push(`Coordinated trading detected with ${underlyingResults.coordination.groupCount} group(s)`);
    }

    // Check for suspicious P&L
    if (underlyingResults.profitLoss?.isPotentialInsider) {
      findings.push("Exceptional returns suggest possible informational advantage");
    }

    // Add high-severity flags
    for (const contribution of contributions) {
      if (contribution.available && contribution.rawScore >= 80) {
        findings.push(`${contribution.name}: ${contribution.reason}`);
      }
    }

    return findings.slice(0, 10); // Limit to 10 key findings
  }

  // ============================================================================
  // Private: Helper Methods
  // ============================================================================

  private createUnavailableSignal(
    source: SignalSource,
    name: string,
    reason = "Data not available"
  ): CompositeSignalContribution {
    return {
      source,
      category: SIGNAL_CATEGORY_MAP[source],
      name,
      rawScore: 0,
      weight: this.getSignalWeight(source),
      weightedScore: 0,
      confidence: SignalConfidence.LOW,
      dataQuality: 0,
      available: false,
      reason,
      flags: [],
    };
  }

  private updateSignalAvailability(source: SignalSource, available: boolean): void {
    const stats = this.signalAvailability.get(source) ?? { available: 0, total: 0 };
    stats.total++;
    if (available) stats.available++;
    this.signalAvailability.set(source, stats);
  }

  private mapConfidenceLevel(level: ConfidenceLevel): SignalConfidence {
    switch (level) {
      case ConfidenceLevel.VERY_HIGH:
      case ConfidenceLevel.HIGH:
        return SignalConfidence.HIGH;
      case ConfidenceLevel.MODERATE:
        return SignalConfidence.MEDIUM;
      default:
        return SignalConfidence.LOW;
    }
  }

  private mapDataQualityToConfidence(quality: number): SignalConfidence {
    if (quality >= 80) return SignalConfidence.HIGH;
    if (quality >= 50) return SignalConfidence.MEDIUM;
    return SignalConfidence.LOW;
  }

  private mapSybilConfidenceToSignalConfidence(
    confidence: import("./sybil-attack-detector").SybilConfidence
  ): SignalConfidence {
    switch (confidence) {
      case "VERY_HIGH":
      case "HIGH":
        return SignalConfidence.HIGH;
      case "MEDIUM":
        return SignalConfidence.MEDIUM;
      default:
        return SignalConfidence.LOW;
    }
  }

  private mapCoordinationRiskToScore(risk: CoordinationRiskLevel, groupCount: number): number {
    let baseScore = 0;
    switch (risk) {
      case CoordinationRiskLevel.CRITICAL:
        baseScore = 90;
        break;
      case CoordinationRiskLevel.HIGH:
        baseScore = 70;
        break;
      case CoordinationRiskLevel.MEDIUM:
        baseScore = 50;
        break;
      case CoordinationRiskLevel.LOW:
        baseScore = 30;
        break;
      default:
        baseScore = 0;
    }

    // Boost for multiple groups
    if (groupCount > 1) {
      baseScore = Math.min(100, baseScore + (groupCount - 1) * 5);
    }

    return baseScore;
  }

  private mapPatternRiskToScore(riskFlags: PatternRiskFlag[]): number {
    if (riskFlags.length === 0) return 0;

    // High-risk flags
    const highRiskFlags = [
      PatternRiskFlag.INFO_ASYMMETRY,
      PatternRiskFlag.WASH_TRADING,
      PatternRiskFlag.PRE_NEWS_TRADING,
      PatternRiskFlag.COORDINATED_TRADING,
    ];

    const hasHighRisk = riskFlags.some((f) => highRiskFlags.includes(f));
    if (hasHighRisk) return 80;

    // Medium-risk flags
    const mediumRiskFlags = [
      PatternRiskFlag.UNUSUAL_TIMING,
      PatternRiskFlag.HIGH_RISK_CONCENTRATION,
      PatternRiskFlag.HIGH_WIN_RATE,
    ];

    const hasMediumRisk = riskFlags.some((f) => mediumRiskFlags.includes(f));
    if (hasMediumRisk) return 50;

    // Low-risk - just having any flags
    return 30;
  }

  private getCategoryName(category: CompositeSignalCategory): string {
    switch (category) {
      case CompositeSignalCategory.WALLET_PROFILE:
        return "Wallet Profile";
      case CompositeSignalCategory.PERFORMANCE:
        return "Performance";
      case CompositeSignalCategory.BEHAVIOR:
        return "Behavior";
      case CompositeSignalCategory.NETWORK:
        return "Network";
      default:
        return category;
    }
  }

  private categorizeFlag(flag: string): string {
    const lowerFlag = flag.toLowerCase();
    if (lowerFlag.includes("insider") || lowerFlag.includes("accuracy")) return "Insider Risk";
    if (lowerFlag.includes("sybil") || lowerFlag.includes("cluster")) return "Sybil Risk";
    if (lowerFlag.includes("coordinat")) return "Coordination";
    if (lowerFlag.includes("win") || lowerFlag.includes("profit")) return "Performance";
    if (lowerFlag.includes("timing")) return "Timing";
    if (lowerFlag.includes("size") || lowerFlag.includes("position")) return "Sizing";
    return "General";
  }

  private getWinRateReason(result: WinRateResult): string {
    const allTimeStats = result.windowStats.ALL_TIME;
    if (!allTimeStats) return "Win rate analysis completed";

    const winRate = allTimeStats.winRate * 100;
    if (winRate >= 80) return `Exceptionally high win rate (${winRate.toFixed(1)}%)`;
    if (winRate >= 65) return `Above average win rate (${winRate.toFixed(1)}%)`;
    return `Win rate ${winRate.toFixed(1)}% across ${result.totalPositions} positions`;
  }

  private getPnlReason(result: PnlResult): string {
    const { totalRealizedPnl, overallRoi } = result.aggregates;
    if (overallRoi >= 100) return `Exceptional returns (${overallRoi.toFixed(1)}% ROI)`;
    if (overallRoi >= 50) return `Strong returns (${overallRoi.toFixed(1)}% ROI)`;
    if (totalRealizedPnl > 0) return `Profitable trader ($${totalRealizedPnl.toFixed(0)} realized P&L)`;
    return "P&L analysis completed";
  }

  private getTimingReason(result: TimingPatternResult): string {
    if (result.suspicionLevel === TimingSuspicionLevel.CRITICAL) {
      return "Critical timing pattern anomalies detected";
    }
    if (result.suspicionLevel === TimingSuspicionLevel.HIGH) {
      return "Suspicious timing patterns identified";
    }
    return `Timing pattern: ${result.patternType}`;
  }

  private getSizingReason(result: SizingAnalysisResult): string {
    if (result.suspicionLevel === SizingSuspicionLevel.CRITICAL) {
      return "Critical position sizing anomalies detected";
    }
    return `Primary sizing pattern: ${result.primaryPattern}`;
  }

  private getSelectionReason(result: SelectionAnalysisResult): string {
    if (result.suspicionLevel === SelectionSuspicionLevel.CRITICAL) {
      return "Insider-like market selection pattern";
    }
    return `Market selection pattern: ${result.primaryPattern}`;
  }

  private getCoordinationReason(result: CoordinationAnalysisResult): string {
    if (!result.isCoordinated) return "No coordinated trading detected";
    return `Coordinated with ${result.connectedWallets.length} wallet(s) across ${result.groupCount} group(s)`;
  }

  private getAccuracyReason(result: AccuracyResult): string {
    const allTimeStats = result.windowStats.ALL_TIME;
    if (!allTimeStats) return "Accuracy analysis completed";

    const accuracy = allTimeStats.rawAccuracy * 100;
    if (accuracy >= 85) return `Exceptional prediction accuracy (${accuracy.toFixed(1)}%)`;
    if (accuracy >= 70) return `Very high prediction accuracy (${accuracy.toFixed(1)}%)`;
    return `Prediction accuracy ${accuracy.toFixed(1)}%`;
  }

  private maintainCacheSize(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private calculateCacheHitRate(): number {
    // This is a simplified metric - in production you'd want to track actual hits/misses
    return this.cache.size > 0 ? 0.5 : 0;
  }
}

// ============================================================================
// Factory Functions and Shared Instance
// ============================================================================

let sharedInstance: CompositeSuspicionScorer | null = null;

/**
 * Create a new composite suspicion scorer instance
 */
export function createCompositeSuspicionScorer(
  config?: Partial<CompositeSuspicionScorerConfig>
): CompositeSuspicionScorer {
  return new CompositeSuspicionScorer(config);
}

/**
 * Get or create the shared composite suspicion scorer instance
 */
export function getSharedCompositeSuspicionScorer(): CompositeSuspicionScorer {
  if (!sharedInstance) {
    sharedInstance = new CompositeSuspicionScorer();
  }
  return sharedInstance;
}

/**
 * Set the shared composite suspicion scorer instance
 */
export function setSharedCompositeSuspicionScorer(scorer: CompositeSuspicionScorer): void {
  sharedInstance = scorer;
}

/**
 * Reset the shared composite suspicion scorer instance
 */
export function resetSharedCompositeSuspicionScorer(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate composite suspicion score for a wallet using the shared instance
 */
export async function calculateCompositeSuspicionScore(
  walletAddress: string,
  options?: CompositeScoreOptions
): Promise<CompositeScoreResult> {
  return getSharedCompositeSuspicionScorer().calculateScore(walletAddress, options);
}

/**
 * Batch calculate composite suspicion scores
 */
export async function batchCalculateCompositeSuspicionScores(
  walletAddresses: string[],
  options?: CompositeScoreOptions
): Promise<BatchCompositeScoreResult> {
  return getSharedCompositeSuspicionScorer().batchCalculateScores(walletAddresses, options);
}

/**
 * Check if a wallet has high suspicion
 */
export async function hasHighSuspicion(
  walletAddress: string,
  threshold: number = 60
): Promise<boolean> {
  const result = await getSharedCompositeSuspicionScorer().calculateScore(walletAddress);
  return result.compositeScore >= threshold;
}

/**
 * Get high suspicion wallets from cache
 */
export function getHighSuspicionWallets(
  minLevel: CompositeSuspicionLevel = CompositeSuspicionLevel.HIGH
): CompositeScoreResult[] {
  return getSharedCompositeSuspicionScorer().getHighSuspicionWallets(minLevel);
}

/**
 * Get potential insiders from cache
 */
export function getPotentialInsiders(): CompositeScoreResult[] {
  return getSharedCompositeSuspicionScorer().getPotentialInsiders();
}

/**
 * Get composite scorer summary
 */
export function getCompositeScorerSummary(): CompositeScorerSummary {
  return getSharedCompositeSuspicionScorer().getSummary();
}

/**
 * Get suspicion level description
 */
export function getCompositeSuspicionLevelDescription(level: CompositeSuspicionLevel): string {
  switch (level) {
    case CompositeSuspicionLevel.NONE:
      return "Normal activity - no significant concerns";
    case CompositeSuspicionLevel.LOW:
      return "Minor concerns - worth monitoring";
    case CompositeSuspicionLevel.MEDIUM:
      return "Notable concerns - requires attention";
    case CompositeSuspicionLevel.HIGH:
      return "High suspicion - multiple red flags detected";
    case CompositeSuspicionLevel.CRITICAL:
      return "Critical - strong indicators of insider activity";
    default:
      return "Unknown";
  }
}

/**
 * Get signal category description
 */
export function getSignalCategoryDescription(category: CompositeSignalCategory): string {
  switch (category) {
    case CompositeSignalCategory.WALLET_PROFILE:
      return "Wallet characteristics including age, funding, and history";
    case CompositeSignalCategory.PERFORMANCE:
      return "Trading performance including win rate, accuracy, and P&L";
    case CompositeSignalCategory.BEHAVIOR:
      return "Behavioral patterns including timing, sizing, and selection";
    case CompositeSignalCategory.NETWORK:
      return "Network analysis including coordination and sybil detection";
    default:
      return "Unknown category";
  }
}

/**
 * Get signal source description
 */
export function getSignalSourceDescription(source: SignalSource): string {
  switch (source) {
    case SignalSource.FRESH_WALLET:
      return "Fresh wallet detection and analysis";
    case SignalSource.WIN_RATE:
      return "Historical win rate tracking";
    case SignalSource.PROFIT_LOSS:
      return "Profit and loss calculation";
    case SignalSource.TIMING_PATTERN:
      return "Trading timing pattern analysis";
    case SignalSource.POSITION_SIZING:
      return "Position sizing pattern analysis";
    case SignalSource.MARKET_SELECTION:
      return "Market selection pattern analysis";
    case SignalSource.COORDINATION:
      return "Coordinated trading detection";
    case SignalSource.SYBIL:
      return "Sybil attack detection";
    case SignalSource.ACCURACY:
      return "Historical prediction accuracy";
    case SignalSource.TRADING_PATTERN:
      return "Overall trading pattern classification";
    default:
      return "Unknown signal source";
  }
}
