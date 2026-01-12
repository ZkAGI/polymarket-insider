/**
 * False Positive Reducer (DET-SCORE-004)
 *
 * Apply filters to reduce false positive alerts. This module analyzes
 * composite score results and applies pattern-based filtering to identify
 * likely false positives, reducing alert fatigue.
 *
 * Features:
 * - Define false positive patterns
 * - Apply filtering rules
 * - Track filter effectiveness
 * - Tune filters over time
 * - Support batch analysis
 * - Event emission for filtered alerts
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";
import {
  type CompositeScoreResult,
  CompositeSuspicionLevel,
  SignalSource,
} from "./composite-suspicion-scorer";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * False positive pattern identifier
 */
export enum FalsePositivePattern {
  /** High volume trader with consistent behavior */
  CONSISTENT_HIGH_VOLUME = "CONSISTENT_HIGH_VOLUME",
  /** Market maker patterns */
  MARKET_MAKER = "MARKET_MAKER",
  /** Whale trader with long history */
  ESTABLISHED_WHALE = "ESTABLISHED_WHALE",
  /** Arbitrage bot behavior */
  ARBITRAGE_BOT = "ARBITRAGE_BOT",
  /** Index/portfolio rebalancer */
  PORTFOLIO_REBALANCER = "PORTFOLIO_REBALANCER",
  /** DCA (Dollar Cost Averaging) pattern */
  DCA_TRADER = "DCA_TRADER",
  /** News-reactive trader */
  NEWS_REACTIVE = "NEWS_REACTIVE",
  /** Low signal confidence */
  LOW_SIGNAL_CONFIDENCE = "LOW_SIGNAL_CONFIDENCE",
  /** Isolated high signal with low overall pattern */
  ISOLATED_SIGNAL_SPIKE = "ISOLATED_SIGNAL_SPIKE",
  /** Multiple small consistent trades */
  RETAIL_PATTERN = "RETAIL_PATTERN",
  /** Seasonal or event-based trading */
  EVENT_TRADER = "EVENT_TRADER",
  /** Normal volatility response */
  VOLATILITY_RESPONSE = "VOLATILITY_RESPONSE",
}

/**
 * Filter action taken
 */
export enum FilterAction {
  /** No action - alert passes through */
  PASS = "PASS",
  /** Reduce score */
  REDUCE_SCORE = "REDUCE_SCORE",
  /** Mark as likely false positive */
  MARK_FALSE_POSITIVE = "MARK_FALSE_POSITIVE",
  /** Suppress alert entirely */
  SUPPRESS = "SUPPRESS",
  /** Defer for human review */
  DEFER = "DEFER",
}

/**
 * Filter confidence level
 */
export enum FilterConfidence {
  /** Very low confidence in filter decision */
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
 * Filter priority for ordering
 */
export enum FilterPriority {
  /** Critical filters - run first */
  CRITICAL = 0,
  /** High priority */
  HIGH = 1,
  /** Normal priority */
  NORMAL = 2,
  /** Low priority */
  LOW = 3,
}

/**
 * Filter outcome for tracking
 */
export enum FilterOutcome {
  /** Filter correctly identified FP */
  TRUE_NEGATIVE = "TRUE_NEGATIVE",
  /** Filter incorrectly suppressed real alert */
  FALSE_NEGATIVE = "FALSE_NEGATIVE",
  /** Filter correctly passed real alert */
  TRUE_POSITIVE = "TRUE_POSITIVE",
  /** Filter incorrectly passed FP */
  FALSE_POSITIVE = "FALSE_POSITIVE",
  /** Outcome not yet determined */
  PENDING = "PENDING",
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Filter rule definition
 */
export interface FilterRule {
  /** Unique rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Pattern this rule detects */
  pattern: FalsePositivePattern;
  /** Action to take when matched */
  action: FilterAction;
  /** Priority for ordering */
  priority: FilterPriority;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Minimum score to apply this rule */
  minScore?: number;
  /** Maximum score to apply this rule */
  maxScore?: number;
  /** Score reduction amount (for REDUCE_SCORE action) */
  scoreReduction?: number;
  /** Required signal sources for this rule */
  requiredSignals?: SignalSource[];
  /** Minimum data quality to apply */
  minDataQuality?: number;
  /** Minimum available signals */
  minAvailableSignals?: number;
  /** Custom condition function */
  condition?: (result: CompositeScoreResult) => boolean;
}

/**
 * Filter match result
 */
export interface FilterMatch {
  /** Rule that matched */
  rule: FilterRule;
  /** Confidence in the match */
  confidence: FilterConfidence;
  /** Reason for match */
  reason: string;
  /** Supporting evidence */
  evidence: string[];
  /** Match score (0-100) */
  matchScore: number;
}

/**
 * Filter application result
 */
export interface FilterResult {
  /** Original wallet address */
  walletAddress: string;
  /** Original composite score */
  originalScore: number;
  /** Adjusted score after filtering */
  adjustedScore: number;
  /** Original suspicion level */
  originalLevel: CompositeSuspicionLevel;
  /** Adjusted suspicion level */
  adjustedLevel: CompositeSuspicionLevel;
  /** Whether marked as likely false positive */
  isLikelyFalsePositive: boolean;
  /** Whether alert was suppressed */
  isSuppressed: boolean;
  /** Whether deferred for review */
  isDeferred: boolean;
  /** Primary action taken */
  action: FilterAction;
  /** All filter matches */
  matches: FilterMatch[];
  /** Primary pattern detected */
  primaryPattern: FalsePositivePattern | null;
  /** Overall filter confidence */
  confidence: FilterConfidence;
  /** Reasons for filtering */
  filterReasons: string[];
  /** Score reduction applied */
  scoreReduction: number;
  /** Original result reference */
  originalResult: CompositeScoreResult;
  /** From cache */
  fromCache: boolean;
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Filter effectiveness metrics
 */
export interface FilterEffectiveness {
  /** Total applications */
  totalApplications: number;
  /** True negatives (correctly filtered FPs) */
  trueNegatives: number;
  /** False negatives (incorrectly filtered real alerts) */
  falseNegatives: number;
  /** True positives (correctly passed real alerts) */
  truePositives: number;
  /** False positives (incorrectly passed FPs) */
  falsePositives: number;
  /** Pending outcome determinations */
  pending: number;
  /** Precision (TP / (TP + FP)) */
  precision: number;
  /** Recall (TP / (TP + FN)) */
  recall: number;
  /** F1 score */
  f1Score: number;
  /** False positive rate before filtering */
  preFpRate: number;
  /** False positive rate after filtering */
  postFpRate: number;
  /** Reduction in false positives */
  fpReduction: number;
}

/**
 * Filter statistics by pattern
 */
export interface PatternStatistics {
  /** Pattern identifier */
  pattern: FalsePositivePattern;
  /** Total matches */
  matchCount: number;
  /** Average match confidence */
  averageConfidence: number;
  /** Average score reduction */
  averageScoreReduction: number;
  /** Outcome breakdown */
  outcomes: Record<FilterOutcome, number>;
  /** Last match timestamp */
  lastMatch: Date | null;
}

/**
 * Rule statistics
 */
export interface RuleStatistics {
  /** Rule identifier */
  ruleId: string;
  /** Total applications */
  applications: number;
  /** Matches */
  matches: number;
  /** Match rate */
  matchRate: number;
  /** Outcome breakdown */
  outcomes: Record<FilterOutcome, number>;
  /** Average confidence when matched */
  averageConfidence: number;
  /** Last applied timestamp */
  lastApplied: Date | null;
}

/**
 * Batch filter result
 */
export interface BatchFilterResult {
  /** Results by wallet address */
  results: Map<string, FilterResult>;
  /** Failed wallets */
  failed: Map<string, Error>;
  /** Total processed */
  totalProcessed: number;
  /** Total filtered as false positive */
  totalFiltered: number;
  /** Total suppressed */
  totalSuppressed: number;
  /** Average score reduction */
  averageScoreReduction: number;
  /** Pattern breakdown */
  byPattern: Record<FalsePositivePattern, number>;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Reducer summary
 */
export interface ReducerSummary {
  /** Total wallets analyzed */
  totalAnalyzed: number;
  /** Total marked as false positive */
  totalFalsePositives: number;
  /** Total suppressed */
  totalSuppressed: number;
  /** Total deferred */
  totalDeferred: number;
  /** Average score reduction */
  averageScoreReduction: number;
  /** Active rules count */
  activeRules: number;
  /** Total rules count */
  totalRules: number;
  /** Filter effectiveness */
  effectiveness: FilterEffectiveness;
  /** Pattern statistics */
  patternStats: PatternStatistics[];
  /** Rule statistics */
  ruleStats: RuleStatistics[];
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
  };
}

/**
 * Outcome feedback for tuning
 */
export interface OutcomeFeedback {
  /** Wallet address */
  walletAddress: string;
  /** True outcome */
  trueOutcome: FilterOutcome;
  /** Verification source */
  verificationSource: string;
  /** Timestamp */
  timestamp: Date;
  /** Notes */
  notes?: string;
}

/**
 * False positive reducer configuration
 */
export interface FalsePositiveReducerConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Minimum score for filtering */
  minScoreForFiltering: number;
  /** Maximum score for automatic suppression */
  maxScoreForSuppression: number;
  /** Default score reduction */
  defaultScoreReduction: number;
  /** Minimum pattern matches for suppression */
  minMatchesForSuppression: number;
  /** Minimum confidence for action */
  minConfidenceForAction: FilterConfidence;
  /** Enable automatic rule tuning */
  enableAutoTuning: boolean;
  /** Tuning sample size */
  tuningSampleSize: number;
  /** Minimum applications before tuning */
  minApplicationsForTuning: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_REDUCER_CONFIG: FalsePositiveReducerConfig = {
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  minScoreForFiltering: 20,
  maxScoreForSuppression: 60,
  defaultScoreReduction: 15,
  minMatchesForSuppression: 2,
  minConfidenceForAction: FilterConfidence.MEDIUM,
  enableAutoTuning: true,
  tuningSampleSize: 100,
  minApplicationsForTuning: 50,
};

/**
 * Pattern descriptions
 */
export const PATTERN_DESCRIPTIONS: Record<FalsePositivePattern, string> = {
  [FalsePositivePattern.CONSISTENT_HIGH_VOLUME]:
    "High volume trader with consistent, predictable behavior patterns",
  [FalsePositivePattern.MARKET_MAKER]:
    "Market maker providing liquidity with two-sided trading",
  [FalsePositivePattern.ESTABLISHED_WHALE]:
    "Large trader with long history and established reputation",
  [FalsePositivePattern.ARBITRAGE_BOT]:
    "Automated arbitrage trading with consistent patterns",
  [FalsePositivePattern.PORTFOLIO_REBALANCER]:
    "Regular portfolio rebalancing trades across markets",
  [FalsePositivePattern.DCA_TRADER]:
    "Dollar cost averaging with regular, small trades",
  [FalsePositivePattern.NEWS_REACTIVE]:
    "Reactive trading following news events (legitimate)",
  [FalsePositivePattern.LOW_SIGNAL_CONFIDENCE]:
    "Low confidence in underlying signals",
  [FalsePositivePattern.ISOLATED_SIGNAL_SPIKE]:
    "Single high signal with otherwise normal patterns",
  [FalsePositivePattern.RETAIL_PATTERN]:
    "Typical retail trader with small, consistent trades",
  [FalsePositivePattern.EVENT_TRADER]:
    "Trading around scheduled events (elections, earnings)",
  [FalsePositivePattern.VOLATILITY_RESPONSE]:
    "Normal response to market volatility",
};

/**
 * Filter confidence scores
 */
export const CONFIDENCE_SCORES: Record<FilterConfidence, number> = {
  [FilterConfidence.VERY_LOW]: 20,
  [FilterConfidence.LOW]: 40,
  [FilterConfidence.MEDIUM]: 60,
  [FilterConfidence.HIGH]: 80,
  [FilterConfidence.VERY_HIGH]: 95,
};

/**
 * Confidence thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  veryLow: 20,
  low: 40,
  medium: 60,
  high: 80,
  veryHigh: 90,
};

/**
 * Default filter rules
 */
export const DEFAULT_FILTER_RULES: FilterRule[] = [
  {
    id: "low-data-quality",
    name: "Low Data Quality Filter",
    description: "Reduce score when data quality is too low for reliable analysis",
    pattern: FalsePositivePattern.LOW_SIGNAL_CONFIDENCE,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.CRITICAL,
    enabled: true,
    minDataQuality: 0,
    scoreReduction: 20,
    condition: (result) => result.dataQuality < 40,
  },
  {
    id: "insufficient-signals",
    name: "Insufficient Signals Filter",
    description: "Flag when too few signals are available for reliable analysis",
    pattern: FalsePositivePattern.LOW_SIGNAL_CONFIDENCE,
    action: FilterAction.DEFER,
    priority: FilterPriority.CRITICAL,
    enabled: true,
    // Note: minAvailableSignals is intentionally NOT set here because this rule
    // detects insufficient signals - the condition handles the threshold check
    condition: (result) => result.availableSignals < 3,
  },
  {
    id: "isolated-signal-spike",
    name: "Isolated Signal Spike Filter",
    description: "Reduce score when only one signal is driving high score",
    pattern: FalsePositivePattern.ISOLATED_SIGNAL_SPIKE,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.HIGH,
    enabled: true,
    minScore: 50,
    scoreReduction: 15,
    condition: (result) => {
      const available = result.signalContributions.filter((s) => s.available);
      if (available.length < 3) return false;
      const sorted = [...available].sort((a, b) => b.weightedScore - a.weightedScore);
      const topScore = sorted[0]?.weightedScore ?? 0;
      const secondScore = sorted[1]?.weightedScore ?? 0;
      return topScore > 0 && secondScore > 0 && topScore > secondScore * 2.5;
    },
  },
  {
    id: "consistent-high-volume",
    name: "Consistent High Volume Trader",
    description: "Identify consistent high-volume traders who may appear suspicious",
    pattern: FalsePositivePattern.CONSISTENT_HIGH_VOLUME,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    minScore: 40,
    maxScore: 70,
    scoreReduction: 10,
    condition: (result) => {
      const sizingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.POSITION_SIZING
      );
      const timingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.TIMING_PATTERN
      );
      const patternSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.TRADING_PATTERN
      );

      // High volume but consistent timing and sizing
      return (
        sizingSignal?.available === true &&
        sizingSignal.rawScore > 50 &&
        timingSignal?.available === true &&
        timingSignal.rawScore < 30 &&
        patternSignal?.available === true &&
        patternSignal.rawScore < 40
      );
    },
  },
  {
    id: "market-maker-pattern",
    name: "Market Maker Pattern",
    description: "Identify market maker behavior that may trigger false alerts",
    pattern: FalsePositivePattern.MARKET_MAKER,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    minScore: 30,
    scoreReduction: 12,
    condition: (result) => {
      // Market makers typically have:
      // - High trading frequency
      // - Balanced buy/sell ratios
      // - Low win rate suspicion (they profit from spread, not direction)
      const winRateSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.WIN_RATE
      );
      const coordinationSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.COORDINATION
      );
      const selectionSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.MARKET_SELECTION
      );

      return (
        winRateSignal?.available === true &&
        winRateSignal.rawScore < 25 &&
        coordinationSignal?.available === true &&
        coordinationSignal.rawScore < 30 &&
        selectionSignal?.available === true &&
        selectionSignal.rawScore > 40 // Diverse market selection
      );
    },
  },
  {
    id: "established-whale",
    name: "Established Whale Trader",
    description: "Reduce suspicion for whales with established history",
    pattern: FalsePositivePattern.ESTABLISHED_WHALE,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    minScore: 40,
    scoreReduction: 8,
    condition: (result) => {
      const freshWalletSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.FRESH_WALLET
      );
      const sizingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.POSITION_SIZING
      );

      // Old wallet (low fresh wallet score) with large positions
      return (
        freshWalletSignal?.available === true &&
        freshWalletSignal.rawScore < 20 &&
        sizingSignal?.available === true &&
        sizingSignal.rawScore > 60
      );
    },
  },
  {
    id: "retail-pattern",
    name: "Retail Trading Pattern",
    description: "Identify typical retail trading patterns",
    pattern: FalsePositivePattern.RETAIL_PATTERN,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    minScore: 30,
    maxScore: 60,
    scoreReduction: 10,
    condition: (result) => {
      const sizingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.POSITION_SIZING
      );
      const accuracySignal = result.signalContributions.find(
        (s) => s.source === SignalSource.ACCURACY
      );

      // Small positions with average accuracy
      return (
        sizingSignal?.available === true &&
        sizingSignal.rawScore < 30 &&
        accuracySignal?.available === true &&
        accuracySignal.rawScore < 40
      );
    },
  },
  {
    id: "dca-trader",
    name: "DCA Trader Pattern",
    description: "Identify dollar-cost averaging patterns",
    pattern: FalsePositivePattern.DCA_TRADER,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    scoreReduction: 8,
    condition: (result) => {
      const timingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.TIMING_PATTERN
      );
      const sizingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.POSITION_SIZING
      );

      // Regular timing with consistent (small) sizing
      return (
        timingSignal?.available === true &&
        timingSignal.rawScore < 25 && // Regular patterns
        sizingSignal?.available === true &&
        sizingSignal.rawScore < 25 // Consistent sizing
      );
    },
  },
  {
    id: "volatility-response",
    name: "Normal Volatility Response",
    description: "Reduce score for normal volatility-driven trading",
    pattern: FalsePositivePattern.VOLATILITY_RESPONSE,
    action: FilterAction.REDUCE_SCORE,
    priority: FilterPriority.LOW,
    enabled: true,
    scoreReduction: 5,
    condition: (result) => {
      // High coordination but low other signals suggests response to market conditions
      const coordinationSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.COORDINATION
      );
      const sybilSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.SYBIL
      );

      return (
        coordinationSignal?.available === true &&
        coordinationSignal.rawScore > 40 &&
        sybilSignal?.available === true &&
        sybilSignal.rawScore < 20
      );
    },
  },
  {
    id: "arbitrage-bot",
    name: "Arbitrage Bot Pattern",
    description: "Identify arbitrage bot behavior",
    pattern: FalsePositivePattern.ARBITRAGE_BOT,
    action: FilterAction.MARK_FALSE_POSITIVE,
    priority: FilterPriority.NORMAL,
    enabled: true,
    minScore: 40,
    maxScore: 75,
    condition: (result) => {
      const patternSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.TRADING_PATTERN
      );
      const timingSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.TIMING_PATTERN
      );
      const selectionSignal = result.signalContributions.find(
        (s) => s.source === SignalSource.MARKET_SELECTION
      );

      // Bots: Very consistent timing, diverse markets, classified as bot
      return (
        patternSignal?.available === true &&
        patternSignal.flags.some((f) => f.toLowerCase().includes("bot")) &&
        timingSignal?.available === true &&
        timingSignal.rawScore < 20 &&
        selectionSignal?.available === true
      );
    },
  },
  {
    id: "suppress-low-score",
    name: "Suppress Low Score Alerts",
    description: "Suppress alerts that fall below threshold after reduction",
    pattern: FalsePositivePattern.LOW_SIGNAL_CONFIDENCE,
    action: FilterAction.SUPPRESS,
    priority: FilterPriority.LOW,
    enabled: true,
    maxScore: 25,
    condition: () => true, // Applied if score is low enough
  },
];

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: FilterResult;
  timestamp: number;
}

interface HistoryEntry {
  walletAddress: string;
  result: FilterResult;
  feedback?: OutcomeFeedback;
  timestamp: number;
}

// ============================================================================
// False Positive Reducer Class
// ============================================================================

/**
 * Main false positive reducer class
 */
export class FalsePositiveReducer extends EventEmitter {
  private readonly config: FalsePositiveReducerConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly rules: Map<string, FilterRule> = new Map();
  private readonly history: HistoryEntry[] = [];
  private readonly patternStats: Map<FalsePositivePattern, PatternStatistics> = new Map();
  private readonly ruleStats: Map<string, RuleStatistics> = new Map();

  private cacheHits = 0;
  private cacheMisses = 0;
  private totalAnalyzed = 0;
  private totalFiltered = 0;
  private totalSuppressed = 0;
  private totalDeferred = 0;
  private totalScoreReduction = 0;

  constructor(config: Partial<FalsePositiveReducerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REDUCER_CONFIG, ...config };

    // Initialize with default rules
    for (const rule of DEFAULT_FILTER_RULES) {
      this.rules.set(rule.id, { ...rule });
      this.initializeRuleStats(rule.id);
    }

    // Initialize pattern stats
    for (const pattern of Object.values(FalsePositivePattern)) {
      this.patternStats.set(pattern, {
        pattern,
        matchCount: 0,
        averageConfidence: 0,
        averageScoreReduction: 0,
        outcomes: {
          [FilterOutcome.TRUE_NEGATIVE]: 0,
          [FilterOutcome.FALSE_NEGATIVE]: 0,
          [FilterOutcome.TRUE_POSITIVE]: 0,
          [FilterOutcome.FALSE_POSITIVE]: 0,
          [FilterOutcome.PENDING]: 0,
        },
        lastMatch: null,
      });
    }
  }

  /**
   * Initialize statistics for a rule
   */
  private initializeRuleStats(ruleId: string): void {
    this.ruleStats.set(ruleId, {
      ruleId,
      applications: 0,
      matches: 0,
      matchRate: 0,
      outcomes: {
        [FilterOutcome.TRUE_NEGATIVE]: 0,
        [FilterOutcome.FALSE_NEGATIVE]: 0,
        [FilterOutcome.TRUE_POSITIVE]: 0,
        [FilterOutcome.FALSE_POSITIVE]: 0,
        [FilterOutcome.PENDING]: 0,
      },
      averageConfidence: 0,
      lastApplied: null,
    });
  }

  /**
   * Apply false positive filtering to a composite score result
   */
  async filter(
    result: CompositeScoreResult,
    options: { useCache?: boolean } = {}
  ): Promise<FilterResult> {
    const checksummedAddress = result.walletAddress;

    // Check cache
    if (options.useCache !== false) {
      const cached = this.cache.get(checksummedAddress);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
        this.cacheHits++;
        return { ...cached.result, fromCache: true };
      }
    }
    this.cacheMisses++;
    this.totalAnalyzed++;

    // Skip if score is too low
    if (result.compositeScore < this.config.minScoreForFiltering) {
      return this.createPassResult(result);
    }

    // Apply filter rules
    const matches = this.applyRules(result);

    // Determine action based on matches
    const filterResult = this.determineAction(result, matches);

    // Update statistics
    this.updateStatistics(filterResult);

    // Cache result
    this.cache.set(checksummedAddress, {
      result: filterResult,
      timestamp: Date.now(),
    });
    this.maintainCacheSize();

    // Add to history
    this.addToHistory(filterResult);

    // Emit events
    this.emitEvents(filterResult);

    return filterResult;
  }

  /**
   * Apply all enabled rules
   */
  private applyRules(result: CompositeScoreResult): FilterMatch[] {
    const matches: FilterMatch[] = [];

    // Sort rules by priority
    const sortedRules = Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      // Update rule statistics
      const stats = this.ruleStats.get(rule.id);
      if (stats) {
        stats.applications++;
        stats.lastApplied = new Date();
      }

      // Check score bounds
      if (rule.minScore !== undefined && result.compositeScore < rule.minScore) {
        continue;
      }
      if (rule.maxScore !== undefined && result.compositeScore > rule.maxScore) {
        continue;
      }

      // Check data quality
      if (rule.minDataQuality !== undefined && result.dataQuality < rule.minDataQuality) {
        continue;
      }

      // Check available signals
      if (rule.minAvailableSignals !== undefined &&
          result.availableSignals < rule.minAvailableSignals) {
        continue;
      }

      // Check required signals
      if (rule.requiredSignals) {
        const hasRequired = rule.requiredSignals.every((source) =>
          result.signalContributions.some(
            (s) => s.source === source && s.available
          )
        );
        if (!hasRequired) continue;
      }

      // Apply condition
      if (rule.condition && !rule.condition(result)) {
        continue;
      }

      // Rule matched
      const confidence = this.calculateMatchConfidence(rule, result);
      const matchScore = this.calculateMatchScore(rule, result, confidence);

      matches.push({
        rule,
        confidence,
        reason: rule.description,
        evidence: this.collectEvidence(rule, result),
        matchScore,
      });

      // Update rule stats
      if (stats) {
        stats.matches++;
        stats.matchRate = stats.matches / stats.applications;
        // Running average of confidence
        const prevAvg = stats.averageConfidence;
        stats.averageConfidence = prevAvg + (CONFIDENCE_SCORES[confidence] - prevAvg) / stats.matches;
      }

      // Update pattern stats
      const patternStat = this.patternStats.get(rule.pattern);
      if (patternStat) {
        patternStat.matchCount++;
        patternStat.lastMatch = new Date();
        const prevAvg = patternStat.averageConfidence;
        patternStat.averageConfidence =
          prevAvg + (CONFIDENCE_SCORES[confidence] - prevAvg) / patternStat.matchCount;
      }
    }

    return matches;
  }

  /**
   * Calculate match confidence based on rule and result
   */
  private calculateMatchConfidence(
    rule: FilterRule,
    result: CompositeScoreResult
  ): FilterConfidence {
    // Base confidence on data quality
    let confidence = result.dataQuality;

    // Adjust based on available signals
    const signalRatio = result.availableSignals / result.totalSignals;
    confidence *= signalRatio;

    // Adjust based on how well conditions matched
    if (rule.minScore !== undefined && rule.maxScore !== undefined) {
      const midpoint = (rule.minScore + rule.maxScore) / 2;
      const distance = Math.abs(result.compositeScore - midpoint);
      const range = (rule.maxScore - rule.minScore) / 2;
      confidence *= 1 - (distance / range) * 0.3;
    }

    // Convert to confidence level
    if (confidence >= CONFIDENCE_THRESHOLDS.veryHigh) return FilterConfidence.VERY_HIGH;
    if (confidence >= CONFIDENCE_THRESHOLDS.high) return FilterConfidence.HIGH;
    if (confidence >= CONFIDENCE_THRESHOLDS.medium) return FilterConfidence.MEDIUM;
    if (confidence >= CONFIDENCE_THRESHOLDS.low) return FilterConfidence.LOW;
    return FilterConfidence.VERY_LOW;
  }

  /**
   * Calculate match score for ranking
   */
  private calculateMatchScore(
    rule: FilterRule,
    result: CompositeScoreResult,
    confidence: FilterConfidence
  ): number {
    // Higher score = better match
    let score = CONFIDENCE_SCORES[confidence];

    // Priority boost
    score += (3 - rule.priority) * 10;

    // Score reduction impact
    if (rule.scoreReduction) {
      score += Math.min(rule.scoreReduction, 20);
    }

    // Data quality influence
    score += result.dataQuality * 0.2;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Collect evidence for a match
   */
  private collectEvidence(
    rule: FilterRule,
    result: CompositeScoreResult
  ): string[] {
    const evidence: string[] = [];

    evidence.push(`Pattern: ${PATTERN_DESCRIPTIONS[rule.pattern]}`);
    evidence.push(`Composite Score: ${result.compositeScore.toFixed(1)}`);
    evidence.push(`Data Quality: ${result.dataQuality.toFixed(1)}%`);
    evidence.push(`Available Signals: ${result.availableSignals}/${result.totalSignals}`);

    // Add relevant signal info
    for (const contribution of result.signalContributions) {
      if (contribution.available && contribution.weightedScore > 5) {
        evidence.push(
          `${contribution.name}: ${contribution.rawScore.toFixed(1)} (weighted: ${contribution.weightedScore.toFixed(1)})`
        );
      }
    }

    return evidence;
  }

  /**
   * Determine final action based on matches
   */
  private determineAction(
    result: CompositeScoreResult,
    matches: FilterMatch[]
  ): FilterResult {
    if (matches.length === 0) {
      return this.createPassResult(result);
    }

    // Sort by match score
    const sortedMatches = [...matches].sort((a, b) => b.matchScore - a.matchScore);
    const primaryMatch = sortedMatches[0]!;

    // Check if confidence is sufficient
    const confidenceOrder = [
      FilterConfidence.VERY_LOW,
      FilterConfidence.LOW,
      FilterConfidence.MEDIUM,
      FilterConfidence.HIGH,
      FilterConfidence.VERY_HIGH,
    ];
    const primaryConfidenceIndex = confidenceOrder.indexOf(primaryMatch.confidence);
    const minConfidenceIndex = confidenceOrder.indexOf(this.config.minConfidenceForAction);

    if (primaryConfidenceIndex < minConfidenceIndex) {
      // Confidence too low for action
      return this.createPassResult(result, matches);
    }

    // Calculate total score reduction
    let totalReduction = 0;
    for (const match of matches) {
      if (match.rule.action === FilterAction.REDUCE_SCORE) {
        totalReduction += match.rule.scoreReduction ?? this.config.defaultScoreReduction;
      }
    }

    // Apply score reduction
    const adjustedScore = Math.max(0, result.compositeScore - totalReduction);
    const adjustedLevel = this.getCompositeSuspicionLevel(adjustedScore);

    // Determine primary action
    let primaryAction = primaryMatch.rule.action;
    let isSuppressed = false;
    let isDeferred = false;
    let isLikelyFalsePositive = false;

    // Check for suppression conditions
    if (
      primaryAction === FilterAction.SUPPRESS ||
      (adjustedScore <= this.config.maxScoreForSuppression &&
       matches.length >= this.config.minMatchesForSuppression)
    ) {
      primaryAction = FilterAction.SUPPRESS;
      isSuppressed = true;
      isLikelyFalsePositive = true;
    } else if (primaryAction === FilterAction.DEFER) {
      isDeferred = true;
    } else if (primaryAction === FilterAction.MARK_FALSE_POSITIVE) {
      isLikelyFalsePositive = true;
    }

    const filterReasons = matches.map((m) => m.reason);

    return {
      walletAddress: result.walletAddress,
      originalScore: result.compositeScore,
      adjustedScore,
      originalLevel: result.suspicionLevel,
      adjustedLevel,
      isLikelyFalsePositive,
      isSuppressed,
      isDeferred,
      action: primaryAction,
      matches: sortedMatches,
      primaryPattern: primaryMatch.rule.pattern,
      confidence: primaryMatch.confidence,
      filterReasons,
      scoreReduction: totalReduction,
      originalResult: result,
      fromCache: false,
      analyzedAt: new Date(),
    };
  }

  /**
   * Create a pass-through result (no filtering)
   */
  private createPassResult(
    result: CompositeScoreResult,
    matches: FilterMatch[] = []
  ): FilterResult {
    return {
      walletAddress: result.walletAddress,
      originalScore: result.compositeScore,
      adjustedScore: result.compositeScore,
      originalLevel: result.suspicionLevel,
      adjustedLevel: result.suspicionLevel,
      isLikelyFalsePositive: false,
      isSuppressed: false,
      isDeferred: false,
      action: FilterAction.PASS,
      matches,
      primaryPattern: null,
      confidence: FilterConfidence.VERY_LOW,
      filterReasons: [],
      scoreReduction: 0,
      originalResult: result,
      fromCache: false,
      analyzedAt: new Date(),
    };
  }

  /**
   * Get suspicion level from score
   */
  private getCompositeSuspicionLevel(score: number): CompositeSuspicionLevel {
    if (score >= 80) return CompositeSuspicionLevel.CRITICAL;
    if (score >= 60) return CompositeSuspicionLevel.HIGH;
    if (score >= 40) return CompositeSuspicionLevel.MEDIUM;
    if (score >= 20) return CompositeSuspicionLevel.LOW;
    return CompositeSuspicionLevel.NONE;
  }

  /**
   * Update internal statistics
   */
  private updateStatistics(result: FilterResult): void {
    if (result.isLikelyFalsePositive) {
      this.totalFiltered++;
    }
    if (result.isSuppressed) {
      this.totalSuppressed++;
    }
    if (result.isDeferred) {
      this.totalDeferred++;
    }
    this.totalScoreReduction += result.scoreReduction;

    // Update pattern stats with score reduction
    if (result.primaryPattern) {
      const patternStat = this.patternStats.get(result.primaryPattern);
      if (patternStat && patternStat.matchCount > 0) {
        const prevAvg = patternStat.averageScoreReduction;
        patternStat.averageScoreReduction =
          prevAvg + (result.scoreReduction - prevAvg) / patternStat.matchCount;
      }
    }
  }

  /**
   * Add to history for tracking
   */
  private addToHistory(result: FilterResult): void {
    // Normalize wallet address to checksummed format for consistent comparison
    const normalizedAddress = isAddress(result.walletAddress)
      ? getAddress(result.walletAddress)
      : result.walletAddress;

    this.history.push({
      walletAddress: normalizedAddress,
      result,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > this.config.tuningSampleSize * 2) {
      this.history.splice(0, this.history.length - this.config.tuningSampleSize * 2);
    }
  }

  /**
   * Emit relevant events
   */
  private emitEvents(result: FilterResult): void {
    if (result.isLikelyFalsePositive) {
      this.emit("likely-false-positive", {
        walletAddress: result.walletAddress,
        originalScore: result.originalScore,
        adjustedScore: result.adjustedScore,
        pattern: result.primaryPattern,
        confidence: result.confidence,
      });
    }

    if (result.isSuppressed) {
      this.emit("alert-suppressed", {
        walletAddress: result.walletAddress,
        score: result.originalScore,
        pattern: result.primaryPattern,
        reasons: result.filterReasons,
      });
    }

    if (result.isDeferred) {
      this.emit("alert-deferred", {
        walletAddress: result.walletAddress,
        score: result.originalScore,
        reasons: result.filterReasons,
      });
    }

    if (result.scoreReduction > 0) {
      this.emit("score-reduced", {
        walletAddress: result.walletAddress,
        originalScore: result.originalScore,
        adjustedScore: result.adjustedScore,
        reduction: result.scoreReduction,
      });
    }
  }

  /**
   * Maintain cache size
   */
  private maintainCacheSize(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Batch filter multiple results
   */
  async batchFilter(
    results: CompositeScoreResult[],
    options: { useCache?: boolean } = {}
  ): Promise<BatchFilterResult> {
    const filterResults = new Map<string, FilterResult>();
    const failed = new Map<string, Error>();
    let totalFiltered = 0;
    let totalSuppressed = 0;
    let totalReduction = 0;
    const byPattern: Record<FalsePositivePattern, number> = {} as Record<
      FalsePositivePattern,
      number
    >;

    for (const pattern of Object.values(FalsePositivePattern)) {
      byPattern[pattern] = 0;
    }

    const promises = results.map(async (result) => {
      try {
        const filtered = await this.filter(result, options);
        filterResults.set(filtered.walletAddress, filtered);

        if (filtered.isLikelyFalsePositive) totalFiltered++;
        if (filtered.isSuppressed) totalSuppressed++;
        totalReduction += filtered.scoreReduction;

        if (filtered.primaryPattern) {
          byPattern[filtered.primaryPattern]++;
        }
      } catch (error) {
        failed.set(
          result.walletAddress,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });

    await Promise.all(promises);

    return {
      results: filterResults,
      failed,
      totalProcessed: results.length,
      totalFiltered,
      totalSuppressed,
      averageScoreReduction:
        filterResults.size > 0 ? totalReduction / filterResults.size : 0,
      byPattern,
      processedAt: new Date(),
    };
  }

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Add a custom filter rule
   */
  addRule(rule: FilterRule): void {
    this.rules.set(rule.id, { ...rule });
    this.initializeRuleStats(rule.id);
    this.emit("rule-added", { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * Remove a filter rule
   */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      this.ruleStats.delete(ruleId);
      this.emit("rule-removed", { ruleId });
    }
    return deleted;
  }

  /**
   * Enable a rule
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.emit("rule-enabled", { ruleId });
      return true;
    }
    return false;
  }

  /**
   * Disable a rule
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.emit("rule-disabled", { ruleId });
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): FilterRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): FilterRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<FilterRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      this.emit("rule-updated", { ruleId, updates });
      return true;
    }
    return false;
  }

  // ============================================================================
  // Feedback and Tuning
  // ============================================================================

  /**
   * Provide feedback on a filter decision
   */
  provideFeedback(feedback: OutcomeFeedback): void {
    // Validate address
    if (!isAddress(feedback.walletAddress)) {
      throw new Error(`Invalid wallet address: ${feedback.walletAddress}`);
    }

    const checksummedAddress = getAddress(feedback.walletAddress);

    // Find history entry
    const historyEntry = this.history.find(
      (h) => h.walletAddress === checksummedAddress && !h.feedback
    );

    if (historyEntry) {
      historyEntry.feedback = { ...feedback, walletAddress: checksummedAddress };

      // Update outcome statistics
      for (const match of historyEntry.result.matches) {
        const ruleStats = this.ruleStats.get(match.rule.id);
        if (ruleStats) {
          ruleStats.outcomes[feedback.trueOutcome]++;
        }

        const patternStats = this.patternStats.get(match.rule.pattern);
        if (patternStats) {
          patternStats.outcomes[feedback.trueOutcome]++;
        }
      }

      // Trigger auto-tuning if enabled
      if (this.config.enableAutoTuning) {
        this.autoTune();
      }

      this.emit("feedback-received", {
        walletAddress: checksummedAddress,
        outcome: feedback.trueOutcome,
      });
    }
  }

  /**
   * Auto-tune rules based on feedback
   */
  private autoTune(): void {
    const feedbackEntries = this.history.filter((h) => h.feedback);

    if (feedbackEntries.length < this.config.minApplicationsForTuning) {
      return;
    }

    // Analyze each rule's effectiveness
    for (const [ruleId, stats] of this.ruleStats.entries()) {
      if (stats.matches < 10) continue; // Not enough data

      const falseNegatives = stats.outcomes[FilterOutcome.FALSE_NEGATIVE];
      const totalDetermined =
        stats.outcomes[FilterOutcome.TRUE_NEGATIVE] +
        stats.outcomes[FilterOutcome.FALSE_NEGATIVE] +
        stats.outcomes[FilterOutcome.TRUE_POSITIVE] +
        stats.outcomes[FilterOutcome.FALSE_POSITIVE];

      if (totalDetermined < 10) continue;

      // If false negative rate is too high, reduce score reduction
      const fnRate = falseNegatives / totalDetermined;
      const rule = this.rules.get(ruleId);

      if (rule && rule.scoreReduction && fnRate > 0.3) {
        // Too many false negatives - reduce effectiveness
        const newReduction = Math.max(1, Math.floor(rule.scoreReduction * 0.8));
        if (newReduction !== rule.scoreReduction) {
          rule.scoreReduction = newReduction;
          this.emit("rule-tuned", {
            ruleId,
            change: "reduced-score-reduction",
            newValue: newReduction,
            reason: `High false negative rate: ${(fnRate * 100).toFixed(1)}%`,
          });
        }
      }

      // If false positive rate is too high, increase score reduction
      const fpRate = stats.outcomes[FilterOutcome.FALSE_POSITIVE] / totalDetermined;
      if (rule && rule.scoreReduction && fpRate > 0.2) {
        const newReduction = Math.min(50, Math.floor(rule.scoreReduction * 1.2));
        if (newReduction !== rule.scoreReduction) {
          rule.scoreReduction = newReduction;
          this.emit("rule-tuned", {
            ruleId,
            change: "increased-score-reduction",
            newValue: newReduction,
            reason: `High false positive rate: ${(fpRate * 100).toFixed(1)}%`,
          });
        }
      }
    }
  }

  // ============================================================================
  // Statistics and Summary
  // ============================================================================

  /**
   * Get filter effectiveness metrics
   */
  getEffectiveness(): FilterEffectiveness {
    let trueNegatives = 0;
    let falseNegatives = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let pending = 0;

    for (const entry of this.history) {
      if (!entry.feedback) {
        pending++;
        continue;
      }

      switch (entry.feedback.trueOutcome) {
        case FilterOutcome.TRUE_NEGATIVE:
          trueNegatives++;
          break;
        case FilterOutcome.FALSE_NEGATIVE:
          falseNegatives++;
          break;
        case FilterOutcome.TRUE_POSITIVE:
          truePositives++;
          break;
        case FilterOutcome.FALSE_POSITIVE:
          falsePositives++;
          break;
      }
    }

    const total = trueNegatives + falseNegatives + truePositives + falsePositives;
    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    const f1Score = precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

    // Calculate FP rates (before/after filtering)
    const preFpRate = total > 0 ? (falsePositives + trueNegatives) / total : 0;
    const postFpRate = total > 0 ? falsePositives / total : 0;
    const fpReduction = preFpRate > 0 ? 1 - (postFpRate / preFpRate) : 0;

    return {
      totalApplications: total + pending,
      trueNegatives,
      falseNegatives,
      truePositives,
      falsePositives,
      pending,
      precision,
      recall,
      f1Score,
      preFpRate,
      postFpRate,
      fpReduction,
    };
  }

  /**
   * Get pattern statistics
   */
  getPatternStatistics(): PatternStatistics[] {
    return Array.from(this.patternStats.values())
      .filter((s) => s.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Get rule statistics
   */
  getRuleStatistics(): RuleStatistics[] {
    return Array.from(this.ruleStats.values())
      .filter((s) => s.applications > 0)
      .sort((a, b) => b.matchRate - a.matchRate);
  }

  /**
   * Get reducer summary
   */
  getSummary(): ReducerSummary {
    const activeRules = Array.from(this.rules.values()).filter((r) => r.enabled).length;

    return {
      totalAnalyzed: this.totalAnalyzed,
      totalFalsePositives: this.totalFiltered,
      totalSuppressed: this.totalSuppressed,
      totalDeferred: this.totalDeferred,
      averageScoreReduction:
        this.totalAnalyzed > 0
          ? this.totalScoreReduction / this.totalAnalyzed
          : 0,
      activeRules,
      totalRules: this.rules.size,
      effectiveness: this.getEffectiveness(),
      patternStats: this.getPatternStatistics(),
      ruleStats: this.getRuleStatistics(),
      cacheStats: {
        size: this.cache.size,
        hitRate:
          this.cacheHits + this.cacheMisses > 0
            ? this.cacheHits / (this.cacheHits + this.cacheMisses)
            : 0,
      },
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
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
   * Get cached result
   */
  getCachedResult(walletAddress: string): FilterResult | null {
    if (!isAddress(walletAddress)) {
      return null;
    }
    const cached = this.cache.get(getAddress(walletAddress));
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
      return cached.result;
    }
    return null;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): FalsePositiveReducerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FalsePositiveReducerConfig>): void {
    Object.assign(this.config, config);
    this.emit("config-updated", config);
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    // Clear existing rules
    this.rules.clear();
    this.ruleStats.clear();

    // Reload default rules
    for (const rule of DEFAULT_FILTER_RULES) {
      this.rules.set(rule.id, { ...rule });
      this.initializeRuleStats(rule.id);
    }

    // Reset config
    Object.assign(this.config, DEFAULT_REDUCER_CONFIG);

    this.emit("reset-to-defaults", {});
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  /**
   * Export configuration and rules
   */
  exportConfig(): object {
    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      config: { ...this.config },
      rules: Array.from(this.rules.values()).map((r) => ({
        ...r,
        condition: undefined, // Can't export functions
      })),
    };
  }

  /**
   * Import configuration and rules
   */
  importConfig(data: {
    config?: Partial<FalsePositiveReducerConfig>;
    rules?: Array<Omit<FilterRule, "condition">>;
  }): void {
    if (data.config) {
      Object.assign(this.config, data.config);
    }

    if (data.rules) {
      for (const rule of data.rules) {
        // Find matching default rule for condition
        const defaultRule = DEFAULT_FILTER_RULES.find((r) => r.id === rule.id);
        this.rules.set(rule.id, {
          ...rule,
          condition: defaultRule?.condition,
        } as FilterRule);
        if (!this.ruleStats.has(rule.id)) {
          this.initializeRuleStats(rule.id);
        }
      }
    }

    this.emit("config-imported", {});
  }

  // ============================================================================
  // History
  // ============================================================================

  /**
   * Get filter history
   */
  getHistory(limit?: number): HistoryEntry[] {
    const entries = [...this.history].reverse();
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.length = 0;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedInstance: FalsePositiveReducer | null = null;

/**
 * Get shared false positive reducer instance
 */
export function getSharedFalsePositiveReducer(): FalsePositiveReducer {
  if (!sharedInstance) {
    sharedInstance = new FalsePositiveReducer();
  }
  return sharedInstance;
}

/**
 * Set shared false positive reducer instance
 */
export function setSharedFalsePositiveReducer(
  instance: FalsePositiveReducer
): void {
  sharedInstance = instance;
}

/**
 * Reset shared false positive reducer instance
 */
export function resetSharedFalsePositiveReducer(): void {
  sharedInstance?.removeAllListeners();
  sharedInstance = null;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new false positive reducer
 */
export function createFalsePositiveReducer(
  config?: Partial<FalsePositiveReducerConfig>
): FalsePositiveReducer {
  return new FalsePositiveReducer(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Filter a composite score result for false positives
 */
export async function filterFalsePositives(
  result: CompositeScoreResult,
  options?: { useCache?: boolean }
): Promise<FilterResult> {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.filter(result, options);
}

/**
 * Batch filter multiple results
 */
export async function batchFilterFalsePositives(
  results: CompositeScoreResult[],
  options?: { useCache?: boolean }
): Promise<BatchFilterResult> {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.batchFilter(results, options);
}

/**
 * Add a custom filter rule
 */
export function addFilterRule(rule: FilterRule): void {
  const reducer = getSharedFalsePositiveReducer();
  reducer.addRule(rule);
}

/**
 * Remove a filter rule
 */
export function removeFilterRule(ruleId: string): boolean {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.removeRule(ruleId);
}

/**
 * Get all filter rules
 */
export function getFilterRules(): FilterRule[] {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.getRules();
}

/**
 * Get reducer effectiveness
 */
export function getReducerEffectiveness(): FilterEffectiveness {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.getEffectiveness();
}

/**
 * Get reducer summary
 */
export function getReducerSummary(): ReducerSummary {
  const reducer = getSharedFalsePositiveReducer();
  return reducer.getSummary();
}

/**
 * Provide feedback for tuning
 */
export function provideFeedbackForTuning(feedback: OutcomeFeedback): void {
  const reducer = getSharedFalsePositiveReducer();
  reducer.provideFeedback(feedback);
}

/**
 * Get pattern description
 */
export function getPatternDescription(pattern: FalsePositivePattern): string {
  return PATTERN_DESCRIPTIONS[pattern];
}

/**
 * Get confidence score
 */
export function getConfidenceScore(confidence: FilterConfidence): number {
  return CONFIDENCE_SCORES[confidence];
}
