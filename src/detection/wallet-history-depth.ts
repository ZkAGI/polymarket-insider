/**
 * Wallet History Depth Analyzer (DET-FRESH-009)
 *
 * Analyzes the depth of wallet transaction history across chains.
 * Deeper history suggests a more established wallet, while shallow
 * history may indicate a purpose-created wallet for specific activity.
 *
 * Features:
 * - Query transaction history across supported chains (Polygon)
 * - Count total transactions (normal, internal, ERC20)
 * - Analyze transaction type distribution
 * - Score history depth on 0-100 scale
 * - Batch processing for multiple wallets
 * - Caching for performance
 */

import { isAddress, getAddress } from "viem";
import {
  getWalletHistory,
  getInternalTransactions,
  getTransactionCount,
  type PolygonscanConfig,
  type WalletTransaction,
  type InternalTransaction,
} from "../api/chain";
import { FreshWalletAlertSeverity } from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Depth category classification based on transaction count and history length
 */
export enum HistoryDepthCategory {
  /** No transactions or very minimal history */
  NONE = "NONE",
  /** Very shallow history (1-10 transactions) */
  VERY_SHALLOW = "VERY_SHALLOW",
  /** Shallow history (11-50 transactions) */
  SHALLOW = "SHALLOW",
  /** Moderate history (51-200 transactions) */
  MODERATE = "MODERATE",
  /** Deep history (201-1000 transactions) */
  DEEP = "DEEP",
  /** Very deep history (1000+ transactions) */
  VERY_DEEP = "VERY_DEEP",
}

/**
 * Transaction type distribution
 */
export interface TransactionTypeDistribution {
  /** Normal/external transactions */
  normal: number;
  /** Internal/contract call transactions */
  internal: number;
  /** ERC20 token transfers */
  erc20: number;
  /** Total transaction count */
  total: number;
}

/**
 * Activity metrics over time
 */
export interface ActivityMetrics {
  /** First transaction timestamp */
  firstTransactionAt: Date | null;
  /** Most recent transaction timestamp */
  lastTransactionAt: Date | null;
  /** History span in days */
  historySpanDays: number | null;
  /** Average transactions per month (if history > 30 days) */
  avgTransactionsPerMonth: number | null;
  /** Whether there are gaps > 90 days in activity */
  hasLargeGaps: boolean;
  /** Number of unique contract interactions */
  uniqueContractsInteracted: number;
}

/**
 * Result of wallet history depth analysis
 */
export interface WalletHistoryDepthResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Transaction count by type */
  transactionCounts: TransactionTypeDistribution;

  /** Depth category classification */
  depthCategory: HistoryDepthCategory;

  /** Depth score from 0-100 (higher = deeper history) */
  depthScore: number;

  /** Activity metrics */
  activityMetrics: ActivityMetrics;

  /** Whether the wallet has sufficient history for analysis */
  hasSufficientHistory: boolean;

  /** Whether the history pattern is suspicious (shallow + high value activity) */
  isSuspicious: boolean;

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Factors contributing to the depth score */
  scoreFactors: DepthScoreFactor[];

  /** Whether result was from cache */
  fromCache: boolean;

  /** Timestamp when analysis was performed */
  analyzedAt: Date;
}

/**
 * Factor contributing to depth score
 */
export interface DepthScoreFactor {
  /** Factor name */
  name: string;
  /** Factor weight (0-1) */
  weight: number;
  /** Raw value */
  value: number;
  /** Normalized contribution to score (0-100 * weight) */
  contribution: number;
  /** Description of what this factor measures */
  description: string;
}

/**
 * Options for history depth analysis
 */
export interface HistoryDepthOptions {
  /** Maximum transactions to fetch per type (default: 1000) */
  maxTransactionsPerType?: number;

  /** Whether to include internal transactions (default: true) */
  includeInternalTransactions?: boolean;

  /** Whether to include ERC20 transfers (default: true) */
  includeErc20Transfers?: boolean;

  /** Custom Polygonscan configuration */
  polygonscanConfig?: PolygonscanConfig;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;
}

/**
 * Batch result for multiple wallet analyses
 */
export interface BatchHistoryDepthResult {
  /** Successful results by address */
  results: Map<string, WalletHistoryDepthResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful analyses */
  successCount: number;

  /** Number of failed analyses */
  errorCount: number;

  /** Number of wallets with shallow history */
  shallowHistoryCount: number;

  /** Number of wallets flagged as suspicious */
  suspiciousCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for history depth analysis
 */
export interface HistoryDepthSummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by depth category */
  byCategory: Record<HistoryDepthCategory, number>;

  /** Count by alert severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Average depth score */
  averageDepthScore: number | null;

  /** Median depth score */
  medianDepthScore: number | null;

  /** Percentage of wallets with shallow history */
  shallowHistoryPercentage: number;

  /** Percentage of suspicious wallets */
  suspiciousPercentage: number;

  /** Average transaction count */
  averageTransactionCount: number | null;
}

/**
 * Configuration for WalletHistoryDepthAnalyzer
 */
export interface WalletHistoryDepthAnalyzerConfig {
  /** Default max transactions per type */
  defaultMaxTransactionsPerType?: number;

  /** Cache TTL in milliseconds (default: 10 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Custom Polygonscan configuration */
  polygonscanConfig?: PolygonscanConfig;

  /** Custom depth thresholds */
  depthThresholds?: DepthThresholds;

  /** Custom score weights */
  scoreWeights?: DepthScoreWeights;
}

/**
 * Thresholds for depth category classification
 */
export interface DepthThresholds {
  /** Max transactions for VERY_SHALLOW (default: 10) */
  veryShallowMax: number;
  /** Max transactions for SHALLOW (default: 50) */
  shallowMax: number;
  /** Max transactions for MODERATE (default: 200) */
  moderateMax: number;
  /** Max transactions for DEEP (default: 1000) */
  deepMax: number;
}

/**
 * Weights for depth score calculation
 */
export interface DepthScoreWeights {
  /** Weight for transaction count factor (default: 0.35) */
  transactionCount: number;
  /** Weight for history span factor (default: 0.25) */
  historySpan: number;
  /** Weight for transaction variety factor (default: 0.15) */
  transactionVariety: number;
  /** Weight for contract interaction factor (default: 0.15) */
  contractInteraction: number;
  /** Weight for activity consistency factor (default: 0.10) */
  activityConsistency: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default max transactions per type */
const DEFAULT_MAX_TRANSACTIONS_PER_TYPE = 1000;

/** Default cache TTL: 10 minutes */
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/** Default depth thresholds */
export const DEFAULT_DEPTH_THRESHOLDS: DepthThresholds = {
  veryShallowMax: 10,
  shallowMax: 50,
  moderateMax: 200,
  deepMax: 1000,
};

/** Default score weights */
export const DEFAULT_SCORE_WEIGHTS: DepthScoreWeights = {
  transactionCount: 0.35,
  historySpan: 0.25,
  transactionVariety: 0.15,
  contractInteraction: 0.15,
  activityConsistency: 0.10,
};

/** Transaction count normalization constants */
const TX_COUNT_SCALE_FACTOR = 500; // Tx count at which score maxes out

/** History span normalization (days) */
const HISTORY_SPAN_SCALE_DAYS = 365; // 1 year = max span score

/** Large gap threshold (days) */
const LARGE_GAP_THRESHOLD_DAYS = 90;

// ============================================================================
// WalletHistoryDepthAnalyzer Class
// ============================================================================

/**
 * Analyzer for wallet transaction history depth
 */
export class WalletHistoryDepthAnalyzer {
  private readonly cache: Map<string, { result: WalletHistoryDepthResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly defaultMaxTransactions: number;
  private readonly depthThresholds: DepthThresholds;
  private readonly scoreWeights: DepthScoreWeights;
  private readonly polygonscanConfig?: PolygonscanConfig;

  constructor(config?: WalletHistoryDepthAnalyzerConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.defaultMaxTransactions = config?.defaultMaxTransactionsPerType ?? DEFAULT_MAX_TRANSACTIONS_PER_TYPE;
    this.depthThresholds = config?.depthThresholds ?? DEFAULT_DEPTH_THRESHOLDS;
    this.scoreWeights = config?.scoreWeights ?? DEFAULT_SCORE_WEIGHTS;
    this.polygonscanConfig = config?.polygonscanConfig;
  }

  /**
   * Analyze wallet history depth
   */
  async analyzeDepth(
    address: string,
    options: HistoryDepthOptions = {}
  ): Promise<WalletHistoryDepthResult> {
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
      maxTransactionsPerType = this.defaultMaxTransactions,
      includeInternalTransactions = true,
      includeErc20Transfers = true,
      polygonscanConfig = this.polygonscanConfig,
    } = options;

    // Fetch transaction data
    const [normalTxResult, internalTxs, erc20Count] = await Promise.all([
      this.fetchNormalTransactions(normalizedAddress, maxTransactionsPerType, polygonscanConfig),
      includeInternalTransactions
        ? this.fetchInternalTransactions(normalizedAddress, maxTransactionsPerType, polygonscanConfig)
        : Promise.resolve([]),
      includeErc20Transfers
        ? this.fetchErc20TransactionCount(normalizedAddress, maxTransactionsPerType, polygonscanConfig)
        : Promise.resolve(0),
    ]);

    const { transactions: normalTxs, totalCount: normalTotalCount } = normalTxResult;

    // Calculate transaction counts
    const transactionCounts: TransactionTypeDistribution = {
      normal: normalTotalCount,
      internal: internalTxs.length,
      erc20: erc20Count,
      total: normalTotalCount + internalTxs.length + erc20Count,
    };

    // Calculate activity metrics
    const activityMetrics = this.calculateActivityMetrics(normalTxs, internalTxs);

    // Calculate depth score and factors
    const { score: depthScore, factors: scoreFactors } = this.calculateDepthScore(
      transactionCounts,
      activityMetrics
    );

    // Classify depth category
    const depthCategory = this.classifyDepthCategory(transactionCounts.total);

    // Determine if history is sufficient
    const hasSufficientHistory = transactionCounts.total >= 5;

    // Determine if suspicious
    const isSuspicious = this.isSuspiciousPattern(
      depthCategory,
      transactionCounts,
      activityMetrics
    );

    // Determine severity
    const severity = this.determineSeverity(depthCategory, isSuspicious);

    const result: WalletHistoryDepthResult = {
      address: normalizedAddress,
      transactionCounts,
      depthCategory,
      depthScore,
      activityMetrics,
      hasSufficientHistory,
      isSuspicious,
      severity,
      scoreFactors,
      fromCache: false,
      analyzedAt: new Date(),
    };

    // Cache the result
    this.setCachedResult(normalizedAddress, result);

    return result;
  }

  /**
   * Analyze multiple wallets
   */
  async batchAnalyzeDepth(
    addresses: string[],
    options: HistoryDepthOptions = {}
  ): Promise<BatchHistoryDepthResult> {
    const startTime = Date.now();
    const results = new Map<string, WalletHistoryDepthResult>();
    const errors = new Map<string, string>();
    let shallowHistoryCount = 0;
    let suspiciousCount = 0;

    for (const address of addresses) {
      try {
        const result = await this.analyzeDepth(address, options);
        results.set(result.address, result);

        if (
          result.depthCategory === HistoryDepthCategory.NONE ||
          result.depthCategory === HistoryDepthCategory.VERY_SHALLOW ||
          result.depthCategory === HistoryDepthCategory.SHALLOW
        ) {
          shallowHistoryCount++;
        }
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
      shallowHistoryCount,
      suspiciousCount,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for analysis results
   */
  getSummary(results: WalletHistoryDepthResult[]): HistoryDepthSummary {
    const byCategory: Record<HistoryDepthCategory, number> = {
      [HistoryDepthCategory.NONE]: 0,
      [HistoryDepthCategory.VERY_SHALLOW]: 0,
      [HistoryDepthCategory.SHALLOW]: 0,
      [HistoryDepthCategory.MODERATE]: 0,
      [HistoryDepthCategory.DEEP]: 0,
      [HistoryDepthCategory.VERY_DEEP]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const depthScores: number[] = [];
    const transactionCounts: number[] = [];
    let shallowCount = 0;
    let suspiciousCount = 0;

    for (const result of results) {
      byCategory[result.depthCategory]++;
      bySeverity[result.severity]++;
      depthScores.push(result.depthScore);
      transactionCounts.push(result.transactionCounts.total);

      if (
        result.depthCategory === HistoryDepthCategory.NONE ||
        result.depthCategory === HistoryDepthCategory.VERY_SHALLOW ||
        result.depthCategory === HistoryDepthCategory.SHALLOW
      ) {
        shallowCount++;
      }
      if (result.isSuspicious) {
        suspiciousCount++;
      }
    }

    // Sort for median calculation
    depthScores.sort((a, b) => a - b);
    transactionCounts.sort((a, b) => a - b);

    const total = results.length;

    return {
      total,
      byCategory,
      bySeverity,
      averageDepthScore:
        depthScores.length > 0
          ? Math.round((depthScores.reduce((a, b) => a + b, 0) / depthScores.length) * 100) / 100
          : null,
      medianDepthScore:
        depthScores.length > 0
          ? depthScores.length % 2 === 0
            ? (depthScores[depthScores.length / 2 - 1]! + depthScores[depthScores.length / 2]!) / 2
            : depthScores[Math.floor(depthScores.length / 2)]!
          : null,
      shallowHistoryPercentage:
        total > 0 ? Math.round((shallowCount / total) * 10000) / 100 : 0,
      suspiciousPercentage:
        total > 0 ? Math.round((suspiciousCount / total) * 10000) / 100 : 0,
      averageTransactionCount:
        transactionCounts.length > 0
          ? Math.round(transactionCounts.reduce((a, b) => a + b, 0) / transactionCounts.length)
          : null,
    };
  }

  /**
   * Check if a wallet has shallow history
   */
  async hasShallowHistory(
    address: string,
    options?: HistoryDepthOptions
  ): Promise<boolean> {
    const result = await this.analyzeDepth(address, options);
    return (
      result.depthCategory === HistoryDepthCategory.NONE ||
      result.depthCategory === HistoryDepthCategory.VERY_SHALLOW ||
      result.depthCategory === HistoryDepthCategory.SHALLOW
    );
  }

  /**
   * Get the depth score for a wallet
   */
  async getDepthScore(
    address: string,
    options?: HistoryDepthOptions
  ): Promise<number> {
    const result = await this.analyzeDepth(address, options);
    return result.depthScore;
  }

  /**
   * Get the depth category for a wallet
   */
  async getDepthCategory(
    address: string,
    options?: HistoryDepthOptions
  ): Promise<HistoryDepthCategory> {
    const result = await this.analyzeDepth(address, options);
    return result.depthCategory;
  }

  /**
   * Get total transaction count for a wallet
   */
  async getTotalTransactionCount(
    address: string,
    options?: HistoryDepthOptions
  ): Promise<number> {
    const result = await this.analyzeDepth(address, options);
    return result.transactionCounts.total;
  }

  /**
   * Get depth thresholds
   */
  getDepthThresholds(): DepthThresholds {
    return { ...this.depthThresholds };
  }

  /**
   * Get score weights
   */
  getScoreWeights(): DepthScoreWeights {
    return { ...this.scoreWeights };
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
  // Private Methods
  // ==========================================================================

  /**
   * Fetch normal transactions
   */
  private async fetchNormalTransactions(
    address: string,
    maxTransactions: number,
    polygonscanConfig?: PolygonscanConfig
  ): Promise<{ transactions: WalletTransaction[]; totalCount: number }> {
    try {
      // Get transaction count first
      const totalCount = await getTransactionCount(address);

      // Fetch transactions
      const result = await getWalletHistory(address, {
        pageSize: Math.min(maxTransactions, 10000),
        sort: "desc",
        ...polygonscanConfig,
      });

      return {
        transactions: result.transactions,
        totalCount: Math.max(totalCount, result.transactions.length),
      };
    } catch {
      return { transactions: [], totalCount: 0 };
    }
  }

  /**
   * Fetch internal transactions
   */
  private async fetchInternalTransactions(
    address: string,
    maxTransactions: number,
    polygonscanConfig?: PolygonscanConfig
  ): Promise<InternalTransaction[]> {
    try {
      const transactions = await getInternalTransactions(address, {
        pageSize: Math.min(maxTransactions, 10000),
        sort: "desc",
        ...polygonscanConfig,
      });
      return transactions;
    } catch {
      return [];
    }
  }

  /**
   * Fetch ERC20 transaction count
   */
  private async fetchErc20TransactionCount(
    address: string,
    maxTransactions: number,
    polygonscanConfig?: PolygonscanConfig
  ): Promise<number> {
    try {
      const result = await getWalletHistory(address, {
        pageSize: Math.min(maxTransactions, 10000),
        txType: "erc20",
        sort: "desc",
        ...polygonscanConfig,
      });
      return result.transactions.length;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate activity metrics from transaction data
   */
  private calculateActivityMetrics(
    normalTxs: WalletTransaction[],
    internalTxs: InternalTransaction[]
  ): ActivityMetrics {
    // Combine all timestamps
    const allTimestamps: number[] = [
      ...normalTxs.map((tx) => tx.timestamp),
      ...internalTxs.map((tx) => tx.timestamp),
    ].sort((a, b) => a - b);

    if (allTimestamps.length === 0) {
      return {
        firstTransactionAt: null,
        lastTransactionAt: null,
        historySpanDays: null,
        avgTransactionsPerMonth: null,
        hasLargeGaps: false,
        uniqueContractsInteracted: 0,
      };
    }

    const firstTimestamp = allTimestamps[0]!;
    const lastTimestamp = allTimestamps[allTimestamps.length - 1]!;
    const firstTransactionAt = new Date(firstTimestamp * 1000);
    const lastTransactionAt = new Date(lastTimestamp * 1000);
    const historySpanDays = Math.floor((lastTimestamp - firstTimestamp) / (60 * 60 * 24));

    // Calculate average transactions per month
    let avgTransactionsPerMonth: number | null = null;
    if (historySpanDays >= 30) {
      const months = historySpanDays / 30;
      avgTransactionsPerMonth = Math.round((allTimestamps.length / months) * 100) / 100;
    }

    // Check for large gaps
    let hasLargeGaps = false;
    for (let i = 1; i < allTimestamps.length; i++) {
      const gapDays = (allTimestamps[i]! - allTimestamps[i - 1]!) / (60 * 60 * 24);
      if (gapDays > LARGE_GAP_THRESHOLD_DAYS) {
        hasLargeGaps = true;
        break;
      }
    }

    // Count unique contracts interacted with
    const uniqueContracts = new Set<string>();
    for (const tx of normalTxs) {
      if (tx.to && tx.input && tx.input !== "0x") {
        uniqueContracts.add(tx.to.toLowerCase());
      }
      if (tx.contractAddress) {
        uniqueContracts.add(tx.contractAddress.toLowerCase());
      }
    }

    return {
      firstTransactionAt,
      lastTransactionAt,
      historySpanDays,
      avgTransactionsPerMonth,
      hasLargeGaps,
      uniqueContractsInteracted: uniqueContracts.size,
    };
  }

  /**
   * Calculate depth score and contributing factors
   */
  private calculateDepthScore(
    counts: TransactionTypeDistribution,
    metrics: ActivityMetrics
  ): { score: number; factors: DepthScoreFactor[] } {
    const factors: DepthScoreFactor[] = [];

    // Factor 1: Transaction count (0-100, normalized by scale factor)
    const txCountRaw = Math.min(counts.total / TX_COUNT_SCALE_FACTOR, 1);
    const txCountContribution = txCountRaw * 100 * this.scoreWeights.transactionCount;
    factors.push({
      name: "transactionCount",
      weight: this.scoreWeights.transactionCount,
      value: counts.total,
      contribution: Math.round(txCountContribution * 100) / 100,
      description: `Total transactions (${counts.total}) - higher count indicates deeper history`,
    });

    // Factor 2: History span (0-100, normalized by 1 year)
    const historySpanRaw = metrics.historySpanDays
      ? Math.min(metrics.historySpanDays / HISTORY_SPAN_SCALE_DAYS, 1)
      : 0;
    const historySpanContribution = historySpanRaw * 100 * this.scoreWeights.historySpan;
    factors.push({
      name: "historySpan",
      weight: this.scoreWeights.historySpan,
      value: metrics.historySpanDays ?? 0,
      contribution: Math.round(historySpanContribution * 100) / 100,
      description: `History span (${metrics.historySpanDays ?? 0} days) - longer history indicates established wallet`,
    });

    // Factor 3: Transaction variety (internal + ERC20 vs only normal)
    const varietyRaw =
      counts.total > 0
        ? Math.min(
            ((counts.internal > 0 ? 0.4 : 0) +
              (counts.erc20 > 0 ? 0.4 : 0) +
              (counts.normal > 0 ? 0.2 : 0)),
            1
          )
        : 0;
    const varietyContribution = varietyRaw * 100 * this.scoreWeights.transactionVariety;
    factors.push({
      name: "transactionVariety",
      weight: this.scoreWeights.transactionVariety,
      value: varietyRaw,
      contribution: Math.round(varietyContribution * 100) / 100,
      description: "Transaction type variety - diverse transaction types indicate genuine usage",
    });

    // Factor 4: Contract interaction (0-100, based on unique contracts)
    const contractRaw = Math.min(metrics.uniqueContractsInteracted / 20, 1);
    const contractContribution = contractRaw * 100 * this.scoreWeights.contractInteraction;
    factors.push({
      name: "contractInteraction",
      weight: this.scoreWeights.contractInteraction,
      value: metrics.uniqueContractsInteracted,
      contribution: Math.round(contractContribution * 100) / 100,
      description: `Unique contracts (${metrics.uniqueContractsInteracted}) - more contract interactions indicate genuine usage`,
    });

    // Factor 5: Activity consistency (penalize large gaps, 0 if no transactions)
    const consistencyRaw = counts.total === 0 ? 0 : (metrics.hasLargeGaps ? 0.3 : 1);
    const consistencyContribution = consistencyRaw * 100 * this.scoreWeights.activityConsistency;
    factors.push({
      name: "activityConsistency",
      weight: this.scoreWeights.activityConsistency,
      value: consistencyRaw,
      contribution: Math.round(consistencyContribution * 100) / 100,
      description: metrics.hasLargeGaps
        ? "Large activity gaps detected - may indicate dormant periods"
        : "Consistent activity pattern",
    });

    // Calculate total score
    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);
    const normalizedScore = Math.round(totalScore * 100) / 100;

    return { score: normalizedScore, factors };
  }

  /**
   * Classify depth category based on transaction count
   */
  private classifyDepthCategory(totalTransactions: number): HistoryDepthCategory {
    if (totalTransactions === 0) {
      return HistoryDepthCategory.NONE;
    }
    if (totalTransactions <= this.depthThresholds.veryShallowMax) {
      return HistoryDepthCategory.VERY_SHALLOW;
    }
    if (totalTransactions <= this.depthThresholds.shallowMax) {
      return HistoryDepthCategory.SHALLOW;
    }
    if (totalTransactions <= this.depthThresholds.moderateMax) {
      return HistoryDepthCategory.MODERATE;
    }
    if (totalTransactions <= this.depthThresholds.deepMax) {
      return HistoryDepthCategory.DEEP;
    }
    return HistoryDepthCategory.VERY_DEEP;
  }

  /**
   * Determine if the history pattern is suspicious
   */
  private isSuspiciousPattern(
    category: HistoryDepthCategory,
    counts: TransactionTypeDistribution,
    metrics: ActivityMetrics
  ): boolean {
    // No history is not necessarily suspicious (might be new wallet)
    if (category === HistoryDepthCategory.NONE) {
      return false;
    }

    // Very shallow with no variety is suspicious
    if (
      category === HistoryDepthCategory.VERY_SHALLOW &&
      counts.internal === 0 &&
      counts.erc20 === 0
    ) {
      return true;
    }

    // Shallow history with only recent activity is suspicious
    if (
      category === HistoryDepthCategory.SHALLOW &&
      metrics.historySpanDays !== null &&
      metrics.historySpanDays < 7
    ) {
      return true;
    }

    // Large gap followed by sudden activity is suspicious
    if (
      metrics.hasLargeGaps &&
      (category === HistoryDepthCategory.VERY_SHALLOW ||
        category === HistoryDepthCategory.SHALLOW)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(
    category: HistoryDepthCategory,
    isSuspicious: boolean
  ): FreshWalletAlertSeverity {
    // Suspicious patterns get elevated severity
    if (isSuspicious) {
      switch (category) {
        case HistoryDepthCategory.VERY_SHALLOW:
          return FreshWalletAlertSeverity.HIGH;
        case HistoryDepthCategory.SHALLOW:
          return FreshWalletAlertSeverity.HIGH;
        default:
          return FreshWalletAlertSeverity.MEDIUM;
      }
    }

    // Non-suspicious based on category
    switch (category) {
      case HistoryDepthCategory.NONE:
        return FreshWalletAlertSeverity.MEDIUM;
      case HistoryDepthCategory.VERY_SHALLOW:
        return FreshWalletAlertSeverity.MEDIUM;
      case HistoryDepthCategory.SHALLOW:
        return FreshWalletAlertSeverity.LOW;
      case HistoryDepthCategory.MODERATE:
      case HistoryDepthCategory.DEEP:
      case HistoryDepthCategory.VERY_DEEP:
        return FreshWalletAlertSeverity.LOW;
    }
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): WalletHistoryDepthResult | null {
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
  private setCachedResult(address: string, result: WalletHistoryDepthResult): void {
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

let sharedAnalyzer: WalletHistoryDepthAnalyzer | null = null;

/**
 * Create a new WalletHistoryDepthAnalyzer instance
 */
export function createWalletHistoryDepthAnalyzer(
  config?: WalletHistoryDepthAnalyzerConfig
): WalletHistoryDepthAnalyzer {
  return new WalletHistoryDepthAnalyzer(config);
}

/**
 * Get the shared WalletHistoryDepthAnalyzer instance
 */
export function getSharedWalletHistoryDepthAnalyzer(): WalletHistoryDepthAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new WalletHistoryDepthAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared WalletHistoryDepthAnalyzer instance
 */
export function setSharedWalletHistoryDepthAnalyzer(analyzer: WalletHistoryDepthAnalyzer): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared WalletHistoryDepthAnalyzer instance
 */
export function resetSharedWalletHistoryDepthAnalyzer(): void {
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze wallet history depth (convenience function)
 */
export async function analyzeWalletHistoryDepth(
  address: string,
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<WalletHistoryDepthResult> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.analyzeDepth(address, options);
}

/**
 * Analyze multiple wallets history depth (convenience function)
 */
export async function batchAnalyzeWalletHistoryDepth(
  addresses: string[],
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<BatchHistoryDepthResult> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.batchAnalyzeDepth(addresses, options);
}

/**
 * Check if a wallet has shallow history (convenience function)
 */
export async function hasShallowWalletHistory(
  address: string,
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<boolean> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.hasShallowHistory(address, options);
}

/**
 * Get wallet history depth score (convenience function)
 */
export async function getWalletHistoryDepthScore(
  address: string,
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<number> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.getDepthScore(address, options);
}

/**
 * Get wallet history depth category (convenience function)
 */
export async function getWalletHistoryDepthCategory(
  address: string,
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<HistoryDepthCategory> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.getDepthCategory(address, options);
}

/**
 * Get wallet total transaction count (convenience function)
 */
export async function getWalletTotalTransactionCount(
  address: string,
  options?: HistoryDepthOptions & { analyzer?: WalletHistoryDepthAnalyzer }
): Promise<number> {
  const analyzer = options?.analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return analyzer.getTotalTransactionCount(address, options);
}

/**
 * Get history depth summary for multiple results (convenience function)
 */
export function getHistoryDepthSummary(
  results: WalletHistoryDepthResult[],
  analyzer?: WalletHistoryDepthAnalyzer
): HistoryDepthSummary {
  const anal = analyzer ?? getSharedWalletHistoryDepthAnalyzer();
  return anal.getSummary(results);
}
