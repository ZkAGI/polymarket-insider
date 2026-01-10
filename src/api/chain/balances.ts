/**
 * Wallet Token Balances API (API-CHAIN-003)
 *
 * Retrieve token balances for a wallet address using Polygonscan API and RPC.
 * Features:
 * - Fetch ERC20 token balances
 * - Fetch native MATIC balance
 * - Fetch NFT (ERC721) holdings
 * - Fetch ERC1155 token balances
 * - Support for specific token balance queries
 */

import { isAddress, getAddress, formatUnits, formatEther } from "viem";

import {
  type TokenBalance,
  type NativeBalance,
  type NFTToken,
  type ERC1155Balance,
  type WalletBalanceSummary,
  type TokenBalanceOptions,
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

interface RawERC20Transfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

interface RawNFTTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

interface RawERC1155Transfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenValue: string;
  tokenName: string;
  tokenSymbol: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

// ============================================================================
// Token Balance Client Class
// ============================================================================

/**
 * Client for fetching wallet token balances from Polygonscan
 */
export class TokenBalanceClient {
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
   * Get native MATIC balance for a wallet
   */
  async getNativeBalance(address: string): Promise<NativeBalance> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);

    // Build query parameters
    const params = new URLSearchParams({
      module: "account",
      action: "balance",
      address: normalizedAddress,
      tag: "latest",
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const response = await this.executeWithRetry<string>(params);

    // Parse balance
    const balanceWei = BigInt(response);

    return {
      balance: balanceWei,
      formattedBalance: formatEther(balanceWei),
    };
  }

  /**
   * Get ERC20 token balance for a specific token
   */
  async getTokenBalance(address: string, contractAddress: string): Promise<TokenBalance | null> {
    // Validate addresses
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid wallet address: ${address}`, "INVALID_ADDRESS");
    }
    if (!contractAddress || !isAddress(contractAddress)) {
      throw new PolygonClientError(
        `Invalid contract address: ${contractAddress}`,
        "INVALID_ADDRESS"
      );
    }

    const normalizedAddress = getAddress(address);
    const normalizedContract = getAddress(contractAddress);

    // Build query parameters for token balance
    const params = new URLSearchParams({
      module: "account",
      action: "tokenbalance",
      contractaddress: normalizedContract,
      address: normalizedAddress,
      tag: "latest",
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const balanceStr = await this.executeWithRetry<string>(params);
    const balance = BigInt(balanceStr);

    // If balance is 0, return null unless explicitly requested
    if (balance === 0n) {
      return null;
    }

    // Get token info from a transfer (we need token metadata)
    const tokenInfo = await this.getTokenInfo(normalizedAddress, normalizedContract);

    const decimals = tokenInfo?.decimals ?? 18;

    return {
      contractAddress: normalizedContract,
      tokenSymbol: tokenInfo?.symbol ?? "UNKNOWN",
      tokenName: tokenInfo?.name ?? "Unknown Token",
      tokenDecimal: decimals,
      balance,
      formattedBalance: formatUnits(balance, decimals),
    };
  }

  /**
   * Get all ERC20 token balances for a wallet
   * Uses token transfer history to discover tokens held by the wallet
   */
  async getTokenBalances(
    address: string,
    options: TokenBalanceOptions = {}
  ): Promise<TokenBalance[]> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sort = options.sort ?? "desc";
    const includeZeroBalances = options.includeZeroBalances ?? false;

    // Fetch ERC20 token transfers to discover tokens
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      address: normalizedAddress,
      page: String(page),
      offset: String(pageSize),
      sort,
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const transfers = await this.executeWithRetry<RawERC20Transfer[]>(params);

    // Extract unique token contracts from transfers
    const tokenMap = new Map<
      string,
      { symbol: string; name: string; decimal: number }
    >();

    for (const transfer of transfers) {
      const contractAddr = getAddress(transfer.contractAddress);
      if (!tokenMap.has(contractAddr)) {
        tokenMap.set(contractAddr, {
          symbol: transfer.tokenSymbol,
          name: transfer.tokenName,
          decimal: parseInt(transfer.tokenDecimal, 10),
        });
      }
    }

    // Fetch current balance for each token
    const balances: TokenBalance[] = [];

    for (const [contractAddr, tokenInfo] of tokenMap) {
      try {
        const balanceParams = new URLSearchParams({
          module: "account",
          action: "tokenbalance",
          contractaddress: contractAddr,
          address: normalizedAddress,
          tag: "latest",
        });

        if (this.config.apiKey) {
          balanceParams.set("apikey", this.config.apiKey);
        }

        const balanceStr = await this.executeWithRetry<string>(balanceParams);
        const balance = BigInt(balanceStr);

        // Skip zero balances unless requested
        if (balance === 0n && !includeZeroBalances) {
          continue;
        }

        balances.push({
          contractAddress: contractAddr,
          tokenSymbol: tokenInfo.symbol,
          tokenName: tokenInfo.name,
          tokenDecimal: tokenInfo.decimal,
          balance,
          formattedBalance: formatUnits(balance, tokenInfo.decimal),
        });
      } catch (error) {
        // Skip tokens that fail to fetch (contract might be broken)
        continue;
      }
    }

    return balances;
  }

  /**
   * Get NFT (ERC721) tokens held by a wallet
   */
  async getNFTTokens(
    address: string,
    options: Omit<TokenBalanceOptions, "includeZeroBalances"> = {}
  ): Promise<NFTToken[]> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sort = options.sort ?? "desc";

    // Fetch ERC721 token transfers
    const params = new URLSearchParams({
      module: "account",
      action: "tokennfttx",
      address: normalizedAddress,
      page: String(page),
      offset: String(pageSize),
      sort,
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const transfers = await this.executeWithRetry<RawNFTTransfer[]>(params);

    // Track NFT ownership: key = contractAddress:tokenId
    // We need to compute final ownership based on transfers
    const nftOwnership = new Map<
      string,
      { owns: boolean; contractAddress: string; tokenId: string; tokenName: string; tokenSymbol: string }
    >();

    // Process transfers in chronological order (ascending)
    const sortedTransfers = [...transfers].sort(
      (a, b) => parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10)
    );

    for (const transfer of sortedTransfers) {
      const contractAddr = getAddress(transfer.contractAddress);
      const key = `${contractAddr}:${transfer.tokenID}`;
      const toAddr = transfer.to.toLowerCase();
      const normalizedLower = normalizedAddress.toLowerCase();

      if (toAddr === normalizedLower) {
        // Received NFT
        nftOwnership.set(key, {
          owns: true,
          contractAddress: contractAddr,
          tokenId: transfer.tokenID,
          tokenName: transfer.tokenName,
          tokenSymbol: transfer.tokenSymbol,
        });
      } else if (transfer.from.toLowerCase() === normalizedLower) {
        // Sent NFT - mark as not owned
        const existing = nftOwnership.get(key);
        if (existing) {
          existing.owns = false;
        }
      }
    }

    // Return only NFTs still owned
    const ownedNFTs: NFTToken[] = [];
    for (const [, data] of nftOwnership) {
      if (data.owns) {
        ownedNFTs.push({
          contractAddress: data.contractAddress,
          tokenId: data.tokenId,
          tokenName: data.tokenName,
          tokenSymbol: data.tokenSymbol,
        });
      }
    }

    return ownedNFTs;
  }

  /**
   * Get ERC1155 token balances for a wallet
   */
  async getERC1155Balances(
    address: string,
    options: Omit<TokenBalanceOptions, "includeZeroBalances"> = {}
  ): Promise<ERC1155Balance[]> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sort = options.sort ?? "desc";

    // Fetch ERC1155 token transfers
    const params = new URLSearchParams({
      module: "account",
      action: "token1155tx",
      address: normalizedAddress,
      page: String(page),
      offset: String(pageSize),
      sort,
    });

    // Add API key if available
    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    // Execute request
    const transfers = await this.executeWithRetry<RawERC1155Transfer[]>(params);

    // Track ERC1155 balances: key = contractAddress:tokenId
    const balanceMap = new Map<
      string,
      {
        balance: bigint;
        contractAddress: string;
        tokenId: string;
        tokenName: string;
        tokenSymbol: string;
      }
    >();

    // Process transfers in chronological order
    const sortedTransfers = [...transfers].sort(
      (a, b) => parseInt(a.timeStamp, 10) - parseInt(b.timeStamp, 10)
    );

    for (const transfer of sortedTransfers) {
      const contractAddr = getAddress(transfer.contractAddress);
      const key = `${contractAddr}:${transfer.tokenID}`;
      const toAddr = transfer.to.toLowerCase();
      const fromAddr = transfer.from.toLowerCase();
      const normalizedLower = normalizedAddress.toLowerCase();
      const value = BigInt(transfer.tokenValue);

      let existing = balanceMap.get(key);
      if (!existing) {
        existing = {
          balance: 0n,
          contractAddress: contractAddr,
          tokenId: transfer.tokenID,
          tokenName: transfer.tokenName,
          tokenSymbol: transfer.tokenSymbol,
        };
        balanceMap.set(key, existing);
      }

      if (toAddr === normalizedLower) {
        // Received tokens
        existing.balance += value;
      } else if (fromAddr === normalizedLower) {
        // Sent tokens
        existing.balance -= value;
        if (existing.balance < 0n) {
          existing.balance = 0n;
        }
      }
    }

    // Return only tokens with positive balance
    const result: ERC1155Balance[] = [];
    for (const [, data] of balanceMap) {
      if (data.balance > 0n) {
        result.push({
          contractAddress: data.contractAddress,
          tokenId: data.tokenId,
          tokenName: data.tokenName,
          tokenSymbol: data.tokenSymbol,
          tokenValue: data.balance,
        });
      }
    }

    return result;
  }

  /**
   * Get complete wallet balance summary
   */
  async getWalletBalanceSummary(address: string): Promise<WalletBalanceSummary> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);

    // Fetch native balance and token balances in parallel
    const [nativeBalance, tokens] = await Promise.all([
      this.getNativeBalance(normalizedAddress),
      this.getTokenBalances(normalizedAddress),
    ]);

    return {
      address: normalizedAddress,
      nativeBalance,
      tokens,
      tokenCount: tokens.length,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get token info from transfer history
   */
  private async getTokenInfo(
    address: string,
    contractAddress: string
  ): Promise<{ symbol: string; name: string; decimals: number } | null> {
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      contractaddress: contractAddress,
      address,
      page: "1",
      offset: "1",
      sort: "desc",
    });

    if (this.config.apiKey) {
      params.set("apikey", this.config.apiKey);
    }

    try {
      const transfers = await this.executeWithRetry<RawERC20Transfer[]>(params);
      if (transfers.length > 0) {
        const transfer = transfers[0]!;
        return {
          symbol: transfer.tokenSymbol,
          name: transfer.tokenName,
          decimals: parseInt(transfer.tokenDecimal, 10),
        };
      }
    } catch {
      // Ignore errors - token info is best-effort
    }

    return null;
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
          // "No transactions found" is not an error, return empty array or "0"
          if (
            data.message === "No transactions found" ||
            data.message === "No records found" ||
            (typeof data.result === "string" && data.result.includes("No transactions found"))
          ) {
            // Return appropriate empty value based on expected type
            if (Array.isArray(params.get("action")?.match(/tx$/))) {
              return [] as unknown as T;
            }
            return "0" as unknown as T;
          }

          // Check for rate limiting
          if (
            typeof data.result === "string" &&
            (data.result.includes("rate limit") || data.result.includes("Max rate limit"))
          ) {
            throw new PolygonscanError("Rate limit exceeded", "RATE_LIMIT", { response: data });
          }

          throw new PolygonscanError(
            typeof data.result === "string" ? data.result : data.message,
            "API_ERROR",
            { response: data }
          );
        }

        // Handle successful response
        return data.result as T;
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
            this.config.retryDelay * Math.pow(2, this.config.maxRetries - retriesRemaining - 1);
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
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

let sharedClient: TokenBalanceClient | null = null;

/**
 * Create a new TokenBalanceClient instance
 */
export function createTokenBalanceClient(config?: PolygonscanConfig): TokenBalanceClient {
  return new TokenBalanceClient(config);
}

/**
 * Get the shared TokenBalanceClient instance
 */
export function getSharedTokenBalanceClient(): TokenBalanceClient {
  if (!sharedClient) {
    sharedClient = new TokenBalanceClient();
  }
  return sharedClient;
}

/**
 * Set the shared TokenBalanceClient instance
 */
export function setSharedTokenBalanceClient(client: TokenBalanceClient): void {
  sharedClient = client;
}

/**
 * Reset the shared TokenBalanceClient instance
 */
export function resetSharedTokenBalanceClient(): void {
  sharedClient = null;
}

/**
 * Get native MATIC balance for a wallet (convenience function)
 */
export async function getNativeBalance(
  address: string,
  client?: TokenBalanceClient
): Promise<NativeBalance> {
  const actualClient = client ?? getSharedTokenBalanceClient();
  return actualClient.getNativeBalance(address);
}

/**
 * Get ERC20 token balance for a specific token (convenience function)
 */
export async function getTokenBalance(
  address: string,
  contractAddress: string,
  client?: TokenBalanceClient
): Promise<TokenBalance | null> {
  const actualClient = client ?? getSharedTokenBalanceClient();
  return actualClient.getTokenBalance(address, contractAddress);
}

/**
 * Get all ERC20 token balances for a wallet (convenience function)
 */
export async function getTokenBalances(
  address: string,
  options?: TokenBalanceOptions & { client?: TokenBalanceClient }
): Promise<TokenBalance[]> {
  const client = options?.client ?? getSharedTokenBalanceClient();
  return client.getTokenBalances(address, options);
}

/**
 * Get NFT tokens held by a wallet (convenience function)
 */
export async function getNFTTokens(
  address: string,
  options?: Omit<TokenBalanceOptions, "includeZeroBalances"> & { client?: TokenBalanceClient }
): Promise<NFTToken[]> {
  const client = options?.client ?? getSharedTokenBalanceClient();
  return client.getNFTTokens(address, options);
}

/**
 * Get ERC1155 token balances for a wallet (convenience function)
 */
export async function getERC1155Balances(
  address: string,
  options?: Omit<TokenBalanceOptions, "includeZeroBalances"> & { client?: TokenBalanceClient }
): Promise<ERC1155Balance[]> {
  const client = options?.client ?? getSharedTokenBalanceClient();
  return client.getERC1155Balances(address, options);
}

/**
 * Get complete wallet balance summary (convenience function)
 */
export async function getWalletBalanceSummary(
  address: string,
  client?: TokenBalanceClient
): Promise<WalletBalanceSummary> {
  const actualClient = client ?? getSharedTokenBalanceClient();
  return actualClient.getWalletBalanceSummary(address);
}
