/**
 * Performance Benchmarks Types
 *
 * Type definitions for the performance benchmarking system.
 */

/**
 * Benchmark categories representing different system components
 */
export enum BenchmarkCategory {
  API = "api",
  DETECTION = "detection",
  DATABASE = "database",
  WEBSOCKET = "websocket",
  PROCESSING = "processing",
  MEMORY = "memory",
}

/**
 * Result status for a benchmark run
 */
export enum BenchmarkStatus {
  PASS = "pass",
  FAIL = "fail",
  WARN = "warn",
  SKIP = "skip",
}

/**
 * Performance target definition
 */
export interface PerformanceTarget {
  /** Unique identifier for the target */
  id: string;

  /** Human-readable name */
  name: string;

  /** Category of benchmark */
  category: BenchmarkCategory;

  /** Description of what is being measured */
  description: string;

  /** Target metric value (e.g., max latency in ms) */
  targetValue: number;

  /** Unit of measurement */
  unit: string;

  /** Warning threshold (percentage of target) */
  warnThreshold: number;

  /** Minimum iterations for statistical significance */
  minIterations: number;

  /** Maximum time to run benchmark in ms */
  maxDuration: number;

  /** Whether to run warmup iterations */
  warmup: boolean;

  /** Number of warmup iterations */
  warmupIterations: number;
}

/**
 * Individual benchmark iteration result
 */
export interface IterationResult {
  /** Iteration number */
  iteration: number;

  /** Duration in milliseconds */
  duration: number;

  /** Memory usage in bytes (if tracked) */
  memoryUsed?: number;

  /** Any error that occurred */
  error?: string;

  /** Timestamp when iteration started */
  startedAt: number;
}

/**
 * Statistical summary of benchmark results
 */
export interface BenchmarkStatistics {
  /** Number of iterations */
  iterations: number;

  /** Mean/average duration in ms */
  mean: number;

  /** Median duration in ms */
  median: number;

  /** Minimum duration in ms */
  min: number;

  /** Maximum duration in ms */
  max: number;

  /** Standard deviation */
  stdDev: number;

  /** 50th percentile (p50) */
  p50: number;

  /** 90th percentile (p90) */
  p90: number;

  /** 95th percentile (p95) */
  p95: number;

  /** 99th percentile (p99) */
  p99: number;

  /** Operations per second */
  opsPerSecond: number;

  /** Total duration of benchmark run */
  totalDuration: number;

  /** Error count */
  errorCount: number;

  /** Memory statistics if tracked */
  memory?: {
    meanBytes: number;
    maxBytes: number;
    minBytes: number;
  };
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** Target that was benchmarked */
  target: PerformanceTarget;

  /** Status of the benchmark */
  status: BenchmarkStatus;

  /** Statistical summary */
  statistics: BenchmarkStatistics;

  /** Individual iteration results */
  iterations: IterationResult[];

  /** Whether target was met */
  targetMet: boolean;

  /** Percentage of target achieved (lower is better for latency) */
  percentOfTarget: number;

  /** Human-readable summary message */
  message: string;

  /** Timestamp when benchmark started */
  startedAt: Date;

  /** Timestamp when benchmark completed */
  completedAt: Date;

  /** Environment information */
  environment: EnvironmentInfo;
}

/**
 * Environment information for benchmark context
 */
export interface EnvironmentInfo {
  /** Node.js version */
  nodeVersion: string;

  /** Platform (darwin, linux, win32) */
  platform: string;

  /** CPU architecture */
  arch: string;

  /** Number of CPUs */
  cpuCount: number;

  /** Total memory in bytes */
  totalMemory: number;

  /** Free memory at start in bytes */
  freeMemory: number;
}

/**
 * Benchmark suite configuration
 */
export interface BenchmarkSuiteConfig {
  /** Name of the suite */
  name: string;

  /** Description of the suite */
  description: string;

  /** Whether to run benchmarks in parallel */
  parallel: boolean;

  /** Maximum concurrent benchmarks (if parallel) */
  concurrency: number;

  /** Whether to fail fast on first failure */
  failFast: boolean;

  /** Whether to capture memory usage */
  captureMemory: boolean;

  /** Output format for results */
  outputFormat: "json" | "markdown" | "console";

  /** Output file path (optional) */
  outputPath?: string;

  /** Categories to include (empty = all) */
  includeCategories: BenchmarkCategory[];

  /** Specific benchmark IDs to run (empty = all) */
  includeBenchmarks: string[];

  /** Benchmark IDs to exclude */
  excludeBenchmarks: string[];
}

/**
 * Benchmark suite result
 */
export interface BenchmarkSuiteResult {
  /** Suite name */
  name: string;

  /** Suite description */
  description: string;

  /** Individual benchmark results */
  results: BenchmarkResult[];

  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
    passRate: number;
  };

  /** Total duration of suite run */
  duration: number;

  /** Timestamp when suite started */
  startedAt: Date;

  /** Timestamp when suite completed */
  completedAt: Date;

  /** Environment information */
  environment: EnvironmentInfo;
}

/**
 * Benchmark function signature
 */
export type BenchmarkFn = () => void | Promise<void>;

/**
 * Benchmark setup function signature
 */
export type BenchmarkSetupFn = () => void | Promise<void>;

/**
 * Benchmark teardown function signature
 */
export type BenchmarkTeardownFn = () => void | Promise<void>;

/**
 * Benchmark definition
 */
export interface BenchmarkDefinition {
  /** Performance target */
  target: PerformanceTarget;

  /** Function to benchmark */
  fn: BenchmarkFn;

  /** Setup function (runs once before benchmark) */
  setup?: BenchmarkSetupFn;

  /** Teardown function (runs once after benchmark) */
  teardown?: BenchmarkTeardownFn;

  /** Per-iteration setup (runs before each iteration) */
  beforeEach?: BenchmarkSetupFn;

  /** Per-iteration teardown (runs after each iteration) */
  afterEach?: BenchmarkTeardownFn;
}

/**
 * Default benchmark suite configuration
 */
export const DEFAULT_SUITE_CONFIG: BenchmarkSuiteConfig = {
  name: "Polymarket Tracker Benchmarks",
  description: "Comprehensive performance benchmarks for all systems",
  parallel: false,
  concurrency: 1,
  failFast: false,
  captureMemory: true,
  outputFormat: "console",
  includeCategories: [],
  includeBenchmarks: [],
  excludeBenchmarks: [],
};

/**
 * Default performance target settings
 */
export const DEFAULT_TARGET_SETTINGS = {
  warnThreshold: 0.8, // Warn at 80% of target
  minIterations: 100,
  maxDuration: 10000, // 10 seconds max
  warmup: true,
  warmupIterations: 10,
};
