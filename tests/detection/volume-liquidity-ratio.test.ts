/**
 * Unit Tests for Volume-to-Liquidity Ratio Analyzer (DET-VOL-006)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VolumeLiquidityRatioAnalyzer,
  RatioSeverity,
  LiquidityMeasure,
  TradeDirection,
  DEFAULT_RATIO_THRESHOLDS,
  createVolumeLiquidityRatioAnalyzer,
  getSharedVolumeLiquidityRatioAnalyzer,
  setSharedVolumeLiquidityRatioAnalyzer,
  resetSharedVolumeLiquidityRatioAnalyzer,
  analyzeVolumeLiquidityRatio,
  batchAnalyzeVolumeLiquidityRatio,
  isHighRatioTrade,
  updateOrderBookCache,
  getMarketRatioStats,
  getRatioAnalyzerSummary,
  OrderBookSnapshot,
  TradeForRatioAnalysis,
  VolumeLiquidityRatioAnalyzerConfig,
} from "../../src/detection/volume-liquidity-ratio";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockOrderBook(overrides: Partial<OrderBookSnapshot> = {}): OrderBookSnapshot {
  return {
    marketId: "market-1",
    timestamp: new Date(),
    totalBidVolumeUsd: 100000,
    totalAskVolumeUsd: 100000,
    bestBidVolumeUsd: 5000,
    bestAskVolumeUsd: 5000,
    bestBidPrice: 0.49,
    bestAskPrice: 0.51,
    spreadPercent: 4.0,
    bidLevels: 10,
    askLevels: 10,
    bidVolumeAt1Percent: 20000,
    askVolumeAt1Percent: 20000,
    bidVolumeAt2Percent: 40000,
    askVolumeAt2Percent: 40000,
    bidVolumeAt5Percent: 80000,
    askVolumeAt5Percent: 80000,
    ...overrides,
  };
}

function createMockTrade(overrides: Partial<TradeForRatioAnalysis> = {}): TradeForRatioAnalysis {
  return {
    tradeId: `trade-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    marketId: "market-1",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    sizeUsd: 1000,
    direction: TradeDirection.BUY,
    timestamp: new Date(),
    ...overrides,
  };
}

// ============================================================================
// VolumeLiquidityRatioAnalyzer Class Tests
// ============================================================================

describe("VolumeLiquidityRatioAnalyzer", () => {
  let analyzer: VolumeLiquidityRatioAnalyzer;

  beforeEach(() => {
    analyzer = new VolumeLiquidityRatioAnalyzer();
  });

  afterEach(() => {
    analyzer.reset();
  });

  describe("constructor", () => {
    it("should create analyzer with default configuration", () => {
      const config = analyzer.getConfig();
      expect(config.thresholds).toEqual(DEFAULT_RATIO_THRESHOLDS);
      expect(config.defaultLiquidityMeasure).toBe(LiquidityMeasure.PRICE_RANGE);
      expect(config.enableEvents).toBe(true);
      expect(config.maxHistoryPerMarket).toBe(1000);
      expect(config.maxMarketsTracked).toBe(500);
      expect(config.minLiquidityUsd).toBe(100);
    });

    it("should accept custom configuration", () => {
      const customConfig: VolumeLiquidityRatioAnalyzerConfig = {
        thresholds: {
          elevated: 0.1,
          high: 0.2,
          veryHigh: 0.3,
          critical: 0.6,
        },
        defaultLiquidityMeasure: LiquidityMeasure.TOTAL,
        enableEvents: false,
        maxHistoryPerMarket: 500,
      };

      const customAnalyzer = new VolumeLiquidityRatioAnalyzer(customConfig);
      const config = customAnalyzer.getConfig();

      expect(config.thresholds.elevated).toBe(0.1);
      expect(config.thresholds.high).toBe(0.2);
      expect(config.defaultLiquidityMeasure).toBe(LiquidityMeasure.TOTAL);
      expect(config.enableEvents).toBe(false);
      expect(config.maxHistoryPerMarket).toBe(500);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      analyzer.updateConfig({
        enableEvents: false,
        minLiquidityUsd: 500,
      });

      const config = analyzer.getConfig();
      expect(config.enableEvents).toBe(false);
      expect(config.minLiquidityUsd).toBe(500);
    });

    it("should update thresholds", () => {
      analyzer.updateConfig({
        thresholds: {
          elevated: 0.15,
        },
      });

      const config = analyzer.getConfig();
      expect(config.thresholds.elevated).toBe(0.15);
    });
  });

  describe("updateOrderBook", () => {
    it("should cache order book snapshot", () => {
      const orderBook = createMockOrderBook();
      analyzer.updateOrderBook(orderBook);

      const cached = analyzer.getCachedOrderBook("market-1");
      expect(cached).not.toBeNull();
      expect(cached?.marketId).toBe("market-1");
      expect(cached?.totalBidVolumeUsd).toBe(100000);
    });

    it("should return null for non-existent market", () => {
      const cached = analyzer.getCachedOrderBook("non-existent");
      expect(cached).toBeNull();
    });

    it("should expire cached order book", async () => {
      const customAnalyzer = new VolumeLiquidityRatioAnalyzer({
        orderBookCacheTtlMs: 50, // 50ms TTL
      });

      const orderBook = createMockOrderBook();
      customAnalyzer.updateOrderBook(orderBook);

      expect(customAnalyzer.getCachedOrderBook("market-1")).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(customAnalyzer.getCachedOrderBook("market-1")).toBeNull();
    });
  });

  describe("analyzeRatio", () => {
    beforeEach(() => {
      const orderBook = createMockOrderBook();
      analyzer.updateOrderBook(orderBook);
    });

    it("should analyze ratio for a trade", () => {
      const trade = createMockTrade({ sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.tradeId).toBe(trade.tradeId);
      expect(result.marketId).toBe("market-1");
      expect(result.tradeSizeUsd).toBe(2000);
      expect(result.direction).toBe(TradeDirection.BUY);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratioPercent).toBe(result.ratio * 100);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should classify NORMAL severity for small trades", () => {
      const trade = createMockTrade({ sizeUsd: 100 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.NORMAL);
      expect(result.isFlagged).toBe(false);
    });

    it("should classify ELEVATED severity", () => {
      // With 40000 liquidity at 2%, a 2000 trade = 5% ratio
      const trade = createMockTrade({ sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.ELEVATED);
      expect(result.isFlagged).toBe(true);
    });

    it("should classify HIGH severity", () => {
      // 4000 / 40000 = 10% ratio
      const trade = createMockTrade({ sizeUsd: 4000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.HIGH);
      expect(result.isFlagged).toBe(true);
    });

    it("should classify VERY_HIGH severity", () => {
      // 8000 / 40000 = 20% ratio
      const trade = createMockTrade({ sizeUsd: 8000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.VERY_HIGH);
      expect(result.isFlagged).toBe(true);
    });

    it("should classify CRITICAL severity", () => {
      // 20000 / 40000 = 50% ratio
      const trade = createMockTrade({ sizeUsd: 20000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.CRITICAL);
      expect(result.isFlagged).toBe(true);
    });

    it("should calculate additional ratios", () => {
      const trade = createMockTrade({ sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.additionalRatios).toBeDefined();
      expect(result.additionalRatios.totalLiquidityRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt1PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt2PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt5PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.topOfBookRatio).toBeGreaterThan(0);
    });

    it("should estimate price impact", () => {
      const trade = createMockTrade({ sizeUsd: 4000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.estimatedPriceImpactPercent).toBeGreaterThan(0);
    });

    it("should calculate confidence", () => {
      const trade = createMockTrade({ sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should include order book snapshot", () => {
      const trade = createMockTrade({ sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.orderBookSnapshot).not.toBeNull();
      expect(result.orderBookSnapshot?.marketId).toBe("market-1");
    });

    it("should skip flagging when option is set", () => {
      const trade = createMockTrade({ sizeUsd: 20000 });
      const result = analyzer.analyzeRatio(trade, { skipFlagging: true });

      expect(result.severity).toBe(RatioSeverity.CRITICAL);
      expect(result.isFlagged).toBe(false);
    });

    it("should use provided order book", () => {
      const customOrderBook = createMockOrderBook({
        marketId: "market-2",
        totalBidVolumeUsd: 50000,
        totalAskVolumeUsd: 50000,
        askVolumeAt2Percent: 20000,
      });

      const trade = createMockTrade({ marketId: "market-2", sizeUsd: 2000 });
      const result = analyzer.analyzeRatio(trade, { orderBook: customOrderBook });

      expect(result.marketId).toBe("market-2");
      expect(result.orderBookSnapshot?.totalBidVolumeUsd).toBe(50000);
    });

    it("should handle different liquidity measures", () => {
      const trade = createMockTrade({ sizeUsd: 2000 });

      const totalResult = analyzer.analyzeRatio(trade, {
        liquidityMeasure: LiquidityMeasure.TOTAL,
      });
      const bidResult = analyzer.analyzeRatio(trade, {
        liquidityMeasure: LiquidityMeasure.BID_SIDE,
      });
      const askResult = analyzer.analyzeRatio(trade, {
        liquidityMeasure: LiquidityMeasure.ASK_SIDE,
      });
      const topResult = analyzer.analyzeRatio(trade, {
        liquidityMeasure: LiquidityMeasure.TOP_OF_BOOK,
      });

      // Different measures should give different ratios
      expect(totalResult.availableLiquidityUsd).toBe(200000); // bid + ask
      expect(bidResult.availableLiquidityUsd).toBe(100000);
      expect(askResult.availableLiquidityUsd).toBe(100000);
      expect(topResult.availableLiquidityUsd).toBe(5000); // best ask for BUY
    });

    it("should handle trade direction for liquidity selection", () => {
      const buyTrade = createMockTrade({
        sizeUsd: 2000,
        direction: TradeDirection.BUY,
      });
      const sellTrade = createMockTrade({
        sizeUsd: 2000,
        direction: TradeDirection.SELL,
      });

      const buyResult = analyzer.analyzeRatio(buyTrade, {
        liquidityMeasure: LiquidityMeasure.TOP_OF_BOOK,
      });
      const sellResult = analyzer.analyzeRatio(sellTrade, {
        liquidityMeasure: LiquidityMeasure.TOP_OF_BOOK,
      });

      // Buy consumes ask, sell consumes bid
      expect(buyResult.availableLiquidityUsd).toBe(5000); // best ask
      expect(sellResult.availableLiquidityUsd).toBe(5000); // best bid
    });

    it("should handle missing order book with minimum liquidity", () => {
      const newAnalyzer = new VolumeLiquidityRatioAnalyzer({ minLiquidityUsd: 1000 });
      const trade = createMockTrade({ marketId: "no-orderbook", sizeUsd: 500 });

      const result = newAnalyzer.analyzeRatio(trade);

      expect(result.availableLiquidityUsd).toBe(1000); // minimum
      expect(result.ratio).toBe(0.5); // 500 / 1000
    });
  });

  describe("event emission", () => {
    it("should emit highRatio event for flagged trades", () => {
      const eventSpy = vi.fn();
      analyzer.on("highRatio", eventSpy);

      analyzer.updateOrderBook(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 20000 }); // Critical ratio
      analyzer.analyzeRatio(trade);

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0]?.[0]).toMatchObject({
        tradeId: trade.tradeId,
        severity: RatioSeverity.CRITICAL,
      });
    });

    it("should not emit event when events are disabled", () => {
      const noEventAnalyzer = new VolumeLiquidityRatioAnalyzer({ enableEvents: false });
      const eventSpy = vi.fn();
      noEventAnalyzer.on("highRatio", eventSpy);

      noEventAnalyzer.updateOrderBook(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 20000 });
      noEventAnalyzer.analyzeRatio(trade);

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it("should not emit event for normal trades", () => {
      const eventSpy = vi.fn();
      analyzer.on("highRatio", eventSpy);

      analyzer.updateOrderBook(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 100 }); // Small trade
      analyzer.analyzeRatio(trade);

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("analyzeRatioBatch", () => {
    beforeEach(() => {
      analyzer.updateOrderBook(createMockOrderBook());
    });

    it("should analyze multiple trades", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 2000 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 4000 }),
      ];

      const result = analyzer.analyzeRatioBatch(trades);

      expect(result.results.length).toBe(3);
      expect(result.errors.size).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should count flagged trades", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }), // Normal
        createMockTrade({ tradeId: "t2", sizeUsd: 2000 }), // Elevated
        createMockTrade({ tradeId: "t3", sizeUsd: 20000 }), // Critical
      ];

      const result = analyzer.analyzeRatioBatch(trades);

      expect(result.flaggedCount).toBe(2);
    });

    it("should calculate average ratio", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 1000 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 2000 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 3000 }),
      ];

      const result = analyzer.analyzeRatioBatch(trades);

      expect(result.averageRatio).toBeGreaterThan(0);
    });
  });

  describe("isHighRatio", () => {
    it("should return true for high ratio trades", () => {
      analyzer.updateOrderBook(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 4000 });

      expect(analyzer.isHighRatio(trade)).toBe(true);
    });

    it("should return false for normal trades", () => {
      analyzer.updateOrderBook(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 100 });

      expect(analyzer.isHighRatio(trade)).toBe(false);
    });

    it("should return false when no order book is available", () => {
      const trade = createMockTrade({ marketId: "unknown", sizeUsd: 4000 });

      expect(analyzer.isHighRatio(trade)).toBe(false);
    });

    it("should use provided order book", () => {
      const orderBook = createMockOrderBook({ askVolumeAt2Percent: 10000 });
      const trade = createMockTrade({ sizeUsd: 1000 });

      expect(analyzer.isHighRatio(trade, orderBook)).toBe(true);
    });
  });

  describe("getMarketStats", () => {
    beforeEach(() => {
      analyzer.updateOrderBook(createMockOrderBook());
    });

    it("should return null for market with no history", () => {
      const stats = analyzer.getMarketStats("unknown-market");
      expect(stats).toBeNull();
    });

    it("should return statistics after analyzing trades", () => {
      const trades = [
        createMockTrade({ sizeUsd: 1000 }),
        createMockTrade({ sizeUsd: 2000 }),
        createMockTrade({ sizeUsd: 3000 }),
        createMockTrade({ sizeUsd: 4000 }),
        createMockTrade({ sizeUsd: 5000 }),
      ];

      for (const trade of trades) {
        analyzer.analyzeRatio(trade);
      }

      const stats = analyzer.getMarketStats("market-1");

      expect(stats).not.toBeNull();
      expect(stats!.marketId).toBe("market-1");
      expect(stats!.tradeCount).toBe(5);
      expect(stats!.averageRatio).toBeGreaterThan(0);
      expect(stats!.medianRatio).toBeGreaterThan(0);
      expect(stats!.standardDeviation).toBeGreaterThanOrEqual(0);
      expect(stats!.maxRatio).toBeGreaterThan(stats!.minRatio);
    });

    it("should track severity counts", () => {
      const trades = [
        createMockTrade({ sizeUsd: 100 }), // Normal
        createMockTrade({ sizeUsd: 2000 }), // Elevated
        createMockTrade({ sizeUsd: 4000 }), // High
        createMockTrade({ sizeUsd: 8000 }), // Very High
        createMockTrade({ sizeUsd: 20000 }), // Critical
      ];

      for (const trade of trades) {
        analyzer.analyzeRatio(trade);
      }

      const stats = analyzer.getMarketStats("market-1");

      expect(stats!.severityCounts[RatioSeverity.NORMAL]).toBe(1);
      expect(stats!.severityCounts[RatioSeverity.ELEVATED]).toBe(1);
      expect(stats!.severityCounts[RatioSeverity.HIGH]).toBe(1);
      expect(stats!.severityCounts[RatioSeverity.VERY_HIGH]).toBe(1);
      expect(stats!.severityCounts[RatioSeverity.CRITICAL]).toBe(1);
    });
  });

  describe("getMarketHistory", () => {
    beforeEach(() => {
      analyzer.updateOrderBook(createMockOrderBook());
    });

    it("should return empty array for unknown market", () => {
      const history = analyzer.getMarketHistory("unknown");
      expect(history).toEqual([]);
    });

    it("should return history after analyzing trades", () => {
      const trades = [
        createMockTrade({ sizeUsd: 1000 }),
        createMockTrade({ sizeUsd: 2000 }),
        createMockTrade({ sizeUsd: 3000 }),
      ];

      for (const trade of trades) {
        analyzer.analyzeRatio(trade);
      }

      const history = analyzer.getMarketHistory("market-1");

      expect(history.length).toBe(3);
      expect(history[0]!.tradeId).toBe(trades[0]!.tradeId);
    });

    it("should respect limit parameter", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createMockTrade({ tradeId: `trade-${i}`, sizeUsd: 1000 })
      );

      for (const trade of trades) {
        analyzer.analyzeRatio(trade);
      }

      const history = analyzer.getMarketHistory("market-1", 5);

      expect(history.length).toBe(5);
    });
  });

  describe("getRecentAlerts", () => {
    beforeEach(() => {
      analyzer.updateOrderBook(createMockOrderBook());
    });

    it("should return empty array when no alerts", () => {
      const alerts = analyzer.getRecentAlerts();
      expect(alerts).toEqual([]);
    });

    it("should return alerts for flagged trades", () => {
      const trade = createMockTrade({ sizeUsd: 20000 }); // Critical
      analyzer.analyzeRatio(trade);

      const alerts = analyzer.getRecentAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0]!.tradeId).toBe(trade.tradeId);
      expect(alerts[0]!.severity).toBe(RatioSeverity.CRITICAL);
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        const trade = createMockTrade({ sizeUsd: 20000 });
        analyzer.analyzeRatio(trade);
      }

      const alerts = analyzer.getRecentAlerts(5);

      expect(alerts.length).toBe(5);
    });
  });

  describe("getRatioPercentile", () => {
    beforeEach(() => {
      analyzer.updateOrderBook(createMockOrderBook());

      // Create varied trades
      const sizes = [100, 500, 1000, 2000, 3000, 4000, 5000, 8000, 10000, 20000];
      for (const size of sizes) {
        analyzer.analyzeRatio(createMockTrade({ sizeUsd: size }));
      }
    });

    it("should calculate percentile for ratio", () => {
      const highRatio = 0.5; // 50% of liquidity
      const percentile = analyzer.getRatioPercentile("market-1", highRatio);

      expect(percentile).toBeGreaterThan(0);
      expect(percentile).toBeLessThanOrEqual(100);
    });

    it("should return 0 for unknown market", () => {
      const percentile = analyzer.getRatioPercentile("unknown", 0.1);
      expect(percentile).toBe(0);
    });
  });

  describe("getSummary", () => {
    it("should return summary with no data", () => {
      const summary = analyzer.getSummary();

      expect(summary.totalMarketsTracked).toBe(0);
      expect(summary.totalTradesAnalyzed).toBe(0);
      expect(summary.totalTradesFlagged).toBe(0);
      expect(summary.overallFlagRate).toBe(0);
      expect(summary.globalAverageRatio).toBe(0);
    });

    it("should return comprehensive summary", () => {
      analyzer.updateOrderBook(createMockOrderBook());
      analyzer.updateOrderBook(createMockOrderBook({ marketId: "market-2" }));

      // Analyze trades for both markets
      for (let i = 0; i < 5; i++) {
        analyzer.analyzeRatio(createMockTrade({ sizeUsd: (i + 1) * 1000 }));
        analyzer.analyzeRatio(
          createMockTrade({ marketId: "market-2", sizeUsd: (i + 1) * 2000 })
        );
      }

      const summary = analyzer.getSummary();

      expect(summary.totalMarketsTracked).toBe(2);
      expect(summary.totalTradesAnalyzed).toBe(10);
      expect(summary.totalTradesFlagged).toBeGreaterThan(0);
      expect(summary.overallFlagRate).toBeGreaterThan(0);
      expect(summary.globalAverageRatio).toBeGreaterThan(0);
      expect(summary.topFlaggedMarkets.length).toBeGreaterThan(0);
      expect(summary.cacheStats.orderBookCacheSize).toBe(2);
      expect(summary.lastActivityTime).toBeInstanceOf(Date);
    });
  });

  describe("clearCache", () => {
    it("should clear order book cache", () => {
      analyzer.updateOrderBook(createMockOrderBook());
      analyzer.updateOrderBook(createMockOrderBook({ marketId: "market-2" }));

      expect(analyzer.getCachedOrderBook("market-1")).not.toBeNull();

      analyzer.clearCache();

      expect(analyzer.getCachedOrderBook("market-1")).toBeNull();
      expect(analyzer.getCachedOrderBook("market-2")).toBeNull();
    });
  });

  describe("clearHistory", () => {
    it("should clear all history and statistics", () => {
      analyzer.updateOrderBook(createMockOrderBook());

      for (let i = 0; i < 5; i++) {
        analyzer.analyzeRatio(createMockTrade({ sizeUsd: 20000 })); // Generate alerts
      }

      expect(analyzer.getMarketHistory("market-1").length).toBe(5);
      expect(analyzer.getRecentAlerts().length).toBe(5);

      analyzer.clearHistory();

      expect(analyzer.getMarketHistory("market-1").length).toBe(0);
      expect(analyzer.getRecentAlerts().length).toBe(0);
      expect(analyzer.getMarketStats("market-1")).toBeNull();
    });
  });

  describe("reset", () => {
    it("should reset analyzer to initial state", () => {
      analyzer.updateOrderBook(createMockOrderBook());

      for (let i = 0; i < 5; i++) {
        analyzer.analyzeRatio(createMockTrade({ sizeUsd: 20000 }));
      }

      analyzer.reset();

      const summary = analyzer.getSummary();
      expect(summary.totalMarketsTracked).toBe(0);
      expect(summary.totalTradesAnalyzed).toBe(0);
      expect(summary.cacheStats.orderBookCacheSize).toBe(0);
      expect(summary.lastActivityTime).toBeNull();
    });
  });

  describe("cleanupCache", () => {
    it("should remove expired cache entries", async () => {
      const fastExpireAnalyzer = new VolumeLiquidityRatioAnalyzer({
        orderBookCacheTtlMs: 50,
      });

      fastExpireAnalyzer.updateOrderBook(createMockOrderBook());
      fastExpireAnalyzer.updateOrderBook(createMockOrderBook({ marketId: "market-2" }));

      expect(fastExpireAnalyzer.getSummary().cacheStats.orderBookCacheSize).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 60));

      const removed = fastExpireAnalyzer.cleanupCache();

      expect(removed).toBe(2);
      expect(fastExpireAnalyzer.getSummary().cacheStats.orderBookCacheSize).toBe(0);
    });
  });

  describe("history limits", () => {
    it("should enforce max history per market", () => {
      const limitedAnalyzer = new VolumeLiquidityRatioAnalyzer({
        maxHistoryPerMarket: 5,
      });

      limitedAnalyzer.updateOrderBook(createMockOrderBook());

      for (let i = 0; i < 10; i++) {
        limitedAnalyzer.analyzeRatio(createMockTrade({ sizeUsd: 1000 }));
      }

      const history = limitedAnalyzer.getMarketHistory("market-1");
      expect(history.length).toBe(5);
    });

    it("should enforce max markets tracked", () => {
      const limitedAnalyzer = new VolumeLiquidityRatioAnalyzer({
        maxMarketsTracked: 3,
      });

      for (let i = 0; i < 5; i++) {
        const marketId = `market-${i}`;
        limitedAnalyzer.updateOrderBook(createMockOrderBook({ marketId }));
        limitedAnalyzer.analyzeRatio(createMockTrade({ marketId, sizeUsd: 1000 }));
      }

      const summary = limitedAnalyzer.getSummary();
      expect(summary.totalMarketsTracked).toBeLessThanOrEqual(3);
    });
  });
});

// ============================================================================
// Singleton and Convenience Function Tests
// ============================================================================

describe("Singleton Management", () => {
  afterEach(() => {
    resetSharedVolumeLiquidityRatioAnalyzer();
  });

  describe("createVolumeLiquidityRatioAnalyzer", () => {
    it("should create new instance", () => {
      const analyzer = createVolumeLiquidityRatioAnalyzer();
      expect(analyzer).toBeInstanceOf(VolumeLiquidityRatioAnalyzer);
    });

    it("should accept configuration", () => {
      const analyzer = createVolumeLiquidityRatioAnalyzer({
        enableEvents: false,
      });
      expect(analyzer.getConfig().enableEvents).toBe(false);
    });
  });

  describe("getSharedVolumeLiquidityRatioAnalyzer", () => {
    it("should return same instance on multiple calls", () => {
      const first = getSharedVolumeLiquidityRatioAnalyzer();
      const second = getSharedVolumeLiquidityRatioAnalyzer();
      expect(first).toBe(second);
    });
  });

  describe("setSharedVolumeLiquidityRatioAnalyzer", () => {
    it("should set custom instance as shared", () => {
      const custom = new VolumeLiquidityRatioAnalyzer({ enableEvents: false });
      setSharedVolumeLiquidityRatioAnalyzer(custom);

      const shared = getSharedVolumeLiquidityRatioAnalyzer();
      expect(shared).toBe(custom);
      expect(shared.getConfig().enableEvents).toBe(false);
    });
  });

  describe("resetSharedVolumeLiquidityRatioAnalyzer", () => {
    it("should reset shared instance", () => {
      const first = getSharedVolumeLiquidityRatioAnalyzer();
      resetSharedVolumeLiquidityRatioAnalyzer();
      const second = getSharedVolumeLiquidityRatioAnalyzer();

      expect(first).not.toBe(second);
    });
  });
});

describe("Convenience Functions", () => {
  afterEach(() => {
    resetSharedVolumeLiquidityRatioAnalyzer();
  });

  describe("analyzeVolumeLiquidityRatio", () => {
    it("should analyze ratio using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());
      const trade = createMockTrade({ sizeUsd: 2000 });

      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result.tradeId).toBe(trade.tradeId);
      expect(result.ratio).toBeGreaterThan(0);
    });
  });

  describe("batchAnalyzeVolumeLiquidityRatio", () => {
    it("should batch analyze using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 1000 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 2000 }),
      ];

      const result = batchAnalyzeVolumeLiquidityRatio(trades);

      expect(result.results.length).toBe(2);
    });
  });

  describe("isHighRatioTrade", () => {
    it("should check high ratio using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());

      const normalTrade = createMockTrade({ sizeUsd: 100 });
      const highTrade = createMockTrade({ sizeUsd: 4000 });

      expect(isHighRatioTrade(normalTrade)).toBe(false);
      expect(isHighRatioTrade(highTrade)).toBe(true);
    });
  });

  describe("updateOrderBookCache", () => {
    it("should update cache using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());

      const cached = getSharedVolumeLiquidityRatioAnalyzer().getCachedOrderBook("market-1");
      expect(cached).not.toBeNull();
    });
  });

  describe("getMarketRatioStats", () => {
    it("should get stats using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());
      analyzeVolumeLiquidityRatio(createMockTrade({ sizeUsd: 1000 }));

      const stats = getMarketRatioStats("market-1");

      expect(stats).not.toBeNull();
      expect(stats!.tradeCount).toBe(1);
    });
  });

  describe("getRatioAnalyzerSummary", () => {
    it("should get summary using shared analyzer", () => {
      updateOrderBookCache(createMockOrderBook());
      analyzeVolumeLiquidityRatio(createMockTrade({ sizeUsd: 1000 }));

      const summary = getRatioAnalyzerSummary();

      expect(summary.totalTradesAnalyzed).toBe(1);
    });
  });
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe("Edge Cases", () => {
  let analyzer: VolumeLiquidityRatioAnalyzer;

  beforeEach(() => {
    analyzer = new VolumeLiquidityRatioAnalyzer();
  });

  afterEach(() => {
    analyzer.reset();
  });

  describe("zero liquidity handling", () => {
    it("should use minimum liquidity when order book is empty", () => {
      const emptyOrderBook = createMockOrderBook({
        totalBidVolumeUsd: 0,
        totalAskVolumeUsd: 0,
        askVolumeAt2Percent: 0,
        bidVolumeAt2Percent: 0,
      });
      analyzer.updateOrderBook(emptyOrderBook);

      const trade = createMockTrade({ sizeUsd: 1000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.availableLiquidityUsd).toBe(100); // minLiquidityUsd default
    });
  });

  describe("unknown trade direction", () => {
    it("should handle UNKNOWN direction gracefully", () => {
      analyzer.updateOrderBook(createMockOrderBook());

      const trade = createMockTrade({
        sizeUsd: 2000,
        direction: TradeDirection.UNKNOWN,
      });
      const result = analyzer.analyzeRatio(trade);

      // Should use minimum of bid/ask
      expect(result.ratio).toBeGreaterThan(0);
    });
  });

  describe("weighted depth measure", () => {
    it("should calculate weighted depth correctly", () => {
      analyzer.updateOrderBook(createMockOrderBook());

      const trade = createMockTrade({ sizeUsd: 2000, direction: TradeDirection.BUY });
      const result = analyzer.analyzeRatio(trade, {
        liquidityMeasure: LiquidityMeasure.WEIGHTED_DEPTH,
      });

      expect(result.liquidityMeasure).toBe(LiquidityMeasure.WEIGHTED_DEPTH);
      expect(result.availableLiquidityUsd).toBeGreaterThan(0);
    });
  });

  describe("confidence calculation", () => {
    it("should have low confidence without order book", () => {
      const trade = createMockTrade({ marketId: "no-book", sizeUsd: 1000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.confidence).toBeLessThanOrEqual(0.1);
    });

    it("should have higher confidence with good order book data", () => {
      const goodOrderBook = createMockOrderBook({
        bidLevels: 20,
        askLevels: 20,
        spreadPercent: 1.0,
      });
      analyzer.updateOrderBook(goodOrderBook);

      const trade = createMockTrade({ sizeUsd: 1000 });
      const result = analyzer.analyzeRatio(trade);

      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("price impact estimation", () => {
    it("should cap price impact at reasonable maximum", () => {
      analyzer.updateOrderBook(createMockOrderBook({ askVolumeAt2Percent: 100 }));

      const trade = createMockTrade({ sizeUsd: 10000 }); // Very high ratio
      const result = analyzer.analyzeRatio(trade);

      expect(result.estimatedPriceImpactPercent).toBeLessThanOrEqual(50);
    });
  });

  describe("alert context", () => {
    it("should include context in alerts", () => {
      analyzer.updateOrderBook(createMockOrderBook());

      // First high ratio trade
      const trade1 = createMockTrade({
        walletAddress: "0xwallet1",
        sizeUsd: 20000,
      });
      analyzer.analyzeRatio(trade1);

      // Second from same wallet
      const trade2 = createMockTrade({
        walletAddress: "0xwallet1",
        sizeUsd: 30000,
      });
      analyzer.analyzeRatio(trade2);

      const alerts = analyzer.getRecentAlerts();
      const secondAlert = alerts[1];

      expect(secondAlert!.context.previousHighRatio).not.toBeNull();
    });
  });
});
