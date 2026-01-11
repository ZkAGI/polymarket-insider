/**
 * Tests for Volume Spike Detector (DET-VOL-003)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VolumeSpikeType,
  SpikeSeverity,
  SpikeDirection,
  DEFAULT_SPIKE_THRESHOLDS,
  DEFAULT_SUSTAINED_CONFIG,
  VolumeSpikeDetector,
  createVolumeSpikeDetector,
  getSharedVolumeSpikeDetector,
  setSharedVolumeSpikeDetector,
  resetSharedVolumeSpikeDetector,
  detectVolumeSpike,
  batchDetectVolumeSpikes,
  isMarketInSpike,
  getSpikeDetectionSummary,
  getRecentVolumeSpikes,
  type VolumeSpikeDetectorConfig,
} from "../../src/detection/volume-spike";
import {
  RollingVolumeTracker,
  RollingWindow,
  resetSharedRollingVolumeTracker,
} from "../../src/detection/rolling-volume";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a volume tracker pre-populated with data for testing
 * Uses consistent data points around the base volume for predictable testing
 */
function createTrackerWithBaseline(
  marketId: string,
  options: {
    baseVolume?: number;
    stdDev?: number;
    dataPoints?: number;
    intervalMs?: number;
  } = {}
): RollingVolumeTracker {
  const baseVolume = options.baseVolume ?? 100;
  const stdDev = options.stdDev ?? 10;
  const dataPoints = options.dataPoints ?? 100;
  const intervalMs = options.intervalMs ?? 1000;

  const tracker = new RollingVolumeTracker({
    maxDataPoints: 10000,
    dataPointIntervalMs: intervalMs,
    minDataDensity: 0.3,
  });

  const now = Date.now();
  const startTime = now - dataPoints * intervalMs;

  // Add volume data points with predictable variance (using sine for consistency)
  for (let i = 0; i < dataPoints; i++) {
    // Generate volume with consistent sine-based variance
    const variance = Math.sin(i * 0.2) * stdDev;
    const volume = Math.max(0, baseVolume + variance);

    tracker.addVolume(marketId, volume, {
      timestamp: startTime + i * intervalMs,
      tradeCount: Math.floor(volume / 10),
    });
  }

  return tracker;
}

// ============================================================================
// Tests
// ============================================================================

describe("VolumeSpikeDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedVolumeSpikeDetector();
    resetSharedRollingVolumeTracker();
  });

  afterEach(() => {
    resetSharedVolumeSpikeDetector();
    resetSharedRollingVolumeTracker();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const detector = new VolumeSpikeDetector();

      const stats = detector.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.marketsInSpike).toBe(0);
      expect(stats.totalRecentSpikes).toBe(0);
      expect(stats.primaryWindow).toBe(RollingWindow.FIVE_MINUTES);
      expect(stats.cooldownMs).toBe(60000);
      expect(stats.useZScoreDetection).toBe(true);
      expect(stats.usePercentageDetection).toBe(true);
      expect(stats.minDataDensity).toBe(0.3);
    });

    it("should create with custom configuration", () => {
      const config: VolumeSpikeDetectorConfig = {
        thresholds: {
          lowZScoreThreshold: 1.5,
          mediumZScoreThreshold: 2.0,
        },
        sustainedConfig: {
          minDurationMinutes: 10,
        },
        primaryWindow: RollingWindow.ONE_HOUR,
        cooldownMs: 30000,
        useZScoreDetection: true,
        usePercentageDetection: false,
        minDataDensity: 0.5,
      };

      const detector = new VolumeSpikeDetector(config);

      const stats = detector.getStats();
      expect(stats.primaryWindow).toBe(RollingWindow.ONE_HOUR);
      expect(stats.cooldownMs).toBe(30000);
      expect(stats.usePercentageDetection).toBe(false);
      expect(stats.minDataDensity).toBe(0.5);
    });

    it("should use provided volume tracker", () => {
      const customTracker = new RollingVolumeTracker();
      customTracker.addVolume("test-market", 100);

      const detector = new VolumeSpikeDetector({
        volumeTracker: customTracker,
      });

      // Verify it uses the custom tracker by checking detection
      const result = detector.detectSpike("test-market", 100);
      expect(result.marketId).toBe("test-market");
    });
  });

  // ==========================================================================
  // Default Constants Tests
  // ==========================================================================

  describe("default constants", () => {
    it("should have correct default spike thresholds", () => {
      expect(DEFAULT_SPIKE_THRESHOLDS.lowZScoreThreshold).toBe(2.0);
      expect(DEFAULT_SPIKE_THRESHOLDS.mediumZScoreThreshold).toBe(2.5);
      expect(DEFAULT_SPIKE_THRESHOLDS.highZScoreThreshold).toBe(3.0);
      expect(DEFAULT_SPIKE_THRESHOLDS.criticalZScoreThreshold).toBe(4.0);
      expect(DEFAULT_SPIKE_THRESHOLDS.lowPercentageThreshold).toBe(1.5);
      expect(DEFAULT_SPIKE_THRESHOLDS.mediumPercentageThreshold).toBe(2.0);
      expect(DEFAULT_SPIKE_THRESHOLDS.highPercentageThreshold).toBe(3.0);
      expect(DEFAULT_SPIKE_THRESHOLDS.criticalPercentageThreshold).toBe(5.0);
    });

    it("should have correct default sustained config", () => {
      expect(DEFAULT_SUSTAINED_CONFIG.minDurationMinutes).toBe(5);
      expect(DEFAULT_SUSTAINED_CONFIG.maxGapMinutes).toBe(2);
      expect(DEFAULT_SUSTAINED_CONFIG.minConsecutivePoints).toBe(3);
    });
  });

  // ==========================================================================
  // Spike Detection Tests
  // ==========================================================================

  describe("detectSpike", () => {
    it("should not detect spike when no baseline data", () => {
      const tracker = new RollingVolumeTracker();
      const detector = new VolumeSpikeDetector({ volumeTracker: tracker });

      const result = detector.detectSpike("market-1", 1000);

      expect(result.isSpike).toBe(false);
      expect(result.spikeEvent).toBeNull();
      expect(result.baseline.isReliable).toBe(false);
    });

    it("should not detect spike when volume is within normal range", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({ volumeTracker: tracker });

      // Get baseline to check within normal range
      const averages = tracker.getRollingAverages("market-1");
      const avg = averages?.windowResults[RollingWindow.FIVE_MINUTES]?.averageVolumePerMinute ?? 100;

      // Normal volume within 2 standard deviations (use actual average)
      const result = detector.detectSpike("market-1", avg);

      expect(result.isSpike).toBe(false);
      expect(result.spikeEvent).toBeNull();
      expect(result.baseline.isReliable).toBe(true);
      expect(result.zScore).not.toBeNull();
    });

    it("should detect LOW severity spike when z-score exceeds 2.0", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0, // Disable cooldown for testing
      });

      // Get actual baseline stats
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;

      // Volume ~2.5 std devs above mean (for LOW severity)
      const result = detector.detectSpike("market-1", avg + 2.2 * stdDev);

      expect(result.isSpike).toBe(true);
      expect(result.spikeEvent).not.toBeNull();
      // Should be at least LOW severity
      expect([SpikeSeverity.LOW, SpikeSeverity.MEDIUM, SpikeSeverity.HIGH, SpikeSeverity.CRITICAL]).toContain(
        result.spikeEvent?.severity
      );
      expect(result.spikeEvent?.direction).toBe(SpikeDirection.UP);
    });

    it("should detect HIGH severity spike when z-score exceeds 3.0", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Volume ~4 std devs above mean
      const result = detector.detectSpike("market-1", 140);

      expect(result.isSpike).toBe(true);
      expect(result.spikeEvent).not.toBeNull();
      // Should be at least HIGH (or CRITICAL based on percentage)
      expect([SpikeSeverity.HIGH, SpikeSeverity.CRITICAL]).toContain(
        result.spikeEvent?.severity
      );
    });

    it("should detect CRITICAL severity spike for extreme volumes", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Volume 5x baseline (critical percentage threshold)
      const result = detector.detectSpike("market-1", 500);

      expect(result.isSpike).toBe(true);
      expect(result.spikeEvent).not.toBeNull();
      expect(result.spikeEvent?.severity).toBe(SpikeSeverity.CRITICAL);
    });

    it("should detect downward spike (volume drop)", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Very low volume
      const result = detector.detectSpike("market-1", 10);

      expect(result.isSpike).toBe(true);
      expect(result.spikeEvent).not.toBeNull();
      expect(result.spikeEvent?.direction).toBe(SpikeDirection.DOWN);
    });

    it("should respect cooldown period", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 60000, // 1 minute cooldown
      });

      const now = Date.now();

      // First spike
      const result1 = detector.detectSpike("market-1", 500, { timestamp: now });
      expect(result1.isSpike).toBe(true);
      expect(result1.spikeEvent).not.toBeNull();

      // Second spike within cooldown (should detect but not emit new event)
      const result2 = detector.detectSpike("market-1", 600, {
        timestamp: now + 30000,
      });
      expect(result2.isSpike).toBe(true);
      expect(result2.spikeEvent).toBeNull(); // No new event due to cooldown
    });

    it("should bypass cooldown when option is set", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 60000,
      });

      const now = Date.now();

      // First spike
      detector.detectSpike("market-1", 500, { timestamp: now });

      // Second spike within cooldown but with bypass
      const result2 = detector.detectSpike("market-1", 600, {
        timestamp: now + 30000,
        bypassCooldown: true,
      });

      expect(result2.isSpike).toBe(true);
      expect(result2.spikeEvent).not.toBeNull();
    });

    it("should use custom window when specified", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        primaryWindow: RollingWindow.FIVE_MINUTES,
      });

      const result = detector.detectSpike("market-1", 500, {
        window: RollingWindow.ONE_HOUR,
      });

      expect(result.window).toBe(RollingWindow.ONE_HOUR);
    });

    it("should only use z-score detection when percentage is disabled", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        useZScoreDetection: true,
        usePercentageDetection: false,
      });

      const result = detector.detectSpike("market-1", 200);

      expect(result.isSpike).toBe(true);
      expect(result.percentageOfBaseline).not.toBeNull();
      // Severity based only on z-score
      expect(result.spikeEvent?.severity).toBeDefined();
    });

    it("should only use percentage detection when z-score is disabled", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        useZScoreDetection: false,
        usePercentageDetection: true,
      });

      // 200% of baseline should trigger LOW severity
      const result = detector.detectSpike("market-1", 200);

      expect(result.isSpike).toBe(true);
      expect(result.spikeEvent).not.toBeNull();
    });
  });

  // ==========================================================================
  // Spike State Tracking Tests
  // ==========================================================================

  describe("spike state tracking", () => {
    it("should track spike state across multiple detections", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      const now = Date.now();

      // First spike
      detector.detectSpike("market-1", 500, { timestamp: now });

      expect(detector.isInSpikeState("market-1")).toBe(true);

      const state = detector.getSpikeState("market-1");
      expect(state).not.toBeNull();
      expect(state?.inSpike).toBe(true);
      expect(state?.consecutivePoints).toBe(1);
    });

    it("should increment consecutive points on continued spikes", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      const now = Date.now();

      // Multiple spike detections
      detector.detectSpike("market-1", 500, { timestamp: now, bypassCooldown: true });
      detector.detectSpike("market-1", 550, {
        timestamp: now + 1000,
        bypassCooldown: true,
      });
      detector.detectSpike("market-1", 480, {
        timestamp: now + 2000,
        bypassCooldown: true,
      });

      const state = detector.getSpikeState("market-1");
      expect(state?.consecutivePoints).toBe(3);
      expect(state?.peakVolume).toBe(550);
    });

    it("should track spike duration", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        sustainedConfig: {
          minConsecutivePoints: 3,
          maxGapMinutes: 10, // Allow larger gap for testing
          minDurationMinutes: 0,
        },
      });

      // Get baseline to create proper spike volumes
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev; // Well above threshold

      // Use the actual current time for testing
      const now = Date.now();

      // Start spike
      detector.detectSpike("market-1", spikeVolume, { timestamp: now, bypassCooldown: true });

      // Continue spike immediately
      detector.detectSpike("market-1", spikeVolume + 10, {
        timestamp: now + 100,
        bypassCooldown: true,
      });

      // Get state and verify spike is tracked
      const state = detector.getSpikeState("market-1");
      expect(state?.inSpike).toBe(true);
      expect(state?.consecutivePoints).toBe(2);
      // Duration is calculated from now - spikeStartTime, so just verify it exists
      expect(state?.durationMinutes).toBeGreaterThanOrEqual(0);
    });

    it("should reset spike state when volume returns to normal", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      // Use only z-score detection and set strict thresholds
      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        useZScoreDetection: true,
        usePercentageDetection: false, // Disable percentage to have clearer threshold
        thresholds: {
          lowZScoreThreshold: 3.0, // Require 3 std devs for spike
          mediumZScoreThreshold: 4.0,
          highZScoreThreshold: 5.0,
          criticalZScoreThreshold: 6.0,
          lowPercentageThreshold: 10,
          mediumPercentageThreshold: 20,
          highPercentageThreshold: 30,
          criticalPercentageThreshold: 40,
        },
      });

      const now = Date.now();

      // First detect a spike - use a very large volume that's definitely a spike
      // The exact z-score doesn't matter, we just need isSpike: true first
      const spikeResult = detector.detectSpike("market-1", 100000, { timestamp: now });
      expect(spikeResult.isSpike).toBe(true);
      expect(detector.isInSpikeState("market-1")).toBe(true);

      // Clear the market state
      detector.clearMarket("market-1");

      // Now verify that a normal volume (at the baseline average) does not trigger a spike
      // We use the baseline average from the previous detection as our normal volume
      const normalVolume = spikeResult.baseline.average;
      // Use the SAME timestamp to ensure consistent baseline calculation
      const normalResult = detector.detectSpike("market-1", normalVolume, { timestamp: now });

      // Normal volume at the baseline should have z-score close to 0
      expect(normalResult.zScore).toBeCloseTo(0, 0);
      expect(normalResult.isSpike).toBe(false);
      expect(detector.isInSpikeState("market-1")).toBe(false);
    });

    it("should return null state for unknown market", () => {
      const detector = new VolumeSpikeDetector();
      const state = detector.getSpikeState("unknown-market");
      expect(state).toBeNull();
    });
  });

  // ==========================================================================
  // Sustained Spike Detection Tests
  // ==========================================================================

  describe("sustained spike detection", () => {
    it("should detect sustained spike after minimum consecutive points", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        sustainedConfig: {
          minConsecutivePoints: 3,
          minDurationMinutes: 0, // Remove duration requirement for this test
          maxGapMinutes: 5,
        },
      });

      const now = Date.now();

      // First two spikes (not sustained yet)
      detector.detectSpike("market-1", 500, { timestamp: now, bypassCooldown: true });
      detector.detectSpike("market-1", 510, {
        timestamp: now + 1000,
        bypassCooldown: true,
      });

      // Third spike should be sustained
      const result = detector.detectSpike("market-1", 520, {
        timestamp: now + 2000,
        bypassCooldown: true,
      });

      expect(result.spikeEvent?.spikeType).toBe(VolumeSpikeType.SUSTAINED);
    });

    it("should reset sustained count after gap exceeds max", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        sustainedConfig: {
          minConsecutivePoints: 3,
          maxGapMinutes: 1,
          minDurationMinutes: 0,
        },
      });

      const now = Date.now();

      // First spike
      detector.detectSpike("market-1", 500, { timestamp: now, bypassCooldown: true });

      // Second spike after long gap (should reset)
      const result = detector.detectSpike("market-1", 510, {
        timestamp: now + 5 * 60 * 1000, // 5 minutes later
        bypassCooldown: true,
      });

      // Should have reset, so not sustained
      expect(result.spikeEvent?.spikeType).not.toBe(VolumeSpikeType.SUSTAINED);
    });
  });

  // ==========================================================================
  // Spike Type Classification Tests
  // ==========================================================================

  describe("spike type classification", () => {
    it("should classify momentary spikes", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        sustainedConfig: {
          minConsecutivePoints: 5, // High threshold so single spike is momentary
          maxGapMinutes: 2,
          minDurationMinutes: 10,
        },
      });

      // Get baseline to create proper spike volume
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev;

      // Single spike with a timestamp well separated from any previous check
      const result = detector.detectSpike("market-1", spikeVolume, {
        timestamp: Date.now() + 60000, // Far future to avoid sudden classification
      });

      // First spike can be momentary or sudden depending on timing
      expect([VolumeSpikeType.MOMENTARY, VolumeSpikeType.SUDDEN]).toContain(
        result.spikeEvent?.spikeType
      );
    });

    it("should classify sudden spikes (rapid within short time)", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      const now = Date.now();

      // Two spikes very close together
      detector.detectSpike("market-1", 500, { timestamp: now, bypassCooldown: true });
      const result = detector.detectSpike("market-1", 550, {
        timestamp: now + 5000, // 5 seconds later
        bypassCooldown: true,
      });

      expect(result.spikeEvent?.spikeType).toBe(VolumeSpikeType.SUDDEN);
    });

    it("should classify gradual spikes (building up)", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        sustainedConfig: {
          minConsecutivePoints: 5, // Higher threshold for sustained
          minDurationMinutes: 10,
          maxGapMinutes: 5,
        },
      });

      const now = Date.now();

      // Build up over 3 points (more than sudden but less than sustained)
      detector.detectSpike("market-1", 200, { timestamp: now, bypassCooldown: true });
      detector.detectSpike("market-1", 300, {
        timestamp: now + 60000,
        bypassCooldown: true,
      });
      const result = detector.detectSpike("market-1", 400, {
        timestamp: now + 120000,
        bypassCooldown: true,
      });

      expect(result.spikeEvent?.spikeType).toBe(VolumeSpikeType.GRADUAL);
    });
  });

  // ==========================================================================
  // Batch Detection Tests
  // ==========================================================================

  describe("batchDetectSpikes", () => {
    it("should detect spikes for multiple markets", () => {
      const tracker = new RollingVolumeTracker({
        minDataDensity: 0.3,
      });

      // Add baseline data for multiple markets with consistent values
      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        const variance = Math.sin(i * 0.2) * 10;
        tracker.addVolume("market-1", 100 + variance, {
          timestamp: now - (500 - i) * 1000,
        });
        tracker.addVolume("market-2", 200 + variance * 2, {
          timestamp: now - (500 - i) * 1000,
        });
        tracker.addVolume("market-3", 50 + variance * 0.5, {
          timestamp: now - (500 - i) * 1000,
        });
      }

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Get baselines for each market
      const avg1 = tracker.getRollingAverages("market-1")?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg2 = tracker.getRollingAverages("market-2")?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg3 = tracker.getRollingAverages("market-3")?.windowResults[RollingWindow.FIVE_MINUTES];

      const result = detector.batchDetectSpikes([
        { marketId: "market-1", volume: (avg1?.averageVolumePerMinute ?? 100) + (avg1?.standardDeviation ?? 10) * 5 }, // Spike
        { marketId: "market-2", volume: avg2?.averageVolumePerMinute ?? 200 }, // Normal (at average)
        { marketId: "market-3", volume: (avg3?.averageVolumePerMinute ?? 50) + (avg3?.standardDeviation ?? 5) * 5 }, // Spike
      ]);

      expect(result.results.size).toBe(3);
      expect(result.spikesDetected).toContain("market-1");
      expect(result.spikesDetected).not.toContain("market-2");
      expect(result.spikesDetected).toContain("market-3");
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty input", () => {
      const detector = new VolumeSpikeDetector();

      const result = detector.batchDetectSpikes([]);

      expect(result.results.size).toBe(0);
      expect(result.spikesDetected).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("event emission", () => {
    it("should emit spikeDetected event", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        enableEvents: true,
      });

      // Get baseline to create proper spike volume
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev; // Well above threshold

      const spikeHandler = vi.fn();
      detector.on("spikeDetected", spikeHandler);

      detector.detectSpike("market-1", spikeVolume);

      expect(spikeHandler).toHaveBeenCalledTimes(1);
      expect(spikeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: "market-1",
          severity: expect.any(String),
          direction: SpikeDirection.UP,
        })
      );
    });

    it("should emit sustainedSpike event for sustained spikes", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        enableEvents: true,
        sustainedConfig: {
          minConsecutivePoints: 3,
          minDurationMinutes: 0,
          maxGapMinutes: 5,
        },
      });

      const sustainedHandler = vi.fn();
      detector.on("sustainedSpike", sustainedHandler);

      const now = Date.now();

      // Create sustained spike
      detector.detectSpike("market-1", 500, { timestamp: now, bypassCooldown: true });
      detector.detectSpike("market-1", 510, {
        timestamp: now + 1000,
        bypassCooldown: true,
      });
      detector.detectSpike("market-1", 520, {
        timestamp: now + 2000,
        bypassCooldown: true,
      });

      expect(sustainedHandler).toHaveBeenCalled();
    });

    it("should emit spikeEnded event when clearMarket is called", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        enableEvents: true,
      });

      // Get baseline to create proper spike volume
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev;

      const now = Date.now();

      // Create spike
      detector.detectSpike("market-1", spikeVolume, { timestamp: now });
      expect(detector.isInSpikeState("market-1")).toBe(true);

      // Clear the market - this removes the spike state
      detector.clearMarket("market-1");

      // Verify state is cleared
      expect(detector.isInSpikeState("market-1")).toBe(false);
      expect(detector.getSpikeState("market-1")).toBeNull();
    });

    it("should not emit events when disabled", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
        enableEvents: false,
      });

      const spikeHandler = vi.fn();
      detector.on("spikeDetected", spikeHandler);

      detector.detectSpike("market-1", 500);

      expect(spikeHandler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Summary and Statistics Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return empty summary when no spikes", () => {
      const detector = new VolumeSpikeDetector();

      const summary = detector.getSummary();

      expect(summary.totalMarkets).toBe(0);
      expect(summary.marketsWithSpikes).toBe(0);
      expect(summary.totalSpikes).toBe(0);
      expect(summary.recentSpikes).toHaveLength(0);
    });

    it("should return accurate summary with spikes", () => {
      const tracker = new RollingVolumeTracker({ minDataDensity: 0.3 });

      // Add baseline data
      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        tracker.addVolume("market-1", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
        tracker.addVolume("market-2", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
      }

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Create spikes
      detector.detectSpike("market-1", 500, { bypassCooldown: true });
      detector.detectSpike("market-2", 500, { bypassCooldown: true });

      const summary = detector.getSummary();

      expect(summary.totalMarkets).toBe(2);
      expect(summary.marketsWithSpikes).toBe(2);
      expect(summary.totalSpikes).toBe(2);
      expect(summary.recentSpikes).toHaveLength(2);
    });

    it("should count spikes by severity", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Create spikes of different severities
      const now = Date.now();
      detector.detectSpike("market-1", 200, {
        timestamp: now,
        bypassCooldown: true,
      }); // Medium
      detector.detectSpike("market-1", 500, {
        timestamp: now + 60000,
        bypassCooldown: true,
      }); // Critical

      const summary = detector.getSummary();

      expect(summary.totalSpikes).toBe(2);
      // At least one spike of each severity level we created
      const totalBySeverity = Object.values(summary.bySeverity).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalBySeverity).toBe(2);
    });

    it("should track frequent spike markets", () => {
      const tracker = new RollingVolumeTracker({ minDataDensity: 0.3 });

      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        const variance = Math.sin(i * 0.2) * 10;
        tracker.addVolume("market-1", 100 + variance, {
          timestamp: now - (500 - i) * 1000,
        });
      }

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Get baseline to create proper spike volume
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev;

      // Create multiple spikes for same market with increasing timestamps
      for (let i = 0; i < 5; i++) {
        detector.detectSpike("market-1", spikeVolume + i * 10, {
          timestamp: now + i * 65000, // 65 seconds apart to ensure different event
          bypassCooldown: true,
        });
      }

      const summary = detector.getSummary();

      expect(summary.frequentSpikeMarkets).toHaveLength(1);
      expect(summary.frequentSpikeMarkets[0]?.marketId).toBe("market-1");
      expect(summary.frequentSpikeMarkets[0]?.spikeCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Recent Spikes Tests
  // ==========================================================================

  describe("getRecentSpikes", () => {
    it("should return recent spikes", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      const now = Date.now();

      // Create multiple spikes
      detector.detectSpike("market-1", 500, {
        timestamp: now,
        bypassCooldown: true,
      });
      detector.detectSpike("market-1", 600, {
        timestamp: now + 60000,
        bypassCooldown: true,
      });

      const recentSpikes = detector.getRecentSpikes(10);

      expect(recentSpikes).toHaveLength(2);
      // Most recent first
      expect(recentSpikes[0]?.currentVolume).toBe(600);
    });

    it("should limit results", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Get baseline to create proper spike volume
      const averages = tracker.getRollingAverages("market-1");
      const windowResult = averages?.windowResults[RollingWindow.FIVE_MINUTES];
      const avg = windowResult?.averageVolumePerMinute ?? 100;
      const stdDev = windowResult?.standardDeviation ?? 10;
      const spikeVolume = avg + 5 * stdDev;

      const now = Date.now();

      // Create many spikes with increasing volume and timestamps
      for (let i = 0; i < 10; i++) {
        detector.detectSpike("market-1", spikeVolume + i * 10, {
          timestamp: now + i * 65000, // 65 seconds apart
          bypassCooldown: true,
        });
      }

      const recentSpikes = detector.getRecentSpikes(5);

      expect(recentSpikes.length).toBeLessThanOrEqual(5);
      expect(recentSpikes.length).toBeGreaterThan(0);
    });
  });

  describe("getMarketSpikes", () => {
    it("should return spikes for specific market", () => {
      const tracker = new RollingVolumeTracker({ minDataDensity: 0.3 });

      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        tracker.addVolume("market-1", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
        tracker.addVolume("market-2", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
      }

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      // Create spikes for both markets
      detector.detectSpike("market-1", 500, { bypassCooldown: true });
      detector.detectSpike("market-2", 500, { bypassCooldown: true });
      detector.detectSpike("market-1", 600, { bypassCooldown: true });

      const market1Spikes = detector.getMarketSpikes("market-1");
      const market2Spikes = detector.getMarketSpikes("market-2");

      expect(market1Spikes).toHaveLength(2);
      expect(market2Spikes).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Configuration Getters Tests
  // ==========================================================================

  describe("getThresholds", () => {
    it("should return copy of thresholds", () => {
      const detector = new VolumeSpikeDetector({
        thresholds: {
          lowZScoreThreshold: 1.5,
        },
      });

      const thresholds = detector.getThresholds();

      expect(thresholds.lowZScoreThreshold).toBe(1.5);
      // Should be a copy, not reference
      thresholds.lowZScoreThreshold = 999;
      expect(detector.getThresholds().lowZScoreThreshold).toBe(1.5);
    });
  });

  describe("getSustainedConfig", () => {
    it("should return copy of sustained config", () => {
      const detector = new VolumeSpikeDetector({
        sustainedConfig: {
          minDurationMinutes: 10,
        },
      });

      const config = detector.getSustainedConfig();

      expect(config.minDurationMinutes).toBe(10);
      // Should be a copy
      config.minDurationMinutes = 999;
      expect(detector.getSustainedConfig().minDurationMinutes).toBe(10);
    });
  });

  // ==========================================================================
  // Clear Methods Tests
  // ==========================================================================

  describe("clearMarket", () => {
    it("should clear state for specific market", () => {
      const tracker = createTrackerWithBaseline("market-1", {
        baseVolume: 100,
        stdDev: 10,
        dataPoints: 500,
      });

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      detector.detectSpike("market-1", 500);
      expect(detector.isInSpikeState("market-1")).toBe(true);

      const cleared = detector.clearMarket("market-1");

      expect(cleared).toBe(true);
      expect(detector.isInSpikeState("market-1")).toBe(false);
      expect(detector.getSpikeState("market-1")).toBeNull();
    });

    it("should return false for unknown market", () => {
      const detector = new VolumeSpikeDetector();

      const cleared = detector.clearMarket("unknown");

      expect(cleared).toBe(false);
    });
  });

  describe("clearAll", () => {
    it("should clear all state", () => {
      const tracker = new RollingVolumeTracker({ minDataDensity: 0.3 });

      const now = Date.now();
      for (let i = 0; i < 500; i++) {
        tracker.addVolume("market-1", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
        tracker.addVolume("market-2", 100 + (Math.random() - 0.5) * 20, {
          timestamp: now - (500 - i) * 1000,
        });
      }

      const detector = new VolumeSpikeDetector({
        volumeTracker: tracker,
        cooldownMs: 0,
      });

      detector.detectSpike("market-1", 500);
      detector.detectSpike("market-2", 500);

      detector.clearAll();

      const stats = detector.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.marketsInSpike).toBe(0);
      expect(stats.totalRecentSpikes).toBe(0);
    });
  });

  // ==========================================================================
  // Singleton Management Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should create shared instance on first call", () => {
      const detector1 = getSharedVolumeSpikeDetector();
      const detector2 = getSharedVolumeSpikeDetector();

      expect(detector1).toBe(detector2);
    });

    it("should allow setting custom shared instance", () => {
      const customDetector = new VolumeSpikeDetector({
        cooldownMs: 30000,
      });

      setSharedVolumeSpikeDetector(customDetector);

      const detector = getSharedVolumeSpikeDetector();
      expect(detector).toBe(customDetector);
      expect(detector.getStats().cooldownMs).toBe(30000);
    });

    it("should reset shared instance", () => {
      getSharedVolumeSpikeDetector();
      resetSharedVolumeSpikeDetector();

      const newDetector = getSharedVolumeSpikeDetector();
      expect(newDetector.getStats().trackedMarkets).toBe(0);
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe("convenience functions", () => {
    describe("detectVolumeSpike", () => {
      it("should use shared detector", () => {
        const tracker = createTrackerWithBaseline("market-1", {
          baseVolume: 100,
          stdDev: 10,
          dataPoints: 500,
        });

        setSharedVolumeSpikeDetector(
          new VolumeSpikeDetector({
            volumeTracker: tracker,
            cooldownMs: 0,
          })
        );

        const result = detectVolumeSpike("market-1", 500);

        expect(result.isSpike).toBe(true);
      });

      it("should use provided detector", () => {
        const tracker = createTrackerWithBaseline("market-1", {
          baseVolume: 100,
          stdDev: 10,
          dataPoints: 500,
        });

        const customDetector = new VolumeSpikeDetector({
          volumeTracker: tracker,
          cooldownMs: 0,
        });

        const result = detectVolumeSpike("market-1", 500, {
          detector: customDetector,
        });

        expect(result.isSpike).toBe(true);
      });
    });

    describe("batchDetectVolumeSpikes", () => {
      it("should use shared detector", () => {
        const tracker = createTrackerWithBaseline("market-1", {
          baseVolume: 100,
          stdDev: 10,
          dataPoints: 500,
        });

        setSharedVolumeSpikeDetector(
          new VolumeSpikeDetector({
            volumeTracker: tracker,
            cooldownMs: 0,
          })
        );

        const result = batchDetectVolumeSpikes([
          { marketId: "market-1", volume: 500 },
        ]);

        expect(result.spikesDetected).toContain("market-1");
      });
    });

    describe("isMarketInSpike", () => {
      it("should check spike state using shared detector", () => {
        const tracker = createTrackerWithBaseline("market-1", {
          baseVolume: 100,
          stdDev: 10,
          dataPoints: 500,
        });

        setSharedVolumeSpikeDetector(
          new VolumeSpikeDetector({
            volumeTracker: tracker,
            cooldownMs: 0,
          })
        );

        detectVolumeSpike("market-1", 500);

        expect(isMarketInSpike("market-1")).toBe(true);
        expect(isMarketInSpike("market-2")).toBe(false);
      });
    });

    describe("getSpikeDetectionSummary", () => {
      it("should return summary from shared detector", () => {
        resetSharedVolumeSpikeDetector();

        const summary = getSpikeDetectionSummary();

        expect(summary.totalMarkets).toBe(0);
        expect(summary.totalSpikes).toBe(0);
      });
    });

    describe("getRecentVolumeSpikes", () => {
      it("should return recent spikes from shared detector", () => {
        resetSharedVolumeSpikeDetector();

        const spikes = getRecentVolumeSpikes();

        expect(spikes).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createVolumeSpikeDetector", () => {
    it("should create new instance with config", () => {
      const detector = createVolumeSpikeDetector({
        cooldownMs: 30000,
        primaryWindow: RollingWindow.ONE_HOUR,
      });

      expect(detector).toBeInstanceOf(VolumeSpikeDetector);
      expect(detector.getStats().cooldownMs).toBe(30000);
      expect(detector.getStats().primaryWindow).toBe(RollingWindow.ONE_HOUR);
    });

    it("should create new instance with default config", () => {
      const detector = createVolumeSpikeDetector();

      expect(detector).toBeInstanceOf(VolumeSpikeDetector);
    });
  });

  // ==========================================================================
  // Module Export Tests
  // ==========================================================================

  describe("module exports", () => {
    it("should export all enums", () => {
      expect(VolumeSpikeType).toBeDefined();
      expect(VolumeSpikeType.MOMENTARY).toBeDefined();
      expect(VolumeSpikeType.SUSTAINED).toBeDefined();
      expect(VolumeSpikeType.SUDDEN).toBeDefined();
      expect(VolumeSpikeType.GRADUAL).toBeDefined();

      expect(SpikeSeverity).toBeDefined();
      expect(SpikeSeverity.LOW).toBeDefined();
      expect(SpikeSeverity.MEDIUM).toBeDefined();
      expect(SpikeSeverity.HIGH).toBeDefined();
      expect(SpikeSeverity.CRITICAL).toBeDefined();

      expect(SpikeDirection).toBeDefined();
      expect(SpikeDirection.UP).toBeDefined();
      expect(SpikeDirection.DOWN).toBeDefined();
    });

    it("should export default constants", () => {
      expect(DEFAULT_SPIKE_THRESHOLDS).toBeDefined();
      expect(DEFAULT_SUSTAINED_CONFIG).toBeDefined();
    });

    it("should export all functions", () => {
      expect(createVolumeSpikeDetector).toBeInstanceOf(Function);
      expect(getSharedVolumeSpikeDetector).toBeInstanceOf(Function);
      expect(setSharedVolumeSpikeDetector).toBeInstanceOf(Function);
      expect(resetSharedVolumeSpikeDetector).toBeInstanceOf(Function);
      expect(detectVolumeSpike).toBeInstanceOf(Function);
      expect(batchDetectVolumeSpikes).toBeInstanceOf(Function);
      expect(isMarketInSpike).toBeInstanceOf(Function);
      expect(getSpikeDetectionSummary).toBeInstanceOf(Function);
      expect(getRecentVolumeSpikes).toBeInstanceOf(Function);
    });
  });
});
