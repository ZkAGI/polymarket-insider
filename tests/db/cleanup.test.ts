/**
 * Tests for Data Retention and Cleanup Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CleanupService,
  createCleanupService,
  createCleanupServiceWithConfigs,
  DEFAULT_RETENTION_CONFIGS,
  type CleanupDataType,
  type RetentionConfig,
  type CleanupOptions,
  type ScheduledCleanupConfig,
} from "../../src/db/cleanup";

// Mock Prisma client
const mockPrismaClient = {
  trade: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  priceHistory: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  marketSnapshot: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  walletSnapshot: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  alert: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  syncLog: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
  jobQueue: {
    count: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany: vi.fn().mockResolvedValue([]),
  },
};

// Mock logger to suppress output during tests
const mockLogger = vi.fn();

describe("CleanupService", () => {
  let service: CleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createCleanupService({
      prisma: mockPrismaClient as unknown as Parameters<typeof createCleanupService>[0]["prisma"],
      logger: mockLogger,
    });
  });

  afterEach(() => {
    service.reset();
  });

  describe("constructor", () => {
    it("should create service with default configuration", () => {
      const defaultService = new CleanupService();
      expect(defaultService).toBeDefined();
      expect(defaultService.getAllRetentionConfigs()).toHaveLength(7);
    });

    it("should create service with custom configuration", () => {
      const customService = createCleanupService({
        prisma: mockPrismaClient as unknown as Parameters<typeof createCleanupService>[0]["prisma"],
        defaultBatchSize: 500,
        logger: mockLogger,
      });
      expect(customService).toBeDefined();
    });

    it("should accept custom retention configs", () => {
      const customConfigs: RetentionConfig[] = [
        {
          dataType: "trades",
          retentionDays: 30,
          archiveBeforeDelete: false,
          enabled: true,
        },
      ];
      const customService = createCleanupServiceWithConfigs(customConfigs, {
        prisma: mockPrismaClient as unknown as Parameters<typeof createCleanupService>[0]["prisma"],
        logger: mockLogger,
      });
      expect(customService.getAllRetentionConfigs()).toHaveLength(1);
      expect(customService.getRetentionConfig("trades")?.retentionDays).toBe(30);
    });
  });

  describe("DEFAULT_RETENTION_CONFIGS", () => {
    it("should have configurations for all data types", () => {
      const dataTypes: CleanupDataType[] = [
        "trades",
        "priceHistory",
        "marketSnapshots",
        "walletSnapshots",
        "alerts",
        "syncLogs",
        "jobQueue",
      ];

      for (const dataType of dataTypes) {
        const config = DEFAULT_RETENTION_CONFIGS.find((c) => c.dataType === dataType);
        expect(config).toBeDefined();
      }
    });

    it("should have reasonable retention periods", () => {
      for (const config of DEFAULT_RETENTION_CONFIGS) {
        expect(config.retentionDays).toBeGreaterThan(0);
        expect(config.retentionDays).toBeLessThanOrEqual(365);
      }
    });

    it("should have archive enabled for trades and alerts", () => {
      const tradesConfig = DEFAULT_RETENTION_CONFIGS.find((c) => c.dataType === "trades");
      const alertsConfig = DEFAULT_RETENTION_CONFIGS.find((c) => c.dataType === "alerts");

      expect(tradesConfig?.archiveBeforeDelete).toBe(true);
      expect(alertsConfig?.archiveBeforeDelete).toBe(true);
    });

    it("should have filter for alerts to only cleanup acknowledged ones", () => {
      const alertsConfig = DEFAULT_RETENTION_CONFIGS.find((c) => c.dataType === "alerts");
      expect(alertsConfig?.filter).toEqual({ acknowledged: true });
    });

    it("should have filter for jobQueue to only cleanup completed/failed/cancelled jobs", () => {
      const jobQueueConfig = DEFAULT_RETENTION_CONFIGS.find((c) => c.dataType === "jobQueue");
      expect(jobQueueConfig?.filter).toEqual({ status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } });
    });
  });

  describe("getRetentionConfig", () => {
    it("should return config for existing data type", () => {
      const config = service.getRetentionConfig("trades");
      expect(config).toBeDefined();
      expect(config?.dataType).toBe("trades");
    });

    it("should return undefined for non-existent data type", () => {
      const config = service.getRetentionConfig("nonexistent" as CleanupDataType);
      expect(config).toBeUndefined();
    });
  });

  describe("getAllRetentionConfigs", () => {
    it("should return all retention configs", () => {
      const configs = service.getAllRetentionConfigs();
      expect(configs).toHaveLength(7);
    });
  });

  describe("setRetentionConfig", () => {
    it("should update existing retention config", () => {
      service.setRetentionConfig("trades", { retentionDays: 180 });
      const config = service.getRetentionConfig("trades");
      expect(config?.retentionDays).toBe(180);
    });

    it("should create new retention config if not exists", () => {
      // First remove all configs
      const customService = createCleanupServiceWithConfigs([], {
        prisma: mockPrismaClient as unknown as Parameters<typeof createCleanupService>[0]["prisma"],
        logger: mockLogger,
      });

      customService.setRetentionConfig("trades", { retentionDays: 60 });
      const config = customService.getRetentionConfig("trades");
      expect(config).toBeDefined();
      expect(config?.retentionDays).toBe(60);
    });

    it("should log config update", () => {
      service.setRetentionConfig("trades", { retentionDays: 180 });
      expect(mockLogger).toHaveBeenCalledWith(
        "info",
        "Updated retention config for trades",
        expect.objectContaining({ retentionDays: 180 })
      );
    });
  });

  describe("enableCleanup and disableCleanup", () => {
    it("should enable cleanup for a data type", () => {
      service.disableCleanup("trades");
      expect(service.getRetentionConfig("trades")?.enabled).toBe(false);

      service.enableCleanup("trades");
      expect(service.getRetentionConfig("trades")?.enabled).toBe(true);
    });

    it("should disable cleanup for a data type", () => {
      service.disableCleanup("trades");
      expect(service.getRetentionConfig("trades")?.enabled).toBe(false);
    });
  });

  describe("calculateCutoffDate", () => {
    it("should calculate correct cutoff date", () => {
      const now = Date.now();
      const retentionDays = 30;

      // Mock Date.now for consistent testing
      vi.spyOn(Date, "now").mockReturnValue(now);

      const cutoffDate = service.calculateCutoffDate(retentionDays);
      const expectedCutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);

      expect(cutoffDate.getTime()).toBe(expectedCutoff.getTime());

      vi.restoreAllMocks();
    });
  });

  describe("getEnabledDataTypes", () => {
    it("should return all enabled data types", () => {
      const enabledTypes = service.getEnabledDataTypes();
      expect(enabledTypes).toContain("trades");
      expect(enabledTypes.length).toBe(7); // All types are enabled by default
    });

    it("should not include disabled data types", () => {
      service.disableCleanup("trades");
      const enabledTypes = service.getEnabledDataTypes();
      expect(enabledTypes).not.toContain("trades");
      expect(enabledTypes.length).toBe(6);
    });
  });

  describe("getDisabledDataTypes", () => {
    it("should return empty array when all are enabled", () => {
      const disabledTypes = service.getDisabledDataTypes();
      expect(disabledTypes).toHaveLength(0);
    });

    it("should return disabled data types", () => {
      service.disableCleanup("trades");
      service.disableCleanup("alerts");
      const disabledTypes = service.getDisabledDataTypes();
      expect(disabledTypes).toContain("trades");
      expect(disabledTypes).toContain("alerts");
      expect(disabledTypes.length).toBe(2);
    });
  });

  describe("cleanupDataType", () => {
    it("should cleanup a specific data type", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await service.cleanupDataType("trades");

      expect(result.success).toBe(true);
      expect(result.dataType).toBe("trades");
      expect(result.deletedCount).toBe(5);
    });

    it("should skip disabled data types", async () => {
      service.disableCleanup("trades");

      const result = await service.cleanupDataType("trades");

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(mockPrismaClient.trade.deleteMany).not.toHaveBeenCalled();
    });

    it("should return error for missing retention config", async () => {
      const customService = createCleanupServiceWithConfigs([], {
        prisma: mockPrismaClient as unknown as Parameters<typeof createCleanupService>[0]["prisma"],
        logger: mockLogger,
      });

      const result = await customService.cleanupDataType("trades");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No retention config found");
    });

    it("should respect retention days override", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 10 });

      await service.cleanupDataType("trades", { retentionDaysOverride: 7 });

      expect(mockPrismaClient.trade.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });

    it("should perform dry run without deleting", async () => {
      mockPrismaClient.trade.count.mockResolvedValueOnce(15);

      const result = await service.cleanupDataType("trades", { dryRun: true });

      expect(result.deletedCount).toBe(15);
      expect(mockPrismaClient.trade.deleteMany).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockPrismaClient.trade.deleteMany.mockRejectedValueOnce(new Error("Database error"));

      const result = await service.cleanupDataType("trades");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should record cleanup duration", async () => {
      const result = await service.cleanupDataType("trades");

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should include cutoff date in result", async () => {
      const result = await service.cleanupDataType("trades");

      expect(result.cutoffDate).toBeInstanceOf(Date);
    });
  });

  describe("runCleanup", () => {
    it("should run cleanup for all enabled data types", async () => {
      const result = await service.runCleanup();

      expect(result.status).toBe("completed");
      expect(result.results).toHaveLength(7);
    });

    it("should run cleanup for specific data types only", async () => {
      const options: CleanupOptions = {
        dataTypes: ["trades", "alerts"],
      };

      const result = await service.runCleanup(options);

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r.dataType)).toEqual(["trades", "alerts"]);
    });

    it("should calculate total deleted records", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.priceHistory.deleteMany.mockResolvedValueOnce({ count: 10 });

      const result = await service.runCleanup({ dataTypes: ["trades", "priceHistory"] });

      expect(result.totalDeleted).toBe(15);
    });

    it("should return partial status on some failures", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.priceHistory.deleteMany.mockRejectedValueOnce(new Error("DB error"));

      const result = await service.runCleanup({ dataTypes: ["trades", "priceHistory"] });

      expect(result.status).toBe("partial");
    });

    it("should return failed status on all failures", async () => {
      mockPrismaClient.trade.deleteMany.mockRejectedValueOnce(new Error("DB error"));
      mockPrismaClient.priceHistory.deleteMany.mockRejectedValueOnce(new Error("DB error"));

      const result = await service.runCleanup({ dataTypes: ["trades", "priceHistory"] });

      expect(result.status).toBe("failed");
    });

    it("should include timing information", async () => {
      const result = await service.runCleanup();

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should support dry run mode", async () => {
      const result = await service.runCleanup({ dryRun: true });

      expect(result.dryRun).toBe(true);
    });
  });

  describe("previewCleanup", () => {
    it("should return dry run results", async () => {
      mockPrismaClient.trade.count.mockResolvedValueOnce(100);

      const result = await service.previewCleanup({ dataTypes: ["trades"] });

      expect(result.dryRun).toBe(true);
      expect(mockPrismaClient.trade.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("archiving", () => {
    it("should archive data before deletion when configured", async () => {
      const mockTrades = [
        { id: "1", timestamp: new Date() },
        { id: "2", timestamp: new Date() },
      ];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.cleanupDataType("trades");

      expect(result.archivedCount).toBe(2);
      expect(service.getArchiveRecords()).toHaveLength(1);
    });

    it("should skip archiving when skipArchive is true", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await service.cleanupDataType("trades", { skipArchive: true });

      expect(result.archivedCount).toBe(0);
      expect(service.getArchiveRecords()).toHaveLength(0);
    });

    it("should skip archiving in dry run mode", async () => {
      mockPrismaClient.trade.count.mockResolvedValueOnce(5);

      await service.cleanupDataType("trades", { dryRun: true });

      expect(mockPrismaClient.trade.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getArchiveRecords", () => {
    it("should return all archive records", async () => {
      const mockTrades = [{ id: "1" }];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupDataType("trades");

      const archives = service.getArchiveRecords();
      expect(archives).toHaveLength(1);
      expect(archives[0].dataType).toBe("trades");
    });
  });

  describe("getArchiveRecordsByType", () => {
    it("should return archive records for specific type", async () => {
      const mockTrades = [{ id: "1" }];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupDataType("trades");

      const archives = service.getArchiveRecordsByType("trades");
      expect(archives).toHaveLength(1);

      const otherArchives = service.getArchiveRecordsByType("alerts");
      expect(otherArchives).toHaveLength(0);
    });
  });

  describe("getArchiveRecord", () => {
    it("should return archive record by ID", async () => {
      const mockTrades = [{ id: "1" }];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupDataType("trades");

      const archives = service.getArchiveRecords();
      const archive = service.getArchiveRecord(archives[0].id);
      expect(archive).toBeDefined();
    });

    it("should return undefined for non-existent ID", () => {
      const archive = service.getArchiveRecord("nonexistent");
      expect(archive).toBeUndefined();
    });
  });

  describe("clearArchiveRecords", () => {
    it("should clear all archive records", async () => {
      const mockTrades = [{ id: "1" }];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupDataType("trades");
      expect(service.getArchiveRecords()).toHaveLength(1);

      service.clearArchiveRecords();
      expect(service.getArchiveRecords()).toHaveLength(0);
    });
  });

  describe("cleanup logging", () => {
    it("should log cleanup operations", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });

      await service.cleanupDataType("trades");

      const logs = service.getCleanupLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].dataType).toBe("trades");
      expect(logs[0].success).toBe(true);
      expect(logs[0].recordCount).toBe(5);
    });

    it("should log failed operations", async () => {
      mockPrismaClient.trade.deleteMany.mockRejectedValueOnce(new Error("DB error"));

      await service.cleanupDataType("trades");

      const logs = service.getCleanupLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error).toBe("DB error");
    });
  });

  describe("getCleanupLogs", () => {
    it("should return all cleanup logs", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.alert.deleteMany.mockResolvedValueOnce({ count: 3 });

      await service.cleanupDataType("trades");
      await service.cleanupDataType("alerts");

      const logs = service.getCleanupLogs();
      expect(logs).toHaveLength(2);
    });
  });

  describe("getCleanupLogsByType", () => {
    it("should return logs for specific data type", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.alert.deleteMany.mockResolvedValueOnce({ count: 3 });

      await service.cleanupDataType("trades");
      await service.cleanupDataType("alerts");

      const tradeLogs = service.getCleanupLogsByType("trades");
      expect(tradeLogs).toHaveLength(1);
      expect(tradeLogs[0].dataType).toBe("trades");
    });
  });

  describe("getRecentCleanupLogs", () => {
    it("should return limited number of recent logs", async () => {
      for (let i = 0; i < 5; i++) {
        mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: i });
        await service.cleanupDataType("trades");
      }

      const logs = service.getRecentCleanupLogs(3);
      expect(logs).toHaveLength(3);
    });
  });

  describe("clearCleanupLogs", () => {
    it("should clear all cleanup logs", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      await service.cleanupDataType("trades");
      expect(service.getCleanupLogs()).toHaveLength(1);

      service.clearCleanupLogs();
      expect(service.getCleanupLogs()).toHaveLength(0);
    });
  });

  describe("getCleanupStats", () => {
    it("should calculate cleanup statistics", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 10 });
      mockPrismaClient.alert.deleteMany.mockRejectedValueOnce(new Error("error"));

      await service.cleanupDataType("trades");
      await service.cleanupDataType("trades");
      await service.cleanupDataType("alerts");

      const stats = service.getCleanupStats();

      expect(stats.totalOperations).toBe(3);
      expect(stats.successfulOperations).toBe(2);
      expect(stats.failedOperations).toBe(1);
      expect(stats.totalRecordsCleaned).toBe(15);
      expect(stats.byDataType.trades).toEqual({ count: 2, records: 15 });
      expect(stats.byDataType.alerts).toEqual({ count: 1, records: 0 });
    });
  });

  describe("scheduled cleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      service.stopScheduledCleanup();
      vi.useRealTimers();
    });

    it("should start scheduled cleanup", () => {
      const config: ScheduledCleanupConfig = {
        intervalMs: 60000,
        enabled: true,
      };

      service.startScheduledCleanup(config);

      expect(service.isScheduledCleanupRunning()).toBe(true);
    });

    it("should not start if disabled", () => {
      const config: ScheduledCleanupConfig = {
        intervalMs: 60000,
        enabled: false,
      };

      service.startScheduledCleanup(config);

      expect(service.isScheduledCleanupRunning()).toBe(false);
    });

    it("should stop scheduled cleanup", () => {
      const config: ScheduledCleanupConfig = {
        intervalMs: 60000,
        enabled: true,
      };

      service.startScheduledCleanup(config);
      expect(service.isScheduledCleanupRunning()).toBe(true);

      service.stopScheduledCleanup();
      expect(service.isScheduledCleanupRunning()).toBe(false);
    });

    it("should run cleanup at interval", async () => {
      const config: ScheduledCleanupConfig = {
        intervalMs: 1000,
        enabled: true,
        options: { dataTypes: ["trades"] },
      };

      service.startScheduledCleanup(config);

      // Advance timer
      await vi.advanceTimersByTimeAsync(1000);

      // Should have run cleanup
      expect(mockPrismaClient.trade.deleteMany).toHaveBeenCalled();
    });

    it("should replace existing schedule", () => {
      const config1: ScheduledCleanupConfig = {
        intervalMs: 1000,
        enabled: true,
      };
      const config2: ScheduledCleanupConfig = {
        intervalMs: 2000,
        enabled: true,
      };

      service.startScheduledCleanup(config1);
      service.startScheduledCleanup(config2);

      expect(service.isScheduledCleanupRunning()).toBe(true);
      expect(service.getScheduledCleanupConfig()?.intervalMs).toBe(2000);
    });

    it("should return scheduled config", () => {
      const config: ScheduledCleanupConfig = {
        intervalMs: 60000,
        enabled: true,
      };

      service.startScheduledCleanup(config);

      expect(service.getScheduledCleanupConfig()).toEqual(config);
    });

    it("should return null config when not running", () => {
      expect(service.getScheduledCleanupConfig()).toBeNull();
    });
  });

  describe("getStorageEstimates", () => {
    it("should return storage estimates for all data types", async () => {
      mockPrismaClient.trade.count
        .mockResolvedValueOnce(1000) // Total count
        .mockResolvedValueOnce(100); // Eligible count
      mockPrismaClient.priceHistory.count
        .mockResolvedValueOnce(5000)
        .mockResolvedValueOnce(500);

      const estimates = await service.getStorageEstimates();

      expect(estimates.trades).toEqual({
        count: 1000,
        eligibleForCleanup: 100,
      });
      expect(estimates.priceHistory).toEqual({
        count: 5000,
        eligibleForCleanup: 500,
      });
    });
  });

  describe("reset", () => {
    it("should reset all service state", async () => {
      // Setup some state
      const mockTrades = [{ id: "1" }];
      mockPrismaClient.trade.findMany.mockResolvedValueOnce(mockTrades);
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupDataType("trades");
      service.startScheduledCleanup({ intervalMs: 60000, enabled: true });

      expect(service.getCleanupLogs()).toHaveLength(1);
      expect(service.getArchiveRecords()).toHaveLength(1);
      expect(service.isScheduledCleanupRunning()).toBe(true);

      // Reset
      service.reset();

      expect(service.getCleanupLogs()).toHaveLength(0);
      expect(service.getArchiveRecords()).toHaveLength(0);
      expect(service.isScheduledCleanupRunning()).toBe(false);
    });
  });

  describe("timestamp field mapping", () => {
    it("should use correct timestamp field for trades", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 0 });

      await service.cleanupDataType("trades");

      expect(mockPrismaClient.trade.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.any(Object),
          }),
        })
      );
    });

    it("should use correct timestamp field for alerts", async () => {
      mockPrismaClient.alert.deleteMany.mockResolvedValueOnce({ count: 0 });

      await service.cleanupDataType("alerts");

      expect(mockPrismaClient.alert.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        })
      );
    });

    it("should use correct timestamp field for syncLogs", async () => {
      mockPrismaClient.syncLog.deleteMany.mockResolvedValueOnce({ count: 0 });

      await service.cleanupDataType("syncLogs");

      expect(mockPrismaClient.syncLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: expect.any(Object),
          }),
        })
      );
    });
  });

  describe("filter application", () => {
    it("should apply filter from retention config", async () => {
      mockPrismaClient.alert.deleteMany.mockResolvedValueOnce({ count: 0 });

      await service.cleanupDataType("alerts");

      expect(mockPrismaClient.alert.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            acknowledged: true, // From default config
          }),
        })
      );
    });

    it("should apply filter for jobQueue", async () => {
      mockPrismaClient.jobQueue.deleteMany.mockResolvedValueOnce({ count: 0 });

      await service.cleanupDataType("jobQueue");

      expect(mockPrismaClient.jobQueue.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
          }),
        })
      );
    });
  });

  describe("data type specific cleanup", () => {
    it("should cleanup trades", async () => {
      mockPrismaClient.trade.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("trades");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup priceHistory", async () => {
      mockPrismaClient.priceHistory.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("priceHistory");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup marketSnapshots", async () => {
      mockPrismaClient.marketSnapshot.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("marketSnapshots");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup walletSnapshots", async () => {
      mockPrismaClient.walletSnapshot.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("walletSnapshots");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup alerts", async () => {
      mockPrismaClient.alert.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("alerts");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup syncLogs", async () => {
      mockPrismaClient.syncLog.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("syncLogs");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });

    it("should cleanup jobQueue", async () => {
      mockPrismaClient.jobQueue.deleteMany.mockResolvedValueOnce({ count: 5 });
      const result = await service.cleanupDataType("jobQueue");
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });
  });
});

describe("createCleanupService", () => {
  it("should create a new instance", () => {
    const service = createCleanupService();
    expect(service).toBeInstanceOf(CleanupService);
  });

  it("should accept configuration", () => {
    const logger = vi.fn();
    const service = createCleanupService({
      defaultBatchSize: 500,
      logger,
    });
    expect(service).toBeInstanceOf(CleanupService);
  });
});

describe("createCleanupServiceWithConfigs", () => {
  it("should create service with custom configs", () => {
    const configs: RetentionConfig[] = [
      {
        dataType: "trades",
        retentionDays: 7,
        archiveBeforeDelete: false,
        enabled: true,
      },
    ];

    const service = createCleanupServiceWithConfigs(configs);

    expect(service.getAllRetentionConfigs()).toHaveLength(1);
    expect(service.getRetentionConfig("trades")?.retentionDays).toBe(7);
  });
});
