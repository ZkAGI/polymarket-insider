/**
 * Tests for Wallet History API (API-CHAIN-002)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  PolygonscanClient,
  createPolygonscanClient,
  getSharedPolygonscanClient,
  setSharedPolygonscanClient,
  resetSharedPolygonscanClient,
  getWalletHistory,
  getAllWalletHistory,
  getInternalTransactions,
  getTransactionCount,
  PolygonscanError,
  PolygonClientError,
  type WalletHistoryOptions,
} from "../../../src/api/chain";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample raw transaction data from Polygonscan API
const sampleRawTransaction = {
  blockNumber: "50000000",
  timeStamp: "1700000000",
  hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  nonce: "42",
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
  blockNumber: "50000000",
  timeStamp: "1700000000",
  hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  from: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
  to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
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

describe("PolygonscanClient", () => {
  let client: PolygonscanClient;

  beforeEach(() => {
    mockFetch.mockReset();
    resetSharedPolygonscanClient();
    client = new PolygonscanClient();
  });

  afterEach(() => {
    mockFetch.mockReset();
    resetSharedPolygonscanClient();
  });

  describe("constructor", () => {
    it("should create client with default configuration", () => {
      const client = new PolygonscanClient();
      expect(client).toBeInstanceOf(PolygonscanClient);
    });

    it("should create client with custom API key", () => {
      const client = new PolygonscanClient({ apiKey: "test-api-key" });
      expect(client).toBeInstanceOf(PolygonscanClient);
    });

    it("should create client with custom base URL", () => {
      const client = new PolygonscanClient({
        baseUrl: "https://custom.api.com/api",
      });
      expect(client).toBeInstanceOf(PolygonscanClient);
    });

    it("should create client with custom timeout", () => {
      const client = new PolygonscanClient({ timeout: 60000 });
      expect(client).toBeInstanceOf(PolygonscanClient);
    });

    it("should create client with all custom options", () => {
      const client = new PolygonscanClient({
        apiKey: "test-key",
        baseUrl: "https://custom.api.com/api",
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
      });
      expect(client).toBeInstanceOf(PolygonscanClient);
    });
  });

  describe("getWalletHistory", () => {
    it("should fetch wallet history with default options", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      // Address is checksummed by viem's getAddress
      expect(result.address.toLowerCase()).toBe("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(result.transactions).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(100);
      expect(result.hasMore).toBe(false);
    });

    it("should parse transaction data correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      const tx = result.transactions[0]!;
      expect(tx.hash).toBe(sampleRawTransaction.hash);
      expect(tx.blockNumber).toBe(BigInt(50000000));
      expect(tx.timestamp).toBe(1700000000);
      expect(tx.nonce).toBe(42);
      expect(tx.from).toBe("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(tx.to).toBe("0x742d35cc6634c0532925a3b844bc9e7595f8b456");
      expect(tx.value).toBe(BigInt("1000000000000000000"));
      expect(tx.gas).toBe(BigInt(21000));
      expect(tx.gasPrice).toBe(BigInt("100000000000"));
      expect(tx.isError).toBe(false);
      expect(tx.confirmations).toBe(1000);
    });

    it("should handle pagination options", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        { page: 2, pageSize: 50 }
      );

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);

      // Verify URL was constructed with correct params
      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("page=2");
      expect(fetchCall).toContain("offset=50");
    });

    it("should respect max page size limit", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        { pageSize: 50000 } // Exceeds max
      );

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("offset=10000"); // Should be clamped to max
    });

    it("should handle block range options", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        { startBlock: BigInt(1000), endBlock: BigInt(2000) }
      );

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("startblock=1000");
      expect(fetchCall).toContain("endblock=2000");
    });

    it("should handle sort options", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        { sort: "asc" }
      );

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("sort=asc");
    });

    it("should include API key in request", async () => {
      const clientWithKey = new PolygonscanClient({ apiKey: "my-api-key" });

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await clientWithKey.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("apikey=my-api-key");
    });

    it("should detect hasMore when page is full", async () => {
      // Create exactly pageSize transactions
      const fullPage = Array(100).fill(sampleRawTransaction);

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: fullPage,
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.hasMore).toBe(true);
    });

    it("should throw on invalid address", async () => {
      await expect(
        client.getWalletHistory("invalid-address")
      ).rejects.toThrow(PolygonClientError);
    });

    it("should throw on empty address", async () => {
      await expect(client.getWalletHistory("")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should handle empty result", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No transactions found",
          result: [],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("should handle 'No records found' message", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "No records found",
          result: [],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions).toHaveLength(0);
    });

    it("should handle contract creation transaction (null to address)", async () => {
      const contractCreationTx = {
        ...sampleRawTransaction,
        to: "",
        contractAddress: "0x742d35cc6634c0532925a3b844bc9e7595f8b789",
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [contractCreationTx],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions[0]!.to).toBe(null);
      expect(result.transactions[0]!.contractAddress).toBe(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b789"
      );
    });

    it("should handle failed transaction", async () => {
      const failedTx = {
        ...sampleRawTransaction,
        isError: "1",
        txreceipt_status: "0",
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [failedTx],
        })
      );

      const result = await client.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions[0]!.isError).toBe(true);
      expect(result.transactions[0]!.txReceiptStatus).toBe("0");
    });

    it("should use different actions for different tx types", async () => {
      const txTypes: Array<{
        type: WalletHistoryOptions["txType"];
        action: string;
      }> = [
        { type: "normal", action: "txlist" },
        { type: "internal", action: "txlistinternal" },
        { type: "erc20", action: "tokentx" },
        { type: "erc721", action: "tokennfttx" },
        { type: "erc1155", action: "token1155tx" },
      ];

      for (const { type, action } of txTypes) {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            status: "1",
            message: "OK",
            result: [],
          })
        );

        await client.getWalletHistory(
          "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
          { txType: type }
        );

        const fetchCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]![0] as string;
        expect(fetchCall).toContain(`action=${action}`);
      }
    });
  });

  describe("getAllWalletHistory", () => {
    it("should fetch all pages of transactions", async () => {
      const page1 = Array(10000).fill(sampleRawTransaction);
      const page2 = [sampleRawTransaction, sampleRawTransaction];

      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            status: "1",
            message: "OK",
            result: page1,
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: "1",
            message: "OK",
            result: page2,
          })
        );

      const result = await client.getAllWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result).toHaveLength(10002);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should stop when page is not full", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await client.getAllWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should respect max pages limit", async () => {
      const fullPage = Array(10000).fill(sampleRawTransaction);

      // Mock always returning a full page (simulates infinite data)
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          createMockResponse({
            status: "1",
            message: "OK",
            result: fullPage,
          })
        )
      );

      const result = await client.getAllWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      // Should stop at 100 pages
      expect(mockFetch).toHaveBeenCalledTimes(100);
      expect(result).toHaveLength(1000000);

      // Reset mock after this test
      mockFetch.mockReset();
    });
  });

  describe("getInternalTransactions", () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it("should fetch internal transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawInternalTransaction],
        })
      );

      const result = await client.getInternalTransactions(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.hash).toBe(sampleRawInternalTransaction.hash);
      expect(result[0]!.type).toBe("call");
      expect(result[0]!.value).toBe(BigInt("500000000000000000"));
    });

    it("should parse internal transaction data correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawInternalTransaction],
        })
      );

      const result = await client.getInternalTransactions(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      const tx = result[0]!;
      expect(tx.blockNumber).toBe(BigInt(50000000));
      expect(tx.timestamp).toBe(1700000000);
      expect(tx.from).toBe("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(tx.to).toBe("0x742d35cc6634c0532925a3b844bc9e7595f8b456");
      expect(tx.gas).toBe(BigInt(50000));
      expect(tx.gasUsed).toBe(BigInt(30000));
      expect(tx.isError).toBe(false);
    });

    it("should throw on invalid address", async () => {
      await expect(
        client.getInternalTransactions("invalid")
      ).rejects.toThrow(PolygonClientError);
    });

    it("should use correct action for internal transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await client.getInternalTransactions(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("action=txlistinternal");
    });
  });

  describe("getTransactionCount", () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it("should fetch transaction count", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          result: "0x2a", // 42 in hex
        })
      );

      const count = await client.getTransactionCount(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(count).toBe(42);
    });

    it("should handle zero count", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          result: "0x0",
        })
      );

      const count = await client.getTransactionCount(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(count).toBe(0);
    });

    it("should throw on invalid address", async () => {
      await expect(
        client.getTransactionCount("invalid")
      ).rejects.toThrow(PolygonClientError);
    });

    it("should handle non-hex result", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          result: "not-a-hex",
        })
      );

      const count = await client.getTransactionCount(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(count).toBe(0);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it("should handle HTTP errors", async () => {
      // For HTTP errors, we need to mock for all retries (default 3 + initial = 4 calls)
      const errorResponse = createMockResponse({ error: "Server Error" }, false, 500);
      mockFetch.mockResolvedValue(errorResponse);

      await expect(
        client.getWalletHistory("0x742d35cc6634c0532925a3b844bc9e7595f8b123")
      ).rejects.toThrow(PolygonscanError);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "0",
          message: "Error",
          result: "Invalid API key",
        })
      );

      await expect(
        client.getWalletHistory("0x742d35cc6634c0532925a3b844bc9e7595f8b123")
      ).rejects.toThrow(PolygonscanError);
    });

    it("should handle rate limit errors", async () => {
      // Rate limit errors are retried, so we need to mock for all retries
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "0",
          message: "Error",
          result: "Max rate limit reached",
        })
      );

      await expect(
        client.getWalletHistory("0x742d35cc6634c0532925a3b844bc9e7595f8b123")
      ).rejects.toThrow("Request failed after");
    });

    it("should retry on rate limit errors", async () => {
      const clientWithRetry = new PolygonscanClient({
        maxRetries: 2,
        retryDelay: 10,
      });

      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            status: "0",
            message: "Error",
            result: "Max rate limit reached",
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            status: "1",
            message: "OK",
            result: [sampleRawTransaction],
          })
        );

      const result = await clientWithRetry.getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries exceeded", async () => {
      const clientWithRetry = new PolygonscanClient({
        maxRetries: 2,
        retryDelay: 10,
      });

      mockFetch.mockResolvedValue(
        createMockResponse({
          status: "0",
          message: "Error",
          result: "Max rate limit reached",
        })
      );

      await expect(
        clientWithRetry.getWalletHistory(
          "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
        )
      ).rejects.toThrow(PolygonscanError);

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should not retry on client errors", async () => {
      const clientWithRetry = new PolygonscanClient({
        maxRetries: 3,
        retryDelay: 10,
      });

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Bad Request" }, false, 400)
      );

      await expect(
        clientWithRetry.getWalletHistory(
          "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
        )
      ).rejects.toThrow(PolygonscanError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Singleton management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedPolygonscanClient();
  });

  afterEach(() => {
    resetSharedPolygonscanClient();
  });

  it("createPolygonscanClient should create new instance", () => {
    const client1 = createPolygonscanClient();
    const client2 = createPolygonscanClient();
    expect(client1).toBeInstanceOf(PolygonscanClient);
    expect(client2).toBeInstanceOf(PolygonscanClient);
    expect(client1).not.toBe(client2);
  });

  it("getSharedPolygonscanClient should return same instance", () => {
    const client1 = getSharedPolygonscanClient();
    const client2 = getSharedPolygonscanClient();
    expect(client1).toBe(client2);
  });

  it("setSharedPolygonscanClient should update shared instance", () => {
    const customClient = new PolygonscanClient({ apiKey: "custom" });
    setSharedPolygonscanClient(customClient);
    expect(getSharedPolygonscanClient()).toBe(customClient);
  });

  it("resetSharedPolygonscanClient should clear shared instance", () => {
    const client1 = getSharedPolygonscanClient();
    resetSharedPolygonscanClient();
    const client2 = getSharedPolygonscanClient();
    expect(client1).not.toBe(client2);
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedPolygonscanClient();
  });

  afterEach(() => {
    resetSharedPolygonscanClient();
  });

  describe("getWalletHistory", () => {
    it("should use shared client by default", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await getWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result.transactions).toHaveLength(1);
    });

    it("should use custom client when provided", async () => {
      const customClient = new PolygonscanClient({ apiKey: "custom-key" });

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [],
        })
      );

      await getWalletHistory("0x742d35cc6634c0532925a3b844bc9e7595f8b123", {
        client: customClient,
      });

      const fetchCall = mockFetch.mock.calls[0]![0] as string;
      expect(fetchCall).toContain("apikey=custom-key");
    });
  });

  describe("getAllWalletHistory", () => {
    it("should fetch all transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawTransaction],
        })
      );

      const result = await getAllWalletHistory(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result).toHaveLength(1);
    });
  });

  describe("getInternalTransactions", () => {
    it("should fetch internal transactions", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: "1",
          message: "OK",
          result: [sampleRawInternalTransaction],
        })
      );

      const result = await getInternalTransactions(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(result).toHaveLength(1);
    });
  });

  describe("getTransactionCount", () => {
    it("should get transaction count", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          result: "0x10",
        })
      );

      const count = await getTransactionCount(
        "0x742d35cc6634c0532925a3b844bc9e7595f8b123"
      );

      expect(count).toBe(16);
    });
  });
});

describe("PolygonscanError", () => {
  it("should create error with code", () => {
    const error = new PolygonscanError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("PolygonscanError");
  });

  it("should include status code", () => {
    const error = new PolygonscanError("Test error", "HTTP_ERROR", {
      statusCode: 500,
    });
    expect(error.statusCode).toBe(500);
  });

  it("should include response", () => {
    const response = { foo: "bar" };
    const error = new PolygonscanError("Test error", "API_ERROR", {
      response,
    });
    expect(error.response).toBe(response);
  });
});
