/**
 * Multi-Signal Correlation Scorer (DET-SCORE-008)
 *
 * Boost suspicion scores when multiple signals correlate. This module detects
 * when multiple independent signals point to the same suspicious behavior,
 * which significantly increases confidence in the detection.
 *
 * Features:
 * - Detect signal correlations across different detector outputs
 * - Calculate correlation boost based on signal agreement
 * - Apply boost to composite suspicion score
 * - Track boost effectiveness over time
 * - Support configurable correlation pairs and weights
 * - Event emission for significant correlation detections
 */

import { EventEmitter } from "events";

// Import signal sources and types from composite scorer
import {
  SignalSource,
  type CompositeScoreResult,
} from "./composite-suspicion-scorer";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Correlation type between signals
 */
export enum SignalCorrelationType {
  /** Strong positive correlation - signals reinforce each other */
  STRONG_POSITIVE = "STRONG_POSITIVE",
  /** Moderate positive correlation */
  MODERATE_POSITIVE = "MODERATE_POSITIVE",
  /** Weak positive correlation */
  WEAK_POSITIVE = "WEAK_POSITIVE",
  /** No correlation - signals are independent */
  NONE = "NONE",
  /** Signals contradict each other */
  CONTRADICTION = "CONTRADICTION",
}

/**
 * Correlation strength level
 */
export enum CorrelationStrength {
  /** Very strong correlation (>= 0.8) */
  VERY_STRONG = "VERY_STRONG",
  /** Strong correlation (>= 0.6) */
  STRONG = "STRONG",
  /** Moderate correlation (>= 0.4) */
  MODERATE = "MODERATE",
  /** Weak correlation (>= 0.2) */
  WEAK = "WEAK",
  /** Very weak or no correlation (< 0.2) */
  NEGLIGIBLE = "NEGLIGIBLE",
}

/**
 * Category for correlation patterns
 */
export enum CorrelationPattern {
  /** Behavioral consistency across signals */
  BEHAVIORAL_CONSISTENCY = "BEHAVIORAL_CONSISTENCY",
  /** Performance outliers across metrics */
  PERFORMANCE_OUTLIERS = "PERFORMANCE_OUTLIERS",
  /** Network coordination signals */
  NETWORK_COORDINATION = "NETWORK_COORDINATION",
  /** Fresh wallet + suspicious activity */
  FRESH_WALLET_ACTIVITY = "FRESH_WALLET_ACTIVITY",
  /** Timing + accuracy correlation */
  TIMING_ACCURACY = "TIMING_ACCURACY",
  /** Multi-factor insider pattern */
  INSIDER_PATTERN = "INSIDER_PATTERN",
  /** Sybil + coordination */
  SYBIL_COORDINATION = "SYBIL_COORDINATION",
  /** General multi-signal agreement */
  GENERAL_AGREEMENT = "GENERAL_AGREEMENT",
}

/**
 * Boost impact level
 */
export enum BoostImpact {
  /** No boost applied */
  NONE = "NONE",
  /** Minor boost (1-5 points) */
  MINOR = "MINOR",
  /** Moderate boost (5-10 points) */
  MODERATE = "MODERATE",
  /** Significant boost (10-20 points) */
  SIGNIFICANT = "SIGNIFICANT",
  /** Major boost (20+ points) */
  MAJOR = "MAJOR",
}

// ============================================================================
// Descriptions
// ============================================================================

/**
 * Descriptions for correlation types
 */
export const CORRELATION_TYPE_DESCRIPTIONS: Record<SignalCorrelationType, string> = {
  [SignalCorrelationType.STRONG_POSITIVE]:
    "Strong positive correlation - signals strongly reinforce each other",
  [SignalCorrelationType.MODERATE_POSITIVE]:
    "Moderate positive correlation - signals moderately agree",
  [SignalCorrelationType.WEAK_POSITIVE]: "Weak positive correlation - some signal agreement",
  [SignalCorrelationType.NONE]: "No correlation - signals are independent",
  [SignalCorrelationType.CONTRADICTION]: "Contradiction - signals disagree with each other",
};

/**
 * Descriptions for correlation strength
 */
export const CORRELATION_STRENGTH_DESCRIPTIONS: Record<CorrelationStrength, string> = {
  [CorrelationStrength.VERY_STRONG]: "Very strong correlation (>= 80%)",
  [CorrelationStrength.STRONG]: "Strong correlation (>= 60%)",
  [CorrelationStrength.MODERATE]: "Moderate correlation (>= 40%)",
  [CorrelationStrength.WEAK]: "Weak correlation (>= 20%)",
  [CorrelationStrength.NEGLIGIBLE]: "Very weak or no correlation (< 20%)",
};

/**
 * Descriptions for correlation patterns
 */
export const CORRELATION_PATTERN_DESCRIPTIONS: Record<CorrelationPattern, string> = {
  [CorrelationPattern.BEHAVIORAL_CONSISTENCY]:
    "Consistent suspicious behavior across multiple behavioral signals",
  [CorrelationPattern.PERFORMANCE_OUTLIERS]:
    "Outlier performance across win rate, P&L, and accuracy",
  [CorrelationPattern.NETWORK_COORDINATION]:
    "Network-based coordination signals (sybil + coordinated trading)",
  [CorrelationPattern.FRESH_WALLET_ACTIVITY]:
    "Fresh wallet combined with suspicious trading activity",
  [CorrelationPattern.TIMING_ACCURACY]:
    "Unusual timing patterns correlated with high accuracy",
  [CorrelationPattern.INSIDER_PATTERN]:
    "Multiple signals consistent with insider trading pattern",
  [CorrelationPattern.SYBIL_COORDINATION]:
    "Sybil attack indicators combined with coordination signals",
  [CorrelationPattern.GENERAL_AGREEMENT]:
    "General agreement across multiple independent signals",
};

/**
 * Descriptions for boost impact
 */
export const BOOST_IMPACT_DESCRIPTIONS: Record<BoostImpact, string> = {
  [BoostImpact.NONE]: "No boost applied - insufficient correlation",
  [BoostImpact.MINOR]: "Minor boost (1-5 points) - weak correlation",
  [BoostImpact.MODERATE]: "Moderate boost (5-10 points) - notable correlation",
  [BoostImpact.SIGNIFICANT]: "Significant boost (10-20 points) - strong correlation",
  [BoostImpact.MAJOR]: "Major boost (20+ points) - very strong multi-signal agreement",
};

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Signal pair definition for correlation analysis
 */
export interface SignalPair {
  /** First signal source */
  signal1: SignalSource;
  /** Second signal source */
  signal2: SignalSource;
  /** Expected correlation pattern */
  pattern: CorrelationPattern;
  /** Base weight for this pair's correlation */
  weight: number;
  /** Minimum score threshold for both signals to consider */
  minScoreThreshold: number;
  /** Description of why this correlation matters */
  description: string;
}

/**
 * Detected correlation between signals
 */
export interface DetectedCorrelation {
  /** First signal source */
  signal1: SignalSource;
  /** Second signal source */
  signal2: SignalSource;
  /** First signal's raw score */
  score1: number;
  /** Second signal's raw score */
  score2: number;
  /** Correlation type */
  correlationType: SignalCorrelationType;
  /** Correlation strength (0-1) */
  correlationStrength: number;
  /** Correlation strength level */
  strengthLevel: CorrelationStrength;
  /** Detected pattern */
  pattern: CorrelationPattern;
  /** Boost contribution from this correlation */
  boostContribution: number;
  /** Confidence in this correlation (0-1) */
  confidence: number;
  /** Description of the correlation */
  description: string;
}

/**
 * Pattern detection result
 */
export interface PatternDetection {
  /** Detected pattern */
  pattern: CorrelationPattern;
  /** Signals involved */
  signals: SignalSource[];
  /** Pattern strength (0-1) */
  strength: number;
  /** Boost contribution */
  boostContribution: number;
  /** Description */
  description: string;
  /** Whether pattern was detected */
  detected: boolean;
}

/**
 * Correlation analysis result
 */
export interface SignalCorrelationAnalysisResult {
  /** Wallet address (checksummed) */
  walletAddress: string;
  /** Original composite score */
  originalScore: number;
  /** Boosted score after correlation analysis */
  boostedScore: number;
  /** Total boost applied */
  totalBoost: number;
  /** Boost impact level */
  boostImpact: BoostImpact;
  /** All detected correlations */
  correlations: DetectedCorrelation[];
  /** Strong correlations (significant agreement) */
  strongCorrelations: DetectedCorrelation[];
  /** Detected patterns */
  patterns: PatternDetection[];
  /** Number of high-scoring signals */
  highScoringSignalCount: number;
  /** Average signal score */
  averageSignalScore: number;
  /** Overall correlation coefficient */
  overallCorrelation: number;
  /** Confidence in correlation analysis */
  confidence: number;
  /** Key insights from correlation analysis */
  insights: string[];
  /** Analysis timestamp */
  analyzedAt: Date;
}

/**
 * Boost effectiveness tracking
 */
export interface BoostEffectiveness {
  /** Pattern that triggered the boost */
  pattern: CorrelationPattern;
  /** Original score */
  originalScore: number;
  /** Boosted score */
  boostedScore: number;
  /** Boost amount */
  boostAmount: number;
  /** Outcome (if known) - true = correct, false = incorrect, null = unknown */
  correctOutcome: boolean | null;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Batch correlation result
 */
export interface BatchSignalCorrelationResult {
  /** Results by wallet address */
  results: Map<string, SignalCorrelationAnalysisResult>;
  /** Failed wallets */
  failed: Map<string, Error>;
  /** Total processed */
  totalProcessed: number;
  /** Average boost applied */
  averageBoost: number;
  /** Wallets with significant boost */
  significantBoostCount: number;
  /** Most common patterns detected */
  commonPatterns: Array<{ pattern: CorrelationPattern; count: number }>;
  /** Processing timestamp */
  processedAt: Date;
}

/**
 * Scorer summary
 */
export interface CorrelationScorerSummary {
  /** Total analyses performed */
  totalAnalyses: number;
  /** Analyses with boost applied */
  analysesWithBoost: number;
  /** Average boost amount */
  averageBoost: number;
  /** Maximum boost applied */
  maxBoost: number;
  /** Boost distribution by impact level */
  boostDistribution: Record<BoostImpact, number>;
  /** Pattern detection frequency */
  patternFrequency: Record<CorrelationPattern, number>;
  /** Correlation pair effectiveness */
  pairEffectiveness: Array<{
    pair: string;
    detectionCount: number;
    averageBoost: number;
  }>;
  /** Boost effectiveness stats */
  effectiveness: {
    trackedCount: number;
    correctCount: number;
    incorrectCount: number;
    unknownCount: number;
    effectivenessRate: number | null;
  };
  /** Cache statistics */
  cacheStats: {
    size: number;
    hitRate: number;
  };
}

/**
 * Configuration options
 */
export interface MultiSignalCorrelationScorerConfig {
  /** Signal pairs to analyze for correlation */
  signalPairs: SignalPair[];
  /** Minimum correlation strength to apply boost */
  minCorrelationStrength: number;
  /** Maximum boost that can be applied */
  maxBoost: number;
  /** Boost multiplier based on correlation strength */
  boostMultiplier: number;
  /** Minimum signals required for pattern detection */
  minSignalsForPattern: number;
  /** High score threshold for signal agreement */
  highScoreThreshold: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Maximum effectiveness records to keep */
  maxEffectivenessRecords: number;
  /** Enable pattern detection */
  enablePatternDetection: boolean;
}

/**
 * Analysis options
 */
export interface AnalyzeSignalCorrelationOptions {
  /** Use cached results if available */
  useCache?: boolean;
  /** Include detailed insights */
  includeInsights?: boolean;
  /** Custom max boost for this analysis */
  maxBoost?: number;
  /** Skip specific patterns */
  skipPatterns?: CorrelationPattern[];
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default signal pairs for correlation analysis
 */
export const DEFAULT_SIGNAL_PAIRS: SignalPair[] = [
  // Performance outlier correlations
  {
    signal1: SignalSource.WIN_RATE,
    signal2: SignalSource.PROFIT_LOSS,
    pattern: CorrelationPattern.PERFORMANCE_OUTLIERS,
    weight: 1.2,
    minScoreThreshold: 40,
    description: "High win rate correlated with high P&L",
  },
  {
    signal1: SignalSource.WIN_RATE,
    signal2: SignalSource.ACCURACY,
    pattern: CorrelationPattern.PERFORMANCE_OUTLIERS,
    weight: 1.3,
    minScoreThreshold: 45,
    description: "High win rate correlated with high prediction accuracy",
  },
  {
    signal1: SignalSource.PROFIT_LOSS,
    signal2: SignalSource.ACCURACY,
    pattern: CorrelationPattern.PERFORMANCE_OUTLIERS,
    weight: 1.2,
    minScoreThreshold: 40,
    description: "High P&L correlated with high accuracy",
  },

  // Behavioral consistency
  {
    signal1: SignalSource.TIMING_PATTERN,
    signal2: SignalSource.POSITION_SIZING,
    pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
    weight: 1.0,
    minScoreThreshold: 35,
    description: "Unusual timing with unusual position sizing",
  },
  {
    signal1: SignalSource.TIMING_PATTERN,
    signal2: SignalSource.MARKET_SELECTION,
    pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
    weight: 1.1,
    minScoreThreshold: 35,
    description: "Unusual timing with suspicious market selection",
  },
  {
    signal1: SignalSource.POSITION_SIZING,
    signal2: SignalSource.MARKET_SELECTION,
    pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
    weight: 1.0,
    minScoreThreshold: 35,
    description: "Unusual sizing with suspicious market selection",
  },

  // Network coordination
  {
    signal1: SignalSource.COORDINATION,
    signal2: SignalSource.SYBIL,
    pattern: CorrelationPattern.SYBIL_COORDINATION,
    weight: 1.5,
    minScoreThreshold: 50,
    description: "Coordination signals with sybil indicators",
  },

  // Fresh wallet activity
  {
    signal1: SignalSource.FRESH_WALLET,
    signal2: SignalSource.WIN_RATE,
    pattern: CorrelationPattern.FRESH_WALLET_ACTIVITY,
    weight: 1.3,
    minScoreThreshold: 40,
    description: "Fresh wallet with unusually high win rate",
  },
  {
    signal1: SignalSource.FRESH_WALLET,
    signal2: SignalSource.PROFIT_LOSS,
    pattern: CorrelationPattern.FRESH_WALLET_ACTIVITY,
    weight: 1.2,
    minScoreThreshold: 40,
    description: "Fresh wallet with exceptional P&L",
  },
  {
    signal1: SignalSource.FRESH_WALLET,
    signal2: SignalSource.ACCURACY,
    pattern: CorrelationPattern.FRESH_WALLET_ACTIVITY,
    weight: 1.4,
    minScoreThreshold: 45,
    description: "Fresh wallet with unusually high accuracy",
  },

  // Timing + accuracy (potential insider)
  {
    signal1: SignalSource.TIMING_PATTERN,
    signal2: SignalSource.ACCURACY,
    pattern: CorrelationPattern.TIMING_ACCURACY,
    weight: 1.4,
    minScoreThreshold: 45,
    description: "Suspicious timing with high prediction accuracy",
  },
  {
    signal1: SignalSource.TIMING_PATTERN,
    signal2: SignalSource.WIN_RATE,
    pattern: CorrelationPattern.TIMING_ACCURACY,
    weight: 1.3,
    minScoreThreshold: 40,
    description: "Suspicious timing with high win rate",
  },

  // Trading pattern correlations
  {
    signal1: SignalSource.TRADING_PATTERN,
    signal2: SignalSource.MARKET_SELECTION,
    pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
    weight: 1.1,
    minScoreThreshold: 35,
    description: "Suspicious trading pattern with market selection",
  },
  {
    signal1: SignalSource.TRADING_PATTERN,
    signal2: SignalSource.COORDINATION,
    pattern: CorrelationPattern.NETWORK_COORDINATION,
    weight: 1.2,
    minScoreThreshold: 40,
    description: "Suspicious trading pattern with coordination signals",
  },
];

/**
 * Default correlation scorer configuration
 */
export const DEFAULT_CORRELATION_SCORER_CONFIG: MultiSignalCorrelationScorerConfig = {
  signalPairs: [...DEFAULT_SIGNAL_PAIRS],
  minCorrelationStrength: 0.3,
  maxBoost: 25,
  boostMultiplier: 0.15,
  minSignalsForPattern: 3,
  highScoreThreshold: 50,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  maxEffectivenessRecords: 1000,
  enablePatternDetection: true,
};

/**
 * Correlation strength thresholds
 */
export const CORRELATION_STRENGTH_THRESHOLDS = {
  veryStrong: 0.8,
  strong: 0.6,
  moderate: 0.4,
  weak: 0.2,
};

/**
 * Boost impact thresholds
 */
export const BOOST_IMPACT_THRESHOLDS = {
  minor: 1,
  moderate: 5,
  significant: 10,
  major: 20,
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: SignalCorrelationAnalysisResult;
  timestamp: number;
}

// ============================================================================
// Multi-Signal Correlation Scorer Class
// ============================================================================

/**
 * Main multi-signal correlation scorer class
 */
export class MultiSignalCorrelationScorer extends EventEmitter {
  private readonly config: MultiSignalCorrelationScorerConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly effectivenessRecords: BoostEffectiveness[] = [];
  private readonly patternDetectionCounts: Map<CorrelationPattern, number> = new Map();
  private readonly pairDetectionCounts: Map<string, number> = new Map();
  private readonly pairBoostSums: Map<string, number> = new Map();

  // Statistics
  private totalAnalyses = 0;
  private analysesWithBoost = 0;
  private totalBoostApplied = 0;
  private maxBoostApplied = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: Partial<MultiSignalCorrelationScorerConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CORRELATION_SCORER_CONFIG,
      ...config,
      signalPairs: config.signalPairs || [...DEFAULT_SIGNAL_PAIRS],
    };

    // Initialize pattern detection counts
    for (const pattern of Object.values(CorrelationPattern)) {
      this.patternDetectionCounts.set(pattern, 0);
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Analyze correlations in composite score result
   */
  analyzeCorrelations(
    compositeResult: CompositeScoreResult,
    options: AnalyzeSignalCorrelationOptions = {}
  ): SignalCorrelationAnalysisResult {
    const walletAddress = compositeResult.walletAddress;

    // Check cache
    if (options.useCache !== false) {
      const cached = this.getCachedResult(walletAddress);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
    }
    this.cacheMisses++;

    // Build signal score map
    const signalScores = this.buildSignalScoreMap(compositeResult);

    // Detect correlations between signal pairs
    const correlations = this.detectCorrelations(signalScores);

    // Detect patterns
    const patterns = this.config.enablePatternDetection
      ? this.detectPatterns(signalScores, correlations, options.skipPatterns)
      : [];

    // Calculate boost
    const { totalBoost, boostImpact } = this.calculateBoost(
      correlations,
      patterns,
      options.maxBoost
    );

    // Calculate statistics
    const highScoringSignalCount = this.countHighScoringSignals(signalScores);
    const averageSignalScore = this.calculateAverageScore(signalScores);
    const overallCorrelation = this.calculateOverallCorrelation(correlations);

    // Generate insights
    const insights =
      options.includeInsights !== false
        ? this.generateInsights(correlations, patterns, totalBoost)
        : [];

    // Build result
    const result: SignalCorrelationAnalysisResult = {
      walletAddress,
      originalScore: compositeResult.compositeScore,
      boostedScore: Math.min(
        100,
        compositeResult.compositeScore + totalBoost
      ),
      totalBoost,
      boostImpact,
      correlations,
      strongCorrelations: correlations.filter(
        (c) =>
          c.strengthLevel === CorrelationStrength.STRONG ||
          c.strengthLevel === CorrelationStrength.VERY_STRONG
      ),
      patterns,
      highScoringSignalCount,
      averageSignalScore,
      overallCorrelation,
      confidence: this.calculateConfidence(correlations, signalScores),
      insights,
      analyzedAt: new Date(),
    };

    // Update statistics
    this.updateStatistics(result, correlations, patterns);

    // Cache result
    this.cacheResult(walletAddress, result);

    // Emit events
    if (totalBoost > 0) {
      this.emit("correlation-boost", {
        walletAddress,
        originalScore: compositeResult.compositeScore,
        boostedScore: result.boostedScore,
        totalBoost,
        boostImpact,
        strongCorrelations: result.strongCorrelations.length,
      });
    }

    if (result.strongCorrelations.length >= 3) {
      this.emit("multi-signal-agreement", {
        walletAddress,
        signalCount: result.strongCorrelations.length,
        patterns: patterns.filter((p) => p.detected).map((p) => p.pattern),
        boost: totalBoost,
      });
    }

    return result;
  }

  /**
   * Batch analyze correlations
   */
  batchAnalyzeCorrelations(
    compositeResults: CompositeScoreResult[],
    options: AnalyzeSignalCorrelationOptions = {}
  ): BatchSignalCorrelationResult {
    const results = new Map<string, SignalCorrelationAnalysisResult>();
    const failed = new Map<string, Error>();

    let totalBoost = 0;
    let significantBoostCount = 0;
    const patternCounts = new Map<CorrelationPattern, number>();

    for (const compositeResult of compositeResults) {
      try {
        const result = this.analyzeCorrelations(compositeResult, options);
        results.set(compositeResult.walletAddress, result);
        totalBoost += result.totalBoost;

        if (
          result.boostImpact === BoostImpact.SIGNIFICANT ||
          result.boostImpact === BoostImpact.MAJOR
        ) {
          significantBoostCount++;
        }

        // Count patterns
        for (const pattern of result.patterns) {
          if (pattern.detected) {
            patternCounts.set(
              pattern.pattern,
              (patternCounts.get(pattern.pattern) || 0) + 1
            );
          }
        }
      } catch (error) {
        failed.set(
          compositeResult.walletAddress,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Sort patterns by count
    const commonPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);

    return {
      results,
      failed,
      totalProcessed: compositeResults.length,
      averageBoost: results.size > 0 ? totalBoost / results.size : 0,
      significantBoostCount,
      commonPatterns,
      processedAt: new Date(),
    };
  }

  /**
   * Apply correlation boost to a composite score
   */
  applyCorrelationBoost(
    compositeResult: CompositeScoreResult,
    options: AnalyzeSignalCorrelationOptions = {}
  ): number {
    const analysis = this.analyzeCorrelations(compositeResult, options);
    return analysis.boostedScore;
  }

  /**
   * Record effectiveness feedback for a boost
   */
  recordBoostEffectiveness(
    walletAddress: string,
    pattern: CorrelationPattern,
    originalScore: number,
    boostedScore: number,
    correctOutcome: boolean | null
  ): void {
    const record: BoostEffectiveness = {
      pattern,
      originalScore,
      boostedScore,
      boostAmount: boostedScore - originalScore,
      correctOutcome,
      timestamp: new Date(),
    };

    this.effectivenessRecords.push(record);

    // Trim if needed
    if (this.effectivenessRecords.length > this.config.maxEffectivenessRecords) {
      this.effectivenessRecords.shift();
    }

    this.emit("effectiveness-recorded", { walletAddress, record });
  }

  /**
   * Update effectiveness feedback for existing record
   */
  updateBoostEffectiveness(
    walletAddress: string,
    timestamp: Date,
    correctOutcome: boolean
  ): boolean {
    // Find record within 1 second of timestamp
    const record = this.effectivenessRecords.find(
      (r) => Math.abs(r.timestamp.getTime() - timestamp.getTime()) < 1000
    );

    if (record) {
      record.correctOutcome = correctOutcome;
      this.emit("effectiveness-updated", { walletAddress, record });
      return true;
    }
    return false;
  }

  /**
   * Get effectiveness statistics
   */
  getEffectivenessStats(): {
    trackedCount: number;
    correctCount: number;
    incorrectCount: number;
    unknownCount: number;
    effectivenessRate: number | null;
    byPattern: Record<
      CorrelationPattern,
      { correct: number; incorrect: number; unknown: number }
    >;
  } {
    const stats = {
      trackedCount: this.effectivenessRecords.length,
      correctCount: 0,
      incorrectCount: 0,
      unknownCount: 0,
      effectivenessRate: null as number | null,
      byPattern: {} as Record<
        CorrelationPattern,
        { correct: number; incorrect: number; unknown: number }
      >,
    };

    // Initialize pattern stats
    for (const pattern of Object.values(CorrelationPattern)) {
      stats.byPattern[pattern] = { correct: 0, incorrect: 0, unknown: 0 };
    }

    for (const record of this.effectivenessRecords) {
      if (record.correctOutcome === true) {
        stats.correctCount++;
        stats.byPattern[record.pattern].correct++;
      } else if (record.correctOutcome === false) {
        stats.incorrectCount++;
        stats.byPattern[record.pattern].incorrect++;
      } else {
        stats.unknownCount++;
        stats.byPattern[record.pattern].unknown++;
      }
    }

    const known = stats.correctCount + stats.incorrectCount;
    if (known > 0) {
      stats.effectivenessRate = stats.correctCount / known;
    }

    return stats;
  }

  /**
   * Add custom signal pair
   */
  addSignalPair(pair: SignalPair): void {
    this.config.signalPairs.push(pair);
    this.emit("signal-pair-added", pair);
  }

  /**
   * Remove signal pair
   */
  removeSignalPair(signal1: SignalSource, signal2: SignalSource): boolean {
    const index = this.config.signalPairs.findIndex(
      (p) =>
        (p.signal1 === signal1 && p.signal2 === signal2) ||
        (p.signal1 === signal2 && p.signal2 === signal1)
    );

    if (index >= 0) {
      const removed = this.config.signalPairs.splice(index, 1)[0];
      this.emit("signal-pair-removed", removed);
      return true;
    }
    return false;
  }

  /**
   * Get signal pairs
   */
  getSignalPairs(): SignalPair[] {
    return [...this.config.signalPairs];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MultiSignalCorrelationScorerConfig>): void {
    Object.assign(this.config, updates);
    if (updates.signalPairs) {
      this.config.signalPairs = [...updates.signalPairs];
    }
    this.emit("config-updated", this.config);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cache-cleared");
  }

  /**
   * Get summary statistics
   */
  getSummary(): CorrelationScorerSummary {
    // Calculate boost distribution
    const boostDistribution: Record<BoostImpact, number> = {
      [BoostImpact.NONE]: 0,
      [BoostImpact.MINOR]: 0,
      [BoostImpact.MODERATE]: 0,
      [BoostImpact.SIGNIFICANT]: 0,
      [BoostImpact.MAJOR]: 0,
    };

    // Get pattern frequency
    const patternFrequency: Record<CorrelationPattern, number> = {} as Record<
      CorrelationPattern,
      number
    >;
    for (const pattern of Object.values(CorrelationPattern)) {
      patternFrequency[pattern] = this.patternDetectionCounts.get(pattern) || 0;
    }

    // Get pair effectiveness
    const pairEffectiveness: Array<{
      pair: string;
      detectionCount: number;
      averageBoost: number;
    }> = [];

    for (const [pair, count] of this.pairDetectionCounts) {
      const boostSum = this.pairBoostSums.get(pair) || 0;
      pairEffectiveness.push({
        pair,
        detectionCount: count,
        averageBoost: count > 0 ? boostSum / count : 0,
      });
    }

    pairEffectiveness.sort((a, b) => b.detectionCount - a.detectionCount);

    // Get effectiveness stats
    const effectivenessStats = this.getEffectivenessStats();

    return {
      totalAnalyses: this.totalAnalyses,
      analysesWithBoost: this.analysesWithBoost,
      averageBoost:
        this.analysesWithBoost > 0
          ? this.totalBoostApplied / this.analysesWithBoost
          : 0,
      maxBoost: this.maxBoostApplied,
      boostDistribution,
      patternFrequency,
      pairEffectiveness: pairEffectiveness.slice(0, 10),
      effectiveness: {
        trackedCount: effectivenessStats.trackedCount,
        correctCount: effectivenessStats.correctCount,
        incorrectCount: effectivenessStats.incorrectCount,
        unknownCount: effectivenessStats.unknownCount,
        effectivenessRate: effectivenessStats.effectivenessRate,
      },
      cacheStats: {
        size: this.cache.size,
        hitRate:
          this.cacheHits + this.cacheMisses > 0
            ? this.cacheHits / (this.cacheHits + this.cacheMisses)
            : 0,
      },
    };
  }

  /**
   * Export data for persistence
   */
  exportData(): {
    effectivenessRecords: BoostEffectiveness[];
    config: MultiSignalCorrelationScorerConfig;
    statistics: {
      totalAnalyses: number;
      analysesWithBoost: number;
      totalBoostApplied: number;
      maxBoostApplied: number;
    };
  } {
    return {
      effectivenessRecords: [...this.effectivenessRecords],
      config: { ...this.config, signalPairs: [...this.config.signalPairs] },
      statistics: {
        totalAnalyses: this.totalAnalyses,
        analysesWithBoost: this.analysesWithBoost,
        totalBoostApplied: this.totalBoostApplied,
        maxBoostApplied: this.maxBoostApplied,
      },
    };
  }

  /**
   * Import data from export
   */
  importData(data: ReturnType<typeof this.exportData>): void {
    this.effectivenessRecords.length = 0;
    this.effectivenessRecords.push(
      ...data.effectivenessRecords.map((r) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }))
    );

    Object.assign(this.config, data.config);
    this.config.signalPairs = [...data.config.signalPairs];

    this.totalAnalyses = data.statistics.totalAnalyses;
    this.analysesWithBoost = data.statistics.analysesWithBoost;
    this.totalBoostApplied = data.statistics.totalBoostApplied;
    this.maxBoostApplied = data.statistics.maxBoostApplied;

    this.emit("data-imported");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build signal score map from composite result
   */
  private buildSignalScoreMap(
    compositeResult: CompositeScoreResult
  ): Map<SignalSource, number> {
    const scoreMap = new Map<SignalSource, number>();

    for (const contribution of compositeResult.signalContributions) {
      if (contribution.available) {
        scoreMap.set(contribution.source, contribution.rawScore);
      }
    }

    return scoreMap;
  }

  /**
   * Detect correlations between signal pairs
   */
  private detectCorrelations(
    signalScores: Map<SignalSource, number>
  ): DetectedCorrelation[] {
    const correlations: DetectedCorrelation[] = [];

    for (const pair of this.config.signalPairs) {
      const score1 = signalScores.get(pair.signal1);
      const score2 = signalScores.get(pair.signal2);

      // Skip if either signal is not available
      if (score1 === undefined || score2 === undefined) {
        continue;
      }

      // Skip if scores below threshold
      if (score1 < pair.minScoreThreshold || score2 < pair.minScoreThreshold) {
        continue;
      }

      // Calculate correlation strength
      const correlationStrength = this.calculatePairCorrelation(
        score1,
        score2,
        pair.minScoreThreshold
      );

      // Determine correlation type
      const correlationType = this.determineCorrelationType(
        score1,
        score2,
        correlationStrength
      );

      // Determine strength level
      const strengthLevel = this.determineStrengthLevel(correlationStrength);

      // Calculate boost contribution
      const boostContribution =
        correlationStrength >= this.config.minCorrelationStrength
          ? this.calculatePairBoost(score1, score2, correlationStrength, pair.weight)
          : 0;

      // Calculate confidence
      const confidence = this.calculatePairConfidence(score1, score2, correlationStrength);

      correlations.push({
        signal1: pair.signal1,
        signal2: pair.signal2,
        score1,
        score2,
        correlationType,
        correlationStrength,
        strengthLevel,
        pattern: pair.pattern,
        boostContribution,
        confidence,
        description: pair.description,
      });
    }

    return correlations;
  }

  /**
   * Calculate correlation between two scores
   */
  private calculatePairCorrelation(
    score1: number,
    score2: number,
    threshold: number
  ): number {
    // Both scores above threshold indicates correlation
    // Strength based on how far above threshold and how similar they are

    const excess1 = Math.max(0, score1 - threshold);
    const excess2 = Math.max(0, score2 - threshold);

    // Calculate similarity (1 - normalized difference)
    const diff = Math.abs(score1 - score2);
    const maxScore = Math.max(score1, score2);
    const similarity = maxScore > 0 ? 1 - diff / maxScore : 0;

    // Combine excess and similarity
    const avgExcess = (excess1 + excess2) / 2;
    const normalizedExcess = Math.min(1, avgExcess / 50); // 50 points above = max excess

    // Weight similarity and excess equally
    return (normalizedExcess + similarity) / 2;
  }

  /**
   * Determine correlation type
   */
  private determineCorrelationType(
    score1: number,
    score2: number,
    strength: number
  ): SignalCorrelationType {
    // Check for contradiction (one high, one low)
    if ((score1 > 60 && score2 < 30) || (score2 > 60 && score1 < 30)) {
      return SignalCorrelationType.CONTRADICTION;
    }

    if (strength >= CORRELATION_STRENGTH_THRESHOLDS.strong) {
      return SignalCorrelationType.STRONG_POSITIVE;
    } else if (strength >= CORRELATION_STRENGTH_THRESHOLDS.moderate) {
      return SignalCorrelationType.MODERATE_POSITIVE;
    } else if (strength >= CORRELATION_STRENGTH_THRESHOLDS.weak) {
      return SignalCorrelationType.WEAK_POSITIVE;
    }
    return SignalCorrelationType.NONE;
  }

  /**
   * Determine strength level
   */
  private determineStrengthLevel(strength: number): CorrelationStrength {
    if (strength >= CORRELATION_STRENGTH_THRESHOLDS.veryStrong) {
      return CorrelationStrength.VERY_STRONG;
    } else if (strength >= CORRELATION_STRENGTH_THRESHOLDS.strong) {
      return CorrelationStrength.STRONG;
    } else if (strength >= CORRELATION_STRENGTH_THRESHOLDS.moderate) {
      return CorrelationStrength.MODERATE;
    } else if (strength >= CORRELATION_STRENGTH_THRESHOLDS.weak) {
      return CorrelationStrength.WEAK;
    }
    return CorrelationStrength.NEGLIGIBLE;
  }

  /**
   * Calculate boost from a signal pair
   */
  private calculatePairBoost(
    score1: number,
    score2: number,
    strength: number,
    weight: number
  ): number {
    const avgScore = (score1 + score2) / 2;
    return avgScore * strength * this.config.boostMultiplier * weight;
  }

  /**
   * Calculate confidence for a pair correlation
   */
  private calculatePairConfidence(
    score1: number,
    score2: number,
    strength: number
  ): number {
    // Higher confidence when both scores are high and similar
    const avgScore = (score1 + score2) / 2;
    const scoreConfidence = Math.min(1, avgScore / 80);
    return (scoreConfidence + strength) / 2;
  }

  /**
   * Detect patterns across multiple signals
   */
  private detectPatterns(
    signalScores: Map<SignalSource, number>,
    correlations: DetectedCorrelation[],
    skipPatterns?: CorrelationPattern[]
  ): PatternDetection[] {
    const patterns: PatternDetection[] = [];

    // Check each pattern type
    for (const pattern of Object.values(CorrelationPattern)) {
      if (skipPatterns?.includes(pattern)) {
        patterns.push({
          pattern,
          signals: [],
          strength: 0,
          boostContribution: 0,
          description: CORRELATION_PATTERN_DESCRIPTIONS[pattern],
          detected: false,
        });
        continue;
      }

      const detection = this.checkPattern(pattern, signalScores, correlations);
      patterns.push(detection);
    }

    return patterns;
  }

  /**
   * Check for a specific pattern
   */
  private checkPattern(
    pattern: CorrelationPattern,
    signalScores: Map<SignalSource, number>,
    correlations: DetectedCorrelation[]
  ): PatternDetection {
    const patternCorrelations = correlations.filter((c) => c.pattern === pattern);
    const signals = new Set<SignalSource>();
    let totalStrength = 0;
    let totalBoost = 0;

    for (const corr of patternCorrelations) {
      if (corr.correlationStrength >= this.config.minCorrelationStrength) {
        signals.add(corr.signal1);
        signals.add(corr.signal2);
        totalStrength += corr.correlationStrength;
        totalBoost += corr.boostContribution;
      }
    }

    const detected =
      patternCorrelations.length > 0 &&
      signals.size >= this.config.minSignalsForPattern;

    const avgStrength =
      patternCorrelations.length > 0 ? totalStrength / patternCorrelations.length : 0;

    // Pattern-specific checks
    let patternSpecificBoost = 0;
    if (detected) {
      patternSpecificBoost = this.getPatternSpecificBoost(pattern, signalScores, avgStrength);
    }

    return {
      pattern,
      signals: Array.from(signals),
      strength: avgStrength,
      boostContribution: totalBoost + patternSpecificBoost,
      description: CORRELATION_PATTERN_DESCRIPTIONS[pattern],
      detected,
    };
  }

  /**
   * Get pattern-specific boost
   */
  private getPatternSpecificBoost(
    pattern: CorrelationPattern,
    signalScores: Map<SignalSource, number>,
    avgStrength: number
  ): number {
    switch (pattern) {
      case CorrelationPattern.INSIDER_PATTERN: {
        // Strong boost for insider pattern with multiple high signals
        const insiderSignals = [
          SignalSource.WIN_RATE,
          SignalSource.ACCURACY,
          SignalSource.TIMING_PATTERN,
          SignalSource.MARKET_SELECTION,
        ];
        const highCount = insiderSignals.filter(
          (s) => (signalScores.get(s) || 0) >= 60
        ).length;
        if (highCount >= 3) {
          return 5 * avgStrength;
        }
        break;
      }

      case CorrelationPattern.SYBIL_COORDINATION: {
        // Boost for sybil + coordination
        const sybilScore = signalScores.get(SignalSource.SYBIL) || 0;
        const coordScore = signalScores.get(SignalSource.COORDINATION) || 0;
        if (sybilScore >= 50 && coordScore >= 50) {
          return 4 * avgStrength;
        }
        break;
      }

      case CorrelationPattern.PERFORMANCE_OUTLIERS: {
        // Boost for multiple performance outliers
        const perfSignals = [
          SignalSource.WIN_RATE,
          SignalSource.PROFIT_LOSS,
          SignalSource.ACCURACY,
        ];
        const highCount = perfSignals.filter(
          (s) => (signalScores.get(s) || 0) >= 55
        ).length;
        if (highCount >= 2) {
          return 3 * avgStrength;
        }
        break;
      }

      case CorrelationPattern.FRESH_WALLET_ACTIVITY: {
        // Strong boost for fresh wallet with suspicious activity
        const freshScore = signalScores.get(SignalSource.FRESH_WALLET) || 0;
        if (freshScore >= 50) {
          return 3 * avgStrength;
        }
        break;
      }
    }

    return 0;
  }

  /**
   * Calculate total boost
   */
  private calculateBoost(
    correlations: DetectedCorrelation[],
    patterns: PatternDetection[],
    maxBoostOverride?: number
  ): { totalBoost: number; boostImpact: BoostImpact } {
    let totalBoost = 0;

    // Sum correlation boosts
    for (const corr of correlations) {
      if (corr.correlationStrength >= this.config.minCorrelationStrength) {
        totalBoost += corr.boostContribution;
      }
    }

    // Sum pattern boosts (only for detected patterns)
    for (const pattern of patterns) {
      if (pattern.detected) {
        totalBoost += pattern.boostContribution;
      }
    }

    // Apply max boost limit
    const maxBoost = maxBoostOverride ?? this.config.maxBoost;
    totalBoost = Math.min(totalBoost, maxBoost);

    // Determine impact level
    let boostImpact: BoostImpact;
    if (totalBoost < BOOST_IMPACT_THRESHOLDS.minor) {
      boostImpact = BoostImpact.NONE;
    } else if (totalBoost < BOOST_IMPACT_THRESHOLDS.moderate) {
      boostImpact = BoostImpact.MINOR;
    } else if (totalBoost < BOOST_IMPACT_THRESHOLDS.significant) {
      boostImpact = BoostImpact.MODERATE;
    } else if (totalBoost < BOOST_IMPACT_THRESHOLDS.major) {
      boostImpact = BoostImpact.SIGNIFICANT;
    } else {
      boostImpact = BoostImpact.MAJOR;
    }

    return { totalBoost, boostImpact };
  }

  /**
   * Count high-scoring signals
   */
  private countHighScoringSignals(signalScores: Map<SignalSource, number>): number {
    let count = 0;
    for (const score of signalScores.values()) {
      if (score >= this.config.highScoreThreshold) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate average signal score
   */
  private calculateAverageScore(signalScores: Map<SignalSource, number>): number {
    if (signalScores.size === 0) return 0;
    let sum = 0;
    for (const score of signalScores.values()) {
      sum += score;
    }
    return sum / signalScores.size;
  }

  /**
   * Calculate overall correlation coefficient
   */
  private calculateOverallCorrelation(correlations: DetectedCorrelation[]): number {
    if (correlations.length === 0) return 0;
    let sum = 0;
    for (const corr of correlations) {
      sum += corr.correlationStrength;
    }
    return sum / correlations.length;
  }

  /**
   * Calculate confidence in correlation analysis
   */
  private calculateConfidence(
    correlations: DetectedCorrelation[],
    signalScores: Map<SignalSource, number>
  ): number {
    // Base confidence on number of signals available
    const signalConfidence = Math.min(1, signalScores.size / 8);

    // Add correlation confidence
    const avgCorrelation = this.calculateOverallCorrelation(correlations);

    // Combine
    return (signalConfidence + avgCorrelation) / 2;
  }

  /**
   * Generate insights from correlation analysis
   */
  private generateInsights(
    correlations: DetectedCorrelation[],
    patterns: PatternDetection[],
    totalBoost: number
  ): string[] {
    const insights: string[] = [];

    // Summarize strong correlations
    const strongCorr = correlations.filter(
      (c) => c.strengthLevel === CorrelationStrength.STRONG ||
        c.strengthLevel === CorrelationStrength.VERY_STRONG
    );

    if (strongCorr.length > 0) {
      insights.push(
        `Found ${strongCorr.length} strong signal correlation(s)`
      );
    }

    // Report detected patterns
    const detectedPatterns = patterns.filter((p) => p.detected);
    for (const pattern of detectedPatterns) {
      insights.push(
        `Detected pattern: ${CORRELATION_PATTERN_DESCRIPTIONS[pattern.pattern]}`
      );
    }

    // Summarize boost
    if (totalBoost > 0) {
      insights.push(
        `Applied correlation boost of ${totalBoost.toFixed(1)} points`
      );
    }

    // Note high correlations
    for (const corr of strongCorr.slice(0, 3)) {
      insights.push(`${corr.description} (strength: ${(corr.correlationStrength * 100).toFixed(0)}%)`);
    }

    return insights;
  }

  /**
   * Update statistics
   */
  private updateStatistics(
    result: SignalCorrelationAnalysisResult,
    correlations: DetectedCorrelation[],
    patterns: PatternDetection[]
  ): void {
    this.totalAnalyses++;

    if (result.totalBoost > 0) {
      this.analysesWithBoost++;
      this.totalBoostApplied += result.totalBoost;
      this.maxBoostApplied = Math.max(this.maxBoostApplied, result.totalBoost);
    }

    // Update pattern counts
    for (const pattern of patterns) {
      if (pattern.detected) {
        this.patternDetectionCounts.set(
          pattern.pattern,
          (this.patternDetectionCounts.get(pattern.pattern) || 0) + 1
        );
      }
    }

    // Update pair counts
    for (const corr of correlations) {
      if (corr.correlationStrength >= this.config.minCorrelationStrength) {
        const pairKey = `${corr.signal1}:${corr.signal2}`;
        this.pairDetectionCounts.set(
          pairKey,
          (this.pairDetectionCounts.get(pairKey) || 0) + 1
        );
        this.pairBoostSums.set(
          pairKey,
          (this.pairBoostSums.get(pairKey) || 0) + corr.boostContribution
        );
      }
    }
  }

  /**
   * Get cached result
   */
  private getCachedResult(walletAddress: string): SignalCorrelationAnalysisResult | null {
    const entry = this.cache.get(walletAddress.toLowerCase());
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(walletAddress.toLowerCase());
      return null;
    }

    return entry.result;
  }

  /**
   * Cache a result
   */
  private cacheResult(walletAddress: string, result: SignalCorrelationAnalysisResult): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(walletAddress.toLowerCase(), {
      result,
      timestamp: Date.now(),
    });
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

/**
 * Create a new multi-signal correlation scorer
 */
export function createMultiSignalCorrelationScorer(
  config: Partial<MultiSignalCorrelationScorerConfig> = {}
): MultiSignalCorrelationScorer {
  return new MultiSignalCorrelationScorer(config);
}

// Shared instance
let sharedInstance: MultiSignalCorrelationScorer | null = null;

/**
 * Get the shared multi-signal correlation scorer instance
 */
export function getSharedMultiSignalCorrelationScorer(): MultiSignalCorrelationScorer {
  if (!sharedInstance) {
    sharedInstance = createMultiSignalCorrelationScorer();
  }
  return sharedInstance;
}

/**
 * Set the shared instance
 */
export function setSharedMultiSignalCorrelationScorer(
  scorer: MultiSignalCorrelationScorer
): void {
  sharedInstance = scorer;
}

/**
 * Reset the shared instance
 */
export function resetSharedMultiSignalCorrelationScorer(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze correlations using shared instance
 */
export function analyzeSignalCorrelations(
  compositeResult: CompositeScoreResult,
  options?: AnalyzeSignalCorrelationOptions
): SignalCorrelationAnalysisResult {
  return getSharedMultiSignalCorrelationScorer().analyzeCorrelations(
    compositeResult,
    options
  );
}

/**
 * Batch analyze correlations using shared instance
 */
export function batchAnalyzeSignalCorrelations(
  compositeResults: CompositeScoreResult[],
  options?: AnalyzeSignalCorrelationOptions
): BatchSignalCorrelationResult {
  return getSharedMultiSignalCorrelationScorer().batchAnalyzeCorrelations(
    compositeResults,
    options
  );
}

/**
 * Apply correlation boost using shared instance
 */
export function applySignalCorrelationBoost(
  compositeResult: CompositeScoreResult,
  options?: AnalyzeSignalCorrelationOptions
): number {
  return getSharedMultiSignalCorrelationScorer().applyCorrelationBoost(
    compositeResult,
    options
  );
}

/**
 * Get correlation scorer summary using shared instance
 */
export function getCorrelationScorerSummary(): CorrelationScorerSummary {
  return getSharedMultiSignalCorrelationScorer().getSummary();
}

/**
 * Record boost effectiveness using shared instance
 */
export function recordCorrelationBoostEffectiveness(
  walletAddress: string,
  pattern: CorrelationPattern,
  originalScore: number,
  boostedScore: number,
  correctOutcome: boolean | null
): void {
  getSharedMultiSignalCorrelationScorer().recordBoostEffectiveness(
    walletAddress,
    pattern,
    originalScore,
    boostedScore,
    correctOutcome
  );
}

// ============================================================================
// Description Helpers
// ============================================================================

/**
 * Get correlation type description
 */
export function getCorrelationTypeDescription(type: SignalCorrelationType): string {
  return CORRELATION_TYPE_DESCRIPTIONS[type];
}

/**
 * Get correlation strength description
 */
export function getCorrelationStrengthDescription(strength: CorrelationStrength): string {
  return CORRELATION_STRENGTH_DESCRIPTIONS[strength];
}

/**
 * Get correlation pattern description
 */
export function getCorrelationPatternDescription(pattern: CorrelationPattern): string {
  return CORRELATION_PATTERN_DESCRIPTIONS[pattern];
}

/**
 * Get boost impact description
 */
export function getBoostImpactDescription(impact: BoostImpact): string {
  return BOOST_IMPACT_DESCRIPTIONS[impact];
}
