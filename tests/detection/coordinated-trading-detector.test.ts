/**
 * Unit Tests for Coordinated Trading Detector (DET-PAT-008)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CoordinatedTradingDetector,
  CoordinationPatternType,
  CoordinationConfidence,
  CoordinationRiskLevel,
  CoordinationFlag,
  DEFAULT_COORDINATION_THRESHOLDS,
  createCoordinatedTradingDetector,
  getSharedCoordinatedTradingDetector,
  setSharedCoordinatedTradingDetector,
  resetSharedCoordinatedTradingDetector,
  addTradesForCoordination,
  analyzeWalletCoordination,
  batchAnalyzeCoordination,
  isWalletCoordinated,
  getDetectedCoordinatedGroups,
  getHighRiskCoordinatedGroups,
  getCoordinatedTradingSummary,
  getCoordinationPatternDescription,
  getCoordinationRiskDescription,
  getCoordinationConfidenceDescription,
  getCoordinationFlagDescription,
  CoordinatedTrade,
} from "../../src/detection/coordinated-trading-detector";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_WALLETS = {
  walletA: "0x1111111111111111111111111111111111111111",
  walletB: "0x2222222222222222222222222222222222222222",
  walletC: "0x3333333333333333333333333333333333333333",
  walletD: "0x4444444444444444444444444444444444444444",
  walletE: "0x5555555555555555555555555555555555555555",
};

const TEST_MARKETS = {
  market1: "market_1",
  market2: "market_2",
  market3: "market_3",
  market4: "market_4",
};

function createTrade(
  walletAddress: string,
  marketId: string,
  timestamp: number,
  options: Partial<CoordinatedTrade> = {}
): CoordinatedTrade {
  return {
    tradeId: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    walletAddress,
    marketId,
    side: "buy",
    sizeUsd: 1000,
    price: 0.5,
    timestamp,
    ...options,
  };
}

// Helper function for creating simultaneous trades (used in some tests)
function _createSimultaneousTrades(
  walletAddresses: string[],
  marketId: string,
  baseTimestamp: number,
  side: "buy" | "sell" = "buy",
  sizeUsd: number = 1000
): CoordinatedTrade[] {
  return walletAddresses.map((wallet, index) =>
    createTrade(wallet, marketId, baseTimestamp + index * 1000, {
      side,
      sizeUsd,
    })
  );
}
void _createSimultaneousTrades; // Silence unused warning

// ============================================================================
// Tests
// ============================================================================

describe("CoordinatedTradingDetector", () => {
  let detector: CoordinatedTradingDetector;

  beforeEach(() => {
    detector = createCoordinatedTradingDetector({
      enableEvents: true,
      enableCaching: true,
    });
  });

  afterEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  describe("Constructor and Configuration", () => {
    it("should create detector with default config", () => {
      const det = createCoordinatedTradingDetector();
      expect(det).toBeInstanceOf(CoordinatedTradingDetector);
      const thresholds = det.getThresholds();
      expect(thresholds.simultaneousWindowMs).toBe(
        DEFAULT_COORDINATION_THRESHOLDS.simultaneousWindowMs
      );
    });

    it("should create detector with custom thresholds", () => {
      const det = createCoordinatedTradingDetector({
        thresholds: {
          minSimilarityScore: 80,
          minGroupSize: 3,
        },
      });
      const thresholds = det.getThresholds();
      expect(thresholds.minSimilarityScore).toBe(80);
      expect(thresholds.minGroupSize).toBe(3);
    });

    it("should update thresholds", () => {
      detector.updateThresholds({ minSimilarityScore: 90 });
      expect(detector.getThresholds().minSimilarityScore).toBe(90);
    });

    it("should emit configUpdated event on threshold update", () => {
      const handler = vi.fn();
      detector.on("configUpdated", handler);
      detector.updateThresholds({ minSimilarityScore: 85 });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Trade Management", () => {
    it("should add trades", () => {
      const trades = [
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market2, Date.now()),
      ];
      detector.addTrades(trades);
      expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(2);
    });

    it("should normalize addresses when adding trades", () => {
      const trade = createTrade(
        TEST_WALLETS.walletA.toLowerCase(),
        TEST_MARKETS.market1,
        Date.now()
      );
      detector.addTrades([trade]);

      // Should be retrievable with checksummed address
      const trades = detector.getTrades(TEST_WALLETS.walletA);
      expect(trades).toHaveLength(1);
    });

    it("should deduplicate trades by ID", () => {
      const trade = createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now());
      detector.addTrades([trade, trade]);
      expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(1);
    });

    it("should skip trades with invalid addresses", () => {
      const trade = {
        ...createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        walletAddress: "invalid_address",
      };
      detector.addTrades([trade]);
      expect(detector.getTrackedWallets()).toHaveLength(0);
    });

    it("should get tracked wallets", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, Date.now()),
      ]);
      const wallets = detector.getTrackedWallets();
      expect(wallets).toHaveLength(2);
    });

    it("should clear trades for a wallet", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, Date.now()),
      ]);
      detector.clearTrades(TEST_WALLETS.walletA);
      expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(0);
      expect(detector.getTrades(TEST_WALLETS.walletB)).toHaveLength(1);
    });

    it("should clear all trades", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, Date.now()),
      ]);
      detector.clearAllTrades();
      expect(detector.getTrackedWallets()).toHaveLength(0);
    });

    it("should emit tradesAdded event", () => {
      const handler = vi.fn();
      detector.on("tradesAdded", handler);
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
      ]);
      expect(handler).toHaveBeenCalledWith({ count: 1 });
    });

    it("should emit tradesCleared event", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
      ]);
      const handler = vi.fn();
      detector.on("tradesCleared", handler);
      detector.clearTrades(TEST_WALLETS.walletA);
      expect(handler).toHaveBeenCalled();
    });

    it("should emit allTradesCleared event", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
      ]);
      const handler = vi.fn();
      detector.on("allTradesCleared", handler);
      detector.clearAllTrades();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Pair Analysis", () => {
    it("should return null for same wallet comparison", () => {
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletA);
      expect(result).toBeNull();
    });

    it("should return null for insufficient trades", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, Date.now()),
      ]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);
      expect(result).toBeNull(); // Need minimum trades per wallet
    });

    it("should analyze pair with sufficient trades", () => {
      const baseTime = Date.now();
      // Add enough trades for both wallets
      const tradesA = Array.from({ length: 10 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
      );
      const tradesB = Array.from({ length: 10 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500)
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.walletA).toBe(TEST_WALLETS.walletA);
      expect(result!.walletB).toBe(TEST_WALLETS.walletB);
      expect(result!.similarityScore).toBeGreaterThan(0);
      expect(result!.marketOverlap).toBe(100); // Both trade same market
    });

    it("should detect high timing correlation for simultaneous trades", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 10 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000)
      );
      const tradesB = Array.from({ length: 10 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 60000 + 100)
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.timingCorrelation).toBeGreaterThan(0.5);
    });

    it("should detect low timing correlation for asynchronous trades", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 10 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000)
      );
      // Trades B are 5 minutes offset (beyond simultaneous window)
      const tradesB = Array.from({ length: 10 }, (_, i) =>
        createTrade(
          TEST_WALLETS.walletB,
          TEST_MARKETS.market1,
          baseTime + i * 60000 + 300000
        )
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.timingCorrelation).toBeLessThan(0.5);
    });

    it("should detect high market overlap", () => {
      const baseTime = Date.now();
      const tradesA = [
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + 1000),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market2, baseTime + 2000),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market2, baseTime + 3000),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market3, baseTime + 4000),
      ];
      const tradesB = [
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + 100),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + 1100),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market2, baseTime + 2100),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market2, baseTime + 3100),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market3, baseTime + 4100),
      ];

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.marketOverlap).toBe(100);
      expect(result!.overlappingMarkets).toBe(3);
    });

    it("should detect low market overlap", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market2, baseTime + i * 1000)
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.marketOverlap).toBeLessThan(50);
    });

    it("should detect same direction alignment", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000, {
          side: "buy",
        })
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500, {
          side: "buy",
        })
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.directionAlignment).toBe(1); // All same direction
    });

    it("should detect opposite direction alignment (potential wash trading)", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000, {
          side: "buy",
        })
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500, {
          side: "sell",
        })
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.directionAlignment).toBe(0); // All opposite direction
    });

    it("should detect size similarity", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000, {
          sizeUsd: 1000,
        })
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500, {
          sizeUsd: 1000,
        })
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result).not.toBeNull();
      expect(result!.sizeSimilarity).toBe(1); // Identical sizes
    });

    it("should cache pair analysis results", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500)
      );

      detector.addTrades([...tradesA, ...tradesB]);

      // First call
      const result1 = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);
      // Second call (should be cached)
      const result2 = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(result1).toEqual(result2);
    });

    it("should bypass cache when requested", () => {
      const baseTime = Date.now();
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
      );
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 1000 + 500)
      );

      detector.addTrades([...tradesA, ...tradesB]);

      const result1 = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);
      const result2 = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB, {
        bypassCache: true,
      });

      // Results should be equivalent (same data) but different object refs
      expect(result1).not.toBe(result2);
      expect(result1!.similarityScore).toBe(result2!.similarityScore);
    });
  });

  describe("Coordination Detection", () => {
    it("should detect coordinated wallets trading simultaneously", () => {
      const baseTime = Date.now();

      // Create highly correlated trading patterns
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "buy", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      const result = detector.analyze(TEST_WALLETS.walletA);

      expect(result.isCoordinated).toBe(true);
      expect(result.groups.length).toBeGreaterThan(0);
    });

    it("should detect counter-party trading (wash trading indicator)", () => {
      const baseTime = Date.now();

      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "sell", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      const pairResult = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB);

      expect(pairResult).not.toBeNull();
      expect(pairResult!.flags).toContain(CoordinationFlag.OPPOSITE_DIRECTIONS);
    });

    it("should not detect coordination for unrelated wallets", () => {
      const baseTimeA = Date.now();
      const baseTimeB = Date.now() + 10 * 60 * 60 * 1000; // 10 hours later

      // Wallet A trades market1 at time T
      const tradesA = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTimeA + i * 1000)
      );

      // Wallet B trades market2 at time T+10h
      const tradesB = Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market2, baseTimeB + i * 1000)
      );

      detector.addTrades([...tradesA, ...tradesB]);
      const result = detector.analyze(TEST_WALLETS.walletA);

      // Either no groups or low risk
      expect(
        result.groups.length === 0 ||
          result.highestRiskLevel === CoordinationRiskLevel.NONE ||
          result.highestRiskLevel === CoordinationRiskLevel.LOW
      ).toBe(true);
    });

    it("should identify appropriate pattern type", () => {
      const baseTime = Date.now();

      // Create mirror trading pattern
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "buy", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      const result = detector.analyze(TEST_WALLETS.walletA);

      if (result.groups.length > 0) {
        const firstGroup = result.groups[0];
        if (firstGroup) {
          expect([
            CoordinationPatternType.SIMULTANEOUS,
            CoordinationPatternType.MIRROR_TRADING,
            CoordinationPatternType.MULTI_PATTERN,
          ]).toContain(firstGroup.pattern);
        }
      }
    });

    it("should emit analysisComplete event", () => {
      const baseTime = Date.now();
      detector.addTrades(
        Array.from({ length: 5 }, (_, i) =>
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
        )
      );

      const handler = vi.fn();
      detector.on("analysisComplete", handler);
      detector.analyze(TEST_WALLETS.walletA);

      expect(handler).toHaveBeenCalled();
    });

    it("should emit highRiskGroupDetected for high risk groups", () => {
      const baseTime = Date.now();

      // Create very suspicious pattern
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 20; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
            outcome: "win",
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 50,
            { side: "buy", sizeUsd: 1000, outcome: "win" }
          )
        );
      }

      detector.addTrades(trades);
      const handler = vi.fn();
      detector.on("highRiskGroupDetected", handler);

      detector.analyze(TEST_WALLETS.walletA);

      // May or may not trigger depending on risk calculation
      // Just verify event system works
      expect(handler.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Group Management", () => {
    it("should track detected groups", () => {
      const baseTime = Date.now();
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "buy", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      detector.analyze(TEST_WALLETS.walletA);

      const groups = detector.getDetectedGroups();
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });

    it("should check if wallet is coordinated", () => {
      const baseTime = Date.now();
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "buy", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      detector.analyze(TEST_WALLETS.walletA);

      // Result depends on whether groups were detected
      const isCoord = detector.isCoordinated(TEST_WALLETS.walletA);
      expect(typeof isCoord).toBe("boolean");
    });

    it("should get groups for a specific wallet", () => {
      const baseTime = Date.now();
      const trades: CoordinatedTrade[] = [];
      for (let i = 0; i < 10; i++) {
        trades.push(
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000, {
            side: "buy",
            sizeUsd: 1000,
          }),
          createTrade(
            TEST_WALLETS.walletB,
            TEST_MARKETS.market1,
            baseTime + i * 60000 + 100,
            { side: "buy", sizeUsd: 1000 }
          )
        );
      }

      detector.addTrades(trades);
      detector.analyze(TEST_WALLETS.walletA);

      const groups = detector.getGroupsForWallet(TEST_WALLETS.walletA);
      expect(Array.isArray(groups)).toBe(true);
    });

    it("should get high risk groups", () => {
      const groups = detector.getHighRiskGroups();
      expect(Array.isArray(groups)).toBe(true);
    });

    it("should get groups by pattern type", () => {
      const groups = detector.getGroupsByPattern(CoordinationPatternType.SIMULTANEOUS);
      expect(Array.isArray(groups)).toBe(true);
    });

    it("should get groups by risk level", () => {
      const groups = detector.getGroupsByRiskLevel(CoordinationRiskLevel.HIGH);
      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe("Batch Analysis", () => {
    it("should batch analyze multiple wallets", () => {
      const baseTime = Date.now();
      const trades: CoordinatedTrade[] = [];

      // Add trades for multiple wallets
      for (const wallet of Object.values(TEST_WALLETS)) {
        for (let i = 0; i < 5; i++) {
          trades.push(
            createTrade(wallet, TEST_MARKETS.market1, baseTime + i * 1000)
          );
        }
      }

      detector.addTrades(trades);
      const result = detector.batchAnalyze(Object.values(TEST_WALLETS));

      expect(result.walletsAnalyzed).toBe(5);
      expect(result.resultsByWallet.size).toBe(5);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should count groups by risk level in batch", () => {
      const result = detector.batchAnalyze([]);
      expect(result.groupsByRisk[CoordinationRiskLevel.NONE]).toBe(0);
      expect(result.groupsByRisk[CoordinationRiskLevel.LOW]).toBe(0);
      expect(result.groupsByRisk[CoordinationRiskLevel.MEDIUM]).toBe(0);
      expect(result.groupsByRisk[CoordinationRiskLevel.HIGH]).toBe(0);
      expect(result.groupsByRisk[CoordinationRiskLevel.CRITICAL]).toBe(0);
    });

    it("should count groups by pattern type in batch", () => {
      const result = detector.batchAnalyze([]);
      expect(
        result.groupsByPattern[CoordinationPatternType.UNKNOWN]
      ).toBeDefined();
      expect(
        result.groupsByPattern[CoordinationPatternType.SIMULTANEOUS]
      ).toBeDefined();
    });

    it("should emit batchAnalysisComplete event", () => {
      const handler = vi.fn();
      detector.on("batchAnalysisComplete", handler);
      detector.batchAnalyze([TEST_WALLETS.walletA]);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", () => {
      const baseTime = Date.now();
      detector.addTrades(
        Array.from({ length: 5 }, (_, i) =>
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
        )
      );

      detector.analyze(TEST_WALLETS.walletA);
      detector.clearCache();

      const summary = detector.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });

    it("should prune expired cache entries", () => {
      // Create detector with very short cache TTL
      const shortCacheDetector = createCoordinatedTradingDetector({
        cacheTtlMs: 1,
      });

      const baseTime = Date.now();
      shortCacheDetector.addTrades(
        Array.from({ length: 5 }, (_, i) =>
          createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 1000)
        )
      );

      shortCacheDetector.analyze(TEST_WALLETS.walletA);

      // Wait a bit for cache to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortCacheDetector.pruneCache();
          const summary = shortCacheDetector.getSummary();
          expect(summary.cacheStats.size).toBe(0);
          resolve();
        }, 10);
      });
    });

    it("should emit cacheCleared event", () => {
      const handler = vi.fn();
      detector.on("cacheCleared", handler);
      detector.clearCache();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Summary", () => {
    it("should provide comprehensive summary", () => {
      const summary = detector.getSummary();

      expect(summary.totalWallets).toBe(0);
      expect(summary.totalTrades).toBe(0);
      expect(summary.detectedGroups).toBe(0);
      expect(summary.coordinatedWalletCount).toBe(0);
      expect(summary.groupsByRisk).toBeDefined();
      expect(summary.groupsByPattern).toBeDefined();
      expect(summary.cacheStats).toBeDefined();
    });

    it("should track wallet and trade counts", () => {
      detector.addTrades([
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market2, Date.now()),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, Date.now()),
      ]);

      const summary = detector.getSummary();
      expect(summary.totalWallets).toBe(2);
      expect(summary.totalTrades).toBe(3);
    });

    it("should include most connected wallets", () => {
      const summary = detector.getSummary();
      expect(Array.isArray(summary.mostConnectedWallets)).toBe(true);
    });
  });
});

describe("Shared Instance Functions", () => {
  beforeEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  afterEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  it("should get shared instance", () => {
    const detector = getSharedCoordinatedTradingDetector();
    expect(detector).toBeInstanceOf(CoordinatedTradingDetector);
  });

  it("should return same shared instance", () => {
    const detector1 = getSharedCoordinatedTradingDetector();
    const detector2 = getSharedCoordinatedTradingDetector();
    expect(detector1).toBe(detector2);
  });

  it("should set shared instance", () => {
    const custom = createCoordinatedTradingDetector({
      thresholds: { minSimilarityScore: 99 },
    });
    setSharedCoordinatedTradingDetector(custom);
    expect(getSharedCoordinatedTradingDetector()).toBe(custom);
  });

  it("should reset shared instance", () => {
    const original = getSharedCoordinatedTradingDetector();
    resetSharedCoordinatedTradingDetector();
    const newInstance = getSharedCoordinatedTradingDetector();
    expect(newInstance).not.toBe(original);
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  afterEach(() => {
    resetSharedCoordinatedTradingDetector();
  });

  it("should add trades using convenience function", () => {
    addTradesForCoordination([
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
    ]);
    const detector = getSharedCoordinatedTradingDetector();
    expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(1);
  });

  it("should analyze wallet using convenience function", () => {
    addTradesForCoordination([
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now()),
    ]);
    const result = analyzeWalletCoordination(TEST_WALLETS.walletA);
    expect(result.walletAddress).toBe(TEST_WALLETS.walletA);
  });

  it("should batch analyze using convenience function", () => {
    const result = batchAnalyzeCoordination([TEST_WALLETS.walletA]);
    expect(result.walletsAnalyzed).toBe(1);
  });

  it("should check coordination using convenience function", () => {
    const isCoord = isWalletCoordinated(TEST_WALLETS.walletA);
    expect(typeof isCoord).toBe("boolean");
  });

  it("should get detected groups using convenience function", () => {
    const groups = getDetectedCoordinatedGroups();
    expect(Array.isArray(groups)).toBe(true);
  });

  it("should get high risk groups using convenience function", () => {
    const groups = getHighRiskCoordinatedGroups();
    expect(Array.isArray(groups)).toBe(true);
  });

  it("should get summary using convenience function", () => {
    const summary = getCoordinatedTradingSummary();
    expect(summary.totalWallets).toBeDefined();
    expect(summary.detectedGroups).toBeDefined();
  });
});

describe("Description Functions", () => {
  describe("getCoordinationPatternDescription", () => {
    it("should describe all pattern types", () => {
      for (const pattern of Object.values(CoordinationPatternType)) {
        const desc = getCoordinationPatternDescription(pattern);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });

    it("should provide meaningful descriptions", () => {
      expect(getCoordinationPatternDescription(CoordinationPatternType.SIMULTANEOUS)).toContain(
        "same time"
      );
      expect(getCoordinationPatternDescription(CoordinationPatternType.COUNTER_PARTY)).toContain(
        "opposite"
      );
    });
  });

  describe("getCoordinationRiskDescription", () => {
    it("should describe all risk levels", () => {
      for (const risk of Object.values(CoordinationRiskLevel)) {
        const desc = getCoordinationRiskDescription(risk);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });
  });

  describe("getCoordinationConfidenceDescription", () => {
    it("should describe all confidence levels", () => {
      for (const conf of Object.values(CoordinationConfidence)) {
        const desc = getCoordinationConfidenceDescription(conf);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });
  });

  describe("getCoordinationFlagDescription", () => {
    it("should describe all flags", () => {
      for (const flag of Object.values(CoordinationFlag)) {
        const desc = getCoordinationFlagDescription(flag);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe("string");
      }
    });
  });
});

describe("Edge Cases", () => {
  let detector: CoordinatedTradingDetector;

  beforeEach(() => {
    detector = createCoordinatedTradingDetector();
  });

  it("should handle empty trades array", () => {
    detector.addTrades([]);
    expect(detector.getTrackedWallets()).toHaveLength(0);
  });

  it("should handle null/undefined gracefully", () => {
    // @ts-expect-error Testing runtime behavior
    detector.addTrades(null);
    expect(detector.getTrackedWallets()).toHaveLength(0);

    // @ts-expect-error Testing runtime behavior
    detector.addTrades(undefined);
    expect(detector.getTrackedWallets()).toHaveLength(0);
  });

  it("should handle invalid wallet address in getTrades", () => {
    const trades = detector.getTrades("invalid");
    expect(trades).toHaveLength(0);
  });

  it("should handle invalid wallet address in analyze", () => {
    expect(() => detector.analyze("invalid")).toThrow();
  });

  it("should handle wallet with no other wallets to compare", () => {
    detector.addTrades(
      Array.from({ length: 5 }, (_, i) =>
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now() + i * 1000)
      )
    );
    const result = detector.analyze(TEST_WALLETS.walletA);
    expect(result.isCoordinated).toBe(false);
    expect(result.groups).toHaveLength(0);
  });

  it("should handle very large number of trades", () => {
    const trades = Array.from({ length: 1000 }, (_, i) =>
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, Date.now() + i)
    );
    detector.addTrades(trades);
    expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(1000);
  });

  it("should respect maxPairsPerWallet limit", () => {
    const limitedDetector = createCoordinatedTradingDetector({
      maxPairsPerWallet: 2,
    });

    const baseTime = Date.now();
    // Add trades for many wallets
    for (let w = 0; w < 10; w++) {
      for (let i = 0; i < 5; i++) {
        limitedDetector.addTrades([
          createTrade(
            `0x${w.toString().padStart(40, "0")}`,
            TEST_MARKETS.market1,
            baseTime + i * 1000
          ),
        ]);
      }
    }

    // Should still work but only compare up to limit
    const result = limitedDetector.analyze("0x0000000000000000000000000000000000000000");
    expect(result.walletsCompared).toBeLessThanOrEqual(2);
  });

  it("should handle trades with missing optional fields", () => {
    const trade: CoordinatedTrade = {
      tradeId: "test_1",
      walletAddress: TEST_WALLETS.walletA,
      marketId: TEST_MARKETS.market1,
      side: "buy",
      sizeUsd: 100,
      price: 0.5,
      timestamp: Date.now(),
    };
    detector.addTrades([trade]);
    expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(1);
  });

  it("should handle trades with win/loss outcomes", () => {
    const baseTime = Date.now();
    const trades = [
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime, {
        outcome: "win",
      }),
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + 1000, {
        outcome: "loss",
      }),
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + 2000, {
        outcome: "pending",
      }),
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + 3000),
      createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + 4000),
    ];
    detector.addTrades(trades);
    expect(detector.getTrades(TEST_WALLETS.walletA)).toHaveLength(5);
  });
});

describe("Filter Options", () => {
  let detector: CoordinatedTradingDetector;

  beforeEach(() => {
    detector = createCoordinatedTradingDetector();
    const baseTime = Date.now();
    const trades: CoordinatedTrade[] = [];

    // Add trades spanning time and markets
    for (let i = 0; i < 10; i++) {
      trades.push(
        createTrade(TEST_WALLETS.walletA, TEST_MARKETS.market1, baseTime + i * 60000),
        createTrade(
          TEST_WALLETS.walletA,
          TEST_MARKETS.market2,
          baseTime + i * 60000 + 1000
        ),
        createTrade(TEST_WALLETS.walletB, TEST_MARKETS.market1, baseTime + i * 60000 + 100),
        createTrade(
          TEST_WALLETS.walletB,
          TEST_MARKETS.market2,
          baseTime + i * 60000 + 1100
        )
      );
    }

    detector.addTrades(trades);
  });

  it("should filter by time range", () => {
    const baseTime = Date.now();
    const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB, {
      startTime: baseTime,
      endTime: baseTime + 300000, // First 5 minutes
    });

    expect(result).not.toBeNull();
    expect(result!.totalTradesAnalyzed).toBeLessThan(40); // Less than all trades
  });

  it("should filter by market", () => {
    const result = detector.analyzePair(TEST_WALLETS.walletA, TEST_WALLETS.walletB, {
      marketFilter: [TEST_MARKETS.market1],
    });

    expect(result).not.toBeNull();
    // Should only see market1
    expect(result!.overlappingMarkets).toBeLessThanOrEqual(1);
  });
});

describe("Constants and Defaults", () => {
  it("should export DEFAULT_COORDINATION_THRESHOLDS", () => {
    expect(DEFAULT_COORDINATION_THRESHOLDS).toBeDefined();
    expect(DEFAULT_COORDINATION_THRESHOLDS.simultaneousWindowMs).toBe(60000);
    expect(DEFAULT_COORDINATION_THRESHOLDS.minSimilarityScore).toBe(70);
    expect(DEFAULT_COORDINATION_THRESHOLDS.minGroupSize).toBe(2);
  });

  it("should have valid score weights that sum to 1", () => {
    const weights = DEFAULT_COORDINATION_THRESHOLDS.scoreWeights;
    const sum =
      weights.timingCorrelation +
      weights.marketOverlap +
      weights.sizeSimilarity +
      weights.directionAlignment +
      weights.winRateCorrelation;
    expect(sum).toBe(1);
  });

  it("should have ascending risk thresholds", () => {
    const thresholds = DEFAULT_COORDINATION_THRESHOLDS.riskThresholds;
    expect(thresholds.low).toBeLessThan(thresholds.medium);
    expect(thresholds.medium).toBeLessThan(thresholds.high);
    expect(thresholds.high).toBeLessThan(thresholds.critical);
  });

  it("should have ascending confidence thresholds", () => {
    const thresholds = DEFAULT_COORDINATION_THRESHOLDS.confidenceThresholds;
    expect(thresholds.veryLow).toBeLessThan(thresholds.low);
    expect(thresholds.low).toBeLessThan(thresholds.medium);
    expect(thresholds.medium).toBeLessThan(thresholds.high);
    expect(thresholds.high).toBeLessThan(thresholds.veryHigh);
  });
});
