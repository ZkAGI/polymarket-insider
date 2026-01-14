/**
 * Dashboard Stats API Unit Tests
 *
 * Tests for the /api/dashboard/stats endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Dashboard Stats API - GET /api/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset modules to clear the cache in the route module
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupMocksAndGetHandler(mocks: {
    alertCount?: number[];
    alertGroupBy?: { marketId: string | null }[][];
    walletCount?: number[];
    tradeAggregate?: { _sum: { usdValue: number | null } }[];
    tradeCount?: number[];
    shouldThrow?: boolean;
  }) {
    const alertCountMock = vi.fn();
    const alertGroupByMock = vi.fn();
    const walletCountMock = vi.fn();
    const tradeAggregateMock = vi.fn();
    const tradeCountMock = vi.fn();

    // Setup mock values
    if (mocks.shouldThrow) {
      alertCountMock.mockRejectedValue(new Error("Database error"));
    } else {
      const alertCounts = mocks.alertCount ?? [0, 0, 0, 0];
      alertCounts.forEach(val => alertCountMock.mockResolvedValueOnce(val));

      const groupBys = mocks.alertGroupBy ?? [[], []];
      groupBys.forEach(val => alertGroupByMock.mockResolvedValueOnce(val));

      const walletCounts = mocks.walletCount ?? [0, 0];
      walletCounts.forEach(val => walletCountMock.mockResolvedValueOnce(val));

      const aggregates = mocks.tradeAggregate ?? [{ _sum: { usdValue: null } }, { _sum: { usdValue: null } }];
      aggregates.forEach(val => tradeAggregateMock.mockResolvedValueOnce(val));

      const tradeCounts = mocks.tradeCount ?? [0, 0];
      tradeCounts.forEach(val => tradeCountMock.mockResolvedValueOnce(val));
    }

    vi.doMock("@/db/client", () => ({
      prisma: {
        alert: {
          count: alertCountMock,
          groupBy: alertGroupByMock,
        },
        wallet: {
          count: walletCountMock,
        },
        trade: {
          aggregate: tradeAggregateMock,
          count: tradeCountMock,
        },
      },
    }));

    const { GET } = await import("@/app/api/dashboard/stats/route");
    return { GET, alertCountMock, alertGroupByMock, walletCountMock, tradeAggregateMock, tradeCountMock };
  }

  describe("Basic Response", () => {
    it("should return dashboard stats with correct structure", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [50, 10, 25, 5],
        walletCount: [15, 10],
        alertGroupBy: [[{ marketId: "1" }, { marketId: "2" }, { marketId: "3" }], [{ marketId: "1" }, { marketId: "2" }]],
        tradeAggregate: [{ _sum: { usdValue: 1000000 } }, { _sum: { usdValue: 800000 } }],
        tradeCount: [20, 15],
      });

      const response = await GET();
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty("alerts");
      expect(data).toHaveProperty("criticalAlerts");
      expect(data).toHaveProperty("suspiciousWallets");
      expect(data).toHaveProperty("hotMarkets");
      expect(data).toHaveProperty("volume24h");
      expect(data).toHaveProperty("whaleTrades");
      expect(data).toHaveProperty("trends");
      expect(data).toHaveProperty("generatedAt");

      // Verify trend structure
      expect(data.trends).toHaveProperty("alerts");
      expect(data.trends).toHaveProperty("criticalAlerts");
      expect(data.trends).toHaveProperty("suspiciousWallets");
      expect(data.trends).toHaveProperty("hotMarkets");
      expect(data.trends).toHaveProperty("volume24h");
      expect(data.trends).toHaveProperty("whaleTrades");
    });

    it("should return correct values from database queries", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [100, 25, 50, 10],
        walletCount: [30, 20],
        alertGroupBy: [
          [{ marketId: "1" }, { marketId: "2" }, { marketId: "3" }, { marketId: "4" }, { marketId: "5" }],
          [{ marketId: "1" }, { marketId: "2" }],
        ],
        tradeAggregate: [{ _sum: { usdValue: 2500000 } }, { _sum: { usdValue: 2000000 } }],
        tradeCount: [45, 30],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.alerts).toBe(100);
      expect(data.criticalAlerts).toBe(25);
      expect(data.suspiciousWallets).toBe(30);
      expect(data.hotMarkets).toBe(5);
      expect(data.volume24h).toBe(2500000);
      expect(data.whaleTrades).toBe(45);
    });

    it("should return 200 status code on success", async () => {
      const { GET } = await setupMocksAndGetHandler({});

      const response = await GET();

      expect(response.status).toBe(200);
    });
  });

  describe("Trend Calculations", () => {
    it("should calculate positive trend correctly", async () => {
      // Current: 100, Previous: 50 = 100% increase
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [100, 20, 50, 10],
        walletCount: [10, 10],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 0 } }, { _sum: { usdValue: 0 } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.trends.alerts).toBe(100); // (100-50)/50 * 100 = 100%
    });

    it("should calculate negative trend correctly", async () => {
      // Current: 25, Previous: 100 = -75% decrease
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [25, 5, 100, 20],
        walletCount: [10, 10],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 0 } }, { _sum: { usdValue: 0 } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.trends.alerts).toBe(-75); // (25-100)/100 * 100 = -75%
    });

    it("should handle zero previous value for trend", async () => {
      // Current: 50, Previous: 0 = 100% increase (edge case)
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [50, 10, 0, 0],
        walletCount: [10, 10],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 0 } }, { _sum: { usdValue: 0 } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.trends.alerts).toBe(100); // When previous is 0 and current > 0, return 100%
    });

    it("should handle zero current and previous for trend", async () => {
      // Current: 0, Previous: 0 = 0% change
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [0, 0, 0, 0],
        walletCount: [0, 0],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 0 } }, { _sum: { usdValue: 0 } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.trends.alerts).toBe(0);
    });

    it("should calculate volume trend correctly", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [0, 0, 0, 0],
        walletCount: [0, 0],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 1500000 } }, { _sum: { usdValue: 1000000 } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.trends.volume24h).toBe(50); // (1.5M - 1M) / 1M * 100 = 50%
    });
  });

  describe("Edge Cases", () => {
    it("should handle null volume correctly", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [0, 0, 0, 0],
        walletCount: [0, 0],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: null } }, { _sum: { usdValue: null } }],
        tradeCount: [0, 0],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.volume24h).toBe(0);
    });

    it("should include generatedAt timestamp", async () => {
      const now = new Date("2026-01-14T12:00:00.000Z");
      vi.setSystemTime(now);

      const { GET } = await setupMocksAndGetHandler({});

      const response = await GET();
      const data = await response.json();

      expect(data.generatedAt).toBe("2026-01-14T12:00:00.000Z");
    });

    it("should handle empty hot markets", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [10, 5, 5, 3],
        walletCount: [5, 3],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 1000 } }, { _sum: { usdValue: 500 } }],
        tradeCount: [2, 1],
      });

      const response = await GET();
      const data = await response.json();

      expect(data.hotMarkets).toBe(0);
    });
  });

  describe("Response Headers", () => {
    it("should include Cache-Control header", async () => {
      const { GET } = await setupMocksAndGetHandler({});

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=30, stale-while-revalidate=60"
      );
    });

    it("should include X-Cache header indicating cache miss on first request", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET } = await setupMocksAndGetHandler({});

      const response = await GET();

      expect(response.headers.get("X-Cache")).toBe("MISS");
    });

    it("should return cache HIT on subsequent requests within TTL", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, alertCountMock } = await setupMocksAndGetHandler({
        alertCount: [10, 5, 5, 3],
        walletCount: [5, 3],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 1000 } }, { _sum: { usdValue: 500 } }],
        tradeCount: [2, 1],
      });

      // First request
      const response1 = await GET();
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request within 30s TTL
      vi.setSystemTime(new Date("2026-01-14T12:00:15.000Z"));
      const response2 = await GET();
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // The alertCountMock should only be called 4 times (for the first request)
      expect(alertCountMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 status on database error when no cache available", async () => {
      const { GET } = await setupMocksAndGetHandler({
        shouldThrow: true,
      });

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });
  });

  describe("Data Types", () => {
    it("should return numeric values for all stats", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [42, 10, 20, 5],
        walletCount: [15, 10],
        alertGroupBy: [[{ marketId: "1" }], []],
        tradeAggregate: [{ _sum: { usdValue: 999999.99 } }, { _sum: { usdValue: 500000 } }],
        tradeCount: [7, 3],
      });

      const response = await GET();
      const data = await response.json();

      expect(typeof data.alerts).toBe("number");
      expect(typeof data.criticalAlerts).toBe("number");
      expect(typeof data.suspiciousWallets).toBe("number");
      expect(typeof data.hotMarkets).toBe("number");
      expect(typeof data.volume24h).toBe("number");
      expect(typeof data.whaleTrades).toBe("number");
    });

    it("should return numeric values for all trends", async () => {
      const { GET } = await setupMocksAndGetHandler({
        alertCount: [10, 5, 5, 3],
        walletCount: [5, 3],
        alertGroupBy: [[], []],
        tradeAggregate: [{ _sum: { usdValue: 1000 } }, { _sum: { usdValue: 500 } }],
        tradeCount: [3, 1],
      });

      const response = await GET();
      const data = await response.json();

      expect(typeof data.trends.alerts).toBe("number");
      expect(typeof data.trends.criticalAlerts).toBe("number");
      expect(typeof data.trends.suspiciousWallets).toBe("number");
      expect(typeof data.trends.hotMarkets).toBe("number");
      expect(typeof data.trends.volume24h).toBe("number");
      expect(typeof data.trends.whaleTrades).toBe("number");
    });

    it("should return ISO string for generatedAt", async () => {
      const { GET } = await setupMocksAndGetHandler({});

      const response = await GET();
      const data = await response.json();

      expect(typeof data.generatedAt).toBe("string");
      // Verify it's a valid ISO date string
      expect(new Date(data.generatedAt).toISOString()).toBe(data.generatedAt);
    });
  });
});
