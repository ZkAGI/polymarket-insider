/**
 * Win Rate Tracker Tests (DET-PAT-004)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WinRateTracker,
  createWinRateTracker,
  getSharedWinRateTracker,
  setSharedWinRateTracker,
  resetSharedWinRateTracker,
  addPositionForWinRate,
  addPositionsForWinRate,
  analyzeWinRate,
  batchAnalyzeWinRates,
  hasUnusuallyHighWinRate,
  getHighWinRateWallets,
  getPotentialInsidersByWinRate,
  getWinRateTrackerSummary,
  getWinRateCategoryDescription,
  getWinRateSuspicionDescription,
  PositionOutcome,
  WinRateCategory,
  WinRateSuspicionLevel,
  WinRateWindow,
  WINDOW_DURATION_MS,
  DEFAULT_WIN_RATE_CONFIG,
  WIN_RATE_CATEGORY_THRESHOLDS,
  type ResolvedPosition,
} from "../../src/detection/win-rate-tracker";

// ============================================================================
// Test Helpers
// ============================================================================

const WALLET_1 = "0x1234567890abcdef1234567890abcdef12345678";
const WALLET_2 = "0xabcdef1234567890abcdef1234567890abcdef12";
const WALLET_3 = "0x9999888877776666555544443333222211110000";

function createPosition(
  overrides: Partial<ResolvedPosition> = {}
): ResolvedPosition {
  const now = new Date();
  return {
    positionId: `pos-${Math.random().toString(36).substr(2, 9)}`,
    marketId: `market-${Math.random().toString(36).substr(2, 9)}`,
    walletAddress: WALLET_1,
    side: "buy",
    sizeUsd: 100,
    entryPrice: 0.5,
    exitPrice: 1.0,
    entryTimestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    exitTimestamp: now,
    outcome: PositionOutcome.WIN,
    realizedPnl: 100,
    roi: 1.0,
    ...overrides,
  };
}

function createWinningPosition(
  walletAddress: string = WALLET_1,
  overrides: Partial<ResolvedPosition> = {}
): ResolvedPosition {
  return createPosition({
    walletAddress,
    outcome: PositionOutcome.WIN,
    realizedPnl: 100,
    roi: 1.0,
    ...overrides,
  });
}

function createLosingPosition(
  walletAddress: string = WALLET_1,
  overrides: Partial<ResolvedPosition> = {}
): ResolvedPosition {
  return createPosition({
    walletAddress,
    outcome: PositionOutcome.LOSS,
    exitPrice: 0,
    realizedPnl: -100,
    roi: -1.0,
    ...overrides,
  });
}

function createBreakevenPosition(
  walletAddress: string = WALLET_1,
  overrides: Partial<ResolvedPosition> = {}
): ResolvedPosition {
  return createPosition({
    walletAddress,
    outcome: PositionOutcome.BREAKEVEN,
    exitPrice: 0.5,
    realizedPnl: 0,
    roi: 0,
    ...overrides,
  });
}

function generatePositionsWithWinRate(
  walletAddress: string,
  count: number,
  winRate: number,
  options: { highConviction?: boolean; category?: string; daysBack?: number } = {}
): ResolvedPosition[] {
  const positions: ResolvedPosition[] = [];
  const winCount = Math.round(count * (winRate / 100));
  const now = new Date();
  const daysBack = options.daysBack || 30;

  for (let i = 0; i < count; i++) {
    const isWin = i < winCount;
    const exitTimestamp = new Date(
      now.getTime() - (daysBack * 24 * 60 * 60 * 1000 * (count - i)) / count
    );
    const entryTimestamp = new Date(exitTimestamp.getTime() - 60 * 60 * 1000);

    positions.push({
      positionId: `pos-${walletAddress}-${i}`,
      marketId: `market-${i % 5}`,
      marketCategory: options.category,
      walletAddress,
      side: "buy",
      sizeUsd: options.highConviction ? 1000 : 100,
      entryPrice: 0.5,
      exitPrice: isWin ? 1.0 : 0,
      entryTimestamp,
      exitTimestamp,
      outcome: isWin ? PositionOutcome.WIN : PositionOutcome.LOSS,
      realizedPnl: isWin ? 100 : -100,
      roi: isWin ? 1.0 : -1.0,
      isHighConviction: options.highConviction,
    });
  }

  return positions;
}

// ============================================================================
// Tests
// ============================================================================

describe("WinRateTracker", () => {
  let tracker: WinRateTracker;

  beforeEach(() => {
    tracker = new WinRateTracker();
    resetSharedWinRateTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  // --------------------------------------------------------------------------
  // Constructor and Configuration
  // --------------------------------------------------------------------------

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(tracker).toBeInstanceOf(WinRateTracker);
    });

    it("should create instance with custom config", () => {
      const customTracker = new WinRateTracker({
        minPositionsForAnalysis: 10,
        cacheTtl: 10000,
      });
      expect(customTracker).toBeInstanceOf(WinRateTracker);
    });

    it("should merge custom config with defaults", () => {
      const customTracker = new WinRateTracker({
        minPositionsForAnalysis: 10,
      });
      // Should use default for other values
      expect(customTracker).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Position Management
  // --------------------------------------------------------------------------

  describe("addPosition", () => {
    it("should add a position successfully", () => {
      const position = createWinningPosition();
      tracker.addPosition(position);
      const positions = tracker.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
    });

    it("should normalize wallet address", () => {
      const position = createWinningPosition(WALLET_1.toLowerCase());
      tracker.addPosition(position);
      const positions = tracker.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
    });

    it("should throw on invalid wallet address", () => {
      const position = createWinningPosition("invalid");
      expect(() => tracker.addPosition(position)).toThrow("Invalid wallet address");
    });

    it("should update existing position with same ID", () => {
      const position1 = createWinningPosition(WALLET_1, { positionId: "pos-1" });
      const position2 = createLosingPosition(WALLET_1, { positionId: "pos-1" });

      tracker.addPosition(position1);
      tracker.addPosition(position2);

      const positions = tracker.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
      expect(positions[0]?.outcome).toBe(PositionOutcome.LOSS);
    });

    it("should emit position-added event", () => {
      const handler = vi.fn();
      tracker.on("position-added", handler);

      const position = createWinningPosition();
      tracker.addPosition(position);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0]?.[0]?.position).toBeDefined();
    });

    it("should invalidate cache on new position", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 80);
      positions.forEach((p) => tracker.addPosition(p));

      // Analyze to populate cache
      tracker.analyze(WALLET_1);

      // Add new position
      tracker.addPosition(createLosingPosition());

      // Should recalculate
      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].totalPositions).toBe(11);
    });

    it("should respect maxPositionsPerWallet limit", () => {
      const customTracker = new WinRateTracker({ maxPositionsPerWallet: 5 });
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 50);
      positions.forEach((p) => customTracker.addPosition(p));

      const storedPositions = customTracker.getPositions(WALLET_1);
      expect(storedPositions).toHaveLength(5);
    });
  });

  describe("addPositions", () => {
    it("should add multiple positions at once", () => {
      const positions = [
        createWinningPosition(),
        createLosingPosition(),
        createBreakevenPosition(),
      ];
      tracker.addPositions(positions);
      expect(tracker.getPositions(WALLET_1)).toHaveLength(3);
    });
  });

  describe("getPositions", () => {
    it("should return empty array for unknown wallet", () => {
      const positions = tracker.getPositions(WALLET_1);
      expect(positions).toEqual([]);
    });

    it("should return positions for wallet", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 60);
      positions.forEach((p) => tracker.addPosition(p));
      expect(tracker.getPositions(WALLET_1)).toHaveLength(5);
    });
  });

  describe("clearPositions", () => {
    it("should clear positions for wallet", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 60);
      positions.forEach((p) => tracker.addPosition(p));

      tracker.clearPositions(WALLET_1);
      expect(tracker.getPositions(WALLET_1)).toHaveLength(0);
    });

    it("should not affect other wallets", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 5, 60);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 3, 50);
      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));

      tracker.clearPositions(WALLET_1);

      expect(tracker.getPositions(WALLET_1)).toHaveLength(0);
      expect(tracker.getPositions(WALLET_2)).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // Win Rate Analysis
  // --------------------------------------------------------------------------

  describe("analyze", () => {
    it("should throw on invalid wallet address", () => {
      expect(() => tracker.analyze("invalid")).toThrow("Invalid wallet address");
    });

    it("should return result for wallet with no positions", () => {
      const result = tracker.analyze(WALLET_1);
      expect(result.totalPositions).toBe(0);
      expect(result.category).toBe(WinRateCategory.UNKNOWN);
    });

    it("should calculate correct win rate for 100% wins", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 100);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(100);
      expect(result.category).toBe(WinRateCategory.EXCEPTIONAL);
    });

    it("should calculate correct win rate for 0% wins", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 0);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(0);
      expect(result.category).toBe(WinRateCategory.VERY_LOW);
    });

    it("should calculate correct win rate for 50% wins", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 50);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(50);
      expect(result.category).toBe(WinRateCategory.AVERAGE);
    });

    it("should use cache on subsequent calls", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => tracker.addPosition(p));

      tracker.analyze(WALLET_1);
      tracker.analyze(WALLET_1);

      const summary = tracker.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it("should emit analysis-complete event", () => {
      const handler = vi.fn();
      tracker.on("analysis-complete", handler);

      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => tracker.addPosition(p));
      tracker.analyze(WALLET_1);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit potential-insider event for high win rate", () => {
      const handler = vi.fn();
      tracker.on("potential-insider", handler);

      const positions = generatePositionsWithWinRate(WALLET_1, 25, 90);
      positions.forEach((p) => tracker.addPosition(p));
      tracker.analyze(WALLET_1);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should handle breakeven positions correctly", () => {
      const positions = [
        createWinningPosition(),
        createLosingPosition(),
        createBreakevenPosition(),
        createBreakevenPosition(),
        createWinningPosition(),
      ];
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].breakevens).toBe(2);
      expect(result.windowStats[WinRateWindow.ALL_TIME].wins).toBe(2);
      expect(result.windowStats[WinRateWindow.ALL_TIME].losses).toBe(1);
    });

    it("should filter pending positions", () => {
      const positions = [
        createWinningPosition(),
        createPosition({ outcome: PositionOutcome.PENDING }),
        createLosingPosition(),
      ];
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].totalPositions).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Window Stats
  // --------------------------------------------------------------------------

  describe("window stats", () => {
    it("should calculate stats for all time windows", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 60);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);

      expect(result.windowStats[WinRateWindow.ALL_TIME]).toBeDefined();
      expect(result.windowStats[WinRateWindow.DAY]).toBeDefined();
      expect(result.windowStats[WinRateWindow.WEEK]).toBeDefined();
      expect(result.windowStats[WinRateWindow.MONTH]).toBeDefined();
      expect(result.windowStats[WinRateWindow.QUARTER]).toBeDefined();
      expect(result.windowStats[WinRateWindow.YEAR]).toBeDefined();
    });

    it("should calculate correct P&L stats", () => {
      const positions = [
        createWinningPosition(WALLET_1, { realizedPnl: 200 }),
        createWinningPosition(WALLET_1, { realizedPnl: 100 }),
        createLosingPosition(WALLET_1, { realizedPnl: -50 }),
      ];
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      const allTime = result.windowStats[WinRateWindow.ALL_TIME];

      expect(allTime.totalWinProfit).toBe(300);
      expect(allTime.totalLoss).toBe(50);
      expect(allTime.netPnl).toBe(250);
      expect(allTime.avgWinProfit).toBe(150);
      expect(allTime.avgLoss).toBe(50);
    });

    it("should calculate profit factor correctly", () => {
      const positions = [
        createWinningPosition(WALLET_1, { realizedPnl: 200 }),
        createLosingPosition(WALLET_1, { realizedPnl: -100 }),
      ];
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].profitFactor).toBe(2);
    });

    it("should handle infinite profit factor (no losses)", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 100);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].profitFactor).toBe(Infinity);
    });
  });

  // --------------------------------------------------------------------------
  // Category Win Rates
  // --------------------------------------------------------------------------

  describe("category win rates", () => {
    it("should calculate category breakdown", () => {
      // Create positions with specific categories
      // 10 politics positions: 8 wins, 2 losses = 80% win rate
      const politicsPositions: ResolvedPosition[] = [];
      for (let i = 0; i < 10; i++) {
        politicsPositions.push(
          createPosition({
            positionId: `politics-${i}`,
            marketCategory: "politics",
            outcome: i < 8 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            realizedPnl: i < 8 ? 100 : -100,
            roi: i < 8 ? 1.0 : -1.0,
          })
        );
      }

      // 5 crypto positions: 2 wins, 3 losses = 40% win rate
      const cryptoPositions: ResolvedPosition[] = [];
      for (let i = 0; i < 5; i++) {
        cryptoPositions.push(
          createPosition({
            positionId: `crypto-${i}`,
            marketCategory: "crypto",
            outcome: i < 2 ? PositionOutcome.WIN : PositionOutcome.LOSS,
            realizedPnl: i < 2 ? 100 : -100,
            roi: i < 2 ? 1.0 : -1.0,
          })
        );
      }

      [...politicsPositions, ...cryptoPositions].forEach((p) =>
        tracker.addPosition(p)
      );

      const result = tracker.analyze(WALLET_1);
      expect(result.categoryWinRates.length).toBeGreaterThan(0);

      const politicsCategory = result.categoryWinRates.find(
        (c) => c.category === "politics"
      );
      expect(politicsCategory?.winRate).toBe(80);

      const cryptoCategory = result.categoryWinRates.find(
        (c) => c.category === "crypto"
      );
      expect(cryptoCategory?.winRate).toBe(40);
    });

    it("should identify top categories", () => {
      // Create positions with specific categories and win rates
      const categories = [
        { name: "politics", winRate: 90 },
        { name: "crypto", winRate: 70 },
        { name: "sports", winRate: 50 },
      ];

      categories.forEach((cat) => {
        for (let i = 0; i < 10; i++) {
          const isWin = (i / 10) * 100 < cat.winRate;
          tracker.addPosition(
            createPosition({
              positionId: `${cat.name}-${i}`,
              marketCategory: cat.name,
              outcome: isWin ? PositionOutcome.WIN : PositionOutcome.LOSS,
            })
          );
        }
      });

      const result = tracker.analyze(WALLET_1);
      expect(result.topCategories[0]).toBe("politics");
    });
  });

  // --------------------------------------------------------------------------
  // Streaks
  // --------------------------------------------------------------------------

  describe("streaks", () => {
    it("should track current win streak", () => {
      const positions: ResolvedPosition[] = [];
      const now = new Date();

      // Old losses
      for (let i = 0; i < 5; i++) {
        positions.push(
          createLosingPosition(WALLET_1, {
            exitTimestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          })
        );
      }

      // Recent wins
      for (let i = 0; i < 7; i++) {
        positions.push(
          createWinningPosition(WALLET_1, {
            exitTimestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
          })
        );
      }

      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.streaks.currentStreakType).toBe("win");
      expect(result.streaks.currentStreakLength).toBe(7);
    });

    it("should track longest win streak", () => {
      const positions: ResolvedPosition[] = [];
      const now = new Date();
      let time = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      // 3 wins
      for (let i = 0; i < 3; i++) {
        positions.push(
          createWinningPosition(WALLET_1, { exitTimestamp: new Date((time += 1000)) })
        );
      }

      // 1 loss
      positions.push(
        createLosingPosition(WALLET_1, { exitTimestamp: new Date((time += 1000)) })
      );

      // 5 wins
      for (let i = 0; i < 5; i++) {
        positions.push(
          createWinningPosition(WALLET_1, { exitTimestamp: new Date((time += 1000)) })
        );
      }

      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.streaks.longestWinStreak).toBe(5);
    });

    it("should handle empty positions", () => {
      const result = tracker.analyze(WALLET_1);
      expect(result.streaks.currentStreakType).toBe("none");
      expect(result.streaks.currentStreakLength).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Trend Analysis
  // --------------------------------------------------------------------------

  describe("trend analysis", () => {
    it("should detect improving trend", () => {
      const positions: ResolvedPosition[] = [];
      const now = new Date();
      let time = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      // Early: mostly losses (first 70%)
      for (let i = 0; i < 14; i++) {
        const isWin = i >= 11; // 3 wins out of 14 = ~21%
        positions.push(
          createPosition({
            walletAddress: WALLET_1,
            outcome: isWin ? PositionOutcome.WIN : PositionOutcome.LOSS,
            exitTimestamp: new Date((time += 1000)),
          })
        );
      }

      // Recent: mostly wins (last 30%)
      for (let i = 0; i < 6; i++) {
        const isWin = i < 5; // 5 wins out of 6 = ~83%
        positions.push(
          createPosition({
            walletAddress: WALLET_1,
            outcome: isWin ? PositionOutcome.WIN : PositionOutcome.LOSS,
            exitTimestamp: new Date((time += 1000)),
          })
        );
      }

      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.trend.direction).toBe("improving");
      expect(result.trend.recentWinRate).toBeGreaterThan(result.trend.historicalWinRate);
    });

    it("should return stable for insufficient data", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 60);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.trend.direction).toBe("stable");
      expect(result.trend.significance).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Anomaly Detection
  // --------------------------------------------------------------------------

  describe("anomaly detection", () => {
    it("should detect exceptional win rate anomaly", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 90);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      const exceptionalAnomaly = result.anomalies.find(
        (a) => a.type === "exceptional_win_rate"
      );
      expect(exceptionalAnomaly).toBeDefined();
    });

    it("should detect high conviction accuracy anomaly", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 95, {
        highConviction: true,
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      const hcAnomaly = result.anomalies.find(
        (a) => a.type === "high_conviction_accuracy"
      );
      expect(hcAnomaly).toBeDefined();
    });

    it("should detect category specialization anomaly", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 85, {
        category: "politics",
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      const catAnomaly = result.anomalies.find(
        (a) => a.type === "category_specialization"
      );
      expect(catAnomaly).toBeDefined();
    });

    it("should detect perfect timing (long streak) anomaly", () => {
      const positions: ResolvedPosition[] = [];
      const now = new Date();

      // 12 consecutive wins
      for (let i = 0; i < 12; i++) {
        positions.push(
          createWinningPosition(WALLET_1, {
            exitTimestamp: new Date(now.getTime() - i * 60 * 60 * 1000),
          })
        );
      }

      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      const streakAnomaly = result.anomalies.find(
        (a) => a.type === "perfect_timing"
      );
      expect(streakAnomaly).toBeDefined();
    });

    it("should sort anomalies by severity", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 92, {
        highConviction: true,
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      for (let i = 1; i < result.anomalies.length; i++) {
        expect(result.anomalies[i - 1]?.severity).toBeGreaterThanOrEqual(
          result.anomalies[i]?.severity || 0
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suspicion Level
  // --------------------------------------------------------------------------

  describe("suspicion level", () => {
    it("should return NONE for average performance", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 50);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.suspicionLevel).toBe(WinRateSuspicionLevel.NONE);
    });

    it("should return CRITICAL for exceptional performance", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 30, 95, {
        highConviction: true,
      });
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.suspicionLevel).toBe(WinRateSuspicionLevel.CRITICAL);
    });

    it("should flag as potential insider", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 25, 85);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.isPotentialInsider).toBe(true);
    });

    it("should not flag as insider with insufficient data", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 100);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.isPotentialInsider).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Win Rate Categories
  // --------------------------------------------------------------------------

  describe("win rate categories", () => {
    it("should assign UNKNOWN for insufficient data", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 3, 100);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.category).toBe(WinRateCategory.UNKNOWN);
    });

    it("should assign correct categories based on win rate", () => {
      const testCases = [
        { winRate: 20, expected: WinRateCategory.VERY_LOW },
        { winRate: 35, expected: WinRateCategory.LOW },
        { winRate: 50, expected: WinRateCategory.AVERAGE },
        { winRate: 60, expected: WinRateCategory.ABOVE_AVERAGE },
        { winRate: 70, expected: WinRateCategory.HIGH },
        { winRate: 80, expected: WinRateCategory.VERY_HIGH },
        { winRate: 90, expected: WinRateCategory.EXCEPTIONAL },
      ];

      for (const { winRate, expected } of testCases) {
        const testTracker = new WinRateTracker();
        const positions = generatePositionsWithWinRate(WALLET_1, 20, winRate);
        positions.forEach((p) => testTracker.addPosition(p));

        const result = testTracker.analyze(WALLET_1);
        expect(result.category).toBe(expected);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Data Quality
  // --------------------------------------------------------------------------

  describe("data quality", () => {
    it("should return 0 for no positions", () => {
      const result = tracker.analyze(WALLET_1);
      expect(result.dataQuality).toBe(0);
    });

    it("should return low quality for few positions", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 5, 60);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.dataQuality).toBe(20);
    });

    it("should return high quality for many positions", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 100, 60);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.analyze(WALLET_1);
      expect(result.dataQuality).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // Batch Analysis
  // --------------------------------------------------------------------------

  describe("batchAnalyze", () => {
    it("should analyze multiple wallets", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 10, 60);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 10, 70);

      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));

      const result = tracker.batchAnalyze([WALLET_1, WALLET_2]);

      expect(result.results.size).toBe(2);
      expect(result.totalProcessed).toBe(2);
      expect(result.failed.size).toBe(0);
    });

    it("should handle failed analyses", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => tracker.addPosition(p));

      const result = tracker.batchAnalyze([WALLET_1, "invalid"]);

      expect(result.results.size).toBe(1);
      expect(result.failed.size).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  describe("hasUnusuallyHighWinRate", () => {
    it("should return true for high win rate wallets", () => {
      // Need very high win rate with enough positions and high conviction trades
      const positions = generatePositionsWithWinRate(WALLET_1, 40, 95, {
        highConviction: true,
      });
      positions.forEach((p) => tracker.addPosition(p));

      expect(tracker.hasUnusuallyHighWinRate(WALLET_1)).toBe(true);
    });

    it("should return false for average win rate", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 50);
      positions.forEach((p) => tracker.addPosition(p));

      expect(tracker.hasUnusuallyHighWinRate(WALLET_1)).toBe(false);
    });

    it("should return false for invalid wallet", () => {
      expect(tracker.hasUnusuallyHighWinRate("invalid")).toBe(false);
    });
  });

  describe("getHighWinRateWallets", () => {
    it("should return wallets with high win rates", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 20, 80);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 20, 50);
      const positions3 = generatePositionsWithWinRate(WALLET_3, 20, 75);

      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));
      positions3.forEach((p) => tracker.addPosition(p));

      const results = tracker.getHighWinRateWallets(70);

      expect(results.length).toBe(2);
      expect(results[0]?.walletAddress).toBe(getAddress(WALLET_1));
    });

    it("should sort by win rate descending", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 20, 75);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 20, 85);

      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));

      const results = tracker.getHighWinRateWallets(70);

      expect(results[0]?.walletAddress).toBe(getAddress(WALLET_2));
    });
  });

  describe("getPotentialInsiders", () => {
    it("should return potential insider wallets", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 25, 85);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 20, 50);

      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));

      const results = tracker.getPotentialInsiders();

      expect(results.length).toBe(1);
      expect(results[0]?.walletAddress).toBe(getAddress(WALLET_1));
    });
  });

  describe("getSummary", () => {
    it("should return correct summary", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 20, 90);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 20, 50);

      positions1.forEach((p) => tracker.addPosition(p));
      positions2.forEach((p) => tracker.addPosition(p));

      tracker.analyze(WALLET_1);
      tracker.analyze(WALLET_2);

      const summary = tracker.getSummary();

      expect(summary.totalWallets).toBe(2);
      expect(summary.totalPositions).toBe(40);
      expect(summary.exceptionalWinRateCount).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all data", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => tracker.addPosition(p));

      tracker.clear();

      expect(tracker.getPositions(WALLET_1)).toHaveLength(0);
      const summary = tracker.getSummary();
      expect(summary.totalWallets).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Caching
  // --------------------------------------------------------------------------

  describe("caching", () => {
    it("should cache results", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => tracker.addPosition(p));

      tracker.analyze(WALLET_1);
      tracker.analyze(WALLET_1);
      tracker.analyze(WALLET_1);

      const summary = tracker.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0.5);
    });

    it("should respect cache TTL", async () => {
      const customTracker = new WinRateTracker({ cacheTtl: 50 });
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      positions.forEach((p) => customTracker.addPosition(p));

      customTracker.analyze(WALLET_1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second analysis should be a cache miss after TTL expired
      customTracker.analyze(WALLET_1);
      customTracker.analyze(WALLET_1); // This should hit cache

      const summary = customTracker.getSummary();
      // Should have some cache misses (at least 2) and at least 1 hit
      expect(summary.cacheHitRate).toBeGreaterThan(0);
      expect(summary.cacheHitRate).toBeLessThan(1);
    });
  });
});

// ============================================================================
// Factory and Convenience Functions
// ============================================================================

describe("factory and convenience functions", () => {
  beforeEach(() => {
    resetSharedWinRateTracker();
  });

  describe("createWinRateTracker", () => {
    it("should create a new tracker", () => {
      const tracker = createWinRateTracker();
      expect(tracker).toBeInstanceOf(WinRateTracker);
    });

    it("should accept custom config", () => {
      const tracker = createWinRateTracker({ minPositionsForAnalysis: 10 });
      expect(tracker).toBeDefined();
    });
  });

  describe("shared tracker", () => {
    it("should get shared instance", () => {
      const tracker1 = getSharedWinRateTracker();
      const tracker2 = getSharedWinRateTracker();
      expect(tracker1).toBe(tracker2);
    });

    it("should set shared instance", () => {
      const customTracker = createWinRateTracker();
      setSharedWinRateTracker(customTracker);
      expect(getSharedWinRateTracker()).toBe(customTracker);
    });

    it("should reset shared instance", () => {
      const tracker1 = getSharedWinRateTracker();
      resetSharedWinRateTracker();
      const tracker2 = getSharedWinRateTracker();
      expect(tracker1).not.toBe(tracker2);
    });
  });

  describe("addPositionForWinRate", () => {
    it("should add position to shared tracker", () => {
      const position = createWinningPosition();
      addPositionForWinRate(position);

      const result = analyzeWinRate(WALLET_1);
      expect(result.totalPositions).toBe(1);
    });
  });

  describe("addPositionsForWinRate", () => {
    it("should add multiple positions to shared tracker", () => {
      const positions = [createWinningPosition(), createLosingPosition()];
      addPositionsForWinRate(positions);

      const result = analyzeWinRate(WALLET_1);
      expect(result.totalPositions).toBe(2);
    });
  });

  describe("analyzeWinRate", () => {
    it("should analyze using shared tracker", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      addPositionsForWinRate(positions);

      const result = analyzeWinRate(WALLET_1);
      expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(60);
    });
  });

  describe("batchAnalyzeWinRates", () => {
    it("should batch analyze using shared tracker", () => {
      const positions1 = generatePositionsWithWinRate(WALLET_1, 10, 60);
      const positions2 = generatePositionsWithWinRate(WALLET_2, 10, 70);

      addPositionsForWinRate([...positions1, ...positions2]);

      const result = batchAnalyzeWinRates([WALLET_1, WALLET_2]);
      expect(result.results.size).toBe(2);
    });
  });

  describe("hasUnusuallyHighWinRate (convenience)", () => {
    it("should use shared tracker", () => {
      // Need very high win rate with enough positions and high conviction trades
      const positions = generatePositionsWithWinRate(WALLET_1, 40, 95, {
        highConviction: true,
      });
      addPositionsForWinRate(positions);

      expect(hasUnusuallyHighWinRate(WALLET_1)).toBe(true);
    });
  });

  describe("getHighWinRateWallets (convenience)", () => {
    it("should use shared tracker", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 20, 80);
      addPositionsForWinRate(positions);

      const results = getHighWinRateWallets(70);
      expect(results.length).toBe(1);
    });
  });

  describe("getPotentialInsidersByWinRate", () => {
    it("should use shared tracker", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 25, 85);
      addPositionsForWinRate(positions);

      const results = getPotentialInsidersByWinRate();
      expect(results.length).toBe(1);
    });
  });

  describe("getWinRateTrackerSummary", () => {
    it("should use shared tracker", () => {
      const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
      addPositionsForWinRate(positions);

      const summary = getWinRateTrackerSummary();
      expect(summary.totalPositions).toBe(10);
    });
  });
});

// ============================================================================
// Description Functions
// ============================================================================

describe("description functions", () => {
  describe("getWinRateCategoryDescription", () => {
    it("should return description for each category", () => {
      expect(getWinRateCategoryDescription(WinRateCategory.UNKNOWN)).toContain(
        "Unknown"
      );
      expect(getWinRateCategoryDescription(WinRateCategory.VERY_LOW)).toContain(
        "Very low"
      );
      expect(getWinRateCategoryDescription(WinRateCategory.LOW)).toContain("Low");
      expect(getWinRateCategoryDescription(WinRateCategory.AVERAGE)).toContain(
        "Average"
      );
      expect(
        getWinRateCategoryDescription(WinRateCategory.ABOVE_AVERAGE)
      ).toContain("Above average");
      expect(getWinRateCategoryDescription(WinRateCategory.HIGH)).toContain("High");
      expect(getWinRateCategoryDescription(WinRateCategory.VERY_HIGH)).toContain(
        "Very high"
      );
      expect(
        getWinRateCategoryDescription(WinRateCategory.EXCEPTIONAL)
      ).toContain("Exceptional");
    });
  });

  describe("getWinRateSuspicionDescription", () => {
    it("should return description for each level", () => {
      expect(
        getWinRateSuspicionDescription(WinRateSuspicionLevel.NONE)
      ).toContain("No suspicious");
      expect(getWinRateSuspicionDescription(WinRateSuspicionLevel.LOW)).toContain(
        "Slightly above"
      );
      expect(
        getWinRateSuspicionDescription(WinRateSuspicionLevel.MEDIUM)
      ).toContain("Notable");
      expect(
        getWinRateSuspicionDescription(WinRateSuspicionLevel.HIGH)
      ).toContain("Suspicious");
      expect(
        getWinRateSuspicionDescription(WinRateSuspicionLevel.CRITICAL)
      ).toContain("Highly suspicious");
    });
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("constants", () => {
  describe("WINDOW_DURATION_MS", () => {
    it("should have correct duration values", () => {
      expect(WINDOW_DURATION_MS[WinRateWindow.DAY]).toBe(24 * 60 * 60 * 1000);
      expect(WINDOW_DURATION_MS[WinRateWindow.WEEK]).toBe(7 * 24 * 60 * 60 * 1000);
      expect(WINDOW_DURATION_MS[WinRateWindow.MONTH]).toBe(30 * 24 * 60 * 60 * 1000);
      expect(WINDOW_DURATION_MS[WinRateWindow.ALL_TIME]).toBe(Infinity);
    });
  });

  describe("DEFAULT_WIN_RATE_CONFIG", () => {
    it("should have expected defaults", () => {
      expect(DEFAULT_WIN_RATE_CONFIG.minPositionsForAnalysis).toBe(5);
      expect(DEFAULT_WIN_RATE_CONFIG.exceptionalWinRateThreshold).toBe(85);
      expect(DEFAULT_WIN_RATE_CONFIG.enableEvents).toBe(true);
    });
  });

  describe("WIN_RATE_CATEGORY_THRESHOLDS", () => {
    it("should have thresholds for all categories", () => {
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.UNKNOWN]).toBeDefined();
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.VERY_LOW]).toBeDefined();
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.LOW]).toBeDefined();
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.AVERAGE]).toBeDefined();
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.HIGH]).toBeDefined();
      expect(WIN_RATE_CATEGORY_THRESHOLDS[WinRateCategory.EXCEPTIONAL]).toBeDefined();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
  let tracker: WinRateTracker;

  beforeEach(() => {
    tracker = new WinRateTracker();
  });

  it("should handle all breakeven positions", () => {
    const positions = Array.from({ length: 10 }, () =>
      createBreakevenPosition()
    );
    positions.forEach((p) => tracker.addPosition(p));

    const result = tracker.analyze(WALLET_1);
    expect(result.windowStats[WinRateWindow.ALL_TIME].winRate).toBe(0);
    expect(result.windowStats[WinRateWindow.ALL_TIME].breakevens).toBe(10);
  });

  it("should handle mixed case wallet addresses", () => {
    // Use lowercase and let getAddress normalize
    const lowerAddress = WALLET_1.toLowerCase();
    const position1 = createWinningPosition(lowerAddress);
    const position2 = createLosingPosition(lowerAddress);

    tracker.addPosition(position1);
    tracker.addPosition(position2);

    const positions = tracker.getPositions(WALLET_1);
    expect(positions).toHaveLength(2);
  });

  it("should handle positions with zero size", () => {
    const position = createWinningPosition(WALLET_1, { sizeUsd: 0 });
    tracker.addPosition(position);

    const result = tracker.analyze(WALLET_1);
    expect(result.totalPositions).toBe(1);
  });

  it("should handle positions with negative P&L that are wins", () => {
    // Edge case: could happen with fees
    const position = createPosition({
      outcome: PositionOutcome.WIN,
      realizedPnl: -5, // Small loss due to fees even though "won"
    });
    tracker.addPosition(position);

    const result = tracker.analyze(WALLET_1);
    expect(result.windowStats[WinRateWindow.ALL_TIME].wins).toBe(1);
  });

  it("should handle very old positions", () => {
    const position = createWinningPosition(WALLET_1, {
      exitTimestamp: new Date(2020, 0, 1),
    });
    tracker.addPosition(position);

    const result = tracker.analyze(WALLET_1);
    expect(result.windowStats[WinRateWindow.ALL_TIME].totalPositions).toBe(1);
    expect(result.windowStats[WinRateWindow.DAY].totalPositions).toBe(0);
  });

  it("should handle future dated positions", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const position = createWinningPosition(WALLET_1, {
      exitTimestamp: futureDate,
    });
    tracker.addPosition(position);

    const result = tracker.analyze(WALLET_1);
    expect(result.windowStats[WinRateWindow.ALL_TIME].totalPositions).toBe(1);
  });

  it("should handle empty options object", () => {
    const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
    positions.forEach((p) => tracker.addPosition(p));

    const result = tracker.analyze(WALLET_1, {});
    expect(result).toBeDefined();
  });

  it("should handle analysis with includeHistory false", () => {
    const positions = generatePositionsWithWinRate(WALLET_1, 10, 60);
    positions.forEach((p) => tracker.addPosition(p));

    const result = tracker.analyze(WALLET_1, { includeHistory: false });
    expect(result.history).toHaveLength(0);
  });

  it("should handle analysis with includeCategoryBreakdown false", () => {
    const positions = generatePositionsWithWinRate(WALLET_1, 10, 60, {
      category: "politics",
    });
    positions.forEach((p) => tracker.addPosition(p));

    const result = tracker.analyze(WALLET_1, { includeCategoryBreakdown: false });
    expect(result.categoryWinRates).toHaveLength(0);
  });

  it("should handle analysis with includeTrendAnalysis false", () => {
    const positions = generatePositionsWithWinRate(WALLET_1, 20, 60);
    positions.forEach((p) => tracker.addPosition(p));

    const result = tracker.analyze(WALLET_1, { includeTrendAnalysis: false });
    expect(result.trend.direction).toBe("stable");
    expect(result.trend.significance).toBe(0);
  });
});

// Need this import for getAddress
import { getAddress } from "viem";
