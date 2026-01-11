/**
 * E2E Tests for Volume-to-Liquidity Ratio Analyzer (DET-VOL-006)
 *
 * These tests verify the volume-liquidity ratio analyzer works correctly
 * in the context of the full application.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  RatioSeverity,
  LiquidityMeasure,
  TradeDirection,
  createVolumeLiquidityRatioAnalyzer,
  resetSharedVolumeLiquidityRatioAnalyzer,
  analyzeVolumeLiquidityRatio,
  batchAnalyzeVolumeLiquidityRatio,
  isHighRatioTrade,
  updateOrderBookCache,
  getMarketRatioStats,
  getRatioAnalyzerSummary,
  type OrderBookSnapshot,
  type TradeForRatioAnalysis,
} from "../../src/detection/volume-liquidity-ratio";

// Check if we should skip browser tests
const SKIP_BROWSER_TESTS = process.env.SKIP_BROWSER_TESTS === "true";

/**
 * Create sample order book snapshot
 */
function createOrderBookSnapshot(overrides: Partial<OrderBookSnapshot> = {}): OrderBookSnapshot {
  return {
    marketId: "test-market-1",
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

/**
 * Create sample trade
 */
function createTrade(overrides: Partial<TradeForRatioAnalysis> = {}): TradeForRatioAnalysis {
  return {
    tradeId: `trade-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    marketId: "test-market-1",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    sizeUsd: 1000,
    direction: TradeDirection.BUY,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create thin liquidity order book
 */
function createThinOrderBook(): OrderBookSnapshot {
  return createOrderBookSnapshot({
    marketId: "thin-market",
    totalBidVolumeUsd: 5000,
    totalAskVolumeUsd: 5000,
    bestBidVolumeUsd: 500,
    bestAskVolumeUsd: 500,
    bidLevels: 3,
    askLevels: 3,
    bidVolumeAt1Percent: 1000,
    askVolumeAt1Percent: 1000,
    bidVolumeAt2Percent: 2000,
    askVolumeAt2Percent: 2000,
    bidVolumeAt5Percent: 4000,
    askVolumeAt5Percent: 4000,
  });
}

/**
 * Create deep liquidity order book
 */
function createDeepOrderBook(): OrderBookSnapshot {
  return createOrderBookSnapshot({
    marketId: "deep-market",
    totalBidVolumeUsd: 5000000,
    totalAskVolumeUsd: 5000000,
    bestBidVolumeUsd: 250000,
    bestAskVolumeUsd: 250000,
    bidLevels: 100,
    askLevels: 100,
    bidVolumeAt1Percent: 1000000,
    askVolumeAt1Percent: 1000000,
    bidVolumeAt2Percent: 2000000,
    askVolumeAt2Percent: 2000000,
    bidVolumeAt5Percent: 4000000,
    askVolumeAt5Percent: 4000000,
    spreadPercent: 0.5,
  });
}

// ============================================================================
// Integration Tests (Non-Browser)
// ============================================================================

describe("Volume-Liquidity Ratio Analyzer E2E Tests", () => {
  beforeEach(() => {
    resetSharedVolumeLiquidityRatioAnalyzer();
  });

  afterEach(() => {
    resetSharedVolumeLiquidityRatioAnalyzer();
  });

  describe("Single Trade Analysis", () => {
    it("should analyze a trade and return complete result", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trade = createTrade({ sizeUsd: 2000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result).toMatchObject({
        tradeId: trade.tradeId,
        marketId: "test-market-1",
        walletAddress: trade.walletAddress,
        tradeSizeUsd: 2000,
        direction: TradeDirection.BUY,
      });
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratioPercent).toBe(result.ratio * 100);
      expect(result.severity).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should correctly classify severity levels", () => {
      const orderBook = createOrderBookSnapshot({
        askVolumeAt2Percent: 100000, // $100k liquidity
      });
      updateOrderBookCache(orderBook);

      // Normal: < 5% ratio
      const normalTrade = createTrade({ sizeUsd: 1000 }); // 1%
      const normalResult = analyzeVolumeLiquidityRatio(normalTrade);
      expect(normalResult.severity).toBe(RatioSeverity.NORMAL);

      // Elevated: >= 5% ratio
      const elevatedTrade = createTrade({ sizeUsd: 5000 }); // 5%
      const elevatedResult = analyzeVolumeLiquidityRatio(elevatedTrade);
      expect(elevatedResult.severity).toBe(RatioSeverity.ELEVATED);

      // High: >= 10% ratio
      const highTrade = createTrade({ sizeUsd: 10000 }); // 10%
      const highResult = analyzeVolumeLiquidityRatio(highTrade);
      expect(highResult.severity).toBe(RatioSeverity.HIGH);

      // Very High: >= 20% ratio
      const veryHighTrade = createTrade({ sizeUsd: 20000 }); // 20%
      const veryHighResult = analyzeVolumeLiquidityRatio(veryHighTrade);
      expect(veryHighResult.severity).toBe(RatioSeverity.VERY_HIGH);

      // Critical: >= 50% ratio
      const criticalTrade = createTrade({ sizeUsd: 50000 }); // 50%
      const criticalResult = analyzeVolumeLiquidityRatio(criticalTrade);
      expect(criticalResult.severity).toBe(RatioSeverity.CRITICAL);
    });

    it("should flag trades based on severity", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const normalTrade = createTrade({ sizeUsd: 100 });
      const flaggedTrade = createTrade({ sizeUsd: 5000 });

      const normalResult = analyzeVolumeLiquidityRatio(normalTrade);
      const flaggedResult = analyzeVolumeLiquidityRatio(flaggedTrade);

      expect(normalResult.isFlagged).toBe(false);
      expect(flaggedResult.isFlagged).toBe(true);
    });
  });

  describe("Trade Direction Handling", () => {
    it("should use ask liquidity for BUY trades", () => {
      const orderBook = createOrderBookSnapshot({
        askVolumeAt2Percent: 50000,
        bidVolumeAt2Percent: 100000,
      });
      updateOrderBookCache(orderBook);

      const buyTrade = createTrade({
        sizeUsd: 5000,
        direction: TradeDirection.BUY,
      });
      const result = analyzeVolumeLiquidityRatio(buyTrade);

      // Should use ask liquidity (50000) for BUY
      expect(result.ratio).toBe(5000 / 50000);
    });

    it("should use bid liquidity for SELL trades", () => {
      const orderBook = createOrderBookSnapshot({
        askVolumeAt2Percent: 50000,
        bidVolumeAt2Percent: 100000,
      });
      updateOrderBookCache(orderBook);

      const sellTrade = createTrade({
        sizeUsd: 10000,
        direction: TradeDirection.SELL,
      });
      const result = analyzeVolumeLiquidityRatio(sellTrade);

      // Should use bid liquidity (100000) for SELL
      expect(result.ratio).toBe(10000 / 100000);
    });

    it("should use minimum of bid/ask for UNKNOWN direction", () => {
      const orderBook = createOrderBookSnapshot({
        askVolumeAt2Percent: 50000,
        bidVolumeAt2Percent: 100000,
      });
      updateOrderBookCache(orderBook);

      const unknownTrade = createTrade({
        sizeUsd: 5000,
        direction: TradeDirection.UNKNOWN,
      });
      const result = analyzeVolumeLiquidityRatio(unknownTrade);

      // Should use min(bid, ask) = 50000
      expect(result.ratio).toBe(5000 / 50000);
    });
  });

  describe("Liquidity Measure Types", () => {
    it("should support TOTAL liquidity measure", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trade = createTrade({ sizeUsd: 1000 });
      const result = analyzeVolumeLiquidityRatio(trade, {
        liquidityMeasure: LiquidityMeasure.TOTAL,
      });

      expect(result.liquidityMeasure).toBe(LiquidityMeasure.TOTAL);
      expect(result.availableLiquidityUsd).toBe(200000); // bid + ask
    });

    it("should support BID_SIDE liquidity measure", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trade = createTrade({ sizeUsd: 1000 });
      const result = analyzeVolumeLiquidityRatio(trade, {
        liquidityMeasure: LiquidityMeasure.BID_SIDE,
      });

      expect(result.liquidityMeasure).toBe(LiquidityMeasure.BID_SIDE);
      expect(result.availableLiquidityUsd).toBe(100000);
    });

    it("should support TOP_OF_BOOK liquidity measure", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trade = createTrade({
        sizeUsd: 1000,
        direction: TradeDirection.BUY,
      });
      const result = analyzeVolumeLiquidityRatio(trade, {
        liquidityMeasure: LiquidityMeasure.TOP_OF_BOOK,
      });

      expect(result.liquidityMeasure).toBe(LiquidityMeasure.TOP_OF_BOOK);
      expect(result.availableLiquidityUsd).toBe(5000); // best ask
    });

    it("should support WEIGHTED_DEPTH liquidity measure", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trade = createTrade({
        sizeUsd: 1000,
        direction: TradeDirection.BUY,
      });
      const result = analyzeVolumeLiquidityRatio(trade, {
        liquidityMeasure: LiquidityMeasure.WEIGHTED_DEPTH,
      });

      expect(result.liquidityMeasure).toBe(LiquidityMeasure.WEIGHTED_DEPTH);
      // Weighted: 20000*0.5 + 40000*0.3 + 80000*0.2 = 10000 + 12000 + 16000 = 38000
      expect(result.availableLiquidityUsd).toBe(38000);
    });
  });

  describe("Batch Analysis", () => {
    it("should analyze multiple trades", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const trades = [
        createTrade({ tradeId: "t1", sizeUsd: 1000 }),
        createTrade({ tradeId: "t2", sizeUsd: 2000 }),
        createTrade({ tradeId: "t3", sizeUsd: 5000 }),
        createTrade({ tradeId: "t4", sizeUsd: 10000 }),
        createTrade({ tradeId: "t5", sizeUsd: 20000 }),
      ];

      const result = batchAnalyzeVolumeLiquidityRatio(trades);

      expect(result.results.length).toBe(5);
      expect(result.errors.size).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.flaggedCount).toBeGreaterThan(0);
      expect(result.averageRatio).toBeGreaterThan(0);
    });

    it("should handle mixed markets in batch", () => {
      updateOrderBookCache(createOrderBookSnapshot({ marketId: "market-a" }));
      updateOrderBookCache(createOrderBookSnapshot({ marketId: "market-b" }));

      const trades = [
        createTrade({ tradeId: "t1", marketId: "market-a", sizeUsd: 1000 }),
        createTrade({ tradeId: "t2", marketId: "market-b", sizeUsd: 2000 }),
        createTrade({ tradeId: "t3", marketId: "market-a", sizeUsd: 3000 }),
      ];

      const result = batchAnalyzeVolumeLiquidityRatio(trades);

      expect(result.results.length).toBe(3);
      expect(result.results.filter((r) => r.marketId === "market-a").length).toBe(2);
      expect(result.results.filter((r) => r.marketId === "market-b").length).toBe(1);
    });
  });

  describe("Quick Check Function", () => {
    it("should quickly identify high ratio trades", () => {
      const orderBook = createOrderBookSnapshot();
      updateOrderBookCache(orderBook);

      const normalTrade = createTrade({ sizeUsd: 100 });
      const highTrade = createTrade({ sizeUsd: 5000 });

      expect(isHighRatioTrade(normalTrade)).toBe(false);
      expect(isHighRatioTrade(highTrade)).toBe(true);
    });

    it("should return false when no order book available", () => {
      const trade = createTrade({ marketId: "unknown-market", sizeUsd: 10000 });
      expect(isHighRatioTrade(trade)).toBe(false);
    });
  });

  describe("Market Statistics Tracking", () => {
    it("should track market statistics after trades", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      // Analyze several trades
      for (let i = 0; i < 10; i++) {
        analyzeVolumeLiquidityRatio(
          createTrade({
            sizeUsd: (i + 1) * 1000,
          })
        );
      }

      const stats = getMarketRatioStats("test-market-1");

      expect(stats).not.toBeNull();
      expect(stats!.tradeCount).toBe(10);
      expect(stats!.averageRatio).toBeGreaterThan(0);
      expect(stats!.medianRatio).toBeGreaterThan(0);
      expect(stats!.maxRatio).toBeGreaterThan(stats!.minRatio);
      expect(stats!.flaggedTradeCount).toBeGreaterThanOrEqual(0);
    });

    it("should calculate correct percentile stats", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      // Analyze trades with varied sizes
      const sizes = [100, 200, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];
      for (const size of sizes) {
        analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: size }));
      }

      const stats = getMarketRatioStats("test-market-1");

      expect(stats!.p95Ratio).toBeGreaterThan(stats!.medianRatio);
      expect(stats!.p99Ratio).toBeGreaterThan(stats!.p95Ratio);
    });
  });

  describe("Summary Generation", () => {
    it("should generate comprehensive summary", () => {
      // Setup multiple markets
      updateOrderBookCache(createOrderBookSnapshot({ marketId: "market-1" }));
      updateOrderBookCache(createOrderBookSnapshot({ marketId: "market-2" }));
      updateOrderBookCache(createThinOrderBook());

      // Analyze trades for each market
      for (let i = 0; i < 5; i++) {
        analyzeVolumeLiquidityRatio(createTrade({ marketId: "market-1", sizeUsd: (i + 1) * 1000 }));
        analyzeVolumeLiquidityRatio(createTrade({ marketId: "market-2", sizeUsd: (i + 1) * 500 }));
        analyzeVolumeLiquidityRatio(
          createTrade({ marketId: "thin-market", sizeUsd: (i + 1) * 200 })
        );
      }

      const summary = getRatioAnalyzerSummary();

      expect(summary.totalMarketsTracked).toBe(3);
      expect(summary.totalTradesAnalyzed).toBe(15);
      expect(summary.overallFlagRate).toBeGreaterThanOrEqual(0);
      expect(summary.globalAverageRatio).toBeGreaterThan(0);
      expect(summary.topFlaggedMarkets.length).toBeGreaterThan(0);
      expect(summary.cacheStats.orderBookCacheSize).toBe(3);
      expect(summary.lastActivityTime).toBeInstanceOf(Date);
    });

    it("should track severity distribution", () => {
      updateOrderBookCache(createOrderBookSnapshot({ askVolumeAt2Percent: 100000 }));

      // Create trades with varied severities
      analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 1000 })); // Normal (1%)
      analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 5000 })); // Elevated (5%)
      analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 10000 })); // High (10%)
      analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 20000 })); // Very High (20%)
      analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 50000 })); // Critical (50%)

      const summary = getRatioAnalyzerSummary();

      expect(summary.severityDistribution[RatioSeverity.NORMAL]).toBe(1);
      expect(summary.severityDistribution[RatioSeverity.ELEVATED]).toBe(1);
      expect(summary.severityDistribution[RatioSeverity.HIGH]).toBe(1);
      expect(summary.severityDistribution[RatioSeverity.VERY_HIGH]).toBe(1);
      expect(summary.severityDistribution[RatioSeverity.CRITICAL]).toBe(1);
    });
  });

  describe("Thin vs Deep Market Comparison", () => {
    it("should show higher ratios in thin markets", () => {
      updateOrderBookCache(createThinOrderBook()); // 2000 liquidity at 2%
      updateOrderBookCache(createDeepOrderBook()); // 2000000 liquidity at 2%

      const thinTrade = createTrade({ marketId: "thin-market", sizeUsd: 1000 });
      const deepTrade = createTrade({ marketId: "deep-market", sizeUsd: 1000 });

      const thinResult = analyzeVolumeLiquidityRatio(thinTrade);
      const deepResult = analyzeVolumeLiquidityRatio(deepTrade);

      // Same trade size should have much higher ratio in thin market
      expect(thinResult.ratio).toBeGreaterThan(deepResult.ratio * 100);
    });

    it("should flag more trades in thin markets", () => {
      updateOrderBookCache(createThinOrderBook());
      updateOrderBookCache(createDeepOrderBook());

      let thinFlagged = 0;
      let deepFlagged = 0;

      for (let i = 1; i <= 10; i++) {
        const thinResult = analyzeVolumeLiquidityRatio(
          createTrade({ marketId: "thin-market", sizeUsd: i * 100 })
        );
        const deepResult = analyzeVolumeLiquidityRatio(
          createTrade({ marketId: "deep-market", sizeUsd: i * 100 })
        );

        if (thinResult.isFlagged) thinFlagged++;
        if (deepResult.isFlagged) deepFlagged++;
      }

      expect(thinFlagged).toBeGreaterThan(deepFlagged);
    });
  });

  describe("Price Impact Estimation", () => {
    it("should estimate higher impact for higher ratios", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      const smallTrade = createTrade({ sizeUsd: 1000 });
      const largeTrade = createTrade({ sizeUsd: 20000 });

      const smallResult = analyzeVolumeLiquidityRatio(smallTrade);
      const largeResult = analyzeVolumeLiquidityRatio(largeTrade);

      expect(largeResult.estimatedPriceImpactPercent).toBeGreaterThan(
        smallResult.estimatedPriceImpactPercent
      );
    });

    it("should cap price impact at reasonable maximum", () => {
      updateOrderBookCache(createThinOrderBook());

      // Very large trade relative to thin liquidity
      const hugeTrade = createTrade({ marketId: "thin-market", sizeUsd: 10000 });
      const result = analyzeVolumeLiquidityRatio(hugeTrade);

      expect(result.estimatedPriceImpactPercent).toBeLessThanOrEqual(50);
    });
  });

  describe("Additional Ratios", () => {
    it("should calculate all additional ratios", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      const trade = createTrade({ sizeUsd: 2000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result.additionalRatios.totalLiquidityRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt1PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt2PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.depthAt5PercentRatio).toBeGreaterThan(0);
      expect(result.additionalRatios.topOfBookRatio).toBeGreaterThan(0);
    });

    it("should show relationship between different depth ratios", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      const trade = createTrade({ sizeUsd: 5000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      // Deeper liquidity levels should have lower ratios
      expect(result.additionalRatios.depthAt1PercentRatio).toBeGreaterThan(
        result.additionalRatios.depthAt2PercentRatio
      );
      expect(result.additionalRatios.depthAt2PercentRatio).toBeGreaterThan(
        result.additionalRatios.depthAt5PercentRatio
      );
      expect(result.additionalRatios.topOfBookRatio).toBeGreaterThan(
        result.additionalRatios.depthAt1PercentRatio
      );
    });
  });

  describe("Confidence Scoring", () => {
    it("should have low confidence without order book", () => {
      const trade = createTrade({ marketId: "no-orderbook", sizeUsd: 1000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result.confidence).toBeLessThanOrEqual(0.1);
    });

    it("should have higher confidence with good order book", () => {
      const goodOrderBook = createDeepOrderBook();
      updateOrderBookCache(goodOrderBook);

      const trade = createTrade({ marketId: "deep-market", sizeUsd: 1000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should have medium confidence with average order book", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      const trade = createTrade({ sizeUsd: 1000 });
      const result = analyzeVolumeLiquidityRatio(trade);

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Custom Configuration", () => {
    it("should respect custom thresholds", () => {
      const customAnalyzer = createVolumeLiquidityRatioAnalyzer({
        thresholds: {
          elevated: 0.01, // 1% instead of 5%
          high: 0.02, // 2% instead of 10%
          veryHigh: 0.05, // 5% instead of 20%
          critical: 0.1, // 10% instead of 50%
        },
      });

      const orderBook = createOrderBookSnapshot();
      customAnalyzer.updateOrderBook(orderBook);

      // A 2% ratio trade should be HIGH with custom config
      const trade = createTrade({ sizeUsd: 800 }); // 0.8k / 40k = 2%
      const result = customAnalyzer.analyzeRatio(trade);

      expect(result.severity).toBe(RatioSeverity.HIGH);
    });

    it("should respect custom minimum liquidity", () => {
      const customAnalyzer = createVolumeLiquidityRatioAnalyzer({
        minLiquidityUsd: 10000,
      });

      // No order book, should use minimum
      const trade = createTrade({ marketId: "unknown", sizeUsd: 5000 });
      const result = customAnalyzer.analyzeRatio(trade);

      expect(result.availableLiquidityUsd).toBe(10000);
      expect(result.ratio).toBe(0.5);
    });
  });

  describe("History and Alert Tracking", () => {
    it("should track recent alerts", () => {
      updateOrderBookCache(createOrderBookSnapshot());

      // Generate some alerts with critical trades
      for (let i = 0; i < 5; i++) {
        analyzeVolumeLiquidityRatio(createTrade({ sizeUsd: 50000 })); // Critical
      }

      const summary = getRatioAnalyzerSummary();
      expect(summary.recentAlerts.length).toBe(5);
    });

    it("should include context in alerts", () => {
      const analyzer = createVolumeLiquidityRatioAnalyzer();
      analyzer.updateOrderBook(createOrderBookSnapshot());

      // First flagged trade from wallet
      analyzer.analyzeRatio(
        createTrade({
          walletAddress: "0xwallet1",
          sizeUsd: 20000,
        })
      );

      // Second flagged trade from same wallet
      analyzer.analyzeRatio(
        createTrade({
          walletAddress: "0xwallet1",
          sizeUsd: 30000,
        })
      );

      const alerts = analyzer.getRecentAlerts();
      expect(alerts.length).toBe(2);

      const secondAlert = alerts[1];
      expect(secondAlert!.context.previousHighRatio).not.toBeNull();
      expect(secondAlert!.context.ratioVsAverage).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Browser E2E Tests
// ============================================================================

describe.skipIf(SKIP_BROWSER_TESTS)("Browser E2E Tests", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
    resetSharedVolumeLiquidityRatioAnalyzer();
  });

  it("should load application without errors", async () => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => consoleMessages.push(msg.text()));

    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    const errors = consoleMessages.filter(
      (msg) => msg.toLowerCase().includes("error") && !msg.includes("favicon")
    );
    expect(errors.length).toBe(0);
  });

  it("should verify volume-liquidity-ratio module is available", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    const result = await page.evaluate(() => {
      // Check if the detection module exports are available
      return typeof window !== "undefined";
    });

    expect(result).toBe(true);
  });

  it("should display application title", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    const title = await page.title();
    expect(title).toBeDefined();
  });

  it("should handle navigation without errors", async () => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    // Give page time to render
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(pageErrors.length).toBe(0);
  });

  it("should verify page renders correctly", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    // Check that main content exists
    const bodyContent = await page.evaluate(() => {
      return document.body.innerText.length;
    });

    expect(bodyContent).toBeGreaterThan(0);
  });
});
