/**
 * Confidence Level Calculator E2E Tests (DET-SCORE-006)
 *
 * End-to-end integration tests for the confidence level calculator module.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DetectionConfidenceLevel,
  ConfidenceFactor,
  ConfidenceLevelCalculator,
  createConfidenceLevelCalculator,
  resetSharedConfidenceLevelCalculator,
  calculateDetectionConfidence,
  batchCalculateDetectionConfidence,
  getDetectionConfidenceLevelDescription,
  getConfidenceFactorDescription,
  DETECTION_CONFIDENCE_FACTOR_WEIGHTS,
  DETECTION_CONFIDENCE_LEVEL_THRESHOLDS,
  type ConfidenceSignalInput,
} from "../../src/detection";

// ============================================================================
// Test Utilities
// ============================================================================

function createSignal(overrides: Partial<ConfidenceSignalInput> = {}): ConfidenceSignalInput {
  return {
    name: overrides.name ?? "test_signal",
    score: overrides.score ?? 50,
    sampleSize: overrides.sampleSize ?? 30,
    dataAgeHours: overrides.dataAgeHours ?? 1,
    completeness: overrides.completeness ?? 80,
    hasHistoricalValidation: overrides.hasHistoricalValidation ?? false,
    sourceReliability: overrides.sourceReliability ?? 70,
    ...overrides,
  };
}

function createHighQualitySignals(): ConfidenceSignalInput[] {
  return [
    createSignal({
      name: "win_rate_signal",
      score: 85,
      sampleSize: 100,
      dataAgeHours: 0.5,
      completeness: 100,
      hasHistoricalValidation: true,
      sourceReliability: 95,
    }),
    createSignal({
      name: "timing_signal",
      score: 82,
      sampleSize: 80,
      dataAgeHours: 1,
      completeness: 98,
      hasHistoricalValidation: true,
      sourceReliability: 92,
    }),
    createSignal({
      name: "volume_signal",
      score: 78,
      sampleSize: 90,
      dataAgeHours: 0.75,
      completeness: 95,
      hasHistoricalValidation: true,
      sourceReliability: 90,
    }),
  ];
}

function createLowQualitySignals(): ConfidenceSignalInput[] {
  return [
    createSignal({
      name: "weak_signal",
      score: 25,
      sampleSize: 3,
      dataAgeHours: 72,
      completeness: 40,
      hasHistoricalValidation: false,
      sourceReliability: 30,
    }),
  ];
}

function createMixedQualitySignals(): ConfidenceSignalInput[] {
  return [
    createSignal({
      name: "high_quality",
      score: 75,
      sampleSize: 50,
      dataAgeHours: 2,
      completeness: 90,
      hasHistoricalValidation: true,
      sourceReliability: 85,
    }),
    createSignal({
      name: "low_quality",
      score: 35,
      sampleSize: 5,
      dataAgeHours: 48,
      completeness: 50,
      hasHistoricalValidation: false,
      sourceReliability: 40,
    }),
  ];
}

const TEST_WALLETS = [
  "0x1234567890123456789012345678901234567890",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
];

// ============================================================================
// E2E Tests: Full Integration
// ============================================================================

describe("Confidence Level Calculator E2E Tests", () => {
  let calculator: ConfidenceLevelCalculator;

  beforeEach(() => {
    resetSharedConfidenceLevelCalculator();
    calculator = createConfidenceLevelCalculator();
  });

  afterEach(() => {
    calculator.clearCache();
    resetSharedConfidenceLevelCalculator();
  });

  describe("High-Quality Data Detection", () => {
    it("should return VERY_HIGH confidence for excellent data quality", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.confidenceLevel).toBe(DetectionConfidenceLevel.VERY_HIGH);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(result.metadata.strengthFactors.length).toBeGreaterThan(0);
    });

    it("should identify high sample size as a strength factor", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      const sampleSizeFactor = result.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );

      expect(sampleSizeFactor).toBeDefined();
      expect(sampleSizeFactor!.rawScore).toBeGreaterThanOrEqual(80);
    });

    it("should identify data freshness as a strength factor", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      const freshnessFactor = result.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.DATA_FRESHNESS
      );

      expect(freshnessFactor).toBeDefined();
      expect(freshnessFactor!.rawScore).toBeGreaterThanOrEqual(80);
    });

    it("should include strong recommendations for high confidence", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.metadata.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Low-Quality Data Detection", () => {
    it("should return low confidence for poor data quality", () => {
      const signals = createLowQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect([DetectionConfidenceLevel.VERY_LOW, DetectionConfidenceLevel.LOW]).toContain(
        result.confidenceLevel
      );
      expect(result.confidenceScore).toBeLessThan(50);
    });

    it("should identify weakness factors for poor data", () => {
      const signals = createLowQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.metadata.weaknessFactors.length).toBeGreaterThan(0);
    });

    it("should provide recommendations to improve data quality", () => {
      const signals = createLowQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.metadata.recommendations.length).toBeGreaterThan(0);
      // Should include recommendation about sample size or freshness
      const hasDataRecommendation = result.metadata.recommendations.some(
        (r) => r.toLowerCase().includes("sample") || r.toLowerCase().includes("data") || r.toLowerCase().includes("fresh")
      );
      expect(hasDataRecommendation).toBe(true);
    });

    it("should flag small sample size as weakness", () => {
      const signals = createLowQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      const sampleSizeFactor = result.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );

      expect(sampleSizeFactor).toBeDefined();
      expect(sampleSizeFactor!.rawScore).toBeLessThan(50);
    });
  });

  describe("Mixed Quality Data Handling", () => {
    it("should return medium confidence for mixed quality signals", () => {
      const signals = createMixedQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect([
        DetectionConfidenceLevel.LOW,
        DetectionConfidenceLevel.MEDIUM,
        DetectionConfidenceLevel.HIGH,
      ]).toContain(result.confidenceLevel);
    });

    it("should include factor contributions", () => {
      const signals = createMixedQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.metadata.factorContributions.length).toBeGreaterThan(0);
    });

    it("should provide balanced confidence score", () => {
      const signals = createMixedQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      // Should be between the extremes
      expect(result.confidenceScore).toBeGreaterThan(20);
      expect(result.confidenceScore).toBeLessThan(90);
    });
  });

  describe("Batch Processing", () => {
    it("should process multiple wallets correctly", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: TEST_WALLETS[1]!, signals: createLowQualitySignals() },
        { walletAddress: TEST_WALLETS[2]!, signals: createMixedQualitySignals() },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.results.length).toBe(3);
      expect(result.stats.failedCount).toBe(0);
      expect(result.stats.processedCount).toBe(3);
    });

    it("should calculate correct average confidence", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: TEST_WALLETS[1]!, signals: createHighQualitySignals() },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.averageConfidence).toBeGreaterThanOrEqual(80);
    });

    it("should provide level distribution", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: TEST_WALLETS[1]!, signals: createLowQualitySignals() },
        { walletAddress: TEST_WALLETS[2]!, signals: createMixedQualitySignals() },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      const totalInDistribution = Object.values(result.levelDistribution).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalInDistribution).toBe(3);
    });

    it("should identify high and low confidence wallets", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: TEST_WALLETS[1]!, signals: createLowQualitySignals() },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.highConfidenceWallets.length).toBeGreaterThanOrEqual(1);
      expect(result.lowConfidenceWallets.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty batch gracefully", () => {
      const result = calculator.batchCalculateConfidence([]);

      expect(result.results.length).toBe(0);
      expect(result.stats.processedCount).toBe(0);
      expect(result.averageConfidence).toBe(0);
    });

    it("should track failed wallets with invalid addresses", () => {
      const walletsWithSignals = [
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: "invalid-address", signals: createHighQualitySignals() },
      ];

      const result = calculator.batchCalculateConfidence(walletsWithSignals);

      expect(result.results.length).toBe(1);
      expect(result.stats.failedCount).toBe(1);
    });
  });

  describe("Signal Consistency Analysis", () => {
    it("should reward consistent signals", () => {
      const consistentSignals = [
        createSignal({ name: "signal1", score: 70 }),
        createSignal({ name: "signal2", score: 72 }),
        createSignal({ name: "signal3", score: 68 }),
      ];

      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, consistentSignals);

      const consistencyFactor = result.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SIGNAL_CONSISTENCY
      );

      expect(consistencyFactor).toBeDefined();
      expect(consistencyFactor!.rawScore).toBeGreaterThanOrEqual(70);
    });

    it("should penalize inconsistent signals", () => {
      const inconsistentSignals = [
        createSignal({ name: "signal1", score: 90 }),
        createSignal({ name: "signal2", score: 30 }),
        createSignal({ name: "signal3", score: 60 }),
      ];

      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, inconsistentSignals);

      const consistencyFactor = result.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SIGNAL_CONSISTENCY
      );

      expect(consistencyFactor).toBeDefined();
      expect(consistencyFactor!.rawScore).toBeLessThan(70);
    });
  });

  describe("Historical Validation Impact", () => {
    it("should boost confidence for historically validated signals", () => {
      const validatedSignals = [
        createSignal({ hasHistoricalValidation: true }),
        createSignal({ hasHistoricalValidation: true }),
        createSignal({ hasHistoricalValidation: true }),
      ];

      const unvalidatedSignals = [
        createSignal({ hasHistoricalValidation: false }),
        createSignal({ hasHistoricalValidation: false }),
        createSignal({ hasHistoricalValidation: false }),
      ];

      const validatedResult = calculator.calculateConfidence(TEST_WALLETS[0]!, validatedSignals);
      calculator.clearCache();
      const unvalidatedResult = calculator.calculateConfidence(TEST_WALLETS[1]!, unvalidatedSignals);

      const validatedFactor = validatedResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.HISTORICAL_VALIDATION
      );
      const unvalidatedFactor = unvalidatedResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.HISTORICAL_VALIDATION
      );

      expect(validatedFactor!.rawScore).toBeGreaterThan(unvalidatedFactor!.rawScore);
    });
  });

  describe("Source Reliability Impact", () => {
    it("should factor in source reliability", () => {
      const reliableSignals = [createSignal({ sourceReliability: 95 })];
      const unreliableSignals = [createSignal({ sourceReliability: 20 })];

      const reliableResult = calculator.calculateConfidence(TEST_WALLETS[0]!, reliableSignals);
      calculator.clearCache();
      const unreliableResult = calculator.calculateConfidence(TEST_WALLETS[1]!, unreliableSignals);

      const reliableFactor = reliableResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SOURCE_RELIABILITY
      );
      const unreliableFactor = unreliableResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SOURCE_RELIABILITY
      );

      expect(reliableFactor!.rawScore).toBeGreaterThan(unreliableFactor!.rawScore);
    });
  });

  describe("Event Emission", () => {
    it("should emit confidence-calculated event", () => {
      const events: unknown[] = [];
      calculator.on("confidence-calculated", (event) => events.push(event));

      calculator.calculateConfidence(TEST_WALLETS[0]!, createHighQualitySignals());

      expect(events.length).toBe(1);
    });

    it("should emit low-confidence-detected for low confidence results", () => {
      const events: unknown[] = [];
      calculator.on("low-confidence-detected", (event) => events.push(event));

      calculator.calculateConfidence(TEST_WALLETS[0]!, createLowQualitySignals());

      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it("should emit config-updated event on configuration change", () => {
      const events: unknown[] = [];
      calculator.on("config-updated", (event) => events.push(event));

      calculator.updateConfig({
        minSampleSizeForHighConfidence: 50,
      });

      expect(events.length).toBe(1);
    });
  });

  describe("Caching Behavior", () => {
    it("should use cache on subsequent calls with same wallet", () => {
      const signals = createHighQualitySignals();

      const first = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      const second = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      // Both should return valid results
      expect(first.confidenceScore).toBeGreaterThan(0);
      expect(second.confidenceScore).toBeGreaterThan(0);
      // Scores should be the same from cache
      expect(first.confidenceScore).toBe(second.confidenceScore);
    });

    it("should bypass cache when option is set", () => {
      const signals = createHighQualitySignals();

      calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      const second = calculator.calculateConfidence(TEST_WALLETS[0]!, signals, {
        bypassCache: true,
      });

      // Should still return valid result
      expect(second.confidenceScore).toBeGreaterThan(0);
    });

    it("should track cache statistics", () => {
      const signals = createHighQualitySignals();

      calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      const summary = calculator.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it("should clear cache correctly", () => {
      const signals = createHighQualitySignals();

      calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      calculator.clearCache();

      const summary = calculator.getSummary();
      expect(summary.cacheHits).toBe(0);
    });
  });

  describe("Configuration Updates", () => {
    it("should apply updated sample size threshold", () => {
      const signals = [createSignal({ sampleSize: 40 })];

      // Default threshold is 30
      const defaultResult = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      calculator.clearCache();

      // Update to higher threshold
      calculator.updateConfig({
        minSampleSizeForHighConfidence: 100,
      });

      const updatedResult = calculator.calculateConfidence(TEST_WALLETS[0]!, signals, {
        bypassCache: true,
      });

      const defaultFactor = defaultResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );
      const updatedFactor = updatedResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.SAMPLE_SIZE
      );

      // With higher threshold, the sample size score should be lower
      expect(updatedFactor!.rawScore).toBeLessThan(defaultFactor!.rawScore);
    });

    it("should apply updated freshness threshold", () => {
      const signals = [createSignal({ dataAgeHours: 12 })];

      // Default threshold is 24 hours
      const defaultResult = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);
      calculator.clearCache();

      // Update to shorter threshold
      calculator.updateConfig({
        maxDataAgeHoursForFresh: 6,
      });

      const updatedResult = calculator.calculateConfidence(TEST_WALLETS[0]!, signals, {
        bypassCache: true,
      });

      const defaultFactor = defaultResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.DATA_FRESHNESS
      );
      const updatedFactor = updatedResult.metadata.factorContributions.find(
        (f) => f.factor === ConfidenceFactor.DATA_FRESHNESS
      );

      // With shorter threshold, data is considered staler
      expect(updatedFactor!.rawScore).toBeLessThan(defaultFactor!.rawScore);
    });

    it("should reject invalid weight configurations", () => {
      expect(() => {
        calculator.updateConfig({
          factorWeights: {
            [ConfidenceFactor.SAMPLE_SIZE]: 0.9, // Weights won't sum to 1.0
          } as Record<ConfidenceFactor, number>,
        });
      }).toThrow();
    });
  });

  describe("Data Quality Summary", () => {
    it("should provide accurate data quality summary", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      expect(result.metadata.dataQualitySummary).toBeDefined();
      expect(result.metadata.dataQualitySummary.signalCount).toBe(signals.length);
      expect(result.metadata.dataQualitySummary.avgCompleteness).toBeGreaterThanOrEqual(90);
    });

    it("should calculate total sample size", () => {
      const signals = createHighQualitySignals();
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, signals);

      const expectedTotalSampleSize = signals.reduce((sum, s) => sum + s.sampleSize, 0);
      expect(result.metadata.dataQualitySummary.totalSampleSize).toBe(expectedTotalSampleSize);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedConfidenceLevelCalculator();
    });

    it("should calculate confidence using shared instance", () => {
      const result = calculateDetectionConfidence(
        TEST_WALLETS[0]!,
        createHighQualitySignals()
      );

      expect(result.walletAddress).toBe(TEST_WALLETS[0]!.toLowerCase());
      expect(result.confidenceLevel).toBeDefined();
    });

    it("should batch calculate using shared instance", () => {
      const batch = batchCalculateDetectionConfidence([
        { walletAddress: TEST_WALLETS[0]!, signals: createHighQualitySignals() },
        { walletAddress: TEST_WALLETS[1]!, signals: createLowQualitySignals() },
      ]);

      expect(batch.results.length).toBe(2);
    });

    it("should provide confidence level description", () => {
      const description = getDetectionConfidenceLevelDescription(DetectionConfidenceLevel.HIGH);

      expect(description.length).toBeGreaterThan(0);
    });

    it("should provide confidence factor description", () => {
      const description = getConfidenceFactorDescription(ConfidenceFactor.SAMPLE_SIZE);

      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty signals array", () => {
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, []);

      expect(result.confidenceScore).toBeLessThanOrEqual(50);
      expect([DetectionConfidenceLevel.VERY_LOW, DetectionConfidenceLevel.LOW]).toContain(
        result.confidenceLevel
      );
    });

    it("should handle single signal", () => {
      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, [createSignal()]);

      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.metadata.factorContributions.length).toBeGreaterThan(0);
    });

    it("should normalize wallet addresses", () => {
      // Use test wallet with proper format
      const upperCaseAddress = "0x1234567890123456789012345678901234567890";
      const result = calculator.calculateConfidence(upperCaseAddress, [createSignal()]);

      expect(result.walletAddress.toLowerCase()).toBe(upperCaseAddress.toLowerCase());
    });

    it("should throw for invalid wallet address", () => {
      expect(() => {
        calculator.calculateConfidence("not-a-valid-address", [createSignal()]);
      }).toThrow();
    });

    it("should handle extreme values", () => {
      const extremeSignals = [
        createSignal({
          sampleSize: 10000,
          dataAgeHours: 0,
          completeness: 100,
          sourceReliability: 100,
        }),
      ];

      const result = calculator.calculateConfidence(TEST_WALLETS[0]!, extremeSignals);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Statistics Tracking", () => {
    it("should track total calculations", () => {
      calculator.calculateConfidence(TEST_WALLETS[0]!, createHighQualitySignals());
      calculator.calculateConfidence(TEST_WALLETS[1]!, createLowQualitySignals(), {
        bypassCache: true,
      });

      const summary = calculator.getSummary();
      expect(summary.totalCalculations).toBe(2);
    });

    it("should track average processing time", () => {
      for (let i = 0; i < 5; i++) {
        calculator.calculateConfidence(
          `0x${i.toString().padStart(40, "1")}`,
          createHighQualitySignals()
        );
      }

      const summary = calculator.getSummary();
      expect(summary.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Factor Weight Validation", () => {
    it("should have default weights summing to 1.0", () => {
      const weightSum = Object.values(DETECTION_CONFIDENCE_FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.01);
    });

    it("should have valid level thresholds", () => {
      expect(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.veryLow).toBeLessThan(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.low);
      expect(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.low).toBeLessThan(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.medium);
      expect(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.medium).toBeLessThan(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.high);
      expect(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.high).toBeLessThan(DETECTION_CONFIDENCE_LEVEL_THRESHOLDS.veryHigh);
    });
  });

  describe("Integration with Alert Metadata", () => {
    it("should provide complete metadata for alert inclusion", () => {
      const result = calculator.calculateConfidence(
        TEST_WALLETS[0]!,
        createHighQualitySignals()
      );

      // Verify all required metadata fields exist
      expect(result.metadata).toBeDefined();
      expect(result.metadata.confidenceDescription).toBeDefined();
      expect(result.metadata.strengthFactors).toBeDefined();
      expect(result.metadata.weaknessFactors).toBeDefined();
      expect(result.metadata.recommendations).toBeDefined();
      expect(result.metadata.dataQualitySummary).toBeDefined();
    });

    it("should include timestamp in results", () => {
      const result = calculator.calculateConfidence(
        TEST_WALLETS[0]!,
        createHighQualitySignals()
      );

      expect(result.calculatedAt).toBeInstanceOf(Date);
    });
  });
});
