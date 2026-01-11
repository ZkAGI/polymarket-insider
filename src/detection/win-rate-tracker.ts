/**
 * Win Rate Tracker (DET-PAT-004)
 *
 * Track historical win rate for each wallet to detect unusually successful traders.
 *
 * Features:
 * - Track resolved positions and calculate win/loss ratio
 * - Track win rate over time with rolling windows
 * - Identify unusually high win rates (potential insider indicator)
 * - Support batch analysis and caching
 * - Event emission for anomaly detection
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Position outcome
 */
export enum PositionOutcome {
  /** Position was a winner */
  WIN = "WIN",
  /** Position was a loser */
  LOSS = "LOSS",
  /** Position broke even */
  BREAKEVEN = "BREAKEVEN",
  /** Position is still open/unresolved */
  PENDING = "PENDING",
}

/**
 * Win rate category based on performance
 */
export enum WinRateCategory {
  /** Very low win rate (< 30%) */
  VERY_LOW = "VERY_LOW",
  /** Low win rate (30-45%) */
  LOW = "LOW",
  /** Average win rate (45-55%) */
  AVERAGE = "AVERAGE",
  /** Above average win rate (55-65%) */
  ABOVE_AVERAGE = "ABOVE_AVERAGE",
  /** High win rate (65-75%) */
  HIGH = "HIGH",
  /** Very high win rate (75-85%) */
  VERY_HIGH = "VERY_HIGH",
  /** Exceptional win rate (85%+) - potential insider */
  EXCEPTIONAL = "EXCEPTIONAL",
  /** Unknown - insufficient data */
  UNKNOWN = "UNKNOWN",
}

/**
 * Suspicion level based on win rate analysis
 */
export enum WinRateSuspicionLevel {
  /** Normal trading performance */
  NONE = "NONE",
  /** Slightly above average */
  LOW = "LOW",
  /** Notable performance */
  MEDIUM = "MEDIUM",
  /** Suspicious performance */
  HIGH = "HIGH",
  /** Very suspicious - likely insider */
  CRITICAL = "CRITICAL",
}

/**
 * Time window for win rate tracking
 */
export enum WinRateWindow {
  /** All time */
  ALL_TIME = "ALL_TIME",
  /** Last 24 hours */
  DAY = "DAY",
  /** Last 7 days */
  WEEK = "WEEK",
  /** Last 30 days */
  MONTH = "MONTH",
  /** Last 90 days */
  QUARTER = "QUARTER",
  /** Last 365 days */
  YEAR = "YEAR",
}

/**
 * Window durations in milliseconds
 */
export const WINDOW_DURATION_MS: Record<WinRateWindow, number> = {
  [WinRateWindow.ALL_TIME]: Infinity,
  [WinRateWindow.DAY]: 24 * 60 * 60 * 1000,
  [WinRateWindow.WEEK]: 7 * 24 * 60 * 60 * 1000,
  [WinRateWindow.MONTH]: 30 * 24 * 60 * 60 * 1000,
  [WinRateWindow.QUARTER]: 90 * 24 * 60 * 60 * 1000,
  [WinRateWindow.YEAR]: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Resolved position data for win rate tracking
 */
export interface ResolvedPosition {
  /** Unique position ID */
  positionId: string;

  /** Market ID */
  marketId: string;

  /** Market category (if known) */
  marketCategory?: MarketCategory | string;

  /** Wallet address */
  walletAddress: string;

  /** Position side (buy/sell) */
  side: "buy" | "sell";

  /** Position size in USD */
  sizeUsd: number;

  /** Entry price (0-1) */
  entryPrice: number;

  /** Exit/resolution price (0-1) */
  exitPrice: number;

  /** Entry timestamp */
  entryTimestamp: Date;

  /** Exit/resolution timestamp */
  exitTimestamp: Date;

  /** Position outcome */
  outcome: PositionOutcome;

  /** Realized P&L in USD (positive = profit, negative = loss) */
  realizedPnl: number;

  /** Return on investment (-1 to infinity) */
  roi: number;

  /** Whether this was a high conviction trade (large relative size) */
  isHighConviction?: boolean;

  /** Time until market resolution (hours) when trade was made */
  timeToResolutionHours?: number;
}

/**
 * Win rate statistics for a time window
 */
export interface WindowStats {
  /** Time window */
  window: WinRateWindow;

  /** Total resolved positions */
  totalPositions: number;

  /** Winning positions */
  wins: number;

  /** Losing positions */
  losses: number;

  /** Breakeven positions */
  breakevens: number;

  /** Win rate as percentage (0-100) */
  winRate: number;

  /** Win rate excluding breakevens */
  winRateExcludingBreakeven: number;

  /** Total profit from wins */
  totalWinProfit: number;

  /** Total loss from losses */
  totalLoss: number;

  /** Net P&L */
  netPnl: number;

  /** Average profit per win */
  avgWinProfit: number;

  /** Average loss per loss */
  avgLoss: number;

  /** Profit factor (total wins / total losses) */
  profitFactor: number;

  /** Average ROI across all positions */
  avgRoi: number;

  /** Start of window */
  windowStart: Date;

  /** End of window (now) */
  windowEnd: Date;
}

/**
 * Category-specific win rate stats
 */
export interface CategoryWinRate {
  /** Market category */
  category: MarketCategory | string;

  /** Total positions in this category */
  totalPositions: number;

  /** Wins in this category */
  wins: number;

  /** Win rate for this category */
  winRate: number;

  /** Net P&L in this category */
  netPnl: number;

  /** Average ROI in this category */
  avgRoi: number;
}

/**
 * Streak information
 */
export interface StreakInfo {
  /** Current streak type (win/loss) */
  currentStreakType: "win" | "loss" | "none";

  /** Current streak length */
  currentStreakLength: number;

  /** Longest win streak ever */
  longestWinStreak: number;

  /** Longest loss streak ever */
  longestLossStreak: number;

  /** Recent streak changes */
  recentStreakChanges: number;
}

/**
 * Time-series win rate data point
 */
export interface WinRateDataPoint {
  /** Date of the data point */
  date: Date;

  /** Win rate at this point (rolling) */
  winRate: number;

  /** Cumulative wins */
  cumulativeWins: number;

  /** Cumulative total */
  cumulativeTotal: number;
}

/**
 * Win rate trend information
 */
export interface WinRateTrend {
  /** Direction of trend */
  direction: "improving" | "declining" | "stable";

  /** Magnitude of change (percentage points) */
  magnitude: number;

  /** Statistical significance (0-1) */
  significance: number;

  /** Recent win rate (last 30% of positions) */
  recentWinRate: number;

  /** Historical win rate (first 70% of positions) */
  historicalWinRate: number;
}

/**
 * Anomaly detected in win rate
 */
export interface WinRateAnomaly {
  /** Type of anomaly */
  type:
    | "exceptional_win_rate"
    | "sudden_improvement"
    | "perfect_timing"
    | "category_specialization"
    | "high_conviction_accuracy"
    | "short_timeframe_accuracy";

  /** Severity (0-100) */
  severity: number;

  /** Description of the anomaly */
  description: string;

  /** Supporting data */
  data: Record<string, unknown>;
}

/**
 * Complete win rate analysis result
 */
export interface WinRateResult {
  /** Wallet address (checksummed) */
  walletAddress: string;

  /** Overall win rate category */
  category: WinRateCategory;

  /** Suspicion level based on analysis */
  suspicionLevel: WinRateSuspicionLevel;

  /** Suspicion score (0-100) */
  suspicionScore: number;

  /** Statistics for each time window */
  windowStats: Record<WinRateWindow, WindowStats>;

  /** Category-specific win rates */
  categoryWinRates: CategoryWinRate[];

  /** Top performing categories */
  topCategories: string[];

  /** Streak information */
  streaks: StreakInfo;

  /** Win rate trend analysis */
  trend: WinRateTrend;

  /** Historical win rate data points */
  history: WinRateDataPoint[];

  /** Detected anomalies */
  anomalies: WinRateAnomaly[];

  /** Total positions analyzed */
  totalPositions: number;

  /** Data quality score (0-100) based on sample size */
  dataQuality: number;

  /** Whether this wallet is flagged as potential insider */
  isPotentialInsider: boolean;

  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Options for win rate analysis
 */
export interface AnalyzeWinRateOptions {
  /** Include historical data points */
  includeHistory?: boolean;

  /** Include category breakdown */
  includeCategoryBreakdown?: boolean;

  /** Include trend analysis */
  includeTrendAnalysis?: boolean;

  /** Minimum positions for valid analysis */
  minPositions?: number;
}

/**
 * Batch analysis result
 */
export interface BatchWinRateResult {
  /** Individual results by wallet address */
  results: Map<string, WinRateResult>;

  /** Wallets that couldn't be analyzed */
  failed: Map<string, Error>;

  /** Total wallets processed */
  totalProcessed: number;

  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Win rate tracker summary
 */
export interface WinRateTrackerSummary {
  /** Total wallets tracked */
  totalWallets: number;

  /** Total positions tracked */
  totalPositions: number;

  /** Wallets with exceptional win rates */
  exceptionalWinRateCount: number;

  /** Wallets flagged as potential insiders */
  potentialInsiderCount: number;

  /** Average win rate across all wallets */
  averageWinRate: number;

  /** Win rate distribution */
  categoryDistribution: Record<WinRateCategory, number>;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Win rate tracker configuration
 */
export interface WinRateTrackerConfig {
  /** Minimum positions required for valid analysis */
  minPositionsForAnalysis: number;

  /** Minimum positions for high confidence */
  minPositionsForHighConfidence: number;

  /** Win rate threshold for exceptional category (percentage) */
  exceptionalWinRateThreshold: number;

  /** Win rate threshold for potential insider flag (percentage) */
  potentialInsiderWinRateThreshold: number;

  /** Minimum high conviction trades for insider flag */
  minHighConvictionForInsider: number;

  /** High conviction win rate threshold (percentage) */
  highConvictionWinRateThreshold: number;

  /** Cache TTL in milliseconds */
  cacheTtl: number;

  /** Maximum positions to store per wallet */
  maxPositionsPerWallet: number;

  /** Enable event emission */
  enableEvents: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_WIN_RATE_CONFIG: WinRateTrackerConfig = {
  minPositionsForAnalysis: 5,
  minPositionsForHighConfidence: 20,
  exceptionalWinRateThreshold: 85,
  potentialInsiderWinRateThreshold: 80,
  minHighConvictionForInsider: 5,
  highConvictionWinRateThreshold: 90,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxPositionsPerWallet: 10000,
  enableEvents: true,
};

/**
 * Win rate category thresholds
 */
export const WIN_RATE_CATEGORY_THRESHOLDS: Record<WinRateCategory, number> = {
  [WinRateCategory.UNKNOWN]: 0,
  [WinRateCategory.VERY_LOW]: 30,
  [WinRateCategory.LOW]: 45,
  [WinRateCategory.AVERAGE]: 55,
  [WinRateCategory.ABOVE_AVERAGE]: 65,
  [WinRateCategory.HIGH]: 75,
  [WinRateCategory.VERY_HIGH]: 85,
  [WinRateCategory.EXCEPTIONAL]: 100,
};

/**
 * Suspicion score weights
 */
const SUSPICION_WEIGHTS = {
  winRate: 0.3,
  highConvictionAccuracy: 0.25,
  categorySpecialization: 0.15,
  trend: 0.1,
  streaks: 0.1,
  anomalyCount: 0.1,
};

// ============================================================================
// Win Rate Tracker Class
// ============================================================================

/**
 * Win Rate Tracker
 *
 * Tracks win/loss records for wallets and identifies unusually successful traders.
 */
export class WinRateTracker extends EventEmitter {
  private config: WinRateTrackerConfig;
  private positions: Map<string, ResolvedPosition[]>; // walletAddress -> positions
  private cache: Map<string, { result: WinRateResult; timestamp: number }>;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<WinRateTrackerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_WIN_RATE_CONFIG, ...config };
    this.positions = new Map();
    this.cache = new Map();
  }

  /**
   * Add a resolved position for a wallet
   */
  addPosition(position: ResolvedPosition): void {
    const address = this.normalizeAddress(position.walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${position.walletAddress}`);
    }

    const normalizedPosition = {
      ...position,
      walletAddress: address,
    };

    let walletPositions = this.positions.get(address);
    if (!walletPositions) {
      walletPositions = [];
      this.positions.set(address, walletPositions);
    }

    // Check if position already exists
    const existingIndex = walletPositions.findIndex(
      (p) => p.positionId === position.positionId
    );
    if (existingIndex >= 0) {
      walletPositions[existingIndex] = normalizedPosition;
    } else {
      walletPositions.push(normalizedPosition);
    }

    // Trim if over limit
    if (walletPositions.length > this.config.maxPositionsPerWallet) {
      walletPositions.sort(
        (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
      );
      walletPositions.splice(
        0,
        walletPositions.length - this.config.maxPositionsPerWallet
      );
    }

    // Invalidate cache for this wallet
    this.cache.delete(address);

    if (this.config.enableEvents) {
      this.emit("position-added", { address, position: normalizedPosition });
    }
  }

  /**
   * Add multiple positions at once
   */
  addPositions(positions: ResolvedPosition[]): void {
    for (const position of positions) {
      this.addPosition(position);
    }
  }

  /**
   * Get positions for a wallet
   */
  getPositions(walletAddress: string): ResolvedPosition[] {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return [];
    return this.positions.get(address) || [];
  }

  /**
   * Clear positions for a wallet
   */
  clearPositions(walletAddress: string): void {
    const address = this.normalizeAddress(walletAddress);
    if (address) {
      this.positions.delete(address);
      this.cache.delete(address);
    }
  }

  /**
   * Analyze win rate for a wallet
   */
  analyze(
    walletAddress: string,
    options: AnalyzeWinRateOptions = {}
  ): WinRateResult {
    const address = this.normalizeAddress(walletAddress);
    if (!address) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    // Check cache
    const cached = this.cache.get(address);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
      this.cacheHits++;
      return cached.result;
    }
    this.cacheMisses++;

    const positions = this.positions.get(address) || [];
    const resolvedPositions = positions.filter(
      (p) => p.outcome !== PositionOutcome.PENDING
    );

    const result = this.computeWinRate(address, resolvedPositions, options);

    // Cache result
    this.cache.set(address, { result, timestamp: Date.now() });

    if (this.config.enableEvents) {
      this.emit("analysis-complete", { address, result });

      if (result.isPotentialInsider) {
        this.emit("potential-insider", { address, result });
      }
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    walletAddresses: string[],
    options: AnalyzeWinRateOptions = {}
  ): BatchWinRateResult {
    const results = new Map<string, WinRateResult>();
    const failed = new Map<string, Error>();

    for (const address of walletAddresses) {
      try {
        const result = this.analyze(address, options);
        results.set(result.walletAddress, result);
      } catch (error) {
        failed.set(address, error as Error);
      }
    }

    return {
      results,
      failed,
      totalProcessed: walletAddresses.length,
      processedAt: new Date(),
    };
  }

  /**
   * Check if wallet has unusually high win rate
   */
  hasUnusuallyHighWinRate(walletAddress: string): boolean {
    try {
      const result = this.analyze(walletAddress);
      return result.suspicionLevel === WinRateSuspicionLevel.HIGH ||
        result.suspicionLevel === WinRateSuspicionLevel.CRITICAL;
    } catch {
      return false;
    }
  }

  /**
   * Get wallets with high win rates
   */
  getHighWinRateWallets(minWinRate: number = 70): WinRateResult[] {
    const results: WinRateResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        const allTimeStats = result.windowStats[WinRateWindow.ALL_TIME];
        if (allTimeStats && allTimeStats.winRate >= minWinRate) {
          results.push(result);
        }
      } catch {
        // Skip invalid wallets
      }
    }
    return results.sort(
      (a, b) =>
        b.windowStats[WinRateWindow.ALL_TIME].winRate -
        a.windowStats[WinRateWindow.ALL_TIME].winRate
    );
  }

  /**
   * Get potential insider wallets
   */
  getPotentialInsiders(): WinRateResult[] {
    const results: WinRateResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        if (result.isPotentialInsider) {
          results.push(result);
        }
      } catch {
        // Skip invalid wallets
      }
    }
    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get summary statistics
   */
  getSummary(): WinRateTrackerSummary {
    const categoryDistribution: Record<WinRateCategory, number> = {
      [WinRateCategory.UNKNOWN]: 0,
      [WinRateCategory.VERY_LOW]: 0,
      [WinRateCategory.LOW]: 0,
      [WinRateCategory.AVERAGE]: 0,
      [WinRateCategory.ABOVE_AVERAGE]: 0,
      [WinRateCategory.HIGH]: 0,
      [WinRateCategory.VERY_HIGH]: 0,
      [WinRateCategory.EXCEPTIONAL]: 0,
    };

    let totalPositions = 0;
    let totalWinRate = 0;
    let validWallets = 0;
    let exceptionalCount = 0;
    let potentialInsiderCount = 0;

    for (const address of this.positions.keys()) {
      const positions = this.positions.get(address) || [];
      totalPositions += positions.length;

      try {
        const result = this.analyze(address);
        categoryDistribution[result.category]++;
        if (
          result.totalPositions >= this.config.minPositionsForAnalysis
        ) {
          totalWinRate +=
            result.windowStats[WinRateWindow.ALL_TIME]?.winRate || 0;
          validWallets++;
        }
        if (result.category === WinRateCategory.EXCEPTIONAL) {
          exceptionalCount++;
        }
        if (result.isPotentialInsider) {
          potentialInsiderCount++;
        }
      } catch {
        categoryDistribution[WinRateCategory.UNKNOWN]++;
      }
    }

    return {
      totalWallets: this.positions.size,
      totalPositions,
      exceptionalWinRateCount: exceptionalCount,
      potentialInsiderCount,
      averageWinRate: validWallets > 0 ? totalWinRate / validWallets : 0,
      categoryDistribution,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.positions.clear();
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private normalizeAddress(address: string): string | null {
    try {
      if (!isAddress(address)) return null;
      return getAddress(address);
    } catch {
      return null;
    }
  }

  private computeWinRate(
    walletAddress: string,
    positions: ResolvedPosition[],
    options: AnalyzeWinRateOptions
  ): WinRateResult {
    const {
      includeHistory = true,
      includeCategoryBreakdown = true,
      includeTrendAnalysis = true,
      minPositions = this.config.minPositionsForAnalysis,
    } = options;

    // Calculate window stats for each time window
    const windowStats = this.calculateWindowStats(positions);

    // Calculate category breakdown
    const categoryWinRates = includeCategoryBreakdown
      ? this.calculateCategoryWinRates(positions)
      : [];

    // Get top categories
    const topCategories = categoryWinRates
      .filter((c) => c.totalPositions >= 3)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5)
      .map((c) => c.category as string);

    // Calculate streaks
    const streaks = this.calculateStreaks(positions);

    // Calculate trend
    const trend = includeTrendAnalysis
      ? this.calculateTrend(positions)
      : {
          direction: "stable" as const,
          magnitude: 0,
          significance: 0,
          recentWinRate: 0,
          historicalWinRate: 0,
        };

    // Calculate history
    const history = includeHistory
      ? this.calculateHistory(positions)
      : [];

    // Detect anomalies
    const anomalies = this.detectAnomalies(
      positions,
      windowStats,
      categoryWinRates,
      streaks,
      trend
    );

    // Determine category
    const allTimeStats = windowStats[WinRateWindow.ALL_TIME];
    const category = this.determineCategory(
      allTimeStats.winRate,
      positions.length,
      minPositions
    );

    // Calculate suspicion
    const { suspicionLevel, suspicionScore, isPotentialInsider } =
      this.calculateSuspicion(
        positions,
        allTimeStats,
        categoryWinRates,
        trend,
        streaks,
        anomalies
      );

    // Calculate data quality
    const dataQuality = this.calculateDataQuality(positions.length);

    return {
      walletAddress,
      category,
      suspicionLevel,
      suspicionScore,
      windowStats,
      categoryWinRates,
      topCategories,
      streaks,
      trend,
      history,
      anomalies,
      totalPositions: positions.length,
      dataQuality,
      isPotentialInsider,
      analyzedAt: new Date(),
    };
  }

  private calculateWindowStats(
    positions: ResolvedPosition[]
  ): Record<WinRateWindow, WindowStats> {
    const now = new Date();
    const result: Record<WinRateWindow, WindowStats> = {} as Record<
      WinRateWindow,
      WindowStats
    >;

    for (const window of Object.values(WinRateWindow)) {
      const duration = WINDOW_DURATION_MS[window];
      const windowStart = new Date(
        duration === Infinity ? 0 : now.getTime() - duration
      );

      const windowPositions = positions.filter(
        (p) => p.exitTimestamp >= windowStart
      );

      const wins = windowPositions.filter(
        (p) => p.outcome === PositionOutcome.WIN
      );
      const losses = windowPositions.filter(
        (p) => p.outcome === PositionOutcome.LOSS
      );
      const breakevens = windowPositions.filter(
        (p) => p.outcome === PositionOutcome.BREAKEVEN
      );

      const totalWinProfit = wins.reduce(
        (sum, p) => sum + Math.max(0, p.realizedPnl),
        0
      );
      const totalLoss = Math.abs(
        losses.reduce((sum, p) => sum + Math.min(0, p.realizedPnl), 0)
      );
      const netPnl = windowPositions.reduce((sum, p) => sum + p.realizedPnl, 0);

      const winRate =
        windowPositions.length > 0
          ? (wins.length / windowPositions.length) * 100
          : 0;

      const decisivePositions = wins.length + losses.length;
      const winRateExcludingBreakeven =
        decisivePositions > 0 ? (wins.length / decisivePositions) * 100 : 0;

      const avgRoi =
        windowPositions.length > 0
          ? windowPositions.reduce((sum, p) => sum + p.roi, 0) /
            windowPositions.length
          : 0;

      result[window] = {
        window,
        totalPositions: windowPositions.length,
        wins: wins.length,
        losses: losses.length,
        breakevens: breakevens.length,
        winRate,
        winRateExcludingBreakeven,
        totalWinProfit,
        totalLoss,
        netPnl,
        avgWinProfit: wins.length > 0 ? totalWinProfit / wins.length : 0,
        avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
        profitFactor: totalLoss > 0 ? totalWinProfit / totalLoss : totalWinProfit > 0 ? Infinity : 0,
        avgRoi,
        windowStart,
        windowEnd: now,
      };
    }

    return result;
  }

  private calculateCategoryWinRates(
    positions: ResolvedPosition[]
  ): CategoryWinRate[] {
    const categoryMap = new Map<
      string,
      { wins: number; total: number; pnl: number; roi: number }
    >();

    for (const position of positions) {
      const category = position.marketCategory || "unknown";
      let stats = categoryMap.get(category);
      if (!stats) {
        stats = { wins: 0, total: 0, pnl: 0, roi: 0 };
        categoryMap.set(category, stats);
      }

      stats.total++;
      stats.pnl += position.realizedPnl;
      stats.roi += position.roi;
      if (position.outcome === PositionOutcome.WIN) {
        stats.wins++;
      }
    }

    const result: CategoryWinRate[] = [];
    for (const [category, stats] of categoryMap) {
      result.push({
        category,
        totalPositions: stats.total,
        wins: stats.wins,
        winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        netPnl: stats.pnl,
        avgRoi: stats.total > 0 ? stats.roi / stats.total : 0,
      });
    }

    return result.sort((a, b) => b.totalPositions - a.totalPositions);
  }

  private calculateStreaks(positions: ResolvedPosition[]): StreakInfo {
    if (positions.length === 0) {
      return {
        currentStreakType: "none",
        currentStreakLength: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        recentStreakChanges: 0,
      };
    }

    // Sort by exit timestamp
    const sorted = [...positions].sort(
      (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
    );

    let currentStreakType: "win" | "loss" | "none" = "none";
    let currentStreakLength = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let streakChanges = 0;
    let lastOutcome: PositionOutcome | null = null;

    for (const position of sorted) {
      if (position.outcome === PositionOutcome.BREAKEVEN) continue;

      if (position.outcome === PositionOutcome.WIN) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (lastOutcome === PositionOutcome.LOSS) streakChanges++;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (position.outcome === PositionOutcome.LOSS) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (lastOutcome === PositionOutcome.WIN) streakChanges++;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }

      lastOutcome = position.outcome;
    }

    if (currentWinStreak > 0) {
      currentStreakType = "win";
      currentStreakLength = currentWinStreak;
    } else if (currentLossStreak > 0) {
      currentStreakType = "loss";
      currentStreakLength = currentLossStreak;
    }

    // Count recent streak changes (last 20 positions)
    const recentPositions = sorted.slice(-20);
    let recentStreakChanges = 0;
    let prevOutcome: PositionOutcome | null = null;
    for (const p of recentPositions) {
      if (p.outcome === PositionOutcome.BREAKEVEN) continue;
      if (prevOutcome !== null && prevOutcome !== p.outcome) {
        recentStreakChanges++;
      }
      prevOutcome = p.outcome;
    }

    return {
      currentStreakType,
      currentStreakLength,
      longestWinStreak,
      longestLossStreak,
      recentStreakChanges,
    };
  }

  private calculateTrend(positions: ResolvedPosition[]): WinRateTrend {
    if (positions.length < 10) {
      return {
        direction: "stable",
        magnitude: 0,
        significance: 0,
        recentWinRate: 0,
        historicalWinRate: 0,
      };
    }

    // Sort by exit timestamp
    const sorted = [...positions].sort(
      (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
    );

    // Split into historical (first 70%) and recent (last 30%)
    const splitIndex = Math.floor(sorted.length * 0.7);
    const historical = sorted.slice(0, splitIndex);
    const recent = sorted.slice(splitIndex);

    const historicalWins = historical.filter(
      (p) => p.outcome === PositionOutcome.WIN
    ).length;
    const recentWins = recent.filter(
      (p) => p.outcome === PositionOutcome.WIN
    ).length;

    const historicalWinRate =
      historical.length > 0 ? (historicalWins / historical.length) * 100 : 0;
    const recentWinRate =
      recent.length > 0 ? (recentWins / recent.length) * 100 : 0;

    const magnitude = Math.abs(recentWinRate - historicalWinRate);

    // Simple significance based on sample size and magnitude
    const minSample = Math.min(historical.length, recent.length);
    const significance = Math.min(
      1,
      (minSample / 20) * (magnitude / 20)
    );

    let direction: "improving" | "declining" | "stable";
    if (recentWinRate > historicalWinRate + 5) {
      direction = "improving";
    } else if (recentWinRate < historicalWinRate - 5) {
      direction = "declining";
    } else {
      direction = "stable";
    }

    return {
      direction,
      magnitude,
      significance,
      recentWinRate,
      historicalWinRate,
    };
  }

  private calculateHistory(positions: ResolvedPosition[]): WinRateDataPoint[] {
    if (positions.length === 0) return [];

    const sorted = [...positions].sort(
      (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
    );

    const history: WinRateDataPoint[] = [];
    let cumulativeWins = 0;

    for (let i = 0; i < sorted.length; i++) {
      const position = sorted[i];
      if (!position) continue;

      if (position.outcome === PositionOutcome.WIN) {
        cumulativeWins++;
      }
      const cumulativeTotal = i + 1;
      const winRate = (cumulativeWins / cumulativeTotal) * 100;

      history.push({
        date: position.exitTimestamp,
        winRate,
        cumulativeWins,
        cumulativeTotal,
      });
    }

    return history;
  }

  private detectAnomalies(
    positions: ResolvedPosition[],
    windowStats: Record<WinRateWindow, WindowStats>,
    categoryWinRates: CategoryWinRate[],
    streaks: StreakInfo,
    trend: WinRateTrend
  ): WinRateAnomaly[] {
    const anomalies: WinRateAnomaly[] = [];
    const allTimeStats = windowStats[WinRateWindow.ALL_TIME];

    // Exceptional overall win rate
    if (
      allTimeStats.winRate >= this.config.exceptionalWinRateThreshold &&
      allTimeStats.totalPositions >= this.config.minPositionsForAnalysis
    ) {
      anomalies.push({
        type: "exceptional_win_rate",
        severity: Math.min(
          100,
          (allTimeStats.winRate - this.config.exceptionalWinRateThreshold) * 5 +
            50
        ),
        description: `Exceptionally high win rate of ${allTimeStats.winRate.toFixed(1)}% across ${allTimeStats.totalPositions} positions`,
        data: {
          winRate: allTimeStats.winRate,
          totalPositions: allTimeStats.totalPositions,
        },
      });
    }

    // Sudden improvement in win rate
    if (
      trend.direction === "improving" &&
      trend.magnitude > 15 &&
      trend.significance > 0.5
    ) {
      anomalies.push({
        type: "sudden_improvement",
        severity: Math.min(100, trend.magnitude * 2 + trend.significance * 30),
        description: `Win rate improved significantly from ${trend.historicalWinRate.toFixed(1)}% to ${trend.recentWinRate.toFixed(1)}%`,
        data: {
          historicalWinRate: trend.historicalWinRate,
          recentWinRate: trend.recentWinRate,
          magnitude: trend.magnitude,
        },
      });
    }

    // High conviction accuracy
    const highConvictionPositions = positions.filter((p) => p.isHighConviction);
    if (highConvictionPositions.length >= 5) {
      const hcWins = highConvictionPositions.filter(
        (p) => p.outcome === PositionOutcome.WIN
      ).length;
      const hcWinRate = (hcWins / highConvictionPositions.length) * 100;

      if (hcWinRate >= this.config.highConvictionWinRateThreshold) {
        anomalies.push({
          type: "high_conviction_accuracy",
          severity: Math.min(
            100,
            (hcWinRate - this.config.highConvictionWinRateThreshold) * 3 + 60
          ),
          description: `High conviction trades have ${hcWinRate.toFixed(1)}% win rate across ${highConvictionPositions.length} trades`,
          data: {
            highConvictionWinRate: hcWinRate,
            highConvictionCount: highConvictionPositions.length,
          },
        });
      }
    }

    // Category specialization with high win rate
    for (const catStats of categoryWinRates) {
      if (catStats.totalPositions >= 5 && catStats.winRate >= 80) {
        anomalies.push({
          type: "category_specialization",
          severity: Math.min(100, (catStats.winRate - 70) * 3 + 30),
          description: `High win rate of ${catStats.winRate.toFixed(1)}% in ${catStats.category} category (${catStats.totalPositions} positions)`,
          data: {
            category: catStats.category,
            winRate: catStats.winRate,
            positions: catStats.totalPositions,
          },
        });
      }
    }

    // Perfect timing - trades close to resolution with high win rate
    const shortTimeframePositions = positions.filter(
      (p) =>
        p.timeToResolutionHours !== undefined && p.timeToResolutionHours <= 24
    );
    if (shortTimeframePositions.length >= 5) {
      const stfWins = shortTimeframePositions.filter(
        (p) => p.outcome === PositionOutcome.WIN
      ).length;
      const stfWinRate = (stfWins / shortTimeframePositions.length) * 100;

      if (stfWinRate >= 80) {
        anomalies.push({
          type: "short_timeframe_accuracy",
          severity: Math.min(100, (stfWinRate - 70) * 3 + 50),
          description: `${stfWinRate.toFixed(1)}% win rate on trades made within 24 hours of resolution (${shortTimeframePositions.length} positions)`,
          data: {
            shortTimeframeWinRate: stfWinRate,
            shortTimeframeCount: shortTimeframePositions.length,
          },
        });
      }
    }

    // Very long win streak
    if (streaks.longestWinStreak >= 10) {
      anomalies.push({
        type: "perfect_timing",
        severity: Math.min(100, streaks.longestWinStreak * 5),
        description: `Longest win streak of ${streaks.longestWinStreak} consecutive wins`,
        data: {
          longestWinStreak: streaks.longestWinStreak,
        },
      });
    }

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  private determineCategory(
    winRate: number,
    totalPositions: number,
    minPositions: number
  ): WinRateCategory {
    if (totalPositions < minPositions) {
      return WinRateCategory.UNKNOWN;
    }

    if (winRate >= 85) return WinRateCategory.EXCEPTIONAL;
    if (winRate >= 75) return WinRateCategory.VERY_HIGH;
    if (winRate >= 65) return WinRateCategory.HIGH;
    if (winRate >= 55) return WinRateCategory.ABOVE_AVERAGE;
    if (winRate >= 45) return WinRateCategory.AVERAGE;
    if (winRate >= 30) return WinRateCategory.LOW;
    return WinRateCategory.VERY_LOW;
  }

  private calculateSuspicion(
    positions: ResolvedPosition[],
    allTimeStats: WindowStats,
    categoryWinRates: CategoryWinRate[],
    trend: WinRateTrend,
    streaks: StreakInfo,
    anomalies: WinRateAnomaly[]
  ): {
    suspicionLevel: WinRateSuspicionLevel;
    suspicionScore: number;
    isPotentialInsider: boolean;
  } {
    if (positions.length < this.config.minPositionsForAnalysis) {
      return {
        suspicionLevel: WinRateSuspicionLevel.NONE,
        suspicionScore: 0,
        isPotentialInsider: false,
      };
    }

    // Calculate component scores
    let winRateScore = 0;
    if (allTimeStats.winRate >= 90) winRateScore = 100;
    else if (allTimeStats.winRate >= 80) winRateScore = 70;
    else if (allTimeStats.winRate >= 70) winRateScore = 40;
    else if (allTimeStats.winRate >= 60) winRateScore = 20;

    // High conviction accuracy score
    let hcScore = 0;
    const hcPositions = positions.filter((p) => p.isHighConviction);
    if (hcPositions.length >= 5) {
      const hcWins = hcPositions.filter(
        (p) => p.outcome === PositionOutcome.WIN
      ).length;
      const hcWinRate = (hcWins / hcPositions.length) * 100;
      if (hcWinRate >= 90) hcScore = 100;
      else if (hcWinRate >= 80) hcScore = 60;
      else if (hcWinRate >= 70) hcScore = 30;
    }

    // Category specialization score
    let catScore = 0;
    const topCatWinRates = categoryWinRates
      .filter((c) => c.totalPositions >= 5)
      .map((c) => c.winRate);
    if (topCatWinRates.some((wr) => wr >= 85)) catScore = 80;
    else if (topCatWinRates.some((wr) => wr >= 75)) catScore = 50;
    else if (topCatWinRates.some((wr) => wr >= 65)) catScore = 25;

    // Trend score
    let trendScore = 0;
    if (trend.direction === "improving" && trend.magnitude > 20) {
      trendScore = Math.min(80, trend.magnitude * 2);
    }

    // Streak score
    let streakScore = 0;
    if (streaks.longestWinStreak >= 15) streakScore = 80;
    else if (streaks.longestWinStreak >= 10) streakScore = 50;
    else if (streaks.longestWinStreak >= 7) streakScore = 25;

    // Anomaly score
    const anomalyScore = Math.min(
      100,
      anomalies.reduce((sum, a) => sum + a.severity, 0) / 3
    );

    // Weighted total
    const suspicionScore =
      winRateScore * SUSPICION_WEIGHTS.winRate +
      hcScore * SUSPICION_WEIGHTS.highConvictionAccuracy +
      catScore * SUSPICION_WEIGHTS.categorySpecialization +
      trendScore * SUSPICION_WEIGHTS.trend +
      streakScore * SUSPICION_WEIGHTS.streaks +
      anomalyScore * SUSPICION_WEIGHTS.anomalyCount;

    // Determine level
    let suspicionLevel: WinRateSuspicionLevel;
    if (suspicionScore >= 80) suspicionLevel = WinRateSuspicionLevel.CRITICAL;
    else if (suspicionScore >= 60) suspicionLevel = WinRateSuspicionLevel.HIGH;
    else if (suspicionScore >= 40) suspicionLevel = WinRateSuspicionLevel.MEDIUM;
    else if (suspicionScore >= 20) suspicionLevel = WinRateSuspicionLevel.LOW;
    else suspicionLevel = WinRateSuspicionLevel.NONE;

    // Determine if potential insider
    const isPotentialInsider =
      allTimeStats.winRate >= this.config.potentialInsiderWinRateThreshold &&
      positions.length >= this.config.minPositionsForHighConfidence;

    // Also flag if high conviction accuracy is very high
    const hcWins = hcPositions.filter(
      (p) => p.outcome === PositionOutcome.WIN
    ).length;
    const hcWinRate =
      hcPositions.length > 0 ? (hcWins / hcPositions.length) * 100 : 0;
    const hasHighConvictionInsiderPattern =
      hcPositions.length >= this.config.minHighConvictionForInsider &&
      hcWinRate >= this.config.highConvictionWinRateThreshold;

    return {
      suspicionLevel,
      suspicionScore: Math.round(suspicionScore),
      isPotentialInsider: isPotentialInsider || hasHighConvictionInsiderPattern,
    };
  }

  private calculateDataQuality(positionCount: number): number {
    if (positionCount >= 100) return 100;
    if (positionCount >= 50) return 80;
    if (positionCount >= 20) return 60;
    if (positionCount >= 10) return 40;
    if (positionCount >= 5) return 20;
    return 0;
  }
}

// ============================================================================
// Factory and Convenience Functions
// ============================================================================

/**
 * Create a new WinRateTracker instance
 */
export function createWinRateTracker(
  config?: Partial<WinRateTrackerConfig>
): WinRateTracker {
  return new WinRateTracker(config);
}

// Shared instance
let sharedTracker: WinRateTracker | null = null;

/**
 * Get the shared WinRateTracker instance
 */
export function getSharedWinRateTracker(): WinRateTracker {
  if (!sharedTracker) {
    sharedTracker = new WinRateTracker();
  }
  return sharedTracker;
}

/**
 * Set the shared WinRateTracker instance
 */
export function setSharedWinRateTracker(tracker: WinRateTracker): void {
  sharedTracker = tracker;
}

/**
 * Reset the shared WinRateTracker instance
 */
export function resetSharedWinRateTracker(): void {
  sharedTracker = null;
}

/**
 * Add a position to the shared tracker
 */
export function addPositionForWinRate(position: ResolvedPosition): void {
  getSharedWinRateTracker().addPosition(position);
}

/**
 * Add multiple positions to the shared tracker
 */
export function addPositionsForWinRate(positions: ResolvedPosition[]): void {
  getSharedWinRateTracker().addPositions(positions);
}

/**
 * Analyze win rate for a wallet using the shared tracker
 */
export function analyzeWinRate(
  walletAddress: string,
  options?: AnalyzeWinRateOptions
): WinRateResult {
  return getSharedWinRateTracker().analyze(walletAddress, options);
}

/**
 * Batch analyze win rates using the shared tracker
 */
export function batchAnalyzeWinRates(
  walletAddresses: string[],
  options?: AnalyzeWinRateOptions
): BatchWinRateResult {
  return getSharedWinRateTracker().batchAnalyze(walletAddresses, options);
}

/**
 * Check if wallet has unusually high win rate
 */
export function hasUnusuallyHighWinRate(walletAddress: string): boolean {
  return getSharedWinRateTracker().hasUnusuallyHighWinRate(walletAddress);
}

/**
 * Get wallets with high win rates
 */
export function getHighWinRateWallets(
  minWinRate?: number
): WinRateResult[] {
  return getSharedWinRateTracker().getHighWinRateWallets(minWinRate);
}

/**
 * Get potential insider wallets
 */
export function getPotentialInsidersByWinRate(): WinRateResult[] {
  return getSharedWinRateTracker().getPotentialInsiders();
}

/**
 * Get win rate tracker summary
 */
export function getWinRateTrackerSummary(): WinRateTrackerSummary {
  return getSharedWinRateTracker().getSummary();
}

/**
 * Get win rate category description
 */
export function getWinRateCategoryDescription(
  category: WinRateCategory
): string {
  switch (category) {
    case WinRateCategory.UNKNOWN:
      return "Unknown - insufficient data for analysis";
    case WinRateCategory.VERY_LOW:
      return "Very low win rate (below 30%)";
    case WinRateCategory.LOW:
      return "Low win rate (30-45%)";
    case WinRateCategory.AVERAGE:
      return "Average win rate (45-55%)";
    case WinRateCategory.ABOVE_AVERAGE:
      return "Above average win rate (55-65%)";
    case WinRateCategory.HIGH:
      return "High win rate (65-75%)";
    case WinRateCategory.VERY_HIGH:
      return "Very high win rate (75-85%)";
    case WinRateCategory.EXCEPTIONAL:
      return "Exceptional win rate (85%+) - potential insider";
  }
}

/**
 * Get suspicion level description
 */
export function getWinRateSuspicionDescription(
  level: WinRateSuspicionLevel
): string {
  switch (level) {
    case WinRateSuspicionLevel.NONE:
      return "No suspicious patterns detected";
    case WinRateSuspicionLevel.LOW:
      return "Slightly above average performance";
    case WinRateSuspicionLevel.MEDIUM:
      return "Notable performance worth monitoring";
    case WinRateSuspicionLevel.HIGH:
      return "Suspicious performance patterns";
    case WinRateSuspicionLevel.CRITICAL:
      return "Highly suspicious - likely insider activity";
  }
}
