/**
 * Startup Orchestrator Service Tests (STARTUP-001)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// ============================================================================
// Mocks - must be defined before vi.mock calls that use them
// ============================================================================

// Mock database client
vi.mock("../../src/db/client", () => ({
  prisma: {},
  performHealthCheck: vi.fn().mockResolvedValue({
    healthy: true,
    responseTimeMs: 10,
    timestamp: new Date(),
  }),
  startHealthChecks: vi.fn(),
  stopHealthChecks: vi.fn(),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));

// Mock market sync service - use factory pattern with inline mocks
vi.mock("../../src/services/market-sync", () => {
  const mock = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getIsRunning: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    MarketSyncService: vi.fn(() => mock),
    marketSyncService: mock,
    createMarketSyncService: vi.fn(() => mock),
  };
});

// Mock trade stream service
vi.mock("../../src/services/trade-stream", () => {
  const mock = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getIsRunning: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    TradeStreamService: vi.fn(() => mock),
    tradeStreamService: mock,
    createTradeStreamService: vi.fn(() => mock),
  };
});

// Mock wallet profiler service
vi.mock("../../src/services/wallet-profiler", () => {
  const mock = {
    start: vi.fn(),
    stop: vi.fn(),
    getIsRunning: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    WalletProfilerService: vi.fn(() => mock),
    walletProfilerService: mock,
    createWalletProfilerService: vi.fn(() => mock),
  };
});

// Mock alert generator service
vi.mock("../../src/services/alert-generator", () => {
  const mock = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getIsRunning: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    AlertGeneratorService: vi.fn(() => mock),
    alertGeneratorService: mock,
    createAlertGeneratorService: vi.fn(() => mock),
  };
});

// Mock telegram bot
vi.mock("../../src/telegram/bot", () => {
  const mock = {
    initialize: vi.fn().mockResolvedValue({ success: true, botInfo: { username: "test_bot" } }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue("stopped"),
    hasToken: vi.fn().mockReturnValue(true),
  };
  return {
    TelegramBotClient: vi.fn(() => mock),
    getTelegramBot: vi.fn(() => mock),
    createTelegramBot: vi.fn(() => mock),
  };
});

// Mock env config
vi.mock("../../config/env", () => ({
  env: {
    NODE_ENV: "test",
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    TELEGRAM_BOT_TOKEN: "test-token",
  },
  logConfig: vi.fn(),
}));

// Import after mocks are set up
import {
  StartupOrchestrator,
  createStartupOrchestrator,
  type StartupConfig,
} from "../../src/services/startup";

import {
  performHealthCheck,
  startHealthChecks,
  stopHealthChecks,
  disconnectPrisma,
} from "../../src/db/client";

import { marketSyncService } from "../../src/services/market-sync";
import { tradeStreamService } from "../../src/services/trade-stream";
import { walletProfilerService } from "../../src/services/wallet-profiler";
import { alertGeneratorService } from "../../src/services/alert-generator";
import { getTelegramBot } from "../../src/telegram/bot";

const mockPerformHealthCheck = vi.mocked(performHealthCheck);
const mockStartHealthChecks = vi.mocked(startHealthChecks);
const mockStopHealthChecks = vi.mocked(stopHealthChecks);
const mockDisconnectPrisma = vi.mocked(disconnectPrisma);

// Get references to the mocked services
const mockMarketSyncService = marketSyncService as unknown as {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getIsRunning: ReturnType<typeof vi.fn>;
};
const mockTradeStreamService = tradeStreamService as unknown as {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getIsRunning: ReturnType<typeof vi.fn>;
};
const mockWalletProfilerService = walletProfilerService as unknown as {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getIsRunning: ReturnType<typeof vi.fn>;
};
const mockAlertGeneratorService = alertGeneratorService as unknown as {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getIsRunning: ReturnType<typeof vi.fn>;
};
const mockTelegramBot = getTelegramBot() as unknown as {
  initialize: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
  hasToken: ReturnType<typeof vi.fn>;
};

// ============================================================================
// Tests
// ============================================================================

describe("StartupOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations to defaults
    mockPerformHealthCheck.mockResolvedValue({
      healthy: true,
      responseTimeMs: 10,
      timestamp: new Date(),
    });

    // Reset service mock implementations
    mockMarketSyncService.start.mockResolvedValue(undefined);
    mockMarketSyncService.stop.mockImplementation(() => {});
    mockMarketSyncService.getIsRunning.mockReturnValue(false);

    mockTradeStreamService.start.mockResolvedValue(undefined);
    mockTradeStreamService.stop.mockImplementation(() => {});
    mockTradeStreamService.getIsRunning.mockReturnValue(false);

    mockWalletProfilerService.start.mockImplementation(() => {});
    mockWalletProfilerService.stop.mockImplementation(() => {});
    mockWalletProfilerService.getIsRunning.mockReturnValue(false);

    mockAlertGeneratorService.start.mockResolvedValue(undefined);
    mockAlertGeneratorService.stop.mockImplementation(() => {});
    mockAlertGeneratorService.getIsRunning.mockReturnValue(false);

    mockTelegramBot.initialize.mockResolvedValue({ success: true, botInfo: { username: "test_bot" } });
    mockTelegramBot.start.mockResolvedValue(undefined);
    mockTelegramBot.stop.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createTestOrchestrator = (config: Partial<StartupConfig> = {}): StartupOrchestrator => {
    return createStartupOrchestrator({
      logger: vi.fn(),
      enableDbHealthChecks: false,
      logConfiguration: false,
      ...config,
    });
  };

  describe("constructor", () => {
    it("should create orchestrator with default config", () => {
      const orchestrator = new StartupOrchestrator({
        logger: vi.fn(),
      });
      expect(orchestrator).toBeInstanceOf(StartupOrchestrator);
      expect(orchestrator.getStatus().status).toBe("stopped");
    });

    it("should create orchestrator with custom config", () => {
      const orchestrator = createTestOrchestrator({
        enableMarketSync: false,
        enableTradeStream: false,
        enableWalletProfiler: false,
        enableAlertGenerator: false,
        enableTelegramBot: false,
      });
      expect(orchestrator).toBeInstanceOf(StartupOrchestrator);
    });

    it("should use EventEmitter for events", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator).toBeInstanceOf(EventEmitter);
    });
  });

  describe("startAllServices", () => {
    it("should start all services successfully", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const status = await orchestrator.startAllServices();

      expect(status.status).toBe("running");
      expect(status.allRunning).toBe(true);
      expect(status.hasErrors).toBe(false);
      expect(status.startupCompletedAt).toBeInstanceOf(Date);
      expect(typeof status.startupTimeMs).toBe("number");
    });

    it("should emit startup:start event", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const handler = vi.fn();
      orchestrator.on("startup:start", handler);

      await orchestrator.startAllServices();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit startup:complete event", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const handler = vi.fn();
      orchestrator.on("startup:complete", handler);

      await orchestrator.startAllServices();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.objectContaining({
            status: "running",
          }),
          timeMs: expect.any(Number),
        })
      );
    });

    it("should emit service:started events for each service", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const handler = vi.fn();
      orchestrator.on("service:started", handler);

      await orchestrator.startAllServices();

      // database + marketSync + tradeStream + walletProfiler + alertGenerator = 5
      expect(handler).toHaveBeenCalledTimes(5);
      expect(handler).toHaveBeenCalledWith({ service: "database" });
      expect(handler).toHaveBeenCalledWith({ service: "marketSync" });
      expect(handler).toHaveBeenCalledWith({ service: "tradeStream" });
      expect(handler).toHaveBeenCalledWith({ service: "walletProfiler" });
      expect(handler).toHaveBeenCalledWith({ service: "alertGenerator" });
    });

    it("should start services in correct order", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const callOrder: string[] = [];

      mockPerformHealthCheck.mockImplementation(async () => {
        callOrder.push("database");
        return { healthy: true, responseTimeMs: 10, timestamp: new Date() };
      });

      mockMarketSyncService.start.mockImplementation(async () => {
        callOrder.push("marketSync");
      });

      mockTradeStreamService.start.mockImplementation(async () => {
        callOrder.push("tradeStream");
      });

      mockWalletProfilerService.start.mockImplementation(() => {
        callOrder.push("walletProfiler");
      });

      mockAlertGeneratorService.start.mockImplementation(async () => {
        callOrder.push("alertGenerator");
      });

      await orchestrator.startAllServices();

      expect(callOrder).toEqual([
        "database",
        "marketSync",
        "tradeStream",
        "walletProfiler",
        "alertGenerator",
      ]);
    });

    it("should fail if database connection fails", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 10,
        timestamp: new Date(),
        error: "Connection refused",
      });

      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await expect(orchestrator.startAllServices()).rejects.toThrow(
        "Critical: Database connection failed"
      );

      const status = orchestrator.getStatus();
      expect(status.hasErrors).toBe(true);
      expect(status.databaseHealthy).toBe(false);
    });

    it("should emit startup:error when database fails", async () => {
      mockPerformHealthCheck.mockResolvedValue({
        healthy: false,
        responseTimeMs: 10,
        timestamp: new Date(),
        error: "Connection refused",
      });

      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const handler = vi.fn();
      orchestrator.on("startup:error", handler);

      await expect(orchestrator.startAllServices()).rejects.toThrow();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "database",
          error: expect.any(Error),
        })
      );
    });

    it("should continue if non-critical service fails", async () => {
      mockMarketSyncService.start.mockRejectedValue(new Error("Market sync failed"));

      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      const status = await orchestrator.startAllServices();

      // Should still run - partial status
      expect(status.status).toBe("partial");
      expect(status.hasErrors).toBe(true);

      // Other services should still be started
      expect(mockTradeStreamService.start).toHaveBeenCalled();
      expect(mockAlertGeneratorService.start).toHaveBeenCalled();
    });

    it("should not start twice if already starting", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      // Start in parallel
      const promise1 = orchestrator.startAllServices();
      const promise2 = orchestrator.startAllServices();

      const [status1, status2] = await Promise.all([promise1, promise2]);

      // First call should complete, second should return current status
      expect(status1).toEqual(status2);

      // Services should only be started once
      expect(mockMarketSyncService.start).toHaveBeenCalledTimes(1);
    });

    it("should not start if already running", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      vi.clearAllMocks();

      const status = await orchestrator.startAllServices();

      expect(status.status).toBe("running");
      expect(mockMarketSyncService.start).not.toHaveBeenCalled();
    });

    it("should start Telegram bot when enabled", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: true,
      });

      await orchestrator.startAllServices();

      expect(mockTelegramBot.initialize).toHaveBeenCalled();
      expect(mockTelegramBot.start).toHaveBeenCalled();
    });

    it("should not start Telegram bot when disabled", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      expect(mockTelegramBot.initialize).not.toHaveBeenCalled();
    });

    it("should start health checks when enabled", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
        enableDbHealthChecks: true,
        dbHealthCheckIntervalMs: 60000,
      });

      await orchestrator.startAllServices();

      expect(mockStartHealthChecks).toHaveBeenCalledWith(expect.anything(), 60000);
    });
  });

  describe("stopAllServices", () => {
    it("should stop all services successfully", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();
      await orchestrator.stopAllServices();

      const status = orchestrator.getStatus();
      expect(status.status).toBe("stopped");
      expect(status.allRunning).toBe(false);
    });

    it("should emit shutdown:start event", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const handler = vi.fn();
      orchestrator.on("shutdown:start", handler);

      await orchestrator.stopAllServices();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should emit shutdown:complete event", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const handler = vi.fn();
      orchestrator.on("shutdown:complete", handler);

      await orchestrator.stopAllServices();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timeMs: expect.any(Number),
        })
      );
    });

    it("should emit service:stopped events for each service", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const handler = vi.fn();
      orchestrator.on("service:stopped", handler);

      await orchestrator.stopAllServices();

      expect(handler).toHaveBeenCalledWith({ service: "database" });
      expect(handler).toHaveBeenCalledWith({ service: "marketSync" });
    });

    it("should stop services in reverse order", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const callOrder: string[] = [];

      mockAlertGeneratorService.stop.mockImplementation(() => {
        callOrder.push("alertGenerator");
      });

      mockWalletProfilerService.stop.mockImplementation(() => {
        callOrder.push("walletProfiler");
      });

      mockTradeStreamService.stop.mockImplementation(() => {
        callOrder.push("tradeStream");
      });

      mockMarketSyncService.stop.mockImplementation(() => {
        callOrder.push("marketSync");
      });

      mockDisconnectPrisma.mockImplementation(async () => {
        callOrder.push("database");
      });

      await orchestrator.stopAllServices();

      expect(callOrder).toEqual([
        "alertGenerator",
        "walletProfiler",
        "tradeStream",
        "marketSync",
        "database",
      ]);
    });

    it("should stop health checks", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
        enableDbHealthChecks: true,
      });

      await orchestrator.startAllServices();
      await orchestrator.stopAllServices();

      expect(mockStopHealthChecks).toHaveBeenCalled();
    });

    it("should disconnect database", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();
      await orchestrator.stopAllServices();

      expect(mockDisconnectPrisma).toHaveBeenCalled();
    });

    it("should not stop twice if already stopping", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      // Stop in parallel
      const promise1 = orchestrator.stopAllServices();
      const promise2 = orchestrator.stopAllServices();

      await Promise.all([promise1, promise2]);

      // Should only stop once
      expect(mockMarketSyncService.stop).toHaveBeenCalledTimes(1);
    });

    it("should not stop if already stopped", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      // Never started, already stopped
      await orchestrator.stopAllServices();

      expect(mockMarketSyncService.stop).not.toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("should return correct status when stopped", () => {
      const orchestrator = createTestOrchestrator();

      const status = orchestrator.getStatus();

      expect(status.status).toBe("stopped");
      expect(status.allRunning).toBe(false);
      expect(status.hasErrors).toBe(false);
      expect(status.databaseHealthy).toBe(false);
      expect(status.services).toBeInstanceOf(Array);
    });

    it("should return correct status when running", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const status = orchestrator.getStatus();

      expect(status.status).toBe("running");
      expect(status.allRunning).toBe(true);
      expect(status.databaseHealthy).toBe(true);
    });

    it("should show individual service statuses", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const status = orchestrator.getStatus();

      const databaseStatus = status.services.find((s) => s.name === "database");
      expect(databaseStatus?.status).toBe("running");
      expect(databaseStatus?.startedAt).toBeInstanceOf(Date);

      const marketSyncStatus = status.services.find((s) => s.name === "marketSync");
      expect(marketSyncStatus?.status).toBe("running");
    });
  });

  describe("isAllRunning", () => {
    it("should return false when stopped", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.isAllRunning()).toBe(false);
    });

    it("should return true when all running", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      expect(orchestrator.isAllRunning()).toBe(true);
    });
  });

  describe("hasErrors", () => {
    it("should return false when no errors", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      expect(orchestrator.hasErrors()).toBe(false);
    });

    it("should return true when service fails", async () => {
      mockMarketSyncService.start.mockRejectedValue(new Error("Test error"));

      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      expect(orchestrator.hasErrors()).toBe(true);
    });
  });

  describe("getServiceStatus", () => {
    it("should return service info for valid service", () => {
      const orchestrator = createTestOrchestrator();

      const info = orchestrator.getServiceStatus("database");

      expect(info).toBeDefined();
      expect(info?.name).toBe("database");
      expect(info?.status).toBe("stopped");
    });

    it("should return undefined for invalid service", () => {
      const orchestrator = createTestOrchestrator();

      const info = orchestrator.getServiceStatus("nonexistent");

      expect(info).toBeUndefined();
    });
  });

  describe("service accessors", () => {
    it("should return MarketSyncService", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.getMarketSyncService()).toBeDefined();
    });

    it("should return TradeStreamService", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.getTradeStreamService()).toBeDefined();
    });

    it("should return WalletProfilerService", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.getWalletProfilerService()).toBeDefined();
    });

    it("should return AlertGeneratorService", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.getAlertGeneratorService()).toBeDefined();
    });

    it("should return TelegramBot", () => {
      const orchestrator = createTestOrchestrator();
      expect(orchestrator.getTelegramBot()).toBeDefined();
    });
  });

  describe("setupGracefulShutdown", () => {
    it("should register signal handlers", () => {
      const processSpy = vi.spyOn(process, "on");

      const orchestrator = createTestOrchestrator();
      orchestrator.setupGracefulShutdown();

      expect(processSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

      processSpy.mockRestore();
    });
  });

  describe("dispose", () => {
    it("should stop all services and clean up", async () => {
      const orchestrator = createTestOrchestrator({
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      const removeListenersSpy = vi.spyOn(orchestrator, "removeAllListeners");

      await orchestrator.dispose();

      expect(orchestrator.getStatus().status).toBe("stopped");
      expect(removeListenersSpy).toHaveBeenCalled();
    });
  });

  describe("partial service startup", () => {
    it("should only start enabled services", async () => {
      const orchestrator = createTestOrchestrator({
        enableMarketSync: true,
        enableTradeStream: false,
        enableWalletProfiler: false,
        enableAlertGenerator: false,
        enableTelegramBot: false,
      });

      await orchestrator.startAllServices();

      expect(mockMarketSyncService.start).toHaveBeenCalled();
      expect(mockTradeStreamService.start).not.toHaveBeenCalled();
      expect(mockWalletProfilerService.start).not.toHaveBeenCalled();
      expect(mockAlertGeneratorService.start).not.toHaveBeenCalled();
    });

    it("should report correct status with partial services", async () => {
      const orchestrator = createTestOrchestrator({
        enableMarketSync: true,
        enableTradeStream: false,
        enableWalletProfiler: false,
        enableAlertGenerator: false,
        enableTelegramBot: false,
      });

      const status = await orchestrator.startAllServices();

      expect(status.status).toBe("running");
      expect(status.allRunning).toBe(true);
    });
  });
});
