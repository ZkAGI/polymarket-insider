/**
 * Fresh Wallet Confidence Scorer (DET-FRESH-008)
 *
 * Score likelihood that fresh wallet activity is suspicious by combining
 * multiple detection signals into a single confidence score.
 *
 * Features:
 * - Combine multiple signals from all fresh wallet detectors
 * - Weight signals by importance
 * - Normalize to 0-100 scale
 * - Provide confidence breakdown
 * - Batch processing for multiple wallets
 */

import { isAddress, getAddress } from "viem";

import {
  FreshWalletAlertSeverity,
  type FreshWalletConfigManager,
} from "./fresh-wallet-config";
import {
  AgeCategory,
  getSharedWalletAgeCalculator,
  type WalletAgeCalculator,
  type WalletAgeResult,
} from "./wallet-age";
import {
  TradingHistoryStatus,
  WalletHistoryType,
  getSharedZeroHistoryDetector,
  type ZeroHistoryDetector,
  type ZeroHistoryCheckResult,
} from "./zero-history";
import {
  FirstTradeSizeCategory,
  getSharedFirstTradeSizeAnalyzer,
  type FirstTradeSizeAnalyzer,
  type FirstTradeSizeResult,
} from "./first-trade-size";
import {
  FundingPatternType,
  FundingTimingCategory,
  getSharedFundingPatternAnalyzer,
  type FundingPatternAnalyzer,
  type FundingPatternResult,
} from "./funding-pattern";
import {
  ClusterConfidenceLevel,
  getSharedFreshWalletClusterAnalyzer,
  type FreshWalletClusterAnalyzer,
  type WalletClusteringResult,
} from "./fresh-wallet-clustering";
import {
  ReactivationStatus,
  DormancySeverity,
  ActivityPatternType,
  getSharedWalletReactivationDetector,
  type WalletReactivationDetector,
  type WalletReactivationResult,
} from "./wallet-reactivation";
import { type ClobClient } from "../api/clob/client";

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence level classification
 */
export enum ConfidenceLevel {
  /** Very low suspicion (0-20) */
  VERY_LOW = "VERY_LOW",
  /** Low suspicion (20-40) */
  LOW = "LOW",
  /** Moderate suspicion (40-60) */
  MODERATE = "MODERATE",
  /** High suspicion (60-80) */
  HIGH = "HIGH",
  /** Very high suspicion (80-100) */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Individual signal contribution to the confidence score
 */
export interface SignalContribution {
  /** Signal source identifier */
  signalId: string;

  /** Human-readable signal name */
  name: string;

  /** Raw score from the signal (0-100) */
  rawScore: number;

  /** Weight applied to this signal (0-1) */
  weight: number;

  /** Weighted contribution to final score */
  weightedScore: number;

  /** Brief explanation of why this signal contributed */
  reason: string;

  /** Whether this signal was available/applicable */
  available: boolean;
}

/**
 * Category of signals
 */
export enum SignalCategory {
  /** Wallet age and history signals */
  WALLET_AGE = "WALLET_AGE",
  /** Trading behavior signals */
  TRADING_BEHAVIOR = "TRADING_BEHAVIOR",
  /** Funding pattern signals */
  FUNDING_PATTERN = "FUNDING_PATTERN",
  /** Cluster/coordination signals */
  COORDINATION = "COORDINATION",
  /** Activity pattern signals */
  ACTIVITY_PATTERN = "ACTIVITY_PATTERN",
}

/**
 * Signal breakdown by category
 */
export interface SignalCategoryBreakdown {
  /** Category identifier */
  category: SignalCategory;

  /** Category name */
  name: string;

  /** Aggregate score for this category (0-100) */
  score: number;

  /** Weight of this category in final score */
  weight: number;

  /** Individual signals in this category */
  signals: SignalContribution[];
}

/**
 * Confidence score result for a wallet
 */
export interface FreshWalletConfidenceResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Overall confidence score (0-100) */
  confidenceScore: number;

  /** Confidence level classification */
  confidenceLevel: ConfidenceLevel;

  /** Equivalent alert severity */
  severity: FreshWalletAlertSeverity;

  /** Whether the wallet is flagged as suspicious */
  isSuspicious: boolean;

  /** Breakdown by signal category */
  categoryBreakdown: SignalCategoryBreakdown[];

  /** All individual signal contributions */
  signalContributions: SignalContribution[];

  /** Top contributing signals (sorted by weighted score) */
  topSignals: SignalContribution[];

  /** Summary of key findings */
  summary: string[];

  /** Underlying analysis results */
  underlyingResults: {
    walletAge: WalletAgeResult | null;
    zeroHistory: ZeroHistoryCheckResult | null;
    firstTradeSize: FirstTradeSizeResult | null;
    fundingPattern: FundingPatternResult | null;
    clustering: WalletClusteringResult | null;
    reactivation: WalletReactivationResult | null;
  };

  /** Whether result was from cache */
  fromCache: boolean;

  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Options for confidence scoring
 */
export interface ConfidenceScorerOptions {
  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Custom wallet age calculator */
  ageCalculator?: WalletAgeCalculator;

  /** Custom zero history detector */
  zeroHistoryDetector?: ZeroHistoryDetector;

  /** Custom first trade size analyzer */
  firstTradeSizeAnalyzer?: FirstTradeSizeAnalyzer;

  /** Custom funding pattern analyzer */
  fundingPatternAnalyzer?: FundingPatternAnalyzer;

  /** Custom cluster analyzer */
  clusterAnalyzer?: FreshWalletClusterAnalyzer;

  /** Custom reactivation detector */
  reactivationDetector?: WalletReactivationDetector;

  /** Related addresses for clustering analysis */
  relatedAddresses?: string[];

  /** Custom signal weights */
  signalWeights?: Partial<SignalWeights>;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;

  /** Skip specific signals */
  skipSignals?: SignalCategory[];
}

/**
 * Signal weights configuration
 */
export interface SignalWeights {
  /** Weight for wallet age category (default: 0.20) */
  walletAge: number;

  /** Weight for trading behavior category (default: 0.20) */
  tradingBehavior: number;

  /** Weight for funding pattern category (default: 0.25) */
  fundingPattern: number;

  /** Weight for coordination/clustering category (default: 0.20) */
  coordination: number;

  /** Weight for activity pattern category (default: 0.15) */
  activityPattern: number;
}

/**
 * Batch result for multiple wallet scores
 */
export interface BatchConfidenceResult {
  /** Successful results by address */
  results: Map<string, FreshWalletConfidenceResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful analyses */
  successCount: number;

  /** Number of failed analyses */
  errorCount: number;

  /** Count by confidence level */
  byConfidenceLevel: Record<ConfidenceLevel, number>;

  /** Count flagged as suspicious */
  suspiciousCount: number;

  /** Average confidence score */
  averageConfidenceScore: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for confidence scoring
 */
export interface ConfidenceSummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by confidence level */
  byConfidenceLevel: Record<ConfidenceLevel, number>;

  /** Count by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Percentage flagged as suspicious */
  suspiciousPercentage: number;

  /** Average confidence score */
  averageScore: number;

  /** Median confidence score */
  medianScore: number | null;

  /** Most common top signal */
  mostCommonTopSignal: string | null;

  /** Distribution of top signals */
  topSignalDistribution: Record<string, number>;
}

/**
 * Configuration for FreshWalletConfidenceScorer
 */
export interface FreshWalletConfidenceScorerConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 500) */
  maxCacheSize?: number;

  /** Default signal weights */
  signalWeights?: Partial<SignalWeights>;

  /** Threshold for suspicious classification (default: 60) */
  suspiciousThreshold?: number;

  /** Custom dependencies */
  configManager?: FreshWalletConfigManager;
  ageCalculator?: WalletAgeCalculator;
  zeroHistoryDetector?: ZeroHistoryDetector;
  firstTradeSizeAnalyzer?: FirstTradeSizeAnalyzer;
  fundingPatternAnalyzer?: FundingPatternAnalyzer;
  clusterAnalyzer?: FreshWalletClusterAnalyzer;
  reactivationDetector?: WalletReactivationDetector;
  clobClient?: ClobClient;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 500;

/** Default suspicious threshold */
const DEFAULT_SUSPICIOUS_THRESHOLD = 60;

/** Default signal weights - should sum to 1 */
export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  walletAge: 0.20,
  tradingBehavior: 0.20,
  fundingPattern: 0.25,
  coordination: 0.20,
  activityPattern: 0.15,
};

/** Number of top signals to include in result */
const TOP_SIGNALS_COUNT = 5;

// ============================================================================
// FreshWalletConfidenceScorer Class
// ============================================================================

/**
 * Scorer for combining fresh wallet detection signals into a confidence score
 */
export class FreshWalletConfidenceScorer {
  private readonly cache: Map<string, { result: FreshWalletConfidenceResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly signalWeights: SignalWeights;
  private readonly suspiciousThreshold: number;
  private readonly ageCalculator: WalletAgeCalculator;
  private readonly zeroHistoryDetector: ZeroHistoryDetector;
  private readonly firstTradeSizeAnalyzer: FirstTradeSizeAnalyzer;
  private readonly fundingPatternAnalyzer: FundingPatternAnalyzer;
  private readonly clusterAnalyzer: FreshWalletClusterAnalyzer;
  private readonly reactivationDetector: WalletReactivationDetector;
  private readonly clobClient?: ClobClient;

  constructor(config?: FreshWalletConfidenceScorerConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.signalWeights = {
      ...DEFAULT_SIGNAL_WEIGHTS,
      ...config?.signalWeights,
    };
    this.suspiciousThreshold = config?.suspiciousThreshold ?? DEFAULT_SUSPICIOUS_THRESHOLD;
    this.ageCalculator = config?.ageCalculator ?? getSharedWalletAgeCalculator();
    this.zeroHistoryDetector = config?.zeroHistoryDetector ?? getSharedZeroHistoryDetector();
    this.firstTradeSizeAnalyzer = config?.firstTradeSizeAnalyzer ?? getSharedFirstTradeSizeAnalyzer();
    this.fundingPatternAnalyzer = config?.fundingPatternAnalyzer ?? getSharedFundingPatternAnalyzer();
    this.clusterAnalyzer = config?.clusterAnalyzer ?? getSharedFreshWalletClusterAnalyzer();
    this.reactivationDetector = config?.reactivationDetector ?? getSharedWalletReactivationDetector();
    this.clobClient = config?.clobClient;
  }

  /**
   * Score a wallet's fresh wallet suspicion confidence
   */
  async scoreWallet(
    address: string,
    options: ConfidenceScorerOptions = {}
  ): Promise<FreshWalletConfidenceResult> {
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

    const skipSignals = options.skipSignals ?? [];

    // Gather all underlying analysis results in parallel
    const [
      walletAge,
      zeroHistory,
      firstTradeSize,
      fundingPattern,
      clustering,
      reactivation,
    ] = await Promise.all([
      this.fetchWalletAge(normalizedAddress, options, skipSignals),
      this.fetchZeroHistory(normalizedAddress, options, skipSignals),
      this.fetchFirstTradeSize(normalizedAddress, options, skipSignals),
      this.fetchFundingPattern(normalizedAddress, options, skipSignals),
      this.fetchClustering(normalizedAddress, options, skipSignals),
      this.fetchReactivation(normalizedAddress, options, skipSignals),
    ]);

    // Build signal contributions
    const signalContributions = this.buildSignalContributions(
      walletAge,
      zeroHistory,
      firstTradeSize,
      fundingPattern,
      clustering,
      reactivation,
      options.signalWeights
    );

    // Build category breakdown
    const categoryBreakdown = this.buildCategoryBreakdown(signalContributions, options.signalWeights);

    // Calculate final confidence score
    const confidenceScore = this.calculateFinalScore(categoryBreakdown);

    // Determine confidence level
    const confidenceLevel = this.getConfidenceLevel(confidenceScore);

    // Determine severity
    const severity = this.getSeverity(confidenceScore);

    // Get top signals
    const topSignals = this.getTopSignals(signalContributions);

    // Generate summary
    const summary = this.generateSummary(
      confidenceScore,
      topSignals,
      walletAge,
      zeroHistory,
      firstTradeSize,
      fundingPattern,
      clustering,
      reactivation
    );

    const result: FreshWalletConfidenceResult = {
      address: normalizedAddress,
      confidenceScore,
      confidenceLevel,
      severity,
      isSuspicious: confidenceScore >= this.suspiciousThreshold,
      categoryBreakdown,
      signalContributions,
      topSignals,
      summary,
      underlyingResults: {
        walletAge,
        zeroHistory,
        firstTradeSize,
        fundingPattern,
        clustering,
        reactivation,
      },
      fromCache: false,
      analyzedAt: new Date(),
    };

    // Cache the result
    this.setCachedResult(normalizedAddress, result);

    return result;
  }

  /**
   * Score multiple wallets
   */
  async scoreWallets(
    addresses: string[],
    options: ConfidenceScorerOptions = {}
  ): Promise<BatchConfidenceResult> {
    const startTime = Date.now();
    const results = new Map<string, FreshWalletConfidenceResult>();
    const errors = new Map<string, string>();
    let suspiciousCount = 0;
    let totalScore = 0;

    const byConfidenceLevel: Record<ConfidenceLevel, number> = {
      [ConfidenceLevel.VERY_LOW]: 0,
      [ConfidenceLevel.LOW]: 0,
      [ConfidenceLevel.MODERATE]: 0,
      [ConfidenceLevel.HIGH]: 0,
      [ConfidenceLevel.VERY_HIGH]: 0,
    };

    for (const address of addresses) {
      try {
        const result = await this.scoreWallet(address, options);
        results.set(result.address, result);

        byConfidenceLevel[result.confidenceLevel]++;
        totalScore += result.confidenceScore;

        if (result.isSuspicious) {
          suspiciousCount++;
        }
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
      byConfidenceLevel,
      suspiciousCount,
      averageConfidenceScore: results.size > 0 ? Math.round((totalScore / results.size) * 100) / 100 : 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for batch results
   */
  getSummary(results: FreshWalletConfidenceResult[]): ConfidenceSummary {
    const byConfidenceLevel: Record<ConfidenceLevel, number> = {
      [ConfidenceLevel.VERY_LOW]: 0,
      [ConfidenceLevel.LOW]: 0,
      [ConfidenceLevel.MODERATE]: 0,
      [ConfidenceLevel.HIGH]: 0,
      [ConfidenceLevel.VERY_HIGH]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const scores: number[] = [];
    const topSignalCounts: Record<string, number> = {};
    let suspiciousCount = 0;

    for (const result of results) {
      byConfidenceLevel[result.confidenceLevel]++;
      bySeverity[result.severity]++;
      scores.push(result.confidenceScore);

      if (result.isSuspicious) {
        suspiciousCount++;
      }

      // Track top signal distribution
      if (result.topSignals.length > 0) {
        const topSignal = result.topSignals[0]!.signalId;
        topSignalCounts[topSignal] = (topSignalCounts[topSignal] ?? 0) + 1;
      }
    }

    // Calculate median
    scores.sort((a, b) => a - b);
    const medianScore = scores.length > 0
      ? scores.length % 2 === 0
        ? (scores[scores.length / 2 - 1]! + scores[scores.length / 2]!) / 2
        : scores[Math.floor(scores.length / 2)]!
      : null;

    // Find most common top signal
    let mostCommonTopSignal: string | null = null;
    let maxCount = 0;
    for (const [signal, count] of Object.entries(topSignalCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonTopSignal = signal;
      }
    }

    const total = results.length;

    return {
      total,
      byConfidenceLevel,
      bySeverity,
      suspiciousPercentage: total > 0 ? Math.round((suspiciousCount / total) * 10000) / 100 : 0,
      averageScore: total > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / total) * 100) / 100
        : 0,
      medianScore: medianScore !== null ? Math.round(medianScore * 100) / 100 : null,
      mostCommonTopSignal,
      topSignalDistribution: topSignalCounts,
    };
  }

  /**
   * Get the suspicious threshold
   */
  getSuspiciousThreshold(): number {
    return this.suspiciousThreshold;
  }

  /**
   * Get current signal weights
   */
  getSignalWeights(): SignalWeights {
    return { ...this.signalWeights };
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

  // ==========================================================================
  // Private Methods - Data Fetching
  // ==========================================================================

  private async fetchWalletAge(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<WalletAgeResult | null> {
    if (skipSignals.includes(SignalCategory.WALLET_AGE)) {
      return null;
    }

    try {
      const calculator = options.ageCalculator ?? this.ageCalculator;
      return await calculator.calculateAge(address);
    } catch {
      return null;
    }
  }

  private async fetchZeroHistory(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<ZeroHistoryCheckResult | null> {
    if (skipSignals.includes(SignalCategory.TRADING_BEHAVIOR)) {
      return null;
    }

    try {
      const detector = options.zeroHistoryDetector ?? this.zeroHistoryDetector;
      return await detector.checkWallet(address, {
        clobClient: options.clobClient ?? this.clobClient,
        bypassCache: options.bypassCache,
      });
    } catch {
      return null;
    }
  }

  private async fetchFirstTradeSize(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<FirstTradeSizeResult | null> {
    if (skipSignals.includes(SignalCategory.TRADING_BEHAVIOR)) {
      return null;
    }

    try {
      const analyzer = options.firstTradeSizeAnalyzer ?? this.firstTradeSizeAnalyzer;
      return await analyzer.analyzeWallet(address, {
        clobClient: options.clobClient ?? this.clobClient,
        bypassCache: options.bypassCache,
      });
    } catch {
      return null;
    }
  }

  private async fetchFundingPattern(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<FundingPatternResult | null> {
    if (skipSignals.includes(SignalCategory.FUNDING_PATTERN)) {
      return null;
    }

    try {
      const analyzer = options.fundingPatternAnalyzer ?? this.fundingPatternAnalyzer;
      return await analyzer.analyzeWallet(address, {
        clobClient: options.clobClient ?? this.clobClient,
        bypassCache: options.bypassCache,
      });
    } catch {
      return null;
    }
  }

  private async fetchClustering(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<WalletClusteringResult | null> {
    if (skipSignals.includes(SignalCategory.COORDINATION)) {
      return null;
    }

    try {
      const analyzer = options.clusterAnalyzer ?? this.clusterAnalyzer;
      const relatedAddresses = options.relatedAddresses ?? [];
      return await analyzer.analyzeWallet(address, relatedAddresses, {
        clobClient: options.clobClient ?? this.clobClient,
        bypassCache: options.bypassCache,
      });
    } catch {
      return null;
    }
  }

  private async fetchReactivation(
    address: string,
    options: ConfidenceScorerOptions,
    skipSignals: SignalCategory[]
  ): Promise<WalletReactivationResult | null> {
    if (skipSignals.includes(SignalCategory.ACTIVITY_PATTERN)) {
      return null;
    }

    try {
      const detector = options.reactivationDetector ?? this.reactivationDetector;
      return await detector.checkWallet(address, {
        clobClient: options.clobClient ?? this.clobClient,
        bypassCache: options.bypassCache,
      });
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Private Methods - Signal Building
  // ==========================================================================

  private buildSignalContributions(
    walletAge: WalletAgeResult | null,
    zeroHistory: ZeroHistoryCheckResult | null,
    firstTradeSize: FirstTradeSizeResult | null,
    fundingPattern: FundingPatternResult | null,
    clustering: WalletClusteringResult | null,
    reactivation: WalletReactivationResult | null,
    customWeights?: Partial<SignalWeights>
  ): SignalContribution[] {
    const weights = { ...this.signalWeights, ...customWeights };
    const signals: SignalContribution[] = [];

    // === Wallet Age Signals ===
    signals.push(...this.buildWalletAgeSignals(walletAge, weights.walletAge));

    // === Trading Behavior Signals ===
    signals.push(...this.buildTradingBehaviorSignals(zeroHistory, firstTradeSize, weights.tradingBehavior));

    // === Funding Pattern Signals ===
    signals.push(...this.buildFundingPatternSignals(fundingPattern, weights.fundingPattern));

    // === Coordination Signals ===
    signals.push(...this.buildCoordinationSignals(clustering, weights.coordination));

    // === Activity Pattern Signals ===
    signals.push(...this.buildActivityPatternSignals(reactivation, weights.activityPattern));

    return signals;
  }

  private buildWalletAgeSignals(
    walletAge: WalletAgeResult | null,
    categoryWeight: number
  ): SignalContribution[] {
    const signals: SignalContribution[] = [];

    if (!walletAge) {
      signals.push({
        signalId: "wallet_age_unknown",
        name: "Wallet Age Unknown",
        rawScore: 50,
        weight: categoryWeight,
        weightedScore: 50 * categoryWeight,
        reason: "Could not determine wallet age",
        available: false,
      });
      return signals;
    }

    // Age category signal
    let ageScore = 0;
    let ageReason = "";
    switch (walletAge.category) {
      case AgeCategory.NEW:
        ageScore = 100;
        ageReason = "Brand new wallet with no on-chain history";
        break;
      case AgeCategory.VERY_FRESH:
        ageScore = 85;
        ageReason = `Wallet is only ${walletAge.ageInDays ?? 0} days old (very fresh)`;
        break;
      case AgeCategory.FRESH:
        ageScore = 60;
        ageReason = `Wallet is ${walletAge.ageInDays ?? 0} days old (fresh)`;
        break;
      case AgeCategory.RECENT:
        ageScore = 35;
        ageReason = `Wallet is ${walletAge.ageInDays ?? 0} days old (recent)`;
        break;
      case AgeCategory.ESTABLISHED:
        ageScore = 15;
        ageReason = `Wallet is ${walletAge.ageInDays ?? 0} days old (established)`;
        break;
      case AgeCategory.MATURE:
        ageScore = 5;
        ageReason = `Wallet is ${walletAge.ageInDays ?? 0} days old (mature)`;
        break;
    }

    signals.push({
      signalId: "wallet_age_category",
      name: "Wallet Age",
      rawScore: ageScore,
      weight: categoryWeight * 0.6,
      weightedScore: ageScore * categoryWeight * 0.6,
      reason: ageReason,
      available: true,
    });

    // Fresh wallet flag
    signals.push({
      signalId: "wallet_is_fresh",
      name: "Fresh Wallet Flag",
      rawScore: walletAge.isFresh ? 80 : 10,
      weight: categoryWeight * 0.4,
      weightedScore: (walletAge.isFresh ? 80 : 10) * categoryWeight * 0.4,
      reason: walletAge.isFresh
        ? "Wallet is classified as fresh"
        : "Wallet is not classified as fresh",
      available: true,
    });

    return signals;
  }

  private buildTradingBehaviorSignals(
    zeroHistory: ZeroHistoryCheckResult | null,
    firstTradeSize: FirstTradeSizeResult | null,
    categoryWeight: number
  ): SignalContribution[] {
    const signals: SignalContribution[] = [];

    // Zero history signals
    if (zeroHistory) {
      let historyScore = 0;
      let historyReason = "";

      switch (zeroHistory.status) {
        case TradingHistoryStatus.NEVER_TRADED:
          historyScore = 90;
          historyReason = "Wallet has never traded on Polymarket";
          break;
        case TradingHistoryStatus.FIRST_TRADE:
          historyScore = 75;
          historyReason = "This is the wallet's first Polymarket trade";
          break;
        case TradingHistoryStatus.MINIMAL_HISTORY:
          historyScore = 50;
          historyReason = `Wallet has minimal trading history (${zeroHistory.polymarketTradeCount} trades)`;
          break;
        case TradingHistoryStatus.HAS_HISTORY:
          historyScore = 15;
          historyReason = `Wallet has established trading history (${zeroHistory.polymarketTradeCount} trades)`;
          break;
      }

      signals.push({
        signalId: "trading_history_status",
        name: "Trading History",
        rawScore: historyScore,
        weight: categoryWeight * 0.4,
        weightedScore: historyScore * categoryWeight * 0.4,
        reason: historyReason,
        available: true,
      });

      // History type signal
      let historyTypeScore = 0;
      let historyTypeReason = "";

      switch (zeroHistory.historyType) {
        case WalletHistoryType.NEW_EVERYWHERE:
          historyTypeScore = 95;
          historyTypeReason = "New to blockchain AND new to Polymarket";
          break;
        case WalletHistoryType.BLOCKCHAIN_NEW_PM_ACTIVE:
          historyTypeScore = 70;
          historyTypeReason = "New blockchain wallet but active on Polymarket";
          break;
        case WalletHistoryType.BLOCKCHAIN_VETERAN_PM_NEW:
          historyTypeScore = 40;
          historyTypeReason = "Established on blockchain but new to Polymarket";
          break;
        case WalletHistoryType.ESTABLISHED:
          historyTypeScore = 10;
          historyTypeReason = "Established on both blockchain and Polymarket";
          break;
      }

      signals.push({
        signalId: "history_type",
        name: "Wallet History Type",
        rawScore: historyTypeScore,
        weight: categoryWeight * 0.3,
        weightedScore: historyTypeScore * categoryWeight * 0.3,
        reason: historyTypeReason,
        available: true,
      });
    } else {
      signals.push({
        signalId: "trading_history_unknown",
        name: "Trading History",
        rawScore: 50,
        weight: categoryWeight * 0.7,
        weightedScore: 50 * categoryWeight * 0.7,
        reason: "Could not determine trading history",
        available: false,
      });
    }

    // First trade size signals
    if (firstTradeSize && firstTradeSize.hasTrades) {
      let sizeScore = 0;
      let sizeReason = "";

      switch (firstTradeSize.sizeCategory) {
        case FirstTradeSizeCategory.OUTLIER:
          sizeScore = 100;
          sizeReason = `First trade is an outlier (${firstTradeSize.flagReasons.join("; ")})`;
          break;
        case FirstTradeSizeCategory.VERY_LARGE:
          sizeScore = 80;
          sizeReason = `First trade is very large (${firstTradeSize.multipleOfAverage?.toFixed(1)}x average)`;
          break;
        case FirstTradeSizeCategory.LARGE:
          sizeScore = 55;
          sizeReason = `First trade is large (${firstTradeSize.percentile?.toFixed(0)}th percentile)`;
          break;
        case FirstTradeSizeCategory.NORMAL:
          sizeScore = 20;
          sizeReason = "First trade size is normal";
          break;
        case FirstTradeSizeCategory.SMALL:
          sizeScore = 10;
          sizeReason = "First trade size is small";
          break;
      }

      signals.push({
        signalId: "first_trade_size",
        name: "First Trade Size",
        rawScore: sizeScore,
        weight: categoryWeight * 0.3,
        weightedScore: sizeScore * categoryWeight * 0.3,
        reason: sizeReason,
        available: true,
      });
    } else {
      signals.push({
        signalId: "first_trade_size_unknown",
        name: "First Trade Size",
        rawScore: 30,
        weight: categoryWeight * 0.3,
        weightedScore: 30 * categoryWeight * 0.3,
        reason: firstTradeSize ? "No trades to analyze" : "Could not analyze first trade",
        available: false,
      });
    }

    return signals;
  }

  private buildFundingPatternSignals(
    fundingPattern: FundingPatternResult | null,
    categoryWeight: number
  ): SignalContribution[] {
    const signals: SignalContribution[] = [];

    if (!fundingPattern) {
      signals.push({
        signalId: "funding_pattern_unknown",
        name: "Funding Pattern",
        rawScore: 40,
        weight: categoryWeight,
        weightedScore: 40 * categoryWeight,
        reason: "Could not analyze funding pattern",
        available: false,
      });
      return signals;
    }

    // Pattern type signal
    let patternScore = 0;
    let patternReason = "";

    switch (fundingPattern.patternType) {
      case FundingPatternType.SUSPICIOUS:
        patternScore = 100;
        patternReason = "Suspicious funding pattern detected";
        break;
      case FundingPatternType.FLASH:
        patternScore = 85;
        patternReason = "Flash funding pattern (immediate trading after funding)";
        break;
      case FundingPatternType.IMMEDIATE:
        patternScore = 65;
        patternReason = "Immediate trading pattern after funding";
        break;
      case FundingPatternType.QUICK:
        patternScore = 40;
        patternReason = "Quick trading pattern after funding";
        break;
      case FundingPatternType.NORMAL:
        patternScore = 10;
        patternReason = "Normal funding pattern";
        break;
    }

    signals.push({
      signalId: "funding_pattern_type",
      name: "Funding Pattern Type",
      rawScore: patternScore,
      weight: categoryWeight * 0.35,
      weightedScore: patternScore * categoryWeight * 0.35,
      reason: patternReason,
      available: true,
    });

    // Timing category signal
    let timingScore = 0;
    let timingReason = "";

    switch (fundingPattern.timingCategory) {
      case FundingTimingCategory.FLASH:
        timingScore = 100;
        timingReason = "Trading within 5 minutes of funding";
        break;
      case FundingTimingCategory.VERY_FAST:
        timingScore = 75;
        timingReason = "Trading within 1 hour of funding";
        break;
      case FundingTimingCategory.FAST:
        timingScore = 50;
        timingReason = "Trading within 24 hours of funding";
        break;
      case FundingTimingCategory.MODERATE:
        timingScore = 25;
        timingReason = "Trading within 7 days of funding";
        break;
      case FundingTimingCategory.SLOW:
        timingScore = 10;
        timingReason = "Trading more than 7 days after funding";
        break;
      case FundingTimingCategory.NO_TRADES:
        timingScore = 30;
        timingReason = "No trades yet after funding";
        break;
    }

    signals.push({
      signalId: "funding_timing",
      name: "Funding-to-Trade Timing",
      rawScore: timingScore,
      weight: categoryWeight * 0.30,
      weightedScore: timingScore * categoryWeight * 0.30,
      reason: timingReason,
      available: true,
    });

    // Funding risk summary signal
    const riskSummary = fundingPattern.fundingRiskSummary;
    let riskScore = 0;
    const riskReasons: string[] = [];

    if (riskSummary.hasSanctionedSources) {
      riskScore += 50;
      riskReasons.push("Has sanctioned funding sources");
    }
    if (riskSummary.hasMixerSources) {
      riskScore += 30;
      riskReasons.push("Has mixer/privacy tool funding sources");
    }
    if (riskSummary.unknownPercentage > 80) {
      riskScore += 20;
      riskReasons.push(`${riskSummary.unknownPercentage}% from unknown sources`);
    }
    if (riskScore === 0) {
      riskReasons.push("No high-risk funding sources detected");
    }

    signals.push({
      signalId: "funding_source_risk",
      name: "Funding Source Risk",
      rawScore: Math.min(100, riskScore),
      weight: categoryWeight * 0.35,
      weightedScore: Math.min(100, riskScore) * categoryWeight * 0.35,
      reason: riskReasons.join("; "),
      available: true,
    });

    return signals;
  }

  private buildCoordinationSignals(
    clustering: WalletClusteringResult | null,
    categoryWeight: number
  ): SignalContribution[] {
    const signals: SignalContribution[] = [];

    if (!clustering) {
      signals.push({
        signalId: "coordination_unknown",
        name: "Coordination Analysis",
        rawScore: 30,
        weight: categoryWeight,
        weightedScore: 30 * categoryWeight,
        reason: "Could not analyze wallet coordination",
        available: false,
      });
      return signals;
    }

    // Coordination score signal
    signals.push({
      signalId: "coordination_score",
      name: "Coordination Score",
      rawScore: clustering.coordinationScore,
      weight: categoryWeight * 0.5,
      weightedScore: clustering.coordinationScore * categoryWeight * 0.5,
      reason: clustering.coordinationScore >= 60
        ? `High coordination score (${clustering.coordinationScore})`
        : clustering.coordinationScore >= 30
          ? `Moderate coordination score (${clustering.coordinationScore})`
          : `Low coordination score (${clustering.coordinationScore})`,
      available: true,
    });

    // Cluster membership signal
    let clusterScore = 0;
    let clusterReason = "";

    if (clustering.clusterCount === 0) {
      clusterScore = 10;
      clusterReason = "Not part of any detected cluster";
    } else {
      clusterScore = Math.min(100, 30 + clustering.clusterCount * 20);
      clusterReason = `Part of ${clustering.clusterCount} cluster(s)`;
    }

    signals.push({
      signalId: "cluster_membership",
      name: "Cluster Membership",
      rawScore: clusterScore,
      weight: categoryWeight * 0.3,
      weightedScore: clusterScore * categoryWeight * 0.3,
      reason: clusterReason,
      available: true,
    });

    // Cluster confidence signal
    let confidenceScore = 0;
    let confidenceReason = "";

    switch (clustering.confidenceLevel) {
      case ClusterConfidenceLevel.VERY_HIGH:
        confidenceScore = 100;
        confidenceReason = "Very high cluster confidence";
        break;
      case ClusterConfidenceLevel.HIGH:
        confidenceScore = 75;
        confidenceReason = "High cluster confidence";
        break;
      case ClusterConfidenceLevel.MEDIUM:
        confidenceScore = 50;
        confidenceReason = "Medium cluster confidence";
        break;
      case ClusterConfidenceLevel.LOW:
        confidenceScore = 25;
        confidenceReason = "Low cluster confidence";
        break;
      case ClusterConfidenceLevel.VERY_LOW:
        confidenceScore = 10;
        confidenceReason = "Very low cluster confidence";
        break;
    }

    signals.push({
      signalId: "cluster_confidence",
      name: "Cluster Confidence",
      rawScore: confidenceScore,
      weight: categoryWeight * 0.2,
      weightedScore: confidenceScore * categoryWeight * 0.2,
      reason: confidenceReason,
      available: true,
    });

    return signals;
  }

  private buildActivityPatternSignals(
    reactivation: WalletReactivationResult | null,
    categoryWeight: number
  ): SignalContribution[] {
    const signals: SignalContribution[] = [];

    if (!reactivation) {
      signals.push({
        signalId: "activity_pattern_unknown",
        name: "Activity Pattern",
        rawScore: 30,
        weight: categoryWeight,
        weightedScore: 30 * categoryWeight,
        reason: "Could not analyze activity pattern",
        available: false,
      });
      return signals;
    }

    // Reactivation status signal
    let statusScore = 0;
    let statusReason = "";

    switch (reactivation.status) {
      case ReactivationStatus.JUST_REACTIVATED:
        statusScore = 85;
        statusReason = "Wallet just reactivated after dormancy";
        break;
      case ReactivationStatus.RECENTLY_REACTIVATED:
        statusScore = 65;
        statusReason = "Wallet recently reactivated after dormancy";
        break;
      case ReactivationStatus.DORMANT:
        statusScore = 40;
        statusReason = "Wallet is currently dormant";
        break;
      case ReactivationStatus.NEVER_DORMANT:
        statusScore = 10;
        statusReason = "Wallet has never been dormant";
        break;
      case ReactivationStatus.NO_HISTORY:
        statusScore = 50;
        statusReason = "No trading history to analyze";
        break;
    }

    signals.push({
      signalId: "reactivation_status",
      name: "Reactivation Status",
      rawScore: statusScore,
      weight: categoryWeight * 0.4,
      weightedScore: statusScore * categoryWeight * 0.4,
      reason: statusReason,
      available: true,
    });

    // Suspicious reactivation signal
    if (reactivation.isSuspicious) {
      signals.push({
        signalId: "suspicious_reactivation",
        name: "Suspicious Reactivation",
        rawScore: 90,
        weight: categoryWeight * 0.35,
        weightedScore: 90 * categoryWeight * 0.35,
        reason: "Reactivation pattern is flagged as suspicious",
        available: true,
      });
    } else {
      signals.push({
        signalId: "suspicious_reactivation",
        name: "Suspicious Reactivation",
        rawScore: 15,
        weight: categoryWeight * 0.35,
        weightedScore: 15 * categoryWeight * 0.35,
        reason: "Reactivation pattern is not suspicious",
        available: true,
      });
    }

    // Dormancy severity signal (if applicable)
    if (reactivation.reactivationEvent) {
      let dormancyScore = 0;
      let dormancyReason = "";

      switch (reactivation.reactivationEvent.dormancySeverity) {
        case DormancySeverity.EXTENDED:
          dormancyScore = 100;
          dormancyReason = `Extended dormancy (${reactivation.reactivationEvent.dormancyDays} days)`;
          break;
        case DormancySeverity.LONG:
          dormancyScore = 75;
          dormancyReason = `Long dormancy (${reactivation.reactivationEvent.dormancyDays} days)`;
          break;
        case DormancySeverity.MEDIUM:
          dormancyScore = 50;
          dormancyReason = `Medium dormancy (${reactivation.reactivationEvent.dormancyDays} days)`;
          break;
        case DormancySeverity.SHORT:
          dormancyScore = 25;
          dormancyReason = `Short dormancy (${reactivation.reactivationEvent.dormancyDays} days)`;
          break;
      }

      signals.push({
        signalId: "dormancy_severity",
        name: "Dormancy Severity",
        rawScore: dormancyScore,
        weight: categoryWeight * 0.25,
        weightedScore: dormancyScore * categoryWeight * 0.25,
        reason: dormancyReason,
        available: true,
      });

      // Activity pattern after reactivation
      let activityPatternScore = 0;
      let activityPatternReason = "";

      switch (reactivation.reactivationEvent.activityPattern) {
        case ActivityPatternType.BURST:
          activityPatternScore = 85;
          activityPatternReason = "Burst of activity after reactivation";
          break;
        case ActivityPatternType.SINGLE_SHOT:
          activityPatternScore = 60;
          activityPatternReason = "Single activity after dormancy";
          break;
        case ActivityPatternType.SPORADIC:
          activityPatternScore = 40;
          activityPatternReason = "Sporadic activity pattern";
          break;
        case ActivityPatternType.REGULAR:
          activityPatternScore = 15;
          activityPatternReason = "Regular activity pattern";
          break;
      }

      // Only add if we have room in the weight
      const remainingWeight = categoryWeight * 0.25;
      if (remainingWeight > 0) {
        signals.push({
          signalId: "activity_pattern_type",
          name: "Activity Pattern Type",
          rawScore: activityPatternScore,
          weight: remainingWeight / 2,
          weightedScore: activityPatternScore * remainingWeight / 2,
          reason: activityPatternReason,
          available: true,
        });
      }
    } else {
      signals.push({
        signalId: "dormancy_severity",
        name: "Dormancy Severity",
        rawScore: 20,
        weight: categoryWeight * 0.25,
        weightedScore: 20 * categoryWeight * 0.25,
        reason: "No dormancy period detected",
        available: true,
      });
    }

    return signals;
  }

  // ==========================================================================
  // Private Methods - Score Calculation
  // ==========================================================================

  private buildCategoryBreakdown(
    signals: SignalContribution[],
    customWeights?: Partial<SignalWeights>
  ): SignalCategoryBreakdown[] {
    const weights = { ...this.signalWeights, ...customWeights };

    const categoryMap: Record<SignalCategory, SignalContribution[]> = {
      [SignalCategory.WALLET_AGE]: [],
      [SignalCategory.TRADING_BEHAVIOR]: [],
      [SignalCategory.FUNDING_PATTERN]: [],
      [SignalCategory.COORDINATION]: [],
      [SignalCategory.ACTIVITY_PATTERN]: [],
    };

    // Categorize signals
    for (const signal of signals) {
      if (signal.signalId.startsWith("wallet_age") || signal.signalId.startsWith("wallet_is")) {
        categoryMap[SignalCategory.WALLET_AGE].push(signal);
      } else if (
        signal.signalId.startsWith("trading") ||
        signal.signalId.startsWith("history") ||
        signal.signalId.startsWith("first_trade")
      ) {
        categoryMap[SignalCategory.TRADING_BEHAVIOR].push(signal);
      } else if (signal.signalId.startsWith("funding")) {
        categoryMap[SignalCategory.FUNDING_PATTERN].push(signal);
      } else if (
        signal.signalId.startsWith("coordination") ||
        signal.signalId.startsWith("cluster")
      ) {
        categoryMap[SignalCategory.COORDINATION].push(signal);
      } else {
        categoryMap[SignalCategory.ACTIVITY_PATTERN].push(signal);
      }
    }

    const categoryNames: Record<SignalCategory, string> = {
      [SignalCategory.WALLET_AGE]: "Wallet Age & History",
      [SignalCategory.TRADING_BEHAVIOR]: "Trading Behavior",
      [SignalCategory.FUNDING_PATTERN]: "Funding Pattern",
      [SignalCategory.COORDINATION]: "Coordination & Clustering",
      [SignalCategory.ACTIVITY_PATTERN]: "Activity Pattern",
    };

    const categoryWeights: Record<SignalCategory, number> = {
      [SignalCategory.WALLET_AGE]: weights.walletAge,
      [SignalCategory.TRADING_BEHAVIOR]: weights.tradingBehavior,
      [SignalCategory.FUNDING_PATTERN]: weights.fundingPattern,
      [SignalCategory.COORDINATION]: weights.coordination,
      [SignalCategory.ACTIVITY_PATTERN]: weights.activityPattern,
    };

    return Object.entries(categoryMap).map(([category, categorySignals]) => {
      const cat = category as SignalCategory;
      const availableSignals = categorySignals.filter((s) => s.available);
      const totalWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0);
      const totalWeightedScore = availableSignals.reduce((sum, s) => sum + s.weightedScore, 0);

      // Calculate category score as weighted average
      // totalWeightedScore is already rawScore * weight, so dividing by totalWeight gives average rawScore
      const categoryScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

      return {
        category: cat,
        name: categoryNames[cat],
        score: Math.round(categoryScore * 100) / 100,
        weight: categoryWeights[cat],
        signals: categorySignals,
      };
    });
  }

  private calculateFinalScore(categoryBreakdown: SignalCategoryBreakdown[]): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const category of categoryBreakdown) {
      totalWeightedScore += category.score * category.weight;
      totalWeight += category.weight;
    }

    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    return Math.round(Math.min(100, Math.max(0, finalScore)) * 100) / 100;
  }

  private getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 80) return ConfidenceLevel.VERY_HIGH;
    if (score >= 60) return ConfidenceLevel.HIGH;
    if (score >= 40) return ConfidenceLevel.MODERATE;
    if (score >= 20) return ConfidenceLevel.LOW;
    return ConfidenceLevel.VERY_LOW;
  }

  private getSeverity(score: number): FreshWalletAlertSeverity {
    if (score >= 80) return FreshWalletAlertSeverity.CRITICAL;
    if (score >= 60) return FreshWalletAlertSeverity.HIGH;
    if (score >= 40) return FreshWalletAlertSeverity.MEDIUM;
    return FreshWalletAlertSeverity.LOW;
  }

  private getTopSignals(signals: SignalContribution[]): SignalContribution[] {
    return [...signals]
      .filter((s) => s.available && s.weightedScore > 0)
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, TOP_SIGNALS_COUNT);
  }

  private generateSummary(
    confidenceScore: number,
    topSignals: SignalContribution[],
    walletAge: WalletAgeResult | null,
    zeroHistory: ZeroHistoryCheckResult | null,
    firstTradeSize: FirstTradeSizeResult | null,
    fundingPattern: FundingPatternResult | null,
    clustering: WalletClusteringResult | null,
    reactivation: WalletReactivationResult | null
  ): string[] {
    const summary: string[] = [];

    // Overall assessment
    if (confidenceScore >= 80) {
      summary.push("Very high suspicion of fresh wallet activity");
    } else if (confidenceScore >= 60) {
      summary.push("High suspicion of fresh wallet activity");
    } else if (confidenceScore >= 40) {
      summary.push("Moderate suspicion of fresh wallet activity");
    } else if (confidenceScore >= 20) {
      summary.push("Low suspicion of fresh wallet activity");
    } else {
      summary.push("Very low suspicion - wallet appears established");
    }

    // Key findings
    if (walletAge?.category === AgeCategory.NEW) {
      summary.push("Brand new wallet with no on-chain history");
    } else if (walletAge?.isFresh) {
      summary.push(`Wallet is fresh (${walletAge.ageInDays ?? 0} days old)`);
    }

    if (zeroHistory?.status === TradingHistoryStatus.NEVER_TRADED) {
      summary.push("First-time Polymarket trader");
    } else if (zeroHistory?.status === TradingHistoryStatus.FIRST_TRADE) {
      summary.push("Making first Polymarket trade");
    }

    if (firstTradeSize?.isOutlier) {
      summary.push("First trade is unusually large");
    }

    if (fundingPattern?.patternType === FundingPatternType.SUSPICIOUS) {
      summary.push("Suspicious funding pattern detected");
    } else if (fundingPattern?.timingCategory === FundingTimingCategory.FLASH) {
      summary.push("Flash trading after funding");
    }

    if (clustering && clustering.clusterCount > 0) {
      summary.push(`Part of ${clustering.clusterCount} coordinated cluster(s)`);
    }

    if (reactivation?.isSuspicious) {
      summary.push("Suspicious reactivation after dormancy");
    }

    // Top signal
    if (topSignals.length > 0) {
      summary.push(`Top signal: ${topSignals[0]!.name}`);
    }

    return summary;
  }

  // ==========================================================================
  // Private Methods - Cache
  // ==========================================================================

  private getCachedResult(address: string): FreshWalletConfidenceResult | null {
    const cached = this.cache.get(address);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(address: string, result: FreshWalletConfidenceResult): void {
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

let sharedScorer: FreshWalletConfidenceScorer | null = null;

/**
 * Create a new FreshWalletConfidenceScorer instance
 */
export function createFreshWalletConfidenceScorer(
  config?: FreshWalletConfidenceScorerConfig
): FreshWalletConfidenceScorer {
  return new FreshWalletConfidenceScorer(config);
}

/**
 * Get the shared FreshWalletConfidenceScorer instance
 */
export function getSharedFreshWalletConfidenceScorer(): FreshWalletConfidenceScorer {
  if (!sharedScorer) {
    sharedScorer = new FreshWalletConfidenceScorer();
  }
  return sharedScorer;
}

/**
 * Set the shared FreshWalletConfidenceScorer instance
 */
export function setSharedFreshWalletConfidenceScorer(scorer: FreshWalletConfidenceScorer): void {
  sharedScorer = scorer;
}

/**
 * Reset the shared FreshWalletConfidenceScorer instance
 */
export function resetSharedFreshWalletConfidenceScorer(): void {
  sharedScorer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Score a wallet's fresh wallet suspicion (convenience function)
 */
export async function scoreFreshWalletConfidence(
  address: string,
  options?: ConfidenceScorerOptions & { scorer?: FreshWalletConfidenceScorer }
): Promise<FreshWalletConfidenceResult> {
  const scorer = options?.scorer ?? getSharedFreshWalletConfidenceScorer();
  return scorer.scoreWallet(address, options);
}

/**
 * Score multiple wallets (convenience function)
 */
export async function batchScoreFreshWalletConfidence(
  addresses: string[],
  options?: ConfidenceScorerOptions & { scorer?: FreshWalletConfidenceScorer }
): Promise<BatchConfidenceResult> {
  const scorer = options?.scorer ?? getSharedFreshWalletConfidenceScorer();
  return scorer.scoreWallets(addresses, options);
}

/**
 * Check if a wallet is suspicious based on confidence score (convenience function)
 */
export async function isFreshWalletSuspicious(
  address: string,
  threshold?: number,
  options?: ConfidenceScorerOptions & { scorer?: FreshWalletConfidenceScorer }
): Promise<boolean> {
  const scorer = options?.scorer ?? getSharedFreshWalletConfidenceScorer();
  const result = await scorer.scoreWallet(address, options);
  const effectiveThreshold = threshold ?? scorer.getSuspiciousThreshold();
  return result.confidenceScore >= effectiveThreshold;
}

/**
 * Get confidence summary for results (convenience function)
 */
export function getConfidenceSummary(
  results: FreshWalletConfidenceResult[],
  scorer?: FreshWalletConfidenceScorer
): ConfidenceSummary {
  const s = scorer ?? getSharedFreshWalletConfidenceScorer();
  return s.getSummary(results);
}
