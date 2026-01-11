/**
 * Wallet Reactivation Detector (DET-FRESH-007)
 *
 * Detects dormant wallets suddenly becoming active on Polymarket.
 * This is a key signal for identifying potential insider trading or
 * coordinated activity where previously unused wallets are activated.
 *
 * Features:
 * - Track last activity timestamp per wallet
 * - Configurable dormancy threshold (default: 30 days)
 * - Detect activity after dormancy period
 * - Flag reactivation events with severity scoring
 * - Batch processing for multiple wallets
 * - Activity timeline analysis
 */

import { isAddress, getAddress } from "viem";
import {
  getAllTradesByWallet,
  getWalletActivitySummary,
} from "../api/clob/trades";
import { type ClobClient } from "../api/clob/client";
import { type Trade } from "../api/clob/types";
import {
  calculateWalletAge,
  type WalletAgeResult,
} from "./wallet-age";
import {
  FreshWalletAlertSeverity,
  type FreshWalletConfigManager,
} from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Reactivation status classification
 */
export enum ReactivationStatus {
  /** Wallet has never been dormant - consistently active */
  NEVER_DORMANT = "NEVER_DORMANT",
  /** Wallet is currently dormant (no recent activity) */
  DORMANT = "DORMANT",
  /** Wallet has just reactivated after dormancy */
  JUST_REACTIVATED = "JUST_REACTIVATED",
  /** Wallet was reactivated recently (within activity window) */
  RECENTLY_REACTIVATED = "RECENTLY_REACTIVATED",
  /** Wallet has no activity history */
  NO_HISTORY = "NO_HISTORY",
}

/**
 * Dormancy severity level
 */
export enum DormancySeverity {
  /** Short dormancy (30-60 days) */
  SHORT = "SHORT",
  /** Medium dormancy (60-180 days) */
  MEDIUM = "MEDIUM",
  /** Long dormancy (180-365 days) */
  LONG = "LONG",
  /** Extended dormancy (>365 days) */
  EXTENDED = "EXTENDED",
}

/**
 * Activity pattern type
 */
export enum ActivityPatternType {
  /** Regular, consistent activity */
  REGULAR = "REGULAR",
  /** Sporadic, irregular activity */
  SPORADIC = "SPORADIC",
  /** Burst activity after long silence */
  BURST = "BURST",
  /** Single activity after dormancy */
  SINGLE_SHOT = "SINGLE_SHOT",
}

/**
 * Reactivation event details
 */
export interface ReactivationEvent {
  /** Timestamp of last activity before dormancy */
  lastActivityBefore: Date;

  /** Timestamp of first activity after dormancy */
  firstActivityAfter: Date;

  /** Duration of dormancy in days */
  dormancyDays: number;

  /** Severity based on dormancy length */
  dormancySeverity: DormancySeverity;

  /** Number of trades in reactivation burst */
  reactivationTradeCount: number;

  /** Volume of reactivation trades */
  reactivationVolume: number;

  /** Activity pattern type after reactivation */
  activityPattern: ActivityPatternType;
}

/**
 * Activity timeline entry
 */
export interface ActivityTimelineEntry {
  /** Date (day granularity) */
  date: string;

  /** Number of trades on this day */
  tradeCount: number;

  /** Total volume on this day */
  volume: number;

  /** Whether this day follows a dormant period */
  isReactivation: boolean;
}

/**
 * Result of wallet reactivation check
 */
export interface WalletReactivationResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Current reactivation status */
  status: ReactivationStatus;

  /** Whether the wallet is considered reactivated */
  isReactivated: boolean;

  /** Whether the reactivation is suspicious */
  isSuspicious: boolean;

  /** Days since last activity (null if no activity) */
  daysSinceLastActivity: number | null;

  /** Last activity timestamp */
  lastActivityAt: Date | null;

  /** First activity timestamp */
  firstActivityAt: Date | null;

  /** Total trade count */
  totalTradeCount: number;

  /** Total trading volume */
  totalVolume: number;

  /** Number of unique markets traded */
  uniqueMarketsTraded: number;

  /** Reactivation event details (if applicable) */
  reactivationEvent: ReactivationEvent | null;

  /** Activity timeline (recent activity by day) */
  activityTimeline: ActivityTimelineEntry[];

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Wallet age info */
  walletAge: WalletAgeResult | null;

  /** Whether result was from cache */
  fromCache: boolean;

  /** Timestamp when check was performed */
  checkedAt: Date;
}

/**
 * Options for reactivation check
 */
export interface ReactivationCheckOptions {
  /** Dormancy threshold in days (default: 30) */
  dormancyThresholdDays?: number;

  /** Recent activity window in days for timeline (default: 90) */
  activityWindowDays?: number;

  /** Maximum trades to fetch (default: 500) */
  maxTradesToFetch?: number;

  /** Include wallet age calculation (default: true) */
  includeWalletAge?: boolean;

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
export interface BatchReactivationResult {
  /** Successful results by address */
  results: Map<string, WalletReactivationResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful checks */
  successCount: number;

  /** Number of failed checks */
  errorCount: number;

  /** Number of reactivated wallets detected */
  reactivatedCount: number;

  /** Number of suspicious reactivations */
  suspiciousCount: number;

  /** Number of dormant wallets */
  dormantCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for reactivation analysis
 */
export interface ReactivationSummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by reactivation status */
  byStatus: Record<ReactivationStatus, number>;

  /** Count by dormancy severity (for reactivated wallets) */
  byDormancySeverity: Record<DormancySeverity, number>;

  /** Count by alert severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Percentage of reactivated wallets */
  reactivatedPercentage: number;

  /** Percentage of suspicious reactivations */
  suspiciousPercentage: number;

  /** Average dormancy duration for reactivated wallets */
  averageDormancyDays: number | null;

  /** Median dormancy duration for reactivated wallets */
  medianDormancyDays: number | null;

  /** Maximum dormancy duration observed */
  maxDormancyDays: number | null;
}

/**
 * Configuration for WalletReactivationDetector
 */
export interface WalletReactivationDetectorConfig {
  /** Default dormancy threshold in days */
  defaultDormancyThresholdDays?: number;

  /** Default activity window in days */
  defaultActivityWindowDays?: number;

  /** Default max trades to fetch */
  defaultMaxTrades?: number;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Dormancy severity thresholds */
  dormancySeverityThresholds?: DormancySeverityThresholds;
}

/**
 * Thresholds for dormancy severity classification
 */
export interface DormancySeverityThresholds {
  /** Max days for SHORT dormancy (default: 60) */
  shortMaxDays: number;
  /** Max days for MEDIUM dormancy (default: 180) */
  mediumMaxDays: number;
  /** Max days for LONG dormancy (default: 365) */
  longMaxDays: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default dormancy threshold in days */
const DEFAULT_DORMANCY_THRESHOLD_DAYS = 30;

/** Default activity window for timeline (days) */
const DEFAULT_ACTIVITY_WINDOW_DAYS = 90;

/** Default max trades to fetch */
const DEFAULT_MAX_TRADES = 500;

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/** Milliseconds per day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default dormancy severity thresholds */
export const DEFAULT_DORMANCY_SEVERITY_THRESHOLDS: DormancySeverityThresholds = {
  shortMaxDays: 60,
  mediumMaxDays: 180,
  longMaxDays: 365,
};

/** Recent reactivation window (days) - for determining JUST vs RECENTLY reactivated */
const RECENT_REACTIVATION_WINDOW_DAYS = 7;

/** Burst threshold - number of trades in a short period indicating burst activity */
const BURST_TRADE_THRESHOLD = 5;

/** Burst window - days to count trades for burst detection */
const BURST_WINDOW_DAYS = 3;

// ============================================================================
// WalletReactivationDetector Class
// ============================================================================

/**
 * Detector for dormant wallet reactivation
 */
export class WalletReactivationDetector {
  private readonly cache: Map<string, { result: WalletReactivationResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly defaultDormancyThreshold: number;
  private readonly defaultActivityWindow: number;
  private readonly defaultMaxTrades: number;
  private readonly clobClient?: ClobClient;
  private readonly severityThresholds: DormancySeverityThresholds;

  // Track last known activity for status change detection
  private readonly lastKnownActivity: Map<string, Date>;

  constructor(config?: WalletReactivationDetectorConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.defaultDormancyThreshold = config?.defaultDormancyThresholdDays ?? DEFAULT_DORMANCY_THRESHOLD_DAYS;
    this.defaultActivityWindow = config?.defaultActivityWindowDays ?? DEFAULT_ACTIVITY_WINDOW_DAYS;
    this.defaultMaxTrades = config?.defaultMaxTrades ?? DEFAULT_MAX_TRADES;
    this.clobClient = config?.clobClient;
    this.severityThresholds = config?.dormancySeverityThresholds ?? DEFAULT_DORMANCY_SEVERITY_THRESHOLDS;
    this.lastKnownActivity = new Map();
  }

  /**
   * Check if a wallet has been reactivated after dormancy
   */
  async checkWallet(
    address: string,
    options: ReactivationCheckOptions = {}
  ): Promise<WalletReactivationResult> {
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
      dormancyThresholdDays = this.defaultDormancyThreshold,
      activityWindowDays = this.defaultActivityWindow,
      maxTradesToFetch = this.defaultMaxTrades,
      includeWalletAge = true,
      clobClient = this.clobClient,
    } = options;

    // Fetch wallet age if requested
    let walletAge: WalletAgeResult | null = null;
    if (includeWalletAge) {
      try {
        walletAge = await calculateWalletAge(normalizedAddress);
      } catch {
        walletAge = null;
      }
    }

    // Fetch all trades for this wallet
    const trades = await getAllTradesByWallet(normalizedAddress, {
      maxTrades: maxTradesToFetch,
      client: clobClient,
    });

    const result = this.analyzeActivity(
      normalizedAddress,
      trades ?? [],
      walletAge,
      dormancyThresholdDays,
      activityWindowDays
    );

    // Track last known activity for future change detection
    if (result.lastActivityAt) {
      this.lastKnownActivity.set(normalizedAddress, result.lastActivityAt);
    }

    // Cache the result
    this.setCachedResult(normalizedAddress, result);

    return result;
  }

  /**
   * Check multiple wallets for reactivation
   */
  async checkWallets(
    addresses: string[],
    options: ReactivationCheckOptions = {}
  ): Promise<BatchReactivationResult> {
    const startTime = Date.now();
    const results = new Map<string, WalletReactivationResult>();
    const errors = new Map<string, string>();
    let reactivatedCount = 0;
    let suspiciousCount = 0;
    let dormantCount = 0;

    for (const address of addresses) {
      try {
        const result = await this.checkWallet(address, options);
        results.set(result.address, result);

        if (result.isReactivated) {
          reactivatedCount++;
        }
        if (result.isSuspicious) {
          suspiciousCount++;
        }
        if (result.status === ReactivationStatus.DORMANT) {
          dormantCount++;
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
      reactivatedCount,
      suspiciousCount,
      dormantCount,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for reactivation results
   */
  getSummary(results: WalletReactivationResult[]): ReactivationSummary {
    const byStatus: Record<ReactivationStatus, number> = {
      [ReactivationStatus.NEVER_DORMANT]: 0,
      [ReactivationStatus.DORMANT]: 0,
      [ReactivationStatus.JUST_REACTIVATED]: 0,
      [ReactivationStatus.RECENTLY_REACTIVATED]: 0,
      [ReactivationStatus.NO_HISTORY]: 0,
    };

    const byDormancySeverity: Record<DormancySeverity, number> = {
      [DormancySeverity.SHORT]: 0,
      [DormancySeverity.MEDIUM]: 0,
      [DormancySeverity.LONG]: 0,
      [DormancySeverity.EXTENDED]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const dormancyDurations: number[] = [];
    let reactivatedCount = 0;
    let suspiciousCount = 0;

    for (const result of results) {
      byStatus[result.status]++;
      bySeverity[result.severity]++;

      if (result.isReactivated) {
        reactivatedCount++;
        if (result.reactivationEvent) {
          byDormancySeverity[result.reactivationEvent.dormancySeverity]++;
          dormancyDurations.push(result.reactivationEvent.dormancyDays);
        }
      }

      if (result.isSuspicious) {
        suspiciousCount++;
      }
    }

    // Calculate dormancy statistics
    dormancyDurations.sort((a, b) => a - b);
    const total = results.length;

    return {
      total,
      byStatus,
      byDormancySeverity,
      bySeverity,
      reactivatedPercentage: total > 0 ? Math.round((reactivatedCount / total) * 10000) / 100 : 0,
      suspiciousPercentage: total > 0 ? Math.round((suspiciousCount / total) * 10000) / 100 : 0,
      averageDormancyDays: dormancyDurations.length > 0
        ? Math.round(
            (dormancyDurations.reduce((a, b) => a + b, 0) / dormancyDurations.length) * 100
          ) / 100
        : null,
      medianDormancyDays: dormancyDurations.length > 0
        ? dormancyDurations.length % 2 === 0
          ? (dormancyDurations[dormancyDurations.length / 2 - 1]! +
              dormancyDurations[dormancyDurations.length / 2]!) / 2
          : dormancyDurations[Math.floor(dormancyDurations.length / 2)]!
        : null,
      maxDormancyDays: dormancyDurations.length > 0
        ? dormancyDurations[dormancyDurations.length - 1]!
        : null,
    };
  }

  /**
   * Check if a wallet is currently dormant
   */
  async isDormant(
    address: string,
    dormancyThresholdDays?: number,
    options?: Pick<ReactivationCheckOptions, "clobClient" | "bypassCache">
  ): Promise<boolean> {
    const result = await this.checkWallet(address, {
      ...options,
      dormancyThresholdDays,
      includeWalletAge: false,
    });
    return result.status === ReactivationStatus.DORMANT;
  }

  /**
   * Check if a wallet was recently reactivated
   */
  async wasRecentlyReactivated(
    address: string,
    options?: Pick<ReactivationCheckOptions, "clobClient" | "bypassCache" | "dormancyThresholdDays">
  ): Promise<boolean> {
    const result = await this.checkWallet(address, {
      ...options,
      includeWalletAge: false,
    });
    return result.isReactivated;
  }

  /**
   * Get days since last activity for a wallet
   */
  async getDaysSinceLastActivity(
    address: string,
    options?: Pick<ReactivationCheckOptions, "clobClient" | "bypassCache">
  ): Promise<number | null> {
    const result = await this.checkWallet(address, {
      ...options,
      includeWalletAge: false,
    });
    return result.daysSinceLastActivity;
  }

  /**
   * Get the last known activity date for a wallet (from tracking)
   */
  getLastKnownActivity(address: string): Date | undefined {
    if (!isAddress(address)) {
      return undefined;
    }
    const normalizedAddress = getAddress(address);
    return this.lastKnownActivity.get(normalizedAddress);
  }

  /**
   * Check if wallet activity changed since last check
   */
  hasActivityChanged(address: string, currentLastActivity: Date | null): boolean {
    if (!isAddress(address)) {
      return false;
    }
    const normalizedAddress = getAddress(address);
    const lastKnown = this.lastKnownActivity.get(normalizedAddress);

    if (!lastKnown && !currentLastActivity) {
      return false;
    }
    if (!lastKnown || !currentLastActivity) {
      return true;
    }
    return lastKnown.getTime() !== currentLastActivity.getTime();
  }

  /**
   * Get dormancy threshold
   */
  getDormancyThreshold(): number {
    return this.defaultDormancyThreshold;
  }

  /**
   * Get dormancy severity thresholds
   */
  getDormancySeverityThresholds(): DormancySeverityThresholds {
    return { ...this.severityThresholds };
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
   * Clear last known activity tracking
   */
  clearActivityTracking(): void {
    this.lastKnownActivity.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Analyze wallet activity for reactivation detection
   */
  private analyzeActivity(
    address: string,
    trades: Trade[],
    walletAge: WalletAgeResult | null,
    dormancyThresholdDays: number,
    activityWindowDays: number
  ): WalletReactivationResult {
    const now = Date.now();

    // Handle no trade history case
    if (trades.length === 0) {
      return this.buildNoHistoryResult(address, walletAge);
    }

    // Get activity summary
    const activitySummary = getWalletActivitySummary(trades, address);

    // Parse activity timestamps
    const firstActivityAt = activitySummary.firstTradeAt
      ? new Date(activitySummary.firstTradeAt)
      : null;
    const lastActivityAt = activitySummary.lastTradeAt
      ? new Date(activitySummary.lastTradeAt)
      : null;

    // Calculate days since last activity
    const daysSinceLastActivity = lastActivityAt
      ? Math.floor((now - lastActivityAt.getTime()) / MS_PER_DAY)
      : null;

    // Build activity timeline
    const activityTimeline = this.buildActivityTimeline(
      trades,
      activityWindowDays,
      dormancyThresholdDays
    );

    // Detect reactivation
    const reactivationEvent = this.detectReactivation(
      trades,
      dormancyThresholdDays
    );

    // Determine status
    const status = this.determineStatus(
      daysSinceLastActivity,
      dormancyThresholdDays,
      reactivationEvent
    );

    // Determine if suspicious
    const isSuspicious = this.isSuspiciousReactivation(
      status,
      reactivationEvent,
      walletAge,
      trades.length
    );

    // Determine alert severity
    const severity = this.determineSeverity(
      status,
      reactivationEvent,
      isSuspicious,
      walletAge
    );

    return {
      address,
      status,
      isReactivated:
        status === ReactivationStatus.JUST_REACTIVATED ||
        status === ReactivationStatus.RECENTLY_REACTIVATED,
      isSuspicious,
      daysSinceLastActivity,
      lastActivityAt,
      firstActivityAt,
      totalTradeCount: trades.length,
      totalVolume: activitySummary.totalVolume,
      uniqueMarketsTraded: activitySummary.uniqueTokens.size,
      reactivationEvent,
      activityTimeline,
      severity,
      walletAge,
      fromCache: false,
      checkedAt: new Date(),
    };
  }

  /**
   * Build result for wallet with no trading history
   */
  private buildNoHistoryResult(
    address: string,
    walletAge: WalletAgeResult | null
  ): WalletReactivationResult {
    return {
      address,
      status: ReactivationStatus.NO_HISTORY,
      isReactivated: false,
      isSuspicious: false,
      daysSinceLastActivity: null,
      lastActivityAt: null,
      firstActivityAt: null,
      totalTradeCount: 0,
      totalVolume: 0,
      uniqueMarketsTraded: 0,
      reactivationEvent: null,
      activityTimeline: [],
      severity: FreshWalletAlertSeverity.LOW,
      walletAge,
      fromCache: false,
      checkedAt: new Date(),
    };
  }

  /**
   * Build activity timeline from trades
   */
  private buildActivityTimeline(
    trades: Trade[],
    windowDays: number,
    dormancyThresholdDays: number
  ): ActivityTimelineEntry[] {
    const now = Date.now();
    const windowStart = now - windowDays * MS_PER_DAY;
    const timeline = new Map<string, ActivityTimelineEntry>();

    // Sort trades by timestamp (oldest first)
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });

    // Track the previous trade date for gap detection
    let previousTradeDate: Date | null = null;

    for (const trade of sortedTrades) {
      const tradeTime = new Date(trade.created_at || 0);
      const tradeDate = tradeTime.toISOString().split("T")[0]!;

      // Only include trades within window
      if (tradeTime.getTime() < windowStart) {
        previousTradeDate = tradeTime;
        continue;
      }

      // Check if this is a reactivation (gap > dormancy threshold)
      const isReactivation = previousTradeDate !== null &&
        (tradeTime.getTime() - previousTradeDate.getTime()) / MS_PER_DAY > dormancyThresholdDays;

      if (!timeline.has(tradeDate)) {
        timeline.set(tradeDate, {
          date: tradeDate,
          tradeCount: 0,
          volume: 0,
          isReactivation,
        });
      }

      const entry = timeline.get(tradeDate)!;
      entry.tradeCount++;
      entry.volume += parseFloat(trade.size || "0");

      previousTradeDate = tradeTime;
    }

    // Sort by date and return
    return Array.from(timeline.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Detect reactivation event from trade history
   */
  private detectReactivation(
    trades: Trade[],
    dormancyThresholdDays: number
  ): ReactivationEvent | null {
    if (trades.length < 2) {
      return null;
    }

    // Sort trades by timestamp (oldest first)
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });

    const now = Date.now();

    // Find the most recent dormancy gap
    let largestGap = 0;
    let gapStartTrade: Trade | null = null;
    let gapEndTrade: Trade | null = null;

    for (let i = 1; i < sortedTrades.length; i++) {
      const prevTime = new Date(sortedTrades[i - 1]!.created_at || 0).getTime();
      const currTime = new Date(sortedTrades[i]!.created_at || 0).getTime();
      const gapDays = (currTime - prevTime) / MS_PER_DAY;

      // Only consider gaps that are after dormancy threshold
      // and the reactivation is within a reasonable recent window
      if (gapDays > dormancyThresholdDays && gapDays > largestGap) {
        largestGap = gapDays;
        gapStartTrade = sortedTrades[i - 1]!;
        gapEndTrade = sortedTrades[i]!;
      }
    }

    // If no significant gap found, check if currently dormant and recently came back
    if (!gapStartTrade || !gapEndTrade) {
      return null;
    }

    const lastActivityBefore = new Date(gapStartTrade.created_at || 0);
    const firstActivityAfter = new Date(gapEndTrade.created_at || 0);

    // Calculate reactivation metrics
    const reactivationTradesStartTime = firstActivityAfter.getTime();
    const reactivationTrades = sortedTrades.filter((t) => {
      const time = new Date(t.created_at || 0).getTime();
      return time >= reactivationTradesStartTime;
    });

    const reactivationVolume = reactivationTrades.reduce(
      (sum, t) => sum + parseFloat(t.size || "0"),
      0
    );

    // Determine activity pattern
    const activityPattern = this.determineActivityPattern(
      reactivationTrades,
      now
    );

    return {
      lastActivityBefore,
      firstActivityAfter,
      dormancyDays: Math.floor(largestGap),
      dormancySeverity: this.classifyDormancySeverity(Math.floor(largestGap)),
      reactivationTradeCount: reactivationTrades.length,
      reactivationVolume,
      activityPattern,
    };
  }

  /**
   * Determine activity pattern type
   */
  private determineActivityPattern(
    reactivationTrades: Trade[],
    now: number
  ): ActivityPatternType {
    if (reactivationTrades.length === 1) {
      return ActivityPatternType.SINGLE_SHOT;
    }

    // Check for burst (many trades in short window)
    const burstWindowStart = now - BURST_WINDOW_DAYS * MS_PER_DAY;
    const recentTrades = reactivationTrades.filter((t) => {
      const time = new Date(t.created_at || 0).getTime();
      return time >= burstWindowStart;
    });

    if (recentTrades.length >= BURST_TRADE_THRESHOLD) {
      return ActivityPatternType.BURST;
    }

    // Check for regular vs sporadic
    if (reactivationTrades.length < 5) {
      return ActivityPatternType.SPORADIC;
    }

    // Calculate time span and trade frequency
    const firstTime = new Date(
      reactivationTrades[0]!.created_at || 0
    ).getTime();
    const lastTime = new Date(
      reactivationTrades[reactivationTrades.length - 1]!.created_at || 0
    ).getTime();
    const spanDays = (lastTime - firstTime) / MS_PER_DAY;

    if (spanDays > 0) {
      const avgTradesPerDay = reactivationTrades.length / spanDays;
      if (avgTradesPerDay >= 0.2) {
        return ActivityPatternType.REGULAR;
      }
    }

    return ActivityPatternType.SPORADIC;
  }

  /**
   * Determine reactivation status
   */
  private determineStatus(
    daysSinceLastActivity: number | null,
    dormancyThresholdDays: number,
    reactivationEvent: ReactivationEvent | null
  ): ReactivationStatus {
    // No activity
    if (daysSinceLastActivity === null) {
      return ReactivationStatus.NO_HISTORY;
    }

    // Currently dormant
    if (daysSinceLastActivity > dormancyThresholdDays) {
      return ReactivationStatus.DORMANT;
    }

    // Check for reactivation
    if (reactivationEvent) {
      const daysSinceReactivation = Math.floor(
        (Date.now() - reactivationEvent.firstActivityAfter.getTime()) / MS_PER_DAY
      );

      if (daysSinceReactivation <= RECENT_REACTIVATION_WINDOW_DAYS) {
        return ReactivationStatus.JUST_REACTIVATED;
      }

      // Still within a reasonable window to be considered "recently" reactivated
      if (daysSinceReactivation <= dormancyThresholdDays) {
        return ReactivationStatus.RECENTLY_REACTIVATED;
      }
    }

    return ReactivationStatus.NEVER_DORMANT;
  }

  /**
   * Determine if reactivation is suspicious
   */
  private isSuspiciousReactivation(
    status: ReactivationStatus,
    reactivationEvent: ReactivationEvent | null,
    walletAge: WalletAgeResult | null,
    totalTradeCount: number
  ): boolean {
    // Not reactivated = not suspicious (in this context)
    if (
      status !== ReactivationStatus.JUST_REACTIVATED &&
      status !== ReactivationStatus.RECENTLY_REACTIVATED
    ) {
      return false;
    }

    if (!reactivationEvent) {
      return false;
    }

    // Long dormancy is suspicious
    if (
      reactivationEvent.dormancySeverity === DormancySeverity.LONG ||
      reactivationEvent.dormancySeverity === DormancySeverity.EXTENDED
    ) {
      return true;
    }

    // Burst activity after dormancy is suspicious
    if (reactivationEvent.activityPattern === ActivityPatternType.BURST) {
      return true;
    }

    // Fresh wallet with sudden reactivation is suspicious
    if (walletAge && walletAge.isFresh && reactivationEvent.dormancyDays > 60) {
      return true;
    }

    // High volume after long silence is suspicious
    if (
      reactivationEvent.dormancySeverity === DormancySeverity.MEDIUM &&
      reactivationEvent.reactivationVolume > 10000
    ) {
      return true;
    }

    // Low total trade count with reactivation pattern is suspicious
    // (suggests purpose-created wallet)
    if (totalTradeCount <= 5 && reactivationEvent.dormancyDays > 90) {
      return true;
    }

    return false;
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(
    status: ReactivationStatus,
    reactivationEvent: ReactivationEvent | null,
    isSuspicious: boolean,
    walletAge: WalletAgeResult | null
  ): FreshWalletAlertSeverity {
    // No history or not reactivated = low
    if (
      status === ReactivationStatus.NO_HISTORY ||
      status === ReactivationStatus.NEVER_DORMANT ||
      status === ReactivationStatus.DORMANT
    ) {
      return FreshWalletAlertSeverity.LOW;
    }

    // Suspicious reactivation
    if (isSuspicious) {
      // Extended dormancy with fresh wallet = critical
      if (
        reactivationEvent?.dormancySeverity === DormancySeverity.EXTENDED &&
        walletAge?.isFresh
      ) {
        return FreshWalletAlertSeverity.CRITICAL;
      }

      // Long dormancy or burst = high
      if (
        reactivationEvent?.dormancySeverity === DormancySeverity.LONG ||
        reactivationEvent?.activityPattern === ActivityPatternType.BURST
      ) {
        return FreshWalletAlertSeverity.HIGH;
      }

      return FreshWalletAlertSeverity.HIGH;
    }

    // Non-suspicious reactivation
    if (reactivationEvent) {
      switch (reactivationEvent.dormancySeverity) {
        case DormancySeverity.EXTENDED:
          return FreshWalletAlertSeverity.HIGH;
        case DormancySeverity.LONG:
          return FreshWalletAlertSeverity.MEDIUM;
        case DormancySeverity.MEDIUM:
          return FreshWalletAlertSeverity.MEDIUM;
        case DormancySeverity.SHORT:
          return FreshWalletAlertSeverity.LOW;
      }
    }

    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Classify dormancy severity based on duration
   */
  private classifyDormancySeverity(dormancyDays: number): DormancySeverity {
    if (dormancyDays <= this.severityThresholds.shortMaxDays) {
      return DormancySeverity.SHORT;
    }
    if (dormancyDays <= this.severityThresholds.mediumMaxDays) {
      return DormancySeverity.MEDIUM;
    }
    if (dormancyDays <= this.severityThresholds.longMaxDays) {
      return DormancySeverity.LONG;
    }
    return DormancySeverity.EXTENDED;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): WalletReactivationResult | null {
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
  private setCachedResult(address: string, result: WalletReactivationResult): void {
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

let sharedDetector: WalletReactivationDetector | null = null;

/**
 * Create a new WalletReactivationDetector instance
 */
export function createWalletReactivationDetector(
  config?: WalletReactivationDetectorConfig
): WalletReactivationDetector {
  return new WalletReactivationDetector(config);
}

/**
 * Get the shared WalletReactivationDetector instance
 */
export function getSharedWalletReactivationDetector(): WalletReactivationDetector {
  if (!sharedDetector) {
    sharedDetector = new WalletReactivationDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared WalletReactivationDetector instance
 */
export function setSharedWalletReactivationDetector(detector: WalletReactivationDetector): void {
  sharedDetector = detector;
}

/**
 * Reset the shared WalletReactivationDetector instance
 */
export function resetSharedWalletReactivationDetector(): void {
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a wallet has been reactivated (convenience function)
 */
export async function checkWalletReactivation(
  address: string,
  options?: ReactivationCheckOptions & { detector?: WalletReactivationDetector }
): Promise<WalletReactivationResult> {
  const detector = options?.detector ?? getSharedWalletReactivationDetector();
  return detector.checkWallet(address, options);
}

/**
 * Check multiple wallets for reactivation (convenience function)
 */
export async function batchCheckWalletReactivation(
  addresses: string[],
  options?: ReactivationCheckOptions & { detector?: WalletReactivationDetector }
): Promise<BatchReactivationResult> {
  const detector = options?.detector ?? getSharedWalletReactivationDetector();
  return detector.checkWallets(addresses, options);
}

/**
 * Check if a wallet is currently dormant (convenience function)
 */
export async function isWalletDormant(
  address: string,
  dormancyThresholdDays?: number,
  options?: Pick<ReactivationCheckOptions, "clobClient" | "bypassCache"> & {
    detector?: WalletReactivationDetector;
  }
): Promise<boolean> {
  const detector = options?.detector ?? getSharedWalletReactivationDetector();
  return detector.isDormant(address, dormancyThresholdDays, options);
}

/**
 * Check if a wallet was recently reactivated (convenience function)
 */
export async function wasWalletRecentlyReactivated(
  address: string,
  options?: Pick<
    ReactivationCheckOptions,
    "clobClient" | "bypassCache" | "dormancyThresholdDays"
  > & {
    detector?: WalletReactivationDetector;
  }
): Promise<boolean> {
  const detector = options?.detector ?? getSharedWalletReactivationDetector();
  return detector.wasRecentlyReactivated(address, options);
}

/**
 * Get days since last activity for a wallet (convenience function)
 */
export async function getWalletDaysSinceActivity(
  address: string,
  options?: Pick<ReactivationCheckOptions, "clobClient" | "bypassCache"> & {
    detector?: WalletReactivationDetector;
  }
): Promise<number | null> {
  const detector = options?.detector ?? getSharedWalletReactivationDetector();
  return detector.getDaysSinceLastActivity(address, options);
}

/**
 * Get summary statistics for reactivation results (convenience function)
 */
export function getReactivationSummary(
  results: WalletReactivationResult[],
  detector?: WalletReactivationDetector
): ReactivationSummary {
  const det = detector ?? getSharedWalletReactivationDetector();
  return det.getSummary(results);
}
