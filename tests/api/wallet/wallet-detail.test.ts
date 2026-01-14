/**
 * Wallet Detail API Unit Tests
 *
 * Tests for the GET /api/wallet/[address] endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RiskLevel, WalletType, TradeSide } from "@prisma/client";

describe("Wallet Detail API - GET /api/wallet/[address]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Mock Data Factories
  // ============================================================================

  const createMockWallet = (
    overrides: Partial<{
      id: string;
      address: string;
      label: string | null;
      walletType: WalletType;
      suspicionScore: number;
      riskLevel: RiskLevel;
      totalVolume: number;
      totalPnl: number;
      tradeCount: number;
      winCount: number;
      winRate: number | null;
      avgTradeSize: number | null;
      maxTradeSize: number | null;
      firstTradeAt: Date | null;
      lastTradeAt: Date | null;
      walletCreatedAt: Date | null;
      onChainTxCount: number;
      walletAgeDays: number | null;
      primaryFundingSource: string | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      isWhale: boolean;
      isInsider: boolean;
      isFresh: boolean;
      isFlagged: boolean;
      isMonitored: boolean;
      isSanctioned: boolean;
    }> = {}
  ) => ({
    id: "wallet-1",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    label: "Test Wallet",
    walletType: WalletType.EOA,
    suspicionScore: 75,
    riskLevel: RiskLevel.HIGH,
    totalVolume: 250000,
    totalPnl: 50000,
    tradeCount: 100,
    winCount: 65,
    winRate: 65,
    avgTradeSize: 2500,
    maxTradeSize: 25000,
    firstTradeAt: new Date("2025-12-01T00:00:00.000Z"),
    lastTradeAt: new Date("2026-01-14T12:00:00.000Z"),
    walletCreatedAt: new Date("2025-11-15T00:00:00.000Z"),
    onChainTxCount: 150,
    walletAgeDays: 60,
    primaryFundingSource: "EXCHANGE",
    notes: "Known trader",
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-14T12:00:00.000Z"),
    isWhale: true,
    isInsider: false,
    isFresh: false,
    isFlagged: true,
    isMonitored: true,
    isSanctioned: false,
    ...overrides,
  });

  const createMockTrade = (
    overrides: Partial<{
      id: string;
      marketId: string;
      outcomeId: string;
      walletId: string;
      side: TradeSide;
      amount: number;
      price: number;
      usdValue: number;
      feeUsd: number;
      timestamp: Date;
      txHash: string | null;
      isWhale: boolean;
      isInsider: boolean;
      market: { id: string; question: string } | null;
      outcome: { name: string; winner: boolean | null; payout: number | null } | null;
    }> = {}
  ) => ({
    id: "trade-1",
    marketId: "market-1",
    outcomeId: "outcome-1",
    walletId: "wallet-1",
    side: TradeSide.BUY,
    amount: 1000,
    price: 0.65,
    usdValue: 650,
    feeUsd: 13,
    timestamp: new Date("2026-01-14T10:00:00.000Z"),
    txHash: "0x" + "a".repeat(64),
    isWhale: false,
    isInsider: false,
    market: {
      id: "market-1",
      question: "Will Bitcoin hit $100k?",
    },
    outcome: {
      name: "YES",
      winner: null,
      payout: null,
    },
    ...overrides,
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function setupMocksAndGetHandler(mocks: {
    wallet?: ReturnType<typeof createMockWallet> | null;
    trades?: ReturnType<typeof createMockTrade>[];
    tradeCount?: number;
    shouldThrow?: boolean;
  }) {
    const findUniqueMock = vi.fn();
    const tradeFindManyMock = vi.fn();
    const tradeCountMock = vi.fn();

    if (mocks.shouldThrow) {
      findUniqueMock.mockRejectedValue(new Error("Database error"));
    } else {
      findUniqueMock.mockResolvedValue(mocks.wallet ?? null);
      tradeFindManyMock.mockResolvedValue(mocks.trades ?? []);
      tradeCountMock.mockResolvedValue(mocks.tradeCount ?? mocks.trades?.length ?? 0);
    }

    vi.doMock("@/db/client", () => ({
      prisma: {
        wallet: {
          findUnique: findUniqueMock,
        },
        trade: {
          findMany: tradeFindManyMock,
          count: tradeCountMock,
        },
      },
    }));

    const { GET } = await import("@/app/api/wallet/[address]/route");
    return { GET, findUniqueMock, tradeFindManyMock, tradeCountMock };
  }

  function createRequest(
    address: string,
    queryParams: Record<string, string> = {}
  ) {
    const url = new URL(`http://localhost:3000/api/wallet/${address}`);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new Request(url.toString());
  }

  function createParams(address: string) {
    return Promise.resolve({ address });
  }

  // ============================================================================
  // Tests: Input Validation
  // ============================================================================

  describe("Input Validation", () => {
    it("should reject invalid address format - too short", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallet: null });

      const response = await GET(
        createRequest("0x1234") as any,
        { params: createParams("0x1234") }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid wallet address");
    });

    it("should reject invalid address format - missing 0x prefix", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallet: null });

      const address = "1234567890abcdef1234567890abcdef12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid wallet address");
    });

    it("should reject invalid address format - invalid characters", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallet: null });

      const address = "0xGGGG567890abcdef1234567890abcdef12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid wallet address");
    });

    it("should accept valid address with lowercase letters", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );

      expect(response.status).toBe(200);
    });

    it("should accept valid address with uppercase letters", async () => {
      const mockWallet = createMockWallet({
        address: "0x1234567890ABCDEF1234567890ABCDEF12345678",
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const address = "0x1234567890ABCDEF1234567890ABCDEF12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Tests: Wallet Not Found
  // ============================================================================

  describe("Wallet Not Found", () => {
    it("should return 404 when wallet does not exist", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallet: null });

      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Wallet not found");
      expect(data.details).toContain(address);
    });
  });

  // ============================================================================
  // Tests: Basic Response Structure
  // ============================================================================

  describe("Basic Response Structure", () => {
    it("should return complete wallet profile with correct structure", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("wallet");
      expect(data).toHaveProperty("trades");
      expect(data).toHaveProperty("pnlHistory");
      expect(data).toHaveProperty("generatedAt");
    });

    it("should return wallet data with all expected fields", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      const wallet = data.wallet;
      expect(wallet.id).toBe(mockWallet.id);
      expect(wallet.address).toBe(mockWallet.address);
      expect(wallet.label).toBe(mockWallet.label);
      expect(wallet.walletType).toBe(mockWallet.walletType);
      expect(wallet.suspicionScore).toBe(mockWallet.suspicionScore);
      expect(wallet.riskLevel).toBe(mockWallet.riskLevel);
      expect(wallet.totalVolume).toBe(mockWallet.totalVolume);
      expect(wallet.totalPnl).toBe(mockWallet.totalPnl);
      expect(wallet.tradeCount).toBe(mockWallet.tradeCount);
      expect(wallet.winCount).toBe(mockWallet.winCount);
      expect(wallet.winRate).toBe(mockWallet.winRate);
      expect(wallet.avgTradeSize).toBe(mockWallet.avgTradeSize);
      expect(wallet.maxTradeSize).toBe(mockWallet.maxTradeSize);
      expect(wallet.onChainTxCount).toBe(mockWallet.onChainTxCount);
      expect(wallet.walletAgeDays).toBe(mockWallet.walletAgeDays);
      expect(wallet.primaryFundingSource).toBe(mockWallet.primaryFundingSource);
      expect(wallet.notes).toBe(mockWallet.notes);
    });

    it("should return wallet flags correctly", async () => {
      const mockWallet = createMockWallet({
        isWhale: true,
        isInsider: true,
        isFresh: true,
        isFlagged: true,
        isMonitored: true,
        isSanctioned: true,
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      const flags = data.wallet.flags;
      expect(flags.isWhale).toBe(true);
      expect(flags.isInsider).toBe(true);
      expect(flags.isFresh).toBe(true);
      expect(flags.isFlagged).toBe(true);
      expect(flags.isMonitored).toBe(true);
      expect(flags.isSanctioned).toBe(true);
    });

    it("should return trades with pagination info", async () => {
      const mockWallet = createMockWallet();
      const mockTrades = [createMockTrade(), createMockTrade({ id: "trade-2" })];
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: mockTrades,
        tradeCount: 50,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades).toHaveProperty("items");
      expect(data.trades).toHaveProperty("pagination");
      expect(data.trades).toHaveProperty("sort");
      expect(data.trades.pagination.offset).toBe(0);
      expect(data.trades.pagination.limit).toBe(25);
      expect(data.trades.pagination.total).toBe(50);
      expect(data.trades.pagination.hasMore).toBe(true);
    });

    it("should return empty pnlHistory when no trades", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.pnlHistory).toEqual([]);
    });
  });

  // ============================================================================
  // Tests: Trade Data
  // ============================================================================

  describe("Trade Data", () => {
    it("should return trade items with correct structure", async () => {
      const mockWallet = createMockWallet();
      const mockTrade = createMockTrade();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [mockTrade],
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.items).toHaveLength(1);
      const trade = data.trades.items[0];
      expect(trade.id).toBe(mockTrade.id);
      expect(trade.marketId).toBe(mockTrade.marketId);
      expect(trade.marketTitle).toBe(mockTrade.market?.question);
      expect(trade.outcome).toBe(mockTrade.outcome?.name);
      expect(trade.side).toBe(mockTrade.side);
      expect(trade.size).toBe(mockTrade.usdValue);
      expect(trade.price).toBe(mockTrade.price);
      expect(trade.shares).toBe(mockTrade.amount);
      expect(trade.fee).toBe(mockTrade.feeUsd);
      expect(trade.txHash).toBe(mockTrade.txHash);
      expect(trade.isWhale).toBe(mockTrade.isWhale);
    });

    it("should calculate profit for winning BUY trade", async () => {
      const mockWallet = createMockWallet();
      const mockTrade = createMockTrade({
        side: TradeSide.BUY,
        price: 0.5,
        usdValue: 1000,
        outcome: { name: "YES", winner: true, payout: 1 },
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [mockTrade],
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      // Expected P&L: 1000 * (1 / 0.5 - 1) = 1000 * 1 = 1000
      expect(data.trades.items[0].profitLoss).toBe(1000);
    });

    it("should calculate loss for losing BUY trade", async () => {
      const mockWallet = createMockWallet();
      const mockTrade = createMockTrade({
        side: TradeSide.BUY,
        price: 0.5,
        usdValue: 1000,
        outcome: { name: "YES", winner: false, payout: null },
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [mockTrade],
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      // Expected P&L: -1000 (lost the entire investment)
      expect(data.trades.items[0].profitLoss).toBe(-1000);
    });

    it("should return null profitLoss for unresolved trades", async () => {
      const mockWallet = createMockWallet();
      const mockTrade = createMockTrade({
        outcome: { name: "YES", winner: null, payout: null },
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [mockTrade],
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.items[0].profitLoss).toBeNull();
    });
  });

  // ============================================================================
  // Tests: Pagination
  // ============================================================================

  describe("Pagination", () => {
    it("should use default pagination values", async () => {
      const mockWallet = createMockWallet();
      const { GET, tradeFindManyMock } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(tradeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 0,
        })
      );
    });

    it("should respect custom pagination parameters", async () => {
      const mockWallet = createMockWallet();
      const { GET, tradeFindManyMock } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      await GET(
        createRequest(mockWallet.address, { tradesLimit: "50", tradesOffset: "100" }) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(tradeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 100,
        })
      );
    });

    it("should enforce maximum limit of 100", async () => {
      const mockWallet = createMockWallet();
      const { GET, tradeFindManyMock } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      await GET(
        createRequest(mockWallet.address, { tradesLimit: "200" }) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(tradeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("should enforce minimum limit of 1", async () => {
      const mockWallet = createMockWallet();
      const { GET, tradeFindManyMock } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      await GET(
        createRequest(mockWallet.address, { tradesLimit: "0" }) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(tradeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });

    it("should handle invalid pagination values gracefully", async () => {
      const mockWallet = createMockWallet();
      const { GET, tradeFindManyMock } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      await GET(
        createRequest(mockWallet.address, { tradesLimit: "invalid", tradesOffset: "abc" }) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(tradeFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25, // default
          skip: 0, // default
        })
      );
    });

    it("should correctly indicate hasMore when more trades exist", async () => {
      const mockWallet = createMockWallet();
      const mockTrades = [createMockTrade()];
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: mockTrades,
        tradeCount: 100,
      });

      const response = await GET(
        createRequest(mockWallet.address, { tradesLimit: "10" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.pagination.hasMore).toBe(true);
    });

    it("should correctly indicate hasMore=false when on last page", async () => {
      const mockWallet = createMockWallet();
      const mockTrades = [createMockTrade()];
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: mockTrades,
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address, { tradesLimit: "10" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.pagination.hasMore).toBe(false);
    });
  });

  // ============================================================================
  // Tests: Sorting
  // ============================================================================

  describe("Sorting", () => {
    it("should use default sort values (timestamp, desc)", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.sort.field).toBe("timestamp");
      expect(data.trades.sort.direction).toBe("desc");
    });

    it("should respect custom sort field", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address, { sortField: "size" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.sort.field).toBe("size");
    });

    it("should respect custom sort direction", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address, { sortDirection: "asc" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.sort.direction).toBe("asc");
    });

    it("should reject invalid sort field and use default", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address, { sortField: "invalid" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.sort.field).toBe("timestamp");
    });

    it("should reject invalid sort direction and use default", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address, { sortDirection: "invalid" }) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.trades.sort.direction).toBe("desc");
    });
  });

  // ============================================================================
  // Tests: Caching
  // ============================================================================

  describe("Caching", () => {
    it("should include cache headers in response", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=30, stale-while-revalidate=60"
      );
      expect(response.headers.get("X-Cache")).toBe("MISS");
    });
  });

  // ============================================================================
  // Tests: Error Handling
  // ============================================================================

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const { GET } = await setupMocksAndGetHandler({ shouldThrow: true });

      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const response = await GET(
        createRequest(address) as any,
        { params: createParams(address) }
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch wallet details");
      expect(data.details).toBe("Database error");
    });
  });

  // ============================================================================
  // Tests: Null Values
  // ============================================================================

  describe("Null Values", () => {
    it("should handle wallet with null optional fields", async () => {
      const mockWallet = createMockWallet({
        label: null,
        winRate: null,
        avgTradeSize: null,
        maxTradeSize: null,
        firstTradeAt: null,
        lastTradeAt: null,
        walletCreatedAt: null,
        walletAgeDays: null,
        primaryFundingSource: null,
        notes: null,
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.wallet.label).toBeNull();
      expect(data.wallet.winRate).toBeNull();
      expect(data.wallet.avgTradeSize).toBeNull();
      expect(data.wallet.maxTradeSize).toBeNull();
      expect(data.wallet.firstTradeAt).toBeNull();
      expect(data.wallet.lastTradeAt).toBeNull();
      expect(data.wallet.walletCreatedAt).toBeNull();
      expect(data.wallet.walletAgeDays).toBeNull();
      expect(data.wallet.primaryFundingSource).toBeNull();
      expect(data.wallet.notes).toBeNull();
    });

    it("should handle trade with null market and outcome", async () => {
      const mockWallet = createMockWallet();
      const mockTrade = createMockTrade({
        market: null,
        outcome: null,
        txHash: null,
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [mockTrade],
        tradeCount: 1,
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      const trade = data.trades.items[0];
      expect(trade.marketTitle).toBe("Unknown Market");
      expect(trade.outcome).toBe("Unknown");
      expect(trade.txHash).toBeNull();
    });
  });

  // ============================================================================
  // Tests: Timestamp Formatting
  // ============================================================================

  describe("Timestamp Formatting", () => {
    it("should format dates as ISO strings", async () => {
      const mockWallet = createMockWallet({
        firstTradeAt: new Date("2025-12-01T10:30:00.000Z"),
        lastTradeAt: new Date("2026-01-14T15:45:30.000Z"),
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-14T12:00:00.000Z"),
      });
      const { GET } = await setupMocksAndGetHandler({
        wallet: mockWallet,
        trades: [],
      });

      const response = await GET(
        createRequest(mockWallet.address) as any,
        { params: createParams(mockWallet.address) }
      );
      const data = await response.json();

      expect(data.wallet.firstTradeAt).toBe("2025-12-01T10:30:00.000Z");
      expect(data.wallet.lastTradeAt).toBe("2026-01-14T15:45:30.000Z");
      expect(data.wallet.createdAt).toBe("2025-12-01T00:00:00.000Z");
      expect(data.wallet.updatedAt).toBe("2026-01-14T12:00:00.000Z");
      expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
