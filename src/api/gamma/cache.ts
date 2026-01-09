/**
 * Response Cache for Polymarket Gamma API
 *
 * Implements an in-memory cache with TTL (Time-To-Live) to reduce API calls
 * for frequently accessed data. Supports cache invalidation and monitoring.
 */

/**
 * Configuration options for the cache
 */
export interface CacheConfig {
  /**
   * Default TTL (Time-To-Live) in milliseconds
   * @default 60000 (1 minute)
   */
  defaultTTL?: number;

  /**
   * Maximum number of entries in the cache
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Whether to enable cache logging
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Custom logger function
   */
  logger?: CacheLogger;

  /**
   * Interval in ms for automatic cleanup of expired entries
   * Set to 0 to disable automatic cleanup
   * @default 60000 (1 minute)
   */
  cleanupInterval?: number;
}

/**
 * Cache entry with value and metadata
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T;

  /** Timestamp when the entry was created */
  createdAt: number;

  /** Timestamp when the entry expires */
  expiresAt: number;

  /** Number of times this entry has been hit */
  hitCount: number;

  /** TTL used for this entry */
  ttl: number;

  /** Optional tags for grouped invalidation */
  tags?: string[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries in cache */
  size: number;

  /** Maximum allowed entries */
  maxEntries: number;

  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Cache hit rate (0-1) */
  hitRate: number;

  /** Number of evictions due to max size */
  evictions: number;

  /** Number of expired entries removed */
  expirations: number;

  /** Number of manual invalidations */
  invalidations: number;

  /** Total memory usage estimate in bytes */
  estimatedMemoryBytes: number;
}

/**
 * Options for cache get/set operations
 */
export interface CacheOptions {
  /** Custom TTL for this entry (overrides default) */
  ttl?: number;

  /** Tags for grouped invalidation */
  tags?: string[];

  /** Whether to update TTL on cache hit */
  refreshOnHit?: boolean;
}

/**
 * Cache logger interface
 */
export interface CacheLogger {
  debug?: (message: string, data?: Record<string, unknown>) => void;
  info?: (message: string, data?: Record<string, unknown>) => void;
  warn?: (message: string, data?: Record<string, unknown>) => void;
  error?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<CacheConfig, "logger">> & { logger: CacheLogger | null } = {
  defaultTTL: 60000, // 1 minute
  maxEntries: 1000,
  enableLogging: false,
  logger: null,
  cleanupInterval: 60000, // 1 minute
};

/**
 * Default console logger
 */
const consoleLogger: CacheLogger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    console.debug(`[Cache] ${message}`, data ?? "");
  },
  info: (message: string, data?: Record<string, unknown>) => {
    console.info(`[Cache] ${message}`, data ?? "");
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[Cache] ${message}`, data ?? "");
  },
  error: (message: string, data?: Record<string, unknown>) => {
    console.error(`[Cache] ${message}`, data ?? "");
  },
};

/**
 * In-memory cache with TTL support
 *
 * This cache stores API responses with configurable TTL to reduce
 * unnecessary API calls. It supports:
 * - TTL-based expiration
 * - Size-based eviction (LRU)
 * - Tag-based invalidation
 * - Cache statistics
 *
 * @example
 * ```typescript
 * const cache = new ResponseCache({ defaultTTL: 60000 });
 *
 * // Get or fetch data
 * const data = await cache.getOrFetch(
 *   'markets:active',
 *   async () => fetchActiveMarkets(),
 *   { ttl: 30000 }
 * );
 *
 * // Invalidate specific key
 * cache.invalidate('markets:active');
 *
 * // Invalidate by tag
 * cache.invalidateByTag('markets');
 * ```
 */
export class ResponseCache {
  private readonly config: Required<Omit<CacheConfig, "logger">> & { logger: CacheLogger | null };
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private invalidations = 0;

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL ?? DEFAULT_CONFIG.defaultTTL,
      maxEntries: config.maxEntries ?? DEFAULT_CONFIG.maxEntries,
      enableLogging: config.enableLogging ?? DEFAULT_CONFIG.enableLogging,
      logger: config.logger ?? null,
      cleanupInterval: config.cleanupInterval ?? DEFAULT_CONFIG.cleanupInterval,
    };

    // Start automatic cleanup if enabled
    if (this.config.cleanupInterval > 0) {
      this.startCleanupInterval();
    }
  }

  /**
   * Get the logger (custom or default console)
   */
  private getLogger(): CacheLogger | null {
    if (!this.config.enableLogging) {
      return null;
    }
    return this.config.logger ?? consoleLogger;
  }

  /**
   * Log a message if logging is enabled
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>
  ): void {
    const logger = this.getLogger();
    if (logger?.[level]) {
      logger[level]?.(message, data);
    }
  }

  /**
   * Start the automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      return;
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop the automatic cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Evict entries if cache is at capacity (LRU strategy)
   */
  private evictIfNeeded(): void {
    while (this.cache.size >= this.config.maxEntries) {
      // Find the least recently used (oldest) entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
        this.log("debug", "Evicted entry due to max size", { key: oldestKey });
      } else {
        break;
      }
    }
  }

  /**
   * Get a value from the cache
   *
   * @param key - Cache key
   * @param options - Cache options
   * @returns The cached value or undefined if not found/expired
   */
  public get<T>(key: string, options?: CacheOptions): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      this.log("debug", "Cache miss", { key });
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.expirations++;
      this.misses++;
      this.log("debug", "Cache miss (expired)", { key });
      return undefined;
    }

    // Update hit count
    entry.hitCount++;
    this.hits++;

    // Optionally refresh TTL on hit
    if (options?.refreshOnHit) {
      entry.expiresAt = Date.now() + entry.ttl;
    }

    this.log("debug", "Cache hit", { key, hitCount: entry.hitCount });
    return entry.value;
  }

  /**
   * Set a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options
   */
  public set<T>(key: string, value: T, options?: CacheOptions): void {
    // Evict if needed before adding
    this.evictIfNeeded();

    const ttl = options?.ttl ?? this.config.defaultTTL;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      hitCount: 0,
      ttl,
      tags: options?.tags,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
    this.log("debug", "Cache set", { key, ttl, tags: options?.tags });
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if key exists and is valid
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from the cache
   *
   * @param key - Cache key to delete
   * @returns true if the key was deleted
   */
  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.invalidations++;
      this.log("debug", "Cache entry deleted", { key });
    }
    return deleted;
  }

  /**
   * Invalidate a specific key (alias for delete)
   *
   * @param key - Cache key to invalidate
   * @returns true if the key was invalidated
   */
  public invalidate(key: string): boolean {
    return this.delete(key);
  }

  /**
   * Invalidate all entries with a specific tag
   *
   * @param tag - Tag to invalidate
   * @returns Number of entries invalidated
   */
  public invalidateByTag(tag: string): number {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
      this.invalidations++;
    }

    this.log("info", "Invalidated entries by tag", { tag, count });
    return count;
  }

  /**
   * Invalidate all entries matching a key pattern (glob-like)
   *
   * Supports * as wildcard at start or end of pattern.
   *
   * @param pattern - Pattern to match (e.g., "markets:*", "*:active")
   * @returns Number of entries invalidated
   */
  public invalidateByPattern(pattern: string): number {
    let count = 0;
    const keysToDelete: string[] = [];

    // Convert pattern to regex
    const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
      this.invalidations++;
    }

    this.log("info", "Invalidated entries by pattern", { pattern, count });
    return count;
  }

  /**
   * Get or fetch data using cache
   *
   * If the key exists in cache and is not expired, returns the cached value.
   * Otherwise, calls the fetch function and caches the result.
   *
   * @param key - Cache key
   * @param fetchFn - Function to call if cache miss
   * @param options - Cache options
   * @returns The cached or fetched value
   */
  public async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key, options);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch and cache
    const value = await fetchFn();
    this.set(key, value, options);
    return value;
  }

  /**
   * Get or fetch data synchronously
   *
   * @param key - Cache key
   * @param fetchFn - Synchronous function to call if cache miss
   * @param options - Cache options
   * @returns The cached or fetched value
   */
  public getOrFetchSync<T>(key: string, fetchFn: () => T, options?: CacheOptions): T {
    // Try to get from cache first
    const cached = this.get<T>(key, options);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch and cache
    const value = fetchFn();
    this.set(key, value, options);
    return value;
  }

  /**
   * Clean up expired entries
   *
   * @returns Number of entries removed
   */
  public cleanup(): number {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
      this.expirations++;
    }

    if (count > 0) {
      this.log("debug", "Cleanup removed expired entries", { count });
    }

    return count;
  }

  /**
   * Clear all entries from the cache
   */
  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.log("info", "Cache cleared", { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      evictions: this.evictions,
      expirations: this.expirations,
      invalidations: this.invalidations,
      estimatedMemoryBytes: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimate memory usage of the cache
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;

    for (const [key, entry] of this.cache) {
      // Key string size (approximate)
      bytes += key.length * 2;

      // Entry overhead
      bytes += 64; // Object overhead + timestamps + counters

      // Value size (rough estimate)
      const valueStr = JSON.stringify(entry.value);
      bytes += valueStr.length * 2;

      // Tags
      if (entry.tags) {
        for (const tag of entry.tags) {
          bytes += tag.length * 2;
        }
      }
    }

    return bytes;
  }

  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
    this.invalidations = 0;
  }

  /**
   * Get all keys in the cache
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get the number of entries in the cache
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache configuration
   */
  public getConfig(): Required<Omit<CacheConfig, "logger">> {
    const { logger: _logger, ...config } = this.config;
    return config;
  }

  /**
   * Get entry metadata without the value
   */
  public getEntryMetadata(
    key: string
  ): Omit<CacheEntry<unknown>, "value"> & { exists: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      return null;
    }

    return {
      exists: true,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      hitCount: entry.hitCount,
      ttl: entry.ttl,
      tags: entry.tags,
    };
  }

  /**
   * Dispose of the cache, cleaning up resources
   */
  public dispose(): void {
    this.stopCleanupInterval();
    this.clear();
    this.resetStats();
  }
}

/**
 * Create a cache with default settings for Gamma API responses
 *
 * @param config - Optional configuration overrides
 */
export function createCache(config: CacheConfig = {}): ResponseCache {
  return new ResponseCache(config);
}

/**
 * Singleton cache instance for shared use
 */
let sharedCache: ResponseCache | null = null;

/**
 * Get the shared cache instance
 *
 * Creates the shared instance on first call if it doesn't exist.
 */
export function getSharedCache(): ResponseCache {
  if (sharedCache === null) {
    sharedCache = new ResponseCache();
  }
  return sharedCache;
}

/**
 * Reset the shared cache instance
 *
 * This disposes of the current shared instance, allowing a new one
 * to be created with fresh state.
 */
export function resetSharedCache(): void {
  if (sharedCache !== null) {
    sharedCache.dispose();
    sharedCache = null;
  }
}

/**
 * Set a custom shared cache instance
 *
 * @param cache - The cache instance to use as shared
 */
export function setSharedCache(cache: ResponseCache): void {
  if (sharedCache !== null) {
    sharedCache.dispose();
  }
  sharedCache = cache;
}

/**
 * Predefined TTL values for common use cases
 */
export const CacheTTL = {
  /** 10 seconds - for rapidly changing data */
  SHORT: 10000,

  /** 1 minute - default TTL */
  DEFAULT: 60000,

  /** 5 minutes - for moderately stable data */
  MEDIUM: 300000,

  /** 15 minutes - for stable data */
  LONG: 900000,

  /** 1 hour - for rarely changing data */
  VERY_LONG: 3600000,

  /** 24 hours - for static data */
  DAY: 86400000,
} as const;

/**
 * Predefined cache key prefixes for organized key naming
 */
export const CacheKeyPrefix = {
  MARKET: "market:",
  MARKETS: "markets:",
  OUTCOMES: "outcomes:",
  VOLUME: "volume:",
  PRICE: "price:",
  TRENDING: "trending:",
  CATEGORY: "category:",
} as const;

/**
 * Generate a cache key for a market by ID
 */
export function marketCacheKey(marketId: string): string {
  return `${CacheKeyPrefix.MARKET}${marketId}`;
}

/**
 * Generate a cache key for a market by slug
 */
export function marketBySlugCacheKey(slug: string): string {
  return `${CacheKeyPrefix.MARKET}slug:${slug}`;
}

/**
 * Generate a cache key for active markets
 */
export function activeMarketsCacheKey(options?: { category?: string; limit?: number }): string {
  let key = `${CacheKeyPrefix.MARKETS}active`;
  if (options?.category) {
    key += `:${options.category}`;
  }
  if (options?.limit) {
    key += `:limit=${options.limit}`;
  }
  return key;
}

/**
 * Generate a cache key for trending markets
 */
export function trendingMarketsCacheKey(options?: {
  sortBy?: string;
  category?: string;
  limit?: number;
}): string {
  let key = `${CacheKeyPrefix.TRENDING}`;
  const parts: string[] = [];
  if (options?.sortBy) {
    parts.push(`sort=${options.sortBy}`);
  }
  if (options?.category) {
    parts.push(`cat=${options.category}`);
  }
  if (options?.limit) {
    parts.push(`limit=${options.limit}`);
  }
  return key + parts.join(":");
}

/**
 * Generate a cache key for market outcomes
 */
export function outcomesCacheKey(marketId: string): string {
  return `${CacheKeyPrefix.OUTCOMES}${marketId}`;
}

/**
 * Generate a cache key for volume history
 */
export function volumeHistoryCacheKey(
  marketId: string,
  interval: string,
  startDate?: string,
  endDate?: string
): string {
  let key = `${CacheKeyPrefix.VOLUME}${marketId}:${interval}`;
  if (startDate) {
    key += `:${startDate}`;
  }
  if (endDate) {
    key += `:${endDate}`;
  }
  return key;
}

/**
 * Generate a cache key for price history
 */
export function priceHistoryCacheKey(
  marketId: string,
  outcomeId: string,
  interval: string,
  startDate?: string,
  endDate?: string
): string {
  let key = `${CacheKeyPrefix.PRICE}${marketId}:${outcomeId}:${interval}`;
  if (startDate) {
    key += `:${startDate}`;
  }
  if (endDate) {
    key += `:${endDate}`;
  }
  return key;
}

/**
 * Decorator for caching function results
 *
 * @example
 * ```typescript
 * const cachedGetMarket = withCache(
 *   async (id: string) => fetchMarket(id),
 *   (id) => `market:${id}`,
 *   cache,
 *   { ttl: 60000 }
 * );
 * ```
 */
export function withCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
  cache: ResponseCache,
  options?: CacheOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyFn(...args);
    return cache.getOrFetch(key, () => fn(...args), options);
  };
}

/**
 * Convenience wrapper for caching with the shared cache
 */
export function withSharedCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
  options?: CacheOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const cache = getSharedCache();
    const key = keyFn(...args);
    return cache.getOrFetch(key, () => fn(...args), options);
  };
}
