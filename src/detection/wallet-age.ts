/**
 * Wallet Age Calculator (DET-FRESH-001)
 *
 * Calculate wallet age from first on-chain transaction for fresh wallet detection.
 *
 * Features:
 * - Fetch first transaction timestamp from blockchain
 * - Calculate age in days with configurable precision
 * - In-memory caching with configurable TTL
 * - Handle new wallets (no transactions)
 * - Batch processing for multiple wallets
 * - Age category classification
 */

import { isAddress, getAddress } from "viem";

import {
  WalletCreationDateClient,
  createWalletCreationDateClient,
  getSharedWalletCreationDateClient,
  type WalletCreationDate,
  type WalletCreationDateOptions,
  type WalletCreationDateCacheConfig,
  type PolygonscanConfig,
  PolygonClientError,
} from "../api/chain";

// ============================================================================
// Types
// ============================================================================

/**
 * Age category classification
 */
export enum AgeCategory {
  /** Wallet has no on-chain history */
  NEW = "NEW",
  /** Wallet is 0-7 days old */
  VERY_FRESH = "VERY_FRESH",
  /** Wallet is 7-30 days old */
  FRESH = "FRESH",
  /** Wallet is 30-90 days old */
  RECENT = "RECENT",
  /** Wallet is 90-365 days old */
  ESTABLISHED = "ESTABLISHED",
  /** Wallet is older than 365 days */
  MATURE = "MATURE",
}

/**
 * Age category thresholds in days
 */
export interface AgeCategoryThresholds {
  /** Max age for VERY_FRESH (default: 7) */
  veryFresh: number;
  /** Max age for FRESH (default: 30) */
  fresh: number;
  /** Max age for RECENT (default: 90) */
  recent: number;
  /** Max age for ESTABLISHED (default: 365) */
  established: number;
}

/**
 * Default age category thresholds
 */
export const DEFAULT_AGE_THRESHOLDS: AgeCategoryThresholds = {
  veryFresh: 7,
  fresh: 30,
  recent: 90,
  established: 365,
};

/**
 * Wallet age calculation result
 */
export interface WalletAgeResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Age in days (null if no transactions) */
  ageInDays: number | null;

  /** Age in hours for more precision (null if no transactions) */
  ageInHours: number | null;

  /** Age category classification */
  category: AgeCategory;

  /** Whether the wallet is considered fresh (configurable threshold) */
  isFresh: boolean;

  /** Whether this is a brand new wallet (no transactions) */
  isNew: boolean;

  /** First transaction timestamp (seconds since epoch) */
  firstTransactionTimestamp: number | null;

  /** First transaction date */
  firstTransactionDate: Date | null;

  /** First transaction hash */
  firstTransactionHash: string | null;

  /** Whether result was retrieved from cache */
  fromCache: boolean;

  /** Timestamp when this result was calculated */
  calculatedAt: Date;
}

/**
 * Options for wallet age calculation
 */
export interface WalletAgeOptions extends WalletCreationDateOptions {
  /** Custom fresh threshold in days (default: 30) */
  freshThresholdDays?: number;

  /** Custom age category thresholds */
  categoryThresholds?: Partial<AgeCategoryThresholds>;

  /** Include internal transactions in age calculation (default: false) */
  includeInternalTransactions?: boolean;
}

/**
 * Batch result for multiple wallet age calculations
 */
export interface BatchWalletAgeResult {
  /** Successful results by address */
  results: Map<string, WalletAgeResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful calculations */
  successCount: number;

  /** Number of failed calculations */
  errorCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Wallet age summary statistics
 */
export interface WalletAgeSummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by age category */
  byCategory: Record<AgeCategory, number>;

  /** Average age in days (excluding new wallets) */
  averageAgeDays: number | null;

  /** Median age in days (excluding new wallets) */
  medianAgeDays: number | null;

  /** Minimum age in days (excluding new wallets) */
  minAgeDays: number | null;

  /** Maximum age in days (excluding new wallets) */
  maxAgeDays: number | null;

  /** Percentage of fresh wallets */
  freshPercentage: number;

  /** Percentage of new wallets */
  newPercentage: number;
}

/**
 * Configuration for WalletAgeCalculator
 */
export interface WalletAgeCalculatorConfig {
  /** Polygonscan API configuration */
  polygonscanConfig?: PolygonscanConfig;

  /** Cache configuration */
  cacheConfig?: WalletCreationDateCacheConfig;

  /** Default fresh threshold in days */
  defaultFreshThresholdDays?: number;

  /** Default age category thresholds */
  defaultCategoryThresholds?: AgeCategoryThresholds;
}

// ============================================================================
// Constants
// ============================================================================

/** Milliseconds per hour */
const MS_PER_HOUR = 60 * 60 * 1000;

/** Milliseconds per day */
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Default fresh threshold in days */
const DEFAULT_FRESH_THRESHOLD_DAYS = 30;

// ============================================================================
// WalletAgeCalculator Class
// ============================================================================

/**
 * Calculator for wallet age from on-chain data
 */
export class WalletAgeCalculator {
  private readonly creationDateClient: WalletCreationDateClient;
  private readonly defaultFreshThreshold: number;
  private readonly defaultThresholds: AgeCategoryThresholds;

  constructor(config?: WalletAgeCalculatorConfig) {
    this.creationDateClient =
      config?.polygonscanConfig || config?.cacheConfig
        ? createWalletCreationDateClient(config.polygonscanConfig, config.cacheConfig)
        : getSharedWalletCreationDateClient();

    this.defaultFreshThreshold =
      config?.defaultFreshThresholdDays ?? DEFAULT_FRESH_THRESHOLD_DAYS;

    this.defaultThresholds = config?.defaultCategoryThresholds ?? DEFAULT_AGE_THRESHOLDS;
  }

  /**
   * Calculate wallet age from first on-chain transaction
   *
   * @param address - Wallet address to calculate age for
   * @param options - Calculation options
   * @returns Wallet age result
   */
  async calculateAge(
    address: string,
    options: WalletAgeOptions = {}
  ): Promise<WalletAgeResult> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);
    const freshThreshold = options.freshThresholdDays ?? this.defaultFreshThreshold;
    const thresholds = {
      ...this.defaultThresholds,
      ...options.categoryThresholds,
    };

    // Fetch creation date from chain API
    const creationDate = await this.creationDateClient.getWalletCreationDate(
      normalizedAddress,
      {
        bypassCache: options.bypassCache,
        includeInternalTransactions: options.includeInternalTransactions,
        client: options.client,
      }
    );

    return this.buildAgeResult(creationDate, freshThreshold, thresholds);
  }

  /**
   * Calculate age for multiple wallets
   *
   * @param addresses - Array of wallet addresses
   * @param options - Calculation options
   * @returns Batch result with successes and failures
   */
  async batchCalculateAge(
    addresses: string[],
    options: WalletAgeOptions = {}
  ): Promise<BatchWalletAgeResult> {
    const startTime = Date.now();
    const results = new Map<string, WalletAgeResult>();
    const errors = new Map<string, string>();

    for (const address of addresses) {
      try {
        const result = await this.calculateAge(address, options);
        results.set(result.address, result);
      } catch (error) {
        const normalizedAddress = isAddress(address) ? getAddress(address) : address;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.set(normalizedAddress, errorMessage);
      }
    }

    return {
      results,
      errors,
      totalProcessed: addresses.length,
      successCount: results.size,
      errorCount: errors.size,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for multiple wallet ages
   *
   * @param ageResults - Array of wallet age results
   * @returns Summary statistics
   */
  getSummary(ageResults: WalletAgeResult[]): WalletAgeSummary {
    const byCategory: Record<AgeCategory, number> = {
      [AgeCategory.NEW]: 0,
      [AgeCategory.VERY_FRESH]: 0,
      [AgeCategory.FRESH]: 0,
      [AgeCategory.RECENT]: 0,
      [AgeCategory.ESTABLISHED]: 0,
      [AgeCategory.MATURE]: 0,
    };

    const ages: number[] = [];

    for (const result of ageResults) {
      byCategory[result.category]++;
      if (result.ageInDays !== null) {
        ages.push(result.ageInDays);
      }
    }

    // Sort ages for median calculation
    ages.sort((a, b) => a - b);

    const total = ageResults.length;
    const newCount = byCategory[AgeCategory.NEW];
    const freshCount =
      byCategory[AgeCategory.NEW] +
      byCategory[AgeCategory.VERY_FRESH] +
      byCategory[AgeCategory.FRESH];

    return {
      total,
      byCategory,
      averageAgeDays:
        ages.length > 0
          ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 100) / 100
          : null,
      medianAgeDays:
        ages.length > 0
          ? ages.length % 2 === 0
            ? (ages[ages.length / 2 - 1]! + ages[ages.length / 2]!) / 2
            : ages[Math.floor(ages.length / 2)]!
          : null,
      minAgeDays: ages.length > 0 ? ages[0]! : null,
      maxAgeDays: ages.length > 0 ? ages[ages.length - 1]! : null,
      freshPercentage: total > 0 ? Math.round((freshCount / total) * 10000) / 100 : 0,
      newPercentage: total > 0 ? Math.round((newCount / total) * 10000) / 100 : 0,
    };
  }

  /**
   * Classify age into category
   *
   * @param ageInDays - Age in days (null for new wallets)
   * @param thresholds - Category thresholds
   * @returns Age category
   */
  classifyAge(
    ageInDays: number | null,
    thresholds: AgeCategoryThresholds = this.defaultThresholds
  ): AgeCategory {
    if (ageInDays === null) {
      return AgeCategory.NEW;
    }
    if (ageInDays <= thresholds.veryFresh) {
      return AgeCategory.VERY_FRESH;
    }
    if (ageInDays <= thresholds.fresh) {
      return AgeCategory.FRESH;
    }
    if (ageInDays <= thresholds.recent) {
      return AgeCategory.RECENT;
    }
    if (ageInDays <= thresholds.established) {
      return AgeCategory.ESTABLISHED;
    }
    return AgeCategory.MATURE;
  }

  /**
   * Check if wallet age indicates freshness
   *
   * @param ageInDays - Age in days (null for new wallets)
   * @param thresholdDays - Fresh threshold in days
   * @returns true if wallet is fresh
   */
  isFresh(
    ageInDays: number | null,
    thresholdDays: number = this.defaultFreshThreshold
  ): boolean {
    // New wallets (no transactions) are considered fresh
    if (ageInDays === null) {
      return true;
    }
    return ageInDays <= thresholdDays;
  }

  /**
   * Calculate age in days from timestamp
   *
   * @param timestamp - Unix timestamp in seconds
   * @returns Age in days
   */
  calculateAgeFromTimestamp(timestamp: number): number {
    const ageMs = Date.now() - timestamp * 1000;
    return Math.floor(ageMs / MS_PER_DAY);
  }

  /**
   * Calculate age in hours from timestamp
   *
   * @param timestamp - Unix timestamp in seconds
   * @returns Age in hours
   */
  calculateAgeInHoursFromTimestamp(timestamp: number): number {
    const ageMs = Date.now() - timestamp * 1000;
    return Math.floor(ageMs / MS_PER_HOUR);
  }

  /**
   * Clear the underlying cache
   */
  clearCache(): void {
    this.creationDateClient.clearCache();
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
    return this.creationDateClient.getCacheStats();
  }

  /**
   * Invalidate cache entry for a specific address
   */
  invalidateCacheEntry(address: string): boolean {
    return this.creationDateClient.invalidateCacheEntry(address);
  }

  /**
   * Get default fresh threshold
   */
  getDefaultFreshThreshold(): number {
    return this.defaultFreshThreshold;
  }

  /**
   * Get default category thresholds
   */
  getDefaultThresholds(): AgeCategoryThresholds {
    return { ...this.defaultThresholds };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build age result from creation date
   */
  private buildAgeResult(
    creationDate: WalletCreationDate,
    freshThreshold: number,
    thresholds: AgeCategoryThresholds
  ): WalletAgeResult {
    const ageInDays = creationDate.ageInDays;
    const ageInHours =
      creationDate.creationTimestamp !== null
        ? this.calculateAgeInHoursFromTimestamp(creationDate.creationTimestamp)
        : null;

    return {
      address: creationDate.address,
      ageInDays,
      ageInHours,
      category: this.classifyAge(ageInDays, thresholds),
      isFresh: this.isFresh(ageInDays, freshThreshold),
      isNew: !creationDate.hasTransactions,
      firstTransactionTimestamp: creationDate.creationTimestamp,
      firstTransactionDate: creationDate.creationDate,
      firstTransactionHash: creationDate.firstTransactionHash,
      fromCache: creationDate.fromCache,
      calculatedAt: new Date(),
    };
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedCalculator: WalletAgeCalculator | null = null;

/**
 * Create a new WalletAgeCalculator instance
 */
export function createWalletAgeCalculator(
  config?: WalletAgeCalculatorConfig
): WalletAgeCalculator {
  return new WalletAgeCalculator(config);
}

/**
 * Get the shared WalletAgeCalculator instance
 */
export function getSharedWalletAgeCalculator(): WalletAgeCalculator {
  if (!sharedCalculator) {
    sharedCalculator = new WalletAgeCalculator();
  }
  return sharedCalculator;
}

/**
 * Set the shared WalletAgeCalculator instance
 */
export function setSharedWalletAgeCalculator(calculator: WalletAgeCalculator): void {
  sharedCalculator = calculator;
}

/**
 * Reset the shared WalletAgeCalculator instance
 */
export function resetSharedWalletAgeCalculator(): void {
  sharedCalculator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate wallet age (convenience function)
 */
export async function calculateWalletAge(
  address: string,
  options?: WalletAgeOptions & { calculator?: WalletAgeCalculator }
): Promise<WalletAgeResult> {
  const calculator = options?.calculator ?? getSharedWalletAgeCalculator();
  return calculator.calculateAge(address, options);
}

/**
 * Calculate age for multiple wallets (convenience function)
 */
export async function batchCalculateWalletAge(
  addresses: string[],
  options?: WalletAgeOptions & { calculator?: WalletAgeCalculator }
): Promise<BatchWalletAgeResult> {
  const calculator = options?.calculator ?? getSharedWalletAgeCalculator();
  return calculator.batchCalculateAge(addresses, options);
}

/**
 * Check if wallet is fresh (convenience function)
 */
export async function checkWalletFreshness(
  address: string,
  thresholdDays: number = DEFAULT_FRESH_THRESHOLD_DAYS,
  options?: WalletAgeOptions & { calculator?: WalletAgeCalculator }
): Promise<boolean> {
  const calculator = options?.calculator ?? getSharedWalletAgeCalculator();
  const result = await calculator.calculateAge(address, {
    ...options,
    freshThresholdDays: thresholdDays,
  });
  return result.isFresh;
}

/**
 * Get wallet age category (convenience function)
 */
export async function getWalletAgeCategory(
  address: string,
  options?: WalletAgeOptions & { calculator?: WalletAgeCalculator }
): Promise<AgeCategory> {
  const calculator = options?.calculator ?? getSharedWalletAgeCalculator();
  const result = await calculator.calculateAge(address, options);
  return result.category;
}

/**
 * Get wallet age summary for multiple addresses (convenience function)
 */
export async function getWalletAgeSummary(
  addresses: string[],
  options?: WalletAgeOptions & { calculator?: WalletAgeCalculator }
): Promise<WalletAgeSummary> {
  const calculator = options?.calculator ?? getSharedWalletAgeCalculator();
  const batchResult = await calculator.batchCalculateAge(addresses, options);
  return calculator.getSummary(Array.from(batchResult.results.values()));
}
