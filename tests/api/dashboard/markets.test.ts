/**
 * Dashboard Markets API Unit Tests
 *
 * Tests for the /api/dashboard/markets endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertType } from "@prisma/client";

describe("Dashboard Markets API - GET /api/dashboard/markets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Sample market data for tests
  const createMockMarket = (
    overrides: Partial<{
      id: string;
      question: string;
      slug: string;
      category: string | null;
      subcategory: string | null;
      volume: number;
      volume24h: number;
      liquidity: number;
      active: boolean;
      closed: boolean;
      endDate: Date | null;
      imageUrl: string | null;
      outcomes: { name: string; price: number; priceChange24h: number }[];
    }> = {}
  ) => ({
    id: "market-1",
    question: "Will Bitcoin reach $100k in 2026?",
    slug: "bitcoin-100k-2026",
    category: "crypto",
    subcategory: "bitcoin",
    volume: 5000000,
    volume24h: 250000,
    liquidity: 100000,
    active: true,
    closed: false,
    endDate: new Date("2026-12-31T23:59:59.000Z"),
    imageUrl: "https://example.com/bitcoin.png",
    outcomes: [
      { name: "Yes", price: 0.65, priceChange24h: 5.2 },
      { name: "No", price: 0.35, priceChange24h: -5.2 },
    ],
    ...overrides,
  });

  async function setupMocksAndGetHandler(mocks: {
    markets?: ReturnType<typeof createMockMarket>[];
    alertsByMarket?: { marketId: string | null; _count: { id: number } }[];
    topAlertTypes?: { marketId: string | null; type: AlertType; _count: { id: number } }[];
    marketCount?: number;
    shouldThrow?: boolean;
  }) {
    const findManyMock = vi.fn();
    const countMock = vi.fn();
    const groupByMock = vi.fn();

    if (mocks.shouldThrow) {
      findManyMock.mockRejectedValue(new Error("Database error"));
    } else {
      findManyMock.mockResolvedValue(mocks.markets ?? []);
      countMock.mockResolvedValue(mocks.marketCount ?? mocks.markets?.length ?? 0);

      // Set up groupBy mock to return different results based on call order
      const alertCounts = mocks.alertsByMarket ?? [];
      const alertTypes = mocks.topAlertTypes ?? [];

      groupByMock
        .mockResolvedValueOnce(alertCounts) // First call: alerts by market
        .mockResolvedValueOnce(alertTypes); // Second call: top alert types
    }

    vi.doMock("@/db/client", () => ({
      prisma: {
        market: {
          findMany: findManyMock,
          count: countMock,
        },
        alert: {
          groupBy: groupByMock,
        },
      },
    }));

    const { GET } = await import("@/app/api/dashboard/markets/route");
    return { GET, findManyMock, countMock, groupByMock };
  }

  function createRequest(queryParams: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/dashboard/markets");
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new Request(url.toString());
  }

  describe("Basic Response", () => {
    it("should return market summaries with correct structure", async () => {
      const mockMarkets = [createMockMarket()];
      const { GET } = await setupMocksAndGetHandler({ markets: mockMarkets });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data).toHaveProperty("markets");
      expect(data).toHaveProperty("pagination");
      expect(data).toHaveProperty("filters");
      expect(data).toHaveProperty("generatedAt");

      expect(data.pagination).toHaveProperty("offset");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("hasMore");

      expect(data.filters).toHaveProperty("category");
    });

    it("should return market data with all expected fields", async () => {
      const mockMarket = createMockMarket();
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets).toHaveLength(1);
      const market = data.markets[0];

      expect(market.id).toBe(mockMarket.id);
      expect(market.question).toBe(mockMarket.question);
      expect(market.slug).toBe(mockMarket.slug);
      expect(market.category).toBe(mockMarket.category);
      expect(market.subcategory).toBe(mockMarket.subcategory);
      expect(market.volume).toBe(mockMarket.volume);
      expect(market.volume24h).toBe(mockMarket.volume24h);
      expect(market.liquidity).toBe(mockMarket.liquidity);
      expect(market.active).toBe(mockMarket.active);
      expect(market.closed).toBe(mockMarket.closed);
      expect(market.imageUrl).toBe(mockMarket.imageUrl);
    });

    it("should return outcomes correctly", async () => {
      const mockMarket = createMockMarket({
        outcomes: [
          { name: "Yes", price: 0.75, priceChange24h: 10.5 },
          { name: "No", price: 0.25, priceChange24h: -10.5 },
        ],
      });
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].outcomes).toHaveLength(2);
      expect(data.markets[0].outcomes[0]).toEqual({
        name: "Yes",
        price: 0.75,
        priceChange24h: 10.5,
      });
      expect(data.markets[0].outcomes[1]).toEqual({
        name: "No",
        price: 0.25,
        priceChange24h: -10.5,
      });
    });

    it("should return endDate as ISO string", async () => {
      const mockMarket = createMockMarket({
        endDate: new Date("2026-06-30T12:00:00.000Z"),
      });
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].endDate).toBe("2026-06-30T12:00:00.000Z");
    });

    it("should handle null endDate", async () => {
      const mockMarket = createMockMarket({ endDate: null });
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].endDate).toBeNull();
    });

    it("should return 200 status code on success", async () => {
      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest() as any);

      expect(response.status).toBe(200);
    });
  });

  describe("Alert Count and Top Alert Type", () => {
    it("should include alertCount from grouped alerts", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });
      const { GET } = await setupMocksAndGetHandler({
        markets: [mockMarket],
        alertsByMarket: [{ marketId: "market-1", _count: { id: 15 } }],
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].alertCount).toBe(15);
    });

    it("should include topAlertType from grouped alerts", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });
      const { GET } = await setupMocksAndGetHandler({
        markets: [mockMarket],
        alertsByMarket: [{ marketId: "market-1", _count: { id: 10 } }],
        topAlertTypes: [
          { marketId: "market-1", type: AlertType.WHALE_TRADE, _count: { id: 8 } },
          { marketId: "market-1", type: AlertType.FRESH_WALLET, _count: { id: 2 } },
        ],
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].topAlertType).toBe(AlertType.WHALE_TRADE);
    });

    it("should return 0 alertCount when no alerts", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });
      const { GET } = await setupMocksAndGetHandler({
        markets: [mockMarket],
        alertsByMarket: [],
        topAlertTypes: [],
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].alertCount).toBe(0);
    });

    it("should return null topAlertType when no alerts", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });
      const { GET } = await setupMocksAndGetHandler({
        markets: [mockMarket],
        alertsByMarket: [],
        topAlertTypes: [],
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].topAlertType).toBeNull();
    });
  });

  describe("Pagination", () => {
    it("should use default limit of 10 when not specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it("should use custom limit when specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ limit: "25" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 })
      );
    });

    it("should cap limit at 50", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ limit: "100" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it("should enforce minimum limit of 1", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ limit: "0" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 })
      );
    });

    it("should handle invalid limit gracefully", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ limit: "invalid" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it("should use default offset of 0 when not specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });

    it("should use custom offset when specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ offset: "20" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20 })
      );
    });

    it("should return correct pagination info", async () => {
      const mockMarkets = [createMockMarket()];
      const { GET } = await setupMocksAndGetHandler({
        markets: mockMarkets,
        marketCount: 50,
      });

      const response = await GET(createRequest({ limit: "10", offset: "20" }) as any);
      const data = await response.json();

      expect(data.pagination.offset).toBe(20);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.hasMore).toBe(true);
    });

    it("should set hasMore to false when on last page", async () => {
      const mockMarkets = [createMockMarket()];
      const { GET } = await setupMocksAndGetHandler({
        markets: mockMarkets,
        marketCount: 21,
      });

      const response = await GET(createRequest({ limit: "10", offset: "20" }) as any);
      const data = await response.json();

      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("Category Filtering", () => {
    it("should filter by category when specified", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ category: "politics" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: expect.objectContaining({
              equals: "politics",
              mode: "insensitive",
            }),
          }),
        })
      );
    });

    it("should return applied category filter in response", async () => {
      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest({ category: "crypto" }) as any);
      const data = await response.json();

      expect(data.filters.category).toBe("crypto");
    });

    it("should return null category when not filtered", async () => {
      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.filters.category).toBeNull();
    });

    it("should perform case-insensitive category matching", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest({ category: "POLITICS" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: expect.objectContaining({
              mode: "insensitive",
            }),
          }),
        })
      );
    });
  });

  describe("Ordering", () => {
    it("should order by volume24h and volume when no alerts", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ markets: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ volume24h: "desc" }, { volume: "desc" }],
        })
      );
    });
  });

  describe("Caching", () => {
    it("should include Cache-Control header", async () => {
      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=30, stale-while-revalidate=60"
      );
    });

    it("should include X-Cache header indicating cache miss on first request", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("X-Cache")).toBe("MISS");
    });

    it("should return cache HIT on subsequent requests within TTL", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock } = await setupMocksAndGetHandler({
        markets: [createMockMarket()],
        marketCount: 1,
      });

      // First request
      const response1 = await GET(createRequest() as any);
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request within 30s TTL
      vi.setSystemTime(new Date("2026-01-14T12:00:20.000Z"));
      const response2 = await GET(createRequest() as any);
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // findMany should only be called once
      expect(findManyMock).toHaveBeenCalledTimes(1);
    });

    it("should use different cache keys for different filter combinations", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock, groupByMock } = await setupMocksAndGetHandler({
        markets: [],
        marketCount: 0,
        alertsByMarket: [],
        topAlertTypes: [],
      });

      // Reset groupBy mock to handle multiple calls
      groupByMock
        .mockResolvedValue([]) // For subsequent calls
        .mockResolvedValueOnce([]) // First call: alerts by market
        .mockResolvedValueOnce([]) // Second call: top alert types
        .mockResolvedValueOnce([]) // Third call: alerts by market (second request)
        .mockResolvedValueOnce([]); // Fourth call: top alert types (second request)

      // First request with no filters
      await GET(createRequest() as any);

      // Second request with category filter should be cache MISS
      const response2 = await GET(createRequest({ category: "politics" }) as any);
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
      expect(data.error).toBe("Failed to fetch dashboard markets");
    });
  });

  describe("Empty State", () => {
    it("should return empty array when no markets match", async () => {
      const { GET } = await setupMocksAndGetHandler({ markets: [], marketCount: 0 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("Multiple Markets", () => {
    it("should return multiple markets correctly", async () => {
      const market1 = createMockMarket({
        id: "market-1",
        question: "Question 1",
        volume24h: 100000,
      });
      const market2 = createMockMarket({
        id: "market-2",
        question: "Question 2",
        volume24h: 80000,
      });
      const market3 = createMockMarket({
        id: "market-3",
        question: "Question 3",
        volume24h: 60000,
      });

      const { GET } = await setupMocksAndGetHandler({
        markets: [market1, market2, market3],
        marketCount: 3,
      });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets).toHaveLength(3);
      expect(data.markets[0].id).toBe("market-1");
      expect(data.markets[1].id).toBe("market-2");
      expect(data.markets[2].id).toBe("market-3");
    });
  });

  describe("Alert Types", () => {
    it("should handle all alert types", async () => {
      const alertTypes: AlertType[] = [
        AlertType.WHALE_TRADE,
        AlertType.PRICE_MOVEMENT,
        AlertType.INSIDER_ACTIVITY,
        AlertType.FRESH_WALLET,
        AlertType.WALLET_REACTIVATION,
        AlertType.COORDINATED_ACTIVITY,
        AlertType.UNUSUAL_PATTERN,
        AlertType.MARKET_RESOLVED,
        AlertType.NEW_MARKET,
        AlertType.SUSPICIOUS_FUNDING,
        AlertType.SANCTIONED_ACTIVITY,
        AlertType.SYSTEM,
      ];

      for (const alertType of alertTypes) {
        vi.resetModules();

        const mockMarket = createMockMarket({ id: `market-${alertType}` });
        const { GET } = await setupMocksAndGetHandler({
          markets: [mockMarket],
          alertsByMarket: [{ marketId: `market-${alertType}`, _count: { id: 1 } }],
          topAlertTypes: [{ marketId: `market-${alertType}`, type: alertType, _count: { id: 1 } }],
        });

        const response = await GET(createRequest() as any);
        const data = await response.json();

        expect(data.markets[0].topAlertType).toBe(alertType);
      }
    });
  });

  describe("Null Values", () => {
    it("should handle null optional fields", async () => {
      const mockMarket = createMockMarket({
        category: null,
        subcategory: null,
        endDate: null,
        imageUrl: null,
        outcomes: [],
      });

      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].category).toBeNull();
      expect(data.markets[0].subcategory).toBeNull();
      expect(data.markets[0].endDate).toBeNull();
      expect(data.markets[0].imageUrl).toBeNull();
      expect(data.markets[0].outcomes).toEqual([]);
    });
  });

  describe("Generated At Timestamp", () => {
    it("should include generatedAt timestamp", async () => {
      const now = new Date("2026-01-14T12:00:00.000Z");
      vi.setSystemTime(now);

      const { GET } = await setupMocksAndGetHandler({ markets: [] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.generatedAt).toBe("2026-01-14T12:00:00.000Z");
    });
  });

  describe("Data Types", () => {
    it("should return correct data types for all fields", async () => {
      const mockMarket = createMockMarket();
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      const market = data.markets[0];

      expect(typeof market.id).toBe("string");
      expect(typeof market.question).toBe("string");
      expect(typeof market.slug).toBe("string");
      expect(typeof market.volume).toBe("number");
      expect(typeof market.volume24h).toBe("number");
      expect(typeof market.liquidity).toBe("number");
      expect(typeof market.alertCount).toBe("number");
      expect(typeof market.active).toBe("boolean");
      expect(typeof market.closed).toBe("boolean");
      expect(Array.isArray(market.outcomes)).toBe(true);
    });
  });

  describe("Market Categories", () => {
    it("should support various market categories", async () => {
      const categories = ["politics", "crypto", "sports", "entertainment", "science", "technology"];

      for (const category of categories) {
        vi.resetModules();

        const mockMarket = createMockMarket({ category });
        const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

        const response = await GET(createRequest({ category }) as any);
        const data = await response.json();

        expect(data.filters.category).toBe(category);
      }
    });
  });

  describe("Active and Closed Markets", () => {
    it("should include active status", async () => {
      const mockMarket = createMockMarket({ active: true, closed: false });
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].active).toBe(true);
      expect(data.markets[0].closed).toBe(false);
    });

    it("should include closed status", async () => {
      const mockMarket = createMockMarket({ active: false, closed: true });
      const { GET } = await setupMocksAndGetHandler({ markets: [mockMarket] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.markets[0].active).toBe(false);
      expect(data.markets[0].closed).toBe(true);
    });
  });
});
