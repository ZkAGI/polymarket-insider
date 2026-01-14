/**
 * Dashboard Whales API Unit Tests
 *
 * Tests for the /api/dashboard/whales endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RiskLevel, WalletType } from "@prisma/client";

describe("Dashboard Whales API - GET /api/dashboard/whales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Sample wallet data for tests
  const createMockWallet = (overrides: Partial<{
    id: string;
    address: string;
    label: string | null;
    walletType: WalletType;
    suspicionScore: number;
    riskLevel: RiskLevel;
    totalVolume: number;
    tradeCount: number;
    winRate: number | null;
    totalPnl: number;
    avgTradeSize: number | null;
    maxTradeSize: number | null;
    firstTradeAt: Date | null;
    lastTradeAt: Date | null;
    walletAgeDays: number | null;
    isWhale: boolean;
    isInsider: boolean;
    isFresh: boolean;
    isFlagged: boolean;
    isMonitored: boolean;
    isSanctioned: boolean;
  }> = {}) => ({
    id: "wallet-1",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    label: "Suspicious Trader",
    walletType: WalletType.EOA,
    suspicionScore: 85,
    riskLevel: RiskLevel.HIGH,
    totalVolume: 500000,
    tradeCount: 150,
    winRate: 78.5,
    totalPnl: 125000,
    avgTradeSize: 3333.33,
    maxTradeSize: 50000,
    firstTradeAt: new Date("2026-01-01T00:00:00.000Z"),
    lastTradeAt: new Date("2026-01-14T12:00:00.000Z"),
    walletAgeDays: 30,
    isWhale: true,
    isInsider: false,
    isFresh: false,
    isFlagged: true,
    isMonitored: true,
    isSanctioned: false,
    ...overrides,
  });

  async function setupMocksAndGetHandler(mocks: {
    wallets?: ReturnType<typeof createMockWallet>[];
    count?: number;
    shouldThrow?: boolean;
  }) {
    const findManyMock = vi.fn();
    const countMock = vi.fn();

    if (mocks.shouldThrow) {
      findManyMock.mockRejectedValue(new Error("Database error"));
    } else {
      findManyMock.mockResolvedValue(mocks.wallets ?? []);
      countMock.mockResolvedValue(mocks.count ?? mocks.wallets?.length ?? 0);
    }

    vi.doMock("@/db/client", () => ({
      prisma: {
        wallet: {
          findMany: findManyMock,
          count: countMock,
        },
      },
    }));

    const { GET } = await import("@/app/api/dashboard/whales/route");
    return { GET, findManyMock, countMock };
  }

  function createRequest(queryParams: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/dashboard/whales");
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new Request(url.toString());
  }

  describe("Basic Response", () => {
    it("should return wallet summaries with correct structure", async () => {
      const mockWallets = [createMockWallet()];
      const { GET } = await setupMocksAndGetHandler({ wallets: mockWallets });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data).toHaveProperty("wallets");
      expect(data).toHaveProperty("pagination");
      expect(data).toHaveProperty("filters");
      expect(data).toHaveProperty("generatedAt");

      expect(data.pagination).toHaveProperty("offset");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("hasMore");

      expect(data.filters).toHaveProperty("minScore");
      expect(data.filters).toHaveProperty("isWhale");
      expect(data.filters).toHaveProperty("isInsider");
      expect(data.filters).toHaveProperty("isFlagged");
    });

    it("should return wallet data with all expected fields", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets).toHaveLength(1);
      const wallet = data.wallets[0];

      expect(wallet.id).toBe(mockWallet.id);
      expect(wallet.address).toBe(mockWallet.address);
      expect(wallet.label).toBe(mockWallet.label);
      expect(wallet.walletType).toBe(mockWallet.walletType);
      expect(wallet.suspicionScore).toBe(mockWallet.suspicionScore);
      expect(wallet.riskLevel).toBe(mockWallet.riskLevel);
      expect(wallet.totalVolume).toBe(mockWallet.totalVolume);
      expect(wallet.tradeCount).toBe(mockWallet.tradeCount);
      expect(wallet.winRate).toBe(mockWallet.winRate);
      expect(wallet.totalPnl).toBe(mockWallet.totalPnl);
      expect(wallet.avgTradeSize).toBe(mockWallet.avgTradeSize);
      expect(wallet.maxTradeSize).toBe(mockWallet.maxTradeSize);
      expect(wallet.walletAgeDays).toBe(mockWallet.walletAgeDays);
    });

    it("should return wallet flags correctly", async () => {
      const mockWallet = createMockWallet({
        isWhale: true,
        isInsider: true,
        isFresh: false,
        isFlagged: true,
        isMonitored: true,
        isSanctioned: false,
      });
      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets[0].flags).toEqual({
        isWhale: true,
        isInsider: true,
        isFresh: false,
        isFlagged: true,
        isMonitored: true,
        isSanctioned: false,
      });
    });

    it("should return timestamps as ISO strings", async () => {
      const mockWallet = createMockWallet({
        firstTradeAt: new Date("2026-01-01T10:00:00.000Z"),
        lastTradeAt: new Date("2026-01-14T15:30:00.000Z"),
      });
      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets[0].firstTradeAt).toBe("2026-01-01T10:00:00.000Z");
      expect(data.wallets[0].lastTradeAt).toBe("2026-01-14T15:30:00.000Z");
    });

    it("should handle null timestamps", async () => {
      const mockWallet = createMockWallet({
        firstTradeAt: null,
        lastTradeAt: null,
      });
      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets[0].firstTradeAt).toBeNull();
      expect(data.wallets[0].lastTradeAt).toBeNull();
    });

    it("should return 200 status code on success", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(createRequest() as any);

      expect(response.status).toBe(200);
    });
  });

  describe("Pagination", () => {
    it("should use default limit of 10 when not specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it("should use custom limit when specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ limit: "25" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 })
      );
    });

    it("should cap limit at 50", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ limit: "100" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it("should enforce minimum limit of 1", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ limit: "0" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 })
      );
    });

    it("should handle invalid limit gracefully", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ limit: "invalid" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it("should use default offset of 0 when not specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });

    it("should use custom offset when specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ offset: "20" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20 })
      );
    });

    it("should return correct pagination info", async () => {
      const mockWallets = [createMockWallet()];
      const { GET } = await setupMocksAndGetHandler({
        wallets: mockWallets,
        count: 50,
      });

      const response = await GET(createRequest({ limit: "10", offset: "20" }) as any);
      const data = await response.json();

      expect(data.pagination.offset).toBe(20);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.hasMore).toBe(true);
    });

    it("should set hasMore to false when on last page", async () => {
      const mockWallets = [createMockWallet()];
      const { GET } = await setupMocksAndGetHandler({
        wallets: mockWallets,
        count: 21,
      });

      const response = await GET(createRequest({ limit: "10", offset: "20" }) as any);
      const data = await response.json();

      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("Filtering", () => {
    it("should filter by minimum suspicion score", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ minScore: "75" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            suspicionScore: { gte: 75 },
          }),
        })
      );
    });

    it("should cap minScore at 100", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ minScore: "150" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            suspicionScore: { gte: 100 },
          }),
        })
      );
    });

    it("should enforce minimum minScore of 0", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ minScore: "-10" }) as any);

      // minScore of 0 or less shouldn't add the filter
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            suspicionScore: expect.anything(),
          }),
        })
      );
    });

    it("should filter by isWhale true", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ isWhale: "true" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isWhale: true,
          }),
        })
      );
    });

    it("should filter by isWhale false", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ isWhale: "false" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isWhale: false,
          }),
        })
      );
    });

    it("should filter by isInsider", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ isInsider: "true" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isInsider: true,
          }),
        })
      );
    });

    it("should filter by isFlagged", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ isFlagged: "true" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isFlagged: true,
          }),
        })
      );
    });

    it("should ignore invalid boolean values", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest({ isWhale: "invalid" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isWhale: expect.anything(),
          }),
        })
      );
    });

    it("should combine multiple filters", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(
        createRequest({
          minScore: "80",
          isWhale: "true",
          isFlagged: "true",
        }) as any
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            suspicionScore: { gte: 80 },
            isWhale: true,
            isFlagged: true,
          }),
        })
      );
    });

    it("should return applied filters in response", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(
        createRequest({
          minScore: "75",
          isWhale: "true",
          isInsider: "false",
          isFlagged: "true",
        }) as any
      );
      const data = await response.json();

      expect(data.filters.minScore).toBe(75);
      expect(data.filters.isWhale).toBe(true);
      expect(data.filters.isInsider).toBe(false);
      expect(data.filters.isFlagged).toBe(true);
    });

    it("should return null for filters not applied", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.filters.minScore).toBeNull();
      expect(data.filters.isWhale).toBeNull();
      expect(data.filters.isInsider).toBeNull();
      expect(data.filters.isFlagged).toBeNull();
    });
  });

  describe("Ordering", () => {
    it("should order by suspicion score descending then total volume descending", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ wallets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ suspicionScore: "desc" }, { totalVolume: "desc" }],
        })
      );
    });
  });

  describe("Caching", () => {
    it("should include Cache-Control header", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=15, stale-while-revalidate=30"
      );
    });

    it("should include X-Cache header indicating cache miss on first request", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("X-Cache")).toBe("MISS");
    });

    it("should return cache HIT on subsequent requests within TTL", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock } = await setupMocksAndGetHandler({
        wallets: [createMockWallet()],
        count: 1,
      });

      // First request
      const response1 = await GET(createRequest() as any);
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request within 15s TTL
      vi.setSystemTime(new Date("2026-01-14T12:00:10.000Z"));
      const response2 = await GET(createRequest() as any);
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // findMany should only be called once
      expect(findManyMock).toHaveBeenCalledTimes(1);
    });

    it("should use different cache keys for different filter combinations", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock } = await setupMocksAndGetHandler({
        wallets: [],
        count: 0,
      });

      // First request with no filters
      await GET(createRequest() as any);

      // Second request with different filters should be cache MISS
      const response2 = await GET(createRequest({ isWhale: "true" }) as any);
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      // findMany should be called twice for different filter combinations
      expect(findManyMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 status on database error", async () => {
      const { GET } = await setupMocksAndGetHandler({ shouldThrow: true });

      const response = await GET(createRequest() as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch dashboard whales");
    });
  });

  describe("Empty State", () => {
    it("should return empty array when no wallets match", async () => {
      const { GET } = await setupMocksAndGetHandler({ wallets: [], count: 0 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("Multiple Wallets", () => {
    it("should return multiple wallets correctly", async () => {
      const wallet1 = createMockWallet({
        id: "wallet-1",
        address: "0x1111111111111111111111111111111111111111",
        suspicionScore: 95,
      });
      const wallet2 = createMockWallet({
        id: "wallet-2",
        address: "0x2222222222222222222222222222222222222222",
        suspicionScore: 85,
      });
      const wallet3 = createMockWallet({
        id: "wallet-3",
        address: "0x3333333333333333333333333333333333333333",
        suspicionScore: 75,
      });

      const { GET } = await setupMocksAndGetHandler({
        wallets: [wallet1, wallet2, wallet3],
        count: 3,
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets).toHaveLength(3);
      expect(data.wallets[0].id).toBe("wallet-1");
      expect(data.wallets[1].id).toBe("wallet-2");
      expect(data.wallets[2].id).toBe("wallet-3");
    });
  });

  describe("Wallet Types", () => {
    it("should handle all wallet types", async () => {
      const walletTypes: WalletType[] = [
        WalletType.UNKNOWN,
        WalletType.EOA,
        WalletType.CONTRACT,
        WalletType.EXCHANGE,
        WalletType.DEFI,
        WalletType.MARKET_MAKER,
        WalletType.INSTITUTIONAL,
        WalletType.BOT,
      ];

      for (const walletType of walletTypes) {
        vi.resetModules();

        const mockWallet = createMockWallet({
          id: `wallet-${walletType}`,
          walletType,
        });
        const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

        const response = await GET(createRequest() as any);
        const data = await response.json();

        expect(data.wallets[0].walletType).toBe(walletType);
      }
    });
  });

  describe("Risk Levels", () => {
    it("should handle all risk levels", async () => {
      const riskLevels: RiskLevel[] = [
        RiskLevel.NONE,
        RiskLevel.LOW,
        RiskLevel.MEDIUM,
        RiskLevel.HIGH,
        RiskLevel.CRITICAL,
      ];

      for (const riskLevel of riskLevels) {
        vi.resetModules();

        const mockWallet = createMockWallet({
          id: `wallet-${riskLevel}`,
          riskLevel,
        });
        const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

        const response = await GET(createRequest() as any);
        const data = await response.json();

        expect(data.wallets[0].riskLevel).toBe(riskLevel);
      }
    });
  });

  describe("Null Values", () => {
    it("should handle null optional fields", async () => {
      const mockWallet = createMockWallet({
        label: null,
        winRate: null,
        avgTradeSize: null,
        maxTradeSize: null,
        firstTradeAt: null,
        lastTradeAt: null,
        walletAgeDays: null,
      });

      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.wallets[0].label).toBeNull();
      expect(data.wallets[0].winRate).toBeNull();
      expect(data.wallets[0].avgTradeSize).toBeNull();
      expect(data.wallets[0].maxTradeSize).toBeNull();
      expect(data.wallets[0].firstTradeAt).toBeNull();
      expect(data.wallets[0].lastTradeAt).toBeNull();
      expect(data.wallets[0].walletAgeDays).toBeNull();
    });
  });

  describe("Generated At Timestamp", () => {
    it("should include generatedAt timestamp", async () => {
      const now = new Date("2026-01-14T12:00:00.000Z");
      vi.setSystemTime(now);

      const { GET } = await setupMocksAndGetHandler({ wallets: [] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.generatedAt).toBe("2026-01-14T12:00:00.000Z");
    });
  });

  describe("Data Types", () => {
    it("should return correct data types for all fields", async () => {
      const mockWallet = createMockWallet();
      const { GET } = await setupMocksAndGetHandler({ wallets: [mockWallet] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      const wallet = data.wallets[0];

      expect(typeof wallet.id).toBe("string");
      expect(typeof wallet.address).toBe("string");
      expect(typeof wallet.suspicionScore).toBe("number");
      expect(typeof wallet.totalVolume).toBe("number");
      expect(typeof wallet.tradeCount).toBe("number");
      expect(typeof wallet.totalPnl).toBe("number");
      expect(typeof wallet.flags.isWhale).toBe("boolean");
      expect(typeof wallet.flags.isInsider).toBe("boolean");
      expect(typeof wallet.flags.isFresh).toBe("boolean");
      expect(typeof wallet.flags.isFlagged).toBe("boolean");
      expect(typeof wallet.flags.isMonitored).toBe("boolean");
      expect(typeof wallet.flags.isSanctioned).toBe("boolean");
    });
  });
});
