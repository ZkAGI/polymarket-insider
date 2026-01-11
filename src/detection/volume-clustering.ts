/**
 * Volume Clustering Analyzer (DET-VOL-011)
 *
 * Detect coordinated volume from multiple wallets to identify potential
 * coordinated trading activity, manipulation, or organized whale movements.
 *
 * Features:
 * - Group trades by time window
 * - Identify wallet clusters trading same market
 * - Calculate coordination score based on timing, volume, and direction
 * - Flag suspicious coordinated clusters
 * - Event emission for cluster detection
 * - Batch processing for historical analysis
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Coordination type based on detected pattern
 */
export enum CoordinationType {
  /** Multiple wallets trading same direction in short time */
  DIRECTIONAL = "DIRECTIONAL",
  /** Wallets trading opposite directions (potential wash trading) */
  COUNTER_TRADING = "COUNTER_TRADING",
  /** Wallets splitting large positions into smaller trades */
  SPLIT_ORDERS = "SPLIT_ORDERS",
  /** Timed trades appearing at regular intervals */
  TIMED_COORDINATION = "TIMED_COORDINATION",
  /** Mixed coordination signals */
  MIXED = "MIXED",
}

/**
 * Severity of the coordinated activity
 */
export enum ClusterSeverity {
  /** Low severity - minor coordination detected */
  LOW = "LOW",
  /** Medium severity - notable coordination patterns */
  MEDIUM = "MEDIUM",
  /** High severity - significant coordinated activity */
  HIGH = "HIGH",
  /** Critical severity - likely manipulation */
  CRITICAL = "CRITICAL",
}

/**
 * A single trade in a cluster
 */
export interface ClusterTrade {
  /** Unique trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address */
  walletAddress: string;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade timestamp in milliseconds */
  timestamp: number;

  /** Trade side (buy/sell) */
  side: "BUY" | "SELL";

  /** Price at execution */
  price?: number;
}

/**
 * A detected cluster of coordinated trades
 */
export interface VolumeCluster {
  /** Unique cluster identifier */
  clusterId: string;

  /** Market where coordination detected */
  marketId: string;

  /** Coordination type */
  coordinationType: CoordinationType;

  /** Severity level */
  severity: ClusterSeverity;

  /** Wallets involved in the cluster */
  walletAddresses: string[];

  /** Number of unique wallets */
  walletCount: number;

  /** Trade IDs in this cluster */
  tradeIds: string[];

  /** Number of trades */
  tradeCount: number;

  /** Total volume in cluster */
  totalVolumeUsd: number;

  /** Average trade size */
  averageTradeSize: number;

  /** Cluster start time */
  startTime: Date;

  /** Cluster end time */
  endTime: Date;

  /** Duration in milliseconds */
  durationMs: number;

  /** Window used for clustering (milliseconds) */
  windowMs: number;

  /** Coordination score (0-100) */
  coordinationScore: number;

  /** Buy volume in cluster */
  buyVolumeUsd: number;

  /** Sell volume in cluster */
  sellVolumeUsd: number;

  /** Buy/sell ratio (0 = all sell, 1 = all buy) */
  buySellRatio: number;

  /** Direction imbalance (0-1, 1 = completely one-sided) */
  directionImbalance: number;

  /** Average time between trades (ms) */
  averageTimeBetweenTradesMs: number;

  /** Timing regularity score (0-1, 1 = very regular) */
  timingRegularity: number;

  /** Detection timestamp */
  detectedAt: Date;

  /** Reasons for flagging */
  flagReasons: string[];
}

/**
 * Cluster detection result for a single market/window
 */
export interface ClusterDetectionResult {
  /** Market analyzed */
  marketId: string;

  /** Time window analyzed */
  windowStart: Date;

  /** Time window end */
  windowEnd: Date;

  /** Whether a significant cluster was detected */
  hasCluster: boolean;

  /** Detected cluster if any */
  cluster: VolumeCluster | null;

  /** Total trades in window */
  totalTradesInWindow: number;

  /** Unique wallets in window */
  uniqueWalletsInWindow: number;

  /** Total volume in window */
  totalVolumeInWindow: number;

  /** Detection timestamp */
  analyzedAt: Date;
}

/**
 * Batch cluster detection result
 */
export interface BatchClusterDetectionResult {
  /** Results by market */
  resultsByMarket: Map<string, ClusterDetectionResult[]>;

  /** All detected clusters */
  clusters: VolumeCluster[];

  /** Total trades processed */
  totalTradesProcessed: number;

  /** Total clusters detected */
  totalClustersDetected: number;

  /** Clusters by severity */
  bySeverity: Record<ClusterSeverity, number>;

  /** Clusters by coordination type */
  byCoordinationType: Record<CoordinationType, number>;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Configuration for cluster thresholds
 */
export interface ClusterThresholdConfig {
  /** Minimum wallets to form a cluster (default: 3) */
  minWallets: number;

  /** Minimum trades to form a cluster (default: 4) */
  minTrades: number;

  /** Time window for grouping trades (ms, default: 5 minutes) */
  windowMs: number;

  /** Minimum coordination score to flag (0-100, default: 50) */
  minCoordinationScore: number;

  /** Minimum volume for cluster consideration (USD, default: 10000) */
  minVolumeUsd: number;

  /** Direction imbalance threshold for DIRECTIONAL type (default: 0.7) */
  directionalImbalanceThreshold: number;

  /** Timing regularity threshold for TIMED_COORDINATION (default: 0.7) */
  timingRegularityThreshold: number;

  /** Maximum coefficient of variation for timing regularity (default: 0.3) */
  maxTimingCoV: number;

  /** Minimum trades per wallet for split order detection (default: 2) */
  minTradesPerWalletForSplit: number;

  /** Coordination score weights */
  scoreWeights: {
    walletCount: number;
    tradeCount: number;
    directionAlignment: number;
    timingRegularity: number;
    volumeConcentration: number;
  };

  /** Severity thresholds */
  severityThresholds: {
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * Configuration for VolumeClusteringAnalyzer
 */
export interface VolumeClusteringAnalyzerConfig {
  /** Threshold configuration */
  thresholds?: Partial<ClusterThresholdConfig>;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown between alerts for same market (ms, default: 60000) */
  alertCooldownMs?: number;

  /** Maximum recent clusters to store (default: 100) */
  maxRecentClusters?: number;

  /** Sliding window step (ms, default: 60000) for continuous analysis */
  slidingWindowStepMs?: number;
}

/**
 * Options for analyzing trades
 */
export interface AnalyzeTradesOptions {
  /** Override window start time */
  windowStart?: number;

  /** Override window end time */
  windowEnd?: number;

  /** Bypass cooldown */
  bypassCooldown?: boolean;

  /** Custom thresholds */
  thresholds?: Partial<ClusterThresholdConfig>;
}

/**
 * Summary statistics
 */
export interface ClusteringAnalyzerSummary {
  /** Total clusters detected */
  totalClustersDetected: number;

  /** Total unique markets with clusters */
  marketsWithClusters: number;

  /** Total unique wallets in clusters */
  walletsInClusters: number;

  /** Total volume in clusters */
  totalClusterVolumeUsd: number;

  /** Clusters by severity */
  bySeverity: Record<ClusterSeverity, number>;

  /** Clusters by coordination type */
  byCoordinationType: Record<CoordinationType, number>;

  /** Recent clusters */
  recentClusters: VolumeCluster[];

  /** Top markets by cluster count */
  topClusterMarkets: Array<{
    marketId: string;
    clusterCount: number;
    totalVolumeUsd: number;
  }>;

  /** Top clustered wallets */
  topClusteredWallets: Array<{
    walletAddress: string;
    clusterCount: number;
    totalVolumeUsd: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cluster threshold configuration */
export const DEFAULT_CLUSTER_THRESHOLDS: ClusterThresholdConfig = {
  minWallets: 3,
  minTrades: 4,
  windowMs: 5 * 60 * 1000, // 5 minutes
  minCoordinationScore: 50,
  minVolumeUsd: 10000,
  directionalImbalanceThreshold: 0.7,
  timingRegularityThreshold: 0.7,
  maxTimingCoV: 0.3,
  minTradesPerWalletForSplit: 2,
  scoreWeights: {
    walletCount: 0.2,
    tradeCount: 0.15,
    directionAlignment: 0.25,
    timingRegularity: 0.2,
    volumeConcentration: 0.2,
  },
  severityThresholds: {
    medium: 50,
    high: 70,
    critical: 85,
  },
};

/** Default alert cooldown (1 minute) */
const DEFAULT_ALERT_COOLDOWN_MS = 60 * 1000;

/** Default max recent clusters */
const DEFAULT_MAX_RECENT_CLUSTERS = 100;

/** Default sliding window step (1 minute) */
const DEFAULT_SLIDING_WINDOW_STEP_MS = 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique cluster ID
 */
function generateClusterId(): string {
  return `vcluster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate coefficient of variation for timing regularity
 */
function calculateTimingCoV(intervals: number[]): number {
  if (intervals.length < 2) return 1; // Maximum irregularity

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean === 0) return 1;

  const variance =
    intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean; // CoV
}

/**
 * Calculate timing regularity score (0-1)
 * Lower CoV = higher regularity
 */
function calculateTimingRegularity(intervals: number[], maxCoV: number): number {
  const cov = calculateTimingCoV(intervals);
  // Normalize to 0-1 where 0 CoV = 1 regularity, maxCoV+ = 0 regularity
  return Math.max(0, 1 - cov / maxCoV);
}

/**
 * Determine coordination type from cluster characteristics
 */
function determineCoordinationType(
  buyRatio: number,
  timingRegularity: number,
  avgTradesPerWallet: number,
  walletCount: number,
  thresholds: ClusterThresholdConfig
): CoordinationType {
  const directionalImbalance = Math.abs(buyRatio - 0.5) * 2;

  // Counter-trading: roughly equal buy and sell from different wallets
  if (directionalImbalance < 0.3 && walletCount >= 2) {
    return CoordinationType.COUNTER_TRADING;
  }

  // Timed coordination: high timing regularity
  if (timingRegularity >= thresholds.timingRegularityThreshold) {
    return CoordinationType.TIMED_COORDINATION;
  }

  // Split orders: wallets making multiple trades
  if (avgTradesPerWallet >= thresholds.minTradesPerWalletForSplit) {
    return CoordinationType.SPLIT_ORDERS;
  }

  // Directional: strong buy or sell bias
  if (directionalImbalance >= thresholds.directionalImbalanceThreshold) {
    return CoordinationType.DIRECTIONAL;
  }

  return CoordinationType.MIXED;
}

/**
 * Calculate coordination score
 */
function calculateCoordinationScore(
  walletCount: number,
  tradeCount: number,
  directionImbalance: number,
  timingRegularity: number,
  volumeUsd: number,
  minVolumeUsd: number,
  weights: ClusterThresholdConfig["scoreWeights"]
): number {
  let score = 0;

  // Wallet count factor (more wallets = more coordinated)
  // Scale: 3 wallets = 0.5, 10+ wallets = 1.0
  const walletFactor = Math.min(1, (walletCount - 2) / 8);
  score += walletFactor * weights.walletCount * 100;

  // Trade count factor
  // Scale: 4 trades = 0.3, 20+ trades = 1.0
  const tradeFactor = Math.min(1, (tradeCount - 3) / 17);
  score += tradeFactor * weights.tradeCount * 100;

  // Direction alignment (high imbalance = coordinated direction)
  score += directionImbalance * weights.directionAlignment * 100;

  // Timing regularity
  score += timingRegularity * weights.timingRegularity * 100;

  // Volume concentration (higher volume = more significant)
  const volumeFactor = Math.min(1, volumeUsd / (minVolumeUsd * 10));
  score += volumeFactor * weights.volumeConcentration * 100;

  return Math.min(100, Math.round(score));
}

/**
 * Determine severity from coordination score
 */
function determineSeverity(
  score: number,
  thresholds: ClusterThresholdConfig["severityThresholds"]
): ClusterSeverity {
  if (score >= thresholds.critical) return ClusterSeverity.CRITICAL;
  if (score >= thresholds.high) return ClusterSeverity.HIGH;
  if (score >= thresholds.medium) return ClusterSeverity.MEDIUM;
  return ClusterSeverity.LOW;
}

/**
 * Generate flag reasons for a cluster
 */
function generateFlagReasons(
  cluster: Omit<VolumeCluster, "flagReasons">
): string[] {
  const reasons: string[] = [];

  reasons.push(
    `${cluster.walletCount} wallets made ${cluster.tradeCount} trades in ${Math.round(cluster.durationMs / 1000)}s`
  );

  if (cluster.directionImbalance >= 0.7) {
    const direction = cluster.buySellRatio > 0.5 ? "buy" : "sell";
    reasons.push(
      `Strong ${direction} bias (${Math.round(cluster.directionImbalance * 100)}% directional)`
    );
  }

  if (cluster.timingRegularity >= 0.7) {
    reasons.push(
      `Highly regular timing (${Math.round(cluster.timingRegularity * 100)}% regularity)`
    );
  }

  switch (cluster.coordinationType) {
    case CoordinationType.COUNTER_TRADING:
      reasons.push("Potential wash trading - balanced buy/sell from multiple wallets");
      break;
    case CoordinationType.SPLIT_ORDERS:
      reasons.push("Split order pattern - wallets making multiple trades");
      break;
    case CoordinationType.TIMED_COORDINATION:
      reasons.push("Timed coordination - trades at regular intervals");
      break;
    case CoordinationType.DIRECTIONAL:
      reasons.push("Directional coordination - aligned trading direction");
      break;
    default:
      reasons.push("Mixed coordination signals detected");
  }

  if (cluster.totalVolumeUsd >= 100000) {
    reasons.push(`Large total volume: $${cluster.totalVolumeUsd.toLocaleString()}`);
  }

  return reasons;
}

// ============================================================================
// VolumeClusteringAnalyzer Class
// ============================================================================

/**
 * Event types emitted by VolumeClusteringAnalyzer
 */
export interface VolumeClusteringAnalyzerEvents {
  clusterDetected: (cluster: VolumeCluster) => void;
  criticalCluster: (cluster: VolumeCluster) => void;
}

/**
 * Analyzer for detecting coordinated volume from multiple wallets
 */
export class VolumeClusteringAnalyzer extends EventEmitter {
  private readonly thresholds: ClusterThresholdConfig;
  private readonly enableEvents: boolean;
  private readonly alertCooldownMs: number;
  private readonly maxRecentClusters: number;
  private readonly slidingWindowStepMs: number;

  // Recent clusters
  private readonly recentClusters: VolumeCluster[] = [];

  // Alert cooldown tracking
  private readonly lastAlertTime: Map<string, number> = new Map();

  // Stats tracking
  private totalClustersDetected = 0;
  private clustersBySeverity: Record<ClusterSeverity, number> = {
    [ClusterSeverity.LOW]: 0,
    [ClusterSeverity.MEDIUM]: 0,
    [ClusterSeverity.HIGH]: 0,
    [ClusterSeverity.CRITICAL]: 0,
  };
  private clustersByType: Record<CoordinationType, number> = {
    [CoordinationType.DIRECTIONAL]: 0,
    [CoordinationType.COUNTER_TRADING]: 0,
    [CoordinationType.SPLIT_ORDERS]: 0,
    [CoordinationType.TIMED_COORDINATION]: 0,
    [CoordinationType.MIXED]: 0,
  };

  constructor(config?: VolumeClusteringAnalyzerConfig) {
    super();

    this.thresholds = {
      ...DEFAULT_CLUSTER_THRESHOLDS,
      ...config?.thresholds,
      scoreWeights: {
        ...DEFAULT_CLUSTER_THRESHOLDS.scoreWeights,
        ...config?.thresholds?.scoreWeights,
      },
      severityThresholds: {
        ...DEFAULT_CLUSTER_THRESHOLDS.severityThresholds,
        ...config?.thresholds?.severityThresholds,
      },
    };

    this.enableEvents = config?.enableEvents ?? true;
    this.alertCooldownMs = config?.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
    this.maxRecentClusters = config?.maxRecentClusters ?? DEFAULT_MAX_RECENT_CLUSTERS;
    this.slidingWindowStepMs = config?.slidingWindowStepMs ?? DEFAULT_SLIDING_WINDOW_STEP_MS;
  }

  /**
   * Analyze a set of trades for volume clustering
   */
  analyzeTrades(
    trades: ClusterTrade[],
    options?: AnalyzeTradesOptions
  ): ClusterDetectionResult {
    const now = Date.now();
    const effectiveThresholds = {
      ...this.thresholds,
      ...options?.thresholds,
      scoreWeights: {
        ...this.thresholds.scoreWeights,
        ...options?.thresholds?.scoreWeights,
      },
      severityThresholds: {
        ...this.thresholds.severityThresholds,
        ...options?.thresholds?.severityThresholds,
      },
    };

    if (trades.length === 0) {
      return this.createEmptyResult("", now, effectiveThresholds);
    }

    // Determine market (all trades should be for same market)
    const marketId = trades[0]!.marketId;

    // Filter trades to window
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const windowStart = options?.windowStart ?? sortedTrades[0]!.timestamp;
    const windowEnd =
      options?.windowEnd ?? sortedTrades[sortedTrades.length - 1]!.timestamp;

    const windowTrades = sortedTrades.filter(
      (t) => t.timestamp >= windowStart && t.timestamp <= windowEnd
    );

    if (windowTrades.length < effectiveThresholds.minTrades) {
      return this.createEmptyResult(marketId, now, effectiveThresholds, {
        windowStart,
        windowEnd,
        totalTrades: windowTrades.length,
        uniqueWallets: new Set(windowTrades.map((t) => t.walletAddress.toLowerCase())).size,
        totalVolume: windowTrades.reduce((sum, t) => sum + t.sizeUsd, 0),
      });
    }

    // Group by wallet
    const walletTrades = new Map<string, ClusterTrade[]>();
    for (const trade of windowTrades) {
      const key = trade.walletAddress.toLowerCase();
      if (!walletTrades.has(key)) {
        walletTrades.set(key, []);
      }
      walletTrades.get(key)!.push(trade);
    }

    const uniqueWallets = walletTrades.size;

    if (uniqueWallets < effectiveThresholds.minWallets) {
      return this.createEmptyResult(marketId, now, effectiveThresholds, {
        windowStart,
        windowEnd,
        totalTrades: windowTrades.length,
        uniqueWallets,
        totalVolume: windowTrades.reduce((sum, t) => sum + t.sizeUsd, 0),
      });
    }

    // Calculate cluster metrics
    let totalVolume = 0;
    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of windowTrades) {
      totalVolume += trade.sizeUsd;
      if (trade.side === "BUY") {
        buyVolume += trade.sizeUsd;
      } else {
        sellVolume += trade.sizeUsd;
      }
    }

    if (totalVolume < effectiveThresholds.minVolumeUsd) {
      return this.createEmptyResult(marketId, now, effectiveThresholds, {
        windowStart,
        windowEnd,
        totalTrades: windowTrades.length,
        uniqueWallets,
        totalVolume,
      });
    }

    // Calculate timing metrics
    const intervals: number[] = [];
    for (let i = 1; i < windowTrades.length; i++) {
      intervals.push(windowTrades[i]!.timestamp - windowTrades[i - 1]!.timestamp);
    }

    const avgTimeBetweenTrades =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;
    const timingRegularity = calculateTimingRegularity(
      intervals,
      effectiveThresholds.maxTimingCoV
    );

    // Calculate direction metrics
    const buyRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5;
    const directionImbalance = Math.abs(buyRatio - 0.5) * 2;

    // Calculate average trades per wallet
    const avgTradesPerWallet = windowTrades.length / uniqueWallets;

    // Determine coordination type
    const coordinationType = determineCoordinationType(
      buyRatio,
      timingRegularity,
      avgTradesPerWallet,
      uniqueWallets,
      effectiveThresholds
    );

    // Calculate coordination score
    const coordinationScore = calculateCoordinationScore(
      uniqueWallets,
      windowTrades.length,
      directionImbalance,
      timingRegularity,
      totalVolume,
      effectiveThresholds.minVolumeUsd,
      effectiveThresholds.scoreWeights
    );

    // Check if significant cluster
    if (coordinationScore < effectiveThresholds.minCoordinationScore) {
      return this.createEmptyResult(marketId, now, effectiveThresholds, {
        windowStart,
        windowEnd,
        totalTrades: windowTrades.length,
        uniqueWallets,
        totalVolume,
      });
    }

    // Determine severity
    const severity = determineSeverity(
      coordinationScore,
      effectiveThresholds.severityThresholds
    );

    // Build cluster
    const durationMs = windowEnd - windowStart;
    const cluster: Omit<VolumeCluster, "flagReasons"> = {
      clusterId: generateClusterId(),
      marketId,
      coordinationType,
      severity,
      walletAddresses: Array.from(walletTrades.keys()),
      walletCount: uniqueWallets,
      tradeIds: windowTrades.map((t) => t.tradeId),
      tradeCount: windowTrades.length,
      totalVolumeUsd: totalVolume,
      averageTradeSize: totalVolume / windowTrades.length,
      startTime: new Date(windowStart),
      endTime: new Date(windowEnd),
      durationMs,
      windowMs: effectiveThresholds.windowMs,
      coordinationScore,
      buyVolumeUsd: buyVolume,
      sellVolumeUsd: sellVolume,
      buySellRatio: buyRatio,
      directionImbalance,
      averageTimeBetweenTradesMs: avgTimeBetweenTrades,
      timingRegularity,
      detectedAt: new Date(now),
    };

    const flagReasons = generateFlagReasons(cluster);
    const fullCluster: VolumeCluster = { ...cluster, flagReasons };

    // Record cluster if we can emit
    if (this.canEmitAlert(marketId, options?.bypassCooldown ?? false, now)) {
      this.recordCluster(fullCluster, now);
    }

    return {
      marketId,
      windowStart: new Date(windowStart),
      windowEnd: new Date(windowEnd),
      hasCluster: true,
      cluster: fullCluster,
      totalTradesInWindow: windowTrades.length,
      uniqueWalletsInWindow: uniqueWallets,
      totalVolumeInWindow: totalVolume,
      analyzedAt: new Date(now),
    };
  }

  /**
   * Analyze trades with sliding windows
   */
  analyzeTradesWithSlidingWindow(
    trades: ClusterTrade[],
    options?: AnalyzeTradesOptions
  ): ClusterDetectionResult[] {
    if (trades.length === 0) return [];

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const effectiveThresholds = {
      ...this.thresholds,
      ...options?.thresholds,
    };

    const results: ClusterDetectionResult[] = [];
    const startTime = sortedTrades[0]!.timestamp;
    const endTime = sortedTrades[sortedTrades.length - 1]!.timestamp;

    // Slide window through the data
    for (
      let windowStart = startTime;
      windowStart <= endTime;
      windowStart += this.slidingWindowStepMs
    ) {
      const windowEnd = windowStart + effectiveThresholds.windowMs;

      const windowTrades = sortedTrades.filter(
        (t) => t.timestamp >= windowStart && t.timestamp <= windowEnd
      );

      if (windowTrades.length >= effectiveThresholds.minTrades) {
        const result = this.analyzeTrades(windowTrades, {
          ...options,
          windowStart,
          windowEnd,
        });
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Analyze multiple markets
   */
  analyzeMultipleMarkets(
    tradesByMarket: Map<string, ClusterTrade[]>,
    options?: AnalyzeTradesOptions
  ): BatchClusterDetectionResult {
    const startTime = Date.now();
    const resultsByMarket = new Map<string, ClusterDetectionResult[]>();
    const allClusters: VolumeCluster[] = [];
    let totalTrades = 0;

    const bySeverity: Record<ClusterSeverity, number> = {
      [ClusterSeverity.LOW]: 0,
      [ClusterSeverity.MEDIUM]: 0,
      [ClusterSeverity.HIGH]: 0,
      [ClusterSeverity.CRITICAL]: 0,
    };

    const byCoordinationType: Record<CoordinationType, number> = {
      [CoordinationType.DIRECTIONAL]: 0,
      [CoordinationType.COUNTER_TRADING]: 0,
      [CoordinationType.SPLIT_ORDERS]: 0,
      [CoordinationType.TIMED_COORDINATION]: 0,
      [CoordinationType.MIXED]: 0,
    };

    for (const [marketId, trades] of tradesByMarket.entries()) {
      totalTrades += trades.length;

      const results = this.analyzeTradesWithSlidingWindow(trades, options);
      resultsByMarket.set(marketId, results);

      for (const result of results) {
        if (result.hasCluster && result.cluster) {
          allClusters.push(result.cluster);
          bySeverity[result.cluster.severity]++;
          byCoordinationType[result.cluster.coordinationType]++;
        }
      }
    }

    return {
      resultsByMarket,
      clusters: allClusters,
      totalTradesProcessed: totalTrades,
      totalClustersDetected: allClusters.length,
      bySeverity,
      byCoordinationType,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get recent clusters for a market
   */
  getMarketClusters(marketId: string, limit: number = 10): VolumeCluster[] {
    return this.recentClusters
      .filter((c) => c.marketId === marketId)
      .slice(0, limit);
  }

  /**
   * Get recent clusters involving a wallet
   */
  getWalletClusters(walletAddress: string, limit: number = 10): VolumeCluster[] {
    const lowerWallet = walletAddress.toLowerCase();
    return this.recentClusters
      .filter((c) => c.walletAddresses.includes(lowerWallet))
      .slice(0, limit);
  }

  /**
   * Get all recent clusters
   */
  getRecentClusters(limit: number = 20): VolumeCluster[] {
    return this.recentClusters.slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(): ClusteringAnalyzerSummary {
    // Calculate unique markets and wallets
    const markets = new Set<string>();
    const wallets = new Set<string>();
    let totalVolume = 0;

    for (const cluster of this.recentClusters) {
      markets.add(cluster.marketId);
      for (const wallet of cluster.walletAddresses) {
        wallets.add(wallet);
      }
      totalVolume += cluster.totalVolumeUsd;
    }

    // Calculate top markets
    const marketCounts = new Map<string, { count: number; volume: number }>();
    for (const cluster of this.recentClusters) {
      const current = marketCounts.get(cluster.marketId) ?? { count: 0, volume: 0 };
      marketCounts.set(cluster.marketId, {
        count: current.count + 1,
        volume: current.volume + cluster.totalVolumeUsd,
      });
    }

    const topClusterMarkets = Array.from(marketCounts.entries())
      .map(([marketId, data]) => ({
        marketId,
        clusterCount: data.count,
        totalVolumeUsd: data.volume,
      }))
      .sort((a, b) => b.clusterCount - a.clusterCount)
      .slice(0, 10);

    // Calculate top wallets
    const walletCounts = new Map<string, { count: number; volume: number }>();
    for (const cluster of this.recentClusters) {
      for (const wallet of cluster.walletAddresses) {
        const current = walletCounts.get(wallet) ?? { count: 0, volume: 0 };
        walletCounts.set(wallet, {
          count: current.count + 1,
          volume: current.volume + cluster.totalVolumeUsd / cluster.walletCount,
        });
      }
    }

    const topClusteredWallets = Array.from(walletCounts.entries())
      .map(([walletAddress, data]) => ({
        walletAddress,
        clusterCount: data.count,
        totalVolumeUsd: data.volume,
      }))
      .sort((a, b) => b.clusterCount - a.clusterCount)
      .slice(0, 10);

    return {
      totalClustersDetected: this.totalClustersDetected,
      marketsWithClusters: markets.size,
      walletsInClusters: wallets.size,
      totalClusterVolumeUsd: totalVolume,
      bySeverity: { ...this.clustersBySeverity },
      byCoordinationType: { ...this.clustersByType },
      recentClusters: this.recentClusters.slice(0, 20),
      topClusterMarkets,
      topClusteredWallets,
    };
  }

  /**
   * Get threshold configuration
   */
  getThresholds(): ClusterThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    totalClustersDetected: number;
    recentClusterCount: number;
    enableEvents: boolean;
    alertCooldownMs: number;
    slidingWindowStepMs: number;
  } {
    return {
      totalClustersDetected: this.totalClustersDetected,
      recentClusterCount: this.recentClusters.length,
      enableEvents: this.enableEvents,
      alertCooldownMs: this.alertCooldownMs,
      slidingWindowStepMs: this.slidingWindowStepMs,
    };
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.recentClusters.length = 0;
    this.lastAlertTime.clear();
    this.totalClustersDetected = 0;
    this.clustersBySeverity = {
      [ClusterSeverity.LOW]: 0,
      [ClusterSeverity.MEDIUM]: 0,
      [ClusterSeverity.HIGH]: 0,
      [ClusterSeverity.CRITICAL]: 0,
    };
    this.clustersByType = {
      [CoordinationType.DIRECTIONAL]: 0,
      [CoordinationType.COUNTER_TRADING]: 0,
      [CoordinationType.SPLIT_ORDERS]: 0,
      [CoordinationType.TIMED_COORDINATION]: 0,
      [CoordinationType.MIXED]: 0,
    };
  }

  /**
   * Clear clusters for a specific market
   */
  clearMarket(marketId: string): void {
    const remaining = this.recentClusters.filter((c) => c.marketId !== marketId);
    this.recentClusters.length = 0;
    this.recentClusters.push(...remaining);
    this.lastAlertTime.delete(marketId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createEmptyResult(
    marketId: string,
    now: number,
    thresholds: ClusterThresholdConfig,
    info?: {
      windowStart?: number;
      windowEnd?: number;
      totalTrades?: number;
      uniqueWallets?: number;
      totalVolume?: number;
    }
  ): ClusterDetectionResult {
    return {
      marketId,
      windowStart: new Date(info?.windowStart ?? now - thresholds.windowMs),
      windowEnd: new Date(info?.windowEnd ?? now),
      hasCluster: false,
      cluster: null,
      totalTradesInWindow: info?.totalTrades ?? 0,
      uniqueWalletsInWindow: info?.uniqueWallets ?? 0,
      totalVolumeInWindow: info?.totalVolume ?? 0,
      analyzedAt: new Date(now),
    };
  }

  private recordCluster(cluster: VolumeCluster, now: number): void {
    // Store cluster
    this.recentClusters.unshift(cluster);
    if (this.recentClusters.length > this.maxRecentClusters) {
      this.recentClusters.pop();
    }

    // Update stats
    this.totalClustersDetected++;
    this.clustersBySeverity[cluster.severity]++;
    this.clustersByType[cluster.coordinationType]++;

    // Update cooldown
    this.lastAlertTime.set(cluster.marketId, now);

    // Emit events
    if (this.enableEvents) {
      this.emit("clusterDetected", cluster);

      if (cluster.severity === ClusterSeverity.CRITICAL) {
        this.emit("criticalCluster", cluster);
      }
    }
  }

  private canEmitAlert(
    marketId: string,
    bypassCooldown: boolean,
    now: number
  ): boolean {
    if (bypassCooldown) return true;

    const lastAlert = this.lastAlertTime.get(marketId);
    if (!lastAlert) return true;

    return now - lastAlert >= this.alertCooldownMs;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedAnalyzer: VolumeClusteringAnalyzer | null = null;

/**
 * Create a new VolumeClusteringAnalyzer instance
 */
export function createVolumeClusteringAnalyzer(
  config?: VolumeClusteringAnalyzerConfig
): VolumeClusteringAnalyzer {
  return new VolumeClusteringAnalyzer(config);
}

/**
 * Get the shared VolumeClusteringAnalyzer instance
 */
export function getSharedVolumeClusteringAnalyzer(): VolumeClusteringAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new VolumeClusteringAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared VolumeClusteringAnalyzer instance
 */
export function setSharedVolumeClusteringAnalyzer(
  analyzer: VolumeClusteringAnalyzer
): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared VolumeClusteringAnalyzer instance
 */
export function resetSharedVolumeClusteringAnalyzer(): void {
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
 * Analyze trades for volume clustering (convenience function)
 */
export function analyzeTradesForClustering(
  trades: ClusterTrade[],
  options?: AnalyzeTradesOptions & { analyzer?: VolumeClusteringAnalyzer }
): ClusterDetectionResult {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.analyzeTrades(trades, options);
}

/**
 * Analyze trades with sliding window (convenience function)
 */
export function analyzeTradesWithSlidingWindow(
  trades: ClusterTrade[],
  options?: AnalyzeTradesOptions & { analyzer?: VolumeClusteringAnalyzer }
): ClusterDetectionResult[] {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.analyzeTradesWithSlidingWindow(trades, options);
}

/**
 * Analyze multiple markets for clustering (convenience function)
 */
export function analyzeMultipleMarketsForClustering(
  tradesByMarket: Map<string, ClusterTrade[]>,
  options?: AnalyzeTradesOptions & { analyzer?: VolumeClusteringAnalyzer }
): BatchClusterDetectionResult {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.analyzeMultipleMarkets(tradesByMarket, options);
}

/**
 * Get recent volume clusters (convenience function)
 */
export function getRecentVolumeClusters(
  limit?: number,
  options?: { analyzer?: VolumeClusteringAnalyzer }
): VolumeCluster[] {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.getRecentClusters(limit);
}

/**
 * Get volume clusters for a market (convenience function)
 */
export function getMarketVolumeClusters(
  marketId: string,
  limit?: number,
  options?: { analyzer?: VolumeClusteringAnalyzer }
): VolumeCluster[] {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.getMarketClusters(marketId, limit);
}

/**
 * Get volume clusters for a wallet (convenience function)
 */
export function getWalletVolumeClusters(
  walletAddress: string,
  limit?: number,
  options?: { analyzer?: VolumeClusteringAnalyzer }
): VolumeCluster[] {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.getWalletClusters(walletAddress, limit);
}

/**
 * Get volume clustering summary (convenience function)
 */
export function getVolumeClusteringSummary(
  options?: { analyzer?: VolumeClusteringAnalyzer }
): ClusteringAnalyzerSummary {
  const analyzer = options?.analyzer ?? getSharedVolumeClusteringAnalyzer();
  return analyzer.getSummary();
}
