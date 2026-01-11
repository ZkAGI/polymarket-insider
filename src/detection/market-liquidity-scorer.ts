/**
 * Market Liquidity Scorer (DET-NICHE-006)
 *
 * Score markets by liquidity to identify thin markets where insider trading
 * would have outsized impact. Thin markets are more susceptible to manipulation
 * and can provide greater profit potential for those with advance information.
 *
 * Features:
 * - Calculate order book depth for liquidity assessment
 * - Track average trade size per market
 * - Score liquidity on 0-100 scale
 * - Identify thin markets requiring special monitoring
 * - Support configurable scoring thresholds
 * - Event emission for thin market alerts
 * - Caching for performance optimization
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Market liquidity classification
 */
export enum LiquidityCategory {
  /** Extremely thin market - very high manipulation risk */
  EXTREMELY_THIN = "EXTREMELY_THIN",
  /** Thin market - high manipulation risk */
  THIN = "THIN",
  /** Below average liquidity */
  BELOW_AVERAGE = "BELOW_AVERAGE",
  /** Average liquidity */
  AVERAGE = "AVERAGE",
  /** Above average liquidity */
  ABOVE_AVERAGE = "ABOVE_AVERAGE",
  /** Deep liquidity - low manipulation risk */
  DEEP = "DEEP",
  /** Very deep liquidity - very low manipulation risk */
  VERY_DEEP = "VERY_DEEP",
}

/**
 * Liquidity scoring confidence level
 */
export enum LiquidityConfidence {
  /** High confidence - sufficient data */
  HIGH = "HIGH",
  /** Medium confidence - some data limitations */
  MEDIUM = "MEDIUM",
  /** Low confidence - limited data */
  LOW = "LOW",
  /** Very low confidence - minimal data */
  VERY_LOW = "VERY_LOW",
}

/**
 * Thin market alert severity
 */
export enum ThinMarketSeverity {
  /** Informational - market is thinner than average */
  INFO = "INFO",
  /** Low - worth monitoring */
  LOW = "LOW",
  /** Medium - increased risk */
  MEDIUM = "MEDIUM",
  /** High - significant risk */
  HIGH = "HIGH",
  /** Critical - extreme risk */
  CRITICAL = "CRITICAL",
}

/**
 * Order book data for liquidity calculation
 */
export interface OrderBookData {
  /** Market identifier */
  marketId: string;

  /** Timestamp of the order book snapshot */
  timestamp: Date;

  /** Total bid volume in USD */
  totalBidVolumeUsd: number;

  /** Total ask volume in USD */
  totalAskVolumeUsd: number;

  /** Best bid price (0-1) */
  bestBid: number | null;

  /** Best ask price (0-1) */
  bestAsk: number | null;

  /** Bid-ask spread as percentage */
  spreadPercent: number | null;

  /** Number of bid levels */
  bidLevelCount: number;

  /** Number of ask levels */
  askLevelCount: number;

  /** Volume at 1% price impact (bid side) */
  bidVolume1Pct?: number;

  /** Volume at 1% price impact (ask side) */
  askVolume1Pct?: number;

  /** Volume at 5% price impact (bid side) */
  bidVolume5Pct?: number;

  /** Volume at 5% price impact (ask side) */
  askVolume5Pct?: number;
}

/**
 * Trade volume statistics for a market
 */
export interface TradeVolumeStats {
  /** Market identifier */
  marketId: string;

  /** Time period for these stats */
  periodStart: Date;
  periodEnd: Date;

  /** Number of trades in period */
  tradeCount: number;

  /** Total volume in USD */
  totalVolumeUsd: number;

  /** Average trade size in USD */
  averageTradeSizeUsd: number;

  /** Median trade size in USD */
  medianTradeSizeUsd: number;

  /** Maximum trade size in USD */
  maxTradeSizeUsd: number;

  /** Minimum trade size in USD */
  minTradeSizeUsd: number;

  /** Standard deviation of trade size */
  tradeSizeStdDev: number;

  /** 24-hour volume in USD */
  volume24hUsd: number;

  /** 7-day volume in USD */
  volume7dUsd?: number;
}

/**
 * Market liquidity score result
 */
export interface MarketLiquidityScore {
  /** Market identifier */
  marketId: string;

  /** Market question/title (if available) */
  marketQuestion?: string;

  /** Overall liquidity score (0-100) */
  liquidityScore: number;

  /** Liquidity category classification */
  category: LiquidityCategory;

  /** Whether this is considered a thin market */
  isThinMarket: boolean;

  /** Thin market severity (if applicable) */
  thinMarketSeverity: ThinMarketSeverity | null;

  /** Confidence in the score */
  confidence: LiquidityConfidence;

  /** Confidence score (0-100) */
  confidenceScore: number;

  /** Component scores */
  componentScores: {
    /** Order book depth score (0-100) */
    orderBookDepth: number;
    /** Trade volume score (0-100) */
    tradeVolume: number;
    /** Spread score (0-100) - wider spread = lower score */
    spread: number;
    /** Market participation score (0-100) */
    participation: number;
  };

  /** Order book data used for scoring */
  orderBookData: OrderBookData | null;

  /** Trade volume stats used for scoring */
  tradeVolumeStats: TradeVolumeStats | null;

  /** Insider advantage multiplier (higher for thinner markets) */
  insiderAdvantageMultiplier: number;

  /** Estimated price impact for $1000 trade */
  estimatedPriceImpact1k: number | null;

  /** Estimated price impact for $10000 trade */
  estimatedPriceImpact10k: number | null;

  /** Timestamp when score was calculated */
  scoredAt: Date;

  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Thin market alert
 */
export interface ThinMarketAlert {
  /** Alert identifier */
  alertId: string;

  /** Market identifier */
  marketId: string;

  /** Market question */
  marketQuestion?: string;

  /** Alert severity */
  severity: ThinMarketSeverity;

  /** Liquidity score when alert was generated */
  liquidityScore: number;

  /** Liquidity category */
  category: LiquidityCategory;

  /** Alert message */
  message: string;

  /** Detailed reasons for the alert */
  reasons: string[];

  /** Recommended actions */
  recommendations: string[];

  /** Timestamp */
  timestamp: Date;
}

/**
 * Batch scoring result
 */
export interface BatchLiquidityScoreResult {
  /** Successfully scored markets */
  scores: MarketLiquidityScore[];

  /** Markets that failed to score */
  errors: Array<{
    marketId: string;
    error: string;
  }>;

  /** Summary statistics */
  summary: {
    totalMarkets: number;
    successCount: number;
    errorCount: number;
    thinMarketCount: number;
    averageLiquidityScore: number;
    categoryDistribution: Record<LiquidityCategory, number>;
  };

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Liquidity scorer summary statistics
 */
export interface LiquidityScorerSummary {
  /** Total markets scored */
  totalScored: number;

  /** Thin markets identified */
  thinMarketCount: number;

  /** Average liquidity score */
  averageLiquidityScore: number;

  /** Category distribution */
  categoryDistribution: Record<LiquidityCategory, number>;

  /** Severity distribution of thin markets */
  severityDistribution: Record<ThinMarketSeverity, number>;

  /** Cache statistics */
  cache: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };

  /** Time since last reset */
  uptimeMs: number;
}

/**
 * Configuration options for liquidity scoring
 */
export interface ScoreLiquidityOptions {
  /** Order book data (if already fetched) */
  orderBookData?: OrderBookData;

  /** Trade volume stats (if already fetched) */
  tradeVolumeStats?: TradeVolumeStats;

  /** Market question (for context) */
  marketQuestion?: string;

  /** Bypass cache */
  bypassCache?: boolean;
}

/**
 * Configuration for the Market Liquidity Scorer
 */
export interface MarketLiquidityScorerConfig {
  /** Threshold score for thin market classification (default: 35) */
  thinMarketThreshold?: number;

  /** Threshold score for extremely thin market (default: 15) */
  extremelyThinThreshold?: number;

  /** Weight for order book depth component (default: 0.35) */
  orderBookDepthWeight?: number;

  /** Weight for trade volume component (default: 0.30) */
  tradeVolumeWeight?: number;

  /** Weight for spread component (default: 0.20) */
  spreadWeight?: number;

  /** Weight for participation component (default: 0.15) */
  participationWeight?: number;

  /** Minimum volume for high confidence (default: 10000 USD) */
  highConfidenceVolumeThreshold?: number;

  /** Minimum trades for high confidence (default: 50) */
  highConfidenceTradeThreshold?: number;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 5000) */
  maxCacheSize?: number;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default thin market threshold score */
const DEFAULT_THIN_MARKET_THRESHOLD = 35;

/** Default extremely thin market threshold */
const DEFAULT_EXTREMELY_THIN_THRESHOLD = 15;

/** Default component weights */
const DEFAULT_ORDER_BOOK_DEPTH_WEIGHT = 0.35;
const DEFAULT_TRADE_VOLUME_WEIGHT = 0.30;
const DEFAULT_SPREAD_WEIGHT = 0.20;
const DEFAULT_PARTICIPATION_WEIGHT = 0.15;

/** Default high confidence thresholds */
const DEFAULT_HIGH_CONFIDENCE_VOLUME = 10000;
const DEFAULT_HIGH_CONFIDENCE_TRADES = 50;

/** Default cache settings */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 5000;

/**
 * Category score ranges
 */
const CATEGORY_RANGES: Array<{ min: number; max: number; category: LiquidityCategory }> = [
  { min: 0, max: 15, category: LiquidityCategory.EXTREMELY_THIN },
  { min: 15, max: 30, category: LiquidityCategory.THIN },
  { min: 30, max: 45, category: LiquidityCategory.BELOW_AVERAGE },
  { min: 45, max: 60, category: LiquidityCategory.AVERAGE },
  { min: 60, max: 75, category: LiquidityCategory.ABOVE_AVERAGE },
  { min: 75, max: 90, category: LiquidityCategory.DEEP },
  { min: 90, max: 100, category: LiquidityCategory.VERY_DEEP },
];

/**
 * Thin market severity thresholds
 */
const SEVERITY_THRESHOLDS: Array<{ maxScore: number; severity: ThinMarketSeverity }> = [
  { maxScore: 10, severity: ThinMarketSeverity.CRITICAL },
  { maxScore: 20, severity: ThinMarketSeverity.HIGH },
  { maxScore: 30, severity: ThinMarketSeverity.MEDIUM },
  { maxScore: 35, severity: ThinMarketSeverity.LOW },
  { maxScore: 45, severity: ThinMarketSeverity.INFO },
];

/**
 * Insider advantage multipliers by category
 */
const INSIDER_ADVANTAGE_MULTIPLIERS: Record<LiquidityCategory, number> = {
  [LiquidityCategory.EXTREMELY_THIN]: 3.0,
  [LiquidityCategory.THIN]: 2.0,
  [LiquidityCategory.BELOW_AVERAGE]: 1.5,
  [LiquidityCategory.AVERAGE]: 1.0,
  [LiquidityCategory.ABOVE_AVERAGE]: 0.8,
  [LiquidityCategory.DEEP]: 0.6,
  [LiquidityCategory.VERY_DEEP]: 0.4,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return `liq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine liquidity category from score
 */
function getCategoryFromScore(score: number): LiquidityCategory {
  for (const range of CATEGORY_RANGES) {
    if (score >= range.min && score < range.max) {
      return range.category;
    }
  }
  return score >= 100
    ? LiquidityCategory.VERY_DEEP
    : LiquidityCategory.EXTREMELY_THIN;
}

/**
 * Determine thin market severity from score
 */
function getSeverityFromScore(score: number): ThinMarketSeverity | null {
  for (const threshold of SEVERITY_THRESHOLDS) {
    if (score <= threshold.maxScore) {
      return threshold.severity;
    }
  }
  return null;
}

/**
 * Determine confidence level from score
 */
function getConfidenceFromScore(score: number): LiquidityConfidence {
  if (score >= 80) return LiquidityConfidence.HIGH;
  if (score >= 60) return LiquidityConfidence.MEDIUM;
  if (score >= 40) return LiquidityConfidence.LOW;
  return LiquidityConfidence.VERY_LOW;
}

/**
 * Calculate order book depth score (0-100)
 */
function calculateOrderBookDepthScore(orderBookData: OrderBookData | null): number {
  if (!orderBookData) {
    return 0;
  }

  const totalVolume = orderBookData.totalBidVolumeUsd + orderBookData.totalAskVolumeUsd;
  const levelCount = orderBookData.bidLevelCount + orderBookData.askLevelCount;

  // Score based on total volume (log scale)
  // $100 = 10, $1000 = 30, $10000 = 50, $100000 = 70, $1000000 = 90
  let volumeScore = 0;
  if (totalVolume > 0) {
    volumeScore = Math.min(100, Math.log10(totalVolume) * 20 - 10);
    volumeScore = Math.max(0, volumeScore);
  }

  // Score based on level count
  // 1 level = 5, 5 levels = 25, 10 levels = 50, 20 levels = 75, 50+ levels = 100
  let levelScore = 0;
  if (levelCount > 0) {
    levelScore = Math.min(100, levelCount * 5);
    if (levelCount > 10) {
      levelScore = 50 + (levelCount - 10) * 2.5;
    }
    levelScore = Math.min(100, levelScore);
  }

  // Score based on balance between bid and ask sides
  let balanceScore = 50;
  if (totalVolume > 0) {
    const bidRatio = orderBookData.totalBidVolumeUsd / totalVolume;
    // Ideal is 50/50 split, penalize imbalance
    balanceScore = 100 - Math.abs(bidRatio - 0.5) * 200;
    balanceScore = Math.max(0, Math.min(100, balanceScore));
  }

  // Weighted combination
  return volumeScore * 0.5 + levelScore * 0.3 + balanceScore * 0.2;
}

/**
 * Calculate trade volume score (0-100)
 */
function calculateTradeVolumeScore(tradeVolumeStats: TradeVolumeStats | null): number {
  if (!tradeVolumeStats) {
    return 0;
  }

  // Score based on 24h volume (log scale)
  let volumeScore = 0;
  if (tradeVolumeStats.volume24hUsd > 0) {
    volumeScore = Math.min(100, Math.log10(tradeVolumeStats.volume24hUsd) * 25 - 25);
    volumeScore = Math.max(0, volumeScore);
  }

  // Score based on trade count
  let tradeCountScore = 0;
  if (tradeVolumeStats.tradeCount > 0) {
    tradeCountScore = Math.min(100, Math.log10(tradeVolumeStats.tradeCount + 1) * 50);
  }

  // Score based on average trade size consistency
  let consistencyScore = 50;
  if (tradeVolumeStats.averageTradeSizeUsd > 0 && tradeVolumeStats.tradeSizeStdDev >= 0) {
    const cv = tradeVolumeStats.tradeSizeStdDev / tradeVolumeStats.averageTradeSizeUsd;
    // Lower coefficient of variation = more consistent = higher score
    consistencyScore = Math.max(0, 100 - cv * 50);
  }

  // Weighted combination
  return volumeScore * 0.5 + tradeCountScore * 0.35 + consistencyScore * 0.15;
}

/**
 * Calculate spread score (0-100) - lower spread = higher score
 */
function calculateSpreadScore(orderBookData: OrderBookData | null): number {
  if (!orderBookData || orderBookData.spreadPercent === null) {
    return 50; // Neutral if no data
  }

  const spreadPercent = orderBookData.spreadPercent;

  // Scoring: 0% spread = 100, 1% = 80, 5% = 50, 10% = 20, 20%+ = 0
  if (spreadPercent <= 0) return 100;
  if (spreadPercent <= 1) return 100 - spreadPercent * 20;
  if (spreadPercent <= 5) return 80 - (spreadPercent - 1) * 7.5;
  if (spreadPercent <= 10) return 50 - (spreadPercent - 5) * 6;
  if (spreadPercent <= 20) return 20 - (spreadPercent - 10) * 2;
  return 0;
}

/**
 * Calculate participation score (0-100) based on level counts and activity
 */
function calculateParticipationScore(
  orderBookData: OrderBookData | null,
  tradeVolumeStats: TradeVolumeStats | null
): number {
  let score = 0;
  let dataPoints = 0;

  if (orderBookData) {
    // Score based on number of distinct price levels (proxy for unique participants)
    const levelCount = orderBookData.bidLevelCount + orderBookData.askLevelCount;
    const levelScore = Math.min(100, levelCount * 3);
    score += levelScore;
    dataPoints++;
  }

  if (tradeVolumeStats) {
    // Score based on trade activity
    const activityScore = Math.min(100, tradeVolumeStats.tradeCount * 0.5);
    score += activityScore;
    dataPoints++;

    // Bonus for healthy average trade sizes (not too small, not too concentrated)
    if (tradeVolumeStats.averageTradeSizeUsd > 0) {
      const avgSize = tradeVolumeStats.averageTradeSizeUsd;
      let sizeScore = 50;
      if (avgSize >= 10 && avgSize <= 1000) {
        sizeScore = 100; // Healthy range
      } else if (avgSize < 10) {
        sizeScore = avgSize * 10; // Too small
      } else {
        sizeScore = Math.max(0, 100 - (avgSize - 1000) / 100); // Too large
      }
      score += sizeScore;
      dataPoints++;
    }
  }

  return dataPoints > 0 ? score / dataPoints : 0;
}

/**
 * Calculate confidence score based on available data
 */
function calculateConfidenceScore(
  orderBookData: OrderBookData | null,
  tradeVolumeStats: TradeVolumeStats | null,
  highConfidenceVolume: number,
  highConfidenceTrades: number
): number {
  let score = 0;

  // Base score for having data
  if (orderBookData) score += 30;
  if (tradeVolumeStats) score += 30;

  // Bonus for sufficient data
  if (tradeVolumeStats) {
    if (tradeVolumeStats.volume24hUsd >= highConfidenceVolume) score += 20;
    else score += (tradeVolumeStats.volume24hUsd / highConfidenceVolume) * 20;

    if (tradeVolumeStats.tradeCount >= highConfidenceTrades) score += 20;
    else score += (tradeVolumeStats.tradeCount / highConfidenceTrades) * 20;
  }

  return Math.min(100, score);
}

/**
 * Estimate price impact for a given trade size
 */
function estimatePriceImpact(
  tradeSizeUsd: number,
  orderBookData: OrderBookData | null
): number | null {
  if (!orderBookData) return null;

  const totalLiquidity = orderBookData.totalBidVolumeUsd + orderBookData.totalAskVolumeUsd;
  if (totalLiquidity === 0) return null;

  // Simple linear model: impact = trade_size / total_liquidity * 100
  // This is a rough approximation; real impact depends on order book shape
  const rawImpact = (tradeSizeUsd / totalLiquidity) * 100;

  // Apply spread as minimum impact
  const minImpact = orderBookData.spreadPercent ? orderBookData.spreadPercent / 2 : 0;

  return Math.max(minImpact, rawImpact);
}

// ============================================================================
// Cache Entry Interface
// ============================================================================

interface CacheEntry {
  result: MarketLiquidityScore;
  expiresAt: number;
}

// ============================================================================
// MarketLiquidityScorer Class
// ============================================================================

/**
 * Market Liquidity Scorer
 *
 * Scores markets by liquidity to identify thin markets where insider trading
 * would have outsized impact.
 */
export class MarketLiquidityScorer extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<MarketLiquidityScorerConfig>;
  private scoringCount = 0;
  private thinMarketCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private startTime: Date;

  constructor(config: MarketLiquidityScorerConfig = {}) {
    super();
    this.config = {
      thinMarketThreshold: config.thinMarketThreshold ?? DEFAULT_THIN_MARKET_THRESHOLD,
      extremelyThinThreshold: config.extremelyThinThreshold ?? DEFAULT_EXTREMELY_THIN_THRESHOLD,
      orderBookDepthWeight: config.orderBookDepthWeight ?? DEFAULT_ORDER_BOOK_DEPTH_WEIGHT,
      tradeVolumeWeight: config.tradeVolumeWeight ?? DEFAULT_TRADE_VOLUME_WEIGHT,
      spreadWeight: config.spreadWeight ?? DEFAULT_SPREAD_WEIGHT,
      participationWeight: config.participationWeight ?? DEFAULT_PARTICIPATION_WEIGHT,
      highConfidenceVolumeThreshold:
        config.highConfidenceVolumeThreshold ?? DEFAULT_HIGH_CONFIDENCE_VOLUME,
      highConfidenceTradeThreshold:
        config.highConfidenceTradeThreshold ?? DEFAULT_HIGH_CONFIDENCE_TRADES,
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      debug: config.debug ?? false,
    };
    this.startTime = new Date();
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Get result from cache if valid
   */
  private getFromCache(marketId: string): MarketLiquidityScore | null {
    const entry = this.cache.get(marketId);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(marketId);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return { ...entry.result, fromCache: true };
  }

  /**
   * Add result to cache
   */
  private addToCache(marketId: string, result: MarketLiquidityScore): void {
    // Enforce max cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries (first 10%)
      const keysToDelete = Array.from(this.cache.keys()).slice(
        0,
        Math.ceil(this.config.maxCacheSize * 0.1)
      );
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
    }

    this.cache.set(marketId, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    const entriesRemoved = this.cache.size;
    this.cache.clear();

    if (this.config.debug) {
      console.log(`[MarketLiquidityScorer] Cache cleared (${entriesRemoved} entries removed)`);
    }
  }

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  // ==========================================================================
  // Scoring Methods
  // ==========================================================================

  /**
   * Score a market's liquidity
   */
  scoreMarket(
    marketId: string,
    options: ScoreLiquidityOptions = {}
  ): MarketLiquidityScore {
    const {
      orderBookData = null,
      tradeVolumeStats = null,
      marketQuestion,
      bypassCache = false,
    } = options;

    // Check cache
    if (!bypassCache) {
      const cached = this.getFromCache(marketId);
      if (cached) {
        return cached;
      }
    }

    // Calculate component scores
    const orderBookDepthScore = calculateOrderBookDepthScore(orderBookData);
    const tradeVolumeScore = calculateTradeVolumeScore(tradeVolumeStats);
    const spreadScore = calculateSpreadScore(orderBookData);
    const participationScore = calculateParticipationScore(orderBookData, tradeVolumeStats);

    // Calculate weighted overall score
    const liquidityScore = Math.round(
      orderBookDepthScore * this.config.orderBookDepthWeight +
        tradeVolumeScore * this.config.tradeVolumeWeight +
        spreadScore * this.config.spreadWeight +
        participationScore * this.config.participationWeight
    );

    // Determine category and thin market status
    const category = getCategoryFromScore(liquidityScore);
    const isThinMarket = liquidityScore < this.config.thinMarketThreshold;
    const thinMarketSeverity = isThinMarket ? getSeverityFromScore(liquidityScore) : null;

    // Calculate confidence
    const confidenceScore = calculateConfidenceScore(
      orderBookData,
      tradeVolumeStats,
      this.config.highConfidenceVolumeThreshold,
      this.config.highConfidenceTradeThreshold
    );
    const confidence = getConfidenceFromScore(confidenceScore);

    // Calculate insider advantage multiplier
    const insiderAdvantageMultiplier = INSIDER_ADVANTAGE_MULTIPLIERS[category];

    // Estimate price impacts
    const estimatedPriceImpact1k = estimatePriceImpact(1000, orderBookData);
    const estimatedPriceImpact10k = estimatePriceImpact(10000, orderBookData);

    const result: MarketLiquidityScore = {
      marketId,
      marketQuestion,
      liquidityScore,
      category,
      isThinMarket,
      thinMarketSeverity,
      confidence,
      confidenceScore,
      componentScores: {
        orderBookDepth: Math.round(orderBookDepthScore),
        tradeVolume: Math.round(tradeVolumeScore),
        spread: Math.round(spreadScore),
        participation: Math.round(participationScore),
      },
      orderBookData,
      tradeVolumeStats,
      insiderAdvantageMultiplier,
      estimatedPriceImpact1k,
      estimatedPriceImpact10k,
      scoredAt: new Date(),
      fromCache: false,
    };

    // Update stats
    this.scoringCount++;
    if (isThinMarket) {
      this.thinMarketCount++;

      // Emit thin market event
      const alert = this.createThinMarketAlert(result);
      this.emit("thinMarket", alert);

      if (this.config.debug) {
        console.log(
          `[MarketLiquidityScorer] Thin market detected: ${marketId} (score: ${liquidityScore})`
        );
      }
    }

    // Cache result
    this.addToCache(marketId, result);

    if (this.config.debug) {
      console.log(
        `[MarketLiquidityScorer] Scored ${marketId}: ${liquidityScore} (${category})`
      );
    }

    return result;
  }

  /**
   * Score multiple markets in batch
   */
  scoreMarkets(
    markets: Array<{
      marketId: string;
      orderBookData?: OrderBookData;
      tradeVolumeStats?: TradeVolumeStats;
      marketQuestion?: string;
    }>,
    options: { bypassCache?: boolean } = {}
  ): BatchLiquidityScoreResult {
    const startTime = Date.now();
    const scores: MarketLiquidityScore[] = [];
    const errors: Array<{ marketId: string; error: string }> = [];
    const categoryDistribution: Record<LiquidityCategory, number> = {
      [LiquidityCategory.EXTREMELY_THIN]: 0,
      [LiquidityCategory.THIN]: 0,
      [LiquidityCategory.BELOW_AVERAGE]: 0,
      [LiquidityCategory.AVERAGE]: 0,
      [LiquidityCategory.ABOVE_AVERAGE]: 0,
      [LiquidityCategory.DEEP]: 0,
      [LiquidityCategory.VERY_DEEP]: 0,
    };

    for (const market of markets) {
      try {
        const score = this.scoreMarket(market.marketId, {
          orderBookData: market.orderBookData,
          tradeVolumeStats: market.tradeVolumeStats,
          marketQuestion: market.marketQuestion,
          bypassCache: options.bypassCache,
        });
        scores.push(score);
        categoryDistribution[score.category]++;
      } catch (error) {
        errors.push({
          marketId: market.marketId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const thinMarketCount = scores.filter((s) => s.isThinMarket).length;
    const averageLiquidityScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.liquidityScore, 0) / scores.length)
        : 0;

    return {
      scores,
      errors,
      summary: {
        totalMarkets: markets.length,
        successCount: scores.length,
        errorCount: errors.length,
        thinMarketCount,
        averageLiquidityScore,
        categoryDistribution,
      },
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Create a thin market alert
   */
  private createThinMarketAlert(score: MarketLiquidityScore): ThinMarketAlert {
    const reasons: string[] = [];
    const recommendations: string[] = [];

    // Analyze reasons
    if (score.componentScores.orderBookDepth < 30) {
      reasons.push("Order book depth is very shallow");
      recommendations.push("Monitor for large orders that could move price");
    }
    if (score.componentScores.tradeVolume < 30) {
      reasons.push("Trading volume is low");
      recommendations.push("Exercise caution with trade sizes");
    }
    if (score.componentScores.spread < 40) {
      reasons.push("Bid-ask spread is wide");
      recommendations.push("Consider spread costs when evaluating trades");
    }
    if (score.componentScores.participation < 30) {
      reasons.push("Market participation is limited");
      recommendations.push("Watch for concentrated positions");
    }

    let message = `Market ${score.marketId} has low liquidity (score: ${score.liquidityScore})`;
    if (score.thinMarketSeverity === ThinMarketSeverity.CRITICAL) {
      message = `CRITICAL: Market ${score.marketId} has extremely low liquidity`;
    } else if (score.thinMarketSeverity === ThinMarketSeverity.HIGH) {
      message = `HIGH ALERT: Market ${score.marketId} has very low liquidity`;
    }

    return {
      alertId: generateAlertId(),
      marketId: score.marketId,
      marketQuestion: score.marketQuestion,
      severity: score.thinMarketSeverity!,
      liquidityScore: score.liquidityScore,
      category: score.category,
      message,
      reasons,
      recommendations,
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Check if a market is thin based on score
   */
  isThinMarket(marketId: string, options: ScoreLiquidityOptions = {}): boolean {
    const score = this.scoreMarket(marketId, options);
    return score.isThinMarket;
  }

  /**
   * Get thin markets from a batch
   */
  getThinMarkets(
    markets: Array<{
      marketId: string;
      orderBookData?: OrderBookData;
      tradeVolumeStats?: TradeVolumeStats;
    }>
  ): MarketLiquidityScore[] {
    const result = this.scoreMarkets(markets);
    return result.scores.filter((s) => s.isThinMarket);
  }

  /**
   * Get markets by category
   */
  getMarketsByCategory(
    markets: Array<{
      marketId: string;
      orderBookData?: OrderBookData;
      tradeVolumeStats?: TradeVolumeStats;
    }>,
    category: LiquidityCategory
  ): MarketLiquidityScore[] {
    const result = this.scoreMarkets(markets);
    return result.scores.filter((s) => s.category === category);
  }

  /**
   * Get markets with high insider advantage potential
   */
  getHighInsiderAdvantageMarkets(
    markets: Array<{
      marketId: string;
      orderBookData?: OrderBookData;
      tradeVolumeStats?: TradeVolumeStats;
    }>,
    minMultiplier: number = 1.5
  ): MarketLiquidityScore[] {
    const result = this.scoreMarkets(markets);
    return result.scores.filter((s) => s.insiderAdvantageMultiplier >= minMultiplier);
  }

  // ==========================================================================
  // Summary Methods
  // ==========================================================================

  /**
   * Get summary statistics
   */
  getSummary(): LiquidityScorerSummary {
    const categoryDistribution: Record<LiquidityCategory, number> = {
      [LiquidityCategory.EXTREMELY_THIN]: 0,
      [LiquidityCategory.THIN]: 0,
      [LiquidityCategory.BELOW_AVERAGE]: 0,
      [LiquidityCategory.AVERAGE]: 0,
      [LiquidityCategory.ABOVE_AVERAGE]: 0,
      [LiquidityCategory.DEEP]: 0,
      [LiquidityCategory.VERY_DEEP]: 0,
    };

    const severityDistribution: Record<ThinMarketSeverity, number> = {
      [ThinMarketSeverity.INFO]: 0,
      [ThinMarketSeverity.LOW]: 0,
      [ThinMarketSeverity.MEDIUM]: 0,
      [ThinMarketSeverity.HIGH]: 0,
      [ThinMarketSeverity.CRITICAL]: 0,
    };

    // Calculate from cache
    let totalScore = 0;
    for (const entry of this.cache.values()) {
      categoryDistribution[entry.result.category]++;
      if (entry.result.thinMarketSeverity) {
        severityDistribution[entry.result.thinMarketSeverity]++;
      }
      totalScore += entry.result.liquidityScore;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      totalScored: this.scoringCount,
      thinMarketCount: this.thinMarketCount,
      averageLiquidityScore:
        this.cache.size > 0 ? Math.round(totalScore / this.cache.size) : 0,
      categoryDistribution,
      severityDistribution,
      cache: {
        size: this.cache.size,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: Math.round(hitRate * 1000) / 10,
      },
      uptimeMs: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.scoringCount = 0;
    this.thinMarketCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = new Date();
    this.clearCache();

    if (this.config.debug) {
      console.log("[MarketLiquidityScorer] Stats reset");
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Required<MarketLiquidityScorerConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new MarketLiquidityScorer instance
 */
export function createMarketLiquidityScorer(
  config?: MarketLiquidityScorerConfig
): MarketLiquidityScorer {
  return new MarketLiquidityScorer(config);
}

// ============================================================================
// Shared Instance
// ============================================================================

let sharedScorer: MarketLiquidityScorer | null = null;

/**
 * Get the shared MarketLiquidityScorer instance
 */
export function getSharedMarketLiquidityScorer(): MarketLiquidityScorer {
  if (!sharedScorer) {
    sharedScorer = new MarketLiquidityScorer();
  }
  return sharedScorer;
}

/**
 * Set the shared MarketLiquidityScorer instance
 */
export function setSharedMarketLiquidityScorer(scorer: MarketLiquidityScorer): void {
  sharedScorer = scorer;
}

/**
 * Reset the shared MarketLiquidityScorer instance
 */
export function resetSharedMarketLiquidityScorer(): void {
  if (sharedScorer) {
    sharedScorer.resetStats();
  }
  sharedScorer = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Score a market's liquidity using the shared instance
 */
export function scoreMarketLiquidity(
  marketId: string,
  options?: ScoreLiquidityOptions
): MarketLiquidityScore {
  return getSharedMarketLiquidityScorer().scoreMarket(marketId, options);
}

/**
 * Score multiple markets' liquidity using the shared instance
 */
export function scoreMarketsLiquidity(
  markets: Array<{
    marketId: string;
    orderBookData?: OrderBookData;
    tradeVolumeStats?: TradeVolumeStats;
    marketQuestion?: string;
  }>,
  options?: { bypassCache?: boolean }
): BatchLiquidityScoreResult {
  return getSharedMarketLiquidityScorer().scoreMarkets(markets, options);
}

/**
 * Check if a market is thin using the shared instance
 */
export function isThinMarket(
  marketId: string,
  options?: ScoreLiquidityOptions
): boolean {
  return getSharedMarketLiquidityScorer().isThinMarket(marketId, options);
}

/**
 * Get thin markets from a batch using the shared instance
 */
export function getThinMarkets(
  markets: Array<{
    marketId: string;
    orderBookData?: OrderBookData;
    tradeVolumeStats?: TradeVolumeStats;
  }>
): MarketLiquidityScore[] {
  return getSharedMarketLiquidityScorer().getThinMarkets(markets);
}

/**
 * Get high insider advantage markets using the shared instance
 */
export function getHighInsiderAdvantageMarkets(
  markets: Array<{
    marketId: string;
    orderBookData?: OrderBookData;
    tradeVolumeStats?: TradeVolumeStats;
  }>,
  minMultiplier?: number
): MarketLiquidityScore[] {
  return getSharedMarketLiquidityScorer().getHighInsiderAdvantageMarkets(
    markets,
    minMultiplier
  );
}

/**
 * Get liquidity scorer summary using the shared instance
 */
export function getLiquidityScorerSummary(): LiquidityScorerSummary {
  return getSharedMarketLiquidityScorer().getSummary();
}
