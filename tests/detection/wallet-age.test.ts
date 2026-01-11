/**
 * Tests for Wallet Age Calculator (DET-FRESH-001)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  AgeCategory,
  DEFAULT_AGE_THRESHOLDS,
  WalletAgeCalculator,
  createWalletAgeCalculator,
  getSharedWalletAgeCalculator,
  setSharedWalletAgeCalculator,
  resetSharedWalletAgeCalculator,
  calculateWalletAge,
  batchCalculateWalletAge,
  checkWalletFreshness,
  getWalletAgeCategory,
  getWalletAgeSummary,
} from "../../src/detection";
import {
  PolygonClientError,
  resetSharedWalletCreationDateClient,
} from "../../src/api/chain";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Valid test addresses
const validAddress = "0x742d35cc6634c0532925a3b844bc9e7595f8b123";
const validAddress2 = "0x742d35cc6634c0532925a3b844bc9e7595f8b456";
const validAddress3 = "0x742d35cc6634c0532925a3b844bc9e7595f8b789";

// Sample raw transaction data from Polygonscan API
const sampleRawTransaction = {
  blockNumber: "50000000",
  timeStamp: "1700000000", // Nov 14, 2023
  hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  nonce: "0",
  blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  transactionIndex: "5",
  from: validAddress,
  to: validAddress2,
  value: "1000000000000000000",
  gas: "21000",
  gasPrice: "100000000000",
  isError: "0",
  txreceipt_status: "1",
  input: "0x",
  contractAddress: "",
  cumulativeGasUsed: "1000000",
  gasUsed: "21000",
  confirmations: "1000",
  methodId: "0x",
  functionName: "",
};

// Helper to create mock response
function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: "basic",
    url: "",
    clone: () => createMockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// Helper to create transaction with specific timestamp
function createTransactionWithAge(daysAgo: number): typeof sampleRawTransaction {
  const timestamp = Math.floor(Date.now() / 1000) - daysAgo * 24 * 60 * 60;
  return {
    ...sampleRawTransaction,
    timeStamp: String(timestamp),
  };
}

describe("WalletAgeCalculator", () => {
  let calculator: WalletAgeCalculator;

  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
    calculator = new WalletAgeCalculator({
      cacheConfig: { enabled: false },
    });
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  describe("constructor", () => {
    it("should create calculator with default configuration", () => {
      const calc = new WalletAgeCalculator();
      expect(calc).toBeInstanceOf(WalletAgeCalculator);
      expect(calc.getDefaultFreshThreshold()).toBe(30);
    });

    it("should create calculator with custom fresh threshold", () => {
      const calc = new WalletAgeCalculator({
        defaultFreshThresholdDays: 14,
      });
      expect(calc.getDefaultFreshThreshold()).toBe(14);
    });

    it("should create calculator with custom category thresholds", () => {
      const customThresholds = {
        veryFresh: 3,
        fresh: 14,
        recent: 60,
        established: 180,
      };
      const calc = new WalletAgeCalculator({
        defaultCategoryThresholds: customThresholds,
      });
      expect(calc.getDefaultThresholds()).toEqual(customThresholds);
    });

    it("should create calculator with cache disabled", () => {
      const calc = new WalletAgeCalculator({
        cacheConfig: { enabled: false },
      });
      const stats = calc.getCacheStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe("calculateAge", () => {
    it("should calculate age for wallet with transactions", async () => {
      const tenDaysAgo = createTransactionWithAge(10);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [tenDaysAgo],
        })
      );

      const result = await calculator.calculateAge(validAddress);

      expect(result.address.toLowerCase()).toBe(validAddress.toLowerCase());
      expect(result.ageInDays).toBe(10);
      expect(result.ageInHours).toBeGreaterThanOrEqual(240);
      expect(result.isNew).toBe(false);
      expect(result.category).toBe(AgeCategory.FRESH);
      expect(result.isFresh).toBe(true);
      expect(result.firstTransactionTimestamp).toBeDefined();
      expect(result.firstTransactionDate).toBeInstanceOf(Date);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it("should identify new wallet with no transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const result = await calculator.calculateAge(validAddress);

      expect(result.isNew).toBe(true);
      expect(result.ageInDays).toBeNull();
      expect(result.ageInHours).toBeNull();
      expect(result.category).toBe(AgeCategory.NEW);
      expect(result.isFresh).toBe(true);
      expect(result.firstTransactionTimestamp).toBeNull();
      expect(result.firstTransactionDate).toBeNull();
      expect(result.firstTransactionHash).toBeNull();
    });

    it("should throw error for invalid address", async () => {
      await expect(calculator.calculateAge("invalid")).rejects.toThrow(
        PolygonClientError
      );
      await expect(calculator.calculateAge("invalid")).rejects.toThrow(
        "Invalid address"
      );
    });

    it("should throw error for empty address", async () => {
      await expect(calculator.calculateAge("")).rejects.toThrow(PolygonClientError);
    });

    it("should respect custom fresh threshold", async () => {
      const tenDaysAgo = createTransactionWithAge(10);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [tenDaysAgo],
        })
      );

      const result = await calculator.calculateAge(validAddress, {
        freshThresholdDays: 7,
      });

      expect(result.ageInDays).toBe(10);
      expect(result.isFresh).toBe(false); // 10 days > 7 day threshold
    });

    it("should use custom category thresholds", async () => {
      const fiveDaysAgo = createTransactionWithAge(5);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [fiveDaysAgo],
        })
      );

      const result = await calculator.calculateAge(validAddress, {
        categoryThresholds: {
          veryFresh: 3, // Override: 0-3 days is very fresh
        },
      });

      expect(result.ageInDays).toBe(5);
      expect(result.category).toBe(AgeCategory.FRESH); // 5 days > 3, but <= 30
    });
  });

  describe("classifyAge", () => {
    it("should classify null age as NEW", () => {
      expect(calculator.classifyAge(null)).toBe(AgeCategory.NEW);
    });

    it("should classify 0-7 days as VERY_FRESH", () => {
      expect(calculator.classifyAge(0)).toBe(AgeCategory.VERY_FRESH);
      expect(calculator.classifyAge(3)).toBe(AgeCategory.VERY_FRESH);
      expect(calculator.classifyAge(7)).toBe(AgeCategory.VERY_FRESH);
    });

    it("should classify 8-30 days as FRESH", () => {
      expect(calculator.classifyAge(8)).toBe(AgeCategory.FRESH);
      expect(calculator.classifyAge(15)).toBe(AgeCategory.FRESH);
      expect(calculator.classifyAge(30)).toBe(AgeCategory.FRESH);
    });

    it("should classify 31-90 days as RECENT", () => {
      expect(calculator.classifyAge(31)).toBe(AgeCategory.RECENT);
      expect(calculator.classifyAge(60)).toBe(AgeCategory.RECENT);
      expect(calculator.classifyAge(90)).toBe(AgeCategory.RECENT);
    });

    it("should classify 91-365 days as ESTABLISHED", () => {
      expect(calculator.classifyAge(91)).toBe(AgeCategory.ESTABLISHED);
      expect(calculator.classifyAge(200)).toBe(AgeCategory.ESTABLISHED);
      expect(calculator.classifyAge(365)).toBe(AgeCategory.ESTABLISHED);
    });

    it("should classify >365 days as MATURE", () => {
      expect(calculator.classifyAge(366)).toBe(AgeCategory.MATURE);
      expect(calculator.classifyAge(1000)).toBe(AgeCategory.MATURE);
    });

    it("should use custom thresholds", () => {
      const customThresholds = {
        veryFresh: 3,
        fresh: 14,
        recent: 60,
        established: 180,
      };

      expect(calculator.classifyAge(5, customThresholds)).toBe(AgeCategory.FRESH);
      expect(calculator.classifyAge(100, customThresholds)).toBe(AgeCategory.ESTABLISHED);
      expect(calculator.classifyAge(200, customThresholds)).toBe(AgeCategory.MATURE);
    });
  });

  describe("isFresh", () => {
    it("should return true for null age (new wallet)", () => {
      expect(calculator.isFresh(null)).toBe(true);
    });

    it("should return true for age under threshold", () => {
      expect(calculator.isFresh(0)).toBe(true);
      expect(calculator.isFresh(15)).toBe(true);
      expect(calculator.isFresh(30)).toBe(true);
    });

    it("should return false for age over threshold", () => {
      expect(calculator.isFresh(31)).toBe(false);
      expect(calculator.isFresh(100)).toBe(false);
    });

    it("should respect custom threshold", () => {
      expect(calculator.isFresh(10, 14)).toBe(true);
      expect(calculator.isFresh(15, 14)).toBe(false);
    });
  });

  describe("calculateAgeFromTimestamp", () => {
    it("should calculate age in days from timestamp", () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
      const age = calculator.calculateAgeFromTimestamp(tenDaysAgo);
      expect(age).toBe(10);
    });

    it("should return 0 for recent timestamps", () => {
      const justNow = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const age = calculator.calculateAgeFromTimestamp(justNow);
      expect(age).toBe(0);
    });
  });

  describe("calculateAgeInHoursFromTimestamp", () => {
    it("should calculate age in hours from timestamp", () => {
      const tenHoursAgo = Math.floor(Date.now() / 1000) - 10 * 60 * 60;
      const age = calculator.calculateAgeInHoursFromTimestamp(tenHoursAgo);
      expect(age).toBe(10);
    });

    it("should convert days to hours", () => {
      const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
      const age = calculator.calculateAgeInHoursFromTimestamp(twoDaysAgo);
      expect(age).toBe(48);
    });
  });

  describe("batchCalculateAge", () => {
    it("should calculate age for multiple addresses", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(50)],
        })
      );

      const result = await calculator.batchCalculateAge([validAddress, validAddress2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(2);
      expect(result.errors.size).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed success and failure", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const result = await calculator.batchCalculateAge([
        validAddress,
        "invalid-address",
      ]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors.has("invalid-address")).toBe(true);
    });

    it("should handle empty array", async () => {
      const result = await calculator.batchCalculateAge([]);

      expect(result.totalProcessed).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });
  });

  describe("getSummary", () => {
    it("should generate summary statistics", async () => {
      // Create mock results with different ages
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(3)], // VERY_FRESH
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(15)], // FRESH
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [], // NEW
        })
      );

      const batchResult = await calculator.batchCalculateAge([
        validAddress,
        validAddress2,
        validAddress3,
      ]);
      const summary = calculator.getSummary(Array.from(batchResult.results.values()));

      expect(summary.total).toBe(3);
      expect(summary.byCategory[AgeCategory.NEW]).toBe(1);
      expect(summary.byCategory[AgeCategory.VERY_FRESH]).toBe(1);
      expect(summary.byCategory[AgeCategory.FRESH]).toBe(1);
      expect(summary.freshPercentage).toBe(100); // All 3 are fresh
      expect(summary.newPercentage).toBeCloseTo(33.33, 1);
      expect(summary.averageAgeDays).toBe(9); // (3 + 15) / 2 = 9
      expect(summary.minAgeDays).toBe(3);
      expect(summary.maxAgeDays).toBe(15);
    });

    it("should handle empty results", () => {
      const summary = calculator.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.averageAgeDays).toBeNull();
      expect(summary.medianAgeDays).toBeNull();
      expect(summary.minAgeDays).toBeNull();
      expect(summary.maxAgeDays).toBeNull();
      expect(summary.freshPercentage).toBe(0);
      expect(summary.newPercentage).toBe(0);
    });

    it("should calculate median correctly for odd count", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(5)],
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(15)],
        })
      );

      const batchResult = await calculator.batchCalculateAge([
        validAddress,
        validAddress2,
        validAddress3,
      ]);
      const summary = calculator.getSummary(Array.from(batchResult.results.values()));

      expect(summary.medianAgeDays).toBe(10); // Middle value
    });

    it("should calculate median correctly for even count", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(5)],
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(15)],
        })
      );

      const batchResult = await calculator.batchCalculateAge([validAddress, validAddress2]);
      const summary = calculator.getSummary(Array.from(batchResult.results.values()));

      expect(summary.medianAgeDays).toBe(10); // (5 + 15) / 2
    });
  });

  describe("cache operations", () => {
    let cachedCalculator: WalletAgeCalculator;

    beforeEach(() => {
      cachedCalculator = new WalletAgeCalculator({
        cacheConfig: { enabled: true, ttlMs: 60000 },
      });
    });

    it("should return cache statistics", () => {
      const stats = cachedCalculator.getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("enabled");
      expect(stats).toHaveProperty("ttlMs");
      expect(stats.enabled).toBe(true);
    });

    it("should clear cache", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      await cachedCalculator.calculateAge(validAddress);
      expect(cachedCalculator.getCacheStats().size).toBeGreaterThan(0);

      cachedCalculator.clearCache();
      expect(cachedCalculator.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      await cachedCalculator.calculateAge(validAddress);
      const initialSize = cachedCalculator.getCacheStats().size;

      const invalidated = cachedCalculator.invalidateCacheEntry(validAddress);
      expect(invalidated).toBe(true);
      expect(cachedCalculator.getCacheStats().size).toBeLessThan(initialSize);
    });

    it("should return cached results on second call", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const result1 = await cachedCalculator.calculateAge(validAddress);
      expect(result1.fromCache).toBe(false);

      const result2 = await cachedCalculator.calculateAge(validAddress);
      expect(result2.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Factory functions", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  describe("createWalletAgeCalculator", () => {
    it("should create new calculator instance", () => {
      const calc = createWalletAgeCalculator();
      expect(calc).toBeInstanceOf(WalletAgeCalculator);
    });

    it("should create calculator with custom config", () => {
      const calc = createWalletAgeCalculator({
        defaultFreshThresholdDays: 14,
        cacheConfig: { ttlMs: 3600000 },
      });
      expect(calc).toBeInstanceOf(WalletAgeCalculator);
      expect(calc.getDefaultFreshThreshold()).toBe(14);
    });
  });

  describe("getSharedWalletAgeCalculator", () => {
    it("should return same instance on multiple calls", () => {
      const calc1 = getSharedWalletAgeCalculator();
      const calc2 = getSharedWalletAgeCalculator();
      expect(calc1).toBe(calc2);
    });
  });

  describe("setSharedWalletAgeCalculator", () => {
    it("should set custom shared calculator", () => {
      const customCalc = createWalletAgeCalculator({
        defaultFreshThresholdDays: 7,
      });
      setSharedWalletAgeCalculator(customCalc);

      const shared = getSharedWalletAgeCalculator();
      expect(shared).toBe(customCalc);
      expect(shared.getDefaultFreshThreshold()).toBe(7);
    });
  });

  describe("resetSharedWalletAgeCalculator", () => {
    it("should reset shared calculator", () => {
      const calc1 = getSharedWalletAgeCalculator();
      resetSharedWalletAgeCalculator();
      const calc2 = getSharedWalletAgeCalculator();

      expect(calc1).not.toBe(calc2);
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  describe("calculateWalletAge", () => {
    it("should calculate wallet age using shared calculator", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const result = await calculateWalletAge(validAddress);

      expect(result.ageInDays).toBe(10);
      expect(result.isFresh).toBe(true);
    });

    it("should use custom calculator when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const customCalc = createWalletAgeCalculator({
        cacheConfig: { enabled: false },
        defaultFreshThresholdDays: 5,
      });

      const result = await calculateWalletAge(validAddress, {
        calculator: customCalc,
      });

      expect(result.ageInDays).toBe(10);
      expect(result.isFresh).toBe(false); // 10 > 5 day threshold
    });
  });

  describe("batchCalculateWalletAge", () => {
    it("should batch calculate using shared calculator", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const result = await batchCalculateWalletAge([validAddress]);

      expect(result.successCount).toBe(1);
      expect(result.results.size).toBe(1);
    });
  });

  describe("checkWalletFreshness", () => {
    it("should check wallet freshness", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const isFresh = await checkWalletFreshness(validAddress, 30);

      expect(isFresh).toBe(true);
    });

    it("should respect custom threshold", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const isFresh = await checkWalletFreshness(validAddress, 5);

      expect(isFresh).toBe(false);
    });
  });

  describe("getWalletAgeCategory", () => {
    it("should get wallet age category", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );

      const category = await getWalletAgeCategory(validAddress);

      expect(category).toBe(AgeCategory.FRESH);
    });

    it("should return NEW for wallet without transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const category = await getWalletAgeCategory(validAddress);

      expect(category).toBe(AgeCategory.NEW);
    });
  });

  describe("getWalletAgeSummary", () => {
    it("should get summary for multiple addresses", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(10)],
        })
      );
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [createTransactionWithAge(50)],
        })
      );

      const summary = await getWalletAgeSummary([validAddress, validAddress2]);

      expect(summary.total).toBe(2);
      expect(summary.byCategory[AgeCategory.FRESH]).toBe(1);
      expect(summary.byCategory[AgeCategory.RECENT]).toBe(1);
    });
  });
});

describe("DEFAULT_AGE_THRESHOLDS", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_AGE_THRESHOLDS.veryFresh).toBe(7);
    expect(DEFAULT_AGE_THRESHOLDS.fresh).toBe(30);
    expect(DEFAULT_AGE_THRESHOLDS.recent).toBe(90);
    expect(DEFAULT_AGE_THRESHOLDS.established).toBe(365);
  });
});

describe("AgeCategory enum", () => {
  it("should have all expected values", () => {
    expect(AgeCategory.NEW).toBe("NEW");
    expect(AgeCategory.VERY_FRESH).toBe("VERY_FRESH");
    expect(AgeCategory.FRESH).toBe("FRESH");
    expect(AgeCategory.RECENT).toBe("RECENT");
    expect(AgeCategory.ESTABLISHED).toBe("ESTABLISHED");
    expect(AgeCategory.MATURE).toBe("MATURE");
  });
});

describe("Edge cases", () => {
  let calculator: WalletAgeCalculator;

  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
    calculator = new WalletAgeCalculator({
      cacheConfig: { enabled: false },
    });
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletAgeCalculator();
    resetSharedWalletCreationDateClient();
  });

  it("should handle very old wallet", async () => {
    // Transaction from 3 years ago
    const threeYearsAgo = createTransactionWithAge(365 * 3);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [threeYearsAgo],
      })
    );

    const result = await calculator.calculateAge(validAddress);

    expect(result.ageInDays).toBeGreaterThan(1000);
    expect(result.category).toBe(AgeCategory.MATURE);
    expect(result.isFresh).toBe(false);
  });

  it("should handle wallet created today", async () => {
    const justCreated = createTransactionWithAge(0);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [justCreated],
      })
    );

    const result = await calculator.calculateAge(validAddress);

    expect(result.ageInDays).toBe(0);
    expect(result.category).toBe(AgeCategory.VERY_FRESH);
    expect(result.isFresh).toBe(true);
  });

  it("should handle lowercase address input", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [createTransactionWithAge(10)],
      })
    );

    const result = await calculator.calculateAge(validAddress.toLowerCase());

    // Address should be checksummed in the result
    expect(result.address).not.toBe(validAddress.toLowerCase());
    expect(result.address.toLowerCase()).toBe(validAddress.toLowerCase());
  });

  it("should handle age exactly at threshold boundaries", async () => {
    // Test at veryFresh boundary (7 days)
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [createTransactionWithAge(7)],
      })
    );
    const at7Days = await calculator.calculateAge(validAddress);
    expect(at7Days.category).toBe(AgeCategory.VERY_FRESH);

    // Test just past veryFresh boundary
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [createTransactionWithAge(8)],
      })
    );
    const at8Days = await calculator.calculateAge(validAddress);
    expect(at8Days.category).toBe(AgeCategory.FRESH);
  });

  it("should include internal transactions when requested", async () => {
    // Normal transaction from 10 days ago
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [createTransactionWithAge(10)],
      })
    );

    // Internal transaction from 20 days ago (earlier)
    const internalTxTimestamp = Math.floor(Date.now() / 1000) - 20 * 24 * 60 * 60;
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [
          {
            blockNumber: "49999999",
            timeStamp: String(internalTxTimestamp),
            hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            from: validAddress2,
            to: validAddress,
            value: "500000000000000000",
            contractAddress: validAddress3,
            input: "0x",
            type: "call",
            gas: "50000",
            gasUsed: "30000",
            traceId: "0",
            isError: "0",
            errCode: "",
          },
        ],
      })
    );

    const result = await calculator.calculateAge(validAddress, {
      includeInternalTransactions: true,
    });

    // Should use the earlier internal transaction timestamp
    expect(result.ageInDays).toBe(20);
  });
});
