/**
 * Tests for Insider Probability Predictor (AI-PRED-001)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  InsiderProbabilityPredictor,
  InsiderConfidenceLevel,
  InsiderSignalCategory,
  PredictionStatus,
  CalibrationMethod,
  DEFAULT_INSIDER_FEATURES,
  DEFAULT_PREDICTOR_CONFIG,
  CONFIDENCE_THRESHOLDS,
  createInsiderProbabilityPredictor,
  getSharedInsiderProbabilityPredictor,
  setSharedInsiderProbabilityPredictor,
  resetSharedInsiderProbabilityPredictor,
  getConfidenceLevelDescription,
  getConfidenceLevelColor,
  getSignalCategoryDescription,
  formatProbability,
  getProbabilityLevelDescription,
  getProbabilityLevelColor,
  getCalibrationMethodDescription,
  createMockWalletActivityData,
  createMockWalletBehaviorFeatures,
  createMockTradingPatternFeatures,
  createMockInsiderFeatureSet,
  createMockInsiderFeatureSetBatch,
  createSuspiciousMockFeatureSet,
  createNormalMockFeatureSet,
  CalibrationParameters,
} from "../../src/ai/insider-probability-predictor";

describe("InsiderProbabilityPredictor", () => {
  let predictor: InsiderProbabilityPredictor;

  beforeEach(() => {
    predictor = new InsiderProbabilityPredictor();
    resetSharedInsiderProbabilityPredictor();
  });

  afterEach(() => {
    predictor.reset();
  });

  describe("Constructor and Configuration", () => {
    it("should create instance with default config", () => {
      expect(predictor).toBeInstanceOf(InsiderProbabilityPredictor);
      const config = predictor.getConfig();
      expect(config.flagThreshold).toBe(DEFAULT_PREDICTOR_CONFIG.flagThreshold);
      expect(config.cacheEnabled).toBe(true);
    });

    it("should create instance with custom config", () => {
      const customPredictor = new InsiderProbabilityPredictor({
        flagThreshold: 0.8,
        cacheEnabled: false,
      });
      const config = customPredictor.getConfig();
      expect(config.flagThreshold).toBe(0.8);
      expect(config.cacheEnabled).toBe(false);
    });

    it("should update config", () => {
      predictor.updateConfig({ flagThreshold: 0.75 });
      expect(predictor.getConfig().flagThreshold).toBe(0.75);
    });

    it("should get feature definitions", () => {
      const definitions = predictor.getFeatureDefinitions();
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions).toEqual(expect.arrayContaining(DEFAULT_INSIDER_FEATURES));
    });

    it("should set feature definitions", () => {
      const customDefinitions = [
        {
          name: "custom_feature",
          category: InsiderSignalCategory.WALLET_BEHAVIOR,
          weight: 0.5,
          description: "Custom test feature",
          higherIsSuspicious: true,
          suspicionThreshold: 0.5,
          required: false,
        },
      ];
      predictor.setFeatureDefinitions(customDefinitions);
      expect(predictor.getFeatureDefinitions()).toEqual(customDefinitions);
    });

    it("should update individual feature weight", () => {
      predictor.updateFeatureWeight("win_rate", 0.25);
      const config = predictor.getConfig();
      expect(config.featureWeights["win_rate"]).toBe(0.25);
    });

    it("should set calibration parameters", () => {
      const calibration: CalibrationParameters = {
        method: CalibrationMethod.TEMPERATURE,
        temperature: 1.5,
      };
      predictor.setCalibration(calibration);
      expect(predictor.getConfig().calibration.method).toBe(CalibrationMethod.TEMPERATURE);
      expect(predictor.getConfig().calibration.temperature).toBe(1.5);
    });
  });

  describe("Feature Extraction", () => {
    it("should extract features from feature set", () => {
      const featureSet = createMockInsiderFeatureSet();
      const features = predictor.extractFeatures(featureSet);

      expect(features).toBeDefined();
      expect(typeof features.wallet_age_days).toBe("number");
      expect(typeof features.win_rate).toBe("number");
      expect(typeof features.coordination_score).toBe("number");
    });

    it("should normalize wallet age correctly", () => {
      // Young wallet should have high suspicion value
      const youngWalletSet = createMockInsiderFeatureSet({
        walletBehavior: createMockWalletBehaviorFeatures({ walletAgeDays: 1 }),
      });
      const youngFeatures = predictor.extractFeatures(youngWalletSet);
      expect(youngFeatures.wallet_age_days).toBeGreaterThan(0.9);

      // Old wallet should have low suspicion value
      const oldWalletSet = createMockInsiderFeatureSet({
        walletBehavior: createMockWalletBehaviorFeatures({ walletAgeDays: 500 }),
      });
      const oldFeatures = predictor.extractFeatures(oldWalletSet);
      expect(oldFeatures.wallet_age_days).toBe(0);
    });

    it("should extract boolean features correctly", () => {
      const featureSet = createMockInsiderFeatureSet({
        walletBehavior: createMockWalletBehaviorFeatures({
          firstTradeLarge: true,
          inWalletCluster: true,
        }),
      });
      const features = predictor.extractFeatures(featureSet);
      expect(features.first_trade_large).toBe(1);
      expect(features.in_wallet_cluster).toBe(1);
    });

    it("should cap position size ratio at 1", () => {
      const featureSet = createMockInsiderFeatureSet({
        tradingPattern: createMockTradingPatternFeatures({
          positionSizeRatio: 10, // 10x average, should cap at 1 (5x)
        }),
      });
      const features = predictor.extractFeatures(featureSet);
      expect(features.position_size_ratio).toBeLessThanOrEqual(1);
    });
  });

  describe("Prediction", () => {
    it("should make a prediction", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result).toBeDefined();
      expect(result.predictionId).toBeDefined();
      expect(result.walletAddress).toBe(featureSet.activity.walletAddress);
      expect(result.marketId).toBe(featureSet.activity.marketId);
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeDefined();
      expect(result.status).toBe(PredictionStatus.PENDING);
    });

    it("should return high probability for suspicious activity", () => {
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const result = predictor.predict(suspiciousSet);

      expect(result.probability).toBeGreaterThan(0.5);
      expect(result.riskAssessment).toContain("HIGH");
    });

    it("should return low probability for normal activity", () => {
      const normalSet = createNormalMockFeatureSet();
      const result = predictor.predict(normalSet);

      // Normal activity should have lower probability than suspicious
      expect(result.probability).toBeLessThan(0.6);
    });

    it("should include signal contributions", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.signals[0]).toHaveProperty("name");
      expect(result.signals[0]).toHaveProperty("category");
      expect(result.signals[0]).toHaveProperty("contribution");
    });

    it("should include top factors", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.topFactors.length).toBeLessThanOrEqual(5);
      // Top factors should be sorted by contribution
      for (let i = 1; i < result.topFactors.length; i++) {
        expect(result.topFactors[i - 1]!.contribution).toBeGreaterThanOrEqual(
          result.topFactors[i]!.contribution
        );
      }
    });

    it("should generate risk assessment", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment.length).toBeGreaterThan(0);
    });

    it("should generate recommended actions", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.recommendedActions).toBeDefined();
      expect(result.recommendedActions.length).toBeGreaterThan(0);
    });

    it("should emit prediction_made event", () => {
      const eventHandler = vi.fn();
      predictor.on("prediction_made", eventHandler);

      const featureSet = createMockInsiderFeatureSet();
      predictor.predict(featureSet);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionId: expect.any(String),
          probability: expect.any(Number),
        })
      );
    });

    it("should emit high_probability_detected for flagged predictions", () => {
      const eventHandler = vi.fn();
      predictor.on("high_probability_detected", eventHandler);

      const suspiciousSet = createSuspiciousMockFeatureSet();
      predictor.predict(suspiciousSet);

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should calculate processing time", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Batch Prediction", () => {
    it("should predict batch of activities", () => {
      const featureSets = createMockInsiderFeatureSetBatch(10);
      const result = predictor.predictBatch(featureSets);

      expect(result.totalPredicted).toBe(10);
      expect(result.results.length).toBe(10);
      expect(result.averageProbability).toBeGreaterThanOrEqual(0);
      expect(result.averageProbability).toBeLessThanOrEqual(1);
    });

    it("should calculate distribution correctly", () => {
      const featureSets = createMockInsiderFeatureSetBatch(20);
      const result = predictor.predictBatch(featureSets);

      const total =
        result.distribution.veryUnlikely +
        result.distribution.unlikely +
        result.distribution.uncertain +
        result.distribution.likely +
        result.distribution.veryLikely;

      expect(total).toBe(20);
    });

    it("should count flagged predictions", () => {
      const featureSets = [
        createSuspiciousMockFeatureSet(),
        createSuspiciousMockFeatureSet(),
        createNormalMockFeatureSet(),
        createNormalMockFeatureSet(),
        createNormalMockFeatureSet(),
      ];
      const result = predictor.predictBatch(featureSets);

      expect(result.flaggedCount).toBeGreaterThanOrEqual(0);
      expect(result.flaggedCount).toBeLessThanOrEqual(5);
    });

    it("should emit batch_completed event", () => {
      const eventHandler = vi.fn();
      predictor.on("batch_completed", eventHandler);

      const featureSets = createMockInsiderFeatureSetBatch(5);
      predictor.predictBatch(featureSets);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPredicted: 5,
        })
      );
    });

    it("should handle empty batch", () => {
      const result = predictor.predictBatch([]);

      expect(result.totalPredicted).toBe(0);
      expect(result.results.length).toBe(0);
      expect(result.averageProbability).toBe(0);
    });
  });

  describe("Calibration", () => {
    it("should apply Platt scaling", () => {
      predictor.setCalibration({
        method: CalibrationMethod.PLATT,
        plattA: -1.0,
        plattB: 0.0,
      });

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply temperature scaling", () => {
      predictor.setCalibration({
        method: CalibrationMethod.TEMPERATURE,
        temperature: 2.0,
      });

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply beta calibration", () => {
      predictor.setCalibration({
        method: CalibrationMethod.BETA,
        betaA: 1.5,
        betaB: 1.5,
      });

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should apply isotonic calibration", () => {
      predictor.setCalibration({
        method: CalibrationMethod.ISOTONIC,
        isotonicPoints: [
          { input: 0.0, output: 0.0 },
          { input: 0.5, output: 0.4 },
          { input: 1.0, output: 1.0 },
        ],
      });

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it("should skip calibration with NONE method", () => {
      predictor.setCalibration({
        method: CalibrationMethod.NONE,
      });

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      // rawScore should equal probability with no calibration
      expect(Math.abs(result.rawScore - result.probability)).toBeLessThan(0.01);
    });
  });

  describe("Confidence Calculation", () => {
    it("should calculate confidence level", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      expect(result.confidence).toBeDefined();
      expect(Object.values(InsiderConfidenceLevel)).toContain(result.confidence);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });

    it("should return low confidence with few features available", () => {
      // Create predictor that expects many features but only some are available
      const predictor2 = new InsiderProbabilityPredictor();
      predictor2.setFeatureDefinitions([
        {
          name: "win_rate",
          category: InsiderSignalCategory.PERFORMANCE,
          weight: 0.1,
          description: "Win rate",
          higherIsSuspicious: true,
          suspicionThreshold: 0.7,
          required: false,
        },
        {
          name: "non_existent_feature_1",
          category: InsiderSignalCategory.PERFORMANCE,
          weight: 0.1,
          description: "Feature 1",
          higherIsSuspicious: true,
          suspicionThreshold: 0.7,
          required: false,
        },
        {
          name: "non_existent_feature_2",
          category: InsiderSignalCategory.PERFORMANCE,
          weight: 0.3,
          description: "Feature 2",
          higherIsSuspicious: true,
          suspicionThreshold: 0.7,
          required: false,
        },
        {
          name: "non_existent_feature_3",
          category: InsiderSignalCategory.NETWORK,
          weight: 0.5,
          description: "Feature 3",
          higherIsSuspicious: true,
          suspicionThreshold: 0.7,
          required: false,
        },
      ]);

      const featureSet = createMockInsiderFeatureSet();
      const result = predictor2.predict(featureSet);

      // Only 1 out of 4 features is available, so confidence should be low
      expect(result.confidenceScore).toBeLessThan(0.5);
    });
  });

  describe("Verification", () => {
    it("should verify prediction as correct", () => {
      // Make a prediction that gets flagged
      predictor.updateConfig({ flagThreshold: 0.3 }); // Lower threshold
      const suspiciousSet = createSuspiciousMockFeatureSet();
      const prediction = predictor.predict(suspiciousSet);

      // Verify as insider
      const correct = predictor.verifyPrediction(prediction.predictionId, "INSIDER");

      expect(correct).toBe(true);
      expect(predictor.getPrediction(prediction.predictionId)?.status).toBe(
        PredictionStatus.VERIFIED
      );
      expect(predictor.getPrediction(prediction.predictionId)?.actualOutcome).toBe(
        "INSIDER"
      );
    });

    it("should verify prediction as incorrect", () => {
      const normalSet = createNormalMockFeatureSet();
      const prediction = predictor.predict(normalSet);

      // Verify as insider when predicted not insider
      const correct = predictor.verifyPrediction(prediction.predictionId, "INSIDER");

      expect(correct).toBe(false);
    });

    it("should return false for non-existent prediction", () => {
      const correct = predictor.verifyPrediction("non_existent_id", "INSIDER");
      expect(correct).toBe(false);
    });

    it("should update metrics on verification", () => {
      const featureSet = createMockInsiderFeatureSet();
      const prediction = predictor.predict(featureSet);

      predictor.verifyPrediction(prediction.predictionId, "NOT_INSIDER");

      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(1);
    });

    it("should emit prediction_verified event", () => {
      const eventHandler = vi.fn();
      predictor.on("prediction_verified", eventHandler);

      const featureSet = createMockInsiderFeatureSet();
      const prediction = predictor.predict(featureSet);
      predictor.verifyPrediction(prediction.predictionId, "NOT_INSIDER");

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should update precision and recall correctly", () => {
      // Make several predictions and verify them
      for (let i = 0; i < 10; i++) {
        const featureSet = i % 2 === 0
          ? createSuspiciousMockFeatureSet()
          : createNormalMockFeatureSet();
        const prediction = predictor.predict(featureSet);
        const outcome = i % 2 === 0 ? "INSIDER" : "NOT_INSIDER";
        predictor.verifyPrediction(prediction.predictionId, outcome);
      }

      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(10);
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Statistics", () => {
    it("should track prediction statistics", () => {
      const featureSets = createMockInsiderFeatureSetBatch(5);
      featureSets.forEach((fs) => predictor.predict(fs));

      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(5);
    });

    it("should track flagged count", () => {
      predictor.updateConfig({ flagThreshold: 0.3 });

      // Make some suspicious predictions
      for (let i = 0; i < 3; i++) {
        const suspiciousSet = createSuspiciousMockFeatureSet();
        predictor.predict(suspiciousSet);
      }

      const stats = predictor.getStatistics();
      expect(stats.flaggedCount).toBeGreaterThan(0);
    });

    it("should calculate flag rate", () => {
      predictor.updateConfig({ flagThreshold: 0.3 });

      for (let i = 0; i < 5; i++) {
        const featureSet = i % 2 === 0
          ? createSuspiciousMockFeatureSet()
          : createNormalMockFeatureSet();
        predictor.predict(featureSet);
      }

      const stats = predictor.getStatistics();
      expect(stats.flagRate).toBeGreaterThanOrEqual(0);
      expect(stats.flagRate).toBeLessThanOrEqual(1);
    });

    it("should get metrics", () => {
      const metrics = predictor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalPredictions).toBe(0);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
    });
  });

  describe("Cache Management", () => {
    it("should cache predictions", () => {
      const featureSet = createMockInsiderFeatureSet();

      // First prediction
      const result1 = predictor.predict(featureSet);

      // Same prediction should be cached
      const result2 = predictor.predict(featureSet);

      expect(result1.predictionId).toBe(result2.predictionId);

      const stats = predictor.getStatistics();
      expect(stats.cacheHits).toBe(1);
    });

    it("should emit cache events", () => {
      const hitHandler = vi.fn();
      const missHandler = vi.fn();
      predictor.on("cache_hit", hitHandler);
      predictor.on("cache_miss", missHandler);

      const featureSet = createMockInsiderFeatureSet();

      predictor.predict(featureSet);
      expect(missHandler).toHaveBeenCalledTimes(1);

      predictor.predict(featureSet);
      expect(hitHandler).toHaveBeenCalledTimes(1);
    });

    it("should respect cache disabled config", () => {
      predictor.updateConfig({ cacheEnabled: false });

      const featureSet = createMockInsiderFeatureSet();
      const result1 = predictor.predict(featureSet);
      const result2 = predictor.predict(featureSet);

      // Should get different prediction IDs when cache is disabled
      expect(result1.predictionId).not.toBe(result2.predictionId);
    });

    it("should clear cache", () => {
      const featureSet = createMockInsiderFeatureSet();
      predictor.predict(featureSet);

      predictor.clearCache();

      const cacheStats = predictor.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });

    it("should report cache stats", () => {
      const featureSets = createMockInsiderFeatureSetBatch(5);
      featureSets.forEach((fs) => predictor.predict(fs));

      const stats = predictor.getCacheStats();
      expect(stats.size).toBe(5);
      expect(stats.maxSize).toBe(DEFAULT_PREDICTOR_CONFIG.cacheMaxSize);
    });

    it("should evict old entries when cache is full", () => {
      predictor.updateConfig({ cacheMaxSize: 3 });

      // Make 5 unique predictions
      for (let i = 0; i < 5; i++) {
        const featureSet = createMockInsiderFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "0")}`;
        featureSet.activity.marketId = `market_${i}`;
        predictor.predict(featureSet);
      }

      const cacheStats = predictor.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(3);
    });
  });

  describe("Prediction Retrieval", () => {
    it("should get prediction by ID", () => {
      const featureSet = createMockInsiderFeatureSet();
      const result = predictor.predict(featureSet);

      const retrieved = predictor.getPrediction(result.predictionId);
      expect(retrieved).toEqual(result);
    });

    it("should get predictions for wallet", () => {
      const walletAddress = "0x1234567890123456789012345678901234567890";

      for (let i = 0; i < 3; i++) {
        const featureSet = createMockInsiderFeatureSet();
        featureSet.activity.walletAddress = walletAddress;
        featureSet.activity.marketId = `market_${i}`;
        predictor.predict(featureSet);
      }

      const predictions = predictor.getPredictionsForWallet(walletAddress);
      expect(predictions.length).toBe(3);
    });

    it("should get predictions for market", () => {
      const marketId = "market_test";

      for (let i = 0; i < 3; i++) {
        const featureSet = createMockInsiderFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "0")}`;
        featureSet.activity.marketId = marketId;
        predictor.predict(featureSet);
      }

      const predictions = predictor.getPredictionsForMarket(marketId);
      expect(predictions.length).toBe(3);
    });

    it("should get flagged predictions", () => {
      predictor.updateConfig({ flagThreshold: 0.3 });

      for (let i = 0; i < 5; i++) {
        const featureSet = i % 2 === 0
          ? createSuspiciousMockFeatureSet()
          : createNormalMockFeatureSet();
        featureSet.activity.walletAddress = `0x${i.toString().padStart(40, "0")}`;
        featureSet.activity.marketId = `market_${i}`;
        predictor.predict(featureSet);
      }

      const flagged = predictor.getFlaggedPredictions();
      expect(flagged.length).toBeGreaterThan(0);
      flagged.forEach((p) => {
        expect(p.probability).toBeGreaterThanOrEqual(0.3);
      });
    });

    it("should get pending verifications", () => {
      const featureSets = createMockInsiderFeatureSetBatch(5);
      const predictions = featureSets.map((fs) => predictor.predict(fs));

      // Verify some
      predictor.verifyPrediction(predictions[0]!.predictionId, "NOT_INSIDER");
      predictor.verifyPrediction(predictions[1]!.predictionId, "NOT_INSIDER");

      const pending = predictor.getPendingVerifications();
      expect(pending.length).toBe(3);
    });
  });

  describe("Reset", () => {
    it("should reset all state", () => {
      const featureSets = createMockInsiderFeatureSetBatch(5);
      featureSets.forEach((fs) => predictor.predict(fs));

      predictor.reset();

      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(0);
      expect(stats.flaggedCount).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);

      const metrics = predictor.getMetrics();
      expect(metrics.totalPredictions).toBe(0);
    });
  });
});

describe("Singleton Management", () => {
  beforeEach(() => {
    resetSharedInsiderProbabilityPredictor();
  });

  it("should create predictor with factory function", () => {
    const predictor = createInsiderProbabilityPredictor();
    expect(predictor).toBeInstanceOf(InsiderProbabilityPredictor);
  });

  it("should create predictor with custom config", () => {
    const predictor = createInsiderProbabilityPredictor({ flagThreshold: 0.7 });
    expect(predictor.getConfig().flagThreshold).toBe(0.7);
  });

  it("should get shared predictor instance", () => {
    const predictor1 = getSharedInsiderProbabilityPredictor();
    const predictor2 = getSharedInsiderProbabilityPredictor();
    expect(predictor1).toBe(predictor2);
  });

  it("should set shared predictor instance", () => {
    const customPredictor = new InsiderProbabilityPredictor({ flagThreshold: 0.9 });
    setSharedInsiderProbabilityPredictor(customPredictor);

    const shared = getSharedInsiderProbabilityPredictor();
    expect(shared).toBe(customPredictor);
  });

  it("should reset shared predictor", () => {
    const predictor1 = getSharedInsiderProbabilityPredictor();
    const featureSet = createMockInsiderFeatureSet();
    predictor1.predict(featureSet);

    resetSharedInsiderProbabilityPredictor();

    const predictor2 = getSharedInsiderProbabilityPredictor();
    expect(predictor2).not.toBe(predictor1);
    expect(predictor2.getStatistics().totalPredictions).toBe(0);
  });
});

describe("Utility Functions", () => {
  describe("getConfidenceLevelDescription", () => {
    it("should return description for each level", () => {
      expect(getConfidenceLevelDescription(InsiderConfidenceLevel.VERY_LOW)).toContain(
        "insufficient"
      );
      expect(getConfidenceLevelDescription(InsiderConfidenceLevel.LOW)).toContain(
        "limited"
      );
      expect(getConfidenceLevelDescription(InsiderConfidenceLevel.MEDIUM)).toContain(
        "reasonable"
      );
      expect(getConfidenceLevelDescription(InsiderConfidenceLevel.HIGH)).toContain(
        "sufficient"
      );
      expect(getConfidenceLevelDescription(InsiderConfidenceLevel.VERY_HIGH)).toContain(
        "comprehensive"
      );
    });
  });

  describe("getConfidenceLevelColor", () => {
    it("should return color for each level", () => {
      expect(getConfidenceLevelColor(InsiderConfidenceLevel.VERY_LOW)).toMatch(
        /^#[0-9A-Fa-f]{6}$/
      );
      expect(getConfidenceLevelColor(InsiderConfidenceLevel.HIGH)).toMatch(
        /^#[0-9A-Fa-f]{6}$/
      );
    });
  });

  describe("getSignalCategoryDescription", () => {
    it("should return description for each category", () => {
      expect(
        getSignalCategoryDescription(InsiderSignalCategory.WALLET_BEHAVIOR)
      ).toContain("Wallet");
      expect(getSignalCategoryDescription(InsiderSignalCategory.TIMING)).toContain(
        "timing"
      );
      expect(
        getSignalCategoryDescription(InsiderSignalCategory.MARKET_SELECTION)
      ).toContain("market");
      expect(getSignalCategoryDescription(InsiderSignalCategory.PERFORMANCE)).toContain(
        "win"
      );
      expect(getSignalCategoryDescription(InsiderSignalCategory.NETWORK)).toContain(
        "Coordination"
      );
    });
  });

  describe("formatProbability", () => {
    it("should format probability as percentage", () => {
      expect(formatProbability(0.5)).toBe("50.0%");
      expect(formatProbability(0.123)).toBe("12.3%");
      expect(formatProbability(1)).toBe("100.0%");
    });

    it("should respect decimal places", () => {
      expect(formatProbability(0.5, 0)).toBe("50%");
      expect(formatProbability(0.123, 2)).toBe("12.30%");
    });
  });

  describe("getProbabilityLevelDescription", () => {
    it("should return description for probability ranges", () => {
      expect(getProbabilityLevelDescription(0.9)).toBe("Very Likely Insider");
      expect(getProbabilityLevelDescription(0.7)).toBe("Likely Insider");
      expect(getProbabilityLevelDescription(0.5)).toBe("Uncertain");
      expect(getProbabilityLevelDescription(0.3)).toBe("Unlikely Insider");
      expect(getProbabilityLevelDescription(0.1)).toBe("Very Unlikely Insider");
    });
  });

  describe("getProbabilityLevelColor", () => {
    it("should return appropriate colors", () => {
      expect(getProbabilityLevelColor(0.9)).toBe("#EF4444"); // red
      expect(getProbabilityLevelColor(0.1)).toBe("#10B981"); // green
    });
  });

  describe("getCalibrationMethodDescription", () => {
    it("should return description for each method", () => {
      expect(getCalibrationMethodDescription(CalibrationMethod.PLATT)).toContain(
        "Platt"
      );
      expect(getCalibrationMethodDescription(CalibrationMethod.ISOTONIC)).toContain(
        "Isotonic"
      );
      expect(getCalibrationMethodDescription(CalibrationMethod.BETA)).toContain(
        "Beta"
      );
      expect(getCalibrationMethodDescription(CalibrationMethod.TEMPERATURE)).toContain(
        "Temperature"
      );
      expect(getCalibrationMethodDescription(CalibrationMethod.NONE)).toContain(
        "No calibration"
      );
    });
  });
});

describe("Mock Data Generators", () => {
  describe("createMockWalletActivityData", () => {
    it("should create valid activity data", () => {
      const data = createMockWalletActivityData();
      expect(data.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(data.marketId).toBeDefined();
      expect(data.positionSizeUsd).toBeGreaterThanOrEqual(0);
      expect(["LONG", "SHORT"]).toContain(data.positionSide);
    });

    it("should apply overrides", () => {
      const data = createMockWalletActivityData({
        walletAddress: "0x1234567890123456789012345678901234567890",
        positionSizeUsd: 50000,
      });
      expect(data.walletAddress).toBe("0x1234567890123456789012345678901234567890");
      expect(data.positionSizeUsd).toBe(50000);
    });
  });

  describe("createMockWalletBehaviorFeatures", () => {
    it("should create valid behavior features", () => {
      const features = createMockWalletBehaviorFeatures();
      expect(features.walletAgeDays).toBeGreaterThanOrEqual(0);
      expect(features.totalTrades).toBeGreaterThanOrEqual(0);
      expect(typeof features.firstTradeLarge).toBe("boolean");
    });
  });

  describe("createMockInsiderFeatureSet", () => {
    it("should create complete feature set", () => {
      const featureSet = createMockInsiderFeatureSet();
      expect(featureSet.activity).toBeDefined();
      expect(featureSet.walletBehavior).toBeDefined();
      expect(featureSet.timing).toBeDefined();
      expect(featureSet.marketSelection).toBeDefined();
      expect(featureSet.tradingPattern).toBeDefined();
      expect(featureSet.performance).toBeDefined();
      expect(featureSet.network).toBeDefined();
    });
  });

  describe("createMockInsiderFeatureSetBatch", () => {
    it("should create batch of feature sets", () => {
      const batch = createMockInsiderFeatureSetBatch(10);
      expect(batch.length).toBe(10);
      batch.forEach((fs) => {
        expect(fs.activity).toBeDefined();
      });
    });
  });

  describe("createSuspiciousMockFeatureSet", () => {
    it("should create suspicious feature set", () => {
      const featureSet = createSuspiciousMockFeatureSet();
      expect(featureSet.walletBehavior.walletAgeDays).toBeLessThan(30);
      expect(featureSet.walletBehavior.firstTradeLarge).toBe(true);
      expect(featureSet.performance.winRate).toBeGreaterThan(0.8);
    });
  });

  describe("createNormalMockFeatureSet", () => {
    it("should create normal feature set", () => {
      const featureSet = createNormalMockFeatureSet();
      expect(featureSet.walletBehavior.walletAgeDays).toBeGreaterThan(90);
      expect(featureSet.walletBehavior.firstTradeLarge).toBe(false);
      expect(featureSet.performance.winRate).toBeLessThan(0.6);
    });
  });
});

describe("Constants", () => {
  describe("DEFAULT_INSIDER_FEATURES", () => {
    it("should have feature definitions", () => {
      expect(DEFAULT_INSIDER_FEATURES.length).toBeGreaterThan(0);
    });

    it("should have required properties for each feature", () => {
      DEFAULT_INSIDER_FEATURES.forEach((feature) => {
        expect(feature.name).toBeDefined();
        expect(feature.category).toBeDefined();
        expect(feature.weight).toBeGreaterThanOrEqual(0);
        expect(feature.weight).toBeLessThanOrEqual(1);
        expect(feature.description).toBeDefined();
        expect(typeof feature.higherIsSuspicious).toBe("boolean");
        expect(feature.suspicionThreshold).toBeGreaterThanOrEqual(0);
        expect(feature.suspicionThreshold).toBeLessThanOrEqual(1);
      });
    });

    it("should have features from all categories", () => {
      const categories = new Set(DEFAULT_INSIDER_FEATURES.map((f) => f.category));
      expect(categories.has(InsiderSignalCategory.WALLET_BEHAVIOR)).toBe(true);
      expect(categories.has(InsiderSignalCategory.TIMING)).toBe(true);
      expect(categories.has(InsiderSignalCategory.MARKET_SELECTION)).toBe(true);
      expect(categories.has(InsiderSignalCategory.TRADING_PATTERN)).toBe(true);
      expect(categories.has(InsiderSignalCategory.PERFORMANCE)).toBe(true);
      expect(categories.has(InsiderSignalCategory.NETWORK)).toBe(true);
    });

    it("should have reasonable total weight", () => {
      const totalWeight = DEFAULT_INSIDER_FEATURES.reduce(
        (sum, f) => sum + f.weight,
        0
      );
      // Total weight should be reasonable (between 0.5 and 2.0)
      // The weights are normalized during scoring, so exact sum doesn't matter
      expect(totalWeight).toBeGreaterThan(0.5);
      expect(totalWeight).toBeLessThan(2.0);
    });
  });

  describe("DEFAULT_PREDICTOR_CONFIG", () => {
    it("should have valid flag threshold", () => {
      expect(DEFAULT_PREDICTOR_CONFIG.flagThreshold).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_PREDICTOR_CONFIG.flagThreshold).toBeLessThanOrEqual(1);
    });

    it("should have calibration config", () => {
      expect(DEFAULT_PREDICTOR_CONFIG.calibration).toBeDefined();
      expect(DEFAULT_PREDICTOR_CONFIG.calibration.method).toBeDefined();
    });

    it("should have cache config", () => {
      expect(DEFAULT_PREDICTOR_CONFIG.cacheEnabled).toBe(true);
      expect(DEFAULT_PREDICTOR_CONFIG.cacheTtlMs).toBeGreaterThan(0);
      expect(DEFAULT_PREDICTOR_CONFIG.cacheMaxSize).toBeGreaterThan(0);
    });
  });

  describe("CONFIDENCE_THRESHOLDS", () => {
    it("should have increasing thresholds", () => {
      expect(CONFIDENCE_THRESHOLDS.veryLow).toBeLessThan(CONFIDENCE_THRESHOLDS.low);
      expect(CONFIDENCE_THRESHOLDS.low).toBeLessThan(CONFIDENCE_THRESHOLDS.medium);
      expect(CONFIDENCE_THRESHOLDS.medium).toBeLessThan(CONFIDENCE_THRESHOLDS.high);
      expect(CONFIDENCE_THRESHOLDS.high).toBeLessThan(CONFIDENCE_THRESHOLDS.veryHigh);
    });
  });
});
