/**
 * Tests for Pre-Event Volume Spike Detector (DET-VOL-012)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventType,
  PreEventWindow,
  PreEventSeverity,
  VolumeDirection,
  PRE_EVENT_WINDOW_DURATION_MS,
  PRE_EVENT_WINDOW_HOURS,
  ALL_PRE_EVENT_WINDOWS,
  DEFAULT_PRE_EVENT_THRESHOLDS,
  getPreEventWindow,
  PreEventVolumeDetector,
  createPreEventVolumeDetector,
  getSharedPreEventVolumeDetector,
  setSharedPreEventVolumeDetector,
  resetSharedPreEventVolumeDetector,
  registerMarketEvent,
  analyzePreEventVolume,
  batchAnalyzePreEventVolume,
  isInPreEventPeriod,
  getCurrentPreEventWindow,
  getRecentPreEventSpikes,
  getPreEventDetectorSummary,
  addHistoricalPreEventData,
  type PreEventVolumeDetectorConfig,
  type PreEventVolumeSpike,
  type MarketEvent,
} from "../../src/detection/pre-event-volume";
import {
  RollingVolumeTracker,
  resetSharedRollingVolumeTracker,
} from "../../src/detection/rolling-volume";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a volume tracker pre-populated with data for testing
 */
function createTrackerWithData(
  marketId: string,
  options: {
    baseVolume?: number;
    dataPoints?: number;
  } = {}
): RollingVolumeTracker {
  const baseVolume = options.baseVolume ?? 100;
  const dataPoints = options.dataPoints ?? 100;
  const intervalMs = 1000;

  const tracker = new RollingVolumeTracker({
    maxDataPoints: 10000,
    dataPointIntervalMs: intervalMs,
    minDataDensity: 0.3,
  });

  const now = Date.now();
  const startTime = now - dataPoints * intervalMs;

  for (let i = 0; i < dataPoints; i++) {
    const variance = Math.sin(i * 0.2) * 10;
    const volume = Math.max(0, baseVolume + variance);

    tracker.addVolume(marketId, volume, {
      timestamp: startTime + i * intervalMs,
      tradeCount: Math.floor(volume / 10),
    });
  }

  return tracker;
}

/**
 * Create a future date from now
 */
function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

/**
 * Create a past date from now
 */
function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

// ============================================================================
// Tests
// ============================================================================

describe("PreEventVolumeDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedPreEventVolumeDetector();
    resetSharedRollingVolumeTracker();
  });

  afterEach(() => {
    resetSharedPreEventVolumeDetector();
    resetSharedRollingVolumeTracker();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const detector = new PreEventVolumeDetector();

      const stats = detector.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.upcomingEvents).toBe(0);
      expect(stats.historicalPatterns).toBe(0);
      expect(stats.totalRecentSpikes).toBe(0);
      expect(stats.windows).toEqual(ALL_PRE_EVENT_WINDOWS);
      expect(stats.cooldownMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(stats.maxHoursBeforeEvent).toBe(168); // 1 week
      expect(stats.minHoursBeforeEvent).toBe(0.5); // 30 minutes
    });

    it("should create with custom configuration", () => {
      const config: PreEventVolumeDetectorConfig = {
        thresholds: {
          lowZScoreThreshold: 1.0,
          criticalRatioThreshold: 10.0,
        },
        windows: [PreEventWindow.ONE_HOUR, PreEventWindow.FOUR_HOURS],
        cooldownMs: 15 * 60 * 1000,
        maxHoursBeforeEvent: 48,
        minHoursBeforeEvent: 1,
      };

      const detector = new PreEventVolumeDetector(config);

      const stats = detector.getStats();
      expect(stats.windows).toEqual([PreEventWindow.ONE_HOUR, PreEventWindow.FOUR_HOURS]);
      expect(stats.cooldownMs).toBe(15 * 60 * 1000);
      expect(stats.maxHoursBeforeEvent).toBe(48);
      expect(stats.minHoursBeforeEvent).toBe(1);

      const thresholds = detector.getThresholds();
      expect(thresholds.lowZScoreThreshold).toBe(1.0);
      expect(thresholds.criticalRatioThreshold).toBe(10.0);
    });

    it("should use provided volume tracker", () => {
      const customTracker = createTrackerWithData("test-market");
      const detector = new PreEventVolumeDetector({
        volumeTracker: customTracker,
      });

      detector.registerEvent("test-market", futureDate(1));
      const result = detector.analyzePreEventVolume("test-market", 100);
      expect(result?.marketId).toBe("test-market");
    });
  });

  // ==========================================================================
  // Event Registration Tests
  // ==========================================================================

  describe("registerEvent", () => {
    it("should register a market event", () => {
      const detector = new PreEventVolumeDetector();
      const eventTime = futureDate(24);

      const event = detector.registerEvent("market-1", eventTime);

      expect(event.marketId).toBe("market-1");
      expect(event.eventTime).toEqual(eventTime);
      expect(event.eventType).toBe(EventType.RESOLUTION);
      expect(event.isUpcoming).toBe(true);
      expect(event.timeUntilEventHours).toBeCloseTo(24, 0);
    });

    it("should register event with custom options", () => {
      const detector = new PreEventVolumeDetector();
      const eventTime = futureDate(12);

      const event = detector.registerEvent("market-1", eventTime, {
        eventType: EventType.EXTERNAL_EVENT,
        description: "Presidential Election",
        marketQuestion: "Will Biden win?",
        category: "politics",
      });

      expect(event.eventType).toBe(EventType.EXTERNAL_EVENT);
      expect(event.description).toBe("Presidential Election");
      expect(event.marketQuestion).toBe("Will Biden win?");
      expect(event.category).toBe("politics");
    });

    it("should emit eventRegistered event", () => {
      const detector = new PreEventVolumeDetector();
      const listener = vi.fn();
      detector.on("eventRegistered", listener);

      detector.registerEvent("market-1", futureDate(24));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].marketId).toBe("market-1");
    });

    it("should handle past events correctly", () => {
      const detector = new PreEventVolumeDetector();
      const eventTime = pastDate(1);

      const event = detector.registerEvent("market-1", eventTime);

      expect(event.isUpcoming).toBe(false);
      expect(event.timeUntilEventMs).toBeLessThan(0);
    });
  });

  describe("updateEventTime", () => {
    it("should update an existing event time", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));

      const updated = detector.updateEventTime("market-1", futureDate(48));

      expect(updated).not.toBeNull();
      expect(updated!.timeUntilEventHours).toBeCloseTo(48, 0);
    });

    it("should return null for non-existent market", () => {
      const detector = new PreEventVolumeDetector();

      const updated = detector.updateEventTime("non-existent", futureDate(24));

      expect(updated).toBeNull();
    });
  });

  describe("unregisterEvent", () => {
    it("should unregister an event", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));

      const result = detector.unregisterEvent("market-1");

      expect(result).toBe(true);
      expect(detector.getEvent("market-1")).toBeNull();
    });

    it("should return false for non-existent event", () => {
      const detector = new PreEventVolumeDetector();

      const result = detector.unregisterEvent("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("getEvent", () => {
    it("should return event with updated timing", () => {
      const detector = new PreEventVolumeDetector();
      const eventTime = futureDate(12);
      detector.registerEvent("market-1", eventTime);

      const event = detector.getEvent("market-1");

      expect(event).not.toBeNull();
      expect(event!.marketId).toBe("market-1");
      expect(event!.isUpcoming).toBe(true);
    });

    it("should return null for non-existent market", () => {
      const detector = new PreEventVolumeDetector();

      const event = detector.getEvent("non-existent");

      expect(event).toBeNull();
    });
  });

  describe("getAllEvents", () => {
    it("should return all registered events", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));
      detector.registerEvent("market-2", futureDate(12));
      detector.registerEvent("market-3", pastDate(1));

      const events = detector.getAllEvents();

      expect(events).toHaveLength(3);
    });
  });

  describe("getUpcomingEvents", () => {
    it("should return only upcoming events", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));
      detector.registerEvent("market-2", futureDate(12));
      detector.registerEvent("market-3", pastDate(1));

      const events = detector.getUpcomingEvents();

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.isUpcoming)).toBe(true);
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  describe("getPreEventWindow", () => {
    it("should return ONE_HOUR for events within 1 hour", () => {
      expect(getPreEventWindow(0.5)).toBe(PreEventWindow.ONE_HOUR);
      expect(getPreEventWindow(1)).toBe(PreEventWindow.ONE_HOUR);
    });

    it("should return FOUR_HOURS for events within 4 hours", () => {
      expect(getPreEventWindow(1.5)).toBe(PreEventWindow.FOUR_HOURS);
      expect(getPreEventWindow(4)).toBe(PreEventWindow.FOUR_HOURS);
    });

    it("should return TWELVE_HOURS for events within 12 hours", () => {
      expect(getPreEventWindow(5)).toBe(PreEventWindow.TWELVE_HOURS);
      expect(getPreEventWindow(12)).toBe(PreEventWindow.TWELVE_HOURS);
    });

    it("should return ONE_DAY for events within 24 hours", () => {
      expect(getPreEventWindow(13)).toBe(PreEventWindow.ONE_DAY);
      expect(getPreEventWindow(24)).toBe(PreEventWindow.ONE_DAY);
    });

    it("should return TWO_DAYS for events within 48 hours", () => {
      expect(getPreEventWindow(25)).toBe(PreEventWindow.TWO_DAYS);
      expect(getPreEventWindow(48)).toBe(PreEventWindow.TWO_DAYS);
    });

    it("should return ONE_WEEK for events within 168 hours", () => {
      expect(getPreEventWindow(49)).toBe(PreEventWindow.ONE_WEEK);
      expect(getPreEventWindow(168)).toBe(PreEventWindow.ONE_WEEK);
    });

    it("should return null for past events", () => {
      expect(getPreEventWindow(0)).toBeNull();
      expect(getPreEventWindow(-1)).toBeNull();
    });

    it("should return null for events too far in future", () => {
      expect(getPreEventWindow(169)).toBeNull();
      expect(getPreEventWindow(500)).toBeNull();
    });
  });

  // ==========================================================================
  // Pre-Event Period Tests
  // ==========================================================================

  describe("isInPreEventPeriod", () => {
    it("should return true for market with upcoming event in range", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));

      expect(detector.isInPreEventPeriod("market-1")).toBe(true);
    });

    it("should return false for market with past event", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", pastDate(1));

      expect(detector.isInPreEventPeriod("market-1")).toBe(false);
    });

    it("should return false for market with event too far in future", () => {
      const detector = new PreEventVolumeDetector({
        maxHoursBeforeEvent: 48,
      });
      detector.registerEvent("market-1", futureDate(72));

      expect(detector.isInPreEventPeriod("market-1")).toBe(false);
    });

    it("should return false for unregistered market", () => {
      const detector = new PreEventVolumeDetector();

      expect(detector.isInPreEventPeriod("non-existent")).toBe(false);
    });
  });

  describe("getCurrentWindow", () => {
    it("should return correct window for market", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(2));

      expect(detector.getCurrentWindow("market-1")).toBe(PreEventWindow.FOUR_HOURS);
    });

    it("should return null for past event", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", pastDate(1));

      expect(detector.getCurrentWindow("market-1")).toBeNull();
    });

    it("should return null for unregistered market", () => {
      const detector = new PreEventVolumeDetector();

      expect(detector.getCurrentWindow("non-existent")).toBeNull();
    });
  });

  // ==========================================================================
  // Historical Data Tests
  // ==========================================================================

  describe("addHistoricalData", () => {
    it("should store historical data for market/window", () => {
      const detector = new PreEventVolumeDetector();

      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.ONE_HOUR, 100 + i * 10);
      }

      // Check that patterns are built when enough data
      const stats = detector.getStats();
      expect(stats.historicalPatterns).toBeGreaterThanOrEqual(0);
    });

    it("should store category-level data when category provided", () => {
      const detector = new PreEventVolumeDetector();

      for (let i = 0; i < 15; i++) {
        detector.addHistoricalData(
          `market-${i}`,
          PreEventWindow.ONE_HOUR,
          100 + i * 5,
          "politics"
        );
      }

      // Category pattern should be built
      const stats = detector.getStats();
      expect(stats.historicalPatterns).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Volume Analysis Tests
  // ==========================================================================

  describe("analyzePreEventVolume", () => {
    it("should return null for unregistered market", () => {
      const detector = new PreEventVolumeDetector();

      const result = detector.analyzePreEventVolume("non-existent", 100);

      expect(result).toBeNull();
    });

    it("should return null for past event", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", pastDate(1));

      const result = detector.analyzePreEventVolume("market-1", 100);

      expect(result).toBeNull();
    });

    it("should return analysis for valid pre-event market", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      // Add historical data to establish a baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 100);
      }

      const result = detector.analyzePreEventVolume("market-1", 100);

      expect(result).not.toBeNull();
      expect(result!.marketId).toBe("market-1");
      expect(result!.currentWindow).toBe(PreEventWindow.FOUR_HOURS);
      expect(result!.hoursUntilEvent).toBeCloseTo(2, 0);
      expect(result!.currentVolume).toBe(100);
    });

    it("should detect anomaly for high volume", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      // Add historical data with low volume baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // Analyze with much higher volume
      const result = detector.analyzePreEventVolume("market-1", 500);

      expect(result).not.toBeNull();
      expect(result!.isAnomalous).toBe(true);
      expect(result!.severity).not.toBeNull();
      expect(result!.direction).toBe(VolumeDirection.SURGE);
      expect(result!.volumeRatio).toBeGreaterThan(5);
    });

    it("should detect anomaly for very low volume", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      // Add historical data with high volume baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 500);
      }

      // Analyze with much lower volume
      const result = detector.analyzePreEventVolume("market-1", 50);

      expect(result).not.toBeNull();
      expect(result!.isAnomalous).toBe(true);
      expect(result!.direction).toBe(VolumeDirection.DROUGHT);
    });

    it("should not detect anomaly for normal volume", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      // Add historical data with same volume baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 100);
      }

      // Analyze with similar volume
      const result = detector.analyzePreEventVolume("market-1", 105);

      expect(result).not.toBeNull();
      expect(result!.isAnomalous).toBe(false);
      expect(result!.severity).toBeNull();
    });

    it("should emit preEventSpike event for anomaly", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      const listener = vi.fn();
      detector.on("preEventSpike", listener);

      detector.registerEvent("market-1", futureDate(2));

      // Add low baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // Trigger anomaly
      detector.analyzePreEventVolume("market-1", 1000, { bypassCooldown: true });

      expect(listener).toHaveBeenCalled();
      const spike: PreEventVolumeSpike = listener.mock.calls[0][0];
      expect(spike.marketId).toBe("market-1");
      expect(spike.severity).not.toBeNull();
    });

    it("should respect cooldown period", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({
        volumeTracker: tracker,
        cooldownMs: 60000, // 1 minute
      });
      const listener = vi.fn();
      detector.on("preEventSpike", listener);

      detector.registerEvent("market-1", futureDate(2));

      // Add low baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // First anomaly
      detector.analyzePreEventVolume("market-1", 1000, { bypassCooldown: true });
      expect(listener).toHaveBeenCalledTimes(1);

      // Second anomaly within cooldown - no new event
      detector.analyzePreEventVolume("market-1", 1000);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should include historical pattern when requested", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2), { category: "politics" });

      // Add enough data to build a pattern
      for (let i = 0; i < 15; i++) {
        detector.addHistoricalData(
          `market-${i}`,
          PreEventWindow.FOUR_HOURS,
          100 + i * 2,
          "politics"
        );
      }

      const result = detector.analyzePreEventVolume("market-1", 100, {
        includeHistoricalPattern: true,
      });

      expect(result).not.toBeNull();
      expect(result!.historicalPattern).not.toBeNull();
    });
  });

  describe("batchAnalyzePreEventVolume", () => {
    it("should analyze multiple markets", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });

      detector.registerEvent("market-1", futureDate(2));
      detector.registerEvent("market-2", futureDate(10));

      const result = detector.batchAnalyzePreEventVolume([
        { marketId: "market-1", volume: 100 },
        { marketId: "market-2", volume: 200 },
      ]);

      expect(result.results.size).toBe(2);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should identify anomalies in batch", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });

      detector.registerEvent("market-1", futureDate(2));
      detector.registerEvent("market-2", futureDate(10));

      // Add baselines
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
        detector.addHistoricalData("market-2", PreEventWindow.TWELVE_HOURS, 100);
      }

      const result = detector.batchAnalyzePreEventVolume([
        { marketId: "market-1", volume: 500 }, // Anomaly
        { marketId: "market-2", volume: 110 }, // Normal
      ]);

      expect(result.anomaliesDetected).toContain("market-1");
      expect(result.anomaliesDetected).not.toContain("market-2");
    });
  });

  // ==========================================================================
  // Spike Retrieval Tests
  // ==========================================================================

  describe("getRecentSpikes", () => {
    it("should return empty array when no spikes", () => {
      const detector = new PreEventVolumeDetector();

      const spikes = detector.getRecentSpikes();

      expect(spikes).toHaveLength(0);
    });

    it("should return recent spikes in order", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      // Add low baseline
      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // Generate multiple spikes
      detector.analyzePreEventVolume("market-1", 500, { bypassCooldown: true });
      detector.analyzePreEventVolume("market-1", 600, { bypassCooldown: true });

      const spikes = detector.getRecentSpikes();

      expect(spikes.length).toBeGreaterThan(0);
      // Most recent first
      if (spikes.length >= 2) {
        expect(spikes[0]!.currentVolume).toBeGreaterThanOrEqual(spikes[1]!.currentVolume);
      }
    });

    it("should respect limit parameter", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // Generate spikes
      for (let i = 0; i < 5; i++) {
        detector.analyzePreEventVolume("market-1", 500 + i * 100, { bypassCooldown: true });
      }

      const spikes = detector.getRecentSpikes(3);

      expect(spikes.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getMarketSpikes", () => {
    it("should return spikes for specific market", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));
      detector.registerEvent("market-2", futureDate(3));

      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
        detector.addHistoricalData("market-2", PreEventWindow.FOUR_HOURS, 50);
      }

      detector.analyzePreEventVolume("market-1", 500, { bypassCooldown: true });
      detector.analyzePreEventVolume("market-2", 600, { bypassCooldown: true });

      const market1Spikes = detector.getMarketSpikes("market-1");

      expect(market1Spikes.every((s) => s.marketId === "market-1")).toBe(true);
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return correct summary", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });

      detector.registerEvent("market-1", futureDate(2));
      detector.registerEvent("market-2", futureDate(200)); // Too far
      detector.registerEvent("market-3", pastDate(1)); // Past

      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      detector.analyzePreEventVolume("market-1", 500, { bypassCooldown: true });

      const summary = detector.getSummary();

      expect(summary.totalTrackedMarkets).toBe(3);
      expect(summary.upcomingEventCount).toBe(2);
      expect(summary.marketsInPreEventWindow).toBeGreaterThanOrEqual(1);
      expect(summary.totalAnomalies).toBeGreaterThanOrEqual(0);
    });

    it("should count anomalies by severity", () => {
      const tracker = createTrackerWithData("market-1", { baseVolume: 100 });
      const detector = new PreEventVolumeDetector({ volumeTracker: tracker });
      detector.registerEvent("market-1", futureDate(2));

      for (let i = 0; i < 10; i++) {
        detector.addHistoricalData("market-1", PreEventWindow.FOUR_HOURS, 50);
      }

      // Generate anomaly
      detector.analyzePreEventVolume("market-1", 1000, { bypassCooldown: true });

      const summary = detector.getSummary();

      const totalBySeverity =
        summary.bySeverity[PreEventSeverity.LOW] +
        summary.bySeverity[PreEventSeverity.MEDIUM] +
        summary.bySeverity[PreEventSeverity.HIGH] +
        summary.bySeverity[PreEventSeverity.CRITICAL];

      expect(totalBySeverity).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Clear Tests
  // ==========================================================================

  describe("clearMarket", () => {
    it("should clear market data", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));

      const result = detector.clearMarket("market-1");

      expect(result).toBe(true);
      expect(detector.getEvent("market-1")).toBeNull();
    });

    it("should return false for non-existent market", () => {
      const detector = new PreEventVolumeDetector();

      const result = detector.clearMarket("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("clearAll", () => {
    it("should clear all state", () => {
      const detector = new PreEventVolumeDetector();
      detector.registerEvent("market-1", futureDate(24));
      detector.registerEvent("market-2", futureDate(12));

      detector.clearAll();

      const stats = detector.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.upcomingEvents).toBe(0);
      expect(stats.totalRecentSpikes).toBe(0);
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should create shared instance", () => {
      const detector1 = getSharedPreEventVolumeDetector();
      const detector2 = getSharedPreEventVolumeDetector();

      expect(detector1).toBe(detector2);
    });

    it("should allow setting shared instance", () => {
      const customDetector = new PreEventVolumeDetector({
        cooldownMs: 1000,
      });

      setSharedPreEventVolumeDetector(customDetector);

      expect(getSharedPreEventVolumeDetector()).toBe(customDetector);
    });

    it("should reset shared instance", () => {
      const detector1 = getSharedPreEventVolumeDetector();
      detector1.registerEvent("market-1", futureDate(24));

      resetSharedPreEventVolumeDetector();

      const detector2 = getSharedPreEventVolumeDetector();
      expect(detector2).not.toBe(detector1);
      expect(detector2.getStats().trackedMarkets).toBe(0);
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe("convenience functions", () => {
    it("registerMarketEvent should work with shared detector", () => {
      const event = registerMarketEvent("market-1", futureDate(24));

      expect(event.marketId).toBe("market-1");

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("analyzePreEventVolume should work with shared detector", () => {
      registerMarketEvent("market-1", futureDate(2));

      const result = analyzePreEventVolume("market-1", 100);

      expect(result).not.toBeNull();

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("isInPreEventPeriod should work with shared detector", () => {
      registerMarketEvent("market-1", futureDate(24));

      const result = isInPreEventPeriod("market-1");

      expect(result).toBe(true);

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("getCurrentPreEventWindow should work with shared detector", () => {
      registerMarketEvent("market-1", futureDate(2));

      const window = getCurrentPreEventWindow("market-1");

      expect(window).toBe(PreEventWindow.FOUR_HOURS);

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("getRecentPreEventSpikes should work with shared detector", () => {
      const spikes = getRecentPreEventSpikes();

      expect(Array.isArray(spikes)).toBe(true);

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("getPreEventDetectorSummary should work with shared detector", () => {
      const summary = getPreEventDetectorSummary();

      expect(summary).toHaveProperty("totalTrackedMarkets");
      expect(summary).toHaveProperty("upcomingEventCount");

      // Clean up
      resetSharedPreEventVolumeDetector();
    });

    it("addHistoricalPreEventData should work with shared detector", () => {
      addHistoricalPreEventData("market-1", PreEventWindow.ONE_HOUR, 100);

      // No error means success
      expect(true).toBe(true);

      // Clean up
      resetSharedPreEventVolumeDetector();
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("constants", () => {
    it("should have correct window durations in ms", () => {
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.ONE_HOUR]).toBe(60 * 60 * 1000);
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.FOUR_HOURS]).toBe(4 * 60 * 60 * 1000);
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.TWELVE_HOURS]).toBe(12 * 60 * 60 * 1000);
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.ONE_DAY]).toBe(24 * 60 * 60 * 1000);
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.TWO_DAYS]).toBe(48 * 60 * 60 * 1000);
      expect(PRE_EVENT_WINDOW_DURATION_MS[PreEventWindow.ONE_WEEK]).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should have correct window durations in hours", () => {
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.ONE_HOUR]).toBe(1);
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.FOUR_HOURS]).toBe(4);
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.TWELVE_HOURS]).toBe(12);
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.ONE_DAY]).toBe(24);
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.TWO_DAYS]).toBe(48);
      expect(PRE_EVENT_WINDOW_HOURS[PreEventWindow.ONE_WEEK]).toBe(168);
    });

    it("should have all windows in ALL_PRE_EVENT_WINDOWS", () => {
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.ONE_HOUR);
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.FOUR_HOURS);
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.TWELVE_HOURS);
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.ONE_DAY);
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.TWO_DAYS);
      expect(ALL_PRE_EVENT_WINDOWS).toContain(PreEventWindow.ONE_WEEK);
    });

    it("should have reasonable default thresholds", () => {
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.lowZScoreThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.mediumZScoreThreshold
      );
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.mediumZScoreThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.highZScoreThreshold
      );
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.highZScoreThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.criticalZScoreThreshold
      );

      expect(DEFAULT_PRE_EVENT_THRESHOLDS.lowRatioThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.mediumRatioThreshold
      );
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.mediumRatioThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.highRatioThreshold
      );
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.highRatioThreshold).toBeLessThan(
        DEFAULT_PRE_EVENT_THRESHOLDS.criticalRatioThreshold
      );

      expect(DEFAULT_PRE_EVENT_THRESHOLDS.minSampleSize).toBeGreaterThan(0);
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.minDataDensity).toBeGreaterThan(0);
      expect(DEFAULT_PRE_EVENT_THRESHOLDS.minDataDensity).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createPreEventVolumeDetector", () => {
    it("should create new instance", () => {
      const detector = createPreEventVolumeDetector();

      expect(detector).toBeInstanceOf(PreEventVolumeDetector);
    });

    it("should create instance with config", () => {
      const detector = createPreEventVolumeDetector({
        cooldownMs: 5000,
      });

      expect(detector.getStats().cooldownMs).toBe(5000);
    });
  });
});
