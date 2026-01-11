/**
 * Fresh Wallet Clustering (DET-FRESH-006)
 *
 * Detect multiple fresh wallets potentially controlled by same entity.
 * This helps identify coordinated trading activity, sybil attacks, and wash trading.
 *
 * Features:
 * - Identify similar funding sources
 * - Detect coordinated creation times
 * - Cluster by trading patterns
 * - Calculate cluster confidence
 * - Multi-factor clustering combining above signals
 * - Batch processing for efficient analysis
 */

import { isAddress, getAddress } from "viem";
import {
  type FundingAnalysis,
  getSharedFundingSourceTracker,
  type FundingSourceTracker,
} from "../api/chain/funding-source";
import { type ClobClient } from "../api/clob/client";
import { getAllTradesByWallet } from "../api/clob/trades";
import { type Trade } from "../api/clob/types";
import {
  type WalletAgeResult,
  getSharedWalletAgeCalculator,
  type WalletAgeCalculator,
} from "./wallet-age";
import {
  FreshWalletAlertSeverity,
  getSharedFreshWalletConfigManager,
  type FreshWalletConfigManager,
} from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of cluster based on the primary signal
 */
export enum ClusterType {
  /** Wallets sharing funding sources */
  FUNDING_SOURCE = "FUNDING_SOURCE",
  /** Wallets created around the same time */
  TEMPORAL = "TEMPORAL",
  /** Wallets with similar trading patterns */
  TRADING_PATTERN = "TRADING_PATTERN",
  /** Multi-factor cluster (combines multiple signals) */
  MULTI_FACTOR = "MULTI_FACTOR",
}

/**
 * Confidence level for cluster assignment
 */
export enum ClusterConfidenceLevel {
  /** Very high confidence (>90%) */
  VERY_HIGH = "VERY_HIGH",
  /** High confidence (70-90%) */
  HIGH = "HIGH",
  /** Medium confidence (50-70%) */
  MEDIUM = "MEDIUM",
  /** Low confidence (30-50%) */
  LOW = "LOW",
  /** Very low confidence (<30%) */
  VERY_LOW = "VERY_LOW",
}

/**
 * Characteristic shared by wallets in a cluster
 */
export interface ClusterCharacteristic {
  /** Type of characteristic */
  type: "funding_source" | "creation_time" | "trading_pattern" | "market_focus";

  /** Description of the characteristic */
  description: string;

  /** Addresses that share this characteristic */
  addresses: string[];

  /** Strength of the signal (0-100) */
  signalStrength: number;
}

/**
 * A cluster of related wallets
 */
export interface WalletCluster {
  /** Unique cluster ID */
  clusterId: string;

  /** Cluster type based on primary signal */
  clusterType: ClusterType;

  /** Member wallet addresses */
  members: string[];

  /** Number of members in the cluster */
  memberCount: number;

  /** Common characteristics shared by members */
  commonCharacteristics: ClusterCharacteristic[];

  /** Confidence score for cluster validity (0-100) */
  confidence: number;

  /** Confidence level classification */
  confidenceLevel: ClusterConfidenceLevel;

  /** When the cluster was first detected */
  detectedAt: Date;

  /** Alert severity for this cluster */
  severity: FreshWalletAlertSeverity;

  /** Reasons why this cluster was flagged */
  flagReasons: string[];
}

/**
 * Funding source cluster - wallets sharing same funding sources
 */
export interface FundingSourceCluster {
  /** Shared funding source address */
  sourceAddress: string;

  /** Name of the source (e.g., "Binance") */
  sourceName: string | null;

  /** Wallets funded by this source */
  fundedWallets: string[];

  /** Total amount from this source to all wallets */
  totalAmount: bigint;

  /** Formatted total amount */
  formattedTotalAmount: string;

  /** Percentage of wallet funding from this source */
  fundingConcentration: number;

  /** Whether source is suspicious (mixer, unknown, etc.) */
  isSuspicious: boolean;
}

/**
 * Temporal cluster - wallets created around the same time
 */
export interface TemporalCluster {
  /** Start of the time window */
  windowStart: Date;

  /** End of the time window */
  windowEnd: Date;

  /** Duration in hours */
  windowDurationHours: number;

  /** Wallets created in this window */
  wallets: string[];

  /** Average interval between creations (seconds) */
  averageIntervalSeconds: number;

  /** Suspicion score based on timing patterns */
  timingSuspicionScore: number;
}

/**
 * Trading pattern metrics for a wallet
 */
export interface TradingPatternMetrics {
  /** Wallet address */
  address: string;

  /** Total number of trades */
  tradeCount: number;

  /** Total volume traded */
  totalVolume: number;

  /** Average trade size */
  averageTradeSize: number;

  /** Markets traded on (condition IDs) */
  markets: string[];

  /** Unique market count */
  marketCount: number;

  /** Buy ratio (0-1) */
  buyRatio: number;

  /** Average time between trades (seconds) */
  averageTimeBetweenTrades: number;

  /** Trading hour distribution (0-23) */
  tradingHourDistribution: number[];

  /** First trade timestamp */
  firstTradeTimestamp: number | null;

  /** Last trade timestamp */
  lastTradeTimestamp: number | null;
}

/**
 * Trading pattern cluster - wallets with similar trading behavior
 */
export interface TradingPatternCluster {
  /** Trading pattern signature */
  patternSignature: string;

  /** Wallets in this cluster */
  wallets: string[];

  /** Shared markets between wallets */
  sharedMarkets: string[];

  /** Average pattern similarity (0-1) */
  averageSimilarity: number;

  /** Pattern metrics for members */
  memberMetrics: TradingPatternMetrics[];
}

/**
 * Result of clustering analysis for a single wallet
 */
export interface WalletClusteringResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Cluster IDs this wallet belongs to */
  clusterIds: string[];

  /** Number of clusters this wallet is part of */
  clusterCount: number;

  /** Cluster confidence for each cluster */
  clusterConfidences: Record<string, number>;

  /** Funding source clusters */
  fundingSourceClusters: FundingSourceCluster[];

  /** Temporal cluster (if any) */
  temporalCluster: TemporalCluster | null;

  /** Trading pattern cluster (if any) */
  tradingPatternCluster: TradingPatternCluster | null;

  /** Overall cluster confidence (0-100) */
  overallClusterConfidence: number;

  /** Overall confidence level */
  confidenceLevel: ClusterConfidenceLevel;

  /** Coordination score - likelihood of coordinated activity (0-100) */
  coordinationScore: number;

  /** Alert severity */
  severity: FreshWalletAlertSeverity;

  /** Reasons for flagging */
  flagReasons: string[];

  /** Whether result was from cache */
  fromCache: boolean;

  /** When analysis was performed */
  analyzedAt: Date;
}

/**
 * Batch clustering result
 */
export interface BatchClusteringResult {
  /** Individual wallet results */
  results: Map<string, WalletClusteringResult>;

  /** Errors by address */
  errors: Map<string, string>;

  /** All identified clusters */
  clusters: WalletCluster[];

  /** Total wallets processed */
  totalProcessed: number;

  /** Successful analyses */
  successCount: number;

  /** Failed analyses */
  errorCount: number;

  /** Wallets that belong to at least one cluster */
  clusteredWalletCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for clustering analysis
 */
export interface ClusteringSummary {
  /** Total wallets analyzed */
  totalWallets: number;

  /** Number of wallets in clusters */
  clusteredWallets: number;

  /** Percentage of wallets that are clustered */
  clusteredPercentage: number;

  /** Total number of clusters */
  totalClusters: number;

  /** Clusters by type */
  byClusterType: Record<ClusterType, number>;

  /** Clusters by confidence level */
  byConfidenceLevel: Record<ClusterConfidenceLevel, number>;

  /** Average cluster size */
  averageClusterSize: number;

  /** Largest cluster size */
  largestClusterSize: number;

  /** Average coordination score */
  averageCoordinationScore: number;

  /** High severity cluster count */
  highSeverityClusterCount: number;
}

/**
 * Options for clustering analysis
 */
export interface ClusteringOptions {
  /** Custom funding source tracker */
  fundingTracker?: FundingSourceTracker;

  /** Custom wallet age calculator */
  ageCalculator?: WalletAgeCalculator;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Maximum trades to fetch per wallet */
  maxTradesPerWallet?: number;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;

  /** Custom thresholds */
  thresholds?: Partial<ClusteringThresholds>;
}

/**
 * Thresholds for clustering detection
 */
export interface ClusteringThresholds {
  /** Minimum cluster size to report (default: 2) */
  minClusterSize: number;

  /** Time window for temporal clustering (hours, default: 24) */
  temporalWindowHours: number;

  /** Minimum confidence to report cluster (default: 30) */
  minConfidence: number;

  /** Threshold for funding source similarity (0-1, default: 0.5) */
  fundingSimilarityThreshold: number;

  /** Threshold for trading pattern similarity (0-1, default: 0.5) */
  tradingSimilarityThreshold: number;

  /** Minimum shared markets for pattern cluster (default: 2) */
  minSharedMarkets: number;

  /** Points for shared funding source */
  sharedFundingSourcePoints: number;

  /** Points for temporal proximity */
  temporalProximityPoints: number;

  /** Points for trading pattern similarity */
  tradingPatternPoints: number;

  /** Points for shared markets */
  sharedMarketPoints: number;

  /** High coordination score threshold */
  highCoordinationThreshold: number;

  /** Critical coordination score threshold */
  criticalCoordinationThreshold: number;
}

/**
 * Configuration for FreshWalletClusterAnalyzer
 */
export interface FreshWalletClusterAnalyzerConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 500) */
  maxCacheSize?: number;

  /** Default thresholds */
  thresholds?: Partial<ClusteringThresholds>;

  /** Custom funding source tracker */
  fundingTracker?: FundingSourceTracker;

  /** Custom wallet age calculator */
  ageCalculator?: WalletAgeCalculator;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 500;

/** Default max trades per wallet */
const DEFAULT_MAX_TRADES = 100;

/** Default clustering thresholds */
export const DEFAULT_CLUSTERING_THRESHOLDS: ClusteringThresholds = {
  minClusterSize: 2,
  temporalWindowHours: 24,
  minConfidence: 30,
  fundingSimilarityThreshold: 0.5,
  tradingSimilarityThreshold: 0.5,
  minSharedMarkets: 2,
  sharedFundingSourcePoints: 30,
  temporalProximityPoints: 25,
  tradingPatternPoints: 25,
  sharedMarketPoints: 20,
  highCoordinationThreshold: 60,
  criticalCoordinationThreshold: 80,
};

// ============================================================================
// FreshWalletClusterAnalyzer Class
// ============================================================================

/**
 * Analyzer for detecting clusters of related fresh wallets
 */
export class FreshWalletClusterAnalyzer {
  private readonly cache: Map<string, { result: WalletClusteringResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly thresholds: ClusteringThresholds;
  private readonly fundingTracker: FundingSourceTracker;
  private readonly ageCalculator: WalletAgeCalculator;
  private readonly clobClient?: ClobClient;
  private readonly configManager: FreshWalletConfigManager;

  // Internal state for batch analysis
  private fundingAnalyses: Map<string, FundingAnalysis> = new Map();
  private ageResults: Map<string, WalletAgeResult> = new Map();
  private tradingMetrics: Map<string, TradingPatternMetrics> = new Map();

  constructor(config?: FreshWalletClusterAnalyzerConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.thresholds = {
      ...DEFAULT_CLUSTERING_THRESHOLDS,
      ...config?.thresholds,
    };
    this.fundingTracker = config?.fundingTracker ?? getSharedFundingSourceTracker();
    this.ageCalculator = config?.ageCalculator ?? getSharedWalletAgeCalculator();
    this.clobClient = config?.clobClient;
    this.configManager = config?.configManager ?? getSharedFreshWalletConfigManager();
  }

  /**
   * Analyze a set of wallets for clustering patterns
   *
   * @param addresses - Array of wallet addresses to analyze
   * @param options - Analysis options
   * @returns Batch clustering result with all detected clusters
   */
  async analyzeWallets(
    addresses: string[],
    options: ClusteringOptions = {}
  ): Promise<BatchClusteringResult> {
    const startTime = Date.now();
    const results = new Map<string, WalletClusteringResult>();
    const errors = new Map<string, string>();

    // Normalize and validate addresses
    const validAddresses: string[] = [];
    for (const address of addresses) {
      if (!address || !isAddress(address)) {
        errors.set(address, `Invalid address: ${address}`);
        continue;
      }
      validAddresses.push(getAddress(address));
    }

    const effectiveThresholds = {
      ...this.thresholds,
      ...options.thresholds,
    };

    // Reset internal state
    this.fundingAnalyses.clear();
    this.ageResults.clear();
    this.tradingMetrics.clear();

    // Phase 1: Gather data for all wallets
    await this.gatherWalletData(validAddresses, options);

    // Phase 2: Detect clusters
    const fundingClusters = this.detectFundingSourceClusters(validAddresses, effectiveThresholds);
    const temporalClusters = this.detectTemporalClusters(validAddresses, effectiveThresholds);
    const tradingClusters = this.detectTradingPatternClusters(
      validAddresses,
      effectiveThresholds
    );

    // Phase 3: Build wallet-level results
    const allClusters: WalletCluster[] = [];
    let clusterIdCounter = 0;

    // Build WalletClusters from funding source clusters
    for (const fsCluster of fundingClusters) {
      if (fsCluster.fundedWallets.length >= effectiveThresholds.minClusterSize) {
        const cluster = this.buildWalletCluster(
          `FS-${++clusterIdCounter}`,
          ClusterType.FUNDING_SOURCE,
          fsCluster.fundedWallets,
          [
            {
              type: "funding_source",
              description: `Funded by ${fsCluster.sourceName ?? fsCluster.sourceAddress.slice(0, 10)}`,
              addresses: fsCluster.fundedWallets,
              signalStrength: fsCluster.fundingConcentration * 100,
            },
          ],
          effectiveThresholds
        );
        if (cluster.confidence >= effectiveThresholds.minConfidence) {
          allClusters.push(cluster);
        }
      }
    }

    // Build WalletClusters from temporal clusters
    for (const tCluster of temporalClusters) {
      if (tCluster.wallets.length >= effectiveThresholds.minClusterSize) {
        const cluster = this.buildWalletCluster(
          `TC-${++clusterIdCounter}`,
          ClusterType.TEMPORAL,
          tCluster.wallets,
          [
            {
              type: "creation_time",
              description: `Created within ${tCluster.windowDurationHours}h window`,
              addresses: tCluster.wallets,
              signalStrength: tCluster.timingSuspicionScore,
            },
          ],
          effectiveThresholds
        );
        if (cluster.confidence >= effectiveThresholds.minConfidence) {
          allClusters.push(cluster);
        }
      }
    }

    // Build WalletClusters from trading pattern clusters
    for (const tpCluster of tradingClusters) {
      if (tpCluster.wallets.length >= effectiveThresholds.minClusterSize) {
        const characteristics: ClusterCharacteristic[] = [
          {
            type: "trading_pattern",
            description: `Similar trading behavior (${Math.round(tpCluster.averageSimilarity * 100)}% similar)`,
            addresses: tpCluster.wallets,
            signalStrength: tpCluster.averageSimilarity * 100,
          },
        ];

        if (tpCluster.sharedMarkets.length > 0) {
          characteristics.push({
            type: "market_focus",
            description: `Share ${tpCluster.sharedMarkets.length} markets`,
            addresses: tpCluster.wallets,
            signalStrength: Math.min(tpCluster.sharedMarkets.length * 20, 100),
          });
        }

        const cluster = this.buildWalletCluster(
          `TP-${++clusterIdCounter}`,
          ClusterType.TRADING_PATTERN,
          tpCluster.wallets,
          characteristics,
          effectiveThresholds
        );
        if (cluster.confidence >= effectiveThresholds.minConfidence) {
          allClusters.push(cluster);
        }
      }
    }

    // Phase 4: Detect multi-factor clusters (wallets appearing in multiple cluster types)
    const multifactorClusters = this.detectMultiFactorClusters(
      allClusters,
      effectiveThresholds
    );
    allClusters.push(...multifactorClusters);

    // Phase 5: Build individual wallet results
    for (const address of validAddresses) {
      try {
        const walletResult = this.buildWalletResult(
          address,
          allClusters,
          fundingClusters,
          temporalClusters,
          tradingClusters,
          effectiveThresholds,
          options.bypassCache ?? false
        );
        results.set(address, walletResult);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.set(address, errorMessage);
      }
    }

    // Count clustered wallets
    let clusteredWalletCount = 0;
    for (const result of results.values()) {
      if (result.clusterIds.length > 0) {
        clusteredWalletCount++;
      }
    }

    return {
      results,
      errors,
      clusters: allClusters,
      totalProcessed: addresses.length,
      successCount: results.size,
      errorCount: errors.size,
      clusteredWalletCount,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Analyze a single wallet's cluster membership
   * Note: This is less effective than batch analysis since clustering requires multiple wallets
   */
  async analyzeWallet(
    address: string,
    relatedAddresses: string[],
    options: ClusteringOptions = {}
  ): Promise<WalletClusteringResult> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }

    const normalizedAddress = getAddress(address);

    // Check cache first
    if (!options.bypassCache) {
      const cached = this.getCachedResult(normalizedAddress);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Include the target address in the analysis set
    const allAddresses = [normalizedAddress, ...relatedAddresses.filter((a) => a !== address)];
    const batchResult = await this.analyzeWallets(allAddresses, options);

    const result = batchResult.results.get(normalizedAddress);
    if (!result) {
      throw new Error(`Failed to analyze wallet: ${normalizedAddress}`);
    }

    // Cache the result
    this.setCachedResult(normalizedAddress, result);

    return result;
  }

  /**
   * Get summary statistics for clustering analysis
   */
  getSummary(batchResult: BatchClusteringResult): ClusteringSummary {
    const byClusterType: Record<ClusterType, number> = {
      [ClusterType.FUNDING_SOURCE]: 0,
      [ClusterType.TEMPORAL]: 0,
      [ClusterType.TRADING_PATTERN]: 0,
      [ClusterType.MULTI_FACTOR]: 0,
    };

    const byConfidenceLevel: Record<ClusterConfidenceLevel, number> = {
      [ClusterConfidenceLevel.VERY_HIGH]: 0,
      [ClusterConfidenceLevel.HIGH]: 0,
      [ClusterConfidenceLevel.MEDIUM]: 0,
      [ClusterConfidenceLevel.LOW]: 0,
      [ClusterConfidenceLevel.VERY_LOW]: 0,
    };

    let totalClusterSize = 0;
    let largestClusterSize = 0;
    let highSeverityCount = 0;

    for (const cluster of batchResult.clusters) {
      byClusterType[cluster.clusterType]++;
      byConfidenceLevel[cluster.confidenceLevel]++;
      totalClusterSize += cluster.memberCount;
      largestClusterSize = Math.max(largestClusterSize, cluster.memberCount);

      if (
        cluster.severity === FreshWalletAlertSeverity.HIGH ||
        cluster.severity === FreshWalletAlertSeverity.CRITICAL
      ) {
        highSeverityCount++;
      }
    }

    const coordinationScores: number[] = [];
    for (const result of batchResult.results.values()) {
      coordinationScores.push(result.coordinationScore);
    }

    const avgCoordinationScore =
      coordinationScores.length > 0
        ? coordinationScores.reduce((a, b) => a + b, 0) / coordinationScores.length
        : 0;

    const clusterCount = batchResult.clusters.length;

    return {
      totalWallets: batchResult.totalProcessed,
      clusteredWallets: batchResult.clusteredWalletCount,
      clusteredPercentage:
        batchResult.totalProcessed > 0
          ? Math.round((batchResult.clusteredWalletCount / batchResult.totalProcessed) * 10000) /
            100
          : 0,
      totalClusters: clusterCount,
      byClusterType,
      byConfidenceLevel,
      averageClusterSize: clusterCount > 0 ? Math.round((totalClusterSize / clusterCount) * 10) / 10 : 0,
      largestClusterSize,
      averageCoordinationScore: Math.round(avgCoordinationScore * 100) / 100,
      highSeverityClusterCount: highSeverityCount,
    };
  }

  /**
   * Check if a wallet is part of any cluster
   */
  isWalletClustered(result: WalletClusteringResult): boolean {
    return result.clusterIds.length > 0;
  }

  /**
   * Check if a wallet has high coordination score
   */
  hasHighCoordination(result: WalletClusteringResult): boolean {
    return result.coordinationScore >= this.thresholds.highCoordinationThreshold;
  }

  /**
   * Get the current thresholds
   */
  getThresholds(): ClusteringThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get the config manager
   */
  getConfigManager(): FreshWalletConfigManager {
    return this.configManager;
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

  // ==========================================================================
  // Private Methods - Data Gathering
  // ==========================================================================

  /**
   * Gather data for all wallets in parallel where possible
   */
  private async gatherWalletData(
    addresses: string[],
    options: ClusteringOptions
  ): Promise<void> {
    const {
      fundingTracker = this.fundingTracker,
      ageCalculator = this.ageCalculator,
      clobClient = this.clobClient,
      maxTradesPerWallet = DEFAULT_MAX_TRADES,
    } = options;

    // Gather funding analysis, age, and trading data
    const promises: Promise<void>[] = [];

    for (const address of addresses) {
      // Funding analysis
      promises.push(
        (async () => {
          try {
            const analysis = await fundingTracker.analyzeFundingSources(address, {
              maxDepth: 2,
            });
            this.fundingAnalyses.set(address, analysis);
          } catch {
            // Silently fail - wallet may not have funding sources
          }
        })()
      );

      // Age analysis
      promises.push(
        (async () => {
          try {
            const age = await ageCalculator.calculateAge(address);
            this.ageResults.set(address, age);
          } catch {
            // Silently fail
          }
        })()
      );

      // Trading metrics
      promises.push(
        (async () => {
          try {
            const trades = await getAllTradesByWallet(address, {
              maxTrades: maxTradesPerWallet,
              client: clobClient,
            });
            const metrics = this.computeTradingMetrics(address, trades ?? []);
            this.tradingMetrics.set(address, metrics);
          } catch {
            // Silently fail
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Compute trading pattern metrics for a wallet
   */
  private computeTradingMetrics(address: string, trades: Trade[]): TradingPatternMetrics {
    if (trades.length === 0) {
      return {
        address,
        tradeCount: 0,
        totalVolume: 0,
        averageTradeSize: 0,
        markets: [],
        marketCount: 0,
        buyRatio: 0.5,
        averageTimeBetweenTrades: 0,
        tradingHourDistribution: new Array(24).fill(0),
        firstTradeTimestamp: null,
        lastTradeTimestamp: null,
      };
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const markets = new Set<string>();
    let totalVolume = 0;
    let buyCount = 0;
    const hourDistribution = new Array(24).fill(0);
    const intervals: number[] = [];

    for (let i = 0; i < sortedTrades.length; i++) {
      const trade = sortedTrades[i]!;
      const size = parseFloat(trade.size);
      const price = parseFloat(trade.price);

      totalVolume += size * price;
      markets.add(trade.asset_id);

      if (trade.side === "buy") {
        buyCount++;
      }

      const tradeDate = new Date(trade.created_at);
      hourDistribution[tradeDate.getUTCHours()]++;

      if (i > 0) {
        const prevDate = new Date(sortedTrades[i - 1]!.created_at);
        const intervalSec = (tradeDate.getTime() - prevDate.getTime()) / 1000;
        intervals.push(intervalSec);
      }
    }

    const firstTimestamp = Math.floor(new Date(sortedTrades[0]!.created_at).getTime() / 1000);
    const lastTimestamp = Math.floor(
      new Date(sortedTrades[sortedTrades.length - 1]!.created_at).getTime() / 1000
    );

    return {
      address,
      tradeCount: trades.length,
      totalVolume,
      averageTradeSize: totalVolume / trades.length,
      markets: Array.from(markets),
      marketCount: markets.size,
      buyRatio: buyCount / trades.length,
      averageTimeBetweenTrades:
        intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0,
      tradingHourDistribution: hourDistribution,
      firstTradeTimestamp: firstTimestamp,
      lastTradeTimestamp: lastTimestamp,
    };
  }

  // ==========================================================================
  // Private Methods - Cluster Detection
  // ==========================================================================

  /**
   * Detect funding source clusters
   */
  private detectFundingSourceClusters(
    addresses: string[],
    thresholds: ClusteringThresholds
  ): FundingSourceCluster[] {
    const sourceToWallets = new Map<
      string,
      {
        wallets: Set<string>;
        sourceName: string | null;
        totalAmount: bigint;
        isSuspicious: boolean;
      }
    >();

    for (const address of addresses) {
      const analysis = this.fundingAnalyses.get(address);
      if (!analysis) continue;

      for (const source of analysis.fundingSources) {
        // Only consider direct funding (depth 1)
        if (source.depth !== 1) continue;

        const sourceAddr = source.address.toLowerCase();
        const existing = sourceToWallets.get(sourceAddr);

        if (existing) {
          existing.wallets.add(address);
          existing.totalAmount += source.totalAmount;
        } else {
          const isSuspicious =
            source.type === "mixer" ||
            source.type === "unknown" ||
            source.isSanctioned ||
            source.riskLevel === "high" ||
            source.riskLevel === "critical";

          sourceToWallets.set(sourceAddr, {
            wallets: new Set([address]),
            sourceName: source.name ?? null,
            totalAmount: source.totalAmount,
            isSuspicious,
          });
        }
      }
    }

    const clusters: FundingSourceCluster[] = [];

    for (const [sourceAddress, data] of sourceToWallets.entries()) {
      if (data.wallets.size >= thresholds.minClusterSize) {
        // Calculate funding concentration (how much of wallet funding comes from this source)
        let totalWalletFunding = 0n;
        for (const wallet of data.wallets) {
          const analysis = this.fundingAnalyses.get(wallet);
          if (analysis) {
            totalWalletFunding += analysis.totalAmountTraced;
          }
        }

        const concentration =
          totalWalletFunding > 0n
            ? Number((data.totalAmount * 100n) / totalWalletFunding) / 100
            : 0;

        clusters.push({
          sourceAddress,
          sourceName: data.sourceName,
          fundedWallets: Array.from(data.wallets),
          totalAmount: data.totalAmount,
          formattedTotalAmount: this.formatAmount(data.totalAmount),
          fundingConcentration: concentration,
          isSuspicious: data.isSuspicious,
        });
      }
    }

    // Sort by number of funded wallets (most first)
    clusters.sort((a, b) => b.fundedWallets.length - a.fundedWallets.length);

    return clusters;
  }

  /**
   * Detect temporal clusters (wallets created around the same time)
   */
  private detectTemporalClusters(
    addresses: string[],
    thresholds: ClusteringThresholds
  ): TemporalCluster[] {
    // Get wallets with known creation times
    const walletsWithTime: Array<{ address: string; timestamp: number }> = [];

    for (const address of addresses) {
      const age = this.ageResults.get(address);
      if (age?.firstTransactionTimestamp) {
        walletsWithTime.push({
          address,
          timestamp: age.firstTransactionTimestamp,
        });
      }
    }

    if (walletsWithTime.length < thresholds.minClusterSize) {
      return [];
    }

    // Sort by creation time
    walletsWithTime.sort((a, b) => a.timestamp - b.timestamp);

    // Find clusters using sliding window
    const clusters: TemporalCluster[] = [];
    const windowSeconds = thresholds.temporalWindowHours * 3600;

    let windowStart = 0;
    for (let windowEnd = 0; windowEnd < walletsWithTime.length; windowEnd++) {
      // Shrink window from left if too wide
      while (
        walletsWithTime[windowEnd]!.timestamp - walletsWithTime[windowStart]!.timestamp >
        windowSeconds
      ) {
        windowStart++;
      }

      const windowWallets = walletsWithTime.slice(windowStart, windowEnd + 1);

      if (windowWallets.length >= thresholds.minClusterSize) {
        const startTime = walletsWithTime[windowStart]!.timestamp;
        const endTime = walletsWithTime[windowEnd]!.timestamp;
        const duration = endTime - startTime;

        // Calculate average interval
        let totalInterval = 0;
        for (let i = 1; i < windowWallets.length; i++) {
          totalInterval += windowWallets[i]!.timestamp - windowWallets[i - 1]!.timestamp;
        }
        const avgInterval = totalInterval / (windowWallets.length - 1);

        // Calculate suspicion score based on timing regularity
        // Very regular intervals (like automated creation) are more suspicious
        const intervalVariances: number[] = [];
        for (let i = 1; i < windowWallets.length; i++) {
          const interval = windowWallets[i]!.timestamp - windowWallets[i - 1]!.timestamp;
          intervalVariances.push(Math.abs(interval - avgInterval));
        }
        const avgVariance =
          intervalVariances.reduce((a, b) => a + b, 0) / intervalVariances.length;

        // Low variance = high suspicion (regular intervals)
        // Score is higher when more wallets are crammed into shorter time
        const densityScore = (windowWallets.length / (duration / 3600)) * 10; // wallets per hour
        const regularityScore = Math.max(0, 50 - (avgVariance / 60)); // Lower variance = higher score
        const suspicionScore = Math.min(100, densityScore + regularityScore);

        // Only add if suspicion score meets threshold
        if (suspicionScore >= 30) {
          clusters.push({
            windowStart: new Date(startTime * 1000),
            windowEnd: new Date(endTime * 1000),
            windowDurationHours: Math.round((duration / 3600) * 100) / 100,
            wallets: windowWallets.map((w) => w.address),
            averageIntervalSeconds: Math.round(avgInterval),
            timingSuspicionScore: Math.round(suspicionScore),
          });
        }
      }
    }

    // Deduplicate overlapping clusters, keeping the largest
    return this.deduplicateTemporalClusters(clusters);
  }

  /**
   * Remove overlapping temporal clusters, keeping the largest
   */
  private deduplicateTemporalClusters(clusters: TemporalCluster[]): TemporalCluster[] {
    if (clusters.length <= 1) return clusters;

    // Sort by size (largest first)
    const sorted = [...clusters].sort((a, b) => b.wallets.length - a.wallets.length);
    const result: TemporalCluster[] = [];
    const usedWallets = new Set<string>();

    for (const cluster of sorted) {
      // Check overlap with already selected clusters
      const newWallets = cluster.wallets.filter((w) => !usedWallets.has(w));

      if (newWallets.length >= 2) {
        // Keep cluster with only new wallets
        result.push({
          ...cluster,
          wallets: newWallets,
        });
        for (const w of newWallets) {
          usedWallets.add(w);
        }
      }
    }

    return result;
  }

  /**
   * Detect trading pattern clusters
   */
  private detectTradingPatternClusters(
    addresses: string[],
    thresholds: ClusteringThresholds
  ): TradingPatternCluster[] {
    // Get wallets with trading activity
    const walletsWithTrades: Array<{ address: string; metrics: TradingPatternMetrics }> = [];

    for (const address of addresses) {
      const metrics = this.tradingMetrics.get(address);
      if (metrics && metrics.tradeCount > 0) {
        walletsWithTrades.push({ address, metrics });
      }
    }

    if (walletsWithTrades.length < thresholds.minClusterSize) {
      return [];
    }

    // Compute pairwise similarity
    const similarities: Array<{
      addr1: string;
      addr2: string;
      similarity: number;
      sharedMarkets: string[];
    }> = [];

    for (let i = 0; i < walletsWithTrades.length; i++) {
      for (let j = i + 1; j < walletsWithTrades.length; j++) {
        const w1 = walletsWithTrades[i]!;
        const w2 = walletsWithTrades[j]!;

        const similarity = this.computeTradingSimilarity(w1.metrics, w2.metrics);
        const sharedMarkets = w1.metrics.markets.filter((m) => w2.metrics.markets.includes(m));

        if (
          similarity >= thresholds.tradingSimilarityThreshold ||
          sharedMarkets.length >= thresholds.minSharedMarkets
        ) {
          similarities.push({
            addr1: w1.address,
            addr2: w2.address,
            similarity,
            sharedMarkets,
          });
        }
      }
    }

    // Build clusters using union-find approach
    const parent = new Map<string, string>();
    for (const w of walletsWithTrades) {
      parent.set(w.address, w.address);
    }

    const find = (x: string): string => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: string, y: string): void => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent.set(px, py);
      }
    };

    for (const sim of similarities) {
      union(sim.addr1, sim.addr2);
    }

    // Group by cluster
    const clusterGroups = new Map<string, string[]>();
    for (const w of walletsWithTrades) {
      const root = find(w.address);
      if (!clusterGroups.has(root)) {
        clusterGroups.set(root, []);
      }
      clusterGroups.get(root)!.push(w.address);
    }

    // Build cluster objects
    const clusters: TradingPatternCluster[] = [];

    for (const [, members] of clusterGroups.entries()) {
      if (members.length < thresholds.minClusterSize) continue;

      // Find shared markets across all members
      const marketSets = members.map((addr) => new Set(this.tradingMetrics.get(addr)!.markets));
      const sharedMarkets = [...marketSets[0]!].filter((m) =>
        marketSets.slice(1).every((set) => set.has(m))
      );

      // Calculate average similarity among members
      let totalSimilarity = 0;
      let pairCount = 0;

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const m1 = this.tradingMetrics.get(members[i]!)!;
          const m2 = this.tradingMetrics.get(members[j]!)!;
          totalSimilarity += this.computeTradingSimilarity(m1, m2);
          pairCount++;
        }
      }

      const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

      // Generate pattern signature
      const avgMetrics = this.computeAverageMetrics(members);
      const signature = this.generatePatternSignature(avgMetrics);

      clusters.push({
        patternSignature: signature,
        wallets: members,
        sharedMarkets,
        averageSimilarity: Math.round(avgSimilarity * 100) / 100,
        memberMetrics: members.map((addr) => this.tradingMetrics.get(addr)!),
      });
    }

    return clusters;
  }

  /**
   * Compute similarity between two trading patterns (0-1)
   */
  private computeTradingSimilarity(
    m1: TradingPatternMetrics,
    m2: TradingPatternMetrics
  ): number {
    let score = 0;
    let weights = 0;

    // Market overlap (Jaccard similarity)
    const set1 = new Set(m1.markets);
    const set2 = new Set(m2.markets);
    const intersection = [...set1].filter((m) => set2.has(m)).length;
    const union = new Set([...m1.markets, ...m2.markets]).size;
    if (union > 0) {
      score += (intersection / union) * 0.3;
      weights += 0.3;
    }

    // Buy ratio similarity
    const buyRatioDiff = Math.abs(m1.buyRatio - m2.buyRatio);
    score += (1 - buyRatioDiff) * 0.15;
    weights += 0.15;

    // Average trade size similarity (log scale)
    if (m1.averageTradeSize > 0 && m2.averageTradeSize > 0) {
      const logRatio = Math.abs(
        Math.log10(m1.averageTradeSize) - Math.log10(m2.averageTradeSize)
      );
      score += Math.max(0, 1 - logRatio / 2) * 0.2;
      weights += 0.2;
    }

    // Trading frequency similarity
    if (m1.averageTimeBetweenTrades > 0 && m2.averageTimeBetweenTrades > 0) {
      const freqRatio = Math.abs(
        Math.log10(m1.averageTimeBetweenTrades) - Math.log10(m2.averageTimeBetweenTrades)
      );
      score += Math.max(0, 1 - freqRatio / 2) * 0.15;
      weights += 0.15;
    }

    // Trading hour distribution similarity (cosine similarity)
    const hourSim = this.cosineSimilarity(
      m1.tradingHourDistribution,
      m2.tradingHourDistribution
    );
    score += hourSim * 0.2;
    weights += 0.2;

    return weights > 0 ? score / weights : 0;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i]! * v2[i]!;
      norm1 += v1[i]! * v1[i]!;
      norm2 += v2[i]! * v2[i]!;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Compute average metrics for a group of wallets
   */
  private computeAverageMetrics(addresses: string[]): TradingPatternMetrics {
    let totalTrades = 0;
    let totalVolume = 0;
    let totalBuyRatio = 0;
    let totalInterval = 0;
    const hourDist = new Array(24).fill(0);
    const allMarkets = new Set<string>();

    for (const addr of addresses) {
      const m = this.tradingMetrics.get(addr);
      if (!m) continue;

      totalTrades += m.tradeCount;
      totalVolume += m.totalVolume;
      totalBuyRatio += m.buyRatio;
      totalInterval += m.averageTimeBetweenTrades;

      for (let i = 0; i < 24; i++) {
        hourDist[i] += m.tradingHourDistribution[i]!;
      }

      for (const market of m.markets) {
        allMarkets.add(market);
      }
    }

    const count = addresses.length;

    return {
      address: "average",
      tradeCount: Math.round(totalTrades / count),
      totalVolume: totalVolume / count,
      averageTradeSize: totalVolume / count / Math.max(1, totalTrades / count),
      markets: Array.from(allMarkets),
      marketCount: allMarkets.size,
      buyRatio: totalBuyRatio / count,
      averageTimeBetweenTrades: totalInterval / count,
      tradingHourDistribution: hourDist.map((h) => h / count),
      firstTradeTimestamp: null,
      lastTradeTimestamp: null,
    };
  }

  /**
   * Generate a human-readable pattern signature
   */
  private generatePatternSignature(metrics: TradingPatternMetrics): string {
    const parts: string[] = [];

    // Trade frequency
    if (metrics.averageTimeBetweenTrades < 3600) {
      parts.push("high-freq");
    } else if (metrics.averageTimeBetweenTrades < 86400) {
      parts.push("med-freq");
    } else {
      parts.push("low-freq");
    }

    // Volume category
    if (metrics.totalVolume > 100000) {
      parts.push("whale");
    } else if (metrics.totalVolume > 10000) {
      parts.push("large");
    } else if (metrics.totalVolume > 1000) {
      parts.push("medium");
    } else {
      parts.push("small");
    }

    // Direction bias
    if (metrics.buyRatio > 0.7) {
      parts.push("buyer");
    } else if (metrics.buyRatio < 0.3) {
      parts.push("seller");
    } else {
      parts.push("mixed");
    }

    // Market focus
    if (metrics.marketCount === 1) {
      parts.push("single-market");
    } else if (metrics.marketCount <= 3) {
      parts.push("focused");
    } else {
      parts.push("diverse");
    }

    return parts.join("-");
  }

  /**
   * Detect multi-factor clusters (wallets appearing in multiple cluster types)
   */
  private detectMultiFactorClusters(
    clusters: WalletCluster[],
    thresholds: ClusteringThresholds
  ): WalletCluster[] {
    // Count how many clusters each wallet appears in
    const walletClusterCounts = new Map<string, Set<string>>();

    for (const cluster of clusters) {
      for (const member of cluster.members) {
        if (!walletClusterCounts.has(member)) {
          walletClusterCounts.set(member, new Set());
        }
        walletClusterCounts.get(member)!.add(cluster.clusterId);
      }
    }

    // Find wallets appearing in multiple cluster types
    const multiClusterWallets = new Set<string>();
    for (const [wallet, clusterIds] of walletClusterCounts.entries()) {
      if (clusterIds.size >= 2) {
        multiClusterWallets.add(wallet);
      }
    }

    if (multiClusterWallets.size < thresholds.minClusterSize) {
      return [];
    }

    // Group wallets that share multiple clusters
    const multiFactorGroups: string[][] = [];
    const processed = new Set<string>();

    for (const wallet of multiClusterWallets) {
      if (processed.has(wallet)) continue;

      const group = [wallet];
      processed.add(wallet);

      const walletClusters = walletClusterCounts.get(wallet)!;

      for (const otherWallet of multiClusterWallets) {
        if (processed.has(otherWallet)) continue;

        const otherClusters = walletClusterCounts.get(otherWallet)!;
        const sharedClusters = [...walletClusters].filter((c) => otherClusters.has(c));

        if (sharedClusters.length >= 2) {
          group.push(otherWallet);
          processed.add(otherWallet);
        }
      }

      if (group.length >= thresholds.minClusterSize) {
        multiFactorGroups.push(group);
      }
    }

    // Build multi-factor cluster objects
    const multiFactorClusters: WalletCluster[] = [];
    let mfClusterIdCounter = 0;

    for (const group of multiFactorGroups) {
      const characteristics: ClusterCharacteristic[] = [];

      // Find which cluster types this group shares
      const clusterTypes = new Set<ClusterType>();
      for (const cluster of clusters) {
        const overlap = group.filter((w) => cluster.members.includes(w));
        if (overlap.length >= 2) {
          clusterTypes.add(cluster.clusterType);
          characteristics.push({
            type:
              cluster.clusterType === ClusterType.FUNDING_SOURCE
                ? "funding_source"
                : cluster.clusterType === ClusterType.TEMPORAL
                  ? "creation_time"
                  : "trading_pattern",
            description: cluster.commonCharacteristics[0]?.description ?? "Shared cluster",
            addresses: overlap,
            signalStrength: cluster.confidence,
          });
        }
      }

      const cluster = this.buildWalletCluster(
        `MF-${++mfClusterIdCounter}`,
        ClusterType.MULTI_FACTOR,
        group,
        characteristics,
        thresholds
      );

      // Boost confidence for multi-factor clusters
      cluster.confidence = Math.min(100, cluster.confidence * 1.3);
      cluster.confidenceLevel = this.getConfidenceLevel(cluster.confidence);

      multiFactorClusters.push(cluster);
    }

    return multiFactorClusters;
  }

  // ==========================================================================
  // Private Methods - Cluster Building
  // ==========================================================================

  /**
   * Build a WalletCluster object
   */
  private buildWalletCluster(
    clusterId: string,
    clusterType: ClusterType,
    members: string[],
    characteristics: ClusterCharacteristic[],
    thresholds: ClusteringThresholds
  ): WalletCluster {
    // Calculate confidence based on cluster type and size
    let baseConfidence = 0;

    switch (clusterType) {
      case ClusterType.FUNDING_SOURCE:
        baseConfidence = thresholds.sharedFundingSourcePoints;
        break;
      case ClusterType.TEMPORAL:
        baseConfidence = thresholds.temporalProximityPoints;
        break;
      case ClusterType.TRADING_PATTERN:
        baseConfidence = thresholds.tradingPatternPoints;
        break;
      case ClusterType.MULTI_FACTOR:
        baseConfidence = 50; // Higher base for multi-factor
        break;
    }

    // Boost by cluster size
    const sizeBoost = Math.min(20, (members.length - 2) * 5);
    const confidence = Math.min(100, baseConfidence + sizeBoost);

    // Determine severity
    const severity = this.determineClusterSeverity(confidence, characteristics, thresholds);

    // Generate flag reasons
    const flagReasons = this.generateClusterFlagReasons(
      clusterType,
      members.length,
      characteristics
    );

    return {
      clusterId,
      clusterType,
      members,
      memberCount: members.length,
      commonCharacteristics: characteristics,
      confidence,
      confidenceLevel: this.getConfidenceLevel(confidence),
      detectedAt: new Date(),
      severity,
      flagReasons,
    };
  }

  /**
   * Build individual wallet clustering result
   */
  private buildWalletResult(
    address: string,
    allClusters: WalletCluster[],
    fundingClusters: FundingSourceCluster[],
    temporalClusters: TemporalCluster[],
    tradingClusters: TradingPatternCluster[],
    thresholds: ClusteringThresholds,
    bypassCache: boolean
  ): WalletClusteringResult {
    // Check cache
    if (!bypassCache) {
      const cached = this.getCachedResult(address);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Find all clusters this wallet belongs to
    const walletClusters = allClusters.filter((c) => c.members.includes(address));
    const clusterIds = walletClusters.map((c) => c.clusterId);

    const clusterConfidences: Record<string, number> = {};
    for (const c of walletClusters) {
      clusterConfidences[c.clusterId] = c.confidence;
    }

    // Find relevant sub-clusters
    const walletFundingClusters = fundingClusters.filter((c) =>
      c.fundedWallets.includes(address)
    );
    const walletTemporalCluster =
      temporalClusters.find((c) => c.wallets.includes(address)) ?? null;
    const walletTradingCluster =
      tradingClusters.find((c) => c.wallets.includes(address)) ?? null;

    // Calculate overall confidence
    const overallConfidence =
      walletClusters.length > 0
        ? Math.max(...walletClusters.map((c) => c.confidence))
        : 0;

    // Calculate coordination score
    const coordinationScore = this.calculateCoordinationScore(
      walletClusters,
      walletFundingClusters,
      walletTemporalCluster,
      walletTradingCluster
    );

    // Determine severity
    const severity = this.determineWalletSeverity(
      coordinationScore,
      walletClusters,
      thresholds
    );

    // Generate flag reasons
    const flagReasons = this.generateWalletFlagReasons(
      walletClusters,
      walletFundingClusters,
      walletTemporalCluster,
      walletTradingCluster
    );

    const result: WalletClusteringResult = {
      address,
      clusterIds,
      clusterCount: clusterIds.length,
      clusterConfidences,
      fundingSourceClusters: walletFundingClusters,
      temporalCluster: walletTemporalCluster,
      tradingPatternCluster: walletTradingCluster,
      overallClusterConfidence: overallConfidence,
      confidenceLevel: this.getConfidenceLevel(overallConfidence),
      coordinationScore,
      severity,
      flagReasons,
      fromCache: false,
      analyzedAt: new Date(),
    };

    // Cache result
    this.setCachedResult(address, result);

    return result;
  }

  /**
   * Calculate coordination score for a wallet
   */
  private calculateCoordinationScore(
    clusters: WalletCluster[],
    fundingClusters: FundingSourceCluster[],
    temporalCluster: TemporalCluster | null,
    tradingCluster: TradingPatternCluster | null
  ): number {
    let score = 0;

    // Points for number of clusters
    score += Math.min(30, clusters.length * 10);

    // Points for multi-factor cluster membership
    const multiFactorClusters = clusters.filter(
      (c) => c.clusterType === ClusterType.MULTI_FACTOR
    );
    score += multiFactorClusters.length * 15;

    // Points for suspicious funding sources
    for (const fc of fundingClusters) {
      if (fc.isSuspicious) {
        score += 20;
      }
      if (fc.fundedWallets.length > 3) {
        score += 10;
      }
    }

    // Points for temporal clustering
    if (temporalCluster) {
      score += Math.min(20, temporalCluster.timingSuspicionScore / 5);
    }

    // Points for trading pattern similarity
    if (tradingCluster && tradingCluster.averageSimilarity > 0.7) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Determine cluster severity
   */
  private determineClusterSeverity(
    confidence: number,
    characteristics: ClusterCharacteristic[],
    thresholds: ClusteringThresholds
  ): FreshWalletAlertSeverity {
    // Check for high-risk characteristics
    const hasSuspiciousFunding = characteristics.some(
      (c) => c.type === "funding_source" && c.description.toLowerCase().includes("suspicious")
    );

    if (confidence >= 80 || hasSuspiciousFunding) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    if (confidence >= thresholds.highCoordinationThreshold) {
      return FreshWalletAlertSeverity.HIGH;
    }

    if (confidence >= 50) {
      return FreshWalletAlertSeverity.MEDIUM;
    }

    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Determine wallet severity based on its cluster membership
   */
  private determineWalletSeverity(
    coordinationScore: number,
    clusters: WalletCluster[],
    thresholds: ClusteringThresholds
  ): FreshWalletAlertSeverity {
    if (coordinationScore >= thresholds.criticalCoordinationThreshold) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    if (coordinationScore >= thresholds.highCoordinationThreshold) {
      return FreshWalletAlertSeverity.HIGH;
    }

    // Check cluster severities
    const hasHighSeverityCluster = clusters.some(
      (c) =>
        c.severity === FreshWalletAlertSeverity.HIGH ||
        c.severity === FreshWalletAlertSeverity.CRITICAL
    );

    if (hasHighSeverityCluster) {
      return FreshWalletAlertSeverity.HIGH;
    }

    if (clusters.length > 0 || coordinationScore >= 30) {
      return FreshWalletAlertSeverity.MEDIUM;
    }

    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Generate cluster flag reasons
   */
  private generateClusterFlagReasons(
    clusterType: ClusterType,
    memberCount: number,
    characteristics: ClusterCharacteristic[]
  ): string[] {
    const reasons: string[] = [];

    reasons.push(`Cluster of ${memberCount} related wallets detected`);

    switch (clusterType) {
      case ClusterType.FUNDING_SOURCE:
        reasons.push("Wallets share common funding source");
        break;
      case ClusterType.TEMPORAL:
        reasons.push("Wallets created within similar timeframe");
        break;
      case ClusterType.TRADING_PATTERN:
        reasons.push("Wallets exhibit similar trading patterns");
        break;
      case ClusterType.MULTI_FACTOR:
        reasons.push("Multiple clustering signals detected (multi-factor)");
        break;
    }

    for (const char of characteristics) {
      if (char.signalStrength >= 70) {
        reasons.push(`Strong signal: ${char.description}`);
      }
    }

    return reasons;
  }

  /**
   * Generate wallet flag reasons
   */
  private generateWalletFlagReasons(
    clusters: WalletCluster[],
    fundingClusters: FundingSourceCluster[],
    temporalCluster: TemporalCluster | null,
    tradingCluster: TradingPatternCluster | null
  ): string[] {
    const reasons: string[] = [];

    if (clusters.length > 0) {
      reasons.push(`Member of ${clusters.length} cluster(s)`);
    }

    for (const fc of fundingClusters) {
      if (fc.isSuspicious) {
        reasons.push(
          `Funded by suspicious source: ${fc.sourceName ?? fc.sourceAddress.slice(0, 10)}`
        );
      } else if (fc.fundedWallets.length > 2) {
        reasons.push(
          `Shares funding source with ${fc.fundedWallets.length - 1} other wallets`
        );
      }
    }

    if (temporalCluster) {
      reasons.push(
        `Created within ${temporalCluster.windowDurationHours}h of ${temporalCluster.wallets.length - 1} other wallets`
      );
    }

    if (tradingCluster && tradingCluster.averageSimilarity > 0.5) {
      reasons.push(
        `Trading pattern ${Math.round(tradingCluster.averageSimilarity * 100)}% similar to ${tradingCluster.wallets.length - 1} other wallets`
      );
    }

    const multiFactorClusters = clusters.filter(
      (c) => c.clusterType === ClusterType.MULTI_FACTOR
    );
    if (multiFactorClusters.length > 0) {
      reasons.push("Part of multi-factor coordinated cluster");
    }

    return reasons;
  }

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(confidence: number): ClusterConfidenceLevel {
    if (confidence >= 90) return ClusterConfidenceLevel.VERY_HIGH;
    if (confidence >= 70) return ClusterConfidenceLevel.HIGH;
    if (confidence >= 50) return ClusterConfidenceLevel.MEDIUM;
    if (confidence >= 30) return ClusterConfidenceLevel.LOW;
    return ClusterConfidenceLevel.VERY_LOW;
  }

  /**
   * Format amount for display (assumes 18 decimals)
   */
  private formatAmount(amount: bigint): string {
    const decimals = 18;
    const isNegative = amount < 0n;
    const absAmount = isNegative ? -amount : amount;
    const whole = absAmount / BigInt(10 ** decimals);
    const fraction = absAmount % BigInt(10 ** decimals);
    const fractionStr = fraction.toString().padStart(decimals, "0");
    const trimmedFraction = fractionStr.slice(0, 6);

    const sign = isNegative ? "-" : "";
    return `${sign}${whole}.${trimmedFraction}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): WalletClusteringResult | null {
    const cached = this.cache.get(address);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached result
   */
  private setCachedResult(address: string, result: WalletClusteringResult): void {
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

let sharedAnalyzer: FreshWalletClusterAnalyzer | null = null;

/**
 * Create a new FreshWalletClusterAnalyzer instance
 */
export function createFreshWalletClusterAnalyzer(
  config?: FreshWalletClusterAnalyzerConfig
): FreshWalletClusterAnalyzer {
  return new FreshWalletClusterAnalyzer(config);
}

/**
 * Get the shared FreshWalletClusterAnalyzer instance
 */
export function getSharedFreshWalletClusterAnalyzer(): FreshWalletClusterAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new FreshWalletClusterAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared FreshWalletClusterAnalyzer instance
 */
export function setSharedFreshWalletClusterAnalyzer(
  analyzer: FreshWalletClusterAnalyzer
): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared FreshWalletClusterAnalyzer instance
 */
export function resetSharedFreshWalletClusterAnalyzer(): void {
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze a set of wallets for clustering patterns (convenience function)
 */
export async function analyzeWalletClusters(
  addresses: string[],
  options?: ClusteringOptions & { analyzer?: FreshWalletClusterAnalyzer }
): Promise<BatchClusteringResult> {
  const analyzer = options?.analyzer ?? getSharedFreshWalletClusterAnalyzer();
  return analyzer.analyzeWallets(addresses, options);
}

/**
 * Analyze a single wallet's cluster membership (convenience function)
 */
export async function analyzeWalletClusterMembership(
  address: string,
  relatedAddresses: string[],
  options?: ClusteringOptions & { analyzer?: FreshWalletClusterAnalyzer }
): Promise<WalletClusteringResult> {
  const analyzer = options?.analyzer ?? getSharedFreshWalletClusterAnalyzer();
  return analyzer.analyzeWallet(address, relatedAddresses, options);
}

/**
 * Check if a wallet is part of any cluster (convenience function)
 */
export function isWalletInCluster(result: WalletClusteringResult): boolean {
  return result.clusterIds.length > 0;
}

/**
 * Check if a wallet has high coordination score (convenience function)
 */
export function hasHighCoordinationScore(
  result: WalletClusteringResult,
  threshold?: number
): boolean {
  const effectiveThreshold = threshold ?? DEFAULT_CLUSTERING_THRESHOLDS.highCoordinationThreshold;
  return result.coordinationScore >= effectiveThreshold;
}

/**
 * Get clustering summary (convenience function)
 */
export function getClusteringSummary(
  batchResult: BatchClusteringResult,
  analyzer?: FreshWalletClusterAnalyzer
): ClusteringSummary {
  const a = analyzer ?? getSharedFreshWalletClusterAnalyzer();
  return a.getSummary(batchResult);
}
