/**
 * Tests for Whale Trade Threshold Calculator (DET-VOL-005)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LiquidityLevel,
  ThresholdStrategy,
  WhaleThresholdTier,
  DEFAULT_LIQUIDITY_PERCENTAGES,
  DEFAULT_VOLUME_PERCENTAGES,
  DEFAULT_IMPACT_THRESHOLDS,
  DEFAULT_FIXED_THRESHOLDS,
  DEFAULT_MINIMUM_THRESHOLDS,
  DEFAULT_MAXIMUM_THRESHOLDS,
  DEFAULT_COMBINED_WEIGHTS,
  DEFAULT_LIQUIDITY_CLASSIFICATION,
  DEFAULT_THRESHOLD_CONFIG,
  WhaleThresholdCalculator,
  createWhaleThresholdCalculator,
  getSharedWhaleThresholdCalculator,
  setSharedWhaleThresholdCalculator,
  resetSharedWhaleThresholdCalculator,
  calculateWhaleThresholds,
  batchCalculateWhaleThresholds,
  isWhaleTradeSize,
  getTierForTradeSize,
  getCachedWhaleThresholds,
  getWhaleThresholdSummary,
  type LiquidityData,
  type VolumeData,
  type WhaleThresholdCalculatorConfig,
} from "../../src/detection/whale-threshold";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create sample liquidity data
 */
function createLiquidityData(overrides: Partial<LiquidityData> = {}): LiquidityData {
  return {
    totalBidVolumeUsd: 50000,
    totalAskVolumeUsd: 50000,
    totalLiquidityUsd: 100000,
    bestBid: 0.55,
    bestAsk: 0.56,
    spreadUsd: 0.01,
    spreadPercent: 1.8,
    bidLevelCount: 20,
    askLevelCount: 20,
    bidVolumeAt1Percent: 5000,
    askVolumeAt1Percent: 5000,
    bidVolumeAt5Percent: 25000,
    askVolumeAt5Percent: 25000,
    snapshotTime: new Date(),
    ...overrides,
  };
}

/**
 * Create sample volume data
 */
function createVolumeData(overrides: Partial<VolumeData> = {}): VolumeData {
  return {
    volume24hUsd: 500000,
    avgDailyVolume7dUsd: 450000,
    avgDailyVolume30dUsd: 400000,
    avgTradeSizeUsd: 1000,
    medianTradeSizeUsd: 500,
    p99TradeSizeUsd: 25000,
    tradeCount: 500,
    dataTime: new Date(),
    ...overrides,
  };
}

/**
 * Create low liquidity data
 */
function createLowLiquidityData(): LiquidityData {
  return createLiquidityData({
    totalBidVolumeUsd: 3000,
    totalAskVolumeUsd: 2000,
    totalLiquidityUsd: 5000,
    bidLevelCount: 5,
    askLevelCount: 5,
    bidVolumeAt1Percent: 500,
    askVolumeAt1Percent: 500,
    bidVolumeAt5Percent: 2500,
    askVolumeAt5Percent: 2000,
  });
}

/**
 * Create high liquidity data
 */
function createHighLiquidityData(): LiquidityData {
  return createLiquidityData({
    totalBidVolumeUsd: 5000000,
    totalAskVolumeUsd: 5000000,
    totalLiquidityUsd: 10000000,
    bidLevelCount: 100,
    askLevelCount: 100,
    bidVolumeAt1Percent: 500000,
    askVolumeAt1Percent: 500000,
    bidVolumeAt5Percent: 2500000,
    askVolumeAt5Percent: 2500000,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("WhaleThresholdCalculator", () => {
  let calculator: WhaleThresholdCalculator;

  beforeEach(() => {
    calculator = createWhaleThresholdCalculator();
    resetSharedWhaleThresholdCalculator();
  });

  afterEach(() => {
    resetSharedWhaleThresholdCalculator();
  });

  describe("constants", () => {
    it("should export default liquidity percentages", () => {
      expect(DEFAULT_LIQUIDITY_PERCENTAGES).toBeDefined();
      expect(DEFAULT_LIQUIDITY_PERCENTAGES.notable).toBe(0.5);
      expect(DEFAULT_LIQUIDITY_PERCENTAGES.large).toBe(1);
      expect(DEFAULT_LIQUIDITY_PERCENTAGES.whale).toBe(5);
    });

    it("should export default volume percentages", () => {
      expect(DEFAULT_VOLUME_PERCENTAGES).toBeDefined();
      expect(DEFAULT_VOLUME_PERCENTAGES.notable).toBe(0.1);
      expect(DEFAULT_VOLUME_PERCENTAGES.large).toBe(0.5);
      expect(DEFAULT_VOLUME_PERCENTAGES.whale).toBe(2);
    });

    it("should export default impact thresholds", () => {
      expect(DEFAULT_IMPACT_THRESHOLDS).toBeDefined();
      expect(DEFAULT_IMPACT_THRESHOLDS.notable).toBe(0.1);
      expect(DEFAULT_IMPACT_THRESHOLDS.whale).toBe(2);
    });

    it("should export default fixed thresholds", () => {
      expect(DEFAULT_FIXED_THRESHOLDS).toBeDefined();
      expect(DEFAULT_FIXED_THRESHOLDS.notable).toBe(1000);
      expect(DEFAULT_FIXED_THRESHOLDS.whale).toBe(100000);
    });

    it("should export default minimum thresholds", () => {
      expect(DEFAULT_MINIMUM_THRESHOLDS).toBeDefined();
      expect(DEFAULT_MINIMUM_THRESHOLDS.notable).toBe(100);
      expect(DEFAULT_MINIMUM_THRESHOLDS.whale).toBe(10000);
    });

    it("should export default maximum thresholds", () => {
      expect(DEFAULT_MAXIMUM_THRESHOLDS).toBeDefined();
      expect(DEFAULT_MAXIMUM_THRESHOLDS.notable).toBe(10000);
      expect(DEFAULT_MAXIMUM_THRESHOLDS.whale).toBe(2000000);
    });

    it("should export default combined weights", () => {
      expect(DEFAULT_COMBINED_WEIGHTS).toBeDefined();
      expect(DEFAULT_COMBINED_WEIGHTS.liquidity).toBe(0.4);
      expect(DEFAULT_COMBINED_WEIGHTS.volume).toBe(0.4);
      expect(DEFAULT_COMBINED_WEIGHTS.impact).toBe(0.2);
    });

    it("should export default liquidity classification thresholds", () => {
      expect(DEFAULT_LIQUIDITY_CLASSIFICATION).toBeDefined();
      expect(DEFAULT_LIQUIDITY_CLASSIFICATION.veryLow).toBe(10000);
      expect(DEFAULT_LIQUIDITY_CLASSIFICATION.high).toBe(1000000);
    });

    it("should export complete default threshold config", () => {
      expect(DEFAULT_THRESHOLD_CONFIG).toBeDefined();
      expect(DEFAULT_THRESHOLD_CONFIG.strategy).toBe(ThresholdStrategy.COMBINED);
      expect(DEFAULT_THRESHOLD_CONFIG.cacheTtlMs).toBe(5 * 60 * 1000);
    });
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const calc = createWhaleThresholdCalculator();
      expect(calc).toBeInstanceOf(WhaleThresholdCalculator);
    });

    it("should create instance with custom config", () => {
      const config: WhaleThresholdCalculatorConfig = {
        enableEvents: false,
        maxCacheSize: 500,
        maxChangeEvents: 50,
        significantChangePercent: 20,
      };
      const calc = createWhaleThresholdCalculator(config);
      expect(calc).toBeInstanceOf(WhaleThresholdCalculator);
    });

    it("should create instance with custom threshold config", () => {
      const config: WhaleThresholdCalculatorConfig = {
        thresholdConfig: {
          strategy: ThresholdStrategy.FIXED,
          cacheTtlMs: 60000,
        },
      };
      const calc = createWhaleThresholdCalculator(config);
      expect(calc.getConfig().strategy).toBe(ThresholdStrategy.FIXED);
      expect(calc.getConfig().cacheTtlMs).toBe(60000);
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", () => {
      const config = calculator.getConfig();
      expect(config).toBeDefined();
      expect(config.strategy).toBe(ThresholdStrategy.COMBINED);
    });

    it("should return a copy of the config", () => {
      const config1 = calculator.getConfig();
      const config2 = calculator.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe("updateConfig", () => {
    it("should update strategy", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      expect(calculator.getConfig().strategy).toBe(ThresholdStrategy.FIXED);
    });

    it("should update cache TTL", () => {
      calculator.updateConfig({ cacheTtlMs: 60000 });
      expect(calculator.getConfig().cacheTtlMs).toBe(60000);
    });

    it("should clear cache on config update", () => {
      const liquidity = createLiquidityData();
      calculator.calculateThresholds("market1", { liquidityData: liquidity });
      expect(calculator.getCachedThresholds("market1")).not.toBeNull();

      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      expect(calculator.getCachedThresholds("market1")).toBeNull();
    });
  });

  describe("calculateThresholds", () => {
    describe("with FIXED strategy", () => {
      beforeEach(() => {
        calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      });

      it("should return fixed thresholds", () => {
        const result = calculator.calculateThresholds("market1");
        expect(result.notableThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.notable);
        expect(result.largeThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.large);
        expect(result.veryLargeThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.veryLarge);
        expect(result.whaleThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.whale);
        expect(result.megaWhaleThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.megaWhale);
      });

      it("should return high confidence for fixed strategy", () => {
        const result = calculator.calculateThresholds("market1");
        expect(result.confidence).toBe(1.0);
      });

      it("should set correct strategy in result", () => {
        const result = calculator.calculateThresholds("market1");
        expect(result.strategy).toBe(ThresholdStrategy.FIXED);
      });
    });

    describe("with LIQUIDITY_PERCENTAGE strategy", () => {
      beforeEach(() => {
        calculator.updateConfig({ strategy: ThresholdStrategy.LIQUIDITY_PERCENTAGE });
      });

      it("should calculate thresholds based on liquidity", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 1000000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        // Notable = 0.5% of 1M = 5000
        expect(result.notableThresholdUsd).toBe(5000);
        // Large = 1% of 1M = 10000
        expect(result.largeThresholdUsd).toBe(10000);
      });

      it("should use default thresholds when no liquidity data", () => {
        const result = calculator.calculateThresholds("market1");
        expect(result.notableThresholdUsd).toBe(DEFAULT_FIXED_THRESHOLDS.notable);
      });

      it("should apply minimum thresholds", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 1000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        // Should not be lower than minimums
        expect(result.notableThresholdUsd).toBeGreaterThanOrEqual(DEFAULT_MINIMUM_THRESHOLDS.notable);
        expect(result.whaleThresholdUsd).toBeGreaterThanOrEqual(DEFAULT_MINIMUM_THRESHOLDS.whale);
      });

      it("should apply maximum thresholds", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 1000000000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        expect(result.notableThresholdUsd).toBeLessThanOrEqual(DEFAULT_MAXIMUM_THRESHOLDS.notable);
        expect(result.whaleThresholdUsd).toBeLessThanOrEqual(DEFAULT_MAXIMUM_THRESHOLDS.whale);
      });
    });

    describe("with VOLUME_PERCENTAGE strategy", () => {
      beforeEach(() => {
        calculator.updateConfig({ strategy: ThresholdStrategy.VOLUME_PERCENTAGE });
      });

      it("should calculate thresholds based on volume", () => {
        const volume = createVolumeData({ avgDailyVolume7dUsd: 1000000 });
        const result = calculator.calculateThresholds("market1", { volumeData: volume });

        // Notable = 0.1% of 1M = 1000
        expect(result.notableThresholdUsd).toBe(1000);
        // Large = 0.5% of 1M = 5000
        expect(result.largeThresholdUsd).toBe(5000);
      });

      it("should fallback to 24h volume when 7d not available", () => {
        const volume = createVolumeData({
          avgDailyVolume7dUsd: 0,
          volume24hUsd: 500000,
        });
        const result = calculator.calculateThresholds("market1", { volumeData: volume });

        // Notable = 0.1% of 500k = 500
        expect(result.notableThresholdUsd).toBe(500);
      });
    });

    describe("with MARKET_IMPACT strategy", () => {
      beforeEach(() => {
        calculator.updateConfig({ strategy: ThresholdStrategy.MARKET_IMPACT });
      });

      it("should calculate thresholds based on market impact", () => {
        const liquidity = createLiquidityData({
          bidVolumeAt1Percent: 10000,
          askVolumeAt1Percent: 10000,
          bidVolumeAt5Percent: 50000,
          askVolumeAt5Percent: 50000,
        });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        // Thresholds should be based on price impact estimates
        expect(result.notableThresholdUsd).toBeGreaterThan(0);
        expect(result.whaleThresholdUsd).toBeGreaterThan(result.notableThresholdUsd);
      });

      it("should fallback when no depth data available", () => {
        const liquidity = createLiquidityData({
          bidVolumeAt1Percent: 0,
          askVolumeAt1Percent: 0,
          bidVolumeAt5Percent: 0,
          askVolumeAt5Percent: 0,
          totalLiquidityUsd: 100000,
        });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        // Should use fallback based on total liquidity
        expect(result.notableThresholdUsd).toBeGreaterThan(0);
      });
    });

    describe("with COMBINED strategy", () => {
      it("should combine multiple strategies", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 500000 });
        const volume = createVolumeData({ avgDailyVolume7dUsd: 1000000 });

        const result = calculator.calculateThresholds("market1", {
          liquidityData: liquidity,
          volumeData: volume,
        });

        expect(result.strategy).toBe(ThresholdStrategy.COMBINED);
        expect(result.notableThresholdUsd).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it("should work with only liquidity data", () => {
        const liquidity = createLiquidityData();
        const result = calculator.calculateThresholds("market1", {
          liquidityData: liquidity,
        });

        expect(result.notableThresholdUsd).toBeGreaterThan(0);
      });

      it("should work with only volume data", () => {
        const volume = createVolumeData();
        const result = calculator.calculateThresholds("market1", {
          volumeData: volume,
        });

        expect(result.notableThresholdUsd).toBeGreaterThan(0);
      });
    });

    describe("threshold ordering", () => {
      it("should ensure thresholds are in ascending order", () => {
        const liquidity = createLiquidityData();
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

        expect(result.notableThresholdUsd).toBeLessThan(result.largeThresholdUsd);
        expect(result.largeThresholdUsd).toBeLessThan(result.veryLargeThresholdUsd);
        expect(result.veryLargeThresholdUsd).toBeLessThan(result.whaleThresholdUsd);
        expect(result.whaleThresholdUsd).toBeLessThan(result.megaWhaleThresholdUsd);
      });
    });

    describe("liquidity level classification", () => {
      it("should classify VERY_LOW liquidity", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 5000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.liquidityLevel).toBe(LiquidityLevel.VERY_LOW);
      });

      it("should classify LOW liquidity", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 25000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.liquidityLevel).toBe(LiquidityLevel.LOW);
      });

      it("should classify MEDIUM liquidity", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 100000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.liquidityLevel).toBe(LiquidityLevel.MEDIUM);
      });

      it("should classify HIGH liquidity", () => {
        const liquidity = createLiquidityData({ totalLiquidityUsd: 500000 });
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.liquidityLevel).toBe(LiquidityLevel.HIGH);
      });

      it("should classify VERY_HIGH liquidity", () => {
        const liquidity = createHighLiquidityData();
        const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.liquidityLevel).toBe(LiquidityLevel.VERY_HIGH);
      });
    });

    describe("low liquidity scaling", () => {
      it("should scale down thresholds for low liquidity markets", () => {
        const lowLiquidity = createLowLiquidityData();
        const normalLiquidity = createLiquidityData();

        const lowResult = calculator.calculateThresholds("low-market", {
          liquidityData: lowLiquidity,
        });
        const normalResult = calculator.calculateThresholds("normal-market", {
          liquidityData: normalLiquidity,
        });

        // Low liquidity market should have lower thresholds (relative to liquidity)
        expect(lowResult.liquidityLevel).toBe(LiquidityLevel.VERY_LOW);
        expect(normalResult.liquidityLevel).toBe(LiquidityLevel.MEDIUM);
      });
    });

    describe("caching", () => {
      it("should cache calculated thresholds", () => {
        const liquidity = createLiquidityData();
        const result1 = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result1.fromCache).toBe(false);

        const result2 = calculator.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result2.fromCache).toBe(true);
      });

      it("should bypass cache when requested", () => {
        const liquidity = createLiquidityData();
        calculator.calculateThresholds("market1", { liquidityData: liquidity });

        const result = calculator.calculateThresholds("market1", {
          liquidityData: liquidity,
          bypassCache: true,
        });
        expect(result.fromCache).toBe(false);
      });

      it("should expire cached thresholds", async () => {
        const config: WhaleThresholdCalculatorConfig = {
          thresholdConfig: {
            cacheTtlMs: 50, // Very short TTL for testing
          },
        };
        const shortCacheCalc = createWhaleThresholdCalculator(config);

        const liquidity = createLiquidityData();
        shortCacheCalc.calculateThresholds("market1", { liquidityData: liquidity });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const result = shortCacheCalc.calculateThresholds("market1", { liquidityData: liquidity });
        expect(result.fromCache).toBe(false);
      });
    });

    describe("metadata", () => {
      it("should include market ID in result", () => {
        const result = calculator.calculateThresholds("test-market-123");
        expect(result.marketId).toBe("test-market-123");
      });

      it("should include calculated timestamp", () => {
        const before = new Date();
        const result = calculator.calculateThresholds("market1");
        const after = new Date();

        expect(result.calculatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(result.calculatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      it("should include expiration timestamp", () => {
        const result = calculator.calculateThresholds("market1");
        const expectedExpiry = result.calculatedAt.getTime() + calculator.getConfig().cacheTtlMs;
        expect(result.expiresAt.getTime()).toBe(expectedExpiry);
      });

      it("should include input data in result", () => {
        const liquidity = createLiquidityData();
        const volume = createVolumeData();

        const result = calculator.calculateThresholds("market1", {
          liquidityData: liquidity,
          volumeData: volume,
        });

        expect(result.inputData.liquidity).toBe(liquidity);
        expect(result.inputData.volume).toBe(volume);
      });
    });
  });

  describe("batchCalculateThresholds", () => {
    it("should calculate thresholds for multiple markets", () => {
      const markets = [
        { marketId: "market1", liquidity: createLiquidityData() },
        { marketId: "market2", liquidity: createHighLiquidityData() },
        { marketId: "market3", volume: createVolumeData() },
      ];

      const result = calculator.batchCalculateThresholds(markets);

      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(3);
      expect(result.results.get("market1")).toBeDefined();
      expect(result.results.get("market2")).toBeDefined();
      expect(result.results.get("market3")).toBeDefined();
    });

    it("should include processing time", () => {
      const markets = [
        { marketId: "market1", liquidity: createLiquidityData() },
      ];

      const result = calculator.batchCalculateThresholds(markets);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getCachedThresholds", () => {
    it("should return cached thresholds", () => {
      const liquidity = createLiquidityData();
      calculator.calculateThresholds("market1", { liquidityData: liquidity });

      const cached = calculator.getCachedThresholds("market1");
      expect(cached).not.toBeNull();
      expect(cached?.marketId).toBe("market1");
      expect(cached?.fromCache).toBe(true);
    });

    it("should return null for unknown market", () => {
      const cached = calculator.getCachedThresholds("unknown-market");
      expect(cached).toBeNull();
    });
  });

  describe("isWhaleTradeSize", () => {
    it("should return true for whale-sized trades", () => {
      const liquidity = createLiquidityData({ totalLiquidityUsd: 1000000 });
      calculator.calculateThresholds("market1", { liquidityData: liquidity });

      // Whale threshold is 5% of 1M = 50000, but constrained by min/max
      const thresholds = calculator.getCachedThresholds("market1")!;
      expect(calculator.isWhaleTradeSize("market1", thresholds.whaleThresholdUsd)).toBe(true);
      expect(calculator.isWhaleTradeSize("market1", thresholds.whaleThresholdUsd + 1)).toBe(true);
    });

    it("should return false for non-whale trades", () => {
      const liquidity = createLiquidityData({ totalLiquidityUsd: 1000000 });
      calculator.calculateThresholds("market1", { liquidityData: liquidity });

      expect(calculator.isWhaleTradeSize("market1", 100)).toBe(false);
      expect(calculator.isWhaleTradeSize("market1", 1000)).toBe(false);
    });

    it("should use default thresholds for unknown market", () => {
      // Default whale threshold is $100,000
      expect(calculator.isWhaleTradeSize("unknown", 100000)).toBe(true);
      expect(calculator.isWhaleTradeSize("unknown", 99999)).toBe(false);
    });
  });

  describe("getTierForTradeSize", () => {
    it("should return MEGA_WHALE for largest trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 500001);
      expect(tier).toBe(WhaleThresholdTier.MEGA_WHALE);
    });

    it("should return WHALE for whale-sized trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 100001);
      expect(tier).toBe(WhaleThresholdTier.WHALE);
    });

    it("should return VERY_LARGE for very large trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 50001);
      expect(tier).toBe(WhaleThresholdTier.VERY_LARGE);
    });

    it("should return LARGE for large trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 10001);
      expect(tier).toBe(WhaleThresholdTier.LARGE);
    });

    it("should return NOTABLE for notable trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 1001);
      expect(tier).toBe(WhaleThresholdTier.NOTABLE);
    });

    it("should return null for small trades", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("market1");

      const tier = calculator.getTierForTradeSize("market1", 500);
      expect(tier).toBeNull();
    });

    it("should use default thresholds for unknown market", () => {
      const tier = calculator.getTierForTradeSize("unknown", 500000);
      expect(tier).toBe(WhaleThresholdTier.MEGA_WHALE);
    });
  });

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      const summary = calculator.getSummary();

      expect(summary).toBeDefined();
      expect(summary.totalMarketsTracked).toBe(0);
      expect(summary.marketsByLiquidityLevel).toBeDefined();
      expect(summary.averageThresholds).toBeDefined();
      expect(summary.cacheStats).toBeDefined();
    });

    it("should track markets by liquidity level", () => {
      calculator.calculateThresholds("m1", { liquidityData: createLowLiquidityData() });
      calculator.calculateThresholds("m2", { liquidityData: createLiquidityData() });
      calculator.calculateThresholds("m3", { liquidityData: createHighLiquidityData() });

      const summary = calculator.getSummary();
      expect(summary.totalMarketsTracked).toBe(3);
      expect(summary.marketsByLiquidityLevel[LiquidityLevel.VERY_LOW]).toBe(1);
      expect(summary.marketsByLiquidityLevel[LiquidityLevel.MEDIUM]).toBe(1);
      expect(summary.marketsByLiquidityLevel[LiquidityLevel.VERY_HIGH]).toBe(1);
    });

    it("should calculate average thresholds", () => {
      calculator.updateConfig({ strategy: ThresholdStrategy.FIXED });
      calculator.calculateThresholds("m1");
      calculator.calculateThresholds("m2");

      const summary = calculator.getSummary();
      expect(summary.averageThresholds.whale).toBe(DEFAULT_FIXED_THRESHOLDS.whale);
    });

    it("should track cache statistics", () => {
      const liquidity = createLiquidityData();
      calculator.calculateThresholds("m1", { liquidityData: liquidity }); // miss
      calculator.calculateThresholds("m1", { liquidityData: liquidity }); // hit
      calculator.calculateThresholds("m1", { liquidityData: liquidity }); // hit

      const summary = calculator.getSummary();
      expect(summary.cacheStats.hits).toBe(2);
      expect(summary.cacheStats.misses).toBe(1);
      expect(summary.cacheStats.hitRate).toBeCloseTo(2 / 3);
    });
  });

  describe("clearCache", () => {
    it("should clear all cached thresholds", () => {
      calculator.calculateThresholds("m1", { liquidityData: createLiquidityData() });
      calculator.calculateThresholds("m2", { liquidityData: createLiquidityData() });

      expect(calculator.getCachedThresholds("m1")).not.toBeNull();
      expect(calculator.getCachedThresholds("m2")).not.toBeNull();

      calculator.clearCache();

      expect(calculator.getCachedThresholds("m1")).toBeNull();
      expect(calculator.getCachedThresholds("m2")).toBeNull();
    });

    it("should reset cache statistics", () => {
      const liquidity = createLiquidityData();
      calculator.calculateThresholds("m1", { liquidityData: liquidity });
      calculator.calculateThresholds("m1", { liquidityData: liquidity });

      calculator.clearCache();
      const summary = calculator.getSummary();

      expect(summary.cacheStats.hits).toBe(0);
      expect(summary.cacheStats.misses).toBe(0);
    });
  });

  describe("cleanupCache", () => {
    it("should remove expired entries", async () => {
      const config: WhaleThresholdCalculatorConfig = {
        thresholdConfig: {
          cacheTtlMs: 50,
        },
      };
      const shortCacheCalc = createWhaleThresholdCalculator(config);

      shortCacheCalc.calculateThresholds("m1", { liquidityData: createLiquidityData() });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const removed = shortCacheCalc.cleanupCache();
      expect(removed).toBe(1);
      expect(shortCacheCalc.getCachedThresholds("m1")).toBeNull();
    });

    it("should not remove valid entries", () => {
      calculator.calculateThresholds("m1", { liquidityData: createLiquidityData() });

      const removed = calculator.cleanupCache();
      expect(removed).toBe(0);
      expect(calculator.getCachedThresholds("m1")).not.toBeNull();
    });
  });

  describe("getAllCachedThresholds", () => {
    it("should return all cached thresholds", () => {
      calculator.calculateThresholds("m1", { liquidityData: createLiquidityData() });
      calculator.calculateThresholds("m2", { liquidityData: createHighLiquidityData() });

      const all = calculator.getAllCachedThresholds();
      expect(all.size).toBe(2);
      expect(all.has("m1")).toBe(true);
      expect(all.has("m2")).toBe(true);
    });

    it("should exclude expired entries", async () => {
      const config: WhaleThresholdCalculatorConfig = {
        thresholdConfig: {
          cacheTtlMs: 50,
        },
      };
      const shortCacheCalc = createWhaleThresholdCalculator(config);

      shortCacheCalc.calculateThresholds("m1", { liquidityData: createLiquidityData() });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const all = shortCacheCalc.getAllCachedThresholds();
      expect(all.size).toBe(0);
    });
  });

  describe("event emission", () => {
    it("should emit thresholdChanged event on significant change", () => {
      const events: unknown[] = [];
      calculator.on("thresholdChanged", (event) => events.push(event));

      // First calculation
      calculator.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 100000 }),
        bypassCache: true,
      });

      // Second calculation with very different liquidity (should trigger event)
      calculator.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 10000000 }),
        bypassCache: true,
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it("should not emit event when events disabled", () => {
      const config: WhaleThresholdCalculatorConfig = {
        enableEvents: false,
      };
      const noEventsCalc = createWhaleThresholdCalculator(config);

      const events: unknown[] = [];
      noEventsCalc.on("thresholdChanged", (event) => events.push(event));

      noEventsCalc.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 100000 }),
        bypassCache: true,
      });
      noEventsCalc.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 10000000 }),
        bypassCache: true,
      });

      expect(events.length).toBe(0);
    });

    it("should track recent changes", () => {
      calculator.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 100000 }),
        bypassCache: true,
      });
      calculator.calculateThresholds("market1", {
        liquidityData: createLiquidityData({ totalLiquidityUsd: 10000000 }),
        bypassCache: true,
      });

      const changes = calculator.getRecentChanges();
      expect(changes.length).toBeGreaterThan(0);
    });
  });
});

describe("Singleton Management", () => {
  beforeEach(() => {
    resetSharedWhaleThresholdCalculator();
  });

  afterEach(() => {
    resetSharedWhaleThresholdCalculator();
  });

  describe("getSharedWhaleThresholdCalculator", () => {
    it("should return same instance on multiple calls", () => {
      const calc1 = getSharedWhaleThresholdCalculator();
      const calc2 = getSharedWhaleThresholdCalculator();
      expect(calc1).toBe(calc2);
    });

    it("should create instance if not exists", () => {
      const calc = getSharedWhaleThresholdCalculator();
      expect(calc).toBeInstanceOf(WhaleThresholdCalculator);
    });
  });

  describe("setSharedWhaleThresholdCalculator", () => {
    it("should set custom instance", () => {
      const custom = createWhaleThresholdCalculator({ enableEvents: false });
      setSharedWhaleThresholdCalculator(custom);
      expect(getSharedWhaleThresholdCalculator()).toBe(custom);
    });
  });

  describe("resetSharedWhaleThresholdCalculator", () => {
    it("should reset shared instance", () => {
      const calc1 = getSharedWhaleThresholdCalculator();
      resetSharedWhaleThresholdCalculator();
      const calc2 = getSharedWhaleThresholdCalculator();
      expect(calc1).not.toBe(calc2);
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    resetSharedWhaleThresholdCalculator();
  });

  afterEach(() => {
    resetSharedWhaleThresholdCalculator();
  });

  describe("calculateWhaleThresholds", () => {
    it("should use shared calculator", () => {
      const result = calculateWhaleThresholds("market1", {
        liquidityData: createLiquidityData(),
      });
      expect(result).toBeDefined();
      expect(result.marketId).toBe("market1");
    });
  });

  describe("batchCalculateWhaleThresholds", () => {
    it("should use shared calculator", () => {
      const result = batchCalculateWhaleThresholds([
        { marketId: "m1", liquidity: createLiquidityData() },
        { marketId: "m2", liquidity: createLiquidityData() },
      ]);
      expect(result.successCount).toBe(2);
    });
  });

  describe("isWhaleTradeSize", () => {
    it("should use shared calculator", () => {
      calculateWhaleThresholds("market1", { liquidityData: createLiquidityData() });
      const result = isWhaleTradeSize("market1", 1000000);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getTierForTradeSize", () => {
    it("should use shared calculator", () => {
      calculateWhaleThresholds("market1", { liquidityData: createLiquidityData() });
      const tier = getTierForTradeSize("market1", 1000000);
      expect(tier).not.toBeNull();
    });
  });

  describe("getCachedWhaleThresholds", () => {
    it("should use shared calculator", () => {
      calculateWhaleThresholds("market1", { liquidityData: createLiquidityData() });
      const cached = getCachedWhaleThresholds("market1");
      expect(cached).not.toBeNull();
    });
  });

  describe("getWhaleThresholdSummary", () => {
    it("should use shared calculator", () => {
      const summary = getWhaleThresholdSummary();
      expect(summary).toBeDefined();
      expect(summary.totalMarketsTracked).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Edge Cases", () => {
  let calculator: WhaleThresholdCalculator;

  beforeEach(() => {
    calculator = createWhaleThresholdCalculator();
  });

  it("should handle zero liquidity", () => {
    const liquidity = createLiquidityData({ totalLiquidityUsd: 0 });
    const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

    // Should use minimum thresholds
    expect(result.notableThresholdUsd).toBeGreaterThanOrEqual(DEFAULT_MINIMUM_THRESHOLDS.notable);
  });

  it("should handle zero volume", () => {
    const volume = createVolumeData({
      volume24hUsd: 0,
      avgDailyVolume7dUsd: 0,
      avgDailyVolume30dUsd: 0,
    });
    calculator.updateConfig({ strategy: ThresholdStrategy.VOLUME_PERCENTAGE });
    const result = calculator.calculateThresholds("market1", { volumeData: volume });

    // Should fall back to defaults and apply minimums
    expect(result.notableThresholdUsd).toBeGreaterThanOrEqual(DEFAULT_MINIMUM_THRESHOLDS.notable);
  });

  it("should handle null values in liquidity data", () => {
    const liquidity = createLiquidityData({
      bestBid: null,
      bestAsk: null,
      spreadUsd: null,
      spreadPercent: null,
    });
    const result = calculator.calculateThresholds("market1", { liquidityData: liquidity });

    expect(result).toBeDefined();
    expect(result.notableThresholdUsd).toBeGreaterThan(0);
  });

  it("should handle empty market ID", () => {
    const result = calculator.calculateThresholds("");
    expect(result.marketId).toBe("");
  });

  it("should handle special characters in market ID", () => {
    const result = calculator.calculateThresholds("market/with/slashes?and=params");
    expect(result.marketId).toBe("market/with/slashes?and=params");
  });

  it("should enforce cache size limits", () => {
    const config: WhaleThresholdCalculatorConfig = {
      maxCacheSize: 3,
    };
    const smallCacheCalc = createWhaleThresholdCalculator(config);

    for (let i = 0; i < 5; i++) {
      smallCacheCalc.calculateThresholds(`market-${i}`, {
        liquidityData: createLiquidityData(),
      });
    }

    const summary = smallCacheCalc.getSummary();
    expect(summary.cacheStats.size).toBeLessThanOrEqual(3);
  });

  it("should enforce change events limit", () => {
    const config: WhaleThresholdCalculatorConfig = {
      maxChangeEvents: 3,
      significantChangePercent: 1, // Low threshold to trigger events
    };
    const limitedEventsCalc = createWhaleThresholdCalculator(config);

    // Generate multiple changes
    for (let i = 0; i < 5; i++) {
      limitedEventsCalc.calculateThresholds("market1", {
        liquidityData: createLiquidityData({
          totalLiquidityUsd: (i + 1) * 100000,
        }),
        bypassCache: true,
      });
    }

    const changes = limitedEventsCalc.getRecentChanges();
    expect(changes.length).toBeLessThanOrEqual(3);
  });
});

describe("LiquidityLevel enum", () => {
  it("should have correct values", () => {
    expect(LiquidityLevel.VERY_LOW).toBe("VERY_LOW");
    expect(LiquidityLevel.LOW).toBe("LOW");
    expect(LiquidityLevel.MEDIUM).toBe("MEDIUM");
    expect(LiquidityLevel.HIGH).toBe("HIGH");
    expect(LiquidityLevel.VERY_HIGH).toBe("VERY_HIGH");
  });
});

describe("ThresholdStrategy enum", () => {
  it("should have correct values", () => {
    expect(ThresholdStrategy.LIQUIDITY_PERCENTAGE).toBe("LIQUIDITY_PERCENTAGE");
    expect(ThresholdStrategy.VOLUME_PERCENTAGE).toBe("VOLUME_PERCENTAGE");
    expect(ThresholdStrategy.MARKET_IMPACT).toBe("MARKET_IMPACT");
    expect(ThresholdStrategy.COMBINED).toBe("COMBINED");
    expect(ThresholdStrategy.FIXED).toBe("FIXED");
  });
});

describe("WhaleThresholdTier enum", () => {
  it("should have correct values", () => {
    expect(WhaleThresholdTier.NOTABLE).toBe("NOTABLE");
    expect(WhaleThresholdTier.LARGE).toBe("LARGE");
    expect(WhaleThresholdTier.VERY_LARGE).toBe("VERY_LARGE");
    expect(WhaleThresholdTier.WHALE).toBe("WHALE");
    expect(WhaleThresholdTier.MEGA_WHALE).toBe("MEGA_WHALE");
  });
});
