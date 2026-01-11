/**
 * Tests for Consecutive Large Trade Detector (DET-VOL-008)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BurstPatternType,
  BurstSeverity,
  BurstState,
  DEFAULT_BURST_THRESHOLDS,
  ConsecutiveLargeTradeDetector,
  createConsecutiveLargeTradeDetector,
  getSharedConsecutiveLargeTradeDetector,
  setSharedConsecutiveLargeTradeDetector,
  resetSharedConsecutiveLargeTradeDetector,
  processTradeForBurst,
  processTradesForBurst,
  isMarketInBurstState,
  isWalletInBurstState,
  getRecentBurstEvents,
  getBurstDetectorSummary,
  type SequenceTrade,
  type ConsecutiveLargeTradeDetectorConfig,
} from "../../src/detection/consecutive-large-trades";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Generate a trade with given parameters
 */
function createTrade(
  overrides: Partial<SequenceTrade> = {},
  timestamp?: number
): SequenceTrade {
  const now = timestamp ?? Date.now();
  return {
    tradeId: `trade_${now}_${Math.random().toString(36).substring(2, 7)}`,
    marketId: "market-1",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    sizeUsd: 5000,
    timestamp: now,
    side: "BUY",
    isLargeTrade: false,
    ...overrides,
  };
}

/**
 * Generate a sequence of trades with controlled timing
 */
function createTradeSequence(options: {
  marketId?: string;
  walletAddress?: string;
  count: number;
  sizeUsd?: number;
  intervalMs?: number;
  startTime?: number;
  isLargeTrade?: boolean;
}): SequenceTrade[] {
  const {
    marketId = "market-1",
    walletAddress = "0x1234567890abcdef1234567890abcdef12345678",
    count,
    sizeUsd = 15000,
    intervalMs = 30000, // 30 seconds between trades
    startTime = Date.now(),
    isLargeTrade = true,
  } = options;

  return Array.from({ length: count }, (_, i) =>
    createTrade({
      marketId,
      walletAddress,
      sizeUsd,
      isLargeTrade,
      timestamp: startTime + i * intervalMs,
    })
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("ConsecutiveLargeTradeDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedConsecutiveLargeTradeDetector();
  });

  afterEach(() => {
    resetSharedConsecutiveLargeTradeDetector();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const detector = new ConsecutiveLargeTradeDetector();

      const stats = detector.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.trackedWallets).toBe(0);
      expect(stats.marketsInBurst).toBe(0);
      expect(stats.walletsInBurst).toBe(0);
      expect(stats.totalBurstEvents).toBe(0);
      expect(stats.trackWalletBursts).toBe(true);
      expect(stats.trackMarketBursts).toBe(true);
      expect(stats.alertCooldownMs).toBe(60000);
    });

    it("should create with custom configuration", () => {
      const config: ConsecutiveLargeTradeDetectorConfig = {
        thresholds: {
          minConsecutiveTrades: 5,
          maxTradeGapMs: 10 * 60 * 1000, // 10 minutes
          largeTradeAbsoluteThreshold: 20000,
        },
        alertCooldownMs: 30000,
        trackWalletBursts: true,
        trackMarketBursts: false,
        enableEvents: false,
      };

      const detector = new ConsecutiveLargeTradeDetector(config);

      const thresholds = detector.getThresholds();
      expect(thresholds.minConsecutiveTrades).toBe(5);
      expect(thresholds.maxTradeGapMs).toBe(10 * 60 * 1000);
      expect(thresholds.largeTradeAbsoluteThreshold).toBe(20000);

      const stats = detector.getStats();
      expect(stats.alertCooldownMs).toBe(30000);
      expect(stats.trackMarketBursts).toBe(false);
    });

    it("should use default thresholds when not specified", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const thresholds = detector.getThresholds();

      expect(thresholds.minConsecutiveTrades).toBe(DEFAULT_BURST_THRESHOLDS.minConsecutiveTrades);
      expect(thresholds.maxTradeGapMs).toBe(DEFAULT_BURST_THRESHOLDS.maxTradeGapMs);
      expect(thresholds.largeTradeZScoreThreshold).toBe(DEFAULT_BURST_THRESHOLDS.largeTradeZScoreThreshold);
      expect(thresholds.largeTradePercentileThreshold).toBe(DEFAULT_BURST_THRESHOLDS.largeTradePercentileThreshold);
      expect(thresholds.largeTradeAbsoluteThreshold).toBe(DEFAULT_BURST_THRESHOLDS.largeTradeAbsoluteThreshold);
    });
  });

  // ==========================================================================
  // Default Constants Tests
  // ==========================================================================

  describe("default constants", () => {
    it("should have correct default burst thresholds", () => {
      expect(DEFAULT_BURST_THRESHOLDS.minConsecutiveTrades).toBe(3);
      expect(DEFAULT_BURST_THRESHOLDS.maxTradeGapMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(DEFAULT_BURST_THRESHOLDS.largeTradeZScoreThreshold).toBe(2.0);
      expect(DEFAULT_BURST_THRESHOLDS.largeTradePercentileThreshold).toBe(75);
      expect(DEFAULT_BURST_THRESHOLDS.largeTradeAbsoluteThreshold).toBe(10000);
      expect(DEFAULT_BURST_THRESHOLDS.lowIntensityThreshold).toBe(0.5);
      expect(DEFAULT_BURST_THRESHOLDS.mediumIntensityThreshold).toBe(1.0);
      expect(DEFAULT_BURST_THRESHOLDS.highIntensityThreshold).toBe(2.0);
      expect(DEFAULT_BURST_THRESHOLDS.criticalIntensityThreshold).toBe(5.0);
      expect(DEFAULT_BURST_THRESHOLDS.volumeSeverityMultiplier).toBe(3.0);
    });
  });

  // ==========================================================================
  // Trade Processing Tests
  // ==========================================================================

  describe("processTrade", () => {
    it("should not detect burst for small trades", () => {
      const detector = new ConsecutiveLargeTradeDetector();

      const trade = createTrade({ sizeUsd: 100, isLargeTrade: false });
      const result = detector.processTrade(trade);

      expect(result.isBurst).toBe(false);
      expect(result.state).toBe(BurstState.INACTIVE);
      expect(result.patternType).toBeNull();
      expect(result.severity).toBeNull();
      expect(result.consecutiveCount).toBe(0);
    });

    it("should not detect burst for single large trade", () => {
      const detector = new ConsecutiveLargeTradeDetector();

      const trade = createTrade({ sizeUsd: 15000, isLargeTrade: true });
      const result = detector.processTrade(trade);

      expect(result.isBurst).toBe(false);
      expect(result.consecutiveCount).toBe(1);
    });

    it("should not detect burst for two consecutive large trades", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trade1 = createTrade({
        sizeUsd: 15000,
        isLargeTrade: true,
        timestamp: baseTime,
      });
      const trade2 = createTrade({
        sizeUsd: 20000,
        isLargeTrade: true,
        timestamp: baseTime + 30000,
      });

      detector.processTrade(trade1);
      const result = detector.processTrade(trade2);

      expect(result.isBurst).toBe(false);
      expect(result.consecutiveCount).toBe(2);
    });

    it("should detect burst after three consecutive large trades", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 15000,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      detector.processTrade(trades[0]!);
      detector.processTrade(trades[1]!);
      const result = detector.processTrade(trades[2]!);

      expect(result.isBurst).toBe(true);
      expect(result.state).toBe(BurstState.ACTIVE);
      expect(result.consecutiveCount).toBe(3);
      expect(result.severity).toBeDefined();
      expect(result.patternType).toBeDefined();
    });

    it("should identify trade as large based on absolute threshold", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Trades above the 10000 USD default threshold
      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 12000,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: false, // Not pre-flagged, should be detected by threshold
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
    });

    it("should identify trade as large based on z-score", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Trades with z-score above threshold
      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 5000, // Below absolute threshold
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: false,
      });

      // Set z-score to trigger large trade detection
      for (const trade of trades) {
        detector.processTrade(trade, { zScore: 2.5 });
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
    });

    it("should identify trade as large based on percentile", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Trades with percentile above threshold
      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 5000, // Below absolute threshold
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: false,
      });

      // Set percentile to trigger large trade detection
      for (const trade of trades) {
        detector.processTrade(trade, { percentileRank: 80 });
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
    });

    it("should respect forceLargeTrade option", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Small trades that are forced to be treated as large
      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 100,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: false,
      });

      for (const trade of trades) {
        detector.processTrade(trade, { forceLargeTrade: true });
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
    });

    it("should reset burst when trade gap exceeds threshold", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // First sequence of trades
      const trades1 = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades1) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);

      // Large gap (more than 5 minutes from last trade)
      // Last trade was at baseTime + 60000 (60 seconds), gap threshold is 5 minutes (300000ms)
      // To exceed the gap, we need timestamp > (baseTime + 60000) + 300000 = baseTime + 360000
      const tradeAfterGap = createTrade({
        sizeUsd: 15000,
        isLargeTrade: true,
        timestamp: baseTime + 60000 + 300001, // Just over 5 minutes from last trade
      });

      const result = detector.processTrade(tradeAfterGap);

      // Burst should have ended and a new one started
      expect(result.consecutiveCount).toBe(1);
    });

    it("should track burst volume correctly", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = [
        createTrade({ sizeUsd: 10000, isLargeTrade: true, timestamp: baseTime }),
        createTrade({ sizeUsd: 20000, isLargeTrade: true, timestamp: baseTime + 30000 }),
        createTrade({ sizeUsd: 30000, isLargeTrade: true, timestamp: baseTime + 60000 }),
      ];

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const result = detector.processTrade(
        createTrade({ sizeUsd: 15000, isLargeTrade: true, timestamp: baseTime + 90000 })
      );

      expect(result.burstVolumeUsd).toBe(75000);
      expect(result.consecutiveCount).toBe(4);
      expect(result.averageTradeSize).toBe(18750);
    });

    it("should calculate burst intensity correctly", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // 5 trades in 1 minute = 5 trades per minute
      const trades = createTradeSequence({
        count: 5,
        intervalMs: 12000, // 12 seconds between trades
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // Duration: ~48 seconds (4 * 12000ms)
      // 5 trades in 48 seconds = 6.25 trades per minute
      expect(result!.burstIntensity).toBeGreaterThan(5);
    });
  });

  // ==========================================================================
  // Burst Pattern Type Tests
  // ==========================================================================

  describe("burst pattern types", () => {
    it("should identify WALLET_BURST for single wallet", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        walletAddress: "0x1111",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // Should be WALLET_BURST for single wallet
      expect(result!.patternType).toBe(BurstPatternType.WALLET_BURST);
    });

    it("should identify MARKET_BURST for multiple wallets on same market", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Different wallets trading on same market
      const trades = [
        createTrade({
          walletAddress: "0x1111",
          marketId: "market-1",
          sizeUsd: 15000,
          isLargeTrade: true,
          timestamp: baseTime,
        }),
        createTrade({
          walletAddress: "0x2222",
          marketId: "market-1",
          sizeUsd: 15000,
          isLargeTrade: true,
          timestamp: baseTime + 30000,
        }),
        createTrade({
          walletAddress: "0x3333",
          marketId: "market-1",
          sizeUsd: 15000,
          isLargeTrade: true,
          timestamp: baseTime + 60000,
        }),
      ];

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      expect(result!.patternType).toBe(BurstPatternType.MARKET_BURST);
    });

    it("should identify COMBINED_BURST when both market and wallet burst", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // To get COMBINED_BURST we need:
      // 1. Multiple wallets on the same market (creates market burst with walletCount > 1)
      // 2. One wallet on multiple markets (creates wallet burst with marketCount > 1)

      // First, wallet 0x1111 trades on market-1 and market-2 (wallet burst across markets)
      // Plus wallet 0x2222 also trades on market-1 (market burst with multiple wallets)
      const trades = [
        createTrade({ walletAddress: "0x1111", marketId: "market-1", isLargeTrade: true, timestamp: baseTime }),
        createTrade({ walletAddress: "0x1111", marketId: "market-2", isLargeTrade: true, timestamp: baseTime + 30000 }),
        createTrade({ walletAddress: "0x2222", marketId: "market-1", isLargeTrade: true, timestamp: baseTime + 60000 }),
        createTrade({ walletAddress: "0x1111", marketId: "market-1", isLargeTrade: true, timestamp: baseTime + 90000 }),
      ];

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // The last trade is from 0x1111 on market-1
      // market-1 now has 2 wallets (0x1111, 0x2222)
      // 0x1111 is on 2 markets (market-1, market-2)
      // This should be COMBINED_BURST
      expect(result!.patternType).toBe(BurstPatternType.COMBINED_BURST);
    });
  });

  // ==========================================================================
  // Severity Tests
  // ==========================================================================

  describe("burst severity", () => {
    it("should assign LOW severity for minimal burst", () => {
      // Configure with lower volume threshold to isolate intensity-based severity
      const detector = new ConsecutiveLargeTradeDetector({
        thresholds: {
          largeTradeAbsoluteThreshold: 100, // Lower threshold
          volumeSeverityMultiplier: 10, // High multiplier to avoid volume-based escalation
        },
      });
      const baseTime = Date.now();

      // 3 trades over 4 minutes = 0.75 trades/min (above 0.5 low threshold but below 1.0 medium)
      // Use small trade sizes to avoid volume-based severity escalation
      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 150, // Small size, just above the 100 threshold
        intervalMs: 120000, // 2 minutes between trades
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      expect(result!.severity).toBe(BurstSeverity.LOW);
    });

    it("should assign MEDIUM severity for moderate intensity", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // 5 trades in ~2 minutes = ~2.5 trades/min
      const trades = createTradeSequence({
        count: 5,
        intervalMs: 30000, // 30 seconds between trades
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // Should be at least MEDIUM due to count >= 5
      expect([BurstSeverity.MEDIUM, BurstSeverity.HIGH, BurstSeverity.CRITICAL]).toContain(result!.severity);
    });

    it("should assign HIGH severity for high intensity", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // 7 trades in ~1 minute = high intensity
      const trades = createTradeSequence({
        count: 7,
        intervalMs: 10000, // 10 seconds between trades
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // Should be HIGH due to count >= 7
      expect([BurstSeverity.HIGH, BurstSeverity.CRITICAL]).toContain(result!.severity);
    });

    it("should assign CRITICAL severity for extreme burst", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // 10 trades very quickly
      const trades = createTradeSequence({
        count: 10,
        intervalMs: 5000, // 5 seconds between trades
        startTime: baseTime,
        isLargeTrade: true,
      });

      let result;
      for (const trade of trades) {
        result = detector.processTrade(trade);
      }

      // Should be CRITICAL due to count >= 10
      expect(result!.severity).toBe(BurstSeverity.CRITICAL);
    });
  });

  // ==========================================================================
  // Burst Events Tests
  // ==========================================================================

  describe("burst events", () => {
    it("should emit burstDetected event when burst threshold reached", () => {
      const detector = new ConsecutiveLargeTradeDetector({ enableEvents: true });
      const eventHandler = vi.fn();
      detector.on("burstDetected", eventHandler);

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const eventArg = eventHandler.mock.calls[0]?.[0];
      expect(eventArg).toHaveProperty("eventId");
      expect(eventArg).toHaveProperty("marketId", "market-1");
      expect(eventArg).toHaveProperty("consecutiveCount", 3);
    });

    it("should emit criticalBurst event for critical severity", () => {
      const detector = new ConsecutiveLargeTradeDetector({ enableEvents: true });
      const criticalHandler = vi.fn();
      detector.on("criticalBurst", criticalHandler);

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 10,
        intervalMs: 5000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      // criticalBurst should be emitted when severity is CRITICAL
      expect(criticalHandler).toHaveBeenCalled();
    });

    it("should emit burstEnded event when burst ends", () => {
      const detector = new ConsecutiveLargeTradeDetector({ enableEvents: true });
      const endedHandler = vi.fn();
      detector.on("burstEnded", endedHandler);

      const baseTime = Date.now();

      // Create a burst
      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      // End the burst with a large gap
      const smallTrade = createTrade({
        sizeUsd: 100,
        isLargeTrade: false,
        timestamp: baseTime + 7 * 60 * 1000, // 7 minutes later
      });

      detector.processTrade(smallTrade);

      expect(endedHandler).toHaveBeenCalled();
    });

    it("should respect alert cooldown", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        alertCooldownMs: 60000,
        enableEvents: true,
      });
      const eventHandler = vi.fn();
      detector.on("burstDetected", eventHandler);

      const baseTime = Date.now();

      // First burst
      const trades1 = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades1) {
        detector.processTrade(trade);
      }

      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Second burst within cooldown - should not emit new event
      const trades2 = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime + 90000, // Still within 60s cooldown
        isLargeTrade: true,
      });

      for (const trade of trades2) {
        detector.processTrade(trade);
      }

      // Still just 1 call because of cooldown
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it("should bypass cooldown when option set", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        alertCooldownMs: 60000,
        enableEvents: true,
      });
      const eventHandler = vi.fn();
      detector.on("burstDetected", eventHandler);

      const baseTime = Date.now();

      // First burst - 3 trades, last one at baseTime + 60000
      const trades1 = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades1) {
        detector.processTrade(trade, { bypassCooldown: true });
      }

      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Second burst - need to exceed gap threshold (5 min = 300000ms) to start a new burst
      // Last trade was at baseTime + 60000, so start after baseTime + 60000 + 300001
      const trades2 = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime + 60000 + 300001, // Just over 5 minutes from last trade
        isLargeTrade: true,
      });

      for (const trade of trades2) {
        detector.processTrade(trade, { bypassCooldown: true });
      }

      // Should have 2 events with bypass (first burst + second burst after gap)
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });

    it("should return burst event in result", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      detector.processTrade(trades[0]!);
      detector.processTrade(trades[1]!);
      const result = detector.processTrade(trades[2]!);

      expect(result.burstEvent).not.toBeNull();
      expect(result.burstEvent?.eventId).toBeDefined();
      expect(result.burstEvent?.consecutiveCount).toBe(3);
    });
  });

  // ==========================================================================
  // Batch Processing Tests
  // ==========================================================================

  describe("processTrades", () => {
    it("should process multiple trades in batch", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 5,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      const result = detector.processTrades(trades);

      expect(result.results.size).toBe(5);
      expect(result.summary.totalProcessed).toBe(5);
      expect(result.summary.totalInBursts).toBeGreaterThan(0);
      expect(result.burstEvents.length).toBeGreaterThan(0);
    });

    it("should sort trades by timestamp before processing", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Create trades in random order
      const trades = [
        createTrade({ isLargeTrade: true, timestamp: baseTime + 60000 }),
        createTrade({ isLargeTrade: true, timestamp: baseTime }),
        createTrade({ isLargeTrade: true, timestamp: baseTime + 30000 }),
      ];

      const result = detector.processTrades(trades);

      // Should be processed correctly regardless of order
      expect(result.summary.totalProcessed).toBe(3);
      expect(result.summary.totalInBursts).toBe(1); // Third trade triggers burst
    });

    it("should track processing time", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 10,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      const result = detector.processTrades(trades);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // State Query Tests
  // ==========================================================================

  describe("state queries", () => {
    it("should check market burst state", () => {
      const detector = new ConsecutiveLargeTradeDetector();

      expect(detector.isMarketInBurst("market-1")).toBe(false);

      const baseTime = Date.now();
      const trades = createTradeSequence({
        marketId: "market-1",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
      expect(detector.isMarketInBurst("market-2")).toBe(false);
    });

    it("should check wallet burst state", () => {
      const detector = new ConsecutiveLargeTradeDetector();

      expect(detector.isWalletInBurst("0x1111")).toBe(false);

      const baseTime = Date.now();
      const trades = createTradeSequence({
        walletAddress: "0x1111",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isWalletInBurst("0x1111")).toBe(true);
      expect(detector.isWalletInBurst("0x2222")).toBe(false);
    });

    it("should get detailed market burst state", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        marketId: "market-1",
        count: 5,
        sizeUsd: 15000,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const state = detector.getMarketBurstState("market-1");

      expect(state).not.toBeNull();
      expect(state!.inBurst).toBe(true);
      expect(state!.consecutiveCount).toBe(5);
      expect(state!.burstVolumeUsd).toBe(75000);
      expect(state!.walletCount).toBe(1);
    });

    it("should get detailed wallet burst state", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Trades on different markets
      const trades = [
        createTrade({ walletAddress: "0x1111", marketId: "market-1", isLargeTrade: true, timestamp: baseTime }),
        createTrade({ walletAddress: "0x1111", marketId: "market-2", isLargeTrade: true, timestamp: baseTime + 30000 }),
        createTrade({ walletAddress: "0x1111", marketId: "market-3", isLargeTrade: true, timestamp: baseTime + 60000 }),
      ];

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const state = detector.getWalletBurstState("0x1111");

      expect(state).not.toBeNull();
      expect(state!.inBurst).toBe(true);
      expect(state!.marketCount).toBe(3);
    });

    it("should handle case-insensitive wallet addresses", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        walletAddress: "0xABCDEF",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isWalletInBurst("0xabcdef")).toBe(true);
      expect(detector.isWalletInBurst("0xABCDEF")).toBe(true);
      expect(detector.isWalletInBurst("0xAbCdEf")).toBe(true);
    });
  });

  // ==========================================================================
  // Recent Events Tests
  // ==========================================================================

  describe("recent events", () => {
    it("should track recent burst events", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const events = detector.getRecentBurstEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("eventId");
      expect(events[0]).toHaveProperty("consecutiveCount");
    });

    it("should get market-specific burst events", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Bursts on different markets
      const trades1 = createTradeSequence({
        marketId: "market-1",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      const trades2 = createTradeSequence({
        marketId: "market-2",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime + 200000,
        isLargeTrade: true,
      });

      for (const trade of [...trades1, ...trades2]) {
        detector.processTrade(trade);
      }

      const market1Events = detector.getMarketBurstEvents("market-1");
      expect(market1Events.every((e) => e.marketId === "market-1")).toBe(true);
    });

    it("should get wallet-specific burst events", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        walletAddress: "0x1111",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const walletEvents = detector.getWalletBurstEvents("0x1111");
      expect(walletEvents.length).toBeGreaterThan(0);
      expect(walletEvents[0]?.walletAddresses).toContain("0x1111");
    });

    it("should limit recent events storage", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        maxRecentBurstEvents: 5,
        alertCooldownMs: 0, // No cooldown for this test
      });

      const baseTime = Date.now();

      // Create many bursts
      for (let i = 0; i < 10; i++) {
        const trades = createTradeSequence({
          marketId: `market-${i}`,
          count: 3,
          intervalMs: 30000,
          startTime: baseTime + i * 200000,
          isLargeTrade: true,
        });

        for (const trade of trades) {
          detector.processTrade(trade, { bypassCooldown: true });
        }
      }

      const events = detector.getRecentBurstEvents(100);
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return comprehensive summary", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      // Create multiple bursts
      const trades1 = createTradeSequence({
        marketId: "market-1",
        walletAddress: "0x1111",
        count: 5,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades1) {
        detector.processTrade(trade);
      }

      const summary = detector.getSummary();

      expect(summary.totalMarkets).toBeGreaterThan(0);
      expect(summary.totalWallets).toBeGreaterThan(0);
      expect(summary.marketsInBurst).toBeGreaterThan(0);
      expect(summary.totalBurstEvents).toBeGreaterThan(0);
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byPatternType).toBeDefined();
      expect(summary.recentBurstEvents.length).toBeGreaterThan(0);
    });

    it("should track top burst markets", () => {
      const detector = new ConsecutiveLargeTradeDetector({ alertCooldownMs: 0 });
      const baseTime = Date.now();

      // Multiple bursts on market-1
      for (let i = 0; i < 3; i++) {
        const trades = createTradeSequence({
          marketId: "market-1",
          count: 3,
          intervalMs: 30000,
          startTime: baseTime + i * 300000,
          isLargeTrade: true,
        });

        for (const trade of trades) {
          detector.processTrade(trade, { bypassCooldown: true });
        }
      }

      const summary = detector.getSummary();

      expect(summary.topBurstMarkets.length).toBeGreaterThan(0);
      expect(summary.topBurstMarkets[0]?.marketId).toBe("market-1");
    });

    it("should track top burst wallets", () => {
      const detector = new ConsecutiveLargeTradeDetector({ alertCooldownMs: 0 });
      const baseTime = Date.now();

      // Multiple bursts from wallet 0x1111
      for (let i = 0; i < 3; i++) {
        const trades = createTradeSequence({
          walletAddress: "0x1111",
          marketId: `market-${i}`,
          count: 3,
          intervalMs: 30000,
          startTime: baseTime + i * 300000,
          isLargeTrade: true,
        });

        for (const trade of trades) {
          detector.processTrade(trade, { bypassCooldown: true });
        }
      }

      const summary = detector.getSummary();

      expect(summary.topBurstWallets.length).toBeGreaterThan(0);
      expect(summary.topBurstWallets[0]?.walletAddress.toLowerCase()).toBe("0x1111");
    });
  });

  // ==========================================================================
  // Clear Tests
  // ==========================================================================

  describe("clear operations", () => {
    it("should clear market state", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        marketId: "market-1",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);

      detector.clearMarket("market-1");

      expect(detector.isMarketInBurst("market-1")).toBe(false);
    });

    it("should clear wallet state", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        walletAddress: "0x1111",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isWalletInBurst("0x1111")).toBe(true);

      detector.clearWallet("0x1111");

      expect(detector.isWalletInBurst("0x1111")).toBe(false);
    });

    it("should clear all state", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 5,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const statsBefore = detector.getStats();
      expect(statsBefore.trackedMarkets).toBeGreaterThan(0);

      detector.clearAll();

      const statsAfter = detector.getStats();
      expect(statsAfter.trackedMarkets).toBe(0);
      expect(statsAfter.trackedWallets).toBe(0);
      expect(statsAfter.totalBurstEvents).toBe(0);
      expect(detector.getRecentBurstEvents().length).toBe(0);
    });
  });

  // ==========================================================================
  // Singleton Management Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should create detector with factory function", () => {
      const detector = createConsecutiveLargeTradeDetector();
      expect(detector).toBeInstanceOf(ConsecutiveLargeTradeDetector);
    });

    it("should get shared instance", () => {
      const shared1 = getSharedConsecutiveLargeTradeDetector();
      const shared2 = getSharedConsecutiveLargeTradeDetector();
      expect(shared1).toBe(shared2);
    });

    it("should set custom shared instance", () => {
      const custom = new ConsecutiveLargeTradeDetector({
        thresholds: { minConsecutiveTrades: 5 },
      });

      setSharedConsecutiveLargeTradeDetector(custom);

      const shared = getSharedConsecutiveLargeTradeDetector();
      expect(shared.getThresholds().minConsecutiveTrades).toBe(5);
    });

    it("should reset shared instance", () => {
      const shared1 = getSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        shared1.processTrade(trade);
      }

      expect(shared1.getStats().trackedMarkets).toBeGreaterThan(0);

      resetSharedConsecutiveLargeTradeDetector();

      const shared2 = getSharedConsecutiveLargeTradeDetector();
      expect(shared2).not.toBe(shared1);
      expect(shared2.getStats().trackedMarkets).toBe(0);
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe("convenience functions", () => {
    it("should process trade for burst with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      processTradeForBurst(trades[0]!);
      processTradeForBurst(trades[1]!);
      const result = processTradeForBurst(trades[2]!);

      expect(result.isBurst).toBe(true);
    });

    it("should batch process trades with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 5,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      const result = processTradesForBurst(trades);

      expect(result.summary.totalProcessed).toBe(5);
      expect(result.summary.totalInBursts).toBeGreaterThan(0);
    });

    it("should check market burst state with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        marketId: "market-1",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        processTradeForBurst(trade);
      }

      expect(isMarketInBurstState("market-1")).toBe(true);
      expect(isMarketInBurstState("market-2")).toBe(false);
    });

    it("should check wallet burst state with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        walletAddress: "0x1111",
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        processTradeForBurst(trade);
      }

      expect(isWalletInBurstState("0x1111")).toBe(true);
      expect(isWalletInBurstState("0x2222")).toBe(false);
    });

    it("should get recent burst events with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        processTradeForBurst(trade);
      }

      const events = getRecentBurstEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    it("should get summary with convenience function", () => {
      resetSharedConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        processTradeForBurst(trade);
      }

      const summary = getBurstDetectorSummary();
      expect(summary.totalBurstEvents).toBeGreaterThan(0);
    });

    it("should allow custom detector in convenience functions", () => {
      const customDetector = new ConsecutiveLargeTradeDetector({
        thresholds: { minConsecutiveTrades: 2 },
      });

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 2,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      processTradeForBurst(trades[0]!, { detector: customDetector });
      const result = processTradeForBurst(trades[1]!, { detector: customDetector });

      // With minConsecutiveTrades: 2, should be a burst after 2 trades
      expect(result.isBurst).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty trades array", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const result = detector.processTrades([]);

      expect(result.results.size).toBe(0);
      expect(result.summary.totalProcessed).toBe(0);
    });

    it("should handle single trade", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const trade = createTrade({ isLargeTrade: true });

      const result = detector.processTrade(trade);

      expect(result.isBurst).toBe(false);
      expect(result.consecutiveCount).toBe(1);
    });

    it("should handle trades with same timestamp", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const timestamp = Date.now();

      const trades = [
        createTrade({ tradeId: "trade-1", isLargeTrade: true, timestamp }),
        createTrade({ tradeId: "trade-2", isLargeTrade: true, timestamp }),
        createTrade({ tradeId: "trade-3", isLargeTrade: true, timestamp }),
      ];

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
    });

    it("should handle very large trade volumes", () => {
      const detector = new ConsecutiveLargeTradeDetector();
      const baseTime = Date.now();

      const trades = createTradeSequence({
        count: 3,
        sizeUsd: 10000000, // $10M trades
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      const state = detector.getMarketBurstState("market-1");
      expect(state?.burstVolumeUsd).toBe(30000000);
    });

    it("should handle rapid bursts on same market", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        alertCooldownMs: 0,
      });
      const baseTime = Date.now();

      // Multiple separate bursts - each burst needs to be separated by more than 5 minutes (300000ms)
      // to be detected as a new burst
      for (let burst = 0; burst < 3; burst++) {
        const trades = createTradeSequence({
          marketId: "market-1",
          count: 3,
          intervalMs: 1000, // Trades within each burst are 1 second apart
          startTime: baseTime + burst * 400000, // 6min 40s between burst starts, enough gap
          isLargeTrade: true,
        });

        for (const trade of trades) {
          detector.processTrade(trade, { bypassCooldown: true });
        }
      }

      const summary = detector.getSummary();
      expect(summary.totalBurstEvents).toBeGreaterThanOrEqual(3);
    });

    it("should disable tracking by configuration", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        trackWalletBursts: false,
        trackMarketBursts: false,
      });

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      // With both tracking disabled, no bursts should be detected
      const stats = detector.getStats();
      expect(stats.marketsInBurst).toBe(0);
      expect(stats.walletsInBurst).toBe(0);
    });

    it("should track only market bursts when wallet tracking disabled", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        trackWalletBursts: false,
        trackMarketBursts: true,
      });

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(true);
      expect(detector.isWalletInBurst(trades[0]!.walletAddress)).toBe(false);
    });

    it("should track only wallet bursts when market tracking disabled", () => {
      const detector = new ConsecutiveLargeTradeDetector({
        trackWalletBursts: true,
        trackMarketBursts: false,
      });

      const baseTime = Date.now();
      const trades = createTradeSequence({
        count: 3,
        intervalMs: 30000,
        startTime: baseTime,
        isLargeTrade: true,
      });

      for (const trade of trades) {
        detector.processTrade(trade);
      }

      expect(detector.isMarketInBurst("market-1")).toBe(false);
      expect(detector.isWalletInBurst(trades[0]!.walletAddress)).toBe(true);
    });
  });
});
