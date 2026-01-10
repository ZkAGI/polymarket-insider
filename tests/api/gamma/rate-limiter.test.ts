/**
 * Tests for the Gamma API Rate Limiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RateLimiter,
  RateLimiterError,
  createRateLimiter,
  getSharedRateLimiter,
  resetSharedRateLimiter,
  withRateLimit,
  executeWithRateLimit,
  RateLimiterConfig,
} from "../../../src/api/gamma/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.dispose();
    }
    resetSharedRateLimiter();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create a rate limiter with default configuration", () => {
      limiter = new RateLimiter();
      const config = limiter.getConfig();

      expect(config.maxTokens).toBe(10);
      expect(config.refillRate).toBe(1);
      expect(config.refillInterval).toBe(1000);
      expect(config.maxQueueSize).toBe(100);
      expect(config.maxWaitTime).toBe(30000);
      expect(config.retryDelay).toBe(1000);
      expect(config.maxRetryDelay).toBe(60000);
    });

    it("should create a rate limiter with custom configuration", () => {
      const customConfig: RateLimiterConfig = {
        maxTokens: 5,
        refillRate: 2,
        refillInterval: 500,
        maxQueueSize: 50,
        maxWaitTime: 10000,
        retryDelay: 2000,
        maxRetryDelay: 30000,
      };

      limiter = new RateLimiter(customConfig);
      const config = limiter.getConfig();

      expect(config.maxTokens).toBe(5);
      expect(config.refillRate).toBe(2);
      expect(config.refillInterval).toBe(500);
      expect(config.maxQueueSize).toBe(50);
      expect(config.maxWaitTime).toBe(10000);
      expect(config.retryDelay).toBe(2000);
      expect(config.maxRetryDelay).toBe(30000);
    });

    it("should start with max tokens available", () => {
      limiter = new RateLimiter({ maxTokens: 5 });
      expect(limiter.getTokenCount()).toBe(5);
    });
  });

  describe("acquire()", () => {
    it("should immediately grant a token when available", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });
      const initialTokens = limiter.getTokenCount();

      await limiter.acquire();

      expect(limiter.getTokenCount()).toBe(initialTokens - 1);
    });

    it("should consume tokens for each acquire", async () => {
      limiter = new RateLimiter({ maxTokens: 3 });

      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.getTokenCount()).toBe(0);
    });

    it("should queue requests when no tokens available", async () => {
      limiter = new RateLimiter({ maxTokens: 1, refillInterval: 1000 });

      await limiter.acquire(); // Use the only token
      expect(limiter.getTokenCount()).toBe(0);

      // This should queue
      const promise = limiter.acquire();
      expect(limiter.getQueueLength()).toBe(1);

      // Fast-forward to refill
      vi.advanceTimersByTime(1000);

      await promise;
      expect(limiter.getQueueLength()).toBe(0);
    });

    it("should throw error when queue is full", async () => {
      limiter = new RateLimiter({ maxTokens: 1, maxQueueSize: 2 });

      await limiter.acquire(); // Use the token

      // Queue up to max
      const p1 = limiter.acquire();
      const p2 = limiter.acquire();
      expect(limiter.getQueueLength()).toBe(2);

      // This should throw
      await expect(limiter.acquire()).rejects.toThrow(RateLimiterError);
      await expect(limiter.acquire()).rejects.toThrow("queue is full");

      // Clean up
      vi.advanceTimersByTime(2000);
      await Promise.all([p1, p2]);
    });

    it("should timeout if waiting too long", async () => {
      limiter = new RateLimiter({
        maxTokens: 1,
        maxWaitTime: 5000,
        refillInterval: 10000, // Slow refill
      });

      await limiter.acquire(); // Use the token

      const promise = limiter.acquire();

      // Fast-forward past the timeout
      vi.advanceTimersByTime(6000);

      await expect(promise).rejects.toThrow(RateLimiterError);
      await expect(promise).rejects.toThrow("Timed out");
    });

    it("should track statistics correctly", async () => {
      limiter = new RateLimiter({ maxTokens: 2, refillInterval: 1000 });

      await limiter.acquire();
      await limiter.acquire();

      let stats = limiter.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.throttledRequests).toBe(0);

      // This will be throttled
      const promise = limiter.acquire();
      vi.advanceTimersByTime(1000);
      await promise;

      stats = limiter.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.throttledRequests).toBe(1);
    });
  });

  describe("tryAcquire()", () => {
    it("should return true when token is available", () => {
      limiter = new RateLimiter({ maxTokens: 3 });

      expect(limiter.tryAcquire()).toBe(true);
      expect(limiter.getTokenCount()).toBe(2);
    });

    it("should return false when no tokens available", async () => {
      limiter = new RateLimiter({ maxTokens: 1 });

      await limiter.acquire(); // Use the token
      expect(limiter.tryAcquire()).toBe(false);
      expect(limiter.getQueueLength()).toBe(0); // Should not queue
    });

    it("should count in statistics", () => {
      limiter = new RateLimiter({ maxTokens: 1 });

      limiter.tryAcquire();
      expect(limiter.getStats().totalRequests).toBe(1);

      limiter.tryAcquire(); // This fails, should not count
      expect(limiter.getStats().totalRequests).toBe(1);
    });
  });

  describe("token refill", () => {
    it("should refill tokens at the configured rate", async () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        refillRate: 1,
        refillInterval: 1000,
      });

      // Use all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }
      expect(limiter.getTokenCount()).toBe(0);

      // Wait for refills
      vi.advanceTimersByTime(3000);
      expect(limiter.getTokenCount()).toBe(3);
    });

    it("should not exceed max tokens when refilling", async () => {
      limiter = new RateLimiter({
        maxTokens: 3,
        refillRate: 2,
        refillInterval: 1000,
      });

      // Use one token
      await limiter.acquire();
      expect(limiter.getTokenCount()).toBe(2);

      // Wait for multiple refills
      vi.advanceTimersByTime(5000);

      // Should be capped at maxTokens
      expect(limiter.getTokenCount()).toBe(3);
    });

    it("should refill multiple tokens per interval", async () => {
      limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 3,
        refillInterval: 1000,
      });

      // Use all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      vi.advanceTimersByTime(2000);
      expect(limiter.getTokenCount()).toBe(6); // 2 intervals * 3 tokens
    });
  });

  describe("handleRateLimitResponse()", () => {
    it("should pause the limiter when called", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      limiter.handleRateLimitResponse(1000);

      expect(limiter.isPausedState()).toBe(true);
      expect(limiter.getStats().rateLimitedResponses).toBe(1);
    });

    it("should resume after the specified delay", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      limiter.handleRateLimitResponse(2000);
      expect(limiter.isPausedState()).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(limiter.isPausedState()).toBe(false);
    });

    it("should parse Retry-After header in seconds", () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      const mockResponse = {
        headers: {
          get: (name: string) => (name === "Retry-After" ? "5" : null),
        },
      };

      limiter.handleRateLimitResponse(mockResponse);
      expect(limiter.isPausedState()).toBe(true);

      // Should resume after 5 seconds
      vi.advanceTimersByTime(4999);
      expect(limiter.isPausedState()).toBe(true);

      vi.advanceTimersByTime(1);
      expect(limiter.isPausedState()).toBe(false);
    });

    it("should use exponential backoff without Retry-After", () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        retryDelay: 1000,
        maxRetryDelay: 10000,
      });

      // First attempt: 1000ms base
      limiter.handleRateLimitResponse(undefined, 1);
      expect(limiter.isPausedState()).toBe(true);

      // Resume to test second call
      limiter.resume();

      // Second attempt: 2000ms (2^1 * 1000)
      limiter.handleRateLimitResponse(undefined, 2);
      expect(limiter.isPausedState()).toBe(true);
    });

    it("should cap exponential backoff at maxRetryDelay", () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        retryDelay: 1000,
        maxRetryDelay: 5000,
      });

      // High attempt number that would exceed max
      limiter.handleRateLimitResponse(undefined, 10);

      // Should resume within maxRetryDelay + some jitter
      vi.advanceTimersByTime(6000);
      expect(limiter.isPausedState()).toBe(false);
    });

    it("should not refill tokens while paused", async () => {
      limiter = new RateLimiter({
        maxTokens: 5,
        refillRate: 1,
        refillInterval: 1000,
      });

      // Use all tokens
      for (let i = 0; i < 5; i++) {
        await limiter.acquire();
      }

      limiter.handleRateLimitResponse(5000);

      // Advance time, but tokens shouldn't refill while paused
      vi.advanceTimersByTime(3000);
      expect(limiter.isPausedState()).toBe(true);
      expect(limiter.getTokenCount()).toBe(0);

      // After resume, tokens can refill
      vi.advanceTimersByTime(3000); // This triggers resume at 5000ms
      expect(limiter.isPausedState()).toBe(false);
    });
  });

  describe("pause() and resume()", () => {
    it("should pause token consumption", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      limiter.pause(10000);
      expect(limiter.isPausedState()).toBe(true);

      // Try to acquire - should not work immediately
      expect(limiter.tryAcquire()).toBe(false);
    });

    it("should queue requests while paused", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      limiter.pause(10000);

      const promise = limiter.acquire();
      expect(limiter.getQueueLength()).toBe(1);

      limiter.resume();
      await promise;
      expect(limiter.getQueueLength()).toBe(0);
    });

    it("should process queued requests on resume", async () => {
      limiter = new RateLimiter({ maxTokens: 2 });

      limiter.pause(10000);

      const results: number[] = [];
      const p1 = limiter.acquire().then(() => results.push(1));
      const p2 = limiter.acquire().then(() => results.push(2));

      expect(limiter.getQueueLength()).toBe(2);

      limiter.resume();
      await Promise.all([p1, p2]);

      expect(results).toEqual([1, 2]);
    });
  });

  describe("getStats()", () => {
    it("should return accurate statistics", async () => {
      limiter = new RateLimiter({ maxTokens: 3, refillInterval: 1000 });

      await limiter.acquire();
      await limiter.acquire();

      const stats = limiter.getStats();

      expect(stats.currentTokens).toBe(1);
      expect(stats.maxTokens).toBe(3);
      expect(stats.totalRequests).toBe(2);
      expect(stats.throttledRequests).toBe(0);
      expect(stats.queueSize).toBe(0);
      expect(stats.isPaused).toBe(false);
    });

    it("should track throttled requests and average wait time", async () => {
      limiter = new RateLimiter({
        maxTokens: 1,
        refillInterval: 100,
      });

      await limiter.acquire(); // Use the token

      const promise = limiter.acquire();
      vi.advanceTimersByTime(100);
      await promise;

      const stats = limiter.getStats();
      expect(stats.throttledRequests).toBe(1);
      expect(stats.averageWaitTime).toBeGreaterThan(0);
    });
  });

  describe("reset()", () => {
    it("should reset tokens to max", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      await limiter.acquire();
      await limiter.acquire();
      expect(limiter.getTokenCount()).toBe(3);

      limiter.reset();
      expect(limiter.getTokenCount()).toBe(5);
    });

    it("should clear the queue and reject pending requests", async () => {
      limiter = new RateLimiter({ maxTokens: 1 });

      await limiter.acquire();

      const promise = limiter.acquire();
      expect(limiter.getQueueLength()).toBe(1);

      limiter.reset();
      expect(limiter.getQueueLength()).toBe(0);

      await expect(promise).rejects.toThrow(RateLimiterError);
      await expect(promise).rejects.toThrow("reset");
    });

    it("should clear pause state", () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      limiter.pause(10000);
      expect(limiter.isPausedState()).toBe(true);

      limiter.reset();
      expect(limiter.isPausedState()).toBe(false);
    });

    it("should reset statistics", async () => {
      limiter = new RateLimiter({ maxTokens: 2 });

      await limiter.acquire();
      await limiter.acquire();

      let stats = limiter.getStats();
      expect(stats.totalRequests).toBe(2);

      limiter.reset();

      stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("resetStats()", () => {
    it("should only reset statistics without affecting tokens", async () => {
      limiter = new RateLimiter({ maxTokens: 5 });

      await limiter.acquire();
      await limiter.acquire();

      let stats = limiter.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(limiter.getTokenCount()).toBe(3);

      limiter.resetStats();

      stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(limiter.getTokenCount()).toBe(3); // Tokens unchanged
    });
  });

  describe("dispose()", () => {
    it("should stop the refill interval", () => {
      limiter = new RateLimiter({ maxTokens: 5 });
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      limiter.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should reject pending requests", async () => {
      limiter = new RateLimiter({ maxTokens: 1 });

      await limiter.acquire();
      const promise = limiter.acquire();

      limiter.dispose();

      await expect(promise).rejects.toThrow(RateLimiterError);
    });
  });
});

describe("createRateLimiter()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a new rate limiter with default config", () => {
    const limiter = createRateLimiter();
    expect(limiter).toBeInstanceOf(RateLimiter);
    expect(limiter.getConfig().maxTokens).toBe(10);
    limiter.dispose();
  });

  it("should create a new rate limiter with custom config", () => {
    const limiter = createRateLimiter({ maxTokens: 20 });
    expect(limiter.getConfig().maxTokens).toBe(20);
    limiter.dispose();
  });
});

describe("shared rate limiter", () => {
  afterEach(() => {
    resetSharedRateLimiter();
    vi.useRealTimers();
  });

  it("should return the same instance", () => {
    const limiter1 = getSharedRateLimiter();
    const limiter2 = getSharedRateLimiter();

    expect(limiter1).toBe(limiter2);
  });

  it("should create new instance after reset", () => {
    const limiter1 = getSharedRateLimiter();
    resetSharedRateLimiter();
    const limiter2 = getSharedRateLimiter();

    expect(limiter1).not.toBe(limiter2);
  });
});

describe("withRateLimit()", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({ maxTokens: 2 });
  });

  afterEach(() => {
    limiter.dispose();
    vi.useRealTimers();
  });

  it("should rate limit function calls", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = withRateLimit(mockFn, limiter);

    const result = await rateLimitedFn();
    expect(result).toBe("result");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should consume tokens for each call", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = withRateLimit(mockFn, limiter);

    await rateLimitedFn();
    await rateLimitedFn();

    expect(limiter.getTokenCount()).toBe(0);
  });

  it("should wait for tokens when exhausted", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const rateLimitedFn = withRateLimit(mockFn, limiter);

    await rateLimitedFn();
    await rateLimitedFn();

    const promise = rateLimitedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    await promise;

    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should preserve function arguments", async () => {
    const mockFn = vi.fn().mockImplementation((a: number, b: string) => Promise.resolve(a + b));
    const rateLimitedFn = withRateLimit(mockFn, limiter);

    const result = await rateLimitedFn(42, "test");
    expect(result).toBe("42test");
    expect(mockFn).toHaveBeenCalledWith(42, "test");
  });
});

describe("executeWithRateLimit()", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      maxTokens: 5,
      retryDelay: 100,
      maxRetryDelay: 1000,
    });
  });

  afterEach(() => {
    limiter.dispose();
    vi.useRealTimers();
  });

  it("should execute function successfully", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: "result" });

    const result = await executeWithRateLimit(mockFn, limiter);
    expect(result).toEqual({ data: "result" });
  });

  it("should retry on 429 response", async () => {
    const mockFn = vi
      .fn()
      .mockResolvedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ data: "success" });

    const promise = executeWithRateLimit(mockFn, limiter, 3);

    // First call returns 429
    await vi.advanceTimersByTimeAsync(0);

    // Advance past retry delay
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toEqual({ data: "success" });
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("should throw after max retries", async () => {
    const mockFn = vi.fn().mockResolvedValue({ status: 429 });

    const promise = executeWithRateLimit(mockFn, limiter, 2);

    // Catch rejection to prevent unhandled promise rejection warning
    const caughtPromise = promise.catch(() => {});

    // Process all retries
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    await expect(promise).rejects.toThrow(RateLimiterError);
    await expect(promise).rejects.toThrow("retries");

    // Wait for caught promise to settle
    await caughtPromise;
  });

  it("should retry on rate limit error messages", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValueOnce({ data: "success" });

    const promise = executeWithRateLimit(mockFn, limiter, 3);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toEqual({ data: "success" });
  });

  it("should not retry on non-rate-limit errors", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("Server Error"));

    await expect(executeWithRateLimit(mockFn, limiter, 3)).rejects.toThrow("Server Error");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe("RateLimiterError", () => {
  it("should have correct name and properties", () => {
    const error = new RateLimiterError("Test error", "TEST_CODE");

    expect(error.name).toBe("RateLimiterError");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
  });

  it("should be instanceof Error", () => {
    const error = new RateLimiterError("Test", "CODE");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RateLimiterError);
  });
});
