/**
 * End-to-End Tests for Position Sizing Pattern Analyzer (DET-PAT-006)
 *
 * These tests simulate real-world scenarios of different trader types
 * and verify that the analyzer correctly identifies sizing patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PositionSizingAnalyzer,
  SizingCategory,
  SizingPatternType,
  SizingAnomalyType,
  SizingSuspicionLevel,
  SizingPosition,
  createPositionSizingAnalyzer,
} from "../../src/detection/position-sizing-analyzer";
import { MarketCategory } from "../../src/api/gamma/types";

// Test wallet addresses
const WALLET_RETAIL = "0x1111111111111111111111111111111111111111";
const WALLET_WHALE = "0x2222222222222222222222222222222222222222";
const WALLET_INSIDER = "0x3333333333333333333333333333333333333333";
const WALLET_BOT = "0x4444444444444444444444444444444444444444";
const WALLET_SCALPER = "0x5555555555555555555555555555555555555555";
const WALLET_MARTINGALE = "0x6666666666666666666666666666666666666666";

// Helper to generate realistic positions
function generatePosition(
  index: number,
  config: {
    baseSize?: number;
    sizeVariance?: number;
    category?: MarketCategory | string;
    isWinner?: boolean | null;
    marketId?: string;
    side?: "buy" | "sell";
    timeBetweenPositions?: number;
  } = {}
): SizingPosition {
  const {
    baseSize = 100,
    sizeVariance = 0.3,
    category,
    isWinner,
    marketId,
    side = "buy",
    timeBetweenPositions = 3600000,
  } = config;

  const variance = 1 + (Math.random() - 0.5) * 2 * sizeVariance;
  const size = baseSize * variance;

  return {
    positionId: `pos-${index}-${Math.random().toString(36).substring(7)}`,
    marketId: marketId || `market-${Math.floor(Math.random() * 100)}`,
    marketCategory: category,
    sizeUsd: Math.round(size * 100) / 100,
    entryPrice: 0.3 + Math.random() * 0.4, // 0.3-0.7 range
    side,
    entryTimestamp: new Date(Date.now() - (100 - index) * timeBetweenPositions),
    isWinner: isWinner !== undefined ? isWinner : Math.random() > 0.5 ? true : false,
    pnl: isWinner ? Math.random() * size : -Math.random() * size * 0.5,
  };
}

describe("E2E: Position Sizing Analyzer Scenarios", () => {
  let analyzer: PositionSizingAnalyzer;

  beforeEach(() => {
    analyzer = createPositionSizingAnalyzer();
  });

  afterEach(() => {
    analyzer.clear();
  });

  describe("Scenario: Retail Trader", () => {
    it("should identify normal retail trading patterns", () => {
      // Retail trader: variable sizes, ~50% win rate, medium positions
      // MEDIUM category requires median >= 200 and < 1000
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 50; i++) {
        positions.push(
          generatePosition(i, {
            baseSize: 400, // Target median around 400 for MEDIUM
            sizeVariance: 0.3, // Moderate variance
            isWinner: Math.random() > 0.48 ? true : false, // ~52% win rate
          })
        );
      }
      analyzer.addPositions(WALLET_RETAIL, positions);

      const result = analyzer.analyze(WALLET_RETAIL);

      expect(result.category).toBe(SizingCategory.MEDIUM);
      expect(result.suspicionLevel).toBe(SizingSuspicionLevel.NONE);
      expect(result.isPotentiallySuspicious).toBe(false);
      expect(result.dataQuality).toBeGreaterThanOrEqual(60);
    });

    it("should handle retail trader with improving skills", () => {
      // Retail trader who gets better over time
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 60; i++) {
        // Size increases as confidence grows
        const baseSize = 100 + i * 3;
        // Win rate improves over time
        const winRate = 0.4 + (i / 60) * 0.2; // 40% -> 60%
        positions.push(
          generatePosition(i, {
            baseSize,
            sizeVariance: 0.3,
            isWinner: Math.random() < winRate ? true : false,
          })
        );
      }
      analyzer.addPositions(WALLET_RETAIL, positions);

      const result = analyzer.analyze(WALLET_RETAIL);

      expect(result.trend.direction).toBe("increasing");
      expect(result.suspicionLevel).not.toBe(SizingSuspicionLevel.CRITICAL);
    });
  });

  describe("Scenario: Whale Trader", () => {
    it("should identify whale trading patterns", () => {
      // Whale: very large positions, consistent sizing
      // WHALE category requires median >= 5000 and < 25000
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 30; i++) {
        positions.push(
          generatePosition(i, {
            baseSize: 12000, // Target median around 12000 for WHALE
            sizeVariance: 0.15, // Lower variance
            isWinner: Math.random() > 0.45 ? true : false,
          })
        );
      }
      analyzer.addPositions(WALLET_WHALE, positions);

      const result = analyzer.analyze(WALLET_WHALE);

      expect(result.category).toBe(SizingCategory.WHALE);
      expect(result.distribution.median).toBeGreaterThan(8000);
    });

    it("should handle whale accumulation pattern", () => {
      // Whale accumulating into a single market - should detect scaling up pattern
      const marketId = "election-2024";
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 20; i++) {
        positions.push({
          positionId: `whale-${i}`,
          marketId,
          marketCategory: MarketCategory.POLITICS,
          sizeUsd: 5000 + i * 1000, // Increasing sizes
          entryPrice: 0.4,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (20 - i) * 86400000),
        });
      }
      analyzer.addPositions(WALLET_WHALE, positions);

      const result = analyzer.analyze(WALLET_WHALE);

      // Should detect scaling up pattern (accumulation)
      const scalingPattern = result.patternMatches.find(
        (m) => m.pattern === SizingPatternType.SCALING_UP || m.pattern === SizingPatternType.PYRAMIDING
      );
      expect(scalingPattern).toBeDefined();
    });
  });

  describe("Scenario: Potential Insider", () => {
    it("should flag suspicious size-outcome correlation", () => {
      // Insider: large positions win, small positions lose
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 40; i++) {
        const isHighConviction = i % 3 === 0; // Every 3rd trade is "high conviction"
        positions.push({
          positionId: `insider-${i}`,
          marketId: `market-${i % 10}`,
          marketCategory: MarketCategory.POLITICS,
          sizeUsd: isHighConviction ? 2000 + Math.random() * 500 : 150 + Math.random() * 50,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (40 - i) * 7200000),
          isWinner: isHighConviction, // High conviction trades always win
        });
      }
      analyzer.addPositions(WALLET_INSIDER, positions);

      const result = analyzer.analyze(WALLET_INSIDER);

      // Should detect some suspicion
      expect(result.suspicionScore).toBeGreaterThan(20);

      // Should detect large on winners anomaly
      const largeOnWinners = result.anomalies.find(
        (a) => a.type === SizingAnomalyType.LARGE_ON_WINNERS
      );
      expect(largeOnWinners).toBeDefined();

      // Should detect confidence-based pattern
      const confidencePattern = result.patternMatches.find(
        (m) => m.pattern === SizingPatternType.CONFIDENCE_BASED
      );
      expect(confidencePattern).toBeDefined();
    });

    it("should flag category concentration with high win rate", () => {
      // Insider concentrated in specific category with explicitly all winning positions
      const positions: SizingPosition[] = [];

      // Politics positions - all winners, explicitly marked
      for (let i = 0; i < 30; i++) {
        positions.push({
          positionId: `pol-${i}`,
          marketId: `pol-market-${i}`,
          marketCategory: MarketCategory.POLITICS,
          sizeUsd: 1500,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (45 - i) * 3600000),
          isWinner: true, // Explicitly all winners
        });
      }

      // Non-politics positions - mixed results
      for (let i = 0; i < 15; i++) {
        positions.push({
          positionId: `other-${i}`,
          marketId: `other-market-${i}`,
          marketCategory: i % 2 === 0 ? MarketCategory.CRYPTO : MarketCategory.SPORTS,
          sizeUsd: 200,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (15 - i) * 3600000),
          isWinner: Math.random() > 0.5,
        });
      }

      analyzer.addPositions(WALLET_INSIDER, positions);

      const result = analyzer.analyze(WALLET_INSIDER);

      // Should have high category concentration in politics
      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );
      expect(politicsStats).toBeDefined();
      expect(politicsStats?.winRate).toBe(100);
      expect(politicsStats?.avgSize).toBeGreaterThan(1000);

      // Should flag concentrated large positions
      expect(result.riskFlags.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Bot Trader", () => {
    it("should identify bot-like precision", () => {
      // Bot: exact same sizes, consistent timing
      const positions: SizingPosition[] = [];
      const sizes = [100.00, 250.00, 500.00];

      for (let i = 0; i < 60; i++) {
        positions.push({
          positionId: `bot-${i}`,
          marketId: `market-${i % 20}`,
          sizeUsd: sizes[i % 3]!, // Rotating through fixed sizes
          entryPrice: 0.5,
          side: i % 2 === 0 ? "buy" : "sell",
          entryTimestamp: new Date(Date.now() - (60 - i) * 300000), // Every 5 minutes
          isWinner: Math.random() > 0.45 ? true : false,
        });
      }
      analyzer.addPositions(WALLET_BOT, positions);

      const result = analyzer.analyze(WALLET_BOT);

      // Should detect bot-like pattern
      const botPattern = result.patternMatches.find(
        (m) => m.pattern === SizingPatternType.BOT_LIKE
      );
      expect(botPattern).toBeDefined();
    });

    it("should detect precision anomaly", () => {
      // Bot with very precise decimal sizes
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 40; i++) {
        positions.push({
          positionId: `precise-${i}`,
          marketId: `market-${i % 10}`,
          sizeUsd: 100.00, // Exact same size
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (40 - i) * 600000),
        });
      }
      analyzer.addPositions(WALLET_BOT, positions);

      const result = analyzer.analyze(WALLET_BOT);

      // Should detect suspicious consistency
      const consistencyAnomaly = result.anomalies.find(
        (a) => a.type === SizingAnomalyType.SUSPICIOUS_CONSISTENCY
      );
      expect(consistencyAnomaly).toBeDefined();
    });
  });

  describe("Scenario: Scalper", () => {
    it("should identify scalper sizing pattern", () => {
      // Scalper: many small, consistent positions
      // MICRO category requires median < 50
      const positions: SizingPosition[] = [];
      for (let i = 0; i < 100; i++) {
        positions.push(
          generatePosition(i, {
            baseSize: 30, // Target median around 30 for MICRO
            sizeVariance: 0.1, // Very consistent
            timeBetweenPositions: 300000, // 5 minutes apart
            isWinner: Math.random() > 0.45 ? true : false, // ~55% win rate
          })
        );
      }
      analyzer.addPositions(WALLET_SCALPER, positions);

      const result = analyzer.analyze(WALLET_SCALPER);

      // Should be consistent pattern
      expect(result.distribution.coefficientOfVariation).toBeLessThan(0.3);
      expect(result.category).toBe(SizingCategory.MICRO);
      expect(result.dataQuality).toBe(100);
    });
  });

  describe("Scenario: Martingale Trader", () => {
    it("should identify martingale pattern", () => {
      // Martingale: doubles after each loss
      const positions: SizingPosition[] = [];
      let currentSize = 100;
      let streak = 0;

      for (let i = 0; i < 40; i++) {
        // Simulate loss streaks followed by wins
        let isWinner: boolean;
        if (streak >= 3) {
          isWinner = true; // Eventually win after streak
          streak = 0;
        } else {
          isWinner = Math.random() > 0.6 ? true : false;
          if (!isWinner) streak++;
        }

        positions.push({
          positionId: `mart-${i}`,
          marketId: `market-${i % 10}`,
          sizeUsd: currentSize,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (40 - i) * 3600000),
          isWinner,
        });

        // Update size based on outcome
        if (isWinner) {
          currentSize = 100; // Reset after win
        } else {
          currentSize = currentSize * 2; // Double after loss
        }
      }
      analyzer.addPositions(WALLET_MARTINGALE, positions);

      const result = analyzer.analyze(WALLET_MARTINGALE);

      // Should detect martingale pattern
      const martingalePattern = result.patternMatches.find(
        (m) => m.pattern === SizingPatternType.MARTINGALE
      );
      expect(martingalePattern).toBeDefined();
    });
  });

  describe("Scenario: Multi-Strategy Trader", () => {
    it("should analyze trader using different strategies per category", () => {
      const positions: SizingPosition[] = [];

      // Politics: Large confident bets
      for (let i = 0; i < 15; i++) {
        positions.push({
          positionId: `politics-${i}`,
          marketId: `pol-market-${i}`,
          marketCategory: MarketCategory.POLITICS,
          sizeUsd: 1000 + Math.random() * 500,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (45 - i) * 86400000),
          isWinner: Math.random() > 0.4 ? true : false,
        });
      }

      // Crypto: Small frequent trades
      for (let i = 0; i < 20; i++) {
        positions.push({
          positionId: `crypto-${i}`,
          marketId: `crypto-market-${i}`,
          marketCategory: MarketCategory.CRYPTO,
          sizeUsd: 100 + Math.random() * 50,
          entryPrice: 0.5,
          side: i % 2 === 0 ? "buy" : "sell",
          entryTimestamp: new Date(Date.now() - (45 - 15 - i / 2) * 86400000),
          isWinner: Math.random() > 0.48 ? true : false,
        });
      }

      // Sports: Medium bets
      for (let i = 0; i < 10; i++) {
        positions.push({
          positionId: `sports-${i}`,
          marketId: `sports-market-${i}`,
          marketCategory: MarketCategory.SPORTS,
          sizeUsd: 300 + Math.random() * 200,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - i * 86400000),
          isWinner: Math.random() > 0.45 ? true : false,
        });
      }

      analyzer.addPositions(WALLET_RETAIL, positions);
      const result = analyzer.analyze(WALLET_RETAIL);

      // Should have stats for all categories
      expect(result.categoryStats.length).toBe(3);

      // Politics should have highest avg size
      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );
      expect(politicsStats?.avgSize).toBeGreaterThan(1000);

      // Crypto should have most positions
      const cryptoStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.CRYPTO
      );
      expect(cryptoStats?.positionCount).toBe(20);

      // Should detect variable pattern due to different strategies
      expect(result.distribution.coefficientOfVariation).toBeGreaterThan(0.5);
    });
  });

  describe("Scenario: Round Number Preference", () => {
    it("should detect round number bias", () => {
      const roundNumbers = [100, 250, 500, 1000, 100, 500, 250, 1000, 100, 500];
      const positions = roundNumbers.map((size, i) => ({
        positionId: `round-${i}`,
        marketId: `market-${i % 5}`,
        sizeUsd: size,
        entryPrice: 0.5,
        side: "buy" as const,
        entryTimestamp: new Date(Date.now() - (10 - i) * 3600000),
        isWinner: Math.random() > 0.5 ? true : false,
      }));

      analyzer.addPositions(WALLET_RETAIL, positions);
      const result = analyzer.analyze(WALLET_RETAIL);

      // Should detect round number pattern
      const roundPattern = result.patternMatches.find(
        (m) => m.pattern === SizingPatternType.ROUND_NUMBERS
      );
      expect(roundPattern).toBeDefined();

      // Should detect round number bias anomaly
      const roundAnomaly = result.anomalies.find(
        (a) => a.type === SizingAnomalyType.ROUND_NUMBER_BIAS
      );
      expect(roundAnomaly).toBeDefined();
    });
  });

  describe("Scenario: Position Size Outliers", () => {
    it("should detect unusually large positions among normal trades", () => {
      const positions: SizingPosition[] = [];

      // Normal positions
      for (let i = 0; i < 18; i++) {
        positions.push(
          generatePosition(i, {
            baseSize: 200,
            sizeVariance: 0.2,
          })
        );
      }

      // Outlier positions (10x normal)
      positions.push({
        positionId: "outlier-1",
        marketId: "special-market",
        sizeUsd: 5000,
        entryPrice: 0.5,
        side: "buy",
        entryTimestamp: new Date(Date.now() - 3600000),
        isWinner: true,
      });
      positions.push({
        positionId: "outlier-2",
        marketId: "special-market-2",
        sizeUsd: 4500,
        entryPrice: 0.5,
        side: "buy",
        entryTimestamp: new Date(),
        isWinner: true,
      });

      analyzer.addPositions(WALLET_RETAIL, positions);
      const result = analyzer.analyze(WALLET_RETAIL);

      // Should detect unusually large positions
      const largeAnomaly = result.anomalies.find(
        (a) => a.type === SizingAnomalyType.UNUSUALLY_LARGE
      );
      expect(largeAnomaly).toBeDefined();

      // Distribution should show right skew
      expect(result.distribution.skewness).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Batch Analysis", () => {
    it("should correctly batch analyze multiple traders", () => {
      // Retail trader - MEDIUM requires median >= 200 and < 1000
      const retailPositions = Array.from({ length: 20 }, (_, i) =>
        generatePosition(i, { baseSize: 400, sizeVariance: 0.2 })
      );
      analyzer.addPositions(WALLET_RETAIL, retailPositions);

      // Whale trader - WHALE requires median >= 5000 and < 25000
      const whalePositions = Array.from({ length: 15 }, (_, i) =>
        generatePosition(i, { baseSize: 10000, sizeVariance: 0.2 })
      );
      analyzer.addPositions(WALLET_WHALE, whalePositions);

      // Bot trader
      const botPositions = Array.from({ length: 30 }, (_, i) => ({
        positionId: `bot-${i}`,
        marketId: `market-${i % 10}`,
        sizeUsd: 100.00,
        entryPrice: 0.5,
        side: "buy" as const,
        entryTimestamp: new Date(Date.now() - (30 - i) * 600000),
      }));
      analyzer.addPositions(WALLET_BOT, botPositions);

      // Batch analyze
      const results = analyzer.batchAnalyze([WALLET_RETAIL, WALLET_WHALE, WALLET_BOT]);

      expect(results.results.size).toBe(3);
      expect(results.failed.size).toBe(0);

      // Verify categories
      const retailResult = results.results.get(WALLET_RETAIL);
      const whaleResult = results.results.get(WALLET_WHALE);

      expect(retailResult?.category).toBe(SizingCategory.MEDIUM);
      expect(whaleResult?.category).toBe(SizingCategory.WHALE);
    });
  });

  describe("Scenario: Summary Statistics", () => {
    it("should provide accurate summary across all wallets", () => {
      // Add multiple wallets with different patterns
      analyzer.addPositions(
        WALLET_RETAIL,
        Array.from({ length: 20 }, (_, i) =>
          generatePosition(i, { baseSize: 200, sizeVariance: 0.3 })
        )
      );

      analyzer.addPositions(
        WALLET_WHALE,
        Array.from({ length: 10 }, (_, i) =>
          generatePosition(i, { baseSize: 20000, sizeVariance: 0.1 })
        )
      );

      analyzer.addPositions(
        WALLET_BOT,
        Array.from({ length: 50 }, (_, i) => ({
          positionId: `bot-${i}`,
          marketId: `market-${i % 10}`,
          sizeUsd: 100.00,
          entryPrice: 0.5,
          side: "buy" as const,
          entryTimestamp: new Date(Date.now() - i * 60000),
        }))
      );

      const summary = analyzer.getSummary();

      expect(summary.totalWallets).toBe(3);
      expect(summary.totalPositions).toBe(80);
      expect(summary.categoryDistribution).toBeDefined();
      expect(summary.patternDistribution).toBeDefined();
    });
  });

  describe("Scenario: Trend Detection", () => {
    it("should detect increasing size trend", () => {
      // Trader increasing sizes over time
      const positions = Array.from({ length: 30 }, (_, i) => ({
        positionId: `trend-${i}`,
        marketId: `market-${i % 10}`,
        sizeUsd: 100 + i * 50, // Increasing by 50 each time
        entryPrice: 0.5,
        side: "buy" as const,
        entryTimestamp: new Date(Date.now() - (30 - i) * 3600000),
      }));

      analyzer.addPositions(WALLET_RETAIL, positions);
      const result = analyzer.analyze(WALLET_RETAIL);

      expect(result.trend.direction).toBe("increasing");
      expect(result.trend.isSignificant).toBe(true);
      expect(result.trend.recentAvg).toBeGreaterThan(result.trend.historicalAvg);
    });

    it("should detect decreasing size trend", () => {
      // Trader decreasing sizes (taking profits or losing confidence)
      const positions = Array.from({ length: 25 }, (_, i) => ({
        positionId: `trend-${i}`,
        marketId: `market-${i % 10}`,
        sizeUsd: 1000 - i * 30, // Decreasing by 30 each time
        entryPrice: 0.5,
        side: "buy" as const,
        entryTimestamp: new Date(Date.now() - (25 - i) * 3600000),
      }));

      analyzer.addPositions(WALLET_RETAIL, positions);
      const result = analyzer.analyze(WALLET_RETAIL);

      expect(result.trend.direction).toBe("decreasing");
      expect(result.trend.changePercent).toBeLessThan(0);
    });
  });

  describe("Scenario: Cache Behavior", () => {
    it("should use cache for repeated analyses", () => {
      analyzer.addPositions(
        WALLET_RETAIL,
        Array.from({ length: 20 }, (_, i) =>
          generatePosition(i, { baseSize: 200 })
        )
      );

      // First analysis - cache miss
      const result1 = analyzer.analyze(WALLET_RETAIL);
      // Second analysis - cache hit
      const result2 = analyzer.analyze(WALLET_RETAIL);

      // Same analysis timestamp (cached)
      expect(result1.analyzedAt.getTime()).toBe(result2.analyzedAt.getTime());

      // Cache stats should reflect hit
      const summary = analyzer.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it("should invalidate cache on new position", () => {
      analyzer.addPositions(
        WALLET_RETAIL,
        Array.from({ length: 20 }, (_, i) =>
          generatePosition(i, { baseSize: 200 })
        )
      );

      const result1 = analyzer.analyze(WALLET_RETAIL);
      expect(result1.distribution.count).toBe(20);

      // Add new position
      analyzer.addPosition(WALLET_RETAIL, generatePosition(100, { baseSize: 500 }));

      const result2 = analyzer.analyze(WALLET_RETAIL);
      expect(result2.distribution.count).toBe(21);
      // Different analysis (cache invalidated)
      expect(result2.analyzedAt.getTime()).toBeGreaterThanOrEqual(
        result1.analyzedAt.getTime()
      );
    });
  });

  describe("Scenario: High Conviction Detection", () => {
    it("should identify high conviction traders", () => {
      // Add normal retail trader
      analyzer.addPositions(
        WALLET_RETAIL,
        Array.from({ length: 20 }, (_, i) =>
          generatePosition(i, {
            baseSize: 200,
            sizeVariance: 0.3,
            isWinner: Math.random() > 0.5 ? true : false,
          })
        )
      );

      // Add high conviction trader (large on winners)
      const highConvictionPositions: SizingPosition[] = [];
      for (let i = 0; i < 25; i++) {
        const isWinner = i % 3 === 0; // ~33% are winners
        highConvictionPositions.push({
          positionId: `hc-${i}`,
          marketId: `market-${i}`,
          sizeUsd: isWinner ? 2000 : 200,
          entryPrice: 0.5,
          side: "buy",
          entryTimestamp: new Date(Date.now() - (25 - i) * 3600000),
          isWinner,
        });
      }
      analyzer.addPositions(WALLET_INSIDER, highConvictionPositions);

      const traders = analyzer.getHighConvictionTraders();

      // High conviction trader should be in the list
      const hasInsider = traders.some(
        (t) =>
          t.walletAddress.toLowerCase() === WALLET_INSIDER.toLowerCase()
      );
      expect(hasInsider).toBe(true);
    });
  });
});
