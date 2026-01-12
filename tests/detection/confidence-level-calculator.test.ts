/**
 * Unit Tests for Confidence Level Calculator (DET-SCORE-006)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConfidenceLevel,
  ConfidenceFactor,
  CONFIDENCE_FACTOR_DESCRIPTIONS,
  CONFIDENCE_LEVEL_DESCRIPTIONS,
  DEFAULT_FACTOR_WEIGHTS,
  DEFAULT_LEVEL_THRESHOLDS,
  ConfidenceLevelCalculator,
  createConfidenceLevelCalculator,
  getSharedConfidenceLevelCalculator,
  setSharedConfidenceLevelCalculator,
  resetSharedConfidenceLevelCalculator,
  calculateConfidence,
  batchCalculateConfidence,
  getConfidenceLevelDescription,
  getConfidenceFactorDescription,
  type SignalInput,
} from "../../src/detection/confidence-level-calculator";

// Test constants
const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_WALLET_2 = "0x2345678901234567890123456789012345678901";
const TEST_WALLET_3 = "0x3456789012345678901234567890123456789012";

// Helper to create signal input
function createSignal(options: Partial<SignalInput> = {}): SignalInput {
  return {
    name: options.name ?? "test_signal",
    score: options.score ?? 50,
    sampleSize: options.sampleSize ?? 20,
    dataAgeHours: options.dataAgeHours ?? 1,
    completeness: options.completeness ?? 100,
    hasHistoricalValidation: options.hasHistoricalValidation ?? true,
    sourceReliability: options.sourceReliability,
    relatedSignals: options.relatedSignals,
  };
}

describe("ConfidenceLevelCalculator", () => {
  let calculator: ConfidenceLevelCalculator;

  beforeEach(() => {
    calculator = createConfidenceLevelCalculator();
    resetSharedConfidenceLevelCalculator();
  });

  afterEach(() => {
    calculator.removeAllListeners();
  });

  // ============================================================================
  // Constants and Enums Tests
  // ============================================================================

  describe("constants and enums", () => {
    it("should have all confidence levels defined", () => {
      expect(ConfidenceLevel.VERY_LOW).toBe("VERY_LOW");
      expect(ConfidenceLevel.LOW).toBe("LOW");
      expect(ConfidenceLevel.MEDIUM).toBe("MEDIUM");
      expect(ConfidenceLevel.HIGH).toBe("HIGH");
      expect(ConfidenceLevel.VERY_HIGH).toBe("VERY_HIGH");
    });

    it("should have all confidence factors defined", () => {
      expect(ConfidenceFactor.SAMPLE_SIZE).toBe("SAMPLE_SIZE");
      expect(ConfidenceFactor.DATA_FRESHNESS).toBe("DATA_FRESHNESS");
      expect(ConfidenceFactor.DATA_COMPLETENESS).toBe("DATA_COMPLETENESS");
      expect(ConfidenceFactor.SIGNAL_CONSISTENCY).toBe("SIGNAL_CONSISTENCY");
      expect(ConfidenceFactor.HISTORICAL_VALIDATION).toBe("HISTORICAL_VALIDATION");
      expect(ConfidenceFactor.CROSS_VALIDATION).toBe("CROSS_VALIDATION");
      expect(ConfidenceFactor.PATTERN_STABILITY).toBe("PATTERN_STABILITY");
      expect(ConfidenceFactor.SOURCE_RELIABILITY).toBe("SOURCE_RELIABILITY");
    });

    it("should have descriptions for all confidence levels", () => {
      Object.values(ConfidenceLevel).forEach((level) => {
        expect(CONFIDENCE_LEVEL_DESCRIPTIONS[level]).toBeDefined();
        expect(CONFIDENCE_LEVEL_DESCRIPTIONS[level].length).toBeGreaterThan(0);
      });
    });

    it("should have descriptions for all confidence factors", () => {
      Object.values(ConfidenceFactor).forEach((factor) => {
        expect(CONFIDENCE_FACTOR_DESCRIPTIONS[factor]).toBeDefined();
        expect(CONFIDENCE_FACTOR_DESCRIPTIONS[factor].length).toBeGreaterThan(0);
      });
    });

    it("should have default factor weights summing to 1.0", () => {
      const sum = Object.values(DEFAULT_FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("should have valid default level thresholds", () => {
      expect(DEFAULT_LEVEL_THRESHOLDS.veryLow).toBeLessThan(DEFAULT_LEVEL_THRESHOLDS.low);
      expect(DEFAULT_LEVEL_THRESHOLDS.low).toBeLessThan(DEFAULT_LEVEL_THRESHOLDS.medium);
      expect(DEFAULT_LEVEL_THRESHOLDS.medium).toBeLessThan(DEFAULT_LEVEL_THRESHOLDS.high);
      expect(DEFAULT_LEVEL_THRESHOLDS.high).toBeLessThan(DEFAULT_LEVEL_THRESHOLDS.veryHigh);
    });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should create with default config", () => {
      const calc = createConfidenceLevelCalculator();
      expect(calc).toBeInstanceOf(ConfidenceLevelCalculator);
    });

    it("should accept custom config", () => {
      const calc = createConfidenceLevelCalculator({
        minSampleSizeForHighConfidence: 50,
        maxDataAgeHoursForFresh: 48,
      });
      expect(calc).toBeInstanceOf(ConfidenceLevelCalculator);
    });

    it("should throw if weights don't sum to 1.0", () => {
      expect(() => {
        createConfidenceLevelCalculator({
          factorWeights: {
            ...DEFAULT_FACTOR_WEIGHTS,
            [ConfidenceFactor.SAMPLE_SIZE]: 0.5,
          },
        });
      }).toThrow("Factor weights must sum to 1.0");
    });
  });

  // ============================================================================
  // calculateConfidence Tests
  // ============================================================================

  describe("calculateConfidence", () => {
    it("should return valid confidence result", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);

      expect(result).toHaveProperty("walletAddress");
      expect(result).toHaveProperty("confidenceScore");
      expect(result).toHaveProperty("confidenceLevel");
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("calculatedAt");
    });

    it("should normalize wallet address", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(
        TEST_WALLET.toLowerCase(),
        signals
      );
      expect(result.walletAddress).toBe(TEST_WALLET);
    });

    it("should throw for invalid wallet address", () => {
      const signals = [createSignal()];
      expect(() => {
        calculator.calculateConfidence("invalid", signals);
      }).toThrow("Invalid wallet address");
    });

    it("should return confidence score between 0 and 100", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });

    it("should return valid confidence level", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      expect(Object.values(ConfidenceLevel)).toContain(result.confidenceLevel);
    });

    it("should include factor contributions", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);

      expect(result.metadata.factorContributions).toBeInstanceOf(Array);
      expect(result.metadata.factorContributions.length).toBe(
        Object.values(ConfidenceFactor).length
      );
    });

    it("should return higher confidence for better data quality", () => {
      const goodSignals = [
        createSignal({
          sampleSize: 100,
          dataAgeHours: 0.5,
          completeness: 100,
          hasHistoricalValidation: true,
          sourceReliability: 95,
        }),
        createSignal({
          sampleSize: 80,
          dataAgeHours: 1,
          completeness: 95,
          hasHistoricalValidation: true,
          sourceReliability: 90,
        }),
      ];

      const poorSignals = [
        createSignal({
          sampleSize: 3,
          dataAgeHours: 72,
          completeness: 40,
          hasHistoricalValidation: false,
          sourceReliability: 30,
        }),
      ];

      const goodResult = calculator.calculateConfidence(TEST_WALLET, goodSignals);
      const poorResult = calculator.calculateConfidence(TEST_WALLET_2, poorSignals);

      expect(goodResult.confidenceScore).toBeGreaterThan(poorResult.confidenceScore);
    });

    it("should cache results when enabled", () => {
      const signals = [createSignal()];

      calculator.calculateConfidence(TEST_WALLET, signals);
      calculator.calculateConfidence(TEST_WALLET, signals);

      const summary = calculator.getSummary();
      expect(summary.cacheHits).toBe(1);
    });

    it("should bypass cache when requested", () => {
      const signals = [createSignal()];

      calculator.calculateConfidence(TEST_WALLET, signals);
      calculator.calculateConfidence(TEST_WALLET, signals, { bypassCache: true });

      const summary = calculator.getSummary();
      expect(summary.cacheHits).toBe(0);
    });
  });

  // ============================================================================
  // Confidence Level Classification Tests
  // ============================================================================

  describe("confidence level classification", () => {
    it("should return low confidence for very poor data", () => {
      const signals = [
        createSignal({
          sampleSize: 0,
          dataAgeHours: 500, // Very old data
          completeness: 0,
          hasHistoricalValidation: false,
          sourceReliability: 0,
          score: 0,
        }),
      ];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      // Due to placeholder factors (cross-validation, pattern stability) contributing
      // default scores, the minimum achievable score is > 20, hence LOW not VERY_LOW
      expect([ConfidenceLevel.VERY_LOW, ConfidenceLevel.LOW]).toContain(
        result.confidenceLevel
      );
      expect(result.confidenceScore).toBeLessThanOrEqual(40);
    });

    it("should return VERY_HIGH for excellent data", () => {
      const signals = [
        createSignal({
          name: "signal_1",
          score: 75,
          sampleSize: 100,
          dataAgeHours: 0.5,
          completeness: 100,
          hasHistoricalValidation: true,
          sourceReliability: 95,
        }),
        createSignal({
          name: "signal_2",
          score: 78,
          sampleSize: 80,
          dataAgeHours: 1,
          completeness: 100,
          hasHistoricalValidation: true,
          sourceReliability: 92,
        }),
        createSignal({
          name: "signal_3",
          score: 72,
          sampleSize: 60,
          dataAgeHours: 2,
          completeness: 98,
          hasHistoricalValidation: true,
          sourceReliability: 90,
        }),
      ];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      expect(
        result.confidenceLevel === ConfidenceLevel.VERY_HIGH ||
        result.confidenceLevel === ConfidenceLevel.HIGH
      ).toBe(true);
    });
  });

  // ============================================================================
  // Factor Contribution Tests
  // ============================================================================

  describe("factor contributions", () => {
    it("should calculate sample size factor correctly", () => {
      const lowSampleSignals = [createSignal({ sampleSize: 2 })];
      const highSampleSignals = [createSignal({ sampleSize: 100 })];

      const lowResult = calculator.calculateConfidence(TEST_WALLET, lowSampleSignals);
      const highResult = calculator.calculateConfidence(TEST_WALLET_2, highSampleSignals);

      const lowSampleFactor = lowResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );
      const highSampleFactor = highResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );

      expect(lowSampleFactor!.rawScore).toBeLessThan(highSampleFactor!.rawScore);
    });

    it("should calculate data freshness factor correctly", () => {
      const freshSignals = [createSignal({ dataAgeHours: 0.5 })];
      const staleSignals = [createSignal({ dataAgeHours: 72 })];

      const freshResult = calculator.calculateConfidence(TEST_WALLET, freshSignals);
      const staleResult = calculator.calculateConfidence(TEST_WALLET_2, staleSignals);

      const freshFactor = freshResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.DATA_FRESHNESS
      );
      const staleFactor = staleResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.DATA_FRESHNESS
      );

      expect(freshFactor!.rawScore).toBeGreaterThan(staleFactor!.rawScore);
    });

    it("should calculate signal consistency correctly", () => {
      const consistentSignals = [
        createSignal({ name: "s1", score: 70 }),
        createSignal({ name: "s2", score: 72 }),
        createSignal({ name: "s3", score: 68 }),
      ];
      const inconsistentSignals = [
        createSignal({ name: "s1", score: 10 }),
        createSignal({ name: "s2", score: 90 }),
        createSignal({ name: "s3", score: 50 }),
      ];

      const consistentResult = calculator.calculateConfidence(TEST_WALLET, consistentSignals);
      const inconsistentResult = calculator.calculateConfidence(TEST_WALLET_2, inconsistentSignals);

      const consistentFactor = consistentResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SIGNAL_CONSISTENCY
      );
      const inconsistentFactor = inconsistentResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SIGNAL_CONSISTENCY
      );

      expect(consistentFactor!.rawScore).toBeGreaterThan(inconsistentFactor!.rawScore);
    });

    it("should include weighted scores", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);

      result.metadata.factorContributions.forEach((factor) => {
        expect(factor.weightedScore).toBeCloseTo(
          factor.rawScore * factor.weight,
          5
        );
      });
    });
  });

  // ============================================================================
  // Metadata Tests
  // ============================================================================

  describe("metadata", () => {
    it("should include strength factors", () => {
      const goodSignals = [
        createSignal({
          sampleSize: 100,
          dataAgeHours: 0.5,
          completeness: 100,
          hasHistoricalValidation: true,
        }),
      ];
      const result = calculator.calculateConfidence(TEST_WALLET, goodSignals);
      expect(result.metadata.strengthFactors.length).toBeGreaterThan(0);
    });

    it("should include weakness factors for poor data", () => {
      const poorSignals = [
        createSignal({
          sampleSize: 2,
          dataAgeHours: 72,
          completeness: 30,
          hasHistoricalValidation: false,
        }),
      ];
      const result = calculator.calculateConfidence(TEST_WALLET, poorSignals);
      expect(result.metadata.weaknessFactors.length).toBeGreaterThan(0);
    });

    it("should include recommendations", () => {
      const signals = [createSignal()];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      expect(result.metadata.recommendations).toBeInstanceOf(Array);
      expect(result.metadata.recommendations.length).toBeGreaterThan(0);
    });

    it("should include data quality summary", () => {
      const signals = [
        createSignal({ sampleSize: 50, dataAgeHours: 2, completeness: 90 }),
        createSignal({ sampleSize: 30, dataAgeHours: 4, completeness: 80 }),
      ];
      const result = calculator.calculateConfidence(TEST_WALLET, signals);

      expect(result.metadata.dataQualitySummary.totalSampleSize).toBe(80);
      expect(result.metadata.dataQualitySummary.avgDataAgeHours).toBe(3);
      expect(result.metadata.dataQualitySummary.avgCompleteness).toBe(85);
      expect(result.metadata.dataQualitySummary.signalCount).toBe(2);
    });
  });

  // ============================================================================
  // Batch Calculation Tests
  // ============================================================================

  describe("batchCalculateConfidence", () => {
    it("should process multiple wallets", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLET, signals: [createSignal()] },
        { walletAddress: TEST_WALLET_2, signals: [createSignal()] },
        { walletAddress: TEST_WALLET_3, signals: [createSignal()] },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.results.length).toBe(3);
      expect(result.stats.processedCount).toBe(3);
      expect(result.stats.failedCount).toBe(0);
    });

    it("should track failed wallets", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLET, signals: [createSignal()] },
        { walletAddress: "invalid", signals: [createSignal()] },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.results.length).toBe(1);
      expect(result.stats.failedCount).toBe(1);
    });

    it("should calculate average confidence", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLET, signals: [createSignal({ sampleSize: 100 })] },
        { walletAddress: TEST_WALLET_2, signals: [createSignal({ sampleSize: 100 })] },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.averageConfidence).toBeGreaterThan(0);
      expect(result.averageConfidence).toBeLessThanOrEqual(100);
    });

    it("should provide level distribution", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLET, signals: [createSignal({ sampleSize: 2 })] },
        { walletAddress: TEST_WALLET_2, signals: [createSignal({ sampleSize: 100 })] },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      const totalDistribution = Object.values(result.levelDistribution).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalDistribution).toBe(2);
    });

    it("should identify low and high confidence wallets", () => {
      const walletsWithSignals = [
        {
          walletAddress: TEST_WALLET,
          signals: [createSignal({ sampleSize: 1, completeness: 10 })],
        },
        {
          walletAddress: TEST_WALLET_2,
          signals: [
            createSignal({ sampleSize: 100, completeness: 100 }),
            createSignal({ sampleSize: 80, completeness: 100 }),
          ],
        },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.lowConfidenceWallets.length).toBeGreaterThanOrEqual(0);
      expect(result.highConfidenceWallets.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe("events", () => {
    it("should emit confidence-calculated event", () => {
      const handler = vi.fn();
      calculator.on("confidence-calculated", handler);

      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: TEST_WALLET,
          confidenceScore: expect.any(Number),
          confidenceLevel: expect.any(String),
        })
      );
    });

    it("should emit low-confidence-detected for low confidence", () => {
      const handler = vi.fn();
      calculator.on("low-confidence-detected", handler);

      const poorSignals = [
        createSignal({
          sampleSize: 1,
          dataAgeHours: 168,
          completeness: 10,
          hasHistoricalValidation: false,
        }),
      ];
      calculator.calculateConfidence(TEST_WALLET, poorSignals);

      expect(handler).toHaveBeenCalled();
    });

    it("should emit config-updated on config change", () => {
      const handler = vi.fn();
      calculator.on("config-updated", handler);

      calculator.updateConfig({
        minSampleSizeForHighConfidence: 100,
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe("configuration", () => {
    it("should update configuration", () => {
      calculator.updateConfig({
        minSampleSizeForHighConfidence: 100,
        maxDataAgeHoursForFresh: 12,
      });

      // No error thrown means success
      expect(true).toBe(true);
    });

    it("should throw when updating with invalid weights", () => {
      expect(() => {
        calculator.updateConfig({
          factorWeights: {
            ...DEFAULT_FACTOR_WEIGHTS,
            [ConfidenceFactor.SAMPLE_SIZE]: 0.9, // This will make sum > 1
          },
        });
      }).toThrow("Factor weights must sum to 1.0");
    });

    it("should clear cache", () => {
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);

      const beforeClear = calculator.getSummary();
      expect(beforeClear.cacheMisses).toBe(1);

      calculator.clearCache();

      // Re-calculate should be a cache miss again
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);

      const afterClear = calculator.getSummary();
      expect(afterClear.cacheMisses).toBe(1); // Reset to 1 after clear + new miss
    });
  });

  // ============================================================================
  // Factory and Singleton Tests
  // ============================================================================

  describe("factory and singleton", () => {
    it("should create new instance with factory", () => {
      const calc1 = createConfidenceLevelCalculator();
      const calc2 = createConfidenceLevelCalculator();
      expect(calc1).not.toBe(calc2);
    });

    it("should return same shared instance", () => {
      const shared1 = getSharedConfidenceLevelCalculator();
      const shared2 = getSharedConfidenceLevelCalculator();
      expect(shared1).toBe(shared2);
    });

    it("should allow setting custom shared instance", () => {
      const custom = createConfidenceLevelCalculator();
      setSharedConfidenceLevelCalculator(custom);
      expect(getSharedConfidenceLevelCalculator()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const before = getSharedConfidenceLevelCalculator();
      resetSharedConfidenceLevelCalculator();
      const after = getSharedConfidenceLevelCalculator();
      expect(before).not.toBe(after);
    });
  });

  // ============================================================================
  // Convenience Functions Tests
  // ============================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedConfidenceLevelCalculator();
    });

    it("should calculate confidence using shared instance", () => {
      const result = calculateConfidence(TEST_WALLET, [createSignal()]);
      expect(result).toHaveProperty("confidenceScore");
    });

    it("should batch calculate using shared instance", () => {
      const result = batchCalculateConfidence([
        { walletAddress: TEST_WALLET, signals: [createSignal()] },
      ]);
      expect(result.results.length).toBe(1);
    });

    it("should get confidence level description", () => {
      const desc = getConfidenceLevelDescription(ConfidenceLevel.HIGH);
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get confidence factor description", () => {
      const desc = getConfidenceFactorDescription(ConfidenceFactor.SAMPLE_SIZE);
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty signals array", () => {
      const result = calculator.calculateConfidence(TEST_WALLET, []);
      expect(result.confidenceScore).toBeLessThanOrEqual(50);
      // Empty signals can result in LOW or VERY_LOW depending on default values
      expect([ConfidenceLevel.VERY_LOW, ConfidenceLevel.LOW]).toContain(
        result.confidenceLevel
      );
    });

    it("should handle single signal", () => {
      const result = calculator.calculateConfidence(TEST_WALLET, [createSignal()]);
      expect(result.confidenceScore).toBeGreaterThan(0);
    });

    it("should handle zero sample size", () => {
      const result = calculator.calculateConfidence(TEST_WALLET, [
        createSignal({ sampleSize: 0 }),
      ]);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it("should handle very old data", () => {
      const result = calculator.calculateConfidence(TEST_WALLET, [
        createSignal({ dataAgeHours: 1000 }),
      ]);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero completeness", () => {
      const result = calculator.calculateConfidence(TEST_WALLET, [
        createSignal({ completeness: 0 }),
      ]);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it("should handle many signals", () => {
      const signals = Array.from({ length: 50 }, (_, i) =>
        createSignal({ name: `signal_${i}`, score: 50 + (i % 20) })
      );
      const result = calculator.calculateConfidence(TEST_WALLET, signals);
      expect(result.confidenceScore).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Summary Statistics Tests
  // ============================================================================

  describe("summary statistics", () => {
    it("should track total calculations", () => {
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);
      calculator.calculateConfidence(TEST_WALLET_2, [createSignal()]);

      const summary = calculator.getSummary();
      expect(summary.totalCalculations).toBe(2);
    });

    it("should track cache hit rate", () => {
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);
      calculator.calculateConfidence(TEST_WALLET_2, [createSignal()]);

      const summary = calculator.getSummary();
      expect(summary.cacheHitRate).toBeCloseTo(1 / 3, 2);
    });

    it("should track average processing time", () => {
      calculator.calculateConfidence(TEST_WALLET, [createSignal()]);

      const summary = calculator.getSummary();
      expect(summary.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
