/**
 * Zero Trading History Detector (DET-FRESH-003)
 *
 * Identifies wallets with no prior Polymarket trading history.
 * Distinguishes between wallets that are new to blockchain entirely
 * vs wallets that are established on-chain but new to Polymarket.
 *
 * Features:
 * - Check Polymarket trade count for a wallet
 * - Distinguish from general blockchain age
 * - Flag first-time traders
 * - Track status changes over time
 * - Batch processing for multiple wallets
 */

import { isAddress, getAddress } from "viem";
import {
  getAllTradesByWallet,
  getWalletActivitySummary,
  type WalletActivitySummary,
} from "../api/clob/trades";
import { type ClobClient } from "../api/clob/client";
import {
  calculateWalletAge,
  type WalletAgeResult,
  AgeCategory,
} from "./wallet-age";
import {
  FreshWalletAlertSeverity,
  evaluateWalletFreshness,
  type FreshWalletConfigManager,
  getSharedFreshWalletConfigManager,
} from "./fresh-wallet-config";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Trading history status for a wallet
 */
export enum TradingHistoryStatus {
  /** Wallet has never traded on Polymarket */
  NEVER_TRADED = "NEVER_TRADED",
  /** Wallet is currently making their first trade */
  FIRST_TRADE = "FIRST_TRADE",
  /** Wallet has very limited trading history (1-3 trades) */
  MINIMAL_HISTORY = "MINIMAL_HISTORY",
  /** Wallet has established trading history */
  HAS_HISTORY = "HAS_HISTORY",
}

/**
 * Wallet blockchain vs Polymarket history classification
 */
export enum WalletHistoryType {
  /** New to blockchain AND new to Polymarket */
  NEW_EVERYWHERE = "NEW_EVERYWHERE",
  /** Established on blockchain but new to Polymarket */
  BLOCKCHAIN_VETERAN_PM_NEW = "BLOCKCHAIN_VETERAN_PM_NEW",
  /** New to blockchain but has Polymarket trades (unlikely edge case) */
  BLOCKCHAIN_NEW_PM_ACTIVE = "BLOCKCHAIN_NEW_PM_ACTIVE",
  /** Established on both blockchain and Polymarket */
  ESTABLISHED = "ESTABLISHED",
}

/**
 * Result of checking a wallet's trading history
 */
export interface ZeroHistoryCheckResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Whether the wallet has zero Polymarket trading history */
  hasZeroHistory: boolean;

  /** Current trading history status */
  status: TradingHistoryStatus;

  /** Classification of blockchain vs Polymarket history */
  historyType: WalletHistoryType;

  /** Total number of Polymarket trades */
  polymarketTradeCount: number;

  /** Total volume traded on Polymarket (in raw token units) */
  polymarketVolume: number;

  /** Number of unique markets traded */
  uniqueMarketsTraded: number;

  /** Timestamp of first Polymarket trade (if any) */
  firstTradeAt: string | null;

  /** Timestamp of last Polymarket trade (if any) */
  lastTradeAt: string | null;

  /** Days since last trade (null if never traded) */
  daysSinceLastTrade: number | null;

  /** Wallet age result from blockchain */
  walletAge: WalletAgeResult | null;

  /** Whether this is considered a suspicious first-timer */
  isSuspiciousFirstTimer: boolean;

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Whether the result was retrieved from cache */
  fromCache: boolean;

  /** Timestamp when this check was performed */
  checkedAt: Date;
}

/**
 * Options for zero history check
 */
export interface ZeroHistoryCheckOptions {
  /** Maximum number of trades to fetch for analysis (default: 100) */
  maxTradesToFetch?: number;

  /** Include wallet age calculation (default: true) */
  includeWalletAge?: boolean;

  /** Market category for threshold evaluation */
  marketCategory?: MarketCategory | null;

  /** Hours until market close for time-based modifiers */
  hoursUntilClose?: number | null;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;
}

/**
 * Batch result for multiple wallet checks
 */
export interface BatchZeroHistoryResult {
  /** Successful check results by address */
  results: Map<string, ZeroHistoryCheckResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful checks */
  successCount: number;

  /** Number of failed checks */
  errorCount: number;

  /** Count of wallets with zero history */
  zeroHistoryCount: number;

  /** Count of first-time traders detected */
  firstTimeTraderCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for zero history analysis
 */
export interface ZeroHistorySummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by trading history status */
  byStatus: Record<TradingHistoryStatus, number>;

  /** Count by wallet history type */
  byHistoryType: Record<WalletHistoryType, number>;

  /** Count by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Percentage with zero Polymarket history */
  zeroHistoryPercentage: number;

  /** Percentage of suspicious first-timers */
  suspiciousFirstTimerPercentage: number;

  /** Average trade count for those with history */
  averageTradeCount: number | null;

  /** Median trade count for those with history */
  medianTradeCount: number | null;
}

/**
 * Status change event for tracking
 */
export interface TradingStatusChange {
  /** Wallet address */
  address: string;

  /** Previous status */
  previousStatus: TradingHistoryStatus;

  /** New status */
  newStatus: TradingHistoryStatus;

  /** Previous trade count */
  previousTradeCount: number;

  /** New trade count */
  newTradeCount: number;

  /** Timestamp of status change detection */
  changedAt: Date;
}

/**
 * Configuration for ZeroHistoryDetector
 */
export interface ZeroHistoryDetectorConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Default max trades to fetch (default: 100) */
  defaultMaxTrades?: number;

  /** Threshold for minimal history (default: 3 trades) */
  minimalHistoryThreshold?: number;

  /** Days of inactivity to consider dormant (default: 30) */
  dormancyDays?: number;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/** Default max trades to fetch */
const DEFAULT_MAX_TRADES = 100;

/** Threshold for minimal history */
const DEFAULT_MINIMAL_HISTORY_THRESHOLD = 3;

/** Days of inactivity to consider dormant */
const DEFAULT_DORMANCY_DAYS = 30;

/** Milliseconds per day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// ZeroHistoryDetector Class
// ============================================================================

/**
 * Detector for wallets with zero Polymarket trading history
 */
export class ZeroHistoryDetector {
  private readonly cache: Map<string, { result: ZeroHistoryCheckResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly defaultMaxTrades: number;
  private readonly minimalHistoryThreshold: number;
  private readonly dormancyDays: number;
  private readonly clobClient?: ClobClient;
  private readonly configManager: FreshWalletConfigManager;
  private readonly statusHistory: Map<string, TradingHistoryStatus>;

  constructor(config?: ZeroHistoryDetectorConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.defaultMaxTrades = config?.defaultMaxTrades ?? DEFAULT_MAX_TRADES;
    this.minimalHistoryThreshold = config?.minimalHistoryThreshold ?? DEFAULT_MINIMAL_HISTORY_THRESHOLD;
    this.dormancyDays = config?.dormancyDays ?? DEFAULT_DORMANCY_DAYS;
    this.clobClient = config?.clobClient;
    this.configManager = config?.configManager ?? getSharedFreshWalletConfigManager();
    this.statusHistory = new Map();
  }

  /**
   * Check if a wallet has zero Polymarket trading history
   */
  async checkWallet(
    address: string,
    options: ZeroHistoryCheckOptions = {}
  ): Promise<ZeroHistoryCheckResult> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const normalizedAddress = getAddress(address);

    // Check cache first
    if (!options.bypassCache) {
      const cached = this.getCachedResult(normalizedAddress);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    const {
      maxTradesToFetch = this.defaultMaxTrades,
      includeWalletAge = true,
      marketCategory = null,
      hoursUntilClose = null,
      clobClient = this.clobClient,
      configManager = this.configManager,
    } = options;

    // Fetch wallet age if requested
    let walletAge: WalletAgeResult | null = null;
    if (includeWalletAge) {
      try {
        walletAge = await calculateWalletAge(normalizedAddress);
      } catch {
        // Wallet age fetch failed, continue without it
        walletAge = null;
      }
    }

    // Fetch Polymarket trades
    const trades = await getAllTradesByWallet(normalizedAddress, {
      maxTrades: maxTradesToFetch,
      client: clobClient,
    });

    const tradeCount = trades?.length ?? 0;

    // Calculate activity summary if we have trades
    let activitySummary: WalletActivitySummary | null = null;
    if (trades && trades.length > 0) {
      activitySummary = getWalletActivitySummary(trades, normalizedAddress);
    }

    // Determine trading history status
    const status = this.determineStatus(tradeCount);

    // Determine history type (blockchain vs Polymarket)
    const historyType = this.determineHistoryType(walletAge, tradeCount);

    // Calculate days since last trade
    const daysSinceLastTrade = activitySummary?.lastTradeAt
      ? Math.floor((Date.now() - new Date(activitySummary.lastTradeAt).getTime()) / MS_PER_DAY)
      : null;

    // Evaluate freshness using config manager
    const freshnessEval = evaluateWalletFreshness({
      walletAgeDays: walletAge?.ageInDays ?? null,
      transactionCount: walletAge?.isNew ? 0 : 1, // Simplified; we don't have full tx count here
      polymarketTradeCount: tradeCount,
      category: marketCategory,
      hoursUntilClose,
    }, configManager);

    // Determine if this is a suspicious first-timer
    const isSuspiciousFirstTimer = this.isSuspiciousFirstTimer(
      status,
      historyType,
      freshnessEval.severity,
      daysSinceLastTrade
    );

    const result: ZeroHistoryCheckResult = {
      address: normalizedAddress,
      hasZeroHistory: tradeCount === 0,
      status,
      historyType,
      polymarketTradeCount: tradeCount,
      polymarketVolume: activitySummary?.totalVolume ?? 0,
      uniqueMarketsTraded: activitySummary?.uniqueTokens.size ?? 0,
      firstTradeAt: activitySummary?.firstTradeAt ?? null,
      lastTradeAt: activitySummary?.lastTradeAt ?? null,
      daysSinceLastTrade,
      walletAge,
      isSuspiciousFirstTimer,
      severity: freshnessEval.severity,
      fromCache: false,
      checkedAt: new Date(),
    };

    // Update status history and check for changes
    this.trackStatusChange(normalizedAddress, status);

    // Cache the result
    this.setCachedResult(normalizedAddress, result);

    return result;
  }

  /**
   * Check multiple wallets for zero history
   */
  async checkWallets(
    addresses: string[],
    options: ZeroHistoryCheckOptions = {}
  ): Promise<BatchZeroHistoryResult> {
    const startTime = Date.now();
    const results = new Map<string, ZeroHistoryCheckResult>();
    const errors = new Map<string, string>();
    let zeroHistoryCount = 0;
    let firstTimeTraderCount = 0;

    for (const address of addresses) {
      try {
        const result = await this.checkWallet(address, options);
        results.set(result.address, result);

        if (result.hasZeroHistory) {
          zeroHistoryCount++;
        }
        if (result.status === TradingHistoryStatus.FIRST_TRADE) {
          firstTimeTraderCount++;
        }
      } catch (error) {
        const normalizedAddress = isAddress(address) ? getAddress(address) : address;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.set(normalizedAddress, errorMessage);
      }
    }

    return {
      results,
      errors,
      totalProcessed: addresses.length,
      successCount: results.size,
      errorCount: errors.size,
      zeroHistoryCount,
      firstTimeTraderCount,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for a batch of check results
   */
  getSummary(results: ZeroHistoryCheckResult[]): ZeroHistorySummary {
    const byStatus: Record<TradingHistoryStatus, number> = {
      [TradingHistoryStatus.NEVER_TRADED]: 0,
      [TradingHistoryStatus.FIRST_TRADE]: 0,
      [TradingHistoryStatus.MINIMAL_HISTORY]: 0,
      [TradingHistoryStatus.HAS_HISTORY]: 0,
    };

    const byHistoryType: Record<WalletHistoryType, number> = {
      [WalletHistoryType.NEW_EVERYWHERE]: 0,
      [WalletHistoryType.BLOCKCHAIN_VETERAN_PM_NEW]: 0,
      [WalletHistoryType.BLOCKCHAIN_NEW_PM_ACTIVE]: 0,
      [WalletHistoryType.ESTABLISHED]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const tradeCounts: number[] = [];
    let zeroHistoryCount = 0;
    let suspiciousFirstTimerCount = 0;

    for (const result of results) {
      byStatus[result.status]++;
      byHistoryType[result.historyType]++;
      bySeverity[result.severity]++;

      if (result.hasZeroHistory) {
        zeroHistoryCount++;
      }
      if (result.isSuspiciousFirstTimer) {
        suspiciousFirstTimerCount++;
      }
      if (result.polymarketTradeCount > 0) {
        tradeCounts.push(result.polymarketTradeCount);
      }
    }

    // Calculate trade count statistics for those with history
    tradeCounts.sort((a, b) => a - b);
    const averageTradeCount = tradeCounts.length > 0
      ? Math.round((tradeCounts.reduce((a, b) => a + b, 0) / tradeCounts.length) * 100) / 100
      : null;
    const medianTradeCount = tradeCounts.length > 0
      ? tradeCounts.length % 2 === 0
        ? (tradeCounts[tradeCounts.length / 2 - 1]! + tradeCounts[tradeCounts.length / 2]!) / 2
        : tradeCounts[Math.floor(tradeCounts.length / 2)]!
      : null;

    const total = results.length;

    return {
      total,
      byStatus,
      byHistoryType,
      bySeverity,
      zeroHistoryPercentage: total > 0 ? Math.round((zeroHistoryCount / total) * 10000) / 100 : 0,
      suspiciousFirstTimerPercentage: total > 0
        ? Math.round((suspiciousFirstTimerCount / total) * 10000) / 100
        : 0,
      averageTradeCount,
      medianTradeCount,
    };
  }

  /**
   * Check if a wallet has never traded on Polymarket
   */
  async hasNeverTraded(
    address: string,
    options: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> = {}
  ): Promise<boolean> {
    const result = await this.checkWallet(address, {
      ...options,
      includeWalletAge: false,
      maxTradesToFetch: 1, // We only need to know if any trades exist
    });
    return result.hasZeroHistory;
  }

  /**
   * Check if a wallet is making their first trade
   */
  async isFirstTrade(
    address: string,
    options: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> = {}
  ): Promise<boolean> {
    const result = await this.checkWallet(address, {
      ...options,
      includeWalletAge: false,
      maxTradesToFetch: 2,
    });
    return result.status === TradingHistoryStatus.FIRST_TRADE;
  }

  /**
   * Get Polymarket trade count for a wallet
   */
  async getTradeCount(
    address: string,
    options: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> = {}
  ): Promise<number> {
    const result = await this.checkWallet(address, {
      ...options,
      includeWalletAge: false,
    });
    return result.polymarketTradeCount;
  }

  /**
   * Get status change history for a wallet
   */
  getStatusHistory(address: string): TradingHistoryStatus | undefined {
    if (!isAddress(address)) {
      return undefined;
    }
    const normalizedAddress = getAddress(address);
    return this.statusHistory.get(normalizedAddress);
  }

  /**
   * Check if a wallet's status has changed since last check
   */
  hasStatusChanged(address: string, currentStatus: TradingHistoryStatus): boolean {
    if (!isAddress(address)) {
      return false;
    }
    const normalizedAddress = getAddress(address);
    const previousStatus = this.statusHistory.get(normalizedAddress);
    return previousStatus !== undefined && previousStatus !== currentStatus;
  }

  /**
   * Get detected status changes
   */
  detectStatusChange(
    address: string,
    currentResult: ZeroHistoryCheckResult
  ): TradingStatusChange | null {
    if (!isAddress(address)) {
      return null;
    }

    const normalizedAddress = getAddress(address);
    const previousStatus = this.statusHistory.get(normalizedAddress);

    if (previousStatus === undefined || previousStatus === currentResult.status) {
      return null;
    }

    // We don't have the previous trade count stored, so we estimate it
    const previousTradeCount = this.estimatePreviousTradeCount(
      previousStatus,
      currentResult.polymarketTradeCount
    );

    return {
      address: normalizedAddress,
      previousStatus,
      newStatus: currentResult.status,
      previousTradeCount,
      newTradeCount: currentResult.polymarketTradeCount,
      changedAt: new Date(),
    };
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
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTtlMs,
    };
  }

  /**
   * Invalidate cache entry for a specific address
   */
  invalidateCacheEntry(address: string): boolean {
    if (!isAddress(address)) {
      return false;
    }
    const normalizedAddress = getAddress(address);
    return this.cache.delete(normalizedAddress);
  }

  /**
   * Clear status history
   */
  clearStatusHistory(): void {
    this.statusHistory.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Determine trading history status from trade count
   */
  private determineStatus(tradeCount: number): TradingHistoryStatus {
    if (tradeCount === 0) {
      return TradingHistoryStatus.NEVER_TRADED;
    }
    if (tradeCount === 1) {
      return TradingHistoryStatus.FIRST_TRADE;
    }
    if (tradeCount <= this.minimalHistoryThreshold) {
      return TradingHistoryStatus.MINIMAL_HISTORY;
    }
    return TradingHistoryStatus.HAS_HISTORY;
  }

  /**
   * Determine wallet history type comparing blockchain age vs Polymarket activity
   */
  private determineHistoryType(
    walletAge: WalletAgeResult | null,
    polymarketTradeCount: number
  ): WalletHistoryType {
    const isBlockchainNew = walletAge === null || walletAge.isNew ||
      walletAge.category === AgeCategory.NEW || walletAge.category === AgeCategory.VERY_FRESH;
    const isPolymarketNew = polymarketTradeCount === 0;

    if (isBlockchainNew && isPolymarketNew) {
      return WalletHistoryType.NEW_EVERYWHERE;
    }
    if (!isBlockchainNew && isPolymarketNew) {
      return WalletHistoryType.BLOCKCHAIN_VETERAN_PM_NEW;
    }
    if (isBlockchainNew && !isPolymarketNew) {
      return WalletHistoryType.BLOCKCHAIN_NEW_PM_ACTIVE;
    }
    return WalletHistoryType.ESTABLISHED;
  }

  /**
   * Determine if this is a suspicious first-timer
   */
  private isSuspiciousFirstTimer(
    status: TradingHistoryStatus,
    historyType: WalletHistoryType,
    severity: FreshWalletAlertSeverity,
    daysSinceLastTrade: number | null
  ): boolean {
    // First-timers with NEW_EVERYWHERE history type are most suspicious
    if (
      (status === TradingHistoryStatus.NEVER_TRADED ||
        status === TradingHistoryStatus.FIRST_TRADE) &&
      historyType === WalletHistoryType.NEW_EVERYWHERE &&
      (severity === FreshWalletAlertSeverity.CRITICAL ||
        severity === FreshWalletAlertSeverity.HIGH)
    ) {
      return true;
    }

    // New blockchain wallets making their first Polymarket trade with high severity
    if (
      status === TradingHistoryStatus.FIRST_TRADE &&
      historyType === WalletHistoryType.BLOCKCHAIN_NEW_PM_ACTIVE &&
      (severity === FreshWalletAlertSeverity.CRITICAL ||
        severity === FreshWalletAlertSeverity.HIGH)
    ) {
      return true;
    }

    // Also flag blockchain veterans who suddenly start trading on Polymarket with critical severity
    if (
      status === TradingHistoryStatus.NEVER_TRADED &&
      historyType === WalletHistoryType.BLOCKCHAIN_VETERAN_PM_NEW &&
      severity === FreshWalletAlertSeverity.CRITICAL
    ) {
      return true;
    }

    // Flag wallets that were dormant (no trades for dormancyDays) and suddenly became active
    if (
      daysSinceLastTrade !== null &&
      daysSinceLastTrade > this.dormancyDays &&
      (severity === FreshWalletAlertSeverity.CRITICAL ||
        severity === FreshWalletAlertSeverity.HIGH)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get the dormancy threshold in days
   */
  getDormancyDays(): number {
    return this.dormancyDays;
  }

  /**
   * Track status changes for a wallet
   */
  private trackStatusChange(address: string, newStatus: TradingHistoryStatus): void {
    this.statusHistory.set(address, newStatus);
  }

  /**
   * Estimate previous trade count based on status transition
   */
  private estimatePreviousTradeCount(
    previousStatus: TradingHistoryStatus,
    currentTradeCount: number
  ): number {
    switch (previousStatus) {
      case TradingHistoryStatus.NEVER_TRADED:
        return 0;
      case TradingHistoryStatus.FIRST_TRADE:
        return 1;
      case TradingHistoryStatus.MINIMAL_HISTORY:
        return Math.max(2, currentTradeCount - 1);
      case TradingHistoryStatus.HAS_HISTORY:
        return Math.max(this.minimalHistoryThreshold + 1, currentTradeCount - 1);
    }
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): ZeroHistoryCheckResult | null {
    const cached = this.cache.get(address);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached result
   */
  private setCachedResult(address: string, result: ZeroHistoryCheckResult): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(address, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedDetector: ZeroHistoryDetector | null = null;

/**
 * Create a new ZeroHistoryDetector instance
 */
export function createZeroHistoryDetector(
  config?: ZeroHistoryDetectorConfig
): ZeroHistoryDetector {
  return new ZeroHistoryDetector(config);
}

/**
 * Get the shared ZeroHistoryDetector instance
 */
export function getSharedZeroHistoryDetector(): ZeroHistoryDetector {
  if (!sharedDetector) {
    sharedDetector = new ZeroHistoryDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared ZeroHistoryDetector instance
 */
export function setSharedZeroHistoryDetector(detector: ZeroHistoryDetector): void {
  sharedDetector = detector;
}

/**
 * Reset the shared ZeroHistoryDetector instance
 */
export function resetSharedZeroHistoryDetector(): void {
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a wallet has zero Polymarket trading history (convenience function)
 */
export async function checkZeroHistory(
  address: string,
  options?: ZeroHistoryCheckOptions & { detector?: ZeroHistoryDetector }
): Promise<ZeroHistoryCheckResult> {
  const detector = options?.detector ?? getSharedZeroHistoryDetector();
  return detector.checkWallet(address, options);
}

/**
 * Check multiple wallets for zero history (convenience function)
 */
export async function batchCheckZeroHistory(
  addresses: string[],
  options?: ZeroHistoryCheckOptions & { detector?: ZeroHistoryDetector }
): Promise<BatchZeroHistoryResult> {
  const detector = options?.detector ?? getSharedZeroHistoryDetector();
  return detector.checkWallets(addresses, options);
}

/**
 * Check if a wallet has never traded on Polymarket (convenience function)
 */
export async function hasNeverTradedOnPolymarket(
  address: string,
  options?: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> & {
    detector?: ZeroHistoryDetector;
  }
): Promise<boolean> {
  const detector = options?.detector ?? getSharedZeroHistoryDetector();
  return detector.hasNeverTraded(address, options);
}

/**
 * Check if this is a wallet's first trade (convenience function)
 */
export async function isFirstPolymarketTrade(
  address: string,
  options?: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> & {
    detector?: ZeroHistoryDetector;
  }
): Promise<boolean> {
  const detector = options?.detector ?? getSharedZeroHistoryDetector();
  return detector.isFirstTrade(address, options);
}

/**
 * Get Polymarket trade count for a wallet (convenience function)
 */
export async function getPolymarketTradeCount(
  address: string,
  options?: Pick<ZeroHistoryCheckOptions, "clobClient" | "bypassCache"> & {
    detector?: ZeroHistoryDetector;
  }
): Promise<number> {
  const detector = options?.detector ?? getSharedZeroHistoryDetector();
  return detector.getTradeCount(address, options);
}

/**
 * Get summary statistics for zero history results (convenience function)
 */
export function getZeroHistorySummary(
  results: ZeroHistoryCheckResult[],
  detector?: ZeroHistoryDetector
): ZeroHistorySummary {
  const det = detector ?? getSharedZeroHistoryDetector();
  return det.getSummary(results);
}
