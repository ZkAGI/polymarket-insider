/**
 * Dashboard Alerts API Unit Tests
 *
 * Tests for the /api/dashboard/alerts endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertSeverity, AlertType } from "@prisma/client";

describe("Dashboard Alerts API - GET /api/dashboard/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Mock data generators
  const mockAlert = (overrides = {}) => ({
    id: "alert-1",
    type: AlertType.WHALE_TRADE,
    severity: AlertSeverity.HIGH,
    title: "Whale Trade Detected",
    message: "Large trade of $500,000 detected",
    tags: ["whale", "large-trade"],
    read: false,
    acknowledged: false,
    createdAt: new Date("2026-01-14T12:00:00.000Z"),
    market: {
      id: "market-1",
      question: "Will BTC hit $100k?",
      slug: "btc-100k",
      category: "crypto",
    },
    wallet: {
      id: "wallet-1",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      label: "Whale 1",
      suspicionScore: 75,
    },
    ...overrides,
  });

  async function setupMocksAndGetHandler(mocks: {
    alerts?: ReturnType<typeof mockAlert>[];
    total?: number;
    shouldThrow?: boolean;
  }) {
    const findManyMock = vi.fn();
    const countMock = vi.fn();

    if (mocks.shouldThrow) {
      findManyMock.mockRejectedValue(new Error("Database error"));
    } else {
      findManyMock.mockResolvedValue(mocks.alerts ?? []);
      countMock.mockResolvedValue(mocks.total ?? mocks.alerts?.length ?? 0);
    }

    vi.doMock("@/db/client", () => ({
      prisma: {
        alert: {
          findMany: findManyMock,
          count: countMock,
        },
      },
    }));

    const { GET } = await import("@/app/api/dashboard/alerts/route");
    return { GET, findManyMock, countMock };
  }

  function createRequest(params: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/dashboard/alerts");
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new Request(url.toString());
  }

  describe("Basic Response", () => {
    it("should return alerts with correct structure", async () => {
      const alerts = [mockAlert(), mockAlert({ id: "alert-2" })];
      const { GET } = await setupMocksAndGetHandler({ alerts, total: 2 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data).toHaveProperty("alerts");
      expect(data).toHaveProperty("pagination");
      expect(data).toHaveProperty("filters");
      expect(data).toHaveProperty("generatedAt");
    });

    it("should return correct alert data", async () => {
      const alert = mockAlert();
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts).toHaveLength(1);
      expect(data.alerts[0].id).toBe("alert-1");
      expect(data.alerts[0].type).toBe(AlertType.WHALE_TRADE);
      expect(data.alerts[0].severity).toBe(AlertSeverity.HIGH);
      expect(data.alerts[0].title).toBe("Whale Trade Detected");
    });

    it("should return correct pagination info", async () => {
      const alerts = Array.from({ length: 20 }, (_, i) => mockAlert({ id: `alert-${i}` }));
      const { GET } = await setupMocksAndGetHandler({ alerts, total: 50 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.hasMore).toBe(true);
    });

    it("should return 200 status code on success", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest() as any);

      expect(response.status).toBe(200);
    });

    it("should include related market data", async () => {
      const alert = mockAlert();
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].market).toEqual({
        id: "market-1",
        question: "Will BTC hit $100k?",
        slug: "btc-100k",
        category: "crypto",
      });
    });

    it("should include related wallet data", async () => {
      const alert = mockAlert();
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].wallet).toEqual({
        id: "wallet-1",
        address: "0x1234567890abcdef1234567890abcdef12345678",
        label: "Whale 1",
        suspicionScore: 75,
      });
    });

    it("should handle alerts without related market", async () => {
      const alert = mockAlert({ market: null });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].market).toBeNull();
    });

    it("should handle alerts without related wallet", async () => {
      const alert = mockAlert({ wallet: null });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].wallet).toBeNull();
    });
  });

  describe("Pagination", () => {
    it("should use default limit of 20", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        })
      );
    });

    it("should use custom limit", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ limit: "50" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it("should cap limit at 100", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ limit: "200" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("should use minimum limit of 1", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ limit: "0" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
    });

    it("should use custom offset", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ offset: "40" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
        })
      );
    });

    it("should handle invalid limit gracefully", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ limit: "invalid" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20, // default
        })
      );
    });

    it("should calculate hasMore correctly when there are more results", async () => {
      const alerts = Array.from({ length: 20 }, (_, i) => mockAlert({ id: `alert-${i}` }));
      const { GET } = await setupMocksAndGetHandler({ alerts, total: 50 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.pagination.hasMore).toBe(true);
    });

    it("should calculate hasMore correctly when there are no more results", async () => {
      const alerts = Array.from({ length: 10 }, (_, i) => mockAlert({ id: `alert-${i}` }));
      const { GET } = await setupMocksAndGetHandler({ alerts, total: 10 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("Severity Filter", () => {
    it("should filter by single severity", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ severity: "HIGH" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: [AlertSeverity.HIGH] },
          }),
        })
      );
    });

    it("should filter by multiple severities", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ severity: "HIGH,CRITICAL" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
          }),
        })
      );
    });

    it("should handle case-insensitive severity", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ severity: "high,CRITICAL" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
          }),
        })
      );
    });

    it("should ignore invalid severity values", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ severity: "INVALID,HIGH" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: [AlertSeverity.HIGH] },
          }),
        })
      );
    });

    it("should not apply severity filter if all values are invalid", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ severity: "INVALID,WRONG" }) as any);

      const callArgs = findManyMock.mock.calls[0]?.[0] as { where: { severity?: unknown } } | undefined;
      expect(callArgs?.where.severity).toBeUndefined();
    });

    it("should include severity in response filters", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest({ severity: "HIGH,CRITICAL" }) as any);
      const data = await response.json();

      expect(data.filters.severity).toEqual([AlertSeverity.HIGH, AlertSeverity.CRITICAL]);
    });
  });

  describe("Type Filter", () => {
    it("should filter by single type", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ type: "WHALE_TRADE" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [AlertType.WHALE_TRADE] },
          }),
        })
      );
    });

    it("should filter by multiple types", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ type: "WHALE_TRADE,FRESH_WALLET" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [AlertType.WHALE_TRADE, AlertType.FRESH_WALLET] },
          }),
        })
      );
    });

    it("should handle case-insensitive type", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ type: "whale_trade" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [AlertType.WHALE_TRADE] },
          }),
        })
      );
    });

    it("should ignore invalid type values", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ type: "INVALID,WHALE_TRADE" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: [AlertType.WHALE_TRADE] },
          }),
        })
      );
    });

    it("should include type in response filters", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest({ type: "WHALE_TRADE,FRESH_WALLET" }) as any);
      const data = await response.json();

      expect(data.filters.type).toEqual([AlertType.WHALE_TRADE, AlertType.FRESH_WALLET]);
    });
  });

  describe("Since Filter", () => {
    it("should filter by since date", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ since: "2026-01-14T00:00:00.000Z" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date("2026-01-14T00:00:00.000Z") },
          }),
        })
      );
    });

    it("should handle invalid since date gracefully", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ since: "invalid-date" }) as any);

      const callArgs = findManyMock.mock.calls[0]?.[0] as { where: { createdAt?: unknown } } | undefined;
      expect(callArgs?.where.createdAt).toBeUndefined();
    });

    it("should include since in response filters", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest({ since: "2026-01-14T00:00:00.000Z" }) as any);
      const data = await response.json();

      expect(data.filters.since).toBe("2026-01-14T00:00:00.000Z");
    });
  });

  describe("Read Filter", () => {
    it("should filter by read=true", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ read: "true" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            read: true,
          }),
        })
      );
    });

    it("should filter by read=false", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ read: "false" }) as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            read: false,
          }),
        })
      );
    });

    it("should handle invalid read value gracefully", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest({ read: "invalid" }) as any);

      const callArgs = findManyMock.mock.calls[0]?.[0] as { where: { read?: unknown } } | undefined;
      expect(callArgs?.where.read).toBeUndefined();
    });

    it("should include read in response filters", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest({ read: "false" }) as any);
      const data = await response.json();

      expect(data.filters.read).toBe(false);
    });
  });

  describe("Combined Filters", () => {
    it("should apply all filters together", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(
        createRequest({
          severity: "HIGH,CRITICAL",
          type: "WHALE_TRADE",
          since: "2026-01-14T00:00:00.000Z",
          read: "false",
          limit: "50",
          offset: "10",
        }) as any
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
            type: { in: [AlertType.WHALE_TRADE] },
            createdAt: { gte: new Date("2026-01-14T00:00:00.000Z") },
            read: false,
          },
          take: 50,
          skip: 10,
        })
      );
    });
  });

  describe("Ordering", () => {
    it("should order by createdAt descending", async () => {
      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      await GET(createRequest() as any);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("Response Headers", () => {
    it("should include Cache-Control header", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=15, stale-while-revalidate=30"
      );
    });

    it("should include X-Cache header indicating cache miss on first request", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest() as any);

      expect(response.headers.get("X-Cache")).toBe("MISS");
    });

    it("should return cache HIT on subsequent requests within TTL", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      // First request
      const response1 = await GET(createRequest() as any);
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second request within 15s TTL
      vi.setSystemTime(new Date("2026-01-14T12:00:10.000Z"));
      const response2 = await GET(createRequest() as any);
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // The findManyMock should only be called once (for the first request)
      expect(findManyMock).toHaveBeenCalledTimes(1);
    });

    it("should return cache MISS after TTL expires", async () => {
      vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

      const { GET, findManyMock } = await setupMocksAndGetHandler({ alerts: [] });

      // First request
      await GET(createRequest() as any);

      // Request after TTL (15s + 1s)
      vi.setSystemTime(new Date("2026-01-14T12:00:16.000Z"));
      const response = await GET(createRequest() as any);

      expect(response.headers.get("X-Cache")).toBe("MISS");
      expect(findManyMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 status on database error", async () => {
      const { GET } = await setupMocksAndGetHandler({
        shouldThrow: true,
      });

      const response = await GET(createRequest() as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch dashboard alerts");
    });
  });

  describe("Data Types", () => {
    it("should return ISO string for createdAt", async () => {
      const alert = mockAlert();
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(typeof data.alerts[0].createdAt).toBe("string");
      expect(new Date(data.alerts[0].createdAt).toISOString()).toBe(data.alerts[0].createdAt);
    });

    it("should return ISO string for generatedAt", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [] });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(typeof data.generatedAt).toBe("string");
      expect(new Date(data.generatedAt).toISOString()).toBe(data.generatedAt);
    });

    it("should return array for tags", async () => {
      const alert = mockAlert({ tags: ["tag1", "tag2"] });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(Array.isArray(data.alerts[0].tags)).toBe(true);
      expect(data.alerts[0].tags).toEqual(["tag1", "tag2"]);
    });

    it("should return boolean for read", async () => {
      const alert = mockAlert({ read: true });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(typeof data.alerts[0].read).toBe("boolean");
      expect(data.alerts[0].read).toBe(true);
    });

    it("should return boolean for acknowledged", async () => {
      const alert = mockAlert({ acknowledged: true });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(typeof data.alerts[0].acknowledged).toBe("boolean");
      expect(data.alerts[0].acknowledged).toBe(true);
    });

    it("should return numeric for pagination values", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [], total: 50 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(typeof data.pagination.offset).toBe("number");
      expect(typeof data.pagination.limit).toBe("number");
      expect(typeof data.pagination.total).toBe("number");
      expect(typeof data.pagination.hasMore).toBe("boolean");
    });
  });

  describe("Empty Results", () => {
    it("should handle empty results gracefully", async () => {
      const { GET } = await setupMocksAndGetHandler({ alerts: [], total: 0 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });
  });

  describe("All Severity Values", () => {
    it.each([
      AlertSeverity.INFO,
      AlertSeverity.LOW,
      AlertSeverity.MEDIUM,
      AlertSeverity.HIGH,
      AlertSeverity.CRITICAL,
    ])("should handle severity %s correctly", async (severity) => {
      const alert = mockAlert({ severity });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].severity).toBe(severity);
    });
  });

  describe("All Alert Types", () => {
    it.each([
      AlertType.WHALE_TRADE,
      AlertType.PRICE_MOVEMENT,
      AlertType.INSIDER_ACTIVITY,
      AlertType.FRESH_WALLET,
      AlertType.WALLET_REACTIVATION,
      AlertType.COORDINATED_ACTIVITY,
      AlertType.UNUSUAL_PATTERN,
      AlertType.MARKET_RESOLVED,
      AlertType.NEW_MARKET,
      AlertType.SUSPICIOUS_FUNDING,
      AlertType.SANCTIONED_ACTIVITY,
      AlertType.SYSTEM,
    ])("should handle type %s correctly", async (type) => {
      const alert = mockAlert({ type });
      const { GET } = await setupMocksAndGetHandler({ alerts: [alert], total: 1 });

      const response = await GET(createRequest() as any);
      const data = await response.json();

      expect(data.alerts[0].type).toBe(type);
    });
  });
});
