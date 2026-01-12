/**
 * Unit tests for Historical Accuracy Scorer (DET-PAT-010)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PredictionOutcome,
  ConvictionLevel,
  AccuracyTier,
  AccuracySuspicionLevel,
  AccuracyWindow,
  ACCURACY_WINDOW_DURATION_MS,
  ACCURACY_TIER_THRESHOLDS,
  CONVICTION_WEIGHTS,
  DEFAULT_ACCURACY_CONFIG,
  HistoricalAccuracyScorer,
  createHistoricalAccuracyScorer,
  getSharedHistoricalAccuracyScorer,
  setSharedHistoricalAccuracyScorer,
  resetSharedHistoricalAccuracyScorer,
  addPredictionForAccuracy,
  addPredictionsForAccuracy,
  updatePredictionOutcomeForAccuracy,
  analyzeAccuracy,
  batchAnalyzeAccuracy,
  hasExceptionalAccuracy,
  getHighAccuracyWallets,
  getPotentialInsidersByAccuracy,
  getAccuracyRankings,
  getAccuracyScorerSummary,
  getAccuracyTierDescription,
  getAccuracySuspicionDescription,
  getConvictionLevelDescription,
  TrackedPrediction,
} from "../../src/detection/historical-accuracy-scorer";

// Test wallet addresses (valid EIP-55 checksummed)
const WALLET_1 = "0x1234567890123456789012345678901234567890";
const WALLET_2 = "0xabcdefABCDEF12345678901234567890ABCDEF12";
const WALLET_3 = "0x9876543210987654321098765432109876543210";
const INVALID_WALLET = "0xinvalid";

// Helper to create predictions
function createPrediction(
  overrides: Partial<TrackedPrediction> = {}
): TrackedPrediction {
  return {
    predictionId: `pred-${Date.now()}-${Math.random()}`,
    marketId: "market-1",
    walletAddress: WALLET_1,
    predictedOutcome: "YES",
    outcome: PredictionOutcome.PENDING,
    positionSize: 100,
    conviction: ConvictionLevel.MEDIUM,
    entryProbability: 0.5,
    predictionTimestamp: new Date(),
    ...overrides,
  };
}

// Helper to create resolved prediction
function createResolvedPrediction(
  correct: boolean,
  overrides: Partial<TrackedPrediction> = {}
): TrackedPrediction {
  const now = new Date();
  return {
    predictionId: `pred-${Date.now()}-${Math.random()}`,
    marketId: "market-1",
    walletAddress: WALLET_1,
    predictedOutcome: "YES",
    actualOutcome: correct ? "YES" : "NO",
    outcome: correct ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
    positionSize: 100,
    conviction: ConvictionLevel.MEDIUM,
    entryProbability: 0.5,
    predictionTimestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    resolutionTimestamp: now,
    realizedPnl: correct ? 50 : -50,
    roi: correct ? 50 : -50,
    ...overrides,
  };
}

describe("HistoricalAccuracyScorer", () => {
  let scorer: HistoricalAccuracyScorer;

  beforeEach(() => {
    scorer = new HistoricalAccuracyScorer();
    resetSharedHistoricalAccuracyScorer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor and Configuration
  // ============================================================================

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(scorer).toBeInstanceOf(HistoricalAccuracyScorer);
    });

    it("should create instance with custom config", () => {
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 5,
        exceptionalAccuracyThreshold: 85,
      });
      expect(customScorer).toBeInstanceOf(HistoricalAccuracyScorer);
    });

    it("should merge custom config with defaults", () => {
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 5,
      });
      // Default values should still be set
      const summary = customScorer.getSummary();
      expect(summary).toBeDefined();
    });
  });

  // ============================================================================
  // Prediction Management
  // ============================================================================

  describe("addPrediction", () => {
    it("should add a valid prediction", () => {
      const prediction = createPrediction();
      scorer.addPrediction(prediction);

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(1);
      expect(predictions[0]!.predictionId).toBe(prediction.predictionId);
    });

    it("should normalize wallet address", () => {
      const prediction = createPrediction({
        walletAddress: WALLET_1.toLowerCase(),
      });
      scorer.addPrediction(prediction);

      // Should retrieve with checksummed address
      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(1);
    });

    it("should throw error for invalid wallet address", () => {
      const prediction = createPrediction({
        walletAddress: INVALID_WALLET,
      });
      expect(() => scorer.addPrediction(prediction)).toThrow();
    });

    it("should update existing prediction", () => {
      const prediction = createPrediction({ predictionId: "pred-1" });
      scorer.addPrediction(prediction);

      const updatedPrediction = createPrediction({
        predictionId: "pred-1",
        positionSize: 200,
      });
      scorer.addPrediction(updatedPrediction);

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(1);
      expect(predictions[0]!.positionSize).toBe(200);
    });

    it("should trim predictions when over limit", () => {
      const customScorer = new HistoricalAccuracyScorer({
        maxPredictionsPerWallet: 5,
      });

      for (let i = 0; i < 10; i++) {
        customScorer.addPrediction(
          createPrediction({
            predictionId: `pred-${i}`,
            predictionTimestamp: new Date(Date.now() + i * 1000),
          })
        );
      }

      const predictions = customScorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(5);
    });

    it("should invalidate cache when adding prediction", () => {
      // Add initial prediction and analyze to cache
      scorer.addPrediction(createResolvedPrediction(true));
      for (let i = 0; i < 9; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }
      scorer.analyze(WALLET_1);

      // Add new prediction - should invalidate cache
      scorer.addPrediction(createResolvedPrediction(false));

      // Re-analyze - result should be different
      const result = scorer.analyze(WALLET_1);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBeLessThan(100);
    });

    it("should emit prediction-added event", () => {
      const handler = vi.fn();
      scorer.on("prediction-added", handler);

      scorer.addPrediction(createPrediction());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.any(String),
          prediction: expect.any(Object),
        })
      );
    });
  });

  describe("addPredictions", () => {
    it("should add multiple predictions", () => {
      const predictions = [
        createPrediction({ predictionId: "pred-1" }),
        createPrediction({ predictionId: "pred-2" }),
        createPrediction({ predictionId: "pred-3" }),
      ];

      scorer.addPredictions(predictions);

      const stored = scorer.getPredictions(WALLET_1);
      expect(stored).toHaveLength(3);
    });
  });

  describe("updatePredictionOutcome", () => {
    it("should update pending prediction to correct", () => {
      const prediction = createPrediction({ predictionId: "pred-1" });
      scorer.addPrediction(prediction);

      scorer.updatePredictionOutcome(
        WALLET_1,
        "pred-1",
        "YES",
        new Date(),
        50,
        50
      );

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions[0]!.outcome).toBe(PredictionOutcome.CORRECT);
      expect(predictions[0]!.actualOutcome).toBe("YES");
      expect(predictions[0]!.realizedPnl).toBe(50);
    });

    it("should update pending prediction to incorrect", () => {
      const prediction = createPrediction({ predictionId: "pred-1" });
      scorer.addPrediction(prediction);

      scorer.updatePredictionOutcome(
        WALLET_1,
        "pred-1",
        "NO",
        new Date(),
        -50,
        -50
      );

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions[0]!.outcome).toBe(PredictionOutcome.INCORRECT);
    });

    it("should mark cancelled predictions", () => {
      const prediction = createPrediction({ predictionId: "pred-1" });
      scorer.addPrediction(prediction);

      scorer.updatePredictionOutcome(WALLET_1, "pred-1", "CANCELLED");

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions[0]!.outcome).toBe(PredictionOutcome.CANCELLED);
    });

    it("should not update non-pending predictions", () => {
      const prediction = createResolvedPrediction(true, { predictionId: "pred-1" });
      scorer.addPrediction(prediction);

      scorer.updatePredictionOutcome(WALLET_1, "pred-1", "NO");

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions[0]!.outcome).toBe(PredictionOutcome.CORRECT);
    });

    it("should emit prediction-resolved event", () => {
      const handler = vi.fn();
      scorer.on("prediction-resolved", handler);

      const prediction = createPrediction({ predictionId: "pred-1" });
      scorer.addPrediction(prediction);
      scorer.updatePredictionOutcome(WALLET_1, "pred-1", "YES");

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPredictions", () => {
    it("should return empty array for wallet with no predictions", () => {
      const predictions = scorer.getPredictions(WALLET_2);
      expect(predictions).toEqual([]);
    });

    it("should return empty array for invalid address", () => {
      const predictions = scorer.getPredictions(INVALID_WALLET);
      expect(predictions).toEqual([]);
    });
  });

  describe("getResolvedPredictions", () => {
    it("should only return resolved predictions", () => {
      scorer.addPrediction(createPrediction()); // Pending
      scorer.addPrediction(createResolvedPrediction(true)); // Correct
      scorer.addPrediction(createResolvedPrediction(false)); // Incorrect
      scorer.addPrediction(
        createPrediction({ outcome: PredictionOutcome.CANCELLED })
      ); // Cancelled

      const resolved = scorer.getResolvedPredictions(WALLET_1);
      expect(resolved).toHaveLength(2);
    });
  });

  describe("clearPredictions", () => {
    it("should clear predictions for a wallet", () => {
      scorer.addPrediction(createPrediction());
      scorer.clearPredictions(WALLET_1);

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(0);
    });
  });

  // ============================================================================
  // Analysis
  // ============================================================================

  describe("analyze", () => {
    it("should throw error for invalid wallet address", () => {
      expect(() => scorer.analyze(INVALID_WALLET)).toThrow();
    });

    it("should return unknown tier with insufficient data", () => {
      scorer.addPrediction(createResolvedPrediction(true));

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.UNKNOWN);
    });

    it("should calculate raw accuracy correctly", () => {
      // Add 10 predictions: 8 correct, 2 incorrect
      for (let i = 0; i < 8; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }
      for (let i = 0; i < 2; i++) {
        scorer.addPrediction(createResolvedPrediction(false));
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(80);
    });

    it("should calculate weighted accuracy with conviction", () => {
      // Add high conviction correct and low conviction incorrect
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { conviction: ConvictionLevel.HIGH })
        );
      }
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(false, { conviction: ConvictionLevel.LOW })
        );
      }

      const result = scorer.analyze(WALLET_1);
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];
      // Weighted accuracy should be higher than raw because correct are high conviction
      expect(stats.weightedAccuracy).toBeGreaterThan(stats.rawAccuracy);
    });

    it("should calculate high conviction accuracy", () => {
      // Add 5 high conviction correct, 5 medium conviction
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { conviction: ConvictionLevel.HIGH })
        );
      }
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(false, { conviction: ConvictionLevel.MEDIUM })
        );
      }

      const result = scorer.analyze(WALLET_1);
      expect(
        result.windowStats[AccuracyWindow.ALL_TIME].highConvictionAccuracy
      ).toBe(100);
      expect(
        result.windowStats[AccuracyWindow.ALL_TIME].highConvictionCount
      ).toBe(5);
    });

    it("should calculate Brier score", () => {
      // Add predictions with known entry probabilities
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { entryProbability: 0.8 })
        );
      }

      const result = scorer.analyze(WALLET_1);
      // Brier score for p=0.8, actual=1: (0.8-1)^2 = 0.04
      expect(
        result.windowStats[AccuracyWindow.ALL_TIME].brierScore
      ).toBeCloseTo(0.04, 2);
    });

    it("should calculate time window stats correctly", () => {
      const now = Date.now();

      // Add old prediction (30 days ago)
      scorer.addPrediction(
        createResolvedPrediction(true, {
          resolutionTimestamp: new Date(
            now - 30 * 24 * 60 * 60 * 1000
          ),
        })
      );

      // Add recent prediction (1 day ago)
      for (let i = 0; i < 9; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            resolutionTimestamp: new Date(now - 24 * 60 * 60 * 1000),
          })
        );
      }

      const result = scorer.analyze(WALLET_1);
      expect(
        result.windowStats[AccuracyWindow.WEEK].totalPredictions
      ).toBe(9);
      expect(
        result.windowStats[AccuracyWindow.ALL_TIME].totalPredictions
      ).toBe(10);
    });

    it("should cache results", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      scorer.analyze(WALLET_1);
      scorer.analyze(WALLET_1);

      const summary = scorer.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it("should emit analysis-complete event", () => {
      const handler = vi.fn();
      scorer.on("analysis-complete", handler);

      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }
      scorer.analyze(WALLET_1);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit potential-insider event for high accuracy", () => {
      const handler = vi.fn();
      scorer.on("potential-insider", handler);

      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 10,
        minPredictionsForHighConfidence: 10,
        potentialInsiderAccuracyThreshold: 75,
      });
      customScorer.on("potential-insider", handler);

      // Add 30 correct predictions (all correct = 100% accuracy)
      for (let i = 0; i < 30; i++) {
        customScorer.addPrediction(createResolvedPrediction(true));
      }
      customScorer.analyze(WALLET_1);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("batchAnalyze", () => {
    it("should analyze multiple wallets", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
        scorer.addPrediction(
          createResolvedPrediction(false, { walletAddress: WALLET_2 })
        );
      }

      const result = scorer.batchAnalyze([WALLET_1, WALLET_2]);

      expect(result.results.size).toBe(2);
      expect(result.failed.size).toBe(0);
      expect(result.totalProcessed).toBe(2);
    });

    it("should handle failures gracefully", () => {
      const result = scorer.batchAnalyze([WALLET_1, INVALID_WALLET]);

      expect(result.failed.size).toBe(1);
      expect(result.failed.has(INVALID_WALLET)).toBe(true);
    });

    it("should calculate ranks when requested", () => {
      for (let i = 0; i < 15; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
        scorer.addPrediction(
          createResolvedPrediction(i < 10, { walletAddress: WALLET_2 })
        );
      }

      const result = scorer.batchAnalyze([WALLET_1, WALLET_2], {
        calculateRank: true,
      });

      const wallet1Result = result.results.get(
        "0x1234567890123456789012345678901234567890"
      );
      const wallet2Result = result.results.get(
        "0xAbcdefABCDEF12345678901234567890abcDEF12"
      );

      expect(wallet1Result?.accuracyRank).toBe(1);
      expect(wallet2Result?.accuracyRank).toBe(2);
    });
  });

  // ============================================================================
  // Tier Determination
  // ============================================================================

  describe("tier determination", () => {
    it("should classify EXCEPTIONAL tier (90%+)", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 9)); // 90% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.EXCEPTIONAL);
    });

    it("should classify EXCELLENT tier (80-90%)", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 8)); // 80% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.EXCELLENT);
    });

    it("should classify VERY_GOOD tier (70-80%)", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 7)); // 70% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.VERY_GOOD);
    });

    it("should classify GOOD tier (60-70%)", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 6)); // 60% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.GOOD);
    });

    it("should classify AVERAGE tier (50-55%)", () => {
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 10)); // 50% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.AVERAGE);
    });

    it("should classify VERY_POOR tier (<40%)", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 3)); // 30% accuracy
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.VERY_POOR);
    });
  });

  // ============================================================================
  // Category Analysis
  // ============================================================================

  describe("category analysis", () => {
    it("should calculate category-specific accuracy", () => {
      // Politics: 100% accuracy
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { marketCategory: "politics" })
        );
      }
      // Sports: 50% accuracy
      for (let i = 0; i < 4; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 2, { marketCategory: "sports" })
        );
      }

      const result = scorer.analyze(WALLET_1, {
        includeCategoryBreakdown: true,
      });

      const politicsStats = result.categoryStats.find(
        (c) => c.category === "politics"
      );
      const sportsStats = result.categoryStats.find(
        (c) => c.category === "sports"
      );

      expect(politicsStats?.rawAccuracy).toBe(100);
      expect(sportsStats?.rawAccuracy).toBe(50);
    });

    it("should identify top categories", () => {
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { marketCategory: "politics" })
        );
      }
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(false, { marketCategory: "sports" })
        );
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.topCategories).toContain("politics");
    });
  });

  // ============================================================================
  // Trend Analysis
  // ============================================================================

  describe("trend analysis", () => {
    it("should detect improving trend", () => {
      const now = Date.now();

      // Historical: 50% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 5, {
            resolutionTimestamp: new Date(now - (15 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      // Recent: 100% accuracy
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            resolutionTimestamp: new Date(now - i * 24 * 60 * 60 * 1000),
          })
        );
      }

      const result = scorer.analyze(WALLET_1, { includeTrendAnalysis: true });
      expect(result.trend.direction).toBe("improving");
      expect(result.trend.recentAccuracy).toBeGreaterThan(
        result.trend.historicalAccuracy
      );
    });

    it("should detect declining trend", () => {
      const now = Date.now();

      // Historical: 100% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            resolutionTimestamp: new Date(now - (15 - i) * 24 * 60 * 60 * 1000),
          })
        );
      }

      // Recent: 20% accuracy
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i === 0, {
            resolutionTimestamp: new Date(now - i * 24 * 60 * 60 * 1000),
          })
        );
      }

      const result = scorer.analyze(WALLET_1, { includeTrendAnalysis: true });
      expect(result.trend.direction).toBe("declining");
    });

    it("should detect stable trend", () => {
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i % 2 === 0, {
            resolutionTimestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })
        );
      }

      const result = scorer.analyze(WALLET_1, { includeTrendAnalysis: true });
      expect(result.trend.direction).toBe("stable");
    });
  });

  // ============================================================================
  // Anomaly Detection
  // ============================================================================

  describe("anomaly detection", () => {
    it("should detect exceptional accuracy anomaly", () => {
      for (let i = 0; i < 15; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      const result = scorer.analyze(WALLET_1);
      const exceptionalAnomaly = result.anomalies.find(
        (a) => a.type === "exceptional_accuracy"
      );
      expect(exceptionalAnomaly).toBeDefined();
    });

    it("should detect perfect high conviction anomaly", () => {
      // All high conviction predictions correct
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            conviction: ConvictionLevel.HIGH,
          })
        );
      }

      const result = scorer.analyze(WALLET_1);
      const hcAnomaly = result.anomalies.find(
        (a) => a.type === "perfect_high_conviction"
      );
      expect(hcAnomaly).toBeDefined();
    });

    it("should detect category expertise anomaly", () => {
      // Very high accuracy in one category
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { marketCategory: "politics" })
        );
      }

      const result = scorer.analyze(WALLET_1);
      const catAnomaly = result.anomalies.find(
        (a) => a.type === "category_expertise"
      );
      expect(catAnomaly).toBeDefined();
    });

    it("should detect timing advantage anomaly", () => {
      // High accuracy on predictions made close to resolution
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            hoursUntilResolution: 12, // Less than 24 hours
          })
        );
      }

      const result = scorer.analyze(WALLET_1);
      const timingAnomaly = result.anomalies.find(
        (a) => a.type === "timing_advantage"
      );
      expect(timingAnomaly).toBeDefined();
    });

    it("should detect contrarian success anomaly", () => {
      // High success rate on low probability bets
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            entryProbability: 0.2, // Betting on underdog
          })
        );
      }

      const result = scorer.analyze(WALLET_1);
      const contrarianAnomaly = result.anomalies.find(
        (a) => a.type === "contrarian_success"
      );
      expect(contrarianAnomaly).toBeDefined();
    });
  });

  // ============================================================================
  // Suspicion Calculation
  // ============================================================================

  describe("suspicion calculation", () => {
    it("should return NONE for insufficient data", () => {
      scorer.addPrediction(createResolvedPrediction(true));

      const result = scorer.analyze(WALLET_1);
      expect(result.suspicionLevel).toBe(AccuracySuspicionLevel.NONE);
      expect(result.suspicionScore).toBe(0);
    });

    it("should return CRITICAL for very high accuracy", () => {
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 10,
      });

      for (let i = 0; i < 30; i++) {
        customScorer.addPrediction(
          createResolvedPrediction(true, {
            conviction: ConvictionLevel.HIGH,
          })
        );
      }

      const result = customScorer.analyze(WALLET_1);
      expect(result.suspicionLevel).toBe(AccuracySuspicionLevel.CRITICAL);
    });

    it("should flag potential insider correctly", () => {
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 10,
        minPredictionsForHighConfidence: 15,
        potentialInsiderAccuracyThreshold: 75,
      });

      // Add 30 predictions, 90% correct
      for (let i = 0; i < 30; i++) {
        customScorer.addPrediction(createResolvedPrediction(i < 27));
      }

      const result = customScorer.analyze(WALLET_1);
      expect(result.isPotentialInsider).toBe(true);
    });
  });

  // ============================================================================
  // History Calculation
  // ============================================================================

  describe("history calculation", () => {
    it("should calculate historical data points", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, {
            resolutionTimestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })
        );
      }

      const result = scorer.analyze(WALLET_1, { includeHistory: true });
      expect(result.history).toHaveLength(10);
      expect(result.history[9]!.cumulativeAccuracy).toBe(100);
    });

    it("should skip history when disabled", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      const result = scorer.analyze(WALLET_1, { includeHistory: false });
      expect(result.history).toHaveLength(0);
    });
  });

  // ============================================================================
  // Queries
  // ============================================================================

  describe("hasExceptionalAccuracy", () => {
    it("should return true for exceptional accuracy", () => {
      for (let i = 0; i < 15; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      expect(scorer.hasExceptionalAccuracy(WALLET_1)).toBe(true);
    });

    it("should return false for average accuracy", () => {
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(createResolvedPrediction(i < 10));
      }

      expect(scorer.hasExceptionalAccuracy(WALLET_1)).toBe(false);
    });

    it("should return false for invalid address", () => {
      expect(scorer.hasExceptionalAccuracy(INVALID_WALLET)).toBe(false);
    });
  });

  describe("getHighAccuracyWallets", () => {
    it("should return wallets with high accuracy", () => {
      // Wallet 1: 90% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 9, { walletAddress: WALLET_1 })
        );
      }
      // Wallet 2: 50% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 5, { walletAddress: WALLET_2 })
        );
      }

      const highAccuracy = scorer.getHighAccuracyWallets(70);
      expect(highAccuracy).toHaveLength(1);
      expect(highAccuracy[0]!.walletAddress).toBe(
        "0x1234567890123456789012345678901234567890"
      );
    });

    it("should sort by accuracy descending", () => {
      // Wallet 1: 70% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 7, { walletAddress: WALLET_1 })
        );
      }
      // Wallet 2: 90% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createResolvedPrediction(i < 9, { walletAddress: WALLET_2 })
        );
      }

      const highAccuracy = scorer.getHighAccuracyWallets(60);
      expect(highAccuracy[0]!.walletAddress).toBe(
        "0xAbcdefABCDEF12345678901234567890abcDEF12"
      );
    });
  });

  describe("getPotentialInsiders", () => {
    it("should return potential insider wallets", () => {
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 10,
        minPredictionsForHighConfidence: 15,
        potentialInsiderAccuracyThreshold: 75,
      });

      // Wallet 1: High accuracy, many predictions
      for (let i = 0; i < 30; i++) {
        customScorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
      }
      // Wallet 2: Low accuracy
      for (let i = 0; i < 30; i++) {
        customScorer.addPrediction(
          createResolvedPrediction(i < 10, { walletAddress: WALLET_2 })
        );
      }

      const insiders = customScorer.getPotentialInsiders();
      expect(insiders.some((r) => r.walletAddress.toLowerCase() === WALLET_1.toLowerCase())).toBe(true);
    });
  });

  describe("getAccuracyRankings", () => {
    it("should return accuracy rankings", () => {
      // Add predictions for multiple wallets
      for (let i = 0; i < 15; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
        scorer.addPrediction(
          createResolvedPrediction(i < 10, { walletAddress: WALLET_2 })
        );
        scorer.addPrediction(
          createResolvedPrediction(i < 5, { walletAddress: WALLET_3 })
        );
      }

      const rankings = scorer.getAccuracyRankings(10);
      expect(rankings).toHaveLength(3);
      expect(rankings[0]!.rank).toBe(1);
      expect(rankings[2]!.rank).toBe(3);
    });

    it("should filter by minimum predictions", () => {
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
      }
      for (let i = 0; i < 15; i++) {
        scorer.addPrediction(
          createResolvedPrediction(true, { walletAddress: WALLET_2 })
        );
      }

      const rankings = scorer.getAccuracyRankings(10);
      expect(rankings).toHaveLength(1);
    });
  });

  // ============================================================================
  // Summary
  // ============================================================================

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }
      scorer.addPrediction(createPrediction()); // Pending

      const summary = scorer.getSummary();
      expect(summary.totalWallets).toBe(1);
      expect(summary.totalPredictions).toBe(11);
      expect(summary.resolvedPredictions).toBe(10);
      expect(summary.pendingPredictions).toBe(1);
    });

    it("should count tier distribution", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      const summary = scorer.getSummary();
      expect(summary.tierDistribution[AccuracyTier.EXCEPTIONAL]).toBe(1);
    });
  });

  // ============================================================================
  // Clear
  // ============================================================================

  describe("clear", () => {
    it("should clear all data", () => {
      scorer.addPrediction(createResolvedPrediction(true));
      scorer.analyze(WALLET_1);

      scorer.clear();

      const predictions = scorer.getPredictions(WALLET_1);
      expect(predictions).toHaveLength(0);

      const summary = scorer.getSummary();
      expect(summary.totalWallets).toBe(0);
      expect(summary.cacheHitRate).toBe(0);
    });
  });

  // ============================================================================
  // Factory and Convenience Functions
  // ============================================================================

  describe("factory functions", () => {
    it("createHistoricalAccuracyScorer should create instance", () => {
      const instance = createHistoricalAccuracyScorer();
      expect(instance).toBeInstanceOf(HistoricalAccuracyScorer);
    });

    it("getSharedHistoricalAccuracyScorer should return singleton", () => {
      const instance1 = getSharedHistoricalAccuracyScorer();
      const instance2 = getSharedHistoricalAccuracyScorer();
      expect(instance1).toBe(instance2);
    });

    it("setSharedHistoricalAccuracyScorer should update singleton", () => {
      const custom = new HistoricalAccuracyScorer();
      setSharedHistoricalAccuracyScorer(custom);
      expect(getSharedHistoricalAccuracyScorer()).toBe(custom);
    });

    it("resetSharedHistoricalAccuracyScorer should reset singleton", () => {
      const before = getSharedHistoricalAccuracyScorer();
      resetSharedHistoricalAccuracyScorer();
      const after = getSharedHistoricalAccuracyScorer();
      expect(before).not.toBe(after);
    });
  });

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedHistoricalAccuracyScorer();
    });

    it("addPredictionForAccuracy should add to shared instance", () => {
      addPredictionForAccuracy(createPrediction());
      const predictions = getSharedHistoricalAccuracyScorer().getPredictions(
        WALLET_1
      );
      expect(predictions).toHaveLength(1);
    });

    it("addPredictionsForAccuracy should add multiple", () => {
      addPredictionsForAccuracy([createPrediction(), createPrediction()]);
      const predictions = getSharedHistoricalAccuracyScorer().getPredictions(
        WALLET_1
      );
      expect(predictions).toHaveLength(2);
    });

    it("updatePredictionOutcomeForAccuracy should update", () => {
      addPredictionForAccuracy(createPrediction({ predictionId: "pred-1" }));
      updatePredictionOutcomeForAccuracy(WALLET_1, "pred-1", "YES");

      const predictions = getSharedHistoricalAccuracyScorer().getPredictions(
        WALLET_1
      );
      expect(predictions[0]!.outcome).toBe(PredictionOutcome.CORRECT);
    });

    it("analyzeAccuracy should use shared instance", () => {
      for (let i = 0; i < 10; i++) {
        addPredictionForAccuracy(createResolvedPrediction(true));
      }
      const result = analyzeAccuracy(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.EXCEPTIONAL);
    });

    it("batchAnalyzeAccuracy should use shared instance", () => {
      for (let i = 0; i < 10; i++) {
        addPredictionForAccuracy(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
        addPredictionForAccuracy(
          createResolvedPrediction(true, { walletAddress: WALLET_2 })
        );
      }
      const result = batchAnalyzeAccuracy([WALLET_1, WALLET_2]);
      expect(result.results.size).toBe(2);
    });

    it("hasExceptionalAccuracy should use shared instance", () => {
      for (let i = 0; i < 10; i++) {
        addPredictionForAccuracy(createResolvedPrediction(true));
      }
      expect(hasExceptionalAccuracy(WALLET_1)).toBe(true);
    });

    it("getHighAccuracyWallets should use shared instance", () => {
      for (let i = 0; i < 10; i++) {
        addPredictionForAccuracy(createResolvedPrediction(true));
      }
      const wallets = getHighAccuracyWallets(80);
      expect(wallets).toHaveLength(1);
    });

    it("getPotentialInsidersByAccuracy should use shared instance", () => {
      resetSharedHistoricalAccuracyScorer();
      const customScorer = new HistoricalAccuracyScorer({
        minPredictionsForAnalysis: 10,
        minPredictionsForHighConfidence: 15,
        potentialInsiderAccuracyThreshold: 75,
      });
      setSharedHistoricalAccuracyScorer(customScorer);

      for (let i = 0; i < 30; i++) {
        addPredictionForAccuracy(createResolvedPrediction(true));
      }
      const insiders = getPotentialInsidersByAccuracy();
      expect(insiders.length).toBeGreaterThan(0);
    });

    it("getAccuracyRankings should use shared instance", () => {
      for (let i = 0; i < 15; i++) {
        addPredictionForAccuracy(
          createResolvedPrediction(true, { walletAddress: WALLET_1 })
        );
        addPredictionForAccuracy(
          createResolvedPrediction(i < 10, { walletAddress: WALLET_2 })
        );
      }
      const rankings = getAccuracyRankings(10);
      expect(rankings.length).toBe(2);
    });

    it("getAccuracyScorerSummary should use shared instance", () => {
      addPredictionForAccuracy(createResolvedPrediction(true));
      const summary = getAccuracyScorerSummary();
      expect(summary.totalWallets).toBe(1);
    });
  });

  // ============================================================================
  // Description Functions
  // ============================================================================

  describe("description functions", () => {
    it("getAccuracyTierDescription should return descriptions", () => {
      expect(getAccuracyTierDescription(AccuracyTier.UNKNOWN)).toContain(
        "Unknown"
      );
      expect(getAccuracyTierDescription(AccuracyTier.EXCEPTIONAL)).toContain(
        "90%+"
      );
      expect(getAccuracyTierDescription(AccuracyTier.AVERAGE)).toContain(
        "random"
      );
    });

    it("getAccuracySuspicionDescription should return descriptions", () => {
      expect(
        getAccuracySuspicionDescription(AccuracySuspicionLevel.NONE)
      ).toContain("No suspicious");
      expect(
        getAccuracySuspicionDescription(AccuracySuspicionLevel.CRITICAL)
      ).toContain("Highly suspicious");
    });

    it("getConvictionLevelDescription should return descriptions", () => {
      expect(getConvictionLevelDescription(ConvictionLevel.VERY_LOW)).toContain(
        "5%"
      );
      expect(getConvictionLevelDescription(ConvictionLevel.VERY_HIGH)).toContain(
        "75%"
      );
    });
  });

  // ============================================================================
  // Constants
  // ============================================================================

  describe("constants", () => {
    it("should export window durations", () => {
      expect(ACCURACY_WINDOW_DURATION_MS[AccuracyWindow.DAY]).toBe(
        24 * 60 * 60 * 1000
      );
      expect(ACCURACY_WINDOW_DURATION_MS[AccuracyWindow.ALL_TIME]).toBe(
        Infinity
      );
    });

    it("should export tier thresholds", () => {
      expect(ACCURACY_TIER_THRESHOLDS[AccuracyTier.EXCEPTIONAL]).toBe(100);
      expect(ACCURACY_TIER_THRESHOLDS[AccuracyTier.AVERAGE]).toBe(55);
    });

    it("should export conviction weights", () => {
      expect(CONVICTION_WEIGHTS[ConvictionLevel.VERY_HIGH]).toBe(2.0);
      expect(CONVICTION_WEIGHTS[ConvictionLevel.VERY_LOW]).toBe(0.2);
    });

    it("should export default config", () => {
      expect(DEFAULT_ACCURACY_CONFIG.minPredictionsForAnalysis).toBe(10);
      expect(DEFAULT_ACCURACY_CONFIG.exceptionalAccuracyThreshold).toBe(80);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty wallet", () => {
      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.UNKNOWN);
      expect(result.totalPredictions).toBe(0);
    });

    it("should handle all cancelled predictions", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createPrediction({ outcome: PredictionOutcome.CANCELLED })
        );
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.UNKNOWN);
    });

    it("should handle all pending predictions", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createPrediction());
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.UNKNOWN);
      expect(result.totalPredictions).toBe(10);
    });

    it("should handle 100% incorrect predictions", () => {
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(createResolvedPrediction(false));
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.VERY_POOR);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(0);
    });

    it("should handle predictions with missing optional fields", () => {
      scorer.addPrediction({
        predictionId: "pred-1",
        marketId: "market-1",
        walletAddress: WALLET_1,
        predictedOutcome: "YES",
        actualOutcome: "YES",
        outcome: PredictionOutcome.CORRECT,
        positionSize: 100,
        conviction: ConvictionLevel.MEDIUM,
        entryProbability: 0.5,
        predictionTimestamp: new Date(),
        resolutionTimestamp: new Date(),
        // No optional fields
      });

      for (let i = 0; i < 9; i++) {
        scorer.addPrediction(createResolvedPrediction(true));
      }

      const result = scorer.analyze(WALLET_1);
      expect(result.tier).toBe(AccuracyTier.EXCEPTIONAL);
    });

    it("should handle events disabled", () => {
      const silentScorer = new HistoricalAccuracyScorer({
        enableEvents: false,
      });

      const handler = vi.fn();
      silentScorer.on("prediction-added", handler);

      silentScorer.addPrediction(createPrediction());

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
