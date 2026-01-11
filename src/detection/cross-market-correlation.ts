/**
 * DET-NICHE-009: Cross-Market Correlation Detector
 *
 * Detects correlated trading activity across related niche markets.
 * This module identifies wallets or groups of wallets that trade in
 * correlated patterns across related markets, which may indicate:
 * - Coordinated trading activity
 * - Information-based trading across related outcomes
 * - Arbitrage or hedging strategies
 * - Potential manipulation across market pairs
 */

import { EventEmitter } from "events";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Enums
// ============================================================================

/**
 * How markets are considered related
 */
export enum MarketRelationType {
  /** Markets share the same topic/event */
  SAME_TOPIC = "SAME_TOPIC",
  /** Markets are in the same category */
  SAME_CATEGORY = "SAME_CATEGORY",
  /** Markets have explicit opposing outcomes */
  OPPOSING = "OPPOSING",
  /** Markets are complementary (e.g., election + policy) */
  COMPLEMENTARY = "COMPLEMENTARY",
  /** Markets share keywords/entities */
  KEYWORD_OVERLAP = "KEYWORD_OVERLAP",
  /** Markets are temporally related (happen around same time) */
  TEMPORAL = "TEMPORAL",
  /** Custom/manually linked markets */
  CUSTOM = "CUSTOM",
}

/**
 * Type of correlation pattern detected
 */
export enum CorrelationType {
  /** Same direction trades (both buy or both sell) */
  POSITIVE = "POSITIVE",
  /** Opposite direction trades (buy one, sell other) */
  NEGATIVE = "NEGATIVE",
  /** Sequential trading (first one then the other) */
  SEQUENTIAL = "SEQUENTIAL",
  /** Simultaneous trading within a short window */
  SIMULTANEOUS = "SIMULTANEOUS",
  /** Volume correlation (similar volumes in both) */
  VOLUME = "VOLUME",
  /** Mixed signals */
  MIXED = "MIXED",
}

/**
 * Severity of the correlation
 */
export enum CorrelationSeverity {
  /** Low - minor correlation detected */
  LOW = "LOW",
  /** Medium - notable correlation patterns */
  MEDIUM = "MEDIUM",
  /** High - significant correlated activity */
  HIGH = "HIGH",
  /** Critical - very suspicious coordination */
  CRITICAL = "CRITICAL",
}

/**
 * Status of correlation monitoring
 */
export enum CorrelationStatus {
  /** Active - currently being monitored */
  ACTIVE = "ACTIVE",
  /** Resolved - correlation ended naturally */
  RESOLVED = "RESOLVED",
  /** Flagged - marked for investigation */
  FLAGGED = "FLAGGED",
  /** Dismissed - reviewed and cleared */
  DISMISSED = "DISMISSED",
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Trade data for correlation analysis
 */
export interface CorrelationTrade {
  /** Unique trade identifier */
  tradeId: string;
  /** Market identifier */
  marketId: string;
  /** Wallet address */
  walletAddress: string;
  /** Trade side */
  side: "BUY" | "SELL";
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade timestamp in milliseconds */
  timestamp: number;
  /** Optional market category */
  category?: MarketCategory;
  /** Optional market question for keyword matching */
  marketQuestion?: string;
}

/**
 * Definition of a related market pair
 */
export interface MarketRelation {
  /** First market ID */
  marketIdA: string;
  /** Second market ID */
  marketIdB: string;
  /** Type of relation */
  relationType: MarketRelationType;
  /** Strength of relation (0-1) */
  strength: number;
  /** Shared keywords if applicable */
  sharedKeywords?: string[];
  /** Category of related markets */
  category?: MarketCategory;
  /** When this relation was established */
  createdAt: Date;
  /** Optional notes */
  notes?: string;
}

/**
 * Cross-market trade pair for correlation analysis
 */
export interface CrossMarketTradePair {
  /** Trade in market A */
  tradeA: CorrelationTrade;
  /** Trade in market B */
  tradeB: CorrelationTrade;
  /** Time difference in milliseconds */
  timeDifferenceMs: number;
  /** Whether trades are in same direction */
  sameDirection: boolean;
  /** Volume ratio (smaller/larger) */
  volumeRatio: number;
}

/**
 * A detected cross-market correlation
 */
export interface CrossMarketCorrelation {
  /** Unique correlation ID */
  correlationId: string;
  /** Related market pair */
  marketIdA: string;
  /** Related market pair */
  marketIdB: string;
  /** Relation between markets */
  relationType: MarketRelationType;
  /** Type of correlation */
  correlationType: CorrelationType;
  /** Severity level */
  severity: CorrelationSeverity;
  /** Status */
  status: CorrelationStatus;
  /** Wallets involved */
  walletAddresses: string[];
  /** Number of unique wallets */
  walletCount: number;
  /** Trade pairs that form this correlation */
  tradePairs: CrossMarketTradePair[];
  /** Total trades in market A */
  tradesInMarketA: number;
  /** Total trades in market B */
  tradesInMarketB: number;
  /** Total volume in market A */
  volumeMarketA: number;
  /** Total volume in market B */
  volumeMarketB: number;
  /** Correlation score (0-100) */
  correlationScore: number;
  /** Pearson correlation coefficient (-1 to 1) */
  pearsonCoefficient: number;
  /** Average time between paired trades (ms) */
  avgTimeBetweenTradesMs: number;
  /** Time window analyzed (ms) */
  analysisWindowMs: number;
  /** First correlated trade timestamp */
  startTime: Date;
  /** Last correlated trade timestamp */
  endTime: Date;
  /** Detection timestamp */
  detectedAt: Date;
  /** Reasons for flagging */
  flagReasons: string[];
}

/**
 * Result from correlation analysis
 */
export interface CorrelationAnalysisResult {
  /** Market pair analyzed */
  marketIdA: string;
  marketIdB: string;
  /** Whether significant correlation was found */
  hasCorrelation: boolean;
  /** Detected correlation if any */
  correlation: CrossMarketCorrelation | null;
  /** Total trades analyzed in market A */
  totalTradesA: number;
  /** Total trades analyzed in market B */
  totalTradesB: number;
  /** Wallets that traded in both markets */
  overlappingWallets: string[];
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Batch correlation analysis result
 */
export interface BatchCorrelationResult {
  /** Results by market pair */
  results: Map<string, CorrelationAnalysisResult>;
  /** All detected correlations */
  correlations: CrossMarketCorrelation[];
  /** Total market pairs analyzed */
  totalPairsAnalyzed: number;
  /** Total correlations detected */
  totalCorrelationsFound: number;
  /** By severity */
  bySeverity: Record<CorrelationSeverity, number>;
  /** By correlation type */
  byCorrelationType: Record<CorrelationType, number>;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Summary statistics
 */
export interface CorrelationSummary {
  /** Total correlations ever detected */
  totalCorrelationsDetected: number;
  /** Recent correlations */
  recentCorrelations: CrossMarketCorrelation[];
  /** Active correlations by severity */
  bySeverity: Record<CorrelationSeverity, number>;
  /** By correlation type */
  byCorrelationType: Record<CorrelationType, number>;
  /** Top correlated market pairs */
  topCorrelatedPairs: Array<{
    marketIdA: string;
    marketIdB: string;
    correlationCount: number;
    totalVolume: number;
  }>;
  /** Top correlated wallets */
  topCorrelatedWallets: Array<{
    walletAddress: string;
    correlationCount: number;
    totalVolume: number;
  }>;
  /** Total relations tracked */
  totalRelationsTracked: number;
  /** Analysis statistics */
  analysisStats: {
    marketPairsMonitored: number;
    activeCorrelations: number;
    flaggedCorrelations: number;
  };
}

/**
 * Correlation threshold configuration
 */
export interface CorrelationThresholdConfig {
  /** Minimum overlapping wallets for correlation (default: 2) */
  minOverlappingWallets: number;
  /** Minimum trade pairs for correlation (default: 3) */
  minTradePairs: number;
  /** Maximum time window for simultaneous trades (ms, default: 5 minutes) */
  simultaneousWindowMs: number;
  /** Maximum time window for sequential trades (ms, default: 30 minutes) */
  sequentialWindowMs: number;
  /** Minimum correlation score to flag (0-100, default: 50) */
  minCorrelationScore: number;
  /** Minimum volume for consideration (USD, default: 5000) */
  minVolumeUsd: number;
  /** Volume ratio threshold for volume correlation (default: 0.3) */
  volumeRatioThreshold: number;
  /** Pearson coefficient threshold for strong correlation (default: 0.6) */
  pearsonThreshold: number;
  /** Severity thresholds */
  severityThresholds: {
    medium: number;
    high: number;
    critical: number;
  };
  /** Score weights */
  scoreWeights: {
    walletOverlap: number;
    tradePairCount: number;
    volumeCorrelation: number;
    timingCorrelation: number;
    directionAlignment: number;
  };
}

/**
 * Configuration for CrossMarketCorrelationDetector
 */
export interface CrossMarketCorrelationDetectorConfig {
  /** Threshold configuration */
  thresholds?: Partial<CorrelationThresholdConfig>;
  /** Enable event emission (default: true) */
  enableEvents?: boolean;
  /** Cooldown between alerts for same market pair (ms, default: 300000) */
  alertCooldownMs?: number;
  /** Maximum recent correlations to store (default: 100) */
  maxRecentCorrelations?: number;
  /** Analysis window for trade correlation (ms, default: 3600000 = 1 hour) */
  analysisWindowMs?: number;
}

/**
 * Options for analyzing correlations
 */
export interface AnalyzeCorrelationOptions {
  /** Custom time window */
  timeWindowMs?: number;
  /** Bypass cooldown */
  bypassCooldown?: boolean;
  /** Custom thresholds */
  thresholds?: Partial<CorrelationThresholdConfig>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default correlation thresholds */
export const DEFAULT_CORRELATION_THRESHOLDS: CorrelationThresholdConfig = {
  minOverlappingWallets: 2,
  minTradePairs: 3,
  simultaneousWindowMs: 5 * 60 * 1000, // 5 minutes
  sequentialWindowMs: 30 * 60 * 1000, // 30 minutes
  minCorrelationScore: 50,
  minVolumeUsd: 5000,
  volumeRatioThreshold: 0.3,
  pearsonThreshold: 0.6,
  severityThresholds: {
    medium: 50,
    high: 70,
    critical: 85,
  },
  scoreWeights: {
    walletOverlap: 0.25,
    tradePairCount: 0.2,
    volumeCorrelation: 0.2,
    timingCorrelation: 0.2,
    directionAlignment: 0.15,
  },
};

/** Default alert cooldown (5 minutes) */
const DEFAULT_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

/** Default max recent correlations */
const DEFAULT_MAX_RECENT_CORRELATIONS = 100;

/** Default analysis window (1 hour) */
const DEFAULT_ANALYSIS_WINDOW_MS = 60 * 60 * 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique correlation ID
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate market pair key (order-independent)
 */
function getMarketPairKey(marketIdA: string, marketIdB: string): string {
  const sorted = [marketIdA, marketIdB].sort();
  return `${sorted[0]}::${sorted[1]}`;
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePearsonCoefficient(
  valuesA: number[],
  valuesB: number[]
): number {
  if (valuesA.length !== valuesB.length || valuesA.length < 2) {
    return 0;
  }

  const n = valuesA.length;
  const meanA = valuesA.reduce((a, b) => a + b, 0) / n;
  const meanB = valuesB.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqA = 0;
  let sumSqB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = valuesA[i]! - meanA;
    const diffB = valuesB[i]! - meanB;
    numerator += diffA * diffB;
    sumSqA += diffA * diffA;
    sumSqB += diffB * diffB;
  }

  const denominator = Math.sqrt(sumSqA * sumSqB);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Determine correlation type from trade pairs
 */
function determineCorrelationType(
  tradePairs: CrossMarketTradePair[],
  thresholds: CorrelationThresholdConfig
): CorrelationType {
  if (tradePairs.length === 0) return CorrelationType.MIXED;

  // Calculate metrics
  const sameDirectionCount = tradePairs.filter((p) => p.sameDirection).length;
  const oppDirectionCount = tradePairs.length - sameDirectionCount;
  const avgTimeDiff =
    tradePairs.reduce((sum, p) => sum + p.timeDifferenceMs, 0) /
    tradePairs.length;
  const avgVolumeRatio =
    tradePairs.reduce((sum, p) => sum + p.volumeRatio, 0) / tradePairs.length;

  const sameDirectionRatio = sameDirectionCount / tradePairs.length;

  // Simultaneous: very short time between trades
  if (avgTimeDiff < thresholds.simultaneousWindowMs / 2) {
    return CorrelationType.SIMULTANEOUS;
  }

  // Sequential: ordered trades within window
  if (avgTimeDiff < thresholds.sequentialWindowMs) {
    return CorrelationType.SEQUENTIAL;
  }

  // Volume: similar volumes
  if (avgVolumeRatio > thresholds.volumeRatioThreshold) {
    return CorrelationType.VOLUME;
  }

  // Positive: mostly same direction
  if (sameDirectionRatio > 0.7) {
    return CorrelationType.POSITIVE;
  }

  // Negative: mostly opposite direction
  if (oppDirectionCount / tradePairs.length > 0.7) {
    return CorrelationType.NEGATIVE;
  }

  return CorrelationType.MIXED;
}

/**
 * Calculate correlation score
 */
function calculateCorrelationScore(
  walletCount: number,
  tradePairCount: number,
  volumeRatio: number,
  timingScore: number,
  directionAlignment: number,
  weights: CorrelationThresholdConfig["scoreWeights"]
): number {
  let score = 0;

  // Wallet overlap (more wallets = more suspicious)
  const walletFactor = Math.min(1, (walletCount - 1) / 5);
  score += walletFactor * weights.walletOverlap * 100;

  // Trade pair count
  const pairFactor = Math.min(1, (tradePairCount - 2) / 10);
  score += pairFactor * weights.tradePairCount * 100;

  // Volume correlation (higher ratio = more correlated)
  score += volumeRatio * weights.volumeCorrelation * 100;

  // Timing correlation
  score += timingScore * weights.timingCorrelation * 100;

  // Direction alignment
  score += directionAlignment * weights.directionAlignment * 100;

  return Math.min(100, Math.round(score));
}

/**
 * Determine severity from correlation score
 */
function determineSeverity(
  score: number,
  thresholds: CorrelationThresholdConfig["severityThresholds"]
): CorrelationSeverity {
  if (score >= thresholds.critical) return CorrelationSeverity.CRITICAL;
  if (score >= thresholds.high) return CorrelationSeverity.HIGH;
  if (score >= thresholds.medium) return CorrelationSeverity.MEDIUM;
  return CorrelationSeverity.LOW;
}

/**
 * Generate flag reasons for a correlation
 */
function generateFlagReasons(
  correlation: Omit<CrossMarketCorrelation, "flagReasons">
): string[] {
  const reasons: string[] = [];

  reasons.push(
    `${correlation.walletCount} wallets traded in both markets with ${correlation.tradePairs.length} correlated trade pairs`
  );

  if (correlation.avgTimeBetweenTradesMs < 60000) {
    reasons.push(
      `Very close timing: avg ${Math.round(correlation.avgTimeBetweenTradesMs / 1000)}s between paired trades`
    );
  }

  if (Math.abs(correlation.pearsonCoefficient) > 0.7) {
    const direction =
      correlation.pearsonCoefficient > 0 ? "positive" : "negative";
    reasons.push(
      `Strong ${direction} correlation (r=${correlation.pearsonCoefficient.toFixed(2)})`
    );
  }

  const totalVolume = correlation.volumeMarketA + correlation.volumeMarketB;
  if (totalVolume > 50000) {
    reasons.push(`Large total volume: $${totalVolume.toLocaleString()}`);
  }

  switch (correlation.correlationType) {
    case CorrelationType.SIMULTANEOUS:
      reasons.push("Simultaneous trading pattern - trades within seconds");
      break;
    case CorrelationType.SEQUENTIAL:
      reasons.push(
        "Sequential pattern - consistent order of trades across markets"
      );
      break;
    case CorrelationType.POSITIVE:
      reasons.push(
        "Positive correlation - same direction trades in related markets"
      );
      break;
    case CorrelationType.NEGATIVE:
      reasons.push("Negative correlation - hedging or arbitrage pattern");
      break;
    case CorrelationType.VOLUME:
      reasons.push("Volume correlation - similar trade sizes across markets");
      break;
  }

  return reasons;
}

// ============================================================================
// CrossMarketCorrelationDetector Class
// ============================================================================

/**
 * Event types emitted by CrossMarketCorrelationDetector
 */
export interface CrossMarketCorrelationDetectorEvents {
  correlationDetected: (correlation: CrossMarketCorrelation) => void;
  criticalCorrelation: (correlation: CrossMarketCorrelation) => void;
  relationAdded: (relation: MarketRelation) => void;
}

/**
 * Detector for cross-market correlations
 */
export class CrossMarketCorrelationDetector extends EventEmitter {
  private readonly thresholds: CorrelationThresholdConfig;
  private readonly enableEvents: boolean;
  private readonly alertCooldownMs: number;
  private readonly maxRecentCorrelations: number;
  private readonly analysisWindowMs: number;

  // Market relations
  private readonly relations: Map<string, MarketRelation> = new Map();

  // Recent correlations
  private readonly recentCorrelations: CrossMarketCorrelation[] = [];

  // Alert cooldown tracking
  private readonly lastAlertTime: Map<string, number> = new Map();

  // Stats tracking
  private totalCorrelationsDetected = 0;
  private correlationsBySeverity: Record<CorrelationSeverity, number> = {
    [CorrelationSeverity.LOW]: 0,
    [CorrelationSeverity.MEDIUM]: 0,
    [CorrelationSeverity.HIGH]: 0,
    [CorrelationSeverity.CRITICAL]: 0,
  };
  private correlationsByType: Record<CorrelationType, number> = {
    [CorrelationType.POSITIVE]: 0,
    [CorrelationType.NEGATIVE]: 0,
    [CorrelationType.SEQUENTIAL]: 0,
    [CorrelationType.SIMULTANEOUS]: 0,
    [CorrelationType.VOLUME]: 0,
    [CorrelationType.MIXED]: 0,
  };

  constructor(config?: CrossMarketCorrelationDetectorConfig) {
    super();

    this.thresholds = {
      ...DEFAULT_CORRELATION_THRESHOLDS,
      ...config?.thresholds,
      severityThresholds: {
        ...DEFAULT_CORRELATION_THRESHOLDS.severityThresholds,
        ...config?.thresholds?.severityThresholds,
      },
      scoreWeights: {
        ...DEFAULT_CORRELATION_THRESHOLDS.scoreWeights,
        ...config?.thresholds?.scoreWeights,
      },
    };

    this.enableEvents = config?.enableEvents ?? true;
    this.alertCooldownMs = config?.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
    this.maxRecentCorrelations =
      config?.maxRecentCorrelations ?? DEFAULT_MAX_RECENT_CORRELATIONS;
    this.analysisWindowMs =
      config?.analysisWindowMs ?? DEFAULT_ANALYSIS_WINDOW_MS;
  }

  // ==========================================================================
  // Market Relations Management
  // ==========================================================================

  /**
   * Add a market relation
   */
  addRelation(relation: Omit<MarketRelation, "createdAt">): MarketRelation {
    const key = getMarketPairKey(relation.marketIdA, relation.marketIdB);
    const fullRelation: MarketRelation = {
      ...relation,
      createdAt: new Date(),
    };

    this.relations.set(key, fullRelation);

    if (this.enableEvents) {
      this.emit("relationAdded", fullRelation);
    }

    return fullRelation;
  }

  /**
   * Remove a market relation
   */
  removeRelation(marketIdA: string, marketIdB: string): boolean {
    const key = getMarketPairKey(marketIdA, marketIdB);
    return this.relations.delete(key);
  }

  /**
   * Get a market relation
   */
  getRelation(marketIdA: string, marketIdB: string): MarketRelation | null {
    const key = getMarketPairKey(marketIdA, marketIdB);
    return this.relations.get(key) ?? null;
  }

  /**
   * Check if markets are related
   */
  areMarketsRelated(marketIdA: string, marketIdB: string): boolean {
    const key = getMarketPairKey(marketIdA, marketIdB);
    return this.relations.has(key);
  }

  /**
   * Get all relations for a market
   */
  getRelationsForMarket(marketId: string): MarketRelation[] {
    const result: MarketRelation[] = [];
    for (const relation of this.relations.values()) {
      if (
        relation.marketIdA === marketId ||
        relation.marketIdB === marketId
      ) {
        result.push(relation);
      }
    }
    return result;
  }

  /**
   * Get all market relations
   */
  getAllRelations(): MarketRelation[] {
    return Array.from(this.relations.values());
  }

  /**
   * Auto-detect market relations based on shared keywords
   */
  autoDetectRelations(
    markets: Array<{
      marketId: string;
      question: string;
      category?: MarketCategory;
    }>,
    minKeywordOverlap: number = 2
  ): MarketRelation[] {
    const newRelations: MarketRelation[] = [];
    const marketKeywords = new Map<string, Set<string>>();

    // Extract keywords from each market
    for (const market of markets) {
      const words = market.question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3); // Only words > 3 chars
      marketKeywords.set(market.marketId, new Set(words));
    }

    // Compare all pairs
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const marketA = markets[i]!;
        const marketB = markets[j]!;

        // Skip if already related
        if (this.areMarketsRelated(marketA.marketId, marketB.marketId)) {
          continue;
        }

        const keywordsA = marketKeywords.get(marketA.marketId)!;
        const keywordsB = marketKeywords.get(marketB.marketId)!;

        // Find shared keywords
        const shared: string[] = [];
        for (const word of keywordsA) {
          if (keywordsB.has(word)) {
            shared.push(word);
          }
        }

        // Determine relation type
        let relationType = MarketRelationType.KEYWORD_OVERLAP;
        let strength = shared.length / Math.max(keywordsA.size, keywordsB.size);

        if (marketA.category && marketA.category === marketB.category) {
          relationType = MarketRelationType.SAME_CATEGORY;
          strength = Math.max(strength, 0.5);
        }

        if (shared.length >= minKeywordOverlap) {
          const relation = this.addRelation({
            marketIdA: marketA.marketId,
            marketIdB: marketB.marketId,
            relationType,
            strength,
            sharedKeywords: shared,
            category: marketA.category,
          });
          newRelations.push(relation);
        }
      }
    }

    return newRelations;
  }

  // ==========================================================================
  // Correlation Analysis
  // ==========================================================================

  /**
   * Analyze trades for cross-market correlation
   */
  analyzeCorrelation(
    tradesA: CorrelationTrade[],
    tradesB: CorrelationTrade[],
    options?: AnalyzeCorrelationOptions
  ): CorrelationAnalysisResult {
    const now = Date.now();
    const effectiveThresholds = {
      ...this.thresholds,
      ...options?.thresholds,
      severityThresholds: {
        ...this.thresholds.severityThresholds,
        ...options?.thresholds?.severityThresholds,
      },
      scoreWeights: {
        ...this.thresholds.scoreWeights,
        ...options?.thresholds?.scoreWeights,
      },
    };

    const timeWindow = options?.timeWindowMs ?? this.analysisWindowMs;

    if (tradesA.length === 0 || tradesB.length === 0) {
      return this.createEmptyResult(
        tradesA[0]?.marketId ?? "",
        tradesB[0]?.marketId ?? "",
        tradesA.length,
        tradesB.length,
        now
      );
    }

    const marketIdA = tradesA[0]!.marketId;
    const marketIdB = tradesB[0]!.marketId;

    // Filter trades to time window
    const cutoff = now - timeWindow;
    const filteredTradesA = tradesA.filter((t) => t.timestamp >= cutoff);
    const filteredTradesB = tradesB.filter((t) => t.timestamp >= cutoff);

    if (filteredTradesA.length === 0 || filteredTradesB.length === 0) {
      return this.createEmptyResult(
        marketIdA,
        marketIdB,
        filteredTradesA.length,
        filteredTradesB.length,
        now
      );
    }

    // Find overlapping wallets
    const walletsA = new Set(
      filteredTradesA.map((t) => t.walletAddress.toLowerCase())
    );
    const walletsB = new Set(
      filteredTradesB.map((t) => t.walletAddress.toLowerCase())
    );
    const overlappingWallets: string[] = [];

    for (const wallet of walletsA) {
      if (walletsB.has(wallet)) {
        overlappingWallets.push(wallet);
      }
    }

    if (overlappingWallets.length < effectiveThresholds.minOverlappingWallets) {
      return this.createEmptyResult(
        marketIdA,
        marketIdB,
        filteredTradesA.length,
        filteredTradesB.length,
        now,
        overlappingWallets
      );
    }

    // Build trade pairs for overlapping wallets
    const tradePairs: CrossMarketTradePair[] = [];
    const tradesMapA = new Map<string, CorrelationTrade[]>();
    const tradesMapB = new Map<string, CorrelationTrade[]>();

    // Group trades by wallet
    for (const trade of filteredTradesA) {
      const key = trade.walletAddress.toLowerCase();
      if (!tradesMapA.has(key)) tradesMapA.set(key, []);
      tradesMapA.get(key)!.push(trade);
    }

    for (const trade of filteredTradesB) {
      const key = trade.walletAddress.toLowerCase();
      if (!tradesMapB.has(key)) tradesMapB.set(key, []);
      tradesMapB.get(key)!.push(trade);
    }

    // Create trade pairs
    for (const wallet of overlappingWallets) {
      const walletTradesA = tradesMapA.get(wallet) ?? [];
      const walletTradesB = tradesMapB.get(wallet) ?? [];

      // Match trades by timing
      for (const tradeA of walletTradesA) {
        for (const tradeB of walletTradesB) {
          const timeDiff = Math.abs(tradeA.timestamp - tradeB.timestamp);
          if (timeDiff <= effectiveThresholds.sequentialWindowMs) {
            tradePairs.push({
              tradeA,
              tradeB,
              timeDifferenceMs: timeDiff,
              sameDirection: tradeA.side === tradeB.side,
              volumeRatio:
                Math.min(tradeA.sizeUsd, tradeB.sizeUsd) /
                Math.max(tradeA.sizeUsd, tradeB.sizeUsd),
            });
          }
        }
      }
    }

    if (tradePairs.length < effectiveThresholds.minTradePairs) {
      return this.createEmptyResult(
        marketIdA,
        marketIdB,
        filteredTradesA.length,
        filteredTradesB.length,
        now,
        overlappingWallets
      );
    }

    // Calculate volumes
    const volumeA = filteredTradesA.reduce((sum, t) => sum + t.sizeUsd, 0);
    const volumeB = filteredTradesB.reduce((sum, t) => sum + t.sizeUsd, 0);
    const totalVolume = volumeA + volumeB;

    if (totalVolume < effectiveThresholds.minVolumeUsd) {
      return this.createEmptyResult(
        marketIdA,
        marketIdB,
        filteredTradesA.length,
        filteredTradesB.length,
        now,
        overlappingWallets
      );
    }

    // Calculate Pearson coefficient for volume correlation
    const volumesA = tradePairs.map((p) => p.tradeA.sizeUsd);
    const volumesB = tradePairs.map((p) => p.tradeB.sizeUsd);
    const pearsonCoeff = calculatePearsonCoefficient(volumesA, volumesB);

    // Calculate timing metrics
    const avgTimeBetween =
      tradePairs.reduce((sum, p) => sum + p.timeDifferenceMs, 0) /
      tradePairs.length;
    const timingScore = Math.max(
      0,
      1 - avgTimeBetween / effectiveThresholds.sequentialWindowMs
    );

    // Calculate direction alignment
    const sameDirectionCount = tradePairs.filter((p) => p.sameDirection).length;
    const directionAlignment = sameDirectionCount / tradePairs.length;

    // Calculate volume ratio
    const avgVolumeRatio =
      tradePairs.reduce((sum, p) => sum + p.volumeRatio, 0) / tradePairs.length;

    // Determine correlation type
    const correlationType = determineCorrelationType(
      tradePairs,
      effectiveThresholds
    );

    // Calculate correlation score
    const correlationScore = calculateCorrelationScore(
      overlappingWallets.length,
      tradePairs.length,
      avgVolumeRatio,
      timingScore,
      directionAlignment,
      effectiveThresholds.scoreWeights
    );

    if (correlationScore < effectiveThresholds.minCorrelationScore) {
      return this.createEmptyResult(
        marketIdA,
        marketIdB,
        filteredTradesA.length,
        filteredTradesB.length,
        now,
        overlappingWallets
      );
    }

    // Determine severity
    const severity = determineSeverity(
      correlationScore,
      effectiveThresholds.severityThresholds
    );

    // Get market relation
    const relation = this.getRelation(marketIdA, marketIdB);

    // Find time range
    const allTimestamps = [
      ...tradePairs.map((p) => p.tradeA.timestamp),
      ...tradePairs.map((p) => p.tradeB.timestamp),
    ];
    const startTime = Math.min(...allTimestamps);
    const endTime = Math.max(...allTimestamps);

    // Build correlation
    const correlation: Omit<CrossMarketCorrelation, "flagReasons"> = {
      correlationId: generateCorrelationId(),
      marketIdA,
      marketIdB,
      relationType: relation?.relationType ?? MarketRelationType.CUSTOM,
      correlationType,
      severity,
      status: CorrelationStatus.ACTIVE,
      walletAddresses: overlappingWallets,
      walletCount: overlappingWallets.length,
      tradePairs,
      tradesInMarketA: filteredTradesA.length,
      tradesInMarketB: filteredTradesB.length,
      volumeMarketA: volumeA,
      volumeMarketB: volumeB,
      correlationScore,
      pearsonCoefficient: pearsonCoeff,
      avgTimeBetweenTradesMs: avgTimeBetween,
      analysisWindowMs: timeWindow,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      detectedAt: new Date(now),
    };

    const flagReasons = generateFlagReasons(correlation);
    const fullCorrelation: CrossMarketCorrelation = {
      ...correlation,
      flagReasons,
    };

    // Record correlation
    const pairKey = getMarketPairKey(marketIdA, marketIdB);
    if (this.canEmitAlert(pairKey, options?.bypassCooldown ?? false, now)) {
      this.recordCorrelation(fullCorrelation, now);
    }

    return {
      marketIdA,
      marketIdB,
      hasCorrelation: true,
      correlation: fullCorrelation,
      totalTradesA: filteredTradesA.length,
      totalTradesB: filteredTradesB.length,
      overlappingWallets,
      analyzedAt: new Date(now),
    };
  }

  /**
   * Analyze multiple market pairs for correlations
   */
  analyzeMultiplePairs(
    tradesByMarket: Map<string, CorrelationTrade[]>,
    options?: AnalyzeCorrelationOptions
  ): BatchCorrelationResult {
    const startTime = Date.now();
    const results = new Map<string, CorrelationAnalysisResult>();
    const allCorrelations: CrossMarketCorrelation[] = [];

    const bySeverity: Record<CorrelationSeverity, number> = {
      [CorrelationSeverity.LOW]: 0,
      [CorrelationSeverity.MEDIUM]: 0,
      [CorrelationSeverity.HIGH]: 0,
      [CorrelationSeverity.CRITICAL]: 0,
    };

    const byCorrelationType: Record<CorrelationType, number> = {
      [CorrelationType.POSITIVE]: 0,
      [CorrelationType.NEGATIVE]: 0,
      [CorrelationType.SEQUENTIAL]: 0,
      [CorrelationType.SIMULTANEOUS]: 0,
      [CorrelationType.VOLUME]: 0,
      [CorrelationType.MIXED]: 0,
    };

    // Analyze all related market pairs
    const marketIds = Array.from(tradesByMarket.keys());

    for (let i = 0; i < marketIds.length; i++) {
      for (let j = i + 1; j < marketIds.length; j++) {
        const marketIdA = marketIds[i]!;
        const marketIdB = marketIds[j]!;

        // Only analyze if markets are related or if analyzing all
        const relation = this.getRelation(marketIdA, marketIdB);
        if (!relation && this.relations.size > 0) {
          continue; // Skip unrelated markets if we have relations defined
        }

        const tradesA = tradesByMarket.get(marketIdA) ?? [];
        const tradesB = tradesByMarket.get(marketIdB) ?? [];

        const result = this.analyzeCorrelation(tradesA, tradesB, options);
        const pairKey = getMarketPairKey(marketIdA, marketIdB);
        results.set(pairKey, result);

        if (result.hasCorrelation && result.correlation) {
          allCorrelations.push(result.correlation);
          bySeverity[result.correlation.severity]++;
          byCorrelationType[result.correlation.correlationType]++;
        }
      }
    }

    return {
      results,
      correlations: allCorrelations,
      totalPairsAnalyzed: results.size,
      totalCorrelationsFound: allCorrelations.length,
      bySeverity,
      byCorrelationType,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get recent correlations for a market
   */
  getMarketCorrelations(marketId: string, limit: number = 10): CrossMarketCorrelation[] {
    return this.recentCorrelations
      .filter(
        (c) => c.marketIdA === marketId || c.marketIdB === marketId
      )
      .slice(0, limit);
  }

  /**
   * Get recent correlations for a wallet
   */
  getWalletCorrelations(
    walletAddress: string,
    limit: number = 10
  ): CrossMarketCorrelation[] {
    const lowerWallet = walletAddress.toLowerCase();
    return this.recentCorrelations
      .filter((c) => c.walletAddresses.includes(lowerWallet))
      .slice(0, limit);
  }

  /**
   * Get all recent correlations
   */
  getRecentCorrelations(limit: number = 20): CrossMarketCorrelation[] {
    return this.recentCorrelations.slice(0, limit);
  }

  /**
   * Get correlations by severity
   */
  getCorrelationsBySeverity(
    severity: CorrelationSeverity,
    limit: number = 10
  ): CrossMarketCorrelation[] {
    return this.recentCorrelations
      .filter((c) => c.severity === severity)
      .slice(0, limit);
  }

  /**
   * Get correlations by type
   */
  getCorrelationsByType(
    type: CorrelationType,
    limit: number = 10
  ): CrossMarketCorrelation[] {
    return this.recentCorrelations
      .filter((c) => c.correlationType === type)
      .slice(0, limit);
  }

  /**
   * Get flagged correlations
   */
  getFlaggedCorrelations(limit: number = 20): CrossMarketCorrelation[] {
    return this.recentCorrelations
      .filter((c) => c.status === CorrelationStatus.FLAGGED)
      .slice(0, limit);
  }

  /**
   * Update correlation status
   */
  updateCorrelationStatus(
    correlationId: string,
    status: CorrelationStatus
  ): boolean {
    const correlation = this.recentCorrelations.find(
      (c) => c.correlationId === correlationId
    );
    if (correlation) {
      correlation.status = status;
      return true;
    }
    return false;
  }

  /**
   * Flag a correlation for investigation
   */
  flagCorrelation(correlationId: string): boolean {
    return this.updateCorrelationStatus(
      correlationId,
      CorrelationStatus.FLAGGED
    );
  }

  /**
   * Dismiss a correlation
   */
  dismissCorrelation(correlationId: string): boolean {
    return this.updateCorrelationStatus(
      correlationId,
      CorrelationStatus.DISMISSED
    );
  }

  // ==========================================================================
  // Summary Methods
  // ==========================================================================

  /**
   * Get summary statistics
   */
  getSummary(): CorrelationSummary {
    // Calculate top correlated pairs
    const pairCounts = new Map<
      string,
      { marketIdA: string; marketIdB: string; count: number; volume: number }
    >();

    for (const corr of this.recentCorrelations) {
      const key = getMarketPairKey(corr.marketIdA, corr.marketIdB);
      const existing = pairCounts.get(key) ?? {
        marketIdA: corr.marketIdA,
        marketIdB: corr.marketIdB,
        count: 0,
        volume: 0,
      };
      existing.count++;
      existing.volume += corr.volumeMarketA + corr.volumeMarketB;
      pairCounts.set(key, existing);
    }

    const topCorrelatedPairs = Array.from(pairCounts.values())
      .map((p) => ({
        marketIdA: p.marketIdA,
        marketIdB: p.marketIdB,
        correlationCount: p.count,
        totalVolume: p.volume,
      }))
      .sort((a, b) => b.correlationCount - a.correlationCount)
      .slice(0, 10);

    // Calculate top correlated wallets
    const walletCounts = new Map<
      string,
      { count: number; volume: number }
    >();

    for (const corr of this.recentCorrelations) {
      for (const wallet of corr.walletAddresses) {
        const existing = walletCounts.get(wallet) ?? {
          count: 0,
          volume: 0,
        };
        existing.count++;
        existing.volume +=
          (corr.volumeMarketA + corr.volumeMarketB) / corr.walletCount;
        walletCounts.set(wallet, existing);
      }
    }

    const topCorrelatedWallets = Array.from(walletCounts.entries())
      .map(([walletAddress, data]) => ({
        walletAddress,
        correlationCount: data.count,
        totalVolume: data.volume,
      }))
      .sort((a, b) => b.correlationCount - a.correlationCount)
      .slice(0, 10);

    // Analysis stats
    const activeCorrelations = this.recentCorrelations.filter(
      (c) => c.status === CorrelationStatus.ACTIVE
    ).length;
    const flaggedCorrelations = this.recentCorrelations.filter(
      (c) => c.status === CorrelationStatus.FLAGGED
    ).length;

    return {
      totalCorrelationsDetected: this.totalCorrelationsDetected,
      recentCorrelations: this.recentCorrelations.slice(0, 20),
      bySeverity: { ...this.correlationsBySeverity },
      byCorrelationType: { ...this.correlationsByType },
      topCorrelatedPairs,
      topCorrelatedWallets,
      totalRelationsTracked: this.relations.size,
      analysisStats: {
        marketPairsMonitored: this.relations.size,
        activeCorrelations,
        flaggedCorrelations,
      },
    };
  }

  /**
   * Get threshold configuration
   */
  getThresholds(): CorrelationThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    totalCorrelationsDetected: number;
    recentCorrelationCount: number;
    totalRelationsTracked: number;
    enableEvents: boolean;
    alertCooldownMs: number;
    analysisWindowMs: number;
  } {
    return {
      totalCorrelationsDetected: this.totalCorrelationsDetected,
      recentCorrelationCount: this.recentCorrelations.length,
      totalRelationsTracked: this.relations.size,
      enableEvents: this.enableEvents,
      alertCooldownMs: this.alertCooldownMs,
      analysisWindowMs: this.analysisWindowMs,
    };
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.relations.clear();
    this.recentCorrelations.length = 0;
    this.lastAlertTime.clear();
    this.totalCorrelationsDetected = 0;
    this.correlationsBySeverity = {
      [CorrelationSeverity.LOW]: 0,
      [CorrelationSeverity.MEDIUM]: 0,
      [CorrelationSeverity.HIGH]: 0,
      [CorrelationSeverity.CRITICAL]: 0,
    };
    this.correlationsByType = {
      [CorrelationType.POSITIVE]: 0,
      [CorrelationType.NEGATIVE]: 0,
      [CorrelationType.SEQUENTIAL]: 0,
      [CorrelationType.SIMULTANEOUS]: 0,
      [CorrelationType.VOLUME]: 0,
      [CorrelationType.MIXED]: 0,
    };
  }

  /**
   * Clear correlations only (keep relations)
   */
  clearCorrelations(): void {
    this.recentCorrelations.length = 0;
    this.lastAlertTime.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createEmptyResult(
    marketIdA: string,
    marketIdB: string,
    totalTradesA: number,
    totalTradesB: number,
    now: number,
    overlappingWallets: string[] = []
  ): CorrelationAnalysisResult {
    return {
      marketIdA,
      marketIdB,
      hasCorrelation: false,
      correlation: null,
      totalTradesA,
      totalTradesB,
      overlappingWallets,
      analyzedAt: new Date(now),
    };
  }

  private recordCorrelation(
    correlation: CrossMarketCorrelation,
    now: number
  ): void {
    // Store correlation
    this.recentCorrelations.unshift(correlation);
    if (this.recentCorrelations.length > this.maxRecentCorrelations) {
      this.recentCorrelations.pop();
    }

    // Update stats
    this.totalCorrelationsDetected++;
    this.correlationsBySeverity[correlation.severity]++;
    this.correlationsByType[correlation.correlationType]++;

    // Update cooldown
    const pairKey = getMarketPairKey(
      correlation.marketIdA,
      correlation.marketIdB
    );
    this.lastAlertTime.set(pairKey, now);

    // Emit events
    if (this.enableEvents) {
      this.emit("correlationDetected", correlation);

      if (correlation.severity === CorrelationSeverity.CRITICAL) {
        this.emit("criticalCorrelation", correlation);
      }
    }
  }

  private canEmitAlert(
    pairKey: string,
    bypassCooldown: boolean,
    now: number
  ): boolean {
    if (bypassCooldown) return true;

    const lastAlert = this.lastAlertTime.get(pairKey);
    if (!lastAlert) return true;

    return now - lastAlert >= this.alertCooldownMs;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedDetector: CrossMarketCorrelationDetector | null = null;

/**
 * Create a new CrossMarketCorrelationDetector instance
 */
export function createCrossMarketCorrelationDetector(
  config?: CrossMarketCorrelationDetectorConfig
): CrossMarketCorrelationDetector {
  return new CrossMarketCorrelationDetector(config);
}

/**
 * Get the shared CrossMarketCorrelationDetector instance
 */
export function getSharedCrossMarketCorrelationDetector(): CrossMarketCorrelationDetector {
  if (!sharedDetector) {
    sharedDetector = new CrossMarketCorrelationDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared CrossMarketCorrelationDetector instance
 */
export function setSharedCrossMarketCorrelationDetector(
  detector: CrossMarketCorrelationDetector
): void {
  sharedDetector = detector;
}

/**
 * Reset the shared CrossMarketCorrelationDetector instance
 */
export function resetSharedCrossMarketCorrelationDetector(): void {
  if (sharedDetector) {
    sharedDetector.clearAll();
    sharedDetector.removeAllListeners();
  }
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add a market relation (convenience function)
 */
export function addMarketRelation(
  relation: Omit<MarketRelation, "createdAt">,
  options?: { detector?: CrossMarketCorrelationDetector }
): MarketRelation {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.addRelation(relation);
}

/**
 * Check if markets are related (convenience function)
 */
export function areMarketsRelated(
  marketIdA: string,
  marketIdB: string,
  options?: { detector?: CrossMarketCorrelationDetector }
): boolean {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.areMarketsRelated(marketIdA, marketIdB);
}

/**
 * Analyze trades for cross-market correlation (convenience function)
 */
export function analyzeCrossMarketCorrelation(
  tradesA: CorrelationTrade[],
  tradesB: CorrelationTrade[],
  options?: AnalyzeCorrelationOptions & {
    detector?: CrossMarketCorrelationDetector;
  }
): CorrelationAnalysisResult {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.analyzeCorrelation(tradesA, tradesB, options);
}

/**
 * Analyze multiple market pairs for correlations (convenience function)
 */
export function analyzeMultipleMarketPairCorrelations(
  tradesByMarket: Map<string, CorrelationTrade[]>,
  options?: AnalyzeCorrelationOptions & {
    detector?: CrossMarketCorrelationDetector;
  }
): BatchCorrelationResult {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.analyzeMultiplePairs(tradesByMarket, options);
}

/**
 * Get recent cross-market correlations (convenience function)
 */
export function getRecentCrossMarketCorrelations(
  limit?: number,
  options?: { detector?: CrossMarketCorrelationDetector }
): CrossMarketCorrelation[] {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.getRecentCorrelations(limit);
}

/**
 * Get cross-market correlations for a market (convenience function)
 */
export function getMarketCrossMarketCorrelations(
  marketId: string,
  limit?: number,
  options?: { detector?: CrossMarketCorrelationDetector }
): CrossMarketCorrelation[] {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.getMarketCorrelations(marketId, limit);
}

/**
 * Get cross-market correlations for a wallet (convenience function)
 */
export function getWalletCrossMarketCorrelations(
  walletAddress: string,
  limit?: number,
  options?: { detector?: CrossMarketCorrelationDetector }
): CrossMarketCorrelation[] {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.getWalletCorrelations(walletAddress, limit);
}

/**
 * Get cross-market correlation summary (convenience function)
 */
export function getCrossMarketCorrelationSummary(
  options?: { detector?: CrossMarketCorrelationDetector }
): CorrelationSummary {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.getSummary();
}

/**
 * Auto-detect market relations (convenience function)
 */
export function autoDetectMarketRelations(
  markets: Array<{
    marketId: string;
    question: string;
    category?: MarketCategory;
  }>,
  minKeywordOverlap?: number,
  options?: { detector?: CrossMarketCorrelationDetector }
): MarketRelation[] {
  const detector =
    options?.detector ?? getSharedCrossMarketCorrelationDetector();
  return detector.autoDetectRelations(markets, minKeywordOverlap);
}
