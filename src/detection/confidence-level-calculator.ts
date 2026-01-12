/**
 * Confidence Level Calculator (DET-SCORE-006)
 *
 * Calculate confidence level for each detection based on signal strength
 * and data quality.
 *
 * Features:
 * - Assess signal strength from multiple sources
 * - Consider data quality (sample size, data freshness, completeness)
 * - Calculate confidence 0-100 scale
 * - Include in alert metadata
 * - Support batch confidence calculation
 * - Event emission for confidence changes
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Confidence level classification
 */
export enum ConfidenceLevel {
  /** Very low confidence - insufficient data (0-20) */
  VERY_LOW = "VERY_LOW",
  /** Low confidence - limited data (20-40) */
  LOW = "LOW",
  /** Medium confidence - moderate data (40-60) */
  MEDIUM = "MEDIUM",
  /** High confidence - good data quality (60-80) */
  HIGH = "HIGH",
  /** Very high confidence - excellent data (80-100) */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Confidence factor type
 */
export enum ConfidenceFactor {
  /** Sample size adequacy */
  SAMPLE_SIZE = "SAMPLE_SIZE",
  /** Data freshness (recency) */
  DATA_FRESHNESS = "DATA_FRESHNESS",
  /** Data completeness (no missing fields) */
  DATA_COMPLETENESS = "DATA_COMPLETENESS",
  /** Signal consistency (multiple signals agree) */
  SIGNAL_CONSISTENCY = "SIGNAL_CONSISTENCY",
  /** Historical validation (past predictions) */
  HISTORICAL_VALIDATION = "HISTORICAL_VALIDATION",
  /** Cross-validation with external data */
  CROSS_VALIDATION = "CROSS_VALIDATION",
  /** Pattern stability over time */
  PATTERN_STABILITY = "PATTERN_STABILITY",
  /** Source reliability */
  SOURCE_RELIABILITY = "SOURCE_RELIABILITY",
}

/**
 * Confidence factor reason (for display)
 */
export const CONFIDENCE_FACTOR_DESCRIPTIONS: Record<ConfidenceFactor, string> = {
  [ConfidenceFactor.SAMPLE_SIZE]: "Sample size adequacy for statistical significance",
  [ConfidenceFactor.DATA_FRESHNESS]: "Recency of data used in analysis",
  [ConfidenceFactor.DATA_COMPLETENESS]: "Completeness of required data fields",
  [ConfidenceFactor.SIGNAL_CONSISTENCY]: "Agreement between multiple detection signals",
  [ConfidenceFactor.HISTORICAL_VALIDATION]: "Validation against historical outcomes",
  [ConfidenceFactor.CROSS_VALIDATION]: "Cross-validation with external data sources",
  [ConfidenceFactor.PATTERN_STABILITY]: "Stability of detected patterns over time",
  [ConfidenceFactor.SOURCE_RELIABILITY]: "Reliability of data sources used",
};

/**
 * Confidence level descriptions
 */
export const CONFIDENCE_LEVEL_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.VERY_LOW]: "Insufficient data - treat with caution",
  [ConfidenceLevel.LOW]: "Limited data - may need more information",
  [ConfidenceLevel.MEDIUM]: "Moderate confidence - reasonable basis for alerts",
  [ConfidenceLevel.HIGH]: "Good confidence - reliable for decision making",
  [ConfidenceLevel.VERY_HIGH]: "Excellent confidence - high certainty in detection",
};

/**
 * Individual factor contribution to confidence
 */
export interface ConfidenceFactorContribution {
  /** Factor type */
  factor: ConfidenceFactor;
  /** Factor description */
  description: string;
  /** Raw score for this factor (0-100) */
  rawScore: number;
  /** Configured weight for this factor (0-1) */
  weight: number;
  /** Weighted contribution to final confidence */
  weightedScore: number;
  /** Explanation for the score */
  reason: string;
  /** Whether this factor was measurable */
  available: boolean;
}

/**
 * Input signal data for confidence calculation
 */
export interface SignalInput {
  /** Signal name/identifier */
  name: string;
  /** Raw signal score (0-100) */
  score: number;
  /** Number of data points used */
  sampleSize: number;
  /** Age of oldest data in hours */
  dataAgeHours: number;
  /** Percentage of required fields present (0-100) */
  completeness: number;
  /** Whether signal has been historically validated */
  hasHistoricalValidation: boolean;
  /** Source reliability score (0-100) */
  sourceReliability?: number;
  /** Optional: related signal scores for consistency check */
  relatedSignals?: Array<{ name: string; score: number }>;
}

/**
 * Alert metadata with confidence
 */
export interface AlertConfidenceMetadata {
  /** Overall confidence score (0-100) */
  confidenceScore: number;
  /** Confidence level classification */
  confidenceLevel: ConfidenceLevel;
  /** Description of confidence level */
  confidenceDescription: string;
  /** Individual factor contributions */
  factorContributions: ConfidenceFactorContribution[];
  /** Top positive factors */
  strengthFactors: string[];
  /** Top negative factors (reducing confidence) */
  weaknessFactors: string[];
  /** Recommended actions based on confidence */
  recommendations: string[];
  /** Data quality summary */
  dataQualitySummary: {
    totalSampleSize: number;
    avgDataAgeHours: number;
    avgCompleteness: number;
    signalCount: number;
  };
}

/**
 * Confidence calculation result
 */
export interface ConfidenceResult {
  /** Wallet address analyzed */
  walletAddress: string;
  /** Overall confidence score (0-100) */
  confidenceScore: number;
  /** Confidence level classification */
  confidenceLevel: ConfidenceLevel;
  /** Alert metadata */
  metadata: AlertConfidenceMetadata;
  /** Timestamp of calculation */
  calculatedAt: Date;
}

/**
 * Batch confidence calculation result
 */
export interface BatchConfidenceResult {
  /** Results for each wallet */
  results: ConfidenceResult[];
  /** Average confidence across all wallets */
  averageConfidence: number;
  /** Distribution of confidence levels */
  levelDistribution: Record<ConfidenceLevel, number>;
  /** Wallets with low confidence (may need more data) */
  lowConfidenceWallets: string[];
  /** Wallets with high confidence */
  highConfidenceWallets: string[];
  /** Processing statistics */
  stats: {
    processedCount: number;
    failedCount: number;
    avgProcessingTimeMs: number;
  };
}

/**
 * Configuration for confidence calculator
 */
export interface ConfidenceCalculatorConfig {
  /** Factor weights (must sum to 1.0) */
  factorWeights: Record<ConfidenceFactor, number>;
  /** Minimum sample size for VERY_HIGH confidence */
  minSampleSizeForHighConfidence: number;
  /** Maximum data age (hours) for fresh data */
  maxDataAgeHoursForFresh: number;
  /** Minimum completeness for HIGH confidence */
  minCompletenessForHigh: number;
  /** Level thresholds */
  levelThresholds: {
    veryLow: number;
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  };
  /** Enable caching */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Enable event emission */
  enableEvents: boolean;
}

/**
 * Default factor weights
 */
export const DEFAULT_FACTOR_WEIGHTS: Record<ConfidenceFactor, number> = {
  [ConfidenceFactor.SAMPLE_SIZE]: 0.25,
  [ConfidenceFactor.DATA_FRESHNESS]: 0.15,
  [ConfidenceFactor.DATA_COMPLETENESS]: 0.15,
  [ConfidenceFactor.SIGNAL_CONSISTENCY]: 0.2,
  [ConfidenceFactor.HISTORICAL_VALIDATION]: 0.1,
  [ConfidenceFactor.CROSS_VALIDATION]: 0.05,
  [ConfidenceFactor.PATTERN_STABILITY]: 0.05,
  [ConfidenceFactor.SOURCE_RELIABILITY]: 0.05,
};

/**
 * Default level thresholds
 */
export const DEFAULT_LEVEL_THRESHOLDS = {
  veryLow: 20,
  low: 40,
  medium: 60,
  high: 80,
  veryHigh: 100,
};

/**
 * Default confidence calculator configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceCalculatorConfig = {
  factorWeights: DEFAULT_FACTOR_WEIGHTS,
  minSampleSizeForHighConfidence: 30,
  maxDataAgeHoursForFresh: 24,
  minCompletenessForHigh: 90,
  levelThresholds: DEFAULT_LEVEL_THRESHOLDS,
  enableCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  enableEvents: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Get confidence level from score
 */
function getConfidenceLevelFromScore(
  score: number,
  thresholds: typeof DEFAULT_LEVEL_THRESHOLDS
): ConfidenceLevel {
  if (score >= thresholds.high) return ConfidenceLevel.VERY_HIGH;
  if (score >= thresholds.medium) return ConfidenceLevel.HIGH;
  if (score >= thresholds.low) return ConfidenceLevel.MEDIUM;
  if (score >= thresholds.veryLow) return ConfidenceLevel.LOW;
  return ConfidenceLevel.VERY_LOW;
}

/**
 * Calculate sample size score
 */
function calculateSampleSizeScore(
  totalSampleSize: number,
  minForHigh: number
): { score: number; reason: string } {
  if (totalSampleSize === 0) {
    return { score: 0, reason: "No data available" };
  }
  if (totalSampleSize < 5) {
    return { score: 15, reason: `Very small sample size (${totalSampleSize} data points)` };
  }
  if (totalSampleSize < 10) {
    return { score: 35, reason: `Small sample size (${totalSampleSize} data points)` };
  }
  if (totalSampleSize < minForHigh) {
    const ratio = totalSampleSize / minForHigh;
    const score = 40 + ratio * 30;
    return { score, reason: `Moderate sample size (${totalSampleSize} data points)` };
  }
  if (totalSampleSize < minForHigh * 2) {
    return { score: 80, reason: `Good sample size (${totalSampleSize} data points)` };
  }
  return { score: 95, reason: `Excellent sample size (${totalSampleSize} data points)` };
}

/**
 * Calculate data freshness score
 */
function calculateDataFreshnessScore(
  avgDataAgeHours: number,
  maxAgeForFresh: number
): { score: number; reason: string } {
  if (avgDataAgeHours <= 1) {
    return { score: 100, reason: "Data is very fresh (within 1 hour)" };
  }
  if (avgDataAgeHours <= maxAgeForFresh / 4) {
    return { score: 90, reason: `Data is fresh (${avgDataAgeHours.toFixed(1)} hours old)` };
  }
  if (avgDataAgeHours <= maxAgeForFresh / 2) {
    return { score: 75, reason: `Data is moderately fresh (${avgDataAgeHours.toFixed(1)} hours old)` };
  }
  if (avgDataAgeHours <= maxAgeForFresh) {
    return { score: 55, reason: `Data is aging (${avgDataAgeHours.toFixed(1)} hours old)` };
  }
  if (avgDataAgeHours <= maxAgeForFresh * 2) {
    return { score: 35, reason: `Data is stale (${avgDataAgeHours.toFixed(1)} hours old)` };
  }
  return { score: 15, reason: `Data is very old (${avgDataAgeHours.toFixed(1)} hours old)` };
}

/**
 * Calculate data completeness score
 */
function calculateCompletenessScore(
  avgCompleteness: number
): { score: number; reason: string } {
  if (avgCompleteness >= 100) {
    return { score: 100, reason: "All data fields are complete" };
  }
  if (avgCompleteness >= 90) {
    return { score: 90, reason: `Data is ${avgCompleteness.toFixed(0)}% complete` };
  }
  if (avgCompleteness >= 75) {
    return { score: 70, reason: `Data is ${avgCompleteness.toFixed(0)}% complete - some fields missing` };
  }
  if (avgCompleteness >= 50) {
    return { score: 45, reason: `Data is ${avgCompleteness.toFixed(0)}% complete - significant fields missing` };
  }
  return { score: 20, reason: `Data is ${avgCompleteness.toFixed(0)}% complete - major gaps` };
}

/**
 * Calculate signal consistency score
 */
function calculateSignalConsistencyScore(
  signals: SignalInput[]
): { score: number; reason: string } {
  if (signals.length === 0) {
    return { score: 0, reason: "No signals to compare" };
  }
  if (signals.length === 1) {
    return { score: 50, reason: "Only one signal - cannot assess consistency" };
  }

  const scores = signals.map((s) => s.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Lower std dev = higher consistency
  if (stdDev < 5) {
    return { score: 100, reason: "Signals are highly consistent" };
  }
  if (stdDev < 10) {
    return { score: 85, reason: "Signals show good consistency" };
  }
  if (stdDev < 15) {
    return { score: 70, reason: "Signals show moderate consistency" };
  }
  if (stdDev < 25) {
    return { score: 50, reason: "Signals show some disagreement" };
  }
  if (stdDev < 35) {
    return { score: 30, reason: "Signals show significant disagreement" };
  }
  return { score: 15, reason: "Signals are inconsistent" };
}

/**
 * Calculate historical validation score
 */
function calculateHistoricalValidationScore(
  signals: SignalInput[]
): { score: number; reason: string } {
  const validatedSignals = signals.filter((s) => s.hasHistoricalValidation);
  const ratio = signals.length > 0 ? validatedSignals.length / signals.length : 0;

  if (ratio >= 0.8) {
    return { score: 95, reason: `${validatedSignals.length}/${signals.length} signals historically validated` };
  }
  if (ratio >= 0.5) {
    return { score: 70, reason: `${validatedSignals.length}/${signals.length} signals historically validated` };
  }
  if (ratio > 0) {
    return { score: 40, reason: `${validatedSignals.length}/${signals.length} signals historically validated` };
  }
  return { score: 20, reason: "No signals have historical validation" };
}

/**
 * Calculate source reliability score
 */
function calculateSourceReliabilityScore(
  signals: SignalInput[]
): { score: number; reason: string } {
  const reliabilityScores = signals
    .filter((s) => s.sourceReliability !== undefined)
    .map((s) => s.sourceReliability!);

  if (reliabilityScores.length === 0) {
    return { score: 50, reason: "Source reliability not specified" };
  }

  const avgReliability =
    reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length;

  if (avgReliability >= 90) {
    return { score: 95, reason: `Sources are highly reliable (avg ${avgReliability.toFixed(0)}%)` };
  }
  if (avgReliability >= 75) {
    return { score: 80, reason: `Sources are reliable (avg ${avgReliability.toFixed(0)}%)` };
  }
  if (avgReliability >= 50) {
    return { score: 55, reason: `Sources have moderate reliability (avg ${avgReliability.toFixed(0)}%)` };
  }
  return { score: 30, reason: `Sources have low reliability (avg ${avgReliability.toFixed(0)}%)` };
}

/**
 * Generate recommendations based on confidence
 */
function generateRecommendations(
  confidenceLevel: ConfidenceLevel,
  factorContributions: ConfidenceFactorContribution[]
): string[] {
  const recommendations: string[] = [];

  // Low factors that need improvement
  const lowFactors = factorContributions.filter(
    (f) => f.available && f.rawScore < 50
  );

  for (const factor of lowFactors) {
    switch (factor.factor) {
      case ConfidenceFactor.SAMPLE_SIZE:
        recommendations.push("Gather more data points to improve statistical significance");
        break;
      case ConfidenceFactor.DATA_FRESHNESS:
        recommendations.push("Refresh data to ensure analysis uses recent information");
        break;
      case ConfidenceFactor.DATA_COMPLETENESS:
        recommendations.push("Fill in missing data fields for more complete analysis");
        break;
      case ConfidenceFactor.SIGNAL_CONSISTENCY:
        recommendations.push("Investigate signal disagreements to understand conflicting indicators");
        break;
      case ConfidenceFactor.HISTORICAL_VALIDATION:
        recommendations.push("Wait for more outcomes to validate detection accuracy");
        break;
    }
  }

  // General recommendations based on confidence level
  switch (confidenceLevel) {
    case ConfidenceLevel.VERY_LOW:
      recommendations.push(
        "Treat this detection with caution - insufficient data for reliable conclusions"
      );
      break;
    case ConfidenceLevel.LOW:
      recommendations.push(
        "Consider gathering additional data before taking action"
      );
      break;
    case ConfidenceLevel.MEDIUM:
      recommendations.push(
        "Reasonable basis for monitoring - consider follow-up analysis"
      );
      break;
    case ConfidenceLevel.HIGH:
      recommendations.push(
        "Good confidence level - suitable for alerting and investigation"
      );
      break;
    case ConfidenceLevel.VERY_HIGH:
      recommendations.push(
        "High confidence detection - prioritize for immediate review"
      );
      break;
  }

  return recommendations;
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: ConfidenceResult;
  expiresAt: number;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Confidence Level Calculator
 *
 * Calculates confidence levels for detection alerts based on signal strength
 * and data quality.
 */
export class ConfidenceLevelCalculator extends EventEmitter {
  private config: ConfidenceCalculatorConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  private calculationsCount = 0;
  private totalProcessingTimeMs = 0;

  constructor(config: Partial<ConfidenceCalculatorConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIDENCE_CONFIG,
      ...config,
      factorWeights: {
        ...DEFAULT_FACTOR_WEIGHTS,
        ...config.factorWeights,
      },
      levelThresholds: {
        ...DEFAULT_LEVEL_THRESHOLDS,
        ...config.levelThresholds,
      },
    };

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.config.factorWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Factor weights must sum to 1.0, got ${weightSum}`);
    }
  }

  /**
   * Calculate confidence for a wallet's detection signals
   */
  calculateConfidence(
    walletAddress: string,
    signals: SignalInput[],
    options: { bypassCache?: boolean } = {}
  ): ConfidenceResult {
    const startTime = Date.now();
    const normalized = normalizeAddress(walletAddress);

    // Check cache
    if (this.config.enableCache && !options.bypassCache) {
      const cached = this.cache.get(normalized);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheHits++;
        return cached.result;
      }
    }
    this.cacheMisses++;

    // Calculate each factor contribution
    const factorContributions: ConfidenceFactorContribution[] = [];

    // 1. Sample Size
    const totalSampleSize = signals.reduce((sum, s) => sum + s.sampleSize, 0);
    const sampleSizeResult = calculateSampleSizeScore(
      totalSampleSize,
      this.config.minSampleSizeForHighConfidence
    );
    factorContributions.push({
      factor: ConfidenceFactor.SAMPLE_SIZE,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.SAMPLE_SIZE],
      rawScore: sampleSizeResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.SAMPLE_SIZE],
      weightedScore: sampleSizeResult.score * this.config.factorWeights[ConfidenceFactor.SAMPLE_SIZE],
      reason: sampleSizeResult.reason,
      available: true,
    });

    // 2. Data Freshness
    const avgDataAgeHours =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.dataAgeHours, 0) / signals.length
        : 0;
    const freshnessResult = calculateDataFreshnessScore(
      avgDataAgeHours,
      this.config.maxDataAgeHoursForFresh
    );
    factorContributions.push({
      factor: ConfidenceFactor.DATA_FRESHNESS,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.DATA_FRESHNESS],
      rawScore: freshnessResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.DATA_FRESHNESS],
      weightedScore: freshnessResult.score * this.config.factorWeights[ConfidenceFactor.DATA_FRESHNESS],
      reason: freshnessResult.reason,
      available: signals.length > 0,
    });

    // 3. Data Completeness
    const avgCompleteness =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.completeness, 0) / signals.length
        : 0;
    const completenessResult = calculateCompletenessScore(avgCompleteness);
    factorContributions.push({
      factor: ConfidenceFactor.DATA_COMPLETENESS,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.DATA_COMPLETENESS],
      rawScore: completenessResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.DATA_COMPLETENESS],
      weightedScore: completenessResult.score * this.config.factorWeights[ConfidenceFactor.DATA_COMPLETENESS],
      reason: completenessResult.reason,
      available: signals.length > 0,
    });

    // 4. Signal Consistency
    const consistencyResult = calculateSignalConsistencyScore(signals);
    factorContributions.push({
      factor: ConfidenceFactor.SIGNAL_CONSISTENCY,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.SIGNAL_CONSISTENCY],
      rawScore: consistencyResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.SIGNAL_CONSISTENCY],
      weightedScore: consistencyResult.score * this.config.factorWeights[ConfidenceFactor.SIGNAL_CONSISTENCY],
      reason: consistencyResult.reason,
      available: signals.length > 1,
    });

    // 5. Historical Validation
    const validationResult = calculateHistoricalValidationScore(signals);
    factorContributions.push({
      factor: ConfidenceFactor.HISTORICAL_VALIDATION,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.HISTORICAL_VALIDATION],
      rawScore: validationResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.HISTORICAL_VALIDATION],
      weightedScore: validationResult.score * this.config.factorWeights[ConfidenceFactor.HISTORICAL_VALIDATION],
      reason: validationResult.reason,
      available: signals.length > 0,
    });

    // 6. Cross Validation (placeholder - use default)
    factorContributions.push({
      factor: ConfidenceFactor.CROSS_VALIDATION,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.CROSS_VALIDATION],
      rawScore: 50,
      weight: this.config.factorWeights[ConfidenceFactor.CROSS_VALIDATION],
      weightedScore: 50 * this.config.factorWeights[ConfidenceFactor.CROSS_VALIDATION],
      reason: "Cross-validation not implemented",
      available: false,
    });

    // 7. Pattern Stability (placeholder - use default)
    factorContributions.push({
      factor: ConfidenceFactor.PATTERN_STABILITY,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.PATTERN_STABILITY],
      rawScore: 50,
      weight: this.config.factorWeights[ConfidenceFactor.PATTERN_STABILITY],
      weightedScore: 50 * this.config.factorWeights[ConfidenceFactor.PATTERN_STABILITY],
      reason: "Pattern stability analysis not implemented",
      available: false,
    });

    // 8. Source Reliability
    const reliabilityResult = calculateSourceReliabilityScore(signals);
    factorContributions.push({
      factor: ConfidenceFactor.SOURCE_RELIABILITY,
      description: CONFIDENCE_FACTOR_DESCRIPTIONS[ConfidenceFactor.SOURCE_RELIABILITY],
      rawScore: reliabilityResult.score,
      weight: this.config.factorWeights[ConfidenceFactor.SOURCE_RELIABILITY],
      weightedScore: reliabilityResult.score * this.config.factorWeights[ConfidenceFactor.SOURCE_RELIABILITY],
      reason: reliabilityResult.reason,
      available: signals.some((s) => s.sourceReliability !== undefined),
    });

    // Calculate final confidence score
    const confidenceScore = Math.min(
      100,
      Math.max(
        0,
        factorContributions.reduce((sum, f) => sum + f.weightedScore, 0)
      )
    );

    // Determine confidence level
    const confidenceLevel = getConfidenceLevelFromScore(
      confidenceScore,
      this.config.levelThresholds
    );

    // Identify strength and weakness factors
    const sortedFactors = [...factorContributions]
      .filter((f) => f.available)
      .sort((a, b) => b.rawScore - a.rawScore);
    const strengthFactors = sortedFactors
      .slice(0, 3)
      .filter((f) => f.rawScore >= 70)
      .map((f) => f.reason);
    const weaknessFactors = sortedFactors
      .slice(-3)
      .filter((f) => f.rawScore < 50)
      .map((f) => f.reason);

    // Generate recommendations
    const recommendations = generateRecommendations(confidenceLevel, factorContributions);

    // Build metadata
    const metadata: AlertConfidenceMetadata = {
      confidenceScore,
      confidenceLevel,
      confidenceDescription: CONFIDENCE_LEVEL_DESCRIPTIONS[confidenceLevel],
      factorContributions,
      strengthFactors,
      weaknessFactors,
      recommendations,
      dataQualitySummary: {
        totalSampleSize,
        avgDataAgeHours,
        avgCompleteness,
        signalCount: signals.length,
      },
    };

    const result: ConfidenceResult = {
      walletAddress: normalized,
      confidenceScore,
      confidenceLevel,
      metadata,
      calculatedAt: new Date(),
    };

    // Cache result
    if (this.config.enableCache) {
      this.cache.set(normalized, {
        result,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });
    }

    // Update stats
    const processingTime = Date.now() - startTime;
    this.calculationsCount++;
    this.totalProcessingTimeMs += processingTime;

    // Emit events
    if (this.config.enableEvents) {
      this.emit("confidence-calculated", {
        walletAddress: normalized,
        confidenceScore,
        confidenceLevel,
      });

      if (confidenceLevel === ConfidenceLevel.VERY_LOW || confidenceLevel === ConfidenceLevel.LOW) {
        this.emit("low-confidence-detected", {
          walletAddress: normalized,
          confidenceScore,
          recommendations,
        });
      }
    }

    return result;
  }

  /**
   * Calculate confidence for multiple wallets
   */
  batchCalculateConfidence(
    walletsWithSignals: Array<{ walletAddress: string; signals: SignalInput[] }>,
    options: { bypassCache?: boolean } = {}
  ): BatchConfidenceResult {
    const results: ConfidenceResult[] = [];
    const levelDistribution: Record<ConfidenceLevel, number> = {
      [ConfidenceLevel.VERY_LOW]: 0,
      [ConfidenceLevel.LOW]: 0,
      [ConfidenceLevel.MEDIUM]: 0,
      [ConfidenceLevel.HIGH]: 0,
      [ConfidenceLevel.VERY_HIGH]: 0,
    };
    let failedCount = 0;
    const startTime = Date.now();

    for (const { walletAddress, signals } of walletsWithSignals) {
      try {
        const result = this.calculateConfidence(walletAddress, signals, options);
        results.push(result);
        levelDistribution[result.confidenceLevel]++;
      } catch (error) {
        failedCount++;
      }
    }

    const avgConfidence =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length
        : 0;

    const lowConfidenceWallets = results
      .filter(
        (r) =>
          r.confidenceLevel === ConfidenceLevel.VERY_LOW ||
          r.confidenceLevel === ConfidenceLevel.LOW
      )
      .map((r) => r.walletAddress);

    const highConfidenceWallets = results
      .filter(
        (r) =>
          r.confidenceLevel === ConfidenceLevel.HIGH ||
          r.confidenceLevel === ConfidenceLevel.VERY_HIGH
      )
      .map((r) => r.walletAddress);

    const totalTime = Date.now() - startTime;

    return {
      results,
      averageConfidence: avgConfidence,
      levelDistribution,
      lowConfidenceWallets,
      highConfidenceWallets,
      stats: {
        processedCount: results.length,
        failedCount,
        avgProcessingTimeMs: results.length > 0 ? totalTime / results.length : 0,
      },
    };
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalCalculations: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    avgProcessingTimeMs: number;
  } {
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    return {
      totalCalculations: this.calculationsCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0,
      avgProcessingTimeMs:
        this.calculationsCount > 0 ? this.totalProcessingTimeMs / this.calculationsCount : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConfidenceCalculatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      factorWeights: {
        ...this.config.factorWeights,
        ...config.factorWeights,
      },
      levelThresholds: {
        ...this.config.levelThresholds,
        ...config.levelThresholds,
      },
    };

    // Validate weights
    const weightSum = Object.values(this.config.factorWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Factor weights must sum to 1.0, got ${weightSum}`);
    }

    if (this.config.enableEvents) {
      this.emit("config-updated", this.config);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

/**
 * Create a new confidence level calculator
 */
export function createConfidenceLevelCalculator(
  config?: Partial<ConfidenceCalculatorConfig>
): ConfidenceLevelCalculator {
  return new ConfidenceLevelCalculator(config);
}

let sharedInstance: ConfidenceLevelCalculator | null = null;

/**
 * Get the shared confidence level calculator instance
 */
export function getSharedConfidenceLevelCalculator(): ConfidenceLevelCalculator {
  if (!sharedInstance) {
    sharedInstance = createConfidenceLevelCalculator();
  }
  return sharedInstance;
}

/**
 * Set a custom shared instance
 */
export function setSharedConfidenceLevelCalculator(
  instance: ConfidenceLevelCalculator
): void {
  sharedInstance = instance;
}

/**
 * Reset the shared instance
 */
export function resetSharedConfidenceLevelCalculator(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate confidence for a wallet's signals
 */
export function calculateConfidence(
  walletAddress: string,
  signals: SignalInput[]
): ConfidenceResult {
  return getSharedConfidenceLevelCalculator().calculateConfidence(walletAddress, signals);
}

/**
 * Batch calculate confidence
 */
export function batchCalculateConfidence(
  walletsWithSignals: Array<{ walletAddress: string; signals: SignalInput[] }>
): BatchConfidenceResult {
  return getSharedConfidenceLevelCalculator().batchCalculateConfidence(walletsWithSignals);
}

/**
 * Get confidence level description
 */
export function getConfidenceLevelDescription(level: ConfidenceLevel): string {
  return CONFIDENCE_LEVEL_DESCRIPTIONS[level];
}

/**
 * Get confidence factor description
 */
export function getConfidenceFactorDescription(factor: ConfidenceFactor): string {
  return CONFIDENCE_FACTOR_DESCRIPTIONS[factor];
}
