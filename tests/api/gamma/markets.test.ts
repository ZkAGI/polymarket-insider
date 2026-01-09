/**
 * Tests for Polymarket Gamma API Markets Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getActiveMarkets,
  getAllActiveMarkets,
  getMarketById,
  getMarketBySlug,
  getMarketOutcomes,
  getMarketOutcomesBySlug,
  getMarketVolumeHistory,
  getMarketVolumeHistoryBySlug,
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

    const result = await getMarketVolumeHistoryBySlug("https://polymarket.com/event/election-winner");

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
