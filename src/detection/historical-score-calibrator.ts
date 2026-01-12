/**
 * Historical Score Calibrator (DET-SCORE-007)
 *
 * Calibrate scoring based on historical outcomes. This module tracks the relationship
 * between suspicion scores and actual outcomes (confirmed insider, false positive, etc.)
 * to improve scoring accuracy over time.
 *
 * Features:
 * - Track score vs outcome data
 * - Calculate calibration metrics (Brier score, reliability curve)
 * - Adjust scoring parameters based on historical data
 * - Improve detection accuracy over time
 * - Support for feedback integration
 * - Event emission for calibration updates
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Outcome type for a detection
 */
export enum OutcomeType {
  /** Detection was confirmed as true positive (actual insider/suspicious) */
  TRUE_POSITIVE = "TRUE_POSITIVE",
  /** Detection was a false positive (not actually suspicious) */
  FALSE_POSITIVE = "FALSE_POSITIVE",
  /** Detection was a true negative (correctly identified as normal) */
  TRUE_NEGATIVE = "TRUE_NEGATIVE",
  /** Detection was a false negative (missed actual insider) */
  FALSE_NEGATIVE = "FALSE_NEGATIVE",
  /** Outcome is unknown/pending */
  UNKNOWN = "UNKNOWN",
}

/**
 * Calibration quality level
 */
export enum CalibrationQuality {
  /** Excellent calibration (Brier score < 0.1) */
  EXCELLENT = "EXCELLENT",
  /** Good calibration (Brier score < 0.2) */
  GOOD = "GOOD",
  /** Fair calibration (Brier score < 0.3) */
  FAIR = "FAIR",
  /** Poor calibration (Brier score >= 0.3) */
  POOR = "POOR",
  /** Insufficient data for calibration */
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
}

/**
 * Score bucket for reliability curve
 */
export enum ScoreBucket {
  /** 0-10 score range */
  BUCKET_0_10 = "BUCKET_0_10",
  /** 10-20 score range */
  BUCKET_10_20 = "BUCKET_10_20",
  /** 20-30 score range */
  BUCKET_20_30 = "BUCKET_20_30",
  /** 30-40 score range */
  BUCKET_30_40 = "BUCKET_30_40",
  /** 40-50 score range */
  BUCKET_40_50 = "BUCKET_40_50",
  /** 50-60 score range */
  BUCKET_50_60 = "BUCKET_50_60",
  /** 60-70 score range */
  BUCKET_60_70 = "BUCKET_60_70",
  /** 70-80 score range */
  BUCKET_70_80 = "BUCKET_70_80",
  /** 80-90 score range */
  BUCKET_80_90 = "BUCKET_80_90",
  /** 90-100 score range */
  BUCKET_90_100 = "BUCKET_90_100",
}

/**
 * Adjustment type for calibration
 */
export enum AdjustmentType {
  /** No adjustment needed */
  NONE = "NONE",
  /** Increase sensitivity (more false negatives) */
  INCREASE_SENSITIVITY = "INCREASE_SENSITIVITY",
  /** Decrease sensitivity (more false positives) */
  DECREASE_SENSITIVITY = "DECREASE_SENSITIVITY",
  /** Adjust threshold upward */
  INCREASE_THRESHOLD = "INCREASE_THRESHOLD",
  /** Adjust threshold downward */
  DECREASE_THRESHOLD = "DECREASE_THRESHOLD",
  /** Recalibrate bucket weights */
  RECALIBRATE_BUCKETS = "RECALIBRATE_BUCKETS",
}

/**
 * Descriptions for outcome types
 */
export const OUTCOME_DESCRIPTIONS: Record<OutcomeType, string> = {
  [OutcomeType.TRUE_POSITIVE]: "Correctly identified suspicious activity",
  [OutcomeType.FALSE_POSITIVE]: "Incorrectly flagged normal activity as suspicious",
  [OutcomeType.TRUE_NEGATIVE]: "Correctly identified normal activity",
  [OutcomeType.FALSE_NEGATIVE]: "Missed suspicious activity (not detected)",
  [OutcomeType.UNKNOWN]: "Outcome not yet determined",
};

/**
 * Descriptions for calibration quality
 */
export const CALIBRATION_QUALITY_DESCRIPTIONS: Record<CalibrationQuality, string> = {
  [CalibrationQuality.EXCELLENT]: "Excellent calibration - scores accurately predict outcomes",
  [CalibrationQuality.GOOD]: "Good calibration - scores reasonably predict outcomes",
  [CalibrationQuality.FAIR]: "Fair calibration - some adjustment may improve accuracy",
  [CalibrationQuality.POOR]: "Poor calibration - significant adjustment recommended",
  [CalibrationQuality.INSUFFICIENT_DATA]: "Not enough historical data for calibration",
};

/**
 * Descriptions for adjustment types
 */
export const ADJUSTMENT_DESCRIPTIONS: Record<AdjustmentType, string> = {
  [AdjustmentType.NONE]: "No adjustment needed",
  [AdjustmentType.INCREASE_SENSITIVITY]: "Increase sensitivity to catch more true positives",
  [AdjustmentType.DECREASE_SENSITIVITY]: "Decrease sensitivity to reduce false positives",
  [AdjustmentType.INCREASE_THRESHOLD]: "Raise threshold to reduce alerts",
  [AdjustmentType.DECREASE_THRESHOLD]: "Lower threshold to capture more activity",
  [AdjustmentType.RECALIBRATE_BUCKETS]: "Recalibrate score bucket mappings",
};

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Historical outcome record
 */
export interface OutcomeRecord {
  /** Unique identifier for this record */
  id: string;
  /** Wallet address */
  walletAddress: string;
  /** Original suspicion score (0-100) */
  originalScore: number;
  /** Predicted probability (normalized score 0-1) */
  predictedProbability: number;
  /** Actual outcome */
  outcome: OutcomeType;
  /** Timestamp of the original score */
  scoredAt: Date;
  /** Timestamp of outcome determination */
  outcomeDeterminedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bucket statistics for reliability curve
 */
export interface BucketStats {
  /** Score bucket */
  bucket: ScoreBucket;
  /** Minimum score in bucket */
  minScore: number;
  /** Maximum score in bucket */
  maxScore: number;
  /** Average predicted probability in bucket */
  avgPredictedProbability: number;
  /** Actual positive rate in bucket */
  actualPositiveRate: number;
  /** Number of samples in bucket */
  sampleCount: number;
  /** Calibration error for this bucket */
  calibrationError: number;
  /** Confidence interval */
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

/**
 * Calibration metrics
 */
export interface CalibrationMetrics {
  /** Brier score (lower is better, 0-1) */
  brierScore: number;
  /** Log loss (lower is better) */
  logLoss: number;
  /** Area under ROC curve (0-1, higher is better) */
  aucRoc: number;
  /** Precision at current threshold */
  precision: number;
  /** Recall at current threshold */
  recall: number;
  /** F1 score */
  f1Score: number;
  /** True positive rate */
  truePositiveRate: number;
  /** False positive rate */
  falsePositiveRate: number;
  /** Expected calibration error */
  expectedCalibrationError: number;
  /** Maximum calibration error */
  maxCalibrationError: number;
  /** Calibration quality level */
  quality: CalibrationQuality;
  /** Reliability curve data */
  reliabilityCurve: BucketStats[];
  /** Total samples used */
  totalSamples: number;
  /** Samples with known outcomes */
  knownOutcomeSamples: number;
}

/**
 * Adjustment recommendation
 */
export interface AdjustmentRecommendation {
  /** Adjustment type */
  type: AdjustmentType;
  /** Description of the recommendation */
  description: string;
  /** Reason for the recommendation */
  reason: string;
  /** Suggested parameter changes */
  suggestedChanges: {
    /** Parameter name */
    parameter: string;
    /** Current value */
    currentValue: number;
    /** Suggested new value */
    suggestedValue: number;
    /** Expected improvement */
    expectedImprovement: string;
  }[];
  /** Confidence in this recommendation (0-100) */
  confidence: number;
  /** Priority (higher = more important) */
  priority: number;
}

/**
 * Calibration result
 */
export interface CalibrationResult {
  /** Calibration metrics */
  metrics: CalibrationMetrics;
  /** Recommended adjustments */
  recommendations: AdjustmentRecommendation[];
  /** Optimized threshold (if applicable) */
  optimizedThreshold: number;
  /** Score adjustment curve (maps original score to calibrated score) */
  scoreAdjustmentCurve: Map<ScoreBucket, number>;
  /** Whether calibration is complete and reliable */
  isCalibrated: boolean;
  /** Timestamp of calibration */
  calibratedAt: Date;
}

/**
 * Calibration summary
 */
export interface CalibrationSummary {
  /** Total outcomes tracked */
  totalOutcomes: number;
  /** Outcomes by type */
  outcomesByType: Record<OutcomeType, number>;
  /** Current calibration quality */
  currentQuality: CalibrationQuality;
  /** Current Brier score */
  currentBrierScore: number;
  /** Historical Brier scores (for trend) */
  brierScoreHistory: Array<{ timestamp: Date; brierScore: number }>;
  /** Active recommendations count */
  activeRecommendations: number;
  /** Last calibration timestamp */
  lastCalibrationAt: Date | null;
  /** Time since last calibration */
  hoursSinceLastCalibration: number | null;
}

/**
 * Configuration for historical score calibrator
 */
export interface HistoricalScoreCalibratorConfig {
  /** Minimum samples required for calibration */
  minSamplesForCalibration: number;
  /** Minimum samples per bucket for reliable stats */
  minSamplesPerBucket: number;
  /** Current threshold for flagging (used for precision/recall) */
  currentThreshold: number;
  /** Enable automatic adjustment suggestions */
  enableAutoAdjustment: boolean;
  /** Maximum age of outcomes to consider (hours) */
  maxOutcomeAgeHours: number;
  /** Enable event emission */
  enableEvents: boolean;
  /** Enable persistence (save/load) */
  enablePersistence: boolean;
  /** Brier score threshold for recalibration */
  brierScoreRecalibrationThreshold: number;
  /** Maximum outcomes to store */
  maxOutcomesToStore: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CALIBRATOR_CONFIG: HistoricalScoreCalibratorConfig = {
  minSamplesForCalibration: 50,
  minSamplesPerBucket: 5,
  currentThreshold: 50,
  enableAutoAdjustment: true,
  maxOutcomeAgeHours: 24 * 30, // 30 days
  enableEvents: true,
  enablePersistence: false,
  brierScoreRecalibrationThreshold: 0.25,
  maxOutcomesToStore: 10000,
};

/**
 * Score bucket ranges
 */
export const BUCKET_RANGES: Record<ScoreBucket, { min: number; max: number }> = {
  [ScoreBucket.BUCKET_0_10]: { min: 0, max: 10 },
  [ScoreBucket.BUCKET_10_20]: { min: 10, max: 20 },
  [ScoreBucket.BUCKET_20_30]: { min: 20, max: 30 },
  [ScoreBucket.BUCKET_30_40]: { min: 30, max: 40 },
  [ScoreBucket.BUCKET_40_50]: { min: 40, max: 50 },
  [ScoreBucket.BUCKET_50_60]: { min: 50, max: 60 },
  [ScoreBucket.BUCKET_60_70]: { min: 60, max: 70 },
  [ScoreBucket.BUCKET_70_80]: { min: 70, max: 80 },
  [ScoreBucket.BUCKET_80_90]: { min: 80, max: 90 },
  [ScoreBucket.BUCKET_90_100]: { min: 90, max: 100 },
};

/**
 * All score buckets in order
 */
export const ALL_BUCKETS: ScoreBucket[] = [
  ScoreBucket.BUCKET_0_10,
  ScoreBucket.BUCKET_10_20,
  ScoreBucket.BUCKET_20_30,
  ScoreBucket.BUCKET_30_40,
  ScoreBucket.BUCKET_40_50,
  ScoreBucket.BUCKET_50_60,
  ScoreBucket.BUCKET_60_70,
  ScoreBucket.BUCKET_70_80,
  ScoreBucket.BUCKET_80_90,
  ScoreBucket.BUCKET_90_100,
];

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
 * Get bucket for a score
 */
export function getBucketForScore(score: number): ScoreBucket {
  const clampedScore = Math.max(0, Math.min(100, score));
  if (clampedScore < 10) return ScoreBucket.BUCKET_0_10;
  if (clampedScore < 20) return ScoreBucket.BUCKET_10_20;
  if (clampedScore < 30) return ScoreBucket.BUCKET_20_30;
  if (clampedScore < 40) return ScoreBucket.BUCKET_30_40;
  if (clampedScore < 50) return ScoreBucket.BUCKET_40_50;
  if (clampedScore < 60) return ScoreBucket.BUCKET_50_60;
  if (clampedScore < 70) return ScoreBucket.BUCKET_60_70;
  if (clampedScore < 80) return ScoreBucket.BUCKET_70_80;
  if (clampedScore < 90) return ScoreBucket.BUCKET_80_90;
  return ScoreBucket.BUCKET_90_100;
}

/**
 * Convert score to probability (0-1)
 */
export function scoreToProbability(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
}

/**
 * Convert probability to score (0-100)
 */
export function probabilityToScore(probability: number): number {
  return Math.max(0, Math.min(100, probability * 100));
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate Brier score
 */
function calculateBrierScore(outcomes: OutcomeRecord[]): number {
  if (outcomes.length === 0) return 1;

  const knownOutcomes = outcomes.filter(
    (o) => o.outcome !== OutcomeType.UNKNOWN
  );
  if (knownOutcomes.length === 0) return 1;

  let sumSquaredError = 0;
  for (const outcome of knownOutcomes) {
    const actualValue =
      outcome.outcome === OutcomeType.TRUE_POSITIVE ||
      outcome.outcome === OutcomeType.FALSE_NEGATIVE
        ? 1
        : 0;
    const error = outcome.predictedProbability - actualValue;
    sumSquaredError += error * error;
  }

  return sumSquaredError / knownOutcomes.length;
}

/**
 * Calculate log loss
 */
function calculateLogLoss(outcomes: OutcomeRecord[]): number {
  const knownOutcomes = outcomes.filter(
    (o) => o.outcome !== OutcomeType.UNKNOWN
  );
  if (knownOutcomes.length === 0) return Infinity;

  const epsilon = 1e-15;
  let totalLoss = 0;

  for (const outcome of knownOutcomes) {
    const actualValue =
      outcome.outcome === OutcomeType.TRUE_POSITIVE ||
      outcome.outcome === OutcomeType.FALSE_NEGATIVE
        ? 1
        : 0;
    const p = Math.max(epsilon, Math.min(1 - epsilon, outcome.predictedProbability));
    totalLoss +=
      actualValue * Math.log(p) + (1 - actualValue) * Math.log(1 - p);
  }

  return -totalLoss / knownOutcomes.length;
}

/**
 * Calculate confidence interval for a proportion
 */
function calculateConfidenceInterval(
  proportion: number,
  sampleSize: number,
  zScore: number = 1.96 // 95% confidence
): { lower: number; upper: number } {
  if (sampleSize === 0) {
    return { lower: 0, upper: 1 };
  }

  const standardError = Math.sqrt(
    (proportion * (1 - proportion)) / sampleSize
  );
  const margin = zScore * standardError;

  return {
    lower: Math.max(0, proportion - margin),
    upper: Math.min(1, proportion + margin),
  };
}

/**
 * Calculate calibration quality from Brier score
 */
function getCalibrationQuality(
  brierScore: number,
  sampleCount: number,
  minSamples: number
): CalibrationQuality {
  if (sampleCount < minSamples) {
    return CalibrationQuality.INSUFFICIENT_DATA;
  }
  if (brierScore < 0.1) return CalibrationQuality.EXCELLENT;
  if (brierScore < 0.2) return CalibrationQuality.GOOD;
  if (brierScore < 0.3) return CalibrationQuality.FAIR;
  return CalibrationQuality.POOR;
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Historical Score Calibrator
 *
 * Tracks score-to-outcome relationships and provides calibration adjustments.
 */
export class HistoricalScoreCalibrator extends EventEmitter {
  private config: HistoricalScoreCalibratorConfig;
  private outcomes: Map<string, OutcomeRecord> = new Map();
  private walletOutcomes: Map<string, Set<string>> = new Map();
  private lastCalibration: CalibrationResult | null = null;
  private brierScoreHistory: Array<{ timestamp: Date; brierScore: number }> = [];
  private adjustmentCurve: Map<ScoreBucket, number> = new Map();

  constructor(config: Partial<HistoricalScoreCalibratorConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CALIBRATOR_CONFIG,
      ...config,
    };

    // Initialize adjustment curve with identity mapping
    for (const bucket of ALL_BUCKETS) {
      const range = BUCKET_RANGES[bucket];
      this.adjustmentCurve.set(bucket, (range.min + range.max) / 2);
    }
  }

  /**
   * Record a score with a known outcome
   */
  recordOutcome(
    walletAddress: string,
    originalScore: number,
    outcome: OutcomeType,
    scoredAt?: Date,
    metadata?: Record<string, unknown>
  ): OutcomeRecord {
    const normalized = normalizeAddress(walletAddress);
    const now = new Date();

    const record: OutcomeRecord = {
      id: generateId(),
      walletAddress: normalized,
      originalScore: Math.max(0, Math.min(100, originalScore)),
      predictedProbability: scoreToProbability(originalScore),
      outcome,
      scoredAt: scoredAt ?? now,
      outcomeDeterminedAt: now,
      metadata,
    };

    // Store outcome
    this.outcomes.set(record.id, record);

    // Track by wallet
    const walletIds = this.walletOutcomes.get(normalized) ?? new Set();
    walletIds.add(record.id);
    this.walletOutcomes.set(normalized, walletIds);

    // Maintain max outcomes limit
    this.maintainOutcomeLimit();

    // Emit event
    if (this.config.enableEvents) {
      this.emit("outcome-recorded", {
        walletAddress: normalized,
        score: record.originalScore,
        outcome,
      });
    }

    return record;
  }

  /**
   * Update outcome for a wallet's most recent record
   */
  updateOutcome(
    walletAddress: string,
    outcome: OutcomeType
  ): OutcomeRecord | null {
    const normalized = normalizeAddress(walletAddress);
    const walletIds = this.walletOutcomes.get(normalized);

    if (!walletIds || walletIds.size === 0) {
      return null;
    }

    // Find most recent record
    let mostRecent: OutcomeRecord | null = null;
    for (const id of walletIds) {
      const record = this.outcomes.get(id);
      if (record && (!mostRecent || record.scoredAt > mostRecent.scoredAt)) {
        mostRecent = record;
      }
    }

    if (mostRecent) {
      mostRecent.outcome = outcome;
      mostRecent.outcomeDeterminedAt = new Date();

      if (this.config.enableEvents) {
        this.emit("outcome-updated", {
          walletAddress: normalized,
          outcome,
        });
      }
    }

    return mostRecent;
  }

  /**
   * Update outcome by record ID
   */
  updateOutcomeById(recordId: string, outcome: OutcomeType): OutcomeRecord | null {
    const record = this.outcomes.get(recordId);
    if (!record) {
      return null;
    }

    record.outcome = outcome;
    record.outcomeDeterminedAt = new Date();

    if (this.config.enableEvents) {
      this.emit("outcome-updated", {
        recordId,
        walletAddress: record.walletAddress,
        outcome,
      });
    }

    return record;
  }

  /**
   * Calculate calibration metrics
   */
  calculateCalibration(): CalibrationResult {
    const allOutcomes = this.getValidOutcomes();
    const knownOutcomes = allOutcomes.filter(
      (o) => o.outcome !== OutcomeType.UNKNOWN
    );

    // Calculate basic metrics
    const brierScore = calculateBrierScore(knownOutcomes);
    const logLoss = calculateLogLoss(knownOutcomes);

    // Track Brier score history
    this.brierScoreHistory.push({
      timestamp: new Date(),
      brierScore,
    });

    // Keep only last 100 history entries
    if (this.brierScoreHistory.length > 100) {
      this.brierScoreHistory = this.brierScoreHistory.slice(-100);
    }

    // Calculate confusion matrix values
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const outcome of knownOutcomes) {
      const predicted = outcome.originalScore >= this.config.currentThreshold;
      const actual =
        outcome.outcome === OutcomeType.TRUE_POSITIVE ||
        outcome.outcome === OutcomeType.FALSE_NEGATIVE;

      if (predicted && actual) tp++;
      else if (predicted && !actual) fp++;
      else if (!predicted && !actual) tn++;
      else fn++;
    }

    // Calculate metrics
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const truePositiveRate = recall;
    const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;

    // Calculate AUC-ROC (simplified approximation)
    const aucRoc = this.calculateApproximateAucRoc(knownOutcomes);

    // Build reliability curve
    const reliabilityCurve = this.buildReliabilityCurve(knownOutcomes);

    // Calculate expected calibration error
    let ece = 0;
    let maxCe = 0;
    for (const bucket of reliabilityCurve) {
      if (bucket.sampleCount > 0) {
        ece += (bucket.sampleCount / knownOutcomes.length) * bucket.calibrationError;
        maxCe = Math.max(maxCe, bucket.calibrationError);
      }
    }

    // Determine quality
    const quality = getCalibrationQuality(
      brierScore,
      knownOutcomes.length,
      this.config.minSamplesForCalibration
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      brierScore,
      precision,
      recall,
      falsePositiveRate,
      reliabilityCurve,
      knownOutcomes.length
    );

    // Calculate optimal threshold
    const optimizedThreshold = this.calculateOptimalThreshold(knownOutcomes);

    // Build score adjustment curve
    const scoreAdjustmentCurve = this.buildScoreAdjustmentCurve(reliabilityCurve);

    const result: CalibrationResult = {
      metrics: {
        brierScore,
        logLoss,
        aucRoc,
        precision,
        recall,
        f1Score,
        truePositiveRate,
        falsePositiveRate,
        expectedCalibrationError: ece,
        maxCalibrationError: maxCe,
        quality,
        reliabilityCurve,
        totalSamples: allOutcomes.length,
        knownOutcomeSamples: knownOutcomes.length,
      },
      recommendations,
      optimizedThreshold,
      scoreAdjustmentCurve,
      isCalibrated: knownOutcomes.length >= this.config.minSamplesForCalibration,
      calibratedAt: new Date(),
    };

    this.lastCalibration = result;

    // Update internal adjustment curve
    for (const [bucket, adjustment] of scoreAdjustmentCurve) {
      this.adjustmentCurve.set(bucket, adjustment);
    }

    // Emit event
    if (this.config.enableEvents) {
      this.emit("calibration-completed", {
        quality,
        brierScore,
        sampleCount: knownOutcomes.length,
      });

      if (quality === CalibrationQuality.POOR && this.config.enableAutoAdjustment) {
        this.emit("recalibration-recommended", {
          reason: "Poor calibration quality detected",
          recommendations,
        });
      }
    }

    return result;
  }

  /**
   * Apply calibration to adjust a score
   */
  calibrateScore(originalScore: number): number {
    if (!this.lastCalibration?.isCalibrated) {
      return originalScore;
    }

    const bucket = getBucketForScore(originalScore);
    const adjustment = this.adjustmentCurve.get(bucket);

    if (adjustment === undefined) {
      return originalScore;
    }

    // Interpolate within the bucket for smoother adjustment
    const range = BUCKET_RANGES[bucket];
    const bucketPosition = (originalScore - range.min) / (range.max - range.min);

    // Find adjacent bucket adjustments for interpolation
    const bucketIndex = ALL_BUCKETS.indexOf(bucket);
    const prevBucket = bucketIndex > 0 ? ALL_BUCKETS[bucketIndex - 1] : null;
    const nextBucket = bucketIndex < ALL_BUCKETS.length - 1 ? ALL_BUCKETS[bucketIndex + 1] : null;

    const prevAdjustment = prevBucket ? this.adjustmentCurve.get(prevBucket) ?? adjustment : adjustment;
    const nextAdjustment = nextBucket ? this.adjustmentCurve.get(nextBucket) ?? adjustment : adjustment;

    // Linear interpolation
    let calibrated: number;
    if (bucketPosition < 0.5) {
      calibrated = prevAdjustment + (adjustment - prevAdjustment) * (0.5 + bucketPosition);
    } else {
      calibrated = adjustment + (nextAdjustment - adjustment) * (bucketPosition - 0.5);
    }

    return Math.max(0, Math.min(100, Math.round(calibrated)));
  }

  /**
   * Get outcomes for a wallet
   */
  getWalletOutcomes(walletAddress: string): OutcomeRecord[] {
    const normalized = normalizeAddress(walletAddress);
    const walletIds = this.walletOutcomes.get(normalized);

    if (!walletIds) {
      return [];
    }

    const outcomes: OutcomeRecord[] = [];
    for (const id of walletIds) {
      const record = this.outcomes.get(id);
      if (record) {
        outcomes.push(record);
      }
    }

    return outcomes.sort((a, b) => b.scoredAt.getTime() - a.scoredAt.getTime());
  }

  /**
   * Get all outcomes
   */
  getAllOutcomes(): OutcomeRecord[] {
    return Array.from(this.outcomes.values());
  }

  /**
   * Get last calibration result
   */
  getLastCalibration(): CalibrationResult | null {
    return this.lastCalibration;
  }

  /**
   * Get summary statistics
   */
  getSummary(): CalibrationSummary {
    const allOutcomes = this.getAllOutcomes();
    const outcomesByType: Record<OutcomeType, number> = {
      [OutcomeType.TRUE_POSITIVE]: 0,
      [OutcomeType.FALSE_POSITIVE]: 0,
      [OutcomeType.TRUE_NEGATIVE]: 0,
      [OutcomeType.FALSE_NEGATIVE]: 0,
      [OutcomeType.UNKNOWN]: 0,
    };

    for (const outcome of allOutcomes) {
      outcomesByType[outcome.outcome]++;
    }

    const currentBrierScore = this.lastCalibration?.metrics.brierScore ?? 1;
    const currentQuality =
      this.lastCalibration?.metrics.quality ?? CalibrationQuality.INSUFFICIENT_DATA;

    const lastCalibrationAt = this.lastCalibration?.calibratedAt ?? null;
    const hoursSinceLastCalibration = lastCalibrationAt
      ? (Date.now() - lastCalibrationAt.getTime()) / (1000 * 60 * 60)
      : null;

    return {
      totalOutcomes: allOutcomes.length,
      outcomesByType,
      currentQuality,
      currentBrierScore,
      brierScoreHistory: this.brierScoreHistory.slice(-10),
      activeRecommendations: this.lastCalibration?.recommendations.length ?? 0,
      lastCalibrationAt,
      hoursSinceLastCalibration,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HistoricalScoreCalibratorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (this.config.enableEvents) {
      this.emit("config-updated", this.config);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HistoricalScoreCalibratorConfig {
    return { ...this.config };
  }

  /**
   * Clear all outcomes
   */
  clearOutcomes(): void {
    this.outcomes.clear();
    this.walletOutcomes.clear();
    this.lastCalibration = null;
    this.brierScoreHistory = [];

    // Reset adjustment curve to identity
    for (const bucket of ALL_BUCKETS) {
      const range = BUCKET_RANGES[bucket];
      this.adjustmentCurve.set(bucket, (range.min + range.max) / 2);
    }

    if (this.config.enableEvents) {
      this.emit("outcomes-cleared");
    }
  }

  /**
   * Export calibration data for persistence
   */
  exportData(): {
    outcomes: OutcomeRecord[];
    brierScoreHistory: Array<{ timestamp: Date; brierScore: number }>;
    adjustmentCurve: Array<{ bucket: ScoreBucket; value: number }>;
  } {
    return {
      outcomes: Array.from(this.outcomes.values()),
      brierScoreHistory: this.brierScoreHistory,
      adjustmentCurve: Array.from(this.adjustmentCurve.entries()).map(
        ([bucket, value]) => ({ bucket, value })
      ),
    };
  }

  /**
   * Import calibration data
   */
  importData(data: {
    outcomes: OutcomeRecord[];
    brierScoreHistory?: Array<{ timestamp: Date; brierScore: number }>;
    adjustmentCurve?: Array<{ bucket: ScoreBucket; value: number }>;
  }): void {
    this.outcomes.clear();
    this.walletOutcomes.clear();

    for (const outcome of data.outcomes) {
      this.outcomes.set(outcome.id, outcome);
      const walletIds = this.walletOutcomes.get(outcome.walletAddress) ?? new Set();
      walletIds.add(outcome.id);
      this.walletOutcomes.set(outcome.walletAddress, walletIds);
    }

    if (data.brierScoreHistory) {
      this.brierScoreHistory = data.brierScoreHistory;
    }

    if (data.adjustmentCurve) {
      for (const { bucket, value } of data.adjustmentCurve) {
        this.adjustmentCurve.set(bucket, value);
      }
    }

    if (this.config.enableEvents) {
      this.emit("data-imported", {
        outcomeCount: data.outcomes.length,
      });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get valid outcomes (within max age)
   */
  private getValidOutcomes(): OutcomeRecord[] {
    const cutoff = Date.now() - this.config.maxOutcomeAgeHours * 60 * 60 * 1000;
    return Array.from(this.outcomes.values()).filter(
      (o) => o.scoredAt.getTime() >= cutoff
    );
  }

  /**
   * Maintain outcome storage limit
   */
  private maintainOutcomeLimit(): void {
    if (this.outcomes.size > this.config.maxOutcomesToStore) {
      const sorted = Array.from(this.outcomes.entries()).sort(
        (a, b) => a[1].scoredAt.getTime() - b[1].scoredAt.getTime()
      );

      const toRemove = sorted.slice(0, this.outcomes.size - this.config.maxOutcomesToStore);
      for (const [id, record] of toRemove) {
        this.outcomes.delete(id);
        const walletIds = this.walletOutcomes.get(record.walletAddress);
        if (walletIds) {
          walletIds.delete(id);
          if (walletIds.size === 0) {
            this.walletOutcomes.delete(record.walletAddress);
          }
        }
      }
    }
  }

  /**
   * Build reliability curve
   */
  private buildReliabilityCurve(outcomes: OutcomeRecord[]): BucketStats[] {
    const bucketOutcomes = new Map<ScoreBucket, OutcomeRecord[]>();

    // Initialize all buckets
    for (const bucket of ALL_BUCKETS) {
      bucketOutcomes.set(bucket, []);
    }

    // Sort outcomes into buckets
    for (const outcome of outcomes) {
      const bucket = getBucketForScore(outcome.originalScore);
      bucketOutcomes.get(bucket)!.push(outcome);
    }

    // Calculate stats for each bucket
    const reliabilityCurve: BucketStats[] = [];

    for (const bucket of ALL_BUCKETS) {
      const bucketData = bucketOutcomes.get(bucket)!;
      const range = BUCKET_RANGES[bucket];

      if (bucketData.length === 0) {
        reliabilityCurve.push({
          bucket,
          minScore: range.min,
          maxScore: range.max,
          avgPredictedProbability: (range.min + range.max) / 200,
          actualPositiveRate: 0,
          sampleCount: 0,
          calibrationError: 0,
          confidenceInterval: { lower: 0, upper: 1 },
        });
        continue;
      }

      const avgPredicted =
        bucketData.reduce((sum, o) => sum + o.predictedProbability, 0) /
        bucketData.length;

      const positives = bucketData.filter(
        (o) =>
          o.outcome === OutcomeType.TRUE_POSITIVE ||
          o.outcome === OutcomeType.FALSE_NEGATIVE
      ).length;

      const actualPositiveRate = positives / bucketData.length;
      const calibrationError = Math.abs(avgPredicted - actualPositiveRate);
      const ci = calculateConfidenceInterval(actualPositiveRate, bucketData.length);

      reliabilityCurve.push({
        bucket,
        minScore: range.min,
        maxScore: range.max,
        avgPredictedProbability: avgPredicted,
        actualPositiveRate,
        sampleCount: bucketData.length,
        calibrationError,
        confidenceInterval: ci,
      });
    }

    return reliabilityCurve;
  }

  /**
   * Calculate approximate AUC-ROC
   */
  private calculateApproximateAucRoc(outcomes: OutcomeRecord[]): number {
    if (outcomes.length < 2) return 0.5;

    const positives = outcomes.filter(
      (o) =>
        o.outcome === OutcomeType.TRUE_POSITIVE ||
        o.outcome === OutcomeType.FALSE_NEGATIVE
    );
    const negatives = outcomes.filter(
      (o) =>
        o.outcome === OutcomeType.FALSE_POSITIVE ||
        o.outcome === OutcomeType.TRUE_NEGATIVE
    );

    if (positives.length === 0 || negatives.length === 0) return 0.5;

    // Calculate AUC using the Wilcoxon-Mann-Whitney statistic
    let concordantPairs = 0;
    let totalPairs = 0;

    for (const pos of positives) {
      for (const neg of negatives) {
        totalPairs++;
        if (pos.predictedProbability > neg.predictedProbability) {
          concordantPairs++;
        } else if (pos.predictedProbability === neg.predictedProbability) {
          concordantPairs += 0.5;
        }
      }
    }

    return totalPairs > 0 ? concordantPairs / totalPairs : 0.5;
  }

  /**
   * Calculate optimal threshold
   */
  private calculateOptimalThreshold(outcomes: OutcomeRecord[]): number {
    if (outcomes.length < this.config.minSamplesForCalibration) {
      return this.config.currentThreshold;
    }

    // Find threshold that maximizes F1 score
    let bestThreshold = this.config.currentThreshold;
    let bestF1 = 0;

    for (let threshold = 10; threshold <= 90; threshold += 5) {
      let tp = 0, fp = 0, fn = 0;

      for (const outcome of outcomes) {
        const predicted = outcome.originalScore >= threshold;
        const actual =
          outcome.outcome === OutcomeType.TRUE_POSITIVE ||
          outcome.outcome === OutcomeType.FALSE_NEGATIVE;

        if (predicted && actual) tp++;
        else if (predicted && !actual) fp++;
        else if (!predicted && actual) fn++;
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 =
        precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      if (f1 > bestF1) {
        bestF1 = f1;
        bestThreshold = threshold;
      }
    }

    return bestThreshold;
  }

  /**
   * Build score adjustment curve
   */
  private buildScoreAdjustmentCurve(
    reliabilityCurve: BucketStats[]
  ): Map<ScoreBucket, number> {
    const adjustmentCurve = new Map<ScoreBucket, number>();

    for (const bucket of reliabilityCurve) {
      if (bucket.sampleCount < this.config.minSamplesPerBucket) {
        // Not enough data, use midpoint
        adjustmentCurve.set(bucket.bucket, (bucket.minScore + bucket.maxScore) / 2);
      } else {
        // Adjust based on actual positive rate
        const calibratedScore = probabilityToScore(bucket.actualPositiveRate);
        adjustmentCurve.set(bucket.bucket, calibratedScore);
      }
    }

    return adjustmentCurve;
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    brierScore: number,
    precision: number,
    recall: number,
    falsePositiveRate: number,
    reliabilityCurve: BucketStats[],
    sampleCount: number
  ): AdjustmentRecommendation[] {
    const recommendations: AdjustmentRecommendation[] = [];

    if (sampleCount < this.config.minSamplesForCalibration) {
      recommendations.push({
        type: AdjustmentType.NONE,
        description: "Gather more outcome data",
        reason: `Only ${sampleCount} samples available, need ${this.config.minSamplesForCalibration} for reliable calibration`,
        suggestedChanges: [],
        confidence: 100,
        priority: 1,
      });
      return recommendations;
    }

    // High false positive rate
    if (falsePositiveRate > 0.3 && precision < 0.5) {
      recommendations.push({
        type: AdjustmentType.INCREASE_THRESHOLD,
        description: "Reduce false positives by raising threshold",
        reason: `High false positive rate (${(falsePositiveRate * 100).toFixed(1)}%) with low precision (${(precision * 100).toFixed(1)}%)`,
        suggestedChanges: [
          {
            parameter: "threshold",
            currentValue: this.config.currentThreshold,
            suggestedValue: Math.min(80, this.config.currentThreshold + 10),
            expectedImprovement: "Reduce false alerts by ~20%",
          },
        ],
        confidence: 75,
        priority: 2,
      });
    }

    // Low recall (missing true positives)
    if (recall < 0.5) {
      recommendations.push({
        type: AdjustmentType.DECREASE_THRESHOLD,
        description: "Capture more true positives by lowering threshold",
        reason: `Low recall (${(recall * 100).toFixed(1)}%) - missing potential insider activity`,
        suggestedChanges: [
          {
            parameter: "threshold",
            currentValue: this.config.currentThreshold,
            suggestedValue: Math.max(30, this.config.currentThreshold - 10),
            expectedImprovement: "Capture ~20% more true positives",
          },
        ],
        confidence: 70,
        priority: 3,
      });
    }

    // Poor calibration - need bucket recalibration
    if (brierScore > this.config.brierScoreRecalibrationThreshold) {
      const worstBuckets = reliabilityCurve
        .filter((b) => b.sampleCount >= this.config.minSamplesPerBucket)
        .sort((a, b) => b.calibrationError - a.calibrationError)
        .slice(0, 3);

      if (worstBuckets.length > 0) {
        recommendations.push({
          type: AdjustmentType.RECALIBRATE_BUCKETS,
          description: "Recalibrate score buckets for better accuracy",
          reason: `Poor calibration (Brier score: ${brierScore.toFixed(3)}). Worst buckets: ${worstBuckets.map((b) => b.bucket).join(", ")}`,
          suggestedChanges: worstBuckets.map((bucket) => ({
            parameter: `bucket_${bucket.bucket}`,
            currentValue: (bucket.minScore + bucket.maxScore) / 2,
            suggestedValue: probabilityToScore(bucket.actualPositiveRate),
            expectedImprovement: `Reduce bucket calibration error by ${(bucket.calibrationError * 100).toFixed(1)}%`,
          })),
          confidence: 80,
          priority: 1,
        });
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

/**
 * Create a new historical score calibrator
 */
export function createHistoricalScoreCalibrator(
  config?: Partial<HistoricalScoreCalibratorConfig>
): HistoricalScoreCalibrator {
  return new HistoricalScoreCalibrator(config);
}

let sharedInstance: HistoricalScoreCalibrator | null = null;

/**
 * Get the shared historical score calibrator instance
 */
export function getSharedHistoricalScoreCalibrator(): HistoricalScoreCalibrator {
  if (!sharedInstance) {
    sharedInstance = createHistoricalScoreCalibrator();
  }
  return sharedInstance;
}

/**
 * Set a custom shared instance
 */
export function setSharedHistoricalScoreCalibrator(
  instance: HistoricalScoreCalibrator
): void {
  sharedInstance = instance;
}

/**
 * Reset the shared instance
 */
export function resetSharedHistoricalScoreCalibrator(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Record an outcome for a wallet
 */
export function recordHistoricalOutcome(
  walletAddress: string,
  originalScore: number,
  outcome: OutcomeType,
  scoredAt?: Date,
  metadata?: Record<string, unknown>
): OutcomeRecord {
  return getSharedHistoricalScoreCalibrator().recordOutcome(
    walletAddress,
    originalScore,
    outcome,
    scoredAt,
    metadata
  );
}

/**
 * Update outcome for a wallet
 */
export function updateHistoricalOutcome(
  walletAddress: string,
  outcome: OutcomeType
): OutcomeRecord | null {
  return getSharedHistoricalScoreCalibrator().updateOutcome(walletAddress, outcome);
}

/**
 * Calculate calibration
 */
export function calculateHistoricalCalibration(): CalibrationResult {
  return getSharedHistoricalScoreCalibrator().calculateCalibration();
}

/**
 * Calibrate a score based on historical data
 */
export function calibrateHistoricalScore(originalScore: number): number {
  return getSharedHistoricalScoreCalibrator().calibrateScore(originalScore);
}

/**
 * Get calibration summary
 */
export function getHistoricalCalibrationSummary(): CalibrationSummary {
  return getSharedHistoricalScoreCalibrator().getSummary();
}

/**
 * Get outcome type description
 */
export function getOutcomeDescription(outcome: OutcomeType): string {
  return OUTCOME_DESCRIPTIONS[outcome];
}

/**
 * Get calibration quality description
 */
export function getCalibrationQualityDescription(quality: CalibrationQuality): string {
  return CALIBRATION_QUALITY_DESCRIPTIONS[quality];
}

/**
 * Get adjustment type description
 */
export function getAdjustmentDescription(type: AdjustmentType): string {
  return ADJUSTMENT_DESCRIPTIONS[type];
}
