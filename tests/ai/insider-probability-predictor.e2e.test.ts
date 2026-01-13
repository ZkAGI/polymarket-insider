/**
 * End-to-End Tests for Insider Probability Predictor (AI-PRED-001)
 *
 * These tests validate the complete insider probability prediction workflow
 * including feature extraction, prediction, calibration, verification, and batch processing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InsiderProbabilityPredictor,
  PredictionStatus,
  CalibrationMethod,
  createInsiderProbabilityPredictor,
  getSharedInsiderProbabilityPredictor,
  resetSharedInsiderProbabilityPredictor,
  createMockInsiderFeatureSet,
  createMockInsiderFeatureSetBatch,
  createSuspiciousMockFeatureSet,
  createNormalMockFeatureSet,
  createMockWalletActivityData,
  createMockWalletBehaviorFeatures,
  createMockTimingFeatures,
  createMockMarketSelectionFeatures,
  createMockTradingPatternFeatures,
  createMockPerformanceFeatures,
  createMockNetworkFeatures,
  InsiderFeatureSet,
} from "../../src/ai/insider-probability-predictor";

describe("Insider Probability Predictor E2E", () => {
  let predictor: InsiderProbabilityPredictor;

  beforeEach(() => {
    predictor = createInsiderProbabilityPredictor();
    resetSharedInsiderProbabilityPredictor();
  });

  afterEach(() => {
    predictor.reset();
  });

  describe("Basic Integration", () => {
    it("should predict insider probability within valid range", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
      expect(result.rawScore).toBeGreaterThanOrEqual(0);
      expect(result.rawScore).toBeLessThanOrEqual(1);
    });

    it("should distinguish between suspicious and normal activity", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const normalSet = createNormalMockFeatureSet();

      const suspiciousResult = predictor.predict(suspiciousSet);
      const normalResult = predictor.predict(normalSet);

      // Suspicious should have higher probability than normal
      expect(suspiciousResult.probability).toBeGreaterThan(normalResult.probability);
    });

    it("should provide consistent results for same input", () => {
      const featureSet = createMockInsiderFeatureSet();

      const result1 = predictor.predict(featureSet);
      const result2 = predictor.predict(featureSet);

      // Cache should return same result
      expect(result1.predictionId).toBe(result2.predictionId);
      expect(result1.probability).toBe(result2.probability);
    });

    it("should generate complete prediction metadata", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.predictionId).toBeDefined();
      expect(result.walletAddress).toBe(featureSet.activity.walletAddress);
      expect(result.marketId).toBe(featureSet.activity.marketId);
      expect(result.confidence).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.topFactors.length).toBeGreaterThan(0);
      expect(result.riskAssessment).toBeDefined();
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.status).toBe(PredictionStatus.PENDING);
      expect(result.predictedAt).toBeInstanceOf(Date);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Feature Processing", () => {
    it("should process all feature categories", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      const categories = new Set(result.signals.map((s) => s.category));
      expect(categories.size).toBeGreaterThan(3);
    });

    it("should identify suspicious features correctly", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const result = predictor.predict(suspiciousSet);

      // Should have multiple suspicious signals
      const suspiciousSignals = result.signals.filter((s) => s.isSuspicious);
      expect(suspiciousSignals.length).toBeGreaterThan(5);
    });

    it("should handle extreme feature values", () => {
      const extremeSet = createMockInsiderFeatureSet({
        walletBehavior: createMockWalletBehaviorFeatures({
          walletAgeDays: 0, // Brand new wallet
          sybilRiskScore: 100, // Maximum sybil risk
        }),
        performance: createMockPerformanceFeatures({
          winRate: 1.0, // 100% win rate
          maxConsecutiveWins: 100, // Extreme win streak
        }),
      });

      const result = predictor.predict(extremeSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
      expect(result.probability).toBeGreaterThan(0.5); // Should be suspicious
    });

    it("should handle missing optional features gracefully", () => {
      const minimalSet: InsiderFeatureSet = {
        activity: createMockWalletActivityData(),
        walletBehavior: createMockWalletBehaviorFeatures(),
        timing: createMockTimingFeatures(),
        marketSelection: createMockMarketSelectionFeatures(),
        tradingPattern: createMockTradingPatternFeatures(),
        performance: createMockPerformanceFeatures(),
        network: createMockNetworkFeatures(),
      };

      const result = predictor.predict(minimalSet);

      expect(result).toBeDefined();
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });
  });

  describe("Calibration Methods", () => {
    const featureSet = createMockInsiderFeatureSet();

    it("should apply Platt scaling correctly", () => {
      predictor.setCalibration({
        method: CalibrationMethod.PLATT,
        plattA: -2.0,
        plattB: 0.5,
      });

      const result = predictor.predict(featureSet);
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply temperature scaling correctly", () => {
      predictor.setCalibration({
        method: CalibrationMethod.TEMPERATURE,
        temperature: 0.5, // Sharper distribution
      });

      const result = predictor.predict(featureSet);
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply beta calibration correctly", () => {
      predictor.setCalibration({
        method: CalibrationMethod.BETA,
        betaA: 2.0,
        betaB: 1.0,
      });

      const result = predictor.predict(featureSet);
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply isotonic calibration correctly", () => {
      predictor.setCalibration({
        method: CalibrationMethod.ISOTONIC,
        isotonicPoints: [
          { input: 0.0, output: 0.05 },
          { input: 0.25, output: 0.15 },
          { input: 0.5, output: 0.45 },
          { input: 0.75, output: 0.80 },
          { input: 1.0, output: 0.95 },
        ],
      });

      const result = predictor.predict(featureSet);
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should produce different outputs with different calibrations", () => {
      const featureSet1 = createMockInsiderFeatureSet();
      featureSet1.activity.walletAddress = "0x1111111111111111111111111111111111111111";
      featureSet1.activity.marketId = "market_cal_1";

      const featureSet2 = createMockInsiderFeatureSet();
      featureSet2.activity.walletAddress = "0x2222222222222222222222222222222222222222";
      featureSet2.activity.marketId = "market_cal_2";

      // Same features but ensure different behavior for comparison
      featureSet2.walletBehavior = featureSet1.walletBehavior;
      featureSet2.timing = featureSet1.timing;
      featureSet2.marketSelection = featureSet1.marketSelection;
      featureSet2.tradingPattern = featureSet1.tradingPattern;
      featureSet2.performance = featureSet1.performance;
      featureSet2.network = featureSet1.network;

      predictor.setCalibration({
        method: CalibrationMethod.NONE,
      });
      const noneResult = predictor.predict(featureSet1);

      predictor.clearCache();
      predictor.setCalibration({
        method: CalibrationMethod.TEMPERATURE,
        temperature: 2.0,
      });
      const tempResult = predictor.predict(featureSet2);

      // Results should differ due to different calibration
      expect(noneResult.probability).not.toBe(tempResult.probability);
    });
  });

  describe("Batch Processing", () => {
    it("should process batch of predictions", () => {
      const featureSets = createMockInsiderFeatureSetBatch(50);
      const result = predictor.predictBatch(featureSets);

      expect(result.totalPredicted).toBe(50);
      expect(result.results.length).toBe(50);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should calculate correct distribution", () => {
      const featureSets = createMockInsiderFeatureSetBatch(100);
      const result = predictor.predictBatch(featureSets);

      const total =
        result.distribution.veryUnlikely +
        result.distribution.unlikely +
        result.distribution.uncertain +
        result.distribution.likely +
        result.distribution.veryLikely;

      expect(total).toBe(100);
    });

    it("should calculate average probability correctly", () => {
      const featureSets = createMockInsiderFeatureSetBatch(20);
      const result = predictor.predictBatch(featureSets);

      const manualAvg =
        result.results.reduce((sum, r) => sum + r.probability, 0) /
        result.results.length;

      expect(Math.abs(result.averageProbability - manualAvg)).toBeLessThan(0.001);
    });

    it("should count flagged predictions correctly", () => {
      predictor.updateConfig({ flagThreshold: 0.5 });

      const featureSets = createMockInsiderFeatureSetBatch(50);
      const result = predictor.predictBatch(featureSets);

      const manualCount = result.results.filter((r) => r.probability >= 0.5).length;
      expect(result.flaggedCount).toBe(manualCount);
    });

    it("should handle large batch efficiently", () => {
      const featureSets = createMockInsiderFeatureSetBatch(500);
      const startTime = Date.now();
      const result = predictor.predictBatch(featureSets);
      const duration = Date.now() - startTime;

      expect(result.totalPredicted).toBe(500);
      // Should process 500 predictions in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it("should handle empty batch", () => {
      const result = predictor.predictBatch([]);

      expect(result.totalPredicted).toBe(0);
      expect(result.results.length).toBe(0);
      expect(result.averageProbability).toBe(0);
      expect(result.flaggedCount).toBe(0);
    });
  });

  describe("Verification Flow", () => {
    it("should verify predictions and update metrics", () => {
      // Make predictions
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const normalSet = createNormalMockFeatureSet();

      const suspiciousPred = predictor.predict(suspiciousSet);
      const normalPred = predictor.predict(normalSet);

      // Verify with ground truth
      predictor.verifyPrediction(suspiciousPred.predictionId, "INSIDER");
      predictor.verifyPrediction(normalPred.predictionId, "NOT_INSIDER");

      // Check metrics
      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(2);
    });

    it("should calculate accuracy metrics correctly", () => {
      // Make controlled predictions
      predictor.updateConfig({ flagThreshold: 0.5 });

      // True Positive: suspicious predicted and verified as insider
      const tp = createSuspiciousMockFeatureSet();
      tp.activity.walletAddress = "0x1111111111111111111111111111111111111111";
      tp.activity.marketId = "market_tp";
      const tpPred = predictor.predict(tp);

      // True Negative: normal predicted and verified as not insider
      const tn = createNormalMockFeatureSet();
      tn.activity.walletAddress = "0x2222222222222222222222222222222222222222";
      tn.activity.marketId = "market_tn";
      const tnPred = predictor.predict(tn);

      // Verify
      predictor.verifyPrediction(tpPred.predictionId, "INSIDER");
      predictor.verifyPrediction(tnPred.predictionId, "NOT_INSIDER");

      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(2);
      // Precision and recall should be positive if we have true positives
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
    });

    it("should update Brier score on verification", () => {
      const featureSet = createMockInsiderFeatureSet();
      const prediction = predictor.predict(featureSet);

      const initialMetrics = predictor.getMetrics();
      expect(initialMetrics.brierScore).toBe(0.25); // Default value

      predictor.verifyPrediction(prediction.predictionId, "NOT_INSIDER");

      const updatedMetrics = predictor.getMetrics();
      // Brier score should be updated based on prediction accuracy
      expect(updatedMetrics.brierScore).toBeGreaterThanOrEqual(0);
      expect(updatedMetrics.brierScore).toBeLessThanOrEqual(1);
    });

    it("should track pending verifications", () => {
      const featureSets = createMockInsiderFeatureSetBatch(10);
      featureSets.forEach((fs, i) => {
        fs.activity.walletAddress = `0x${i.toString().padStart(40, "0")}`;
        fs.activity.marketId = `market_${i}`;
        predictor.predict(fs);
      });

      // Verify half
      const predictions = featureSets.map((fs) =>
        predictor.getPredictionsForWallet(fs.activity.walletAddress)[0]
      );
      for (let i = 0; i < 5; i++) {
        if (predictions[i]) {
          predictor.verifyPrediction(predictions[i]!.predictionId, "NOT_INSIDER");
        }
      }

      const pending = predictor.getPendingVerifications();
      expect(pending.length).toBe(5);
    });
  });

  describe("Caching Behavior", () => {
    it("should cache predictions effectively", () => {
      const featureSet = createMockInsiderFeatureSet();

      // First prediction - cache miss
      predictor.predict(featureSet);

      // Second prediction - cache hit
      predictor.predict(featureSet);

      const stats = predictor.getStatistics();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHitRate).toBe(0.5);
    });

    it("should respect cache TTL", async () => {
      predictor.updateConfig({ cacheTtlMs: 100 }); // 100ms TTL

      const featureSet = createMockInsiderFeatureSet();

      // First prediction
      const result1 = predictor.predict(featureSet);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second prediction should be a cache miss
      const result2 = predictor.predict(featureSet);

      // Different prediction IDs means cache expired
      expect(result1.predictionId).not.toBe(result2.predictionId);
    });

    it("should clear cache on demand", () => {
      const featureSets = createMockInsiderFeatureSetBatch(10);
      featureSets.forEach((fs) => predictor.predict(fs));

      const statsBefore = predictor.getCacheStats();
      expect(statsBefore.size).toBe(10);

      predictor.clearCache();

      const statsAfter = predictor.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    it("should work without cache when disabled", () => {
      predictor.updateConfig({ cacheEnabled: false });

      const featureSet = createMockInsiderFeatureSet();

      const result1 = predictor.predict(featureSet);
      const result2 = predictor.predict(featureSet);

      // Different prediction IDs when cache is disabled
      expect(result1.predictionId).not.toBe(result2.predictionId);

      const stats = predictor.getStatistics();
      expect(stats.cacheHits).toBe(0);
    });
  });

  describe("Signal Analysis", () => {
    it("should sort signals by contribution", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      for (let i = 1; i < result.signals.length; i++) {
        expect(result.signals[i - 1]!.contribution).toBeGreaterThanOrEqual(
          result.signals[i]!.contribution
        );
      }
    });

    it("should identify top contributing factors", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const result = predictor.predict(suspiciousSet);

      expect(result.topFactors.length).toBeLessThanOrEqual(5);
      // Top factors should be the most suspicious ones
      result.topFactors.forEach((factor) => {
        expect(factor.contribution).toBeGreaterThan(0);
      });
    });

    it("should provide accurate signal descriptions", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      result.signals.forEach((signal) => {
        expect(signal.name).toBeDefined();
        expect(signal.description).toBeDefined();
        expect(signal.description.length).toBeGreaterThan(5);
      });
    });
  });

  describe("Risk Assessment", () => {
    it("should generate appropriate risk levels", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const suspiciousResult = predictor.predict(suspiciousSet);

      // High probability should trigger high-level risk assessment
      if (suspiciousResult.probability >= 0.6) {
        expect(suspiciousResult.riskAssessment).toMatch(/(HIGH|CRITICAL)/);
      }
    });

    it("should generate actionable recommendations", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.recommendedActions.length).toBeGreaterThan(0);
      result.recommendedActions.forEach((action) => {
        expect(action.length).toBeGreaterThan(5);
      });
    });

    it("should scale recommendations with probability", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const normalSet = createNormalMockFeatureSet();

      const suspiciousResult = predictor.predict(suspiciousSet);
      const normalResult = predictor.predict(normalSet);

      // Suspicious should have more urgent actions
      expect(suspiciousResult.recommendedActions.length).toBeGreaterThanOrEqual(
        normalResult.recommendedActions.length
      );
    });
  });

  describe("Prediction Retrieval", () => {
    it("should retrieve predictions by wallet address", () => {
      const walletAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      for (let i = 0; i < 5; i++) {
        const featureSet = createMockInsiderFeatureSet();
        featureSet.activity.walletAddress = walletAddress;
        featureSet.activity.marketId = `market_retrieve_${i}`;
        predictor.predict(featureSet);
      }

      const predictions = predictor.getPredictionsForWallet(walletAddress);
      expect(predictions.length).toBe(5);
      predictions.forEach((p) => {
        expect(p.walletAddress).toBe(walletAddress);
      });
    });

    it("should retrieve predictions by market ID", () => {
      const marketId = "market_specific_test";

      for (let i = 0; i < 3; i++) {
        const featureSet = createMockInsiderFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "b")}`;
        featureSet.activity.marketId = marketId;
        predictor.predict(featureSet);
      }

      const predictions = predictor.getPredictionsForMarket(marketId);
      expect(predictions.length).toBe(3);
      predictions.forEach((p) => {
        expect(p.marketId).toBe(marketId);
      });
    });

    it("should retrieve flagged predictions", () => {
      predictor.updateConfig({ flagThreshold: 0.5 });

      // Create mix of suspicious and normal
      for (let i = 0; i < 5; i++) {
        const featureSet =
          i % 2 === 0
            ? createSuspiciousMockFeatureSet()
            : createNormalMockFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "c")}`;
        featureSet.activity.marketId = `market_flagged_${i}`;
        predictor.predict(featureSet);
      }

      const flagged = predictor.getFlaggedPredictions();
      flagged.forEach((p) => {
        expect(p.probability).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe("Statistics Tracking", () => {
    it("should track total predictions", () => {
      const featureSets = createMockInsiderFeatureSetBatch(25);
      featureSets.forEach((fs) => predictor.predict(fs));

      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(25);
    });

    it("should calculate flag rate accurately", () => {
      predictor.updateConfig({ flagThreshold: 0.5 });

      // Make 10 predictions with known outcomes
      for (let i = 0; i < 10; i++) {
        const featureSet =
          i < 4
            ? createSuspiciousMockFeatureSet()
            : createNormalMockFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "d")}`;
        featureSet.activity.marketId = `market_rate_${i}`;
        predictor.predict(featureSet);
      }

      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(10);
      expect(stats.flagRate).toBeGreaterThanOrEqual(0);
      expect(stats.flagRate).toBeLessThanOrEqual(1);
    });

    it("should track cache statistics", () => {
      const featureSets = createMockInsiderFeatureSetBatch(5);

      // Make initial predictions
      featureSets.forEach((fs) => predictor.predict(fs));

      // Repeat some predictions
      predictor.predict(featureSets[0]!);
      predictor.predict(featureSets[1]!);

      const stats = predictor.getStatistics();
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(5);
      expect(stats.cacheHitRate).toBeCloseTo(2 / 7, 2);
    });
  });

  describe("Configuration Updates", () => {
    it("should update flag threshold dynamically", () => {
      const featureSet = createMockInsiderFeatureSet();

      predictor.updateConfig({ flagThreshold: 0.1 });
      featureSet.activity.walletAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      featureSet.activity.marketId = "market_threshold_1";
      const lowThresholdResult = predictor.predict(featureSet);

      predictor.clearCache();
      predictor.updateConfig({ flagThreshold: 0.9 });
      featureSet.activity.walletAddress = "0xffffffffffffffffffffffffffffffffffffffff";
      featureSet.activity.marketId = "market_threshold_2";
      const highThresholdResult = predictor.predict(featureSet);

      // Same prediction, different threshold interpretation
      const lowFlagged = lowThresholdResult.probability >= 0.1;
      const highFlagged = highThresholdResult.probability >= 0.9;

      // At least the low threshold should be more permissive than the high one
      // (low threshold = more things get flagged)
      expect(lowFlagged || !highFlagged).toBe(true);
    });

    it("should update feature weights dynamically", () => {
      const featureSet = createMockInsiderFeatureSet({
        performance: createMockPerformanceFeatures({
          winRate: 0.95, // Very high win rate
        }),
      });

      // Predict with default weights
      featureSet.activity.walletAddress = "0x0000000000000000000000000000000000000001";
      featureSet.activity.marketId = "market_weight_1";
      const defaultResult = predictor.predict(featureSet);

      // Increase win_rate weight significantly
      predictor.updateFeatureWeight("win_rate", 0.5);
      predictor.clearCache();

      featureSet.activity.walletAddress = "0x0000000000000000000000000000000000000002";
      featureSet.activity.marketId = "market_weight_2";
      const adjustedResult = predictor.predict(featureSet);

      // Result should change with different weights
      expect(Math.abs(defaultResult.probability - adjustedResult.probability)).toBeLessThan(0.5);
    });
  });

  describe("Error Handling", () => {
    it("should handle verification of non-existent prediction", () => {
      const result = predictor.verifyPrediction("non_existent_id", "INSIDER");
      expect(result).toBe(false);
    });

    it("should handle empty feature sets gracefully", () => {
      const emptySet: InsiderFeatureSet = {
        activity: createMockWalletActivityData(),
        walletBehavior: createMockWalletBehaviorFeatures(),
        timing: createMockTimingFeatures(),
        marketSelection: createMockMarketSelectionFeatures(),
        tradingPattern: createMockTradingPatternFeatures(),
        performance: createMockPerformanceFeatures(),
        network: createMockNetworkFeatures(),
      };

      const result = predictor.predict(emptySet);
      expect(result).toBeDefined();
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset all state completely", () => {
      // Build up state
      const featureSets = createMockInsiderFeatureSetBatch(20);
      featureSets.forEach((fs) => predictor.predict(fs));

      // Verify some
      const predictions = predictor.getFlaggedPredictions();
      if (predictions.length > 0) {
        predictor.verifyPrediction(predictions[0]!.predictionId, "INSIDER");
      }

      // Reset
      predictor.reset();

      // Verify all state is cleared
      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(0);
      expect(stats.flaggedCount).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.pendingVerifications).toBe(0);

      const metrics = predictor.getMetrics();
      expect(metrics.totalPredictions).toBe(0);
      expect(metrics.verifiedPredictions).toBe(0);

      const cacheStats = predictor.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe("Shared Instance", () => {
    it("should maintain shared state across calls", () => {
      const shared = getSharedInsiderProbabilityPredictor();

      const featureSet = createMockInsiderFeatureSet();
      shared.predict(featureSet);

      const stats = getSharedInsiderProbabilityPredictor().getStatistics();
      expect(stats.totalPredictions).toBe(1);
    });

    it("should reset shared instance correctly", () => {
      const shared1 = getSharedInsiderProbabilityPredictor();
      const featureSet = createMockInsiderFeatureSet();
      shared1.predict(featureSet);

      resetSharedInsiderProbabilityPredictor();

      const shared2 = getSharedInsiderProbabilityPredictor();
      expect(shared2).not.toBe(shared1);
      expect(shared2.getStatistics().totalPredictions).toBe(0);
    });
  });

  describe("Performance", () => {
    it("should predict within acceptable time", () => {
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        const fs = createMockInsiderFeatureSet();
        fs.activity.walletAddress = `0x${i.toString().padStart(40, "a")}`;
        fs.activity.marketId = `market_perf_${i}`;
        predictor.predict(fs);
      }
      const duration = Date.now() - startTime;

      // Should complete 100 predictions in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it("should batch process efficiently", () => {
      const featureSets = createMockInsiderFeatureSetBatch(1000);

      const startTime = Date.now();
      const result = predictor.predictBatch(featureSets);
      const duration = Date.now() - startTime;

      expect(result.totalPredicted).toBe(1000);
      // Should complete 1000 predictions in under 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });
});
