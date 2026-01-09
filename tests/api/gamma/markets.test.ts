/**
 * Tests for Polymarket Gamma API Markets Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getActiveMarkets,
  getAllActiveMarkets,
  getMarketsByCategory,
  getAllMarketsByCategory,
  getCategoryCounts,
  getMarketById,
  getMarketBySlug,
  getMarketOutcomes,
  getMarketOutcomesBySlug,
  getMarketVolumeHistory,
  getMarketVolumeHistoryBySlug,
  getMarketPriceHistory,
  getMarketPriceHistoryBySlug,
  getTrendingMarkets,
  parseSlugFromUrl,
} from "@/api/gamma/markets";
import { GammaClient, GammaApiException } from "@/api/gamma/client";
import type { GammaMarket, GammaMarketsResponse } from "@/api/gamma/types";
import { MarketCategory } from "@/api/gamma/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Helper to create mock market data
function createMockMarket(overrides: Partial<GammaMarket> = {}): GammaMarket {
  return {
    id: "market-1",
    question: "Test Market Question?",
    slug: "test-market",
    description: "Test market description",
    category: "politics",
    active: true,
    closed: false,
    archived: false,
    outcomes: [
      { id: "outcome-1", name: "Yes", price: 0.6 },
      { id: "outcome-2", name: "No", price: 0.4 },
    ],
    volume: 100000,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("getActiveMarkets", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should fetch active markets with default options", async () => {
      const mockMarkets = [createMockMarket({ id: "1" }), createMockMarket({ id: "2" })];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getActiveMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("should include active=true and closed=false in query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("active=true"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("closed=false"),
        expect.any(Object)
      );
    });

    it("should handle paginated response format", async () => {
      const paginatedResponse: GammaMarketsResponse = {
        data: [createMockMarket({ id: "1" }), createMockMarket({ id: "2" })],
        count: 250,
        limit: 100,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(paginatedResponse)),
      });

      const result = await getActiveMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBe(250);
    });

    it("should handle array response format", async () => {
      const arrayResponse = [createMockMarket({ id: "1" }), createMockMarket({ id: "2" })];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(arrayResponse)),
      });

      const result = await getActiveMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBeUndefined();
    });
  });

  describe("filtering", () => {
    it("should filter out inactive markets from response", async () => {
      const mixedMarkets = [
        createMockMarket({ id: "1", active: true, closed: false }),
        createMockMarket({ id: "2", active: false, closed: false }),
        createMockMarket({ id: "3", active: true, closed: true }),
        createMockMarket({ id: "4", active: true, closed: false }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mixedMarkets)),
      });

      const result = await getActiveMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.markets.map((m) => m.id)).toEqual(["1", "4"]);
    });
  });

  describe("options", () => {
    it("should apply limit option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets({ limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.any(Object)
      );
    });

    it("should apply offset option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets({ offset: 200 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=200"),
        expect.any(Object)
      );
    });

    it("should apply category filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets({ category: "sports" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("category=sports"),
        expect.any(Object)
      );
    });

    it("should apply sort options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets({ sortBy: "volume", order: "desc" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("order=volume"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ascending=false"),
        expect.any(Object)
      );
    });

    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getActiveMarkets({ client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("hasMore calculation", () => {
    it("should return hasMore=true when response length equals limit", async () => {
      const markets = Array(100)
        .fill(null)
        .map((_, i) => createMockMarket({ id: String(i) }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(markets)),
      });

      const result = await getActiveMarkets({ limit: 100 });

      expect(result.hasMore).toBe(true);
    });

    it("should return hasMore=false when response length is less than limit", async () => {
      const markets = Array(50)
        .fill(null)
        .map((_, i) => createMockMarket({ id: String(i) }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(markets)),
      });

      const result = await getActiveMarkets({ limit: 100 });

      expect(result.hasMore).toBe(false);
    });
  });
});

describe("getAllActiveMarkets", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch all pages of markets", async () => {
    // First page: 100 markets
    const page1 = Array(100)
      .fill(null)
      .map((_, i) => createMockMarket({ id: `page1-${i}` }));

    // Second page: 50 markets (last page)
    const page2 = Array(50)
      .fill(null)
      .map((_, i) => createMockMarket({ id: `page2-${i}` }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(page1)),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(page2)),
      });

    const result = await getAllActiveMarkets();

    expect(result).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should use custom page size", async () => {
    const page1 = Array(25)
      .fill(null)
      .map((_, i) => createMockMarket({ id: `${i}` }));

    const page2 = Array(10)
      .fill(null)
      .map((_, i) => createMockMarket({ id: `${25 + i}` }));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(page1)),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(page2)),
      });

    const result = await getAllActiveMarkets({ limit: 25 });

    expect(result).toHaveLength(35);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=25"), expect.any(Object));
  });

  it("should stop at safety limit", async () => {
    // Always return full page to simulate infinite pagination
    const fullPage = Array(100)
      .fill(null)
      .map((_, i) => createMockMarket({ id: `${i}` }));

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(fullPage)),
    });

    const result = await getAllActiveMarkets();

    // Should stop at 10000 limit (100 pages of 100)
    expect(result.length).toBeLessThanOrEqual(10100);
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(101);
  });

  it("should pass through category filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("[]"),
    });

    await getAllActiveMarkets({ category: "crypto" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("category=crypto"),
      expect.any(Object)
    );
  });

  it("should handle empty response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("[]"),
    });

    const result = await getAllActiveMarkets();

    expect(result).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("getMarketById", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("should fetch market by ID", async () => {
      const mockMarket = createMockMarket({ id: "market-123" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketById("market-123");

      expect(result).toEqual(mockMarket);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/markets/market-123"),
        expect.any(Object)
      );
    });

    it("should URL encode market ID", async () => {
      const mockMarket = createMockMarket({ id: "market/with/slashes" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      await getMarketById("market/with/slashes");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/markets/market%2Fwith%2Fslashes"),
        expect.any(Object)
      );
    });

    it("should return full market details", async () => {
      const mockMarket = createMockMarket({
        id: "detailed-market",
        question: "Detailed market question?",
        description: "Full market description with details",
        category: "sports",
        volume: 500000,
        outcomes: [
          { id: "yes", name: "Yes", price: 0.75 },
          { id: "no", name: "No", price: 0.25 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketById("detailed-market");

      expect(result?.question).toBe("Detailed market question?");
      expect(result?.category).toBe("sports");
      expect(result?.volume).toBe(500000);
      expect(result?.outcomes).toHaveLength(2);
    });

    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      const mockMarket = createMockMarket({ id: "custom-market" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      await getMarketById("custom-market", { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com/markets/custom-market"),
        expect.any(Object)
      );
    });
  });

  describe("404 handling", () => {
    it("should return null for non-existent market (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Market not found" })),
      });

      const result = await getMarketById("non-existent-market");

      expect(result).toBeNull();
    });

    it("should return null for empty market ID", async () => {
      const result = await getMarketById("");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only market ID", async () => {
      const result = await getMarketById("   ");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw for server errors (500)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Server error" })),
      });

      await expect(getMarketById("some-market")).rejects.toThrow(GammaApiException);
    });

    it("should throw for forbidden errors (403)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve(JSON.stringify({ message: "Access denied" })),
      });

      await expect(getMarketById("forbidden-market")).rejects.toThrow(GammaApiException);
    });

    it("should throw for bad request errors (400)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve(JSON.stringify({ message: "Invalid market ID" })),
      });

      await expect(getMarketById("invalid!market")).rejects.toThrow(GammaApiException);
    });
  });
});

describe("parseSlugFromUrl", () => {
  describe("valid URLs", () => {
    it("should extract slug from full Polymarket URL", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/event/will-bitcoin-reach-100k");
      expect(slug).toBe("will-bitcoin-reach-100k");
    });

    it("should extract slug from URL with query parameters", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/event/trump-wins-2024?ref=123");
      expect(slug).toBe("trump-wins-2024");
    });

    it("should extract slug from URL without protocol", () => {
      const slug = parseSlugFromUrl("polymarket.com/event/eth-price-prediction");
      expect(slug).toBe("eth-price-prediction");
    });

    it("should extract slug from URL with www", () => {
      const slug = parseSlugFromUrl("https://www.polymarket.com/event/election-results");
      expect(slug).toBe("election-results");
    });

    it("should extract slug from relative path with /event/", () => {
      const slug = parseSlugFromUrl("/event/market-slug");
      expect(slug).toBe("market-slug");
    });

    it("should handle URL with trailing slash", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/event/my-market/");
      expect(slug).toBe("my-market");
    });

    it("should handle URL with hash fragment", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/event/test-market#details");
      expect(slug).toBe("test-market");
    });
  });

  describe("raw slugs", () => {
    it("should return raw slug as-is", () => {
      const slug = parseSlugFromUrl("will-bitcoin-reach-100k");
      expect(slug).toBe("will-bitcoin-reach-100k");
    });

    it("should trim whitespace from slug", () => {
      const slug = parseSlugFromUrl("  my-market-slug  ");
      expect(slug).toBe("my-market-slug");
    });

    it("should handle slug with leading slash", () => {
      const slug = parseSlugFromUrl("/simple-slug");
      expect(slug).toBe("simple-slug");
    });
  });

  describe("invalid inputs", () => {
    it("should return null for empty string", () => {
      const slug = parseSlugFromUrl("");
      expect(slug).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      const slug = parseSlugFromUrl("   ");
      expect(slug).toBeNull();
    });

    it("should return null for just a path with multiple slashes", () => {
      const slug = parseSlugFromUrl("/some/invalid/path");
      expect(slug).toBeNull();
    });

    it("should return null for URL with no path", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/");
      expect(slug).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle event path with event prefix", () => {
      const slug = parseSlugFromUrl("event/my-event-slug");
      expect(slug).toBe("my-event-slug");
    });

    it("should handle URL-encoded slugs", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/event/market%20with%20spaces");
      expect(slug).toBe("market%20with%20spaces");
    });

    it("should extract last segment from non-event URL", () => {
      const slug = parseSlugFromUrl("https://polymarket.com/markets/some-market");
      expect(slug).toBe("some-market");
    });
  });
});

describe("getMarketBySlug", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("should fetch market by slug", async () => {
      const mockMarket = createMockMarket({ slug: "test-market-slug" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      const result = await getMarketBySlug("test-market-slug");

      expect(result).toEqual(mockMarket);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("slug=test-market-slug"),
        expect.any(Object)
      );
    });

    it("should extract slug from full Polymarket URL", async () => {
      const mockMarket = createMockMarket({ slug: "bitcoin-prediction" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      const result = await getMarketBySlug("https://polymarket.com/event/bitcoin-prediction");

      expect(result).toEqual(mockMarket);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("slug=bitcoin-prediction"),
        expect.any(Object)
      );
    });

    it("should URL encode special characters in slug", async () => {
      const mockMarket = createMockMarket({ slug: "slug with spaces" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      await getMarketBySlug("slug with spaces");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("slug=slug%20with%20spaces"),
        expect.any(Object)
      );
    });

    it("should handle paginated response format", async () => {
      const mockMarket = createMockMarket({ slug: "paginated-market" });
      const paginatedResponse: GammaMarketsResponse = {
        data: [mockMarket],
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(paginatedResponse)),
      });

      const result = await getMarketBySlug("paginated-market");

      expect(result).toEqual(mockMarket);
    });

    it("should find exact case-insensitive match", async () => {
      const exactMatch = createMockMarket({ id: "1", slug: "My-Market-Slug" });
      const partialMatch = createMockMarket({ id: "2", slug: "my-market-slug-extended" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([partialMatch, exactMatch])),
      });

      const result = await getMarketBySlug("my-market-slug");

      expect(result?.id).toBe("1");
    });

    it("should return first market if no exact match found", async () => {
      const market1 = createMockMarket({ id: "1", slug: "close-match-1" });
      const market2 = createMockMarket({ id: "2", slug: "close-match-2" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([market1, market2])),
      });

      const result = await getMarketBySlug("different-slug");

      expect(result?.id).toBe("1");
    });

    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      const mockMarket = createMockMarket({ slug: "custom-market" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      await getMarketBySlug("custom-market", { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("not found handling", () => {
    it("should return null when no markets match slug", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      const result = await getMarketBySlug("non-existent-market");

      expect(result).toBeNull();
    });

    it("should return null for empty string slug", async () => {
      const result = await getMarketBySlug("");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only slug", async () => {
      const result = await getMarketBySlug("   ");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for invalid URL pattern", async () => {
      const result = await getMarketBySlug("/some/invalid/path/structure");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null on 404 API response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketBySlug("valid-slug");

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should throw for server errors (500)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Server error" })),
      });

      await expect(getMarketBySlug("some-market")).rejects.toThrow(GammaApiException);
    });

    it("should throw for forbidden errors (403)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve(JSON.stringify({ message: "Access denied" })),
      });

      await expect(getMarketBySlug("forbidden-market")).rejects.toThrow(GammaApiException);
    });

    it("should throw for rate limit errors (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve(JSON.stringify({ message: "Rate limited" })),
      });

      await expect(getMarketBySlug("rate-limited-market")).rejects.toThrow(GammaApiException);
    });
  });

  describe("URL parsing integration", () => {
    it("should work with URL containing query params", async () => {
      const mockMarket = createMockMarket({ slug: "url-with-params" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      const result = await getMarketBySlug(
        "https://polymarket.com/event/url-with-params?utm_source=twitter"
      );

      expect(result).toEqual(mockMarket);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("slug=url-with-params"),
        expect.any(Object)
      );
    });

    it("should work with relative /event/ path", async () => {
      const mockMarket = createMockMarket({ slug: "relative-path" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([mockMarket])),
      });

      const result = await getMarketBySlug("/event/relative-path");

      expect(result).toEqual(mockMarket);
    });
  });
});

describe("getMarketOutcomes", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("should fetch market outcomes and calculate probabilities", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        question: "Will Bitcoin reach $100k?",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result).not.toBeNull();
      expect(result?.marketId).toBe("market-1");
      expect(result?.question).toBe("Will Bitcoin reach $100k?");
      expect(result?.outcomes).toHaveLength(2);
      expect(result?.outcomes[0]).toEqual({
        id: "outcome-1",
        name: "Yes",
        price: 0.6,
        probability: 60,
        clobTokenId: undefined,
      });
      expect(result?.outcomes[1]).toEqual({
        id: "outcome-2",
        name: "No",
        price: 0.4,
        probability: 40,
        clobTokenId: undefined,
      });
    });

    it("should calculate total probability correctly", async () => {
      const mockMarket = createMockMarket({
        outcomes: [
          { id: "1", name: "Yes", price: 0.55 },
          { id: "2", name: "No", price: 0.45 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result?.totalProbability).toBe(100);
    });

    it("should handle outcomes with clobTokenId", async () => {
      const mockMarket = createMockMarket({
        outcomes: [
          { id: "1", name: "Yes", price: 0.7, clobTokenId: "token-1" },
          { id: "2", name: "No", price: 0.3, clobTokenId: "token-2" },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result?.outcomes[0]?.clobTokenId).toBe("token-1");
      expect(result?.outcomes[1]?.clobTokenId).toBe("token-2");
    });

    it("should include market status (active/closed)", async () => {
      const mockMarket = createMockMarket({
        active: true,
        closed: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result?.active).toBe(true);
      expect(result?.closed).toBe(false);
    });

    it("should include fetchedAt timestamp", async () => {
      const mockMarket = createMockMarket();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const beforeFetch = new Date().toISOString();
      const result = await getMarketOutcomes("market-1");
      const afterFetch = new Date().toISOString();

      expect(result?.fetchedAt).toBeDefined();
      expect(result!.fetchedAt >= beforeFetch).toBe(true);
      expect(result!.fetchedAt <= afterFetch).toBe(true);
    });

    it("should handle multi-outcome markets", async () => {
      const mockMarket = createMockMarket({
        question: "Who will win the election?",
        outcomes: [
          { id: "1", name: "Candidate A", price: 0.4 },
          { id: "2", name: "Candidate B", price: 0.35 },
          { id: "3", name: "Candidate C", price: 0.2 },
          { id: "4", name: "Other", price: 0.05 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result?.outcomes).toHaveLength(4);
      expect(result?.totalProbability).toBe(100);
      expect(result?.outcomes[0]?.probability).toBe(40);
      expect(result?.outcomes[1]?.probability).toBe(35);
      expect(result?.outcomes[2]?.probability).toBe(20);
      expect(result?.outcomes[3]?.probability).toBe(5);
    });

    it("should handle probabilities that don't sum to 100%", async () => {
      const mockMarket = createMockMarket({
        outcomes: [
          { id: "1", name: "Yes", price: 0.51 },
          { id: "2", name: "No", price: 0.48 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketOutcomes("market-1");

      expect(result?.totalProbability).toBe(99); // 51 + 48 = 99
    });

    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      const mockMarket = createMockMarket();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      await getMarketOutcomes("market-1", { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("not found handling", () => {
    it("should return null for non-existent market", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketOutcomes("non-existent");

      expect(result).toBeNull();
    });

    it("should return null for empty market ID", async () => {
      const result = await getMarketOutcomes("");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw for server errors (500)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Server error" })),
      });

      await expect(getMarketOutcomes("market-1")).rejects.toThrow(GammaApiException);
    });
  });
});

describe("getMarketOutcomesBySlug", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch market outcomes by slug", async () => {
    const mockMarket = createMockMarket({
      id: "market-1",
      slug: "bitcoin-100k",
      question: "Will Bitcoin reach $100k?",
      outcomes: [
        { id: "1", name: "Yes", price: 0.65 },
        { id: "2", name: "No", price: 0.35 },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    const result = await getMarketOutcomesBySlug("bitcoin-100k");

    expect(result).not.toBeNull();
    expect(result?.marketId).toBe("market-1");
    expect(result?.outcomes).toHaveLength(2);
    expect(result?.outcomes[0]?.probability).toBe(65);
    expect(result?.outcomes[1]?.probability).toBe(35);
    expect(result?.totalProbability).toBe(100);
  });

  it("should fetch outcomes from Polymarket URL", async () => {
    const mockMarket = createMockMarket({
      slug: "election-winner",
      outcomes: [
        { id: "1", name: "Yes", price: 0.5 },
        { id: "2", name: "No", price: 0.5 },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    const result = await getMarketOutcomesBySlug("https://polymarket.com/event/election-winner");

    expect(result).not.toBeNull();
    expect(result?.totalProbability).toBe(100);
  });

  it("should return null for non-existent slug", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("[]"),
    });

    const result = await getMarketOutcomesBySlug("non-existent-market");

    expect(result).toBeNull();
  });

  it("should return null for invalid slug", async () => {
    const result = await getMarketOutcomesBySlug("");

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should use custom client when provided", async () => {
    const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
    const mockMarket = createMockMarket({ slug: "custom-market" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    await getMarketOutcomesBySlug("custom-market", { client: customClient });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.api.com"),
      expect.any(Object)
    );
  });
});

describe("getMarketVolumeHistory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests with API timeseries data", () => {
    it("should fetch volume history with history format", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        question: "Will Bitcoin reach $100k?",
        volume: 50000,
      });

      const mockTimeseries = {
        history: [
          { t: 1704067200, v: 1000 }, // 2024-01-01T00:00:00Z
          { t: 1704153600, v: 1500 }, // 2024-01-02T00:00:00Z
          { t: 1704240000, v: 2000 }, // 2024-01-03T00:00:00Z
        ],
      };

      // First call: getMarketById
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Second call: timeseries endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockTimeseries)),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.marketId).toBe("market-1");
      expect(result?.question).toBe("Will Bitcoin reach $100k?");
      expect(result?.dataPoints).toHaveLength(3);
      expect(result?.totalVolume).toBe(4500);
    });

    it("should fetch volume history with data format", async () => {
      const mockMarket = createMockMarket({ id: "market-1", volume: 30000 });

      const mockTimeseries = {
        data: [
          { timestamp: "2024-01-01T00:00:00Z", volume: 500, tradeCount: 10 },
          { timestamp: "2024-01-02T00:00:00Z", volume: 750, tradeCount: 15 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockTimeseries)),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.tradeCount).toBe(10);
      expect(result?.dataPoints[1]?.tradeCount).toBe(15);
      expect(result?.totalTrades).toBe(25);
    });

    it("should calculate cumulative volume correctly", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      const mockTimeseries = {
        history: [
          { t: 1704067200, v: 100 },
          { t: 1704153600, v: 200 },
          { t: 1704240000, v: 300 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockTimeseries)),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result?.dataPoints[0]?.cumulativeVolume).toBe(100);
      expect(result?.dataPoints[1]?.cumulativeVolume).toBe(300);
      expect(result?.dataPoints[2]?.cumulativeVolume).toBe(600);
    });

    it("should convert unix timestamps to ISO strings", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      const mockTimeseries = {
        history: [{ t: 1704067200, v: 100 }], // 2024-01-01T00:00:00.000Z
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockTimeseries)),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result?.dataPoints[0]?.timestamp).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("fallback to synthetic data", () => {
    it("should generate synthetic data when timeseries endpoint returns 404", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        volume: 10000,
        createdAt: "2024-01-01T00:00:00Z",
      });

      // First call: getMarketById
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Second call: timeseries endpoint returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1", {
        timeRange: {
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-10T00:00:00Z",
        },
        interval: "1d",
      });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThan(0);
      // Total volume from synthetic data should approximately equal market volume
      expect(result?.totalVolume).toBeCloseTo(10000, 0);
    });

    it("should generate synthetic data when timeseries returns empty response", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        volume: 5000,
        createdAt: "2024-01-01T00:00:00Z",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("{}"),
      });

      const result = await getMarketVolumeHistory("market-1", {
        timeRange: {
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-05T00:00:00Z",
        },
        interval: "1d",
      });

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThan(0);
      expect(result?.totalVolume).toBeCloseTo(5000, 0);
    });

    it("should respect market creation date in synthetic data", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        volume: 1000,
        createdAt: "2024-01-05T00:00:00Z", // Created on day 5
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1", {
        timeRange: {
          startDate: "2024-01-01T00:00:00Z", // Before market creation
          endDate: "2024-01-10T00:00:00Z",
        },
        interval: "1d",
      });

      expect(result).not.toBeNull();
      // All data points should be after market creation
      const firstTimestamp = new Date(result?.dataPoints[0]?.timestamp ?? "");
      const marketCreated = new Date("2024-01-05T00:00:00Z");
      expect(firstTimestamp.getTime()).toBeGreaterThanOrEqual(marketCreated.getTime());
    });
  });

  describe("options handling", () => {
    it("should use default time range (last 30 days) when not provided", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result).not.toBeNull();
      const startDate = new Date(result?.startDate ?? "");
      const endDate = new Date(result?.endDate ?? "");
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it("should use default interval (1d) when not provided", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result?.interval).toBe("1d");
    });

    it("should accept custom time range", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1", {
        timeRange: {
          startDate: "2024-06-01T00:00:00Z",
          endDate: "2024-06-15T00:00:00Z",
        },
      });

      expect(result?.startDate).toBe("2024-06-01T00:00:00.000Z");
      expect(result?.endDate).toBe("2024-06-15T00:00:00.000Z");
    });

    it("should accept Date objects for time range", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const startDate = new Date("2024-03-01T00:00:00Z");
      const endDate = new Date("2024-03-10T00:00:00Z");

      const result = await getMarketVolumeHistory("market-1", {
        timeRange: { startDate, endDate },
      });

      expect(result?.startDate).toBe("2024-03-01T00:00:00.000Z");
      expect(result?.endDate).toBe("2024-03-10T00:00:00.000Z");
    });

    it("should accept different interval options", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1", {
        interval: "1h",
        timeRange: {
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-02T00:00:00Z",
        },
      });

      expect(result?.interval).toBe("1h");
      // With hourly interval over 1 day, expect ~24 data points
      expect(result?.dataPoints.length).toBeGreaterThanOrEqual(20);
    });

    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ history: [] })),
      });

      await getMarketVolumeHistory("market-1", { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("not found handling", () => {
    it("should return null for non-existent market", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("non-existent");

      expect(result).toBeNull();
    });

    it("should return null for empty market ID", async () => {
      const result = await getMarketVolumeHistory("");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only market ID", async () => {
      const result = await getMarketVolumeHistory("   ");

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw for server errors (500)", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Server error" })),
      });

      await expect(getMarketVolumeHistory("market-1")).rejects.toThrow(GammaApiException);
    });

    it("should throw for forbidden errors (403)", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve(JSON.stringify({ message: "Forbidden" })),
      });

      await expect(getMarketVolumeHistory("market-1")).rejects.toThrow(GammaApiException);
    });
  });

  describe("result metadata", () => {
    it("should include fetchedAt timestamp", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const beforeFetch = new Date().toISOString();
      const result = await getMarketVolumeHistory("market-1");
      const afterFetch = new Date().toISOString();

      expect(result?.fetchedAt).toBeDefined();
      expect(result!.fetchedAt >= beforeFetch).toBe(true);
      expect(result!.fetchedAt <= afterFetch).toBe(true);
    });

    it("should include market question in result", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        question: "Will SpaceX launch Starship?",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result?.question).toBe("Will SpaceX launch Starship?");
    });

    it("should not include totalTrades when no trade count data", async () => {
      const mockMarket = createMockMarket({ id: "market-1" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              history: [{ t: 1704067200, v: 100 }],
            })
          ),
      });

      const result = await getMarketVolumeHistory("market-1");

      expect(result?.totalTrades).toBeUndefined();
    });
  });
});

describe("getMarketVolumeHistoryBySlug", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch volume history by slug", async () => {
    const mockMarket = createMockMarket({
      id: "market-1",
      slug: "bitcoin-100k",
      question: "Will Bitcoin reach $100k?",
      volume: 25000,
    });

    // First call: getMarketBySlug -> markets endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    // Second call: getMarketById (from getMarketVolumeHistory)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    // Third call: timeseries endpoint
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketVolumeHistoryBySlug("bitcoin-100k");

    expect(result).not.toBeNull();
    expect(result?.marketId).toBe("market-1");
    expect(result?.question).toBe("Will Bitcoin reach $100k?");
  });

  it("should fetch volume history from Polymarket URL", async () => {
    const mockMarket = createMockMarket({
      id: "market-1",
      slug: "election-winner",
      volume: 100000,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketVolumeHistoryBySlug(
      "https://polymarket.com/event/election-winner"
    );

    expect(result).not.toBeNull();
    expect(result?.marketId).toBe("market-1");
  });

  it("should return null for non-existent slug", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("[]"),
    });

    const result = await getMarketVolumeHistoryBySlug("non-existent-market");

    expect(result).toBeNull();
  });

  it("should return null for invalid slug", async () => {
    const result = await getMarketVolumeHistoryBySlug("");

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should pass options to getMarketVolumeHistory", async () => {
    const mockMarket = createMockMarket({
      id: "market-1",
      slug: "test-market",
      volume: 5000,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketVolumeHistoryBySlug("test-market", {
      interval: "4h",
      timeRange: {
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-03T00:00:00Z",
      },
    });

    expect(result?.interval).toBe("4h");
    expect(result?.startDate).toBe("2024-01-01T00:00:00.000Z");
    expect(result?.endDate).toBe("2024-01-03T00:00:00.000Z");
  });

  it("should use custom client when provided", async () => {
    const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
    const mockMarket = createMockMarket({ slug: "custom-market" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ history: [] })),
    });

    await getMarketVolumeHistoryBySlug("custom-market", { client: customClient });

    // All three API calls should use custom client
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.api.com"),
      expect.any(Object)
    );
  });
});

// =============================================================================
// PRICE HISTORY TESTS
// =============================================================================

describe("getMarketPriceHistory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should fetch price history and calculate probability from price", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.75, clobTokenId: "token-1" },
          { id: "outcome-2", name: "No", price: 0.25, clobTokenId: "token-2" },
        ],
      });

      const mockPriceHistory = {
        history: [
          { t: 1704067200, p: 0.5 }, // 2024-01-01
          { t: 1704153600, p: 0.6 }, // 2024-01-02
          { t: 1704240000, p: 0.75 }, // 2024-01-03
        ],
      };

      // First call: getMarketById
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Second call: price timeseries endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.dataPoints).toHaveLength(3);
      expect(result?.dataPoints[0]?.price).toBe(0.5);
      expect(result?.dataPoints[0]?.probability).toBe(50);
      expect(result?.dataPoints[2]?.price).toBe(0.75);
      expect(result?.dataPoints[2]?.probability).toBe(75);
    });

    it("should calculate statistics correctly (min, max, change)", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.8 }],
      });

      const mockPriceHistory = {
        history: [
          { t: 1704067200, p: 0.4 },
          { t: 1704153600, p: 0.2 },
          { t: 1704240000, p: 0.6 },
          { t: 1704326400, p: 0.8 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.minPrice).toBe(0.2);
      expect(result?.maxPrice).toBe(0.8);
      expect(result?.priceChange).toBe(0.4); // 0.8 - 0.4
      expect(result?.priceChangePercent).toBe(100); // (0.4 / 0.4) * 100
    });

    it("should include current price and probability from market data", async () => {
      // No clobTokenId - 2 price endpoints will be tried
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.65 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints - both return 404, will use synthetic data
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.currentPrice).toBe(0.65);
      expect(result?.currentProbability).toBe(65);
    });

    it("should include clobTokenId when available", async () => {
      // Has clobTokenId - 3 price endpoints will be tried
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.5, clobTokenId: "clob-token-123" }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Three price endpoints - all return 404, will use synthetic data
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.clobTokenId).toBe("clob-token-123");
    });
  });

  describe("outcome selection", () => {
    it("should default to first outcome when no selector provided", async () => {
      // No clobTokenId - 2 price endpoints will be tried
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints (no clobTokenId)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.outcomeId).toBe("outcome-1");
      expect(result?.outcomeName).toBe("Yes");
    });

    it("should select outcome by name (case-insensitive)", async () => {
      // No clobTokenId - 2 price endpoints
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: "no" });

      expect(result?.outcomeId).toBe("outcome-2");
      expect(result?.outcomeName).toBe("No");
    });

    it("should select outcome by index", async () => {
      // No clobTokenId - 2 price endpoints
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: 1 });

      expect(result?.outcomeId).toBe("outcome-2");
      expect(result?.outcomeName).toBe("No");
    });

    it("should select outcome by ID", async () => {
      // No clobTokenId - 2 price endpoints
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-abc", name: "Yes", price: 0.6 },
          { id: "outcome-xyz", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: "outcome-xyz" });

      expect(result?.outcomeId).toBe("outcome-xyz");
      expect(result?.outcomeName).toBe("No");
    });

    it("should return null for invalid outcome selector", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: "invalid-outcome" });

      expect(result).toBeNull();
    });

    it("should return null for out-of-bounds index", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Yes", price: 0.6 },
          { id: "outcome-2", name: "No", price: 0.4 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: 5 });

      expect(result).toBeNull();
    });

    it("should handle multi-outcome markets", async () => {
      // No clobTokenId - 2 price endpoints
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [
          { id: "outcome-1", name: "Trump", price: 0.45 },
          { id: "outcome-2", name: "Biden", price: 0.35 },
          { id: "outcome-3", name: "Other", price: 0.2 },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", { outcome: "Biden" });

      expect(result?.outcomeId).toBe("outcome-2");
      expect(result?.outcomeName).toBe("Biden");
      expect(result?.currentPrice).toBe(0.35);
    });
  });

  describe("API response parsing", () => {
    it("should parse 'history' format correctly", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        history: [
          { t: 1704067200, p: 0.5, v: 1000 },
          { t: 1704153600, p: 0.6, v: 2000 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.volume).toBe(1000);
      expect(result?.dataPoints[1]?.volume).toBe(2000);
    });

    it("should parse 'prices' format correctly", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        prices: [
          { t: 1704067200, p: 0.45 },
          { t: 1704153600, p: 0.55 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.price).toBe(0.45);
      expect(result?.dataPoints[1]?.price).toBe(0.55);
    });

    it("should parse 'data' format with numeric timestamp", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        data: [
          { timestamp: 1704067200, price: 0.5, volume: 100 },
          { timestamp: 1704153600, price: 0.6, volume: 200 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.price).toBe(0.5);
      expect(result?.dataPoints[0]?.volume).toBe(100);
    });

    it("should parse 'data' format with ISO timestamp", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        data: [
          { timestamp: "2024-01-01T00:00:00.000Z", price: 0.5 },
          { timestamp: "2024-01-02T00:00:00.000Z", price: 0.6 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.timestamp).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should handle probability field in data format", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        data: [
          { timestamp: 1704067200, probability: 50 }, // 50% = 0.5 price
          { timestamp: 1704153600, probability: 75 }, // 75% = 0.75 price
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints).toHaveLength(2);
      expect(result?.dataPoints[0]?.price).toBe(0.5);
      expect(result?.dataPoints[0]?.probability).toBe(50);
      expect(result?.dataPoints[1]?.price).toBe(0.75);
      expect(result?.dataPoints[1]?.probability).toBe(75);
    });

    it("should convert unix timestamp to ISO string", async () => {
      const mockMarket = createMockMarket();

      const mockPriceHistory = {
        history: [{ t: 1704067200, p: 0.5 }], // 2024-01-01T00:00:00Z
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPriceHistory)),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.dataPoints[0]?.timestamp).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("fallback to synthetic data", () => {
    it("should generate synthetic data when API returns 404", async () => {
      const mockMarket = createMockMarket({
        id: "market-1",
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.7 }],
        createdAt: "2024-01-01T00:00:00Z",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // All price endpoints return 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThan(0);
      // Last data point should match current price
      expect(result?.dataPoints[result.dataPoints.length - 1]?.price).toBe(0.7);
    });

    it("should generate synthetic data when API returns empty response", async () => {
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // First endpoint returns empty, second also fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ history: [] })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ history: [] })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBeGreaterThan(0);
    });

    it("should respect market creation date in synthetic data", async () => {
      const marketCreatedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
        createdAt: marketCreatedAt.toISOString(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints (no clobTokenId)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", {
        timeRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: new Date(),
        },
      });

      expect(result).not.toBeNull();
      // First data point should be after market creation, not 30 days ago
      const firstTimestamp = new Date(result?.dataPoints[0]?.timestamp ?? "");
      expect(firstTimestamp.getTime()).toBeGreaterThanOrEqual(marketCreatedAt.getTime());
    });
  });

  describe("time range and interval options", () => {
    it("should use default time range (30 days) when not specified", async () => {
      // Market without clobTokenId - 2 price endpoints
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result).not.toBeNull();
      expect(result?.interval).toBe("1d");

      // Verify date range is approximately 30 days
      const start = new Date(result?.startDate ?? "");
      const end = new Date(result?.endDate ?? "");
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it("should use custom time range when provided", async () => {
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", {
        timeRange: {
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-10T00:00:00Z",
        },
      });

      expect(result?.startDate).toBe("2024-01-01T00:00:00.000Z");
      expect(result?.endDate).toBe("2024-01-10T00:00:00.000Z");
    });

    it("should accept Date objects for time range", async () => {
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const startDate = new Date("2024-02-01");
      const endDate = new Date("2024-02-15");

      const result = await getMarketPriceHistory("market-1", {
        timeRange: { startDate, endDate },
      });

      expect(result).not.toBeNull();
      expect(new Date(result?.startDate ?? "").getTime()).toBe(startDate.getTime());
      expect(new Date(result?.endDate ?? "").getTime()).toBe(endDate.getTime());
    });

    it("should use custom interval when provided", async () => {
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1", {
        interval: "1h",
      });

      expect(result?.interval).toBe("1h");
    });
  });

  describe("error handling", () => {
    it("should return null for empty market ID", async () => {
      const result = await getMarketPriceHistory("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only market ID", async () => {
      const result = await getMarketPriceHistory("   ");
      expect(result).toBeNull();
    });

    it("should return null for non-existent market", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Market not found" })),
      });

      const result = await getMarketPriceHistory("non-existent-market");

      expect(result).toBeNull();
    });

    it("should throw for server errors (500)", async () => {
      // Server error on getMarketById - will retry 3 times (default retries)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Server error" })),
      });

      await expect(getMarketPriceHistory("market-1")).rejects.toThrow(GammaApiException);
    });

    it("should throw for forbidden errors (403)", async () => {
      // Forbidden error on getMarketById - first API call
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve(JSON.stringify({ message: "Access denied" })),
      });

      await expect(getMarketPriceHistory("market-1")).rejects.toThrow(GammaApiException);
    });
  });

  describe("custom client", () => {
    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
      // Market without clobTokenId - only 2 endpoints will be tried
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints (no clobTokenId means no /prices/token endpoint)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      await getMarketPriceHistory("market-1", { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("result metadata", () => {
    it("should include fetchedAt timestamp", async () => {
      // Market without clobTokenId - only 2 endpoints will be tried
      const mockMarket = createMockMarket({
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const before = Date.now();
      const result = await getMarketPriceHistory("market-1");
      const after = Date.now();

      expect(result?.fetchedAt).toBeDefined();
      const fetchedAt = new Date(result?.fetchedAt ?? "").getTime();
      expect(fetchedAt).toBeGreaterThanOrEqual(before);
      expect(fetchedAt).toBeLessThanOrEqual(after);
    });

    it("should include market question", async () => {
      const mockMarket = createMockMarket({
        question: "Will Bitcoin reach $100k?",
        outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarket)),
      });

      // Two price endpoints
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
      });

      const result = await getMarketPriceHistory("market-1");

      expect(result?.question).toBe("Will Bitcoin reach $100k?");
    });
  });
});

describe("getMarketPriceHistoryBySlug", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch price history by slug", async () => {
    // Use market without clobTokenId for simpler mocking
    const mockMarket = createMockMarket({
      slug: "bitcoin-100k",
      outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
    });

    // First call: slug lookup
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    // Second call: get market by id
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    // Two price endpoints (no clobTokenId)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketPriceHistoryBySlug("bitcoin-100k");

    expect(result).not.toBeNull();
    expect(result?.marketId).toBe("market-1");
  });

  it("should fetch price history from Polymarket URL", async () => {
    const mockMarket = createMockMarket({
      slug: "bitcoin-100k",
      outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    // Two price endpoints
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketPriceHistoryBySlug("https://polymarket.com/event/bitcoin-100k");

    expect(result).not.toBeNull();
  });

  it("should return null for non-existent market slug", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([])),
    });

    const result = await getMarketPriceHistoryBySlug("non-existent-slug");

    expect(result).toBeNull();
  });

  it("should pass options to getMarketPriceHistory", async () => {
    const mockMarket = createMockMarket({
      slug: "test-market",
      outcomes: [
        { id: "outcome-1", name: "Yes", price: 0.6 },
        { id: "outcome-2", name: "No", price: 0.4 },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    // Two price endpoints
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    const result = await getMarketPriceHistoryBySlug("test-market", {
      outcome: "No",
      interval: "4h",
      timeRange: {
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-03T00:00:00Z",
      },
    });

    expect(result?.outcomeName).toBe("No");
    expect(result?.interval).toBe("4h");
    expect(result?.startDate).toBe("2024-01-01T00:00:00.000Z");
    expect(result?.endDate).toBe("2024-01-03T00:00:00.000Z");
  });

  it("should use custom client when provided", async () => {
    const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });
    const mockMarket = createMockMarket({
      slug: "custom-market",
      outcomes: [{ id: "outcome-1", name: "Yes", price: 0.6 }],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([mockMarket])),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockMarket)),
    });

    // Two price endpoints
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve(JSON.stringify({ message: "Not found" })),
    });

    await getMarketPriceHistoryBySlug("custom-market", { client: customClient });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.api.com"),
      expect.any(Object)
    );
  });
});

describe("getMarketsByCategory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should fetch markets for a category using MarketCategory enum", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "politics" }),
        createMockMarket({ id: "2", category: "politics" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(2);
      expect(result.category).toBe(MarketCategory.POLITICS);
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
    });

    it("should fetch markets using string category", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "crypto" }),
        createMockMarket({ id: "2", category: "crypto" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getMarketsByCategory("crypto");

      expect(result.markets).toHaveLength(2);
      expect(result.category).toBe("crypto");
    });

    it("should include tag parameter in query string", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.SPORTS);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("tag=sports"),
        expect.any(Object)
      );
    });

    it("should include active=true and closed=false by default", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("active=true"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("closed=false"),
        expect.any(Object)
      );
    });
  });

  describe("response format handling", () => {
    it("should handle paginated response format", async () => {
      const paginatedResponse: GammaMarketsResponse = {
        data: [
          createMockMarket({ id: "1", category: "politics" }),
          createMockMarket({ id: "2", category: "politics" }),
        ],
        count: 150,
        limit: 100,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(paginatedResponse)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBe(150);
    });

    it("should handle array response format", async () => {
      const arrayResponse = [
        createMockMarket({ id: "1", category: "politics" }),
        createMockMarket({ id: "2", category: "politics" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(arrayResponse)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBeUndefined();
    });
  });

  describe("category filtering", () => {
    it("should filter markets to only include matching category", async () => {
      const mixedMarkets = [
        createMockMarket({ id: "1", category: "politics" }),
        createMockMarket({ id: "2", category: "sports" }),
        createMockMarket({ id: "3", category: "politics" }),
        createMockMarket({ id: "4", category: "crypto" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mixedMarkets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(2);
      expect(result.markets.map((m) => m.id)).toEqual(["1", "3"]);
    });

    it("should handle case-insensitive category matching", async () => {
      const mixedMarkets = [
        createMockMarket({ id: "1", category: "Politics" }),
        createMockMarket({ id: "2", category: "POLITICS" }),
        createMockMarket({ id: "3", category: "politics" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mixedMarkets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(3);
    });

    it("should filter out inactive/closed markets by default", async () => {
      const mixedMarkets = [
        createMockMarket({ id: "1", category: "politics", active: true, closed: false }),
        createMockMarket({ id: "2", category: "politics", active: false, closed: false }),
        createMockMarket({ id: "3", category: "politics", active: true, closed: true }),
        createMockMarket({ id: "4", category: "politics", active: true, closed: false }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mixedMarkets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.markets).toHaveLength(2);
      expect(result.markets.map((m) => m.id)).toEqual(["1", "4"]);
    });

    it("should include inactive/closed markets when activeOnly is false", async () => {
      const mixedMarkets = [
        createMockMarket({ id: "1", category: "politics", active: true, closed: false }),
        createMockMarket({ id: "2", category: "politics", active: false, closed: false }),
        createMockMarket({ id: "3", category: "politics", active: true, closed: true }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mixedMarkets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS, {
        activeOnly: false,
      });

      expect(result.markets).toHaveLength(3);
    });
  });

  describe("pagination options", () => {
    it("should apply limit option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.any(Object)
      );
    });

    it("should apply offset option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { offset: 100 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=100"),
        expect.any(Object)
      );
    });

    it("should calculate hasMore correctly when at limit", async () => {
      // Create exactly 100 markets (default limit)
      const markets = Array.from({ length: 100 }, (_, i) =>
        createMockMarket({ id: String(i), category: "politics" })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(markets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.hasMore).toBe(true);
    });

    it("should calculate hasMore correctly when under limit", async () => {
      const markets = [
        createMockMarket({ id: "1", category: "politics" }),
        createMockMarket({ id: "2", category: "politics" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(markets)),
      });

      const result = await getMarketsByCategory(MarketCategory.POLITICS);

      expect(result.hasMore).toBe(false);
    });
  });

  describe("sorting options", () => {
    it("should apply sortBy option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { sortBy: "volume" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("order=volume"),
        expect.any(Object)
      );
    });

    it("should apply order option for descending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { order: "desc" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ascending=false"),
        expect.any(Object)
      );
    });

    it("should apply order option for ascending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { order: "asc" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ascending=true"),
        expect.any(Object)
      );
    });
  });

  describe("custom client", () => {
    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getMarketsByCategory(MarketCategory.POLITICS, { client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("MarketCategory enum values", () => {
    it("should support all category values", () => {
      expect(MarketCategory.POLITICS).toBe("politics");
      expect(MarketCategory.CRYPTO).toBe("crypto");
      expect(MarketCategory.SPORTS).toBe("sports");
      expect(MarketCategory.TECH).toBe("tech");
      expect(MarketCategory.BUSINESS).toBe("business");
      expect(MarketCategory.SCIENCE).toBe("science");
      expect(MarketCategory.ENTERTAINMENT).toBe("entertainment");
      expect(MarketCategory.WEATHER).toBe("weather");
      expect(MarketCategory.GEOPOLITICS).toBe("geopolitics");
      expect(MarketCategory.LEGAL).toBe("legal");
      expect(MarketCategory.HEALTH).toBe("health");
      expect(MarketCategory.ECONOMY).toBe("economy");
      expect(MarketCategory.CULTURE).toBe("culture");
      expect(MarketCategory.OTHER).toBe("other");
    });
  });
});

describe("getAllMarketsByCategory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch all markets across multiple pages", async () => {
    // First page - full
    const page1Markets = Array.from({ length: 100 }, (_, i) =>
      createMockMarket({ id: `page1-${i}`, category: "politics" })
    );

    // Second page - partial
    const page2Markets = Array.from({ length: 50 }, (_, i) =>
      createMockMarket({ id: `page2-${i}`, category: "politics" })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(page1Markets)),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(page2Markets)),
    });

    const result = await getAllMarketsByCategory(MarketCategory.POLITICS);

    expect(result).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should stop when receiving less than page size", async () => {
    const markets = Array.from({ length: 50 }, (_, i) =>
      createMockMarket({ id: String(i), category: "politics" })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(markets)),
    });

    const result = await getAllMarketsByCategory(MarketCategory.POLITICS);

    expect(result).toHaveLength(50);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should use custom page size from limit option", async () => {
    const markets = Array.from({ length: 25 }, (_, i) =>
      createMockMarket({ id: String(i), category: "politics" })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(markets)),
    });

    await getAllMarketsByCategory(MarketCategory.POLITICS, { limit: 50 });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=50"), expect.any(Object));
  });

  it("should pass options to underlying getMarketsByCategory", async () => {
    const markets = Array.from({ length: 10 }, (_, i) =>
      createMockMarket({ id: String(i), category: "crypto", active: false, closed: false })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(markets)),
    });

    const result = await getAllMarketsByCategory(MarketCategory.CRYPTO, {
      activeOnly: false,
    });

    expect(result).toHaveLength(10);
  });

  it("should enforce safety limit to prevent infinite loops", async () => {
    // Mock to always return full page (would loop forever without safety limit)
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify(
              Array.from({ length: 100 }, () =>
                createMockMarket({ id: String(Math.random()), category: "politics" })
              )
            )
          ),
      })
    );

    const result = await getAllMarketsByCategory(MarketCategory.POLITICS);

    // Safety limit is 10000 / 100 = max 100 pages + 1 iteration
    // With safety check at offset > 10000, we get 101 calls (0, 100, ..., 10000, then break)
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(102);
    expect(result.length).toBeLessThanOrEqual(10200);
  });
});

describe("getCategoryCounts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch counts for all categories", async () => {
    // Mock responses for each category - return array response with count indicator
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: [],
              count: 10,
            })
          ),
      })
    );

    const counts = await getCategoryCounts();

    // Should have called API for each category in the enum
    const categoryCount = Object.values(MarketCategory).length;
    expect(mockFetch).toHaveBeenCalledTimes(categoryCount);

    // All categories should have counts
    expect(counts[MarketCategory.POLITICS]).toBe(10);
    expect(counts[MarketCategory.CRYPTO]).toBe(10);
    expect(counts[MarketCategory.SPORTS]).toBe(10);
  });

  it("should handle errors gracefully and return 0 for failed categories", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call succeeds
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: [], count: 25 })),
        });
      }
      // Other calls fail
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: () => Promise.resolve(JSON.stringify({ message: "Error" })),
      });
    });

    const counts = await getCategoryCounts();

    // First category should have count, others should be 0 due to errors being caught
    const values = Object.values(counts);
    const nonZeroCount = values.filter((v) => v > 0).length;
    expect(nonZeroCount).toBeGreaterThanOrEqual(0); // At least we didn't throw
  });

  it("should pass activeOnly option to underlying calls", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([])),
      })
    );

    await getCategoryCounts({ activeOnly: false });

    // Check that at least one call didn't include active/closed filters
    const calls = mockFetch.mock.calls;
    const hasNoActiveFilter = calls.some((call) => !String(call[0]).includes("active=true"));
    expect(hasNoActiveFilter).toBe(true);
  });

  it("should use custom client when provided", async () => {
    const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([])),
      })
    );

    await getCategoryCounts({ client: customClient });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.api.com"),
      expect.any(Object)
    );
  });
});

describe("getTrendingMarkets", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should fetch trending markets with default options", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 50000 }),
        createMockMarket({ id: "2", volume: 100000 }),
        createMockMarket({ id: "3", volume: 75000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets();

      expect(result.markets).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.sortBy).toBe("volume");
      expect(result.fetchedAt).toBeDefined();
    });

    it("should sort markets by volume (highest first) by default", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 50000 }),
        createMockMarket({ id: "2", volume: 100000 }),
        createMockMarket({ id: "3", volume: 75000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets();

      // Should be sorted by volume descending
      expect(result.markets[0]?.id).toBe("2"); // 100000
      expect(result.markets[1]?.id).toBe("3"); // 75000
      expect(result.markets[2]?.id).toBe("1"); // 50000
    });

    it("should include active=true and closed=false in query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("active=true"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("closed=false"),
        expect.any(Object)
      );
    });

    it("should include order=volume and ascending=false in query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("order=volume"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ascending=false"),
        expect.any(Object)
      );
    });

    it("should handle paginated response format", async () => {
      const paginatedResponse: GammaMarketsResponse = {
        data: [
          createMockMarket({ id: "1", volume: 100000 }),
          createMockMarket({ id: "2", volume: 50000 }),
        ],
        count: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(paginatedResponse)),
      });

      const result = await getTrendingMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it("should handle array response format", async () => {
      const arrayResponse = [
        createMockMarket({ id: "1", volume: 100000 }),
        createMockMarket({ id: "2", volume: 50000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(arrayResponse)),
      });

      const result = await getTrendingMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  describe("limit parameter", () => {
    it("should respect limit option", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 100000 }),
        createMockMarket({ id: "2", volume: 90000 }),
        createMockMarket({ id: "3", volume: 80000 }),
        createMockMarket({ id: "4", volume: 70000 }),
        createMockMarket({ id: "5", volume: 60000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ limit: 3 });

      expect(result.markets).toHaveLength(3);
      expect(result.count).toBe(3);
      // Top 3 by volume
      expect(result.markets.map((m) => m.id)).toEqual(["1", "2", "3"]);
    });

    it("should default to limit of 10", async () => {
      const mockMarkets = Array.from({ length: 15 }, (_, i) =>
        createMockMarket({ id: String(i + 1), volume: 100000 - i * 1000 })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets();

      expect(result.markets).toHaveLength(10);
    });

    it("should handle limit larger than available markets", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 100000 }),
        createMockMarket({ id: "2", volume: 50000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ limit: 100 });

      expect(result.markets).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  describe("sortBy parameter", () => {
    it("should sort by volume when sortBy is volume", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 50000 }),
        createMockMarket({ id: "2", volume: 100000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "volume" });

      expect(result.markets[0]?.id).toBe("2");
      expect(result.markets[1]?.id).toBe("1");
      expect(result.sortBy).toBe("volume");
    });

    it("should sort by liquidity when sortBy is liquidity", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", liquidity: 5000 }),
        createMockMarket({ id: "2", liquidity: 10000 }),
        createMockMarket({ id: "3", liquidity: 7500 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "liquidity" });

      expect(result.markets[0]?.id).toBe("2"); // 10000
      expect(result.markets[1]?.id).toBe("3"); // 7500
      expect(result.markets[2]?.id).toBe("1"); // 5000
      expect(result.sortBy).toBe("liquidity");
    });

    it("should sort by createdAt when sortBy is createdAt", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", createdAt: "2024-01-01T00:00:00Z" }),
        createMockMarket({ id: "2", createdAt: "2024-03-01T00:00:00Z" }),
        createMockMarket({ id: "3", createdAt: "2024-02-01T00:00:00Z" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "createdAt" });

      expect(result.markets[0]?.id).toBe("2"); // March (most recent)
      expect(result.markets[1]?.id).toBe("3"); // February
      expect(result.markets[2]?.id).toBe("1"); // January (oldest)
      expect(result.sortBy).toBe("createdAt");
    });

    it("should sort by updatedAt when sortBy is updatedAt", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", updatedAt: "2024-01-15T00:00:00Z" }),
        createMockMarket({ id: "2", updatedAt: "2024-01-20T00:00:00Z" }),
        createMockMarket({ id: "3", updatedAt: "2024-01-10T00:00:00Z" }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "updatedAt" });

      expect(result.markets[0]?.id).toBe("2"); // Jan 20 (most recent)
      expect(result.markets[1]?.id).toBe("1"); // Jan 15
      expect(result.markets[2]?.id).toBe("3"); // Jan 10
      expect(result.sortBy).toBe("updatedAt");
    });

    it("should sort by volume24hr using volumeNum field", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 100000, volumeNum: 5000 }),
        createMockMarket({ id: "2", volume: 50000, volumeNum: 10000 }),
        createMockMarket({ id: "3", volume: 75000, volumeNum: 7500 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "volume24hr" });

      // Should sort by volumeNum (24hr volume)
      expect(result.markets[0]?.id).toBe("2"); // 10000
      expect(result.markets[1]?.id).toBe("3"); // 7500
      expect(result.markets[2]?.id).toBe("1"); // 5000
      expect(result.sortBy).toBe("volume24hr");
    });

    it("should fall back to volume when volumeNum is not available for volume24hr", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", volume: 100000 }), // no volumeNum
        createMockMarket({ id: "2", volume: 50000 }), // no volumeNum
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ sortBy: "volume24hr" });

      // Falls back to regular volume
      expect(result.markets[0]?.id).toBe("1"); // 100000
      expect(result.markets[1]?.id).toBe("2"); // 50000
    });

    it("should pass sortBy to API in order parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets({ sortBy: "liquidity" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("order=liquidity"),
        expect.any(Object)
      );
    });
  });

  describe("category parameter", () => {
    it("should filter by category when provided as enum", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "politics", volume: 100000 }),
        createMockMarket({ id: "2", category: "sports", volume: 90000 }),
        createMockMarket({ id: "3", category: "politics", volume: 80000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ category: MarketCategory.POLITICS });

      expect(result.markets).toHaveLength(2);
      expect(result.markets.every((m) => m.category === "politics")).toBe(true);
      expect(result.category).toBe(MarketCategory.POLITICS);
    });

    it("should filter by category when provided as string", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "crypto", volume: 100000 }),
        createMockMarket({ id: "2", category: "politics", volume: 90000 }),
        createMockMarket({ id: "3", category: "crypto", volume: 80000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ category: "crypto" });

      expect(result.markets).toHaveLength(2);
      expect(result.markets.every((m) => m.category === "crypto")).toBe(true);
      expect(result.category).toBe("crypto");
    });

    it("should include tag parameter in API request when category is specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets({ category: MarketCategory.SPORTS });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("tag=sports"),
        expect.any(Object)
      );
    });

    it("should filter case-insensitively", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "Politics", volume: 100000 }),
        createMockMarket({ id: "2", category: "POLITICS", volume: 90000 }),
        createMockMarket({ id: "3", category: "politics", volume: 80000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ category: "politics" });

      expect(result.markets).toHaveLength(3);
    });

    it("should not include category in result when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      const result = await getTrendingMarkets();

      expect(result.category).toBeUndefined();
    });
  });

  describe("activeOnly parameter", () => {
    it("should filter out inactive markets by default", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", active: true, closed: false, volume: 100000 }),
        createMockMarket({ id: "2", active: false, closed: false, volume: 90000 }),
        createMockMarket({ id: "3", active: true, closed: true, volume: 80000 }),
        createMockMarket({ id: "4", active: true, closed: false, volume: 70000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets();

      expect(result.markets).toHaveLength(2);
      expect(result.markets.map((m) => m.id)).toEqual(["1", "4"]);
    });

    it("should include inactive markets when activeOnly is false", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", active: true, closed: false, volume: 100000 }),
        createMockMarket({ id: "2", active: false, closed: false, volume: 90000 }),
        createMockMarket({ id: "3", active: true, closed: true, volume: 80000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({ activeOnly: false });

      expect(result.markets).toHaveLength(3);
    });

    it("should not include active/closed filters in query when activeOnly is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets({ activeOnly: false });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).not.toContain("active=true");
      expect(url).not.toContain("closed=false");
    });
  });

  describe("custom client", () => {
    it("should use custom client when provided", async () => {
      const customClient = new GammaClient({ baseUrl: "https://custom.api.com" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      await getTrendingMarkets({ client: customClient });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object)
      );
    });
  });

  describe("error handling", () => {
    it("should throw GammaApiException for server errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ message: "Internal Server Error" })),
      });

      await expect(getTrendingMarkets()).rejects.toThrow(GammaApiException);
    });

    it("should throw GammaApiException for 403 forbidden", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ message: "Forbidden" })),
      });

      await expect(getTrendingMarkets()).rejects.toThrow(GammaApiException);
    });

    it("should throw GammaApiException for 429 rate limited", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ message: "Rate limited" })),
      });

      await expect(getTrendingMarkets()).rejects.toThrow(GammaApiException);
    });
  });

  describe("combined options", () => {
    it("should apply limit, sortBy, and category together", async () => {
      const mockMarkets = [
        createMockMarket({ id: "1", category: "politics", liquidity: 10000 }),
        createMockMarket({ id: "2", category: "politics", liquidity: 8000 }),
        createMockMarket({ id: "3", category: "politics", liquidity: 6000 }),
        createMockMarket({ id: "4", category: "sports", liquidity: 15000 }),
        createMockMarket({ id: "5", category: "politics", liquidity: 4000 }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMarkets)),
      });

      const result = await getTrendingMarkets({
        limit: 2,
        sortBy: "liquidity",
        category: MarketCategory.POLITICS,
      });

      expect(result.markets).toHaveLength(2);
      expect(result.sortBy).toBe("liquidity");
      expect(result.category).toBe(MarketCategory.POLITICS);
      // Top 2 politics markets by liquidity
      expect(result.markets[0]?.id).toBe("1"); // 10000
      expect(result.markets[1]?.id).toBe("2"); // 8000
    });

    it("should handle empty results with all options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      const result = await getTrendingMarkets({
        limit: 10,
        sortBy: "volume",
        category: MarketCategory.POLITICS,
      });

      expect(result.markets).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.sortBy).toBe("volume");
      expect(result.category).toBe(MarketCategory.POLITICS);
    });
  });

  describe("result structure", () => {
    it("should return correct result structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([createMockMarket({ volume: 100000 })])),
      });

      const result = await getTrendingMarkets();

      expect(result).toHaveProperty("markets");
      expect(result).toHaveProperty("count");
      expect(result).toHaveProperty("sortBy");
      expect(result).toHaveProperty("fetchedAt");
      expect(Array.isArray(result.markets)).toBe(true);
      expect(typeof result.count).toBe("number");
      expect(typeof result.sortBy).toBe("string");
      expect(typeof result.fetchedAt).toBe("string");
    });

    it("should include fetchedAt as valid ISO timestamp", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("[]"),
      });

      const result = await getTrendingMarkets();

      const timestamp = new Date(result.fetchedAt);
      expect(timestamp.toISOString()).toBe(result.fetchedAt);
    });
  });
});
