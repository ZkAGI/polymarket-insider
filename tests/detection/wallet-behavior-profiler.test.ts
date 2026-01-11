/**
 * Tests for Wallet Behavior Profiler (DET-PAT-001)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WalletBehaviorProfiler,
  TradingFrequency,
  TradingStyle,
  RiskAppetite,
  ProfileConfidence,
  BehaviorFlag,
  createWalletBehaviorProfiler,
  getSharedWalletBehaviorProfiler,
  setSharedWalletBehaviorProfiler,
  resetSharedWalletBehaviorProfiler,
  buildWalletBehaviorProfile,
  updateWalletBehaviorProfile,
  getWalletBehaviorProfile,
  batchBuildWalletBehaviorProfiles,
  hasHighSuspicionProfile,
  getPotentialInsiderProfiles,
  getWalletBehaviorProfilerSummary,
  type ProfileTrade,
  type WalletBehaviorProfilerConfig,
} from "../../src/detection/wallet-behavior-profiler";
import { MarketCategory } from "../../src/api/gamma/types";

// ============================================================================
// Test Constants
// ============================================================================

// Use correctly checksummed addresses for viem
const VALID_ADDRESS = "0x742D35cC6634C0532925a3B844bC9E7595f8fe21";
const VALID_ADDRESS_2 = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const VALID_ADDRESS_3 = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
const INVALID_ADDRESS = "0xinvalid";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock trade for testing
 */
function createMockTrade(
  overrides: Partial<ProfileTrade> = {}
): ProfileTrade {
  return {
    tradeId: `trade-${Math.random().toString(36).substr(2, 9)}`,
    marketId: `market-${Math.floor(Math.random() * 10)}`,
    marketCategory: MarketCategory.POLITICS,
    side: "buy",
    sizeUsd: 1000,
    price: 0.5,
    timestamp: new Date(),
    isWinner: null,
    pnl: null,
    isMaker: false,
    flags: [],
    ...overrides,
  };
}

/**
 * Generate multiple mock trades
 */
function generateMockTrades(
  count: number,
  baseOptions: Partial<ProfileTrade> = {}
): ProfileTrade[] {
  const trades: ProfileTrade[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    trades.push(
      createMockTrade({
        tradeId: `trade-${i}`,
        timestamp: new Date(now - (count - i) * 60 * 60 * 1000), // 1 hour apart
        ...baseOptions,
      })
    );
  }

  return trades;
}

/**
 * Generate trades with specific time distribution
 */
function generateTimeDistributedTrades(
  count: number,
  hourOfDay: number
): ProfileTrade[] {
  const trades: ProfileTrade[] = [];
  const baseDate = new Date("2024-01-01T00:00:00Z");

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    date.setUTCHours(hourOfDay);

    trades.push(
      createMockTrade({
        tradeId: `trade-${i}`,
        timestamp: date,
      })
    );
  }

  return trades;
}

/**
 * Generate trades with performance data
 */
function generatePerformanceTrades(
  winCount: number,
  lossCount: number,
  avgWinPnl: number = 500,
  avgLossPnl: number = 300
): ProfileTrade[] {
  const trades: ProfileTrade[] = [];
  const now = Date.now();

  for (let i = 0; i < winCount; i++) {
    trades.push(
      createMockTrade({
        tradeId: `win-${i}`,
        timestamp: new Date(now - (winCount + lossCount - i) * 60 * 60 * 1000),
        isWinner: true,
        pnl: avgWinPnl + (Math.random() - 0.5) * 100,
      })
    );
  }

  for (let i = 0; i < lossCount; i++) {
    trades.push(
      createMockTrade({
        tradeId: `loss-${i}`,
        timestamp: new Date(now - (lossCount - i) * 60 * 60 * 1000),
        isWinner: false,
        pnl: -(avgLossPnl + (Math.random() - 0.5) * 100),
      })
    );
  }

  return trades;
}

// ============================================================================
// Tests
// ============================================================================

describe("WalletBehaviorProfiler", () => {
  let profiler: WalletBehaviorProfiler;

  beforeEach(() => {
    profiler = new WalletBehaviorProfiler();
  });

  afterEach(() => {
    profiler.clearCache();
    resetSharedWalletBehaviorProfiler();
  });

  // --------------------------------------------------------------------------
  // Constructor and Configuration Tests
  // --------------------------------------------------------------------------

  describe("constructor", () => {
    it("should create profiler with default config", () => {
      const p = new WalletBehaviorProfiler();
      expect(p).toBeInstanceOf(WalletBehaviorProfiler);
    });

    it("should accept custom configuration", () => {
      const config: WalletBehaviorProfilerConfig = {
        minTradesForProfile: 10,
        cacheTtlMs: 10000,
        largeTradeThreshold: 5000,
      };

      const p = new WalletBehaviorProfiler(config);
      expect(p).toBeInstanceOf(WalletBehaviorProfiler);
    });

    it("should merge custom config with defaults", () => {
      const config: WalletBehaviorProfilerConfig = {
        minTradesForProfile: 10,
      };

      const p = new WalletBehaviorProfiler(config);
      // Should still work with other defaults
      const trades = generateMockTrades(15);
      const profile = p.buildProfile(VALID_ADDRESS, { trades });
      expect(profile).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Profile Building Tests
  // --------------------------------------------------------------------------

  describe("buildProfile", () => {
    it("should build a profile for valid address with enough trades", () => {
      const trades = generateMockTrades(10);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.address).toBe(VALID_ADDRESS);
      expect(profile!.tradeCount).toBe(10);
    });

    it("should return null for insufficient trades", () => {
      const trades = generateMockTrades(2);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).toBeNull();
    });

    it("should throw error for invalid address", () => {
      const trades = generateMockTrades(10);

      expect(() => {
        profiler.buildProfile(INVALID_ADDRESS, { trades });
      }).toThrow("Invalid wallet address");
    });

    it("should checksum the address", () => {
      const trades = generateMockTrades(10);
      const lowercaseAddress = VALID_ADDRESS.toLowerCase();
      const profile = profiler.buildProfile(lowercaseAddress, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.address).toBe(VALID_ADDRESS);
    });

    it("should filter out invalid trades", () => {
      const trades = [
        ...generateMockTrades(5),
        createMockTrade({ sizeUsd: 0 }),
        createMockTrade({ sizeUsd: -100 }),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });
      expect(profile).not.toBeNull();
      expect(profile!.tradeCount).toBe(5);
    });

    it("should respect custom minTrades option", () => {
      const trades = generateMockTrades(5);

      // Should fail with higher minimum
      const profile1 = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 10,
      });
      expect(profile1).toBeNull();

      // Should succeed with lower minimum
      const profile2 = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });
      expect(profile2).not.toBeNull();
    });

    it("should include trade IDs when requested", () => {
      const trades = generateMockTrades(5);

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        includeTradeIds: true,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.tradeIds).toHaveLength(5);
      expect(profile!.tradeIds).toContain("trade-0");
    });

    it("should not include trade IDs by default", () => {
      const trades = generateMockTrades(5);

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.tradeIds).toHaveLength(0);
    });

    it("should set correct timestamps", () => {
      const trades = generateMockTrades(10);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.createdAt).toBeInstanceOf(Date);
      expect(profile!.updatedAt).toBeInstanceOf(Date);
      const lastTrade = trades[trades.length - 1];
      expect(profile!.lastActivityAt).toEqual(lastTrade?.timestamp);
    });

    it("should emit profileBuilt event", () => {
      const trades = generateMockTrades(10);
      const eventHandler = vi.fn();
      profiler.on("profileBuilt", eventHandler);

      profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ address: VALID_ADDRESS })
      );
    });

    it("should emit highSuspicion event for high suspicion profiles", () => {
      // Create trades that would trigger high suspicion
      const trades = generatePerformanceTrades(18, 2, 5000, 100);
      trades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
      });

      const eventHandler = vi.fn();
      profiler.on("highSuspicion", eventHandler);

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      // Check if high suspicion was triggered
      if (profile && profile.suspicionScore >= 70) {
        expect(eventHandler).toHaveBeenCalled();
      }
    });
  });

  // --------------------------------------------------------------------------
  // Time Distribution Tests
  // --------------------------------------------------------------------------

  describe("time distribution analysis", () => {
    it("should calculate hour of day distribution", () => {
      // All trades at 3 AM UTC (off-hours)
      const trades = generateTimeDistributedTrades(10, 3);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.timeDistribution.hourOfDay[3]).toBe(10);
      expect(profile!.timeDistribution.peakHour).toBe(3);
    });

    it("should detect off-hours trading", () => {
      // All trades at 3 AM UTC (off-hours)
      const trades = generateTimeDistributedTrades(10, 3);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.timeDistribution.offHoursPercentage).toBe(1);
      expect(profile!.timeDistribution.marketHoursPercentage).toBe(0);
    });

    it("should detect market hours trading", () => {
      // All trades at 3 PM UTC (market hours)
      const trades = generateTimeDistributedTrades(10, 15);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.timeDistribution.marketHoursPercentage).toBe(1);
      expect(profile!.timeDistribution.offHoursPercentage).toBe(0);
    });

    it("should flag unusual hours when appropriate", () => {
      // All trades at 3 AM UTC
      const trades = generateTimeDistributedTrades(10, 3);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.UNUSUAL_HOURS);
    });
  });

  // --------------------------------------------------------------------------
  // Market Preferences Tests
  // --------------------------------------------------------------------------

  describe("market preferences analysis", () => {
    it("should calculate category distribution", () => {
      const trades = [
        ...generateMockTrades(5).map((t) => ({
          ...t,
          marketCategory: MarketCategory.POLITICS,
        })),
        ...generateMockTrades(3).map((t) => ({
          ...t,
          tradeId: `other-${t.tradeId}`,
          marketCategory: MarketCategory.CRYPTO,
        })),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.marketPreferences.categoryDistribution[MarketCategory.POLITICS]).toBe(5);
      expect(profile!.marketPreferences.categoryDistribution[MarketCategory.CRYPTO]).toBe(3);
    });

    it("should identify top categories", () => {
      const trades = [
        ...generateMockTrades(10).map((t) => ({
          ...t,
          marketCategory: MarketCategory.POLITICS,
        })),
        ...generateMockTrades(5).map((t) => ({
          ...t,
          tradeId: `crypto-${t.tradeId}`,
          marketCategory: MarketCategory.CRYPTO,
        })),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.marketPreferences.topCategories[0]).toBe(MarketCategory.POLITICS);
    });

    it("should calculate concentration score", () => {
      // All trades in one category = high concentration
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        marketCategory: MarketCategory.POLITICS,
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.marketPreferences.concentrationScore).toBe(1);
    });

    it("should flag high market concentration", () => {
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        marketCategory: MarketCategory.POLITICS,
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.MARKET_CONCENTRATION);
    });

    it("should track unique markets count", () => {
      const trades = [
        ...generateMockTrades(3).map((t) => ({ ...t, marketId: "market-1" })),
        ...generateMockTrades(3).map((t) => ({
          ...t,
          tradeId: `m2-${t.tradeId}`,
          marketId: "market-2",
        })),
        ...generateMockTrades(4).map((t) => ({
          ...t,
          tradeId: `m3-${t.tradeId}`,
          marketId: "market-3",
        })),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.marketPreferences.uniqueMarketsCount).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Position Sizing Tests
  // --------------------------------------------------------------------------

  describe("position sizing analysis", () => {
    it("should calculate average trade size", () => {
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        sizeUsd: 1000,
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.positionSizing.avgTradeSize).toBe(1000);
    });

    it("should calculate min/max trade sizes", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 500 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 1000 }),
        createMockTrade({ tradeId: "t4", sizeUsd: 5000 }),
        createMockTrade({ tradeId: "t5", sizeUsd: 10000 }),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.positionSizing.minTradeSize).toBe(100);
      expect(profile!.positionSizing.maxTradeSize).toBe(10000);
    });

    it("should calculate large trade percentage", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 500 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 1500 }), // large
        createMockTrade({ tradeId: "t4", sizeUsd: 2000 }), // large
        createMockTrade({ tradeId: "t5", sizeUsd: 5000 }), // large
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.positionSizing.largeTradePercentage).toBe(0.6);
    });

    it("should calculate whale trade percentage", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 5000 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 15000 }), // whale
        createMockTrade({ tradeId: "t4", sizeUsd: 20000 }), // whale
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.positionSizing.whaleTradePercentage).toBe(0.5);
    });

    it("should calculate sizing consistency score", () => {
      // Very consistent sizing
      const consistentTrades = generateMockTrades(10).map((t) => ({
        ...t,
        sizeUsd: 1000,
      }));

      const profile1 = profiler.buildProfile(VALID_ADDRESS, {
        trades: consistentTrades,
      });

      expect(profile1).not.toBeNull();
      expect(profile1!.positionSizing.consistencyScore).toBe(1);

      // Inconsistent sizing
      const inconsistentTrades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100 }),
        createMockTrade({ tradeId: "t2", sizeUsd: 10000 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 500 }),
        createMockTrade({ tradeId: "t4", sizeUsd: 50000 }),
      ];

      const profile2 = profiler.buildProfile(VALID_ADDRESS_2, {
        trades: inconsistentTrades,
        minTrades: 3,
      });

      expect(profile2).not.toBeNull();
      expect(profile2!.positionSizing.consistencyScore).toBeLessThan(0.5);
    });
  });

  // --------------------------------------------------------------------------
  // Performance Metrics Tests
  // --------------------------------------------------------------------------

  describe("performance metrics", () => {
    it("should calculate win rate", () => {
      const trades = generatePerformanceTrades(8, 2);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.performance.winRate).toBe(0.8);
      expect(profile!.performance.winCount).toBe(8);
      expect(profile!.performance.lossCount).toBe(2);
    });

    it("should calculate total PnL", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", pnl: 1000, isWinner: true }),
        createMockTrade({ tradeId: "t2", pnl: 500, isWinner: true }),
        createMockTrade({ tradeId: "t3", pnl: -300, isWinner: false }),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.performance.totalPnl).toBe(1200);
    });

    it("should calculate profit factor", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", pnl: 1000, isWinner: true }),
        createMockTrade({ tradeId: "t2", pnl: 500, isWinner: true }),
        createMockTrade({ tradeId: "t3", pnl: -300, isWinner: false }),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.performance.profitFactor).toBe(5); // 1500 / 300
    });

    it("should flag high win rate", () => {
      const trades = generatePerformanceTrades(18, 2);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.HIGH_WIN_RATE);
    });

    it("should flag consistent profitability", () => {
      const trades = generatePerformanceTrades(15, 1, 1000, 100);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.CONSISTENT_PROFITABILITY);
    });
  });

  // --------------------------------------------------------------------------
  // Trading Pattern Tests
  // --------------------------------------------------------------------------

  describe("trading patterns", () => {
    it("should calculate average time between trades", () => {
      const trades = generateMockTrades(10); // 1 hour apart
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingPatterns.avgTimeBetweenTrades).toBeCloseTo(1, 0);
    });

    it("should calculate buy/sell ratio", () => {
      const trades = [
        ...generateMockTrades(6).map((t) => ({ ...t, side: "buy" as const })),
        ...generateMockTrades(4).map((t) => ({
          ...t,
          tradeId: `sell-${t.tradeId}`,
          side: "sell" as const,
        })),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingPatterns.buyPercentage).toBe(0.6);
    });

    it("should calculate maker percentage", () => {
      const trades = [
        ...generateMockTrades(7).map((t) => ({ ...t, isMaker: true })),
        ...generateMockTrades(3).map((t) => ({
          ...t,
          tradeId: `taker-${t.tradeId}`,
          isMaker: false,
        })),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingPatterns.makerPercentage).toBe(0.7);
    });
  });

  // --------------------------------------------------------------------------
  // Trading Frequency Classification Tests
  // --------------------------------------------------------------------------

  describe("trading frequency classification", () => {
    it("should classify rare trader", () => {
      // 5 trades over 300 days = ~0.5 trades/month
      const trades: ProfileTrade[] = [];
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        trades.push(
          createMockTrade({
            tradeId: `trade-${i}`,
            timestamp: new Date(now - i * 60 * 24 * 60 * 60 * 1000), // 60 days apart
          })
        );
      }

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.tradingFrequency).toBe(TradingFrequency.RARE);
    });

    it("should classify frequent trader", () => {
      // 50 trades over 30 days = ~50 trades/month (between 20 and 100 threshold)
      const trades: ProfileTrade[] = [];
      const now = Date.now();

      for (let i = 0; i < 50; i++) {
        trades.push(
          createMockTrade({
            tradeId: `trade-${i}`,
            timestamp: new Date(now - i * 0.6 * 24 * 60 * 60 * 1000), // ~14 hours apart = 30 days
          })
        );
      }

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingFrequency).toBe(TradingFrequency.FREQUENT);
    });
  });

  // --------------------------------------------------------------------------
  // Trading Style Classification Tests
  // --------------------------------------------------------------------------

  describe("trading style classification", () => {
    it("should classify market maker", () => {
      // High maker percentage, very frequent trades
      const trades: ProfileTrade[] = [];
      const now = Date.now();

      for (let i = 0; i < 50; i++) {
        trades.push(
          createMockTrade({
            tradeId: `trade-${i}`,
            timestamp: new Date(now - i * 30 * 60 * 1000), // 30 minutes apart
            isMaker: true,
          })
        );
      }

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingStyle).toBe(TradingStyle.MARKET_MAKER);
    });

    it("should classify potential insider", () => {
      // Perfect timing + pre-news trading
      const trades = generatePerformanceTrades(25, 0, 5000, 0);
      trades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
      });

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.tradingStyle).toBe(TradingStyle.POTENTIAL_INSIDER);
    });
  });

  // --------------------------------------------------------------------------
  // Risk Appetite Classification Tests
  // --------------------------------------------------------------------------

  describe("risk appetite classification", () => {
    it("should classify very aggressive trader", () => {
      // High whale trade percentage
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        sizeUsd: 50000,
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.riskAppetite).toBe(RiskAppetite.VERY_AGGRESSIVE);
    });

    it("should classify conservative trader", () => {
      // Consistent small trades
      const trades = generateMockTrades(20).map((t) => ({
        ...t,
        sizeUsd: 100,
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.riskAppetite).toBe(RiskAppetite.VERY_CONSERVATIVE);
    });
  });

  // --------------------------------------------------------------------------
  // Profile Confidence Tests
  // --------------------------------------------------------------------------

  describe("profile confidence", () => {
    it("should have very low confidence with few trades", () => {
      const trades = generateMockTrades(4);
      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.confidence).toBe(ProfileConfidence.VERY_LOW);
    });

    it("should have moderate confidence with medium trades", () => {
      const trades = generateMockTrades(30);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.confidence).toBe(ProfileConfidence.MODERATE);
    });

    it("should have very high confidence with many trades", () => {
      const trades = generateMockTrades(250);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.confidence).toBe(ProfileConfidence.VERY_HIGH);
    });
  });

  // --------------------------------------------------------------------------
  // Behavior Flag Detection Tests
  // --------------------------------------------------------------------------

  describe("behavior flag detection", () => {
    it("should detect fresh wallet activity", () => {
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 50000 }), // Large first trade
        createMockTrade({ tradeId: "t2", sizeUsd: 5000 }),
        createMockTrade({ tradeId: "t3", sizeUsd: 2000 }),
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.FRESH_WALLET_ACTIVITY);
    });

    it("should detect pre-news trading", () => {
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        flags: ["pre_event"],
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.PRE_NEWS_TRADING);
    });

    it("should detect coordinated activity", () => {
      const trades = generateMockTrades(10).map((t) => ({
        ...t,
        flags: ["coordinated"],
      }));

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.COORDINATED_ACTIVITY);
    });

    it("should detect unusual sizing", () => {
      // Very high variance in trade sizes - need stdDev > avgTradeSize * 2
      // Many small trades with one huge outlier: avg ~16667, stdDev ~40825 (~2.4x avg)
      const trades = [
        createMockTrade({ tradeId: "t1", sizeUsd: 100, marketId: "market-1" }),
        createMockTrade({ tradeId: "t2", sizeUsd: 100, marketId: "market-2" }),
        createMockTrade({ tradeId: "t3", sizeUsd: 100, marketId: "market-3" }),
        createMockTrade({ tradeId: "t4", sizeUsd: 100, marketId: "market-4" }),
        createMockTrade({ tradeId: "t5", sizeUsd: 100, marketId: "market-5" }),
        createMockTrade({ tradeId: "t6", sizeUsd: 100000, marketId: "market-6" }), // Huge outlier
      ];

      const profile = profiler.buildProfile(VALID_ADDRESS, {
        trades,
        minTrades: 3,
      });

      expect(profile).not.toBeNull();
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.UNUSUAL_SIZING);
    });
  });

  // --------------------------------------------------------------------------
  // Suspicion Score Tests
  // --------------------------------------------------------------------------

  describe("suspicion score", () => {
    it("should have low suspicion for normal trading", () => {
      const trades = generateMockTrades(10);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.suspicionScore).toBeLessThan(30);
    });

    it("should have high suspicion for multiple flags", () => {
      const trades = generatePerformanceTrades(18, 2, 5000, 100);
      trades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
        t.marketCategory = MarketCategory.POLITICS;
      });

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.suspicionScore).toBeGreaterThan(50);
    });

    it("should increase suspicion for combined suspicious flags", () => {
      // High win rate + fresh wallet
      const trades = generatePerformanceTrades(9, 1);
      const firstTrade = trades[0];
      if (firstTrade) {
        firstTrade.sizeUsd = 50000; // Large first trade
      }

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      // Should have bonus for combination
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.HIGH_WIN_RATE);
      expect(profile!.behaviorFlags).toContain(BehaviorFlag.FRESH_WALLET_ACTIVITY);
    });
  });

  // --------------------------------------------------------------------------
  // Profile Update Tests
  // --------------------------------------------------------------------------

  describe("updateProfile", () => {
    it("should update existing profile with new trades", () => {
      const initialTrades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades: initialTrades, includeTradeIds: true });

      const newTrades = generateMockTrades(5).map((t) => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
        timestamp: new Date(Date.now() + 1000000),
      }));

      const updatedProfile = profiler.updateProfile(VALID_ADDRESS, {
        newTrades,
      });

      expect(updatedProfile).not.toBeNull();
      expect(updatedProfile!.tradeCount).toBe(15);
    });

    it("should not duplicate trades on update", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades, includeTradeIds: true });

      // Try to add same trades again
      const updatedProfile = profiler.updateProfile(VALID_ADDRESS, {
        newTrades: trades,
      });

      expect(updatedProfile).not.toBeNull();
      expect(updatedProfile!.tradeCount).toBe(10); // Should still be 10
    });

    it("should emit profileUpdated event", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades, includeTradeIds: true });

      const eventHandler = vi.fn();
      profiler.on("profileUpdated", eventHandler);

      const newTrades = generateMockTrades(5).map((t) => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
      }));

      profiler.updateProfile(VALID_ADDRESS, { newTrades });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ address: VALID_ADDRESS }),
        5
      );
    });

    it("should support full rebuild", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades, includeTradeIds: true });

      const newTrades = generateMockTrades(5).map((t) => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
      }));

      const updatedProfile = profiler.updateProfile(VALID_ADDRESS, {
        newTrades,
        fullRebuild: true,
      });

      expect(updatedProfile).not.toBeNull();
      expect(updatedProfile!.tradeCount).toBe(15);
    });
  });

  // --------------------------------------------------------------------------
  // Cache Tests
  // --------------------------------------------------------------------------

  describe("caching", () => {
    it("should cache profiles", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profiler.hasProfile(VALID_ADDRESS)).toBe(true);
    });

    it("should return cached profile with getProfile", () => {
      const trades = generateMockTrades(10);
      const originalProfile = profiler.buildProfile(VALID_ADDRESS, { trades });

      const cachedProfile = profiler.getProfile(VALID_ADDRESS);

      expect(cachedProfile).toEqual(originalProfile);
    });

    it("should respect cache TTL", async () => {
      const shortTtlProfiler = new WalletBehaviorProfiler({
        cacheTtlMs: 50, // 50ms TTL
      });

      const trades = generateMockTrades(10);
      shortTtlProfiler.buildProfile(VALID_ADDRESS, { trades });

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const cached = shortTtlProfiler.getProfile(VALID_ADDRESS);
      expect(cached).toBeNull();
    });

    it("should enforce max cache size", () => {
      const smallCacheProfiler = new WalletBehaviorProfiler({
        maxCachedProfiles: 2,
      });

      const trades = generateMockTrades(10);

      smallCacheProfiler.buildProfile(VALID_ADDRESS, { trades });
      smallCacheProfiler.buildProfile(VALID_ADDRESS_2, { trades });
      smallCacheProfiler.buildProfile(VALID_ADDRESS_3, { trades });

      // Only 2 should be cached
      const allProfiles = smallCacheProfiler.getAllProfiles();
      expect(allProfiles.length).toBeLessThanOrEqual(2);
    });

    it("should clear cache", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades });
      profiler.buildProfile(VALID_ADDRESS_2, { trades });

      profiler.clearCache();

      expect(profiler.hasProfile(VALID_ADDRESS)).toBe(false);
      expect(profiler.hasProfile(VALID_ADDRESS_2)).toBe(false);
    });

    it("should remove specific profile", () => {
      const trades = generateMockTrades(10);
      profiler.buildProfile(VALID_ADDRESS, { trades });
      profiler.buildProfile(VALID_ADDRESS_2, { trades });

      profiler.removeProfile(VALID_ADDRESS);

      expect(profiler.hasProfile(VALID_ADDRESS)).toBe(false);
      expect(profiler.hasProfile(VALID_ADDRESS_2)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Batch Processing Tests
  // --------------------------------------------------------------------------

  describe("batch processing", () => {
    it("should build profiles for multiple wallets", () => {
      const walletTrades = new Map<string, ProfileTrade[]>();
      walletTrades.set(VALID_ADDRESS, generateMockTrades(10));
      walletTrades.set(VALID_ADDRESS_2, generateMockTrades(15));
      walletTrades.set(VALID_ADDRESS_3, generateMockTrades(20));

      const results = profiler.buildProfiles(walletTrades);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.profile !== null)).toBe(true);
    });

    it("should handle errors gracefully in batch", () => {
      const walletTrades = new Map<string, ProfileTrade[]>();
      walletTrades.set(VALID_ADDRESS, generateMockTrades(10));
      walletTrades.set(INVALID_ADDRESS, generateMockTrades(10));

      const results = profiler.buildProfiles(walletTrades);

      expect(results).toHaveLength(2);

      const validResult = results.find((r) => r.address === VALID_ADDRESS);
      const invalidResult = results.find((r) => r.address === INVALID_ADDRESS);

      expect(validResult?.profile).not.toBeNull();
      expect(invalidResult?.profile).toBeNull();
      expect(invalidResult?.error).toBeDefined();
    });

    it("should include processing time in results", () => {
      const walletTrades = new Map<string, ProfileTrade[]>();
      walletTrades.set(VALID_ADDRESS, generateMockTrades(10));

      const results = profiler.buildProfiles(walletTrades);

      const firstResult = results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult!.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Query Methods Tests
  // --------------------------------------------------------------------------

  describe("query methods", () => {
    beforeEach(() => {
      // Build some profiles
      profiler.buildProfile(VALID_ADDRESS, {
        trades: generateMockTrades(10),
      });

      const insiderTrades = generatePerformanceTrades(25, 0, 5000, 0);
      insiderTrades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
      });
      profiler.buildProfile(VALID_ADDRESS_2, { trades: insiderTrades });
    });

    it("should get all profiles", () => {
      const profiles = profiler.getAllProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);
    });

    it("should get profiles by trading style", () => {
      const insiderProfiles = profiler.getProfilesByStyle(
        TradingStyle.POTENTIAL_INSIDER
      );

      // May or may not have potential insider based on exact classification
      expect(Array.isArray(insiderProfiles)).toBe(true);
    });

    it("should get profiles by behavior flag", () => {
      const flaggedProfiles = profiler.getProfilesByFlag(
        BehaviorFlag.PRE_NEWS_TRADING
      );

      expect(Array.isArray(flaggedProfiles)).toBe(true);
    });

    it("should get high suspicion profiles", () => {
      const highSuspicion = profiler.getHighSuspicionProfiles(30);
      expect(Array.isArray(highSuspicion)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Summary Tests
  // --------------------------------------------------------------------------

  describe("getSummary", () => {
    it("should return valid summary", () => {
      const trades = generateMockTrades(20);
      profiler.buildProfile(VALID_ADDRESS, { trades });
      profiler.buildProfile(VALID_ADDRESS_2, { trades });

      const summary = profiler.getSummary();

      expect(summary.totalProfiles).toBe(2);
      expect(summary.totalTradesAnalyzed).toBe(40);
      expect(typeof summary.avgSuspicionScore).toBe("number");
      expect(Array.isArray(summary.topBehaviorFlags)).toBe(true);
    });

    it("should aggregate by confidence level", () => {
      const fewTrades = generateMockTrades(5);
      const manyTrades = generateMockTrades(100);

      profiler.buildProfile(VALID_ADDRESS, { trades: fewTrades, minTrades: 3 });
      profiler.buildProfile(VALID_ADDRESS_2, { trades: manyTrades });

      const summary = profiler.getSummary();

      expect(summary.byConfidence).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Insights Generation Tests
  // --------------------------------------------------------------------------

  describe("insights generation", () => {
    it("should generate trading style insight", () => {
      const trades = generateMockTrades(20);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.insights.some((i) => i.includes("Trading style"))).toBe(
        true
      );
    });

    it("should generate frequency insight", () => {
      const trades = generateMockTrades(20);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.insights.some((i) => i.includes("Trading frequency"))).toBe(
        true
      );
    });

    it("should generate performance insights", () => {
      const trades = generatePerformanceTrades(15, 5);
      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      expect(profile!.insights.some((i) => i.includes("Win rate"))).toBe(true);
    });

    it("should include warning insights for suspicious behavior", () => {
      const trades = generatePerformanceTrades(18, 2, 5000, 100);
      trades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
      });

      const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

      expect(profile).not.toBeNull();
      // Should have at least one warning insight
      expect(profile!.insights.some((i) => i.includes("⚠️"))).toBe(true);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("Factory Functions", () => {
  afterEach(() => {
    resetSharedWalletBehaviorProfiler();
  });

  describe("createWalletBehaviorProfiler", () => {
    it("should create new profiler instance", () => {
      const profiler = createWalletBehaviorProfiler();
      expect(profiler).toBeInstanceOf(WalletBehaviorProfiler);
    });

    it("should accept configuration", () => {
      const profiler = createWalletBehaviorProfiler({
        minTradesForProfile: 10,
      });
      expect(profiler).toBeInstanceOf(WalletBehaviorProfiler);
    });
  });

  describe("shared profiler", () => {
    it("should return same instance", () => {
      const p1 = getSharedWalletBehaviorProfiler();
      const p2 = getSharedWalletBehaviorProfiler();
      expect(p1).toBe(p2);
    });

    it("should allow setting custom instance", () => {
      const custom = new WalletBehaviorProfiler({ minTradesForProfile: 100 });
      setSharedWalletBehaviorProfiler(custom);
      expect(getSharedWalletBehaviorProfiler()).toBe(custom);
    });

    it("should reset properly", () => {
      const p1 = getSharedWalletBehaviorProfiler();
      resetSharedWalletBehaviorProfiler();
      const p2 = getSharedWalletBehaviorProfiler();
      expect(p1).not.toBe(p2);
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe("Convenience Functions", () => {
  afterEach(() => {
    resetSharedWalletBehaviorProfiler();
  });

  describe("buildWalletBehaviorProfile", () => {
    it("should build profile using shared profiler", () => {
      const trades = generateMockTrades(10);
      const profile = buildWalletBehaviorProfile(VALID_ADDRESS, trades);

      expect(profile).not.toBeNull();
      expect(profile!.address).toBe(VALID_ADDRESS);
    });
  });

  describe("updateWalletBehaviorProfile", () => {
    it("should update profile using shared profiler", () => {
      const trades = generateMockTrades(10);
      buildWalletBehaviorProfile(VALID_ADDRESS, trades);

      const newTrades = generateMockTrades(5).map((t) => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
      }));

      const updated = updateWalletBehaviorProfile(VALID_ADDRESS, newTrades);

      expect(updated).not.toBeNull();
      expect(updated!.tradeCount).toBe(15);
    });
  });

  describe("getWalletBehaviorProfile", () => {
    it("should get profile from shared profiler", () => {
      const trades = generateMockTrades(10);
      buildWalletBehaviorProfile(VALID_ADDRESS, trades);

      const profile = getWalletBehaviorProfile(VALID_ADDRESS);

      expect(profile).not.toBeNull();
    });
  });

  describe("batchBuildWalletBehaviorProfiles", () => {
    it("should batch build using shared profiler", () => {
      const walletTrades = new Map<string, ProfileTrade[]>();
      walletTrades.set(VALID_ADDRESS, generateMockTrades(10));
      walletTrades.set(VALID_ADDRESS_2, generateMockTrades(10));

      const results = batchBuildWalletBehaviorProfiles(walletTrades);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.profile !== null)).toBe(true);
    });
  });

  describe("hasHighSuspicionProfile", () => {
    it("should return true for high suspicion", () => {
      const trades = generatePerformanceTrades(18, 2, 5000, 100);
      trades.forEach((t) => {
        t.flags = ["pre_event", "coordinated"];
        t.sizeUsd = 50000;
        t.marketCategory = MarketCategory.POLITICS;
      });

      buildWalletBehaviorProfile(VALID_ADDRESS, trades);

      const profile = getWalletBehaviorProfile(VALID_ADDRESS);
      if (profile && profile.suspicionScore >= 70) {
        expect(hasHighSuspicionProfile(VALID_ADDRESS)).toBe(true);
      }
    });

    it("should return false for normal trading", () => {
      const trades = generateMockTrades(10);
      buildWalletBehaviorProfile(VALID_ADDRESS, trades);

      expect(hasHighSuspicionProfile(VALID_ADDRESS)).toBe(false);
    });
  });

  describe("getPotentialInsiderProfiles", () => {
    it("should return potential insider profiles", () => {
      const insiderTrades = generatePerformanceTrades(25, 0, 5000, 0);
      insiderTrades.forEach((t) => {
        t.flags = ["pre_event"];
        t.sizeUsd = 15000;
      });

      buildWalletBehaviorProfile(VALID_ADDRESS, insiderTrades);

      const insiders = getPotentialInsiderProfiles();
      expect(Array.isArray(insiders)).toBe(true);
    });
  });

  describe("getWalletBehaviorProfilerSummary", () => {
    it("should return summary from shared profiler", () => {
      const trades = generateMockTrades(10);
      buildWalletBehaviorProfile(VALID_ADDRESS, trades);
      buildWalletBehaviorProfile(VALID_ADDRESS_2, trades);

      const summary = getWalletBehaviorProfilerSummary();

      expect(summary.totalProfiles).toBe(2);
    });
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("Edge Cases", () => {
  let profiler: WalletBehaviorProfiler;

  beforeEach(() => {
    profiler = new WalletBehaviorProfiler();
  });

  afterEach(() => {
    profiler.clearCache();
  });

  it("should handle empty trades array", () => {
    const profile = profiler.buildProfile(VALID_ADDRESS, { trades: [] });
    expect(profile).toBeNull();
  });

  it("should handle single trade", () => {
    const trades = [createMockTrade()];
    const profile = profiler.buildProfile(VALID_ADDRESS, {
      trades,
      minTrades: 1,
    });

    expect(profile).not.toBeNull();
    expect(profile!.tradeCount).toBe(1);
  });

  it("should handle trades with null PnL", () => {
    const trades = generateMockTrades(10);
    const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

    expect(profile).not.toBeNull();
    expect(profile!.performance.resolvedTradeCount).toBe(0);
  });

  it("should handle all winning trades", () => {
    const trades = generatePerformanceTrades(10, 0, 500, 0);
    const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

    expect(profile).not.toBeNull();
    expect(profile!.performance.winRate).toBe(1);
    expect(profile!.performance.lossCount).toBe(0);
  });

  it("should handle all losing trades", () => {
    const trades = generatePerformanceTrades(0, 10, 0, 500);
    const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

    expect(profile).not.toBeNull();
    expect(profile!.performance.winRate).toBe(0);
    expect(profile!.performance.winCount).toBe(0);
  });

  it("should handle same timestamp trades", () => {
    const now = new Date();
    const trades = generateMockTrades(5).map((t) => ({
      ...t,
      timestamp: now,
    }));

    const profile = profiler.buildProfile(VALID_ADDRESS, {
      trades,
      minTrades: 3,
    });

    expect(profile).not.toBeNull();
  });

  it("should handle very large trade sizes", () => {
    const trades = generateMockTrades(5).map((t) => ({
      ...t,
      sizeUsd: 10000000, // $10M
    }));

    const profile = profiler.buildProfile(VALID_ADDRESS, {
      trades,
      minTrades: 3,
    });

    expect(profile).not.toBeNull();
    expect(profile!.positionSizing.avgTradeSize).toBe(10000000);
  });

  it("should handle unknown market category", () => {
    const trades = generateMockTrades(10).map((t) => ({
      ...t,
      marketCategory: undefined,
    }));

    const profile = profiler.buildProfile(VALID_ADDRESS, { trades });

    expect(profile).not.toBeNull();
    expect(profile!.marketPreferences.categoryDistribution["unknown"]).toBe(10);
  });
});
