/**
 * DET-NICHE-008: Wallet Niche Market Concentration Analyzer
 *
 * Detects wallets focusing on specific niche market categories.
 * Analyzes trading patterns across categories to identify specialists
 * who may have domain-specific knowledge or information advantages.
 */

import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Enums
// ============================================================================

/**
 * Level of category concentration for a wallet
 */
export enum ConcentrationLevel {
  /** >80% of trades in single category - extreme specialist */
  EXTREME = "EXTREME",
  /** 60-80% of trades in single category - high specialist */
  HIGH = "HIGH",
  /** 40-60% of trades in single category - moderate specialist */
  MODERATE = "MODERATE",
  /** 20-40% of trades in single category - slight preference */
  LOW = "LOW",
  /** <20% in any single category - diversified trader */
  DIVERSIFIED = "DIVERSIFIED",
}

/**
 * Specialist classification based on trading focus
 */
export enum SpecialistType {
  /** Focused on political markets */
  POLITICAL_SPECIALIST = "POLITICAL_SPECIALIST",
  /** Focused on cryptocurrency markets */
  CRYPTO_SPECIALIST = "CRYPTO_SPECIALIST",
  /** Focused on sports markets */
  SPORTS_SPECIALIST = "SPORTS_SPECIALIST",
  /** Focused on business/economic markets */
  BUSINESS_SPECIALIST = "BUSINESS_SPECIALIST",
  /** Focused on legal/regulatory markets */
  LEGAL_SPECIALIST = "LEGAL_SPECIALIST",
  /** Focused on geopolitical markets */
  GEOPOLITICAL_SPECIALIST = "GEOPOLITICAL_SPECIALIST",
  /** Focused on health/medical markets */
  HEALTH_SPECIALIST = "HEALTH_SPECIALIST",
  /** Focused on technology markets */
  TECH_SPECIALIST = "TECH_SPECIALIST",
  /** Focused on science markets */
  SCIENCE_SPECIALIST = "SCIENCE_SPECIALIST",
  /** Focused on entertainment markets */
  ENTERTAINMENT_SPECIALIST = "ENTERTAINMENT_SPECIALIST",
  /** No clear specialization */
  GENERALIST = "GENERALIST",
  /** Focuses on multiple high-value categories */
  MULTI_SPECIALIST = "MULTI_SPECIALIST",
}

/**
 * Suspicion level based on concentration patterns
 */
export enum ConcentrationSuspicion {
  /** Very suspicious - extreme concentration in high-value categories */
  CRITICAL = "CRITICAL",
  /** Suspicious - high concentration in insider-prone categories */
  HIGH = "HIGH",
  /** Moderate - notable but not alarming concentration */
  MEDIUM = "MEDIUM",
  /** Low - normal trading patterns */
  LOW = "LOW",
  /** Minimal - typical diversified trader */
  MINIMAL = "MINIMAL",
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Trade data for concentration analysis
 */
export interface TradeForConcentration {
  /** Unique trade identifier */
  tradeId: string;
  /** Market identifier */
  marketId: string;
  /** Market category */
  category: MarketCategory;
  /** Trade size in USD */
  size: number;
  /** Trade timestamp */
  timestamp: Date;
  /** Optional market question for additional context */
  marketQuestion?: string;
}

/**
 * Category statistics for a wallet
 */
export interface CategoryStats {
  /** Market category */
  category: MarketCategory;
  /** Number of trades in this category */
  tradeCount: number;
  /** Percentage of total trades */
  tradePercentage: number;
  /** Total volume in this category */
  totalVolume: number;
  /** Percentage of total volume */
  volumePercentage: number;
  /** Average trade size in this category */
  avgTradeSize: number;
  /** Number of unique markets traded */
  uniqueMarkets: number;
  /** First trade in this category */
  firstTradeAt: Date;
  /** Last trade in this category */
  lastTradeAt: Date;
}

/**
 * Concentration analysis result for a wallet
 */
export interface WalletConcentrationResult {
  /** Wallet address */
  walletAddress: string;
  /** Overall concentration level */
  concentrationLevel: ConcentrationLevel;
  /** Concentration score (0-100, higher = more concentrated) */
  concentrationScore: number;
  /** Herfindahl-Hirschman Index for category concentration */
  herfindahlIndex: number;
  /** Specialist type classification */
  specialistType: SpecialistType;
  /** Suspicion level based on concentration patterns */
  suspicionLevel: ConcentrationSuspicion;
  /** Primary category (highest concentration) */
  primaryCategory: MarketCategory | null;
  /** Secondary category if applicable */
  secondaryCategory: MarketCategory | null;
  /** Breakdown by category */
  categoryBreakdown: CategoryStats[];
  /** Total number of trades analyzed */
  totalTrades: number;
  /** Total volume traded */
  totalVolume: number;
  /** Number of unique categories traded */
  uniqueCategories: number;
  /** Number of unique markets traded */
  uniqueMarkets: number;
  /** Whether this wallet is flagged as a specialist */
  isSpecialist: boolean;
  /** Reasons for flagging (if flagged) */
  flagReasons: string[];
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Whether result is from cache */
  fromCache: boolean;
}

/**
 * Options for concentration analysis
 */
export interface ConcentrationAnalysisOptions {
  /** Minimum number of trades to analyze (default: 5) */
  minTrades?: number;
  /** Time window for analysis in days (default: 90) */
  timeWindowDays?: number;
  /** Categories considered high-value for insider potential */
  highValueCategories?: MarketCategory[];
  /** Threshold for flagging as specialist (default: 50%) */
  specialistThreshold?: number;
  /** Bypass cache */
  bypassCache?: boolean;
}

/**
 * Batch analysis result
 */
export interface BatchConcentrationResult {
  /** Results by wallet address */
  results: Map<string, WalletConcentrationResult>;
  /** Errors by wallet address */
  errors: Map<string, string>;
  /** Total wallets processed */
  totalProcessed: number;
  /** Successful analyses */
  successCount: number;
  /** Failed analyses */
  errorCount: number;
  /** Wallets flagged as specialists */
  specialistsFound: string[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for concentration analysis
 */
export interface ConcentrationSummary {
  /** Total wallets analyzed */
  totalWalletsAnalyzed: number;
  /** Number of specialists found */
  specialistsCount: number;
  /** Breakdown by specialist type */
  specialistTypeBreakdown: Map<SpecialistType, number>;
  /** Breakdown by concentration level */
  concentrationLevelBreakdown: Map<ConcentrationLevel, number>;
  /** Breakdown by suspicion level */
  suspicionLevelBreakdown: Map<ConcentrationSuspicion, number>;
  /** Average concentration score */
  averageConcentrationScore: number;
  /** Most common primary categories */
  topPrimaryCategories: Array<{ category: MarketCategory; count: number }>;
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
  };
}

/**
 * Configuration for the analyzer
 */
export interface WalletConcentrationAnalyzerConfig {
  /** Cache TTL in milliseconds (default: 30 minutes) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 5000) */
  maxCacheSize?: number;
  /** Default minimum trades for analysis */
  defaultMinTrades?: number;
  /** Default time window in days */
  defaultTimeWindowDays?: number;
  /** Default specialist threshold */
  defaultSpecialistThreshold?: number;
  /** High-value categories for insider detection */
  highValueCategories?: MarketCategory[];
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  result: WalletConcentrationResult;
  expiresAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default high-value categories where insider information is most valuable
 */
export const DEFAULT_HIGH_VALUE_CATEGORIES: MarketCategory[] = [
  MarketCategory.POLITICS,
  MarketCategory.LEGAL,
  MarketCategory.HEALTH,
  MarketCategory.GEOPOLITICS,
  MarketCategory.BUSINESS,
  MarketCategory.ECONOMY,
];

/**
 * Category to specialist type mapping
 */
const CATEGORY_TO_SPECIALIST: Record<MarketCategory, SpecialistType> = {
  [MarketCategory.POLITICS]: SpecialistType.POLITICAL_SPECIALIST,
  [MarketCategory.CRYPTO]: SpecialistType.CRYPTO_SPECIALIST,
  [MarketCategory.SPORTS]: SpecialistType.SPORTS_SPECIALIST,
  [MarketCategory.TECH]: SpecialistType.TECH_SPECIALIST,
  [MarketCategory.BUSINESS]: SpecialistType.BUSINESS_SPECIALIST,
  [MarketCategory.SCIENCE]: SpecialistType.SCIENCE_SPECIALIST,
  [MarketCategory.ENTERTAINMENT]: SpecialistType.ENTERTAINMENT_SPECIALIST,
  [MarketCategory.WEATHER]: SpecialistType.GENERALIST, // Weather has no specialist type
  [MarketCategory.GEOPOLITICS]: SpecialistType.GEOPOLITICAL_SPECIALIST,
  [MarketCategory.LEGAL]: SpecialistType.LEGAL_SPECIALIST,
  [MarketCategory.HEALTH]: SpecialistType.HEALTH_SPECIALIST,
  [MarketCategory.ECONOMY]: SpecialistType.BUSINESS_SPECIALIST, // Economy grouped with business
  [MarketCategory.CULTURE]: SpecialistType.ENTERTAINMENT_SPECIALIST, // Culture grouped with entertainment
  [MarketCategory.OTHER]: SpecialistType.GENERALIST,
};

/**
 * Concentration level thresholds
 */
const CONCENTRATION_THRESHOLDS = {
  EXTREME: 80,
  HIGH: 60,
  MODERATE: 40,
  LOW: 20,
};

/**
 * Suspicion score weights by category
 */
const CATEGORY_SUSPICION_WEIGHTS: Record<MarketCategory, number> = {
  [MarketCategory.POLITICS]: 1.0,
  [MarketCategory.LEGAL]: 1.0,
  [MarketCategory.HEALTH]: 0.9,
  [MarketCategory.GEOPOLITICS]: 0.9,
  [MarketCategory.BUSINESS]: 0.8,
  [MarketCategory.ECONOMY]: 0.8,
  [MarketCategory.CRYPTO]: 0.6,
  [MarketCategory.TECH]: 0.6,
  [MarketCategory.SCIENCE]: 0.5,
  [MarketCategory.ENTERTAINMENT]: 0.3,
  [MarketCategory.SPORTS]: 0.2,
  [MarketCategory.CULTURE]: 0.3,
  [MarketCategory.WEATHER]: 0.1,
  [MarketCategory.OTHER]: 0.2,
};

// ============================================================================
// Main Class
// ============================================================================

/**
 * Wallet Niche Market Concentration Analyzer
 *
 * Analyzes wallet trading patterns to detect category specialists
 * who may have domain-specific knowledge or information advantages.
 */
export class WalletConcentrationAnalyzer {
  private config: Required<WalletConcentrationAnalyzerConfig>;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private tradesByWallet: Map<string, TradeForConcentration[]> = new Map();

  constructor(config: WalletConcentrationAnalyzerConfig = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? 30 * 60 * 1000, // 30 minutes
      maxCacheSize: config.maxCacheSize ?? 5000,
      defaultMinTrades: config.defaultMinTrades ?? 5,
      defaultTimeWindowDays: config.defaultTimeWindowDays ?? 90,
      defaultSpecialistThreshold: config.defaultSpecialistThreshold ?? 50,
      highValueCategories: config.highValueCategories ?? DEFAULT_HIGH_VALUE_CATEGORIES,
    };
  }

  // ==========================================================================
  // Trade Data Management
  // ==========================================================================

  /**
   * Add trades for a wallet for analysis
   *
   * @param walletAddress - Wallet address
   * @param trades - Array of trades
   */
  addTrades(walletAddress: string, trades: TradeForConcentration[]): void {
    const normalizedAddress = walletAddress.toLowerCase();
    const existingTrades = this.tradesByWallet.get(normalizedAddress) ?? [];

    // Add new trades, avoiding duplicates by tradeId
    const existingIds = new Set(existingTrades.map(t => t.tradeId));
    const newTrades = trades.filter(t => !existingIds.has(t.tradeId));

    this.tradesByWallet.set(normalizedAddress, [...existingTrades, ...newTrades]);

    // Invalidate cache for this wallet
    this.cache.delete(normalizedAddress);
  }

  /**
   * Get trades for a wallet
   *
   * @param walletAddress - Wallet address
   * @returns Array of trades or empty array
   */
  getTrades(walletAddress: string): TradeForConcentration[] {
    const normalizedAddress = walletAddress.toLowerCase();
    return this.tradesByWallet.get(normalizedAddress) ?? [];
  }

  /**
   * Clear trades for a wallet
   *
   * @param walletAddress - Wallet address
   */
  clearTrades(walletAddress: string): void {
    const normalizedAddress = walletAddress.toLowerCase();
    this.tradesByWallet.delete(normalizedAddress);
    this.cache.delete(normalizedAddress);
  }

  // ==========================================================================
  // Analysis Methods
  // ==========================================================================

  /**
   * Analyze wallet concentration across market categories
   *
   * @param walletAddress - Wallet address to analyze
   * @param trades - Optional trades array (uses stored trades if not provided)
   * @param options - Analysis options
   * @returns Concentration analysis result
   */
  analyze(
    walletAddress: string,
    trades?: TradeForConcentration[],
    options: ConcentrationAnalysisOptions = {}
  ): WalletConcentrationResult {
    const normalizedAddress = walletAddress.toLowerCase();
    const {
      minTrades = this.config.defaultMinTrades,
      timeWindowDays = this.config.defaultTimeWindowDays,
      highValueCategories = this.config.highValueCategories,
      specialistThreshold = this.config.defaultSpecialistThreshold,
      bypassCache = false,
    } = options;

    // Check cache
    if (!bypassCache) {
      const cached = this.getFromCache(normalizedAddress);
      if (cached) {
        return cached;
      }
    }

    // Get trades to analyze
    let tradesToAnalyze = trades ?? this.getTrades(normalizedAddress);

    // Filter by time window
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
    tradesToAnalyze = tradesToAnalyze.filter(
      t => t.timestamp >= cutoffDate
    );

    // Handle insufficient data
    if (tradesToAnalyze.length < minTrades) {
      const result = this.createEmptyResult(normalizedAddress);
      this.addToCache(normalizedAddress, result);
      return { ...result, fromCache: false };
    }

    // Calculate category statistics
    const categoryBreakdown = this.calculateCategoryStats(tradesToAnalyze);
    const totalTrades = tradesToAnalyze.length;
    const totalVolume = tradesToAnalyze.reduce((sum, t) => sum + t.size, 0);
    const uniqueMarkets = new Set(tradesToAnalyze.map(t => t.marketId)).size;
    const uniqueCategories = categoryBreakdown.length;

    // Calculate concentration metrics
    const herfindahlIndex = this.calculateHerfindahlIndex(categoryBreakdown);
    const concentrationScore = this.calculateConcentrationScore(
      categoryBreakdown,
      herfindahlIndex
    );
    const concentrationLevel = this.getConcentrationLevel(
      categoryBreakdown[0]?.tradePercentage ?? 0
    );

    // Determine primary and secondary categories
    const primaryCategory = categoryBreakdown[0]?.category ?? null;
    const secondaryCategory = categoryBreakdown[1]?.category ?? null;

    // Determine specialist type
    const specialistType = this.determineSpecialistType(
      categoryBreakdown,
      specialistThreshold
    );
    const isSpecialist = specialistType !== SpecialistType.GENERALIST;

    // Calculate suspicion level
    const suspicionLevel = this.calculateSuspicionLevel(
      categoryBreakdown,
      concentrationScore,
      highValueCategories
    );

    // Generate flag reasons
    const flagReasons = this.generateFlagReasons(
      categoryBreakdown,
      concentrationLevel,
      suspicionLevel,
      highValueCategories
    );

    const result: WalletConcentrationResult = {
      walletAddress: normalizedAddress,
      concentrationLevel,
      concentrationScore,
      herfindahlIndex,
      specialistType,
      suspicionLevel,
      primaryCategory,
      secondaryCategory,
      categoryBreakdown,
      totalTrades,
      totalVolume,
      uniqueCategories,
      uniqueMarkets,
      isSpecialist,
      flagReasons,
      analyzedAt: new Date(),
      fromCache: false,
    };

    this.addToCache(normalizedAddress, result);
    return result;
  }

  /**
   * Analyze multiple wallets in batch
   *
   * @param walletAddresses - Array of wallet addresses
   * @param options - Analysis options
   * @returns Batch analysis result
   */
  analyzeBatch(
    walletAddresses: string[],
    options: ConcentrationAnalysisOptions = {}
  ): BatchConcentrationResult {
    const startTime = Date.now();
    const results = new Map<string, WalletConcentrationResult>();
    const errors = new Map<string, string>();
    const specialistsFound: string[] = [];

    for (const address of walletAddresses) {
      try {
        const result = this.analyze(address, undefined, options);
        results.set(address.toLowerCase(), result);
        if (result.isSpecialist) {
          specialistsFound.push(address.toLowerCase());
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.set(address.toLowerCase(), errorMessage);
      }
    }

    return {
      results,
      errors,
      totalProcessed: walletAddresses.length,
      successCount: results.size,
      errorCount: errors.size,
      specialistsFound,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Check if a wallet is a specialist in a specific category
   *
   * @param walletAddress - Wallet address
   * @param category - Category to check
   * @returns True if specialist in this category
   */
  isSpecialistInCategory(
    walletAddress: string,
    category: MarketCategory
  ): boolean {
    const result = this.analyze(walletAddress);
    if (!result.isSpecialist) return false;
    return result.primaryCategory === category;
  }

  /**
   * Check if a wallet has high concentration
   *
   * @param walletAddress - Wallet address
   * @param minConcentration - Minimum concentration percentage (default: 50)
   * @returns True if concentration exceeds threshold
   */
  hasHighConcentration(
    walletAddress: string,
    minConcentration = 50
  ): boolean {
    const result = this.analyze(walletAddress);
    const primaryPercentage = result.categoryBreakdown[0]?.tradePercentage ?? 0;
    return primaryPercentage >= minConcentration;
  }

  /**
   * Get specialists in a specific category
   *
   * @param category - Category to search
   * @returns Array of wallet addresses that are specialists
   */
  getSpecialistsInCategory(category: MarketCategory): string[] {
    const specialists: string[] = [];

    for (const [address] of this.tradesByWallet) {
      const result = this.analyze(address);
      if (result.isSpecialist && result.primaryCategory === category) {
        specialists.push(address);
      }
    }

    return specialists;
  }

  /**
   * Get all flagged wallets (high suspicion level)
   *
   * @param minSuspicion - Minimum suspicion level (default: MEDIUM)
   * @returns Array of wallet addresses with suspicion
   */
  getFlaggedWallets(
    minSuspicion: ConcentrationSuspicion = ConcentrationSuspicion.MEDIUM
  ): string[] {
    const suspicionOrder = [
      ConcentrationSuspicion.MINIMAL,
      ConcentrationSuspicion.LOW,
      ConcentrationSuspicion.MEDIUM,
      ConcentrationSuspicion.HIGH,
      ConcentrationSuspicion.CRITICAL,
    ];
    const minIndex = suspicionOrder.indexOf(minSuspicion);
    const flagged: string[] = [];

    for (const [address] of this.tradesByWallet) {
      const result = this.analyze(address);
      const resultIndex = suspicionOrder.indexOf(result.suspicionLevel);
      if (resultIndex >= minIndex) {
        flagged.push(address);
      }
    }

    return flagged;
  }

  /**
   * Get concentration score for a wallet
   *
   * @param walletAddress - Wallet address
   * @returns Concentration score (0-100)
   */
  getConcentrationScore(walletAddress: string): number {
    const result = this.analyze(walletAddress);
    return result.concentrationScore;
  }

  // ==========================================================================
  // Summary Methods
  // ==========================================================================

  /**
   * Get summary statistics across all analyzed wallets
   *
   * @returns Summary statistics
   */
  getSummary(): ConcentrationSummary {
    const specialistTypeBreakdown = new Map<SpecialistType, number>();
    const concentrationLevelBreakdown = new Map<ConcentrationLevel, number>();
    const suspicionLevelBreakdown = new Map<ConcentrationSuspicion, number>();
    const categoryCount = new Map<MarketCategory, number>();

    let totalScore = 0;
    let specialistsCount = 0;
    let analyzedCount = 0;

    for (const [address] of this.tradesByWallet) {
      const result = this.analyze(address);
      analyzedCount++;
      totalScore += result.concentrationScore;

      // Count specialists
      if (result.isSpecialist) {
        specialistsCount++;
      }

      // Count by specialist type
      const currentSpecialistCount = specialistTypeBreakdown.get(result.specialistType) ?? 0;
      specialistTypeBreakdown.set(result.specialistType, currentSpecialistCount + 1);

      // Count by concentration level
      const currentLevelCount = concentrationLevelBreakdown.get(result.concentrationLevel) ?? 0;
      concentrationLevelBreakdown.set(result.concentrationLevel, currentLevelCount + 1);

      // Count by suspicion level
      const currentSuspicionCount = suspicionLevelBreakdown.get(result.suspicionLevel) ?? 0;
      suspicionLevelBreakdown.set(result.suspicionLevel, currentSuspicionCount + 1);

      // Count primary categories
      if (result.primaryCategory) {
        const currentCategoryCount = categoryCount.get(result.primaryCategory) ?? 0;
        categoryCount.set(result.primaryCategory, currentCategoryCount + 1);
      }
    }

    // Sort categories by count
    const topPrimaryCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      totalWalletsAnalyzed: analyzedCount,
      specialistsCount,
      specialistTypeBreakdown,
      concentrationLevelBreakdown,
      suspicionLevelBreakdown,
      averageConcentrationScore: analyzedCount > 0 ? totalScore / analyzedCount : 0,
      topPrimaryCategories,
      cacheStats: {
        size: this.cache.size,
        hitRate,
      },
    };
  }

  /**
   * Clear all data and caches
   */
  clear(): void {
    this.cache.clear();
    this.tradesByWallet.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private calculateCategoryStats(
    trades: TradeForConcentration[]
  ): CategoryStats[] {
    const categoryMap = new Map<MarketCategory, {
      trades: TradeForConcentration[];
      markets: Set<string>;
    }>();

    // Group trades by category
    for (const trade of trades) {
      const existing = categoryMap.get(trade.category);
      if (existing) {
        existing.trades.push(trade);
        existing.markets.add(trade.marketId);
      } else {
        categoryMap.set(trade.category, {
          trades: [trade],
          markets: new Set([trade.marketId]),
        });
      }
    }

    const totalTrades = trades.length;
    const totalVolume = trades.reduce((sum, t) => sum + t.size, 0);

    // Calculate stats for each category
    const stats: CategoryStats[] = [];
    for (const [category, data] of categoryMap) {
      const categoryVolume = data.trades.reduce((sum, t) => sum + t.size, 0);
      const timestamps = data.trades.map(t => t.timestamp);

      stats.push({
        category,
        tradeCount: data.trades.length,
        tradePercentage: (data.trades.length / totalTrades) * 100,
        totalVolume: categoryVolume,
        volumePercentage: totalVolume > 0 ? (categoryVolume / totalVolume) * 100 : 0,
        avgTradeSize: categoryVolume / data.trades.length,
        uniqueMarkets: data.markets.size,
        firstTradeAt: new Date(Math.min(...timestamps.map(t => t.getTime()))),
        lastTradeAt: new Date(Math.max(...timestamps.map(t => t.getTime()))),
      });
    }

    // Sort by trade percentage descending
    return stats.sort((a, b) => b.tradePercentage - a.tradePercentage);
  }

  private calculateHerfindahlIndex(categoryBreakdown: CategoryStats[]): number {
    // Sum of squared market shares (as decimals)
    let hhi = 0;
    for (const stats of categoryBreakdown) {
      const share = stats.tradePercentage / 100;
      hhi += share * share;
    }
    return hhi;
  }

  private calculateConcentrationScore(
    categoryBreakdown: CategoryStats[],
    hhi: number
  ): number {
    // Score based on HHI and primary category dominance
    // HHI ranges from 1/N (perfect competition) to 1 (monopoly)
    // For 14 categories, minimum HHI would be ~0.071

    const primaryShare = categoryBreakdown[0]?.tradePercentage ?? 0;

    // Normalize HHI to 0-100 scale
    // Assuming 14 categories, min HHI = 0.071
    const minHHI = 1 / 14;
    const normalizedHHI = ((hhi - minHHI) / (1 - minHHI)) * 100;

    // Combine HHI with primary category dominance
    const score = (normalizedHHI * 0.4) + (primaryShare * 0.6);

    return Math.min(100, Math.max(0, score));
  }

  private getConcentrationLevel(primaryPercentage: number): ConcentrationLevel {
    if (primaryPercentage >= CONCENTRATION_THRESHOLDS.EXTREME) {
      return ConcentrationLevel.EXTREME;
    }
    if (primaryPercentage >= CONCENTRATION_THRESHOLDS.HIGH) {
      return ConcentrationLevel.HIGH;
    }
    if (primaryPercentage >= CONCENTRATION_THRESHOLDS.MODERATE) {
      return ConcentrationLevel.MODERATE;
    }
    if (primaryPercentage >= CONCENTRATION_THRESHOLDS.LOW) {
      return ConcentrationLevel.LOW;
    }
    return ConcentrationLevel.DIVERSIFIED;
  }

  private determineSpecialistType(
    categoryBreakdown: CategoryStats[],
    threshold: number
  ): SpecialistType {
    if (categoryBreakdown.length === 0) {
      return SpecialistType.GENERALIST;
    }

    const primaryStats = categoryBreakdown[0];
    const secondaryStats = categoryBreakdown[1];

    // Ensure we have primary stats (already checked length > 0)
    if (!primaryStats) {
      return SpecialistType.GENERALIST;
    }

    // Check for multi-specialist (two categories both above threshold)
    if (
      secondaryStats &&
      primaryStats.tradePercentage >= threshold &&
      secondaryStats.tradePercentage >= threshold * 0.5
    ) {
      return SpecialistType.MULTI_SPECIALIST;
    }

    // Check for single category specialist
    if (primaryStats.tradePercentage >= threshold) {
      return CATEGORY_TO_SPECIALIST[primaryStats.category] ?? SpecialistType.GENERALIST;
    }

    return SpecialistType.GENERALIST;
  }

  private calculateSuspicionLevel(
    categoryBreakdown: CategoryStats[],
    concentrationScore: number,
    highValueCategories: MarketCategory[]
  ): ConcentrationSuspicion {
    if (categoryBreakdown.length === 0) {
      return ConcentrationSuspicion.MINIMAL;
    }

    // Calculate weighted suspicion based on concentration in high-value categories
    let weightedScore = 0;
    for (const stats of categoryBreakdown) {
      const categoryWeight = CATEGORY_SUSPICION_WEIGHTS[stats.category];
      const isHighValue = highValueCategories.includes(stats.category);
      const boost = isHighValue ? 1.5 : 1.0;
      weightedScore += (stats.tradePercentage / 100) * categoryWeight * boost;
    }

    // Combine with concentration score
    const finalScore = (weightedScore * 50) + (concentrationScore * 0.5);

    if (finalScore >= 80) return ConcentrationSuspicion.CRITICAL;
    if (finalScore >= 60) return ConcentrationSuspicion.HIGH;
    if (finalScore >= 40) return ConcentrationSuspicion.MEDIUM;
    if (finalScore >= 20) return ConcentrationSuspicion.LOW;
    return ConcentrationSuspicion.MINIMAL;
  }

  private generateFlagReasons(
    categoryBreakdown: CategoryStats[],
    level: ConcentrationLevel,
    suspicion: ConcentrationSuspicion,
    highValueCategories: MarketCategory[]
  ): string[] {
    const reasons: string[] = [];

    if (categoryBreakdown.length === 0) {
      return reasons;
    }

    const primaryStats = categoryBreakdown[0];

    // Ensure we have primary stats (already checked length > 0)
    if (!primaryStats) {
      return reasons;
    }

    // Flag extreme concentration
    if (level === ConcentrationLevel.EXTREME) {
      reasons.push(
        `Extreme concentration: ${primaryStats.tradePercentage.toFixed(1)}% of trades in ${primaryStats.category}`
      );
    } else if (level === ConcentrationLevel.HIGH) {
      reasons.push(
        `High concentration: ${primaryStats.tradePercentage.toFixed(1)}% of trades in ${primaryStats.category}`
      );
    }

    // Flag high-value category focus
    if (highValueCategories.includes(primaryStats.category)) {
      reasons.push(
        `Primary focus on high-value category: ${primaryStats.category}`
      );
    }

    // Flag critical suspicion
    if (suspicion === ConcentrationSuspicion.CRITICAL) {
      reasons.push("Critical suspicion level due to concentration in insider-prone categories");
    } else if (suspicion === ConcentrationSuspicion.HIGH) {
      reasons.push("High suspicion level due to trading pattern");
    }

    // Flag volume concentration
    if (primaryStats.volumePercentage > 70) {
      reasons.push(
        `Volume concentration: ${primaryStats.volumePercentage.toFixed(1)}% of volume in ${primaryStats.category}`
      );
    }

    return reasons;
  }

  private createEmptyResult(walletAddress: string): WalletConcentrationResult {
    return {
      walletAddress,
      concentrationLevel: ConcentrationLevel.DIVERSIFIED,
      concentrationScore: 0,
      herfindahlIndex: 0,
      specialistType: SpecialistType.GENERALIST,
      suspicionLevel: ConcentrationSuspicion.MINIMAL,
      primaryCategory: null,
      secondaryCategory: null,
      categoryBreakdown: [],
      totalTrades: 0,
      totalVolume: 0,
      uniqueCategories: 0,
      uniqueMarkets: 0,
      isSpecialist: false,
      flagReasons: [],
      analyzedAt: new Date(),
      fromCache: false,
    };
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private getFromCache(key: string): WalletConcentrationResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return { ...entry.result, fromCache: true };
  }

  private addToCache(key: string, result: WalletConcentrationResult): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }
}

// ============================================================================
// Shared Instance Management
// ============================================================================

let sharedInstance: WalletConcentrationAnalyzer | null = null;

/**
 * Create a new WalletConcentrationAnalyzer instance
 *
 * @param config - Configuration options
 * @returns New analyzer instance
 */
export function createWalletConcentrationAnalyzer(
  config?: WalletConcentrationAnalyzerConfig
): WalletConcentrationAnalyzer {
  return new WalletConcentrationAnalyzer(config);
}

/**
 * Get the shared WalletConcentrationAnalyzer instance
 *
 * @returns Shared analyzer instance
 */
export function getSharedWalletConcentrationAnalyzer(): WalletConcentrationAnalyzer {
  if (!sharedInstance) {
    sharedInstance = new WalletConcentrationAnalyzer();
  }
  return sharedInstance;
}

/**
 * Set the shared WalletConcentrationAnalyzer instance
 *
 * @param instance - Analyzer instance to use as shared
 */
export function setSharedWalletConcentrationAnalyzer(
  instance: WalletConcentrationAnalyzer
): void {
  sharedInstance = instance;
}

/**
 * Reset the shared WalletConcentrationAnalyzer instance
 */
export function resetSharedWalletConcentrationAnalyzer(): void {
  if (sharedInstance) {
    sharedInstance.clear();
  }
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add trades for concentration analysis
 *
 * @param walletAddress - Wallet address
 * @param trades - Array of trades
 */
export function addTradesForConcentration(
  walletAddress: string,
  trades: TradeForConcentration[]
): void {
  getSharedWalletConcentrationAnalyzer().addTrades(walletAddress, trades);
}

/**
 * Analyze wallet concentration across market categories
 *
 * @param walletAddress - Wallet address to analyze
 * @param trades - Optional trades array
 * @param options - Analysis options
 * @returns Concentration analysis result
 */
export function analyzeWalletConcentration(
  walletAddress: string,
  trades?: TradeForConcentration[],
  options?: ConcentrationAnalysisOptions
): WalletConcentrationResult {
  return getSharedWalletConcentrationAnalyzer().analyze(walletAddress, trades, options);
}

/**
 * Analyze multiple wallets in batch
 *
 * @param walletAddresses - Array of wallet addresses
 * @param options - Analysis options
 * @returns Batch analysis result
 */
export function batchAnalyzeWalletConcentration(
  walletAddresses: string[],
  options?: ConcentrationAnalysisOptions
): BatchConcentrationResult {
  return getSharedWalletConcentrationAnalyzer().analyzeBatch(walletAddresses, options);
}

/**
 * Check if a wallet is a specialist in a specific category
 *
 * @param walletAddress - Wallet address
 * @param category - Category to check
 * @returns True if specialist in this category
 */
export function isWalletSpecialist(
  walletAddress: string,
  category: MarketCategory
): boolean {
  return getSharedWalletConcentrationAnalyzer().isSpecialistInCategory(
    walletAddress,
    category
  );
}

/**
 * Check if a wallet has high concentration
 *
 * @param walletAddress - Wallet address
 * @param minConcentration - Minimum concentration percentage
 * @returns True if concentration exceeds threshold
 */
export function hasHighWalletConcentration(
  walletAddress: string,
  minConcentration = 50
): boolean {
  return getSharedWalletConcentrationAnalyzer().hasHighConcentration(
    walletAddress,
    minConcentration
  );
}

/**
 * Get all specialists in a category
 *
 * @param category - Category to search
 * @returns Array of wallet addresses
 */
export function getCategorySpecialists(category: MarketCategory): string[] {
  return getSharedWalletConcentrationAnalyzer().getSpecialistsInCategory(category);
}

/**
 * Get flagged wallets with high suspicion
 *
 * @param minSuspicion - Minimum suspicion level
 * @returns Array of wallet addresses
 */
export function getSuspiciousWallets(
  minSuspicion?: ConcentrationSuspicion
): string[] {
  return getSharedWalletConcentrationAnalyzer().getFlaggedWallets(minSuspicion);
}

/**
 * Get concentration score for a wallet
 *
 * @param walletAddress - Wallet address
 * @returns Concentration score (0-100)
 */
export function getWalletConcentrationScore(walletAddress: string): number {
  return getSharedWalletConcentrationAnalyzer().getConcentrationScore(walletAddress);
}

/**
 * Get summary statistics
 *
 * @returns Concentration summary
 */
export function getConcentrationAnalysisSummary(): ConcentrationSummary {
  return getSharedWalletConcentrationAnalyzer().getSummary();
}
