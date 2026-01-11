/**
 * Rolling Volume Average Tracker (DET-VOL-002)
 *
 * Track rolling average volume over configurable windows for real-time
 * market monitoring and anomaly detection.
 *
 * Features:
 * - Implement sliding window for efficient volume tracking
 * - Support multiple time windows (1min, 5min, 15min, 1hr, 4hr, 24hr)
 * - Handle sparse data with proper interpolation
 * - Provide current averages with confidence metrics
 * - In-memory ring buffer for optimal performance
 * - Event emission for threshold breaches
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Time window for rolling average calculation
 */
export enum RollingWindow {
  /** 1-minute window */
  ONE_MINUTE = "1m",
  /** 5-minute window */
  FIVE_MINUTES = "5m",
  /** 15-minute window */
  FIFTEEN_MINUTES = "15m",
  /** 1-hour window */
  ONE_HOUR = "1h",
  /** 4-hour window */
  FOUR_HOURS = "4h",
  /** 24-hour window */
  TWENTY_FOUR_HOURS = "24h",
}

/**
 * A single volume data point
 */
export interface VolumeDataEntry {
  /** Timestamp in milliseconds */
  timestamp: number;

  /** Volume at this point */
  volume: number;

  /** Optional trade count */
  tradeCount?: number;

  /** Optional price at this point */
  price?: number;
}

/**
 * Rolling average result for a specific window
 */
export interface RollingAverageResult {
  /** The window this result is for */
  window: RollingWindow;

  /** Average volume per minute in this window */
  averageVolumePerMinute: number;

  /** Total volume in this window */
  totalVolume: number;

  /** Number of data points in the window */
  dataPointCount: number;

  /** Standard deviation of volume in window */
  standardDeviation: number;

  /** Minimum volume in window */
  minVolume: number;

  /** Maximum volume in window */
  maxVolume: number;

  /** Average trade count per minute (if available) */
  averageTradeCountPerMinute: number | null;

  /** Window start time */
  windowStart: Date;

  /** Window end time */
  windowEnd: Date;

  /** Percentage of expected data points present (data density) */
  dataDensity: number;

  /** Whether there's sufficient data for reliable average */
  isReliable: boolean;

  /** Coefficient of variation (stddev/mean) */
  coefficientOfVariation: number;

  /** Volume velocity (rate of change per minute) */
  volumeVelocity: number;
}

/**
 * All rolling averages for a market
 */
export interface MarketRollingAverages {
  /** Market ID */
  marketId: string;

  /** Current timestamp */
  calculatedAt: Date;

  /** Results for each window */
  windowResults: Record<RollingWindow, RollingAverageResult>;

  /** Overall data health */
  dataHealth: {
    /** Oldest data point available */
    oldestDataPoint: Date | null;
    /** Newest data point available */
    newestDataPoint: Date | null;
    /** Total data points stored */
    totalDataPoints: number;
    /** Maximum age of data in minutes */
    maxDataAgeMinutes: number;
  };
}

/**
 * Volume threshold breach event
 */
export interface VolumeThresholdBreach {
  /** Market ID */
  marketId: string;

  /** Window where breach occurred */
  window: RollingWindow;

  /** Current volume */
  currentVolume: number;

  /** Threshold that was breached */
  threshold: number;

  /** Whether this is a high breach (above threshold) or low (below) */
  isHigh: boolean;

  /** How many standard deviations above/below average */
  zScore: number;

  /** Timestamp of breach */
  timestamp: Date;
}

/**
 * Configuration for RollingVolumeTracker
 */
export interface RollingVolumeTrackerConfig {
  /** Windows to track (default: all) */
  windows?: RollingWindow[];

  /** Maximum data points to store per market (default: 10000) */
  maxDataPoints?: number;

  /** Data point interval in milliseconds (default: 1000 = 1 second) */
  dataPointIntervalMs?: number;

  /** Minimum data density for reliable average (default: 0.5 = 50%) */
  minDataDensity?: number;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Z-score threshold for breach alerts (default: 2.0) */
  breachZScoreThreshold?: number;
}

/**
 * Options for adding volume data
 */
export interface AddVolumeOptions {
  /** Override the current timestamp */
  timestamp?: number;

  /** Trade count for this volume */
  tradeCount?: number;

  /** Current price */
  price?: number;
}

/**
 * Options for getting rolling averages
 */
export interface GetRollingAveragesOptions {
  /** Specific windows to calculate (default: all configured windows) */
  windows?: RollingWindow[];

  /** Current timestamp override */
  asOf?: number;
}

/**
 * Batch result for multiple markets
 */
export interface BatchRollingAveragesResult {
  /** Results by market ID */
  results: Map<string, MarketRollingAverages>;

  /** Failed markets with errors */
  errors: Map<string, string>;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary across multiple markets
 */
export interface RollingAveragesSummary {
  /** Total markets tracked */
  totalMarkets: number;

  /** Markets with reliable data */
  reliableMarkets: number;

  /** Average volume across all markets by window */
  averageVolumeByWindow: Record<RollingWindow, number>;

  /** Top markets by volume in each window */
  topMarketsByWindow: Record<RollingWindow, Array<{
    marketId: string;
    averageVolumePerMinute: number;
  }>>;

  /** Markets with abnormal volume */
  abnormalVolumeMarkets: Array<{
    marketId: string;
    window: RollingWindow;
    zScore: number;
    isHigh: boolean;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Window duration in milliseconds */
export const WINDOW_DURATION_MS: Record<RollingWindow, number> = {
  [RollingWindow.ONE_MINUTE]: 60 * 1000,
  [RollingWindow.FIVE_MINUTES]: 5 * 60 * 1000,
  [RollingWindow.FIFTEEN_MINUTES]: 15 * 60 * 1000,
  [RollingWindow.ONE_HOUR]: 60 * 60 * 1000,
  [RollingWindow.FOUR_HOURS]: 4 * 60 * 60 * 1000,
  [RollingWindow.TWENTY_FOUR_HOURS]: 24 * 60 * 60 * 1000,
};

/** Window duration in minutes */
export const WINDOW_DURATION_MINUTES: Record<RollingWindow, number> = {
  [RollingWindow.ONE_MINUTE]: 1,
  [RollingWindow.FIVE_MINUTES]: 5,
  [RollingWindow.FIFTEEN_MINUTES]: 15,
  [RollingWindow.ONE_HOUR]: 60,
  [RollingWindow.FOUR_HOURS]: 240,
  [RollingWindow.TWENTY_FOUR_HOURS]: 1440,
};

/** All rolling windows */
export const ALL_ROLLING_WINDOWS: RollingWindow[] = [
  RollingWindow.ONE_MINUTE,
  RollingWindow.FIVE_MINUTES,
  RollingWindow.FIFTEEN_MINUTES,
  RollingWindow.ONE_HOUR,
  RollingWindow.FOUR_HOURS,
  RollingWindow.TWENTY_FOUR_HOURS,
];

/** Default maximum data points */
const DEFAULT_MAX_DATA_POINTS = 10000;

/** Default data point interval in milliseconds */
const DEFAULT_DATA_POINT_INTERVAL_MS = 1000;

/** Default minimum data density for reliable average */
const DEFAULT_MIN_DATA_DENSITY = 0.5;

/** Default z-score threshold for breach alerts */
const DEFAULT_BREACH_Z_SCORE_THRESHOLD = 2.0;

// ============================================================================
// Ring Buffer for Efficient Sliding Window
// ============================================================================

/**
 * Efficient ring buffer for storing volume data points
 */
class VolumeRingBuffer {
  private buffer: VolumeDataEntry[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add a data point to the buffer
   */
  add(entry: VolumeDataEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Get all data points in time range
   */
  getInRange(startTime: number, endTime: number): VolumeDataEntry[] {
    const result: VolumeDataEntry[] = [];

    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.capacity) % this.capacity;
      const entry = this.buffer[index];
      if (entry && entry.timestamp >= startTime && entry.timestamp <= endTime) {
        result.push(entry);
      }
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get oldest data point
   */
  getOldest(): VolumeDataEntry | null {
    if (this.count === 0) return null;
    const index = (this.head - this.count + this.capacity) % this.capacity;
    return this.buffer[index] ?? null;
  }

  /**
   * Get newest data point
   */
  getNewest(): VolumeDataEntry | null {
    if (this.count === 0) return null;
    const index = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[index] ?? null;
  }

  /**
   * Get count of data points
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer = new Array(this.capacity);
  }

  /**
   * Get all data points (for debugging/export)
   */
  getAll(): VolumeDataEntry[] {
    const result: VolumeDataEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.capacity) % this.capacity;
      const entry = this.buffer[index];
      if (entry) {
        result.push(entry);
      }
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Calculate volume velocity (rate of change)
 */
function calculateVolumeVelocity(dataPoints: VolumeDataEntry[]): number {
  if (dataPoints.length < 2) return 0;

  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];

  if (!first || !last) return 0;

  const timeDiffMinutes = (last.timestamp - first.timestamp) / (60 * 1000);
  if (timeDiffMinutes === 0) return 0;

  const volumeDiff = last.volume - first.volume;
  return volumeDiff / timeDiffMinutes;
}

/**
 * Calculate rolling average for a specific window
 */
function calculateWindowAverage(
  dataPoints: VolumeDataEntry[],
  window: RollingWindow,
  windowStart: number,
  windowEnd: number,
  dataPointIntervalMs: number,
  minDataDensity: number
): RollingAverageResult {
  const windowDurationMs = WINDOW_DURATION_MS[window];
  const windowDurationMinutes = WINDOW_DURATION_MINUTES[window];

  // Expected data points based on interval
  const expectedDataPoints = Math.floor(windowDurationMs / dataPointIntervalMs);

  if (dataPoints.length === 0) {
    return {
      window,
      averageVolumePerMinute: 0,
      totalVolume: 0,
      dataPointCount: 0,
      standardDeviation: 0,
      minVolume: 0,
      maxVolume: 0,
      averageTradeCountPerMinute: null,
      windowStart: new Date(windowStart),
      windowEnd: new Date(windowEnd),
      dataDensity: 0,
      isReliable: false,
      coefficientOfVariation: 0,
      volumeVelocity: 0,
    };
  }

  // Calculate volumes
  const volumes = dataPoints.map((dp) => dp.volume);
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const averageVolume = totalVolume / dataPoints.length;
  const standardDeviation = calculateStdDev(volumes, averageVolume);

  // Calculate trade counts if available
  const tradeCounts = dataPoints.map((dp) => dp.tradeCount).filter((tc): tc is number => tc !== undefined);
  const totalTradeCount = tradeCounts.length > 0 ? tradeCounts.reduce((a, b) => a + b, 0) : null;

  // Calculate data density
  const dataDensity = dataPoints.length / Math.max(1, expectedDataPoints);

  // Calculate per-minute metrics
  const averageVolumePerMinute = totalVolume / windowDurationMinutes;
  const averageTradeCountPerMinute = totalTradeCount !== null
    ? totalTradeCount / windowDurationMinutes
    : null;

  return {
    window,
    averageVolumePerMinute,
    totalVolume,
    dataPointCount: dataPoints.length,
    standardDeviation,
    minVolume: Math.min(...volumes),
    maxVolume: Math.max(...volumes),
    averageTradeCountPerMinute,
    windowStart: new Date(windowStart),
    windowEnd: new Date(windowEnd),
    dataDensity: Math.min(1, dataDensity),
    isReliable: dataDensity >= minDataDensity,
    coefficientOfVariation: averageVolume > 0 ? standardDeviation / averageVolume : 0,
    volumeVelocity: calculateVolumeVelocity(dataPoints),
  };
}

// ============================================================================
// RollingVolumeTracker Class
// ============================================================================

/**
 * Event types emitted by RollingVolumeTracker
 */
export interface RollingVolumeTrackerEvents {
  volumeAdded: (marketId: string, entry: VolumeDataEntry) => void;
  thresholdBreach: (breach: VolumeThresholdBreach) => void;
  dataCleared: (marketId: string) => void;
}

/**
 * Tracker for rolling volume averages across multiple markets
 */
export class RollingVolumeTracker extends EventEmitter {
  private readonly marketBuffers: Map<string, VolumeRingBuffer> = new Map();
  private readonly windows: RollingWindow[];
  private readonly maxDataPoints: number;
  private readonly dataPointIntervalMs: number;
  private readonly minDataDensity: number;
  private readonly enableEvents: boolean;
  private readonly breachZScoreThreshold: number;

  // Track recent averages for breach detection
  private readonly recentAverages: Map<string, Map<RollingWindow, number>> = new Map();

  constructor(config?: RollingVolumeTrackerConfig) {
    super();
    this.windows = config?.windows ?? ALL_ROLLING_WINDOWS;
    this.maxDataPoints = config?.maxDataPoints ?? DEFAULT_MAX_DATA_POINTS;
    this.dataPointIntervalMs = config?.dataPointIntervalMs ?? DEFAULT_DATA_POINT_INTERVAL_MS;
    this.minDataDensity = config?.minDataDensity ?? DEFAULT_MIN_DATA_DENSITY;
    this.enableEvents = config?.enableEvents ?? true;
    this.breachZScoreThreshold = config?.breachZScoreThreshold ?? DEFAULT_BREACH_Z_SCORE_THRESHOLD;
  }

  /**
   * Add a volume data point for a market
   */
  addVolume(marketId: string, volume: number, options?: AddVolumeOptions): void {
    if (!marketId || marketId.trim() === "") {
      return;
    }

    if (volume < 0) {
      return;
    }

    const entry: VolumeDataEntry = {
      timestamp: options?.timestamp ?? Date.now(),
      volume,
      tradeCount: options?.tradeCount,
      price: options?.price,
    };

    // Get or create buffer for market
    let buffer = this.marketBuffers.get(marketId);
    if (!buffer) {
      buffer = new VolumeRingBuffer(this.maxDataPoints);
      this.marketBuffers.set(marketId, buffer);
    }

    // Add to buffer
    buffer.add(entry);

    // Emit event
    if (this.enableEvents) {
      this.emit("volumeAdded", marketId, entry);
    }

    // Check for threshold breach
    this.checkForBreach(marketId, entry);
  }

  /**
   * Add multiple volume data points in batch
   */
  addVolumeBatch(marketId: string, entries: Array<{ volume: number } & AddVolumeOptions>): void {
    for (const entry of entries) {
      this.addVolume(marketId, entry.volume, entry);
    }
  }

  /**
   * Get rolling averages for a market
   */
  getRollingAverages(marketId: string, options?: GetRollingAveragesOptions): MarketRollingAverages | null {
    const buffer = this.marketBuffers.get(marketId);
    if (!buffer || buffer.getCount() === 0) {
      return null;
    }

    const now = options?.asOf ?? Date.now();
    const windowsToCalculate = options?.windows ?? this.windows;

    const windowResults: Record<RollingWindow, RollingAverageResult> = {} as Record<RollingWindow, RollingAverageResult>;

    for (const window of windowsToCalculate) {
      const windowDuration = WINDOW_DURATION_MS[window];
      const windowStart = now - windowDuration;
      const windowEnd = now;

      const dataPoints = buffer.getInRange(windowStart, windowEnd);

      windowResults[window] = calculateWindowAverage(
        dataPoints,
        window,
        windowStart,
        windowEnd,
        this.dataPointIntervalMs,
        this.minDataDensity
      );
    }

    // Fill in any missing windows with empty results
    for (const window of ALL_ROLLING_WINDOWS) {
      if (!windowResults[window]) {
        const windowDuration = WINDOW_DURATION_MS[window];
        const windowStart = now - windowDuration;
        windowResults[window] = {
          window,
          averageVolumePerMinute: 0,
          totalVolume: 0,
          dataPointCount: 0,
          standardDeviation: 0,
          minVolume: 0,
          maxVolume: 0,
          averageTradeCountPerMinute: null,
          windowStart: new Date(windowStart),
          windowEnd: new Date(now),
          dataDensity: 0,
          isReliable: false,
          coefficientOfVariation: 0,
          volumeVelocity: 0,
        };
      }
    }

    // Calculate data health
    const oldest = buffer.getOldest();
    const newest = buffer.getNewest();
    const maxDataAgeMinutes = oldest
      ? (now - oldest.timestamp) / (60 * 1000)
      : 0;

    return {
      marketId,
      calculatedAt: new Date(now),
      windowResults,
      dataHealth: {
        oldestDataPoint: oldest ? new Date(oldest.timestamp) : null,
        newestDataPoint: newest ? new Date(newest.timestamp) : null,
        totalDataPoints: buffer.getCount(),
        maxDataAgeMinutes,
      },
    };
  }

  /**
   * Get rolling averages for multiple markets
   */
  getBatchRollingAverages(
    marketIds: string[],
    options?: GetRollingAveragesOptions
  ): BatchRollingAveragesResult {
    const startTime = Date.now();
    const results = new Map<string, MarketRollingAverages>();
    const errors = new Map<string, string>();

    for (const marketId of marketIds) {
      try {
        const result = this.getRollingAverages(marketId, options);
        if (result) {
          results.set(marketId, result);
        } else {
          errors.set(marketId, "No data available");
        }
      } catch (error) {
        errors.set(marketId, error instanceof Error ? error.message : "Unknown error");
      }
    }

    return {
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary across all tracked markets
   */
  getSummary(options?: GetRollingAveragesOptions): RollingAveragesSummary {
    const marketIds = Array.from(this.marketBuffers.keys());

    if (marketIds.length === 0) {
      return {
        totalMarkets: 0,
        reliableMarkets: 0,
        averageVolumeByWindow: {} as Record<RollingWindow, number>,
        topMarketsByWindow: {} as Record<RollingWindow, Array<{ marketId: string; averageVolumePerMinute: number }>>,
        abnormalVolumeMarkets: [],
      };
    }

    const batchResult = this.getBatchRollingAverages(marketIds, options);
    const allAverages = Array.from(batchResult.results.values());

    // Calculate average volume by window
    const averageVolumeByWindow: Record<RollingWindow, number> = {} as Record<RollingWindow, number>;
    const topMarketsByWindow: Record<RollingWindow, Array<{ marketId: string; averageVolumePerMinute: number }>> = {} as Record<RollingWindow, Array<{ marketId: string; averageVolumePerMinute: number }>>;
    const abnormalVolumeMarkets: Array<{
      marketId: string;
      window: RollingWindow;
      zScore: number;
      isHigh: boolean;
    }> = [];

    let reliableMarkets = 0;

    for (const window of this.windows) {
      const windowAverages = allAverages.map((avg) => ({
        marketId: avg.marketId,
        result: avg.windowResults[window],
      }));

      // Calculate overall average
      const totalVolume = windowAverages.reduce(
        (sum, wa) => sum + (wa.result?.averageVolumePerMinute ?? 0),
        0
      );
      averageVolumeByWindow[window] = windowAverages.length > 0
        ? totalVolume / windowAverages.length
        : 0;

      // Get top markets
      const sorted = windowAverages
        .filter((wa) => wa.result?.isReliable)
        .sort((a, b) => (b.result?.averageVolumePerMinute ?? 0) - (a.result?.averageVolumePerMinute ?? 0))
        .slice(0, 10);

      topMarketsByWindow[window] = sorted.map((wa) => ({
        marketId: wa.marketId,
        averageVolumePerMinute: wa.result?.averageVolumePerMinute ?? 0,
      }));

      // Check for abnormal volumes
      const mean = averageVolumeByWindow[window];
      if (mean > 0) {
        const volumes = windowAverages.map((wa) => wa.result?.averageVolumePerMinute ?? 0);
        const stdDev = calculateStdDev(volumes, mean);

        if (stdDev > 0) {
          for (const wa of windowAverages) {
            const vol = wa.result?.averageVolumePerMinute ?? 0;
            const zScore = (vol - mean) / stdDev;
            if (Math.abs(zScore) >= this.breachZScoreThreshold) {
              abnormalVolumeMarkets.push({
                marketId: wa.marketId,
                window,
                zScore,
                isHigh: zScore > 0,
              });
            }
          }
        }
      }
    }

    // Count reliable markets (at least one window is reliable)
    for (const avg of allAverages) {
      const hasReliableWindow = this.windows.some((w) => avg.windowResults[w]?.isReliable);
      if (hasReliableWindow) {
        reliableMarkets++;
      }
    }

    return {
      totalMarkets: marketIds.length,
      reliableMarkets,
      averageVolumeByWindow,
      topMarketsByWindow,
      abnormalVolumeMarkets,
    };
  }

  /**
   * Get current average for a specific window
   */
  getCurrentAverage(marketId: string, window: RollingWindow): number {
    const averages = this.getRollingAverages(marketId, { windows: [window] });
    return averages?.windowResults[window]?.averageVolumePerMinute ?? 0;
  }

  /**
   * Check if volume is above threshold
   */
  isVolumeAboveThreshold(
    marketId: string,
    volume: number,
    window: RollingWindow,
    multiplier: number = 2
  ): boolean {
    const averages = this.getRollingAverages(marketId, { windows: [window] });
    if (!averages || !averages.windowResults[window]?.isReliable) {
      return false;
    }

    const windowResult = averages.windowResults[window];
    const threshold = windowResult.averageVolumePerMinute + multiplier * windowResult.standardDeviation;
    return volume > threshold;
  }

  /**
   * Check if volume is below threshold
   */
  isVolumeBelowThreshold(
    marketId: string,
    volume: number,
    window: RollingWindow,
    multiplier: number = 2
  ): boolean {
    const averages = this.getRollingAverages(marketId, { windows: [window] });
    if (!averages || !averages.windowResults[window]?.isReliable) {
      return false;
    }

    const windowResult = averages.windowResults[window];
    const threshold = windowResult.averageVolumePerMinute - multiplier * windowResult.standardDeviation;
    return volume < threshold && volume >= 0;
  }

  /**
   * Calculate z-score for a volume against the rolling average
   */
  calculateZScore(marketId: string, volume: number, window: RollingWindow): number | null {
    const averages = this.getRollingAverages(marketId, { windows: [window] });
    if (!averages || !averages.windowResults[window]?.isReliable) {
      return null;
    }

    const windowResult = averages.windowResults[window];
    if (windowResult.standardDeviation === 0) {
      return 0;
    }

    return (volume - windowResult.averageVolumePerMinute) / windowResult.standardDeviation;
  }

  /**
   * Get all tracked market IDs
   */
  getTrackedMarkets(): string[] {
    return Array.from(this.marketBuffers.keys());
  }

  /**
   * Check if a market is being tracked
   */
  isTrackingMarket(marketId: string): boolean {
    return this.marketBuffers.has(marketId);
  }

  /**
   * Get data point count for a market
   */
  getDataPointCount(marketId: string): number {
    return this.marketBuffers.get(marketId)?.getCount() ?? 0;
  }

  /**
   * Clear data for a specific market
   */
  clearMarket(marketId: string): boolean {
    const deleted = this.marketBuffers.delete(marketId);
    this.recentAverages.delete(marketId);

    if (deleted && this.enableEvents) {
      this.emit("dataCleared", marketId);
    }

    return deleted;
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    const marketIds = Array.from(this.marketBuffers.keys());
    this.marketBuffers.clear();
    this.recentAverages.clear();

    if (this.enableEvents) {
      for (const marketId of marketIds) {
        this.emit("dataCleared", marketId);
      }
    }
  }

  /**
   * Get tracker statistics
   */
  getStats(): {
    trackedMarkets: number;
    totalDataPoints: number;
    windows: RollingWindow[];
    maxDataPoints: number;
    dataPointIntervalMs: number;
    minDataDensity: number;
    enableEvents: boolean;
    breachZScoreThreshold: number;
  } {
    let totalDataPoints = 0;
    for (const buffer of this.marketBuffers.values()) {
      totalDataPoints += buffer.getCount();
    }

    return {
      trackedMarkets: this.marketBuffers.size,
      totalDataPoints,
      windows: this.windows,
      maxDataPoints: this.maxDataPoints,
      dataPointIntervalMs: this.dataPointIntervalMs,
      minDataDensity: this.minDataDensity,
      enableEvents: this.enableEvents,
      breachZScoreThreshold: this.breachZScoreThreshold,
    };
  }

  /**
   * Export all data for a market (for persistence/debugging)
   */
  exportMarketData(marketId: string): VolumeDataEntry[] {
    return this.marketBuffers.get(marketId)?.getAll() ?? [];
  }

  /**
   * Import data for a market (for restoration from persistence)
   */
  importMarketData(marketId: string, entries: VolumeDataEntry[]): void {
    // Sort by timestamp
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    // Clear existing data
    this.clearMarket(marketId);

    // Add all entries
    for (const entry of sorted) {
      this.addVolume(marketId, entry.volume, {
        timestamp: entry.timestamp,
        tradeCount: entry.tradeCount,
        price: entry.price,
      });
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Check for threshold breach and emit event
   */
  private checkForBreach(marketId: string, entry: VolumeDataEntry): void {
    if (!this.enableEvents) return;

    // Get stored averages
    let marketAverages = this.recentAverages.get(marketId);
    if (!marketAverages) {
      marketAverages = new Map();
      this.recentAverages.set(marketId, marketAverages);
    }

    // Check each window
    for (const window of this.windows) {
      const averages = this.getRollingAverages(marketId, { windows: [window] });
      if (!averages || !averages.windowResults[window]?.isReliable) {
        continue;
      }

      const windowResult = averages.windowResults[window];
      const previousAvg = marketAverages.get(window);

      // Update stored average
      marketAverages.set(window, windowResult.averageVolumePerMinute);

      // Only check if we have a previous average to compare
      if (previousAvg === undefined || windowResult.standardDeviation === 0) {
        continue;
      }

      // Calculate z-score based on current entry vs rolling average
      const zScore = (entry.volume - windowResult.averageVolumePerMinute) / windowResult.standardDeviation;

      if (Math.abs(zScore) >= this.breachZScoreThreshold) {
        const breach: VolumeThresholdBreach = {
          marketId,
          window,
          currentVolume: entry.volume,
          threshold: windowResult.averageVolumePerMinute +
            (zScore > 0 ? 1 : -1) * this.breachZScoreThreshold * windowResult.standardDeviation,
          isHigh: zScore > 0,
          zScore,
          timestamp: new Date(entry.timestamp),
        };

        this.emit("thresholdBreach", breach);
      }
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedTracker: RollingVolumeTracker | null = null;

/**
 * Create a new RollingVolumeTracker instance
 */
export function createRollingVolumeTracker(
  config?: RollingVolumeTrackerConfig
): RollingVolumeTracker {
  return new RollingVolumeTracker(config);
}

/**
 * Get the shared RollingVolumeTracker instance
 */
export function getSharedRollingVolumeTracker(): RollingVolumeTracker {
  if (!sharedTracker) {
    sharedTracker = new RollingVolumeTracker();
  }
  return sharedTracker;
}

/**
 * Set the shared RollingVolumeTracker instance
 */
export function setSharedRollingVolumeTracker(tracker: RollingVolumeTracker): void {
  sharedTracker = tracker;
}

/**
 * Reset the shared RollingVolumeTracker instance
 */
export function resetSharedRollingVolumeTracker(): void {
  if (sharedTracker) {
    sharedTracker.clearAll();
    sharedTracker.removeAllListeners();
  }
  sharedTracker = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add volume data point (convenience function)
 */
export function addVolumeData(
  marketId: string,
  volume: number,
  options?: AddVolumeOptions & { tracker?: RollingVolumeTracker }
): void {
  const tracker = options?.tracker ?? getSharedRollingVolumeTracker();
  tracker.addVolume(marketId, volume, options);
}

/**
 * Get rolling averages for a market (convenience function)
 */
export function getMarketRollingAverages(
  marketId: string,
  options?: GetRollingAveragesOptions & { tracker?: RollingVolumeTracker }
): MarketRollingAverages | null {
  const tracker = options?.tracker ?? getSharedRollingVolumeTracker();
  return tracker.getRollingAverages(marketId, options);
}

/**
 * Get rolling averages for multiple markets (convenience function)
 */
export function batchGetRollingAverages(
  marketIds: string[],
  options?: GetRollingAveragesOptions & { tracker?: RollingVolumeTracker }
): BatchRollingAveragesResult {
  const tracker = options?.tracker ?? getSharedRollingVolumeTracker();
  return tracker.getBatchRollingAverages(marketIds, options);
}

/**
 * Check if volume is anomalous (convenience function)
 */
export function isVolumeAnomalous(
  marketId: string,
  volume: number,
  window: RollingWindow = RollingWindow.ONE_HOUR,
  options?: { tracker?: RollingVolumeTracker; multiplier?: number }
): { isAnomalous: boolean; isHigh: boolean | null; zScore: number | null } {
  const tracker = options?.tracker ?? getSharedRollingVolumeTracker();
  const multiplier = options?.multiplier ?? 2;

  const zScore = tracker.calculateZScore(marketId, volume, window);
  if (zScore === null) {
    return { isAnomalous: false, isHigh: null, zScore: null };
  }

  const isAnomalous = Math.abs(zScore) >= multiplier;
  return {
    isAnomalous,
    isHigh: isAnomalous ? zScore > 0 : null,
    zScore,
  };
}

/**
 * Get summary across all tracked markets (convenience function)
 */
export function getRollingVolumesSummary(
  options?: GetRollingAveragesOptions & { tracker?: RollingVolumeTracker }
): RollingAveragesSummary {
  const tracker = options?.tracker ?? getSharedRollingVolumeTracker();
  return tracker.getSummary(options);
}
