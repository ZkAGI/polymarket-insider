/**
 * Unit tests for useDashboardData hooks
 *
 * Tests the SWR-based hooks for fetching dashboard data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useStats,
  useAlerts,
  useWhales,
  useMarkets,
  useDashboardData,
  DashboardStatsResponse,
  DashboardAlertsResponse,
  DashboardWhalesResponse,
  DashboardMarketsResponse,
} from "@/hooks/useDashboardData";
import { SWRConfig } from "swr";
import React from "react";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock stats response
const mockStatsResponse: DashboardStatsResponse = {
  alerts: 42,
  criticalAlerts: 5,
  suspiciousWallets: 15,
  hotMarkets: 8,
  volume24h: 1500000,
  whaleTrades: 12,
  trends: {
    alerts: 10,
    criticalAlerts: -5,
    suspiciousWallets: 20,
    hotMarkets: 0,
    volume24h: 15,
    whaleTrades: -10,
  },
  generatedAt: new Date().toISOString(),
};

// Mock alerts response
const mockAlertsResponse: DashboardAlertsResponse = {
  alerts: [
    {
      id: "alert-1",
      type: "WHALE_TRADE",
      severity: "HIGH",
      title: "Large whale trade detected",
      message: "A whale traded $500K on the election market",
      tags: ["whale", "election"],
      read: false,
      acknowledged: false,
      createdAt: new Date().toISOString(),
      market: {
        id: "market-1",
        question: "Will Trump win 2024?",
        slug: "trump-2024",
        category: "Politics",
      },
      wallet: {
        id: "wallet-1",
        address: "0x1234567890abcdef",
        label: "Whale Wallet",
        suspicionScore: 75,
      },
    },
    {
      id: "alert-2",
      type: "FRESH_WALLET",
      severity: "MEDIUM",
      title: "Fresh wallet activity",
      message: "New wallet made first large trade",
      tags: ["fresh", "suspicious"],
      read: true,
      acknowledged: false,
      createdAt: new Date().toISOString(),
      market: null,
      wallet: {
        id: "wallet-2",
        address: "0xabcdef1234567890",
        label: null,
        suspicionScore: 60,
      },
    },
  ],
  pagination: {
    offset: 0,
    limit: 20,
    total: 2,
    hasMore: false,
  },
  filters: {
    severity: null,
    type: null,
    since: null,
    read: null,
  },
  generatedAt: new Date().toISOString(),
};

// Mock whales response
const mockWhalesResponse: DashboardWhalesResponse = {
  wallets: [
    {
      id: "wallet-1",
      address: "0x1234567890abcdef",
      label: "Whale 1",
      walletType: "WHALE",
      suspicionScore: 85,
      riskLevel: "HIGH",
      totalVolume: 5000000,
      tradeCount: 150,
      winRate: 75,
      totalPnl: 250000,
      avgTradeSize: 33333,
      maxTradeSize: 500000,
      firstTradeAt: "2024-01-01T00:00:00Z",
      lastTradeAt: new Date().toISOString(),
      walletAgeDays: 365,
      flags: {
        isWhale: true,
        isInsider: false,
        isFresh: false,
        isFlagged: true,
        isMonitored: true,
        isSanctioned: false,
      },
    },
  ],
  pagination: {
    offset: 0,
    limit: 10,
    total: 1,
    hasMore: false,
  },
  filters: {
    minScore: null,
    isWhale: null,
    isInsider: null,
    isFlagged: null,
  },
  generatedAt: new Date().toISOString(),
};

// Mock markets response
const mockMarketsResponse: DashboardMarketsResponse = {
  markets: [
    {
      id: "market-1",
      question: "Will Trump win 2024?",
      slug: "trump-2024",
      category: "Politics",
      subcategory: "Elections",
      volume: 10000000,
      volume24h: 500000,
      liquidity: 2000000,
      alertCount: 15,
      topAlertType: "WHALE_TRADE",
      active: true,
      closed: false,
      endDate: "2024-11-05T00:00:00Z",
      imageUrl: null,
      outcomes: [
        { name: "Yes", price: 0.55, priceChange24h: 0.05 },
        { name: "No", price: 0.45, priceChange24h: -0.05 },
      ],
    },
  ],
  pagination: {
    offset: 0,
    limit: 10,
    total: 1,
    hasMore: false,
  },
  filters: {
    category: null,
  },
  generatedAt: new Date().toISOString(),
};

// SWR wrapper to disable caching in tests
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    SWRConfig,
    {
      value: {
        dedupingInterval: 0,
        provider: () => new Map(),
      },
    },
    children
  );
}

describe("useDashboardData hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useStats", () => {
    it("should fetch stats successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatsResponse,
      });

      const { result } = renderHook(() => useStats(), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Data should be populated
      expect(result.current.data).toEqual(mockStatsResponse);
      expect(result.current.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith("/api/dashboard/stats");
    });

    it("should handle fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      const { result } = renderHook(() => useStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when disabled", async () => {
      const { result } = renderHook(() => useStats({ enabled: false }), {
        wrapper,
      });

      // Should not be loading and no data
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should allow manual revalidation", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatsResponse,
      });

      const { result } = renderHook(() => useStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mutate to trigger revalidation
      await act(async () => {
        await result.current.mutate();
      });

      // Should have been called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("useAlerts", () => {
    it("should fetch alerts with default params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertsResponse,
      });

      const { result } = renderHook(() => useAlerts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.pagination).toEqual(mockAlertsResponse.pagination);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/alerts?limit=20&offset=0"
      );
    });

    it("should apply filters to request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlertsResponse,
      });

      const { result } = renderHook(
        () =>
          useAlerts({
            limit: 10,
            offset: 5,
            severity: ["HIGH", "CRITICAL"],
            type: ["WHALE_TRADE"],
            read: false,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/alerts?limit=10&offset=5&severity=HIGH%2CCRITICAL&type=WHALE_TRADE&read=false"
      );
    });

    it("should return empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      const { result } = renderHook(() => useAlerts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.alerts).toEqual([]);
      expect(result.current.error).toBeDefined();
    });
  });

  describe("useWhales", () => {
    it("should fetch wallets successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWhalesResponse,
      });

      const { result } = renderHook(() => useWhales(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.wallets).toHaveLength(1);
      expect(result.current.wallets[0]?.address).toBe("0x1234567890abcdef");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/whales?limit=10&offset=0"
      );
    });

    it("should apply filters to request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWhalesResponse,
      });

      const { result } = renderHook(
        () =>
          useWhales({
            limit: 5,
            minScore: 50,
            isWhale: true,
            isFlagged: true,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/whales?limit=5&offset=0&minScore=50&isWhale=true&isFlagged=true"
      );
    });
  });

  describe("useMarkets", () => {
    it("should fetch markets successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarketsResponse,
      });

      const { result } = renderHook(() => useMarkets(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.markets).toHaveLength(1);
      expect(result.current.markets[0]?.question).toBe("Will Trump win 2024?");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/markets?limit=10&offset=0"
      );
    });

    it("should filter by category", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMarketsResponse,
      });

      const { result } = renderHook(
        () => useMarkets({ category: "politics" }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboard/markets?limit=10&offset=0&category=politics"
      );
    });
  });

  describe("useDashboardData", () => {
    it("should fetch all dashboard data", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatsResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAlertsResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWhalesResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMarketsResponse,
        });

      const { result } = renderHook(() => useDashboardData(), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All data should be populated
      expect(result.current.stats.data).toEqual(mockStatsResponse);
      expect(result.current.alerts.alerts).toHaveLength(2);
      expect(result.current.whales.wallets).toHaveLength(1);
      expect(result.current.markets.markets).toHaveLength(1);
      expect(result.current.hasError).toBe(false);
    });

    it("should report hasError when any request fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatsResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWhalesResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMarketsResponse,
        });

      const { result } = renderHook(() => useDashboardData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasError).toBe(true);
    });

    it("should allow refreshAll to revalidate all hooks", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatsResponse,
      });

      const { result } = renderHook(() => useDashboardData(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Call refreshAll
      await act(async () => {
        await result.current.refreshAll();
      });

      // Should have made additional calls
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it("should allow disabling individual data sources", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatsResponse,
      });

      const { result } = renderHook(
        () =>
          useDashboardData({
            statsEnabled: true,
            alertsEnabled: false,
            whalesEnabled: false,
            marketsEnabled: false,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      // Only stats should have been fetched
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/dashboard/stats");
    });
  });
});
