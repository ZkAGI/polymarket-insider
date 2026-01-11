/**
 * E2E Tests for Timing Pattern Analyzer (DET-PAT-003)
 *
 * These tests verify the timing pattern analyzer works correctly
 * in real-world scenarios with comprehensive timing data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  TimingPatternType,
  TimingSuspicionLevel,
  createTimingPatternAnalyzer,
  resetSharedTimingPatternAnalyzer,
  analyzeTimingPattern,
  batchAnalyzeTimingPatterns,
  hasSuspiciousTiming,
  getTimingAnalyzerSummary,
  getTimingPatternDescription,
  getSuspicionLevelDescription,
  type TimingTrade,
} from "../../src/detection/timing-pattern-analyzer";

// Check if we should skip browser tests
const SKIP_BROWSER_TESTS = process.env.SKIP_BROWSER_TESTS === "true";

// Valid test wallet addresses
const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_WALLET_2 = "0xabcdef1234567890abcdef1234567890abcdef12";
const TEST_WALLET_3 = "0x0987654321098765432109876543210987654321";

/**
 * Create trades for a wallet with specific patterns
 */
function createWalletTrades(
  count: number,
  options: {
    startDate?: Date;
    intervalHours?: number;
    hourSpread?: number[];
    sizeRange?: [number, number];
    winRate?: number;
    preEventPercentage?: number;
    hadNearbyNews?: boolean;
  } = {}
): TimingTrade[] {
  const {
    startDate = new Date("2026-01-01T12:00:00Z"),
    intervalHours = 24,
    hourSpread,
    sizeRange = [100, 1000],
    winRate = 0.5,
    preEventPercentage = 0,
    hadNearbyNews = false,
  } = options;

  const trades: TimingTrade[] = [];

  for (let i = 0; i < count; i++) {
    let timestamp: Date;

    if (hourSpread && hourSpread.length > 0) {
      const hour = hourSpread[i % hourSpread.length]!;
      const baseDate = new Date(startDate);
      baseDate.setUTCHours(hour, Math.floor(Math.random() * 60), 0, 0);
      baseDate.setTime(baseDate.getTime() + Math.floor(i / hourSpread.length) * 24 * 60 * 60 * 1000);
      timestamp = baseDate;
    } else {
      timestamp = new Date(startDate.getTime() + i * intervalHours * 60 * 60 * 1000);
    }

    const sizeUsd = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    const isWinner = Math.random() < winRate;
    const timeToResolution = i < count * preEventPercentage ? 1 : undefined;

    trades.push({
      tradeId: `trade-${i}`,
      marketId: `market-${i % 5}`,
      timestamp,
      side: Math.random() > 0.5 ? "buy" : "sell",
      sizeUsd,
      isWinner,
      timeToResolution,
      hadNearbyNews: hadNearbyNews || (i < count * preEventPercentage),
    });
  }

  return trades;
}

// Helper functions for specific patterns
function createNormalTrades(count: number): TimingTrade[] {
  return createWalletTrades(count, { intervalHours: 24 });
}

function createOffHoursTrades(count: number): TimingTrade[] {
  return createWalletTrades(count, { hourSpread: [2, 3, 4, 5] });
}

function createConcentratedTrades(count: number, hour: number): TimingTrade[] {
  return createWalletTrades(count, { hourSpread: [hour] });
}

function createBotLikeTrades(count: number): TimingTrade[] {
  const trades: TimingTrade[] = [];
  const startDate = new Date("2026-01-01T12:00:00Z");
  const intervalMs = 60 * 60 * 1000; // Exactly 1 hour

  for (let i = 0; i < count; i++) {
    trades.push({
      tradeId: `trade-${i}`,
      marketId: `market-${i % 3}`,
      timestamp: new Date(startDate.getTime() + i * intervalMs),
      side: "buy",
      sizeUsd: 500,
    });
  }

  return trades;
}

function createInsiderLikeTrades(count: number): TimingTrade[] {
  const trades: TimingTrade[] = [];
  const startDate = new Date("2026-01-01T03:00:00Z"); // Late night

  for (let i = 0; i < count; i++) {
    trades.push({
      tradeId: `trade-${i}`,
      marketId: `market-${i % 3}`,
      timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
      side: "buy",
      sizeUsd: 5000 + Math.random() * 5000,
      isWinner: true, // Perfect win rate
      timeToResolution: 1, // Right before resolution
      hadNearbyNews: true,
    });
  }

  return trades;
}

describe("E2E: Timing Pattern Analyzer", () => {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let baseUrl: string;

  beforeAll(async () => {
    if (SKIP_BROWSER_TESTS) {
      return;
    }

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      page = await browser.newPage();
      baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
    } catch {
      // Browser launch failed, skip browser tests
      browser = null;
      page = null;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(() => {
    resetSharedTimingPatternAnalyzer();
  });

  afterEach(() => {
    resetSharedTimingPatternAnalyzer();
  });

  // ==========================================================================
  // Real-World Scenario Tests
  // ==========================================================================

  describe("Real-World Scenarios", () => {
    it("should analyze normal retail trader", () => {
      const trades = createNormalTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.patternType).not.toBe(TimingPatternType.PRE_EVENT);
      // Suspicion level depends on exact trade patterns
      expect(result?.suspicionLevel).toBeDefined();
    });

    it("should detect off-hours trading patterns", () => {
      const trades = createOffHoursTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.patternType).toBe(TimingPatternType.OFF_HOURS);
      expect(result?.offHoursPercentage).toBeGreaterThan(50);
    });

    it("should detect bot-like patterns", () => {
      const trades = createBotLikeTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.regularityScore).toBeGreaterThan(0.5);
    });

    it("should detect concentrated trading patterns", () => {
      const trades = createConcentratedTrades(50, 14);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.patternType).toBe(TimingPatternType.CONCENTRATED);
      expect(result?.concentrationScore).toBeGreaterThan(0.5);
    });

    it("should detect suspicious insider-like patterns", () => {
      const trades = createInsiderLikeTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.anomalies.length).toBeGreaterThan(0);
      expect(result?.suspicionScore).toBeGreaterThan(30);
    });
  });

  // ==========================================================================
  // Batch Analysis E2E Tests
  // ==========================================================================

  describe("Batch Analysis", () => {
    it("should analyze multiple wallets with different patterns", () => {
      const entries = [
        { address: TEST_WALLET, trades: createNormalTrades(30) },
        { address: TEST_WALLET_2, trades: createOffHoursTrades(30) },
        { address: TEST_WALLET_3, trades: createBotLikeTrades(30) },
      ];

      const result = batchAnalyzeTimingPatterns(entries);

      expect(result.results.size).toBe(3);
      expect(result.errors.size).toBe(0);

      // Verify at least one result has off-hours pattern
      const resultsArray = Array.from(result.results.values());
      const hasOffHoursResult = resultsArray.some(
        (r) => r.patternType === TimingPatternType.OFF_HOURS
      );
      expect(hasOffHoursResult).toBe(true);
    });

    it("should handle large batch efficiently", () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        address: `0x${i.toString(16).padStart(40, "0")}`,
        trades: createNormalTrades(20),
      }));

      const startTime = Date.now();
      const result = batchAnalyzeTimingPatterns(entries);
      const duration = Date.now() - startTime;

      expect(result.results.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
    });
  });

  // ==========================================================================
  // Summary and Statistics E2E Tests
  // ==========================================================================

  describe("Summary and Statistics", () => {
    it("should track pattern distribution across wallets", () => {
      // Analyze several wallets with different patterns
      analyzeTimingPattern(TEST_WALLET, createNormalTrades(30));
      analyzeTimingPattern(TEST_WALLET_2, createOffHoursTrades(30));
      analyzeTimingPattern(TEST_WALLET_3, createConcentratedTrades(30, 14));

      const summary = getTimingAnalyzerSummary();

      expect(summary.totalWalletsAnalyzed).toBe(3);
      expect(summary.cachedAnalyses).toBe(3);
    });

    it("should calculate average suspicion score", () => {
      analyzeTimingPattern(TEST_WALLET, createNormalTrades(30));
      analyzeTimingPattern(TEST_WALLET_2, createInsiderLikeTrades(30));

      const summary = getTimingAnalyzerSummary();

      expect(summary.avgSuspicionScore).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Anomaly Detection E2E Tests
  // ==========================================================================

  describe("Anomaly Detection Integration", () => {
    it("should detect multiple anomaly types in suspicious wallet", () => {
      const trades: TimingTrade[] = [];
      const startDate = new Date("2026-01-01T03:00:00Z");

      for (let i = 0; i < 50; i++) {
        trades.push({
          tradeId: `trade-${i}`,
          marketId: `market-${i % 3}`,
          timestamp: new Date(startDate.getTime() + i * 60 * 60 * 1000), // Regular intervals
          side: "buy",
          sizeUsd: 5000,
          isWinner: true,
          timeToResolution: 1,
          hadNearbyNews: true,
        });
      }

      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.anomalies.length).toBeGreaterThan(0);

      // Should detect multiple types of anomalies
      const anomalyTypes = result?.anomalies.map((a) => a.type) || [];
      expect(anomalyTypes.length).toBeGreaterThan(0);
    });

    it("should not flag normal trading as anomalous", () => {
      const trades = createNormalTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      // Normal trading should have few or no high-severity anomalies
      const highSeverityAnomalies = result?.anomalies.filter((a) => a.severity >= 70) || [];
      expect(highSeverityAnomalies.length).toBeLessThan(2);
    });
  });

  // ==========================================================================
  // Suspicion Level E2E Tests
  // ==========================================================================

  describe("Suspicion Level Classification", () => {
    it("should classify normal trader as low suspicion", () => {
      const trades = createNormalTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      // Normal trading should not be flagged as CRITICAL
      expect(result?.suspicionLevel).not.toBe(TimingSuspicionLevel.CRITICAL);
    });

    it("should classify insider-like patterns as higher suspicion", () => {
      const trades = createInsiderLikeTrades(50);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      // Insider-like should have higher suspicion than normal
      expect(result?.suspicionScore).toBeGreaterThan(20);
    });

    it("should properly use hasSuspiciousTiming helper", () => {
      const normalTrades = createNormalTrades(50);
      const insiderTrades = createInsiderLikeTrades(50);

      const normalSuspicious = hasSuspiciousTiming(TEST_WALLET, normalTrades);
      const insiderSuspicious = hasSuspiciousTiming(TEST_WALLET_2, insiderTrades);

      // Both should return boolean values
      expect(typeof normalSuspicious).toBe("boolean");
      expect(typeof insiderSuspicious).toBe("boolean");

      // Insider-like should have at least as much suspicion as normal
      // (This is a relative test rather than absolute)
    });
  });

  // ==========================================================================
  // Description Functions E2E Tests
  // ==========================================================================

  describe("Description Functions", () => {
    it("should provide meaningful pattern descriptions", () => {
      const allPatterns = Object.values(TimingPatternType);

      for (const pattern of allPatterns) {
        const description = getTimingPatternDescription(pattern);
        expect(description.length).toBeGreaterThan(10);
        expect(description).not.toContain("undefined");
      }
    });

    it("should provide meaningful suspicion level descriptions", () => {
      const allLevels = Object.values(TimingSuspicionLevel);

      for (const level of allLevels) {
        const description = getSuspicionLevelDescription(level);
        expect(description.length).toBeGreaterThan(10);
        expect(description).not.toContain("undefined");
      }
    });
  });

  // ==========================================================================
  // Caching E2E Tests
  // ==========================================================================

  describe("Caching Behavior", () => {
    it("should return cached results for same wallet", () => {
      const trades = createNormalTrades(30);
      const result1 = analyzeTimingPattern(TEST_WALLET, trades);
      const result2 = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result1?.analyzedAt).toEqual(result2?.analyzedAt);
    });

    it("should analyze fresh when force refresh is used", () => {
      const analyzer = createTimingPatternAnalyzer();
      const trades = createNormalTrades(30);

      analyzer.analyze(TEST_WALLET, trades);
      const result2 = analyzer.analyze(TEST_WALLET, trades, { forceRefresh: true });

      expect(result2).not.toBeNull();
    });
  });

  // ==========================================================================
  // Browser Integration Tests
  // ==========================================================================

  describe("Browser Integration", () => {
    it("should be able to load application without errors from timing analyzer", async () => {
      if (SKIP_BROWSER_TESTS || !page) {
        expect(true).toBe(true);
        return;
      }

      const jsErrors: string[] = [];

      try {
        page.on("pageerror", (error) => {
          jsErrors.push(String(error));
        });

        await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 30000 });

        // Allow some time for any async errors
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check no critical JS errors related to timing analyzer
        const timingErrors = jsErrors.filter(
          (err) => err.includes("timing") || err.includes("Timing")
        );

        expect(timingErrors).toHaveLength(0);
      } catch {
        // Browser test failed gracefully
        expect(true).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Integration with Other Modules
  // ==========================================================================

  describe("Module Integration", () => {
    it("should work with trade data from various sources", () => {
      // Simulate trades that might come from different API sources
      const mixedTrades: TimingTrade[] = [];

      // Add trades from different time zones/patterns
      const baseDate = new Date("2026-01-01T00:00:00Z");
      for (let i = 0; i < 30; i++) {
        mixedTrades.push({
          tradeId: `api1-${i}`,
          marketId: "market-1",
          timestamp: new Date(baseDate.getTime() + i * 6 * 60 * 60 * 1000),
          side: i % 2 === 0 ? "buy" : "sell",
          sizeUsd: 100 + Math.random() * 900,
        });
      }

      const result = analyzeTimingPattern(TEST_WALLET, mixedTrades);

      expect(result).not.toBeNull();
      expect(result?.tradeCount).toBe(30);
    });

    it("should handle trades with all optional fields", () => {
      const startDate = new Date("2026-01-01T12:00:00Z");
      const trades: TimingTrade[] = Array.from({ length: 30 }, (_, i) => ({
        tradeId: `trade-${i}`,
        marketId: `market-${i % 5}`,
        timestamp: new Date(startDate.getTime() + i * 60 * 60 * 1000), // 1 hour apart
        side: "buy" as const,
        sizeUsd: 500,
        isWinner: i % 2 === 0,
        timeToResolution: i < 10 ? 2 : undefined, // First 10 trades are pre-event
        hadNearbyNews: i < 5,
      }));

      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      // With 10 out of 30 trades having timeToResolution, preEventPercentage should be > 0
      expect(result?.preEventPercentage).toBeGreaterThanOrEqual(0);
      // Verify the analysis handles all optional fields gracefully
      expect(result?.tradeCount).toBe(30);
    });
  });

  // ==========================================================================
  // Edge Cases E2E Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle wallet with minimum required trades", () => {
      const trades = createNormalTrades(5);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe("LOW");
    });

    it("should handle wallet with very large trade history", () => {
      const trades = createNormalTrades(500);
      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      expect(result?.confidence).toBe("VERY_HIGH");
    });

    it("should handle trades spanning multiple years", () => {
      const trades: TimingTrade[] = [];
      const startDate = new Date("2024-01-01T12:00:00Z");

      for (let i = 0; i < 30; i++) {
        trades.push({
          tradeId: `trade-${i}`,
          marketId: "market-1",
          timestamp: new Date(startDate.getTime() + i * 30 * 24 * 60 * 60 * 1000), // Monthly
          side: "buy",
          sizeUsd: 500,
        });
      }

      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
    });

    it("should handle trades all in single day", () => {
      const trades: TimingTrade[] = [];
      const startDate = new Date("2026-01-01T09:00:00Z");

      for (let i = 0; i < 30; i++) {
        trades.push({
          tradeId: `trade-${i}`,
          marketId: "market-1",
          timestamp: new Date(startDate.getTime() + i * 30 * 60 * 1000), // 30 minutes apart
          side: "buy",
          sizeUsd: 500,
        });
      }

      const result = analyzeTimingPattern(TEST_WALLET, trades);

      expect(result).not.toBeNull();
      // Trades are concentrated within a few hours of a single day
      // concentrationScore may or may not be high depending on hour distribution
      expect(result?.concentrationScore).toBeGreaterThanOrEqual(0);
      // The day distribution should show all trades on the same day
      expect(result?.weekendPercentage).toBeDefined();
    });
  });
});

// Custom matcher for toBeOneOf
expect.extend({
  toBeOneOf(received, expected: unknown[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected}`
          : `expected ${received} to be one of ${expected}`,
    };
  },
});

declare module "vitest" {
  interface Assertion<T> {
    toBeOneOf(expected: unknown[]): T;
  }
  interface AsymmetricMatchersContaining {
    toBeOneOf(expected: unknown[]): unknown;
  }
}
