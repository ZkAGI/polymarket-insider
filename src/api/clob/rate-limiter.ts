/**
 * Rate Limiter for Polymarket CLOB API
 *
 * Implements a token bucket algorithm with request queuing specifically
 * tuned for CLOB API constraints. Supports different rate limits per
 * endpoint category and can share rate limiting with the Gamma API.
 */

import {
  RateLimiter,
  RateLimiterConfig,
  RateLimiterStats,
  RateLimiterError,
  createRateLimiter,
} from "../gamma/rate-limiter";

/**
 * CLOB API endpoint categories with different rate limits
 */
export enum ClobEndpointCategory {
  /** Public market data (order books, trades, markets) */
  PUBLIC = "public",
  /** Private user data (orders, positions, account) */
  PRIVATE = "private",
  /** Order placement and cancellation */
  TRADING = "trading",
  /** Historical data queries */
  HISTORICAL = "historical",
}

/**
 * Default rate limit configurations for each endpoint category
 *
 * These are conservative defaults based on typical API constraints.
 * Adjust based on your actual API tier/limits.
 */
const DEFAULT_CATEGORY_LIMITS: Record<ClobEndpointCategory, RateLimiterConfig> = {
  [ClobEndpointCategory.PUBLIC]: {
    maxTokens: 20, // Higher burst for public endpoints
    refillRate: 5, // 5 requests per second sustained
    refillInterval: 1000,
    maxQueueSize: 200,
    maxWaitTime: 30000,
    retryDelay: 1000,
    maxRetryDelay: 60000,
  },
  [ClobEndpointCategory.PRIVATE]: {
    maxTokens: 10,
    refillRate: 2, // 2 requests per second sustained
    refillInterval: 1000,
    maxQueueSize: 100,
    maxWaitTime: 30000,
    retryDelay: 2000,
    maxRetryDelay: 60000,
  },
  [ClobEndpointCategory.TRADING]: {
    maxTokens: 5, // Lower burst for trading to avoid issues
    refillRate: 1, // 1 request per second sustained
    refillInterval: 1000,
    maxQueueSize: 50,
    maxWaitTime: 30000,
    retryDelay: 5000, // Longer retry delay for trading
    maxRetryDelay: 120000,
  },
  [ClobEndpointCategory.HISTORICAL]: {
    maxTokens: 10,
    refillRate: 2,
    refillInterval: 1000,
    maxQueueSize: 100,
    maxWaitTime: 60000, // Longer wait for historical queries
    retryDelay: 2000,
    maxRetryDelay: 60000,
  },
};

/**
 * Configuration for the CLOB rate limiter
 */
export interface ClobRateLimiterConfig {
  /**
   * Custom rate limits per endpoint category
   */
  categoryLimits?: Partial<Record<ClobEndpointCategory, RateLimiterConfig>>;

  /**
   * Global rate limiter to share across all categories
   * When set, this limiter is used in addition to category-specific limiters
   */
  sharedLimiter?: RateLimiter;

  /**
   * Whether to use the global shared limiter from the Gamma API
   * @default false
   */
  useGammaSharedLimiter?: boolean;

  /**
   * Whether to log rate limit events
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Custom logger function
   */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Statistics for the CLOB rate limiter including per-category stats
 */
export interface ClobRateLimiterStats {
  /** Stats per endpoint category */
  categories: Record<ClobEndpointCategory, RateLimiterStats>;

  /** Shared limiter stats (if configured) */
  shared?: RateLimiterStats;

  /** Total requests across all categories */
  totalRequests: number;

  /** Total throttled requests across all categories */
  totalThrottled: number;

  /** Total 429 responses across all categories */
  totalRateLimited: number;

  /** Most constrained category (lowest available tokens) */
  mostConstrainedCategory?: ClobEndpointCategory;
}

/**
 * Logger interface for the CLOB rate limiter
 */
type Logger = (message: string, data?: Record<string, unknown>) => void;

/**
 * Default console logger
 */
const defaultLogger: Logger = (message: string, data?: Record<string, unknown>) => {
  if (data) {
    console.log(`[ClobRateLimiter] ${message}`, data);
  } else {
    console.log(`[ClobRateLimiter] ${message}`);
  }
};

/**
 * CLOB API Rate Limiter with per-endpoint category limits
 *
 * This class manages rate limiting for the CLOB API with different
 * limits for different endpoint categories (public, private, trading, historical).
 *
 * @example
 * ```typescript
 * const limiter = new ClobRateLimiter({
 *   enableLogging: true,
 * });
 *
 * // Acquire a token for a public endpoint
 * await limiter.acquire(ClobEndpointCategory.PUBLIC);
 * const orderBook = await client.get('/book?token_id=123');
 *
 * // Acquire a token for a trading endpoint
 * await limiter.acquire(ClobEndpointCategory.TRADING);
 * const order = await client.post('/order', orderData);
 * ```
 */
export class ClobRateLimiter {
  private readonly categoryLimiters: Map<ClobEndpointCategory, RateLimiter>;
  private readonly sharedLimiter: RateLimiter | null;
  private readonly enableLogging: boolean;
  private readonly logger: Logger;

  constructor(config: ClobRateLimiterConfig = {}) {
    const {
      categoryLimits = {},
      sharedLimiter,
      useGammaSharedLimiter = false,
      enableLogging = false,
      logger = defaultLogger,
    } = config;

    this.enableLogging = enableLogging;
    this.logger = logger;

    // Create rate limiters for each category
    this.categoryLimiters = new Map();
    for (const category of Object.values(ClobEndpointCategory)) {
      const defaultConfig = DEFAULT_CATEGORY_LIMITS[category];
      const customConfig = categoryLimits[category];
      const mergedConfig = { ...defaultConfig, ...customConfig };
      this.categoryLimiters.set(category, new RateLimiter(mergedConfig));
    }

    // Set up shared limiter
    if (sharedLimiter) {
      this.sharedLimiter = sharedLimiter;
    } else if (useGammaSharedLimiter) {
      // Import dynamically to avoid circular dependencies
      const { getSharedRateLimiter } = require("../gamma/rate-limiter");
      this.sharedLimiter = getSharedRateLimiter();
    } else {
      this.sharedLimiter = null;
    }

    if (this.enableLogging) {
      this.log("CLOB rate limiter initialized", {
        categories: Object.values(ClobEndpointCategory),
        hasSharedLimiter: this.sharedLimiter !== null,
      });
    }
  }

  /**
   * Log a message if logging is enabled
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.enableLogging) {
      this.logger(message, data);
    }
  }

  /**
   * Get the rate limiter for a specific category
   */
  public getCategoryLimiter(category: ClobEndpointCategory): RateLimiter | undefined {
    return this.categoryLimiters.get(category);
  }

  /**
   * Get the shared rate limiter (if configured)
   */
  public getSharedLimiter(): RateLimiter | null {
    return this.sharedLimiter;
  }

  /**
   * Acquire a token for a specific endpoint category
   *
   * This will wait for both the category-specific limiter and the
   * shared limiter (if configured) to have tokens available.
   *
   * @param category - The endpoint category
   * @throws RateLimiterError if the queue is full or timeout is exceeded
   */
  public async acquire(category: ClobEndpointCategory = ClobEndpointCategory.PUBLIC): Promise<void> {
    const categoryLimiter = this.categoryLimiters.get(category);
    if (!categoryLimiter) {
      throw new RateLimiterError(`Unknown category: ${category}`, "UNKNOWN_CATEGORY");
    }

    this.log(`Acquiring token for category: ${category}`, {
      category,
      queueSize: categoryLimiter.getQueueLength(),
      tokens: categoryLimiter.getTokenCount(),
    });

    // Acquire from shared limiter first (if configured)
    if (this.sharedLimiter) {
      await this.sharedLimiter.acquire();
    }

    // Then acquire from category-specific limiter
    await categoryLimiter.acquire();

    this.log(`Token acquired for category: ${category}`);
  }

  /**
   * Try to acquire a token without waiting
   *
   * @param category - The endpoint category
   * @returns true if a token was acquired, false otherwise
   */
  public tryAcquire(category: ClobEndpointCategory = ClobEndpointCategory.PUBLIC): boolean {
    const categoryLimiter = this.categoryLimiters.get(category);
    if (!categoryLimiter) {
      return false;
    }

    // Check shared limiter first
    if (this.sharedLimiter && !this.sharedLimiter.tryAcquire()) {
      return false;
    }

    // Then check category limiter
    const acquired = categoryLimiter.tryAcquire();

    if (acquired) {
      this.log(`Token acquired (non-blocking) for category: ${category}`);
    }

    return acquired;
  }

  /**
   * Handle a 429 rate limit response
   *
   * @param category - The endpoint category that received the 429
   * @param response - The 429 response or retry delay in ms
   * @param attemptNumber - Current retry attempt number
   */
  public handleRateLimitResponse(
    category: ClobEndpointCategory,
    response?: { headers?: { get?: (name: string) => string | null } } | number,
    attemptNumber = 1
  ): void {
    const categoryLimiter = this.categoryLimiters.get(category);
    if (categoryLimiter) {
      categoryLimiter.handleRateLimitResponse(response, attemptNumber);

      this.log(`Rate limit response handled for category: ${category}`, {
        category,
        attemptNumber,
        isPaused: categoryLimiter.isPausedState(),
      });
    }

    // Also notify shared limiter if configured
    if (this.sharedLimiter) {
      this.sharedLimiter.handleRateLimitResponse(response, attemptNumber);
    }
  }

  /**
   * Get statistics for all rate limiters
   */
  public getStats(): ClobRateLimiterStats {
    const categories: Record<ClobEndpointCategory, RateLimiterStats> = {} as Record<
      ClobEndpointCategory,
      RateLimiterStats
    >;

    let totalRequests = 0;
    let totalThrottled = 0;
    let totalRateLimited = 0;
    let mostConstrainedCategory: ClobEndpointCategory | undefined;
    let lowestTokenRatio = Infinity;

    for (const [category, limiter] of this.categoryLimiters) {
      const stats = limiter.getStats();
      categories[category] = stats;
      totalRequests += stats.totalRequests;
      totalThrottled += stats.throttledRequests;
      totalRateLimited += stats.rateLimitedResponses;

      // Find most constrained category
      const tokenRatio = stats.currentTokens / stats.maxTokens;
      if (tokenRatio < lowestTokenRatio) {
        lowestTokenRatio = tokenRatio;
        mostConstrainedCategory = category;
      }
    }

    const result: ClobRateLimiterStats = {
      categories,
      totalRequests,
      totalThrottled,
      totalRateLimited,
      mostConstrainedCategory,
    };

    if (this.sharedLimiter) {
      result.shared = this.sharedLimiter.getStats();
      totalRequests += result.shared.totalRequests;
      totalThrottled += result.shared.throttledRequests;
      totalRateLimited += result.shared.rateLimitedResponses;
    }

    return result;
  }

  /**
   * Get statistics for a specific category
   */
  public getCategoryStats(category: ClobEndpointCategory): RateLimiterStats | null {
    const limiter = this.categoryLimiters.get(category);
    return limiter ? limiter.getStats() : null;
  }

  /**
   * Log current rate limit status
   */
  public logStatus(): void {
    const stats = this.getStats();
    this.log("Rate limiter status", {
      totalRequests: stats.totalRequests,
      totalThrottled: stats.totalThrottled,
      totalRateLimited: stats.totalRateLimited,
      mostConstrainedCategory: stats.mostConstrainedCategory,
      categories: Object.fromEntries(
        Object.entries(stats.categories).map(([cat, s]) => [
          cat,
          {
            tokens: `${s.currentTokens}/${s.maxTokens}`,
            queue: s.queueSize,
            paused: s.isPaused,
          },
        ])
      ),
    });
  }

  /**
   * Reset statistics for all rate limiters
   */
  public resetStats(): void {
    for (const limiter of this.categoryLimiters.values()) {
      limiter.resetStats();
    }
    if (this.sharedLimiter) {
      this.sharedLimiter.resetStats();
    }

    this.log("Statistics reset");
  }

  /**
   * Reset a specific category to its initial state
   */
  public resetCategory(category: ClobEndpointCategory): void {
    const limiter = this.categoryLimiters.get(category);
    if (limiter) {
      limiter.reset();
      this.log(`Category reset: ${category}`);
    }
  }

  /**
   * Reset all rate limiters to their initial state
   */
  public reset(): void {
    for (const limiter of this.categoryLimiters.values()) {
      limiter.reset();
    }
    // Don't reset shared limiter as it might be used by other modules

    this.log("All categories reset");
  }

  /**
   * Pause a specific category
   *
   * @param category - The category to pause
   * @param duration - Duration in milliseconds
   */
  public pauseCategory(category: ClobEndpointCategory, duration: number): void {
    const limiter = this.categoryLimiters.get(category);
    if (limiter) {
      limiter.pause(duration);
      this.log(`Category paused: ${category}`, { duration });
    }
  }

  /**
   * Resume a specific category
   */
  public resumeCategory(category: ClobEndpointCategory): void {
    const limiter = this.categoryLimiters.get(category);
    if (limiter) {
      limiter.resume();
      this.log(`Category resumed: ${category}`);
    }
  }

  /**
   * Check if a category is paused
   */
  public isCategoryPaused(category: ClobEndpointCategory): boolean {
    const limiter = this.categoryLimiters.get(category);
    return limiter ? limiter.isPausedState() : false;
  }

  /**
   * Dispose of all rate limiters and clean up resources
   */
  public dispose(): void {
    for (const limiter of this.categoryLimiters.values()) {
      limiter.dispose();
    }
    this.categoryLimiters.clear();
    // Don't dispose shared limiter as it might be used by other modules

    this.log("Rate limiter disposed");
  }
}

/**
 * Endpoint pattern to category mapping
 *
 * Patterns are checked in order, so more specific patterns come first.
 * The /order vs /orders distinction is important:
 * - /order is for placing a single order (trading)
 * - /orders is for listing orders (private)
 */
const ENDPOINT_PATTERNS: Array<{ pattern: RegExp; category: ClobEndpointCategory }> = [
  // Trading endpoints - more specific patterns first
  { pattern: /^\/orders\/cancel/i, category: ClobEndpointCategory.TRADING },
  { pattern: /^\/orders\/amend/i, category: ClobEndpointCategory.TRADING },
  // Note: /order$ or /order/ matches single order placement, not /orders
  { pattern: /^\/order($|\/|\?)/i, category: ClobEndpointCategory.TRADING },

  // Private endpoints
  { pattern: /^\/orders($|\/|\?)/i, category: ClobEndpointCategory.PRIVATE },
  { pattern: /^\/positions/i, category: ClobEndpointCategory.PRIVATE },
  { pattern: /^\/account/i, category: ClobEndpointCategory.PRIVATE },
  { pattern: /^\/balances/i, category: ClobEndpointCategory.PRIVATE },
  { pattern: /^\/auth/i, category: ClobEndpointCategory.PRIVATE },

  // Historical endpoints
  { pattern: /^\/trades.*\?(.*&)?maker=|taker=/i, category: ClobEndpointCategory.HISTORICAL },
  { pattern: /^\/trades.*\?(.*&)?start_ts=/i, category: ClobEndpointCategory.HISTORICAL },
  { pattern: /history/i, category: ClobEndpointCategory.HISTORICAL },

  // Public endpoints (default)
  { pattern: /^\/book/i, category: ClobEndpointCategory.PUBLIC },
  { pattern: /^\/trades/i, category: ClobEndpointCategory.PUBLIC },
  { pattern: /^\/markets/i, category: ClobEndpointCategory.PUBLIC },
  { pattern: /^\/price/i, category: ClobEndpointCategory.PUBLIC },
  { pattern: /^\/midpoint/i, category: ClobEndpointCategory.PUBLIC },
];

/**
 * Determine the endpoint category from a URL path
 *
 * @param endpoint - The API endpoint path
 * @returns The endpoint category
 */
export function getEndpointCategory(endpoint: string): ClobEndpointCategory {
  // Normalize endpoint - extract path if it's a full URL
  let path = endpoint;
  if (endpoint.startsWith("http")) {
    try {
      const url = new URL(endpoint);
      path = url.pathname + url.search;
    } catch {
      // If URL parsing fails, use the original endpoint
    }
  }

  // Match against patterns in order (more specific patterns first)
  for (const { pattern, category } of ENDPOINT_PATTERNS) {
    if (pattern.test(path)) {
      return category;
    }
  }

  // Default to public
  return ClobEndpointCategory.PUBLIC;
}

/**
 * Singleton CLOB rate limiter instance
 */
let sharedClobRateLimiter: ClobRateLimiter | null = null;

/**
 * Get the shared CLOB rate limiter instance
 *
 * Creates the instance on first call with default configuration.
 */
export function getSharedClobRateLimiter(): ClobRateLimiter {
  if (sharedClobRateLimiter === null) {
    sharedClobRateLimiter = new ClobRateLimiter();
  }
  return sharedClobRateLimiter;
}

/**
 * Set the shared CLOB rate limiter instance
 *
 * Use this to configure a custom rate limiter for all CLOB API requests.
 */
export function setSharedClobRateLimiter(limiter: ClobRateLimiter): void {
  if (sharedClobRateLimiter) {
    sharedClobRateLimiter.dispose();
  }
  sharedClobRateLimiter = limiter;
}

/**
 * Reset the shared CLOB rate limiter instance
 *
 * Disposes of the current instance and allows a new one to be created.
 */
export function resetSharedClobRateLimiter(): void {
  if (sharedClobRateLimiter) {
    sharedClobRateLimiter.dispose();
    sharedClobRateLimiter = null;
  }
}

/**
 * Create a CLOB rate limiter with custom configuration
 *
 * @param config - Rate limiter configuration
 * @returns New ClobRateLimiter instance
 */
export function createClobRateLimiter(config: ClobRateLimiterConfig = {}): ClobRateLimiter {
  return new ClobRateLimiter(config);
}

/**
 * Decorator/wrapper for rate-limiting async functions with automatic category detection
 *
 * @param fn - The async function to wrap
 * @param limiter - The rate limiter to use
 * @param category - Optional fixed category (auto-detected if not provided)
 * @returns Wrapped function with rate limiting
 *
 * @example
 * ```typescript
 * const limitedGetOrderBook = withClobRateLimit(
 *   async (tokenId: string) => client.get(`/book?token_id=${tokenId}`),
 *   rateLimiter
 * );
 * ```
 */
export function withClobRateLimit<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  limiter: ClobRateLimiter,
  category?: ClobEndpointCategory
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const effectiveCategory = category ?? ClobEndpointCategory.PUBLIC;
    await limiter.acquire(effectiveCategory);
    return fn(...args);
  }) as T;
}

/**
 * Execute a function with rate limiting and automatic 429 retry
 *
 * @param fn - The async function to execute
 * @param limiter - The rate limiter to use
 * @param category - The endpoint category
 * @param maxRetries - Maximum number of retries for 429 responses
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await executeWithClobRateLimit(
 *   async () => client.get('/book?token_id=123'),
 *   rateLimiter,
 *   ClobEndpointCategory.PUBLIC,
 *   3
 * );
 * ```
 */
export async function executeWithClobRateLimit<T>(
  fn: () => Promise<{ status?: number; headers?: { get?: (name: string) => string | null } } & T>,
  limiter: ClobRateLimiter,
  category: ClobEndpointCategory = ClobEndpointCategory.PUBLIC,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    await limiter.acquire(category);

    try {
      const result = await fn();

      // Check if it's a Response object with 429 status
      if (result && typeof result === "object" && "status" in result && result.status === 429) {
        if (attempt > maxRetries) {
          throw new RateLimiterError(
            `Rate limited after ${maxRetries} retries`,
            "MAX_RETRIES_EXCEEDED"
          );
        }
        limiter.handleRateLimitResponse(category, result, attempt);
        continue;
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a 429 error, handle it and retry
      if (
        lastError.message.includes("429") ||
        lastError.message.toLowerCase().includes("rate limit")
      ) {
        if (attempt > maxRetries) {
          throw lastError;
        }
        limiter.handleRateLimitResponse(category, undefined, attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new RateLimiterError("Request failed", "UNKNOWN");
}

// Re-export base rate limiter types and classes for convenience
export { RateLimiter, RateLimiterError, createRateLimiter };
export type { RateLimiterConfig, RateLimiterStats };
