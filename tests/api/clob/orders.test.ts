/**
 * Tests for Polymarket CLOB API orders functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getOpenOrders,
  getAllOpenOrders,
  getOpenOrdersSummary,
  hasOpenOrders,
  getOpenOrdersForMarket,
  calculateOpenOrdersValue,
  calculateRemainingOrdersValue,
  getOrderRemainingSize,
  getOrderFillPercentage,
  filterOrdersByMinRemainingSize,
  groupOrdersByToken,
  groupOrdersBySide,
} from "../../../src/api/clob/orders";
import { ClobClient, ClobApiException } from "../../../src/api/clob/client";
import { Order } from "../../../src/api/clob/types";

describe("CLOB Orders API", () => {
  let mockClient: ClobClient;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGet = vi.fn();
    mockClient = {
      get: mockGet,
      hasCredentials: vi.fn().mockReturnValue(false),
    } as unknown as ClobClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Sample orders for testing
  const createSampleOrder = (overrides: Partial<Order> = {}): Order => ({
    id: "order-123",
    asset_id: "token-abc",
    maker_address: "0x1234567890123456789012345678901234567890",
    side: "BUY",
    price: "0.5",
    original_size: "100",
    size_matched: "25",
    order_type: "GTC",
    status: "live",
    created_at: "2026-01-01T12:00:00Z",
    ...overrides,
  });

  describe("getOpenOrders", () => {
    it("should fetch open orders for a valid wallet address", async () => {
      const mockOrders = [
        createSampleOrder({ id: "order-1", created_at: "2026-01-02T12:00:00Z" }),
        createSampleOrder({ id: "order-2", created_at: "2026-01-01T12:00:00Z" }),
      ];

      mockGet.mockResolvedValueOnce({ orders: mockOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).not.toBeNull();
      expect(result?.orders).toHaveLength(2);
      expect(result?.count).toBe(2);
      expect(result?.walletAddress).toBe("0x1234567890123456789012345678901234567890");
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/orders?"),
        expect.objectContaining({ requiresAuth: false })
      );
    });

    it("should return null for invalid wallet address", async () => {
      const result = await getOpenOrders("invalid-address", { client: mockClient });
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return null for empty wallet address", async () => {
      const result = await getOpenOrders("", { client: mockClient });
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return null for whitespace-only wallet address", async () => {
      const result = await getOpenOrders("   ", { client: mockClient });
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should include owner parameter in query string", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("owner=0x1234567890123456789012345678901234567890"),
        expect.any(Object)
      );
    });

    it("should include status=live parameter in query string", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("status=live"),
        expect.any(Object)
      );
    });

    it("should include limit parameter in query string", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        limit: 50,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.any(Object)
      );
    });

    it("should clamp limit to maximum of 1000", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        limit: 5000,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("limit=1000"),
        expect.any(Object)
      );
    });

    it("should clamp limit to minimum of 1", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        limit: -10,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("limit=1"),
        expect.any(Object)
      );
    });

    it("should include cursor parameter when provided", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        cursor: "abc123",
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("cursor=abc123"),
        expect.any(Object)
      );
    });

    it("should include asset_id parameter when tokenId provided", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        tokenId: "token-123",
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("asset_id=token-123"),
        expect.any(Object)
      );
    });

    it("should use assetId as fallback when tokenId not provided", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        assetId: "asset-456",
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("asset_id=asset-456"),
        expect.any(Object)
      );
    });

    it("should include side parameter when provided", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        side: "SELL",
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("side=SELL"),
        expect.any(Object)
      );
    });

    it("should handle array response format", async () => {
      const mockOrders = [createSampleOrder()];
      mockGet.mockResolvedValueOnce(mockOrders);

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders).toHaveLength(1);
    });

    it("should handle data array response format", async () => {
      const mockOrders = [createSampleOrder()];
      mockGet.mockResolvedValueOnce({ data: mockOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders).toHaveLength(1);
    });

    it("should handle empty orders response", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders).toHaveLength(0);
      expect(result?.count).toBe(0);
    });

    it("should filter out non-live orders", async () => {
      const mockOrders = [
        createSampleOrder({ id: "live-order", status: "live" }),
        createSampleOrder({ id: "matched-order", status: "matched" }),
        createSampleOrder({ id: "cancelled-order", status: "cancelled" }),
      ];
      mockGet.mockResolvedValueOnce({ orders: mockOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders).toHaveLength(1);
      expect(result?.orders[0]?.id).toBe("live-order");
    });

    it("should client-side filter by side when provided", async () => {
      const mockOrders = [
        createSampleOrder({ id: "buy-order", side: "BUY" }),
        createSampleOrder({ id: "sell-order", side: "SELL" }),
      ];
      mockGet.mockResolvedValueOnce({ orders: mockOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        side: "BUY",
      });

      expect(result?.orders).toHaveLength(1);
      expect(result?.orders[0]?.side).toBe("BUY");
    });

    it("should sort orders by created_at descending", async () => {
      const mockOrders = [
        createSampleOrder({ id: "older", created_at: "2026-01-01T12:00:00Z" }),
        createSampleOrder({ id: "newer", created_at: "2026-01-02T12:00:00Z" }),
      ];
      mockGet.mockResolvedValueOnce({ orders: mockOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]?.id).toBe("newer");
      expect(result?.orders[1]?.id).toBe("older");
    });

    it("should return nextCursor from response", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [createSampleOrder()],
        next_cursor: "next-page-token",
      });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.nextCursor).toBe("next-page-token");
      expect(result?.hasMore).toBe(true);
    });

    it("should return empty result for 404 error", async () => {
      mockGet.mockRejectedValueOnce(
        new ClobApiException({ message: "Not found", statusCode: 404 })
      );

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).not.toBeNull();
      expect(result?.orders).toHaveLength(0);
      expect(result?.count).toBe(0);
    });

    it("should throw for other API errors", async () => {
      mockGet.mockRejectedValueOnce(
        new ClobApiException({ message: "Server error", statusCode: 500 })
      );

      await expect(
        getOpenOrders("0x1234567890123456789012345678901234567890", {
          client: mockClient,
        })
      ).rejects.toThrow(ClobApiException);
    });

    it("should normalize wallet address to lowercase", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      const result = await getOpenOrders("0xABCDEF1234567890123456789012345678901234", {
        client: mockClient,
      });

      expect(result?.walletAddress).toBe("0xabcdef1234567890123456789012345678901234");
    });

    it("should parse various order response formats", async () => {
      const rawOrders = [
        {
          order_id: "id-1",
          token_id: "token-1",
          maker: "0x1234567890123456789012345678901234567890",
          side: "buy",
          price: "0.75",
          size: "200",
          filled_size: "50",
          type: "gtc",
          state: "live",
          timestamp: 1704067200000, // Unix milliseconds
        },
      ];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]).toMatchObject({
        id: "id-1",
        asset_id: "token-1",
        side: "BUY",
        price: "0.75",
        original_size: "200",
        size_matched: "50",
        status: "live",
      });
    });

    it("should set hasMore based on nextCursor", async () => {
      mockGet.mockResolvedValueOnce({ orders: [], next_cursor: "abc" });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.hasMore).toBe(true);
    });

    it("should use authentication when client has credentials", async () => {
      const authMockClient = {
        get: mockGet,
        hasCredentials: vi.fn().mockReturnValue(true),
      } as unknown as ClobClient;

      mockGet.mockResolvedValueOnce({ orders: [] });

      await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: authMockClient,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ requiresAuth: true })
      );
    });
  });

  describe("getAllOpenOrders", () => {
    it("should fetch all open orders with pagination", async () => {
      const page1Orders = [createSampleOrder({ id: "order-1" })];
      const page2Orders = [createSampleOrder({ id: "order-2" })];

      mockGet
        .mockResolvedValueOnce({ orders: page1Orders, next_cursor: "page2" })
        .mockResolvedValueOnce({ orders: page2Orders });

      const result = await getAllOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("should return null for invalid wallet address", async () => {
      const result = await getAllOpenOrders("invalid", { client: mockClient });
      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should respect maxOrders limit", async () => {
      const orders = Array.from({ length: 100 }, (_, i) =>
        createSampleOrder({ id: `order-${i}` })
      );

      mockGet.mockResolvedValueOnce({ orders, next_cursor: "more" });

      const result = await getAllOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
        maxOrders: 50,
      });

      // Should stop after first page due to maxOrders
      expect(result?.length).toBeLessThanOrEqual(50);
    });

    it("should handle empty results", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      const result = await getAllOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).toEqual([]);
    });
  });

  describe("getOpenOrdersSummary", () => {
    it("should calculate correct summary for orders", () => {
      const orders = [
        createSampleOrder({
          id: "buy-1",
          side: "BUY",
          price: "0.5",
          original_size: "100",
          asset_id: "token-1",
          created_at: "2026-01-01T12:00:00Z",
        }),
        createSampleOrder({
          id: "sell-1",
          side: "SELL",
          price: "0.6",
          original_size: "50",
          asset_id: "token-2",
          created_at: "2026-01-02T12:00:00Z",
        }),
        createSampleOrder({
          id: "buy-2",
          side: "BUY",
          price: "0.4",
          original_size: "200",
          asset_id: "token-1",
          created_at: "2026-01-03T12:00:00Z",
        }),
      ];

      const summary = getOpenOrdersSummary(
        orders,
        "0x1234567890123456789012345678901234567890"
      );

      expect(summary.totalOrders).toBe(3);
      expect(summary.buyOrders).toBe(2);
      expect(summary.sellOrders).toBe(1);
      expect(summary.totalBuyValue).toBe(0.5 * 100 + 0.4 * 200); // 130
      expect(summary.totalSellValue).toBe(0.6 * 50); // 30
      expect(summary.totalSize).toBe(350);
      expect(summary.uniqueTokens.size).toBe(2);
      expect(summary.oldestOrderAt).toBe("2026-01-01T12:00:00Z");
      expect(summary.newestOrderAt).toBe("2026-01-03T12:00:00Z");
    });

    it("should track order types", () => {
      const orders = [
        createSampleOrder({ order_type: "GTC" }),
        createSampleOrder({ order_type: "GTC" }),
        createSampleOrder({ order_type: "FOK" }),
      ];

      const summary = getOpenOrdersSummary(
        orders,
        "0x1234567890123456789012345678901234567890"
      );

      expect(summary.orderTypes.get("GTC")).toBe(2);
      expect(summary.orderTypes.get("FOK")).toBe(1);
    });

    it("should handle empty orders array", () => {
      const summary = getOpenOrdersSummary(
        [],
        "0x1234567890123456789012345678901234567890"
      );

      expect(summary.totalOrders).toBe(0);
      expect(summary.buyOrders).toBe(0);
      expect(summary.sellOrders).toBe(0);
      expect(summary.totalBuyValue).toBe(0);
      expect(summary.totalSellValue).toBe(0);
    });

    it("should handle invalid price/size values", () => {
      const orders = [
        createSampleOrder({ price: "invalid", original_size: "100" }),
        createSampleOrder({ price: "0.5", original_size: "invalid" }),
      ];

      const summary = getOpenOrdersSummary(
        orders,
        "0x1234567890123456789012345678901234567890"
      );

      expect(summary.totalOrders).toBe(2);
      expect(summary.totalBuyValue).toBe(0);
    });
  });

  describe("hasOpenOrders", () => {
    it("should return true when wallet has open orders", async () => {
      mockGet.mockResolvedValueOnce({ orders: [createSampleOrder()] });

      const result = await hasOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).toBe(true);
    });

    it("should return false when wallet has no open orders", async () => {
      mockGet.mockResolvedValueOnce({ orders: [] });

      const result = await hasOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result).toBe(false);
    });

    it("should return false for invalid address", async () => {
      const result = await hasOpenOrders("invalid", { client: mockClient });
      expect(result).toBe(false);
    });
  });

  describe("getOpenOrdersForMarket", () => {
    it("should fetch orders for specific market", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [createSampleOrder({ asset_id: "token-123" })],
      });

      const result = await getOpenOrdersForMarket(
        "0x1234567890123456789012345678901234567890",
        "token-123",
        { client: mockClient }
      );

      expect(result).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("asset_id=token-123"),
        expect.any(Object)
      );
    });

    it("should return null for empty tokenId", async () => {
      const result = await getOpenOrdersForMarket(
        "0x1234567890123456789012345678901234567890",
        "",
        { client: mockClient }
      );

      expect(result).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should return null for whitespace tokenId", async () => {
      const result = await getOpenOrdersForMarket(
        "0x1234567890123456789012345678901234567890",
        "   ",
        { client: mockClient }
      );

      expect(result).toBeNull();
    });
  });

  describe("calculateOpenOrdersValue", () => {
    it("should calculate total value of orders", () => {
      const orders = [
        createSampleOrder({ price: "0.5", original_size: "100" }),
        createSampleOrder({ price: "0.3", original_size: "200" }),
      ];

      const value = calculateOpenOrdersValue(orders);
      expect(value).toBe(0.5 * 100 + 0.3 * 200); // 110
    });

    it("should handle invalid values", () => {
      const orders = [
        createSampleOrder({ price: "invalid", original_size: "100" }),
        createSampleOrder({ price: "0.5", original_size: "100" }),
      ];

      const value = calculateOpenOrdersValue(orders);
      expect(value).toBe(50);
    });

    it("should return 0 for empty array", () => {
      const value = calculateOpenOrdersValue([]);
      expect(value).toBe(0);
    });
  });

  describe("calculateRemainingOrdersValue", () => {
    it("should calculate remaining (unfilled) value", () => {
      const orders = [
        createSampleOrder({
          price: "0.5",
          original_size: "100",
          size_matched: "25",
        }), // 75 remaining
        createSampleOrder({
          price: "0.4",
          original_size: "50",
          size_matched: "10",
        }), // 40 remaining
      ];

      const value = calculateRemainingOrdersValue(orders);
      expect(value).toBe(0.5 * 75 + 0.4 * 40); // 53.5
    });

    it("should handle orders with no matched size", () => {
      const orders = [
        createSampleOrder({
          price: "0.5",
          original_size: "100",
          size_matched: "0",
        }),
      ];

      const value = calculateRemainingOrdersValue(orders);
      expect(value).toBe(50);
    });
  });

  describe("getOrderRemainingSize", () => {
    it("should calculate remaining size", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "30",
      });

      expect(getOrderRemainingSize(order)).toBe(70);
    });

    it("should return full size when nothing matched", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "0",
      });

      expect(getOrderRemainingSize(order)).toBe(100);
    });

    it("should handle invalid original_size", () => {
      const order = createSampleOrder({
        original_size: "invalid",
        size_matched: "30",
      });

      expect(getOrderRemainingSize(order)).toBe(0);
    });

    it("should handle invalid size_matched", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "invalid",
      });

      expect(getOrderRemainingSize(order)).toBe(100);
    });
  });

  describe("getOrderFillPercentage", () => {
    it("should calculate fill percentage", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "25",
      });

      expect(getOrderFillPercentage(order)).toBe(25);
    });

    it("should return 0 for unfilled order", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "0",
      });

      expect(getOrderFillPercentage(order)).toBe(0);
    });

    it("should return 0 for zero original_size", () => {
      const order = createSampleOrder({
        original_size: "0",
        size_matched: "0",
      });

      expect(getOrderFillPercentage(order)).toBe(0);
    });

    it("should return 100 for fully filled order", () => {
      const order = createSampleOrder({
        original_size: "100",
        size_matched: "100",
      });

      expect(getOrderFillPercentage(order)).toBe(100);
    });
  });

  describe("filterOrdersByMinRemainingSize", () => {
    it("should filter orders by minimum remaining size", () => {
      const orders = [
        createSampleOrder({
          id: "1",
          original_size: "100",
          size_matched: "30",
        }), // 70 remaining
        createSampleOrder({
          id: "2",
          original_size: "50",
          size_matched: "40",
        }), // 10 remaining
        createSampleOrder({
          id: "3",
          original_size: "200",
          size_matched: "0",
        }), // 200 remaining
      ];

      const filtered = filterOrdersByMinRemainingSize(orders, 50);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((o) => o.id)).toEqual(["1", "3"]);
    });

    it("should return empty array when no orders meet threshold", () => {
      const orders = [
        createSampleOrder({ original_size: "10", size_matched: "5" }),
      ];

      const filtered = filterOrdersByMinRemainingSize(orders, 100);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("groupOrdersByToken", () => {
    it("should group orders by token ID", () => {
      const orders = [
        createSampleOrder({ id: "1", asset_id: "token-a" }),
        createSampleOrder({ id: "2", asset_id: "token-b" }),
        createSampleOrder({ id: "3", asset_id: "token-a" }),
      ];

      const grouped = groupOrdersByToken(orders);

      expect(grouped.size).toBe(2);
      expect(grouped.get("token-a")).toHaveLength(2);
      expect(grouped.get("token-b")).toHaveLength(1);
    });

    it("should skip orders without asset_id", () => {
      const orders = [
        createSampleOrder({ id: "1", asset_id: "token-a" }),
        createSampleOrder({ id: "2", asset_id: "" }),
      ];

      const grouped = groupOrdersByToken(orders);

      expect(grouped.size).toBe(1);
      expect(grouped.get("token-a")).toHaveLength(1);
    });
  });

  describe("groupOrdersBySide", () => {
    it("should group orders by side", () => {
      const orders = [
        createSampleOrder({ id: "1", side: "BUY" }),
        createSampleOrder({ id: "2", side: "SELL" }),
        createSampleOrder({ id: "3", side: "BUY" }),
      ];

      const grouped = groupOrdersBySide(orders);

      expect(grouped.buy).toHaveLength(2);
      expect(grouped.sell).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const grouped = groupOrdersBySide([]);

      expect(grouped.buy).toHaveLength(0);
      expect(grouped.sell).toHaveLength(0);
    });
  });

  describe("order parsing", () => {
    it("should parse SELL side correctly", async () => {
      const rawOrders = [{ id: "1", side: "sell", status: "live" }];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]?.side).toBe("SELL");
    });

    it("should parse ASK as SELL", async () => {
      const rawOrders = [{ id: "1", side: "ask", status: "live" }];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]?.side).toBe("SELL");
    });

    it("should parse various status values", async () => {
      const rawOrders = [
        { id: "1", status: "live" },
        { id: "2", state: "live" },
        { id: "3", status: "matched" },
        { id: "4", status: "cancelled" },
        { id: "5", status: "expired" },
      ];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      // Should only include live orders
      expect(result?.orders).toHaveLength(2);
    });

    it("should parse Unix timestamp (seconds)", async () => {
      const rawOrders = [{ id: "1", timestamp: 1704067200, status: "live" }];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]?.created_at).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should parse Unix timestamp (milliseconds)", async () => {
      const rawOrders = [{ id: "1", timestamp: 1704067200000, status: "live" }];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders[0]?.created_at).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should parse order types correctly", async () => {
      const rawOrders = [
        { id: "1", type: "gtc", status: "live" },
        { id: "2", order_type: "FOK", status: "live" },
        { id: "3", type: "ioc", status: "live" },
        { id: "4", type: "GTD", status: "live" },
      ];
      mockGet.mockResolvedValueOnce({ orders: rawOrders });

      const result = await getOpenOrders("0x1234567890123456789012345678901234567890", {
        client: mockClient,
      });

      expect(result?.orders.map((o) => o.order_type)).toContain("GTC");
      expect(result?.orders.map((o) => o.order_type)).toContain("FOK");
      expect(result?.orders.map((o) => o.order_type)).toContain("IOC");
      expect(result?.orders.map((o) => o.order_type)).toContain("GTD");
    });
  });
});
