/**
 * Tests for CLOB API rate limiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ClobRateLimiter,
  ClobEndpointCategory,
  getEndpointCategory,
  getSharedClobRateLimiter,
  setSharedClobRateLimiter,
  resetSharedClobRateLimiter,
  createClobRateLimiter,
  withClobRateLimit,
  executeWithClobRateLimit,
  RateLimiterError,
} from "../../../src/api/clob/rate-limiter";

describe("ClobRateLimiter", () => {
  let limiter: ClobRateLimiter;

  beforeEach(() => {
    limiter = new ClobRateLimiter();
  });

  afterEach(() => {
    limiter.dispose();
  });

  describe("constructor", () => {
    it("should create limiter with default configuration", () => {
      const stats = limiter.getStats();
      expect(stats.categories).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.PUBLIC]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.PRIVATE]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.TRADING]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.HISTORICAL]).toBeDefined();
    });

    it("should create limiter with custom category limits", () => {
      const customLimiter = new ClobRateLimiter({
        categoryLimits: {
          [ClobEndpointCategory.PUBLIC]: {
            maxTokens: 50,
            refillRate: 10,
          },
        },
      });

      const categoryLimiter = customLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC);
      expect(categoryLimiter).toBeDefined();
      expect(categoryLimiter?.getConfig().maxTokens).toBe(50);
      expect(categoryLimiter?.getConfig().refillRate).toBe(10);

      customLimiter.dispose();
    });

    it("should create limiter with logging enabled", () => {
      const mockLogger = vi.fn();
      const loggingLimiter = new ClobRateLimiter({
        enableLogging: true,
        logger: mockLogger,
      });

      expect(mockLogger).toHaveBeenCalledWith(
        "CLOB rate limiter initialized",
        expect.objectContaining({
          categories: expect.any(Array),
          hasSharedLimiter: false,
        })
      );

      loggingLimiter.dispose();
    });

    it("should create limiter with shared limiter", () => {
      const sharedLimiter = createClobRateLimiter();
      const withShared = new ClobRateLimiter({
        sharedLimiter: sharedLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!,
      });

      expect(withShared.getSharedLimiter()).toBeDefined();

      withShared.dispose();
      sharedLimiter.dispose();
    });
  });

  describe("getCategoryLimiter", () => {
    it("should return limiter for valid category", () => {
      const publicLimiter = limiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC);
      expect(publicLimiter).toBeDefined();
    });

    it("should return undefined for invalid category", () => {
      // @ts-expect-error Testing invalid category
      const invalidLimiter = limiter.getCategoryLimiter("invalid");
      expect(invalidLimiter).toBeUndefined();
    });
  });

  describe("acquire", () => {
    it("should acquire token for public category by default", async () => {
      await expect(limiter.acquire()).resolves.toBeUndefined();
    });

    it("should acquire token for specific category", async () => {
      await expect(limiter.acquire(ClobEndpointCategory.PRIVATE)).resolves.toBeUndefined();
    });

    it("should acquire token for trading category", async () => {
      await expect(limiter.acquire(ClobEndpointCategory.TRADING)).resolves.toBeUndefined();
    });

    it("should acquire token for historical category", async () => {
      await expect(limiter.acquire(ClobEndpointCategory.HISTORICAL)).resolves.toBeUndefined();
    });

    it("should throw for unknown category", async () => {
      // @ts-expect-error Testing invalid category
      await expect(limiter.acquire("invalid")).rejects.toThrow("Unknown category");
    });

    it("should use shared limiter if configured", async () => {
      const sharedLimiter = createClobRateLimiter();
      const publicLimiter = sharedLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!;
      const withShared = new ClobRateLimiter({
        sharedLimiter: publicLimiter,
      });

      await withShared.acquire();

      // Shared limiter should have been used
      const stats = publicLimiter.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      withShared.dispose();
      sharedLimiter.dispose();
    });
  });

  describe("tryAcquire", () => {
    it("should return true when token available", () => {
      expect(limiter.tryAcquire()).toBe(true);
    });

    it("should return true for specific category", () => {
      expect(limiter.tryAcquire(ClobEndpointCategory.PRIVATE)).toBe(true);
    });

    it("should return false for invalid category", () => {
      // @ts-expect-error Testing invalid category
      expect(limiter.tryAcquire("invalid")).toBe(false);
    });

    it("should return false when shared limiter has no tokens", () => {
      const sharedLimiter = createClobRateLimiter({
        categoryLimits: {
          [ClobEndpointCategory.PUBLIC]: {
            maxTokens: 1,
            refillRate: 0, // No refill
          },
        },
      });
      const publicLimiter = sharedLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!;

      // Exhaust shared limiter
      publicLimiter.tryAcquire();

      const withShared = new ClobRateLimiter({
        sharedLimiter: publicLimiter,
      });

      // Should fail because shared limiter has no tokens
      expect(withShared.tryAcquire()).toBe(false);

      withShared.dispose();
      sharedLimiter.dispose();
    });
  });

  describe("handleRateLimitResponse", () => {
    it("should handle 429 response for category", () => {
      limiter.handleRateLimitResponse(ClobEndpointCategory.PUBLIC, undefined, 1);

      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(true);
    });

    it("should handle numeric delay", () => {
      limiter.handleRateLimitResponse(ClobEndpointCategory.TRADING, 5000, 1);

      expect(limiter.isCategoryPaused(ClobEndpointCategory.TRADING)).toBe(true);
    });

    it("should handle response with Retry-After header", () => {
      const mockResponse = {
        headers: {
          get: (name: string) => (name === "Retry-After" ? "5" : null),
        },
      };

      limiter.handleRateLimitResponse(ClobEndpointCategory.PRIVATE, mockResponse, 1);

      expect(limiter.isCategoryPaused(ClobEndpointCategory.PRIVATE)).toBe(true);
    });

    it("should also notify shared limiter if configured", () => {
      const sharedLimiter = createClobRateLimiter();
      const publicLimiter = sharedLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!;
      const withShared = new ClobRateLimiter({
        sharedLimiter: publicLimiter,
      });

      withShared.handleRateLimitResponse(ClobEndpointCategory.PUBLIC, 1000, 1);

      expect(publicLimiter.isPausedState()).toBe(true);

      withShared.dispose();
      sharedLimiter.dispose();
    });
  });

  describe("getStats", () => {
    it("should return stats for all categories", () => {
      const stats = limiter.getStats();

      expect(stats.categories[ClobEndpointCategory.PUBLIC]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.PRIVATE]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.TRADING]).toBeDefined();
      expect(stats.categories[ClobEndpointCategory.HISTORICAL]).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalThrottled).toBe(0);
      expect(stats.totalRateLimited).toBe(0);
    });

    it("should track total requests", async () => {
      await limiter.acquire(ClobEndpointCategory.PUBLIC);
      await limiter.acquire(ClobEndpointCategory.PRIVATE);
      await limiter.acquire(ClobEndpointCategory.TRADING);

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(3);
    });

    it("should identify most constrained category", async () => {
      // Exhaust public tokens
      const publicLimiter = limiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!;
      for (let i = 0; i < 15; i++) {
        publicLimiter.tryAcquire();
      }

      const stats = limiter.getStats();
      // Public should be most constrained (used 15 tokens)
      expect(stats.mostConstrainedCategory).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should include shared limiter stats if configured", () => {
      const sharedLimiter = createClobRateLimiter();
      const publicLimiter = sharedLimiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)!;
      const withShared = new ClobRateLimiter({
        sharedLimiter: publicLimiter,
      });

      const stats = withShared.getStats();
      expect(stats.shared).toBeDefined();

      withShared.dispose();
      sharedLimiter.dispose();
    });
  });

  describe("getCategoryStats", () => {
    it("should return stats for valid category", () => {
      const stats = limiter.getCategoryStats(ClobEndpointCategory.PUBLIC);
      expect(stats).toBeDefined();
      expect(stats?.maxTokens).toBe(20);
    });

    it("should return null for invalid category", () => {
      // @ts-expect-error Testing invalid category
      const stats = limiter.getCategoryStats("invalid");
      expect(stats).toBeNull();
    });
  });

  describe("logStatus", () => {
    it("should log status without errors", () => {
      const mockLogger = vi.fn();
      const loggingLimiter = new ClobRateLimiter({
        enableLogging: true,
        logger: mockLogger,
      });

      loggingLimiter.logStatus();

      expect(mockLogger).toHaveBeenCalledWith(
        "Rate limiter status",
        expect.objectContaining({
          totalRequests: expect.any(Number),
          totalThrottled: expect.any(Number),
          totalRateLimited: expect.any(Number),
        })
      );

      loggingLimiter.dispose();
    });
  });

  describe("resetStats", () => {
    it("should reset stats for all categories", async () => {
      await limiter.acquire();
      await limiter.acquire();

      limiter.resetStats();

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("resetCategory", () => {
    it("should reset specific category", async () => {
      await limiter.acquire(ClobEndpointCategory.PUBLIC);

      limiter.resetCategory(ClobEndpointCategory.PUBLIC);

      const stats = limiter.getCategoryStats(ClobEndpointCategory.PUBLIC);
      expect(stats?.totalRequests).toBe(0);
    });

    it("should handle invalid category gracefully", () => {
      // @ts-expect-error Testing invalid category
      expect(() => limiter.resetCategory("invalid")).not.toThrow();
    });
  });

  describe("reset", () => {
    it("should reset all categories", async () => {
      await limiter.acquire(ClobEndpointCategory.PUBLIC);
      await limiter.acquire(ClobEndpointCategory.PRIVATE);

      limiter.reset();

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("pauseCategory", () => {
    it("should pause specific category", () => {
      limiter.pauseCategory(ClobEndpointCategory.PUBLIC, 5000);

      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(true);
      expect(limiter.isCategoryPaused(ClobEndpointCategory.PRIVATE)).toBe(false);
    });

    it("should handle invalid category gracefully", () => {
      // @ts-expect-error Testing invalid category
      expect(() => limiter.pauseCategory("invalid", 5000)).not.toThrow();
    });
  });

  describe("resumeCategory", () => {
    it("should resume paused category", () => {
      limiter.pauseCategory(ClobEndpointCategory.PUBLIC, 5000);
      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(true);

      limiter.resumeCategory(ClobEndpointCategory.PUBLIC);
      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(false);
    });

    it("should handle invalid category gracefully", () => {
      // @ts-expect-error Testing invalid category
      expect(() => limiter.resumeCategory("invalid")).not.toThrow();
    });
  });

  describe("isCategoryPaused", () => {
    it("should return false for unpaused category", () => {
      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(false);
    });

    it("should return true for paused category", () => {
      limiter.pauseCategory(ClobEndpointCategory.PUBLIC, 5000);
      expect(limiter.isCategoryPaused(ClobEndpointCategory.PUBLIC)).toBe(true);
    });

    it("should return false for invalid category", () => {
      // @ts-expect-error Testing invalid category
      expect(limiter.isCategoryPaused("invalid")).toBe(false);
    });
  });

  describe("dispose", () => {
    it("should dispose all rate limiters", () => {
      limiter.dispose();

      expect(limiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC)).toBeUndefined();
    });
  });
});

describe("getEndpointCategory", () => {
  describe("trading endpoints", () => {
    it("should categorize /order as trading", () => {
      expect(getEndpointCategory("/order")).toBe(ClobEndpointCategory.TRADING);
    });

    it("should categorize /orders/cancel as trading", () => {
      expect(getEndpointCategory("/orders/cancel")).toBe(ClobEndpointCategory.TRADING);
    });

    it("should categorize /orders/amend as trading", () => {
      expect(getEndpointCategory("/orders/amend")).toBe(ClobEndpointCategory.TRADING);
    });
  });

  describe("private endpoints", () => {
    it("should categorize /orders as private", () => {
      expect(getEndpointCategory("/orders")).toBe(ClobEndpointCategory.PRIVATE);
    });

    it("should categorize /positions as private", () => {
      expect(getEndpointCategory("/positions")).toBe(ClobEndpointCategory.PRIVATE);
    });

    it("should categorize /account as private", () => {
      expect(getEndpointCategory("/account")).toBe(ClobEndpointCategory.PRIVATE);
    });

    it("should categorize /balances as private", () => {
      expect(getEndpointCategory("/balances")).toBe(ClobEndpointCategory.PRIVATE);
    });

    it("should categorize /auth as private", () => {
      expect(getEndpointCategory("/auth/api-key")).toBe(ClobEndpointCategory.PRIVATE);
    });
  });

  describe("historical endpoints", () => {
    it("should categorize trades with maker filter as historical", () => {
      expect(getEndpointCategory("/trades?maker=0x123")).toBe(ClobEndpointCategory.HISTORICAL);
    });

    it("should categorize trades with taker filter as historical", () => {
      expect(getEndpointCategory("/trades?taker=0x123")).toBe(ClobEndpointCategory.HISTORICAL);
    });

    it("should categorize trades with start_ts as historical", () => {
      expect(getEndpointCategory("/trades?start_ts=1234567890")).toBe(ClobEndpointCategory.HISTORICAL);
    });

    it("should categorize endpoints with history as historical", () => {
      expect(getEndpointCategory("/price/history")).toBe(ClobEndpointCategory.HISTORICAL);
    });
  });

  describe("public endpoints", () => {
    it("should categorize /book as public", () => {
      expect(getEndpointCategory("/book?token_id=123")).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should categorize /trades as public", () => {
      expect(getEndpointCategory("/trades")).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should categorize /markets as public", () => {
      expect(getEndpointCategory("/markets")).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should categorize /price as public", () => {
      expect(getEndpointCategory("/price")).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should categorize /midpoint as public", () => {
      expect(getEndpointCategory("/midpoint")).toBe(ClobEndpointCategory.PUBLIC);
    });
  });

  describe("full URLs", () => {
    it("should extract path from full URL", () => {
      expect(getEndpointCategory("https://clob.polymarket.com/book?token_id=123")).toBe(
        ClobEndpointCategory.PUBLIC
      );
    });

    it("should handle URL with port", () => {
      expect(getEndpointCategory("http://localhost:3000/orders")).toBe(
        ClobEndpointCategory.PRIVATE
      );
    });

    it("should default to public for unknown endpoints", () => {
      expect(getEndpointCategory("/unknown")).toBe(ClobEndpointCategory.PUBLIC);
    });

    it("should handle invalid URL gracefully", () => {
      expect(getEndpointCategory("not a url at all")).toBe(ClobEndpointCategory.PUBLIC);
    });
  });
});

describe("Shared CLOB Rate Limiter", () => {
  afterEach(() => {
    resetSharedClobRateLimiter();
  });

  describe("getSharedClobRateLimiter", () => {
    it("should create shared instance on first call", () => {
      const limiter = getSharedClobRateLimiter();
      expect(limiter).toBeInstanceOf(ClobRateLimiter);
    });

    it("should return same instance on subsequent calls", () => {
      const first = getSharedClobRateLimiter();
      const second = getSharedClobRateLimiter();
      expect(first).toBe(second);
    });
  });

  describe("setSharedClobRateLimiter", () => {
    it("should set custom shared instance", () => {
      const custom = new ClobRateLimiter({
        categoryLimits: {
          [ClobEndpointCategory.PUBLIC]: { maxTokens: 100 },
        },
      });

      setSharedClobRateLimiter(custom);

      const shared = getSharedClobRateLimiter();
      expect(shared).toBe(custom);
    });

    it("should dispose previous instance", () => {
      const first = getSharedClobRateLimiter();
      // Access the limiter to verify it exists before dispose
      expect(first.getCategoryLimiter(ClobEndpointCategory.PUBLIC)).toBeDefined();

      const custom = new ClobRateLimiter();
      setSharedClobRateLimiter(custom);

      // First limiter should be disposed
      expect(first.getCategoryLimiter(ClobEndpointCategory.PUBLIC)).toBeUndefined();
    });
  });

  describe("resetSharedClobRateLimiter", () => {
    it("should dispose and clear shared instance", () => {
      const limiter = getSharedClobRateLimiter();
      resetSharedClobRateLimiter();

      // Should create new instance
      const newLimiter = getSharedClobRateLimiter();
      expect(newLimiter).not.toBe(limiter);
    });

    it("should handle multiple resets gracefully", () => {
      resetSharedClobRateLimiter();
      resetSharedClobRateLimiter();
      resetSharedClobRateLimiter();

      expect(() => getSharedClobRateLimiter()).not.toThrow();
    });
  });
});

describe("createClobRateLimiter", () => {
  it("should create new instance with default config", () => {
    const limiter = createClobRateLimiter();
    expect(limiter).toBeInstanceOf(ClobRateLimiter);
    limiter.dispose();
  });

  it("should create new instance with custom config", () => {
    const limiter = createClobRateLimiter({
      categoryLimits: {
        [ClobEndpointCategory.PUBLIC]: { maxTokens: 100 },
      },
      enableLogging: true,
    });

    const publicLimiter = limiter.getCategoryLimiter(ClobEndpointCategory.PUBLIC);
    expect(publicLimiter?.getConfig().maxTokens).toBe(100);

    limiter.dispose();
  });
});

describe("withClobRateLimit", () => {
  let limiter: ClobRateLimiter;

  beforeEach(() => {
    limiter = new ClobRateLimiter();
  });

  afterEach(() => {
    limiter.dispose();
  });

  it("should wrap function with rate limiting", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: "test" });
    const wrapped = withClobRateLimit(mockFn, limiter);

    const result = await wrapped();

    expect(result).toEqual({ data: "test" });
    expect(mockFn).toHaveBeenCalled();
  });

  it("should use specified category", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: "test" });
    const wrapped = withClobRateLimit(mockFn, limiter, ClobEndpointCategory.TRADING);

    await wrapped();

    const stats = limiter.getCategoryStats(ClobEndpointCategory.TRADING);
    expect(stats?.totalRequests).toBe(1);
  });

  it("should pass arguments through", async () => {
    const mockFn = vi.fn().mockImplementation(async (a: number, b: string) => ({ a, b }));
    const wrapped = withClobRateLimit(mockFn, limiter);

    const result = await wrapped(42, "hello");

    expect(result).toEqual({ a: 42, b: "hello" });
    expect(mockFn).toHaveBeenCalledWith(42, "hello");
  });
});

describe("executeWithClobRateLimit", () => {
  let limiter: ClobRateLimiter;

  beforeEach(() => {
    limiter = new ClobRateLimiter();
  });

  afterEach(() => {
    limiter.dispose();
  });

  it("should execute function with rate limiting", async () => {
    const result = await executeWithClobRateLimit(
      async () => ({ data: "test" }),
      limiter,
      ClobEndpointCategory.PUBLIC
    );

    expect(result).toEqual({ data: "test" });
  });

  it("should retry on 429 status", async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount === 1) {
        return { status: 429, data: null };
      }
      return { status: 200, data: "success" };
    };

    const result = await executeWithClobRateLimit(mockFn, limiter, ClobEndpointCategory.PUBLIC, 3);

    expect(result).toEqual({ status: 200, data: "success" });
    expect(callCount).toBe(2);
  });

  it("should throw after max retries exceeded", async () => {
    const mockFn = async () => ({ status: 429, data: null });

    await expect(
      executeWithClobRateLimit(mockFn, limiter, ClobEndpointCategory.PUBLIC, 2)
    ).rejects.toThrow("Rate limited after 2 retries");
  });

  it("should retry on error with rate limit message", async () => {
    let callCount = 0;
    const mockFn = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("HTTP 429: rate limited");
      }
      return { data: "success" };
    };

    const result = await executeWithClobRateLimit(mockFn, limiter, ClobEndpointCategory.PUBLIC, 3);

    expect(result).toEqual({ data: "success" });
    expect(callCount).toBe(2);
  });

  it("should not retry on non-rate-limit errors", async () => {
    const mockFn = async () => {
      throw new Error("Some other error");
    };

    await expect(
      executeWithClobRateLimit(mockFn, limiter, ClobEndpointCategory.PUBLIC, 3)
    ).rejects.toThrow("Some other error");
  });

  it("should use default category if not specified", async () => {
    const result = await executeWithClobRateLimit(
      async () => ({ data: "test" }),
      limiter
    );

    expect(result).toEqual({ data: "test" });
  });
});

describe("ClobEndpointCategory", () => {
  it("should have all expected categories", () => {
    expect(ClobEndpointCategory.PUBLIC).toBe("public");
    expect(ClobEndpointCategory.PRIVATE).toBe("private");
    expect(ClobEndpointCategory.TRADING).toBe("trading");
    expect(ClobEndpointCategory.HISTORICAL).toBe("historical");
  });

  it("should have exactly 4 categories", () => {
    const values = Object.values(ClobEndpointCategory);
    expect(values.length).toBe(4);
  });
});

describe("RateLimiterError (re-export)", () => {
  it("should be importable from CLOB rate limiter", () => {
    expect(RateLimiterError).toBeDefined();
  });

  it("should create error with code", () => {
    const error = new RateLimiterError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("RateLimiterError");
  });
});
