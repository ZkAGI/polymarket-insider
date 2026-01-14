/**
 * Unit Tests for Ingestion Health Service (INGEST-HEALTH-001)
 *
 * Tests for tracking and exposing ingestion health and last successful sync times.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient, SyncStatus, AlertType, AlertSeverity } from "@prisma/client";
import {
  IngestionHealthService,
  createIngestionHealthService,
  resetIngestionHealthService,
  type IngestionHealthStatus,
} from "../../src/services/ingestion-health";
import type { IngestionHealth } from "../../src/workers/ingestion-worker";

// Mock Prisma client
const mockPrisma = {
  systemConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  syncLog: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  alert: {
    create: vi.fn(),
  },
  $disconnect: vi.fn(),
} as unknown as PrismaClient;

// Reset singleton between tests
beforeEach(() => {
  resetIngestionHealthService();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IngestionHealthService", () => {
  describe("constructor", () => {
    it("should create service with default configuration", () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });

      expect(service).toBeInstanceOf(IngestionHealthService);
      expect(service.getIsRunning()).toBe(false);
    });

    it("should create service with custom thresholds", () => {
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        marketStallThresholdMs: 20 * 60 * 1000,
        tradeStallThresholdMs: 10 * 60 * 1000,
      });

      expect(service).toBeInstanceOf(IngestionHealthService);
    });
  });

  describe("start/stop", () => {
    it("should start and stop the service", () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });

      service.start();
      expect(service.getIsRunning()).toBe(true);

      service.stop();
      expect(service.getIsRunning()).toBe(false);
    });

    it("should emit started event", () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });
      const startedHandler = vi.fn();
      service.on("started", startedHandler);

      service.start();
      expect(startedHandler).toHaveBeenCalled();

      service.stop();
    });

    it("should emit stopped event", () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });
      const stoppedHandler = vi.fn();
      service.on("stopped", stoppedHandler);

      service.start();
      service.stop();
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it("should not start twice", () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });
      const startedHandler = vi.fn();
      service.on("started", startedHandler);

      service.start();
      service.start(); // Try to start again
      expect(startedHandler).toHaveBeenCalledTimes(1);

      service.stop();
    });
  });

  describe("getPersistedHealth", () => {
    it("should return default values when no data exists", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue(null);
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const health = await service.getPersistedHealth();

      expect(health).toEqual({
        workerId: null,
        lastMarketSyncAt: null,
        lastTradeIngestAt: null,
        lastUpdatedAt: null,
        cyclesCompleted: 0,
        cyclesFailed: 0,
        marketsSynced: 0,
        tradesIngested: 0,
        walletsCreated: 0,
        lastError: null,
      });
    });

    it("should parse stored health data correctly", async () => {
      const storedDate = new Date("2025-01-14T12:00:00Z").toISOString();
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          workerId: "worker-123",
          lastMarketSyncAt: storedDate,
          lastTradeIngestAt: storedDate,
          lastUpdatedAt: storedDate,
          cyclesCompleted: 100,
          cyclesFailed: 5,
          marketsSynced: 500,
          tradesIngested: 10000,
          walletsCreated: 200,
          lastError: "Network error",
        },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const health = await service.getPersistedHealth();

      expect(health.workerId).toBe("worker-123");
      expect(health.lastMarketSyncAt).toEqual(new Date(storedDate));
      expect(health.cyclesCompleted).toBe(100);
      expect(health.marketsSynced).toBe(500);
      expect(health.lastError).toBe("Network error");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockRejectedValue(new Error("DB error"));
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const health = await service.getPersistedHealth();

      // Should return default values on error
      expect(health.workerId).toBeNull();
      expect(health.cyclesCompleted).toBe(0);
    });
  });

  describe("persistHealth", () => {
    it("should persist health data to database", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.systemConfig.upsert = vi.fn().mockResolvedValue({});
      const service = createIngestionHealthService({ prisma: mockPrisma });

      await service.persistHealth({
        workerId: "worker-456",
        lastMarketSyncAt: new Date("2025-01-14T12:00:00Z"),
        cyclesCompleted: 50,
        marketsSynced: 250,
      });

      expect(mockPrisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: "ingestion_health" },
          create: expect.objectContaining({
            key: "ingestion_health",
            value: expect.objectContaining({
              workerId: "worker-456",
              cyclesCompleted: 50,
              marketsSynced: 250,
            }),
          }),
          update: expect.objectContaining({
            value: expect.objectContaining({
              workerId: "worker-456",
            }),
          }),
        })
      );
    });

    it("should merge with existing health data", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          workerId: "worker-old",
          cyclesCompleted: 100,
          cyclesFailed: 10,
          marketsSynced: 500,
          tradesIngested: 5000,
          walletsCreated: 100,
          lastError: null,
        },
      });
      mockPrisma.systemConfig.upsert = vi.fn().mockResolvedValue({});
      const service = createIngestionHealthService({ prisma: mockPrisma });

      // Only update cyclesCompleted
      await service.persistHealth({
        cyclesCompleted: 150,
      });

      expect(mockPrisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            value: expect.objectContaining({
              workerId: "worker-old", // Preserved from existing
              cyclesCompleted: 150, // Updated
              marketsSynced: 500, // Preserved from existing
            }),
          }),
        })
      );
    });

    it("should throw on database error", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.systemConfig.upsert = vi.fn().mockRejectedValue(new Error("DB error"));
      const service = createIngestionHealthService({ prisma: mockPrisma });

      await expect(service.persistHealth({ cyclesCompleted: 1 })).rejects.toThrow("DB error");
    });
  });

  describe("getHealthStatus", () => {
    it("should return unknown status when no data exists", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue(null);
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const status = await service.getHealthStatus();

      expect(status.status).toBe("unknown");
      expect(status.isStalled).toBe(false);
    });

    it("should return healthy status when recent sync exists", async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: recentDate.toISOString(),
          lastTradeIngestAt: recentDate.toISOString(),
          cyclesCompleted: 100,
          cyclesFailed: 0,
        },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const status = await service.getHealthStatus();

      expect(status.status).toBe("healthy");
      expect(status.isStalled).toBe(false);
      expect(status.isMarketSyncStalled).toBe(false);
      expect(status.isTradeIngestStalled).toBe(false);
    });

    it("should detect market sync stall", async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const recentDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: staleDate.toISOString(),
          lastTradeIngestAt: recentDate.toISOString(),
          cyclesCompleted: 100,
          cyclesFailed: 0,
        },
      });
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        marketStallThresholdMs: 15 * 60 * 1000, // 15 minutes
      });

      const status = await service.getHealthStatus();

      expect(status.status).toBe("unhealthy");
      expect(status.isStalled).toBe(true);
      expect(status.isMarketSyncStalled).toBe(true);
      expect(status.isTradeIngestStalled).toBe(false);
      expect(status.stall.marketSyncStalledForMs).toBeGreaterThan(15 * 60 * 1000);
    });

    it("should detect trade ingestion stall", async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
      const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: recentDate.toISOString(),
          lastTradeIngestAt: staleDate.toISOString(),
          cyclesCompleted: 100,
          cyclesFailed: 0,
        },
      });
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        tradeStallThresholdMs: 5 * 60 * 1000, // 5 minutes
      });

      const status = await service.getHealthStatus();

      expect(status.status).toBe("unhealthy");
      expect(status.isStalled).toBe(true);
      expect(status.isMarketSyncStalled).toBe(false);
      expect(status.isTradeIngestStalled).toBe(true);
      expect(status.stall.tradeIngestStalledForMs).toBeGreaterThan(5 * 60 * 1000);
    });

    it("should return degraded status when there are failures", async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 1000);
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: recentDate.toISOString(),
          lastTradeIngestAt: recentDate.toISOString(),
          cyclesCompleted: 100,
          cyclesFailed: 10,
          lastError: "Network timeout",
        },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const status = await service.getHealthStatus();

      expect(status.status).toBe("degraded");
      expect(status.persisted.lastError).toBe("Network timeout");
    });

    it("should include runtime health when set", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: new Date().toISOString(),
          lastTradeIngestAt: new Date().toISOString(),
        },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const runtimeHealth: IngestionHealth = {
        isRunning: true,
        isIngesting: false,
        lastMarketSyncAt: new Date(),
        lastTradeIngestAt: new Date(),
        cyclesCompleted: 50,
        cyclesFailed: 2,
        marketsSynced: 200,
        tradesIngested: 5000,
        walletsCreated: 100,
        consecutiveErrors: 0,
        lastError: null,
        startedAt: new Date(),
        uptimeSeconds: 3600,
      };

      service.updateRuntimeHealth(runtimeHealth);
      const status = await service.getHealthStatus();

      expect(status.runtime).toBeDefined();
      expect(status.runtime?.isRunning).toBe(true);
      expect(status.runtime?.uptimeSeconds).toBe(3600);
    });
  });

  describe("checkHealth", () => {
    it("should emit health:checked event", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: new Date().toISOString(),
          lastTradeIngestAt: new Date().toISOString(),
        },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });
      const checkedHandler = vi.fn();
      service.on("health:checked", checkedHandler);

      await service.checkHealth();

      expect(checkedHandler).toHaveBeenCalled();
      const status = checkedHandler.mock.calls[0]?.[0] as IngestionHealthStatus | undefined;
      expect(status?.checkedAt).toBeInstanceOf(Date);
    });

    it("should emit stall:detected event when stalled", async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: staleDate.toISOString(),
          lastTradeIngestAt: staleDate.toISOString(),
        },
      });
      mockPrisma.alert.create = vi.fn().mockResolvedValue({});
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        enableAlerts: true,
      });
      const stallHandler = vi.fn();
      service.on("stall:detected", stallHandler);

      await service.checkHealth();

      expect(stallHandler).toHaveBeenCalled();
    });

    it("should create alert when stalled and alerts enabled", async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: staleDate.toISOString(),
          lastTradeIngestAt: staleDate.toISOString(),
        },
      });
      mockPrisma.alert.create = vi.fn().mockResolvedValue({});
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        enableAlerts: true,
      });

      await service.checkHealth();

      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: AlertType.SYSTEM,
            severity: AlertSeverity.HIGH,
            title: "Ingestion Worker Stalled",
            tags: expect.arrayContaining(["ingestion", "stall"]),
          }),
        })
      );
    });

    it("should not create alert when alerts disabled", async () => {
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: staleDate.toISOString(),
          lastTradeIngestAt: staleDate.toISOString(),
        },
      });
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        enableAlerts: false,
      });

      await service.checkHealth();

      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it("should emit stall:recovered event when stall clears", async () => {
      // First check - stalled
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: staleDate.toISOString(),
          lastTradeIngestAt: staleDate.toISOString(),
        },
      });
      mockPrisma.alert.create = vi.fn().mockResolvedValue({});
      const service = createIngestionHealthService({
        prisma: mockPrisma,
        enableAlerts: true,
      });
      const recoveredHandler = vi.fn();
      service.on("stall:recovered", recoveredHandler);

      await service.checkHealth(); // First check - stalled
      expect(recoveredHandler).not.toHaveBeenCalled();

      // Second check - recovered
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: new Date().toISOString(),
          lastTradeIngestAt: new Date().toISOString(),
        },
      });

      await service.checkHealth(); // Second check - recovered
      expect(recoveredHandler).toHaveBeenCalled();
    });
  });

  describe("getLastSuccessfulSync", () => {
    it("should return sync timestamps from database", async () => {
      const recentDate = new Date("2025-01-14T12:00:00Z");
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue({
        key: "ingestion_health",
        value: {
          lastMarketSyncAt: recentDate.toISOString(),
          lastTradeIngestAt: recentDate.toISOString(),
        },
      });
      mockPrisma.syncLog.findFirst = vi.fn().mockResolvedValue({
        completedAt: recentDate,
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const result = await service.getLastSuccessfulSync();

      expect(result.marketSync).toEqual(recentDate);
      expect(result.tradeSync).toEqual(recentDate);
      expect(result.lastSync).toEqual(recentDate);
    });

    it("should return nulls when no sync exists", async () => {
      mockPrisma.systemConfig.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.syncLog.findFirst = vi.fn().mockResolvedValue(null);
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const result = await service.getLastSuccessfulSync();

      expect(result.marketSync).toBeNull();
      expect(result.tradeSync).toBeNull();
      expect(result.lastSync).toBeNull();
    });
  });

  describe("getRecentSyncLogs", () => {
    it("should return recent sync logs", async () => {
      const logs = [
        {
          id: "log-1",
          syncType: "INGESTION",
          status: SyncStatus.COMPLETED,
          recordsProcessed: 100,
          errorCount: 0,
          startedAt: new Date("2025-01-14T12:00:00Z"),
          completedAt: new Date("2025-01-14T12:01:00Z"),
          durationMs: 60000,
        },
        {
          id: "log-2",
          syncType: "INGESTION",
          status: SyncStatus.FAILED,
          recordsProcessed: 50,
          errorCount: 1,
          startedAt: new Date("2025-01-14T11:00:00Z"),
          completedAt: new Date("2025-01-14T11:00:30Z"),
          durationMs: 30000,
        },
      ];
      mockPrisma.syncLog.findMany = vi.fn().mockResolvedValue(logs);
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const result = await service.getRecentSyncLogs(5);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("log-1");
      expect(result[0]?.status).toBe(SyncStatus.COMPLETED);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.syncLog.findMany = vi.fn().mockRejectedValue(new Error("DB error"));
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const result = await service.getRecentSyncLogs();

      expect(result).toEqual([]);
    });
  });

  describe("getSyncStats", () => {
    it("should calculate sync statistics", async () => {
      mockPrisma.syncLog.count = vi.fn()
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90) // successful
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(5) // lastHour
        .mockResolvedValueOnce(60); // last24Hour
      mockPrisma.syncLog.aggregate = vi.fn().mockResolvedValue({
        _avg: { durationMs: 45000 },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const stats = await service.getSyncStats();

      expect(stats.totalSyncs).toBe(100);
      expect(stats.successfulSyncs).toBe(90);
      expect(stats.failedSyncs).toBe(10);
      expect(stats.successRate).toBe(90);
      expect(stats.avgDurationMs).toBe(45000);
      expect(stats.lastHourSyncs).toBe(5);
      expect(stats.last24HourSyncs).toBe(60);
    });

    it("should handle zero total syncs", async () => {
      mockPrisma.syncLog.count = vi.fn().mockResolvedValue(0);
      mockPrisma.syncLog.aggregate = vi.fn().mockResolvedValue({
        _avg: { durationMs: null },
      });
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const stats = await service.getSyncStats();

      expect(stats.totalSyncs).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgDurationMs).toBeNull();
    });
  });

  describe("updateRuntimeHealth", () => {
    it("should cache runtime health", async () => {
      const service = createIngestionHealthService({ prisma: mockPrisma });

      const runtimeHealth: IngestionHealth = {
        isRunning: true,
        isIngesting: true,
        lastMarketSyncAt: new Date(),
        lastTradeIngestAt: new Date(),
        cyclesCompleted: 10,
        cyclesFailed: 1,
        marketsSynced: 50,
        tradesIngested: 1000,
        walletsCreated: 20,
        consecutiveErrors: 0,
        lastError: null,
        startedAt: new Date(),
        uptimeSeconds: 600,
      };

      service.updateRuntimeHealth(runtimeHealth);

      const cached = service.getRuntimeHealth();
      expect(cached).toBeDefined();
      expect(cached?.isRunning).toBe(true);
      expect(cached?.cyclesCompleted).toBe(10);
    });
  });
});
