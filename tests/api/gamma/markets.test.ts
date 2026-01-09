/**
 * Tests for Polymarket Gamma API Markets Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getActiveMarkets, getAllActiveMarkets } from "@/api/gamma/markets";
import { GammaClient } from "@/api/gamma/client";
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
