/**
 * Market Selection Pattern Analyzer (DET-PAT-007)
 *
 * Analyze which markets wallets tend to trade to identify preferences,
 * shifts in behavior, and potential insider patterns.
 *
 * Features:
 * - Track market selection history per wallet
 * - Identify market preferences (category, liquidity, timing)
 * - Detect selection shifts over time
 * - Score selection patterns for suspicion signals
 * - Support batch analysis and caching
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Market selection preference type
 */
export enum SelectionPreferenceType {
  /** No clear preference */
  NONE = "NONE",
  /** Prefers high volume markets */
  HIGH_VOLUME = "HIGH_VOLUME",
  /** Prefers low volume/thin markets */
  LOW_VOLUME = "LOW_VOLUME",
  /** Prefers markets near resolution */
  NEAR_RESOLUTION = "NEAR_RESOLUTION",
  /** Prefers new markets */
  NEW_MARKETS = "NEW_MARKETS",
  /** Prefers volatile markets */
  HIGH_VOLATILITY = "HIGH_VOLATILITY",
  /** Prefers stable markets */
  LOW_VOLATILITY = "LOW_VOLATILITY",
  /** Prefers binary markets */
  BINARY_MARKETS = "BINARY_MARKETS",
  /** Prefers multi-outcome markets */
  MULTI_OUTCOME = "MULTI_OUTCOME",
  /** Prefers category specialist */
  CATEGORY_SPECIALIST = "CATEGORY_SPECIALIST",
  /** Prefers event-driven markets */
  EVENT_DRIVEN = "EVENT_DRIVEN",
}

/**
 * Selection pattern type
 */
export enum SelectionPatternType {
  /** Unknown - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Diverse - trades many different markets */
  DIVERSE = "DIVERSE",
  /** Focused - concentrated on few markets */
  FOCUSED = "FOCUSED",
  /** Specialist - focused on specific category */
  SPECIALIST = "SPECIALIST",
  /** Opportunistic - follows trends/news */
  OPPORTUNISTIC = "OPPORTUNISTIC",
  /** Contrarian - goes against popular markets */
  CONTRARIAN = "CONTRARIAN",
  /** Momentum - follows volume patterns */
  MOMENTUM = "MOMENTUM",
  /** Systematic - regular/predictable selection */
  SYSTEMATIC = "SYSTEMATIC",
  /** Random - no clear pattern */
  RANDOM = "RANDOM",
  /** Insider-like - suspiciously good market picks */
  INSIDER_LIKE = "INSIDER_LIKE",
}

/**
 * Selection shift type
 */
export enum SelectionShiftType {
  /** No significant shift */
  NONE = "NONE",
  /** Shift to higher risk markets */
  HIGHER_RISK = "HIGHER_RISK",
  /** Shift to lower risk markets */
  LOWER_RISK = "LOWER_RISK",
  /** Shift to new category */
  CATEGORY_CHANGE = "CATEGORY_CHANGE",
  /** Shift to niche markets */
  NICHE_FOCUS = "NICHE_FOCUS",
  /** Sudden market concentration */
  CONCENTRATION_INCREASE = "CONCENTRATION_INCREASE",
  /** Sudden market diversification */
  CONCENTRATION_DECREASE = "CONCENTRATION_DECREASE",
  /** Shift to winning markets (suspicious) */
  WIN_BIAS_INCREASE = "WIN_BIAS_INCREASE",
  /** Shift to shorter duration markets */
  SHORTER_DURATION = "SHORTER_DURATION",
  /** Shift to longer duration markets */
  LONGER_DURATION = "LONGER_DURATION",
}

/**
 * Selection suspicion level
 */
export enum SelectionSuspicionLevel {
  /** Normal selection behavior */
  NONE = "NONE",
  /** Slightly unusual */
  LOW = "LOW",
  /** Notable patterns */
  MEDIUM = "MEDIUM",
  /** Suspicious patterns */
  HIGH = "HIGH",
  /** Very suspicious - likely informed trading */
  CRITICAL = "CRITICAL",
}

/**
 * Trade entry for selection analysis
 */
export interface SelectionTrade {
  /** Unique trade ID */
  tradeId: string;
  /** Market ID */
  marketId: string;
  /** Market title/question */
  marketTitle?: string;
  /** Market category */
  marketCategory?: MarketCategory | string;
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade timestamp */
  timestamp: Date;
  /** Market creation date (if known) */
  marketCreatedAt?: Date;
  /** Market resolution date (if known) */
  marketResolvesAt?: Date;
  /** Market volume at time of trade */
  marketVolume?: number;
  /** Market liquidity at time of trade */
  marketLiquidity?: number;
  /** Whether market had recent news/events */
  hasRecentNews?: boolean;
  /** Number of outcomes in market */
  outcomeCount?: number;
  /** Side (buy/sell) */
  side: "buy" | "sell";
  /** Whether this was a winning trade */
  isWinner?: boolean | null;
  /** Profit/loss in USD */
  pnl?: number | null;
  /** Entry price (0-1 for binary) */
  price?: number;
}

/**
 * Market statistics for a wallet
 */
export interface MarketStats {
  /** Market ID */
  marketId: string;
  /** Market title */
  marketTitle?: string;
  /** Market category */
  category: MarketCategory | string;
  /** Number of trades in this market */
  tradeCount: number;
  /** Total volume traded */
  totalVolume: number;
  /** First trade timestamp */
  firstTradeAt: Date;
  /** Last trade timestamp */
  lastTradeAt: Date;
  /** Win count */
  winCount: number;
  /** Loss count */
  lossCount: number;
  /** Win rate */
  winRate: number;
  /** Total P&L */
  totalPnl: number;
  /** Average trade size */
  avgTradeSize: number;
  /** Average time to resolution when trading */
  avgTimeToResolution?: number;
}

/**
 * Category preference breakdown
 */
export interface CategoryPreference {
  /** Category */
  category: MarketCategory | string;
  /** Number of unique markets traded */
  marketCount: number;
  /** Number of trades */
  tradeCount: number;
  /** Percentage of total trades */
  tradePercentage: number;
  /** Total volume */
  totalVolume: number;
  /** Volume percentage */
  volumePercentage: number;
  /** Win rate in this category */
  winRate: number;
  /** Average trade size */
  avgTradeSize: number;
  /** Preference score (0-100) */
  preferenceScore: number;
}

/**
 * Selection diversity metrics
 */
export interface SelectionDiversity {
  /** Unique markets traded */
  uniqueMarkets: number;
  /** Unique categories traded */
  uniqueCategories: number;
  /** Market concentration (Herfindahl index) */
  marketConcentration: number;
  /** Category concentration (Herfindahl index) */
  categoryConcentration: number;
  /** Diversity score (0-100, higher = more diverse) */
  diversityScore: number;
  /** Trades per market ratio */
  tradesPerMarket: number;
  /** Volume distribution gini coefficient */
  volumeGini: number;
}

/**
 * Selection timing preferences
 */
export interface SelectionTiming {
  /** Prefers new markets (avg age at trade) */
  avgMarketAgeAtTrade: number;
  /** Prefers near-resolution (avg time to resolution) */
  avgTimeToResolution: number;
  /** Percentage of trades in new markets (<7 days old) */
  newMarketPercentage: number;
  /** Percentage of trades near resolution (<24h) */
  nearResolutionPercentage: number;
  /** Timing consistency score */
  timingConsistency: number;
}

/**
 * Selection shift detection
 */
export interface SelectionShift {
  /** Shift type */
  type: SelectionShiftType;
  /** Shift magnitude (0-100) */
  magnitude: number;
  /** Description of the shift */
  description: string;
  /** When the shift was detected */
  detectedAt: Date;
  /** Time period before shift */
  beforePeriod: { start: Date; end: Date };
  /** Time period after shift */
  afterPeriod: { start: Date; end: Date };
  /** Relevant data/evidence */
  evidence: Record<string, unknown>;
}

/**
 * Selection analysis result
 */
export interface SelectionAnalysisResult {
  /** Wallet address (checksummed) */
  walletAddress: string;
  /** Primary selection pattern */
  primaryPattern: SelectionPatternType;
  /** Primary preferences */
  preferences: SelectionPreferenceType[];
  /** Category preferences breakdown */
  categoryPreferences: CategoryPreference[];
  /** Selection diversity metrics */
  diversity: SelectionDiversity;
  /** Selection timing metrics */
  timing: SelectionTiming;
  /** Market-specific statistics */
  marketStats: MarketStats[];
  /** Top markets by volume */
  topMarkets: MarketStats[];
  /** Detected selection shifts */
  shifts: SelectionShift[];
  /** Suspicion level */
  suspicionLevel: SelectionSuspicionLevel;
  /** Suspicion score (0-100) */
  suspicionScore: number;
  /** Risk flags */
  riskFlags: string[];
  /** Insights about selection behavior */
  insights: string[];
  /** Data quality score (0-100) */
  dataQuality: number;
  /** Is potentially suspicious */
  isPotentiallySuspicious: boolean;
  /** Total trades analyzed */
  totalTrades: number;
  /** Total volume */
  totalVolume: number;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Batch analysis result
 */
export interface BatchSelectionAnalysisResult {
  /** Results by wallet */
  results: Map<string, SelectionAnalysisResult>;
  /** Failed analyses */
  errors: Map<string, string>;
  /** Total processed */
  totalProcessed: number;
  /** Success count */
  successCount: number;
  /** Error count */
  errorCount: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Analyzer summary statistics
 */
export interface SelectionAnalyzerSummary {
  /** Total wallets analyzed */
  totalWalletsAnalyzed: number;
  /** Total trades processed */
  totalTradesProcessed: number;
  /** Pattern distribution */
  patternDistribution: Map<SelectionPatternType, number>;
  /** Suspicion level distribution */
  suspicionDistribution: Map<SelectionSuspicionLevel, number>;
  /** Average diversity score */
  avgDiversityScore: number;
  /** Average suspicion score */
  avgSuspicionScore: number;
  /** Suspicious wallets count */
  suspiciousWalletCount: number;
  /** Most common risk flags */
  topRiskFlags: Array<{ flag: string; count: number }>;
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
  };
}

/**
 * Configuration for the analyzer
 */
export interface MarketSelectionAnalyzerConfig {
  /** Minimum trades for analysis (default: 5) */
  minTrades?: number;
  /** Cache TTL in ms (default: 15 minutes) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 2000) */
  maxCacheSize?: number;
  /** Time window for shift detection in days (default: 30) */
  shiftWindowDays?: number;
  /** Concentration threshold for flagging (default: 0.5) */
  concentrationThreshold?: number;
  /** High win rate threshold (default: 0.8) */
  highWinRateThreshold?: number;
  /** Categories considered high-value for insider detection */
  highValueCategories?: (MarketCategory | string)[];
}

/**
 * Options for analysis
 */
export interface AnalyzeSelectionOptions {
  /** Bypass cache */
  bypassCache?: boolean;
  /** Minimum trades required */
  minTrades?: number;
  /** Time window in days */
  timeWindowDays?: number;
  /** Include detailed market stats */
  includeDetailedStats?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_SELECTION_ANALYZER_CONFIG: Required<MarketSelectionAnalyzerConfig> = {
  minTrades: 5,
  cacheTtlMs: 15 * 60 * 1000, // 15 minutes
  maxCacheSize: 2000,
  shiftWindowDays: 30,
  concentrationThreshold: 0.5,
  highWinRateThreshold: 0.8,
  highValueCategories: [
    MarketCategory.POLITICS,
    MarketCategory.LEGAL,
    MarketCategory.GEOPOLITICS,
    MarketCategory.BUSINESS,
  ],
};

/**
 * Concentration thresholds for pattern classification
 */
const CONCENTRATION_THRESHOLDS = {
  VERY_HIGH: 0.6, // HHI for very focused
  HIGH: 0.4,
  MODERATE: 0.25,
  LOW: 0.1,
};

/**
 * Suspicion score thresholds
 */
const SUSPICION_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate Herfindahl-Hirschman Index for concentration
 */
function calculateHHI(shares: number[]): number {
  const total = shares.reduce((sum, s) => sum + s, 0);
  if (total === 0) return 0;
  return shares.reduce((sum, s) => sum + Math.pow(s / total, 2), 0);
}

/**
 * Calculate Gini coefficient for inequality
 */
function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;

  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs((sorted[i] ?? 0) - (sorted[j] ?? 0));
    }
  }
  return sumAbsDiff / (2 * n * n * mean);
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
 * Get suspicion level from score
 */
function getSuspicionLevelFromScore(score: number): SelectionSuspicionLevel {
  if (score >= SUSPICION_THRESHOLDS.CRITICAL) return SelectionSuspicionLevel.CRITICAL;
  if (score >= SUSPICION_THRESHOLDS.HIGH) return SelectionSuspicionLevel.HIGH;
  if (score >= SUSPICION_THRESHOLDS.MEDIUM) return SelectionSuspicionLevel.MEDIUM;
  if (score >= SUSPICION_THRESHOLDS.LOW) return SelectionSuspicionLevel.LOW;
  return SelectionSuspicionLevel.NONE;
}

/**
 * Get pattern from diversity and concentration
 */
function classifyPattern(
  diversityScore: number,
  marketConcentration: number,
  categoryConcentration: number,
  winRate: number,
  tradeCount: number
): SelectionPatternType {
  // Insufficient data
  if (tradeCount < 5) return SelectionPatternType.UNKNOWN;

  // Suspiciously good market picks
  if (winRate > 0.85 && tradeCount >= 10) {
    return SelectionPatternType.INSIDER_LIKE;
  }

  // High market concentration = focused
  if (marketConcentration > CONCENTRATION_THRESHOLDS.VERY_HIGH) {
    return SelectionPatternType.FOCUSED;
  }

  // High category concentration = specialist
  if (categoryConcentration > CONCENTRATION_THRESHOLDS.HIGH) {
    return SelectionPatternType.SPECIALIST;
  }

  // High diversity = diverse
  if (diversityScore > 70 && marketConcentration < CONCENTRATION_THRESHOLDS.LOW) {
    return SelectionPatternType.DIVERSE;
  }

  // Moderate concentration with consistent patterns
  if (
    marketConcentration > CONCENTRATION_THRESHOLDS.MODERATE &&
    marketConcentration < CONCENTRATION_THRESHOLDS.HIGH
  ) {
    return SelectionPatternType.SYSTEMATIC;
  }

  // Low patterns, high randomness
  if (diversityScore > 50 && diversityScore < 70) {
    return SelectionPatternType.OPPORTUNISTIC;
  }

  return SelectionPatternType.RANDOM;
}

/**
 * Identify preferences from trading data
 */
function identifyPreferences(
  trades: SelectionTrade[],
  categoryPreferences: CategoryPreference[],
  timing: SelectionTiming
): SelectionPreferenceType[] {
  const preferences: SelectionPreferenceType[] = [];

  // Check for category specialist
  const topCategory = categoryPreferences[0];
  if (topCategory && topCategory.tradePercentage > 60) {
    preferences.push(SelectionPreferenceType.CATEGORY_SPECIALIST);
  }

  // Check for volume preferences
  const tradesWithVolume = trades.filter((t) => t.marketVolume !== undefined);
  if (tradesWithVolume.length > 0) {
    const avgVolume =
      tradesWithVolume.reduce((sum, t) => sum + (t.marketVolume || 0), 0) /
      tradesWithVolume.length;
    if (avgVolume > 100000) {
      preferences.push(SelectionPreferenceType.HIGH_VOLUME);
    } else if (avgVolume < 10000) {
      preferences.push(SelectionPreferenceType.LOW_VOLUME);
    }
  }

  // Check for timing preferences
  if (timing.nearResolutionPercentage > 40) {
    preferences.push(SelectionPreferenceType.NEAR_RESOLUTION);
  }
  if (timing.newMarketPercentage > 40) {
    preferences.push(SelectionPreferenceType.NEW_MARKETS);
  }

  // Check for event-driven
  const tradesWithNews = trades.filter((t) => t.hasRecentNews);
  if (tradesWithNews.length / trades.length > 0.5) {
    preferences.push(SelectionPreferenceType.EVENT_DRIVEN);
  }

  // Check for outcome type preference
  const multiOutcome = trades.filter((t) => t.outcomeCount && t.outcomeCount > 2);
  if (multiOutcome.length / trades.length > 0.7) {
    preferences.push(SelectionPreferenceType.MULTI_OUTCOME);
  } else if (multiOutcome.length / trades.length < 0.2) {
    preferences.push(SelectionPreferenceType.BINARY_MARKETS);
  }

  if (preferences.length === 0) {
    preferences.push(SelectionPreferenceType.NONE);
  }

  return preferences;
}

/**
 * Detect shifts in selection pattern
 */
function detectShifts(
  trades: SelectionTrade[],
  _windowDays: number
): SelectionShift[] {
  const shifts: SelectionShift[] = [];

  if (trades.length < 10) return shifts;

  // Sort by timestamp
  const sorted = [...trades].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const midpoint = Math.floor(sorted.length / 2);
  const beforeTrades = sorted.slice(0, midpoint);
  const afterTrades = sorted.slice(midpoint);

  if (beforeTrades.length < 3 || afterTrades.length < 3) return shifts;

  const beforeEnd = beforeTrades[beforeTrades.length - 1]?.timestamp ?? new Date();
  const afterStart = afterTrades[0]?.timestamp ?? new Date();

  // Calculate metrics for before and after periods
  const beforeCategories = new Map<string, number>();
  const afterCategories = new Map<string, number>();

  beforeTrades.forEach((t) => {
    const cat = t.marketCategory || "OTHER";
    beforeCategories.set(cat, (beforeCategories.get(cat) || 0) + 1);
  });

  afterTrades.forEach((t) => {
    const cat = t.marketCategory || "OTHER";
    afterCategories.set(cat, (afterCategories.get(cat) || 0) + 1);
  });

  // Check for category change
  const beforeTopCat = [...beforeCategories.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  const afterTopCat = [...afterCategories.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];

  const firstBeforeTrade = beforeTrades[0];
  const lastAfterTrade = afterTrades[afterTrades.length - 1];

  if (
    beforeTopCat &&
    afterTopCat &&
    beforeTopCat[0] !== afterTopCat[0] &&
    afterTopCat[1] / afterTrades.length > 0.4 &&
    firstBeforeTrade && lastAfterTrade
  ) {
    shifts.push({
      type: SelectionShiftType.CATEGORY_CHANGE,
      magnitude: Math.abs(
        afterTopCat[1] / afterTrades.length -
          beforeTopCat[1] / beforeTrades.length
      ) * 100,
      description: `Shifted from ${beforeTopCat[0]} to ${afterTopCat[0]}`,
      detectedAt: afterStart,
      beforePeriod: {
        start: firstBeforeTrade.timestamp,
        end: beforeEnd,
      },
      afterPeriod: {
        start: afterStart,
        end: lastAfterTrade.timestamp,
      },
      evidence: {
        beforeCategory: beforeTopCat[0],
        beforePercentage: beforeTopCat[1] / beforeTrades.length,
        afterCategory: afterTopCat[0],
        afterPercentage: afterTopCat[1] / afterTrades.length,
      },
    });
  }

  // Check for concentration change
  const beforeMarkets = new Set(beforeTrades.map((t) => t.marketId)).size;
  const afterMarkets = new Set(afterTrades.map((t) => t.marketId)).size;
  const beforeConcentration = beforeTrades.length / beforeMarkets;
  const afterConcentration = afterTrades.length / afterMarkets;

  if (afterConcentration > beforeConcentration * 1.5 && afterConcentration > 3 && firstBeforeTrade && lastAfterTrade) {
    shifts.push({
      type: SelectionShiftType.CONCENTRATION_INCREASE,
      magnitude: ((afterConcentration - beforeConcentration) / beforeConcentration) * 100,
      description: `Market concentration increased from ${beforeConcentration.toFixed(1)} to ${afterConcentration.toFixed(1)} trades/market`,
      detectedAt: afterStart,
      beforePeriod: {
        start: firstBeforeTrade.timestamp,
        end: beforeEnd,
      },
      afterPeriod: {
        start: afterStart,
        end: lastAfterTrade.timestamp,
      },
      evidence: {
        beforeTradesPerMarket: beforeConcentration,
        afterTradesPerMarket: afterConcentration,
        beforeUniqueMarkets: beforeMarkets,
        afterUniqueMarkets: afterMarkets,
      },
    });
  } else if (afterConcentration < beforeConcentration * 0.6 && firstBeforeTrade && lastAfterTrade) {
    shifts.push({
      type: SelectionShiftType.CONCENTRATION_DECREASE,
      magnitude: ((beforeConcentration - afterConcentration) / beforeConcentration) * 100,
      description: `Market concentration decreased from ${beforeConcentration.toFixed(1)} to ${afterConcentration.toFixed(1)} trades/market`,
      detectedAt: afterStart,
      beforePeriod: {
        start: firstBeforeTrade.timestamp,
        end: beforeEnd,
      },
      afterPeriod: {
        start: afterStart,
        end: lastAfterTrade.timestamp,
      },
      evidence: {
        beforeTradesPerMarket: beforeConcentration,
        afterTradesPerMarket: afterConcentration,
        beforeUniqueMarkets: beforeMarkets,
        afterUniqueMarkets: afterMarkets,
      },
    });
  }

  // Check for win rate shift
  const beforeWins = beforeTrades.filter((t) => t.isWinner === true).length;
  const afterWins = afterTrades.filter((t) => t.isWinner === true).length;
  const beforeResolved = beforeTrades.filter((t) => t.isWinner !== undefined && t.isWinner !== null).length;
  const afterResolved = afterTrades.filter((t) => t.isWinner !== undefined && t.isWinner !== null).length;

  if (beforeResolved >= 3 && afterResolved >= 3 && firstBeforeTrade && lastAfterTrade) {
    const beforeWinRate = beforeWins / beforeResolved;
    const afterWinRate = afterWins / afterResolved;

    if (afterWinRate > beforeWinRate + 0.2 && afterWinRate > 0.7) {
      shifts.push({
        type: SelectionShiftType.WIN_BIAS_INCREASE,
        magnitude: (afterWinRate - beforeWinRate) * 100,
        description: `Win rate increased from ${(beforeWinRate * 100).toFixed(0)}% to ${(afterWinRate * 100).toFixed(0)}%`,
        detectedAt: afterStart,
        beforePeriod: {
          start: firstBeforeTrade.timestamp,
          end: beforeEnd,
        },
        afterPeriod: {
          start: afterStart,
          end: lastAfterTrade.timestamp,
        },
        evidence: {
          beforeWinRate,
          afterWinRate,
          beforeResolved,
          afterResolved,
        },
      });
    }
  }

  return shifts;
}

/**
 * Generate insights from analysis
 */
function generateInsights(
  result: Partial<SelectionAnalysisResult>,
  trades: SelectionTrade[]
): string[] {
  const insights: string[] = [];

  if (!result.diversity || !result.categoryPreferences) {
    return insights;
  }

  // Diversity insight
  if (result.diversity.diversityScore > 80) {
    insights.push("Highly diversified market selection across many categories and markets");
  } else if (result.diversity.diversityScore < 30) {
    insights.push("Highly concentrated trading in few markets - may indicate specialist or informed trading");
  }

  // Category insight
  if (result.categoryPreferences.length > 0) {
    const topCat = result.categoryPreferences[0];
    if (topCat && topCat.tradePercentage > 70) {
      insights.push(
        `Strong specialization in ${topCat.category} markets (${topCat.tradePercentage.toFixed(0)}% of trades)`
      );
    }
  }

  // Win rate insights
  const resolvedTrades = trades.filter((t) => t.isWinner !== undefined && t.isWinner !== null);
  if (resolvedTrades.length >= 5) {
    const winRate = resolvedTrades.filter((t) => t.isWinner).length / resolvedTrades.length;
    if (winRate > 0.85) {
      insights.push(
        `Exceptionally high win rate (${(winRate * 100).toFixed(0)}%) in market selection - warrants investigation`
      );
    } else if (winRate > 0.7) {
      insights.push(
        `Above-average win rate (${(winRate * 100).toFixed(0)}%) suggests good market selection skills or information advantage`
      );
    }
  }

  // Timing insights
  if (result.timing) {
    if (result.timing.nearResolutionPercentage > 50) {
      insights.push(
        `Prefers trading near market resolution (${result.timing.nearResolutionPercentage.toFixed(0)}% within 24h) - may indicate informed trading`
      );
    }
    if (result.timing.newMarketPercentage > 50) {
      insights.push("Early market participant - tends to enter markets soon after creation");
    }
  }

  // Shift insights
  if (result.shifts && result.shifts.length > 0) {
    const significantShifts = result.shifts.filter((s) => s.magnitude > 30);
    if (significantShifts.length > 0) {
      insights.push(
        `Detected ${significantShifts.length} significant shift(s) in selection pattern`
      );
    }
  }

  return insights;
}

/**
 * Calculate risk flags
 */
function calculateRiskFlags(
  result: Partial<SelectionAnalysisResult>,
  trades: SelectionTrade[],
  config: Required<MarketSelectionAnalyzerConfig>
): string[] {
  const flags: string[] = [];

  // High win rate
  const resolvedTrades = trades.filter((t) => t.isWinner !== undefined && t.isWinner !== null);
  if (resolvedTrades.length >= 5) {
    const winRate = resolvedTrades.filter((t) => t.isWinner).length / resolvedTrades.length;
    if (winRate > config.highWinRateThreshold) {
      flags.push("HIGH_WIN_RATE");
    }
  }

  // Concentration in high-value categories
  if (result.categoryPreferences) {
    const highValuePercentage = result.categoryPreferences
      .filter((cp) => config.highValueCategories.includes(cp.category as MarketCategory))
      .reduce((sum, cp) => sum + cp.tradePercentage, 0);

    if (highValuePercentage > 70) {
      flags.push("HIGH_VALUE_CATEGORY_CONCENTRATION");
    }
  }

  // Market concentration
  if (result.diversity && result.diversity.marketConcentration > config.concentrationThreshold) {
    flags.push("HIGH_MARKET_CONCENTRATION");
  }

  // Win bias shift
  if (result.shifts) {
    const winBiasShift = result.shifts.find(
      (s) => s.type === SelectionShiftType.WIN_BIAS_INCREASE
    );
    if (winBiasShift && winBiasShift.magnitude > 20) {
      flags.push("WIN_BIAS_SHIFT");
    }
  }

  // Near resolution trading
  if (result.timing && result.timing.nearResolutionPercentage > 50) {
    flags.push("NEAR_RESOLUTION_PREFERENCE");
  }

  // Perfect market picks (very suspicious)
  if (
    result.primaryPattern === SelectionPatternType.INSIDER_LIKE &&
    resolvedTrades.length >= 10
  ) {
    flags.push("INSIDER_LIKE_PATTERN");
  }

  return flags;
}

/**
 * Calculate suspicion score
 */
function calculateSuspicionScore(
  result: Partial<SelectionAnalysisResult>,
  trades: SelectionTrade[],
  config: Required<MarketSelectionAnalyzerConfig>
): number {
  let score = 0;

  // Win rate contribution (max 30)
  const resolvedTrades = trades.filter((t) => t.isWinner !== undefined && t.isWinner !== null);
  if (resolvedTrades.length >= 5) {
    const winRate = resolvedTrades.filter((t) => t.isWinner).length / resolvedTrades.length;
    if (winRate > 0.9) score += 30;
    else if (winRate > 0.8) score += 20;
    else if (winRate > 0.7) score += 10;
  }

  // High-value category concentration (max 20)
  if (result.categoryPreferences) {
    const highValuePercentage = result.categoryPreferences
      .filter((cp) => config.highValueCategories.includes(cp.category as MarketCategory))
      .reduce((sum, cp) => sum + cp.tradePercentage, 0);

    if (highValuePercentage > 80) score += 20;
    else if (highValuePercentage > 60) score += 15;
    else if (highValuePercentage > 40) score += 10;
  }

  // Market concentration (max 15)
  if (result.diversity) {
    if (result.diversity.marketConcentration > 0.7) score += 15;
    else if (result.diversity.marketConcentration > 0.5) score += 10;
    else if (result.diversity.marketConcentration > 0.3) score += 5;
  }

  // Near resolution preference (max 15)
  if (result.timing) {
    if (result.timing.nearResolutionPercentage > 60) score += 15;
    else if (result.timing.nearResolutionPercentage > 40) score += 10;
    else if (result.timing.nearResolutionPercentage > 25) score += 5;
  }

  // Selection shifts (max 10)
  if (result.shifts) {
    const suspiciousShifts = result.shifts.filter(
      (s) =>
        s.type === SelectionShiftType.WIN_BIAS_INCREASE ||
        s.type === SelectionShiftType.CONCENTRATION_INCREASE
    );
    score += Math.min(suspiciousShifts.length * 5, 10);
  }

  // Sample size bonus (max 10 for high confidence)
  if (resolvedTrades.length >= 20) score = Math.min(score * 1.1, score + 10);

  return Math.min(score, 100);
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: SelectionAnalysisResult;
  expiresAt: number;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Market Selection Pattern Analyzer
 *
 * Analyzes which markets wallets tend to trade to identify preferences,
 * shifts, and suspicious patterns.
 */
export class MarketSelectionAnalyzer extends EventEmitter {
  private config: Required<MarketSelectionAnalyzerConfig>;
  private tradesByWallet: Map<string, SelectionTrade[]> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: MarketSelectionAnalyzerConfig = {}) {
    super();
    this.config = { ...DEFAULT_SELECTION_ANALYZER_CONFIG, ...config };
  }

  /**
   * Add trades for a wallet
   */
  addTrades(walletAddress: string, trades: SelectionTrade[]): void {
    const normalized = normalizeAddress(walletAddress);
    const existing = this.tradesByWallet.get(normalized) || [];

    // Dedupe by tradeId
    const existingIds = new Set(existing.map((t) => t.tradeId));
    const newTrades = trades.filter((t) => !existingIds.has(t.tradeId));

    this.tradesByWallet.set(normalized, [...existing, ...newTrades]);

    // Invalidate cache
    this.cache.delete(normalized);

    this.emit("tradesAdded", {
      walletAddress: normalized,
      newTradeCount: newTrades.length,
      totalTradeCount: existing.length + newTrades.length,
    });
  }

  /**
   * Get trades for a wallet
   */
  getTrades(walletAddress: string): SelectionTrade[] {
    const normalized = normalizeAddress(walletAddress);
    return this.tradesByWallet.get(normalized) || [];
  }

  /**
   * Clear trades for a wallet
   */
  clearTrades(walletAddress: string): void {
    const normalized = normalizeAddress(walletAddress);
    this.tradesByWallet.delete(normalized);
    this.cache.delete(normalized);

    this.emit("tradesCleared", { walletAddress: normalized });
  }

  /**
   * Clear all trades
   */
  clearAllTrades(): void {
    this.tradesByWallet.clear();
    this.cache.clear();
    this.emit("allTradesCleared");
  }

  /**
   * Analyze market selection pattern for a wallet
   */
  analyze(
    walletAddress: string,
    options: AnalyzeSelectionOptions = {}
  ): SelectionAnalysisResult {
    const normalized = normalizeAddress(walletAddress);
    const now = Date.now();

    // Check cache
    if (!options.bypassCache) {
      const cached = this.cache.get(normalized);
      if (cached && cached.expiresAt > now) {
        this.cacheHits++;
        return cached.result;
      }
    }

    this.cacheMisses++;

    const trades = this.tradesByWallet.get(normalized) || [];
    const minTrades = options.minTrades ?? this.config.minTrades;

    if (trades.length < minTrades) {
      const insufficientResult: SelectionAnalysisResult = {
        walletAddress: normalized,
        primaryPattern: SelectionPatternType.UNKNOWN,
        preferences: [SelectionPreferenceType.NONE],
        categoryPreferences: [],
        diversity: {
          uniqueMarkets: new Set(trades.map((t) => t.marketId)).size,
          uniqueCategories: new Set(trades.map((t) => t.marketCategory || "OTHER")).size,
          marketConcentration: 0,
          categoryConcentration: 0,
          diversityScore: 0,
          tradesPerMarket: trades.length / Math.max(1, new Set(trades.map((t) => t.marketId)).size),
          volumeGini: 0,
        },
        timing: {
          avgMarketAgeAtTrade: 0,
          avgTimeToResolution: 0,
          newMarketPercentage: 0,
          nearResolutionPercentage: 0,
          timingConsistency: 0,
        },
        marketStats: [],
        topMarkets: [],
        shifts: [],
        suspicionLevel: SelectionSuspicionLevel.NONE,
        suspicionScore: 0,
        riskFlags: [],
        insights: ["Insufficient trading data for full analysis"],
        dataQuality: trades.length / minTrades * 50,
        isPotentiallySuspicious: false,
        totalTrades: trades.length,
        totalVolume: trades.reduce((sum, t) => sum + t.sizeUsd, 0),
        analyzedAt: new Date(),
      };

      return insufficientResult;
    }

    // Calculate market statistics
    const marketStatsMap = new Map<string, MarketStats>();
    trades.forEach((trade) => {
      const existing = marketStatsMap.get(trade.marketId);
      if (existing) {
        existing.tradeCount++;
        existing.totalVolume += trade.sizeUsd;
        if (trade.timestamp < existing.firstTradeAt) {
          existing.firstTradeAt = trade.timestamp;
        }
        if (trade.timestamp > existing.lastTradeAt) {
          existing.lastTradeAt = trade.timestamp;
        }
        if (trade.isWinner === true) existing.winCount++;
        if (trade.isWinner === false) existing.lossCount++;
        if (trade.pnl !== undefined && trade.pnl !== null) {
          existing.totalPnl += trade.pnl;
        }
      } else {
        marketStatsMap.set(trade.marketId, {
          marketId: trade.marketId,
          marketTitle: trade.marketTitle,
          category: trade.marketCategory || "OTHER",
          tradeCount: 1,
          totalVolume: trade.sizeUsd,
          firstTradeAt: trade.timestamp,
          lastTradeAt: trade.timestamp,
          winCount: trade.isWinner === true ? 1 : 0,
          lossCount: trade.isWinner === false ? 1 : 0,
          winRate: 0, // Calculated later
          totalPnl: trade.pnl ?? 0,
          avgTradeSize: 0, // Calculated later
        });
      }
    });

    // Finalize market stats
    const marketStats = [...marketStatsMap.values()].map((stats) => {
      const resolved = stats.winCount + stats.lossCount;
      return {
        ...stats,
        winRate: resolved > 0 ? stats.winCount / resolved : 0,
        avgTradeSize: stats.totalVolume / stats.tradeCount,
      };
    });

    // Top markets by volume
    const topMarkets = [...marketStats]
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    // Calculate category preferences
    const totalTrades = trades.length;
    const totalVolume = trades.reduce((sum, t) => sum + t.sizeUsd, 0);

    // Internal tracking type with extra fields
    interface InternalCategoryStats extends CategoryPreference {
      marketIds: Set<string>;
      winCount: number;
      resolvedCount: number;
    }

    const categoryStatsMap = new Map<string, InternalCategoryStats>();

    trades.forEach((trade) => {
      const cat = (trade.marketCategory || "OTHER") as string;
      const existing = categoryStatsMap.get(cat);
      if (existing) {
        existing.tradeCount++;
        existing.totalVolume += trade.sizeUsd;
        existing.marketIds.add(trade.marketId);
        if (trade.isWinner === true) existing.winCount++;
        if (trade.isWinner !== undefined && trade.isWinner !== null) {
          existing.resolvedCount++;
        }
      } else {
        const marketIds = new Set<string>();
        marketIds.add(trade.marketId);
        categoryStatsMap.set(cat, {
          category: cat,
          marketCount: 0, // Calculated later
          tradeCount: 1,
          tradePercentage: 0, // Calculated later
          totalVolume: trade.sizeUsd,
          volumePercentage: 0, // Calculated later
          winRate: 0, // Calculated later
          avgTradeSize: 0, // Calculated later
          preferenceScore: 0, // Calculated later
          marketIds,
          winCount: trade.isWinner === true ? 1 : 0,
          resolvedCount: trade.isWinner !== undefined && trade.isWinner !== null ? 1 : 0,
        });
      }
    });

    // Finalize category preferences
    const categoryPreferences = [...categoryStatsMap.values()]
      .map((cp) => {
        return {
          category: cp.category,
          marketCount: cp.marketIds.size,
          tradeCount: cp.tradeCount,
          tradePercentage: (cp.tradeCount / totalTrades) * 100,
          totalVolume: cp.totalVolume,
          volumePercentage: totalVolume > 0 ? (cp.totalVolume / totalVolume) * 100 : 0,
          winRate: cp.resolvedCount > 0 ? cp.winCount / cp.resolvedCount : 0,
          avgTradeSize: cp.totalVolume / cp.tradeCount,
          preferenceScore: (cp.tradeCount / totalTrades + cp.totalVolume / totalVolume) * 50,
        };
      })
      .sort((a, b) => b.tradePercentage - a.tradePercentage);

    // Calculate diversity metrics
    const uniqueMarkets = new Set(trades.map((t) => t.marketId)).size;
    const uniqueCategories = new Set(
      trades.map((t) => t.marketCategory || "OTHER")
    ).size;

    const tradeCountsByMarket = [...marketStatsMap.values()].map(
      (s) => s.tradeCount
    );
    const volumesByMarket = [...marketStatsMap.values()].map(
      (s) => s.totalVolume
    );
    const tradeCountsByCategory = categoryPreferences.map((c) => c.tradeCount);

    const marketConcentration = calculateHHI(tradeCountsByMarket);
    const categoryConcentration = calculateHHI(tradeCountsByCategory);
    const volumeGini = calculateGini(volumesByMarket);

    // Diversity score (higher = more diverse)
    const diversityScore = Math.max(
      0,
      100 - marketConcentration * 50 - categoryConcentration * 30 - volumeGini * 20
    );

    const diversity: SelectionDiversity = {
      uniqueMarkets,
      uniqueCategories,
      marketConcentration,
      categoryConcentration,
      diversityScore,
      tradesPerMarket: trades.length / Math.max(1, uniqueMarkets),
      volumeGini,
    };

    // Calculate timing metrics
    let totalMarketAge = 0;
    let countWithAge = 0;
    let totalTimeToRes = 0;
    let countWithRes = 0;
    let newMarketCount = 0;
    let nearResolutionCount = 0;

    trades.forEach((t) => {
      if (t.marketCreatedAt) {
        const ageMs = t.timestamp.getTime() - t.marketCreatedAt.getTime();
        totalMarketAge += ageMs;
        countWithAge++;
        if (ageMs < 7 * 24 * 60 * 60 * 1000) {
          newMarketCount++;
        }
      }
      if (t.marketResolvesAt) {
        const timeToRes = t.marketResolvesAt.getTime() - t.timestamp.getTime();
        totalTimeToRes += timeToRes;
        countWithRes++;
        if (timeToRes < 24 * 60 * 60 * 1000) {
          nearResolutionCount++;
        }
      }
    });

    const timing: SelectionTiming = {
      avgMarketAgeAtTrade: countWithAge > 0 ? totalMarketAge / countWithAge / (24 * 60 * 60 * 1000) : 0,
      avgTimeToResolution: countWithRes > 0 ? totalTimeToRes / countWithRes / (24 * 60 * 60 * 1000) : 0,
      newMarketPercentage: countWithAge > 0 ? (newMarketCount / countWithAge) * 100 : 0,
      nearResolutionPercentage: countWithRes > 0 ? (nearResolutionCount / countWithRes) * 100 : 0,
      timingConsistency: 0, // Could be enhanced
    };

    // Calculate win rate for pattern classification
    const resolvedTrades = trades.filter(
      (t) => t.isWinner !== undefined && t.isWinner !== null
    );
    const winRate =
      resolvedTrades.length > 0
        ? resolvedTrades.filter((t) => t.isWinner).length / resolvedTrades.length
        : 0;

    // Classify pattern
    const primaryPattern = classifyPattern(
      diversityScore,
      marketConcentration,
      categoryConcentration,
      winRate,
      trades.length
    );

    // Identify preferences
    const preferences = identifyPreferences(
      trades,
      categoryPreferences,
      timing
    );

    // Detect shifts
    const shifts = detectShifts(trades, this.config.shiftWindowDays);

    // Build partial result for helper functions
    const partialResult: Partial<SelectionAnalysisResult> = {
      primaryPattern,
      preferences,
      categoryPreferences,
      diversity,
      timing,
      shifts,
    };

    // Calculate suspicion score
    const suspicionScore = calculateSuspicionScore(
      partialResult,
      trades,
      this.config
    );
    const suspicionLevel = getSuspicionLevelFromScore(suspicionScore);

    // Calculate risk flags
    const riskFlags = calculateRiskFlags(partialResult, trades, this.config);

    // Generate insights
    const insights = generateInsights(partialResult, trades);

    // Data quality score
    let dataQuality = 50;
    if (trades.length >= 10) dataQuality += 10;
    if (trades.length >= 20) dataQuality += 10;
    if (resolvedTrades.length >= 5) dataQuality += 10;
    if (countWithAge > trades.length * 0.5) dataQuality += 10;
    if (countWithRes > trades.length * 0.5) dataQuality += 10;
    dataQuality = Math.min(dataQuality, 100);

    const result: SelectionAnalysisResult = {
      walletAddress: normalized,
      primaryPattern,
      preferences,
      categoryPreferences,
      diversity,
      timing,
      marketStats: options.includeDetailedStats ? marketStats : [],
      topMarkets,
      shifts,
      suspicionLevel,
      suspicionScore,
      riskFlags,
      insights,
      dataQuality,
      isPotentiallySuspicious: suspicionScore >= SUSPICION_THRESHOLDS.HIGH,
      totalTrades: trades.length,
      totalVolume,
      analyzedAt: new Date(),
    };

    // Cache result
    this.cache.set(normalized, {
      result,
      expiresAt: now + this.config.cacheTtlMs,
    });

    // Emit event
    this.emit("analysisComplete", result);

    if (result.isPotentiallySuspicious) {
      this.emit("suspiciousWalletDetected", {
        walletAddress: normalized,
        suspicionScore,
        suspicionLevel,
        riskFlags,
      });
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    walletAddresses: string[],
    options: AnalyzeSelectionOptions = {}
  ): BatchSelectionAnalysisResult {
    const startTime = Date.now();
    const results = new Map<string, SelectionAnalysisResult>();
    const errors = new Map<string, string>();

    for (const address of walletAddresses) {
      try {
        const result = this.analyze(address, options);
        results.set(result.walletAddress, result);
      } catch (error) {
        errors.set(address, error instanceof Error ? error.message : String(error));
      }
    }

    return {
      results,
      errors,
      totalProcessed: walletAddresses.length,
      successCount: results.size,
      errorCount: errors.size,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if wallet has suspicious selection pattern
   */
  hasSuspiciousSelection(walletAddress: string): boolean {
    const result = this.analyze(walletAddress);
    return result.isPotentiallySuspicious;
  }

  /**
   * Get wallets with suspicious selection patterns
   */
  getSuspiciousWallets(threshold?: number): SelectionAnalysisResult[] {
    const results: SelectionAnalysisResult[] = [];
    const minScore = threshold ?? SUSPICION_THRESHOLDS.HIGH;

    for (const [address] of this.tradesByWallet) {
      try {
        const result = this.analyze(address);
        if (result.suspicionScore >= minScore) {
          results.push(result);
        }
      } catch {
        // Skip invalid addresses
      }
    }

    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get wallets with insider-like patterns
   */
  getInsiderLikeWallets(): SelectionAnalysisResult[] {
    const results: SelectionAnalysisResult[] = [];

    for (const [address] of this.tradesByWallet) {
      try {
        const result = this.analyze(address);
        if (result.primaryPattern === SelectionPatternType.INSIDER_LIKE) {
          results.push(result);
        }
      } catch {
        // Skip invalid addresses
      }
    }

    return results.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Get summary statistics
   */
  getSummary(): SelectionAnalyzerSummary {
    const patternDistribution = new Map<SelectionPatternType, number>();
    const suspicionDistribution = new Map<SelectionSuspicionLevel, number>();
    let totalDiversityScore = 0;
    let totalSuspicionScore = 0;
    let suspiciousCount = 0;
    let analyzedCount = 0;
    let totalTrades = 0;
    const riskFlagCounts = new Map<string, number>();

    for (const [address] of this.tradesByWallet) {
      try {
        const result = this.analyze(address);
        analyzedCount++;
        totalTrades += result.totalTrades;

        // Pattern distribution
        patternDistribution.set(
          result.primaryPattern,
          (patternDistribution.get(result.primaryPattern) || 0) + 1
        );

        // Suspicion distribution
        suspicionDistribution.set(
          result.suspicionLevel,
          (suspicionDistribution.get(result.suspicionLevel) || 0) + 1
        );

        totalDiversityScore += result.diversity.diversityScore;
        totalSuspicionScore += result.suspicionScore;

        if (result.isPotentiallySuspicious) {
          suspiciousCount++;
        }

        // Count risk flags
        result.riskFlags.forEach((flag) => {
          riskFlagCounts.set(flag, (riskFlagCounts.get(flag) || 0) + 1);
        });
      } catch {
        // Skip invalid addresses
      }
    }

    // Sort risk flags by count
    const topRiskFlags = [...riskFlagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([flag, count]) => ({ flag, count }));

    const cacheTotal = this.cacheHits + this.cacheMisses;

    return {
      totalWalletsAnalyzed: analyzedCount,
      totalTradesProcessed: totalTrades,
      patternDistribution,
      suspicionDistribution,
      avgDiversityScore: analyzedCount > 0 ? totalDiversityScore / analyzedCount : 0,
      avgSuspicionScore: analyzedCount > 0 ? totalSuspicionScore / analyzedCount : 0,
      suspiciousWalletCount: suspiciousCount,
      topRiskFlags,
      cacheStats: {
        size: this.cache.size,
        hitCount: this.cacheHits,
        missCount: this.cacheMisses,
        hitRate: cacheTotal > 0 ? this.cacheHits / cacheTotal : 0,
      },
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.emit("cacheCleared");
  }

  /**
   * Get configuration
   */
  getConfig(): Required<MarketSelectionAnalyzerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MarketSelectionAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
    this.emit("configUpdated", this.config);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new MarketSelectionAnalyzer instance
 */
export function createMarketSelectionAnalyzer(
  config?: MarketSelectionAnalyzerConfig
): MarketSelectionAnalyzer {
  return new MarketSelectionAnalyzer(config);
}

// Shared instance
let sharedInstance: MarketSelectionAnalyzer | null = null;

/**
 * Get shared MarketSelectionAnalyzer instance
 */
export function getSharedMarketSelectionAnalyzer(): MarketSelectionAnalyzer {
  if (!sharedInstance) {
    sharedInstance = new MarketSelectionAnalyzer();
  }
  return sharedInstance;
}

/**
 * Set shared MarketSelectionAnalyzer instance
 */
export function setSharedMarketSelectionAnalyzer(
  instance: MarketSelectionAnalyzer
): void {
  sharedInstance = instance;
}

/**
 * Reset shared MarketSelectionAnalyzer instance
 */
export function resetSharedMarketSelectionAnalyzer(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add trades for selection analysis
 */
export function addTradesForSelection(
  walletAddress: string,
  trades: SelectionTrade[]
): void {
  getSharedMarketSelectionAnalyzer().addTrades(walletAddress, trades);
}

/**
 * Analyze market selection for a wallet
 */
export function analyzeMarketSelection(
  walletAddress: string,
  options?: AnalyzeSelectionOptions
): SelectionAnalysisResult {
  return getSharedMarketSelectionAnalyzer().analyze(walletAddress, options);
}

/**
 * Batch analyze market selection
 */
export function batchAnalyzeMarketSelection(
  walletAddresses: string[],
  options?: AnalyzeSelectionOptions
): BatchSelectionAnalysisResult {
  return getSharedMarketSelectionAnalyzer().batchAnalyze(walletAddresses, options);
}

/**
 * Check if wallet has suspicious selection
 */
export function hasSuspiciousMarketSelection(walletAddress: string): boolean {
  return getSharedMarketSelectionAnalyzer().hasSuspiciousSelection(walletAddress);
}

/**
 * Get wallets with suspicious selection patterns
 */
export function getWalletsWithSuspiciousSelection(
  threshold?: number
): SelectionAnalysisResult[] {
  return getSharedMarketSelectionAnalyzer().getSuspiciousWallets(threshold);
}

/**
 * Get wallets with insider-like patterns
 */
export function getWalletsWithInsiderLikeSelection(): SelectionAnalysisResult[] {
  return getSharedMarketSelectionAnalyzer().getInsiderLikeWallets();
}

/**
 * Get market selection analyzer summary
 */
export function getMarketSelectionAnalyzerSummary(): SelectionAnalyzerSummary {
  return getSharedMarketSelectionAnalyzer().getSummary();
}

// ============================================================================
// Description Functions
// ============================================================================

/**
 * Get description for selection pattern type
 */
export function getSelectionPatternDescription(
  pattern: SelectionPatternType
): string {
  const descriptions: Record<SelectionPatternType, string> = {
    [SelectionPatternType.UNKNOWN]: "Insufficient data to determine pattern",
    [SelectionPatternType.DIVERSE]:
      "Trades across many different markets and categories",
    [SelectionPatternType.FOCUSED]:
      "Concentrated trading in few specific markets",
    [SelectionPatternType.SPECIALIST]:
      "Specializes in specific market category",
    [SelectionPatternType.OPPORTUNISTIC]:
      "Follows trends, news, and market opportunities",
    [SelectionPatternType.CONTRARIAN]: "Trades against popular market sentiment",
    [SelectionPatternType.MOMENTUM]: "Follows volume and price momentum",
    [SelectionPatternType.SYSTEMATIC]:
      "Regular, predictable market selection pattern",
    [SelectionPatternType.RANDOM]: "No clear pattern in market selection",
    [SelectionPatternType.INSIDER_LIKE]:
      "Suspiciously good market selection - warrants investigation",
  };
  return descriptions[pattern] || "Unknown pattern";
}

/**
 * Get description for selection preference type
 */
export function getSelectionPreferenceDescription(
  preference: SelectionPreferenceType
): string {
  const descriptions: Record<SelectionPreferenceType, string> = {
    [SelectionPreferenceType.NONE]: "No clear market preference",
    [SelectionPreferenceType.HIGH_VOLUME]: "Prefers high-volume markets",
    [SelectionPreferenceType.LOW_VOLUME]: "Prefers low-volume/thin markets",
    [SelectionPreferenceType.NEAR_RESOLUTION]:
      "Prefers markets near resolution",
    [SelectionPreferenceType.NEW_MARKETS]: "Prefers newly created markets",
    [SelectionPreferenceType.HIGH_VOLATILITY]: "Prefers volatile markets",
    [SelectionPreferenceType.LOW_VOLATILITY]: "Prefers stable markets",
    [SelectionPreferenceType.BINARY_MARKETS]: "Prefers binary outcome markets",
    [SelectionPreferenceType.MULTI_OUTCOME]:
      "Prefers multi-outcome markets",
    [SelectionPreferenceType.CATEGORY_SPECIALIST]:
      "Specializes in specific category",
    [SelectionPreferenceType.EVENT_DRIVEN]:
      "Trades around news and events",
  };
  return descriptions[preference] || "Unknown preference";
}

/**
 * Get description for suspicion level
 */
export function getSelectionSuspicionDescription(
  level: SelectionSuspicionLevel
): string {
  const descriptions: Record<SelectionSuspicionLevel, string> = {
    [SelectionSuspicionLevel.NONE]: "Normal market selection behavior",
    [SelectionSuspicionLevel.LOW]: "Slightly unusual selection patterns",
    [SelectionSuspicionLevel.MEDIUM]:
      "Notable patterns worth monitoring",
    [SelectionSuspicionLevel.HIGH]:
      "Suspicious patterns - recommend investigation",
    [SelectionSuspicionLevel.CRITICAL]:
      "Very suspicious - likely informed trading",
  };
  return descriptions[level] || "Unknown level";
}
