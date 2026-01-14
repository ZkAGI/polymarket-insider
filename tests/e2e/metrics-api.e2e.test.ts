/**
 * Metrics API E2E Tests (MONITOR-002)
 *
 * Tests the metrics endpoint behavior with mocked services.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  setStartupOrchestrator,
  resetStartupOrchestrator,
  recordApiRequest,
  recordWebSocketMessage,
  recordWebSocketReconnect,
  setActiveSubscriptions,
  metrics,
  type StartupOrchestratorInterface,
} from "../../src/utils/metrics";

// Create mock orchestrator for testing
function createMockOrchestrator(): StartupOrchestratorInterface {
  return {
    getTradeStreamService: () => ({
      getStats: () => ({
        totalProcessed: 2500,
        storedCount: 2400,
        errorCount: 100,
        whaleTradesCount: 75,
        newWalletsCount: 150,
        tradesPerSecond: 8.5,
      }),
    }),
    getAlertGeneratorService: () => ({
      getStats: () => ({
        totalGenerated: 200,
        broadcastCount: 180,
        suppressedCount: 20,
        byType: { whale_trade: 100, fresh_wallet: 60, volume_spike: 40 },
        bySeverity: { info: 20, low: 60, medium: 80, high: 30, critical: 10 },
      }),
    }),
    getWalletProfilerService: () => ({
      getStats: () => ({
        totalProfiled: 800,
        newWalletsProfiled: 300,
        highSuspicionCount: 25,
        freshWalletsCount: 80,
        cacheHits: 600,
        cacheMisses: 200,
      }),
    }),
    getMarketSyncService: () => ({
      getLastSyncStats: () => ({
        totalSynced: 450,
        newMarkets: 15,
        durationMs: 2500,
        syncedAt: "2026-01-14T12:00:00Z",
      }),
    }),
  };
}

// Import the route handler after mock setup
import { GET, type MetricsResponse } from "../../app/api/metrics/route";

describe("Metrics API E2E Tests", () => {
  beforeEach(() => {
    // Reset metrics state before each test
    metrics.reset();
    resetStartupOrchestrator();
    setStartupOrchestrator(createMockOrchestrator());
  });

  afterEach(() => {
    resetStartupOrchestrator();
  });

  describe("GET /api/metrics (JSON format)", () => {
    it("should return complete metrics in JSON format", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;

      // Response should be 200 OK
      expect(response.status).toBe(200);

      // Should have correct structure
      expect(data.status).toBe("ok");
      expect(data.format).toBe("json");
      expect(data.data).toBeDefined();
    });

    it("should return JSON format when explicitly requested", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=json"
      );
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;

      expect(response.status).toBe(200);
      expect(data.format).toBe("json");
    });

    it("should include trade stream metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.tradesProcessedTotal).toBe(2500);
      expect(metricsData.tradesStoredTotal).toBe(2400);
      expect(metricsData.tradesErrorTotal).toBe(100);
      expect(metricsData.whaleTradesTotal).toBe(75);
      expect(metricsData.newWalletsFromTradesTotal).toBe(150);
      expect(metricsData.tradesPerSecond).toBe(8.5);
    });

    it("should include alert metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.alertsGeneratedTotal).toBe(200);
      expect(metricsData.alertsBroadcastTotal).toBe(180);
      expect(metricsData.alertsSuppressedTotal).toBe(20);
      expect(metricsData.alertsByType).toEqual({
        whale_trade: 100,
        fresh_wallet: 60,
        volume_spike: 40,
      });
    });

    it("should include wallet profiler metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.walletsProfiledTotal).toBe(800);
      expect(metricsData.newWalletsProfiledTotal).toBe(300);
      expect(metricsData.highSuspicionWalletsTotal).toBe(25);
      expect(metricsData.freshWalletsTotal).toBe(80);
      expect(metricsData.walletCacheHits).toBe(600);
      expect(metricsData.walletCacheMisses).toBe(200);
    });

    it("should include market sync metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.marketsSyncedTotal).toBe(450);
      expect(metricsData.newMarketsTotal).toBe(15);
      expect(metricsData.marketSyncDurationMs).toBe(2500);
      expect(metricsData.lastSyncAt).toBe("2026-01-14T12:00:00Z");
    });

    it("should include system metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(metricsData.memoryUsageMb).toBeGreaterThan(0);
      expect(metricsData.heapUsedMb).toBeGreaterThan(0);
      expect(metricsData.heapTotalMb).toBeGreaterThan(0);
    });

    it("should include timestamps", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.collectedAt).toBeDefined();
      expect(metricsData.startedAt).toBeDefined();

      // Timestamps should be valid ISO strings
      expect(() => new Date(metricsData.collectedAt)).not.toThrow();
      expect(() => new Date(metricsData.startedAt)).not.toThrow();
    });
  });

  describe("GET /api/metrics (Prometheus format)", () => {
    it("should return Prometheus format when requested", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; version=0.0.4; charset=utf-8"
      );
      expect(typeof text).toBe("string");
    });

    it("should include HELP and TYPE comments in Prometheus output", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);
      const text = await response.text();

      expect(text).toContain("# HELP polymarket_trades_processed_total");
      expect(text).toContain("# TYPE polymarket_trades_processed_total counter");
    });

    it("should include all major metrics in Prometheus output", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);
      const text = await response.text();

      // Trade metrics
      expect(text).toContain("polymarket_trades_processed_total 2500");
      expect(text).toContain("polymarket_whale_trades_total 75");

      // Alert metrics
      expect(text).toContain("polymarket_alerts_generated_total 200");

      // Wallet metrics
      expect(text).toContain("polymarket_wallets_profiled_total 800");

      // Market sync metrics
      expect(text).toContain("polymarket_markets_synced_total 450");
    });

    it("should format labeled metrics correctly", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);
      const text = await response.text();

      // Should have properly formatted labels
      expect(text).toContain('type="whale_trade"');
      expect(text).toContain('type="fresh_wallet"');
      expect(text).toContain('type="volume_spike"');
    });
  });

  describe("API Request Metrics", () => {
    it("should track API requests in metrics", async () => {
      // Record some API requests
      recordApiRequest("/api/dashboard/stats", "GET", 200, 50);
      recordApiRequest("/api/dashboard/alerts", "GET", 200, 75);
      recordApiRequest("/api/dashboard/stats", "GET", 500, 100);

      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.apiRequestsTotal).toBe(3);
      expect(metricsData.apiErrorsTotal).toBe(1);
      expect(Object.keys(metricsData.apiRequestsByEndpoint)).toHaveLength(2);
    });

    it("should include endpoint-specific metrics", async () => {
      recordApiRequest("/api/test", "GET", 200, 50);
      recordApiRequest("/api/test", "GET", 200, 100);

      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      const endpoint = metricsData.apiRequestsByEndpoint["/api/test"];
      expect(endpoint).toBeDefined();
      expect(endpoint!.requests).toBe(2);
      expect(endpoint!.avgDurationMs).toBe(75);
    });
  });

  describe("WebSocket Metrics", () => {
    it("should track WebSocket metrics", async () => {
      recordWebSocketMessage();
      recordWebSocketMessage();
      recordWebSocketMessage();
      recordWebSocketReconnect();
      setActiveSubscriptions(5);

      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;
      const metricsData = data.data;

      expect(metricsData.websocketMessagesTotal).toBe(3);
      expect(metricsData.websocketReconnectsTotal).toBe(1);
      expect(metricsData.activeSubscriptions).toBe(5);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for invalid format parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=invalid"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid format");
    });

    it("should handle missing services gracefully", async () => {
      // Reset orchestrator to simulate missing services
      resetStartupOrchestrator();

      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);
      const data = (await response.json()) as MetricsResponse;

      // Should still return 200 with default values
      expect(response.status).toBe(200);
      expect(data.data.tradesProcessedTotal).toBe(0);
      expect(data.data.alertsGeneratedTotal).toBe(0);

      // System metrics should still work
      expect(data.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(data.data.memoryUsageMb).toBeGreaterThan(0);
    });
  });

  describe("Response Headers", () => {
    it("should set no-cache headers for JSON response", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    });

    it("should set no-cache headers for Prometheus response", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    });

    it("should set correct Content-Type for JSON response", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);

      expect(response.headers.get("Content-Type")).toContain("application/json");
    });

    it("should set Prometheus Content-Type for Prometheus response", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=prometheus"
      );
      const response = await GET(request);

      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; version=0.0.4; charset=utf-8"
      );
    });
  });

  describe("Case Insensitive Format Parameter", () => {
    it("should accept uppercase format parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=JSON"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should accept mixed case format parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/metrics?format=Prometheus"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; version=0.0.4; charset=utf-8"
      );
    });
  });
});
