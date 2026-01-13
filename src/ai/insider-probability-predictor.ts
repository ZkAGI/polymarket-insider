/**
 * Insider Probability Predictor (AI-PRED-001)
 *
 * Predicts the probability that trading activity is insider-related.
 * Uses a multi-signal approach combining behavioral, timing, market,
 * and outcome features to generate calibrated probability predictions.
 *
 * Features:
 * - Define comprehensive feature set for insider detection
 * - Train binary classifier for insider probability
 * - Calculate calibrated probabilities
 * - Track prediction accuracy over time
 * - Batch prediction support
 * - Prediction caching for performance
 * - Event emission for insider detection
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Insider probability confidence levels
 */
export enum InsiderConfidenceLevel {
  /** Very low confidence - insufficient data */
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
 * Insider signal category
 */
export enum InsiderSignalCategory {
  /** Wallet behavior signals */
  WALLET_BEHAVIOR = "WALLET_BEHAVIOR",
  /** Timing-based signals */
  TIMING = "TIMING",
  /** Market selection signals */
  MARKET_SELECTION = "MARKET_SELECTION",
  /** Trading pattern signals */
  TRADING_PATTERN = "TRADING_PATTERN",
  /** Performance signals */
  PERFORMANCE = "PERFORMANCE",
  /** Network/coordination signals */
  NETWORK = "NETWORK",
}

/**
 * Prediction status
 */
export enum PredictionStatus {
  /** Prediction is pending verification */
  PENDING = "PENDING",
  /** Market resolved, prediction verified */
  VERIFIED = "VERIFIED",
  /** Prediction expired (market didn't resolve in time) */
  EXPIRED = "EXPIRED",
}

/**
 * Model calibration method
 */
export enum CalibrationMethod {
  /** Platt scaling (sigmoid) */
  PLATT = "PLATT",
  /** Isotonic regression */
  ISOTONIC = "ISOTONIC",
  /** Beta calibration */
  BETA = "BETA",
  /** Temperature scaling */
  TEMPERATURE = "TEMPERATURE",
  /** No calibration (raw probabilities) */
  NONE = "NONE",
}

/**
 * Feature definition for insider prediction
 */
export interface InsiderFeatureDefinition {
  /** Feature name */
  name: string;
  /** Feature category */
  category: InsiderSignalCategory;
  /** Feature weight in final prediction */
  weight: number;
  /** Description */
  description: string;
  /** Is higher value more suspicious? */
  higherIsSuspicious: boolean;
  /** Threshold for suspicion (normalized 0-1) */
  suspicionThreshold: number;
  /** Minimum required for prediction */
  required: boolean;
}

/**
 * Wallet activity data for insider prediction
 */
export interface WalletActivityData {
  /** Wallet address */
  walletAddress: string;
  /** Market ID being analyzed */
  marketId: string;
  /** Position size in USD */
  positionSizeUsd: number;
  /** Position direction */
  positionSide: "LONG" | "SHORT";
  /** Entry price/probability */
  entryPrice: number;
  /** Time of position entry */
  entryTimestamp: Date;
  /** Time until market resolution at entry */
  hoursUntilResolutionAtEntry: number | null;
  /** Exit price if position closed */
  exitPrice?: number;
  /** Time of exit if closed */
  exitTimestamp?: Date;
  /** Market resolved outcome */
  resolvedOutcome?: "YES" | "NO" | null;
  /** Position profit/loss if resolved */
  profitLoss?: number;
}

/**
 * Wallet behavior features
 */
export interface WalletBehaviorFeatures {
  /** Wallet age in days */
  walletAgeDays: number;
  /** Total trades count */
  totalTrades: number;
  /** Total Polymarket trades */
  polymarketTrades: number;
  /** First trade was large? */
  firstTradeLarge: boolean;
  /** Funded right before trading */
  fundedBeforeTrading: boolean;
  /** Days between funding and first trade */
  daysBetweenFundingAndTrade: number;
  /** Funding source known? */
  fundingSourceKnown: boolean;
  /** Funding from exchange */
  fundedFromExchange: boolean;
  /** Part of wallet cluster */
  inWalletCluster: boolean;
  /** Cluster member count */
  clusterSize: number;
  /** Sybil risk score (0-100) */
  sybilRiskScore: number;
}

/**
 * Timing features for insider prediction
 */
export interface TimingFeatures {
  /** Traded during off-hours */
  tradedOffHours: boolean;
  /** Trade before major event/news */
  tradedBeforeEvent: boolean;
  /** Hours before event if applicable */
  hoursBeforeEvent: number | null;
  /** Trade timing suspiciously precise */
  preciseTimingSuspicious: boolean;
  /** Consistency of trading times */
  timingConsistencyScore: number;
  /** Percentage of trades in last 24h before resolution */
  last24HoursTradeRatio: number;
  /** Average hold time in hours */
  avgHoldTimeHours: number;
}

/**
 * Market selection features
 */
export interface MarketSelectionFeatures {
  /** Market category */
  marketCategory: string;
  /** Is niche market */
  isNicheMarket: boolean;
  /** Is political market */
  isPoliticalMarket: boolean;
  /** Is regulatory market */
  isRegulatoryMarket: boolean;
  /** Is geopolitical market */
  isGeopoliticalMarket: boolean;
  /** Market liquidity at trade time */
  marketLiquidityUsd: number;
  /** Market daily volume at trade time */
  marketDailyVolumeUsd: number;
  /** Wallet concentration in this category */
  categoryConcentration: number;
  /** Trades mostly in info-advantage markets */
  infoAdvantageMarketRatio: number;
}

/**
 * Trading pattern features
 */
export interface TradingPatternFeatures {
  /** Position size relative to wallet avg */
  positionSizeRatio: number;
  /** Trade size percentile in market */
  tradeSizePercentile: number;
  /** Direction against consensus */
  againstConsensus: boolean;
  /** Direction changed near resolution */
  directionChangedNearResolution: boolean;
  /** Entry at extreme price */
  entryAtExtremePrice: boolean;
  /** Multiple entries in same direction */
  multipleEntriesSameDirection: number;
  /** Exit before resolution */
  exitedBeforeResolution: boolean;
}

/**
 * Performance features
 */
export interface PerformanceFeatures {
  /** Overall win rate */
  winRate: number;
  /** Win rate in similar markets */
  categoryWinRate: number;
  /** Win rate in niche markets */
  nicheMarketWinRate: number;
  /** Profit factor */
  profitFactor: number;
  /** Max consecutive wins */
  maxConsecutiveWins: number;
  /** Current win streak */
  currentWinStreak: number;
  /** Average profit per winning trade */
  avgWinAmount: number;
  /** Statistical significance of win rate */
  winRateZScore: number;
}

/**
 * Network/coordination features
 */
export interface NetworkFeatures {
  /** Coordination score with other wallets */
  coordinationScore: number;
  /** Number of correlated wallets */
  correlatedWalletCount: number;
  /** Same direction as coordinated wallets */
  sameDirectionAsCluster: boolean;
  /** Entry timing correlation */
  entryTimingCorrelation: number;
  /** Shared funding sources */
  sharedFundingSources: number;
}

/**
 * Complete insider feature set
 */
export interface InsiderFeatureSet {
  /** Wallet activity being analyzed */
  activity: WalletActivityData;
  /** Wallet behavior features */
  walletBehavior: WalletBehaviorFeatures;
  /** Timing features */
  timing: TimingFeatures;
  /** Market selection features */
  marketSelection: MarketSelectionFeatures;
  /** Trading pattern features */
  tradingPattern: TradingPatternFeatures;
  /** Performance features */
  performance: PerformanceFeatures;
  /** Network features */
  network: NetworkFeatures;
}

/**
 * Individual signal contribution
 */
export interface SignalContribution {
  /** Signal name */
  name: string;
  /** Signal category */
  category: InsiderSignalCategory;
  /** Raw signal value */
  value: number;
  /** Normalized value (0-1) */
  normalizedValue: number;
  /** Weight in final prediction */
  weight: number;
  /** Contribution to probability */
  contribution: number;
  /** Human-readable description */
  description: string;
  /** Suspicion indicator */
  isSuspicious: boolean;
}

/**
 * Insider probability prediction result
 */
export interface InsiderPredictionResult {
  /** Prediction ID */
  predictionId: string;
  /** Wallet address */
  walletAddress: string;
  /** Market ID */
  marketId: string;
  /** Raw prediction score (0-1) */
  rawScore: number;
  /** Calibrated probability (0-1) */
  probability: number;
  /** Confidence level */
  confidence: InsiderConfidenceLevel;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Contributing signals */
  signals: SignalContribution[];
  /** Top contributing factors */
  topFactors: SignalContribution[];
  /** Risk assessment summary */
  riskAssessment: string;
  /** Recommended actions */
  recommendedActions: string[];
  /** Prediction status */
  status: PredictionStatus;
  /** Prediction timestamp */
  predictedAt: Date;
  /** Verification timestamp if verified */
  verifiedAt?: Date;
  /** Actual outcome if known */
  actualOutcome?: "INSIDER" | "NOT_INSIDER" | null;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Batch prediction result
 */
export interface BatchPredictionResult {
  /** Total activities predicted */
  totalPredicted: number;
  /** Number flagged as potential insider */
  flaggedCount: number;
  /** Individual results */
  results: InsiderPredictionResult[];
  /** Average probability */
  averageProbability: number;
  /** Probability distribution */
  distribution: ProbabilityDistribution;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Probability distribution
 */
export interface ProbabilityDistribution {
  /** Count in [0, 0.2) - Very unlikely insider */
  veryUnlikely: number;
  /** Count in [0.2, 0.4) - Unlikely insider */
  unlikely: number;
  /** Count in [0.4, 0.6) - Uncertain */
  uncertain: number;
  /** Count in [0.6, 0.8) - Likely insider */
  likely: number;
  /** Count in [0.8, 1.0] - Very likely insider */
  veryLikely: number;
}

/**
 * Calibration parameters
 */
export interface CalibrationParameters {
  /** Calibration method */
  method: CalibrationMethod;
  /** Platt scaling A parameter */
  plattA?: number;
  /** Platt scaling B parameter */
  plattB?: number;
  /** Temperature for temperature scaling */
  temperature?: number;
  /** Beta calibration a parameter */
  betaA?: number;
  /** Beta calibration b parameter */
  betaB?: number;
  /** Isotonic regression points */
  isotonicPoints?: Array<{ input: number; output: number }>;
}

/**
 * Model accuracy metrics
 */
export interface ModelAccuracyMetrics {
  /** Total predictions made */
  totalPredictions: number;
  /** Predictions verified */
  verifiedPredictions: number;
  /** True positives (predicted insider, was insider) */
  truePositives: number;
  /** True negatives */
  trueNegatives: number;
  /** False positives */
  falsePositives: number;
  /** False negatives */
  falseNegatives: number;
  /** Precision */
  precision: number;
  /** Recall */
  recall: number;
  /** F1 score */
  f1Score: number;
  /** AUC-ROC */
  aucRoc: number;
  /** Brier score (calibration) */
  brierScore: number;
  /** Expected calibration error */
  expectedCalibrationError: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Predictor configuration
 */
export interface InsiderPredictorConfig {
  /** Probability threshold for flagging */
  flagThreshold: number;
  /** Minimum confidence for predictions */
  minConfidence: InsiderConfidenceLevel;
  /** Calibration parameters */
  calibration: CalibrationParameters;
  /** Feature weights */
  featureWeights: Record<string, number>;
  /** Enable caching */
  cacheEnabled: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
  /** Cache max size */
  cacheMaxSize: number;
  /** Enable automatic verification */
  enableVerification: boolean;
  /** Verification lookback days */
  verificationLookbackDays: number;
}

/**
 * Predictor events
 */
export interface InsiderPredictorEvents {
  /** Prediction made */
  prediction_made: InsiderPredictionResult;
  /** High probability prediction */
  high_probability_detected: InsiderPredictionResult;
  /** Batch prediction completed */
  batch_completed: BatchPredictionResult;
  /** Prediction verified */
  prediction_verified: {
    predictionId: string;
    predicted: number;
    actual: "INSIDER" | "NOT_INSIDER";
    correct: boolean;
  };
  /** Model metrics updated */
  metrics_updated: ModelAccuracyMetrics;
  /** Cache hit */
  cache_hit: { walletAddress: string; marketId: string };
  /** Cache miss */
  cache_miss: { walletAddress: string; marketId: string };
  /** Error */
  error: { message: string; walletAddress?: string; marketId?: string };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default feature definitions
 */
export const DEFAULT_INSIDER_FEATURES: InsiderFeatureDefinition[] = [
  // Wallet Behavior Features
  {
    name: "wallet_age_days",
    category: InsiderSignalCategory.WALLET_BEHAVIOR,
    weight: 0.08,
    description: "Age of wallet since first transaction",
    higherIsSuspicious: false,
    suspicionThreshold: 0.3, // Less than ~30 days is suspicious
    required: false,
  },
  {
    name: "first_trade_large",
    category: InsiderSignalCategory.WALLET_BEHAVIOR,
    weight: 0.06,
    description: "First trade was unusually large",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "funded_before_trading",
    category: InsiderSignalCategory.WALLET_BEHAVIOR,
    weight: 0.07,
    description: "Wallet funded immediately before trading",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "in_wallet_cluster",
    category: InsiderSignalCategory.WALLET_BEHAVIOR,
    weight: 0.08,
    description: "Part of suspected wallet cluster",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "sybil_risk_score",
    category: InsiderSignalCategory.WALLET_BEHAVIOR,
    weight: 0.07,
    description: "Sybil attack risk score",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },

  // Timing Features
  {
    name: "traded_before_event",
    category: InsiderSignalCategory.TIMING,
    weight: 0.12,
    description: "Trade occurred before major event/news",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "precise_timing_suspicious",
    category: InsiderSignalCategory.TIMING,
    weight: 0.08,
    description: "Suspiciously precise trade timing",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "last_24h_trade_ratio",
    category: InsiderSignalCategory.TIMING,
    weight: 0.06,
    description: "Ratio of trades in last 24h before resolution",
    higherIsSuspicious: true,
    suspicionThreshold: 0.7,
    required: false,
  },

  // Market Selection Features
  {
    name: "is_niche_market",
    category: InsiderSignalCategory.MARKET_SELECTION,
    weight: 0.05,
    description: "Trading in niche market",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "info_advantage_market_ratio",
    category: InsiderSignalCategory.MARKET_SELECTION,
    weight: 0.07,
    description: "Ratio of trades in info-advantage markets",
    higherIsSuspicious: true,
    suspicionThreshold: 0.6,
    required: false,
  },
  {
    name: "category_concentration",
    category: InsiderSignalCategory.MARKET_SELECTION,
    weight: 0.04,
    description: "Concentration of trades in one category",
    higherIsSuspicious: true,
    suspicionThreshold: 0.7,
    required: false,
  },

  // Trading Pattern Features
  {
    name: "position_size_ratio",
    category: InsiderSignalCategory.TRADING_PATTERN,
    weight: 0.06,
    description: "Position size vs wallet average",
    higherIsSuspicious: true,
    suspicionThreshold: 0.7,
    required: false,
  },
  {
    name: "against_consensus",
    category: InsiderSignalCategory.TRADING_PATTERN,
    weight: 0.04,
    description: "Trading against market consensus",
    higherIsSuspicious: false, // Being contrarian alone isn't suspicious
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "entry_at_extreme_price",
    category: InsiderSignalCategory.TRADING_PATTERN,
    weight: 0.05,
    description: "Entry at extreme price levels",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },

  // Performance Features
  {
    name: "win_rate",
    category: InsiderSignalCategory.PERFORMANCE,
    weight: 0.10,
    description: "Historical win rate",
    higherIsSuspicious: true,
    suspicionThreshold: 0.7, // >70% win rate is suspicious
    required: false,
  },
  {
    name: "category_win_rate",
    category: InsiderSignalCategory.PERFORMANCE,
    weight: 0.08,
    description: "Win rate in this market category",
    higherIsSuspicious: true,
    suspicionThreshold: 0.75,
    required: false,
  },
  {
    name: "win_rate_z_score",
    category: InsiderSignalCategory.PERFORMANCE,
    weight: 0.09,
    description: "Statistical significance of win rate",
    higherIsSuspicious: true,
    suspicionThreshold: 0.6, // Z-score > 1.5 normalized
    required: false,
  },
  {
    name: "max_consecutive_wins",
    category: InsiderSignalCategory.PERFORMANCE,
    weight: 0.05,
    description: "Maximum consecutive winning trades",
    higherIsSuspicious: true,
    suspicionThreshold: 0.7,
    required: false,
  },

  // Network Features
  {
    name: "coordination_score",
    category: InsiderSignalCategory.NETWORK,
    weight: 0.07,
    description: "Coordination with other wallets",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "same_direction_as_cluster",
    category: InsiderSignalCategory.NETWORK,
    weight: 0.05,
    description: "Same trading direction as cluster",
    higherIsSuspicious: true,
    suspicionThreshold: 0.5,
    required: false,
  },
  {
    name: "entry_timing_correlation",
    category: InsiderSignalCategory.NETWORK,
    weight: 0.06,
    description: "Entry timing correlated with cluster",
    higherIsSuspicious: true,
    suspicionThreshold: 0.6,
    required: false,
  },
];

/**
 * Default configuration
 */
export const DEFAULT_PREDICTOR_CONFIG: InsiderPredictorConfig = {
  flagThreshold: 0.6,
  minConfidence: InsiderConfidenceLevel.LOW,
  calibration: {
    method: CalibrationMethod.PLATT,
    plattA: -1.0,
    plattB: 0.0,
    temperature: 1.0,
  },
  featureWeights: Object.fromEntries(
    DEFAULT_INSIDER_FEATURES.map((f) => [f.name, f.weight])
  ),
  cacheEnabled: true,
  cacheTtlMs: 10 * 60 * 1000, // 10 minutes
  cacheMaxSize: 5000,
  enableVerification: true,
  verificationLookbackDays: 30,
};

/**
 * Confidence level thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  veryLow: 0.2,
  low: 0.4,
  medium: 0.6,
  high: 0.8,
  veryHigh: 0.95,
};

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: InsiderPredictionResult;
  expiresAt: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Insider Probability Predictor
 *
 * Predicts the probability that trading activity is insider-related
 * using a multi-signal approach with calibrated outputs.
 */
export class InsiderProbabilityPredictor extends EventEmitter {
  private config: InsiderPredictorConfig;
  private featureDefinitions: InsiderFeatureDefinition[];
  private predictionCache: Map<string, CacheEntry>;
  private predictions: Map<string, InsiderPredictionResult>;
  private metrics: ModelAccuracyMetrics;
  private predictionCount: number;
  private flaggedCount: number;
  private cacheHits: number;
  private cacheMisses: number;

  constructor(config: Partial<InsiderPredictorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PREDICTOR_CONFIG, ...config };
    this.featureDefinitions = [...DEFAULT_INSIDER_FEATURES];
    this.predictionCache = new Map();
    this.predictions = new Map();
    this.metrics = this.initializeMetrics();
    this.predictionCount = 0;
    this.flaggedCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Initialize empty metrics
   */
  private initializeMetrics(): ModelAccuracyMetrics {
    return {
      totalPredictions: 0,
      verifiedPredictions: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      aucRoc: 0.5,
      brierScore: 0.25,
      expectedCalibrationError: 0,
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): InsiderPredictorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InsiderPredictorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get feature definitions
   */
  getFeatureDefinitions(): InsiderFeatureDefinition[] {
    return [...this.featureDefinitions];
  }

  /**
   * Update feature definitions
   */
  setFeatureDefinitions(definitions: InsiderFeatureDefinition[]): void {
    this.featureDefinitions = [...definitions];
    // Update config weights
    this.config.featureWeights = Object.fromEntries(
      definitions.map((f) => [f.name, f.weight])
    );
  }

  /**
   * Update a single feature weight
   */
  updateFeatureWeight(featureName: string, weight: number): void {
    const feature = this.featureDefinitions.find((f) => f.name === featureName);
    if (feature) {
      feature.weight = weight;
      this.config.featureWeights[featureName] = weight;
    }
  }

  /**
   * Set calibration parameters
   */
  setCalibration(params: CalibrationParameters): void {
    this.config.calibration = { ...params };
  }

  // ============================================================================
  // Feature Extraction
  // ============================================================================

  /**
   * Extract features from a complete feature set
   */
  extractFeatures(featureSet: InsiderFeatureSet): Record<string, number> {
    const features: Record<string, number> = {};

    // Wallet behavior features
    features.wallet_age_days = this.normalizeWalletAge(
      featureSet.walletBehavior.walletAgeDays
    );
    features.first_trade_large = featureSet.walletBehavior.firstTradeLarge ? 1 : 0;
    features.funded_before_trading = featureSet.walletBehavior.fundedBeforeTrading
      ? 1
      : 0;
    features.in_wallet_cluster = featureSet.walletBehavior.inWalletCluster ? 1 : 0;
    features.sybil_risk_score = featureSet.walletBehavior.sybilRiskScore / 100;

    // Timing features
    features.traded_before_event = featureSet.timing.tradedBeforeEvent ? 1 : 0;
    features.precise_timing_suspicious = featureSet.timing.preciseTimingSuspicious
      ? 1
      : 0;
    features.last_24h_trade_ratio = featureSet.timing.last24HoursTradeRatio;

    // Market selection features
    features.is_niche_market = featureSet.marketSelection.isNicheMarket ? 1 : 0;
    features.info_advantage_market_ratio =
      featureSet.marketSelection.infoAdvantageMarketRatio;
    features.category_concentration =
      featureSet.marketSelection.categoryConcentration;

    // Trading pattern features
    features.position_size_ratio = Math.min(
      featureSet.tradingPattern.positionSizeRatio / 5,
      1
    ); // Cap at 5x
    features.against_consensus = featureSet.tradingPattern.againstConsensus ? 1 : 0;
    features.entry_at_extreme_price = featureSet.tradingPattern.entryAtExtremePrice
      ? 1
      : 0;

    // Performance features
    features.win_rate = featureSet.performance.winRate;
    features.category_win_rate = featureSet.performance.categoryWinRate;
    features.win_rate_z_score = this.normalizeZScore(
      featureSet.performance.winRateZScore
    );
    features.max_consecutive_wins = this.normalizeConsecutiveWins(
      featureSet.performance.maxConsecutiveWins
    );

    // Network features
    features.coordination_score = featureSet.network.coordinationScore / 100;
    features.same_direction_as_cluster = featureSet.network.sameDirectionAsCluster
      ? 1
      : 0;
    features.entry_timing_correlation =
      featureSet.network.entryTimingCorrelation;

    return features;
  }

  /**
   * Normalize wallet age to 0-1 (inverted - younger is more suspicious)
   */
  private normalizeWalletAge(days: number): number {
    // 0 days = 1.0 (most suspicious)
    // 365+ days = 0.0 (least suspicious)
    return Math.max(0, 1 - days / 365);
  }

  /**
   * Normalize Z-score to 0-1
   */
  private normalizeZScore(zScore: number): number {
    // Z-score of 0 = 0.5
    // Z-score of 3+ = 1.0
    // Z-score of -3 = 0.0
    return Math.min(1, Math.max(0, (zScore + 3) / 6));
  }

  /**
   * Normalize consecutive wins to 0-1
   */
  private normalizeConsecutiveWins(wins: number): number {
    // 0 wins = 0.0
    // 10+ wins = 1.0 (very suspicious)
    return Math.min(1, wins / 10);
  }

  // ============================================================================
  // Prediction
  // ============================================================================

  /**
   * Get cache key for a prediction
   */
  private getCacheKey(walletAddress: string, marketId: string): string {
    return `${walletAddress}:${marketId}`;
  }

  /**
   * Check cache for existing prediction
   */
  private checkCache(cacheKey: string): InsiderPredictionResult | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    const entry = this.predictionCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.predictionCache.delete(cacheKey);
      return null;
    }

    return entry.result;
  }

  /**
   * Store prediction in cache
   */
  private storeInCache(cacheKey: string, result: InsiderPredictionResult): void {
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

    this.predictionCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Calculate raw prediction score
   */
  private calculateRawScore(features: Record<string, number>): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const definition of this.featureDefinitions) {
      const value = features[definition.name];
      if (value === undefined || value === null) {
        continue;
      }

      const weight = this.config.featureWeights[definition.name] ?? definition.weight;
      totalWeight += weight;

      // Adjust value based on whether higher is suspicious
      const adjustedValue = definition.higherIsSuspicious ? value : 1 - value;
      weightedSum += adjustedValue * weight;
    }

    if (totalWeight === 0) {
      return 0.5; // No features, return uncertain
    }

    return weightedSum / totalWeight;
  }

  /**
   * Apply calibration to raw score
   */
  private calibrate(rawScore: number): number {
    const { calibration } = this.config;

    switch (calibration.method) {
      case CalibrationMethod.PLATT:
        return this.plattScaling(
          rawScore,
          calibration.plattA ?? -1,
          calibration.plattB ?? 0
        );

      case CalibrationMethod.TEMPERATURE:
        return this.temperatureScaling(rawScore, calibration.temperature ?? 1);

      case CalibrationMethod.BETA:
        return this.betaCalibration(
          rawScore,
          calibration.betaA ?? 1,
          calibration.betaB ?? 1
        );

      case CalibrationMethod.ISOTONIC:
        return this.isotonicCalibration(
          rawScore,
          calibration.isotonicPoints ?? []
        );

      case CalibrationMethod.NONE:
      default:
        return rawScore;
    }
  }

  /**
   * Platt scaling (sigmoid calibration)
   */
  private plattScaling(score: number, a: number, b: number): number {
    return 1 / (1 + Math.exp(a * score + b));
  }

  /**
   * Temperature scaling
   */
  private temperatureScaling(score: number, temperature: number): number {
    // Apply temperature to logit
    const logit = Math.log(score / (1 - score + 1e-10));
    const scaledLogit = logit / temperature;
    return 1 / (1 + Math.exp(-scaledLogit));
  }

  /**
   * Beta calibration
   */
  private betaCalibration(score: number, a: number, b: number): number {
    // Simplified beta calibration
    return Math.pow(score, a) / (Math.pow(score, a) + Math.pow(1 - score, b));
  }

  /**
   * Isotonic calibration (piecewise linear)
   */
  private isotonicCalibration(
    score: number,
    points: Array<{ input: number; output: number }>
  ): number {
    if (points.length === 0) {
      return score;
    }

    // Sort points by input
    const sorted = [...points].sort((a, b) => a.input - b.input);

    // Handle edge case with single point
    if (sorted.length === 1) {
      return sorted[0]!.output;
    }

    // Find surrounding points
    let lower = sorted[0]!;
    let upper = sorted[sorted.length - 1]!;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i]!.input <= score && sorted[i + 1]!.input >= score) {
        lower = sorted[i]!;
        upper = sorted[i + 1]!;
        break;
      }
    }

    // Linear interpolation
    if (lower.input === upper.input) {
      return lower.output;
    }

    const ratio = (score - lower.input) / (upper.input - lower.input);
    return lower.output + ratio * (upper.output - lower.output);
  }

  /**
   * Calculate confidence level based on feature availability
   */
  private calculateConfidence(features: Record<string, number>): {
    level: InsiderConfidenceLevel;
    score: number;
  } {
    let availableFeatures = 0;
    let totalWeight = 0;
    let availableWeight = 0;

    for (const definition of this.featureDefinitions) {
      const weight = this.config.featureWeights[definition.name] ?? definition.weight;
      totalWeight += weight;

      if (features[definition.name] !== undefined && features[definition.name] !== null) {
        availableFeatures++;
        availableWeight += weight;
      }
    }

    const featureRatio = availableFeatures / this.featureDefinitions.length;
    const weightRatio = totalWeight > 0 ? availableWeight / totalWeight : 0;

    // Confidence score is average of feature count ratio and weight ratio
    const score = (featureRatio + weightRatio) / 2;

    // Map to confidence level
    let level: InsiderConfidenceLevel;
    if (score < CONFIDENCE_THRESHOLDS.veryLow) {
      level = InsiderConfidenceLevel.VERY_LOW;
    } else if (score < CONFIDENCE_THRESHOLDS.low) {
      level = InsiderConfidenceLevel.LOW;
    } else if (score < CONFIDENCE_THRESHOLDS.medium) {
      level = InsiderConfidenceLevel.MEDIUM;
    } else if (score < CONFIDENCE_THRESHOLDS.high) {
      level = InsiderConfidenceLevel.HIGH;
    } else {
      level = InsiderConfidenceLevel.VERY_HIGH;
    }

    return { level, score };
  }

  /**
   * Get signal contributions for explanation
   */
  private getSignalContributions(
    features: Record<string, number>
  ): SignalContribution[] {
    const contributions: SignalContribution[] = [];

    for (const definition of this.featureDefinitions) {
      const value = features[definition.name];
      if (value === undefined || value === null) {
        continue;
      }

      const weight = this.config.featureWeights[definition.name] ?? definition.weight;
      const adjustedValue = definition.higherIsSuspicious ? value : 1 - value;
      const contribution = adjustedValue * weight;
      const isSuspicious = adjustedValue >= definition.suspicionThreshold;

      contributions.push({
        name: definition.name,
        category: definition.category,
        value,
        normalizedValue: adjustedValue,
        weight,
        contribution,
        description: definition.description,
        isSuspicious,
      });
    }

    return contributions.sort((a, b) => b.contribution - a.contribution);
  }

  /**
   * Generate risk assessment summary
   */
  private generateRiskAssessment(
    probability: number,
    topFactors: SignalContribution[]
  ): string {
    let assessment = "";

    if (probability >= 0.8) {
      assessment = "CRITICAL: Very high probability of insider trading activity. ";
    } else if (probability >= 0.6) {
      assessment = "HIGH: Significant indicators of potential insider activity. ";
    } else if (probability >= 0.4) {
      assessment = "MODERATE: Some concerning patterns detected. ";
    } else if (probability >= 0.2) {
      assessment = "LOW: Minor suspicious indicators present. ";
    } else {
      assessment = "MINIMAL: Trading pattern appears normal. ";
    }

    if (topFactors.length > 0) {
      const topSuspicious = topFactors.filter((f) => f.isSuspicious).slice(0, 3);
      if (topSuspicious.length > 0) {
        assessment +=
          "Key concerns: " +
          topSuspicious.map((f) => f.description).join("; ") +
          ".";
      }
    }

    return assessment;
  }

  /**
   * Generate recommended actions based on probability
   */
  private generateRecommendedActions(
    probability: number,
    confidence: InsiderConfidenceLevel
  ): string[] {
    const actions: string[] = [];

    if (probability >= 0.8) {
      actions.push("Immediately flag for manual review");
      actions.push("Cross-reference with other wallets in cluster");
      actions.push("Monitor for additional suspicious activity");
      actions.push("Consider reporting to platform compliance");
    } else if (probability >= 0.6) {
      actions.push("Add to high-priority watchlist");
      actions.push("Track future trading activity");
      actions.push("Analyze connected wallet network");
      actions.push("Review historical trading patterns");
    } else if (probability >= 0.4) {
      actions.push("Add to monitoring list");
      actions.push("Continue collecting behavioral data");
      actions.push("Re-evaluate after market resolution");
    } else if (probability >= 0.2) {
      actions.push("Log for pattern analysis");
      actions.push("No immediate action required");
    } else {
      actions.push("No action required");
    }

    if (confidence === InsiderConfidenceLevel.VERY_LOW) {
      actions.push("Note: Low confidence due to limited data");
    }

    return actions;
  }

  /**
   * Make a prediction for a single activity
   */
  predict(featureSet: InsiderFeatureSet): InsiderPredictionResult {
    const startTime = Date.now();

    const { walletAddress, marketId } = featureSet.activity;
    const cacheKey = this.getCacheKey(walletAddress, marketId);

    // Check cache
    const cached = this.checkCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      this.emit("cache_hit", { walletAddress, marketId });
      return cached;
    }
    this.cacheMisses++;
    this.emit("cache_miss", { walletAddress, marketId });

    // Extract features
    const features = this.extractFeatures(featureSet);

    // Calculate raw score
    const rawScore = this.calculateRawScore(features);

    // Calibrate
    const probability = this.calibrate(rawScore);

    // Calculate confidence
    const { level: confidence, score: confidenceScore } =
      this.calculateConfidence(features);

    // Get signal contributions
    const signals = this.getSignalContributions(features);
    const topFactors = signals.slice(0, 5);

    // Generate assessments
    const riskAssessment = this.generateRiskAssessment(probability, topFactors);
    const recommendedActions = this.generateRecommendedActions(
      probability,
      confidence
    );

    const processingTimeMs = Date.now() - startTime;

    const result: InsiderPredictionResult = {
      predictionId: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      walletAddress,
      marketId,
      rawScore,
      probability,
      confidence,
      confidenceScore,
      signals,
      topFactors,
      riskAssessment,
      recommendedActions,
      status: PredictionStatus.PENDING,
      predictedAt: new Date(),
      processingTimeMs,
    };

    // Store prediction
    this.predictions.set(result.predictionId, result);
    this.predictionCount++;

    // Update counts
    if (probability >= this.config.flagThreshold) {
      this.flaggedCount++;
    }

    // Cache result
    this.storeInCache(cacheKey, result);

    // Emit events
    this.emit("prediction_made", result);
    if (probability >= this.config.flagThreshold) {
      this.emit("high_probability_detected", result);
    }

    return result;
  }

  /**
   * Make predictions for multiple activities
   */
  predictBatch(featureSets: InsiderFeatureSet[]): BatchPredictionResult {
    const startTime = Date.now();

    const results: InsiderPredictionResult[] = [];
    let totalProbability = 0;
    let flaggedCount = 0;

    const distribution: ProbabilityDistribution = {
      veryUnlikely: 0,
      unlikely: 0,
      uncertain: 0,
      likely: 0,
      veryLikely: 0,
    };

    for (const featureSet of featureSets) {
      const result = this.predict(featureSet);
      results.push(result);
      totalProbability += result.probability;

      if (result.probability >= this.config.flagThreshold) {
        flaggedCount++;
      }

      // Update distribution
      if (result.probability < 0.2) {
        distribution.veryUnlikely++;
      } else if (result.probability < 0.4) {
        distribution.unlikely++;
      } else if (result.probability < 0.6) {
        distribution.uncertain++;
      } else if (result.probability < 0.8) {
        distribution.likely++;
      } else {
        distribution.veryLikely++;
      }
    }

    const processingTimeMs = Date.now() - startTime;

    const batchResult: BatchPredictionResult = {
      totalPredicted: results.length,
      flaggedCount,
      results,
      averageProbability: results.length > 0 ? totalProbability / results.length : 0,
      distribution,
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
    actualOutcome: "INSIDER" | "NOT_INSIDER"
  ): boolean {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      return false;
    }

    // Update prediction
    prediction.status = PredictionStatus.VERIFIED;
    prediction.verifiedAt = new Date();
    prediction.actualOutcome = actualOutcome;

    // Update metrics
    const predicted =
      prediction.probability >= this.config.flagThreshold
        ? "INSIDER"
        : "NOT_INSIDER";
    const correct = predicted === actualOutcome;

    this.metrics.verifiedPredictions++;

    if (predicted === "INSIDER" && actualOutcome === "INSIDER") {
      this.metrics.truePositives++;
    } else if (predicted === "NOT_INSIDER" && actualOutcome === "NOT_INSIDER") {
      this.metrics.trueNegatives++;
    } else if (predicted === "INSIDER" && actualOutcome === "NOT_INSIDER") {
      this.metrics.falsePositives++;
    } else {
      this.metrics.falseNegatives++;
    }

    // Recalculate derived metrics
    this.updateDerivedMetrics();

    // Update Brier score
    const actualBinary = actualOutcome === "INSIDER" ? 1 : 0;
    const brierContribution = Math.pow(prediction.probability - actualBinary, 2);
    this.metrics.brierScore =
      (this.metrics.brierScore * (this.metrics.verifiedPredictions - 1) +
        brierContribution) /
      this.metrics.verifiedPredictions;

    this.metrics.lastUpdated = new Date();

    this.emit("prediction_verified", {
      predictionId,
      predicted: prediction.probability,
      actual: actualOutcome,
      correct,
    });

    this.emit("metrics_updated", this.metrics);

    return correct;
  }

  /**
   * Update derived metrics (precision, recall, F1, etc.)
   */
  private updateDerivedMetrics(): void {
    const { truePositives, falsePositives, falseNegatives } = this.metrics;

    // Precision
    const precisionDenom = truePositives + falsePositives;
    this.metrics.precision =
      precisionDenom > 0 ? truePositives / precisionDenom : 0;

    // Recall
    const recallDenom = truePositives + falseNegatives;
    this.metrics.recall = recallDenom > 0 ? truePositives / recallDenom : 0;

    // F1 Score
    const f1Denom = this.metrics.precision + this.metrics.recall;
    this.metrics.f1Score =
      f1Denom > 0
        ? (2 * this.metrics.precision * this.metrics.recall) / f1Denom
        : 0;
  }

  // ============================================================================
  // Statistics and Metrics
  // ============================================================================

  /**
   * Get model accuracy metrics
   */
  getMetrics(): ModelAccuracyMetrics {
    return { ...this.metrics };
  }

  /**
   * Get prediction statistics
   */
  getStatistics(): {
    totalPredictions: number;
    flaggedCount: number;
    flagRate: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    pendingVerifications: number;
  } {
    const pendingVerifications = Array.from(this.predictions.values()).filter(
      (p) => p.status === PredictionStatus.PENDING
    ).length;

    return {
      totalPredictions: this.predictionCount,
      flaggedCount: this.flaggedCount,
      flagRate:
        this.predictionCount > 0 ? this.flaggedCount / this.predictionCount : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? this.cacheHits / (this.cacheHits + this.cacheMisses)
          : 0,
      pendingVerifications,
    };
  }

  /**
   * Get a prediction by ID
   */
  getPrediction(predictionId: string): InsiderPredictionResult | undefined {
    return this.predictions.get(predictionId);
  }

  /**
   * Get all predictions for a wallet
   */
  getPredictionsForWallet(walletAddress: string): InsiderPredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.walletAddress === walletAddress
    );
  }

  /**
   * Get all predictions for a market
   */
  getPredictionsForMarket(marketId: string): InsiderPredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.marketId === marketId
    );
  }

  /**
   * Get flagged predictions
   */
  getFlaggedPredictions(): InsiderPredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.probability >= this.config.flagThreshold
    );
  }

  /**
   * Get pending verifications
   */
  getPendingVerifications(): InsiderPredictionResult[] {
    return Array.from(this.predictions.values()).filter(
      (p) => p.status === PredictionStatus.PENDING
    );
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
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
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
    this.predictionCache.clear();
    this.predictions.clear();
    this.metrics = this.initializeMetrics();
    this.predictionCount = 0;
    this.flaggedCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedPredictor: InsiderProbabilityPredictor | null = null;

/**
 * Create a new insider probability predictor
 */
export function createInsiderProbabilityPredictor(
  config?: Partial<InsiderPredictorConfig>
): InsiderProbabilityPredictor {
  return new InsiderProbabilityPredictor(config);
}

/**
 * Get the shared insider probability predictor instance
 */
export function getSharedInsiderProbabilityPredictor(): InsiderProbabilityPredictor {
  if (!sharedPredictor) {
    sharedPredictor = new InsiderProbabilityPredictor();
  }
  return sharedPredictor;
}

/**
 * Set the shared insider probability predictor instance
 */
export function setSharedInsiderProbabilityPredictor(
  predictor: InsiderProbabilityPredictor
): void {
  sharedPredictor = predictor;
}

/**
 * Reset the shared insider probability predictor instance
 */
export function resetSharedInsiderProbabilityPredictor(): void {
  if (sharedPredictor) {
    sharedPredictor.reset();
  }
  sharedPredictor = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get confidence level description
 */
export function getConfidenceLevelDescription(
  level: InsiderConfidenceLevel
): string {
  const descriptions: Record<InsiderConfidenceLevel, string> = {
    [InsiderConfidenceLevel.VERY_LOW]:
      "Very low confidence - insufficient data for reliable prediction",
    [InsiderConfidenceLevel.LOW]:
      "Low confidence - limited data available, prediction may be unreliable",
    [InsiderConfidenceLevel.MEDIUM]:
      "Medium confidence - reasonable amount of data, prediction is moderately reliable",
    [InsiderConfidenceLevel.HIGH]:
      "High confidence - sufficient data for reliable prediction",
    [InsiderConfidenceLevel.VERY_HIGH]:
      "Very high confidence - comprehensive data, prediction is highly reliable",
  };
  return descriptions[level];
}

/**
 * Get confidence level color for UI display
 */
export function getConfidenceLevelColor(level: InsiderConfidenceLevel): string {
  const colors: Record<InsiderConfidenceLevel, string> = {
    [InsiderConfidenceLevel.VERY_LOW]: "#9CA3AF", // gray
    [InsiderConfidenceLevel.LOW]: "#FCD34D", // yellow
    [InsiderConfidenceLevel.MEDIUM]: "#60A5FA", // blue
    [InsiderConfidenceLevel.HIGH]: "#34D399", // green
    [InsiderConfidenceLevel.VERY_HIGH]: "#10B981", // emerald
  };
  return colors[level];
}

/**
 * Get signal category description
 */
export function getSignalCategoryDescription(
  category: InsiderSignalCategory
): string {
  const descriptions: Record<InsiderSignalCategory, string> = {
    [InsiderSignalCategory.WALLET_BEHAVIOR]:
      "Wallet age, history, and funding patterns",
    [InsiderSignalCategory.TIMING]:
      "Trade timing relative to events and market resolution",
    [InsiderSignalCategory.MARKET_SELECTION]:
      "Choice of markets and categories traded",
    [InsiderSignalCategory.TRADING_PATTERN]:
      "Position sizing, direction, and entry/exit patterns",
    [InsiderSignalCategory.PERFORMANCE]:
      "Historical win rates and profit metrics",
    [InsiderSignalCategory.NETWORK]:
      "Coordination with other wallets and cluster behavior",
  };
  return descriptions[category];
}

/**
 * Format probability for display
 */
export function formatProbability(probability: number, decimals: number = 1): string {
  return `${(probability * 100).toFixed(decimals)}%`;
}

/**
 * Get probability level description
 */
export function getProbabilityLevelDescription(probability: number): string {
  if (probability >= 0.8) {
    return "Very Likely Insider";
  } else if (probability >= 0.6) {
    return "Likely Insider";
  } else if (probability >= 0.4) {
    return "Uncertain";
  } else if (probability >= 0.2) {
    return "Unlikely Insider";
  } else {
    return "Very Unlikely Insider";
  }
}

/**
 * Get probability level color for UI display
 */
export function getProbabilityLevelColor(probability: number): string {
  if (probability >= 0.8) {
    return "#EF4444"; // red
  } else if (probability >= 0.6) {
    return "#F97316"; // orange
  } else if (probability >= 0.4) {
    return "#FCD34D"; // yellow
  } else if (probability >= 0.2) {
    return "#6EE7B7"; // light green
  } else {
    return "#10B981"; // green
  }
}

/**
 * Get calibration method description
 */
export function getCalibrationMethodDescription(
  method: CalibrationMethod
): string {
  const descriptions: Record<CalibrationMethod, string> = {
    [CalibrationMethod.PLATT]:
      "Platt scaling (sigmoid) - best for well-separated classes",
    [CalibrationMethod.ISOTONIC]:
      "Isotonic regression - non-parametric, handles any distribution",
    [CalibrationMethod.BETA]:
      "Beta calibration - handles asymmetric distributions",
    [CalibrationMethod.TEMPERATURE]:
      "Temperature scaling - simple and effective for neural networks",
    [CalibrationMethod.NONE]: "No calibration - raw probability scores",
  };
  return descriptions[method];
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate a random hex address (40 characters)
 */
function generateRandomAddress(): string {
  let address = "";
  for (let i = 0; i < 40; i++) {
    address += Math.floor(Math.random() * 16).toString(16);
  }
  return `0x${address}`;
}

/**
 * Create mock wallet activity data
 */
export function createMockWalletActivityData(
  overrides: Partial<WalletActivityData> = {}
): WalletActivityData {
  return {
    walletAddress: generateRandomAddress(),
    marketId: `market_${Math.random().toString(36).substr(2, 6)}`,
    positionSizeUsd: Math.random() * 50000,
    positionSide: Math.random() > 0.5 ? "LONG" : "SHORT",
    entryPrice: Math.random(),
    entryTimestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    hoursUntilResolutionAtEntry: Math.random() > 0.2 ? Math.random() * 168 : null,
    ...overrides,
  };
}

/**
 * Create mock wallet behavior features
 */
export function createMockWalletBehaviorFeatures(
  overrides: Partial<WalletBehaviorFeatures> = {}
): WalletBehaviorFeatures {
  return {
    walletAgeDays: Math.floor(Math.random() * 365),
    totalTrades: Math.floor(Math.random() * 1000),
    polymarketTrades: Math.floor(Math.random() * 500),
    firstTradeLarge: Math.random() > 0.8,
    fundedBeforeTrading: Math.random() > 0.7,
    daysBetweenFundingAndTrade: Math.random() * 30,
    fundingSourceKnown: Math.random() > 0.3,
    fundedFromExchange: Math.random() > 0.5,
    inWalletCluster: Math.random() > 0.8,
    clusterSize: Math.floor(Math.random() * 10),
    sybilRiskScore: Math.random() * 50,
    ...overrides,
  };
}

/**
 * Create mock timing features
 */
export function createMockTimingFeatures(
  overrides: Partial<TimingFeatures> = {}
): TimingFeatures {
  return {
    tradedOffHours: Math.random() > 0.8,
    tradedBeforeEvent: Math.random() > 0.9,
    hoursBeforeEvent: Math.random() > 0.5 ? Math.random() * 48 : null,
    preciseTimingSuspicious: Math.random() > 0.9,
    timingConsistencyScore: Math.random(),
    last24HoursTradeRatio: Math.random() * 0.5,
    avgHoldTimeHours: Math.random() * 168,
    ...overrides,
  };
}

/**
 * Create mock market selection features
 */
export function createMockMarketSelectionFeatures(
  overrides: Partial<MarketSelectionFeatures> = {}
): MarketSelectionFeatures {
  const categories = ["POLITICS", "CRYPTO", "SPORTS", "ENTERTAINMENT", "SCIENCE"];
  const category =
    categories[Math.floor(Math.random() * categories.length)] || "OTHER";

  return {
    marketCategory: category,
    isNicheMarket: Math.random() > 0.7,
    isPoliticalMarket: category === "POLITICS",
    isRegulatoryMarket: Math.random() > 0.9,
    isGeopoliticalMarket: Math.random() > 0.85,
    marketLiquidityUsd: Math.random() * 1000000,
    marketDailyVolumeUsd: Math.random() * 100000,
    categoryConcentration: Math.random(),
    infoAdvantageMarketRatio: Math.random() * 0.5,
    ...overrides,
  };
}

/**
 * Create mock trading pattern features
 */
export function createMockTradingPatternFeatures(
  overrides: Partial<TradingPatternFeatures> = {}
): TradingPatternFeatures {
  return {
    positionSizeRatio: 0.5 + Math.random() * 3,
    tradeSizePercentile: Math.random(),
    againstConsensus: Math.random() > 0.7,
    directionChangedNearResolution: Math.random() > 0.9,
    entryAtExtremePrice: Math.random() > 0.85,
    multipleEntriesSameDirection: Math.floor(Math.random() * 5),
    exitedBeforeResolution: Math.random() > 0.5,
    ...overrides,
  };
}

/**
 * Create mock performance features
 */
export function createMockPerformanceFeatures(
  overrides: Partial<PerformanceFeatures> = {}
): PerformanceFeatures {
  const winRate = 0.4 + Math.random() * 0.4;
  return {
    winRate,
    categoryWinRate: winRate + (Math.random() - 0.5) * 0.2,
    nicheMarketWinRate: winRate + (Math.random() - 0.5) * 0.3,
    profitFactor: 0.5 + Math.random() * 2.5,
    maxConsecutiveWins: Math.floor(Math.random() * 10),
    currentWinStreak: Math.floor(Math.random() * 5),
    avgWinAmount: Math.random() * 5000,
    winRateZScore: (Math.random() - 0.5) * 4,
    ...overrides,
  };
}

/**
 * Create mock network features
 */
export function createMockNetworkFeatures(
  overrides: Partial<NetworkFeatures> = {}
): NetworkFeatures {
  return {
    coordinationScore: Math.random() * 50,
    correlatedWalletCount: Math.floor(Math.random() * 5),
    sameDirectionAsCluster: Math.random() > 0.6,
    entryTimingCorrelation: Math.random(),
    sharedFundingSources: Math.floor(Math.random() * 3),
    ...overrides,
  };
}

/**
 * Create a complete mock insider feature set
 */
export function createMockInsiderFeatureSet(
  overrides: Partial<InsiderFeatureSet> = {}
): InsiderFeatureSet {
  const activity = overrides.activity || createMockWalletActivityData();

  return {
    activity,
    walletBehavior:
      overrides.walletBehavior || createMockWalletBehaviorFeatures(),
    timing: overrides.timing || createMockTimingFeatures(),
    marketSelection:
      overrides.marketSelection || createMockMarketSelectionFeatures(),
    tradingPattern:
      overrides.tradingPattern || createMockTradingPatternFeatures(),
    performance: overrides.performance || createMockPerformanceFeatures(),
    network: overrides.network || createMockNetworkFeatures(),
  };
}

/**
 * Create a batch of mock insider feature sets
 */
export function createMockInsiderFeatureSetBatch(
  count: number,
  overrides: Partial<InsiderFeatureSet> = {}
): InsiderFeatureSet[] {
  return Array.from({ length: count }, () =>
    createMockInsiderFeatureSet(overrides)
  );
}

/**
 * Create a suspicious mock feature set (high insider probability)
 */
export function createSuspiciousMockFeatureSet(): InsiderFeatureSet {
  return createMockInsiderFeatureSet({
    walletBehavior: createMockWalletBehaviorFeatures({
      walletAgeDays: 5,
      firstTradeLarge: true,
      fundedBeforeTrading: true,
      daysBetweenFundingAndTrade: 0.5,
      inWalletCluster: true,
      clusterSize: 8,
      sybilRiskScore: 75,
    }),
    timing: createMockTimingFeatures({
      tradedBeforeEvent: true,
      hoursBeforeEvent: 12,
      preciseTimingSuspicious: true,
      last24HoursTradeRatio: 0.9,
    }),
    marketSelection: createMockMarketSelectionFeatures({
      isNicheMarket: true,
      isRegulatoryMarket: true,
      categoryConcentration: 0.95,
      infoAdvantageMarketRatio: 0.8,
    }),
    tradingPattern: createMockTradingPatternFeatures({
      positionSizeRatio: 4.5,
      tradeSizePercentile: 0.98,
      entryAtExtremePrice: true,
    }),
    performance: createMockPerformanceFeatures({
      winRate: 0.9,
      categoryWinRate: 0.95,
      nicheMarketWinRate: 0.92,
      maxConsecutiveWins: 8,
      winRateZScore: 3.5,
    }),
    network: createMockNetworkFeatures({
      coordinationScore: 85,
      correlatedWalletCount: 6,
      sameDirectionAsCluster: true,
      entryTimingCorrelation: 0.9,
    }),
  });
}

/**
 * Create a normal mock feature set (low insider probability)
 */
export function createNormalMockFeatureSet(): InsiderFeatureSet {
  return createMockInsiderFeatureSet({
    walletBehavior: createMockWalletBehaviorFeatures({
      walletAgeDays: 180,
      firstTradeLarge: false,
      fundedBeforeTrading: false,
      daysBetweenFundingAndTrade: 45,
      inWalletCluster: false,
      clusterSize: 0,
      sybilRiskScore: 5,
    }),
    timing: createMockTimingFeatures({
      tradedBeforeEvent: false,
      hoursBeforeEvent: null,
      preciseTimingSuspicious: false,
      last24HoursTradeRatio: 0.1,
    }),
    marketSelection: createMockMarketSelectionFeatures({
      isNicheMarket: false,
      isRegulatoryMarket: false,
      categoryConcentration: 0.3,
      infoAdvantageMarketRatio: 0.2,
    }),
    tradingPattern: createMockTradingPatternFeatures({
      positionSizeRatio: 1.1,
      tradeSizePercentile: 0.5,
      entryAtExtremePrice: false,
    }),
    performance: createMockPerformanceFeatures({
      winRate: 0.52,
      categoryWinRate: 0.5,
      nicheMarketWinRate: 0.48,
      maxConsecutiveWins: 3,
      winRateZScore: 0.3,
    }),
    network: createMockNetworkFeatures({
      coordinationScore: 5,
      correlatedWalletCount: 0,
      sameDirectionAsCluster: false,
      entryTimingCorrelation: 0.2,
    }),
  });
}
