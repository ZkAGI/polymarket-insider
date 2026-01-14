/**
 * Startup Orchestrator E2E Tests (STARTUP-001)
 *
 * Tests the startup orchestrator's ability to coordinate services
 * in a realistic environment with mocked external dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mock external dependencies that would require network/database
// ============================================================================

// Mock database to avoid real database connections
vi.mock("../../src/db/client", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
  performHealthCheck: vi.fn().mockResolvedValue({
    healthy: true,
    responseTimeMs: 5,
    timestamp: new Date(),
  }),
  startHealthChecks: vi.fn(),
  stopHealthChecks: vi.fn(),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));

// Mock WebSocket connections
vi.mock("../../src/api/ws/websocket-manager", () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
  })),
  createWebSocketManager: vi.fn(),
  getSharedWebSocketManager: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

// Mock the trade stream client to avoid WebSocket connection
vi.mock("../../src/api/ws/trade-stream", () => ({
  TradeStreamClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribeToken: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  })),
  createTradeStreamClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribeToken: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  })),
}));

// Mock Gamma API
vi.mock("../../src/api/gamma", () => ({
  getAllActiveMarkets: vi.fn().mockResolvedValue([]),
  gammaClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock telegram
vi.mock("../../src/telegram/bot", () => {
  const mockBot = {
    initialize: vi.fn().mockResolvedValue({ success: true, botInfo: { username: "test_bot" } }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue("stopped"),
    hasToken: vi.fn().mockReturnValue(false),
  };
  return {
    TelegramBotClient: vi.fn(() => mockBot),
    getTelegramBot: vi.fn(() => mockBot),
    createTelegramBot: vi.fn(() => mockBot),
  };
});

// Mock env
vi.mock("../../config/env", () => ({
  env: {
    NODE_ENV: "test",
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    TELEGRAM_BOT_TOKEN: undefined,
    WHALE_THRESHOLD_USD: 10000,
  },
  logConfig: vi.fn(),
}));

// Import after mocks
import {
  StartupOrchestrator,
  createStartupOrchestrator,
} from "../../src/services/startup";

import { performHealthCheck } from "../../src/db/client";

const mockPerformHealthCheck = vi.mocked(performHealthCheck);

// ============================================================================
// E2E Tests
// ============================================================================

describe("Startup Orchestrator E2E", () => {
  let orchestrator: StartupOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformHealthCheck.mockResolvedValue({
      healthy: true,
      responseTimeMs: 5,
      timestamp: new Date(),
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.dispose();
    }
    vi.clearAllMocks();
  });

  describe("Full Lifecycle", () => {
    it("should complete full startup and shutdown cycle", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      // Track events
      const events: string[] = [];
      orchestrator.on("startup:start", () => events.push("startup:start"));
      orchestrator.on("startup:complete", () => events.push("startup:complete"));
      orchestrator.on("shutdown:start", () => events.push("shutdown:start"));
      orchestrator.on("shutdown:complete", () => events.push("shutdown:complete"));

      // Start services
      const startStatus = await orchestrator.startAllServices();

      expect(startStatus.status).toBe("running");
      expect(startStatus.allRunning).toBe(true);
      expect(startStatus.hasErrors).toBe(false);
      expect(startStatus.databaseHealthy).toBe(true);
      expect(startStatus.startupCompletedAt).toBeInstanceOf(Date);
      expect(typeof startStatus.startupTimeMs).toBe("number");

      // Stop services
      await orchestrator.stopAllServices();

      const stopStatus = orchestrator.getStatus();
      expect(stopStatus.status).toBe("stopped");
      expect(stopStatus.allRunning).toBe(false);

      // Verify event order
      expect(events).toEqual([
        "startup:start",
        "startup:complete",
        "shutdown:start",
        "shutdown:complete",
      ]);
    });

    it("should track service states through lifecycle", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      // Initially all stopped
      let status = orchestrator.getStatus();
      expect(status.services.every((s) => s.status === "stopped")).toBe(true);

      // Start and verify running
      await orchestrator.startAllServices();
      status = orchestrator.getStatus();

      const enabledServices = ["database", "marketSync", "tradeStream", "walletProfiler", "alertGenerator"];
      for (const name of enabledServices) {
        const service = status.services.find((s) => s.name === name);
        expect(service?.status).toBe("running");
        expect(service?.startedAt).toBeInstanceOf(Date);
      }

      // Stop and verify stopped
      await orchestrator.stopAllServices();
      status = orchestrator.getStatus();
      expect(status.services.every((s) => s.status === "stopped")).toBe(true);
    });

    it("should measure startup time accurately", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      const startTime = Date.now();
      const status = await orchestrator.startAllServices();
      const elapsedTime = Date.now() - startTime;

      expect(status.startupTimeMs).toBeDefined();
      // Startup can be very fast (0ms) with mocks, so check >= 0
      expect(status.startupTimeMs).toBeGreaterThanOrEqual(0);
      expect(status.startupTimeMs).toBeLessThanOrEqual(elapsedTime + 10);
    });
  });

  describe("Service Startup Order", () => {
    it("should start services in dependency order", async () => {
      const startOrder: string[] = [];

      orchestrator = createStartupOrchestrator({
        logger: (_msg, data) => {
          if (data && typeof data === "object" && "message" in data) {
            return;
          }
          const msgLower = _msg.toLowerCase();
          if (msgLower.includes("starting") && !msgLower.includes("all services")) {
            const service = _msg.match(/starting (\w+)/i)?.[1];
            if (service) {
              startOrder.push(service);
            }
          }
        },
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      await orchestrator.startAllServices();

      // Database must be first (it's actually logged as "Connecting to database...")
      // Then services in order
      expect(startOrder).toContain("marketSync");
      expect(startOrder).toContain("tradeStream");
      expect(startOrder).toContain("walletProfiler");
      expect(startOrder).toContain("alertGenerator");

      // Verify order: marketSync before tradeStream before walletProfiler before alertGenerator
      const marketSyncIndex = startOrder.indexOf("marketSync");
      const tradeStreamIndex = startOrder.indexOf("tradeStream");
      const walletProfilerIndex = startOrder.indexOf("walletProfiler");
      const alertGeneratorIndex = startOrder.indexOf("alertGenerator");

      expect(marketSyncIndex).toBeLessThan(tradeStreamIndex);
      expect(tradeStreamIndex).toBeLessThan(walletProfilerIndex);
      expect(walletProfilerIndex).toBeLessThan(alertGeneratorIndex);
    });
  });

  describe("Error Handling", () => {
    it("should fail startup if database is unavailable", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection refused",
      });

      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      await expect(orchestrator.startAllServices()).rejects.toThrow(
        "Critical: Database connection failed"
      );

      const status = orchestrator.getStatus();
      expect(status.databaseHealthy).toBe(false);
      expect(status.hasErrors).toBe(true);
    });

    it("should emit error events for failed services", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 100,
        timestamp: new Date(),
        error: "Connection timeout",
      });

      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      const errors: { service: string; error: Error }[] = [];
      orchestrator.on("startup:error", (e) => errors.push(e));

      await expect(orchestrator.startAllServices()).rejects.toThrow();

      expect(errors.length).toBeGreaterThan(0);
      const firstError = errors[0];
      expect(firstError).toBeDefined();
      expect(firstError!.service).toBe("database");
      expect(firstError!.error).toBeInstanceOf(Error);
    });
  });

  describe("Partial Service Configuration", () => {
    it("should only start enabled services", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        enableMarketSync: true,
        enableTradeStream: false,
        enableWalletProfiler: false,
        enableAlertGenerator: false,
        logConfiguration: false,
      });

      const startedServices: string[] = [];
      orchestrator.on("service:started", ({ service }) => startedServices.push(service));

      await orchestrator.startAllServices();

      expect(startedServices).toContain("database");
      expect(startedServices).toContain("marketSync");
      expect(startedServices).not.toContain("tradeStream");
      expect(startedServices).not.toContain("walletProfiler");
      expect(startedServices).not.toContain("alertGenerator");
    });

    it("should only stop enabled services", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        enableMarketSync: true,
        enableTradeStream: false,
        enableWalletProfiler: false,
        enableAlertGenerator: false,
        logConfiguration: false,
      });

      await orchestrator.startAllServices();

      const stoppedServices: string[] = [];
      orchestrator.on("service:stopped", ({ service }) => stoppedServices.push(service));

      await orchestrator.stopAllServices();

      expect(stoppedServices).toContain("database");
      expect(stoppedServices).toContain("marketSync");
      expect(stoppedServices).not.toContain("tradeStream");
      expect(stoppedServices).not.toContain("walletProfiler");
      expect(stoppedServices).not.toContain("alertGenerator");
    });
  });

  describe("Status Reporting", () => {
    it("should provide accurate status at all times", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      // Before start
      let status = orchestrator.getStatus();
      expect(status.status).toBe("stopped");
      expect(orchestrator.isAllRunning()).toBe(false);
      expect(orchestrator.hasErrors()).toBe(false);

      // During start - we can't easily test this without async hooks

      // After start
      await orchestrator.startAllServices();
      status = orchestrator.getStatus();
      expect(status.status).toBe("running");
      expect(orchestrator.isAllRunning()).toBe(true);
      expect(orchestrator.hasErrors()).toBe(false);

      // After stop
      await orchestrator.stopAllServices();
      status = orchestrator.getStatus();
      expect(status.status).toBe("stopped");
      expect(orchestrator.isAllRunning()).toBe(false);
    });

    it("should provide individual service status", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      await orchestrator.startAllServices();

      const dbStatus = orchestrator.getServiceStatus("database");
      expect(dbStatus).toBeDefined();
      expect(dbStatus?.status).toBe("running");
      expect(dbStatus?.startedAt).toBeInstanceOf(Date);
      expect(dbStatus?.error).toBeNull();

      const unknownStatus = orchestrator.getServiceStatus("unknown");
      expect(unknownStatus).toBeUndefined();
    });
  });

  describe("Graceful Shutdown", () => {
    it("should register process signal handlers", () => {
      const processSpy = vi.spyOn(process, "on");

      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      orchestrator.setupGracefulShutdown();

      expect(processSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

      processSpy.mockRestore();
    });
  });

  describe("Service Access", () => {
    it("should provide access to individual services", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      expect(orchestrator.getMarketSyncService()).toBeDefined();
      expect(orchestrator.getTradeStreamService()).toBeDefined();
      expect(orchestrator.getWalletProfilerService()).toBeDefined();
      expect(orchestrator.getAlertGeneratorService()).toBeDefined();
      expect(orchestrator.getTelegramBot()).toBeDefined();
    });
  });

  describe("Resource Cleanup", () => {
    it("should clean up resources on dispose", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      await orchestrator.startAllServices();

      const removeListenersSpy = vi.spyOn(orchestrator, "removeAllListeners");

      await orchestrator.dispose();

      expect(removeListenersSpy).toHaveBeenCalled();
      expect(orchestrator.getStatus().status).toBe("stopped");
    });
  });

  describe("Idempotency", () => {
    it("should handle multiple start calls gracefully", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      // First start
      await orchestrator.startAllServices();
      expect(orchestrator.isAllRunning()).toBe(true);

      // Second start should not change anything
      const status2 = await orchestrator.startAllServices();
      expect(status2.status).toBe("running");
      expect(orchestrator.isAllRunning()).toBe(true);
    });

    it("should handle multiple stop calls gracefully", async () => {
      orchestrator = createStartupOrchestrator({
        logger: vi.fn(),
        enableDbHealthChecks: false,
        enableTelegramBot: false,
        logConfiguration: false,
      });

      await orchestrator.startAllServices();

      // First stop
      await orchestrator.stopAllServices();
      expect(orchestrator.getStatus().status).toBe("stopped");

      // Second stop should not throw
      await orchestrator.stopAllServices();
      expect(orchestrator.getStatus().status).toBe("stopped");
    });
  });
});
