/**
 * Market Outcome Predictor (AI-PRED-002)
 *
 * Predicts market outcomes based on insider signals and trading patterns.
 * Analyzes historical signal data to forecast likely market resolutions.
 *
 * Features:
 * - Collect and analyze signal history for markets
 * - Train outcome prediction models on historical data
 * - Generate probability predictions for market outcomes
 * - Track prediction accuracy over time
 * - Batch prediction support
 * - Result caching for performance
 * - Event emission for prediction lifecycle
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Market outcome prediction (YES/NO for binary markets)
 */
export enum PredictedOutcome {
  /** Predict YES outcome */
  YES = "YES",
  /** Predict NO outcome */
  NO = "NO",
  /** Uncertain - no clear prediction */
  UNCERTAIN = "UNCERTAIN",
}

/**
 * Prediction confidence level
 */
export enum OutcomeConfidenceLevel {
  /** Very low confidence - insufficient signals */
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
 * Signal type that can influence outcome prediction
 */
export enum SignalType {
  /** Large trade from potential insider */
  INSIDER_TRADE = "INSIDER_TRADE",
  /** Volume spike in market */
  VOLUME_SPIKE = "VOLUME_SPIKE",
  /** Fresh wallet activity */
  FRESH_WALLET = "FRESH_WALLET",
  /** Whale trade */
  WHALE_TRADE = "WHALE_TRADE",
  /** Coordinated trading cluster */
  COORDINATED_CLUSTER = "COORDINATED_CLUSTER",
  /** Pre-event timing signal */
  PRE_EVENT_TIMING = "PRE_EVENT_TIMING",
  /** Price movement anomaly */
  PRICE_ANOMALY = "PRICE_ANOMALY",
  /** Order book imbalance */
  ORDER_BOOK_IMBALANCE = "ORDER_BOOK_IMBALANCE",
  /** Unusual market selection pattern */
  MARKET_SELECTION = "MARKET_SELECTION",
  /** High win rate trader activity */
  HIGH_WIN_RATE = "HIGH_WIN_RATE",
}

/**
 * Signal direction (which outcome the signal suggests)
 */
export enum SignalDirection {
  /** Signal suggests YES outcome */
  BULLISH = "BULLISH",
  /** Signal suggests NO outcome */
  BEARISH = "BEARISH",
  /** Signal is neutral */
  NEUTRAL = "NEUTRAL",
}

/**
 * Market prediction status
 */
export enum MarketPredictionStatus {
  /** Market still open, prediction pending */
  PENDING = "PENDING",
  /** Market resolved, prediction verified */
  VERIFIED = "VERIFIED",
  /** Market cancelled or voided */
  CANCELLED = "CANCELLED",
  /** Prediction expired (market not resolved in time) */
  EXPIRED = "EXPIRED",
}

/**
 * Model training status
 */
export enum TrainingStatus {
  /** Not trained */
  NOT_TRAINED = "NOT_TRAINED",
  /** Currently training */
  TRAINING = "TRAINING",
  /** Training complete */
  TRAINED = "TRAINED",
  /** Training failed */
  FAILED = "FAILED",
}

/**
 * Individual market signal record
 */
export interface MarketSignal {
  /** Unique signal ID */
  signalId: string;
  /** Market ID this signal is for */
  marketId: string;
  /** Type of signal */
  type: SignalType;
  /** Signal direction */
  direction: SignalDirection;
  /** Signal strength (0-1) */
  strength: number;
  /** Confidence in the signal (0-1) */
  confidence: number;
  /** Associated wallet address if applicable */
  walletAddress?: string;
  /** Trade size in USD if applicable */
  tradeSizeUsd?: number;
  /** Insider probability if applicable */
  insiderProbability?: number;
  /** Anomaly score if applicable */
  anomalyScore?: number;
  /** Signal timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated signal statistics for a market
 */
export interface SignalAggregation {
  /** Market ID */
  marketId: string;
  /** Total signals collected */
  totalSignals: number;
  /** Bullish signal count */
  bullishSignals: number;
  /** Bearish signal count */
  bearishSignals: number;
  /** Neutral signal count */
  neutralSignals: number;
  /** Average signal strength */
  avgStrength: number;
  /** Maximum signal strength */
  maxStrength: number;
  /** Average confidence */
  avgConfidence: number;
  /** Signal type breakdown */
  signalTypeBreakdown: Record<SignalType, number>;
  /** Time-weighted signal score (recent signals weighted more) */
  timeWeightedScore: number;
  /** Total trade volume associated with signals (USD) */
  signalVolumeUsd: number;
  /** Average insider probability of signals */
  avgInsiderProbability: number;
  /** First signal timestamp */
  firstSignalAt: Date;
  /** Last signal timestamp */
  lastSignalAt: Date;
}

/**
 * Historical market outcome record for training
 */
export interface HistoricalMarketOutcome {
  /** Market ID */
  marketId: string;
  /** Actual outcome */
  outcome: "YES" | "NO";
  /** Resolution timestamp */
  resolvedAt: Date;
  /** Pre-resolution signal aggregation */
  signalAggregation: SignalAggregation;
  /** Final probability before resolution */
  finalProbability: number;
  /** Market category */
  category?: string;
  /** Market volume at resolution */
  volumeUsd?: number;
}

/**
 * Feature vector for outcome prediction
 */
export interface OutcomeFeatureVector {
  /** Bullish signal ratio */
  bullishRatio: number;
  /** Average signal strength */
  avgStrength: number;
  /** Max signal strength */
  maxStrength: number;
  /** Average confidence */
  avgConfidence: number;
  /** Time-weighted score */
  timeWeightedScore: number;
  /** Signal volume normalized */
  signalVolumeNormalized: number;
  /** Average insider probability */
  avgInsiderProbability: number;
  /** Insider trade ratio */
  insiderTradeRatio: number;
  /** Volume spike ratio */
  volumeSpikeRatio: number;
  /** Whale trade ratio */
  whaleTradeRatio: number;
  /** Coordinated cluster ratio */
  coordinatedClusterRatio: number;
  /** Pre-event timing ratio */
  preEventTimingRatio: number;
  /** Current market probability */
  currentProbability: number;
  /** Hours until resolution */
  hoursUntilResolution: number;
  /** Signal recency score (how recent are most signals) */
  signalRecencyScore: number;
  /** Signal intensity (signals per hour) */
  signalIntensity: number;
}

/**
 * Model weights for outcome prediction
 */
export interface OutcomeModelWeights {
  /** Feature weights */
  featureWeights: Record<keyof OutcomeFeatureVector, number>;
  /** Bias term */
  bias: number;
  /** YES outcome prior */
  yesPrior: number;
  /** Calibration temperature */
  temperature: number;
}

/**
 * Outcome prediction result
 */
export interface OutcomePredictionResult {
  /** Unique prediction ID */
  predictionId: string;
  /** Market ID */
  marketId: string;
  /** Predicted outcome */
  predictedOutcome: PredictedOutcome;
  /** Probability of YES outcome (0-1) */
  yesProbability: number;
  /** Probability of NO outcome (0-1) */
  noProbability: number;
  /** Confidence level */
  confidence: OutcomeConfidenceLevel;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Feature vector used */
  features: OutcomeFeatureVector;
  /** Contributing signals */
  contributingSignals: MarketSignal[];
  /** Signal aggregation */
  signalAggregation: SignalAggregation;
  /** Key factors driving prediction */
  keyFactors: PredictionFactor[];
  /** Prediction explanation */
  explanation: string;
  /** Prediction status */
  status: MarketPredictionStatus;
  /** Prediction timestamp */
  predictedAt: Date;
  /** Verification timestamp if verified */
  verifiedAt?: Date;
  /** Actual outcome if resolved */
  actualOutcome?: "YES" | "NO" | null;
  /** Was prediction correct */
  wasCorrect?: boolean;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Factor contributing to prediction
 */
export interface PredictionFactor {
  /** Factor name */
  name: string;
  /** Factor value */
  value: number;
  /** Weight applied */
  weight: number;
  /** Contribution to prediction */
  contribution: number;
  /** Direction suggested */
  direction: SignalDirection;
  /** Human-readable description */
  description: string;
}

/**
 * Batch prediction result
 */
export interface BatchOutcomePredictionResult {
  /** Total markets predicted */
  totalPredicted: number;
  /** Markets predicted YES */
  predictedYes: number;
  /** Markets predicted NO */
  predictedNo: number;
  /** Markets uncertain */
  predictedUncertain: number;
  /** Individual results */
  results: OutcomePredictionResult[];
  /** Average YES probability */
  avgYesProbability: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Model accuracy metrics
 */
export interface OutcomeModelMetrics {
  /** Total predictions made */
  totalPredictions: number;
  /** Verified predictions */
  verifiedPredictions: number;
  /** Correct predictions */
  correctPredictions: number;
  /** Overall accuracy */
  accuracy: number;
  /** True positives (predicted YES, was YES) */
  truePositives: number;
  /** True negatives (predicted NO, was NO) */
  trueNegatives: number;
  /** False positives (predicted YES, was NO) */
  falsePositives: number;
  /** False negatives (predicted NO, was YES) */
  falseNegatives: number;
  /** Precision for YES predictions */
  precision: number;
  /** Recall for YES predictions */
  recall: number;
  /** F1 score */
  f1Score: number;
  /** Brier score (calibration) */
  brierScore: number;
  /** Log loss */
  logLoss: number;
  /** ROC AUC */
  aucRoc: number;
  /** Accuracy by confidence level */
  accuracyByConfidence: Record<OutcomeConfidenceLevel, number>;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Training data sample
 */
export interface TrainingSample {
  /** Feature vector */
  features: OutcomeFeatureVector;
  /** Actual outcome (1 for YES, 0 for NO) */
  label: number;
  /** Market ID */
  marketId: string;
}

/**
 * Predictor configuration
 */
export interface MarketOutcomePredictorConfig {
  /** Minimum signals required for prediction */
  minSignalsForPrediction: number;
  /** Minimum confidence threshold for valid prediction */
  minConfidenceThreshold: number;
  /** Probability threshold for YES prediction */
  yesProbabilityThreshold: number;
  /** Probability threshold for NO prediction */
  noProbabilityThreshold: number;
  /** Signal decay half-life in hours */
  signalDecayHalfLifeHours: number;
  /** Maximum signal age in hours */
  maxSignalAgeHours: number;
  /** Enable caching */
  cacheEnabled: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
  /** Cache max size */
  cacheMaxSize: number;
  /** Learning rate for model updates */
  learningRate: number;
  /** Regularization strength */
  regularization: number;
}

/**
 * Predictor events
 */
export interface MarketOutcomePredictorEvents {
  /** Signal recorded */
  signal_recorded: MarketSignal;
  /** Prediction made */
  prediction_made: OutcomePredictionResult;
  /** High confidence prediction */
  high_confidence_prediction: OutcomePredictionResult;
  /** Batch prediction completed */
  batch_completed: BatchOutcomePredictionResult;
  /** Prediction verified */
  prediction_verified: {
    predictionId: string;
    predicted: PredictedOutcome;
    actual: "YES" | "NO";
    correct: boolean;
  };
  /** Model trained */
  model_trained: {
    samplesUsed: number;
    trainingAccuracy: number;
  };
  /** Metrics updated */
  metrics_updated: OutcomeModelMetrics;
  /** Cache hit */
  cache_hit: { marketId: string };
  /** Cache miss */
  cache_miss: { marketId: string };
  /** Error */
  error: { message: string; marketId?: string };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default model weights (initialized to reasonable starting values)
 */
export const DEFAULT_MODEL_WEIGHTS: OutcomeModelWeights = {
  featureWeights: {
    bullishRatio: 0.15,
    avgStrength: 0.10,
    maxStrength: 0.08,
    avgConfidence: 0.08,
    timeWeightedScore: 0.12,
    signalVolumeNormalized: 0.06,
    avgInsiderProbability: 0.12,
    insiderTradeRatio: 0.08,
    volumeSpikeRatio: 0.05,
    whaleTradeRatio: 0.04,
    coordinatedClusterRatio: 0.06,
    preEventTimingRatio: 0.06,
    currentProbability: 0.00, // Market probability not used as signal
    hoursUntilResolution: 0.00, // Time-based, not predictive
    signalRecencyScore: 0.00, // Already captured in timeWeightedScore
    signalIntensity: 0.00, // Not directly predictive
  },
  bias: 0.0,
  yesPrior: 0.5,
  temperature: 1.0,
};

/**
 * Default configuration
 */
export const DEFAULT_OUTCOME_PREDICTOR_CONFIG: MarketOutcomePredictorConfig = {
  minSignalsForPrediction: 3,
  minConfidenceThreshold: 0.3,
  yesProbabilityThreshold: 0.55,
  noProbabilityThreshold: 0.45,
  signalDecayHalfLifeHours: 24,
  maxSignalAgeHours: 168, // 7 days
  cacheEnabled: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  cacheMaxSize: 2000,
  learningRate: 0.01,
  regularization: 0.001,
};

/**
 * Confidence thresholds
 */
export const OUTCOME_CONFIDENCE_THRESHOLDS = {
  veryLow: 0.2,
  low: 0.4,
  medium: 0.6,
  high: 0.75,
  veryHigh: 0.9,
};

/**
 * Signal type weights (how much each signal type contributes)
 */
export const SIGNAL_TYPE_WEIGHTS: Record<SignalType, number> = {
  [SignalType.INSIDER_TRADE]: 1.0,
  [SignalType.VOLUME_SPIKE]: 0.6,
  [SignalType.FRESH_WALLET]: 0.7,
  [SignalType.WHALE_TRADE]: 0.8,
  [SignalType.COORDINATED_CLUSTER]: 0.9,
  [SignalType.PRE_EVENT_TIMING]: 0.85,
  [SignalType.PRICE_ANOMALY]: 0.5,
  [SignalType.ORDER_BOOK_IMBALANCE]: 0.4,
  [SignalType.MARKET_SELECTION]: 0.3,
  [SignalType.HIGH_WIN_RATE]: 0.75,
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: OutcomePredictionResult;
  expiresAt: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Market Outcome Predictor
 *
 * Predicts market outcomes based on collected insider signals and
 * trading patterns. Maintains a trained model that improves with
 * verified outcomes.
 */
export class MarketOutcomePredictor extends EventEmitter {
  private config: MarketOutcomePredictorConfig;
  private modelWeights: OutcomeModelWeights;
  private trainingStatus: TrainingStatus;
  private signalHistory: Map<string, MarketSignal[]>;
  private predictions: Map<string, OutcomePredictionResult>;
  private historicalOutcomes: HistoricalMarketOutcome[];
  private predictionCache: Map<string, CacheEntry>;
  private metrics: OutcomeModelMetrics;
  private predictionCount: number;
  private cacheHits: number;
  private cacheMisses: number;

  constructor(config: Partial<MarketOutcomePredictorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_OUTCOME_PREDICTOR_CONFIG, ...config };
    this.modelWeights = { ...DEFAULT_MODEL_WEIGHTS };
    this.trainingStatus = TrainingStatus.NOT_TRAINED;
    this.signalHistory = new Map();
    this.predictions = new Map();
    this.historicalOutcomes = [];
    this.predictionCache = new Map();
    this.metrics = this.initializeMetrics();
    this.predictionCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Initialize empty metrics
   */
  private initializeMetrics(): OutcomeModelMetrics {
    return {
      totalPredictions: 0,
      verifiedPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      brierScore: 0.25,
      logLoss: 0.693, // -log(0.5)
      aucRoc: 0.5,
      accuracyByConfidence: {
        [OutcomeConfidenceLevel.VERY_LOW]: 0,
        [OutcomeConfidenceLevel.LOW]: 0,
        [OutcomeConfidenceLevel.MEDIUM]: 0,
        [OutcomeConfidenceLevel.HIGH]: 0,
        [OutcomeConfidenceLevel.VERY_HIGH]: 0,
      },
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): MarketOutcomePredictorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MarketOutcomePredictorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get model weights
   */
  getModelWeights(): OutcomeModelWeights {
    return { ...this.modelWeights };
  }

  /**
   * Set model weights
   */
  setModelWeights(weights: Partial<OutcomeModelWeights>): void {
    this.modelWeights = { ...this.modelWeights, ...weights };
  }

  /**
   * Get training status
   */
  getTrainingStatus(): TrainingStatus {
    return this.trainingStatus;
  }

  // ============================================================================
  // Signal Collection
  // ============================================================================

  /**
   * Record a new signal for a market
   */
  recordSignal(signal: Omit<MarketSignal, "signalId">): MarketSignal {
    const fullSignal: MarketSignal = {
      ...signal,
      signalId: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Get or create signal array for this market
    const marketSignals = this.signalHistory.get(fullSignal.marketId) || [];
    marketSignals.push(fullSignal);
    this.signalHistory.set(fullSignal.marketId, marketSignals);

    // Invalidate cache for this market
    this.predictionCache.delete(fullSignal.marketId);

    this.emit("signal_recorded", fullSignal);
    return fullSignal;
  }

  /**
   * Record multiple signals
   */
  recordSignals(signals: Array<Omit<MarketSignal, "signalId">>): MarketSignal[] {
    return signals.map((s) => this.recordSignal(s));
  }

  /**
   * Get all signals for a market
   */
  getMarketSignals(marketId: string): MarketSignal[] {
    return this.signalHistory.get(marketId) || [];
  }

  /**
   * Get recent signals for a market (within max age)
   */
  getRecentSignals(marketId: string): MarketSignal[] {
    const signals = this.signalHistory.get(marketId) || [];
    const cutoffTime = Date.now() - this.config.maxSignalAgeHours * 60 * 60 * 1000;

    return signals.filter((s) => s.timestamp.getTime() >= cutoffTime);
  }

  /**
   * Clear old signals
   */
  clearOldSignals(): number {
    let clearedCount = 0;
    const cutoffTime = Date.now() - this.config.maxSignalAgeHours * 60 * 60 * 1000;

    for (const [marketId, signals] of this.signalHistory) {
      const recentSignals = signals.filter(
        (s) => s.timestamp.getTime() >= cutoffTime
      );
      const removed = signals.length - recentSignals.length;
      clearedCount += removed;

      if (recentSignals.length === 0) {
        this.signalHistory.delete(marketId);
      } else {
        this.signalHistory.set(marketId, recentSignals);
      }
    }

    return clearedCount;
  }

  // ============================================================================
  // Signal Aggregation
  // ============================================================================

  /**
   * Aggregate signals for a market
   */
  aggregateSignals(marketId: string): SignalAggregation | null {
    const signals = this.getRecentSignals(marketId);
    if (signals.length === 0) {
      return null;
    }

    // Count by direction
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    let totalStrength = 0;
    let maxStrength = 0;
    let totalConfidence = 0;
    let totalVolume = 0;
    let totalInsiderProb = 0;
    let insiderProbCount = 0;

    const signalTypeBreakdown: Record<SignalType, number> = {} as Record<
      SignalType,
      number
    >;
    for (const type of Object.values(SignalType)) {
      signalTypeBreakdown[type] = 0;
    }

    const now = Date.now();
    let timeWeightedScore = 0;
    let totalTimeWeight = 0;

    let firstSignalAt = signals[0]!.timestamp;
    let lastSignalAt = signals[0]!.timestamp;

    for (const signal of signals) {
      // Direction counts
      if (signal.direction === SignalDirection.BULLISH) {
        bullishCount++;
      } else if (signal.direction === SignalDirection.BEARISH) {
        bearishCount++;
      } else {
        neutralCount++;
      }

      // Strength and confidence
      totalStrength += signal.strength;
      maxStrength = Math.max(maxStrength, signal.strength);
      totalConfidence += signal.confidence;

      // Volume
      if (signal.tradeSizeUsd) {
        totalVolume += signal.tradeSizeUsd;
      }

      // Insider probability
      if (signal.insiderProbability !== undefined) {
        totalInsiderProb += signal.insiderProbability;
        insiderProbCount++;
      }

      // Type breakdown
      signalTypeBreakdown[signal.type]++;

      // Time-weighted score (exponential decay)
      const ageHours =
        (now - signal.timestamp.getTime()) / (60 * 60 * 1000);
      const timeWeight = Math.pow(
        0.5,
        ageHours / this.config.signalDecayHalfLifeHours
      );
      const directionMultiplier =
        signal.direction === SignalDirection.BULLISH
          ? 1
          : signal.direction === SignalDirection.BEARISH
            ? -1
            : 0;
      timeWeightedScore +=
        directionMultiplier *
        signal.strength *
        signal.confidence *
        timeWeight *
        SIGNAL_TYPE_WEIGHTS[signal.type];
      totalTimeWeight += timeWeight;

      // Timestamps
      if (signal.timestamp < firstSignalAt) {
        firstSignalAt = signal.timestamp;
      }
      if (signal.timestamp > lastSignalAt) {
        lastSignalAt = signal.timestamp;
      }
    }

    return {
      marketId,
      totalSignals: signals.length,
      bullishSignals: bullishCount,
      bearishSignals: bearishCount,
      neutralSignals: neutralCount,
      avgStrength: totalStrength / signals.length,
      maxStrength,
      avgConfidence: totalConfidence / signals.length,
      signalTypeBreakdown,
      timeWeightedScore:
        totalTimeWeight > 0 ? timeWeightedScore / totalTimeWeight : 0,
      signalVolumeUsd: totalVolume,
      avgInsiderProbability:
        insiderProbCount > 0 ? totalInsiderProb / insiderProbCount : 0,
      firstSignalAt,
      lastSignalAt,
    };
  }

  // ============================================================================
  // Feature Extraction
  // ============================================================================

  /**
   * Extract feature vector from signal aggregation
   */
  extractFeatures(
    aggregation: SignalAggregation,
    currentProbability: number = 0.5,
    hoursUntilResolution: number = 24
  ): OutcomeFeatureVector {
    const total = aggregation.totalSignals;

    // Signal type ratios
    const insiderTradeRatio =
      total > 0
        ? aggregation.signalTypeBreakdown[SignalType.INSIDER_TRADE] / total
        : 0;
    const volumeSpikeRatio =
      total > 0
        ? aggregation.signalTypeBreakdown[SignalType.VOLUME_SPIKE] / total
        : 0;
    const whaleTradeRatio =
      total > 0
        ? aggregation.signalTypeBreakdown[SignalType.WHALE_TRADE] / total
        : 0;
    const coordinatedClusterRatio =
      total > 0
        ? aggregation.signalTypeBreakdown[SignalType.COORDINATED_CLUSTER] /
          total
        : 0;
    const preEventTimingRatio =
      total > 0
        ? aggregation.signalTypeBreakdown[SignalType.PRE_EVENT_TIMING] / total
        : 0;

    // Signal recency (how concentrated are signals in recent time)
    const signalSpanHours =
      (aggregation.lastSignalAt.getTime() -
        aggregation.firstSignalAt.getTime()) /
      (60 * 60 * 1000);
    const signalRecencyScore =
      signalSpanHours > 0
        ? Math.min(1, (signalSpanHours > 24 ? 24 : signalSpanHours) / 24)
        : 1;

    // Signal intensity (signals per hour)
    const signalIntensity =
      signalSpanHours > 0 ? total / signalSpanHours : total;

    // Normalize volume (log scale, cap at $1M)
    const signalVolumeNormalized =
      aggregation.signalVolumeUsd > 0
        ? Math.min(1, Math.log10(aggregation.signalVolumeUsd + 1) / 6)
        : 0;

    return {
      bullishRatio:
        total > 0
          ? aggregation.bullishSignals / total
          : 0.5,
      avgStrength: aggregation.avgStrength,
      maxStrength: aggregation.maxStrength,
      avgConfidence: aggregation.avgConfidence,
      timeWeightedScore: (aggregation.timeWeightedScore + 1) / 2, // Normalize from [-1, 1] to [0, 1]
      signalVolumeNormalized,
      avgInsiderProbability: aggregation.avgInsiderProbability,
      insiderTradeRatio,
      volumeSpikeRatio,
      whaleTradeRatio,
      coordinatedClusterRatio,
      preEventTimingRatio,
      currentProbability,
      hoursUntilResolution: Math.min(1, hoursUntilResolution / 168), // Normalize to week
      signalRecencyScore,
      signalIntensity: Math.min(1, signalIntensity / 10), // Normalize
    };
  }

  // ============================================================================
  // Prediction
  // ============================================================================

  /**
   * Calculate YES probability from features
   */
  private calculateYesProbability(features: OutcomeFeatureVector): number {
    const { featureWeights, bias, yesPrior, temperature } = this.modelWeights;

    // Calculate linear combination
    let score = bias;
    for (const [key, weight] of Object.entries(featureWeights)) {
      const featureKey = key as keyof OutcomeFeatureVector;
      const value = features[featureKey];
      score += value * weight;
    }

    // Apply prior
    score += Math.log(yesPrior / (1 - yesPrior + 1e-10));

    // Apply temperature and sigmoid
    const scaledScore = score / temperature;
    const probability = 1 / (1 + Math.exp(-scaledScore));

    return probability;
  }

  /**
   * Calculate confidence from features and aggregation
   */
  private calculateConfidence(
    features: OutcomeFeatureVector,
    aggregation: SignalAggregation,
    yesProbability: number
  ): { level: OutcomeConfidenceLevel; score: number } {
    // Factors affecting confidence:
    // 1. Number of signals (more = higher confidence)
    // 2. Average signal confidence
    // 3. Agreement among signals (bullish ratio far from 0.5)
    // 4. High-value signal types present
    // 5. Probability extremity (farther from 0.5 = more decisive)

    const signalCountFactor = Math.min(
      1,
      aggregation.totalSignals / (this.config.minSignalsForPrediction * 3)
    );
    const avgConfidenceFactor = aggregation.avgConfidence;
    const agreementFactor =
      Math.abs(features.bullishRatio - 0.5) * 2; // 0 to 1
    const probabilityExtremity = Math.abs(yesProbability - 0.5) * 2;

    // High-value signal presence
    const highValueSignals =
      (aggregation.signalTypeBreakdown[SignalType.INSIDER_TRADE] > 0 ? 0.2 : 0) +
      (aggregation.signalTypeBreakdown[SignalType.COORDINATED_CLUSTER] > 0
        ? 0.15
        : 0) +
      (aggregation.signalTypeBreakdown[SignalType.PRE_EVENT_TIMING] > 0
        ? 0.15
        : 0);

    const score =
      signalCountFactor * 0.25 +
      avgConfidenceFactor * 0.2 +
      agreementFactor * 0.2 +
      probabilityExtremity * 0.15 +
      highValueSignals * 0.2;

    // Map to confidence level
    let level: OutcomeConfidenceLevel;
    if (score < OUTCOME_CONFIDENCE_THRESHOLDS.veryLow) {
      level = OutcomeConfidenceLevel.VERY_LOW;
    } else if (score < OUTCOME_CONFIDENCE_THRESHOLDS.low) {
      level = OutcomeConfidenceLevel.LOW;
    } else if (score < OUTCOME_CONFIDENCE_THRESHOLDS.medium) {
      level = OutcomeConfidenceLevel.MEDIUM;
    } else if (score < OUTCOME_CONFIDENCE_THRESHOLDS.high) {
      level = OutcomeConfidenceLevel.HIGH;
    } else {
      level = OutcomeConfidenceLevel.VERY_HIGH;
    }

    return { level, score };
  }

  /**
   * Determine predicted outcome from probability
   */
  private determinePredictedOutcome(
    yesProbability: number,
    confidenceScore: number
  ): PredictedOutcome {
    // If confidence is too low, return uncertain
    if (confidenceScore < this.config.minConfidenceThreshold) {
      return PredictedOutcome.UNCERTAIN;
    }

    if (yesProbability >= this.config.yesProbabilityThreshold) {
      return PredictedOutcome.YES;
    } else if (yesProbability <= this.config.noProbabilityThreshold) {
      return PredictedOutcome.NO;
    } else {
      return PredictedOutcome.UNCERTAIN;
    }
  }

  /**
   * Get key factors driving the prediction
   */
  private getKeyFactors(
    features: OutcomeFeatureVector,
    _aggregation: SignalAggregation
  ): PredictionFactor[] {
    const factors: PredictionFactor[] = [];
    const { featureWeights } = this.modelWeights;

    // Calculate contribution of each feature
    for (const [key, weight] of Object.entries(featureWeights)) {
      if (weight === 0) continue;

      const featureKey = key as keyof OutcomeFeatureVector;
      const value = features[featureKey];
      const contribution = value * weight;

      if (Math.abs(contribution) < 0.01) continue;

      const direction =
        contribution > 0 ? SignalDirection.BULLISH : SignalDirection.BEARISH;
      const description = this.getFeatureDescription(featureKey, value);

      factors.push({
        name: key,
        value,
        weight,
        contribution: Math.abs(contribution),
        direction,
        description,
      });
    }

    // Sort by contribution and take top 5
    return factors
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5);
  }

  /**
   * Get human-readable description for a feature
   */
  private getFeatureDescription(
    feature: keyof OutcomeFeatureVector,
    value: number
  ): string {
    const descriptions: Record<keyof OutcomeFeatureVector, (v: number) => string> = {
      bullishRatio: (v) =>
        v > 0.6
          ? `Strong bullish signal consensus (${(v * 100).toFixed(0)}%)`
          : v < 0.4
            ? `Strong bearish signal consensus (${((1 - v) * 100).toFixed(0)}%)`
            : `Mixed signal directions`,
      avgStrength: (v) =>
        v > 0.7
          ? `High average signal strength (${(v * 100).toFixed(0)}%)`
          : `Moderate signal strength`,
      maxStrength: (v) =>
        v > 0.8
          ? `Very strong individual signal detected (${(v * 100).toFixed(0)}%)`
          : `Signal strength within normal range`,
      avgConfidence: (v) =>
        v > 0.7
          ? `High confidence signals (${(v * 100).toFixed(0)}%)`
          : `Moderate confidence signals`,
      timeWeightedScore: (v) =>
        v > 0.7
          ? `Recent signals strongly bullish`
          : v < 0.3
            ? `Recent signals strongly bearish`
            : `Recent signals mixed`,
      signalVolumeNormalized: (v) =>
        v > 0.7
          ? `High volume associated with signals`
          : `Normal volume levels`,
      avgInsiderProbability: (v) =>
        v > 0.5
          ? `High insider probability detected (${(v * 100).toFixed(0)}%)`
          : `Lower insider probability`,
      insiderTradeRatio: (v) =>
        v > 0.3
          ? `Multiple insider trade signals (${(v * 100).toFixed(0)}%)`
          : `Few insider signals`,
      volumeSpikeRatio: (v) =>
        v > 0.3 ? `Volume spike signals present` : `Normal volume patterns`,
      whaleTradeRatio: (v) =>
        v > 0.3 ? `Whale activity detected` : `Normal trade sizes`,
      coordinatedClusterRatio: (v) =>
        v > 0.2
          ? `Coordinated wallet cluster activity`
          : `No cluster coordination detected`,
      preEventTimingRatio: (v) =>
        v > 0.2
          ? `Pre-event timing patterns detected`
          : `Normal timing patterns`,
      currentProbability: (v) => `Current market probability: ${(v * 100).toFixed(0)}%`,
      hoursUntilResolution: (v) =>
        `${Math.round(v * 168)} hours until resolution`,
      signalRecencyScore: (v) =>
        v > 0.7
          ? `Signals concentrated in recent time`
          : `Signals spread over time`,
      signalIntensity: (v) =>
        v > 0.5 ? `High signal intensity` : `Normal signal rate`,
    };

    return descriptions[feature](value);
  }

  /**
   * Generate explanation for the prediction
   */
  private generateExplanation(
    predictedOutcome: PredictedOutcome,
    yesProbability: number,
    confidence: OutcomeConfidenceLevel,
    keyFactors: PredictionFactor[],
    aggregation: SignalAggregation
  ): string {
    let explanation = "";

    // Outcome summary
    if (predictedOutcome === PredictedOutcome.YES) {
      explanation = `Predicted outcome: YES (${(yesProbability * 100).toFixed(1)}% probability). `;
    } else if (predictedOutcome === PredictedOutcome.NO) {
      explanation = `Predicted outcome: NO (${((1 - yesProbability) * 100).toFixed(1)}% probability). `;
    } else {
      explanation = `Outcome uncertain - probability near 50%. `;
    }

    // Confidence
    explanation += `Confidence: ${confidence}. `;

    // Signal summary
    explanation += `Based on ${aggregation.totalSignals} signals (${aggregation.bullishSignals} bullish, ${aggregation.bearishSignals} bearish). `;

    // Key factors
    if (keyFactors.length > 0) {
      const factorDescriptions = keyFactors
        .slice(0, 3)
        .map((f) => f.description);
      explanation += `Key factors: ${factorDescriptions.join("; ")}.`;
    }

    return explanation;
  }

  /**
   * Check cache for existing prediction
   */
  private checkCache(marketId: string): OutcomePredictionResult | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    const entry = this.predictionCache.get(marketId);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.predictionCache.delete(marketId);
      return null;
    }

    return entry.result;
  }

  /**
   * Store prediction in cache
   */
  private storeInCache(marketId: string, result: OutcomePredictionResult): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    // Evict old entries if cache is full
    if (this.predictionCache.size >= this.config.cacheMaxSize) {
      const oldestKey = this.predictionCache.keys().next().value;
      if (oldestKey) {
        this.predictionCache.delete(oldestKey);
      }
    }

    this.predictionCache.set(marketId, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Predict outcome for a market
   */
  predict(
    marketId: string,
    currentProbability: number = 0.5,
    hoursUntilResolution: number = 24
  ): OutcomePredictionResult {
    const startTime = Date.now();

    // Check cache
    const cached = this.checkCache(marketId);
    if (cached) {
      this.cacheHits++;
      this.emit("cache_hit", { marketId });
      return cached;
    }
    this.cacheMisses++;
    this.emit("cache_miss", { marketId });

    // Aggregate signals
    const aggregation = this.aggregateSignals(marketId);

    // If insufficient signals, return uncertain prediction
    if (
      !aggregation ||
      aggregation.totalSignals < this.config.minSignalsForPrediction
    ) {
      const insufficientResult = this.createInsufficientSignalsResult(
        marketId,
        aggregation,
        startTime
      );
      return insufficientResult;
    }

    // Extract features
    const features = this.extractFeatures(
      aggregation,
      currentProbability,
      hoursUntilResolution
    );

    // Calculate YES probability
    const yesProbability = this.calculateYesProbability(features);

    // Calculate confidence
    const { level: confidence, score: confidenceScore } =
      this.calculateConfidence(features, aggregation, yesProbability);

    // Determine outcome
    const predictedOutcome = this.determinePredictedOutcome(
      yesProbability,
      confidenceScore
    );

    // Get key factors
    const keyFactors = this.getKeyFactors(features, aggregation);

    // Generate explanation
    const explanation = this.generateExplanation(
      predictedOutcome,
      yesProbability,
      confidence,
      keyFactors,
      aggregation
    );

    const processingTimeMs = Date.now() - startTime;

    const result: OutcomePredictionResult = {
      predictionId: `opred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      predictedOutcome,
      yesProbability,
      noProbability: 1 - yesProbability,
      confidence,
      confidenceScore,
      features,
      contributingSignals: this.getRecentSignals(marketId),
      signalAggregation: aggregation,
      keyFactors,
      explanation,
      status: MarketPredictionStatus.PENDING,
      predictedAt: new Date(),
      processingTimeMs,
    };

    // Store prediction
    this.predictions.set(result.predictionId, result);
    this.predictionCount++;

    // Cache result
    this.storeInCache(marketId, result);

    // Emit events
    this.emit("prediction_made", result);
    if (
      confidence === OutcomeConfidenceLevel.HIGH ||
      confidence === OutcomeConfidenceLevel.VERY_HIGH
    ) {
      this.emit("high_confidence_prediction", result);
    }

    return result;
  }

  /**
   * Create result for insufficient signals
   */
  private createInsufficientSignalsResult(
    marketId: string,
    aggregation: SignalAggregation | null,
    startTime: number
  ): OutcomePredictionResult {
    const emptyFeatures: OutcomeFeatureVector = {
      bullishRatio: 0.5,
      avgStrength: 0,
      maxStrength: 0,
      avgConfidence: 0,
      timeWeightedScore: 0.5,
      signalVolumeNormalized: 0,
      avgInsiderProbability: 0,
      insiderTradeRatio: 0,
      volumeSpikeRatio: 0,
      whaleTradeRatio: 0,
      coordinatedClusterRatio: 0,
      preEventTimingRatio: 0,
      currentProbability: 0.5,
      hoursUntilResolution: 0.5,
      signalRecencyScore: 0,
      signalIntensity: 0,
    };

    const emptyAggregation: SignalAggregation = aggregation || {
      marketId,
      totalSignals: 0,
      bullishSignals: 0,
      bearishSignals: 0,
      neutralSignals: 0,
      avgStrength: 0,
      maxStrength: 0,
      avgConfidence: 0,
      signalTypeBreakdown: Object.fromEntries(
        Object.values(SignalType).map((t) => [t, 0])
      ) as Record<SignalType, number>,
      timeWeightedScore: 0,
      signalVolumeUsd: 0,
      avgInsiderProbability: 0,
      firstSignalAt: new Date(),
      lastSignalAt: new Date(),
    };

    const processingTimeMs = Date.now() - startTime;

    const result: OutcomePredictionResult = {
      predictionId: `opred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      predictedOutcome: PredictedOutcome.UNCERTAIN,
      yesProbability: 0.5,
      noProbability: 0.5,
      confidence: OutcomeConfidenceLevel.VERY_LOW,
      confidenceScore: 0,
      features: emptyFeatures,
      contributingSignals: [],
      signalAggregation: emptyAggregation,
      keyFactors: [],
      explanation: `Insufficient signals (${emptyAggregation.totalSignals}/${this.config.minSignalsForPrediction} required) to make a prediction.`,
      status: MarketPredictionStatus.PENDING,
      predictedAt: new Date(),
      processingTimeMs,
    };

    // Store even uncertain predictions
    this.predictions.set(result.predictionId, result);
    this.predictionCount++;

    this.emit("prediction_made", result);
    return result;
  }

  /**
   * Predict outcomes for multiple markets
   */
  predictBatch(
    marketIds: string[],
    currentProbabilities?: Record<string, number>,
    hoursUntilResolutions?: Record<string, number>
  ): BatchOutcomePredictionResult {
    const startTime = Date.now();

    const results: OutcomePredictionResult[] = [];
    let predictedYes = 0;
    let predictedNo = 0;
    let predictedUncertain = 0;
    let totalYesProbability = 0;

    for (const marketId of marketIds) {
      const currentProb = currentProbabilities?.[marketId] ?? 0.5;
      const hoursUntil = hoursUntilResolutions?.[marketId] ?? 24;

      const result = this.predict(marketId, currentProb, hoursUntil);
      results.push(result);

      if (result.predictedOutcome === PredictedOutcome.YES) {
        predictedYes++;
      } else if (result.predictedOutcome === PredictedOutcome.NO) {
        predictedNo++;
      } else {
        predictedUncertain++;
      }

      totalYesProbability += result.yesProbability;
    }

    const processingTimeMs = Date.now() - startTime;

    const batchResult: BatchOutcomePredictionResult = {
      totalPredicted: results.length,
      predictedYes,
      predictedNo,
      predictedUncertain,
      results,
      avgYesProbability:
        results.length > 0 ? totalYesProbability / results.length : 0.5,
      processingTimeMs,
    };

    this.emit("batch_completed", batchResult);
    return batchResult;
  }

  // ============================================================================
  // Verification
  // ============================================================================

  /**
   * Verify a prediction against actual outcome
   */
  verifyPrediction(
    predictionId: string,
    actualOutcome: "YES" | "NO"
  ): boolean {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      return false;
    }

    // Update prediction
    prediction.status = MarketPredictionStatus.VERIFIED;
    prediction.verifiedAt = new Date();
    prediction.actualOutcome = actualOutcome;
    prediction.wasCorrect =
      (prediction.predictedOutcome === PredictedOutcome.YES &&
        actualOutcome === "YES") ||
      (prediction.predictedOutcome === PredictedOutcome.NO &&
        actualOutcome === "NO");

    // Add to historical outcomes for training
    this.historicalOutcomes.push({
      marketId: prediction.marketId,
      outcome: actualOutcome,
      resolvedAt: new Date(),
      signalAggregation: prediction.signalAggregation,
      finalProbability: prediction.yesProbability,
    });

    // Update metrics
    this.updateMetricsAfterVerification(prediction, actualOutcome);

    const correct = prediction.wasCorrect ?? false;

    this.emit("prediction_verified", {
      predictionId,
      predicted: prediction.predictedOutcome,
      actual: actualOutcome,
      correct,
    });

    this.emit("metrics_updated", this.metrics);

    return correct;
  }

  /**
   * Update metrics after verification
   */
  private updateMetricsAfterVerification(
    prediction: OutcomePredictionResult,
    actualOutcome: "YES" | "NO"
  ): void {
    this.metrics.verifiedPredictions++;
    this.metrics.totalPredictions = this.predictionCount;

    const predicted = prediction.predictedOutcome;
    const wasYes = predicted === PredictedOutcome.YES;
    const actualYes = actualOutcome === "YES";

    // Only count definitive predictions (not uncertain)
    if (predicted !== PredictedOutcome.UNCERTAIN) {
      if (wasYes && actualYes) {
        this.metrics.truePositives++;
        this.metrics.correctPredictions++;
      } else if (!wasYes && !actualYes) {
        this.metrics.trueNegatives++;
        this.metrics.correctPredictions++;
      } else if (wasYes && !actualYes) {
        this.metrics.falsePositives++;
      } else {
        this.metrics.falseNegatives++;
      }
    }

    // Update accuracy
    this.metrics.accuracy =
      this.metrics.verifiedPredictions > 0
        ? this.metrics.correctPredictions / this.metrics.verifiedPredictions
        : 0;

    // Update precision
    const precisionDenom =
      this.metrics.truePositives + this.metrics.falsePositives;
    this.metrics.precision =
      precisionDenom > 0 ? this.metrics.truePositives / precisionDenom : 0;

    // Update recall
    const recallDenom =
      this.metrics.truePositives + this.metrics.falseNegatives;
    this.metrics.recall =
      recallDenom > 0 ? this.metrics.truePositives / recallDenom : 0;

    // Update F1
    const f1Denom = this.metrics.precision + this.metrics.recall;
    this.metrics.f1Score =
      f1Denom > 0
        ? (2 * this.metrics.precision * this.metrics.recall) / f1Denom
        : 0;

    // Update Brier score (running average)
    const actualBinary = actualYes ? 1 : 0;
    const brierContribution = Math.pow(
      prediction.yesProbability - actualBinary,
      2
    );
    this.metrics.brierScore =
      (this.metrics.brierScore * (this.metrics.verifiedPredictions - 1) +
        brierContribution) /
      this.metrics.verifiedPredictions;

    // Update log loss (running average)
    const eps = 1e-15;
    const clampedProb = Math.max(
      eps,
      Math.min(1 - eps, prediction.yesProbability)
    );
    const logLossContribution = actualYes
      ? -Math.log(clampedProb)
      : -Math.log(1 - clampedProb);
    this.metrics.logLoss =
      (this.metrics.logLoss * (this.metrics.verifiedPredictions - 1) +
        logLossContribution) /
      this.metrics.verifiedPredictions;

    // Update accuracy by confidence
    const confLevel = prediction.confidence;
    const confCorrect =
      (predicted === PredictedOutcome.YES && actualYes) ||
      (predicted === PredictedOutcome.NO && !actualYes);
    // Simplified: just track latest result per confidence level
    if (predicted !== PredictedOutcome.UNCERTAIN) {
      this.metrics.accuracyByConfidence[confLevel] =
        confCorrect ? 1 : 0;
    }

    this.metrics.lastUpdated = new Date();
  }

  // ============================================================================
  // Training
  // ============================================================================

  /**
   * Train the model on historical data
   */
  train(maxIterations: number = 100): { accuracy: number; iterations: number } {
    if (this.historicalOutcomes.length < 10) {
      this.emit("error", {
        message: `Insufficient training data: ${this.historicalOutcomes.length} samples (need 10+)`,
      });
      return { accuracy: 0, iterations: 0 };
    }

    this.trainingStatus = TrainingStatus.TRAINING;

    // Prepare training samples
    const samples: TrainingSample[] = this.historicalOutcomes.map((ho) => ({
      features: this.extractFeatures(ho.signalAggregation, ho.finalProbability),
      label: ho.outcome === "YES" ? 1 : 0,
      marketId: ho.marketId,
    }));

    // Simple gradient descent training
    let bestAccuracy = 0;
    let iteration = 0;

    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Calculate gradients
      const gradients: Record<string, number> = {};
      for (const key of Object.keys(this.modelWeights.featureWeights)) {
        gradients[key] = 0;
      }
      let biasGradient = 0;

      let correctCount = 0;

      for (const sample of samples) {
        const predicted = this.calculateYesProbability(sample.features);
        const error = sample.label - predicted;

        // Check if correct
        if (
          (predicted >= 0.5 && sample.label === 1) ||
          (predicted < 0.5 && sample.label === 0)
        ) {
          correctCount++;
        }

        // Update gradients
        for (const [key, value] of Object.entries(sample.features)) {
          gradients[key] =
            (gradients[key] || 0) +
            error * value -
            this.config.regularization *
              (this.modelWeights.featureWeights[
                key as keyof OutcomeFeatureVector
              ] || 0);
        }
        biasGradient += error;
      }

      // Update weights
      for (const [key, gradient] of Object.entries(gradients)) {
        const featureKey = key as keyof OutcomeFeatureVector;
        this.modelWeights.featureWeights[featureKey] =
          (this.modelWeights.featureWeights[featureKey] || 0) +
          this.config.learningRate * (gradient / samples.length);
      }
      this.modelWeights.bias +=
        this.config.learningRate * (biasGradient / samples.length);

      const accuracy = correctCount / samples.length;
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
      }

      // Early stopping if perfect accuracy
      if (accuracy >= 1.0) {
        break;
      }
    }

    this.trainingStatus = TrainingStatus.TRAINED;

    this.emit("model_trained", {
      samplesUsed: samples.length,
      trainingAccuracy: bestAccuracy,
    });

    return { accuracy: bestAccuracy, iterations: iteration + 1 };
  }

  /**
   * Add historical outcome for training
   */
  addHistoricalOutcome(outcome: HistoricalMarketOutcome): void {
    this.historicalOutcomes.push(outcome);
  }

  /**
   * Get historical outcomes
   */
  getHistoricalOutcomes(): HistoricalMarketOutcome[] {
    return [...this.historicalOutcomes];
  }

  // ============================================================================
  // Statistics and Metrics
  // ============================================================================

  /**
   * Get model metrics
   */
  getMetrics(): OutcomeModelMetrics {
    return { ...this.metrics };
  }

  /**
   * Get prediction by ID
   */
  getPrediction(predictionId: string): OutcomePredictionResult | undefined {
    return this.predictions.get(predictionId);
  }

  /**
   * Get all predictions for a market
   */
  getPredictionsForMarket(marketId: string): OutcomePredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.marketId === marketId
    );
  }

  /**
   * Get verified predictions
   */
  getVerifiedPredictions(): OutcomePredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.status === MarketPredictionStatus.VERIFIED
    );
  }

  /**
   * Get pending predictions
   */
  getPendingPredictions(): OutcomePredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.status === MarketPredictionStatus.PENDING
    );
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalPredictions: number;
    totalSignals: number;
    marketsWithSignals: number;
    historicalOutcomes: number;
    trainingStatus: TrainingStatus;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
  } {
    let totalSignals = 0;
    for (const signals of this.signalHistory.values()) {
      totalSignals += signals.length;
    }

    const cacheTotal = this.cacheHits + this.cacheMisses;

    return {
      totalPredictions: this.predictionCount,
      totalSignals,
      marketsWithSignals: this.signalHistory.size,
      historicalOutcomes: this.historicalOutcomes.length,
      trainingStatus: this.trainingStatus,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: cacheTotal > 0 ? this.cacheHits / cacheTotal : 0,
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.predictionCache.size,
      maxSize: this.config.cacheMaxSize,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset predictor state
   */
  reset(): void {
    this.modelWeights = { ...DEFAULT_MODEL_WEIGHTS };
    this.trainingStatus = TrainingStatus.NOT_TRAINED;
    this.signalHistory.clear();
    this.predictions.clear();
    this.historicalOutcomes = [];
    this.predictionCache.clear();
    this.metrics = this.initializeMetrics();
    this.predictionCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedPredictor: MarketOutcomePredictor | null = null;

/**
 * Create a new market outcome predictor
 */
export function createMarketOutcomePredictor(
  config?: Partial<MarketOutcomePredictorConfig>
): MarketOutcomePredictor {
  return new MarketOutcomePredictor(config);
}

/**
 * Get the shared market outcome predictor instance
 */
export function getSharedMarketOutcomePredictor(): MarketOutcomePredictor {
  if (!sharedPredictor) {
    sharedPredictor = new MarketOutcomePredictor();
  }
  return sharedPredictor;
}

/**
 * Set the shared market outcome predictor instance
 */
export function setSharedMarketOutcomePredictor(
  predictor: MarketOutcomePredictor
): void {
  sharedPredictor = predictor;
}

/**
 * Reset the shared market outcome predictor instance
 */
export function resetSharedMarketOutcomePredictor(): void {
  if (sharedPredictor) {
    sharedPredictor.reset();
  }
  sharedPredictor = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get outcome description
 */
export function getOutcomeDescription(outcome: PredictedOutcome): string {
  const descriptions: Record<PredictedOutcome, string> = {
    [PredictedOutcome.YES]: "Market outcome predicted to be YES",
    [PredictedOutcome.NO]: "Market outcome predicted to be NO",
    [PredictedOutcome.UNCERTAIN]:
      "Market outcome uncertain - insufficient confidence",
  };
  return descriptions[outcome];
}

/**
 * Get outcome color for UI
 */
export function getOutcomeColor(outcome: PredictedOutcome): string {
  const colors: Record<PredictedOutcome, string> = {
    [PredictedOutcome.YES]: "#10B981", // green
    [PredictedOutcome.NO]: "#EF4444", // red
    [PredictedOutcome.UNCERTAIN]: "#9CA3AF", // gray
  };
  return colors[outcome];
}

/**
 * Get confidence level description
 */
export function getOutcomeConfidenceDescription(
  level: OutcomeConfidenceLevel
): string {
  const descriptions: Record<OutcomeConfidenceLevel, string> = {
    [OutcomeConfidenceLevel.VERY_LOW]:
      "Very low confidence - insufficient signals for prediction",
    [OutcomeConfidenceLevel.LOW]:
      "Low confidence - limited signals, prediction may be unreliable",
    [OutcomeConfidenceLevel.MEDIUM]:
      "Medium confidence - moderate signal support",
    [OutcomeConfidenceLevel.HIGH]:
      "High confidence - strong signal support for prediction",
    [OutcomeConfidenceLevel.VERY_HIGH]:
      "Very high confidence - overwhelming signal support",
  };
  return descriptions[level];
}

/**
 * Get confidence level color for UI
 */
export function getOutcomeConfidenceColor(
  level: OutcomeConfidenceLevel
): string {
  const colors: Record<OutcomeConfidenceLevel, string> = {
    [OutcomeConfidenceLevel.VERY_LOW]: "#9CA3AF", // gray
    [OutcomeConfidenceLevel.LOW]: "#FCD34D", // yellow
    [OutcomeConfidenceLevel.MEDIUM]: "#60A5FA", // blue
    [OutcomeConfidenceLevel.HIGH]: "#34D399", // green
    [OutcomeConfidenceLevel.VERY_HIGH]: "#10B981", // emerald
  };
  return colors[level];
}

/**
 * Get signal type description
 */
export function getSignalTypeDescription(type: SignalType): string {
  const descriptions: Record<SignalType, string> = {
    [SignalType.INSIDER_TRADE]: "Trade flagged as potential insider activity",
    [SignalType.VOLUME_SPIKE]: "Unusual volume spike detected",
    [SignalType.FRESH_WALLET]: "Activity from a fresh/new wallet",
    [SignalType.WHALE_TRADE]: "Large trade from whale wallet",
    [SignalType.COORDINATED_CLUSTER]:
      "Coordinated activity from wallet cluster",
    [SignalType.PRE_EVENT_TIMING]: "Suspicious pre-event timing pattern",
    [SignalType.PRICE_ANOMALY]: "Unusual price movement detected",
    [SignalType.ORDER_BOOK_IMBALANCE]: "Order book imbalance signal",
    [SignalType.MARKET_SELECTION]: "Unusual market selection pattern",
    [SignalType.HIGH_WIN_RATE]: "Activity from high win-rate trader",
  };
  return descriptions[type];
}

/**
 * Get signal direction description
 */
export function getSignalDirectionDescription(
  direction: SignalDirection
): string {
  const descriptions: Record<SignalDirection, string> = {
    [SignalDirection.BULLISH]: "Signal suggests YES outcome",
    [SignalDirection.BEARISH]: "Signal suggests NO outcome",
    [SignalDirection.NEUTRAL]: "Signal direction is neutral",
  };
  return descriptions[direction];
}

/**
 * Format probability as percentage string
 */
export function formatOutcomeProbability(
  probability: number,
  decimals: number = 1
): string {
  return `${(probability * 100).toFixed(decimals)}%`;
}

/**
 * Get training status description
 */
export function getTrainingStatusDescription(status: TrainingStatus): string {
  const descriptions: Record<TrainingStatus, string> = {
    [TrainingStatus.NOT_TRAINED]: "Model has not been trained",
    [TrainingStatus.TRAINING]: "Model is currently training",
    [TrainingStatus.TRAINED]: "Model training complete",
    [TrainingStatus.FAILED]: "Model training failed",
  };
  return descriptions[status];
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate random hex address
 */
function generateRandomAddress(): string {
  let address = "";
  for (let i = 0; i < 40; i++) {
    address += Math.floor(Math.random() * 16).toString(16);
  }
  return `0x${address}`;
}

/**
 * Create mock market signal
 */
export function createMockMarketSignal(
  overrides: Partial<MarketSignal> = {}
): MarketSignal {
  const signalTypes = Object.values(SignalType);
  const directions = Object.values(SignalDirection);

  return {
    signalId: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    marketId: `market_${Math.random().toString(36).substr(2, 6)}`,
    type: signalTypes[Math.floor(Math.random() * signalTypes.length)]!,
    direction: directions[Math.floor(Math.random() * directions.length)]!,
    strength: Math.random(),
    confidence: 0.5 + Math.random() * 0.5,
    walletAddress: generateRandomAddress(),
    tradeSizeUsd: Math.random() * 50000,
    insiderProbability: Math.random() * 0.6,
    anomalyScore: Math.random() * 100,
    timestamp: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Create mock signals for a market
 */
export function createMockSignalsForMarket(
  marketId: string,
  count: number = 10,
  bias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL"
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  for (let i = 0; i < count; i++) {
    let direction: SignalDirection;
    if (bias === "BULLISH") {
      direction =
        Math.random() > 0.3
          ? SignalDirection.BULLISH
          : Math.random() > 0.5
            ? SignalDirection.BEARISH
            : SignalDirection.NEUTRAL;
    } else if (bias === "BEARISH") {
      direction =
        Math.random() > 0.3
          ? SignalDirection.BEARISH
          : Math.random() > 0.5
            ? SignalDirection.BULLISH
            : SignalDirection.NEUTRAL;
    } else {
      direction =
        Math.random() > 0.66
          ? SignalDirection.BULLISH
          : Math.random() > 0.33
            ? SignalDirection.BEARISH
            : SignalDirection.NEUTRAL;
    }

    signals.push(
      createMockMarketSignal({
        marketId,
        direction,
        timestamp: new Date(
          Date.now() - (count - i) * (Math.random() * 4 * 60 * 60 * 1000)
        ),
      })
    );
  }

  return signals;
}

/**
 * Create mock signal aggregation
 */
export function createMockSignalAggregation(
  overrides: Partial<SignalAggregation> = {}
): SignalAggregation {
  const totalSignals = Math.floor(Math.random() * 20) + 5;
  const bullishSignals = Math.floor(totalSignals * Math.random());
  const bearishSignals = Math.floor(
    (totalSignals - bullishSignals) * Math.random()
  );
  const neutralSignals = totalSignals - bullishSignals - bearishSignals;

  const signalTypeBreakdown: Record<SignalType, number> = {} as Record<
    SignalType,
    number
  >;
  let remaining = totalSignals;
  for (const type of Object.values(SignalType)) {
    const count = Math.floor(Math.random() * remaining);
    signalTypeBreakdown[type] = count;
    remaining -= count;
  }
  // Assign remaining to first type
  signalTypeBreakdown[SignalType.INSIDER_TRADE] += remaining;

  return {
    marketId: `market_${Math.random().toString(36).substr(2, 6)}`,
    totalSignals,
    bullishSignals,
    bearishSignals,
    neutralSignals,
    avgStrength: Math.random(),
    maxStrength: Math.random(),
    avgConfidence: 0.5 + Math.random() * 0.5,
    signalTypeBreakdown,
    timeWeightedScore: (Math.random() - 0.5) * 2,
    signalVolumeUsd: Math.random() * 500000,
    avgInsiderProbability: Math.random() * 0.5,
    firstSignalAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    lastSignalAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Create mock historical outcome
 */
export function createMockHistoricalOutcome(
  overrides: Partial<HistoricalMarketOutcome> = {}
): HistoricalMarketOutcome {
  const aggregation = createMockSignalAggregation();

  return {
    marketId: aggregation.marketId,
    outcome: Math.random() > 0.5 ? "YES" : "NO",
    resolvedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    signalAggregation: aggregation,
    finalProbability: Math.random(),
    category: ["POLITICS", "CRYPTO", "SPORTS"][Math.floor(Math.random() * 3)],
    volumeUsd: Math.random() * 1000000,
    ...overrides,
  };
}

/**
 * Create mock prediction result
 */
export function createMockOutcomePrediction(
  overrides: Partial<OutcomePredictionResult> = {}
): OutcomePredictionResult {
  const aggregation = createMockSignalAggregation();
  const yesProbability = Math.random();
  const outcomes = Object.values(PredictedOutcome);
  const confidenceLevels = Object.values(OutcomeConfidenceLevel);

  const features: OutcomeFeatureVector = {
    bullishRatio: aggregation.totalSignals > 0
      ? aggregation.bullishSignals / aggregation.totalSignals
      : 0.5,
    avgStrength: aggregation.avgStrength,
    maxStrength: aggregation.maxStrength,
    avgConfidence: aggregation.avgConfidence,
    timeWeightedScore: (aggregation.timeWeightedScore + 1) / 2,
    signalVolumeNormalized: Math.min(
      1,
      Math.log10(aggregation.signalVolumeUsd + 1) / 6
    ),
    avgInsiderProbability: aggregation.avgInsiderProbability,
    insiderTradeRatio:
      aggregation.signalTypeBreakdown[SignalType.INSIDER_TRADE] /
      aggregation.totalSignals,
    volumeSpikeRatio:
      aggregation.signalTypeBreakdown[SignalType.VOLUME_SPIKE] /
      aggregation.totalSignals,
    whaleTradeRatio:
      aggregation.signalTypeBreakdown[SignalType.WHALE_TRADE] /
      aggregation.totalSignals,
    coordinatedClusterRatio:
      aggregation.signalTypeBreakdown[SignalType.COORDINATED_CLUSTER] /
      aggregation.totalSignals,
    preEventTimingRatio:
      aggregation.signalTypeBreakdown[SignalType.PRE_EVENT_TIMING] /
      aggregation.totalSignals,
    currentProbability: Math.random(),
    hoursUntilResolution: Math.random(),
    signalRecencyScore: Math.random(),
    signalIntensity: Math.random(),
  };

  return {
    predictionId: `opred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    marketId: aggregation.marketId,
    predictedOutcome: outcomes[Math.floor(Math.random() * outcomes.length)]!,
    yesProbability,
    noProbability: 1 - yesProbability,
    confidence:
      confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)]!,
    confidenceScore: Math.random(),
    features,
    contributingSignals: [],
    signalAggregation: aggregation,
    keyFactors: [],
    explanation: "Mock prediction for testing",
    status: MarketPredictionStatus.PENDING,
    predictedAt: new Date(),
    processingTimeMs: Math.random() * 100,
    ...overrides,
  };
}

/**
 * Create a batch of mock historical outcomes
 */
export function createMockHistoricalOutcomeBatch(
  count: number
): HistoricalMarketOutcome[] {
  return Array.from({ length: count }, () => createMockHistoricalOutcome());
}
