/**
 * Performance Benchmark Runner
 *
 * Core benchmark execution engine that runs benchmarks, collects statistics,
 * and generates results.
 */

import * as os from "os";
import {
  BenchmarkCategory,
  BenchmarkStatus,
  BenchmarkStatistics,
  BenchmarkResult,
  BenchmarkSuiteResult,
  BenchmarkDefinition,
  BenchmarkSuiteConfig,
  IterationResult,
  EnvironmentInfo,
  PerformanceTarget,
  DEFAULT_SUITE_CONFIG,
} from "./types";

/**
 * Get current environment information
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))] ?? 0;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate statistics from iteration results
 */
export function calculateStatistics(
  iterations: IterationResult[],
  totalDuration: number
): BenchmarkStatistics {
  const durations = iterations.filter((i) => !i.error).map((i) => i.duration);
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const memoryUsages = iterations
    .filter((i) => i.memoryUsed !== undefined)
    .map((i) => i.memoryUsed!);

  const sum = durations.reduce((a, b) => a + b, 0);
  const mean = durations.length > 0 ? sum / durations.length : 0;
  const errorCount = iterations.filter((i) => i.error).length;

  let memory: BenchmarkStatistics["memory"] | undefined;
  if (memoryUsages.length > 0) {
    const memSum = memoryUsages.reduce((a, b) => a + b, 0);
    memory = {
      meanBytes: memSum / memoryUsages.length,
      maxBytes: Math.max(...memoryUsages),
      minBytes: Math.min(...memoryUsages),
    };
  }

  return {
    iterations: iterations.length,
    mean,
    median: percentile(sortedDurations, 50),
    min: sortedDurations.length > 0 ? (sortedDurations[0] ?? 0) : 0,
    max:
      sortedDurations.length > 0
        ? (sortedDurations[sortedDurations.length - 1] ?? 0)
        : 0,
    stdDev: standardDeviation(durations, mean),
    p50: percentile(sortedDurations, 50),
    p90: percentile(sortedDurations, 90),
    p95: percentile(sortedDurations, 95),
    p99: percentile(sortedDurations, 99),
    opsPerSecond:
      totalDuration > 0 ? (durations.length / totalDuration) * 1000 : 0,
    totalDuration,
    errorCount,
    memory,
  };
}

/**
 * Determine benchmark status from results
 */
export function determineBenchmarkStatus(
  target: PerformanceTarget,
  statistics: BenchmarkStatistics
): { status: BenchmarkStatus; targetMet: boolean; percentOfTarget: number } {
  // Use p95 as the primary metric for latency targets
  const actualValue = statistics.p95;
  const percentOfTarget = (actualValue / target.targetValue) * 100;
  const targetMet = actualValue <= target.targetValue;

  let status: BenchmarkStatus;
  if (statistics.errorCount > 0 && statistics.errorCount === statistics.iterations) {
    status = BenchmarkStatus.FAIL;
  } else if (targetMet) {
    if (percentOfTarget > target.warnThreshold * 100) {
      status = BenchmarkStatus.WARN;
    } else {
      status = BenchmarkStatus.PASS;
    }
  } else {
    status = BenchmarkStatus.FAIL;
  }

  return { status, targetMet, percentOfTarget };
}

/**
 * Generate human-readable message for benchmark result
 */
export function generateResultMessage(
  target: PerformanceTarget,
  statistics: BenchmarkStatistics,
  status: BenchmarkStatus,
  percentOfTarget: number
): string {
  const statusEmoji =
    status === BenchmarkStatus.PASS
      ? "PASS"
      : status === BenchmarkStatus.WARN
        ? "WARN"
        : status === BenchmarkStatus.FAIL
          ? "FAIL"
          : "SKIP";

  return (
    `[${statusEmoji}] ${target.name}: ` +
    `p95=${statistics.p95.toFixed(2)}${target.unit} ` +
    `(target: ${target.targetValue}${target.unit}, ` +
    `${percentOfTarget.toFixed(1)}% of target) | ` +
    `mean=${statistics.mean.toFixed(2)}${target.unit}, ` +
    `ops/s=${statistics.opsPerSecond.toFixed(0)}, ` +
    `errors=${statistics.errorCount}/${statistics.iterations}`
  );
}

/**
 * Run warmup iterations (results discarded)
 */
async function runWarmup(definition: BenchmarkDefinition): Promise<void> {
  const { target, fn, beforeEach, afterEach } = definition;

  for (let i = 0; i < target.warmupIterations; i++) {
    if (beforeEach) await beforeEach();
    try {
      await fn();
    } catch {
      // Ignore warmup errors
    }
    if (afterEach) await afterEach();
  }
}

/**
 * Run a single benchmark
 */
export async function runBenchmark(
  definition: BenchmarkDefinition,
  config: Partial<BenchmarkSuiteConfig> = {}
): Promise<BenchmarkResult> {
  const { target, fn, setup, teardown, beforeEach, afterEach } = definition;
  const captureMemory = config.captureMemory ?? true;

  const environment = getEnvironmentInfo();
  const startedAt = new Date();
  const iterations: IterationResult[] = [];

  // Run setup
  if (setup) {
    await setup();
  }

  // Run warmup if enabled
  if (target.warmup && target.warmupIterations > 0) {
    await runWarmup(definition);
  }

  // Run benchmark iterations
  const benchmarkStart = performance.now();
  let iterationCount = 0;

  while (
    iterationCount < target.minIterations ||
    (performance.now() - benchmarkStart < target.maxDuration &&
      iterationCount < target.minIterations * 10)
  ) {
    if (beforeEach) await beforeEach();

    const memBefore = captureMemory ? process.memoryUsage().heapUsed : 0;
    const iterStart = performance.now();

    let error: string | undefined;
    try {
      await fn();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const iterEnd = performance.now();
    const memAfter = captureMemory ? process.memoryUsage().heapUsed : 0;

    iterations.push({
      iteration: iterationCount,
      duration: iterEnd - iterStart,
      memoryUsed: captureMemory ? Math.max(0, memAfter - memBefore) : undefined,
      error,
      startedAt: iterStart,
    });

    if (afterEach) await afterEach();
    iterationCount++;

    // Stop if taking too long
    if (performance.now() - benchmarkStart > target.maxDuration) {
      break;
    }
  }

  const totalDuration = performance.now() - benchmarkStart;

  // Run teardown
  if (teardown) {
    await teardown();
  }

  const completedAt = new Date();
  const statistics = calculateStatistics(iterations, totalDuration);
  const { status, targetMet, percentOfTarget } = determineBenchmarkStatus(
    target,
    statistics
  );
  const message = generateResultMessage(
    target,
    statistics,
    status,
    percentOfTarget
  );

  return {
    target,
    status,
    statistics,
    iterations,
    targetMet,
    percentOfTarget,
    message,
    startedAt,
    completedAt,
    environment,
  };
}

/**
 * Run a suite of benchmarks
 */
export async function runBenchmarkSuite(
  benchmarks: BenchmarkDefinition[],
  config: Partial<BenchmarkSuiteConfig> = {}
): Promise<BenchmarkSuiteResult> {
  const fullConfig: BenchmarkSuiteConfig = {
    ...DEFAULT_SUITE_CONFIG,
    ...config,
  };

  const environment = getEnvironmentInfo();
  const startedAt = new Date();
  const results: BenchmarkResult[] = [];

  // Filter benchmarks based on config
  let filteredBenchmarks = benchmarks;

  if (fullConfig.includeCategories.length > 0) {
    filteredBenchmarks = filteredBenchmarks.filter((b) =>
      fullConfig.includeCategories.includes(b.target.category)
    );
  }

  if (fullConfig.includeBenchmarks.length > 0) {
    filteredBenchmarks = filteredBenchmarks.filter((b) =>
      fullConfig.includeBenchmarks.includes(b.target.id)
    );
  }

  if (fullConfig.excludeBenchmarks.length > 0) {
    filteredBenchmarks = filteredBenchmarks.filter(
      (b) => !fullConfig.excludeBenchmarks.includes(b.target.id)
    );
  }

  // Run benchmarks
  for (const benchmark of filteredBenchmarks) {
    try {
      const result = await runBenchmark(benchmark, fullConfig);
      results.push(result);

      // Output progress
      if (fullConfig.outputFormat === "console") {
        console.log(result.message);
      }

      // Fail fast if configured
      if (
        fullConfig.failFast &&
        result.status === BenchmarkStatus.FAIL
      ) {
        break;
      }
    } catch (error) {
      // Create a failed result for the benchmark
      const failedResult: BenchmarkResult = {
        target: benchmark.target,
        status: BenchmarkStatus.FAIL,
        statistics: {
          iterations: 0,
          mean: 0,
          median: 0,
          min: 0,
          max: 0,
          stdDev: 0,
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
          opsPerSecond: 0,
          totalDuration: 0,
          errorCount: 1,
        },
        iterations: [],
        targetMet: false,
        percentOfTarget: 0,
        message: `[FAIL] ${benchmark.target.name}: ${error instanceof Error ? error.message : String(error)}`,
        startedAt: new Date(),
        completedAt: new Date(),
        environment,
      };
      results.push(failedResult);

      if (fullConfig.outputFormat === "console") {
        console.log(failedResult.message);
      }

      if (fullConfig.failFast) {
        break;
      }
    }
  }

  const completedAt = new Date();
  const duration = completedAt.getTime() - startedAt.getTime();

  // Calculate summary
  const passed = results.filter((r) => r.status === BenchmarkStatus.PASS).length;
  const failed = results.filter((r) => r.status === BenchmarkStatus.FAIL).length;
  const warned = results.filter((r) => r.status === BenchmarkStatus.WARN).length;
  const skipped = results.filter((r) => r.status === BenchmarkStatus.SKIP).length;

  return {
    name: fullConfig.name,
    description: fullConfig.description,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      warned,
      skipped,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
    },
    duration,
    startedAt,
    completedAt,
    environment,
  };
}

/**
 * Format benchmark suite results as markdown
 */
export function formatResultsAsMarkdown(
  suiteResult: BenchmarkSuiteResult
): string {
  const lines: string[] = [];

  lines.push(`# ${suiteResult.name}`);
  lines.push("");
  lines.push(`${suiteResult.description}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${suiteResult.summary.total} |`);
  lines.push(`| Passed | ${suiteResult.summary.passed} |`);
  lines.push(`| Failed | ${suiteResult.summary.failed} |`);
  lines.push(`| Warned | ${suiteResult.summary.warned} |`);
  lines.push(`| Pass Rate | ${suiteResult.summary.passRate.toFixed(1)}% |`);
  lines.push(`| Duration | ${(suiteResult.duration / 1000).toFixed(2)}s |`);
  lines.push("");
  lines.push("## Environment");
  lines.push("");
  lines.push(`- Node.js: ${suiteResult.environment.nodeVersion}`);
  lines.push(`- Platform: ${suiteResult.environment.platform}`);
  lines.push(`- Architecture: ${suiteResult.environment.arch}`);
  lines.push(`- CPUs: ${suiteResult.environment.cpuCount}`);
  lines.push(
    `- Memory: ${(suiteResult.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`
  );
  lines.push("");
  lines.push("## Results");
  lines.push("");

  // Group by category
  const byCategory = new Map<BenchmarkCategory, BenchmarkResult[]>();
  for (const result of suiteResult.results) {
    const cat = result.target.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(result);
  }

  for (const [category, results] of byCategory) {
    lines.push(`### ${category.toUpperCase()}`);
    lines.push("");
    lines.push(
      `| Benchmark | Status | p95 | Target | Mean | Ops/s |`
    );
    lines.push(
      `|-----------|--------|-----|--------|------|-------|`
    );

    for (const result of results) {
      const statusIcon =
        result.status === BenchmarkStatus.PASS
          ? "PASS"
          : result.status === BenchmarkStatus.WARN
            ? "WARN"
            : result.status === BenchmarkStatus.FAIL
              ? "FAIL"
              : "SKIP";
      lines.push(
        `| ${result.target.name} | ${statusIcon} | ` +
          `${result.statistics.p95.toFixed(2)}${result.target.unit} | ` +
          `${result.target.targetValue}${result.target.unit} | ` +
          `${result.statistics.mean.toFixed(2)}${result.target.unit} | ` +
          `${result.statistics.opsPerSecond.toFixed(0)} |`
      );
    }
    lines.push("");
  }

  lines.push("## Detailed Results");
  lines.push("");

  for (const result of suiteResult.results) {
    lines.push(`### ${result.target.name}`);
    lines.push("");
    lines.push(`**${result.target.description}**`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Status | ${result.status.toUpperCase()} |`);
    lines.push(`| Iterations | ${result.statistics.iterations} |`);
    lines.push(`| Mean | ${result.statistics.mean.toFixed(3)}${result.target.unit} |`);
    lines.push(`| Median | ${result.statistics.median.toFixed(3)}${result.target.unit} |`);
    lines.push(`| Min | ${result.statistics.min.toFixed(3)}${result.target.unit} |`);
    lines.push(`| Max | ${result.statistics.max.toFixed(3)}${result.target.unit} |`);
    lines.push(`| Std Dev | ${result.statistics.stdDev.toFixed(3)}${result.target.unit} |`);
    lines.push(`| p50 | ${result.statistics.p50.toFixed(3)}${result.target.unit} |`);
    lines.push(`| p90 | ${result.statistics.p90.toFixed(3)}${result.target.unit} |`);
    lines.push(`| p95 | ${result.statistics.p95.toFixed(3)}${result.target.unit} |`);
    lines.push(`| p99 | ${result.statistics.p99.toFixed(3)}${result.target.unit} |`);
    lines.push(`| Target | ${result.target.targetValue}${result.target.unit} |`);
    lines.push(`| % of Target | ${result.percentOfTarget.toFixed(1)}% |`);
    lines.push(`| Ops/sec | ${result.statistics.opsPerSecond.toFixed(0)} |`);
    lines.push(`| Errors | ${result.statistics.errorCount} |`);
    lines.push("");
  }

  lines.push("---");
  lines.push(
    `*Generated at ${suiteResult.completedAt.toISOString()}*`
  );

  return lines.join("\n");
}

/**
 * Format benchmark suite results as JSON
 */
export function formatResultsAsJSON(
  suiteResult: BenchmarkSuiteResult
): string {
  // Create a serializable version (omit iteration arrays for brevity)
  const serializable = {
    ...suiteResult,
    results: suiteResult.results.map((r) => ({
      ...r,
      iterations: undefined, // Omit raw iterations for smaller output
      iterationCount: r.iterations.length,
    })),
  };
  return JSON.stringify(serializable, null, 2);
}
