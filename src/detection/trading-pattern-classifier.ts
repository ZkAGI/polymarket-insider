/**
 * Trading Pattern Classifier (DET-PAT-002)
 *
 * Classify wallet trading patterns into distinct behavioral categories.
 * This module extracts pattern features from trading activity and applies
 * classification algorithms to identify scalpers, insiders, market makers,
 * and other trading styles.
 *
 * Features:
 * - Define comprehensive pattern types
 * - Extract pattern features from trade history
 * - Apply multi-factor classification algorithm
 * - Assign pattern labels with confidence scores
 * - Support batch classification and caching
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Primary trading pattern types
 */
export enum TradingPatternType {
  /** Unknown pattern - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Scalper - very short holding periods, frequent trades */
  SCALPER = "SCALPER",
  /** Day trader - opens and closes positions within a day */
  DAY_TRADER = "DAY_TRADER",
  /** Swing trader - holds positions for days to weeks */
  SWING_TRADER = "SWING_TRADER",
  /** Position trader - long-term holder */
  POSITION_TRADER = "POSITION_TRADER",
  /** Market maker - provides liquidity, balanced buys/sells */
  MARKET_MAKER = "MARKET_MAKER",
  /** Arbitrageur - exploits price differences */
  ARBITRAGEUR = "ARBITRAGEUR",
  /** Event trader - trades around specific events */
  EVENT_TRADER = "EVENT_TRADER",
  /** Momentum trader - follows price trends */
  MOMENTUM_TRADER = "MOMENTUM_TRADER",
  /** Contrarian - trades against market sentiment */
  CONTRARIAN = "CONTRARIAN",
  /** Potential insider - suspicious timing and win rate */
  POTENTIAL_INSIDER = "POTENTIAL_INSIDER",
  /** Accumulator - gradually builds large positions */
  ACCUMULATOR = "ACCUMULATOR",
  /** Whale - large position trader */
  WHALE = "WHALE",
  /** Bot - automated trading patterns */
  BOT = "BOT",
  /** Retail - typical retail trader pattern */
  RETAIL = "RETAIL",
}

/**
 * Pattern classification confidence level
 */
export enum PatternConfidence {
  /** Very low confidence - minimal data */
  VERY_LOW = "VERY_LOW",
  /** Low confidence */
  LOW = "LOW",
  /** Medium confidence */
  MEDIUM = "MEDIUM",
  /** High confidence */
  HIGH = "HIGH",
  /** Very high confidence */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Behavioral features used for classification
 */
export enum PatternFeature {
  /** Trade frequency (trades per day) */
  TRADE_FREQUENCY = "TRADE_FREQUENCY",
  /** Average holding period */
  HOLDING_PERIOD = "HOLDING_PERIOD",
  /** Position size consistency */
  SIZE_CONSISTENCY = "SIZE_CONSISTENCY",
  /** Win rate */
  WIN_RATE = "WIN_RATE",
  /** Time of day pattern */
  TIME_PATTERN = "TIME_PATTERN",
  /** Market concentration */
  MARKET_CONCENTRATION = "MARKET_CONCENTRATION",
  /** Buy/sell ratio */
  BUY_SELL_RATIO = "BUY_SELL_RATIO",
  /** Maker/taker ratio */
  MAKER_TAKER_RATIO = "MAKER_TAKER_RATIO",
  /** Trade timing consistency */
  TIMING_CONSISTENCY = "TIMING_CONSISTENCY",
  /** Pre-event trading activity */
  PRE_EVENT_ACTIVITY = "PRE_EVENT_ACTIVITY",
  /** Trade clustering */
  TRADE_CLUSTERING = "TRADE_CLUSTERING",
  /** Category specialization */
  CATEGORY_SPECIALIZATION = "CATEGORY_SPECIALIZATION",
  /** Profit factor */
  PROFIT_FACTOR = "PROFIT_FACTOR",
  /** Trade size percentile */
  TRADE_SIZE_PERCENTILE = "TRADE_SIZE_PERCENTILE",
  /** Position reversal rate */
  REVERSAL_RATE = "REVERSAL_RATE",
}

/**
 * Risk flags that can be associated with patterns
 */
export enum PatternRiskFlag {
  /** Suspiciously high win rate */
  HIGH_WIN_RATE = "HIGH_WIN_RATE",
  /** Perfect timing on trades */
  PERFECT_TIMING = "PERFECT_TIMING",
  /** Trades before news events */
  PRE_NEWS_TRADING = "PRE_NEWS_TRADING",
  /** Coordinated with other wallets */
  COORDINATED_TRADING = "COORDINATED_TRADING",
  /** Concentrated in high-risk markets */
  HIGH_RISK_CONCENTRATION = "HIGH_RISK_CONCENTRATION",
  /** Bot-like precision */
  BOT_PRECISION = "BOT_PRECISION",
  /** Unusual timing patterns */
  UNUSUAL_TIMING = "UNUSUAL_TIMING",
  /** Fresh wallet large trades */
  FRESH_WALLET_ACTIVITY = "FRESH_WALLET_ACTIVITY",
  /** Wash trading indicators */
  WASH_TRADING = "WASH_TRADING",
  /** Information asymmetry signals */
  INFO_ASYMMETRY = "INFO_ASYMMETRY",
}

/**
 * Trade data for pattern classification
 */
export interface PatternTrade {
  /** Unique trade ID */
  tradeId: string;
  /** Market ID */
  marketId: string;
  /** Market category */
  marketCategory?: MarketCategory | string;
  /** Trade side */
  side: "buy" | "sell";
  /** Trade size in USD */
  sizeUsd: number;
  /** Execution price (0-1) */
  price: number;
  /** Trade timestamp */
  timestamp: Date;
  /** Whether this was a winning trade */
  isWinner?: boolean | null;
  /** Profit/loss in USD */
  pnl?: number | null;
  /** Whether wallet was maker or taker */
  isMaker?: boolean;
  /** Additional flags */
  flags?: string[];
  /** Time until market resolution (if known) */
  timeToResolution?: number;
}

/**
 * Extracted pattern features with scores
 */
export interface ExtractedFeatures {
  /** Trade frequency (trades per day) */
  tradeFrequency: number;
  /** Average holding period in hours */
  avgHoldingPeriod: number;
  /** Position size coefficient of variation */
  sizeConsistency: number;
  /** Win rate (0-1) */
  winRate: number;
  /** Off-hours trading percentage */
  offHoursPercentage: number;
  /** Market concentration score (0-1) */
  marketConcentration: number;
  /** Buy percentage (0-1) */
  buyPercentage: number;
  /** Maker percentage (0-1) */
  makerPercentage: number;
  /** Timing consistency score (0-1) */
  timingConsistency: number;
  /** Pre-event trades percentage */
  preEventPercentage: number;
  /** Trade clustering score (0-1) */
  clusteringScore: number;
  /** Category specialization score (0-1) */
  categorySpecialization: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Median trade size percentile */
  tradeSizePercentile: number;
  /** Position reversal rate */
  reversalRate: number;
  /** Average trade size in USD */
  avgTradeSize: number;
  /** Max trade size in USD */
  maxTradeSize: number;
  /** Total volume traded */
  totalVolume: number;
  /** Number of unique markets */
  uniqueMarkets: number;
  /** Days active */
  daysActive: number;
}

/**
 * Feature contribution to classification
 */
export interface FeatureContribution {
  /** Feature name */
  feature: PatternFeature;
  /** Feature value */
  value: number;
  /** Contribution score to pattern match */
  contribution: number;
  /** Whether this is a strong indicator */
  isStrongIndicator: boolean;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Pattern type */
  pattern: TradingPatternType;
  /** Match score (0-100) */
  score: number;
  /** Feature contributions */
  contributions: FeatureContribution[];
  /** Whether this pattern is a strong match */
  isStrongMatch: boolean;
}

/**
 * Classification result for a wallet
 */
export interface PatternClassificationResult {
  /** Wallet address (checksummed) */
  address: string;
  /** Primary classified pattern */
  primaryPattern: TradingPatternType;
  /** Secondary patterns (if applicable) */
  secondaryPatterns: TradingPatternType[];
  /** Confidence level */
  confidence: PatternConfidence;
  /** Match score for primary pattern */
  matchScore: number;
  /** All pattern match scores */
  patternMatches: PatternMatch[];
  /** Extracted features */
  features: ExtractedFeatures;
  /** Risk flags detected */
  riskFlags: PatternRiskFlag[];
  /** Risk score (0-100) */
  riskScore: number;
  /** Pattern insights */
  insights: string[];
  /** Number of trades analyzed */
  tradeCount: number;
  /** Classification timestamp */
  classifiedAt: Date;
}

/**
 * Pattern type definition with criteria
 */
export interface PatternDefinition {
  /** Pattern type */
  type: TradingPatternType;
  /** Description */
  description: string;
  /** Feature requirements for classification */
  featureRequirements: {
    feature: PatternFeature;
    min?: number;
    max?: number;
    weight: number;
  }[];
  /** Minimum score required to classify */
  minScore: number;
  /** Associated risk flags */
  associatedRiskFlags?: PatternRiskFlag[];
}

/**
 * Batch classification result
 */
export interface BatchClassificationResult {
  /** Wallet address */
  address: string;
  /** Classification result (null if failed) */
  result: PatternClassificationResult | null;
  /** Error message if failed */
  error?: string;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Classification summary statistics
 */
export interface ClassificationSummary {
  /** Total classifications */
  totalClassifications: number;
  /** Classifications by pattern type */
  byPattern: Record<string, number>;
  /** Classifications by confidence */
  byConfidence: Record<string, number>;
  /** Average risk score */
  avgRiskScore: number;
  /** High risk count (score > 70) */
  highRiskCount: number;
  /** Most common risk flags */
  topRiskFlags: { flag: PatternRiskFlag; count: number }[];
  /** Total trades analyzed */
  totalTradesAnalyzed: number;
}

/**
 * Configuration for the classifier
 */
export interface TradingPatternClassifierConfig {
  /** Minimum trades required for classification */
  minTrades?: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  /** Maximum cached classifications */
  maxCachedClassifications?: number;
  /** Large trade threshold in USD */
  largeTradeThreshold?: number;
  /** Whale trade threshold in USD */
  whaleTradeThreshold?: number;
  /** High win rate threshold */
  highWinRateThreshold?: number;
  /** Pre-event window in hours */
  preEventWindowHours?: number;
  /** Custom pattern definitions */
  customPatterns?: PatternDefinition[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_CLASSIFIER_CONFIG: Required<Omit<TradingPatternClassifierConfig, 'customPatterns'>> & { customPatterns: PatternDefinition[] } = {
  minTrades: 5,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
  maxCachedClassifications: 1000,
  largeTradeThreshold: 1000,
  whaleTradeThreshold: 10000,
  highWinRateThreshold: 0.75,
  preEventWindowHours: 24,
  customPatterns: [],
};

/**
 * Market hours for timing analysis (9am-5pm EST in UTC)
 */
const MARKET_HOURS_START = 14;
const MARKET_HOURS_END = 22;

/**
 * Default pattern definitions
 */
export const DEFAULT_PATTERN_DEFINITIONS: PatternDefinition[] = [
  {
    type: TradingPatternType.SCALPER,
    description: "Very short holding periods with frequent trades",
    featureRequirements: [
      { feature: PatternFeature.TRADE_FREQUENCY, min: 5, weight: 0.3 },
      { feature: PatternFeature.HOLDING_PERIOD, max: 2, weight: 0.35 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.5, weight: 0.15 },
      { feature: PatternFeature.REVERSAL_RATE, min: 0.3, weight: 0.2 },
    ],
    minScore: 60,
  },
  {
    type: TradingPatternType.DAY_TRADER,
    description: "Opens and closes positions within a day",
    featureRequirements: [
      { feature: PatternFeature.TRADE_FREQUENCY, min: 1, max: 10, weight: 0.25 },
      { feature: PatternFeature.HOLDING_PERIOD, min: 2, max: 24, weight: 0.35 },
      { feature: PatternFeature.TIME_PATTERN, min: 0.5, weight: 0.2 },
      { feature: PatternFeature.REVERSAL_RATE, min: 0.2, weight: 0.2 },
    ],
    minScore: 55,
  },
  {
    type: TradingPatternType.SWING_TRADER,
    description: "Holds positions for days to weeks",
    featureRequirements: [
      { feature: PatternFeature.HOLDING_PERIOD, min: 24, max: 336, weight: 0.4 },
      { feature: PatternFeature.TRADE_FREQUENCY, max: 2, weight: 0.2 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.4, weight: 0.2 },
      { feature: PatternFeature.MARKET_CONCENTRATION, max: 0.8, weight: 0.2 },
    ],
    minScore: 55,
  },
  {
    type: TradingPatternType.POSITION_TRADER,
    description: "Long-term holder with large positions",
    featureRequirements: [
      { feature: PatternFeature.HOLDING_PERIOD, min: 336, weight: 0.4 },
      { feature: PatternFeature.TRADE_FREQUENCY, max: 0.5, weight: 0.2 },
      { feature: PatternFeature.TRADE_SIZE_PERCENTILE, min: 0.6, weight: 0.25 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.3, weight: 0.15 },
    ],
    minScore: 60,
  },
  {
    type: TradingPatternType.MARKET_MAKER,
    description: "Provides liquidity with balanced buys and sells",
    featureRequirements: [
      { feature: PatternFeature.MAKER_TAKER_RATIO, min: 0.6, weight: 0.35 },
      { feature: PatternFeature.BUY_SELL_RATIO, min: 0.4, max: 0.6, weight: 0.25 },
      { feature: PatternFeature.TRADE_FREQUENCY, min: 3, weight: 0.2 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.6, weight: 0.2 },
    ],
    minScore: 65,
  },
  {
    type: TradingPatternType.ARBITRAGEUR,
    description: "Exploits price differences across markets",
    featureRequirements: [
      { feature: PatternFeature.TIMING_CONSISTENCY, min: 0.7, weight: 0.3 },
      { feature: PatternFeature.TRADE_CLUSTERING, min: 0.5, weight: 0.25 },
      { feature: PatternFeature.WIN_RATE, min: 0.6, weight: 0.25 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.7, weight: 0.2 },
    ],
    minScore: 65,
  },
  {
    type: TradingPatternType.EVENT_TRADER,
    description: "Trades around specific events",
    featureRequirements: [
      { feature: PatternFeature.CATEGORY_SPECIALIZATION, min: 0.6, weight: 0.3 },
      { feature: PatternFeature.PRE_EVENT_ACTIVITY, min: 0.3, weight: 0.3 },
      { feature: PatternFeature.MARKET_CONCENTRATION, min: 0.5, weight: 0.2 },
      { feature: PatternFeature.HOLDING_PERIOD, max: 168, weight: 0.2 },
    ],
    minScore: 60,
  },
  {
    type: TradingPatternType.MOMENTUM_TRADER,
    description: "Follows price trends",
    featureRequirements: [
      { feature: PatternFeature.BUY_SELL_RATIO, min: 0.6, weight: 0.3 },
      { feature: PatternFeature.TRADE_CLUSTERING, min: 0.4, weight: 0.25 },
      { feature: PatternFeature.REVERSAL_RATE, max: 0.3, weight: 0.25 },
      { feature: PatternFeature.WIN_RATE, min: 0.45, weight: 0.2 },
    ],
    minScore: 55,
  },
  {
    type: TradingPatternType.CONTRARIAN,
    description: "Trades against market sentiment",
    featureRequirements: [
      { feature: PatternFeature.BUY_SELL_RATIO, max: 0.4, weight: 0.3 },
      { feature: PatternFeature.REVERSAL_RATE, min: 0.4, weight: 0.25 },
      { feature: PatternFeature.WIN_RATE, min: 0.5, weight: 0.25 },
      { feature: PatternFeature.MARKET_CONCENTRATION, max: 0.7, weight: 0.2 },
    ],
    minScore: 55,
  },
  {
    type: TradingPatternType.POTENTIAL_INSIDER,
    description: "Suspicious timing and unusually high win rate",
    featureRequirements: [
      { feature: PatternFeature.WIN_RATE, min: 0.8, weight: 0.35 },
      { feature: PatternFeature.PRE_EVENT_ACTIVITY, min: 0.4, weight: 0.3 },
      { feature: PatternFeature.PROFIT_FACTOR, min: 3, weight: 0.2 },
      { feature: PatternFeature.CATEGORY_SPECIALIZATION, min: 0.5, weight: 0.15 },
    ],
    minScore: 70,
    associatedRiskFlags: [
      PatternRiskFlag.HIGH_WIN_RATE,
      PatternRiskFlag.PRE_NEWS_TRADING,
      PatternRiskFlag.INFO_ASYMMETRY,
    ],
  },
  {
    type: TradingPatternType.ACCUMULATOR,
    description: "Gradually builds large positions",
    featureRequirements: [
      { feature: PatternFeature.BUY_SELL_RATIO, min: 0.7, weight: 0.35 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.5, weight: 0.25 },
      { feature: PatternFeature.MARKET_CONCENTRATION, min: 0.6, weight: 0.2 },
      { feature: PatternFeature.REVERSAL_RATE, max: 0.2, weight: 0.2 },
    ],
    minScore: 60,
  },
  {
    type: TradingPatternType.WHALE,
    description: "Large position trader",
    featureRequirements: [
      { feature: PatternFeature.TRADE_SIZE_PERCENTILE, min: 0.9, weight: 0.45 },
      { feature: PatternFeature.TRADE_FREQUENCY, max: 5, weight: 0.2 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.3, weight: 0.15 },
      { feature: PatternFeature.PROFIT_FACTOR, min: 1, weight: 0.2 },
    ],
    minScore: 65,
  },
  {
    type: TradingPatternType.BOT,
    description: "Automated trading patterns with high precision",
    featureRequirements: [
      { feature: PatternFeature.TIMING_CONSISTENCY, min: 0.8, weight: 0.35 },
      { feature: PatternFeature.SIZE_CONSISTENCY, min: 0.8, weight: 0.3 },
      { feature: PatternFeature.TRADE_FREQUENCY, min: 5, weight: 0.2 },
      { feature: PatternFeature.TIME_PATTERN, max: 0.3, weight: 0.15 },
    ],
    minScore: 70,
    associatedRiskFlags: [PatternRiskFlag.BOT_PRECISION],
  },
  {
    type: TradingPatternType.RETAIL,
    description: "Typical retail trader pattern",
    featureRequirements: [
      { feature: PatternFeature.TRADE_FREQUENCY, max: 3, weight: 0.2 },
      { feature: PatternFeature.SIZE_CONSISTENCY, max: 0.6, weight: 0.2 },
      { feature: PatternFeature.WIN_RATE, max: 0.6, weight: 0.2 },
      { feature: PatternFeature.TRADE_SIZE_PERCENTILE, max: 0.7, weight: 0.2 },
      { feature: PatternFeature.MARKET_CONCENTRATION, max: 0.7, weight: 0.2 },
    ],
    minScore: 45,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate median
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid] ?? 0;
  }
  const left = sorted[mid - 1] ?? 0;
  const right = sorted[mid] ?? 0;
  return (left + right) / 2;
}

/**
 * Check if hour is during market hours
 */
function isMarketHours(utcHour: number): boolean {
  return utcHour >= MARKET_HOURS_START && utcHour < MARKET_HOURS_END;
}

/**
 * Calculate Herfindahl-Hirschman Index (normalized)
 */
function calculateHHI(distribution: Record<string, number>): number {
  const values = Object.values(distribution);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const shares = values.map((v) => v / total);
  const hhi = shares.reduce((sum, s) => sum + Math.pow(s, 2), 0);

  const n = values.length;
  if (n <= 1) return 1;

  const minHHI = 1 / n;
  return (hhi - minHHI) / (1 - minHHI);
}

/**
 * Map feature value to 0-1 score based on criteria
 */
function normalizeFeatureValue(
  value: number,
  min?: number,
  max?: number
): number {
  // If both min and max are specified, check if value is in range
  if (min !== undefined && max !== undefined) {
    if (value < min || value > max) return 0;
    // Value is within range - return 1 for perfect match, less for edges
    const range = max - min;
    const midpoint = (min + max) / 2;
    const distance = Math.abs(value - midpoint);
    return Math.max(0, 1 - (distance / (range / 2)) * 0.5);
  }

  // If only min is specified
  if (min !== undefined) {
    if (value < min) return Math.max(0, value / min);
    return Math.min(1, 0.5 + (value - min) / (min * 2) * 0.5);
  }

  // If only max is specified
  if (max !== undefined) {
    if (value > max) return Math.max(0, 1 - (value - max) / max);
    return Math.min(1, 0.5 + (max - value) / max * 0.5);
  }

  return 0.5;
}

/**
 * Determine confidence level based on trade count
 */
function getConfidenceLevel(tradeCount: number): PatternConfidence {
  if (tradeCount < 5) return PatternConfidence.VERY_LOW;
  if (tradeCount < 15) return PatternConfidence.LOW;
  if (tradeCount < 30) return PatternConfidence.MEDIUM;
  if (tradeCount < 100) return PatternConfidence.HIGH;
  return PatternConfidence.VERY_HIGH;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Trading Pattern Classifier
 *
 * Classifies wallet trading patterns into distinct behavioral categories.
 */
export class TradingPatternClassifier extends EventEmitter {
  private config: Required<Omit<TradingPatternClassifierConfig, 'customPatterns'>> & { customPatterns: PatternDefinition[] };
  private patternDefinitions: PatternDefinition[];
  private classificationCache: Map<
    string,
    { result: PatternClassificationResult; timestamp: number }
  > = new Map();
  private tradeCache: Map<string, PatternTrade[]> = new Map();

  constructor(config: TradingPatternClassifierConfig = {}) {
    super();
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };
    this.patternDefinitions = [
      ...DEFAULT_PATTERN_DEFINITIONS,
      ...(config.customPatterns || []),
    ];
  }

  /**
   * Classify trading pattern for a wallet
   */
  classify(
    address: string,
    trades: PatternTrade[]
  ): PatternClassificationResult | null {
    // Validate address
    if (!isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const checksumAddress = getAddress(address);

    // Filter and sort trades
    const validTrades = trades
      .filter((t) => t.sizeUsd > 0 && t.timestamp)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (validTrades.length < this.config.minTrades) {
      return null;
    }

    // Extract features
    const features = this.extractFeatures(validTrades);

    // Match against all patterns
    const patternMatches = this.matchPatterns(features);

    // Sort by score
    patternMatches.sort((a, b) => b.score - a.score);

    // Determine primary and secondary patterns
    const primaryMatch = patternMatches[0];
    const primaryPattern = primaryMatch?.isStrongMatch
      ? primaryMatch.pattern
      : TradingPatternType.UNKNOWN;

    const secondaryPatterns = patternMatches
      .slice(1, 4)
      .filter((m) => m.score >= 40)
      .map((m) => m.pattern);

    // Detect risk flags
    const riskFlags = this.detectRiskFlags(features, validTrades, primaryPattern);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(riskFlags, features, primaryPattern);

    // Generate insights
    const insights = this.generateInsights(
      primaryPattern,
      features,
      riskFlags,
      patternMatches
    );

    const confidence = getConfidenceLevel(validTrades.length);

    const result: PatternClassificationResult = {
      address: checksumAddress,
      primaryPattern,
      secondaryPatterns,
      confidence,
      matchScore: primaryMatch?.score ?? 0,
      patternMatches,
      features,
      riskFlags,
      riskScore,
      insights,
      tradeCount: validTrades.length,
      classifiedAt: new Date(),
    };

    // Cache results
    this.cacheClassification(checksumAddress, result);
    this.tradeCache.set(checksumAddress, validTrades);

    // Emit events
    this.emit("classified", result);

    if (riskScore >= 70) {
      this.emit("highRisk", result);
    }

    if (primaryPattern === TradingPatternType.POTENTIAL_INSIDER) {
      this.emit("potentialInsider", result);
    }

    return result;
  }

  /**
   * Update classification with new trades
   */
  updateClassification(
    address: string,
    newTrades: PatternTrade[]
  ): PatternClassificationResult | null {
    if (!isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const checksumAddress = getAddress(address);
    const existingTrades = this.tradeCache.get(checksumAddress) || [];

    // Merge trades, avoiding duplicates
    const existingIds = new Set(existingTrades.map((t) => t.tradeId));
    const uniqueNewTrades = newTrades.filter((t) => !existingIds.has(t.tradeId));

    if (uniqueNewTrades.length === 0) {
      const cached = this.classificationCache.get(checksumAddress);
      return cached?.result || null;
    }

    const allTrades = [...existingTrades, ...uniqueNewTrades];
    const result = this.classify(checksumAddress, allTrades);

    if (result) {
      this.emit("classificationUpdated", result, uniqueNewTrades.length);
    }

    return result;
  }

  /**
   * Get cached classification
   */
  getClassification(address: string): PatternClassificationResult | null {
    if (!isAddress(address)) return null;

    const checksumAddress = getAddress(address);
    const cached = this.classificationCache.get(checksumAddress);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.config.cacheTtlMs) {
      this.classificationCache.delete(checksumAddress);
      return null;
    }

    return cached.result;
  }

  /**
   * Classify multiple wallets
   */
  classifyBatch(
    walletTrades: Map<string, PatternTrade[]>
  ): BatchClassificationResult[] {
    const results: BatchClassificationResult[] = [];

    for (const [address, trades] of walletTrades) {
      const startTime = Date.now();

      try {
        const result = this.classify(address, trades);
        results.push({
          address,
          result,
          processingTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          address,
          result: null,
          error: error instanceof Error ? error.message : "Unknown error",
          processingTimeMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Get classifications by pattern type
   */
  getClassificationsByPattern(
    pattern: TradingPatternType
  ): PatternClassificationResult[] {
    const results: PatternClassificationResult[] = [];
    const now = Date.now();

    for (const [, cached] of this.classificationCache) {
      if (
        now - cached.timestamp <= this.config.cacheTtlMs &&
        cached.result.primaryPattern === pattern
      ) {
        results.push(cached.result);
      }
    }

    return results;
  }

  /**
   * Get high-risk classifications
   */
  getHighRiskClassifications(
    threshold: number = 70
  ): PatternClassificationResult[] {
    const results: PatternClassificationResult[] = [];
    const now = Date.now();

    for (const [, cached] of this.classificationCache) {
      if (
        now - cached.timestamp <= this.config.cacheTtlMs &&
        cached.result.riskScore >= threshold
      ) {
        results.push(cached.result);
      }
    }

    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get potential insider classifications
   */
  getPotentialInsiders(): PatternClassificationResult[] {
    return this.getClassificationsByPattern(TradingPatternType.POTENTIAL_INSIDER);
  }

  /**
   * Get all cached classifications
   */
  getAllClassifications(): PatternClassificationResult[] {
    const results: PatternClassificationResult[] = [];
    const now = Date.now();

    for (const [, cached] of this.classificationCache) {
      if (now - cached.timestamp <= this.config.cacheTtlMs) {
        results.push(cached.result);
      }
    }

    return results;
  }

  /**
   * Get summary statistics
   */
  getSummary(): ClassificationSummary {
    const classifications = this.getAllClassifications();

    const byPattern: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    const flagCounts = new Map<PatternRiskFlag, number>();
    let totalRiskScore = 0;
    let highRiskCount = 0;
    let totalTrades = 0;

    for (const c of classifications) {
      // Count by pattern
      byPattern[c.primaryPattern] = (byPattern[c.primaryPattern] || 0) + 1;

      // Count by confidence
      byConfidence[c.confidence] = (byConfidence[c.confidence] || 0) + 1;

      // Sum risk scores
      totalRiskScore += c.riskScore;
      if (c.riskScore >= 70) highRiskCount++;

      // Count flags
      for (const flag of c.riskFlags) {
        flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
      }

      totalTrades += c.tradeCount;
    }

    const topRiskFlags = Array.from(flagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flag, count]) => ({ flag, count }));

    return {
      totalClassifications: classifications.length,
      byPattern,
      byConfidence,
      avgRiskScore:
        classifications.length > 0 ? totalRiskScore / classifications.length : 0,
      highRiskCount,
      topRiskFlags,
      totalTradesAnalyzed: totalTrades,
    };
  }

  /**
   * Check if wallet has classification
   */
  hasClassification(address: string): boolean {
    if (!isAddress(address)) return false;
    return this.classificationCache.has(getAddress(address));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.classificationCache.clear();
    this.tradeCache.clear();
  }

  /**
   * Remove classification from cache
   */
  removeClassification(address: string): boolean {
    if (!isAddress(address)) return false;
    const checksumAddress = getAddress(address);
    this.tradeCache.delete(checksumAddress);
    return this.classificationCache.delete(checksumAddress);
  }

  /**
   * Add custom pattern definition
   */
  addPatternDefinition(pattern: PatternDefinition): void {
    this.patternDefinitions.push(pattern);
  }

  /**
   * Get pattern definitions
   */
  getPatternDefinitions(): PatternDefinition[] {
    return [...this.patternDefinitions];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private cacheClassification(
    address: string,
    result: PatternClassificationResult
  ): void {
    if (this.classificationCache.size >= this.config.maxCachedClassifications) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, cached] of this.classificationCache) {
        if (cached.timestamp < oldestTime) {
          oldestTime = cached.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.classificationCache.delete(oldestKey);
        this.tradeCache.delete(oldestKey);
      }
    }

    this.classificationCache.set(address, {
      result,
      timestamp: Date.now(),
    });
  }

  private extractFeatures(trades: PatternTrade[]): ExtractedFeatures {
    if (trades.length === 0) {
      return this.getEmptyFeatures();
    }

    const firstTrade = trades[0]!;
    const lastTrade = trades[trades.length - 1]!;

    // Calculate days active
    const daysActive = Math.max(
      1,
      (lastTrade.timestamp.getTime() - firstTrade.timestamp.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Trade frequency
    const tradeFrequency = trades.length / daysActive;

    // Time between trades
    const timeDiffs: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      const curr = trades[i]!;
      const prev = trades[i - 1]!;
      timeDiffs.push(
        (curr.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60)
      );
    }

    const avgHoldingPeriod =
      timeDiffs.length > 0
        ? (timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length) * 2
        : 0;

    // Size analysis
    const sizes = trades.map((t) => t.sizeUsd);
    const avgTradeSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const maxTradeSize = Math.max(...sizes);
    const sizeStdDev = calculateStdDev(sizes);
    const sizeConsistency =
      avgTradeSize > 0 ? 1 - Math.min(1, sizeStdDev / avgTradeSize) : 0;

    // Win rate
    const resolvedTrades = trades.filter(
      (t) => t.pnl !== null && t.pnl !== undefined
    );
    const wins = resolvedTrades.filter((t) => t.pnl! > 0);
    const winRate =
      resolvedTrades.length > 0 ? wins.length / resolvedTrades.length : 0;

    // Time patterns
    let offHoursCount = 0;
    for (const trade of trades) {
      const hour = trade.timestamp.getUTCHours();
      if (!isMarketHours(hour)) {
        offHoursCount++;
      }
    }
    const offHoursPercentage = offHoursCount / trades.length;

    // Market concentration
    const marketCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const trade of trades) {
      marketCounts[trade.marketId] = (marketCounts[trade.marketId] || 0) + 1;
      const cat = trade.marketCategory || "unknown";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const marketConcentration = calculateHHI(marketCounts);
    const categorySpecialization = calculateHHI(categoryCounts);

    // Buy/sell ratio
    const buys = trades.filter((t) => t.side === "buy").length;
    const buyPercentage = buys / trades.length;

    // Maker percentage
    const makers = trades.filter((t) => t.isMaker === true).length;
    const makerPercentage = makers / trades.length;

    // Timing consistency
    const timeOfDayCounts: Record<number, number> = {};
    for (const trade of trades) {
      const hour = trade.timestamp.getUTCHours();
      timeOfDayCounts[hour] = (timeOfDayCounts[hour] || 0) + 1;
    }
    const timingConsistency = calculateHHI(timeOfDayCounts);

    // Pre-event activity
    const preEventTrades = trades.filter((t) => {
      if (t.flags?.includes("pre_event")) return true;
      if (
        t.timeToResolution !== undefined &&
        t.timeToResolution < this.config.preEventWindowHours * 60 * 60 * 1000
      ) {
        return true;
      }
      return false;
    });
    const preEventPercentage = preEventTrades.length / trades.length;

    // Clustering score
    const clusteringScore =
      timeDiffs.length > 0
        ? 1 - Math.min(1, calculateStdDev(timeDiffs) / (avgHoldingPeriod || 1))
        : 0;

    // Profit factor
    const grossProfit = resolvedTrades
      .filter((t) => t.pnl! > 0)
      .reduce((sum, t) => sum + t.pnl!, 0);
    const grossLoss = Math.abs(
      resolvedTrades
        .filter((t) => t.pnl! < 0)
        .reduce((sum, t) => sum + t.pnl!, 0)
    );
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;

    // Trade size percentile (based on typical market averages)
    const medianSize = calculateMedian(sizes);
    const tradeSizePercentile = Math.min(1, medianSize / 5000);

    // Reversal rate
    let reversals = 0;
    for (let i = 1; i < trades.length; i++) {
      const curr = trades[i]!;
      const prev = trades[i - 1]!;
      if (curr.side !== prev.side) {
        reversals++;
      }
    }
    const reversalRate = trades.length > 1 ? reversals / (trades.length - 1) : 0;

    return {
      tradeFrequency,
      avgHoldingPeriod,
      sizeConsistency,
      winRate,
      offHoursPercentage,
      marketConcentration,
      buyPercentage,
      makerPercentage,
      timingConsistency,
      preEventPercentage,
      clusteringScore,
      categorySpecialization,
      profitFactor,
      tradeSizePercentile,
      reversalRate,
      avgTradeSize,
      maxTradeSize,
      totalVolume: sizes.reduce((a, b) => a + b, 0),
      uniqueMarkets: Object.keys(marketCounts).length,
      daysActive,
    };
  }

  private getEmptyFeatures(): ExtractedFeatures {
    return {
      tradeFrequency: 0,
      avgHoldingPeriod: 0,
      sizeConsistency: 0,
      winRate: 0,
      offHoursPercentage: 0,
      marketConcentration: 0,
      buyPercentage: 0,
      makerPercentage: 0,
      timingConsistency: 0,
      preEventPercentage: 0,
      clusteringScore: 0,
      categorySpecialization: 0,
      profitFactor: 0,
      tradeSizePercentile: 0,
      reversalRate: 0,
      avgTradeSize: 0,
      maxTradeSize: 0,
      totalVolume: 0,
      uniqueMarkets: 0,
      daysActive: 0,
    };
  }

  private matchPatterns(features: ExtractedFeatures): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const definition of this.patternDefinitions) {
      const contributions: FeatureContribution[] = [];
      let totalWeightedScore = 0;
      let totalWeight = 0;

      for (const req of definition.featureRequirements) {
        const featureValue = this.getFeatureValue(features, req.feature);
        const normalizedScore = normalizeFeatureValue(
          featureValue,
          req.min,
          req.max
        );
        const weightedScore = normalizedScore * req.weight;

        contributions.push({
          feature: req.feature,
          value: featureValue,
          contribution: weightedScore * 100,
          isStrongIndicator: normalizedScore >= 0.7,
        });

        totalWeightedScore += weightedScore;
        totalWeight += req.weight;
      }

      const score =
        totalWeight > 0
          ? Math.round((totalWeightedScore / totalWeight) * 100)
          : 0;

      matches.push({
        pattern: definition.type,
        score,
        contributions,
        isStrongMatch: score >= definition.minScore,
      });
    }

    return matches;
  }

  private getFeatureValue(
    features: ExtractedFeatures,
    feature: PatternFeature
  ): number {
    switch (feature) {
      case PatternFeature.TRADE_FREQUENCY:
        return features.tradeFrequency;
      case PatternFeature.HOLDING_PERIOD:
        return features.avgHoldingPeriod;
      case PatternFeature.SIZE_CONSISTENCY:
        return features.sizeConsistency;
      case PatternFeature.WIN_RATE:
        return features.winRate;
      case PatternFeature.TIME_PATTERN:
        return 1 - features.offHoursPercentage;
      case PatternFeature.MARKET_CONCENTRATION:
        return features.marketConcentration;
      case PatternFeature.BUY_SELL_RATIO:
        return features.buyPercentage;
      case PatternFeature.MAKER_TAKER_RATIO:
        return features.makerPercentage;
      case PatternFeature.TIMING_CONSISTENCY:
        return features.timingConsistency;
      case PatternFeature.PRE_EVENT_ACTIVITY:
        return features.preEventPercentage;
      case PatternFeature.TRADE_CLUSTERING:
        return features.clusteringScore;
      case PatternFeature.CATEGORY_SPECIALIZATION:
        return features.categorySpecialization;
      case PatternFeature.PROFIT_FACTOR:
        return Math.min(features.profitFactor / 5, 1);
      case PatternFeature.TRADE_SIZE_PERCENTILE:
        return features.tradeSizePercentile;
      case PatternFeature.REVERSAL_RATE:
        return features.reversalRate;
      default:
        return 0;
    }
  }

  private detectRiskFlags(
    features: ExtractedFeatures,
    trades: PatternTrade[],
    pattern: TradingPatternType
  ): PatternRiskFlag[] {
    const flags: PatternRiskFlag[] = [];

    // High win rate
    if (features.winRate >= this.config.highWinRateThreshold) {
      flags.push(PatternRiskFlag.HIGH_WIN_RATE);
    }

    // Pre-news trading
    if (features.preEventPercentage >= 0.3) {
      flags.push(PatternRiskFlag.PRE_NEWS_TRADING);
    }

    // Perfect timing
    const largeTrades = trades.filter(
      (t) =>
        t.sizeUsd >= this.config.largeTradeThreshold &&
        t.pnl !== null &&
        t.pnl !== undefined
    );
    if (largeTrades.length >= 5) {
      const largeWins = largeTrades.filter((t) => t.pnl! > 0).length;
      if (largeWins / largeTrades.length >= 0.85) {
        flags.push(PatternRiskFlag.PERFECT_TIMING);
      }
    }

    // Bot precision
    if (features.timingConsistency >= 0.85 && features.sizeConsistency >= 0.85) {
      flags.push(PatternRiskFlag.BOT_PRECISION);
    }

    // Unusual timing
    if (features.offHoursPercentage >= 0.5) {
      flags.push(PatternRiskFlag.UNUSUAL_TIMING);
    }

    // Fresh wallet activity
    if (
      trades.length > 0 &&
      features.daysActive < 7 &&
      trades[0]!.sizeUsd >= this.config.largeTradeThreshold
    ) {
      flags.push(PatternRiskFlag.FRESH_WALLET_ACTIVITY);
    }

    // High risk concentration
    if (features.categorySpecialization >= 0.8 && features.profitFactor >= 2) {
      flags.push(PatternRiskFlag.HIGH_RISK_CONCENTRATION);
    }

    // Coordinated trading
    const coordinatedTrades = trades.filter(
      (t) => t.flags?.includes("coordinated")
    );
    if (coordinatedTrades.length >= 3) {
      flags.push(PatternRiskFlag.COORDINATED_TRADING);
    }

    // Information asymmetry
    if (
      features.winRate >= 0.7 &&
      features.categorySpecialization >= 0.6 &&
      features.preEventPercentage >= 0.2
    ) {
      flags.push(PatternRiskFlag.INFO_ASYMMETRY);
    }

    // Add associated flags from pattern
    const patternDef = this.patternDefinitions.find(
      (p) => p.type === pattern
    );
    if (patternDef?.associatedRiskFlags) {
      for (const flag of patternDef.associatedRiskFlags) {
        if (!flags.includes(flag)) {
          flags.push(flag);
        }
      }
    }

    return flags;
  }

  private calculateRiskScore(
    flags: PatternRiskFlag[],
    features: ExtractedFeatures,
    pattern: TradingPatternType
  ): number {
    let score = 0;

    // Base scores from flags
    const flagScores: Record<PatternRiskFlag, number> = {
      [PatternRiskFlag.HIGH_WIN_RATE]: 15,
      [PatternRiskFlag.PERFECT_TIMING]: 25,
      [PatternRiskFlag.PRE_NEWS_TRADING]: 20,
      [PatternRiskFlag.COORDINATED_TRADING]: 20,
      [PatternRiskFlag.HIGH_RISK_CONCENTRATION]: 10,
      [PatternRiskFlag.BOT_PRECISION]: 15,
      [PatternRiskFlag.UNUSUAL_TIMING]: 10,
      [PatternRiskFlag.FRESH_WALLET_ACTIVITY]: 15,
      [PatternRiskFlag.WASH_TRADING]: 25,
      [PatternRiskFlag.INFO_ASYMMETRY]: 20,
    };

    for (const flag of flags) {
      score += flagScores[flag] || 5;
    }

    // Pattern-based risk
    if (pattern === TradingPatternType.POTENTIAL_INSIDER) {
      score += 20;
    }

    // Combination bonuses
    if (
      flags.includes(PatternRiskFlag.HIGH_WIN_RATE) &&
      flags.includes(PatternRiskFlag.PRE_NEWS_TRADING)
    ) {
      score += 15;
    }

    if (
      flags.includes(PatternRiskFlag.PERFECT_TIMING) &&
      flags.includes(PatternRiskFlag.FRESH_WALLET_ACTIVITY)
    ) {
      score += 15;
    }

    // Feature-based adjustments
    if (features.profitFactor >= 3 && features.winRate >= 0.7) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  private generateInsights(
    pattern: TradingPatternType,
    features: ExtractedFeatures,
    flags: PatternRiskFlag[],
    matches: PatternMatch[]
  ): string[] {
    const insights: string[] = [];

    // Primary pattern insight
    if (pattern !== TradingPatternType.UNKNOWN) {
      const patternName = pattern.toLowerCase().replace(/_/g, " ");
      insights.push(`Primary pattern: ${patternName}`);
    }

    // Frequency insight
    if (features.tradeFrequency >= 5) {
      insights.push(
        `High-frequency trader: ${features.tradeFrequency.toFixed(1)} trades/day`
      );
    } else if (features.tradeFrequency <= 0.5) {
      insights.push("Low-frequency trader: less than one trade every 2 days");
    }

    // Win rate insight
    if (features.winRate >= 0.7) {
      insights.push(`Unusually high win rate: ${Math.round(features.winRate * 100)}%`);
    }

    // Profit factor insight
    if (features.profitFactor >= 2) {
      insights.push(`Strong profit factor: ${features.profitFactor.toFixed(1)}`);
    }

    // Concentration insight
    if (features.marketConcentration >= 0.7) {
      insights.push("Highly concentrated in specific markets");
    }

    if (features.categorySpecialization >= 0.7) {
      insights.push("Specializes in specific market categories");
    }

    // Risk flag insights
    if (flags.includes(PatternRiskFlag.PERFECT_TIMING)) {
      insights.push("⚠️ Suspiciously perfect timing on large trades");
    }

    if (flags.includes(PatternRiskFlag.PRE_NEWS_TRADING)) {
      insights.push("⚠️ Frequent trading before news events");
    }

    if (flags.includes(PatternRiskFlag.COORDINATED_TRADING)) {
      insights.push("⚠️ Potential coordination with other wallets");
    }

    if (flags.includes(PatternRiskFlag.BOT_PRECISION)) {
      insights.push("⚠️ Bot-like trading precision detected");
    }

    // Secondary patterns
    const secondaryMatches = matches
      .slice(1, 3)
      .filter((m) => m.score >= 50);
    if (secondaryMatches.length > 0) {
      const secondaryNames = secondaryMatches
        .map((m) => m.pattern.toLowerCase().replace(/_/g, " "))
        .join(", ");
      insights.push(`Secondary patterns: ${secondaryNames}`);
    }

    return insights;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new TradingPatternClassifier instance
 */
export function createTradingPatternClassifier(
  config?: TradingPatternClassifierConfig
): TradingPatternClassifier {
  return new TradingPatternClassifier(config);
}

// Shared instance
let sharedClassifier: TradingPatternClassifier | null = null;

/**
 * Get the shared TradingPatternClassifier instance
 */
export function getSharedTradingPatternClassifier(): TradingPatternClassifier {
  if (!sharedClassifier) {
    sharedClassifier = new TradingPatternClassifier();
  }
  return sharedClassifier;
}

/**
 * Set the shared TradingPatternClassifier instance
 */
export function setSharedTradingPatternClassifier(
  classifier: TradingPatternClassifier
): void {
  sharedClassifier = classifier;
}

/**
 * Reset the shared TradingPatternClassifier instance
 */
export function resetSharedTradingPatternClassifier(): void {
  if (sharedClassifier) {
    sharedClassifier.clearCache();
  }
  sharedClassifier = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Classify trading pattern for a wallet
 */
export function classifyTradingPattern(
  address: string,
  trades: PatternTrade[]
): PatternClassificationResult | null {
  return getSharedTradingPatternClassifier().classify(address, trades);
}

/**
 * Update classification with new trades
 */
export function updateTradingPatternClassification(
  address: string,
  newTrades: PatternTrade[]
): PatternClassificationResult | null {
  return getSharedTradingPatternClassifier().updateClassification(
    address,
    newTrades
  );
}

/**
 * Get cached classification
 */
export function getTradingPatternClassification(
  address: string
): PatternClassificationResult | null {
  return getSharedTradingPatternClassifier().getClassification(address);
}

/**
 * Batch classify wallets
 */
export function batchClassifyTradingPatterns(
  walletTrades: Map<string, PatternTrade[]>
): BatchClassificationResult[] {
  return getSharedTradingPatternClassifier().classifyBatch(walletTrades);
}

/**
 * Check if wallet has high-risk pattern
 */
export function hasHighRiskPattern(
  address: string,
  threshold: number = 70
): boolean {
  const classification = getSharedTradingPatternClassifier().getClassification(
    address
  );
  return classification !== null && classification.riskScore >= threshold;
}

/**
 * Get wallets with potential insider patterns
 */
export function getWalletsWithPotentialInsiderPattern(): PatternClassificationResult[] {
  return getSharedTradingPatternClassifier().getPotentialInsiders();
}

/**
 * Get classification summary statistics
 */
export function getTradingPatternClassifierSummary(): ClassificationSummary {
  return getSharedTradingPatternClassifier().getSummary();
}

/**
 * Check if pattern type indicates suspicious activity
 */
export function isSuspiciousPattern(pattern: TradingPatternType): boolean {
  return (
    pattern === TradingPatternType.POTENTIAL_INSIDER ||
    pattern === TradingPatternType.BOT
  );
}

/**
 * Get pattern description
 */
export function getPatternDescription(pattern: TradingPatternType): string {
  const definitions = DEFAULT_PATTERN_DEFINITIONS;
  const def = definitions.find((d) => d.type === pattern);
  return def?.description || "Unknown pattern";
}
