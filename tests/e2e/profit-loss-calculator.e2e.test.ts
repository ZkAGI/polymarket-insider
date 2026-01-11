/**
 * E2E Tests for Profit/Loss Calculator (DET-PAT-005)
 *
 * These tests simulate realistic trading scenarios to validate the
 * profit/loss calculator's behavior across different wallet profiles.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ProfitLossCalculator,
  PositionStatus,
  PnlTier,
  PnlSuspicionLevel,
  PnlWindow,
  PnlPosition,
  createProfitLossCalculator,
  resetSharedProfitLossCalculator,
} from "../../src/detection/profit-loss-calculator";
import { MarketCategory } from "../../src/api/gamma/types";

// Test wallet addresses
const RETAIL_TRADER = "0x1111111111111111111111111111111111111111";
const WHALE_TRADER = "0x2222222222222222222222222222222222222222";
const POTENTIAL_INSIDER = "0x3333333333333333333333333333333333333333";
const LOSING_TRADER = "0x4444444444444444444444444444444444444444";
const CATEGORY_SPECIALIST = "0x5555555555555555555555555555555555555555";
const DAY_TRADER = "0x6666666666666666666666666666666666666666";
const MARKET_MAKER = "0x7777777777777777777777777777777777777777";

// Helper to create random position ID
function randomPositionId(): string {
  return `pos-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create random market ID
function randomMarketId(): string {
  return `market-${Math.random().toString(36).substr(2, 6)}`;
}

// Helper to create a realistic closed position
function createPosition(
  walletAddress: string,
  costBasis: number,
  exitValue: number,
  options: {
    category?: MarketCategory | string;
    entryTimestamp?: Date;
    exitTimestamp?: Date;
    fees?: number;
    isHighConviction?: boolean;
  } = {}
): PnlPosition {
  const {
    category,
    entryTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    exitTimestamp = new Date(),
    fees = costBasis * 0.001, // 0.1% fee
    isHighConviction = false,
  } = options;

  const shares = costBasis * 2; // Assume $0.50 entry price
  const entryPrice = 0.5;
  const exitPrice = exitValue / shares;

  return {
    positionId: randomPositionId(),
    marketId: randomMarketId(),
    marketCategory: category,
    walletAddress,
    side: "buy",
    shares,
    entryPrice,
    exitPrice,
    costBasis,
    exitValue,
    status: PositionStatus.CLOSED,
    entryTimestamp,
    exitTimestamp,
    fees,
    isHighConviction,
  };
}

// Helper to create an open position
function createOpenPosition(
  walletAddress: string,
  costBasis: number,
  currentValue: number,
  options: {
    category?: MarketCategory | string;
    entryTimestamp?: Date;
  } = {}
): PnlPosition {
  const {
    category,
    entryTimestamp = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  } = options;

  const shares = costBasis * 2;

  return {
    positionId: randomPositionId(),
    marketId: randomMarketId(),
    marketCategory: category,
    walletAddress,
    side: "buy",
    shares,
    entryPrice: 0.5,
    currentPrice: currentValue / shares,
    costBasis,
    currentValue,
    status: PositionStatus.OPEN,
    entryTimestamp,
    fees: costBasis * 0.001,
  };
}

describe("E2E: Profit/Loss Calculator Scenarios", () => {
  let calculator: ProfitLossCalculator;

  beforeEach(() => {
    calculator = createProfitLossCalculator();
    resetSharedProfitLossCalculator();
  });

  afterEach(() => {
    calculator.clear();
    resetSharedProfitLossCalculator();
  });

  describe("Scenario: Retail Trader with Average Performance", () => {
    beforeEach(() => {
      // Simulate 50 trades over 3 months
      // ~52% win rate, modest position sizes, mix of categories
      const categories = [
        MarketCategory.POLITICS,
        MarketCategory.CRYPTO,
        MarketCategory.SPORTS,
        MarketCategory.ENTERTAINMENT,
        MarketCategory.SCIENCE,
      ];

      for (let i = 0; i < 50; i++) {
        const isWin = Math.random() < 0.52;
        const costBasis = 50 + Math.random() * 150; // $50-200 positions
        const returnPct = isWin
          ? 0.1 + Math.random() * 0.4 // 10-50% profit
          : -(0.1 + Math.random() * 0.3); // 10-40% loss

        const exitValue = costBasis * (1 + returnPct);
        const daysAgo = Math.floor(Math.random() * 90);

        calculator.addPosition(
          createPosition(RETAIL_TRADER, costBasis, exitValue, {
            category: categories[i % categories.length],
            entryTimestamp: new Date(
              Date.now() - (daysAgo + 7) * 24 * 60 * 60 * 1000
            ),
            exitTimestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          })
        );
      }
    });

    it("should correctly identify as retail trader", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      expect(result.totalPositions).toBe(50);
      expect(result.dataQuality).toBeGreaterThanOrEqual(80);
      expect(result.tier).not.toBe(PnlTier.UNKNOWN);
    });

    it("should have low suspicion level", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      expect([PnlSuspicionLevel.NONE, PnlSuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
      expect(result.isPotentialInsider).toBe(false);
    });

    it("should have diverse category breakdown", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      expect(result.categoryStats.length).toBeGreaterThan(3);
    });

    it("should have reasonable P&L metrics", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      const allTimeStats = result.windowStats[PnlWindow.ALL_TIME];

      // Should have both wins and losses
      expect(allTimeStats.profitablePositions).toBeGreaterThan(0);
      expect(allTimeStats.losingPositions).toBeGreaterThan(0);

      // Profit factor should be reasonable (0.5-2.5 for average trader)
      expect(allTimeStats.profitFactor).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Whale Trader with Large Positions", () => {
    beforeEach(() => {
      // Simulate 30 large trades
      // 55% win rate, large positions ($5k-50k)
      for (let i = 0; i < 30; i++) {
        const isWin = Math.random() < 0.55;
        const costBasis = 5000 + Math.random() * 45000; // $5k-50k positions
        const returnPct = isWin
          ? 0.15 + Math.random() * 0.35
          : -(0.1 + Math.random() * 0.25);

        const exitValue = costBasis * (1 + returnPct);
        const daysAgo = Math.floor(Math.random() * 60);

        calculator.addPosition(
          createPosition(WHALE_TRADER, costBasis, exitValue, {
            category: MarketCategory.CRYPTO,
            entryTimestamp: new Date(
              Date.now() - (daysAgo + 5) * 24 * 60 * 60 * 1000
            ),
            exitTimestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
            isHighConviction: costBasis > 30000,
          })
        );
      }
    });

    it("should have significant total P&L", () => {
      const result = calculator.analyze(WHALE_TRADER);

      // Whale trades should result in large absolute P&L numbers
      expect(
        Math.abs(result.aggregates.totalRealizedPnl)
      ).toBeGreaterThan(1000);
    });

    it("should track high conviction trades", () => {
      const result = calculator.analyze(WHALE_TRADER);

      // Should have some high conviction trades
      const highConvictionCount = result.realizedPnl.filter((r) => {
        const position = calculator
          .getPositions(WHALE_TRADER)
          .find((p) => p.positionId === r.positionId);
        return position?.isHighConviction;
      }).length;

      expect(highConvictionCount).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Potential Insider with Suspicious Pattern", () => {
    beforeEach(() => {
      // Simulate extremely successful trader
      // 85% win rate, excellent timing, category specialization
      const politicalEvents = [
        { days: 45, win: true, conviction: true },
        { days: 42, win: true, conviction: false },
        { days: 38, win: true, conviction: true },
        { days: 35, win: false, conviction: false },
        { days: 32, win: true, conviction: true },
        { days: 28, win: true, conviction: false },
        { days: 25, win: true, conviction: true },
        { days: 22, win: true, conviction: false },
        { days: 18, win: true, conviction: true },
        { days: 15, win: false, conviction: false },
        { days: 12, win: true, conviction: true },
        { days: 10, win: true, conviction: false },
        { days: 8, win: true, conviction: true },
        { days: 6, win: true, conviction: false },
        { days: 4, win: true, conviction: true },
        { days: 3, win: true, conviction: true },
        { days: 2, win: true, conviction: true },
        { days: 1, win: true, conviction: false },
        { days: 0, win: true, conviction: true },
        { days: 0, win: true, conviction: true },
      ];

      for (const event of politicalEvents) {
        const costBasis = event.conviction ? 5000 : 1000;
        const returnPct = event.win ? 0.8 : -0.15; // Deterministic: 80% profit or 15% loss
        const exitValue = costBasis * (1 + returnPct);

        calculator.addPosition(
          createPosition(POTENTIAL_INSIDER, costBasis, exitValue, {
            category: MarketCategory.POLITICS,
            entryTimestamp: new Date(
              Date.now() - (event.days + 2) * 24 * 60 * 60 * 1000
            ),
            exitTimestamp: new Date(
              Date.now() - event.days * 24 * 60 * 60 * 1000
            ),
            isHighConviction: event.conviction,
          })
        );
      }
    });

    it("should flag as potential insider", () => {
      const result = calculator.analyze(POTENTIAL_INSIDER);

      // Default config requires minPositionsForHighConfidence (20) and high ROI + win rate
      // We have 20 positions with 90% win rate and high ROI
      expect(result.isPotentialInsider).toBe(true);
    });

    it("should have high suspicion score", () => {
      const result = calculator.analyze(POTENTIAL_INSIDER);

      expect(result.suspicionScore).toBeGreaterThan(40);
      expect([
        PnlSuspicionLevel.MEDIUM,
        PnlSuspicionLevel.HIGH,
        PnlSuspicionLevel.CRITICAL,
      ]).toContain(result.suspicionLevel);
    });

    it("should detect exceptional returns anomaly", () => {
      const result = calculator.analyze(POTENTIAL_INSIDER);

      const hasExceptionalReturnsAnomaly = result.anomalies.some(
        (a) => a.type === "exceptional_returns" || a.type === "consistent_profitability"
      );
      expect(hasExceptionalReturnsAnomaly).toBe(true);
    });

    it("should detect category specialization", () => {
      const result = calculator.analyze(POTENTIAL_INSIDER);

      // Should have politics as top category
      expect(result.topCategories).toContain(MarketCategory.POLITICS);

      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );
      expect(politicsStats).toBeDefined();
      expect(politicsStats!.winRate).toBeGreaterThan(70);
    });
  });

  describe("Scenario: Losing Trader with Negative P&L", () => {
    beforeEach(() => {
      // Simulate consistently losing trader
      // 35% win rate, poor risk management
      for (let i = 0; i < 40; i++) {
        const isWin = Math.random() < 0.35;
        const costBasis = 100 + Math.random() * 400;
        const returnPct = isWin
          ? 0.1 + Math.random() * 0.2 // Small wins
          : -(0.3 + Math.random() * 0.4); // Large losses

        const exitValue = costBasis * (1 + returnPct);
        const daysAgo = Math.floor(Math.random() * 60);

        calculator.addPosition(
          createPosition(LOSING_TRADER, costBasis, exitValue, {
            category:
              i % 2 === 0 ? MarketCategory.SPORTS : MarketCategory.CRYPTO,
            entryTimestamp: new Date(
              Date.now() - (daysAgo + 3) * 24 * 60 * 60 * 1000
            ),
            exitTimestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          })
        );
      }
    });

    it("should have negative overall P&L", () => {
      const result = calculator.analyze(LOSING_TRADER);

      expect(result.aggregates.totalRealizedPnl).toBeLessThan(0);
      expect(result.aggregates.overallRoi).toBeLessThan(0);
    });

    it("should be categorized as loss tier", () => {
      const result = calculator.analyze(LOSING_TRADER);

      expect([
        PnlTier.MASSIVE_LOSS,
        PnlTier.LARGE_LOSS,
        PnlTier.MODERATE_LOSS,
        PnlTier.SMALL_LOSS,
      ]).toContain(result.tier);
    });

    it("should have poor profit factor", () => {
      const result = calculator.analyze(LOSING_TRADER);

      const allTimeStats = result.windowStats[PnlWindow.ALL_TIME];
      expect(allTimeStats.profitFactor).toBeLessThan(1);
    });

    it("should have more losing positions than winning", () => {
      const result = calculator.analyze(LOSING_TRADER);

      const allTimeStats = result.windowStats[PnlWindow.ALL_TIME];
      expect(allTimeStats.losingPositions).toBeGreaterThan(
        allTimeStats.profitablePositions
      );
    });
  });

  describe("Scenario: Category Specialist (Political Markets)", () => {
    beforeEach(() => {
      // Trader focuses exclusively on political markets
      // Deterministic: all politics trades are wins, all sports trades are losses
      // Politics: 20 positions with +40% return
      for (let i = 0; i < 20; i++) {
        const costBasis = 1000;
        const exitValue = costBasis * 1.4; // +40% profit

        calculator.addPosition(
          createPosition(CATEGORY_SPECIALIST, costBasis, exitValue, {
            category: MarketCategory.POLITICS,
            entryTimestamp: new Date(Date.now() - (i + 10) * 24 * 60 * 60 * 1000),
            exitTimestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })
        );
      }

      // Sports: 5 positions with -20% return
      for (let i = 0; i < 5; i++) {
        const costBasis = 100;
        const exitValue = costBasis * 0.8; // -20% loss

        calculator.addPosition(
          createPosition(CATEGORY_SPECIALIST, costBasis, exitValue, {
            category: MarketCategory.SPORTS,
            entryTimestamp: new Date(Date.now() - (i + 10) * 24 * 60 * 60 * 1000),
            exitTimestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })
        );
      }
    });

    it("should show politics as top category", () => {
      const result = calculator.analyze(CATEGORY_SPECIALIST);

      // Politics has higher ROI, should be first in top categories
      expect(result.topCategories).toContain(MarketCategory.POLITICS);
    });

    it("should have higher returns in specialized category", () => {
      const result = calculator.analyze(CATEGORY_SPECIALIST);

      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );
      const sportsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.SPORTS
      );

      expect(politicsStats).toBeDefined();
      expect(sportsStats).toBeDefined();
      // Politics has +40%, Sports has -20%
      expect(politicsStats!.avgRoi).toBeGreaterThan(sportsStats!.avgRoi);
    });

    it("should have most positions in politics", () => {
      const result = calculator.analyze(CATEGORY_SPECIALIST);

      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );

      expect(politicsStats!.totalPositions).toBe(20);
    });
  });

  describe("Scenario: Day Trader with High Frequency", () => {
    beforeEach(() => {
      // Simulate day trader with many short-term positions
      // 54% win rate, small positions, quick exits
      for (let i = 0; i < 100; i++) {
        const isWin = Math.random() < 0.54;
        const costBasis = 50 + Math.random() * 100; // Small positions
        const returnPct = isWin ? 0.05 + Math.random() * 0.15 : -0.03 - Math.random() * 0.1;
        const exitValue = costBasis * (1 + returnPct);

        const entryTime = new Date(
          Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
        );
        const holdingPeriod = 1 + Math.floor(Math.random() * 4); // 1-4 hours
        const exitTime = new Date(entryTime.getTime() + holdingPeriod * 60 * 60 * 1000);

        calculator.addPosition(
          createPosition(DAY_TRADER, costBasis, exitValue, {
            entryTimestamp: entryTime,
            exitTimestamp: exitTime,
          })
        );
      }
    });

    it("should have many positions", () => {
      const result = calculator.analyze(DAY_TRADER);

      expect(result.totalPositions).toBe(100);
      expect(result.dataQuality).toBe(100);
    });

    it("should have short average holding period", () => {
      const result = calculator.analyze(DAY_TRADER);

      // Average holding period in realized P&L
      const avgHoldingPeriod =
        result.realizedPnl.reduce((sum, r) => sum + r.holdingPeriod, 0) /
        result.realizedPnl.length;

      // Should be less than a day in milliseconds
      expect(avgHoldingPeriod).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it("should have small average position size", () => {
      const result = calculator.analyze(DAY_TRADER);

      const avgCostBasis =
        result.realizedPnl.reduce((sum, r) => sum + r.costBasis, 0) /
        result.realizedPnl.length;

      expect(avgCostBasis).toBeLessThan(200);
    });
  });

  describe("Scenario: Mixed Open and Closed Positions", () => {
    beforeEach(() => {
      // Simulate trader with both open and closed positions
      // Add closed positions
      for (let i = 0; i < 15; i++) {
        const isWin = Math.random() < 0.6;
        const costBasis = 200 + Math.random() * 300;
        const returnPct = isWin ? 0.2 + Math.random() * 0.3 : -0.15;
        const exitValue = costBasis * (1 + returnPct);

        calculator.addPosition(
          createPosition(MARKET_MAKER, costBasis, exitValue, {
            category: MarketCategory.CRYPTO,
          })
        );
      }

      // Add open positions
      for (let i = 0; i < 5; i++) {
        const costBasis = 300 + Math.random() * 400;
        const currentPnlPct = -0.1 + Math.random() * 0.3;
        const currentValue = costBasis * (1 + currentPnlPct);

        calculator.addPosition(
          createOpenPosition(MARKET_MAKER, costBasis, currentValue, {
            category: MarketCategory.CRYPTO,
          })
        );
      }
    });

    it("should correctly separate realized and unrealized P&L", () => {
      const result = calculator.analyze(MARKET_MAKER);

      expect(result.realizedPnl.length).toBe(15);
      expect(result.unrealizedPnl.length).toBe(5);
      expect(result.aggregates.totalRealizedPnl).not.toBe(0);
    });

    it("should calculate total P&L as sum of realized and unrealized", () => {
      const result = calculator.analyze(MARKET_MAKER);

      const expectedTotal =
        result.aggregates.totalRealizedPnl +
        result.aggregates.totalUnrealizedPnl;

      expect(result.aggregates.totalPnl).toBeCloseTo(expectedTotal, 0.01);
    });

    it("should track open positions separately", () => {
      const result = calculator.analyze(MARKET_MAKER);

      const allTimeStats = result.windowStats[PnlWindow.ALL_TIME];
      expect(allTimeStats.openPositions).toBe(5);
      expect(allTimeStats.closedPositions).toBe(15);
    });
  });

  describe("Scenario: Trend Analysis - Improving Trader", () => {
    beforeEach(() => {
      // Simulate trader who improved over time
      // First 70% of trades: losing trades (deterministic)
      // Last 30% of trades: winning trades (deterministic)
      for (let i = 0; i < 30; i++) {
        const isRecent = i >= 21; // Last 9 are "recent"
        const isWin = isRecent; // Deterministic: recent trades are wins
        const costBasis = 200;
        const returnPct = isWin ? 0.5 : -0.2; // 50% profit or 20% loss
        const exitValue = costBasis * (1 + returnPct);

        const daysAgo = 60 - i * 2; // Spread over 60 days, older first

        calculator.addPosition(
          createPosition(RETAIL_TRADER, costBasis, exitValue, {
            entryTimestamp: new Date(
              Date.now() - (daysAgo + 2) * 24 * 60 * 60 * 1000
            ),
            exitTimestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          })
        );
      }
    });

    it("should detect improving trend", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      // Recent trades are all wins (+50%), historical trades are losses (-20%)
      expect(result.trend.recentRoi).toBeGreaterThan(result.trend.historicalRoi);
      expect(result.trend.direction).toBe("improving");
    });

    it("should have positive magnitude", () => {
      const result = calculator.analyze(RETAIL_TRADER);

      expect(result.trend.magnitude).toBeGreaterThan(10);
    });
  });

  describe("Scenario: Batch Analysis of Multiple Wallets", () => {
    beforeEach(() => {
      // Set up different traders
      // Whale
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(
          createPosition(WHALE_TRADER, 10000, 15000, {
            category: MarketCategory.CRYPTO,
          })
        );
      }

      // Retail
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(
          createPosition(RETAIL_TRADER, 100, i % 2 === 0 ? 120 : 80)
        );
      }

      // Loser
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(createPosition(LOSING_TRADER, 200, 100));
      }
    });

    it("should analyze all wallets in batch", () => {
      const batch = calculator.batchAnalyze([
        WHALE_TRADER,
        RETAIL_TRADER,
        LOSING_TRADER,
      ]);

      expect(batch.results.size).toBe(3);
      expect(batch.failed.size).toBe(0);
      expect(batch.totalProcessed).toBe(3);
    });

    it("should rank by P&L correctly", () => {
      const results = [
        calculator.analyze(WHALE_TRADER),
        calculator.analyze(RETAIL_TRADER),
        calculator.analyze(LOSING_TRADER),
      ].sort((a, b) => b.aggregates.totalRealizedPnl - a.aggregates.totalRealizedPnl);

      // Whale should be first (highest P&L)
      expect(results[0]!.walletAddress.toLowerCase()).toBe(
        WHALE_TRADER.toLowerCase()
      );

      // Loser should be last (lowest P&L)
      expect(results[2]!.walletAddress.toLowerCase()).toBe(
        LOSING_TRADER.toLowerCase()
      );
    });
  });

  describe("Scenario: High Return Wallets Filtering", () => {
    beforeEach(() => {
      // High performer
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(
          createPosition(POTENTIAL_INSIDER, 1000, 2000) // +100%
        );
      }

      // Moderate performer
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(
          createPosition(RETAIL_TRADER, 1000, 1300) // +30%
        );
      }

      // Low performer
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(
          createPosition(LOSING_TRADER, 1000, 900) // -10%
        );
      }
    });

    it("should find high return wallets correctly", () => {
      const highReturn = calculator.getHighReturnWallets(50);

      expect(highReturn.length).toBe(1);
      expect(highReturn[0]!.walletAddress.toLowerCase()).toBe(
        POTENTIAL_INSIDER.toLowerCase()
      );
    });

    it("should find multiple wallets with lower threshold", () => {
      const highReturn = calculator.getHighReturnWallets(20);

      expect(highReturn.length).toBe(2);
    });

    it("should sort by ROI descending", () => {
      const highReturn = calculator.getHighReturnWallets(0);

      for (let i = 0; i < highReturn.length - 1; i++) {
        expect(highReturn[i]!.aggregates.overallRoi).toBeGreaterThanOrEqual(
          highReturn[i + 1]!.aggregates.overallRoi
        );
      }
    });
  });

  describe("Scenario: Position Lifecycle Management", () => {
    it("should track position through complete lifecycle", () => {
      // Step 1: Open position
      const position = createOpenPosition(RETAIL_TRADER, 500, 500);
      calculator.addPosition(position);

      let result = calculator.analyze(RETAIL_TRADER);
      expect(result.unrealizedPnl.length).toBe(1);
      expect(result.realizedPnl.length).toBe(0);

      // Step 2: Price increases
      calculator.updatePositionPrice(RETAIL_TRADER, position.positionId, 0.6);

      result = calculator.analyze(RETAIL_TRADER);
      expect(result.aggregates.totalUnrealizedPnl).toBeGreaterThan(0);

      // Step 3: Close position
      calculator.closePosition(RETAIL_TRADER, position.positionId, 0.65);

      result = calculator.analyze(RETAIL_TRADER);
      expect(result.realizedPnl.length).toBe(1);
      expect(result.unrealizedPnl.length).toBe(0);
      expect(result.aggregates.totalRealizedPnl).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Summary Statistics", () => {
    beforeEach(() => {
      // Set up diverse portfolio of traders
      // Winner
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createPosition(WHALE_TRADER, 5000, 7500));
      }

      // Average
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(
          createPosition(RETAIL_TRADER, 100, i % 2 === 0 ? 120 : 90)
        );
      }

      // Loser
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createPosition(LOSING_TRADER, 500, 300));
      }

      // Open positions
      calculator.addPosition(
        createOpenPosition(CATEGORY_SPECIALIST, 1000, 1200)
      );
      calculator.addPosition(
        createOpenPosition(CATEGORY_SPECIALIST, 800, 700)
      );
    });

    it("should calculate correct summary statistics", () => {
      const summary = calculator.getSummary();

      expect(summary.totalWallets).toBe(4);
      expect(summary.totalPositions).toBe(17);
      expect(summary.openPositions).toBe(2);
      expect(summary.closedPositions).toBe(15);
    });

    it("should track aggregate P&L", () => {
      const summary = calculator.getSummary();

      // Whale: 5 * 2500 = 12500 profit
      // Retail: ~50 profit
      // Loser: 5 * -200 = -1000 loss
      // Net: ~11550

      expect(summary.aggregateRealizedPnl).toBeGreaterThan(10000);
      expect(summary.aggregateUnrealizedPnl).toBeDefined(); // Some open positions
    });

    it("should track tier distribution", () => {
      const summary = calculator.getSummary();

      // Whale has +50% ROI, Loser has -40% ROI
      // Large profit tier is 50-100%, Moderate profit is 25-50%
      // Large loss is -25% to -50%, Moderate loss is -10% to -25%
      expect(
        summary.tierDistribution[PnlTier.LARGE_PROFIT] +
        summary.tierDistribution[PnlTier.MODERATE_PROFIT]
      ).toBeGreaterThanOrEqual(1); // Whale

      expect(
        summary.tierDistribution[PnlTier.LARGE_LOSS] +
        summary.tierDistribution[PnlTier.MODERATE_LOSS]
      ).toBeGreaterThanOrEqual(1); // Loser
    });
  });

  describe("Scenario: Event Emission", () => {
    it("should emit events throughout trading lifecycle", async () => {
      const events: string[] = [];

      calculator.on("position-added", () => events.push("position-added"));
      calculator.on("position-updated", () => events.push("position-updated"));
      calculator.on("position-closed", () => events.push("position-closed"));
      calculator.on("analysis-complete", () => events.push("analysis-complete"));

      // Add position
      const position = createOpenPosition(RETAIL_TRADER, 500, 500);
      calculator.addPosition(position);

      // Update price
      calculator.updatePositionPrice(RETAIL_TRADER, position.positionId, 0.6);

      // Close position
      calculator.closePosition(RETAIL_TRADER, position.positionId, 0.65);

      // Analyze
      calculator.analyze(RETAIL_TRADER);

      expect(events).toContain("position-added");
      expect(events).toContain("position-updated");
      expect(events).toContain("position-closed");
      expect(events).toContain("analysis-complete");
    });

    it("should emit potential-insider event for suspicious wallets", () => {
      let insiderEventEmitted = false;

      const calc = createProfitLossCalculator({
        potentialInsiderRoiThreshold: 50,
        minConsistencyForInsider: 70,
        minPositionsForHighConfidence: 10,
      });

      calc.on("potential-insider", () => {
        insiderEventEmitted = true;
      });

      // Add positions that trigger insider flag
      for (let i = 0; i < 15; i++) {
        calc.addPosition(createPosition(POTENTIAL_INSIDER, 1000, 1800)); // +80%
      }
      for (let i = 0; i < 5; i++) {
        calc.addPosition(createPosition(POTENTIAL_INSIDER, 1000, 950)); // -5%
      }

      calc.analyze(POTENTIAL_INSIDER);

      expect(insiderEventEmitted).toBe(true);
    });
  });
});
