/**
 * End-to-End Tests for Signal Effectiveness Tracker (AI-PRED-003)
 *
 * Tests real-world scenarios of signal tracking, outcome recording,
 * effectiveness calculation, and ranking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SignalEffectivenessTracker,
  createSignalEffectivenessTracker,
  TrackedSignalType,
  SignalPrediction,
  SignalOutcomeStatus,
  EffectivenessTimeWindow,
  EffectivenessTier,
  createMockOccurrencesWithAccuracy,
} from "../../src/ai/signal-effectiveness-tracker";

describe("Signal Effectiveness Tracker E2E", () => {
  let tracker: SignalEffectivenessTracker;

  beforeEach(() => {
    tracker = createSignalEffectivenessTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  // ==========================================================================
  // Real-world Signal Tracking Scenarios
  // ==========================================================================

  describe("Signal Tracking Workflow", () => {
    it("should track signals through complete lifecycle", async () => {
      // Simulate a real scenario: detect whale trade, market resolves YES

      // 1. Log a whale trade signal
      const signal = tracker.logSignal({
        signalType: TrackedSignalType.WHALE_TRADE,
        marketId: "will-btc-reach-100k-2025",
        marketCategory: "CRYPTO",
        predictedDirection: SignalPrediction.YES,
        strength: 0.85,
        confidence: 0.9,
        walletAddress: "0x1234567890abcdef",
        tradeSizeUsd: 500000,
        hoursUntilResolution: 168,
        metadata: {
          previousBalance: 0,
          newBalance: 500000,
        },
      });

      // 2. Verify signal is pending
      expect(signal.outcomeStatus).toBe(SignalOutcomeStatus.PENDING);
      expect(tracker.getPendingOccurrences().length).toBe(1);

      // 3. Market resolves
      const updated = tracker.recordOutcome(signal.occurrenceId, "YES");
      expect(updated).toBe(true);

      // 4. Verify outcome recorded correctly
      const finalOccurrence = tracker.getOccurrence(signal.occurrenceId);
      expect(finalOccurrence?.outcomeStatus).toBe(SignalOutcomeStatus.VERIFIED);
      expect(finalOccurrence?.actualOutcome).toBe("YES");
      expect(finalOccurrence?.wasCorrect).toBe(true);
      expect(finalOccurrence?.resolvedAt).toBeDefined();

      // 5. Verify pending count decreased
      expect(tracker.getPendingOccurrences().length).toBe(0);
    });

    it("should handle multiple signals for same market", async () => {
      const marketId = "us-election-2024";

      // Multiple signals for the same market from different sources
      tracker.logSignal({
        signalType: TrackedSignalType.INSIDER_TRADE,
        marketId,
        marketCategory: "POLITICS",
        predictedDirection: SignalPrediction.YES,
        strength: 0.9,
        confidence: 0.85,
      });

      tracker.logSignal({
        signalType: TrackedSignalType.FRESH_WALLET,
        marketId,
        marketCategory: "POLITICS",
        predictedDirection: SignalPrediction.YES,
        strength: 0.7,
        confidence: 0.6,
      });

      tracker.logSignal({
        signalType: TrackedSignalType.COORDINATED_CLUSTER,
        marketId,
        marketCategory: "POLITICS",
        predictedDirection: SignalPrediction.YES,
        strength: 0.8,
        confidence: 0.75,
      });

      // Verify all signals logged
      const marketSignals = tracker.getOccurrencesByMarket(marketId);
      expect(marketSignals.length).toBe(3);

      // Market resolves
      const updated = tracker.recordMarketOutcome(marketId, "YES");
      expect(updated).toBe(3);

      // All signals should be correct
      const verifiedSignals = tracker.getOccurrencesByMarket(marketId);
      expect(verifiedSignals.every((s) => s.wasCorrect)).toBe(true);
    });
  });

  // ==========================================================================
  // Effectiveness Calculation E2E
  // ==========================================================================

  describe("Effectiveness Calculation E2E", () => {
    it("should calculate effectiveness metrics for realistic data", () => {
      // Simulate 6 months of trading data
      const signalTypes = [
        { type: TrackedSignalType.INSIDER_TRADE, accuracy: 0.72, count: 150 },
        { type: TrackedSignalType.WHALE_TRADE, accuracy: 0.65, count: 200 },
        { type: TrackedSignalType.FRESH_WALLET, accuracy: 0.48, count: 300 },
        { type: TrackedSignalType.VOLUME_SPIKE, accuracy: 0.55, count: 180 },
        { type: TrackedSignalType.COORDINATED_CLUSTER, accuracy: 0.68, count: 80 },
      ];

      // Combine all occurrences into single array and import once
      const allOccurrences = signalTypes.flatMap(({ type, accuracy, count }) =>
        createMockOccurrencesWithAccuracy(type, count, accuracy)
      );
      tracker.importData({ occurrences: allOccurrences });

      // Calculate effectiveness for each type
      for (const { type, accuracy } of signalTypes) {
        const metrics = tracker.calculateEffectiveness(type);

        // Accuracy should be close to expected
        expect(Math.abs(metrics.accuracy - accuracy)).toBeLessThan(0.05);

        // Lift should be > 1 for signals above 50%
        if (accuracy > 0.5) {
          expect(metrics.lift).toBeGreaterThan(1);
        }
      }
    });

    it("should correctly rank signals by effectiveness", () => {
      // Create signals with clear accuracy differences
      const signalData = [
        { type: TrackedSignalType.INSIDER_TRADE, accuracy: 0.85, count: 100 },
        { type: TrackedSignalType.COORDINATED_CLUSTER, accuracy: 0.75, count: 100 },
        { type: TrackedSignalType.WHALE_TRADE, accuracy: 0.60, count: 100 },
        { type: TrackedSignalType.FRESH_WALLET, accuracy: 0.40, count: 100 },
      ];

      // Combine all occurrences into single import
      const allOccurrences = signalData.flatMap(({ type, accuracy, count }) =>
        createMockOccurrencesWithAccuracy(type, count, accuracy)
      );
      tracker.importData({ occurrences: allOccurrences });

      const rankings = tracker.getRankedSignals();

      // Find ranks for our signal types
      const insiderRank = rankings.find((r) => r.signalType === TrackedSignalType.INSIDER_TRADE);
      const clusterRank = rankings.find(
        (r) => r.signalType === TrackedSignalType.COORDINATED_CLUSTER
      );
      const whaleRank = rankings.find((r) => r.signalType === TrackedSignalType.WHALE_TRADE);
      const freshRank = rankings.find((r) => r.signalType === TrackedSignalType.FRESH_WALLET);

      // Verify ranking order
      expect(insiderRank!.rank).toBeLessThan(clusterRank!.rank);
      expect(clusterRank!.rank).toBeLessThan(whaleRank!.rank);
      expect(whaleRank!.rank).toBeLessThan(freshRank!.rank);

      // Verify tiers
      expect(insiderRank!.tier).toBe(EffectivenessTier.EXCEPTIONAL);
      expect(clusterRank!.tier).toBe(EffectivenessTier.EXCEPTIONAL);
      expect(whaleRank!.tier).toBe(EffectivenessTier.MEDIUM);
      expect(freshRank!.tier).toBe(EffectivenessTier.POOR);
    });

    it("should compare signals and determine statistical significance", () => {
      // Create two signal types with clearly different effectiveness
      const insiderSignals = createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 200, 0.75);
      const freshSignals = createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 200, 0.45);

      // Import both together
      tracker.importData({
        occurrences: [...insiderSignals, ...freshSignals],
      });

      const comparison = tracker.compareSignals(
        TrackedSignalType.INSIDER_TRADE,
        TrackedSignalType.FRESH_WALLET
      );

      expect(comparison.accuracyDifference).toBeGreaterThan(0.2);
      expect(comparison.recommended).toBe(TrackedSignalType.INSIDER_TRADE);
    });
  });

  // ==========================================================================
  // Category-Based Analysis E2E
  // ==========================================================================

  describe("Category-Based Analysis E2E", () => {
    it("should identify signals that work better in specific categories", () => {
      // Insider trades are particularly effective for politics
      const politicsInsiders = createMockOccurrencesWithAccuracy(
        TrackedSignalType.INSIDER_TRADE,
        100,
        0.82
      ).map((o) => ({ ...o, marketCategory: "POLITICS" }));

      // Insider trades are less effective for crypto
      const cryptoInsiders = createMockOccurrencesWithAccuracy(
        TrackedSignalType.INSIDER_TRADE,
        100,
        0.55
      ).map((o) => ({ ...o, marketCategory: "CRYPTO" }));

      // Fresh wallets work better for crypto
      const cryptoFresh = createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 100, 0.7).map(
        (o) => ({ ...o, marketCategory: "CRYPTO" })
      );

      tracker.importData({
        occurrences: [...politicsInsiders, ...cryptoInsiders, ...cryptoFresh],
      });

      // Analyze insider trade by category
      const insiderByCategory = tracker.calculateEffectivenessByCategory(
        TrackedSignalType.INSIDER_TRADE
      );

      const politicsEffectiveness = insiderByCategory.find((c) => c.category === "POLITICS");
      const cryptoEffectiveness = insiderByCategory.find((c) => c.category === "CRYPTO");

      expect(politicsEffectiveness).toBeDefined();
      expect(cryptoEffectiveness).toBeDefined();
      expect(politicsEffectiveness!.accuracy).toBeGreaterThan(cryptoEffectiveness!.accuracy);
      expect(politicsEffectiveness!.isStrong).toBe(true);
    });
  });

  // ==========================================================================
  // Time-Based Analysis E2E
  // ==========================================================================

  describe("Time-Based Analysis E2E", () => {
    it("should filter effectiveness by time window", () => {
      const now = Date.now();

      // Old signals (40 days ago) - poor performance
      const oldSignals = createMockOccurrencesWithAccuracy(
        TrackedSignalType.VOLUME_SPIKE,
        50,
        0.4
      ).map((o) => ({
        ...o,
        timestamp: new Date(now - 40 * 24 * 60 * 60 * 1000),
      }));

      // Recent signals (5 days ago) - good performance
      const recentSignals = createMockOccurrencesWithAccuracy(
        TrackedSignalType.VOLUME_SPIKE,
        50,
        0.75
      ).map((o) => ({
        ...o,
        timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000),
      }));

      tracker.importData({ occurrences: [...oldSignals, ...recentSignals] });

      // All time includes both
      const allTimeMetrics = tracker.calculateEffectiveness(
        TrackedSignalType.VOLUME_SPIKE,
        EffectivenessTimeWindow.ALL_TIME
      );

      // Last 7 days only includes recent
      const last7dMetrics = tracker.calculateEffectiveness(
        TrackedSignalType.VOLUME_SPIKE,
        EffectivenessTimeWindow.LAST_7D
      );

      // Last 30 days only includes recent
      const last30dMetrics = tracker.calculateEffectiveness(
        TrackedSignalType.VOLUME_SPIKE,
        EffectivenessTimeWindow.LAST_30D
      );

      expect(allTimeMetrics.totalOccurrences).toBe(100);
      expect(last7dMetrics.totalOccurrences).toBe(50);
      expect(last30dMetrics.totalOccurrences).toBe(50);

      // Recent window should show better accuracy
      expect(last7dMetrics.accuracy).toBeGreaterThan(allTimeMetrics.accuracy);
    });

    it("should generate historical trend data", () => {
      const now = Date.now();

      // Create signals over 90 days
      const signals = [];
      for (let day = 90; day >= 1; day--) {
        // Improving accuracy over time (40% to 75%)
        const accuracy = 0.4 + (90 - day) * (0.35 / 90);
        const isCorrect = Math.random() < accuracy;

        signals.push({
          occurrenceId: `sig_${day}`,
          signalType: TrackedSignalType.INSIDER_TRADE,
          marketId: `market_${day}`,
          predictedDirection: SignalPrediction.YES,
          strength: 0.7,
          confidence: 0.8,
          timestamp: new Date(now - day * 24 * 60 * 60 * 1000),
          outcomeStatus: SignalOutcomeStatus.VERIFIED,
          actualOutcome: isCorrect ? "YES" : "NO",
          wasCorrect: isCorrect,
          resolvedAt: new Date(now - day * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        });
      }

      tracker.importData({ occurrences: signals as any });

      const trend = tracker.getHistoricalTrend(
        TrackedSignalType.INSIDER_TRADE,
        EffectivenessTimeWindow.LAST_90D
      );

      expect(trend.dataPoints.length).toBeGreaterThan(0);
      expect(["UP", "DOWN", "STABLE", "VOLATILE"]).toContain(trend.trendDirection);
      expect(trend.trendSlope).toBeDefined();

      // Since we simulated improving accuracy, trend should be UP or STABLE
      // (Randomness may cause some variation)
      expect(["UP", "STABLE"]).toContain(trend.trendDirection);
    });
  });

  // ==========================================================================
  // Batch Operations E2E
  // ==========================================================================

  describe("Batch Operations E2E", () => {
    it("should handle batch outcome updates efficiently", () => {
      // Log signals for multiple markets
      const markets = [];
      for (let i = 0; i < 50; i++) {
        tracker.logSignal({
          signalType: TrackedSignalType.WHALE_TRADE,
          marketId: `market_${i}`,
          predictedDirection: i % 2 === 0 ? SignalPrediction.YES : SignalPrediction.NO,
          strength: 0.7,
          confidence: 0.8,
        });
        markets.push({ marketId: `market_${i}`, outcome: i % 2 === 0 ? "YES" : "NO" });
      }

      // Batch update outcomes
      const result = tracker.recordOutcomesBatch(
        markets as Array<{ marketId: string; outcome: "YES" | "NO" }>
      );

      expect(result.totalProcessed).toBe(50);
      expect(result.updated).toBe(50);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

      // Verify all outcomes recorded
      expect(tracker.getPendingOccurrences().length).toBe(0);
    });

    it("should handle large volumes of signal data", () => {
      // Simulate 1000 signals
      const signalTypeValues = Object.values(TrackedSignalType) as TrackedSignalType[];
      const signals = [];
      for (let i = 0; i < 1000; i++) {
        signals.push({
          signalType: signalTypeValues[i % signalTypeValues.length]!,
          marketId: `market_${i}`,
          predictedDirection: SignalPrediction.YES,
          strength: Math.random(),
          confidence: Math.random(),
        });
      }

      // Log all signals
      const logged = tracker.logSignalBatch(signals);
      expect(logged.length).toBe(1000);

      // Verify statistics
      const stats = tracker.getStatistics();
      expect(stats.totalOccurrences).toBe(1000);
      expect(stats.pendingOccurrences).toBe(1000);
      expect(stats.uniqueMarkets).toBe(1000);
    });
  });

  // ==========================================================================
  // Data Persistence E2E
  // ==========================================================================

  describe("Data Persistence E2E", () => {
    it("should export and import complete tracker state", () => {
      // Create complex tracker state
      tracker.importData({
        occurrences: createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 100, 0.7),
      });

      tracker.importData({
        occurrences: createMockOccurrencesWithAccuracy(TrackedSignalType.WHALE_TRADE, 80, 0.65),
      });

      // Add some pending signals
      for (let i = 0; i < 10; i++) {
        tracker.logSignal({
          signalType: TrackedSignalType.FRESH_WALLET,
          marketId: `pending_${i}`,
          predictedDirection: SignalPrediction.YES,
          strength: 0.6,
          confidence: 0.7,
        });
      }

      // Export state
      const exported = tracker.exportData();

      // Create new tracker and import
      const newTracker = createSignalEffectivenessTracker();
      newTracker.importData(exported);

      // Verify state restored
      const newStats = newTracker.getStatistics();
      const originalStats = tracker.getStatistics();

      expect(newStats.totalOccurrences).toBe(originalStats.totalOccurrences);
      expect(newStats.pendingOccurrences).toBe(originalStats.pendingOccurrences);
      expect(newStats.verifiedOccurrences).toBe(originalStats.verifiedOccurrences);

      // Verify effectiveness metrics match
      const originalMetrics = tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);
      const newMetrics = newTracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);

      expect(newMetrics.accuracy).toBeCloseTo(originalMetrics.accuracy, 2);
      expect(newMetrics.lift).toBeCloseTo(originalMetrics.lift, 2);
    });

    it("should handle JSON serialization round-trip", () => {
      tracker.logSignal({
        signalType: TrackedSignalType.COORDINATED_CLUSTER,
        marketId: "test_market",
        predictedDirection: SignalPrediction.NO,
        strength: 0.8,
        confidence: 0.9,
        metadata: { key: "value", nested: { data: true } },
      });

      // Simulate storage (JSON stringify/parse)
      const exported = tracker.exportData();
      const json = JSON.stringify(exported);
      const parsed = JSON.parse(json);

      // Import from parsed JSON
      const newTracker = createSignalEffectivenessTracker();
      newTracker.importData(parsed);

      // Verify data integrity
      const signals = newTracker.getOccurrencesByType(TrackedSignalType.COORDINATED_CLUSTER);
      expect(signals.length).toBe(1);
      expect(signals[0]?.timestamp).toBeInstanceOf(Date);
      expect(signals[0]?.metadata).toEqual({ key: "value", nested: { data: true } });
    });
  });

  // ==========================================================================
  // Edge Cases E2E
  // ==========================================================================

  describe("Edge Cases E2E", () => {
    it("should handle empty data gracefully", () => {
      const metrics = tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);

      expect(metrics.totalOccurrences).toBe(0);
      expect(metrics.accuracy).toBe(0);
      expect(metrics.tier).toBe(EffectivenessTier.INSUFFICIENT_DATA);
    });

    it("should handle signals with NEUTRAL predictions", () => {
      // NEUTRAL signals don't predict direction but indicate activity
      for (let i = 0; i < 20; i++) {
        const signal = tracker.logSignal({
          signalType: TrackedSignalType.VOLUME_SPIKE,
          marketId: `market_${i}`,
          predictedDirection: SignalPrediction.NEUTRAL,
          strength: 0.6,
          confidence: 0.5,
        });

        // Even with NEUTRAL, record outcome
        tracker.recordOutcome(signal.occurrenceId, i % 2 === 0 ? "YES" : "NO");
      }

      // NEUTRAL signals should all be marked as "correct" (they don't claim direction)
      const signals = tracker.getOccurrencesByType(TrackedSignalType.VOLUME_SPIKE);
      expect(signals.every((s) => s.wasCorrect)).toBe(true);
    });

    it("should handle very high and very low accuracy scenarios", () => {
      // Near-perfect accuracy and near-zero accuracy signals
      const highAccuracySignals = createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 100, 0.95);
      const lowAccuracySignals = createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 100, 0.10);

      tracker.importData({
        occurrences: [...highAccuracySignals, ...lowAccuracySignals],
      });

      const highMetrics = tracker.calculateEffectiveness(TrackedSignalType.INSIDER_TRADE);
      const lowMetrics = tracker.calculateEffectiveness(TrackedSignalType.FRESH_WALLET);

      expect(highMetrics.accuracy).toBeGreaterThan(0.85);
      expect(highMetrics.tier).toBe(EffectivenessTier.EXCEPTIONAL);

      expect(lowMetrics.accuracy).toBeLessThan(0.2);
      expect(lowMetrics.tier).toBe(EffectivenessTier.POOR);
    });

    it("should handle concurrent signal logging and outcome recording", () => {
      const promises = [];

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        const promise = new Promise<void>((resolve) => {
          const signal = tracker.logSignal({
            signalType: TrackedSignalType.WHALE_TRADE,
            marketId: `concurrent_${i}`,
            predictedDirection: SignalPrediction.YES,
            strength: Math.random(),
            confidence: Math.random(),
          });

          // Immediately record outcome
          setTimeout(() => {
            tracker.recordOutcome(signal.occurrenceId, Math.random() > 0.5 ? "YES" : "NO");
            resolve();
          }, Math.random() * 10);
        });
        promises.push(promise);
      }

      return Promise.all(promises).then(() => {
        const stats = tracker.getStatistics();
        expect(stats.totalOccurrences).toBe(100);
        expect(stats.verifiedOccurrences).toBe(100);
        expect(stats.pendingOccurrences).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Integration with Real Scenarios E2E
  // ==========================================================================

  describe("Real-world Integration Scenarios", () => {
    it("should support decision making based on signal rankings", () => {
      // Simulate production data with clear hierarchy - all in one import
      const allSignals = [
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 100, 0.82),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.COORDINATED_CLUSTER, 100, 0.72),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.PRE_EVENT_TIMING, 100, 0.68),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.WHALE_TRADE, 100, 0.62),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.VOLUME_SPIKE, 100, 0.56),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 100, 0.48),
      ];

      tracker.importData({ occurrences: allSignals });

      // Get top signals for trading strategy
      const topSignals = tracker.getTopSignals(3);

      expect(topSignals.length).toBe(3);
      // Top signals should be from our high accuracy types
      expect(topSignals[0]!.accuracy).toBeGreaterThan(0.7);

      // Get signals above medium tier for risk-adjusted strategy
      const reliableSignals = tracker.getSignalsAboveTier(EffectivenessTier.MEDIUM);

      // Only signals with accuracy > 0.55 should be included
      expect(reliableSignals.length).toBeGreaterThanOrEqual(4);
    });

    it("should provide actionable category-specific insights", () => {
      // Different effectiveness by market category with clearer differences
      // Import all together
      const allCategorySignals = [
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 50, 0.85).map((o) => ({
          ...o,
          marketCategory: "POLITICS",
        })),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.INSIDER_TRADE, 50, 0.50).map((o) => ({
          ...o,
          marketCategory: "CRYPTO",
        })),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 50, 0.40).map((o) => ({
          ...o,
          marketCategory: "POLITICS",
        })),
        ...createMockOccurrencesWithAccuracy(TrackedSignalType.FRESH_WALLET, 50, 0.75).map((o) => ({
          ...o,
          marketCategory: "CRYPTO",
        })),
      ];

      tracker.importData({ occurrences: allCategorySignals });

      // Analyze by category
      const insiderByCategory = tracker.calculateEffectivenessByCategory(
        TrackedSignalType.INSIDER_TRADE
      );
      const freshByCategory = tracker.calculateEffectivenessByCategory(
        TrackedSignalType.FRESH_WALLET
      );

      // Insider trades - find politics category
      const insiderPolitics = insiderByCategory.find((c) => c.category === "POLITICS");
      const insiderCrypto = insiderByCategory.find((c) => c.category === "CRYPTO");

      // Both should exist
      expect(insiderPolitics).toBeDefined();
      expect(insiderCrypto).toBeDefined();

      // Politics should have higher accuracy than crypto for insider trades
      expect(insiderPolitics!.accuracy).toBeGreaterThan(insiderCrypto!.accuracy);

      // Fresh wallets - crypto should be better
      const freshCrypto = freshByCategory.find((c) => c.category === "CRYPTO");
      const freshPolitics = freshByCategory.find((c) => c.category === "POLITICS");

      // Both should exist
      expect(freshCrypto).toBeDefined();
      expect(freshPolitics).toBeDefined();

      // Crypto should have higher accuracy than politics for fresh wallets
      expect(freshCrypto!.accuracy).toBeGreaterThan(freshPolitics!.accuracy);
    });
  });
});
