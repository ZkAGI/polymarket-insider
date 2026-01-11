/**
 * Unit Tests for First Trade Size Analyzer (DET-FRESH-004)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FirstTradeSizeAnalyzer,
  FirstTradeSizeCategory,
  DEFAULT_FIRST_TRADE_THRESHOLDS,
  DEFAULT_FIRST_TRADE_STATS,
  createFirstTradeSizeAnalyzer,
  getSharedFirstTradeSizeAnalyzer,
  setSharedFirstTradeSizeAnalyzer,
  resetSharedFirstTradeSizeAnalyzer,
  analyzeFirstTradeSize,
  batchAnalyzeFirstTradeSize,
  isFirstTradeOutlier,
  getFirstTradeInfo,
  getFirstTradeSizeSummary,
  type FirstTradeSizeResult,
  type FirstTradeStats,
  type FirstTradeSizeAnalyzerConfig,
} from "../../src/detection/first-trade-size";
import { FreshWalletAlertSeverity } from "../../src/detection";

// Mock the external dependencies
vi.mock("../../src/api/clob/trades", () => ({
  getAllTradesByWallet: vi.fn(),
}));

vi.mock("../../src/detection/fresh-wallet-config", () => ({
  getSharedFreshWalletConfigManager: vi.fn(),
  FreshWalletAlertSeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

import { getAllTradesByWallet } from "../../src/api/clob/trades";
import { getSharedFreshWalletConfigManager } from "../../src/detection/fresh-wallet-config";

// Test wallet addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const INVALID_ADDRESS = "0xinvalid";

// Mock config manager
const mockConfigManager = {
  getConfig: vi.fn(),
  evaluateWallet: vi.fn(),
};

// Sample trade data
const createTrade = (overrides: Partial<{
  id: string;
  asset_id: string;
  size: string;
  price: string;
  side: "buy" | "sell";
  created_at: string;
  transaction_hash: string;
}> = {}) => ({
  id: overrides.id ?? "trade-1",
  asset_id: overrides.asset_id ?? "token-123",
  size: overrides.size ?? "100",
  price: overrides.price ?? "0.5",
  side: overrides.side ?? "buy",
  created_at: overrides.created_at ?? "2024-01-01T00:00:00Z",
  transaction_hash: overrides.transaction_hash ?? "0xabc123",
});

describe("FirstTradeSizeAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFirstTradeSizeAnalyzer();

    // Set up default mocks
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
  });

  afterEach(() => {
    resetSharedFirstTradeSizeAnalyzer();
  });

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const analyzer = new FirstTradeSizeAnalyzer();
      expect(analyzer).toBeInstanceOf(FirstTradeSizeAnalyzer);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttlMs).toBe(5 * 60 * 1000);

      const thresholds = analyzer.getThresholds();
      expect(thresholds).toEqual(DEFAULT_FIRST_TRADE_THRESHOLDS);
    });

    it("should create with custom configuration", () => {
      const config: FirstTradeSizeAnalyzerConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        thresholds: {
          minSizeUsd: 5,
          outlierZScore: 3,
        },
      };

      const analyzer = new FirstTradeSizeAnalyzer(config);
      const stats = analyzer.getCacheStats();

      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);

      const thresholds = analyzer.getThresholds();
      expect(thresholds.minSizeUsd).toBe(5);
      expect(thresholds.outlierZScore).toBe(3);
      // Other thresholds should be default
      expect(thresholds.largePercentile).toBe(DEFAULT_FIRST_TRADE_THRESHOLDS.largePercentile);
    });

    it("should initialize with historical samples and calculate stats", () => {
      const samples = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
      const analyzer = new FirstTradeSizeAnalyzer({ historicalSamples: samples });

      const stats = analyzer.getHistoricalStats();
      expect(stats.sampleSize).toBe(10);
      expect(stats.averageSizeUsd).toBeCloseTo(275, 0);
      expect(stats.minSizeUsd).toBe(50);
      expect(stats.maxSizeUsd).toBe(500);
    });
  });

  describe("analyzeWallet", () => {
    it("should throw error for invalid address", async () => {
      const analyzer = new FirstTradeSizeAnalyzer();

      await expect(analyzer.analyzeWallet(INVALID_ADDRESS)).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should throw error for empty address", async () => {
      const analyzer = new FirstTradeSizeAnalyzer();

      await expect(analyzer.analyzeWallet("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should handle wallet with no trades", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(false);
      expect(result.isOutlier).toBe(false);
      expect(result.firstTrade).toBeNull();
      expect(result.sizeCategory).toBe(FirstTradeSizeCategory.SMALL);
      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
      expect(result.percentile).toBeNull();
      expect(result.zScore).toBeNull();
    });

    it("should handle wallet with empty trades array", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(false);
      expect(result.firstTrade).toBeNull();
    });

    it("should analyze small first trade correctly", async () => {
      const trade = createTrade({ size: "10", price: "0.5" }); // $5 trade
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(true);
      expect(result.isOutlier).toBe(false);
      expect(result.firstTrade).not.toBeNull();
      expect(result.firstTrade?.sizeUsd).toBe(5);
      expect(result.sizeCategory).toBe(FirstTradeSizeCategory.SMALL);
      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
    });

    it("should analyze normal first trade correctly", async () => {
      const trade = createTrade({ size: "200", price: "0.5" }); // $100 trade
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(true);
      expect(result.firstTrade?.sizeUsd).toBe(100);
      // Near median/average, should be NORMAL
      expect(result.sizeCategory).toBe(FirstTradeSizeCategory.NORMAL);
    });

    it("should flag large first trade", async () => {
      const trade = createTrade({ size: "1000", price: "0.5" }); // $500 trade
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(true);
      expect(result.firstTrade?.sizeUsd).toBe(500);
      // 90th percentile threshold is 500, so should be LARGE or VERY_LARGE
      expect([FirstTradeSizeCategory.LARGE, FirstTradeSizeCategory.VERY_LARGE]).toContain(
        result.sizeCategory
      );
    });

    it("should flag outlier first trade", async () => {
      const trade = createTrade({ size: "40000", price: "0.5" }); // $20000 trade
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasTrades).toBe(true);
      expect(result.isOutlier).toBe(true);
      expect(result.firstTrade?.sizeUsd).toBe(20000);
      expect(result.sizeCategory).toBe(FirstTradeSizeCategory.OUTLIER);
      expect(result.severity).toBe(FreshWalletAlertSeverity.CRITICAL);
      expect(result.flagReasons.length).toBeGreaterThan(0);
    });

    it("should select earliest trade as first trade", async () => {
      const trades = [
        createTrade({ id: "trade-2", created_at: "2024-01-02T00:00:00Z", size: "200" }),
        createTrade({ id: "trade-1", created_at: "2024-01-01T00:00:00Z", size: "100" }),
        createTrade({ id: "trade-3", created_at: "2024-01-03T00:00:00Z", size: "300" }),
      ];
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(trades);

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.firstTrade?.id).toBe("trade-1");
      expect(result.firstTrade?.size).toBe(100);
    });

    it("should use cache for subsequent requests", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();

      const result1 = await analyzer.analyzeWallet(VALID_ADDRESS);
      expect(result1.fromCache).toBe(false);

      const result2 = await analyzer.analyzeWallet(VALID_ADDRESS);
      expect(result2.fromCache).toBe(true);

      // API should only be called once
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when requested", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();

      await analyzer.analyzeWallet(VALID_ADDRESS);
      const result = await analyzer.analyzeWallet(VALID_ADDRESS, { bypassCache: true });

      expect(result.fromCache).toBe(false);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(2);
    });

    it("should use custom comparison stats", async () => {
      const trade = createTrade({ size: "1000", price: "0.5" }); // $500 trade
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const customStats: FirstTradeStats = {
        ...DEFAULT_FIRST_TRADE_STATS,
        averageSizeUsd: 1000,
        percentile75: 2000,
        percentile90: 5000,
        percentile95: 10000,
        percentile99: 50000,
      };

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallet(VALID_ADDRESS, {
        comparisonStats: customStats,
      });

      // With higher thresholds, $500 should be NORMAL
      expect(result.sizeCategory).toBe(FirstTradeSizeCategory.NORMAL);
      expect(result.multipleOfAverage).toBe(0.5);
    });
  });

  describe("analyzeWallets (batch)", () => {
    it("should analyze multiple wallets", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([createTrade({ size: "100", price: "0.5" })]) // $50
        .mockResolvedValueOnce([createTrade({ size: "40000", price: "0.5" })]); // $20000 outlier

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.outlierCount).toBe(1);
      expect(result.results.size).toBe(2);
    });

    it("should handle errors for individual wallets", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([createTrade()])
        .mockRejectedValueOnce(new Error("API error"));

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      // The error map uses checksummed addresses
      expect(result.errors.size).toBe(1);
      expect(Array.from(result.errors.keys())[0]?.toLowerCase()).toBe(VALID_ADDRESS_2.toLowerCase());
    });

    it("should track category counts", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([createTrade({ size: "10", price: "0.5" })]) // Small
        .mockResolvedValueOnce([createTrade({ size: "40000", price: "0.5" })]); // Outlier

      const analyzer = new FirstTradeSizeAnalyzer();
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.bySizeCategory[FirstTradeSizeCategory.SMALL]).toBe(1);
      expect(result.bySizeCategory[FirstTradeSizeCategory.OUTLIER]).toBe(1);
    });
  });

  describe("getSummary", () => {
    it("should calculate summary statistics", async () => {
      const results: FirstTradeSizeResult[] = [
        {
          address: VALID_ADDRESS,
          hasTrades: true,
          isOutlier: false,
          firstTrade: { id: "1", assetId: "t1", size: 100, sizeUsd: 50, price: 0.5, side: "buy", timestamp: "", transactionHash: null },
          sizeCategory: FirstTradeSizeCategory.NORMAL,
          percentile: 50,
          zScore: 0,
          multipleOfAverage: 1,
          severity: FreshWalletAlertSeverity.LOW,
          flagReasons: [],
          comparisonStats: DEFAULT_FIRST_TRADE_STATS,
          fromCache: false,
          analyzedAt: new Date(),
        },
        {
          address: VALID_ADDRESS_2,
          hasTrades: true,
          isOutlier: true,
          firstTrade: { id: "2", assetId: "t2", size: 20000, sizeUsd: 10000, price: 0.5, side: "buy", timestamp: "", transactionHash: null },
          sizeCategory: FirstTradeSizeCategory.OUTLIER,
          percentile: 99,
          zScore: 5,
          multipleOfAverage: 10,
          severity: FreshWalletAlertSeverity.CRITICAL,
          flagReasons: ["High percentile"],
          comparisonStats: DEFAULT_FIRST_TRADE_STATS,
          fromCache: false,
          analyzedAt: new Date(),
        },
      ];

      const analyzer = new FirstTradeSizeAnalyzer();
      const summary = analyzer.getSummary(results);

      expect(summary.total).toBe(2);
      expect(summary.withTrades).toBe(2);
      expect(summary.withoutTrades).toBe(0);
      expect(summary.outlierPercentage).toBe(50);
      expect(summary.bySizeCategory[FirstTradeSizeCategory.NORMAL]).toBe(1);
      expect(summary.bySizeCategory[FirstTradeSizeCategory.OUTLIER]).toBe(1);
      expect(summary.bySeverity[FreshWalletAlertSeverity.LOW]).toBe(1);
      expect(summary.bySeverity[FreshWalletAlertSeverity.CRITICAL]).toBe(1);
      expect(summary.averageFirstTradeSizeUsd).toBe(5025);
      expect(summary.medianFirstTradeSizeUsd).toBe(5025);
    });

    it("should handle empty results", () => {
      const analyzer = new FirstTradeSizeAnalyzer();
      const summary = analyzer.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.outlierPercentage).toBe(0);
      expect(summary.averageFirstTradeSizeUsd).toBeNull();
      expect(summary.medianFirstTradeSizeUsd).toBeNull();
    });
  });

  describe("isFirstTradeOutlier", () => {
    it("should return true for outlier trades", async () => {
      const trade = createTrade({ size: "40000", price: "0.5" }); // $20000
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const isOutlier = await analyzer.isFirstTradeOutlier(VALID_ADDRESS);

      expect(isOutlier).toBe(true);
    });

    it("should return false for normal trades", async () => {
      const trade = createTrade({ size: "100", price: "0.5" }); // $50
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const isOutlier = await analyzer.isFirstTradeOutlier(VALID_ADDRESS);

      expect(isOutlier).toBe(false);
    });
  });

  describe("getFirstTrade", () => {
    it("should return first trade info", async () => {
      const trade = createTrade({ id: "trade-abc", size: "100", price: "0.5" });
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const firstTrade = await analyzer.getFirstTrade(VALID_ADDRESS);

      expect(firstTrade).not.toBeNull();
      expect(firstTrade?.id).toBe("trade-abc");
      expect(firstTrade?.sizeUsd).toBe(50);
    });

    it("should return null for wallet with no trades", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new FirstTradeSizeAnalyzer();
      const firstTrade = await analyzer.getFirstTrade(VALID_ADDRESS);

      expect(firstTrade).toBeNull();
    });
  });

  describe("addSample and statistics", () => {
    it("should add samples and recalculate stats", () => {
      const analyzer = new FirstTradeSizeAnalyzer();

      // Add enough samples to trigger recalculation
      for (let i = 1; i <= 10; i++) {
        analyzer.addSample(i * 100); // 100, 200, ..., 1000
      }

      const stats = analyzer.getHistoricalStats();
      expect(stats.sampleSize).toBe(10);
      expect(stats.averageSizeUsd).toBeCloseTo(550, 0);
      expect(stats.minSizeUsd).toBe(100);
      expect(stats.maxSizeUsd).toBe(1000);
    });

    it("should maintain rolling window of samples", () => {
      const analyzer = new FirstTradeSizeAnalyzer();

      // Add more than max samples
      for (let i = 0; i < 10005; i++) {
        analyzer.addSample(100);
      }

      const stats = analyzer.getHistoricalStats();
      expect(stats.sampleSize).toBe(10000);
    });
  });

  describe("Cache operations", () => {
    it("should clear cache", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(analyzer.getCacheStats().size).toBe(1);

      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const analyzer = new FirstTradeSizeAnalyzer();
      await analyzer.analyzeWallet(VALID_ADDRESS);
      await analyzer.analyzeWallet(VALID_ADDRESS_2);

      expect(analyzer.getCacheStats().size).toBe(2);

      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(true);
      expect(analyzer.getCacheStats().size).toBe(1);
    });

    it("should return false when invalidating non-existent entry", () => {
      const analyzer = new FirstTradeSizeAnalyzer();
      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(false);
    });
  });

  describe("resetStats", () => {
    it("should reset to default statistics", () => {
      const analyzer = new FirstTradeSizeAnalyzer({
        historicalSamples: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
      });

      expect(analyzer.getHistoricalStats().averageSizeUsd).toBeCloseTo(550, 0);

      analyzer.resetStats();

      const stats = analyzer.getHistoricalStats();
      expect(stats.averageSizeUsd).toBe(DEFAULT_FIRST_TRADE_STATS.averageSizeUsd);
    });
  });
});

describe("Singleton Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFirstTradeSizeAnalyzer();
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
  });

  afterEach(() => {
    resetSharedFirstTradeSizeAnalyzer();
  });

  it("should create shared analyzer on first access", () => {
    const shared = getSharedFirstTradeSizeAnalyzer();
    expect(shared).toBeInstanceOf(FirstTradeSizeAnalyzer);
  });

  it("should return same instance on subsequent calls", () => {
    const shared1 = getSharedFirstTradeSizeAnalyzer();
    const shared2 = getSharedFirstTradeSizeAnalyzer();
    expect(shared1).toBe(shared2);
  });

  it("should allow setting custom shared instance", () => {
    const custom = createFirstTradeSizeAnalyzer({ cacheTtlMs: 1000 });
    setSharedFirstTradeSizeAnalyzer(custom);

    const shared = getSharedFirstTradeSizeAnalyzer();
    expect(shared).toBe(custom);
    expect(shared.getCacheStats().ttlMs).toBe(1000);
  });

  it("should reset shared instance", () => {
    const shared1 = getSharedFirstTradeSizeAnalyzer();
    resetSharedFirstTradeSizeAnalyzer();
    const shared2 = getSharedFirstTradeSizeAnalyzer();

    expect(shared1).not.toBe(shared2);
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFirstTradeSizeAnalyzer();
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
  });

  afterEach(() => {
    resetSharedFirstTradeSizeAnalyzer();
  });

  describe("analyzeFirstTradeSize", () => {
    it("should use shared analyzer by default", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const result = await analyzeFirstTradeSize(VALID_ADDRESS);
      expect(result.address.toLowerCase()).toBe(VALID_ADDRESS.toLowerCase());
    });

    it("should accept custom analyzer", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const customAnalyzer = createFirstTradeSizeAnalyzer({ cacheTtlMs: 1000 });
      const result = await analyzeFirstTradeSize(VALID_ADDRESS, { analyzer: customAnalyzer });

      expect(result.address.toLowerCase()).toBe(VALID_ADDRESS.toLowerCase());
    });
  });

  describe("batchAnalyzeFirstTradeSize", () => {
    it("should analyze multiple wallets", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);

      const result = await batchAnalyzeFirstTradeSize([VALID_ADDRESS, VALID_ADDRESS_2]);
      expect(result.totalProcessed).toBe(2);
    });
  });

  describe("isFirstTradeOutlier", () => {
    it("should check outlier status", async () => {
      const trade = createTrade({ size: "40000", price: "0.5" });
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const outlier = await isFirstTradeOutlier(VALID_ADDRESS);
      expect(outlier).toBe(true);
    });
  });

  describe("getFirstTradeInfo", () => {
    it("should get first trade info", async () => {
      const trade = createTrade({ id: "test-trade" });
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);

      const info = await getFirstTradeInfo(VALID_ADDRESS);
      expect(info?.id).toBe("test-trade");
    });
  });

  describe("getFirstTradeSizeSummary", () => {
    it("should get summary for results", () => {
      const results: FirstTradeSizeResult[] = [{
        address: VALID_ADDRESS,
        hasTrades: true,
        isOutlier: false,
        firstTrade: { id: "1", assetId: "t1", size: 100, sizeUsd: 50, price: 0.5, side: "buy", timestamp: "", transactionHash: null },
        sizeCategory: FirstTradeSizeCategory.NORMAL,
        percentile: 50,
        zScore: 0,
        multipleOfAverage: 1,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        comparisonStats: DEFAULT_FIRST_TRADE_STATS,
        fromCache: false,
        analyzedAt: new Date(),
      }];

      const summary = getFirstTradeSizeSummary(results);
      expect(summary.total).toBe(1);
    });
  });
});

describe("Default Constants", () => {
  it("should export DEFAULT_FIRST_TRADE_THRESHOLDS", () => {
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS).toBeDefined();
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.minSizeUsd).toBe(10);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.outlierZScore).toBe(2.5);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.largePercentile).toBe(75);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.veryLargePercentile).toBe(90);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.outlierPercentile).toBe(95);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.suspiciousMultiple).toBe(5);
    expect(DEFAULT_FIRST_TRADE_THRESHOLDS.absoluteThresholdUsd).toBe(10000);
  });

  it("should export DEFAULT_FIRST_TRADE_STATS", () => {
    expect(DEFAULT_FIRST_TRADE_STATS).toBeDefined();
    expect(DEFAULT_FIRST_TRADE_STATS.sampleSize).toBe(1000);
    expect(DEFAULT_FIRST_TRADE_STATS.averageSizeUsd).toBe(150);
    expect(DEFAULT_FIRST_TRADE_STATS.medianSizeUsd).toBe(50);
    expect(DEFAULT_FIRST_TRADE_STATS.percentile75).toBe(200);
    expect(DEFAULT_FIRST_TRADE_STATS.percentile90).toBe(500);
    expect(DEFAULT_FIRST_TRADE_STATS.percentile95).toBe(1000);
    expect(DEFAULT_FIRST_TRADE_STATS.percentile99).toBe(5000);
  });
});

describe("FirstTradeSizeCategory Enum", () => {
  it("should have correct enum values", () => {
    expect(FirstTradeSizeCategory.SMALL).toBe("SMALL");
    expect(FirstTradeSizeCategory.NORMAL).toBe("NORMAL");
    expect(FirstTradeSizeCategory.LARGE).toBe("LARGE");
    expect(FirstTradeSizeCategory.VERY_LARGE).toBe("VERY_LARGE");
    expect(FirstTradeSizeCategory.OUTLIER).toBe("OUTLIER");
  });
});
