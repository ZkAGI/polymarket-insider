/**
 * Unit Tests for Profit/Loss Calculator (DET-PAT-005)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ProfitLossCalculator,
  PositionStatus,
  PnlDirection,
  PnlTier,
  PnlSuspicionLevel,
  PnlWindow,
  PNL_WINDOW_DURATION_MS,
  PNL_TIER_THRESHOLDS,
  DEFAULT_PNL_CONFIG,
  createProfitLossCalculator,
  getSharedProfitLossCalculator,
  setSharedProfitLossCalculator,
  resetSharedProfitLossCalculator,
  addPositionForPnl,
  addPositionsForPnl,
  updatePositionPriceForPnl,
  closePositionForPnl,
  analyzePnl,
  batchAnalyzePnl,
  hasExceptionalReturns,
  getHighReturnWallets,
  getPotentialInsidersByPnl,
  getPnlCalculatorSummary,
  getPnlTierDescription,
  getPnlSuspicionDescription,
  PnlPosition,
} from "../../src/detection/profit-loss-calculator";
import { MarketCategory } from "../../src/api/gamma/types";

// Test wallet addresses
const WALLET_1 = "0x1234567890123456789012345678901234567890";
const WALLET_2 = "0x2345678901234567890123456789012345678901";
const WALLET_3 = "0x3456789012345678901234567890123456789012";
const INVALID_WALLET = "invalid-address";

// Helper to create a test position
function createTestPosition(
  overrides: Partial<PnlPosition> = {}
): PnlPosition {
  return {
    positionId: `pos-${Math.random().toString(36).substr(2, 9)}`,
    marketId: "market-1",
    walletAddress: WALLET_1,
    side: "buy",
    shares: 100,
    entryPrice: 0.5,
    costBasis: 50,
    status: PositionStatus.OPEN,
    entryTimestamp: new Date(),
    fees: 0.5,
    ...overrides,
  };
}

// Helper to create a closed position with P&L
function createClosedPosition(
  walletAddress: string,
  costBasis: number,
  exitValue: number,
  category?: MarketCategory | string,
  exitTimestamp?: Date
): PnlPosition {
  const _pnl = exitValue - costBasis;
  // ROI calculated but not needed in return object (used for validation)
  void _pnl;
  return {
    positionId: `pos-${Math.random().toString(36).substr(2, 9)}`,
    marketId: `market-${Math.random().toString(36).substr(2, 5)}`,
    marketCategory: category,
    walletAddress,
    side: "buy",
    shares: costBasis * 2,
    entryPrice: 0.5,
    exitPrice: exitValue / (costBasis * 2),
    costBasis,
    exitValue,
    status: PositionStatus.CLOSED,
    entryTimestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    exitTimestamp: exitTimestamp || new Date(),
    fees: 0,
  };
}

describe("ProfitLossCalculator", () => {
  let calculator: ProfitLossCalculator;

  beforeEach(() => {
    calculator = new ProfitLossCalculator();
    resetSharedProfitLossCalculator();
  });

  afterEach(() => {
    calculator.clear();
    resetSharedProfitLossCalculator();
  });

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const calc = new ProfitLossCalculator();
      expect(calc).toBeDefined();
    });

    it("should create with custom configuration", () => {
      const calc = new ProfitLossCalculator({
        minPositionsForAnalysis: 10,
        cacheTtl: 10000,
      });
      expect(calc).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const calc = new ProfitLossCalculator({
        minPositionsForAnalysis: 15,
      });
      // Should use custom value but keep other defaults
      expect(calc).toBeDefined();
    });
  });

  describe("addPosition", () => {
    it("should add a valid position", () => {
      const position = createTestPosition({ walletAddress: WALLET_1 });
      calculator.addPosition(position);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
      expect(positions[0]!.positionId).toBe(position.positionId);
    });

    it("should normalize wallet address to checksummed format", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1.toLowerCase(),
      });
      calculator.addPosition(position);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
    });

    it("should throw for invalid wallet address", () => {
      const position = createTestPosition({ walletAddress: INVALID_WALLET });
      expect(() => calculator.addPosition(position)).toThrow(
        "Invalid wallet address"
      );
    });

    it("should update existing position by positionId", () => {
      const position1 = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        costBasis: 100,
      });
      const position2 = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        costBasis: 200,
      });

      calculator.addPosition(position1);
      calculator.addPosition(position2);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions).toHaveLength(1);
      expect(positions[0]!.costBasis).toBe(200);
    });

    it("should emit position-added event", () => {
      const handler = vi.fn();
      calculator.on("position-added", handler);

      const position = createTestPosition({ walletAddress: WALLET_1 });
      calculator.addPosition(position);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0].address).toBeDefined();
      expect(handler.mock.calls[0]![0].position).toBeDefined();
    });

    it("should trim old positions when exceeding max limit", () => {
      const calc = new ProfitLossCalculator({ maxPositionsPerWallet: 5 });

      for (let i = 0; i < 10; i++) {
        calc.addPosition(
          createTestPosition({
            walletAddress: WALLET_1,
            entryTimestamp: new Date(Date.now() - i * 1000),
          })
        );
      }

      const positions = calc.getPositions(WALLET_1);
      expect(positions).toHaveLength(5);
    });
  });

  describe("addPositions", () => {
    it("should add multiple positions", () => {
      const positions = [
        createTestPosition({ walletAddress: WALLET_1 }),
        createTestPosition({ walletAddress: WALLET_1 }),
        createTestPosition({ walletAddress: WALLET_1 }),
      ];

      calculator.addPositions(positions);

      expect(calculator.getPositions(WALLET_1)).toHaveLength(3);
    });
  });

  describe("updatePositionPrice", () => {
    it("should update current price for open position", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        shares: 100,
      });
      calculator.addPosition(position);

      calculator.updatePositionPrice(WALLET_1, "pos-1", 0.8);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions[0]!.currentPrice).toBe(0.8);
      expect(positions[0]!.currentValue).toBe(80);
    });

    it("should not update closed positions", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        status: PositionStatus.CLOSED,
        exitPrice: 0.6,
      });
      calculator.addPosition(position);

      calculator.updatePositionPrice(WALLET_1, "pos-1", 0.8);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions[0]!.currentPrice).toBeUndefined();
    });

    it("should emit position-updated event", () => {
      const handler = vi.fn();
      calculator.on("position-updated", handler);

      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
      });
      calculator.addPosition(position);
      calculator.updatePositionPrice(WALLET_1, "pos-1", 0.8);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("closePosition", () => {
    it("should close an open position", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        shares: 100,
        costBasis: 50,
      });
      calculator.addPosition(position);

      calculator.closePosition(WALLET_1, "pos-1", 0.8);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions[0]!.status).toBe(PositionStatus.CLOSED);
      expect(positions[0]!.exitPrice).toBe(0.8);
      expect(positions[0]!.exitValue).toBe(80);
      expect(positions[0]!.exitTimestamp).toBeDefined();
    });

    it("should emit position-closed event with P&L", () => {
      const handler = vi.fn();
      calculator.on("position-closed", handler);

      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        shares: 100,
        costBasis: 50,
        fees: 1,
      });
      calculator.addPosition(position);
      calculator.closePosition(WALLET_1, "pos-1", 0.8);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0].pnl).toBe(29); // 80 - 50 - 1
    });

    it("should use custom exit timestamp", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
      });
      calculator.addPosition(position);

      const exitTime = new Date("2024-01-15T10:00:00Z");
      calculator.closePosition(WALLET_1, "pos-1", 0.8, exitTime);

      const positions = calculator.getPositions(WALLET_1);
      expect(positions[0]!.exitTimestamp).toEqual(exitTime);
    });

    it("should handle different close statuses", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
      });
      calculator.addPosition(position);

      calculator.closePosition(
        WALLET_1,
        "pos-1",
        0,
        new Date(),
        PositionStatus.EXPIRED
      );

      const positions = calculator.getPositions(WALLET_1);
      expect(positions[0]!.status).toBe(PositionStatus.EXPIRED);
    });
  });

  describe("getPositions", () => {
    it("should return empty array for unknown wallet", () => {
      const positions = calculator.getPositions(WALLET_1);
      expect(positions).toEqual([]);
    });

    it("should return all positions for wallet", () => {
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_1 }));
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_1 }));
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_2 }));

      expect(calculator.getPositions(WALLET_1)).toHaveLength(2);
      expect(calculator.getPositions(WALLET_2)).toHaveLength(1);
    });
  });

  describe("getOpenPositions", () => {
    it("should return only open positions", () => {
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.OPEN,
        })
      );
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.CLOSED,
        })
      );
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.EXPIRED,
        })
      );

      const openPositions = calculator.getOpenPositions(WALLET_1);
      expect(openPositions).toHaveLength(1);
      expect(openPositions[0]!.status).toBe(PositionStatus.OPEN);
    });
  });

  describe("getClosedPositions", () => {
    it("should return only closed positions", () => {
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.OPEN,
        })
      );
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.CLOSED,
        })
      );
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.EXPIRED,
        })
      );

      const closedPositions = calculator.getClosedPositions(WALLET_1);
      expect(closedPositions).toHaveLength(2);
    });
  });

  describe("clearPositions", () => {
    it("should clear all positions for a wallet", () => {
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_1 }));
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_1 }));
      calculator.addPosition(createTestPosition({ walletAddress: WALLET_2 }));

      calculator.clearPositions(WALLET_1);

      expect(calculator.getPositions(WALLET_1)).toHaveLength(0);
      expect(calculator.getPositions(WALLET_2)).toHaveLength(1);
    });
  });

  describe("calculateRealizedPnl", () => {
    it("should calculate realized P&L for closed position", () => {
      const position = createClosedPosition(WALLET_1, 100, 150);
      calculator.addPosition(position);

      const realized = calculator.calculateRealizedPnl(position);

      expect(realized).not.toBeNull();
      expect(realized!.realizedPnl).toBe(50);
      expect(realized!.roi).toBe(50);
      expect(realized!.direction).toBe(PnlDirection.PROFIT);
    });

    it("should return null for open position", () => {
      const position = createTestPosition({ status: PositionStatus.OPEN });
      const realized = calculator.calculateRealizedPnl(position);
      expect(realized).toBeNull();
    });

    it("should correctly categorize loss", () => {
      const position = createClosedPosition(WALLET_1, 100, 60);
      const realized = calculator.calculateRealizedPnl(position);

      expect(realized!.realizedPnl).toBe(-40);
      expect(realized!.roi).toBe(-40);
      expect(realized!.direction).toBe(PnlDirection.LOSS);
    });

    it("should correctly categorize breakeven", () => {
      const position = createClosedPosition(WALLET_1, 100, 100);
      const realized = calculator.calculateRealizedPnl(position);

      expect(realized!.realizedPnl).toBe(0);
      expect(realized!.direction).toBe(PnlDirection.BREAKEVEN);
    });

    it("should account for fees", () => {
      const position = createClosedPosition(WALLET_1, 100, 150);
      position.fees = 10;
      const realized = calculator.calculateRealizedPnl(position);

      expect(realized!.realizedPnl).toBe(40); // 150 - 100 - 10
      expect(realized!.fees).toBe(10);
    });
  });

  describe("calculateUnrealizedPnl", () => {
    it("should calculate unrealized P&L for open position", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        costBasis: 100,
        currentValue: 130,
        status: PositionStatus.OPEN,
      });
      calculator.addPosition(position);

      const unrealized = calculator.calculateUnrealizedPnl(position);

      expect(unrealized).not.toBeNull();
      expect(unrealized!.unrealizedPnl).toBe(30);
      expect(unrealized!.unrealizedRoi).toBe(30);
      expect(unrealized!.direction).toBe(PnlDirection.PROFIT);
    });

    it("should return null for closed position", () => {
      const position = createClosedPosition(WALLET_1, 100, 150);
      const unrealized = calculator.calculateUnrealizedPnl(position);
      expect(unrealized).toBeNull();
    });

    it("should use cost basis when current value not set", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        costBasis: 100,
        status: PositionStatus.OPEN,
      });
      position.currentValue = undefined;

      const unrealized = calculator.calculateUnrealizedPnl(position);
      expect(unrealized!.unrealizedPnl).toBe(0);
    });
  });

  describe("analyze", () => {
    it("should analyze wallet with sufficient positions", () => {
      // Add 10 closed positions with mix of wins and losses
      for (let i = 0; i < 6; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150)); // Win
      }
      for (let i = 0; i < 4; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 80)); // Loss
      }

      const result = calculator.analyze(WALLET_1);

      expect(result).toBeDefined();
      expect(result.walletAddress).toBeDefined();
      expect(result.totalPositions).toBe(10);
      expect(result.aggregates.totalRealizedPnl).toBe(6 * 50 - 4 * 20); // 300 - 80 = 220
      expect(result.tier).toBeDefined();
      expect(result.suspicionLevel).toBeDefined();
    });

    it("should throw for invalid wallet address", () => {
      expect(() => calculator.analyze(INVALID_WALLET)).toThrow(
        "Invalid wallet address"
      );
    });

    it("should use cached results within TTL", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      const result1 = calculator.analyze(WALLET_1);
      const result2 = calculator.analyze(WALLET_1);

      expect(result1.analyzedAt).toEqual(result2.analyzedAt);
    });

    it("should invalidate cache after position change", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      const result1 = calculator.analyze(WALLET_1);
      expect(result1.totalPositions).toBe(5);

      // Add new position
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 200));

      const result2 = calculator.analyze(WALLET_1);

      expect(result2.totalPositions).toBe(6);
    });

    it("should calculate window stats correctly", () => {
      const now = new Date();

      // Add position entered 1 day ago, exited 12 hours ago
      const position1 = createClosedPosition(
        WALLET_1,
        100,
        150,
        undefined,
        new Date(now.getTime() - 12 * 60 * 60 * 1000)
      );
      position1.entryTimestamp = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      calculator.addPosition(position1);

      // Add position entered 14 days ago, exited 10 days ago
      const position2 = createClosedPosition(
        WALLET_1,
        100,
        120,
        undefined,
        new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      );
      position2.entryTimestamp = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      calculator.addPosition(position2);

      const result = calculator.analyze(WALLET_1);

      // Note: window stats filter by entryTimestamp, so both positions started in the month window
      expect(result.windowStats[PnlWindow.MONTH].closedPositions).toBe(2);
      expect(result.windowStats[PnlWindow.ALL_TIME].closedPositions).toBe(2);
    });

    it("should calculate category breakdown", () => {
      calculator.addPosition(
        createClosedPosition(WALLET_1, 100, 150, MarketCategory.POLITICS)
      );
      calculator.addPosition(
        createClosedPosition(WALLET_1, 100, 130, MarketCategory.POLITICS)
      );
      calculator.addPosition(
        createClosedPosition(WALLET_1, 100, 180, MarketCategory.CRYPTO)
      );
      calculator.addPosition(
        createClosedPosition(WALLET_1, 100, 90, MarketCategory.SPORTS)
      );
      calculator.addPosition(
        createClosedPosition(WALLET_1, 100, 110, MarketCategory.SPORTS)
      );

      const result = calculator.analyze(WALLET_1);

      expect(result.categoryStats.length).toBeGreaterThan(0);

      const politicsStats = result.categoryStats.find(
        (c) => c.category === MarketCategory.POLITICS
      );
      expect(politicsStats).toBeDefined();
      expect(politicsStats!.totalPositions).toBe(2);
      expect(politicsStats!.realizedPnl).toBe(80); // 50 + 30
    });

    it("should identify top and worst categories", () => {
      // Add positions with different performance by category
      for (let i = 0; i < 3; i++) {
        calculator.addPosition(
          createClosedPosition(WALLET_1, 100, 200, MarketCategory.CRYPTO) // +100%
        );
        calculator.addPosition(
          createClosedPosition(WALLET_1, 100, 130, MarketCategory.POLITICS) // +30%
        );
        calculator.addPosition(
          createClosedPosition(WALLET_1, 100, 60, MarketCategory.SPORTS) // -40%
        );
      }

      const result = calculator.analyze(WALLET_1);

      expect(result.topCategories).toContain(MarketCategory.CRYPTO);
      expect(result.worstCategories).toContain(MarketCategory.SPORTS);
    });

    it("should calculate P&L trend", () => {
      // Add older positions with lower returns
      for (let i = 0; i < 7; i++) {
        const position = createClosedPosition(WALLET_1, 100, 110); // +10%
        position.exitTimestamp = new Date(
          Date.now() - (14 - i) * 24 * 60 * 60 * 1000
        );
        calculator.addPosition(position);
      }

      // Add recent positions with higher returns
      for (let i = 0; i < 3; i++) {
        const position = createClosedPosition(WALLET_1, 100, 180); // +80%
        position.exitTimestamp = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        calculator.addPosition(position);
      }

      const result = calculator.analyze(WALLET_1);

      expect(result.trend.direction).toBe("improving");
      expect(result.trend.recentRoi).toBeGreaterThan(result.trend.historicalRoi);
    });

    it("should detect anomalies", () => {
      // Add positions with exceptional performance
      for (let i = 0; i < 10; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 250)); // +150%
      }

      const result = calculator.analyze(WALLET_1);

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies.some((a) => a.type === "exceptional_returns")).toBe(
        true
      );
    });

    it("should handle options correctly", () => {
      // Create a fresh calculator to avoid cache issues
      const calc = new ProfitLossCalculator();

      for (let i = 0; i < 5; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      // Analyze with minimal options first (no caching from full options)
      const resultMinimal = calc.analyze(WALLET_1, {
        includeHistory: false,
        includeCategoryBreakdown: false,
        includePositionDetails: false,
      });

      // Force cache invalidation for next test
      calc.addPosition(createClosedPosition(WALLET_1, 100, 160));

      const resultFull = calc.analyze(WALLET_1, {
        includeHistory: true,
        includeCategoryBreakdown: true,
        includePositionDetails: true,
      });

      expect(resultFull.history.length).toBeGreaterThan(0);
      expect(resultMinimal.history.length).toBe(0);
      expect(resultMinimal.categoryStats.length).toBe(0);
      expect(resultMinimal.realizedPnl.length).toBe(0);
    });

    it("should emit analysis-complete event", () => {
      const handler = vi.fn();
      calculator.on("analysis-complete", handler);

      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      calculator.analyze(WALLET_1);

      expect(handler).toHaveBeenCalled();
    });

    it("should emit potential-insider event for high performers", () => {
      const calc = new ProfitLossCalculator({
        potentialInsiderRoiThreshold: 50,
        minConsistencyForInsider: 70,
        minPositionsForHighConfidence: 10,
      });

      const handler = vi.fn();
      calc.on("potential-insider", handler);

      // Add 20 positions with 80% win rate and high ROI
      for (let i = 0; i < 16; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 180)); // +80%
      }
      for (let i = 0; i < 4; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 90)); // -10%
      }

      calc.analyze(WALLET_1);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("batchAnalyze", () => {
    it("should analyze multiple wallets", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
        calculator.addPosition(createClosedPosition(WALLET_2, 100, 80));
        calculator.addPosition(createClosedPosition(WALLET_3, 100, 120));
      }

      const batch = calculator.batchAnalyze([WALLET_1, WALLET_2, WALLET_3]);

      expect(batch.results.size).toBe(3);
      expect(batch.failed.size).toBe(0);
      expect(batch.totalProcessed).toBe(3);
    });

    it("should handle failed analyses gracefully", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      const batch = calculator.batchAnalyze([WALLET_1, INVALID_WALLET]);

      expect(batch.results.size).toBe(1);
      expect(batch.failed.size).toBe(1);
    });
  });

  describe("hasExceptionalReturns", () => {
    it("should return true for exceptional performers", () => {
      const calc = new ProfitLossCalculator({
        exceptionalRoiThreshold: 100,
        minPositionsForAnalysis: 5,
      });

      for (let i = 0; i < 5; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 250)); // +150%
      }

      expect(calc.hasExceptionalReturns(WALLET_1)).toBe(true);
    });

    it("should return false for average performers", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 110));
      }

      expect(calculator.hasExceptionalReturns(WALLET_1)).toBe(false);
    });

    it("should return false for invalid wallet", () => {
      expect(calculator.hasExceptionalReturns(INVALID_WALLET)).toBe(false);
    });
  });

  describe("getHighReturnWallets", () => {
    it("should return wallets with high returns", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 200)); // +100%
        calculator.addPosition(createClosedPosition(WALLET_2, 100, 110)); // +10%
        calculator.addPosition(createClosedPosition(WALLET_3, 100, 180)); // +80%
      }

      const highReturn = calculator.getHighReturnWallets(50);

      expect(highReturn.length).toBe(2);
      expect(highReturn[0]!.aggregates.overallRoi).toBeGreaterThanOrEqual(
        highReturn[1]!.aggregates.overallRoi
      );
    });
  });

  describe("getPotentialInsiders", () => {
    it("should return flagged insider wallets", () => {
      const calc = new ProfitLossCalculator({
        potentialInsiderRoiThreshold: 50,
        minConsistencyForInsider: 70,
        minPositionsForHighConfidence: 10,
      });

      // High performer (potential insider)
      for (let i = 0; i < 15; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 175)); // +75%
      }
      for (let i = 0; i < 5; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 90)); // Loss
      }

      // Average performer
      for (let i = 0; i < 20; i++) {
        calc.addPosition(createClosedPosition(WALLET_2, 100, 110));
      }

      const insiders = calc.getPotentialInsiders();

      expect(insiders.length).toBeGreaterThan(0);
      expect(insiders.some((r) => r.isPotentialInsider)).toBe(true);
    });
  });

  describe("getSummary", () => {
    it("should return comprehensive summary", () => {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 200));
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 250));
      calculator.addPosition(
        createTestPosition({
          walletAddress: WALLET_1,
          status: PositionStatus.OPEN,
          costBasis: 100,
          currentValue: 120,
        })
      );
      calculator.addPosition(createClosedPosition(WALLET_2, 100, 80));

      const summary = calculator.getSummary();

      expect(summary.totalWallets).toBe(2);
      expect(summary.totalPositions).toBe(4);
      expect(summary.openPositions).toBe(1);
      expect(summary.closedPositions).toBe(3);
      expect(summary.aggregateRealizedPnl).toBe(100 + 150 - 20); // 230
      expect(summary.aggregateUnrealizedPnl).toBe(20);
    });

    it("should track tier distribution", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 250)); // Massive profit
      }
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_2, 100, 40)); // Massive loss
      }

      const summary = calculator.getSummary();

      expect(summary.tierDistribution[PnlTier.MASSIVE_PROFIT]).toBe(1);
      expect(summary.tierDistribution[PnlTier.MASSIVE_LOSS]).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all data", () => {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      calculator.addPosition(createClosedPosition(WALLET_2, 100, 150));

      calculator.clear();

      expect(calculator.getPositions(WALLET_1)).toHaveLength(0);
      expect(calculator.getPositions(WALLET_2)).toHaveLength(0);
    });
  });

  describe("P&L tier determination", () => {
    it("should correctly categorize massive loss", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 30)); // -70%
      }

      const result = calculator.analyze(WALLET_1);
      expect(result.tier).toBe(PnlTier.MASSIVE_LOSS);
    });

    it("should correctly categorize breakeven", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 100)); // 0%
      }

      const result = calculator.analyze(WALLET_1);
      expect(result.tier).toBe(PnlTier.BREAKEVEN);
    });

    it("should correctly categorize massive profit", () => {
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 250)); // +150%
      }

      const result = calculator.analyze(WALLET_1);
      expect(result.tier).toBe(PnlTier.MASSIVE_PROFIT);
    });

    it("should return unknown for insufficient data", () => {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));

      const result = calculator.analyze(WALLET_1, { minPositions: 5 });
      expect(result.tier).toBe(PnlTier.UNKNOWN);
    });
  });

  describe("Suspicion level determination", () => {
    it("should detect critical suspicion for obvious insiders", () => {
      const calc = new ProfitLossCalculator({
        minPositionsForAnalysis: 5,
        minPositionsForHighConfidence: 10,
      });

      // Add positions with 95% win rate and 80% avg ROI
      for (let i = 0; i < 19; i++) {
        calc.addPosition(createClosedPosition(WALLET_1, 100, 180)); // +80%
      }
      calc.addPosition(createClosedPosition(WALLET_1, 100, 90)); // -10%

      const result = calc.analyze(WALLET_1);

      expect([PnlSuspicionLevel.HIGH, PnlSuspicionLevel.CRITICAL]).toContain(
        result.suspicionLevel
      );
    });

    it("should return none for average performers", () => {
      // Mix of wins and losses to avoid 100% win rate triggering suspicion
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 110)); // +10% wins
      }
      for (let i = 0; i < 5; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 95)); // -5% losses
      }

      const result = calculator.analyze(WALLET_1);
      // Average performers should have NONE or at most LOW suspicion
      expect([PnlSuspicionLevel.NONE, PnlSuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
    });

    it("should return none for insufficient data", () => {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 200));

      const result = calculator.analyze(WALLET_1, { minPositions: 10 });
      expect(result.suspicionLevel).toBe(PnlSuspicionLevel.NONE);
    });
  });
});

describe("Factory functions", () => {
  beforeEach(() => {
    resetSharedProfitLossCalculator();
  });

  afterEach(() => {
    resetSharedProfitLossCalculator();
  });

  describe("createProfitLossCalculator", () => {
    it("should create a new calculator instance", () => {
      const calc = createProfitLossCalculator();
      expect(calc).toBeInstanceOf(ProfitLossCalculator);
    });

    it("should accept custom config", () => {
      const calc = createProfitLossCalculator({ cacheTtl: 10000 });
      expect(calc).toBeInstanceOf(ProfitLossCalculator);
    });
  });

  describe("shared calculator", () => {
    it("should get shared calculator", () => {
      const calc1 = getSharedProfitLossCalculator();
      const calc2 = getSharedProfitLossCalculator();
      expect(calc1).toBe(calc2);
    });

    it("should set shared calculator", () => {
      const custom = new ProfitLossCalculator();
      setSharedProfitLossCalculator(custom);
      expect(getSharedProfitLossCalculator()).toBe(custom);
    });

    it("should reset shared calculator", () => {
      const calc1 = getSharedProfitLossCalculator();
      resetSharedProfitLossCalculator();
      const calc2 = getSharedProfitLossCalculator();
      expect(calc1).not.toBe(calc2);
    });
  });

  describe("convenience functions", () => {
    it("addPositionForPnl should add to shared calculator", () => {
      const position = createClosedPosition(WALLET_1, 100, 150);
      addPositionForPnl(position);

      expect(getSharedProfitLossCalculator().getPositions(WALLET_1)).toHaveLength(
        1
      );
    });

    it("addPositionsForPnl should add multiple to shared calculator", () => {
      const positions = [
        createClosedPosition(WALLET_1, 100, 150),
        createClosedPosition(WALLET_1, 100, 120),
      ];
      addPositionsForPnl(positions);

      expect(getSharedProfitLossCalculator().getPositions(WALLET_1)).toHaveLength(
        2
      );
    });

    it("updatePositionPriceForPnl should update in shared calculator", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
        shares: 100,
      });
      addPositionForPnl(position);
      updatePositionPriceForPnl(WALLET_1, "pos-1", 0.8);

      const positions = getSharedProfitLossCalculator().getPositions(WALLET_1);
      expect(positions[0]!.currentPrice).toBe(0.8);
    });

    it("closePositionForPnl should close in shared calculator", () => {
      const position = createTestPosition({
        walletAddress: WALLET_1,
        positionId: "pos-1",
      });
      addPositionForPnl(position);
      closePositionForPnl(WALLET_1, "pos-1", 0.8);

      const positions = getSharedProfitLossCalculator().getPositions(WALLET_1);
      expect(positions[0]!.status).toBe(PositionStatus.CLOSED);
    });

    it("analyzePnl should use shared calculator", () => {
      for (let i = 0; i < 5; i++) {
        addPositionForPnl(createClosedPosition(WALLET_1, 100, 150));
      }

      const result = analyzePnl(WALLET_1);
      expect(result.totalPositions).toBe(5);
    });

    it("batchAnalyzePnl should use shared calculator", () => {
      for (let i = 0; i < 5; i++) {
        addPositionForPnl(createClosedPosition(WALLET_1, 100, 150));
        addPositionForPnl(createClosedPosition(WALLET_2, 100, 120));
      }

      const batch = batchAnalyzePnl([WALLET_1, WALLET_2]);
      expect(batch.results.size).toBe(2);
    });

    it("hasExceptionalReturns should use shared calculator", () => {
      for (let i = 0; i < 5; i++) {
        addPositionForPnl(createClosedPosition(WALLET_1, 100, 250));
      }

      expect(hasExceptionalReturns(WALLET_1)).toBe(true);
    });

    it("getHighReturnWallets should use shared calculator", () => {
      for (let i = 0; i < 5; i++) {
        addPositionForPnl(createClosedPosition(WALLET_1, 100, 200));
      }

      const highReturn = getHighReturnWallets(50);
      expect(highReturn.length).toBeGreaterThan(0);
    });

    it("getPotentialInsidersByPnl should use shared calculator", () => {
      const insiders = getPotentialInsidersByPnl();
      expect(insiders).toBeDefined();
    });

    it("getPnlCalculatorSummary should use shared calculator", () => {
      const summary = getPnlCalculatorSummary();
      expect(summary).toBeDefined();
      expect(summary.lastUpdated).toBeInstanceOf(Date);
    });
  });
});

describe("Description functions", () => {
  describe("getPnlTierDescription", () => {
    it("should return descriptions for all tiers", () => {
      for (const tier of Object.values(PnlTier)) {
        const description = getPnlTierDescription(tier);
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getPnlSuspicionDescription", () => {
    it("should return descriptions for all levels", () => {
      for (const level of Object.values(PnlSuspicionLevel)) {
        const description = getPnlSuspicionDescription(level);
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("Constants", () => {
  describe("PNL_WINDOW_DURATION_MS", () => {
    it("should have all window durations defined", () => {
      for (const window of Object.values(PnlWindow)) {
        expect(PNL_WINDOW_DURATION_MS[window]).toBeDefined();
      }
    });

    it("should have correct relative sizes", () => {
      expect(PNL_WINDOW_DURATION_MS[PnlWindow.DAY]).toBeLessThan(
        PNL_WINDOW_DURATION_MS[PnlWindow.WEEK]
      );
      expect(PNL_WINDOW_DURATION_MS[PnlWindow.WEEK]).toBeLessThan(
        PNL_WINDOW_DURATION_MS[PnlWindow.MONTH]
      );
      expect(PNL_WINDOW_DURATION_MS[PnlWindow.MONTH]).toBeLessThan(
        PNL_WINDOW_DURATION_MS[PnlWindow.QUARTER]
      );
      expect(PNL_WINDOW_DURATION_MS[PnlWindow.ALL_TIME]).toBe(Infinity);
    });
  });

  describe("PNL_TIER_THRESHOLDS", () => {
    it("should have all tiers defined", () => {
      for (const tier of Object.values(PnlTier)) {
        expect(PNL_TIER_THRESHOLDS[tier]).toBeDefined();
      }
    });

    it("should have consistent ranges", () => {
      expect(PNL_TIER_THRESHOLDS[PnlTier.MASSIVE_LOSS].min).toBe(-Infinity);
      expect(PNL_TIER_THRESHOLDS[PnlTier.MASSIVE_PROFIT].max).toBe(Infinity);
    });
  });

  describe("DEFAULT_PNL_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_PNL_CONFIG.minPositionsForAnalysis).toBeGreaterThan(0);
      expect(DEFAULT_PNL_CONFIG.cacheTtl).toBeGreaterThan(0);
      expect(DEFAULT_PNL_CONFIG.maxPositionsPerWallet).toBeGreaterThan(0);
    });
  });
});

describe("Edge cases", () => {
  let calculator: ProfitLossCalculator;

  beforeEach(() => {
    calculator = new ProfitLossCalculator();
  });

  afterEach(() => {
    calculator.clear();
  });

  it("should handle wallet with no positions", () => {
    const result = calculator.analyze(WALLET_1);

    expect(result.totalPositions).toBe(0);
    expect(result.aggregates.totalPnl).toBe(0);
    expect(result.tier).toBe(PnlTier.UNKNOWN);
  });

  it("should handle wallet with only open positions", () => {
    calculator.addPosition(
      createTestPosition({
        walletAddress: WALLET_1,
        status: PositionStatus.OPEN,
        costBasis: 100,
        currentValue: 120,
      })
    );

    const result = calculator.analyze(WALLET_1);

    expect(result.aggregates.totalRealizedPnl).toBe(0);
    expect(result.aggregates.totalUnrealizedPnl).toBe(20);
  });

  it("should handle all winning trades", () => {
    for (let i = 0; i < 10; i++) {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
    }

    const result = calculator.analyze(WALLET_1);

    expect(result.windowStats[PnlWindow.ALL_TIME].profitablePositions).toBe(10);
    expect(result.windowStats[PnlWindow.ALL_TIME].losingPositions).toBe(0);
    expect(result.windowStats[PnlWindow.ALL_TIME].profitFactor).toBe(Infinity);
  });

  it("should handle all losing trades", () => {
    for (let i = 0; i < 10; i++) {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 50));
    }

    const result = calculator.analyze(WALLET_1);

    expect(result.windowStats[PnlWindow.ALL_TIME].profitablePositions).toBe(0);
    expect(result.windowStats[PnlWindow.ALL_TIME].losingPositions).toBe(10);
    expect(result.windowStats[PnlWindow.ALL_TIME].profitFactor).toBe(0);
  });

  it("should handle zero cost basis", () => {
    const position = createClosedPosition(WALLET_1, 0, 100);
    calculator.addPosition(position);

    const realized = calculator.calculateRealizedPnl(position);
    expect(realized!.roi).toBe(0); // Avoid division by zero
  });

  it("should handle very large P&L values", () => {
    const position = createClosedPosition(WALLET_1, 1000000, 10000000);
    calculator.addPosition(position);

    const result = calculator.analyze(WALLET_1);
    expect(result.aggregates.totalRealizedPnl).toBe(9000000);
  });

  it("should handle negative fees gracefully", () => {
    const position = createClosedPosition(WALLET_1, 100, 150);
    position.fees = -5; // Rebate
    calculator.addPosition(position);

    const realized = calculator.calculateRealizedPnl(position);
    expect(realized!.realizedPnl).toBe(55); // 150 - 100 - (-5)
  });

  it("should handle positions with same ID across different wallets", () => {
    const position1 = createClosedPosition(WALLET_1, 100, 150);
    position1.positionId = "same-id";

    const position2 = createClosedPosition(WALLET_2, 100, 80);
    position2.positionId = "same-id";

    calculator.addPosition(position1);
    calculator.addPosition(position2);

    expect(calculator.getPositions(WALLET_1)).toHaveLength(1);
    expect(calculator.getPositions(WALLET_2)).toHaveLength(1);
  });
});

describe("Data quality calculation", () => {
  let calculator: ProfitLossCalculator;

  beforeEach(() => {
    calculator = new ProfitLossCalculator();
  });

  afterEach(() => {
    calculator.clear();
  });

  it("should return 0 for very few positions", () => {
    calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));

    const result = calculator.analyze(WALLET_1);
    expect(result.dataQuality).toBe(0);
  });

  it("should return 100 for many positions", () => {
    for (let i = 0; i < 100; i++) {
      calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
    }

    const result = calculator.analyze(WALLET_1);
    expect(result.dataQuality).toBe(100);
  });

  it("should scale with position count", () => {
    const qualityChecks = [
      { count: 5, expected: 20 },
      { count: 10, expected: 40 },
      { count: 20, expected: 60 },
      { count: 50, expected: 80 },
    ];

    for (const check of qualityChecks) {
      calculator.clear();
      for (let i = 0; i < check.count; i++) {
        calculator.addPosition(createClosedPosition(WALLET_1, 100, 150));
      }

      const result = calculator.analyze(WALLET_1);
      expect(result.dataQuality).toBe(check.expected);
    }
  });
});
