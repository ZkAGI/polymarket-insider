/**
 * Health Check API E2E Tests (STARTUP-002)
 *
 * Tests the health check endpoint behavior with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock database client
vi.mock("../../src/db/client", () => ({
  prisma: {},
  performHealthCheck: vi.fn().mockResolvedValue({
    healthy: true,
    responseTimeMs: 5,
    timestamp: new Date(),
  }),
}));

// Mock services
const mockServices = {
  marketSync: {
    getIsRunning: vi.fn().mockReturnValue(true),
    getLastSyncStats: vi.fn().mockReturnValue({
      syncedAt: new Date().toISOString(),
      totalSynced: 100,
      newMarkets: 5,
    }),
  },
  tradeStream: {
    getIsRunning: vi.fn().mockReturnValue(true),
    getStats: vi.fn().mockReturnValue({
      totalProcessed: 500,
      whaleTradesCount: 10,
      errorCount: 0,
      startedAt: new Date(),
    }),
  },
  walletProfiler: {
    getIsRunning: vi.fn().mockReturnValue(true),
    getStats: vi.fn().mockReturnValue({
      totalProfiled: 50,
      newWalletsProfiled: 10,
      highSuspicionCount: 2,
    }),
  },
  alertGenerator: {
    getIsRunning: vi.fn().mockReturnValue(true),
    getStats: vi.fn().mockReturnValue({
      totalGenerated: 25,
      broadcastCount: 20,
      suppressedCount: 5,
    }),
  },
  telegramBot: {
    getStatus: vi.fn().mockReturnValue("running"),
    hasToken: vi.fn().mockReturnValue(true),
  },
};

vi.mock("../../src/services/startup", () => ({
  startupOrchestrator: {
    getMarketSyncService: () => mockServices.marketSync,
    getTradeStreamService: () => mockServices.tradeStream,
    getWalletProfilerService: () => mockServices.walletProfiler,
    getAlertGeneratorService: () => mockServices.alertGenerator,
    getTelegramBot: () => mockServices.telegramBot,
    getStatus: vi.fn().mockReturnValue({
      allRunning: true,
      hasErrors: false,
      status: "running",
      startupTimeMs: 1500,
      startupCompletedAt: new Date(),
      services: [],
      databaseHealthy: true,
    }),
  },
}));

vi.mock("../../config/env", () => ({
  env: {
    NODE_ENV: "test",
  },
}));

import { GET, type HealthCheckResponse } from "../../app/api/health/route";
import { performHealthCheck } from "../../src/db/client";
import { startupOrchestrator } from "../../src/services/startup";

const mockPerformHealthCheck = vi.mocked(performHealthCheck);

describe("Health API E2E Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mocks to healthy state
    mockPerformHealthCheck.mockResolvedValue({
      healthy: true,
      responseTimeMs: 5,
      timestamp: new Date(),
    });

    mockServices.marketSync.getIsRunning.mockReturnValue(true);
    mockServices.marketSync.getLastSyncStats.mockReturnValue({
      syncedAt: new Date().toISOString(),
      totalSynced: 100,
      newMarkets: 5,
    });

    mockServices.tradeStream.getIsRunning.mockReturnValue(true);
    mockServices.tradeStream.getStats.mockReturnValue({
      totalProcessed: 500,
      whaleTradesCount: 10,
      errorCount: 0,
      startedAt: new Date(),
    });

    mockServices.walletProfiler.getIsRunning.mockReturnValue(true);
    mockServices.alertGenerator.getIsRunning.mockReturnValue(true);
    mockServices.telegramBot.hasToken.mockReturnValue(true);
    mockServices.telegramBot.getStatus.mockReturnValue("running");

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

  describe("Full Health Check Flow", () => {
    it("should return complete health status with all services", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Response should be 200 OK
      expect(response.status).toBe(200);

      // Should have correct structure
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("version");
      expect(data).toHaveProperty("environment");
      expect(data).toHaveProperty("uptimeSeconds");
      expect(data).toHaveProperty("services");
      expect(data).toHaveProperty("summary");

      // Status should be healthy
      expect(data.status).toBe("healthy");

      // Should have 7 services
      expect(data.services).toHaveLength(7);

      // Summary should be accurate
      expect(data.summary.total).toBe(7);
      expect(data.summary.healthy).toBeGreaterThan(0);
    });

    it("should correctly identify service health states", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Check each service has expected properties
      for (const service of data.services) {
        expect(service).toHaveProperty("name");
        expect(service).toHaveProperty("status");
        expect(service).toHaveProperty("lastCheck");
        expect(["healthy", "degraded", "unhealthy", "disabled"]).toContain(
          service.status
        );
      }
    });
  });

  describe("Simple Health Check Flow", () => {
    it("should return minimal response for load balancer checks", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/health?simple=true"
      );
      const response = await GET(request);
      const data = await response.json();

      // Response should be 200 OK
      expect(response.status).toBe(200);

      // Should only have status field
      expect(Object.keys(data)).toEqual(["status"]);
      expect(data.status).toBe("healthy");
    });
  });

  describe("Error Handling Flow", () => {
    it("should handle database failure gracefully", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection refused",
      });

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Response should be 503 Service Unavailable
      expect(response.status).toBe(503);

      // Overall status should be unhealthy
      expect(data.status).toBe("unhealthy");

      // Database service should show error
      const dbService = data.services.find((s) => s.name === "database");
      expect(dbService?.status).toBe("unhealthy");
      expect(dbService?.message).toContain("Connection refused");
    });

    it("should handle service exceptions gracefully", async () => {
      // Make database check throw an exception
      mockPerformHealthCheck.mockRejectedValue(new Error("Network timeout"));

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Should still return a response
      expect(response.status).toBe(503);

      // Database should be unhealthy with error message
      const dbService = data.services.find((s) => s.name === "database");
      expect(dbService?.status).toBe("unhealthy");
      expect(dbService?.message).toBe("Network timeout");
    });
  });

  describe("Partial Failure Scenarios", () => {
    it("should handle mixed service states", async () => {
      // Make some services unhealthy
      mockServices.tradeStream.getIsRunning.mockReturnValue(false);
      mockServices.telegramBot.hasToken.mockReturnValue(false);

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Should still be healthy overall (disabled services don't count)
      expect(data.status).toBe("healthy");
      expect(data.summary.disabled).toBeGreaterThan(0);
    });

    it("should report degraded when non-critical services fail", async () => {
      // Make telegram bot report stopped
      mockServices.telegramBot.getStatus.mockReturnValue("stopped");

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Should be degraded
      expect(data.status).toBe("degraded");
      expect(data.summary.degraded).toBeGreaterThan(0);
    });
  });

  describe("Uptime Tracking", () => {
    it("should report accurate uptime", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);
      const data = (await response.json()) as HealthCheckResponse;

      // Uptime should be a non-negative number
      expect(typeof data.uptimeSeconds).toBe("number");
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Response Headers", () => {
    it("should set no-cache headers", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);

      // Health checks should not be cached
      expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    });
  });

  describe("HTTP Status Codes", () => {
    it("should return 200 for healthy status", async () => {
      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should return 200 for degraded status", async () => {
      mockServices.telegramBot.getStatus.mockReturnValue("stopped");

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should return 503 for unhealthy status", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Database down",
      });

      const request = new NextRequest("http://localhost:3000/api/health");
      const response = await GET(request);

      expect(response.status).toBe(503);
    });
  });
});
