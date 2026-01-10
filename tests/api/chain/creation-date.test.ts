/**
 * Tests for Wallet Creation Date API (API-CHAIN-004)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  WalletCreationDateClient,
  createWalletCreationDateClient,
  getSharedWalletCreationDateClient,
  setSharedWalletCreationDateClient,
  resetSharedWalletCreationDateClient,
  getWalletCreationDate,
  getWalletAgeInDays,
  isWalletFresh,
  batchGetCreationDates,
  PolygonClientError,
} from "../../../src/api/chain";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample raw transaction data from Polygonscan API
const sampleRawTransaction = {
  blockNumber: "50000000",
  timeStamp: "1700000000", // Nov 14, 2023
  hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  nonce: "0",
  blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  transactionIndex: "5",
  from: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
  to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
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

const sampleRawInternalTransaction = {
  blockNumber: "49999999",
  timeStamp: "1699999000", // Slightly earlier than normal tx
  hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  from: "0x742d35cc6634c0532925a3b844bc9e7595f8b999",
  to: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
  value: "500000000000000000",
  contractAddress: "0x742d35cc6634c0532925a3b844bc9e7595f8b789",
  input: "0x",
  type: "call",
  gas: "50000",
  gasUsed: "30000",
  traceId: "0",
  isError: "0",
  errCode: "",
};

// Valid test addresses
const validAddress = "0x742d35cc6634c0532925a3b844bc9e7595f8b123";
const validAddress2 = "0x742d35cc6634c0532925a3b844bc9e7595f8b456";

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

describe("WalletCreationDateClient", () => {
  let client: WalletCreationDateClient;

  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
    client = new WalletCreationDateClient(undefined, { enabled: false });
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
  });

  describe("constructor", () => {
    it("should create client with default configuration", () => {
      const client = new WalletCreationDateClient();
      expect(client).toBeInstanceOf(WalletCreationDateClient);
    });

    it("should create client with custom Polygonscan config", () => {
      const client = new WalletCreationDateClient({ apiKey: "test-api-key" });
      expect(client).toBeInstanceOf(WalletCreationDateClient);
    });

    it("should create client with custom cache config", () => {
      const client = new WalletCreationDateClient(undefined, {
        ttlMs: 3600000,
        maxEntries: 5000,
        enabled: true,
      });
      expect(client).toBeInstanceOf(WalletCreationDateClient);
      const stats = client.getCacheStats();
      expect(stats.ttlMs).toBe(3600000);
      expect(stats.maxSize).toBe(5000);
      expect(stats.enabled).toBe(true);
    });

    it("should create client with cache disabled", () => {
      const client = new WalletCreationDateClient(undefined, { enabled: false });
      const stats = client.getCacheStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe("getWalletCreationDate", () => {
    it("should fetch wallet creation date successfully", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await client.getWalletCreationDate(validAddress);

      expect(result.address.toLowerCase()).toBe(validAddress.toLowerCase());
      expect(result.hasTransactions).toBe(true);
      expect(result.creationTimestamp).toBe(1700000000);
      expect(result.creationDate).toEqual(new Date(1700000000 * 1000));
      expect(result.firstTransactionHash).toBe(sampleRawTransaction.hash);
      expect(result.firstBlockNumber).toBe(BigInt(50000000));
      expect(result.fromCache).toBe(false);
    });

    it("should calculate age in days correctly", async () => {
      // Create a transaction from 10 days ago
      const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
      const recentTransaction = {
        ...sampleRawTransaction,
        timeStamp: String(tenDaysAgo),
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [recentTransaction],
        })
      );

      const result = await client.getWalletCreationDate(validAddress);

      expect(result.ageInDays).toBe(10);
    });

    it("should handle empty wallet (no transactions)", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const result = await client.getWalletCreationDate(validAddress);

      expect(result.hasTransactions).toBe(false);
      expect(result.creationDate).toBeNull();
      expect(result.creationTimestamp).toBeNull();
      expect(result.firstTransactionHash).toBeNull();
      expect(result.firstBlockNumber).toBeNull();
      expect(result.ageInDays).toBeNull();
    });

    it("should throw error for invalid address", async () => {
      await expect(client.getWalletCreationDate("invalid")).rejects.toThrow(
        PolygonClientError
      );

      await expect(client.getWalletCreationDate("invalid")).rejects.toThrow(
        "Invalid address"
      );
    });

    it("should throw error for empty address", async () => {
      await expect(client.getWalletCreationDate("")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should include internal transactions when option is set", async () => {
      // First call returns normal transaction
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      // Second call returns internal transaction with earlier timestamp
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawInternalTransaction],
        })
      );

      const result = await client.getWalletCreationDate(validAddress, {
        includeInternalTransactions: true,
      });

      // Should use the earlier internal transaction timestamp
      expect(result.creationTimestamp).toBe(1699999000);
      expect(result.firstTransactionHash).toBe(sampleRawInternalTransaction.hash);
      expect(result.firstBlockNumber).toBe(BigInt(49999999));
    });

    it("should use normal transaction if earlier than internal", async () => {
      // Normal transaction is earlier
      const earlierNormalTx = {
        ...sampleRawTransaction,
        timeStamp: "1699998000", // Earlier than internal
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [earlierNormalTx],
        })
      );

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawInternalTransaction],
        })
      );

      const result = await client.getWalletCreationDate(validAddress, {
        includeInternalTransactions: true,
      });

      expect(result.creationTimestamp).toBe(1699998000);
      expect(result.firstTransactionHash).toBe(earlierNormalTx.hash);
    });
  });

  describe("getWalletAgeInDays", () => {
    it("should return age in days for wallet with transactions", async () => {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(thirtyDaysAgo) }],
        })
      );

      const age = await client.getWalletAgeInDays(validAddress);

      expect(age).toBe(30);
    });

    it("should return null for empty wallet", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const age = await client.getWalletAgeInDays(validAddress);

      expect(age).toBeNull();
    });
  });

  describe("isWalletFresh", () => {
    it("should return true for wallet newer than threshold", async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(tenDaysAgo) }],
        })
      );

      const isFresh = await client.isWalletFresh(validAddress, 30);

      expect(isFresh).toBe(true);
    });

    it("should return false for wallet older than threshold", async () => {
      const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(sixtyDaysAgo) }],
        })
      );

      const isFresh = await client.isWalletFresh(validAddress, 30);

      expect(isFresh).toBe(false);
    });

    it("should return true for empty wallet (no transactions)", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const isFresh = await client.isWalletFresh(validAddress, 30);

      expect(isFresh).toBe(true);
    });

    it("should use default threshold of 30 days", async () => {
      const twentyDaysAgo = Math.floor(Date.now() / 1000) - 20 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(twentyDaysAgo) }],
        })
      );

      const isFresh = await client.isWalletFresh(validAddress);

      expect(isFresh).toBe(true);
    });
  });

  describe("batchGetCreationDates", () => {
    it("should fetch creation dates for multiple addresses", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: "1699000000" }],
        })
      );

      const results = await client.batchGetCreationDates([validAddress, validAddress2]);

      expect(results.size).toBe(2);
    });

    it("should skip invalid addresses and continue", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const results = await client.batchGetCreationDates([
        "invalid",
        validAddress,
        "also-invalid",
      ]);

      // Only valid address should be in results
      expect(results.size).toBe(1);
    });

    it("should handle empty array", async () => {
      const results = await client.batchGetCreationDates([]);

      expect(results.size).toBe(0);
    });
  });

  describe("caching", () => {
    let cachedClient: WalletCreationDateClient;

    beforeEach(() => {
      cachedClient = new WalletCreationDateClient(undefined, {
        enabled: true,
        ttlMs: 60000,
      });
    });

    it("should cache results and return from cache", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      // First call - fetches from API
      const result1 = await cachedClient.getWalletCreationDate(validAddress);
      expect(result1.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await cachedClient.getWalletCreationDate(validAddress);
      expect(result2.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("should bypass cache when option is set", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      // First call
      await cachedClient.getWalletCreationDate(validAddress);

      // Second call with bypass
      const result = await cachedClient.getWalletCreationDate(validAddress, {
        bypassCache: true,
      });

      expect(result.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should clear cache", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      await cachedClient.getWalletCreationDate(validAddress);
      expect(cachedClient.getCacheStats().size).toBe(1);

      cachedClient.clearCache();
      expect(cachedClient.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      await cachedClient.getWalletCreationDate(validAddress);
      expect(cachedClient.getCacheStats().size).toBe(1);

      const invalidated = cachedClient.invalidateCacheEntry(validAddress);
      expect(invalidated).toBe(true);
      expect(cachedClient.getCacheStats().size).toBe(0);
    });

    it("should return false when invalidating non-existent entry", () => {
      const invalidated = cachedClient.invalidateCacheEntry(validAddress);
      expect(invalidated).toBe(false);
    });

    it("should return false when invalidating invalid address", () => {
      const invalidated = cachedClient.invalidateCacheEntry("invalid");
      expect(invalidated).toBe(false);
    });

    it("should evict oldest entries when max size reached", async () => {
      const smallCacheClient = new WalletCreationDateClient(undefined, {
        enabled: true,
        maxEntries: 5,
        ttlMs: 60000,
      });

      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      // Fill up the cache to max
      await smallCacheClient.getWalletCreationDate(validAddress);
      await smallCacheClient.getWalletCreationDate(validAddress2);
      await smallCacheClient.getWalletCreationDate("0x742d35cc6634c0532925a3b844bc9e7595f8b789");
      await smallCacheClient.getWalletCreationDate("0x742d35cc6634c0532925a3b844bc9e7595f8b111");
      await smallCacheClient.getWalletCreationDate("0x742d35cc6634c0532925a3b844bc9e7595f8b222");

      expect(smallCacheClient.getCacheStats().size).toBe(5);

      // Adding sixth entry should evict some entries (10% = 0.5, rounds to 0, so evicts at least 1)
      await smallCacheClient.getWalletCreationDate("0x742d35cc6634c0532925a3b844bc9e7595f8b333");

      // After eviction, cache should be smaller than max + 1
      expect(smallCacheClient.getCacheStats().size).toBeLessThanOrEqual(5);
    });
  });

  describe("getCacheStats", () => {
    it("should return correct cache statistics", () => {
      const client = new WalletCreationDateClient(undefined, {
        enabled: true,
        ttlMs: 7200000,
        maxEntries: 500,
      });

      const stats = client.getCacheStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 500,
        enabled: true,
        ttlMs: 7200000,
      });
    });
  });
});

describe("Factory functions", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
  });

  describe("createWalletCreationDateClient", () => {
    it("should create new client instance", () => {
      const client = createWalletCreationDateClient();
      expect(client).toBeInstanceOf(WalletCreationDateClient);
    });

    it("should create client with custom config", () => {
      const client = createWalletCreationDateClient(
        { apiKey: "test-key" },
        { ttlMs: 3600000 }
      );
      expect(client).toBeInstanceOf(WalletCreationDateClient);
    });
  });

  describe("getSharedWalletCreationDateClient", () => {
    it("should return same instance on multiple calls", () => {
      const client1 = getSharedWalletCreationDateClient();
      const client2 = getSharedWalletCreationDateClient();
      expect(client1).toBe(client2);
    });
  });

  describe("setSharedWalletCreationDateClient", () => {
    it("should set custom shared client", () => {
      const customClient = createWalletCreationDateClient();
      setSharedWalletCreationDateClient(customClient);

      const shared = getSharedWalletCreationDateClient();
      expect(shared).toBe(customClient);
    });
  });

  describe("resetSharedWalletCreationDateClient", () => {
    it("should reset shared client", () => {
      const client1 = getSharedWalletCreationDateClient();
      resetSharedWalletCreationDateClient();
      const client2 = getSharedWalletCreationDateClient();

      expect(client1).not.toBe(client2);
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedWalletCreationDateClient();
  });

  describe("getWalletCreationDate", () => {
    it("should fetch wallet creation date using shared client", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await getWalletCreationDate(validAddress);

      expect(result.hasTransactions).toBe(true);
      expect(result.creationTimestamp).toBe(1700000000);
    });

    it("should use custom client when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const customClient = createWalletCreationDateClient(undefined, {
        enabled: false,
      });
      const result = await getWalletCreationDate(validAddress, {
        creationDateClient: customClient,
      });

      expect(result.hasTransactions).toBe(true);
    });
  });

  describe("getWalletAgeInDays", () => {
    it("should return wallet age using shared client", async () => {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(thirtyDaysAgo) }],
        })
      );

      const age = await getWalletAgeInDays(validAddress);

      expect(age).toBe(30);
    });
  });

  describe("isWalletFresh", () => {
    it("should check if wallet is fresh using shared client", async () => {
      const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [{ ...sampleRawTransaction, timeStamp: String(tenDaysAgo) }],
        })
      );

      const fresh = await isWalletFresh(validAddress, 30);

      expect(fresh).toBe(true);
    });
  });

  describe("batchGetCreationDates", () => {
    it("should batch fetch using shared client", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const results = await batchGetCreationDates([validAddress]);

      expect(results.size).toBe(1);
    });
  });
});

describe("Edge cases", () => {
  let client: WalletCreationDateClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WalletCreationDateClient(undefined, { enabled: false });
  });

  it("should handle wallet with zero timestamp", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [{ ...sampleRawTransaction, timeStamp: "0" }],
      })
    );

    const result = await client.getWalletCreationDate(validAddress);

    expect(result.hasTransactions).toBe(true);
    expect(result.creationTimestamp).toBe(0);
    expect(result.creationDate).toEqual(new Date(0));
  });

  it("should handle very old wallet", async () => {
    // Ethereum genesis block timestamp
    const genesisTimestamp = "1438269988";
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [{ ...sampleRawTransaction, timeStamp: genesisTimestamp }],
      })
    );

    const result = await client.getWalletCreationDate(validAddress);

    expect(result.hasTransactions).toBe(true);
    expect(result.creationTimestamp).toBe(1438269988);
    expect(result.ageInDays).toBeGreaterThan(3000); // Over 8 years
  });

  it("should handle internal transaction when no normal transactions exist", async () => {
    // No normal transactions
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "0",
        message: "No transactions found",
        result: [],
      })
    );

    // Has internal transaction
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [sampleRawInternalTransaction],
      })
    );

    const result = await client.getWalletCreationDate(validAddress, {
      includeInternalTransactions: true,
    });

    expect(result.hasTransactions).toBe(true);
    expect(result.creationTimestamp).toBe(1699999000);
    expect(result.firstTransactionHash).toBe(sampleRawInternalTransaction.hash);
  });

  it("should handle lowercase address input", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: "1",
        message: "OK",
        result: [sampleRawTransaction],
      })
    );

    // Use lowercase address (viem's isAddress is strict about checksums)
    const result = await client.getWalletCreationDate(
      validAddress.toLowerCase()
    );

    // Address should be checksummed in the result
    expect(result.address).not.toBe(validAddress.toLowerCase());
    expect(result.address.toLowerCase()).toBe(validAddress.toLowerCase());
  });
});
