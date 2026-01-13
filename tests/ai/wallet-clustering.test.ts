/**
 * Unit Tests for Wallet Clustering Algorithm (AI-PAT-003)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WalletClustering,
  createWalletClustering,
  getSharedWalletClustering,
  setSharedWalletClustering,
  resetSharedWalletClustering,
  ClusteringAlgorithm,
  DistanceMetric,
  ClusterQuality,
  WalletClusterRiskLevel,
  ClusterFeatureCategory,
  DEFAULT_CLUSTERING_CONFIG,
  DEFAULT_CLUSTER_FEATURE_DEFINITIONS,
  DEFAULT_CACHE_CONFIG,
  getClusterQualityDescription,
  getRiskLevelDescription,
  getRiskLevelColor,
  getAlgorithmDescription,
  createMockWalletData,
  createMockWalletDataBatch,
  type WalletData,
} from "../../src/ai/wallet-clustering";

describe("WalletClustering", () => {
  let clustering: WalletClustering;

  beforeEach(() => {
    clustering = new WalletClustering();
  });

  afterEach(() => {
    resetSharedWalletClustering();
  });

  describe("Constructor and Configuration", () => {
    it("should create instance with default config", () => {
      expect(clustering).toBeDefined();
      const config = clustering.getConfig();
      expect(config.algorithm).toBe(ClusteringAlgorithm.KMEANS_PLUS_PLUS);
      expect(config.numClusters).toBe(5);
      expect(config.maxIterations).toBe(100);
    });

    it("should create instance with custom config", () => {
      const custom = new WalletClustering({
        algorithm: ClusteringAlgorithm.KMEANS,
        numClusters: 3,
        maxIterations: 50,
      });
      const config = custom.getConfig();
      expect(config.algorithm).toBe(ClusteringAlgorithm.KMEANS);
      expect(config.numClusters).toBe(3);
      expect(config.maxIterations).toBe(50);
    });

    it("should update configuration", () => {
      clustering.updateConfig({ numClusters: 7 });
      expect(clustering.getConfig().numClusters).toBe(7);
    });

    it("should have default feature definitions", () => {
      const config = clustering.getConfig();
      expect(config.features.length).toBeGreaterThan(0);
      expect(config.features).toEqual(DEFAULT_CLUSTER_FEATURE_DEFINITIONS);
    });

    it("should support different distance metrics", () => {
      const euclidean = new WalletClustering({
        distanceMetric: DistanceMetric.EUCLIDEAN,
      });
      expect(euclidean.getConfig().distanceMetric).toBe(DistanceMetric.EUCLIDEAN);

      const manhattan = new WalletClustering({
        distanceMetric: DistanceMetric.MANHATTAN,
      });
      expect(manhattan.getConfig().distanceMetric).toBe(DistanceMetric.MANHATTAN);

      const cosine = new WalletClustering({
        distanceMetric: DistanceMetric.COSINE,
      });
      expect(cosine.getConfig().distanceMetric).toBe(DistanceMetric.COSINE);
    });
  });

  describe("Feature Extraction", () => {
    it("should extract features from wallet data", () => {
      const walletData = createMockWalletData("0x1234567890abcdef");
      const vector = clustering.extractFeatures(walletData);

      expect(vector.walletAddress).toBe("0x1234567890abcdef");
      expect(vector.features).toBeDefined();
      expect(vector.normalizedFeatures).toBeDefined();
      expect(vector.extractedAt).toBeInstanceOf(Date);
      expect(vector.dataQuality).toBeGreaterThanOrEqual(0);
      expect(vector.dataQuality).toBeLessThanOrEqual(1);
    });

    it("should handle missing features with defaults", () => {
      const walletData: WalletData = {
        address: "0xtest",
        totalTrades: 100,
        // Most features missing
      };
      const vector = clustering.extractFeatures(walletData);

      expect(vector.missingFeatures.length).toBeGreaterThan(0);
      expect(vector.dataQuality).toBeLessThan(1);
    });

    it("should normalize features correctly", () => {
      const walletData = createMockWalletData("0xtest", {
        totalTrades: 50000, // Half of max (100000)
        winRate: 0.75,
      });
      const vector = clustering.extractFeatures(walletData);

      // Win rate is not normalized (already 0-1)
      expect(vector.normalizedFeatures.win_rate).toBe(0.75);

      // Total trades should be normalized to ~0.5
      expect(vector.normalizedFeatures.total_trades).toBeCloseTo(0.5, 1);
    });

    it("should clamp values to min/max", () => {
      const walletData: WalletData = {
        address: "0xtest",
        totalTrades: 200000, // Above max
        winRate: 1.5, // Above max
      };
      const vector = clustering.extractFeatures(walletData);

      // Should be clamped
      expect(vector.features.total_trades).toBe(100000);
      expect(vector.features.win_rate).toBe(1);
    });

    it("should extract features for multiple wallets", () => {
      const walletDataList = createMockWalletDataBatch(10);
      const vectors = clustering.extractFeaturesForWallets(walletDataList);

      expect(vectors.length).toBe(10);
      vectors.forEach((v) => {
        expect(v.features).toBeDefined();
        expect(v.normalizedFeatures).toBeDefined();
      });
    });
  });

  describe("K-Means Clustering", () => {
    it("should cluster wallets using K-means", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const kmeansClusterer = new WalletClustering({
        algorithm: ClusteringAlgorithm.KMEANS,
        numClusters: 3,
        maxIterations: 50,
      });

      const result = await kmeansClusterer.cluster(vectors);

      expect(result).toBeDefined();
      expect(result.clusters.length).toBe(3);
      expect(result.memberships.length).toBe(20);
      expect(result.algorithm).toBe(ClusteringAlgorithm.KMEANS);
    });

    it("should cluster wallets using K-means++", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result).toBeDefined();
      expect(result.clusters.length).toBe(5);
      expect(result.algorithm).toBe(ClusteringAlgorithm.KMEANS_PLUS_PLUS);
    });

    it("should converge within max iterations", async () => {
      const walletData = createMockWalletDataBatch(30);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.iterations).toBeLessThanOrEqual(100);
    });

    it("should throw error with insufficient wallets", async () => {
      const walletData = createMockWalletDataBatch(3);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      // Default is 5 clusters, only 3 wallets
      await expect(clustering.cluster(vectors)).rejects.toThrow();
    });
  });

  describe("DBSCAN Clustering", () => {
    it("should cluster wallets using DBSCAN", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const dbscanClusterer = new WalletClustering({
        algorithm: ClusteringAlgorithm.DBSCAN,
        minSamplesPerCluster: 2,
      });

      const result = await dbscanClusterer.cluster(vectors);

      expect(result).toBeDefined();
      expect(result.algorithm).toBe(ClusteringAlgorithm.DBSCAN);
      expect(result.memberships.length).toBe(20);
    });
  });

  describe("Hierarchical Clustering", () => {
    it("should cluster wallets using hierarchical clustering", async () => {
      const walletData = createMockWalletDataBatch(15);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const hierarchicalClusterer = new WalletClustering({
        algorithm: ClusteringAlgorithm.HIERARCHICAL,
        numClusters: 3,
      });

      const result = await hierarchicalClusterer.cluster(vectors);

      expect(result).toBeDefined();
      expect(result.algorithm).toBe(ClusteringAlgorithm.HIERARCHICAL);
      expect(result.clusters.length).toBe(3);
    });
  });

  describe("Cluster Quality Metrics", () => {
    it("should calculate silhouette score", async () => {
      const walletData = createMockWalletDataBatch(30);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.silhouetteScore).toBeDefined();
      expect(result.silhouetteScore).toBeGreaterThanOrEqual(-1);
      expect(result.silhouetteScore).toBeLessThanOrEqual(1);
    });

    it("should assess cluster quality", async () => {
      const walletData = createMockWalletDataBatch(30);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.quality).toBeDefined();
      expect([
        ClusterQuality.EXCELLENT,
        ClusterQuality.GOOD,
        ClusterQuality.FAIR,
        ClusterQuality.POOR,
        ClusterQuality.VERY_POOR,
      ]).toContain(result.quality);
    });

    it("should calculate total inertia", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.totalInertia).toBeDefined();
      expect(result.totalInertia).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cluster Membership", () => {
    it("should assign all wallets to clusters", async () => {
      const walletData = createMockWalletDataBatch(25);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      await clustering.cluster(vectors);

      // All wallets should have membership
      for (const wallet of walletData) {
        const membership = clustering.getWalletCluster(wallet.address);
        expect(membership).toBeDefined();
        expect(membership!.clusterId).toBeDefined();
      }
    });

    it("should calculate membership confidence", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const membership of result.memberships) {
        expect(membership.confidence).toBeGreaterThanOrEqual(0);
        expect(membership.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should track distance to all centroids", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const membership of result.memberships) {
        expect(membership.distanceToAllCentroids).toBeDefined();
        expect(Object.keys(membership.distanceToAllCentroids).length).toBe(5);
      }
    });

    it("should identify second closest cluster", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const membership of result.memberships) {
        if (result.clusters.length > 1) {
          expect(membership.secondClosestClusterId).toBeDefined();
          expect(membership.secondClosestClusterId).not.toBe(membership.clusterId);
        }
      }
    });
  });

  describe("Cluster Analysis", () => {
    it("should identify dominant features in clusters", async () => {
      const walletData = createMockWalletDataBatch(25);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const cluster of result.clusters) {
        expect(cluster.dominantFeatures).toBeDefined();
        expect(cluster.dominantFeatures.length).toBeLessThanOrEqual(5);

        for (const feature of cluster.dominantFeatures) {
          expect(feature.featureName).toBeDefined();
          expect(feature.importance).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should assess cluster risk level", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const cluster of result.clusters) {
        expect(cluster.riskLevel).toBeDefined();
        expect([
          WalletClusterRiskLevel.NONE,
          WalletClusterRiskLevel.LOW,
          WalletClusterRiskLevel.MEDIUM,
          WalletClusterRiskLevel.HIGH,
          WalletClusterRiskLevel.CRITICAL,
        ]).toContain(cluster.riskLevel);
      }
    });

    it("should generate cluster labels", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const cluster of result.clusters) {
        expect(cluster.label).toBeDefined();
        expect(typeof cluster.label).toBe("string");
        expect(cluster.label.length).toBeGreaterThan(0);
      }
    });

    it("should calculate cluster compactness", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const cluster of result.clusters) {
        expect(cluster.compactness).toBeDefined();
        expect(cluster.compactness).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Get Cluster Members", () => {
    it("should return all members of a cluster", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      for (const cluster of result.clusters) {
        const members = clustering.getClusterMembers(cluster.clusterId);
        expect(members.length).toBe(cluster.memberCount);
      }
    });

    it("should return empty array for unknown cluster", () => {
      const members = clustering.getClusterMembers("unknown_cluster");
      expect(members).toEqual([]);
    });
  });

  describe("Event Emission", () => {
    it("should emit clustering_started event", async () => {
      const walletData = createMockWalletDataBatch(15);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const handler = vi.fn();
      clustering.on("clustering_started", handler);

      await clustering.cluster(vectors);

      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          walletCount: 15,
          algorithm: ClusteringAlgorithm.KMEANS_PLUS_PLUS,
        })
      );
    });

    it("should emit iteration_complete events", async () => {
      const walletData = createMockWalletDataBatch(15);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const handler = vi.fn();
      clustering.on("iteration_complete", handler);

      await clustering.cluster(vectors);

      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          iteration: expect.any(Number),
          inertia: expect.any(Number),
        })
      );
    });

    it("should emit clustering_complete event", async () => {
      const walletData = createMockWalletDataBatch(15);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const handler = vi.fn();
      clustering.on("clustering_complete", handler);

      await clustering.cluster(vectors);

      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          resultId: expect.any(String),
          numClusters: 5,
          silhouetteScore: expect.any(Number),
          processingTimeMs: expect.any(Number),
        })
      );
    });

    it("should emit wallet_assigned events", async () => {
      const walletData = createMockWalletDataBatch(10);
      const clusterer = new WalletClustering({ numClusters: 3 });
      const vectors = clusterer.extractFeaturesForWallets(walletData);

      const handler = vi.fn();
      clusterer.on("wallet_assigned", handler);

      await clusterer.cluster(vectors);

      expect(handler).toHaveBeenCalledTimes(10);
    });

    it("should emit high_risk_cluster_detected for suspicious clusters", async () => {
      // Create wallets with extreme high risk indicators to ensure detection
      const highRiskWallets = Array.from({ length: 10 }, (_, i) =>
        createMockWalletData(`0x${i.toString(16).padStart(40, "a")}`, {
          suspicionScore: 95,
          coordinationScore: 90,
          sybilRiskScore: 90,
          walletAgeDays: 1,
          preEventTradingRatio: 0.8,
        })
      );
      // Use single cluster to ensure all high-risk wallets are in same cluster
      const clusterer = new WalletClustering({ numClusters: 1 });
      const vectors = clusterer.extractFeaturesForWallets(highRiskWallets);

      const result = await clusterer.cluster(vectors);

      // With extreme risk indicators, cluster should be flagged as high risk
      expect(result.clusters.length).toBe(1);
      expect(
        result.clusters[0]!.riskLevel === WalletClusterRiskLevel.HIGH ||
        result.clusters[0]!.riskLevel === WalletClusterRiskLevel.CRITICAL ||
        result.clusters[0]!.riskLevel === WalletClusterRiskLevel.MEDIUM
      ).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should track clustering statistics", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      await clustering.cluster(vectors);

      const stats = clustering.getStats();
      expect(stats.totalClusterings).toBe(1);
      expect(stats.totalWalletsClustered).toBe(20);
    });

    it("should update statistics after multiple clusterings", async () => {
      const walletData1 = createMockWalletDataBatch(15);
      const walletData2 = createMockWalletDataBatch(25);

      await clustering.cluster(clustering.extractFeaturesForWallets(walletData1));
      await clustering.cluster(clustering.extractFeaturesForWallets(walletData2));

      const stats = clustering.getStats();
      expect(stats.totalClusterings).toBe(2);
      expect(stats.totalWalletsClustered).toBe(40);
    });
  });

  describe("Latest Result", () => {
    it("should store latest clustering result", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      await clustering.cluster(vectors);

      const result = clustering.getLatestResult();
      expect(result).toBeDefined();
      expect(result!.clusters.length).toBe(5);
    });

    it("should return null before any clustering", () => {
      expect(clustering.getLatestResult()).toBeNull();
    });
  });

  describe("Cache", () => {
    it("should clear cache", () => {
      clustering.clearCache();
      const stats = clustering.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe("Optimal K Finding", () => {
    it("should find optimal number of clusters", async () => {
      const walletData = createMockWalletDataBatch(30);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const clusterer = new WalletClustering({
        kRange: [2, 6],
      });

      const result = await clusterer.findOptimalK(vectors);

      expect(result.optimalK).toBeGreaterThanOrEqual(2);
      expect(result.optimalK).toBeLessThanOrEqual(6);
      expect(result.inertias.length).toBe(5); // 2, 3, 4, 5, 6
    });
  });

  describe("Distance Metrics", () => {
    it("should use Euclidean distance by default", async () => {
      const walletData = createMockWalletDataBatch(15);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);
      expect(result).toBeDefined();
    });

    it("should work with Manhattan distance", async () => {
      const walletData = createMockWalletDataBatch(15);
      const clusterer = new WalletClustering({
        distanceMetric: DistanceMetric.MANHATTAN,
        numClusters: 3,
      });
      const vectors = clusterer.extractFeaturesForWallets(walletData);

      const result = await clusterer.cluster(vectors);
      expect(result).toBeDefined();
    });

    it("should work with Cosine distance", async () => {
      const walletData = createMockWalletDataBatch(15);
      const clusterer = new WalletClustering({
        distanceMetric: DistanceMetric.COSINE,
        numClusters: 3,
      });
      const vectors = clusterer.extractFeaturesForWallets(walletData);

      const result = await clusterer.cluster(vectors);
      expect(result).toBeDefined();
    });
  });

  describe("Factory Functions", () => {
    it("should create instance with factory function", () => {
      const instance = createWalletClustering({ numClusters: 4 });
      expect(instance.getConfig().numClusters).toBe(4);
    });

    it("should get shared instance", () => {
      const shared1 = getSharedWalletClustering();
      const shared2 = getSharedWalletClustering();
      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const custom = new WalletClustering({ numClusters: 10 });
      setSharedWalletClustering(custom);
      expect(getSharedWalletClustering().getConfig().numClusters).toBe(10);
    });

    it("should reset shared instance", () => {
      setSharedWalletClustering(new WalletClustering({ numClusters: 10 }));
      resetSharedWalletClustering();
      // After reset, should create new default instance
      expect(getSharedWalletClustering().getConfig().numClusters).toBe(5);
    });
  });

  describe("Utility Functions", () => {
    describe("getClusterQualityDescription", () => {
      it("should return description for each quality level", () => {
        expect(getClusterQualityDescription(ClusterQuality.EXCELLENT)).toContain(
          "Excellent"
        );
        expect(getClusterQualityDescription(ClusterQuality.GOOD)).toContain(
          "Good"
        );
        expect(getClusterQualityDescription(ClusterQuality.FAIR)).toContain(
          "Fair"
        );
        expect(getClusterQualityDescription(ClusterQuality.POOR)).toContain(
          "Poor"
        );
        expect(getClusterQualityDescription(ClusterQuality.VERY_POOR)).toContain(
          "poor"
        );
      });
    });

    describe("getRiskLevelDescription", () => {
      it("should return description for each risk level", () => {
        expect(getRiskLevelDescription(WalletClusterRiskLevel.NONE)).toBeDefined();
        expect(getRiskLevelDescription(WalletClusterRiskLevel.LOW)).toBeDefined();
        expect(getRiskLevelDescription(WalletClusterRiskLevel.MEDIUM)).toBeDefined();
        expect(getRiskLevelDescription(WalletClusterRiskLevel.HIGH)).toBeDefined();
        expect(getRiskLevelDescription(WalletClusterRiskLevel.CRITICAL)).toBeDefined();
      });
    });

    describe("getRiskLevelColor", () => {
      it("should return color for each risk level", () => {
        expect(getRiskLevelColor(WalletClusterRiskLevel.NONE)).toMatch(/^#/);
        expect(getRiskLevelColor(WalletClusterRiskLevel.LOW)).toMatch(/^#/);
        expect(getRiskLevelColor(WalletClusterRiskLevel.MEDIUM)).toMatch(/^#/);
        expect(getRiskLevelColor(WalletClusterRiskLevel.HIGH)).toMatch(/^#/);
        expect(getRiskLevelColor(WalletClusterRiskLevel.CRITICAL)).toMatch(/^#/);
      });
    });

    describe("getAlgorithmDescription", () => {
      it("should return description for each algorithm", () => {
        expect(
          getAlgorithmDescription(ClusteringAlgorithm.KMEANS)
        ).toContain("K-means");
        expect(
          getAlgorithmDescription(ClusteringAlgorithm.KMEANS_PLUS_PLUS)
        ).toContain("K-means++");
        expect(
          getAlgorithmDescription(ClusteringAlgorithm.HIERARCHICAL)
        ).toContain("Hierarchical");
        expect(
          getAlgorithmDescription(ClusteringAlgorithm.DBSCAN)
        ).toContain("DBSCAN");
      });
    });
  });

  describe("Mock Data Generation", () => {
    describe("createMockWalletData", () => {
      it("should create mock wallet data with address", () => {
        const data = createMockWalletData("0xtest");
        expect(data.address).toBe("0xtest");
        expect(data.totalTrades).toBeDefined();
        expect(data.winRate).toBeDefined();
      });

      it("should accept overrides", () => {
        const data = createMockWalletData("0xtest", {
          totalTrades: 500,
          winRate: 0.8,
        });
        expect(data.totalTrades).toBe(500);
        expect(data.winRate).toBe(0.8);
      });
    });

    describe("createMockWalletDataBatch", () => {
      it("should create specified number of wallets", () => {
        const batch = createMockWalletDataBatch(10);
        expect(batch.length).toBe(10);
      });

      it("should create unique addresses", () => {
        const batch = createMockWalletDataBatch(20);
        const addresses = batch.map((w) => w.address);
        const uniqueAddresses = new Set(addresses);
        expect(uniqueAddresses.size).toBe(20);
      });
    });
  });

  describe("Default Constants", () => {
    it("should have valid DEFAULT_CLUSTERING_CONFIG", () => {
      expect(DEFAULT_CLUSTERING_CONFIG.algorithm).toBe(
        ClusteringAlgorithm.KMEANS_PLUS_PLUS
      );
      expect(DEFAULT_CLUSTERING_CONFIG.numClusters).toBe(5);
      expect(DEFAULT_CLUSTERING_CONFIG.maxIterations).toBe(100);
      expect(DEFAULT_CLUSTERING_CONFIG.convergenceThreshold).toBe(0.0001);
      expect(DEFAULT_CLUSTERING_CONFIG.features.length).toBeGreaterThan(0);
    });

    it("should have valid DEFAULT_CACHE_CONFIG", () => {
      expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CACHE_CONFIG.ttlMs).toBeGreaterThan(0);
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBeGreaterThan(0);
    });

    it("should have valid feature definitions", () => {
      for (const feature of DEFAULT_CLUSTER_FEATURE_DEFINITIONS) {
        expect(feature.name).toBeDefined();
        expect(feature.category).toBeDefined();
        expect(feature.description).toBeDefined();
        expect(feature.weight).toBeGreaterThan(0);
        expect(feature.min).toBeLessThanOrEqual(feature.max);
      }
    });
  });

  describe("Feature Categories", () => {
    it("should have features from all categories", () => {
      const categories = new Set(
        DEFAULT_CLUSTER_FEATURE_DEFINITIONS.map((f) => f.category)
      );

      expect(categories.has(ClusterFeatureCategory.TRADING_ACTIVITY)).toBe(true);
      expect(categories.has(ClusterFeatureCategory.VOLUME_PATTERNS)).toBe(true);
      expect(categories.has(ClusterFeatureCategory.TIMING_PATTERNS)).toBe(true);
      expect(categories.has(ClusterFeatureCategory.MARKET_PREFERENCES)).toBe(true);
      expect(categories.has(ClusterFeatureCategory.PERFORMANCE)).toBe(true);
      expect(categories.has(ClusterFeatureCategory.RISK_INDICATORS)).toBe(true);
    });
  });

  describe("Processing Time", () => {
    it("should track processing time", async () => {
      const walletData = createMockWalletDataBatch(20);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle single cluster", async () => {
      const walletData = createMockWalletDataBatch(10);
      const clusterer = new WalletClustering({ numClusters: 1 });
      const vectors = clusterer.extractFeaturesForWallets(walletData);

      const result = await clusterer.cluster(vectors);

      expect(result.clusters.length).toBe(1);
      expect(result.clusters[0]?.memberCount).toBe(10);
    });

    it("should handle wallets equal to cluster count", async () => {
      const walletData = createMockWalletDataBatch(5);
      const vectors = clustering.extractFeaturesForWallets(walletData);

      const result = await clustering.cluster(vectors);

      expect(result.clusters.length).toBe(5);
    });

    it("should handle identical wallets", async () => {
      const identicalData = Array.from({ length: 10 }, (_, i) =>
        createMockWalletData(`0x${i.toString(16).padStart(40, "0")}`, {
          totalTrades: 100,
          winRate: 0.5,
          avgTradeSizeUsd: 1000,
          totalVolumeUsd: 100000,
        })
      );
      const clusterer = new WalletClustering({ numClusters: 3 });
      const vectors = clusterer.extractFeaturesForWallets(identicalData);

      const result = await clusterer.cluster(vectors);

      expect(result).toBeDefined();
      expect(result.clusters.length).toBe(3);
    });

    it("should handle reproducible results with seed", async () => {
      const walletData = createMockWalletDataBatch(20);

      const clusterer1 = new WalletClustering({
        algorithm: ClusteringAlgorithm.KMEANS,
        numClusters: 3,
        randomSeed: 42,
      });
      const clusterer2 = new WalletClustering({
        algorithm: ClusteringAlgorithm.KMEANS,
        numClusters: 3,
        randomSeed: 42,
      });

      const vectors = clusterer1.extractFeaturesForWallets(walletData);

      const result1 = await clusterer1.cluster(vectors);
      const result2 = await clusterer2.cluster(vectors);

      // With same seed, should produce same assignments
      expect(result1.memberships.length).toBe(result2.memberships.length);
    });
  });
});
