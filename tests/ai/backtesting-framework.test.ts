/**
 * Unit Tests for Backtesting Framework (AI-PRED-005)
 *
 * Tests backtesting engine, historical data loading, detection strategy simulation,
 * metrics calculation, report generation, and utility functions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  BacktestingFramework,
  createBacktestingFramework,
  getSharedBacktestingFramework,
  setSharedBacktestingFramework,
  resetSharedBacktestingFramework,
  BacktestStatus,
  StrategyType,
  DataSourceType,
  ValidationMethod,
  ReportDetailLevel,
  PerformanceTier,
  DEFAULT_BACKTEST_CONFIG,
  DEFAULT_DETECTION_THRESHOLDS,
  DEFAULT_FRAMEWORK_CONFIG,
  PERFORMANCE_TIER_THRESHOLDS,
  generateBacktestId,
  generateDetectionId,
  getStrategyTypeDescription,
  getValidationMethodDescription,
  getPerformanceTierDescription,
  getPerformanceTierColor,
  getBacktestStatusDescription,
  formatAccuracyPercent,
  formatMetricsForDisplay,
  createDefaultStrategyConfig,
  createDefaultBacktestConfig,
  createMockBacktestReport,
  createMockMetrics,
  createMockDetectionResult,
  createMockHistoricalDataset,
  type BacktestConfig,
} from "../../src/ai/backtesting-framework";

describe("Backtesting Framework", () => {
  let framework: BacktestingFramework;

  beforeEach(() => {
    framework = createBacktestingFramework();
    resetSharedBacktestingFramework();
  });

  afterEach(() => {
    framework.clearCache();
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("Utility Functions", () => {
    describe("generateBacktestId", () => {
      it("should generate unique IDs", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateBacktestId());
        }
        expect(ids.size).toBe(100);
      });

      it("should generate IDs with correct prefix", () => {
        const id = generateBacktestId();
        expect(id).toMatch(/^bt-[a-z0-9]+-[a-z0-9]+$/);
      });
    });

    describe("generateDetectionId", () => {
      it("should generate unique IDs", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
          ids.add(generateDetectionId());
        }
        expect(ids.size).toBe(100);
      });

      it("should generate IDs with correct prefix", () => {
        const id = generateDetectionId();
        expect(id).toMatch(/^det-[a-z0-9]+-[a-z0-9]+$/);
      });
    });

    describe("getStrategyTypeDescription", () => {
      it("should return correct description for INSIDER_DETECTION", () => {
        expect(getStrategyTypeDescription(StrategyType.INSIDER_DETECTION)).toBe(
          "Insider Trading Detection"
        );
      });

      it("should return correct description for WHALE_DETECTION", () => {
        expect(getStrategyTypeDescription(StrategyType.WHALE_DETECTION)).toBe(
          "Whale Activity Detection"
        );
      });

      it("should return correct description for FRESH_WALLET_DETECTION", () => {
        expect(getStrategyTypeDescription(StrategyType.FRESH_WALLET_DETECTION)).toBe(
          "Fresh Wallet Detection"
        );
      });

      it("should return correct description for COORDINATED_TRADING", () => {
        expect(getStrategyTypeDescription(StrategyType.COORDINATED_TRADING)).toBe(
          "Coordinated Trading Detection"
        );
      });

      it("should return correct description for VOLUME_ANOMALY", () => {
        expect(getStrategyTypeDescription(StrategyType.VOLUME_ANOMALY)).toBe(
          "Volume Anomaly Detection"
        );
      });

      it("should return correct description for COMPOSITE", () => {
        expect(getStrategyTypeDescription(StrategyType.COMPOSITE)).toBe(
          "Composite Strategy"
        );
      });

      it("should return correct description for CUSTOM", () => {
        expect(getStrategyTypeDescription(StrategyType.CUSTOM)).toBe(
          "Custom Strategy"
        );
      });
    });

    describe("getValidationMethodDescription", () => {
      it("should return correct description for TRAIN_TEST_SPLIT", () => {
        expect(getValidationMethodDescription(ValidationMethod.TRAIN_TEST_SPLIT)).toBe(
          "Train/Test Split"
        );
      });

      it("should return correct description for K_FOLD_CV", () => {
        expect(getValidationMethodDescription(ValidationMethod.K_FOLD_CV)).toBe(
          "K-Fold Cross Validation"
        );
      });

      it("should return correct description for WALK_FORWARD", () => {
        expect(getValidationMethodDescription(ValidationMethod.WALK_FORWARD)).toBe(
          "Walk-Forward Validation"
        );
      });

      it("should return correct description for LEAVE_ONE_OUT", () => {
        expect(getValidationMethodDescription(ValidationMethod.LEAVE_ONE_OUT)).toBe(
          "Leave-One-Out Validation"
        );
      });

      it("should return correct description for NONE", () => {
        expect(getValidationMethodDescription(ValidationMethod.NONE)).toBe(
          "No Validation"
        );
      });
    });

    describe("getPerformanceTierDescription", () => {
      it("should return correct description for EXCELLENT", () => {
        expect(getPerformanceTierDescription(PerformanceTier.EXCELLENT)).toBe(
          "Excellent - Production Ready"
        );
      });

      it("should return correct description for GOOD", () => {
        expect(getPerformanceTierDescription(PerformanceTier.GOOD)).toBe(
          "Good - Recommended for Use"
        );
      });

      it("should return correct description for ACCEPTABLE", () => {
        expect(getPerformanceTierDescription(PerformanceTier.ACCEPTABLE)).toBe(
          "Acceptable - Monitor Performance"
        );
      });

      it("should return correct description for POOR", () => {
        expect(getPerformanceTierDescription(PerformanceTier.POOR)).toBe(
          "Poor - Needs Improvement"
        );
      });

      it("should return correct description for VERY_POOR", () => {
        expect(getPerformanceTierDescription(PerformanceTier.VERY_POOR)).toBe(
          "Very Poor - Not Recommended"
        );
      });
    });

    describe("getPerformanceTierColor", () => {
      it("should return green for EXCELLENT", () => {
        expect(getPerformanceTierColor(PerformanceTier.EXCELLENT)).toBe("#22c55e");
      });

      it("should return blue for GOOD", () => {
        expect(getPerformanceTierColor(PerformanceTier.GOOD)).toBe("#3b82f6");
      });

      it("should return yellow for ACCEPTABLE", () => {
        expect(getPerformanceTierColor(PerformanceTier.ACCEPTABLE)).toBe("#eab308");
      });

      it("should return orange for POOR", () => {
        expect(getPerformanceTierColor(PerformanceTier.POOR)).toBe("#f97316");
      });

      it("should return red for VERY_POOR", () => {
        expect(getPerformanceTierColor(PerformanceTier.VERY_POOR)).toBe("#ef4444");
      });
    });

    describe("getBacktestStatusDescription", () => {
      it("should return correct description for IDLE", () => {
        expect(getBacktestStatusDescription(BacktestStatus.IDLE)).toBe("Idle");
      });

      it("should return correct description for LOADING_DATA", () => {
        expect(getBacktestStatusDescription(BacktestStatus.LOADING_DATA)).toBe(
          "Loading Data"
        );
      });

      it("should return correct description for RUNNING", () => {
        expect(getBacktestStatusDescription(BacktestStatus.RUNNING)).toBe("Running");
      });

      it("should return correct description for COMPLETED", () => {
        expect(getBacktestStatusDescription(BacktestStatus.COMPLETED)).toBe("Completed");
      });

      it("should return correct description for FAILED", () => {
        expect(getBacktestStatusDescription(BacktestStatus.FAILED)).toBe("Failed");
      });

      it("should return correct description for CANCELLED", () => {
        expect(getBacktestStatusDescription(BacktestStatus.CANCELLED)).toBe("Cancelled");
      });
    });

    describe("formatAccuracyPercent", () => {
      it("should format 0 correctly", () => {
        expect(formatAccuracyPercent(0)).toBe("0.0%");
      });

      it("should format 1 correctly", () => {
        expect(formatAccuracyPercent(1)).toBe("100.0%");
      });

      it("should format 0.5 correctly", () => {
        expect(formatAccuracyPercent(0.5)).toBe("50.0%");
      });

      it("should format with one decimal place", () => {
        expect(formatAccuracyPercent(0.756)).toBe("75.6%");
      });
    });

    describe("formatMetricsForDisplay", () => {
      it("should format all metrics correctly", () => {
        const metrics = createMockMetrics();
        const formatted = formatMetricsForDisplay(metrics);

        expect(formatted.accuracy).toMatch(/\d+\.\d%$/);
        expect(formatted.precision).toMatch(/\d+\.\d%$/);
        expect(formatted.recall).toMatch(/\d+\.\d%$/);
        expect(formatted.f1Score).toMatch(/\d+\.\d%$/);
        expect(formatted.mcc).toMatch(/^-?\d+\.\d+$/);
        expect(formatted.aucRoc).toMatch(/^\d+\.\d+$/);
      });
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("Factory Functions", () => {
    describe("createBacktestingFramework", () => {
      it("should create a new instance with default config", () => {
        const fw = createBacktestingFramework();
        expect(fw).toBeInstanceOf(BacktestingFramework);
        expect(fw.getConfig().cacheEnabled).toBe(true);
      });

      it("should create a new instance with custom config", () => {
        const fw = createBacktestingFramework({ cacheEnabled: false });
        expect(fw.getConfig().cacheEnabled).toBe(false);
      });
    });

    describe("getSharedBacktestingFramework", () => {
      it("should return the same instance on subsequent calls", () => {
        const fw1 = getSharedBacktestingFramework();
        const fw2 = getSharedBacktestingFramework();
        expect(fw1).toBe(fw2);
      });
    });

    describe("setSharedBacktestingFramework", () => {
      it("should replace the shared instance", () => {
        const customFw = createBacktestingFramework({ maxConcurrent: 10 });
        setSharedBacktestingFramework(customFw);
        expect(getSharedBacktestingFramework()).toBe(customFw);
      });
    });

    describe("resetSharedBacktestingFramework", () => {
      it("should reset the shared instance", () => {
        const fw1 = getSharedBacktestingFramework();
        resetSharedBacktestingFramework();
        const fw2 = getSharedBacktestingFramework();
        expect(fw1).not.toBe(fw2);
      });
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe("Configuration", () => {
    describe("createDefaultStrategyConfig", () => {
      it("should create config with correct type", () => {
        const config = createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION);
        expect(config.type).toBe(StrategyType.INSIDER_DETECTION);
      });

      it("should include name and description", () => {
        const config = createDefaultStrategyConfig(StrategyType.WHALE_DETECTION);
        expect(config.name).toBe("Whale Activity Detection");
        expect(config.description).toContain("Whale Activity Detection");
      });

      it("should include default thresholds", () => {
        const config = createDefaultStrategyConfig(StrategyType.FRESH_WALLET_DETECTION);
        expect(config.thresholds.suspicionThreshold).toBe(
          DEFAULT_DETECTION_THRESHOLDS.suspicionThreshold
        );
      });
    });

    describe("createDefaultBacktestConfig", () => {
      it("should create config with correct dates", () => {
        const startDate = new Date("2024-01-01");
        const endDate = new Date("2024-03-01");
        const config = createDefaultBacktestConfig(
          StrategyType.INSIDER_DETECTION,
          startDate,
          endDate
        );

        expect(config.startDate).toEqual(startDate);
        expect(config.endDate).toEqual(endDate);
      });

      it("should include default validation method", () => {
        const config = createDefaultBacktestConfig(
          StrategyType.INSIDER_DETECTION,
          new Date(),
          new Date()
        );
        expect(config.validationMethod).toBe(ValidationMethod.WALK_FORWARD);
      });

      it("should include strategy config", () => {
        const config = createDefaultBacktestConfig(
          StrategyType.WHALE_DETECTION,
          new Date(),
          new Date()
        );
        expect(config.strategy.type).toBe(StrategyType.WHALE_DETECTION);
      });
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    describe("DEFAULT_BACKTEST_CONFIG", () => {
      it("should have correct default values", () => {
        expect(DEFAULT_BACKTEST_CONFIG.validationMethod).toBe(
          ValidationMethod.WALK_FORWARD
        );
        expect(DEFAULT_BACKTEST_CONFIG.trainTestSplit).toBe(0.8);
        expect(DEFAULT_BACKTEST_CONFIG.kFolds).toBe(5);
      });
    });

    describe("DEFAULT_DETECTION_THRESHOLDS", () => {
      it("should have reasonable suspicion threshold", () => {
        expect(DEFAULT_DETECTION_THRESHOLDS.suspicionThreshold).toBeGreaterThan(0);
        expect(DEFAULT_DETECTION_THRESHOLDS.suspicionThreshold).toBeLessThanOrEqual(100);
      });

      it("should have whale trade minimum", () => {
        expect(DEFAULT_DETECTION_THRESHOLDS.whaleTradeMinUsd).toBeGreaterThan(0);
      });

      it("should have fresh wallet age threshold", () => {
        expect(DEFAULT_DETECTION_THRESHOLDS.freshWalletMaxAgeDays).toBeGreaterThan(0);
      });
    });

    describe("DEFAULT_FRAMEWORK_CONFIG", () => {
      it("should have caching enabled by default", () => {
        expect(DEFAULT_FRAMEWORK_CONFIG.cacheEnabled).toBe(true);
      });

      it("should have reasonable cache TTL", () => {
        expect(DEFAULT_FRAMEWORK_CONFIG.cacheTtlMs).toBeGreaterThan(0);
      });

      it("should have max concurrent limit", () => {
        expect(DEFAULT_FRAMEWORK_CONFIG.maxConcurrent).toBeGreaterThan(0);
      });
    });

    describe("PERFORMANCE_TIER_THRESHOLDS", () => {
      it("should have EXCELLENT tier with high thresholds", () => {
        expect(PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.EXCELLENT].minF1).toBeGreaterThan(0.8);
        expect(PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.EXCELLENT].minAccuracy).toBeGreaterThan(
          0.9
        );
      });

      it("should have tiers in descending order", () => {
        expect(PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.EXCELLENT].minF1).toBeGreaterThan(
          PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.GOOD].minF1
        );
        expect(PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.GOOD].minF1).toBeGreaterThan(
          PERFORMANCE_TIER_THRESHOLDS[PerformanceTier.ACCEPTABLE].minF1
        );
      });
    });
  });

  // ==========================================================================
  // Mock Data Generator Tests
  // ==========================================================================

  describe("Mock Data Generators", () => {
    describe("createMockBacktestReport", () => {
      it("should create a valid report", () => {
        const report = createMockBacktestReport();
        expect(report.reportId).toBeTruthy();
        expect(report.name).toBeTruthy();
        expect(report.overallMetrics).toBeTruthy();
      });

      it("should allow partial overrides", () => {
        const report = createMockBacktestReport({ name: "Custom Report" });
        expect(report.name).toBe("Custom Report");
      });

      it("should have valid performance tier", () => {
        const report = createMockBacktestReport();
        expect(Object.values(PerformanceTier)).toContain(report.performanceTier);
      });
    });

    describe("createMockMetrics", () => {
      it("should create metrics with all required fields", () => {
        const metrics = createMockMetrics();
        expect(metrics.accuracy).toBeDefined();
        expect(metrics.precision).toBeDefined();
        expect(metrics.recall).toBeDefined();
        expect(metrics.f1Score).toBeDefined();
        expect(metrics.truePositives).toBeDefined();
        expect(metrics.falsePositives).toBeDefined();
      });

      it("should allow partial overrides", () => {
        const metrics = createMockMetrics({ accuracy: 0.95 });
        expect(metrics.accuracy).toBe(0.95);
      });

      it("should have values in valid ranges", () => {
        const metrics = createMockMetrics();
        expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
        expect(metrics.accuracy).toBeLessThanOrEqual(1);
        expect(metrics.precision).toBeGreaterThanOrEqual(0);
        expect(metrics.precision).toBeLessThanOrEqual(1);
      });
    });

    describe("createMockDetectionResult", () => {
      it("should create a valid detection result", () => {
        const detection = createMockDetectionResult();
        expect(detection.detectionId).toBeTruthy();
        expect(detection.timestamp).toBeInstanceOf(Date);
        expect(detection.strategy).toBeTruthy();
      });

      it("should allow partial overrides", () => {
        const detection = createMockDetectionResult({
          confidence: 0.99,
          marketId: "custom-market",
        });
        expect(detection.confidence).toBe(0.99);
        expect(detection.marketId).toBe("custom-market");
      });

      it("should have valid suspicion score", () => {
        const detection = createMockDetectionResult();
        expect(detection.suspicionScore).toBeGreaterThanOrEqual(0);
        expect(detection.suspicionScore).toBeLessThanOrEqual(100);
      });
    });

    describe("createMockHistoricalDataset", () => {
      it("should create a valid dataset", () => {
        const dataset = createMockHistoricalDataset();
        expect(dataset.name).toBeTruthy();
        expect(dataset.startDate).toBeInstanceOf(Date);
        expect(dataset.endDate).toBeInstanceOf(Date);
      });

      it("should allow partial overrides", () => {
        const customDate = new Date("2023-01-01");
        const dataset = createMockHistoricalDataset({ startDate: customDate });
        expect(dataset.startDate).toEqual(customDate);
      });

      it("should have valid quality score", () => {
        const dataset = createMockHistoricalDataset();
        expect(dataset.qualityScore).toBeGreaterThanOrEqual(0);
        expect(dataset.qualityScore).toBeLessThanOrEqual(100);
      });
    });
  });

  // ==========================================================================
  // Framework Instance Tests
  // ==========================================================================

  describe("BacktestingFramework Instance", () => {
    describe("constructor", () => {
      it("should create with default config", () => {
        const fw = new BacktestingFramework();
        expect(fw.getConfig().cacheEnabled).toBe(DEFAULT_FRAMEWORK_CONFIG.cacheEnabled);
      });

      it("should merge custom config with defaults", () => {
        const fw = new BacktestingFramework({ maxConcurrent: 10 });
        expect(fw.getConfig().maxConcurrent).toBe(10);
        expect(fw.getConfig().cacheEnabled).toBe(DEFAULT_FRAMEWORK_CONFIG.cacheEnabled);
      });
    });

    describe("getActiveBacktestCount", () => {
      it("should return 0 when no backtests are running", () => {
        expect(framework.getActiveBacktestCount()).toBe(0);
      });
    });

    describe("getStatistics", () => {
      it("should return initial statistics", () => {
        const stats = framework.getStatistics();
        expect(stats.totalBacktests).toBe(0);
        expect(stats.completedBacktests).toBe(0);
        expect(stats.failedBacktests).toBe(0);
      });
    });

    describe("getConfig", () => {
      it("should return a copy of the config", () => {
        const config = framework.getConfig();
        config.maxConcurrent = 999;
        expect(framework.getConfig().maxConcurrent).not.toBe(999);
      });
    });

    describe("updateConfig", () => {
      it("should update config values", () => {
        framework.updateConfig({ maxConcurrent: 5 });
        expect(framework.getConfig().maxConcurrent).toBe(5);
      });

      it("should preserve other config values", () => {
        const originalCacheTtl = framework.getConfig().cacheTtlMs;
        framework.updateConfig({ maxConcurrent: 5 });
        expect(framework.getConfig().cacheTtlMs).toBe(originalCacheTtl);
      });
    });

    describe("clearCache", () => {
      it("should clear the cache without error", () => {
        expect(() => framework.clearCache()).not.toThrow();
      });
    });

    describe("cancelBacktest", () => {
      it("should return false for non-existent backtest", () => {
        expect(framework.cancelBacktest("non-existent-id")).toBe(false);
      });
    });

    describe("getBacktestProgress", () => {
      it("should return null for non-existent backtest", () => {
        expect(framework.getBacktestProgress("non-existent-id")).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Backtest Execution Tests
  // ==========================================================================

  describe("Backtest Execution", () => {
    describe("runBacktest", () => {
      it("should run a simple backtest successfully", async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "Test Backtest",
          description: "Test description",
          strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
          dataSources: [DataSourceType.ALL],
          startDate,
          endDate,
          validationMethod: ValidationMethod.NONE,
          reportDetailLevel: ReportDetailLevel.SUMMARY,
        };

        const report = await framework.runBacktest(config);

        expect(report.reportId).toBeTruthy();
        expect(report.name).toBe("Test Backtest");
        expect(report.overallMetrics).toBeTruthy();
        expect(report.performanceTier).toBeTruthy();
      }, 10000);

      it("should run train/test split backtest", async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "Train/Test Backtest",
          description: "Test",
          strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
          dataSources: [DataSourceType.TRADES],
          startDate,
          endDate,
          validationMethod: ValidationMethod.TRAIN_TEST_SPLIT,
          trainTestSplit: 0.7,
          reportDetailLevel: ReportDetailLevel.STANDARD,
        };

        const report = await framework.runBacktest(config);

        expect(report.validationMethod).toBe(ValidationMethod.TRAIN_TEST_SPLIT);
        expect(report.overallMetrics.totalDetections).toBeGreaterThanOrEqual(0);
      }, 10000);

      it("should run k-fold cross validation backtest", async () => {
        const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "K-Fold Backtest",
          description: "Test",
          strategy: createDefaultStrategyConfig(StrategyType.FRESH_WALLET_DETECTION),
          dataSources: [DataSourceType.TRADES],
          startDate,
          endDate,
          validationMethod: ValidationMethod.K_FOLD_CV,
          kFolds: 3,
          reportDetailLevel: ReportDetailLevel.STANDARD,
        };

        const report = await framework.runBacktest(config);

        expect(report.validationMethod).toBe(ValidationMethod.K_FOLD_CV);
      }, 15000);

      it("should run walk-forward validation backtest", async () => {
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "Walk-Forward Backtest",
          description: "Test",
          strategy: createDefaultStrategyConfig(StrategyType.COORDINATED_TRADING),
          dataSources: [DataSourceType.ALL],
          startDate,
          endDate,
          validationMethod: ValidationMethod.WALK_FORWARD,
          walkForwardWindowDays: 20,
          reportDetailLevel: ReportDetailLevel.DETAILED,
        };

        const report = await framework.runBacktest(config);

        expect(report.validationMethod).toBe(ValidationMethod.WALK_FORWARD);
        expect(report.walkForwardFolds).toBeDefined();
        if (report.walkForwardFolds) {
          expect(report.walkForwardFolds.length).toBeGreaterThan(0);
        }
      }, 20000);

      it("should update statistics after backtest", async () => {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "Stats Test",
          description: "Test",
          strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
          dataSources: [DataSourceType.TRADES],
          startDate,
          endDate,
          validationMethod: ValidationMethod.NONE,
          reportDetailLevel: ReportDetailLevel.SUMMARY,
        };

        await framework.runBacktest(config);

        const stats = framework.getStatistics();
        expect(stats.totalBacktests).toBeGreaterThan(0);
        expect(stats.completedBacktests).toBeGreaterThan(0);
      }, 10000);

      it("should emit events during backtest", async () => {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: "Events Test",
          description: "Test",
          strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
          dataSources: [DataSourceType.TRADES],
          startDate,
          endDate,
          validationMethod: ValidationMethod.NONE,
          reportDetailLevel: ReportDetailLevel.SUMMARY,
        };

        const events: string[] = [];
        framework.on("backtest:started", () => events.push("started"));
        framework.on("backtest:completed", () => events.push("completed"));
        framework.on("data:loaded", () => events.push("data_loaded"));

        await framework.runBacktest(config);

        expect(events).toContain("started");
        expect(events).toContain("completed");
        expect(events).toContain("data_loaded");
      }, 10000);
    });

    describe("loadHistoricalData", () => {
      it("should load historical data", async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const dataset = await framework.loadHistoricalData(
          "test-id",
          [DataSourceType.ALL],
          startDate,
          endDate
        );

        expect(dataset.trades.length).toBeGreaterThan(0);
        expect(dataset.markets.length).toBeGreaterThan(0);
        expect(dataset.wallets.length).toBeGreaterThan(0);
      });

      it("should cache dataset results", async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const dataset1 = await framework.loadHistoricalData(
          "test-id-1",
          [DataSourceType.ALL],
          startDate,
          endDate
        );

        const dataset2 = await framework.loadHistoricalData(
          "test-id-2",
          [DataSourceType.ALL],
          startDate,
          endDate
        );

        // Should return cached data (same structure)
        expect(dataset1.trades.length).toBe(dataset2.trades.length);
      });
    });
  });

  // ==========================================================================
  // Report Tests
  // ==========================================================================

  describe("Backtest Reports", () => {
    it("should generate report with all required fields", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Report Fields Test",
        description: "Testing report fields",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.DETAILED,
      };

      const report = await framework.runBacktest(config);

      expect(report.reportId).toBeTruthy();
      expect(report.name).toBe("Report Fields Test");
      expect(report.description).toBe("Testing report fields");
      expect(report.strategy).toBeTruthy();
      expect(report.datasetInfo).toBeTruthy();
      expect(report.overallMetrics).toBeTruthy();
      expect(report.performanceTier).toBeTruthy();
      expect(report.performanceScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScore).toBeLessThanOrEqual(100);
      expect(report.startedAt).toBeInstanceOf(Date);
      expect(report.completedAt).toBeInstanceOf(Date);
      expect(report.runtimeMs).toBeGreaterThanOrEqual(0);
    }, 10000);

    it("should include detections with DETAILED report level", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Detailed Report Test",
        description: "Test",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.DETAILED,
      };

      const report = await framework.runBacktest(config);

      expect(report.detections).toBeDefined();
    }, 10000);

    it("should not include detections with SUMMARY report level", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Summary Report Test",
        description: "Test",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      const report = await framework.runBacktest(config);

      expect(report.detections).toBeUndefined();
    }, 10000);

    it("should include insights in report", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Insights Test",
        description: "Test",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      expect(report.insights).toBeDefined();
      expect(Array.isArray(report.insights)).toBe(true);
    }, 10000);
  });

  // ==========================================================================
  // Metrics Tests
  // ==========================================================================

  describe("Metrics Calculation", () => {
    it("should calculate metrics within valid ranges", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Metrics Range Test",
        description: "Test",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);
      const metrics = report.overallMetrics;

      // All rate metrics should be between 0 and 1
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.precision).toBeLessThanOrEqual(1);
      expect(metrics.recall).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeLessThanOrEqual(1);
      expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(metrics.f1Score).toBeLessThanOrEqual(1);

      // MCC is between -1 and 1
      expect(metrics.mcc).toBeGreaterThanOrEqual(-1);
      expect(metrics.mcc).toBeLessThanOrEqual(1);

      // AUC-ROC should be between 0 and 1
      expect(metrics.aucRoc).toBeGreaterThanOrEqual(0);
      expect(metrics.aucRoc).toBeLessThanOrEqual(1);
    }, 10000);

    it("should have consistent confusion matrix", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Confusion Matrix Test",
        description: "Test",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);
      const metrics = report.overallMetrics;

      // All counts should be non-negative
      expect(metrics.truePositives).toBeGreaterThanOrEqual(0);
      expect(metrics.trueNegatives).toBeGreaterThanOrEqual(0);
      expect(metrics.falsePositives).toBeGreaterThanOrEqual(0);
      expect(metrics.falseNegatives).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  // ==========================================================================
  // Enums Tests
  // ==========================================================================

  describe("Enums", () => {
    describe("BacktestStatus", () => {
      it("should have all expected values", () => {
        expect(BacktestStatus.IDLE).toBe("IDLE");
        expect(BacktestStatus.LOADING_DATA).toBe("LOADING_DATA");
        expect(BacktestStatus.RUNNING).toBe("RUNNING");
        expect(BacktestStatus.COMPLETED).toBe("COMPLETED");
        expect(BacktestStatus.FAILED).toBe("FAILED");
        expect(BacktestStatus.CANCELLED).toBe("CANCELLED");
      });
    });

    describe("StrategyType", () => {
      it("should have all expected values", () => {
        expect(StrategyType.INSIDER_DETECTION).toBe("INSIDER_DETECTION");
        expect(StrategyType.WHALE_DETECTION).toBe("WHALE_DETECTION");
        expect(StrategyType.FRESH_WALLET_DETECTION).toBe("FRESH_WALLET_DETECTION");
        expect(StrategyType.COORDINATED_TRADING).toBe("COORDINATED_TRADING");
        expect(StrategyType.VOLUME_ANOMALY).toBe("VOLUME_ANOMALY");
        expect(StrategyType.PRICE_MANIPULATION).toBe("PRICE_MANIPULATION");
        expect(StrategyType.COMPOSITE).toBe("COMPOSITE");
        expect(StrategyType.CUSTOM).toBe("CUSTOM");
      });
    });

    describe("ValidationMethod", () => {
      it("should have all expected values", () => {
        expect(ValidationMethod.TRAIN_TEST_SPLIT).toBe("TRAIN_TEST_SPLIT");
        expect(ValidationMethod.K_FOLD_CV).toBe("K_FOLD_CV");
        expect(ValidationMethod.WALK_FORWARD).toBe("WALK_FORWARD");
        expect(ValidationMethod.LEAVE_ONE_OUT).toBe("LEAVE_ONE_OUT");
        expect(ValidationMethod.NONE).toBe("NONE");
      });
    });

    describe("PerformanceTier", () => {
      it("should have all expected values", () => {
        expect(PerformanceTier.EXCELLENT).toBe("EXCELLENT");
        expect(PerformanceTier.GOOD).toBe("GOOD");
        expect(PerformanceTier.ACCEPTABLE).toBe("ACCEPTABLE");
        expect(PerformanceTier.POOR).toBe("POOR");
        expect(PerformanceTier.VERY_POOR).toBe("VERY_POOR");
      });
    });

    describe("DataSourceType", () => {
      it("should have all expected values", () => {
        expect(DataSourceType.TRADES).toBe("TRADES");
        expect(DataSourceType.MARKET_PRICES).toBe("MARKET_PRICES");
        expect(DataSourceType.ORDER_BOOK).toBe("ORDER_BOOK");
        expect(DataSourceType.WALLET_ACTIVITY).toBe("WALLET_ACTIVITY");
        expect(DataSourceType.ALERTS).toBe("ALERTS");
        expect(DataSourceType.RESOLUTIONS).toBe("RESOLUTIONS");
        expect(DataSourceType.ALL).toBe("ALL");
      });
    });

    describe("ReportDetailLevel", () => {
      it("should have all expected values", () => {
        expect(ReportDetailLevel.SUMMARY).toBe("SUMMARY");
        expect(ReportDetailLevel.STANDARD).toBe("STANDARD");
        expect(ReportDetailLevel.DETAILED).toBe("DETAILED");
        expect(ReportDetailLevel.DEBUG).toBe("DEBUG");
      });
    });
  });
});
