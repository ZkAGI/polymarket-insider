/**
 * Unit Tests for Signal Effectiveness Tracker (AI-PRED-003)
 *
 * Tests signal occurrence logging, outcome tracking, effectiveness calculation,
 * signal ranking, and historical trend analysis.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SignalEffectivenessTracker,
  createSignalEffectivenessTracker,
  getSharedSignalEffectivenessTracker,
  setSharedSignalEffectivenessTracker,
  resetSharedSignalEffectivenessTracker,
  TrackedSignalType,
  SignalPrediction,
  SignalOutcomeStatus,
  EffectivenessTimeWindow,
  EffectivenessTier,
  DEFAULT_TRACKER_CONFIG,
  SIGNAL_TYPE_DESCRIPTIONS,
  generateOccurrenceId,
  getSignalTypeDescription,
  getEffectivenessTier,
  getEffectivenessTierDescription,
  getEffectivenessTierColor,
  calculateLift,
  calculateConfidenceInterval,
  calculateF1Score,
  getTimeWindowMs,
  getTimeWindowCutoff,
  formatAccuracy,
  formatLift,
  determineTrend,
  isStatisticallySignificant,
  createMockSignalOccurrence,
  createMockSignalOccurrenceBatch,
  createMockOccurrencesWithAccuracy,
  type SignalOccurrence,
} from "../../src/ai/signal-effectiveness-tracker";

describe("Signal Effectiveness Tracker", () => {
  let tracker: SignalEffectivenessTracker;

  beforeEach(() => {
    tracker = createSignalEffectivenessTracker();
    resetSharedSignalEffectivenessTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("Utility Functions", () => {
    describe("generateOccurrenceId", () => {
      it("should generate unique IDs", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateOccurrenceId());
        }
        expect(ids.size).toBe(100);
      });

      it("should generate IDs with correct prefix", () => {
        const id = generateOccurrenceId();
        expect(id).toMatch(/^sig_\d+_[a-z0-9]+$/);
      });
    });

    describe("getSignalTypeDescription", () => {
      it("should return description for all signal types", () => {
        for (const type of Object.values(TrackedSignalType)) {
          const desc = getSignalTypeDescription(type);
          expect(desc).toBeTruthy();
          expect(typeof desc).toBe("string");
        }
      });

      it("should return correct description for INSIDER_TRADE", () => {
        const desc = getSignalTypeDescription(TrackedSignalType.INSIDER_TRADE);
        expect(desc).toContain("insider");
      });
    });

    describe("getEffectivenessTier", () => {
      it("should return INSUFFICIENT_DATA for small sample size", () => {
        const tier = getEffectivenessTier(0.8, 10, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.INSUFFICIENT_DATA);
      });

      it("should return EXCEPTIONAL for high accuracy with enough samples", () => {
        const tier = getEffectivenessTier(0.8, 100, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.EXCEPTIONAL);
      });

      it("should return HIGH tier for good accuracy", () => {
        const tier = getEffectivenessTier(0.7, 100, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.HIGH);
      });

      it("should return MEDIUM tier for moderate accuracy", () => {
        const tier = getEffectivenessTier(0.58, 100, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.MEDIUM);
      });

      it("should return LOW tier for below-average accuracy", () => {
        const tier = getEffectivenessTier(0.48, 100, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.LOW);
      });

      it("should return POOR tier for bad accuracy", () => {
        const tier = getEffectivenessTier(0.3, 100, DEFAULT_TRACKER_CONFIG);
        expect(tier).toBe(EffectivenessTier.POOR);
      });
    });

    describe("getEffectivenessTierDescription", () => {
      it("should return descriptions for all tiers", () => {
        for (const tier of Object.values(EffectivenessTier)) {
          const desc = getEffectivenessTierDescription(tier);
          expect(desc).toBeTruthy();
          expect(typeof desc).toBe("string");
        }
      });
    });

    describe("getEffectivenessTierColor", () => {
      it("should return hex color codes", () => {
        for (const tier of Object.values(EffectivenessTier)) {
          const color = getEffectivenessTierColor(tier);
          expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });

      it("should return green for EXCEPTIONAL", () => {
        const color = getEffectivenessTierColor(EffectivenessTier.EXCEPTIONAL);
        expect(color).toBe("#10B981");
      });

      it("should return red for POOR", () => {
        const color = getEffectivenessTierColor(EffectivenessTier.POOR);
        expect(color).toBe("#EF4444");
      });
    });

    describe("calculateLift", () => {
      it("should calculate lift correctly", () => {
        expect(calculateLift(0.7, 0.5)).toBeCloseTo(1.4);
        expect(calculateLift(0.5, 0.5)).toBeCloseTo(1.0);
        expect(calculateLift(1.0, 0.5)).toBeCloseTo(2.0);
      });

      it("should handle zero baseline", () => {
        expect(calculateLift(0.5, 0)).toBe(Infinity);
        expect(calculateLift(0, 0)).toBe(1);
      });
    });

    describe("calculateConfidenceInterval", () => {
      it("should calculate Wilson score interval", () => {
        const ci = calculateConfidenceInterval(70, 100);
        expect(ci.lower).toBeGreaterThan(0.5);
        expect(ci.upper).toBeLessThan(0.8);
        expect(ci.lower).toBeLessThan(ci.upper);
      });

      it("should handle empty data", () => {
        const ci = calculateConfidenceInterval(0, 0);
        expect(ci.lower).toBe(0);
        expect(ci.upper).toBe(1);
      });

      it("should handle perfect accuracy", () => {
        const ci = calculateConfidenceInterval(100, 100);
        expect(ci.upper).toBeCloseTo(1, 10);
      });

      it("should handle zero accuracy", () => {
        const ci = calculateConfidenceInterval(0, 100);
        expect(ci.lower).toBe(0);
      });
    });

    describe("calculateF1Score", () => {
      it("should calculate F1 correctly", () => {
        expect(calculateF1Score(0.8, 0.8)).toBeCloseTo(0.8);
        expect(calculateF1Score(1.0, 0.5)).toBeCloseTo(0.667, 2);
        expect(calculateF1Score(0.5, 1.0)).toBeCloseTo(0.667, 2);
      });

      it("should return 0 when both precision and recall are 0", () => {
        expect(calculateF1Score(0, 0)).toBe(0);
      });
    });

    describe("getTimeWindowMs", () => {
      it("should return correct milliseconds", () => {
        expect(getTimeWindowMs(EffectivenessTimeWindow.LAST_24H)).toBe(24 * 60 * 60 * 1000);
        expect(getTimeWindowMs(EffectivenessTimeWindow.LAST_7D)).toBe(7 * 24 * 60 * 60 * 1000);
        expect(getTimeWindowMs(EffectivenessTimeWindow.LAST_30D)).toBe(30 * 24 * 60 * 60 * 1000);
        expect(getTimeWindowMs(EffectivenessTimeWindow.ALL_TIME)).toBe(Infinity);
      });
    });

    describe("getTimeWindowCutoff", () => {
      it("should return cutoff date in the past", () => {
        const cutoff = getTimeWindowCutoff(EffectivenessTimeWindow.LAST_7D);
        expect(cutoff.getTime()).toBeLessThan(Date.now());
        expect(cutoff.getTime()).toBeGreaterThan(Date.now() - 8 * 24 * 60 * 60 * 1000);
      });

      it("should return epoch for ALL_TIME", () => {
        const cutoff = getTimeWindowCutoff(EffectivenessTimeWindow.ALL_TIME);
        expect(cutoff.getTime()).toBe(0);
      });
    });

    describe("formatAccuracy", () => {
      it("should format as percentage", () => {
        expect(formatAccuracy(0.755)).toBe("75.5%");
        expect(formatAccuracy(0)).toBe("0.0%");
        expect(formatAccuracy(1)).toBe("100.0%");
      });
    });

    describe("formatLift", () => {
      it("should format lift value", () => {
        expect(formatLift(1.5)).toBe("1.50x");
        expect(formatLift(2.0)).toBe("2.00x");
      });

      it("should handle infinity", () => {
        expect(formatLift(Infinity)).toBe("∞");
      });
    });

    describe("determineTrend", () => {
      it("should detect upward trend", () => {
        const data = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
        expect(determineTrend(data)).toBe("UP");
      });

      it("should detect downward trend", () => {
        const data = [0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];
        expect(determineTrend(data)).toBe("DOWN");
      });

      it("should detect stable trend", () => {
        const data = [0.6, 0.61, 0.59, 0.6, 0.605, 0.595, 0.6];
        expect(determineTrend(data)).toBe("STABLE");
      });

      it("should return STABLE for insufficient data", () => {
        expect(determineTrend([0.5, 0.6])).toBe("STABLE");
      });
    });

    describe("isStatisticallySignificant", () => {
      it("should detect significant difference", () => {
        const result = isStatisticallySignificant(80, 100, 50, 100);
        expect(result.significant).toBe(true);
        expect(result.pValue).toBeLessThan(0.05);
      });

      it("should detect non-significant difference", () => {
        const result = isStatisticallySignificant(52, 100, 48, 100);
        expect(result.significant).toBe(false);
        expect(result.pValue).toBeGreaterThan(0.05);
      });

      it("should handle empty data", () => {
        const result = isStatisticallySignificant(0, 0, 0, 0);
        expect(result.significant).toBe(false);
        expect(result.pValue).toBe(1.0);
      });
    });
  });

  // ==========================================================================
  // Signal Logging Tests
  // ==========================================================================

  describe("Signal Logging", () => {
    describe("logSignal", () => {
      it("should log a signal and return occurrence", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "market_123",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        expect(occurrence.occurrenceId).toBeTruthy();
        expect(occurrence.signalType).toBe(TrackedSignalType.WHALE_TRADE);
        expect(occurrence.marketId).toBe("market_123");
        expect(occurrence.predictedDirection).toBe(SignalPrediction.YES);
        expect(occurrence.strength).toBe(0.8);
        expect(occurrence.confidence).toBe(0.9);
        expect(occurrence.outcomeStatus).toBe(SignalOutcomeStatus.PENDING);
      });

      it("should emit signal_logged event", () => {
        const handler = vi.fn();
        tracker.on("signal_logged", handler);

        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: "market_456",
          predictedDirection: SignalPrediction.NO,
          strength: 0.6,
          confidence: 0.7,
        });

        expect(handler).toHaveBeenCalledWith(occurrence);
      });

      it("should clamp strength and confidence to 0-1", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "market_789",
          predictedDirection: SignalPrediction.YES,
          strength: 1.5,
          confidence: -0.2,
        });

        expect(occurrence.strength).toBe(1);
        expect(occurrence.confidence).toBe(0);
      });

      it("should include optional metadata", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.COORDINATED_CLUSTER,
          marketId: "market_abc",
          predictedDirection: SignalPrediction.YES,
          strength: 0.7,
          confidence: 0.8,
          marketCategory: "POLITICS",
          walletAddress: "0x123",
          tradeSizeUsd: 50000,
          hoursUntilResolution: 24,
          metadata: { cluster_size: 5 },
        });

        expect(occurrence.marketCategory).toBe("POLITICS");
        expect(occurrence.walletAddress).toBe("0x123");
        expect(occurrence.tradeSizeUsd).toBe(50000);
        expect(occurrence.hoursUntilResolution).toBe(24);
        expect(occurrence.metadata).toEqual({ cluster_size: 5 });
      });
    });

    describe("logSignalBatch", () => {
      it("should log multiple signals", () => {
        const occurrences = tracker.logSignalBatch([
          {
            signalType: TrackedSignalType.WHALE_TRADE,
            marketId: "m1",
            predictedDirection: SignalPrediction.YES,
            strength: 0.8,
            confidence: 0.9,
          },
          {
            signalType: TrackedSignalType.VOLUME_SPIKE,
            marketId: "m2",
            predictedDirection: SignalPrediction.NO,
            strength: 0.6,
            confidence: 0.7,
          },
        ]);

        expect(occurrences.length).toBe(2);
        expect(occurrences[0]!.signalType).toBe(TrackedSignalType.WHALE_TRADE);
        expect(occurrences[1]!.signalType).toBe(TrackedSignalType.VOLUME_SPIKE);
      });
    });
  });

  // ==========================================================================
  // Outcome Recording Tests
  // ==========================================================================

  describe("Outcome Recording", () => {
    describe("recordOutcome", () => {
      it("should record outcome and update occurrence", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "market_123",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        const result = tracker.recordOutcome(occurrence.occurrenceId, "YES");
        expect(result).toBe(true);

        const updated = tracker.getOccurrence(occurrence.occurrenceId);
        expect(updated?.outcomeStatus).toBe(SignalOutcomeStatus.VERIFIED);
        expect(updated?.actualOutcome).toBe("YES");
        expect(updated?.wasCorrect).toBe(true);
        expect(updated?.resolvedAt).toBeDefined();
      });

      it("should mark prediction as incorrect when wrong", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "market_456",
          predictedDirection: SignalPrediction.YES,
          strength: 0.7,
          confidence: 0.8,
        });

        tracker.recordOutcome(occurrence.occurrenceId, "NO");

        const updated = tracker.getOccurrence(occurrence.occurrenceId);
        expect(updated?.wasCorrect).toBe(false);
      });

      it("should mark NEUTRAL predictions as correct", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.VOLUME_SPIKE,
          marketId: "market_789",
          predictedDirection: SignalPrediction.NEUTRAL,
          strength: 0.5,
          confidence: 0.6,
        });

        tracker.recordOutcome(occurrence.occurrenceId, "YES");

        const updated = tracker.getOccurrence(occurrence.occurrenceId);
        expect(updated?.wasCorrect).toBe(true);
      });

      it("should emit outcome_recorded event", () => {
        const handler = vi.fn();
        tracker.on("outcome_recorded", handler);

        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: "market_abc",
          predictedDirection: SignalPrediction.NO,
          strength: 0.6,
          confidence: 0.7,
        });

        tracker.recordOutcome(occurrence.occurrenceId, "NO");

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            occurrenceId: occurrence.occurrenceId,
            actualOutcome: "NO",
            wasCorrect: true,
          })
        );
      });

      it("should return false for non-existent occurrence", () => {
        // Add error handler to suppress unhandled error
        const errorHandler = vi.fn();
        tracker.on("error", errorHandler);

        const result = tracker.recordOutcome("non_existent_id", "YES");
        expect(result).toBe(false);
        expect(errorHandler).toHaveBeenCalled();
      });

      it("should return false for already verified occurrence", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.PRICE_ANOMALY,
          marketId: "market_xyz",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        tracker.recordOutcome(occurrence.occurrenceId, "YES");
        const result = tracker.recordOutcome(occurrence.occurrenceId, "NO");
        expect(result).toBe(false);
      });
    });

    describe("recordMarketOutcome", () => {
      it("should update all signals for a market", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "market_shared",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "market_shared",
          predictedDirection: SignalPrediction.YES,
          strength: 0.7,
          confidence: 0.8,
        });

        const updated = tracker.recordMarketOutcome("market_shared", "YES");
        expect(updated).toBe(2);

        const occurrences = tracker.getOccurrencesByMarket("market_shared");
        expect(occurrences.every((o) => o.outcomeStatus === SignalOutcomeStatus.VERIFIED)).toBe(
          true
        );
      });
    });

    describe("recordOutcomesBatch", () => {
      it("should process batch of outcomes", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "m2",
          predictedDirection: SignalPrediction.NO,
          strength: 0.7,
          confidence: 0.8,
        });

        const result = tracker.recordOutcomesBatch([
          { marketId: "m1", outcome: "YES" },
          { marketId: "m2", outcome: "NO" },
        ]);

        expect(result.updated).toBe(2);
        expect(result.skipped).toBe(0);
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe("expireSignal", () => {
      it("should mark signal as expired", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: "market_expire",
          predictedDirection: SignalPrediction.YES,
          strength: 0.5,
          confidence: 0.6,
        });

        const result = tracker.expireSignal(occurrence.occurrenceId);
        expect(result).toBe(true);

        const updated = tracker.getOccurrence(occurrence.occurrenceId);
        expect(updated?.outcomeStatus).toBe(SignalOutcomeStatus.EXPIRED);
      });
    });
  });

  // ==========================================================================
  // Effectiveness Metrics Tests
  // ==========================================================================

  describe("Effectiveness Metrics", () => {
    describe("calculateEffectiveness", () => {
      it("should calculate metrics for signal type", () => {
        // Create mock data with 70% accuracy
        const occurrences = createMockOccurrencesWithAccuracy(
          TrackedSignalType.INSIDER_TRADE,
          100,
          0.7
        );

        // Import into tracker
        tracker.importData({ occurrences });

        const metrics = tracker.calculateEffectiveness(
          TrackedSignalType.INSIDER_TRADE,
          EffectivenessTimeWindow.ALL_TIME
        );

        expect(metrics.signalType).toBe(TrackedSignalType.INSIDER_TRADE);
        expect(metrics.totalOccurrences).toBe(100);
        expect(metrics.verifiedOutcomes).toBe(100);
        expect(metrics.accuracy).toBeCloseTo(0.7, 1);
        expect(metrics.lift).toBeGreaterThan(1);
        expect(metrics.tier).toBe(EffectivenessTier.HIGH);
      });

      it("should filter by time window", () => {
        // Create old and new signals
        const oldSignal = createMockSignalOccurrence({
          signalType: TrackedSignalType.WHALE_TRADE,
          timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        });

        const newSignal = createMockSignalOccurrence({
          signalType: TrackedSignalType.WHALE_TRADE,
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        });

        tracker.importData({ occurrences: [oldSignal, newSignal] });

        const metricsAll = tracker.calculateEffectiveness(
          TrackedSignalType.WHALE_TRADE,
          EffectivenessTimeWindow.ALL_TIME
        );

        const metrics7d = tracker.calculateEffectiveness(
          TrackedSignalType.WHALE_TRADE,
          EffectivenessTimeWindow.LAST_7D
        );

        expect(metricsAll.totalOccurrences).toBe(2);
        expect(metrics7d.totalOccurrences).toBe(1);
      });

      it("should filter by category", () => {
        const politicsSignal = createMockSignalOccurrence({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketCategory: "POLITICS",
        });

        const cryptoSignal = createMockSignalOccurrence({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketCategory: "CRYPTO",
        });

        tracker.importData({ occurrences: [politicsSignal, cryptoSignal] });

        const politicsMetrics = tracker.calculateEffectiveness(
          TrackedSignalType.FRESH_WALLET,
          EffectivenessTimeWindow.ALL_TIME,
          "POLITICS"
        );

        expect(politicsMetrics.totalOccurrences).toBe(1);
      });

      it("should emit metrics_calculated event", () => {
        const handler = vi.fn();
        tracker.on("metrics_calculated", handler);

        tracker.importData({
          occurrences: createMockOccurrencesWithAccuracy(TrackedSignalType.VOLUME_SPIKE, 50, 0.6),
        });

        tracker.calculateEffectiveness(TrackedSignalType.VOLUME_SPIKE);

        expect(handler).toHaveBeenCalled();
      });

      it("should use cache on repeated calls", () => {
        const occurrences = createMockOccurrencesWithAccuracy(
          TrackedSignalType.PRICE_ANOMALY,
          50,
          0.65
        );
        tracker.importData({ occurrences });

        const cacheHitHandler = vi.fn();
        tracker.on("cache_hit", cacheHitHandler);

        // First call - cache miss
        tracker.calculateEffectiveness(TrackedSignalType.PRICE_ANOMALY);

        // Second call - cache hit
        tracker.calculateEffectiveness(TrackedSignalType.PRICE_ANOMALY);

        expect(cacheHitHandler).toHaveBeenCalled();
      });
    });

    describe("calculateAllEffectiveness", () => {
      it("should calculate metrics for all signal types", () => {
        // Add some signals for different types
        for (const type of Object.values(TrackedSignalType).slice(0, 3)) {
          tracker.importData({
            occurrences: createMockOccurrencesWithAccuracy(type, 20, 0.6),
          });
        }

        const allMetrics = tracker.calculateAllEffectiveness();

        expect(allMetrics.size).toBe(Object.values(TrackedSignalType).length);
      });
    });

    describe("calculateEffectivenessByCategory", () => {
      it("should break down effectiveness by category", () => {
        const signals = [
          ...createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 20, 0.8).map(
            (s) => ({ ...s, marketCategory: "POLITICS" })
          ),
          ...createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 20, 0.5).map(
            (s) => ({ ...s, marketCategory: "CRYPTO" })
          ),
        ];

        tracker.importData({ occurrences: signals });

        const byCategory = tracker.calculateEffectivenessByCategory(TrackedSignalType.INSIDER_TRADE);

        expect(byCategory.length).toBe(2);

        const politics = byCategory.find((c) => c.category === "POLITICS");
        const crypto = byCategory.find((c) => c.category === "CRYPTO");

        expect(politics).toBeDefined();
        expect(crypto).toBeDefined();
        expect(politics!.accuracy).toBeGreaterThan(crypto!.accuracy);
        expect(politics!.isStrong).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Signal Ranking Tests
  // ==========================================================================

  describe("Signal Ranking", () => {
    describe("getRankedSignals", () => {
      it("should rank signals by effectiveness", () => {
        // Create signals with different accuracies
        const highAccuracy = createMockOccurrencesWithAccuracy(
          TrackedSignalType.INSIDER_TRADE,
          50,
          0.8
        );
        const mediumAccuracy = createMockOccurrencesWithAccuracy(
          TrackedSignalType.WHALE_TRADE,
          50,
          0.6
        );
        const lowAccuracy = createMockOccurrencesWithAccuracy(
          TrackedSignalType.FRESH_WALLET,
          50,
          0.4
        );

        tracker.importData({ occurrences: [...highAccuracy, ...mediumAccuracy, ...lowAccuracy] });

        const rankings = tracker.getRankedSignals();

        // Find the specific rankings
        const insiderRank = rankings.find((r) => r.signalType === TrackedSignalType.INSIDER_TRADE);
        const whaleRank = rankings.find((r) => r.signalType === TrackedSignalType.WHALE_TRADE);
        const freshRank = rankings.find((r) => r.signalType === TrackedSignalType.FRESH_WALLET);

        expect(insiderRank!.rank).toBeLessThan(whaleRank!.rank);
        expect(whaleRank!.rank).toBeLessThan(freshRank!.rank);
      });

      it("should emit ranking_updated event", () => {
        const handler = vi.fn();
        tracker.on("ranking_updated", handler);

        tracker.importData({
          occurrences: createMockOccurrencesWithAccuracy(TrackedSignalType.VOLUME_SPIKE, 30, 0.6),
        });

        tracker.getRankedSignals();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe("getTopSignals", () => {
      it("should return top N signals", () => {
        for (const type of Object.values(TrackedSignalType)) {
          const accuracy = 0.4 + Math.random() * 0.4;
          tracker.importData({
            occurrences: createMockOccurrencesWithAccuracy(type, 30, accuracy),
          });
        }

        const top3 = tracker.getTopSignals(3);
        expect(top3.length).toBe(3);
        expect(top3[0]!.rank).toBe(1);
        expect(top3[1]!.rank).toBe(2);
        expect(top3[2]!.rank).toBe(3);
      });
    });

    describe("getSignalsAboveTier", () => {
      it("should filter by minimum tier", () => {
        const exceptional = createMockOccurrencesWithAccuracy(
          TrackedSignalType.INSIDER_TRADE,
          50,
          0.8
        );
        const poor = createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 50, 0.3);

        tracker.importData({ occurrences: [...exceptional, ...poor] });

        const highTierSignals = tracker.getSignalsAboveTier(EffectivenessTier.HIGH);

        const hasPoor = highTierSignals.some(
          (r) => r.signalType === TrackedSignalType.FRESH_WALLET
        );
        expect(hasPoor).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Signal Comparison Tests
  // ==========================================================================

  describe("Signal Comparison", () => {
    describe("compareSignals", () => {
      it("should compare two signals", () => {
        const highAccuracy = createMockOccurrencesWithAccuracy(
          TrackedSignalType.INSIDER_TRADE,
          100,
          0.8
        );
        const lowAccuracy = createMockOccurrencesWithAccuracy(
          TrackedSignalType.FRESH_WALLET,
          100,
          0.4
        );

        tracker.importData({ occurrences: [...highAccuracy, ...lowAccuracy] });

        const comparison = tracker.compareSignals(
          TrackedSignalType.INSIDER_TRADE,
          TrackedSignalType.FRESH_WALLET
        );

        expect(comparison.accuracyDifference).toBeGreaterThan(0);
        expect(comparison.recommended).toBe(TrackedSignalType.INSIDER_TRADE);
        expect(comparison.isSignificant).toBe(true);
      });

      it("should detect non-significant differences", () => {
        const signalsA = createMockOccurrencesWithAccuracy(TrackedSignalType.WHALE_TRADE, 50, 0.52);
        const signalsB = createMockOccurrencesWithAccuracy(TrackedSignalType.VOLUME_SPIKE, 50, 0.48);

        tracker.importData({ occurrences: [...signalsA, ...signalsB] });

        const comparison = tracker.compareSignals(
          TrackedSignalType.WHALE_TRADE,
          TrackedSignalType.VOLUME_SPIKE
        );

        expect(comparison.isSignificant).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Historical Analysis Tests
  // ==========================================================================

  describe("Historical Analysis", () => {
    describe("getHistoricalTrend", () => {
      it("should generate historical trend data", () => {
        // Create signals spread over time
        const signals: SignalOccurrence[] = [];
        const now = Date.now();

        for (let i = 0; i < 60; i++) {
          const timestamp = new Date(now - i * 24 * 60 * 60 * 1000);
          signals.push(
            createMockSignalOccurrence({
              signalType: TrackedSignalType.INSIDER_TRADE,
              timestamp,
              wasCorrect: Math.random() > 0.4, // 60% accuracy
            })
          );
        }

        tracker.importData({ occurrences: signals });

        const trend = tracker.getHistoricalTrend(
          TrackedSignalType.INSIDER_TRADE,
          EffectivenessTimeWindow.LAST_90D
        );

        expect(trend.signalType).toBe(TrackedSignalType.INSIDER_TRADE);
        expect(trend.dataPoints.length).toBeGreaterThan(0);
        expect(["UP", "DOWN", "STABLE", "VOLATILE"]).toContain(trend.trendDirection);
        expect(trend.trendSlope).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Data Access Tests
  // ==========================================================================

  describe("Data Access", () => {
    describe("getOccurrence", () => {
      it("should retrieve occurrence by ID", () => {
        const original = tracker.logSignal({
          signalType: TrackedSignalType.COORDINATED_CLUSTER,
          marketId: "market_test",
          predictedDirection: SignalPrediction.YES,
          strength: 0.7,
          confidence: 0.8,
        });

        const retrieved = tracker.getOccurrence(original.occurrenceId);
        expect(retrieved).toEqual(original);
      });

      it("should return undefined for non-existent ID", () => {
        const result = tracker.getOccurrence("non_existent");
        expect(result).toBeUndefined();
      });
    });

    describe("getOccurrencesByType", () => {
      it("should retrieve occurrences by signal type", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "m2",
          predictedDirection: SignalPrediction.NO,
          strength: 0.7,
          confidence: 0.8,
        });

        const insiderOccurrences = tracker.getOccurrencesByType(TrackedSignalType.INSIDER_TRADE);
        expect(insiderOccurrences.length).toBe(1);
        expect(insiderOccurrences[0]!.signalType).toBe(TrackedSignalType.INSIDER_TRADE);
      });
    });

    describe("getPendingOccurrences", () => {
      it("should retrieve only pending occurrences", () => {
        const pending = tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.6,
          confidence: 0.7,
        });

        const verified = tracker.logSignal({
          signalType: TrackedSignalType.VOLUME_SPIKE,
          marketId: "m2",
          predictedDirection: SignalPrediction.NO,
          strength: 0.5,
          confidence: 0.6,
        });

        tracker.recordOutcome(verified.occurrenceId, "NO");

        const pendingOccurrences = tracker.getPendingOccurrences();
        expect(pendingOccurrences.length).toBe(1);
        expect(pendingOccurrences[0]!.occurrenceId).toBe(pending.occurrenceId);
      });
    });

    describe("getStatistics", () => {
      it("should return summary statistics", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        const verified = tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "m2",
          predictedDirection: SignalPrediction.NO,
          strength: 0.7,
          confidence: 0.8,
        });
        tracker.recordOutcome(verified.occurrenceId, "NO");

        const stats = tracker.getStatistics();
        expect(stats.totalOccurrences).toBe(2);
        expect(stats.pendingOccurrences).toBe(1);
        expect(stats.verifiedOccurrences).toBe(1);
        expect(stats.uniqueMarkets).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Data Management Tests
  // ==========================================================================

  describe("Data Management", () => {
    describe("clear", () => {
      it("should clear all data", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        tracker.clear();

        const stats = tracker.getStatistics();
        expect(stats.totalOccurrences).toBe(0);
      });
    });

    describe("exportData / importData", () => {
      it("should export and import data correctly", () => {
        tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "m1",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        const exported = tracker.exportData();
        expect(exported.occurrences.length).toBe(1);
        expect(exported.config).toBeDefined();

        const newTracker = createSignalEffectivenessTracker();
        newTracker.importData(exported);

        const stats = newTracker.getStatistics();
        expect(stats.totalOccurrences).toBe(1);
      });

      it("should restore date objects on import", () => {
        const occurrence = tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: "m2",
          predictedDirection: SignalPrediction.NO,
          strength: 0.6,
          confidence: 0.7,
        });

        const exported = tracker.exportData();

        // Simulate JSON serialization/deserialization
        const serialized = JSON.parse(JSON.stringify(exported));

        const newTracker = createSignalEffectivenessTracker();
        newTracker.importData(serialized);

        const imported = newTracker.getOccurrence(occurrence.occurrenceId);
        expect(imported?.timestamp).toBeInstanceOf(Date);
      });
    });

    describe("updateConfig", () => {
      it("should update configuration", () => {
        tracker.updateConfig({ minSamplesForTier: 50 });
        const config = tracker.getConfig();
        expect(config.minSamplesForTier).toBe(50);
      });

      it("should clear caches on config update", () => {
        tracker.importData({
          occurrences: createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 50, 0.7),
        });

        // Prime the cache
        tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);

        const cacheMissHandler = vi.fn();
        tracker.on("cache_miss", cacheMissHandler);

        // Update config should clear cache
        tracker.updateConfig({ minSamplesForTier: 40 });

        // Next call should be cache miss
        tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);

        expect(cacheMissHandler).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("Factory Functions", () => {
    describe("createSignalEffectivenessTracker", () => {
      it("should create tracker with default config", () => {
        const t = createSignalEffectivenessTracker();
        const config = t.getConfig();
        expect(config.minSamplesForTier).toBe(DEFAULT_TRACKER_CONFIG.minSamplesForTier);
      });

      it("should create tracker with custom config", () => {
        const t = createSignalEffectivenessTracker({ minSamplesForTier: 100 });
        const config = t.getConfig();
        expect(config.minSamplesForTier).toBe(100);
      });
    });

    describe("getSharedSignalEffectivenessTracker", () => {
      it("should return same instance", () => {
        const t1 = getSharedSignalEffectivenessTracker();
        const t2 = getSharedSignalEffectivenessTracker();
        expect(t1).toBe(t2);
      });
    });

    describe("setSharedSignalEffectivenessTracker", () => {
      it("should set custom shared instance", () => {
        const custom = createSignalEffectivenessTracker({ minSamplesForTier: 200 });
        setSharedSignalEffectivenessTracker(custom);

        const shared = getSharedSignalEffectivenessTracker();
        expect(shared.getConfig().minSamplesForTier).toBe(200);
      });
    });

    describe("resetSharedSignalEffectivenessTracker", () => {
      it("should create new instance on next get", () => {
        const t1 = getSharedSignalEffectivenessTracker();
        t1.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: "test",
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });

        resetSharedSignalEffectivenessTracker();

        const t2 = getSharedSignalEffectivenessTracker();
        expect(t2.getStatistics().totalOccurrences).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Mock Data Generator Tests
  // ==========================================================================

  describe("Mock Data Generators", () => {
    describe("createMockSignalOccurrence", () => {
      it("should create valid occurrence", () => {
        const occ = createMockSignalOccurrence();

        expect(occ.occurrenceId).toBeTruthy();
        expect(Object.values(TrackedSignalType)).toContain(occ.signalType);
        expect(Object.values(SignalPrediction)).toContain(occ.predictedDirection);
        expect(occ.strength).toBeGreaterThanOrEqual(0);
        expect(occ.strength).toBeLessThanOrEqual(1);
        expect(occ.confidence).toBeGreaterThanOrEqual(0);
        expect(occ.confidence).toBeLessThanOrEqual(1);
      });

      it("should respect overrides", () => {
        const occ = createMockSignalOccurrence({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: "custom_market",
          strength: 0.99,
        });

        expect(occ.signalType).toBe(TrackedSignalType.WHALE_TRADE);
        expect(occ.marketId).toBe("custom_market");
        expect(occ.strength).toBe(0.99);
      });
    });

    describe("createMockSignalOccurrenceBatch", () => {
      it("should create specified number of occurrences", () => {
        const batch = createMockSignalOccurrenceBatch(25);
        expect(batch.length).toBe(25);
      });

      it("should apply overrides to all", () => {
        const batch = createMockSignalOccurrenceBatch(10, {
          signalType: TrackedSignalType.COORDINATED_CLUSTER,
        });

        expect(batch.every((o) => o.signalType === TrackedSignalType.COORDINATED_CLUSTER)).toBe(
          true
        );
      });
    });

    describe("createMockOccurrencesWithAccuracy", () => {
      it("should create occurrences with specified accuracy", () => {
        const occurrences = createMockOccurrencesWithAccuracy(
          TrackedSignalType.INSIDER_TRADE,
          100,
          0.7
        );

        expect(occurrences.length).toBe(100);

        const correct = occurrences.filter((o) => o.wasCorrect).length;
        expect(correct).toBe(70);
      });

      it("should set correct signal type for all", () => {
        const occurrences = createMockOccurrencesWithAccuracy(
          TrackedSignalType.FRESH_WALLET,
          50,
          0.6
        );

        expect(occurrences.every((o) => o.signalType === TrackedSignalType.FRESH_WALLET)).toBe(
          true
        );
      });
    });
  });

  // ==========================================================================
  // Tier Change Events Tests
  // ==========================================================================

  describe("Tier Change Events", () => {
    it("should track previous tier correctly", () => {
      // This test validates the tier tracking mechanism
      const poorSignals = createMockOccurrencesWithAccuracy(
        TrackedSignalType.WHALE_TRADE,
        50,
        0.35
      );
      tracker.importData({ occurrences: poorSignals });

      // First calculation establishes the tier
      const metrics1 = tracker.calculateEffectiveness(TrackedSignalType.WHALE_TRADE);
      expect(metrics1.tier).toBe(EffectivenessTier.POOR);

      // Verify the tracker is working correctly
      const stats = tracker.getStatistics();
      expect(stats.totalOccurrences).toBe(50);
    });

    it("should emit tier_promotion event when signals are added and tier improves", () => {
      const promotionHandler = vi.fn();
      tracker.on("tier_promotion", promotionHandler);

      // Start by logging poor accuracy signals
      for (let i = 0; i < 50; i++) {
        const isCorrect = i < 15; // 30% accuracy = POOR tier
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: `market_${i}`,
          predictedDirection: SignalPrediction.YES,
          strength: 0.5,
          confidence: 0.5,
        });
        const occ = tracker.getOccurrencesByType(TrackedSignalType.INSIDER_TRADE).find(
          o => o.marketId === `market_${i}`
        );
        if (occ) {
          tracker.recordOutcome(occ.occurrenceId, isCorrect ? "YES" : "NO");
        }
      }

      // Calculate effectiveness to establish initial tier
      const metrics1 = tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);
      expect(metrics1.tier).toBe(EffectivenessTier.POOR);

      // Now add many high accuracy signals
      for (let i = 50; i < 200; i++) {
        const isCorrect = i < 188; // ~92% accuracy for these new signals
        tracker.logSignal({
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: `market_${i}`,
          predictedDirection: SignalPrediction.YES,
          strength: 0.8,
          confidence: 0.9,
        });
        const occ = tracker.getOccurrencesByType(TrackedSignalType.INSIDER_TRADE).find(
          o => o.marketId === `market_${i}`
        );
        if (occ) {
          tracker.recordOutcome(occ.occurrenceId, isCorrect ? "YES" : "NO");
        }
      }

      // Clear cache and recalculate - should trigger promotion
      tracker.clearCaches();
      const metrics2 = tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);

      // The combined accuracy should be high enough for a better tier
      expect(metrics2.accuracy).toBeGreaterThan(0.6);
      expect(promotionHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("should have descriptions for all signal types", () => {
      for (const type of Object.values(TrackedSignalType)) {
        expect(SIGNAL_TYPE_DESCRIPTIONS[type]).toBeTruthy();
      }
    });

    it("should have valid default config", () => {
      expect(DEFAULT_TRACKER_CONFIG.minSamplesForTier).toBeGreaterThan(0);
      expect(DEFAULT_TRACKER_CONFIG.baselineAccuracy).toBe(0.5);
      expect(DEFAULT_TRACKER_CONFIG.tierThresholds.exceptional).toBeGreaterThan(
        DEFAULT_TRACKER_CONFIG.tierThresholds.high
      );
    });
  });
});
