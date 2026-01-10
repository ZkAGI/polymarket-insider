/**
 * Polygon RPC Client (API-CHAIN-001)
 *
 * Initialize connection to Polygon network RPC endpoint with support for:
 * - Multiple RPC endpoints for failover
 * - Automatic retry with exponential backoff
 * - Connection health monitoring
 * - Request batching
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  type HttpTransport,
  type Chain,
  isAddress,
  getAddress,
} from "viem";
import { polygon } from "viem/chains";

import {
  type PolygonClientConfig,
  type PolygonClientLogger,
  type RpcEndpointConfig,
  type ConnectionState,
  type ConnectionEvent,
  type ConnectionEventListener,
  type EndpointHealth,
  type ClientStats,
  type BlockInfo,
  type TransactionInfo,
  type TransactionReceipt,
  type Disposable,
  PolygonClientError,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Default Polygon RPC endpoints (public, free tier) */
export const DEFAULT_POLYGON_RPC_ENDPOINTS: RpcEndpointConfig[] = [
  {
    url: "https://polygon-rpc.com",
    name: "polygon-rpc-primary",
    priority: 1,
    enabled: true,
    rateLimit: 10,
    timeout: 30000,
  },
  {
    url: "https://rpc-mainnet.matic.network",
    name: "matic-network",
    priority: 2,
    enabled: true,
    rateLimit: 10,
    timeout: 30000,
  },
  {
    url: "https://rpc-mainnet.maticvigil.com",
    name: "matic-vigil",
    priority: 3,
    enabled: true,
    rateLimit: 5,
    timeout: 30000,
  },
];

/** Default configuration */
const DEFAULT_CONFIG: Required<Omit<PolygonClientConfig, "rpcEndpoints" | "logger">> = {
  chain: polygon,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  debug: false,
  batch: {
    enabled: true,
    maxSize: 10,
    wait: 50,
  },
  pollingInterval: 4000,
};

// ============================================================================
// PolygonClient Class
// ============================================================================

/**
 * Polygon blockchain client with multi-endpoint support and automatic failover
 */
export class PolygonClient {
  private readonly config: Required<Omit<PolygonClientConfig, "rpcEndpoints" | "logger">> & {
    logger: PolygonClientLogger;
  };
  private readonly endpoints: RpcEndpointConfig[];
  private readonly endpointHealth: Map<string, EndpointHealth> = new Map();
  private activeEndpointIndex: number = 0;
  private client: PublicClient<HttpTransport, Chain> | null = null;
  private connectionState: ConnectionState = "disconnected";
  private connectionListeners: Set<ConnectionEventListener> = new Set();
  private readonly startTime: Date = new Date();

  // Statistics
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retries: 0,
    endpointSwitches: 0,
    totalLatency: 0,
    lastSuccessfulRequest: undefined as Date | undefined,
    lastError: undefined as Error | undefined,
  };

  constructor(config: PolygonClientConfig = {}) {
    // Merge configuration with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      batch: { ...DEFAULT_CONFIG.batch, ...config.batch },
      logger: config.logger ?? console,
    };

    // Initialize endpoints
    this.endpoints = (config.rpcEndpoints ?? DEFAULT_POLYGON_RPC_ENDPOINTS)
      .filter((e) => e.enabled !== false)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    if (this.endpoints.length === 0) {
      throw new PolygonClientError("No RPC endpoints configured", "CONNECTION_FAILED");
    }

    // Initialize endpoint health tracking
    for (const endpoint of this.endpoints) {
      this.endpointHealth.set(endpoint.url, {
        url: endpoint.url,
        name: endpoint.name,
        isHealthy: true,
        lastChecked: new Date(),
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
      });
    }

    this.debug("PolygonClient initialized", {
      endpoints: this.endpoints.map((e) => e.url),
      chain: this.config.chain.name,
    });
  }

  // ==========================================================================
  // Public API - Connection Management
  // ==========================================================================

  /**
   * Connect to the Polygon network
   */
  async connect(): Promise<void> {
    if (this.connectionState === "connected") {
      return;
    }

    this.setConnectionState("connecting");

    try {
      await this.createClient();
      await this.testConnection();
      this.setConnectionState("connected");
      this.emitConnectionEvent({
        type: "connect",
        timestamp: new Date(),
        endpointUrl: this.getActiveEndpoint()?.url,
      });
    } catch (error) {
      this.setConnectionState("error");
      throw error;
    }
  }

  /**
   * Disconnect from the Polygon network
   */
  disconnect(): void {
    this.client = null;
    this.setConnectionState("disconnected");
    this.emitConnectionEvent({
      type: "disconnect",
      timestamp: new Date(),
    });
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected" && this.client !== null;
  }

  /**
   * Subscribe to connection events
   */
  onConnectionEvent(listener: ConnectionEventListener): Disposable {
    this.connectionListeners.add(listener);
    return {
      dispose: () => {
        this.connectionListeners.delete(listener);
      },
    };
  }

  // ==========================================================================
  // Public API - Blockchain Queries
  // ==========================================================================

  /**
   * Get the current block number
   */
  async getBlockNumber(): Promise<bigint> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.getBlockNumber();
    });
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber?: bigint | "latest" | "earliest" | "pending"): Promise<BlockInfo> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      let block;
      if (typeof blockNumber === "bigint") {
        block = await client.getBlock({ blockNumber });
      } else if (typeof blockNumber === "string") {
        block = await client.getBlock({ blockTag: blockNumber });
      } else {
        block = await client.getBlock();
      }
      return block as unknown as BlockInfo;
    });
  }

  /**
   * Get block by hash
   */
  async getBlockByHash(blockHash: string): Promise<BlockInfo> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      const block = await client.getBlock({ blockHash: blockHash as `0x${string}` });
      return block as unknown as BlockInfo;
    });
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<TransactionInfo> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      return tx as unknown as TransactionInfo;
    });
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      return receipt as unknown as TransactionReceipt;
    });
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string, blockNumber?: bigint): Promise<bigint> {
    if (!isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.getBalance({
        address: getAddress(address),
        blockNumber,
      });
    });
  }

  /**
   * Get transaction count (nonce) for an address
   */
  async getTransactionCount(address: string, blockNumber?: bigint): Promise<number> {
    if (!isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.getTransactionCount({
        address: getAddress(address),
        blockNumber,
      });
    });
  }

  /**
   * Get chain ID
   */
  async getChainId(): Promise<number> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.getChainId();
    });
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.getGasPrice();
    });
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: {
    from?: string;
    to: string;
    value?: bigint;
    data?: string;
  }): Promise<bigint> {
    if (params.to && !isAddress(params.to)) {
      throw new PolygonClientError(`Invalid to address: ${params.to}`, "INVALID_ADDRESS");
    }
    if (params.from && !isAddress(params.from)) {
      throw new PolygonClientError(`Invalid from address: ${params.from}`, "INVALID_ADDRESS");
    }

    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      return client.estimateGas({
        account: params.from ? (getAddress(params.from) as `0x${string}`) : undefined,
        to: getAddress(params.to) as `0x${string}`,
        value: params.value,
        data: params.data as `0x${string}`,
      });
    });
  }

  /**
   * Get code at an address (for contract verification)
   */
  async getCode(address: string, blockNumber?: bigint): Promise<string> {
    if (!isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    return this.executeWithRetry(async () => {
      const client = await this.getClient();
      const code = await client.getCode({
        address: getAddress(address),
        blockNumber,
      });
      return code ?? "0x";
    });
  }

  /**
   * Check if an address is a contract
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.getCode(address);
    return code !== "0x" && code.length > 2;
  }

  // ==========================================================================
  // Public API - Health and Statistics
  // ==========================================================================

  /**
   * Get client statistics
   */
  getStats(): ClientStats {
    const healthArray: EndpointHealth[] = [];
    for (const health of this.endpointHealth.values()) {
      healthArray.push(health);
    }

    return {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      retries: this.stats.retries,
      endpointSwitches: this.stats.endpointSwitches,
      averageLatency:
        this.stats.totalRequests > 0
          ? this.stats.totalLatency / this.stats.successfulRequests
          : 0,
      connectionState: this.connectionState,
      activeEndpoint: this.getActiveEndpoint()?.url,
      endpointHealth: healthArray,
      uptime: Date.now() - this.startTime.getTime(),
      lastSuccessfulRequest: this.stats.lastSuccessfulRequest,
      lastError: this.stats.lastError,
    };
  }

  /**
   * Get health status of all endpoints
   */
  getEndpointHealth(): EndpointHealth[] {
    return Array.from(this.endpointHealth.values());
  }

  /**
   * Check health of a specific endpoint
   */
  async checkEndpointHealth(endpointUrl?: string): Promise<EndpointHealth> {
    const url = endpointUrl ?? this.getActiveEndpoint()?.url;
    if (!url) {
      throw new PolygonClientError("No endpoint URL provided", "CONNECTION_FAILED");
    }

    const health = this.endpointHealth.get(url);
    if (!health) {
      throw new PolygonClientError(`Unknown endpoint: ${url}`, "CONNECTION_FAILED");
    }

    const startTime = Date.now();

    try {
      const tempClient = createPublicClient({
        chain: this.config.chain,
        transport: http(url, { timeout: this.config.timeout }),
      });

      await tempClient.getBlockNumber();

      const latency = Date.now() - startTime;
      health.isHealthy = true;
      health.lastChecked = new Date();
      health.lastSuccessful = new Date();
      health.latency = latency;
      health.consecutiveFailures = 0;

      return health;
    } catch (error) {
      health.isHealthy = false;
      health.lastChecked = new Date();
      health.lastError = error as Error;
      health.consecutiveFailures++;

      return health;
    }
  }

  /**
   * Check health of all endpoints
   */
  async checkAllEndpointsHealth(): Promise<EndpointHealth[]> {
    const results = await Promise.all(
      this.endpoints.map((e) => this.checkEndpointHealth(e.url))
    );
    return results;
  }

  // ==========================================================================
  // Public API - Low Level Access
  // ==========================================================================

  /**
   * Get the underlying viem PublicClient (for advanced use cases)
   */
  async getClient(): Promise<PublicClient<HttpTransport, Chain>> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new PolygonClientError("Failed to create client", "CONNECTION_FAILED");
    }
    return this.client;
  }

  /**
   * Get the active endpoint configuration
   */
  getActiveEndpoint(): RpcEndpointConfig | undefined {
    return this.endpoints[this.activeEndpointIndex];
  }

  /**
   * Get the chain configuration
   */
  getChain(): Chain {
    return this.config.chain;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create the viem client for the active endpoint
   */
  private async createClient(): Promise<void> {
    const endpoint = this.getActiveEndpoint();
    if (!endpoint) {
      throw new PolygonClientError("No RPC endpoints available", "ALL_ENDPOINTS_FAILED");
    }

    this.debug(`Creating client for endpoint: ${endpoint.url}`);

    this.client = createPublicClient({
      chain: this.config.chain,
      transport: http(endpoint.url, {
        timeout: endpoint.timeout ?? this.config.timeout,
        batch: this.config.batch.enabled
          ? {
              batchSize: this.config.batch.maxSize,
              wait: this.config.batch.wait,
            }
          : undefined,
      }),
    });
  }

  /**
   * Test the connection by fetching the block number
   */
  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new PolygonClientError("Client not initialized", "CONNECTION_FAILED");
    }

    const startTime = Date.now();
    const blockNumber = await this.client.getBlockNumber();
    const latency = Date.now() - startTime;

    this.debug(`Connection test successful. Block number: ${blockNumber}, Latency: ${latency}ms`);

    // Update endpoint health
    const endpoint = this.getActiveEndpoint();
    if (endpoint) {
      const health = this.endpointHealth.get(endpoint.url);
      if (health) {
        health.isHealthy = true;
        health.lastChecked = new Date();
        health.lastSuccessful = new Date();
        health.latency = latency;
        health.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Execute a request with retry logic and endpoint failover
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let retriesRemaining = this.config.maxRetries;
    const startTime = Date.now();

    this.stats.totalRequests++;

    while (retriesRemaining >= 0) {
      try {
        if (!this.client) {
          await this.connect();
        }

        const result = await fn();

        // Update stats on success
        const latency = Date.now() - startTime;
        this.stats.successfulRequests++;
        this.stats.totalLatency += latency;
        this.stats.lastSuccessfulRequest = new Date();

        // Update endpoint health
        const endpoint = this.getActiveEndpoint();
        if (endpoint) {
          const health = this.endpointHealth.get(endpoint.url);
          if (health) {
            health.totalRequests++;
            health.successfulRequests++;
            health.isHealthy = true;
            health.lastSuccessful = new Date();
            health.consecutiveFailures = 0;
          }
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.stats.lastError = lastError;

        // Update endpoint health on failure
        const endpoint = this.getActiveEndpoint();
        if (endpoint) {
          const health = this.endpointHealth.get(endpoint.url);
          if (health) {
            health.totalRequests++;
            health.consecutiveFailures++;
            health.lastError = lastError;
            health.lastChecked = new Date();

            // Mark endpoint as unhealthy after multiple failures
            if (health.consecutiveFailures >= 3) {
              health.isHealthy = false;
            }
          }
        }

        // Try switching to a different endpoint
        if (this.shouldSwitchEndpoint(lastError)) {
          const switched = await this.switchEndpoint();
          if (switched) {
            this.stats.endpointSwitches++;
            continue; // Retry with new endpoint
          }
        }

        retriesRemaining--;
        this.stats.retries++;

        if (retriesRemaining >= 0) {
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, this.config.maxRetries - retriesRemaining - 1);
          this.debug(`Retrying in ${delay}ms (${retriesRemaining} retries remaining)`);
          await this.sleep(delay);
        }
      }
    }

    this.stats.failedRequests++;

    throw new PolygonClientError(
      `Request failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      "ALL_ENDPOINTS_FAILED",
      { cause: lastError }
    );
  }

  /**
   * Determine if we should switch endpoints based on the error
   */
  private shouldSwitchEndpoint(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes("timeout") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429") ||
      errorMessage.includes("503") ||
      errorMessage.includes("502") ||
      errorMessage.includes("connection refused") ||
      errorMessage.includes("network error")
    );
  }

  /**
   * Switch to the next healthy endpoint
   */
  private async switchEndpoint(): Promise<boolean> {
    const originalIndex = this.activeEndpointIndex;

    for (let i = 1; i < this.endpoints.length; i++) {
      const nextIndex = (this.activeEndpointIndex + i) % this.endpoints.length;
      const health = this.endpointHealth.get(this.endpoints[nextIndex]!.url);

      if (health?.isHealthy || health?.consecutiveFailures === 0) {
        this.activeEndpointIndex = nextIndex;
        this.debug(`Switching to endpoint: ${this.endpoints[nextIndex]!.url}`);

        await this.createClient();

        this.emitConnectionEvent({
          type: "endpointSwitch",
          timestamp: new Date(),
          endpointUrl: this.endpoints[nextIndex]!.url,
        });

        return true;
      }
    }

    // If all endpoints are unhealthy, reset and try the first one again
    this.activeEndpointIndex = 0;
    if (this.activeEndpointIndex !== originalIndex) {
      await this.createClient();
      return true;
    }

    return false;
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    if (previousState !== state) {
      this.emitConnectionEvent({
        type: "stateChange",
        timestamp: new Date(),
        previousState,
        currentState: state,
      });
    }
  }

  /**
   * Emit a connection event to all listeners
   */
  private emitConnectionEvent(event: ConnectionEvent): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(event);
      } catch (error) {
        this.config.logger.error("Connection event listener error:", error);
      }
    }
  }

  /**
   * Log debug message
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      this.config.logger.debug(`[PolygonClient] ${message}`, ...args);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedClient: PolygonClient | null = null;

/**
 * Create a new PolygonClient instance
 */
export function createPolygonClient(config?: PolygonClientConfig): PolygonClient {
  return new PolygonClient(config);
}

/**
 * Get the shared PolygonClient instance (creates one if it doesn't exist)
 */
export function getSharedPolygonClient(): PolygonClient {
  if (!sharedClient) {
    sharedClient = new PolygonClient();
  }
  return sharedClient;
}

/**
 * Set the shared PolygonClient instance
 */
export function setSharedPolygonClient(client: PolygonClient): void {
  sharedClient = client;
}

/**
 * Reset the shared PolygonClient instance
 */
export function resetSharedPolygonClient(): void {
  if (sharedClient) {
    sharedClient.disconnect();
    sharedClient = null;
  }
}
