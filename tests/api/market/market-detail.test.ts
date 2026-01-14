/**
 * Market Detail API Unit Tests
 *
 * Tests for the GET /api/market/[id] endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TradeSide } from "@prisma/client";

describe("Market Detail API - GET /api/market/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Mock Data Factories
  // ============================================================================

  const createMockMarket = (
    overrides: Partial<{
      id: string;
      slug: string;
      question: string;
      description: string | null;
      category: string | null;
      subcategory: string | null;
      tags: string[];
      imageUrl: string | null;
      iconUrl: string | null;
      resolutionSource: string | null;
      active: boolean;
      closed: boolean;
      archived: boolean;
      endDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      resolution: string | null;
      resolvedAt: Date | null;
      volume: number;
      volume24h: number;
      liquidity: number;
    }> = {}
  ) => ({
    id: "market-1",
    slug: "will-bitcoin-hit-100k",
    question: "Will Bitcoin hit $100k?",
    description: "Market resolves YES if BTC hits $100k by end of 2024",
    category: "CRYPTO",
    subcategory: "Bitcoin",
    tags: ["crypto", "bitcoin"],
    imageUrl: "https://example.com/image.png",
    iconUrl: "https://example.com/icon.png",
    resolutionSource: "CoinGecko",
    active: true,
    closed: false,
    archived: false,
    endDate: new Date("2024-12-31T23:59:59.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-14T12:00:00.000Z"),
    resolution: null,
    resolvedAt: null,
    volume: 1000000,
    volume24h: 50000,
    liquidity: 200000,
    ...overrides,
  });

  const createMockOutcome = (
    overrides: Partial<{
      id: string;
      marketId: string;
      name: string;
      price: number;
      probability: number;
      priceChange24h: number;
      volume: number;
      winner: boolean | null;
      clobTokenId: string | null;
      displayOrder: number;
    }> = {}
  ) => ({
    id: "outcome-1",
    marketId: "market-1",
    name: "YES",
    price: 0.65,
    probability: 65,
    priceChange24h: 2.5,
    volume: 500000,
    winner: null,
    clobTokenId: "clob-token-1",
    displayOrder: 0,
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
      timestamp: Date;
      txHash: string | null;
      isWhale: boolean;
      wallet: { address: string };
      outcome: { name: string } | null;
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
    timestamp: new Date("2026-01-14T10:00:00.000Z"),
    txHash: "0x" + "a".repeat(64),
    isWhale: false,
    wallet: { address: "0x1234567890abcdef1234567890abcdef12345678" },
    outcome: { name: "YES" },
    ...overrides,
  });

  const createMockPriceHistory = (
    overrides: Partial<{
      timestamp: Date;
      price: number;
      volume: number;
    }> = {}
  ) => ({
    timestamp: new Date("2026-01-14T10:00:00.000Z"),
    price: 0.65,
    volume: 1000,
    ...overrides,
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function setupMocksAndGetHandler(mocks: {
    market?: ReturnType<typeof createMockMarket> | null;
    outcomes?: ReturnType<typeof createMockOutcome>[];
    trades?: ReturnType<typeof createMockTrade>[];
    tradeCount?: number;
    priceHistory?: ReturnType<typeof createMockPriceHistory>[];
    gammaMarket?: object | null;
    shouldThrow?: boolean;
  }) {
    const marketFindUniqueMock = vi.fn();
    const tradeFindManyMock = vi.fn();
    const tradeCountMock = vi.fn();
    const priceHistoryFindManyMock = vi.fn();
    const getMarketByIdMock = vi.fn();

    if (mocks.shouldThrow) {
      marketFindUniqueMock.mockRejectedValue(new Error("Database error"));
    } else {
      // Return market with outcomes included
      if (mocks.market) {
        marketFindUniqueMock.mockResolvedValue({
          ...mocks.market,
          outcomes: mocks.outcomes ?? [],
        });
      } else {
        marketFindUniqueMock.mockResolvedValue(null);
      }

      tradeFindManyMock.mockResolvedValue(mocks.trades ?? []);
      tradeCountMock.mockResolvedValue(mocks.tradeCount ?? 0);
      priceHistoryFindManyMock.mockResolvedValue(mocks.priceHistory ?? []);

      if (mocks.gammaMarket === undefined) {
        getMarketByIdMock.mockResolvedValue(null);
      } else {
        getMarketByIdMock.mockResolvedValue(mocks.gammaMarket);
      }
    }

    // Mock prisma
    vi.doMock("@/db/client", () => ({
      prisma: {
        market: {
          findUnique: marketFindUniqueMock,
        },
        trade: {
          findMany: tradeFindManyMock,
          count: tradeCountMock,
        },
        priceHistory: {
          findMany: priceHistoryFindManyMock,
        },
      },
    }));

    // Mock gamma API
    vi.doMock("@/api/gamma/markets", () => ({
      getMarketById: getMarketByIdMock,
    }));

    // Import the route handler after mocking
    const { GET } = await import("@/app/api/market/[id]/route");

    return {
      GET,
      mocks: {
        marketFindUnique: marketFindUniqueMock,
        tradeFindMany: tradeFindManyMock,
        tradeCount: tradeCountMock,
        priceHistoryFindMany: priceHistoryFindManyMock,
        getMarketById: getMarketByIdMock,
      },
    };
  }

  function createMockRequest(
    marketId: string,
    queryParams: Record<string, string> = {}
  ): Request {
    const url = new URL(`http://localhost/api/market/${marketId}`);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
    return new Request(url.toString());
  }

  // Type-safe helper for passing request to GET handler
  function asNextRequest(request: Request): any {
    return request;
  }

  // ============================================================================
  // Input Validation Tests
  // ============================================================================

  describe("Input Validation", () => {
    it("should return 400 for empty market ID", async () => {
      const { GET } = await setupMocksAndGetHandler({});
      const request = createMockRequest("");

      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid market ID");
    });

    it("should return 400 for whitespace-only market ID", async () => {
      const { GET } = await setupMocksAndGetHandler({});
      const request = createMockRequest("   ");

      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "   " }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid market ID");
    });
  });

  // ============================================================================
  // Market Not Found Tests
  // ============================================================================

  describe("Market Not Found", () => {
    it("should return 404 when market not in database or Gamma API", async () => {
      const { GET } = await setupMocksAndGetHandler({
        market: null,
        gammaMarket: null,
      });

      const request = createMockRequest("non-existent-market");
      const response = await GET(asNextRequest(request), {
        params: Promise.resolve({ id: "non-existent-market" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Market not found");
    });
  });

  // ============================================================================
  // Successful Response Tests
  // ============================================================================

  describe("Successful Response", () => {
    it("should return complete market data from database", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [
        createMockOutcome({ id: "outcome-1", name: "YES", price: 0.65 }),
        createMockOutcome({ id: "outcome-2", name: "NO", price: 0.35, displayOrder: 1 }),
      ];
      const mockTrades = [
        createMockTrade({ id: "trade-1" }),
        createMockTrade({ id: "trade-2", side: TradeSide.SELL }),
      ];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        trades: mockTrades,
        tradeCount: 100,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.market.id).toBe("market-1");
      expect(data.market.question).toBe("Will Bitcoin hit $100k?");
      expect(data.market.outcomes).toHaveLength(2);
      expect(data.trades.items).toHaveLength(2);
      expect(data.trades.total).toBe(100);
      expect(data.priceHistory).toBeDefined();
      expect(data.volumeHistory).toBeDefined();
      expect(data.generatedAt).toBeDefined();
    });

    it("should include price history data", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];
      const mockPriceHistory = [
        createMockPriceHistory({ timestamp: new Date("2026-01-13T00:00:00.000Z"), price: 0.60 }),
        createMockPriceHistory({ timestamp: new Date("2026-01-14T00:00:00.000Z"), price: 0.65 }),
      ];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        priceHistory: mockPriceHistory,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceHistory.outcomeId).toBe("outcome-1");
      expect(data.priceHistory.outcomeName).toBe("YES");
      expect(data.priceHistory.dataPoints).toBeDefined();
    });

    it("should include volume history data", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];
      const mockTrades = [
        createMockTrade({
          id: "trade-1",
          timestamp: new Date("2026-01-13T10:00:00.000Z"),
          usdValue: 1000,
        }),
        createMockTrade({
          id: "trade-2",
          timestamp: new Date("2026-01-14T10:00:00.000Z"),
          usdValue: 2000,
        }),
      ];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        trades: mockTrades,
        tradeCount: 2,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.volumeHistory.interval).toBe("1d");
      expect(data.volumeHistory.dataPoints).toBeDefined();
    });
  });

  // ============================================================================
  // Query Parameter Tests
  // ============================================================================

  describe("Query Parameters", () => {
    it("should accept custom price interval", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1", { priceInterval: "1h" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceHistory.interval).toBe("1h");
    });

    it("should accept custom volume interval", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1", { volumeInterval: "4h" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.volumeHistory.interval).toBe("4h");
    });

    it("should accept custom price days", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1", { priceDays: "7" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      // The start date should be 7 days ago from the fixed time
      const startDate = new Date(data.priceHistory.startDate);
      const endDate = new Date(data.priceHistory.endDate);
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(7);
    });

    it("should accept custom trades limit", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];
      const mockTrades = Array.from({ length: 5 }, (_, i) =>
        createMockTrade({ id: `trade-${i}` })
      );

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        trades: mockTrades,
        tradeCount: 100,
      });

      const request = createMockRequest("market-1", { tradesLimit: "5" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trades.limit).toBe(5);
    });

    it("should clamp invalid price days to valid range", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      // Test value above max
      const request = createMockRequest("market-1", { priceDays: "500" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      const startDate = new Date(data.priceHistory.startDate);
      const endDate = new Date(data.priceHistory.endDate);
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(180); // Max is 180
    });

    it("should use default values for invalid interval", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1", { priceInterval: "invalid" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceHistory.interval).toBe("1d"); // Default
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe("Caching", () => {
    it("should return cache miss on first request", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(response.headers.get("Cache-Control")).toContain("max-age=30");
    });

    it("should return cache hit on subsequent request", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request1 = createMockRequest("market-1");
      await GET(asNextRequest(request1), { params: Promise.resolve({ id: "market-1" }) });

      // Second request should hit cache
      const request2 = createMockRequest("market-1");
      const response2 = await GET(asNextRequest(request2), { params: Promise.resolve({ id: "market-1" }) });

      expect(response2.status).toBe(200);
      expect(response2.headers.get("X-Cache")).toBe("HIT");
    });
  });

  // ============================================================================
  // Gamma API Fallback Tests
  // ============================================================================

  describe("Gamma API Fallback", () => {
    it("should fetch from Gamma API when not in database", async () => {
      const gammaMarket = {
        id: "gamma-market-1",
        slug: "gamma-market-slug",
        question: "Gamma Market Question",
        description: "From Gamma API",
        category: "POLITICS",
        active: true,
        closed: false,
        archived: false,
        volume: 500000,
        volumeNum: 25000,
        liquidity: 100000,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2026-01-14T12:00:00.000Z",
        outcomes: [
          { id: "gamma-outcome-1", name: "YES", price: 0.7, clobTokenId: "clob-1" },
          { id: "gamma-outcome-2", name: "NO", price: 0.3, clobTokenId: "clob-2" },
        ],
      };

      const { GET, mocks } = await setupMocksAndGetHandler({
        market: null,
        gammaMarket,
      });

      const request = createMockRequest("gamma-market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "gamma-market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mocks.getMarketById).toHaveBeenCalledWith("gamma-market-1");
      expect(data.market.id).toBe("gamma-market-1");
      expect(data.market.question).toBe("Gamma Market Question");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      const { GET } = await setupMocksAndGetHandler({
        shouldThrow: true,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch market details");
      expect(data.details).toBe("Database error");
    });
  });

  // ============================================================================
  // Trade Response Format Tests
  // ============================================================================

  describe("Trade Response Format", () => {
    it("should return trades with correct structure", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome()];
      const mockTrades = [
        createMockTrade({
          id: "trade-1",
          side: TradeSide.BUY,
          amount: 1000,
          price: 0.65,
          usdValue: 650,
          isWhale: true,
          txHash: "0x" + "abc".repeat(21) + "a",
        }),
      ];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        trades: mockTrades,
        tradeCount: 1,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trades.items[0]).toEqual(
        expect.objectContaining({
          id: "trade-1",
          side: "BUY",
          price: 0.65,
          size: 650,
          shares: 1000,
          isWhale: true,
          outcome: "YES",
        })
      );
    });
  });

  // ============================================================================
  // Market Response Format Tests
  // ============================================================================

  describe("Market Response Format", () => {
    it("should include polymarket URL in response", async () => {
      const mockMarket = createMockMarket({ slug: "test-market-slug" });
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.market.polymarketUrl).toBe("https://polymarket.com/event/test-market-slug");
    });

    it("should include all outcome data", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [
        createMockOutcome({
          id: "outcome-1",
          name: "YES",
          price: 0.65,
          probability: 65,
          priceChange24h: 5.0,
          volume: 500000,
          winner: null,
          clobTokenId: "clob-yes",
        }),
        createMockOutcome({
          id: "outcome-2",
          name: "NO",
          price: 0.35,
          probability: 35,
          priceChange24h: -5.0,
          volume: 200000,
          winner: null,
          clobTokenId: "clob-no",
          displayOrder: 1,
        }),
      ];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
      });

      const request = createMockRequest("market-1");
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.market.outcomes).toHaveLength(2);
      expect(data.market.outcomes[0]).toEqual(
        expect.objectContaining({
          id: "outcome-1",
          name: "YES",
          price: 0.65,
          probability: 65,
          priceChange24h: 5.0,
          clobTokenId: "clob-yes",
        })
      );
    });
  });

  // ============================================================================
  // Synthetic Data Generation Tests
  // ============================================================================

  describe("Synthetic Data Generation", () => {
    it("should generate synthetic price history when none exists", async () => {
      const mockMarket = createMockMarket();
      const mockOutcomes = [createMockOutcome({ price: 0.65 })];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        priceHistory: [], // Empty price history
      });

      const request = createMockRequest("market-1", { priceDays: "7" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.priceHistory.dataPoints.length).toBeGreaterThan(0);
      // Last point should be close to current price
      const lastPoint = data.priceHistory.dataPoints[data.priceHistory.dataPoints.length - 1];
      expect(lastPoint?.price).toBeCloseTo(0.65, 2);
    });

    it("should generate synthetic volume history when no trades exist", async () => {
      const mockMarket = createMockMarket({ volume: 100000 });
      const mockOutcomes = [createMockOutcome()];

      const { GET } = await setupMocksAndGetHandler({
        market: mockMarket,
        outcomes: mockOutcomes,
        trades: [], // No trades
        tradeCount: 0,
      });

      const request = createMockRequest("market-1", { volumeDays: "7" });
      const response = await GET(asNextRequest(request), { params: Promise.resolve({ id: "market-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.volumeHistory.dataPoints.length).toBeGreaterThan(0);
      // Total volume should be close to market volume
      const totalVolume = data.volumeHistory.dataPoints.reduce(
        (sum: number, p: { volume: number }) => sum + p.volume,
        0
      );
      expect(totalVolume).toBeCloseTo(100000, -3); // Allow some variance
    });
  });
});
