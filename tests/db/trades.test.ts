/**
 * Trade Database Service Tests
 *
 * Unit tests for the TradeService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Trade, Market, Outcome, Wallet, PrismaClient } from "@prisma/client";
import { TradeSide } from "@prisma/client";
import {
  TradeService,
  createTradeService,
  type CreateTradeInput,
  type UpdateTradeInput,
  type TradeSortOptions,
} from "../../src/db/trades";

// Mock market data
const mockMarket: Market = {
  id: "0x1234567890abcdef",
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

const mockOutcome: Outcome = {
  id: "outcome-1",
  marketId: mockMarket.id,
  name: "Yes",
  clobTokenId: "token-yes-123",
  price: 0.65,
  probability: 65,
  priceChange24h: 2.5,
  volume: 800000,
  winner: null,
  payout: null,
  displayOrder: 0,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
};

const mockWallet: Wallet = {
  id: "wallet-1",
  address: "0xabcdef1234567890abcdef1234567890abcdef12",
  label: "Test Whale",
  walletType: "EOA",
  isWhale: true,
  isInsider: false,
  isFresh: false,
  isMonitored: true,
  isFlagged: false,
  isSanctioned: false,
  suspicionScore: 15.5,
  riskLevel: "LOW",
  totalVolume: 500000,
  totalPnl: 25000,
  tradeCount: 150,
  winCount: 90,
  winRate: 60,
  avgTradeSize: 3333.33,
  maxTradeSize: 50000,
  firstTradeAt: new Date("2024-01-15T00:00:00Z"),
  lastTradeAt: new Date("2024-06-14T00:00:00Z"),
  walletCreatedAt: new Date("2023-06-01T00:00:00Z"),
  onChainTxCount: 500,
  walletAgeDays: 380,
  primaryFundingSource: "EXCHANGE",
  metadata: null,
  notes: "Known trader",
  createdAt: new Date("2024-01-15T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T00:00:00Z"),
};

const mockTrade: Trade = {
  id: "trade-1",
  marketId: mockMarket.id,
  outcomeId: mockOutcome.id,
  walletId: mockWallet.id,
  clobTradeId: "clob-trade-123",
  matchId: "match-456",
  side: TradeSide.BUY,
  amount: 100,
  price: 0.65,
  usdValue: 65,
  feeUsd: 0.13,
  makerAddress: "0x1111111111111111111111111111111111111111",
  takerAddress: mockWallet.address,
  isMaker: false,
  timestamp: new Date("2024-06-15T10:30:00Z"),
  txHash: "0xabc123def456",
  blockNumber: BigInt(58000000),
  isWhale: false,
  isInsider: false,
  flags: [],
  createdAt: new Date("2024-06-15T10:30:05Z"),
};

const mockTrade2: Trade = {
  id: "trade-2",
  marketId: mockMarket.id,
  outcomeId: mockOutcome.id,
  walletId: mockWallet.id,
  clobTradeId: "clob-trade-456",
  matchId: "match-789",
  side: TradeSide.SELL,
  amount: 50,
  price: 0.70,
  usdValue: 35,
  feeUsd: 0.07,
  makerAddress: mockWallet.address,
  takerAddress: "0x2222222222222222222222222222222222222222",
  isMaker: true,
  timestamp: new Date("2024-06-15T11:00:00Z"),
  txHash: "0xdef789ghi012",
  blockNumber: BigInt(58000100),
  isWhale: false,
  isInsider: false,
  flags: [],
  createdAt: new Date("2024-06-15T11:00:05Z"),
};

const mockWhaleTrade: Trade = {
  ...mockTrade,
  id: "trade-whale-1",
  clobTradeId: "clob-whale-123",
  amount: 10000,
  usdValue: 6500,
  isWhale: true,
  flags: ["large", "whale"],
};

/**
 * Create a mock Prisma client for testing
 */
function createMockPrismaClient() {
  return {
    trade: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  } as unknown as PrismaClient;
}

describe("TradeService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: TradeService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createTradeService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new TradeService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(TradeService);
    });

    it("should create service with createTradeService factory", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createTradeService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(TradeService);
    });
  });

  describe("create", () => {
    it("should create a trade with required fields", async () => {
      const input: CreateTradeInput = {
        marketId: mockTrade.marketId,
        outcomeId: mockTrade.outcomeId,
        walletId: mockTrade.walletId,
        side: TradeSide.BUY,
        amount: 100,
        price: 0.65,
        usdValue: 65,
        timestamp: mockTrade.timestamp,
      };

      vi.mocked(mockPrisma.trade.create).mockResolvedValue(mockTrade);

      const result = await service.create(input);

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          marketId: input.marketId,
          outcomeId: input.outcomeId,
          walletId: input.walletId,
          side: TradeSide.BUY,
          amount: 100,
          price: 0.65,
          usdValue: 65,
          feeUsd: 0,
          isWhale: false,
          isInsider: false,
          flags: [],
        }),
      });
      expect(result).toEqual(mockTrade);
    });

    it("should create a trade with all optional fields", async () => {
      const input: CreateTradeInput = {
        marketId: mockTrade.marketId,
        outcomeId: mockTrade.outcomeId,
        walletId: mockTrade.walletId,
        clobTradeId: mockTrade.clobTradeId ?? undefined,
        matchId: mockTrade.matchId ?? undefined,
        side: mockTrade.side,
        amount: mockTrade.amount,
        price: mockTrade.price,
        usdValue: mockTrade.usdValue,
        feeUsd: mockTrade.feeUsd,
        makerAddress: mockTrade.makerAddress ?? undefined,
        takerAddress: mockTrade.takerAddress ?? undefined,
        isMaker: mockTrade.isMaker ?? undefined,
        timestamp: mockTrade.timestamp,
        txHash: mockTrade.txHash ?? undefined,
        blockNumber: mockTrade.blockNumber ?? undefined,
        isWhale: mockTrade.isWhale,
        isInsider: mockTrade.isInsider,
        flags: mockTrade.flags,
      };

      vi.mocked(mockPrisma.trade.create).mockResolvedValue(mockTrade);

      const result = await service.create(input);

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clobTradeId: mockTrade.clobTradeId,
          matchId: mockTrade.matchId,
          makerAddress: mockTrade.makerAddress,
          takerAddress: mockTrade.takerAddress,
          isMaker: mockTrade.isMaker,
          txHash: mockTrade.txHash,
          blockNumber: mockTrade.blockNumber,
        }),
      });
      expect(result).toEqual(mockTrade);
    });

    it("should set defaults for optional fields when not provided", async () => {
      const input: CreateTradeInput = {
        marketId: mockTrade.marketId,
        outcomeId: mockTrade.outcomeId,
        walletId: mockTrade.walletId,
        side: TradeSide.BUY,
        amount: 100,
        price: 0.65,
        usdValue: 65,
        timestamp: new Date(),
      };

      vi.mocked(mockPrisma.trade.create).mockResolvedValue(mockTrade);

      await service.create(input);

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feeUsd: 0,
          isWhale: false,
          isInsider: false,
          flags: [],
        }),
      });
    });
  });

  describe("findById", () => {
    it("should find trade by id", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(mockTrade);

      const result = await service.findById(mockTrade.id);

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        include: undefined,
      });
      expect(result).toEqual(mockTrade);
    });

    it("should return null when trade not found", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(null);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });

    it("should include market relation when requested", async () => {
      const tradeWithMarket = { ...mockTrade, market: mockMarket };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithMarket);

      const result = await service.findById(mockTrade.id, { market: true });

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        include: { market: true, outcome: false, wallet: false },
      });
      expect(result).toHaveProperty("market");
    });

    it("should include outcome relation when requested", async () => {
      const tradeWithOutcome = { ...mockTrade, outcome: mockOutcome };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithOutcome);

      const result = await service.findById(mockTrade.id, { outcome: true });

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        include: { market: false, outcome: true, wallet: false },
      });
      expect(result).toHaveProperty("outcome");
    });

    it("should include wallet relation when requested", async () => {
      const tradeWithWallet = { ...mockTrade, wallet: mockWallet };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithWallet);

      const result = await service.findById(mockTrade.id, { wallet: true });

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        include: { market: false, outcome: false, wallet: true },
      });
      expect(result).toHaveProperty("wallet");
    });

    it("should include all relations when requested", async () => {
      const tradeWithAll = { ...mockTrade, market: mockMarket, outcome: mockOutcome, wallet: mockWallet };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithAll);

      const result = await service.findById(mockTrade.id, { market: true, outcome: true, wallet: true });

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        include: { market: true, outcome: true, wallet: true },
      });
      expect(result).toHaveProperty("market");
      expect(result).toHaveProperty("outcome");
      expect(result).toHaveProperty("wallet");
    });
  });

  describe("findByClobTradeId", () => {
    it("should find trade by CLOB trade ID", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(mockTrade);

      const result = await service.findByClobTradeId(mockTrade.clobTradeId!);

      expect(mockPrisma.trade.findUnique).toHaveBeenCalledWith({
        where: { clobTradeId: mockTrade.clobTradeId },
        include: undefined,
      });
      expect(result).toEqual(mockTrade);
    });

    it("should return null when not found", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(null);

      const result = await service.findByClobTradeId("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should find multiple trades by IDs", async () => {
      const trades = [mockTrade, mockTrade2];
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue(trades);

      const result = await service.findByIds([mockTrade.id, mockTrade2.id]);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: { id: { in: [mockTrade.id, mockTrade2.id] } },
        include: undefined,
      });
      expect(result).toEqual(trades);
    });

    it("should return empty array for empty input", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([]);

      const result = await service.findByIds([]);

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update trade fields", async () => {
      const input: UpdateTradeInput = {
        isWhale: true,
        flags: ["large", "whale"],
      };

      const updatedTrade = { ...mockTrade, ...input };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(updatedTrade);

      const result = await service.update(mockTrade.id, input);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: input,
      });
      expect(result.isWhale).toBe(true);
      expect(result.flags).toEqual(["large", "whale"]);
    });

    it("should update nullable fields to null", async () => {
      const input: UpdateTradeInput = {
        txHash: null,
        matchId: null,
      };

      const updatedTrade = { ...mockTrade, txHash: null, matchId: null };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(updatedTrade);

      const result = await service.update(mockTrade.id, input);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: input,
      });
      expect(result.txHash).toBeNull();
      expect(result.matchId).toBeNull();
    });
  });

  describe("upsertByClobTradeId", () => {
    it("should create trade if not exists", async () => {
      const input: CreateTradeInput = {
        marketId: mockTrade.marketId,
        outcomeId: mockTrade.outcomeId,
        walletId: mockTrade.walletId,
        clobTradeId: "new-clob-id",
        side: TradeSide.BUY,
        amount: 100,
        price: 0.65,
        usdValue: 65,
        timestamp: new Date(),
      };

      vi.mocked(mockPrisma.trade.upsert).mockResolvedValue({ ...mockTrade, clobTradeId: "new-clob-id" });

      const result = await service.upsertByClobTradeId("new-clob-id", input);

      expect(mockPrisma.trade.upsert).toHaveBeenCalledWith({
        where: { clobTradeId: "new-clob-id" },
        create: expect.objectContaining({
          clobTradeId: "new-clob-id",
          marketId: input.marketId,
        }),
        update: expect.any(Object),
      });
      expect(result.clobTradeId).toBe("new-clob-id");
    });

    it("should update trade if exists", async () => {
      const input: CreateTradeInput = {
        marketId: mockTrade.marketId,
        outcomeId: mockTrade.outcomeId,
        walletId: mockTrade.walletId,
        clobTradeId: mockTrade.clobTradeId!,
        side: TradeSide.BUY,
        amount: 100,
        price: 0.65,
        usdValue: 65,
        timestamp: new Date(),
        isWhale: true,
      };

      const updatedTrade = { ...mockTrade, isWhale: true };
      vi.mocked(mockPrisma.trade.upsert).mockResolvedValue(updatedTrade);

      const result = await service.upsertByClobTradeId(mockTrade.clobTradeId!, input);

      expect(mockPrisma.trade.upsert).toHaveBeenCalled();
      expect(result.isWhale).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete trade by ID", async () => {
      vi.mocked(mockPrisma.trade.delete).mockResolvedValue(mockTrade);

      const result = await service.delete(mockTrade.id);

      expect(mockPrisma.trade.delete).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
      });
      expect(result).toEqual(mockTrade);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple trades by IDs", async () => {
      vi.mocked(mockPrisma.trade.deleteMany).mockResolvedValue({ count: 2 });

      const result = await service.deleteMany([mockTrade.id, mockTrade2.id]);

      expect(mockPrisma.trade.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [mockTrade.id, mockTrade2.id] } },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("deleteByMarket", () => {
    it("should delete trades by market ID", async () => {
      vi.mocked(mockPrisma.trade.deleteMany).mockResolvedValue({ count: 5 });

      const result = await service.deleteByMarket(mockMarket.id);

      expect(mockPrisma.trade.deleteMany).toHaveBeenCalledWith({
        where: { marketId: mockMarket.id },
      });
      expect(result.count).toBe(5);
    });
  });

  describe("deleteByWallet", () => {
    it("should delete trades by wallet ID", async () => {
      vi.mocked(mockPrisma.trade.deleteMany).mockResolvedValue({ count: 3 });

      const result = await service.deleteByWallet(mockWallet.id);

      expect(mockPrisma.trade.deleteMany).toHaveBeenCalledWith({
        where: { walletId: mockWallet.id },
      });
      expect(result.count).toBe(3);
    });
  });

  describe("findMany", () => {
    it("should find trades with default settings", async () => {
      const trades = [mockTrade, mockTrade2];
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue(trades);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      const result = await service.findMany();

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.trades).toEqual(trades);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should apply market filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ marketId: mockMarket.id });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: mockMarket.id },
        })
      );
    });

    it("should apply wallet filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ walletId: mockWallet.id });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: mockWallet.id },
        })
      );
    });

    it("should apply side filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ side: TradeSide.BUY });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { side: TradeSide.BUY },
        })
      );
    });

    it("should apply whale filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ isWhale: true });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isWhale: true },
        })
      );
    });

    it("should apply insider filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(0);

      await service.findMany({ isInsider: true });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isInsider: true },
        })
      );
    });

    it("should apply USD value range filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ minUsdValue: 50, maxUsdValue: 100 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usdValue: { gte: 50, lte: 100 } },
        })
      );
    });

    it("should apply timestamp range filter", async () => {
      const startTime = new Date("2024-06-15T00:00:00Z");
      const endTime = new Date("2024-06-16T00:00:00Z");

      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ timestampAfter: startTime, timestampBefore: endTime });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { timestamp: { gte: startTime, lte: endTime } },
        })
      );
    });

    it("should apply flags filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ flags: ["large", "whale"] });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { flags: { hasSome: ["large", "whale"] } },
        })
      );
    });

    it("should apply custom sort", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade, mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      await service.findMany({}, { field: "usdValue", direction: "desc" });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { usdValue: "desc" },
        })
      );
    });

    it("should apply pagination", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade2]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(10);

      const result = await service.findMany({}, undefined, { skip: 1, take: 1 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        })
      );
      expect(result.skip).toBe(1);
      expect(result.take).toBe(1);
      expect(result.hasMore).toBe(true);
    });

    it("should include relations when requested", async () => {
      const tradeWithRelations = { ...mockTrade, market: mockMarket, outcome: mockOutcome, wallet: mockWallet };
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([tradeWithRelations]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({}, undefined, {}, { market: true, outcome: true, wallet: true });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { market: true, outcome: true, wallet: true },
        })
      );
    });
  });

  describe("findByWallet", () => {
    it("should find trades by wallet ID", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade, mockTrade2]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      const result = await service.findByWallet(mockWallet.id);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: mockWallet.id },
        })
      );
      expect(result.trades).toHaveLength(2);
    });
  });

  describe("findByMarket", () => {
    it("should find trades by market ID", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.findByMarket(mockMarket.id);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: mockMarket.id },
        })
      );
      expect(result.trades).toHaveLength(1);
    });
  });

  describe("findByOutcome", () => {
    it("should find trades by outcome ID", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.findByOutcome(mockOutcome.id);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { outcomeId: mockOutcome.id },
        })
      );
      expect(result.trades).toHaveLength(1);
    });
  });

  describe("findWhaleTrades", () => {
    it("should find whale trades", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.findWhaleTrades();

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isWhale: true },
        })
      );
      expect(result.trades[0]!.isWhale).toBe(true);
    });
  });

  describe("findInsiderTrades", () => {
    it("should find insider trades", async () => {
      const insiderTrade = { ...mockTrade, isInsider: true };
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([insiderTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.findInsiderTrades();

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isInsider: true },
        })
      );
      expect(result.trades[0]!.isInsider).toBe(true);
    });
  });

  describe("getRecent", () => {
    it("should get recent trades with default limit", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade2, mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      const result = await service.getRecent();

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: "desc" },
          take: 50,
        })
      );
      expect(result).toHaveLength(2);
    });

    it("should get recent trades with custom limit", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade2]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.getRecent(1);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getLargest", () => {
    it("should get largest trades by USD value", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade, mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      const result = await service.getLargest();

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { usdValue: "desc" },
        })
      );
      expect(result[0]!.usdValue).toBeGreaterThanOrEqual(result[1]!.usdValue);
    });
  });

  describe("findInTimeRange", () => {
    it("should find trades within time range", async () => {
      const startTime = new Date("2024-06-15T00:00:00Z");
      const endTime = new Date("2024-06-16T00:00:00Z");

      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade, mockTrade2]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(2);

      const result = await service.findInTimeRange(startTime, endTime);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: startTime, lte: endTime },
          }),
        })
      );
      expect(result.trades).toHaveLength(2);
    });
  });

  describe("count", () => {
    it("should count all trades", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(100);

      const result = await service.count();

      expect(mockPrisma.trade.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(100);
    });

    it("should count trades with filters", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(5);

      const result = await service.count({ isWhale: true });

      expect(mockPrisma.trade.count).toHaveBeenCalledWith({
        where: { isWhale: true },
      });
      expect(result).toBe(5);
    });
  });

  describe("exists", () => {
    it("should return true when trade exists", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.exists(mockTrade.id);

      expect(mockPrisma.trade.count).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
      });
      expect(result).toBe(true);
    });

    it("should return false when trade does not exist", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(0);

      const result = await service.exists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("existsByClobTradeId", () => {
    it("should return true when trade exists by CLOB ID", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const result = await service.existsByClobTradeId(mockTrade.clobTradeId!);

      expect(mockPrisma.trade.count).toHaveBeenCalledWith({
        where: { clobTradeId: mockTrade.clobTradeId },
      });
      expect(result).toBe(true);
    });

    it("should return false when trade does not exist by CLOB ID", async () => {
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(0);

      const result = await service.existsByClobTradeId("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("createMany", () => {
    it("should bulk create trades", async () => {
      const trades: CreateTradeInput[] = [
        {
          marketId: mockTrade.marketId,
          outcomeId: mockTrade.outcomeId,
          walletId: mockTrade.walletId,
          side: TradeSide.BUY,
          amount: 100,
          price: 0.65,
          usdValue: 65,
          timestamp: new Date(),
        },
        {
          marketId: mockTrade.marketId,
          outcomeId: mockTrade.outcomeId,
          walletId: mockTrade.walletId,
          side: TradeSide.SELL,
          amount: 50,
          price: 0.70,
          usdValue: 35,
          timestamp: new Date(),
        },
      ];

      vi.mocked(mockPrisma.trade.createMany).mockResolvedValue({ count: 2 });

      const result = await service.createMany(trades);

      expect(mockPrisma.trade.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ side: TradeSide.BUY }),
          expect.objectContaining({ side: TradeSide.SELL }),
        ]),
        skipDuplicates: true,
      });
      expect(result.count).toBe(2);
    });
  });

  describe("markAsWhale", () => {
    it("should mark trade as whale", async () => {
      const whaleTrade = { ...mockTrade, isWhale: true };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(whaleTrade);

      const result = await service.markAsWhale(mockTrade.id);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: { isWhale: true },
      });
      expect(result.isWhale).toBe(true);
    });
  });

  describe("markAsInsider", () => {
    it("should mark trade as insider", async () => {
      const insiderTrade = { ...mockTrade, isInsider: true };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(insiderTrade);

      const result = await service.markAsInsider(mockTrade.id);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: { isInsider: true },
      });
      expect(result.isInsider).toBe(true);
    });
  });

  describe("addFlags", () => {
    it("should add flags to trade", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(mockTrade);
      const updatedTrade = { ...mockTrade, flags: ["large", "suspicious"] };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(updatedTrade);

      const result = await service.addFlags(mockTrade.id, ["large", "suspicious"]);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: { flags: ["large", "suspicious"] },
      });
      expect(result.flags).toContain("large");
      expect(result.flags).toContain("suspicious");
    });

    it("should merge with existing flags", async () => {
      const tradeWithFlags = { ...mockTrade, flags: ["existing"] };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithFlags);
      const updatedTrade = { ...tradeWithFlags, flags: ["existing", "new"] };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(updatedTrade);

      const result = await service.addFlags(mockTrade.id, ["new"]);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: { flags: ["existing", "new"] },
      });
      expect(result.flags).toContain("existing");
      expect(result.flags).toContain("new");
    });

    it("should deduplicate flags", async () => {
      const tradeWithFlags = { ...mockTrade, flags: ["existing"] };
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(tradeWithFlags);
      const updatedTrade = { ...tradeWithFlags, flags: ["existing"] };
      vi.mocked(mockPrisma.trade.update).mockResolvedValue(updatedTrade);

      await service.addFlags(mockTrade.id, ["existing"]);

      expect(mockPrisma.trade.update).toHaveBeenCalledWith({
        where: { id: mockTrade.id },
        data: { flags: ["existing"] },
      });
    });

    it("should throw when trade not found", async () => {
      vi.mocked(mockPrisma.trade.findUnique).mockResolvedValue(null);

      await expect(service.addFlags("non-existent", ["flag"])).rejects.toThrow("Trade not found");
    });
  });

  describe("getStats", () => {
    it("should return aggregate statistics", async () => {
      vi.mocked(mockPrisma.trade.aggregate).mockResolvedValue({
        _count: { id: 100 },
        _sum: { usdValue: 50000, feeUsd: 100 },
        _avg: { usdValue: 500 },
      } as any);

      const result = await service.getStats();

      expect(mockPrisma.trade.aggregate).toHaveBeenCalledWith({
        where: {},
        _count: { id: true },
        _sum: { usdValue: true, feeUsd: true },
        _avg: { usdValue: true },
      });
      expect(result.count).toBe(100);
      expect(result.totalVolume).toBe(50000);
      expect(result.avgTradeSize).toBe(500);
      expect(result.totalFees).toBe(100);
    });

    it("should handle null aggregates", async () => {
      vi.mocked(mockPrisma.trade.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _sum: { usdValue: null, feeUsd: null },
        _avg: { usdValue: null },
      } as any);

      const result = await service.getStats();

      expect(result.count).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.avgTradeSize).toBe(0);
      expect(result.totalFees).toBe(0);
    });

    it("should apply filters to stats", async () => {
      vi.mocked(mockPrisma.trade.aggregate).mockResolvedValue({
        _count: { id: 10 },
        _sum: { usdValue: 65000, feeUsd: 130 },
        _avg: { usdValue: 6500 },
      } as any);

      const result = await service.getStats({ isWhale: true });

      expect(mockPrisma.trade.aggregate).toHaveBeenCalledWith({
        where: { isWhale: true },
        _count: { id: true },
        _sum: { usdValue: true, feeUsd: true },
        _avg: { usdValue: true },
      });
      expect(result.count).toBe(10);
    });
  });

  describe("getWalletStats", () => {
    it("should return wallet trade statistics", async () => {
      vi.mocked(mockPrisma.trade.aggregate).mockResolvedValue({
        _count: { id: 150 },
        _sum: { usdValue: 500000, feeUsd: 1000 },
        _avg: { usdValue: 3333.33 },
      } as any);
      vi.mocked(mockPrisma.trade.count)
        .mockResolvedValueOnce(90) // BUY count
        .mockResolvedValueOnce(60); // SELL count

      const result = await service.getWalletStats(mockWallet.id);

      expect(result.count).toBe(150);
      expect(result.totalVolume).toBe(500000);
      expect(result.buyCount).toBe(90);
      expect(result.sellCount).toBe(60);
    });
  });

  describe("getMarketStats", () => {
    it("should return market trade statistics with unique traders", async () => {
      vi.mocked(mockPrisma.trade.aggregate).mockResolvedValue({
        _count: { id: 5000 },
        _sum: { usdValue: 1500000, feeUsd: 3000 },
        _avg: { usdValue: 300 },
      } as any);
      vi.mocked(mockPrisma.trade.groupBy).mockResolvedValue([
        { walletId: "wallet-1", _count: { walletId: 100 } },
        { walletId: "wallet-2", _count: { walletId: 50 } },
        { walletId: "wallet-3", _count: { walletId: 25 } },
      ] as any);

      const result = await service.getMarketStats(mockMarket.id);

      expect(result.count).toBe(5000);
      expect(result.uniqueTraders).toBe(3);
    });
  });

  describe("findFirstTradeByWallet", () => {
    it("should find first trade for wallet", async () => {
      vi.mocked(mockPrisma.trade.findFirst).mockResolvedValue(mockTrade);

      const result = await service.findFirstTradeByWallet(mockWallet.id);

      expect(mockPrisma.trade.findFirst).toHaveBeenCalledWith({
        where: { walletId: mockWallet.id },
        orderBy: { timestamp: "asc" },
        include: undefined,
      });
      expect(result).toEqual(mockTrade);
    });

    it("should return null when no trades", async () => {
      vi.mocked(mockPrisma.trade.findFirst).mockResolvedValue(null);

      const result = await service.findFirstTradeByWallet("new-wallet");

      expect(result).toBeNull();
    });
  });

  describe("findLastTradeByWallet", () => {
    it("should find last trade for wallet", async () => {
      vi.mocked(mockPrisma.trade.findFirst).mockResolvedValue(mockTrade2);

      const result = await service.findLastTradeByWallet(mockWallet.id);

      expect(mockPrisma.trade.findFirst).toHaveBeenCalledWith({
        where: { walletId: mockWallet.id },
        orderBy: { timestamp: "desc" },
        include: undefined,
      });
      expect(result).toEqual(mockTrade2);
    });
  });

  describe("getTradesByInterval", () => {
    it("should return trades grouped by interval", async () => {
      const trades = [
        { timestamp: new Date("2024-06-15T10:00:00Z"), usdValue: 100, side: TradeSide.BUY },
        { timestamp: new Date("2024-06-15T10:30:00Z"), usdValue: 200, side: TradeSide.SELL },
        { timestamp: new Date("2024-06-15T11:00:00Z"), usdValue: 150, side: TradeSide.BUY },
      ];
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue(trades as any);

      const result = await service.getTradesByInterval({}, 60);

      expect(result).toHaveLength(2); // Two hourly buckets
      expect(result[0]!.count).toBe(2);
      expect(result[0]!.volume).toBe(300);
      expect(result[0]!.buyCount).toBe(1);
      expect(result[0]!.sellCount).toBe(1);
      expect(result[1]!.count).toBe(1);
    });

    it("should handle empty results", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([]);

      const result = await service.getTradesByInterval({});

      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle minUsdValue only filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockWhaleTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ minUsdValue: 1000 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usdValue: { gte: 1000 } },
        })
      );
    });

    it("should handle maxUsdValue only filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ maxUsdValue: 100 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usdValue: { lte: 100 } },
        })
      );
    });

    it("should handle timestampAfter only filter", async () => {
      const timestamp = new Date("2024-06-15T00:00:00Z");
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ timestampAfter: timestamp });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { timestamp: { gte: timestamp } },
        })
      );
    });

    it("should handle timestampBefore only filter", async () => {
      const timestamp = new Date("2024-06-16T00:00:00Z");
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ timestampBefore: timestamp });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { timestamp: { lte: timestamp } },
        })
      );
    });

    it("should handle all sort fields", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      const sortFields: TradeSortOptions["field"][] = ["timestamp", "usdValue", "amount", "price", "createdAt"];

      for (const field of sortFields) {
        await service.findMany({}, { field, direction: "asc" });

        expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { [field]: "asc" },
          })
        );
      }
    });

    it("should handle makerAddress filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ makerAddress: "0x1111111111111111111111111111111111111111" });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { makerAddress: "0x1111111111111111111111111111111111111111" },
        })
      );
    });

    it("should handle takerAddress filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ takerAddress: mockWallet.address });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { takerAddress: mockWallet.address },
        })
      );
    });

    it("should handle matchId filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ matchId: "match-456" });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId: "match-456" },
        })
      );
    });

    it("should handle txHash filter", async () => {
      vi.mocked(mockPrisma.trade.findMany).mockResolvedValue([mockTrade]);
      vi.mocked(mockPrisma.trade.count).mockResolvedValue(1);

      await service.findMany({ txHash: "0xabc123def456" });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { txHash: "0xabc123def456" },
        })
      );
    });
  });
});
