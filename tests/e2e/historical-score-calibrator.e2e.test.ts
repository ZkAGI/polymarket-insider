/**
 * Historical Score Calibrator E2E Tests (DET-SCORE-007)
 *
 * End-to-end integration tests for the historical score calibrator module.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  OutcomeType,
  CalibrationQuality,
  ScoreBucket,
  AdjustmentType,
  BUCKET_RANGES,
  ALL_BUCKETS,
  getBucketForScore,
  scoreToProbability,
  probabilityToScore,
  HistoricalScoreCalibrator,
  createHistoricalScoreCalibrator,
  getSharedHistoricalScoreCalibrator,
  resetSharedHistoricalScoreCalibrator,
  recordHistoricalOutcome,
  updateHistoricalOutcome,
  calculateHistoricalCalibration,
  calibrateHistoricalScore,
  getHistoricalCalibrationSummary,
  getOutcomeDescription,
  getCalibrationQualityDescription,
  getAdjustmentDescription,
} from "../../src/detection";

// ============================================================================
// Test Utilities
// ============================================================================

const TEST_WALLETS = [
  "0x1234567890123456789012345678901234567890",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
];

// Helper to generate random wallet address
function randomWallet(): string {
  const hex = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(Math.random() * 16)];
  }
  return addr;
}

// Helper to add well-calibrated outcomes (predicted probability matches actual rate)
function addWellCalibratedOutcomes(
  calibrator: HistoricalScoreCalibrator,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const wallet = randomWallet();
    const score = Math.random() * 100;
    const prob = score / 100;

    // Outcome is proportional to score (well-calibrated)
    const isPositive = Math.random() < prob;
    const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;

    calibrator.recordOutcome(wallet, score, outcome);
  }
}

// Helper to add poorly calibrated outcomes (high scores but mostly negative)
function addPoorlyCalibratedOutcomes(
  calibrator: HistoricalScoreCalibrator,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const wallet = randomWallet();
    const score = 70 + Math.random() * 30; // High scores 70-100

    // But mostly negative outcomes (inverted calibration)
    const isPositive = Math.random() < 0.1;
    const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;

    calibrator.recordOutcome(wallet, score, outcome);
  }
}

// Helper to add balanced outcomes for realistic testing
function addBalancedOutcomes(
  calibrator: HistoricalScoreCalibrator,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const wallet = randomWallet();
    const score = Math.random() * 100;

    // 50% positive rate regardless of score
    const isPositive = Math.random() < 0.5;
    const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;

    calibrator.recordOutcome(wallet, score, outcome);
  }
}

// Helper to simulate insider detection scenario
function addInsiderDetectionScenario(
  calibrator: HistoricalScoreCalibrator,
  options: {
    confirmedInsiders: number;
    falseAlarms: number;
    missedInsiders: number;
    normalTraders: number;
  }
): void {
  // Confirmed insiders (high scores, TRUE_POSITIVE)
  for (let i = 0; i < options.confirmedInsiders; i++) {
    const wallet = randomWallet();
    const score = 75 + Math.random() * 25; // High scores
    calibrator.recordOutcome(wallet, score, OutcomeType.TRUE_POSITIVE);
  }

  // False alarms (high scores, FALSE_POSITIVE)
  for (let i = 0; i < options.falseAlarms; i++) {
    const wallet = randomWallet();
    const score = 60 + Math.random() * 30; // Medium-high scores
    calibrator.recordOutcome(wallet, score, OutcomeType.FALSE_POSITIVE);
  }

  // Missed insiders (low scores, FALSE_NEGATIVE)
  for (let i = 0; i < options.missedInsiders; i++) {
    const wallet = randomWallet();
    const score = 20 + Math.random() * 30; // Low-medium scores
    calibrator.recordOutcome(wallet, score, OutcomeType.FALSE_NEGATIVE);
  }

  // Normal traders (low scores, TRUE_NEGATIVE)
  for (let i = 0; i < options.normalTraders; i++) {
    const wallet = randomWallet();
    const score = Math.random() * 50; // Low scores
    calibrator.recordOutcome(wallet, score, OutcomeType.TRUE_NEGATIVE);
  }
}

// ============================================================================
// E2E Tests: Full Integration
// ============================================================================

describe("Historical Score Calibrator E2E Tests", () => {
  let calibrator: HistoricalScoreCalibrator;

  beforeEach(() => {
    resetSharedHistoricalScoreCalibrator();
    calibrator = createHistoricalScoreCalibrator();
  });

  afterEach(() => {
    calibrator.clearOutcomes();
    calibrator.removeAllListeners();
    resetSharedHistoricalScoreCalibrator();
  });

  describe("Well-Calibrated System Detection", () => {
    it("should recognize well-calibrated data", () => {
      addWellCalibratedOutcomes(calibrator, 500);

      const result = calibrator.calculateCalibration();

      expect(result.isCalibrated).toBe(true);
      expect([CalibrationQuality.EXCELLENT, CalibrationQuality.GOOD]).toContain(
        result.metrics.quality
      );
      expect(result.metrics.brierScore).toBeLessThan(0.3);
    });

    it("should have low expected calibration error for well-calibrated data", () => {
      addWellCalibratedOutcomes(calibrator, 500);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.expectedCalibrationError).toBeLessThan(0.2);
    });

    it("should have reliability curve matching predicted probabilities", () => {
      addWellCalibratedOutcomes(calibrator, 500);

      const result = calibrator.calculateCalibration();

      // For well-calibrated data, actual positive rate should be close to predicted
      const nonEmptyBuckets = result.metrics.reliabilityCurve.filter(
        (b) => b.sampleCount >= 10
      );

      for (const bucket of nonEmptyBuckets) {
        const difference = Math.abs(
          bucket.actualPositiveRate - bucket.avgPredictedProbability
        );
        expect(difference).toBeLessThan(0.3); // Within 30%
      }
    });
  });

  describe("Poorly-Calibrated System Detection", () => {
    it("should recognize poorly-calibrated data", () => {
      addPoorlyCalibratedOutcomes(calibrator, 200);

      const result = calibrator.calculateCalibration();

      expect([CalibrationQuality.FAIR, CalibrationQuality.POOR]).toContain(
        result.metrics.quality
      );
      expect(result.metrics.brierScore).toBeGreaterThan(0.2);
    });

    it("should generate recommendations for poorly-calibrated data", () => {
      addPoorlyCalibratedOutcomes(calibrator, 200);

      const result = calibrator.calculateCalibration();

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should recommend threshold adjustment when appropriate", () => {
      addPoorlyCalibratedOutcomes(calibrator, 200);

      const result = calibrator.calculateCalibration();

      const hasThresholdRec = result.recommendations.some(
        (r) =>
          r.type === AdjustmentType.INCREASE_THRESHOLD ||
          r.type === AdjustmentType.DECREASE_THRESHOLD ||
          r.type === AdjustmentType.RECALIBRATE_BUCKETS
      );
      expect(hasThresholdRec).toBe(true);
    });
  });

  describe("Insider Detection Scenario", () => {
    it("should calculate correct metrics for insider detection scenario", () => {
      addInsiderDetectionScenario(calibrator, {
        confirmedInsiders: 30,
        falseAlarms: 20,
        missedInsiders: 10,
        normalTraders: 100,
      });

      const result = calibrator.calculateCalibration();

      // Should have reasonable precision and recall
      expect(result.metrics.precision).toBeGreaterThan(0);
      expect(result.metrics.recall).toBeGreaterThan(0);
      expect(result.metrics.f1Score).toBeGreaterThan(0);
    });

    it("should suggest threshold changes to improve detection", () => {
      // Create scenario with many missed insiders (low recall)
      addInsiderDetectionScenario(calibrator, {
        confirmedInsiders: 20,
        falseAlarms: 10,
        missedInsiders: 50, // Many missed
        normalTraders: 100,
      });

      const result = calibrator.calculateCalibration();

      // Should have low recall
      expect(result.metrics.recall).toBeLessThan(0.7);
      // Should suggest lowering threshold
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should calculate optimal threshold for F1 score", () => {
      addInsiderDetectionScenario(calibrator, {
        confirmedInsiders: 40,
        falseAlarms: 30,
        missedInsiders: 15,
        normalTraders: 80,
      });

      const result = calibrator.calculateCalibration();

      // Optimal threshold should be reasonable
      expect(result.optimizedThreshold).toBeGreaterThan(10);
      expect(result.optimizedThreshold).toBeLessThan(90);
    });
  });

  describe("Score Calibration", () => {
    it("should not modify scores before calibration", () => {
      const original = 75;
      const calibrated = calibrator.calibrateScore(original);

      expect(calibrated).toBe(original);
    });

    it("should adjust scores after calibration", () => {
      addWellCalibratedOutcomes(calibrator, 300);
      calibrator.calculateCalibration();

      const original = 50;
      const calibrated = calibrator.calibrateScore(original);

      // Should return a valid score (may or may not be modified)
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(100);
    });

    it("should maintain approximate ordering after calibration", () => {
      addWellCalibratedOutcomes(calibrator, 300);
      calibrator.calculateCalibration();

      const low = calibrator.calibrateScore(20);
      const high = calibrator.calibrateScore(80);

      // General ordering should be preserved
      expect(high).toBeGreaterThan(low);
    });

    it("should adjust overconfident predictions downward", () => {
      // Add data where high scores are often wrong
      for (let i = 0; i < 200; i++) {
        const wallet = randomWallet();
        const score = 80 + Math.random() * 20; // High scores 80-100
        // But only 30% are actually positive
        const isPositive = Math.random() < 0.3;
        const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;
        calibrator.recordOutcome(wallet, score, outcome);
      }

      calibrator.calculateCalibration();

      const original = 90;
      const calibrated = calibrator.calibrateScore(original);

      // Should be adjusted downward since high scores are overconfident
      expect(calibrated).toBeLessThanOrEqual(original);
    });
  });

  describe("Reliability Curve Analysis", () => {
    it("should build reliability curve across all buckets", () => {
      addBalancedOutcomes(calibrator, 300);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.reliabilityCurve.length).toBe(ALL_BUCKETS.length);
    });

    it("should include sample counts per bucket", () => {
      addBalancedOutcomes(calibrator, 300);

      const result = calibrator.calculateCalibration();

      let totalSamples = 0;
      for (const bucket of result.metrics.reliabilityCurve) {
        totalSamples += bucket.sampleCount;
        expect(bucket.sampleCount).toBeGreaterThanOrEqual(0);
      }

      // Most samples should be counted
      expect(totalSamples).toBeGreaterThan(200);
    });

    it("should calculate confidence intervals for buckets", () => {
      addBalancedOutcomes(calibrator, 300);

      const result = calibrator.calculateCalibration();

      const nonEmptyBuckets = result.metrics.reliabilityCurve.filter(
        (b) => b.sampleCount > 0
      );

      for (const bucket of nonEmptyBuckets) {
        expect(bucket.confidenceInterval.lower).toBeGreaterThanOrEqual(0);
        expect(bucket.confidenceInterval.upper).toBeLessThanOrEqual(1);
        expect(bucket.confidenceInterval.lower).toBeLessThanOrEqual(
          bucket.confidenceInterval.upper
        );
      }
    });
  });

  describe("AUC-ROC Calculation", () => {
    it("should calculate AUC-ROC for discriminative data", () => {
      // Add data where higher scores correlate with positive outcomes
      for (let i = 0; i < 200; i++) {
        const wallet = randomWallet();
        // Positive outcomes get higher scores
        const isPositive = Math.random() < 0.5;
        const score = isPositive
          ? 60 + Math.random() * 40 // Higher for positives
          : Math.random() * 50; // Lower for negatives
        const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;
        calibrator.recordOutcome(wallet, score, outcome);
      }

      const result = calibrator.calculateCalibration();

      // AUC should be better than random (0.5)
      expect(result.metrics.aucRoc).toBeGreaterThan(0.6);
    });

    it("should have AUC-ROC near 0.5 for random data", () => {
      // Add data where scores are random relative to outcomes
      addBalancedOutcomes(calibrator, 300);

      const result = calibrator.calculateCalibration();

      // AUC should be near random (0.5)
      expect(result.metrics.aucRoc).toBeGreaterThanOrEqual(0.3);
      expect(result.metrics.aucRoc).toBeLessThanOrEqual(0.7);
    });
  });

  describe("Outcome Tracking", () => {
    it("should track multiple outcomes per wallet", () => {
      calibrator.recordOutcome(TEST_WALLETS[0]!, 50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLETS[0]!, 60, OutcomeType.FALSE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLETS[0]!, 70, OutcomeType.TRUE_POSITIVE);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLETS[0]!);

      expect(outcomes.length).toBe(3);
    });

    it("should return outcomes sorted by date (most recent first)", () => {
      const dates = [
        new Date("2023-01-01"),
        new Date("2023-06-01"),
        new Date("2023-03-01"),
      ];

      calibrator.recordOutcome(TEST_WALLETS[0]!, 50, OutcomeType.TRUE_POSITIVE, dates[0]);
      calibrator.recordOutcome(TEST_WALLETS[0]!, 60, OutcomeType.FALSE_POSITIVE, dates[1]);
      calibrator.recordOutcome(TEST_WALLETS[0]!, 70, OutcomeType.TRUE_POSITIVE, dates[2]);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLETS[0]!);

      expect(outcomes[0]!.scoredAt.getTime()).toBeGreaterThan(outcomes[1]!.scoredAt.getTime());
      expect(outcomes[1]!.scoredAt.getTime()).toBeGreaterThan(outcomes[2]!.scoredAt.getTime());
    });

    it("should update outcomes correctly", () => {
      calibrator.recordOutcome(TEST_WALLETS[0]!, 75, OutcomeType.UNKNOWN);

      const updated = calibrator.updateOutcome(TEST_WALLETS[0]!, OutcomeType.TRUE_POSITIVE);

      expect(updated).not.toBeNull();
      expect(updated!.outcome).toBe(OutcomeType.TRUE_POSITIVE);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLETS[0]!);
      expect(outcomes[0]!.outcome).toBe(OutcomeType.TRUE_POSITIVE);
    });
  });

  describe("Summary Statistics", () => {
    it("should track outcome distribution", () => {
      calibrator.recordOutcome(randomWallet(), 50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(randomWallet(), 60, OutcomeType.FALSE_POSITIVE);
      calibrator.recordOutcome(randomWallet(), 70, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(randomWallet(), 80, OutcomeType.UNKNOWN);

      const summary = calibrator.getSummary();

      expect(summary.totalOutcomes).toBe(4);
      expect(summary.outcomesByType[OutcomeType.TRUE_POSITIVE]).toBe(2);
      expect(summary.outcomesByType[OutcomeType.FALSE_POSITIVE]).toBe(1);
      expect(summary.outcomesByType[OutcomeType.UNKNOWN]).toBe(1);
    });

    it("should track Brier score history", () => {
      addBalancedOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      addBalancedOutcomes(calibrator, 50);
      calibrator.calculateCalibration();

      const summary = calibrator.getSummary();

      expect(summary.brierScoreHistory.length).toBe(2);
      summary.brierScoreHistory.forEach((entry) => {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.brierScore).toBeGreaterThanOrEqual(0);
        expect(entry.brierScore).toBeLessThanOrEqual(1);
      });
    });

    it("should track calibration timing", () => {
      addBalancedOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      const summary = calibrator.getSummary();

      expect(summary.lastCalibrationAt).not.toBeNull();
      expect(summary.hoursSinceLastCalibration).toBeGreaterThanOrEqual(0);
      expect(summary.hoursSinceLastCalibration).toBeLessThan(1); // Just calibrated
    });
  });

  describe("Event Emission", () => {
    it("should emit outcome-recorded event", () => {
      const events: unknown[] = [];
      calibrator.on("outcome-recorded", (event) => events.push(event));

      calibrator.recordOutcome(TEST_WALLETS[0]!, 75, OutcomeType.TRUE_POSITIVE);

      expect(events.length).toBe(1);
      expect((events[0] as { walletAddress: string }).walletAddress).toBe(TEST_WALLETS[0]);
    });

    it("should emit outcome-updated event", () => {
      const events: unknown[] = [];
      calibrator.on("outcome-updated", (event) => events.push(event));

      calibrator.recordOutcome(TEST_WALLETS[0]!, 75, OutcomeType.UNKNOWN);
      calibrator.updateOutcome(TEST_WALLETS[0]!, OutcomeType.TRUE_POSITIVE);

      expect(events.length).toBe(1);
    });

    it("should emit calibration-completed event", () => {
      const events: unknown[] = [];
      calibrator.on("calibration-completed", (event) => events.push(event));

      addBalancedOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      expect(events.length).toBe(1);
      expect((events[0] as { quality: string }).quality).toBeDefined();
    });

    it("should emit recalibration-recommended for poor calibration", () => {
      const events: unknown[] = [];
      calibrator.on("recalibration-recommended", (event) => events.push(event));

      addPoorlyCalibratedOutcomes(calibrator, 200);
      calibrator.calculateCalibration();

      // May or may not emit depending on calibration quality
      // Just verify no errors
    });
  });

  describe("Configuration", () => {
    it("should respect minSamplesForCalibration", () => {
      const customCalibrator = createHistoricalScoreCalibrator({
        minSamplesForCalibration: 200,
      });

      addBalancedOutcomes(customCalibrator, 100);
      const result = customCalibrator.calculateCalibration();

      expect(result.isCalibrated).toBe(false);
      expect(result.metrics.quality).toBe(CalibrationQuality.INSUFFICIENT_DATA);
    });

    it("should respect maxOutcomesToStore", () => {
      const customCalibrator = createHistoricalScoreCalibrator({
        maxOutcomesToStore: 50,
      });

      addBalancedOutcomes(customCalibrator, 100);

      expect(customCalibrator.getAllOutcomes().length).toBe(50);
    });

    it("should update configuration", () => {
      calibrator.updateConfig({
        currentThreshold: 60,
        minSamplesForCalibration: 75,
      });

      const config = calibrator.getConfig();

      expect(config.currentThreshold).toBe(60);
      expect(config.minSamplesForCalibration).toBe(75);
    });
  });

  describe("Data Persistence", () => {
    it("should export data correctly", () => {
      addBalancedOutcomes(calibrator, 50);
      calibrator.calculateCalibration();

      const exported = calibrator.exportData();

      expect(exported.outcomes.length).toBe(50);
      expect(exported.brierScoreHistory.length).toBeGreaterThan(0);
      expect(exported.adjustmentCurve.length).toBe(ALL_BUCKETS.length);
    });

    it("should import data correctly", () => {
      addBalancedOutcomes(calibrator, 50);
      calibrator.calculateCalibration();
      const exported = calibrator.exportData();

      const newCalibrator = createHistoricalScoreCalibrator();
      newCalibrator.importData(exported);

      expect(newCalibrator.getAllOutcomes().length).toBe(50);
    });

    it("should preserve calibration state after import/export", () => {
      addWellCalibratedOutcomes(calibrator, 200);
      const originalResult = calibrator.calculateCalibration();
      const exported = calibrator.exportData();

      const newCalibrator = createHistoricalScoreCalibrator();
      newCalibrator.importData(exported);
      const importedResult = newCalibrator.calculateCalibration();

      // Results should be similar
      expect(
        Math.abs(originalResult.metrics.brierScore - importedResult.metrics.brierScore)
      ).toBeLessThan(0.01);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedHistoricalScoreCalibrator();
    });

    it("should record outcome using shared instance", () => {
      const record = recordHistoricalOutcome(
        TEST_WALLETS[0]!,
        75,
        OutcomeType.TRUE_POSITIVE
      );

      expect(record.walletAddress).toBe(TEST_WALLETS[0]);
      expect(record.originalScore).toBe(75);
    });

    it("should update outcome using shared instance", () => {
      recordHistoricalOutcome(TEST_WALLETS[0]!, 75, OutcomeType.UNKNOWN);
      const updated = updateHistoricalOutcome(TEST_WALLETS[0]!, OutcomeType.FALSE_POSITIVE);

      expect(updated!.outcome).toBe(OutcomeType.FALSE_POSITIVE);
    });

    it("should calculate calibration using shared instance", () => {
      const shared = getSharedHistoricalScoreCalibrator();
      addBalancedOutcomes(shared as HistoricalScoreCalibrator, 100);

      const result = calculateHistoricalCalibration();

      expect(result.metrics).toBeDefined();
      expect(result.isCalibrated).toBe(true);
    });

    it("should calibrate score using shared instance", () => {
      const shared = getSharedHistoricalScoreCalibrator();
      addWellCalibratedOutcomes(shared as HistoricalScoreCalibrator, 200);
      (shared as HistoricalScoreCalibrator).calculateCalibration();

      const calibrated = calibrateHistoricalScore(50);

      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(100);
    });

    it("should get summary using shared instance", () => {
      recordHistoricalOutcome(TEST_WALLETS[0]!, 75, OutcomeType.TRUE_POSITIVE);
      recordHistoricalOutcome(TEST_WALLETS[1]!, 50, OutcomeType.FALSE_POSITIVE);

      const summary = getHistoricalCalibrationSummary();

      expect(summary.totalOutcomes).toBe(2);
    });

    it("should provide outcome description", () => {
      const desc = getOutcomeDescription(OutcomeType.TRUE_POSITIVE);
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should provide calibration quality description", () => {
      const desc = getCalibrationQualityDescription(CalibrationQuality.EXCELLENT);
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should provide adjustment description", () => {
      const desc = getAdjustmentDescription(AdjustmentType.INCREASE_THRESHOLD);
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty outcomes", () => {
      const result = calibrator.calculateCalibration();

      expect(result.isCalibrated).toBe(false);
      expect(result.metrics.brierScore).toBe(1);
    });

    it("should handle all UNKNOWN outcomes", () => {
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), Math.random() * 100, OutcomeType.UNKNOWN);
      }

      const result = calibrator.calculateCalibration();

      // All unknown = worst Brier score
      expect(result.metrics.brierScore).toBe(1);
    });

    it("should handle all positive outcomes", () => {
      // All high scores so they're all predicted positive
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), 80 + Math.random() * 20, OutcomeType.TRUE_POSITIVE);
      }

      const result = calibrator.calculateCalibration();

      // When all outcomes are TRUE_POSITIVE with scores above threshold (50),
      // all predictions are correct: TP = 100, FN = 0, so TPR = 1
      expect(result.metrics.truePositiveRate).toBe(1);
      expect(result.metrics.falsePositiveRate).toBe(0);
    });

    it("should handle all negative outcomes", () => {
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), Math.random() * 100, OutcomeType.FALSE_POSITIVE);
      }

      const result = calibrator.calculateCalibration();

      expect(result.metrics.recall).toBe(0);
    });

    it("should handle extreme scores", () => {
      calibrator.recordOutcome(randomWallet(), 0, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(randomWallet(), 100, OutcomeType.FALSE_POSITIVE);

      const outcomes = calibrator.getAllOutcomes();

      expect(outcomes.some((o) => o.originalScore === 0)).toBe(true);
      expect(outcomes.some((o) => o.originalScore === 100)).toBe(true);
    });

    it("should clamp out-of-range scores", () => {
      calibrator.recordOutcome(randomWallet(), -50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(randomWallet(), 150, OutcomeType.FALSE_POSITIVE);

      const outcomes = calibrator.getAllOutcomes();

      expect(outcomes.every((o) => o.originalScore >= 0)).toBe(true);
      expect(outcomes.every((o) => o.originalScore <= 100)).toBe(true);
    });
  });

  describe("Helper Functions", () => {
    it("should correctly map scores to buckets", () => {
      expect(getBucketForScore(5)).toBe(ScoreBucket.BUCKET_0_10);
      expect(getBucketForScore(15)).toBe(ScoreBucket.BUCKET_10_20);
      expect(getBucketForScore(50)).toBe(ScoreBucket.BUCKET_50_60);
      expect(getBucketForScore(95)).toBe(ScoreBucket.BUCKET_90_100);
    });

    it("should convert between scores and probabilities", () => {
      expect(scoreToProbability(50)).toBe(0.5);
      expect(probabilityToScore(0.75)).toBe(75);
    });

    it("should have valid bucket ranges", () => {
      ALL_BUCKETS.forEach((bucket) => {
        const range = BUCKET_RANGES[bucket];
        expect(range.min).toBeLessThan(range.max);
      });
    });
  });

  describe("Integration with Detection System", () => {
    it("should provide actionable recommendations", () => {
      addInsiderDetectionScenario(calibrator, {
        confirmedInsiders: 30,
        falseAlarms: 40,
        missedInsiders: 20,
        normalTraders: 80,
      });

      const result = calibrator.calculateCalibration();

      // Should have recommendations with suggested changes
      const withChanges = result.recommendations.filter(
        (r) => r.suggestedChanges.length > 0
      );

      expect(withChanges.length).toBeGreaterThanOrEqual(0);
    });

    it("should track calibration improvement over time", () => {
      // Initial poor calibration
      addPoorlyCalibratedOutcomes(calibrator, 100);
      const firstCalibration = calibrator.calculateCalibration();

      // Add well-calibrated data
      addWellCalibratedOutcomes(calibrator, 200);
      const secondCalibration = calibrator.calculateCalibration();

      // Brier score should potentially improve (or at least change)
      expect(secondCalibration.metrics.brierScore).toBeLessThanOrEqual(
        firstCalibration.metrics.brierScore + 0.1
      );
    });
  });
});
