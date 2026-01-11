/**
 * Market Impact Calculator (DET-VOL-009)
 *
 * Calculate price impact of large trades for detecting potential market manipulation.
 *
 * Features:
 * - Track price before/after trade execution
 * - Calculate slippage (difference between expected and executed price)
 * - Compare actual impact to expected impact based on trade size and liquidity
 * - Flag excessive impact trades that move the market disproportionately
 * - Event emission for high-impact trades
 * - Support for multiple impact calculation methods
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Severity of market impact
 */
export enum ImpactSeverity {
  /** Negligible impact */
  NEGLIGIBLE = "NEGLIGIBLE",
  /** Low impact - within normal bounds */
  LOW = "LOW",
  /** Medium impact - notable but not extreme */
  MEDIUM = "MEDIUM",
  /** High impact - significant market move */
  HIGH = "HIGH",
  /** Extreme impact - potentially manipulative */
  EXTREME = "EXTREME",
}

/**
 * Type of impact anomaly detected
 */
export enum ImpactAnomalyType {
  /** Impact exceeds expected based on trade size */
  EXCESSIVE_IMPACT = "EXCESSIVE_IMPACT",
  /** Impact lower than expected (possibly hidden order flow) */
  MUTED_IMPACT = "MUTED_IMPACT",
  /** Price reversal after trade (possible manipulation) */
  PRICE_REVERSAL = "PRICE_REVERSAL",
  /** Delayed impact (price moves after trade) */
  DELAYED_IMPACT = "DELAYED_IMPACT",
  /** Front-running detected (price moved before trade) */
  FRONT_RUNNING = "FRONT_RUNNING",
}

/**
 * Direction of the trade
 */
export enum TradeDirection {
  BUY = "BUY",
  SELL = "SELL",
}

/**
 * Trade data for impact calculation
 */
export interface ImpactTradeData {
  /** Unique trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address that made the trade */
  walletAddress: string;

  /** Trade direction */
  direction: TradeDirection;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade execution timestamp in milliseconds */
  timestamp: number;

  /** Price before the trade (probability 0-1) */
  priceBefore: number;

  /** Price after the trade (probability 0-1) */
  priceAfter: number;

  /** Expected price at execution (limit price if applicable) */
  expectedPrice?: number;

  /** Outcome token ID if applicable */
  outcomeId?: string;
}

/**
 * Market liquidity data for impact estimation
 */
export interface MarketLiquidityData {
  /** Market identifier */
  marketId: string;

  /** Total order book depth in USD */
  totalDepth: number;

  /** Bid-side depth in USD */
  bidDepth: number;

  /** Ask-side depth in USD */
  askDepth: number;

  /** Best bid price */
  bestBid: number;

  /** Best ask price */
  bestAsk: number;

  /** Spread in basis points */
  spreadBps: number;

  /** Average daily volume in USD */
  avgDailyVolume: number;

  /** Data timestamp */
  timestamp: number;
}

/**
 * Result of market impact calculation
 */
export interface MarketImpactResult {
  /** Trade that was analyzed */
  trade: ImpactTradeData;

  /** Actual price impact (priceAfter - priceBefore) */
  actualImpact: number;

  /** Absolute value of impact */
  absoluteImpact: number;

  /** Impact in basis points */
  impactBps: number;

  /** Slippage (difference between expected and actual execution) */
  slippage: number;

  /** Slippage in basis points */
  slippageBps: number;

  /** Expected impact based on trade size and liquidity */
  expectedImpact: number;

  /** Impact ratio (actual / expected) */
  impactRatio: number;

  /** Whether impact is excessive */
  isExcessive: boolean;

  /** Impact severity */
  severity: ImpactSeverity;

  /** Anomaly type if detected */
  anomalyType: ImpactAnomalyType | null;

  /** Is this an anomalous impact */
  isAnomaly: boolean;

  /** Analysis timestamp */
  analyzedAt: Date;

  /** Context information */
  context: {
    /** Trade size as percentage of daily volume */
    sizePercentOfDailyVolume: number | null;
    /** Trade size as percentage of order book depth */
    sizePercentOfDepth: number | null;
    /** Market liquidity level */
    liquidityLevel: LiquidityLevel;
    /** Whether liquidity data was available */
    hasLiquidityData: boolean;
  };
}

/**
 * Liquidity level classification
 */
export enum LiquidityLevel {
  /** Very low liquidity */
  VERY_LOW = "VERY_LOW",
  /** Low liquidity */
  LOW = "LOW",
  /** Medium liquidity */
  MEDIUM = "MEDIUM",
  /** High liquidity */
  HIGH = "HIGH",
  /** Very high liquidity */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * High impact trade event
 */
export interface HighImpactEvent {
  /** Unique event identifier */
  eventId: string;

  /** Trade that caused the event */
  trade: ImpactTradeData;

  /** Impact result */
  impactResult: MarketImpactResult;

  /** Event severity */
  severity: ImpactSeverity;

  /** Anomaly type if applicable */
  anomalyType: ImpactAnomalyType | null;

  /** Event timestamp */
  timestamp: Date;

  /** Additional context */
  context: {
    /** Number of high impact trades in last hour */
    highImpactTradesLastHour: number;
    /** This wallet's high impact trade count */
    walletHighImpactCount: number;
    /** Market's high impact trade count */
    marketHighImpactCount: number;
  };
}

/**
 * Configuration for impact severity thresholds
 */
export interface ImpactSeverityThresholds {
  /** Basis points threshold for LOW severity */
  lowThresholdBps: number;
  /** Basis points threshold for MEDIUM severity */
  mediumThresholdBps: number;
  /** Basis points threshold for HIGH severity */
  highThresholdBps: number;
  /** Basis points threshold for EXTREME severity */
  extremeThresholdBps: number;
}

/**
 * Configuration for excessive impact detection
 */
export interface ExcessiveImpactThresholds {
  /** Impact ratio threshold for excessive flag (default: 2.0 = 2x expected) */
  excessiveRatioThreshold: number;
  /** Impact ratio threshold for muted flag (default: 0.3 = 30% of expected) */
  mutedRatioThreshold: number;
  /** Minimum absolute impact in bps to consider (default: 50 bps) */
  minImpactBpsToAnalyze: number;
}

/**
 * Configuration for price reversal detection
 */
export interface ReversalDetectionConfig {
  /** Time window for reversal detection in milliseconds (default: 5 minutes) */
  windowMs: number;
  /** Minimum reversal percentage to flag (default: 0.5 = 50% reversal) */
  minReversalPercent: number;
}

/**
 * Configuration for MarketImpactCalculator
 */
export interface MarketImpactCalculatorConfig {
  /** Impact severity thresholds */
  severityThresholds?: Partial<ImpactSeverityThresholds>;

  /** Excessive impact thresholds */
  excessiveThresholds?: Partial<ExcessiveImpactThresholds>;

  /** Reversal detection configuration */
  reversalConfig?: Partial<ReversalDetectionConfig>;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown between alerts in milliseconds (default: 60000) */
  alertCooldownMs?: number;

  /** Recent high impact events to store (default: 100) */
  maxRecentEvents?: number;

  /** Expected impact model coefficient (basis points per 1% of depth) */
  impactModelCoefficient?: number;
}

/**
 * Options for calculating impact
 */
export interface CalculateImpactOptions {
  /** Override timestamp */
  timestamp?: number;

  /** Bypass cooldown */
  bypassCooldown?: boolean;

  /** Liquidity data for the market */
  liquidity?: MarketLiquidityData;
}

/**
 * Batch impact calculation result
 */
export interface BatchImpactResult {
  /** Results by trade ID */
  results: Map<string, MarketImpactResult>;

  /** Trade IDs with excessive impact */
  excessiveImpactTradeIds: string[];

  /** High impact events generated */
  highImpactEvents: HighImpactEvent[];

  /** Summary statistics */
  summary: {
    totalAnalyzed: number;
    totalExcessive: number;
    totalAnomalies: number;
    bySeverity: Record<ImpactSeverity, number>;
    byAnomalyType: Record<ImpactAnomalyType, number>;
    averageImpactBps: number;
    averageSlippageBps: number;
  };

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary of impact calculator state
 */
export interface MarketImpactSummary {
  /** Total markets tracked */
  totalMarkets: number;

  /** Total wallets tracked */
  totalWallets: number;

  /** Total high impact events */
  totalHighImpactEvents: number;

  /** Events by severity */
  bySeverity: Record<ImpactSeverity, number>;

  /** Events by anomaly type */
  byAnomalyType: Record<ImpactAnomalyType, number>;

  /** Recent high impact events */
  recentEvents: HighImpactEvent[];

  /** Top markets by impact frequency */
  topImpactMarkets: Array<{
    marketId: string;
    eventCount: number;
    totalImpactBps: number;
  }>;

  /** Top wallets by impact */
  topImpactWallets: Array<{
    walletAddress: string;
    eventCount: number;
    totalImpactBps: number;
  }>;
}

/**
 * Tracked market state
 */
interface MarketImpactState {
  /** Recent prices for reversal detection */
  recentPrices: Array<{ price: number; timestamp: number }>;

  /** High impact event count */
  highImpactCount: number;

  /** Last alert time */
  lastAlertTime: number | null;

  /** Cached liquidity data */
  liquidityData: MarketLiquidityData | null;
}

/**
 * Tracked wallet state
 */
interface WalletImpactState {
  /** High impact trade count */
  highImpactCount: number;

  /** Total impact in basis points */
  totalImpactBps: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default impact severity thresholds */
export const DEFAULT_IMPACT_SEVERITY_THRESHOLDS: ImpactSeverityThresholds = {
  lowThresholdBps: 50, // 0.5%
  mediumThresholdBps: 100, // 1%
  highThresholdBps: 200, // 2%
  extremeThresholdBps: 500, // 5%
};

/** Default excessive impact thresholds */
export const DEFAULT_EXCESSIVE_THRESHOLDS: ExcessiveImpactThresholds = {
  excessiveRatioThreshold: 2.0,
  mutedRatioThreshold: 0.3,
  minImpactBpsToAnalyze: 50,
};

/** Default reversal detection configuration */
export const DEFAULT_REVERSAL_CONFIG: ReversalDetectionConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  minReversalPercent: 0.5, // 50% reversal
};

/** Default alert cooldown (1 minute) */
const DEFAULT_ALERT_COOLDOWN_MS = 60 * 1000;

/** Default max recent events */
const DEFAULT_MAX_RECENT_EVENTS = 100;

/** Default impact model coefficient */
const DEFAULT_IMPACT_MODEL_COEFFICIENT = 10; // 10 bps per 1% of depth consumed

/** Recent events window for frequency tracking (1 hour) */
const FREQUENCY_WINDOW_MS = 60 * 60 * 1000;

/** Price history retention window */
const PRICE_HISTORY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `impact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert price difference to basis points
 */
function toBasisPoints(value: number): number {
  return Math.round(value * 10000);
}

/**
 * Determine severity from impact in basis points
 */
function getSeverityFromBps(
  impactBps: number,
  thresholds: ImpactSeverityThresholds
): ImpactSeverity {
  const absImpact = Math.abs(impactBps);

  if (absImpact >= thresholds.extremeThresholdBps) {
    return ImpactSeverity.EXTREME;
  }
  if (absImpact >= thresholds.highThresholdBps) {
    return ImpactSeverity.HIGH;
  }
  if (absImpact >= thresholds.mediumThresholdBps) {
    return ImpactSeverity.MEDIUM;
  }
  if (absImpact >= thresholds.lowThresholdBps) {
    return ImpactSeverity.LOW;
  }
  return ImpactSeverity.NEGLIGIBLE;
}

/**
 * Classify liquidity level based on depth and volume
 */
function classifyLiquidityLevel(
  totalDepth: number,
  avgDailyVolume: number
): LiquidityLevel {
  const depthToVolumeRatio = avgDailyVolume > 0 ? totalDepth / avgDailyVolume : 0;

  if (totalDepth < 10000 || depthToVolumeRatio < 0.1) {
    return LiquidityLevel.VERY_LOW;
  }
  if (totalDepth < 50000 || depthToVolumeRatio < 0.3) {
    return LiquidityLevel.LOW;
  }
  if (totalDepth < 200000 || depthToVolumeRatio < 0.5) {
    return LiquidityLevel.MEDIUM;
  }
  if (totalDepth < 1000000 || depthToVolumeRatio < 1.0) {
    return LiquidityLevel.HIGH;
  }
  return LiquidityLevel.VERY_HIGH;
}

/**
 * Calculate expected impact based on trade size and liquidity
 *
 * Uses a simple linear model: impact = coefficient * (tradeSize / depth)
 * This is a simplified version of more complex market microstructure models
 */
function calculateExpectedImpact(
  tradeSizeUsd: number,
  liquidity: MarketLiquidityData | null,
  coefficient: number
): number {
  if (!liquidity || liquidity.totalDepth <= 0) {
    // Without liquidity data, use a conservative estimate
    // Assume impact scales with trade size
    return (tradeSizeUsd / 100000) * 0.01; // 1% per $100k
  }

  // Calculate the fraction of depth being consumed
  const depthFraction = tradeSizeUsd / liquidity.totalDepth;

  // Expected impact in decimal (e.g., 0.01 = 1%)
  // coefficient is in bps per 1% of depth
  const expectedImpactBps = coefficient * (depthFraction * 100);

  return expectedImpactBps / 10000;
}

// ============================================================================
// MarketImpactCalculator Class
// ============================================================================

/**
 * Event types emitted by MarketImpactCalculator
 */
export interface MarketImpactCalculatorEvents {
  highImpact: (event: HighImpactEvent) => void;
  excessiveImpact: (event: HighImpactEvent) => void;
  anomalyDetected: (event: HighImpactEvent) => void;
}

/**
 * Calculator for analyzing market impact of trades
 */
export class MarketImpactCalculator extends EventEmitter {
  private readonly severityThresholds: ImpactSeverityThresholds;
  private readonly excessiveThresholds: ExcessiveImpactThresholds;
  private readonly reversalConfig: ReversalDetectionConfig;
  private readonly enableEvents: boolean;
  private readonly alertCooldownMs: number;
  private readonly maxRecentEvents: number;
  private readonly impactModelCoefficient: number;

  // Market states
  private readonly marketStates: Map<string, MarketImpactState> = new Map();

  // Wallet states
  private readonly walletStates: Map<string, WalletImpactState> = new Map();

  // Recent high impact events
  private readonly recentEvents: HighImpactEvent[] = [];

  // Statistics
  private totalHighImpactEvents = 0;
  private eventsBySeverity: Record<ImpactSeverity, number> = {
    [ImpactSeverity.NEGLIGIBLE]: 0,
    [ImpactSeverity.LOW]: 0,
    [ImpactSeverity.MEDIUM]: 0,
    [ImpactSeverity.HIGH]: 0,
    [ImpactSeverity.EXTREME]: 0,
  };
  private eventsByAnomalyType: Record<ImpactAnomalyType, number> = {
    [ImpactAnomalyType.EXCESSIVE_IMPACT]: 0,
    [ImpactAnomalyType.MUTED_IMPACT]: 0,
    [ImpactAnomalyType.PRICE_REVERSAL]: 0,
    [ImpactAnomalyType.DELAYED_IMPACT]: 0,
    [ImpactAnomalyType.FRONT_RUNNING]: 0,
  };

  constructor(config?: MarketImpactCalculatorConfig) {
    super();

    this.severityThresholds = {
      ...DEFAULT_IMPACT_SEVERITY_THRESHOLDS,
      ...config?.severityThresholds,
    };

    this.excessiveThresholds = {
      ...DEFAULT_EXCESSIVE_THRESHOLDS,
      ...config?.excessiveThresholds,
    };

    this.reversalConfig = {
      ...DEFAULT_REVERSAL_CONFIG,
      ...config?.reversalConfig,
    };

    this.enableEvents = config?.enableEvents ?? true;
    this.alertCooldownMs = config?.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
    this.maxRecentEvents = config?.maxRecentEvents ?? DEFAULT_MAX_RECENT_EVENTS;
    this.impactModelCoefficient =
      config?.impactModelCoefficient ?? DEFAULT_IMPACT_MODEL_COEFFICIENT;
  }

  /**
   * Calculate market impact of a trade
   */
  calculateImpact(
    trade: ImpactTradeData,
    options?: CalculateImpactOptions
  ): MarketImpactResult {
    const now = options?.timestamp ?? Date.now();

    // Calculate actual impact
    const actualImpact = trade.priceAfter - trade.priceBefore;
    const absoluteImpact = Math.abs(actualImpact);
    const impactBps = toBasisPoints(absoluteImpact);

    // Calculate slippage
    let slippage = 0;
    if (trade.expectedPrice !== undefined) {
      slippage = trade.priceAfter - trade.expectedPrice;
    }
    const slippageBps = toBasisPoints(Math.abs(slippage));

    // Get or update market state
    const marketState = this.getOrCreateMarketState(trade.marketId);

    // Use provided liquidity or cached
    const liquidity = options?.liquidity ?? marketState.liquidityData;
    if (options?.liquidity) {
      marketState.liquidityData = options.liquidity;
    }

    // Calculate expected impact
    const expectedImpact = calculateExpectedImpact(
      trade.sizeUsd,
      liquidity,
      this.impactModelCoefficient
    );
    const expectedImpactBps = toBasisPoints(expectedImpact);

    // Calculate impact ratio
    const impactRatio = expectedImpact > 0 ? absoluteImpact / expectedImpact : 0;

    // Determine if excessive
    const isExcessive =
      impactBps >= this.excessiveThresholds.minImpactBpsToAnalyze &&
      impactRatio >= this.excessiveThresholds.excessiveRatioThreshold;

    // Determine severity
    const severity = getSeverityFromBps(impactBps, this.severityThresholds);

    // Detect anomalies
    let anomalyType: ImpactAnomalyType | null = null;

    if (
      impactBps >= this.excessiveThresholds.minImpactBpsToAnalyze &&
      impactRatio >= this.excessiveThresholds.excessiveRatioThreshold
    ) {
      anomalyType = ImpactAnomalyType.EXCESSIVE_IMPACT;
    } else if (
      impactBps >= this.excessiveThresholds.minImpactBpsToAnalyze &&
      impactRatio <= this.excessiveThresholds.mutedRatioThreshold &&
      expectedImpactBps >= this.excessiveThresholds.minImpactBpsToAnalyze
    ) {
      anomalyType = ImpactAnomalyType.MUTED_IMPACT;
    }

    // Check for price reversal in recent history
    if (
      anomalyType === null &&
      impactBps >= this.excessiveThresholds.minImpactBpsToAnalyze
    ) {
      const recentPrices = marketState.recentPrices.filter(
        (p) => now - p.timestamp < this.reversalConfig.windowMs
      );
      if (recentPrices.length > 0) {
        const priceBeforeTrade = recentPrices[recentPrices.length - 1]?.price;
        if (priceBeforeTrade !== undefined) {
          const priceChangeBeforeTrade = trade.priceBefore - priceBeforeTrade;
          // Check if price moved in opposite direction before trade (front-running)
          if (
            Math.abs(priceChangeBeforeTrade) > 0 &&
            ((actualImpact > 0 && priceChangeBeforeTrade > 0) ||
              (actualImpact < 0 && priceChangeBeforeTrade < 0))
          ) {
            if (
              Math.abs(priceChangeBeforeTrade) >=
              absoluteImpact * this.reversalConfig.minReversalPercent
            ) {
              anomalyType = ImpactAnomalyType.FRONT_RUNNING;
            }
          }
        }
      }
    }

    const isAnomaly = anomalyType !== null;

    // Update price history
    marketState.recentPrices.push({ price: trade.priceAfter, timestamp: now });
    // Clean old prices
    marketState.recentPrices = marketState.recentPrices.filter(
      (p) => now - p.timestamp < PRICE_HISTORY_WINDOW_MS
    );

    // Calculate context
    let sizePercentOfDailyVolume: number | null = null;
    let sizePercentOfDepth: number | null = null;
    let liquidityLevel = LiquidityLevel.MEDIUM;
    const hasLiquidityData = liquidity !== null;

    if (liquidity) {
      if (liquidity.avgDailyVolume > 0) {
        sizePercentOfDailyVolume = (trade.sizeUsd / liquidity.avgDailyVolume) * 100;
      }
      if (liquidity.totalDepth > 0) {
        sizePercentOfDepth = (trade.sizeUsd / liquidity.totalDepth) * 100;
      }
      liquidityLevel = classifyLiquidityLevel(
        liquidity.totalDepth,
        liquidity.avgDailyVolume
      );
    }

    const result: MarketImpactResult = {
      trade,
      actualImpact,
      absoluteImpact,
      impactBps,
      slippage,
      slippageBps,
      expectedImpact,
      impactRatio,
      isExcessive,
      severity,
      anomalyType,
      isAnomaly,
      analyzedAt: new Date(now),
      context: {
        sizePercentOfDailyVolume,
        sizePercentOfDepth,
        liquidityLevel,
        hasLiquidityData,
      },
    };

    // Handle high impact events
    if (
      severity !== ImpactSeverity.NEGLIGIBLE &&
      (isExcessive || isAnomaly || severity === ImpactSeverity.HIGH || severity === ImpactSeverity.EXTREME)
    ) {
      this.handleHighImpactTrade(trade, result, marketState, now, options);
    }

    return result;
  }

  /**
   * Calculate impact for multiple trades
   */
  batchCalculateImpact(
    trades: ImpactTradeData[],
    options?: CalculateImpactOptions
  ): BatchImpactResult {
    const startTime = Date.now();
    const results = new Map<string, MarketImpactResult>();
    const excessiveImpactTradeIds: string[] = [];
    const highImpactEvents: HighImpactEvent[] = [];

    const summary = {
      totalAnalyzed: trades.length,
      totalExcessive: 0,
      totalAnomalies: 0,
      bySeverity: {
        [ImpactSeverity.NEGLIGIBLE]: 0,
        [ImpactSeverity.LOW]: 0,
        [ImpactSeverity.MEDIUM]: 0,
        [ImpactSeverity.HIGH]: 0,
        [ImpactSeverity.EXTREME]: 0,
      } as Record<ImpactSeverity, number>,
      byAnomalyType: {
        [ImpactAnomalyType.EXCESSIVE_IMPACT]: 0,
        [ImpactAnomalyType.MUTED_IMPACT]: 0,
        [ImpactAnomalyType.PRICE_REVERSAL]: 0,
        [ImpactAnomalyType.DELAYED_IMPACT]: 0,
        [ImpactAnomalyType.FRONT_RUNNING]: 0,
      } as Record<ImpactAnomalyType, number>,
      averageImpactBps: 0,
      averageSlippageBps: 0,
    };

    let totalImpactBps = 0;
    let totalSlippageBps = 0;

    // Sort trades by timestamp for proper processing
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const trade of sortedTrades) {
      const result = this.calculateImpact(trade, options);
      results.set(trade.tradeId, result);

      summary.bySeverity[result.severity]++;
      totalImpactBps += result.impactBps;
      totalSlippageBps += result.slippageBps;

      if (result.isExcessive) {
        excessiveImpactTradeIds.push(trade.tradeId);
        summary.totalExcessive++;
      }

      if (result.isAnomaly && result.anomalyType) {
        summary.byAnomalyType[result.anomalyType]++;
        summary.totalAnomalies++;
      }
    }

    if (trades.length > 0) {
      summary.averageImpactBps = totalImpactBps / trades.length;
      summary.averageSlippageBps = totalSlippageBps / trades.length;
    }

    // Collect high impact events from recent events
    const processingStartTime = startTime;
    for (const event of this.recentEvents) {
      if (event.timestamp.getTime() >= processingStartTime) {
        highImpactEvents.push(event);
      }
    }

    return {
      results,
      excessiveImpactTradeIds,
      highImpactEvents,
      summary,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Update liquidity data for a market
   */
  updateLiquidityData(liquidity: MarketLiquidityData): void {
    const state = this.getOrCreateMarketState(liquidity.marketId);
    state.liquidityData = liquidity;
  }

  /**
   * Get cached liquidity data for a market
   */
  getLiquidityData(marketId: string): MarketLiquidityData | null {
    return this.marketStates.get(marketId)?.liquidityData ?? null;
  }

  /**
   * Get recent high impact events
   */
  getRecentEvents(limit: number = 20): HighImpactEvent[] {
    return this.recentEvents.slice(0, limit);
  }

  /**
   * Get high impact events for a specific market
   */
  getMarketEvents(marketId: string, limit: number = 10): HighImpactEvent[] {
    return this.recentEvents
      .filter((e) => e.trade.marketId === marketId)
      .slice(0, limit);
  }

  /**
   * Get high impact events for a specific wallet
   */
  getWalletEvents(walletAddress: string, limit: number = 10): HighImpactEvent[] {
    const lowercaseWallet = walletAddress.toLowerCase();
    return this.recentEvents
      .filter((e) => e.trade.walletAddress.toLowerCase() === lowercaseWallet)
      .slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(): MarketImpactSummary {
    const now = Date.now();

    // Calculate top markets by impact
    const marketImpactCounts = new Map<
      string,
      { count: number; totalBps: number }
    >();
    for (const event of this.recentEvents) {
      if (now - event.timestamp.getTime() < FREQUENCY_WINDOW_MS) {
        const current = marketImpactCounts.get(event.trade.marketId) ?? {
          count: 0,
          totalBps: 0,
        };
        marketImpactCounts.set(event.trade.marketId, {
          count: current.count + 1,
          totalBps: current.totalBps + event.impactResult.impactBps,
        });
      }
    }

    const topImpactMarkets = Array.from(marketImpactCounts.entries())
      .map(([marketId, data]) => ({
        marketId,
        eventCount: data.count,
        totalImpactBps: data.totalBps,
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Calculate top wallets by impact
    const walletImpactCounts = new Map<
      string,
      { count: number; totalBps: number }
    >();
    for (const event of this.recentEvents) {
      if (now - event.timestamp.getTime() < FREQUENCY_WINDOW_MS) {
        const wallet = event.trade.walletAddress.toLowerCase();
        const current = walletImpactCounts.get(wallet) ?? {
          count: 0,
          totalBps: 0,
        };
        walletImpactCounts.set(wallet, {
          count: current.count + 1,
          totalBps: current.totalBps + event.impactResult.impactBps,
        });
      }
    }

    const topImpactWallets = Array.from(walletImpactCounts.entries())
      .map(([walletAddress, data]) => ({
        walletAddress,
        eventCount: data.count,
        totalImpactBps: data.totalBps,
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    return {
      totalMarkets: this.marketStates.size,
      totalWallets: this.walletStates.size,
      totalHighImpactEvents: this.totalHighImpactEvents,
      bySeverity: { ...this.eventsBySeverity },
      byAnomalyType: { ...this.eventsByAnomalyType },
      recentEvents: this.recentEvents.slice(0, 20),
      topImpactMarkets,
      topImpactWallets,
    };
  }

  /**
   * Get severity thresholds
   */
  getThresholds(): ImpactSeverityThresholds {
    return { ...this.severityThresholds };
  }

  /**
   * Get excessive impact thresholds
   */
  getExcessiveThresholds(): ExcessiveImpactThresholds {
    return { ...this.excessiveThresholds };
  }

  /**
   * Get calculator statistics
   */
  getStats(): {
    trackedMarkets: number;
    trackedWallets: number;
    totalHighImpactEvents: number;
    recentEventsCount: number;
    alertCooldownMs: number;
    impactModelCoefficient: number;
  } {
    return {
      trackedMarkets: this.marketStates.size,
      trackedWallets: this.walletStates.size,
      totalHighImpactEvents: this.totalHighImpactEvents,
      recentEventsCount: this.recentEvents.length,
      alertCooldownMs: this.alertCooldownMs,
      impactModelCoefficient: this.impactModelCoefficient,
    };
  }

  /**
   * Clear state for a specific market
   */
  clearMarket(marketId: string): boolean {
    return this.marketStates.delete(marketId);
  }

  /**
   * Clear state for a specific wallet
   */
  clearWallet(walletAddress: string): boolean {
    return this.walletStates.delete(walletAddress.toLowerCase());
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.marketStates.clear();
    this.walletStates.clear();
    this.recentEvents.length = 0;
    this.totalHighImpactEvents = 0;
    this.eventsBySeverity = {
      [ImpactSeverity.NEGLIGIBLE]: 0,
      [ImpactSeverity.LOW]: 0,
      [ImpactSeverity.MEDIUM]: 0,
      [ImpactSeverity.HIGH]: 0,
      [ImpactSeverity.EXTREME]: 0,
    };
    this.eventsByAnomalyType = {
      [ImpactAnomalyType.EXCESSIVE_IMPACT]: 0,
      [ImpactAnomalyType.MUTED_IMPACT]: 0,
      [ImpactAnomalyType.PRICE_REVERSAL]: 0,
      [ImpactAnomalyType.DELAYED_IMPACT]: 0,
      [ImpactAnomalyType.FRONT_RUNNING]: 0,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getOrCreateMarketState(marketId: string): MarketImpactState {
    let state = this.marketStates.get(marketId);
    if (!state) {
      state = {
        recentPrices: [],
        highImpactCount: 0,
        lastAlertTime: null,
        liquidityData: null,
      };
      this.marketStates.set(marketId, state);
    }
    return state;
  }

  private getOrCreateWalletState(walletAddress: string): WalletImpactState {
    const key = walletAddress.toLowerCase();
    let state = this.walletStates.get(key);
    if (!state) {
      state = {
        highImpactCount: 0,
        totalImpactBps: 0,
      };
      this.walletStates.set(key, state);
    }
    return state;
  }

  private handleHighImpactTrade(
    trade: ImpactTradeData,
    result: MarketImpactResult,
    marketState: MarketImpactState,
    now: number,
    options?: CalculateImpactOptions
  ): void {
    // Check cooldown
    if (
      !options?.bypassCooldown &&
      marketState.lastAlertTime !== null &&
      now - marketState.lastAlertTime < this.alertCooldownMs
    ) {
      return;
    }

    // Update wallet state
    const walletState = this.getOrCreateWalletState(trade.walletAddress);
    walletState.highImpactCount++;
    walletState.totalImpactBps += result.impactBps;

    // Update market state
    marketState.highImpactCount++;
    marketState.lastAlertTime = now;

    // Count high impact trades in last hour
    const highImpactTradesLastHour = this.recentEvents.filter(
      (e) => now - e.timestamp.getTime() < FREQUENCY_WINDOW_MS
    ).length;

    // Create event
    const event: HighImpactEvent = {
      eventId: generateEventId(),
      trade,
      impactResult: result,
      severity: result.severity,
      anomalyType: result.anomalyType,
      timestamp: new Date(now),
      context: {
        highImpactTradesLastHour,
        walletHighImpactCount: walletState.highImpactCount,
        marketHighImpactCount: marketState.highImpactCount,
      },
    };

    // Store event
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    // Update statistics
    this.totalHighImpactEvents++;
    this.eventsBySeverity[result.severity]++;
    if (result.anomalyType) {
      this.eventsByAnomalyType[result.anomalyType]++;
    }

    // Emit events
    if (this.enableEvents) {
      this.emit("highImpact", event);

      if (result.isExcessive) {
        this.emit("excessiveImpact", event);
      }

      if (result.isAnomaly) {
        this.emit("anomalyDetected", event);
      }
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedCalculator: MarketImpactCalculator | null = null;

/**
 * Create a new MarketImpactCalculator instance
 */
export function createMarketImpactCalculator(
  config?: MarketImpactCalculatorConfig
): MarketImpactCalculator {
  return new MarketImpactCalculator(config);
}

/**
 * Get the shared MarketImpactCalculator instance
 */
export function getSharedMarketImpactCalculator(): MarketImpactCalculator {
  if (!sharedCalculator) {
    sharedCalculator = new MarketImpactCalculator();
  }
  return sharedCalculator;
}

/**
 * Set the shared MarketImpactCalculator instance
 */
export function setSharedMarketImpactCalculator(
  calculator: MarketImpactCalculator
): void {
  sharedCalculator = calculator;
}

/**
 * Reset the shared MarketImpactCalculator instance
 */
export function resetSharedMarketImpactCalculator(): void {
  if (sharedCalculator) {
    sharedCalculator.clearAll();
    sharedCalculator.removeAllListeners();
  }
  sharedCalculator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate market impact of a trade (convenience function)
 */
export function calculateMarketImpact(
  trade: ImpactTradeData,
  options?: CalculateImpactOptions & { calculator?: MarketImpactCalculator }
): MarketImpactResult {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  return calculator.calculateImpact(trade, options);
}

/**
 * Batch calculate market impact (convenience function)
 */
export function batchCalculateMarketImpact(
  trades: ImpactTradeData[],
  options?: CalculateImpactOptions & { calculator?: MarketImpactCalculator }
): BatchImpactResult {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  return calculator.batchCalculateImpact(trades, options);
}

/**
 * Check if a trade has excessive impact (convenience function)
 */
export function hasExcessiveImpact(
  trade: ImpactTradeData,
  options?: CalculateImpactOptions & { calculator?: MarketImpactCalculator }
): boolean {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  const result = calculator.calculateImpact(trade, options);
  return result.isExcessive;
}

/**
 * Get impact severity for a trade (convenience function)
 */
export function getTradeImpactSeverity(
  trade: ImpactTradeData,
  options?: CalculateImpactOptions & { calculator?: MarketImpactCalculator }
): ImpactSeverity {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  const result = calculator.calculateImpact(trade, options);
  return result.severity;
}

/**
 * Get recent high impact events (convenience function)
 */
export function getRecentHighImpactEvents(
  limit?: number,
  options?: { calculator?: MarketImpactCalculator }
): HighImpactEvent[] {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  return calculator.getRecentEvents(limit);
}

/**
 * Get market impact summary (convenience function)
 */
export function getMarketImpactSummary(
  options?: { calculator?: MarketImpactCalculator }
): MarketImpactSummary {
  const calculator = options?.calculator ?? getSharedMarketImpactCalculator();
  return calculator.getSummary();
}
