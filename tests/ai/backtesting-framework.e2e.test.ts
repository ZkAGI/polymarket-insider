/**
 * E2E Tests for Backtesting Framework (AI-PRED-005)
 *
 * End-to-end tests for full backtesting workflows, including
 * data loading, strategy simulation, report generation, and validation methods.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  BacktestingFramework,
  createBacktestingFramework,
  getSharedBacktestingFramework,
  resetSharedBacktestingFramework,
  BacktestStatus,
  StrategyType,
  DataSourceType,
  ValidationMethod,
  ReportDetailLevel,
  PerformanceTier,
  DEFAULT_DETECTION_THRESHOLDS,
  createDefaultStrategyConfig,
  createDefaultBacktestConfig,
  type BacktestConfig,
  type BacktestProgress,
} from "../../src/ai/backtesting-framework";

describe("Backtesting Framework E2E Tests", () => {
  let framework: BacktestingFramework;

  beforeEach(() => {
    framework = createBacktestingFramework();
    resetSharedBacktestingFramework();
  });

  afterEach(() => {
    framework.clearCache();
  });

  // ==========================================================================
  // Full Backtest Workflow Tests
  // ==========================================================================

  describe("Full Backtest Workflows", () => {
    it("should complete a full insider detection backtest workflow", async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config = createDefaultBacktestConfig(
        StrategyType.INSIDER_DETECTION,
        startDate,
        endDate
      );
      config.validationMethod = ValidationMethod.WALK_FORWARD;
      config.walkForwardWindowDays = 15;
      config.reportDetailLevel = ReportDetailLevel.DETAILED;

      // Run the backtest
      const report = await framework.runBacktest(config);

      // Verify report structure
      expect(report.reportId).toBeTruthy();
      expect(report.strategy.type).toBe(StrategyType.INSIDER_DETECTION);
      expect(report.validationMethod).toBe(ValidationMethod.WALK_FORWARD);
      expect(report.walkForwardFolds).toBeDefined();
      expect(report.detections).toBeDefined();
      expect(report.insights).toBeDefined();
      expect(report.overallMetrics).toBeDefined();
      expect(report.performanceTier).toBeTruthy();
      expect(report.runtimeMs).toBeGreaterThan(0);
    }, 30000);

    it("should complete a whale detection backtest with k-fold validation", async () => {
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Whale Detection K-Fold Test",
        description: "E2E test for whale detection with k-fold CV",
        strategy: {
          ...createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
          thresholds: {
            ...DEFAULT_DETECTION_THRESHOLDS,
            whaleTradeMinUsd: 5000, // Lower threshold for testing
          },
        },
        dataSources: [DataSourceType.TRADES, DataSourceType.WALLET_ACTIVITY],
        startDate,
        endDate,
        validationMethod: ValidationMethod.K_FOLD_CV,
        kFolds: 5,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      expect(report.validationMethod).toBe(ValidationMethod.K_FOLD_CV);
      expect(report.overallMetrics.totalDetections).toBeGreaterThanOrEqual(0);
      expect(report.periodMetrics).toBeDefined();
    }, 30000);

    it("should complete a fresh wallet detection backtest with train/test split", async () => {
      const startDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Fresh Wallet Train/Test Test",
        description: "E2E test for fresh wallet detection",
        strategy: {
          ...createDefaultStrategyConfig(StrategyType.FRESH_WALLET_DETECTION),
          thresholds: {
            ...DEFAULT_DETECTION_THRESHOLDS,
            freshWalletMaxAgeDays: 14, // 2 weeks
          },
        },
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.TRAIN_TEST_SPLIT,
        trainTestSplit: 0.75,
        reportDetailLevel: ReportDetailLevel.DETAILED,
      };

      const report = await framework.runBacktest(config);

      expect(report.validationMethod).toBe(ValidationMethod.TRAIN_TEST_SPLIT);
      expect(report.datasetInfo.startDate).toEqual(startDate);
      expect(report.datasetInfo.endDate).toEqual(endDate);
    }, 30000);

    it("should complete a coordinated trading detection backtest", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config = createDefaultBacktestConfig(
        StrategyType.COORDINATED_TRADING,
        startDate,
        endDate
      );
      config.validationMethod = ValidationMethod.NONE;
      config.reportDetailLevel = ReportDetailLevel.DETAILED;

      const report = await framework.runBacktest(config);

      expect(report.strategy.type).toBe(StrategyType.COORDINATED_TRADING);
      expect(report.completedAt).toBeInstanceOf(Date);
    }, 20000);
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("Event Emission", () => {
    it("should emit all expected events during backtest lifecycle", async () => {
      const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const events: { type: string; data: Record<string, unknown> }[] = [];

      framework.on("backtest:started", (data) => {
        events.push({ type: "started", data });
      });

      framework.on("data:loaded", (data) => {
        events.push({ type: "data_loaded", data });
      });

      framework.on("backtest:progress", (data) => {
        events.push({ type: "progress", data });
      });

      framework.on("backtest:completed", (data) => {
        events.push({ type: "completed", data });
      });

      const config: BacktestConfig = {
        name: "Event Test",
        description: "Testing events",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.WALK_FORWARD,
        walkForwardWindowDays: 5,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      await framework.runBacktest(config);

      // Verify events were emitted
      expect(events.some((e) => e.type === "started")).toBe(true);
      expect(events.some((e) => e.type === "data_loaded")).toBe(true);
      expect(events.some((e) => e.type === "completed")).toBe(true);

      // Verify event data
      const startedEvent = events.find((e) => e.type === "started");
      expect(startedEvent?.data.backtestId).toBeTruthy();

      const completedEvent = events.find((e) => e.type === "completed");
      expect(completedEvent?.data.report).toBeTruthy();
    }, 20000);

    it("should emit progress events during walk-forward validation", async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const progressEvents: BacktestProgress[] = [];

      framework.on("backtest:progress", ({ progress }) => {
        progressEvents.push(progress);
      });

      const config: BacktestConfig = {
        name: "Progress Test",
        description: "Testing progress events",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.WALK_FORWARD,
        walkForwardWindowDays: 10,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      await framework.runBacktest(config);

      // Verify progress events were emitted
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify progress structure
      if (progressEvents.length > 0) {
        const lastProgress = progressEvents[progressEvents.length - 1];
        expect(lastProgress?.status).toBe(BacktestStatus.RUNNING);
        expect(lastProgress?.progressPercent).toBeGreaterThan(0);
      }
    }, 30000);
  });

  // ==========================================================================
  // Statistics Tracking Tests
  // ==========================================================================

  describe("Statistics Tracking", () => {
    it("should accurately track backtest statistics", async () => {
      const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Initial stats should be zero
      let stats = framework.getStatistics();
      expect(stats.totalBacktests).toBe(0);
      expect(stats.completedBacktests).toBe(0);

      // Run first backtest
      const config1: BacktestConfig = {
        name: "Stats Test 1",
        description: "First backtest",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      await framework.runBacktest(config1);

      stats = framework.getStatistics();
      expect(stats.totalBacktests).toBe(1);
      expect(stats.completedBacktests).toBe(1);
      expect(stats.failedBacktests).toBe(0);
      expect(stats.totalRuntimeMs).toBeGreaterThan(0);

      // Run second backtest
      const config2: BacktestConfig = {
        name: "Stats Test 2",
        description: "Second backtest",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      await framework.runBacktest(config2);

      stats = framework.getStatistics();
      expect(stats.totalBacktests).toBe(2);
      expect(stats.completedBacktests).toBe(2);
    }, 30000);
  });

  // ==========================================================================
  // Data Loading Tests
  // ==========================================================================

  describe("Historical Data Loading", () => {
    it("should load comprehensive historical data", async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const dataset = await framework.loadHistoricalData(
        "test-load",
        [DataSourceType.ALL],
        startDate,
        endDate
      );

      // Verify data structure
      expect(dataset.trades.length).toBeGreaterThan(0);
      expect(dataset.markets.length).toBeGreaterThan(0);
      expect(dataset.wallets.length).toBeGreaterThan(0);
      expect(dataset.alerts.length).toBeGreaterThan(0);

      // Verify data quality
      expect(dataset.qualityScore).toBeGreaterThan(0);
      expect(dataset.totalRecords).toBeGreaterThan(0);

      // Verify dates are in range
      for (const trade of dataset.trades.slice(0, 10)) {
        expect(trade.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(trade.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    }, 15000);

    it("should return cached data on subsequent calls", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const startTime = Date.now();
      const dataset1 = await framework.loadHistoricalData(
        "cache-test-1",
        [DataSourceType.ALL],
        startDate,
        endDate
      );
      const firstLoadTime = Date.now() - startTime;

      const startTime2 = Date.now();
      const dataset2 = await framework.loadHistoricalData(
        "cache-test-2",
        [DataSourceType.ALL],
        startDate,
        endDate
      );
      const secondLoadTime = Date.now() - startTime2;

      // Cached load should be faster
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime);

      // Data should match
      expect(dataset1.trades.length).toBe(dataset2.trades.length);
    }, 15000);
  });

  // ==========================================================================
  // Validation Method Tests
  // ==========================================================================

  describe("Validation Methods", () => {
    it("should produce walk-forward folds with train and test metrics", async () => {
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Walk-Forward Folds Test",
        description: "Testing walk-forward fold structure",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.WALK_FORWARD,
        walkForwardWindowDays: 15,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      expect(report.walkForwardFolds).toBeDefined();
      expect(report.walkForwardFolds!.length).toBeGreaterThan(0);

      // Verify fold structure
      for (const fold of report.walkForwardFolds!) {
        expect(fold.foldNumber).toBeGreaterThan(0);
        expect(fold.trainStart).toBeInstanceOf(Date);
        expect(fold.trainEnd).toBeInstanceOf(Date);
        expect(fold.testStart).toBeInstanceOf(Date);
        expect(fold.testEnd).toBeInstanceOf(Date);
        expect(fold.trainMetrics).toBeDefined();
        expect(fold.testMetrics).toBeDefined();
        expect(fold.overfittingScore).toBeGreaterThanOrEqual(0);
      }
    }, 30000);

    it("should handle k-fold cross validation correctly", async () => {
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      const kFolds = 3;

      const config: BacktestConfig = {
        name: "K-Fold Test",
        description: "Testing k-fold",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.K_FOLD_CV,
        kFolds,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      expect(report.validationMethod).toBe(ValidationMethod.K_FOLD_CV);
      expect(report.overallMetrics).toBeDefined();
    }, 30000);
  });

  // ==========================================================================
  // Performance Tier Tests
  // ==========================================================================

  describe("Performance Tier Assessment", () => {
    it("should assign appropriate performance tiers", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Tier Assessment Test",
        description: "Testing tier assignment",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      // Performance tier should be one of the valid values
      const validTiers = Object.values(PerformanceTier);
      expect(validTiers).toContain(report.performanceTier);

      // Performance score should be between 0 and 100
      expect(report.performanceScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScore).toBeLessThanOrEqual(100);
    }, 20000);
  });

  // ==========================================================================
  // Insight Generation Tests
  // ==========================================================================

  describe("Insight Generation", () => {
    it("should generate relevant insights based on metrics", async () => {
      const startDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Insight Test",
        description: "Testing insight generation",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.WALK_FORWARD,
        walkForwardWindowDays: 10,
        reportDetailLevel: ReportDetailLevel.DETAILED,
      };

      const report = await framework.runBacktest(config);

      expect(report.insights).toBeDefined();
      expect(Array.isArray(report.insights)).toBe(true);

      // Each insight should have required fields
      for (const insight of report.insights) {
        expect(insight.type).toBeTruthy();
        expect(["STRENGTH", "WEAKNESS", "RECOMMENDATION", "WARNING"]).toContain(
          insight.type
        );
        expect(insight.title).toBeTruthy();
        expect(insight.description).toBeTruthy();
        expect(insight.priority).toBeGreaterThanOrEqual(1);
        expect(insight.priority).toBeLessThanOrEqual(5);
      }
    }, 30000);
  });

  // ==========================================================================
  // Multiple Strategy Types Tests
  // ==========================================================================

  describe("Multiple Strategy Types", () => {
    const strategyTypes = [
      StrategyType.INSIDER_DETECTION,
      StrategyType.WHALE_DETECTION,
      StrategyType.FRESH_WALLET_DETECTION,
      StrategyType.VOLUME_ANOMALY,
    ];

    for (const strategyType of strategyTypes) {
      it(`should successfully run ${strategyType} backtest`, async () => {
        const startDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const config: BacktestConfig = {
          name: `${strategyType} Test`,
          description: `Testing ${strategyType}`,
          strategy: createDefaultStrategyConfig(strategyType),
          dataSources: [DataSourceType.ALL],
          startDate,
          endDate,
          validationMethod: ValidationMethod.NONE,
          reportDetailLevel: ReportDetailLevel.SUMMARY,
        };

        const report = await framework.runBacktest(config);

        expect(report.strategy.type).toBe(strategyType);
        expect(report.completedAt).toBeInstanceOf(Date);
        expect(report.overallMetrics).toBeDefined();
      }, 15000);
    }
  });

  // ==========================================================================
  // Period Metrics Tests
  // ==========================================================================

  describe("Period Metrics", () => {
    it("should generate period metrics breakdown", async () => {
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config: BacktestConfig = {
        name: "Period Metrics Test",
        description: "Testing period breakdown",
        strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.DETAILED,
      };

      const report = await framework.runBacktest(config);

      expect(report.periodMetrics).toBeDefined();
      expect(Array.isArray(report.periodMetrics)).toBe(true);

      // Period metrics should be sorted by date
      for (let i = 1; i < report.periodMetrics.length; i++) {
        expect(
          report.periodMetrics[i]!.periodStart.getTime()
        ).toBeGreaterThanOrEqual(report.periodMetrics[i - 1]!.periodEnd.getTime());
      }
    }, 20000);
  });

  // ==========================================================================
  // Config Variations Tests
  // ==========================================================================

  describe("Configuration Variations", () => {
    it("should handle custom detection thresholds", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const customThresholds = {
        ...DEFAULT_DETECTION_THRESHOLDS,
        suspicionThreshold: 80,
        whaleTradeMinUsd: 50000,
        freshWalletMaxAgeDays: 3,
        volumeSpikeMultiplier: 5.0,
      };

      const config: BacktestConfig = {
        name: "Custom Thresholds Test",
        description: "Testing custom thresholds",
        strategy: {
          type: StrategyType.INSIDER_DETECTION,
          name: "Custom Insider Detection",
          description: "With custom thresholds",
          parameters: {},
          thresholds: customThresholds,
        },
        dataSources: [DataSourceType.ALL],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.STANDARD,
      };

      const report = await framework.runBacktest(config);

      expect(report.strategy.thresholds.suspicionThreshold).toBe(80);
      expect(report.strategy.thresholds.whaleTradeMinUsd).toBe(50000);
    }, 20000);

    it("should respect report detail level settings", async () => {
      const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Test DEBUG level (includes detections)
      const debugConfig: BacktestConfig = {
        name: "Debug Level Test",
        description: "Testing debug detail",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.DEBUG,
      };

      const debugReport = await framework.runBacktest(debugConfig);
      expect(debugReport.detections).toBeDefined();

      // Test SUMMARY level (no detections)
      const summaryConfig: BacktestConfig = {
        name: "Summary Level Test",
        description: "Testing summary detail",
        strategy: createDefaultStrategyConfig(StrategyType.WHALE_DETECTION),
        dataSources: [DataSourceType.TRADES],
        startDate,
        endDate,
        validationMethod: ValidationMethod.NONE,
        reportDetailLevel: ReportDetailLevel.SUMMARY,
      };

      const summaryReport = await framework.runBacktest(summaryConfig);
      expect(summaryReport.detections).toBeUndefined();
    }, 30000);
  });

  // ==========================================================================
  // Shared Instance Tests
  // ==========================================================================

  describe("Shared Instance Management", () => {
    it("should manage shared instance correctly", async () => {
      resetSharedBacktestingFramework();

      const shared1 = getSharedBacktestingFramework();
      const shared2 = getSharedBacktestingFramework();
      expect(shared1).toBe(shared2);

      resetSharedBacktestingFramework();

      const shared3 = getSharedBacktestingFramework();
      expect(shared3).not.toBe(shared1);
    });

    it("should run backtest using shared instance", async () => {
      resetSharedBacktestingFramework();
      const shared = getSharedBacktestingFramework();

      const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const config = createDefaultBacktestConfig(
        StrategyType.INSIDER_DETECTION,
        startDate,
        endDate
      );
      config.validationMethod = ValidationMethod.NONE;
      config.reportDetailLevel = ReportDetailLevel.SUMMARY;

      const report = await shared.runBacktest(config);

      expect(report.reportId).toBeTruthy();
      expect(shared.getStatistics().completedBacktests).toBe(1);
    }, 15000);
  });
});
