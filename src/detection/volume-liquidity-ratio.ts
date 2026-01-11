/**
 * Volume-to-Liquidity Ratio Analyzer (DET-VOL-006)
 *
 * Analyze trade volume relative to available liquidity to detect potentially
 * market-moving trades and abnormal trading patterns.
 *
 * Features:
 * - Get order book depth for liquidity assessment
 * - Calculate volume/liquidity ratio for trades
 * - Flag high ratio trades that may impact price
 * - Track ratio over time for pattern detection
 * - Support for multiple ratio calculation methods
 * - Event emission for high ratio alerts
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Severity level for volume-liquidity ratio flags
 */
export enum RatioSeverity {
  /** Normal ratio - no concern */
  NORMAL = "NORMAL",
  /** Elevated ratio - worth monitoring */
  ELEVATED = "ELEVATED",
  /** High ratio - potential market impact */
  HIGH = "HIGH",
  /** Very high ratio - likely market impact */
  VERY_HIGH = "VERY_HIGH",
  /** Critical ratio - extreme market impact potential */
  CRITICAL = "CRITICAL",
}

/**
 * Type of liquidity measurement used
 */
export enum LiquidityMeasure {
  /** Total order book liquidity (bids + asks) */
  TOTAL = "TOTAL",
  /** Liquidity on bid side only */
  BID_SIDE = "BID_SIDE",
  /** Liquidity on ask side only */
  ASK_SIDE = "ASK_SIDE",
  /** Liquidity within specific price range */
  PRICE_RANGE = "PRICE_RANGE",
  /** Liquidity at best bid/ask */
  TOP_OF_BOOK = "TOP_OF_BOOK",
  /** Volume-weighted average depth */
  WEIGHTED_DEPTH = "WEIGHTED_DEPTH",
}

/**
 * Direction of the trade for ratio calculation
 */
export enum TradeDirection {
  /** Buy order - consumes ask liquidity */
  BUY = "BUY",
  /** Sell order - consumes bid liquidity */
  SELL = "SELL",
  /** Unknown direction */
  UNKNOWN = "UNKNOWN",
}

/**
 * Order book snapshot for liquidity calculation
 */
export interface OrderBookSnapshot {
  /** Market identifier */
  marketId: string;

  /** Timestamp of snapshot */
  timestamp: Date;

  /** Total bid volume in USD */
  totalBidVolumeUsd: number;

  /** Total ask volume in USD */
  totalAskVolumeUsd: number;

  /** Volume at best bid */
  bestBidVolumeUsd: number;

  /** Volume at best ask */
  bestAskVolumeUsd: number;

  /** Best bid price */
  bestBidPrice: number | null;

  /** Best ask price */
  bestAskPrice: number | null;

  /** Spread in percentage */
  spreadPercent: number | null;

  /** Number of bid levels */
  bidLevels: number;

  /** Number of ask levels */
  askLevels: number;

  /** Liquidity at 1% price impact (bid side) */
  bidVolumeAt1Percent: number;

  /** Liquidity at 1% price impact (ask side) */
  askVolumeAt1Percent: number;

  /** Liquidity at 2% price impact (bid side) */
  bidVolumeAt2Percent: number;

  /** Liquidity at 2% price impact (ask side) */
  askVolumeAt2Percent: number;

  /** Liquidity at 5% price impact (bid side) */
  bidVolumeAt5Percent: number;

  /** Liquidity at 5% price impact (ask side) */
  askVolumeAt5Percent: number;
}

/**
 * Trade data for ratio analysis
 */
export interface TradeForRatioAnalysis {
  /** Unique trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address */
  walletAddress: string;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade direction */
  direction: TradeDirection;

  /** Trade timestamp */
  timestamp: Date;

  /** Execution price */
  price?: number;
}

/**
 * Result of volume-to-liquidity ratio analysis
 */
export interface RatioAnalysisResult {
  /** Trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address */
  walletAddress: string;

  /** Trade size in USD */
  tradeSizeUsd: number;

  /** Trade direction */
  direction: TradeDirection;

  /** Primary ratio value (trade size / relevant liquidity) */
  ratio: number;

  /** Ratio as percentage */
  ratioPercent: number;

  /** Liquidity measure used */
  liquidityMeasure: LiquidityMeasure;

  /** Available liquidity in USD */
  availableLiquidityUsd: number;

  /** Severity classification */
  severity: RatioSeverity;

  /** Whether this trade is flagged as high ratio */
  isFlagged: boolean;

  /** Estimated price impact percentage */
  estimatedPriceImpactPercent: number;

  /** Confidence in the analysis (0-1) */
  confidence: number;

  /** Additional ratios for different liquidity measures */
  additionalRatios: {
    /** Ratio to total liquidity */
    totalLiquidityRatio: number;
    /** Ratio to 1% depth */
    depthAt1PercentRatio: number;
    /** Ratio to 2% depth */
    depthAt2PercentRatio: number;
    /** Ratio to 5% depth */
    depthAt5PercentRatio: number;
    /** Ratio to top of book */
    topOfBookRatio: number;
  };

  /** Timestamp of analysis */
  analyzedAt: Date;

  /** Order book snapshot used */
  orderBookSnapshot: OrderBookSnapshot | null;
}

/**
 * Historical ratio data point
 */
export interface RatioHistoryEntry {
  /** Trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Ratio value */
  ratio: number;

  /** Severity at time of trade */
  severity: RatioSeverity;

  /** Trade size */
  tradeSizeUsd: number;

  /** Available liquidity at time */
  liquidityUsd: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Market ratio statistics
 */
export interface MarketRatioStats {
  /** Market identifier */
  marketId: string;

  /** Number of trades analyzed */
  tradeCount: number;

  /** Average ratio */
  averageRatio: number;

  /** Median ratio */
  medianRatio: number;

  /** Standard deviation of ratios */
  standardDeviation: number;

  /** Maximum ratio observed */
  maxRatio: number;

  /** Minimum ratio observed */
  minRatio: number;

  /** 95th percentile ratio */
  p95Ratio: number;

  /** 99th percentile ratio */
  p99Ratio: number;

  /** Number of flagged trades */
  flaggedTradeCount: number;

  /** Flag rate percentage */
  flagRate: number;

  /** Count by severity */
  severityCounts: Record<RatioSeverity, number>;

  /** Average available liquidity */
  averageLiquidityUsd: number;

  /** Time range of data */
  timeRange: {
    startTime: Date;
    endTime: Date;
  };

  /** Last updated */
  lastUpdated: Date;
}

/**
 * High ratio alert event
 */
export interface HighRatioAlertEvent {
  /** Trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address */
  walletAddress: string;

  /** Ratio value */
  ratio: number;

  /** Severity */
  severity: RatioSeverity;

  /** Trade size */
  tradeSizeUsd: number;

  /** Available liquidity */
  liquidityUsd: number;

  /** Estimated price impact */
  estimatedPriceImpactPercent: number;

  /** Alert timestamp */
  alertedAt: Date;

  /** Additional context */
  context: {
    /** How ratio compares to market average */
    ratioVsAverage: number;
    /** Previous high ratio from this wallet */
    previousHighRatio: number | null;
    /** Market average liquidity */
    marketAvgLiquidity: number;
  };
}

/**
 * Configuration for ratio thresholds
 */
export interface RatioThresholdConfig {
  /** Ratio threshold for ELEVATED severity */
  elevated: number;

  /** Ratio threshold for HIGH severity */
  high: number;

  /** Ratio threshold for VERY_HIGH severity */
  veryHigh: number;

  /** Ratio threshold for CRITICAL severity */
  critical: number;
}

/**
 * Configuration for the analyzer
 */
export interface VolumeLiquidityRatioAnalyzerConfig {
  /** Ratio thresholds for severity classification */
  thresholds?: Partial<RatioThresholdConfig>;

  /** Default liquidity measure to use */
  defaultLiquidityMeasure?: LiquidityMeasure;

  /** Whether to enable event emission */
  enableEvents?: boolean;

  /** Maximum history entries to keep per market */
  maxHistoryPerMarket?: number;

  /** Maximum markets to track */
  maxMarketsTracked?: number;

  /** Minimum liquidity for valid analysis */
  minLiquidityUsd?: number;

  /** Cache TTL for order book snapshots in ms */
  orderBookCacheTtlMs?: number;

  /** Price impact estimation factor */
  priceImpactFactor?: number;
}

/**
 * Options for analyzing a trade
 */
export interface AnalyzeRatioOptions {
  /** Override liquidity measure */
  liquidityMeasure?: LiquidityMeasure;

  /** Provide custom order book snapshot */
  orderBook?: OrderBookSnapshot;

  /** Skip flagging (just calculate ratio) */
  skipFlagging?: boolean;

  /** Include in history tracking */
  trackHistory?: boolean;
}

/**
 * Batch analysis result
 */
export interface BatchRatioAnalysisResult {
  /** Successful analyses */
  results: RatioAnalysisResult[];

  /** Errors by trade ID */
  errors: Map<string, string>;

  /** Processing time in ms */
  processingTimeMs: number;

  /** Number of flagged trades */
  flaggedCount: number;

  /** Average ratio */
  averageRatio: number;
}

/**
 * Analyzer summary
 */
export interface RatioAnalyzerSummary {
  /** Total markets tracked */
  totalMarketsTracked: number;

  /** Total trades analyzed */
  totalTradesAnalyzed: number;

  /** Total trades flagged */
  totalTradesFlagged: number;

  /** Overall flag rate */
  overallFlagRate: number;

  /** Average ratio across all trades */
  globalAverageRatio: number;

  /** Severity distribution */
  severityDistribution: Record<RatioSeverity, number>;

  /** Top flagged markets */
  topFlaggedMarkets: Array<{
    marketId: string;
    flagCount: number;
    flagRate: number;
  }>;

  /** Recent alerts */
  recentAlerts: HighRatioAlertEvent[];

  /** Cache statistics */
  cacheStats: {
    orderBookCacheSize: number;
    historyEntriesCount: number;
  };

  /** Last activity */
  lastActivityTime: Date | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default ratio thresholds */
export const DEFAULT_RATIO_THRESHOLDS: RatioThresholdConfig = {
  elevated: 0.05, // 5% of liquidity
  high: 0.1, // 10% of liquidity
  veryHigh: 0.2, // 20% of liquidity
  critical: 0.5, // 50% of liquidity
};

/** Default analyzer configuration */
const DEFAULT_CONFIG: Required<VolumeLiquidityRatioAnalyzerConfig> = {
  thresholds: DEFAULT_RATIO_THRESHOLDS,
  defaultLiquidityMeasure: LiquidityMeasure.PRICE_RANGE,
  enableEvents: true,
  maxHistoryPerMarket: 1000,
  maxMarketsTracked: 500,
  minLiquidityUsd: 100,
  orderBookCacheTtlMs: 30000, // 30 seconds
  priceImpactFactor: 2.0, // Estimated impact = ratio * factor
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArray[lower]!;
  return sortedArray[lower]! * (upper - index) + sortedArray[upper]! * (index - lower);
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Get relevant liquidity based on trade direction and measure
 */
function getRelevantLiquidity(
  orderBook: OrderBookSnapshot,
  direction: TradeDirection,
  measure: LiquidityMeasure
): number {
  switch (measure) {
    case LiquidityMeasure.TOTAL:
      return orderBook.totalBidVolumeUsd + orderBook.totalAskVolumeUsd;

    case LiquidityMeasure.BID_SIDE:
      return orderBook.totalBidVolumeUsd;

    case LiquidityMeasure.ASK_SIDE:
      return orderBook.totalAskVolumeUsd;

    case LiquidityMeasure.TOP_OF_BOOK:
      if (direction === TradeDirection.BUY) {
        return orderBook.bestAskVolumeUsd;
      } else if (direction === TradeDirection.SELL) {
        return orderBook.bestBidVolumeUsd;
      }
      return Math.min(orderBook.bestBidVolumeUsd, orderBook.bestAskVolumeUsd);

    case LiquidityMeasure.PRICE_RANGE:
      // Use 2% depth as default price range
      if (direction === TradeDirection.BUY) {
        return orderBook.askVolumeAt2Percent || orderBook.totalAskVolumeUsd;
      } else if (direction === TradeDirection.SELL) {
        return orderBook.bidVolumeAt2Percent || orderBook.totalBidVolumeUsd;
      }
      return Math.min(
        orderBook.bidVolumeAt2Percent || orderBook.totalBidVolumeUsd,
        orderBook.askVolumeAt2Percent || orderBook.totalAskVolumeUsd
      );

    case LiquidityMeasure.WEIGHTED_DEPTH:
      // Weighted average of different depths
      const weights = [0.5, 0.3, 0.2]; // 1%, 2%, 5% depths
      if (direction === TradeDirection.BUY) {
        return (
          orderBook.askVolumeAt1Percent * weights[0]! +
          orderBook.askVolumeAt2Percent * weights[1]! +
          orderBook.askVolumeAt5Percent * weights[2]!
        );
      } else if (direction === TradeDirection.SELL) {
        return (
          orderBook.bidVolumeAt1Percent * weights[0]! +
          orderBook.bidVolumeAt2Percent * weights[1]! +
          orderBook.bidVolumeAt5Percent * weights[2]!
        );
      }
      const bidWeighted =
        orderBook.bidVolumeAt1Percent * weights[0]! +
        orderBook.bidVolumeAt2Percent * weights[1]! +
        orderBook.bidVolumeAt5Percent * weights[2]!;
      const askWeighted =
        orderBook.askVolumeAt1Percent * weights[0]! +
        orderBook.askVolumeAt2Percent * weights[1]! +
        orderBook.askVolumeAt5Percent * weights[2]!;
      return Math.min(bidWeighted, askWeighted);

    default:
      return orderBook.totalBidVolumeUsd + orderBook.totalAskVolumeUsd;
  }
}

/**
 * Classify severity based on ratio
 */
function classifySeverity(ratio: number, thresholds: RatioThresholdConfig): RatioSeverity {
  if (ratio >= thresholds.critical) return RatioSeverity.CRITICAL;
  if (ratio >= thresholds.veryHigh) return RatioSeverity.VERY_HIGH;
  if (ratio >= thresholds.high) return RatioSeverity.HIGH;
  if (ratio >= thresholds.elevated) return RatioSeverity.ELEVATED;
  return RatioSeverity.NORMAL;
}

/**
 * Calculate confidence based on data quality
 */
function calculateConfidence(orderBook: OrderBookSnapshot | null, _tradeSizeUsd: number): number {
  if (!orderBook) return 0.1;

  let confidence = 0.5;

  // More liquidity levels = higher confidence
  if (orderBook.bidLevels >= 5 && orderBook.askLevels >= 5) {
    confidence += 0.15;
  }

  // Has depth data at multiple levels
  if (
    orderBook.bidVolumeAt1Percent > 0 &&
    orderBook.bidVolumeAt2Percent > 0 &&
    orderBook.bidVolumeAt5Percent > 0
  ) {
    confidence += 0.15;
  }

  // Reasonable spread
  if (orderBook.spreadPercent !== null && orderBook.spreadPercent < 5) {
    confidence += 0.1;
  }

  // Fresh snapshot
  const snapshotAge = Date.now() - orderBook.timestamp.getTime();
  if (snapshotAge < 60000) {
    // Less than 1 minute old
    confidence += 0.1;
  }

  return Math.min(1.0, confidence);
}

/**
 * Estimate price impact based on ratio
 */
function estimatePriceImpact(ratio: number, factor: number): number {
  // Simple linear estimation with diminishing returns
  // Real impact is often non-linear but this gives a rough estimate
  const baseImpact = ratio * factor * 100;
  // Cap at reasonable maximum
  return Math.min(baseImpact, 50);
}

// ============================================================================
// Order Book Cache Entry
// ============================================================================

interface OrderBookCacheEntry {
  snapshot: OrderBookSnapshot;
  expiresAt: number;
}

// ============================================================================
// VolumeLiquidityRatioAnalyzer Class
// ============================================================================

/**
 * Analyzer for volume-to-liquidity ratios
 */
export class VolumeLiquidityRatioAnalyzer extends EventEmitter {
  private config: Required<VolumeLiquidityRatioAnalyzerConfig>;
  private thresholds: RatioThresholdConfig;
  private orderBookCache: Map<string, OrderBookCacheEntry>;
  private marketHistory: Map<string, RatioHistoryEntry[]>;
  private marketStats: Map<string, MarketRatioStats>;
  private walletHighRatios: Map<string, number>;
  private recentAlerts: HighRatioAlertEvent[];
  private totalTradesAnalyzed: number;
  private totalTradesFlagged: number;
  private lastActivityTime: Date | null;

  constructor(config: VolumeLiquidityRatioAnalyzerConfig = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: { ...DEFAULT_RATIO_THRESHOLDS, ...config.thresholds },
    };
    this.thresholds = this.config.thresholds as RatioThresholdConfig;
    this.orderBookCache = new Map();
    this.marketHistory = new Map();
    this.marketStats = new Map();
    this.walletHighRatios = new Map();
    this.recentAlerts = [];
    this.totalTradesAnalyzed = 0;
    this.totalTradesFlagged = 0;
    this.lastActivityTime = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<VolumeLiquidityRatioAnalyzerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VolumeLiquidityRatioAnalyzerConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      thresholds: { ...this.thresholds, ...updates.thresholds },
    };
    this.thresholds = this.config.thresholds as RatioThresholdConfig;
  }

  /**
   * Update order book cache for a market
   */
  updateOrderBook(orderBook: OrderBookSnapshot): void {
    this.orderBookCache.set(orderBook.marketId, {
      snapshot: orderBook,
      expiresAt: Date.now() + this.config.orderBookCacheTtlMs,
    });
  }

  /**
   * Get cached order book for a market
   */
  getCachedOrderBook(marketId: string): OrderBookSnapshot | null {
    const entry = this.orderBookCache.get(marketId);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) {
        this.orderBookCache.delete(marketId);
      }
      return null;
    }
    return entry.snapshot;
  }

  /**
   * Analyze volume-to-liquidity ratio for a trade
   */
  analyzeRatio(trade: TradeForRatioAnalysis, options: AnalyzeRatioOptions = {}): RatioAnalysisResult {
    this.totalTradesAnalyzed++;
    this.lastActivityTime = new Date();

    // Get order book snapshot
    const orderBook = options.orderBook ?? this.getCachedOrderBook(trade.marketId);

    // Determine liquidity measure
    const measure = options.liquidityMeasure ?? this.config.defaultLiquidityMeasure;

    // Calculate available liquidity
    let availableLiquidityUsd = 0;
    if (orderBook) {
      availableLiquidityUsd = getRelevantLiquidity(orderBook, trade.direction, measure);
    }

    // Handle case where no liquidity data
    if (availableLiquidityUsd < this.config.minLiquidityUsd) {
      // Use minimum liquidity to avoid division by zero and extreme ratios
      availableLiquidityUsd = this.config.minLiquidityUsd;
    }

    // Calculate primary ratio
    const ratio = trade.sizeUsd / availableLiquidityUsd;
    const ratioPercent = ratio * 100;

    // Calculate additional ratios
    const additionalRatios = this.calculateAdditionalRatios(trade, orderBook);

    // Classify severity
    const severity = classifySeverity(ratio, this.thresholds);

    // Determine if flagged
    const isFlagged = !options.skipFlagging && severity !== RatioSeverity.NORMAL;

    // Estimate price impact
    const estimatedPriceImpactPercent = estimatePriceImpact(ratio, this.config.priceImpactFactor);

    // Calculate confidence
    const confidence = calculateConfidence(orderBook, trade.sizeUsd);

    if (isFlagged) {
      this.totalTradesFlagged++;
    }

    const result: RatioAnalysisResult = {
      tradeId: trade.tradeId,
      marketId: trade.marketId,
      walletAddress: trade.walletAddress,
      tradeSizeUsd: trade.sizeUsd,
      direction: trade.direction,
      ratio,
      ratioPercent,
      liquidityMeasure: measure,
      availableLiquidityUsd,
      severity,
      isFlagged,
      estimatedPriceImpactPercent,
      confidence,
      additionalRatios,
      analyzedAt: new Date(),
      orderBookSnapshot: orderBook,
    };

    // Track history if enabled
    if (options.trackHistory !== false) {
      this.addToHistory(result);
    }

    // Update market stats
    this.updateMarketStats(trade.marketId, result);

    // Emit alert if flagged and events enabled
    if (isFlagged && this.config.enableEvents) {
      this.emitHighRatioAlert(result);
    }

    return result;
  }

  /**
   * Calculate additional ratios for different liquidity measures
   */
  private calculateAdditionalRatios(
    trade: TradeForRatioAnalysis,
    orderBook: OrderBookSnapshot | null
  ): RatioAnalysisResult["additionalRatios"] {
    if (!orderBook) {
      return {
        totalLiquidityRatio: 0,
        depthAt1PercentRatio: 0,
        depthAt2PercentRatio: 0,
        depthAt5PercentRatio: 0,
        topOfBookRatio: 0,
      };
    }

    const totalLiquidity = orderBook.totalBidVolumeUsd + orderBook.totalAskVolumeUsd;
    const topOfBook =
      trade.direction === TradeDirection.BUY
        ? orderBook.bestAskVolumeUsd
        : trade.direction === TradeDirection.SELL
          ? orderBook.bestBidVolumeUsd
          : Math.min(orderBook.bestBidVolumeUsd, orderBook.bestAskVolumeUsd);

    const depth1 =
      trade.direction === TradeDirection.BUY
        ? orderBook.askVolumeAt1Percent
        : trade.direction === TradeDirection.SELL
          ? orderBook.bidVolumeAt1Percent
          : Math.min(orderBook.bidVolumeAt1Percent, orderBook.askVolumeAt1Percent);

    const depth2 =
      trade.direction === TradeDirection.BUY
        ? orderBook.askVolumeAt2Percent
        : trade.direction === TradeDirection.SELL
          ? orderBook.bidVolumeAt2Percent
          : Math.min(orderBook.bidVolumeAt2Percent, orderBook.askVolumeAt2Percent);

    const depth5 =
      trade.direction === TradeDirection.BUY
        ? orderBook.askVolumeAt5Percent
        : trade.direction === TradeDirection.SELL
          ? orderBook.bidVolumeAt5Percent
          : Math.min(orderBook.bidVolumeAt5Percent, orderBook.askVolumeAt5Percent);

    const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

    return {
      totalLiquidityRatio: safeDivide(trade.sizeUsd, totalLiquidity),
      depthAt1PercentRatio: safeDivide(trade.sizeUsd, depth1),
      depthAt2PercentRatio: safeDivide(trade.sizeUsd, depth2),
      depthAt5PercentRatio: safeDivide(trade.sizeUsd, depth5),
      topOfBookRatio: safeDivide(trade.sizeUsd, topOfBook),
    };
  }

  /**
   * Add analysis result to history
   */
  private addToHistory(result: RatioAnalysisResult): void {
    const entry: RatioHistoryEntry = {
      tradeId: result.tradeId,
      marketId: result.marketId,
      ratio: result.ratio,
      severity: result.severity,
      tradeSizeUsd: result.tradeSizeUsd,
      liquidityUsd: result.availableLiquidityUsd,
      timestamp: result.analyzedAt,
    };

    let history = this.marketHistory.get(result.marketId);
    if (!history) {
      history = [];
      this.marketHistory.set(result.marketId, history);
    }

    history.push(entry);

    // Trim to max history
    while (history.length > this.config.maxHistoryPerMarket) {
      history.shift();
    }

    // Enforce max markets
    if (this.marketHistory.size > this.config.maxMarketsTracked) {
      const oldestMarket = this.marketHistory.keys().next().value;
      if (oldestMarket) {
        this.marketHistory.delete(oldestMarket);
        this.marketStats.delete(oldestMarket);
      }
    }
  }

  /**
   * Update market statistics
   */
  private updateMarketStats(marketId: string, _result: RatioAnalysisResult): void {
    const history = this.marketHistory.get(marketId);
    if (!history || history.length === 0) return;

    const ratios = history.map((h) => h.ratio);
    const sortedRatios = [...ratios].sort((a, b) => a - b);
    const liquidities = history.map((h) => h.liquidityUsd);

    const sum = ratios.reduce((a, b) => a + b, 0);
    const avg = sum / ratios.length;
    const stdDev = standardDeviation(ratios, avg);

    const flaggedCount = history.filter((h) => h.severity !== RatioSeverity.NORMAL).length;

    const severityCounts: Record<RatioSeverity, number> = {
      [RatioSeverity.NORMAL]: 0,
      [RatioSeverity.ELEVATED]: 0,
      [RatioSeverity.HIGH]: 0,
      [RatioSeverity.VERY_HIGH]: 0,
      [RatioSeverity.CRITICAL]: 0,
    };

    for (const entry of history) {
      severityCounts[entry.severity]++;
    }

    const stats: MarketRatioStats = {
      marketId,
      tradeCount: history.length,
      averageRatio: avg,
      medianRatio: percentile(sortedRatios, 50),
      standardDeviation: stdDev,
      maxRatio: Math.max(...ratios),
      minRatio: Math.min(...ratios),
      p95Ratio: percentile(sortedRatios, 95),
      p99Ratio: percentile(sortedRatios, 99),
      flaggedTradeCount: flaggedCount,
      flagRate: (flaggedCount / history.length) * 100,
      severityCounts,
      averageLiquidityUsd: liquidities.reduce((a, b) => a + b, 0) / liquidities.length,
      timeRange: {
        startTime: history[0]!.timestamp,
        endTime: history[history.length - 1]!.timestamp,
      },
      lastUpdated: new Date(),
    };

    this.marketStats.set(marketId, stats);
  }

  /**
   * Emit high ratio alert
   */
  private emitHighRatioAlert(result: RatioAnalysisResult): void {
    const stats = this.marketStats.get(result.marketId);
    const previousHighRatio = this.walletHighRatios.get(result.walletAddress) ?? null;

    // Update wallet high ratio tracking
    if (previousHighRatio === null || result.ratio > previousHighRatio) {
      this.walletHighRatios.set(result.walletAddress, result.ratio);
    }

    const alert: HighRatioAlertEvent = {
      tradeId: result.tradeId,
      marketId: result.marketId,
      walletAddress: result.walletAddress,
      ratio: result.ratio,
      severity: result.severity,
      tradeSizeUsd: result.tradeSizeUsd,
      liquidityUsd: result.availableLiquidityUsd,
      estimatedPriceImpactPercent: result.estimatedPriceImpactPercent,
      alertedAt: new Date(),
      context: {
        ratioVsAverage: stats ? result.ratio / stats.averageRatio : 1,
        previousHighRatio,
        marketAvgLiquidity: stats?.averageLiquidityUsd ?? result.availableLiquidityUsd,
      },
    };

    this.recentAlerts.push(alert);

    // Keep only recent alerts (last 100)
    while (this.recentAlerts.length > 100) {
      this.recentAlerts.shift();
    }

    this.emit("highRatio", alert);
  }

  /**
   * Analyze multiple trades in batch
   */
  analyzeRatioBatch(
    trades: TradeForRatioAnalysis[],
    options: AnalyzeRatioOptions = {}
  ): BatchRatioAnalysisResult {
    const startTime = Date.now();
    const results: RatioAnalysisResult[] = [];
    const errors = new Map<string, string>();
    let flaggedCount = 0;
    let totalRatio = 0;

    for (const trade of trades) {
      try {
        const result = this.analyzeRatio(trade, options);
        results.push(result);
        if (result.isFlagged) {
          flaggedCount++;
        }
        totalRatio += result.ratio;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(trade.tradeId, message);
      }
    }

    return {
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
      flaggedCount,
      averageRatio: results.length > 0 ? totalRatio / results.length : 0,
    };
  }

  /**
   * Check if a trade has a high ratio (quick check)
   */
  isHighRatio(trade: TradeForRatioAnalysis, orderBook?: OrderBookSnapshot): boolean {
    const ob = orderBook ?? this.getCachedOrderBook(trade.marketId);
    if (!ob) return false;

    const liquidity = getRelevantLiquidity(ob, trade.direction, this.config.defaultLiquidityMeasure);
    if (liquidity < this.config.minLiquidityUsd) return false;

    const ratio = trade.sizeUsd / liquidity;
    return ratio >= this.thresholds.elevated;
  }

  /**
   * Get market statistics
   */
  getMarketStats(marketId: string): MarketRatioStats | null {
    return this.marketStats.get(marketId) ?? null;
  }

  /**
   * Get market ratio history
   */
  getMarketHistory(marketId: string, limit?: number): RatioHistoryEntry[] {
    const history = this.marketHistory.get(marketId) ?? [];
    if (limit !== undefined && limit > 0) {
      return history.slice(-limit);
    }
    return [...history];
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit?: number): HighRatioAlertEvent[] {
    if (limit !== undefined && limit > 0) {
      return this.recentAlerts.slice(-limit);
    }
    return [...this.recentAlerts];
  }

  /**
   * Get ratio percentile for a market
   */
  getRatioPercentile(marketId: string, ratio: number): number {
    const history = this.marketHistory.get(marketId);
    if (!history || history.length === 0) return 0;

    const belowCount = history.filter((h) => h.ratio < ratio).length;
    return (belowCount / history.length) * 100;
  }

  /**
   * Get analyzer summary
   */
  getSummary(): RatioAnalyzerSummary {
    const severityDistribution: Record<RatioSeverity, number> = {
      [RatioSeverity.NORMAL]: 0,
      [RatioSeverity.ELEVATED]: 0,
      [RatioSeverity.HIGH]: 0,
      [RatioSeverity.VERY_HIGH]: 0,
      [RatioSeverity.CRITICAL]: 0,
    };

    let totalRatio = 0;
    let totalCount = 0;

    const marketFlagData: Array<{ marketId: string; flagCount: number; flagRate: number }> = [];

    for (const [marketId, stats] of this.marketStats.entries()) {
      for (const [severity, count] of Object.entries(stats.severityCounts)) {
        severityDistribution[severity as RatioSeverity] += count;
      }
      totalRatio += stats.averageRatio * stats.tradeCount;
      totalCount += stats.tradeCount;

      marketFlagData.push({
        marketId,
        flagCount: stats.flaggedTradeCount,
        flagRate: stats.flagRate,
      });
    }

    // Sort by flag count descending
    marketFlagData.sort((a, b) => b.flagCount - a.flagCount);

    let historyCount = 0;
    for (const history of this.marketHistory.values()) {
      historyCount += history.length;
    }

    return {
      totalMarketsTracked: this.marketStats.size,
      totalTradesAnalyzed: this.totalTradesAnalyzed,
      totalTradesFlagged: this.totalTradesFlagged,
      overallFlagRate:
        this.totalTradesAnalyzed > 0
          ? (this.totalTradesFlagged / this.totalTradesAnalyzed) * 100
          : 0,
      globalAverageRatio: totalCount > 0 ? totalRatio / totalCount : 0,
      severityDistribution,
      topFlaggedMarkets: marketFlagData.slice(0, 10),
      recentAlerts: this.recentAlerts.slice(-10),
      cacheStats: {
        orderBookCacheSize: this.orderBookCache.size,
        historyEntriesCount: historyCount,
      },
      lastActivityTime: this.lastActivityTime,
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.orderBookCache.clear();
  }

  /**
   * Clear all history and statistics
   */
  clearHistory(): void {
    this.marketHistory.clear();
    this.marketStats.clear();
    this.walletHighRatios.clear();
    this.recentAlerts = [];
    this.totalTradesAnalyzed = 0;
    this.totalTradesFlagged = 0;
  }

  /**
   * Reset analyzer to initial state
   */
  reset(): void {
    this.clearCache();
    this.clearHistory();
    this.lastActivityTime = null;
  }

  /**
   * Cleanup expired order book cache entries
   */
  cleanupCache(): number {
    const now = Date.now();
    let removed = 0;

    for (const [marketId, entry] of this.orderBookCache.entries()) {
      if (entry.expiresAt < now) {
        this.orderBookCache.delete(marketId);
        removed++;
      }
    }

    return removed;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedAnalyzer: VolumeLiquidityRatioAnalyzer | null = null;

/**
 * Create a new VolumeLiquidityRatioAnalyzer instance
 */
export function createVolumeLiquidityRatioAnalyzer(
  config?: VolumeLiquidityRatioAnalyzerConfig
): VolumeLiquidityRatioAnalyzer {
  return new VolumeLiquidityRatioAnalyzer(config);
}

/**
 * Get the shared analyzer instance
 */
export function getSharedVolumeLiquidityRatioAnalyzer(): VolumeLiquidityRatioAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new VolumeLiquidityRatioAnalyzer();
  }
  return sharedAnalyzer;
}

/**
 * Set the shared analyzer instance
 */
export function setSharedVolumeLiquidityRatioAnalyzer(
  analyzer: VolumeLiquidityRatioAnalyzer
): void {
  sharedAnalyzer = analyzer;
}

/**
 * Reset the shared analyzer instance
 */
export function resetSharedVolumeLiquidityRatioAnalyzer(): void {
  sharedAnalyzer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze volume-to-liquidity ratio using the shared analyzer
 */
export function analyzeVolumeLiquidityRatio(
  trade: TradeForRatioAnalysis,
  options?: AnalyzeRatioOptions
): RatioAnalysisResult {
  return getSharedVolumeLiquidityRatioAnalyzer().analyzeRatio(trade, options);
}

/**
 * Batch analyze ratios using the shared analyzer
 */
export function batchAnalyzeVolumeLiquidityRatio(
  trades: TradeForRatioAnalysis[],
  options?: AnalyzeRatioOptions
): BatchRatioAnalysisResult {
  return getSharedVolumeLiquidityRatioAnalyzer().analyzeRatioBatch(trades, options);
}

/**
 * Check if a trade has high ratio using the shared analyzer
 */
export function isHighRatioTrade(
  trade: TradeForRatioAnalysis,
  orderBook?: OrderBookSnapshot
): boolean {
  return getSharedVolumeLiquidityRatioAnalyzer().isHighRatio(trade, orderBook);
}

/**
 * Update order book cache using the shared analyzer
 */
export function updateOrderBookCache(orderBook: OrderBookSnapshot): void {
  getSharedVolumeLiquidityRatioAnalyzer().updateOrderBook(orderBook);
}

/**
 * Get market ratio statistics using the shared analyzer
 */
export function getMarketRatioStats(marketId: string): MarketRatioStats | null {
  return getSharedVolumeLiquidityRatioAnalyzer().getMarketStats(marketId);
}

/**
 * Get ratio analyzer summary using the shared analyzer
 */
export function getRatioAnalyzerSummary(): RatioAnalyzerSummary {
  return getSharedVolumeLiquidityRatioAnalyzer().getSummary();
}
