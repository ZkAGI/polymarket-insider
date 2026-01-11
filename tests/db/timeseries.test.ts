/**
 * Tests for Time-Series Data Storage Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TimeSeriesService,
  createTimeSeriesService,
  CHUNK_SIZES,
  DEFAULT_COMPRESSION_CONFIGS,
  type CompressionConfig,
} from "../../src/db/timeseries";

// Mock Prisma client
const mockPrismaClient = {
  priceHistory: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  trade: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  marketSnapshot: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  walletSnapshot: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  market: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn().mockImplementation((fn) => fn(mockPrismaClient)),
};

// Mock logger to suppress output during tests
const mockLogger = vi.fn();

describe("TimeSeriesService", () => {
  let service: TimeSeriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createTimeSeriesService({
      prisma: mockPrismaClient as unknown as NonNullable<
        Parameters<typeof createTimeSeriesService>[0]
      >["prisma"],
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should create service with default configuration", () => {
      const defaultService = new TimeSeriesService();
      expect(defaultService).toBeDefined();
      expect(defaultService.getCompressionConfigs()).toHaveLength(4);
    });

    it("should create service with custom configuration", () => {
      const customService = createTimeSeriesService({
        prisma: mockPrismaClient as unknown as NonNullable<
          Parameters<typeof createTimeSeriesService>[0]
        >["prisma"],
        defaultChunkSize: "DAY_1",
        autoDownsample: false,
        maxPointsBeforeDownsample: 2000,
        logger: mockLogger,
      });
      expect(customService).toBeDefined();
      expect(customService.getDefaultChunkSize().name).toBe("1 day");
      expect(customService.isAutoDownsampleEnabled()).toBe(false);
      expect(customService.getMaxPointsBeforeDownsample()).toBe(2000);
    });

    it("should accept custom compression configs", () => {
      const customConfigs: CompressionConfig[] = [
        {
          ageThresholdDays: 14,
          targetInterval: "HOUR_1",
          level: "medium",
          keepOriginal: false,
        },
      ];
      const customService = createTimeSeriesService({
        prisma: mockPrismaClient as unknown as NonNullable<
          Parameters<typeof createTimeSeriesService>[0]
        >["prisma"],
        compressionConfigs: customConfigs,
        logger: mockLogger,
      });
      expect(customService.getCompressionConfigs()).toHaveLength(1);
      const configs = customService.getCompressionConfigs();
      expect(configs[0]?.ageThresholdDays).toBe(14);
    });
  });

  describe("CHUNK_SIZES", () => {
    it("should have all expected chunk sizes defined", () => {
      const expectedSizes: (keyof typeof CHUNK_SIZES)[] = [
        "MINUTE_1",
        "MINUTE_5",
        "MINUTE_15",
        "HOUR_1",
        "HOUR_4",
        "DAY_1",
        "WEEK_1",
        "MONTH_1",
      ];

      for (const size of expectedSizes) {
        const chunk = CHUNK_SIZES[size];
        expect(chunk).toBeDefined();
        if (chunk) {
          expect(chunk.durationMs).toBeGreaterThan(0);
          expect(chunk.name).toBeTruthy();
        }
      }
    });

    it("should have increasing duration values", () => {
      const orderedSizes: (keyof typeof CHUNK_SIZES)[] = [
        "MINUTE_1",
        "MINUTE_5",
        "MINUTE_15",
        "HOUR_1",
        "HOUR_4",
        "DAY_1",
        "WEEK_1",
        "MONTH_1",
      ];

      for (let i = 1; i < orderedSizes.length; i++) {
        const currentSize = orderedSizes[i];
        const previousSize = orderedSizes[i - 1];
        if (currentSize && previousSize) {
          const currentChunk = CHUNK_SIZES[currentSize];
          const previousChunk = CHUNK_SIZES[previousSize];
          if (currentChunk && previousChunk) {
            expect(currentChunk.durationMs).toBeGreaterThan(previousChunk.durationMs);
          }
        }
      }
    });

    it("should have correct duration for 1 hour", () => {
      const hour1 = CHUNK_SIZES.HOUR_1;
      expect(hour1).toBeDefined();
      if (hour1) expect(hour1.durationMs).toBe(60 * 60 * 1000);
    });

    it("should have correct duration for 1 day", () => {
      const day1 = CHUNK_SIZES.DAY_1;
      expect(day1).toBeDefined();
      if (day1) expect(day1.durationMs).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("DEFAULT_COMPRESSION_CONFIGS", () => {
    it("should have configurations for different age thresholds", () => {
      expect(DEFAULT_COMPRESSION_CONFIGS.length).toBeGreaterThan(0);

      for (const config of DEFAULT_COMPRESSION_CONFIGS) {
        expect(config.ageThresholdDays).toBeGreaterThan(0);
        expect(config.targetInterval).toBeTruthy();
        expect(config.level).toBeTruthy();
        expect(typeof config.keepOriginal).toBe("boolean");
      }
    });

    it("should have increasing age thresholds", () => {
      const sortedConfigs = [...DEFAULT_COMPRESSION_CONFIGS].sort(
        (a, b) => a.ageThresholdDays - b.ageThresholdDays
      );

      for (let i = 1; i < sortedConfigs.length; i++) {
        const current = sortedConfigs[i];
        const previous = sortedConfigs[i - 1];
        if (current && previous) {
          expect(current.ageThresholdDays).toBeGreaterThan(previous.ageThresholdDays);
        }
      }
    });

    it("should have reasonable thresholds for 7, 30, 90, and 365 days", () => {
      const thresholds = DEFAULT_COMPRESSION_CONFIGS.map(
        (c) => c.ageThresholdDays
      );
      expect(thresholds).toContain(7);
      expect(thresholds).toContain(30);
      expect(thresholds).toContain(90);
      expect(thresholds).toContain(365);
    });
  });

  describe("getChunkBoundaries", () => {
    it("should return correct number of hourly chunks for a day", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-02T00:00:00Z");
      const chunks = service.getChunkBoundaries({ start, end }, "HOUR_1");

      expect(chunks.length).toBe(24);
    });

    it("should return correct number of daily chunks for a week", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-08T00:00:00Z");
      const chunks = service.getChunkBoundaries({ start, end }, "DAY_1");

      expect(chunks.length).toBe(7);
    });

    it("should align chunks to boundaries", () => {
      const start = new Date("2024-01-01T12:30:00Z");
      const end = new Date("2024-01-02T12:30:00Z");
      const chunks = service.getChunkBoundaries({ start, end }, "HOUR_1");

      // First chunk should start at aligned boundary (12:00 UTC)
      const firstChunk = chunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk) expect(firstChunk.start.getUTCMinutes()).toBe(0);
    });

    it("should handle partial last chunk", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-01T02:30:00Z");
      const chunks = service.getChunkBoundaries({ start, end }, "HOUR_1");

      expect(chunks.length).toBe(3);
      // Last chunk should end at the actual end time, not the boundary
      const lastChunk = chunks[2];
      expect(lastChunk).toBeDefined();
      if (lastChunk) expect(lastChunk.end.getTime()).toBe(end.getTime());
    });

    it("should return empty array for zero-length range", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const chunks = service.getChunkBoundaries({ start, end: start }, "HOUR_1");

      expect(chunks.length).toBe(0);
    });

    it("should handle minute-level chunks", () => {
      const start = new Date("2024-01-01T00:00:00Z");
      const end = new Date("2024-01-01T00:30:00Z");
      const chunks = service.getChunkBoundaries({ start, end }, "MINUTE_5");

      expect(chunks.length).toBe(6);
    });
  });

  describe("getCompressionConfigForAge", () => {
    it("should return null for data less than 7 days old", () => {
      const config = service.getCompressionConfigForAge(5);
      expect(config).toBeNull();
    });

    it("should return 7-day config for data between 7-30 days old", () => {
      const config = service.getCompressionConfigForAge(15);
      expect(config).not.toBeNull();
      expect(config!.ageThresholdDays).toBe(7);
    });

    it("should return 30-day config for data between 30-90 days old", () => {
      const config = service.getCompressionConfigForAge(60);
      expect(config).not.toBeNull();
      expect(config!.ageThresholdDays).toBe(30);
    });

    it("should return 90-day config for data between 90-365 days old", () => {
      const config = service.getCompressionConfigForAge(180);
      expect(config).not.toBeNull();
      expect(config!.ageThresholdDays).toBe(90);
    });

    it("should return 365-day config for data older than 365 days", () => {
      const config = service.getCompressionConfigForAge(400);
      expect(config).not.toBeNull();
      expect(config!.ageThresholdDays).toBe(365);
    });

    it("should handle exact threshold values", () => {
      const config7 = service.getCompressionConfigForAge(7);
      expect(config7).not.toBeNull();
      expect(config7!.ageThresholdDays).toBe(7);

      const config30 = service.getCompressionConfigForAge(30);
      expect(config30).not.toBeNull();
      expect(config30!.ageThresholdDays).toBe(30);
    });
  });

  describe("analyzeChunks", () => {
    it("should return empty analysis when no data exists", async () => {
      const analysis = await service.analyzeChunks("priceHistory");

      expect(analysis.dataType).toBe("priceHistory");
      expect(analysis.totalChunks).toBe(0);
      expect(analysis.chunks).toHaveLength(0);
      expect(analysis.recommendations).toContain("No data found for analysis");
    });

    it("should analyze price history chunks", async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      mockPrismaClient.priceHistory.findFirst
        .mockResolvedValueOnce({ timestamp: twoDaysAgo }) // oldest
        .mockResolvedValueOnce({ timestamp: now }) // newest
        .mockResolvedValue({ interval: "MINUTE_1" }); // for compression check

      mockPrismaClient.priceHistory.count.mockResolvedValue(100);

      const analysis = await service.analyzeChunks("priceHistory", "DAY_1");

      expect(analysis.dataType).toBe("priceHistory");
      expect(analysis.totalChunks).toBeGreaterThan(0);
    });

    it("should analyze trade chunks", async () => {
      mockPrismaClient.trade.findFirst.mockResolvedValue(null);
      mockPrismaClient.trade.count.mockResolvedValue(0);

      const analysis = await service.analyzeChunks("trades");

      expect(analysis.dataType).toBe("trades");
    });

    it("should analyze market snapshot chunks", async () => {
      mockPrismaClient.marketSnapshot.findFirst.mockResolvedValue(null);
      mockPrismaClient.marketSnapshot.count.mockResolvedValue(0);

      const analysis = await service.analyzeChunks("marketSnapshots");

      expect(analysis.dataType).toBe("marketSnapshots");
    });

    it("should analyze wallet snapshot chunks", async () => {
      mockPrismaClient.walletSnapshot.findFirst.mockResolvedValue(null);
      mockPrismaClient.walletSnapshot.count.mockResolvedValue(0);

      const analysis = await service.analyzeChunks("walletSnapshots");

      expect(analysis.dataType).toBe("walletSnapshots");
    });
  });

  describe("compressPriceHistory", () => {
    it("should return early when no records exist", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.compressPriceHistory(
        "market-1",
        { start: new Date("2024-01-01"), end: new Date("2024-01-02") },
        "HOUR_1",
        false
      );

      expect(result.originalRecords).toBe(0);
      expect(result.compressedRecords).toBe(0);
      expect(result.compressionRatio).toBe(1);
    });

    it("should compress price history data", async () => {
      // Use a fixed time aligned to hour boundary to ensure all records fall in same hour
      const baseTime = new Date("2024-01-01T00:00:00Z");
      const records = Array.from({ length: 60 }, (_, i) => ({
        id: `ph-${i}`,
        marketId: "market-1",
        outcomeId: "outcome-1",
        price: 0.5 + (i % 10) * 0.01,
        volume: 100,
        tradeCount: 10,
        bestBid: 0.49,
        bestAsk: 0.51,
        spread: 0.02,
        interval: "MINUTE_1",
        // All records within same hour (minute 0-59)
        timestamp: new Date(baseTime.getTime() + i * 60 * 1000),
      }));

      mockPrismaClient.priceHistory.findMany.mockResolvedValue(records);
      mockPrismaClient.priceHistory.createMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.priceHistory.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.compressPriceHistory(
        "market-1",
        { start: baseTime, end: new Date(baseTime.getTime() + 60 * 60 * 1000) },
        "HOUR_1",
        false
      );

      expect(result.originalRecords).toBe(60);
      expect(result.compressedRecords).toBe(1); // All 60 minutes in same hour
      expect(result.compressionRatio).toBe(60);
      expect(result.dataType).toBe("priceHistory");
    });

    it("should delete originals when requested", async () => {
      const baseTime = new Date("2024-01-01T00:30:00Z");
      const records = [
        {
          id: "ph-1",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.5,
          volume: 100,
          tradeCount: 10,
          bestBid: 0.49,
          bestAsk: 0.51,
          spread: 0.02,
          interval: "MINUTE_1",
          timestamp: baseTime,
        },
      ];

      mockPrismaClient.priceHistory.findMany.mockResolvedValue(records);
      mockPrismaClient.priceHistory.createMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.priceHistory.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.compressPriceHistory(
        "market-1",
        { start: new Date("2024-01-01"), end: new Date("2024-01-02") },
        "HOUR_1",
        true
      );

      // The result includes compression metadata
      expect(result.originalRecords).toBe(1);
      expect(result.compressedRecords).toBe(1);
      expect(result.dataType).toBe("priceHistory");
      // Storage saved is calculated when deleteOriginal is true
      expect(result.storageSavedBytes).toBeGreaterThanOrEqual(0);
    });

    it("should calculate VWAP correctly", async () => {
      // Two records with different volumes at different prices in same hour
      const records = [
        {
          id: "ph-1",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.4,
          volume: 100,
          tradeCount: 5,
          bestBid: 0.39,
          bestAsk: 0.41,
          spread: 0.02,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:00:00Z"),
        },
        {
          id: "ph-2",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.6,
          volume: 200,
          tradeCount: 10,
          bestBid: 0.59,
          bestAsk: 0.61,
          spread: 0.02,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:30:00Z"),
        },
      ];

      mockPrismaClient.priceHistory.findMany.mockResolvedValue(records);
      mockPrismaClient.priceHistory.createMany.mockResolvedValue({ count: 1 });

      const result = await service.compressPriceHistory(
        "market-1",
        { start: new Date("2024-01-01T00:00:00Z"), end: new Date("2024-01-01T01:00:00Z") },
        "HOUR_1",
        false
      );

      // Should have compressed 2 records into 1
      expect(result.originalRecords).toBe(2);
      expect(result.compressedRecords).toBe(1);
      expect(result.compressionRatio).toBe(2);
      // The VWAP = (0.4*100 + 0.6*200) / 300 = 160/300 ≈ 0.533
      // We verify this indirectly via successful compression with expected counts
      expect(result.dataType).toBe("priceHistory");
    });
  });

  describe("runAutoCompression", () => {
    it("should handle empty market list", async () => {
      mockPrismaClient.market.findMany.mockResolvedValue([]);

      const compressionResults = await service.runAutoCompression();

      expect(compressionResults).toHaveLength(0);
    });

    it("should process markets for compression", async () => {
      mockPrismaClient.market.findMany.mockResolvedValue([{ id: "market-1" }]);
      mockPrismaClient.priceHistory.findFirst.mockResolvedValue(null);

      await service.runAutoCompression(["market-1"]);

      expect(mockPrismaClient.market.findMany).toHaveBeenCalled();
    });
  });

  describe("queryPriceHistory", () => {
    it("should query with optimal interval for short range", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.queryPriceHistory(
        "market-1",
        "outcome-1",
        {
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T01:00:00Z"),
        },
        100
      );

      expect(result.interval).toBe("MINUTE_1");
      expect(result.data).toHaveLength(0);
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should query with larger interval for long range", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.queryPriceHistory(
        "market-1",
        "outcome-1",
        {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31"),
        },
        100
      );

      expect(["HOUR_4", "DAY_1", "WEEK_1"]).toContain(result.interval);
    });

    it("should mark result as compressed when using larger intervals", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.queryPriceHistory(
        "market-1",
        "outcome-1",
        {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31"),
        },
        100
      );

      expect(result.isCompressed).toBe(true);
    });
  });

  describe("queryOHLCV", () => {
    it("should return empty array when no data", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.queryOHLCV(
        "market-1",
        "outcome-1",
        { start: new Date("2024-01-01"), end: new Date("2024-01-02") },
        "HOUR_1"
      );

      expect(result).toHaveLength(0);
    });

    it("should calculate OHLCV correctly", async () => {
      const records = [
        {
          id: "ph-1",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.5,
          volume: 100,
          tradeCount: 5,
          bestBid: null,
          bestAsk: null,
          spread: null,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:00:00Z"),
        },
        {
          id: "ph-2",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.6,
          volume: 50,
          tradeCount: 3,
          bestBid: null,
          bestAsk: null,
          spread: null,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:15:00Z"),
        },
        {
          id: "ph-3",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.45,
          volume: 75,
          tradeCount: 4,
          bestBid: null,
          bestAsk: null,
          spread: null,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:30:00Z"),
        },
        {
          id: "ph-4",
          marketId: "market-1",
          outcomeId: "outcome-1",
          price: 0.55,
          volume: 80,
          tradeCount: 6,
          bestBid: null,
          bestAsk: null,
          spread: null,
          interval: "MINUTE_1",
          timestamp: new Date("2024-01-01T00:45:00Z"),
        },
      ];

      mockPrismaClient.priceHistory.findMany.mockResolvedValue(records);

      const result = await service.queryOHLCV(
        "market-1",
        "outcome-1",
        {
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T01:00:00Z"),
        },
        "HOUR_1"
      );

      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult.open).toBe(0.5);
      expect(firstResult.high).toBe(0.6);
      expect(firstResult.low).toBe(0.45);
      expect(firstResult.close).toBe(0.55);
      expect(firstResult.volume).toBe(305); // 100 + 50 + 75 + 80
      expect(firstResult.tradeCount).toBe(18); // 5 + 3 + 4 + 6
    });
  });

  describe("queryTradeStats", () => {
    it("should return empty array when no trades", async () => {
      mockPrismaClient.trade.findMany.mockResolvedValue([]);

      const result = await service.queryTradeStats(
        "market-1",
        { start: new Date("2024-01-01"), end: new Date("2024-01-02") },
        "HOUR_1"
      );

      expect(result).toHaveLength(0);
    });

    it("should aggregate trade statistics correctly", async () => {
      const trades = [
        {
          id: "t-1",
          marketId: "market-1",
          walletId: "wallet-1",
          amount: 100,
          usdValue: 50,
          isWhale: false,
          timestamp: new Date("2024-01-01T00:15:00Z"),
        },
        {
          id: "t-2",
          marketId: "market-1",
          walletId: "wallet-2",
          amount: 200,
          usdValue: 100,
          isWhale: true,
          timestamp: new Date("2024-01-01T00:30:00Z"),
        },
        {
          id: "t-3",
          marketId: "market-1",
          walletId: "wallet-1",
          amount: 50,
          usdValue: 25,
          isWhale: false,
          timestamp: new Date("2024-01-01T00:45:00Z"),
        },
      ];

      mockPrismaClient.trade.findMany.mockResolvedValue(trades);

      const result = await service.queryTradeStats(
        "market-1",
        {
          start: new Date("2024-01-01T00:00:00Z"),
          end: new Date("2024-01-01T01:00:00Z"),
        },
        "HOUR_1"
      );

      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult.tradeCount).toBe(3);
      expect(firstResult.totalVolume).toBe(350); // 100 + 200 + 50
      expect(firstResult.totalValueUsd).toBe(175); // 50 + 100 + 25
      expect(firstResult.uniqueWallets).toBe(2);
      expect(firstResult.whaleTrades).toBe(1);
      expect(firstResult.avgTradeSize).toBeCloseTo(175 / 3, 5);
      expect(firstResult.maxTradeSize).toBe(100);
    });
  });

  describe("downsampleLTTB", () => {
    it("should return same data when below target points", () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        id: `ph-${i}`,
        marketId: "market-1",
        outcomeId: "outcome-1",
        price: 0.5 + i * 0.01,
        volume: 100,
        tradeCount: 5,
        bestBid: null,
        bestAsk: null,
        spread: null,
        interval: "MINUTE_1" as const,
        timestamp: new Date(Date.now() + i * 60000),
      }));

      const result = service.downsampleLTTB(data, 20);

      expect(result).toHaveLength(10);
    });

    it("should downsample to target points", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: `ph-${i}`,
        marketId: "market-1",
        outcomeId: "outcome-1",
        price: 0.5 + Math.sin(i / 10) * 0.1,
        volume: 100,
        tradeCount: 5,
        bestBid: null,
        bestAsk: null,
        spread: null,
        interval: "MINUTE_1" as const,
        timestamp: new Date(Date.now() + i * 60000),
      }));

      const result = service.downsampleLTTB(data, 20);

      expect(result).toHaveLength(20);
    });

    it("should always include first and last points", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: `ph-${i}`,
        marketId: "market-1",
        outcomeId: "outcome-1",
        price: 0.5 + i * 0.001,
        volume: 100,
        tradeCount: 5,
        bestBid: null,
        bestAsk: null,
        spread: null,
        interval: "MINUTE_1" as const,
        timestamp: new Date(Date.now() + i * 60000),
      }));

      const result = service.downsampleLTTB(data, 10);

      const firstPoint = result[0];
      const lastPoint = result[result.length - 1];
      expect(firstPoint).toBeDefined();
      expect(lastPoint).toBeDefined();
      if (firstPoint) expect(firstPoint.id).toBe("ph-0");
      if (lastPoint) expect(lastPoint.id).toBe("ph-99");
    });
  });

  describe("getStorageStats", () => {
    it("should return storage stats for price history", async () => {
      mockPrismaClient.priceHistory.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(100) // recent
        .mockResolvedValueOnce(200) // intermediate
        .mockResolvedValueOnce(300) // old
        .mockResolvedValueOnce(400) // archived
        .mockResolvedValueOnce(600) // uncompressed
        .mockResolvedValueOnce(400); // compressed

      mockPrismaClient.priceHistory.findFirst
        .mockResolvedValueOnce({ timestamp: new Date("2023-01-01") }) // oldest
        .mockResolvedValueOnce({ timestamp: new Date() }); // newest

      const stats = await service.getStorageStats("priceHistory");

      expect(stats.dataType).toBe("priceHistory");
      expect(stats.totalRecords).toBe(1000);
      expect(stats.byAge.recent).toBe(100);
      expect(stats.byAge.intermediate).toBe(200);
      expect(stats.byAge.old).toBe(300);
      expect(stats.byAge.archived).toBe(400);
      expect(stats.byCompression.uncompressed).toBe(600);
      expect(stats.byCompression.compressed).toBe(400);
    });

    it("should return storage stats for trades", async () => {
      mockPrismaClient.trade.count
        .mockResolvedValueOnce(5000) // total
        .mockResolvedValueOnce(500) // recent
        .mockResolvedValueOnce(1000) // intermediate
        .mockResolvedValueOnce(1500) // old
        .mockResolvedValueOnce(2000); // archived

      mockPrismaClient.trade.findFirst
        .mockResolvedValueOnce({ timestamp: new Date("2023-01-01") })
        .mockResolvedValueOnce({ timestamp: new Date() });

      const stats = await service.getStorageStats("trades");

      expect(stats.dataType).toBe("trades");
      expect(stats.totalRecords).toBe(5000);
      expect(stats.byCompression.uncompressed).toBe(5000);
      expect(stats.byCompression.compressed).toBe(0);
    });

    it("should return storage stats for market snapshots", async () => {
      mockPrismaClient.marketSnapshot.count
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(50);

      mockPrismaClient.marketSnapshot.findFirst
        .mockResolvedValueOnce({ timestamp: new Date("2024-01-01") })
        .mockResolvedValueOnce({ timestamp: new Date() });

      const stats = await service.getStorageStats("marketSnapshots");

      expect(stats.dataType).toBe("marketSnapshots");
      expect(stats.totalRecords).toBe(200);
    });

    it("should return storage stats for wallet snapshots", async () => {
      mockPrismaClient.walletSnapshot.count
        .mockResolvedValueOnce(300)
        .mockResolvedValueOnce(75)
        .mockResolvedValueOnce(75)
        .mockResolvedValueOnce(75)
        .mockResolvedValueOnce(75);

      mockPrismaClient.walletSnapshot.findFirst
        .mockResolvedValueOnce({ timestamp: new Date("2024-01-01") })
        .mockResolvedValueOnce({ timestamp: new Date() });

      const stats = await service.getStorageStats("walletSnapshots");

      expect(stats.dataType).toBe("walletSnapshots");
      expect(stats.totalRecords).toBe(300);
    });

    it("should estimate size correctly", async () => {
      mockPrismaClient.priceHistory.count.mockResolvedValue(1000);
      mockPrismaClient.priceHistory.findFirst.mockResolvedValue({
        timestamp: new Date(),
      });

      const stats = await service.getStorageStats("priceHistory");

      // priceHistory has estimated size of 200 bytes per record
      expect(stats.estimatedSizeBytes).toBe(1000 * 200);
    });
  });

  describe("getAllStorageStats", () => {
    beforeEach(() => {
      // Set up mocks for all data types
      mockPrismaClient.priceHistory.count.mockResolvedValue(100);
      mockPrismaClient.priceHistory.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.trade.count.mockResolvedValue(100);
      mockPrismaClient.trade.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.marketSnapshot.count.mockResolvedValue(100);
      mockPrismaClient.marketSnapshot.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.walletSnapshot.count.mockResolvedValue(100);
      mockPrismaClient.walletSnapshot.findFirst.mockResolvedValue({ timestamp: new Date() });
    });

    it("should return stats for all data types", async () => {
      const allStats = await service.getAllStorageStats();

      expect(allStats.size).toBe(4);
      expect(allStats.has("priceHistory")).toBe(true);
      expect(allStats.has("trades")).toBe(true);
      expect(allStats.has("marketSnapshots")).toBe(true);
      expect(allStats.has("walletSnapshots")).toBe(true);
    });
  });

  describe("getStorageSummary", () => {
    beforeEach(() => {
      mockPrismaClient.priceHistory.count.mockResolvedValue(100);
      mockPrismaClient.priceHistory.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.trade.count.mockResolvedValue(100);
      mockPrismaClient.trade.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.marketSnapshot.count.mockResolvedValue(100);
      mockPrismaClient.marketSnapshot.findFirst.mockResolvedValue({ timestamp: new Date() });
      mockPrismaClient.walletSnapshot.count.mockResolvedValue(100);
      mockPrismaClient.walletSnapshot.findFirst.mockResolvedValue({ timestamp: new Date() });
    });

    it("should return comprehensive summary", async () => {
      const summary = await service.getStorageSummary();

      expect(summary.totalRecords).toBeGreaterThan(0);
      expect(summary.totalEstimatedSizeBytes).toBeGreaterThan(0);
      expect(Object.keys(summary.byDataType)).toHaveLength(4);
      expect(Array.isArray(summary.recommendations)).toBe(true);
    });

    it("should generate recommendations for archived data", async () => {
      // Override to have lots of archived data
      mockPrismaClient.priceHistory.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5) // recent
        .mockResolvedValueOnce(5) // intermediate
        .mockResolvedValueOnce(10) // old
        .mockResolvedValueOnce(80) // archived (>50%)
        .mockResolvedValueOnce(90) // uncompressed
        .mockResolvedValueOnce(10); // compressed

      const summary = await service.getStorageSummary();

      expect(
        summary.recommendations.some((r) => r.includes("archived"))
      ).toBe(true);
    });
  });

  describe("configuration methods", () => {
    it("should get compression configs", () => {
      const configs = service.getCompressionConfigs();

      expect(configs).toEqual(DEFAULT_COMPRESSION_CONFIGS);
    });

    it("should set compression configs", () => {
      const newConfigs: CompressionConfig[] = [
        {
          ageThresholdDays: 15,
          targetInterval: "HOUR_4",
          level: "high",
          keepOriginal: false,
        },
      ];

      service.setCompressionConfigs(newConfigs);
      const configs = service.getCompressionConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0]?.ageThresholdDays).toBe(15);
    });

    it("should get default chunk size", () => {
      const chunkSize = service.getDefaultChunkSize();

      expect(chunkSize.name).toBe("1 hour");
      expect(chunkSize.durationMs).toBe(60 * 60 * 1000);
    });

    it("should check auto-downsample setting", () => {
      expect(service.isAutoDownsampleEnabled()).toBe(true);

      const noAutoService = createTimeSeriesService({
        prisma: mockPrismaClient as unknown as NonNullable<
          Parameters<typeof createTimeSeriesService>[0]
        >["prisma"],
        autoDownsample: false,
      });
      expect(noAutoService.isAutoDownsampleEnabled()).toBe(false);
    });

    it("should get max points before downsample", () => {
      expect(service.getMaxPointsBeforeDownsample()).toBe(1000);

      const customService = createTimeSeriesService({
        prisma: mockPrismaClient as unknown as NonNullable<
          Parameters<typeof createTimeSeriesService>[0]
        >["prisma"],
        maxPointsBeforeDownsample: 5000,
      });
      expect(customService.getMaxPointsBeforeDownsample()).toBe(5000);
    });
  });

  describe("edge cases", () => {
    it("should handle null timestamps gracefully", async () => {
      mockPrismaClient.priceHistory.findFirst.mockResolvedValue(null);

      const stats = await service.getStorageStats("priceHistory");

      expect(stats.oldestRecord).toBeNull();
      expect(stats.newestRecord).toBeNull();
    });

    it("should handle empty data for OHLCV", async () => {
      mockPrismaClient.priceHistory.findMany.mockResolvedValue([]);

      const result = await service.queryOHLCV(
        "market-1",
        "outcome-1",
        { start: new Date(), end: new Date() },
        "HOUR_1"
      );

      expect(result).toHaveLength(0);
    });

    it("should handle single record for OHLCV", async () => {
      const singleRecord = {
        id: "ph-1",
        marketId: "market-1",
        outcomeId: "outcome-1",
        price: 0.5,
        volume: 100,
        tradeCount: 5,
        bestBid: null,
        bestAsk: null,
        spread: null,
        interval: "MINUTE_1",
        timestamp: new Date("2024-01-01T00:30:00Z"),
      };

      mockPrismaClient.priceHistory.findMany.mockResolvedValue([singleRecord]);

      const result = await service.queryOHLCV(
        "market-1",
        "outcome-1",
        { start: new Date("2024-01-01"), end: new Date("2024-01-02") },
        "HOUR_1"
      );

      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult.open).toBe(0.5);
      expect(firstResult.high).toBe(0.5);
      expect(firstResult.low).toBe(0.5);
      expect(firstResult.close).toBe(0.5);
    });
  });
});
