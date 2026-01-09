/**
 * Tests for Gamma API pagination utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  paginate,
  paginateEndpoint,
  paginateStream,
  paginateParallel,
  createPaginator,
  PageFetchParams,
} from "../../../src/api/gamma/paginate";
import { GammaClient } from "../../../src/api/gamma/client";

// Mock GammaClient
const createMockClient = () => {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  } as unknown as GammaClient;
  return client;
};

describe("paginate", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should fetch a single page when all items fit", async () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const fetchPage = vi.fn().mockResolvedValue({
        items,
        hasMore: false,
      });

      const result = await paginate({
        fetchPage,
        pageSize: 100,
        client: mockClient,
      });

      expect(result.items).toEqual(items);
      expect(result.pagesFetched).toBe(1);
      expect(result.truncated).toBe(false);
      expect(result.truncationReason).toBe("noMoreItems");
      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(fetchPage).toHaveBeenCalledWith({
        offset: 0,
        limit: 100,
        cursor: undefined,
        client: mockClient,
      });
    });

    it("should fetch multiple pages until hasMore is false", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }, { id: 2 }],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: [{ id: 3 }, { id: 4 }],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: [{ id: 5 }],
          hasMore: false,
        });

      const result = await paginate({
        fetchPage,
        pageSize: 2,
        client: mockClient,
      });

      expect(result.items).toHaveLength(5);
      expect(result.pagesFetched).toBe(3);
      expect(result.truncated).toBe(false);
      expect(fetchPage).toHaveBeenCalledTimes(3);
    });

    it("should infer hasMore from page size when not explicitly provided", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }, { id: 2 }], // Full page, implies more
        })
        .mockResolvedValueOnce({
          items: [{ id: 3 }], // Partial page, implies no more
        });

      const result = await paginate({
        fetchPage,
        pageSize: 2,
        client: mockClient,
      });

      expect(result.items).toHaveLength(3);
      expect(result.pagesFetched).toBe(2);
    });
  });

  describe("pagination limits", () => {
    it("should respect maxItems limit", async () => {
      const fetchPage = vi.fn().mockImplementation(({ limit }: PageFetchParams) => ({
        items: Array(limit)
          .fill(null)
          .map((_, i) => ({ id: i })),
        hasMore: true,
      }));

      const result = await paginate({
        fetchPage,
        pageSize: 10,
        maxItems: 25,
        client: mockClient,
      });

      expect(result.items).toHaveLength(25);
      expect(result.truncated).toBe(true);
      expect(result.truncationReason).toBe("maxItems");
    });

    it("should respect maxPages limit", async () => {
      const fetchPage = vi.fn().mockResolvedValue({
        items: [{ id: 1 }],
        hasMore: true,
      });

      const result = await paginate({
        fetchPage,
        pageSize: 1,
        maxPages: 5,
        client: mockClient,
      });

      expect(result.pagesFetched).toBe(5);
      expect(result.truncated).toBe(true);
      expect(result.truncationReason).toBe("maxPages");
    });

    it("should adjust limit for last page when approaching maxItems", async () => {
      const fetchPage = vi.fn().mockImplementation(({ limit }: PageFetchParams) => ({
        items: Array(limit)
          .fill(null)
          .map((_, i) => ({ id: i })),
        hasMore: true,
      }));

      const result = await paginate({
        fetchPage,
        pageSize: 10,
        maxItems: 15,
        client: mockClient,
      });

      expect(result.items).toHaveLength(15);
      // Second call should have limit=5 (remaining items)
      expect(fetchPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 5 }));
    });
  });

  describe("offset and cursor handling", () => {
    it("should start from specified offset", async () => {
      const fetchPage = vi.fn().mockResolvedValue({
        items: [{ id: 1 }],
        hasMore: false,
      });

      await paginate({
        fetchPage,
        startOffset: 50,
        client: mockClient,
      });

      expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ offset: 50 }));
    });

    it("should update offset correctly across pages", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }, { id: 2 }, { id: 3 }],
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: [{ id: 4 }, { id: 5 }],
          hasMore: false,
        });

      const result = await paginate({
        fetchPage,
        pageSize: 3,
        client: mockClient,
      });

      // First call: offset 0
      expect(fetchPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0 }));
      // Second call: offset 3 (after 3 items)
      expect(fetchPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 3 }));
      // lastOffset represents the offset used for the last successful fetch (offset 3)
      // It doesn't get updated when hasMore is false because we break before updating
      expect(result.lastOffset).toBe(3);
      // Total items should be 5
      expect(result.items).toHaveLength(5);
    });

    it("should support cursor-based pagination", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          hasMore: true,
          nextCursor: "cursor-page-2",
        })
        .mockResolvedValueOnce({
          items: [{ id: 2 }],
          hasMore: true,
          nextCursor: "cursor-page-3",
        })
        .mockResolvedValueOnce({
          items: [{ id: 3 }],
          hasMore: false,
        });

      const result = await paginate({
        fetchPage,
        pageSize: 1,
        startCursor: "initial-cursor",
        client: mockClient,
      });

      expect(fetchPage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ cursor: "initial-cursor" })
      );
      expect(fetchPage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cursor: "cursor-page-2" })
      );
      expect(fetchPage).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ cursor: "cursor-page-3" })
      );
      expect(result.lastCursor).toBe("cursor-page-3");
    });
  });

  describe("progress callbacks", () => {
    it("should call onPageFetched after each page", async () => {
      const onPageFetched = vi.fn();
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({ items: [{ id: 1 }], hasMore: true })
        .mockResolvedValueOnce({ items: [{ id: 2 }], hasMore: false });

      await paginate({
        fetchPage,
        onPageFetched,
        client: mockClient,
      });

      expect(onPageFetched).toHaveBeenCalledTimes(2);
      expect(onPageFetched).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ items: [{ id: 1 }] }),
        1
      );
      expect(onPageFetched).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ items: [{ id: 2 }] }),
        2
      );
    });
  });

  describe("total count tracking", () => {
    it("should track totalCount when provided", async () => {
      const fetchPage = vi.fn().mockResolvedValue({
        items: [{ id: 1 }],
        hasMore: false,
        totalCount: 100,
      });

      const result = await paginate({
        fetchPage,
        client: mockClient,
      });

      expect(result.totalCount).toBe(100);
    });

    it("should update totalCount from each page", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 1 }],
          hasMore: true,
          totalCount: 100,
        })
        .mockResolvedValueOnce({
          items: [{ id: 2 }],
          hasMore: false,
          totalCount: 150, // Updated count
        });

      const result = await paginate({
        fetchPage,
        pageSize: 1,
        maxPages: 2,
        client: mockClient,
      });

      expect(result.totalCount).toBe(150);
    });
  });

  describe("delay between pages", () => {
    it("should delay between pages when configured", async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({ items: [{ id: 1 }], hasMore: true })
        .mockResolvedValueOnce({ items: [{ id: 2 }], hasMore: false });

      const startTime = Date.now();

      await paginate({
        fetchPage,
        delayBetweenPages: 50,
        client: mockClient,
      });

      const elapsed = Date.now() - startTime;
      // Should have at least 50ms delay (between first and second page)
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });
});

describe("paginateEndpoint", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it("should build correct URL with pagination params", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    await paginateEndpoint({
      endpoint: "/markets",
      extractItems: (r: unknown[]) => r,
      pageSize: 50,
      maxPages: 1,
      client: mockClient,
    });

    expect(mockClient.get).toHaveBeenCalledWith("/markets?offset=0&limit=50");
  });

  it("should append to existing query params", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    await paginateEndpoint({
      endpoint: "/markets?active=true",
      extractItems: (r: unknown[]) => r,
      pageSize: 100,
      maxPages: 1,
      client: mockClient,
    });

    expect(mockClient.get).toHaveBeenCalledWith("/markets?active=true&offset=0&limit=100");
  });

  it("should extract items from array response", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await paginateEndpoint({
      endpoint: "/markets",
      extractItems: (r: unknown[]) => r,
      maxPages: 1,
      client: mockClient,
    });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should extract items from paginated response", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      count: 100,
    });

    const result = await paginateEndpoint<
      { id: number },
      { data: { id: number }[]; count: number }
    >({
      endpoint: "/markets",
      extractItems: (r) => r.data,
      extractTotalCount: (r) => r.count,
      maxPages: 1,
      client: mockClient,
    });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.totalCount).toBe(100);
  });

  it("should paginate through multiple pages", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const result = await paginateEndpoint({
      endpoint: "/markets",
      extractItems: (r: unknown[]) => r,
      pageSize: 2,
      client: mockClient,
    });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.pagesFetched).toBe(2);
  });

  it("should call onPageFetched with items", async () => {
    const onPageFetched = vi.fn();
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    await paginateEndpoint({
      endpoint: "/markets",
      extractItems: (r: unknown[]) => r,
      onPageFetched,
      maxPages: 1,
      client: mockClient,
    });

    expect(onPageFetched).toHaveBeenCalledWith([{ id: 1 }], 1);
  });
});

describe("createPaginator", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it("should create a reusable paginator function", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const fetchMarkets = createPaginator<{ id: number }, { id: number }[]>({
      endpoint: "/markets",
      extractItems: (r) => r,
      client: mockClient,
    });

    const result1 = await fetchMarkets({ maxPages: 1 });
    expect(result1.items).toHaveLength(2);

    await fetchMarkets({ maxPages: 1, pageSize: 10 });
    expect(mockClient.get).toHaveBeenCalledWith("/markets?offset=0&limit=10");
  });

  it("should allow overriding options on each call", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    const fetcher = createPaginator({
      endpoint: "/items",
      extractItems: (r: unknown[]) => r,
      pageSize: 50,
      client: mockClient,
    });

    // Override pageSize
    await fetcher({ pageSize: 25, maxPages: 1 });
    expect(mockClient.get).toHaveBeenCalledWith("/items?offset=0&limit=25");
  });
});

describe("paginateStream", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it("should yield items one by one", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const items: { id: number }[] = [];
    for await (const item of paginateStream({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      pageSize: 2,
      client: mockClient,
    })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("should respect maxItems limit", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    const items: { id: number }[] = [];
    for await (const item of paginateStream({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      maxItems: 2,
      client: mockClient,
    })) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
  });

  it("should respect maxPages limit", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const items: { id: number }[] = [];
    for await (const item of paginateStream({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      pageSize: 2,
      maxPages: 1,
      client: mockClient,
    })) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(mockClient.get).toHaveBeenCalledTimes(1);
  });

  it("should call onPageFetched callback", async () => {
    const onPageFetched = vi.fn();
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    const items: { id: number }[] = [];
    for await (const item of paginateStream({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      onPageFetched,
      maxPages: 1,
      client: mockClient,
    })) {
      items.push(item);
    }

    expect(onPageFetched).toHaveBeenCalledWith([{ id: 1 }], 1);
  });
});

describe("paginateParallel", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it("should fetch pages in parallel when totalCount is known", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      const offset = parseInt(url.match(/offset=(\d+)/)?.[1] ?? "0");
      return Promise.resolve([{ id: offset + 1 }, { id: offset + 2 }]);
    });

    const result = await paginateParallel({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      pageSize: 2,
      totalCount: 6,
      concurrency: 2,
      client: mockClient,
    });

    expect(result.items).toHaveLength(6);
    expect(result.pagesFetched).toBe(3);
  });

  it("should fetch totalCount if not provided", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: [], count: 4 }) // Initial request for count
      .mockImplementation((url: string) => {
        const offset = parseInt(url.match(/offset=(\d+)/)?.[1] ?? "0");
        return Promise.resolve({
          data: [{ id: offset + 1 }, { id: offset + 2 }],
          count: 4,
        });
      });

    const result = await paginateParallel<
      { id: number },
      { data: { id: number }[]; count: number }
    >({
      endpoint: "/markets",
      extractItems: (r) => r.data,
      extractTotalCount: (r) => r.count,
      pageSize: 2,
      concurrency: 2,
      client: mockClient,
    });

    expect(result.totalCount).toBe(4);
    expect(result.items).toHaveLength(4);
  });

  it("should fall back to sequential pagination if totalCount unavailable", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: 1 }]) // Initial request, no count
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const result = await paginateParallel({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      pageSize: 2,
      client: mockClient,
    });

    // Falls back to sequential since no totalCount
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("should respect maxItems limit", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      const offset = parseInt(url.match(/offset=(\d+)/)?.[1] ?? "0");
      return Promise.resolve([{ id: offset + 1 }, { id: offset + 2 }]);
    });

    const result = await paginateParallel({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      pageSize: 2,
      totalCount: 10,
      maxItems: 5,
      client: mockClient,
    });

    expect(result.items).toHaveLength(5);
  });

  it("should call onPageFetched for each page", async () => {
    const onPageFetched = vi.fn();
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);

    await paginateParallel({
      endpoint: "/markets",
      extractItems: (r: { id: number }[]) => r,
      onPageFetched,
      pageSize: 1,
      totalCount: 3,
      concurrency: 2,
      client: mockClient,
    });

    expect(onPageFetched).toHaveBeenCalledTimes(3);
  });
});

describe("edge cases", () => {
  let mockClient: GammaClient;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it("should handle empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const result = await paginate({
      fetchPage,
      client: mockClient,
    });

    expect(result.items).toEqual([]);
    expect(result.pagesFetched).toBe(1);
    expect(result.truncationReason).toBe("noMoreItems");
  });

  it("should handle errors from fetchPage", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error("API Error"));

    await expect(
      paginate({
        fetchPage,
        client: mockClient,
      })
    ).rejects.toThrow("API Error");
  });

  it("should handle zero pageSize gracefully", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      items: [],
      hasMore: false,
    });

    // pageSize 0 would cause infinite loop, but maxItems should prevent
    const result = await paginate({
      fetchPage,
      pageSize: 0,
      maxItems: 0,
      client: mockClient,
    });

    expect(result.items).toEqual([]);
    expect(result.truncationReason).toBe("maxItems");
  });

  it("should work with default options", async () => {
    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await paginateEndpoint({
      endpoint: "/test",
      extractItems: (r: unknown[]) => r,
      client: mockClient,
    });

    // Should use default pageSize of 100
    expect(mockClient.get).toHaveBeenCalledWith("/test?offset=0&limit=100");
    expect(result.items).toEqual([]);
  });
});

describe("type safety", () => {
  it("should preserve item types through pagination", async () => {
    interface Market {
      id: string;
      question: string;
      volume: number;
    }

    const mockClient = createMockClient();
    const markets: Market[] = [
      { id: "1", question: "Test?", volume: 100 },
      { id: "2", question: "Test2?", volume: 200 },
    ];

    (mockClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(markets);

    const result = await paginateEndpoint<Market, Market[]>({
      endpoint: "/markets",
      extractItems: (r) => r,
      maxPages: 1,
      client: mockClient,
    });

    // TypeScript should infer result.items as Market[]
    const firstMarket = result.items[0];
    expect(firstMarket?.id).toBe("1");
    expect(firstMarket?.question).toBe("Test?");
    expect(firstMarket?.volume).toBe(100);
  });
});
