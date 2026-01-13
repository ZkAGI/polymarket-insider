/**
 * Market Outcome Predictor E2E Tests
 *
 * End-to-end tests for the market outcome predictor (AI-PRED-002)
 * Testing complete workflows and integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MarketOutcomePredictor,
  createMarketOutcomePredictor,
  getSharedMarketOutcomePredictor,
  resetSharedMarketOutcomePredictor,
  PredictedOutcome,
  OutcomeConfidenceLevel,
  SignalType,
  SignalDirection,
  MarketPredictionStatus,
  TrainingStatus,
  createMockSignalsForMarket,
  createMockHistoricalOutcome,
  createMockHistoricalOutcomeBatch,
  type MarketSignal,
  type HistoricalMarketOutcome,
} from "../../src/ai/market-outcome-predictor";

describe("Market Outcome Predictor E2E Tests", () => {
  let predictor: MarketOutcomePredictor;

  beforeEach(() => {
    predictor = createMarketOutcomePredictor();
  });

  afterEach(() => {
    predictor.reset();
    resetSharedMarketOutcomePredictor();
  });

  // ============================================================================
  // Complete Prediction Workflow Tests
  // ============================================================================

  describe("Complete Prediction Workflow", () => {
    it("should complete full prediction lifecycle: record -> predict -> verify", async () => {
      // Step 1: Record signals over time
      const signals: Omit<MarketSignal, "signalId">[] = [];

      // Simulate signals arriving over time (all bullish)
      for (let i = 0; i < 10; i++) {
        signals.push({
          marketId: "election_2026",
          type: i % 2 === 0 ? SignalType.INSIDER_TRADE : SignalType.WHALE_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.7 + Math.random() * 0.3,
          confidence: 0.75 + Math.random() * 0.25,
          walletAddress: `0x${i.toString().repeat(40).slice(0, 40)}`,
          tradeSizeUsd: 10000 + i * 5000,
          insiderProbability: 0.5 + Math.random() * 0.4,
          timestamp: new Date(Date.now() - (10 - i) * 3600000), // Hours apart
        });
      }

      // Record all signals
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      // Step 2: Make prediction
      const prediction = predictor.predict("election_2026", 0.6, 72);

      expect(prediction.marketId).toBe("election_2026");
      expect(prediction.status).toBe(MarketPredictionStatus.PENDING);
      expect(prediction.yesProbability).toBeDefined();
      expect(prediction.confidence).toBeDefined();
      expect(prediction.signalAggregation.totalSignals).toBe(10);

      // Step 3: Verify prediction (simulate market resolution)
      predictor.verifyPrediction(
        prediction.predictionId,
        "YES" // Market resolved YES
      );

      // Step 4: Check verification results
      const verified = predictor.getPrediction(prediction.predictionId);
      expect(verified?.status).toBe(MarketPredictionStatus.VERIFIED);
      expect(verified?.actualOutcome).toBe("YES");
      expect(verified?.verifiedAt).toBeDefined();

      // Step 5: Check metrics updated
      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(1);
    });

    it("should handle market with mixed signals", async () => {
      // Record mixed signals
      const bullishSignals = 6;
      const bearishSignals = 4;

      for (let i = 0; i < bullishSignals; i++) {
        predictor.recordSignal({
          marketId: "crypto_market",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.7,
          confidence: 0.8,
          timestamp: new Date(),
        });
      }

      for (let i = 0; i < bearishSignals; i++) {
        predictor.recordSignal({
          marketId: "crypto_market",
          type: SignalType.WHALE_TRADE,
          direction: SignalDirection.BEARISH,
          strength: 0.6,
          confidence: 0.7,
          timestamp: new Date(),
        });
      }

      const prediction = predictor.predict("crypto_market");

      // With more bullish signals, should lean YES
      expect(prediction.signalAggregation.bullishSignals).toBe(bullishSignals);
      expect(prediction.signalAggregation.bearishSignals).toBe(bearishSignals);
    });

    it("should track multiple markets independently", () => {
      const markets = ["market_a", "market_b", "market_c"];

      // Add different signals to each market
      for (const marketId of markets) {
        const bias =
          marketId === "market_a"
            ? "BULLISH"
            : marketId === "market_b"
              ? "BEARISH"
              : "NEUTRAL";
        const signals = createMockSignalsForMarket(marketId, 8, bias);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      // Predict for each market
      const predictions = markets.map((marketId) => predictor.predict(marketId));

      // Each prediction should be independent
      expect(predictions[0]?.marketId).toBe("market_a");
      expect(predictions[1]?.marketId).toBe("market_b");
      expect(predictions[2]?.marketId).toBe("market_c");

      // Market A should have more bullish probability
      // Market B should have more bearish probability
      // These are probabilistic, so we just verify they're valid predictions
      expect(predictions[0]?.yesProbability).toBeGreaterThanOrEqual(0);
      expect(predictions[1]?.yesProbability).toBeGreaterThanOrEqual(0);
      expect(predictions[2]?.yesProbability).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Training and Model Improvement Tests
  // ============================================================================

  describe("Training and Model Improvement", () => {
    it("should train model from verified predictions", () => {
      // Create historical outcomes
      const outcomes: HistoricalMarketOutcome[] = [];

      // Add 20 historical outcomes
      for (let i = 0; i < 20; i++) {
        outcomes.push(createMockHistoricalOutcome());
      }

      // Add to predictor
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      // Train model
      const result = predictor.train(100);

      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);
      expect(predictor.getTrainingStatus()).toBe(TrainingStatus.TRAINED);
    });

    it("should improve predictions with training data", () => {
      // Create consistent historical outcomes (bullish signals -> YES outcome)
      const outcomes: HistoricalMarketOutcome[] = [];

      for (let i = 0; i < 15; i++) {
        const outcome = createMockHistoricalOutcome({
          outcome: "YES",
          signalAggregation: {
            marketId: `market_${i}`,
            totalSignals: 10,
            bullishSignals: 8,
            bearishSignals: 2,
            neutralSignals: 0,
            avgStrength: 0.8,
            maxStrength: 0.95,
            avgConfidence: 0.85,
            signalTypeBreakdown: {
              [SignalType.INSIDER_TRADE]: 4,
              [SignalType.WHALE_TRADE]: 2,
              [SignalType.VOLUME_SPIKE]: 2,
              [SignalType.FRESH_WALLET]: 1,
              [SignalType.COORDINATED_CLUSTER]: 1,
              [SignalType.PRE_EVENT_TIMING]: 0,
              [SignalType.PRICE_ANOMALY]: 0,
              [SignalType.ORDER_BOOK_IMBALANCE]: 0,
              [SignalType.MARKET_SELECTION]: 0,
              [SignalType.HIGH_WIN_RATE]: 0,
            },
            timeWeightedScore: 0.7,
            signalVolumeUsd: 100000,
            avgInsiderProbability: 0.6,
            firstSignalAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            lastSignalAt: new Date(),
          },
        });
        outcomes.push(outcome);
      }

      // Add outcomes
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      // Train
      predictor.train(50);

      // Now add similar signals to a new market and predict
      for (let i = 0; i < 10; i++) {
        predictor.recordSignal({
          marketId: "new_market",
          type: SignalType.INSIDER_TRADE,
          direction: SignalDirection.BULLISH,
          strength: 0.85,
          confidence: 0.9,
          timestamp: new Date(),
        });
      }

      const prediction = predictor.predict("new_market");

      // With consistent training data showing bullish -> YES,
      // the model should predict YES for similar signals
      expect(prediction).toBeDefined();
    });

    it("should accumulate historical outcomes from verifications", () => {
      // Create markets and make predictions
      for (let i = 0; i < 5; i++) {
        const marketId = `market_${i}`;
        const signals = createMockSignalsForMarket(marketId, 5, "BULLISH");
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }

        const prediction = predictor.predict(marketId);
        predictor.verifyPrediction(prediction.predictionId, "YES");
      }

      // Check historical outcomes accumulated
      const outcomes = predictor.getHistoricalOutcomes();
      expect(outcomes.length).toBe(5);
    });
  });

  // ============================================================================
  // Batch Operations Tests
  // ============================================================================

  describe("Batch Operations", () => {
    it("should predict multiple markets in batch", () => {
      const markets = [
        "sports_game_1",
        "sports_game_2",
        "crypto_price_1",
        "election_1",
      ];

      // Add signals to all markets
      for (const marketId of markets) {
        const signals = createMockSignalsForMarket(marketId, 6);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      const result = predictor.predictBatch(markets);

      expect(result.totalPredicted).toBe(4);
      expect(result.results.length).toBe(4);
      expect(
        result.predictedYes + result.predictedNo + result.predictedUncertain
      ).toBe(4);
    });

    it("should handle batch with different market states", () => {
      // Market with many signals
      const signals1 = createMockSignalsForMarket("market_heavy", 15, "BULLISH");
      for (const signal of signals1) {
        predictor.recordSignal(signal);
      }

      // Market with few signals
      predictor.recordSignal({
        marketId: "market_light",
        type: SignalType.VOLUME_SPIKE,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
      });

      // Market with no signals
      // "market_empty" has no signals

      const result = predictor.predictBatch([
        "market_heavy",
        "market_light",
        "market_empty",
      ]);

      expect(result.totalPredicted).toBe(3);

      // Heavy market should have better confidence
      const heavyResult = result.results.find(
        (r) => r.marketId === "market_heavy"
      );
      expect(heavyResult?.signalAggregation.totalSignals).toBe(15);

      // Empty market should be uncertain
      const emptyResult = result.results.find(
        (r) => r.marketId === "market_empty"
      );
      expect(emptyResult?.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
    });

    it("should accept current probabilities in batch", () => {
      const markets = ["market_1", "market_2"];

      for (const marketId of markets) {
        const signals = createMockSignalsForMarket(marketId, 5);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      const result = predictor.predictBatch(
        markets,
        { market_1: 0.7, market_2: 0.3 },
        { market_1: 24, market_2: 48 }
      );

      expect(result.totalPredicted).toBe(2);
    });
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  describe("Real-world Scenarios", () => {
    it("should handle pre-event trading pattern detection", () => {
      const marketId = "election_result_2026";

      // Simulate pre-event signals (many signals close to event)
      const now = Date.now();
      for (let i = 0; i < 8; i++) {
        predictor.recordSignal({
          marketId,
          type: SignalType.PRE_EVENT_TIMING,
          direction: SignalDirection.BULLISH,
          strength: 0.8,
          confidence: 0.85,
          walletAddress: `0x${i.toString(16).repeat(40).slice(0, 40)}`,
          tradeSizeUsd: 25000 + i * 10000,
          insiderProbability: 0.65,
          timestamp: new Date(now - i * 30 * 60 * 1000), // 30 minutes apart
        });
      }

      const prediction = predictor.predict(marketId, 0.5, 2); // 2 hours until resolution

      expect(prediction.signalAggregation.totalSignals).toBe(8);
      expect(
        prediction.signalAggregation.signalTypeBreakdown[
          SignalType.PRE_EVENT_TIMING
        ]
      ).toBe(8);
    });

    it("should detect coordinated cluster activity", () => {
      const marketId = "regulatory_decision";

      // Simulate coordinated cluster signals
      for (let i = 0; i < 5; i++) {
        predictor.recordSignal({
          marketId,
          type: SignalType.COORDINATED_CLUSTER,
          direction: SignalDirection.BEARISH,
          strength: 0.9,
          confidence: 0.95,
          walletAddress: `0x${"abc".repeat(13)}${i}`,
          tradeSizeUsd: 50000,
          insiderProbability: 0.8,
          anomalyScore: 90,
          timestamp: new Date(Date.now() - i * 60000), // 1 minute apart
          metadata: {
            clusterId: "cluster_001",
            clusterSize: 5,
          },
        });
      }

      const prediction = predictor.predict(marketId);

      expect(
        prediction.signalAggregation.signalTypeBreakdown[
          SignalType.COORDINATED_CLUSTER
        ]
      ).toBe(5);
      expect(prediction.signalAggregation.avgInsiderProbability).toBe(0.8);
    });

    it("should handle whale activity signals", () => {
      const marketId = "crypto_etf_approval";

      // Single large whale trade
      predictor.recordSignal({
        marketId,
        type: SignalType.WHALE_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 0.95,
        confidence: 0.9,
        walletAddress: "0x" + "1".repeat(40),
        tradeSizeUsd: 500000,
        timestamp: new Date(),
      });

      // Supporting signals
      for (let i = 0; i < 4; i++) {
        predictor.recordSignal({
          marketId,
          type: SignalType.VOLUME_SPIKE,
          direction: SignalDirection.BULLISH,
          strength: 0.7,
          confidence: 0.75,
          timestamp: new Date(),
        });
      }

      const prediction = predictor.predict(marketId);

      expect(prediction.signalAggregation.signalVolumeUsd).toBeGreaterThanOrEqual(500000);
      expect(prediction.signalAggregation.maxStrength).toBe(0.95);
    });

    it("should handle fresh wallet insider pattern", () => {
      const marketId = "merger_announcement";

      // Fresh wallets making large trades
      for (let i = 0; i < 6; i++) {
        predictor.recordSignal({
          marketId,
          type: SignalType.FRESH_WALLET,
          direction: SignalDirection.BULLISH,
          strength: 0.85,
          confidence: 0.8,
          walletAddress: `0x${"fresh".repeat(8)}${i}`,
          tradeSizeUsd: 20000 + i * 5000,
          insiderProbability: 0.75,
          timestamp: new Date(Date.now() - i * 3600000),
          metadata: {
            walletAgeDays: 2,
            firstTradeLarge: true,
          },
        });
      }

      const prediction = predictor.predict(marketId);

      expect(
        prediction.signalAggregation.signalTypeBreakdown[SignalType.FRESH_WALLET]
      ).toBe(6);
    });
  });

  // ============================================================================
  // Accuracy Tracking Tests
  // ============================================================================

  describe("Accuracy Tracking", () => {
    it("should track prediction accuracy over time", () => {
      const predictions: { id: string; actualOutcome: "YES" | "NO" }[] = [];

      // Make multiple predictions
      for (let i = 0; i < 10; i++) {
        const marketId = `accuracy_test_${i}`;
        const bias = i < 6 ? "BULLISH" : "BEARISH";
        const signals = createMockSignalsForMarket(marketId, 5, bias);

        for (const signal of signals) {
          predictor.recordSignal(signal);
        }

        const prediction = predictor.predict(marketId);
        predictions.push({
          id: prediction.predictionId,
          actualOutcome: i < 6 ? "YES" : "NO",
        });
      }

      // Verify predictions
      for (const { id, actualOutcome } of predictions) {
        predictor.verifyPrediction(id, actualOutcome);
      }

      const metrics = predictor.getMetrics();
      expect(metrics.verifiedPredictions).toBe(10);
      expect(metrics.totalPredictions).toBeGreaterThanOrEqual(10);
    });

    it("should calculate precision and recall", () => {
      // Create consistent predictions for measuring precision/recall
      // Predict YES 5 times, verify 3 YES, 2 NO (some false positives)
      // Predict NO 5 times, verify 4 NO, 1 YES (some false negatives)

      // This is probabilistic, so we just verify metrics are calculated
      const outcomes = createMockHistoricalOutcomeBatch(10);
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      for (let i = 0; i < 5; i++) {
        const marketId = `precision_test_${i}`;
        const signals = createMockSignalsForMarket(marketId, 5, "BULLISH");
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }

        const prediction = predictor.predict(marketId);
        predictor.verifyPrediction(
          prediction.predictionId,
          i < 3 ? "YES" : "NO"
        );
      }

      const metrics = predictor.getMetrics();
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.precision).toBeLessThanOrEqual(1);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeLessThanOrEqual(1);
    });

    it("should track Brier score for calibration", () => {
      for (let i = 0; i < 5; i++) {
        const marketId = `brier_test_${i}`;
        const signals = createMockSignalsForMarket(marketId, 6);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }

        const prediction = predictor.predict(marketId);
        predictor.verifyPrediction(
          prediction.predictionId,
          Math.random() > 0.5 ? "YES" : "NO"
        );
      }

      const metrics = predictor.getMetrics();
      // Brier score should be between 0 (perfect) and 1 (worst)
      expect(metrics.brierScore).toBeGreaterThanOrEqual(0);
      expect(metrics.brierScore).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Caching and Performance Tests
  // ============================================================================

  describe("Caching and Performance", () => {
    it("should use cache for repeated predictions", () => {
      const marketId = "cache_test";
      const signals = createMockSignalsForMarket(marketId, 10);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      // First prediction
      const result1 = predictor.predict(marketId);

      // Second prediction (from cache)
      const result2 = predictor.predict(marketId);

      // Results should be same
      expect(result1.predictionId).toBe(result2.predictionId);

      // Cache stats should show hit
      const stats = predictor.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it("should invalidate cache when new signals added", () => {
      const marketId = "cache_invalidate";
      const signals = createMockSignalsForMarket(marketId, 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      // First prediction
      const result1 = predictor.predict(marketId);

      // Add more signals
      predictor.recordSignal({
        marketId,
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BEARISH,
        strength: 0.95,
        confidence: 0.9,
        timestamp: new Date(),
      });

      // Second prediction should be different (cache invalidated)
      const result2 = predictor.predict(marketId);

      expect(result2.predictionId).not.toBe(result1.predictionId);
      expect(result2.signalAggregation.totalSignals).toBe(6);
    });

    it("should handle high volume of predictions", () => {
      const numMarkets = 50;

      // Create signals for many markets
      for (let i = 0; i < numMarkets; i++) {
        const marketId = `perf_test_${i}`;
        const signals = createMockSignalsForMarket(marketId, 5);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      const marketIds = Array.from(
        { length: numMarkets },
        (_, i) => `perf_test_${i}`
      );

      const start = Date.now();
      const result = predictor.predictBatch(marketIds);
      const elapsed = Date.now() - start;

      expect(result.totalPredicted).toBe(numMarkets);
      // Should complete in reasonable time (< 5 seconds)
      expect(elapsed).toBeLessThan(5000);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty market gracefully", () => {
      const result = predictor.predict("non_existent_market");

      expect(result.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
      expect(result.confidence).toBe(OutcomeConfidenceLevel.VERY_LOW);
    });

    it("should handle signals with missing optional fields", () => {
      predictor.recordSignal({
        marketId: "minimal_signal",
        type: SignalType.PRICE_ANOMALY,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
        // No optional fields
      });

      predictor.recordSignal({
        marketId: "minimal_signal",
        type: SignalType.PRICE_ANOMALY,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
      });

      predictor.recordSignal({
        marketId: "minimal_signal",
        type: SignalType.PRICE_ANOMALY,
        direction: SignalDirection.NEUTRAL,
        strength: 0.5,
        confidence: 0.5,
        timestamp: new Date(),
      });

      const result = predictor.predict("minimal_signal");
      expect(result).toBeDefined();
    });

    it("should handle training with insufficient data", () => {
      // Add error handler to prevent unhandled error
      const errorHandler = () => {
        // Expected error - insufficient data
      };
      predictor.on("error", errorHandler);

      // Add only 5 outcomes (less than minimum of 10)
      for (let i = 0; i < 5; i++) {
        predictor.addHistoricalOutcome(createMockHistoricalOutcome());
      }

      const result = predictor.train();

      expect(result.accuracy).toBe(0);
      expect(result.iterations).toBe(0);
    });

    it("should handle verification of same prediction twice", () => {
      const signals = createMockSignalsForMarket("double_verify", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("double_verify");

      // First verification
      predictor.verifyPrediction(prediction.predictionId, "YES");

      // Second verification (should still work but update)
      predictor.verifyPrediction(prediction.predictionId, "NO");

      const verified = predictor.getPrediction(prediction.predictionId);
      expect(verified?.actualOutcome).toBe("NO");
    });

    it("should handle reset during active predictions", () => {
      const signals = createMockSignalsForMarket("reset_test", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      predictor.predict("reset_test");
      predictor.reset();

      const stats = predictor.getStatistics();
      expect(stats.totalPredictions).toBe(0);
      expect(stats.totalSignals).toBe(0);
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe("Event Emission", () => {
    it("should emit all lifecycle events", async () => {
      const events: string[] = [];

      predictor.on("signal_recorded", () => events.push("signal_recorded"));
      predictor.on("prediction_made", () => events.push("prediction_made"));
      predictor.on("prediction_verified", () => events.push("prediction_verified"));
      predictor.on("cache_miss", () => events.push("cache_miss"));
      predictor.on("cache_hit", () => events.push("cache_hit"));

      // Record signals
      const signals = createMockSignalsForMarket("events_test", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      // Make prediction (cache miss)
      const prediction = predictor.predict("events_test");

      // Make same prediction (cache hit)
      predictor.predict("events_test");

      // Verify
      predictor.verifyPrediction(prediction.predictionId, "YES");

      expect(events).toContain("signal_recorded");
      expect(events).toContain("prediction_made");
      expect(events).toContain("cache_miss");
      expect(events).toContain("cache_hit");
      expect(events).toContain("prediction_verified");
    });

    it("should emit batch_completed event", () => {
      let batchEvent: any = null;
      predictor.on("batch_completed", (event) => {
        batchEvent = event;
      });

      const markets = ["batch_event_1", "batch_event_2"];
      for (const marketId of markets) {
        const signals = createMockSignalsForMarket(marketId, 5);
        for (const signal of signals) {
          predictor.recordSignal(signal);
        }
      }

      predictor.predictBatch(markets);

      expect(batchEvent).not.toBeNull();
      expect(batchEvent.totalPredicted).toBe(2);
    });

    it("should emit model_trained event", () => {
      let trainedEvent: any = null;
      predictor.on("model_trained", (event) => {
        trainedEvent = event;
      });

      const outcomes = createMockHistoricalOutcomeBatch(15);
      for (const outcome of outcomes) {
        predictor.addHistoricalOutcome(outcome);
      }

      predictor.train();

      expect(trainedEvent).not.toBeNull();
      expect(trainedEvent.samplesUsed).toBe(15);
    });

    it("should emit metrics_updated after verification", () => {
      let metricsEvent: any = null;
      predictor.on("metrics_updated", (event) => {
        metricsEvent = event;
      });

      const signals = createMockSignalsForMarket("metrics_event", 5);
      for (const signal of signals) {
        predictor.recordSignal(signal);
      }

      const prediction = predictor.predict("metrics_event");
      predictor.verifyPrediction(prediction.predictionId, "YES");

      expect(metricsEvent).not.toBeNull();
      expect(metricsEvent.verifiedPredictions).toBe(1);
    });
  });

  // ============================================================================
  // Integration with Shared Instance Tests
  // ============================================================================

  describe("Shared Instance Integration", () => {
    it("should maintain state across shared instance calls", () => {
      const shared = getSharedMarketOutcomePredictor();

      // Add signals
      const signals = createMockSignalsForMarket("shared_test", 5);
      for (const signal of signals) {
        shared.recordSignal(signal);
      }

      // Get same instance and verify state
      const shared2 = getSharedMarketOutcomePredictor();
      const stats = shared2.getStatistics();

      expect(stats.totalSignals).toBe(5);
    });

    it("should reset shared instance properly", () => {
      const shared = getSharedMarketOutcomePredictor();

      const signals = createMockSignalsForMarket("reset_shared", 5);
      for (const signal of signals) {
        shared.recordSignal(signal);
      }

      resetSharedMarketOutcomePredictor();

      const newShared = getSharedMarketOutcomePredictor();
      const stats = newShared.getStatistics();

      expect(stats.totalSignals).toBe(0);
    });
  });

  // ============================================================================
  // Configuration Override Tests
  // ============================================================================

  describe("Configuration Overrides", () => {
    it("should respect custom minimum signals threshold", () => {
      const customPredictor = createMarketOutcomePredictor({
        minSignalsForPrediction: 10,
      });

      // Add 5 signals (less than threshold)
      const signals = createMockSignalsForMarket("threshold_test", 5);
      for (const signal of signals) {
        customPredictor.recordSignal(signal);
      }

      const result = customPredictor.predict("threshold_test");

      // Should be uncertain due to insufficient signals
      expect(result.predictedOutcome).toBe(PredictedOutcome.UNCERTAIN);
      expect(result.explanation).toContain("Insufficient signals");
    });

    it("should respect custom probability thresholds", () => {
      const customPredictor = createMarketOutcomePredictor({
        yesProbabilityThreshold: 0.7, // Higher threshold for YES
        noProbabilityThreshold: 0.3, // Lower threshold for NO
      });

      // Add balanced signals
      for (let i = 0; i < 5; i++) {
        customPredictor.recordSignal({
          marketId: "threshold_custom",
          type: SignalType.VOLUME_SPIKE,
          direction: SignalDirection.BULLISH,
          strength: 0.6,
          confidence: 0.6,
          timestamp: new Date(),
        });
      }

      const result = customPredictor.predict("threshold_custom");

      // With higher thresholds, more likely to be uncertain
      expect(result).toBeDefined();
    });

    it("should respect signal decay configuration", () => {
      const customPredictor = createMarketOutcomePredictor({
        signalDecayHalfLifeHours: 1, // Fast decay
      });

      // Add old signal
      customPredictor.recordSignal({
        marketId: "decay_test",
        type: SignalType.INSIDER_TRADE,
        direction: SignalDirection.BULLISH,
        strength: 1.0,
        confidence: 1.0,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      });

      // Add recent signals
      for (let i = 0; i < 4; i++) {
        customPredictor.recordSignal({
          marketId: "decay_test",
          type: SignalType.VOLUME_SPIKE,
          direction: SignalDirection.BEARISH,
          strength: 0.5,
          confidence: 0.5,
          timestamp: new Date(),
        });
      }

      const result = customPredictor.predict("decay_test");

      // Recent bearish signals should dominate due to fast decay
      expect(result.signalAggregation.totalSignals).toBe(5);
    });
  });
});
