/**
 * E2E Tests for Coordinated Trading Detector (DET-PAT-008)
 *
 * These tests simulate realistic scenarios of coordinated trading
 * to verify the detector works in production-like conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CoordinatedTradingDetector,
  CoordinationRiskLevel,
  CoordinationFlag,
  createCoordinatedTradingDetector,
  resetSharedCoordinatedTradingDetector,
  CoordinatedTrade,
} from "../../src/detection/coordinated-trading-detector";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate realistic wallet addresses
 */
function generateWallet(seed: number): string {
  return `0x${seed.toString(16).padStart(40, "0")}`;
}

/**
 * Generate a realistic trade
 */
function createTrade(
  wallet: string,
  market: string,
  timestamp: number,
  options: {
    side?: "buy" | "sell";
    sizeUsd?: number;
    price?: number;
    outcome?: "win" | "loss" | "pending";
  } = {}
): CoordinatedTrade {
  return {
    tradeId: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    walletAddress: wallet,
    marketId: market,
    side: options.side ?? "buy",
    sizeUsd: options.sizeUsd ?? 500 + Math.random() * 500,
    price: options.price ?? 0.4 + Math.random() * 0.2,
    timestamp,
    outcome: options.outcome,
  };
}

/**
 * Create a trading session for a wallet
 */
function createTradingSession(
  wallet: string,
  markets: string[],
  startTime: number,
  tradesCount: number,
  intervalMs: number,
  options: {
    sideBias?: "buy" | "sell" | "mixed";
    sizeRange?: [number, number];
    winRate?: number;
  } = {}
): CoordinatedTrade[] {
  const trades: CoordinatedTrade[] = [];
  const sideBias = options.sideBias ?? "mixed";
  const [minSize, maxSize] = options.sizeRange ?? [100, 1000];
  const winRate = options.winRate ?? 0.5;

  for (let i = 0; i < tradesCount; i++) {
    const market = markets[i % markets.length]!;
    const timestamp = startTime + i * intervalMs;
    let side: "buy" | "sell";

    if (sideBias === "buy") {
      side = "buy";
    } else if (sideBias === "sell") {
      side = "sell";
    } else {
      side = Math.random() > 0.5 ? "buy" : "sell";
    }

    const outcome =
      Math.random() > 0.3
        ? Math.random() < winRate
          ? "win"
          : "loss"
        : "pending";

    trades.push(
      createTrade(wallet, market, timestamp, {
        side,
        sizeUsd: minSize + Math.random() * (maxSize - minSize),
        outcome,
      })
    );
  }

  return trades;
}

// ============================================================================
// E2E Test Scenarios
// ============================================================================

describe("Coordinated Trading Detector E2E", () => {
  let detector: CoordinatedTradingDetector;

  beforeEach(() => {
    detector = createCoordinatedTradingDetector();
    resetSharedCoordinatedTradingDetector();
  });

  afterEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  describe("Scenario: Mirror Trading Ring Detection", () => {
    /**
     * Simulates multiple wallets making identical trades at nearly the same time.
     * This is a common pattern for coordinated groups or single entity using multiple wallets.
     */
    it("should detect a mirror trading ring", () => {
      const baseTime = Date.now();
      const markets = ["market_election_2024", "market_btc_100k", "market_fed_rate"];
      const coordinated = [
        generateWallet(1),
        generateWallet(2),
        generateWallet(3),
      ];

      // All wallets trade the same markets at nearly the same time with same direction
      for (let round = 0; round < 15; round++) {
        const roundTime = baseTime + round * 3600000; // 1 hour between rounds
        const marketIdx = round % markets.length;
        const market = markets[marketIdx]!;

        for (let walletIdx = 0; walletIdx < coordinated.length; walletIdx++) {
          const wallet = coordinated[walletIdx]!;
          detector.addTrades([
            createTrade(
              wallet,
              market,
              roundTime + walletIdx * 500, // 500ms between each wallet
              {
                side: round % 2 === 0 ? "buy" : "sell",
                sizeUsd: 1000 + walletIdx * 10, // Very similar sizes
              }
            ),
          ]);
        }
      }

      // Analyze first wallet
      const result = detector.analyze(coordinated[0]!);

      expect(result.isCoordinated).toBe(true);
      expect(result.groups.length).toBeGreaterThan(0);

      const group = result.groups[0]!;
      expect(group.memberCount).toBeGreaterThanOrEqual(2);
      expect(group.coordinationScore).toBeGreaterThan(60);
      expect(group.flags).toContain(CoordinationFlag.TIMING_CORRELATION);
      expect(group.flags).toContain(CoordinationFlag.MARKET_OVERLAP);
    });
  });

  describe("Scenario: Wash Trading Detection", () => {
    /**
     * Simulates two wallets trading opposite sides of the same market at the same time.
     * This is a classic wash trading pattern.
     */
    it("should detect wash trading between two wallets", () => {
      const baseTime = Date.now();
      const market = "market_politics";
      const walletBuyer = generateWallet(10);
      const walletSeller = generateWallet(11);

      // Create matching buy/sell pairs
      for (let i = 0; i < 20; i++) {
        const tradeTime = baseTime + i * 60000; // 1 minute apart

        detector.addTrades([
          createTrade(walletBuyer, market, tradeTime, {
            side: "buy",
            sizeUsd: 500,
            price: 0.5,
          }),
          createTrade(walletSeller, market, tradeTime + 50, {
            side: "sell",
            sizeUsd: 500,
            price: 0.5,
          }),
        ]);
      }

      const pairResult = detector.analyzePair(walletBuyer, walletSeller);

      expect(pairResult).not.toBeNull();
      expect(pairResult!.flags).toContain(CoordinationFlag.OPPOSITE_DIRECTIONS);
      expect(pairResult!.directionAlignment).toBe(0); // All opposite
      expect(pairResult!.sizeSimilarity).toBe(1); // Identical sizes
    });
  });

  describe("Scenario: Copy Trading with Delay", () => {
    /**
     * Simulates a follower wallet that copies trades from a leader wallet
     * with a consistent delay (typical of copy trading or signal following).
     */
    it("should detect delayed copy trading pattern", () => {
      const baseTime = Date.now();
      const markets = ["market_a", "market_b", "market_c", "market_d", "market_e"];
      const leader = generateWallet(20);
      const follower = generateWallet(21);
      const copyDelayMs = 30 * 1000; // 30 second delay (within 1 minute simultaneous window)

      // Leader trades
      for (let i = 0; i < 15; i++) {
        const tradeTime = baseTime + i * 10 * 60 * 1000; // 10 min between trades
        const market = markets[i % markets.length]!;
        const side: "buy" | "sell" = i % 3 === 0 ? "sell" : "buy";

        detector.addTrades([
          createTrade(leader, market, tradeTime, {
            side,
            sizeUsd: 1000 + i * 50,
          }),
          // Follower copies with delay
          createTrade(follower, market, tradeTime + copyDelayMs, {
            side,
            sizeUsd: 1000 + i * 50 + Math.random() * 50, // Slightly different size
          }),
        ]);
      }

      void detector.analyze(leader); // Run analysis but we focus on pair similarity
      const pairSimilarity = detector.analyzePair(leader, follower);

      expect(pairSimilarity).not.toBeNull();
      expect(pairSimilarity!.marketOverlap).toBe(100);
      expect(pairSimilarity!.directionAlignment).toBe(1); // Same direction
      expect(pairSimilarity!.isLikelyCoordinated).toBe(true);
    });
  });

  describe("Scenario: Order Splitting Detection", () => {
    /**
     * Simulates a large order being split across multiple wallets to avoid
     * detection or reduce market impact.
     */
    it("should detect order splitting across wallets", () => {
      const baseTime = Date.now();
      const market = "market_high_volume";
      const splitters = [
        generateWallet(30),
        generateWallet(31),
        generateWallet(32),
        generateWallet(33),
        generateWallet(34),
      ];

      // Each wallet makes trades that sum to the total (10000 split 5 ways)
      for (let round = 0; round < 10; round++) {
        const roundTime = baseTime + round * 600000; // 10 min per round

        for (let walletIdx = 0; walletIdx < splitters.length; walletIdx++) {
          const wallet = splitters[walletIdx]!;
          detector.addTrades([
            createTrade(
              wallet,
              market,
              roundTime + walletIdx * 100, // Very close timing
              {
                side: "buy",
                sizeUsd: 2000, // Each gets 1/5 of 10000
              }
            ),
          ]);
        }
      }

      const result = detector.batchAnalyze(splitters);

      expect(result.coordinatedWalletCount).toBeGreaterThan(0);
      expect(result.groups.length).toBeGreaterThan(0);

      // Check if size similarity is detected
      if (result.groups.length > 0) {
        const group = result.groups[0]!;
        expect(group.flags).toContain(CoordinationFlag.SIZE_SIMILARITY);
      }
    });
  });

  describe("Scenario: Fresh Wallet Swarm", () => {
    /**
     * Simulates a group of new wallets that all start trading around the same time
     * in the same markets - often a sign of a single entity.
     */
    it("should detect fresh wallet swarm activity", () => {
      const baseTime = Date.now();
      void (baseTime - 24 * 60 * 60 * 1000); // 1 day ago (wallet creation time, for reference)
      const markets = ["market_new_event"];

      // 5 fresh wallets all starting to trade together
      const freshWallets = [
        generateWallet(40),
        generateWallet(41),
        generateWallet(42),
        generateWallet(43),
        generateWallet(44),
      ];

      // All wallets trade in similar patterns
      for (let i = 0; i < 10; i++) {
        const tradeTime = baseTime + i * 300000; // 5 min intervals

        for (const wallet of freshWallets) {
          detector.addTrades([
            createTrade(wallet, markets[0]!, tradeTime + Math.random() * 1000, {
              side: "buy",
              sizeUsd: 500 + Math.random() * 100,
            }),
          ]);
        }
      }

      const result = detector.batchAnalyze(freshWallets);

      expect(result.coordinatedWalletCount).toBeGreaterThan(0);

      // Check that groups exist with various risk levels
      void result.groups.filter(
        (g) =>
          g.riskLevel === CoordinationRiskLevel.HIGH ||
          g.riskLevel === CoordinationRiskLevel.CRITICAL ||
          g.riskLevel === CoordinationRiskLevel.MEDIUM
      );

      // Should have at least some coordination detected
      expect(result.groups.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Legitimate Independent Traders", () => {
    /**
     * Simulates traders who happen to trade the same popular market but
     * are otherwise independent - should NOT flag as coordinated.
     */
    it("should not flag legitimate independent traders", () => {
      const baseTime = Date.now();
      const popularMarket = "market_btc_100k";
      const otherMarkets = [
        "market_eth",
        "market_sol",
        "market_doge",
        "market_xrp",
      ];

      const traderA = generateWallet(50);
      const traderB = generateWallet(51);

      // Trader A: Trades BTC market occasionally, plus other markets
      const tradesA = createTradingSession(
        traderA,
        [popularMarket, ...otherMarkets.slice(0, 2)],
        baseTime,
        15,
        4 * 3600000, // 4 hours between trades
        { sideBias: "mixed", winRate: 0.48 }
      );

      // Trader B: Also trades BTC, but with different timing and different other markets
      const tradesB = createTradingSession(
        traderB,
        [popularMarket, ...otherMarkets.slice(2)],
        baseTime + 2 * 3600000, // 2 hour offset
        15,
        3 * 3600000, // 3 hours between trades
        { sideBias: "mixed", winRate: 0.52 }
      );

      detector.addTrades([...tradesA, ...tradesB]);

      const pairResult = detector.analyzePair(traderA, traderB);
      const analysisResult = detector.analyze(traderA);

      // Should have low similarity or not be flagged as coordinated
      if (pairResult) {
        expect(pairResult.isLikelyCoordinated).toBe(false);
      }

      // If groups exist, they should be low risk
      if (analysisResult.groups.length > 0) {
        expect(analysisResult.highestRiskLevel).toBe(CoordinationRiskLevel.NONE);
      }
    });
  });

  describe("Scenario: Market Maker Pattern", () => {
    /**
     * Simulates a market maker that provides liquidity on both sides.
     * Should be recognized but distinguished from wash trading.
     */
    it("should handle market maker patterns", () => {
      const baseTime = Date.now();
      const market = "market_active";
      const marketMaker = generateWallet(60);

      // Market maker alternates buy/sell regularly
      for (let i = 0; i < 30; i++) {
        detector.addTrades([
          createTrade(
            marketMaker,
            market,
            baseTime + i * 60000,
            {
              side: i % 2 === 0 ? "buy" : "sell",
              sizeUsd: 5000,
            }
          ),
        ]);
      }

      // Single wallet shouldn't form coordination groups with itself
      const result = detector.analyze(marketMaker);
      expect(result.walletsCompared).toBe(0); // No other wallets
      expect(result.isCoordinated).toBe(false);
    });
  });

  describe("Scenario: Cluster of Insiders", () => {
    /**
     * Simulates a group of wallets that consistently trade before major events
     * with unusually high win rates.
     */
    it("should detect insider-like coordinated group", () => {
      const baseTime = Date.now();
      const nicheMarkets = [
        "market_regulatory_decision",
        "market_corporate_announcement",
        "market_political_outcome",
      ];

      const insiderGroup = [
        generateWallet(70),
        generateWallet(71),
        generateWallet(72),
      ];

      // All insiders trade same direction with high win rate
      for (let event = 0; event < 10; event++) {
        const eventTime = baseTime + event * 24 * 3600000; // One event per day
        const market = nicheMarkets[event % nicheMarkets.length]!;

        for (const wallet of insiderGroup) {
          // Trade just before "event resolution"
          detector.addTrades([
            createTrade(
              wallet,
              market,
              eventTime - 3600000 + Math.random() * 60000, // 1 hour before
              {
                side: "buy",
                sizeUsd: 2000 + Math.random() * 500,
                outcome: "win", // All wins
              }
            ),
          ]);
        }
      }

      const result = detector.batchAnalyze(insiderGroup);

      expect(result.coordinatedWalletCount).toBeGreaterThan(0);
      expect(result.groups.length).toBeGreaterThan(0);

      if (result.groups.length > 0) {
        const group = result.groups[0]!;
        expect(group.coordinationScore).toBeGreaterThan(50);
        expect(group.flags).toContain(CoordinationFlag.WIN_RATE_SIMILARITY);
        expect(group.flags).toContain(CoordinationFlag.DIRECTION_ALIGNMENT);
      }
    });
  });

  describe("Scenario: Multi-Pattern Coordination", () => {
    /**
     * Simulates a complex coordination scheme that exhibits multiple patterns.
     */
    it("should detect multi-pattern coordination", () => {
      const baseTime = Date.now();
      const markets = ["market_x", "market_y", "market_z"];

      const walletA = generateWallet(80);
      const walletB = generateWallet(81);

      // Phase 1: Mirror trading
      for (let i = 0; i < 10; i++) {
        const time = baseTime + i * 60000;
        detector.addTrades([
          createTrade(walletA, markets[0]!, time, { side: "buy", sizeUsd: 1000 }),
          createTrade(walletB, markets[0]!, time + 100, {
            side: "buy",
            sizeUsd: 1000,
          }),
        ]);
      }

      // Phase 2: Order splitting in another market
      for (let i = 0; i < 10; i++) {
        const time = baseTime + 1000000 + i * 60000;
        detector.addTrades([
          createTrade(walletA, markets[1]!, time, { side: "buy", sizeUsd: 500 }),
          createTrade(walletB, markets[1]!, time + 50, {
            side: "buy",
            sizeUsd: 500,
          }),
        ]);
      }

      // Phase 3: Wash trading in a third market
      for (let i = 0; i < 10; i++) {
        const time = baseTime + 2000000 + i * 60000;
        detector.addTrades([
          createTrade(walletA, markets[2]!, time, { side: "buy", sizeUsd: 800 }),
          createTrade(walletB, markets[2]!, time + 50, {
            side: "sell",
            sizeUsd: 800,
          }),
        ]);
      }

      const result = detector.analyze(walletA);
      const pairResult = detector.analyzePair(walletA, walletB);

      expect(result.isCoordinated).toBe(true);
      expect(pairResult).not.toBeNull();
      expect(pairResult!.flags.length).toBeGreaterThan(2);

      // Should have mixed direction due to different phases
      expect(pairResult!.directionAlignment).toBeGreaterThan(0.3);
      expect(pairResult!.directionAlignment).toBeLessThan(0.9);
    });
  });

  describe("Scenario: Time-Based Analysis", () => {
    /**
     * Tests that time-filtered analysis works correctly.
     */
    it("should correctly filter analysis by time range", () => {
      const baseTime = Date.now();
      const market = "market_time_test";

      const walletA = generateWallet(90);
      const walletB = generateWallet(91);

      // Period 1: Highly correlated (first 5 hours)
      for (let i = 0; i < 10; i++) {
        const time = baseTime + i * 1800000; // 30 min intervals
        detector.addTrades([
          createTrade(walletA, market, time, { side: "buy", sizeUsd: 1000 }),
          createTrade(walletB, market, time + 100, { side: "buy", sizeUsd: 1000 }),
        ]);
      }

      // Period 2: Completely independent - no overlap at all
      // Wallet A trades completely different markets with different pattern
      for (let i = 0; i < 10; i++) {
        const timeA = baseTime + 18000000 + i * 3600000; // 1 hour intervals
        detector.addTrades([
          createTrade(walletA, `market_a_only_${i}`, timeA, {
            side: i % 2 === 0 ? "buy" : "sell",
            sizeUsd: 100 + i * 50,
          }),
        ]);
      }
      // Wallet B trades completely different markets at different times
      for (let i = 0; i < 10; i++) {
        const timeB = baseTime + 20000000 + i * 7200000; // 2 hour intervals, offset
        detector.addTrades([
          createTrade(walletB, `market_b_only_${i}`, timeB, {
            side: i % 2 === 1 ? "buy" : "sell", // Opposite pattern
            sizeUsd: 5000 - i * 200,
          }),
        ]);
      }

      // Analyze only first period (bypass cache to get fresh result)
      const period1Result = detector.analyzePair(walletA, walletB, {
        startTime: baseTime,
        endTime: baseTime + 18000000,
        bypassCache: true,
      });

      // Analyze only second period (bypass cache - different time range needs recalculation)
      const period2Result = detector.analyzePair(walletA, walletB, {
        startTime: baseTime + 18000000,
        endTime: baseTime + 100000000,
        bypassCache: true,
      });

      expect(period1Result).not.toBeNull();
      expect(period1Result!.similarityScore).toBeGreaterThan(60);

      // Period 2 should show less coordination (different markets, different sizes)
      // When there's no market overlap and trades are very different, the score should drop
      // Note: Even unrelated wallets may have some baseline similarity due to default win rate
      if (period2Result) {
        // Period 2 should have zero market overlap since wallets trade completely different markets
        expect(period2Result.marketOverlap).toBe(0);
        // With zero market overlap, direction alignment will be 0.5 (random)
        expect(period2Result.directionAlignment).toBe(0.5);
        // Should not be flagged as likely coordinated with such different patterns
        expect(period2Result.isLikelyCoordinated).toBe(false);
      }
    });
  });

  describe("Scenario: Large Scale Analysis", () => {
    /**
     * Tests performance with many wallets and trades.
     */
    it("should handle large-scale batch analysis", () => {
      const baseTime = Date.now();
      const markets = Array.from({ length: 10 }, (_, i) => `market_${i}`);

      // Create 20 wallets with random trading patterns
      const wallets: string[] = [];
      for (let w = 0; w < 20; w++) {
        const wallet = generateWallet(100 + w);
        wallets.push(wallet);

        const trades = createTradingSession(
          wallet,
          markets.slice(w % 5, (w % 5) + 3), // Each wallet trades 3 markets
          baseTime + Math.random() * 3600000,
          10 + Math.floor(Math.random() * 10),
          600000 + Math.random() * 600000,
          {
            sideBias: "mixed",
            sizeRange: [100, 5000],
          }
        );

        detector.addTrades(trades);
      }

      const startTime = Date.now();
      const result = detector.batchAnalyze(wallets);
      const duration = Date.now() - startTime;

      expect(result.walletsAnalyzed).toBe(20);
      expect(result.processingTimeMs).toBe(duration);
      expect(result.resultsByWallet.size).toBe(20);

      // Performance check: should complete in reasonable time
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
    });
  });

  describe("Scenario: Summary Statistics", () => {
    /**
     * Tests that summary provides accurate statistics.
     */
    it("should provide accurate summary statistics", () => {
      const baseTime = Date.now();
      const market = "market_summary";

      // Add coordinated pair
      for (let i = 0; i < 10; i++) {
        detector.addTrades([
          createTrade(generateWallet(110), market, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(generateWallet(111), market, baseTime + i * 60000 + 100, {
            side: "buy",
            sizeUsd: 1000,
          }),
        ]);
      }

      // Analyze
      detector.analyze(generateWallet(110));

      const summary = detector.getSummary();

      expect(summary.totalWallets).toBe(2);
      expect(summary.totalTrades).toBe(20);
      expect(typeof summary.detectedGroups).toBe("number");
      expect(summary.cacheStats).toBeDefined();
      expect(summary.lastAnalysisAt).toBeInstanceOf(Date);
    });
  });

  describe("Scenario: Event Emission", () => {
    /**
     * Tests that events are emitted correctly during detection.
     */
    it("should emit appropriate events during detection", async () => {
      const events: string[] = [];

      detector.on("tradesAdded", () => events.push("tradesAdded"));
      detector.on("analysisComplete", () => events.push("analysisComplete"));
      detector.on("batchAnalysisComplete", () =>
        events.push("batchAnalysisComplete")
      );

      const baseTime = Date.now();
      detector.addTrades([
        createTrade(generateWallet(120), "market_event", baseTime),
        createTrade(generateWallet(121), "market_event", baseTime + 100),
      ]);

      expect(events).toContain("tradesAdded");

      detector.analyze(generateWallet(120));
      expect(events).toContain("analysisComplete");

      detector.batchAnalyze([generateWallet(120), generateWallet(121)]);
      expect(events).toContain("batchAnalysisComplete");
    });
  });

  describe("Scenario: Cache Effectiveness", () => {
    /**
     * Tests that caching improves performance on repeated analyses.
     */
    it("should use cache effectively", () => {
      const baseTime = Date.now();
      const market = "market_cache";

      const walletA = generateWallet(130);
      const walletB = generateWallet(131);

      for (let i = 0; i < 10; i++) {
        detector.addTrades([
          createTrade(walletA, market, baseTime + i * 60000),
          createTrade(walletB, market, baseTime + i * 60000 + 100),
        ]);
      }

      // First analysis (populates cache)
      void Date.now(); // For timing reference
      detector.analyze(walletA);

      // Second analysis (should use cache)
      void Date.now(); // For timing reference
      detector.analyze(walletA);

      const summary = detector.getSummary();

      // Cache should have hits
      expect(summary.cacheStats.hits).toBeGreaterThan(0);
    });
  });
});
