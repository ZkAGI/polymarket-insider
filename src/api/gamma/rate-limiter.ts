/**
 * Rate Limiter for Polymarket Gamma API
 *
 * Implements a token bucket algorithm with request queuing to
 * prevent API throttling and handle 429 responses gracefully.
 */

/**
 * Configuration options for the rate limiter
 */
export interface RateLimiterConfig {
  /**
   * Maximum number of tokens in the bucket
   * @default 10
   */
  maxTokens?: number;

  /**
   * Number of tokens to refill per interval
   * @default 1
   */
  refillRate?: number;

  /**
   * Interval in milliseconds between token refills
   * @default 1000 (1 second)
   */
  refillInterval?: number;

  /**
   * Maximum number of requests to queue
   * @default 100
   */
  maxQueueSize?: number;

  /**
   * Maximum time in milliseconds to wait for a token
   * @default 30000 (30 seconds)
   */
  maxWaitTime?: number;

  /**
   * Initial delay in ms for retry after 429 response
   * @default 1000 (1 second)
   */
  retryDelay?: number;

  /**
   * Maximum retry delay in ms (for exponential backoff)
   * @default 60000 (60 seconds)
   */
  maxRetryDelay?: number;
}

/**
 * Statistics about rate limiter usage
 */
export interface RateLimiterStats {
  /** Current number of tokens available */
  currentTokens: number;

  /** Maximum tokens the bucket can hold */
  maxTokens: number;

  /** Number of requests currently queued */
  queueSize: number;

  /** Maximum queue size */
  maxQueueSize: number;

  /** Total number of requests processed */
  totalRequests: number;

  /** Number of requests that had to wait for tokens */
  throttledRequests: number;

  /** Number of 429 responses received */
  rateLimitedResponses: number;

  /** Average wait time in ms for throttled requests */
  averageWaitTime: number;

  /** Whether the rate limiter is currently paused (e.g., due to 429) */
  isPaused: boolean;

  /** Time until next token refill in ms */
  timeUntilNextRefill: number;
}

/**
 * Queued request waiting for a token
 */
interface QueuedRequest {
  resolve: (value: void) => void;
  reject: (reason: Error) => void;
  enqueuedAt: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<RateLimiterConfig> = {
  maxTokens: 10,
  refillRate: 1,
  refillInterval: 1000,
  maxQueueSize: 100,
  maxWaitTime: 30000,
  retryDelay: 1000,
  maxRetryDelay: 60000,
};

/**
 * Token bucket rate limiter with request queuing
 *
 * This class implements a token bucket algorithm to control the rate of
 * API requests. When tokens are exhausted, requests are queued and
 * processed as tokens become available.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ maxTokens: 10, refillRate: 1 });
 *
 * // Acquire a token before making a request
 * await limiter.acquire();
 * const response = await fetch('/api/endpoint');
 *
 * // Handle 429 responses
 * if (response.status === 429) {
 *   limiter.handleRateLimitResponse(response);
 * }
 * ```
 */
export class RateLimiter {
  private readonly config: Required<RateLimiterConfig>;
  private tokens: number;
  private lastRefillTime: number;
  private refillIntervalId: ReturnType<typeof setInterval> | null = null;
  private queue: QueuedRequest[] = [];
  private isPaused = false;
  private pauseTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Statistics
  private totalRequests = 0;
  private throttledRequests = 0;
  private rateLimitedResponses = 0;
  private totalWaitTime = 0;

  constructor(config: RateLimiterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();
    this.startRefillInterval();
  }

  /**
   * Start the token refill interval
   */
  private startRefillInterval(): void {
    if (this.refillIntervalId !== null) {
      return;
    }

    this.refillIntervalId = setInterval(() => {
      this.refill();
    }, this.config.refillInterval);
  }

  /**
   * Stop the token refill interval
   */
  private stopRefillInterval(): void {
    if (this.refillIntervalId !== null) {
      clearInterval(this.refillIntervalId);
      this.refillIntervalId = null;
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    if (this.isPaused) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const intervalsElapsed = Math.floor(elapsed / this.config.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
      this.processQueue();
    }
  }

  /**
   * Try to consume a token immediately
   * @returns true if a token was consumed, false if no tokens available
   */
  private tryConsumeToken(): boolean {
    // First, do a manual refill check in case interval hasn't fired
    this.refill();

    if (this.isPaused || this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }

  /**
   * Process queued requests when tokens become available
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tryConsumeToken()) {
      const request = this.queue.shift();
      if (request) {
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }
        const waitTime = Date.now() - request.enqueuedAt;
        this.totalWaitTime += waitTime;
        request.resolve();
      }
    }
  }

  /**
   * Acquire a token, waiting if necessary
   *
   * This method will either consume a token immediately if one is available,
   * or queue the request and wait for a token to become available.
   *
   * @throws Error if the queue is full or if maxWaitTime is exceeded
   */
  public async acquire(): Promise<void> {
    this.totalRequests++;

    // Try to consume a token immediately
    if (this.tryConsumeToken()) {
      return;
    }

    // Check if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new RateLimiterError("Rate limiter queue is full", "QUEUE_FULL");
    }

    this.throttledRequests++;

    // Wait for a token
    return new Promise<void>((resolve, reject) => {
      const enqueuedAt = Date.now();

      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.queue.findIndex((r) => r.enqueuedAt === enqueuedAt);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(
          new RateLimiterError(
            `Timed out waiting for rate limit token after ${this.config.maxWaitTime}ms`,
            "TIMEOUT"
          )
        );
      }, this.config.maxWaitTime);

      this.queue.push({
        resolve,
        reject,
        enqueuedAt,
        timeoutId,
      });
    });
  }

  /**
   * Try to acquire a token without waiting
   *
   * @returns true if a token was acquired, false otherwise
   */
  public tryAcquire(): boolean {
    if (this.tryConsumeToken()) {
      this.totalRequests++;
      return true;
    }
    return false;
  }

  /**
   * Handle a 429 rate limit response from the API
   *
   * This will pause the rate limiter for a period of time based on
   * the Retry-After header or a default delay with exponential backoff.
   *
   * @param response - The 429 response or headers containing Retry-After
   * @param attemptNumber - Current retry attempt number (for exponential backoff)
   */
  public handleRateLimitResponse(
    response?: { headers?: { get?: (name: string) => string | null } } | number,
    attemptNumber = 1
  ): void {
    this.rateLimitedResponses++;

    let delay: number;

    // Check for Retry-After header
    if (typeof response === "object" && response?.headers?.get) {
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        // Retry-After can be seconds or HTTP date
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          delay = seconds * 1000;
        } else {
          const date = new Date(retryAfter);
          delay = Math.max(0, date.getTime() - Date.now());
        }
      } else {
        delay = this.calculateBackoffDelay(attemptNumber);
      }
    } else if (typeof response === "number") {
      // Direct delay in milliseconds
      delay = response;
    } else {
      delay = this.calculateBackoffDelay(attemptNumber);
    }

    this.pause(delay);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.retryDelay * Math.pow(2, attemptNumber - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.config.maxRetryDelay);
  }

  /**
   * Pause the rate limiter for a specified duration
   *
   * While paused, no tokens will be consumed or refilled, and all
   * acquire() calls will wait.
   *
   * @param duration - Duration to pause in milliseconds
   */
  public pause(duration: number): void {
    this.isPaused = true;

    // Clear any existing pause timeout
    if (this.pauseTimeoutId !== null) {
      clearTimeout(this.pauseTimeoutId);
    }

    this.pauseTimeoutId = setTimeout(() => {
      this.resume();
    }, duration);
  }

  /**
   * Resume the rate limiter after a pause
   */
  public resume(): void {
    this.isPaused = false;
    this.pauseTimeoutId = null;
    this.lastRefillTime = Date.now();
    this.processQueue();
  }

  /**
   * Get current rate limiter statistics
   */
  public getStats(): RateLimiterStats {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefillTime;
    const timeUntilNextRefill = Math.max(0, this.config.refillInterval - timeSinceLastRefill);

    return {
      currentTokens: this.tokens,
      maxTokens: this.config.maxTokens,
      queueSize: this.queue.length,
      maxQueueSize: this.config.maxQueueSize,
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      rateLimitedResponses: this.rateLimitedResponses,
      averageWaitTime:
        this.throttledRequests > 0 ? this.totalWaitTime / this.throttledRequests : 0,
      isPaused: this.isPaused,
      timeUntilNextRefill,
    };
  }

  /**
   * Reset all statistics
   */
  public resetStats(): void {
    this.totalRequests = 0;
    this.throttledRequests = 0;
    this.rateLimitedResponses = 0;
    this.totalWaitTime = 0;
  }

  /**
   * Reset the rate limiter to its initial state
   *
   * Clears the queue, resets tokens, and clears statistics
   */
  public reset(): void {
    // Clear pause state
    this.isPaused = false;
    if (this.pauseTimeoutId !== null) {
      clearTimeout(this.pauseTimeoutId);
      this.pauseTimeoutId = null;
    }

    // Reject all queued requests
    for (const request of this.queue) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(new RateLimiterError("Rate limiter was reset", "RESET"));
    }
    this.queue = [];

    // Reset tokens and stats
    this.tokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();
    this.resetStats();
  }

  /**
   * Dispose of the rate limiter, cleaning up any resources
   */
  public dispose(): void {
    this.stopRefillInterval();
    this.reset();
  }

  /**
   * Get the current token count (for testing/debugging)
   */
  public getTokenCount(): number {
    return this.tokens;
  }

  /**
   * Check if the rate limiter is currently paused
   */
  public isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Get the queue length (for testing/debugging)
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<RateLimiterConfig> {
    return { ...this.config };
  }
}

/**
 * Error thrown by the rate limiter
 */
export class RateLimiterError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RateLimiterError";
    this.code = code;
  }
}

/**
 * Create a rate limiter with default settings for the Gamma API
 *
 * The default settings are tuned for typical Gamma API usage:
 * - 10 requests per second burst capacity
 * - 1 request per second sustained rate
 *
 * @param config - Optional configuration overrides
 */
export function createRateLimiter(config: RateLimiterConfig = {}): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Singleton rate limiter instance for shared use
 *
 * This provides a shared rate limiter for all Gamma API requests.
 * Use this when you want all requests to be rate-limited together.
 */
let sharedRateLimiter: RateLimiter | null = null;

/**
 * Get the shared rate limiter instance
 *
 * Creates the shared instance on first call if it doesn't exist.
 */
export function getSharedRateLimiter(): RateLimiter {
  if (sharedRateLimiter === null) {
    sharedRateLimiter = new RateLimiter();
  }
  return sharedRateLimiter;
}

/**
 * Reset the shared rate limiter instance
 *
 * This disposes of the current shared instance, allowing a new one
 * to be created with fresh state.
 */
export function resetSharedRateLimiter(): void {
  if (sharedRateLimiter !== null) {
    sharedRateLimiter.dispose();
    sharedRateLimiter = null;
  }
}

/**
 * Decorator/wrapper for rate-limiting async functions
 *
 * @example
 * ```typescript
 * const rateLimitedFetch = withRateLimit(fetch, rateLimiter);
 * const response = await rateLimitedFetch('/api/endpoint');
 * ```
 */
export function withRateLimit<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  limiter: RateLimiter
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    await limiter.acquire();
    return fn(...args);
  }) as T;
}

/**
 * Execute a function with rate limiting and automatic 429 retry
 *
 * This helper wraps a fetch function and automatically handles
 * 429 responses with exponential backoff.
 *
 * @param fn - The async function to execute
 * @param limiter - The rate limiter to use
 * @param maxRetries - Maximum number of retries for 429 responses
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await executeWithRateLimit(
 *   async () => {
 *     const response = await fetch('/api/endpoint');
 *     return response.json();
 *   },
 *   rateLimiter,
 *   3
 * );
 * ```
 */
export async function executeWithRateLimit<T>(
  fn: () => Promise<{ status?: number; headers?: { get?: (name: string) => string | null } } & T>,
  limiter: RateLimiter,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    await limiter.acquire();

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
        limiter.handleRateLimitResponse(result, attempt);
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
        limiter.handleRateLimitResponse(undefined, attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new RateLimiterError("Request failed", "UNKNOWN");
}
