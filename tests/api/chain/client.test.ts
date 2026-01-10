/**
 * Tests for Polygon RPC Client (API-CHAIN-001)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  PolygonClient,
  createPolygonClient,
  getSharedPolygonClient,
  setSharedPolygonClient,
  resetSharedPolygonClient,
  DEFAULT_POLYGON_RPC_ENDPOINTS,
  PolygonClientError,
  type PolygonClientConfig,
  type RpcEndpointConfig,
  type ConnectionEvent,
} from "../../../src/api/chain";

// Mock viem modules
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(),
    http: vi.fn(() => "mock-transport"),
  };
});

vi.mock("viem/chains", () => ({
  polygon: {
    id: 137,
    name: "Polygon",
    network: "polygon",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://polygon-rpc.com"] },
    },
  },
}));

// Get mocked functions
import { createPublicClient } from "viem";
const mockCreatePublicClient = vi.mocked(createPublicClient);

describe("PolygonClient", () => {
  let mockClient: {
    getBlockNumber: ReturnType<typeof vi.fn>;
    getBlock: ReturnType<typeof vi.fn>;
    getTransaction: ReturnType<typeof vi.fn>;
    getTransactionReceipt: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
    getTransactionCount: ReturnType<typeof vi.fn>;
    getChainId: ReturnType<typeof vi.fn>;
    getGasPrice: ReturnType<typeof vi.fn>;
    estimateGas: ReturnType<typeof vi.fn>;
    getCode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(50000000)),
      getBlock: vi.fn().mockResolvedValue({
        number: BigInt(50000000),
        hash: "0xabc123",
        timestamp: BigInt(1700000000),
        parentHash: "0xdef456",
        nonce: null,
        sha3Uncles: "0x",
        logsBloom: "0x",
        transactionsRoot: "0x",
        stateRoot: "0x",
        receiptsRoot: "0x",
        miner: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        difficulty: BigInt(0),
        totalDifficulty: BigInt(0),
        extraData: "0x",
        size: BigInt(1000),
        gasLimit: BigInt(30000000),
        gasUsed: BigInt(15000000),
        baseFeePerGas: BigInt(100000000000),
        transactions: [],
        uncles: [],
      }),
      getTransaction: vi.fn().mockResolvedValue({
        hash: "0xtx123",
        nonce: 0,
        blockHash: "0xabc123",
        blockNumber: BigInt(50000000),
        transactionIndex: 0,
        from: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
        value: BigInt(1000000000000000000),
        gasPrice: BigInt(100000000000),
        gas: BigInt(21000),
        input: "0x",
        type: "0x2",
      }),
      getTransactionReceipt: vi.fn().mockResolvedValue({
        transactionHash: "0xtx123",
        transactionIndex: 0,
        blockHash: "0xabc123",
        blockNumber: BigInt(50000000),
        from: "0x742d35cc6634c0532925a3b844bc9e7595f8b123",
        to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
        cumulativeGasUsed: BigInt(21000),
        effectiveGasPrice: BigInt(100000000000),
        gasUsed: BigInt(21000),
        contractAddress: null,
        logs: [],
        logsBloom: "0x",
        status: "success",
        type: "0x2",
      }),
      getBalance: vi.fn().mockResolvedValue(BigInt(1000000000000000000)),
      getTransactionCount: vi.fn().mockResolvedValue(5),
      getChainId: vi.fn().mockResolvedValue(137),
      getGasPrice: vi.fn().mockResolvedValue(BigInt(100000000000)),
      estimateGas: vi.fn().mockResolvedValue(BigInt(21000)),
      getCode: vi.fn().mockResolvedValue("0x"),
    };

    mockCreatePublicClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createPublicClient>);
  });

  afterEach(() => {
    resetSharedPolygonClient();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================
  describe("constructor", () => {
    it("should create client with default configuration", () => {
      const client = new PolygonClient();
      expect(client).toBeInstanceOf(PolygonClient);
      expect(client.getConnectionState()).toBe("disconnected");
    });

    it("should create client with custom endpoints", () => {
      const customEndpoints: RpcEndpointConfig[] = [
        { url: "https://custom-rpc.example.com", name: "custom", priority: 1 },
      ];

      const client = new PolygonClient({ rpcEndpoints: customEndpoints });
      expect(client.getActiveEndpoint()?.url).toBe("https://custom-rpc.example.com");
    });

    it("should throw error when no endpoints are enabled", () => {
      const disabledEndpoints: RpcEndpointConfig[] = [
        { url: "https://disabled.example.com", enabled: false },
      ];

      expect(() => new PolygonClient({ rpcEndpoints: disabledEndpoints })).toThrow(
        PolygonClientError
      );
    });

    it("should sort endpoints by priority", () => {
      const endpoints: RpcEndpointConfig[] = [
        { url: "https://low-priority.com", priority: 100 },
        { url: "https://high-priority.com", priority: 1 },
        { url: "https://medium-priority.com", priority: 50 },
      ];

      const client = new PolygonClient({ rpcEndpoints: endpoints });
      expect(client.getActiveEndpoint()?.url).toBe("https://high-priority.com");
    });

    it("should filter out disabled endpoints", () => {
      const endpoints: RpcEndpointConfig[] = [
        { url: "https://enabled.com", enabled: true },
        { url: "https://disabled.com", enabled: false },
      ];

      const client = new PolygonClient({ rpcEndpoints: endpoints });
      const health = client.getEndpointHealth();
      expect(health.length).toBe(1);
      expect(health[0]?.url).toBe("https://enabled.com");
    });

    it("should apply custom configuration", () => {
      const config: PolygonClientConfig = {
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
        debug: true,
        pollingInterval: 8000,
        batch: {
          enabled: false,
        },
      };

      const client = new PolygonClient(config);
      expect(client).toBeInstanceOf(PolygonClient);
    });
  });

  // ===========================================================================
  // Factory Functions Tests
  // ===========================================================================
  describe("factory functions", () => {
    it("createPolygonClient should create new instance", () => {
      const client1 = createPolygonClient();
      const client2 = createPolygonClient();
      expect(client1).not.toBe(client2);
    });

    it("getSharedPolygonClient should return same instance", () => {
      const client1 = getSharedPolygonClient();
      const client2 = getSharedPolygonClient();
      expect(client1).toBe(client2);
    });

    it("setSharedPolygonClient should set shared instance", () => {
      const customClient = createPolygonClient();
      setSharedPolygonClient(customClient);
      expect(getSharedPolygonClient()).toBe(customClient);
    });

    it("resetSharedPolygonClient should clear shared instance", () => {
      const client1 = getSharedPolygonClient();
      resetSharedPolygonClient();
      const client2 = getSharedPolygonClient();
      expect(client1).not.toBe(client2);
    });
  });

  // ===========================================================================
  // Connection Tests
  // ===========================================================================
  describe("connection", () => {
    it("should connect successfully", async () => {
      const client = new PolygonClient();
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(client.getConnectionState()).toBe("connected");
      expect(mockCreatePublicClient).toHaveBeenCalled();
    });

    it("should not reconnect when already connected", async () => {
      const client = new PolygonClient();
      await client.connect();
      await client.connect();

      expect(mockCreatePublicClient).toHaveBeenCalledTimes(1);
    });

    it("should disconnect successfully", async () => {
      const client = new PolygonClient();
      await client.connect();
      client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getConnectionState()).toBe("disconnected");
    });

    it("should emit connection events", async () => {
      const client = new PolygonClient();
      const events: ConnectionEvent[] = [];

      client.onConnectionEvent((event) => {
        events.push(event);
      });

      await client.connect();
      client.disconnect();

      expect(events.some((e) => e.type === "connect")).toBe(true);
      expect(events.some((e) => e.type === "disconnect")).toBe(true);
    });

    it("should allow unsubscribing from connection events", async () => {
      const client = new PolygonClient();
      const events: ConnectionEvent[] = [];

      const subscription = client.onConnectionEvent((event) => {
        events.push(event);
      });

      await client.connect();
      subscription.dispose();
      client.disconnect();

      // Should only have connect event, not disconnect
      expect(events.filter((e) => e.type === "connect").length).toBe(1);
      expect(events.filter((e) => e.type === "disconnect").length).toBe(0);
    });
  });

  // ===========================================================================
  // Blockchain Query Tests
  // ===========================================================================
  describe("blockchain queries", () => {
    let client: PolygonClient;

    beforeEach(async () => {
      client = new PolygonClient();
    });

    it("should get block number", async () => {
      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(BigInt(50000000));
      expect(mockClient.getBlockNumber).toHaveBeenCalled();
    });

    it("should get block by number", async () => {
      const block = await client.getBlock(BigInt(50000000));
      expect(block.number).toBe(BigInt(50000000));
      expect(mockClient.getBlock).toHaveBeenCalled();
    });

    it("should get block by tag (latest)", async () => {
      const block = await client.getBlock("latest");
      expect(block).toBeDefined();
      expect(mockClient.getBlock).toHaveBeenCalled();
    });

    it("should get block by hash", async () => {
      const block = await client.getBlockByHash("0xabc123");
      expect(block).toBeDefined();
      expect(mockClient.getBlock).toHaveBeenCalledWith({ blockHash: "0xabc123" });
    });

    it("should get transaction", async () => {
      const tx = await client.getTransaction("0xtx123");
      expect(tx.hash).toBe("0xtx123");
      expect(mockClient.getTransaction).toHaveBeenCalledWith({ hash: "0xtx123" });
    });

    it("should get transaction receipt", async () => {
      const receipt = await client.getTransactionReceipt("0xtx123");
      expect(receipt.transactionHash).toBe("0xtx123");
      expect(receipt.status).toBe("success");
      expect(mockClient.getTransactionReceipt).toHaveBeenCalled();
    });

    it("should get balance", async () => {
      const balance = await client.getBalance("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(balance).toBe(BigInt(1000000000000000000));
      expect(mockClient.getBalance).toHaveBeenCalled();
    });

    it("should throw error for invalid address in getBalance", async () => {
      await expect(client.getBalance("invalid-address")).rejects.toThrow(PolygonClientError);
    });

    it("should get transaction count", async () => {
      const count = await client.getTransactionCount("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(count).toBe(5);
      expect(mockClient.getTransactionCount).toHaveBeenCalled();
    });

    it("should throw error for invalid address in getTransactionCount", async () => {
      await expect(client.getTransactionCount("invalid-address")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should get chain ID", async () => {
      const chainId = await client.getChainId();
      expect(chainId).toBe(137);
      expect(mockClient.getChainId).toHaveBeenCalled();
    });

    it("should get gas price", async () => {
      const gasPrice = await client.getGasPrice();
      expect(gasPrice).toBe(BigInt(100000000000));
      expect(mockClient.getGasPrice).toHaveBeenCalled();
    });

    it("should estimate gas", async () => {
      const gas = await client.estimateGas({
        to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
        value: BigInt(1000000000000000000),
      });
      expect(gas).toBe(BigInt(21000));
      expect(mockClient.estimateGas).toHaveBeenCalled();
    });

    it("should throw error for invalid to address in estimateGas", async () => {
      await expect(
        client.estimateGas({
          to: "invalid-address",
        })
      ).rejects.toThrow(PolygonClientError);
    });

    it("should throw error for invalid from address in estimateGas", async () => {
      await expect(
        client.estimateGas({
          from: "invalid-address",
          to: "0x742d35cc6634c0532925a3b844bc9e7595f8b456",
        })
      ).rejects.toThrow(PolygonClientError);
    });

    it("should get code at address", async () => {
      const code = await client.getCode("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(code).toBe("0x");
      expect(mockClient.getCode).toHaveBeenCalled();
    });

    it("should check if address is contract", async () => {
      mockClient.getCode.mockResolvedValueOnce("0x608060405234801561001057600080");
      const isContract = await client.isContract("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(isContract).toBe(true);
    });

    it("should return false for EOA address", async () => {
      mockClient.getCode.mockResolvedValueOnce("0x");
      const isContract = await client.isContract("0x742d35cc6634c0532925a3b844bc9e7595f8b123");
      expect(isContract).toBe(false);
    });
  });

  // ===========================================================================
  // Retry and Failover Tests
  // ===========================================================================
  describe("retry and failover", () => {
    it("should retry on failure", async () => {
      mockClient.getBlockNumber
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce(BigInt(50000000));

      const client = new PolygonClient({
        maxRetries: 2,
        retryDelay: 10,
      });

      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(BigInt(50000000));
      expect(mockClient.getBlockNumber).toHaveBeenCalledTimes(2);
    });

    it("should throw after all retries exhausted", async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error("Persistent error"));

      const client = new PolygonClient({
        maxRetries: 2,
        retryDelay: 10,
        rpcEndpoints: [
          { url: "https://single-endpoint.com", priority: 1 },
        ],
      });

      await expect(client.getBlockNumber()).rejects.toThrow(PolygonClientError);
    });

    it("should switch endpoints on certain errors", async () => {
      mockClient.getBlockNumber
        .mockRejectedValueOnce(new Error("rate limit exceeded"))
        .mockResolvedValueOnce(BigInt(50000000));

      const client = new PolygonClient({
        maxRetries: 2,
        retryDelay: 10,
        rpcEndpoints: [
          { url: "https://endpoint1.com", priority: 1 },
          { url: "https://endpoint2.com", priority: 2 },
        ],
      });

      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(BigInt(50000000));
      expect(client.getStats().endpointSwitches).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================
  describe("statistics", () => {
    it("should track request statistics", async () => {
      const client = new PolygonClient();
      await client.getBlockNumber();
      await client.getBlockNumber();

      const stats = client.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
    });

    it("should track failed requests", async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error("Error"));

      const client = new PolygonClient({
        maxRetries: 0,
        rpcEndpoints: [{ url: "https://single.com", priority: 1 }],
      });

      await expect(client.getBlockNumber()).rejects.toThrow();

      const stats = client.getStats();
      expect(stats.failedRequests).toBe(1);
    });

    it("should report connection state", async () => {
      const client = new PolygonClient();
      expect(client.getStats().connectionState).toBe("disconnected");

      await client.connect();
      expect(client.getStats().connectionState).toBe("connected");
    });

    it("should track uptime", async () => {
      const client = new PolygonClient();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = client.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(50);
    });
  });

  // ===========================================================================
  // Endpoint Health Tests
  // ===========================================================================
  describe("endpoint health", () => {
    it("should initialize endpoint health", () => {
      const client = new PolygonClient();
      const health = client.getEndpointHealth();

      expect(health.length).toBe(DEFAULT_POLYGON_RPC_ENDPOINTS.length);
      for (const h of health) {
        expect(h.isHealthy).toBe(true);
        expect(h.consecutiveFailures).toBe(0);
      }
    });

    it("should update health on successful request", async () => {
      const client = new PolygonClient({
        rpcEndpoints: [{ url: "https://test.com", priority: 1 }],
      });

      await client.getBlockNumber();

      const health = client.getEndpointHealth();
      expect(health[0]?.successfulRequests).toBe(1);
      expect(health[0]?.lastSuccessful).toBeDefined();
    });

    it("should update health on failed request", async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error("Error"));

      const client = new PolygonClient({
        maxRetries: 0,
        rpcEndpoints: [{ url: "https://test.com", priority: 1 }],
      });

      await expect(client.getBlockNumber()).rejects.toThrow();

      const health = client.getEndpointHealth();
      expect(health[0]?.consecutiveFailures).toBeGreaterThan(0);
    });

    it("should check specific endpoint health", async () => {
      const client = new PolygonClient({
        rpcEndpoints: [{ url: "https://test.com", priority: 1 }],
      });

      const health = await client.checkEndpointHealth("https://test.com");
      expect(health.isHealthy).toBe(true);
      expect(health.lastChecked).toBeDefined();
    });

    it("should throw error for unknown endpoint in health check", async () => {
      const client = new PolygonClient();
      await expect(client.checkEndpointHealth("https://unknown.com")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should check all endpoints health", async () => {
      const client = new PolygonClient({
        rpcEndpoints: [
          { url: "https://endpoint1.com", priority: 1 },
          { url: "https://endpoint2.com", priority: 2 },
        ],
      });

      const healthResults = await client.checkAllEndpointsHealth();
      expect(healthResults.length).toBe(2);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe("error handling", () => {
    it("should throw PolygonClientError with correct code for invalid address", async () => {
      const client = new PolygonClient();

      try {
        await client.getBalance("invalid");
      } catch (error) {
        expect(error).toBeInstanceOf(PolygonClientError);
        expect((error as PolygonClientError).code).toBe("INVALID_ADDRESS");
      }
    });

    it("should include endpoint in error context", async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error("Test error"));

      const client = new PolygonClient({
        maxRetries: 0,
        rpcEndpoints: [{ url: "https://test.com", priority: 1 }],
      });

      try {
        await client.getBlockNumber();
      } catch (error) {
        expect(error).toBeInstanceOf(PolygonClientError);
        expect((error as PolygonClientError).code).toBe("ALL_ENDPOINTS_FAILED");
      }
    });
  });

  // ===========================================================================
  // Chain Configuration Tests
  // ===========================================================================
  describe("chain configuration", () => {
    it("should return chain configuration", () => {
      const client = new PolygonClient();
      const chain = client.getChain();
      expect(chain.id).toBe(137);
      expect(chain.name).toBe("Polygon");
    });

    it("should use custom chain", () => {
      const customChain = {
        id: 80001,
        name: "Mumbai",
        network: "mumbai",
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
        rpcUrls: {
          default: { http: ["https://rpc-mumbai.matic.today"] },
        },
      };

      const config: PolygonClientConfig = {
        chain: customChain as PolygonClientConfig["chain"],
      };
      const client = new PolygonClient(config);
      const chain = client.getChain();
      expect(chain.id).toBe(80001);
    });
  });

  // ===========================================================================
  // Default Endpoints Tests
  // ===========================================================================
  describe("default endpoints", () => {
    it("should export default Polygon RPC endpoints", () => {
      expect(DEFAULT_POLYGON_RPC_ENDPOINTS).toBeDefined();
      expect(DEFAULT_POLYGON_RPC_ENDPOINTS.length).toBeGreaterThan(0);
    });

    it("should have valid endpoint structure", () => {
      for (const endpoint of DEFAULT_POLYGON_RPC_ENDPOINTS) {
        expect(endpoint.url).toBeDefined();
        expect(endpoint.url.startsWith("https://")).toBe(true);
        expect(endpoint.priority).toBeDefined();
      }
    });
  });
});
