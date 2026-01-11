/**
 * Tests for Performance Benchmarks (TEST-PERF-001)
 */

import { describe, it, expect } from "vitest";
import {
  BenchmarkCategory,
  BenchmarkStatus,
  DEFAULT_SUITE_CONFIG,
  DEFAULT_TARGET_SETTINGS,
  type PerformanceTarget,
  type BenchmarkStatistics,
  type BenchmarkDefinition,
} from "../../src/benchmarks/types";
import {
  getEnvironmentInfo,
  calculateStatistics,
  determineBenchmarkStatus,
  generateResultMessage,
  runBenchmark,
  runBenchmarkSuite,
  formatResultsAsMarkdown,
  formatResultsAsJSON,
} from "../../src/benchmarks/runner";
import {
  ALL_TARGETS,
  getTargetsByCategory,
  getTargetById,
  WALLET_AGE_CALCULATION,
  API_CACHE_LOOKUP,
  WS_MESSAGE_PARSING,
  DB_MARKET_LOOKUP,
  BATCH_TRADE_PROCESSING,
  MEMORY_DETECTION_STATE,
} from "../../src/benchmarks/targets";
import {
  ALL_BENCHMARKS,
  walletAgeBenchmark,
  freshWalletThresholdBenchmark,
  volumeSpikeBenchmark,
  apiCacheLookupBenchmark,
  wsMessageParsingBenchmark,
  dbMarketLookupBenchmark,
} from "../../src/benchmarks/definitions";

// ============================================================================
// Types Tests
// ============================================================================

describe("BenchmarkCategory", () => {
  it("should have all expected categories", () => {
    expect(BenchmarkCategory.API).toBe("api");
    expect(BenchmarkCategory.DETECTION).toBe("detection");
    expect(BenchmarkCategory.DATABASE).toBe("database");
    expect(BenchmarkCategory.WEBSOCKET).toBe("websocket");
    expect(BenchmarkCategory.PROCESSING).toBe("processing");
    expect(BenchmarkCategory.MEMORY).toBe("memory");
  });
});

describe("BenchmarkStatus", () => {
  it("should have all expected statuses", () => {
    expect(BenchmarkStatus.PASS).toBe("pass");
    expect(BenchmarkStatus.FAIL).toBe("fail");
    expect(BenchmarkStatus.WARN).toBe("warn");
    expect(BenchmarkStatus.SKIP).toBe("skip");
  });
});

describe("DEFAULT_SUITE_CONFIG", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_SUITE_CONFIG.name).toBe("Polymarket Tracker Benchmarks");
    expect(DEFAULT_SUITE_CONFIG.parallel).toBe(false);
    expect(DEFAULT_SUITE_CONFIG.concurrency).toBe(1);
    expect(DEFAULT_SUITE_CONFIG.failFast).toBe(false);
    expect(DEFAULT_SUITE_CONFIG.captureMemory).toBe(true);
    expect(DEFAULT_SUITE_CONFIG.outputFormat).toBe("console");
    expect(DEFAULT_SUITE_CONFIG.includeCategories).toEqual([]);
    expect(DEFAULT_SUITE_CONFIG.includeBenchmarks).toEqual([]);
    expect(DEFAULT_SUITE_CONFIG.excludeBenchmarks).toEqual([]);
  });
});

describe("DEFAULT_TARGET_SETTINGS", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_TARGET_SETTINGS.warnThreshold).toBe(0.8);
    expect(DEFAULT_TARGET_SETTINGS.minIterations).toBe(100);
    expect(DEFAULT_TARGET_SETTINGS.maxDuration).toBe(10000);
    expect(DEFAULT_TARGET_SETTINGS.warmup).toBe(true);
    expect(DEFAULT_TARGET_SETTINGS.warmupIterations).toBe(10);
  });
});

// ============================================================================
// Runner Tests
// ============================================================================

describe("getEnvironmentInfo", () => {
  it("should return environment information", () => {
    const env = getEnvironmentInfo();

    expect(env.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(typeof env.platform).toBe("string");
    expect(typeof env.arch).toBe("string");
    expect(typeof env.cpuCount).toBe("number");
    expect(env.cpuCount).toBeGreaterThan(0);
    expect(typeof env.totalMemory).toBe("number");
    expect(env.totalMemory).toBeGreaterThan(0);
    expect(typeof env.freeMemory).toBe("number");
  });
});

describe("calculateStatistics", () => {
  it("should calculate statistics from iteration results", () => {
    const iterations = Array.from({ length: 100 }, (_, i) => ({
      iteration: i,
      duration: 1 + Math.random() * 2, // 1-3ms
      startedAt: Date.now(),
    }));

    const stats = calculateStatistics(iterations, 1000);

    expect(stats.iterations).toBe(100);
    expect(stats.mean).toBeGreaterThan(1);
    expect(stats.mean).toBeLessThan(3);
    expect(stats.median).toBeGreaterThan(0);
    expect(stats.min).toBeGreaterThan(0);
    expect(stats.max).toBeGreaterThan(stats.min);
    expect(stats.stdDev).toBeGreaterThanOrEqual(0);
    expect(stats.p50).toBeGreaterThan(0);
    expect(stats.p90).toBeGreaterThanOrEqual(stats.p50);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p90);
    expect(stats.p99).toBeGreaterThanOrEqual(stats.p95);
    expect(stats.opsPerSecond).toBeGreaterThan(0);
    expect(stats.totalDuration).toBe(1000);
    expect(stats.errorCount).toBe(0);
  });

  it("should handle empty iterations", () => {
    const stats = calculateStatistics([], 0);

    expect(stats.iterations).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.median).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it("should count errors correctly", () => {
    const iterations = [
      { iteration: 0, duration: 1, startedAt: Date.now(), error: "Test error" },
      { iteration: 1, duration: 2, startedAt: Date.now() },
      { iteration: 2, duration: 3, startedAt: Date.now(), error: "Another error" },
    ];

    const stats = calculateStatistics(iterations, 100);

    expect(stats.iterations).toBe(3);
    expect(stats.errorCount).toBe(2);
  });

  it("should calculate memory statistics when provided", () => {
    const iterations = Array.from({ length: 10 }, (_, i) => ({
      iteration: i,
      duration: 1,
      memoryUsed: 1000 + i * 100,
      startedAt: Date.now(),
    }));

    const stats = calculateStatistics(iterations, 100);

    expect(stats.memory).toBeDefined();
    expect(stats.memory!.meanBytes).toBeGreaterThan(1000);
    expect(stats.memory!.minBytes).toBe(1000);
    expect(stats.memory!.maxBytes).toBe(1900);
  });
});

describe("determineBenchmarkStatus", () => {
  const mockTarget: PerformanceTarget = {
    id: "test",
    name: "Test",
    category: BenchmarkCategory.DETECTION,
    description: "Test benchmark",
    targetValue: 10,
    unit: "ms",
    warnThreshold: 0.8,
    minIterations: 10,
    maxDuration: 1000,
    warmup: true,
    warmupIterations: 5,
  };

  it("should return PASS when p95 is well below target", () => {
    const stats: BenchmarkStatistics = {
      iterations: 100,
      mean: 5,
      median: 5,
      min: 3,
      max: 8,
      stdDev: 1,
      p50: 5,
      p90: 7,
      p95: 7.5, // 75% of target
      p99: 8,
      opsPerSecond: 100,
      totalDuration: 1000,
      errorCount: 0,
    };

    const { status, targetMet, percentOfTarget } = determineBenchmarkStatus(
      mockTarget,
      stats
    );

    expect(status).toBe(BenchmarkStatus.PASS);
    expect(targetMet).toBe(true);
    expect(percentOfTarget).toBe(75);
  });

  it("should return WARN when p95 is close to target", () => {
    const stats: BenchmarkStatistics = {
      iterations: 100,
      mean: 8,
      median: 8,
      min: 6,
      max: 10,
      stdDev: 1,
      p50: 8,
      p90: 9,
      p95: 9, // 90% of target (above 80% warn threshold)
      p99: 9.5,
      opsPerSecond: 100,
      totalDuration: 1000,
      errorCount: 0,
    };

    const { status, targetMet, percentOfTarget } = determineBenchmarkStatus(
      mockTarget,
      stats
    );

    expect(status).toBe(BenchmarkStatus.WARN);
    expect(targetMet).toBe(true);
    expect(percentOfTarget).toBe(90);
  });

  it("should return FAIL when p95 exceeds target", () => {
    const stats: BenchmarkStatistics = {
      iterations: 100,
      mean: 12,
      median: 12,
      min: 10,
      max: 15,
      stdDev: 1,
      p50: 12,
      p90: 14,
      p95: 14.5, // 145% of target
      p99: 15,
      opsPerSecond: 100,
      totalDuration: 1000,
      errorCount: 0,
    };

    const { status, targetMet, percentOfTarget } = determineBenchmarkStatus(
      mockTarget,
      stats
    );

    expect(status).toBe(BenchmarkStatus.FAIL);
    expect(targetMet).toBe(false);
    expect(percentOfTarget).toBe(145);
  });

  it("should return FAIL when all iterations have errors", () => {
    const stats: BenchmarkStatistics = {
      iterations: 10,
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
      totalDuration: 1000,
      errorCount: 10,
    };

    const { status } = determineBenchmarkStatus(mockTarget, stats);

    expect(status).toBe(BenchmarkStatus.FAIL);
  });
});

describe("generateResultMessage", () => {
  const mockTarget: PerformanceTarget = {
    id: "test",
    name: "Test Benchmark",
    category: BenchmarkCategory.DETECTION,
    description: "Test",
    targetValue: 10,
    unit: "ms",
    warnThreshold: 0.8,
    minIterations: 10,
    maxDuration: 1000,
    warmup: true,
    warmupIterations: 5,
  };

  it("should generate a message for passing benchmark", () => {
    const stats: BenchmarkStatistics = {
      iterations: 100,
      mean: 5,
      median: 5,
      min: 3,
      max: 8,
      stdDev: 1,
      p50: 5,
      p90: 7,
      p95: 7.5,
      p99: 8,
      opsPerSecond: 200,
      totalDuration: 500,
      errorCount: 0,
    };

    const message = generateResultMessage(
      mockTarget,
      stats,
      BenchmarkStatus.PASS,
      75
    );

    expect(message).toContain("[PASS]");
    expect(message).toContain("Test Benchmark");
    expect(message).toContain("p95=7.50ms");
    expect(message).toContain("target: 10ms");
    expect(message).toContain("75.0%");
    expect(message).toContain("mean=5.00ms");
    expect(message).toContain("ops/s=200");
    expect(message).toContain("errors=0/100");
  });

  it("should generate a message for failing benchmark", () => {
    const stats: BenchmarkStatistics = {
      iterations: 50,
      mean: 15,
      median: 15,
      min: 12,
      max: 20,
      stdDev: 2,
      p50: 15,
      p90: 18,
      p95: 19,
      p99: 20,
      opsPerSecond: 50,
      totalDuration: 1000,
      errorCount: 5,
    };

    const message = generateResultMessage(
      mockTarget,
      stats,
      BenchmarkStatus.FAIL,
      190
    );

    expect(message).toContain("[FAIL]");
    expect(message).toContain("errors=5/50");
  });
});

describe("runBenchmark", () => {
  it("should run a simple benchmark successfully", async () => {
    const benchmark: BenchmarkDefinition = {
      target: {
        id: "test.simple",
        name: "Simple Test",
        category: BenchmarkCategory.DETECTION,
        description: "A simple test benchmark",
        targetValue: 100, // Very generous target
        unit: "ms",
        warnThreshold: 0.8,
        minIterations: 10,
        maxDuration: 5000,
        warmup: false,
        warmupIterations: 0,
      },
      fn: async () => {
        // Minimal work
        const x = Math.random();
        void x;
      },
    };

    const result = await runBenchmark(benchmark, { captureMemory: false });

    expect(result.status).toBe(BenchmarkStatus.PASS);
    expect(result.statistics.iterations).toBeGreaterThanOrEqual(10);
    expect(result.statistics.mean).toBeLessThan(100);
    expect(result.targetMet).toBe(true);
    expect(result.message).toContain("[PASS]");
  });

  it("should run setup and teardown functions", async () => {
    let setupCalled = false;
    let teardownCalled = false;

    const benchmark: BenchmarkDefinition = {
      target: {
        id: "test.lifecycle",
        name: "Lifecycle Test",
        category: BenchmarkCategory.DETECTION,
        description: "Test lifecycle",
        targetValue: 100,
        unit: "ms",
        warnThreshold: 0.8,
        minIterations: 5,
        maxDuration: 1000,
        warmup: false,
        warmupIterations: 0,
      },
      setup: async () => {
        setupCalled = true;
      },
      teardown: async () => {
        teardownCalled = true;
      },
      fn: async () => {
        void 0;
      },
    };

    await runBenchmark(benchmark);

    expect(setupCalled).toBe(true);
    expect(teardownCalled).toBe(true);
  });

  it("should capture errors in iterations", async () => {
    let callCount = 0;

    const benchmark: BenchmarkDefinition = {
      target: {
        id: "test.errors",
        name: "Error Test",
        category: BenchmarkCategory.DETECTION,
        description: "Test error handling",
        targetValue: 100,
        unit: "ms",
        warnThreshold: 0.8,
        minIterations: 10,
        maxDuration: 1000,
        warmup: false,
        warmupIterations: 0,
      },
      fn: async () => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error("Test error");
        }
      },
    };

    const result = await runBenchmark(benchmark);

    expect(result.statistics.errorCount).toBeGreaterThan(0);
  });
});

describe("runBenchmarkSuite", () => {
  it("should run multiple benchmarks", async () => {
    const benchmarks: BenchmarkDefinition[] = [
      {
        target: {
          id: "suite.test1",
          name: "Suite Test 1",
          category: BenchmarkCategory.DETECTION,
          description: "Test 1",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
      {
        target: {
          id: "suite.test2",
          name: "Suite Test 2",
          category: BenchmarkCategory.API,
          description: "Test 2",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
    ];

    const result = await runBenchmarkSuite(benchmarks, {
      name: "Test Suite",
      outputFormat: "json", // Suppress console output
    });

    expect(result.results).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.passRate).toBe(100);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should filter benchmarks by category", async () => {
    const benchmarks: BenchmarkDefinition[] = [
      {
        target: {
          id: "filter.detection",
          name: "Detection Test",
          category: BenchmarkCategory.DETECTION,
          description: "Detection",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
      {
        target: {
          id: "filter.api",
          name: "API Test",
          category: BenchmarkCategory.API,
          description: "API",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
    ];

    const result = await runBenchmarkSuite(benchmarks, {
      includeCategories: [BenchmarkCategory.DETECTION],
      outputFormat: "json",
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.target.category).toBe(BenchmarkCategory.DETECTION);
  });
});

describe("formatResultsAsMarkdown", () => {
  it("should format results as markdown", async () => {
    const benchmarks: BenchmarkDefinition[] = [
      {
        target: {
          id: "md.test",
          name: "Markdown Test",
          category: BenchmarkCategory.DETECTION,
          description: "Test markdown formatting",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
    ];

    const suiteResult = await runBenchmarkSuite(benchmarks, {
      name: "Markdown Test Suite",
      outputFormat: "json",
    });

    const markdown = formatResultsAsMarkdown(suiteResult);

    expect(markdown).toContain("# Markdown Test Suite");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Environment");
    expect(markdown).toContain("## Results");
    expect(markdown).toContain("### DETECTION");
    expect(markdown).toContain("Markdown Test");
  });
});

describe("formatResultsAsJSON", () => {
  it("should format results as JSON", async () => {
    const benchmarks: BenchmarkDefinition[] = [
      {
        target: {
          id: "json.test",
          name: "JSON Test",
          category: BenchmarkCategory.DETECTION,
          description: "Test JSON formatting",
          targetValue: 100,
          unit: "ms",
          warnThreshold: 0.8,
          minIterations: 5,
          maxDuration: 500,
          warmup: false,
          warmupIterations: 0,
        },
        fn: async () => {
          void 0;
        },
      },
    ];

    const suiteResult = await runBenchmarkSuite(benchmarks, {
      outputFormat: "json",
    });

    const json = formatResultsAsJSON(suiteResult);

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Polymarket Tracker Benchmarks");
    expect(parsed.results).toHaveLength(1);
    expect(parsed.summary.total).toBe(1);
  });
});

// ============================================================================
// Targets Tests
// ============================================================================

describe("ALL_TARGETS", () => {
  it("should have targets for all categories", () => {
    const categories = ALL_TARGETS.map((t) => t.category);
    const uniqueCategories = new Set(categories);

    expect(uniqueCategories.has(BenchmarkCategory.DETECTION)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.API)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.WEBSOCKET)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.DATABASE)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.PROCESSING)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.MEMORY)).toBe(true);
  });

  it("should have unique IDs", () => {
    const ids = ALL_TARGETS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ALL_TARGETS.length);
  });

  it("should have reasonable target values", () => {
    for (const target of ALL_TARGETS) {
      expect(target.targetValue).toBeGreaterThan(0);
      expect(target.minIterations).toBeGreaterThan(0);
      expect(target.maxDuration).toBeGreaterThan(0);
      expect(target.warnThreshold).toBeGreaterThan(0);
      expect(target.warnThreshold).toBeLessThan(1);
    }
  });
});

describe("getTargetsByCategory", () => {
  it("should return targets for a specific category", () => {
    const detectionTargets = getTargetsByCategory(BenchmarkCategory.DETECTION);

    expect(detectionTargets.length).toBeGreaterThan(0);
    for (const target of detectionTargets) {
      expect(target.category).toBe(BenchmarkCategory.DETECTION);
    }
  });
});

describe("getTargetById", () => {
  it("should return a target by ID", () => {
    const target = getTargetById("detection.wallet-age");

    expect(target).toBeDefined();
    expect(target!.id).toBe("detection.wallet-age");
    expect(target!.name).toBe("Wallet Age Calculation");
  });

  it("should return undefined for unknown ID", () => {
    const target = getTargetById("unknown.target");
    expect(target).toBeUndefined();
  });
});

describe("specific targets", () => {
  it("should have WALLET_AGE_CALCULATION target", () => {
    expect(WALLET_AGE_CALCULATION.id).toBe("detection.wallet-age");
    expect(WALLET_AGE_CALCULATION.category).toBe(BenchmarkCategory.DETECTION);
    expect(WALLET_AGE_CALCULATION.targetValue).toBe(1);
    expect(WALLET_AGE_CALCULATION.unit).toBe("ms");
  });

  it("should have API_CACHE_LOOKUP target", () => {
    expect(API_CACHE_LOOKUP.id).toBe("api.cache-lookup");
    expect(API_CACHE_LOOKUP.category).toBe(BenchmarkCategory.API);
  });

  it("should have WS_MESSAGE_PARSING target", () => {
    expect(WS_MESSAGE_PARSING.id).toBe("ws.message-parsing");
    expect(WS_MESSAGE_PARSING.category).toBe(BenchmarkCategory.WEBSOCKET);
  });

  it("should have DB_MARKET_LOOKUP target", () => {
    expect(DB_MARKET_LOOKUP.id).toBe("db.market-lookup");
    expect(DB_MARKET_LOOKUP.category).toBe(BenchmarkCategory.DATABASE);
  });

  it("should have BATCH_TRADE_PROCESSING target", () => {
    expect(BATCH_TRADE_PROCESSING.id).toBe("processing.batch-trades");
    expect(BATCH_TRADE_PROCESSING.category).toBe(BenchmarkCategory.PROCESSING);
  });

  it("should have MEMORY_DETECTION_STATE target", () => {
    expect(MEMORY_DETECTION_STATE.id).toBe("memory.detection-state");
    expect(MEMORY_DETECTION_STATE.category).toBe(BenchmarkCategory.MEMORY);
  });
});

// ============================================================================
// Definitions Tests
// ============================================================================

describe("ALL_BENCHMARKS", () => {
  it("should have benchmarks for all categories", () => {
    const categories = ALL_BENCHMARKS.map((b) => b.target.category);
    const uniqueCategories = new Set(categories);

    expect(uniqueCategories.has(BenchmarkCategory.DETECTION)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.API)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.WEBSOCKET)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.DATABASE)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.PROCESSING)).toBe(true);
    expect(uniqueCategories.has(BenchmarkCategory.MEMORY)).toBe(true);
  });

  it("should have matching targets for each benchmark", () => {
    for (const benchmark of ALL_BENCHMARKS) {
      const target = getTargetById(benchmark.target.id);
      expect(target).toBeDefined();
      expect(target!.id).toBe(benchmark.target.id);
    }
  });
});

describe("detection benchmarks", () => {
  it("should run walletAgeBenchmark", async () => {
    const result = await runBenchmark(walletAgeBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });

  it("should run freshWalletThresholdBenchmark", async () => {
    const result = await runBenchmark(freshWalletThresholdBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });

  it("should run volumeSpikeBenchmark", async () => {
    const result = await runBenchmark(volumeSpikeBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });
});

describe("API benchmarks", () => {
  it("should run apiCacheLookupBenchmark", async () => {
    const result = await runBenchmark(apiCacheLookupBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });
});

describe("WebSocket benchmarks", () => {
  it("should run wsMessageParsingBenchmark", async () => {
    const result = await runBenchmark(wsMessageParsingBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });
});

describe("Database benchmarks", () => {
  it("should run dbMarketLookupBenchmark", async () => {
    const result = await runBenchmark(dbMarketLookupBenchmark, {
      captureMemory: false,
    });

    expect(result.statistics.iterations).toBeGreaterThan(0);
    expect(result.statistics.errorCount).toBe(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("benchmark suite integration", () => {
  it("should run a subset of benchmarks successfully", async () => {
    // Run just a few fast benchmarks to verify integration
    const selectedBenchmarks = [
      walletAgeBenchmark,
      freshWalletThresholdBenchmark,
      apiCacheLookupBenchmark,
      wsMessageParsingBenchmark,
      dbMarketLookupBenchmark,
    ];

    const result = await runBenchmarkSuite(selectedBenchmarks, {
      name: "Integration Test Suite",
      outputFormat: "json",
      captureMemory: false,
    });

    expect(result.results).toHaveLength(5);
    expect(result.summary.failed).toBe(0);

    // All benchmarks should complete without errors
    for (const benchResult of result.results) {
      expect(benchResult.statistics.errorCount).toBe(0);
    }
  });
});
