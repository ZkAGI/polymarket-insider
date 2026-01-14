/**
 * Health Check API Tests (STARTUP-002)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock database client
vi.mock("../../../src/db/client", () => ({
  prisma: {},
  performHealthCheck: vi.fn().mockResolvedValue({
    healthy: true,
    responseTimeMs: 5,
    timestamp: new Date(),
  }),
}));

// Mock startup orchestrator with mock services
const mockMarketSyncService = {
  getIsRunning: vi.fn().mockReturnValue(true),
  getLastSyncStats: vi.fn().mockReturnValue({
    syncedAt: new Date().toISOString(),
    totalSynced: 100,
    newMarkets: 5,
  }),
};

const mockTradeStreamService = {
  getIsRunning: vi.fn().mockReturnValue(true),
  getStats: vi.fn().mockReturnValue({
    totalProcessed: 500,
    whaleTradesCount: 10,
    errorCount: 0,
    startedAt: new Date(),
  }),
};

const mockWalletProfilerService = {
  getIsRunning: vi.fn().mockReturnValue(true),
  getStats: vi.fn().mockReturnValue({
    totalProfiled: 50,
    newWalletsProfiled: 10,
    highSuspicionCount: 2,
  }),
};

const mockAlertGeneratorService = {
  getIsRunning: vi.fn().mockReturnValue(true),
  getStats: vi.fn().mockReturnValue({
    totalGenerated: 25,
    broadcastCount: 20,
    suppressedCount: 5,
  }),
};

const mockTelegramBot = {
  getStatus: vi.fn().mockReturnValue("running"),
  hasToken: vi.fn().mockReturnValue(true),
};

vi.mock("../../../src/services/startup", () => ({
  startupOrchestrator: {
    getMarketSyncService: () => mockMarketSyncService,
    getTradeStreamService: () => mockTradeStreamService,
    getWalletProfilerService: () => mockWalletProfilerService,
    getAlertGeneratorService: () => mockAlertGeneratorService,
    getTelegramBot: () => mockTelegramBot,
    getStatus: vi.fn().mockReturnValue({
      allRunning: true,
      hasErrors: false,
      status: "running",
      startupTimeMs: 1500,
      startupCompletedAt: new Date(),
      services: [],
    }),
  },
}));

// Mock env
vi.mock("../../../config/env", () => ({
  env: {
    NODE_ENV: "test",
  },
}));

import { GET, type HealthCheckResponse, type ServiceHealth } from "../../../app/api/health/route";
import { performHealthCheck } from "../../../src/db/client";
import { startupOrchestrator } from "../../../src/services/startup";

const mockPerformHealthCheck = vi.mocked(performHealthCheck);

describe("Health Check API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mocks
    mockPerformHealthCheck.mockResolvedValue({
      healthy: true,
      responseTimeMs: 5,
      timestamp: new Date(),
    });

    mockMarketSyncService.getIsRunning.mockReturnValue(true);
    mockMarketSyncService.getLastSyncStats.mockReturnValue({
      syncedAt: new Date().toISOString(),
      totalSynced: 100,
      newMarkets: 5,
    });

    mockTradeStreamService.getIsRunning.mockReturnValue(true);
    mockTradeStreamService.getStats.mockReturnValue({
      totalProcessed: 500,
      whaleTradesCount: 10,
      errorCount: 0,
      startedAt: new Date(),
    });

    mockWalletProfilerService.getIsRunning.mockReturnValue(true);
    mockWalletProfilerService.getStats.mockReturnValue({
      totalProfiled: 50,
      newWalletsProfiled: 10,
      highSuspicionCount: 2,
    });

    mockAlertGeneratorService.getIsRunning.mockReturnValue(true);
    mockAlertGeneratorService.getStats.mockReturnValue({
      totalGenerated: 25,
      broadcastCount: 20,
      suppressedCount: 5,
    });

    mockTelegramBot.getStatus.mockReturnValue("running");
    mockTelegramBot.hasToken.mockReturnValue(true);

    vi.mocked(startupOrchestrator.getStatus).mockReturnValue({
      allRunning: true,
      hasErrors: false,
      status: "running",
      startupTimeMs: 1500,
      startupCompletedAt: new Date(),
      services: [],
      databaseHealthy: true,
    });
  });

  const createRequest = (url = "http://localhost:3000/api/health") =>
    new NextRequest(url);

  describe("GET /api/health", () => {
    it("should return healthy status when all services are running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(response.status).toBe(200);
      expect(data.status).toBe("healthy");
      expect(data.environment).toBe("test");
      expect(typeof data.uptimeSeconds).toBe("number");
      expect(data.services).toBeInstanceOf(Array);
      expect(data.services.length).toBeGreaterThan(0);
    });

    it("should include all expected services", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const serviceNames = data.services.map((s: ServiceHealth) => s.name);
      expect(serviceNames).toContain("database");
      expect(serviceNames).toContain("websocket");
      expect(serviceNames).toContain("telegram");
      expect(serviceNames).toContain("marketSync");
      expect(serviceNames).toContain("walletProfiler");
      expect(serviceNames).toContain("alertGenerator");
      expect(serviceNames).toContain("orchestrator");
    });

    it("should return summary counts", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(data.summary).toBeDefined();
      expect(typeof data.summary.healthy).toBe("number");
      expect(typeof data.summary.degraded).toBe("number");
      expect(typeof data.summary.unhealthy).toBe("number");
      expect(typeof data.summary.disabled).toBe("number");
      expect(typeof data.summary.total).toBe("number");
      expect(data.summary.total).toBe(data.services.length);
    });

    it("should include timestamp and version", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).toString()).not.toBe("Invalid Date");
      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe("string");
    });

    it("should set Cache-Control header to no-store", async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    });
  });

  describe("GET /api/health?simple=true", () => {
    it("should return simple status response", async () => {
      const request = createRequest("http://localhost:3000/api/health?simple=true");
      const response = await GET(request);
      const data = (await response.json()) as { status: string };

      expect(response.status).toBe(200);
      expect(data.status).toBe("healthy");
      expect(Object.keys(data)).toEqual(["status"]);
    });

    it("should return 503 when unhealthy in simple mode", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection refused",
      });

      const request = createRequest("http://localhost:3000/api/health?simple=true");
      const response = await GET(request);
      const data = (await response.json()) as { status: string };

      expect(response.status).toBe(503);
      expect(data.status).toBe("unhealthy");
    });
  });

  describe("Database health check", () => {
    it("should return healthy when database is connected", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const dbHealth = data.services.find((s: ServiceHealth) => s.name === "database");
      expect(dbHealth?.status).toBe("healthy");
      expect(dbHealth?.message).toContain("PostgreSQL");
      expect(dbHealth?.responseTimeMs).toBeDefined();
    });

    it("should return unhealthy when database fails", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection refused",
      });

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(response.status).toBe(503);
      expect(data.status).toBe("unhealthy");

      const dbHealth = data.services.find((s: ServiceHealth) => s.name === "database");
      expect(dbHealth?.status).toBe("unhealthy");
      expect(dbHealth?.message).toContain("Connection refused");
    });

    it("should handle database check exception", async () => {
      mockPerformHealthCheck.mockRejectedValue(new Error("Database error"));

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const dbHealth = data.services.find((s: ServiceHealth) => s.name === "database");
      expect(dbHealth?.status).toBe("unhealthy");
      expect(dbHealth?.message).toBe("Database error");
    });
  });

  describe("WebSocket health check", () => {
    it("should return healthy when trade stream is running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const wsHealth = data.services.find((s: ServiceHealth) => s.name === "websocket");
      expect(wsHealth?.status).toBe("healthy");
      expect(wsHealth?.metadata?.totalProcessed).toBe(500);
    });

    it("should return disabled when trade stream is not running", async () => {
      mockTradeStreamService.getIsRunning.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const wsHealth = data.services.find((s: ServiceHealth) => s.name === "websocket");
      expect(wsHealth?.status).toBe("disabled");
    });

    it("should return degraded when no trades processed yet", async () => {
      mockTradeStreamService.getStats.mockReturnValue({
        totalProcessed: 0,
        whaleTradesCount: 0,
        errorCount: 0,
        startedAt: null,
      });

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const wsHealth = data.services.find((s: ServiceHealth) => s.name === "websocket");
      expect(wsHealth?.status).toBe("degraded");
    });
  });

  describe("Telegram health check", () => {
    it("should return healthy when bot is running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const tgHealth = data.services.find((s: ServiceHealth) => s.name === "telegram");
      expect(tgHealth?.status).toBe("healthy");
    });

    it("should return disabled when no token configured", async () => {
      mockTelegramBot.hasToken.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const tgHealth = data.services.find((s: ServiceHealth) => s.name === "telegram");
      expect(tgHealth?.status).toBe("disabled");
      expect(tgHealth?.message).toContain("not configured");
    });

    it("should return degraded when bot is stopped", async () => {
      mockTelegramBot.getStatus.mockReturnValue("stopped");

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const tgHealth = data.services.find((s: ServiceHealth) => s.name === "telegram");
      expect(tgHealth?.status).toBe("degraded");
    });

    it("should return unhealthy when bot is in error state", async () => {
      mockTelegramBot.getStatus.mockReturnValue("error");

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const tgHealth = data.services.find((s: ServiceHealth) => s.name === "telegram");
      expect(tgHealth?.status).toBe("unhealthy");
    });
  });

  describe("Market sync health check", () => {
    it("should return healthy when recently synced", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const syncHealth = data.services.find((s: ServiceHealth) => s.name === "marketSync");
      expect(syncHealth?.status).toBe("healthy");
      expect(syncHealth?.metadata?.totalSynced).toBe(100);
    });

    it("should return degraded when sync is stale", async () => {
      const oldSync = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 mins ago
      mockMarketSyncService.getLastSyncStats.mockReturnValue({
        syncedAt: oldSync,
        totalSynced: 100,
        newMarkets: 0,
      });

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const syncHealth = data.services.find((s: ServiceHealth) => s.name === "marketSync");
      expect(syncHealth?.status).toBe("degraded");
      expect(syncHealth?.message).toContain("10 minutes");
    });

    it("should return disabled when service not running", async () => {
      mockMarketSyncService.getIsRunning.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const syncHealth = data.services.find((s: ServiceHealth) => s.name === "marketSync");
      expect(syncHealth?.status).toBe("disabled");
    });
  });

  describe("Wallet profiler health check", () => {
    it("should return healthy when service is running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const profilerHealth = data.services.find((s: ServiceHealth) => s.name === "walletProfiler");
      expect(profilerHealth?.status).toBe("healthy");
      expect(profilerHealth?.metadata?.totalProfiled).toBe(50);
    });

    it("should return disabled when service not running", async () => {
      mockWalletProfilerService.getIsRunning.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const profilerHealth = data.services.find((s: ServiceHealth) => s.name === "walletProfiler");
      expect(profilerHealth?.status).toBe("disabled");
    });
  });

  describe("Alert generator health check", () => {
    it("should return healthy when service is running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const alertHealth = data.services.find((s: ServiceHealth) => s.name === "alertGenerator");
      expect(alertHealth?.status).toBe("healthy");
      expect(alertHealth?.metadata?.totalGenerated).toBe(25);
    });

    it("should return disabled when service not running", async () => {
      mockAlertGeneratorService.getIsRunning.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const alertHealth = data.services.find((s: ServiceHealth) => s.name === "alertGenerator");
      expect(alertHealth?.status).toBe("disabled");
    });
  });

  describe("Orchestrator health check", () => {
    it("should return healthy when all services running", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const orchHealth = data.services.find((s: ServiceHealth) => s.name === "orchestrator");
      expect(orchHealth?.status).toBe("healthy");
      expect(orchHealth?.metadata?.startupTimeMs).toBe(1500);
    });

    it("should return degraded when some services have errors", async () => {
      vi.mocked(startupOrchestrator.getStatus).mockReturnValue({
        allRunning: false,
        hasErrors: true,
        status: "partial",
        startupTimeMs: 1500,
        startupCompletedAt: new Date(),
        services: [
          { name: "database", status: "running", startedAt: new Date(), error: null },
          { name: "marketSync", status: "error", startedAt: null, error: "Failed" },
        ],
        databaseHealthy: true,
      });

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      const orchHealth = data.services.find((s: ServiceHealth) => s.name === "orchestrator");
      expect(orchHealth?.status).toBe("degraded");
    });
  });

  describe("Overall status calculation", () => {
    it("should be healthy when all services are healthy", async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(data.status).toBe("healthy");
      expect(response.status).toBe(200);
    });

    it("should be degraded when some services are degraded", async () => {
      mockTelegramBot.getStatus.mockReturnValue("stopped");

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(data.status).toBe("degraded");
      expect(response.status).toBe(200); // 200 for degraded
    });

    it("should be unhealthy when any service is unhealthy", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection failed",
      });

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      expect(data.status).toBe("unhealthy");
      expect(response.status).toBe(503);
    });

    it("should ignore disabled services in status calculation", async () => {
      // Disable non-critical services
      mockTradeStreamService.getIsRunning.mockReturnValue(false);
      mockWalletProfilerService.getIsRunning.mockReturnValue(false);
      mockAlertGeneratorService.getIsRunning.mockReturnValue(false);
      mockMarketSyncService.getIsRunning.mockReturnValue(false);
      mockTelegramBot.hasToken.mockReturnValue(false);

      const request = createRequest();
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Should still be healthy if database and orchestrator are healthy
      expect(data.status).toBe("healthy");
      expect(data.summary.disabled).toBeGreaterThan(0);
    });
  });
});
