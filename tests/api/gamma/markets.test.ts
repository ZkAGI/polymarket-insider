/**
 * Tests for Polymarket Gamma API Markets Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getActiveMarkets,
  getAllActiveMarkets,
  getMarketById,
  getMarketBySlug,
  parseSlugFromUrl,
} from "@/api/gamma/markets";
import { GammaClient, GammaApiException } from "@/api/gamma/client";
import type { GammaMarket, GammaMarketsResponse } from "@/api/gamma/types";

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
      const mockMarkets = [
        createMockMarket({ id: "1" }),
        createMockMarket({ id: "2" }),
      ];

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
      const arrayResponse = [
        createMockMarket({ id: "1" }),
        createMockMarket({ id: "2" }),
      ];

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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=25"),
      expect.any(Object)
    );
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
