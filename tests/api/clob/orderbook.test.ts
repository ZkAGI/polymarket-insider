/**
 * Tests for Polymarket CLOB Order Book API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOrderBook,
  getOrderBooks,
  calculateLiquidityAtPrice,
  getMidPrice,
  getSpreadPercentage,
  getTotalBidVolume,
  getTotalAskVolume,
  getVolumeImbalance,
  // Order book depth functions (API-CLOB-007)
  getOrderBookDepth,
  getCumulativeVolumeAtPrice,
  getPriceForVolume,
  calculateMarketImpact,
  getDepthAtPercentages,
  checkLiquidity,
} from "@/api/clob/orderbook";
import type { OrderBookDepth } from "@/api/clob/orderbook";
import { ClobClient, ClobApiException } from "@/api/clob/client";
import { OrderBook, OrderBookLevel } from "@/api/clob/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Order Book API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrderBook", () => {
    it("should fetch order book for valid token ID", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.55", "100"],
          ["0.54", "200"],
          ["0.53", "300"],
        ],
        asks: [
          ["0.57", "150"],
          ["0.58", "250"],
          ["0.59", "350"],
        ],
        timestamp: "2026-01-10T00:00:00Z",
        hash: "abc123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook).not.toBeNull();
      expect(orderBook?.asset_id).toBe("12345");
      expect(orderBook?.bids).toHaveLength(3);
      expect(orderBook?.asks).toHaveLength(3);
      expect(orderBook?.hash).toBe("abc123");
    });

    it("should sort bids descending by price", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.50", "100"],
          ["0.55", "200"],
          ["0.52", "300"],
        ],
        asks: [],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.bids[0]?.price).toBe("0.55");
      expect(orderBook?.bids[1]?.price).toBe("0.52");
      expect(orderBook?.bids[2]?.price).toBe("0.50");
    });

    it("should sort asks ascending by price", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [
          ["0.60", "100"],
          ["0.55", "200"],
          ["0.57", "300"],
        ],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.asks[0]?.price).toBe("0.55");
      expect(orderBook?.asks[1]?.price).toBe("0.57");
      expect(orderBook?.asks[2]?.price).toBe("0.60");
    });

    it("should calculate best bid correctly", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.50", "100"],
          ["0.55", "200"],
          ["0.52", "300"],
        ],
        asks: [["0.60", "100"]],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.best_bid).toBe("0.55");
    });

    it("should calculate best ask correctly", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [["0.50", "100"]],
        asks: [
          ["0.60", "100"],
          ["0.55", "200"],
          ["0.57", "300"],
        ],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.best_ask).toBe("0.55");
    });

    it("should calculate spread correctly", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [["0.50", "100"]],
        asks: [["0.55", "100"]],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.spread).toBe("0.0500");
    });

    it("should handle object format for bids/asks", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          { price: "0.55", size: "100" },
          { price: "0.54", size: "200" },
        ],
        asks: [
          { price: "0.57", size: "150" },
          { price: "0.58", size: "250" },
        ],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.bids[0]?.price).toBe("0.55");
      expect(orderBook?.bids[0]?.size).toBe("100");
      expect(orderBook?.asks[0]?.price).toBe("0.57");
      expect(orderBook?.asks[0]?.size).toBe("150");
    });

    it("should handle empty order book", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [],
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.bids).toHaveLength(0);
      expect(orderBook?.asks).toHaveLength(0);
      expect(orderBook?.best_bid).toBeUndefined();
      expect(orderBook?.best_ask).toBeUndefined();
      expect(orderBook?.spread).toBeUndefined();
    });

    it("should handle missing bids/asks in response", async () => {
      const mockResponse = {
        asset_id: "12345",
        timestamp: "2026-01-10T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.bids).toHaveLength(0);
      expect(orderBook?.asks).toHaveLength(0);
    });

    it("should return null for empty token ID", async () => {
      const result = await getOrderBook("");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only token ID", async () => {
      const result = await getOrderBook("   ");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Token not found"),
      });

      const client = new ClobClient({ retries: 1 });
      const result = await getOrderBook("nonexistent", { client });

      expect(result).toBeNull();
    });

    it("should throw on server errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(getOrderBook("12345", { client })).rejects.toThrow(ClobApiException);
    });

    it("should URL encode token ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ bids: [], asks: [] })),
      });

      const client = new ClobClient();
      await getOrderBook("token/with/slashes", { client });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("token%2Fwith%2Fslashes"),
        expect.any(Object)
      );
    });

    it("should handle Unix timestamp in seconds", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [],
        timestamp: 1704844800, // 2024-01-10T00:00:00Z in seconds
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.timestamp).toBe("2024-01-10T00:00:00.000Z");
    });

    it("should handle Unix timestamp in milliseconds", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [],
        timestamp: 1704844800000, // 2024-01-10T00:00:00Z in milliseconds
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("12345", { client });

      expect(orderBook?.timestamp).toBe("2024-01-10T00:00:00.000Z");
    });

    it("should use current time if no timestamp in response", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const beforeTime = new Date().toISOString();
      const orderBook = await getOrderBook("12345", { client });
      const afterTime = new Date().toISOString();

      expect(orderBook?.timestamp).toBeDefined();
      // Timestamp should be between before and after
      expect(orderBook?.timestamp! >= beforeTime).toBe(true);
      expect(orderBook?.timestamp! <= afterTime).toBe(true);
    });

    it("should use token_id from response if asset_id not present", async () => {
      const mockResponse = {
        token_id: "token123",
        bids: [],
        asks: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("token123", { client });

      expect(orderBook?.asset_id).toBe("token123");
    });

    it("should use market from response if others not present", async () => {
      const mockResponse = {
        market: "market123",
        bids: [],
        asks: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("market123", { client });

      expect(orderBook?.asset_id).toBe("market123");
    });

    it("should fallback to input tokenId if no ID in response", async () => {
      const mockResponse = {
        bids: [],
        asks: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const orderBook = await getOrderBook("inputToken", { client });

      expect(orderBook?.asset_id).toBe("inputToken");
    });

    it("should trim token ID before use", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ bids: [], asks: [] })),
      });

      const client = new ClobClient();
      await getOrderBook("  12345  ", { client });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("token_id=12345"),
        expect.any(Object)
      );
    });
  });

  describe("getOrderBooks", () => {
    it("should fetch multiple order books in parallel", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                asset_id: "token1",
                bids: [["0.50", "100"]],
                asks: [["0.55", "100"]],
              })
            ),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                asset_id: "token2",
                bids: [["0.60", "200"]],
                asks: [["0.65", "200"]],
              })
            ),
        });

      const client = new ClobClient();
      const results = await getOrderBooks(["token1", "token2"], { client });

      expect(results.size).toBe(2);
      expect(results.get("token1")?.asset_id).toBe("token1");
      expect(results.get("token2")?.asset_id).toBe("token2");
    });

    it("should handle mixed success and failure", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                asset_id: "token1",
                bids: [],
                asks: [],
              })
            ),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: () => Promise.resolve("Not found"),
        });

      const client = new ClobClient({ retries: 1 });
      const results = await getOrderBooks(["token1", "token2"], { client });

      expect(results.size).toBe(2);
      expect(results.get("token1")).not.toBeNull();
      expect(results.get("token2")).toBeNull();
    });

    it("should handle empty array", async () => {
      const client = new ClobClient();
      const results = await getOrderBooks([], { client });

      expect(results.size).toBe(0);
    });
  });

  describe("calculateLiquidityAtPrice", () => {
    const levels: OrderBookLevel[] = [
      { price: "0.60", size: "100" },
      { price: "0.55", size: "200" },
      { price: "0.50", size: "300" },
    ];

    it("should calculate bid liquidity at price threshold", () => {
      const liquidity = calculateLiquidityAtPrice(levels, 0.55, "bid");
      // Should include 0.60 (100) and 0.55 (200) = 300
      expect(liquidity).toBe(300);
    });

    it("should calculate ask liquidity at price threshold", () => {
      const liquidity = calculateLiquidityAtPrice(levels, 0.55, "ask");
      // Should include 0.55 (200) and 0.50 (300) = 500
      expect(liquidity).toBe(500);
    });

    it("should handle empty levels", () => {
      const liquidity = calculateLiquidityAtPrice([], 0.55, "bid");
      expect(liquidity).toBe(0);
    });

    it("should handle invalid price values", () => {
      const invalidLevels: OrderBookLevel[] = [
        { price: "invalid", size: "100" },
        { price: "0.55", size: "200" },
      ];
      const liquidity = calculateLiquidityAtPrice(invalidLevels, 0.50, "bid");
      expect(liquidity).toBe(200);
    });

    it("should handle invalid size values", () => {
      const invalidLevels: OrderBookLevel[] = [
        { price: "0.60", size: "invalid" },
        { price: "0.55", size: "200" },
      ];
      const liquidity = calculateLiquidityAtPrice(invalidLevels, 0.50, "bid");
      expect(liquidity).toBe(200);
    });
  });

  describe("getMidPrice", () => {
    it("should calculate mid price correctly", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_bid: "0.50",
        best_ask: "0.60",
      };

      const midPrice = getMidPrice(orderBook);
      expect(midPrice).toBe(0.55);
    });

    it("should return undefined if no best bid", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_ask: "0.60",
      };

      expect(getMidPrice(orderBook)).toBeUndefined();
    });

    it("should return undefined if no best ask", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_bid: "0.50",
      };

      expect(getMidPrice(orderBook)).toBeUndefined();
    });
  });

  describe("getSpreadPercentage", () => {
    it("should calculate spread percentage correctly", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_bid: "0.50",
        best_ask: "0.60",
        spread: "0.10",
      };

      const spreadPct = getSpreadPercentage(orderBook);
      // Mid price is 0.55, spread is 0.10, percentage is (0.10 / 0.55) * 100
      expect(spreadPct).toBeCloseTo(18.18, 1);
    });

    it("should return undefined if no spread", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_bid: "0.50",
        best_ask: "0.60",
      };

      expect(getSpreadPercentage(orderBook)).toBeUndefined();
    });

    it("should return undefined if mid price is 0", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
        best_bid: "0",
        best_ask: "0",
        spread: "0",
      };

      expect(getSpreadPercentage(orderBook)).toBeUndefined();
    });
  });

  describe("getTotalBidVolume", () => {
    it("should sum all bid volumes", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [
          { price: "0.55", size: "100" },
          { price: "0.54", size: "200" },
          { price: "0.53", size: "300" },
        ],
        asks: [],
      };

      expect(getTotalBidVolume(orderBook)).toBe(600);
    });

    it("should return 0 for empty bids", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
      };

      expect(getTotalBidVolume(orderBook)).toBe(0);
    });

    it("should handle invalid size values", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [
          { price: "0.55", size: "100" },
          { price: "0.54", size: "invalid" },
        ],
        asks: [],
      };

      expect(getTotalBidVolume(orderBook)).toBe(100);
    });
  });

  describe("getTotalAskVolume", () => {
    it("should sum all ask volumes", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [
          { price: "0.57", size: "150" },
          { price: "0.58", size: "250" },
          { price: "0.59", size: "350" },
        ],
      };

      expect(getTotalAskVolume(orderBook)).toBe(750);
    });

    it("should return 0 for empty asks", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [],
        asks: [],
      };

      expect(getTotalAskVolume(orderBook)).toBe(0);
    });
  });

  describe("getVolumeImbalance", () => {
    it("should calculate volume imbalance correctly", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [{ price: "0.55", size: "200" }],
        asks: [{ price: "0.57", size: "100" }],
      };

      expect(getVolumeImbalance(orderBook)).toBe(2);
    });

    it("should return undefined if no asks", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [{ price: "0.55", size: "200" }],
        asks: [],
      };

      expect(getVolumeImbalance(orderBook)).toBeUndefined();
    });

    it("should handle equal bid and ask volumes", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [{ price: "0.55", size: "100" }],
        asks: [{ price: "0.57", size: "100" }],
      };

      expect(getVolumeImbalance(orderBook)).toBe(1);
    });

    it("should indicate selling pressure when ratio < 1", () => {
      const orderBook: OrderBook = {
        asset_id: "test",
        timestamp: "2026-01-10T00:00:00Z",
        bids: [{ price: "0.55", size: "50" }],
        asks: [{ price: "0.57", size: "100" }],
      };

      expect(getVolumeImbalance(orderBook)).toBe(0.5);
    });
  });

  // ============================================================================
  // API-CLOB-007: Order Book Depth Tests
  // ============================================================================

  describe("getOrderBookDepth", () => {
    it("should fetch and calculate order book depth", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.55", "100"],
          ["0.54", "200"],
          ["0.53", "150"],
          ["0.52", "300"],
        ],
        asks: [
          ["0.56", "100"],
          ["0.57", "250"],
          ["0.58", "200"],
          ["0.59", "150"],
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { client });

      expect(depth).not.toBeNull();
      expect(depth?.tokenId).toBe("12345");
      expect(depth?.bidDepth.length).toBeGreaterThan(0);
      expect(depth?.askDepth.length).toBeGreaterThan(0);
      expect(depth?.bidSummary.totalVolume).toBeGreaterThan(0);
      expect(depth?.askSummary.totalVolume).toBeGreaterThan(0);
    });

    it("should return null for invalid token ID", async () => {
      const depth = await getOrderBookDepth("");
      expect(depth).toBeNull();
    });

    it("should calculate cumulative sizes correctly", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.55", "100"],
          ["0.54", "200"],
        ],
        asks: [
          ["0.56", "100"],
          ["0.57", "200"],
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { priceInterval: 0.01, client });

      expect(depth).not.toBeNull();

      // Check bid depth (sorted descending by price)
      if (depth && depth.bidDepth.length >= 2) {
        expect(depth.bidDepth[0]?.cumulativeSize).toBe(depth.bidDepth[0]?.size);
        expect(depth.bidDepth[1]?.cumulativeSize).toBe(
          (depth.bidDepth[0]?.size ?? 0) + (depth.bidDepth[1]?.size ?? 0)
        );
      }
    });

    it("should respect levels option", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: Array(50).fill(null).map((_, i) => [`${0.55 - i * 0.001}`, "100"]),
        asks: Array(50).fill(null).map((_, i) => [`${0.56 + i * 0.001}`, "100"]),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { levels: 10, client });

      expect(depth).not.toBeNull();
      expect(depth?.bidDepth.length).toBeLessThanOrEqual(10);
      expect(depth?.askDepth.length).toBeLessThanOrEqual(10);
    });

    it("should calculate mid price and spread", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [["0.50", "100"]],
        asks: [["0.52", "100"]],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { client });

      expect(depth).not.toBeNull();
      expect(depth?.midPrice).toBe(0.51);
      expect(depth?.spread).toBeCloseTo(0.02, 10);
      expect(depth?.spreadPercent).toBeCloseTo(3.92, 1); // 0.02/0.51 * 100
    });

    it("should calculate volume imbalance", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [["0.50", "200"]],
        asks: [["0.52", "100"]],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { client });

      expect(depth).not.toBeNull();
      expect(depth?.volumeImbalance).toBe(2); // 200/100
    });

    it("should handle empty order book", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [],
        asks: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { client });

      expect(depth).not.toBeNull();
      expect(depth?.bidDepth).toHaveLength(0);
      expect(depth?.askDepth).toHaveLength(0);
      expect(depth?.bidSummary.totalVolume).toBe(0);
    });

    it("should filter by maxDepthPercent", async () => {
      const mockResponse = {
        asset_id: "12345",
        bids: [
          ["0.50", "100"],  // best bid
          ["0.49", "100"],  // 2% from best
          ["0.45", "100"],  // 10% from best - should be filtered
        ],
        asks: [
          ["0.52", "100"],  // best ask
          ["0.53", "100"],  // ~2% from best
          ["0.60", "100"],  // ~15% from best - should be filtered
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { maxDepthPercent: 0.05, client });

      expect(depth).not.toBeNull();
      // Should filter out levels more than 5% from best price
      expect(depth?.bidSummary.totalVolume).toBeLessThan(300);
    });

    it("should handle 404 error gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      const client = new ClobClient();
      const depth = await getOrderBookDepth("12345", { client });

      expect(depth).toBeNull();
    });
  });

  describe("getCumulativeVolumeAtPrice", () => {
    const createDepth = (): OrderBookDepth => ({
      tokenId: "test",
      bidDepth: [
        { price: 0.55, size: 100, cumulativeSize: 100, cumulativeValue: 55, orderCount: 1, percentOfTotal: 25 },
        { price: 0.54, size: 100, cumulativeSize: 200, cumulativeValue: 109, orderCount: 1, percentOfTotal: 50 },
        { price: 0.53, size: 100, cumulativeSize: 300, cumulativeValue: 162, orderCount: 1, percentOfTotal: 75 },
        { price: 0.52, size: 100, cumulativeSize: 400, cumulativeValue: 214, orderCount: 1, percentOfTotal: 100 },
      ],
      askDepth: [
        { price: 0.56, size: 100, cumulativeSize: 100, cumulativeValue: 56, orderCount: 1, percentOfTotal: 25 },
        { price: 0.57, size: 100, cumulativeSize: 200, cumulativeValue: 113, orderCount: 1, percentOfTotal: 50 },
        { price: 0.58, size: 100, cumulativeSize: 300, cumulativeValue: 171, orderCount: 1, percentOfTotal: 75 },
        { price: 0.59, size: 100, cumulativeSize: 400, cumulativeValue: 230, orderCount: 1, percentOfTotal: 100 },
      ],
      bidSummary: { totalVolume: 400, totalValue: 214, weightedAvgPrice: 0.535, levelCount: 4, bestPrice: 0.55, worstPrice: 0.52, priceRange: 0.03 },
      askSummary: { totalVolume: 400, totalValue: 230, weightedAvgPrice: 0.575, levelCount: 4, bestPrice: 0.56, worstPrice: 0.59, priceRange: 0.03 },
      midPrice: 0.555,
      spread: 0.01,
      spreadPercent: 1.8,
      volumeImbalance: 1,
      timestamp: "2026-01-10T00:00:00Z",
    });

    it("should return cumulative volume at bid price", () => {
      const depth = createDepth();
      const volume = getCumulativeVolumeAtPrice(depth, 0.54, "bid");
      expect(volume).toBe(200);
    });

    it("should return cumulative volume at ask price", () => {
      const depth = createDepth();
      const volume = getCumulativeVolumeAtPrice(depth, 0.57, "ask");
      expect(volume).toBe(200);
    });

    it("should return total volume if price is beyond all levels", () => {
      const depth = createDepth();
      const bidVolume = getCumulativeVolumeAtPrice(depth, 0.40, "bid");
      expect(bidVolume).toBe(400);

      const askVolume = getCumulativeVolumeAtPrice(depth, 0.70, "ask");
      expect(askVolume).toBe(400);
    });
  });

  describe("getPriceForVolume", () => {
    const createDepth = (): OrderBookDepth => ({
      tokenId: "test",
      bidDepth: [
        { price: 0.55, size: 100, cumulativeSize: 100, cumulativeValue: 55, orderCount: 1, percentOfTotal: 50 },
        { price: 0.54, size: 100, cumulativeSize: 200, cumulativeValue: 109, orderCount: 1, percentOfTotal: 100 },
      ],
      askDepth: [
        { price: 0.56, size: 100, cumulativeSize: 100, cumulativeValue: 56, orderCount: 1, percentOfTotal: 50 },
        { price: 0.57, size: 100, cumulativeSize: 200, cumulativeValue: 113, orderCount: 1, percentOfTotal: 100 },
      ],
      bidSummary: { totalVolume: 200, totalValue: 109, weightedAvgPrice: 0.545, levelCount: 2, bestPrice: 0.55, worstPrice: 0.54, priceRange: 0.01 },
      askSummary: { totalVolume: 200, totalValue: 113, weightedAvgPrice: 0.565, levelCount: 2, bestPrice: 0.56, worstPrice: 0.57, priceRange: 0.01 },
      midPrice: 0.555,
      spread: 0.01,
      spreadPercent: 1.8,
      volumeImbalance: 1,
      timestamp: "2026-01-10T00:00:00Z",
    });

    it("should return price for fillable volume on bid side", () => {
      const depth = createDepth();
      const price = getPriceForVolume(depth, 150, "bid");
      expect(price).toBe(0.54);
    });

    it("should return price for fillable volume on ask side", () => {
      const depth = createDepth();
      const price = getPriceForVolume(depth, 150, "ask");
      expect(price).toBe(0.57);
    });

    it("should return undefined for insufficient liquidity", () => {
      const depth = createDepth();
      const price = getPriceForVolume(depth, 500, "bid");
      expect(price).toBeUndefined();
    });
  });

  describe("calculateMarketImpact", () => {
    const createDepth = (): OrderBookDepth => ({
      tokenId: "test",
      bidDepth: [
        { price: 0.55, size: 100, cumulativeSize: 100, cumulativeValue: 55, orderCount: 1, percentOfTotal: 50 },
        { price: 0.54, size: 100, cumulativeSize: 200, cumulativeValue: 109, orderCount: 1, percentOfTotal: 100 },
      ],
      askDepth: [
        { price: 0.56, size: 100, cumulativeSize: 100, cumulativeValue: 56, orderCount: 1, percentOfTotal: 50 },
        { price: 0.57, size: 100, cumulativeSize: 200, cumulativeValue: 113, orderCount: 1, percentOfTotal: 100 },
      ],
      bidSummary: { totalVolume: 200, totalValue: 109, weightedAvgPrice: 0.545, levelCount: 2, bestPrice: 0.55, worstPrice: 0.54, priceRange: 0.01 },
      askSummary: { totalVolume: 200, totalValue: 113, weightedAvgPrice: 0.565, levelCount: 2, bestPrice: 0.56, worstPrice: 0.57, priceRange: 0.01 },
      midPrice: 0.555,
      spread: 0.01,
      spreadPercent: 1.8,
      volumeImbalance: 1,
      timestamp: "2026-01-10T00:00:00Z",
    });

    it("should calculate average price for small volume", () => {
      const depth = createDepth();
      const avgPrice = calculateMarketImpact(depth, 50, "ask");
      expect(avgPrice).toBe(0.56); // All fills at first level
    });

    it("should calculate average price spanning multiple levels", () => {
      const depth = createDepth();
      const avgPrice = calculateMarketImpact(depth, 150, "ask");
      // 100 at 0.56 + 50 at 0.57 = (56 + 28.5) / 150 = 0.563333
      expect(avgPrice).toBeCloseTo(0.563, 2);
    });

    it("should return undefined for insufficient liquidity", () => {
      const depth = createDepth();
      const avgPrice = calculateMarketImpact(depth, 500, "bid");
      expect(avgPrice).toBeUndefined();
    });
  });

  describe("getDepthAtPercentages", () => {
    const createDepth = (): OrderBookDepth => ({
      tokenId: "test",
      bidDepth: [
        { price: 0.55, size: 100, cumulativeSize: 100, cumulativeValue: 55, orderCount: 1, percentOfTotal: 50 },
        { price: 0.50, size: 100, cumulativeSize: 200, cumulativeValue: 105, orderCount: 1, percentOfTotal: 100 },
      ],
      askDepth: [
        { price: 0.56, size: 100, cumulativeSize: 100, cumulativeValue: 56, orderCount: 1, percentOfTotal: 50 },
        { price: 0.60, size: 100, cumulativeSize: 200, cumulativeValue: 116, orderCount: 1, percentOfTotal: 100 },
      ],
      bidSummary: { totalVolume: 200, totalValue: 105, weightedAvgPrice: 0.525, levelCount: 2, bestPrice: 0.55, worstPrice: 0.50, priceRange: 0.05 },
      askSummary: { totalVolume: 200, totalValue: 116, weightedAvgPrice: 0.58, levelCount: 2, bestPrice: 0.56, worstPrice: 0.60, priceRange: 0.04 },
      midPrice: 0.555,
      spread: 0.01,
      spreadPercent: 1.8,
      volumeImbalance: 1,
      timestamp: "2026-01-10T00:00:00Z",
    });

    it("should return depth at multiple percentages", () => {
      const depth = createDepth();
      const levels = getDepthAtPercentages(depth, [0.02, 0.05, 0.10]);

      // Note: 0.10 becomes "0.1" when used as an object key
      expect(levels).toHaveProperty("0.02");
      expect(levels).toHaveProperty("0.05");
      expect(levels).toHaveProperty("0.1");
    });

    it("should return zero volumes when no mid price", () => {
      const depth = createDepth();
      depth.midPrice = undefined;
      const levels = getDepthAtPercentages(depth, [0.02]);

      expect(levels[0.02]?.bidVolume).toBe(0);
      expect(levels[0.02]?.askVolume).toBe(0);
    });
  });

  describe("checkLiquidity", () => {
    const createDepth = (): OrderBookDepth => ({
      tokenId: "test",
      bidDepth: [
        { price: 0.55, size: 100, cumulativeSize: 100, cumulativeValue: 55, orderCount: 1, percentOfTotal: 50 },
        { price: 0.54, size: 100, cumulativeSize: 200, cumulativeValue: 109, orderCount: 1, percentOfTotal: 100 },
      ],
      askDepth: [
        { price: 0.56, size: 100, cumulativeSize: 100, cumulativeValue: 56, orderCount: 1, percentOfTotal: 50 },
        { price: 0.57, size: 100, cumulativeSize: 200, cumulativeValue: 113, orderCount: 1, percentOfTotal: 100 },
      ],
      bidSummary: { totalVolume: 200, totalValue: 109, weightedAvgPrice: 0.545, levelCount: 2, bestPrice: 0.55, worstPrice: 0.54, priceRange: 0.01 },
      askSummary: { totalVolume: 200, totalValue: 113, weightedAvgPrice: 0.565, levelCount: 2, bestPrice: 0.56, worstPrice: 0.57, priceRange: 0.01 },
      midPrice: 0.555,
      spread: 0.01,
      spreadPercent: 1.8,
      volumeImbalance: 1,
      timestamp: "2026-01-10T00:00:00Z",
    });

    it("should indicate sufficient liquidity for small order", () => {
      const depth = createDepth();
      const result = checkLiquidity(depth, 50, "ask", 0.05);

      expect(result.hasSufficientLiquidity).toBe(true);
      expect(result.expectedSlippage).toBeLessThan(0.05);
      expect(result.fillPrice).toBeDefined();
    });

    it("should indicate insufficient liquidity for large order", () => {
      const depth = createDepth();
      const result = checkLiquidity(depth, 500, "ask", 0.05);

      expect(result.hasSufficientLiquidity).toBe(false);
      expect(result.expectedSlippage).toBe(Infinity);
    });

    it("should return slippage exceeds max for medium order", () => {
      const depth = createDepth();
      const result = checkLiquidity(depth, 150, "ask", 0.001); // Very tight slippage tolerance

      expect(result.hasSufficientLiquidity).toBe(false);
      expect(result.expectedSlippage).toBeGreaterThan(0.001);
    });
  });
});
