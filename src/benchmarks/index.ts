/**
 * Performance Benchmarks Module
 *
 * Comprehensive performance benchmarking system for the Polymarket Tracker.
 * This module provides tools to measure, track, and report on system performance.
 */

// Export types
export {
  BenchmarkCategory,
  BenchmarkStatus,
  type PerformanceTarget,
  type IterationResult,
  type BenchmarkStatistics,
  type BenchmarkResult,
  type BenchmarkSuiteResult,
  type EnvironmentInfo,
  type BenchmarkSuiteConfig,
  type BenchmarkFn,
  type BenchmarkSetupFn,
  type BenchmarkTeardownFn,
  type BenchmarkDefinition,
  DEFAULT_SUITE_CONFIG,
  DEFAULT_TARGET_SETTINGS,
} from "./types";

// Export runner functions
export {
  getEnvironmentInfo,
  calculateStatistics,
  determineBenchmarkStatus,
  generateResultMessage,
  runBenchmark,
  runBenchmarkSuite,
  formatResultsAsMarkdown,
  formatResultsAsJSON,
} from "./runner";

// Export targets
export {
  // Detection targets
  WALLET_AGE_CALCULATION,
  FRESH_WALLET_THRESHOLD,
  ZERO_HISTORY_CHECK,
  FIRST_TRADE_SIZE_ANALYSIS,
  FUNDING_PATTERN_ANALYSIS,
  FRESH_WALLET_CLUSTERING,
  WALLET_REACTIVATION,
  CONFIDENCE_SCORING,
  HISTORY_DEPTH_ANALYSIS,
  FRESH_WALLET_ALERT,
  VOLUME_BASELINE,
  ROLLING_VOLUME,
  VOLUME_SPIKE,
  TRADE_SIZE_ANALYSIS,
  WHALE_THRESHOLD,
  VOLUME_LIQUIDITY_RATIO,
  TIME_OF_DAY_NORMALIZATION,
  CONSECUTIVE_LARGE_TRADES,
  MARKET_IMPACT,
  UNUSUAL_VOLUME_ALERT,
  VOLUME_CLUSTERING,
  PRE_EVENT_VOLUME,

  // API targets
  API_CACHE_LOOKUP,
  API_RATE_LIMITER,
  TRADE_PARSING,
  ORDERBOOK_DEPTH,
  USD_CALCULATION,

  // WebSocket targets
  WS_MESSAGE_PARSING,
  WS_MESSAGE_QUEUE,
  WS_SUBSCRIPTION_LOOKUP,
  WS_EVENT_DISPATCH,

  // Database targets
  DB_MARKET_LOOKUP,
  DB_TRADE_INSERT_PREP,
  DB_TIMESERIES_INSERT,
  DB_INDEX_LOOKUP,

  // Processing targets
  BATCH_TRADE_PROCESSING,
  FULL_DETECTION_PIPELINE,
  ALERT_AGGREGATION,

  // Memory targets
  MEMORY_DETECTION_STATE,
  MEMORY_CACHE,

  // Utilities
  ALL_TARGETS,
  getTargetsByCategory,
  getTargetById,
} from "./targets";

// Export benchmark definitions
export {
  ALL_BENCHMARKS,

  // Detection benchmarks
  walletAgeBenchmark,
  freshWalletThresholdBenchmark,
  zeroHistoryBenchmark,
  firstTradeSizeAnalysisBenchmark,
  fundingPatternAnalysisBenchmark,
  freshWalletClusteringBenchmark,
  walletReactivationBenchmark,
  confidenceScoringBenchmark,
  historyDepthAnalysisBenchmark,
  freshWalletAlertBenchmark,
  volumeBaselineBenchmark,
  rollingVolumeBenchmark,
  volumeSpikeBenchmark,
  tradeSizeAnalysisBenchmark,
  whaleThresholdBenchmark,
  volumeLiquidityRatioBenchmark,
  timeOfDayNormalizationBenchmark,
  consecutiveLargeTradesBenchmark,
  marketImpactBenchmark,
  unusualVolumeAlertBenchmark,
  volumeClusteringBenchmark,
  preEventVolumeBenchmark,

  // API benchmarks
  apiCacheLookupBenchmark,
  apiRateLimiterBenchmark,
  tradeParsingBenchmark,
  orderBookDepthBenchmark,
  usdCalculationBenchmark,

  // WebSocket benchmarks
  wsMessageParsingBenchmark,
  wsMessageQueueBenchmark,
  wsSubscriptionLookupBenchmark,
  wsEventDispatchBenchmark,

  // Database benchmarks
  dbMarketLookupBenchmark,
  dbTradeInsertPrepBenchmark,
  dbTimeseriesInsertBenchmark,
  dbIndexLookupBenchmark,

  // Processing benchmarks
  batchTradeProcessingBenchmark,
  fullDetectionPipelineBenchmark,
  alertAggregationBenchmark,

  // Memory benchmarks
  memoryDetectionStateBenchmark,
  memoryCacheBenchmark,
} from "./definitions";

/**
 * Run all benchmarks and return results
 */
export async function runAllBenchmarks(
  config?: Partial<import("./types").BenchmarkSuiteConfig>
): Promise<import("./types").BenchmarkSuiteResult> {
  const { runBenchmarkSuite } = await import("./runner");
  const { ALL_BENCHMARKS } = await import("./definitions");
  return runBenchmarkSuite(ALL_BENCHMARKS, config);
}

/**
 * Run benchmarks for a specific category
 */
export async function runCategoryBenchmarks(
  category: import("./types").BenchmarkCategory,
  config?: Partial<import("./types").BenchmarkSuiteConfig>
): Promise<import("./types").BenchmarkSuiteResult> {
  const { runBenchmarkSuite } = await import("./runner");
  const { ALL_BENCHMARKS } = await import("./definitions");
  const filtered = ALL_BENCHMARKS.filter(
    (b) => b.target.category === category
  );
  return runBenchmarkSuite(filtered, {
    ...config,
    name: `${category.toUpperCase()} Benchmarks`,
    description: `Performance benchmarks for ${category} module`,
  });
}
