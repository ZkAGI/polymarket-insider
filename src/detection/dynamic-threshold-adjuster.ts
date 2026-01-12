/**
 * Dynamic Threshold Adjuster (DET-SCORE-003)
 *
 * Automatically adjust detection thresholds based on market conditions.
 * This ensures the detection system remains effective during different
 * market regimes (high volatility, low activity, etc.).
 *
 * Features:
 * - Monitor market conditions (volume, volatility, activity levels)
 * - Detect regime changes (bull/bear, high/low volatility)
 * - Adjust thresholds automatically based on conditions
 * - Log all threshold changes with audit trail
 * - Support manual overrides
 * - Event emission for threshold changes
 */

import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

import {
  SignalSource,
  CompositeSignalCategory,
  CompositeSuspicionLevel,
  SUSPICION_THRESHOLDS,
} from "./composite-suspicion-scorer";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Market regime classification
 */
export enum MarketRegime {
  /** Normal market conditions */
  NORMAL = "NORMAL",
  /** High volatility period */
  HIGH_VOLATILITY = "HIGH_VOLATILITY",
  /** Low volatility/quiet period */
  LOW_VOLATILITY = "LOW_VOLATILITY",
  /** High activity/volume surge */
  HIGH_ACTIVITY = "HIGH_ACTIVITY",
  /** Low activity/quiet markets */
  LOW_ACTIVITY = "LOW_ACTIVITY",
  /** Bull market (prices rising) */
  BULL_MARKET = "BULL_MARKET",
  /** Bear market (prices falling) */
  BEAR_MARKET = "BEAR_MARKET",
  /** Extreme conditions requiring caution */
  EXTREME = "EXTREME",
}

/**
 * Condition metric type
 */
export enum ConditionMetric {
  /** Trading volume across markets */
  VOLUME = "VOLUME",
  /** Price volatility */
  VOLATILITY = "VOLATILITY",
  /** Number of active traders */
  ACTIVE_TRADERS = "ACTIVE_TRADERS",
  /** Number of active markets */
  ACTIVE_MARKETS = "ACTIVE_MARKETS",
  /** Average trade size */
  TRADE_SIZE = "TRADE_SIZE",
  /** Market sentiment (derived from price movements) */
  SENTIMENT = "SENTIMENT",
  /** Liquidity depth */
  LIQUIDITY = "LIQUIDITY",
  /** Fresh wallet activity */
  FRESH_WALLET_ACTIVITY = "FRESH_WALLET_ACTIVITY",
}

/**
 * Threshold adjustment direction
 */
export enum AdjustmentDirection {
  /** Increase threshold (less sensitive) */
  INCREASE = "INCREASE",
  /** Decrease threshold (more sensitive) */
  DECREASE = "DECREASE",
  /** No change needed */
  NONE = "NONE",
}

/**
 * Adjustment reason
 */
export enum AdjustmentReason {
  /** Regime change detected */
  REGIME_CHANGE = "REGIME_CHANGE",
  /** Metric crossed threshold */
  METRIC_THRESHOLD = "METRIC_THRESHOLD",
  /** Scheduled periodic adjustment */
  SCHEDULED = "SCHEDULED",
  /** Manual override */
  MANUAL = "MANUAL",
  /** System initialization */
  INITIALIZATION = "INITIALIZATION",
  /** Reset to defaults */
  RESET = "RESET",
  /** Adaptive learning */
  ADAPTIVE = "ADAPTIVE",
}

/**
 * Threshold type being adjusted
 */
export enum ThresholdType {
  /** Suspicion level thresholds */
  SUSPICION_LEVEL = "SUSPICION_LEVEL",
  /** Flag threshold for review */
  FLAG_THRESHOLD = "FLAG_THRESHOLD",
  /** Insider detection threshold */
  INSIDER_THRESHOLD = "INSIDER_THRESHOLD",
  /** Signal-specific thresholds */
  SIGNAL_THRESHOLD = "SIGNAL_THRESHOLD",
  /** Category-specific thresholds */
  CATEGORY_THRESHOLD = "CATEGORY_THRESHOLD",
}

/**
 * Market condition snapshot
 */
export interface MarketConditions {
  /** Current market regime */
  regime: MarketRegime;
  /** Metric values */
  metrics: Record<ConditionMetric, MetricSnapshot>;
  /** Overall market health score (0-100) */
  healthScore: number;
  /** Whether conditions are unusual */
  isUnusual: boolean;
  /** Condition confidence (0-1) */
  confidence: number;
  /** When conditions were measured */
  measuredAt: Date;
  /** Time period covered */
  periodMinutes: number;
}

/**
 * Individual metric snapshot
 */
export interface MetricSnapshot {
  /** Metric type */
  metric: ConditionMetric;
  /** Current value */
  value: number;
  /** Historical average for comparison */
  historicalAverage: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Percentile rank (0-100) */
  percentileRank: number;
  /** Z-score relative to historical */
  zScore: number;
  /** Whether this metric is anomalous */
  isAnomalous: boolean;
  /** When this was measured */
  measuredAt: Date;
}

/**
 * Threshold configuration
 */
export interface ThresholdConfig {
  /** Suspicion level thresholds */
  suspicionThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Flag threshold */
  flagThreshold: number;
  /** Insider threshold */
  insiderThreshold: number;
  /** Signal-specific multipliers */
  signalMultipliers: Partial<Record<SignalSource, number>>;
  /** Category-specific multipliers */
  categoryMultipliers: Partial<Record<CompositeSignalCategory, number>>;
}

/**
 * Threshold adjustment record
 */
export interface ThresholdAdjustment {
  /** Unique adjustment ID */
  id: string;
  /** Type of threshold adjusted */
  thresholdType: ThresholdType;
  /** Specific key if applicable (signal/category name) */
  thresholdKey?: string;
  /** Previous value */
  previousValue: number;
  /** New value */
  newValue: number;
  /** Adjustment direction */
  direction: AdjustmentDirection;
  /** Percentage change */
  percentageChange: number;
  /** Reason for adjustment */
  reason: AdjustmentReason;
  /** Market conditions at time of adjustment */
  marketConditions: MarketConditions;
  /** Timestamp */
  adjustedAt: Date;
  /** Who/what triggered the adjustment */
  triggeredBy: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Regime change event
 */
export interface RegimeChangeEvent {
  /** Previous regime */
  previousRegime: MarketRegime;
  /** New regime */
  newRegime: MarketRegime;
  /** Confidence in regime change */
  confidence: number;
  /** Metrics that triggered the change */
  triggeringMetrics: ConditionMetric[];
  /** When change was detected */
  detectedAt: Date;
  /** Duration of previous regime in minutes */
  previousRegimeDurationMinutes: number;
}

/**
 * Adjustment rule definition
 */
export interface AdjustmentRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Which metric(s) trigger this rule */
  triggerMetrics: ConditionMetric[];
  /** Threshold for triggering (z-score) */
  triggerZScore: number;
  /** Which threshold type to adjust */
  targetThreshold: ThresholdType;
  /** Target threshold key if applicable */
  targetKey?: string;
  /** Adjustment percentage (positive = increase, negative = decrease) */
  adjustmentPercent: number;
  /** Minimum adjustment (absolute) */
  minAdjustment: number;
  /** Maximum adjustment (absolute) */
  maxAdjustment: number;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Priority (higher = applied first) */
  priority: number;
}

/**
 * Configuration for the dynamic threshold adjuster
 */
export interface DynamicThresholdAdjusterConfig {
  /** Enable automatic adjustments */
  autoAdjustEnabled: boolean;
  /** Minimum interval between adjustments (ms) */
  minAdjustmentIntervalMs: number;
  /** Maximum total adjustment from defaults (%) */
  maxTotalAdjustmentPercent: number;
  /** Regime detection sensitivity (0-1) */
  regimeSensitivity: number;
  /** Historical window for comparison (minutes) */
  historicalWindowMinutes: number;
  /** Enable logging of all changes */
  logAllChanges: boolean;
  /** Settings persistence path */
  settingsPath?: string;
  /** Auto-save configuration */
  autoSave: boolean;
  /** Maximum history entries to keep */
  maxHistorySize: number;
  /** Default threshold configuration */
  defaultThresholds: ThresholdConfig;
  /** Adjustment rules */
  rules: AdjustmentRule[];
}

/**
 * Adjuster summary statistics
 */
export interface AdjusterSummary {
  /** Current market regime */
  currentRegime: MarketRegime;
  /** Regime duration in minutes */
  regimeDurationMinutes: number;
  /** Total adjustments made */
  totalAdjustments: number;
  /** Adjustments by reason */
  adjustmentsByReason: Record<AdjustmentReason, number>;
  /** Adjustments by threshold type */
  adjustmentsByType: Record<ThresholdType, number>;
  /** Current threshold configuration */
  currentThresholds: ThresholdConfig;
  /** Deviation from defaults (%) */
  deviationFromDefaults: {
    suspicionLow: number;
    suspicionMedium: number;
    suspicionHigh: number;
    suspicionCritical: number;
    flagThreshold: number;
    insiderThreshold: number;
  };
  /** Most recent conditions */
  lastConditions: MarketConditions | null;
  /** Most recent adjustment */
  lastAdjustment: ThresholdAdjustment | null;
  /** Auto-adjust status */
  autoAdjustEnabled: boolean;
  /** Rules summary */
  rulesStatus: {
    total: number;
    enabled: number;
    triggeredCount: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default threshold configuration
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  suspicionThresholds: { ...SUSPICION_THRESHOLDS },
  flagThreshold: 50,
  insiderThreshold: 70,
  signalMultipliers: {},
  categoryMultipliers: {},
};

/**
 * Default adjustment rules
 */
export const DEFAULT_ADJUSTMENT_RULES: AdjustmentRule[] = [
  {
    name: "High Volume Increase",
    description: "Increase thresholds during high volume periods to reduce noise",
    triggerMetrics: [ConditionMetric.VOLUME],
    triggerZScore: 2.0,
    targetThreshold: ThresholdType.SUSPICION_LEVEL,
    adjustmentPercent: 10,
    minAdjustment: 2,
    maxAdjustment: 15,
    enabled: true,
    priority: 10,
  },
  {
    name: "Low Activity Decrease",
    description: "Decrease thresholds during low activity to catch subtle patterns",
    triggerMetrics: [ConditionMetric.ACTIVE_TRADERS, ConditionMetric.VOLUME],
    triggerZScore: -1.5,
    targetThreshold: ThresholdType.SUSPICION_LEVEL,
    adjustmentPercent: -10,
    minAdjustment: 2,
    maxAdjustment: 10,
    enabled: true,
    priority: 9,
  },
  {
    name: "High Volatility Flag Increase",
    description: "Increase flag threshold during volatile periods",
    triggerMetrics: [ConditionMetric.VOLATILITY],
    triggerZScore: 2.5,
    targetThreshold: ThresholdType.FLAG_THRESHOLD,
    adjustmentPercent: 15,
    minAdjustment: 3,
    maxAdjustment: 20,
    enabled: true,
    priority: 8,
  },
  {
    name: "Fresh Wallet Surge",
    description: "Increase fresh wallet signal sensitivity during surge",
    triggerMetrics: [ConditionMetric.FRESH_WALLET_ACTIVITY],
    triggerZScore: 2.0,
    targetThreshold: ThresholdType.SIGNAL_THRESHOLD,
    targetKey: SignalSource.FRESH_WALLET,
    adjustmentPercent: -15,
    minAdjustment: 2,
    maxAdjustment: 15,
    enabled: true,
    priority: 7,
  },
  {
    name: "Extreme Conditions",
    description: "Conservative thresholds during extreme market conditions",
    triggerMetrics: [ConditionMetric.VOLUME, ConditionMetric.VOLATILITY],
    triggerZScore: 3.0,
    targetThreshold: ThresholdType.INSIDER_THRESHOLD,
    adjustmentPercent: 10,
    minAdjustment: 5,
    maxAdjustment: 15,
    enabled: true,
    priority: 15,
  },
  {
    name: "Low Liquidity Alert",
    description: "Increase sensitivity when liquidity is low",
    triggerMetrics: [ConditionMetric.LIQUIDITY],
    triggerZScore: -2.0,
    targetThreshold: ThresholdType.FLAG_THRESHOLD,
    adjustmentPercent: -10,
    minAdjustment: 2,
    maxAdjustment: 10,
    enabled: true,
    priority: 6,
  },
];

/**
 * Regime detection thresholds
 */
export const REGIME_THRESHOLDS = {
  /** Z-score threshold for high volatility */
  highVolatilityZScore: 2.0,
  /** Z-score threshold for low volatility */
  lowVolatilityZScore: -1.5,
  /** Z-score threshold for high activity */
  highActivityZScore: 1.5,
  /** Z-score threshold for low activity */
  lowActivityZScore: -1.5,
  /** Z-score threshold for extreme conditions */
  extremeZScore: 3.0,
  /** Minimum metrics needed to confirm regime */
  minMetricsForRegime: 2,
};

/**
 * Default configuration
 */
export const DEFAULT_ADJUSTER_CONFIG: DynamicThresholdAdjusterConfig = {
  autoAdjustEnabled: true,
  minAdjustmentIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxTotalAdjustmentPercent: 50,
  regimeSensitivity: 0.7,
  historicalWindowMinutes: 60 * 24, // 24 hours
  logAllChanges: true,
  autoSave: false,
  maxHistorySize: 1000,
  defaultThresholds: DEFAULT_THRESHOLDS,
  rules: DEFAULT_ADJUSTMENT_RULES,
};

/**
 * Metric descriptions
 */
export const METRIC_DESCRIPTIONS: Record<ConditionMetric, string> = {
  [ConditionMetric.VOLUME]: "Total trading volume across markets",
  [ConditionMetric.VOLATILITY]: "Price volatility measurement",
  [ConditionMetric.ACTIVE_TRADERS]: "Number of active trading wallets",
  [ConditionMetric.ACTIVE_MARKETS]: "Number of markets with activity",
  [ConditionMetric.TRADE_SIZE]: "Average trade size",
  [ConditionMetric.SENTIMENT]: "Market sentiment indicator",
  [ConditionMetric.LIQUIDITY]: "Available liquidity depth",
  [ConditionMetric.FRESH_WALLET_ACTIVITY]: "Fresh wallet trading activity",
};

/**
 * Regime descriptions
 */
export const REGIME_DESCRIPTIONS: Record<MarketRegime, string> = {
  [MarketRegime.NORMAL]: "Normal market conditions",
  [MarketRegime.HIGH_VOLATILITY]: "High price volatility",
  [MarketRegime.LOW_VOLATILITY]: "Low price volatility",
  [MarketRegime.HIGH_ACTIVITY]: "High trading activity",
  [MarketRegime.LOW_ACTIVITY]: "Low trading activity",
  [MarketRegime.BULL_MARKET]: "Bullish market trend",
  [MarketRegime.BEAR_MARKET]: "Bearish market trend",
  [MarketRegime.EXTREME]: "Extreme market conditions",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique adjustment ID
 */
function generateAdjustmentId(): string {
  return `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate z-score
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Deep clone object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Dynamic Threshold Adjuster Class
// ============================================================================

/**
 * Main dynamic threshold adjuster class
 */
export class DynamicThresholdAdjuster extends EventEmitter {
  private readonly config: DynamicThresholdAdjusterConfig;
  private currentThresholds: ThresholdConfig;
  private currentRegime: MarketRegime = MarketRegime.NORMAL;
  private regimeStartTime: Date = new Date();
  private lastConditions: MarketConditions | null = null;
  private lastAdjustmentTime: Date | null = null;
  private adjustmentHistory: ThresholdAdjustment[] = [];
  private regimeHistory: RegimeChangeEvent[] = [];
  private metricHistory: Map<ConditionMetric, MetricSnapshot[]> = new Map();
  private ruleTriggeredCounts: Map<string, number> = new Map();

  constructor(config: Partial<DynamicThresholdAdjusterConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_ADJUSTER_CONFIG,
      ...config,
      defaultThresholds: {
        ...DEFAULT_THRESHOLDS,
        ...config.defaultThresholds,
      },
      rules: config.rules ?? [...DEFAULT_ADJUSTMENT_RULES],
    };

    // Initialize current thresholds to defaults
    this.currentThresholds = deepClone(this.config.defaultThresholds);

    // Initialize metric history storage
    for (const metric of Object.values(ConditionMetric)) {
      this.metricHistory.set(metric, []);
    }

    // Initialize rule counters
    for (const rule of this.config.rules) {
      this.ruleTriggeredCounts.set(rule.name, 0);
    }

    // Try to load saved settings
    if (this.config.settingsPath) {
      this.loadFromFile();
    }
  }

  // ============================================================================
  // Core Threshold Methods
  // ============================================================================

  /**
   * Get current threshold configuration
   */
  getCurrentThresholds(): ThresholdConfig {
    return deepClone(this.currentThresholds);
  }

  /**
   * Get current suspicion thresholds
   */
  getSuspicionThresholds(): { low: number; medium: number; high: number; critical: number } {
    return { ...this.currentThresholds.suspicionThresholds };
  }

  /**
   * Get current flag threshold
   */
  getFlagThreshold(): number {
    return this.currentThresholds.flagThreshold;
  }

  /**
   * Get current insider threshold
   */
  getInsiderThreshold(): number {
    return this.currentThresholds.insiderThreshold;
  }

  /**
   * Get signal multiplier
   */
  getSignalMultiplier(signal: SignalSource): number {
    return this.currentThresholds.signalMultipliers[signal] ?? 1.0;
  }

  /**
   * Get category multiplier
   */
  getCategoryMultiplier(category: CompositeSignalCategory): number {
    return this.currentThresholds.categoryMultipliers[category] ?? 1.0;
  }

  /**
   * Get effective threshold for a suspicion level
   */
  getEffectiveThreshold(level: CompositeSuspicionLevel): number {
    switch (level) {
      case CompositeSuspicionLevel.LOW:
        return this.currentThresholds.suspicionThresholds.low;
      case CompositeSuspicionLevel.MEDIUM:
        return this.currentThresholds.suspicionThresholds.medium;
      case CompositeSuspicionLevel.HIGH:
        return this.currentThresholds.suspicionThresholds.high;
      case CompositeSuspicionLevel.CRITICAL:
        return this.currentThresholds.suspicionThresholds.critical;
      default:
        return 0;
    }
  }

  // ============================================================================
  // Market Condition Monitoring
  // ============================================================================

  /**
   * Update market conditions with new metrics
   */
  updateMarketConditions(metrics: Partial<Record<ConditionMetric, number>>): MarketConditions {
    const now = new Date();
    const metricSnapshots: Record<ConditionMetric, MetricSnapshot> = {} as Record<
      ConditionMetric,
      MetricSnapshot
    >;

    // Process each metric
    for (const [metric, value] of Object.entries(metrics) as [ConditionMetric, number][]) {
      const history = this.metricHistory.get(metric) ?? [];

      // Calculate historical stats
      const historicalValues = history.map((h) => h.value);
      const mean =
        historicalValues.length > 0
          ? historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
          : value;

      const variance =
        historicalValues.length > 1
          ? historicalValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
            (historicalValues.length - 1)
          : 0;
      const stdDev = Math.sqrt(variance);

      const zScore = calculateZScore(value, mean, stdDev);

      // Calculate percentile rank
      const belowCount = historicalValues.filter((v) => v < value).length;
      const percentileRank =
        historicalValues.length > 0 ? (belowCount / historicalValues.length) * 100 : 50;

      const snapshot: MetricSnapshot = {
        metric: metric as ConditionMetric,
        value,
        historicalAverage: mean,
        standardDeviation: stdDev,
        percentileRank,
        zScore,
        isAnomalous: Math.abs(zScore) > 2,
        measuredAt: now,
      };

      metricSnapshots[metric as ConditionMetric] = snapshot;

      // Add to history
      history.push(snapshot);

      // Trim history if needed
      const maxHistoryMs = this.config.historicalWindowMinutes * 60 * 1000;
      const cutoff = new Date(now.getTime() - maxHistoryMs);
      const trimmedHistory = history.filter((h) => h.measuredAt >= cutoff);
      this.metricHistory.set(metric as ConditionMetric, trimmedHistory);
    }

    // Fill in missing metrics with placeholder values
    for (const metric of Object.values(ConditionMetric)) {
      if (!metricSnapshots[metric]) {
        const history = this.metricHistory.get(metric) ?? [];
        const lastValue = history.length > 0 ? history[history.length - 1] : null;
        metricSnapshots[metric] = lastValue ?? {
          metric,
          value: 0,
          historicalAverage: 0,
          standardDeviation: 0,
          percentileRank: 50,
          zScore: 0,
          isAnomalous: false,
          measuredAt: now,
        };
      }
    }

    // Detect regime
    const previousRegime = this.currentRegime;
    const newRegime = this.detectRegime(metricSnapshots);

    // Calculate health score
    const healthScore = this.calculateHealthScore(metricSnapshots);

    // Build conditions object
    const conditions: MarketConditions = {
      regime: newRegime,
      metrics: metricSnapshots,
      healthScore,
      isUnusual: Object.values(metricSnapshots).some((m) => m.isAnomalous),
      confidence: this.calculateConditionConfidence(metricSnapshots),
      measuredAt: now,
      periodMinutes: this.config.historicalWindowMinutes,
    };

    this.lastConditions = conditions;

    // Handle regime change
    if (newRegime !== previousRegime) {
      this.handleRegimeChange(previousRegime, newRegime, metricSnapshots);
    }

    // Apply automatic adjustments if enabled
    if (this.config.autoAdjustEnabled) {
      this.applyAutomaticAdjustments(conditions);
    }

    this.emit("conditions-updated", conditions);

    return conditions;
  }

  /**
   * Detect current market regime from metrics
   */
  private detectRegime(metrics: Record<ConditionMetric, MetricSnapshot>): MarketRegime {
    const volumeZ = metrics[ConditionMetric.VOLUME]?.zScore ?? 0;
    const volatilityZ = metrics[ConditionMetric.VOLATILITY]?.zScore ?? 0;
    const tradersZ = metrics[ConditionMetric.ACTIVE_TRADERS]?.zScore ?? 0;
    const sentimentZ = metrics[ConditionMetric.SENTIMENT]?.zScore ?? 0;

    // Check for extreme conditions first
    const extremeCount = Object.values(metrics).filter(
      (m) => Math.abs(m.zScore) >= REGIME_THRESHOLDS.extremeZScore
    ).length;

    if (extremeCount >= REGIME_THRESHOLDS.minMetricsForRegime) {
      return MarketRegime.EXTREME;
    }

    // Check volatility-based regimes
    if (volatilityZ >= REGIME_THRESHOLDS.highVolatilityZScore) {
      return MarketRegime.HIGH_VOLATILITY;
    }
    if (volatilityZ <= REGIME_THRESHOLDS.lowVolatilityZScore) {
      return MarketRegime.LOW_VOLATILITY;
    }

    // Check activity-based regimes
    const activityZ = (volumeZ + tradersZ) / 2;
    if (activityZ >= REGIME_THRESHOLDS.highActivityZScore) {
      return MarketRegime.HIGH_ACTIVITY;
    }
    if (activityZ <= REGIME_THRESHOLDS.lowActivityZScore) {
      return MarketRegime.LOW_ACTIVITY;
    }

    // Check sentiment-based regimes (if significant)
    if (Math.abs(sentimentZ) >= 1.5) {
      return sentimentZ > 0 ? MarketRegime.BULL_MARKET : MarketRegime.BEAR_MARKET;
    }

    return MarketRegime.NORMAL;
  }

  /**
   * Handle regime change
   */
  private handleRegimeChange(
    previousRegime: MarketRegime,
    newRegime: MarketRegime,
    metrics: Record<ConditionMetric, MetricSnapshot>
  ): void {
    const now = new Date();
    const previousDuration =
      (now.getTime() - this.regimeStartTime.getTime()) / (1000 * 60);

    // Find triggering metrics
    const triggeringMetrics = Object.values(metrics)
      .filter((m) => m.isAnomalous)
      .map((m) => m.metric);

    const event: RegimeChangeEvent = {
      previousRegime,
      newRegime,
      confidence: this.config.regimeSensitivity,
      triggeringMetrics,
      detectedAt: now,
      previousRegimeDurationMinutes: previousDuration,
    };

    this.regimeHistory.push(event);
    this.currentRegime = newRegime;
    this.regimeStartTime = now;

    // Keep history bounded
    if (this.regimeHistory.length > this.config.maxHistorySize) {
      this.regimeHistory = this.regimeHistory.slice(-this.config.maxHistorySize);
    }

    this.emit("regime-change", event);
  }

  /**
   * Calculate market health score
   */
  private calculateHealthScore(metrics: Record<ConditionMetric, MetricSnapshot>): number {
    // Health score based on how many metrics are within normal range
    const normalCount = Object.values(metrics).filter(
      (m) => Math.abs(m.zScore) < 1.5
    ).length;
    const total = Object.keys(metrics).length;

    return Math.round((normalCount / total) * 100);
  }

  /**
   * Calculate condition confidence
   */
  private calculateConditionConfidence(
    metrics: Record<ConditionMetric, MetricSnapshot>
  ): number {
    // Confidence based on data availability and consistency
    const metricsWithHistory = Object.values(metrics).filter(
      (m) => m.standardDeviation > 0
    ).length;
    const total = Object.keys(metrics).length;

    return metricsWithHistory / total;
  }

  // ============================================================================
  // Automatic Adjustment Methods
  // ============================================================================

  /**
   * Apply automatic adjustments based on conditions
   */
  private applyAutomaticAdjustments(conditions: MarketConditions): void {
    // Check minimum interval
    if (this.lastAdjustmentTime) {
      const timeSince = Date.now() - this.lastAdjustmentTime.getTime();
      if (timeSince < this.config.minAdjustmentIntervalMs) {
        return;
      }
    }

    // Get enabled rules sorted by priority
    const enabledRules = this.config.rules
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      const shouldTrigger = this.evaluateRule(rule, conditions);

      if (shouldTrigger) {
        this.applyRule(rule, conditions);
      }
    }
  }

  /**
   * Evaluate if a rule should trigger
   */
  private evaluateRule(rule: AdjustmentRule, conditions: MarketConditions): boolean {
    // Check if any triggering metric crosses threshold
    for (const metric of rule.triggerMetrics) {
      const snapshot = conditions.metrics[metric];
      if (!snapshot) continue;

      // Handle both positive and negative z-score thresholds
      if (rule.triggerZScore >= 0) {
        if (snapshot.zScore >= rule.triggerZScore) {
          return true;
        }
      } else {
        if (snapshot.zScore <= rule.triggerZScore) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Apply an adjustment rule
   */
  private applyRule(rule: AdjustmentRule, conditions: MarketConditions): void {
    let previousValue: number;
    let newValue: number;

    switch (rule.targetThreshold) {
      case ThresholdType.SUSPICION_LEVEL:
        // Adjust all suspicion level thresholds
        for (const level of ["low", "medium", "high", "critical"] as const) {
          previousValue = this.currentThresholds.suspicionThresholds[level];
          newValue = this.calculateAdjustedValue(
            previousValue,
            rule.adjustmentPercent,
            rule.minAdjustment,
            rule.maxAdjustment,
            this.config.defaultThresholds.suspicionThresholds[level]
          );

          if (newValue !== previousValue) {
            this.recordAndApplyAdjustment(
              ThresholdType.SUSPICION_LEVEL,
              level,
              previousValue,
              newValue,
              rule.adjustmentPercent > 0
                ? AdjustmentDirection.INCREASE
                : AdjustmentDirection.DECREASE,
              AdjustmentReason.ADAPTIVE,
              conditions,
              `Rule: ${rule.name}`
            );
            this.currentThresholds.suspicionThresholds[level] = newValue;
          }
        }
        break;

      case ThresholdType.FLAG_THRESHOLD:
        previousValue = this.currentThresholds.flagThreshold;
        newValue = this.calculateAdjustedValue(
          previousValue,
          rule.adjustmentPercent,
          rule.minAdjustment,
          rule.maxAdjustment,
          this.config.defaultThresholds.flagThreshold
        );

        if (newValue !== previousValue) {
          this.recordAndApplyAdjustment(
            ThresholdType.FLAG_THRESHOLD,
            undefined,
            previousValue,
            newValue,
            rule.adjustmentPercent > 0
              ? AdjustmentDirection.INCREASE
              : AdjustmentDirection.DECREASE,
            AdjustmentReason.ADAPTIVE,
            conditions,
            `Rule: ${rule.name}`
          );
          this.currentThresholds.flagThreshold = newValue;
        }
        break;

      case ThresholdType.INSIDER_THRESHOLD:
        previousValue = this.currentThresholds.insiderThreshold;
        newValue = this.calculateAdjustedValue(
          previousValue,
          rule.adjustmentPercent,
          rule.minAdjustment,
          rule.maxAdjustment,
          this.config.defaultThresholds.insiderThreshold
        );

        if (newValue !== previousValue) {
          this.recordAndApplyAdjustment(
            ThresholdType.INSIDER_THRESHOLD,
            undefined,
            previousValue,
            newValue,
            rule.adjustmentPercent > 0
              ? AdjustmentDirection.INCREASE
              : AdjustmentDirection.DECREASE,
            AdjustmentReason.ADAPTIVE,
            conditions,
            `Rule: ${rule.name}`
          );
          this.currentThresholds.insiderThreshold = newValue;
        }
        break;

      case ThresholdType.SIGNAL_THRESHOLD:
        if (rule.targetKey) {
          const signal = rule.targetKey as SignalSource;
          previousValue = this.currentThresholds.signalMultipliers[signal] ?? 1.0;
          // For signal multipliers, adjust the multiplier itself
          const adjustedMultiplier = previousValue * (1 + rule.adjustmentPercent / 100);
          newValue = clamp(adjustedMultiplier, 0.5, 2.0);

          if (newValue !== previousValue) {
            this.recordAndApplyAdjustment(
              ThresholdType.SIGNAL_THRESHOLD,
              signal,
              previousValue,
              newValue,
              rule.adjustmentPercent > 0
                ? AdjustmentDirection.INCREASE
                : AdjustmentDirection.DECREASE,
              AdjustmentReason.ADAPTIVE,
              conditions,
              `Rule: ${rule.name}`
            );
            this.currentThresholds.signalMultipliers[signal] = newValue;
          }
        }
        break;

      case ThresholdType.CATEGORY_THRESHOLD:
        if (rule.targetKey) {
          const category = rule.targetKey as CompositeSignalCategory;
          previousValue = this.currentThresholds.categoryMultipliers[category] ?? 1.0;
          const adjustedMultiplier = previousValue * (1 + rule.adjustmentPercent / 100);
          newValue = clamp(adjustedMultiplier, 0.5, 2.0);

          if (newValue !== previousValue) {
            this.recordAndApplyAdjustment(
              ThresholdType.CATEGORY_THRESHOLD,
              category,
              previousValue,
              newValue,
              rule.adjustmentPercent > 0
                ? AdjustmentDirection.INCREASE
                : AdjustmentDirection.DECREASE,
              AdjustmentReason.ADAPTIVE,
              conditions,
              `Rule: ${rule.name}`
            );
            this.currentThresholds.categoryMultipliers[category] = newValue;
          }
        }
        break;
    }

    // Update rule counter
    const count = this.ruleTriggeredCounts.get(rule.name) ?? 0;
    this.ruleTriggeredCounts.set(rule.name, count + 1);
  }

  /**
   * Calculate adjusted threshold value
   */
  private calculateAdjustedValue(
    currentValue: number,
    adjustmentPercent: number,
    minAdjustment: number,
    maxAdjustment: number,
    defaultValue: number
  ): number {
    // Calculate raw adjustment
    let adjustment = currentValue * (adjustmentPercent / 100);

    // Apply min/max constraints
    adjustment = Math.sign(adjustment) * clamp(Math.abs(adjustment), minAdjustment, maxAdjustment);

    // Calculate new value
    let newValue = currentValue + adjustment;

    // Ensure we don't exceed max total adjustment from default
    const maxDeviation = defaultValue * (this.config.maxTotalAdjustmentPercent / 100);
    const minAllowed = defaultValue - maxDeviation;
    const maxAllowed = defaultValue + maxDeviation;

    newValue = clamp(newValue, minAllowed, maxAllowed);

    // Round to 1 decimal place
    return Math.round(newValue * 10) / 10;
  }

  /**
   * Record and apply a threshold adjustment
   */
  private recordAndApplyAdjustment(
    thresholdType: ThresholdType,
    thresholdKey: string | undefined,
    previousValue: number,
    newValue: number,
    direction: AdjustmentDirection,
    reason: AdjustmentReason,
    conditions: MarketConditions,
    triggeredBy: string,
    notes?: string
  ): void {
    const adjustment: ThresholdAdjustment = {
      id: generateAdjustmentId(),
      thresholdType,
      thresholdKey,
      previousValue,
      newValue,
      direction,
      percentageChange: previousValue !== 0 ? ((newValue - previousValue) / previousValue) * 100 : 0,
      reason,
      marketConditions: deepClone(conditions),
      adjustedAt: new Date(),
      triggeredBy,
      notes,
    };

    this.adjustmentHistory.push(adjustment);
    this.lastAdjustmentTime = adjustment.adjustedAt;

    // Keep history bounded
    if (this.adjustmentHistory.length > this.config.maxHistorySize) {
      this.adjustmentHistory = this.adjustmentHistory.slice(-this.config.maxHistorySize);
    }

    // Log if enabled
    if (this.config.logAllChanges) {
      this.emit("threshold-adjusted", adjustment);
    }

    // Auto-save if enabled
    if (this.config.autoSave && this.config.settingsPath) {
      this.saveToFile();
    }
  }

  // ============================================================================
  // Manual Adjustment Methods
  // ============================================================================

  /**
   * Manually set suspicion threshold
   */
  setSuspicionThreshold(
    level: "low" | "medium" | "high" | "critical",
    value: number,
    triggeredBy: string = "manual"
  ): boolean {
    if (value < 0 || value > 100) {
      return false;
    }

    const previousValue = this.currentThresholds.suspicionThresholds[level];
    if (previousValue === value) {
      return true;
    }

    // Validate ordering
    const thresholds = { ...this.currentThresholds.suspicionThresholds };
    thresholds[level] = value;

    if (thresholds.low >= thresholds.medium ||
        thresholds.medium >= thresholds.high ||
        thresholds.high >= thresholds.critical) {
      return false;
    }

    const direction =
      value > previousValue ? AdjustmentDirection.INCREASE : AdjustmentDirection.DECREASE;

    this.recordAndApplyAdjustment(
      ThresholdType.SUSPICION_LEVEL,
      level,
      previousValue,
      value,
      direction,
      AdjustmentReason.MANUAL,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      `Manual override of ${level} threshold`
    );

    this.currentThresholds.suspicionThresholds[level] = value;
    return true;
  }

  /**
   * Manually set flag threshold
   */
  setFlagThreshold(value: number, triggeredBy: string = "manual"): boolean {
    if (value < 0 || value > 100) {
      return false;
    }

    const previousValue = this.currentThresholds.flagThreshold;
    if (previousValue === value) {
      return true;
    }

    const direction =
      value > previousValue ? AdjustmentDirection.INCREASE : AdjustmentDirection.DECREASE;

    this.recordAndApplyAdjustment(
      ThresholdType.FLAG_THRESHOLD,
      undefined,
      previousValue,
      value,
      direction,
      AdjustmentReason.MANUAL,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      "Manual override of flag threshold"
    );

    this.currentThresholds.flagThreshold = value;
    return true;
  }

  /**
   * Manually set insider threshold
   */
  setInsiderThreshold(value: number, triggeredBy: string = "manual"): boolean {
    if (value < 0 || value > 100) {
      return false;
    }

    const previousValue = this.currentThresholds.insiderThreshold;
    if (previousValue === value) {
      return true;
    }

    const direction =
      value > previousValue ? AdjustmentDirection.INCREASE : AdjustmentDirection.DECREASE;

    this.recordAndApplyAdjustment(
      ThresholdType.INSIDER_THRESHOLD,
      undefined,
      previousValue,
      value,
      direction,
      AdjustmentReason.MANUAL,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      "Manual override of insider threshold"
    );

    this.currentThresholds.insiderThreshold = value;
    return true;
  }

  /**
   * Manually set signal multiplier
   */
  setSignalMultiplier(
    signal: SignalSource,
    multiplier: number,
    triggeredBy: string = "manual"
  ): boolean {
    if (multiplier < 0.1 || multiplier > 5.0) {
      return false;
    }

    const previousValue = this.currentThresholds.signalMultipliers[signal] ?? 1.0;
    if (previousValue === multiplier) {
      return true;
    }

    const direction =
      multiplier > previousValue ? AdjustmentDirection.INCREASE : AdjustmentDirection.DECREASE;

    this.recordAndApplyAdjustment(
      ThresholdType.SIGNAL_THRESHOLD,
      signal,
      previousValue,
      multiplier,
      direction,
      AdjustmentReason.MANUAL,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      `Manual override of ${signal} multiplier`
    );

    this.currentThresholds.signalMultipliers[signal] = multiplier;
    return true;
  }

  /**
   * Manually set category multiplier
   */
  setCategoryMultiplier(
    category: CompositeSignalCategory,
    multiplier: number,
    triggeredBy: string = "manual"
  ): boolean {
    if (multiplier < 0.1 || multiplier > 5.0) {
      return false;
    }

    const previousValue = this.currentThresholds.categoryMultipliers[category] ?? 1.0;
    if (previousValue === multiplier) {
      return true;
    }

    const direction =
      multiplier > previousValue ? AdjustmentDirection.INCREASE : AdjustmentDirection.DECREASE;

    this.recordAndApplyAdjustment(
      ThresholdType.CATEGORY_THRESHOLD,
      category,
      previousValue,
      multiplier,
      direction,
      AdjustmentReason.MANUAL,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      `Manual override of ${category} multiplier`
    );

    this.currentThresholds.categoryMultipliers[category] = multiplier;
    return true;
  }

  // ============================================================================
  // Reset and Configuration Methods
  // ============================================================================

  /**
   * Reset thresholds to defaults
   */
  resetToDefaults(triggeredBy: string = "system"): void {
    const previousConfig = deepClone(this.currentThresholds);
    this.currentThresholds = deepClone(this.config.defaultThresholds);

    // Record reset
    this.recordAndApplyAdjustment(
      ThresholdType.SUSPICION_LEVEL,
      "all",
      0,
      0,
      AdjustmentDirection.NONE,
      AdjustmentReason.RESET,
      this.lastConditions ?? this.createDefaultConditions(),
      triggeredBy,
      `Reset all thresholds to defaults from: ${JSON.stringify(previousConfig)}`
    );

    this.emit("thresholds-reset");
  }

  /**
   * Enable or disable automatic adjustments
   */
  setAutoAdjustEnabled(enabled: boolean): void {
    this.config.autoAdjustEnabled = enabled;
    this.emit("auto-adjust-changed", { enabled });
  }

  /**
   * Get auto-adjust status
   */
  isAutoAdjustEnabled(): boolean {
    return this.config.autoAdjustEnabled;
  }

  /**
   * Add a custom adjustment rule
   */
  addRule(rule: AdjustmentRule): void {
    this.config.rules.push(rule);
    this.ruleTriggeredCounts.set(rule.name, 0);
    this.emit("rule-added", rule);
  }

  /**
   * Remove an adjustment rule
   */
  removeRule(ruleName: string): boolean {
    const index = this.config.rules.findIndex((r) => r.name === ruleName);
    if (index === -1) {
      return false;
    }

    const removed = this.config.rules.splice(index, 1)[0];
    this.ruleTriggeredCounts.delete(ruleName);
    this.emit("rule-removed", removed);
    return true;
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleName: string, enabled: boolean): boolean {
    const rule = this.config.rules.find((r) => r.name === ruleName);
    if (!rule) {
      return false;
    }

    rule.enabled = enabled;
    this.emit("rule-updated", rule);
    return true;
  }

  /**
   * Get all rules
   */
  getRules(): AdjustmentRule[] {
    return [...this.config.rules];
  }

  // ============================================================================
  // History and Analysis Methods
  // ============================================================================

  /**
   * Get current market regime
   */
  getCurrentRegime(): MarketRegime {
    return this.currentRegime;
  }

  /**
   * Get last market conditions
   */
  getLastConditions(): MarketConditions | null {
    return this.lastConditions ? deepClone(this.lastConditions) : null;
  }

  /**
   * Get adjustment history
   */
  getAdjustmentHistory(limit?: number): ThresholdAdjustment[] {
    const history = [...this.adjustmentHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get regime change history
   */
  getRegimeHistory(limit?: number): RegimeChangeEvent[] {
    const history = [...this.regimeHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get deviation from defaults
   */
  getDeviationFromDefaults(): {
    suspicionLow: number;
    suspicionMedium: number;
    suspicionHigh: number;
    suspicionCritical: number;
    flagThreshold: number;
    insiderThreshold: number;
  } {
    const defaults = this.config.defaultThresholds;
    const current = this.currentThresholds;

    return {
      suspicionLow: this.calculatePercentDeviation(
        current.suspicionThresholds.low,
        defaults.suspicionThresholds.low
      ),
      suspicionMedium: this.calculatePercentDeviation(
        current.suspicionThresholds.medium,
        defaults.suspicionThresholds.medium
      ),
      suspicionHigh: this.calculatePercentDeviation(
        current.suspicionThresholds.high,
        defaults.suspicionThresholds.high
      ),
      suspicionCritical: this.calculatePercentDeviation(
        current.suspicionThresholds.critical,
        defaults.suspicionThresholds.critical
      ),
      flagThreshold: this.calculatePercentDeviation(
        current.flagThreshold,
        defaults.flagThreshold
      ),
      insiderThreshold: this.calculatePercentDeviation(
        current.insiderThreshold,
        defaults.insiderThreshold
      ),
    };
  }

  /**
   * Calculate percentage deviation
   */
  private calculatePercentDeviation(current: number, baseline: number): number {
    if (baseline === 0) return 0;
    return Math.round(((current - baseline) / baseline) * 100 * 10) / 10;
  }

  /**
   * Get summary statistics
   */
  getSummary(): AdjusterSummary {
    const now = new Date();
    const regimeDuration =
      (now.getTime() - this.regimeStartTime.getTime()) / (1000 * 60);

    // Count adjustments by reason
    const adjustmentsByReason: Record<AdjustmentReason, number> = {} as Record<
      AdjustmentReason,
      number
    >;
    for (const reason of Object.values(AdjustmentReason)) {
      adjustmentsByReason[reason] = 0;
    }
    for (const adj of this.adjustmentHistory) {
      adjustmentsByReason[adj.reason]++;
    }

    // Count adjustments by type
    const adjustmentsByType: Record<ThresholdType, number> = {} as Record<
      ThresholdType,
      number
    >;
    for (const type of Object.values(ThresholdType)) {
      adjustmentsByType[type] = 0;
    }
    for (const adj of this.adjustmentHistory) {
      adjustmentsByType[adj.thresholdType]++;
    }

    // Get enabled rules count
    const enabledRules = this.config.rules.filter((r) => r.enabled).length;
    const totalTriggered = Array.from(this.ruleTriggeredCounts.values()).reduce(
      (a, b) => a + b,
      0
    );

    const deviation = this.getDeviationFromDefaults();

    return {
      currentRegime: this.currentRegime,
      regimeDurationMinutes: Math.round(regimeDuration),
      totalAdjustments: this.adjustmentHistory.length,
      adjustmentsByReason,
      adjustmentsByType,
      currentThresholds: deepClone(this.currentThresholds),
      deviationFromDefaults: {
        suspicionLow: deviation.suspicionLow,
        suspicionMedium: deviation.suspicionMedium,
        suspicionHigh: deviation.suspicionHigh,
        suspicionCritical: deviation.suspicionCritical,
        flagThreshold: deviation.flagThreshold,
        insiderThreshold: deviation.insiderThreshold,
      },
      lastConditions: this.lastConditions ? deepClone(this.lastConditions) : null,
      lastAdjustment: this.adjustmentHistory.length > 0
        ? this.adjustmentHistory[this.adjustmentHistory.length - 1] ?? null
        : null,
      autoAdjustEnabled: this.config.autoAdjustEnabled,
      rulesStatus: {
        total: this.config.rules.length,
        enabled: enabledRules,
        triggeredCount: totalTriggered,
      },
    };
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Save configuration to file
   */
  saveToFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.config.settingsPath;
    if (!targetPath) {
      return false;
    }

    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        currentThresholds: this.currentThresholds,
        currentRegime: this.currentRegime,
        autoAdjustEnabled: this.config.autoAdjustEnabled,
        rules: this.config.rules,
        savedAt: new Date().toISOString(),
      };

      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf8");
      this.emit("config-saved", { path: targetPath });
      return true;
    } catch (error) {
      this.emit("save-error", { path: targetPath, error });
      return false;
    }
  }

  /**
   * Load configuration from file
   */
  loadFromFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.config.settingsPath;
    if (!targetPath) {
      return false;
    }

    try {
      if (!fs.existsSync(targetPath)) {
        return false;
      }

      const content = fs.readFileSync(targetPath, "utf8");
      const data = JSON.parse(content);

      if (data.currentThresholds) {
        this.currentThresholds = {
          ...this.config.defaultThresholds,
          ...data.currentThresholds,
        };
      }

      if (data.currentRegime) {
        this.currentRegime = data.currentRegime;
      }

      if (data.autoAdjustEnabled !== undefined) {
        this.config.autoAdjustEnabled = data.autoAdjustEnabled;
      }

      if (data.rules) {
        this.config.rules = data.rules;
        for (const rule of this.config.rules) {
          this.ruleTriggeredCounts.set(rule.name, 0);
        }
      }

      this.emit("config-loaded", { path: targetPath });
      return true;
    } catch (error) {
      this.emit("load-error", { path: targetPath, error });
      return false;
    }
  }

  /**
   * Export current configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      currentThresholds: this.currentThresholds,
      currentRegime: this.currentRegime,
      autoAdjustEnabled: this.config.autoAdjustEnabled,
      rules: this.config.rules,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(json: string, triggeredBy: string = "import"): boolean {
    try {
      const data = JSON.parse(json);

      if (data.currentThresholds) {
        const previousConfig = deepClone(this.currentThresholds);
        this.currentThresholds = {
          ...this.config.defaultThresholds,
          ...data.currentThresholds,
        };

        this.recordAndApplyAdjustment(
          ThresholdType.SUSPICION_LEVEL,
          "all",
          0,
          0,
          AdjustmentDirection.NONE,
          AdjustmentReason.MANUAL,
          this.lastConditions ?? this.createDefaultConditions(),
          triggeredBy,
          `Imported configuration, previous: ${JSON.stringify(previousConfig)}`
        );
      }

      if (data.rules) {
        this.config.rules = data.rules;
      }

      this.emit("config-imported");
      return true;
    } catch (error) {
      this.emit("import-error", { error });
      return false;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Create default conditions when none available
   */
  private createDefaultConditions(): MarketConditions {
    const now = new Date();
    const defaultMetric = (metric: ConditionMetric): MetricSnapshot => ({
      metric,
      value: 0,
      historicalAverage: 0,
      standardDeviation: 0,
      percentileRank: 50,
      zScore: 0,
      isAnomalous: false,
      measuredAt: now,
    });

    const metrics: Record<ConditionMetric, MetricSnapshot> = {} as Record<
      ConditionMetric,
      MetricSnapshot
    >;
    for (const metric of Object.values(ConditionMetric)) {
      metrics[metric] = defaultMetric(metric);
    }

    return {
      regime: MarketRegime.NORMAL,
      metrics,
      healthScore: 100,
      isUnusual: false,
      confidence: 0,
      measuredAt: now,
      periodMinutes: 0,
    };
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.adjustmentHistory = [];
    this.regimeHistory = [];
    for (const metric of Object.values(ConditionMetric)) {
      this.metricHistory.set(metric, []);
    }
    for (const rule of this.config.rules) {
      this.ruleTriggeredCounts.set(rule.name, 0);
    }
    this.emit("history-cleared");
  }

  /**
   * Get configuration
   */
  getConfig(): DynamicThresholdAdjusterConfig {
    return deepClone(this.config);
  }
}

// ============================================================================
// Shared Instance Management
// ============================================================================

let sharedInstance: DynamicThresholdAdjuster | null = null;

/**
 * Get shared adjuster instance
 */
export function getSharedDynamicThresholdAdjuster(): DynamicThresholdAdjuster {
  if (!sharedInstance) {
    sharedInstance = new DynamicThresholdAdjuster();
  }
  return sharedInstance;
}

/**
 * Set shared adjuster instance
 */
export function setSharedDynamicThresholdAdjuster(
  adjuster: DynamicThresholdAdjuster
): void {
  sharedInstance = adjuster;
}

/**
 * Reset shared adjuster instance
 */
export function resetSharedDynamicThresholdAdjuster(): void {
  sharedInstance = null;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new adjuster with config
 */
export function createDynamicThresholdAdjuster(
  config?: Partial<DynamicThresholdAdjusterConfig>
): DynamicThresholdAdjuster {
  return new DynamicThresholdAdjuster(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Update market conditions on shared instance
 */
export function updateMarketConditions(
  metrics: Partial<Record<ConditionMetric, number>>
): MarketConditions {
  return getSharedDynamicThresholdAdjuster().updateMarketConditions(metrics);
}

/**
 * Get current thresholds from shared instance
 */
export function getCurrentThresholds(): ThresholdConfig {
  return getSharedDynamicThresholdAdjuster().getCurrentThresholds();
}

/**
 * Get current regime from shared instance
 */
export function getCurrentRegime(): MarketRegime {
  return getSharedDynamicThresholdAdjuster().getCurrentRegime();
}

/**
 * Get adjustment history from shared instance
 */
export function getAdjustmentHistory(limit?: number): ThresholdAdjustment[] {
  return getSharedDynamicThresholdAdjuster().getAdjustmentHistory(limit);
}

/**
 * Reset thresholds to defaults on shared instance
 */
export function resetThresholdsToDefaults(triggeredBy?: string): void {
  getSharedDynamicThresholdAdjuster().resetToDefaults(triggeredBy);
}

/**
 * Get adjuster summary from shared instance
 */
export function getAdjusterSummary(): AdjusterSummary {
  return getSharedDynamicThresholdAdjuster().getSummary();
}

/**
 * Set suspicion threshold on shared instance
 */
export function setDynamicSuspicionThreshold(
  level: "low" | "medium" | "high" | "critical",
  value: number,
  triggeredBy?: string
): boolean {
  return getSharedDynamicThresholdAdjuster().setSuspicionThreshold(
    level,
    value,
    triggeredBy
  );
}

/**
 * Set flag threshold on shared instance
 */
export function setDynamicFlagThreshold(value: number, triggeredBy?: string): boolean {
  return getSharedDynamicThresholdAdjuster().setFlagThreshold(value, triggeredBy);
}

/**
 * Set insider threshold on shared instance
 */
export function setDynamicInsiderThreshold(value: number, triggeredBy?: string): boolean {
  return getSharedDynamicThresholdAdjuster().setInsiderThreshold(value, triggeredBy);
}

/**
 * Enable/disable auto-adjust on shared instance
 */
export function setDynamicAutoAdjust(enabled: boolean): void {
  getSharedDynamicThresholdAdjuster().setAutoAdjustEnabled(enabled);
}

/**
 * Check if auto-adjust is enabled on shared instance
 */
export function isDynamicAutoAdjustEnabled(): boolean {
  return getSharedDynamicThresholdAdjuster().isAutoAdjustEnabled();
}

// ============================================================================
// Description Helper Functions
// ============================================================================

/**
 * Get regime description
 */
export function getRegimeDescription(regime: MarketRegime): string {
  return REGIME_DESCRIPTIONS[regime] ?? "Unknown regime";
}

/**
 * Get metric description
 */
export function getMetricDescription(metric: ConditionMetric): string {
  return METRIC_DESCRIPTIONS[metric] ?? "Unknown metric";
}

/**
 * Get threshold type description
 */
export function getThresholdTypeDescription(type: ThresholdType): string {
  switch (type) {
    case ThresholdType.SUSPICION_LEVEL:
      return "Suspicion level classification thresholds";
    case ThresholdType.FLAG_THRESHOLD:
      return "Threshold for flagging wallets for review";
    case ThresholdType.INSIDER_THRESHOLD:
      return "Threshold for potential insider detection";
    case ThresholdType.SIGNAL_THRESHOLD:
      return "Signal-specific threshold multiplier";
    case ThresholdType.CATEGORY_THRESHOLD:
      return "Category-specific threshold multiplier";
    default:
      return "Unknown threshold type";
  }
}

/**
 * Get adjustment reason description
 */
export function getAdjustmentReasonDescription(reason: AdjustmentReason): string {
  switch (reason) {
    case AdjustmentReason.REGIME_CHANGE:
      return "Market regime changed";
    case AdjustmentReason.METRIC_THRESHOLD:
      return "Metric crossed threshold";
    case AdjustmentReason.SCHEDULED:
      return "Scheduled periodic adjustment";
    case AdjustmentReason.MANUAL:
      return "Manual override";
    case AdjustmentReason.INITIALIZATION:
      return "System initialization";
    case AdjustmentReason.RESET:
      return "Reset to defaults";
    case AdjustmentReason.ADAPTIVE:
      return "Adaptive learning adjustment";
    default:
      return "Unknown reason";
  }
}
