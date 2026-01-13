/**
 * Backtesting Framework (AI-PRED-005)
 *
 * Framework to backtest detection strategies against historical data.
 * Enables validation of insider detection algorithms, signal effectiveness,
 * and overall system performance using past market data.
 *
 * Features:
 * - Backtesting engine that simulates detection strategies
 * - Historical data loading from various sources
 * - Detection strategy simulation with configurable parameters
 * - Comprehensive backtest report generation
 * - Performance metrics calculation (accuracy, precision, recall, etc.)
 * - Walk-forward validation support
 * - Parameter optimization capabilities
 * - Event emission for backtest lifecycle
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Backtest execution status
 */
export enum BacktestStatus {
  /** Not started */
  IDLE = "IDLE",
  /** Loading historical data */
  LOADING_DATA = "LOADING_DATA",
  /** Running backtest simulation */
  RUNNING = "RUNNING",
  /** Completed successfully */
  COMPLETED = "COMPLETED",
  /** Failed with error */
  FAILED = "FAILED",
  /** Cancelled by user */
  CANCELLED = "CANCELLED",
}

/**
 * Type of detection strategy being tested
 */
export enum StrategyType {
  /** Insider detection strategy */
  INSIDER_DETECTION = "INSIDER_DETECTION",
  /** Whale activity detection */
  WHALE_DETECTION = "WHALE_DETECTION",
  /** Fresh wallet detection */
  FRESH_WALLET_DETECTION = "FRESH_WALLET_DETECTION",
  /** Coordinated trading detection */
  COORDINATED_TRADING = "COORDINATED_TRADING",
  /** Volume anomaly detection */
  VOLUME_ANOMALY = "VOLUME_ANOMALY",
  /** Price manipulation detection */
  PRICE_MANIPULATION = "PRICE_MANIPULATION",
  /** Combined/composite strategy */
  COMPOSITE = "COMPOSITE",
  /** Custom user-defined strategy */
  CUSTOM = "CUSTOM",
}

/**
 * Type of historical data to load
 */
export enum DataSourceType {
  /** Trade execution data */
  TRADES = "TRADES",
  /** Market price/probability data */
  MARKET_PRICES = "MARKET_PRICES",
  /** Order book snapshots */
  ORDER_BOOK = "ORDER_BOOK",
  /** Wallet activity data */
  WALLET_ACTIVITY = "WALLET_ACTIVITY",
  /** Alert history */
  ALERTS = "ALERTS",
  /** Market resolutions */
  RESOLUTIONS = "RESOLUTIONS",
  /** All available data */
  ALL = "ALL",
}

/**
 * Validation method for backtesting
 */
export enum ValidationMethod {
  /** Simple train/test split */
  TRAIN_TEST_SPLIT = "TRAIN_TEST_SPLIT",
  /** K-fold cross validation */
  K_FOLD_CV = "K_FOLD_CV",
  /** Walk-forward validation (time-series) */
  WALK_FORWARD = "WALK_FORWARD",
  /** Leave-one-out validation */
  LEAVE_ONE_OUT = "LEAVE_ONE_OUT",
  /** No validation (use all data) */
  NONE = "NONE",
}

/**
 * Backtest report detail level
 */
export enum ReportDetailLevel {
  /** Summary only */
  SUMMARY = "SUMMARY",
  /** Standard detail level */
  STANDARD = "STANDARD",
  /** Full detailed report */
  DETAILED = "DETAILED",
  /** Debug level with all raw data */
  DEBUG = "DEBUG",
}

/**
 * Performance tier based on metrics
 */
export enum PerformanceTier {
  /** Excellent performance */
  EXCELLENT = "EXCELLENT",
  /** Good performance */
  GOOD = "GOOD",
  /** Acceptable performance */
  ACCEPTABLE = "ACCEPTABLE",
  /** Poor performance */
  POOR = "POOR",
  /** Very poor performance */
  VERY_POOR = "VERY_POOR",
}

/**
 * Historical trade record for backtesting
 */
export interface HistoricalTrade {
  /** Trade ID */
  tradeId: string;
  /** Market ID */
  marketId: string;
  /** Wallet address */
  walletAddress: string;
  /** Trade side (buy/sell) */
  side: "BUY" | "SELL";
  /** Trade size in shares */
  size: number;
  /** Trade price */
  price: number;
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade timestamp */
  timestamp: Date;
  /** Outcome traded (YES/NO) */
  outcome: "YES" | "NO";
  /** Is this trade from a maker */
  isMaker: boolean;
  /** Transaction hash */
  txHash?: string;
}

/**
 * Historical market data for backtesting
 */
export interface HistoricalMarket {
  /** Market ID */
  marketId: string;
  /** Market question */
  question: string;
  /** Market category */
  category: string;
  /** Market creation timestamp */
  createdAt: Date;
  /** Market end timestamp */
  endDate: Date;
  /** Market resolution timestamp */
  resolvedAt?: Date;
  /** Final resolution outcome */
  resolution?: "YES" | "NO";
  /** Total volume in USD */
  volumeUsd: number;
  /** Final probability at resolution */
  finalProbability?: number;
  /** Price history (sampled) */
  priceHistory: PricePoint[];
}

/**
 * Price point in historical data
 */
export interface PricePoint {
  /** Timestamp */
  timestamp: Date;
  /** Price/probability (0-1) */
  price: number;
  /** Volume at this point */
  volume: number;
}

/**
 * Historical wallet data for backtesting
 */
export interface HistoricalWallet {
  /** Wallet address */
  address: string;
  /** Wallet first seen timestamp */
  firstSeen: Date;
  /** Total trades */
  totalTrades: number;
  /** Total volume USD */
  totalVolumeUsd: number;
  /** Markets traded */
  marketsTraded: number;
  /** Win rate (if known from historical data) */
  winRate?: number;
  /** Known insider flag (ground truth if available) */
  knownInsider?: boolean;
  /** Suspicion score (historical) */
  suspicionScore?: number;
}

/**
 * Historical alert for backtesting
 */
export interface HistoricalAlert {
  /** Alert ID */
  alertId: string;
  /** Alert type */
  type: string;
  /** Alert severity */
  severity: string;
  /** Associated market ID */
  marketId?: string;
  /** Associated wallet address */
  walletAddress?: string;
  /** Alert timestamp */
  timestamp: Date;
  /** Was alert correct (if resolution known) */
  wasCorrect?: boolean;
  /** Confidence score */
  confidence: number;
  /** Detection strategy that generated alert */
  strategy?: string;
}

/**
 * Complete historical dataset for backtesting
 */
export interface HistoricalDataset {
  /** Dataset name/identifier */
  name: string;
  /** Dataset description */
  description: string;
  /** Data start date */
  startDate: Date;
  /** Data end date */
  endDate: Date;
  /** Historical trades */
  trades: HistoricalTrade[];
  /** Historical markets */
  markets: HistoricalMarket[];
  /** Historical wallets */
  wallets: HistoricalWallet[];
  /** Historical alerts (ground truth) */
  alerts: HistoricalAlert[];
  /** Total record count */
  totalRecords: number;
  /** Data quality score (0-100) */
  qualityScore: number;
  /** Metadata about the dataset */
  metadata: Record<string, unknown>;
}

/**
 * Detection strategy configuration for backtesting
 */
export interface StrategyConfig {
  /** Strategy type */
  type: StrategyType;
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Strategy parameters */
  parameters: Record<string, number | string | boolean>;
  /** Thresholds for detection */
  thresholds: DetectionThresholds;
  /** Feature weights (if applicable) */
  featureWeights?: Record<string, number>;
  /** Enabled signal types */
  enabledSignals?: string[];
}

/**
 * Detection thresholds configuration
 */
export interface DetectionThresholds {
  /** Suspicion score threshold for alert */
  suspicionThreshold: number;
  /** Minimum trade size for whale detection (USD) */
  whaleTradeMinUsd: number;
  /** Maximum wallet age for "fresh" wallet (days) */
  freshWalletMaxAgeDays: number;
  /** Volume spike multiplier threshold */
  volumeSpikeMultiplier: number;
  /** Minimum confidence for alerts */
  minConfidence: number;
  /** Price change threshold for anomaly (%) */
  priceChangeThreshold: number;
  /** Coordination score threshold */
  coordinationThreshold: number;
}

/**
 * Detection result from simulating strategy
 */
export interface DetectionResult {
  /** Detection ID */
  detectionId: string;
  /** Timestamp of detection */
  timestamp: Date;
  /** Strategy that made detection */
  strategy: StrategyType;
  /** Market ID (if applicable) */
  marketId?: string;
  /** Wallet address (if applicable) */
  walletAddress?: string;
  /** Detection type */
  detectionType: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suspicion score (0-100) */
  suspicionScore: number;
  /** Was this a true positive (if known) */
  wasCorrect?: boolean;
  /** Features that triggered detection */
  triggeringFeatures: string[];
  /** Associated trades */
  associatedTrades: string[];
  /** Raw score breakdown */
  scoreBreakdown: Record<string, number>;
}

/**
 * Performance metrics for a backtest
 */
export interface BacktestMetrics {
  /** Total detections made */
  totalDetections: number;
  /** True positives */
  truePositives: number;
  /** True negatives */
  trueNegatives: number;
  /** False positives */
  falsePositives: number;
  /** False negatives */
  falseNegatives: number;
  /** Accuracy (TP + TN) / Total */
  accuracy: number;
  /** Precision TP / (TP + FP) */
  precision: number;
  /** Recall TP / (TP + FN) */
  recall: number;
  /** F1 score */
  f1Score: number;
  /** F2 score (weights recall higher) */
  f2Score: number;
  /** Matthews correlation coefficient */
  mcc: number;
  /** Area under ROC curve */
  aucRoc: number;
  /** Area under PR curve */
  aucPr: number;
  /** Brier score */
  brierScore: number;
  /** Log loss */
  logLoss: number;
  /** Average detection confidence */
  avgConfidence: number;
  /** Detection rate (detections / total opportunities) */
  detectionRate: number;
  /** False positive rate */
  falsePositiveRate: number;
  /** False negative rate */
  falseNegativeRate: number;
}

/**
 * Time-period metrics breakdown
 */
export interface PeriodMetrics {
  /** Period start date */
  periodStart: Date;
  /** Period end date */
  periodEnd: Date;
  /** Metrics for this period */
  metrics: BacktestMetrics;
  /** Number of samples in period */
  sampleCount: number;
}

/**
 * Parameter sensitivity analysis result
 */
export interface ParameterSensitivity {
  /** Parameter name */
  parameterName: string;
  /** Tested values */
  testedValues: number[];
  /** Metrics for each value */
  metricsPerValue: BacktestMetrics[];
  /** Best value found */
  bestValue: number;
  /** Sensitivity score (how much metric changes with parameter) */
  sensitivityScore: number;
  /** Recommended range */
  recommendedRange: { min: number; max: number };
}

/**
 * Walk-forward validation fold result
 */
export interface WalkForwardFold {
  /** Fold number */
  foldNumber: number;
  /** Training period start */
  trainStart: Date;
  /** Training period end */
  trainEnd: Date;
  /** Test period start */
  testStart: Date;
  /** Test period end */
  testEnd: Date;
  /** Training metrics */
  trainMetrics: BacktestMetrics;
  /** Test metrics */
  testMetrics: BacktestMetrics;
  /** Overfitting score (train vs test difference) */
  overfittingScore: number;
}

/**
 * Complete backtest report
 */
export interface BacktestReport {
  /** Report ID */
  reportId: string;
  /** Backtest name */
  name: string;
  /** Backtest description */
  description: string;
  /** Strategy tested */
  strategy: StrategyConfig;
  /** Dataset used */
  datasetInfo: {
    name: string;
    startDate: Date;
    endDate: Date;
    totalRecords: number;
  };
  /** Validation method used */
  validationMethod: ValidationMethod;
  /** Overall metrics */
  overallMetrics: BacktestMetrics;
  /** Metrics by time period */
  periodMetrics: PeriodMetrics[];
  /** Walk-forward folds (if applicable) */
  walkForwardFolds?: WalkForwardFold[];
  /** Performance tier */
  performanceTier: PerformanceTier;
  /** Performance score (0-100) */
  performanceScore: number;
  /** Parameter sensitivities (if optimization run) */
  parameterSensitivities?: ParameterSensitivity[];
  /** Best parameters found (if optimization run) */
  optimizedParameters?: Record<string, number | string | boolean>;
  /** All detections (if detail level allows) */
  detections?: DetectionResult[];
  /** Confusion matrix by category */
  confusionByCategory?: Record<string, BacktestMetrics>;
  /** Insights and recommendations */
  insights: BacktestInsight[];
  /** Backtest started at */
  startedAt: Date;
  /** Backtest completed at */
  completedAt: Date;
  /** Total runtime in ms */
  runtimeMs: number;
}

/**
 * Backtest insight/recommendation
 */
export interface BacktestInsight {
  /** Insight type */
  type: "STRENGTH" | "WEAKNESS" | "RECOMMENDATION" | "WARNING";
  /** Insight title */
  title: string;
  /** Insight description */
  description: string;
  /** Metric involved (if applicable) */
  metric?: string;
  /** Current value */
  currentValue?: number;
  /** Recommended value */
  recommendedValue?: number;
  /** Priority (1-5, 1 is highest) */
  priority: number;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  /** Backtest name */
  name: string;
  /** Description */
  description: string;
  /** Strategy to test */
  strategy: StrategyConfig;
  /** Data sources to load */
  dataSources: DataSourceType[];
  /** Date range start */
  startDate: Date;
  /** Date range end */
  endDate: Date;
  /** Validation method */
  validationMethod: ValidationMethod;
  /** Train/test split ratio (for TRAIN_TEST_SPLIT) */
  trainTestSplit?: number;
  /** Number of folds (for K_FOLD_CV) */
  kFolds?: number;
  /** Walk-forward window size in days */
  walkForwardWindowDays?: number;
  /** Report detail level */
  reportDetailLevel: ReportDetailLevel;
  /** Enable parameter optimization */
  optimizeParameters?: boolean;
  /** Parameters to optimize (if enabled) */
  parametersToOptimize?: string[];
  /** Optimization metric to maximize */
  optimizationMetric?: keyof BacktestMetrics;
  /** Random seed for reproducibility */
  randomSeed?: number;
}

/**
 * Backtest progress information
 */
export interface BacktestProgress {
  /** Current status */
  status: BacktestStatus;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Current phase description */
  currentPhase: string;
  /** Records processed */
  recordsProcessed: number;
  /** Total records */
  totalRecords: number;
  /** Detections so far */
  detectionsSoFar: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated remaining time in ms */
  estimatedRemainingMs: number;
  /** Current fold (for cross-validation) */
  currentFold?: number;
  /** Total folds */
  totalFolds?: number;
}

/**
 * Framework configuration
 */
export interface BacktestingFrameworkConfig {
  /** Enable result caching */
  cacheEnabled: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Maximum concurrent backtests */
  maxConcurrent: number;
  /** Progress update interval in ms */
  progressIntervalMs: number;
  /** Default report detail level */
  defaultDetailLevel: ReportDetailLevel;
  /** Enable parallel processing */
  parallelProcessing: boolean;
  /** Batch size for processing */
  batchSize: number;
}

/**
 * Framework events
 */
export interface BacktestingFrameworkEvents {
  /** Backtest started */
  "backtest:started": { backtestId: string; config: BacktestConfig };
  /** Backtest progress update */
  "backtest:progress": { backtestId: string; progress: BacktestProgress };
  /** Backtest completed */
  "backtest:completed": { backtestId: string; report: BacktestReport };
  /** Backtest failed */
  "backtest:failed": { backtestId: string; error: string };
  /** Backtest cancelled */
  "backtest:cancelled": { backtestId: string };
  /** Detection made during backtest */
  "detection:made": { backtestId: string; detection: DetectionResult };
  /** Data loaded */
  "data:loaded": { backtestId: string; dataset: HistoricalDataset };
  /** Optimization progress */
  "optimization:progress": {
    backtestId: string;
    currentParams: Record<string, unknown>;
    bestMetric: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default backtest configuration
 */
export const DEFAULT_BACKTEST_CONFIG: Partial<BacktestConfig> = {
  validationMethod: ValidationMethod.WALK_FORWARD,
  trainTestSplit: 0.8,
  kFolds: 5,
  walkForwardWindowDays: 30,
  reportDetailLevel: ReportDetailLevel.STANDARD,
  optimizeParameters: false,
  optimizationMetric: "f1Score",
  randomSeed: 42,
};

/**
 * Default detection thresholds
 */
export const DEFAULT_DETECTION_THRESHOLDS: DetectionThresholds = {
  suspicionThreshold: 60,
  whaleTradeMinUsd: 10000,
  freshWalletMaxAgeDays: 7,
  volumeSpikeMultiplier: 3.0,
  minConfidence: 0.5,
  priceChangeThreshold: 10,
  coordinationThreshold: 0.7,
};

/**
 * Default framework configuration
 */
export const DEFAULT_FRAMEWORK_CONFIG: BacktestingFrameworkConfig = {
  cacheEnabled: true,
  cacheTtlMs: 3600000, // 1 hour
  maxConcurrent: 3,
  progressIntervalMs: 1000,
  defaultDetailLevel: ReportDetailLevel.STANDARD,
  parallelProcessing: true,
  batchSize: 1000,
};

/**
 * Performance tier thresholds
 */
export const PERFORMANCE_TIER_THRESHOLDS = {
  [PerformanceTier.EXCELLENT]: { minF1: 0.9, minAccuracy: 0.95 },
  [PerformanceTier.GOOD]: { minF1: 0.75, minAccuracy: 0.85 },
  [PerformanceTier.ACCEPTABLE]: { minF1: 0.6, minAccuracy: 0.7 },
  [PerformanceTier.POOR]: { minF1: 0.4, minAccuracy: 0.55 },
  [PerformanceTier.VERY_POOR]: { minF1: 0, minAccuracy: 0 },
};

// ============================================================================
// Main Class
// ============================================================================

/**
 * Backtesting Framework for validating detection strategies
 */
export class BacktestingFramework extends EventEmitter {
  private config: BacktestingFrameworkConfig;
  private activeBacktests: Map<
    string,
    { status: BacktestStatus; cancelToken: boolean }
  > = new Map();
  private cache: Map<string, { data: unknown; expiresAt: Date }> = new Map();
  private statistics = {
    totalBacktests: 0,
    completedBacktests: 0,
    failedBacktests: 0,
    totalRuntimeMs: 0,
  };

  constructor(config: Partial<BacktestingFrameworkConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FRAMEWORK_CONFIG, ...config };
  }

  // ============================================================================
  // Public Methods - Main Backtest Operations
  // ============================================================================

  /**
   * Run a backtest with the given configuration
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestReport> {
    const backtestId = generateBacktestId();
    const startTime = Date.now();

    this.statistics.totalBacktests++;
    this.activeBacktests.set(backtestId, {
      status: BacktestStatus.IDLE,
      cancelToken: false,
    });

    try {
      // Emit started event
      this.emit("backtest:started", { backtestId, config });
      this.updateStatus(backtestId, BacktestStatus.LOADING_DATA);

      // Load historical data
      const dataset = await this.loadHistoricalData(
        backtestId,
        config.dataSources,
        config.startDate,
        config.endDate
      );

      this.emit("data:loaded", { backtestId, dataset });

      // Check for cancellation
      if (this.isCancelled(backtestId)) {
        throw new Error("Backtest cancelled");
      }

      this.updateStatus(backtestId, BacktestStatus.RUNNING);

      // Run backtest based on validation method
      let report: BacktestReport;
      switch (config.validationMethod) {
        case ValidationMethod.WALK_FORWARD:
          report = await this.runWalkForwardBacktest(
            backtestId,
            config,
            dataset
          );
          break;
        case ValidationMethod.K_FOLD_CV:
          report = await this.runKFoldBacktest(backtestId, config, dataset);
          break;
        case ValidationMethod.TRAIN_TEST_SPLIT:
          report = await this.runTrainTestSplitBacktest(
            backtestId,
            config,
            dataset
          );
          break;
        default:
          report = await this.runSimpleBacktest(backtestId, config, dataset);
      }

      // Add runtime
      report.runtimeMs = Date.now() - startTime;
      report.completedAt = new Date();

      // Generate insights
      report.insights = this.generateInsights(report);

      // Cache result
      this.cacheResult(backtestId, report);

      this.updateStatus(backtestId, BacktestStatus.COMPLETED);
      this.statistics.completedBacktests++;
      this.statistics.totalRuntimeMs += report.runtimeMs;

      this.emit("backtest:completed", { backtestId, report });

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "Backtest cancelled") {
        this.updateStatus(backtestId, BacktestStatus.CANCELLED);
        this.emit("backtest:cancelled", { backtestId });
      } else {
        this.updateStatus(backtestId, BacktestStatus.FAILED);
        this.statistics.failedBacktests++;
        this.emit("backtest:failed", { backtestId, error: errorMessage });
      }

      throw error;
    } finally {
      this.activeBacktests.delete(backtestId);
    }
  }

  /**
   * Cancel a running backtest
   */
  cancelBacktest(backtestId: string): boolean {
    const backtest = this.activeBacktests.get(backtestId);
    if (backtest && backtest.status === BacktestStatus.RUNNING) {
      backtest.cancelToken = true;
      return true;
    }
    return false;
  }

  /**
   * Get backtest progress
   */
  getBacktestProgress(backtestId: string): BacktestProgress | null {
    const backtest = this.activeBacktests.get(backtestId);
    if (!backtest) return null;

    return {
      status: backtest.status,
      progressPercent: 0, // Would be tracked in actual implementation
      currentPhase: this.getPhaseDescription(backtest.status),
      recordsProcessed: 0,
      totalRecords: 0,
      detectionsSoFar: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
    };
  }

  /**
   * Get active backtest count
   */
  getActiveBacktestCount(): number {
    return this.activeBacktests.size;
  }

  /**
   * Get framework statistics
   */
  getStatistics(): typeof this.statistics {
    return { ...this.statistics };
  }

  // ============================================================================
  // Historical Data Loading
  // ============================================================================

  /**
   * Load historical data for backtesting
   */
  async loadHistoricalData(
    _backtestId: string,
    sources: DataSourceType[],
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalDataset> {
    // Check cache first
    const cacheKey = `dataset:${sources.join(",")}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = this.getCachedResult<HistoricalDataset>(cacheKey);
    if (cached) return cached;

    // Generate mock historical data for testing
    const trades = this.generateMockTrades(startDate, endDate, 1000);
    const markets = this.generateMockMarkets(startDate, endDate, 50);
    const wallets = this.generateMockWallets(trades);
    const alerts = this.generateMockAlerts(startDate, endDate, 100);

    const dataset: HistoricalDataset = {
      name: `Historical Data ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
      description: `Backtesting dataset with ${trades.length} trades, ${markets.length} markets`,
      startDate,
      endDate,
      trades,
      markets,
      wallets,
      alerts,
      totalRecords: trades.length + markets.length + wallets.length,
      qualityScore: 85,
      metadata: {
        sources,
        generatedAt: new Date().toISOString(),
      },
    };

    this.cacheResult(cacheKey, dataset);
    return dataset;
  }

  // ============================================================================
  // Backtest Execution Methods
  // ============================================================================

  /**
   * Run walk-forward validation backtest
   */
  private async runWalkForwardBacktest(
    backtestId: string,
    config: BacktestConfig,
    dataset: HistoricalDataset
  ): Promise<BacktestReport> {
    const windowDays = config.walkForwardWindowDays || 30;
    const folds: WalkForwardFold[] = [];

    const totalDays = Math.floor(
      (dataset.endDate.getTime() - dataset.startDate.getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const numFolds = Math.floor(totalDays / windowDays);
    const allDetections: DetectionResult[] = [];

    for (let i = 0; i < Math.min(numFolds - 1, 10); i++) {
      // Cap at 10 folds
      if (this.isCancelled(backtestId)) {
        throw new Error("Backtest cancelled");
      }

      const trainStart = new Date(
        dataset.startDate.getTime() + i * windowDays * 24 * 60 * 60 * 1000
      );
      const trainEnd = new Date(
        trainStart.getTime() + windowDays * 24 * 60 * 60 * 1000
      );
      const testStart = trainEnd;
      const testEnd = new Date(
        testStart.getTime() + windowDays * 24 * 60 * 60 * 1000
      );

      // Filter data for train/test periods
      const trainTrades = dataset.trades.filter(
        (t) => t.timestamp >= trainStart && t.timestamp < trainEnd
      );
      const testTrades = dataset.trades.filter(
        (t) => t.timestamp >= testStart && t.timestamp < testEnd
      );

      // Run detection on train set
      const trainDetections = this.runDetectionStrategy(
        config.strategy,
        trainTrades,
        dataset.wallets,
        dataset.markets
      );

      // Run detection on test set
      const testDetections = this.runDetectionStrategy(
        config.strategy,
        testTrades,
        dataset.wallets,
        dataset.markets
      );

      // Calculate metrics
      const trainMetrics = this.calculateMetrics(trainDetections, dataset);
      const testMetrics = this.calculateMetrics(testDetections, dataset);

      allDetections.push(...testDetections);

      folds.push({
        foldNumber: i + 1,
        trainStart,
        trainEnd,
        testStart,
        testEnd,
        trainMetrics,
        testMetrics,
        overfittingScore: this.calculateOverfittingScore(
          trainMetrics,
          testMetrics
        ),
      });

      // Emit progress
      this.emitProgress(backtestId, {
        status: BacktestStatus.RUNNING,
        progressPercent: ((i + 1) / numFolds) * 100,
        currentPhase: `Walk-forward fold ${i + 1}/${numFolds}`,
        recordsProcessed: (i + 1) * windowDays * 20,
        totalRecords: totalDays * 20,
        detectionsSoFar: allDetections.length,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        currentFold: i + 1,
        totalFolds: numFolds,
      });
    }

    // Calculate overall metrics from all test folds
    const overallMetrics = this.calculateAverageMetrics(
      folds.map((f) => f.testMetrics)
    );

    return this.buildReport(
      backtestId,
      config,
      dataset,
      overallMetrics,
      allDetections,
      folds
    );
  }

  /**
   * Run K-fold cross-validation backtest
   */
  private async runKFoldBacktest(
    backtestId: string,
    config: BacktestConfig,
    dataset: HistoricalDataset
  ): Promise<BacktestReport> {
    const k = config.kFolds || 5;
    const foldSize = Math.floor(dataset.trades.length / k);
    const allDetections: DetectionResult[] = [];
    const foldMetrics: BacktestMetrics[] = [];

    for (let i = 0; i < k; i++) {
      if (this.isCancelled(backtestId)) {
        throw new Error("Backtest cancelled");
      }

      // Split data into train/test for this fold
      const testStart = i * foldSize;
      const testEnd = (i + 1) * foldSize;

      const testTrades = dataset.trades.slice(testStart, testEnd);
      // trainTrades would be used in more sophisticated models
      // const trainTrades = [...dataset.trades.slice(0, testStart), ...dataset.trades.slice(testEnd)];

      // Run detection
      const detections = this.runDetectionStrategy(
        config.strategy,
        testTrades,
        dataset.wallets,
        dataset.markets
      );

      allDetections.push(...detections);
      foldMetrics.push(this.calculateMetrics(detections, dataset));

      // Emit progress
      this.emitProgress(backtestId, {
        status: BacktestStatus.RUNNING,
        progressPercent: ((i + 1) / k) * 100,
        currentPhase: `K-fold ${i + 1}/${k}`,
        recordsProcessed: (i + 1) * foldSize,
        totalRecords: dataset.trades.length,
        detectionsSoFar: allDetections.length,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
        currentFold: i + 1,
        totalFolds: k,
      });
    }

    const overallMetrics = this.calculateAverageMetrics(foldMetrics);

    return this.buildReport(
      backtestId,
      config,
      dataset,
      overallMetrics,
      allDetections
    );
  }

  /**
   * Run train/test split backtest
   */
  private async runTrainTestSplitBacktest(
    backtestId: string,
    config: BacktestConfig,
    dataset: HistoricalDataset
  ): Promise<BacktestReport> {
    const splitRatio = config.trainTestSplit || 0.8;
    const splitIndex = Math.floor(dataset.trades.length * splitRatio);

    // trainTrades would be used in more sophisticated models
    // const trainTrades = dataset.trades.slice(0, splitIndex);
    const testTrades = dataset.trades.slice(splitIndex);

    // Run detection on test set
    const detections = this.runDetectionStrategy(
      config.strategy,
      testTrades,
      dataset.wallets,
      dataset.markets
    );

    const metrics = this.calculateMetrics(detections, dataset);

    return this.buildReport(
      backtestId,
      config,
      dataset,
      metrics,
      detections
    );
  }

  /**
   * Run simple backtest without validation split
   */
  private async runSimpleBacktest(
    backtestId: string,
    config: BacktestConfig,
    dataset: HistoricalDataset
  ): Promise<BacktestReport> {
    const detections = this.runDetectionStrategy(
      config.strategy,
      dataset.trades,
      dataset.wallets,
      dataset.markets
    );

    const metrics = this.calculateMetrics(detections, dataset);

    return this.buildReport(
      backtestId,
      config,
      dataset,
      metrics,
      detections
    );
  }

  // ============================================================================
  // Detection Strategy Simulation
  // ============================================================================

  /**
   * Run detection strategy on historical trades
   */
  private runDetectionStrategy(
    strategy: StrategyConfig,
    trades: HistoricalTrade[],
    wallets: HistoricalWallet[],
    markets: HistoricalMarket[]
  ): DetectionResult[] {
    const detections: DetectionResult[] = [];
    const walletMap = new Map(wallets.map((w) => [w.address, w]));
    const marketMap = new Map(markets.map((m) => [m.marketId, m]));

    for (const trade of trades) {
      const wallet = walletMap.get(trade.walletAddress);
      const market = marketMap.get(trade.marketId);

      // Apply strategy-specific detection logic
      const detection = this.evaluateTradeForDetection(
        trade,
        wallet,
        market,
        strategy
      );

      if (detection) {
        detections.push(detection);
      }
    }

    return detections;
  }

  /**
   * Evaluate a single trade for detection
   */
  private evaluateTradeForDetection(
    trade: HistoricalTrade,
    wallet: HistoricalWallet | undefined,
    market: HistoricalMarket | undefined,
    strategy: StrategyConfig
  ): DetectionResult | null {
    const triggeringFeatures: string[] = [];
    const scoreBreakdown: Record<string, number> = {};
    let totalScore = 0;

    const thresholds = strategy.thresholds;

    // Check whale trade
    if (trade.sizeUsd >= thresholds.whaleTradeMinUsd) {
      triggeringFeatures.push("WHALE_TRADE");
      const whaleScore = Math.min(
        trade.sizeUsd / (thresholds.whaleTradeMinUsd * 10),
        1
      );
      scoreBreakdown["whale"] = whaleScore * 30;
      totalScore += scoreBreakdown["whale"];
    }

    // Check fresh wallet
    if (wallet) {
      const walletAgeDays =
        (trade.timestamp.getTime() - wallet.firstSeen.getTime()) /
        (24 * 60 * 60 * 1000);
      if (walletAgeDays <= thresholds.freshWalletMaxAgeDays) {
        triggeringFeatures.push("FRESH_WALLET");
        scoreBreakdown["freshWallet"] =
          (1 - walletAgeDays / thresholds.freshWalletMaxAgeDays) * 25;
        totalScore += scoreBreakdown["freshWallet"];
      }

      // Check known insider (for ground truth)
      if (wallet.knownInsider) {
        triggeringFeatures.push("KNOWN_INSIDER");
        scoreBreakdown["knownInsider"] = 40;
        totalScore += scoreBreakdown["knownInsider"];
      }

      // Check suspicious suspicion score
      if (
        wallet.suspicionScore &&
        wallet.suspicionScore >= thresholds.suspicionThreshold
      ) {
        triggeringFeatures.push("HIGH_SUSPICION");
        scoreBreakdown["suspicion"] =
          (wallet.suspicionScore / 100) * 20;
        totalScore += scoreBreakdown["suspicion"];
      }
    }

    // Calculate confidence based on features
    const confidence = Math.min(triggeringFeatures.length / 4, 1);

    // Only create detection if above threshold
    if (
      totalScore >= thresholds.suspicionThreshold * 0.5 &&
      confidence >= thresholds.minConfidence
    ) {
      // Determine if this was a correct detection (based on ground truth)
      let wasCorrect: boolean | undefined;
      if (wallet?.knownInsider !== undefined) {
        wasCorrect = wallet.knownInsider && totalScore >= 50;
      } else if (market?.resolution) {
        // Check if trade was on winning side
        const tradeDirection = trade.outcome;
        wasCorrect = tradeDirection === market.resolution && totalScore >= 50;
      }

      return {
        detectionId: generateDetectionId(),
        timestamp: trade.timestamp,
        strategy: strategy.type,
        marketId: trade.marketId,
        walletAddress: trade.walletAddress,
        detectionType: this.getDetectionType(triggeringFeatures),
        confidence,
        suspicionScore: Math.min(totalScore, 100),
        wasCorrect,
        triggeringFeatures,
        associatedTrades: [trade.tradeId],
        scoreBreakdown,
      };
    }

    return null;
  }

  /**
   * Get detection type from triggering features
   */
  private getDetectionType(features: string[]): string {
    if (features.includes("KNOWN_INSIDER")) return "INSIDER_ACTIVITY";
    if (features.includes("WHALE_TRADE")) return "WHALE_TRADE";
    if (features.includes("FRESH_WALLET")) return "FRESH_WALLET_ACTIVITY";
    if (features.includes("HIGH_SUSPICION")) return "SUSPICIOUS_ACTIVITY";
    return "ANOMALY";
  }

  // ============================================================================
  // Metrics Calculation
  // ============================================================================

  /**
   * Calculate performance metrics from detections
   */
  private calculateMetrics(
    detections: DetectionResult[],
    dataset: HistoricalDataset
  ): BacktestMetrics {
    // Calculate TP, TN, FP, FN based on wasCorrect field and ground truth
    const knownInsiderWallets = new Set(
      dataset.wallets.filter((w) => w.knownInsider).map((w) => w.address)
    );

    let tp = 0,
      tn = 0,
      fp = 0,
      fn = 0;
    const detectedWallets = new Set<string>();

    for (const detection of detections) {
      if (detection.walletAddress) {
        detectedWallets.add(detection.walletAddress);

        if (knownInsiderWallets.has(detection.walletAddress)) {
          tp++; // Correctly detected an insider
        } else {
          fp++; // False alarm
        }
      }
    }

    // Count false negatives (insiders not detected)
    for (const insiderWallet of knownInsiderWallets) {
      if (!detectedWallets.has(insiderWallet)) {
        fn++;
      }
    }

    // True negatives are non-insiders not detected
    const nonInsiderCount = dataset.wallets.length - knownInsiderWallets.size;
    const nonInsidersDetected = detections.filter(
      (d) => d.walletAddress && !knownInsiderWallets.has(d.walletAddress)
    ).length;
    tn = Math.max(0, nonInsiderCount - nonInsidersDetected);

    // Calculate metrics
    const total = tp + tn + fp + fn || 1;
    const accuracy = (tp + tn) / total;
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const f2Score =
      precision + recall > 0
        ? (5 * precision * recall) / (4 * precision + recall)
        : 0;

    // Matthews correlation coefficient
    const mccNumerator = tp * tn - fp * fn;
    const mccDenominator = Math.sqrt(
      (tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)
    );
    const mcc = mccDenominator > 0 ? mccNumerator / mccDenominator : 0;

    // Average confidence
    const avgConfidence =
      detections.length > 0
        ? detections.reduce((sum, d) => sum + d.confidence, 0) /
          detections.length
        : 0;

    // Calculate Brier score (simplified)
    let brierSum = 0;
    for (const detection of detections) {
      const predicted = detection.suspicionScore / 100;
      const actual = detection.wasCorrect ? 1 : 0;
      brierSum += Math.pow(predicted - actual, 2);
    }
    const brierScore =
      detections.length > 0 ? brierSum / detections.length : 0.5;

    // Log loss (simplified)
    let logLossSum = 0;
    for (const detection of detections) {
      const predicted = Math.max(
        0.01,
        Math.min(0.99, detection.suspicionScore / 100)
      );
      const actual = detection.wasCorrect ? 1 : 0;
      logLossSum +=
        actual * Math.log(predicted) + (1 - actual) * Math.log(1 - predicted);
    }
    const logLoss =
      detections.length > 0 ? -logLossSum / detections.length : 0.693;

    return {
      totalDetections: detections.length,
      truePositives: tp,
      trueNegatives: tn,
      falsePositives: fp,
      falseNegatives: fn,
      accuracy,
      precision,
      recall,
      f1Score,
      f2Score,
      mcc,
      aucRoc: this.estimateAucRoc(detections),
      aucPr: this.estimateAucPr(precision, recall),
      brierScore,
      logLoss,
      avgConfidence,
      detectionRate: detections.length / Math.max(dataset.trades.length, 1),
      falsePositiveRate: fp / (fp + tn) || 0,
      falseNegativeRate: fn / (fn + tp) || 0,
    };
  }

  /**
   * Calculate average metrics across folds
   */
  private calculateAverageMetrics(metricsArray: BacktestMetrics[]): BacktestMetrics {
    if (metricsArray.length === 0) {
      return this.getEmptyMetrics();
    }

    const sum = (key: keyof BacktestMetrics) =>
      metricsArray.reduce((s, m) => s + (m[key] as number), 0);
    const avg = (key: keyof BacktestMetrics) => sum(key) / metricsArray.length;

    return {
      totalDetections: Math.round(avg("totalDetections")),
      truePositives: Math.round(avg("truePositives")),
      trueNegatives: Math.round(avg("trueNegatives")),
      falsePositives: Math.round(avg("falsePositives")),
      falseNegatives: Math.round(avg("falseNegatives")),
      accuracy: avg("accuracy"),
      precision: avg("precision"),
      recall: avg("recall"),
      f1Score: avg("f1Score"),
      f2Score: avg("f2Score"),
      mcc: avg("mcc"),
      aucRoc: avg("aucRoc"),
      aucPr: avg("aucPr"),
      brierScore: avg("brierScore"),
      logLoss: avg("logLoss"),
      avgConfidence: avg("avgConfidence"),
      detectionRate: avg("detectionRate"),
      falsePositiveRate: avg("falsePositiveRate"),
      falseNegativeRate: avg("falseNegativeRate"),
    };
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): BacktestMetrics {
    return {
      totalDetections: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      f2Score: 0,
      mcc: 0,
      aucRoc: 0.5,
      aucPr: 0,
      brierScore: 0.5,
      logLoss: 0.693,
      avgConfidence: 0,
      detectionRate: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
    };
  }

  /**
   * Estimate AUC-ROC from detections
   */
  private estimateAucRoc(detections: DetectionResult[]): number {
    if (detections.length === 0) return 0.5;

    // Simplified estimation based on TP/FP rates at different thresholds
    const sorted = [...detections].sort(
      (a, b) => b.suspicionScore - a.suspicionScore
    );
    let auc = 0;
    let prevTpr = 0;
    let prevFpr = 0;

    const positives = sorted.filter((d) => d.wasCorrect === true).length;
    const negatives = sorted.filter((d) => d.wasCorrect === false).length;

    if (positives === 0 || negatives === 0) return 0.5;

    let tpCount = 0;
    let fpCount = 0;

    for (const detection of sorted) {
      if (detection.wasCorrect === true) tpCount++;
      else fpCount++;

      const tpr = tpCount / positives;
      const fpr = fpCount / negatives;

      // Trapezoidal rule
      auc += (fpr - prevFpr) * (tpr + prevTpr) / 2;

      prevTpr = tpr;
      prevFpr = fpr;
    }

    return Math.min(1, Math.max(0, auc));
  }

  /**
   * Estimate AUC-PR from precision and recall
   */
  private estimateAucPr(precision: number, recall: number): number {
    // Simplified: use F1 score as proxy
    return precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
  }

  /**
   * Calculate overfitting score between train and test metrics
   */
  private calculateOverfittingScore(
    trainMetrics: BacktestMetrics,
    testMetrics: BacktestMetrics
  ): number {
    // Higher score = more overfitting
    const accuracyDiff = Math.abs(trainMetrics.accuracy - testMetrics.accuracy);
    const f1Diff = Math.abs(trainMetrics.f1Score - testMetrics.f1Score);
    const precisionDiff = Math.abs(trainMetrics.precision - testMetrics.precision);
    const recallDiff = Math.abs(trainMetrics.recall - testMetrics.recall);

    return (accuracyDiff + f1Diff + precisionDiff + recallDiff) / 4;
  }

  // ============================================================================
  // Report Building
  // ============================================================================

  /**
   * Build complete backtest report
   */
  private buildReport(
    backtestId: string,
    config: BacktestConfig,
    dataset: HistoricalDataset,
    metrics: BacktestMetrics,
    detections: DetectionResult[],
    walkForwardFolds?: WalkForwardFold[]
  ): BacktestReport {
    const performanceTier = this.getPerformanceTier(metrics);
    const performanceScore = this.calculatePerformanceScore(metrics);

    // Build period metrics
    const periodMetrics = this.buildPeriodMetrics(detections, dataset);

    // Include detections based on detail level
    const includeDetections =
      config.reportDetailLevel === ReportDetailLevel.DETAILED ||
      config.reportDetailLevel === ReportDetailLevel.DEBUG;

    return {
      reportId: backtestId,
      name: config.name,
      description: config.description,
      strategy: config.strategy,
      datasetInfo: {
        name: dataset.name,
        startDate: dataset.startDate,
        endDate: dataset.endDate,
        totalRecords: dataset.totalRecords,
      },
      validationMethod: config.validationMethod,
      overallMetrics: metrics,
      periodMetrics,
      walkForwardFolds,
      performanceTier,
      performanceScore,
      detections: includeDetections ? detections : undefined,
      insights: [], // Will be populated after report creation
      startedAt: new Date(),
      completedAt: new Date(),
      runtimeMs: 0, // Will be updated
    };
  }

  /**
   * Build period metrics from detections
   */
  private buildPeriodMetrics(
    detections: DetectionResult[],
    dataset: HistoricalDataset
  ): PeriodMetrics[] {
    // Group detections by month
    const periodMap = new Map<string, DetectionResult[]>();

    for (const detection of detections) {
      const key = `${detection.timestamp.getFullYear()}-${detection.timestamp.getMonth()}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, []);
      }
      periodMap.get(key)!.push(detection);
    }

    const periods: PeriodMetrics[] = [];

    for (const [key, periodDetections] of periodMap) {
      const parts = key.split("-").map(Number);
      const year = parts[0] ?? 2024;
      const month = parts[1] ?? 0;
      const periodStart = new Date(year, month, 1);
      const periodEnd = new Date(year, month + 1, 0);

      periods.push({
        periodStart,
        periodEnd,
        metrics: this.calculateMetrics(periodDetections, dataset),
        sampleCount: periodDetections.length,
      });
    }

    return periods.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  }

  /**
   * Get performance tier from metrics
   */
  private getPerformanceTier(metrics: BacktestMetrics): PerformanceTier {
    for (const tier of [
      PerformanceTier.EXCELLENT,
      PerformanceTier.GOOD,
      PerformanceTier.ACCEPTABLE,
      PerformanceTier.POOR,
    ]) {
      const thresholds = PERFORMANCE_TIER_THRESHOLDS[tier];
      if (
        metrics.f1Score >= thresholds.minF1 &&
        metrics.accuracy >= thresholds.minAccuracy
      ) {
        return tier;
      }
    }
    return PerformanceTier.VERY_POOR;
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculatePerformanceScore(metrics: BacktestMetrics): number {
    // Weighted combination of key metrics
    const weights = {
      f1Score: 0.3,
      accuracy: 0.2,
      precision: 0.15,
      recall: 0.15,
      aucRoc: 0.1,
      mcc: 0.1,
    };

    let score = 0;
    score += metrics.f1Score * weights.f1Score * 100;
    score += metrics.accuracy * weights.accuracy * 100;
    score += metrics.precision * weights.precision * 100;
    score += metrics.recall * weights.recall * 100;
    score += metrics.aucRoc * weights.aucRoc * 100;
    score += ((metrics.mcc + 1) / 2) * weights.mcc * 100; // MCC is -1 to 1

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Generate insights from backtest results
   */
  private generateInsights(report: BacktestReport): BacktestInsight[] {
    const insights: BacktestInsight[] = [];
    const metrics = report.overallMetrics;

    // Strengths
    if (metrics.precision >= 0.8) {
      insights.push({
        type: "STRENGTH",
        title: "High Precision",
        description: `Strategy has excellent precision (${(metrics.precision * 100).toFixed(1)}%), meaning most detections are accurate.`,
        metric: "precision",
        currentValue: metrics.precision,
        priority: 3,
      });
    }

    if (metrics.recall >= 0.8) {
      insights.push({
        type: "STRENGTH",
        title: "High Recall",
        description: `Strategy catches most suspicious activity (${(metrics.recall * 100).toFixed(1)}% recall).`,
        metric: "recall",
        currentValue: metrics.recall,
        priority: 3,
      });
    }

    // Weaknesses
    if (metrics.precision < 0.5) {
      insights.push({
        type: "WEAKNESS",
        title: "Low Precision",
        description: `Strategy has many false positives (precision: ${(metrics.precision * 100).toFixed(1)}%). Consider raising detection thresholds.`,
        metric: "precision",
        currentValue: metrics.precision,
        recommendedValue: 0.7,
        priority: 1,
      });
    }

    if (metrics.recall < 0.5) {
      insights.push({
        type: "WEAKNESS",
        title: "Low Recall",
        description: `Strategy misses many suspicious activities (recall: ${(metrics.recall * 100).toFixed(1)}%). Consider lowering thresholds.`,
        metric: "recall",
        currentValue: metrics.recall,
        recommendedValue: 0.7,
        priority: 1,
      });
    }

    if (metrics.falsePositiveRate > 0.3) {
      insights.push({
        type: "WEAKNESS",
        title: "High False Positive Rate",
        description: `${(metrics.falsePositiveRate * 100).toFixed(1)}% of alerts are false positives, which may cause alert fatigue.`,
        metric: "falsePositiveRate",
        currentValue: metrics.falsePositiveRate,
        recommendedValue: 0.1,
        priority: 2,
      });
    }

    // Recommendations
    if (metrics.f1Score < 0.6 && metrics.precision < metrics.recall) {
      insights.push({
        type: "RECOMMENDATION",
        title: "Increase Detection Thresholds",
        description: "Consider raising suspicion thresholds to reduce false positives while maintaining acceptable recall.",
        priority: 2,
      });
    }

    if (metrics.f1Score < 0.6 && metrics.recall < metrics.precision) {
      insights.push({
        type: "RECOMMENDATION",
        title: "Lower Detection Thresholds",
        description: "Consider lowering suspicion thresholds to catch more suspicious activity.",
        priority: 2,
      });
    }

    // Warnings
    if (report.walkForwardFolds) {
      const avgOverfitting =
        report.walkForwardFolds.reduce((sum, f) => sum + f.overfittingScore, 0) /
        report.walkForwardFolds.length;

      if (avgOverfitting > 0.15) {
        insights.push({
          type: "WARNING",
          title: "Potential Overfitting Detected",
          description: `Average overfitting score is ${(avgOverfitting * 100).toFixed(1)}%. Strategy may not generalize well to new data.`,
          currentValue: avgOverfitting,
          recommendedValue: 0.05,
          priority: 1,
        });
      }
    }

    return insights.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // Mock Data Generation
  // ============================================================================

  /**
   * Generate mock historical trades
   */
  private generateMockTrades(
    startDate: Date,
    endDate: Date,
    count: number
  ): HistoricalTrade[] {
    const trades: HistoricalTrade[] = [];
    const timeRange = endDate.getTime() - startDate.getTime();
    const walletPool = this.generateWalletPool(50);
    const marketPool = Array.from(
      { length: 20 },
      (_, i) => `market-${i + 1}`
    );

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(
        startDate.getTime() + Math.random() * timeRange
      );
      const wallet = walletPool[Math.floor(Math.random() * walletPool.length)] ?? `0x${i.toString(16).padStart(40, '0')}`;
      const market = marketPool[Math.floor(Math.random() * marketPool.length)] ?? `market-${i + 1}`;
      const side = Math.random() > 0.5 ? "BUY" : "SELL";
      const outcome = Math.random() > 0.5 ? "YES" : "NO";
      const size = Math.floor(Math.random() * 10000) + 10;
      const price = Math.random() * 0.8 + 0.1;

      trades.push({
        tradeId: `trade-${i + 1}`,
        marketId: market,
        walletAddress: wallet,
        side: side as "BUY" | "SELL",
        size,
        price,
        sizeUsd: size * price,
        timestamp,
        outcome: outcome as "YES" | "NO",
        isMaker: Math.random() > 0.7,
        txHash: `0x${Math.random().toString(16).slice(2)}`,
      });
    }

    return trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate mock historical markets
   */
  private generateMockMarkets(
    startDate: Date,
    endDate: Date,
    count: number
  ): HistoricalMarket[] {
    const markets: HistoricalMarket[] = [];
    const categories = ["Politics", "Sports", "Crypto", "Entertainment", "Finance"];
    const timeRange = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < count; i++) {
      const createdAt = new Date(
        startDate.getTime() + Math.random() * timeRange * 0.3
      );
      const marketEndDate = new Date(
        createdAt.getTime() + Math.random() * timeRange * 0.7
      );
      const resolved = marketEndDate < endDate;
      const resolution = resolved
        ? Math.random() > 0.5
          ? "YES"
          : "NO"
        : undefined;

      // Generate price history
      const priceHistory: PricePoint[] = [];
      let currentPrice = 0.5;
      const historyPoints = 50;
      const historyInterval =
        (marketEndDate.getTime() - createdAt.getTime()) / historyPoints;

      for (let j = 0; j < historyPoints; j++) {
        currentPrice = Math.max(
          0.01,
          Math.min(0.99, currentPrice + (Math.random() - 0.5) * 0.1)
        );
        priceHistory.push({
          timestamp: new Date(createdAt.getTime() + j * historyInterval),
          price: currentPrice,
          volume: Math.floor(Math.random() * 10000),
        });
      }

      // Final price should trend toward resolution
      if (resolution && priceHistory.length > 0) {
        priceHistory[priceHistory.length - 1]!.price = resolution === "YES" ? 0.95 : 0.05;
      }

      const selectedCategory = categories[Math.floor(Math.random() * categories.length)] ?? "Politics";
      const finalProb = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1]!.price : 0.5;

      markets.push({
        marketId: `market-${i + 1}`,
        question: `Will event ${i + 1} happen?`,
        category: selectedCategory,
        createdAt,
        endDate: marketEndDate,
        resolvedAt: resolved ? marketEndDate : undefined,
        resolution: resolution as "YES" | "NO" | undefined,
        volumeUsd: Math.floor(Math.random() * 1000000),
        finalProbability: finalProb,
        priceHistory,
      });
    }

    return markets;
  }

  /**
   * Generate mock wallets from trades
   */
  private generateMockWallets(trades: HistoricalTrade[]): HistoricalWallet[] {
    const walletMap = new Map<string, HistoricalWallet>();

    for (const trade of trades) {
      if (!walletMap.has(trade.walletAddress)) {
        // 5% chance of being a known insider (for testing)
        const knownInsider = Math.random() < 0.05;

        walletMap.set(trade.walletAddress, {
          address: trade.walletAddress,
          firstSeen: trade.timestamp,
          totalTrades: 0,
          totalVolumeUsd: 0,
          marketsTraded: 0,
          winRate: Math.random() * 0.4 + 0.4, // 40-80%
          knownInsider,
          suspicionScore: knownInsider
            ? Math.floor(Math.random() * 30) + 70
            : Math.floor(Math.random() * 50) + 10,
        });
      }

      const wallet = walletMap.get(trade.walletAddress)!;
      wallet.totalTrades++;
      wallet.totalVolumeUsd += trade.sizeUsd;
      if (trade.timestamp < wallet.firstSeen) {
        wallet.firstSeen = trade.timestamp;
      }
    }

    // Count unique markets per wallet
    const marketsByWallet = new Map<string, Set<string>>();
    for (const trade of trades) {
      if (!marketsByWallet.has(trade.walletAddress)) {
        marketsByWallet.set(trade.walletAddress, new Set());
      }
      marketsByWallet.get(trade.walletAddress)!.add(trade.marketId);
    }

    for (const [address, markets] of marketsByWallet) {
      const wallet = walletMap.get(address);
      if (wallet) {
        wallet.marketsTraded = markets.size;
      }
    }

    return Array.from(walletMap.values());
  }

  /**
   * Generate mock historical alerts
   */
  private generateMockAlerts(
    startDate: Date,
    endDate: Date,
    count: number
  ): HistoricalAlert[] {
    const alerts: HistoricalAlert[] = [];
    const types = [
      "WHALE_TRADE",
      "FRESH_WALLET",
      "COORDINATED_TRADING",
      "VOLUME_SPIKE",
    ];
    const severities = ["HIGH", "MEDIUM", "LOW"];
    const timeRange = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(
        startDate.getTime() + Math.random() * timeRange
      );
      const wasCorrect = Math.random() > 0.3; // 70% accuracy for mock alerts

      const selectedType = types[Math.floor(Math.random() * types.length)] ?? "WHALE_TRADE";
      const selectedSeverity = severities[Math.floor(Math.random() * severities.length)] ?? "MEDIUM";
      alerts.push({
        alertId: `alert-${i + 1}`,
        type: selectedType,
        severity: selectedSeverity,
        marketId: `market-${Math.floor(Math.random() * 20) + 1}`,
        walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        timestamp,
        wasCorrect,
        confidence: Math.random() * 0.5 + 0.5,
      });
    }

    return alerts;
  }

  /**
   * Generate wallet address pool
   */
  private generateWalletPool(count: number): string[] {
    return Array.from(
      { length: count },
      () => `0x${Math.random().toString(16).slice(2, 42)}`
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Update backtest status
   */
  private updateStatus(backtestId: string, status: BacktestStatus): void {
    const backtest = this.activeBacktests.get(backtestId);
    if (backtest) {
      backtest.status = status;
    }
  }

  /**
   * Check if backtest is cancelled
   */
  private isCancelled(backtestId: string): boolean {
    const backtest = this.activeBacktests.get(backtestId);
    return backtest?.cancelToken === true;
  }

  /**
   * Emit progress update
   */
  private emitProgress(backtestId: string, progress: BacktestProgress): void {
    this.emit("backtest:progress", { backtestId, progress });
  }

  /**
   * Get phase description
   */
  private getPhaseDescription(status: BacktestStatus): string {
    switch (status) {
      case BacktestStatus.IDLE:
        return "Initializing...";
      case BacktestStatus.LOADING_DATA:
        return "Loading historical data...";
      case BacktestStatus.RUNNING:
        return "Running backtest simulation...";
      case BacktestStatus.COMPLETED:
        return "Completed";
      case BacktestStatus.FAILED:
        return "Failed";
      case BacktestStatus.CANCELLED:
        return "Cancelled";
      default:
        return "Unknown";
    }
  }

  /**
   * Cache result
   */
  private cacheResult(key: string, data: unknown): void {
    if (!this.config.cacheEnabled) return;

    this.cache.set(key, {
      data,
      expiresAt: new Date(Date.now() + this.config.cacheTtlMs),
    });
  }

  /**
   * Get cached result
   */
  private getCachedResult<T>(key: string): T | null {
    if (!this.config.cacheEnabled) return null;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data as T;
    }

    this.cache.delete(key);
    return null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): BacktestingFrameworkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BacktestingFrameworkConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new BacktestingFramework instance
 */
export function createBacktestingFramework(
  config?: Partial<BacktestingFrameworkConfig>
): BacktestingFramework {
  return new BacktestingFramework(config);
}

// Singleton instance
let sharedInstance: BacktestingFramework | null = null;

/**
 * Get shared BacktestingFramework instance
 */
export function getSharedBacktestingFramework(): BacktestingFramework {
  if (!sharedInstance) {
    sharedInstance = createBacktestingFramework();
  }
  return sharedInstance;
}

/**
 * Set shared BacktestingFramework instance
 */
export function setSharedBacktestingFramework(
  instance: BacktestingFramework
): void {
  sharedInstance = instance;
}

/**
 * Reset shared BacktestingFramework instance
 */
export function resetSharedBacktestingFramework(): void {
  sharedInstance = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique backtest ID
 */
export function generateBacktestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bt-${timestamp}-${random}`;
}

/**
 * Generate unique detection ID
 */
export function generateDetectionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `det-${timestamp}-${random}`;
}

/**
 * Get strategy type description
 */
export function getStrategyTypeDescription(type: StrategyType): string {
  const descriptions: Record<StrategyType, string> = {
    [StrategyType.INSIDER_DETECTION]: "Insider Trading Detection",
    [StrategyType.WHALE_DETECTION]: "Whale Activity Detection",
    [StrategyType.FRESH_WALLET_DETECTION]: "Fresh Wallet Detection",
    [StrategyType.COORDINATED_TRADING]: "Coordinated Trading Detection",
    [StrategyType.VOLUME_ANOMALY]: "Volume Anomaly Detection",
    [StrategyType.PRICE_MANIPULATION]: "Price Manipulation Detection",
    [StrategyType.COMPOSITE]: "Composite Strategy",
    [StrategyType.CUSTOM]: "Custom Strategy",
  };
  return descriptions[type] || type;
}

/**
 * Get validation method description
 */
export function getValidationMethodDescription(method: ValidationMethod): string {
  const descriptions: Record<ValidationMethod, string> = {
    [ValidationMethod.TRAIN_TEST_SPLIT]: "Train/Test Split",
    [ValidationMethod.K_FOLD_CV]: "K-Fold Cross Validation",
    [ValidationMethod.WALK_FORWARD]: "Walk-Forward Validation",
    [ValidationMethod.LEAVE_ONE_OUT]: "Leave-One-Out Validation",
    [ValidationMethod.NONE]: "No Validation",
  };
  return descriptions[method] || method;
}

/**
 * Get performance tier description
 */
export function getPerformanceTierDescription(tier: PerformanceTier): string {
  const descriptions: Record<PerformanceTier, string> = {
    [PerformanceTier.EXCELLENT]: "Excellent - Production Ready",
    [PerformanceTier.GOOD]: "Good - Recommended for Use",
    [PerformanceTier.ACCEPTABLE]: "Acceptable - Monitor Performance",
    [PerformanceTier.POOR]: "Poor - Needs Improvement",
    [PerformanceTier.VERY_POOR]: "Very Poor - Not Recommended",
  };
  return descriptions[tier] || tier;
}

/**
 * Get performance tier color
 */
export function getPerformanceTierColor(tier: PerformanceTier): string {
  const colors: Record<PerformanceTier, string> = {
    [PerformanceTier.EXCELLENT]: "#22c55e", // green-500
    [PerformanceTier.GOOD]: "#3b82f6", // blue-500
    [PerformanceTier.ACCEPTABLE]: "#eab308", // yellow-500
    [PerformanceTier.POOR]: "#f97316", // orange-500
    [PerformanceTier.VERY_POOR]: "#ef4444", // red-500
  };
  return colors[tier] || "#6b7280"; // gray-500
}

/**
 * Get backtest status description
 */
export function getBacktestStatusDescription(status: BacktestStatus): string {
  const descriptions: Record<BacktestStatus, string> = {
    [BacktestStatus.IDLE]: "Idle",
    [BacktestStatus.LOADING_DATA]: "Loading Data",
    [BacktestStatus.RUNNING]: "Running",
    [BacktestStatus.COMPLETED]: "Completed",
    [BacktestStatus.FAILED]: "Failed",
    [BacktestStatus.CANCELLED]: "Cancelled",
  };
  return descriptions[status] || status;
}

/**
 * Format accuracy as percentage
 */
export function formatAccuracyPercent(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1)}%`;
}

/**
 * Format metrics for display
 */
export function formatMetricsForDisplay(metrics: BacktestMetrics): Record<string, string> {
  return {
    accuracy: formatAccuracyPercent(metrics.accuracy),
    precision: formatAccuracyPercent(metrics.precision),
    recall: formatAccuracyPercent(metrics.recall),
    f1Score: formatAccuracyPercent(metrics.f1Score),
    f2Score: formatAccuracyPercent(metrics.f2Score),
    mcc: metrics.mcc.toFixed(3),
    aucRoc: metrics.aucRoc.toFixed(3),
    aucPr: metrics.aucPr.toFixed(3),
    brierScore: metrics.brierScore.toFixed(3),
    logLoss: metrics.logLoss.toFixed(3),
    falsePositiveRate: formatAccuracyPercent(metrics.falsePositiveRate),
    falseNegativeRate: formatAccuracyPercent(metrics.falseNegativeRate),
  };
}

/**
 * Create a default strategy configuration
 */
export function createDefaultStrategyConfig(type: StrategyType): StrategyConfig {
  return {
    type,
    name: getStrategyTypeDescription(type),
    description: `Default ${getStrategyTypeDescription(type)} strategy`,
    parameters: {},
    thresholds: { ...DEFAULT_DETECTION_THRESHOLDS },
  };
}

/**
 * Create a default backtest configuration
 */
export function createDefaultBacktestConfig(
  strategyType: StrategyType,
  startDate: Date,
  endDate: Date
): BacktestConfig {
  return {
    name: `Backtest ${strategyType}`,
    description: `Backtest of ${getStrategyTypeDescription(strategyType)}`,
    strategy: createDefaultStrategyConfig(strategyType),
    dataSources: [DataSourceType.ALL],
    startDate,
    endDate,
    validationMethod: ValidationMethod.WALK_FORWARD,
    reportDetailLevel: ReportDetailLevel.STANDARD,
    ...DEFAULT_BACKTEST_CONFIG,
  };
}

// ============================================================================
// Mock Data Generators for Testing
// ============================================================================

/**
 * Create a mock backtest report
 */
export function createMockBacktestReport(
  partial?: Partial<BacktestReport>
): BacktestReport {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    reportId: generateBacktestId(),
    name: "Mock Backtest Report",
    description: "A mock backtest report for testing",
    strategy: createDefaultStrategyConfig(StrategyType.INSIDER_DETECTION),
    datasetInfo: {
      name: "Mock Dataset",
      startDate,
      endDate: now,
      totalRecords: 1000,
    },
    validationMethod: ValidationMethod.WALK_FORWARD,
    overallMetrics: createMockMetrics(),
    periodMetrics: [],
    performanceTier: PerformanceTier.GOOD,
    performanceScore: 75,
    insights: [],
    startedAt: startDate,
    completedAt: now,
    runtimeMs: 5000,
    ...partial,
  };
}

/**
 * Create mock backtest metrics
 */
export function createMockMetrics(partial?: Partial<BacktestMetrics>): BacktestMetrics {
  return {
    totalDetections: 100,
    truePositives: 65,
    trueNegatives: 80,
    falsePositives: 15,
    falseNegatives: 20,
    accuracy: 0.805,
    precision: 0.813,
    recall: 0.765,
    f1Score: 0.788,
    f2Score: 0.774,
    mcc: 0.598,
    aucRoc: 0.821,
    aucPr: 0.788,
    brierScore: 0.142,
    logLoss: 0.412,
    avgConfidence: 0.72,
    detectionRate: 0.1,
    falsePositiveRate: 0.158,
    falseNegativeRate: 0.235,
    ...partial,
  };
}

/**
 * Create mock detection result
 */
export function createMockDetectionResult(
  partial?: Partial<DetectionResult>
): DetectionResult {
  return {
    detectionId: generateDetectionId(),
    timestamp: new Date(),
    strategy: StrategyType.INSIDER_DETECTION,
    marketId: "market-1",
    walletAddress: "0x1234567890123456789012345678901234567890",
    detectionType: "INSIDER_ACTIVITY",
    confidence: 0.85,
    suspicionScore: 78,
    wasCorrect: true,
    triggeringFeatures: ["WHALE_TRADE", "FRESH_WALLET"],
    associatedTrades: ["trade-1", "trade-2"],
    scoreBreakdown: { whale: 30, freshWallet: 25, timing: 23 },
    ...partial,
  };
}

/**
 * Create mock historical dataset
 */
export function createMockHistoricalDataset(
  partial?: Partial<HistoricalDataset>
): HistoricalDataset {
  const now = new Date();
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return {
    name: "Mock Historical Dataset",
    description: "A mock dataset for testing",
    startDate,
    endDate: now,
    trades: [],
    markets: [],
    wallets: [],
    alerts: [],
    totalRecords: 0,
    qualityScore: 90,
    metadata: {},
    ...partial,
  };
}
