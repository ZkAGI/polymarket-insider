/**
 * Unit Tests for Model Performance Dashboard (AI-PRED-004)
 *
 * Tests metrics collection, dashboard summary, accuracy trends,
 * chart data generation, alerting, and cache management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ModelPerformanceDashboard,
  createModelPerformanceDashboard,
  getSharedModelPerformanceDashboard,
  setSharedModelPerformanceDashboard,
  resetSharedModelPerformanceDashboard,
  ModelType,
  AlertSeverity,
  DashboardTimeWindow,
  DEFAULT_DASHBOARD_CONFIG,
  MODEL_TYPE_NAMES,
  MODEL_TYPE_DESCRIPTIONS,
  ALERT_SEVERITY_COLORS,
  HEALTH_STATUS_COLORS,
  generateAlertId,
  getTimeWindowMs,
  getTimeWindowCutoff,
  formatAccuracy,
  formatNumber,
  calculateHealthScore,
  determineTrendDirection,
  createMockModelPerformanceMetrics,
  createMockAccuracyDataPoints,
  createMockDashboardSummary,
  createMockPerformanceAlert,
} from "../../src/ai/model-performance-dashboard";
import { createInsiderProbabilityPredictor } from "../../src/ai/insider-probability-predictor";
import { createSignalEffectivenessTracker } from "../../src/ai/signal-effectiveness-tracker";
import { createMarketOutcomePredictor } from "../../src/ai/market-outcome-predictor";

describe("Model Performance Dashboard", () => {
  let dashboard: ModelPerformanceDashboard;

  beforeEach(() => {
    dashboard = createModelPerformanceDashboard();
    resetSharedModelPerformanceDashboard();
  });

  afterEach(() => {
    dashboard.dispose();
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("Utility Functions", () => {
    describe("generateAlertId", () => {
      it("should generate unique IDs", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateAlertId());
        }
        expect(ids.size).toBe(100);
      });

      it("should generate IDs with correct prefix", () => {
        const id = generateAlertId();
        expect(id).toMatch(/^alert_\d+_[a-z0-9]+$/);
      });
    });

    describe("getTimeWindowMs", () => {
      it("should return correct milliseconds for LAST_HOUR", () => {
        expect(getTimeWindowMs(DashboardTimeWindow.LAST_HOUR)).toBe(60 * 60 * 1000);
      });

      it("should return correct milliseconds for LAST_24H", () => {
        expect(getTimeWindowMs(DashboardTimeWindow.LAST_24H)).toBe(24 * 60 * 60 * 1000);
      });

      it("should return correct milliseconds for LAST_7D", () => {
        expect(getTimeWindowMs(DashboardTimeWindow.LAST_7D)).toBe(7 * 24 * 60 * 60 * 1000);
      });

      it("should return correct milliseconds for LAST_30D", () => {
        expect(getTimeWindowMs(DashboardTimeWindow.LAST_30D)).toBe(30 * 24 * 60 * 60 * 1000);
      });

      it("should return Infinity for ALL_TIME", () => {
        expect(getTimeWindowMs(DashboardTimeWindow.ALL_TIME)).toBe(Infinity);
      });
    });

    describe("getTimeWindowCutoff", () => {
      it("should return date in the past for bounded windows", () => {
        const cutoff = getTimeWindowCutoff(DashboardTimeWindow.LAST_24H);
        expect(cutoff.getTime()).toBeLessThan(Date.now());
        expect(cutoff.getTime()).toBeGreaterThan(Date.now() - 25 * 60 * 60 * 1000);
      });

      it("should return epoch for ALL_TIME", () => {
        const cutoff = getTimeWindowCutoff(DashboardTimeWindow.ALL_TIME);
        expect(cutoff.getTime()).toBe(0);
      });
    });

    describe("formatAccuracy", () => {
      it("should format accuracy as percentage", () => {
        expect(formatAccuracy(0.75)).toBe("75.0%");
        expect(formatAccuracy(0.5)).toBe("50.0%");
        expect(formatAccuracy(1)).toBe("100.0%");
      });

      it("should handle edge cases", () => {
        expect(formatAccuracy(0)).toBe("0.0%");
      });
    });

    describe("formatNumber", () => {
      it("should format small numbers as-is", () => {
        expect(formatNumber(100)).toBe("100");
        expect(formatNumber(999)).toBe("999");
      });

      it("should format thousands with K suffix", () => {
        expect(formatNumber(1000)).toBe("1.0K");
        expect(formatNumber(5500)).toBe("5.5K");
      });

      it("should format millions with M suffix", () => {
        expect(formatNumber(1000000)).toBe("1.0M");
        expect(formatNumber(2500000)).toBe("2.5M");
      });
    });

    describe("calculateHealthScore", () => {
      it("should return 100 for accuracy >= 0.8", () => {
        expect(calculateHealthScore(0.8)).toBe(100);
        expect(calculateHealthScore(0.9)).toBe(100);
      });

      it("should return 85 for accuracy >= 0.7", () => {
        expect(calculateHealthScore(0.75)).toBe(85);
      });

      it("should return 70 for accuracy >= 0.6", () => {
        expect(calculateHealthScore(0.65)).toBe(70);
      });

      it("should return lower scores for lower accuracy", () => {
        expect(calculateHealthScore(0.55)).toBe(55);
        expect(calculateHealthScore(0.45)).toBe(35);
        expect(calculateHealthScore(0.3)).toBe(20);
      });
    });

    describe("determineTrendDirection", () => {
      it("should return UP for positive change above threshold", () => {
        expect(determineTrendDirection(0.05)).toBe("UP");
      });

      it("should return DOWN for negative change below threshold", () => {
        expect(determineTrendDirection(-0.05)).toBe("DOWN");
      });

      it("should return STABLE for small changes", () => {
        expect(determineTrendDirection(0.01)).toBe("STABLE");
        expect(determineTrendDirection(-0.01)).toBe("STABLE");
      });
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    describe("MODEL_TYPE_NAMES", () => {
      it("should have names for all model types", () => {
        for (const modelType of Object.values(ModelType)) {
          expect(MODEL_TYPE_NAMES[modelType]).toBeDefined();
          expect(typeof MODEL_TYPE_NAMES[modelType]).toBe("string");
        }
      });
    });

    describe("MODEL_TYPE_DESCRIPTIONS", () => {
      it("should have descriptions for all model types", () => {
        for (const modelType of Object.values(ModelType)) {
          expect(MODEL_TYPE_DESCRIPTIONS[modelType]).toBeDefined();
          expect(typeof MODEL_TYPE_DESCRIPTIONS[modelType]).toBe("string");
        }
      });
    });

    describe("ALERT_SEVERITY_COLORS", () => {
      it("should have colors for all severities", () => {
        for (const severity of Object.values(AlertSeverity)) {
          expect(ALERT_SEVERITY_COLORS[severity]).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    });

    describe("HEALTH_STATUS_COLORS", () => {
      it("should have colors for all health statuses", () => {
        expect(HEALTH_STATUS_COLORS.HEALTHY).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(HEALTH_STATUS_COLORS.WARNING).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(HEALTH_STATUS_COLORS.CRITICAL).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    describe("DEFAULT_DASHBOARD_CONFIG", () => {
      it("should have required configuration fields", () => {
        expect(DEFAULT_DASHBOARD_CONFIG.accuracyWarningThreshold).toBeDefined();
        expect(DEFAULT_DASHBOARD_CONFIG.accuracyCriticalThreshold).toBeDefined();
        expect(DEFAULT_DASHBOARD_CONFIG.minPredictionsForAlert).toBeDefined();
        expect(DEFAULT_DASHBOARD_CONFIG.performanceDropAlertPercent).toBeDefined();
        expect(DEFAULT_DASHBOARD_CONFIG.cacheEnabled).toBeDefined();
        expect(DEFAULT_DASHBOARD_CONFIG.cacheTtlMs).toBeDefined();
      });

      it("should have reasonable threshold values", () => {
        expect(DEFAULT_DASHBOARD_CONFIG.accuracyWarningThreshold).toBeGreaterThan(0.4);
        expect(DEFAULT_DASHBOARD_CONFIG.accuracyCriticalThreshold).toBeLessThan(
          DEFAULT_DASHBOARD_CONFIG.accuracyWarningThreshold
        );
      });
    });
  });

  // ==========================================================================
  // Mock Data Generator Tests
  // ==========================================================================

  describe("Mock Data Generators", () => {
    describe("createMockModelPerformanceMetrics", () => {
      it("should create metrics with all required fields", () => {
        const metrics = createMockModelPerformanceMetrics(ModelType.INSIDER_PREDICTOR);
        expect(metrics.modelType).toBe(ModelType.INSIDER_PREDICTOR);
        expect(metrics.modelName).toBe(MODEL_TYPE_NAMES[ModelType.INSIDER_PREDICTOR]);
        expect(metrics.totalPredictions).toBeGreaterThanOrEqual(0);
        expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
        expect(metrics.accuracy).toBeLessThanOrEqual(1);
      });

      it("should allow overrides", () => {
        const metrics = createMockModelPerformanceMetrics(ModelType.MARKET_PREDICTOR, {
          accuracy: 0.75,
          totalPredictions: 500,
        });
        expect(metrics.accuracy).toBe(0.75);
        expect(metrics.totalPredictions).toBe(500);
      });
    });

    describe("createMockAccuracyDataPoints", () => {
      it("should create specified number of data points", () => {
        const points = createMockAccuracyDataPoints(30);
        expect(points.length).toBe(30);
      });

      it("should have timestamps in chronological order", () => {
        const points = createMockAccuracyDataPoints(10);
        for (let i = 1; i < points.length; i++) {
          expect(points[i]!.timestamp.getTime()).toBeGreaterThan(
            points[i - 1]!.timestamp.getTime()
          );
        }
      });

      it("should include rolling averages", () => {
        const points = createMockAccuracyDataPoints(10);
        const lastPoint = points[points.length - 1];
        expect(lastPoint?.rollingAvg7d).toBeDefined();
        expect(lastPoint?.rollingAvg30d).toBeDefined();
      });
    });

    describe("createMockDashboardSummary", () => {
      it("should create summary with all required fields", () => {
        const summary = createMockDashboardSummary();
        expect(summary.overallHealth).toBeDefined();
        expect(summary.healthScore).toBeDefined();
        expect(summary.totalPredictions).toBeDefined();
        expect(summary.averageAccuracy).toBeDefined();
        expect(summary.activeAlerts).toBeDefined();
      });

      it("should allow overrides", () => {
        const summary = createMockDashboardSummary({
          overallHealth: "HEALTHY",
          healthScore: 95,
        });
        expect(summary.overallHealth).toBe("HEALTHY");
        expect(summary.healthScore).toBe(95);
      });
    });

    describe("createMockPerformanceAlert", () => {
      it("should create alert with all required fields", () => {
        const alert = createMockPerformanceAlert();
        expect(alert.alertId).toBeDefined();
        expect(alert.modelType).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.title).toBeDefined();
        expect(alert.description).toBeDefined();
        expect(alert.recommendedActions).toBeDefined();
      });

      it("should default to not acknowledged", () => {
        const alert = createMockPerformanceAlert();
        expect(alert.acknowledged).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Dashboard Instantiation Tests
  // ==========================================================================

  describe("Dashboard Instantiation", () => {
    describe("createModelPerformanceDashboard", () => {
      it("should create new dashboard instance", () => {
        const dash = createModelPerformanceDashboard();
        expect(dash).toBeInstanceOf(ModelPerformanceDashboard);
        dash.dispose();
      });

      it("should accept custom configuration", () => {
        const dash = createModelPerformanceDashboard({
          accuracyWarningThreshold: 0.6,
        });
        const config = dash.getConfig();
        expect(config.accuracyWarningThreshold).toBe(0.6);
        dash.dispose();
      });
    });

    describe("Shared Instance", () => {
      it("should get shared instance", () => {
        const shared1 = getSharedModelPerformanceDashboard();
        const shared2 = getSharedModelPerformanceDashboard();
        expect(shared1).toBe(shared2);
      });

      it("should allow setting custom shared instance", () => {
        const custom = createModelPerformanceDashboard();
        setSharedModelPerformanceDashboard(custom);
        expect(getSharedModelPerformanceDashboard()).toBe(custom);
      });

      it("should reset shared instance", () => {
        const shared1 = getSharedModelPerformanceDashboard();
        resetSharedModelPerformanceDashboard();
        const shared2 = getSharedModelPerformanceDashboard();
        expect(shared1).not.toBe(shared2);
      });
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe("Configuration", () => {
    it("should get default config", () => {
      const config = dashboard.getConfig();
      expect(config).toMatchObject(DEFAULT_DASHBOARD_CONFIG);
    });

    it("should update config", () => {
      dashboard.updateConfig({ accuracyWarningThreshold: 0.65 });
      const config = dashboard.getConfig();
      expect(config.accuracyWarningThreshold).toBe(0.65);
    });

    it("should preserve unmodified config values", () => {
      const originalCacheTtl = dashboard.getConfig().cacheTtlMs;
      dashboard.updateConfig({ accuracyWarningThreshold: 0.65 });
      expect(dashboard.getConfig().cacheTtlMs).toBe(originalCacheTtl);
    });
  });

  // ==========================================================================
  // Model Registration Tests
  // ==========================================================================

  describe("Model Registration", () => {
    it("should register insider predictor", () => {
      const predictor = createInsiderProbabilityPredictor();
      dashboard.registerInsiderPredictor(predictor);
      const metrics = dashboard.getInsiderPredictorMetrics();
      expect(metrics.modelType).toBe(ModelType.INSIDER_PREDICTOR);
    });

    it("should register signal tracker", () => {
      const tracker = createSignalEffectivenessTracker();
      dashboard.registerSignalTracker(tracker);
      const metrics = dashboard.getSignalTrackerMetrics();
      expect(metrics.modelType).toBe(ModelType.SIGNAL_TRACKER);
    });

    it("should register market predictor", () => {
      const predictor = createMarketOutcomePredictor();
      dashboard.registerMarketPredictor(predictor);
      const metrics = dashboard.getMarketPredictorMetrics();
      expect(metrics.modelType).toBe(ModelType.MARKET_PREDICTOR);
    });
  });

  // ==========================================================================
  // Metrics Collection Tests
  // ==========================================================================

  describe("Metrics Collection", () => {
    describe("getModelMetrics", () => {
      it("should return empty metrics for unregistered model", () => {
        const metrics = dashboard.getModelMetrics(ModelType.INSIDER_PREDICTOR);
        expect(metrics.totalPredictions).toBe(0);
        expect(metrics.verifiedPredictions).toBe(0);
      });

      it("should return metrics for all model types", () => {
        for (const modelType of Object.values(ModelType)) {
          const metrics = dashboard.getModelMetrics(modelType);
          expect(metrics.modelType).toBe(modelType);
          expect(metrics.modelName).toBe(MODEL_TYPE_NAMES[modelType]);
        }
      });
    });

    describe("getAllModelMetrics", () => {
      it("should return metrics map for all models", () => {
        const allMetrics = dashboard.getAllModelMetrics();
        expect(allMetrics.size).toBe(Object.values(ModelType).length);
        for (const modelType of Object.values(ModelType)) {
          expect(allMetrics.has(modelType)).toBe(true);
        }
      });
    });
  });

  // ==========================================================================
  // Dashboard Summary Tests
  // ==========================================================================

  describe("Dashboard Summary", () => {
    it("should return summary with all required fields", () => {
      const summary = dashboard.getDashboardSummary();
      expect(summary.overallHealth).toBeDefined();
      expect(summary.healthScore).toBeDefined();
      expect(summary.totalPredictions).toBeDefined();
      expect(summary.totalVerified).toBeDefined();
      expect(summary.averageAccuracy).toBeDefined();
      expect(summary.activeAlerts).toBeDefined();
      expect(summary.lastRefresh).toBeInstanceOf(Date);
    });

    it("should default to CRITICAL when no models registered (no data)", () => {
      // When no models are registered, averageAccuracy is 0 which triggers CRITICAL status
      // This is expected behavior - an empty dashboard should indicate a problem
      const summary = dashboard.getDashboardSummary();
      expect(summary.overallHealth).toBe("CRITICAL");
      expect(summary.averageAccuracy).toBe(0);
    });

    it("should cache summary when caching is enabled", () => {
      const summary1 = dashboard.getDashboardSummary();
      const summary2 = dashboard.getDashboardSummary();
      expect(summary1.lastRefresh.getTime()).toBe(summary2.lastRefresh.getTime());
    });
  });

  // ==========================================================================
  // Accuracy Trends Tests
  // ==========================================================================

  describe("Accuracy Trends", () => {
    it("should return empty trend for model without data", () => {
      const trend = dashboard.getAccuracyTrend(ModelType.INSIDER_PREDICTOR);
      expect(trend.dataPoints.length).toBe(0);
      expect(trend.currentAccuracy).toBe(0);
    });

    it("should calculate trend direction correctly", () => {
      const trend = dashboard.getAccuracyTrend(
        ModelType.INSIDER_PREDICTOR,
        DashboardTimeWindow.LAST_30D
      );
      expect(["UP", "DOWN", "STABLE"]).toContain(trend.trend);
    });

    it("should return trends for all models", () => {
      const allTrends = dashboard.getAllAccuracyTrends();
      expect(allTrends.size).toBe(Object.values(ModelType).length);
    });
  });

  // ==========================================================================
  // Chart Data Tests
  // ==========================================================================

  describe("Chart Data Generation", () => {
    describe("getAccuracyComparisonChart", () => {
      it("should generate comparison chart data", () => {
        const chart = dashboard.getAccuracyComparisonChart();
        expect(chart.title).toBe("Model Performance Comparison");
        expect(chart.chartType).toBe("BAR");
        expect(chart.labels).toBeDefined();
        expect(chart.series).toBeDefined();
      });

      it("should include series for accuracy, precision, and recall", () => {
        const chart = dashboard.getAccuracyComparisonChart();
        const seriesNames = chart.series.map((s) => s.name);
        expect(seriesNames).toContain("Accuracy");
        expect(seriesNames).toContain("Precision");
        expect(seriesNames).toContain("Recall");
      });
    });

    describe("getAccuracyOverTimeChart", () => {
      it("should generate line chart data", () => {
        const chart = dashboard.getAccuracyOverTimeChart(ModelType.INSIDER_PREDICTOR);
        expect(chart.chartType).toBe("LINE");
        expect(chart.title).toContain(MODEL_TYPE_NAMES[ModelType.INSIDER_PREDICTOR]);
      });
    });

    describe("getConfusionMatrixChart", () => {
      it("should generate confusion matrix bar chart", () => {
        const chart = dashboard.getConfusionMatrixChart(ModelType.INSIDER_PREDICTOR);
        expect(chart.chartType).toBe("BAR");
        expect(chart.labels).toContain("True Positives");
        expect(chart.labels).toContain("False Positives");
      });
    });

    describe("getHealthGaugeChart", () => {
      it("should generate health gauge data", () => {
        const chart = dashboard.getHealthGaugeChart();
        expect(chart.chartType).toBe("GAUGE");
        expect(chart.title).toBe("Overall System Health");
      });
    });
  });

  // ==========================================================================
  // Alerting Tests
  // ==========================================================================

  describe("Alerting", () => {
    describe("getAlerts", () => {
      it("should return empty array when no alerts", () => {
        const alerts = dashboard.getAlerts();
        expect(alerts).toEqual([]);
      });
    });

    describe("acknowledgeAlert", () => {
      it("should return false for non-existent alert", () => {
        const result = dashboard.acknowledgeAlert("non-existent-id");
        expect(result).toBe(false);
      });
    });

    describe("clearAlerts", () => {
      it("should clear all alerts", () => {
        dashboard.clearAlerts();
        expect(dashboard.getAlerts()).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("Event Emission", () => {
    it("should emit metrics_refreshed event", () => {
      const listener = vi.fn();
      dashboard.on("metrics_refreshed", listener);

      dashboard.getDashboardSummary();
      dashboard.clearCache();
      dashboard.getDashboardSummary();

      expect(listener).toHaveBeenCalled();
    });

    it("should emit cache_hit event when cache is used", () => {
      const hitListener = vi.fn();
      dashboard.on("cache_hit", hitListener);

      dashboard.getDashboardSummary();
      dashboard.getDashboardSummary();

      expect(hitListener).toHaveBeenCalled();
    });

    it("should emit cache_miss event on first access", () => {
      const missListener = vi.fn();
      dashboard.on("cache_miss", missListener);

      dashboard.getDashboardSummary();

      expect(missListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Cache Management Tests
  // ==========================================================================

  describe("Cache Management", () => {
    it("should clear cache", () => {
      dashboard.getDashboardSummary();
      dashboard.clearCache();

      const missListener = vi.fn();
      dashboard.on("cache_miss", missListener);
      dashboard.getDashboardSummary();

      expect(missListener).toHaveBeenCalled();
    });

    it("should respect cache TTL", async () => {
      const shortTtlDashboard = createModelPerformanceDashboard({
        cacheTtlMs: 10,
      });

      shortTtlDashboard.getDashboardSummary();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const missListener = vi.fn();
      shortTtlDashboard.on("cache_miss", missListener);
      shortTtlDashboard.getDashboardSummary();

      expect(missListener).toHaveBeenCalled();
      shortTtlDashboard.dispose();
    });
  });

  // ==========================================================================
  // Auto-Refresh Tests
  // ==========================================================================

  describe("Auto-Refresh", () => {
    it("should start auto-refresh timer", () => {
      dashboard.startAutoRefresh();
      dashboard.stopAutoRefresh();
    });

    it("should stop auto-refresh timer", () => {
      dashboard.startAutoRefresh();
      dashboard.stopAutoRefresh();
    });

    it("should not start multiple timers", () => {
      dashboard.startAutoRefresh();
      dashboard.startAutoRefresh();
      dashboard.stopAutoRefresh();
    });
  });

  // ==========================================================================
  // Manual Refresh Tests
  // ==========================================================================

  describe("Manual Refresh", () => {
    it("should clear cache and return new summary", () => {
      const summary1 = dashboard.getDashboardSummary();
      const summary2 = dashboard.refresh();

      expect(summary2.lastRefresh.getTime()).toBeGreaterThanOrEqual(
        summary1.lastRefresh.getTime()
      );
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe("Statistics", () => {
    it("should return dashboard statistics", () => {
      const stats = dashboard.getStatistics();
      expect(stats.registeredModels).toBeDefined();
      expect(stats.totalHistoricalPoints).toBeDefined();
      expect(stats.activeAlerts).toBeDefined();
      expect(stats.acknowledgedAlerts).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
    });
  });

  // ==========================================================================
  // Data Export Tests
  // ==========================================================================

  describe("Data Export", () => {
    it("should export dashboard data", () => {
      const exported = dashboard.exportData();
      expect(exported.config).toBeDefined();
      expect(exported.historicalData).toBeDefined();
      expect(exported.alerts).toBeDefined();
      expect(exported.summary).toBeDefined();
      expect(exported.modelMetrics).toBeDefined();
    });

    it("should include model metrics for all types", () => {
      const exported = dashboard.exportData();
      for (const modelType of Object.values(ModelType)) {
        expect(exported.modelMetrics[modelType]).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe("Cleanup", () => {
    describe("reset", () => {
      it("should reset dashboard state", () => {
        dashboard.getDashboardSummary();
        dashboard.reset();

        const stats = dashboard.getStatistics();
        expect(stats.cacheSize).toBe(0);
        expect(stats.activeAlerts).toBe(0);
      });
    });

    describe("dispose", () => {
      it("should cleanup all resources", () => {
        const disposeDashboard = createModelPerformanceDashboard();
        disposeDashboard.startAutoRefresh();
        disposeDashboard.dispose();
      });
    });
  });
});
