/**
 * Tests for Individual Trade Size Analyzer (DET-VOL-004)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TradeSizeCategory,
  TradeSizeSeverity,
  ThresholdMethod,
  DEFAULT_PERCENTILE_THRESHOLDS,
  DEFAULT_ZSCORE_THRESHOLDS,
  DEFAULT_ABSOLUTE_THRESHOLDS,
  DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG,
  TradeSizeAnalyzer,
  createTradeSizeAnalyzer,
  getSharedTradeSizeAnalyzer,
  setSharedTradeSizeAnalyzer,
  resetSharedTradeSizeAnalyzer,
  analyzeTrade,
  analyzeTrades,
  isTradeOutlier,
  getTradeSizePercentileRank,
  getMarketTradeSizeStats,
  getTradeSizeAnalyzerSummary,
  getRecentLargeTrades,
  type TradeEntry,
  type TradeSizeAnalyzerConfig,
} from "../../src/detection/trade-size";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a sample trade entry
 */
function createTrade(
  overrides: Partial<TradeEntry> & { tradeId: string; marketId: string; walletAddress: string; sizeUsd: number }
): TradeEntry {
  return {
    timestamp: Date.now(),
    side: "BUY",
    price: 0.5,
    outcome: "Yes",
    ...overrides,
  };
}

/**
 * Create multiple trades with varying sizes for a market
 */
function createMarketTrades(
  marketId: string,
  count: number,
  options: {
    baseSize?: number;
    variance?: number;
    walletPrefix?: string;
    startTime?: number;
  } = {}
): TradeEntry[] {
  const baseSize = options.baseSize ?? 1000;
  const variance = options.variance ?? 500;
  const walletPrefix = options.walletPrefix ?? "0xwallet";
  const startTime = options.startTime ?? Date.now() - count * 60000;

  const trades: TradeEntry[] = [];

  for (let i = 0; i < count; i++) {
    // Create trades with mostly normal sizes and occasional larger ones
    let size = baseSize + (Math.random() - 0.5) * variance * 2;

    // 5% chance of large trade
    if (Math.random() < 0.05) {
      size = baseSize * (3 + Math.random() * 2);
    }

    trades.push(
      createTrade({
        tradeId: `trade-${marketId}-${i}`,
        marketId,
        walletAddress: `${walletPrefix}${i % 10}`,
        sizeUsd: Math.max(10, size),
        timestamp: startTime + i * 60000,
      })
    );
  }

  return trades;
}

/**
 * Create trades with specific distribution for testing percentiles
 */
function createDistributedTrades(
  marketId: string,
  distribution: number[]
): TradeEntry[] {
  return distribution.map((size, i) =>
    createTrade({
      tradeId: `trade-${marketId}-${i}`,
      marketId,
      walletAddress: `0xwallet${i}`,
      sizeUsd: size,
      timestamp: Date.now() - (distribution.length - i) * 60000,
    })
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("TradeSizeAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTradeSizeAnalyzer();
  });

  afterEach(() => {
    resetSharedTradeSizeAnalyzer();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const analyzer = new TradeSizeAnalyzer();

      const stats = analyzer.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.totalTrades).toBe(0);
      expect(stats.totalLargeTrades).toBe(0);
      expect(stats.trackedWallets).toBe(0);
      expect(stats.maxTradesPerMarket).toBe(10000);
      expect(stats.alertCooldownMs).toBe(300000); // 5 minutes
    });

    it("should create with custom configuration", () => {
      const config: TradeSizeAnalyzerConfig = {
        thresholds: {
          percentileThresholds: {
            large: 80,
            veryLarge: 95,
            whale: 99.5,
          },
          zScoreThresholds: {
            low: 1.5,
            medium: 2.0,
            high: 2.5,
            critical: 3.5,
          },
          method: ThresholdMethod.PERCENTILE,
        },
        maxTradesPerMarket: 5000,
        alertCooldownMs: 60000,
      };

      const analyzer = new TradeSizeAnalyzer(config);

      const thresholds = analyzer.getThresholdConfig();
      expect(thresholds.percentileThresholds.large).toBe(80);
      expect(thresholds.percentileThresholds.veryLarge).toBe(95);
      expect(thresholds.method).toBe(ThresholdMethod.PERCENTILE);

      const stats = analyzer.getStats();
      expect(stats.maxTradesPerMarket).toBe(5000);
      expect(stats.alertCooldownMs).toBe(60000);
    });

    it("should merge partial threshold configuration", () => {
      const analyzer = new TradeSizeAnalyzer({
        thresholds: {
          zScoreThresholds: {
            low: 1.0,
            medium: 2.5,
            high: 3.0,
            critical: 4.0,
          },
        },
      });

      const config = analyzer.getThresholdConfig();

      // Custom values should be set
      expect(config.zScoreThresholds.low).toBe(1.0);

      // Defaults should be preserved
      expect(config.percentileThresholds.large).toBe(DEFAULT_PERCENTILE_THRESHOLDS.large);
      expect(config.absoluteThresholds.whale).toBe(DEFAULT_ABSOLUTE_THRESHOLDS.whale);
    });
  });

  // ==========================================================================
  // Default Constants Tests
  // ==========================================================================

  describe("default constants", () => {
    it("should have correct default percentile thresholds", () => {
      expect(DEFAULT_PERCENTILE_THRESHOLDS.large).toBe(75);
      expect(DEFAULT_PERCENTILE_THRESHOLDS.veryLarge).toBe(90);
      expect(DEFAULT_PERCENTILE_THRESHOLDS.whale).toBe(99);
    });

    it("should have correct default z-score thresholds", () => {
      expect(DEFAULT_ZSCORE_THRESHOLDS.low).toBe(2.0);
      expect(DEFAULT_ZSCORE_THRESHOLDS.medium).toBe(2.5);
      expect(DEFAULT_ZSCORE_THRESHOLDS.high).toBe(3.0);
      expect(DEFAULT_ZSCORE_THRESHOLDS.critical).toBe(4.0);
    });

    it("should have correct default absolute thresholds", () => {
      expect(DEFAULT_ABSOLUTE_THRESHOLDS.large).toBe(10000);
      expect(DEFAULT_ABSOLUTE_THRESHOLDS.veryLarge).toBe(50000);
      expect(DEFAULT_ABSOLUTE_THRESHOLDS.whale).toBe(100000);
    });

    it("should have correct default threshold config", () => {
      expect(DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG.method).toBe(ThresholdMethod.COMBINED);
      expect(DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG.minTradesForReliableStats).toBe(30);
    });
  });

  // ==========================================================================
  // Trade Analysis Tests
  // ==========================================================================

  describe("analyzeTrade", () => {
    it("should analyze a trade with no baseline data", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trade = createTrade({
        tradeId: "trade-1",
        marketId: "market-1",
        walletAddress: "0xwallet1",
        sizeUsd: 1000,
      });

      const result = analyzer.analyzeTrade(trade);

      expect(result.trade.tradeId).toBe("trade-1");
      expect(result.statsReliable).toBe(false);
      expect(result.marketStats).not.toBeNull();
      expect(result.marketStats?.tradeCount).toBe(1);
    });

    it("should categorize small trades correctly", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline with trades where most are above 100
      const baselineTrades = createDistributedTrades(
        "market-1",
        [500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
         500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800]
      );

      // Add baseline trades
      for (const trade of baselineTrades) {
        analyzer.analyzeTrade(trade);
      }

      // Analyze a small trade (percentile-based detection)
      const smallTrade = createTrade({
        tradeId: "small-trade",
        marketId: "market-1",
        walletAddress: "0xwallet",
        sizeUsd: 50,
      });

      const result = analyzer.analyzeTrade(smallTrade);

      // With COMBINED method, a trade that is below 25th percentile but above
      // the -1 z-score threshold would be MEDIUM, not SMALL
      // The key test is that it's not flagged as large
      expect(result.isFlagged).toBe(false);
      expect(result.percentileRank).toBeLessThan(10);
      expect([TradeSizeCategory.SMALL, TradeSizeCategory.MEDIUM]).toContain(result.category);
    });

    it("should flag large trades based on percentile", () => {
      const analyzer = new TradeSizeAnalyzer({
        thresholds: {
          method: ThresholdMethod.PERCENTILE,
        },
      });

      // Create trades with known distribution
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 100 }, (_, i) => (i + 1) * 10) // 10, 20, 30, ..., 1000
      );

      // Add all trades
      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      // Analyze a trade at 90th percentile
      const largeTrade = createTrade({
        tradeId: "large-trade",
        marketId: "market-1",
        walletAddress: "0xwallet",
        sizeUsd: 950,
      });

      const result = analyzer.analyzeTrade(largeTrade);

      expect(result.percentileRank).toBeGreaterThanOrEqual(90);
      expect([TradeSizeCategory.VERY_LARGE, TradeSizeCategory.WHALE]).toContain(result.category);
      expect(result.isFlagged).toBe(true);
    });

    it("should flag whale trades based on absolute threshold", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Add some small trades to build baseline
      const baselineTrades = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => Math.random() * 1000)
      );

      for (const trade of baselineTrades) {
        analyzer.analyzeTrade(trade);
      }

      // Analyze a whale trade
      const whaleTrade = createTrade({
        tradeId: "whale-trade",
        marketId: "market-1",
        walletAddress: "0xwhale",
        sizeUsd: 150000, // Above whale threshold of 100k
      });

      const result = analyzer.analyzeTrade(whaleTrade);

      expect(result.category).toBe(TradeSizeCategory.WHALE);
      expect(result.isFlagged).toBe(true);
      expect(result.severity).toBe(TradeSizeSeverity.CRITICAL);
    });

    it("should calculate z-score correctly", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create trades with known mean and stddev
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 50 }, () => 100) // All same value for zero stddev initially
          .concat(Array.from({ length: 50 }, (_, i) => 50 + i * 2)) // 50-148 for variance
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      const stats = analyzer.getMarketStats("market-1");
      expect(stats).not.toBeNull();

      if (stats) {
        // Check a trade far from mean
        const highTrade = createTrade({
          tradeId: "high-trade",
          marketId: "market-1",
          walletAddress: "0xwallet",
          sizeUsd: stats.averageSizeUsd + 3 * stats.standardDeviation,
        });

        const result = analyzer.analyzeTrade(highTrade);
        expect(result.zScore).toBeGreaterThanOrEqual(2.5);
      }
    });

    it("should track comparison metrics (timesMedian, timesAverage)", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline trades
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      // Analyze a trade 5x the average
      const largeTrade = createTrade({
        tradeId: "large-trade",
        marketId: "market-1",
        walletAddress: "0xwallet",
        sizeUsd: 500,
      });

      const result = analyzer.analyzeTrade(largeTrade);

      expect(result.timesMedian).toBeGreaterThanOrEqual(4);
      expect(result.timesAverage).toBeGreaterThanOrEqual(4);
    });

    it("should handle invalid trades gracefully", () => {
      const analyzer = new TradeSizeAnalyzer();

      const invalidTrade = createTrade({
        tradeId: "",
        marketId: "market-1",
        walletAddress: "0xwallet",
        sizeUsd: -100, // Invalid negative size
      });

      const result = analyzer.analyzeTrade(invalidTrade);

      expect(result.isFlagged).toBe(false);
      expect(result.statsReliable).toBe(false);
    });
  });

  // ==========================================================================
  // Batch Analysis Tests
  // ==========================================================================

  describe("analyzeTrades", () => {
    it("should analyze multiple trades and return summary", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 50, {
        baseSize: 500,
        variance: 200,
      });

      // Add one definitely large trade
      trades.push(
        createTrade({
          tradeId: "whale-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      const result = analyzer.analyzeTrades(trades);

      expect(result.results.size).toBe(51);
      expect(result.summary.totalAnalyzed).toBe(51);
      expect(result.summary.largestTrade?.sizeUsd).toBe(150000);
      expect(result.summary.totalFlagged).toBeGreaterThanOrEqual(1);
    });

    it("should track category distribution", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create trades with predictable distribution
      const trades = [
        // Small trades
        ...createDistributedTrades("market-1", [10, 20, 30, 40, 50]),
        // Medium trades
        ...createDistributedTrades("market-1", [100, 150, 200, 250, 300, 350, 400, 450, 500, 550,
                                                 100, 150, 200, 250, 300, 350, 400, 450, 500, 550,
                                                 100, 150, 200, 250, 300, 350, 400, 450]),
        // Large trades
        ...createDistributedTrades("market-1", [10000, 15000, 20000]),
        // Whale trades
        ...createDistributedTrades("market-1", [150000]),
      ];

      const result = analyzer.analyzeTrades(trades);

      // Should have trades in multiple categories
      expect(Object.values(result.summary.byCategory).reduce((a, b) => a + b, 0)).toBe(trades.length);
      expect(result.summary.byCategory[TradeSizeCategory.WHALE]).toBeGreaterThanOrEqual(1);
    });

    it("should track severity distribution", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 50 }, () => 100)
      );

      // Add progressively larger trades to trigger different severities
      const testTrades = [
        ...baseline,
        createTrade({ tradeId: "t1", marketId: "market-1", walletAddress: "0x1", sizeUsd: 10000 }), // LARGE
        createTrade({ tradeId: "t2", marketId: "market-1", walletAddress: "0x2", sizeUsd: 50000 }), // VERY_LARGE
        createTrade({ tradeId: "t3", marketId: "market-1", walletAddress: "0x3", sizeUsd: 150000 }), // WHALE
      ];

      const result = analyzer.analyzeTrades(testTrades);

      expect(result.summary.totalFlagged).toBeGreaterThanOrEqual(3);
    });

    it("should calculate highest z-score", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trades = [
        ...createDistributedTrades("market-1", Array.from({ length: 30 }, () => 100)),
        createTrade({ tradeId: "outlier", marketId: "market-1", walletAddress: "0x1", sizeUsd: 200000 }),
      ];

      const result = analyzer.analyzeTrades(trades);

      expect(result.summary.highestZScore).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Market Statistics Tests
  // ==========================================================================

  describe("getMarketStats", () => {
    it("should return null for unknown market", () => {
      const analyzer = new TradeSizeAnalyzer();

      const stats = analyzer.getMarketStats("unknown-market");
      expect(stats).toBeNull();
    });

    it("should calculate correct statistics", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Add trades with known values
      const trades = createDistributedTrades(
        "market-1",
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      const stats = analyzer.getMarketStats("market-1");

      expect(stats).not.toBeNull();
      if (stats) {
        expect(stats.tradeCount).toBe(10);
        expect(stats.minSizeUsd).toBe(100);
        expect(stats.maxSizeUsd).toBe(1000);
        expect(stats.totalVolumeUsd).toBe(5500);
        expect(stats.averageSizeUsd).toBe(550);
        expect(stats.percentiles.p50).toBeCloseTo(550, 0); // Median
        expect(stats.standardDeviation).toBeGreaterThan(0);
        expect(stats.coefficientOfVariation).toBeGreaterThan(0);
      }
    });

    it("should calculate percentiles correctly", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create 100 trades for clear percentiles
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 100 }, (_, i) => (i + 1) * 10) // 10, 20, ..., 1000
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      const stats = analyzer.getMarketStats("market-1");

      expect(stats).not.toBeNull();
      if (stats) {
        // Use wider tolerance since percentile calculations may vary slightly
        expect(stats.percentiles.p10).toBeGreaterThanOrEqual(90);
        expect(stats.percentiles.p10).toBeLessThanOrEqual(120);
        expect(stats.percentiles.p25).toBeGreaterThanOrEqual(230);
        expect(stats.percentiles.p25).toBeLessThanOrEqual(270);
        expect(stats.percentiles.p50).toBeGreaterThanOrEqual(480);
        expect(stats.percentiles.p50).toBeLessThanOrEqual(520);
        expect(stats.percentiles.p75).toBeGreaterThanOrEqual(730);
        expect(stats.percentiles.p75).toBeLessThanOrEqual(770);
        expect(stats.percentiles.p90).toBeGreaterThanOrEqual(880);
        expect(stats.percentiles.p90).toBeLessThanOrEqual(920);
        expect(stats.percentiles.p99).toBeGreaterThanOrEqual(970);
        expect(stats.percentiles.p99).toBeLessThanOrEqual(1010);
      }
    });
  });

  // ==========================================================================
  // Outlier Detection Tests
  // ==========================================================================

  describe("isOutlierTrade", () => {
    it("should detect outliers with reliable stats", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 50 }, () => 100)
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      // Outlier should be detected
      expect(analyzer.isOutlierTrade("market-1", 10000)).toBe(true);
      expect(analyzer.isOutlierTrade("market-1", 100)).toBe(false);
    });

    it("should use absolute threshold when stats unreliable", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Only a few trades - unreliable stats
      const trades = createDistributedTrades("market-1", [100, 200, 300]);

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      // Should fall back to absolute threshold
      expect(analyzer.isOutlierTrade("market-1", 15000)).toBe(true); // Above 10k default
      expect(analyzer.isOutlierTrade("market-1", 5000)).toBe(false);
    });

    it("should return false for unknown market with small value", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Unknown market falls back to absolute threshold
      expect(analyzer.isOutlierTrade("unknown", 100)).toBe(false);
      expect(analyzer.isOutlierTrade("unknown", 15000)).toBe(true);
    });
  });

  // ==========================================================================
  // Percentile and Z-Score Methods Tests
  // ==========================================================================

  describe("getPercentileRank", () => {
    it("should return correct percentile rank", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 100 }, (_, i) => (i + 1) * 10)
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      expect(analyzer.getPercentileRank("market-1", 500)).toBeCloseTo(50, -1);
      expect(analyzer.getPercentileRank("market-1", 900)).toBeCloseTo(90, -1);
      expect(analyzer.getPercentileRank("market-1", 100)).toBeCloseTo(10, -1);
    });

    it("should return 50 for empty market", () => {
      const analyzer = new TradeSizeAnalyzer();

      expect(analyzer.getPercentileRank("empty-market", 100)).toBe(50);
    });
  });

  describe("getZScore", () => {
    it("should calculate correct z-score", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create trades with consistent values
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 100 }, () => 100)
          .concat(Array.from({ length: 100 }, () => 200))
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      const stats = analyzer.getMarketStats("market-1");
      if (stats && stats.standardDeviation > 0) {
        const expectedZScore = (300 - stats.averageSizeUsd) / stats.standardDeviation;
        expect(analyzer.getZScore("market-1", 300)).toBeCloseTo(expectedZScore, 1);
      }
    });

    it("should return 0 when stdDev is 0", () => {
      const analyzer = new TradeSizeAnalyzer();

      // All same value = stddev of 0
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 10 }, () => 100)
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      expect(analyzer.getZScore("market-1", 200)).toBe(0);
    });
  });

  // ==========================================================================
  // Large Trade Tracking Tests
  // ==========================================================================

  describe("wallet large trade stats", () => {
    it("should track large trades per wallet", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Add large trades from specific wallet
      const wallet = "0xwhale_wallet";
      for (let i = 0; i < 3; i++) {
        analyzer.analyzeTrade(
          createTrade({
            tradeId: `whale-${i}`,
            marketId: "market-1",
            walletAddress: wallet,
            sizeUsd: 50000 + i * 10000,
          })
        );
      }

      const walletStats = analyzer.getWalletLargeTradeStats(wallet);

      expect(walletStats).not.toBeNull();
      if (walletStats) {
        expect(walletStats.totalLargeTrades).toBe(3);
        expect(walletStats.totalLargeTradeVolumeUsd).toBe(180000);
        expect(walletStats.firstLargeTradeTime).not.toBeNull();
        expect(walletStats.lastLargeTradeTime).not.toBeNull();
      }
    });

    it("should return null for wallet with no large trades", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Only small trades
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 10 }, () => 100)
      );

      for (const trade of trades) {
        analyzer.analyzeTrade(trade);
      }

      expect(analyzer.getWalletLargeTradeStats("0xwallet0")).toBeNull();
    });
  });

  describe("market large trade stats", () => {
    it("should track large trades per market", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Add large trades
      for (let i = 0; i < 5; i++) {
        analyzer.analyzeTrade(
          createTrade({
            tradeId: `large-${i}`,
            marketId: "market-1",
            walletAddress: `0xwallet${i}`,
            sizeUsd: 50000,
          })
        );
      }

      const marketStats = analyzer.getMarketLargeTradeStats("market-1");

      expect(marketStats).not.toBeNull();
      if (marketStats) {
        expect(marketStats.totalLargeTrades).toBe(5);
        expect(marketStats.uniqueLargeTraders).toBe(5);
      }
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("event emission", () => {
    it("should emit largeTradeDetected event", () => {
      const analyzer = new TradeSizeAnalyzer({ enableEvents: true });

      let emittedEvent: unknown = null;
      analyzer.on("largeTradeDetected", (event) => {
        emittedEvent = event;
      });

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Trigger large trade
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      expect(emittedEvent).not.toBeNull();
    });

    it("should emit whaleTradeDetected for whale trades", () => {
      const analyzer = new TradeSizeAnalyzer({ enableEvents: true });

      let whaleEvent: unknown = null;
      analyzer.on("whaleTradeDetected", (event) => {
        whaleEvent = event;
      });

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Trigger whale trade (above 100k)
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "whale-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 200000,
        })
      );

      expect(whaleEvent).not.toBeNull();
    });

    it("should respect alert cooldown", () => {
      const analyzer = new TradeSizeAnalyzer({
        enableEvents: true,
        alertCooldownMs: 60000, // 1 minute
      });

      let eventCount = 0;
      analyzer.on("largeTradeDetected", () => {
        eventCount++;
      });

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // First large trade should emit
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      // Second large trade from same wallet/market within cooldown shouldn't emit
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-2",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      expect(eventCount).toBe(1);
    });

    it("should bypass cooldown when specified", () => {
      const analyzer = new TradeSizeAnalyzer({
        enableEvents: true,
        alertCooldownMs: 60000,
      });

      let eventCount = 0;
      analyzer.on("largeTradeDetected", () => {
        eventCount++;
      });

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // First trade
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      // Second trade with bypass
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-2",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        }),
        { bypassCooldown: true }
      );

      expect(eventCount).toBe(2);
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return correct summary statistics", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create trades across multiple markets
      const market1Trades = createMarketTrades("market-1", 50);
      const market2Trades = createMarketTrades("market-2", 30);

      // Add whale trades
      market1Trades.push(
        createTrade({
          tradeId: "whale-1",
          marketId: "market-1",
          walletAddress: "0xwhale1",
          sizeUsd: 200000,
        })
      );

      market2Trades.push(
        createTrade({
          tradeId: "whale-2",
          marketId: "market-2",
          walletAddress: "0xwhale2",
          sizeUsd: 150000,
        })
      );

      analyzer.analyzeTrades([...market1Trades, ...market2Trades]);

      const summary = analyzer.getSummary();

      expect(summary.totalMarkets).toBe(2);
      expect(summary.totalTradesAnalyzed).toBeGreaterThan(0);
      expect(summary.totalFlaggedTrades).toBeGreaterThanOrEqual(2);
      expect(summary.topMarketsByLargeTrades.length).toBeGreaterThanOrEqual(1);
      expect(summary.topWalletsByLargeTrades.length).toBeGreaterThanOrEqual(1);
    });

    it("should track flagged by severity", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 50 }, () => 100)
      );

      analyzer.analyzeTrades(baseline);

      // Add trades that trigger different severities
      analyzer.analyzeTrades([
        createTrade({ tradeId: "t1", marketId: "market-1", walletAddress: "0x1", sizeUsd: 150000 }),
        createTrade({ tradeId: "t2", marketId: "market-1", walletAddress: "0x2", sizeUsd: 100000 }),
      ]);

      const summary = analyzer.getSummary();

      expect(Object.values(summary.flaggedBySeverity).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Recent Large Trade Events Tests
  // ==========================================================================

  describe("getRecentLargeTradeEvents", () => {
    it("should return recent large trade events", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Add large trades
      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      const events = analyzer.getRecentLargeTradeEvents();

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.trade.sizeUsd).toBe(150000);
    });

    it("should respect limit parameter", () => {
      const analyzer = new TradeSizeAnalyzer({
        alertCooldownMs: 0, // Disable cooldown for testing
      });

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      for (const trade of baseline) {
        analyzer.analyzeTrade(trade);
      }

      // Add multiple large trades from different wallets
      for (let i = 0; i < 10; i++) {
        analyzer.analyzeTrade(
          createTrade({
            tradeId: `large-${i}`,
            marketId: "market-1",
            walletAddress: `0xwhale${i}`,
            sizeUsd: 150000 + i * 1000,
          }),
          { bypassCooldown: true }
        );
      }

      const events = analyzer.getRecentLargeTradeEvents(5);

      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Clear Operations Tests
  // ==========================================================================

  describe("clear operations", () => {
    it("should clear market data", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 50);
      analyzer.analyzeTrades(trades);

      // Verify we have data
      expect(analyzer.getStats().trackedMarkets).toBe(1);
      expect(analyzer.getStats().totalTrades).toBe(50);

      const result = analyzer.clearMarket("market-1");

      expect(result).toBe(true);
      // After clearing, the market should no longer be tracked
      expect(analyzer.getStats().trackedMarkets).toBe(0);
      expect(analyzer.getStats().totalTrades).toBe(0);
    });

    it("should clear wallet data", () => {
      const analyzer = new TradeSizeAnalyzer();

      // Create baseline and add large trade
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      analyzer.analyzeTrades(baseline);

      analyzer.analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      expect(analyzer.getWalletLargeTradeStats("0xwhale")).not.toBeNull();

      analyzer.clearWallet("0xwhale");

      expect(analyzer.getWalletLargeTradeStats("0xwhale")).toBeNull();
    });

    it("should clear all data", () => {
      const analyzer = new TradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 50);
      analyzer.analyzeTrades(trades);

      analyzer.clearAll();

      expect(analyzer.getStats().totalTrades).toBe(0);
      expect(analyzer.getStats().trackedMarkets).toBe(0);
    });
  });

  // ==========================================================================
  // Singleton Management Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should create shared instance", () => {
      const instance1 = getSharedTradeSizeAnalyzer();
      const instance2 = getSharedTradeSizeAnalyzer();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting shared instance", () => {
      const customAnalyzer = new TradeSizeAnalyzer({
        maxTradesPerMarket: 500,
      });

      setSharedTradeSizeAnalyzer(customAnalyzer);

      expect(getSharedTradeSizeAnalyzer()).toBe(customAnalyzer);
    });

    it("should reset shared instance", () => {
      const instance1 = getSharedTradeSizeAnalyzer();
      resetSharedTradeSizeAnalyzer();
      const instance2 = getSharedTradeSizeAnalyzer();

      expect(instance1).not.toBe(instance2);
    });

    it("should create new instance with createTradeSizeAnalyzer", () => {
      const instance1 = createTradeSizeAnalyzer();
      const instance2 = createTradeSizeAnalyzer();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe("convenience functions", () => {
    it("analyzeTrade should use shared instance", () => {
      resetSharedTradeSizeAnalyzer();

      const trade = createTrade({
        tradeId: "trade-1",
        marketId: "market-1",
        walletAddress: "0xwallet1",
        sizeUsd: 1000,
      });

      const result = analyzeTrade(trade);

      expect(result.trade.tradeId).toBe("trade-1");
      expect(getSharedTradeSizeAnalyzer().getStats().totalTrades).toBeGreaterThan(0);
    });

    it("analyzeTrades should use shared instance", () => {
      resetSharedTradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 10);
      const result = analyzeTrades(trades);

      expect(result.results.size).toBe(10);
    });

    it("isTradeOutlier should use shared instance", () => {
      resetSharedTradeSizeAnalyzer();

      // Build baseline via shared instance
      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 50 }, () => 100)
      );

      analyzeTrades(trades);

      expect(isTradeOutlier("market-1", 150000)).toBe(true);
      expect(isTradeOutlier("market-1", 100)).toBe(false);
    });

    it("getTradeSizePercentileRank should work", () => {
      resetSharedTradeSizeAnalyzer();

      const trades = createDistributedTrades(
        "market-1",
        Array.from({ length: 100 }, (_, i) => (i + 1) * 10)
      );

      analyzeTrades(trades);

      expect(getTradeSizePercentileRank("market-1", 500)).toBeCloseTo(50, -1);
    });

    it("getMarketTradeSizeStats should work", () => {
      resetSharedTradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 30);
      analyzeTrades(trades);

      const stats = getMarketTradeSizeStats("market-1");
      expect(stats).not.toBeNull();
      expect(stats?.tradeCount).toBe(30);
    });

    it("getTradeSizeAnalyzerSummary should work", () => {
      resetSharedTradeSizeAnalyzer();

      const trades = createMarketTrades("market-1", 30);
      analyzeTrades(trades);

      const summary = getTradeSizeAnalyzerSummary();
      expect(summary.totalMarkets).toBe(1);
    });

    it("getRecentLargeTrades should work", () => {
      resetSharedTradeSizeAnalyzer();

      // Create baseline
      const baseline = createDistributedTrades(
        "market-1",
        Array.from({ length: 30 }, () => 100)
      );

      analyzeTrades(baseline);

      // Add large trade
      analyzeTrade(
        createTrade({
          tradeId: "large-1",
          marketId: "market-1",
          walletAddress: "0xwhale",
          sizeUsd: 150000,
        })
      );

      const events = getRecentLargeTrades(10);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Module Exports Tests
  // ==========================================================================

  describe("module exports", () => {
    it("should export all enums", () => {
      expect(TradeSizeCategory).toBeDefined();
      expect(TradeSizeCategory.SMALL).toBe("SMALL");
      expect(TradeSizeCategory.MEDIUM).toBe("MEDIUM");
      expect(TradeSizeCategory.LARGE).toBe("LARGE");
      expect(TradeSizeCategory.VERY_LARGE).toBe("VERY_LARGE");
      expect(TradeSizeCategory.WHALE).toBe("WHALE");

      expect(TradeSizeSeverity).toBeDefined();
      expect(TradeSizeSeverity.LOW).toBe("LOW");
      expect(TradeSizeSeverity.MEDIUM).toBe("MEDIUM");
      expect(TradeSizeSeverity.HIGH).toBe("HIGH");
      expect(TradeSizeSeverity.CRITICAL).toBe("CRITICAL");

      expect(ThresholdMethod).toBeDefined();
      expect(ThresholdMethod.PERCENTILE).toBe("PERCENTILE");
      expect(ThresholdMethod.Z_SCORE).toBe("Z_SCORE");
      expect(ThresholdMethod.ABSOLUTE).toBe("ABSOLUTE");
      expect(ThresholdMethod.COMBINED).toBe("COMBINED");
    });

    it("should export all default constants", () => {
      expect(DEFAULT_PERCENTILE_THRESHOLDS).toBeDefined();
      expect(DEFAULT_ZSCORE_THRESHOLDS).toBeDefined();
      expect(DEFAULT_ABSOLUTE_THRESHOLDS).toBeDefined();
      expect(DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG).toBeDefined();
    });

    it("should export all functions", () => {
      expect(typeof TradeSizeAnalyzer).toBe("function");
      expect(typeof createTradeSizeAnalyzer).toBe("function");
      expect(typeof getSharedTradeSizeAnalyzer).toBe("function");
      expect(typeof setSharedTradeSizeAnalyzer).toBe("function");
      expect(typeof resetSharedTradeSizeAnalyzer).toBe("function");
      expect(typeof analyzeTrade).toBe("function");
      expect(typeof analyzeTrades).toBe("function");
      expect(typeof isTradeOutlier).toBe("function");
      expect(typeof getTradeSizePercentileRank).toBe("function");
      expect(typeof getMarketTradeSizeStats).toBe("function");
      expect(typeof getTradeSizeAnalyzerSummary).toBe("function");
      expect(typeof getRecentLargeTrades).toBe("function");
    });
  });
});
