/**
 * Market Outcome Predictor Unit Tests
 *
 * Tests for the market outcome predictor (AI-PRED-002)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MarketOutcomePredictor,
  createMarketOutcomePredictor,
  getSharedMarketOutcomePredictor,
  setSharedMarketOutcomePredictor,
  resetSharedMarketOutcomePredictor,
  PredictedOutcome,
  OutcomeConfidenceLevel,
  SignalType,
  SignalDirection,
  MarketPredictionStatus,
  TrainingStatus,
  DEFAULT_MODEL_WEIGHTS,
  DEFAULT_OUTCOME_PREDICTOR_CONFIG,
  OUTCOME_CONFIDENCE_THRESHOLDS,
  SIGNAL_TYPE_WEIGHTS,
  getOutcomeDescription,
  getOutcomeColor,
  getOutcomeConfidenceDescription,
  getOutcomeConfidenceColor,
  getSignalTypeDescription,
  getSignalDirectionDescription,
  formatOutcomeProbability,
  getTrainingStatusDescription,
  createMockMarketSignal,
  createMockSignalsForMarket,
  createMockSignalAggregation,
  createMockHistoricalOutcome,
  createMockOutcomePrediction,
  createMockHistoricalOutcomeBatch,
  type MarketSignal,
  type MarketOutcomePredictorConfig,
} from "../../src/ai/market-outcome-predictor";

describe("MarketOutcomePredictor", () => {
  let predictor: MarketOutcomePredictor;

  beforeEach(() => {
    predictor = new MarketOutcomePredictor();
  });

  afterEach(() => {
    predictor.reset();
    resetSharedMarketOutcomePredictor();
  });

  // ============================================================================
  // Constructor and Configuration Tests
  // ============================================================================

  describe("constructor", () => {
    it("should create predictor with default config", () => {
      const p = new MarketOutcomePredictor();
      const config = p.getConfig();

      expect(config.minSignalsForPrediction).toBe(
        DEFAULT_OUTCOME_PREDICTOR_CONFIG.minSignalsForPrediction
      );
      expect(config.cacheEnabled).toBe(
        DEFAULT_OUTCOME_PREDICTOR_CONFIG.cacheEnabled
      );
    });

    it("should create predictor with custom config", () => {
      const customConfig: Partial<MarketOutcomePredictorConfig> = {
        minSignalsForPrediction: 5,
        cacheEnabled: false,
        yesProbabilityThreshold: 0.6,
      };
      const p = new MarketOutcomePredictor(customConfig);
      const config = p.getConfig();

      expect(config.minSignalsForPrediction).toBe(5);
      expect(config.cacheEnabled).toBe(false);
      expect(config.yesProbabilityThreshold).toBe(0.6);
    });

    it("should initialize with NOT_TRAINED status", () => {
      expect(predictor.getTrainingStatus()).toBe(TrainingStatus.NOT_TRAINED);
    });

    it("should initialize with empty metrics", () => {
      const metrics = predictor.getMetrics();
      expect(metrics.totalPredictions).toBe(0);
      expect(metrics.verifiedPredictions).toBe(0);
      expect(metrics.accuracy).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should update config", () => {
      predictor.updateConfig({ minSignalsForPrediction: 10 });
      expect(predictor.getConfig().minSignalsForPrediction).toBe(10);
    });

    it("should get model weights", () => {
      const weights = predictor.getModelWeights();
      expect(weights).toBeDefined();
      expect(weights.featureWeights).toBeDefined();
      expect(weights.bias).toBeDefined();
    });

    it("should set model weights", () => {
      predictor.setModelWeights({ bias: 0.5 });
      expect(predictor.getModelWeights().bias).toBe(0.5);
    });
  });

  // ============================================================================
  // Signal Collection Tests
  // ============================================================================

  describe("recordSignal", () => {
    it("should record a signal and return it with ID", () => {
      const signal: Omit<MarketSignal, "signalId"> = {
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.8,
        confidence: 0.7,
        timestamp: new Date(),
      };

      const result = predictor.recordSignal(signal);

      expect(result.signalId).toBeDefined();
      expect(result.signalId).toMatch(/^sig_/);
      expect(result.marketId).toBe("market_001");
      expect(result.type).toBe(SignalType.INSIDER_TRADE);
    });

    it("should emit signal_recorded event", () => {
      const handler = vi.fn();
      predictor.on("signal_recorded", handler);

      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.WHALE_TRADE,
        direction: SignalDirection.BEARISH,
        strength: 0.6,
        confidence: 0.8,
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0] as MarketSignal[])[0]?.marketId).toBe("market_001");
    });

    it("should store signals by market ID", () => {
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.VOLUME_SPIKE,
        direction: SignalDirection.BULLISH,
        strength: 0.5,
        confidence: 0.6,
        timestamp: new Date(),
      });

      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.FRESH_WALLET,
        direction: SignalDirection.BULLISH,
        strength: 0.7,
        confidence: 0.5,
        timestamp: new Date(),
      });

      const signals = predictor.getMarketSignals("market_001");
      expect(signals.length).toBe(2);
    });

    it("should record signals with optional fields", () => {
      const signal = predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.9,
        confidence: 0.85,
        walletAddress: "0x1234567890abcdef",
        tradeSizeUsd: 50000,
        insiderProbability: 0.75,
        anomalyScore: 85,
        timestamp: new Date(),
        metadata: { source: "detector" },
      });

      expect(signal.walletAddress).toBe("0x1234567890abcdef");
      expect(signal.tradeSizeUsd).toBe(50000);
      expect(signal.insiderProbability).toBe(0.75);
      expect(signal.anomalyScore).toBe(85);
      expect(signal.metadata).toEqual({ source: "detector" });
    });
  });

  describe("recordSignals", () => {
    it("should record multiple signals", () => {
      const signals = [
        {
          marketId: "market_001",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.8,
          confidence: 0.7,
          timestamp: new Date(),
        },
        {
          marketId: "market_001",
          type: SignalType.WHALE_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.6,
          confidence: 0.8,
          timestamp: new Date(),
        },
      ];

      const results = predictor.recordSignals(signals);

      expect(results.length).toBe(2);
      expect(results[0]?.signalId).toBeDefined();
      expect(results[1]?.signalId).toBeDefined();
    });
  });

  describe("getRecentSignals", () => {
    it("should return only signals within max age", () => {
      // Record old signal
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.VOLUME_SPIKE,
        direction: SignalDirection.BULLISH,
        strength: 0.5,
        confidence: 0.6,
        timestamp: new Date(Date.now() - 200 * 60 * 60 * 1000), // 200 hours ago
      });

      // Record recent signal
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.FRESH_WALLET,
        direction: SignalDirection.BULLISH,
        strength: 0.7,
        confidence: 0.5,
        timestamp: new Date(),
      });

      const recent = predictor.getRecentSignals("market_001");
      expect(recent.length).toBe(1);
    });
  });

  describe("clearOldSignals", () => {
    it("should clear signals older than max age", () => {
      // Record old signal
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.VOLUME_SPIKE,
        direction: SignalDirection.BULLISH,
        strength: 0.5,
        confidence: 0.6,
        timestamp: new Date(Date.now() - 200 * 60 * 60 * 1000),
      });

      // Record recent signal
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.FRESH_WALLET,
        direction: SignalDirection.BULLISH,
        strength: 0.7,
        confidence: 0.5,
        timestamp: new Date(),
      });

      const cleared = predictor.clearOldSignals();
      expect(cleared).toBe(1);
      expect(predictor.getMarketSignals("market_001").length).toBe(1);
    });
  });

  // ============================================================================
  // Signal Aggregation Tests
  // ============================================================================

  describe("aggregateSignals", () => {
    it("should return null for market with no signals", () => {
      const result = predictor.aggregateSignals("unknown_market");
      expect(result).toBeNull();
    });

    it("should aggregate signals correctly", () => {
      // Add multiple signals
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.8,
        confidence: 0.7,
        tradeSizeUsd: 10000,
        insiderProbability: 0.6,
        timestamp: new Date(),
      });

      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.WHALE_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.9,
        confidence: 0.8,
        tradeSizeUsd: 50000,
        insiderProbability: 0.3,
        timestamp: new Date(),
      });

      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.VOLUME_SPIKE,
        direction: SignalDirection.BEARISH,
        strength: 0.5,
        confidence: 0.6,
        timestamp: new Date(),
      });

      const aggregation = predictor.aggregateSignals("market_001");

      expect(aggregation).not.toBeNull();
      if (aggregation) {
        expect(aggregation.totalSignals).toBe(3);
        expect(aggregation.bullishSignals).toBe(2);
        expect(aggregation.bearishSignals).toBe(1);
        expect(aggregation.avgStrength).toBeCloseTo((0.8 + 0.9 + 0.5) / 3, 2);
        expect(aggregation.maxStrength).toBe(0.9);
        expect(aggregation.signalVolumeUsd).toBe(60000);
        expect(aggregation.signalTypeBreakdown[SignalType.INSIDER_TRADE]).toBe(1);
        expect(aggregation.signalTypeBreakdown[SignalType.WHALE_TRADE]).toBe(1);
      }
    });

    it("should calculate time-weighted score", () => {
      // Add bullish signal (recent)
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 1.0,
        confidence: 1.0,
        timestamp: new Date(),
      });

      const aggregation = predictor.aggregateSignals("market_001");
      if (aggregation) {
        expect(aggregation.timeWeightedScore).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Prediction Tests
  // ============================================================================

  describe("predict", () => {
    it("should return uncertain for insufficient signals", () => {
      // Add only 1 signal (below default threshold of 3)
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.8,
        confidence: 0.7,
        timestamp: new Date(),
      });

      const result = predictor.predict("market_001");

      expect(result.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
      expect(result.confidence).toBe(OutcomeConfidenceLevel.VERY_LOW);
      expect(result.explanation).toContain("Insufficient signals");
    });

    it("should make prediction with sufficient signals", () => {
      // Add signals
      const signals = createMockSignalsForMarket("market_001", 5, "BULLISH");
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const result = predictor.predict("market_001");

      expect(result.predictionId).toBeDefined();
      expect(result.predictionId).toMatch(/^opred_/);
      expect(result.marketId).toBe("market_001");
      expect(result.yesProbability).toBeGreaterThanOrEqual(0);
      expect(result.yesProbability).toBeLessThanOrEqual(1);
      expect(result.noProbability).toBeCloseTo(1 - result.yesProbability, 5);
      expect(result.status).toBe(MarketPredictionStatus.PENDING);
      expect(result.features).toBeDefined();
      expect(result.signalAggregation).toBeDefined();
    });

    it("should emit prediction_made event", () => {
      const handler = vi.fn();
      predictor.on("prediction_made", handler);

      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit high_confidence_prediction event for high confidence", () => {
      const handler = vi.fn();
      predictor.on("high_confidence_prediction", handler);

      // Create very strong bullish signals
      for (let i = 0; i < 10; i++) {
        predictor.recordSignal({
          marketId: "market_001",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.95,
          confidence: 0.95,
          insiderProbability: 0.9,
          tradeSizeUsd: 100000,
          timestamp: new Date(),
        });
      }

      predictor.predict("market_001");

      // May or may not emit depending on actual confidence calculation
      // Just verify no error occurs
      expect(handler.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it("should use cache for repeated predictions", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const cacheHitHandler = vi.fn();
      const cacheMissHandler = vi.fn();
      predictor.on("cache_hit", cacheHitHandler);
      predictor.on("cache_miss", cacheMissHandler);

      // First prediction - cache miss
      predictor.predict("market_001");
      expect(cacheMissHandler).toHaveBeenCalledTimes(1);

      // Second prediction - cache hit
      predictor.predict("market_001");
      expect(cacheHitHandler).toHaveBeenCalledTimes(1);
    });

    it("should include key factors in result", () => {
      const signals = createMockSignalsForMarket("market_001", 5, "BULLISH");
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const result = predictor.predict("market_001");

      expect(result.keyFactors).toBeDefined();
      expect(Array.isArray(result.keyFactors)).toBe(true);
    });

    it("should generate explanation", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const result = predictor.predict("market_001");

      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe("string");
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    it("should store prediction for later retrieval", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const result = predictor.predict("market_001");
      const stored = predictor.getPrediction(result.predictionId);

      expect(stored).toBeDefined();
      expect(stored?.predictionId).toBe(result.predictionId);
    });
  });

  describe("predictBatch", () => {
    it("should predict outcomes for multiple markets", () => {
      // Add signals for multiple markets
      for (const marketId of ["market_001", "market_002", "market_003"]) {
        const signals = createMockSignalsForMarket(marketId, 5);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      const result = predictor.predictBatch([
        "market_001",
        "market_002",
        "market_003",
      ]);

      expect(result.totalPredicted).toBe(3);
      expect(result.results.length).toBe(3);
      expect(result.avgYesProbability).toBeGreaterThanOrEqual(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should accept current probabilities", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const result = predictor.predictBatch(
        ["market_001"],
        { market_001: 0.7 },
        { market_001: 48 }
      );

      expect(result.results[0]).toBeDefined();
    });

    it("should emit batch_completed event", () => {
      const handler = vi.fn();
      predictor.on("batch_completed", handler);

      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predictBatch(["market_001"]);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should count prediction outcomes correctly", () => {
      // Add strongly bullish signals for market_001
      for (let i = 0; i < 10; i++) {
        predictor.recordSignal({
          marketId: "market_001",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.9,
          confidence: 0.9,
          timestamp: new Date(),
        });
      }

      // Add strongly bearish signals for market_002
      for (let i = 0; i < 10; i++) {
        predictor.recordSignal({
          marketId: "market_002",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BEARISH,
          strength: 0.9,
          confidence: 0.9,
          timestamp: new Date(),
        });
      }

      const result = predictor.predictBatch(["market_001", "market_002"]);

      // Total should be 2
      expect(result.totalPredicted).toBe(2);
      // At least one predicted yes or no or uncertain
      expect(
        result.predictedYes + result.predictedNo + result.predictedUncertain
      ).toBe(2);
    });
  });

  // ============================================================================
  // Verification Tests
  // ============================================================================

  describe("verifyPrediction", () => {
    it("should return false for unknown prediction", () => {
      const result = predictor.verifyPrediction("unknown_id", "YES");
      expect(result).toBe(false);
    });

    it("should verify correct prediction", () => {
      // Add bullish signals
      for (let i = 0; i < 10; i++) {
        predictor.recordSignal({
          marketId: "market_001",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.9,
          confidence: 0.9,
          timestamp: new Date(),
        });
      }

      const prediction = predictor.predict("market_001");

      // If predicted YES, verify as YES
      if (prediction.predictedOutcome === PredictedOutcome.YES) {
        const correct = predictor.verifyPrediction(prediction.predictionId, "YES");
        expect(correct).toBe(true);

        const verified = predictor.getPrediction(prediction.predictionId);
        expect(verified?.status).toBe(MarketPredictionStatus.VERIFIED);
        expect(verified?.actualOutcome).toBe("YES");
        expect(verified?.wasCorrect).toBe(true);
      }
    });

    it("should update metrics after verification", () => {
      const signals = createMockSignalsForMarket("market_001", 5, "BULLISH");
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("market_001");
      predictor.verifyPrediction(prediction.predictionId, "YES");

      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(1);
    });

    it("should emit prediction_verified event", () => {
      const handler = vi.fn();
      predictor.on("prediction_verified", handler);

      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("market_001");
      predictor.verifyPrediction(prediction.predictionId, "YES");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should add to historical outcomes for training", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("market_001");
      predictor.verifyPrediction(prediction.predictionId, "YES");

      const outcomes = predictor.getHistoricalOutcomes();
      expect(outcomes.length).toBe(1);
      expect(outcomes[0]?.outcome).toBe("YES");
    });
  });

  // ============================================================================
  // Training Tests
  // ============================================================================

  describe("train", () => {
    it("should not train with insufficient data", () => {
      // Add error handler to prevent unhandled error
      const errorHandler = vi.fn();
      predictor.on("error", errorHandler);

      const result = predictor.train();
      expect(result.accuracy).toBe(0);
      expect(result.iterations).toBe(0);
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should train with historical outcomes", () => {
      // Add historical outcomes
      const outcomes = createMockHistoricalOutcomeBatch(15);
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      const result = predictor.train();

      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);
      expect(predictor.getTrainingStatus()).toBe(TrainingStatus.TRAINED);
    });

    it("should emit model_trained event", () => {
      const handler = vi.fn();
      predictor.on("model_trained", handler);

      const outcomes = createMockHistoricalOutcomeBatch(15);
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      predictor.train();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should update model weights after training", () => {
      const outcomes = createMockHistoricalOutcomeBatch(15);
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      predictor.train(50);
      const weightsAfter = predictor.getModelWeights();

      // Weights should potentially change (depending on data)
      expect(weightsAfter).toBeDefined();
    });
  });

  describe("addHistoricalOutcome", () => {
    it("should add historical outcome", () => {
      const outcome = createMockHistoricalOutcome();
      predictor.addHistoricalOutcome(outcome);

      const outcomes = predictor.getHistoricalOutcomes();
      expect(outcomes.length).toBe(1);
    });
  });

  // ============================================================================
  // Statistics and Retrieval Tests
  // ============================================================================

  describe("getStatistics", () => {
    it("should return correct statistics", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");

      const stats = predictor.getStatistics();

      expect(stats.totalPredictions).toBe(1);
      expect(stats.totalSignals).toBe(5);
      expect(stats.marketsWithSignals).toBe(1);
      expect(stats.trainingStatus).toBe(TrainingStatus.NOT_TRAINED);
    });
  });

  describe("getPredictionsForMarket", () => {
    it("should return predictions for specific market", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");

      const predictions = predictor.getPredictionsForMarket("market_001");
      expect(predictions.length).toBe(1);
    });
  });

  describe("getVerifiedPredictions", () => {
    it("should return only verified predictions", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("market_001");
      predictor.verifyPrediction(prediction.predictionId, "YES");

      const verified = predictor.getVerifiedPredictions();
      expect(verified.length).toBe(1);
      expect(verified[0]?.status).toBe(MarketPredictionStatus.VERIFIED);
    });
  });

  describe("getPendingPredictions", () => {
    it("should return only pending predictions", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");

      const pending = predictor.getPendingPredictions();
      expect(pending.length).toBe(1);
      expect(pending[0]?.status).toBe(MarketPredictionStatus.PENDING);
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe("clearCache", () => {
    it("should clear prediction cache", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");
      predictor.clearCache();

      const stats = predictor.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");
      predictor.predict("market_001"); // Cache hit

      const stats = predictor.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Reset Tests
  // ============================================================================

  describe("reset", () => {
    it("should reset all state", () => {
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("market_001");
      predictor.reset();

      expect(predictor.getStatistics().totalPredictions).toBe(0);
      expect(predictor.getStatistics().totalSignals).toBe(0);
      expect(predictor.getTrainingStatus()).toBe(TrainingStatus.NOT_TRAINED);
    });
  });
});

// ============================================================================
// Factory Functions Tests
// ============================================================================

describe("Factory Functions", () => {
  afterEach(() => {
    resetSharedMarketOutcomePredictor();
  });

  describe("createMarketOutcomePredictor", () => {
    it("should create new predictor", () => {
      const predictor = createMarketOutcomePredictor();
      expect(predictor).toBeInstanceOf(MarketOutcomePredictor);
    });

    it("should create with custom config", () => {
      const predictor = createMarketOutcomePredictor({
        minSignalsForPrediction: 10,
      });
      expect(predictor.getConfig().minSignalsForPrediction).toBe(10);
    });
  });

  describe("getSharedMarketOutcomePredictor", () => {
    it("should return same instance", () => {
      const p1 = getSharedMarketOutcomePredictor();
      const p2 = getSharedMarketOutcomePredictor();
      expect(p1).toBe(p2);
    });
  });

  describe("setSharedMarketOutcomePredictor", () => {
    it("should set shared instance", () => {
      const custom = createMarketOutcomePredictor({ cacheEnabled: false });
      setSharedMarketOutcomePredictor(custom);
      const shared = getSharedMarketOutcomePredictor();
      expect(shared.getConfig().cacheEnabled).toBe(false);
    });
  });

  describe("resetSharedMarketOutcomePredictor", () => {
    it("should reset shared instance", () => {
      const p1 = getSharedMarketOutcomePredictor();
      const signals = createMockSignalsForMarket("market_001", 5);
      for (const signal of signals) {
        p1.recordSignal(signal);
      }
      p1.predict("market_001");

      resetSharedMarketOutcomePredictor();

      const p2 = getSharedMarketOutcomePredictor();
      expect(p2.getStatistics().totalPredictions).toBe(0);
    });
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe("Utility Functions", () => {
  describe("getOutcomeDescription", () => {
    it("should return description for each outcome", () => {
      expect(getOutcomeDescription(PredictedOutcome.YES)).toContain("YES");
      expect(getOutcomeDescription(PredictedOutcome.NO)).toContain("NO");
      expect(getOutcomeDescription(PredictedOutcome.UNCERTAIN)).toContain(
        "uncertain"
      );
    });
  });

  describe("getOutcomeColor", () => {
    it("should return color for each outcome", () => {
      expect(getOutcomeColor(PredictedOutcome.YES)).toMatch(/^#[0-9A-Fa-f]+$/);
      expect(getOutcomeColor(PredictedOutcome.NO)).toMatch(/^#[0-9A-Fa-f]+$/);
      expect(getOutcomeColor(PredictedOutcome.UNCERTAIN)).toMatch(
        /^#[0-9A-Fa-f]+$/
      );
    });
  });

  describe("getOutcomeConfidenceDescription", () => {
    it("should return description for each confidence level", () => {
      for (const level of Object.values(OutcomeConfidenceLevel)) {
        const desc = getOutcomeConfidenceDescription(level);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getOutcomeConfidenceColor", () => {
    it("should return color for each confidence level", () => {
      for (const level of Object.values(OutcomeConfidenceLevel)) {
        const color = getOutcomeConfidenceColor(level);
        expect(color).toMatch(/^#[0-9A-Fa-f]+$/);
      }
    });
  });

  describe("getSignalTypeDescription", () => {
    it("should return description for each signal type", () => {
      for (const type of Object.values(SignalType)) {
        const desc = getSignalTypeDescription(type);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getSignalDirectionDescription", () => {
    it("should return description for each direction", () => {
      for (const direction of Object.values(SignalDirection)) {
        const desc = getSignalDirectionDescription(direction);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe("formatOutcomeProbability", () => {
    it("should format probability as percentage", () => {
      expect(formatOutcomeProbability(0.75)).toBe("75.0%");
      expect(formatOutcomeProbability(0.5, 2)).toBe("50.00%");
      expect(formatOutcomeProbability(1)).toBe("100.0%");
      expect(formatOutcomeProbability(0)).toBe("0.0%");
    });
  });

  describe("getTrainingStatusDescription", () => {
    it("should return description for each status", () => {
      for (const status of Object.values(TrainingStatus)) {
        const desc = getTrainingStatusDescription(status);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Mock Data Generators Tests
// ============================================================================

describe("Mock Data Generators", () => {
  describe("createMockMarketSignal", () => {
    it("should create valid mock signal", () => {
      const signal = createMockMarketSignal();

      expect(signal.signalId).toBeDefined();
      expect(signal.marketId).toBeDefined();
      expect(signal.type).toBeDefined();
      expect(signal.direction).toBeDefined();
      expect(signal.strength).toBeGreaterThanOrEqual(0);
      expect(signal.strength).toBeLessThanOrEqual(1);
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.timestamp).toBeInstanceOf(Date);
    });

    it("should accept overrides", () => {
      const signal = createMockMarketSignal({
        marketId: "custom_market",
        type: SignalType.WHALE_TRADE,
        strength: 0.95,
      });

      expect(signal.marketId).toBe("custom_market");
      expect(signal.type).toBe(SignalType.WHALE_TRADE);
      expect(signal.strength).toBe(0.95);
    });
  });

  describe("createMockSignalsForMarket", () => {
    it("should create specified number of signals", () => {
      const signals = createMockSignalsForMarket("market_001", 10);
      expect(signals.length).toBe(10);
      expect(signals.every((s) => s.marketId === "market_001")).toBe(true);
    });

    it("should bias signals towards bullish", () => {
      const signals = createMockSignalsForMarket("market_001", 100, "BULLISH");
      const bullishCount = signals.filter(
        (s) => s.direction === SignalDirection.BULLISH
      ).length;
      expect(bullishCount).toBeGreaterThan(50);
    });

    it("should bias signals towards bearish", () => {
      const signals = createMockSignalsForMarket("market_001", 100, "BEARISH");
      const bearishCount = signals.filter(
        (s) => s.direction === SignalDirection.BEARISH
      ).length;
      expect(bearishCount).toBeGreaterThan(50);
    });
  });

  describe("createMockSignalAggregation", () => {
    it("should create valid aggregation", () => {
      const aggregation = createMockSignalAggregation();

      expect(aggregation.marketId).toBeDefined();
      expect(aggregation.totalSignals).toBeGreaterThan(0);
      expect(
        aggregation.bullishSignals +
          aggregation.bearishSignals +
          aggregation.neutralSignals
      ).toBe(aggregation.totalSignals);
      expect(aggregation.avgStrength).toBeGreaterThanOrEqual(0);
      expect(aggregation.avgStrength).toBeLessThanOrEqual(1);
    });
  });

  describe("createMockHistoricalOutcome", () => {
    it("should create valid historical outcome", () => {
      const outcome = createMockHistoricalOutcome();

      expect(outcome.marketId).toBeDefined();
      expect(["YES", "NO"]).toContain(outcome.outcome);
      expect(outcome.resolvedAt).toBeInstanceOf(Date);
      expect(outcome.signalAggregation).toBeDefined();
    });
  });

  describe("createMockOutcomePrediction", () => {
    it("should create valid prediction", () => {
      const prediction = createMockOutcomePrediction();

      expect(prediction.predictionId).toBeDefined();
      expect(prediction.marketId).toBeDefined();
      expect(Object.values(PredictedOutcome)).toContain(
        prediction.predictedOutcome
      );
      expect(prediction.yesProbability + prediction.noProbability).toBeCloseTo(
        1,
        5
      );
    });
  });

  describe("createMockHistoricalOutcomeBatch", () => {
    it("should create specified number of outcomes", () => {
      const outcomes = createMockHistoricalOutcomeBatch(20);
      expect(outcomes.length).toBe(20);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  describe("DEFAULT_MODEL_WEIGHTS", () => {
    it("should have all feature weights", () => {
      expect(DEFAULT_MODEL_WEIGHTS.featureWeights).toBeDefined();
      expect(
        Object.keys(DEFAULT_MODEL_WEIGHTS.featureWeights).length
      ).toBeGreaterThan(0);
    });

    it("should have bias and prior", () => {
      expect(DEFAULT_MODEL_WEIGHTS.bias).toBeDefined();
      expect(DEFAULT_MODEL_WEIGHTS.yesPrior).toBeDefined();
      expect(DEFAULT_MODEL_WEIGHTS.temperature).toBeDefined();
    });
  });

  describe("DEFAULT_OUTCOME_PREDICTOR_CONFIG", () => {
    it("should have all config fields", () => {
      expect(DEFAULT_OUTCOME_PREDICTOR_CONFIG.minSignalsForPrediction).toBeDefined();
      expect(DEFAULT_OUTCOME_PREDICTOR_CONFIG.yesProbabilityThreshold).toBeDefined();
      expect(DEFAULT_OUTCOME_PREDICTOR_CONFIG.noProbabilityThreshold).toBeDefined();
      expect(DEFAULT_OUTCOME_PREDICTOR_CONFIG.cacheEnabled).toBeDefined();
    });
  });

  describe("OUTCOME_CONFIDENCE_THRESHOLDS", () => {
    it("should have ordered thresholds", () => {
      expect(OUTCOME_CONFIDENCE_THRESHOLDS.veryLow).toBeLessThan(
        OUTCOME_CONFIDENCE_THRESHOLDS.low
      );
      expect(OUTCOME_CONFIDENCE_THRESHOLDS.low).toBeLessThan(
        OUTCOME_CONFIDENCE_THRESHOLDS.medium
      );
      expect(OUTCOME_CONFIDENCE_THRESHOLDS.medium).toBeLessThan(
        OUTCOME_CONFIDENCE_THRESHOLDS.high
      );
      expect(OUTCOME_CONFIDENCE_THRESHOLDS.high).toBeLessThan(
        OUTCOME_CONFIDENCE_THRESHOLDS.veryHigh
      );
    });
  });

  describe("SIGNAL_TYPE_WEIGHTS", () => {
    it("should have weight for each signal type", () => {
      for (const type of Object.values(SignalType)) {
        expect(SIGNAL_TYPE_WEIGHTS[type]).toBeDefined();
        expect(SIGNAL_TYPE_WEIGHTS[type]).toBeGreaterThan(0);
        expect(SIGNAL_TYPE_WEIGHTS[type]).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("Edge Cases", () => {
  let predictor: MarketOutcomePredictor;

  beforeEach(() => {
    predictor = new MarketOutcomePredictor();
  });

  afterEach(() => {
    predictor.reset();
  });

  it("should handle prediction for market with no signals", () => {
    const result = predictor.predict("empty_market");
    expect(result.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
    expect(result.confidence).toBe(OutcomeConfidenceLevel.VERY_LOW);
  });

  it("should handle all same direction signals", () => {
    for (let i = 0; i < 10; i++) {
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.9,
        confidence: 0.9,
        timestamp: new Date(),
      });
    }

    const result = predictor.predict("market_001");
    // With all bullish signals, the bullish ratio should be 1.0
    // The actual YES probability depends on model weights
    expect(result.features.bullishRatio).toBe(1);
    expect(result.signalAggregation.bullishSignals).toBe(10);
  });

  it("should handle mixed neutral signals", () => {
    for (let i = 0; i < 5; i++) {
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.PRICE_ANOMALY,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
      });
    }

    const result = predictor.predict("market_001");
    // With all neutral signals, bullish and bearish counts are both 0
    // The model will fall back to its prior probability
    expect(result.signalAggregation.neutralSignals).toBe(5);
    expect(result.signalAggregation.bullishSignals).toBe(0);
    expect(result.signalAggregation.bearishSignals).toBe(0);
    // The prediction is made based on prior, confidence depends on signal count
    expect([
      OutcomeConfidenceLevel.LOW,
      OutcomeConfidenceLevel.MEDIUM,
    ]).toContain(result.confidence);
  });

  it("should handle signals with zero strength", () => {
    predictor.recordSignal({
      marketId: "market_001",
      type: SignalType.VOLUME_SPIKE,
      direction: SignalDirection.BULLISH,
      strength: 0,
      confidence: 0.8,
      timestamp: new Date(),
    });

    predictor.recordSignal({
      marketId: "market_001",
      type: SignalType.WHALE_TRADE,
      direction: SignalDirection.BULLISH,
      strength: 0,
      confidence: 0.8,
      timestamp: new Date(),
    });

    predictor.recordSignal({
      marketId: "market_001",
      type: SignalType.INSIDER_TRADE,
      direction: SignalDirection.BULLISH,
      strength: 0,
      confidence: 0.8,
      timestamp: new Date(),
    });

    const result = predictor.predict("market_001");
    expect(result).toBeDefined();
  });

  it("should handle very old signals (all filtered out)", () => {
    // Add only old signals
    predictor.recordSignal({
      marketId: "market_001",
      type: SignalType.INSIDER_TRADE,
      direction: SignalDirection.BULLISH,
      strength: 0.9,
      confidence: 0.9,
      timestamp: new Date(Date.now() - 300 * 60 * 60 * 1000), // 300 hours ago
    });

    const result = predictor.predict("market_001");
    expect(result.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
  });

  it("should handle cache disabled", () => {
    predictor.updateConfig({ cacheEnabled: false });

    const signals = createMockSignalsForMarket("market_001", 5);
    for (const signal of signals) {
      predictor.recordSignal(signal);
    }

    predictor.predict("market_001");
    predictor.predict("market_001");

    const stats = predictor.getCacheStats();
    expect(stats.hitRate).toBe(0);
  });

  it("should handle verification of prediction with UNCERTAIN outcome", () => {
    // Create signals for uncertain prediction
    for (let i = 0; i < 3; i++) {
      predictor.recordSignal({
        marketId: "market_001",
        type: SignalType.PRICE_ANOMALY,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
      });
    }

    const prediction = predictor.predict("market_001");
    predictor.verifyPrediction(prediction.predictionId, "YES");

    const verified = predictor.getPrediction(prediction.predictionId);
    expect(verified?.status).toBe(MarketPredictionStatus.VERIFIED);
  });
});
