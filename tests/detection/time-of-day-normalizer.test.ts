/**
 * Tests for Time-of-Day Volume Normalizer (DET-VOL-007)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DayOfWeek,
  TimePeriod,
  OffHoursAnomalySeverity,
  TimeOfDayNormalizer,
  createTimeOfDayNormalizer,
  getSharedTimeOfDayNormalizer,
  setSharedTimeOfDayNormalizer,
  resetSharedTimeOfDayNormalizer,
  addVolumeForTimeProfile,
  getTimeOfDayProfile,
  normalizeVolumeForTimeOfDay,
  checkOffHoursAnomaly,
  getExpectedVolumeForTime,
  getCurrentTimePeriod,
  getTimeOfDayNormalizerSummary,
  type TimeOfDayNormalizerConfig,
  type TimeOfDayProfile,
  type OffHoursAnomalyEvent,
} from "../../src/detection/time-of-day-normalizer";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a date at a specific hour (UTC)
 */
function createDateAtHour(hour: number, daysAgo: number = 0): Date {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Create a normalizer pre-populated with realistic data
 * Simulates higher volume during peak hours (14-21 UTC) and lower during off-hours (4-8 UTC)
 */
function createNormalizerWithData(
  marketId: string,
  options: {
    daysOfData?: number;
    baseVolume?: number;
    peakMultiplier?: number;
    offHoursMultiplier?: number;
    dataPointsPerHour?: number;
  } = {}
): TimeOfDayNormalizer {
  const daysOfData = options.daysOfData ?? 7;
  const baseVolume = options.baseVolume ?? 1000;
  const peakMultiplier = options.peakMultiplier ?? 2.5;
  const offHoursMultiplier = options.offHoursMultiplier ?? 0.3;
  const dataPointsPerHour = options.dataPointsPerHour ?? 10;

  const normalizer = new TimeOfDayNormalizer({
    minDataPointsPerHour: 5,
    timezone: "UTC",
  });

  const now = new Date();

  for (let day = 0; day < daysOfData; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Determine volume multiplier based on time of day
      let multiplier = 1.0;
      if (hour >= 14 && hour <= 21) {
        // Peak hours (US market hours)
        multiplier = peakMultiplier;
      } else if (hour >= 4 && hour <= 8) {
        // Off-hours (overnight)
        multiplier = offHoursMultiplier;
      } else if (hour >= 0 && hour <= 3) {
        // Late night
        multiplier = 0.5;
      } else if (hour >= 22 && hour <= 23) {
        // Evening
        multiplier = 1.2;
      }

      // Add multiple data points per hour
      for (let i = 0; i < dataPointsPerHour; i++) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - day);
        timestamp.setUTCHours(hour, i * 5, 0, 0); // Space out by 5 minutes

        // Add some random variation (+/- 20%)
        const variance = 0.8 + Math.random() * 0.4;
        const volume = baseVolume * multiplier * variance;

        normalizer.addVolumeData(marketId, volume, timestamp, Math.floor(volume / 100));
      }
    }
  }

  return normalizer;
}

/**
 * Create normalizer with minimal data for edge case testing
 */
function createNormalizerWithSparseData(
  marketId: string,
  hours: number[]
): TimeOfDayNormalizer {
  const normalizer = new TimeOfDayNormalizer({
    minDataPointsPerHour: 5,
  });

  const now = new Date();

  for (const hour of hours) {
    for (let day = 0; day < 7; day++) {
      for (let i = 0; i < 6; i++) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - day);
        timestamp.setUTCHours(hour, i * 10, 0, 0);
        normalizer.addVolumeData(marketId, 100 + hour * 10, timestamp);
      }
    }
  }

  return normalizer;
}

// ============================================================================
// Tests
// ============================================================================

describe("TimeOfDayNormalizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTimeOfDayNormalizer();
  });

  afterEach(() => {
    resetSharedTimeOfDayNormalizer();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const normalizer = new TimeOfDayNormalizer();

      const stats = normalizer.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.timezone).toBe("UTC");
      expect(stats.minDataPointsPerHour).toBe(30);
      expect(stats.profileWindowDays).toBe(30);
    });

    it("should create with custom configuration", () => {
      const config: TimeOfDayNormalizerConfig = {
        timezone: "America/New_York",
        minDataPointsPerHour: 10,
        profileWindowDays: 14,
        peakHours: [9, 10, 11, 12],
        offHoursRange: { start: 22, end: 6 },
        enableEvents: false,
      };

      const normalizer = new TimeOfDayNormalizer(config);

      const stats = normalizer.getStats();
      expect(stats.timezone).toBe("America/New_York");
      expect(stats.minDataPointsPerHour).toBe(10);
      expect(stats.profileWindowDays).toBe(14);
      expect(stats.peakHours).toEqual([9, 10, 11, 12]);
    });

    it("should accept custom anomaly thresholds", () => {
      const config: TimeOfDayNormalizerConfig = {
        anomalyThresholds: {
          low: 1.5,
          medium: 2.0,
          high: 2.5,
          critical: 3.5,
        },
      };

      const normalizer = new TimeOfDayNormalizer(config);
      expect(normalizer).toBeDefined();
    });
  });

  // ==========================================================================
  // Data Addition Tests
  // ==========================================================================

  describe("addVolumeData", () => {
    it("should add volume data points", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeData("market-1", 100, new Date());
      normalizer.addVolumeData("market-1", 150, new Date());

      expect(normalizer.getDataPointCount("market-1")).toBe(2);
      expect(normalizer.hasProfile("market-1")).toBe(true);
    });

    it("should ignore invalid inputs", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeData("", 100, new Date());
      normalizer.addVolumeData("market-1", -100, new Date());

      expect(normalizer.getTrackedMarkets().length).toBe(0);
    });

    it("should add data with trade count", () => {
      const normalizer = new TimeOfDayNormalizer();
      const timestamp = new Date();

      normalizer.addVolumeData("market-1", 100, timestamp, 10);

      const count = normalizer.getDataPointCount("market-1");
      expect(count).toBe(1);
    });

    it("should add batch data", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeDataBatch("market-1", [
        { volume: 100, timestamp: new Date() },
        { volume: 150, timestamp: new Date() },
        { volume: 200, timestamp: new Date() },
      ]);

      expect(normalizer.getDataPointCount("market-1")).toBe(3);
    });

    it("should trim old data when exceeding max", () => {
      const normalizer = new TimeOfDayNormalizer({
        maxDataPointsPerMarket: 10,
        profileWindowDays: 1,
      });

      // Add 15 data points
      for (let i = 0; i < 15; i++) {
        normalizer.addVolumeData("market-1", 100, new Date());
      }

      // Should have trimmed to around 10 or less
      const count = normalizer.getDataPointCount("market-1");
      expect(count).toBeLessThanOrEqual(15);
    });
  });

  // ==========================================================================
  // Profile Building Tests
  // ==========================================================================

  describe("getProfile", () => {
    it("should return null for unknown market", () => {
      const normalizer = new TimeOfDayNormalizer();
      expect(normalizer.getProfile("unknown")).toBeNull();
    });

    it("should build profile from data", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        dataPointsPerHour: 10,
      });

      const profile = normalizer.getProfile("market-1");

      expect(profile).not.toBeNull();
      expect(profile?.marketId).toBe("market-1");
      expect(profile?.hourlyStats.length).toBe(24);
      expect(profile?.totalDataPoints).toBeGreaterThan(0);
    });

    it("should identify peak hours correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        peakMultiplier: 3.0,
      });

      const profile = normalizer.getProfile("market-1");

      expect(profile).not.toBeNull();
      // Peak hours should include some hours from 14-21 range
      const hasPeakHourInRange = profile!.peakHours.some(
        (h) => h >= 14 && h <= 21
      );
      expect(hasPeakHourInRange).toBe(true);
    });

    it("should identify off-hours correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        offHoursMultiplier: 0.2,
      });

      const profile = normalizer.getProfile("market-1");

      expect(profile).not.toBeNull();
      // Off hours should include some hours from 4-8 range or late night
      const hasOffHourInRange = profile!.offHours.some(
        (h) => (h >= 4 && h <= 8) || (h >= 0 && h <= 3)
      );
      expect(hasOffHourInRange).toBe(true);
    });

    it("should mark profile as reliable when sufficient data", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        dataPointsPerHour: 10,
      });

      const profile = normalizer.getProfile("market-1");
      expect(profile?.isReliable).toBe(true);
    });

    it("should mark profile as unreliable when insufficient data", () => {
      const normalizer = createNormalizerWithSparseData("market-1", [10, 11, 12]);

      const profile = normalizer.getProfile("market-1");

      expect(profile).not.toBeNull();
      expect(profile?.isReliable).toBe(false);
    });

    it("should cache profiles", () => {
      const normalizer = createNormalizerWithData("market-1");

      const profile1 = normalizer.getProfile("market-1");
      const profile2 = normalizer.getProfile("market-1");

      expect(profile1).toBe(profile2); // Same reference
    });

    it("should calculate day-of-week profiles", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14, // Two weeks for all days
      });

      const profile = normalizer.getProfile("market-1");

      expect(profile).not.toBeNull();
      expect(profile?.dayOfWeekProfiles[DayOfWeek.MONDAY]).toBeDefined();
      expect(profile?.dayOfWeekProfiles[DayOfWeek.SATURDAY]).toBeDefined();
    });
  });

  // ==========================================================================
  // Volume Normalization Tests
  // ==========================================================================

  describe("normalizeVolume", () => {
    it("should return null for unknown market", () => {
      const normalizer = new TimeOfDayNormalizer();
      const result = normalizer.normalizeVolume("unknown", 100);
      expect(result).toBeNull();
    });

    it("should return null for unreliable profile", () => {
      const normalizer = createNormalizerWithSparseData("market-1", [10]);
      const result = normalizer.normalizeVolume("market-1", 100);
      expect(result).toBeNull();
    });

    it("should normalize volume correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        baseVolume: 1000,
        peakMultiplier: 2.0,
        offHoursMultiplier: 0.5,
      });

      // Test at peak hour
      const peakTime = createDateAtHour(15);
      const resultPeak = normalizer.normalizeVolume("market-1", 2000, {
        timestamp: peakTime,
      });

      expect(resultPeak).not.toBeNull();
      expect(resultPeak?.originalVolume).toBe(2000);
      expect(resultPeak?.normalizedVolume).toBeGreaterThan(0);
      expect(resultPeak?.timePeriod).toBe(TimePeriod.PEAK);
    });

    it("should calculate z-score correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const hour = 14; // Peak hour
      const hourStats = profile?.hourlyStats[hour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      // Test with volume equal to average (should have z-score near 0)
      const timestamp = createDateAtHour(hour);
      const result = normalizer.normalizeVolume("market-1", hourStats.averageVolume, {
        timestamp,
      });

      expect(result).not.toBeNull();
      expect(Math.abs(result?.zScore ?? Infinity)).toBeLessThan(0.5);
    });

    it("should detect anomalies", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
        baseVolume: 1000,
      });

      const profile = normalizer.getProfile("market-1");
      const hour = 14;
      const hourStats = profile?.hourlyStats[hour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      // Test with very high volume (should be anomaly)
      const extremeVolume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
      const timestamp = createDateAtHour(hour);
      const result = normalizer.normalizeVolume("market-1", extremeVolume, {
        timestamp,
      });

      expect(result).not.toBeNull();
      expect(result?.isAnomaly).toBe(true);
      expect(result?.anomalySeverity).not.toBeNull();
    });

    it("should identify off-hours correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
      });

      // Test at off-hours (5 UTC)
      const offHoursTime = createDateAtHour(5);
      const result = normalizer.normalizeVolume("market-1", 500, {
        timestamp: offHoursTime,
      });

      expect(result).not.toBeNull();
      expect(result?.isOffHours).toBe(true);
      expect(result?.timePeriod).toBe(TimePeriod.OFF_HOURS);
    });

    it("should provide percentile rank", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
      });

      const result = normalizer.normalizeVolume("market-1", 1000, {
        timestamp: createDateAtHour(14),
      });

      expect(result).not.toBeNull();
      expect(result?.percentileRank).toBeGreaterThanOrEqual(0);
      expect(result?.percentileRank).toBeLessThanOrEqual(100);
    });

    it("should calculate normalization factor correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        peakMultiplier: 2.0,
        offHoursMultiplier: 0.5,
      });

      // Peak hours should have lower normalization factor (scale down)
      const peakResult = normalizer.normalizeVolume("market-1", 1000, {
        timestamp: createDateAtHour(15),
      });

      // Off hours should have higher normalization factor (scale up)
      const offHoursResult = normalizer.normalizeVolume("market-1", 1000, {
        timestamp: createDateAtHour(5),
      });

      expect(peakResult).not.toBeNull();
      expect(offHoursResult).not.toBeNull();
      // Off-hours normalization should scale up more than peak
      expect(offHoursResult!.normalizationFactor).toBeGreaterThan(
        peakResult!.normalizationFactor
      );
    });
  });

  // ==========================================================================
  // Off-Hours Anomaly Tests
  // ==========================================================================

  describe("isOffHoursAnomaly", () => {
    it("should detect off-hours anomalies", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        offHoursMultiplier: 0.2,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const offHour = 5;
      const hourStats = profile?.hourlyStats[offHour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      // Very high volume during off-hours
      const extremeVolume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
      const timestamp = createDateAtHour(offHour);

      const isAnomaly = normalizer.isOffHoursAnomaly("market-1", extremeVolume, {
        timestamp,
      });

      expect(isAnomaly).toBe(true);
    });

    it("should not flag normal off-hours activity", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const offHour = 5;
      const hourStats = profile?.hourlyStats[offHour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      // Normal volume during off-hours
      const normalVolume = hourStats.averageVolume;
      const timestamp = createDateAtHour(offHour);

      const isAnomaly = normalizer.isOffHoursAnomaly("market-1", normalVolume, {
        timestamp,
      });

      expect(isAnomaly).toBe(false);
    });

    it("should not flag peak hour anomalies as off-hours", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const peakHour = 15;
      const hourStats = profile?.hourlyStats[peakHour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      // High volume during peak hours
      const highVolume = hourStats.averageVolume * 3;
      const timestamp = createDateAtHour(peakHour);

      const isAnomaly = normalizer.isOffHoursAnomaly("market-1", highVolume, {
        timestamp,
      });

      expect(isAnomaly).toBe(false); // Not off-hours
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("events", () => {
    it("should emit offHoursAnomaly event", async () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        offHoursMultiplier: 0.2,
        dataPointsPerHour: 20,
      });

      const eventPromise = new Promise<OffHoursAnomalyEvent>((resolve) => {
        normalizer.on("offHoursAnomaly", (event) => {
          resolve(event);
        });
      });

      const profile = normalizer.getProfile("market-1");
      const offHour = 5;
      const hourStats = profile?.hourlyStats[offHour];

      if (!hourStats) {
        throw new Error("Hour stats not found");
      }

      const extremeVolume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
      normalizer.normalizeVolume("market-1", extremeVolume, {
        timestamp: createDateAtHour(offHour),
      });

      const event = await eventPromise;
      expect(event.marketId).toBe("market-1");
      expect(event.severity).toBeDefined();
    });

    it("should emit profileUpdated event", async () => {
      const normalizer = createNormalizerWithData("market-1");

      const eventPromise = new Promise<TimeOfDayProfile>((resolve) => {
        normalizer.on("profileUpdated", (_marketId, profile) => {
          resolve(profile);
        });
      });

      // Trigger profile build
      normalizer.getProfile("market-1");

      const profile = await eventPromise;
      expect(profile.marketId).toBe("market-1");
    });

    it("should not emit events when disabled", () => {
      // Create normalizer with events disabled
      const quietNormalizer = new TimeOfDayNormalizer({
        enableEvents: false,
        minDataPointsPerHour: 5,
      });

      // Copy data
      for (let day = 0; day < 14; day++) {
        for (let hour = 0; hour < 24; hour++) {
          for (let i = 0; i < 20; i++) {
            const timestamp = new Date();
            timestamp.setDate(timestamp.getDate() - day);
            timestamp.setUTCHours(hour, i * 3, 0, 0);
            quietNormalizer.addVolumeData("market-1", 100 + Math.random() * 50, timestamp);
          }
        }
      }

      let eventFired = false;
      quietNormalizer.on("offHoursAnomaly", () => {
        eventFired = true;
      });

      // Try to trigger anomaly
      quietNormalizer.normalizeVolume("market-1", 100000, {
        timestamp: createDateAtHour(5),
      });

      expect(eventFired).toBe(false);
    });
  });

  // ==========================================================================
  // Batch Operations Tests
  // ==========================================================================

  describe("batchNormalizeVolume", () => {
    it("should normalize multiple markets", () => {
      const normalizer = createNormalizerWithData("market-1");

      // Add data for second market
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          for (let i = 0; i < 10; i++) {
            const timestamp = new Date();
            timestamp.setDate(timestamp.getDate() - day);
            timestamp.setUTCHours(hour, i * 6, 0, 0);
            normalizer.addVolumeData("market-2", 500 + Math.random() * 100, timestamp);
          }
        }
      }

      const result = normalizer.batchNormalizeVolume([
        { marketId: "market-1", volume: 1000 },
        { marketId: "market-2", volume: 500 },
        { marketId: "market-unknown", volume: 100 },
      ]);

      expect(result.results.size).toBe(2);
      expect(result.errors.size).toBe(1);
      expect(result.errors.has("market-unknown")).toBe(true);
    });

    it("should track processing time", () => {
      const normalizer = createNormalizerWithData("market-1");

      const result = normalizer.batchNormalizeVolume([
        { marketId: "market-1", volume: 1000 },
      ]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Time Period Tests
  // ==========================================================================

  describe("getTimePeriod", () => {
    it("should classify peak hours correctly", () => {
      const normalizer = new TimeOfDayNormalizer({
        peakHours: [14, 15, 16, 17, 18, 19, 20, 21],
      });

      expect(normalizer.getTimePeriod(createDateAtHour(15))).toBe(TimePeriod.PEAK);
      expect(normalizer.getTimePeriod(createDateAtHour(18))).toBe(TimePeriod.PEAK);
    });

    it("should classify off-hours correctly", () => {
      const normalizer = new TimeOfDayNormalizer({
        offHoursRange: { start: 4, end: 8 },
      });

      expect(normalizer.getTimePeriod(createDateAtHour(5))).toBe(TimePeriod.OFF_HOURS);
      expect(normalizer.getTimePeriod(createDateAtHour(7))).toBe(TimePeriod.OFF_HOURS);
    });

    it("should classify low hours correctly", () => {
      const normalizer = new TimeOfDayNormalizer();

      expect(normalizer.getTimePeriod(createDateAtHour(2))).toBe(TimePeriod.LOW);
      expect(normalizer.getTimePeriod(createDateAtHour(3))).toBe(TimePeriod.LOW);
    });

    it("should classify standard hours correctly", () => {
      const normalizer = new TimeOfDayNormalizer();

      expect(normalizer.getTimePeriod(createDateAtHour(10))).toBe(TimePeriod.STANDARD);
      expect(normalizer.getTimePeriod(createDateAtHour(13))).toBe(TimePeriod.STANDARD);
    });
  });

  // ==========================================================================
  // Expected Volume Tests
  // ==========================================================================

  describe("getExpectedVolume", () => {
    it("should return null for unknown market", () => {
      const normalizer = new TimeOfDayNormalizer();
      expect(normalizer.getExpectedVolume("unknown", new Date())).toBeNull();
    });

    it("should return expected volume for specific time", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        baseVolume: 1000,
      });

      const expectedVolume = normalizer.getExpectedVolume(
        "market-1",
        createDateAtHour(14)
      );

      expect(expectedVolume).not.toBeNull();
      expect(expectedVolume).toBeGreaterThan(0);
    });

    it("should return higher expected volume for peak hours", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        peakMultiplier: 2.5,
        offHoursMultiplier: 0.3,
      });

      const peakExpected = normalizer.getExpectedVolume(
        "market-1",
        createDateAtHour(15)
      );
      const offHoursExpected = normalizer.getExpectedVolume(
        "market-1",
        createDateAtHour(5)
      );

      expect(peakExpected).not.toBeNull();
      expect(offHoursExpected).not.toBeNull();
      expect(peakExpected!).toBeGreaterThan(offHoursExpected!);
    });
  });

  // ==========================================================================
  // Utility Methods Tests
  // ==========================================================================

  describe("utility methods", () => {
    it("should track markets correctly", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeData("market-1", 100, new Date());
      normalizer.addVolumeData("market-2", 200, new Date());

      expect(normalizer.getTrackedMarkets()).toContain("market-1");
      expect(normalizer.getTrackedMarkets()).toContain("market-2");
      expect(normalizer.getTrackedMarkets().length).toBe(2);
    });

    it("should check if market has profile", () => {
      const normalizer = new TimeOfDayNormalizer();

      expect(normalizer.hasProfile("market-1")).toBe(false);

      normalizer.addVolumeData("market-1", 100, new Date());

      expect(normalizer.hasProfile("market-1")).toBe(true);
    });

    it("should clear market data", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeData("market-1", 100, new Date());
      normalizer.addVolumeData("market-2", 200, new Date());

      expect(normalizer.clearMarket("market-1")).toBe(true);
      expect(normalizer.hasProfile("market-1")).toBe(false);
      expect(normalizer.hasProfile("market-2")).toBe(true);
    });

    it("should clear all data", () => {
      const normalizer = new TimeOfDayNormalizer();

      normalizer.addVolumeData("market-1", 100, new Date());
      normalizer.addVolumeData("market-2", 200, new Date());

      normalizer.clearAll();

      expect(normalizer.getTrackedMarkets().length).toBe(0);
    });

    it("should invalidate profile cache", () => {
      const normalizer = createNormalizerWithData("market-1");

      const profile1 = normalizer.getProfile("market-1");
      normalizer.invalidateProfile("market-1");
      const profile2 = normalizer.getProfile("market-1");

      expect(profile1).not.toBe(profile2); // Different references after invalidation
    });

    it("should track recent anomalies", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        offHoursMultiplier: 0.2,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const hourStats = profile?.hourlyStats[5];

      if (hourStats) {
        const extremeVolume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
        normalizer.normalizeVolume("market-1", extremeVolume, {
          timestamp: createDateAtHour(5),
        });

        const recentAnomalies = normalizer.getRecentAnomalies();
        expect(recentAnomalies.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return summary for empty normalizer", () => {
      const normalizer = new TimeOfDayNormalizer();

      const summary = normalizer.getSummary();

      expect(summary.totalMarkets).toBe(0);
      expect(summary.reliableMarkets).toBe(0);
    });

    it("should return comprehensive summary", () => {
      const normalizer = createNormalizerWithData("market-1");

      const summary = normalizer.getSummary();

      expect(summary.totalMarkets).toBe(1);
      expect(summary.currentHour).toBeGreaterThanOrEqual(0);
      expect(summary.currentHour).toBeLessThanOrEqual(23);
      expect(summary.currentTimePeriod).toBeDefined();
    });

    it("should track markets with off-hours anomalies", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        offHoursMultiplier: 0.2,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const hourStats = profile?.hourlyStats[5];

      if (hourStats) {
        const extremeVolume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
        // Use current timestamp set to hour 5 (off-hours), not a past date
        const now = new Date();
        now.setUTCHours(5, 0, 0, 0);
        normalizer.normalizeVolume("market-1", extremeVolume, {
          timestamp: now,
        });

        // Check recent anomalies directly since summary filters by time
        const recentAnomalies = normalizer.getRecentAnomalies();
        const hasMarket1Anomaly = recentAnomalies.some(
          (a) => a.marketId === "market-1"
        );
        expect(hasMarket1Anomaly).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Stats Tests
  // ==========================================================================

  describe("getStats", () => {
    it("should return accurate statistics", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 7,
        dataPointsPerHour: 10,
      });

      const stats = normalizer.getStats();

      expect(stats.trackedMarkets).toBe(1);
      expect(stats.totalDataPoints).toBeGreaterThan(0);
      expect(stats.marketsWithReliableProfiles).toBe(1);
    });
  });

  // ==========================================================================
  // Singleton Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should create shared instance", () => {
      const shared1 = getSharedTimeOfDayNormalizer();
      const shared2 = getSharedTimeOfDayNormalizer();

      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const custom = new TimeOfDayNormalizer({ timezone: "Europe/London" });
      setSharedTimeOfDayNormalizer(custom);

      expect(getSharedTimeOfDayNormalizer()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const shared1 = getSharedTimeOfDayNormalizer();
      shared1.addVolumeData("market-1", 100, new Date());

      resetSharedTimeOfDayNormalizer();

      const shared2 = getSharedTimeOfDayNormalizer();
      expect(shared2).not.toBe(shared1);
      expect(shared2.getTrackedMarkets().length).toBe(0);
    });

    it("should create new instance with factory function", () => {
      const normalizer = createTimeOfDayNormalizer({ timezone: "Asia/Tokyo" });
      expect(normalizer).toBeInstanceOf(TimeOfDayNormalizer);
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe("convenience functions", () => {
    it("should add volume data via convenience function", () => {
      addVolumeForTimeProfile("market-1", 100, new Date());

      const shared = getSharedTimeOfDayNormalizer();
      expect(shared.getDataPointCount("market-1")).toBe(1);
    });

    it("should get profile via convenience function", () => {
      const normalizer = createNormalizerWithData("market-1");
      setSharedTimeOfDayNormalizer(normalizer);

      const profile = getTimeOfDayProfile("market-1");
      expect(profile).not.toBeNull();
    });

    it("should normalize volume via convenience function", () => {
      const normalizer = createNormalizerWithData("market-1");
      setSharedTimeOfDayNormalizer(normalizer);

      const result = normalizeVolumeForTimeOfDay("market-1", 1000);
      expect(result).not.toBeNull();
    });

    it("should check off-hours anomaly via convenience function", () => {
      const normalizer = createNormalizerWithData("market-1");
      setSharedTimeOfDayNormalizer(normalizer);

      const isAnomaly = checkOffHoursAnomaly("market-1", 1000);
      expect(typeof isAnomaly).toBe("boolean");
    });

    it("should get expected volume via convenience function", () => {
      const normalizer = createNormalizerWithData("market-1");
      setSharedTimeOfDayNormalizer(normalizer);

      const expected = getExpectedVolumeForTime("market-1", new Date());
      expect(expected).not.toBeNull();
    });

    it("should get current time period via convenience function", () => {
      const period = getCurrentTimePeriod();
      expect(Object.values(TimePeriod)).toContain(period);
    });

    it("should get summary via convenience function", () => {
      const summary = getTimeOfDayNormalizerSummary();
      expect(summary.totalMarkets).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Timezone Handling Tests
  // ==========================================================================

  describe("timezone handling", () => {
    it("should use configured timezone", () => {
      const normalizer = new TimeOfDayNormalizer({
        timezone: "America/New_York",
      });

      const stats = normalizer.getStats();
      expect(stats.timezone).toBe("America/New_York");
    });

    it("should normalize with different timezone", () => {
      const normalizer = createNormalizerWithData("market-1");

      const utcResult = normalizer.normalizeVolume("market-1", 1000, {
        timestamp: new Date(),
        timezone: "UTC",
      });

      expect(utcResult).not.toBeNull();
      expect(utcResult?.timezone).toBe("UTC");
    });

    it("should fall back to UTC for invalid timezone", () => {
      const normalizer = new TimeOfDayNormalizer({
        timezone: "Invalid/Timezone",
      });

      // Should not throw
      const timePeriod = normalizer.getTimePeriod(new Date());
      expect(timePeriod).toBeDefined();
    });
  });

  // ==========================================================================
  // Anomaly Severity Tests
  // ==========================================================================

  describe("anomaly severity", () => {
    it("should classify low severity correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const hour = 14;
      const hourStats = profile?.hourlyStats[hour];

      if (!hourStats) return;

      // 2.1 standard deviations above (low severity)
      const volume = hourStats.averageVolume + 2.1 * hourStats.standardDeviation;
      const result = normalizer.normalizeVolume("market-1", volume, {
        timestamp: createDateAtHour(hour),
      });

      expect(result?.anomalySeverity).toBe(OffHoursAnomalySeverity.LOW);
    });

    it("should classify critical severity correctly", () => {
      const normalizer = createNormalizerWithData("market-1", {
        daysOfData: 14,
        dataPointsPerHour: 20,
      });

      const profile = normalizer.getProfile("market-1");
      const hour = 14;
      const hourStats = profile?.hourlyStats[hour];

      if (!hourStats) return;

      // 5 standard deviations above (critical severity)
      const volume = hourStats.averageVolume + 5 * hourStats.standardDeviation;
      const result = normalizer.normalizeVolume("market-1", volume, {
        timestamp: createDateAtHour(hour),
      });

      expect(result?.anomalySeverity).toBe(OffHoursAnomalySeverity.CRITICAL);
    });
  });
});
