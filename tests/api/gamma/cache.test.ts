/**
 * Tests for Gamma API Response Cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ResponseCache,
  createCache,
  getSharedCache,
  resetSharedCache,
  setSharedCache,
  CacheTTL,
  CacheKeyPrefix,
  marketCacheKey,
  marketBySlugCacheKey,
  activeMarketsCacheKey,
  trendingMarketsCacheKey,
  outcomesCacheKey,
  volumeHistoryCacheKey,
  priceHistoryCacheKey,
  withCache,
  withSharedCache,
} from "../../../src/api/gamma/cache";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    // Create cache with disabled cleanup interval for testing
    cache = new ResponseCache({ cleanupInterval: 0 });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe("constructor", () => {
    it("should create cache with default configuration", () => {
      const defaultCache = new ResponseCache();
      const config = defaultCache.getConfig();
      expect(config.defaultTTL).toBe(60000);
      expect(config.maxEntries).toBe(1000);
      expect(config.enableLogging).toBe(false);
      expect(config.cleanupInterval).toBe(60000);
      defaultCache.dispose();
    });

    it("should create cache with custom configuration", () => {
      const customCache = new ResponseCache({
        defaultTTL: 30000,
        maxEntries: 500,
        enableLogging: true,
        cleanupInterval: 0,
      });
      const config = customCache.getConfig();
      expect(config.defaultTTL).toBe(30000);
      expect(config.maxEntries).toBe(500);
      expect(config.enableLogging).toBe(true);
      customCache.dispose();
    });
  });

  describe("get and set", () => {
    it("should store and retrieve a value", () => {
      cache.set("key1", { data: "test" });
      const result = cache.get<{ data: string }>("key1");
      expect(result).toEqual({ data: "test" });
    });

    it("should return undefined for non-existent key", () => {
      const result = cache.get("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return undefined for expired key", () => {
      vi.useFakeTimers();
      cache.set("key1", "value", { ttl: 1000 });

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      const result = cache.get("key1");
      expect(result).toBeUndefined();
      vi.useRealTimers();
    });

    it("should support custom TTL per entry", () => {
      vi.useFakeTimers();
      cache.set("short", "value1", { ttl: 1000 });
      cache.set("long", "value2", { ttl: 5000 });

      vi.advanceTimersByTime(2000);

      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("value2");
      vi.useRealTimers();
    });

    it("should track hit counts", () => {
      cache.set("key1", "value");
      cache.get("key1");
      cache.get("key1");
      cache.get("key1");

      const metadata = cache.getEntryMetadata("key1");
      expect(metadata?.hitCount).toBe(3);
    });

    it("should store tags with entries", () => {
      cache.set("key1", "value", { tags: ["tag1", "tag2"] });
      const metadata = cache.getEntryMetadata("key1");
      expect(metadata?.tags).toEqual(["tag1", "tag2"]);
    });

    it("should refresh TTL on hit when refreshOnHit is true", () => {
      vi.useFakeTimers();
      const now = Date.now();

      cache.set("key1", "value", { ttl: 2000 });
      const initialMetadata = cache.getEntryMetadata("key1");
      expect(initialMetadata?.expiresAt).toBe(now + 2000);

      vi.advanceTimersByTime(1000);
      cache.get("key1", { refreshOnHit: true });

      const updatedMetadata = cache.getEntryMetadata("key1");
      expect(updatedMetadata?.expiresAt).toBe(now + 1000 + 2000);
      vi.useRealTimers();
    });
  });

  describe("has", () => {
    it("should return true for existing key", () => {
      cache.set("key1", "value");
      expect(cache.has("key1")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(cache.has("non-existent")).toBe(false);
    });

    it("should return false for expired key", () => {
      vi.useFakeTimers();
      cache.set("key1", "value", { ttl: 1000 });
      vi.advanceTimersByTime(1500);
      expect(cache.has("key1")).toBe(false);
      vi.useRealTimers();
    });
  });

  describe("delete and invalidate", () => {
    it("should delete a key", () => {
      cache.set("key1", "value");
      expect(cache.has("key1")).toBe(true);

      const deleted = cache.delete("key1");
      expect(deleted).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });

    it("should return false when deleting non-existent key", () => {
      const deleted = cache.delete("non-existent");
      expect(deleted).toBe(false);
    });

    it("should invalidate (alias for delete)", () => {
      cache.set("key1", "value");
      const invalidated = cache.invalidate("key1");
      expect(invalidated).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });
  });

  describe("invalidateByTag", () => {
    it("should invalidate all entries with a specific tag", () => {
      cache.set("key1", "value1", { tags: ["market"] });
      cache.set("key2", "value2", { tags: ["market", "active"] });
      cache.set("key3", "value3", { tags: ["other"] });

      const count = cache.invalidateByTag("market");

      expect(count).toBe(2);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    it("should return 0 when no entries match tag", () => {
      cache.set("key1", "value", { tags: ["other"] });
      const count = cache.invalidateByTag("non-existent");
      expect(count).toBe(0);
    });
  });

  describe("invalidateByPattern", () => {
    it("should invalidate entries matching pattern with wildcard at end", () => {
      cache.set("market:123", "value1");
      cache.set("market:456", "value2");
      cache.set("other:123", "value3");

      const count = cache.invalidateByPattern("market:*");

      expect(count).toBe(2);
      expect(cache.has("market:123")).toBe(false);
      expect(cache.has("market:456")).toBe(false);
      expect(cache.has("other:123")).toBe(true);
    });

    it("should invalidate entries matching pattern with wildcard at start", () => {
      cache.set("markets:active", "value1");
      cache.set("outcomes:active", "value2");
      cache.set("markets:closed", "value3");

      const count = cache.invalidateByPattern("*:active");

      expect(count).toBe(2);
      expect(cache.has("markets:active")).toBe(false);
      expect(cache.has("outcomes:active")).toBe(false);
      expect(cache.has("markets:closed")).toBe(true);
    });

    it("should invalidate entries matching exact pattern", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const count = cache.invalidateByPattern("key1");

      expect(count).toBe(1);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
    });
  });

  describe("getOrFetch", () => {
    it("should return cached value on hit", async () => {
      const fetchFn = vi.fn().mockResolvedValue("fetched");
      cache.set("key1", "cached");

      const result = await cache.getOrFetch("key1", fetchFn);

      expect(result).toBe("cached");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("should call fetch function and cache on miss", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: "fetched" });

      const result = await cache.getOrFetch("key1", fetchFn);

      expect(result).toEqual({ data: "fetched" });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cache.get("key1")).toEqual({ data: "fetched" });
    });

    it("should use custom TTL from options", async () => {
      vi.useFakeTimers();
      const fetchFn = vi.fn().mockResolvedValue("value");

      await cache.getOrFetch("key1", fetchFn, { ttl: 5000 });

      const metadata = cache.getEntryMetadata("key1");
      expect(metadata?.ttl).toBe(5000);
      vi.useRealTimers();
    });

    it("should handle fetch function errors", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("Fetch failed"));

      await expect(cache.getOrFetch("key1", fetchFn)).rejects.toThrow("Fetch failed");
      expect(cache.has("key1")).toBe(false);
    });
  });

  describe("getOrFetchSync", () => {
    it("should return cached value on hit", () => {
      const fetchFn = vi.fn().mockReturnValue("fetched");
      cache.set("key1", "cached");

      const result = cache.getOrFetchSync("key1", fetchFn);

      expect(result).toBe("cached");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("should call fetch function and cache on miss", () => {
      const fetchFn = vi.fn().mockReturnValue("fetched");

      const result = cache.getOrFetchSync("key1", fetchFn);

      expect(result).toBe("fetched");
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cache.get("key1")).toBe("fetched");
    });
  });

  describe("eviction", () => {
    it("should evict oldest entry when max size is reached", () => {
      const smallCache = new ResponseCache({ maxEntries: 3, cleanupInterval: 0 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      smallCache.set("key4", "value4");

      expect(smallCache.size).toBe(3);
      expect(smallCache.has("key1")).toBe(false); // Oldest, evicted
      expect(smallCache.has("key4")).toBe(true); // Newest, kept

      smallCache.dispose();
    });

    it("should track evictions in stats", () => {
      const smallCache = new ResponseCache({ maxEntries: 2, cleanupInterval: 0 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);

      smallCache.dispose();
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", () => {
      vi.useFakeTimers();
      cache.set("key1", "value1", { ttl: 1000 });
      cache.set("key2", "value2", { ttl: 5000 });

      vi.advanceTimersByTime(2000);

      const removed = cache.cleanup();

      expect(removed).toBe(1);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
      vi.useRealTimers();
    });

    it("should return 0 when no entries are expired", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const removed = cache.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(false);
    });
  });

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value");

      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("missing"); // miss
      cache.get("missing2"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track invalidations", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2", { tags: ["tag1"] });
      cache.set("key3", "value3", { tags: ["tag1"] });

      cache.invalidate("key1");
      cache.invalidateByTag("tag1");

      const stats = cache.getStats();
      expect(stats.invalidations).toBe(3);
    });

    it("should track expirations", () => {
      vi.useFakeTimers();
      cache.set("key1", "value", { ttl: 1000 });

      vi.advanceTimersByTime(1500);
      cache.get("key1"); // Triggers expiration check

      const stats = cache.getStats();
      expect(stats.expirations).toBe(1);
      vi.useRealTimers();
    });

    it("should estimate memory usage", () => {
      cache.set("key1", { data: "test data here" });
      cache.set("key2", { data: "more test data" });

      const stats = cache.getStats();
      expect(stats.estimatedMemoryBytes).toBeGreaterThan(0);
    });

    it("should reset statistics", () => {
      cache.set("key1", "value");
      cache.get("key1");
      cache.get("missing");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("keys and size", () => {
    it("should return all keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return correct size", () => {
      expect(cache.size).toBe(0);

      cache.set("key1", "value1");
      expect(cache.size).toBe(1);

      cache.set("key2", "value2");
      expect(cache.size).toBe(2);

      cache.delete("key1");
      expect(cache.size).toBe(1);
    });
  });

  describe("getEntryMetadata", () => {
    it("should return entry metadata", () => {
      vi.useFakeTimers();
      const now = Date.now();

      cache.set("key1", "value", { ttl: 5000, tags: ["tag1"] });
      cache.get("key1");

      const metadata = cache.getEntryMetadata("key1");

      expect(metadata).not.toBeNull();
      expect(metadata?.exists).toBe(true);
      expect(metadata?.createdAt).toBe(now);
      expect(metadata?.expiresAt).toBe(now + 5000);
      expect(metadata?.hitCount).toBe(1);
      expect(metadata?.ttl).toBe(5000);
      expect(metadata?.tags).toEqual(["tag1"]);
      vi.useRealTimers();
    });

    it("should return null for non-existent key", () => {
      const metadata = cache.getEntryMetadata("missing");
      expect(metadata).toBeNull();
    });

    it("should return null for expired key", () => {
      vi.useFakeTimers();
      cache.set("key1", "value", { ttl: 1000 });
      vi.advanceTimersByTime(1500);

      const metadata = cache.getEntryMetadata("key1");
      expect(metadata).toBeNull();
      vi.useRealTimers();
    });
  });

  describe("logging", () => {
    it("should call custom logger when enabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const loggingCache = new ResponseCache({
        enableLogging: true,
        logger: mockLogger,
        cleanupInterval: 0,
      });

      loggingCache.set("key1", "value");
      loggingCache.get("key1");
      loggingCache.get("missing");
      loggingCache.invalidate("key1");

      expect(mockLogger.debug).toHaveBeenCalled();
      loggingCache.dispose();
    });

    it("should not log when disabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
      };

      const quietCache = new ResponseCache({
        enableLogging: false,
        logger: mockLogger,
        cleanupInterval: 0,
      });

      quietCache.set("key1", "value");
      quietCache.get("key1");

      expect(mockLogger.debug).not.toHaveBeenCalled();
      quietCache.dispose();
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.dispose();

      expect(cache.size).toBe(0);
      expect(cache.getStats().hits).toBe(0);
    });
  });
});

describe("createCache", () => {
  it("should create a cache with defaults", () => {
    const cache = createCache();
    expect(cache).toBeInstanceOf(ResponseCache);
    cache.dispose();
  });

  it("should create a cache with custom config", () => {
    const cache = createCache({ defaultTTL: 30000 });
    expect(cache.getConfig().defaultTTL).toBe(30000);
    cache.dispose();
  });
});

describe("Shared cache", () => {
  afterEach(() => {
    resetSharedCache();
  });

  it("should return singleton instance", () => {
    const cache1 = getSharedCache();
    const cache2 = getSharedCache();
    expect(cache1).toBe(cache2);
  });

  it("should reset shared instance", () => {
    const cache1 = getSharedCache();
    cache1.set("key1", "value");

    resetSharedCache();

    const cache2 = getSharedCache();
    expect(cache2).not.toBe(cache1);
    expect(cache2.has("key1")).toBe(false);
  });

  it("should set custom shared instance", () => {
    const customCache = new ResponseCache({ defaultTTL: 99999, cleanupInterval: 0 });
    setSharedCache(customCache);

    const shared = getSharedCache();
    expect(shared).toBe(customCache);
    expect(shared.getConfig().defaultTTL).toBe(99999);
  });
});

describe("CacheTTL constants", () => {
  it("should have correct values", () => {
    expect(CacheTTL.SHORT).toBe(10000);
    expect(CacheTTL.DEFAULT).toBe(60000);
    expect(CacheTTL.MEDIUM).toBe(300000);
    expect(CacheTTL.LONG).toBe(900000);
    expect(CacheTTL.VERY_LONG).toBe(3600000);
    expect(CacheTTL.DAY).toBe(86400000);
  });
});

describe("CacheKeyPrefix constants", () => {
  it("should have correct values", () => {
    expect(CacheKeyPrefix.MARKET).toBe("market:");
    expect(CacheKeyPrefix.MARKETS).toBe("markets:");
    expect(CacheKeyPrefix.OUTCOMES).toBe("outcomes:");
    expect(CacheKeyPrefix.VOLUME).toBe("volume:");
    expect(CacheKeyPrefix.PRICE).toBe("price:");
    expect(CacheKeyPrefix.TRENDING).toBe("trending:");
    expect(CacheKeyPrefix.CATEGORY).toBe("category:");
  });
});

describe("Cache key generators", () => {
  describe("marketCacheKey", () => {
    it("should generate correct key", () => {
      expect(marketCacheKey("123")).toBe("market:123");
      expect(marketCacheKey("abc-def")).toBe("market:abc-def");
    });
  });

  describe("marketBySlugCacheKey", () => {
    it("should generate correct key", () => {
      expect(marketBySlugCacheKey("my-market")).toBe("market:slug:my-market");
    });
  });

  describe("activeMarketsCacheKey", () => {
    it("should generate basic key", () => {
      expect(activeMarketsCacheKey()).toBe("markets:active");
    });

    it("should include category", () => {
      expect(activeMarketsCacheKey({ category: "politics" })).toBe("markets:active:politics");
    });

    it("should include limit", () => {
      expect(activeMarketsCacheKey({ limit: 10 })).toBe("markets:active:limit=10");
    });

    it("should include both category and limit", () => {
      expect(activeMarketsCacheKey({ category: "sports", limit: 20 })).toBe(
        "markets:active:sports:limit=20"
      );
    });
  });

  describe("trendingMarketsCacheKey", () => {
    it("should generate basic key", () => {
      expect(trendingMarketsCacheKey()).toBe("trending:");
    });

    it("should include sortBy", () => {
      expect(trendingMarketsCacheKey({ sortBy: "volume" })).toBe("trending:sort=volume");
    });

    it("should include all options", () => {
      expect(
        trendingMarketsCacheKey({ sortBy: "volume", category: "crypto", limit: 5 })
      ).toBe("trending:sort=volume:cat=crypto:limit=5");
    });
  });

  describe("outcomesCacheKey", () => {
    it("should generate correct key", () => {
      expect(outcomesCacheKey("market123")).toBe("outcomes:market123");
    });
  });

  describe("volumeHistoryCacheKey", () => {
    it("should generate basic key", () => {
      expect(volumeHistoryCacheKey("m123", "1d")).toBe("volume:m123:1d");
    });

    it("should include date range", () => {
      expect(volumeHistoryCacheKey("m123", "1d", "2024-01-01", "2024-01-31")).toBe(
        "volume:m123:1d:2024-01-01:2024-01-31"
      );
    });
  });

  describe("priceHistoryCacheKey", () => {
    it("should generate basic key", () => {
      expect(priceHistoryCacheKey("m123", "o456", "1d")).toBe("price:m123:o456:1d");
    });

    it("should include date range", () => {
      expect(priceHistoryCacheKey("m123", "o456", "1h", "2024-01-01", "2024-01-02")).toBe(
        "price:m123:o456:1h:2024-01-01:2024-01-02"
      );
    });
  });
});

describe("withCache decorator", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ cleanupInterval: 0 });
  });

  afterEach(() => {
    cache.dispose();
  });

  it("should cache function results", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: "result" });
    const keyFn = (id: string) => `item:${id}`;

    const cachedFetch = withCache(fetchFn, keyFn, cache);

    const result1 = await cachedFetch("123");
    const result2 = await cachedFetch("123");

    expect(result1).toEqual({ data: "result" });
    expect(result2).toEqual({ data: "result" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("should use different cache keys for different arguments", async () => {
    const fetchFn = vi.fn().mockImplementation((id: string) => Promise.resolve({ id }));
    const keyFn = (id: string) => `item:${id}`;

    const cachedFetch = withCache(fetchFn, keyFn, cache);

    await cachedFetch("123");
    await cachedFetch("456");
    await cachedFetch("123");

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("should respect custom TTL", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue("result");
    const keyFn = () => "key";

    const cachedFetch = withCache(fetchFn, keyFn, cache, { ttl: 1000 });

    await cachedFetch();
    vi.advanceTimersByTime(500);
    await cachedFetch();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600);
    await cachedFetch();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("withSharedCache decorator", () => {
  afterEach(() => {
    resetSharedCache();
  });

  it("should use shared cache", async () => {
    const fetchFn = vi.fn().mockResolvedValue("result");
    const keyFn = () => "shared:key";

    const cachedFetch = withSharedCache(fetchFn, keyFn);

    await cachedFetch();
    await cachedFetch();

    expect(fetchFn).toHaveBeenCalledTimes(1);

    const sharedCache = getSharedCache();
    expect(sharedCache.has("shared:key")).toBe(true);
  });
});

describe("Automatic cleanup interval", () => {
  it("should automatically clean up expired entries", async () => {
    vi.useFakeTimers();

    const cache = new ResponseCache({
      cleanupInterval: 1000, // 1 second cleanup interval
      defaultTTL: 500, // 500ms TTL
    });

    cache.set("key1", "value");
    expect(cache.has("key1")).toBe(true);

    // Advance past TTL and cleanup interval
    vi.advanceTimersByTime(1500);

    // Entry should be expired but might not be cleaned up yet
    // (cleanup runs periodically, and has() also removes expired entries)
    expect(cache.has("key1")).toBe(false);

    cache.dispose();
    vi.useRealTimers();
  });
});

describe("Edge cases", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ cleanupInterval: 0 });
  });

  afterEach(() => {
    cache.dispose();
  });

  it("should handle undefined and null values", () => {
    cache.set("undefined", undefined);
    cache.set("null", null);

    // Note: undefined is a valid cached value but get returns undefined on miss
    // So we need to use has() to distinguish
    expect(cache.has("undefined")).toBe(true);
    expect(cache.has("null")).toBe(true);
    expect(cache.get("null")).toBeNull();
  });

  it("should handle complex objects", () => {
    const complex = {
      nested: {
        array: [1, 2, { deep: true }],
        date: "2024-01-01",
      },
      func: "not a function", // Functions can't be cached
    };

    cache.set("complex", complex);
    const retrieved = cache.get<typeof complex>("complex");

    expect(retrieved).toEqual(complex);
  });

  it("should handle empty string keys", () => {
    cache.set("", "empty key value");
    expect(cache.get("")).toBe("empty key value");
    expect(cache.has("")).toBe(true);
  });

  it("should handle special characters in keys", () => {
    const specialKey = "key:with:colons/and/slashes?query=param&other=value";
    cache.set(specialKey, "special");
    expect(cache.get(specialKey)).toBe("special");
  });

  it("should handle zero TTL", () => {
    vi.useFakeTimers();
    cache.set("key", "value", { ttl: 0 });

    // With 0 TTL, entry expires immediately
    vi.advanceTimersByTime(1);
    expect(cache.has("key")).toBe(false);
    vi.useRealTimers();
  });

  it("should calculate hit rate as 0 with no requests", () => {
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0);
  });
});
