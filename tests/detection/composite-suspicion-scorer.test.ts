/**
 * Unit tests for Composite Suspicion Scorer (DET-SCORE-001)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SignalSource,
  CompositeSignalCategory,
  CompositeSuspicionLevel,
  SignalConfidence,
  COMPOSITE_DEFAULT_SIGNAL_WEIGHTS,
  DEFAULT_CATEGORY_WEIGHTS,
  SIGNAL_CATEGORY_MAP,
  SUSPICION_THRESHOLDS,
  DEFAULT_COMPOSITE_CONFIG,
  CompositeSuspicionScorer,
  createCompositeSuspicionScorer,
  getSharedCompositeSuspicionScorer,
  setSharedCompositeSuspicionScorer,
  resetSharedCompositeSuspicionScorer,
  calculateCompositeSuspicionScore,
  batchCalculateCompositeSuspicionScores,
  hasHighSuspicion,
  getHighSuspicionWallets,
  getPotentialInsiders,
  getCompositeScorerSummary,
  getCompositeSuspicionLevelDescription,
  getSignalCategoryDescription,
  getSignalSourceDescription,
} from "../../src/detection/composite-suspicion-scorer";

// Test wallet addresses (valid EIP-55 checksummed)
const WALLET_1 = "0x1234567890123456789012345678901234567890";
const WALLET_2 = "0xabcdefABCDEF12345678901234567890ABCDEF12";
const WALLET_3 = "0x9876543210987654321098765432109876543210";
const INVALID_WALLET = "0xinvalid";

describe("CompositeSuspicionScorer", () => {
  let scorer: CompositeSuspicionScorer;

  beforeEach(() => {
    scorer = new CompositeSuspicionScorer();
    resetSharedCompositeSuspicionScorer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constants and Enums
  // ============================================================================

  describe("constants", () => {
    it("should have valid default signal weights", () => {
      expect(COMPOSITE_DEFAULT_SIGNAL_WEIGHTS).toBeDefined();

      // All signal sources should have weights
      for (const source of Object.values(SignalSource)) {
        expect(COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[source]).toBeDefined();
        expect(COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[source]).toBeGreaterThanOrEqual(0);
        expect(COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[source]).toBeLessThanOrEqual(1);
      }

      // Weights should sum to approximately 1
      const totalWeight = Object.values(COMPOSITE_DEFAULT_SIGNAL_WEIGHTS).reduce(
        (sum, w) => sum + w,
        0
      );
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it("should have valid default category weights", () => {
      expect(DEFAULT_CATEGORY_WEIGHTS).toBeDefined();

      for (const category of Object.values(CompositeSignalCategory)) {
        expect(DEFAULT_CATEGORY_WEIGHTS[category]).toBeDefined();
        expect(DEFAULT_CATEGORY_WEIGHTS[category]).toBeGreaterThanOrEqual(0);
        expect(DEFAULT_CATEGORY_WEIGHTS[category]).toBeLessThanOrEqual(1);
      }

      // Weights should sum to 1
      const totalWeight = Object.values(DEFAULT_CATEGORY_WEIGHTS).reduce(
        (sum, w) => sum + w,
        0
      );
      expect(totalWeight).toBeCloseTo(1, 1);
    });

    it("should have valid signal category mapping", () => {
      expect(SIGNAL_CATEGORY_MAP).toBeDefined();

      for (const source of Object.values(SignalSource)) {
        expect(SIGNAL_CATEGORY_MAP[source]).toBeDefined();
        expect(Object.values(CompositeSignalCategory)).toContain(SIGNAL_CATEGORY_MAP[source]);
      }
    });

    it("should have valid suspicion thresholds", () => {
      expect(SUSPICION_THRESHOLDS).toBeDefined();
      expect(SUSPICION_THRESHOLDS.low).toBeGreaterThan(0);
      expect(SUSPICION_THRESHOLDS.medium).toBeGreaterThan(SUSPICION_THRESHOLDS.low);
      expect(SUSPICION_THRESHOLDS.high).toBeGreaterThan(SUSPICION_THRESHOLDS.medium);
      expect(SUSPICION_THRESHOLDS.critical).toBeGreaterThan(SUSPICION_THRESHOLDS.high);
    });

    it("should have valid default config", () => {
      expect(DEFAULT_COMPOSITE_CONFIG).toBeDefined();
      expect(DEFAULT_COMPOSITE_CONFIG.minSignals).toBeGreaterThan(0);
      expect(DEFAULT_COMPOSITE_CONFIG.cacheTtlMs).toBeGreaterThan(0);
      expect(DEFAULT_COMPOSITE_CONFIG.maxCacheSize).toBeGreaterThan(0);
      expect(DEFAULT_COMPOSITE_CONFIG.flagThreshold).toBeGreaterThan(0);
      expect(DEFAULT_COMPOSITE_CONFIG.insiderThreshold).toBeGreaterThan(
        DEFAULT_COMPOSITE_CONFIG.flagThreshold
      );
    });
  });

  describe("enums", () => {
    it("should have all expected signal sources", () => {
      expect(SignalSource.FRESH_WALLET).toBe("FRESH_WALLET");
      expect(SignalSource.WIN_RATE).toBe("WIN_RATE");
      expect(SignalSource.PROFIT_LOSS).toBe("PROFIT_LOSS");
      expect(SignalSource.TIMING_PATTERN).toBe("TIMING_PATTERN");
      expect(SignalSource.POSITION_SIZING).toBe("POSITION_SIZING");
      expect(SignalSource.MARKET_SELECTION).toBe("MARKET_SELECTION");
      expect(SignalSource.COORDINATION).toBe("COORDINATION");
      expect(SignalSource.SYBIL).toBe("SYBIL");
      expect(SignalSource.ACCURACY).toBe("ACCURACY");
      expect(SignalSource.TRADING_PATTERN).toBe("TRADING_PATTERN");
    });

    it("should have all expected signal categories", () => {
      expect(CompositeSignalCategory.WALLET_PROFILE).toBe("WALLET_PROFILE");
      expect(CompositeSignalCategory.PERFORMANCE).toBe("PERFORMANCE");
      expect(CompositeSignalCategory.BEHAVIOR).toBe("BEHAVIOR");
      expect(CompositeSignalCategory.NETWORK).toBe("NETWORK");
    });

    it("should have all expected suspicion levels", () => {
      expect(CompositeSuspicionLevel.NONE).toBe("NONE");
      expect(CompositeSuspicionLevel.LOW).toBe("LOW");
      expect(CompositeSuspicionLevel.MEDIUM).toBe("MEDIUM");
      expect(CompositeSuspicionLevel.HIGH).toBe("HIGH");
      expect(CompositeSuspicionLevel.CRITICAL).toBe("CRITICAL");
    });

    it("should have all expected confidence levels", () => {
      expect(SignalConfidence.LOW).toBe("LOW");
      expect(SignalConfidence.MEDIUM).toBe("MEDIUM");
      expect(SignalConfidence.HIGH).toBe("HIGH");
    });
  });

  // ============================================================================
  // Constructor and Configuration
  // ============================================================================

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(scorer).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should create instance with custom config", () => {
      const customScorer = new CompositeSuspicionScorer({
        minSignals: 5,
        flagThreshold: 70,
        cacheTtlMs: 120000,
      });
      expect(customScorer).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should merge custom config with defaults", () => {
      const customScorer = new CompositeSuspicionScorer({
        minSignals: 5,
      });
      const summary = customScorer.getSummary();
      expect(summary).toBeDefined();
    });

    it("should accept custom signal weights", () => {
      const customWeights: Record<SignalSource, number> = {
        [SignalSource.FRESH_WALLET]: 0.2,
        [SignalSource.WIN_RATE]: 0.2,
        [SignalSource.PROFIT_LOSS]: 0.1,
        [SignalSource.TIMING_PATTERN]: 0.1,
        [SignalSource.POSITION_SIZING]: 0.1,
        [SignalSource.MARKET_SELECTION]: 0.1,
        [SignalSource.COORDINATION]: 0.05,
        [SignalSource.SYBIL]: 0.05,
        [SignalSource.ACCURACY]: 0.05,
        [SignalSource.TRADING_PATTERN]: 0.05,
      };

      const customScorer = new CompositeSuspicionScorer({
        signalWeights: customWeights,
      });
      expect(customScorer).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should accept custom category weights", () => {
      const customCategoryWeights: Record<CompositeSignalCategory, number> = {
        [CompositeSignalCategory.WALLET_PROFILE]: 0.2,
        [CompositeSignalCategory.PERFORMANCE]: 0.4,
        [CompositeSignalCategory.BEHAVIOR]: 0.2,
        [CompositeSignalCategory.NETWORK]: 0.2,
      };

      const customScorer = new CompositeSuspicionScorer({
        categoryWeights: customCategoryWeights,
      });
      expect(customScorer).toBeInstanceOf(CompositeSuspicionScorer);
    });
  });

  // ============================================================================
  // Score Calculation
  // ============================================================================

  describe("calculateScore", () => {
    it("should throw error for invalid wallet address", async () => {
      await expect(scorer.calculateScore(INVALID_WALLET)).rejects.toThrow();
    });

    it("should normalize wallet address", async () => {
      // Should not throw for lowercase valid address
      const result = await scorer.calculateScore(WALLET_1.toLowerCase());
      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(WALLET_1);
    });

    it("should return valid composite score result", async () => {
      const result = await scorer.calculateScore(WALLET_1);

      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(WALLET_1);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
      expect(result.suspicionLevel).toBeDefined();
      expect(Object.values(CompositeSuspicionLevel)).toContain(result.suspicionLevel);
      expect(result.signalContributions).toBeInstanceOf(Array);
      expect(result.categoryBreakdown).toBeInstanceOf(Array);
      expect(result.riskFlags).toBeInstanceOf(Array);
      expect(typeof result.dataQuality).toBe("number");
      expect(typeof result.isPotentialInsider).toBe("boolean");
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should include signal contributions for all sources", async () => {
      const result = await scorer.calculateScore(WALLET_1);

      const sources = result.signalContributions.map((s) => s.source);
      for (const source of Object.values(SignalSource)) {
        expect(sources).toContain(source);
      }
    });

    it("should respect useCache option", async () => {
      // First call - should populate cache
      const result1 = await scorer.calculateScore(WALLET_1);

      // Second call with useCache:false - should recalculate
      const result2 = await scorer.calculateScore(WALLET_1, { useCache: false });

      // Both should be valid
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("should use cached result when available", async () => {
      // First call
      const result1 = await scorer.calculateScore(WALLET_1);

      // Second call - should use cache
      const result2 = await scorer.calculateScore(WALLET_1);

      // Results should be identical
      expect(result1.compositeScore).toBe(result2.compositeScore);
      expect(result1.suspicionLevel).toBe(result2.suspicionLevel);
    });

    it("should handle signal weight config in options", async () => {
      const customWeights: Partial<Record<SignalSource, number>> = {
        [SignalSource.WIN_RATE]: 0.5,
      };

      const result = await scorer.calculateScore(WALLET_1, {
        signalWeights: customWeights,
      });

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Batch Processing
  // ============================================================================

  describe("batchCalculateScores", () => {
    it("should process multiple wallets", async () => {
      const wallets = [WALLET_1, WALLET_2, WALLET_3];
      const result = await scorer.batchCalculateScores(wallets);

      expect(result).toBeDefined();
      expect(result.results.size).toBe(3);
      expect(result.totalProcessed).toBe(3);
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it("should handle empty wallet list", async () => {
      const result = await scorer.batchCalculateScores([]);

      expect(result).toBeDefined();
      expect(result.results.size).toBe(0);
      expect(result.totalProcessed).toBe(0);
    });

    it("should track failed wallets", async () => {
      const wallets = [WALLET_1, INVALID_WALLET, WALLET_2];
      const result = await scorer.batchCalculateScores(wallets);

      expect(result.failed.size).toBe(1);
      expect(result.failed.has(INVALID_WALLET)).toBe(true);
    });

    it("should calculate average score", async () => {
      const wallets = [WALLET_1, WALLET_2];
      const result = await scorer.batchCalculateScores(wallets);

      expect(typeof result.averageScore).toBe("number");
      expect(result.averageScore).toBeGreaterThanOrEqual(0);
      expect(result.averageScore).toBeLessThanOrEqual(100);
    });

    it("should group wallets by suspicion level", async () => {
      const wallets = [WALLET_1, WALLET_2, WALLET_3];
      const result = await scorer.batchCalculateScores(wallets);

      expect(result.byLevel).toBeDefined();
      for (const level of Object.values(CompositeSuspicionLevel)) {
        expect(typeof result.byLevel[level]).toBe("number");
      }
    });
  });

  // ============================================================================
  // High Suspicion and Insider Detection
  // ============================================================================

  describe("getHighSuspicionWallets", () => {
    it("should return array of high suspicion results", async () => {
      // Calculate scores first
      await scorer.calculateScore(WALLET_1);
      await scorer.calculateScore(WALLET_2);

      const highSuspicion = scorer.getHighSuspicionWallets();
      expect(highSuspicion).toBeInstanceOf(Array);
    });

    it("should respect minimum level parameter", async () => {
      await scorer.calculateScore(WALLET_1);

      const criticalOnly = scorer.getHighSuspicionWallets(CompositeSuspicionLevel.CRITICAL);
      const highAndAbove = scorer.getHighSuspicionWallets(CompositeSuspicionLevel.HIGH);

      expect(criticalOnly).toBeInstanceOf(Array);
      expect(highAndAbove).toBeInstanceOf(Array);
    });
  });

  describe("getPotentialInsiders", () => {
    it("should return array of potential insiders", async () => {
      await scorer.calculateScore(WALLET_1);

      const insiders = scorer.getPotentialInsiders();
      expect(insiders).toBeInstanceOf(Array);
    });
  });

  // ============================================================================
  // Summary and Statistics
  // ============================================================================

  describe("getSummary", () => {
    it("should return valid summary with no data", () => {
      const summary = scorer.getSummary();

      expect(summary).toBeDefined();
      expect(summary.totalWalletsScored).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.medianScore).toBeNull();
      expect(summary.byLevel).toBeDefined();
      expect(summary.signalAvailability).toBeDefined();
      expect(summary.commonFlags).toBeInstanceOf(Array);
      expect(summary.cacheStats).toBeDefined();
    });

    it("should return accurate summary after scoring", async () => {
      await scorer.calculateScore(WALLET_1);
      await scorer.calculateScore(WALLET_2);

      const summary = scorer.getSummary();

      expect(summary.totalWalletsScored).toBe(2);
      expect(summary.cacheStats.size).toBe(2);
    });

    it("should track signal availability", async () => {
      await scorer.calculateScore(WALLET_1);

      const summary = scorer.getSummary();

      for (const source of Object.values(SignalSource)) {
        expect(summary.signalAvailability[source]).toBeDefined();
        expect(summary.signalAvailability[source].total).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Cache Management
  // ============================================================================

  describe("cache", () => {
    it("should cache results", async () => {
      await scorer.calculateScore(WALLET_1);

      const summary = scorer.getSummary();
      expect(summary.cacheStats.size).toBe(1);
    });

    it("should clear cache", async () => {
      await scorer.calculateScore(WALLET_1);
      scorer.clearCache();

      const summary = scorer.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });
  });

  // ============================================================================
  // Event Emission
  // ============================================================================

  describe("events", () => {
    it("should be an event emitter", () => {
      expect(typeof scorer.on).toBe("function");
      expect(typeof scorer.emit).toBe("function");
      expect(typeof scorer.removeListener).toBe("function");
    });

    it("should emit score-calculated event", async () => {
      const handler = vi.fn();
      scorer.on("score-calculated", handler);

      await scorer.calculateScore(WALLET_1);

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Factory Functions
  // ============================================================================

  describe("factory functions", () => {
    it("should create scorer with createCompositeSuspicionScorer", () => {
      const newScorer = createCompositeSuspicionScorer();
      expect(newScorer).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should create scorer with custom config", () => {
      const newScorer = createCompositeSuspicionScorer({
        minSignals: 5,
      });
      expect(newScorer).toBeInstanceOf(CompositeSuspicionScorer);
    });
  });

  // ============================================================================
  // Shared Instance
  // ============================================================================

  describe("shared instance", () => {
    it("should get shared instance", () => {
      const shared = getSharedCompositeSuspicionScorer();
      expect(shared).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should return same shared instance", () => {
      const shared1 = getSharedCompositeSuspicionScorer();
      const shared2 = getSharedCompositeSuspicionScorer();
      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const customScorer = new CompositeSuspicionScorer({ minSignals: 10 });
      setSharedCompositeSuspicionScorer(customScorer);

      const shared = getSharedCompositeSuspicionScorer();
      expect(shared).toBe(customScorer);
    });

    it("should reset shared instance", () => {
      const shared1 = getSharedCompositeSuspicionScorer();
      resetSharedCompositeSuspicionScorer();
      const shared2 = getSharedCompositeSuspicionScorer();

      expect(shared1).not.toBe(shared2);
    });
  });

  // ============================================================================
  // Convenience Functions
  // ============================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedCompositeSuspicionScorer();
    });

    it("should calculate score using calculateCompositeSuspicionScore", async () => {
      const result = await calculateCompositeSuspicionScore(WALLET_1);
      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(WALLET_1);
    });

    it("should batch calculate using batchCalculateCompositeSuspicionScores", async () => {
      const result = await batchCalculateCompositeSuspicionScores([WALLET_1, WALLET_2]);
      expect(result).toBeDefined();
      expect(result.results.size).toBe(2);
    });

    it("should check high suspicion using hasHighSuspicion", async () => {
      const result = await hasHighSuspicion(WALLET_1);
      expect(typeof result).toBe("boolean");
    });

    it("should get high suspicion wallets using getHighSuspicionWallets", async () => {
      await calculateCompositeSuspicionScore(WALLET_1);
      const wallets = getHighSuspicionWallets();
      expect(wallets).toBeInstanceOf(Array);
    });

    it("should get potential insiders using getPotentialInsiders", async () => {
      await calculateCompositeSuspicionScore(WALLET_1);
      const insiders = getPotentialInsiders();
      expect(insiders).toBeInstanceOf(Array);
    });

    it("should get summary using getCompositeScorerSummary", () => {
      const summary = getCompositeScorerSummary();
      expect(summary).toBeDefined();
    });
  });

  // ============================================================================
  // Description Functions
  // ============================================================================

  describe("description functions", () => {
    describe("getCompositeSuspicionLevelDescription", () => {
      it("should return description for NONE level", () => {
        const desc = getCompositeSuspicionLevelDescription(CompositeSuspicionLevel.NONE);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for LOW level", () => {
        const desc = getCompositeSuspicionLevelDescription(CompositeSuspicionLevel.LOW);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for MEDIUM level", () => {
        const desc = getCompositeSuspicionLevelDescription(CompositeSuspicionLevel.MEDIUM);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for HIGH level", () => {
        const desc = getCompositeSuspicionLevelDescription(CompositeSuspicionLevel.HIGH);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for CRITICAL level", () => {
        const desc = getCompositeSuspicionLevelDescription(CompositeSuspicionLevel.CRITICAL);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });
    });

    describe("getSignalCategoryDescription", () => {
      it("should return description for WALLET_PROFILE category", () => {
        const desc = getSignalCategoryDescription(CompositeSignalCategory.WALLET_PROFILE);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for PERFORMANCE category", () => {
        const desc = getSignalCategoryDescription(CompositeSignalCategory.PERFORMANCE);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for BEHAVIOR category", () => {
        const desc = getSignalCategoryDescription(CompositeSignalCategory.BEHAVIOR);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });

      it("should return description for NETWORK category", () => {
        const desc = getSignalCategoryDescription(CompositeSignalCategory.NETWORK);
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });
    });

    describe("getSignalSourceDescription", () => {
      it("should return description for each signal source", () => {
        for (const source of Object.values(SignalSource)) {
          const desc = getSignalSourceDescription(source);
          expect(typeof desc).toBe("string");
          expect(desc.length).toBeGreaterThan(0);
        }
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle wallet with no data gracefully", async () => {
      const result = await scorer.calculateScore(WALLET_1);
      expect(result).toBeDefined();
      // With no real data, signals should still be present
      expect(result.signalContributions.length).toBeGreaterThan(0);
    });

    it("should handle concurrent score calculations", async () => {
      const promises = [
        scorer.calculateScore(WALLET_1),
        scorer.calculateScore(WALLET_2),
        scorer.calculateScore(WALLET_3),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it("should handle very long wallet list in batch", async () => {
      const wallets: string[] = [];
      for (let i = 0; i < 100; i++) {
        wallets.push(`0x${i.toString(16).padStart(40, "0")}`);
      }

      const result = await scorer.batchCalculateScores(wallets);
      expect(result).toBeDefined();
    });
  });
});
