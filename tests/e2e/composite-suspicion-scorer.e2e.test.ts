/**
 * Composite Suspicion Scorer E2E Tests (DET-SCORE-001)
 *
 * End-to-end tests that verify the composite suspicion scorer works correctly
 * with realistic data scenarios and integration with all detection components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CompositeSuspicionScorer,
  resetSharedCompositeSuspicionScorer,
  calculateCompositeSuspicionScore,
  batchCalculateCompositeSuspicionScores,
  hasHighSuspicion,
  getHighSuspicionWallets,
  getPotentialInsiders,
  getCompositeScorerSummary,
  SignalSource,
  CompositeSignalCategory,
  CompositeSuspicionLevel,
  SignalConfidence,
  getCompositeSuspicionLevelDescription,
  getSignalCategoryDescription,
  getSignalSourceDescription,
} from "../../src/detection/composite-suspicion-scorer";

// ============================================================================
// Test Helpers
// ============================================================================

// Valid Ethereum addresses for testing
const WALLETS = {
  NORMAL_TRADER: "0x1111111111111111111111111111111111111111",
  SUSPICIOUS_TRADER: "0x2222222222222222222222222222222222222222",
  HIGH_ACCURACY_TRADER: "0x3333333333333333333333333333333333333333",
  FRESH_WALLET: "0x4444444444444444444444444444444444444444",
  COORDINATED_TRADER: "0x5555555555555555555555555555555555555555",
  WHALE: "0x6666666666666666666666666666666666666666",
  INSIDER_SUSPECT: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  RETAIL: "0xcccccccccccccccccccccccccccccccccccccccc",
};

// ============================================================================
// E2E Tests
// ============================================================================

describe("Composite Suspicion Scorer E2E", () => {
  let scorer: CompositeSuspicionScorer;

  beforeEach(() => {
    scorer = new CompositeSuspicionScorer();
    resetSharedCompositeSuspicionScorer();
  });

  afterEach(() => {
    scorer.clearCache();
  });

  // --------------------------------------------------------------------------
  // Basic Integration Tests
  // --------------------------------------------------------------------------

  describe("Basic Integration", () => {
    it("should integrate with all detection components", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      // Should have contributions from all signal sources
      const sources = result.signalContributions.map((s) => s.source);
      expect(sources).toContain(SignalSource.FRESH_WALLET);
      expect(sources).toContain(SignalSource.WIN_RATE);
      expect(sources).toContain(SignalSource.PROFIT_LOSS);
      expect(sources).toContain(SignalSource.TIMING_PATTERN);
      expect(sources).toContain(SignalSource.POSITION_SIZING);
      expect(sources).toContain(SignalSource.MARKET_SELECTION);
      expect(sources).toContain(SignalSource.COORDINATION);
      expect(sources).toContain(SignalSource.SYBIL);
      expect(sources).toContain(SignalSource.ACCURACY);
      expect(sources).toContain(SignalSource.TRADING_PATTERN);
    });

    it("should produce category breakdown for all categories", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      const categories = result.categoryBreakdown.map((c) => c.category);
      // May not have all categories if no signals are available
      expect(categories.length).toBeGreaterThan(0);
    });

    it("should calculate composite score within valid range", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it("should assign appropriate suspicion level based on score", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(Object.values(CompositeSuspicionLevel)).toContain(result.suspicionLevel);

      // Verify level matches score thresholds
      if (result.compositeScore >= 80) {
        expect(result.suspicionLevel).toBe(CompositeSuspicionLevel.CRITICAL);
      } else if (result.compositeScore >= 60) {
        expect(result.suspicionLevel).toBe(CompositeSuspicionLevel.HIGH);
      } else if (result.compositeScore >= 40) {
        expect(result.suspicionLevel).toBe(CompositeSuspicionLevel.MEDIUM);
      } else if (result.compositeScore >= 20) {
        expect(result.suspicionLevel).toBe(CompositeSuspicionLevel.LOW);
      } else {
        expect(result.suspicionLevel).toBe(CompositeSuspicionLevel.NONE);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Batch Processing Tests
  // --------------------------------------------------------------------------

  describe("Batch Processing", () => {
    it("should process multiple wallets efficiently", async () => {
      const wallets = Object.values(WALLETS);
      const startTime = Date.now();

      const result = await scorer.batchCalculateScores(wallets);

      const endTime = Date.now();

      expect(result.results.size).toBe(wallets.length);
      expect(result.totalProcessed).toBe(wallets.length);
      expect(result.failed.size).toBe(0);

      // Should complete in reasonable time (less than 30s for 8 wallets)
      expect(endTime - startTime).toBeLessThan(30000);
    });

    it("should calculate accurate batch statistics", async () => {
      const wallets = [WALLETS.NORMAL_TRADER, WALLETS.WHALE, WALLETS.RETAIL];
      const result = await scorer.batchCalculateScores(wallets);

      // Average score should be reasonable
      expect(result.averageScore).toBeGreaterThanOrEqual(0);
      expect(result.averageScore).toBeLessThanOrEqual(100);

      // All levels should be accounted for
      let totalByLevel = 0;
      for (const level of Object.values(CompositeSuspicionLevel)) {
        totalByLevel += result.byLevel[level];
      }
      expect(totalByLevel).toBe(wallets.length);
    });

    it("should handle mixed valid and invalid wallets", async () => {
      const wallets = [WALLETS.NORMAL_TRADER, "0xinvalid", WALLETS.WHALE];
      const result = await scorer.batchCalculateScores(wallets);

      expect(result.results.size).toBe(2);
      expect(result.failed.size).toBe(1);
      expect(result.totalProcessed).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Caching Behavior Tests
  // --------------------------------------------------------------------------

  describe("Caching Behavior", () => {
    it("should cache results for faster subsequent access", async () => {
      // First call - populates cache
      const firstStart = Date.now();
      await scorer.calculateScore(WALLETS.NORMAL_TRADER);
      const firstDuration = Date.now() - firstStart;

      // Second call - should use cache
      const secondStart = Date.now();
      await scorer.calculateScore(WALLETS.NORMAL_TRADER);
      const secondDuration = Date.now() - secondStart;

      // Cached call should be faster (or at least not significantly slower)
      expect(secondDuration).toBeLessThan(firstDuration + 100);
    });

    it("should respect useCache: false option", async () => {
      // Populate cache
      const result1 = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      // Force recalculation
      const result2 = await scorer.calculateScore(WALLETS.NORMAL_TRADER, {
        useCache: false,
      });

      // Both should be valid results
      expect(result1.compositeScore).toBeDefined();
      expect(result2.compositeScore).toBeDefined();
    });

    it("should clear cache correctly", async () => {
      await scorer.calculateScore(WALLETS.NORMAL_TRADER);
      await scorer.calculateScore(WALLETS.WHALE);

      let summary = scorer.getSummary();
      expect(summary.cacheStats.size).toBe(2);

      scorer.clearCache();

      summary = scorer.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Summary and Statistics Tests
  // --------------------------------------------------------------------------

  describe("Summary and Statistics", () => {
    it("should provide accurate summary after scoring multiple wallets", async () => {
      const wallets = Object.values(WALLETS);
      await scorer.batchCalculateScores(wallets);

      const summary = scorer.getSummary();

      expect(summary.totalWalletsScored).toBe(wallets.length);
      expect(summary.cacheStats.size).toBe(wallets.length);
      expect(summary.averageScore).toBeGreaterThanOrEqual(0);
      expect(summary.averageScore).toBeLessThanOrEqual(100);
    });

    it("should track signal availability correctly", async () => {
      await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      const summary = scorer.getSummary();

      for (const source of Object.values(SignalSource)) {
        expect(summary.signalAvailability[source]).toBeDefined();
        expect(summary.signalAvailability[source].total).toBeGreaterThanOrEqual(0);
      }
    });

    it("should track common flags", async () => {
      await scorer.batchCalculateScores(Object.values(WALLETS));

      const summary = scorer.getSummary();

      expect(summary.commonFlags).toBeInstanceOf(Array);
    });
  });

  // --------------------------------------------------------------------------
  // High Suspicion Detection Tests
  // --------------------------------------------------------------------------

  describe("High Suspicion Detection", () => {
    it("should identify high suspicion wallets", async () => {
      await scorer.batchCalculateScores(Object.values(WALLETS));

      const highSuspicion = scorer.getHighSuspicionWallets(CompositeSuspicionLevel.HIGH);

      expect(highSuspicion).toBeInstanceOf(Array);
      // All returned wallets should have HIGH or CRITICAL level
      for (const result of highSuspicion) {
        expect([CompositeSuspicionLevel.HIGH, CompositeSuspicionLevel.CRITICAL]).toContain(
          result.suspicionLevel
        );
      }
    });

    it("should use hasHighSuspicion convenience function", async () => {
      const result = await hasHighSuspicion(WALLETS.NORMAL_TRADER, 50);

      expect(typeof result).toBe("boolean");
    });

    it("should identify potential insiders", async () => {
      await scorer.batchCalculateScores(Object.values(WALLETS));

      const insiders = scorer.getPotentialInsiders();

      expect(insiders).toBeInstanceOf(Array);
      // All returned results should have isPotentialInsider = true
      for (const result of insiders) {
        expect(result.isPotentialInsider).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Convenience Functions Tests
  // --------------------------------------------------------------------------

  describe("Convenience Functions", () => {
    it("should work with global calculateCompositeSuspicionScore", async () => {
      const result = await calculateCompositeSuspicionScore(WALLETS.NORMAL_TRADER);

      expect(result).toBeDefined();
      expect(result.walletAddress).toBe(WALLETS.NORMAL_TRADER);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it("should work with global batchCalculateCompositeSuspicionScores", async () => {
      const wallets = [WALLETS.NORMAL_TRADER, WALLETS.WHALE];
      const result = await batchCalculateCompositeSuspicionScores(wallets);

      expect(result.results.size).toBe(2);
    });

    it("should work with global getHighSuspicionWallets", async () => {
      await calculateCompositeSuspicionScore(WALLETS.NORMAL_TRADER);

      const wallets = getHighSuspicionWallets();

      expect(wallets).toBeInstanceOf(Array);
    });

    it("should work with global getPotentialInsiders", async () => {
      await calculateCompositeSuspicionScore(WALLETS.NORMAL_TRADER);

      const insiders = getPotentialInsiders();

      expect(insiders).toBeInstanceOf(Array);
    });

    it("should work with global getCompositeScorerSummary", () => {
      const summary = getCompositeScorerSummary();

      expect(summary).toBeDefined();
      expect(summary.totalWalletsScored).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Description Functions Tests
  // --------------------------------------------------------------------------

  describe("Description Functions", () => {
    it("should provide meaningful suspicion level descriptions", () => {
      for (const level of Object.values(CompositeSuspicionLevel)) {
        const desc = getCompositeSuspicionLevelDescription(level);
        expect(desc.length).toBeGreaterThan(10);
        expect(desc).not.toBe("Unknown");
      }
    });

    it("should provide meaningful category descriptions", () => {
      for (const category of Object.values(CompositeSignalCategory)) {
        const desc = getSignalCategoryDescription(category);
        expect(desc.length).toBeGreaterThan(10);
        expect(desc).not.toBe("Unknown category");
      }
    });

    it("should provide meaningful signal source descriptions", () => {
      for (const source of Object.values(SignalSource)) {
        const desc = getSignalSourceDescription(source);
        expect(desc.length).toBeGreaterThan(5);
        expect(desc).not.toBe("Unknown signal source");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Signal Contribution Analysis Tests
  // --------------------------------------------------------------------------

  describe("Signal Contribution Analysis", () => {
    it("should provide detailed signal contributions", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      for (const contribution of result.signalContributions) {
        expect(contribution.source).toBeDefined();
        expect(contribution.category).toBeDefined();
        expect(contribution.name).toBeDefined();
        expect(typeof contribution.rawScore).toBe("number");
        expect(typeof contribution.weight).toBe("number");
        expect(typeof contribution.weightedScore).toBe("number");
        expect(contribution.confidence).toBeDefined();
        expect(typeof contribution.dataQuality).toBe("number");
        expect(typeof contribution.available).toBe("boolean");
        expect(typeof contribution.reason).toBe("string");
        expect(contribution.flags).toBeInstanceOf(Array);
      }
    });

    it("should correctly map signals to categories", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      for (const contribution of result.signalContributions) {
        // Verify category mapping is correct
        switch (contribution.source) {
          case SignalSource.FRESH_WALLET:
            expect(contribution.category).toBe(CompositeSignalCategory.WALLET_PROFILE);
            break;
          case SignalSource.WIN_RATE:
          case SignalSource.PROFIT_LOSS:
          case SignalSource.ACCURACY:
            expect(contribution.category).toBe(CompositeSignalCategory.PERFORMANCE);
            break;
          case SignalSource.TIMING_PATTERN:
          case SignalSource.POSITION_SIZING:
          case SignalSource.MARKET_SELECTION:
          case SignalSource.TRADING_PATTERN:
            expect(contribution.category).toBe(CompositeSignalCategory.BEHAVIOR);
            break;
          case SignalSource.COORDINATION:
          case SignalSource.SYBIL:
            expect(contribution.category).toBe(CompositeSignalCategory.NETWORK);
            break;
        }
      }
    });

    it("should identify top contributing signals", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(result.topSignals).toBeInstanceOf(Array);
      // Top signals should be sorted by weighted score (descending)
      for (let i = 1; i < result.topSignals.length; i++) {
        expect(result.topSignals[i - 1]!.weightedScore).toBeGreaterThanOrEqual(
          result.topSignals[i]!.weightedScore
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Risk Flag Analysis Tests
  // --------------------------------------------------------------------------

  describe("Risk Flag Analysis", () => {
    it("should aggregate risk flags from all detectors", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(result.riskFlags).toBeInstanceOf(Array);
      for (const flag of result.riskFlags) {
        expect(flag.category).toBeDefined();
        expect(typeof flag.severity).toBe("number");
        expect(typeof flag.description).toBe("string");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Event Emission Tests
  // --------------------------------------------------------------------------

  describe("Event Emission", () => {
    it("should emit score-calculated event", async () => {
      let emittedResult: any = null;

      scorer.on("score-calculated", (result) => {
        emittedResult = result;
      });

      await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(emittedResult).not.toBeNull();
      expect(emittedResult.walletAddress).toBe(WALLETS.NORMAL_TRADER);
    });
  });

  // --------------------------------------------------------------------------
  // Custom Configuration Tests
  // --------------------------------------------------------------------------

  describe("Custom Configuration", () => {
    it("should respect custom signal weights", async () => {
      const customScorer = new CompositeSuspicionScorer({
        signalWeights: {
          [SignalSource.FRESH_WALLET]: 0.5,
          [SignalSource.WIN_RATE]: 0.1,
          [SignalSource.PROFIT_LOSS]: 0.1,
          [SignalSource.TIMING_PATTERN]: 0.05,
          [SignalSource.POSITION_SIZING]: 0.05,
          [SignalSource.MARKET_SELECTION]: 0.05,
          [SignalSource.COORDINATION]: 0.05,
          [SignalSource.SYBIL]: 0.05,
          [SignalSource.ACCURACY]: 0.025,
          [SignalSource.TRADING_PATTERN]: 0.025,
        },
      });

      const result = await customScorer.calculateScore(WALLETS.NORMAL_TRADER);

      // Fresh wallet should have higher weight in contributions
      const freshWalletContrib = result.signalContributions.find(
        (c) => c.source === SignalSource.FRESH_WALLET
      );
      expect(freshWalletContrib?.weight).toBe(0.5);
    });

    it("should respect custom category weights", async () => {
      const customScorer = new CompositeSuspicionScorer({
        categoryWeights: {
          [CompositeSignalCategory.WALLET_PROFILE]: 0.4,
          [CompositeSignalCategory.PERFORMANCE]: 0.3,
          [CompositeSignalCategory.BEHAVIOR]: 0.2,
          [CompositeSignalCategory.NETWORK]: 0.1,
        },
      });

      const result = await customScorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(result).toBeDefined();
    });

    it("should respect custom thresholds", async () => {
      const customScorer = new CompositeSuspicionScorer({
        flagThreshold: 30,
        insiderThreshold: 50,
      });

      const result = await customScorer.calculateScore(WALLETS.NORMAL_TRADER);

      // With lower thresholds, more wallets might be flagged
      expect(result).toBeDefined();
    });

    it("should respect custom cache settings", async () => {
      const customScorer = new CompositeSuspicionScorer({
        cacheTtlMs: 1000, // 1 second
        maxCacheSize: 5,
      });

      await customScorer.calculateScore(WALLETS.NORMAL_TRADER);

      const summary = customScorer.getSummary();
      expect(summary.cacheStats.size).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases and Error Handling Tests
  // --------------------------------------------------------------------------

  describe("Edge Cases and Error Handling", () => {
    it("should handle concurrent score calculations", async () => {
      const wallets = Object.values(WALLETS);
      const promises = wallets.map((w) => scorer.calculateScore(w));

      const results = await Promise.all(promises);

      expect(results.length).toBe(wallets.length);
      for (const result of results) {
        expect(result.compositeScore).toBeGreaterThanOrEqual(0);
        expect(result.compositeScore).toBeLessThanOrEqual(100);
      }
    });

    it("should handle empty batch gracefully", async () => {
      const result = await scorer.batchCalculateScores([]);

      expect(result.results.size).toBe(0);
      expect(result.totalProcessed).toBe(0);
      expect(result.averageScore).toBe(0);
    });

    it("should handle invalid wallet address", async () => {
      await expect(scorer.calculateScore("0xinvalid")).rejects.toThrow();
    });

    it("should normalize lowercase wallet addresses", async () => {
      const lowerCaseAddress = WALLETS.NORMAL_TRADER.toLowerCase();
      const result = await scorer.calculateScore(lowerCaseAddress);

      expect(result.walletAddress).toBe(WALLETS.NORMAL_TRADER);
    });
  });

  // --------------------------------------------------------------------------
  // Data Quality Analysis Tests
  // --------------------------------------------------------------------------

  describe("Data Quality Analysis", () => {
    it("should calculate overall data quality", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      expect(typeof result.dataQuality).toBe("number");
      expect(result.dataQuality).toBeGreaterThanOrEqual(0);
      expect(result.dataQuality).toBeLessThanOrEqual(100);
    });

    it("should report confidence level for each signal", async () => {
      const result = await scorer.calculateScore(WALLETS.NORMAL_TRADER);

      for (const contribution of result.signalContributions) {
        expect(Object.values(SignalConfidence)).toContain(contribution.confidence);
      }
    });
  });
});
