/**
 * Wallet Creation Date API (API-CHAIN-004)
 *
 * Determine when a wallet address was first used on-chain by finding
 * the first transaction and parsing its block timestamp.
 *
 * Features:
 * - Find first transaction for a wallet
 * - Parse block timestamp to determine creation date
 * - In-memory caching with configurable TTL
 * - Handle empty wallets (no transactions)
 */

import { isAddress, getAddress } from "viem";

import { type PolygonscanConfig, PolygonClientError } from "./types";
import { PolygonscanClient, createPolygonscanClient } from "./history";

// ============================================================================
// Types
// ============================================================================

/**
 * Wallet creation date result
 */
export interface WalletCreationDate {
  /** Wallet address (checksummed) */
  address: string;

  /** Creation date (date of first transaction) */
  creationDate: Date | null;

  /** Unix timestamp of first transaction (seconds) */
  creationTimestamp: number | null;

  /** First transaction hash */
  firstTransactionHash: string | null;

  /** Block number of first transaction */
  firstBlockNumber: bigint | null;

  /** Whether the wallet has any transactions */
  hasTransactions: boolean;

  /** Age of wallet in days (null if no transactions) */
  ageInDays: number | null;

  /** Whether this result was retrieved from cache */
  fromCache: boolean;
}

/**
 * Options for fetching wallet creation date
 */
export interface WalletCreationDateOptions {
  /** Custom PolygonscanClient to use */
  client?: PolygonscanClient;

  /** Whether to bypass cache and fetch fresh data */
  bypassCache?: boolean;

  /** Include internal transactions in search (default: false) */
  includeInternalTransactions?: boolean;
}

/**
 * Cache entry for wallet creation date
 */
interface CacheEntry {
  data: WalletCreationDate;
  expiresAt: number;
}

/**
 * Cache configuration
 */
export interface WalletCreationDateCacheConfig {
  /** Time-to-live in milliseconds (default: 1 hour) */
  ttlMs?: number;

  /** Maximum number of entries in cache (default: 10000) */
  maxEntries?: number;

  /** Whether caching is enabled (default: true) */
  enabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 1 hour */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Default max cache entries */
const DEFAULT_MAX_CACHE_ENTRIES = 10000;

/** Milliseconds in a day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// WalletCreationDateClient Class
// ============================================================================

/**
 * Client for fetching and caching wallet creation dates
 */
export class WalletCreationDateClient {
  private readonly polygonscanClient: PolygonscanClient;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly cacheConfig: Required<WalletCreationDateCacheConfig>;

  constructor(
    config?: PolygonscanConfig,
    cacheConfig?: WalletCreationDateCacheConfig
  ) {
    this.polygonscanClient = createPolygonscanClient(config);
    this.cacheConfig = {
      ttlMs: cacheConfig?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
      maxEntries: cacheConfig?.maxEntries ?? DEFAULT_MAX_CACHE_ENTRIES,
      enabled: cacheConfig?.enabled ?? true,
    };
  }

  /**
   * Get wallet creation date
   *
   * Finds the first transaction for a wallet and returns the timestamp
   * of that transaction as the wallet's "creation date" on-chain.
   */
  async getWalletCreationDate(
    address: string,
    options: WalletCreationDateOptions = {}
  ): Promise<WalletCreationDate> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);

    // Check cache unless bypass is requested
    if (this.cacheConfig.enabled && !options.bypassCache) {
      const cached = this.getFromCache(normalizedAddress);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Use custom client if provided
    const client = options.client ?? this.polygonscanClient;

    // Fetch the first normal transaction (sorted ascending by block)
    const historyResult = await client.getWalletHistory(normalizedAddress, {
      page: 1,
      pageSize: 1,
      sort: "asc",
    });

    let firstTransaction = historyResult.transactions[0];
    let firstTimestamp = firstTransaction?.timestamp ?? null;
    let firstTxHash = firstTransaction?.hash ?? null;
    let firstBlockNumber = firstTransaction?.blockNumber ?? null;

    // Optionally check internal transactions for earlier activity
    if (options.includeInternalTransactions) {
      const internalTxs = await client.getInternalTransactions(normalizedAddress, {
        page: 1,
        pageSize: 1,
        sort: "asc",
      });

      const firstInternal = internalTxs[0];
      if (firstInternal) {
        // If internal transaction is earlier, use it
        if (!firstTimestamp || firstInternal.timestamp < firstTimestamp) {
          firstTimestamp = firstInternal.timestamp;
          firstTxHash = firstInternal.hash;
          firstBlockNumber = firstInternal.blockNumber;
        }
      }
    }

    // Build result
    const hasTransactions = firstTimestamp !== null;
    const creationDate = hasTransactions ? new Date(firstTimestamp! * 1000) : null;
    const ageInDays = hasTransactions
      ? Math.floor((Date.now() - creationDate!.getTime()) / MS_PER_DAY)
      : null;

    const result: WalletCreationDate = {
      address: normalizedAddress,
      creationDate,
      creationTimestamp: firstTimestamp,
      firstTransactionHash: firstTxHash,
      firstBlockNumber: firstBlockNumber,
      hasTransactions,
      ageInDays,
      fromCache: false,
    };

    // Store in cache
    if (this.cacheConfig.enabled) {
      this.setInCache(normalizedAddress, result);
    }

    return result;
  }

  /**
   * Get wallet age in days
   *
   * Convenience method that returns just the age in days
   */
  async getWalletAgeInDays(
    address: string,
    options?: WalletCreationDateOptions
  ): Promise<number | null> {
    const result = await this.getWalletCreationDate(address, options);
    return result.ageInDays;
  }

  /**
   * Check if wallet is fresh (under a certain age threshold)
   *
   * @param address - Wallet address to check
   * @param thresholdDays - Maximum age in days to be considered "fresh" (default: 30)
   * @param options - Additional options
   * @returns true if wallet is newer than threshold, false if older or has no transactions
   */
  async isWalletFresh(
    address: string,
    thresholdDays: number = 30,
    options?: WalletCreationDateOptions
  ): Promise<boolean> {
    const result = await this.getWalletCreationDate(address, options);

    // Wallets with no transactions are considered fresh
    if (!result.hasTransactions) {
      return true;
    }

    return result.ageInDays !== null && result.ageInDays <= thresholdDays;
  }

  /**
   * Batch fetch creation dates for multiple addresses
   *
   * @param addresses - Array of wallet addresses
   * @param options - Additional options
   * @returns Map of address to creation date result
   */
  async batchGetCreationDates(
    addresses: string[],
    options?: WalletCreationDateOptions
  ): Promise<Map<string, WalletCreationDate>> {
    const results = new Map<string, WalletCreationDate>();

    // Process in series to avoid rate limiting
    for (const address of addresses) {
      try {
        const result = await this.getWalletCreationDate(address, options);
        results.set(result.address, result);
      } catch (error) {
        // Skip invalid addresses but continue with others
        if (error instanceof PolygonClientError && error.code === "INVALID_ADDRESS") {
          continue;
        }
        throw error;
      }
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
    ttlMs: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxEntries,
      enabled: this.cacheConfig.enabled,
      ttlMs: this.cacheConfig.ttlMs,
    };
  }

  /**
   * Invalidate cache entry for a specific address
   */
  invalidateCacheEntry(address: string): boolean {
    if (!isAddress(address)) {
      return false;
    }
    return this.cache.delete(getAddress(address));
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get entry from cache if not expired
   */
  private getFromCache(address: string): WalletCreationDate | null {
    const entry = this.cache.get(address);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return entry.data;
  }

  /**
   * Store entry in cache
   */
  private setInCache(address: string, data: WalletCreationDate): void {
    // Enforce max entries by removing oldest entries
    if (this.cache.size >= this.cacheConfig.maxEntries) {
      // Evict at least 1 entry, or 10% of max entries (whichever is larger)
      const evictCount = Math.max(1, Math.floor(this.cacheConfig.maxEntries * 0.1));
      this.evictOldestEntries(evictCount);
    }

    this.cache.set(address, {
      data,
      expiresAt: Date.now() + this.cacheConfig.ttlMs,
    });
  }

  /**
   * Evict oldest entries from cache
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i]![0]);
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedClient: WalletCreationDateClient | null = null;

/**
 * Create a new WalletCreationDateClient instance
 */
export function createWalletCreationDateClient(
  config?: PolygonscanConfig,
  cacheConfig?: WalletCreationDateCacheConfig
): WalletCreationDateClient {
  return new WalletCreationDateClient(config, cacheConfig);
}

/**
 * Get the shared WalletCreationDateClient instance
 */
export function getSharedWalletCreationDateClient(): WalletCreationDateClient {
  if (!sharedClient) {
    sharedClient = new WalletCreationDateClient();
  }
  return sharedClient;
}

/**
 * Set the shared WalletCreationDateClient instance
 */
export function setSharedWalletCreationDateClient(client: WalletCreationDateClient): void {
  sharedClient = client;
}

/**
 * Reset the shared WalletCreationDateClient instance
 */
export function resetSharedWalletCreationDateClient(): void {
  sharedClient = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get wallet creation date (convenience function)
 */
export async function getWalletCreationDate(
  address: string,
  options?: WalletCreationDateOptions & { creationDateClient?: WalletCreationDateClient }
): Promise<WalletCreationDate> {
  const client = options?.creationDateClient ?? getSharedWalletCreationDateClient();
  return client.getWalletCreationDate(address, options);
}

/**
 * Get wallet age in days (convenience function)
 */
export async function getWalletAgeInDays(
  address: string,
  options?: WalletCreationDateOptions & { creationDateClient?: WalletCreationDateClient }
): Promise<number | null> {
  const client = options?.creationDateClient ?? getSharedWalletCreationDateClient();
  return client.getWalletAgeInDays(address, options);
}

/**
 * Check if wallet is fresh (convenience function)
 */
export async function isWalletFresh(
  address: string,
  thresholdDays: number = 30,
  options?: WalletCreationDateOptions & { creationDateClient?: WalletCreationDateClient }
): Promise<boolean> {
  const client = options?.creationDateClient ?? getSharedWalletCreationDateClient();
  return client.isWalletFresh(address, thresholdDays, options);
}

/**
 * Batch get creation dates for multiple addresses (convenience function)
 */
export async function batchGetCreationDates(
  addresses: string[],
  options?: WalletCreationDateOptions & { creationDateClient?: WalletCreationDateClient }
): Promise<Map<string, WalletCreationDate>> {
  const client = options?.creationDateClient ?? getSharedWalletCreationDateClient();
  return client.batchGetCreationDates(addresses, options);
}
