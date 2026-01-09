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
} from "@/api/clob/orderbook";
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
});
