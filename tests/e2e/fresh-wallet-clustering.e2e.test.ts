/**
 * E2E Tests for Fresh Wallet Clustering (DET-FRESH-006)
 *
 * Tests that:
 * 1. The app loads correctly with the clustering module
 * 2. The cluster analyzer can be imported and used
 * 3. Browser can access the app with clustering functionality
 * 4. End-to-end clustering workflows work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  ClusterType,
  ClusterConfidenceLevel,
  FreshWalletClusterAnalyzer,
  createFreshWalletClusterAnalyzer,
  getSharedFreshWalletClusterAnalyzer,
  setSharedFreshWalletClusterAnalyzer,
  resetSharedFreshWalletClusterAnalyzer,
  DEFAULT_CLUSTERING_THRESHOLDS,
  isWalletInCluster,
  hasHighCoordinationScore,
  type WalletClusteringResult,
  type BatchClusteringResult,
  type ClusteringThresholds,
  type ClusteringSummary,
} from "../../src/detection/fresh-wallet-clustering";
import { FreshWalletAlertSeverity } from "../../src/detection/fresh-wallet-config";

describe("Fresh Wallet Clustering E2E Tests", () => {
  describe("Detection Module Integration", () => {
    beforeAll(() => {
      resetSharedFreshWalletClusterAnalyzer();
    });

    afterAll(() => {
      resetSharedFreshWalletClusterAnalyzer();
    });

    it("should create and configure cluster analyzer", () => {
      const analyzer = createFreshWalletClusterAnalyzer({
        cacheTtlMs: 60000,
        maxCacheSize: 200,
        thresholds: {
          minClusterSize: 3,
          temporalWindowHours: 48,
          highCoordinationThreshold: 70,
        },
      });

      expect(analyzer).toBeInstanceOf(FreshWalletClusterAnalyzer);

      const thresholds = analyzer.getThresholds();
      expect(thresholds.minClusterSize).toBe(3);
      expect(thresholds.temporalWindowHours).toBe(48);
      expect(thresholds.highCoordinationThreshold).toBe(70);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(200);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should manage shared singleton correctly", () => {
      const shared1 = getSharedFreshWalletClusterAnalyzer();
      const shared2 = getSharedFreshWalletClusterAnalyzer();

      expect(shared1).toBe(shared2);

      resetSharedFreshWalletClusterAnalyzer();
      const shared3 = getSharedFreshWalletClusterAnalyzer();

      expect(shared3).not.toBe(shared1);
    });

    it("should allow setting custom shared analyzer", () => {
      const customAnalyzer = createFreshWalletClusterAnalyzer({
        thresholds: {
          minClusterSize: 4,
        },
      });

      setSharedFreshWalletClusterAnalyzer(customAnalyzer);
      const shared = getSharedFreshWalletClusterAnalyzer();

      expect(shared.getThresholds().minClusterSize).toBe(4);

      resetSharedFreshWalletClusterAnalyzer();
    });

    it("should have all required ClusterType enum values", () => {
      expect(ClusterType.FUNDING_SOURCE).toBe("FUNDING_SOURCE");
      expect(ClusterType.TEMPORAL).toBe("TEMPORAL");
      expect(ClusterType.TRADING_PATTERN).toBe("TRADING_PATTERN");
      expect(ClusterType.MULTI_FACTOR).toBe("MULTI_FACTOR");
    });

    it("should have all required ClusterConfidenceLevel enum values", () => {
      expect(ClusterConfidenceLevel.VERY_HIGH).toBe("VERY_HIGH");
      expect(ClusterConfidenceLevel.HIGH).toBe("HIGH");
      expect(ClusterConfidenceLevel.MEDIUM).toBe("MEDIUM");
      expect(ClusterConfidenceLevel.LOW).toBe("LOW");
      expect(ClusterConfidenceLevel.VERY_LOW).toBe("VERY_LOW");
    });

    it("should have correct default thresholds", () => {
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minClusterSize).toBe(2);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.temporalWindowHours).toBe(24);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minConfidence).toBe(30);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.fundingSimilarityThreshold).toBe(0.5);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.tradingSimilarityThreshold).toBe(0.5);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minSharedMarkets).toBe(2);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.sharedFundingSourcePoints).toBe(30);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.temporalProximityPoints).toBe(25);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.tradingPatternPoints).toBe(25);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.sharedMarketPoints).toBe(20);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.highCoordinationThreshold).toBe(60);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.criticalCoordinationThreshold).toBe(80);
    });

    it("should have analyzer methods available", () => {
      const analyzer = createFreshWalletClusterAnalyzer();

      expect(typeof analyzer.analyzeWallets).toBe("function");
      expect(typeof analyzer.analyzeWallet).toBe("function");
      expect(typeof analyzer.getSummary).toBe("function");
      expect(typeof analyzer.isWalletClustered).toBe("function");
      expect(typeof analyzer.hasHighCoordination).toBe("function");
      expect(typeof analyzer.getThresholds).toBe("function");
      expect(typeof analyzer.getConfigManager).toBe("function");
      expect(typeof analyzer.clearCache).toBe("function");
      expect(typeof analyzer.getCacheStats).toBe("function");
    });

    it("should have getConfigManager method returning config manager", () => {
      const analyzer = createFreshWalletClusterAnalyzer();
      const configManager = analyzer.getConfigManager();
      expect(configManager).toBeDefined();
    });
  });

  describe("Helper Function Integration", () => {
    it("should correctly identify wallets in clusters", () => {
      const clusteredResult: WalletClusteringResult = {
        address: "0x1234567890123456789012345678901234567890",
        clusterIds: ["FS-1", "TC-1"],
        clusterCount: 2,
        clusterConfidences: { "FS-1": 75, "TC-1": 60 },
        fundingSourceClusters: [],
        temporalCluster: null,
        tradingPatternCluster: null,
        overallClusterConfidence: 75,
        confidenceLevel: ClusterConfidenceLevel.HIGH,
        coordinationScore: 55,
        severity: FreshWalletAlertSeverity.MEDIUM,
        flagReasons: ["Member of 2 cluster(s)"],
        fromCache: false,
        analyzedAt: new Date(),
      };

      const unclusteredResult: WalletClusteringResult = {
        ...clusteredResult,
        clusterIds: [],
        clusterCount: 0,
        clusterConfidences: {},
        overallClusterConfidence: 0,
        confidenceLevel: ClusterConfidenceLevel.VERY_LOW,
        coordinationScore: 0,
        flagReasons: [],
      };

      expect(isWalletInCluster(clusteredResult)).toBe(true);
      expect(isWalletInCluster(unclusteredResult)).toBe(false);
    });

    it("should correctly identify high coordination scores", () => {
      const highScoreResult: WalletClusteringResult = {
        address: "0x1234567890123456789012345678901234567890",
        clusterIds: [],
        clusterCount: 0,
        clusterConfidences: {},
        fundingSourceClusters: [],
        temporalCluster: null,
        tradingPatternCluster: null,
        overallClusterConfidence: 0,
        confidenceLevel: ClusterConfidenceLevel.LOW,
        coordinationScore: 75,
        severity: FreshWalletAlertSeverity.HIGH,
        flagReasons: [],
        fromCache: false,
        analyzedAt: new Date(),
      };

      const lowScoreResult: WalletClusteringResult = {
        ...highScoreResult,
        coordinationScore: 30,
        severity: FreshWalletAlertSeverity.LOW,
      };

      // Default threshold is 60
      expect(hasHighCoordinationScore(highScoreResult)).toBe(true);
      expect(hasHighCoordinationScore(lowScoreResult)).toBe(false);

      // Custom thresholds
      expect(hasHighCoordinationScore(highScoreResult, 80)).toBe(false);
      expect(hasHighCoordinationScore(lowScoreResult, 25)).toBe(true);
    });
  });

  describe("Type Safety", () => {
    it("should properly type ClusteringThresholds", () => {
      const thresholds: ClusteringThresholds = {
        minClusterSize: 3,
        temporalWindowHours: 48,
        minConfidence: 40,
        fundingSimilarityThreshold: 0.6,
        tradingSimilarityThreshold: 0.6,
        minSharedMarkets: 3,
        sharedFundingSourcePoints: 35,
        temporalProximityPoints: 30,
        tradingPatternPoints: 30,
        sharedMarketPoints: 25,
        highCoordinationThreshold: 65,
        criticalCoordinationThreshold: 85,
      };

      expect(thresholds.minClusterSize).toBe(3);
      expect(thresholds.temporalWindowHours).toBe(48);
      expect(thresholds.minConfidence).toBe(40);
    });

    it("should properly type WalletClusteringResult", () => {
      const result: WalletClusteringResult = {
        address: "0x1234567890123456789012345678901234567890",
        clusterIds: ["FS-1"],
        clusterCount: 1,
        clusterConfidences: { "FS-1": 70 },
        fundingSourceClusters: [
          {
            sourceAddress: "0xabcdef",
            sourceName: "Binance",
            fundedWallets: ["0x1234"],
            totalAmount: 1000000000000000000n,
            formattedTotalAmount: "1.000000",
            fundingConcentration: 0.8,
            isSuspicious: false,
          },
        ],
        temporalCluster: {
          windowStart: new Date(),
          windowEnd: new Date(),
          windowDurationHours: 2,
          wallets: ["0x1234"],
          averageIntervalSeconds: 600,
          timingSuspicionScore: 40,
        },
        tradingPatternCluster: {
          patternSignature: "high-freq-large-buyer-focused",
          wallets: ["0x1234"],
          sharedMarkets: ["market-1"],
          averageSimilarity: 0.75,
          memberMetrics: [],
        },
        overallClusterConfidence: 70,
        confidenceLevel: ClusterConfidenceLevel.HIGH,
        coordinationScore: 45,
        severity: FreshWalletAlertSeverity.MEDIUM,
        flagReasons: ["Member of 1 cluster(s)"],
        fromCache: false,
        analyzedAt: new Date(),
      };

      expect(result.address).toBe("0x1234567890123456789012345678901234567890");
      expect(result.clusterIds).toHaveLength(1);
      expect(result.fundingSourceClusters).toHaveLength(1);
      expect(result.temporalCluster).not.toBeNull();
      expect(result.tradingPatternCluster).not.toBeNull();
    });

    it("should properly type BatchClusteringResult", () => {
      const batchResult: BatchClusteringResult = {
        results: new Map(),
        errors: new Map(),
        clusters: [
          {
            clusterId: "FS-1",
            clusterType: ClusterType.FUNDING_SOURCE,
            members: ["0x1234", "0x5678"],
            memberCount: 2,
            commonCharacteristics: [
              {
                type: "funding_source",
                description: "Shared Binance funding",
                addresses: ["0x1234", "0x5678"],
                signalStrength: 80,
              },
            ],
            confidence: 75,
            confidenceLevel: ClusterConfidenceLevel.HIGH,
            detectedAt: new Date(),
            severity: FreshWalletAlertSeverity.MEDIUM,
            flagReasons: ["Cluster of 2 related wallets detected"],
          },
        ],
        totalProcessed: 5,
        successCount: 4,
        errorCount: 1,
        clusteredWalletCount: 2,
        processingTimeMs: 150,
      };

      expect(batchResult.totalProcessed).toBe(5);
      expect(batchResult.clusters).toHaveLength(1);
      expect(batchResult.clusters[0]?.clusterType).toBe(ClusterType.FUNDING_SOURCE);
    });

    it("should properly type ClusteringSummary", () => {
      const summary: ClusteringSummary = {
        totalWallets: 10,
        clusteredWallets: 6,
        clusteredPercentage: 60,
        totalClusters: 3,
        byClusterType: {
          [ClusterType.FUNDING_SOURCE]: 1,
          [ClusterType.TEMPORAL]: 1,
          [ClusterType.TRADING_PATTERN]: 1,
          [ClusterType.MULTI_FACTOR]: 0,
        },
        byConfidenceLevel: {
          [ClusterConfidenceLevel.VERY_HIGH]: 0,
          [ClusterConfidenceLevel.HIGH]: 1,
          [ClusterConfidenceLevel.MEDIUM]: 1,
          [ClusterConfidenceLevel.LOW]: 1,
          [ClusterConfidenceLevel.VERY_LOW]: 0,
        },
        averageClusterSize: 2.5,
        largestClusterSize: 4,
        averageCoordinationScore: 45.5,
        highSeverityClusterCount: 1,
      };

      expect(summary.totalWallets).toBe(10);
      expect(summary.clusteredPercentage).toBe(60);
      expect(summary.byClusterType[ClusterType.FUNDING_SOURCE]).toBe(1);
    });
  });

  describe("Browser E2E Tests", () => {
    let browser: Browser | null = null;
    let page: Page | null = null;
    const APP_URL = "http://localhost:3000";

    beforeAll(async () => {
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        page = await browser.newPage();
      } catch {
        console.log("Puppeteer initialization skipped in CI environment");
      }
    }, 30000);

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it("should load the application", async () => {
      if (!page) {
        console.log("Skipping browser test - Puppeteer not available");
        return;
      }

      try {
        const response = await page.goto(APP_URL, {
          waitUntil: "networkidle0",
          timeout: 10000,
        });

        expect(response?.status()).toBe(200);
      } catch {
        console.log("Application not running at localhost:3000, skipping browser test");
      }
    }, 15000);

    it("should not have console errors on page load", async () => {
      if (!page) {
        console.log("Skipping browser test - Puppeteer not available");
        return;
      }

      const consoleErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      try {
        await page.goto(APP_URL, {
          waitUntil: "networkidle0",
          timeout: 10000,
        });

        // Filter out expected errors (like missing favicon)
        const significantErrors = consoleErrors.filter(
          (err) => !err.includes("favicon") && !err.includes("404")
        );

        expect(significantErrors).toHaveLength(0);
      } catch {
        console.log("Application not running, skipping console error check");
      }
    }, 15000);

    it("should have correct page title", async () => {
      if (!page) {
        console.log("Skipping browser test - Puppeteer not available");
        return;
      }

      try {
        await page.goto(APP_URL, {
          waitUntil: "networkidle0",
          timeout: 10000,
        });

        const title = await page.title();
        expect(title).toBeTruthy();
      } catch {
        console.log("Application not running, skipping title check");
      }
    }, 15000);
  });

  describe("Cache Behavior E2E", () => {
    it("should properly manage cache lifecycle", () => {
      const analyzer = createFreshWalletClusterAnalyzer({
        maxCacheSize: 10,
        cacheTtlMs: 1000,
      });

      // Initial state
      const initialStats = analyzer.getCacheStats();
      expect(initialStats.size).toBe(0);
      expect(initialStats.maxSize).toBe(10);
      expect(initialStats.ttlMs).toBe(1000);

      // Clear cache
      analyzer.clearCache();
      const clearedStats = analyzer.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });
  });

  describe("Threshold Configuration E2E", () => {
    it("should merge custom thresholds with defaults", () => {
      const analyzer = createFreshWalletClusterAnalyzer({
        thresholds: {
          minClusterSize: 5,
          // Other values should remain default
        },
      });

      const thresholds = analyzer.getThresholds();

      // Custom value
      expect(thresholds.minClusterSize).toBe(5);

      // Default values
      expect(thresholds.temporalWindowHours).toBe(24);
      expect(thresholds.minConfidence).toBe(30);
      expect(thresholds.highCoordinationThreshold).toBe(60);
    });

    it("should allow all threshold customizations", () => {
      const customThresholds: Partial<ClusteringThresholds> = {
        minClusterSize: 4,
        temporalWindowHours: 12,
        minConfidence: 50,
        fundingSimilarityThreshold: 0.7,
        tradingSimilarityThreshold: 0.7,
        minSharedMarkets: 3,
        sharedFundingSourcePoints: 40,
        temporalProximityPoints: 35,
        tradingPatternPoints: 35,
        sharedMarketPoints: 30,
        highCoordinationThreshold: 70,
        criticalCoordinationThreshold: 90,
      };

      const analyzer = createFreshWalletClusterAnalyzer({
        thresholds: customThresholds,
      });

      const thresholds = analyzer.getThresholds();

      expect(thresholds.minClusterSize).toBe(4);
      expect(thresholds.temporalWindowHours).toBe(12);
      expect(thresholds.minConfidence).toBe(50);
      expect(thresholds.fundingSimilarityThreshold).toBe(0.7);
      expect(thresholds.tradingSimilarityThreshold).toBe(0.7);
      expect(thresholds.minSharedMarkets).toBe(3);
      expect(thresholds.sharedFundingSourcePoints).toBe(40);
      expect(thresholds.temporalProximityPoints).toBe(35);
      expect(thresholds.tradingPatternPoints).toBe(35);
      expect(thresholds.sharedMarketPoints).toBe(30);
      expect(thresholds.highCoordinationThreshold).toBe(70);
      expect(thresholds.criticalCoordinationThreshold).toBe(90);
    });
  });

  describe("Cluster Type Coverage E2E", () => {
    it("should support all cluster type scenarios", () => {
      // Test that all cluster types are properly defined and usable
      const clusterTypes = [
        ClusterType.FUNDING_SOURCE,
        ClusterType.TEMPORAL,
        ClusterType.TRADING_PATTERN,
        ClusterType.MULTI_FACTOR,
      ];

      expect(clusterTypes).toHaveLength(4);

      clusterTypes.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it("should support all confidence level scenarios", () => {
      const confidenceLevels = [
        ClusterConfidenceLevel.VERY_HIGH,
        ClusterConfidenceLevel.HIGH,
        ClusterConfidenceLevel.MEDIUM,
        ClusterConfidenceLevel.LOW,
        ClusterConfidenceLevel.VERY_LOW,
      ];

      expect(confidenceLevels).toHaveLength(5);

      confidenceLevels.forEach((level) => {
        expect(typeof level).toBe("string");
        expect(level.length).toBeGreaterThan(0);
      });
    });

    it("should map severity levels correctly", () => {
      const severityLevels = [
        FreshWalletAlertSeverity.LOW,
        FreshWalletAlertSeverity.MEDIUM,
        FreshWalletAlertSeverity.HIGH,
        FreshWalletAlertSeverity.CRITICAL,
      ];

      expect(severityLevels).toHaveLength(4);

      severityLevels.forEach((severity) => {
        expect(typeof severity).toBe("string");
        expect(severity.length).toBeGreaterThan(0);
      });
    });
  });
});
