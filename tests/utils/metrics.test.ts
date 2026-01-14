/**
 * Metrics Utility Tests (MONITOR-002)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MetricsCollector,
  recordApiRequest,
  recordWebSocketMessage,
  recordWebSocketReconnect,
  setActiveSubscriptions,
  incrementSubscriptions,
  decrementSubscriptions,
  setStartupOrchestrator,
  resetStartupOrchestrator,
  type ApplicationMetrics,
  type StartupOrchestratorInterface,
} from "../../src/utils/metrics";

// Default stats values for mocking
const defaultTradeStreamStats = {
  totalProcessed: 1000,
  storedCount: 950,
  errorCount: 50,
  whaleTradesCount: 25,
  newWalletsCount: 100,
  tradesPerSecond: 5.5,
};

const defaultAlertStats = {
  totalGenerated: 100,
  broadcastCount: 80,
  suppressedCount: 20,
  byType: { whale_trade: 50, fresh_wallet: 30, volume_spike: 20 } as Record<string, number>,
  bySeverity: { info: 10, low: 30, medium: 40, high: 15, critical: 5 } as Record<string, number>,
};

const defaultWalletStats = {
  totalProfiled: 500,
  newWalletsProfiled: 200,
  highSuspicionCount: 15,
  freshWalletsCount: 50,
  cacheHits: 400,
  cacheMisses: 100,
};

const defaultMarketSyncStats = {
  totalSynced: 250,
  newMarkets: 10,
  durationMs: 1500,
  syncedAt: "2026-01-14T10:00:00Z",
};

interface MockOrchestratorOverrides {
  tradeStreamStats?: typeof defaultTradeStreamStats;
  alertStats?: typeof defaultAlertStats;
  walletStats?: typeof defaultWalletStats;
  marketSyncStats?: typeof defaultMarketSyncStats | null;
  throwTradeStream?: boolean;
  throwAlertGenerator?: boolean;
  throwWalletProfiler?: boolean;
  throwMarketSync?: boolean;
}

// Create a mock orchestrator for testing
function createMockOrchestrator(overrides: MockOrchestratorOverrides = {}): StartupOrchestratorInterface {
  return {
    getTradeStreamService: () => {
      if (overrides.throwTradeStream) {
        throw new Error("Service not available");
      }
      const stats = overrides.tradeStreamStats ?? defaultTradeStreamStats;
      return {
        getStats: () => stats,
      };
    },
    getAlertGeneratorService: () => {
      if (overrides.throwAlertGenerator) {
        throw new Error("Service not available");
      }
      const stats = overrides.alertStats ?? defaultAlertStats;
      return {
        getStats: () => stats,
      };
    },
    getWalletProfilerService: () => {
      if (overrides.throwWalletProfiler) {
        throw new Error("Service not available");
      }
      const stats = overrides.walletStats ?? defaultWalletStats;
      return {
        getStats: () => stats,
      };
    },
    getMarketSyncService: () => {
      if (overrides.throwMarketSync) {
        throw new Error("Service not available");
      }
      const stats = overrides.marketSyncStats === undefined
        ? defaultMarketSyncStats
        : overrides.marketSyncStats;
      return {
        getLastSyncStats: () => stats,
      };
    },
  };
}

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    // Reset the global state
    collector.reset();
    resetStartupOrchestrator();
    // Set up a mock orchestrator by default
    setStartupOrchestrator(createMockOrchestrator());
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  describe("getMetrics", () => {
    it("should return all metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.collectedAt).toBeDefined();
      expect(metrics.startedAt).toBeDefined();
    });

    it("should include trade stream metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.tradesProcessedTotal).toBe(1000);
      expect(metrics.tradesStoredTotal).toBe(950);
      expect(metrics.tradesErrorTotal).toBe(50);
      expect(metrics.whaleTradesTotal).toBe(25);
      expect(metrics.newWalletsFromTradesTotal).toBe(100);
      expect(metrics.tradesPerSecond).toBe(5.5);
    });

    it("should include alert metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.alertsGeneratedTotal).toBe(100);
      expect(metrics.alertsBroadcastTotal).toBe(80);
      expect(metrics.alertsSuppressedTotal).toBe(20);
      expect(metrics.alertsByType).toEqual({
        whale_trade: 50,
        fresh_wallet: 30,
        volume_spike: 20,
      });
    });

    it("should include wallet profiler metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.walletsProfiledTotal).toBe(500);
      expect(metrics.newWalletsProfiledTotal).toBe(200);
      expect(metrics.highSuspicionWalletsTotal).toBe(15);
      expect(metrics.freshWalletsTotal).toBe(50);
      expect(metrics.walletCacheHits).toBe(400);
      expect(metrics.walletCacheMisses).toBe(100);
    });

    it("should include market sync metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.marketsSyncedTotal).toBe(250);
      expect(metrics.newMarketsTotal).toBe(10);
      expect(metrics.marketSyncDurationMs).toBe(1500);
      expect(metrics.lastSyncAt).toBe("2026-01-14T10:00:00Z");
    });

    it("should include system metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsageMb).toBeGreaterThan(0);
      expect(metrics.heapUsedMb).toBeGreaterThan(0);
      expect(metrics.heapTotalMb).toBeGreaterThan(0);
    });

    it("should include WebSocket metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.websocketMessagesTotal).toBeDefined();
      expect(metrics.websocketReconnectsTotal).toBeDefined();
      expect(metrics.activeSubscriptions).toBeDefined();
    });

    it("should include API metrics", () => {
      const metrics = collector.getMetrics();

      expect(metrics.apiRequestsTotal).toBeDefined();
      expect(metrics.apiErrorsTotal).toBeDefined();
      expect(metrics.apiRequestsByEndpoint).toBeDefined();
    });
  });

  describe("toPrometheus", () => {
    it("should return Prometheus format string", () => {
      const prometheus = collector.toPrometheus();

      expect(typeof prometheus).toBe("string");
      expect(prometheus.length).toBeGreaterThan(0);
    });

    it("should include HELP comments", () => {
      const prometheus = collector.toPrometheus();

      expect(prometheus).toContain("# HELP");
      expect(prometheus).toContain("polymarket_trades_processed_total");
    });

    it("should include TYPE comments", () => {
      const prometheus = collector.toPrometheus();

      expect(prometheus).toContain("# TYPE polymarket_trades_processed_total counter");
      expect(prometheus).toContain("# TYPE polymarket_uptime_seconds gauge");
    });

    it("should include all major metrics", () => {
      const prometheus = collector.toPrometheus();

      // Trade metrics
      expect(prometheus).toContain("polymarket_trades_processed_total 1000");
      expect(prometheus).toContain("polymarket_trades_stored_total 950");
      expect(prometheus).toContain("polymarket_whale_trades_total 25");

      // Alert metrics
      expect(prometheus).toContain("polymarket_alerts_generated_total 100");
      expect(prometheus).toContain("polymarket_alerts_broadcast_total 80");

      // Wallet metrics
      expect(prometheus).toContain("polymarket_wallets_profiled_total 500");

      // Market sync metrics
      expect(prometheus).toContain("polymarket_markets_synced_total 250");
    });

    it("should format labels correctly", () => {
      const prometheus = collector.toPrometheus();

      // Check for labeled metrics
      expect(prometheus).toContain('type="whale_trade"');
      expect(prometheus).toContain('type="fresh_wallet"');
    });
  });

  describe("getFormattedMetrics", () => {
    it("should return JSON format by default", () => {
      const result = collector.getFormattedMetrics();

      expect(typeof result).toBe("object");
      expect((result as ApplicationMetrics).tradesProcessedTotal).toBeDefined();
    });

    it("should return JSON format when specified", () => {
      const result = collector.getFormattedMetrics("json");

      expect(typeof result).toBe("object");
    });

    it("should return Prometheus format when specified", () => {
      const result = collector.getFormattedMetrics("prometheus");

      expect(typeof result).toBe("string");
      expect(result).toContain("# HELP");
    });
  });

  describe("reset", () => {
    it("should reset all API metrics", () => {
      // Record some API requests
      recordApiRequest("/api/test", "GET", 200, 50);
      recordApiRequest("/api/test", "GET", 500, 100);

      let metrics = collector.getMetrics();
      expect(metrics.apiRequestsTotal).toBe(2);
      expect(metrics.apiErrorsTotal).toBe(1);

      // Reset
      collector.reset();

      metrics = collector.getMetrics();
      expect(metrics.apiRequestsTotal).toBe(0);
      expect(metrics.apiErrorsTotal).toBe(0);
    });

    it("should reset WebSocket metrics", () => {
      recordWebSocketMessage();
      recordWebSocketMessage();
      recordWebSocketReconnect();

      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.websocketMessagesTotal).toBe(0);
      expect(metrics.websocketReconnectsTotal).toBe(0);
    });
  });
});

describe("Recording Functions", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    collector.reset();
    resetStartupOrchestrator();
    setStartupOrchestrator(createMockOrchestrator());
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  describe("recordApiRequest", () => {
    it("should record successful requests", () => {
      recordApiRequest("/api/dashboard/stats", "GET", 200, 45);

      const metrics = collector.getMetrics();
      expect(metrics.apiRequestsTotal).toBe(1);
      expect(metrics.apiErrorsTotal).toBe(0);
    });

    it("should record error requests", () => {
      recordApiRequest("/api/dashboard/stats", "GET", 500, 100);

      const metrics = collector.getMetrics();
      expect(metrics.apiRequestsTotal).toBe(1);
      expect(metrics.apiErrorsTotal).toBe(1);
    });

    it("should track 4xx errors", () => {
      recordApiRequest("/api/dashboard/stats", "GET", 404, 10);
      recordApiRequest("/api/dashboard/stats", "GET", 400, 5);

      const metrics = collector.getMetrics();
      expect(metrics.apiRequestsTotal).toBe(2);
      expect(metrics.apiErrorsTotal).toBe(2);
    });

    it("should track metrics by endpoint", () => {
      recordApiRequest("/api/endpoint1", "GET", 200, 50);
      recordApiRequest("/api/endpoint1", "GET", 200, 100);
      recordApiRequest("/api/endpoint2", "POST", 201, 75);

      const metrics = collector.getMetrics();
      expect(Object.keys(metrics.apiRequestsByEndpoint)).toHaveLength(2);

      const endpoint1 = metrics.apiRequestsByEndpoint["/api/endpoint1"];
      expect(endpoint1).toBeDefined();
      expect(endpoint1!.requests).toBe(2);
      expect(endpoint1!.totalDurationMs).toBe(150);
      expect(endpoint1!.avgDurationMs).toBe(75);
      expect(endpoint1!.minDurationMs).toBe(50);
      expect(endpoint1!.maxDurationMs).toBe(100);
    });

    it("should track errors by endpoint", () => {
      recordApiRequest("/api/test", "GET", 200, 50);
      recordApiRequest("/api/test", "GET", 500, 100);

      const metrics = collector.getMetrics();
      const endpoint = metrics.apiRequestsByEndpoint["/api/test"];
      expect(endpoint).toBeDefined();
      expect(endpoint!.requests).toBe(2);
      expect(endpoint!.errors).toBe(1);
    });
  });

  describe("recordWebSocketMessage", () => {
    it("should increment WebSocket message count", () => {
      recordWebSocketMessage();
      recordWebSocketMessage();
      recordWebSocketMessage();

      const metrics = collector.getMetrics();
      expect(metrics.websocketMessagesTotal).toBe(3);
    });
  });

  describe("recordWebSocketReconnect", () => {
    it("should increment WebSocket reconnect count", () => {
      recordWebSocketReconnect();
      recordWebSocketReconnect();

      const metrics = collector.getMetrics();
      expect(metrics.websocketReconnectsTotal).toBe(2);
    });
  });

  describe("setActiveSubscriptions", () => {
    it("should set active subscriptions count", () => {
      setActiveSubscriptions(5);

      const metrics = collector.getMetrics();
      expect(metrics.activeSubscriptions).toBe(5);
    });

    it("should overwrite previous value", () => {
      setActiveSubscriptions(5);
      setActiveSubscriptions(10);

      const metrics = collector.getMetrics();
      expect(metrics.activeSubscriptions).toBe(10);
    });
  });

  describe("incrementSubscriptions", () => {
    it("should increment subscription count", () => {
      setActiveSubscriptions(0);
      incrementSubscriptions();
      incrementSubscriptions();

      const metrics = collector.getMetrics();
      expect(metrics.activeSubscriptions).toBe(2);
    });
  });

  describe("decrementSubscriptions", () => {
    it("should decrement subscription count", () => {
      setActiveSubscriptions(5);
      decrementSubscriptions();
      decrementSubscriptions();

      const metrics = collector.getMetrics();
      expect(metrics.activeSubscriptions).toBe(3);
    });

    it("should not go below zero", () => {
      setActiveSubscriptions(0);
      decrementSubscriptions();
      decrementSubscriptions();

      const metrics = collector.getMetrics();
      expect(metrics.activeSubscriptions).toBe(0);
    });
  });
});

describe("Service Error Handling", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    collector.reset();
    resetStartupOrchestrator();
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  it("should handle missing trade stream service gracefully", () => {
    setStartupOrchestrator(createMockOrchestrator({ throwTradeStream: true }));

    const metrics = collector.getMetrics();
    // Should still return metrics with defaults
    expect(metrics.tradesProcessedTotal).toBe(0);
  });

  it("should handle missing alert generator service gracefully", () => {
    setStartupOrchestrator(createMockOrchestrator({ throwAlertGenerator: true }));

    const metrics = collector.getMetrics();
    expect(metrics.alertsGeneratedTotal).toBe(0);
  });

  it("should handle missing wallet profiler service gracefully", () => {
    setStartupOrchestrator(createMockOrchestrator({ throwWalletProfiler: true }));

    const metrics = collector.getMetrics();
    expect(metrics.walletsProfiledTotal).toBe(0);
  });

  it("should handle missing market sync service gracefully", () => {
    setStartupOrchestrator(createMockOrchestrator({ throwMarketSync: true }));

    const metrics = collector.getMetrics();
    expect(metrics.marketsSyncedTotal).toBe(0);
    expect(metrics.lastSyncAt).toBeNull();
  });

  it("should handle null sync stats gracefully", () => {
    setStartupOrchestrator(createMockOrchestrator({ marketSyncStats: null }));

    const metrics = collector.getMetrics();
    expect(metrics.marketsSyncedTotal).toBe(0);
    expect(metrics.lastSyncAt).toBeNull();
  });

  it("should handle no orchestrator set", () => {
    // Don't set any orchestrator
    resetStartupOrchestrator();

    const metrics = collector.getMetrics();
    // Should return defaults for service metrics
    expect(metrics.tradesProcessedTotal).toBe(0);
    expect(metrics.alertsGeneratedTotal).toBe(0);
    expect(metrics.walletsProfiledTotal).toBe(0);
    expect(metrics.marketsSyncedTotal).toBe(0);
    // But system metrics should still work
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(metrics.memoryUsageMb).toBeGreaterThan(0);
  });
});

describe("Timestamps", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    resetStartupOrchestrator();
    setStartupOrchestrator(createMockOrchestrator());
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  it("should include collection timestamp in ISO format", () => {
    const metrics = collector.getMetrics();

    expect(metrics.collectedAt).toBeDefined();
    expect(() => new Date(metrics.collectedAt)).not.toThrow();
  });

  it("should include startup timestamp", () => {
    const metrics = collector.getMetrics();

    expect(metrics.startedAt).toBeDefined();
    expect(() => new Date(metrics.startedAt)).not.toThrow();
  });

  it("should update collection timestamp on each call", () => {
    const metrics1 = collector.getMetrics();

    // Small delay
    const startTime = Date.now();
    while (Date.now() - startTime < 5) {
      // Wait a few ms
    }

    const metrics2 = collector.getMetrics();

    expect(new Date(metrics2.collectedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(metrics1.collectedAt).getTime()
    );
  });
});

describe("setStartupOrchestrator", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    collector.reset();
    resetStartupOrchestrator();
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  it("should allow setting custom orchestrator", () => {
    const customOrchestrator = createMockOrchestrator({
      tradeStreamStats: {
        totalProcessed: 5000,
        storedCount: 4900,
        errorCount: 100,
        whaleTradesCount: 50,
        newWalletsCount: 200,
        tradesPerSecond: 10,
      },
    });

    setStartupOrchestrator(customOrchestrator);
    const metrics = collector.getMetrics();

    expect(metrics.tradesProcessedTotal).toBe(5000);
    expect(metrics.tradesStoredTotal).toBe(4900);
  });

  it("should allow resetting orchestrator", () => {
    setStartupOrchestrator(createMockOrchestrator());
    resetStartupOrchestrator();

    const metrics = collector.getMetrics();
    expect(metrics.tradesProcessedTotal).toBe(0);
  });
});
