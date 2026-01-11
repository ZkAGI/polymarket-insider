/**
 * Time-of-Day Volume Normalizer (DET-VOL-007)
 *
 * Normalize volume analysis for time-of-day patterns.
 *
 * Features:
 * - Build hour-of-day profiles for each market
 * - Normalize volume by expected hourly volume
 * - Handle timezone differences for global markets
 * - Detect off-hours anomalies (unusual activity during typically low-volume periods)
 * - Configurable reference timezone
 * - Historical pattern learning
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Day of week enumeration
 */
export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

/**
 * Time period classification
 */
export enum TimePeriod {
  /** Peak trading hours (typically US market hours) */
  PEAK = "PEAK",
  /** Standard trading hours */
  STANDARD = "STANDARD",
  /** Low activity hours (overnight, weekends) */
  LOW = "LOW",
  /** Off-hours (very low expected activity) */
  OFF_HOURS = "OFF_HOURS",
}

/**
 * Anomaly severity level
 */
export enum OffHoursAnomalySeverity {
  /** Minor anomaly - slightly above expected */
  LOW = "LOW",
  /** Moderate anomaly - notably above expected */
  MEDIUM = "MEDIUM",
  /** Significant anomaly - well above expected */
  HIGH = "HIGH",
  /** Extreme anomaly - far above expected */
  CRITICAL = "CRITICAL",
}

/**
 * Hourly volume statistics
 */
export interface HourlyVolumeStats {
  /** Hour of day (0-23) */
  hour: number;

  /** Average volume for this hour */
  averageVolume: number;

  /** Median volume for this hour */
  medianVolume: number;

  /** Standard deviation of volume */
  standardDeviation: number;

  /** Minimum volume observed */
  minVolume: number;

  /** Maximum volume observed */
  maxVolume: number;

  /** 25th percentile volume */
  percentile25: number;

  /** 75th percentile volume */
  percentile75: number;

  /** 95th percentile volume */
  percentile95: number;

  /** Number of data points for this hour */
  dataPointCount: number;

  /** Time period classification for this hour */
  timePeriod: TimePeriod;

  /** Coefficient of variation */
  coefficientOfVariation: number;

  /** Average trade count for this hour (if available) */
  averageTradeCount: number | null;
}

/**
 * Day-of-week volume profile
 */
export interface DayOfWeekProfile {
  /** Day of week */
  day: DayOfWeek;

  /** Hourly stats for this day */
  hourlyStats: HourlyVolumeStats[];

  /** Total average daily volume */
  averageDailyVolume: number;

  /** Peak hour for this day */
  peakHour: number;

  /** Lowest activity hour for this day */
  lowestHour: number;

  /** Data point count for this day */
  dataPointCount: number;
}

/**
 * Complete time-of-day volume profile for a market
 */
export interface TimeOfDayProfile {
  /** Market ID */
  marketId: string;

  /** Reference timezone used for profile */
  timezone: string;

  /** Hourly statistics (24 entries) */
  hourlyStats: HourlyVolumeStats[];

  /** Day-of-week profiles */
  dayOfWeekProfiles: Record<DayOfWeek, DayOfWeekProfile>;

  /** Overall average volume */
  overallAverageVolume: number;

  /** Peak hours (hours with highest volume) */
  peakHours: number[];

  /** Off-hours (hours with lowest volume) */
  offHours: number[];

  /** When this profile was last updated */
  lastUpdated: Date;

  /** Time range of data used */
  dataTimeRange: {
    start: Date;
    end: Date;
  };

  /** Total data points used */
  totalDataPoints: number;

  /** Whether profile has sufficient data for reliable normalization */
  isReliable: boolean;

  /** Minimum data points per hour required */
  minDataPointsPerHour: number;
}

/**
 * Volume data point for profile building
 */
export interface VolumeDataPoint {
  /** Timestamp of the data point */
  timestamp: Date;

  /** Volume value */
  volume: number;

  /** Optional trade count */
  tradeCount?: number;
}

/**
 * Normalized volume result
 */
export interface NormalizedVolumeResult {
  /** Original volume */
  originalVolume: number;

  /** Normalized volume (adjusted for time-of-day) */
  normalizedVolume: number;

  /** Normalization factor applied */
  normalizationFactor: number;

  /** Hour of day the volume was recorded */
  hour: number;

  /** Day of week */
  dayOfWeek: DayOfWeek;

  /** Time period classification */
  timePeriod: TimePeriod;

  /** Expected volume for this time */
  expectedVolume: number;

  /** Z-score relative to hour's typical volume */
  zScore: number;

  /** Percentile rank within the hour's distribution */
  percentileRank: number;

  /** Whether this is an anomaly for this time period */
  isAnomaly: boolean;

  /** Anomaly severity if anomalous */
  anomalySeverity: OffHoursAnomalySeverity | null;

  /** Whether this is considered off-hours */
  isOffHours: boolean;

  /** Timestamp used for calculation */
  timestamp: Date;

  /** Timezone used */
  timezone: string;
}

/**
 * Off-hours anomaly event
 */
export interface OffHoursAnomalyEvent {
  /** Market ID */
  marketId: string;

  /** Detected volume */
  volume: number;

  /** Expected volume for this time */
  expectedVolume: number;

  /** Ratio of actual to expected */
  volumeRatio: number;

  /** Z-score */
  zScore: number;

  /** Anomaly severity */
  severity: OffHoursAnomalySeverity;

  /** Hour of day */
  hour: number;

  /** Day of week */
  dayOfWeek: DayOfWeek;

  /** Timestamp */
  timestamp: Date;

  /** Timezone */
  timezone: string;

  /** Time period */
  timePeriod: TimePeriod;
}

/**
 * Configuration for TimeOfDayNormalizer
 */
export interface TimeOfDayNormalizerConfig {
  /** Reference timezone (default: "UTC") */
  timezone?: string;

  /** Minimum data points per hour for reliable profile (default: 30) */
  minDataPointsPerHour?: number;

  /** Z-score thresholds for anomaly detection */
  anomalyThresholds?: {
    low?: number;
    medium?: number;
    high?: number;
    critical?: number;
  };

  /** Hours considered peak hours (default: 14-21 UTC, US market hours) */
  peakHours?: number[];

  /** Hours considered off-hours (default: 4-8 UTC) */
  offHoursRange?: { start: number; end: number };

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Maximum data points to store per market (default: 50000) */
  maxDataPointsPerMarket?: number;

  /** Time window for profile calculation in days (default: 30) */
  profileWindowDays?: number;
}

/**
 * Options for normalizing volume
 */
export interface NormalizeVolumeOptions {
  /** Override timestamp (default: now) */
  timestamp?: Date;

  /** Override timezone */
  timezone?: string;
}

/**
 * Options for batch normalization
 */
export interface BatchNormalizeOptions extends NormalizeVolumeOptions {
  /** Parallel processing (default: true) */
  parallel?: boolean;
}

/**
 * Batch normalization result
 */
export interface BatchNormalizeResult {
  /** Results by market ID */
  results: Map<string, NormalizedVolumeResult>;

  /** Errors by market ID */
  errors: Map<string, string>;

  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Summary across markets
 */
export interface TimeOfDayNormalizerSummary {
  /** Total markets with profiles */
  totalMarkets: number;

  /** Markets with reliable profiles */
  reliableMarkets: number;

  /** Average data points per market */
  averageDataPointsPerMarket: number;

  /** Markets currently in off-hours anomaly state */
  marketsWithOffHoursAnomalies: string[];

  /** Recent off-hours anomalies */
  recentAnomalies: OffHoursAnomalyEvent[];

  /** Current hour (reference timezone) */
  currentHour: number;

  /** Current time period */
  currentTimePeriod: TimePeriod;
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum data points per hour for reliable profile */
const DEFAULT_MIN_DATA_POINTS_PER_HOUR = 30;

/** Default maximum data points per market */
const DEFAULT_MAX_DATA_POINTS_PER_MARKET = 50000;

/** Default profile window in days */
const DEFAULT_PROFILE_WINDOW_DAYS = 30;

/** Default anomaly thresholds (z-scores) */
const DEFAULT_ANOMALY_THRESHOLDS = {
  low: 2.0,
  medium: 2.5,
  high: 3.0,
  critical: 4.0,
};

/** Default peak hours (14-21 UTC, covers US market hours 9am-4pm ET) */
const DEFAULT_PEAK_HOURS = [14, 15, 16, 17, 18, 19, 20, 21];

/** Default off-hours range (4-8 UTC, overnight in most markets) */
const DEFAULT_OFF_HOURS_RANGE = { start: 4, end: 8 };

/** All hours of the day */
const ALL_HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);

/** All days of the week */
const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get hour of day in specified timezone
 */
function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const hourStr = formatter.format(date);
    return parseInt(hourStr, 10);
  } catch {
    // Fallback to UTC
    return date.getUTCHours();
  }
}

/**
 * Get day of week in specified timezone
 */
function getDayInTimezone(date: Date, timezone: string): DayOfWeek {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timezone,
    });
    const dayStr = formatter.format(date);
    const dayMap: Record<string, DayOfWeek> = {
      Sun: DayOfWeek.SUNDAY,
      Mon: DayOfWeek.MONDAY,
      Tue: DayOfWeek.TUESDAY,
      Wed: DayOfWeek.WEDNESDAY,
      Thu: DayOfWeek.THURSDAY,
      Fri: DayOfWeek.FRIDAY,
      Sat: DayOfWeek.SATURDAY,
    };
    return dayMap[dayStr] ?? DayOfWeek.SUNDAY;
  } catch {
    // Fallback to UTC
    return date.getUTCDay() as DayOfWeek;
  }
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower] ?? 0;
  }
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? 0;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

/**
 * Classify time period based on hour
 */
function classifyTimePeriod(
  hour: number,
  peakHours: number[],
  offHoursRange: { start: number; end: number }
): TimePeriod {
  if (peakHours.includes(hour)) {
    return TimePeriod.PEAK;
  }

  // Check if hour is in off-hours range
  if (offHoursRange.start <= offHoursRange.end) {
    // Normal range (e.g., 4-8)
    if (hour >= offHoursRange.start && hour <= offHoursRange.end) {
      return TimePeriod.OFF_HOURS;
    }
  } else {
    // Wrapping range (e.g., 22-4)
    if (hour >= offHoursRange.start || hour <= offHoursRange.end) {
      return TimePeriod.OFF_HOURS;
    }
  }

  // Check for low activity (early morning, late night)
  if (hour >= 0 && hour <= 6) {
    return TimePeriod.LOW;
  }

  return TimePeriod.STANDARD;
}

/**
 * Determine anomaly severity based on z-score
 */
function getAnomalySeverity(
  zScore: number,
  thresholds: typeof DEFAULT_ANOMALY_THRESHOLDS
): OffHoursAnomalySeverity | null {
  const absZScore = Math.abs(zScore);
  if (absZScore >= thresholds.critical) {
    return OffHoursAnomalySeverity.CRITICAL;
  }
  if (absZScore >= thresholds.high) {
    return OffHoursAnomalySeverity.HIGH;
  }
  if (absZScore >= thresholds.medium) {
    return OffHoursAnomalySeverity.MEDIUM;
  }
  if (absZScore >= thresholds.low) {
    return OffHoursAnomalySeverity.LOW;
  }
  return null;
}

/**
 * Estimate percentile rank
 */
function estimatePercentileRank(
  volume: number,
  stats: HourlyVolumeStats
): number {
  if (stats.dataPointCount === 0) return 50;

  if (volume <= stats.minVolume) return 0;
  if (volume >= stats.maxVolume) return 100;

  if (volume <= stats.percentile25) {
    return 25 * (volume / Math.max(1, stats.percentile25));
  }
  if (volume <= stats.medianVolume) {
    return (
      25 +
      25 * ((volume - stats.percentile25) / Math.max(1, stats.medianVolume - stats.percentile25))
    );
  }
  if (volume <= stats.percentile75) {
    return (
      50 +
      25 * ((volume - stats.medianVolume) / Math.max(1, stats.percentile75 - stats.medianVolume))
    );
  }
  if (volume <= stats.percentile95) {
    return (
      75 +
      20 * ((volume - stats.percentile75) / Math.max(1, stats.percentile95 - stats.percentile75))
    );
  }

  return (
    95 +
    5 * Math.min(1, (volume - stats.percentile95) / Math.max(1, stats.percentile95))
  );
}

// ============================================================================
// TimeOfDayNormalizer Class
// ============================================================================

/**
 * Event types emitted by TimeOfDayNormalizer
 */
export interface TimeOfDayNormalizerEvents {
  offHoursAnomaly: (event: OffHoursAnomalyEvent) => void;
  profileUpdated: (marketId: string, profile: TimeOfDayProfile) => void;
}

/**
 * Normalizer for time-of-day volume patterns
 */
export class TimeOfDayNormalizer extends EventEmitter {
  private readonly timezone: string;
  private readonly minDataPointsPerHour: number;
  private readonly maxDataPointsPerMarket: number;
  private readonly profileWindowDays: number;
  private readonly anomalyThresholds: typeof DEFAULT_ANOMALY_THRESHOLDS;
  private readonly peakHours: number[];
  private readonly offHoursRange: { start: number; end: number };
  private readonly enableEvents: boolean;

  // Storage for volume data points
  private readonly marketData: Map<string, VolumeDataPoint[]> = new Map();

  // Cached profiles
  private readonly profileCache: Map<string, TimeOfDayProfile> = new Map();

  // Recent anomalies
  private readonly recentAnomalies: OffHoursAnomalyEvent[] = [];
  private readonly maxRecentAnomalies = 100;

  constructor(config?: TimeOfDayNormalizerConfig) {
    super();
    this.timezone = config?.timezone ?? "UTC";
    this.minDataPointsPerHour = config?.minDataPointsPerHour ?? DEFAULT_MIN_DATA_POINTS_PER_HOUR;
    this.maxDataPointsPerMarket =
      config?.maxDataPointsPerMarket ?? DEFAULT_MAX_DATA_POINTS_PER_MARKET;
    this.profileWindowDays = config?.profileWindowDays ?? DEFAULT_PROFILE_WINDOW_DAYS;
    this.anomalyThresholds = {
      ...DEFAULT_ANOMALY_THRESHOLDS,
      ...config?.anomalyThresholds,
    };
    this.peakHours = config?.peakHours ?? DEFAULT_PEAK_HOURS;
    this.offHoursRange = config?.offHoursRange ?? DEFAULT_OFF_HOURS_RANGE;
    this.enableEvents = config?.enableEvents ?? true;
  }

  /**
   * Add volume data point for profile building
   */
  addVolumeData(marketId: string, volume: number, timestamp: Date, tradeCount?: number): void {
    if (!marketId || marketId.trim() === "" || volume < 0) {
      return;
    }

    let dataPoints = this.marketData.get(marketId);
    if (!dataPoints) {
      dataPoints = [];
      this.marketData.set(marketId, dataPoints);
    }

    dataPoints.push({ timestamp, volume, tradeCount });

    // Trim old data if exceeding max
    if (dataPoints.length > this.maxDataPointsPerMarket) {
      const cutoff = new Date(
        Date.now() - this.profileWindowDays * 24 * 60 * 60 * 1000
      );
      this.marketData.set(
        marketId,
        dataPoints.filter((dp) => dp.timestamp >= cutoff)
      );
    }

    // Invalidate cached profile
    this.profileCache.delete(marketId);
  }

  /**
   * Add multiple volume data points in batch
   */
  addVolumeDataBatch(
    marketId: string,
    dataPoints: Array<{ volume: number; timestamp: Date; tradeCount?: number }>
  ): void {
    for (const dp of dataPoints) {
      this.addVolumeData(marketId, dp.volume, dp.timestamp, dp.tradeCount);
    }
  }

  /**
   * Build or get cached time-of-day profile for a market
   */
  getProfile(marketId: string): TimeOfDayProfile | null {
    // Check cache first
    const cached = this.profileCache.get(marketId);
    if (cached) {
      return cached;
    }

    // Build profile
    const profile = this.buildProfile(marketId);
    if (profile) {
      this.profileCache.set(marketId, profile);
      if (this.enableEvents) {
        this.emit("profileUpdated", marketId, profile);
      }
    }

    return profile;
  }

  /**
   * Build time-of-day profile from stored data
   */
  private buildProfile(marketId: string): TimeOfDayProfile | null {
    const dataPoints = this.marketData.get(marketId);
    if (!dataPoints || dataPoints.length === 0) {
      return null;
    }

    // Group data by hour and day
    const hourlyData: Map<number, VolumeDataPoint[]> = new Map();
    const dayHourlyData: Map<DayOfWeek, Map<number, VolumeDataPoint[]>> = new Map();

    for (const dp of dataPoints) {
      const hour = getHourInTimezone(dp.timestamp, this.timezone);
      const day = getDayInTimezone(dp.timestamp, this.timezone);

      // Add to hourly data
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(dp);

      // Add to day-hourly data
      if (!dayHourlyData.has(day)) {
        dayHourlyData.set(day, new Map());
      }
      const dayMap = dayHourlyData.get(day)!;
      if (!dayMap.has(hour)) {
        dayMap.set(hour, []);
      }
      dayMap.get(hour)!.push(dp);
    }

    // Calculate hourly stats
    const hourlyStats: HourlyVolumeStats[] = ALL_HOURS.map((hour) => {
      const points = hourlyData.get(hour) ?? [];
      return this.calculateHourlyStats(hour, points);
    });

    // Calculate day-of-week profiles
    const dayOfWeekProfiles: Record<DayOfWeek, DayOfWeekProfile> = {} as Record<
      DayOfWeek,
      DayOfWeekProfile
    >;

    for (const day of ALL_DAYS) {
      const dayData = dayHourlyData.get(day) ?? new Map();
      dayOfWeekProfiles[day] = this.calculateDayProfile(day, dayData);
    }

    // Calculate overall stats
    const allVolumes = dataPoints.map((dp) => dp.volume);
    const overallAverageVolume =
      allVolumes.length > 0 ? allVolumes.reduce((a, b) => a + b, 0) / allVolumes.length : 0;

    // Identify peak and off hours
    const sortedByVolume = [...hourlyStats].sort((a, b) => b.averageVolume - a.averageVolume);
    const peakHours = sortedByVolume.slice(0, 4).map((s) => s.hour);
    const offHours = sortedByVolume.slice(-4).map((s) => s.hour);

    // Determine reliability
    const hoursWithSufficientData = hourlyStats.filter(
      (s) => s.dataPointCount >= this.minDataPointsPerHour
    ).length;
    const isReliable = hoursWithSufficientData >= 18; // At least 18 hours with sufficient data

    // Get time range
    const timestamps = dataPoints.map((dp) => dp.timestamp.getTime());
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));

    return {
      marketId,
      timezone: this.timezone,
      hourlyStats,
      dayOfWeekProfiles,
      overallAverageVolume,
      peakHours,
      offHours,
      lastUpdated: new Date(),
      dataTimeRange: { start, end },
      totalDataPoints: dataPoints.length,
      isReliable,
      minDataPointsPerHour: this.minDataPointsPerHour,
    };
  }

  /**
   * Calculate statistics for a specific hour
   */
  private calculateHourlyStats(hour: number, dataPoints: VolumeDataPoint[]): HourlyVolumeStats {
    const timePeriod = classifyTimePeriod(hour, this.peakHours, this.offHoursRange);

    if (dataPoints.length === 0) {
      return {
        hour,
        averageVolume: 0,
        medianVolume: 0,
        standardDeviation: 0,
        minVolume: 0,
        maxVolume: 0,
        percentile25: 0,
        percentile75: 0,
        percentile95: 0,
        dataPointCount: 0,
        timePeriod,
        coefficientOfVariation: 0,
        averageTradeCount: null,
      };
    }

    const volumes = dataPoints.map((dp) => dp.volume);
    const sortedVolumes = [...volumes].sort((a, b) => a - b);
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const averageVolume = totalVolume / volumes.length;
    const standardDeviation = calculateStdDev(volumes, averageVolume);

    // Calculate trade count average if available
    const tradeCounts = dataPoints
      .map((dp) => dp.tradeCount)
      .filter((tc): tc is number => tc !== undefined);
    const averageTradeCount =
      tradeCounts.length > 0 ? tradeCounts.reduce((a, b) => a + b, 0) / tradeCounts.length : null;

    return {
      hour,
      averageVolume,
      medianVolume: calculatePercentile(sortedVolumes, 50),
      standardDeviation,
      minVolume: sortedVolumes[0] ?? 0,
      maxVolume: sortedVolumes[sortedVolumes.length - 1] ?? 0,
      percentile25: calculatePercentile(sortedVolumes, 25),
      percentile75: calculatePercentile(sortedVolumes, 75),
      percentile95: calculatePercentile(sortedVolumes, 95),
      dataPointCount: dataPoints.length,
      timePeriod,
      coefficientOfVariation: averageVolume > 0 ? standardDeviation / averageVolume : 0,
      averageTradeCount,
    };
  }

  /**
   * Calculate day-of-week profile
   */
  private calculateDayProfile(
    day: DayOfWeek,
    hourlyData: Map<number, VolumeDataPoint[]>
  ): DayOfWeekProfile {
    const hourlyStats = ALL_HOURS.map((hour) => {
      const points = hourlyData.get(hour) ?? [];
      return this.calculateHourlyStats(hour, points);
    });

    const averageDailyVolume = hourlyStats.reduce((sum, s) => sum + s.averageVolume, 0);
    const totalDataPoints = hourlyStats.reduce((sum, s) => sum + s.dataPointCount, 0);

    // Find peak and lowest hours
    let peakHour = 0;
    let lowestHour = 0;
    let maxVolume = -1;
    let minVolume = Infinity;

    for (const stats of hourlyStats) {
      if (stats.averageVolume > maxVolume) {
        maxVolume = stats.averageVolume;
        peakHour = stats.hour;
      }
      if (stats.averageVolume < minVolume && stats.dataPointCount > 0) {
        minVolume = stats.averageVolume;
        lowestHour = stats.hour;
      }
    }

    return {
      day,
      hourlyStats,
      averageDailyVolume,
      peakHour,
      lowestHour,
      dataPointCount: totalDataPoints,
    };
  }

  /**
   * Normalize a volume value for time-of-day patterns
   */
  normalizeVolume(
    marketId: string,
    volume: number,
    options?: NormalizeVolumeOptions
  ): NormalizedVolumeResult | null {
    const profile = this.getProfile(marketId);
    if (!profile || !profile.isReliable) {
      return null;
    }

    const timestamp = options?.timestamp ?? new Date();
    const timezone = options?.timezone ?? this.timezone;

    const hour = getHourInTimezone(timestamp, timezone);
    const dayOfWeek = getDayInTimezone(timestamp, timezone);

    const hourlyStats = profile.hourlyStats[hour];
    if (!hourlyStats || hourlyStats.dataPointCount < this.minDataPointsPerHour) {
      return null;
    }

    // Calculate normalization factor
    // Factor > 1 means this hour has lower than average volume, so we scale up
    // Factor < 1 means this hour has higher than average volume, so we scale down
    const normalizationFactor =
      hourlyStats.averageVolume > 0
        ? profile.overallAverageVolume / hourlyStats.averageVolume
        : 1;

    const normalizedVolume = volume * normalizationFactor;
    const expectedVolume = hourlyStats.averageVolume;

    // Calculate z-score
    const zScore =
      hourlyStats.standardDeviation > 0
        ? (volume - hourlyStats.averageVolume) / hourlyStats.standardDeviation
        : 0;

    // Determine anomaly
    const anomalySeverity = getAnomalySeverity(zScore, this.anomalyThresholds);
    const isAnomaly = anomalySeverity !== null;
    const isOffHours = hourlyStats.timePeriod === TimePeriod.OFF_HOURS;

    // Emit off-hours anomaly event if applicable
    if (isAnomaly && isOffHours && this.enableEvents) {
      const event: OffHoursAnomalyEvent = {
        marketId,
        volume,
        expectedVolume,
        volumeRatio: expectedVolume > 0 ? volume / expectedVolume : 0,
        zScore,
        severity: anomalySeverity,
        hour,
        dayOfWeek,
        timestamp,
        timezone,
        timePeriod: hourlyStats.timePeriod,
      };
      this.emit("offHoursAnomaly", event);
      this.addRecentAnomaly(event);
    }

    return {
      originalVolume: volume,
      normalizedVolume,
      normalizationFactor,
      hour,
      dayOfWeek,
      timePeriod: hourlyStats.timePeriod,
      expectedVolume,
      zScore,
      percentileRank: estimatePercentileRank(volume, hourlyStats),
      isAnomaly,
      anomalySeverity,
      isOffHours,
      timestamp,
      timezone,
    };
  }

  /**
   * Normalize volumes for multiple markets
   */
  batchNormalizeVolume(
    entries: Array<{ marketId: string; volume: number }>,
    options?: BatchNormalizeOptions
  ): BatchNormalizeResult {
    const startTime = Date.now();
    const results = new Map<string, NormalizedVolumeResult>();
    const errors = new Map<string, string>();

    for (const entry of entries) {
      try {
        const result = this.normalizeVolume(entry.marketId, entry.volume, options);
        if (result) {
          results.set(entry.marketId, result);
        } else {
          errors.set(entry.marketId, "No reliable profile available");
        }
      } catch (error) {
        errors.set(entry.marketId, error instanceof Error ? error.message : "Unknown error");
      }
    }

    return {
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a volume is an off-hours anomaly
   */
  isOffHoursAnomaly(
    marketId: string,
    volume: number,
    options?: NormalizeVolumeOptions
  ): boolean {
    const result = this.normalizeVolume(marketId, volume, options);
    return result !== null && result.isOffHours && result.isAnomaly;
  }

  /**
   * Get expected volume for a specific time
   */
  getExpectedVolume(
    marketId: string,
    timestamp: Date,
    timezone?: string
  ): number | null {
    const profile = this.getProfile(marketId);
    if (!profile) return null;

    const hour = getHourInTimezone(timestamp, timezone ?? this.timezone);
    const hourlyStats = profile.hourlyStats[hour];

    return hourlyStats?.averageVolume ?? null;
  }

  /**
   * Get time period classification for a given time
   */
  getTimePeriod(timestamp: Date, timezone?: string): TimePeriod {
    const hour = getHourInTimezone(timestamp, timezone ?? this.timezone);
    return classifyTimePeriod(hour, this.peakHours, this.offHoursRange);
  }

  /**
   * Get current time period
   */
  getCurrentTimePeriod(): TimePeriod {
    return this.getTimePeriod(new Date());
  }

  /**
   * Get all tracked market IDs
   */
  getTrackedMarkets(): string[] {
    return Array.from(this.marketData.keys());
  }

  /**
   * Check if a market has a profile
   */
  hasProfile(marketId: string): boolean {
    return this.marketData.has(marketId) && (this.marketData.get(marketId)?.length ?? 0) > 0;
  }

  /**
   * Get data point count for a market
   */
  getDataPointCount(marketId: string): number {
    return this.marketData.get(marketId)?.length ?? 0;
  }

  /**
   * Clear data for a specific market
   */
  clearMarket(marketId: string): boolean {
    this.profileCache.delete(marketId);
    return this.marketData.delete(marketId);
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.marketData.clear();
    this.profileCache.clear();
    this.recentAnomalies.length = 0;
  }

  /**
   * Invalidate cached profile for a market
   */
  invalidateProfile(marketId: string): void {
    this.profileCache.delete(marketId);
  }

  /**
   * Get recent off-hours anomalies
   */
  getRecentAnomalies(limit: number = 10): OffHoursAnomalyEvent[] {
    return this.recentAnomalies.slice(-limit);
  }

  /**
   * Get summary across all markets
   */
  getSummary(): TimeOfDayNormalizerSummary {
    const marketIds = this.getTrackedMarkets();
    let reliableCount = 0;
    let totalDataPoints = 0;
    const marketsWithAnomalies: string[] = [];

    for (const marketId of marketIds) {
      const profile = this.getProfile(marketId);
      if (profile) {
        totalDataPoints += profile.totalDataPoints;
        if (profile.isReliable) {
          reliableCount++;
        }
      }

      // Check for recent anomalies in this market
      const hasRecentAnomaly = this.recentAnomalies.some(
        (a) => a.marketId === marketId && Date.now() - a.timestamp.getTime() < 60 * 60 * 1000
      );
      if (hasRecentAnomaly) {
        marketsWithAnomalies.push(marketId);
      }
    }

    const currentHour = getHourInTimezone(new Date(), this.timezone);

    return {
      totalMarkets: marketIds.length,
      reliableMarkets: reliableCount,
      averageDataPointsPerMarket: marketIds.length > 0 ? totalDataPoints / marketIds.length : 0,
      marketsWithOffHoursAnomalies: marketsWithAnomalies,
      recentAnomalies: this.getRecentAnomalies(10),
      currentHour,
      currentTimePeriod: this.getCurrentTimePeriod(),
    };
  }

  /**
   * Get normalizer statistics
   */
  getStats(): {
    trackedMarkets: number;
    marketsWithReliableProfiles: number;
    totalDataPoints: number;
    timezone: string;
    minDataPointsPerHour: number;
    profileWindowDays: number;
    peakHours: number[];
    offHoursRange: { start: number; end: number };
    recentAnomalyCount: number;
  } {
    let totalDataPoints = 0;
    let reliableProfiles = 0;

    for (const [marketId, dataPoints] of this.marketData) {
      totalDataPoints += dataPoints.length;
      const profile = this.getProfile(marketId);
      if (profile?.isReliable) {
        reliableProfiles++;
      }
    }

    return {
      trackedMarkets: this.marketData.size,
      marketsWithReliableProfiles: reliableProfiles,
      totalDataPoints,
      timezone: this.timezone,
      minDataPointsPerHour: this.minDataPointsPerHour,
      profileWindowDays: this.profileWindowDays,
      peakHours: this.peakHours,
      offHoursRange: this.offHoursRange,
      recentAnomalyCount: this.recentAnomalies.length,
    };
  }

  /**
   * Add recent anomaly (internal)
   */
  private addRecentAnomaly(event: OffHoursAnomalyEvent): void {
    this.recentAnomalies.push(event);
    if (this.recentAnomalies.length > this.maxRecentAnomalies) {
      this.recentAnomalies.shift();
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedNormalizer: TimeOfDayNormalizer | null = null;

/**
 * Create a new TimeOfDayNormalizer instance
 */
export function createTimeOfDayNormalizer(
  config?: TimeOfDayNormalizerConfig
): TimeOfDayNormalizer {
  return new TimeOfDayNormalizer(config);
}

/**
 * Get the shared TimeOfDayNormalizer instance
 */
export function getSharedTimeOfDayNormalizer(): TimeOfDayNormalizer {
  if (!sharedNormalizer) {
    sharedNormalizer = new TimeOfDayNormalizer();
  }
  return sharedNormalizer;
}

/**
 * Set the shared TimeOfDayNormalizer instance
 */
export function setSharedTimeOfDayNormalizer(normalizer: TimeOfDayNormalizer): void {
  sharedNormalizer = normalizer;
}

/**
 * Reset the shared TimeOfDayNormalizer instance
 */
export function resetSharedTimeOfDayNormalizer(): void {
  if (sharedNormalizer) {
    sharedNormalizer.clearAll();
    sharedNormalizer.removeAllListeners();
  }
  sharedNormalizer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add volume data for time-of-day profiling (convenience function)
 */
export function addVolumeForTimeProfile(
  marketId: string,
  volume: number,
  timestamp: Date,
  options?: { tradeCount?: number; normalizer?: TimeOfDayNormalizer }
): void {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  normalizer.addVolumeData(marketId, volume, timestamp, options?.tradeCount);
}

/**
 * Get time-of-day profile for a market (convenience function)
 */
export function getTimeOfDayProfile(
  marketId: string,
  options?: { normalizer?: TimeOfDayNormalizer }
): TimeOfDayProfile | null {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.getProfile(marketId);
}

/**
 * Normalize volume for time-of-day (convenience function)
 */
export function normalizeVolumeForTimeOfDay(
  marketId: string,
  volume: number,
  options?: NormalizeVolumeOptions & { normalizer?: TimeOfDayNormalizer }
): NormalizedVolumeResult | null {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.normalizeVolume(marketId, volume, options);
}

/**
 * Check if volume is an off-hours anomaly (convenience function)
 */
export function checkOffHoursAnomaly(
  marketId: string,
  volume: number,
  options?: NormalizeVolumeOptions & { normalizer?: TimeOfDayNormalizer }
): boolean {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.isOffHoursAnomaly(marketId, volume, options);
}

/**
 * Get expected volume for a specific time (convenience function)
 */
export function getExpectedVolumeForTime(
  marketId: string,
  timestamp: Date,
  options?: { timezone?: string; normalizer?: TimeOfDayNormalizer }
): number | null {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.getExpectedVolume(marketId, timestamp, options?.timezone);
}

/**
 * Get current time period (convenience function)
 */
export function getCurrentTimePeriod(options?: {
  normalizer?: TimeOfDayNormalizer;
}): TimePeriod {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.getCurrentTimePeriod();
}

/**
 * Get time-of-day normalizer summary (convenience function)
 */
export function getTimeOfDayNormalizerSummary(options?: {
  normalizer?: TimeOfDayNormalizer;
}): TimeOfDayNormalizerSummary {
  const normalizer = options?.normalizer ?? getSharedTimeOfDayNormalizer();
  return normalizer.getSummary();
}
