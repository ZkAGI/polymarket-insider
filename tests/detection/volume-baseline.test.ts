/**
 * Tests for Market Baseline Volume Calculator (DET-VOL-001)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MarketMaturity,
  BaselineWindow,
  VolumeBaselineCalculator,
  createVolumeBaselineCalculator,
  getSharedVolumeBaselineCalculator,
  setSharedVolumeBaselineCalculator,
  resetSharedVolumeBaselineCalculator,
  calculateMarketVolumeBaseline,
  batchCalculateMarketVolumeBaselines,
  checkVolumeAnomaly,
  getMarketBaselineSummary,
  type MarketVolumeBaseline,
  type WindowVolumeStats,
  type VolumeBaselineCalculatorConfig,
} from "../../src/detection/volume-baseline";

// Mock the gamma API markets module
vi.mock("../../src/api/gamma/markets", () => ({
  getMarketById: vi.fn(),
  getMarketVolumeHistory: vi.fn(),
}));

import { getMarketById, getMarketVolumeHistory } from "../../src/api/gamma/markets";

const mockGetMarketById = vi.mocked(getMarketById);
const mockGetMarketVolumeHistory = vi.mocked(getMarketVolumeHistory);

// ============================================================================
// Test Data
// ============================================================================

const createMockMarket = (overrides: Partial<{
  id: string;
  question: string;
  category: string;
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  createdAt: string;
}> = {}) => ({
  id: overrides.id ?? "market-123",
  question: overrides.question ?? "Will Bitcoin reach $100k?",
  slug: "bitcoin-100k",
  description: "A market about Bitcoin",
  category: overrides.category ?? "crypto",
  active: overrides.active ?? true,
  closed: overrides.closed ?? false,
  archived: false,
  outcomes: [],
  volume: overrides.volume ?? 1000000,
  liquidity: overrides.liquidity ?? 50000,
  createdAt: overrides.createdAt ?? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
  updatedAt: new Date().toISOString(),
});

const createMockVolumeHistory = (options: {
  marketId?: string;
  dataPointCount?: number;
  avgVolume?: number;
  volatility?: number;
} = {}) => {
  const dataPointCount = options.dataPointCount ?? 30;
  const avgVolume = options.avgVolume ?? 10000;
  const volatility = options.volatility ?? 0.2;

  const dataPoints = [];
  let cumulative = 0;

  for (let i = 0; i < dataPointCount; i++) {
    // Add some variance based on volatility
    const variance = 1 + (Math.sin(i * 0.5) * volatility);
    const volume = avgVolume * variance;
    cumulative += volume;

    dataPoints.push({
      timestamp: new Date(Date.now() - (dataPointCount - i) * 24 * 60 * 60 * 1000).toISOString(),
      volume,
      tradeCount: Math.floor(volume / 100),
      cumulativeVolume: cumulative,
    });
  }

  return {
    marketId: options.marketId ?? "market-123",
    question: "Will Bitcoin reach $100k?",
    startDate: new Date(Date.now() - dataPointCount * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    interval: "1d" as const,
    dataPoints,
    totalVolume: cumulative,
    totalTrades: dataPoints.reduce((sum, dp) => sum + (dp.tradeCount ?? 0), 0),
    fetchedAt: new Date().toISOString(),
  };
};

// ============================================================================
// Tests
// ============================================================================

describe("VolumeBaselineCalculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedVolumeBaselineCalculator();
  });

  afterEach(() => {
    resetSharedVolumeBaselineCalculator();
  });

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const calculator = new VolumeBaselineCalculator();
      expect(calculator).toBeInstanceOf(VolumeBaselineCalculator);

      const stats = calculator.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttlMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it("should create with custom configuration", () => {
      const config: VolumeBaselineCalculatorConfig = {
        defaultLookbackDays: 60,
        defaultWindows: [BaselineWindow.DAILY, BaselineWindow.WEEKLY],
        cacheConfig: {
          enabled: false,
          ttlMs: 30 * 60 * 1000,
          maxSize: 500,
        },
      };

      const calculator = new VolumeBaselineCalculator(config);
      expect(calculator).toBeInstanceOf(VolumeBaselineCalculator);

      const stats = calculator.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(30 * 60 * 1000);
    });
  });

  describe("calculateBaseline", () => {
    it("should return null for empty market ID", async () => {
      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("");
      expect(result).toBeNull();
    });

    it("should return null if market not found", async () => {
      mockGetMarketById.mockResolvedValue(null);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("non-existent");

      expect(result).toBeNull();
      expect(mockGetMarketById).toHaveBeenCalledWith("non-existent", expect.any(Object));
    });

    it("should calculate baseline for valid market", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result).not.toBeNull();
      expect(result!.marketId).toBe("market-123");
      expect(result!.question).toBe(mockMarket.question);
      expect(result!.category).toBe(mockMarket.category);
      expect(result!.currentVolume).toBe(mockMarket.volume);
      expect(result!.isActive).toBe(true);
      expect(result!.fromCache).toBe(false);
    });

    it("should include all window statistics", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result).not.toBeNull();
      expect(result!.windowStats).toBeDefined();
      expect(result!.windowStats[BaselineWindow.HOURLY]).toBeDefined();
      expect(result!.windowStats[BaselineWindow.DAILY]).toBeDefined();
      expect(result!.windowStats[BaselineWindow.WEEKLY]).toBeDefined();
    });

    it("should calculate correct statistics for daily window", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory({ avgVolume: 10000, dataPointCount: 30 });

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      const dailyStats = result!.windowStats[BaselineWindow.DAILY];
      expect(dailyStats.dataPointCount).toBeGreaterThan(0);
      expect(dailyStats.averageVolume).toBeGreaterThan(0);
      expect(dailyStats.totalVolume).toBeGreaterThan(0);
      expect(dailyStats.standardDeviation).toBeGreaterThanOrEqual(0);
    });

    it("should use cache on subsequent calls", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();

      // First call
      const result1 = await calculator.calculateBaseline("market-123");
      expect(result1!.fromCache).toBe(false);

      // Second call should be from cache
      const result2 = await calculator.calculateBaseline("market-123");
      expect(result2!.fromCache).toBe(true);

      // Only one API call should have been made
      expect(mockGetMarketById).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when requested", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();

      // First call
      await calculator.calculateBaseline("market-123");

      // Second call with bypass
      const result2 = await calculator.calculateBaseline("market-123", { bypassCache: true });
      expect(result2!.fromCache).toBe(false);

      // Two API calls should have been made
      expect(mockGetMarketById).toHaveBeenCalledTimes(2);
    });

    it("should respect custom lookback days", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123", { lookbackDays: 60 });

      expect(result).not.toBeNull();
      // Verify the time range in the result
      const startDate = new Date(result!.calculationTimeRange.startDate);
      const endDate = new Date(result!.calculationTimeRange.endDate);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(60);
    });
  });

  describe("market maturity classification", () => {
    it("should classify very new market (< 1 day)", async () => {
      const mockMarket = createMockMarket({
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result!.maturity).toBe(MarketMaturity.VERY_NEW);
    });

    it("should classify new market (1-7 days)", async () => {
      const mockMarket = createMockMarket({
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result!.maturity).toBe(MarketMaturity.NEW);
    });

    it("should classify young market (7-30 days)", async () => {
      const mockMarket = createMockMarket({
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result!.maturity).toBe(MarketMaturity.YOUNG);
    });

    it("should classify established market (30-90 days)", async () => {
      const mockMarket = createMockMarket({
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
      });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result!.maturity).toBe(MarketMaturity.ESTABLISHED);
    });

    it("should classify mature market (> 90 days)", async () => {
      const mockMarket = createMockMarket({
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days ago
      });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.calculateBaseline("market-123");

      expect(result!.maturity).toBe(MarketMaturity.MATURE);
    });
  });

  describe("batchCalculateBaselines", () => {
    it("should process multiple markets", async () => {
      const mockMarket1 = createMockMarket({ id: "market-1" });
      const mockMarket2 = createMockMarket({ id: "market-2" });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById
        .mockResolvedValueOnce(mockMarket1)
        .mockResolvedValueOnce(mockMarket2);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.batchCalculateBaselines(["market-1", "market-2"]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(2);
    });

    it("should handle mixed success and failure", async () => {
      const mockMarket1 = createMockMarket({ id: "market-1" });
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById
        .mockResolvedValueOnce(mockMarket1)
        .mockResolvedValueOnce(null);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.batchCalculateBaselines(["market-1", "market-2"]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results.has("market-1")).toBe(true);
      expect(result.errors.has("market-2")).toBe(true);
    });

    it("should handle API errors gracefully", async () => {
      mockGetMarketById.mockRejectedValue(new Error("API Error"));

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.batchCalculateBaselines(["market-1"]);

      expect(result.totalProcessed).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors.get("market-1")).toBe("API Error");
    });

    it("should track processing time", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();
      const result = await calculator.batchCalculateBaselines(["market-1"]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getSummary", () => {
    it("should return empty summary for empty baselines", () => {
      const calculator = new VolumeBaselineCalculator();
      const summary = calculator.getSummary([]);

      expect(summary.totalMarkets).toBe(0);
      expect(summary.averageDailyVolume).toBe(0);
      expect(summary.topMarketsByVolume).toHaveLength(0);
    });

    it("should calculate correct summary statistics", async () => {
      // Create mock baselines directly
      const baselines: MarketVolumeBaseline[] = [
        {
          marketId: "market-1",
          question: "Market 1",
          category: "crypto",
          maturity: MarketMaturity.ESTABLISHED,
          marketAgeDays: 60,
          isActive: true,
          currentVolume: 1000000,
          currentLiquidity: 50000,
          windowStats: {
            [BaselineWindow.HOURLY]: createMockWindowStats(1000),
            [BaselineWindow.FOUR_HOUR]: createMockWindowStats(4000),
            [BaselineWindow.DAILY]: createMockWindowStats(20000, 0.3),
            [BaselineWindow.WEEKLY]: createMockWindowStats(140000),
            [BaselineWindow.MONTHLY]: createMockWindowStats(600000),
          },
          calculatedAt: new Date(),
          calculationTimeRange: { startDate: "", endDate: "" },
          fromCache: false,
          expiresAt: new Date(),
        },
        {
          marketId: "market-2",
          question: "Market 2",
          category: "politics",
          maturity: MarketMaturity.YOUNG,
          marketAgeDays: 20,
          isActive: true,
          currentVolume: 500000,
          currentLiquidity: 25000,
          windowStats: {
            [BaselineWindow.HOURLY]: createMockWindowStats(500),
            [BaselineWindow.FOUR_HOUR]: createMockWindowStats(2000),
            [BaselineWindow.DAILY]: createMockWindowStats(10000, 0.5),
            [BaselineWindow.WEEKLY]: createMockWindowStats(70000),
            [BaselineWindow.MONTHLY]: createMockWindowStats(300000),
          },
          calculatedAt: new Date(),
          calculationTimeRange: { startDate: "", endDate: "" },
          fromCache: false,
          expiresAt: new Date(),
        },
      ];

      const calculator = new VolumeBaselineCalculator();
      const summary = calculator.getSummary(baselines);

      expect(summary.totalMarkets).toBe(2);
      expect(summary.byMaturity[MarketMaturity.ESTABLISHED]).toBe(1);
      expect(summary.byMaturity[MarketMaturity.YOUNG]).toBe(1);
      expect(summary.averageDailyVolume).toBe(15000); // (20000 + 10000) / 2
      expect(summary.totalMarketVolume).toBe(1500000);
      expect(summary.topMarketsByVolume).toHaveLength(2);
      expect(summary.topMarketsByVolume[0]!.marketId).toBe("market-1");
      expect(summary.mostVolatileMarkets).toHaveLength(2);
      expect(summary.mostVolatileMarkets[0]!.marketId).toBe("market-2"); // Higher CV
    });
  });

  describe("isVolumeAnomalous", () => {
    it("should not detect anomaly for normal volume", () => {
      const baseline = createMockBaseline(10000, 2000);
      const calculator = new VolumeBaselineCalculator();

      const result = calculator.isVolumeAnomalous(baseline, 10000);

      expect(result.isAnomalous).toBe(false);
      expect(result.isHigh).toBe(false);
      expect(result.isLow).toBe(false);
      expect(result.zScore).toBeCloseTo(0, 1);
    });

    it("should detect high volume anomaly", () => {
      const baseline = createMockBaseline(10000, 2000);
      const calculator = new VolumeBaselineCalculator();

      // Volume is 3 standard deviations above mean
      const result = calculator.isVolumeAnomalous(baseline, 16000);

      expect(result.isAnomalous).toBe(true);
      expect(result.isHigh).toBe(true);
      expect(result.isLow).toBe(false);
      expect(result.zScore).toBe(3);
    });

    it("should detect low volume anomaly", () => {
      const baseline = createMockBaseline(10000, 2000);
      const calculator = new VolumeBaselineCalculator();

      // Volume is 3 standard deviations below mean
      const result = calculator.isVolumeAnomalous(baseline, 4000);

      expect(result.isAnomalous).toBe(true);
      expect(result.isHigh).toBe(false);
      expect(result.isLow).toBe(true);
      expect(result.zScore).toBe(-3);
    });

    it("should respect custom stdDev multiplier", () => {
      const baseline = createMockBaseline(10000, 2000);
      const calculator = new VolumeBaselineCalculator();

      // With multiplier of 3, 14000 should not be anomalous
      const result1 = calculator.isVolumeAnomalous(baseline, 14000, BaselineWindow.DAILY, 3);
      expect(result1.isAnomalous).toBe(false);

      // With multiplier of 1, 14000 should be anomalous
      const result2 = calculator.isVolumeAnomalous(baseline, 14000, BaselineWindow.DAILY, 1);
      expect(result2.isAnomalous).toBe(true);
    });

    it("should calculate thresholds correctly", () => {
      const baseline = createMockBaseline(10000, 2000);
      const calculator = new VolumeBaselineCalculator();

      const result = calculator.isVolumeAnomalous(baseline, 10000, BaselineWindow.DAILY, 2);

      expect(result.thresholds.low).toBe(6000); // 10000 - 2*2000
      expect(result.thresholds.high).toBe(14000); // 10000 + 2*2000
    });

    it("should handle zero average volume gracefully", () => {
      const baseline = createMockBaseline(0, 0);
      const calculator = new VolumeBaselineCalculator();

      const result = calculator.isVolumeAnomalous(baseline, 1000);

      expect(result.isAnomalous).toBe(false);
      expect(result.zScore).toBe(0);
    });
  });

  describe("getRecommendedWindow", () => {
    it("should recommend hourly for very new markets", () => {
      const calculator = new VolumeBaselineCalculator();
      expect(calculator.getRecommendedWindow(MarketMaturity.VERY_NEW)).toBe(BaselineWindow.HOURLY);
    });

    it("should recommend 4-hour for new markets", () => {
      const calculator = new VolumeBaselineCalculator();
      expect(calculator.getRecommendedWindow(MarketMaturity.NEW)).toBe(BaselineWindow.FOUR_HOUR);
    });

    it("should recommend daily for young markets", () => {
      const calculator = new VolumeBaselineCalculator();
      expect(calculator.getRecommendedWindow(MarketMaturity.YOUNG)).toBe(BaselineWindow.DAILY);
    });

    it("should recommend weekly for established/mature markets", () => {
      const calculator = new VolumeBaselineCalculator();
      expect(calculator.getRecommendedWindow(MarketMaturity.ESTABLISHED)).toBe(BaselineWindow.WEEKLY);
      expect(calculator.getRecommendedWindow(MarketMaturity.MATURE)).toBe(BaselineWindow.WEEKLY);
    });
  });

  describe("cache management", () => {
    it("should clear cache", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();

      // Populate cache
      await calculator.calculateBaseline("market-123");
      expect(calculator.getCacheStats().size).toBe(1);

      // Clear cache
      calculator.clearCache();
      expect(calculator.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const calculator = new VolumeBaselineCalculator();

      await calculator.calculateBaseline("market-123");
      expect(calculator.getCacheStats().size).toBe(1);

      calculator.invalidateCacheEntry("market-123");

      // Next call should not be from cache
      const result = await calculator.calculateBaseline("market-123");
      expect(result!.fromCache).toBe(false);
    });
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe("Singleton Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedVolumeBaselineCalculator();
  });

  afterEach(() => {
    resetSharedVolumeBaselineCalculator();
  });

  describe("createVolumeBaselineCalculator", () => {
    it("should create new instance", () => {
      const calculator = createVolumeBaselineCalculator();
      expect(calculator).toBeInstanceOf(VolumeBaselineCalculator);
    });

    it("should create independent instances", () => {
      const calc1 = createVolumeBaselineCalculator();
      const calc2 = createVolumeBaselineCalculator();
      expect(calc1).not.toBe(calc2);
    });
  });

  describe("getSharedVolumeBaselineCalculator", () => {
    it("should return singleton instance", () => {
      const calc1 = getSharedVolumeBaselineCalculator();
      const calc2 = getSharedVolumeBaselineCalculator();
      expect(calc1).toBe(calc2);
    });

    it("should create instance if none exists", () => {
      const calculator = getSharedVolumeBaselineCalculator();
      expect(calculator).toBeInstanceOf(VolumeBaselineCalculator);
    });
  });

  describe("setSharedVolumeBaselineCalculator", () => {
    it("should set custom shared instance", () => {
      const customCalculator = createVolumeBaselineCalculator({
        defaultLookbackDays: 90,
      });
      setSharedVolumeBaselineCalculator(customCalculator);

      const retrieved = getSharedVolumeBaselineCalculator();
      expect(retrieved).toBe(customCalculator);
    });
  });

  describe("resetSharedVolumeBaselineCalculator", () => {
    it("should reset shared instance", () => {
      const calc1 = getSharedVolumeBaselineCalculator();
      resetSharedVolumeBaselineCalculator();
      const calc2 = getSharedVolumeBaselineCalculator();
      expect(calc1).not.toBe(calc2);
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedVolumeBaselineCalculator();
  });

  afterEach(() => {
    resetSharedVolumeBaselineCalculator();
  });

  describe("calculateMarketVolumeBaseline", () => {
    it("should use shared calculator by default", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const result = await calculateMarketVolumeBaseline("market-123");

      expect(result).not.toBeNull();
      expect(result!.marketId).toBe("market-123");
    });

    it("should use provided calculator", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const customCalculator = createVolumeBaselineCalculator();
      const result = await calculateMarketVolumeBaseline("market-123", {
        calculator: customCalculator,
      });

      expect(result).not.toBeNull();
    });
  });

  describe("batchCalculateMarketVolumeBaselines", () => {
    it("should batch calculate for multiple markets", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const result = await batchCalculateMarketVolumeBaselines(["market-1", "market-2"]);

      expect(result.totalProcessed).toBe(2);
    });
  });

  describe("checkVolumeAnomaly", () => {
    it("should check volume anomaly for market", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory({ avgVolume: 10000 });

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const result = await checkVolumeAnomaly("market-123", 50000);

      expect(result.baseline).not.toBeNull();
      expect(result.analysis).not.toBeNull();
      expect(result.analysis!.isAnomalous).toBeDefined();
    });

    it("should return null analysis if market not found", async () => {
      mockGetMarketById.mockResolvedValue(null);

      const result = await checkVolumeAnomaly("non-existent", 50000);

      expect(result.baseline).toBeNull();
      expect(result.analysis).toBeNull();
    });
  });

  describe("getMarketBaselineSummary", () => {
    it("should get summary for multiple markets", async () => {
      const mockMarket = createMockMarket();
      const mockVolumeHistory = createMockVolumeHistory();

      mockGetMarketById.mockResolvedValue(mockMarket);
      mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

      const summary = await getMarketBaselineSummary(["market-1", "market-2"]);

      expect(summary.totalMarkets).toBe(2);
    });
  });
});

// ============================================================================
// Window Statistics Tests
// ============================================================================

describe("WindowVolumeStats Calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedVolumeBaselineCalculator();
  });

  it("should calculate percentiles correctly", async () => {
    const mockMarket = createMockMarket();
    const mockVolumeHistory = createMockVolumeHistory({ dataPointCount: 100, avgVolume: 10000 });

    mockGetMarketById.mockResolvedValue(mockMarket);
    mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

    const calculator = new VolumeBaselineCalculator();
    const result = await calculator.calculateBaseline("market-123");

    const dailyStats = result!.windowStats[BaselineWindow.DAILY];
    expect(dailyStats.percentile25).toBeLessThanOrEqual(dailyStats.medianVolume);
    expect(dailyStats.medianVolume).toBeLessThanOrEqual(dailyStats.percentile75);
    expect(dailyStats.percentile75).toBeLessThanOrEqual(dailyStats.percentile95);
  });

  it("should calculate coefficient of variation", async () => {
    const mockMarket = createMockMarket();
    const mockVolumeHistory = createMockVolumeHistory({ avgVolume: 10000, volatility: 0.3 });

    mockGetMarketById.mockResolvedValue(mockMarket);
    mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

    const calculator = new VolumeBaselineCalculator();
    const result = await calculator.calculateBaseline("market-123");

    const dailyStats = result!.windowStats[BaselineWindow.DAILY];
    expect(dailyStats.coefficientOfVariation).toBeGreaterThan(0);
    expect(dailyStats.coefficientOfVariation).toBe(
      dailyStats.standardDeviation / dailyStats.averageVolume
    );
  });

  it("should handle empty volume history", async () => {
    const mockMarket = createMockMarket();
    const mockVolumeHistory = {
      marketId: "market-123",
      question: "Test",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      interval: "1d" as const,
      dataPoints: [],
      totalVolume: 0,
      fetchedAt: new Date().toISOString(),
    };

    mockGetMarketById.mockResolvedValue(mockMarket);
    mockGetMarketVolumeHistory.mockResolvedValue(mockVolumeHistory);

    const calculator = new VolumeBaselineCalculator();
    const result = await calculator.calculateBaseline("market-123");

    const dailyStats = result!.windowStats[BaselineWindow.DAILY];
    expect(dailyStats.dataPointCount).toBe(0);
    expect(dailyStats.averageVolume).toBe(0);
    expect(dailyStats.totalVolume).toBe(0);
  });
});

// ============================================================================
// Helper Functions for Tests
// ============================================================================

function createMockWindowStats(avgVolume: number, cv: number = 0.2): WindowVolumeStats {
  const stdDev = avgVolume * cv;
  return {
    window: BaselineWindow.DAILY,
    averageVolume: avgVolume,
    medianVolume: avgVolume * 0.98,
    standardDeviation: stdDev,
    minVolume: avgVolume * 0.5,
    maxVolume: avgVolume * 1.5,
    totalVolume: avgVolume * 30,
    dataPointCount: 30,
    percentile25: avgVolume * 0.8,
    percentile75: avgVolume * 1.2,
    percentile95: avgVolume * 1.4,
    averageTradeCount: avgVolume / 100,
    coefficientOfVariation: cv,
  };
}

function createMockBaseline(avgVolume: number, stdDev: number): MarketVolumeBaseline {
  return {
    marketId: "market-123",
    question: "Test Market",
    category: "crypto",
    maturity: MarketMaturity.ESTABLISHED,
    marketAgeDays: 60,
    isActive: true,
    currentVolume: avgVolume * 30,
    currentLiquidity: avgVolume,
    windowStats: {
      [BaselineWindow.HOURLY]: {
        ...createMockWindowStats(avgVolume / 24),
        window: BaselineWindow.HOURLY,
      },
      [BaselineWindow.FOUR_HOUR]: {
        ...createMockWindowStats(avgVolume / 6),
        window: BaselineWindow.FOUR_HOUR,
      },
      [BaselineWindow.DAILY]: {
        window: BaselineWindow.DAILY,
        averageVolume: avgVolume,
        medianVolume: avgVolume,
        standardDeviation: stdDev,
        minVolume: avgVolume * 0.5,
        maxVolume: avgVolume * 1.5,
        totalVolume: avgVolume * 30,
        dataPointCount: 30,
        percentile25: avgVolume * 0.8,
        percentile75: avgVolume * 1.2,
        percentile95: avgVolume * 1.4,
        averageTradeCount: avgVolume / 100,
        coefficientOfVariation: stdDev / avgVolume,
      },
      [BaselineWindow.WEEKLY]: {
        ...createMockWindowStats(avgVolume * 7),
        window: BaselineWindow.WEEKLY,
      },
      [BaselineWindow.MONTHLY]: {
        ...createMockWindowStats(avgVolume * 30),
        window: BaselineWindow.MONTHLY,
      },
    },
    calculatedAt: new Date(),
    calculationTimeRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    },
    fromCache: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };
}
