/**
 * Win Rate Tracker E2E Tests (DET-PAT-004)
 *
 * End-to-end tests that verify the win rate tracker works correctly
 * with realistic data scenarios and integration with other components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  WinRateTracker,
  resetSharedWinRateTracker,
  addPositionsForWinRate,
  analyzeWinRate,
  hasUnusuallyHighWinRate,
  getHighWinRateWallets,
  getPotentialInsidersByWinRate,
  getWinRateTrackerSummary,
  PositionOutcome,
  WinRateCategory,
  WinRateSuspicionLevel,
  WinRateWindow,
  type ResolvedPosition,
} from "../../src/detection/win-rate-tracker";

// ============================================================================
// Test Helpers
// ============================================================================

// Valid Ethereum addresses for testing
const WALLETS = {
  TRADER_1: "0x1111111111111111111111111111111111111111",
  TRADER_2: "0x2222222222222222222222222222222222222222",
  TRADER_3: "0x3333333333333333333333333333333333333333",
  TRADER_4: "0x4444444444444444444444444444444444444444",
  TRADER_5: "0x5555555555555555555555555555555555555555",
  INSIDER_SUSPECT: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  WHALE: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  RETAIL: "0xcccccccccccccccccccccccccccccccccccccccc",
};

interface PositionOptions {
  walletAddress?: string;
  marketId?: string;
  marketCategory?: string;
  outcome?: PositionOutcome;
  sizeUsd?: number;
  entryPrice?: number;
  exitPrice?: number;
  realizedPnl?: number;
  roi?: number;
  isHighConviction?: boolean;
  timeToResolutionHours?: number;
  daysAgo?: number;
}

function createTestPosition(options: PositionOptions = {}): ResolvedPosition {
  const {
    walletAddress = WALLETS.TRADER_1,
    marketId = `market-${Math.random().toString(36).substr(2, 9)}`,
    marketCategory = "crypto",
    outcome = PositionOutcome.WIN,
    sizeUsd = 100,
    entryPrice = 0.5,
    exitPrice = outcome === PositionOutcome.WIN ? 1.0 : 0,
    realizedPnl = outcome === PositionOutcome.WIN ? sizeUsd : -sizeUsd,
    roi = outcome === PositionOutcome.WIN ? 1.0 : -1.0,
    isHighConviction = false,
    timeToResolutionHours,
    daysAgo = 0,
  } = options;

  const now = new Date();
  const exitTimestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const entryTimestamp = new Date(exitTimestamp.getTime() - 24 * 60 * 60 * 1000);

  return {
    positionId: `pos-${Math.random().toString(36).substr(2, 12)}`,
    marketId,
    marketCategory,
    walletAddress,
    side: "buy",
    sizeUsd,
    entryPrice,
    exitPrice,
    entryTimestamp,
    exitTimestamp,
    outcome,
    realizedPnl,
    roi,
    isHighConviction,
    timeToResolutionHours,
  };
}

function createTraderHistory(
  walletAddress: string,
  config: {
    totalPositions: number;
    winRate: number;
    categories?: string[];
    highConvictionRate?: number;
    averageSize?: number;
    spreadDays?: number;
  }
): ResolvedPosition[] {
  const {
    totalPositions,
    winRate,
    categories = ["crypto"],
    highConvictionRate = 0,
    averageSize = 100,
    spreadDays = 30,
  } = config;

  const winCount = Math.round(totalPositions * (winRate / 100));
  const positions: ResolvedPosition[] = [];

  for (let i = 0; i < totalPositions; i++) {
    const isWin = i < winCount;
    const category = categories[i % categories.length];
    const isHighConviction = Math.random() < highConvictionRate;
    const daysAgo = Math.floor((spreadDays * i) / totalPositions);

    positions.push(
      createTestPosition({
        walletAddress,
        marketCategory: category,
        outcome: isWin ? PositionOutcome.WIN : PositionOutcome.LOSS,
        sizeUsd: isHighConviction ? averageSize * 10 : averageSize,
        isHighConviction,
        daysAgo,
      })
    );
  }

  return positions;
}

// ============================================================================
// E2E Tests
// ============================================================================

describe("Win Rate Tracker E2E", () => {
  let tracker: WinRateTracker;

  beforeEach(() => {
    tracker = new WinRateTracker();
    resetSharedWinRateTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  // --------------------------------------------------------------------------
  // Realistic Trading Scenarios
  // --------------------------------------------------------------------------

  describe("Realistic Trading Scenarios", () => {
    it("should correctly analyze a typical retail trader", () => {
      // Retail trader: ~50% win rate, small sizes, varied markets
      const positions = createTraderHistory(WALLETS.RETAIL, {
        totalPositions: 30,
        winRate: 50,
        categories: ["crypto", "sports", "politics"],
        averageSize: 50,
        spreadDays: 60,
      });

      positions.forEach((p) => tracker.addPosition(p));
      const result = tracker.analyze(WALLETS.RETAIL);

      expect(result.category).toBe(WinRateCategory.AVERAGE);
      // 50% win rate with 30 positions might have LOW suspicion if there's a streak or other pattern
      expect([WinRateSuspicionLevel.NONE, WinRateSuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
      expect(result.isPotentialInsider).toBe(false);
      // Win rate should be around 50% (rounding to nearest position)
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBeGreaterThanOrEqual(45);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBeLessThanOrEqual(55);
    });

    it("should correctly analyze a skilled trader with above-average performance", () => {
      // Skilled trader: ~65% win rate, consistent sizes
      const positions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 50,
        winRate: 66,
        categories: ["crypto"],
        averageSize: 200,
        spreadDays: 90,
      });

      positions.forEach((p) => tracker.addPosition(p));
      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.category).toBe(WinRateCategory.HIGH);
      // 65% win rate with 50 positions might have LOW suspicion, that's acceptable
      expect([WinRateSuspicionLevel.NONE, WinRateSuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
      expect(result.isPotentialInsider).toBe(false);
    });

    it("should flag a potential insider with suspicious patterns", () => {
      // Potential insider: 90% win rate, high conviction trades before events
      const positions = createTraderHistory(WALLETS.INSIDER_SUSPECT, {
        totalPositions: 25,
        winRate: 92,
        categories: ["politics"],
        highConvictionRate: 0.8,
        averageSize: 1000,
        spreadDays: 30,
      });

      // Add time to resolution for some positions (trades close to events)
      positions.forEach((p, i) => {
        if (i % 2 === 0) {
          p.timeToResolutionHours = 12;
        }
      });

      positions.forEach((p) => tracker.addPosition(p));
      const result = tracker.analyze(WALLETS.INSIDER_SUSPECT);

      expect(result.category).toBe(WinRateCategory.EXCEPTIONAL);
      expect(
        [WinRateSuspicionLevel.HIGH, WinRateSuspicionLevel.CRITICAL].includes(
          result.suspicionLevel
        )
      ).toBe(true);
      expect(result.isPotentialInsider).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });

    it("should correctly analyze a whale trader", () => {
      // Whale: large positions, moderate win rate
      const positions = createTraderHistory(WALLETS.WHALE, {
        totalPositions: 20,
        winRate: 50,
        categories: ["crypto", "politics"],
        averageSize: 50000,
        spreadDays: 60,
      });

      positions.forEach((p) => tracker.addPosition(p));
      const result = tracker.analyze(WALLETS.WHALE);

      // 50% win rate should be AVERAGE, 55% might round up to ABOVE_AVERAGE
      expect([WinRateCategory.AVERAGE, WinRateCategory.ABOVE_AVERAGE]).toContain(
        result.category
      );
      expect(result.windowStats[WinRateWindow.ALL_TIME].totalWinProfit).toBeGreaterThan(
        100000
      );
    });
  });

  // --------------------------------------------------------------------------
  // Multi-Wallet Analysis
  // --------------------------------------------------------------------------

  describe("Multi-Wallet Analysis", () => {
    it("should correctly rank wallets by win rate", () => {
      // Create traders with different win rates
      const traders = [
        { wallet: WALLETS.TRADER_1, winRate: 80 },
        { wallet: WALLETS.TRADER_2, winRate: 60 },
        { wallet: WALLETS.TRADER_3, winRate: 45 },
        { wallet: WALLETS.TRADER_4, winRate: 70 },
        { wallet: WALLETS.TRADER_5, winRate: 55 },
      ];

      traders.forEach(({ wallet, winRate }) => {
        const positions = createTraderHistory(wallet, {
          totalPositions: 20,
          winRate,
        });
        positions.forEach((p) => tracker.addPosition(p));
      });

      const highWinRateWallets = tracker.getHighWinRateWallets(60);

      expect(highWinRateWallets.length).toBe(3); // 80%, 70%, 60%
      expect(highWinRateWallets[0]?.walletAddress.toLowerCase()).toBe(
        WALLETS.TRADER_1.toLowerCase()
      );
    });

    it("should batch analyze multiple wallets efficiently", () => {
      const walletAddresses = [
        WALLETS.TRADER_1,
        WALLETS.TRADER_2,
        WALLETS.TRADER_3,
      ];

      walletAddresses.forEach((wallet, idx) => {
        const positions = createTraderHistory(wallet, {
          totalPositions: 15,
          winRate: 50 + idx * 10,
        });
        positions.forEach((p) => tracker.addPosition(p));
      });

      const result = tracker.batchAnalyze(walletAddresses);

      expect(result.results.size).toBe(3);
      expect(result.failed.size).toBe(0);
      expect(result.totalProcessed).toBe(3);
    });

    it("should identify potential insiders among many wallets", () => {
      // Create a mix of normal and suspicious traders
      const normalTraders = [
        WALLETS.TRADER_1,
        WALLETS.TRADER_2,
        WALLETS.TRADER_3,
      ];
      const suspiciousTrader = WALLETS.INSIDER_SUSPECT;

      normalTraders.forEach((wallet) => {
        const positions = createTraderHistory(wallet, {
          totalPositions: 20,
          winRate: 52,
        });
        positions.forEach((p) => tracker.addPosition(p));
      });

      // Create suspicious trader with exceptional performance
      const suspiciousPositions = createTraderHistory(suspiciousTrader, {
        totalPositions: 25,
        winRate: 92,
        highConvictionRate: 0.9,
      });
      suspiciousPositions.forEach((p) => tracker.addPosition(p));

      const potentialInsiders = tracker.getPotentialInsiders();

      expect(potentialInsiders.length).toBeGreaterThanOrEqual(1);
      expect(
        potentialInsiders.some(
          (r) =>
            r.walletAddress.toLowerCase() === suspiciousTrader.toLowerCase()
        )
      ).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Category Specialization
  // --------------------------------------------------------------------------

  describe("Category Specialization", () => {
    it("should detect category specialization", () => {
      // Trader who specializes in politics with high win rate
      const politicsPositions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 20,
        winRate: 85,
        categories: ["politics"],
      });

      const cryptoPositions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 5,
        winRate: 40,
        categories: ["crypto"],
      });

      [...politicsPositions, ...cryptoPositions].forEach((p) =>
        tracker.addPosition(p)
      );

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.topCategories[0]).toBe("politics");

      const politicsStats = result.categoryWinRates.find(
        (c) => c.category === "politics"
      );
      expect(politicsStats?.winRate).toBe(85);

      const specializationAnomaly = result.anomalies.find(
        (a) => a.type === "category_specialization"
      );
      expect(specializationAnomaly).toBeDefined();
    });

    it("should track performance across multiple categories", () => {
      const categories = ["crypto", "politics", "sports", "entertainment"];

      categories.forEach((category, idx) => {
        const positions = createTraderHistory(WALLETS.TRADER_1, {
          totalPositions: 10,
          winRate: 40 + idx * 15, // 40%, 55%, 70%, 85%
          categories: [category],
        });
        positions.forEach((p) => tracker.addPosition(p));
      });

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.categoryWinRates.length).toBe(4);

      const entertainmentStats = result.categoryWinRates.find(
        (c) => c.category === "entertainment"
      );
      // Due to rounding: 85% of 10 = 8.5 -> 9 wins = 90% or 8 wins = 80%
      expect(entertainmentStats?.winRate).toBeGreaterThanOrEqual(80);
      expect(entertainmentStats?.winRate).toBeLessThanOrEqual(90);
    });
  });

  // --------------------------------------------------------------------------
  // Time Window Analysis
  // --------------------------------------------------------------------------

  describe("Time Window Analysis", () => {
    it("should correctly calculate win rates for different time windows", () => {
      // Create positions spread over time

      // Old positions (60+ days ago) - 40% win rate
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 4 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 70 + i,
          })
        );
      }

      // Recent positions (within 7 days) - 80% win rate
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 8 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: i,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);

      // All-time should be 60% (12/20 wins)
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(60);

      // Week should have mostly recent positions (daysAgo: 0-6)
      // Positions daysAgo: 0, 1, 2, 3, 4, 5, 6 are within 7 days = 7 positions
      // 6 wins out of 7 = ~86%
      expect(result.windowStats[WinRateWindow.WEEK].winRate).toBeGreaterThanOrEqual(80);

      // Month should only include recent 10 positions (within 30 days)
      expect(result.windowStats[WinRateWindow.MONTH].winRate).toBe(80);

      // Quarter should show improving trend (has both old and new)
      expect(result.trend.direction).toBe("improving");
    });
  });

  // --------------------------------------------------------------------------
  // Streak Detection
  // --------------------------------------------------------------------------

  describe("Streak Detection", () => {
    it("should detect long win streaks", () => {
      // Create a 15-win streak
      for (let i = 0; i < 15; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: PositionOutcome.WIN,
            daysAgo: i,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.streaks.longestWinStreak).toBe(15);
      expect(result.streaks.currentStreakType).toBe("win");
      expect(result.streaks.currentStreakLength).toBe(15);

      // Should detect perfect timing anomaly
      const streakAnomaly = result.anomalies.find(
        (a) => a.type === "perfect_timing"
      );
      expect(streakAnomaly).toBeDefined();
    });

    it("should track streak changes", () => {
      const outcomes = [
        PositionOutcome.WIN,
        PositionOutcome.WIN,
        PositionOutcome.WIN,
        PositionOutcome.LOSS,
        PositionOutcome.LOSS,
        PositionOutcome.WIN,
        PositionOutcome.WIN,
        PositionOutcome.WIN,
        PositionOutcome.WIN,
        PositionOutcome.LOSS,
      ];

      outcomes.forEach((outcome, i) => {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome,
            daysAgo: 10 - i,
          })
        );
      });

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.streaks.longestWinStreak).toBe(4);
      expect(result.streaks.longestLossStreak).toBe(2);
      expect(result.streaks.currentStreakType).toBe("loss");
      expect(result.streaks.currentStreakLength).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // High Conviction Trading
  // --------------------------------------------------------------------------

  describe("High Conviction Trading", () => {
    it("should detect high conviction trading accuracy", () => {
      // Normal trades: 50% win rate
      for (let i = 0; i < 20; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 10 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            isHighConviction: false,
            sizeUsd: 100,
          })
        );
      }

      // High conviction trades: 95% win rate (suspicious)
      for (let i = 0; i < 20; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 19 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            isHighConviction: true,
            sizeUsd: 5000,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);

      // Should detect high conviction accuracy anomaly
      const hcAnomaly = result.anomalies.find(
        (a) => a.type === "high_conviction_accuracy"
      );
      expect(hcAnomaly).toBeDefined();
      expect(hcAnomaly?.severity).toBeGreaterThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // Trend Analysis
  // --------------------------------------------------------------------------

  describe("Trend Analysis", () => {
    it("should detect improving trend", () => {
      // First 20 positions: 30% win rate
      for (let i = 0; i < 20; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 6 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 40 - i,
          })
        );
      }

      // Last 10 positions: 80% win rate
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 8 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 10 - i,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.trend.direction).toBe("improving");
      expect(result.trend.recentWinRate).toBeGreaterThan(
        result.trend.historicalWinRate
      );
    });

    it("should detect declining trend", () => {
      // First 20 positions: 80% win rate
      for (let i = 0; i < 20; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 16 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 40 - i,
          })
        );
      }

      // Last 10 positions: 20% win rate
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 2 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 10 - i,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.trend.direction).toBe("declining");
      expect(result.trend.recentWinRate).toBeLessThan(
        result.trend.historicalWinRate
      );
    });
  });

  // --------------------------------------------------------------------------
  // Historical Data
  // --------------------------------------------------------------------------

  describe("Historical Data", () => {
    it("should generate correct historical win rate data", () => {
      // Add 20 positions with mixed outcomes
      for (let i = 0; i < 20; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: i % 2 === 0 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            daysAgo: 20 - i,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1, { includeHistory: true });

      expect(result.history.length).toBe(20);

      // Check that win rate converges to 50%
      const lastDataPoint = result.history[result.history.length - 1];
      expect(lastDataPoint?.winRate).toBe(50);
      expect(lastDataPoint?.cumulativeWins).toBe(10);
      expect(lastDataPoint?.cumulativeTotal).toBe(20);
    });
  });

  // --------------------------------------------------------------------------
  // P&L Calculations
  // --------------------------------------------------------------------------

  describe("P&L Calculations", () => {
    it("should calculate correct profit metrics", () => {
      // 5 wins with 200 profit each = 1000 total
      for (let i = 0; i < 5; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: PositionOutcome.WIN,
            realizedPnl: 200,
            sizeUsd: 200,
          })
        );
      }

      // 3 losses with -100 each = -300 total
      for (let i = 0; i < 3; i++) {
        tracker.addPosition(
          createTestPosition({
            walletAddress: WALLETS.TRADER_1,
            outcome: PositionOutcome.LOSS,
            realizedPnl: -100,
            sizeUsd: 100,
          })
        );
      }

      const result = tracker.analyze(WALLETS.TRADER_1);
      const allTime = result.windowStats[WinRateWindow.ALL_TIME];

      expect(allTime.totalWinProfit).toBe(1000);
      expect(allTime.totalLoss).toBe(300);
      expect(allTime.netPnl).toBe(700);
      expect(allTime.avgWinProfit).toBe(200);
      expect(allTime.avgLoss).toBe(100);
      expect(allTime.profitFactor).toBeCloseTo(1000 / 300, 2);
    });
  });

  // --------------------------------------------------------------------------
  // Integration with Shared Instance
  // --------------------------------------------------------------------------

  describe("Shared Instance Integration", () => {
    it("should work with shared tracker instance", () => {
      const positions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 15,
        winRate: 70,
      });

      addPositionsForWinRate(positions);

      const result = analyzeWinRate(WALLETS.TRADER_1);
      // 70% of 15 = 10.5 -> rounds to 11 wins = 73.33% or 10 wins = 66.67%
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBeGreaterThanOrEqual(65);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBeLessThanOrEqual(75);

      const summary = getWinRateTrackerSummary();
      expect(summary.totalWallets).toBe(1);
      expect(summary.totalPositions).toBe(15);
    });

    it("should correctly use convenience functions", () => {
      // Add a high win rate wallet
      const insiderPositions = createTraderHistory(WALLETS.INSIDER_SUSPECT, {
        totalPositions: 30,
        winRate: 93,
        highConvictionRate: 0.8,
      });
      addPositionsForWinRate(insiderPositions);

      // Add a normal wallet
      const normalPositions = createTraderHistory(WALLETS.RETAIL, {
        totalPositions: 20,
        winRate: 50,
      });
      addPositionsForWinRate(normalPositions);

      expect(hasUnusuallyHighWinRate(WALLETS.INSIDER_SUSPECT)).toBe(true);
      expect(hasUnusuallyHighWinRate(WALLETS.RETAIL)).toBe(false);

      const highWinRate = getHighWinRateWallets(80);
      expect(highWinRate.length).toBe(1);

      const insiders = getPotentialInsidersByWinRate();
      expect(insiders.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle wallet with only wins", () => {
      const positions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 10,
        winRate: 100,
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(100);
      expect(result.windowStats[WinRateWindow.ALL_TIME].profitFactor).toBe(
        Infinity
      );
    });

    it("should handle wallet with only losses", () => {
      const positions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 10,
        winRate: 0,
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(0);
      expect(result.windowStats[WinRateWindow.ALL_TIME].profitFactor).toBe(0);
    });

    it("should handle rapid position additions", () => {
      // Add many positions quickly
      const positions = createTraderHistory(WALLETS.TRADER_1, {
        totalPositions: 100,
        winRate: 55,
      });

      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLETS.TRADER_1);

      expect(result.totalPositions).toBe(100);
      expect(result.dataQuality).toBe(100);
    });

    it("should handle position updates", () => {
      // Add initial position
      const position = createTestPosition({
        walletAddress: WALLETS.TRADER_1,
        outcome: PositionOutcome.WIN,
      });
      tracker.addPosition(position);

      // Update same position to loss
      const updatedPosition = {
        ...position,
        outcome: PositionOutcome.LOSS,
        realizedPnl: -100,
      };
      tracker.addPosition(updatedPosition);

      const result = tracker.analyze(WALLETS.TRADER_1);

      // Should only have 1 position
      expect(result.totalPositions).toBe(1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].losses).toBe(1);
    });
  });
});
