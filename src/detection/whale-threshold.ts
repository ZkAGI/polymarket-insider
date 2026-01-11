/**
 * Whale Trade Threshold Calculator (DET-VOL-005)
 *
 * Dynamically calculate whale thresholds per market based on liquidity analysis.
 *
 * Features:
 * - Analyze market liquidity to determine appropriate whale thresholds
 * - Calculate dynamic thresholds that adapt to market conditions
 * - Update thresholds as market liquidity changes
 * - Provide threshold API for other detection modules
 * - Support multiple threshold calculation strategies
 * - Event emission for threshold changes
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Market liquidity classification
 */
export enum LiquidityLevel {
  /** Very low liquidity - thin order book */
  VERY_LOW = "VERY_LOW",
  /** Low liquidity - below average */
  LOW = "LOW",
  /** Medium liquidity - average */
  MEDIUM = "MEDIUM",
  /** High liquidity - above average */
  HIGH = "HIGH",
  /** Very high liquidity - deep order book */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Threshold calculation strategy
 */
export enum ThresholdStrategy {
  /** Based on percentage of total liquidity */
  LIQUIDITY_PERCENTAGE = "LIQUIDITY_PERCENTAGE",
  /** Based on percentage of average daily volume */
  VOLUME_PERCENTAGE = "VOLUME_PERCENTAGE",
  /** Based on market impact estimation */
  MARKET_IMPACT = "MARKET_IMPACT",
  /** Combine multiple strategies */
  COMBINED = "COMBINED",
  /** Fixed absolute thresholds */
  FIXED = "FIXED",
}

/**
 * Whale threshold tier
 */
export enum WhaleThresholdTier {
  /** Notable trade - worth tracking */
  NOTABLE = "NOTABLE",
  /** Large trade - significant size */
  LARGE = "LARGE",
  /** Very large trade - major position */
  VERY_LARGE = "VERY_LARGE",
  /** Whale trade - market-moving potential */
  WHALE = "WHALE",
  /** Mega whale - extremely large position */
  MEGA_WHALE = "MEGA_WHALE",
}

/**
 * Liquidity data for threshold calculation
 */
export interface LiquidityData {
  /** Total bid volume in USD */
  totalBidVolumeUsd: number;

  /** Total ask volume in USD */
  totalAskVolumeUsd: number;

  /** Total liquidity (bid + ask) */
  totalLiquidityUsd: number;

  /** Best bid price */
  bestBid: number | null;

  /** Best ask price */
  bestAsk: number | null;

  /** Spread in USD */
  spreadUsd: number | null;

  /** Spread as percentage */
  spreadPercent: number | null;

  /** Number of bid levels */
  bidLevelCount: number;

  /** Number of ask levels */
  askLevelCount: number;

  /** Volume at 1% price impact (bid side) */
  bidVolumeAt1Percent: number;

  /** Volume at 1% price impact (ask side) */
  askVolumeAt1Percent: number;

  /** Volume at 5% price impact (bid side) */
  bidVolumeAt5Percent: number;

  /** Volume at 5% price impact (ask side) */
  askVolumeAt5Percent: number;

  /** Timestamp of liquidity snapshot */
  snapshotTime: Date;
}

/**
 * Volume data for threshold calculation
 */
export interface VolumeData {
  /** 24-hour trading volume */
  volume24hUsd: number;

  /** 7-day average daily volume */
  avgDailyVolume7dUsd: number;

  /** 30-day average daily volume */
  avgDailyVolume30dUsd: number;

  /** Average trade size */
  avgTradeSizeUsd: number;

  /** Median trade size */
  medianTradeSizeUsd: number;

  /** 99th percentile trade size */
  p99TradeSizeUsd: number;

  /** Total trade count */
  tradeCount: number;

  /** Data validity timestamp */
  dataTime: Date;
}

/**
 * Whale threshold values for a market
 */
export interface WhaleThresholds {
  /** Market identifier */
  marketId: string;

  /** Threshold for NOTABLE tier (USD) */
  notableThresholdUsd: number;

  /** Threshold for LARGE tier (USD) */
  largeThresholdUsd: number;

  /** Threshold for VERY_LARGE tier (USD) */
  veryLargeThresholdUsd: number;

  /** Threshold for WHALE tier (USD) */
  whaleThresholdUsd: number;

  /** Threshold for MEGA_WHALE tier (USD) */
  megaWhaleThresholdUsd: number;

  /** Strategy used to calculate thresholds */
  strategy: ThresholdStrategy;

  /** Liquidity level classification */
  liquidityLevel: LiquidityLevel;

  /** Confidence in thresholds (0-1) */
  confidence: number;

  /** When thresholds were calculated */
  calculatedAt: Date;

  /** When thresholds expire */
  expiresAt: Date;

  /** Whether thresholds came from cache */
  fromCache: boolean;

  /** Input data used for calculation */
  inputData: {
    liquidity: LiquidityData | null;
    volume: VolumeData | null;
  };
}

/**
 * Configuration for threshold calculation
 */
export interface ThresholdConfig {
  /** Strategy to use for calculation */
  strategy: ThresholdStrategy;

  /** Percentage of liquidity for each tier (LIQUIDITY_PERCENTAGE strategy) */
  liquidityPercentages: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Percentage of daily volume for each tier (VOLUME_PERCENTAGE strategy) */
  volumePercentages: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Market impact percentages for each tier (MARKET_IMPACT strategy) */
  impactThresholds: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Fixed absolute thresholds (FIXED strategy) */
  fixedThresholds: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Minimum thresholds regardless of calculation */
  minimumThresholds: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Maximum thresholds regardless of calculation */
  maximumThresholds: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Weights for combined strategy */
  combinedWeights: {
    liquidity: number;
    volume: number;
    impact: number;
  };

  /** Liquidity thresholds for classification (total liquidity USD) */
  liquidityClassification: {
    veryLow: number;
    low: number;
    medium: number;
    high: number;
  };

  /** Cache TTL in milliseconds */
  cacheTtlMs: number;

  /** Minimum data age for reliable calculation */
  minDataAgeMs: number;

  /** Scale factors for low liquidity markets */
  lowLiquidityScaleFactor: number;
}

/**
 * Options for calculating thresholds
 */
export interface CalculateThresholdOptions {
  /** Override strategy for this calculation */
  strategy?: ThresholdStrategy;

  /** Bypass cache */
  bypassCache?: boolean;

  /** Custom liquidity data */
  liquidityData?: LiquidityData;

  /** Custom volume data */
  volumeData?: VolumeData;

  /** Force minimum thresholds */
  forceMinimums?: boolean;
}

/**
 * Threshold change event
 */
export interface ThresholdChangeEvent {
  /** Market identifier */
  marketId: string;

  /** Previous thresholds */
  previousThresholds: WhaleThresholds | null;

  /** New thresholds */
  newThresholds: WhaleThresholds;

  /** Change magnitude (percentage) */
  changeMagnitude: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Reason for change */
  changeReason: string;

  /** Timestamp */
  changedAt: Date;
}

/**
 * Batch threshold result
 */
export interface BatchThresholdResult {
  /** Results by market ID */
  results: Map<string, WhaleThresholds>;

  /** Errors by market ID */
  errors: Map<string, string>;

  /** Processing time */
  processingTimeMs: number;

  /** Success count */
  successCount: number;

  /** Error count */
  errorCount: number;
}

/**
 * Threshold calculator summary
 */
export interface ThresholdCalculatorSummary {
  /** Total markets tracked */
  totalMarketsTracked: number;

  /** Markets by liquidity level */
  marketsByLiquidityLevel: Record<LiquidityLevel, number>;

  /** Average thresholds across markets */
  averageThresholds: {
    notable: number;
    large: number;
    veryLarge: number;
    whale: number;
    megaWhale: number;
  };

  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
  };

  /** Recent threshold changes */
  recentChanges: ThresholdChangeEvent[];

  /** Last update time */
  lastUpdateTime: Date | null;
}

/**
 * Configuration for WhaleThresholdCalculator
 */
export interface WhaleThresholdCalculatorConfig {
  /** Threshold configuration */
  thresholdConfig?: Partial<ThresholdConfig>;

  /** Enable event emission */
  enableEvents?: boolean;

  /** Maximum cached thresholds */
  maxCacheSize?: number;

  /** Maximum threshold change events to store */
  maxChangeEvents?: number;

  /** Significant change threshold (percentage) */
  significantChangePercent?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default liquidity percentages for threshold calculation */
export const DEFAULT_LIQUIDITY_PERCENTAGES = {
  notable: 0.5, // 0.5% of liquidity
  large: 1, // 1% of liquidity
  veryLarge: 3, // 3% of liquidity
  whale: 5, // 5% of liquidity
  megaWhale: 10, // 10% of liquidity
};

/** Default volume percentages for threshold calculation */
export const DEFAULT_VOLUME_PERCENTAGES = {
  notable: 0.1, // 0.1% of daily volume
  large: 0.5, // 0.5% of daily volume
  veryLarge: 1, // 1% of daily volume
  whale: 2, // 2% of daily volume
  megaWhale: 5, // 5% of daily volume
};

/** Default impact thresholds (percentage price impact) */
export const DEFAULT_IMPACT_THRESHOLDS = {
  notable: 0.1, // 0.1% price impact
  large: 0.5, // 0.5% price impact
  veryLarge: 1, // 1% price impact
  whale: 2, // 2% price impact
  megaWhale: 5, // 5% price impact
};

/** Default fixed thresholds */
export const DEFAULT_FIXED_THRESHOLDS = {
  notable: 1000, // $1,000
  large: 10000, // $10,000
  veryLarge: 50000, // $50,000
  whale: 100000, // $100,000
  megaWhale: 500000, // $500,000
};

/** Default minimum thresholds */
export const DEFAULT_MINIMUM_THRESHOLDS = {
  notable: 100, // $100
  large: 1000, // $1,000
  veryLarge: 5000, // $5,000
  whale: 10000, // $10,000
  megaWhale: 50000, // $50,000
};

/** Default maximum thresholds */
export const DEFAULT_MAXIMUM_THRESHOLDS = {
  notable: 10000, // $10,000
  large: 100000, // $100,000
  veryLarge: 500000, // $500,000
  whale: 2000000, // $2,000,000
  megaWhale: 10000000, // $10,000,000
};

/** Default combined weights */
export const DEFAULT_COMBINED_WEIGHTS = {
  liquidity: 0.4,
  volume: 0.4,
  impact: 0.2,
};

/** Default liquidity classification thresholds */
export const DEFAULT_LIQUIDITY_CLASSIFICATION = {
  veryLow: 10000, // < $10,000
  low: 50000, // < $50,000
  medium: 200000, // < $200,000
  high: 1000000, // < $1,000,000
};

/** Default threshold configuration */
export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  strategy: ThresholdStrategy.COMBINED,
  liquidityPercentages: DEFAULT_LIQUIDITY_PERCENTAGES,
  volumePercentages: DEFAULT_VOLUME_PERCENTAGES,
  impactThresholds: DEFAULT_IMPACT_THRESHOLDS,
  fixedThresholds: DEFAULT_FIXED_THRESHOLDS,
  minimumThresholds: DEFAULT_MINIMUM_THRESHOLDS,
  maximumThresholds: DEFAULT_MAXIMUM_THRESHOLDS,
  combinedWeights: DEFAULT_COMBINED_WEIGHTS,
  liquidityClassification: DEFAULT_LIQUIDITY_CLASSIFICATION,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  minDataAgeMs: 0, // No minimum age
  lowLiquidityScaleFactor: 0.5, // Scale down thresholds for low liquidity
};

/** Default calculator configuration */
const DEFAULT_CALCULATOR_CONFIG: Required<WhaleThresholdCalculatorConfig> = {
  thresholdConfig: {},
  enableEvents: true,
  maxCacheSize: 1000,
  maxChangeEvents: 100,
  significantChangePercent: 10,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Classify liquidity level based on total liquidity
 */
function classifyLiquidity(
  totalLiquidityUsd: number,
  classification: ThresholdConfig["liquidityClassification"]
): LiquidityLevel {
  if (totalLiquidityUsd < classification.veryLow) {
    return LiquidityLevel.VERY_LOW;
  }
  if (totalLiquidityUsd < classification.low) {
    return LiquidityLevel.LOW;
  }
  if (totalLiquidityUsd < classification.medium) {
    return LiquidityLevel.MEDIUM;
  }
  if (totalLiquidityUsd < classification.high) {
    return LiquidityLevel.HIGH;
  }
  return LiquidityLevel.VERY_HIGH;
}

/**
 * Calculate thresholds based on liquidity percentage
 */
function calculateLiquidityBasedThresholds(
  liquidity: LiquidityData,
  percentages: ThresholdConfig["liquidityPercentages"]
): Record<WhaleThresholdTier, number> {
  const total = liquidity.totalLiquidityUsd;

  return {
    [WhaleThresholdTier.NOTABLE]: (total * percentages.notable) / 100,
    [WhaleThresholdTier.LARGE]: (total * percentages.large) / 100,
    [WhaleThresholdTier.VERY_LARGE]: (total * percentages.veryLarge) / 100,
    [WhaleThresholdTier.WHALE]: (total * percentages.whale) / 100,
    [WhaleThresholdTier.MEGA_WHALE]: (total * percentages.megaWhale) / 100,
  };
}

/**
 * Calculate thresholds based on volume percentage
 */
function calculateVolumeBasedThresholds(
  volume: VolumeData,
  percentages: ThresholdConfig["volumePercentages"]
): Record<WhaleThresholdTier, number> {
  // Use 7-day average for stability, fallback to 24h if not available
  const dailyVolume =
    volume.avgDailyVolume7dUsd > 0 ? volume.avgDailyVolume7dUsd : volume.volume24hUsd;

  return {
    [WhaleThresholdTier.NOTABLE]: (dailyVolume * percentages.notable) / 100,
    [WhaleThresholdTier.LARGE]: (dailyVolume * percentages.large) / 100,
    [WhaleThresholdTier.VERY_LARGE]: (dailyVolume * percentages.veryLarge) / 100,
    [WhaleThresholdTier.WHALE]: (dailyVolume * percentages.whale) / 100,
    [WhaleThresholdTier.MEGA_WHALE]: (dailyVolume * percentages.megaWhale) / 100,
  };
}

/**
 * Calculate thresholds based on market impact
 * Uses the volume needed to move price by a certain percentage
 */
function calculateImpactBasedThresholds(
  liquidity: LiquidityData,
  impactThresholds: ThresholdConfig["impactThresholds"]
): Record<WhaleThresholdTier, number> {
  // Estimate volume needed for price impact using order book depth
  // For simplicity, use linear interpolation between 1% and 5% data points
  const vol1 = Math.min(liquidity.bidVolumeAt1Percent, liquidity.askVolumeAt1Percent);
  const vol5 = Math.min(liquidity.bidVolumeAt5Percent, liquidity.askVolumeAt5Percent);

  // If no depth data, fall back to total liquidity estimate
  if (vol1 === 0 && vol5 === 0) {
    const total = liquidity.totalLiquidityUsd;
    return {
      [WhaleThresholdTier.NOTABLE]: total * 0.001,
      [WhaleThresholdTier.LARGE]: total * 0.005,
      [WhaleThresholdTier.VERY_LARGE]: total * 0.01,
      [WhaleThresholdTier.WHALE]: total * 0.02,
      [WhaleThresholdTier.MEGA_WHALE]: total * 0.05,
    };
  }

  // Linear interpolation for impact estimates
  const interpolate = (targetImpact: number): number => {
    if (targetImpact <= 1) {
      return (vol1 * targetImpact) / 1;
    }
    if (targetImpact >= 5) {
      return vol5;
    }
    // Interpolate between 1% and 5%
    return vol1 + ((vol5 - vol1) * (targetImpact - 1)) / 4;
  };

  return {
    [WhaleThresholdTier.NOTABLE]: interpolate(impactThresholds.notable),
    [WhaleThresholdTier.LARGE]: interpolate(impactThresholds.large),
    [WhaleThresholdTier.VERY_LARGE]: interpolate(impactThresholds.veryLarge),
    [WhaleThresholdTier.WHALE]: interpolate(impactThresholds.whale),
    [WhaleThresholdTier.MEGA_WHALE]: interpolate(impactThresholds.megaWhale),
  };
}

/**
 * Combine multiple threshold calculations with weights
 */
function combineThresholds(
  thresholds: Array<Record<WhaleThresholdTier, number>>,
  weights: number[]
): Record<WhaleThresholdTier, number> {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return thresholds[0] ?? createDefaultThresholds();
  }

  const result: Record<WhaleThresholdTier, number> = {
    [WhaleThresholdTier.NOTABLE]: 0,
    [WhaleThresholdTier.LARGE]: 0,
    [WhaleThresholdTier.VERY_LARGE]: 0,
    [WhaleThresholdTier.WHALE]: 0,
    [WhaleThresholdTier.MEGA_WHALE]: 0,
  };

  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const weight = weights[i] ?? 0;
    if (!threshold) continue;

    for (const tier of Object.values(WhaleThresholdTier)) {
      result[tier] += (threshold[tier] * weight) / totalWeight;
    }
  }

  return result;
}

/**
 * Create default thresholds
 */
function createDefaultThresholds(): Record<WhaleThresholdTier, number> {
  return {
    [WhaleThresholdTier.NOTABLE]: DEFAULT_FIXED_THRESHOLDS.notable,
    [WhaleThresholdTier.LARGE]: DEFAULT_FIXED_THRESHOLDS.large,
    [WhaleThresholdTier.VERY_LARGE]: DEFAULT_FIXED_THRESHOLDS.veryLarge,
    [WhaleThresholdTier.WHALE]: DEFAULT_FIXED_THRESHOLDS.whale,
    [WhaleThresholdTier.MEGA_WHALE]: DEFAULT_FIXED_THRESHOLDS.megaWhale,
  };
}

/**
 * Apply minimum and maximum constraints
 */
function applyConstraints(
  thresholds: Record<WhaleThresholdTier, number>,
  minimums: ThresholdConfig["minimumThresholds"],
  maximums: ThresholdConfig["maximumThresholds"]
): Record<WhaleThresholdTier, number> {
  return {
    [WhaleThresholdTier.NOTABLE]: Math.min(
      Math.max(thresholds[WhaleThresholdTier.NOTABLE], minimums.notable),
      maximums.notable
    ),
    [WhaleThresholdTier.LARGE]: Math.min(
      Math.max(thresholds[WhaleThresholdTier.LARGE], minimums.large),
      maximums.large
    ),
    [WhaleThresholdTier.VERY_LARGE]: Math.min(
      Math.max(thresholds[WhaleThresholdTier.VERY_LARGE], minimums.veryLarge),
      maximums.veryLarge
    ),
    [WhaleThresholdTier.WHALE]: Math.min(
      Math.max(thresholds[WhaleThresholdTier.WHALE], minimums.whale),
      maximums.whale
    ),
    [WhaleThresholdTier.MEGA_WHALE]: Math.min(
      Math.max(thresholds[WhaleThresholdTier.MEGA_WHALE], minimums.megaWhale),
      maximums.megaWhale
    ),
  };
}

/**
 * Ensure thresholds are in ascending order (NOTABLE < LARGE < VERY_LARGE < WHALE < MEGA_WHALE)
 */
function ensureAscendingOrder(
  thresholds: Record<WhaleThresholdTier, number>
): Record<WhaleThresholdTier, number> {
  const tiers = [
    WhaleThresholdTier.NOTABLE,
    WhaleThresholdTier.LARGE,
    WhaleThresholdTier.VERY_LARGE,
    WhaleThresholdTier.WHALE,
    WhaleThresholdTier.MEGA_WHALE,
  ];

  const result = { ...thresholds };

  for (let i = 1; i < tiers.length; i++) {
    const currentTier = tiers[i]!;
    const previousTier = tiers[i - 1]!;

    if (result[currentTier] <= result[previousTier]) {
      // Ensure current is at least 1.5x the previous
      result[currentTier] = result[previousTier] * 1.5;
    }
  }

  return result;
}

/**
 * Calculate confidence score based on data quality
 */
function calculateConfidence(
  liquidity: LiquidityData | null,
  volume: VolumeData | null,
  strategy: ThresholdStrategy
): number {
  if (strategy === ThresholdStrategy.FIXED) {
    return 1.0; // Fixed thresholds are always "confident"
  }

  let score = 0;
  let factors = 0;

  if (liquidity) {
    factors += 1;
    // Better liquidity data = higher confidence
    if (liquidity.totalLiquidityUsd > 0) score += 0.3;
    if (liquidity.bidLevelCount > 5 && liquidity.askLevelCount > 5) score += 0.2;
    if (liquidity.bidVolumeAt1Percent > 0 || liquidity.askVolumeAt1Percent > 0) score += 0.2;
    if (liquidity.spreadPercent !== null && liquidity.spreadPercent < 10) score += 0.1;
  }

  if (volume) {
    factors += 1;
    // Better volume data = higher confidence
    if (volume.volume24hUsd > 0) score += 0.2;
    if (volume.avgDailyVolume7dUsd > 0) score += 0.3;
    if (volume.tradeCount > 100) score += 0.2;
    if (volume.p99TradeSizeUsd > 0) score += 0.1;
  }

  if (factors === 0) {
    return 0.1; // Minimal confidence with no data
  }

  return Math.min(1.0, score / factors);
}

/** Change magnitude type */
interface ChangeMagnitude {
  notable: number;
  large: number;
  veryLarge: number;
  whale: number;
  megaWhale: number;
}

/**
 * Calculate change magnitude between two threshold sets
 */
function calculateChangeMagnitude(
  oldThresholds: WhaleThresholds | null,
  newThresholds: WhaleThresholds
): ChangeMagnitude {
  if (!oldThresholds) {
    return {
      notable: 100,
      large: 100,
      veryLarge: 100,
      whale: 100,
      megaWhale: 100,
    };
  }

  const calcPercent = (oldVal: number, newVal: number): number => {
    if (oldVal === 0) return newVal === 0 ? 0 : 100;
    return Math.abs(((newVal - oldVal) / oldVal) * 100);
  };

  return {
    notable: calcPercent(oldThresholds.notableThresholdUsd, newThresholds.notableThresholdUsd),
    large: calcPercent(oldThresholds.largeThresholdUsd, newThresholds.largeThresholdUsd),
    veryLarge: calcPercent(
      oldThresholds.veryLargeThresholdUsd,
      newThresholds.veryLargeThresholdUsd
    ),
    whale: calcPercent(oldThresholds.whaleThresholdUsd, newThresholds.whaleThresholdUsd),
    megaWhale: calcPercent(
      oldThresholds.megaWhaleThresholdUsd,
      newThresholds.megaWhaleThresholdUsd
    ),
  };
}

// ============================================================================
// Cache Entry Type
// ============================================================================

interface CacheEntry {
  thresholds: WhaleThresholds;
  expiresAt: number;
}

// ============================================================================
// WhaleThresholdCalculator Class
// ============================================================================

/**
 * Calculator for dynamic whale trade thresholds
 */
export class WhaleThresholdCalculator extends EventEmitter {
  private config: Required<WhaleThresholdCalculatorConfig>;
  private thresholdConfig: ThresholdConfig;
  private cache: Map<string, CacheEntry>;
  private changeEvents: ThresholdChangeEvent[];
  private cacheHits: number;
  private cacheMisses: number;

  constructor(config: WhaleThresholdCalculatorConfig = {}) {
    super();
    this.config = { ...DEFAULT_CALCULATOR_CONFIG, ...config };
    this.thresholdConfig = {
      ...DEFAULT_THRESHOLD_CONFIG,
      ...this.config.thresholdConfig,
    };
    this.cache = new Map();
    this.changeEvents = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get threshold configuration
   */
  getConfig(): ThresholdConfig {
    return { ...this.thresholdConfig };
  }

  /**
   * Update threshold configuration
   */
  updateConfig(updates: Partial<ThresholdConfig>): void {
    this.thresholdConfig = {
      ...this.thresholdConfig,
      ...updates,
    };

    // Clear cache on config change
    this.cache.clear();
  }

  /**
   * Calculate whale thresholds for a market
   */
  calculateThresholds(
    marketId: string,
    options: CalculateThresholdOptions = {}
  ): WhaleThresholds {
    const now = Date.now();

    // Check cache unless bypassed
    if (!options.bypassCache) {
      const cached = this.cache.get(marketId);
      if (cached && cached.expiresAt > now) {
        this.cacheHits++;
        return { ...cached.thresholds, fromCache: true };
      }
      this.cacheMisses++;
    }

    // Determine strategy
    const strategy = options.strategy ?? this.thresholdConfig.strategy;

    // Get input data
    const liquidity = options.liquidityData ?? null;
    const volume = options.volumeData ?? null;

    // Calculate thresholds based on strategy
    let rawThresholds: Record<WhaleThresholdTier, number>;

    switch (strategy) {
      case ThresholdStrategy.LIQUIDITY_PERCENTAGE:
        if (liquidity) {
          rawThresholds = calculateLiquidityBasedThresholds(
            liquidity,
            this.thresholdConfig.liquidityPercentages
          );
        } else {
          rawThresholds = createDefaultThresholds();
        }
        break;

      case ThresholdStrategy.VOLUME_PERCENTAGE:
        if (volume) {
          rawThresholds = calculateVolumeBasedThresholds(
            volume,
            this.thresholdConfig.volumePercentages
          );
        } else {
          rawThresholds = createDefaultThresholds();
        }
        break;

      case ThresholdStrategy.MARKET_IMPACT:
        if (liquidity) {
          rawThresholds = calculateImpactBasedThresholds(
            liquidity,
            this.thresholdConfig.impactThresholds
          );
        } else {
          rawThresholds = createDefaultThresholds();
        }
        break;

      case ThresholdStrategy.COMBINED:
        {
          const thresholdsList: Array<Record<WhaleThresholdTier, number>> = [];
          const weightsList: number[] = [];

          if (liquidity) {
            thresholdsList.push(
              calculateLiquidityBasedThresholds(
                liquidity,
                this.thresholdConfig.liquidityPercentages
              )
            );
            weightsList.push(this.thresholdConfig.combinedWeights.liquidity);
          }

          if (volume) {
            thresholdsList.push(
              calculateVolumeBasedThresholds(volume, this.thresholdConfig.volumePercentages)
            );
            weightsList.push(this.thresholdConfig.combinedWeights.volume);
          }

          if (liquidity) {
            thresholdsList.push(
              calculateImpactBasedThresholds(liquidity, this.thresholdConfig.impactThresholds)
            );
            weightsList.push(this.thresholdConfig.combinedWeights.impact);
          }

          if (thresholdsList.length > 0) {
            rawThresholds = combineThresholds(thresholdsList, weightsList);
          } else {
            rawThresholds = createDefaultThresholds();
          }
        }
        break;

      case ThresholdStrategy.FIXED:
      default:
        rawThresholds = {
          [WhaleThresholdTier.NOTABLE]: this.thresholdConfig.fixedThresholds.notable,
          [WhaleThresholdTier.LARGE]: this.thresholdConfig.fixedThresholds.large,
          [WhaleThresholdTier.VERY_LARGE]: this.thresholdConfig.fixedThresholds.veryLarge,
          [WhaleThresholdTier.WHALE]: this.thresholdConfig.fixedThresholds.whale,
          [WhaleThresholdTier.MEGA_WHALE]: this.thresholdConfig.fixedThresholds.megaWhale,
        };
        break;
    }

    // Apply low liquidity scaling if applicable
    const liquidityLevel = liquidity
      ? classifyLiquidity(liquidity.totalLiquidityUsd, this.thresholdConfig.liquidityClassification)
      : LiquidityLevel.MEDIUM;

    if (liquidityLevel === LiquidityLevel.VERY_LOW || liquidityLevel === LiquidityLevel.LOW) {
      const scale = this.thresholdConfig.lowLiquidityScaleFactor;
      for (const tier of Object.values(WhaleThresholdTier)) {
        rawThresholds[tier] *= scale;
      }
    }

    // Apply constraints
    let constrainedThresholds = applyConstraints(
      rawThresholds,
      this.thresholdConfig.minimumThresholds,
      this.thresholdConfig.maximumThresholds
    );

    // Force minimums if requested
    if (options.forceMinimums) {
      constrainedThresholds = {
        [WhaleThresholdTier.NOTABLE]: Math.max(
          constrainedThresholds[WhaleThresholdTier.NOTABLE],
          this.thresholdConfig.minimumThresholds.notable
        ),
        [WhaleThresholdTier.LARGE]: Math.max(
          constrainedThresholds[WhaleThresholdTier.LARGE],
          this.thresholdConfig.minimumThresholds.large
        ),
        [WhaleThresholdTier.VERY_LARGE]: Math.max(
          constrainedThresholds[WhaleThresholdTier.VERY_LARGE],
          this.thresholdConfig.minimumThresholds.veryLarge
        ),
        [WhaleThresholdTier.WHALE]: Math.max(
          constrainedThresholds[WhaleThresholdTier.WHALE],
          this.thresholdConfig.minimumThresholds.whale
        ),
        [WhaleThresholdTier.MEGA_WHALE]: Math.max(
          constrainedThresholds[WhaleThresholdTier.MEGA_WHALE],
          this.thresholdConfig.minimumThresholds.megaWhale
        ),
      };
    }

    // Ensure ascending order
    const finalThresholds = ensureAscendingOrder(constrainedThresholds);

    // Calculate confidence
    const confidence = calculateConfidence(liquidity, volume, strategy);

    // Build result
    const calculatedAt = new Date();
    const expiresAt = new Date(now + this.thresholdConfig.cacheTtlMs);

    const result: WhaleThresholds = {
      marketId,
      notableThresholdUsd: finalThresholds[WhaleThresholdTier.NOTABLE],
      largeThresholdUsd: finalThresholds[WhaleThresholdTier.LARGE],
      veryLargeThresholdUsd: finalThresholds[WhaleThresholdTier.VERY_LARGE],
      whaleThresholdUsd: finalThresholds[WhaleThresholdTier.WHALE],
      megaWhaleThresholdUsd: finalThresholds[WhaleThresholdTier.MEGA_WHALE],
      strategy,
      liquidityLevel,
      confidence,
      calculatedAt,
      expiresAt,
      fromCache: false,
      inputData: {
        liquidity,
        volume,
      },
    };

    // Check for significant changes
    const previousThresholds = this.cache.get(marketId)?.thresholds ?? null;
    if (previousThresholds && this.config.enableEvents) {
      const changeMagnitude = calculateChangeMagnitude(previousThresholds, result);
      const maxChange = Math.max(
        changeMagnitude.notable,
        changeMagnitude.large,
        changeMagnitude.veryLarge,
        changeMagnitude.whale,
        changeMagnitude.megaWhale
      );

      if (maxChange >= this.config.significantChangePercent) {
        const changeEvent: ThresholdChangeEvent = {
          marketId,
          previousThresholds,
          newThresholds: result,
          changeMagnitude,
          changeReason: `Threshold changed by ${maxChange.toFixed(1)}%`,
          changedAt: calculatedAt,
        };

        this.changeEvents.push(changeEvent);
        if (this.changeEvents.length > this.config.maxChangeEvents) {
          this.changeEvents.shift();
        }

        this.emit("thresholdChanged", changeEvent);
      }
    }

    // Update cache
    this.cache.set(marketId, {
      thresholds: result,
      expiresAt: now + this.thresholdConfig.cacheTtlMs,
    });

    // Enforce cache size limit
    if (this.cache.size > this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    return result;
  }

  /**
   * Calculate thresholds for multiple markets
   */
  batchCalculateThresholds(
    markets: Array<{
      marketId: string;
      liquidity?: LiquidityData;
      volume?: VolumeData;
    }>,
    options: Omit<CalculateThresholdOptions, "liquidityData" | "volumeData"> = {}
  ): BatchThresholdResult {
    const startTime = Date.now();
    const results = new Map<string, WhaleThresholds>();
    const errors = new Map<string, string>();

    for (const market of markets) {
      try {
        const thresholds = this.calculateThresholds(market.marketId, {
          ...options,
          liquidityData: market.liquidity,
          volumeData: market.volume,
        });
        results.set(market.marketId, thresholds);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(market.marketId, message);
      }
    }

    return {
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
      successCount: results.size,
      errorCount: errors.size,
    };
  }

  /**
   * Get cached thresholds for a market
   */
  getCachedThresholds(marketId: string): WhaleThresholds | null {
    const cached = this.cache.get(marketId);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.thresholds, fromCache: true };
    }
    return null;
  }

  /**
   * Check if a trade size exceeds whale threshold
   */
  isWhaleTradeSize(marketId: string, tradeSizeUsd: number): boolean {
    const thresholds = this.getCachedThresholds(marketId);
    if (!thresholds) {
      // Use default whale threshold
      return tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.whale;
    }
    return tradeSizeUsd >= thresholds.whaleThresholdUsd;
  }

  /**
   * Get the tier for a given trade size
   */
  getTierForTradeSize(marketId: string, tradeSizeUsd: number): WhaleThresholdTier | null {
    const thresholds = this.getCachedThresholds(marketId);
    if (!thresholds) {
      // Use default thresholds
      if (tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.megaWhale) return WhaleThresholdTier.MEGA_WHALE;
      if (tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.whale) return WhaleThresholdTier.WHALE;
      if (tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.veryLarge) return WhaleThresholdTier.VERY_LARGE;
      if (tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.large) return WhaleThresholdTier.LARGE;
      if (tradeSizeUsd >= DEFAULT_FIXED_THRESHOLDS.notable) return WhaleThresholdTier.NOTABLE;
      return null;
    }

    if (tradeSizeUsd >= thresholds.megaWhaleThresholdUsd) return WhaleThresholdTier.MEGA_WHALE;
    if (tradeSizeUsd >= thresholds.whaleThresholdUsd) return WhaleThresholdTier.WHALE;
    if (tradeSizeUsd >= thresholds.veryLargeThresholdUsd) return WhaleThresholdTier.VERY_LARGE;
    if (tradeSizeUsd >= thresholds.largeThresholdUsd) return WhaleThresholdTier.LARGE;
    if (tradeSizeUsd >= thresholds.notableThresholdUsd) return WhaleThresholdTier.NOTABLE;
    return null;
  }

  /**
   * Get summary of calculator state
   */
  getSummary(): ThresholdCalculatorSummary {
    const now = Date.now();
    const validCacheEntries = Array.from(this.cache.entries()).filter(
      ([, entry]) => entry.expiresAt > now
    );

    const marketsByLiquidityLevel: Record<LiquidityLevel, number> = {
      [LiquidityLevel.VERY_LOW]: 0,
      [LiquidityLevel.LOW]: 0,
      [LiquidityLevel.MEDIUM]: 0,
      [LiquidityLevel.HIGH]: 0,
      [LiquidityLevel.VERY_HIGH]: 0,
    };

    let totalNotable = 0;
    let totalLarge = 0;
    let totalVeryLarge = 0;
    let totalWhale = 0;
    let totalMegaWhale = 0;

    for (const [, entry] of validCacheEntries) {
      marketsByLiquidityLevel[entry.thresholds.liquidityLevel]++;
      totalNotable += entry.thresholds.notableThresholdUsd;
      totalLarge += entry.thresholds.largeThresholdUsd;
      totalVeryLarge += entry.thresholds.veryLargeThresholdUsd;
      totalWhale += entry.thresholds.whaleThresholdUsd;
      totalMegaWhale += entry.thresholds.megaWhaleThresholdUsd;
    }

    const count = validCacheEntries.length;
    const totalRequests = this.cacheHits + this.cacheMisses;

    return {
      totalMarketsTracked: count,
      marketsByLiquidityLevel,
      averageThresholds:
        count > 0
          ? {
              notable: totalNotable / count,
              large: totalLarge / count,
              veryLarge: totalVeryLarge / count,
              whale: totalWhale / count,
              megaWhale: totalMegaWhale / count,
            }
          : {
              notable: 0,
              large: 0,
              veryLarge: 0,
              whale: 0,
              megaWhale: 0,
            },
      cacheStats: {
        size: this.cache.size,
        hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
        hits: this.cacheHits,
        misses: this.cacheMisses,
      },
      recentChanges: [...this.changeEvents],
      lastUpdateTime: validCacheEntries.length > 0 ? validCacheEntries[0]![1].thresholds.calculatedAt : null,
    };
  }

  /**
   * Clear all cached thresholds
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Remove expired cache entries
   */
  cleanupCache(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all cached thresholds
   */
  getAllCachedThresholds(): Map<string, WhaleThresholds> {
    const now = Date.now();
    const result = new Map<string, WhaleThresholds>();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt > now) {
        result.set(key, { ...entry.thresholds, fromCache: true });
      }
    }

    return result;
  }

  /**
   * Get recent threshold change events
   */
  getRecentChanges(limit?: number): ThresholdChangeEvent[] {
    const events = [...this.changeEvents];
    if (limit !== undefined && limit > 0) {
      return events.slice(-limit);
    }
    return events;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedCalculator: WhaleThresholdCalculator | null = null;

/**
 * Create a new WhaleThresholdCalculator instance
 */
export function createWhaleThresholdCalculator(
  config?: WhaleThresholdCalculatorConfig
): WhaleThresholdCalculator {
  return new WhaleThresholdCalculator(config);
}

/**
 * Get the shared calculator instance
 */
export function getSharedWhaleThresholdCalculator(): WhaleThresholdCalculator {
  if (!sharedCalculator) {
    sharedCalculator = new WhaleThresholdCalculator();
  }
  return sharedCalculator;
}

/**
 * Set the shared calculator instance
 */
export function setSharedWhaleThresholdCalculator(calculator: WhaleThresholdCalculator): void {
  sharedCalculator = calculator;
}

/**
 * Reset the shared calculator instance
 */
export function resetSharedWhaleThresholdCalculator(): void {
  sharedCalculator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate whale thresholds for a market using the shared calculator
 */
export function calculateWhaleThresholds(
  marketId: string,
  options?: CalculateThresholdOptions
): WhaleThresholds {
  return getSharedWhaleThresholdCalculator().calculateThresholds(marketId, options);
}

/**
 * Batch calculate whale thresholds using the shared calculator
 */
export function batchCalculateWhaleThresholds(
  markets: Array<{
    marketId: string;
    liquidity?: LiquidityData;
    volume?: VolumeData;
  }>,
  options?: Omit<CalculateThresholdOptions, "liquidityData" | "volumeData">
): BatchThresholdResult {
  return getSharedWhaleThresholdCalculator().batchCalculateThresholds(markets, options);
}

/**
 * Check if a trade is a whale trade using the shared calculator
 */
export function isWhaleTradeSize(marketId: string, tradeSizeUsd: number): boolean {
  return getSharedWhaleThresholdCalculator().isWhaleTradeSize(marketId, tradeSizeUsd);
}

/**
 * Get the tier for a trade size using the shared calculator
 */
export function getTierForTradeSize(
  marketId: string,
  tradeSizeUsd: number
): WhaleThresholdTier | null {
  return getSharedWhaleThresholdCalculator().getTierForTradeSize(marketId, tradeSizeUsd);
}

/**
 * Get cached whale thresholds using the shared calculator
 */
export function getCachedWhaleThresholds(marketId: string): WhaleThresholds | null {
  return getSharedWhaleThresholdCalculator().getCachedThresholds(marketId);
}

/**
 * Get whale threshold calculator summary using the shared calculator
 */
export function getWhaleThresholdSummary(): ThresholdCalculatorSummary {
  return getSharedWhaleThresholdCalculator().getSummary();
}
