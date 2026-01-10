/**
 * Wallet History API (API-CHAIN-002)
 *
 * Retrieve on-chain transaction history for a wallet address using Polygonscan API.
 * Features:
 * - Fetch normal transactions
 * - Fetch internal transactions
 * - Pagination support
 * - Retry logic with exponential backoff
 * - Rate limiting awareness
 */

import { isAddress, getAddress } from "viem";

import {
  type WalletTransaction,
  type InternalTransaction,
  type WalletHistoryOptions,
  type WalletHistoryResult,
  type PolygonscanConfig,
  PolygonscanError,
  PolygonClientError,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Default Polygonscan API base URL */
const DEFAULT_POLYGONSCAN_BASE_URL = "https://api.polygonscan.com/api";

/** Default request timeout in ms */
const DEFAULT_TIMEOUT = 30000;

/** Default max retries */
const DEFAULT_MAX_RETRIES = 3;

/** Default retry delay in ms */
const DEFAULT_RETRY_DELAY = 1000;

/** Default page size */
const DEFAULT_PAGE_SIZE = 100;

/** Maximum page size allowed by Polygonscan */
const MAX_PAGE_SIZE = 10000;

// ============================================================================
// Types for Raw API Responses
// ============================================================================

interface PolygonscanApiResponse<T> {
  status: string;
  message: string;
  result: T | string;
}

interface RawTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

interface RawInternalTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: string;
  gas: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
}

// ============================================================================
// Polygonscan Client Class
// ============================================================================

/**
 * Client for interacting with Polygonscan API
 */
export class PolygonscanClient {
  private readonly config: Required<Omit<PolygonscanConfig, "apiKey">> & {
    apiKey?: string;
  };

  constructor(config: PolygonscanConfig = {}) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_POLYGONSCAN_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
    };
  }

  /**
   * Fetch wallet transaction history
   */
  async getWalletHistory(
    address: string,
    options: WalletHistoryOptions = {}
  ): Promise<WalletHistoryResult> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sort = options.sort ?? "desc";
    const txType = options.txType ?? "normal";

    // Build query parameters
    const params = new URLSearchParams({
      module: "account",
      action: this.getActionForTxType(txType),
      address: normalizedAddress,
      page: String(page),
      offset: String(pageSize),
      sort,
    });

    // Add block range if specified
    if (options.startBlock !== undefined) {
      params.set("startblock", String(options.startBlock));
    }
    if (options.endBlock !== undefined) {
      params.set("endblock", String(options.endBlock));
    }

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request with retry
    const response = await this.executeWithRetry<RawTransaction[]>(params);

    // Parse transactions
    const transactions = response.map((tx) => this.parseTransaction(tx));

    // Determine if there are more results
    const hasMore = transactions.length === pageSize;

    return {
      address: normalizedAddress,
      transactions,
      hasMore,
      page,
      pageSize,
    };
  }

  /**
   * Fetch all wallet transactions (handles pagination automatically)
   */
  async getAllWalletHistory(
    address: string,
    options: Omit<WalletHistoryOptions, "page"> = {}
  ): Promise<WalletTransaction[]> {
    const allTransactions: WalletTransaction[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 100; // Safety limit to prevent infinite loops

    while (hasMore && page <= maxPages) {
      const result = await this.getWalletHistory(address, {
        ...options,
        page,
        pageSize: options.pageSize ?? MAX_PAGE_SIZE,
      });

      allTransactions.push(...result.transactions);
      hasMore = result.hasMore;
      page++;
    }

    return allTransactions;
  }

  /**
   * Fetch internal transactions for a wallet
   */
  async getInternalTransactions(
    address: string,
    options: Omit<WalletHistoryOptions, "txType"> = {}
  ): Promise<InternalTransaction[]> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sort = options.sort ?? "desc";

    // Build query parameters
    const params = new URLSearchParams({
      module: "account",
      action: "txlistinternal",
      address: normalizedAddress,
      page: String(page),
      offset: String(pageSize),
      sort,
    });

    // Add block range if specified
    if (options.startBlock !== undefined) {
      params.set("startblock", String(options.startBlock));
    }
    if (options.endBlock !== undefined) {
      params.set("endblock", String(options.endBlock));
    }

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request with retry
    const response = await this.executeWithRetry<RawInternalTransaction[]>(params);

    // Parse internal transactions
    return response.map((tx) => this.parseInternalTransaction(tx));
  }

  /**
   * Get transaction count for a wallet (total number of transactions)
   */
  async getTransactionCount(address: string): Promise<number> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);

    // Build query parameters
    const params = new URLSearchParams({
      module: "proxy",
      action: "eth_getTransactionCount",
      address: normalizedAddress,
      tag: "latest",
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const url = `${this.config.baseUrl}?${params.toString()}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new PolygonscanError(
        `HTTP error: ${response.status} ${response.statusText}`,
        "HTTP_ERROR",
        { statusCode: response.status }
      );
    }

    const data = (await response.json()) as { result: string };

    // Parse hex result to number
    if (typeof data.result === "string" && data.result.startsWith("0x")) {
      return parseInt(data.result, 16);
    }

    return 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get Polygonscan action for transaction type
   */
  private getActionForTxType(txType: WalletHistoryOptions["txType"]): string {
    switch (txType) {
      case "internal":
        return "txlistinternal";
      case "erc20":
        return "tokentx";
      case "erc721":
        return "tokennfttx";
      case "erc1155":
        return "token1155tx";
      case "normal":
      default:
        return "txlist";
    }
  }

  /**
   * Execute API request with retry logic
   */
  private async executeWithRetry<T>(params: URLSearchParams): Promise<T> {
    let lastError: Error | undefined;
    let retriesRemaining = this.config.maxRetries;

    while (retriesRemaining >= 0) {
      try {
        const url = `${this.config.baseUrl}?${params.toString()}`;
        const response = await this.fetchWithTimeout(url);

        if (!response.ok) {
          throw new PolygonscanError(
            `HTTP error: ${response.status} ${response.statusText}`,
            "HTTP_ERROR",
            { statusCode: response.status }
          );
        }

        const data = (await response.json()) as PolygonscanApiResponse<T>;

        // Check for API-level errors
        if (data.status === "0") {
          // "No transactions found" is not an error, return empty array
          if (
            data.message === "No transactions found" ||
            data.message === "No records found" ||
            (typeof data.result === "string" && data.result.includes("No transactions found"))
          ) {
            return [] as unknown as T;
          }

          // Check for rate limiting
          if (
            typeof data.result === "string" &&
            (data.result.includes("rate limit") ||
              data.result.includes("Max rate limit"))
          ) {
            throw new PolygonscanError(
              "Rate limit exceeded",
              "RATE_LIMIT",
              { response: data }
            );
          }

          throw new PolygonscanError(
            typeof data.result === "string" ? data.result : data.message,
            "API_ERROR",
            { response: data }
          );
        }

        // Handle successful response
        if (Array.isArray(data.result)) {
          return data.result as T;
        }

        // Handle unexpected response format
        return [] as unknown as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (except rate limiting)
        if (
          error instanceof PolygonscanError &&
          error.code !== "RATE_LIMIT" &&
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500
        ) {
          throw error;
        }

        retriesRemaining--;

        if (retriesRemaining >= 0) {
          // Exponential backoff
          const delay =
            this.config.retryDelay *
            Math.pow(2, this.config.maxRetries - retriesRemaining - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new PolygonscanError(
      `Request failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      "MAX_RETRIES_EXCEEDED",
      { response: lastError }
    );
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse raw transaction from Polygonscan API
   */
  private parseTransaction(raw: RawTransaction): WalletTransaction {
    return {
      hash: raw.hash,
      blockNumber: BigInt(raw.blockNumber),
      timestamp: parseInt(raw.timeStamp, 10),
      nonce: parseInt(raw.nonce, 10),
      blockHash: raw.blockHash,
      transactionIndex: parseInt(raw.transactionIndex, 10),
      from: raw.from,
      to: raw.to || null,
      value: BigInt(raw.value),
      gas: BigInt(raw.gas),
      gasPrice: BigInt(raw.gasPrice),
      input: raw.input,
      contractAddress: raw.contractAddress || null,
      cumulativeGasUsed: BigInt(raw.cumulativeGasUsed),
      gasUsed: BigInt(raw.gasUsed),
      confirmations: parseInt(raw.confirmations, 10),
      isError: raw.isError === "1",
      txReceiptStatus: raw.txreceipt_status,
      methodId: raw.methodId || "",
      functionName: raw.functionName || "",
    };
  }

  /**
   * Parse raw internal transaction from Polygonscan API
   */
  private parseInternalTransaction(raw: RawInternalTransaction): InternalTransaction {
    return {
      hash: raw.hash,
      blockNumber: BigInt(raw.blockNumber),
      timestamp: parseInt(raw.timeStamp, 10),
      from: raw.from,
      to: raw.to,
      value: BigInt(raw.value),
      contractAddress: raw.contractAddress,
      input: raw.input,
      type: raw.type,
      gas: BigInt(raw.gas),
      gasUsed: BigInt(raw.gasUsed),
      traceId: raw.traceId,
      isError: raw.isError === "1",
      errCode: raw.errCode,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let sharedClient: PolygonscanClient | null = null;

/**
 * Create a new PolygonscanClient instance
 */
export function createPolygonscanClient(config?: PolygonscanConfig): PolygonscanClient {
  return new PolygonscanClient(config);
}

/**
 * Get the shared PolygonscanClient instance
 */
export function getSharedPolygonscanClient(): PolygonscanClient {
  if (!sharedClient) {
    sharedClient = new PolygonscanClient();
  }
  return sharedClient;
}

/**
 * Set the shared PolygonscanClient instance
 */
export function setSharedPolygonscanClient(client: PolygonscanClient): void {
  sharedClient = client;
}

/**
 * Reset the shared PolygonscanClient instance
 */
export function resetSharedPolygonscanClient(): void {
  sharedClient = null;
}

/**
 * Fetch wallet transaction history (convenience function)
 */
export async function getWalletHistory(
  address: string,
  options?: WalletHistoryOptions & { client?: PolygonscanClient }
): Promise<WalletHistoryResult> {
  const client = options?.client ?? getSharedPolygonscanClient();
  return client.getWalletHistory(address, options);
}

/**
 * Fetch all wallet transactions with automatic pagination (convenience function)
 */
export async function getAllWalletHistory(
  address: string,
  options?: Omit<WalletHistoryOptions, "page"> & { client?: PolygonscanClient }
): Promise<WalletTransaction[]> {
  const client = options?.client ?? getSharedPolygonscanClient();
  return client.getAllWalletHistory(address, options);
}

/**
 * Fetch internal transactions for a wallet (convenience function)
 */
export async function getInternalTransactions(
  address: string,
  options?: Omit<WalletHistoryOptions, "txType"> & { client?: PolygonscanClient }
): Promise<InternalTransaction[]> {
  const client = options?.client ?? getSharedPolygonscanClient();
  return client.getInternalTransactions(address, options);
}

/**
 * Get transaction count for a wallet (convenience function)
 */
export async function getTransactionCount(
  address: string,
  client?: PolygonscanClient
): Promise<number> {
  const actualClient = client ?? getSharedPolygonscanClient();
  return actualClient.getTransactionCount(address);
}
