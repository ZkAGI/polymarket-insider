/**
 * Coordinated Trading Detector (DET-PAT-008)
 *
 * Detect multiple wallets trading in coordination across Polymarket.
 * This module identifies wallets that are likely controlled by the same entity
 * or are collaborating to manipulate markets or hide trading activity.
 *
 * Features:
 * - Identify simultaneous trades across wallets
 * - Analyze trade similarity (market, size, timing, direction)
 * - Calculate coordination score for wallet groups
 * - Flag coordinated groups with risk assessment
 * - Support batch analysis and caching
 * - Event emission for detection alerts
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of coordination pattern detected
 */
export enum CoordinationPatternType {
  /** Unknown pattern - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Wallets trading same markets at same times */
  SIMULTANEOUS = "SIMULTANEOUS",
  /** Wallets making similar trade decisions */
  MIRROR_TRADING = "MIRROR_TRADING",
  /** Wallets trading opposite sides (potential wash trading) */
  COUNTER_PARTY = "COUNTER_PARTY",
  /** Sequential trades that appear to be split from one large order */
  ORDER_SPLITTING = "ORDER_SPLITTING",
  /** Time-delayed copying of trades */
  COPY_TRADING = "COPY_TRADING",
  /** Wallets alternating to maintain position */
  RELAY_TRADING = "RELAY_TRADING",
  /** Multiple wallets funded from same source trading together */
  FUNDING_LINKED = "FUNDING_LINKED",
  /** Wallets with shared profit/loss extraction patterns */
  PROFIT_EXTRACTION = "PROFIT_EXTRACTION",
  /** Multiple coordination patterns detected */
  MULTI_PATTERN = "MULTI_PATTERN",
}

/**
 * Confidence level in coordination detection
 */
export enum CoordinationConfidence {
  /** Very low - minimal indicators */
  VERY_LOW = "VERY_LOW",
  /** Low confidence */
  LOW = "LOW",
  /** Medium confidence */
  MEDIUM = "MEDIUM",
  /** High confidence */
  HIGH = "HIGH",
  /** Very high - strong evidence */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Risk level for coordinated trading group
 */
export enum CoordinationRiskLevel {
  /** No significant risk */
  NONE = "NONE",
  /** Low risk - may be benign */
  LOW = "LOW",
  /** Medium risk - warrants monitoring */
  MEDIUM = "MEDIUM",
  /** High risk - likely manipulation */
  HIGH = "HIGH",
  /** Critical - strong manipulation indicators */
  CRITICAL = "CRITICAL",
}

/**
 * Reason for flagging coordination
 */
export enum CoordinationFlag {
  /** Trades within suspicious time window */
  TIMING_CORRELATION = "TIMING_CORRELATION",
  /** Similar trade sizes */
  SIZE_SIMILARITY = "SIZE_SIMILARITY",
  /** Same market preferences */
  MARKET_OVERLAP = "MARKET_OVERLAP",
  /** Matching trade directions */
  DIRECTION_ALIGNMENT = "DIRECTION_ALIGNMENT",
  /** Opposite directions (wash trading) */
  OPPOSITE_DIRECTIONS = "OPPOSITE_DIRECTIONS",
  /** Shared funding sources */
  SHARED_FUNDING = "SHARED_FUNDING",
  /** Similar win rates */
  WIN_RATE_SIMILARITY = "WIN_RATE_SIMILARITY",
  /** Wallet age correlation */
  AGE_CORRELATION = "AGE_CORRELATION",
  /** Sequential trade timing */
  SEQUENTIAL_TIMING = "SEQUENTIAL_TIMING",
  /** Fresh wallets trading together */
  FRESH_WALLET_GROUP = "FRESH_WALLET_GROUP",
  /** Bot-like precision */
  BOT_INDICATORS = "BOT_INDICATORS",
  /** Unusual trading hours */
  OFF_HOURS_TRADING = "OFF_HOURS_TRADING",
}

/**
 * Trade data for coordination analysis
 */
export interface CoordinatedTrade {
  /** Unique trade ID */
  tradeId: string;
  /** Wallet address */
  walletAddress: string;
  /** Market ID */
  marketId: string;
  /** Market category (optional) */
  marketCategory?: string;
  /** Trade side */
  side: "buy" | "sell";
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade price */
  price: number;
  /** Trade timestamp (ms) */
  timestamp: number;
  /** Whether the trade was a win */
  isWin?: boolean;
  /** Outcome of the trade if known */
  outcome?: "win" | "loss" | "pending";
}

/**
 * Wallet pair similarity metrics
 */
export interface WalletPairSimilarity {
  /** First wallet address */
  walletA: string;
  /** Second wallet address */
  walletB: string;
  /** Overall similarity score (0-100) */
  similarityScore: number;
  /** Timing correlation (0-1) */
  timingCorrelation: number;
  /** Market overlap percentage (0-100) */
  marketOverlap: number;
  /** Trade size similarity (0-1) */
  sizeSimilarity: number;
  /** Direction alignment (0-1, 0.5 = random, 1 = same, 0 = opposite) */
  directionAlignment: number;
  /** Win rate correlation (0-1) */
  winRateCorrelation: number;
  /** Number of simultaneous trades (within window) */
  simultaneousTradeCount: number;
  /** Number of overlapping markets */
  overlappingMarkets: number;
  /** Total trades analyzed */
  totalTradesAnalyzed: number;
  /** Coordination flags */
  flags: CoordinationFlag[];
  /** Is pair likely coordinated */
  isLikelyCoordinated: boolean;
}

/**
 * A group of coordinated wallets
 */
export interface CoordinatedGroup {
  /** Unique group ID */
  groupId: string;
  /** Member wallet addresses */
  members: string[];
  /** Number of members */
  memberCount: number;
  /** Detected coordination pattern */
  pattern: CoordinationPatternType;
  /** Confidence in detection */
  confidence: CoordinationConfidence;
  /** Risk level */
  riskLevel: CoordinationRiskLevel;
  /** Coordination score (0-100) */
  coordinationScore: number;
  /** Total trades by group */
  totalTrades: number;
  /** Total volume traded by group */
  totalVolumeUsd: number;
  /** Markets traded by group */
  marketsTraded: string[];
  /** Common markets (traded by all) */
  commonMarkets: string[];
  /** Pair-wise similarities */
  pairSimilarities: WalletPairSimilarity[];
  /** Combined flags from all pairs */
  flags: CoordinationFlag[];
  /** Detection timestamp */
  detectedAt: Date;
  /** Time span of analyzed activity */
  activityTimespan: {
    start: Date;
    end: Date;
    durationMs: number;
  };
  /** Flag reasons in human-readable format */
  flagReasons: string[];
}

/**
 * Result of coordination analysis
 */
export interface CoordinationAnalysisResult {
  /** Wallet analyzed */
  walletAddress: string;
  /** Groups this wallet belongs to */
  groups: CoordinatedGroup[];
  /** Number of groups */
  groupCount: number;
  /** Is wallet part of any coordinated group */
  isCoordinated: boolean;
  /** Highest risk level across groups */
  highestRiskLevel: CoordinationRiskLevel;
  /** Top connected wallets */
  connectedWallets: Array<{
    address: string;
    similarityScore: number;
    pattern: CoordinationPatternType;
  }>;
  /** Total wallets analyzed against */
  walletsCompared: number;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Batch analysis result
 */
export interface BatchCoordinationResult {
  /** Individual results by wallet */
  resultsByWallet: Map<string, CoordinationAnalysisResult>;
  /** All detected groups */
  groups: CoordinatedGroup[];
  /** Total wallets analyzed */
  walletsAnalyzed: number;
  /** Wallets in coordinated groups */
  coordinatedWalletCount: number;
  /** Groups by risk level */
  groupsByRisk: Record<CoordinationRiskLevel, number>;
  /** Groups by pattern type */
  groupsByPattern: Record<CoordinationPatternType, number>;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Configuration for coordination thresholds
 */
export interface CoordinationThresholdConfig {
  /** Time window for simultaneous trades (ms, default: 60000 = 1 min) */
  simultaneousWindowMs: number;
  /** Time window for copy trading detection (ms, default: 300000 = 5 min) */
  copyWindowMs: number;
  /** Minimum similarity score to consider coordinated (0-100, default: 70) */
  minSimilarityScore: number;
  /** Minimum market overlap percentage (0-100, default: 30) */
  minMarketOverlap: number;
  /** Minimum simultaneous trades to flag (default: 3) */
  minSimultaneousTrades: number;
  /** Minimum trades per wallet for analysis (default: 5) */
  minTradesPerWallet: number;
  /** Minimum wallets for group formation (default: 2) */
  minGroupSize: number;
  /** Maximum wallets in a single group (default: 50) */
  maxGroupSize: number;
  /** Size similarity threshold (ratio, default: 0.3 = within 30%) */
  sizeSimilarityThreshold: number;
  /** Win rate similarity threshold (default: 0.15 = within 15%) */
  winRateSimilarityThreshold: number;
  /** Age correlation window (ms, default: 604800000 = 7 days) */
  ageCorrelationWindowMs: number;
  /** Fresh wallet age threshold (ms, default: 604800000 = 7 days) */
  freshWalletAgeMs: number;
  /** Weights for scoring */
  scoreWeights: {
    timingCorrelation: number;
    marketOverlap: number;
    sizeSimilarity: number;
    directionAlignment: number;
    winRateCorrelation: number;
  };
  /** Risk level thresholds (score) */
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Confidence thresholds (score) */
  confidenceThresholds: {
    veryLow: number;
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  };
}

/**
 * Configuration for CoordinatedTradingDetector
 */
export interface CoordinatedTradingDetectorConfig {
  /** Threshold configuration */
  thresholds?: Partial<CoordinationThresholdConfig>;
  /** Enable event emission (default: true) */
  enableEvents?: boolean;
  /** Enable caching (default: true) */
  enableCaching?: boolean;
  /** Cache TTL in ms (default: 300000 = 5 min) */
  cacheTtlMs?: number;
  /** Maximum groups to store (default: 500) */
  maxGroups?: number;
  /** Maximum pairs to analyze per wallet (default: 100) */
  maxPairsPerWallet?: number;
}

/**
 * Analysis options
 */
export interface AnalyzeCoordinationOptions {
  /** Time range start */
  startTime?: number;
  /** Time range end */
  endTime?: number;
  /** Custom thresholds */
  thresholds?: Partial<CoordinationThresholdConfig>;
  /** Force fresh analysis (bypass cache) */
  bypassCache?: boolean;
  /** Include trades from specific wallets only */
  walletFilter?: string[];
  /** Market filter */
  marketFilter?: string[];
}

/**
 * Summary statistics
 */
export interface CoordinatedTradingSummary {
  /** Total wallets tracked */
  totalWallets: number;
  /** Total trades tracked */
  totalTrades: number;
  /** Detected groups */
  detectedGroups: number;
  /** Groups by risk level */
  groupsByRisk: Record<CoordinationRiskLevel, number>;
  /** Groups by pattern */
  groupsByPattern: Record<CoordinationPatternType, number>;
  /** Total coordinated wallets */
  coordinatedWalletCount: number;
  /** Highest risk groups */
  highRiskGroups: CoordinatedGroup[];
  /** Most connected wallets */
  mostConnectedWallets: Array<{
    address: string;
    groupCount: number;
    avgSimilarity: number;
  }>;
  /** Cache stats */
  cacheStats: {
    size: number;
    hits: number;
    misses: number;
  };
  /** Last analysis time */
  lastAnalysisAt: Date | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Default threshold configuration */
export const DEFAULT_COORDINATION_THRESHOLDS: CoordinationThresholdConfig = {
  simultaneousWindowMs: 60 * 1000, // 1 minute
  copyWindowMs: 5 * 60 * 1000, // 5 minutes
  minSimilarityScore: 70,
  minMarketOverlap: 30,
  minSimultaneousTrades: 3,
  minTradesPerWallet: 5,
  minGroupSize: 2,
  maxGroupSize: 50,
  sizeSimilarityThreshold: 0.3,
  winRateSimilarityThreshold: 0.15,
  ageCorrelationWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  freshWalletAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  scoreWeights: {
    timingCorrelation: 0.25,
    marketOverlap: 0.2,
    sizeSimilarity: 0.15,
    directionAlignment: 0.25,
    winRateCorrelation: 0.15,
  },
  riskThresholds: {
    low: 40,
    medium: 55,
    high: 70,
    critical: 85,
  },
  confidenceThresholds: {
    veryLow: 20,
    low: 35,
    medium: 50,
    high: 70,
    veryHigh: 85,
  },
};

/** Default cache TTL */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Default max groups */
const DEFAULT_MAX_GROUPS = 500;

/** Default max pairs per wallet */
const DEFAULT_MAX_PAIRS_PER_WALLET = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique group ID
 */
function generateGroupId(): string {
  return `cgroup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalize wallet address
 */
function normalizeAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid wallet address: ${address}`);
  }
  return getAddress(address);
}

/**
 * Calculate timing correlation between two trade lists
 * Returns value 0-1 where 1 = perfectly correlated
 */
function calculateTimingCorrelation(
  tradesA: CoordinatedTrade[],
  tradesB: CoordinatedTrade[],
  windowMs: number
): { correlation: number; simultaneousCount: number } {
  if (tradesA.length === 0 || tradesB.length === 0) {
    return { correlation: 0, simultaneousCount: 0 };
  }

  let simultaneousCount = 0;
  const minTrades = Math.min(tradesA.length, tradesB.length);

  // Count simultaneous trades (within window)
  for (const tradeA of tradesA) {
    for (const tradeB of tradesB) {
      const timeDiff = Math.abs(tradeA.timestamp - tradeB.timestamp);
      if (timeDiff <= windowMs) {
        simultaneousCount++;
        break; // Count each trade A only once
      }
    }
  }

  // Correlation as ratio of simultaneous trades to smaller set
  const correlation = minTrades > 0 ? simultaneousCount / minTrades : 0;

  return { correlation: Math.min(1, correlation), simultaneousCount };
}

/**
 * Calculate market overlap between two wallets
 */
function calculateMarketOverlap(
  tradesA: CoordinatedTrade[],
  tradesB: CoordinatedTrade[]
): { overlap: number; overlappingMarkets: string[]; totalMarkets: number } {
  const marketsA = new Set(tradesA.map((t) => t.marketId));
  const marketsB = new Set(tradesB.map((t) => t.marketId));

  const overlappingMarkets = [...marketsA].filter((m) => marketsB.has(m));
  const allMarkets = new Set([...marketsA, ...marketsB]);

  const overlap =
    allMarkets.size > 0 ? (overlappingMarkets.length / allMarkets.size) * 100 : 0;

  return {
    overlap,
    overlappingMarkets,
    totalMarkets: allMarkets.size,
  };
}

/**
 * Calculate trade size similarity
 */
function calculateSizeSimilarity(
  tradesA: CoordinatedTrade[],
  tradesB: CoordinatedTrade[]
): number {
  if (tradesA.length === 0 || tradesB.length === 0) return 0;

  const avgSizeA =
    tradesA.reduce((sum, t) => sum + t.sizeUsd, 0) / tradesA.length;
  const avgSizeB =
    tradesB.reduce((sum, t) => sum + t.sizeUsd, 0) / tradesB.length;

  if (avgSizeA === 0 && avgSizeB === 0) return 1;
  if (avgSizeA === 0 || avgSizeB === 0) return 0;

  const ratio = Math.min(avgSizeA, avgSizeB) / Math.max(avgSizeA, avgSizeB);
  return ratio;
}

/**
 * Calculate direction alignment in overlapping markets
 * 1 = always same direction, 0 = always opposite, 0.5 = random
 */
function calculateDirectionAlignment(
  tradesA: CoordinatedTrade[],
  tradesB: CoordinatedTrade[],
  windowMs: number
): number {
  const matchingPairs: { sameDirection: boolean }[] = [];

  for (const tradeA of tradesA) {
    for (const tradeB of tradesB) {
      // Only compare trades in same market and within time window
      if (tradeA.marketId !== tradeB.marketId) continue;
      if (Math.abs(tradeA.timestamp - tradeB.timestamp) > windowMs) continue;

      matchingPairs.push({ sameDirection: tradeA.side === tradeB.side });
    }
  }

  if (matchingPairs.length === 0) return 0.5; // No data = assume random

  const sameCount = matchingPairs.filter((p) => p.sameDirection).length;
  return sameCount / matchingPairs.length;
}

/**
 * Calculate win rate for trades
 */
function calculateWinRate(trades: CoordinatedTrade[]): number {
  const resolvedTrades = trades.filter(
    (t) => t.outcome === "win" || t.outcome === "loss"
  );
  if (resolvedTrades.length === 0) return 0.5; // Unknown

  const wins = resolvedTrades.filter((t) => t.outcome === "win").length;
  return wins / resolvedTrades.length;
}

/**
 * Calculate win rate correlation (similarity)
 */
function calculateWinRateCorrelation(
  tradesA: CoordinatedTrade[],
  tradesB: CoordinatedTrade[]
): number {
  const winRateA = calculateWinRate(tradesA);
  const winRateB = calculateWinRate(tradesB);

  // Similar win rates = high correlation
  const diff = Math.abs(winRateA - winRateB);
  return Math.max(0, 1 - diff * 2); // 0-1 scale
}

/**
 * Determine coordination flags for a pair
 */
function determineFlags(
  _tradesA: CoordinatedTrade[],
  _tradesB: CoordinatedTrade[],
  similarity: WalletPairSimilarity,
  thresholds: CoordinationThresholdConfig
): CoordinationFlag[] {
  // Note: tradesA/B params reserved for future enhancements (age correlation, etc.)
  const flags: CoordinationFlag[] = [];

  // Timing correlation
  if (similarity.timingCorrelation > 0.5) {
    flags.push(CoordinationFlag.TIMING_CORRELATION);
  }

  // Simultaneous trades
  if (similarity.simultaneousTradeCount >= thresholds.minSimultaneousTrades) {
    flags.push(CoordinationFlag.SEQUENTIAL_TIMING);
  }

  // Size similarity
  if (similarity.sizeSimilarity > 1 - thresholds.sizeSimilarityThreshold) {
    flags.push(CoordinationFlag.SIZE_SIMILARITY);
  }

  // Market overlap
  if (similarity.marketOverlap >= thresholds.minMarketOverlap) {
    flags.push(CoordinationFlag.MARKET_OVERLAP);
  }

  // Direction alignment
  if (similarity.directionAlignment > 0.8) {
    flags.push(CoordinationFlag.DIRECTION_ALIGNMENT);
  } else if (similarity.directionAlignment < 0.2) {
    flags.push(CoordinationFlag.OPPOSITE_DIRECTIONS);
  }

  // Win rate similarity
  if (similarity.winRateCorrelation > 1 - thresholds.winRateSimilarityThreshold) {
    flags.push(CoordinationFlag.WIN_RATE_SIMILARITY);
  }

  // Check for bot indicators (very high timing regularity)
  if (similarity.timingCorrelation > 0.9 && similarity.simultaneousTradeCount > 5) {
    flags.push(CoordinationFlag.BOT_INDICATORS);
  }

  return flags;
}

/**
 * Determine coordination pattern type from pair similarity
 */
function determinePatternType(
  similarity: WalletPairSimilarity
): CoordinationPatternType {
  const flags = similarity.flags;
  const patterns: CoordinationPatternType[] = [];

  // Check for specific patterns
  if (flags.includes(CoordinationFlag.OPPOSITE_DIRECTIONS)) {
    patterns.push(CoordinationPatternType.COUNTER_PARTY);
  }

  if (
    flags.includes(CoordinationFlag.TIMING_CORRELATION) &&
    flags.includes(CoordinationFlag.DIRECTION_ALIGNMENT)
  ) {
    if (similarity.timingCorrelation > 0.8) {
      patterns.push(CoordinationPatternType.SIMULTANEOUS);
    } else {
      patterns.push(CoordinationPatternType.COPY_TRADING);
    }
  }

  if (flags.includes(CoordinationFlag.SIZE_SIMILARITY) && similarity.sizeSimilarity > 0.9) {
    patterns.push(CoordinationPatternType.ORDER_SPLITTING);
  }

  if (flags.includes(CoordinationFlag.SEQUENTIAL_TIMING)) {
    patterns.push(CoordinationPatternType.RELAY_TRADING);
  }

  if (flags.includes(CoordinationFlag.SHARED_FUNDING)) {
    patterns.push(CoordinationPatternType.FUNDING_LINKED);
  }

  // Determine final pattern
  if (patterns.length === 0) {
    return CoordinationPatternType.UNKNOWN;
  } else if (patterns.length === 1) {
    return patterns[0] ?? CoordinationPatternType.UNKNOWN;
  } else {
    return CoordinationPatternType.MULTI_PATTERN;
  }
}

/**
 * Determine confidence level from score
 */
function determineConfidence(
  score: number,
  thresholds: CoordinationThresholdConfig
): CoordinationConfidence {
  if (score >= thresholds.confidenceThresholds.veryHigh) {
    return CoordinationConfidence.VERY_HIGH;
  } else if (score >= thresholds.confidenceThresholds.high) {
    return CoordinationConfidence.HIGH;
  } else if (score >= thresholds.confidenceThresholds.medium) {
    return CoordinationConfidence.MEDIUM;
  } else if (score >= thresholds.confidenceThresholds.low) {
    return CoordinationConfidence.LOW;
  } else {
    return CoordinationConfidence.VERY_LOW;
  }
}

/**
 * Determine risk level from score and flags
 */
function determineRiskLevel(
  score: number,
  flags: CoordinationFlag[],
  thresholds: CoordinationThresholdConfig
): CoordinationRiskLevel {
  // Boost score for concerning flags
  let adjustedScore = score;

  if (flags.includes(CoordinationFlag.OPPOSITE_DIRECTIONS)) {
    adjustedScore += 10; // Wash trading indicator
  }
  if (flags.includes(CoordinationFlag.BOT_INDICATORS)) {
    adjustedScore += 5;
  }
  if (flags.includes(CoordinationFlag.FRESH_WALLET_GROUP)) {
    adjustedScore += 10;
  }

  if (adjustedScore >= thresholds.riskThresholds.critical) {
    return CoordinationRiskLevel.CRITICAL;
  } else if (adjustedScore >= thresholds.riskThresholds.high) {
    return CoordinationRiskLevel.HIGH;
  } else if (adjustedScore >= thresholds.riskThresholds.medium) {
    return CoordinationRiskLevel.MEDIUM;
  } else if (adjustedScore >= thresholds.riskThresholds.low) {
    return CoordinationRiskLevel.LOW;
  } else {
    return CoordinationRiskLevel.NONE;
  }
}

/**
 * Generate human-readable flag reasons
 */
function generateFlagReasons(
  flags: CoordinationFlag[],
  similarity?: WalletPairSimilarity
): string[] {
  const reasons: string[] = [];

  if (flags.includes(CoordinationFlag.TIMING_CORRELATION)) {
    const pct = similarity ? Math.round(similarity.timingCorrelation * 100) : 0;
    reasons.push(`Trades occur at similar times (${pct}% timing correlation)`);
  }

  if (flags.includes(CoordinationFlag.SIZE_SIMILARITY)) {
    const pct = similarity ? Math.round(similarity.sizeSimilarity * 100) : 0;
    reasons.push(`Similar trade sizes (${pct}% size similarity)`);
  }

  if (flags.includes(CoordinationFlag.MARKET_OVERLAP)) {
    const pct = similarity ? Math.round(similarity.marketOverlap) : 0;
    reasons.push(`Trading same markets (${pct}% market overlap)`);
  }

  if (flags.includes(CoordinationFlag.DIRECTION_ALIGNMENT)) {
    reasons.push("Consistently trading same direction in shared markets");
  }

  if (flags.includes(CoordinationFlag.OPPOSITE_DIRECTIONS)) {
    reasons.push(
      "Trading opposite directions in same markets (potential wash trading)"
    );
  }

  if (flags.includes(CoordinationFlag.SHARED_FUNDING)) {
    reasons.push("Wallets share common funding sources");
  }

  if (flags.includes(CoordinationFlag.WIN_RATE_SIMILARITY)) {
    reasons.push("Suspiciously similar win rates");
  }

  if (flags.includes(CoordinationFlag.AGE_CORRELATION)) {
    reasons.push("Wallets created around same time");
  }

  if (flags.includes(CoordinationFlag.SEQUENTIAL_TIMING)) {
    reasons.push("Sequential trades suggesting relay or split orders");
  }

  if (flags.includes(CoordinationFlag.FRESH_WALLET_GROUP)) {
    reasons.push("Group of fresh wallets trading together");
  }

  if (flags.includes(CoordinationFlag.BOT_INDICATORS)) {
    reasons.push("Bot-like precision in timing");
  }

  if (flags.includes(CoordinationFlag.OFF_HOURS_TRADING)) {
    reasons.push("Trading during unusual hours");
  }

  return reasons;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Coordinated Trading Detector
 *
 * Detects multiple wallets trading in coordination.
 */
export class CoordinatedTradingDetector extends EventEmitter {
  private thresholds: CoordinationThresholdConfig;
  private enableEvents: boolean;
  private enableCaching: boolean;
  private cacheTtlMs: number;
  private maxGroups: number;
  private maxPairsPerWallet: number;

  // Trade storage by wallet
  private tradesByWallet: Map<string, CoordinatedTrade[]> = new Map();

  // Detected groups
  private detectedGroups: CoordinatedGroup[] = [];

  // Cache
  private analysisCache: Map<
    string,
    { result: CoordinationAnalysisResult; expiresAt: number }
  > = new Map();
  private pairCache: Map<
    string,
    { similarity: WalletPairSimilarity; expiresAt: number }
  > = new Map();

  // Cache stats
  private cacheHits = 0;
  private cacheMisses = 0;

  // Last analysis time
  private lastAnalysisAt: Date | null = null;

  constructor(config: CoordinatedTradingDetectorConfig = {}) {
    super();

    this.thresholds = {
      ...DEFAULT_COORDINATION_THRESHOLDS,
      ...config.thresholds,
      scoreWeights: {
        ...DEFAULT_COORDINATION_THRESHOLDS.scoreWeights,
        ...config.thresholds?.scoreWeights,
      },
      riskThresholds: {
        ...DEFAULT_COORDINATION_THRESHOLDS.riskThresholds,
        ...config.thresholds?.riskThresholds,
      },
      confidenceThresholds: {
        ...DEFAULT_COORDINATION_THRESHOLDS.confidenceThresholds,
        ...config.thresholds?.confidenceThresholds,
      },
    };

    this.enableEvents = config.enableEvents ?? true;
    this.enableCaching = config.enableCaching ?? true;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxGroups = config.maxGroups ?? DEFAULT_MAX_GROUPS;
    this.maxPairsPerWallet = config.maxPairsPerWallet ?? DEFAULT_MAX_PAIRS_PER_WALLET;
  }

  // --------------------------------------------------------------------------
  // Trade Management
  // --------------------------------------------------------------------------

  /**
   * Add trades for analysis
   */
  addTrades(trades: CoordinatedTrade[]): void {
    if (!trades || trades.length === 0) return;

    for (const trade of trades) {
      try {
        const normalizedAddress = normalizeAddress(trade.walletAddress);
        const normalizedTrade = { ...trade, walletAddress: normalizedAddress };

        const existing = this.tradesByWallet.get(normalizedAddress) || [];

        // Deduplicate by trade ID
        if (!existing.some((t) => t.tradeId === trade.tradeId)) {
          existing.push(normalizedTrade);
          this.tradesByWallet.set(normalizedAddress, existing);
        }
      } catch {
        // Skip invalid addresses
      }
    }

    // Invalidate cache
    this.clearCache();

    if (this.enableEvents) {
      this.emit("tradesAdded", { count: trades.length });
    }
  }

  /**
   * Get trades for a wallet
   */
  getTrades(walletAddress: string): CoordinatedTrade[] {
    try {
      const normalized = normalizeAddress(walletAddress);
      return [...(this.tradesByWallet.get(normalized) || [])];
    } catch {
      return [];
    }
  }

  /**
   * Get all tracked wallets
   */
  getTrackedWallets(): string[] {
    return [...this.tradesByWallet.keys()];
  }

  /**
   * Clear trades for a wallet
   */
  clearTrades(walletAddress: string): void {
    try {
      const normalized = normalizeAddress(walletAddress);
      this.tradesByWallet.delete(normalized);
      this.clearCache();

      if (this.enableEvents) {
        this.emit("tradesCleared", { wallet: normalized });
      }
    } catch {
      // Invalid address
    }
  }

  /**
   * Clear all trades
   */
  clearAllTrades(): void {
    this.tradesByWallet.clear();
    this.detectedGroups = [];
    this.clearCache();

    if (this.enableEvents) {
      this.emit("allTradesCleared");
    }
  }

  // --------------------------------------------------------------------------
  // Pair Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze similarity between two wallets
   */
  analyzePair(
    walletA: string,
    walletB: string,
    options: AnalyzeCoordinationOptions = {}
  ): WalletPairSimilarity | null {
    try {
      const normalizedA = normalizeAddress(walletA);
      const normalizedB = normalizeAddress(walletB);

      if (normalizedA === normalizedB) return null;

      // Check cache
      const cacheKey = [normalizedA, normalizedB].sort().join(":");
      const cached = this.pairCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now() && !options.bypassCache) {
        this.cacheHits++;
        return cached.similarity;
      }
      this.cacheMisses++;

      // Get trades
      let tradesA = this.getTrades(normalizedA);
      let tradesB = this.getTrades(normalizedB);

      // Apply filters
      if (options.startTime !== undefined) {
        tradesA = tradesA.filter((t) => t.timestamp >= options.startTime!);
        tradesB = tradesB.filter((t) => t.timestamp >= options.startTime!);
      }
      if (options.endTime !== undefined) {
        tradesA = tradesA.filter((t) => t.timestamp <= options.endTime!);
        tradesB = tradesB.filter((t) => t.timestamp <= options.endTime!);
      }
      if (options.marketFilter && options.marketFilter.length > 0) {
        const marketSet = new Set(options.marketFilter);
        tradesA = tradesA.filter((t) => marketSet.has(t.marketId));
        tradesB = tradesB.filter((t) => marketSet.has(t.marketId));
      }

      const thresholds = {
        ...this.thresholds,
        ...options.thresholds,
      };

      // Check minimum trades
      if (
        tradesA.length < thresholds.minTradesPerWallet ||
        tradesB.length < thresholds.minTradesPerWallet
      ) {
        return null;
      }

      // Calculate metrics
      const { correlation: timingCorrelation, simultaneousCount } =
        calculateTimingCorrelation(tradesA, tradesB, thresholds.simultaneousWindowMs);

      const { overlap: marketOverlap, overlappingMarkets } = calculateMarketOverlap(
        tradesA,
        tradesB
      );

      const sizeSimilarity = calculateSizeSimilarity(tradesA, tradesB);

      const directionAlignment = calculateDirectionAlignment(
        tradesA,
        tradesB,
        thresholds.simultaneousWindowMs
      );

      const winRateCorrelation = calculateWinRateCorrelation(tradesA, tradesB);

      // Calculate overall similarity score
      const weights = thresholds.scoreWeights;
      const similarityScore =
        timingCorrelation * weights.timingCorrelation * 100 +
        (marketOverlap / 100) * weights.marketOverlap * 100 +
        sizeSimilarity * weights.sizeSimilarity * 100 +
        Math.abs(directionAlignment - 0.5) * 2 * weights.directionAlignment * 100 +
        winRateCorrelation * weights.winRateCorrelation * 100;

      const similarity: WalletPairSimilarity = {
        walletA: normalizedA,
        walletB: normalizedB,
        similarityScore: Math.min(100, Math.round(similarityScore)),
        timingCorrelation,
        marketOverlap,
        sizeSimilarity,
        directionAlignment,
        winRateCorrelation,
        simultaneousTradeCount: simultaneousCount,
        overlappingMarkets: overlappingMarkets.length,
        totalTradesAnalyzed: tradesA.length + tradesB.length,
        flags: [],
        isLikelyCoordinated: false,
      };

      // Determine flags
      similarity.flags = determineFlags(tradesA, tradesB, similarity, thresholds);
      similarity.isLikelyCoordinated =
        similarity.similarityScore >= thresholds.minSimilarityScore &&
        similarity.flags.length >= 2;

      // Cache result
      if (this.enableCaching) {
        this.pairCache.set(cacheKey, {
          similarity,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
      }

      return similarity;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Group Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze a wallet for coordination with others
   */
  analyze(
    walletAddress: string,
    options: AnalyzeCoordinationOptions = {}
  ): CoordinationAnalysisResult {
    const normalized = normalizeAddress(walletAddress);

    // Check cache
    const cacheKey = `analysis:${normalized}:${options.startTime ?? ""}:${options.endTime ?? ""}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && !options.bypassCache) {
      this.cacheHits++;
      return cached.result;
    }
    this.cacheMisses++;

    const allWallets = this.getTrackedWallets();
    const otherWallets = allWallets.filter((w) => w !== normalized);

    // Apply wallet filter if specified
    let walletsToCompare = otherWallets;
    if (options.walletFilter && options.walletFilter.length > 0) {
      const filterSet = new Set(
        options.walletFilter.map((w) => {
          try {
            return normalizeAddress(w);
          } catch {
            return "";
          }
        })
      );
      walletsToCompare = otherWallets.filter((w) => filterSet.has(w));
    }

    // Limit pairs
    const walletsToAnalyze = walletsToCompare.slice(0, this.maxPairsPerWallet);

    // Analyze pairs
    const pairSimilarities: WalletPairSimilarity[] = [];
    for (const otherWallet of walletsToAnalyze) {
      const similarity = this.analyzePair(normalized, otherWallet, options);
      if (similarity) {
        pairSimilarities.push(similarity);
      }
    }

    // Find coordinated pairs
    const coordinatedPairs = pairSimilarities.filter((s) => s.isLikelyCoordinated);

    // Build groups from connected wallets
    const groups = this.buildGroupsFromPairs(normalized, coordinatedPairs, options);

    // Update detected groups (avoid duplicates)
    for (const group of groups) {
      const existingIdx = this.detectedGroups.findIndex((g) =>
        this.areGroupsEquivalent(g, group)
      );
      if (existingIdx >= 0) {
        this.detectedGroups[existingIdx] = group;
      } else {
        this.detectedGroups.push(group);
        if (this.detectedGroups.length > this.maxGroups) {
          this.detectedGroups.shift();
        }
      }
    }

    // Determine highest risk
    let highestRiskLevel = CoordinationRiskLevel.NONE;
    for (const group of groups) {
      if (this.compareRiskLevels(group.riskLevel, highestRiskLevel) > 0) {
        highestRiskLevel = group.riskLevel;
      }
    }

    // Build connected wallets list
    const connectedWallets = coordinatedPairs
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10)
      .map((pair) => ({
        address: pair.walletA === normalized ? pair.walletB : pair.walletA,
        similarityScore: pair.similarityScore,
        pattern: determinePatternType(pair),
      }));

    const result: CoordinationAnalysisResult = {
      walletAddress: normalized,
      groups,
      groupCount: groups.length,
      isCoordinated: groups.length > 0,
      highestRiskLevel,
      connectedWallets,
      walletsCompared: walletsToAnalyze.length,
      analyzedAt: new Date(),
    };

    // Cache result
    if (this.enableCaching) {
      this.analysisCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    this.lastAnalysisAt = new Date();

    // Emit events
    if (this.enableEvents) {
      this.emit("analysisComplete", { wallet: normalized, result });

      for (const group of groups) {
        if (
          group.riskLevel === CoordinationRiskLevel.HIGH ||
          group.riskLevel === CoordinationRiskLevel.CRITICAL
        ) {
          this.emit("highRiskGroupDetected", { group });
        }
      }
    }

    return result;
  }

  /**
   * Build groups from pair similarities
   */
  private buildGroupsFromPairs(
    sourceWallet: string,
    pairs: WalletPairSimilarity[],
    options: AnalyzeCoordinationOptions
  ): CoordinatedGroup[] {
    if (pairs.length === 0) return [];

    const thresholds = { ...this.thresholds, ...options.thresholds };

    // Use union-find to cluster wallets
    const walletToGroup = new Map<string, string>();
    walletToGroup.set(sourceWallet, sourceWallet);

    for (const pair of pairs) {
      const other = pair.walletA === sourceWallet ? pair.walletB : pair.walletA;
      walletToGroup.set(other, sourceWallet);
    }

    // For now, all coordinated wallets form one group with source
    const groupMembers = [sourceWallet, ...pairs.map((p) =>
      p.walletA === sourceWallet ? p.walletB : p.walletA
    )];

    if (groupMembers.length < thresholds.minGroupSize) return [];

    // Limit group size
    const limitedMembers = groupMembers.slice(0, thresholds.maxGroupSize);

    // Calculate group metrics
    const allTrades: CoordinatedTrade[] = [];
    const marketSet = new Set<string>();

    for (const member of limitedMembers) {
      const trades = this.getTrades(member);
      allTrades.push(...trades);
      trades.forEach((t) => marketSet.add(t.marketId));
    }

    // Find common markets
    const marketCounts = new Map<string, number>();
    for (const member of limitedMembers) {
      const trades = this.getTrades(member);
      const memberMarkets = new Set(trades.map((t) => t.marketId));
      memberMarkets.forEach((m) => {
        marketCounts.set(m, (marketCounts.get(m) || 0) + 1);
      });
    }
    const commonMarkets = [...marketCounts.entries()]
      .filter(([, count]) => count === limitedMembers.length)
      .map(([market]) => market);

    // Calculate average similarity
    const avgSimilarity =
      pairs.reduce((sum, p) => sum + p.similarityScore, 0) / pairs.length;

    // Collect all flags
    const allFlags = new Set<CoordinationFlag>();
    pairs.forEach((p) => p.flags.forEach((f) => allFlags.add(f)));
    const flags = [...allFlags];

    // Determine pattern (most common among pairs)
    const patternCounts = new Map<CoordinationPatternType, number>();
    pairs.forEach((p) => {
      const pattern = determinePatternType(p);
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    });
    let dominantPattern = CoordinationPatternType.UNKNOWN;
    let maxCount = 0;
    patternCounts.forEach((count, pattern) => {
      if (count > maxCount) {
        maxCount = count;
        dominantPattern = pattern;
      }
    });

    // Calculate timespan
    const timestamps = allTrades.map((t) => t.timestamp);
    const startTime = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const endTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    const group: CoordinatedGroup = {
      groupId: generateGroupId(),
      members: limitedMembers,
      memberCount: limitedMembers.length,
      pattern: dominantPattern,
      confidence: determineConfidence(avgSimilarity, thresholds),
      riskLevel: determineRiskLevel(avgSimilarity, flags, thresholds),
      coordinationScore: Math.round(avgSimilarity),
      totalTrades: allTrades.length,
      totalVolumeUsd: allTrades.reduce((sum, t) => sum + t.sizeUsd, 0),
      marketsTraded: [...marketSet],
      commonMarkets,
      pairSimilarities: pairs,
      flags,
      detectedAt: new Date(),
      activityTimespan: {
        start: new Date(startTime),
        end: new Date(endTime),
        durationMs: endTime - startTime,
      },
      flagReasons: generateFlagReasons(flags),
    };

    return [group];
  }

  /**
   * Check if two groups are equivalent (same members)
   */
  private areGroupsEquivalent(
    groupA: CoordinatedGroup,
    groupB: CoordinatedGroup
  ): boolean {
    if (groupA.memberCount !== groupB.memberCount) return false;

    const membersA = new Set(groupA.members);
    return groupB.members.every((m) => membersA.has(m));
  }

  /**
   * Compare risk levels (returns positive if a > b)
   */
  private compareRiskLevels(
    a: CoordinationRiskLevel,
    b: CoordinationRiskLevel
  ): number {
    const order = {
      [CoordinationRiskLevel.NONE]: 0,
      [CoordinationRiskLevel.LOW]: 1,
      [CoordinationRiskLevel.MEDIUM]: 2,
      [CoordinationRiskLevel.HIGH]: 3,
      [CoordinationRiskLevel.CRITICAL]: 4,
    };
    return order[a] - order[b];
  }

  // --------------------------------------------------------------------------
  // Batch Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze multiple wallets for coordination
   */
  batchAnalyze(
    walletAddresses: string[],
    options: AnalyzeCoordinationOptions = {}
  ): BatchCoordinationResult {
    const startTime = Date.now();

    const resultsByWallet = new Map<string, CoordinationAnalysisResult>();
    const allGroups: CoordinatedGroup[] = [];
    const seenGroupIds = new Set<string>();

    let coordinatedCount = 0;

    for (const wallet of walletAddresses) {
      try {
        const result = this.analyze(wallet, options);
        resultsByWallet.set(result.walletAddress, result);

        if (result.isCoordinated) {
          coordinatedCount++;
        }

        for (const group of result.groups) {
          if (!seenGroupIds.has(group.groupId)) {
            seenGroupIds.add(group.groupId);
            allGroups.push(group);
          }
        }
      } catch {
        // Skip invalid wallets
      }
    }

    // Count by risk level
    const groupsByRisk: Record<CoordinationRiskLevel, number> = {
      [CoordinationRiskLevel.NONE]: 0,
      [CoordinationRiskLevel.LOW]: 0,
      [CoordinationRiskLevel.MEDIUM]: 0,
      [CoordinationRiskLevel.HIGH]: 0,
      [CoordinationRiskLevel.CRITICAL]: 0,
    };

    // Count by pattern
    const groupsByPattern: Record<CoordinationPatternType, number> = {
      [CoordinationPatternType.UNKNOWN]: 0,
      [CoordinationPatternType.SIMULTANEOUS]: 0,
      [CoordinationPatternType.MIRROR_TRADING]: 0,
      [CoordinationPatternType.COUNTER_PARTY]: 0,
      [CoordinationPatternType.ORDER_SPLITTING]: 0,
      [CoordinationPatternType.COPY_TRADING]: 0,
      [CoordinationPatternType.RELAY_TRADING]: 0,
      [CoordinationPatternType.FUNDING_LINKED]: 0,
      [CoordinationPatternType.PROFIT_EXTRACTION]: 0,
      [CoordinationPatternType.MULTI_PATTERN]: 0,
    };

    for (const group of allGroups) {
      groupsByRisk[group.riskLevel]++;
      groupsByPattern[group.pattern]++;
    }

    if (this.enableEvents) {
      this.emit("batchAnalysisComplete", {
        walletsAnalyzed: walletAddresses.length,
        groupsDetected: allGroups.length,
      });
    }

    return {
      resultsByWallet,
      groups: allGroups,
      walletsAnalyzed: walletAddresses.length,
      coordinatedWalletCount: coordinatedCount,
      groupsByRisk,
      groupsByPattern,
      processingTimeMs: Date.now() - startTime,
      analyzedAt: new Date(),
    };
  }

  // --------------------------------------------------------------------------
  // Detection Methods
  // --------------------------------------------------------------------------

  /**
   * Check if wallet is in a coordinated group
   */
  isCoordinated(walletAddress: string): boolean {
    try {
      const normalized = normalizeAddress(walletAddress);
      return this.detectedGroups.some((g) => g.members.includes(normalized));
    } catch {
      return false;
    }
  }

  /**
   * Get groups for a wallet
   */
  getGroupsForWallet(walletAddress: string): CoordinatedGroup[] {
    try {
      const normalized = normalizeAddress(walletAddress);
      return this.detectedGroups.filter((g) => g.members.includes(normalized));
    } catch {
      return [];
    }
  }

  /**
   * Get all detected groups
   */
  getDetectedGroups(): CoordinatedGroup[] {
    return [...this.detectedGroups];
  }

  /**
   * Get high risk groups
   */
  getHighRiskGroups(): CoordinatedGroup[] {
    return this.detectedGroups.filter(
      (g) =>
        g.riskLevel === CoordinationRiskLevel.HIGH ||
        g.riskLevel === CoordinationRiskLevel.CRITICAL
    );
  }

  /**
   * Get groups by pattern type
   */
  getGroupsByPattern(pattern: CoordinationPatternType): CoordinatedGroup[] {
    return this.detectedGroups.filter((g) => g.pattern === pattern);
  }

  /**
   * Get groups by risk level
   */
  getGroupsByRiskLevel(riskLevel: CoordinationRiskLevel): CoordinatedGroup[] {
    return this.detectedGroups.filter((g) => g.riskLevel === riskLevel);
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.pairCache.clear();

    if (this.enableEvents) {
      this.emit("cacheCleared");
    }
  }

  /**
   * Prune expired cache entries
   */
  pruneCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.analysisCache) {
      if (entry.expiresAt <= now) {
        this.analysisCache.delete(key);
      }
    }

    for (const [key, entry] of this.pairCache) {
      if (entry.expiresAt <= now) {
        this.pairCache.delete(key);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<CoordinationThresholdConfig>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
      scoreWeights: {
        ...this.thresholds.scoreWeights,
        ...thresholds.scoreWeights,
      },
      riskThresholds: {
        ...this.thresholds.riskThresholds,
        ...thresholds.riskThresholds,
      },
      confidenceThresholds: {
        ...this.thresholds.confidenceThresholds,
        ...thresholds.confidenceThresholds,
      },
    };

    this.clearCache();

    if (this.enableEvents) {
      this.emit("configUpdated", { thresholds: this.thresholds });
    }
  }

  /**
   * Get current thresholds
   */
  getThresholds(): CoordinationThresholdConfig {
    return { ...this.thresholds };
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------

  /**
   * Get summary statistics
   */
  getSummary(): CoordinatedTradingSummary {
    const groupsByRisk: Record<CoordinationRiskLevel, number> = {
      [CoordinationRiskLevel.NONE]: 0,
      [CoordinationRiskLevel.LOW]: 0,
      [CoordinationRiskLevel.MEDIUM]: 0,
      [CoordinationRiskLevel.HIGH]: 0,
      [CoordinationRiskLevel.CRITICAL]: 0,
    };

    const groupsByPattern: Record<CoordinationPatternType, number> = {
      [CoordinationPatternType.UNKNOWN]: 0,
      [CoordinationPatternType.SIMULTANEOUS]: 0,
      [CoordinationPatternType.MIRROR_TRADING]: 0,
      [CoordinationPatternType.COUNTER_PARTY]: 0,
      [CoordinationPatternType.ORDER_SPLITTING]: 0,
      [CoordinationPatternType.COPY_TRADING]: 0,
      [CoordinationPatternType.RELAY_TRADING]: 0,
      [CoordinationPatternType.FUNDING_LINKED]: 0,
      [CoordinationPatternType.PROFIT_EXTRACTION]: 0,
      [CoordinationPatternType.MULTI_PATTERN]: 0,
    };

    const coordinatedWallets = new Set<string>();

    for (const group of this.detectedGroups) {
      groupsByRisk[group.riskLevel]++;
      groupsByPattern[group.pattern]++;
      group.members.forEach((m) => coordinatedWallets.add(m));
    }

    // Calculate most connected wallets
    const walletGroupCounts = new Map<string, { count: number; totalSim: number }>();
    for (const group of this.detectedGroups) {
      for (const member of group.members) {
        const existing = walletGroupCounts.get(member) || { count: 0, totalSim: 0 };
        existing.count++;
        existing.totalSim += group.coordinationScore;
        walletGroupCounts.set(member, existing);
      }
    }

    const mostConnectedWallets = [...walletGroupCounts.entries()]
      .map(([address, data]) => ({
        address,
        groupCount: data.count,
        avgSimilarity: data.count > 0 ? data.totalSim / data.count : 0,
      }))
      .sort((a, b) => b.groupCount - a.groupCount)
      .slice(0, 10);

    let totalTrades = 0;
    for (const trades of this.tradesByWallet.values()) {
      totalTrades += trades.length;
    }

    return {
      totalWallets: this.tradesByWallet.size,
      totalTrades,
      detectedGroups: this.detectedGroups.length,
      groupsByRisk,
      groupsByPattern,
      coordinatedWalletCount: coordinatedWallets.size,
      highRiskGroups: this.getHighRiskGroups(),
      mostConnectedWallets,
      cacheStats: {
        size: this.analysisCache.size + this.pairCache.size,
        hits: this.cacheHits,
        misses: this.cacheMisses,
      },
      lastAnalysisAt: this.lastAnalysisAt,
    };
  }
}

// ============================================================================
// Factory and Shared Instance
// ============================================================================

/**
 * Create a new CoordinatedTradingDetector
 */
export function createCoordinatedTradingDetector(
  config?: CoordinatedTradingDetectorConfig
): CoordinatedTradingDetector {
  return new CoordinatedTradingDetector(config);
}

/** Shared detector instance */
let sharedDetector: CoordinatedTradingDetector | null = null;

/**
 * Get shared detector instance
 */
export function getSharedCoordinatedTradingDetector(): CoordinatedTradingDetector {
  if (!sharedDetector) {
    sharedDetector = createCoordinatedTradingDetector();
  }
  return sharedDetector;
}

/**
 * Set shared detector instance
 */
export function setSharedCoordinatedTradingDetector(
  detector: CoordinatedTradingDetector
): void {
  sharedDetector = detector;
}

/**
 * Reset shared detector instance
 */
export function resetSharedCoordinatedTradingDetector(): void {
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add trades to shared detector
 */
export function addTradesForCoordination(trades: CoordinatedTrade[]): void {
  getSharedCoordinatedTradingDetector().addTrades(trades);
}

/**
 * Analyze a wallet for coordination
 */
export function analyzeWalletCoordination(
  walletAddress: string,
  options?: AnalyzeCoordinationOptions
): CoordinationAnalysisResult {
  return getSharedCoordinatedTradingDetector().analyze(walletAddress, options);
}

/**
 * Batch analyze wallets for coordination
 */
export function batchAnalyzeCoordination(
  walletAddresses: string[],
  options?: AnalyzeCoordinationOptions
): BatchCoordinationResult {
  return getSharedCoordinatedTradingDetector().batchAnalyze(walletAddresses, options);
}

/**
 * Check if wallet is coordinated
 */
export function isWalletCoordinated(walletAddress: string): boolean {
  return getSharedCoordinatedTradingDetector().isCoordinated(walletAddress);
}

/**
 * Get all detected coordinated groups
 */
export function getDetectedCoordinatedGroups(): CoordinatedGroup[] {
  return getSharedCoordinatedTradingDetector().getDetectedGroups();
}

/**
 * Get high risk coordinated groups
 */
export function getHighRiskCoordinatedGroups(): CoordinatedGroup[] {
  return getSharedCoordinatedTradingDetector().getHighRiskGroups();
}

/**
 * Get coordination summary
 */
export function getCoordinatedTradingSummary(): CoordinatedTradingSummary {
  return getSharedCoordinatedTradingDetector().getSummary();
}

// ============================================================================
// Description Functions
// ============================================================================

/**
 * Get human-readable description for coordination pattern
 */
export function getCoordinationPatternDescription(
  pattern: CoordinationPatternType
): string {
  const descriptions: Record<CoordinationPatternType, string> = {
    [CoordinationPatternType.UNKNOWN]: "Unknown coordination pattern",
    [CoordinationPatternType.SIMULTANEOUS]:
      "Wallets trading same markets at the same time",
    [CoordinationPatternType.MIRROR_TRADING]:
      "Wallets making identical trade decisions",
    [CoordinationPatternType.COUNTER_PARTY]:
      "Wallets trading opposite sides (potential wash trading)",
    [CoordinationPatternType.ORDER_SPLITTING]:
      "Large order split across multiple wallets",
    [CoordinationPatternType.COPY_TRADING]: "Wallets copying trades with delay",
    [CoordinationPatternType.RELAY_TRADING]:
      "Wallets alternating to maintain positions",
    [CoordinationPatternType.FUNDING_LINKED]:
      "Wallets sharing common funding sources",
    [CoordinationPatternType.PROFIT_EXTRACTION]:
      "Coordinated profit extraction pattern",
    [CoordinationPatternType.MULTI_PATTERN]:
      "Multiple coordination patterns detected",
  };
  return descriptions[pattern];
}

/**
 * Get human-readable description for risk level
 */
export function getCoordinationRiskDescription(
  riskLevel: CoordinationRiskLevel
): string {
  const descriptions: Record<CoordinationRiskLevel, string> = {
    [CoordinationRiskLevel.NONE]: "No significant coordination risk",
    [CoordinationRiskLevel.LOW]: "Low risk - may be coincidental",
    [CoordinationRiskLevel.MEDIUM]: "Medium risk - warrants monitoring",
    [CoordinationRiskLevel.HIGH]: "High risk - likely coordinated activity",
    [CoordinationRiskLevel.CRITICAL]:
      "Critical - strong manipulation indicators",
  };
  return descriptions[riskLevel];
}

/**
 * Get human-readable description for confidence level
 */
export function getCoordinationConfidenceDescription(
  confidence: CoordinationConfidence
): string {
  const descriptions: Record<CoordinationConfidence, string> = {
    [CoordinationConfidence.VERY_LOW]: "Very low confidence - minimal data",
    [CoordinationConfidence.LOW]: "Low confidence",
    [CoordinationConfidence.MEDIUM]: "Medium confidence",
    [CoordinationConfidence.HIGH]: "High confidence",
    [CoordinationConfidence.VERY_HIGH]:
      "Very high confidence - strong evidence",
  };
  return descriptions[confidence];
}

/**
 * Get human-readable description for coordination flag
 */
export function getCoordinationFlagDescription(flag: CoordinationFlag): string {
  const descriptions: Record<CoordinationFlag, string> = {
    [CoordinationFlag.TIMING_CORRELATION]:
      "Trades occur at similar times",
    [CoordinationFlag.SIZE_SIMILARITY]: "Similar trade sizes",
    [CoordinationFlag.MARKET_OVERLAP]: "Trading same markets",
    [CoordinationFlag.DIRECTION_ALIGNMENT]:
      "Consistently same direction trades",
    [CoordinationFlag.OPPOSITE_DIRECTIONS]:
      "Opposite direction trades (wash trading indicator)",
    [CoordinationFlag.SHARED_FUNDING]: "Shared funding sources",
    [CoordinationFlag.WIN_RATE_SIMILARITY]: "Similar win rates",
    [CoordinationFlag.AGE_CORRELATION]: "Wallets created around same time",
    [CoordinationFlag.SEQUENTIAL_TIMING]: "Sequential trade timing",
    [CoordinationFlag.FRESH_WALLET_GROUP]: "Group of fresh wallets",
    [CoordinationFlag.BOT_INDICATORS]: "Bot-like precision",
    [CoordinationFlag.OFF_HOURS_TRADING]: "Trading during unusual hours",
  };
  return descriptions[flag];
}
