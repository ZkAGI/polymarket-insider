/**
 * Model Performance Dashboard (AI-PRED-004)
 *
 * Dashboard showing AI model performance metrics for the insider detection system.
 * Collects metrics from all AI prediction models, creates performance charts,
 * tracks accuracy over time, and alerts on performance drops.
 *
 * Features:
 * - Aggregate metrics from InsiderProbabilityPredictor
 * - Aggregate metrics from MarketOutcomePredictor
 * - Aggregate metrics from SignalEffectivenessTracker
 * - Create performance charts data
 * - Track accuracy over time with historical data points
 * - Alert on performance drops when accuracy falls below thresholds
 * - Support multiple time windows for analysis
 * - Cache metrics for efficient access
 */

import { EventEmitter } from "events";
import {
  InsiderProbabilityPredictor,
  ModelAccuracyMetrics,
  getSharedInsiderProbabilityPredictor,
} from "./insider-probability-predictor";
import {
  SignalEffectivenessTracker,
  EffectivenessTimeWindow,
  getSharedSignalEffectivenessTracker,
} from "./signal-effectiveness-tracker";
import {
  MarketOutcomePredictor,
  getSharedMarketOutcomePredictor,
} from "./market-outcome-predictor";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Model types tracked by the dashboard
 */
export enum ModelType {
  /** Insider probability prediction model */
  INSIDER_PREDICTOR = "INSIDER_PREDICTOR",
  /** Market outcome prediction model */
  MARKET_PREDICTOR = "MARKET_PREDICTOR",
  /** Signal effectiveness tracking */
  SIGNAL_TRACKER = "SIGNAL_TRACKER",
}

/**
 * Performance alert severity levels
 */
export enum AlertSeverity {
  /** Info level - minor fluctuation */
  INFO = "INFO",
  /** Warning level - notable drop */
  WARNING = "WARNING",
  /** Critical level - significant performance issue */
  CRITICAL = "CRITICAL",
}

/**
 * Time window for dashboard metrics
 */
export enum DashboardTimeWindow {
  /** Last hour */
  LAST_HOUR = "LAST_HOUR",
  /** Last 24 hours */
  LAST_24H = "LAST_24H",
  /** Last 7 days */
  LAST_7D = "LAST_7D",
  /** Last 30 days */
  LAST_30D = "LAST_30D",
  /** All time */
  ALL_TIME = "ALL_TIME",
}

/**
 * Individual model performance metrics
 */
export interface ModelPerformanceMetrics {
  /** Model type */
  modelType: ModelType;
  /** Model name for display */
  modelName: string;
  /** Total predictions made */
  totalPredictions: number;
  /** Verified predictions (with known outcomes) */
  verifiedPredictions: number;
  /** Current accuracy (0-1) */
  accuracy: number;
  /** Current precision (0-1) */
  precision: number;
  /** Current recall (0-1) */
  recall: number;
  /** F1 score (0-1) */
  f1Score: number;
  /** Brier score (calibration metric, lower is better) */
  brierScore: number;
  /** AUC-ROC score */
  aucRoc: number;
  /** True positive count */
  truePositives: number;
  /** True negative count */
  trueNegatives: number;
  /** False positive count */
  falsePositives: number;
  /** False negative count */
  falseNegatives: number;
  /** Is model currently healthy */
  isHealthy: boolean;
  /** Health status message */
  healthMessage: string;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Historical accuracy data point
 */
export interface AccuracyDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Accuracy at this point */
  accuracy: number;
  /** Sample size (cumulative or period) */
  sampleSize: number;
  /** Rolling 7-day average */
  rollingAvg7d?: number;
  /** Rolling 30-day average */
  rollingAvg30d?: number;
}

/**
 * Historical accuracy trend
 */
export interface AccuracyTrend {
  /** Model type */
  modelType: ModelType;
  /** Data points */
  dataPoints: AccuracyDataPoint[];
  /** Current accuracy */
  currentAccuracy: number;
  /** Previous period accuracy */
  previousAccuracy: number;
  /** Change from previous period */
  change: number;
  /** Change percentage */
  changePercent: number;
  /** Trend direction */
  trend: "UP" | "DOWN" | "STABLE";
  /** Time window analyzed */
  timeWindow: DashboardTimeWindow;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Alert ID */
  alertId: string;
  /** Model type affected */
  modelType: ModelType;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Current metric value */
  currentValue: number;
  /** Expected/threshold value */
  thresholdValue: number;
  /** Difference from threshold */
  difference: number;
  /** When alert was created */
  createdAt: Date;
  /** Is alert acknowledged */
  acknowledged: boolean;
  /** When alert was acknowledged */
  acknowledgedAt?: Date;
  /** Recommended actions */
  recommendedActions: string[];
}

/**
 * Overall dashboard summary
 */
export interface DashboardSummary {
  /** Overall system health status */
  overallHealth: "HEALTHY" | "WARNING" | "CRITICAL";
  /** Overall health score (0-100) */
  healthScore: number;
  /** Total predictions across all models */
  totalPredictions: number;
  /** Total verified predictions */
  totalVerified: number;
  /** Average accuracy across models */
  averageAccuracy: number;
  /** Number of active alerts */
  activeAlerts: number;
  /** Best performing model */
  bestPerformingModel?: {
    modelType: ModelType;
    accuracy: number;
  };
  /** Worst performing model */
  worstPerformingModel?: {
    modelType: ModelType;
    accuracy: number;
  };
  /** Last refresh timestamp */
  lastRefresh: Date;
}

/**
 * Chart data for performance visualization
 */
export interface PerformanceChartData {
  /** Chart title */
  title: string;
  /** Chart type */
  chartType: "LINE" | "BAR" | "PIE" | "GAUGE";
  /** Labels (x-axis or categories) */
  labels: string[];
  /** Data series */
  series: Array<{
    name: string;
    data: number[];
    color?: string;
  }>;
  /** Y-axis label */
  yAxisLabel?: string;
  /** X-axis label */
  xAxisLabel?: string;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Accuracy threshold for warning alert */
  accuracyWarningThreshold: number;
  /** Accuracy threshold for critical alert */
  accuracyCriticalThreshold: number;
  /** Minimum predictions before alerting */
  minPredictionsForAlert: number;
  /** Performance drop percentage for alert */
  performanceDropAlertPercent: number;
  /** Enable caching */
  cacheEnabled: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Refresh interval in milliseconds */
  refreshIntervalMs: number;
  /** Historical data retention days */
  historicalRetentionDays: number;
  /** Enable automatic alerting */
  alertingEnabled: boolean;
}

/**
 * Dashboard events
 */
export interface DashboardEvents {
  /** Metrics refreshed */
  metrics_refreshed: DashboardSummary;
  /** New alert generated */
  alert_generated: PerformanceAlert;
  /** Alert acknowledged */
  alert_acknowledged: { alertId: string };
  /** Performance drop detected */
  performance_drop: {
    modelType: ModelType;
    previousAccuracy: number;
    currentAccuracy: number;
    dropPercent: number;
  };
  /** Model recovered */
  model_recovered: {
    modelType: ModelType;
    previousAccuracy: number;
    currentAccuracy: number;
  };
  /** Cache hit */
  cache_hit: { key: string };
  /** Cache miss */
  cache_miss: { key: string };
  /** Error occurred */
  error: { message: string; context?: string };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default dashboard configuration
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  accuracyWarningThreshold: 0.55,
  accuracyCriticalThreshold: 0.45,
  minPredictionsForAlert: 50,
  performanceDropAlertPercent: 10,
  cacheEnabled: true,
  cacheTtlMs: 60 * 1000, // 1 minute
  refreshIntervalMs: 5 * 60 * 1000, // 5 minutes
  historicalRetentionDays: 90,
  alertingEnabled: true,
};

/**
 * Model type display names
 */
export const MODEL_TYPE_NAMES: Record<ModelType, string> = {
  [ModelType.INSIDER_PREDICTOR]: "Insider Probability Predictor",
  [ModelType.MARKET_PREDICTOR]: "Market Outcome Predictor",
  [ModelType.SIGNAL_TRACKER]: "Signal Effectiveness Tracker",
};

/**
 * Model type descriptions
 */
export const MODEL_TYPE_DESCRIPTIONS: Record<ModelType, string> = {
  [ModelType.INSIDER_PREDICTOR]:
    "Predicts probability of insider trading activity based on wallet behavior, timing, and patterns",
  [ModelType.MARKET_PREDICTOR]:
    "Predicts market outcomes using multiple signals and historical patterns",
  [ModelType.SIGNAL_TRACKER]:
    "Tracks effectiveness of various trading signals in predicting market outcomes",
};

/**
 * Alert severity colors
 */
export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: "#3B82F6", // Blue
  [AlertSeverity.WARNING]: "#F59E0B", // Yellow/Orange
  [AlertSeverity.CRITICAL]: "#EF4444", // Red
};

/**
 * Health status colors
 */
export const HEALTH_STATUS_COLORS: Record<"HEALTHY" | "WARNING" | "CRITICAL", string> = {
  HEALTHY: "#10B981", // Green
  WARNING: "#F59E0B", // Yellow/Orange
  CRITICAL: "#EF4444", // Red
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique alert ID
 */
export function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get time window in milliseconds
 */
export function getTimeWindowMs(window: DashboardTimeWindow): number {
  switch (window) {
    case DashboardTimeWindow.LAST_HOUR:
      return 60 * 60 * 1000;
    case DashboardTimeWindow.LAST_24H:
      return 24 * 60 * 60 * 1000;
    case DashboardTimeWindow.LAST_7D:
      return 7 * 24 * 60 * 60 * 1000;
    case DashboardTimeWindow.LAST_30D:
      return 30 * 24 * 60 * 60 * 1000;
    case DashboardTimeWindow.ALL_TIME:
      return Infinity;
    default:
      return Infinity;
  }
}

/**
 * Get cutoff date for time window
 */
export function getTimeWindowCutoff(window: DashboardTimeWindow): Date {
  const ms = getTimeWindowMs(window);
  if (ms === Infinity) {
    return new Date(0);
  }
  return new Date(Date.now() - ms);
}

/**
 * Format accuracy as percentage string
 */
export function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1)}%`;
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Calculate health score from accuracy
 */
export function calculateHealthScore(accuracy: number, threshold: number = 0.5): number {
  if (accuracy >= 0.8) return 100;
  if (accuracy >= 0.7) return 85;
  if (accuracy >= 0.6) return 70;
  if (accuracy >= threshold) return 55;
  if (accuracy >= 0.4) return 35;
  return 20;
}

/**
 * Determine trend direction from change
 */
export function determineTrendDirection(
  change: number,
  threshold: number = 0.02
): "UP" | "DOWN" | "STABLE" {
  if (change > threshold) return "UP";
  if (change < -threshold) return "DOWN";
  return "STABLE";
}

/**
 * Get effectiveness time window equivalent
 */
function toEffectivenessTimeWindow(window: DashboardTimeWindow): EffectivenessTimeWindow {
  switch (window) {
    case DashboardTimeWindow.LAST_24H:
      return EffectivenessTimeWindow.LAST_24H;
    case DashboardTimeWindow.LAST_7D:
      return EffectivenessTimeWindow.LAST_7D;
    case DashboardTimeWindow.LAST_30D:
      return EffectivenessTimeWindow.LAST_30D;
    case DashboardTimeWindow.ALL_TIME:
      return EffectivenessTimeWindow.ALL_TIME;
    default:
      return EffectivenessTimeWindow.ALL_TIME;
  }
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Model Performance Dashboard
 *
 * Aggregates and displays performance metrics from all AI prediction models.
 */
export class ModelPerformanceDashboard extends EventEmitter {
  private config: DashboardConfig;
  private insiderPredictor: InsiderProbabilityPredictor | null = null;
  private marketPredictor: MarketOutcomePredictor | null = null;
  private signalTracker: SignalEffectivenessTracker | null = null;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private historicalData: Map<ModelType, AccuracyDataPoint[]> = new Map();
  private metricsCache: Map<string, CacheEntry<ModelPerformanceMetrics>> = new Map();
  private summaryCache: CacheEntry<DashboardSummary> | null = null;
  private previousAccuracies: Map<ModelType, number> = new Map();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<DashboardConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DASHBOARD_CONFIG, ...config };

    // Initialize historical data storage
    for (const modelType of Object.values(ModelType)) {
      this.historicalData.set(modelType, []);
    }
  }

  // --------------------------------------------------------------------------
  // Model Registration
  // --------------------------------------------------------------------------

  /**
   * Register the insider probability predictor
   */
  registerInsiderPredictor(predictor: InsiderProbabilityPredictor): void {
    this.insiderPredictor = predictor;
    this.invalidateCache(ModelType.INSIDER_PREDICTOR);
  }

  /**
   * Register the market outcome predictor
   */
  registerMarketPredictor(predictor: MarketOutcomePredictor): void {
    this.marketPredictor = predictor;
    this.invalidateCache(ModelType.MARKET_PREDICTOR);
  }

  /**
   * Register the signal effectiveness tracker
   */
  registerSignalTracker(tracker: SignalEffectivenessTracker): void {
    this.signalTracker = tracker;
    this.invalidateCache(ModelType.SIGNAL_TRACKER);
  }

  /**
   * Register all models from shared instances
   */
  registerSharedModels(): void {
    try {
      this.insiderPredictor = getSharedInsiderProbabilityPredictor();
    } catch {
      // Predictor not available
    }

    try {
      this.marketPredictor = getSharedMarketOutcomePredictor();
    } catch {
      // Predictor not available
    }

    try {
      this.signalTracker = getSharedSignalEffectivenessTracker();
    } catch {
      // Tracker not available
    }
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Get current configuration
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...updates };
    this.clearCache();
  }

  // --------------------------------------------------------------------------
  // Metrics Collection
  // --------------------------------------------------------------------------

  /**
   * Get metrics for the insider predictor
   */
  getInsiderPredictorMetrics(): ModelPerformanceMetrics {
    const cacheKey = `metrics_${ModelType.INSIDER_PREDICTOR}`;

    if (this.config.cacheEnabled) {
      const cached = this.metricsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.emit("cache_hit", { key: cacheKey });
        return cached.data;
      }
      this.emit("cache_miss", { key: cacheKey });
    }

    let metrics: ModelPerformanceMetrics;

    if (this.insiderPredictor) {
      const modelMetrics: ModelAccuracyMetrics = this.insiderPredictor.getMetrics();
      const stats = this.insiderPredictor.getStatistics();

      const accuracy =
        modelMetrics.verifiedPredictions > 0
          ? (modelMetrics.truePositives + modelMetrics.trueNegatives) /
            modelMetrics.verifiedPredictions
          : 0;

      const isHealthy = accuracy >= this.config.accuracyWarningThreshold;
      const healthMessage = isHealthy
        ? "Model performing within expected parameters"
        : accuracy >= this.config.accuracyCriticalThreshold
          ? "Model accuracy below optimal threshold"
          : "Model accuracy critically low";

      metrics = {
        modelType: ModelType.INSIDER_PREDICTOR,
        modelName: MODEL_TYPE_NAMES[ModelType.INSIDER_PREDICTOR],
        totalPredictions: stats.totalPredictions,
        verifiedPredictions: modelMetrics.verifiedPredictions,
        accuracy,
        precision: modelMetrics.precision,
        recall: modelMetrics.recall,
        f1Score: modelMetrics.f1Score,
        brierScore: modelMetrics.brierScore,
        aucRoc: modelMetrics.aucRoc,
        truePositives: modelMetrics.truePositives,
        trueNegatives: modelMetrics.trueNegatives,
        falsePositives: modelMetrics.falsePositives,
        falseNegatives: modelMetrics.falseNegatives,
        isHealthy,
        healthMessage,
        lastUpdated: modelMetrics.lastUpdated,
      };
    } else {
      metrics = this.createEmptyMetrics(ModelType.INSIDER_PREDICTOR);
    }

    // Cache the result
    if (this.config.cacheEnabled) {
      this.metricsCache.set(cacheKey, {
        data: metrics,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return metrics;
  }

  /**
   * Get metrics for the market predictor
   */
  getMarketPredictorMetrics(): ModelPerformanceMetrics {
    const cacheKey = `metrics_${ModelType.MARKET_PREDICTOR}`;

    if (this.config.cacheEnabled) {
      const cached = this.metricsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.emit("cache_hit", { key: cacheKey });
        return cached.data;
      }
      this.emit("cache_miss", { key: cacheKey });
    }

    let metrics: ModelPerformanceMetrics;

    if (this.marketPredictor) {
      const modelMetrics = this.marketPredictor.getMetrics();
      const stats = this.marketPredictor.getStatistics();

      const accuracy =
        modelMetrics.verifiedPredictions > 0
          ? (modelMetrics.truePositives + modelMetrics.trueNegatives) /
            modelMetrics.verifiedPredictions
          : 0;

      const isHealthy = accuracy >= this.config.accuracyWarningThreshold;
      const healthMessage = isHealthy
        ? "Model performing within expected parameters"
        : accuracy >= this.config.accuracyCriticalThreshold
          ? "Model accuracy below optimal threshold"
          : "Model accuracy critically low";

      metrics = {
        modelType: ModelType.MARKET_PREDICTOR,
        modelName: MODEL_TYPE_NAMES[ModelType.MARKET_PREDICTOR],
        totalPredictions: stats.totalPredictions,
        verifiedPredictions: modelMetrics.verifiedPredictions,
        accuracy,
        precision: modelMetrics.precision,
        recall: modelMetrics.recall,
        f1Score: modelMetrics.f1Score,
        brierScore: modelMetrics.brierScore,
        aucRoc: modelMetrics.aucRoc,
        truePositives: modelMetrics.truePositives,
        trueNegatives: modelMetrics.trueNegatives,
        falsePositives: modelMetrics.falsePositives,
        falseNegatives: modelMetrics.falseNegatives,
        isHealthy,
        healthMessage,
        lastUpdated: modelMetrics.lastUpdated,
      };
    } else {
      metrics = this.createEmptyMetrics(ModelType.MARKET_PREDICTOR);
    }

    // Cache the result
    if (this.config.cacheEnabled) {
      this.metricsCache.set(cacheKey, {
        data: metrics,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return metrics;
  }

  /**
   * Get metrics for the signal tracker (aggregated across all signal types)
   */
  getSignalTrackerMetrics(): ModelPerformanceMetrics {
    const cacheKey = `metrics_${ModelType.SIGNAL_TRACKER}`;

    if (this.config.cacheEnabled) {
      const cached = this.metricsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.emit("cache_hit", { key: cacheKey });
        return cached.data;
      }
      this.emit("cache_miss", { key: cacheKey });
    }

    let metrics: ModelPerformanceMetrics;

    if (this.signalTracker) {
      const allMetrics = this.signalTracker.calculateAllEffectiveness();
      const stats = this.signalTracker.getStatistics();

      // Aggregate metrics across all signal types
      let totalCorrect = 0;
      let totalIncorrect = 0;
      let totalVerified = 0;
      let weightedAccuracy = 0;
      let weightedPrecision = 0;
      let weightedRecall = 0;
      let weightedF1 = 0;

      for (const [, signalMetrics] of allMetrics) {
        if (signalMetrics.verifiedOutcomes > 0) {
          totalCorrect += signalMetrics.correctPredictions;
          totalIncorrect += signalMetrics.incorrectPredictions;
          totalVerified += signalMetrics.verifiedOutcomes;

          const weight = signalMetrics.verifiedOutcomes;
          weightedAccuracy += signalMetrics.accuracy * weight;
          weightedPrecision += signalMetrics.precision * weight;
          weightedRecall += signalMetrics.recall * weight;
          weightedF1 += signalMetrics.f1Score * weight;
        }
      }

      const accuracy = totalVerified > 0 ? weightedAccuracy / totalVerified : 0;
      const precision = totalVerified > 0 ? weightedPrecision / totalVerified : 0;
      const recall = totalVerified > 0 ? weightedRecall / totalVerified : 0;
      const f1Score = totalVerified > 0 ? weightedF1 / totalVerified : 0;

      const isHealthy = accuracy >= this.config.accuracyWarningThreshold;
      const healthMessage = isHealthy
        ? "Signal tracker performing within expected parameters"
        : accuracy >= this.config.accuracyCriticalThreshold
          ? "Signal tracking accuracy below optimal threshold"
          : "Signal tracking accuracy critically low";

      metrics = {
        modelType: ModelType.SIGNAL_TRACKER,
        modelName: MODEL_TYPE_NAMES[ModelType.SIGNAL_TRACKER],
        totalPredictions: stats.totalOccurrences,
        verifiedPredictions: stats.verifiedOccurrences,
        accuracy,
        precision,
        recall,
        f1Score,
        brierScore: 0.25, // Not directly applicable
        aucRoc: 0.5 + (accuracy - 0.5), // Approximation
        truePositives: totalCorrect,
        trueNegatives: 0, // Not directly applicable for signals
        falsePositives: totalIncorrect,
        falseNegatives: 0, // Not directly applicable
        isHealthy,
        healthMessage,
        lastUpdated: new Date(),
      };
    } else {
      metrics = this.createEmptyMetrics(ModelType.SIGNAL_TRACKER);
    }

    // Cache the result
    if (this.config.cacheEnabled) {
      this.metricsCache.set(cacheKey, {
        data: metrics,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    return metrics;
  }

  /**
   * Create empty metrics for a model type
   */
  private createEmptyMetrics(modelType: ModelType): ModelPerformanceMetrics {
    return {
      modelType,
      modelName: MODEL_TYPE_NAMES[modelType],
      totalPredictions: 0,
      verifiedPredictions: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      brierScore: 0.25,
      aucRoc: 0.5,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      isHealthy: true,
      healthMessage: "No data available - model not registered or no predictions yet",
      lastUpdated: new Date(),
    };
  }

  /**
   * Get metrics for a specific model type
   */
  getModelMetrics(modelType: ModelType): ModelPerformanceMetrics {
    switch (modelType) {
      case ModelType.INSIDER_PREDICTOR:
        return this.getInsiderPredictorMetrics();
      case ModelType.MARKET_PREDICTOR:
        return this.getMarketPredictorMetrics();
      case ModelType.SIGNAL_TRACKER:
        return this.getSignalTrackerMetrics();
      default:
        return this.createEmptyMetrics(modelType);
    }
  }

  /**
   * Get metrics for all models
   */
  getAllModelMetrics(): Map<ModelType, ModelPerformanceMetrics> {
    const results = new Map<ModelType, ModelPerformanceMetrics>();

    for (const modelType of Object.values(ModelType)) {
      results.set(modelType, this.getModelMetrics(modelType));
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Dashboard Summary
  // --------------------------------------------------------------------------

  /**
   * Get overall dashboard summary
   */
  getDashboardSummary(): DashboardSummary {
    if (this.config.cacheEnabled && this.summaryCache && this.summaryCache.expiresAt > Date.now()) {
      this.emit("cache_hit", { key: "summary" });
      return this.summaryCache.data;
    }
    this.emit("cache_miss", { key: "summary" });

    const allMetrics = this.getAllModelMetrics();

    let totalPredictions = 0;
    let totalVerified = 0;
    let totalAccuracy = 0;
    let modelCount = 0;
    let bestModel: { modelType: ModelType; accuracy: number } | undefined;
    let worstModel: { modelType: ModelType; accuracy: number } | undefined;
    let unhealthyCount = 0;

    for (const [modelType, metrics] of allMetrics) {
      totalPredictions += metrics.totalPredictions;
      totalVerified += metrics.verifiedPredictions;

      if (metrics.verifiedPredictions > 0) {
        totalAccuracy += metrics.accuracy;
        modelCount++;

        if (!bestModel || metrics.accuracy > bestModel.accuracy) {
          bestModel = { modelType, accuracy: metrics.accuracy };
        }

        if (!worstModel || metrics.accuracy < worstModel.accuracy) {
          worstModel = { modelType, accuracy: metrics.accuracy };
        }
      }

      if (!metrics.isHealthy) {
        unhealthyCount++;
      }
    }

    const averageAccuracy = modelCount > 0 ? totalAccuracy / modelCount : 0;
    const activeAlerts = Array.from(this.alerts.values()).filter((a) => !a.acknowledged).length;

    // Determine overall health
    let overallHealth: "HEALTHY" | "WARNING" | "CRITICAL";
    if (unhealthyCount === 0 && averageAccuracy >= this.config.accuracyWarningThreshold) {
      overallHealth = "HEALTHY";
    } else if (
      unhealthyCount >= 2 ||
      averageAccuracy < this.config.accuracyCriticalThreshold
    ) {
      overallHealth = "CRITICAL";
    } else {
      overallHealth = "WARNING";
    }

    const healthScore = calculateHealthScore(averageAccuracy);

    const summary: DashboardSummary = {
      overallHealth,
      healthScore,
      totalPredictions,
      totalVerified,
      averageAccuracy,
      activeAlerts,
      bestPerformingModel: bestModel,
      worstPerformingModel: worstModel,
      lastRefresh: new Date(),
    };

    // Cache the result
    if (this.config.cacheEnabled) {
      this.summaryCache = {
        data: summary,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      };
    }

    this.emit("metrics_refreshed", summary);

    return summary;
  }

  // --------------------------------------------------------------------------
  // Accuracy Trends
  // --------------------------------------------------------------------------

  /**
   * Record current accuracy for historical tracking
   */
  recordAccuracySnapshot(): void {
    const allMetrics = this.getAllModelMetrics();
    const now = new Date();

    for (const [modelType, metrics] of allMetrics) {
      if (metrics.verifiedPredictions > 0) {
        const dataPoints = this.historicalData.get(modelType) || [];

        dataPoints.push({
          timestamp: now,
          accuracy: metrics.accuracy,
          sampleSize: metrics.verifiedPredictions,
        });

        // Calculate rolling averages
        const last7 = dataPoints.slice(-7);
        const last30 = dataPoints.slice(-30);

        if (dataPoints.length > 0) {
          const lastPoint = dataPoints[dataPoints.length - 1]!;
          lastPoint.rollingAvg7d =
            last7.reduce((sum, p) => sum + p.accuracy, 0) / last7.length;
          lastPoint.rollingAvg30d =
            last30.reduce((sum, p) => sum + p.accuracy, 0) / last30.length;
        }

        // Enforce retention limit
        const cutoff = new Date(
          Date.now() - this.config.historicalRetentionDays * 24 * 60 * 60 * 1000
        );
        const filtered = dataPoints.filter((p) => p.timestamp >= cutoff);
        this.historicalData.set(modelType, filtered);

        // Check for performance drops
        this.checkPerformanceDrop(modelType, metrics.accuracy);
      }
    }
  }

  /**
   * Get accuracy trend for a model
   */
  getAccuracyTrend(
    modelType: ModelType,
    timeWindow: DashboardTimeWindow = DashboardTimeWindow.LAST_30D
  ): AccuracyTrend {
    const dataPoints = this.historicalData.get(modelType) || [];
    const cutoff = getTimeWindowCutoff(timeWindow);

    const filteredPoints = dataPoints.filter((p) => p.timestamp >= cutoff);

    const currentMetrics = this.getModelMetrics(modelType);
    const currentAccuracy = currentMetrics.accuracy;

    // Calculate previous period accuracy
    let previousAccuracy = 0;
    if (filteredPoints.length > 1) {
      const midpoint = Math.floor(filteredPoints.length / 2);
      const previousPoints = filteredPoints.slice(0, midpoint);
      previousAccuracy =
        previousPoints.reduce((sum, p) => sum + p.accuracy, 0) / previousPoints.length;
    }

    const change = currentAccuracy - previousAccuracy;
    const changePercent = previousAccuracy > 0 ? (change / previousAccuracy) * 100 : 0;
    const trend = determineTrendDirection(change);

    return {
      modelType,
      dataPoints: filteredPoints,
      currentAccuracy,
      previousAccuracy,
      change,
      changePercent,
      trend,
      timeWindow,
    };
  }

  /**
   * Get accuracy trends for all models
   */
  getAllAccuracyTrends(
    timeWindow: DashboardTimeWindow = DashboardTimeWindow.LAST_30D
  ): Map<ModelType, AccuracyTrend> {
    const results = new Map<ModelType, AccuracyTrend>();

    for (const modelType of Object.values(ModelType)) {
      results.set(modelType, this.getAccuracyTrend(modelType, timeWindow));
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Performance Charts
  // --------------------------------------------------------------------------

  /**
   * Get accuracy comparison chart data
   */
  getAccuracyComparisonChart(): PerformanceChartData {
    const allMetrics = this.getAllModelMetrics();
    const labels: string[] = [];
    const accuracyData: number[] = [];
    const precisionData: number[] = [];
    const recallData: number[] = [];

    for (const [modelType, metrics] of allMetrics) {
      labels.push(MODEL_TYPE_NAMES[modelType]);
      accuracyData.push(metrics.accuracy * 100);
      precisionData.push(metrics.precision * 100);
      recallData.push(metrics.recall * 100);
    }

    return {
      title: "Model Performance Comparison",
      chartType: "BAR",
      labels,
      series: [
        { name: "Accuracy", data: accuracyData, color: "#3B82F6" },
        { name: "Precision", data: precisionData, color: "#10B981" },
        { name: "Recall", data: recallData, color: "#F59E0B" },
      ],
      yAxisLabel: "Percentage (%)",
      xAxisLabel: "Model",
    };
  }

  /**
   * Get accuracy over time chart data
   */
  getAccuracyOverTimeChart(
    modelType: ModelType,
    timeWindow: DashboardTimeWindow = DashboardTimeWindow.LAST_30D
  ): PerformanceChartData {
    const trend = this.getAccuracyTrend(modelType, timeWindow);
    const labels: string[] = [];
    const accuracyData: number[] = [];
    const rolling7dData: number[] = [];
    const rolling30dData: number[] = [];

    for (const point of trend.dataPoints) {
      labels.push(point.timestamp.toLocaleDateString());
      accuracyData.push(point.accuracy * 100);
      rolling7dData.push((point.rollingAvg7d || point.accuracy) * 100);
      rolling30dData.push((point.rollingAvg30d || point.accuracy) * 100);
    }

    return {
      title: `${MODEL_TYPE_NAMES[modelType]} - Accuracy Over Time`,
      chartType: "LINE",
      labels,
      series: [
        { name: "Daily Accuracy", data: accuracyData, color: "#3B82F6" },
        { name: "7-Day Rolling Avg", data: rolling7dData, color: "#10B981" },
        { name: "30-Day Rolling Avg", data: rolling30dData, color: "#F59E0B" },
      ],
      yAxisLabel: "Accuracy (%)",
      xAxisLabel: "Date",
    };
  }

  /**
   * Get confusion matrix chart data for a model
   */
  getConfusionMatrixChart(modelType: ModelType): PerformanceChartData {
    const metrics = this.getModelMetrics(modelType);

    return {
      title: `${MODEL_TYPE_NAMES[modelType]} - Confusion Matrix`,
      chartType: "BAR",
      labels: ["True Positives", "True Negatives", "False Positives", "False Negatives"],
      series: [
        {
          name: "Count",
          data: [
            metrics.truePositives,
            metrics.trueNegatives,
            metrics.falsePositives,
            metrics.falseNegatives,
          ],
          color: "#3B82F6",
        },
      ],
      yAxisLabel: "Count",
      xAxisLabel: "Prediction Outcome",
    };
  }

  /**
   * Get health gauge chart data
   */
  getHealthGaugeChart(): PerformanceChartData {
    const summary = this.getDashboardSummary();

    return {
      title: "Overall System Health",
      chartType: "GAUGE",
      labels: ["Health Score"],
      series: [
        {
          name: "Health",
          data: [summary.healthScore],
          color: HEALTH_STATUS_COLORS[summary.overallHealth],
        },
      ],
    };
  }

  /**
   * Get signal effectiveness chart data
   */
  getSignalEffectivenessChart(
    timeWindow: DashboardTimeWindow = DashboardTimeWindow.ALL_TIME
  ): PerformanceChartData {
    if (!this.signalTracker) {
      return {
        title: "Signal Effectiveness",
        chartType: "BAR",
        labels: [],
        series: [],
      };
    }

    const effectivenessTimeWindow = toEffectivenessTimeWindow(timeWindow);
    const rankings = this.signalTracker.getRankedSignals(effectivenessTimeWindow);
    const labels: string[] = [];
    const accuracyData: number[] = [];
    const liftData: number[] = [];

    for (const ranking of rankings.slice(0, 10)) {
      labels.push(ranking.signalType.replace(/_/g, " "));
      accuracyData.push(ranking.accuracy * 100);
      liftData.push(ranking.lift);
    }

    return {
      title: "Signal Effectiveness Ranking",
      chartType: "BAR",
      labels,
      series: [
        { name: "Accuracy (%)", data: accuracyData, color: "#3B82F6" },
        { name: "Lift", data: liftData, color: "#10B981" },
      ],
      yAxisLabel: "Value",
      xAxisLabel: "Signal Type",
    };
  }

  // --------------------------------------------------------------------------
  // Alerting
  // --------------------------------------------------------------------------

  /**
   * Check for performance drops and generate alerts
   */
  private checkPerformanceDrop(modelType: ModelType, currentAccuracy: number): void {
    if (!this.config.alertingEnabled) return;

    const previousAccuracy = this.previousAccuracies.get(modelType);

    if (previousAccuracy !== undefined) {
      const dropPercent = ((previousAccuracy - currentAccuracy) / previousAccuracy) * 100;

      if (dropPercent >= this.config.performanceDropAlertPercent) {
        this.emit("performance_drop", {
          modelType,
          previousAccuracy,
          currentAccuracy,
          dropPercent,
        });

        this.generatePerformanceDropAlert(
          modelType,
          previousAccuracy,
          currentAccuracy,
          dropPercent
        );
      } else if (
        previousAccuracy < this.config.accuracyWarningThreshold &&
        currentAccuracy >= this.config.accuracyWarningThreshold
      ) {
        // Model recovered
        this.emit("model_recovered", {
          modelType,
          previousAccuracy,
          currentAccuracy,
        });
      }
    }

    this.previousAccuracies.set(modelType, currentAccuracy);

    // Check threshold alerts
    const metrics = this.getModelMetrics(modelType);
    if (metrics.verifiedPredictions >= this.config.minPredictionsForAlert) {
      if (currentAccuracy < this.config.accuracyCriticalThreshold) {
        this.generateThresholdAlert(modelType, currentAccuracy, AlertSeverity.CRITICAL);
      } else if (currentAccuracy < this.config.accuracyWarningThreshold) {
        this.generateThresholdAlert(modelType, currentAccuracy, AlertSeverity.WARNING);
      }
    }
  }

  /**
   * Generate a performance drop alert
   */
  private generatePerformanceDropAlert(
    modelType: ModelType,
    previousAccuracy: number,
    currentAccuracy: number,
    dropPercent: number
  ): void {
    const severity =
      dropPercent >= 20 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

    const alert: PerformanceAlert = {
      alertId: generateAlertId(),
      modelType,
      severity,
      title: `Performance Drop: ${MODEL_TYPE_NAMES[modelType]}`,
      description: `Model accuracy dropped ${dropPercent.toFixed(1)}% from ${formatAccuracy(previousAccuracy)} to ${formatAccuracy(currentAccuracy)}`,
      currentValue: currentAccuracy,
      thresholdValue: previousAccuracy,
      difference: currentAccuracy - previousAccuracy,
      createdAt: new Date(),
      acknowledged: false,
      recommendedActions: [
        "Review recent prediction inputs for data quality issues",
        "Check for changes in market conditions or user behavior",
        "Consider retraining or recalibrating the model",
        "Review feature weights and thresholds",
      ],
    };

    this.alerts.set(alert.alertId, alert);
    this.emit("alert_generated", alert);
  }

  /**
   * Generate a threshold alert
   */
  private generateThresholdAlert(
    modelType: ModelType,
    currentAccuracy: number,
    severity: AlertSeverity
  ): void {
    // Check if we already have an active alert for this model
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) =>
        a.modelType === modelType &&
        !a.acknowledged &&
        a.title.includes("Below Threshold")
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const threshold =
      severity === AlertSeverity.CRITICAL
        ? this.config.accuracyCriticalThreshold
        : this.config.accuracyWarningThreshold;

    const alert: PerformanceAlert = {
      alertId: generateAlertId(),
      modelType,
      severity,
      title: `Accuracy Below Threshold: ${MODEL_TYPE_NAMES[modelType]}`,
      description: `Model accuracy (${formatAccuracy(currentAccuracy)}) is below ${severity === AlertSeverity.CRITICAL ? "critical" : "warning"} threshold (${formatAccuracy(threshold)})`,
      currentValue: currentAccuracy,
      thresholdValue: threshold,
      difference: currentAccuracy - threshold,
      createdAt: new Date(),
      acknowledged: false,
      recommendedActions:
        severity === AlertSeverity.CRITICAL
          ? [
              "Immediately investigate model inputs and outputs",
              "Consider temporarily disabling automated actions based on this model",
              "Review recent changes to feature engineering or data pipelines",
              "Schedule emergency model review meeting",
            ]
          : [
              "Monitor model performance closely",
              "Review recent prediction patterns",
              "Consider adjusting model parameters",
              "Schedule model review",
            ],
    };

    this.alerts.set(alert.alertId, alert);
    this.emit("alert_generated", alert);
  }

  /**
   * Get all alerts
   */
  getAlerts(includeAcknowledged: boolean = false): PerformanceAlert[] {
    const alerts = Array.from(this.alerts.values());
    if (includeAcknowledged) {
      return alerts;
    }
    return alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): PerformanceAlert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();

    this.emit("alert_acknowledged", { alertId });
    return true;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  // --------------------------------------------------------------------------
  // Auto-Refresh
  // --------------------------------------------------------------------------

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.recordAccuracySnapshot();
      this.getDashboardSummary(); // Refreshes cached summary
    }, this.config.refreshIntervalMs);
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Manual refresh
   */
  refresh(): DashboardSummary {
    this.clearCache();
    this.recordAccuracySnapshot();
    return this.getDashboardSummary();
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  /**
   * Invalidate cache for a specific model
   */
  private invalidateCache(modelType?: ModelType): void {
    if (modelType) {
      this.metricsCache.delete(`metrics_${modelType}`);
    } else {
      this.metricsCache.clear();
    }
    this.summaryCache = null;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.metricsCache.clear();
    this.summaryCache = null;
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get dashboard statistics
   */
  getStatistics(): {
    registeredModels: number;
    totalHistoricalPoints: number;
    activeAlerts: number;
    acknowledgedAlerts: number;
    cacheSize: number;
  } {
    let totalHistoricalPoints = 0;
    for (const points of this.historicalData.values()) {
      totalHistoricalPoints += points.length;
    }

    const alerts = Array.from(this.alerts.values());

    return {
      registeredModels: [this.insiderPredictor, this.marketPredictor, this.signalTracker].filter(
        (m) => m !== null
      ).length,
      totalHistoricalPoints,
      activeAlerts: alerts.filter((a) => !a.acknowledged).length,
      acknowledgedAlerts: alerts.filter((a) => a.acknowledged).length,
      cacheSize: this.metricsCache.size + (this.summaryCache ? 1 : 0),
    };
  }

  // --------------------------------------------------------------------------
  // Data Export
  // --------------------------------------------------------------------------

  /**
   * Export dashboard data
   */
  exportData(): {
    config: DashboardConfig;
    historicalData: Record<ModelType, AccuracyDataPoint[]>;
    alerts: PerformanceAlert[];
    summary: DashboardSummary;
    modelMetrics: Record<ModelType, ModelPerformanceMetrics>;
  } {
    const modelMetrics: Record<ModelType, ModelPerformanceMetrics> = {} as Record<
      ModelType,
      ModelPerformanceMetrics
    >;
    for (const modelType of Object.values(ModelType)) {
      modelMetrics[modelType] = this.getModelMetrics(modelType);
    }

    const historicalData: Record<ModelType, AccuracyDataPoint[]> = {} as Record<
      ModelType,
      AccuracyDataPoint[]
    >;
    for (const [modelType, points] of this.historicalData) {
      historicalData[modelType] = points;
    }

    return {
      config: this.config,
      historicalData,
      alerts: Array.from(this.alerts.values()),
      summary: this.getDashboardSummary(),
      modelMetrics,
    };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Reset dashboard state
   */
  reset(): void {
    this.stopAutoRefresh();
    this.clearCache();
    this.alerts.clear();
    this.previousAccuracies.clear();
    for (const points of this.historicalData.values()) {
      points.length = 0;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.reset();
    this.insiderPredictor = null;
    this.marketPredictor = null;
    this.signalTracker = null;
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ModelPerformanceDashboard instance
 */
export function createModelPerformanceDashboard(
  config?: Partial<DashboardConfig>
): ModelPerformanceDashboard {
  return new ModelPerformanceDashboard(config);
}

// Shared instance
let sharedDashboard: ModelPerformanceDashboard | null = null;

/**
 * Get the shared ModelPerformanceDashboard instance
 */
export function getSharedModelPerformanceDashboard(): ModelPerformanceDashboard {
  if (!sharedDashboard) {
    sharedDashboard = createModelPerformanceDashboard();
    sharedDashboard.registerSharedModels();
  }
  return sharedDashboard;
}

/**
 * Set the shared ModelPerformanceDashboard instance
 */
export function setSharedModelPerformanceDashboard(dashboard: ModelPerformanceDashboard): void {
  sharedDashboard = dashboard;
}

/**
 * Reset the shared ModelPerformanceDashboard instance
 */
export function resetSharedModelPerformanceDashboard(): void {
  if (sharedDashboard) {
    sharedDashboard.dispose();
  }
  sharedDashboard = null;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create mock model performance metrics
 */
export function createMockModelPerformanceMetrics(
  modelType: ModelType,
  overrides: Partial<ModelPerformanceMetrics> = {}
): ModelPerformanceMetrics {
  const accuracy = overrides.accuracy ?? 0.5 + Math.random() * 0.4;
  const precision = overrides.precision ?? 0.4 + Math.random() * 0.5;
  const recall = overrides.recall ?? 0.4 + Math.random() * 0.5;

  return {
    modelType,
    modelName: MODEL_TYPE_NAMES[modelType],
    totalPredictions: overrides.totalPredictions ?? Math.floor(100 + Math.random() * 1000),
    verifiedPredictions: overrides.verifiedPredictions ?? Math.floor(50 + Math.random() * 500),
    accuracy,
    precision,
    recall,
    f1Score: overrides.f1Score ?? ((2 * precision * recall) / (precision + recall) || 0),
    brierScore: overrides.brierScore ?? Math.random() * 0.25,
    aucRoc: overrides.aucRoc ?? (0.5 + Math.random() * 0.4),
    truePositives: overrides.truePositives ?? Math.floor(Math.random() * 200),
    trueNegatives: overrides.trueNegatives ?? Math.floor(Math.random() * 200),
    falsePositives: overrides.falsePositives ?? Math.floor(Math.random() * 50),
    falseNegatives: overrides.falseNegatives ?? Math.floor(Math.random() * 50),
    isHealthy: overrides.isHealthy ?? accuracy >= 0.55,
    healthMessage:
      overrides.healthMessage ??
      (accuracy >= 0.55
        ? "Model performing within expected parameters"
        : "Model accuracy below optimal threshold"),
    lastUpdated: overrides.lastUpdated ?? new Date(),
  };
}

/**
 * Create mock accuracy data points
 */
export function createMockAccuracyDataPoints(
  count: number,
  baseAccuracy: number = 0.6
): AccuracyDataPoint[] {
  const points: AccuracyDataPoint[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const dayOffset = count - i - 1;
    const timestamp = new Date(now - dayOffset * 24 * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.1;
    const accuracy = Math.max(0, Math.min(1, baseAccuracy + variation));

    points.push({
      timestamp,
      accuracy,
      sampleSize: Math.floor(10 + Math.random() * 50) + i * 10,
    });
  }

  // Calculate rolling averages
  for (let i = 0; i < points.length; i++) {
    const last7 = points.slice(Math.max(0, i - 6), i + 1);
    const last30 = points.slice(Math.max(0, i - 29), i + 1);

    points[i]!.rollingAvg7d = last7.reduce((sum, p) => sum + p.accuracy, 0) / last7.length;
    points[i]!.rollingAvg30d = last30.reduce((sum, p) => sum + p.accuracy, 0) / last30.length;
  }

  return points;
}

/**
 * Create mock dashboard summary
 */
export function createMockDashboardSummary(
  overrides: Partial<DashboardSummary> = {}
): DashboardSummary {
  const averageAccuracy = overrides.averageAccuracy ?? 0.5 + Math.random() * 0.4;

  return {
    overallHealth:
      overrides.overallHealth ??
      (averageAccuracy >= 0.55 ? "HEALTHY" : averageAccuracy >= 0.45 ? "WARNING" : "CRITICAL"),
    healthScore: overrides.healthScore ?? calculateHealthScore(averageAccuracy),
    totalPredictions: overrides.totalPredictions ?? Math.floor(500 + Math.random() * 2000),
    totalVerified: overrides.totalVerified ?? Math.floor(200 + Math.random() * 1000),
    averageAccuracy,
    activeAlerts: overrides.activeAlerts ?? Math.floor(Math.random() * 5),
    bestPerformingModel: overrides.bestPerformingModel ?? {
      modelType: ModelType.INSIDER_PREDICTOR,
      accuracy: 0.75,
    },
    worstPerformingModel: overrides.worstPerformingModel ?? {
      modelType: ModelType.SIGNAL_TRACKER,
      accuracy: 0.55,
    },
    lastRefresh: overrides.lastRefresh ?? new Date(),
  };
}

/**
 * Create mock performance alert
 */
export function createMockPerformanceAlert(
  overrides: Partial<PerformanceAlert> = {}
): PerformanceAlert {
  const modelTypes = Object.values(ModelType);
  const severities = Object.values(AlertSeverity);
  const randomModelType =
    modelTypes[Math.floor(Math.random() * modelTypes.length)] ?? ModelType.INSIDER_PREDICTOR;
  const randomSeverity =
    severities[Math.floor(Math.random() * severities.length)] ?? AlertSeverity.WARNING;

  return {
    alertId: overrides.alertId ?? generateAlertId(),
    modelType: overrides.modelType ?? randomModelType,
    severity: overrides.severity ?? randomSeverity,
    title: overrides.title ?? `Performance Alert: ${MODEL_TYPE_NAMES[randomModelType]}`,
    description:
      overrides.description ?? "Model performance has dropped below expected threshold",
    currentValue: overrides.currentValue ?? 0.4 + Math.random() * 0.2,
    thresholdValue: overrides.thresholdValue ?? 0.55,
    difference: overrides.difference ?? -0.1,
    createdAt: overrides.createdAt ?? new Date(),
    acknowledged: overrides.acknowledged ?? false,
    acknowledgedAt: overrides.acknowledgedAt,
    recommendedActions: overrides.recommendedActions ?? [
      "Review model inputs",
      "Check for data quality issues",
      "Consider model retraining",
    ],
  };
}
