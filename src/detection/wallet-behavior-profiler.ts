/**
 * Wallet Behavior Profiler (DET-PAT-001)
 *
 * Build behavioral profiles for tracked wallets by analyzing their trading
 * patterns, timing, market preferences, and other behavioral characteristics.
 *
 * Features:
 * - Define comprehensive profile attributes
 * - Collect behavioral data from trade history
 * - Build profiles over time with incremental updates
 * - Update profiles with new activity
 * - Provide profile summaries and scoring
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Trading frequency classification
 */
export enum TradingFrequency {
  /** Rarely trades (< 1 trade per month) */
  RARE = "RARE",
  /** Occasional trader (1-5 trades per month) */
  OCCASIONAL = "OCCASIONAL",
  /** Regular trader (5-20 trades per month) */
  REGULAR = "REGULAR",
  /** Frequent trader (20-100 trades per month) */
  FREQUENT = "FREQUENT",
  /** Very frequent (100+ trades per month) */
  VERY_FREQUENT = "VERY_FREQUENT",
}

/**
 * Trading style classification
 */
export enum TradingStyle {
  /** Unknown trading style */
  UNKNOWN = "UNKNOWN",
  /** Scalper - quick in-and-out trades */
  SCALPER = "SCALPER",
  /** Day trader - opens and closes within the day */
  DAY_TRADER = "DAY_TRADER",
  /** Swing trader - holds positions for days/weeks */
  SWING_TRADER = "SWING_TRADER",
  /** Position trader - holds long-term positions */
  POSITION_TRADER = "POSITION_TRADER",
  /** Market maker - provides liquidity */
  MARKET_MAKER = "MARKET_MAKER",
  /** Event trader - trades around specific events */
  EVENT_TRADER = "EVENT_TRADER",
  /** Insider - potentially suspicious pattern */
  POTENTIAL_INSIDER = "POTENTIAL_INSIDER",
}

/**
 * Risk appetite classification
 */
export enum RiskAppetite {
  /** Very conservative trading */
  VERY_CONSERVATIVE = "VERY_CONSERVATIVE",
  /** Conservative trading */
  CONSERVATIVE = "CONSERVATIVE",
  /** Moderate risk */
  MODERATE = "MODERATE",
  /** Aggressive trading */
  AGGRESSIVE = "AGGRESSIVE",
  /** Very aggressive trading */
  VERY_AGGRESSIVE = "VERY_AGGRESSIVE",
}

/**
 * Profile confidence level
 */
export enum ProfileConfidence {
  /** Very low confidence (< 5 trades) */
  VERY_LOW = "VERY_LOW",
  /** Low confidence (5-20 trades) */
  LOW = "LOW",
  /** Moderate confidence (20-50 trades) */
  MODERATE = "MODERATE",
  /** High confidence (50-200 trades) */
  HIGH = "HIGH",
  /** Very high confidence (200+ trades) */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Behavioral flag types
 */
export enum BehaviorFlag {
  /** Unusual trading hours */
  UNUSUAL_HOURS = "UNUSUAL_HOURS",
  /** Concentrated in specific markets */
  MARKET_CONCENTRATION = "MARKET_CONCENTRATION",
  /** High win rate */
  HIGH_WIN_RATE = "HIGH_WIN_RATE",
  /** Perfect timing on event outcomes */
  PERFECT_TIMING = "PERFECT_TIMING",
  /** Coordinated with other wallets */
  COORDINATED_ACTIVITY = "COORDINATED_ACTIVITY",
  /** Unusual position sizing */
  UNUSUAL_SIZING = "UNUSUAL_SIZING",
  /** Fresh wallet with large trades */
  FRESH_WALLET_ACTIVITY = "FRESH_WALLET_ACTIVITY",
  /** Trades before major news */
  PRE_NEWS_TRADING = "PRE_NEWS_TRADING",
  /** Consistent profitability */
  CONSISTENT_PROFITABILITY = "CONSISTENT_PROFITABILITY",
  /** Abnormal trade frequency */
  ABNORMAL_FREQUENCY = "ABNORMAL_FREQUENCY",
}

/**
 * Trade data for profile building
 */
export interface ProfileTrade {
  /** Unique trade ID */
  tradeId: string;

  /** Market ID */
  marketId: string;

  /** Market category (if known) */
  marketCategory?: MarketCategory | string;

  /** Trade side (buy/sell) */
  side: "buy" | "sell";

  /** Trade size in USD */
  sizeUsd: number;

  /** Execution price (0-1) */
  price: number;

  /** Trade timestamp */
  timestamp: Date;

  /** Whether this was a winning trade (null if unresolved) */
  isWinner?: boolean | null;

  /** Profit/loss in USD (null if unresolved) */
  pnl?: number | null;

  /** Whether the wallet was maker or taker */
  isMaker?: boolean;

  /** Flags associated with this trade */
  flags?: string[];
}

/**
 * Time distribution metrics
 */
export interface TimeDistribution {
  /** Hour of day distribution (0-23) */
  hourOfDay: { [hour: number]: number };

  /** Day of week distribution (0-6, Sunday = 0) */
  dayOfWeek: { [day: number]: number };

  /** Percentage of trades during market hours (9am-5pm EST) */
  marketHoursPercentage: number;

  /** Percentage of trades during off-hours */
  offHoursPercentage: number;

  /** Most active hour */
  peakHour: number;

  /** Most active day */
  peakDay: number;
}

/**
 * Market preference metrics
 */
export interface MarketPreferences {
  /** Category distribution by trade count */
  categoryDistribution: { [category: string]: number };

  /** Category distribution by volume */
  categoryVolumeDistribution: { [category: string]: number };

  /** Top categories by trade count */
  topCategories: string[];

  /** Concentration score (0-1, 1 = all in one category) */
  concentrationScore: number;

  /** Number of unique markets traded */
  uniqueMarketsCount: number;

  /** Average trades per market */
  avgTradesPerMarket: number;
}

/**
 * Position sizing metrics
 */
export interface PositionSizing {
  /** Average trade size in USD */
  avgTradeSize: number;

  /** Median trade size in USD */
  medianTradeSize: number;

  /** Standard deviation of trade sizes */
  tradeSizeStdDev: number;

  /** Minimum trade size */
  minTradeSize: number;

  /** Maximum trade size */
  maxTradeSize: number;

  /** Percentage of trades above $1000 */
  largeTradePercentage: number;

  /** Percentage of trades above $10000 */
  whaleTradePercentage: number;

  /** Position sizing consistency (0-1, 1 = very consistent) */
  consistencyScore: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total trades with resolved outcomes */
  resolvedTradeCount: number;

  /** Number of winning trades */
  winCount: number;

  /** Number of losing trades */
  lossCount: number;

  /** Win rate (0-1) */
  winRate: number;

  /** Total profit/loss in USD */
  totalPnl: number;

  /** Average profit per winning trade */
  avgWinPnl: number;

  /** Average loss per losing trade */
  avgLossPnl: number;

  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;

  /** Sharpe-like ratio for trades */
  returnConsistency: number;

  /** Maximum drawdown in USD */
  maxDrawdown: number;

  /** Best single trade PnL */
  bestTrade: number;

  /** Worst single trade PnL */
  worstTrade: number;
}

/**
 * Trading pattern metrics
 */
export interface TradingPatterns {
  /** Average time between trades in hours */
  avgTimeBetweenTrades: number;

  /** Median time between trades in hours */
  medianTimeBetweenTrades: number;

  /** Average holding period for positions in hours */
  avgHoldingPeriod: number;

  /** Percentage of buy vs sell trades */
  buyPercentage: number;

  /** Percentage of maker vs taker trades */
  makerPercentage: number;

  /** Trade clustering score (0-1, 1 = very clustered) */
  clusteringScore: number;

  /** Streak detection (max consecutive wins/losses) */
  maxWinStreak: number;
  maxLossStreak: number;

  /** Position reversal rate (how often they reverse positions) */
  reversalRate: number;
}

/**
 * Complete wallet behavior profile
 */
export interface WalletBehaviorProfile {
  /** Wallet address (checksummed) */
  address: string;

  /** Profile creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Last activity timestamp */
  lastActivityAt: Date | null;

  /** Profile version (for migrations) */
  version: number;

  /** Profile confidence level */
  confidence: ProfileConfidence;

  /** Number of trades analyzed */
  tradeCount: number;

  /** Total volume traded in USD */
  totalVolume: number;

  /** Time distribution metrics */
  timeDistribution: TimeDistribution;

  /** Market preference metrics */
  marketPreferences: MarketPreferences;

  /** Position sizing metrics */
  positionSizing: PositionSizing;

  /** Performance metrics */
  performance: PerformanceMetrics;

  /** Trading pattern metrics */
  tradingPatterns: TradingPatterns;

  /** Classified trading frequency */
  tradingFrequency: TradingFrequency;

  /** Classified trading style */
  tradingStyle: TradingStyle;

  /** Classified risk appetite */
  riskAppetite: RiskAppetite;

  /** Behavioral flags detected */
  behaviorFlags: BehaviorFlag[];

  /** Suspicion score (0-100) */
  suspicionScore: number;

  /** Key profile insights */
  insights: string[];

  /** Raw trade IDs included in profile */
  tradeIds: string[];
}

/**
 * Options for building a profile
 */
export interface BuildProfileOptions {
  /** Trades to analyze */
  trades: ProfileTrade[];

  /** Whether to include trade IDs in profile */
  includeTradeIds?: boolean;

  /** Minimum trades required for profile */
  minTrades?: number;

  /** Maximum age of trades to consider (in days) */
  maxTradeAgeDays?: number;
}

/**
 * Options for updating a profile
 */
export interface UpdateProfileOptions {
  /** New trades to add */
  newTrades: ProfileTrade[];

  /** Whether to rebuild from scratch */
  fullRebuild?: boolean;
}

/**
 * Batch profile result
 */
export interface BatchProfileResult {
  /** Wallet address */
  address: string;

  /** Profile (if successfully built) */
  profile: WalletBehaviorProfile | null;

  /** Error (if failed) */
  error?: string;

  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Profile summary statistics
 */
export interface ProfileSummary {
  /** Total profiles tracked */
  totalProfiles: number;

  /** Profiles by confidence level */
  byConfidence: { [level: string]: number };

  /** Profiles by trading style */
  byTradingStyle: { [style: string]: number };

  /** Profiles by risk appetite */
  byRiskAppetite: { [appetite: string]: number };

  /** Average suspicion score */
  avgSuspicionScore: number;

  /** Profiles with high suspicion (>70) */
  highSuspicionCount: number;

  /** Most common behavior flags */
  topBehaviorFlags: { flag: BehaviorFlag; count: number }[];

  /** Total trades analyzed */
  totalTradesAnalyzed: number;

  /** Total volume analyzed */
  totalVolumeAnalyzed: number;
}

/**
 * Configuration for the wallet behavior profiler
 */
export interface WalletBehaviorProfilerConfig {
  /** Minimum trades to create profile */
  minTradesForProfile?: number;

  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;

  /** Maximum profiles to cache */
  maxCachedProfiles?: number;

  /** Thresholds for frequency classification */
  frequencyThresholds?: {
    rare: number;
    occasional: number;
    regular: number;
    frequent: number;
  };

  /** Thresholds for suspicion scoring */
  suspicionThresholds?: {
    highWinRate: number;
    unusualHours: number;
    highConcentration: number;
    largeFirstTrade: number;
  };

  /** Large trade threshold in USD */
  largeTradeThreshold?: number;

  /** Whale trade threshold in USD */
  whaleTradeThreshold?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_PROFILER_CONFIG: Required<WalletBehaviorProfilerConfig> = {
  minTradesForProfile: 3,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCachedProfiles: 1000,
  frequencyThresholds: {
    rare: 1,
    occasional: 5,
    regular: 20,
    frequent: 100,
  },
  suspicionThresholds: {
    highWinRate: 0.8,
    unusualHours: 0.4,
    highConcentration: 0.8,
    largeFirstTrade: 10000,
  },
  largeTradeThreshold: 1000,
  whaleTradeThreshold: 10000,
};

/**
 * Market hours (9am-5pm EST/UTC-5)
 */
const MARKET_HOURS_START = 14; // 9am EST in UTC
const MARKET_HOURS_END = 22; // 5pm EST in UTC

/**
 * Current profile version
 */
const PROFILE_VERSION = 1;

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
  const avgSquaredDiff =
    squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
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
 * Calculate concentration score (Herfindahl-Hirschman Index normalized)
 */
function calculateConcentration(distribution: { [key: string]: number }): number {
  const values = Object.values(distribution);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const shares = values.map((v) => v / total);
  const hhi = shares.reduce((sum, s) => sum + Math.pow(s, 2), 0);

  // Normalize: 1/n (perfect distribution) to 1 (all in one)
  const n = values.length;
  if (n <= 1) return 1;

  const minHHI = 1 / n;
  return (hhi - minHHI) / (1 - minHHI);
}

/**
 * Classify trading frequency
 */
function classifyTradingFrequency(
  tradeCount: number,
  daysActive: number,
  thresholds: Required<WalletBehaviorProfilerConfig>["frequencyThresholds"]
): TradingFrequency {
  const tradesPerMonth = daysActive > 0 ? (tradeCount / daysActive) * 30 : 0;

  if (tradesPerMonth < thresholds.rare) return TradingFrequency.RARE;
  if (tradesPerMonth < thresholds.occasional) return TradingFrequency.OCCASIONAL;
  if (tradesPerMonth < thresholds.regular) return TradingFrequency.REGULAR;
  if (tradesPerMonth < thresholds.frequent) return TradingFrequency.FREQUENT;
  return TradingFrequency.VERY_FREQUENT;
}

/**
 * Classify trading style based on patterns
 */
function classifyTradingStyle(
  patterns: TradingPatterns,
  _performance: PerformanceMetrics,
  preferences: MarketPreferences,
  flags: BehaviorFlag[]
): TradingStyle {
  // Check for potential insider pattern
  if (
    flags.includes(BehaviorFlag.PERFECT_TIMING) ||
    (flags.includes(BehaviorFlag.HIGH_WIN_RATE) &&
      flags.includes(BehaviorFlag.PRE_NEWS_TRADING))
  ) {
    return TradingStyle.POTENTIAL_INSIDER;
  }

  // Market maker - high maker percentage, frequent trades
  if (patterns.makerPercentage > 0.7 && patterns.avgTimeBetweenTrades < 1) {
    return TradingStyle.MARKET_MAKER;
  }

  // Scalper - very short holding period, frequent trades
  if (patterns.avgHoldingPeriod < 1 && patterns.avgTimeBetweenTrades < 2) {
    return TradingStyle.SCALPER;
  }

  // Day trader - closes within day
  if (patterns.avgHoldingPeriod < 24) {
    return TradingStyle.DAY_TRADER;
  }

  // Event trader - high concentration in specific categories
  if (preferences.concentrationScore > 0.7) {
    return TradingStyle.EVENT_TRADER;
  }

  // Swing trader - holds for days
  if (patterns.avgHoldingPeriod >= 24 && patterns.avgHoldingPeriod < 168) {
    return TradingStyle.SWING_TRADER;
  }

  // Position trader - holds for weeks
  if (patterns.avgHoldingPeriod >= 168) {
    return TradingStyle.POSITION_TRADER;
  }

  return TradingStyle.UNKNOWN;
}

/**
 * Classify risk appetite
 */
function classifyRiskAppetite(
  sizing: PositionSizing,
  _performance: PerformanceMetrics
): RiskAppetite {
  // Use coefficient of variation and trade sizes
  const cv = sizing.avgTradeSize > 0 ? sizing.tradeSizeStdDev / sizing.avgTradeSize : 0;

  // High whale trade percentage = aggressive
  if (sizing.whaleTradePercentage > 0.3) {
    return RiskAppetite.VERY_AGGRESSIVE;
  }

  if (sizing.largeTradePercentage > 0.5) {
    return RiskAppetite.AGGRESSIVE;
  }

  // Very consistent sizing with low volume = conservative
  if (cv < 0.3 && sizing.avgTradeSize < 500) {
    return RiskAppetite.VERY_CONSERVATIVE;
  }

  if (cv < 0.5 && sizing.avgTradeSize < 1000) {
    return RiskAppetite.CONSERVATIVE;
  }

  return RiskAppetite.MODERATE;
}

/**
 * Determine profile confidence level
 */
function getProfileConfidence(tradeCount: number): ProfileConfidence {
  if (tradeCount < 5) return ProfileConfidence.VERY_LOW;
  if (tradeCount < 20) return ProfileConfidence.LOW;
  if (tradeCount < 50) return ProfileConfidence.MODERATE;
  if (tradeCount < 200) return ProfileConfidence.HIGH;
  return ProfileConfidence.VERY_HIGH;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Wallet Behavior Profiler
 *
 * Analyzes wallet trading patterns to build comprehensive behavioral profiles.
 */
export class WalletBehaviorProfiler extends EventEmitter {
  private config: Required<WalletBehaviorProfilerConfig>;
  private profileCache: Map<
    string,
    { profile: WalletBehaviorProfile; timestamp: number }
  > = new Map();
  private tradeCache: Map<string, ProfileTrade[]> = new Map();

  constructor(config: WalletBehaviorProfilerConfig = {}) {
    super();
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
  }

  /**
   * Build a behavioral profile from trades
   */
  buildProfile(
    address: string,
    options: BuildProfileOptions
  ): WalletBehaviorProfile | null {
    // Validate address
    if (!isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const checksumAddress = getAddress(address);
    const { trades, includeTradeIds = false, minTrades = this.config.minTradesForProfile } = options;

    // Filter and validate trades
    const validTrades = trades.filter((t) => t.sizeUsd > 0 && t.timestamp);

    if (validTrades.length < minTrades) {
      return null;
    }

    // Sort trades by timestamp
    validTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const now = new Date();

    // Build time distribution
    const timeDistribution = this.buildTimeDistribution(validTrades);

    // Build market preferences
    const marketPreferences = this.buildMarketPreferences(validTrades);

    // Build position sizing metrics
    const positionSizing = this.buildPositionSizing(validTrades);

    // Build performance metrics
    const performance = this.buildPerformanceMetrics(validTrades);

    // Build trading patterns
    const tradingPatterns = this.buildTradingPatterns(validTrades);

    // Calculate days active
    const firstTrade = validTrades[0]!.timestamp;
    const lastTrade = validTrades[validTrades.length - 1]!.timestamp;
    const daysActive = Math.max(
      1,
      (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Classify trading frequency
    const tradingFrequency = classifyTradingFrequency(
      validTrades.length,
      daysActive,
      this.config.frequencyThresholds
    );

    // Detect behavior flags
    const behaviorFlags = this.detectBehaviorFlags(
      validTrades,
      timeDistribution,
      marketPreferences,
      positionSizing,
      performance
    );

    // Classify trading style
    const tradingStyle = classifyTradingStyle(
      tradingPatterns,
      performance,
      marketPreferences,
      behaviorFlags
    );

    // Classify risk appetite
    const riskAppetite = classifyRiskAppetite(positionSizing, performance);

    // Calculate suspicion score
    const suspicionScore = this.calculateSuspicionScore(
      behaviorFlags,
      performance,
      marketPreferences,
      timeDistribution,
      validTrades
    );

    // Generate insights
    const insights = this.generateInsights(
      tradingStyle,
      tradingFrequency,
      performance,
      marketPreferences,
      behaviorFlags
    );

    // Calculate total volume
    const totalVolume = validTrades.reduce((sum, t) => sum + t.sizeUsd, 0);

    const profile: WalletBehaviorProfile = {
      address: checksumAddress,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: lastTrade,
      version: PROFILE_VERSION,
      confidence: getProfileConfidence(validTrades.length),
      tradeCount: validTrades.length,
      totalVolume,
      timeDistribution,
      marketPreferences,
      positionSizing,
      performance,
      tradingPatterns,
      tradingFrequency,
      tradingStyle,
      riskAppetite,
      behaviorFlags,
      suspicionScore,
      insights,
      tradeIds: includeTradeIds ? validTrades.map((t) => t.tradeId) : [],
    };

    // Cache the profile
    this.cacheProfile(checksumAddress, profile);

    // Store trades for incremental updates
    this.tradeCache.set(checksumAddress, validTrades);

    // Emit event
    this.emit("profileBuilt", profile);

    if (suspicionScore >= 70) {
      this.emit("highSuspicion", profile);
    }

    return profile;
  }

  /**
   * Update an existing profile with new trades
   */
  updateProfile(
    address: string,
    options: UpdateProfileOptions
  ): WalletBehaviorProfile | null {
    if (!isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const checksumAddress = getAddress(address);
    const { newTrades, fullRebuild = false } = options;

    // Get existing trades
    const existingTrades = this.tradeCache.get(checksumAddress) || [];

    if (fullRebuild || existingTrades.length === 0) {
      // Rebuild from scratch with all trades
      return this.buildProfile(checksumAddress, {
        trades: [...existingTrades, ...newTrades],
        includeTradeIds: true,
      });
    }

    // Merge trades, avoiding duplicates
    const existingIds = new Set(existingTrades.map((t) => t.tradeId));
    const uniqueNewTrades = newTrades.filter((t) => !existingIds.has(t.tradeId));

    if (uniqueNewTrades.length === 0) {
      // No new trades, return cached profile
      const cached = this.profileCache.get(checksumAddress);
      return cached?.profile || null;
    }

    // Rebuild with merged trades
    const allTrades = [...existingTrades, ...uniqueNewTrades];
    const profile = this.buildProfile(checksumAddress, {
      trades: allTrades,
      includeTradeIds: true,
    });

    if (profile) {
      this.emit("profileUpdated", profile, uniqueNewTrades.length);
    }

    return profile;
  }

  /**
   * Get a cached profile
   */
  getProfile(address: string): WalletBehaviorProfile | null {
    if (!isAddress(address)) {
      return null;
    }

    const checksumAddress = getAddress(address);
    const cached = this.profileCache.get(checksumAddress);

    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.cacheTtlMs) {
      this.profileCache.delete(checksumAddress);
      return null;
    }

    return cached.profile;
  }

  /**
   * Build profiles for multiple wallets
   */
  buildProfiles(
    walletTrades: Map<string, ProfileTrade[]>
  ): BatchProfileResult[] {
    const results: BatchProfileResult[] = [];

    for (const [address, trades] of walletTrades) {
      const startTime = Date.now();

      try {
        const profile = this.buildProfile(address, { trades, includeTradeIds: true });
        results.push({
          address,
          profile,
          processingTimeMs: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          address,
          profile: null,
          error: error instanceof Error ? error.message : "Unknown error",
          processingTimeMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Check if a wallet has a cached profile
   */
  hasProfile(address: string): boolean {
    if (!isAddress(address)) return false;
    return this.profileCache.has(getAddress(address));
  }

  /**
   * Get all cached profiles
   */
  getAllProfiles(): WalletBehaviorProfile[] {
    const profiles: WalletBehaviorProfile[] = [];
    const now = Date.now();

    for (const [, cached] of this.profileCache) {
      if (now - cached.timestamp <= this.config.cacheTtlMs) {
        profiles.push(cached.profile);
      }
    }

    return profiles;
  }

  /**
   * Get profiles by trading style
   */
  getProfilesByStyle(style: TradingStyle): WalletBehaviorProfile[] {
    return this.getAllProfiles().filter((p) => p.tradingStyle === style);
  }

  /**
   * Get profiles by behavior flag
   */
  getProfilesByFlag(flag: BehaviorFlag): WalletBehaviorProfile[] {
    return this.getAllProfiles().filter((p) => p.behaviorFlags.includes(flag));
  }

  /**
   * Get high suspicion profiles
   */
  getHighSuspicionProfiles(threshold: number = 70): WalletBehaviorProfile[] {
    return this.getAllProfiles().filter((p) => p.suspicionScore >= threshold);
  }

  /**
   * Get summary statistics
   */
  getSummary(): ProfileSummary {
    const profiles = this.getAllProfiles();

    const byConfidence: { [level: string]: number } = {};
    const byTradingStyle: { [style: string]: number } = {};
    const byRiskAppetite: { [appetite: string]: number } = {};
    const flagCounts: Map<BehaviorFlag, number> = new Map();

    let totalSuspicion = 0;
    let highSuspicionCount = 0;
    let totalTrades = 0;
    let totalVolume = 0;

    for (const profile of profiles) {
      // Count by confidence
      byConfidence[profile.confidence] =
        (byConfidence[profile.confidence] || 0) + 1;

      // Count by trading style
      byTradingStyle[profile.tradingStyle] =
        (byTradingStyle[profile.tradingStyle] || 0) + 1;

      // Count by risk appetite
      byRiskAppetite[profile.riskAppetite] =
        (byRiskAppetite[profile.riskAppetite] || 0) + 1;

      // Sum suspicion
      totalSuspicion += profile.suspicionScore;
      if (profile.suspicionScore >= 70) highSuspicionCount++;

      // Count flags
      for (const flag of profile.behaviorFlags) {
        flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
      }

      // Sum trades and volume
      totalTrades += profile.tradeCount;
      totalVolume += profile.totalVolume;
    }

    // Sort flags by count
    const topBehaviorFlags = Array.from(flagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flag, count]) => ({ flag, count }));

    return {
      totalProfiles: profiles.length,
      byConfidence,
      byTradingStyle,
      byRiskAppetite,
      avgSuspicionScore:
        profiles.length > 0 ? totalSuspicion / profiles.length : 0,
      highSuspicionCount,
      topBehaviorFlags,
      totalTradesAnalyzed: totalTrades,
      totalVolumeAnalyzed: totalVolume,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.profileCache.clear();
    this.tradeCache.clear();
  }

  /**
   * Remove a profile from cache
   */
  removeProfile(address: string): boolean {
    if (!isAddress(address)) return false;
    const checksumAddress = getAddress(address);
    this.tradeCache.delete(checksumAddress);
    return this.profileCache.delete(checksumAddress);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private cacheProfile(
    address: string,
    profile: WalletBehaviorProfile
  ): void {
    // Enforce cache size limit
    if (this.profileCache.size >= this.config.maxCachedProfiles) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, cached] of this.profileCache) {
        if (cached.timestamp < oldestTime) {
          oldestTime = cached.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.profileCache.delete(oldestKey);
        this.tradeCache.delete(oldestKey);
      }
    }

    this.profileCache.set(address, {
      profile,
      timestamp: Date.now(),
    });
  }

  private buildTimeDistribution(trades: ProfileTrade[]): TimeDistribution {
    const hourOfDay: { [hour: number]: number } = {};
    const dayOfWeek: { [day: number]: number } = {};
    let marketHoursCount = 0;

    for (let i = 0; i < 24; i++) hourOfDay[i] = 0;
    for (let i = 0; i < 7; i++) dayOfWeek[i] = 0;

    for (const trade of trades) {
      const date = trade.timestamp;
      const hour = date.getUTCHours();
      const day = date.getUTCDay();

      hourOfDay[hour] = (hourOfDay[hour] ?? 0) + 1;
      dayOfWeek[day] = (dayOfWeek[day] ?? 0) + 1;

      if (isMarketHours(hour)) {
        marketHoursCount++;
      }
    }

    // Find peaks
    let peakHour = 0;
    let maxHourCount = 0;
    for (const [hour, count] of Object.entries(hourOfDay)) {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = parseInt(hour);
      }
    }

    let peakDay = 0;
    let maxDayCount = 0;
    for (const [day, count] of Object.entries(dayOfWeek)) {
      if (count > maxDayCount) {
        maxDayCount = count;
        peakDay = parseInt(day);
      }
    }

    const totalTrades = trades.length;
    const marketHoursPercentage =
      totalTrades > 0 ? marketHoursCount / totalTrades : 0;

    return {
      hourOfDay,
      dayOfWeek,
      marketHoursPercentage,
      offHoursPercentage: 1 - marketHoursPercentage,
      peakHour,
      peakDay,
    };
  }

  private buildMarketPreferences(trades: ProfileTrade[]): MarketPreferences {
    const categoryDistribution: { [category: string]: number } = {};
    const categoryVolumeDistribution: { [category: string]: number } = {};
    const marketCounts: Map<string, number> = new Map();

    for (const trade of trades) {
      const category = trade.marketCategory || "unknown";

      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      categoryVolumeDistribution[category] =
        (categoryVolumeDistribution[category] || 0) + trade.sizeUsd;

      marketCounts.set(
        trade.marketId,
        (marketCounts.get(trade.marketId) || 0) + 1
      );
    }

    // Top categories by trade count
    const topCategories = Object.entries(categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const uniqueMarketsCount = marketCounts.size;
    const avgTradesPerMarket =
      uniqueMarketsCount > 0 ? trades.length / uniqueMarketsCount : 0;

    return {
      categoryDistribution,
      categoryVolumeDistribution,
      topCategories,
      concentrationScore: calculateConcentration(categoryDistribution),
      uniqueMarketsCount,
      avgTradesPerMarket,
    };
  }

  private buildPositionSizing(trades: ProfileTrade[]): PositionSizing {
    const sizes = trades.map((t) => t.sizeUsd);

    const avgTradeSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const medianTradeSize = calculateMedian(sizes);
    const tradeSizeStdDev = calculateStdDev(sizes);
    const minTradeSize = Math.min(...sizes);
    const maxTradeSize = Math.max(...sizes);

    const largeTradeCount = sizes.filter(
      (s) => s >= this.config.largeTradeThreshold
    ).length;
    const whaleTradeCount = sizes.filter(
      (s) => s >= this.config.whaleTradeThreshold
    ).length;

    // Consistency score based on coefficient of variation (inverse)
    const cv = avgTradeSize > 0 ? tradeSizeStdDev / avgTradeSize : 0;
    const consistencyScore = Math.max(0, 1 - Math.min(cv, 2) / 2);

    return {
      avgTradeSize,
      medianTradeSize,
      tradeSizeStdDev,
      minTradeSize,
      maxTradeSize,
      largeTradePercentage: largeTradeCount / trades.length,
      whaleTradePercentage: whaleTradeCount / trades.length,
      consistencyScore,
    };
  }

  private buildPerformanceMetrics(trades: ProfileTrade[]): PerformanceMetrics {
    const resolvedTrades = trades.filter((t) => t.pnl !== null && t.pnl !== undefined);
    const wins = resolvedTrades.filter((t) => t.pnl! > 0);
    const losses = resolvedTrades.filter((t) => t.pnl! < 0);

    const winPnls = wins.map((t) => t.pnl!);
    const lossPnls = losses.map((t) => Math.abs(t.pnl!));

    const totalPnl = resolvedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossProfit = winPnls.reduce((a, b) => a + b, 0);
    const grossLoss = lossPnls.reduce((a, b) => a + b, 0);

    const avgWinPnl = winPnls.length > 0 ? grossProfit / winPnls.length : 0;
    const avgLossPnl = lossPnls.length > 0 ? grossLoss / lossPnls.length : 0;

    // Calculate running PnL for drawdown
    let runningPnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const trade of resolvedTrades) {
      runningPnl += trade.pnl || 0;
      if (runningPnl > peak) peak = runningPnl;
      const drawdown = peak - runningPnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Return consistency (Sharpe-like)
    const returns = resolvedTrades.map((t) => t.pnl || 0);
    const avgReturn = returns.length > 0 ? totalPnl / returns.length : 0;
    const returnStdDev = calculateStdDev(returns);
    const returnConsistency =
      returnStdDev > 0 ? avgReturn / returnStdDev : avgReturn > 0 ? 1 : 0;

    return {
      resolvedTradeCount: resolvedTrades.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate:
        resolvedTrades.length > 0 ? wins.length / resolvedTrades.length : 0,
      totalPnl,
      avgWinPnl,
      avgLossPnl,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      returnConsistency,
      maxDrawdown,
      bestTrade: winPnls.length > 0 ? Math.max(...winPnls) : 0,
      worstTrade: lossPnls.length > 0 ? -Math.max(...lossPnls) : 0,
    };
  }

  private buildTradingPatterns(trades: ProfileTrade[]): TradingPatterns {
    if (trades.length < 2) {
      const firstTrade = trades[0];
      return {
        avgTimeBetweenTrades: 0,
        medianTimeBetweenTrades: 0,
        avgHoldingPeriod: 0,
        buyPercentage: firstTrade && firstTrade.side === "buy" ? 1 : 0,
        makerPercentage: 0,
        clusteringScore: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        reversalRate: 0,
      };
    }

    // Time between trades
    const timeDiffs: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      const currentTrade = trades[i];
      const prevTrade = trades[i - 1];
      if (currentTrade && prevTrade) {
        const diffMs = currentTrade.timestamp.getTime() - prevTrade.timestamp.getTime();
        timeDiffs.push(diffMs / (1000 * 60 * 60)); // Convert to hours
      }
    }

    const avgTimeBetweenTrades =
      timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const medianTimeBetweenTrades = calculateMedian(timeDiffs);

    // Holding period estimation (average time for positions)
    // This is simplified - would need position tracking for accuracy
    const avgHoldingPeriod = avgTimeBetweenTrades * 2; // Rough estimate

    // Buy/sell ratio
    const buys = trades.filter((t) => t.side === "buy").length;
    const buyPercentage = buys / trades.length;

    // Maker ratio
    const makers = trades.filter((t) => t.isMaker === true).length;
    const makerPercentage = makers / trades.length;

    // Clustering score (inverse of time distribution uniformity)
    const lastTrade = trades[trades.length - 1];
    const firstTrade = trades[0];
    const timeSpread = lastTrade && firstTrade
      ? lastTrade.timestamp.getTime() - firstTrade.timestamp.getTime()
      : 0;
    if (timeSpread > 0) {
      const expectedSpacing = timeSpread / trades.length;
      let deviationSum = 0;
      for (const diff of timeDiffs) {
        deviationSum += Math.abs(diff * 60 * 60 * 1000 - expectedSpacing);
      }
      const avgDeviation = deviationSum / timeDiffs.length;
      // Normalize to 0-1
      const clusteringScore = Math.min(1, avgDeviation / expectedSpacing);

      // Win/loss streaks
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let maxWinStreak = 0;
      let maxLossStreak = 0;

      for (const trade of trades) {
        if (trade.pnl !== null && trade.pnl !== undefined) {
          if (trade.pnl > 0) {
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
          } else if (trade.pnl < 0) {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
          }
        }
      }

      // Reversal rate (how often they switch sides)
      let reversals = 0;
      for (let i = 1; i < trades.length; i++) {
        const currentTrade = trades[i];
        const prevTrade = trades[i - 1];
        if (currentTrade && prevTrade && currentTrade.side !== prevTrade.side) {
          reversals++;
        }
      }
      const reversalRate = reversals / (trades.length - 1);

      return {
        avgTimeBetweenTrades,
        medianTimeBetweenTrades,
        avgHoldingPeriod,
        buyPercentage,
        makerPercentage,
        clusteringScore,
        maxWinStreak,
        maxLossStreak,
        reversalRate,
      };
    }

    return {
      avgTimeBetweenTrades,
      medianTimeBetweenTrades,
      avgHoldingPeriod,
      buyPercentage,
      makerPercentage,
      clusteringScore: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      reversalRate: 0,
    };
  }

  private detectBehaviorFlags(
    trades: ProfileTrade[],
    timeDistribution: TimeDistribution,
    marketPreferences: MarketPreferences,
    positionSizing: PositionSizing,
    performance: PerformanceMetrics
  ): BehaviorFlag[] {
    const flags: BehaviorFlag[] = [];
    const thresholds = this.config.suspicionThresholds;

    // Unusual trading hours
    if (timeDistribution.offHoursPercentage > thresholds.unusualHours) {
      flags.push(BehaviorFlag.UNUSUAL_HOURS);
    }

    // High market concentration
    if (marketPreferences.concentrationScore > thresholds.highConcentration) {
      flags.push(BehaviorFlag.MARKET_CONCENTRATION);
    }

    // High win rate
    if (
      performance.winRate > thresholds.highWinRate &&
      performance.resolvedTradeCount >= 10
    ) {
      flags.push(BehaviorFlag.HIGH_WIN_RATE);
    }

    // Consistent profitability
    if (performance.profitFactor > 3 && performance.resolvedTradeCount >= 10) {
      flags.push(BehaviorFlag.CONSISTENT_PROFITABILITY);
    }

    // Unusual position sizing
    if (positionSizing.tradeSizeStdDev > positionSizing.avgTradeSize * 2) {
      flags.push(BehaviorFlag.UNUSUAL_SIZING);
    }

    // Fresh wallet with large first trade
    const firstTrade = trades[0];
    if (
      trades.length >= 1 &&
      firstTrade &&
      firstTrade.sizeUsd >= thresholds.largeFirstTrade
    ) {
      flags.push(BehaviorFlag.FRESH_WALLET_ACTIVITY);
    }

    // Perfect timing detection (very high win rate on large trades)
    const largeTrades = trades.filter(
      (t) => t.sizeUsd >= this.config.largeTradeThreshold && t.pnl !== null
    );
    if (largeTrades.length >= 5) {
      const largeWins = largeTrades.filter((t) => t.pnl! > 0).length;
      if (largeWins / largeTrades.length > 0.9) {
        flags.push(BehaviorFlag.PERFECT_TIMING);
      }
    }

    // Pre-news trading (trades with "pre_event" flag)
    const preEventTrades = trades.filter(
      (t) => t.flags?.includes("pre_event")
    );
    if (preEventTrades.length >= 3) {
      flags.push(BehaviorFlag.PRE_NEWS_TRADING);
    }

    // Coordinated activity (trades with "coordinated" flag)
    const coordinatedTrades = trades.filter(
      (t) => t.flags?.includes("coordinated")
    );
    if (coordinatedTrades.length >= 3) {
      flags.push(BehaviorFlag.COORDINATED_ACTIVITY);
    }

    return flags;
  }

  private calculateSuspicionScore(
    flags: BehaviorFlag[],
    performance: PerformanceMetrics,
    _preferences: MarketPreferences,
    _timeDistribution: TimeDistribution,
    trades: ProfileTrade[]
  ): number {
    let score = 0;

    // Base score from flags
    const flagScores: { [key in BehaviorFlag]: number } = {
      [BehaviorFlag.UNUSUAL_HOURS]: 10,
      [BehaviorFlag.MARKET_CONCENTRATION]: 10,
      [BehaviorFlag.HIGH_WIN_RATE]: 15,
      [BehaviorFlag.PERFECT_TIMING]: 25,
      [BehaviorFlag.COORDINATED_ACTIVITY]: 20,
      [BehaviorFlag.UNUSUAL_SIZING]: 10,
      [BehaviorFlag.FRESH_WALLET_ACTIVITY]: 15,
      [BehaviorFlag.PRE_NEWS_TRADING]: 20,
      [BehaviorFlag.CONSISTENT_PROFITABILITY]: 15,
      [BehaviorFlag.ABNORMAL_FREQUENCY]: 10,
    };

    for (const flag of flags) {
      score += flagScores[flag] || 5;
    }

    // Bonus for combination of suspicious flags
    if (
      flags.includes(BehaviorFlag.HIGH_WIN_RATE) &&
      flags.includes(BehaviorFlag.FRESH_WALLET_ACTIVITY)
    ) {
      score += 15;
    }

    if (
      flags.includes(BehaviorFlag.PERFECT_TIMING) &&
      flags.includes(BehaviorFlag.PRE_NEWS_TRADING)
    ) {
      score += 20;
    }

    // Scale based on trade count (more trades = more confidence in score)
    const confidenceMultiplier = Math.min(1, trades.length / 20);
    score *= 0.5 + 0.5 * confidenceMultiplier;

    // Add performance-based suspicion
    if (performance.winRate > 0.9 && performance.resolvedTradeCount >= 10) {
      score += 10;
    }

    // Cap at 100
    return Math.min(100, Math.round(score));
  }

  private generateInsights(
    style: TradingStyle,
    frequency: TradingFrequency,
    performance: PerformanceMetrics,
    preferences: MarketPreferences,
    flags: BehaviorFlag[]
  ): string[] {
    const insights: string[] = [];

    // Style insight
    if (style !== TradingStyle.UNKNOWN) {
      insights.push(`Trading style classified as ${style.replace(/_/g, " ").toLowerCase()}`);
    }

    // Frequency insight
    insights.push(`Trading frequency: ${frequency.toLowerCase()} trader`);

    // Performance insights
    if (performance.resolvedTradeCount >= 10) {
      const winRatePct = Math.round(performance.winRate * 100);
      insights.push(`Win rate: ${winRatePct}% (${performance.winCount}/${performance.resolvedTradeCount})`);

      if (performance.profitFactor > 2) {
        insights.push(
          `Strong profit factor of ${performance.profitFactor.toFixed(1)}`
        );
      }
    }

    // Market preference insights
    if (preferences.topCategories.length > 0) {
      insights.push(`Primary market focus: ${preferences.topCategories[0]}`);
    }

    if (preferences.concentrationScore > 0.7) {
      insights.push("Highly concentrated in specific market categories");
    }

    // Flag-based insights
    if (flags.includes(BehaviorFlag.PERFECT_TIMING)) {
      insights.push("⚠️ Suspiciously perfect timing on trades");
    }

    if (flags.includes(BehaviorFlag.HIGH_WIN_RATE)) {
      insights.push("⚠️ Unusually high win rate detected");
    }

    if (flags.includes(BehaviorFlag.COORDINATED_ACTIVITY)) {
      insights.push("⚠️ Potential coordination with other wallets");
    }

    return insights;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new WalletBehaviorProfiler instance
 */
export function createWalletBehaviorProfiler(
  config?: WalletBehaviorProfilerConfig
): WalletBehaviorProfiler {
  return new WalletBehaviorProfiler(config);
}

// Shared instance
let sharedProfiler: WalletBehaviorProfiler | null = null;

/**
 * Get the shared WalletBehaviorProfiler instance
 */
export function getSharedWalletBehaviorProfiler(): WalletBehaviorProfiler {
  if (!sharedProfiler) {
    sharedProfiler = new WalletBehaviorProfiler();
  }
  return sharedProfiler;
}

/**
 * Set the shared WalletBehaviorProfiler instance
 */
export function setSharedWalletBehaviorProfiler(
  profiler: WalletBehaviorProfiler
): void {
  sharedProfiler = profiler;
}

/**
 * Reset the shared WalletBehaviorProfiler instance
 */
export function resetSharedWalletBehaviorProfiler(): void {
  if (sharedProfiler) {
    sharedProfiler.clearCache();
  }
  sharedProfiler = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Build a wallet behavior profile
 */
export function buildWalletBehaviorProfile(
  address: string,
  trades: ProfileTrade[],
  options?: Omit<BuildProfileOptions, "trades">
): WalletBehaviorProfile | null {
  return getSharedWalletBehaviorProfiler().buildProfile(address, {
    ...options,
    trades,
  });
}

/**
 * Update an existing wallet behavior profile
 */
export function updateWalletBehaviorProfile(
  address: string,
  newTrades: ProfileTrade[],
  fullRebuild?: boolean
): WalletBehaviorProfile | null {
  return getSharedWalletBehaviorProfiler().updateProfile(address, {
    newTrades,
    fullRebuild,
  });
}

/**
 * Get a cached wallet behavior profile
 */
export function getWalletBehaviorProfile(
  address: string
): WalletBehaviorProfile | null {
  return getSharedWalletBehaviorProfiler().getProfile(address);
}

/**
 * Build profiles for multiple wallets
 */
export function batchBuildWalletBehaviorProfiles(
  walletTrades: Map<string, ProfileTrade[]>
): BatchProfileResult[] {
  return getSharedWalletBehaviorProfiler().buildProfiles(walletTrades);
}

/**
 * Check if wallet has suspicious behavior profile
 */
export function hasHighSuspicionProfile(
  address: string,
  threshold: number = 70
): boolean {
  const profile = getSharedWalletBehaviorProfiler().getProfile(address);
  return profile !== null && profile.suspicionScore >= threshold;
}

/**
 * Get profiles with potential insider patterns
 */
export function getPotentialInsiderProfiles(): WalletBehaviorProfile[] {
  return getSharedWalletBehaviorProfiler().getProfilesByStyle(
    TradingStyle.POTENTIAL_INSIDER
  );
}

/**
 * Get wallet behavior profiler summary
 */
export function getWalletBehaviorProfilerSummary(): ProfileSummary {
  return getSharedWalletBehaviorProfiler().getSummary();
}
