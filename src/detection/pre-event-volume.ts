/**
 * Pre-Event Volume Spike Detector (DET-VOL-012)
 *
 * Detect volume spikes before scheduled events to identify potential insider
 * trading or information asymmetry.
 *
 * Features:
 * - Track market event dates (end dates, resolution dates)
 * - Monitor pre-event volume patterns in configurable windows
 * - Compare current pre-event volume to historical pre-event behavior
 * - Flag unusual pre-event activity with severity levels
 * - Support for different event types and time windows
 * - Event emission for detected anomalies
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
 * Type of event being tracked
 */
export enum EventType {
  /** Market resolution/end date */
  RESOLUTION = "RESOLUTION",
  /** External scheduled event (e.g., election, announcement) */
  EXTERNAL_EVENT = "EXTERNAL_EVENT",
  /** Custom user-defined event */
  CUSTOM = "CUSTOM",
}

/**
 * Time window relative to event
 */
export enum PreEventWindow {
  /** 1 hour before event */
  ONE_HOUR = "ONE_HOUR",
  /** 4 hours before event */
  FOUR_HOURS = "FOUR_HOURS",
  /** 12 hours before event */
  TWELVE_HOURS = "TWELVE_HOURS",
  /** 24 hours before event */
  ONE_DAY = "ONE_DAY",
  /** 48 hours before event */
  TWO_DAYS = "TWO_DAYS",
  /** 1 week before event */
  ONE_WEEK = "ONE_WEEK",
}

/**
 * Severity of pre-event volume anomaly
 */
export enum PreEventSeverity {
  /** Minor increase above normal */
  LOW = "LOW",
  /** Notable increase requiring attention */
  MEDIUM = "MEDIUM",
  /** Significant increase, potential manipulation */
  HIGH = "HIGH",
  /** Extreme increase, likely coordinated activity */
  CRITICAL = "CRITICAL",
}

/**
 * Direction of the pre-event volume anomaly
 */
export enum VolumeDirection {
  /** Volume significantly above normal */
  SURGE = "SURGE",
  /** Volume significantly below normal */
  DROUGHT = "DROUGHT",
}

/**
 * Market event data
 */
export interface MarketEvent {
  /** Market ID */
  marketId: string;

  /** Event type */
  eventType: EventType;

  /** Scheduled event timestamp */
  eventTime: Date;

  /** Human-readable event description */
  description: string;

  /** Market question (for reference) */
  marketQuestion?: string;

  /** Market category */
  category?: string;

  /** Whether the event is still upcoming */
  isUpcoming: boolean;

  /** Time until event in milliseconds (negative if past) */
  timeUntilEventMs: number;

  /** Time until event in hours */
  timeUntilEventHours: number;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Historical pre-event volume pattern
 */
export interface PreEventPattern {
  /** Pre-event time window */
  window: PreEventWindow;

  /** Average volume during this window before similar events */
  averageVolume: number;

  /** Standard deviation of volume */
  standardDeviation: number;

  /** Median volume */
  medianVolume: number;

  /** 90th percentile volume */
  percentile90: number;

  /** 95th percentile volume */
  percentile95: number;

  /** Number of historical data points */
  sampleCount: number;

  /** Whether this pattern is statistically reliable */
  isReliable: boolean;
}

/**
 * Pre-event volume analysis result
 */
export interface PreEventAnalysis {
  /** Market ID */
  marketId: string;

  /** Event being analyzed */
  event: MarketEvent;

  /** Current pre-event window */
  currentWindow: PreEventWindow;

  /** Time until event in hours */
  hoursUntilEvent: number;

  /** Current volume in the window */
  currentVolume: number;

  /** Expected (normal) volume for this window */
  expectedVolume: number;

  /** Volume ratio (current / expected) */
  volumeRatio: number;

  /** Z-score of current volume vs historical */
  zScore: number | null;

  /** Percentile rank of current volume */
  percentileRank: number | null;

  /** Whether this is considered anomalous */
  isAnomalous: boolean;

  /** Severity of the anomaly (if anomalous) */
  severity: PreEventSeverity | null;

  /** Direction of the anomaly */
  direction: VolumeDirection | null;

  /** Historical pattern data */
  historicalPattern: PreEventPattern | null;

  /** Confidence in the analysis (0-1) */
  confidence: number;

  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Pre-event volume spike event
 */
export interface PreEventVolumeSpike {
  /** Unique event ID */
  eventId: string;

  /** Market ID */
  marketId: string;

  /** Market event details */
  event: MarketEvent;

  /** Severity of the spike */
  severity: PreEventSeverity;

  /** Direction of the anomaly */
  direction: VolumeDirection;

  /** Pre-event window where spike occurred */
  window: PreEventWindow;

  /** Hours until the scheduled event */
  hoursUntilEvent: number;

  /** Current volume */
  currentVolume: number;

  /** Expected (baseline) volume */
  expectedVolume: number;

  /** Volume ratio (current / expected) */
  volumeRatio: number;

  /** Z-score of the spike */
  zScore: number | null;

  /** Detection timestamp */
  detectedAt: Date;

  /** Spike start time (if tracking ongoing spike) */
  spikeStartTime: Date;

  /** Duration of sustained spike in minutes */
  durationMinutes: number;

  /** Context for the spike */
  context: {
    /** Whether similar spikes have occurred before this event */
    previousSpikesForEvent: number;
    /** Whether volume is increasing or stabilizing */
    volumeTrend: "increasing" | "stable" | "decreasing";
    /** Data reliability score */
    dataReliability: number;
    /** Number of trades contributing to volume */
    tradeCount: number | null;
  };

  /** Reasons this was flagged */
  flagReasons: string[];
}

/**
 * Configuration for pre-event analysis thresholds
 */
export interface PreEventThresholdConfig {
  /** Z-score threshold for LOW severity */
  lowZScoreThreshold: number;

  /** Z-score threshold for MEDIUM severity */
  mediumZScoreThreshold: number;

  /** Z-score threshold for HIGH severity */
  highZScoreThreshold: number;

  /** Z-score threshold for CRITICAL severity */
  criticalZScoreThreshold: number;

  /** Volume ratio threshold for LOW severity */
  lowRatioThreshold: number;

  /** Volume ratio threshold for MEDIUM severity */
  mediumRatioThreshold: number;

  /** Volume ratio threshold for HIGH severity */
  highRatioThreshold: number;

  /** Volume ratio threshold for CRITICAL severity */
  criticalRatioThreshold: number;

  /** Minimum sample size for reliable pattern */
  minSampleSize: number;

  /** Minimum data density for analysis */
  minDataDensity: number;
}

/**
 * Configuration for PreEventVolumeDetector
 */
export interface PreEventVolumeDetectorConfig {
  /** Threshold configuration */
  thresholds?: Partial<PreEventThresholdConfig>;

  /** Windows to analyze (default: all) */
  windows?: PreEventWindow[];

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown period between alerts for same market/window (default: 30 minutes) */
  cooldownMs?: number;

  /** Maximum hours before event to analyze (default: 168 = 1 week) */
  maxHoursBeforeEvent?: number;

  /** Minimum hours before event to analyze (default: 0.5 = 30 minutes) */
  minHoursBeforeEvent?: number;

  /** Rolling volume tracker to use */
  volumeTracker?: RollingVolumeTracker;
}

/**
 * Options for analyzing pre-event volume
 */
export interface AnalyzePreEventOptions {
  /** Override the window to analyze */
  window?: PreEventWindow;

  /** Current timestamp override */
  timestamp?: number;

  /** Bypass cooldown check */
  bypassCooldown?: boolean;

  /** Include historical pattern data in result */
  includeHistoricalPattern?: boolean;
}

/**
 * Options for registering a market event
 */
export interface RegisterEventOptions {
  /** Event type */
  eventType?: EventType;

  /** Custom description */
  description?: string;

  /** Market question */
  marketQuestion?: string;

  /** Market category */
  category?: string;
}

/**
 * Batch analysis result
 */
export interface BatchPreEventAnalysisResult {
  /** Results by market ID */
  results: Map<string, PreEventAnalysis>;

  /** Markets with detected anomalies */
  anomaliesDetected: string[];

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary of pre-event detector state
 */
export interface PreEventDetectorSummary {
  /** Total markets being tracked */
  totalTrackedMarkets: number;

  /** Markets with upcoming events */
  upcomingEventCount: number;

  /** Markets currently in pre-event windows */
  marketsInPreEventWindow: number;

  /** Total anomalies detected */
  totalAnomalies: number;

  /** Anomalies by severity */
  bySeverity: Record<PreEventSeverity, number>;

  /** Anomalies by window */
  byWindow: Record<PreEventWindow, number>;

  /** Recent spike events */
  recentSpikes: PreEventVolumeSpike[];

  /** Markets with most anomalies */
  frequentAnomalyMarkets: Array<{
    marketId: string;
    anomalyCount: number;
    lastAnomalyTime: Date;
  }>;
}

/**
 * Pre-event volume state for a market/window
 */
interface MarketPreEventState {
  /** Currently in anomaly state */
  inAnomaly: boolean;

  /** Anomaly start time */
  anomalyStartTime: number | null;

  /** Peak volume during current anomaly */
  peakVolume: number;

  /** Last check time */
  lastCheckTime: number;

  /** Last alert time */
  lastAlertTime: number | null;

  /** Recent anomaly times */
  recentAnomalyTimes: number[];

  /** Volume trend data points */
  volumeTrendPoints: Array<{ time: number; volume: number }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Duration of each pre-event window in milliseconds */
export const PRE_EVENT_WINDOW_DURATION_MS: Record<PreEventWindow, number> = {
  [PreEventWindow.ONE_HOUR]: 60 * 60 * 1000,
  [PreEventWindow.FOUR_HOURS]: 4 * 60 * 60 * 1000,
  [PreEventWindow.TWELVE_HOURS]: 12 * 60 * 60 * 1000,
  [PreEventWindow.ONE_DAY]: 24 * 60 * 60 * 1000,
  [PreEventWindow.TWO_DAYS]: 48 * 60 * 60 * 1000,
  [PreEventWindow.ONE_WEEK]: 7 * 24 * 60 * 60 * 1000,
};

/** Duration of each pre-event window in hours */
export const PRE_EVENT_WINDOW_HOURS: Record<PreEventWindow, number> = {
  [PreEventWindow.ONE_HOUR]: 1,
  [PreEventWindow.FOUR_HOURS]: 4,
  [PreEventWindow.TWELVE_HOURS]: 12,
  [PreEventWindow.ONE_DAY]: 24,
  [PreEventWindow.TWO_DAYS]: 48,
  [PreEventWindow.ONE_WEEK]: 168,
};

/** All pre-event windows in order of proximity to event */
export const ALL_PRE_EVENT_WINDOWS: PreEventWindow[] = [
  PreEventWindow.ONE_HOUR,
  PreEventWindow.FOUR_HOURS,
  PreEventWindow.TWELVE_HOURS,
  PreEventWindow.ONE_DAY,
  PreEventWindow.TWO_DAYS,
  PreEventWindow.ONE_WEEK,
];

/** Default threshold configuration */
export const DEFAULT_PRE_EVENT_THRESHOLDS: PreEventThresholdConfig = {
  lowZScoreThreshold: 1.5,
  mediumZScoreThreshold: 2.0,
  highZScoreThreshold: 2.5,
  criticalZScoreThreshold: 3.5,
  lowRatioThreshold: 1.5,
  mediumRatioThreshold: 2.0,
  highRatioThreshold: 3.0,
  criticalRatioThreshold: 5.0,
  minSampleSize: 5,
  minDataDensity: 0.3,
};

/** Default cooldown period (30 minutes) */
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

/** Default max hours before event to analyze */
const DEFAULT_MAX_HOURS_BEFORE_EVENT = 168; // 1 week

/** Default min hours before event */
const DEFAULT_MIN_HOURS_BEFORE_EVENT = 0.5; // 30 minutes

/** Anomaly tracking window (4 hours) */
const ANOMALY_TRACKING_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Volume trend window size */
const VOLUME_TREND_WINDOW_SIZE = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `pre_event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine which pre-event window applies based on time until event
 */
export function getPreEventWindow(hoursUntilEvent: number): PreEventWindow | null {
  if (hoursUntilEvent <= 0) {
    return null; // Event has passed
  }

  if (hoursUntilEvent <= 1) {
    return PreEventWindow.ONE_HOUR;
  }
  if (hoursUntilEvent <= 4) {
    return PreEventWindow.FOUR_HOURS;
  }
  if (hoursUntilEvent <= 12) {
    return PreEventWindow.TWELVE_HOURS;
  }
  if (hoursUntilEvent <= 24) {
    return PreEventWindow.ONE_DAY;
  }
  if (hoursUntilEvent <= 48) {
    return PreEventWindow.TWO_DAYS;
  }
  if (hoursUntilEvent <= 168) {
    return PreEventWindow.ONE_WEEK;
  }

  return null; // Too far from event
}

/**
 * Determine severity from z-score
 */
function getSeverityFromZScore(
  zScore: number,
  thresholds: PreEventThresholdConfig
): PreEventSeverity | null {
  const absZScore = Math.abs(zScore);

  if (absZScore >= thresholds.criticalZScoreThreshold) {
    return PreEventSeverity.CRITICAL;
  }
  if (absZScore >= thresholds.highZScoreThreshold) {
    return PreEventSeverity.HIGH;
  }
  if (absZScore >= thresholds.mediumZScoreThreshold) {
    return PreEventSeverity.MEDIUM;
  }
  if (absZScore >= thresholds.lowZScoreThreshold) {
    return PreEventSeverity.LOW;
  }

  return null;
}

/**
 * Determine severity from volume ratio
 */
function getSeverityFromRatio(
  ratio: number,
  thresholds: PreEventThresholdConfig
): PreEventSeverity | null {
  // For surges (high volume)
  if (ratio >= thresholds.criticalRatioThreshold) {
    return PreEventSeverity.CRITICAL;
  }
  if (ratio >= thresholds.highRatioThreshold) {
    return PreEventSeverity.HIGH;
  }
  if (ratio >= thresholds.mediumRatioThreshold) {
    return PreEventSeverity.MEDIUM;
  }
  if (ratio >= thresholds.lowRatioThreshold) {
    return PreEventSeverity.LOW;
  }

  // For droughts (low volume) - inverse thresholds
  if (ratio > 0 && ratio <= 1 / thresholds.criticalRatioThreshold) {
    return PreEventSeverity.CRITICAL;
  }
  if (ratio > 0 && ratio <= 1 / thresholds.highRatioThreshold) {
    return PreEventSeverity.HIGH;
  }
  if (ratio > 0 && ratio <= 1 / thresholds.mediumRatioThreshold) {
    return PreEventSeverity.MEDIUM;
  }
  if (ratio > 0 && ratio <= 1 / thresholds.lowRatioThreshold) {
    return PreEventSeverity.LOW;
  }

  return null;
}

/**
 * Get the higher severity between two
 */
function getHigherSeverity(
  s1: PreEventSeverity | null,
  s2: PreEventSeverity | null
): PreEventSeverity | null {
  const severityOrder: PreEventSeverity[] = [
    PreEventSeverity.LOW,
    PreEventSeverity.MEDIUM,
    PreEventSeverity.HIGH,
    PreEventSeverity.CRITICAL,
  ];

  if (s1 === null) return s2;
  if (s2 === null) return s1;

  const i1 = severityOrder.indexOf(s1);
  const i2 = severityOrder.indexOf(s2);

  return i1 >= i2 ? s1 : s2;
}

/**
 * Calculate percentile rank
 */
function calculatePercentileRank(value: number, data: number[]): number {
  if (data.length === 0) return 50;

  const sorted = [...data].sort((a, b) => a - b);
  const countBelow = sorted.filter((v) => v < value).length;
  const countEqual = sorted.filter((v) => v === value).length;

  return ((countBelow + 0.5 * countEqual) / sorted.length) * 100;
}

/**
 * Determine volume trend from data points
 */
function determineVolumeTrend(
  points: Array<{ time: number; volume: number }>
): "increasing" | "stable" | "decreasing" {
  if (points.length < 2) return "stable";

  const recentPoints = points.slice(-5);
  if (recentPoints.length < 2) return "stable";

  // Calculate simple linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const n = recentPoints.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentPoints[i]!.volume;
    sumXY += i * recentPoints[i]!.volume;
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const avgVolume = sumY / n;

  // Normalize slope by average volume to get percentage change
  const normalizedSlope = avgVolume > 0 ? slope / avgVolume : 0;

  if (normalizedSlope > 0.1) return "increasing";
  if (normalizedSlope < -0.1) return "decreasing";
  return "stable";
}

// ============================================================================
// PreEventVolumeDetector Class
// ============================================================================

/**
 * Event types emitted by PreEventVolumeDetector
 */
export interface PreEventVolumeDetectorEvents {
  preEventSpike: (event: PreEventVolumeSpike) => void;
  eventRegistered: (event: MarketEvent) => void;
  eventPassed: (marketId: string, event: MarketEvent) => void;
  windowTransition: (marketId: string, from: PreEventWindow | null, to: PreEventWindow | null) => void;
}

/**
 * Detector for pre-event volume spikes and anomalies
 */
export class PreEventVolumeDetector extends EventEmitter {
  private readonly thresholds: PreEventThresholdConfig;
  private readonly windows: PreEventWindow[];
  private readonly enableEvents: boolean;
  private readonly cooldownMs: number;
  private readonly maxHoursBeforeEvent: number;
  private readonly minHoursBeforeEvent: number;
  private readonly volumeTracker: RollingVolumeTracker;

  // Tracked market events
  private readonly marketEvents: Map<string, MarketEvent> = new Map();

  // Market pre-event states (key: marketId:window)
  private readonly marketStates: Map<string, MarketPreEventState> = new Map();

  // Historical pre-event patterns (key: category:window)
  private readonly historicalPatterns: Map<string, PreEventPattern> = new Map();

  // Historical volume data per market/window for pattern building
  private readonly historicalVolumeData: Map<string, number[]> = new Map();

  // Recent spike events
  private readonly recentSpikes: PreEventVolumeSpike[] = [];
  private readonly maxRecentSpikes = 100;

  constructor(config?: PreEventVolumeDetectorConfig) {
    super();

    this.thresholds = {
      ...DEFAULT_PRE_EVENT_THRESHOLDS,
      ...config?.thresholds,
    };

    this.windows = config?.windows ?? ALL_PRE_EVENT_WINDOWS;
    this.enableEvents = config?.enableEvents ?? true;
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.maxHoursBeforeEvent = config?.maxHoursBeforeEvent ?? DEFAULT_MAX_HOURS_BEFORE_EVENT;
    this.minHoursBeforeEvent = config?.minHoursBeforeEvent ?? DEFAULT_MIN_HOURS_BEFORE_EVENT;
    this.volumeTracker = config?.volumeTracker ?? getSharedRollingVolumeTracker();
  }

  /**
   * Register a market event to track
   */
  registerEvent(
    marketId: string,
    eventTime: Date,
    options?: RegisterEventOptions
  ): MarketEvent {
    const now = Date.now();
    const eventTimeMs = eventTime.getTime();
    const timeUntilEventMs = eventTimeMs - now;
    const timeUntilEventHours = timeUntilEventMs / (60 * 60 * 1000);

    const event: MarketEvent = {
      marketId,
      eventType: options?.eventType ?? EventType.RESOLUTION,
      eventTime,
      description: options?.description ?? `Event for market ${marketId}`,
      marketQuestion: options?.marketQuestion,
      category: options?.category,
      isUpcoming: timeUntilEventMs > 0,
      timeUntilEventMs,
      timeUntilEventHours,
      updatedAt: new Date(now),
    };

    this.marketEvents.set(marketId, event);

    if (this.enableEvents) {
      this.emit("eventRegistered", event);
    }

    return event;
  }

  /**
   * Update event times (useful for batch updates from API)
   */
  updateEventTime(marketId: string, newEventTime: Date): MarketEvent | null {
    const existing = this.marketEvents.get(marketId);
    if (!existing) return null;

    const now = Date.now();
    const eventTimeMs = newEventTime.getTime();
    const timeUntilEventMs = eventTimeMs - now;
    const timeUntilEventHours = timeUntilEventMs / (60 * 60 * 1000);

    const updated: MarketEvent = {
      ...existing,
      eventTime: newEventTime,
      isUpcoming: timeUntilEventMs > 0,
      timeUntilEventMs,
      timeUntilEventHours,
      updatedAt: new Date(now),
    };

    this.marketEvents.set(marketId, updated);
    return updated;
  }

  /**
   * Remove a market event from tracking
   */
  unregisterEvent(marketId: string): boolean {
    const existed = this.marketEvents.delete(marketId);

    // Clean up associated states
    for (const window of this.windows) {
      const stateKey = `${marketId}:${window}`;
      this.marketStates.delete(stateKey);
    }

    return existed;
  }

  /**
   * Get registered event for a market
   */
  getEvent(marketId: string): MarketEvent | null {
    const event = this.marketEvents.get(marketId);
    if (!event) return null;

    // Update time calculations
    const now = Date.now();
    const timeUntilEventMs = event.eventTime.getTime() - now;

    return {
      ...event,
      isUpcoming: timeUntilEventMs > 0,
      timeUntilEventMs,
      timeUntilEventHours: timeUntilEventMs / (60 * 60 * 1000),
    };
  }

  /**
   * Get all registered events
   */
  getAllEvents(): MarketEvent[] {
    const now = Date.now();
    const events: MarketEvent[] = [];

    for (const event of this.marketEvents.values()) {
      const timeUntilEventMs = event.eventTime.getTime() - now;
      events.push({
        ...event,
        isUpcoming: timeUntilEventMs > 0,
        timeUntilEventMs,
        timeUntilEventHours: timeUntilEventMs / (60 * 60 * 1000),
      });
    }

    return events;
  }

  /**
   * Get markets with upcoming events
   */
  getUpcomingEvents(): MarketEvent[] {
    return this.getAllEvents().filter((e) => e.isUpcoming);
  }

  /**
   * Add historical pre-event volume data point
   * Used to build patterns for comparison
   */
  addHistoricalData(
    marketId: string,
    window: PreEventWindow,
    volume: number,
    category?: string
  ): void {
    // Store per-market data
    const marketKey = `${marketId}:${window}`;
    const marketData = this.historicalVolumeData.get(marketKey) ?? [];
    marketData.push(volume);
    this.historicalVolumeData.set(marketKey, marketData);

    // Store per-category data if category provided
    if (category) {
      const categoryKey = `${category}:${window}`;
      const categoryData = this.historicalVolumeData.get(categoryKey) ?? [];
      categoryData.push(volume);
      this.historicalVolumeData.set(categoryKey, categoryData);

      // Rebuild category pattern
      this.rebuildPattern(categoryKey, categoryData);
    }
  }

  /**
   * Analyze pre-event volume for a market
   */
  analyzePreEventVolume(
    marketId: string,
    currentVolume: number,
    options?: AnalyzePreEventOptions
  ): PreEventAnalysis | null {
    const now = options?.timestamp ?? Date.now();
    const event = this.getEvent(marketId);

    // No event registered for this market
    if (!event) {
      return null;
    }

    // Event has already passed
    if (!event.isUpcoming) {
      if (this.enableEvents) {
        this.emit("eventPassed", marketId, event);
      }
      return null;
    }

    const hoursUntilEvent = event.timeUntilEventHours;

    // Outside analysis window
    if (
      hoursUntilEvent > this.maxHoursBeforeEvent ||
      hoursUntilEvent < this.minHoursBeforeEvent
    ) {
      return null;
    }

    // Determine which window we're in
    const window = options?.window ?? getPreEventWindow(hoursUntilEvent);
    if (!window || !this.windows.includes(window)) {
      return null;
    }

    // Get expected volume from baseline or historical pattern
    const expectedVolume = this.getExpectedVolume(marketId, window, event.category);
    const historicalPattern = options?.includeHistoricalPattern
      ? this.getHistoricalPattern(window, event.category)
      : null;

    // Calculate volume ratio
    const volumeRatio = expectedVolume > 0 ? currentVolume / expectedVolume : 0;

    // Calculate z-score if we have pattern data
    let zScore: number | null = null;
    let percentileRank: number | null = null;

    const patternKey = event.category
      ? `${event.category}:${window}`
      : `${marketId}:${window}`;
    const patternData = this.historicalVolumeData.get(patternKey);

    if (patternData && patternData.length >= this.thresholds.minSampleSize) {
      const mean = patternData.reduce((a, b) => a + b, 0) / patternData.length;
      const variance =
        patternData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        patternData.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        zScore = (currentVolume - mean) / stdDev;
      }

      percentileRank = calculatePercentileRank(currentVolume, patternData);
    }

    // Determine if anomalous
    let severity: PreEventSeverity | null = null;

    if (zScore !== null) {
      severity = getSeverityFromZScore(zScore, this.thresholds);
    }

    const ratioSeverity = getSeverityFromRatio(volumeRatio, this.thresholds);
    severity = getHigherSeverity(severity, ratioSeverity);

    const isAnomalous = severity !== null;
    const direction: VolumeDirection | null = isAnomalous
      ? volumeRatio > 1
        ? VolumeDirection.SURGE
        : VolumeDirection.DROUGHT
      : null;

    // Calculate confidence
    let confidence = 0.5; // Base confidence
    if (patternData && patternData.length >= this.thresholds.minSampleSize) {
      confidence = Math.min(1, 0.5 + patternData.length / 50);
    }

    const analysis: PreEventAnalysis = {
      marketId,
      event,
      currentWindow: window,
      hoursUntilEvent,
      currentVolume,
      expectedVolume,
      volumeRatio,
      zScore,
      percentileRank,
      isAnomalous,
      severity,
      direction,
      historicalPattern,
      confidence,
      analyzedAt: new Date(now),
    };

    // Handle anomaly detection
    if (isAnomalous && severity !== null) {
      this.handleAnomaly(marketId, window, analysis, now, options?.bypassCooldown);
    }

    return analysis;
  }

  /**
   * Batch analyze pre-event volume for multiple markets
   */
  batchAnalyzePreEventVolume(
    volumeData: Array<{ marketId: string; volume: number }>,
    options?: AnalyzePreEventOptions
  ): BatchPreEventAnalysisResult {
    const startTime = Date.now();
    const results = new Map<string, PreEventAnalysis>();
    const anomaliesDetected: string[] = [];

    for (const { marketId, volume } of volumeData) {
      const result = this.analyzePreEventVolume(marketId, volume, options);
      if (result) {
        results.set(marketId, result);
        if (result.isAnomalous) {
          anomaliesDetected.push(marketId);
        }
      }
    }

    return {
      results,
      anomaliesDetected,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a market is in pre-event period
   */
  isInPreEventPeriod(marketId: string): boolean {
    const event = this.getEvent(marketId);
    if (!event || !event.isUpcoming) return false;

    const hoursUntilEvent = event.timeUntilEventHours;
    return (
      hoursUntilEvent <= this.maxHoursBeforeEvent &&
      hoursUntilEvent >= this.minHoursBeforeEvent
    );
  }

  /**
   * Get current pre-event window for a market
   */
  getCurrentWindow(marketId: string): PreEventWindow | null {
    const event = this.getEvent(marketId);
    if (!event || !event.isUpcoming) return null;

    const window = getPreEventWindow(event.timeUntilEventHours);
    return window && this.windows.includes(window) ? window : null;
  }

  /**
   * Get recent spike events
   */
  getRecentSpikes(limit: number = 20): PreEventVolumeSpike[] {
    return this.recentSpikes.slice(0, limit);
  }

  /**
   * Get spike events for a specific market
   */
  getMarketSpikes(marketId: string, limit: number = 10): PreEventVolumeSpike[] {
    return this.recentSpikes
      .filter((s) => s.marketId === marketId)
      .slice(0, limit);
  }

  /**
   * Get summary of detector state
   */
  getSummary(): PreEventDetectorSummary {
    const now = Date.now();
    const upcomingEvents = this.getUpcomingEvents();
    const marketsInPreEventWindow = upcomingEvents.filter((e) => {
      const window = getPreEventWindow(e.timeUntilEventHours);
      return window !== null;
    }).length;

    // Count anomalies
    const bySeverity: Record<PreEventSeverity, number> = {
      [PreEventSeverity.LOW]: 0,
      [PreEventSeverity.MEDIUM]: 0,
      [PreEventSeverity.HIGH]: 0,
      [PreEventSeverity.CRITICAL]: 0,
    };

    const byWindow: Record<PreEventWindow, number> = {
      [PreEventWindow.ONE_HOUR]: 0,
      [PreEventWindow.FOUR_HOURS]: 0,
      [PreEventWindow.TWELVE_HOURS]: 0,
      [PreEventWindow.ONE_DAY]: 0,
      [PreEventWindow.TWO_DAYS]: 0,
      [PreEventWindow.ONE_WEEK]: 0,
    };

    // Process recent spikes
    const recentSpikes = this.recentSpikes.filter(
      (s) => now - s.detectedAt.getTime() < ANOMALY_TRACKING_WINDOW_MS
    );

    for (const spike of recentSpikes) {
      bySeverity[spike.severity]++;
      byWindow[spike.window]++;
    }

    // Find frequent anomaly markets
    const anomalyCount = new Map<string, { count: number; lastTime: number }>();
    for (const spike of recentSpikes) {
      const existing = anomalyCount.get(spike.marketId) ?? { count: 0, lastTime: 0 };
      anomalyCount.set(spike.marketId, {
        count: existing.count + 1,
        lastTime: Math.max(existing.lastTime, spike.detectedAt.getTime()),
      });
    }

    const frequentAnomalyMarkets = Array.from(anomalyCount.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([marketId, data]) => ({
        marketId,
        anomalyCount: data.count,
        lastAnomalyTime: new Date(data.lastTime),
      }));

    return {
      totalTrackedMarkets: this.marketEvents.size,
      upcomingEventCount: upcomingEvents.length,
      marketsInPreEventWindow,
      totalAnomalies: recentSpikes.length,
      bySeverity,
      byWindow,
      recentSpikes: recentSpikes.slice(0, 20),
      frequentAnomalyMarkets,
    };
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    trackedMarkets: number;
    upcomingEvents: number;
    historicalPatterns: number;
    totalRecentSpikes: number;
    windows: PreEventWindow[];
    cooldownMs: number;
    maxHoursBeforeEvent: number;
    minHoursBeforeEvent: number;
  } {
    return {
      trackedMarkets: this.marketEvents.size,
      upcomingEvents: this.getUpcomingEvents().length,
      historicalPatterns: this.historicalPatterns.size,
      totalRecentSpikes: this.recentSpikes.length,
      windows: [...this.windows],
      cooldownMs: this.cooldownMs,
      maxHoursBeforeEvent: this.maxHoursBeforeEvent,
      minHoursBeforeEvent: this.minHoursBeforeEvent,
    };
  }

  /**
   * Get threshold configuration
   */
  getThresholds(): PreEventThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Clear state for a specific market
   */
  clearMarket(marketId: string): boolean {
    const existed = this.marketEvents.delete(marketId);

    for (const window of this.windows) {
      const stateKey = `${marketId}:${window}`;
      this.marketStates.delete(stateKey);
      this.historicalVolumeData.delete(stateKey);
    }

    return existed;
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.marketEvents.clear();
    this.marketStates.clear();
    this.historicalPatterns.clear();
    this.historicalVolumeData.clear();
    this.recentSpikes.length = 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get expected volume for a market/window
   */
  private getExpectedVolume(
    marketId: string,
    window: PreEventWindow,
    category?: string
  ): number {
    // First try market-specific historical data
    const marketKey = `${marketId}:${window}`;
    const marketData = this.historicalVolumeData.get(marketKey);
    if (marketData && marketData.length >= this.thresholds.minSampleSize) {
      return marketData.reduce((a, b) => a + b, 0) / marketData.length;
    }

    // Then try category-level data
    if (category) {
      const categoryKey = `${category}:${window}`;
      const categoryData = this.historicalVolumeData.get(categoryKey);
      if (categoryData && categoryData.length >= this.thresholds.minSampleSize) {
        return categoryData.reduce((a, b) => a + b, 0) / categoryData.length;
      }
    }

    // Fallback to rolling volume averages
    const rollingWindow = this.mapToRollingWindow(window);
    const averages = this.volumeTracker.getRollingAverages(marketId, {
      windows: [rollingWindow],
    });

    if (averages?.windowResults[rollingWindow]?.averageVolumePerMinute) {
      return averages.windowResults[rollingWindow]!.averageVolumePerMinute;
    }

    return 0;
  }

  /**
   * Get historical pattern for a window/category
   */
  private getHistoricalPattern(
    window: PreEventWindow,
    category?: string
  ): PreEventPattern | null {
    if (category) {
      const pattern = this.historicalPatterns.get(`${category}:${window}`);
      if (pattern) return pattern;
    }

    // Return generic pattern for window if available
    return this.historicalPatterns.get(`generic:${window}`) ?? null;
  }

  /**
   * Rebuild pattern from data
   */
  private rebuildPattern(key: string, data: number[]): void {
    if (data.length < this.thresholds.minSampleSize) {
      this.historicalPatterns.delete(key);
      return;
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    const median =
      data.length % 2 === 0
        ? (sorted[data.length / 2 - 1]! + sorted[data.length / 2]!) / 2
        : sorted[Math.floor(data.length / 2)]!;

    const p90Index = Math.floor(data.length * 0.9);
    const p95Index = Math.floor(data.length * 0.95);

    const [windowPart] = key.split(":").slice(-1);
    const window = windowPart as PreEventWindow;

    const pattern: PreEventPattern = {
      window,
      averageVolume: mean,
      standardDeviation: stdDev,
      medianVolume: median,
      percentile90: sorted[p90Index] ?? mean,
      percentile95: sorted[p95Index] ?? mean,
      sampleCount: data.length,
      isReliable: data.length >= this.thresholds.minSampleSize * 2,
    };

    this.historicalPatterns.set(key, pattern);
  }

  /**
   * Map pre-event window to rolling volume window
   */
  private mapToRollingWindow(window: PreEventWindow): RollingWindow {
    switch (window) {
      case PreEventWindow.ONE_HOUR:
        return RollingWindow.FIVE_MINUTES;
      case PreEventWindow.FOUR_HOURS:
        return RollingWindow.FIFTEEN_MINUTES;
      case PreEventWindow.TWELVE_HOURS:
      case PreEventWindow.ONE_DAY:
        return RollingWindow.ONE_HOUR;
      case PreEventWindow.TWO_DAYS:
      case PreEventWindow.ONE_WEEK:
        return RollingWindow.FOUR_HOURS;
      default:
        return RollingWindow.ONE_HOUR;
    }
  }

  /**
   * Get or create state for a market/window
   */
  private getOrCreateState(marketId: string, window: PreEventWindow): MarketPreEventState {
    const key = `${marketId}:${window}`;
    let state = this.marketStates.get(key);

    if (!state) {
      state = {
        inAnomaly: false,
        anomalyStartTime: null,
        peakVolume: 0,
        lastCheckTime: Date.now(),
        lastAlertTime: null,
        recentAnomalyTimes: [],
        volumeTrendPoints: [],
      };
      this.marketStates.set(key, state);
    }

    return state;
  }

  /**
   * Handle detected anomaly
   */
  private handleAnomaly(
    marketId: string,
    window: PreEventWindow,
    analysis: PreEventAnalysis,
    now: number,
    bypassCooldown?: boolean
  ): void {
    const state = this.getOrCreateState(marketId, window);

    // Update volume trend
    state.volumeTrendPoints.push({ time: now, volume: analysis.currentVolume });
    if (state.volumeTrendPoints.length > VOLUME_TREND_WINDOW_SIZE) {
      state.volumeTrendPoints.shift();
    }

    // Check cooldown
    if (
      !bypassCooldown &&
      state.lastAlertTime !== null &&
      now - state.lastAlertTime < this.cooldownMs
    ) {
      // Update state but don't emit new event
      if (!state.inAnomaly) {
        state.inAnomaly = true;
        state.anomalyStartTime = now;
        state.peakVolume = analysis.currentVolume;
      } else {
        state.peakVolume = Math.max(state.peakVolume, analysis.currentVolume);
      }
      state.lastCheckTime = now;
      return;
    }

    // Update state
    if (!state.inAnomaly) {
      state.inAnomaly = true;
      state.anomalyStartTime = now;
      state.peakVolume = analysis.currentVolume;
    } else {
      state.peakVolume = Math.max(state.peakVolume, analysis.currentVolume);
    }

    const durationMinutes = state.anomalyStartTime !== null
      ? (now - state.anomalyStartTime) / (60 * 1000)
      : 0;

    // Generate flag reasons
    const flagReasons: string[] = [];
    if (analysis.volumeRatio >= this.thresholds.criticalRatioThreshold) {
      flagReasons.push(`Volume ${analysis.volumeRatio.toFixed(1)}x normal pre-event level`);
    } else if (analysis.volumeRatio >= this.thresholds.highRatioThreshold) {
      flagReasons.push(`Volume ${analysis.volumeRatio.toFixed(1)}x elevated vs pre-event norm`);
    }

    if (analysis.zScore !== null && Math.abs(analysis.zScore) >= this.thresholds.highZScoreThreshold) {
      flagReasons.push(`Z-score ${analysis.zScore.toFixed(2)} indicates statistical outlier`);
    }

    if (analysis.hoursUntilEvent <= 1) {
      flagReasons.push("Activity within 1 hour of scheduled event");
    } else if (analysis.hoursUntilEvent <= 4) {
      flagReasons.push("Activity within 4 hours of scheduled event");
    }

    const volumeTrend = determineVolumeTrend(state.volumeTrendPoints);
    if (volumeTrend === "increasing") {
      flagReasons.push("Volume trending upward toward event");
    }

    // Create spike event
    const spike: PreEventVolumeSpike = {
      eventId: generateEventId(),
      marketId,
      event: analysis.event,
      severity: analysis.severity!,
      direction: analysis.direction!,
      window,
      hoursUntilEvent: analysis.hoursUntilEvent,
      currentVolume: analysis.currentVolume,
      expectedVolume: analysis.expectedVolume,
      volumeRatio: analysis.volumeRatio,
      zScore: analysis.zScore,
      detectedAt: new Date(now),
      spikeStartTime: new Date(state.anomalyStartTime ?? now),
      durationMinutes,
      context: {
        previousSpikesForEvent: state.recentAnomalyTimes.filter(
          (t) => now - t < ANOMALY_TRACKING_WINDOW_MS
        ).length,
        volumeTrend,
        dataReliability: analysis.confidence,
        tradeCount: null, // Would need trade data
      },
      flagReasons,
    };

    // Update state
    state.lastAlertTime = now;
    state.lastCheckTime = now;
    state.recentAnomalyTimes.push(now);
    state.recentAnomalyTimes = state.recentAnomalyTimes.filter(
      (t) => now - t < ANOMALY_TRACKING_WINDOW_MS
    );

    // Store spike
    this.addRecentSpike(spike);

    // Emit event
    if (this.enableEvents) {
      this.emit("preEventSpike", spike);
    }
  }

  /**
   * Add spike to recent spikes list
   */
  private addRecentSpike(spike: PreEventVolumeSpike): void {
    this.recentSpikes.unshift(spike);

    if (this.recentSpikes.length > this.maxRecentSpikes) {
      this.recentSpikes.pop();
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedDetector: PreEventVolumeDetector | null = null;

/**
 * Create a new PreEventVolumeDetector instance
 */
export function createPreEventVolumeDetector(
  config?: PreEventVolumeDetectorConfig
): PreEventVolumeDetector {
  return new PreEventVolumeDetector(config);
}

/**
 * Get the shared PreEventVolumeDetector instance
 */
export function getSharedPreEventVolumeDetector(): PreEventVolumeDetector {
  if (!sharedDetector) {
    sharedDetector = new PreEventVolumeDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared PreEventVolumeDetector instance
 */
export function setSharedPreEventVolumeDetector(detector: PreEventVolumeDetector): void {
  sharedDetector = detector;
}

/**
 * Reset the shared PreEventVolumeDetector instance
 */
export function resetSharedPreEventVolumeDetector(): void {
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
 * Register a market event for pre-event monitoring (convenience function)
 */
export function registerMarketEvent(
  marketId: string,
  eventTime: Date,
  options?: RegisterEventOptions & { detector?: PreEventVolumeDetector }
): MarketEvent {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.registerEvent(marketId, eventTime, options);
}

/**
 * Analyze pre-event volume for a market (convenience function)
 */
export function analyzePreEventVolume(
  marketId: string,
  currentVolume: number,
  options?: AnalyzePreEventOptions & { detector?: PreEventVolumeDetector }
): PreEventAnalysis | null {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.analyzePreEventVolume(marketId, currentVolume, options);
}

/**
 * Batch analyze pre-event volume (convenience function)
 */
export function batchAnalyzePreEventVolume(
  volumeData: Array<{ marketId: string; volume: number }>,
  options?: AnalyzePreEventOptions & { detector?: PreEventVolumeDetector }
): BatchPreEventAnalysisResult {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.batchAnalyzePreEventVolume(volumeData, options);
}

/**
 * Check if a market is in pre-event period (convenience function)
 */
export function isInPreEventPeriod(
  marketId: string,
  options?: { detector?: PreEventVolumeDetector }
): boolean {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.isInPreEventPeriod(marketId);
}

/**
 * Get current pre-event window for a market (convenience function)
 */
export function getCurrentPreEventWindow(
  marketId: string,
  options?: { detector?: PreEventVolumeDetector }
): PreEventWindow | null {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.getCurrentWindow(marketId);
}

/**
 * Get recent pre-event spikes (convenience function)
 */
export function getRecentPreEventSpikes(
  limit?: number,
  options?: { detector?: PreEventVolumeDetector }
): PreEventVolumeSpike[] {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.getRecentSpikes(limit);
}

/**
 * Get pre-event detector summary (convenience function)
 */
export function getPreEventDetectorSummary(
  options?: { detector?: PreEventVolumeDetector }
): PreEventDetectorSummary {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  return detector.getSummary();
}

/**
 * Add historical pre-event volume data (convenience function)
 */
export function addHistoricalPreEventData(
  marketId: string,
  window: PreEventWindow,
  volume: number,
  category?: string,
  options?: { detector?: PreEventVolumeDetector }
): void {
  const detector = options?.detector ?? getSharedPreEventVolumeDetector();
  detector.addHistoricalData(marketId, window, volume, category);
}
