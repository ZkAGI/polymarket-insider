/**
 * Historical Accuracy Scorer E2E Tests (DET-PAT-010)
 *
 * End-to-end tests that verify the historical accuracy scorer works correctly
 * with realistic data scenarios and integration with other components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HistoricalAccuracyScorer,
  resetSharedHistoricalAccuracyScorer,
  addPredictionsForAccuracy,
  analyzeAccuracy,
  hasExceptionalAccuracy,
  getHighAccuracyWallets,
  getPotentialInsidersByAccuracy,
  getAccuracyScorerSummary,
  PredictionOutcome,
  ConvictionLevel,
  AccuracyTier,
  AccuracySuspicionLevel,
  AccuracyWindow,
  type TrackedPrediction,
} from "../../src/detection/historical-accuracy-scorer";

// ============================================================================
// Test Helpers
// ============================================================================

// Valid Ethereum addresses for testing
const WALLETS = {
  TRADER_1: "0x1111111111111111111111111111111111111111",
  TRADER_2: "0x2222222222222222222222222222222222222222",
  TRADER_3: "0x3333333333333333333333333333333333333333",
  TRADER_4: "0x4444444444444444444444444444444444444444",
  TRADER_5: "0x5555555555555555555555555555555555555555",
  INSIDER_SUSPECT: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  WHALE: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  RETAIL: "0xcccccccccccccccccccccccccccccccccccccccc",
};

interface PredictionOptions {
  walletAddress?: string;
  marketId?: string;
  marketCategory?: string;
  outcome?: PredictionOutcome;
  positionSize?: number;
  conviction?: ConvictionLevel;
  entryProbability?: number;
  predictedOutcome?: string;
  actualOutcome?: string;
  realizedPnl?: number;
  roi?: number;
  hoursUntilResolution?: number;
  daysAgo?: number;
}

function createTestPrediction(options: PredictionOptions = {}): TrackedPrediction {
  const {
    walletAddress = WALLETS.TRADER_1,
    marketId = `market-${Math.random().toString(36).substr(2, 9)}`,
    marketCategory = "crypto",
    outcome = PredictionOutcome.CORRECT,
    positionSize = 100,
    conviction = ConvictionLevel.MEDIUM,
    entryProbability = 0.5,
    predictedOutcome = "YES",
    actualOutcome = outcome === PredictionOutcome.CORRECT ? predictedOutcome : "NO",
    realizedPnl = outcome === PredictionOutcome.CORRECT ? positionSize : -positionSize,
    roi = outcome === PredictionOutcome.CORRECT ? 1.0 : -1.0,
    hoursUntilResolution,
    daysAgo = 0,
  } = options;

  const now = new Date();
  const resolutionTimestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const predictionTimestamp = new Date(
    resolutionTimestamp.getTime() - (hoursUntilResolution ?? 24) * 60 * 60 * 1000
  );

  return {
    predictionId: `pred-${Math.random().toString(36).substr(2, 12)}`,
    marketId,
    marketCategory,
    walletAddress,
    predictedOutcome,
    actualOutcome,
    outcome,
    positionSize,
    conviction,
    entryProbability,
    predictionTimestamp,
    resolutionTimestamp,
    hoursUntilResolution,
    realizedPnl,
    roi,
    resolutionProbability: outcome === PredictionOutcome.CORRECT ? 1 : 0,
  };
}

function createTraderPredictionHistory(
  walletAddress: string,
  config: {
    totalPredictions: number;
    accuracyRate: number;
    categories?: string[];
    highConvictionRate?: number;
    averageSize?: number;
    spreadDays?: number;
    contrarianRate?: number;
  }
): TrackedPrediction[] {
  const {
    totalPredictions,
    accuracyRate,
    categories = ["crypto"],
    highConvictionRate = 0,
    averageSize = 100,
    spreadDays = 30,
    contrarianRate = 0,
  } = config;

  const correctCount = Math.round(totalPredictions * (accuracyRate / 100));
  const predictions: TrackedPrediction[] = [];

  for (let i = 0; i < totalPredictions; i++) {
    const isCorrect = i < correctCount;
    const category = categories[i % categories.length];
    const isHighConviction = Math.random() < highConvictionRate;
    const isContrarian = Math.random() < contrarianRate;
    const daysAgo = Math.floor((spreadDays * i) / totalPredictions);

    predictions.push(
      createTestPrediction({
        walletAddress,
        marketCategory: category,
        outcome: isCorrect ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
        positionSize: isHighConviction ? averageSize * 10 : averageSize,
        conviction: isHighConviction
          ? ConvictionLevel.VERY_HIGH
          : ConvictionLevel.MEDIUM,
        entryProbability: isContrarian ? 0.2 : 0.5,
        daysAgo,
      })
    );
  }

  return predictions;
}

// ============================================================================
// E2E Tests
// ============================================================================

describe("Historical Accuracy Scorer E2E", () => {
  let scorer: HistoricalAccuracyScorer;

  beforeEach(() => {
    scorer = new HistoricalAccuracyScorer();
    resetSharedHistoricalAccuracyScorer();
  });

  afterEach(() => {
    scorer.clear();
  });

  // --------------------------------------------------------------------------
  // Realistic Trading Scenarios
  // --------------------------------------------------------------------------

  describe("Realistic Trading Scenarios", () => {
    it("should correctly analyze a typical retail trader", () => {
      // Retail trader: ~50% accuracy, small sizes, varied markets
      const predictions = createTraderPredictionHistory(WALLETS.RETAIL, {
        totalPredictions: 30,
        accuracyRate: 50,
        categories: ["crypto", "sports", "politics"],
        averageSize: 50,
        spreadDays: 60,
      });

      predictions.forEach((p) => scorer.addPrediction(p));
      const result = scorer.analyze(WALLETS.RETAIL);

      expect(result.tier).toBe(AccuracyTier.AVERAGE);
      expect([AccuracySuspicionLevel.NONE, AccuracySuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
      expect(result.isPotentialInsider).toBe(false);
      // Accuracy should be around 50% (rounding to nearest prediction)
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBeGreaterThanOrEqual(45);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBeLessThanOrEqual(55);
    });

    it("should correctly analyze a skilled trader with above-average performance", () => {
      // Skilled trader: ~65% accuracy, consistent sizes
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 50,
        accuracyRate: 66,
        categories: ["crypto"],
        averageSize: 200,
        spreadDays: 90,
      });

      predictions.forEach((p) => scorer.addPrediction(p));
      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.tier).toBe(AccuracyTier.GOOD);
      // 65% accuracy with 50 predictions might have LOW suspicion
      expect([AccuracySuspicionLevel.NONE, AccuracySuspicionLevel.LOW]).toContain(
        result.suspicionLevel
      );
      expect(result.isPotentialInsider).toBe(false);
    });

    it("should flag a potential insider with suspicious patterns", () => {
      // Potential insider: 90% accuracy, high conviction trades
      const predictions = createTraderPredictionHistory(WALLETS.INSIDER_SUSPECT, {
        totalPredictions: 35,
        accuracyRate: 92,
        categories: ["politics"],
        highConvictionRate: 0.8,
        averageSize: 1000,
        spreadDays: 30,
      });

      // Add time to resolution for some predictions (trades close to events)
      predictions.forEach((p, i) => {
        if (i % 2 === 0) {
          p.hoursUntilResolution = 12;
        }
      });

      predictions.forEach((p) => scorer.addPrediction(p));
      const result = scorer.analyze(WALLETS.INSIDER_SUSPECT);

      expect(result.tier).toBe(AccuracyTier.EXCEPTIONAL);
      expect(
        [AccuracySuspicionLevel.HIGH, AccuracySuspicionLevel.CRITICAL].includes(
          result.suspicionLevel
        )
      ).toBe(true);
      expect(result.isPotentialInsider).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });

    it("should correctly analyze a whale trader", () => {
      // Whale: large positions, moderate accuracy
      const predictions = createTraderPredictionHistory(WALLETS.WHALE, {
        totalPredictions: 20,
        accuracyRate: 55,
        categories: ["crypto", "politics"],
        averageSize: 50000,
        spreadDays: 60,
      });

      predictions.forEach((p) => scorer.addPrediction(p));
      const result = scorer.analyze(WALLETS.WHALE);

      expect([AccuracyTier.AVERAGE, AccuracyTier.ABOVE_AVERAGE]).toContain(
        result.tier
      );
      expect(result.windowStats[AccuracyWindow.ALL_TIME].totalPnl).not.toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Multi-Wallet Analysis
  // --------------------------------------------------------------------------

  describe("Multi-Wallet Analysis", () => {
    it("should correctly rank wallets by accuracy", () => {
      // Create traders with different accuracy rates
      const traders = [
        { wallet: WALLETS.TRADER_1, accuracyRate: 80 },
        { wallet: WALLETS.TRADER_2, accuracyRate: 60 },
        { wallet: WALLETS.TRADER_3, accuracyRate: 45 },
        { wallet: WALLETS.TRADER_4, accuracyRate: 70 },
        { wallet: WALLETS.TRADER_5, accuracyRate: 55 },
      ];

      traders.forEach(({ wallet, accuracyRate }) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 20,
          accuracyRate,
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const highAccuracyWallets = scorer.getHighAccuracyWallets(60);

      expect(highAccuracyWallets.length).toBe(3); // 80%, 70%, 60%
      expect(highAccuracyWallets[0]?.walletAddress.toLowerCase()).toBe(
        WALLETS.TRADER_1.toLowerCase()
      );
    });

    it("should batch analyze multiple wallets efficiently", () => {
      const walletAddresses = [
        WALLETS.TRADER_1,
        WALLETS.TRADER_2,
        WALLETS.TRADER_3,
      ];

      walletAddresses.forEach((wallet, idx) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 15,
          accuracyRate: 50 + idx * 10,
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const result = scorer.batchAnalyze(walletAddresses);

      expect(result.results.size).toBe(3);
      expect(result.failed.size).toBe(0);
      expect(result.totalProcessed).toBe(3);
    });

    it("should identify potential insiders among many wallets", () => {
      // Create a mix of normal and suspicious traders
      const normalTraders = [
        WALLETS.TRADER_1,
        WALLETS.TRADER_2,
        WALLETS.TRADER_3,
      ];
      const suspiciousTrader = WALLETS.INSIDER_SUSPECT;

      normalTraders.forEach((wallet) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 20,
          accuracyRate: 52,
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      // Create suspicious trader with exceptional performance
      const suspiciousPredictions = createTraderPredictionHistory(suspiciousTrader, {
        totalPredictions: 35,
        accuracyRate: 92,
        highConvictionRate: 0.9,
      });
      suspiciousPredictions.forEach((p) => scorer.addPrediction(p));

      const potentialInsiders = scorer.getPotentialInsiders();

      expect(potentialInsiders.length).toBeGreaterThanOrEqual(1);
      expect(
        potentialInsiders.some(
          (r) =>
            r.walletAddress.toLowerCase() === suspiciousTrader.toLowerCase()
        )
      ).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Category Specialization
  // --------------------------------------------------------------------------

  describe("Category Specialization", () => {
    it("should detect category specialization", () => {
      // Trader who specializes in politics with high accuracy
      const politicsPredictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 20,
        accuracyRate: 85,
        categories: ["politics"],
      });

      const cryptoPredictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 5,
        accuracyRate: 40,
        categories: ["crypto"],
      });

      [...politicsPredictions, ...cryptoPredictions].forEach((p) =>
        scorer.addPrediction(p)
      );

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.topCategories[0]).toBe("politics");

      const politicsStats = result.categoryStats.find(
        (c) => c.category === "politics"
      );
      expect(politicsStats?.rawAccuracy).toBe(85);

      const expertiseAnomaly = result.anomalies.find(
        (a) => a.type === "category_expertise"
      );
      expect(expertiseAnomaly).toBeDefined();
    });

    it("should track performance across multiple categories", () => {
      const categories = ["crypto", "politics", "sports", "entertainment"];

      categories.forEach((category, idx) => {
        const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
          totalPredictions: 10,
          accuracyRate: 40 + idx * 15, // 40%, 55%, 70%, 85%
          categories: [category],
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.categoryStats.length).toBe(4);

      const entertainmentStats = result.categoryStats.find(
        (c) => c.category === "entertainment"
      );
      // Due to rounding: 85% of 10 = 8.5 -> 9 wins = 90% or 8 wins = 80%
      expect(entertainmentStats?.rawAccuracy).toBeGreaterThanOrEqual(80);
      expect(entertainmentStats?.rawAccuracy).toBeLessThanOrEqual(90);
    });
  });

  // --------------------------------------------------------------------------
  // Time Window Analysis
  // --------------------------------------------------------------------------

  describe("Time Window Analysis", () => {
    it("should correctly calculate accuracy for different time windows", () => {
      // Old predictions (60+ days ago) - 40% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 4 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 70 + i,
          })
        );
      }

      // Recent predictions (within 7 days) - 80% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 8 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: i,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      // All-time should be 60% (12/20 correct)
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(60);

      // Week should have mostly recent predictions (daysAgo: 0-6)
      expect(result.windowStats[AccuracyWindow.WEEK].rawAccuracy).toBeGreaterThanOrEqual(80);

      // Month should only include recent 10 predictions (within 30 days)
      expect(result.windowStats[AccuracyWindow.MONTH].rawAccuracy).toBe(80);

      // Quarter should show improving trend (has both old and new)
      expect(result.trend.direction).toBe("improving");
    });
  });

  // --------------------------------------------------------------------------
  // Conviction Weighting
  // --------------------------------------------------------------------------

  describe("Conviction Weighting", () => {
    it("should weight high conviction predictions more heavily", () => {
      // Add 5 low conviction correct predictions
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.CORRECT,
            conviction: ConvictionLevel.LOW,
            positionSize: 10,
          })
        );
      }

      // Add 5 high conviction incorrect predictions
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.INCORRECT,
            conviction: ConvictionLevel.VERY_HIGH,
            positionSize: 1000,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];

      // Raw accuracy is 50% (5/10)
      expect(stats.rawAccuracy).toBe(50);

      // Weighted accuracy should be lower because high conviction losses
      // LOW weight = 0.5, VERY_HIGH weight = 2.0
      // Weighted correct: 5 * 0.5 = 2.5
      // Weighted total: 5 * 0.5 + 5 * 2.0 = 12.5
      // Weighted accuracy: 2.5/12.5 = 20%
      expect(stats.weightedAccuracy).toBeLessThan(stats.rawAccuracy);
    });

    it("should track high conviction accuracy separately", () => {
      // Normal trades: 50% accuracy
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 10 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            conviction: ConvictionLevel.MEDIUM,
            positionSize: 100,
          })
        );
      }

      // High conviction trades: 95% accuracy (suspicious)
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 19 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            conviction: ConvictionLevel.VERY_HIGH,
            positionSize: 5000,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      // Should detect high conviction accuracy anomaly
      const hcAnomaly = result.anomalies.find(
        (a) => a.type === "perfect_high_conviction"
      );
      expect(hcAnomaly).toBeDefined();
      expect(hcAnomaly?.severity).toBeGreaterThan(50);
    });
  });

  // --------------------------------------------------------------------------
  // Trend Analysis
  // --------------------------------------------------------------------------

  describe("Trend Analysis", () => {
    it("should detect improving trend", () => {
      // First 20 predictions: 30% accuracy
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 6 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 40 - i,
          })
        );
      }

      // Last 10 predictions: 80% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 8 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 10 - i,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.trend.direction).toBe("improving");
      expect(result.trend.recentAccuracy).toBeGreaterThan(
        result.trend.historicalAccuracy
      );
    });

    it("should detect declining trend", () => {
      // First 20 predictions: 80% accuracy
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 16 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 40 - i,
          })
        );
      }

      // Last 10 predictions: 20% accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 2 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 10 - i,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.trend.direction).toBe("declining");
      expect(result.trend.recentAccuracy).toBeLessThan(
        result.trend.historicalAccuracy
      );
    });
  });

  // --------------------------------------------------------------------------
  // Anomaly Detection
  // --------------------------------------------------------------------------

  describe("Anomaly Detection", () => {
    it("should detect timing advantage patterns", () => {
      // Add predictions made very close to resolution with high accuracy
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 9 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            hoursUntilResolution: 6, // 6 hours before resolution
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      const timingAnomaly = result.anomalies.find(
        (a) => a.type === "timing_advantage"
      );
      expect(timingAnomaly).toBeDefined();
      expect(timingAnomaly?.severity).toBeGreaterThan(50);
    });

    it("should detect contrarian success patterns", () => {
      // Add predictions where trader bets against low probability outcomes and wins
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 7 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            entryProbability: 0.2, // Betting on 20% probability outcomes
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      const contrarianAnomaly = result.anomalies.find(
        (a) => a.type === "contrarian_success"
      );
      expect(contrarianAnomaly).toBeDefined();
    });

    it("should detect sudden improvement patterns", () => {
      // Historical: 40% accuracy
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 8 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 60 - i,
          })
        );
      }

      // Recent: 90% accuracy - suspicious sudden improvement
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 9 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 10 - i,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      const improvementAnomaly = result.anomalies.find(
        (a) => a.type === "sudden_improvement"
      );
      expect(improvementAnomaly).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Brier Score Analysis
  // --------------------------------------------------------------------------

  describe("Brier Score Analysis", () => {
    it("should calculate correct Brier scores", () => {
      // Perfect predictions at 50% probability
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.CORRECT,
            entryProbability: 0.5,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];

      // Brier score for correct predictions at 0.5 probability = (0.5-1)^2 = 0.25
      expect(stats.brierScore).toBeCloseTo(0.25, 1);
    });

    it("should have lower Brier score for confident correct predictions", () => {
      // Correct predictions at 0.9 probability
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.CORRECT,
            entryProbability: 0.9,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];

      // Brier score for correct predictions at 0.9 probability = (0.9-1)^2 = 0.01
      expect(stats.brierScore).toBeCloseTo(0.01, 2);
    });
  });

  // --------------------------------------------------------------------------
  // Historical Data
  // --------------------------------------------------------------------------

  describe("Historical Data", () => {
    it("should generate correct historical accuracy data", () => {
      // Add 20 predictions with mixed outcomes
      for (let i = 0; i < 20; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i % 2 === 0 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
            daysAgo: 20 - i,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1, { includeHistory: true });

      expect(result.history.length).toBe(20);

      // Check that accuracy converges to 50%
      const lastDataPoint = result.history[result.history.length - 1];
      expect(lastDataPoint?.cumulativeAccuracy).toBe(50);
      expect(lastDataPoint?.correctPredictions).toBe(10);
      expect(lastDataPoint?.totalPredictions).toBe(20);
    });
  });

  // --------------------------------------------------------------------------
  // Rankings and Leaderboard
  // --------------------------------------------------------------------------

  describe("Rankings and Leaderboard", () => {
    it("should correctly rank wallets by weighted accuracy", () => {
      const traders = [
        { wallet: WALLETS.TRADER_1, accuracyRate: 80 },
        { wallet: WALLETS.TRADER_2, accuracyRate: 70 },
        { wallet: WALLETS.TRADER_3, accuracyRate: 60 },
        { wallet: WALLETS.TRADER_4, accuracyRate: 50 },
      ];

      traders.forEach(({ wallet, accuracyRate }) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 15,
          accuracyRate,
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const rankings = scorer.getAccuracyRankings(10);

      expect(rankings.length).toBe(4);
      expect(rankings[0]?.rank).toBe(1);
      expect(rankings[0]?.walletAddress.toLowerCase()).toBe(WALLETS.TRADER_1.toLowerCase());
      expect(rankings[3]?.rank).toBe(4);
      expect(rankings[3]?.walletAddress.toLowerCase()).toBe(WALLETS.TRADER_4.toLowerCase());
    });

    it("should assign correct percentile ranks", () => {
      const traders = [
        WALLETS.TRADER_1,
        WALLETS.TRADER_2,
        WALLETS.TRADER_3,
        WALLETS.TRADER_4,
        WALLETS.TRADER_5,
      ];

      traders.forEach((wallet, idx) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 15,
          accuracyRate: 50 + idx * 10, // 50%, 60%, 70%, 80%, 90%
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const rankings = scorer.getAccuracyRankings(10);

      // Top wallet should have high percentile
      expect(rankings[0]?.percentile).toBe(100);
      // Bottom wallet should have low percentile
      expect(rankings[4]?.percentile).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Integration with Shared Instance
  // --------------------------------------------------------------------------

  describe("Shared Instance Integration", () => {
    it("should work with shared scorer instance", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 15,
        accuracyRate: 70,
      });

      addPredictionsForAccuracy(predictions);

      const result = analyzeAccuracy(WALLETS.TRADER_1);
      // 70% of 15 = 10.5 -> rounds to 11 wins = 73.33% or 10 wins = 66.67%
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBeGreaterThanOrEqual(65);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBeLessThanOrEqual(75);

      const summary = getAccuracyScorerSummary();
      expect(summary.totalWallets).toBe(1);
      expect(summary.totalPredictions).toBe(15);
    });

    it("should correctly use convenience functions", () => {
      // Add a high accuracy wallet
      const insiderPredictions = createTraderPredictionHistory(WALLETS.INSIDER_SUSPECT, {
        totalPredictions: 35,
        accuracyRate: 93,
        highConvictionRate: 0.8,
      });
      addPredictionsForAccuracy(insiderPredictions);

      // Add a normal wallet
      const normalPredictions = createTraderPredictionHistory(WALLETS.RETAIL, {
        totalPredictions: 20,
        accuracyRate: 50,
      });
      addPredictionsForAccuracy(normalPredictions);

      expect(hasExceptionalAccuracy(WALLETS.INSIDER_SUSPECT)).toBe(true);
      expect(hasExceptionalAccuracy(WALLETS.RETAIL)).toBe(false);

      const highAccuracy = getHighAccuracyWallets(80);
      expect(highAccuracy.length).toBe(1);

      const insiders = getPotentialInsidersByAccuracy();
      expect(insiders.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Data Quality Scores
  // --------------------------------------------------------------------------

  describe("Data Quality Scores", () => {
    it("should assign high data quality for many predictions", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 100,
        accuracyRate: 55,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.dataQuality).toBe(100);
    });

    it("should assign low data quality for few predictions", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 12,
        accuracyRate: 55,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.dataQuality).toBeLessThanOrEqual(40);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle wallet with only correct predictions", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 10,
        accuracyRate: 100,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(100);
      expect(result.tier).toBe(AccuracyTier.EXCEPTIONAL);
    });

    it("should handle wallet with only incorrect predictions", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 10,
        accuracyRate: 0,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(0);
      expect(result.tier).toBe(AccuracyTier.VERY_POOR);
    });

    it("should handle rapid prediction additions", () => {
      // Add many predictions quickly
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 100,
        accuracyRate: 55,
      });

      predictions.forEach((p) => scorer.addPrediction(p));

      const result = scorer.analyze(WALLETS.TRADER_1);

      expect(result.totalPredictions).toBe(100);
      expect(result.dataQuality).toBe(100);
    });

    it("should handle prediction updates", () => {
      // Add initial prediction
      const prediction = createTestPrediction({
        walletAddress: WALLETS.TRADER_1,
        outcome: PredictionOutcome.CORRECT,
      });
      scorer.addPrediction(prediction);

      // Update same prediction to incorrect
      const updatedPrediction = {
        ...prediction,
        outcome: PredictionOutcome.INCORRECT,
        realizedPnl: -100,
      };
      scorer.addPrediction(updatedPrediction);

      const result = scorer.analyze(WALLETS.TRADER_1);

      // Should only have 1 prediction
      expect(result.totalPredictions).toBe(1);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].incorrectPredictions).toBe(1);
    });

    it("should handle cancelled predictions", () => {
      // Add some resolved predictions
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: i < 5 ? PredictionOutcome.CORRECT : PredictionOutcome.INCORRECT,
          })
        );
      }

      // Add cancelled predictions
      for (let i = 0; i < 5; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.CANCELLED,
          })
        );
      }

      const result = scorer.analyze(WALLETS.TRADER_1);
      const stats = result.windowStats[AccuracyWindow.ALL_TIME];

      // Cancelled predictions should not affect accuracy
      expect(stats.rawAccuracy).toBe(50); // 5/10
      expect(stats.cancelledPredictions).toBe(5);
    });

    it("should handle pending predictions", () => {
      // Add resolved predictions
      for (let i = 0; i < 10; i++) {
        scorer.addPrediction(
          createTestPrediction({
            walletAddress: WALLETS.TRADER_1,
            outcome: PredictionOutcome.CORRECT,
          })
        );
      }

      // Add pending predictions
      for (let i = 0; i < 5; i++) {
        const pending: TrackedPrediction = {
          predictionId: `pending-${i}`,
          marketId: `market-${i}`,
          walletAddress: WALLETS.TRADER_1,
          predictedOutcome: "YES",
          outcome: PredictionOutcome.PENDING,
          positionSize: 100,
          conviction: ConvictionLevel.MEDIUM,
          entryProbability: 0.5,
          predictionTimestamp: new Date(),
        };
        scorer.addPrediction(pending);
      }

      const result = scorer.analyze(WALLETS.TRADER_1);

      // Total predictions includes pending, but accuracy only from resolved
      expect(result.totalPredictions).toBe(15);
      expect(result.windowStats[AccuracyWindow.ALL_TIME].rawAccuracy).toBe(100);
    });
  });

  // --------------------------------------------------------------------------
  // Event Emission
  // --------------------------------------------------------------------------

  describe("Event Emission", () => {
    it("should emit events for prediction additions", () => {
      const events: string[] = [];

      scorer.on("prediction-added", () => events.push("prediction-added"));
      scorer.on("analysis-complete", () => events.push("analysis-complete"));
      scorer.on("potential-insider", () => events.push("potential-insider"));

      const prediction = createTestPrediction({
        walletAddress: WALLETS.TRADER_1,
        outcome: PredictionOutcome.CORRECT,
      });
      scorer.addPrediction(prediction);

      expect(events).toContain("prediction-added");
    });

    it("should emit potential-insider event for suspicious wallets", () => {
      const events: Array<{ address: string }> = [];

      scorer.on("potential-insider", (data) => events.push(data));

      // Add highly accurate predictions
      const predictions = createTraderPredictionHistory(WALLETS.INSIDER_SUSPECT, {
        totalPredictions: 35,
        accuracyRate: 92,
        highConvictionRate: 0.9,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      // Trigger analysis
      scorer.analyze(WALLETS.INSIDER_SUSPECT);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.address.toLowerCase()).toBe(WALLETS.INSIDER_SUSPECT.toLowerCase());
    });
  });

  // --------------------------------------------------------------------------
  // Summary Statistics
  // --------------------------------------------------------------------------

  describe("Summary Statistics", () => {
    it("should generate accurate summary statistics", () => {
      // Add wallets with different tiers
      const tierConfigs = [
        { wallet: WALLETS.TRADER_1, accuracyRate: 95 }, // Exceptional
        { wallet: WALLETS.TRADER_2, accuracyRate: 85 }, // Excellent
        { wallet: WALLETS.TRADER_3, accuracyRate: 65 }, // Good
        { wallet: WALLETS.TRADER_4, accuracyRate: 52 }, // Average
        { wallet: WALLETS.TRADER_5, accuracyRate: 35 }, // Very Poor
      ];

      tierConfigs.forEach(({ wallet, accuracyRate }) => {
        const predictions = createTraderPredictionHistory(wallet, {
          totalPredictions: 20,
          accuracyRate,
        });
        predictions.forEach((p) => scorer.addPrediction(p));
      });

      const summary = scorer.getSummary();

      expect(summary.totalWallets).toBe(5);
      expect(summary.totalPredictions).toBe(100);
      expect(summary.exceptionalAccuracyCount).toBeGreaterThanOrEqual(1);
      expect(summary.potentialInsiderCount).toBeGreaterThanOrEqual(0);
      expect(summary.averageAccuracy).toBeGreaterThan(0);
    });

    it("should track tier distribution correctly", () => {
      // Add wallets with specific accuracy rates for each tier
      const predictions1 = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 15,
        accuracyRate: 52, // Average
      });
      predictions1.forEach((p) => scorer.addPrediction(p));

      const predictions2 = createTraderPredictionHistory(WALLETS.TRADER_2, {
        totalPredictions: 15,
        accuracyRate: 70, // Very Good
      });
      predictions2.forEach((p) => scorer.addPrediction(p));

      const summary = scorer.getSummary();

      // Should have at least these tiers represented
      expect(
        summary.tierDistribution[AccuracyTier.AVERAGE] +
          summary.tierDistribution[AccuracyTier.ABOVE_AVERAGE]
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Caching Behavior
  // --------------------------------------------------------------------------

  describe("Caching Behavior", () => {
    it("should cache analysis results", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 15,
        accuracyRate: 60,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      // First analysis
      const result1 = scorer.analyze(WALLETS.TRADER_1);

      // Second analysis should use cache
      const result2 = scorer.analyze(WALLETS.TRADER_1);

      // Results should be identical (same object from cache)
      expect(result1).toEqual(result2);

      // Summary should show cache hits
      const summary = scorer.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it("should invalidate cache on new predictions", () => {
      const predictions = createTraderPredictionHistory(WALLETS.TRADER_1, {
        totalPredictions: 15,
        accuracyRate: 60,
      });
      predictions.forEach((p) => scorer.addPrediction(p));

      // First analysis
      const result1 = scorer.analyze(WALLETS.TRADER_1);

      // Add new prediction
      scorer.addPrediction(
        createTestPrediction({
          walletAddress: WALLETS.TRADER_1,
          outcome: PredictionOutcome.CORRECT,
        })
      );

      // Second analysis should have different count
      const result2 = scorer.analyze(WALLETS.TRADER_1);

      expect(result2.totalPredictions).toBe(result1.totalPredictions + 1);
    });
  });
});
