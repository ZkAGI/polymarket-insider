/**
 * Wallet Clustering Algorithm (AI-PAT-003)
 *
 * Cluster wallets by behavioral similarity to identify groups
 * that may be related or exhibit similar trading patterns.
 *
 * Features:
 * - Extract wallet behavioral features
 * - Apply K-means clustering algorithm
 * - Assign cluster labels to wallets
 * - Update clusters periodically
 * - Support hierarchical clustering
 * - Silhouette score for cluster quality
 * - Event emission for cluster changes
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Feature categories for wallet clustering
 */
export enum ClusterFeatureCategory {
  /** Trading activity metrics */
  TRADING_ACTIVITY = "TRADING_ACTIVITY",
  /** Volume and size patterns */
  VOLUME_PATTERNS = "VOLUME_PATTERNS",
  /** Timing and scheduling patterns */
  TIMING_PATTERNS = "TIMING_PATTERNS",
  /** Market selection preferences */
  MARKET_PREFERENCES = "MARKET_PREFERENCES",
  /** Performance metrics */
  PERFORMANCE = "PERFORMANCE",
  /** Risk and behavior indicators */
  RISK_INDICATORS = "RISK_INDICATORS",
}

/**
 * Clustering algorithm types
 */
export enum ClusteringAlgorithm {
  /** K-means clustering */
  KMEANS = "KMEANS",
  /** K-means++ with smart initialization */
  KMEANS_PLUS_PLUS = "KMEANS_PLUS_PLUS",
  /** Hierarchical agglomerative clustering */
  HIERARCHICAL = "HIERARCHICAL",
  /** DBSCAN density-based clustering */
  DBSCAN = "DBSCAN",
}

/**
 * Distance metric for similarity calculation
 */
export enum DistanceMetric {
  /** Euclidean distance */
  EUCLIDEAN = "EUCLIDEAN",
  /** Manhattan distance */
  MANHATTAN = "MANHATTAN",
  /** Cosine similarity */
  COSINE = "COSINE",
}

/**
 * Cluster quality level
 */
export enum ClusterQuality {
  /** Excellent cluster separation */
  EXCELLENT = "EXCELLENT",
  /** Good cluster quality */
  GOOD = "GOOD",
  /** Fair cluster quality */
  FAIR = "FAIR",
  /** Poor cluster quality */
  POOR = "POOR",
  /** Very poor / no clear structure */
  VERY_POOR = "VERY_POOR",
}

/**
 * Wallet risk level based on cluster membership
 */
export enum WalletClusterRiskLevel {
  /** No significant risk */
  NONE = "NONE",
  /** Low risk */
  LOW = "LOW",
  /** Medium risk */
  MEDIUM = "MEDIUM",
  /** High risk */
  HIGH = "HIGH",
  /** Critical risk */
  CRITICAL = "CRITICAL",
}

/**
 * Feature definition for clustering
 */
export interface ClusterFeatureDefinition {
  /** Feature name */
  name: string;
  /** Feature category */
  category: ClusterFeatureCategory;
  /** Feature description */
  description: string;
  /** Default value when missing */
  defaultValue: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Weight for feature importance */
  weight: number;
  /** Whether to normalize the feature */
  normalize: boolean;
}

/**
 * Wallet feature vector for clustering
 */
export interface WalletFeatureVector {
  /** Wallet address */
  walletAddress: string;
  /** Feature values indexed by feature name */
  features: Record<string, number>;
  /** Normalized feature values (0-1) */
  normalizedFeatures: Record<string, number>;
  /** Feature extraction timestamp */
  extractedAt: Date;
  /** Data quality score (0-1) */
  dataQuality: number;
  /** Missing features */
  missingFeatures: string[];
}

/**
 * Cluster centroid
 */
export interface ClusterCentroid {
  /** Cluster ID */
  clusterId: string;
  /** Centroid feature values */
  features: Record<string, number>;
  /** Number of wallets in cluster */
  memberCount: number;
  /** Sum of squared distances to members */
  inertia: number;
}

/**
 * Wallet cluster membership
 */
export interface WalletClusterMembership {
  /** Wallet address */
  walletAddress: string;
  /** Assigned cluster ID */
  clusterId: string;
  /** Distance to cluster centroid */
  distanceToCentroid: number;
  /** Membership confidence (0-1) */
  confidence: number;
  /** Distances to all centroids */
  distanceToAllCentroids: Record<string, number>;
  /** Second closest cluster ID */
  secondClosestClusterId: string | null;
  /** Assignment timestamp */
  assignedAt: Date;
}

/**
 * Cluster definition
 */
export interface WalletCluster {
  /** Unique cluster ID */
  clusterId: string;
  /** Cluster label/name */
  label: string;
  /** Cluster centroid */
  centroid: ClusterCentroid;
  /** Member wallet addresses */
  members: string[];
  /** Member count */
  memberCount: number;
  /** Average distance to centroid */
  avgDistanceToCentroid: number;
  /** Cluster compactness (lower is better) */
  compactness: number;
  /** Dominant features in cluster */
  dominantFeatures: DominantFeature[];
  /** Risk level of cluster */
  riskLevel: WalletClusterRiskLevel;
  /** Risk indicators */
  riskIndicators: string[];
  /** Cluster creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Dominant feature in a cluster
 */
export interface DominantFeature {
  /** Feature name */
  featureName: string;
  /** Average value in cluster */
  avgValue: number;
  /** Standard deviation in cluster */
  stdDev: number;
  /** How much above/below global average */
  deviationFromGlobal: number;
  /** Importance score for cluster identity */
  importance: number;
}

/**
 * Clustering result
 */
export interface ClusteringResult {
  /** Result ID */
  resultId: string;
  /** Clustering algorithm used */
  algorithm: ClusteringAlgorithm;
  /** Number of clusters */
  numClusters: number;
  /** Clusters */
  clusters: WalletCluster[];
  /** Wallet memberships */
  memberships: WalletClusterMembership[];
  /** Silhouette score (-1 to 1) */
  silhouetteScore: number;
  /** Cluster quality assessment */
  quality: ClusterQuality;
  /** Total inertia (sum of squared distances) */
  totalInertia: number;
  /** Number of iterations to converge */
  iterations: number;
  /** Whether algorithm converged */
  converged: boolean;
  /** Clustering timestamp */
  clusteredAt: Date;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Clustering configuration
 */
export interface ClusteringConfig {
  /** Clustering algorithm to use */
  algorithm: ClusteringAlgorithm;
  /** Number of clusters (for K-means) */
  numClusters: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Convergence threshold */
  convergenceThreshold: number;
  /** Distance metric */
  distanceMetric: DistanceMetric;
  /** Feature definitions */
  features: ClusterFeatureDefinition[];
  /** Minimum samples per cluster */
  minSamplesPerCluster: number;
  /** Random seed for reproducibility */
  randomSeed?: number;
  /** Whether to auto-determine optimal K */
  autoOptimizeK: boolean;
  /** K range for optimization [min, max] */
  kRange: [number, number];
  /** Risk threshold configuration */
  riskThresholds: RiskThresholds;
}

/**
 * Risk threshold configuration
 */
export interface RiskThresholds {
  /** Threshold for high risk cluster */
  highRiskThreshold: number;
  /** Threshold for critical risk cluster */
  criticalRiskThreshold: number;
  /** Minimum suspicious feature count */
  minSuspiciousFeatures: number;
  /** Fresh wallet ratio threshold */
  freshWalletRatioThreshold: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttlMs: number;
  /** Maximum cache size */
  maxSize: number;
}

/**
 * Events emitted by the clustering system
 */
export interface ClusteringEvents {
  /** Emitted when clustering starts */
  clustering_started: {
    walletCount: number;
    algorithm: ClusteringAlgorithm;
  };
  /** Emitted after each iteration */
  iteration_complete: {
    iteration: number;
    inertia: number;
    centersChanged: boolean;
  };
  /** Emitted when clustering completes */
  clustering_complete: {
    resultId: string;
    numClusters: number;
    silhouetteScore: number;
    processingTimeMs: number;
  };
  /** Emitted when a wallet is assigned to a cluster */
  wallet_assigned: {
    walletAddress: string;
    clusterId: string;
    confidence: number;
  };
  /** Emitted when a high-risk cluster is detected */
  high_risk_cluster_detected: {
    clusterId: string;
    riskLevel: WalletClusterRiskLevel;
    memberCount: number;
    riskIndicators: string[];
  };
  /** Emitted on cache events */
  cache_hit: { walletAddress: string };
  cache_miss: { walletAddress: string };
  /** Emitted on errors */
  error: { message: string; error?: Error };
}

// ============================================================================
// Default Feature Definitions
// ============================================================================

/**
 * Default feature definitions for wallet clustering
 */
export const DEFAULT_CLUSTER_FEATURE_DEFINITIONS: ClusterFeatureDefinition[] = [
  // Trading activity features
  {
    name: "total_trades",
    category: ClusterFeatureCategory.TRADING_ACTIVITY,
    description: "Total number of trades",
    defaultValue: 0,
    min: 0,
    max: 100000,
    weight: 1.0,
    normalize: true,
  },
  {
    name: "unique_markets",
    category: ClusterFeatureCategory.TRADING_ACTIVITY,
    description: "Number of unique markets traded",
    defaultValue: 0,
    min: 0,
    max: 1000,
    weight: 0.9,
    normalize: true,
  },
  {
    name: "trade_frequency_per_day",
    category: ClusterFeatureCategory.TRADING_ACTIVITY,
    description: "Average trades per day",
    defaultValue: 0,
    min: 0,
    max: 1000,
    weight: 0.8,
    normalize: true,
  },
  {
    name: "active_days_ratio",
    category: ClusterFeatureCategory.TRADING_ACTIVITY,
    description: "Ratio of days with trading activity",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 0.7,
    normalize: false,
  },

  // Volume patterns
  {
    name: "avg_trade_size_usd",
    category: ClusterFeatureCategory.VOLUME_PATTERNS,
    description: "Average trade size in USD",
    defaultValue: 0,
    min: 0,
    max: 10000000,
    weight: 1.2,
    normalize: true,
  },
  {
    name: "total_volume_usd",
    category: ClusterFeatureCategory.VOLUME_PATTERNS,
    description: "Total trading volume in USD",
    defaultValue: 0,
    min: 0,
    max: 100000000,
    weight: 1.0,
    normalize: true,
  },
  {
    name: "trade_size_variance",
    category: ClusterFeatureCategory.VOLUME_PATTERNS,
    description: "Variance in trade sizes",
    defaultValue: 0,
    min: 0,
    max: 1000000000,
    weight: 0.8,
    normalize: true,
  },
  {
    name: "whale_trade_ratio",
    category: ClusterFeatureCategory.VOLUME_PATTERNS,
    description: "Ratio of whale-sized trades",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.1,
    normalize: false,
  },

  // Timing patterns
  {
    name: "avg_time_between_trades_hours",
    category: ClusterFeatureCategory.TIMING_PATTERNS,
    description: "Average time between trades in hours",
    defaultValue: 24,
    min: 0,
    max: 720, // 30 days
    weight: 0.9,
    normalize: true,
  },
  {
    name: "off_hours_trading_ratio",
    category: ClusterFeatureCategory.TIMING_PATTERNS,
    description: "Ratio of trades during off-hours",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.0,
    normalize: false,
  },
  {
    name: "pre_event_trading_ratio",
    category: ClusterFeatureCategory.TIMING_PATTERNS,
    description: "Ratio of trades before market events",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.3,
    normalize: false,
  },
  {
    name: "timing_consistency_score",
    category: ClusterFeatureCategory.TIMING_PATTERNS,
    description: "Consistency of trading schedule",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 0.7,
    normalize: false,
  },

  // Market preferences
  {
    name: "market_concentration_score",
    category: ClusterFeatureCategory.MARKET_PREFERENCES,
    description: "Concentration in specific markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.0,
    normalize: false,
  },
  {
    name: "niche_market_ratio",
    category: ClusterFeatureCategory.MARKET_PREFERENCES,
    description: "Ratio of trades in niche markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.1,
    normalize: false,
  },
  {
    name: "political_market_ratio",
    category: ClusterFeatureCategory.MARKET_PREFERENCES,
    description: "Ratio of trades in political markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.0,
    normalize: false,
  },
  {
    name: "category_diversity_score",
    category: ClusterFeatureCategory.MARKET_PREFERENCES,
    description: "Diversity across market categories",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 0.8,
    normalize: false,
  },

  // Performance metrics
  {
    name: "win_rate",
    category: ClusterFeatureCategory.PERFORMANCE,
    description: "Win rate of resolved positions",
    defaultValue: 0.5,
    min: 0,
    max: 1,
    weight: 1.4,
    normalize: false,
  },
  {
    name: "profit_factor",
    category: ClusterFeatureCategory.PERFORMANCE,
    description: "Profit factor (gross profit / gross loss)",
    defaultValue: 1,
    min: 0,
    max: 100,
    weight: 1.2,
    normalize: true,
  },
  {
    name: "avg_holding_period_hours",
    category: ClusterFeatureCategory.PERFORMANCE,
    description: "Average position holding period",
    defaultValue: 24,
    min: 0,
    max: 8760, // 1 year
    weight: 0.9,
    normalize: true,
  },
  {
    name: "max_consecutive_wins",
    category: ClusterFeatureCategory.PERFORMANCE,
    description: "Maximum consecutive winning trades",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.1,
    normalize: true,
  },

  // Risk indicators
  {
    name: "wallet_age_days",
    category: ClusterFeatureCategory.RISK_INDICATORS,
    description: "Age of wallet in days",
    defaultValue: 0,
    min: 0,
    max: 3650, // 10 years
    weight: 1.3,
    normalize: true,
  },
  {
    name: "coordination_score",
    category: ClusterFeatureCategory.RISK_INDICATORS,
    description: "Score indicating coordinated behavior",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.5,
    normalize: true,
  },
  {
    name: "sybil_risk_score",
    category: ClusterFeatureCategory.RISK_INDICATORS,
    description: "Sybil attack risk score",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.4,
    normalize: true,
  },
  {
    name: "suspicion_score",
    category: ClusterFeatureCategory.RISK_INDICATORS,
    description: "Overall suspicion score",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.2,
    normalize: true,
  },
];

/**
 * Default clustering configuration
 */
export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
  algorithm: ClusteringAlgorithm.KMEANS_PLUS_PLUS,
  numClusters: 5,
  maxIterations: 100,
  convergenceThreshold: 0.0001,
  distanceMetric: DistanceMetric.EUCLIDEAN,
  features: DEFAULT_CLUSTER_FEATURE_DEFINITIONS,
  minSamplesPerCluster: 3,
  randomSeed: undefined,
  autoOptimizeK: false,
  kRange: [2, 10],
  riskThresholds: {
    highRiskThreshold: 60,
    criticalRiskThreshold: 80,
    minSuspiciousFeatures: 3,
    freshWalletRatioThreshold: 0.7,
  },
};

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSize: 10000,
};

// ============================================================================
// Wallet Clustering Class
// ============================================================================

/**
 * Wallet clustering algorithm implementation
 */
export class WalletClustering extends EventEmitter {
  private config: ClusteringConfig;
  // Cache config is stored for future use (incremental clustering, cache invalidation)
  private cacheConfig: CacheConfig;

  // Feature vectors cache
  private featureCache: Map<
    string,
    { vector: WalletFeatureVector; timestamp: number }
  > = new Map();

  // Latest clustering result
  private latestResult: ClusteringResult | null = null;

  // Membership lookup
  private membershipLookup: Map<string, WalletClusterMembership> = new Map();

  // Statistics
  private stats = {
    totalClusterings: 0,
    totalWalletsClustered: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgSilhouetteScore: 0,
  };

  // Random seed counter for reproducibility
  private seedCounter = 0;

  constructor(
    config: Partial<ClusteringConfig> = {},
    cacheConfig: Partial<CacheConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CLUSTERING_CONFIG, ...config };
    this.cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...cacheConfig };
    if (this.config.randomSeed !== undefined) {
      this.seedCounter = this.config.randomSeed;
    }
  }

  // ============================================================================
  // Configuration Getters
  // ============================================================================

  /**
   * Get the current cache configuration
   */
  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  // ============================================================================
  // Feature Extraction
  // ============================================================================

  /**
   * Extract feature vector from raw wallet data
   */
  extractFeatures(walletData: WalletData): WalletFeatureVector {
    const features: Record<string, number> = {};
    const missingFeatures: string[] = [];

    // Extract each feature from wallet data
    for (const featureDef of this.config.features) {
      const value = this.extractSingleFeature(walletData, featureDef);
      if (value === null) {
        features[featureDef.name] = featureDef.defaultValue;
        missingFeatures.push(featureDef.name);
      } else {
        // Clamp to min/max
        features[featureDef.name] = Math.max(
          featureDef.min,
          Math.min(featureDef.max, value)
        );
      }
    }

    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(features);

    // Calculate data quality score
    const dataQuality =
      1 - missingFeatures.length / this.config.features.length;

    return {
      walletAddress: walletData.address,
      features,
      normalizedFeatures,
      extractedAt: new Date(),
      dataQuality,
      missingFeatures,
    };
  }

  /**
   * Extract a single feature value from wallet data
   */
  private extractSingleFeature(
    walletData: WalletData,
    featureDef: ClusterFeatureDefinition
  ): number | null {
    // Map feature names to wallet data properties
    const featureMapping: Record<string, () => number | null> = {
      total_trades: () => walletData.totalTrades ?? null,
      unique_markets: () => walletData.uniqueMarkets ?? null,
      trade_frequency_per_day: () => walletData.tradeFrequencyPerDay ?? null,
      active_days_ratio: () => walletData.activeDaysRatio ?? null,
      avg_trade_size_usd: () => walletData.avgTradeSizeUsd ?? null,
      total_volume_usd: () => walletData.totalVolumeUsd ?? null,
      trade_size_variance: () => walletData.tradeSizeVariance ?? null,
      whale_trade_ratio: () => walletData.whaleTradeRatio ?? null,
      avg_time_between_trades_hours: () =>
        walletData.avgTimeBetweenTradesHours ?? null,
      off_hours_trading_ratio: () => walletData.offHoursTradingRatio ?? null,
      pre_event_trading_ratio: () => walletData.preEventTradingRatio ?? null,
      timing_consistency_score: () => walletData.timingConsistencyScore ?? null,
      market_concentration_score: () =>
        walletData.marketConcentrationScore ?? null,
      niche_market_ratio: () => walletData.nicheMarketRatio ?? null,
      political_market_ratio: () => walletData.politicalMarketRatio ?? null,
      category_diversity_score: () => walletData.categoryDiversityScore ?? null,
      win_rate: () => walletData.winRate ?? null,
      profit_factor: () => walletData.profitFactor ?? null,
      avg_holding_period_hours: () => walletData.avgHoldingPeriodHours ?? null,
      max_consecutive_wins: () => walletData.maxConsecutiveWins ?? null,
      wallet_age_days: () => walletData.walletAgeDays ?? null,
      coordination_score: () => walletData.coordinationScore ?? null,
      sybil_risk_score: () => walletData.sybilRiskScore ?? null,
      suspicion_score: () => walletData.suspicionScore ?? null,
    };

    const extractor = featureMapping[featureDef.name];
    return extractor ? extractor() : null;
  }

  /**
   * Normalize features to 0-1 range
   */
  private normalizeFeatures(
    features: Record<string, number>
  ): Record<string, number> {
    const normalized: Record<string, number> = {};

    for (const featureDef of this.config.features) {
      const value = features[featureDef.name] ?? 0;
      if (featureDef.normalize && featureDef.max !== featureDef.min) {
        normalized[featureDef.name] =
          (value - featureDef.min) / (featureDef.max - featureDef.min);
      } else {
        // Already in 0-1 range or normalization disabled
        normalized[featureDef.name] = value;
      }
    }

    return normalized;
  }

  /**
   * Extract features for multiple wallets
   */
  extractFeaturesForWallets(
    walletDataList: WalletData[]
  ): WalletFeatureVector[] {
    return walletDataList.map((data) => this.extractFeatures(data));
  }

  // ============================================================================
  // Clustering Algorithms
  // ============================================================================

  /**
   * Perform clustering on wallet feature vectors
   */
  async cluster(
    featureVectors: WalletFeatureVector[]
  ): Promise<ClusteringResult> {
    const startTime = Date.now();

    this.emit("clustering_started", {
      walletCount: featureVectors.length,
      algorithm: this.config.algorithm,
    });

    if (featureVectors.length < this.config.numClusters) {
      throw new Error(
        `Not enough wallets (${featureVectors.length}) for ${this.config.numClusters} clusters`
      );
    }

    let result: ClusteringResult;

    switch (this.config.algorithm) {
      case ClusteringAlgorithm.KMEANS:
        result = this.kMeansClustering(featureVectors, false);
        break;
      case ClusteringAlgorithm.KMEANS_PLUS_PLUS:
        result = this.kMeansClustering(featureVectors, true);
        break;
      case ClusteringAlgorithm.DBSCAN:
        result = this.dbscanClustering(featureVectors);
        break;
      case ClusteringAlgorithm.HIERARCHICAL:
        result = this.hierarchicalClustering(featureVectors);
        break;
      default:
        result = this.kMeansClustering(featureVectors, true);
    }

    // Calculate silhouette score
    result.silhouetteScore = this.calculateSilhouetteScore(
      featureVectors,
      result.memberships
    );
    result.quality = this.assessClusterQuality(result.silhouetteScore);
    result.processingTimeMs = Date.now() - startTime;

    // Store result
    this.latestResult = result;

    // Update membership lookup
    this.membershipLookup.clear();
    for (const membership of result.memberships) {
      this.membershipLookup.set(membership.walletAddress, membership);
    }

    // Update stats
    this.stats.totalClusterings++;
    this.stats.totalWalletsClustered += featureVectors.length;
    this.stats.avgSilhouetteScore =
      (this.stats.avgSilhouetteScore * (this.stats.totalClusterings - 1) +
        result.silhouetteScore) /
      this.stats.totalClusterings;

    // Detect high-risk clusters
    for (const cluster of result.clusters) {
      if (
        cluster.riskLevel === WalletClusterRiskLevel.HIGH ||
        cluster.riskLevel === WalletClusterRiskLevel.CRITICAL
      ) {
        this.emit("high_risk_cluster_detected", {
          clusterId: cluster.clusterId,
          riskLevel: cluster.riskLevel,
          memberCount: cluster.memberCount,
          riskIndicators: cluster.riskIndicators,
        });
      }
    }

    this.emit("clustering_complete", {
      resultId: result.resultId,
      numClusters: result.numClusters,
      silhouetteScore: result.silhouetteScore,
      processingTimeMs: result.processingTimeMs,
    });

    return result;
  }

  /**
   * K-means clustering implementation
   */
  private kMeansClustering(
    featureVectors: WalletFeatureVector[],
    usePlusPlus: boolean
  ): ClusteringResult {
    const k = this.config.numClusters;

    // Initialize centroids
    let centroids = usePlusPlus
      ? this.initCentroidsPlusPlus(featureVectors, k)
      : this.initCentroidsRandom(featureVectors, k);

    let assignments = new Array<number>(featureVectors.length).fill(-1);
    let converged = false;
    let iteration = 0;
    let totalInertia = 0;

    while (iteration < this.config.maxIterations && !converged) {
      // Assignment step
      const newAssignments: number[] = [];
      totalInertia = 0;

      for (const vector of featureVectors) {
        let minDist = Infinity;
        let closestCentroid = 0;

        for (let c = 0; c < k; c++) {
          const centroid = centroids[c];
          if (centroid) {
            const dist = this.calculateDistance(
              vector.normalizedFeatures,
              centroid
            );
            if (dist < minDist) {
              minDist = dist;
              closestCentroid = c;
            }
          }
        }

        newAssignments.push(closestCentroid);
        totalInertia += minDist * minDist;
      }

      // Check convergence
      const centersChanged = !this.arraysEqual(assignments, newAssignments);
      assignments = newAssignments;

      // Update step
      const newCentroids = this.calculateNewCentroids(
        featureVectors,
        assignments,
        k
      );

      // Check if centroids changed significantly
      let maxCentroidChange = 0;
      for (let c = 0; c < k; c++) {
        const newCentroid = newCentroids[c];
        const oldCentroid = centroids[c];
        if (newCentroid && oldCentroid) {
          const change = this.calculateDistance(newCentroid, oldCentroid);
          maxCentroidChange = Math.max(maxCentroidChange, change);
        }
      }

      centroids = newCentroids;
      iteration++;

      converged = maxCentroidChange < this.config.convergenceThreshold;

      this.emit("iteration_complete", {
        iteration,
        inertia: totalInertia,
        centersChanged,
      });
    }

    // Build result
    return this.buildClusteringResult(
      featureVectors,
      centroids,
      assignments,
      totalInertia,
      iteration,
      converged
    );
  }

  /**
   * Initialize centroids using K-means++ algorithm
   */
  private initCentroidsPlusPlus(
    featureVectors: WalletFeatureVector[],
    k: number
  ): Record<string, number>[] {
    const centroids: Record<string, number>[] = [];
    const n = featureVectors.length;

    // Random first centroid
    const firstIdx = this.getRandomInt(0, n);
    const firstVector = featureVectors[firstIdx];
    if (firstVector) {
      centroids.push({ ...firstVector.normalizedFeatures });
    }

    // Choose remaining centroids with weighted probability
    for (let c = 1; c < k; c++) {
      const distances: number[] = [];
      let totalDist = 0;

      for (const vector of featureVectors) {
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = this.calculateDistance(
            vector.normalizedFeatures,
            centroid
          );
          minDist = Math.min(minDist, dist);
        }
        distances.push(minDist * minDist);
        totalDist += minDist * minDist;
      }

      // Weighted random selection
      const threshold = Math.random() * totalDist;
      let cumulative = 0;
      for (let i = 0; i < n; i++) {
        cumulative += distances[i] ?? 0;
        if (cumulative >= threshold) {
          const vector = featureVectors[i];
          if (vector) {
            centroids.push({ ...vector.normalizedFeatures });
          }
          break;
        }
      }
    }

    return centroids;
  }

  /**
   * Initialize centroids randomly
   */
  private initCentroidsRandom(
    featureVectors: WalletFeatureVector[],
    k: number
  ): Record<string, number>[] {
    const centroids: Record<string, number>[] = [];
    const usedIndices = new Set<number>();
    const n = featureVectors.length;

    while (centroids.length < k) {
      const idx = this.getRandomInt(0, n);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        const vector = featureVectors[idx];
        if (vector) {
          centroids.push({ ...vector.normalizedFeatures });
        }
      }
    }

    return centroids;
  }

  /**
   * Calculate new centroids based on assignments
   */
  private calculateNewCentroids(
    featureVectors: WalletFeatureVector[],
    assignments: number[],
    k: number
  ): Record<string, number>[] {
    const featureNames = this.config.features.map((f) => f.name);
    const centroids: Record<string, number>[] = [];

    for (let c = 0; c < k; c++) {
      const clusterVectors = featureVectors.filter(
        (_, i) => assignments[i] === c
      );

      if (clusterVectors.length === 0) {
        // Empty cluster - reinitialize randomly
        const randomIdx = this.getRandomInt(0, featureVectors.length);
        const vector = featureVectors[randomIdx];
        if (vector) {
          centroids.push({ ...vector.normalizedFeatures });
        } else {
          // Fallback: create zero centroid
          const zeroCentroid: Record<string, number> = {};
          for (const name of featureNames) {
            zeroCentroid[name] = 0;
          }
          centroids.push(zeroCentroid);
        }
      } else {
        const centroid: Record<string, number> = {};
        for (const name of featureNames) {
          const sum = clusterVectors.reduce(
            (acc, v) => acc + (v.normalizedFeatures[name] ?? 0),
            0
          );
          centroid[name] = sum / clusterVectors.length;
        }
        centroids.push(centroid);
      }
    }

    return centroids;
  }

  /**
   * DBSCAN clustering implementation
   */
  private dbscanClustering(
    featureVectors: WalletFeatureVector[]
  ): ClusteringResult {
    const eps = 0.5; // Neighborhood radius
    const minPts = this.config.minSamplesPerCluster;
    const n = featureVectors.length;

    const labels = new Array<number>(n).fill(-1); // -1 = noise
    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (labels[i] !== -1) continue;

      const neighbors = this.regionQuery(featureVectors, i, eps);

      if (neighbors.length < minPts) {
        // Noise point
        continue;
      }

      // Start new cluster
      labels[i] = clusterId;
      const seedSet = [...neighbors];
      const seedSetIndex = seedSet.indexOf(i);
      if (seedSetIndex > -1) {
        seedSet.splice(seedSetIndex, 1);
      }

      for (let j = 0; j < seedSet.length; j++) {
        const q = seedSet[j];
        if (q === undefined) continue;

        if (labels[q] === -2) {
          // Was noise, now border point
          labels[q] = clusterId;
        }

        if (labels[q] !== -1) continue;

        labels[q] = clusterId;

        const qNeighbors = this.regionQuery(featureVectors, q, eps);
        if (qNeighbors.length >= minPts) {
          for (const neighbor of qNeighbors) {
            if (!seedSet.includes(neighbor)) {
              seedSet.push(neighbor);
            }
          }
        }
      }

      clusterId++;
    }

    // Handle noise points - assign to nearest cluster
    for (let i = 0; i < n; i++) {
      if (labels[i] === -1) {
        let minDist = Infinity;
        let nearestCluster = 0;

        for (let j = 0; j < n; j++) {
          const label = labels[j];
          if (label !== undefined && label >= 0 && i !== j) {
            const vectorI = featureVectors[i];
            const vectorJ = featureVectors[j];
            if (vectorI && vectorJ) {
              const dist = this.calculateDistance(
                vectorI.normalizedFeatures,
                vectorJ.normalizedFeatures
              );
              if (dist < minDist) {
                minDist = dist;
                nearestCluster = label;
              }
            }
          }
        }

        labels[i] = nearestCluster;
      }
    }

    // Calculate centroids
    const numClusters = Math.max(...labels) + 1 || 1;
    const centroids = this.calculateCentroidsFromLabels(
      featureVectors,
      labels,
      numClusters
    );

    // Calculate inertia
    let totalInertia = 0;
    for (let i = 0; i < n; i++) {
      const label = labels[i];
      const vector = featureVectors[i];
      const centroid = label !== undefined ? centroids[label] : undefined;
      if (vector && centroid) {
        const dist = this.calculateDistance(
          vector.normalizedFeatures,
          centroid
        );
        totalInertia += dist * dist;
      }
    }

    return this.buildClusteringResult(
      featureVectors,
      centroids,
      labels,
      totalInertia,
      1,
      true
    );
  }

  /**
   * Region query for DBSCAN
   */
  private regionQuery(
    featureVectors: WalletFeatureVector[],
    pointIdx: number,
    eps: number
  ): number[] {
    const neighbors: number[] = [];
    const pointVector = featureVectors[pointIdx];
    if (!pointVector) return neighbors;

    const point = pointVector.normalizedFeatures;

    for (let i = 0; i < featureVectors.length; i++) {
      const vector = featureVectors[i];
      if (vector) {
        const dist = this.calculateDistance(point, vector.normalizedFeatures);
        if (dist <= eps) {
          neighbors.push(i);
        }
      }
    }

    return neighbors;
  }

  /**
   * Hierarchical clustering implementation (simplified agglomerative)
   */
  private hierarchicalClustering(
    featureVectors: WalletFeatureVector[]
  ): ClusteringResult {
    const n = featureVectors.length;
    const k = this.config.numClusters;

    // Initialize each point as its own cluster
    let clusters: number[][] = featureVectors.map((_, i) => [i]);

    // Merge until we have k clusters
    while (clusters.length > k) {
      let minDist = Infinity;
      let mergeI = 0;
      let mergeJ = 1;

      // Find closest pair of clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const clusterI = clusters[i];
          const clusterJ = clusters[j];
          if (clusterI && clusterJ) {
            const dist = this.clusterDistance(clusterI, clusterJ, featureVectors);
            if (dist < minDist) {
              minDist = dist;
              mergeI = i;
              mergeJ = j;
            }
          }
        }
      }

      // Merge clusters
      const clusterI = clusters[mergeI];
      const clusterJ = clusters[mergeJ];
      if (clusterI && clusterJ) {
        clusters[mergeI] = [...clusterI, ...clusterJ];
        clusters.splice(mergeJ, 1);
      }
    }

    // Convert to labels
    const labels = new Array<number>(n).fill(-1);
    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c];
      if (cluster) {
        for (const idx of cluster) {
          labels[idx] = c;
        }
      }
    }

    // Calculate centroids
    const centroids = this.calculateCentroidsFromLabels(
      featureVectors,
      labels,
      k
    );

    // Calculate inertia
    let totalInertia = 0;
    for (let i = 0; i < n; i++) {
      const label = labels[i];
      const vector = featureVectors[i];
      const centroid = label !== undefined ? centroids[label] : undefined;
      if (vector && centroid) {
        const dist = this.calculateDistance(
          vector.normalizedFeatures,
          centroid
        );
        totalInertia += dist * dist;
      }
    }

    return this.buildClusteringResult(
      featureVectors,
      centroids,
      labels,
      totalInertia,
      n - k,
      true
    );
  }

  /**
   * Calculate distance between two clusters (average linkage)
   */
  private clusterDistance(
    cluster1: number[],
    cluster2: number[],
    featureVectors: WalletFeatureVector[]
  ): number {
    let totalDist = 0;
    let count = 0;

    for (const i of cluster1) {
      for (const j of cluster2) {
        const vectorI = featureVectors[i];
        const vectorJ = featureVectors[j];
        if (vectorI && vectorJ) {
          totalDist += this.calculateDistance(
            vectorI.normalizedFeatures,
            vectorJ.normalizedFeatures
          );
          count++;
        }
      }
    }

    return count > 0 ? totalDist / count : Infinity;
  }

  /**
   * Calculate centroids from cluster labels
   */
  private calculateCentroidsFromLabels(
    featureVectors: WalletFeatureVector[],
    labels: number[],
    k: number
  ): Record<string, number>[] {
    const featureNames = this.config.features.map((f) => f.name);
    const centroids: Record<string, number>[] = [];

    for (let c = 0; c < k; c++) {
      const clusterVectors = featureVectors.filter((_, i) => labels[i] === c);

      if (clusterVectors.length === 0) {
        // Initialize empty cluster with zeros
        const centroid: Record<string, number> = {};
        for (const name of featureNames) {
          centroid[name] = 0;
        }
        centroids.push(centroid);
      } else {
        const centroid: Record<string, number> = {};
        for (const name of featureNames) {
          const sum = clusterVectors.reduce(
            (acc, v) => acc + (v.normalizedFeatures[name] ?? 0),
            0
          );
          centroid[name] = sum / clusterVectors.length;
        }
        centroids.push(centroid);
      }
    }

    return centroids;
  }

  // ============================================================================
  // Distance Calculations
  // ============================================================================

  /**
   * Calculate distance between two feature vectors
   */
  private calculateDistance(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    switch (this.config.distanceMetric) {
      case DistanceMetric.EUCLIDEAN:
        return this.euclideanDistance(features1, features2);
      case DistanceMetric.MANHATTAN:
        return this.manhattanDistance(features1, features2);
      case DistanceMetric.COSINE:
        return this.cosineDistance(features1, features2);
      default:
        return this.euclideanDistance(features1, features2);
    }
  }

  /**
   * Euclidean distance
   */
  private euclideanDistance(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    let sumSquares = 0;

    for (const featureDef of this.config.features) {
      const diff =
        (features1[featureDef.name] ?? 0) - (features2[featureDef.name] ?? 0);
      sumSquares += diff * diff * featureDef.weight;
    }

    return Math.sqrt(sumSquares);
  }

  /**
   * Manhattan distance
   */
  private manhattanDistance(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    let sum = 0;

    for (const featureDef of this.config.features) {
      const diff = Math.abs(
        (features1[featureDef.name] ?? 0) - (features2[featureDef.name] ?? 0)
      );
      sum += diff * featureDef.weight;
    }

    return sum;
  }

  /**
   * Cosine distance (1 - cosine similarity)
   */
  private cosineDistance(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const featureDef of this.config.features) {
      const v1 = (features1[featureDef.name] ?? 0) * featureDef.weight;
      const v2 = (features2[featureDef.name] ?? 0) * featureDef.weight;

      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    if (norm1 === 0 || norm2 === 0) return 1;

    const cosineSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return 1 - cosineSimilarity;
  }

  // ============================================================================
  // Quality Metrics
  // ============================================================================

  /**
   * Calculate silhouette score for clustering quality
   */
  private calculateSilhouetteScore(
    featureVectors: WalletFeatureVector[],
    memberships: WalletClusterMembership[]
  ): number {
    if (featureVectors.length < 2) return 0;

    const membershipMap = new Map<string, WalletClusterMembership>();
    for (const m of memberships) {
      membershipMap.set(m.walletAddress, m);
    }

    let totalSilhouette = 0;
    let validCount = 0;

    for (const vector of featureVectors) {
      const membership = membershipMap.get(vector.walletAddress);
      if (!membership) continue;

      // a(i) = average distance to points in same cluster
      const sameClusterVectors = featureVectors.filter((v) => {
        const m = membershipMap.get(v.walletAddress);
        return (
          m &&
          m.clusterId === membership.clusterId &&
          v.walletAddress !== vector.walletAddress
        );
      });

      if (sameClusterVectors.length === 0) continue;

      const a =
        sameClusterVectors.reduce(
          (sum, v) =>
            sum +
            this.calculateDistance(
              vector.normalizedFeatures,
              v.normalizedFeatures
            ),
          0
        ) / sameClusterVectors.length;

      // b(i) = minimum average distance to other clusters
      const otherClusters = new Set(
        memberships
          .filter((m) => m.clusterId !== membership.clusterId)
          .map((m) => m.clusterId)
      );

      let minB = Infinity;
      for (const cId of otherClusters) {
        const otherClusterVectors = featureVectors.filter((v) => {
          const m = membershipMap.get(v.walletAddress);
          return m && m.clusterId === cId;
        });

        if (otherClusterVectors.length === 0) continue;

        const avgDist =
          otherClusterVectors.reduce(
            (sum, v) =>
              sum +
              this.calculateDistance(
                vector.normalizedFeatures,
                v.normalizedFeatures
              ),
            0
          ) / otherClusterVectors.length;

        minB = Math.min(minB, avgDist);
      }

      if (minB === Infinity) continue;

      // s(i) = (b(i) - a(i)) / max(a(i), b(i))
      const silhouette = (minB - a) / Math.max(a, minB);
      totalSilhouette += silhouette;
      validCount++;
    }

    return validCount > 0 ? totalSilhouette / validCount : 0;
  }

  /**
   * Assess cluster quality based on silhouette score
   */
  private assessClusterQuality(silhouetteScore: number): ClusterQuality {
    if (silhouetteScore >= 0.7) return ClusterQuality.EXCELLENT;
    if (silhouetteScore >= 0.5) return ClusterQuality.GOOD;
    if (silhouetteScore >= 0.25) return ClusterQuality.FAIR;
    if (silhouetteScore >= 0) return ClusterQuality.POOR;
    return ClusterQuality.VERY_POOR;
  }

  // ============================================================================
  // Result Building
  // ============================================================================

  /**
   * Build clustering result from algorithm output
   */
  private buildClusteringResult(
    featureVectors: WalletFeatureVector[],
    centroids: Record<string, number>[],
    assignments: number[],
    totalInertia: number,
    iterations: number,
    converged: boolean
  ): ClusteringResult {
    const resultId = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const numClusters = centroids.length;

    // Build memberships
    const memberships: WalletClusterMembership[] = [];
    for (let i = 0; i < featureVectors.length; i++) {
      const vector = featureVectors[i];
      if (!vector) continue;

      const assignment = assignments[i] ?? 0;
      const clusterId = `cluster_${assignment}`;

      // Calculate distances to all centroids
      const distanceToAllCentroids: Record<string, number> = {};
      for (let c = 0; c < numClusters; c++) {
        const centroid = centroids[c];
        if (centroid) {
          distanceToAllCentroids[`cluster_${c}`] = this.calculateDistance(
            vector.normalizedFeatures,
            centroid
          );
        }
      }

      const distanceToCentroid = distanceToAllCentroids[clusterId] ?? 0;

      // Find second closest
      const sortedDistances = Object.entries(distanceToAllCentroids).sort(
        ([, a], [, b]) => a - b
      );
      const secondClosest =
        sortedDistances.length > 1 ? sortedDistances[1]?.[0] ?? null : null;

      // Calculate confidence based on distance ratio
      const secondDist = sortedDistances[1]?.[1] ?? distanceToCentroid;
      const confidence = this.calculateMembershipConfidence(
        distanceToCentroid,
        secondDist
      );

      const membership: WalletClusterMembership = {
        walletAddress: vector.walletAddress,
        clusterId,
        distanceToCentroid,
        confidence,
        distanceToAllCentroids,
        secondClosestClusterId: secondClosest,
        assignedAt: new Date(),
      };

      memberships.push(membership);

      this.emit("wallet_assigned", {
        walletAddress: vector.walletAddress,
        clusterId,
        confidence,
      });
    }

    // Build clusters
    const clusters: WalletCluster[] = [];
    for (let c = 0; c < numClusters; c++) {
      const clusterId = `cluster_${c}`;
      const centroid = centroids[c];
      if (!centroid) continue;

      const members = memberships
        .filter((m) => m.clusterId === clusterId)
        .map((m) => m.walletAddress);

      const clusterMemberships = memberships.filter(
        (m) => m.clusterId === clusterId
      );
      const avgDistance =
        clusterMemberships.length > 0
          ? clusterMemberships.reduce(
              (sum, m) => sum + m.distanceToCentroid,
              0
            ) / clusterMemberships.length
          : 0;

      // Calculate compactness (within-cluster sum of squares)
      const compactness = clusterMemberships.reduce(
        (sum, m) => sum + m.distanceToCentroid * m.distanceToCentroid,
        0
      );

      // Find dominant features
      const clusterVectors = featureVectors.filter(
        (_, i) => assignments[i] === c
      );
      const dominantFeatures = this.findDominantFeatures(
        clusterVectors,
        featureVectors,
        centroid
      );

      // Assess risk level
      const { riskLevel, riskIndicators } = this.assessClusterRisk(
        clusterVectors,
        centroid
      );

      const cluster: WalletCluster = {
        clusterId,
        label: this.generateClusterLabel(dominantFeatures, c),
        centroid: {
          clusterId,
          features: centroid,
          memberCount: members.length,
          inertia: compactness,
        },
        members,
        memberCount: members.length,
        avgDistanceToCentroid: avgDistance,
        compactness,
        dominantFeatures,
        riskLevel,
        riskIndicators,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      clusters.push(cluster);
    }

    return {
      resultId,
      algorithm: this.config.algorithm,
      numClusters,
      clusters,
      memberships,
      silhouetteScore: 0, // Will be calculated later
      quality: ClusterQuality.FAIR,
      totalInertia,
      iterations,
      converged,
      clusteredAt: new Date(),
      processingTimeMs: 0,
    };
  }

  /**
   * Calculate membership confidence based on distance ratio
   */
  private calculateMembershipConfidence(
    distanceToAssigned: number,
    distanceToSecond: number
  ): number {
    if (distanceToAssigned === 0) return 1;
    if (distanceToSecond === 0) return 0.5;

    // Higher confidence if assigned cluster is much closer than second
    const ratio = distanceToAssigned / distanceToSecond;
    return Math.max(0, Math.min(1, 1 - ratio + 0.5));
  }

  /**
   * Find dominant features in a cluster
   */
  private findDominantFeatures(
    clusterVectors: WalletFeatureVector[],
    allVectors: WalletFeatureVector[],
    _centroid: Record<string, number>
  ): DominantFeature[] {
    if (clusterVectors.length === 0) return [];

    const dominantFeatures: DominantFeature[] = [];

    for (const featureDef of this.config.features) {
      // Calculate cluster average
      const clusterValues = clusterVectors.map(
        (v) => v.normalizedFeatures[featureDef.name] ?? 0
      );
      const clusterAvg =
        clusterValues.reduce((a, b) => a + b, 0) / clusterValues.length;

      // Calculate cluster std dev
      const clusterStdDev = Math.sqrt(
        clusterValues.reduce(
          (sum, v) => sum + Math.pow(v - clusterAvg, 2),
          0
        ) / clusterValues.length
      );

      // Calculate global average
      const globalValues = allVectors.map(
        (v) => v.normalizedFeatures[featureDef.name] ?? 0
      );
      const globalAvg =
        globalValues.reduce((a, b) => a + b, 0) / globalValues.length;
      const globalStdDev = Math.sqrt(
        globalValues.reduce(
          (sum, v) => sum + Math.pow(v - globalAvg, 2),
          0
        ) / globalValues.length
      );

      // Calculate deviation from global
      const deviationFromGlobal =
        globalStdDev > 0 ? (clusterAvg - globalAvg) / globalStdDev : 0;

      // Calculate importance
      const importance = Math.abs(deviationFromGlobal) * featureDef.weight;

      dominantFeatures.push({
        featureName: featureDef.name,
        avgValue: clusterAvg,
        stdDev: clusterStdDev,
        deviationFromGlobal,
        importance,
      });
    }

    // Sort by importance and take top features
    return dominantFeatures
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
  }

  /**
   * Assess risk level of a cluster
   */
  private assessClusterRisk(
    _clusterVectors: WalletFeatureVector[],
    centroid: Record<string, number>
  ): { riskLevel: WalletClusterRiskLevel; riskIndicators: string[] } {
    const riskIndicators: string[] = [];
    let riskScore = 0;

    // Check for high suspicion scores
    const avgSuspicionScore = centroid.suspicion_score ?? 0;
    if (avgSuspicionScore > this.config.riskThresholds.highRiskThreshold) {
      riskIndicators.push("High average suspicion score");
      riskScore += 30;
    }

    // Check for high coordination
    const avgCoordinationScore = centroid.coordination_score ?? 0;
    if (avgCoordinationScore > 50) {
      riskIndicators.push("High coordination score");
      riskScore += 25;
    }

    // Check for sybil risk
    const avgSybilScore = centroid.sybil_risk_score ?? 0;
    if (avgSybilScore > 50) {
      riskIndicators.push("Elevated sybil risk");
      riskScore += 25;
    }

    // Check for fresh wallets
    const avgWalletAge = centroid.wallet_age_days ?? 0;
    if (avgWalletAge < 7) {
      riskIndicators.push("Cluster of fresh wallets");
      riskScore += 20;
    }

    // Check for high win rates
    const avgWinRate = centroid.win_rate ?? 0.5;
    if (avgWinRate > 0.75) {
      riskIndicators.push("Abnormally high win rate");
      riskScore += 15;
    }

    // Check for pre-event trading
    const avgPreEventRatio = centroid.pre_event_trading_ratio ?? 0;
    if (avgPreEventRatio > 0.3) {
      riskIndicators.push("Elevated pre-event trading");
      riskScore += 20;
    }

    // Check for niche market concentration
    const avgNicheRatio = centroid.niche_market_ratio ?? 0;
    if (avgNicheRatio > 0.5) {
      riskIndicators.push("High niche market concentration");
      riskScore += 10;
    }

    // Determine risk level
    let riskLevel: WalletClusterRiskLevel;
    if (riskScore >= this.config.riskThresholds.criticalRiskThreshold) {
      riskLevel = WalletClusterRiskLevel.CRITICAL;
    } else if (riskScore >= this.config.riskThresholds.highRiskThreshold) {
      riskLevel = WalletClusterRiskLevel.HIGH;
    } else if (riskScore >= 40) {
      riskLevel = WalletClusterRiskLevel.MEDIUM;
    } else if (riskScore >= 20) {
      riskLevel = WalletClusterRiskLevel.LOW;
    } else {
      riskLevel = WalletClusterRiskLevel.NONE;
    }

    return { riskLevel, riskIndicators };
  }

  /**
   * Generate a human-readable cluster label
   */
  private generateClusterLabel(
    dominantFeatures: DominantFeature[],
    clusterIndex: number
  ): string {
    if (dominantFeatures.length === 0) {
      return `Cluster ${clusterIndex + 1}`;
    }

    const topFeature = dominantFeatures[0];
    if (!topFeature) {
      return `Cluster ${clusterIndex + 1}`;
    }

    const labels: Record<string, string> = {
      total_trades:
        topFeature.deviationFromGlobal > 0 ? "High Activity" : "Low Activity",
      avg_trade_size_usd:
        topFeature.deviationFromGlobal > 0 ? "Large Trades" : "Small Trades",
      win_rate:
        topFeature.deviationFromGlobal > 0 ? "High Win Rate" : "Low Win Rate",
      wallet_age_days:
        topFeature.deviationFromGlobal > 0 ? "Mature Wallets" : "Fresh Wallets",
      coordination_score:
        topFeature.deviationFromGlobal > 0 ? "Coordinated" : "Independent",
      niche_market_ratio:
        topFeature.deviationFromGlobal > 0 ? "Niche Focused" : "Diversified",
      suspicion_score:
        topFeature.deviationFromGlobal > 0 ? "Suspicious" : "Normal",
    };

    return labels[topFeature.featureName] || `Cluster ${clusterIndex + 1}`;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Find optimal number of clusters using elbow method
   */
  async findOptimalK(
    featureVectors: WalletFeatureVector[]
  ): Promise<{ optimalK: number; inertias: number[] }> {
    const [minK, maxK] = this.config.kRange;
    const inertias: number[] = [];

    for (let k = minK; k <= maxK; k++) {
      const config = { ...this.config, numClusters: k };
      const tempClustering = new WalletClustering(config);
      const result = await tempClustering.cluster(featureVectors);
      inertias.push(result.totalInertia);
    }

    // Find elbow point using second derivative
    const diffs: number[] = [];
    for (let i = 1; i < inertias.length; i++) {
      const prev = inertias[i - 1] ?? 0;
      const curr = inertias[i] ?? 0;
      diffs.push(prev - curr);
    }

    const secondDiffs: number[] = [];
    for (let i = 1; i < diffs.length; i++) {
      const prev = diffs[i - 1] ?? 0;
      const curr = diffs[i] ?? 0;
      secondDiffs.push(prev - curr);
    }

    let maxSecondDiff = 0;
    let optimalK = minK;
    for (let i = 0; i < secondDiffs.length; i++) {
      const diff = secondDiffs[i] ?? 0;
      if (diff > maxSecondDiff) {
        maxSecondDiff = diff;
        optimalK = minK + i + 1;
      }
    }

    return { optimalK, inertias };
  }

  /**
   * Get cluster for a wallet address
   */
  getWalletCluster(walletAddress: string): WalletClusterMembership | null {
    return this.membershipLookup.get(walletAddress) || null;
  }

  /**
   * Get all wallets in a cluster
   */
  getClusterMembers(clusterId: string): string[] {
    if (!this.latestResult) return [];

    const cluster = this.latestResult.clusters.find(
      (c) => c.clusterId === clusterId
    );
    return cluster?.members || [];
  }

  /**
   * Get latest clustering result
   */
  getLatestResult(): ClusteringResult | null {
    return this.latestResult;
  }

  /**
   * Get clustering statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.featureCache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClusteringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ClusteringConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getRandomInt(min: number, max: number): number {
    if (this.config.randomSeed !== undefined) {
      // Simple seeded random for reproducibility
      const x = Math.sin(this.seedCounter++) * 10000;
      return Math.floor((x - Math.floor(x)) * (max - min)) + min;
    }
    return Math.floor(Math.random() * (max - min)) + min;
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

// ============================================================================
// Wallet Data Interface
// ============================================================================

/**
 * Input wallet data for clustering
 */
export interface WalletData {
  /** Wallet address */
  address: string;

  // Trading activity
  totalTrades?: number;
  uniqueMarkets?: number;
  tradeFrequencyPerDay?: number;
  activeDaysRatio?: number;

  // Volume patterns
  avgTradeSizeUsd?: number;
  totalVolumeUsd?: number;
  tradeSizeVariance?: number;
  whaleTradeRatio?: number;

  // Timing patterns
  avgTimeBetweenTradesHours?: number;
  offHoursTradingRatio?: number;
  preEventTradingRatio?: number;
  timingConsistencyScore?: number;

  // Market preferences
  marketConcentrationScore?: number;
  nicheMarketRatio?: number;
  politicalMarketRatio?: number;
  categoryDiversityScore?: number;

  // Performance
  winRate?: number;
  profitFactor?: number;
  avgHoldingPeriodHours?: number;
  maxConsecutiveWins?: number;

  // Risk indicators
  walletAgeDays?: number;
  coordinationScore?: number;
  sybilRiskScore?: number;
  suspicionScore?: number;
}

// ============================================================================
// Factory and Utility Functions
// ============================================================================

/**
 * Create a new WalletClustering instance
 */
export function createWalletClustering(
  config?: Partial<ClusteringConfig>,
  cacheConfig?: Partial<CacheConfig>
): WalletClustering {
  return new WalletClustering(config, cacheConfig);
}

// Shared instance
let sharedInstance: WalletClustering | null = null;

/**
 * Get shared WalletClustering instance
 */
export function getSharedWalletClustering(): WalletClustering {
  if (!sharedInstance) {
    sharedInstance = new WalletClustering();
  }
  return sharedInstance;
}

/**
 * Set shared WalletClustering instance
 */
export function setSharedWalletClustering(instance: WalletClustering): void {
  sharedInstance = instance;
}

/**
 * Reset shared instance
 */
export function resetSharedWalletClustering(): void {
  sharedInstance = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get description for cluster quality
 */
export function getClusterQualityDescription(quality: ClusterQuality): string {
  const descriptions: Record<ClusterQuality, string> = {
    [ClusterQuality.EXCELLENT]: "Excellent cluster separation and cohesion",
    [ClusterQuality.GOOD]: "Good cluster quality with clear separations",
    [ClusterQuality.FAIR]: "Fair clustering with some overlap",
    [ClusterQuality.POOR]:
      "Poor clustering quality, consider adjusting parameters",
    [ClusterQuality.VERY_POOR]: "Very poor clustering, no clear structure",
  };
  return descriptions[quality];
}

/**
 * Get description for risk level
 */
export function getRiskLevelDescription(level: WalletClusterRiskLevel): string {
  const descriptions: Record<WalletClusterRiskLevel, string> = {
    [WalletClusterRiskLevel.NONE]: "No significant risk indicators",
    [WalletClusterRiskLevel.LOW]: "Low risk, minimal suspicious indicators",
    [WalletClusterRiskLevel.MEDIUM]: "Medium risk, warrants monitoring",
    [WalletClusterRiskLevel.HIGH]: "High risk, multiple suspicious indicators",
    [WalletClusterRiskLevel.CRITICAL]:
      "Critical risk, likely suspicious activity",
  };
  return descriptions[level];
}

/**
 * Get color for risk level
 */
export function getRiskLevelColor(level: WalletClusterRiskLevel): string {
  const colors: Record<WalletClusterRiskLevel, string> = {
    [WalletClusterRiskLevel.NONE]: "#10B981", // green
    [WalletClusterRiskLevel.LOW]: "#6EE7B7", // light green
    [WalletClusterRiskLevel.MEDIUM]: "#FBBF24", // yellow
    [WalletClusterRiskLevel.HIGH]: "#F97316", // orange
    [WalletClusterRiskLevel.CRITICAL]: "#EF4444", // red
  };
  return colors[level];
}

/**
 * Get description for clustering algorithm
 */
export function getAlgorithmDescription(
  algorithm: ClusteringAlgorithm
): string {
  const descriptions: Record<ClusteringAlgorithm, string> = {
    [ClusteringAlgorithm.KMEANS]:
      "K-means clustering with random initialization",
    [ClusteringAlgorithm.KMEANS_PLUS_PLUS]:
      "K-means++ with smart centroid initialization",
    [ClusteringAlgorithm.HIERARCHICAL]: "Hierarchical agglomerative clustering",
    [ClusteringAlgorithm.DBSCAN]: "DBSCAN density-based clustering",
  };
  return descriptions[algorithm];
}

/**
 * Generate mock wallet data for testing
 */
export function createMockWalletData(
  address: string,
  overrides: Partial<WalletData> = {}
): WalletData {
  return {
    address,
    totalTrades: Math.floor(Math.random() * 500),
    uniqueMarkets: Math.floor(Math.random() * 50),
    tradeFrequencyPerDay: Math.random() * 10,
    activeDaysRatio: Math.random(),
    avgTradeSizeUsd: Math.random() * 10000,
    totalVolumeUsd: Math.random() * 500000,
    tradeSizeVariance: Math.random() * 100000,
    whaleTradeRatio: Math.random() * 0.3,
    avgTimeBetweenTradesHours: Math.random() * 48,
    offHoursTradingRatio: Math.random() * 0.5,
    preEventTradingRatio: Math.random() * 0.2,
    timingConsistencyScore: Math.random(),
    marketConcentrationScore: Math.random(),
    nicheMarketRatio: Math.random() * 0.5,
    politicalMarketRatio: Math.random() * 0.3,
    categoryDiversityScore: Math.random(),
    winRate: Math.random(),
    profitFactor: Math.random() * 5,
    avgHoldingPeriodHours: Math.random() * 72,
    maxConsecutiveWins: Math.floor(Math.random() * 20),
    walletAgeDays: Math.floor(Math.random() * 365),
    coordinationScore: Math.random() * 50,
    sybilRiskScore: Math.random() * 50,
    suspicionScore: Math.random() * 50,
    ...overrides,
  };
}

/**
 * Generate mock wallet data batch for testing
 */
export function createMockWalletDataBatch(count: number): WalletData[] {
  return Array.from({ length: count }, (_, i) =>
    createMockWalletData(`0x${i.toString(16).padStart(40, "0")}`)
  );
}
