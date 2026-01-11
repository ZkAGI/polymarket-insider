/**
 * Wallet Funding Pattern Analyzer (DET-FRESH-005)
 *
 * Analyze how fresh wallets are funded before trading.
 * This can help identify suspicious behavior patterns like:
 * - Immediate trading after funding
 * - Unusual funding amounts
 * - Suspicious funding sources
 * - Coordinated funding patterns
 *
 * Features:
 * - Track pre-trade deposits
 * - Identify funding timing
 * - Flag immediate trading after funding
 * - Score funding patterns for suspiciousness
 * - Batch processing for multiple wallets
 */

import { isAddress, getAddress } from "viem";
import { type ClobClient } from "../api/clob/client";
import { getAllTradesByWallet } from "../api/clob/trades";
import { type Trade } from "../api/clob/types";
import {
  type FundingAnalysis,
  type FundingRiskLevel,
  getSharedFundingSourceTracker,
  type FundingSourceTracker,
} from "../api/chain/funding-source";
import {
  FreshWalletAlertSeverity,
  getSharedFreshWalletConfigManager,
  type FreshWalletConfigManager,
} from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Funding pattern classification
 */
export enum FundingPatternType {
  /** Normal funding pattern - adequate time between funding and trading */
  NORMAL = "NORMAL",
  /** Quick trading - started trading relatively quickly after funding */
  QUICK = "QUICK",
  /** Immediate trading - started trading very soon after funding */
  IMMEDIATE = "IMMEDIATE",
  /** Flash trading - trading within minutes of funding */
  FLASH = "FLASH",
  /** Suspicious pattern - multiple concerning signals */
  SUSPICIOUS = "SUSPICIOUS",
}

/**
 * Timing category for funding-to-trade interval
 */
export enum FundingTimingCategory {
  /** Under 5 minutes */
  FLASH = "FLASH",
  /** 5 minutes to 1 hour */
  VERY_FAST = "VERY_FAST",
  /** 1 hour to 24 hours */
  FAST = "FAST",
  /** 24 hours to 7 days */
  MODERATE = "MODERATE",
  /** Over 7 days */
  SLOW = "SLOW",
  /** No trades yet */
  NO_TRADES = "NO_TRADES",
}

/**
 * Individual funding deposit event
 */
export interface FundingDeposit {
  /** Source address */
  sourceAddress: string;

  /** Source name if known (e.g., "Binance") */
  sourceName: string | null;

  /** Deposit amount in raw units */
  amount: bigint;

  /** Formatted amount string */
  formattedAmount: string;

  /** Deposit timestamp (unix seconds) */
  timestamp: number;

  /** Transaction hash */
  transactionHash: string;

  /** Whether this is from an exchange */
  isExchange: boolean;

  /** Whether this is from a mixer/privacy tool */
  isMixer: boolean;

  /** Whether source is sanctioned */
  isSanctioned: boolean;

  /** Risk level of the source */
  riskLevel: FundingRiskLevel;
}

/**
 * First trade info relative to funding
 */
export interface FirstTradeAfterFunding {
  /** Trade ID */
  tradeId: string;

  /** Trade timestamp (ISO string) */
  timestamp: string;

  /** Trade size in raw units */
  size: number;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade price */
  price: number;

  /** Trade side (buy/sell) */
  side: "buy" | "sell";

  /** Time since last deposit in seconds */
  timeSinceLastDepositSeconds: number;

  /** Time since first deposit in seconds */
  timeSinceFirstDepositSeconds: number;

  /** Timing category */
  timingCategory: FundingTimingCategory;
}

/**
 * Funding pattern analysis result
 */
export interface FundingPatternResult {
  /** Wallet address (checksummed) */
  address: string;

  /** Whether wallet has any funding deposits */
  hasDeposits: boolean;

  /** Whether wallet has made any trades */
  hasTrades: boolean;

  /** Pattern classification */
  patternType: FundingPatternType;

  /** Timing category for first trade */
  timingCategory: FundingTimingCategory;

  /** All funding deposits (pre-first-trade) */
  preTradingDeposits: FundingDeposit[];

  /** Total pre-trading deposit amount */
  totalPreTradingAmount: bigint;

  /** Formatted total pre-trading amount */
  formattedTotalPreTradingAmount: string;

  /** First trade details after funding */
  firstTradeAfterFunding: FirstTradeAfterFunding | null;

  /** Time between first deposit and first trade (seconds) */
  fundingToTradeIntervalSeconds: number | null;

  /** Time between last deposit and first trade (seconds) */
  lastDepositToTradeIntervalSeconds: number | null;

  /** Suspicion score (0-100) */
  suspicionScore: number;

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Reasons for flagging (if any) */
  flagReasons: string[];

  /** Summary of risk factors from funding sources */
  fundingRiskSummary: FundingRiskSummary;

  /** Whether result was from cache */
  fromCache: boolean;

  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Summary of funding source risks
 */
export interface FundingRiskSummary {
  /** Overall risk level from funding sources */
  overallRiskLevel: FundingRiskLevel;

  /** Has any sanctioned sources */
  hasSanctionedSources: boolean;

  /** Has any mixer/privacy tool sources */
  hasMixerSources: boolean;

  /** Percentage from exchanges */
  exchangePercentage: number;

  /** Percentage from mixers */
  mixerPercentage: number;

  /** Percentage from unknown sources */
  unknownPercentage: number;

  /** Number of unique funding sources */
  uniqueSourceCount: number;

  /** Names of exchanges used (if any) */
  exchangeNames: string[];

  /** Names of mixers used (if any) */
  mixerNames: string[];
}

/**
 * Options for funding pattern analysis
 */
export interface FundingPatternOptions {
  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom funding source tracker */
  fundingTracker?: FundingSourceTracker;

  /** Custom config manager */
  configManager?: FreshWalletConfigManager;

  /** Maximum trades to fetch for analysis */
  maxTrades?: number;

  /** Bypass cache for fresh data */
  bypassCache?: boolean;

  /** Custom thresholds */
  thresholds?: Partial<FundingPatternThresholds>;
}

/**
 * Thresholds for funding pattern analysis
 */
export interface FundingPatternThresholds {
  /** Seconds threshold for FLASH timing (default: 300 = 5 min) */
  flashTimingSeconds: number;

  /** Seconds threshold for VERY_FAST timing (default: 3600 = 1 hour) */
  veryFastTimingSeconds: number;

  /** Seconds threshold for FAST timing (default: 86400 = 24 hours) */
  fastTimingSeconds: number;

  /** Seconds threshold for MODERATE timing (default: 604800 = 7 days) */
  moderateTimingSeconds: number;

  /** Score added for flash timing */
  flashTimingScore: number;

  /** Score added for very fast timing */
  veryFastTimingScore: number;

  /** Score added for fast timing */
  fastTimingScore: number;

  /** Score added for sanctioned source */
  sanctionedSourceScore: number;

  /** Score added for mixer source */
  mixerSourceScore: number;

  /** Score added for single large deposit */
  singleLargeDepositScore: number;

  /** Score added for multiple quick deposits */
  multipleQuickDepositsScore: number;

  /** Threshold (USD) for considering deposit "large" */
  largeDepositThresholdUsd: number;

  /** Window (seconds) for "quick" consecutive deposits */
  quickDepositWindowSeconds: number;

  /** Threshold for SUSPICIOUS pattern score */
  suspiciousThreshold: number;

  /** Threshold for IMMEDIATE pattern score */
  immediateThreshold: number;

  /** Threshold for QUICK pattern score */
  quickThreshold: number;
}

/**
 * Batch result for multiple wallet analyses
 */
export interface BatchFundingPatternResult {
  /** Successful analysis results by address */
  results: Map<string, FundingPatternResult>;

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total addresses processed */
  totalProcessed: number;

  /** Number of successful analyses */
  successCount: number;

  /** Number of failed analyses */
  errorCount: number;

  /** Count by pattern type */
  byPatternType: Record<FundingPatternType, number>;

  /** Count by timing category */
  byTimingCategory: Record<FundingTimingCategory, number>;

  /** Count flagged as suspicious */
  suspiciousCount: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for funding pattern analysis
 */
export interface FundingPatternSummary {
  /** Total wallets analyzed */
  total: number;

  /** Count by pattern type */
  byPatternType: Record<FundingPatternType, number>;

  /** Count by timing category */
  byTimingCategory: Record<FundingTimingCategory, number>;

  /** Count by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Percentage flagged as suspicious */
  suspiciousPercentage: number;

  /** Percentage with flash timing */
  flashTimingPercentage: number;

  /** Average funding-to-trade interval (seconds) */
  averageFundingToTradeSeconds: number | null;

  /** Median funding-to-trade interval (seconds) */
  medianFundingToTradeSeconds: number | null;

  /** Average suspicion score */
  averageSuspicionScore: number;
}

/**
 * Configuration for FundingPatternAnalyzer
 */
export interface FundingPatternAnalyzerConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Default thresholds */
  thresholds?: Partial<FundingPatternThresholds>;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Custom funding source tracker */
  fundingTracker?: FundingSourceTracker;

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

/** Default thresholds for funding pattern analysis */
export const DEFAULT_FUNDING_PATTERN_THRESHOLDS: FundingPatternThresholds = {
  // Timing thresholds in seconds
  flashTimingSeconds: 300, // 5 minutes
  veryFastTimingSeconds: 3600, // 1 hour
  fastTimingSeconds: 86400, // 24 hours
  moderateTimingSeconds: 604800, // 7 days

  // Scoring weights
  flashTimingScore: 40,
  veryFastTimingScore: 25,
  fastTimingScore: 10,
  sanctionedSourceScore: 50,
  mixerSourceScore: 30,
  singleLargeDepositScore: 15,
  multipleQuickDepositsScore: 20,

  // Other thresholds
  largeDepositThresholdUsd: 10000,
  quickDepositWindowSeconds: 600, // 10 minutes
  suspiciousThreshold: 60,
  immediateThreshold: 40,
  quickThreshold: 20,
};

// ============================================================================
// FundingPatternAnalyzer Class
// ============================================================================

/**
 * Analyzer for wallet funding patterns before trading
 */
export class FundingPatternAnalyzer {
  private readonly cache: Map<string, { result: FundingPatternResult; expiresAt: number }>;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly thresholds: FundingPatternThresholds;
  private readonly clobClient?: ClobClient;
  private readonly fundingTracker: FundingSourceTracker;
  private readonly configManager: FreshWalletConfigManager;

  constructor(config?: FundingPatternAnalyzerConfig) {
    this.cache = new Map();
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.thresholds = {
      ...DEFAULT_FUNDING_PATTERN_THRESHOLDS,
      ...config?.thresholds,
    };
    this.clobClient = config?.clobClient;
    this.fundingTracker = config?.fundingTracker ?? getSharedFundingSourceTracker();
    this.configManager = config?.configManager ?? getSharedFreshWalletConfigManager();
  }

  /**
   * Analyze a wallet's funding pattern
   */
  async analyzeWallet(
    address: string,
    options: FundingPatternOptions = {}
  ): Promise<FundingPatternResult> {
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
      clobClient = this.clobClient,
      fundingTracker = this.fundingTracker,
      maxTrades = DEFAULT_MAX_TRADES,
      thresholds: customThresholds,
    } = options;

    const effectiveThresholds = {
      ...this.thresholds,
      ...customThresholds,
    };

    // Fetch trades to determine first trade timestamp
    const trades = await getAllTradesByWallet(normalizedAddress, {
      maxTrades,
      client: clobClient,
    });

    // Sort trades by timestamp
    const sortedTrades = trades?.length
      ? [...trades].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      : [];

    const firstTrade = sortedTrades[0] ?? null;
    const firstTradeTimestamp = firstTrade
      ? Math.floor(new Date(firstTrade.created_at).getTime() / 1000)
      : null;

    // Fetch funding sources
    let fundingAnalysis: FundingAnalysis | null = null;
    try {
      fundingAnalysis = await fundingTracker.analyzeFundingSources(normalizedAddress, {
        maxDepth: 2,
      });
    } catch {
      // Funding analysis failed, continue with empty data
      fundingAnalysis = null;
    }

    // Extract pre-trading deposits
    const preTradingDeposits = this.extractPreTradingDeposits(
      fundingAnalysis,
      firstTradeTimestamp
    );

    // Calculate total pre-trading amount
    let totalPreTradingAmount = 0n;
    for (const deposit of preTradingDeposits) {
      totalPreTradingAmount += deposit.amount;
    }

    // Analyze first trade relative to funding
    const firstTradeAfterFunding = this.analyzeFirstTradeAfterFunding(
      firstTrade,
      preTradingDeposits,
      effectiveThresholds
    );

    // Calculate timing intervals
    const fundingToTradeIntervalSeconds =
      preTradingDeposits.length > 0 && firstTradeTimestamp !== null
        ? firstTradeTimestamp - preTradingDeposits[0]!.timestamp
        : null;

    const lastDepositToTradeIntervalSeconds =
      preTradingDeposits.length > 0 && firstTradeTimestamp !== null
        ? firstTradeTimestamp - preTradingDeposits[preTradingDeposits.length - 1]!.timestamp
        : null;

    // Determine timing category
    const timingCategory = this.determineTimingCategory(
      lastDepositToTradeIntervalSeconds,
      effectiveThresholds
    );

    // Build funding risk summary
    const fundingRiskSummary = this.buildFundingRiskSummary(
      preTradingDeposits,
      totalPreTradingAmount
    );

    // Calculate suspicion score and flag reasons
    const { suspicionScore, flagReasons } = this.calculateSuspicionScore(
      preTradingDeposits,
      timingCategory,
      fundingRiskSummary,
      effectiveThresholds
    );

    // Determine pattern type
    const patternType = this.determinePatternType(suspicionScore, effectiveThresholds);

    // Determine severity
    const severity = this.determineSeverity(patternType, fundingRiskSummary, suspicionScore);

    const result: FundingPatternResult = {
      address: normalizedAddress,
      hasDeposits: preTradingDeposits.length > 0,
      hasTrades: sortedTrades.length > 0,
      patternType,
      timingCategory,
      preTradingDeposits,
      totalPreTradingAmount,
      formattedTotalPreTradingAmount: this.formatAmount(totalPreTradingAmount),
      firstTradeAfterFunding,
      fundingToTradeIntervalSeconds,
      lastDepositToTradeIntervalSeconds,
      suspicionScore,
      severity,
      flagReasons,
      fundingRiskSummary,
      fromCache: false,
      analyzedAt: new Date(),
    };

    this.setCachedResult(normalizedAddress, result);
    return result;
  }

  /**
   * Analyze multiple wallets
   */
  async analyzeWallets(
    addresses: string[],
    options: FundingPatternOptions = {}
  ): Promise<BatchFundingPatternResult> {
    const startTime = Date.now();
    const results = new Map<string, FundingPatternResult>();
    const errors = new Map<string, string>();
    let suspiciousCount = 0;

    const byPatternType: Record<FundingPatternType, number> = {
      [FundingPatternType.NORMAL]: 0,
      [FundingPatternType.QUICK]: 0,
      [FundingPatternType.IMMEDIATE]: 0,
      [FundingPatternType.FLASH]: 0,
      [FundingPatternType.SUSPICIOUS]: 0,
    };

    const byTimingCategory: Record<FundingTimingCategory, number> = {
      [FundingTimingCategory.FLASH]: 0,
      [FundingTimingCategory.VERY_FAST]: 0,
      [FundingTimingCategory.FAST]: 0,
      [FundingTimingCategory.MODERATE]: 0,
      [FundingTimingCategory.SLOW]: 0,
      [FundingTimingCategory.NO_TRADES]: 0,
    };

    for (const address of addresses) {
      try {
        const result = await this.analyzeWallet(address, options);
        results.set(result.address, result);

        byPatternType[result.patternType]++;
        byTimingCategory[result.timingCategory]++;

        if (result.patternType === FundingPatternType.SUSPICIOUS) {
          suspiciousCount++;
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
      byPatternType,
      byTimingCategory,
      suspiciousCount,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get summary statistics for analyzed results
   */
  getSummary(results: FundingPatternResult[]): FundingPatternSummary {
    const byPatternType: Record<FundingPatternType, number> = {
      [FundingPatternType.NORMAL]: 0,
      [FundingPatternType.QUICK]: 0,
      [FundingPatternType.IMMEDIATE]: 0,
      [FundingPatternType.FLASH]: 0,
      [FundingPatternType.SUSPICIOUS]: 0,
    };

    const byTimingCategory: Record<FundingTimingCategory, number> = {
      [FundingTimingCategory.FLASH]: 0,
      [FundingTimingCategory.VERY_FAST]: 0,
      [FundingTimingCategory.FAST]: 0,
      [FundingTimingCategory.MODERATE]: 0,
      [FundingTimingCategory.SLOW]: 0,
      [FundingTimingCategory.NO_TRADES]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const fundingToTradeIntervals: number[] = [];
    const suspicionScores: number[] = [];
    let suspiciousCount = 0;
    let flashCount = 0;

    for (const result of results) {
      byPatternType[result.patternType]++;
      byTimingCategory[result.timingCategory]++;
      bySeverity[result.severity]++;
      suspicionScores.push(result.suspicionScore);

      if (result.patternType === FundingPatternType.SUSPICIOUS) {
        suspiciousCount++;
      }

      if (result.timingCategory === FundingTimingCategory.FLASH) {
        flashCount++;
      }

      if (result.fundingToTradeIntervalSeconds !== null) {
        fundingToTradeIntervals.push(result.fundingToTradeIntervalSeconds);
      }
    }

    // Calculate average and median intervals
    fundingToTradeIntervals.sort((a, b) => a - b);
    const avgInterval =
      fundingToTradeIntervals.length > 0
        ? fundingToTradeIntervals.reduce((a, b) => a + b, 0) / fundingToTradeIntervals.length
        : null;
    const medianInterval =
      fundingToTradeIntervals.length > 0
        ? fundingToTradeIntervals.length % 2 === 0
          ? (fundingToTradeIntervals[fundingToTradeIntervals.length / 2 - 1]! +
              fundingToTradeIntervals[fundingToTradeIntervals.length / 2]!) /
            2
          : fundingToTradeIntervals[Math.floor(fundingToTradeIntervals.length / 2)]!
        : null;

    // Calculate average suspicion score
    const avgSuspicionScore =
      suspicionScores.length > 0
        ? suspicionScores.reduce((a, b) => a + b, 0) / suspicionScores.length
        : 0;

    const total = results.length;

    return {
      total,
      byPatternType,
      byTimingCategory,
      bySeverity,
      suspiciousPercentage: total > 0 ? Math.round((suspiciousCount / total) * 10000) / 100 : 0,
      flashTimingPercentage: total > 0 ? Math.round((flashCount / total) * 10000) / 100 : 0,
      averageFundingToTradeSeconds: avgInterval !== null ? Math.round(avgInterval) : null,
      medianFundingToTradeSeconds: medianInterval !== null ? Math.round(medianInterval) : null,
      averageSuspicionScore: Math.round(avgSuspicionScore * 100) / 100,
    };
  }

  /**
   * Check if a wallet has suspicious funding pattern
   */
  async hasSuspiciousFundingPattern(
    address: string,
    options?: FundingPatternOptions
  ): Promise<boolean> {
    const result = await this.analyzeWallet(address, options);
    return result.patternType === FundingPatternType.SUSPICIOUS;
  }

  /**
   * Check if a wallet has flash trading (trading within 5 min of funding)
   */
  async hasFlashTrading(address: string, options?: FundingPatternOptions): Promise<boolean> {
    const result = await this.analyzeWallet(address, options);
    return result.timingCategory === FundingTimingCategory.FLASH;
  }

  /**
   * Get funding timing category for a wallet
   */
  async getFundingTimingCategory(
    address: string,
    options?: FundingPatternOptions
  ): Promise<FundingTimingCategory> {
    const result = await this.analyzeWallet(address, options);
    return result.timingCategory;
  }

  /**
   * Get the current thresholds
   */
  getThresholds(): FundingPatternThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get the config manager
   */
  getConfigManager(): FreshWalletConfigManager {
    return this.configManager;
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

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Extract pre-trading deposits from funding analysis
   */
  private extractPreTradingDeposits(
    analysis: FundingAnalysis | null,
    firstTradeTimestamp: number | null
  ): FundingDeposit[] {
    if (!analysis) {
      return [];
    }

    const deposits: FundingDeposit[] = [];

    // Extract from funding sources
    for (const source of analysis.fundingSources) {
      // Only include direct deposits (depth === 1)
      if (source.depth !== 1) {
        continue;
      }

      // Only include deposits before first trade (or all if no trade yet)
      if (firstTradeTimestamp !== null && source.firstTransferTimestamp >= firstTradeTimestamp) {
        continue;
      }

      deposits.push({
        sourceAddress: source.address,
        sourceName: source.name ?? null,
        amount: source.totalAmount,
        formattedAmount: source.formattedAmount,
        timestamp: source.firstTransferTimestamp,
        transactionHash: source.transactionHashes[0] ?? "",
        isExchange: source.type === "exchange",
        isMixer: source.type === "mixer",
        isSanctioned: source.isSanctioned,
        riskLevel: source.riskLevel,
      });
    }

    // Sort by timestamp ascending
    deposits.sort((a, b) => a.timestamp - b.timestamp);

    return deposits;
  }

  /**
   * Analyze first trade relative to funding
   */
  private analyzeFirstTradeAfterFunding(
    firstTrade: Trade | null,
    deposits: FundingDeposit[],
    thresholds: FundingPatternThresholds
  ): FirstTradeAfterFunding | null {
    if (!firstTrade || deposits.length === 0) {
      return null;
    }

    const tradeTimestamp = Math.floor(new Date(firstTrade.created_at).getTime() / 1000);
    const firstDepositTimestamp = deposits[0]!.timestamp;
    const lastDepositTimestamp = deposits[deposits.length - 1]!.timestamp;

    const timeSinceFirstDeposit = tradeTimestamp - firstDepositTimestamp;
    const timeSinceLastDeposit = tradeTimestamp - lastDepositTimestamp;

    const timingCategory = this.determineTimingCategory(timeSinceLastDeposit, thresholds);

    const size = parseFloat(firstTrade.size);
    const price = parseFloat(firstTrade.price);

    return {
      tradeId: firstTrade.id,
      timestamp: firstTrade.created_at,
      size,
      sizeUsd: size * price,
      price,
      side: firstTrade.side,
      timeSinceLastDepositSeconds: timeSinceLastDeposit,
      timeSinceFirstDepositSeconds: timeSinceFirstDeposit,
      timingCategory,
    };
  }

  /**
   * Determine timing category based on interval
   */
  private determineTimingCategory(
    intervalSeconds: number | null,
    thresholds: FundingPatternThresholds
  ): FundingTimingCategory {
    if (intervalSeconds === null) {
      return FundingTimingCategory.NO_TRADES;
    }

    if (intervalSeconds < thresholds.flashTimingSeconds) {
      return FundingTimingCategory.FLASH;
    }
    if (intervalSeconds < thresholds.veryFastTimingSeconds) {
      return FundingTimingCategory.VERY_FAST;
    }
    if (intervalSeconds < thresholds.fastTimingSeconds) {
      return FundingTimingCategory.FAST;
    }
    if (intervalSeconds < thresholds.moderateTimingSeconds) {
      return FundingTimingCategory.MODERATE;
    }
    return FundingTimingCategory.SLOW;
  }

  /**
   * Build funding risk summary
   */
  private buildFundingRiskSummary(
    deposits: FundingDeposit[],
    totalAmount: bigint
  ): FundingRiskSummary {
    let hasSanctionedSources = false;
    let hasMixerSources = false;
    let exchangeAmount = 0n;
    let mixerAmount = 0n;
    let unknownAmount = 0n;
    let maxRiskLevel: FundingRiskLevel = "none";
    const exchangeNames = new Set<string>();
    const mixerNames = new Set<string>();
    const uniqueSources = new Set<string>();

    const riskLevelOrder: Record<FundingRiskLevel, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    for (const deposit of deposits) {
      uniqueSources.add(deposit.sourceAddress.toLowerCase());

      if (deposit.isSanctioned) {
        hasSanctionedSources = true;
      }

      if (deposit.isMixer) {
        hasMixerSources = true;
        mixerAmount += deposit.amount;
        if (deposit.sourceName) {
          mixerNames.add(deposit.sourceName);
        }
      } else if (deposit.isExchange) {
        exchangeAmount += deposit.amount;
        if (deposit.sourceName) {
          exchangeNames.add(deposit.sourceName);
        }
      } else {
        unknownAmount += deposit.amount;
      }

      // Track max risk level
      if (riskLevelOrder[deposit.riskLevel] > riskLevelOrder[maxRiskLevel]) {
        maxRiskLevel = deposit.riskLevel;
      }
    }

    const calcPercentage = (amount: bigint): number => {
      if (totalAmount === 0n) return 0;
      return Math.round((Number((amount * 10000n) / totalAmount) / 100) * 100) / 100;
    };

    return {
      overallRiskLevel: maxRiskLevel,
      hasSanctionedSources,
      hasMixerSources,
      exchangePercentage: calcPercentage(exchangeAmount),
      mixerPercentage: calcPercentage(mixerAmount),
      unknownPercentage: calcPercentage(unknownAmount),
      uniqueSourceCount: uniqueSources.size,
      exchangeNames: Array.from(exchangeNames),
      mixerNames: Array.from(mixerNames),
    };
  }

  /**
   * Calculate suspicion score
   */
  private calculateSuspicionScore(
    deposits: FundingDeposit[],
    timingCategory: FundingTimingCategory,
    riskSummary: FundingRiskSummary,
    thresholds: FundingPatternThresholds
  ): { suspicionScore: number; flagReasons: string[] } {
    let score = 0;
    const flagReasons: string[] = [];

    // No deposits means no funding pattern to analyze
    if (deposits.length === 0) {
      return { suspicionScore: 0, flagReasons: [] };
    }

    // Score based on timing
    switch (timingCategory) {
      case FundingTimingCategory.FLASH:
        score += thresholds.flashTimingScore;
        flagReasons.push("Flash trading: Started trading within 5 minutes of funding");
        break;
      case FundingTimingCategory.VERY_FAST:
        score += thresholds.veryFastTimingScore;
        flagReasons.push("Very fast trading: Started trading within 1 hour of funding");
        break;
      case FundingTimingCategory.FAST:
        score += thresholds.fastTimingScore;
        flagReasons.push("Fast trading: Started trading within 24 hours of funding");
        break;
    }

    // Score based on sanctioned sources
    if (riskSummary.hasSanctionedSources) {
      score += thresholds.sanctionedSourceScore;
      flagReasons.push("Sanctioned source: Funds received from sanctioned address");
    }

    // Score based on mixer sources
    if (riskSummary.hasMixerSources) {
      score += thresholds.mixerSourceScore;
      flagReasons.push(`Mixer sources: Funds from ${riskSummary.mixerNames.join(", ")}`);
    }

    // Score for large single deposits
    for (const deposit of deposits) {
      // Estimate USD value (rough - assumes MATIC at ~$0.5-1)
      // In production, you'd want to use proper price data
      const estimatedUsd = Number(deposit.amount) / 1e18;
      if (estimatedUsd >= thresholds.largeDepositThresholdUsd) {
        score += thresholds.singleLargeDepositScore;
        flagReasons.push(
          `Large deposit: ${deposit.formattedAmount} from ${deposit.sourceName ?? deposit.sourceAddress.slice(0, 10)}`
        );
        break; // Only count once
      }
    }

    // Score for multiple quick consecutive deposits
    if (deposits.length >= 2) {
      let quickDepositCount = 0;
      for (let i = 1; i < deposits.length; i++) {
        const timeBetween = deposits[i]!.timestamp - deposits[i - 1]!.timestamp;
        if (timeBetween < thresholds.quickDepositWindowSeconds) {
          quickDepositCount++;
        }
      }
      if (quickDepositCount >= 2) {
        score += thresholds.multipleQuickDepositsScore;
        flagReasons.push(`Multiple quick deposits: ${quickDepositCount + 1} deposits in rapid succession`);
      }
    }

    // High unknown source percentage is suspicious
    if (riskSummary.unknownPercentage >= 80) {
      score += 15;
      flagReasons.push(`High unknown sources: ${riskSummary.unknownPercentage}% from unidentified sources`);
    }

    // Cap score at 100
    return {
      suspicionScore: Math.min(score, 100),
      flagReasons,
    };
  }

  /**
   * Determine pattern type from suspicion score
   */
  private determinePatternType(
    suspicionScore: number,
    thresholds: FundingPatternThresholds
  ): FundingPatternType {
    if (suspicionScore >= thresholds.suspiciousThreshold) {
      return FundingPatternType.SUSPICIOUS;
    }
    if (suspicionScore >= thresholds.immediateThreshold) {
      return FundingPatternType.FLASH;
    }
    if (suspicionScore >= thresholds.quickThreshold) {
      return FundingPatternType.IMMEDIATE;
    }
    if (suspicionScore > 0) {
      return FundingPatternType.QUICK;
    }
    return FundingPatternType.NORMAL;
  }

  /**
   * Determine severity based on pattern and risk
   */
  private determineSeverity(
    patternType: FundingPatternType,
    riskSummary: FundingRiskSummary,
    suspicionScore: number
  ): FreshWalletAlertSeverity {
    // Sanctioned source is always critical
    if (riskSummary.hasSanctionedSources) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    // High suspicion score or suspicious pattern
    if (patternType === FundingPatternType.SUSPICIOUS || suspicionScore >= 70) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    // Flash pattern with mixer sources
    if (patternType === FundingPatternType.FLASH && riskSummary.hasMixerSources) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    // Flash pattern or high suspicion
    if (patternType === FundingPatternType.FLASH || suspicionScore >= 50) {
      return FreshWalletAlertSeverity.HIGH;
    }

    // Immediate pattern or moderate suspicion
    if (patternType === FundingPatternType.IMMEDIATE || suspicionScore >= 30) {
      return FreshWalletAlertSeverity.MEDIUM;
    }

    // Quick pattern with some suspicion
    if (patternType === FundingPatternType.QUICK || suspicionScore > 0) {
      return FreshWalletAlertSeverity.LOW;
    }

    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Format amount for display (assumes 18 decimals)
   */
  private formatAmount(amount: bigint): string {
    const decimals = 18;
    const isNegative = amount < 0n;
    const absAmount = isNegative ? -amount : amount;
    const whole = absAmount / BigInt(10 ** decimals);
    const fraction = absAmount % BigInt(10 ** decimals);
    const fractionStr = fraction.toString().padStart(decimals, "0");

    // Keep 6 decimal places for display
    const trimmedFraction = fractionStr.slice(0, 6);

    const sign = isNegative ? "-" : "";
    return `${sign}${whole}.${trimmedFraction}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(address: string): FundingPatternResult | null {
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
  private setCachedResult(address: string, result: FundingPatternResult): void {
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

let sharedAnalyzer: FundingPatternAnalyzer | null = null;

/**
 * Create a new FundingPatternAnalyzer instance
 */
export function createFundingPatternAnalyzer(
  config?: FundingPatternAnalyzerConfig
): FundingPatternAnalyzer {
  return new FundingPatternAnalyzer(config);
}

/**
 * Get the shared FundingPatternAnalyzer instance
 */
export function getSharedFundingPatternAnalyzer(): FundingPatternAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new FundingPatternAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared FundingPatternAnalyzer instance
 */
export function setSharedFundingPatternAnalyzer(analyzer: FundingPatternAnalyzer): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared FundingPatternAnalyzer instance
 */
export function resetSharedFundingPatternAnalyzer(): void {
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze a wallet's funding pattern (convenience function)
 */
export async function analyzeFundingPattern(
  address: string,
  options?: FundingPatternOptions & { analyzer?: FundingPatternAnalyzer }
): Promise<FundingPatternResult> {
  const analyzer = options?.analyzer ?? getSharedFundingPatternAnalyzer();
  return analyzer.analyzeWallet(address, options);
}

/**
 * Analyze multiple wallets' funding patterns (convenience function)
 */
export async function batchAnalyzeFundingPattern(
  addresses: string[],
  options?: FundingPatternOptions & { analyzer?: FundingPatternAnalyzer }
): Promise<BatchFundingPatternResult> {
  const analyzer = options?.analyzer ?? getSharedFundingPatternAnalyzer();
  return analyzer.analyzeWallets(addresses, options);
}

/**
 * Check if a wallet has suspicious funding pattern (convenience function)
 */
export async function hasSuspiciousFundingPattern(
  address: string,
  options?: FundingPatternOptions & { analyzer?: FundingPatternAnalyzer }
): Promise<boolean> {
  const analyzer = options?.analyzer ?? getSharedFundingPatternAnalyzer();
  return analyzer.hasSuspiciousFundingPattern(address, options);
}

/**
 * Check if a wallet has flash trading pattern (convenience function)
 */
export async function hasFlashTrading(
  address: string,
  options?: FundingPatternOptions & { analyzer?: FundingPatternAnalyzer }
): Promise<boolean> {
  const analyzer = options?.analyzer ?? getSharedFundingPatternAnalyzer();
  return analyzer.hasFlashTrading(address, options);
}

/**
 * Get funding timing category for a wallet (convenience function)
 */
export async function getFundingTimingCategory(
  address: string,
  options?: FundingPatternOptions & { analyzer?: FundingPatternAnalyzer }
): Promise<FundingTimingCategory> {
  const analyzer = options?.analyzer ?? getSharedFundingPatternAnalyzer();
  return analyzer.getFundingTimingCategory(address, options);
}

/**
 * Get summary statistics for funding pattern results (convenience function)
 */
export function getFundingPatternSummary(
  results: FundingPatternResult[],
  analyzer?: FundingPatternAnalyzer
): FundingPatternSummary {
  const a = analyzer ?? getSharedFundingPatternAnalyzer();
  return a.getSummary(results);
}
