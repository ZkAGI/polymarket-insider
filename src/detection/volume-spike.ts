/**
 * Volume Spike Detector (DET-VOL-003)
 *
 * Detect sudden spikes in trading volume above threshold for market anomaly detection.
 *
 * Features:
 * - Compare current volume to rolling baseline
 * - Configurable spike thresholds (z-score based and percentage based)
 * - Detect sustained vs momentary spikes
 * - Event emission for spike detection
 * - Support for multiple time windows
 * - Cooldown period to prevent alert fatigue
 */

import { EventEmitter } from "events";
import {
  RollingVolumeTracker,
  RollingWindow,
  getSharedRollingVolumeTracker,
} from "./rolling-volume";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of volume spike detected
 */
export enum VolumeSpikeType {
  /** Momentary spike (single data point) */
  MOMENTARY = "MOMENTARY",
  /** Sustained spike (multiple consecutive data points) */
  SUSTAINED = "SUSTAINED",
  /** Sudden spike (rapid increase) */
  SUDDEN = "SUDDEN",
  /** Gradual spike (slow buildup) */
  GRADUAL = "GRADUAL",
}

/**
 * Severity level of the spike
 */
export enum SpikeSeverity {
  /** Low severity - minor deviation */
  LOW = "LOW",
  /** Medium severity - notable deviation */
  MEDIUM = "MEDIUM",
  /** High severity - significant deviation */
  HIGH = "HIGH",
  /** Critical severity - extreme deviation */
  CRITICAL = "CRITICAL",
}

/**
 * Direction of the spike
 */
export enum SpikeDirection {
  /** Volume increased above normal */
  UP = "UP",
  /** Volume decreased below normal */
  DOWN = "DOWN",
}

/**
 * Configuration for spike thresholds
 */
export interface SpikeThresholdConfig {
  /** Z-score threshold for LOW severity (default: 2.0) */
  lowZScoreThreshold: number;

  /** Z-score threshold for MEDIUM severity (default: 2.5) */
  mediumZScoreThreshold: number;

  /** Z-score threshold for HIGH severity (default: 3.0) */
  highZScoreThreshold: number;

  /** Z-score threshold for CRITICAL severity (default: 4.0) */
  criticalZScoreThreshold: number;

  /** Percentage threshold for LOW severity (default: 150% of baseline) */
  lowPercentageThreshold: number;

  /** Percentage threshold for MEDIUM severity (default: 200% of baseline) */
  mediumPercentageThreshold: number;

  /** Percentage threshold for HIGH severity (default: 300% of baseline) */
  highPercentageThreshold: number;

  /** Percentage threshold for CRITICAL severity (default: 500% of baseline) */
  criticalPercentageThreshold: number;
}

/**
 * Configuration for sustained spike detection
 */
export interface SustainedSpikeConfig {
  /** Minimum duration in minutes for sustained spike (default: 5) */
  minDurationMinutes: number;

  /** Maximum gap between data points before resetting (default: 2 minutes) */
  maxGapMinutes: number;

  /** Minimum consecutive data points for sustained spike (default: 3) */
  minConsecutivePoints: number;
}

/**
 * Volume spike event data
 */
export interface VolumeSpikeEvent {
  /** Unique event ID */
  eventId: string;

  /** Market ID where spike occurred */
  marketId: string;

  /** Type of spike */
  spikeType: VolumeSpikeType;

  /** Severity of the spike */
  severity: SpikeSeverity;

  /** Direction of the spike */
  direction: SpikeDirection;

  /** Time window where spike was detected */
  window: RollingWindow;

  /** Current volume value */
  currentVolume: number;

  /** Baseline (average) volume */
  baselineVolume: number;

  /** Standard deviation of baseline */
  baselineStdDev: number;

  /** Z-score of current volume */
  zScore: number;

  /** Percentage of baseline */
  percentageOfBaseline: number;

  /** Timestamp when spike was detected */
  detectedAt: Date;

  /** Spike start time (for sustained spikes) */
  startTime: Date;

  /** Duration in minutes (for sustained spikes) */
  durationMinutes: number;

  /** Number of consecutive spike data points */
  consecutivePoints: number;

  /** Peak volume during spike */
  peakVolume: number;

  /** Additional context */
  context: {
    /** Whether this is a recurring spike */
    isRecurring: boolean;
    /** Previous spike time if recurring */
    previousSpikeTime: Date | null;
    /** Number of spikes in last hour */
    spikesLastHour: number;
    /** Data reliability score */
    dataReliability: number;
  };
}

/**
 * Spike detection result for a single check
 */
export interface SpikeDetectionResult {
  /** Market ID checked */
  marketId: string;

  /** Whether a spike was detected */
  isSpike: boolean;

  /** Spike event if detected */
  spikeEvent: VolumeSpikeEvent | null;

  /** Current volume checked */
  currentVolume: number;

  /** Baseline statistics */
  baseline: {
    average: number;
    stdDev: number;
    isReliable: boolean;
  };

  /** Z-score of current volume */
  zScore: number | null;

  /** Percentage of baseline */
  percentageOfBaseline: number | null;

  /** Time of check */
  checkedAt: Date;

  /** Window used for detection */
  window: RollingWindow;
}

/**
 * Configuration for VolumeSpikeDetector
 */
export interface VolumeSpikeDetectorConfig {
  /** Spike threshold configuration */
  thresholds?: Partial<SpikeThresholdConfig>;

  /** Sustained spike configuration */
  sustainedConfig?: Partial<SustainedSpikeConfig>;

  /** Primary window for spike detection (default: 5 minutes) */
  primaryWindow?: RollingWindow;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown period in milliseconds between alerts for same market (default: 60000 = 1 minute) */
  cooldownMs?: number;

  /** Use z-score based detection (default: true) */
  useZScoreDetection?: boolean;

  /** Use percentage based detection (default: true) */
  usePercentageDetection?: boolean;

  /** Minimum data density for reliable detection (default: 0.3) */
  minDataDensity?: number;

  /** RollingVolumeTracker to use (default: shared instance) */
  volumeTracker?: RollingVolumeTracker;
}

/**
 * Options for spike detection
 */
export interface DetectSpikeOptions {
  /** Override the time window */
  window?: RollingWindow;

  /** Current timestamp override */
  timestamp?: number;

  /** Bypass cooldown check */
  bypassCooldown?: boolean;
}

/**
 * Batch spike detection result
 */
export interface BatchSpikeDetectionResult {
  /** Results by market ID */
  results: Map<string, SpikeDetectionResult>;

  /** Markets with detected spikes */
  spikesDetected: string[];

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Spike detection summary across markets
 */
export interface SpikeDetectionSummary {
  /** Total markets analyzed */
  totalMarkets: number;

  /** Markets with active spikes */
  marketsWithSpikes: number;

  /** Total spikes detected */
  totalSpikes: number;

  /** Spikes by severity */
  bySeverity: Record<SpikeSeverity, number>;

  /** Spikes by type */
  byType: Record<VolumeSpikeType, number>;

  /** Recent spike events */
  recentSpikes: VolumeSpikeEvent[];

  /** Markets with most frequent spikes */
  frequentSpikeMarkets: Array<{
    marketId: string;
    spikeCount: number;
    lastSpikeTime: Date;
  }>;
}

/**
 * Tracked spike state for a market
 */
interface MarketSpikeState {
  /** Currently in spike state */
  inSpike: boolean;

  /** Current spike start time */
  spikeStartTime: number | null;

  /** Consecutive spike points */
  consecutivePoints: number;

  /** Peak volume during current spike */
  peakVolume: number;

  /** Last spike detection time */
  lastSpikeTime: number | null;

  /** Recent spike times for frequency tracking */
  recentSpikeTimes: number[];

  /** Last check time */
  lastCheckTime: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default spike threshold configuration */
export const DEFAULT_SPIKE_THRESHOLDS: SpikeThresholdConfig = {
  lowZScoreThreshold: 2.0,
  mediumZScoreThreshold: 2.5,
  highZScoreThreshold: 3.0,
  criticalZScoreThreshold: 4.0,
  lowPercentageThreshold: 1.5, // 150% of baseline
  mediumPercentageThreshold: 2.0, // 200% of baseline
  highPercentageThreshold: 3.0, // 300% of baseline
  criticalPercentageThreshold: 5.0, // 500% of baseline
};

/** Default sustained spike configuration */
export const DEFAULT_SUSTAINED_CONFIG: SustainedSpikeConfig = {
  minDurationMinutes: 5,
  maxGapMinutes: 2,
  minConsecutivePoints: 3,
};

/** Default cooldown period in milliseconds */
const DEFAULT_COOLDOWN_MS = 60 * 1000; // 1 minute

/** Default minimum data density */
const DEFAULT_MIN_DATA_DENSITY = 0.3;

/** Recent spike window for frequency tracking (1 hour) */
const SPIKE_FREQUENCY_WINDOW_MS = 60 * 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `spike_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine spike severity from z-score
 */
function getSeverityFromZScore(
  zScore: number,
  thresholds: SpikeThresholdConfig
): SpikeSeverity | null {
  const absZScore = Math.abs(zScore);

  if (absZScore >= thresholds.criticalZScoreThreshold) {
    return SpikeSeverity.CRITICAL;
  }
  if (absZScore >= thresholds.highZScoreThreshold) {
    return SpikeSeverity.HIGH;
  }
  if (absZScore >= thresholds.mediumZScoreThreshold) {
    return SpikeSeverity.MEDIUM;
  }
  if (absZScore >= thresholds.lowZScoreThreshold) {
    return SpikeSeverity.LOW;
  }

  return null;
}

/**
 * Determine spike severity from percentage
 */
function getSeverityFromPercentage(
  percentage: number,
  thresholds: SpikeThresholdConfig
): SpikeSeverity | null {
  // For high volume spikes
  if (percentage >= thresholds.criticalPercentageThreshold) {
    return SpikeSeverity.CRITICAL;
  }
  if (percentage >= thresholds.highPercentageThreshold) {
    return SpikeSeverity.HIGH;
  }
  if (percentage >= thresholds.mediumPercentageThreshold) {
    return SpikeSeverity.MEDIUM;
  }
  if (percentage >= thresholds.lowPercentageThreshold) {
    return SpikeSeverity.LOW;
  }

  // For low volume dips (inverse thresholds)
  if (percentage > 0 && percentage <= 1 / thresholds.criticalPercentageThreshold) {
    return SpikeSeverity.CRITICAL;
  }
  if (percentage > 0 && percentage <= 1 / thresholds.highPercentageThreshold) {
    return SpikeSeverity.HIGH;
  }
  if (percentage > 0 && percentage <= 1 / thresholds.mediumPercentageThreshold) {
    return SpikeSeverity.MEDIUM;
  }
  if (percentage > 0 && percentage <= 1 / thresholds.lowPercentageThreshold) {
    return SpikeSeverity.LOW;
  }

  return null;
}

/**
 * Get the higher severity of two
 */
function getHigherSeverity(
  s1: SpikeSeverity | null,
  s2: SpikeSeverity | null
): SpikeSeverity | null {
  const severityOrder: SpikeSeverity[] = [
    SpikeSeverity.LOW,
    SpikeSeverity.MEDIUM,
    SpikeSeverity.HIGH,
    SpikeSeverity.CRITICAL,
  ];

  if (s1 === null) return s2;
  if (s2 === null) return s1;

  const i1 = severityOrder.indexOf(s1);
  const i2 = severityOrder.indexOf(s2);

  return i1 >= i2 ? s1 : s2;
}

/**
 * Determine spike type based on state
 */
function determineSpikeType(
  state: MarketSpikeState,
  currentTime: number,
  sustainedConfig: SustainedSpikeConfig
): VolumeSpikeType {
  // Check if sustained (long duration with consecutive points)
  if (
    state.consecutivePoints >= sustainedConfig.minConsecutivePoints &&
    state.spikeStartTime !== null
  ) {
    const durationMinutes = (currentTime - state.spikeStartTime) / (60 * 1000);
    if (durationMinutes >= sustainedConfig.minDurationMinutes) {
      return VolumeSpikeType.SUSTAINED;
    }
  }

  // Check if it's a sudden spike (rapid change)
  if (state.consecutivePoints <= 2 && state.lastCheckTime) {
    const timeSinceLastCheck = currentTime - state.lastCheckTime;
    if (timeSinceLastCheck < 30 * 1000) {
      // Within 30 seconds
      return VolumeSpikeType.SUDDEN;
    }
  }

  // Check if gradual (building up over time)
  if (state.consecutivePoints > 2 && state.consecutivePoints < sustainedConfig.minConsecutivePoints) {
    return VolumeSpikeType.GRADUAL;
  }

  return VolumeSpikeType.MOMENTARY;
}

// ============================================================================
// VolumeSpikeDetector Class
// ============================================================================

/**
 * Event types emitted by VolumeSpikeDetector
 */
export interface VolumeSpikeDetectorEvents {
  spikeDetected: (event: VolumeSpikeEvent) => void;
  spikeEnded: (marketId: string, duration: number) => void;
  sustainedSpike: (event: VolumeSpikeEvent) => void;
}

/**
 * Detector for volume spikes and anomalies
 */
export class VolumeSpikeDetector extends EventEmitter {
  private readonly thresholds: SpikeThresholdConfig;
  private readonly sustainedConfig: SustainedSpikeConfig;
  private readonly primaryWindow: RollingWindow;
  private readonly enableEvents: boolean;
  private readonly cooldownMs: number;
  private readonly useZScoreDetection: boolean;
  private readonly usePercentageDetection: boolean;
  private readonly minDataDensity: number;
  private readonly volumeTracker: RollingVolumeTracker;

  // Market spike states
  private readonly marketStates: Map<string, MarketSpikeState> = new Map();

  // Recent spike events
  private readonly recentSpikes: VolumeSpikeEvent[] = [];
  private readonly maxRecentSpikes = 100;

  constructor(config?: VolumeSpikeDetectorConfig) {
    super();

    this.thresholds = {
      ...DEFAULT_SPIKE_THRESHOLDS,
      ...config?.thresholds,
    };

    this.sustainedConfig = {
      ...DEFAULT_SUSTAINED_CONFIG,
      ...config?.sustainedConfig,
    };

    this.primaryWindow = config?.primaryWindow ?? RollingWindow.FIVE_MINUTES;
    this.enableEvents = config?.enableEvents ?? true;
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.useZScoreDetection = config?.useZScoreDetection ?? true;
    this.usePercentageDetection = config?.usePercentageDetection ?? true;
    this.minDataDensity = config?.minDataDensity ?? DEFAULT_MIN_DATA_DENSITY;
    this.volumeTracker = config?.volumeTracker ?? getSharedRollingVolumeTracker();
  }

  /**
   * Check if current volume represents a spike
   */
  detectSpike(
    marketId: string,
    currentVolume: number,
    options?: DetectSpikeOptions
  ): SpikeDetectionResult {
    const now = options?.timestamp ?? Date.now();
    const window = options?.window ?? this.primaryWindow;

    // Get rolling averages from volume tracker
    const averages = this.volumeTracker.getRollingAverages(marketId, {
      windows: [window],
      asOf: now,
    });

    const windowResult = averages?.windowResults[window];

    // If no data or unreliable, return no spike
    if (
      !windowResult ||
      !windowResult.isReliable ||
      windowResult.dataDensity < this.minDataDensity
    ) {
      return {
        marketId,
        isSpike: false,
        spikeEvent: null,
        currentVolume,
        baseline: {
          average: windowResult?.averageVolumePerMinute ?? 0,
          stdDev: windowResult?.standardDeviation ?? 0,
          isReliable: false,
        },
        zScore: null,
        percentageOfBaseline: null,
        checkedAt: new Date(now),
        window,
      };
    }

    // Calculate metrics
    const baselineAvg = windowResult.averageVolumePerMinute;
    const baselineStdDev = windowResult.standardDeviation;

    let zScore: number | null = null;
    let percentageOfBaseline: number | null = null;

    // Calculate z-score if standard deviation is non-zero
    if (baselineStdDev > 0) {
      zScore = (currentVolume - baselineAvg) / baselineStdDev;
    }

    // Calculate percentage of baseline
    if (baselineAvg > 0) {
      percentageOfBaseline = currentVolume / baselineAvg;
    }

    // Determine severity from z-score and percentage
    let severity: SpikeSeverity | null = null;

    if (this.useZScoreDetection && zScore !== null) {
      severity = getSeverityFromZScore(zScore, this.thresholds);
    }

    if (this.usePercentageDetection && percentageOfBaseline !== null) {
      const percentageSeverity = getSeverityFromPercentage(
        percentageOfBaseline,
        this.thresholds
      );
      severity = getHigherSeverity(severity, percentageSeverity);
    }

    // Not a spike
    if (severity === null) {
      // Check if we were in a spike and it's now ending
      const state = this.getOrCreateState(marketId);
      if (state.inSpike) {
        this.handleSpikeEnd(marketId, state, now);
      }

      return {
        marketId,
        isSpike: false,
        spikeEvent: null,
        currentVolume,
        baseline: {
          average: baselineAvg,
          stdDev: baselineStdDev,
          isReliable: windowResult.isReliable,
        },
        zScore,
        percentageOfBaseline,
        checkedAt: new Date(now),
        window,
      };
    }

    // Check cooldown
    const state = this.getOrCreateState(marketId);
    if (
      !options?.bypassCooldown &&
      state.lastSpikeTime !== null &&
      now - state.lastSpikeTime < this.cooldownMs
    ) {
      // Still in cooldown, update state but don't emit new event
      this.updateSpikeState(state, currentVolume, now);

      return {
        marketId,
        isSpike: true,
        spikeEvent: null, // No new event due to cooldown
        currentVolume,
        baseline: {
          average: baselineAvg,
          stdDev: baselineStdDev,
          isReliable: windowResult.isReliable,
        },
        zScore,
        percentageOfBaseline,
        checkedAt: new Date(now),
        window,
      };
    }

    // Update spike state
    this.updateSpikeState(state, currentVolume, now);

    // Determine spike type
    const spikeType = determineSpikeType(state, now, this.sustainedConfig);

    // Determine direction
    const direction = currentVolume > baselineAvg ? SpikeDirection.UP : SpikeDirection.DOWN;

    // Calculate spike duration
    const durationMinutes = state.spikeStartTime !== null
      ? (now - state.spikeStartTime) / (60 * 1000)
      : 0;

    // Create spike event
    const spikeEvent: VolumeSpikeEvent = {
      eventId: generateEventId(),
      marketId,
      spikeType,
      severity,
      direction,
      window,
      currentVolume,
      baselineVolume: baselineAvg,
      baselineStdDev,
      zScore: zScore ?? 0,
      percentageOfBaseline: percentageOfBaseline ?? 0,
      detectedAt: new Date(now),
      startTime: new Date(state.spikeStartTime ?? now),
      durationMinutes,
      consecutivePoints: state.consecutivePoints,
      peakVolume: state.peakVolume,
      context: {
        isRecurring: state.recentSpikeTimes.length > 1,
        previousSpikeTime: state.recentSpikeTimes.length > 1
          ? new Date(state.recentSpikeTimes[state.recentSpikeTimes.length - 2] as number)
          : null,
        spikesLastHour: state.recentSpikeTimes.filter(
          (t) => now - t < SPIKE_FREQUENCY_WINDOW_MS
        ).length,
        dataReliability: windowResult.dataDensity,
      },
    };

    // Update last spike time
    state.lastSpikeTime = now;
    state.recentSpikeTimes.push(now);

    // Clean old spike times
    state.recentSpikeTimes = state.recentSpikeTimes.filter(
      (t) => now - t < SPIKE_FREQUENCY_WINDOW_MS
    );

    // Store recent spike
    this.addRecentSpike(spikeEvent);

    // Emit events
    if (this.enableEvents) {
      this.emit("spikeDetected", spikeEvent);

      if (spikeType === VolumeSpikeType.SUSTAINED) {
        this.emit("sustainedSpike", spikeEvent);
      }
    }

    return {
      marketId,
      isSpike: true,
      spikeEvent,
      currentVolume,
      baseline: {
        average: baselineAvg,
        stdDev: baselineStdDev,
        isReliable: windowResult.isReliable,
      },
      zScore,
      percentageOfBaseline,
      checkedAt: new Date(now),
      window,
    };
  }

  /**
   * Detect spikes for multiple markets
   */
  batchDetectSpikes(
    volumeData: Array<{ marketId: string; volume: number }>,
    options?: DetectSpikeOptions
  ): BatchSpikeDetectionResult {
    const startTime = Date.now();
    const results = new Map<string, SpikeDetectionResult>();
    const spikesDetected: string[] = [];

    for (const { marketId, volume } of volumeData) {
      const result = this.detectSpike(marketId, volume, options);
      results.set(marketId, result);

      if (result.isSpike && result.spikeEvent) {
        spikesDetected.push(marketId);
      }
    }

    return {
      results,
      spikesDetected,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a market is currently in a spike state
   */
  isInSpikeState(marketId: string): boolean {
    return this.marketStates.get(marketId)?.inSpike ?? false;
  }

  /**
   * Get current spike state for a market
   */
  getSpikeState(marketId: string): {
    inSpike: boolean;
    durationMinutes: number;
    consecutivePoints: number;
    peakVolume: number;
    lastSpikeTime: Date | null;
    spikesLastHour: number;
  } | null {
    const state = this.marketStates.get(marketId);
    if (!state) return null;

    const now = Date.now();

    return {
      inSpike: state.inSpike,
      durationMinutes: state.spikeStartTime !== null
        ? (now - state.spikeStartTime) / (60 * 1000)
        : 0,
      consecutivePoints: state.consecutivePoints,
      peakVolume: state.peakVolume,
      lastSpikeTime: state.lastSpikeTime !== null ? new Date(state.lastSpikeTime) : null,
      spikesLastHour: state.recentSpikeTimes.filter(
        (t) => now - t < SPIKE_FREQUENCY_WINDOW_MS
      ).length,
    };
  }

  /**
   * Get summary of spike detection across all markets
   */
  getSummary(): SpikeDetectionSummary {
    const now = Date.now();

    // Count markets with spikes
    let marketsWithSpikes = 0;
    for (const state of this.marketStates.values()) {
      if (state.inSpike) {
        marketsWithSpikes++;
      }
    }

    // Count by severity and type
    const bySeverity: Record<SpikeSeverity, number> = {
      [SpikeSeverity.LOW]: 0,
      [SpikeSeverity.MEDIUM]: 0,
      [SpikeSeverity.HIGH]: 0,
      [SpikeSeverity.CRITICAL]: 0,
    };

    const byType: Record<VolumeSpikeType, number> = {
      [VolumeSpikeType.MOMENTARY]: 0,
      [VolumeSpikeType.SUSTAINED]: 0,
      [VolumeSpikeType.SUDDEN]: 0,
      [VolumeSpikeType.GRADUAL]: 0,
    };

    // Process recent spikes (last hour)
    const recentSpikes = this.recentSpikes.filter(
      (s) => now - s.detectedAt.getTime() < SPIKE_FREQUENCY_WINDOW_MS
    );

    for (const spike of recentSpikes) {
      bySeverity[spike.severity]++;
      byType[spike.spikeType]++;
    }

    // Find markets with most frequent spikes
    const spikeFrequency = new Map<string, { count: number; lastTime: number }>();
    for (const [marketId, state] of this.marketStates.entries()) {
      const recentCount = state.recentSpikeTimes.filter(
        (t) => now - t < SPIKE_FREQUENCY_WINDOW_MS
      ).length;
      if (recentCount > 0) {
        spikeFrequency.set(marketId, {
          count: recentCount,
          lastTime: Math.max(...state.recentSpikeTimes),
        });
      }
    }

    const frequentSpikeMarkets = Array.from(spikeFrequency.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([marketId, data]) => ({
        marketId,
        spikeCount: data.count,
        lastSpikeTime: new Date(data.lastTime),
      }));

    return {
      totalMarkets: this.marketStates.size,
      marketsWithSpikes,
      totalSpikes: recentSpikes.length,
      bySeverity,
      byType,
      recentSpikes: recentSpikes.slice(0, 20),
      frequentSpikeMarkets,
    };
  }

  /**
   * Get recent spike events
   */
  getRecentSpikes(limit: number = 20): VolumeSpikeEvent[] {
    return this.recentSpikes.slice(0, limit);
  }

  /**
   * Get spike events for a specific market
   */
  getMarketSpikes(marketId: string, limit: number = 10): VolumeSpikeEvent[] {
    return this.recentSpikes
      .filter((s) => s.marketId === marketId)
      .slice(0, limit);
  }

  /**
   * Get thresholds configuration
   */
  getThresholds(): SpikeThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Get sustained spike configuration
   */
  getSustainedConfig(): SustainedSpikeConfig {
    return { ...this.sustainedConfig };
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    trackedMarkets: number;
    marketsInSpike: number;
    totalRecentSpikes: number;
    primaryWindow: RollingWindow;
    cooldownMs: number;
    useZScoreDetection: boolean;
    usePercentageDetection: boolean;
    minDataDensity: number;
  } {
    let marketsInSpike = 0;
    for (const state of this.marketStates.values()) {
      if (state.inSpike) {
        marketsInSpike++;
      }
    }

    return {
      trackedMarkets: this.marketStates.size,
      marketsInSpike,
      totalRecentSpikes: this.recentSpikes.length,
      primaryWindow: this.primaryWindow,
      cooldownMs: this.cooldownMs,
      useZScoreDetection: this.useZScoreDetection,
      usePercentageDetection: this.usePercentageDetection,
      minDataDensity: this.minDataDensity,
    };
  }

  /**
   * Clear state for a specific market
   */
  clearMarket(marketId: string): boolean {
    return this.marketStates.delete(marketId);
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.marketStates.clear();
    this.recentSpikes.length = 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get or create spike state for a market
   */
  private getOrCreateState(marketId: string): MarketSpikeState {
    let state = this.marketStates.get(marketId);
    if (!state) {
      state = {
        inSpike: false,
        spikeStartTime: null,
        consecutivePoints: 0,
        peakVolume: 0,
        lastSpikeTime: null,
        recentSpikeTimes: [],
        lastCheckTime: Date.now(),
      };
      this.marketStates.set(marketId, state);
    }
    return state;
  }

  /**
   * Update spike state with new data point
   */
  private updateSpikeState(
    state: MarketSpikeState,
    volume: number,
    timestamp: number
  ): void {
    const timeSinceLastCheck = timestamp - state.lastCheckTime;
    const maxGapMs = this.sustainedConfig.maxGapMinutes * 60 * 1000;

    // Check if we should reset due to gap
    if (state.inSpike && timeSinceLastCheck > maxGapMs) {
      // Reset spike state due to gap
      state.consecutivePoints = 1;
      state.spikeStartTime = timestamp;
      state.peakVolume = volume;
    } else if (!state.inSpike) {
      // Start new spike
      state.inSpike = true;
      state.spikeStartTime = timestamp;
      state.consecutivePoints = 1;
      state.peakVolume = volume;
    } else {
      // Continue existing spike
      state.consecutivePoints++;
      state.peakVolume = Math.max(state.peakVolume, volume);
    }

    state.lastCheckTime = timestamp;
  }

  /**
   * Handle spike end
   */
  private handleSpikeEnd(marketId: string, state: MarketSpikeState, timestamp: number): void {
    if (!state.inSpike) return;

    const duration = state.spikeStartTime !== null
      ? (timestamp - state.spikeStartTime) / (60 * 1000)
      : 0;

    state.inSpike = false;
    state.spikeStartTime = null;
    state.consecutivePoints = 0;
    state.peakVolume = 0;

    if (this.enableEvents) {
      this.emit("spikeEnded", marketId, duration);
    }
  }

  /**
   * Add spike to recent spikes list
   */
  private addRecentSpike(spike: VolumeSpikeEvent): void {
    this.recentSpikes.unshift(spike);

    // Keep only maxRecentSpikes
    if (this.recentSpikes.length > this.maxRecentSpikes) {
      this.recentSpikes.pop();
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedDetector: VolumeSpikeDetector | null = null;

/**
 * Create a new VolumeSpikeDetector instance
 */
export function createVolumeSpikeDetector(
  config?: VolumeSpikeDetectorConfig
): VolumeSpikeDetector {
  return new VolumeSpikeDetector(config);
}

/**
 * Get the shared VolumeSpikeDetector instance
 */
export function getSharedVolumeSpikeDetector(): VolumeSpikeDetector {
  if (!sharedDetector) {
    sharedDetector = new VolumeSpikeDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared VolumeSpikeDetector instance
 */
export function setSharedVolumeSpikeDetector(detector: VolumeSpikeDetector): void {
  sharedDetector = detector;
}

/**
 * Reset the shared VolumeSpikeDetector instance
 */
export function resetSharedVolumeSpikeDetector(): void {
  if (sharedDetector) {
    sharedDetector.clearAll();
    sharedDetector.removeAllListeners();
  }
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Detect volume spike (convenience function)
 */
export function detectVolumeSpike(
  marketId: string,
  volume: number,
  options?: DetectSpikeOptions & { detector?: VolumeSpikeDetector }
): SpikeDetectionResult {
  const detector = options?.detector ?? getSharedVolumeSpikeDetector();
  return detector.detectSpike(marketId, volume, options);
}

/**
 * Batch detect volume spikes (convenience function)
 */
export function batchDetectVolumeSpikes(
  volumeData: Array<{ marketId: string; volume: number }>,
  options?: DetectSpikeOptions & { detector?: VolumeSpikeDetector }
): BatchSpikeDetectionResult {
  const detector = options?.detector ?? getSharedVolumeSpikeDetector();
  return detector.batchDetectSpikes(volumeData, options);
}

/**
 * Check if market is in spike state (convenience function)
 */
export function isMarketInSpike(
  marketId: string,
  options?: { detector?: VolumeSpikeDetector }
): boolean {
  const detector = options?.detector ?? getSharedVolumeSpikeDetector();
  return detector.isInSpikeState(marketId);
}

/**
 * Get spike detection summary (convenience function)
 */
export function getSpikeDetectionSummary(
  options?: { detector?: VolumeSpikeDetector }
): SpikeDetectionSummary {
  const detector = options?.detector ?? getSharedVolumeSpikeDetector();
  return detector.getSummary();
}

/**
 * Get recent spikes (convenience function)
 */
export function getRecentVolumeSpikes(
  limit?: number,
  options?: { detector?: VolumeSpikeDetector }
): VolumeSpikeEvent[] {
  const detector = options?.detector ?? getSharedVolumeSpikeDetector();
  return detector.getRecentSpikes(limit);
}
