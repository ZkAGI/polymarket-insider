/**
 * Unit Tests for Historical Score Calibrator (DET-SCORE-007)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OutcomeType,
  CalibrationQuality,
  ScoreBucket,
  AdjustmentType,
  OUTCOME_DESCRIPTIONS,
  CALIBRATION_QUALITY_DESCRIPTIONS,
  ADJUSTMENT_DESCRIPTIONS,
  BUCKET_RANGES,
  ALL_BUCKETS,
  DEFAULT_CALIBRATOR_CONFIG,
  getBucketForScore,
  scoreToProbability,
  probabilityToScore,
  HistoricalScoreCalibrator,
  createHistoricalScoreCalibrator,
  getSharedHistoricalScoreCalibrator,
  setSharedHistoricalScoreCalibrator,
  resetSharedHistoricalScoreCalibrator,
  recordHistoricalOutcome,
  updateHistoricalOutcome,
  calculateHistoricalCalibration,
  calibrateHistoricalScore,
  getHistoricalCalibrationSummary,
  getOutcomeDescription,
  getCalibrationQualityDescription,
  getAdjustmentDescription,
} from "../../src/detection/historical-score-calibrator";

// Test constants
const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_WALLET_2 = "0x2345678901234567890123456789012345678901";
const TEST_WALLET_3 = "0x3456789012345678901234567890123456789012";

// Helper to generate random wallet address
function randomWallet(): string {
  const hex = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(Math.random() * 16)];
  }
  return addr;
}

// Helper to add many outcomes for testing calibration
function addManyOutcomes(
  calibrator: HistoricalScoreCalibrator,
  count: number,
  options: {
    scoreRange?: { min: number; max: number };
    truePositiveRate?: number;
  } = {}
): void {
  const { scoreRange = { min: 0, max: 100 }, truePositiveRate = 0.5 } = options;

  for (let i = 0; i < count; i++) {
    const wallet = randomWallet();
    const score =
      scoreRange.min + Math.random() * (scoreRange.max - scoreRange.min);

    // Determine outcome based on score and truePositiveRate
    // Higher scores should have higher probability of true positive
    const prob = score / 100;
    const isPositive = Math.random() < (prob * truePositiveRate * 2);

    const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;

    calibrator.recordOutcome(wallet, score, outcome);
  }
}

// Helper to add calibrated outcomes (where predicted probability matches actual rate)
function addCalibratedOutcomes(
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

describe("HistoricalScoreCalibrator", () => {
  let calibrator: HistoricalScoreCalibrator;

  beforeEach(() => {
    calibrator = createHistoricalScoreCalibrator();
    resetSharedHistoricalScoreCalibrator();
  });

  afterEach(() => {
    calibrator.removeAllListeners();
  });

  // ============================================================================
  // Constants and Enums Tests
  // ============================================================================

  describe("constants and enums", () => {
    it("should have all outcome types defined", () => {
      expect(OutcomeType.TRUE_POSITIVE).toBe("TRUE_POSITIVE");
      expect(OutcomeType.FALSE_POSITIVE).toBe("FALSE_POSITIVE");
      expect(OutcomeType.TRUE_NEGATIVE).toBe("TRUE_NEGATIVE");
      expect(OutcomeType.FALSE_NEGATIVE).toBe("FALSE_NEGATIVE");
      expect(OutcomeType.UNKNOWN).toBe("UNKNOWN");
    });

    it("should have all calibration quality levels defined", () => {
      expect(CalibrationQuality.EXCELLENT).toBe("EXCELLENT");
      expect(CalibrationQuality.GOOD).toBe("GOOD");
      expect(CalibrationQuality.FAIR).toBe("FAIR");
      expect(CalibrationQuality.POOR).toBe("POOR");
      expect(CalibrationQuality.INSUFFICIENT_DATA).toBe("INSUFFICIENT_DATA");
    });

    it("should have all score buckets defined", () => {
      expect(ALL_BUCKETS.length).toBe(10);
      expect(ScoreBucket.BUCKET_0_10).toBe("BUCKET_0_10");
      expect(ScoreBucket.BUCKET_90_100).toBe("BUCKET_90_100");
    });

    it("should have all adjustment types defined", () => {
      expect(AdjustmentType.NONE).toBe("NONE");
      expect(AdjustmentType.INCREASE_SENSITIVITY).toBe("INCREASE_SENSITIVITY");
      expect(AdjustmentType.DECREASE_SENSITIVITY).toBe("DECREASE_SENSITIVITY");
      expect(AdjustmentType.INCREASE_THRESHOLD).toBe("INCREASE_THRESHOLD");
      expect(AdjustmentType.DECREASE_THRESHOLD).toBe("DECREASE_THRESHOLD");
      expect(AdjustmentType.RECALIBRATE_BUCKETS).toBe("RECALIBRATE_BUCKETS");
    });

    it("should have descriptions for all outcome types", () => {
      Object.values(OutcomeType).forEach((outcome) => {
        expect(OUTCOME_DESCRIPTIONS[outcome]).toBeDefined();
        expect(OUTCOME_DESCRIPTIONS[outcome].length).toBeGreaterThan(0);
      });
    });

    it("should have descriptions for all calibration quality levels", () => {
      Object.values(CalibrationQuality).forEach((quality) => {
        expect(CALIBRATION_QUALITY_DESCRIPTIONS[quality]).toBeDefined();
        expect(CALIBRATION_QUALITY_DESCRIPTIONS[quality].length).toBeGreaterThan(0);
      });
    });

    it("should have descriptions for all adjustment types", () => {
      Object.values(AdjustmentType).forEach((type) => {
        expect(ADJUSTMENT_DESCRIPTIONS[type]).toBeDefined();
        expect(ADJUSTMENT_DESCRIPTIONS[type].length).toBeGreaterThan(0);
      });
    });

    it("should have valid bucket ranges", () => {
      ALL_BUCKETS.forEach((bucket) => {
        const range = BUCKET_RANGES[bucket];
        expect(range.min).toBeLessThan(range.max);
        expect(range.min).toBeGreaterThanOrEqual(0);
        expect(range.max).toBeLessThanOrEqual(100);
      });
    });

    it("should have contiguous bucket ranges", () => {
      for (let i = 1; i < ALL_BUCKETS.length; i++) {
        const prevBucket = ALL_BUCKETS[i - 1];
        const currBucket = ALL_BUCKETS[i];
        if (prevBucket && currBucket) {
          const prevRange = BUCKET_RANGES[prevBucket];
          const currRange = BUCKET_RANGES[currBucket];
          expect(currRange.min).toBe(prevRange.max);
        }
      }
    });

    it("should have valid default config", () => {
      expect(DEFAULT_CALIBRATOR_CONFIG.minSamplesForCalibration).toBeGreaterThan(0);
      expect(DEFAULT_CALIBRATOR_CONFIG.minSamplesPerBucket).toBeGreaterThan(0);
      expect(DEFAULT_CALIBRATOR_CONFIG.currentThreshold).toBeLessThanOrEqual(100);
      expect(DEFAULT_CALIBRATOR_CONFIG.currentThreshold).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe("helper functions", () => {
    describe("getBucketForScore", () => {
      it("should return correct bucket for each score range", () => {
        expect(getBucketForScore(5)).toBe(ScoreBucket.BUCKET_0_10);
        expect(getBucketForScore(15)).toBe(ScoreBucket.BUCKET_10_20);
        expect(getBucketForScore(25)).toBe(ScoreBucket.BUCKET_20_30);
        expect(getBucketForScore(35)).toBe(ScoreBucket.BUCKET_30_40);
        expect(getBucketForScore(45)).toBe(ScoreBucket.BUCKET_40_50);
        expect(getBucketForScore(55)).toBe(ScoreBucket.BUCKET_50_60);
        expect(getBucketForScore(65)).toBe(ScoreBucket.BUCKET_60_70);
        expect(getBucketForScore(75)).toBe(ScoreBucket.BUCKET_70_80);
        expect(getBucketForScore(85)).toBe(ScoreBucket.BUCKET_80_90);
        expect(getBucketForScore(95)).toBe(ScoreBucket.BUCKET_90_100);
      });

      it("should handle boundary values", () => {
        expect(getBucketForScore(0)).toBe(ScoreBucket.BUCKET_0_10);
        expect(getBucketForScore(10)).toBe(ScoreBucket.BUCKET_10_20);
        expect(getBucketForScore(100)).toBe(ScoreBucket.BUCKET_90_100);
      });

      it("should clamp out-of-range values", () => {
        expect(getBucketForScore(-10)).toBe(ScoreBucket.BUCKET_0_10);
        expect(getBucketForScore(150)).toBe(ScoreBucket.BUCKET_90_100);
      });
    });

    describe("scoreToProbability", () => {
      it("should convert score to probability", () => {
        expect(scoreToProbability(0)).toBe(0);
        expect(scoreToProbability(50)).toBe(0.5);
        expect(scoreToProbability(100)).toBe(1);
      });

      it("should clamp out-of-range values", () => {
        expect(scoreToProbability(-10)).toBe(0);
        expect(scoreToProbability(150)).toBe(1);
      });
    });

    describe("probabilityToScore", () => {
      it("should convert probability to score", () => {
        expect(probabilityToScore(0)).toBe(0);
        expect(probabilityToScore(0.5)).toBe(50);
        expect(probabilityToScore(1)).toBe(100);
      });

      it("should clamp out-of-range values", () => {
        expect(probabilityToScore(-0.5)).toBe(0);
        expect(probabilityToScore(1.5)).toBe(100);
      });
    });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should create with default config", () => {
      const cal = createHistoricalScoreCalibrator();
      expect(cal).toBeInstanceOf(HistoricalScoreCalibrator);
    });

    it("should accept custom config", () => {
      const cal = createHistoricalScoreCalibrator({
        minSamplesForCalibration: 100,
        currentThreshold: 60,
      });
      expect(cal).toBeInstanceOf(HistoricalScoreCalibrator);
      expect(cal.getConfig().minSamplesForCalibration).toBe(100);
      expect(cal.getConfig().currentThreshold).toBe(60);
    });
  });

  // ============================================================================
  // recordOutcome Tests
  // ============================================================================

  describe("recordOutcome", () => {
    it("should record an outcome", () => {
      const record = calibrator.recordOutcome(
        TEST_WALLET,
        75,
        OutcomeType.TRUE_POSITIVE
      );

      expect(record).toHaveProperty("id");
      expect(record.walletAddress).toBe(TEST_WALLET);
      expect(record.originalScore).toBe(75);
      expect(record.outcome).toBe(OutcomeType.TRUE_POSITIVE);
      expect(record.predictedProbability).toBe(0.75);
    });

    it("should normalize wallet address", () => {
      const record = calibrator.recordOutcome(
        TEST_WALLET.toLowerCase(),
        50,
        OutcomeType.FALSE_POSITIVE
      );
      expect(record.walletAddress).toBe(TEST_WALLET);
    });

    it("should throw for invalid wallet address", () => {
      expect(() => {
        calibrator.recordOutcome("invalid", 50, OutcomeType.TRUE_POSITIVE);
      }).toThrow("Invalid wallet address");
    });

    it("should clamp score to 0-100", () => {
      const lowRecord = calibrator.recordOutcome(TEST_WALLET, -10, OutcomeType.TRUE_POSITIVE);
      expect(lowRecord.originalScore).toBe(0);

      const highRecord = calibrator.recordOutcome(TEST_WALLET_2, 150, OutcomeType.TRUE_POSITIVE);
      expect(highRecord.originalScore).toBe(100);
    });

    it("should accept custom scoredAt date", () => {
      const pastDate = new Date("2023-01-01");
      const record = calibrator.recordOutcome(
        TEST_WALLET,
        50,
        OutcomeType.TRUE_POSITIVE,
        pastDate
      );
      expect(record.scoredAt).toEqual(pastDate);
    });

    it("should accept metadata", () => {
      const record = calibrator.recordOutcome(
        TEST_WALLET,
        50,
        OutcomeType.TRUE_POSITIVE,
        undefined,
        { source: "test", marketId: "123" }
      );
      expect(record.metadata).toEqual({ source: "test", marketId: "123" });
    });
  });

  // ============================================================================
  // updateOutcome Tests
  // ============================================================================

  describe("updateOutcome", () => {
    it("should update outcome for a wallet", () => {
      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.UNKNOWN);

      const updated = calibrator.updateOutcome(TEST_WALLET, OutcomeType.TRUE_POSITIVE);

      expect(updated).not.toBeNull();
      expect(updated!.outcome).toBe(OutcomeType.TRUE_POSITIVE);
    });

    it("should return null for unknown wallet", () => {
      const result = calibrator.updateOutcome(TEST_WALLET, OutcomeType.TRUE_POSITIVE);
      expect(result).toBeNull();
    });

    it("should update most recent record for wallet", () => {
      calibrator.recordOutcome(TEST_WALLET, 50, OutcomeType.UNKNOWN);

      // Wait a bit to ensure different timestamps
      const later = new Date(Date.now() + 1000);
      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.UNKNOWN, later);

      calibrator.updateOutcome(TEST_WALLET, OutcomeType.TRUE_POSITIVE);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLET);
      // Most recent should be updated
      expect(outcomes[0]?.outcome).toBe(OutcomeType.TRUE_POSITIVE);
    });
  });

  // ============================================================================
  // updateOutcomeById Tests
  // ============================================================================

  describe("updateOutcomeById", () => {
    it("should update outcome by record ID", () => {
      const record = calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.UNKNOWN);

      const updated = calibrator.updateOutcomeById(record.id, OutcomeType.FALSE_POSITIVE);

      expect(updated).not.toBeNull();
      expect(updated!.outcome).toBe(OutcomeType.FALSE_POSITIVE);
    });

    it("should return null for unknown ID", () => {
      const result = calibrator.updateOutcomeById("unknown-id", OutcomeType.TRUE_POSITIVE);
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getWalletOutcomes Tests
  // ============================================================================

  describe("getWalletOutcomes", () => {
    it("should return outcomes for a wallet", () => {
      calibrator.recordOutcome(TEST_WALLET, 50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.FALSE_POSITIVE);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLET);

      expect(outcomes.length).toBe(2);
    });

    it("should return empty array for unknown wallet", () => {
      const outcomes = calibrator.getWalletOutcomes(TEST_WALLET);
      expect(outcomes).toEqual([]);
    });

    it("should return outcomes sorted by date (most recent first)", () => {
      const early = new Date("2023-01-01");
      const later = new Date("2023-06-01");

      calibrator.recordOutcome(TEST_WALLET, 50, OutcomeType.TRUE_POSITIVE, early);
      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.FALSE_POSITIVE, later);

      const outcomes = calibrator.getWalletOutcomes(TEST_WALLET);

      expect(outcomes[0]?.scoredAt.getTime()).toBeGreaterThan(outcomes[1]?.scoredAt.getTime() ?? 0);
    });
  });

  // ============================================================================
  // getAllOutcomes Tests
  // ============================================================================

  describe("getAllOutcomes", () => {
    it("should return all outcomes", () => {
      calibrator.recordOutcome(TEST_WALLET, 50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLET_2, 75, OutcomeType.FALSE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLET_3, 60, OutcomeType.UNKNOWN);

      const outcomes = calibrator.getAllOutcomes();

      expect(outcomes.length).toBe(3);
    });

    it("should return empty array when no outcomes", () => {
      const outcomes = calibrator.getAllOutcomes();
      expect(outcomes).toEqual([]);
    });
  });

  // ============================================================================
  // calculateCalibration Tests
  // ============================================================================

  describe("calculateCalibration", () => {
    it("should return calibration result", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("recommendations");
      expect(result).toHaveProperty("optimizedThreshold");
      expect(result).toHaveProperty("scoreAdjustmentCurve");
      expect(result).toHaveProperty("isCalibrated");
      expect(result).toHaveProperty("calibratedAt");
    });

    it("should not be calibrated with insufficient data", () => {
      addManyOutcomes(calibrator, 10);

      const result = calibrator.calculateCalibration();

      expect(result.isCalibrated).toBe(false);
      expect(result.metrics.quality).toBe(CalibrationQuality.INSUFFICIENT_DATA);
    });

    it("should be calibrated with sufficient data", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.isCalibrated).toBe(true);
      expect(result.metrics.quality).not.toBe(CalibrationQuality.INSUFFICIENT_DATA);
    });

    it("should calculate Brier score", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.brierScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.brierScore).toBeLessThanOrEqual(1);
    });

    it("should calculate precision and recall", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.precision).toBeGreaterThanOrEqual(0);
      expect(result.metrics.precision).toBeLessThanOrEqual(1);
      expect(result.metrics.recall).toBeGreaterThanOrEqual(0);
      expect(result.metrics.recall).toBeLessThanOrEqual(1);
    });

    it("should calculate F1 score", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(result.metrics.f1Score).toBeLessThanOrEqual(1);
    });

    it("should calculate AUC-ROC", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.aucRoc).toBeGreaterThanOrEqual(0);
      expect(result.metrics.aucRoc).toBeLessThanOrEqual(1);
    });

    it("should build reliability curve", () => {
      addManyOutcomes(calibrator, 100);

      const result = calibrator.calculateCalibration();

      expect(result.metrics.reliabilityCurve.length).toBe(ALL_BUCKETS.length);
      result.metrics.reliabilityCurve.forEach((bucket) => {
        expect(bucket).toHaveProperty("bucket");
        expect(bucket).toHaveProperty("avgPredictedProbability");
        expect(bucket).toHaveProperty("actualPositiveRate");
        expect(bucket).toHaveProperty("sampleCount");
        expect(bucket).toHaveProperty("calibrationError");
      });
    });

    it("should have better calibration with well-calibrated data", () => {
      addCalibratedOutcomes(calibrator, 200);

      const result = calibrator.calculateCalibration();

      // Well-calibrated data should have a lower Brier score
      expect(result.metrics.brierScore).toBeLessThan(0.5);
    });

    it("should generate recommendations for poor calibration", () => {
      // Add biased outcomes (all high scores but few positives)
      for (let i = 0; i < 100; i++) {
        const wallet = randomWallet();
        calibrator.recordOutcome(wallet, 80 + Math.random() * 20, OutcomeType.FALSE_POSITIVE);
      }

      const result = calibrator.calculateCalibration();

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should recommend gathering more data when insufficient", () => {
      addManyOutcomes(calibrator, 20);

      const result = calibrator.calculateCalibration();

      expect(result.recommendations.some((r) => r.type === AdjustmentType.NONE)).toBe(true);
    });
  });

  // ============================================================================
  // calibrateScore Tests
  // ============================================================================

  describe("calibrateScore", () => {
    it("should return original score when not calibrated", () => {
      const calibrated = calibrator.calibrateScore(75);
      expect(calibrated).toBe(75);
    });

    it("should adjust score after calibration", () => {
      addCalibratedOutcomes(calibrator, 200);
      calibrator.calculateCalibration();

      const calibrated = calibrator.calibrateScore(50);

      // Should return a valid score
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(100);
    });

    it("should maintain approximate ordering", () => {
      addCalibratedOutcomes(calibrator, 200);
      calibrator.calculateCalibration();

      const low = calibrator.calibrateScore(20);
      const high = calibrator.calibrateScore(80);

      // Higher original scores should generally map to higher calibrated scores
      expect(high).toBeGreaterThan(low);
    });
  });

  // ============================================================================
  // getSummary Tests
  // ============================================================================

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      calibrator.recordOutcome(TEST_WALLET, 50, OutcomeType.TRUE_POSITIVE);
      calibrator.recordOutcome(TEST_WALLET_2, 75, OutcomeType.FALSE_POSITIVE);

      const summary = calibrator.getSummary();

      expect(summary.totalOutcomes).toBe(2);
      expect(summary.outcomesByType[OutcomeType.TRUE_POSITIVE]).toBe(1);
      expect(summary.outcomesByType[OutcomeType.FALSE_POSITIVE]).toBe(1);
    });

    it("should return current quality", () => {
      const summary = calibrator.getSummary();
      expect(summary.currentQuality).toBe(CalibrationQuality.INSUFFICIENT_DATA);
    });

    it("should include Brier score history after calibration", () => {
      addManyOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      const summary = calibrator.getSummary();

      expect(summary.brierScoreHistory.length).toBeGreaterThan(0);
    });

    it("should track last calibration time", () => {
      addManyOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      const summary = calibrator.getSummary();

      expect(summary.lastCalibrationAt).not.toBeNull();
      expect(summary.hoursSinceLastCalibration).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe("events", () => {
    it("should emit outcome-recorded event", () => {
      const handler = vi.fn();
      calibrator.on("outcome-recorded", handler);

      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.TRUE_POSITIVE);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: TEST_WALLET,
          score: 75,
          outcome: OutcomeType.TRUE_POSITIVE,
        })
      );
    });

    it("should emit outcome-updated event", () => {
      const handler = vi.fn();
      calibrator.on("outcome-updated", handler);

      calibrator.recordOutcome(TEST_WALLET, 75, OutcomeType.UNKNOWN);
      calibrator.updateOutcome(TEST_WALLET, OutcomeType.TRUE_POSITIVE);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: TEST_WALLET,
          outcome: OutcomeType.TRUE_POSITIVE,
        })
      );
    });

    it("should emit calibration-completed event", () => {
      const handler = vi.fn();
      calibrator.on("calibration-completed", handler);

      addManyOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: expect.any(String),
          brierScore: expect.any(Number),
          sampleCount: expect.any(Number),
        })
      );
    });

    it("should emit config-updated event", () => {
      const handler = vi.fn();
      calibrator.on("config-updated", handler);

      calibrator.updateConfig({ currentThreshold: 60 });

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe("configuration", () => {
    it("should update configuration", () => {
      calibrator.updateConfig({
        currentThreshold: 60,
        minSamplesForCalibration: 100,
      });

      const config = calibrator.getConfig();
      expect(config.currentThreshold).toBe(60);
      expect(config.minSamplesForCalibration).toBe(100);
    });

    it("should return a copy of config", () => {
      const config1 = calibrator.getConfig();
      const config2 = calibrator.getConfig();

      config1.currentThreshold = 999;

      expect(config2.currentThreshold).not.toBe(999);
    });
  });

  // ============================================================================
  // clearOutcomes Tests
  // ============================================================================

  describe("clearOutcomes", () => {
    it("should clear all outcomes", () => {
      addManyOutcomes(calibrator, 50);

      calibrator.clearOutcomes();

      expect(calibrator.getAllOutcomes()).toEqual([]);
    });

    it("should reset last calibration", () => {
      addManyOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      calibrator.clearOutcomes();

      expect(calibrator.getLastCalibration()).toBeNull();
    });

    it("should emit outcomes-cleared event", () => {
      const handler = vi.fn();
      calibrator.on("outcomes-cleared", handler);

      calibrator.clearOutcomes();

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Export/Import Tests
  // ============================================================================

  describe("export and import", () => {
    it("should export data", () => {
      addManyOutcomes(calibrator, 50);
      calibrator.calculateCalibration();

      const data = calibrator.exportData();

      expect(data.outcomes.length).toBe(50);
      expect(data.brierScoreHistory.length).toBeGreaterThan(0);
      expect(data.adjustmentCurve.length).toBe(ALL_BUCKETS.length);
    });

    it("should import data", () => {
      addManyOutcomes(calibrator, 50);
      const exported = calibrator.exportData();

      const newCalibrator = createHistoricalScoreCalibrator();
      newCalibrator.importData(exported);

      expect(newCalibrator.getAllOutcomes().length).toBe(50);
    });

    it("should emit data-imported event", () => {
      const handler = vi.fn();
      calibrator.on("data-imported", handler);

      calibrator.importData({ outcomes: [] });

      expect(handler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Factory and Singleton Tests
  // ============================================================================

  describe("factory and singleton", () => {
    it("should create new instance with factory", () => {
      const cal1 = createHistoricalScoreCalibrator();
      const cal2 = createHistoricalScoreCalibrator();
      expect(cal1).not.toBe(cal2);
    });

    it("should return same shared instance", () => {
      const shared1 = getSharedHistoricalScoreCalibrator();
      const shared2 = getSharedHistoricalScoreCalibrator();
      expect(shared1).toBe(shared2);
    });

    it("should allow setting custom shared instance", () => {
      const custom = createHistoricalScoreCalibrator();
      setSharedHistoricalScoreCalibrator(custom);
      expect(getSharedHistoricalScoreCalibrator()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const before = getSharedHistoricalScoreCalibrator();
      resetSharedHistoricalScoreCalibrator();
      const after = getSharedHistoricalScoreCalibrator();
      expect(before).not.toBe(after);
    });
  });

  // ============================================================================
  // Convenience Functions Tests
  // ============================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedHistoricalScoreCalibrator();
    });

    it("should record outcome using shared instance", () => {
      const record = recordHistoricalOutcome(TEST_WALLET, 75, OutcomeType.TRUE_POSITIVE);
      expect(record).toHaveProperty("id");
    });

    it("should update outcome using shared instance", () => {
      recordHistoricalOutcome(TEST_WALLET, 75, OutcomeType.UNKNOWN);
      const updated = updateHistoricalOutcome(TEST_WALLET, OutcomeType.TRUE_POSITIVE);
      expect(updated!.outcome).toBe(OutcomeType.TRUE_POSITIVE);
    });

    it("should calculate calibration using shared instance", () => {
      const shared = getSharedHistoricalScoreCalibrator();
      addManyOutcomes(shared, 100);

      const result = calculateHistoricalCalibration();
      expect(result).toHaveProperty("metrics");
    });

    it("should calibrate score using shared instance", () => {
      const shared = getSharedHistoricalScoreCalibrator();
      addCalibratedOutcomes(shared, 200);
      shared.calculateCalibration();

      const calibrated = calibrateHistoricalScore(50);
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(100);
    });

    it("should get summary using shared instance", () => {
      recordHistoricalOutcome(TEST_WALLET, 75, OutcomeType.TRUE_POSITIVE);
      const summary = getHistoricalCalibrationSummary();
      expect(summary.totalOutcomes).toBe(1);
    });

    it("should get outcome description", () => {
      const desc = getOutcomeDescription(OutcomeType.TRUE_POSITIVE);
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get calibration quality description", () => {
      const desc = getCalibrationQualityDescription(CalibrationQuality.GOOD);
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get adjustment description", () => {
      const desc = getAdjustmentDescription(AdjustmentType.INCREASE_THRESHOLD);
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("edge cases", () => {
    it("should handle all unknown outcomes", () => {
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), Math.random() * 100, OutcomeType.UNKNOWN);
      }

      const result = calibrator.calculateCalibration();

      // With all unknown outcomes, Brier score should be 1 (worst)
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

    it("should handle max outcomes limit", () => {
      const cal = createHistoricalScoreCalibrator({
        maxOutcomesToStore: 10,
      });

      for (let i = 0; i < 20; i++) {
        cal.recordOutcome(randomWallet(), 50, OutcomeType.TRUE_POSITIVE);
      }

      expect(cal.getAllOutcomes().length).toBe(10);
    });

    it("should handle very old outcomes based on maxOutcomeAgeHours", () => {
      const cal = createHistoricalScoreCalibrator({
        maxOutcomeAgeHours: 1, // 1 hour
      });

      // Add old outcome (2 hours ago)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      cal.recordOutcome(TEST_WALLET, 50, OutcomeType.TRUE_POSITIVE, twoHoursAgo);

      // Add recent outcome
      cal.recordOutcome(TEST_WALLET_2, 75, OutcomeType.TRUE_POSITIVE);

      // Calculate calibration - old outcome should be filtered
      const result = cal.calculateCalibration();

      // Only 1 outcome should be considered
      expect(result.metrics.knownOutcomeSamples).toBe(1);
    });
  });

  // ============================================================================
  // Calibration Quality Tests
  // ============================================================================

  describe("calibration quality", () => {
    it("should classify excellent calibration correctly", () => {
      // Create well-calibrated data
      const cal = createHistoricalScoreCalibrator({
        minSamplesForCalibration: 100,
      });

      // Add outcomes where score matches actual outcome probability
      for (let i = 0; i < 500; i++) {
        const wallet = randomWallet();
        const score = Math.random() * 100;
        const isPositive = Math.random() * 100 < score;
        const outcome = isPositive ? OutcomeType.TRUE_POSITIVE : OutcomeType.FALSE_POSITIVE;
        cal.recordOutcome(wallet, score, outcome);
      }

      const result = cal.calculateCalibration();

      // With well-calibrated data, should be EXCELLENT or GOOD
      expect([CalibrationQuality.EXCELLENT, CalibrationQuality.GOOD]).toContain(
        result.metrics.quality
      );
    });

    it("should classify poor calibration correctly", () => {
      // Create poorly calibrated data - high scores but all negatives
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), 90, OutcomeType.FALSE_POSITIVE);
      }
      // Add some low scores with positives (inverted calibration)
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), 10, OutcomeType.TRUE_POSITIVE);
      }

      const result = calibrator.calculateCalibration();

      // Should be POOR or FAIR due to inverted calibration
      expect([CalibrationQuality.POOR, CalibrationQuality.FAIR]).toContain(
        result.metrics.quality
      );
    });
  });

  // ============================================================================
  // Recommendation Tests
  // ============================================================================

  describe("recommendations", () => {
    it("should recommend lower threshold for low recall", () => {
      // Add many high-score false positives (threshold too low)
      for (let i = 0; i < 100; i++) {
        calibrator.recordOutcome(randomWallet(), 70, OutcomeType.FALSE_POSITIVE);
      }
      // Add some true positives below threshold
      for (let i = 0; i < 20; i++) {
        calibrator.recordOutcome(randomWallet(), 30, OutcomeType.FALSE_NEGATIVE);
      }

      const result = calibrator.calculateCalibration();

      // Should have recommendations
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should recommend higher threshold for high false positive rate", () => {
      // Add outcomes with high FP rate at current threshold
      for (let i = 0; i < 80; i++) {
        calibrator.recordOutcome(randomWallet(), 60, OutcomeType.FALSE_POSITIVE);
      }
      for (let i = 0; i < 20; i++) {
        calibrator.recordOutcome(randomWallet(), 60, OutcomeType.TRUE_POSITIVE);
      }

      const result = calibrator.calculateCalibration();

      // Should have recommendations related to threshold
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Brier Score History Tests
  // ============================================================================

  describe("Brier score history", () => {
    it("should track Brier score history across calibrations", () => {
      addManyOutcomes(calibrator, 100);
      calibrator.calculateCalibration();

      addManyOutcomes(calibrator, 50);
      calibrator.calculateCalibration();

      const summary = calibrator.getSummary();

      expect(summary.brierScoreHistory.length).toBe(2);
    });

    it("should limit Brier score history to 100 entries", () => {
      for (let i = 0; i < 150; i++) {
        addManyOutcomes(calibrator, 50);
        calibrator.calculateCalibration();
      }

      const data = calibrator.exportData();

      expect(data.brierScoreHistory.length).toBeLessThanOrEqual(100);
    });
  });
});
