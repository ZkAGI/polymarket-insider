/**
 * Profit/Loss Calculator (DET-PAT-005)
 *
 * Calculate realized and unrealized P&L for wallets to identify successful traders.
 *
 * Features:
 * - Track position costs and sizes
 * - Calculate realized gains from closed positions
 * - Calculate unrealized gains from open positions
 * - Aggregate total P&L across all positions
 * - Support for time-based analysis and category breakdowns
 * - Event emission for significant P&L events
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Position status
 */
export enum PositionStatus {
  /** Position is currently open */
  OPEN = "OPEN",
  /** Position has been closed */
  CLOSED = "CLOSED",
  /** Position expired worthless */
  EXPIRED = "EXPIRED",
  /** Position was liquidated */
  LIQUIDATED = "LIQUIDATED",
}

/**
 * P&L direction
 */
export enum PnlDirection {
  /** Profitable */
  PROFIT = "PROFIT",
  /** Loss */
  LOSS = "LOSS",
  /** Breakeven */
  BREAKEVEN = "BREAKEVEN",
}

/**
 * P&L tier for categorizing performance
 */
export enum PnlTier {
  /** Massive loss (< -50%) */
  MASSIVE_LOSS = "MASSIVE_LOSS",
  /** Large loss (-50% to -25%) */
  LARGE_LOSS = "LARGE_LOSS",
  /** Moderate loss (-25% to -10%) */
  MODERATE_LOSS = "MODERATE_LOSS",
  /** Small loss (-10% to 0%) */
  SMALL_LOSS = "SMALL_LOSS",
  /** Breakeven (0% ± 1%) */
  BREAKEVEN = "BREAKEVEN",
  /** Small profit (0% to 25%) */
  SMALL_PROFIT = "SMALL_PROFIT",
  /** Moderate profit (25% to 50%) */
  MODERATE_PROFIT = "MODERATE_PROFIT",
  /** Large profit (50% to 100%) */
  LARGE_PROFIT = "LARGE_PROFIT",
  /** Massive profit (> 100%) */
  MASSIVE_PROFIT = "MASSIVE_PROFIT",
  /** Unknown (insufficient data) */
  UNKNOWN = "UNKNOWN",
}

/**
 * Suspicion level based on P&L patterns
 */
export enum PnlSuspicionLevel {
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
 * Time window for P&L analysis
 */
export enum PnlWindow {
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
export const PNL_WINDOW_DURATION_MS: Record<PnlWindow, number> = {
  [PnlWindow.ALL_TIME]: Infinity,
  [PnlWindow.DAY]: 24 * 60 * 60 * 1000,
  [PnlWindow.WEEK]: 7 * 24 * 60 * 60 * 1000,
  [PnlWindow.MONTH]: 30 * 24 * 60 * 60 * 1000,
  [PnlWindow.QUARTER]: 90 * 24 * 60 * 60 * 1000,
  [PnlWindow.YEAR]: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Position entry for P&L tracking
 */
export interface PnlPosition {
  /** Unique position ID */
  positionId: string;

  /** Market ID */
  marketId: string;

  /** Market title (optional) */
  marketTitle?: string;

  /** Market category (if known) */
  marketCategory?: MarketCategory | string;

  /** Wallet address */
  walletAddress: string;

  /** Position side */
  side: "buy" | "sell";

  /** Total shares/contracts */
  shares: number;

  /** Entry price (0-1 for binary markets) */
  entryPrice: number;

  /** Current price (for open positions) */
  currentPrice?: number;

  /** Exit price (for closed positions) */
  exitPrice?: number;

  /** Cost basis in USD */
  costBasis: number;

  /** Current market value (for open positions) */
  currentValue?: number;

  /** Exit value (for closed positions) */
  exitValue?: number;

  /** Position status */
  status: PositionStatus;

  /** Entry timestamp */
  entryTimestamp: Date;

  /** Exit timestamp (for closed positions) */
  exitTimestamp?: Date;

  /** Trading fees paid */
  fees: number;

  /** Was this a high conviction trade */
  isHighConviction?: boolean;
}

/**
 * Realized P&L for a closed position
 */
export interface RealizedPnl {
  /** Position ID */
  positionId: string;

  /** Market ID */
  marketId: string;

  /** Cost basis */
  costBasis: number;

  /** Exit value */
  exitValue: number;

  /** Realized P&L (exitValue - costBasis - fees) */
  realizedPnl: number;

  /** Return on investment percentage */
  roi: number;

  /** P&L direction */
  direction: PnlDirection;

  /** Holding period in milliseconds */
  holdingPeriod: number;

  /** Exit timestamp */
  exitTimestamp: Date;

  /** Fees paid */
  fees: number;
}

/**
 * Unrealized P&L for an open position
 */
export interface UnrealizedPnl {
  /** Position ID */
  positionId: string;

  /** Market ID */
  marketId: string;

  /** Cost basis */
  costBasis: number;

  /** Current market value */
  currentValue: number;

  /** Unrealized P&L (currentValue - costBasis) */
  unrealizedPnl: number;

  /** Unrealized ROI percentage */
  unrealizedRoi: number;

  /** P&L direction */
  direction: PnlDirection;

  /** Time in position in milliseconds */
  timeInPosition: number;

  /** Last price update timestamp */
  lastUpdated: Date;
}

/**
 * P&L statistics for a time window
 */
export interface WindowPnlStats {
  /** Time window */
  window: PnlWindow;

  /** Total realized P&L */
  totalRealizedPnl: number;

  /** Total unrealized P&L */
  totalUnrealizedPnl: number;

  /** Combined P&L */
  totalPnl: number;

  /** Total cost basis of all positions */
  totalCostBasis: number;

  /** Total gross profit (sum of winning trades) */
  grossProfit: number;

  /** Total gross loss (sum of losing trades) */
  grossLoss: number;

  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;

  /** Average realized ROI */
  avgRealizedRoi: number;

  /** Total fees paid */
  totalFees: number;

  /** Number of closed positions */
  closedPositions: number;

  /** Number of open positions */
  openPositions: number;

  /** Number of profitable positions */
  profitablePositions: number;

  /** Number of losing positions */
  losingPositions: number;

  /** Largest single profit */
  largestProfit: number;

  /** Largest single loss */
  largestLoss: number;

  /** Average profit on winning trades */
  avgProfit: number;

  /** Average loss on losing trades */
  avgLoss: number;

  /** Expected value per trade */
  expectedValue: number;

  /** Sharpe-like ratio (avg return / std dev) */
  riskAdjustedReturn: number;

  /** Maximum drawdown */
  maxDrawdown: number;

  /** Window start */
  windowStart: Date;

  /** Window end */
  windowEnd: Date;
}

/**
 * Category-specific P&L stats
 */
export interface CategoryPnlStats {
  /** Market category */
  category: MarketCategory | string;

  /** Total positions in this category */
  totalPositions: number;

  /** Total realized P&L in this category */
  realizedPnl: number;

  /** Total unrealized P&L in this category */
  unrealizedPnl: number;

  /** Average ROI in this category */
  avgRoi: number;

  /** Win rate in this category (closed positions only) */
  winRate: number;

  /** Profit factor in this category */
  profitFactor: number;
}

/**
 * P&L data point for time series
 */
export interface PnlDataPoint {
  /** Date of data point */
  date: Date;

  /** Cumulative realized P&L */
  cumulativeRealizedPnl: number;

  /** Cumulative ROI */
  cumulativeRoi: number;

  /** Number of positions closed to date */
  positionsClosed: number;

  /** Daily P&L (if available) */
  dailyPnl?: number;
}

/**
 * P&L trend information
 */
export interface PnlTrend {
  /** Direction of trend */
  direction: "improving" | "declining" | "stable";

  /** Magnitude of change in P&L */
  magnitude: number;

  /** Recent ROI (last 30% of positions) */
  recentRoi: number;

  /** Historical ROI (first 70% of positions) */
  historicalRoi: number;

  /** Streak - consecutive profit or loss days */
  profitStreak: number;

  /** Whether currently on a winning streak */
  onWinningStreak: boolean;
}

/**
 * P&L anomaly
 */
export interface PnlAnomaly {
  /** Type of anomaly */
  type:
    | "exceptional_returns"
    | "consistent_profitability"
    | "perfect_timing"
    | "category_expertise"
    | "low_variance"
    | "suspicious_pattern";

  /** Severity (0-100) */
  severity: number;

  /** Description */
  description: string;

  /** Supporting data */
  data: Record<string, unknown>;
}

/**
 * Complete P&L analysis result
 */
export interface PnlResult {
  /** Wallet address (checksummed) */
  walletAddress: string;

  /** P&L tier */
  tier: PnlTier;

  /** Suspicion level */
  suspicionLevel: PnlSuspicionLevel;

  /** Suspicion score (0-100) */
  suspicionScore: number;

  /** Statistics for each time window */
  windowStats: Record<PnlWindow, WindowPnlStats>;

  /** Category-specific stats */
  categoryStats: CategoryPnlStats[];

  /** Top performing categories */
  topCategories: string[];

  /** Worst performing categories */
  worstCategories: string[];

  /** Realized P&L breakdown */
  realizedPnl: RealizedPnl[];

  /** Unrealized P&L breakdown */
  unrealizedPnl: UnrealizedPnl[];

  /** Aggregate totals */
  aggregates: {
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    totalPnl: number;
    totalCostBasis: number;
    totalFees: number;
    overallRoi: number;
  };

  /** P&L trend */
  trend: PnlTrend;

  /** Historical P&L data points */
  history: PnlDataPoint[];

  /** Detected anomalies */
  anomalies: PnlAnomaly[];

  /** Total positions tracked */
  totalPositions: number;

  /** Data quality score (0-100) */
  dataQuality: number;

  /** Whether flagged as potential insider */
  isPotentialInsider: boolean;

  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Options for P&L analysis
 */
export interface AnalyzePnlOptions {
  /** Include historical data points */
  includeHistory?: boolean;

  /** Include category breakdown */
  includeCategoryBreakdown?: boolean;

  /** Include individual position details */
  includePositionDetails?: boolean;

  /** Minimum positions for valid analysis */
  minPositions?: number;
}

/**
 * Batch analysis result
 */
export interface BatchPnlResult {
  /** Individual results by wallet */
  results: Map<string, PnlResult>;

  /** Failed analyses */
  failed: Map<string, Error>;

  /** Total processed */
  totalProcessed: number;

  /** Processing timestamp */
  processedAt: Date;
}

/**
 * P&L calculator summary
 */
export interface PnlCalculatorSummary {
  /** Total wallets tracked */
  totalWallets: number;

  /** Total positions tracked */
  totalPositions: number;

  /** Total open positions */
  openPositions: number;

  /** Total closed positions */
  closedPositions: number;

  /** Aggregate realized P&L */
  aggregateRealizedPnl: number;

  /** Aggregate unrealized P&L */
  aggregateUnrealizedPnl: number;

  /** Wallets with exceptional returns */
  exceptionalReturnCount: number;

  /** Potential insider count */
  potentialInsiderCount: number;

  /** P&L tier distribution */
  tierDistribution: Record<PnlTier, number>;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Last updated */
  lastUpdated: Date;
}

/**
 * P&L calculator configuration
 */
export interface PnlCalculatorConfig {
  /** Minimum positions for analysis */
  minPositionsForAnalysis: number;

  /** Minimum positions for high confidence */
  minPositionsForHighConfidence: number;

  /** ROI threshold for exceptional tier */
  exceptionalRoiThreshold: number;

  /** ROI threshold for potential insider flag */
  potentialInsiderRoiThreshold: number;

  /** Minimum consistency for insider flag */
  minConsistencyForInsider: number;

  /** Cache TTL in milliseconds */
  cacheTtl: number;

  /** Maximum positions per wallet */
  maxPositionsPerWallet: number;

  /** Enable events */
  enableEvents: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_PNL_CONFIG: PnlCalculatorConfig = {
  minPositionsForAnalysis: 5,
  minPositionsForHighConfidence: 20,
  exceptionalRoiThreshold: 100, // 100% ROI
  potentialInsiderRoiThreshold: 75, // 75% ROI
  minConsistencyForInsider: 70, // 70% win rate with high ROI
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxPositionsPerWallet: 10000,
  enableEvents: true,
};

/**
 * P&L tier thresholds (ROI percentages)
 */
export const PNL_TIER_THRESHOLDS: Record<PnlTier, { min: number; max: number }> =
  {
    [PnlTier.MASSIVE_LOSS]: { min: -Infinity, max: -50 },
    [PnlTier.LARGE_LOSS]: { min: -50, max: -25 },
    [PnlTier.MODERATE_LOSS]: { min: -25, max: -10 },
    [PnlTier.SMALL_LOSS]: { min: -10, max: -1 },
    [PnlTier.BREAKEVEN]: { min: -1, max: 1 },
    [PnlTier.SMALL_PROFIT]: { min: 1, max: 25 },
    [PnlTier.MODERATE_PROFIT]: { min: 25, max: 50 },
    [PnlTier.LARGE_PROFIT]: { min: 50, max: 100 },
    [PnlTier.MASSIVE_PROFIT]: { min: 100, max: Infinity },
    [PnlTier.UNKNOWN]: { min: 0, max: 0 },
  };

/**
 * Suspicion score weights
 */
const SUSPICION_WEIGHTS = {
  roi: 0.3,
  consistency: 0.25,
  categoryExpertise: 0.15,
  trend: 0.1,
  variance: 0.1,
  anomalyCount: 0.1,
};

// ============================================================================
// Profit/Loss Calculator Class
// ============================================================================

/**
 * Profit/Loss Calculator
 *
 * Calculates realized and unrealized P&L for wallets.
 */
export class ProfitLossCalculator extends EventEmitter {
  private config: PnlCalculatorConfig;
  private positions: Map<string, PnlPosition[]>; // walletAddress -> positions
  private cache: Map<string, { result: PnlResult; timestamp: number }>;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<PnlCalculatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PNL_CONFIG, ...config };
    this.positions = new Map();
    this.cache = new Map();
  }

  /**
   * Add a position for tracking
   */
  addPosition(position: PnlPosition): void {
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

    // Check if position already exists (update if so)
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
        (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime()
      );
      walletPositions.splice(
        0,
        walletPositions.length - this.config.maxPositionsPerWallet
      );
    }

    // Invalidate cache
    this.cache.delete(address);

    if (this.config.enableEvents) {
      this.emit("position-added", { address, position: normalizedPosition });
    }
  }

  /**
   * Add multiple positions
   */
  addPositions(positions: PnlPosition[]): void {
    for (const position of positions) {
      this.addPosition(position);
    }
  }

  /**
   * Update position with current price (for unrealized P&L)
   */
  updatePositionPrice(
    walletAddress: string,
    positionId: string,
    currentPrice: number
  ): void {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return;

    const walletPositions = this.positions.get(address);
    if (!walletPositions) return;

    const position = walletPositions.find((p) => p.positionId === positionId);
    if (position && position.status === PositionStatus.OPEN) {
      position.currentPrice = currentPrice;
      position.currentValue = position.shares * currentPrice;

      // Invalidate cache
      this.cache.delete(address);

      if (this.config.enableEvents) {
        this.emit("position-updated", { address, positionId, currentPrice });
      }
    }
  }

  /**
   * Close a position
   */
  closePosition(
    walletAddress: string,
    positionId: string,
    exitPrice: number,
    exitTimestamp: Date = new Date(),
    status: PositionStatus = PositionStatus.CLOSED
  ): void {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return;

    const walletPositions = this.positions.get(address);
    if (!walletPositions) return;

    const position = walletPositions.find((p) => p.positionId === positionId);
    if (position && position.status === PositionStatus.OPEN) {
      position.exitPrice = exitPrice;
      position.exitValue = position.shares * exitPrice;
      position.exitTimestamp = exitTimestamp;
      position.status = status;
      position.currentPrice = undefined;
      position.currentValue = undefined;

      // Invalidate cache
      this.cache.delete(address);

      if (this.config.enableEvents) {
        const pnl = position.exitValue - position.costBasis - position.fees;
        this.emit("position-closed", {
          address,
          positionId,
          exitPrice,
          pnl,
        });
      }
    }
  }

  /**
   * Get positions for a wallet
   */
  getPositions(walletAddress: string): PnlPosition[] {
    const address = this.normalizeAddress(walletAddress);
    if (!address) return [];
    return this.positions.get(address) || [];
  }

  /**
   * Get open positions for a wallet
   */
  getOpenPositions(walletAddress: string): PnlPosition[] {
    return this.getPositions(walletAddress).filter(
      (p) => p.status === PositionStatus.OPEN
    );
  }

  /**
   * Get closed positions for a wallet
   */
  getClosedPositions(walletAddress: string): PnlPosition[] {
    return this.getPositions(walletAddress).filter(
      (p) => p.status !== PositionStatus.OPEN
    );
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
   * Analyze P&L for a wallet
   */
  analyze(walletAddress: string, options: AnalyzePnlOptions = {}): PnlResult {
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
    const result = this.computePnl(address, positions, options);

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
    options: AnalyzePnlOptions = {}
  ): BatchPnlResult {
    const results = new Map<string, PnlResult>();
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
   * Check if wallet has exceptional returns
   */
  hasExceptionalReturns(walletAddress: string): boolean {
    try {
      const result = this.analyze(walletAddress);
      return (
        result.aggregates.overallRoi >= this.config.exceptionalRoiThreshold
      );
    } catch {
      return false;
    }
  }

  /**
   * Get wallets with high returns
   */
  getHighReturnWallets(minRoi: number = 50): PnlResult[] {
    const results: PnlResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        if (result.aggregates.overallRoi >= minRoi) {
          results.push(result);
        }
      } catch {
        // Skip
      }
    }
    return results.sort(
      (a, b) => b.aggregates.overallRoi - a.aggregates.overallRoi
    );
  }

  /**
   * Get potential insider wallets
   */
  getPotentialInsiders(): PnlResult[] {
    const results: PnlResult[] = [];
    for (const address of this.positions.keys()) {
      try {
        const result = this.analyze(address);
        if (result.isPotentialInsider) {
          results.push(result);
        }
      } catch {
        // Skip
      }
    }
    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Calculate realized P&L for a specific position
   */
  calculateRealizedPnl(position: PnlPosition): RealizedPnl | null {
    if (position.status === PositionStatus.OPEN) {
      return null;
    }

    const exitValue = position.exitValue ?? 0;
    const realizedPnl = exitValue - position.costBasis - position.fees;
    const roi =
      position.costBasis > 0 ? (realizedPnl / position.costBasis) * 100 : 0;

    let direction: PnlDirection;
    if (Math.abs(realizedPnl) < 0.01) {
      direction = PnlDirection.BREAKEVEN;
    } else if (realizedPnl > 0) {
      direction = PnlDirection.PROFIT;
    } else {
      direction = PnlDirection.LOSS;
    }

    const holdingPeriod = position.exitTimestamp
      ? position.exitTimestamp.getTime() - position.entryTimestamp.getTime()
      : 0;

    return {
      positionId: position.positionId,
      marketId: position.marketId,
      costBasis: position.costBasis,
      exitValue,
      realizedPnl,
      roi,
      direction,
      holdingPeriod,
      exitTimestamp: position.exitTimestamp || new Date(),
      fees: position.fees,
    };
  }

  /**
   * Calculate unrealized P&L for an open position
   */
  calculateUnrealizedPnl(position: PnlPosition): UnrealizedPnl | null {
    if (position.status !== PositionStatus.OPEN) {
      return null;
    }

    const currentValue = position.currentValue ?? position.costBasis;
    const unrealizedPnl = currentValue - position.costBasis;
    const unrealizedRoi =
      position.costBasis > 0 ? (unrealizedPnl / position.costBasis) * 100 : 0;

    let direction: PnlDirection;
    if (Math.abs(unrealizedPnl) < 0.01) {
      direction = PnlDirection.BREAKEVEN;
    } else if (unrealizedPnl > 0) {
      direction = PnlDirection.PROFIT;
    } else {
      direction = PnlDirection.LOSS;
    }

    const timeInPosition =
      Date.now() - position.entryTimestamp.getTime();

    return {
      positionId: position.positionId,
      marketId: position.marketId,
      costBasis: position.costBasis,
      currentValue,
      unrealizedPnl,
      unrealizedRoi,
      direction,
      timeInPosition,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get summary statistics
   */
  getSummary(): PnlCalculatorSummary {
    const tierDistribution: Record<PnlTier, number> = {
      [PnlTier.MASSIVE_LOSS]: 0,
      [PnlTier.LARGE_LOSS]: 0,
      [PnlTier.MODERATE_LOSS]: 0,
      [PnlTier.SMALL_LOSS]: 0,
      [PnlTier.BREAKEVEN]: 0,
      [PnlTier.SMALL_PROFIT]: 0,
      [PnlTier.MODERATE_PROFIT]: 0,
      [PnlTier.LARGE_PROFIT]: 0,
      [PnlTier.MASSIVE_PROFIT]: 0,
      [PnlTier.UNKNOWN]: 0,
    };

    let totalPositions = 0;
    let openPositions = 0;
    let closedPositions = 0;
    let aggregateRealizedPnl = 0;
    let aggregateUnrealizedPnl = 0;
    let exceptionalCount = 0;
    let potentialInsiderCount = 0;

    for (const address of this.positions.keys()) {
      const walletPositions = this.positions.get(address) || [];
      totalPositions += walletPositions.length;

      for (const position of walletPositions) {
        if (position.status === PositionStatus.OPEN) {
          openPositions++;
          const unrealized = this.calculateUnrealizedPnl(position);
          if (unrealized) {
            aggregateUnrealizedPnl += unrealized.unrealizedPnl;
          }
        } else {
          closedPositions++;
          const realized = this.calculateRealizedPnl(position);
          if (realized) {
            aggregateRealizedPnl += realized.realizedPnl;
          }
        }
      }

      try {
        const result = this.analyze(address);
        tierDistribution[result.tier]++;
        if (result.tier === PnlTier.MASSIVE_PROFIT) {
          exceptionalCount++;
        }
        if (result.isPotentialInsider) {
          potentialInsiderCount++;
        }
      } catch {
        tierDistribution[PnlTier.UNKNOWN]++;
      }
    }

    const totalCacheAccesses = this.cacheHits + this.cacheMisses;

    return {
      totalWallets: this.positions.size,
      totalPositions,
      openPositions,
      closedPositions,
      aggregateRealizedPnl,
      aggregateUnrealizedPnl,
      exceptionalReturnCount: exceptionalCount,
      potentialInsiderCount,
      tierDistribution,
      cacheHitRate:
        totalCacheAccesses > 0 ? this.cacheHits / totalCacheAccesses : 0,
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

  private computePnl(
    walletAddress: string,
    positions: PnlPosition[],
    options: AnalyzePnlOptions
  ): PnlResult {
    const {
      includeHistory = true,
      includeCategoryBreakdown = true,
      includePositionDetails = true,
      minPositions = this.config.minPositionsForAnalysis,
    } = options;

    // Separate open and closed positions
    const openPositions = positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );
    const closedPositions = positions.filter(
      (p) => p.status !== PositionStatus.OPEN
    );

    // Calculate individual P&L
    const realizedPnlList: RealizedPnl[] = [];
    const unrealizedPnlList: UnrealizedPnl[] = [];

    for (const position of closedPositions) {
      const realized = this.calculateRealizedPnl(position);
      if (realized) realizedPnlList.push(realized);
    }

    for (const position of openPositions) {
      const unrealized = this.calculateUnrealizedPnl(position);
      if (unrealized) unrealizedPnlList.push(unrealized);
    }

    // Calculate window stats
    const windowStats = this.calculateWindowStats(
      positions,
      realizedPnlList,
      unrealizedPnlList
    );

    // Calculate category stats
    const categoryStats = includeCategoryBreakdown
      ? this.calculateCategoryStats(positions, realizedPnlList)
      : [];

    // Get top and worst categories
    const sortedCategories = [...categoryStats].sort(
      (a, b) => b.avgRoi - a.avgRoi
    );
    const topCategories = sortedCategories
      .filter((c) => c.avgRoi > 0)
      .slice(0, 3)
      .map((c) => c.category as string);
    const worstCategories = sortedCategories
      .filter((c) => c.avgRoi < 0)
      .slice(-3)
      .reverse()
      .map((c) => c.category as string);

    // Calculate aggregates
    const totalRealizedPnl = realizedPnlList.reduce(
      (sum, p) => sum + p.realizedPnl,
      0
    );
    const totalUnrealizedPnl = unrealizedPnlList.reduce(
      (sum, p) => sum + p.unrealizedPnl,
      0
    );
    const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalFees = positions.reduce((sum, p) => sum + p.fees, 0);
    const totalPnl = totalRealizedPnl + totalUnrealizedPnl;
    const overallRoi = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

    const aggregates = {
      totalRealizedPnl,
      totalUnrealizedPnl,
      totalPnl,
      totalCostBasis,
      totalFees,
      overallRoi,
    };

    // Calculate trend
    const trend = this.calculateTrend(closedPositions, realizedPnlList);

    // Calculate history
    const history = includeHistory
      ? this.calculateHistory(realizedPnlList)
      : [];

    // Detect anomalies
    const anomalies = this.detectAnomalies(
      positions,
      realizedPnlList,
      categoryStats,
      trend,
      aggregates
    );

    // Determine tier
    const tier = this.determineTier(overallRoi, positions.length, minPositions);

    // Calculate suspicion
    const { suspicionLevel, suspicionScore, isPotentialInsider } =
      this.calculateSuspicion(
        positions,
        realizedPnlList,
        categoryStats,
        trend,
        anomalies,
        aggregates
      );

    // Data quality
    const dataQuality = this.calculateDataQuality(positions.length);

    return {
      walletAddress,
      tier,
      suspicionLevel,
      suspicionScore,
      windowStats,
      categoryStats,
      topCategories,
      worstCategories,
      realizedPnl: includePositionDetails ? realizedPnlList : [],
      unrealizedPnl: includePositionDetails ? unrealizedPnlList : [],
      aggregates,
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
    positions: PnlPosition[],
    realizedPnlList: RealizedPnl[],
    unrealizedPnlList: UnrealizedPnl[]
  ): Record<PnlWindow, WindowPnlStats> {
    const now = new Date();
    const result: Record<PnlWindow, WindowPnlStats> = {} as Record<
      PnlWindow,
      WindowPnlStats
    >;

    for (const window of Object.values(PnlWindow)) {
      const duration = PNL_WINDOW_DURATION_MS[window];
      const windowStart = new Date(
        duration === Infinity ? 0 : now.getTime() - duration
      );

      // Filter positions by window
      const windowPositions = positions.filter(
        (p) => p.entryTimestamp >= windowStart
      );
      const windowRealized = realizedPnlList.filter(
        (p) => p.exitTimestamp >= windowStart
      );
      const windowUnrealized = unrealizedPnlList.filter((p) => {
        const pos = positions.find((pos) => pos.positionId === p.positionId);
        return pos && pos.entryTimestamp >= windowStart;
      });

      // Calculate stats
      const openCount = windowPositions.filter(
        (p) => p.status === PositionStatus.OPEN
      ).length;
      const closedCount = windowPositions.filter(
        (p) => p.status !== PositionStatus.OPEN
      ).length;

      const totalRealizedPnl = windowRealized.reduce(
        (sum, p) => sum + p.realizedPnl,
        0
      );
      const totalUnrealizedPnl = windowUnrealized.reduce(
        (sum, p) => sum + p.unrealizedPnl,
        0
      );
      const totalPnl = totalRealizedPnl + totalUnrealizedPnl;
      const totalCostBasis = windowPositions.reduce(
        (sum, p) => sum + p.costBasis,
        0
      );
      const totalFees = windowPositions.reduce((sum, p) => sum + p.fees, 0);

      const profits = windowRealized.filter((p) => p.realizedPnl > 0);
      const losses = windowRealized.filter((p) => p.realizedPnl < 0);

      const grossProfit = profits.reduce((sum, p) => sum + p.realizedPnl, 0);
      const grossLoss = Math.abs(
        losses.reduce((sum, p) => sum + p.realizedPnl, 0)
      );

      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      const avgRealizedRoi =
        windowRealized.length > 0
          ? windowRealized.reduce((sum, p) => sum + p.roi, 0) /
            windowRealized.length
          : 0;

      const largestProfit = profits.length > 0
        ? Math.max(...profits.map((p) => p.realizedPnl))
        : 0;
      const largestLoss = losses.length > 0
        ? Math.min(...losses.map((p) => p.realizedPnl))
        : 0;

      const avgProfit = profits.length > 0
        ? grossProfit / profits.length
        : 0;
      const avgLoss = losses.length > 0
        ? grossLoss / losses.length
        : 0;

      // Expected value per trade
      const winRate = closedCount > 0 ? profits.length / closedCount : 0;
      const expectedValue =
        winRate * avgProfit - (1 - winRate) * avgLoss;

      // Risk-adjusted return (simplified Sharpe-like ratio)
      const rois = windowRealized.map((p) => p.roi);
      const meanRoi = rois.length > 0
        ? rois.reduce((sum, r) => sum + r, 0) / rois.length
        : 0;
      const variance = rois.length > 1
        ? rois.reduce((sum, r) => sum + Math.pow(r - meanRoi, 2), 0) /
          (rois.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);
      const riskAdjustedReturn = stdDev > 0 ? meanRoi / stdDev : 0;

      // Max drawdown calculation
      let maxDrawdown = 0;
      let peak = 0;
      let cumulativePnl = 0;
      const sortedRealized = [...windowRealized].sort(
        (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
      );
      for (const pnl of sortedRealized) {
        cumulativePnl += pnl.realizedPnl;
        if (cumulativePnl > peak) {
          peak = cumulativePnl;
        }
        const drawdown = peak > 0 ? (peak - cumulativePnl) / peak : 0;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      result[window] = {
        window,
        totalRealizedPnl,
        totalUnrealizedPnl,
        totalPnl,
        totalCostBasis,
        grossProfit,
        grossLoss,
        profitFactor,
        avgRealizedRoi,
        totalFees,
        closedPositions: closedCount,
        openPositions: openCount,
        profitablePositions: profits.length,
        losingPositions: losses.length,
        largestProfit,
        largestLoss,
        avgProfit,
        avgLoss,
        expectedValue,
        riskAdjustedReturn,
        maxDrawdown,
        windowStart,
        windowEnd: now,
      };
    }

    return result;
  }

  private calculateCategoryStats(
    positions: PnlPosition[],
    realizedPnlList: RealizedPnl[]
  ): CategoryPnlStats[] {
    const categoryMap = new Map<
      string,
      {
        positions: PnlPosition[];
        realized: RealizedPnl[];
      }
    >();

    // Group by category
    for (const position of positions) {
      const category = (position.marketCategory || "unknown") as string;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { positions: [], realized: [] });
      }
      categoryMap.get(category)!.positions.push(position);
    }

    for (const realized of realizedPnlList) {
      const position = positions.find(
        (p) => p.positionId === realized.positionId
      );
      if (position) {
        const category = (position.marketCategory || "unknown") as string;
        if (categoryMap.has(category)) {
          categoryMap.get(category)!.realized.push(realized);
        }
      }
    }

    // Calculate stats for each category
    const result: CategoryPnlStats[] = [];
    for (const [category, data] of categoryMap) {
      const totalPositions = data.positions.length;
      const realizedPnl = data.realized.reduce(
        (sum, r) => sum + r.realizedPnl,
        0
      );
      const unrealizedPnl = data.positions
        .filter((p) => p.status === PositionStatus.OPEN)
        .reduce((acc, p) => acc + ((p.currentValue || 0) - p.costBasis), 0);

      const avgRoi =
        data.realized.length > 0
          ? data.realized.reduce((sum, r) => sum + r.roi, 0) /
            data.realized.length
          : 0;

      const wins = data.realized.filter((r) => r.realizedPnl > 0).length;
      const winRate =
        data.realized.length > 0 ? (wins / data.realized.length) * 100 : 0;

      const profits = data.realized.filter((r) => r.realizedPnl > 0);
      const losses = data.realized.filter((r) => r.realizedPnl < 0);
      const grossProfit = profits.reduce((sum, r) => sum + r.realizedPnl, 0);
      const grossLoss = Math.abs(
        losses.reduce((sum, r) => sum + r.realizedPnl, 0)
      );
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      result.push({
        category,
        totalPositions,
        realizedPnl,
        unrealizedPnl,
        avgRoi,
        winRate,
        profitFactor,
      });
    }

    return result.sort((a, b) => b.totalPositions - a.totalPositions);
  }

  private calculateTrend(
    _closedPositions: PnlPosition[],
    realizedPnlList: RealizedPnl[]
  ): PnlTrend {
    if (realizedPnlList.length < 5) {
      return {
        direction: "stable",
        magnitude: 0,
        recentRoi: 0,
        historicalRoi: 0,
        profitStreak: 0,
        onWinningStreak: false,
      };
    }

    // Sort by exit timestamp
    const sorted = [...realizedPnlList].sort(
      (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
    );

    // Split into historical (first 70%) and recent (last 30%)
    const splitIndex = Math.floor(sorted.length * 0.7);
    const historical = sorted.slice(0, splitIndex);
    const recent = sorted.slice(splitIndex);

    const historicalRoi =
      historical.length > 0
        ? historical.reduce((sum, r) => sum + r.roi, 0) / historical.length
        : 0;
    const recentRoi =
      recent.length > 0
        ? recent.reduce((sum, r) => sum + r.roi, 0) / recent.length
        : 0;

    const magnitude = Math.abs(recentRoi - historicalRoi);

    let direction: "improving" | "declining" | "stable";
    if (recentRoi > historicalRoi + 10) {
      direction = "improving";
    } else if (recentRoi < historicalRoi - 10) {
      direction = "declining";
    } else {
      direction = "stable";
    }

    // Calculate current profit/loss streak
    let profitStreak = 0;
    let onWinningStreak = false;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const current = sorted[i];
      if (!current) break;

      if (profitStreak === 0) {
        onWinningStreak = current.realizedPnl > 0;
      }

      if (
        (onWinningStreak && current.realizedPnl > 0) ||
        (!onWinningStreak && current.realizedPnl < 0)
      ) {
        profitStreak++;
      } else {
        break;
      }
    }

    return {
      direction,
      magnitude,
      recentRoi,
      historicalRoi,
      profitStreak,
      onWinningStreak,
    };
  }

  private calculateHistory(realizedPnlList: RealizedPnl[]): PnlDataPoint[] {
    if (realizedPnlList.length === 0) return [];

    const sorted = [...realizedPnlList].sort(
      (a, b) => a.exitTimestamp.getTime() - b.exitTimestamp.getTime()
    );

    const history: PnlDataPoint[] = [];
    let cumulativePnl = 0;
    let cumulativeCostBasis = 0;

    for (let i = 0; i < sorted.length; i++) {
      const pnl = sorted[i];
      if (!pnl) continue;

      cumulativePnl += pnl.realizedPnl;
      cumulativeCostBasis += pnl.costBasis;

      const cumulativeRoi =
        cumulativeCostBasis > 0
          ? (cumulativePnl / cumulativeCostBasis) * 100
          : 0;

      history.push({
        date: pnl.exitTimestamp,
        cumulativeRealizedPnl: cumulativePnl,
        cumulativeRoi,
        positionsClosed: i + 1,
        dailyPnl: pnl.realizedPnl,
      });
    }

    return history;
  }

  private detectAnomalies(
    positions: PnlPosition[],
    realizedPnlList: RealizedPnl[],
    categoryStats: CategoryPnlStats[],
    trend: PnlTrend,
    aggregates: PnlResult["aggregates"]
  ): PnlAnomaly[] {
    const anomalies: PnlAnomaly[] = [];

    // Exceptional returns
    if (
      aggregates.overallRoi >= this.config.exceptionalRoiThreshold &&
      positions.length >= this.config.minPositionsForAnalysis
    ) {
      anomalies.push({
        type: "exceptional_returns",
        severity: Math.min(
          100,
          (aggregates.overallRoi - this.config.exceptionalRoiThreshold) / 2 + 50
        ),
        description: `Exceptional ROI of ${aggregates.overallRoi.toFixed(1)}% across ${positions.length} positions`,
        data: {
          roi: aggregates.overallRoi,
          totalPnl: aggregates.totalPnl,
          positions: positions.length,
        },
      });
    }

    // Consistent profitability (high win rate with positive avg returns)
    const wins = realizedPnlList.filter((r) => r.realizedPnl > 0).length;
    const winRate =
      realizedPnlList.length > 0
        ? (wins / realizedPnlList.length) * 100
        : 0;
    if (
      winRate >= 70 &&
      realizedPnlList.length >= 10 &&
      aggregates.overallRoi > 25
    ) {
      anomalies.push({
        type: "consistent_profitability",
        severity: Math.min(100, (winRate - 50) * 2 + aggregates.overallRoi / 5),
        description: `Consistent profitability with ${winRate.toFixed(1)}% win rate and ${aggregates.overallRoi.toFixed(1)}% ROI`,
        data: {
          winRate,
          roi: aggregates.overallRoi,
          trades: realizedPnlList.length,
        },
      });
    }

    // Perfect timing - short hold periods with high returns
    const shortHoldHighReturn = realizedPnlList.filter(
      (r) =>
        r.holdingPeriod < 24 * 60 * 60 * 1000 && // Less than 24 hours
        r.roi > 50
    );
    if (shortHoldHighReturn.length >= 5) {
      const avgReturn =
        shortHoldHighReturn.reduce((sum, r) => sum + r.roi, 0) /
        shortHoldHighReturn.length;
      anomalies.push({
        type: "perfect_timing",
        severity: Math.min(100, avgReturn / 2 + shortHoldHighReturn.length * 5),
        description: `${shortHoldHighReturn.length} quick trades with ${avgReturn.toFixed(1)}% average return`,
        data: {
          shortTermTrades: shortHoldHighReturn.length,
          avgReturn,
        },
      });
    }

    // Category expertise - extremely high returns in specific category
    for (const cat of categoryStats) {
      if (cat.totalPositions >= 5 && cat.avgRoi >= 75 && cat.winRate >= 75) {
        anomalies.push({
          type: "category_expertise",
          severity: Math.min(100, cat.avgRoi / 2 + cat.winRate / 2),
          description: `Exceptional performance in ${cat.category}: ${cat.avgRoi.toFixed(1)}% ROI with ${cat.winRate.toFixed(1)}% win rate`,
          data: {
            category: cat.category,
            roi: cat.avgRoi,
            winRate: cat.winRate,
            positions: cat.totalPositions,
          },
        });
      }
    }

    // Low variance with high returns (suspicious consistency)
    if (realizedPnlList.length >= 10) {
      const rois = realizedPnlList.map((r) => r.roi);
      const meanRoi = rois.reduce((sum, r) => sum + r, 0) / rois.length;
      const variance =
        rois.reduce((sum, r) => sum + Math.pow(r - meanRoi, 2), 0) /
        (rois.length - 1);
      const stdDev = Math.sqrt(variance);
      const coeffOfVariation = meanRoi !== 0 ? stdDev / Math.abs(meanRoi) : 0;

      if (coeffOfVariation < 0.5 && meanRoi > 20) {
        anomalies.push({
          type: "low_variance",
          severity: Math.min(100, (1 - coeffOfVariation) * 50 + meanRoi),
          description: `Suspiciously consistent returns with ${meanRoi.toFixed(1)}% avg ROI and low variance`,
          data: {
            avgRoi: meanRoi,
            stdDev,
            coeffOfVariation,
          },
        });
      }
    }

    // Strong improving trend
    if (
      trend.direction === "improving" &&
      trend.magnitude > 30 &&
      trend.recentRoi > 50
    ) {
      anomalies.push({
        type: "suspicious_pattern",
        severity: Math.min(100, trend.magnitude + trend.recentRoi / 2),
        description: `Sharp improvement in returns: recent ROI ${trend.recentRoi.toFixed(1)}% vs historical ${trend.historicalRoi.toFixed(1)}%`,
        data: {
          recentRoi: trend.recentRoi,
          historicalRoi: trend.historicalRoi,
          improvement: trend.magnitude,
        },
      });
    }

    return anomalies.sort((a, b) => b.severity - a.severity);
  }

  private determineTier(
    roi: number,
    positionCount: number,
    minPositions: number
  ): PnlTier {
    if (positionCount < minPositions) {
      return PnlTier.UNKNOWN;
    }

    for (const [tier, thresholds] of Object.entries(PNL_TIER_THRESHOLDS)) {
      if (tier === PnlTier.UNKNOWN) continue;
      if (roi >= thresholds.min && roi < thresholds.max) {
        return tier as PnlTier;
      }
    }

    return PnlTier.UNKNOWN;
  }

  private calculateSuspicion(
    positions: PnlPosition[],
    realizedPnlList: RealizedPnl[],
    categoryStats: CategoryPnlStats[],
    trend: PnlTrend,
    anomalies: PnlAnomaly[],
    aggregates: PnlResult["aggregates"]
  ): {
    suspicionLevel: PnlSuspicionLevel;
    suspicionScore: number;
    isPotentialInsider: boolean;
  } {
    if (positions.length < this.config.minPositionsForAnalysis) {
      return {
        suspicionLevel: PnlSuspicionLevel.NONE,
        suspicionScore: 0,
        isPotentialInsider: false,
      };
    }

    // ROI score
    let roiScore = 0;
    if (aggregates.overallRoi >= 150) roiScore = 100;
    else if (aggregates.overallRoi >= 100) roiScore = 75;
    else if (aggregates.overallRoi >= 75) roiScore = 50;
    else if (aggregates.overallRoi >= 50) roiScore = 30;
    else if (aggregates.overallRoi >= 25) roiScore = 15;

    // Consistency score (win rate)
    let consistencyScore = 0;
    const wins = realizedPnlList.filter((r) => r.realizedPnl > 0).length;
    const winRate =
      realizedPnlList.length > 0
        ? (wins / realizedPnlList.length) * 100
        : 0;
    if (winRate >= 85) consistencyScore = 100;
    else if (winRate >= 75) consistencyScore = 70;
    else if (winRate >= 65) consistencyScore = 40;
    else if (winRate >= 55) consistencyScore = 20;

    // Category expertise score
    let categoryScore = 0;
    const topCatRois = categoryStats
      .filter((c) => c.totalPositions >= 5)
      .map((c) => c.avgRoi);
    if (topCatRois.some((roi) => roi >= 100)) categoryScore = 80;
    else if (topCatRois.some((roi) => roi >= 75)) categoryScore = 50;
    else if (topCatRois.some((roi) => roi >= 50)) categoryScore = 25;

    // Trend score
    let trendScore = 0;
    if (trend.direction === "improving" && trend.magnitude > 40) {
      trendScore = Math.min(80, trend.magnitude);
    }

    // Variance score (lower variance = more suspicious if profitable)
    let varianceScore = 0;
    if (realizedPnlList.length >= 10 && aggregates.overallRoi > 25) {
      const rois = realizedPnlList.map((r) => r.roi);
      const meanRoi = rois.reduce((sum, r) => sum + r, 0) / rois.length;
      const variance =
        rois.reduce((sum, r) => sum + Math.pow(r - meanRoi, 2), 0) /
        (rois.length - 1);
      const stdDev = Math.sqrt(variance);
      const cv = meanRoi !== 0 ? stdDev / Math.abs(meanRoi) : 1;
      if (cv < 0.3) varianceScore = 80;
      else if (cv < 0.5) varianceScore = 50;
      else if (cv < 0.7) varianceScore = 25;
    }

    // Anomaly score
    const anomalyScore = Math.min(
      100,
      anomalies.reduce((sum, a) => sum + a.severity, 0) / 3
    );

    // Weighted total
    const suspicionScore =
      roiScore * SUSPICION_WEIGHTS.roi +
      consistencyScore * SUSPICION_WEIGHTS.consistency +
      categoryScore * SUSPICION_WEIGHTS.categoryExpertise +
      trendScore * SUSPICION_WEIGHTS.trend +
      varianceScore * SUSPICION_WEIGHTS.variance +
      anomalyScore * SUSPICION_WEIGHTS.anomalyCount;

    // Determine level
    let suspicionLevel: PnlSuspicionLevel;
    if (suspicionScore >= 80) suspicionLevel = PnlSuspicionLevel.CRITICAL;
    else if (suspicionScore >= 60) suspicionLevel = PnlSuspicionLevel.HIGH;
    else if (suspicionScore >= 40) suspicionLevel = PnlSuspicionLevel.MEDIUM;
    else if (suspicionScore >= 20) suspicionLevel = PnlSuspicionLevel.LOW;
    else suspicionLevel = PnlSuspicionLevel.NONE;

    // Determine if potential insider
    const isPotentialInsider =
      aggregates.overallRoi >= this.config.potentialInsiderRoiThreshold &&
      winRate >= this.config.minConsistencyForInsider &&
      positions.length >= this.config.minPositionsForHighConfidence;

    return {
      suspicionLevel,
      suspicionScore: Math.round(suspicionScore),
      isPotentialInsider,
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
 * Create a new ProfitLossCalculator instance
 */
export function createProfitLossCalculator(
  config?: Partial<PnlCalculatorConfig>
): ProfitLossCalculator {
  return new ProfitLossCalculator(config);
}

// Shared instance
let sharedCalculator: ProfitLossCalculator | null = null;

/**
 * Get the shared ProfitLossCalculator instance
 */
export function getSharedProfitLossCalculator(): ProfitLossCalculator {
  if (!sharedCalculator) {
    sharedCalculator = new ProfitLossCalculator();
  }
  return sharedCalculator;
}

/**
 * Set the shared ProfitLossCalculator instance
 */
export function setSharedProfitLossCalculator(
  calculator: ProfitLossCalculator
): void {
  sharedCalculator = calculator;
}

/**
 * Reset the shared ProfitLossCalculator instance
 */
export function resetSharedProfitLossCalculator(): void {
  sharedCalculator = null;
}

/**
 * Add a position to the shared calculator
 */
export function addPositionForPnl(position: PnlPosition): void {
  getSharedProfitLossCalculator().addPosition(position);
}

/**
 * Add multiple positions to the shared calculator
 */
export function addPositionsForPnl(positions: PnlPosition[]): void {
  getSharedProfitLossCalculator().addPositions(positions);
}

/**
 * Update position price in the shared calculator
 */
export function updatePositionPriceForPnl(
  walletAddress: string,
  positionId: string,
  currentPrice: number
): void {
  getSharedProfitLossCalculator().updatePositionPrice(
    walletAddress,
    positionId,
    currentPrice
  );
}

/**
 * Close a position in the shared calculator
 */
export function closePositionForPnl(
  walletAddress: string,
  positionId: string,
  exitPrice: number,
  exitTimestamp?: Date
): void {
  getSharedProfitLossCalculator().closePosition(
    walletAddress,
    positionId,
    exitPrice,
    exitTimestamp
  );
}

/**
 * Analyze P&L for a wallet using the shared calculator
 */
export function analyzePnl(
  walletAddress: string,
  options?: AnalyzePnlOptions
): PnlResult {
  return getSharedProfitLossCalculator().analyze(walletAddress, options);
}

/**
 * Batch analyze P&L using the shared calculator
 */
export function batchAnalyzePnl(
  walletAddresses: string[],
  options?: AnalyzePnlOptions
): BatchPnlResult {
  return getSharedProfitLossCalculator().batchAnalyze(walletAddresses, options);
}

/**
 * Check if wallet has exceptional returns
 */
export function hasExceptionalReturns(walletAddress: string): boolean {
  return getSharedProfitLossCalculator().hasExceptionalReturns(walletAddress);
}

/**
 * Get wallets with high returns
 */
export function getHighReturnWallets(minRoi?: number): PnlResult[] {
  return getSharedProfitLossCalculator().getHighReturnWallets(minRoi);
}

/**
 * Get potential insider wallets by P&L
 */
export function getPotentialInsidersByPnl(): PnlResult[] {
  return getSharedProfitLossCalculator().getPotentialInsiders();
}

/**
 * Get P&L calculator summary
 */
export function getPnlCalculatorSummary(): PnlCalculatorSummary {
  return getSharedProfitLossCalculator().getSummary();
}

/**
 * Get P&L tier description
 */
export function getPnlTierDescription(tier: PnlTier): string {
  switch (tier) {
    case PnlTier.UNKNOWN:
      return "Unknown - insufficient data for analysis";
    case PnlTier.MASSIVE_LOSS:
      return "Massive loss (over 50% down)";
    case PnlTier.LARGE_LOSS:
      return "Large loss (25-50% down)";
    case PnlTier.MODERATE_LOSS:
      return "Moderate loss (10-25% down)";
    case PnlTier.SMALL_LOSS:
      return "Small loss (0-10% down)";
    case PnlTier.BREAKEVEN:
      return "Breakeven (±1%)";
    case PnlTier.SMALL_PROFIT:
      return "Small profit (0-25% up)";
    case PnlTier.MODERATE_PROFIT:
      return "Moderate profit (25-50% up)";
    case PnlTier.LARGE_PROFIT:
      return "Large profit (50-100% up)";
    case PnlTier.MASSIVE_PROFIT:
      return "Massive profit (over 100% up) - potential insider";
  }
}

/**
 * Get suspicion level description
 */
export function getPnlSuspicionDescription(
  level: PnlSuspicionLevel
): string {
  switch (level) {
    case PnlSuspicionLevel.NONE:
      return "No suspicious patterns detected";
    case PnlSuspicionLevel.LOW:
      return "Slightly above average performance";
    case PnlSuspicionLevel.MEDIUM:
      return "Notable performance worth monitoring";
    case PnlSuspicionLevel.HIGH:
      return "Suspicious performance patterns";
    case PnlSuspicionLevel.CRITICAL:
      return "Highly suspicious - likely insider activity";
  }
}
