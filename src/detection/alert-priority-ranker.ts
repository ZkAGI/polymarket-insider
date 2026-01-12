/**
 * Alert Priority Ranker (DET-SCORE-005)
 *
 * Rank alerts by priority/urgency for user attention. This module analyzes
 * composite score results and assigns priority rankings based on multiple
 * factors to help users focus on the most important alerts first.
 *
 * Features:
 * - Define priority factors (severity, recency, confidence, impact potential)
 * - Calculate priority score
 * - Sort alerts by priority
 * - Highlight urgent alerts
 * - Support batch ranking
 * - Event emission for urgent alerts
 * - Configurable priority weights
 * - Decay factors for aging alerts
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import {
  type CompositeScoreResult,
  CompositeSuspicionLevel,
} from "./composite-suspicion-scorer";
import { type FilterResult } from "./false-positive-reducer";
import { SelectionPatternType } from "./market-selection-analyzer";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Priority level classification
 */
export enum PriorityLevel {
  /** Critical - requires immediate attention */
  CRITICAL = "CRITICAL",
  /** High - should be reviewed urgently */
  HIGH = "HIGH",
  /** Medium - standard priority */
  MEDIUM = "MEDIUM",
  /** Low - can wait */
  LOW = "LOW",
  /** Minimal - lowest priority */
  MINIMAL = "MINIMAL",
}

/**
 * Priority factor category
 */
export enum PriorityFactor {
  /** Suspicion score severity */
  SEVERITY = "SEVERITY",
  /** Signal confidence level */
  CONFIDENCE = "CONFIDENCE",
  /** Recency of activity */
  RECENCY = "RECENCY",
  /** Potential financial impact */
  IMPACT = "IMPACT",
  /** Signal convergence (multiple signals agreeing) */
  CONVERGENCE = "CONVERGENCE",
  /** Market sensitivity (high-stakes markets) */
  MARKET_SENSITIVITY = "MARKET_SENSITIVITY",
  /** Network risk (coordination/sybil) */
  NETWORK_RISK = "NETWORK_RISK",
  /** Historical pattern match */
  PATTERN_MATCH = "PATTERN_MATCH",
  /** Behavioral anomaly intensity */
  ANOMALY_INTENSITY = "ANOMALY_INTENSITY",
  /** Alert novelty (first time flagged) */
  NOVELTY = "NOVELTY",
}

/**
 * Alert urgency reason
 */
export enum UrgencyReason {
  /** Score exceeds critical threshold */
  CRITICAL_SCORE = "CRITICAL_SCORE",
  /** Multiple high-confidence signals */
  MULTI_SIGNAL_CONVERGENCE = "MULTI_SIGNAL_CONVERGENCE",
  /** Recent activity detected */
  RECENT_ACTIVITY = "RECENT_ACTIVITY",
  /** High financial impact potential */
  HIGH_IMPACT = "HIGH_IMPACT",
  /** Network/coordination detected */
  NETWORK_DETECTION = "NETWORK_DETECTION",
  /** Sybil cluster member */
  SYBIL_CLUSTER = "SYBIL_CLUSTER",
  /** Potential insider trading */
  INSIDER_INDICATOR = "INSIDER_INDICATOR",
  /** Time-sensitive market */
  TIME_SENSITIVE_MARKET = "TIME_SENSITIVE_MARKET",
  /** First-time detection */
  NEW_DETECTION = "NEW_DETECTION",
  /** Score rapidly increasing */
  SCORE_ESCALATION = "SCORE_ESCALATION",
}

/**
 * Priority factor contribution
 */
export interface FactorContribution {
  /** Factor identifier */
  factor: PriorityFactor;
  /** Human-readable name */
  name: string;
  /** Raw score for this factor (0-100) */
  rawScore: number;
  /** Weight applied to this factor */
  weight: number;
  /** Weighted contribution */
  weightedScore: number;
  /** Explanation for this score */
  reason: string;
}

/**
 * Alert ranking result
 */
export interface AlertRanking {
  /** Wallet address (checksummed) */
  walletAddress: string;
  /** Priority score (0-100, higher = more urgent) */
  priorityScore: number;
  /** Priority level classification */
  priorityLevel: PriorityLevel;
  /** Rank position (1 = highest priority) */
  rank: number;
  /** Is this alert urgent */
  isUrgent: boolean;
  /** Is this alert highlighted for immediate attention */
  isHighlighted: boolean;
  /** Urgency reasons */
  urgencyReasons: UrgencyReason[];
  /** Factor contributions */
  factorContributions: FactorContribution[];
  /** Top contributing factors */
  topFactors: FactorContribution[];
  /** Original composite score */
  originalScore: number;
  /** Adjusted score (if filtering applied) */
  adjustedScore: number | null;
  /** Original suspicion level */
  suspicionLevel: CompositeSuspicionLevel;
  /** Time decay multiplier applied */
  timeDecayMultiplier: number;
  /** Age of alert in hours */
  alertAgeHours: number;
  /** Brief priority summary */
  summary: string;
  /** Recommended action */
  recommendedAction: string;
  /** Original result reference */
  originalResult: CompositeScoreResult;
  /** Filter result reference (if available) */
  filterResult: FilterResult | null;
  /** Whether from cache */
  fromCache: boolean;
  /** Analysis timestamp */
  rankedAt: Date;
}

/**
 * Priority weight configuration
 */
export interface PriorityWeights {
  /** Weight for each priority factor (0-1) */
  [PriorityFactor.SEVERITY]: number;
  [PriorityFactor.CONFIDENCE]: number;
  [PriorityFactor.RECENCY]: number;
  [PriorityFactor.IMPACT]: number;
  [PriorityFactor.CONVERGENCE]: number;
  [PriorityFactor.MARKET_SENSITIVITY]: number;
  [PriorityFactor.NETWORK_RISK]: number;
  [PriorityFactor.PATTERN_MATCH]: number;
  [PriorityFactor.ANOMALY_INTENSITY]: number;
  [PriorityFactor.NOVELTY]: number;
}

/**
 * Batch ranking result
 */
export interface BatchRankingResult {
  /** Ranked results (sorted by priority) */
  rankings: AlertRanking[];
  /** Results by wallet address for quick lookup */
  byWallet: Map<string, AlertRanking>;
  /** Failed wallets */
  failed: Map<string, Error>;
  /** Total processed */
  totalProcessed: number;
  /** Count by priority level */
  byLevel: Record<PriorityLevel, number>;
  /** Urgent alerts count */
  urgentCount: number;
  /** Highlighted alerts count */
  highlightedCount: number;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Ranker summary statistics
 */
export interface RankerSummary {
  /** Total alerts ranked */
  totalRanked: number;
  /** Alerts by priority level */
  byLevel: Record<PriorityLevel, number>;
  /** Total urgent alerts */
  urgentAlerts: number;
  /** Total highlighted alerts */
  highlightedAlerts: number;
  /** Average priority score */
  averagePriorityScore: number;
  /** Most common urgency reasons */
  commonUrgencyReasons: Array<{ reason: UrgencyReason; count: number }>;
  /** Most impactful factors */
  impactfulFactors: Array<{ factor: PriorityFactor; avgContribution: number }>;
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
  };
  /** Processing statistics */
  processingStats: {
    totalProcessed: number;
    averageProcessingTimeMs: number;
  };
}

/**
 * Alert history entry for novelty detection
 */
export interface AlertHistoryEntry {
  /** First detection timestamp */
  firstSeen: Date;
  /** Last update timestamp */
  lastSeen: Date;
  /** Previous scores */
  previousScores: number[];
  /** Times ranked */
  timesRanked: number;
}

/**
 * Ranker configuration
 */
export interface AlertPriorityRankerConfig {
  /** Priority weights */
  weights: PriorityWeights;
  /** Priority level thresholds */
  levelThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Urgent alert threshold */
  urgentThreshold: number;
  /** Highlight threshold */
  highlightThreshold: number;
  /** Time decay configuration */
  timeDecay: {
    /** Enable time decay */
    enabled: boolean;
    /** Hours after which decay starts */
    decayStartHours: number;
    /** Decay rate per hour after start */
    decayRatePerHour: number;
    /** Minimum multiplier (floor) */
    minMultiplier: number;
  };
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Maximum alert history per wallet */
  maxHistoryPerWallet: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default priority weights
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  [PriorityFactor.SEVERITY]: 0.20,
  [PriorityFactor.CONFIDENCE]: 0.12,
  [PriorityFactor.RECENCY]: 0.10,
  [PriorityFactor.IMPACT]: 0.12,
  [PriorityFactor.CONVERGENCE]: 0.10,
  [PriorityFactor.MARKET_SENSITIVITY]: 0.08,
  [PriorityFactor.NETWORK_RISK]: 0.10,
  [PriorityFactor.PATTERN_MATCH]: 0.08,
  [PriorityFactor.ANOMALY_INTENSITY]: 0.06,
  [PriorityFactor.NOVELTY]: 0.04,
};

/**
 * Default level thresholds
 */
export const DEFAULT_LEVEL_THRESHOLDS = {
  critical: 85,
  high: 70,
  medium: 50,
  low: 30,
};

/**
 * Default time decay configuration
 */
export const DEFAULT_TIME_DECAY = {
  enabled: true,
  decayStartHours: 24,
  decayRatePerHour: 0.5,
  minMultiplier: 0.5,
};

/**
 * Default configuration
 */
export const DEFAULT_RANKER_CONFIG: AlertPriorityRankerConfig = {
  weights: { ...DEFAULT_PRIORITY_WEIGHTS },
  levelThresholds: { ...DEFAULT_LEVEL_THRESHOLDS },
  urgentThreshold: 75,
  highlightThreshold: 85,
  timeDecay: { ...DEFAULT_TIME_DECAY },
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  maxHistoryPerWallet: 50,
};

/**
 * Priority level descriptions
 */
export const PRIORITY_LEVEL_DESCRIPTIONS: Record<PriorityLevel, string> = {
  [PriorityLevel.CRITICAL]: "Requires immediate attention - potential active insider threat",
  [PriorityLevel.HIGH]: "Should be reviewed urgently - significant suspicious activity",
  [PriorityLevel.MEDIUM]: "Standard priority - notable but not urgent concerns",
  [PriorityLevel.LOW]: "Lower priority - minor indicators, can wait for batch review",
  [PriorityLevel.MINIMAL]: "Lowest priority - very weak signals, background monitoring",
};

/**
 * Priority factor descriptions
 */
export const PRIORITY_FACTOR_DESCRIPTIONS: Record<PriorityFactor, string> = {
  [PriorityFactor.SEVERITY]: "Overall suspicion score severity",
  [PriorityFactor.CONFIDENCE]: "Confidence in the detection signals",
  [PriorityFactor.RECENCY]: "How recently suspicious activity occurred",
  [PriorityFactor.IMPACT]: "Potential financial impact if true positive",
  [PriorityFactor.CONVERGENCE]: "Multiple signals pointing to same conclusion",
  [PriorityFactor.MARKET_SENSITIVITY]: "Sensitivity of involved markets",
  [PriorityFactor.NETWORK_RISK]: "Risk from coordination or sybil clusters",
  [PriorityFactor.PATTERN_MATCH]: "Match to known suspicious patterns",
  [PriorityFactor.ANOMALY_INTENSITY]: "Intensity of behavioral anomalies",
  [PriorityFactor.NOVELTY]: "First time or newly elevated alert",
};

/**
 * Urgency reason descriptions
 */
export const URGENCY_REASON_DESCRIPTIONS: Record<UrgencyReason, string> = {
  [UrgencyReason.CRITICAL_SCORE]: "Suspicion score exceeds critical threshold",
  [UrgencyReason.MULTI_SIGNAL_CONVERGENCE]: "Multiple high-confidence signals agree",
  [UrgencyReason.RECENT_ACTIVITY]: "Suspicious activity detected recently",
  [UrgencyReason.HIGH_IMPACT]: "Potential for significant financial impact",
  [UrgencyReason.NETWORK_DETECTION]: "Coordinated trading detected",
  [UrgencyReason.SYBIL_CLUSTER]: "Part of suspected sybil cluster",
  [UrgencyReason.INSIDER_INDICATOR]: "Strong indicators of insider knowledge",
  [UrgencyReason.TIME_SENSITIVE_MARKET]: "Market resolution imminent",
  [UrgencyReason.NEW_DETECTION]: "First time this wallet was flagged",
  [UrgencyReason.SCORE_ESCALATION]: "Suspicion score rapidly increasing",
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  ranking: AlertRanking;
  timestamp: number;
}

// ============================================================================
// Alert Priority Ranker Class
// ============================================================================

/**
 * Main alert priority ranker class
 */
export class AlertPriorityRanker extends EventEmitter {
  private readonly config: AlertPriorityRankerConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly alertHistory: Map<string, AlertHistoryEntry> = new Map();
  private readonly urgencyReasonCounts: Map<UrgencyReason, number> = new Map();
  private readonly factorContributions: Map<PriorityFactor, number[]> = new Map();

  // Processing statistics
  private totalProcessed = 0;
  private totalProcessingTimeMs = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: Partial<AlertPriorityRankerConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_RANKER_CONFIG,
      ...config,
      weights: { ...DEFAULT_PRIORITY_WEIGHTS, ...config.weights },
      levelThresholds: { ...DEFAULT_LEVEL_THRESHOLDS, ...config.levelThresholds },
      timeDecay: { ...DEFAULT_TIME_DECAY, ...config.timeDecay },
    };

    // Initialize tracking maps
    for (const reason of Object.values(UrgencyReason)) {
      this.urgencyReasonCounts.set(reason, 0);
    }
    for (const factor of Object.values(PriorityFactor)) {
      this.factorContributions.set(factor, []);
    }
  }

  /**
   * Rank a single alert
   */
  rankAlert(
    result: CompositeScoreResult,
    filterResult?: FilterResult,
    options: RankAlertOptions = {}
  ): AlertRanking {
    const startTime = Date.now();
    const address = getAddress(result.walletAddress);

    // Check cache
    if (options.useCache !== false) {
      const cached = this.cache.get(address);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
        this.cacheHits++;
        return { ...cached.ranking, fromCache: true };
      }
    }
    this.cacheMisses++;

    // Calculate factor contributions
    const factorContributions = this.calculateFactorContributions(result, filterResult);

    // Calculate priority score
    let priorityScore = this.calculatePriorityScore(factorContributions);

    // Apply time decay if enabled
    const alertAge = this.getAlertAgeHours(result);
    const timeDecayMultiplier = this.calculateTimeDecay(alertAge);

    if (this.config.timeDecay.enabled && !options.skipTimeDecay) {
      priorityScore *= timeDecayMultiplier;
    }

    // Clamp to 0-100
    priorityScore = Math.max(0, Math.min(100, Math.round(priorityScore)));

    // Determine priority level
    const priorityLevel = this.determinePriorityLevel(priorityScore);

    // Identify urgency reasons
    const urgencyReasons = this.identifyUrgencyReasons(result, filterResult, priorityScore);

    // Determine if urgent or highlighted
    const isUrgent = priorityScore >= this.config.urgentThreshold || urgencyReasons.length >= 2;
    const isHighlighted = priorityScore >= this.config.highlightThreshold;

    // Get top factors
    const topFactors = [...factorContributions]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3);

    // Generate summary and recommended action
    const summary = this.generateSummary(priorityScore, priorityLevel, topFactors, urgencyReasons);
    const recommendedAction = this.generateRecommendedAction(priorityLevel, urgencyReasons);

    // Update history
    this.updateAlertHistory(address, result.compositeScore);

    // Track statistics
    for (const reason of urgencyReasons) {
      this.urgencyReasonCounts.set(reason, (this.urgencyReasonCounts.get(reason) ?? 0) + 1);
    }
    for (const contribution of factorContributions) {
      const contributions = this.factorContributions.get(contribution.factor) ?? [];
      contributions.push(contribution.weightedScore);
      if (contributions.length > 1000) contributions.shift();
      this.factorContributions.set(contribution.factor, contributions);
    }

    const ranking: AlertRanking = {
      walletAddress: address,
      priorityScore,
      priorityLevel,
      rank: 0, // Will be set in batch ranking
      isUrgent,
      isHighlighted,
      urgencyReasons,
      factorContributions,
      topFactors,
      originalScore: result.compositeScore,
      adjustedScore: filterResult?.adjustedScore ?? null,
      suspicionLevel: result.suspicionLevel,
      timeDecayMultiplier,
      alertAgeHours: alertAge,
      summary,
      recommendedAction,
      originalResult: result,
      filterResult: filterResult ?? null,
      fromCache: false,
      rankedAt: new Date(),
    };

    // Cache result
    this.cache.set(address, { ranking, timestamp: Date.now() });
    this.maintainCacheSize();

    // Update processing stats
    this.totalProcessed++;
    this.totalProcessingTimeMs += Date.now() - startTime;

    // Emit events
    if (isHighlighted) {
      this.emit("alert-highlighted", {
        walletAddress: address,
        priorityScore,
        priorityLevel,
        urgencyReasons,
      });
    }

    if (isUrgent) {
      this.emit("urgent-alert", {
        walletAddress: address,
        priorityScore,
        priorityLevel,
        urgencyReasons,
      });
    }

    return ranking;
  }

  /**
   * Rank multiple alerts in batch
   */
  rankAlerts(
    results: CompositeScoreResult[],
    filterResults?: Map<string, FilterResult>,
    options: RankAlertOptions = {}
  ): BatchRankingResult {
    const rankings: AlertRanking[] = [];
    const byWallet = new Map<string, AlertRanking>();
    const failed = new Map<string, Error>();

    for (const result of results) {
      try {
        const filterResult = filterResults?.get(getAddress(result.walletAddress));
        const ranking = this.rankAlert(result, filterResult, options);
        rankings.push(ranking);
        byWallet.set(ranking.walletAddress, ranking);
      } catch (error) {
        failed.set(result.walletAddress, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Sort by priority score (descending) and assign ranks
    rankings.sort((a, b) => b.priorityScore - a.priorityScore);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    // Calculate by level counts
    const byLevel: Record<PriorityLevel, number> = {
      [PriorityLevel.CRITICAL]: 0,
      [PriorityLevel.HIGH]: 0,
      [PriorityLevel.MEDIUM]: 0,
      [PriorityLevel.LOW]: 0,
      [PriorityLevel.MINIMAL]: 0,
    };

    let urgentCount = 0;
    let highlightedCount = 0;

    for (const ranking of rankings) {
      byLevel[ranking.priorityLevel]++;
      if (ranking.isUrgent) urgentCount++;
      if (ranking.isHighlighted) highlightedCount++;
    }

    return {
      rankings,
      byWallet,
      failed,
      totalProcessed: results.length,
      byLevel,
      urgentCount,
      highlightedCount,
      processedAt: new Date(),
    };
  }

  /**
   * Get ranker summary statistics
   */
  getSummary(): RankerSummary {
    const byLevel: Record<PriorityLevel, number> = {
      [PriorityLevel.CRITICAL]: 0,
      [PriorityLevel.HIGH]: 0,
      [PriorityLevel.MEDIUM]: 0,
      [PriorityLevel.LOW]: 0,
      [PriorityLevel.MINIMAL]: 0,
    };

    let urgentAlerts = 0;
    let highlightedAlerts = 0;
    let totalScore = 0;

    for (const entry of this.cache.values()) {
      byLevel[entry.ranking.priorityLevel]++;
      if (entry.ranking.isUrgent) urgentAlerts++;
      if (entry.ranking.isHighlighted) highlightedAlerts++;
      totalScore += entry.ranking.priorityScore;
    }

    // Get common urgency reasons
    const commonUrgencyReasons = Array.from(this.urgencyReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get impactful factors
    const impactfulFactors: Array<{ factor: PriorityFactor; avgContribution: number }> = [];
    for (const [factor, contributions] of this.factorContributions.entries()) {
      if (contributions.length > 0) {
        const avg = contributions.reduce((a, b) => a + b, 0) / contributions.length;
        impactfulFactors.push({ factor, avgContribution: avg });
      }
    }
    impactfulFactors.sort((a, b) => b.avgContribution - a.avgContribution);

    return {
      totalRanked: this.cache.size,
      byLevel,
      urgentAlerts,
      highlightedAlerts,
      averagePriorityScore: this.cache.size > 0 ? totalScore / this.cache.size : 0,
      commonUrgencyReasons,
      impactfulFactors: impactfulFactors.slice(0, 5),
      cacheStats: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate(),
      },
      processingStats: {
        totalProcessed: this.totalProcessed,
        averageProcessingTimeMs:
          this.totalProcessed > 0 ? this.totalProcessingTimeMs / this.totalProcessed : 0,
      },
    };
  }

  /**
   * Get cached ranking for a wallet
   */
  getCachedRanking(walletAddress: string): AlertRanking | null {
    if (!isAddress(walletAddress)) {
      return null;
    }
    const cached = this.cache.get(getAddress(walletAddress));
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
      return cached.ranking;
    }
    return null;
  }

  /**
   * Get all urgent alerts from cache
   */
  getUrgentAlerts(): AlertRanking[] {
    const urgent: AlertRanking[] = [];
    for (const entry of this.cache.values()) {
      if (entry.ranking.isUrgent && Date.now() - entry.timestamp < this.config.cacheTtlMs) {
        urgent.push(entry.ranking);
      }
    }
    return urgent.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get highlighted alerts from cache
   */
  getHighlightedAlerts(): AlertRanking[] {
    const highlighted: AlertRanking[] = [];
    for (const entry of this.cache.values()) {
      if (entry.ranking.isHighlighted && Date.now() - entry.timestamp < this.config.cacheTtlMs) {
        highlighted.push(entry.ranking);
      }
    }
    return highlighted.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get alerts by priority level
   */
  getAlertsByLevel(level: PriorityLevel): AlertRanking[] {
    const alerts: AlertRanking[] = [];
    for (const entry of this.cache.values()) {
      if (entry.ranking.priorityLevel === level && Date.now() - entry.timestamp < this.config.cacheTtlMs) {
        alerts.push(entry.ranking);
      }
    }
    return alerts.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get top N priority alerts
   */
  getTopAlerts(count: number = 10): AlertRanking[] {
    const all: AlertRanking[] = [];
    for (const entry of this.cache.values()) {
      if (Date.now() - entry.timestamp < this.config.cacheTtlMs) {
        all.push(entry.ranking);
      }
    }
    return all.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, count);
  }

  /**
   * Get alert history for a wallet
   */
  getAlertHistory(walletAddress: string): AlertHistoryEntry | null {
    if (!isAddress(walletAddress)) {
      return null;
    }
    return this.alertHistory.get(getAddress(walletAddress)) ?? null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific wallet
   */
  invalidateCache(walletAddress: string): boolean {
    if (!isAddress(walletAddress)) {
      return false;
    }
    return this.cache.delete(getAddress(walletAddress));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertPriorityRankerConfig>): void {
    if (config.weights) {
      Object.assign(this.config.weights, config.weights);
    }
    if (config.levelThresholds) {
      Object.assign(this.config.levelThresholds, config.levelThresholds);
    }
    if (config.timeDecay) {
      Object.assign(this.config.timeDecay, config.timeDecay);
    }
    if (config.urgentThreshold !== undefined) {
      this.config.urgentThreshold = config.urgentThreshold;
    }
    if (config.highlightThreshold !== undefined) {
      this.config.highlightThreshold = config.highlightThreshold;
    }
    if (config.cacheTtlMs !== undefined) {
      this.config.cacheTtlMs = config.cacheTtlMs;
    }
    if (config.maxCacheSize !== undefined) {
      this.config.maxCacheSize = config.maxCacheSize;
    }
    if (config.maxHistoryPerWallet !== undefined) {
      this.config.maxHistoryPerWallet = config.maxHistoryPerWallet;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertPriorityRankerConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.totalProcessingTimeMs = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    for (const reason of Object.values(UrgencyReason)) {
      this.urgencyReasonCounts.set(reason, 0);
    }
    for (const factor of Object.values(PriorityFactor)) {
      this.factorContributions.set(factor, []);
    }
  }

  // ============================================================================
  // Private: Factor Calculation Methods
  // ============================================================================

  private calculateFactorContributions(
    result: CompositeScoreResult,
    filterResult?: FilterResult
  ): FactorContribution[] {
    const contributions: FactorContribution[] = [];

    // Severity factor
    contributions.push(this.calculateSeverityFactor(result));

    // Confidence factor
    contributions.push(this.calculateConfidenceFactor(result));

    // Recency factor
    contributions.push(this.calculateRecencyFactor(result));

    // Impact factor
    contributions.push(this.calculateImpactFactor(result));

    // Convergence factor
    contributions.push(this.calculateConvergenceFactor(result));

    // Market sensitivity factor
    contributions.push(this.calculateMarketSensitivityFactor(result));

    // Network risk factor
    contributions.push(this.calculateNetworkRiskFactor(result));

    // Pattern match factor
    contributions.push(this.calculatePatternMatchFactor(result, filterResult));

    // Anomaly intensity factor
    contributions.push(this.calculateAnomalyIntensityFactor(result));

    // Novelty factor
    contributions.push(this.calculateNoveltyFactor(result));

    return contributions;
  }

  private calculateSeverityFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.SEVERITY];
    const rawScore = result.compositeScore;

    return {
      factor: PriorityFactor.SEVERITY,
      name: "Suspicion Severity",
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      reason: `Composite suspicion score: ${rawScore}/100 (${result.suspicionLevel})`,
    };
  }

  private calculateConfidenceFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.CONFIDENCE];

    // Calculate confidence based on data quality and available signals
    const dataQualityScore = result.dataQuality;
    const signalCoverageScore = (result.availableSignals / result.totalSignals) * 100;

    // Weight data quality more heavily
    const rawScore = dataQualityScore * 0.6 + signalCoverageScore * 0.4;

    return {
      factor: PriorityFactor.CONFIDENCE,
      name: "Signal Confidence",
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      reason: `Data quality: ${Math.round(dataQualityScore)}%, Signal coverage: ${result.availableSignals}/${result.totalSignals}`,
    };
  }

  private calculateRecencyFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.RECENCY];

    // Calculate recency based on analysis time
    // More recent = higher score
    const analysisAge = Date.now() - result.analyzedAt.getTime();
    const hoursAgo = analysisAge / (1000 * 60 * 60);

    // Decay from 100 to 20 over 72 hours
    const rawScore = Math.max(20, 100 - (hoursAgo / 72) * 80);

    return {
      factor: PriorityFactor.RECENCY,
      name: "Activity Recency",
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      reason: hoursAgo < 1
        ? "Activity detected within the last hour"
        : `Activity detected ${Math.round(hoursAgo)} hours ago`,
    };
  }

  private calculateImpactFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.IMPACT];

    // Estimate impact based on P&L and position sizing data
    let impactScore = 50; // Default moderate impact

    const pnl = result.underlyingResults.profitLoss;
    if (pnl) {
      const totalValue = Math.abs(pnl.aggregates.totalRealizedPnl) + Math.abs(pnl.aggregates.totalUnrealizedPnl);
      if (totalValue > 100000) impactScore = 95;
      else if (totalValue > 50000) impactScore = 80;
      else if (totalValue > 10000) impactScore = 65;
      else if (totalValue > 1000) impactScore = 50;
      else impactScore = 35;
    }

    const sizing = result.underlyingResults.sizing;
    if (sizing && sizing.distribution.max > 10000) {
      impactScore = Math.min(100, impactScore + 15);
    }

    return {
      factor: PriorityFactor.IMPACT,
      name: "Financial Impact",
      rawScore: impactScore,
      weight,
      weightedScore: impactScore * weight,
      reason: impactScore >= 80
        ? "High-value positions detected"
        : impactScore >= 60
          ? "Moderate position sizes"
          : "Standard position sizes",
    };
  }

  private calculateConvergenceFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.CONVERGENCE];

    // Count high-scoring signals
    const highScoreSignals = result.signalContributions.filter(
      (s) => s.available && s.rawScore >= 60
    );

    const veryHighScoreSignals = result.signalContributions.filter(
      (s) => s.available && s.rawScore >= 80
    );

    let rawScore = 0;
    if (veryHighScoreSignals.length >= 3) rawScore = 100;
    else if (veryHighScoreSignals.length >= 2) rawScore = 85;
    else if (highScoreSignals.length >= 4) rawScore = 75;
    else if (highScoreSignals.length >= 3) rawScore = 60;
    else if (highScoreSignals.length >= 2) rawScore = 45;
    else if (highScoreSignals.length >= 1) rawScore = 30;
    else rawScore = 10;

    return {
      factor: PriorityFactor.CONVERGENCE,
      name: "Signal Convergence",
      rawScore,
      weight,
      weightedScore: rawScore * weight,
      reason: `${highScoreSignals.length} signals above 60%, ${veryHighScoreSignals.length} above 80%`,
    };
  }

  private calculateMarketSensitivityFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.MARKET_SENSITIVITY];

    // Check market selection for high-value categories
    let sensitivityScore = 50; // Default moderate

    const selection = result.underlyingResults.selection;
    if (selection) {
      // Higher sensitivity for insider-like selection patterns
      if (selection.primaryPattern === SelectionPatternType.INSIDER_LIKE) {
        sensitivityScore = 90;
      } else if (selection.suspicionScore >= 70) {
        sensitivityScore = 75;
      }
    }

    return {
      factor: PriorityFactor.MARKET_SENSITIVITY,
      name: "Market Sensitivity",
      rawScore: sensitivityScore,
      weight,
      weightedScore: sensitivityScore * weight,
      reason: sensitivityScore >= 80
        ? "Trading in high-sensitivity markets"
        : "Normal market selection",
    };
  }

  private calculateNetworkRiskFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.NETWORK_RISK];

    let networkScore = 0;
    const reasons: string[] = [];

    // Check coordination
    const coordination = result.underlyingResults.coordination;
    if (coordination?.isCoordinated) {
      networkScore = Math.max(networkScore, 70);
      reasons.push(`Coordinated with ${coordination.groupCount} group(s)`);
    }

    // Check sybil
    const sybil = result.underlyingResults.sybil;
    if (sybil?.isLikelySybil) {
      networkScore = Math.max(networkScore, sybil.sybilProbability);
      reasons.push(`Sybil probability: ${Math.round(sybil.sybilProbability)}%`);
    }

    return {
      factor: PriorityFactor.NETWORK_RISK,
      name: "Network Risk",
      rawScore: networkScore,
      weight,
      weightedScore: networkScore * weight,
      reason: reasons.length > 0 ? reasons.join("; ") : "No network risks detected",
    };
  }

  private calculatePatternMatchFactor(
    result: CompositeScoreResult,
    filterResult?: FilterResult
  ): FactorContribution {
    const weight = this.config.weights[PriorityFactor.PATTERN_MATCH];

    let patternScore = 0;
    const reasons: string[] = [];

    // Check trading pattern classification
    const pattern = result.underlyingResults.pattern;
    if (pattern) {
      // Check for suspicious patterns
      const suspiciousPatterns = ["POTENTIAL_INSIDER", "BOT", "WASH_TRADER"];
      if (suspiciousPatterns.includes(pattern.primaryPattern)) {
        patternScore = Math.max(patternScore, 85);
        reasons.push(`Pattern: ${pattern.primaryPattern}`);
      }

      if (pattern.riskFlags.length > 0) {
        patternScore = Math.max(patternScore, 40 + pattern.riskFlags.length * 10);
        reasons.push(`${pattern.riskFlags.length} risk flags`);
      }
    }

    // Reduce if filter identified likely false positive
    if (filterResult?.isLikelyFalsePositive) {
      patternScore = Math.max(0, patternScore - 30);
      reasons.push("Likely false positive pattern");
    }

    return {
      factor: PriorityFactor.PATTERN_MATCH,
      name: "Pattern Match",
      rawScore: patternScore,
      weight,
      weightedScore: patternScore * weight,
      reason: reasons.length > 0 ? reasons.join("; ") : "No suspicious patterns detected",
    };
  }

  private calculateAnomalyIntensityFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.ANOMALY_INTENSITY];

    // Count anomalies across different results
    let anomalyCount = 0;
    let totalSeverity = 0;

    if (result.underlyingResults.winRate?.anomalies) {
      anomalyCount += result.underlyingResults.winRate.anomalies.length;
    }
    if (result.underlyingResults.profitLoss?.anomalies) {
      anomalyCount += result.underlyingResults.profitLoss.anomalies.length;
    }
    if (result.underlyingResults.timing?.anomalies) {
      anomalyCount += result.underlyingResults.timing.anomalies.length;
    }
    if (result.underlyingResults.accuracy?.anomalies) {
      anomalyCount += result.underlyingResults.accuracy.anomalies.length;
    }

    // Score based on anomaly count
    totalSeverity = Math.min(100, anomalyCount * 15);

    return {
      factor: PriorityFactor.ANOMALY_INTENSITY,
      name: "Anomaly Intensity",
      rawScore: totalSeverity,
      weight,
      weightedScore: totalSeverity * weight,
      reason: anomalyCount > 0
        ? `${anomalyCount} behavioral anomalies detected`
        : "No anomalies detected",
    };
  }

  private calculateNoveltyFactor(result: CompositeScoreResult): FactorContribution {
    const weight = this.config.weights[PriorityFactor.NOVELTY];

    const address = getAddress(result.walletAddress);
    const history = this.alertHistory.get(address);

    let noveltyScore = 0;
    let reason = "";

    if (!history) {
      // First time seeing this wallet
      noveltyScore = 100;
      reason = "First-time detection";
    } else {
      // Check for score escalation
      const previousScores = history.previousScores;
      if (previousScores.length > 0) {
        const avgPrevious = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
        const scoreDiff = result.compositeScore - avgPrevious;

        if (scoreDiff > 20) {
          noveltyScore = 80;
          reason = `Score increased by ${Math.round(scoreDiff)} points`;
        } else if (scoreDiff > 10) {
          noveltyScore = 50;
          reason = `Score increased by ${Math.round(scoreDiff)} points`;
        } else {
          noveltyScore = 20;
          reason = `Seen ${history.timesRanked} times before`;
        }
      } else {
        noveltyScore = 30;
        reason = "Previously tracked wallet";
      }
    }

    return {
      factor: PriorityFactor.NOVELTY,
      name: "Alert Novelty",
      rawScore: noveltyScore,
      weight,
      weightedScore: noveltyScore * weight,
      reason,
    };
  }

  // ============================================================================
  // Private: Score Calculation
  // ============================================================================

  private calculatePriorityScore(contributions: FactorContribution[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const contribution of contributions) {
      totalScore += contribution.weightedScore;
      totalWeight += contribution.weight;
    }

    // Normalize by total weight
    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

  private calculateTimeDecay(ageHours: number): number {
    const { decayStartHours, decayRatePerHour, minMultiplier } = this.config.timeDecay;

    if (ageHours <= decayStartHours) {
      return 1.0;
    }

    const hoursOverThreshold = ageHours - decayStartHours;
    const decay = 1.0 - (hoursOverThreshold * decayRatePerHour) / 100;

    return Math.max(minMultiplier, decay);
  }

  private getAlertAgeHours(result: CompositeScoreResult): number {
    return (Date.now() - result.analyzedAt.getTime()) / (1000 * 60 * 60);
  }

  private determinePriorityLevel(score: number): PriorityLevel {
    if (score >= this.config.levelThresholds.critical) return PriorityLevel.CRITICAL;
    if (score >= this.config.levelThresholds.high) return PriorityLevel.HIGH;
    if (score >= this.config.levelThresholds.medium) return PriorityLevel.MEDIUM;
    if (score >= this.config.levelThresholds.low) return PriorityLevel.LOW;
    return PriorityLevel.MINIMAL;
  }

  // ============================================================================
  // Private: Urgency Detection
  // ============================================================================

  private identifyUrgencyReasons(
    result: CompositeScoreResult,
    _filterResult: FilterResult | undefined,
    _priorityScore: number
  ): UrgencyReason[] {
    const reasons: UrgencyReason[] = [];

    // Critical score
    if (result.compositeScore >= 80) {
      reasons.push(UrgencyReason.CRITICAL_SCORE);
    }

    // Multi-signal convergence
    const highSignals = result.signalContributions.filter(
      (s) => s.available && s.rawScore >= 70
    );
    if (highSignals.length >= 3) {
      reasons.push(UrgencyReason.MULTI_SIGNAL_CONVERGENCE);
    }

    // Recent activity
    const ageHours = this.getAlertAgeHours(result);
    if (ageHours < 6) {
      reasons.push(UrgencyReason.RECENT_ACTIVITY);
    }

    // High impact
    const pnl = result.underlyingResults.profitLoss;
    if (pnl) {
      const totalValue = Math.abs(pnl.aggregates.totalRealizedPnl) + Math.abs(pnl.aggregates.totalUnrealizedPnl);
      if (totalValue > 50000) {
        reasons.push(UrgencyReason.HIGH_IMPACT);
      }
    }

    // Network detection
    if (result.underlyingResults.coordination?.isCoordinated) {
      reasons.push(UrgencyReason.NETWORK_DETECTION);
    }

    // Sybil cluster
    if (result.underlyingResults.sybil?.isLikelySybil) {
      reasons.push(UrgencyReason.SYBIL_CLUSTER);
    }

    // Insider indicator
    if (result.isPotentialInsider) {
      reasons.push(UrgencyReason.INSIDER_INDICATOR);
    }

    // New detection
    const history = this.alertHistory.get(getAddress(result.walletAddress));
    if (!history) {
      reasons.push(UrgencyReason.NEW_DETECTION);
    } else {
      // Score escalation
      const avgPrevious = history.previousScores.length > 0
        ? history.previousScores.reduce((a, b) => a + b, 0) / history.previousScores.length
        : 0;
      if (result.compositeScore - avgPrevious > 20) {
        reasons.push(UrgencyReason.SCORE_ESCALATION);
      }
    }

    return reasons;
  }

  // ============================================================================
  // Private: Summary Generation
  // ============================================================================

  private generateSummary(
    priorityScore: number,
    level: PriorityLevel,
    topFactors: FactorContribution[],
    urgencyReasons: UrgencyReason[]
  ): string {
    const parts: string[] = [];

    parts.push(`Priority: ${level} (${priorityScore}/100)`);

    if (topFactors.length > 0) {
      const topFactor = topFactors[0]!;
      parts.push(`Primary driver: ${topFactor.name}`);
    }

    if (urgencyReasons.length > 0) {
      parts.push(`${urgencyReasons.length} urgency indicator(s)`);
    }

    return parts.join(" | ");
  }

  private generateRecommendedAction(level: PriorityLevel, urgencyReasons: UrgencyReason[]): string {
    switch (level) {
      case PriorityLevel.CRITICAL:
        if (urgencyReasons.includes(UrgencyReason.INSIDER_INDICATOR)) {
          return "IMMEDIATE: Investigate for potential insider trading. Consider escalating to compliance.";
        }
        if (urgencyReasons.includes(UrgencyReason.NETWORK_DETECTION)) {
          return "IMMEDIATE: Investigate coordinated trading network. Identify all related wallets.";
        }
        return "IMMEDIATE: High-priority investigation required. Review all signals and recent activity.";

      case PriorityLevel.HIGH:
        if (urgencyReasons.includes(UrgencyReason.SCORE_ESCALATION)) {
          return "URGENT: Suspicion score increasing rapidly. Monitor closely and investigate.";
        }
        return "URGENT: Detailed review recommended within 24 hours. Cross-reference with other alerts.";

      case PriorityLevel.MEDIUM:
        return "STANDARD: Include in regular review queue. Document findings for pattern tracking.";

      case PriorityLevel.LOW:
        return "LOWER: Batch review acceptable. Monitor for any score escalation.";

      case PriorityLevel.MINIMAL:
        return "MINIMAL: Background monitoring only. No immediate action required.";

      default:
        return "Review alert details and prioritize based on available resources.";
    }
  }

  // ============================================================================
  // Private: Helper Methods
  // ============================================================================

  private updateAlertHistory(address: string, score: number): void {
    const existing = this.alertHistory.get(address);

    if (existing) {
      existing.lastSeen = new Date();
      existing.previousScores.push(score);
      existing.timesRanked++;

      // Trim history if too long
      if (existing.previousScores.length > this.config.maxHistoryPerWallet) {
        existing.previousScores = existing.previousScores.slice(-this.config.maxHistoryPerWallet);
      }
    } else {
      this.alertHistory.set(address, {
        firstSeen: new Date(),
        lastSeen: new Date(),
        previousScores: [score],
        timesRanked: 1,
      });
    }

    // Limit history map size
    if (this.alertHistory.size > this.config.maxCacheSize * 2) {
      // Remove oldest entries
      const entries = Array.from(this.alertHistory.entries())
        .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime());

      const toRemove = entries.slice(0, this.alertHistory.size - this.config.maxCacheSize);
      for (const [key] of toRemove) {
        this.alertHistory.delete(key);
      }
    }
  }

  private maintainCacheSize(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private calculateCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
}

// ============================================================================
// Options Interface
// ============================================================================

/**
 * Options for ranking an alert
 */
export interface RankAlertOptions {
  /** Use cached result if available */
  useCache?: boolean;
  /** Skip time decay calculation */
  skipTimeDecay?: boolean;
}

// ============================================================================
// Factory Functions and Shared Instance
// ============================================================================

let sharedInstance: AlertPriorityRanker | null = null;

/**
 * Create a new alert priority ranker instance
 */
export function createAlertPriorityRanker(
  config?: Partial<AlertPriorityRankerConfig>
): AlertPriorityRanker {
  return new AlertPriorityRanker(config);
}

/**
 * Get or create the shared alert priority ranker instance
 */
export function getSharedAlertPriorityRanker(): AlertPriorityRanker {
  if (!sharedInstance) {
    sharedInstance = new AlertPriorityRanker();
  }
  return sharedInstance;
}

/**
 * Set the shared alert priority ranker instance
 */
export function setSharedAlertPriorityRanker(ranker: AlertPriorityRanker): void {
  sharedInstance = ranker;
}

/**
 * Reset the shared alert priority ranker instance
 */
export function resetSharedAlertPriorityRanker(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Rank a single alert using the shared instance
 */
export function rankAlert(
  result: CompositeScoreResult,
  filterResult?: FilterResult,
  options?: RankAlertOptions
): AlertRanking {
  return getSharedAlertPriorityRanker().rankAlert(result, filterResult, options);
}

/**
 * Rank multiple alerts using the shared instance
 */
export function rankAlerts(
  results: CompositeScoreResult[],
  filterResults?: Map<string, FilterResult>,
  options?: RankAlertOptions
): BatchRankingResult {
  return getSharedAlertPriorityRanker().rankAlerts(results, filterResults, options);
}

/**
 * Get urgent alerts from the shared instance
 */
export function getUrgentAlerts(): AlertRanking[] {
  return getSharedAlertPriorityRanker().getUrgentAlerts();
}

/**
 * Get highlighted alerts from the shared instance
 */
export function getHighlightedAlerts(): AlertRanking[] {
  return getSharedAlertPriorityRanker().getHighlightedAlerts();
}

/**
 * Get top priority alerts from the shared instance
 */
export function getTopPriorityAlerts(count?: number): AlertRanking[] {
  return getSharedAlertPriorityRanker().getTopAlerts(count);
}

/**
 * Get alerts by priority level from the shared instance
 */
export function getAlertsByPriorityLevel(level: PriorityLevel): AlertRanking[] {
  return getSharedAlertPriorityRanker().getAlertsByLevel(level);
}

/**
 * Get ranker summary from the shared instance
 */
export function getAlertPriorityRankerSummary(): RankerSummary {
  return getSharedAlertPriorityRanker().getSummary();
}

/**
 * Get priority level description
 */
export function getPriorityLevelDescription(level: PriorityLevel): string {
  return PRIORITY_LEVEL_DESCRIPTIONS[level] ?? "Unknown priority level";
}

/**
 * Get priority factor description
 */
export function getPriorityFactorDescription(factor: PriorityFactor): string {
  return PRIORITY_FACTOR_DESCRIPTIONS[factor] ?? "Unknown priority factor";
}

/**
 * Get urgency reason description
 */
export function getUrgencyReasonDescription(reason: UrgencyReason): string {
  return URGENCY_REASON_DESCRIPTIONS[reason] ?? "Unknown urgency reason";
}

/**
 * Check if a wallet has an urgent alert
 */
export function hasUrgentAlert(walletAddress: string): boolean {
  const ranking = getSharedAlertPriorityRanker().getCachedRanking(walletAddress);
  return ranking?.isUrgent ?? false;
}

/**
 * Get the priority ranking for a wallet
 */
export function getWalletPriorityRanking(walletAddress: string): AlertRanking | null {
  return getSharedAlertPriorityRanker().getCachedRanking(walletAddress);
}
