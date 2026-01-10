/**
 * Snapshot Database Service Tests
 *
 * Unit tests for the SnapshotService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  MarketSnapshot,
  WalletSnapshot,
  Market,
  Wallet,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  SnapshotService,
  createSnapshotService,
  type CreateMarketSnapshotInput,
  type CreateWalletSnapshotInput,
  type MarketSnapshotFilters,
  type WalletSnapshotFilters,
  type MarketSnapshotSortOptions,
  type WalletSnapshotSortOptions,
  type SnapshotPaginationOptions,
  type TimeRange,
} from "../../src/db/snapshots";

// Mock market snapshot data
const mockMarketSnapshot: MarketSnapshot = {
  id: "snapshot-market-1",
  marketId: "market-0x1234",
  state: { question: "Will Bitcoin reach $100k?", category: "crypto" },
  outcomePrices: { Yes: 0.65, No: 0.35 },
  volume: 1500000,
  liquidity: 250000,
  timestamp: new Date("2024-06-15T12:00:00Z"),
};

const mockMarketSnapshot2: MarketSnapshot = {
  id: "snapshot-market-2",
  marketId: "market-0x1234",
  state: { question: "Will Bitcoin reach $100k?", category: "crypto" },
  outcomePrices: { Yes: 0.70, No: 0.30 },
  volume: 1600000,
  liquidity: 260000,
  timestamp: new Date("2024-06-16T12:00:00Z"),
};

const mockMarketSnapshot3: MarketSnapshot = {
  id: "snapshot-market-3",
  marketId: "market-0x5678",
  state: { question: "Will ETH flip BTC?", category: "crypto" },
  outcomePrices: { Yes: 0.15, No: 0.85 },
  volume: 800000,
  liquidity: 150000,
  timestamp: new Date("2024-06-15T12:00:00Z"),
};

// Mock wallet snapshot data
const mockWalletSnapshot: WalletSnapshot = {
  id: "snapshot-wallet-1",
  walletId: "wallet-1234",
  totalVolume: 500000,
  totalPnl: 25000,
  tradeCount: 150,
  winRate: 62.5,
  suspicionScore: 15,
  positions: { "market-1": { outcome: "Yes", shares: 1000 } },
  timestamp: new Date("2024-06-15T12:00:00Z"),
};

const mockWalletSnapshot2: WalletSnapshot = {
  id: "snapshot-wallet-2",
  walletId: "wallet-1234",
  totalVolume: 550000,
  totalPnl: 28000,
  tradeCount: 165,
  winRate: 63.0,
  suspicionScore: 12,
  positions: { "market-1": { outcome: "Yes", shares: 1200 } },
  timestamp: new Date("2024-06-16T12:00:00Z"),
};

const mockWalletSnapshot3: WalletSnapshot = {
  id: "snapshot-wallet-3",
  walletId: "wallet-5678",
  totalVolume: 100000,
  totalPnl: -5000,
  tradeCount: 25,
  winRate: 40.0,
  suspicionScore: 75,
  positions: null,
  timestamp: new Date("2024-06-15T12:00:00Z"),
};

// Mock market data
const mockMarket: Market = {
  id: "market-0x1234",
  slug: "will-bitcoin-reach-100k",
  question: "Will Bitcoin reach $100k by end of 2024?",
  description: "This market resolves to Yes if Bitcoin reaches $100,000",
  category: "crypto",
  subcategory: "bitcoin",
  tags: ["crypto", "bitcoin", "price"],
  imageUrl: "https://example.com/btc.png",
  iconUrl: "https://example.com/btc-icon.png",
  resolutionSource: "CoinGecko",
  resolvedBy: null,
  resolution: null,
  endDate: new Date("2024-12-31T23:59:59Z"),
  resolvedAt: null,
  active: true,
  closed: false,
  archived: false,
  volume: 1500000,
  volume24h: 50000,
  liquidity: 250000,
  tradeCount: 5000,
  uniqueTraders: 1200,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T12:00:00Z"),
};

// Mock wallet data
const mockWallet: Wallet = {
  id: "wallet-1234",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  label: "Whale Trader",
  walletType: "EOA",
  isWhale: true,
  isInsider: false,
  isFresh: false,
  isMonitored: true,
  isFlagged: false,
  isSanctioned: false,
  suspicionScore: 15,
  riskLevel: "LOW",
  totalVolume: 500000,
  totalPnl: 25000,
  tradeCount: 150,
  winCount: 94,
  winRate: 62.5,
  avgTradeSize: 3333,
  maxTradeSize: 50000,
  firstTradeAt: new Date("2023-01-01T00:00:00Z"),
  lastTradeAt: new Date("2024-06-15T12:00:00Z"),
  walletCreatedAt: new Date("2022-06-15T00:00:00Z"),
  onChainTxCount: 500,
  walletAgeDays: 730,
  primaryFundingSource: "EXCHANGE",
  metadata: null,
  notes: null,
  createdAt: new Date("2023-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T12:00:00Z"),
};

/**
 * Create a mock Prisma client for testing
 */
function createMockPrismaClient() {
  return {
    marketSnapshot: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    walletSnapshot: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  } as unknown as PrismaClient;
}

describe("SnapshotService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: SnapshotService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createSnapshotService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // CONSTRUCTOR TESTS
  // ===========================================================================

  describe("constructor", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new SnapshotService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(SnapshotService);
    });

    it("should create service with createSnapshotService factory", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createSnapshotService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(SnapshotService);
    });

    it("should accept custom retention days", () => {
      const customService = new SnapshotService({
        prisma: mockPrisma,
        defaultRetentionDays: 30,
      });
      expect(customService).toBeInstanceOf(SnapshotService);
    });
  });

  // ===========================================================================
  // MARKET SNAPSHOT CRUD TESTS
  // ===========================================================================

  describe("createMarketSnapshot", () => {
    it("should create a market snapshot with required fields", async () => {
      const input: CreateMarketSnapshotInput = {
        marketId: mockMarketSnapshot.marketId,
        state: mockMarketSnapshot.state as object,
        outcomePrices: mockMarketSnapshot.outcomePrices as object,
        volume: mockMarketSnapshot.volume,
        liquidity: mockMarketSnapshot.liquidity,
      };

      vi.mocked(mockPrisma.marketSnapshot.create).mockResolvedValue(mockMarketSnapshot);

      const result = await service.createMarketSnapshot(input);

      expect(mockPrisma.marketSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          marketId: input.marketId,
          state: input.state,
          outcomePrices: input.outcomePrices,
          volume: input.volume,
          liquidity: input.liquidity,
          timestamp: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockMarketSnapshot);
    });

    it("should create a market snapshot with custom timestamp", async () => {
      const customTimestamp = new Date("2024-01-01T00:00:00Z");
      const input: CreateMarketSnapshotInput = {
        marketId: mockMarketSnapshot.marketId,
        state: mockMarketSnapshot.state as object,
        outcomePrices: mockMarketSnapshot.outcomePrices as object,
        volume: mockMarketSnapshot.volume,
        liquidity: mockMarketSnapshot.liquidity,
        timestamp: customTimestamp,
      };

      vi.mocked(mockPrisma.marketSnapshot.create).mockResolvedValue({
        ...mockMarketSnapshot,
        timestamp: customTimestamp,
      });

      const result = await service.createMarketSnapshot(input);

      expect(mockPrisma.marketSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timestamp: customTimestamp,
        }),
      });
      expect(result.timestamp).toEqual(customTimestamp);
    });
  });

  describe("createManyMarketSnapshots", () => {
    it("should create multiple market snapshots", async () => {
      const inputs: CreateMarketSnapshotInput[] = [
        {
          marketId: mockMarketSnapshot.marketId,
          state: mockMarketSnapshot.state as object,
          outcomePrices: mockMarketSnapshot.outcomePrices as object,
          volume: mockMarketSnapshot.volume,
          liquidity: mockMarketSnapshot.liquidity,
        },
        {
          marketId: mockMarketSnapshot3.marketId,
          state: mockMarketSnapshot3.state as object,
          outcomePrices: mockMarketSnapshot3.outcomePrices as object,
          volume: mockMarketSnapshot3.volume,
          liquidity: mockMarketSnapshot3.liquidity,
        },
      ];

      vi.mocked(mockPrisma.marketSnapshot.createMany).mockResolvedValue({ count: 2 });

      const result = await service.createManyMarketSnapshots(inputs);

      expect(mockPrisma.marketSnapshot.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ marketId: mockMarketSnapshot.marketId }),
          expect.objectContaining({ marketId: mockMarketSnapshot3.marketId }),
        ]),
      });
      expect(result.count).toBe(2);
    });
  });

  describe("findMarketSnapshotById", () => {
    it("should find market snapshot by id", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findUnique).mockResolvedValue(mockMarketSnapshot);

      const result = await service.findMarketSnapshotById(mockMarketSnapshot.id);

      expect(mockPrisma.marketSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: mockMarketSnapshot.id },
        include: undefined,
      });
      expect(result).toEqual(mockMarketSnapshot);
    });

    it("should return null when not found", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findUnique).mockResolvedValue(null);

      const result = await service.findMarketSnapshotById("non-existent");

      expect(result).toBeNull();
    });

    it("should include market relation when requested", async () => {
      const snapshotWithMarket = { ...mockMarketSnapshot, market: mockMarket };
      vi.mocked(mockPrisma.marketSnapshot.findUnique).mockResolvedValue(snapshotWithMarket);

      const result = await service.findMarketSnapshotById(mockMarketSnapshot.id, true);

      expect(mockPrisma.marketSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: mockMarketSnapshot.id },
        include: { market: true },
      });
      expect(result).toEqual(snapshotWithMarket);
    });
  });

  describe("findMarketSnapshotsByIds", () => {
    it("should find multiple market snapshots by ids", async () => {
      const snapshots = [mockMarketSnapshot, mockMarketSnapshot2];
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue(snapshots);

      const result = await service.findMarketSnapshotsByIds([
        mockMarketSnapshot.id,
        mockMarketSnapshot2.id,
      ]);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith({
        where: { id: { in: [mockMarketSnapshot.id, mockMarketSnapshot2.id] } },
        include: undefined,
      });
      expect(result).toEqual(snapshots);
    });
  });

  describe("deleteMarketSnapshot", () => {
    it("should delete a market snapshot", async () => {
      vi.mocked(mockPrisma.marketSnapshot.delete).mockResolvedValue(mockMarketSnapshot);

      const result = await service.deleteMarketSnapshot(mockMarketSnapshot.id);

      expect(mockPrisma.marketSnapshot.delete).toHaveBeenCalledWith({
        where: { id: mockMarketSnapshot.id },
      });
      expect(result).toEqual(mockMarketSnapshot);
    });
  });

  describe("deleteManyMarketSnapshots", () => {
    it("should delete multiple market snapshots", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 2 });

      const result = await service.deleteManyMarketSnapshots([
        mockMarketSnapshot.id,
        mockMarketSnapshot2.id,
      ]);

      expect(mockPrisma.marketSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [mockMarketSnapshot.id, mockMarketSnapshot2.id] } },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("findManyMarketSnapshots", () => {
    it("should find all market snapshots without filters", async () => {
      const snapshots = [mockMarketSnapshot, mockMarketSnapshot2, mockMarketSnapshot3];
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue(snapshots);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(3);

      const result = await service.findManyMarketSnapshots();

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.snapshots).toEqual(snapshots);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by marketId", async () => {
      const snapshots = [mockMarketSnapshot, mockMarketSnapshot2];
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue(snapshots);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(2);

      const filters: MarketSnapshotFilters = { marketId: mockMarketSnapshot.marketId };
      await service.findManyMarketSnapshots(filters);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: mockMarketSnapshot.marketId },
        })
      );
    });

    it("should filter by multiple marketIds", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const filters: MarketSnapshotFilters = {
        marketIds: [mockMarketSnapshot.marketId, mockMarketSnapshot3.marketId],
      };
      await service.findManyMarketSnapshots(filters);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            marketId: { in: [mockMarketSnapshot.marketId, mockMarketSnapshot3.marketId] },
          },
        })
      );
    });

    it("should filter by timestamp range", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const after = new Date("2024-06-01T00:00:00Z");
      const before = new Date("2024-06-30T00:00:00Z");
      const filters: MarketSnapshotFilters = {
        timestampAfter: after,
        timestampBefore: before,
      };
      await service.findManyMarketSnapshots(filters);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: { gte: after, lte: before },
          },
        })
      );
    });

    it("should filter by volume range", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const filters: MarketSnapshotFilters = {
        minVolume: 1000000,
        maxVolume: 2000000,
      };
      await service.findManyMarketSnapshots(filters);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            volume: { gte: 1000000, lte: 2000000 },
          },
        })
      );
    });

    it("should filter by liquidity range", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const filters: MarketSnapshotFilters = {
        minLiquidity: 100000,
        maxLiquidity: 500000,
      };
      await service.findManyMarketSnapshots(filters);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            liquidity: { gte: 100000, lte: 500000 },
          },
        })
      );
    });

    it("should sort by specified field", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const sort: MarketSnapshotSortOptions = { field: "volume", direction: "asc" };
      await service.findManyMarketSnapshots({}, sort);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { volume: "asc" },
        })
      );
    });

    it("should paginate results", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([mockMarketSnapshot]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(100);

      const pagination: SnapshotPaginationOptions = { skip: 10, take: 20 };
      const result = await service.findManyMarketSnapshots({}, undefined, pagination);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 20,
        })
      );
      expect(result.skip).toBe(10);
      expect(result.take).toBe(20);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("findMarketSnapshotsByMarket", () => {
    it("should find snapshots for a specific market", async () => {
      const snapshots = [mockMarketSnapshot, mockMarketSnapshot2];
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue(snapshots);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(2);

      const result = await service.findMarketSnapshotsByMarket(mockMarketSnapshot.marketId);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: mockMarketSnapshot.marketId },
          orderBy: { timestamp: "asc" },
        })
      );
      expect(result.snapshots).toEqual(snapshots);
    });

    it("should filter by time range when provided", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const timeRange: TimeRange = {
        start: new Date("2024-06-01T00:00:00Z"),
        end: new Date("2024-06-30T00:00:00Z"),
      };
      await service.findMarketSnapshotsByMarket(
        mockMarketSnapshot.marketId,
        timeRange
      );

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            marketId: mockMarketSnapshot.marketId,
            timestamp: { gte: timeRange.start, lte: timeRange.end },
          },
        })
      );
    });
  });

  describe("getLatestMarketSnapshot", () => {
    it("should get the latest snapshot for a market", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findFirst).mockResolvedValue(mockMarketSnapshot2);

      const result = await service.getLatestMarketSnapshot(mockMarketSnapshot.marketId);

      expect(mockPrisma.marketSnapshot.findFirst).toHaveBeenCalledWith({
        where: { marketId: mockMarketSnapshot.marketId },
        orderBy: { timestamp: "desc" },
        include: undefined,
      });
      expect(result).toEqual(mockMarketSnapshot2);
    });

    it("should return null when no snapshots exist", async () => {
      vi.mocked(mockPrisma.marketSnapshot.findFirst).mockResolvedValue(null);

      const result = await service.getLatestMarketSnapshot("non-existent-market");

      expect(result).toBeNull();
    });
  });

  describe("getLatestMarketSnapshots", () => {
    it("should get latest snapshots for multiple markets", async () => {
      const snapshots = [mockMarketSnapshot2, mockMarketSnapshot3];
      vi.mocked(mockPrisma.marketSnapshot.findMany).mockResolvedValue(snapshots);

      const result = await service.getLatestMarketSnapshots([
        mockMarketSnapshot.marketId,
        mockMarketSnapshot3.marketId,
      ]);

      expect(mockPrisma.marketSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          marketId: { in: [mockMarketSnapshot.marketId, mockMarketSnapshot3.marketId] },
        },
        orderBy: { timestamp: "desc" },
        distinct: ["marketId"],
      });
      expect(result.get(mockMarketSnapshot2.marketId)).toEqual(mockMarketSnapshot2);
      expect(result.get(mockMarketSnapshot3.marketId)).toEqual(mockMarketSnapshot3);
    });
  });

  describe("countMarketSnapshots", () => {
    it("should count market snapshots", async () => {
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(5);

      const result = await service.countMarketSnapshots();

      expect(result).toBe(5);
    });

    it("should count with filters", async () => {
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(2);

      const result = await service.countMarketSnapshots({
        marketId: mockMarketSnapshot.marketId,
      });

      expect(mockPrisma.marketSnapshot.count).toHaveBeenCalledWith({
        where: { marketId: mockMarketSnapshot.marketId },
      });
      expect(result).toBe(2);
    });
  });

  describe("getMarketSnapshotStats", () => {
    it("should get aggregate statistics", async () => {
      vi.mocked(mockPrisma.marketSnapshot.aggregate).mockResolvedValue({
        _count: { id: 10 },
        _avg: { volume: 1000000, liquidity: 200000 },
        _max: { volume: 2000000 },
        _min: { volume: 500000 },
      } as never);
      vi.mocked(mockPrisma.marketSnapshot.findFirst)
        .mockResolvedValueOnce({ timestamp: new Date("2024-01-01") } as MarketSnapshot)
        .mockResolvedValueOnce({ timestamp: new Date("2024-06-15") } as MarketSnapshot);

      const result = await service.getMarketSnapshotStats();

      expect(result.count).toBe(10);
      expect(result.avgVolume).toBe(1000000);
      expect(result.avgLiquidity).toBe(200000);
      expect(result.maxVolume).toBe(2000000);
      expect(result.minVolume).toBe(500000);
      expect(result.earliest).toEqual(new Date("2024-01-01"));
      expect(result.latest).toEqual(new Date("2024-06-15"));
    });

    it("should handle empty results", async () => {
      vi.mocked(mockPrisma.marketSnapshot.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _avg: { volume: null, liquidity: null },
        _max: { volume: null },
        _min: { volume: null },
      } as never);
      vi.mocked(mockPrisma.marketSnapshot.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getMarketSnapshotStats();

      expect(result.count).toBe(0);
      expect(result.avgVolume).toBe(0);
      expect(result.earliest).toBeNull();
      expect(result.latest).toBeNull();
    });
  });

  describe("deleteOldMarketSnapshots", () => {
    it("should delete snapshots older than specified date", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 5 });

      const olderThan = new Date("2024-01-01T00:00:00Z");
      const result = await service.deleteOldMarketSnapshots(olderThan);

      expect(mockPrisma.marketSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: olderThan } },
      });
      expect(result.count).toBe(5);
    });

    it("should limit deletion to specific market when marketId provided", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 2 });

      const olderThan = new Date("2024-01-01T00:00:00Z");
      const result = await service.deleteOldMarketSnapshots(
        olderThan,
        mockMarketSnapshot.marketId
      );

      expect(mockPrisma.marketSnapshot.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: olderThan },
          marketId: mockMarketSnapshot.marketId,
        },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("cleanupOldMarketSnapshots", () => {
    it("should use default retention days", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 10 });

      await service.cleanupOldMarketSnapshots();

      expect(mockPrisma.marketSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: expect.any(Date) } },
      });
    });

    it("should use custom retention days", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 5 });

      await service.cleanupOldMarketSnapshots(30);

      expect(mockPrisma.marketSnapshot.deleteMany).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // WALLET SNAPSHOT CRUD TESTS
  // ===========================================================================

  describe("createWalletSnapshot", () => {
    it("should create a wallet snapshot with required fields", async () => {
      const input: CreateWalletSnapshotInput = {
        walletId: mockWalletSnapshot.walletId,
        totalVolume: mockWalletSnapshot.totalVolume,
        totalPnl: mockWalletSnapshot.totalPnl,
        tradeCount: mockWalletSnapshot.tradeCount,
        suspicionScore: mockWalletSnapshot.suspicionScore,
      };

      vi.mocked(mockPrisma.walletSnapshot.create).mockResolvedValue(mockWalletSnapshot);

      const result = await service.createWalletSnapshot(input);

      expect(mockPrisma.walletSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletId: input.walletId,
          totalVolume: input.totalVolume,
          totalPnl: input.totalPnl,
          tradeCount: input.tradeCount,
          suspicionScore: input.suspicionScore,
          winRate: null,
          positions: Prisma.DbNull,
          timestamp: expect.any(Date),
        }),
      });
      expect(result).toEqual(mockWalletSnapshot);
    });

    it("should create a wallet snapshot with all fields", async () => {
      const input: CreateWalletSnapshotInput = {
        walletId: mockWalletSnapshot.walletId,
        totalVolume: mockWalletSnapshot.totalVolume,
        totalPnl: mockWalletSnapshot.totalPnl,
        tradeCount: mockWalletSnapshot.tradeCount,
        winRate: mockWalletSnapshot.winRate,
        suspicionScore: mockWalletSnapshot.suspicionScore,
        positions: mockWalletSnapshot.positions as object,
        timestamp: mockWalletSnapshot.timestamp,
      };

      vi.mocked(mockPrisma.walletSnapshot.create).mockResolvedValue(mockWalletSnapshot);

      const result = await service.createWalletSnapshot(input);

      expect(mockPrisma.walletSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          winRate: mockWalletSnapshot.winRate,
          positions: mockWalletSnapshot.positions,
          timestamp: mockWalletSnapshot.timestamp,
        }),
      });
      expect(result).toEqual(mockWalletSnapshot);
    });
  });

  describe("createManyWalletSnapshots", () => {
    it("should create multiple wallet snapshots", async () => {
      const inputs: CreateWalletSnapshotInput[] = [
        {
          walletId: mockWalletSnapshot.walletId,
          totalVolume: mockWalletSnapshot.totalVolume,
          totalPnl: mockWalletSnapshot.totalPnl,
          tradeCount: mockWalletSnapshot.tradeCount,
          suspicionScore: mockWalletSnapshot.suspicionScore,
        },
        {
          walletId: mockWalletSnapshot3.walletId,
          totalVolume: mockWalletSnapshot3.totalVolume,
          totalPnl: mockWalletSnapshot3.totalPnl,
          tradeCount: mockWalletSnapshot3.tradeCount,
          suspicionScore: mockWalletSnapshot3.suspicionScore,
        },
      ];

      vi.mocked(mockPrisma.walletSnapshot.createMany).mockResolvedValue({ count: 2 });

      const result = await service.createManyWalletSnapshots(inputs);

      expect(mockPrisma.walletSnapshot.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ walletId: mockWalletSnapshot.walletId }),
          expect.objectContaining({ walletId: mockWalletSnapshot3.walletId }),
        ]),
      });
      expect(result.count).toBe(2);
    });
  });

  describe("findWalletSnapshotById", () => {
    it("should find wallet snapshot by id", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findUnique).mockResolvedValue(mockWalletSnapshot);

      const result = await service.findWalletSnapshotById(mockWalletSnapshot.id);

      expect(mockPrisma.walletSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: mockWalletSnapshot.id },
        include: undefined,
      });
      expect(result).toEqual(mockWalletSnapshot);
    });

    it("should return null when not found", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findUnique).mockResolvedValue(null);

      const result = await service.findWalletSnapshotById("non-existent");

      expect(result).toBeNull();
    });

    it("should include wallet relation when requested", async () => {
      const snapshotWithWallet = { ...mockWalletSnapshot, wallet: mockWallet };
      vi.mocked(mockPrisma.walletSnapshot.findUnique).mockResolvedValue(snapshotWithWallet);

      const result = await service.findWalletSnapshotById(mockWalletSnapshot.id, true);

      expect(mockPrisma.walletSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: mockWalletSnapshot.id },
        include: { wallet: true },
      });
      expect(result).toEqual(snapshotWithWallet);
    });
  });

  describe("findWalletSnapshotsByIds", () => {
    it("should find multiple wallet snapshots by ids", async () => {
      const snapshots = [mockWalletSnapshot, mockWalletSnapshot2];
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue(snapshots);

      const result = await service.findWalletSnapshotsByIds([
        mockWalletSnapshot.id,
        mockWalletSnapshot2.id,
      ]);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith({
        where: { id: { in: [mockWalletSnapshot.id, mockWalletSnapshot2.id] } },
        include: undefined,
      });
      expect(result).toEqual(snapshots);
    });
  });

  describe("deleteWalletSnapshot", () => {
    it("should delete a wallet snapshot", async () => {
      vi.mocked(mockPrisma.walletSnapshot.delete).mockResolvedValue(mockWalletSnapshot);

      const result = await service.deleteWalletSnapshot(mockWalletSnapshot.id);

      expect(mockPrisma.walletSnapshot.delete).toHaveBeenCalledWith({
        where: { id: mockWalletSnapshot.id },
      });
      expect(result).toEqual(mockWalletSnapshot);
    });
  });

  describe("deleteManyWalletSnapshots", () => {
    it("should delete multiple wallet snapshots", async () => {
      vi.mocked(mockPrisma.walletSnapshot.deleteMany).mockResolvedValue({ count: 2 });

      const result = await service.deleteManyWalletSnapshots([
        mockWalletSnapshot.id,
        mockWalletSnapshot2.id,
      ]);

      expect(mockPrisma.walletSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [mockWalletSnapshot.id, mockWalletSnapshot2.id] } },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("findManyWalletSnapshots", () => {
    it("should find all wallet snapshots without filters", async () => {
      const snapshots = [mockWalletSnapshot, mockWalletSnapshot2, mockWalletSnapshot3];
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue(snapshots);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(3);

      const result = await service.findManyWalletSnapshots();

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.snapshots).toEqual(snapshots);
      expect(result.total).toBe(3);
    });

    it("should filter by walletId", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const filters: WalletSnapshotFilters = { walletId: mockWalletSnapshot.walletId };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: mockWalletSnapshot.walletId },
        })
      );
    });

    it("should filter by multiple walletIds", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const filters: WalletSnapshotFilters = {
        walletIds: [mockWalletSnapshot.walletId, mockWalletSnapshot3.walletId],
      };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            walletId: { in: [mockWalletSnapshot.walletId, mockWalletSnapshot3.walletId] },
          },
        })
      );
    });

    it("should filter by timestamp range", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const after = new Date("2024-06-01T00:00:00Z");
      const before = new Date("2024-06-30T00:00:00Z");
      const filters: WalletSnapshotFilters = {
        timestampAfter: after,
        timestampBefore: before,
      };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: { gte: after, lte: before },
          },
        })
      );
    });

    it("should filter by totalVolume range", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const filters: WalletSnapshotFilters = {
        minTotalVolume: 100000,
        maxTotalVolume: 500000,
      };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            totalVolume: { gte: 100000, lte: 500000 },
          },
        })
      );
    });

    it("should filter by suspicionScore range", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const filters: WalletSnapshotFilters = {
        minSuspicionScore: 50,
        maxSuspicionScore: 100,
      };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            suspicionScore: { gte: 50, lte: 100 },
          },
        })
      );
    });

    it("should filter by pnl range", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const filters: WalletSnapshotFilters = {
        minPnl: -10000,
        maxPnl: 50000,
      };
      await service.findManyWalletSnapshots(filters);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            totalPnl: { gte: -10000, lte: 50000 },
          },
        })
      );
    });

    it("should sort by specified field", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const sort: WalletSnapshotSortOptions = { field: "suspicionScore", direction: "desc" };
      await service.findManyWalletSnapshots({}, sort);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { suspicionScore: "desc" },
        })
      );
    });

    it("should paginate results", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([mockWalletSnapshot]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(100);

      const pagination: SnapshotPaginationOptions = { skip: 10, take: 20 };
      const result = await service.findManyWalletSnapshots({}, undefined, pagination);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 20,
        })
      );
      expect(result.hasMore).toBe(true);
    });
  });

  describe("findWalletSnapshotsByWallet", () => {
    it("should find snapshots for a specific wallet", async () => {
      const snapshots = [mockWalletSnapshot, mockWalletSnapshot2];
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue(snapshots);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(2);

      const result = await service.findWalletSnapshotsByWallet(mockWalletSnapshot.walletId);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: mockWalletSnapshot.walletId },
          orderBy: { timestamp: "asc" },
        })
      );
      expect(result.snapshots).toEqual(snapshots);
    });

    it("should filter by time range when provided", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const timeRange: TimeRange = {
        start: new Date("2024-06-01T00:00:00Z"),
        end: new Date("2024-06-30T00:00:00Z"),
      };
      await service.findWalletSnapshotsByWallet(mockWalletSnapshot.walletId, timeRange);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            walletId: mockWalletSnapshot.walletId,
            timestamp: { gte: timeRange.start, lte: timeRange.end },
          },
        })
      );
    });
  });

  describe("getLatestWalletSnapshot", () => {
    it("should get the latest snapshot for a wallet", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findFirst).mockResolvedValue(mockWalletSnapshot2);

      const result = await service.getLatestWalletSnapshot(mockWalletSnapshot.walletId);

      expect(mockPrisma.walletSnapshot.findFirst).toHaveBeenCalledWith({
        where: { walletId: mockWalletSnapshot.walletId },
        orderBy: { timestamp: "desc" },
        include: undefined,
      });
      expect(result).toEqual(mockWalletSnapshot2);
    });

    it("should return null when no snapshots exist", async () => {
      vi.mocked(mockPrisma.walletSnapshot.findFirst).mockResolvedValue(null);

      const result = await service.getLatestWalletSnapshot("non-existent-wallet");

      expect(result).toBeNull();
    });
  });

  describe("getLatestWalletSnapshots", () => {
    it("should get latest snapshots for multiple wallets", async () => {
      const snapshots = [mockWalletSnapshot2, mockWalletSnapshot3];
      vi.mocked(mockPrisma.walletSnapshot.findMany).mockResolvedValue(snapshots);

      const result = await service.getLatestWalletSnapshots([
        mockWalletSnapshot.walletId,
        mockWalletSnapshot3.walletId,
      ]);

      expect(mockPrisma.walletSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          walletId: { in: [mockWalletSnapshot.walletId, mockWalletSnapshot3.walletId] },
        },
        orderBy: { timestamp: "desc" },
        distinct: ["walletId"],
      });
      expect(result.get(mockWalletSnapshot2.walletId)).toEqual(mockWalletSnapshot2);
      expect(result.get(mockWalletSnapshot3.walletId)).toEqual(mockWalletSnapshot3);
    });
  });

  describe("countWalletSnapshots", () => {
    it("should count wallet snapshots", async () => {
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(5);

      const result = await service.countWalletSnapshots();

      expect(result).toBe(5);
    });

    it("should count with filters", async () => {
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(2);

      const result = await service.countWalletSnapshots({
        walletId: mockWalletSnapshot.walletId,
      });

      expect(mockPrisma.walletSnapshot.count).toHaveBeenCalledWith({
        where: { walletId: mockWalletSnapshot.walletId },
      });
      expect(result).toBe(2);
    });
  });

  describe("getWalletSnapshotStats", () => {
    it("should get aggregate statistics", async () => {
      vi.mocked(mockPrisma.walletSnapshot.aggregate).mockResolvedValue({
        _count: { id: 10 },
        _avg: { totalVolume: 300000, totalPnl: 15000, suspicionScore: 30 },
        _max: { totalVolume: 500000, totalPnl: 50000 },
      } as never);
      vi.mocked(mockPrisma.walletSnapshot.findFirst)
        .mockResolvedValueOnce({ timestamp: new Date("2024-01-01") } as WalletSnapshot)
        .mockResolvedValueOnce({ timestamp: new Date("2024-06-15") } as WalletSnapshot);

      const result = await service.getWalletSnapshotStats();

      expect(result.count).toBe(10);
      expect(result.avgTotalVolume).toBe(300000);
      expect(result.avgPnl).toBe(15000);
      expect(result.avgSuspicionScore).toBe(30);
      expect(result.maxTotalVolume).toBe(500000);
      expect(result.maxPnl).toBe(50000);
      expect(result.earliest).toEqual(new Date("2024-01-01"));
      expect(result.latest).toEqual(new Date("2024-06-15"));
    });

    it("should handle empty results", async () => {
      vi.mocked(mockPrisma.walletSnapshot.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _avg: { totalVolume: null, totalPnl: null, suspicionScore: null },
        _max: { totalVolume: null, totalPnl: null },
      } as never);
      vi.mocked(mockPrisma.walletSnapshot.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getWalletSnapshotStats();

      expect(result.count).toBe(0);
      expect(result.avgTotalVolume).toBe(0);
      expect(result.earliest).toBeNull();
    });
  });

  describe("deleteOldWalletSnapshots", () => {
    it("should delete snapshots older than specified date", async () => {
      vi.mocked(mockPrisma.walletSnapshot.deleteMany).mockResolvedValue({ count: 5 });

      const olderThan = new Date("2024-01-01T00:00:00Z");
      const result = await service.deleteOldWalletSnapshots(olderThan);

      expect(mockPrisma.walletSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: olderThan } },
      });
      expect(result.count).toBe(5);
    });

    it("should limit deletion to specific wallet when walletId provided", async () => {
      vi.mocked(mockPrisma.walletSnapshot.deleteMany).mockResolvedValue({ count: 2 });

      const olderThan = new Date("2024-01-01T00:00:00Z");
      const result = await service.deleteOldWalletSnapshots(
        olderThan,
        mockWalletSnapshot.walletId
      );

      expect(mockPrisma.walletSnapshot.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: olderThan },
          walletId: mockWalletSnapshot.walletId,
        },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("cleanupOldWalletSnapshots", () => {
    it("should use default retention days", async () => {
      vi.mocked(mockPrisma.walletSnapshot.deleteMany).mockResolvedValue({ count: 10 });

      await service.cleanupOldWalletSnapshots();

      expect(mockPrisma.walletSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: expect.any(Date) } },
      });
    });
  });

  // ===========================================================================
  // COMBINED OPERATIONS TESTS
  // ===========================================================================

  describe("createCombinedSnapshots", () => {
    it("should create market and wallet snapshots in a transaction", async () => {
      const marketInput: CreateMarketSnapshotInput = {
        marketId: mockMarketSnapshot.marketId,
        state: mockMarketSnapshot.state as object,
        outcomePrices: mockMarketSnapshot.outcomePrices as object,
        volume: mockMarketSnapshot.volume,
        liquidity: mockMarketSnapshot.liquidity,
      };

      const walletInputs: CreateWalletSnapshotInput[] = [
        {
          walletId: mockWalletSnapshot.walletId,
          totalVolume: mockWalletSnapshot.totalVolume,
          totalPnl: mockWalletSnapshot.totalPnl,
          tradeCount: mockWalletSnapshot.tradeCount,
          suspicionScore: mockWalletSnapshot.suspicionScore,
        },
      ];

      const mockTx = {
        marketSnapshot: {
          create: vi.fn().mockResolvedValue(mockMarketSnapshot),
        },
        walletSnapshot: {
          create: vi.fn().mockResolvedValue(mockWalletSnapshot),
        },
      };

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (fn) => {
        return fn(mockTx as unknown as Parameters<Parameters<typeof mockPrisma.$transaction>[0]>[0]);
      });

      const result = await service.createCombinedSnapshots(marketInput, walletInputs);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.marketSnapshot).toEqual(mockMarketSnapshot);
      expect(result.walletSnapshots).toHaveLength(1);
      expect(result.walletSnapshots[0]).toEqual(mockWalletSnapshot);
    });
  });

  describe("cleanupAllOldSnapshots", () => {
    it("should cleanup both market and wallet snapshots", async () => {
      vi.mocked(mockPrisma.marketSnapshot.deleteMany).mockResolvedValue({ count: 5 });
      vi.mocked(mockPrisma.walletSnapshot.deleteMany).mockResolvedValue({ count: 3 });

      const result = await service.cleanupAllOldSnapshots();

      expect(result.marketSnapshots.count).toBe(5);
      expect(result.walletSnapshots.count).toBe(3);
    });
  });

  describe("getTotalSnapshotCounts", () => {
    it("should return counts for both snapshot types", async () => {
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(100);
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(50);

      const result = await service.getTotalSnapshotCounts();

      expect(result.marketSnapshots).toBe(100);
      expect(result.walletSnapshots).toBe(50);
      expect(result.total).toBe(150);
    });
  });

  describe("marketHasSnapshots", () => {
    it("should return true when market has snapshots", async () => {
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(5);

      const result = await service.marketHasSnapshots(mockMarketSnapshot.marketId);

      expect(result).toBe(true);
    });

    it("should return false when market has no snapshots", async () => {
      vi.mocked(mockPrisma.marketSnapshot.count).mockResolvedValue(0);

      const result = await service.marketHasSnapshots("market-without-snapshots");

      expect(result).toBe(false);
    });
  });

  describe("walletHasSnapshots", () => {
    it("should return true when wallet has snapshots", async () => {
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(5);

      const result = await service.walletHasSnapshots(mockWalletSnapshot.walletId);

      expect(result).toBe(true);
    });

    it("should return false when wallet has no snapshots", async () => {
      vi.mocked(mockPrisma.walletSnapshot.count).mockResolvedValue(0);

      const result = await service.walletHasSnapshots("wallet-without-snapshots");

      expect(result).toBe(false);
    });
  });
});
