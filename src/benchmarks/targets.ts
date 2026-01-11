/**
 * Performance Targets
 *
 * Defines performance targets for all system components.
 * These targets represent acceptable performance thresholds for production use.
 */

import {
  PerformanceTarget,
  BenchmarkCategory,
  DEFAULT_TARGET_SETTINGS,
} from "./types";

/**
 * Helper to create a performance target with defaults
 */
function createTarget(
  overrides: Partial<PerformanceTarget> & Pick<PerformanceTarget, "id" | "name" | "category" | "description" | "targetValue" | "unit">
): PerformanceTarget {
  return {
    ...DEFAULT_TARGET_SETTINGS,
    ...overrides,
  };
}

// ============================================================================
// Detection Module Targets
// ============================================================================

/**
 * Wallet age calculation should be fast as it's called frequently
 */
export const WALLET_AGE_CALCULATION: PerformanceTarget = createTarget({
  id: "detection.wallet-age",
  name: "Wallet Age Calculation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to calculate wallet age from first transaction timestamp",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Fresh wallet threshold evaluation performance
 */
export const FRESH_WALLET_THRESHOLD: PerformanceTarget = createTarget({
  id: "detection.fresh-wallet-threshold",
  name: "Fresh Wallet Threshold Evaluation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to evaluate wallet against freshness thresholds",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Zero history detection performance
 */
export const ZERO_HISTORY_CHECK: PerformanceTarget = createTarget({
  id: "detection.zero-history",
  name: "Zero History Check",
  category: BenchmarkCategory.DETECTION,
  description: "Time to check if wallet has zero trading history",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * First trade size analysis performance
 */
export const FIRST_TRADE_SIZE_ANALYSIS: PerformanceTarget = createTarget({
  id: "detection.first-trade-size",
  name: "First Trade Size Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze first trade size against market stats",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Funding pattern analysis performance
 */
export const FUNDING_PATTERN_ANALYSIS: PerformanceTarget = createTarget({
  id: "detection.funding-pattern",
  name: "Funding Pattern Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze wallet funding patterns",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Fresh wallet clustering performance
 */
export const FRESH_WALLET_CLUSTERING: PerformanceTarget = createTarget({
  id: "detection.fresh-wallet-clustering",
  name: "Fresh Wallet Clustering",
  category: BenchmarkCategory.DETECTION,
  description: "Time to cluster related fresh wallets",
  targetValue: 10, // 10ms max (complex operation)
  unit: "ms",
  minIterations: 100,
});

/**
 * Wallet reactivation check performance
 */
export const WALLET_REACTIVATION: PerformanceTarget = createTarget({
  id: "detection.wallet-reactivation",
  name: "Wallet Reactivation Check",
  category: BenchmarkCategory.DETECTION,
  description: "Time to check if dormant wallet was reactivated",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Fresh wallet confidence scoring performance
 */
export const CONFIDENCE_SCORING: PerformanceTarget = createTarget({
  id: "detection.confidence-score",
  name: "Confidence Score Calculation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to calculate fresh wallet suspicion confidence score",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Wallet history depth analysis performance
 */
export const HISTORY_DEPTH_ANALYSIS: PerformanceTarget = createTarget({
  id: "detection.history-depth",
  name: "History Depth Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze wallet transaction history depth",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Fresh wallet alert generation performance
 */
export const FRESH_WALLET_ALERT: PerformanceTarget = createTarget({
  id: "detection.fresh-wallet-alert",
  name: "Fresh Wallet Alert Generation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to generate fresh wallet alert from signals",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Volume baseline calculation performance
 */
export const VOLUME_BASELINE: PerformanceTarget = createTarget({
  id: "detection.volume-baseline",
  name: "Volume Baseline Calculation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to calculate market volume baseline from historical data",
  targetValue: 5, // 5ms max
  unit: "ms",
  minIterations: 200,
});

/**
 * Rolling volume average tracking performance
 */
export const ROLLING_VOLUME: PerformanceTarget = createTarget({
  id: "detection.rolling-volume",
  name: "Rolling Volume Average Update",
  category: BenchmarkCategory.DETECTION,
  description: "Time to update and retrieve rolling volume averages",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Volume spike detection performance
 */
export const VOLUME_SPIKE: PerformanceTarget = createTarget({
  id: "detection.volume-spike",
  name: "Volume Spike Detection",
  category: BenchmarkCategory.DETECTION,
  description: "Time to detect volume spike against baseline",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Trade size analysis performance
 */
export const TRADE_SIZE_ANALYSIS: PerformanceTarget = createTarget({
  id: "detection.trade-size",
  name: "Trade Size Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze individual trade size against market stats",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Whale threshold calculation performance
 */
export const WHALE_THRESHOLD: PerformanceTarget = createTarget({
  id: "detection.whale-threshold",
  name: "Whale Threshold Calculation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to calculate dynamic whale threshold for market",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Volume-to-liquidity ratio analysis performance
 */
export const VOLUME_LIQUIDITY_RATIO: PerformanceTarget = createTarget({
  id: "detection.volume-liquidity-ratio",
  name: "Volume-to-Liquidity Ratio Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze trade volume relative to liquidity",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Time-of-day normalization performance
 */
export const TIME_OF_DAY_NORMALIZATION: PerformanceTarget = createTarget({
  id: "detection.time-of-day",
  name: "Time-of-Day Volume Normalization",
  category: BenchmarkCategory.DETECTION,
  description: "Time to normalize volume for time-of-day patterns",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Consecutive large trade detection performance
 */
export const CONSECUTIVE_LARGE_TRADES: PerformanceTarget = createTarget({
  id: "detection.consecutive-large-trades",
  name: "Consecutive Large Trade Detection",
  category: BenchmarkCategory.DETECTION,
  description: "Time to detect burst patterns of large trades",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Market impact calculation performance
 */
export const MARKET_IMPACT: PerformanceTarget = createTarget({
  id: "detection.market-impact",
  name: "Market Impact Calculation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to calculate price impact of a trade",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Unusual volume alert generation performance
 */
export const UNUSUAL_VOLUME_ALERT: PerformanceTarget = createTarget({
  id: "detection.unusual-volume-alert",
  name: "Unusual Volume Alert Generation",
  category: BenchmarkCategory.DETECTION,
  description: "Time to generate alert from volume anomaly",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Volume clustering analysis performance
 */
export const VOLUME_CLUSTERING: PerformanceTarget = createTarget({
  id: "detection.volume-clustering",
  name: "Volume Clustering Analysis",
  category: BenchmarkCategory.DETECTION,
  description: "Time to analyze coordinated volume from multiple wallets",
  targetValue: 10, // 10ms max (complex operation)
  unit: "ms",
  minIterations: 100,
});

/**
 * Pre-event volume spike detection performance
 */
export const PRE_EVENT_VOLUME: PerformanceTarget = createTarget({
  id: "detection.pre-event-volume",
  name: "Pre-Event Volume Spike Detection",
  category: BenchmarkCategory.DETECTION,
  description: "Time to detect unusual pre-event volume activity",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

// ============================================================================
// API Module Targets
// ============================================================================

/**
 * API cache lookup performance
 */
export const API_CACHE_LOOKUP: PerformanceTarget = createTarget({
  id: "api.cache-lookup",
  name: "API Cache Lookup",
  category: BenchmarkCategory.API,
  description: "Time to lookup cached API response",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * API rate limiter check performance
 */
export const API_RATE_LIMITER: PerformanceTarget = createTarget({
  id: "api.rate-limiter",
  name: "Rate Limiter Check",
  category: BenchmarkCategory.API,
  description: "Time to check rate limit status",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Trade data parsing performance
 */
export const TRADE_PARSING: PerformanceTarget = createTarget({
  id: "api.trade-parsing",
  name: "Trade Data Parsing",
  category: BenchmarkCategory.API,
  description: "Time to parse trade execution data",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Order book depth calculation performance
 */
export const ORDERBOOK_DEPTH: PerformanceTarget = createTarget({
  id: "api.orderbook-depth",
  name: "Order Book Depth Calculation",
  category: BenchmarkCategory.API,
  description: "Time to calculate aggregated order book depth",
  targetValue: 1, // 1ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * USD value calculation performance
 */
export const USD_CALCULATION: PerformanceTarget = createTarget({
  id: "api.usd-calculation",
  name: "USD Value Calculation",
  category: BenchmarkCategory.API,
  description: "Time to calculate trade size in USD",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

// ============================================================================
// WebSocket Module Targets
// ============================================================================

/**
 * WebSocket message parsing performance
 */
export const WS_MESSAGE_PARSING: PerformanceTarget = createTarget({
  id: "ws.message-parsing",
  name: "WebSocket Message Parsing",
  category: BenchmarkCategory.WEBSOCKET,
  description: "Time to parse incoming WebSocket message",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * WebSocket message queue throughput
 */
export const WS_MESSAGE_QUEUE: PerformanceTarget = createTarget({
  id: "ws.message-queue",
  name: "Message Queue Enqueue/Dequeue",
  category: BenchmarkCategory.WEBSOCKET,
  description: "Time to enqueue and dequeue message",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Subscription manager lookup performance
 */
export const WS_SUBSCRIPTION_LOOKUP: PerformanceTarget = createTarget({
  id: "ws.subscription-lookup",
  name: "Subscription Lookup",
  category: BenchmarkCategory.WEBSOCKET,
  description: "Time to lookup market subscription status",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Event emitter dispatch performance
 */
export const WS_EVENT_DISPATCH: PerformanceTarget = createTarget({
  id: "ws.event-dispatch",
  name: "Event Dispatch",
  category: BenchmarkCategory.WEBSOCKET,
  description: "Time to dispatch event to listeners",
  targetValue: 0.2, // 0.2ms max
  unit: "ms",
  minIterations: 1000,
});

// ============================================================================
// Database Module Targets
// ============================================================================

/**
 * In-memory market lookup performance
 */
export const DB_MARKET_LOOKUP: PerformanceTarget = createTarget({
  id: "db.market-lookup",
  name: "In-Memory Market Lookup",
  category: BenchmarkCategory.DATABASE,
  description: "Time to lookup market from in-memory cache",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Trade insertion preparation performance
 */
export const DB_TRADE_INSERT_PREP: PerformanceTarget = createTarget({
  id: "db.trade-insert-prep",
  name: "Trade Insert Preparation",
  category: BenchmarkCategory.DATABASE,
  description: "Time to prepare trade for database insertion",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 1000,
});

/**
 * Time-series data point insertion performance
 */
export const DB_TIMESERIES_INSERT: PerformanceTarget = createTarget({
  id: "db.timeseries-insert",
  name: "Time-Series Data Point Insertion",
  category: BenchmarkCategory.DATABASE,
  description: "Time to insert time-series data point",
  targetValue: 0.5, // 0.5ms max
  unit: "ms",
  minIterations: 500,
});

/**
 * Index lookup performance
 */
export const DB_INDEX_LOOKUP: PerformanceTarget = createTarget({
  id: "db.index-lookup",
  name: "Index Lookup",
  category: BenchmarkCategory.DATABASE,
  description: "Time to lookup entity by indexed field",
  targetValue: 0.1, // 0.1ms max
  unit: "ms",
  minIterations: 1000,
});

// ============================================================================
// Processing Module Targets
// ============================================================================

/**
 * Batch trade processing performance
 */
export const BATCH_TRADE_PROCESSING: PerformanceTarget = createTarget({
  id: "processing.batch-trades",
  name: "Batch Trade Processing",
  category: BenchmarkCategory.PROCESSING,
  description: "Time to process batch of 100 trades through detection pipeline",
  targetValue: 50, // 50ms max for 100 trades
  unit: "ms",
  minIterations: 50,
});

/**
 * Full detection pipeline for single trade
 */
export const FULL_DETECTION_PIPELINE: PerformanceTarget = createTarget({
  id: "processing.full-pipeline",
  name: "Full Detection Pipeline (Single Trade)",
  category: BenchmarkCategory.PROCESSING,
  description: "Time to run trade through complete detection pipeline",
  targetValue: 5, // 5ms max
  unit: "ms",
  minIterations: 200,
});

/**
 * Alert aggregation performance
 */
export const ALERT_AGGREGATION: PerformanceTarget = createTarget({
  id: "processing.alert-aggregation",
  name: "Alert Aggregation",
  category: BenchmarkCategory.PROCESSING,
  description: "Time to aggregate multiple alerts into summary",
  targetValue: 2, // 2ms max
  unit: "ms",
  minIterations: 500,
});

// ============================================================================
// Memory Targets
// ============================================================================

/**
 * Memory efficiency for detection state
 */
export const MEMORY_DETECTION_STATE: PerformanceTarget = createTarget({
  id: "memory.detection-state",
  name: "Detection State Memory Usage",
  category: BenchmarkCategory.MEMORY,
  description: "Memory used per market for detection state",
  targetValue: 50000, // 50KB max per market
  unit: "bytes",
  minIterations: 10,
  maxDuration: 5000,
});

/**
 * Memory efficiency for cache
 */
export const MEMORY_CACHE: PerformanceTarget = createTarget({
  id: "memory.cache",
  name: "Cache Entry Memory Usage",
  category: BenchmarkCategory.MEMORY,
  description: "Average memory per cache entry",
  targetValue: 1000, // 1KB max per entry
  unit: "bytes",
  minIterations: 100,
  maxDuration: 5000,
});

// ============================================================================
// Export All Targets
// ============================================================================

/**
 * All performance targets organized by category
 */
export const ALL_TARGETS: PerformanceTarget[] = [
  // Detection
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

  // API
  API_CACHE_LOOKUP,
  API_RATE_LIMITER,
  TRADE_PARSING,
  ORDERBOOK_DEPTH,
  USD_CALCULATION,

  // WebSocket
  WS_MESSAGE_PARSING,
  WS_MESSAGE_QUEUE,
  WS_SUBSCRIPTION_LOOKUP,
  WS_EVENT_DISPATCH,

  // Database
  DB_MARKET_LOOKUP,
  DB_TRADE_INSERT_PREP,
  DB_TIMESERIES_INSERT,
  DB_INDEX_LOOKUP,

  // Processing
  BATCH_TRADE_PROCESSING,
  FULL_DETECTION_PIPELINE,
  ALERT_AGGREGATION,

  // Memory
  MEMORY_DETECTION_STATE,
  MEMORY_CACHE,
];

/**
 * Get targets by category
 */
export function getTargetsByCategory(
  category: BenchmarkCategory
): PerformanceTarget[] {
  return ALL_TARGETS.filter((t) => t.category === category);
}

/**
 * Get target by ID
 */
export function getTargetById(id: string): PerformanceTarget | undefined {
  return ALL_TARGETS.find((t) => t.id === id);
}
