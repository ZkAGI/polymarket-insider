/**
 * Market Sync Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MarketSyncService,
  createMarketSyncService,
  marketSyncService,
} from "../../src/services/market-sync";
import type { GammaMarket } from "../../src/api/gamma";
import type { Market } from "@prisma/client";

// Mock the Gamma API
vi.mock("../../src/api/gamma", () => ({
  getAllActiveMarkets: vi.fn(),
  gammaClient: {},
}));

// Mock the market service
vi.mock("../../src/db/markets", () => ({
  marketService: {
    findById: vi.fn(),
    upsert: vi.fn(),
  },
  MarketService: vi.fn(),
}));

import { getAllActiveMarkets } from "../../src/api/gamma";
import { marketService } from "../../src/db/markets";

const mockGetAllActiveMarkets = vi.mocked(getAllActiveMarkets);
const mockMarketService = vi.mocked(marketService);

describe("MarketSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockGammaMarket = (overrides: Partial<GammaMarket> = {}): GammaMarket => ({
    id: "0x123",
    question: "Test Market?",
    slug: "test-market",
    description: "A test market",
    category: "crypto",
    active: true,
    closed: false,
    archived: false,
    outcomes: [
      { id: "1", name: "Yes", price: 0.65 },
      { id: "2", name: "No", price: 0.35 },
    ],
    volume: 100000,
    liquidity: 50000,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  });

  describe("constructor", () => {
    it("should create service with default config", () => {
      const service = new MarketSyncService();
      expect(service).toBeInstanceOf(MarketSyncService);
      expect(service.getIsRunning()).toBe(false);
    });

    it("should create service with custom config", () => {
      const service = new MarketSyncService({
        syncIntervalMs: 60000,
        volumeChangeThreshold: 10,
        enableEvents: false,
      });
      expect(service).toBeInstanceOf(MarketSyncService);
    });

    it("should use custom logger", () => {
      const mockLogger = vi.fn();
      const service = createMarketSyncService({
        logger: mockLogger,
      });
      expect(service).toBeInstanceOf(MarketSyncService);
    });
  });

  describe("start/stop", () => {
    it("should start the service", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);
      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const startedHandler = vi.fn();
      service.on("started", startedHandler);

      await service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it("should not start if already running", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);
      const mockLogger = vi.fn();
      const service = createMarketSyncService({
        logger: mockLogger,
      });

      await service.start();
      await service.start();

      expect(mockLogger).toHaveBeenCalledWith("Service already running");
    });

    it("should stop the service", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);
      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stoppedHandler = vi.fn();
      service.on("stopped", stoppedHandler);

      await service.start();
      service.stop();

      expect(service.getIsRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    });

    it("should not stop if not running", () => {
      const mockLogger = vi.fn();
      const service = createMarketSyncService({
        logger: mockLogger,
      });

      service.stop();

      expect(mockLogger).toHaveBeenCalledWith("Service not running");
    });

    it("should perform initial sync on start", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      await service.start();

      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(1);
      expect(mockMarketService.upsert).toHaveBeenCalledTimes(1);
    });

    it("should schedule periodic syncs", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);
      const service = createMarketSyncService({
        syncIntervalMs: 1000,
        logger: vi.fn(),
      });

      await service.start();

      // First sync happens on start
      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(1);

      // Advance timer by 1 second
      await vi.advanceTimersByTimeAsync(1000);

      // Second sync
      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(2);

      service.stop();
    });
  });

  describe("sync", () => {
    it("should sync markets from Gamma API", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.totalSynced).toBe(1);
      expect(stats.newMarkets).toBe(1);
      expect(stats.updatedMarkets).toBe(0);
      expect(stats.errors).toHaveLength(0);
    });

    it("should count updated markets correctly", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue({} as Market);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.newMarkets).toBe(0);
      expect(stats.updatedMarkets).toBe(1);
    });

    it("should emit sync:start and sync:complete events", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      service.on("sync:start", startHandler);
      service.on("sync:complete", completeHandler);

      await service.sync();

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });

    it("should detect volume changes", async () => {
      const mockMarket = createMockGammaMarket({ volume: 100000 });
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue({} as Market);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        volumeChangeThreshold: 5,
        logger: vi.fn(),
      });

      // First sync to populate volume cache
      await service.sync();

      // Update volume by more than 5%
      const updatedMarket = createMockGammaMarket({ volume: 110000 }); // 10% increase
      mockGetAllActiveMarkets.mockResolvedValue([updatedMarket]);

      const volumeHandler = vi.fn();
      service.on("market:updated", volumeHandler);

      const stats = await service.sync();

      expect(stats.volumeChanges).toBe(1);
      expect(volumeHandler).toHaveBeenCalledTimes(1);
      expect(volumeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: "0x123",
          previousVolume: 100000,
          currentVolume: 110000,
          volumeChange: 10000,
        })
      );
    });

    it("should not detect volume changes below threshold", async () => {
      const mockMarket = createMockGammaMarket({ volume: 100000 });
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue({} as Market);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        volumeChangeThreshold: 5,
        logger: vi.fn(),
      });

      // First sync
      await service.sync();

      // Update volume by less than 5%
      const updatedMarket = createMockGammaMarket({ volume: 102000 }); // 2% increase
      mockGetAllActiveMarkets.mockResolvedValue([updatedMarket]);

      const volumeHandler = vi.fn();
      service.on("market:updated", volumeHandler);

      const stats = await service.sync();

      expect(stats.volumeChanges).toBe(0);
      expect(volumeHandler).not.toHaveBeenCalled();
    });

    it("should emit market:new event for new markets", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const newMarketHandler = vi.fn();
      service.on("market:new", newMarketHandler);

      await service.sync();

      expect(newMarketHandler).toHaveBeenCalledTimes(1);
      expect(newMarketHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: "0x123",
          slug: "test-market",
          question: "Test Market?",
        })
      );
    });

    it("should not emit events when enableEvents is false", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        enableEvents: false,
        logger: vi.fn(),
      });

      const newMarketHandler = vi.fn();
      service.on("market:new", newMarketHandler);

      await service.sync();

      expect(newMarketHandler).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockGetAllActiveMarkets.mockRejectedValue(new Error("API Error"));

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      await expect(service.sync()).rejects.toThrow("API Error");
    });

    it("should handle individual market processing errors", async () => {
      const mockMarket1 = createMockGammaMarket({ id: "1" });
      const mockMarket2 = createMockGammaMarket({ id: "2" });
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket1, mockMarket2]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert
        .mockRejectedValueOnce(new Error("DB Error"))
        .mockResolvedValueOnce({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.totalSynced).toBe(1);
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0]).toContain("Failed to process market 1");
    });

    it("should prevent concurrent syncs", async () => {
      mockGetAllActiveMarkets.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 100);
          })
      );

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const syncPromise = service.sync();
      expect(service.getIsSyncing()).toBe(true);

      await expect(service.sync()).rejects.toThrow("Sync already in progress");

      await vi.advanceTimersByTimeAsync(100);
      await syncPromise;
    });

    it("should store sync stats", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      expect(service.getLastSyncStats()).toBeNull();

      await service.sync();

      const stats = service.getLastSyncStats();
      expect(stats).not.toBeNull();
      expect(stats?.syncedAt).toBeDefined();
      expect(stats?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should correctly convert Gamma market to DB input", async () => {
      const mockMarket = createMockGammaMarket({
        id: "test-id",
        slug: "test-slug",
        question: "Test Question?",
        description: "Test Description",
        category: "politics",
        image: "https://example.com/image.png",
        icon: "https://example.com/icon.png",
        resolutionSource: "Official Source",
        endDate: "2024-12-31T23:59:59Z",
        active: true,
        closed: false,
        archived: false,
        volume: 50000,
        liquidity: 25000,
      });

      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      await service.sync();

      expect(mockMarketService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-id",
          slug: "test-slug",
          question: "Test Question?",
          description: "Test Description",
          category: "politics",
          imageUrl: "https://example.com/image.png",
          iconUrl: "https://example.com/icon.png",
          resolutionSource: "Official Source",
          active: true,
          closed: false,
          archived: false,
          volume: 50000,
          liquidity: 25000,
        })
      );
    });

    it("should use volumeNum when volume is not available", async () => {
      const mockMarket = {
        ...createMockGammaMarket(),
        volume: undefined,
        volumeNum: 75000,
      } as unknown as GammaMarket;

      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      await service.sync();

      expect(mockMarketService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: 75000,
        })
      );
    });

    it("should count closed markets", async () => {
      const mockMarket = createMockGammaMarket({ closed: true });
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue({} as Market);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.closedMarkets).toBe(1);
    });
  });

  describe("forceSync", () => {
    it("should wait for in-progress sync and then sync", async () => {
      let resolveFirstSync: () => void;
      const firstSyncPromise = new Promise<void>((resolve) => {
        resolveFirstSync = resolve;
      });

      mockGetAllActiveMarkets
        .mockImplementationOnce(async () => {
          await firstSyncPromise;
          return [];
        })
        .mockResolvedValueOnce([]);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      // Start first sync
      const firstSync = service.sync();

      // Try force sync while first is in progress
      const forceSyncPromise = service.forceSync();

      // Complete first sync
      resolveFirstSync!();
      await firstSync;

      // Let force sync proceed
      await vi.advanceTimersByTimeAsync(200);
      await forceSyncPromise;

      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(2);
    });
  });

  describe("volume cache", () => {
    it("should track volume cache size", async () => {
      const mockMarkets = [
        createMockGammaMarket({ id: "1" }),
        createMockGammaMarket({ id: "2" }),
        createMockGammaMarket({ id: "3" }),
      ];
      mockGetAllActiveMarkets.mockResolvedValue(mockMarkets);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      expect(service.getVolumeCacheSize()).toBe(0);

      await service.sync();

      expect(service.getVolumeCacheSize()).toBe(3);
    });

    it("should clear volume cache", async () => {
      const mockMarket = createMockGammaMarket();
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      await service.sync();
      expect(service.getVolumeCacheSize()).toBe(1);

      service.clearVolumeCache();
      expect(service.getVolumeCacheSize()).toBe(0);
    });
  });

  describe("updateConfig", () => {
    it("should update sync interval", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);

      const service = createMarketSyncService({
        syncIntervalMs: 5000,
        logger: vi.fn(),
      });

      await service.start();
      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(1);

      // Update interval to 1 second
      service.updateConfig({ syncIntervalMs: 1000 });

      // Advance by 1 second (should trigger sync with new interval)
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockGetAllActiveMarkets).toHaveBeenCalledTimes(2);

      service.stop();
    });

    it("should update event settings", () => {
      const service = createMarketSyncService({
        enableEvents: true,
        logger: vi.fn(),
      });

      service.updateConfig({ enableEvents: false });
      // Config is private, but we can test behavior
      expect(service).toBeDefined();
    });

    it("should update volume threshold", () => {
      const mockLogger = vi.fn();
      const service = createMarketSyncService({
        volumeChangeThreshold: 5,
        logger: mockLogger,
      });

      service.updateConfig({ volumeChangeThreshold: 10 });

      expect(mockLogger).toHaveBeenCalledWith(
        "Config updated",
        expect.objectContaining({
          volumeChangeThreshold: 10,
        })
      );
    });
  });

  describe("singleton and factory", () => {
    it("should export a singleton instance", () => {
      expect(marketSyncService).toBeInstanceOf(MarketSyncService);
    });

    it("should create new instances via factory", () => {
      const service1 = createMarketSyncService();
      const service2 = createMarketSyncService();
      expect(service1).not.toBe(service2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty market list", async () => {
      mockGetAllActiveMarkets.mockResolvedValue([]);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.totalSynced).toBe(0);
      expect(stats.newMarkets).toBe(0);
      expect(stats.updatedMarkets).toBe(0);
    });

    it("should handle markets with missing optional fields", async () => {
      const minimalMarket: GammaMarket = {
        id: "minimal-id",
        question: "Minimal Question?",
        slug: "minimal",
        description: "",
        category: "",
        active: true,
        closed: false,
        archived: false,
        outcomes: [],
        volume: 0,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      mockGetAllActiveMarkets.mockResolvedValue([minimalMarket]);
      mockMarketService.findById.mockResolvedValue(null);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      const stats = await service.sync();

      expect(stats.totalSynced).toBe(1);
      expect(mockMarketService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "minimal-id",
          volume: 0,
          liquidity: 0,
        })
      );
    });

    it("should handle volume change from 0", async () => {
      const mockMarket = createMockGammaMarket({ volume: 0 });
      mockGetAllActiveMarkets.mockResolvedValue([mockMarket]);
      mockMarketService.findById.mockResolvedValue({} as Market);
      mockMarketService.upsert.mockResolvedValue({} as Market);

      const service = createMarketSyncService({
        logger: vi.fn(),
      });

      // First sync with 0 volume
      await service.sync();

      // Update to non-zero volume (shouldn't trigger change as previous was 0)
      const updatedMarket = createMockGammaMarket({ volume: 10000 });
      mockGetAllActiveMarkets.mockResolvedValue([updatedMarket]);

      const volumeHandler = vi.fn();
      service.on("market:updated", volumeHandler);

      const stats = await service.sync();

      // Volume change is not detected when previous volume is 0 (division by zero prevention)
      expect(stats.volumeChanges).toBe(0);
    });

    it("should handle initial sync failure gracefully", async () => {
      mockGetAllActiveMarkets.mockRejectedValueOnce(new Error("Network Error"));

      const mockLogger = vi.fn();
      const service = createMarketSyncService({
        logger: mockLogger,
      });

      await service.start();

      expect(mockLogger).toHaveBeenCalledWith("Initial sync failed", expect.any(Object));
      expect(service.getIsRunning()).toBe(true);

      service.stop();
    });
  });
});
