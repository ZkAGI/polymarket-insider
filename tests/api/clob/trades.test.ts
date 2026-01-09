/**
 * Tests for Polymarket CLOB Trades API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRecentTrades,
  getRecentTradesForTokens,
  calculateTotalVolume,
  calculateVWAP,
  getPriceRange,
  getTradeCounts,
  getVolumesBySide,
  filterTradesByTimeRange,
  filterTradesByMinSize,
  getUniqueWallets,
  // API-CLOB-004: Wallet trade functions
  getTradesByWallet,
  getAllTradesByWallet,
  getWalletActivitySummary,
  hasWalletTraded,
  getFirstWalletTrade,
  getTradesBetweenWallets,
  isValidWalletAddress,
  normalizeWalletAddress,
} from "@/api/clob/trades";
import { ClobClient, ClobApiException } from "@/api/clob/client";
import { Trade } from "@/api/clob/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Trades API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getRecentTrades", () => {
    it("should fetch recent trades for valid token ID", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            asset_id: "12345",
            taker_address: "0xTaker1",
            maker_address: "0xMaker1",
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade2",
            asset_id: "12345",
            taker_address: "0xTaker2",
            maker_address: "0xMaker2",
            side: "sell",
            price: "0.54",
            size: "200",
            created_at: "2026-01-09T23:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result).not.toBeNull();
      expect(result?.trades).toHaveLength(2);
      expect(result?.count).toBe(2);
      expect(result?.tokenId).toBe("12345");
      expect(result?.fetchedAt).toBeDefined();
    });

    it("should sort trades by timestamp descending", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            asset_id: "12345",
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-09T20:00:00Z",
          },
          {
            id: "trade2",
            asset_id: "12345",
            side: "sell",
            price: "0.54",
            size: "200",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade3",
            asset_id: "12345",
            side: "buy",
            price: "0.53",
            size: "300",
            created_at: "2026-01-09T22:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades[0]?.id).toBe("trade2"); // Most recent
      expect(result?.trades[1]?.id).toBe("trade3");
      expect(result?.trades[2]?.id).toBe("trade1"); // Oldest
    });

    it("should handle array response format", async () => {
      const mockResponse = [
        {
          id: "trade1",
          asset_id: "12345",
          side: "buy",
          price: "0.55",
          size: "100",
          created_at: "2026-01-10T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades).toHaveLength(1);
      expect(result?.trades[0]?.id).toBe("trade1");
    });

    it("should handle data array response format", async () => {
      const mockResponse = {
        data: [
          {
            id: "trade1",
            asset_id: "12345",
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades).toHaveLength(1);
    });

    it("should handle alternative field names", async () => {
      const mockResponse = {
        trades: [
          {
            trade_id: "alt_trade1",
            token_id: "12345",
            taker: "0xTaker",
            maker: "0xMaker",
            side: "SELL",
            price: "0.55",
            amount: "100",
            tx_hash: "0xhash123",
            timestamp: "2026-01-10T00:00:00Z",
            fee: "0.1",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      const trade = result?.trades[0];
      expect(trade?.id).toBe("alt_trade1");
      expect(trade?.asset_id).toBe("12345");
      expect(trade?.taker_address).toBe("0xTaker");
      expect(trade?.maker_address).toBe("0xMaker");
      expect(trade?.side).toBe("sell");
      expect(trade?.size).toBe("100");
      expect(trade?.transaction_hash).toBe("0xhash123");
      expect(trade?.fee_rate_bps).toBe("0.1");
    });

    it("should parse Unix timestamp in seconds", async () => {
      const unixTimestamp = 1736467200; // 2026-01-10T00:00:00Z
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: unixTimestamp,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades[0]?.created_at).toBe("2026-01-10T00:00:00.000Z");
    });

    it("should parse Unix timestamp in milliseconds", async () => {
      const unixTimestampMs = 1736467200000; // 2026-01-10T00:00:00Z
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            side: "buy",
            price: "0.55",
            size: "100",
            timestamp: unixTimestampMs,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades[0]?.created_at).toBe("2026-01-10T00:00:00.000Z");
    });

    it("should apply limit parameter", async () => {
      const mockResponse = {
        trades: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: `trade${i}`,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: `2026-01-10T${String(i).padStart(2, "0")}:00:00Z`,
          })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { limit: 10, client });

      expect(result?.count).toBe(10);
      expect(result?.trades).toHaveLength(10);
    });

    it("should clamp limit to maximum of 1000", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getRecentTrades("12345", { limit: 5000, client });

      // Check that the API was called with limit=1000
      const url = mockFetch.mock.calls[0]?.[0];
      expect(url).toContain("limit=1000");
    });

    it("should clamp limit to minimum of 1", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getRecentTrades("12345", { limit: -5, client });

      const url = mockFetch.mock.calls[0]?.[0];
      expect(url).toContain("limit=1");
    });

    it("should return null for empty token ID", async () => {
      const client = new ClobClient();
      const result = await getRecentTrades("", { client });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only token ID", async () => {
      const client = new ClobClient();
      const result = await getRecentTrades("   ", { client });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve('{"message": "Market not found"}'),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("nonexistent", { client });

      expect(result).toBeNull();
    });

    it("should throw on server error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve('{"message": "Server error"}'),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(getRecentTrades("12345", { client })).rejects.toThrow(ClobApiException);
    });

    it("should return empty trades array for empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades).toHaveLength(0);
      expect(result?.count).toBe(0);
    });

    it("should parse trade direction correctly", async () => {
      const mockResponse = {
        trades: [
          { id: "1", side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T01:00:00Z" },
          { id: "2", side: "SELL", price: "0.5", size: "10", created_at: "2026-01-10T02:00:00Z" },
          { id: "3", side: "s", price: "0.5", size: "10", created_at: "2026-01-10T03:00:00Z" },
          { id: "4", side: "ask", price: "0.5", size: "10", created_at: "2026-01-10T04:00:00Z" },
          { id: "5", side: undefined, price: "0.5", size: "10", created_at: "2026-01-10T05:00:00Z" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades[4]?.side).toBe("buy"); // id=5, undefined -> buy
      expect(result?.trades[3]?.side).toBe("sell"); // id=4, ask -> sell
      expect(result?.trades[2]?.side).toBe("sell"); // id=3, s -> sell
      expect(result?.trades[1]?.side).toBe("sell"); // id=2, SELL -> sell
      expect(result?.trades[0]?.side).toBe("buy"); // id=1, buy -> buy
    });

    it("should include match_id and bucket_index when present", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
            match_id: "match123",
            bucket_index: 42,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getRecentTrades("12345", { client });

      expect(result?.trades[0]?.match_id).toBe("match123");
      expect(result?.trades[0]?.bucket_index).toBe(42);
    });

    it("should URL encode token ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getRecentTrades("token/with/slashes", { client });

      const url = mockFetch.mock.calls[0]?.[0];
      expect(url).toContain("token_id=token%2Fwith%2Fslashes");
    });
  });

  describe("getRecentTradesForTokens", () => {
    it("should fetch trades for multiple tokens in parallel", async () => {
      const mockResponses = [
        { trades: [{ id: "trade1", side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" }] },
        { trades: [{ id: "trade2", side: "sell", price: "0.6", size: "20", created_at: "2026-01-10T00:00:00Z" }] },
      ];

      let callIndex = 0;
      mockFetch.mockImplementation(() => {
        const response = mockResponses[callIndex++];
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(response)),
        });
      });

      const client = new ClobClient();
      const results = await getRecentTradesForTokens(["token1", "token2"], { client });

      expect(results.size).toBe(2);
      expect(results.get("token1")?.trades).toHaveLength(1);
      expect(results.get("token2")?.trades).toHaveLength(1);
    });

    it("should handle mixed success and not found results", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                trades: [{ id: "trade1", side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" }],
              })
            ),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: () => Promise.resolve('{"message": "Not found"}'),
        });

      const client = new ClobClient();
      const results = await getRecentTradesForTokens(["token1", "notfound"], { client });

      expect(results.get("token1")?.trades).toHaveLength(1);
      expect(results.get("notfound")).toBeNull();
    });
  });

  describe("Helper functions", () => {
    const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
      id: "trade1",
      asset_id: "12345",
      side: "buy",
      price: "0.55",
      size: "100",
      created_at: "2026-01-10T00:00:00Z",
      ...overrides,
    });

    describe("calculateTotalVolume", () => {
      it("should calculate total volume", () => {
        const trades: Trade[] = [
          createTrade({ size: "100" }),
          createTrade({ size: "200" }),
          createTrade({ size: "150" }),
        ];

        expect(calculateTotalVolume(trades)).toBe(450);
      });

      it("should handle empty array", () => {
        expect(calculateTotalVolume([])).toBe(0);
      });

      it("should handle invalid sizes", () => {
        const trades: Trade[] = [createTrade({ size: "100" }), createTrade({ size: "invalid" })];

        expect(calculateTotalVolume(trades)).toBe(100);
      });
    });

    describe("calculateVWAP", () => {
      it("should calculate VWAP correctly", () => {
        const trades: Trade[] = [
          createTrade({ price: "0.50", size: "100" }), // value = 50
          createTrade({ price: "0.60", size: "100" }), // value = 60
        ];

        // Total value = 110, Total volume = 200, VWAP = 0.55
        expect(calculateVWAP(trades)).toBe(0.55);
      });

      it("should return undefined for empty array", () => {
        expect(calculateVWAP([])).toBeUndefined();
      });

      it("should return undefined for zero volume", () => {
        const trades: Trade[] = [createTrade({ size: "0" })];
        expect(calculateVWAP(trades)).toBeUndefined();
      });
    });

    describe("getPriceRange", () => {
      it("should return min and max prices", () => {
        const trades: Trade[] = [
          createTrade({ price: "0.50" }),
          createTrade({ price: "0.60" }),
          createTrade({ price: "0.45" }),
        ];

        const range = getPriceRange(trades);
        expect(range?.min).toBe(0.45);
        expect(range?.max).toBe(0.6);
      });

      it("should return undefined for empty array", () => {
        expect(getPriceRange([])).toBeUndefined();
      });

      it("should handle single trade", () => {
        const trades: Trade[] = [createTrade({ price: "0.55" })];
        const range = getPriceRange(trades);
        expect(range?.min).toBe(0.55);
        expect(range?.max).toBe(0.55);
      });
    });

    describe("getTradeCounts", () => {
      it("should count buys and sells", () => {
        const trades: Trade[] = [
          createTrade({ side: "buy" }),
          createTrade({ side: "sell" }),
          createTrade({ side: "buy" }),
          createTrade({ side: "sell" }),
          createTrade({ side: "buy" }),
        ];

        const counts = getTradeCounts(trades);
        expect(counts.buy).toBe(3);
        expect(counts.sell).toBe(2);
      });

      it("should handle empty array", () => {
        const counts = getTradeCounts([]);
        expect(counts.buy).toBe(0);
        expect(counts.sell).toBe(0);
      });
    });

    describe("getVolumesBySide", () => {
      it("should calculate volumes by side", () => {
        const trades: Trade[] = [
          createTrade({ side: "buy", size: "100" }),
          createTrade({ side: "sell", size: "200" }),
          createTrade({ side: "buy", size: "150" }),
        ];

        const volumes = getVolumesBySide(trades);
        expect(volumes.buy).toBe(250);
        expect(volumes.sell).toBe(200);
      });
    });

    describe("filterTradesByTimeRange", () => {
      it("should filter trades within time range", () => {
        const trades: Trade[] = [
          createTrade({ id: "1", created_at: "2026-01-10T10:00:00Z" }),
          createTrade({ id: "2", created_at: "2026-01-10T12:00:00Z" }),
          createTrade({ id: "3", created_at: "2026-01-10T14:00:00Z" }),
          createTrade({ id: "4", created_at: "2026-01-10T16:00:00Z" }),
        ];

        const filtered = filterTradesByTimeRange(trades, "2026-01-10T11:00:00Z", "2026-01-10T15:00:00Z");

        expect(filtered).toHaveLength(2);
        expect(filtered[0]?.id).toBe("2");
        expect(filtered[1]?.id).toBe("3");
      });

      it("should handle Date objects", () => {
        const trades: Trade[] = [
          createTrade({ id: "1", created_at: "2026-01-10T12:00:00Z" }),
        ];

        const filtered = filterTradesByTimeRange(
          trades,
          new Date("2026-01-10T11:00:00Z"),
          new Date("2026-01-10T13:00:00Z")
        );

        expect(filtered).toHaveLength(1);
      });
    });

    describe("filterTradesByMinSize", () => {
      it("should filter trades by minimum size", () => {
        const trades: Trade[] = [
          createTrade({ id: "1", size: "50" }),
          createTrade({ id: "2", size: "100" }),
          createTrade({ id: "3", size: "150" }),
        ];

        const filtered = filterTradesByMinSize(trades, 100);

        expect(filtered).toHaveLength(2);
        expect(filtered[0]?.id).toBe("2");
        expect(filtered[1]?.id).toBe("3");
      });
    });

    describe("getUniqueWallets", () => {
      it("should extract unique wallet addresses", () => {
        const trades: Trade[] = [
          createTrade({ taker_address: "0xTaker1", maker_address: "0xMaker1" }),
          createTrade({ taker_address: "0xTaker1", maker_address: "0xMaker2" }),
          createTrade({ taker_address: "0xTaker2", maker_address: "0xMaker1" }),
        ];

        const wallets = getUniqueWallets(trades);

        expect(wallets.takers.size).toBe(2);
        expect(wallets.makers.size).toBe(2);
        expect(wallets.all.size).toBe(4);
        expect(wallets.takers.has("0xTaker1")).toBe(true);
        expect(wallets.makers.has("0xMaker1")).toBe(true);
      });

      it("should handle missing addresses", () => {
        const trades: Trade[] = [
          createTrade({ taker_address: "0xTaker1", maker_address: undefined }),
          createTrade({ taker_address: undefined, maker_address: "0xMaker1" }),
        ];

        const wallets = getUniqueWallets(trades);

        expect(wallets.takers.size).toBe(1);
        expect(wallets.makers.size).toBe(1);
        expect(wallets.all.size).toBe(2);
      });
    });
  });

  // ==========================================================================
  // API-CLOB-004: Fetch trades by wallet address tests
  // ==========================================================================

  describe("Wallet Address Utilities", () => {
    describe("isValidWalletAddress", () => {
      it("should return true for valid Ethereum addresses", () => {
        expect(isValidWalletAddress("0x1234567890123456789012345678901234567890")).toBe(true);
        expect(isValidWalletAddress("0xaBcDeF1234567890123456789012345678901234")).toBe(true);
        expect(isValidWalletAddress("0x0000000000000000000000000000000000000000")).toBe(true);
      });

      it("should return false for invalid addresses", () => {
        expect(isValidWalletAddress("")).toBe(false);
        expect(isValidWalletAddress("0x")).toBe(false);
        expect(isValidWalletAddress("0x123")).toBe(false);
        expect(isValidWalletAddress("1234567890123456789012345678901234567890")).toBe(false);
        expect(isValidWalletAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
        expect(isValidWalletAddress("0x12345678901234567890123456789012345678901")).toBe(false); // too long
        expect(isValidWalletAddress("not an address")).toBe(false);
      });

      it("should handle whitespace", () => {
        expect(isValidWalletAddress("  0x1234567890123456789012345678901234567890  ")).toBe(true);
      });

      it("should return false for null/undefined-like inputs", () => {
        expect(isValidWalletAddress(null as unknown as string)).toBe(false);
        expect(isValidWalletAddress(undefined as unknown as string)).toBe(false);
      });
    });

    describe("normalizeWalletAddress", () => {
      it("should lowercase and trim addresses", () => {
        expect(normalizeWalletAddress("0xABCDEF1234567890123456789012345678901234")).toBe(
          "0xabcdef1234567890123456789012345678901234"
        );
        expect(normalizeWalletAddress("  0x1234567890123456789012345678901234567890  ")).toBe(
          "0x1234567890123456789012345678901234567890"
        );
      });
    });
  });

  describe("getTradesByWallet", () => {
    const validWallet = "0x1234567890123456789012345678901234567890";
    const validWallet2 = "0xabcdef1234567890123456789012345678901234";

    it("should fetch trades for a valid wallet address", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            asset_id: "token123",
            taker_address: validWallet,
            maker_address: validWallet2,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade2",
            asset_id: "token456",
            taker_address: validWallet2,
            maker_address: validWallet,
            side: "sell",
            price: "0.60",
            size: "200",
            created_at: "2026-01-09T23:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { client });

      expect(result).not.toBeNull();
      expect(result?.trades).toHaveLength(2);
      expect(result?.count).toBe(2);
      expect(result?.walletAddress).toBe(validWallet.toLowerCase());
      expect(result?.role).toBe("both");
      expect(result?.fetchedAt).toBeDefined();
    });

    it("should filter trades by maker role", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            taker_address: validWallet,
            maker_address: validWallet2,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade2",
            taker_address: validWallet2,
            maker_address: validWallet,
            side: "sell",
            price: "0.60",
            size: "200",
            created_at: "2026-01-09T23:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { role: "maker", client });

      expect(result?.trades).toHaveLength(1);
      expect(result?.trades[0]?.maker_address?.toLowerCase()).toBe(validWallet.toLowerCase());
      expect(result?.role).toBe("maker");
    });

    it("should filter trades by taker role", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            taker_address: validWallet,
            maker_address: validWallet2,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade2",
            taker_address: validWallet2,
            maker_address: validWallet,
            side: "sell",
            price: "0.60",
            size: "200",
            created_at: "2026-01-09T23:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { role: "taker", client });

      expect(result?.trades).toHaveLength(1);
      expect(result?.trades[0]?.taker_address?.toLowerCase()).toBe(validWallet.toLowerCase());
      expect(result?.role).toBe("taker");
    });

    it("should return null for invalid wallet address", async () => {
      const client = new ClobClient();
      const result = await getTradesByWallet("invalid-address", { client });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for empty wallet address", async () => {
      const client = new ClobClient();
      const result = await getTradesByWallet("", { client });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only wallet address", async () => {
      const client = new ClobClient();
      const result = await getTradesByWallet("   ", { client });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle pagination cursor", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            taker_address: validWallet,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
        ],
        next_cursor: "abc123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { client });

      expect(result?.nextCursor).toBe("abc123");
      expect(result?.hasMore).toBe(true);
    });

    it("should include cursor in request when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getTradesByWallet(validWallet, { cursor: "mycursor123", client });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain("cursor=mycursor123");
    });

    it("should include token_id filter when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getTradesByWallet(validWallet, { tokenId: "token123", client });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain("token_id=token123");
    });

    it("should include time filters when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      await getTradesByWallet(validWallet, {
        startTime: "2026-01-01T00:00:00Z",
        endTime: new Date("2026-01-10T00:00:00Z"),
        client,
      });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain("start_ts=2026-01-01T00%3A00%3A00Z");
      expect(url).toContain("end_ts=");
    });

    it("should handle 404 response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve('{"message": "Wallet not found"}'),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { client });

      expect(result).not.toBeNull();
      expect(result?.trades).toHaveLength(0);
      expect(result?.count).toBe(0);
    });

    it("should throw on server error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve('{"message": "Server error"}'),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(getTradesByWallet(validWallet, { client })).rejects.toThrow(ClobApiException);
    });

    it("should sort trades by timestamp descending", async () => {
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            taker_address: validWallet,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-09T20:00:00Z",
          },
          {
            id: "trade2",
            taker_address: validWallet,
            side: "sell",
            price: "0.60",
            size: "200",
            created_at: "2026-01-10T00:00:00Z",
          },
          {
            id: "trade3",
            taker_address: validWallet,
            side: "buy",
            price: "0.53",
            size: "300",
            created_at: "2026-01-09T22:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { client });

      expect(result?.trades[0]?.id).toBe("trade2"); // Most recent
      expect(result?.trades[1]?.id).toBe("trade3");
      expect(result?.trades[2]?.id).toBe("trade1"); // Oldest
    });

    it("should apply limit parameter", async () => {
      const mockResponse = {
        trades: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: `trade${i}`,
            taker_address: validWallet,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: `2026-01-10T${String(i).padStart(2, "0")}:00:00Z`,
          })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(validWallet, { limit: 10, client });

      expect(result?.count).toBe(10);
      expect(result?.trades).toHaveLength(10);
    });

    it("should normalize wallet address (case-insensitive)", async () => {
      const upperCaseWallet = "0xABCDEF1234567890123456789012345678901234";
      const mockResponse = {
        trades: [
          {
            id: "trade1",
            taker_address: upperCaseWallet.toLowerCase(),
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: "2026-01-10T00:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await getTradesByWallet(upperCaseWallet, { client });

      expect(result?.walletAddress).toBe(upperCaseWallet.toLowerCase());
      expect(result?.trades).toHaveLength(1);
    });
  });

  describe("getAllTradesByWallet", () => {
    const validWallet = "0x1234567890123456789012345678901234567890";

    it("should fetch all trades with automatic pagination", async () => {
      // First page with next_cursor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade1", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T02:00:00Z" },
                { id: "trade2", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T01:00:00Z" },
              ],
              next_cursor: "cursor1",
            })
          ),
      });

      // Second page without next_cursor (last page)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade3", taker_address: validWallet, side: "sell", price: "0.6", size: "20", created_at: "2026-01-10T00:00:00Z" },
              ],
            })
          ),
      });

      const client = new ClobClient();
      const trades = await getAllTradesByWallet(validWallet, { client });

      expect(trades).not.toBeNull();
      expect(trades).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return null for invalid wallet address", async () => {
      const client = new ClobClient();
      const trades = await getAllTradesByWallet("invalid", { client });

      expect(trades).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should respect maxTrades limit", async () => {
      const mockResponse = {
        trades: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: `trade${i}`,
            taker_address: validWallet,
            side: "buy",
            price: "0.55",
            size: "100",
            created_at: `2026-01-10T${String(i % 24).padStart(2, "0")}:00:00Z`,
          })),
        next_cursor: "next",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const trades = await getAllTradesByWallet(validWallet, { maxTrades: 150, client });

      // Should stop after reaching maxTrades
      expect(trades).not.toBeNull();
      expect(trades!.length).toBeLessThanOrEqual(150);
    });
  });

  describe("getWalletActivitySummary", () => {
    const validWallet = "0x1234567890123456789012345678901234567890";
    const validWallet2 = "0xabcdef1234567890123456789012345678901234";

    const createTestTrade = (overrides: Partial<Trade> = {}): Trade => ({
      id: "trade1",
      asset_id: "token123",
      side: "buy",
      price: "0.55",
      size: "100",
      created_at: "2026-01-10T00:00:00Z",
      ...overrides,
    });

    it("should calculate activity summary correctly", () => {
      const trades: Trade[] = [
        createTestTrade({
          id: "1",
          asset_id: "token1",
          taker_address: validWallet,
          maker_address: validWallet2,
          side: "buy",
          size: "100",
          created_at: "2026-01-10T00:00:00Z",
        }),
        createTestTrade({
          id: "2",
          asset_id: "token2",
          taker_address: validWallet2,
          maker_address: validWallet,
          side: "sell",
          size: "200",
          created_at: "2026-01-09T00:00:00Z",
        }),
        createTestTrade({
          id: "3",
          asset_id: "token1",
          taker_address: validWallet,
          maker_address: validWallet2,
          side: "buy",
          size: "150",
          created_at: "2026-01-11T00:00:00Z",
        }),
      ];

      const summary = getWalletActivitySummary(trades, validWallet);

      expect(summary.walletAddress).toBe(validWallet.toLowerCase());
      expect(summary.totalTrades).toBe(3);
      expect(summary.tradesAsMaker).toBe(1);
      expect(summary.tradesAsTaker).toBe(2);
      expect(summary.totalVolume).toBe(450);
      expect(summary.volumeAsMaker).toBe(200);
      expect(summary.volumeAsTaker).toBe(250);
      expect(summary.buyTrades).toBe(2);
      expect(summary.sellTrades).toBe(1);
      expect(summary.uniqueTokens.size).toBe(2);
      expect(summary.firstTradeAt).toBe("2026-01-09T00:00:00Z");
      expect(summary.lastTradeAt).toBe("2026-01-11T00:00:00Z");
    });

    it("should handle empty trades array", () => {
      const summary = getWalletActivitySummary([], validWallet);

      expect(summary.totalTrades).toBe(0);
      expect(summary.totalVolume).toBe(0);
      expect(summary.uniqueTokens.size).toBe(0);
    });

    it("should handle invalid size values", () => {
      const trades: Trade[] = [
        createTestTrade({ taker_address: validWallet, size: "invalid" }),
        createTestTrade({ taker_address: validWallet, size: "100" }),
      ];

      const summary = getWalletActivitySummary(trades, validWallet);

      expect(summary.totalVolume).toBe(100);
    });
  });

  describe("hasWalletTraded", () => {
    const validWallet = "0x1234567890123456789012345678901234567890";

    it("should return true when wallet has trades", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade1", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" },
              ],
            })
          ),
      });

      const client = new ClobClient();
      const result = await hasWalletTraded(validWallet, { client });

      expect(result).toBe(true);
    });

    it("should return false when wallet has no trades", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      const result = await hasWalletTraded(validWallet, { client });

      expect(result).toBe(false);
    });

    it("should return false for invalid wallet address", async () => {
      const client = new ClobClient();
      const result = await hasWalletTraded("invalid", { client });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getFirstWalletTrade", () => {
    const validWallet = "0x1234567890123456789012345678901234567890";

    it("should return the oldest trade", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade3", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" },
                { id: "trade2", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-09T00:00:00Z" },
                { id: "trade1", taker_address: validWallet, side: "buy", price: "0.5", size: "10", created_at: "2026-01-08T00:00:00Z" },
              ],
            })
          ),
      });

      const client = new ClobClient();
      const trade = await getFirstWalletTrade(validWallet, { client });

      expect(trade).not.toBeNull();
      expect(trade?.id).toBe("trade1");
      expect(trade?.created_at).toBe("2026-01-08T00:00:00Z");
    });

    it("should return null when wallet has no trades", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ trades: [] })),
      });

      const client = new ClobClient();
      const trade = await getFirstWalletTrade(validWallet, { client });

      expect(trade).toBeNull();
    });

    it("should return null for invalid wallet address", async () => {
      const client = new ClobClient();
      const trade = await getFirstWalletTrade("invalid", { client });

      expect(trade).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getTradesBetweenWallets", () => {
    const walletA = "0x1111111111111111111111111111111111111111";
    const walletB = "0x2222222222222222222222222222222222222222";
    const walletC = "0x3333333333333333333333333333333333333333";

    it("should find trades between two wallets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade1", taker_address: walletA, maker_address: walletB, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" },
                { id: "trade2", taker_address: walletB, maker_address: walletA, side: "sell", price: "0.6", size: "20", created_at: "2026-01-09T00:00:00Z" },
                { id: "trade3", taker_address: walletA, maker_address: walletC, side: "buy", price: "0.5", size: "15", created_at: "2026-01-08T00:00:00Z" },
              ],
            })
          ),
      });

      const client = new ClobClient();
      const trades = await getTradesBetweenWallets(walletA, walletB, { client });

      expect(trades).toHaveLength(2);
      expect(trades[0]?.id).toBe("trade1");
      expect(trades[1]?.id).toBe("trade2");
    });

    it("should return empty array for invalid wallet addresses", async () => {
      const client = new ClobClient();
      const trades = await getTradesBetweenWallets("invalid", walletB, { client });

      expect(trades).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return empty array when same wallet is provided for both", async () => {
      const client = new ClobClient();
      const trades = await getTradesBetweenWallets(walletA, walletA, { client });

      expect(trades).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return empty array when no trades exist between wallets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trades: [
                { id: "trade1", taker_address: walletA, maker_address: walletC, side: "buy", price: "0.5", size: "10", created_at: "2026-01-10T00:00:00Z" },
              ],
            })
          ),
      });

      const client = new ClobClient();
      const trades = await getTradesBetweenWallets(walletA, walletB, { client });

      expect(trades).toHaveLength(0);
    });
  });
});
