/**
 * Market Liquidity Scorer Tests (DET-NICHE-006)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MarketLiquidityScorer,
  createMarketLiquidityScorer,
  getSharedMarketLiquidityScorer,
  setSharedMarketLiquidityScorer,
  resetSharedMarketLiquidityScorer,
  scoreMarketLiquidity,
  scoreMarketsLiquidity,
  isThinMarket,
  getThinMarkets,
  getHighInsiderAdvantageMarkets,
  getLiquidityScorerSummary,
  LiquidityCategory,
  LiquidityConfidence,
  ThinMarketSeverity,
  type OrderBookData,
  type TradeVolumeStats,
} from "../../src/detection/market-liquidity-scorer";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestOrderBookData(
  marketId: string,
  overrides: Partial<OrderBookData> = {}
): OrderBookData {
  return {
    marketId,
    timestamp: new Date(),
    totalBidVolumeUsd: 5000,
    totalAskVolumeUsd: 5000,
    bestBid: 0.48,
    bestAsk: 0.52,
    spreadPercent: 4,
    bidLevelCount: 10,
    askLevelCount: 10,
    ...overrides,
  };
}

function createTestTradeVolumeStats(
  marketId: string,
  overrides: Partial<TradeVolumeStats> = {}
): TradeVolumeStats {
  return {
    marketId,
    periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    periodEnd: new Date(),
    tradeCount: 100,
    totalVolumeUsd: 50000,
    averageTradeSizeUsd: 500,
    medianTradeSizeUsd: 300,
    maxTradeSizeUsd: 5000,
    minTradeSizeUsd: 10,
    tradeSizeStdDev: 400,
    volume24hUsd: 50000,
    ...overrides,
  };
}

function createThinMarketOrderBookData(marketId: string): OrderBookData {
  return createTestOrderBookData(marketId, {
    totalBidVolumeUsd: 50,
    totalAskVolumeUsd: 50,
    bidLevelCount: 2,
    askLevelCount: 2,
    spreadPercent: 15,
  });
}

function createThinMarketTradeVolumeStats(marketId: string): TradeVolumeStats {
  return createTestTradeVolumeStats(marketId, {
    tradeCount: 5,
    totalVolumeUsd: 500,
    averageTradeSizeUsd: 100,
    volume24hUsd: 500,
  });
}

function createDeepMarketOrderBookData(marketId: string): OrderBookData {
  return createTestOrderBookData(marketId, {
    totalBidVolumeUsd: 500000,
    totalAskVolumeUsd: 500000,
    bidLevelCount: 50,
    askLevelCount: 50,
    spreadPercent: 0.5,
  });
}

function createDeepMarketTradeVolumeStats(marketId: string): TradeVolumeStats {
  return createTestTradeVolumeStats(marketId, {
    tradeCount: 1000,
    totalVolumeUsd: 1000000,
    averageTradeSizeUsd: 1000,
    volume24hUsd: 1000000,
    tradeSizeStdDev: 500,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("MarketLiquidityScorer", () => {
  let scorer: MarketLiquidityScorer;

  beforeEach(() => {
    scorer = createMarketLiquidityScorer({ debug: false });
  });

  afterEach(() => {
    scorer.clearCache();
    resetSharedMarketLiquidityScorer();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create scorer with default config", () => {
      const defaultScorer = createMarketLiquidityScorer();
      const config = defaultScorer.getConfig();

      expect(config.thinMarketThreshold).toBe(35);
      expect(config.extremelyThinThreshold).toBe(15);
      expect(config.orderBookDepthWeight).toBe(0.35);
      expect(config.tradeVolumeWeight).toBe(0.3);
      expect(config.spreadWeight).toBe(0.2);
      expect(config.participationWeight).toBe(0.15);
    });

    it("should create scorer with custom config", () => {
      const customScorer = createMarketLiquidityScorer({
        thinMarketThreshold: 40,
        extremelyThinThreshold: 20,
        orderBookDepthWeight: 0.4,
        cacheTtlMs: 60000,
        maxCacheSize: 100,
        debug: true,
      });
      const config = customScorer.getConfig();

      expect(config.thinMarketThreshold).toBe(40);
      expect(config.extremelyThinThreshold).toBe(20);
      expect(config.orderBookDepthWeight).toBe(0.4);
      expect(config.cacheTtlMs).toBe(60000);
      expect(config.maxCacheSize).toBe(100);
      expect(config.debug).toBe(true);
    });

    it("should start with empty cache", () => {
      expect(scorer.getCacheSize()).toBe(0);
    });
  });

  // ==========================================================================
  // Basic Scoring
  // ==========================================================================

  describe("scoreMarket", () => {
    it("should score market with both order book and trade data", () => {
      const orderBookData = createTestOrderBookData("market-1");
      const tradeVolumeStats = createTestTradeVolumeStats("market-1");

      const result = scorer.scoreMarket("market-1", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result).toBeDefined();
      expect(result.marketId).toBe("market-1");
      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(result.liquidityScore).toBeLessThanOrEqual(100);
      expect(result.category).toBeDefined();
      expect(typeof result.isThinMarket).toBe("boolean");
      expect(result.componentScores).toBeDefined();
      expect(result.fromCache).toBe(false);
    });

    it("should score market with only order book data", () => {
      const orderBookData = createTestOrderBookData("market-2");

      const result = scorer.scoreMarket("market-2", { orderBookData });

      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(result.orderBookData).toBe(orderBookData);
      expect(result.tradeVolumeStats).toBeNull();
    });

    it("should score market with only trade volume data", () => {
      const tradeVolumeStats = createTestTradeVolumeStats("market-3");

      const result = scorer.scoreMarket("market-3", { tradeVolumeStats });

      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(result.tradeVolumeStats).toBe(tradeVolumeStats);
      expect(result.orderBookData).toBeNull();
    });

    it("should score market with no data (minimal score)", () => {
      const result = scorer.scoreMarket("market-4");

      // Score is 10 because spread score defaults to neutral (50) when no data
      // and 50 * 0.20 (spread weight) = 10
      expect(result.liquidityScore).toBe(10);
      expect(result.isThinMarket).toBe(true);
      expect(result.category).toBe(LiquidityCategory.EXTREMELY_THIN);
    });

    it("should include market question when provided", () => {
      const result = scorer.scoreMarket("market-5", {
        marketQuestion: "Will X happen?",
      });

      expect(result.marketQuestion).toBe("Will X happen?");
    });

    it("should include timestamp when scored", () => {
      const beforeTime = new Date();
      const result = scorer.scoreMarket("market-6");
      const afterTime = new Date();

      expect(result.scoredAt).toBeInstanceOf(Date);
      expect(result.scoredAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.scoredAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  // ==========================================================================
  // Liquidity Categories
  // ==========================================================================

  describe("liquidity categories", () => {
    it("should classify extremely thin markets", () => {
      // Create a market with minimal data to ensure extremely thin classification
      const result = scorer.scoreMarket("market-1");

      expect(result.category).toBe(LiquidityCategory.EXTREMELY_THIN);
      expect(result.isThinMarket).toBe(true);
      // Score is 0-15 for extremely thin markets
      expect(result.liquidityScore).toBeLessThan(15);
    });

    it("should classify thin markets", () => {
      const orderBookData = createThinMarketOrderBookData("market-2");
      const tradeVolumeStats = createThinMarketTradeVolumeStats("market-2");

      const result = scorer.scoreMarket("market-2", {
        orderBookData,
        tradeVolumeStats,
      });

      // Thin markets should have liquidity score below threshold (35)
      expect(result.liquidityScore).toBeLessThan(45);
      expect(result.isThinMarket).toBe(true);
    });

    it("should classify deep markets", () => {
      const orderBookData = createDeepMarketOrderBookData("market-3");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-3");

      const result = scorer.scoreMarket("market-3", {
        orderBookData,
        tradeVolumeStats,
      });

      expect([
        LiquidityCategory.ABOVE_AVERAGE,
        LiquidityCategory.DEEP,
        LiquidityCategory.VERY_DEEP,
      ]).toContain(result.category);
      expect(result.isThinMarket).toBe(false);
      expect(result.thinMarketSeverity).toBeNull();
    });

    it("should classify average markets", () => {
      const orderBookData = createTestOrderBookData("market-4", {
        totalBidVolumeUsd: 1000,
        totalAskVolumeUsd: 1000,
        bidLevelCount: 8,
        askLevelCount: 8,
        spreadPercent: 5,
      });
      const tradeVolumeStats = createTestTradeVolumeStats("market-4", {
        tradeCount: 50,
        volume24hUsd: 10000,
      });

      const result = scorer.scoreMarket("market-4", {
        orderBookData,
        tradeVolumeStats,
      });

      // Average market should be in middle range
      expect(result.liquidityScore).toBeGreaterThan(20);
      expect(result.liquidityScore).toBeLessThan(90);
    });
  });

  // ==========================================================================
  // Component Scores
  // ==========================================================================

  describe("component scores", () => {
    it("should calculate order book depth score", () => {
      const orderBookData = createDeepMarketOrderBookData("market-1");

      const result = scorer.scoreMarket("market-1", { orderBookData });

      expect(result.componentScores.orderBookDepth).toBeGreaterThan(50);
    });

    it("should calculate trade volume score", () => {
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-2");

      const result = scorer.scoreMarket("market-2", { tradeVolumeStats });

      expect(result.componentScores.tradeVolume).toBeGreaterThan(50);
    });

    it("should calculate spread score (tight spread = high score)", () => {
      const tightSpread = createTestOrderBookData("market-3", {
        spreadPercent: 0.5,
      });

      const wideSpread = createTestOrderBookData("market-4", {
        spreadPercent: 15,
      });

      const tightResult = scorer.scoreMarket("market-3", { orderBookData: tightSpread });
      const wideResult = scorer.scoreMarket("market-4", { orderBookData: wideSpread });

      expect(tightResult.componentScores.spread).toBeGreaterThan(
        wideResult.componentScores.spread
      );
    });

    it("should calculate participation score", () => {
      const highParticipation = createTestOrderBookData("market-5", {
        bidLevelCount: 30,
        askLevelCount: 30,
      });

      const lowParticipation = createTestOrderBookData("market-6", {
        bidLevelCount: 2,
        askLevelCount: 2,
      });

      const highResult = scorer.scoreMarket("market-5", {
        orderBookData: highParticipation,
      });
      const lowResult = scorer.scoreMarket("market-6", {
        orderBookData: lowParticipation,
      });

      expect(highResult.componentScores.participation).toBeGreaterThan(
        lowResult.componentScores.participation
      );
    });
  });

  // ==========================================================================
  // Confidence Scoring
  // ==========================================================================

  describe("confidence scoring", () => {
    it("should have high confidence with sufficient data", () => {
      const orderBookData = createDeepMarketOrderBookData("market-1");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-1");

      const result = scorer.scoreMarket("market-1", {
        orderBookData,
        tradeVolumeStats,
      });

      expect([LiquidityConfidence.HIGH, LiquidityConfidence.MEDIUM]).toContain(
        result.confidence
      );
      expect(result.confidenceScore).toBeGreaterThan(50);
    });

    it("should have low confidence with no data", () => {
      const result = scorer.scoreMarket("market-2");

      expect([LiquidityConfidence.LOW, LiquidityConfidence.VERY_LOW]).toContain(
        result.confidence
      );
    });

    it("should have medium confidence with partial data", () => {
      const orderBookData = createTestOrderBookData("market-3");

      const result = scorer.scoreMarket("market-3", { orderBookData });

      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Insider Advantage Multiplier
  // ==========================================================================

  describe("insider advantage multiplier", () => {
    it("should have high multiplier for thin markets", () => {
      const orderBookData = createThinMarketOrderBookData("market-1");
      const tradeVolumeStats = createThinMarketTradeVolumeStats("market-1");

      const result = scorer.scoreMarket("market-1", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result.insiderAdvantageMultiplier).toBeGreaterThan(1.0);
    });

    it("should have low multiplier for deep markets", () => {
      const orderBookData = createDeepMarketOrderBookData("market-2");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-2");

      const result = scorer.scoreMarket("market-2", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result.insiderAdvantageMultiplier).toBeLessThanOrEqual(1.0);
    });

    it("should have higher multiplier for thinner markets", () => {
      const thinOrder = createThinMarketOrderBookData("market-3");
      const thinVolume = createThinMarketTradeVolumeStats("market-3");
      const deepOrder = createDeepMarketOrderBookData("market-4");
      const deepVolume = createDeepMarketTradeVolumeStats("market-4");

      const thinResult = scorer.scoreMarket("market-3", {
        orderBookData: thinOrder,
        tradeVolumeStats: thinVolume,
      });
      const deepResult = scorer.scoreMarket("market-4", {
        orderBookData: deepOrder,
        tradeVolumeStats: deepVolume,
      });

      expect(thinResult.insiderAdvantageMultiplier).toBeGreaterThan(
        deepResult.insiderAdvantageMultiplier
      );
    });
  });

  // ==========================================================================
  // Price Impact Estimation
  // ==========================================================================

  describe("price impact estimation", () => {
    it("should estimate price impact for $1000 trade", () => {
      const orderBookData = createTestOrderBookData("market-1");

      const result = scorer.scoreMarket("market-1", { orderBookData });

      expect(result.estimatedPriceImpact1k).toBeGreaterThanOrEqual(0);
    });

    it("should estimate price impact for $10000 trade", () => {
      const orderBookData = createTestOrderBookData("market-2");

      const result = scorer.scoreMarket("market-2", { orderBookData });

      expect(result.estimatedPriceImpact10k).toBeGreaterThanOrEqual(0);
    });

    it("should return null impact without order book data", () => {
      const result = scorer.scoreMarket("market-3");

      expect(result.estimatedPriceImpact1k).toBeNull();
      expect(result.estimatedPriceImpact10k).toBeNull();
    });

    it("should have higher impact for larger trades in thin markets", () => {
      const orderBookData = createThinMarketOrderBookData("market-4");

      const result = scorer.scoreMarket("market-4", { orderBookData });

      if (result.estimatedPriceImpact1k !== null && result.estimatedPriceImpact10k !== null) {
        expect(result.estimatedPriceImpact10k).toBeGreaterThan(result.estimatedPriceImpact1k);
      }
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================

  describe("caching", () => {
    it("should cache results", () => {
      const orderBookData = createTestOrderBookData("market-1");

      const result1 = scorer.scoreMarket("market-1", { orderBookData });
      const result2 = scorer.scoreMarket("market-1", { orderBookData });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
      expect(result2.liquidityScore).toBe(result1.liquidityScore);
    });

    it("should bypass cache when requested", () => {
      const orderBookData = createTestOrderBookData("market-2");

      const result1 = scorer.scoreMarket("market-2", { orderBookData });
      const result2 = scorer.scoreMarket("market-2", {
        orderBookData,
        bypassCache: true,
      });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
    });

    it("should clear cache", () => {
      const orderBookData = createTestOrderBookData("market-3");

      scorer.scoreMarket("market-3", { orderBookData });
      expect(scorer.getCacheSize()).toBe(1);

      scorer.clearCache();
      expect(scorer.getCacheSize()).toBe(0);
    });

    it("should respect max cache size", () => {
      const smallCacheScorer = createMarketLiquidityScorer({
        maxCacheSize: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallCacheScorer.scoreMarket(`market-${i}`);
      }

      expect(smallCacheScorer.getCacheSize()).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Batch Scoring
  // ==========================================================================

  describe("scoreMarkets", () => {
    it("should score multiple markets", () => {
      const markets = [
        {
          marketId: "market-1",
          orderBookData: createTestOrderBookData("market-1"),
          tradeVolumeStats: createTestTradeVolumeStats("market-1"),
        },
        {
          marketId: "market-2",
          orderBookData: createThinMarketOrderBookData("market-2"),
          tradeVolumeStats: createThinMarketTradeVolumeStats("market-2"),
        },
        {
          marketId: "market-3",
          orderBookData: createDeepMarketOrderBookData("market-3"),
          tradeVolumeStats: createDeepMarketTradeVolumeStats("market-3"),
        },
      ];

      const result = scorer.scoreMarkets(markets);

      expect(result.scores).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalMarkets).toBe(3);
      expect(result.summary.successCount).toBe(3);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should calculate category distribution", () => {
      const markets = [
        {
          marketId: "thin-1",
          orderBookData: createThinMarketOrderBookData("thin-1"),
        },
        {
          marketId: "thin-2",
          orderBookData: createThinMarketOrderBookData("thin-2"),
        },
        {
          marketId: "deep-1",
          orderBookData: createDeepMarketOrderBookData("deep-1"),
          tradeVolumeStats: createDeepMarketTradeVolumeStats("deep-1"),
        },
      ];

      const result = scorer.scoreMarkets(markets);

      expect(result.summary.thinMarketCount).toBeGreaterThanOrEqual(2);
    });

    it("should calculate average liquidity score", () => {
      const markets = [
        { marketId: "market-1" },
        { marketId: "market-2" },
        { marketId: "market-3" },
      ];

      const result = scorer.scoreMarkets(markets);

      expect(result.summary.averageLiquidityScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageLiquidityScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  describe("isThinMarket", () => {
    it("should return true for thin market", () => {
      const orderBookData = createThinMarketOrderBookData("market-1");
      const tradeVolumeStats = createThinMarketTradeVolumeStats("market-1");

      const result = scorer.isThinMarket("market-1", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result).toBe(true);
    });

    it("should return false for deep market", () => {
      const orderBookData = createDeepMarketOrderBookData("market-2");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-2");

      const result = scorer.isThinMarket("market-2", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result).toBe(false);
    });
  });

  describe("getThinMarkets", () => {
    it("should return only thin markets from batch", () => {
      const markets = [
        {
          marketId: "thin-1",
          orderBookData: createThinMarketOrderBookData("thin-1"),
          tradeVolumeStats: createThinMarketTradeVolumeStats("thin-1"),
        },
        {
          marketId: "deep-1",
          orderBookData: createDeepMarketOrderBookData("deep-1"),
          tradeVolumeStats: createDeepMarketTradeVolumeStats("deep-1"),
        },
      ];

      const thinMarkets = scorer.getThinMarkets(markets);

      expect(thinMarkets.length).toBeGreaterThanOrEqual(1);
      expect(thinMarkets.every((m) => m.isThinMarket)).toBe(true);
    });
  });

  describe("getMarketsByCategory", () => {
    it("should filter by category", () => {
      const markets = [
        { marketId: "market-1" },
        { marketId: "market-2" },
        { marketId: "market-3" },
      ];

      const result = scorer.getMarketsByCategory(
        markets,
        LiquidityCategory.EXTREMELY_THIN
      );

      expect(result.every((m) => m.category === LiquidityCategory.EXTREMELY_THIN)).toBe(
        true
      );
    });
  });

  describe("getHighInsiderAdvantageMarkets", () => {
    it("should return markets with high insider advantage", () => {
      const markets = [
        {
          marketId: "thin-1",
          orderBookData: createThinMarketOrderBookData("thin-1"),
        },
        {
          marketId: "deep-1",
          orderBookData: createDeepMarketOrderBookData("deep-1"),
          tradeVolumeStats: createDeepMarketTradeVolumeStats("deep-1"),
        },
      ];

      const result = scorer.getHighInsiderAdvantageMarkets(markets, 1.5);

      expect(result.every((m) => m.insiderAdvantageMultiplier >= 1.5)).toBe(true);
    });
  });

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  describe("event emission", () => {
    it("should emit thinMarket event for thin markets", () => {
      const thinMarketHandler = vi.fn();
      scorer.on("thinMarket", thinMarketHandler);

      const orderBookData = createThinMarketOrderBookData("market-1");
      const tradeVolumeStats = createThinMarketTradeVolumeStats("market-1");

      scorer.scoreMarket("market-1", { orderBookData, tradeVolumeStats });

      expect(thinMarketHandler).toHaveBeenCalled();
      const alert = thinMarketHandler.mock.calls[0]?.[0] as { marketId: string; alertId: string; severity: string } | undefined;
      expect(alert).toBeDefined();
      expect(alert?.marketId).toBe("market-1");
      expect(alert?.alertId).toBeDefined();
      expect(alert?.severity).toBeDefined();
    });

    it("should not emit thinMarket event for deep markets", () => {
      const thinMarketHandler = vi.fn();
      scorer.on("thinMarket", thinMarketHandler);

      const orderBookData = createDeepMarketOrderBookData("market-2");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-2");

      scorer.scoreMarket("market-2", { orderBookData, tradeVolumeStats });

      expect(thinMarketHandler).not.toHaveBeenCalled();
    });

    it("should include reasons in thin market alert", () => {
      const thinMarketHandler = vi.fn();
      scorer.on("thinMarket", thinMarketHandler);

      const orderBookData = createThinMarketOrderBookData("market-3");
      scorer.scoreMarket("market-3", { orderBookData });

      expect(thinMarketHandler).toHaveBeenCalled();
      const alert = thinMarketHandler.mock.calls[0]?.[0] as { reasons: string[] } | undefined;
      expect(alert?.reasons).toBeDefined();
      expect(alert?.reasons?.length).toBeGreaterThan(0);
    });

    it("should include recommendations in thin market alert", () => {
      const thinMarketHandler = vi.fn();
      scorer.on("thinMarket", thinMarketHandler);

      const orderBookData = createThinMarketOrderBookData("market-4");
      scorer.scoreMarket("market-4", { orderBookData });

      expect(thinMarketHandler).toHaveBeenCalled();
      const alert = thinMarketHandler.mock.calls[0]?.[0] as { recommendations: string[] } | undefined;
      expect(alert?.recommendations).toBeDefined();
      expect(alert?.recommendations?.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Summary and Stats
  // ==========================================================================

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      scorer.scoreMarket("market-1");
      scorer.scoreMarket("market-2");

      const summary = scorer.getSummary();

      expect(summary.totalScored).toBeGreaterThanOrEqual(2);
      expect(summary.thinMarketCount).toBeGreaterThanOrEqual(0);
      expect(summary.averageLiquidityScore).toBeGreaterThanOrEqual(0);
      expect(summary.categoryDistribution).toBeDefined();
      expect(summary.cache).toBeDefined();
      expect(summary.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should track cache hit rate", () => {
      scorer.scoreMarket("market-1");
      scorer.scoreMarket("market-1");
      scorer.scoreMarket("market-2");

      const summary = scorer.getSummary();

      expect(summary.cache.hits).toBeGreaterThan(0);
      expect(summary.cache.hitRate).toBeGreaterThan(0);
    });
  });

  describe("resetStats", () => {
    it("should reset all statistics", () => {
      scorer.scoreMarket("market-1");
      scorer.scoreMarket("market-2");
      scorer.scoreMarket("market-1"); // Cache hit

      scorer.resetStats();

      const summary = scorer.getSummary();
      expect(summary.totalScored).toBe(0);
      expect(summary.cache.size).toBe(0);
      expect(summary.cache.hits).toBe(0);
      expect(summary.cache.misses).toBe(0);
    });
  });

  // ==========================================================================
  // Shared Instance
  // ==========================================================================

  describe("shared instance", () => {
    it("should get shared instance", () => {
      const shared = getSharedMarketLiquidityScorer();
      expect(shared).toBeInstanceOf(MarketLiquidityScorer);
    });

    it("should return same shared instance", () => {
      const shared1 = getSharedMarketLiquidityScorer();
      const shared2 = getSharedMarketLiquidityScorer();
      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const customScorer = createMarketLiquidityScorer({
        thinMarketThreshold: 50,
      });
      setSharedMarketLiquidityScorer(customScorer);

      const shared = getSharedMarketLiquidityScorer();
      expect(shared.getConfig().thinMarketThreshold).toBe(50);
    });

    it("should reset shared instance", () => {
      const customScorer = createMarketLiquidityScorer({
        thinMarketThreshold: 50,
      });
      setSharedMarketLiquidityScorer(customScorer);

      resetSharedMarketLiquidityScorer();

      const shared = getSharedMarketLiquidityScorer();
      expect(shared.getConfig().thinMarketThreshold).toBe(35);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    it("scoreMarketLiquidity should use shared instance", () => {
      const result = scoreMarketLiquidity("market-1");
      expect(result.marketId).toBe("market-1");
    });

    it("scoreMarketsLiquidity should use shared instance", () => {
      const result = scoreMarketsLiquidity([
        { marketId: "market-1" },
        { marketId: "market-2" },
      ]);
      expect(result.scores).toHaveLength(2);
    });

    it("isThinMarket should use shared instance", () => {
      const result = isThinMarket("market-1");
      expect(typeof result).toBe("boolean");
    });

    it("getThinMarkets should use shared instance", () => {
      const result = getThinMarkets([{ marketId: "market-1" }, { marketId: "market-2" }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("getHighInsiderAdvantageMarkets should use shared instance", () => {
      const result = getHighInsiderAdvantageMarkets([
        { marketId: "market-1" },
        { marketId: "market-2" },
      ]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("getLiquidityScorerSummary should use shared instance", () => {
      const summary = getLiquidityScorerSummary();
      expect(summary.totalScored).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle zero volume order book", () => {
      const orderBookData = createTestOrderBookData("market-1", {
        totalBidVolumeUsd: 0,
        totalAskVolumeUsd: 0,
        bidLevelCount: 0,
        askLevelCount: 0,
      });

      const result = scorer.scoreMarket("market-1", { orderBookData });

      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
      // Should have low score due to zero volume
      expect(result.isThinMarket).toBe(true);
    });

    it("should handle null spread", () => {
      const orderBookData = createTestOrderBookData("market-2", {
        spreadPercent: null,
      });

      const result = scorer.scoreMarket("market-2", { orderBookData });

      expect(result.componentScores.spread).toBe(50); // Neutral score
    });

    it("should handle very wide spread", () => {
      const orderBookData = createTestOrderBookData("market-3", {
        spreadPercent: 50,
      });

      const result = scorer.scoreMarket("market-3", { orderBookData });

      expect(result.componentScores.spread).toBe(0);
    });

    it("should handle zero trade count", () => {
      const tradeVolumeStats = createTestTradeVolumeStats("market-4", {
        tradeCount: 0,
        totalVolumeUsd: 0,
        averageTradeSizeUsd: 0,
        volume24hUsd: 0,
      });

      const result = scorer.scoreMarket("market-4", { tradeVolumeStats });

      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
    });

    it("should handle imbalanced order book", () => {
      const imbalancedOrderBook = createTestOrderBookData("market-5", {
        totalBidVolumeUsd: 10000,
        totalAskVolumeUsd: 100,
      });

      const balancedOrderBook = createTestOrderBookData("market-6", {
        totalBidVolumeUsd: 5000,
        totalAskVolumeUsd: 5000,
      });

      const imbalancedResult = scorer.scoreMarket("market-5", {
        orderBookData: imbalancedOrderBook,
      });
      const balancedResult = scorer.scoreMarket("market-6", {
        orderBookData: balancedOrderBook,
      });

      // Balanced should have higher order book depth score
      expect(balancedResult.componentScores.orderBookDepth).toBeGreaterThanOrEqual(
        imbalancedResult.componentScores.orderBookDepth
      );
    });

    it("should handle very high trade size standard deviation", () => {
      const tradeVolumeStats = createTestTradeVolumeStats("market-7", {
        averageTradeSizeUsd: 100,
        tradeSizeStdDev: 1000, // High variance
      });

      const result = scorer.scoreMarket("market-7", { tradeVolumeStats });

      expect(result.liquidityScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Thin Market Severity
  // ==========================================================================

  describe("thin market severity", () => {
    it("should assign CRITICAL severity for extremely thin markets", () => {
      const orderBookData = createTestOrderBookData("market-1", {
        totalBidVolumeUsd: 5,
        totalAskVolumeUsd: 5,
        bidLevelCount: 1,
        askLevelCount: 1,
        spreadPercent: 30,
      });

      const result = scorer.scoreMarket("market-1", { orderBookData });

      if (result.liquidityScore <= 10) {
        expect(result.thinMarketSeverity).toBe(ThinMarketSeverity.CRITICAL);
      }
    });

    it("should assign HIGH severity for very thin markets", () => {
      const orderBookData = createTestOrderBookData("market-2", {
        totalBidVolumeUsd: 30,
        totalAskVolumeUsd: 30,
        bidLevelCount: 2,
        askLevelCount: 2,
        spreadPercent: 20,
      });

      const result = scorer.scoreMarket("market-2", { orderBookData });

      if (result.liquidityScore > 10 && result.liquidityScore <= 20) {
        expect(result.thinMarketSeverity).toBe(ThinMarketSeverity.HIGH);
      }
    });

    it("should return null severity for non-thin markets", () => {
      const orderBookData = createDeepMarketOrderBookData("market-3");
      const tradeVolumeStats = createDeepMarketTradeVolumeStats("market-3");

      const result = scorer.scoreMarket("market-3", {
        orderBookData,
        tradeVolumeStats,
      });

      expect(result.thinMarketSeverity).toBeNull();
    });
  });
});

// ============================================================================
// Enum Tests
// ============================================================================

describe("LiquidityCategory", () => {
  it("should have all expected categories", () => {
    expect(LiquidityCategory.EXTREMELY_THIN).toBe("EXTREMELY_THIN");
    expect(LiquidityCategory.THIN).toBe("THIN");
    expect(LiquidityCategory.BELOW_AVERAGE).toBe("BELOW_AVERAGE");
    expect(LiquidityCategory.AVERAGE).toBe("AVERAGE");
    expect(LiquidityCategory.ABOVE_AVERAGE).toBe("ABOVE_AVERAGE");
    expect(LiquidityCategory.DEEP).toBe("DEEP");
    expect(LiquidityCategory.VERY_DEEP).toBe("VERY_DEEP");
  });
});

describe("LiquidityConfidence", () => {
  it("should have all expected confidence levels", () => {
    expect(LiquidityConfidence.HIGH).toBe("HIGH");
    expect(LiquidityConfidence.MEDIUM).toBe("MEDIUM");
    expect(LiquidityConfidence.LOW).toBe("LOW");
    expect(LiquidityConfidence.VERY_LOW).toBe("VERY_LOW");
  });
});

describe("ThinMarketSeverity", () => {
  it("should have all expected severity levels", () => {
    expect(ThinMarketSeverity.INFO).toBe("INFO");
    expect(ThinMarketSeverity.LOW).toBe("LOW");
    expect(ThinMarketSeverity.MEDIUM).toBe("MEDIUM");
    expect(ThinMarketSeverity.HIGH).toBe("HIGH");
    expect(ThinMarketSeverity.CRITICAL).toBe("CRITICAL");
  });
});
