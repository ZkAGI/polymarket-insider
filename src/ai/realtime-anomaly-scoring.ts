/**
 * Real-time Anomaly Scoring (AI-PAT-002)
 *
 * Score incoming trades for anomaly probability in real-time.
 * Uses trained models from the training pipeline to detect
 * suspicious trading patterns.
 *
 * Features:
 * - Load trained models for inference
 * - Extract features from trade data
 * - Run real-time inference
 * - Return anomaly scores with confidence
 * - Batch scoring support
 * - Score caching for performance
 * - Event emission for anomaly detection
 */

import { EventEmitter } from "events";
import {
  AnomalyDetectionTrainingPipeline,
  TrainedModel,
  ModelStatus,
  FeatureDefinition,
  getSharedAnomalyDetectionTrainingPipeline,
} from "./anomaly-detection-training";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Trade data for anomaly scoring
 */
export interface TradeData {
  /** Trade ID */
  id: string;
  /** Wallet address that made the trade */
  walletAddress: string;
  /** Market ID */
  marketId: string;
  /** Trade direction */
  side: "BUY" | "SELL";
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade price/probability */
  price: number;
  /** Trade timestamp */
  timestamp: Date;
  /** Outcome token */
  outcome?: string;
  /** Transaction hash */
  txHash?: string;
}

/**
 * Wallet context for feature extraction
 */
export interface WalletContext {
  /** Wallet address */
  walletAddress: string;
  /** Wallet age in days */
  walletAgeDays: number;
  /** Total number of trades */
  totalTrades: number;
  /** Number of unique markets traded */
  uniqueMarkets: number;
  /** Average trade size in USD */
  avgTradeSize: number;
  /** Trade size standard deviation */
  tradeSizeStdDev: number;
  /** Buy to sell ratio (0-1) */
  buySellRatio: number;
  /** Average holding period in hours */
  holdingPeriodAvg: number;
  /** Number of volume spikes detected */
  volumeSpikeCount: number;
  /** Number of whale-sized trades */
  whaleTradeCount: number;
  /** Total trading volume in USD */
  totalVolumeUsd: number;
  /** Ratio of trades during off-hours */
  offHoursRatio: number;
  /** Ratio of trades before events */
  preEventTradeRatio: number;
  /** Timing consistency score */
  timingConsistencyScore: number;
  /** Market concentration score */
  marketConcentration: number;
  /** Ratio of trades in niche markets */
  nicheMarketRatio: number;
  /** Ratio of trades in political markets */
  politicalMarketRatio: number;
  /** Win rate of resolved positions */
  winRate: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Maximum consecutive wins */
  maxConsecutiveWins: number;
  /** Coordination score */
  coordinationScore: number;
  /** Number of wallet clusters involved in */
  clusterMembershipCount: number;
  /** Sybil risk score */
  sybilRiskScore: number;
}

/**
 * Market context for feature extraction
 */
export interface MarketContext {
  /** Market ID */
  marketId: string;
  /** Market category */
  category: string;
  /** Is niche market */
  isNiche: boolean;
  /** Is political market */
  isPolitical: boolean;
  /** Current liquidity in USD */
  liquidityUsd: number;
  /** Average daily volume */
  avgDailyVolume: number;
  /** Time until resolution (hours) */
  hoursUntilResolution: number | null;
  /** Current probability spread */
  probabilitySpread: number;
}

/**
 * Anomaly score result
 */
export interface AnomalyScoreResult {
  /** Trade ID that was scored */
  tradeId: string;
  /** Wallet address */
  walletAddress: string;
  /** Raw anomaly score (0-1) */
  score: number;
  /** Normalized score (0-100) */
  normalizedScore: number;
  /** Whether trade is classified as anomaly */
  isAnomaly: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Risk level */
  riskLevel: AnomalyRiskLevel;
  /** Contributing factors */
  contributingFactors: ContributingFactor[];
  /** Model ID used for scoring */
  modelId: string;
  /** Scoring timestamp */
  scoredAt: Date;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Anomaly risk levels
 */
export enum AnomalyRiskLevel {
  /** No significant risk */
  NONE = "NONE",
  /** Low risk */
  LOW = "LOW",
  /** Medium risk */
  MEDIUM = "MEDIUM",
  /** High risk */
  HIGH = "HIGH",
  /** Critical risk */
  CRITICAL = "CRITICAL",
}

/**
 * Contributing factor to anomaly score
 */
export interface ContributingFactor {
  /** Factor name */
  name: string;
  /** Factor value */
  value: number;
  /** Factor weight */
  weight: number;
  /** Contribution to score */
  contribution: number;
  /** Description */
  description: string;
}

/**
 * Batch scoring result
 */
export interface BatchScoringResult {
  /** Total trades scored */
  totalScored: number;
  /** Number of anomalies detected */
  anomalyCount: number;
  /** Individual score results */
  results: AnomalyScoreResult[];
  /** Batch processing time in ms */
  processingTimeMs: number;
  /** Average score */
  averageScore: number;
  /** Score distribution */
  scoreDistribution: ScoreDistribution;
}

/**
 * Score distribution for batch results
 */
export interface ScoreDistribution {
  /** Count in [0, 0.2) range */
  veryLow: number;
  /** Count in [0.2, 0.4) range */
  low: number;
  /** Count in [0.4, 0.6) range */
  medium: number;
  /** Count in [0.6, 0.8) range */
  high: number;
  /** Count in [0.8, 1.0] range */
  veryHigh: number;
}

/**
 * Real-time scoring configuration
 */
export interface RealtimeScoringConfig {
  /** Default model ID to use for scoring */
  defaultModelId: string | null;
  /** Risk level thresholds */
  riskThresholds: RiskThresholds;
  /** Cache configuration */
  cacheConfig: CacheConfig;
  /** Feature extraction configuration */
  featureExtraction: FeatureExtractionConfig;
  /** Enable automatic alerting */
  enableAlerting: boolean;
  /** Minimum confidence for alerting */
  alertConfidenceThreshold: number;
  /** Minimum risk level for alerting */
  alertRiskThreshold: AnomalyRiskLevel;
}

/**
 * Risk level thresholds
 */
export interface RiskThresholds {
  /** Score threshold for LOW risk */
  low: number;
  /** Score threshold for MEDIUM risk */
  medium: number;
  /** Score threshold for HIGH risk */
  high: number;
  /** Score threshold for CRITICAL risk */
  critical: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable score caching */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttlMs: number;
  /** Maximum cache size */
  maxSize: number;
}

/**
 * Feature extraction configuration
 */
export interface FeatureExtractionConfig {
  /** Use wallet context if available */
  useWalletContext: boolean;
  /** Use market context if available */
  useMarketContext: boolean;
  /** Default values for missing features */
  defaultValues: Record<string, number>;
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: RealtimeScoringConfig = {
  defaultModelId: null,
  riskThresholds: {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.9,
  },
  cacheConfig: {
    enabled: true,
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxSize: 10000,
  },
  featureExtraction: {
    useWalletContext: true,
    useMarketContext: true,
    defaultValues: {},
  },
  enableAlerting: true,
  alertConfidenceThreshold: 0.7,
  alertRiskThreshold: AnomalyRiskLevel.HIGH,
};

/**
 * Scoring events
 */
export interface ScoringEvents {
  /** Trade scored */
  trade_scored: AnomalyScoreResult;
  /** Anomaly detected */
  anomaly_detected: AnomalyScoreResult;
  /** Batch scored */
  batch_scored: BatchScoringResult;
  /** Model loaded */
  model_loaded: { modelId: string };
  /** Model unloaded */
  model_unloaded: { modelId: string };
  /** Cache hit */
  cache_hit: { tradeId: string; score: number };
  /** Cache miss */
  cache_miss: { tradeId: string };
  /** Error occurred */
  error: { message: string; tradeId?: string };
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: AnomalyScoreResult;
  expiresAt: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Real-time Anomaly Scorer
 *
 * Scores incoming trades for anomaly probability using trained models.
 */
export class RealtimeAnomalyScorer extends EventEmitter {
  private config: RealtimeScoringConfig;
  private pipeline: AnomalyDetectionTrainingPipeline;
  private loadedModels: Map<string, TrainedModel>;
  private scoreCache: Map<string, CacheEntry>;
  private walletContexts: Map<string, WalletContext>;
  private marketContexts: Map<string, MarketContext>;
  private scoringCount: number;
  private anomalyCount: number;
  private cacheHits: number;
  private cacheMisses: number;

  constructor(config: Partial<RealtimeScoringConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
    this.pipeline = getSharedAnomalyDetectionTrainingPipeline();
    this.loadedModels = new Map();
    this.scoreCache = new Map();
    this.walletContexts = new Map();
    this.marketContexts = new Map();
    this.scoringCount = 0;
    this.anomalyCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get scoring configuration
   */
  getConfig(): RealtimeScoringConfig {
    return { ...this.config };
  }

  /**
   * Update scoring configuration
   */
  updateConfig(config: Partial<RealtimeScoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the training pipeline
   */
  setPipeline(pipeline: AnomalyDetectionTrainingPipeline): void {
    this.pipeline = pipeline;
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Load a trained model for scoring
   */
  loadModel(modelId: string): TrainedModel {
    const model = this.pipeline.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status !== ModelStatus.READY) {
      throw new Error(`Model is not ready: ${model.status}`);
    }

    this.loadedModels.set(modelId, model);
    this.emit("model_loaded", { modelId });
    return model;
  }

  /**
   * Unload a model from memory
   */
  unloadModel(modelId: string): boolean {
    const result = this.loadedModels.delete(modelId);
    if (result) {
      this.emit("model_unloaded", { modelId });
    }
    return result;
  }

  /**
   * Get loaded model by ID
   */
  getLoadedModel(modelId: string): TrainedModel | undefined {
    return this.loadedModels.get(modelId);
  }

  /**
   * Get all loaded models
   */
  getLoadedModels(): TrainedModel[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * Set default model for scoring
   */
  setDefaultModel(modelId: string): void {
    if (!this.loadedModels.has(modelId)) {
      this.loadModel(modelId);
    }
    this.config.defaultModelId = modelId;
  }

  // ============================================================================
  // Context Management
  // ============================================================================

  /**
   * Set wallet context for feature extraction
   */
  setWalletContext(context: WalletContext): void {
    this.walletContexts.set(context.walletAddress, context);
  }

  /**
   * Get wallet context
   */
  getWalletContext(walletAddress: string): WalletContext | undefined {
    return this.walletContexts.get(walletAddress);
  }

  /**
   * Set market context for feature extraction
   */
  setMarketContext(context: MarketContext): void {
    this.marketContexts.set(context.marketId, context);
  }

  /**
   * Get market context
   */
  getMarketContext(marketId: string): MarketContext | undefined {
    return this.marketContexts.get(marketId);
  }

  /**
   * Update wallet context with new trade data
   */
  updateWalletContext(trade: TradeData, existingContext?: WalletContext): WalletContext {
    const context: WalletContext = existingContext || {
      walletAddress: trade.walletAddress,
      walletAgeDays: 0,
      totalTrades: 0,
      uniqueMarkets: 0,
      avgTradeSize: 0,
      tradeSizeStdDev: 0,
      buySellRatio: 0.5,
      holdingPeriodAvg: 24,
      volumeSpikeCount: 0,
      whaleTradeCount: 0,
      totalVolumeUsd: 0,
      offHoursRatio: 0,
      preEventTradeRatio: 0,
      timingConsistencyScore: 0,
      marketConcentration: 0,
      nicheMarketRatio: 0,
      politicalMarketRatio: 0,
      winRate: 0.5,
      profitFactor: 1,
      maxConsecutiveWins: 0,
      coordinationScore: 0,
      clusterMembershipCount: 0,
      sybilRiskScore: 0,
    };

    // Update with new trade
    context.totalTrades += 1;
    context.totalVolumeUsd += trade.sizeUsd;

    // Update average trade size using incremental mean
    const oldAvg = context.avgTradeSize;
    context.avgTradeSize =
      oldAvg + (trade.sizeUsd - oldAvg) / context.totalTrades;

    // Update buy/sell ratio
    if (trade.side === "BUY") {
      context.buySellRatio =
        (context.buySellRatio * (context.totalTrades - 1) + 1) /
        context.totalTrades;
    } else {
      context.buySellRatio =
        (context.buySellRatio * (context.totalTrades - 1)) /
        context.totalTrades;
    }

    // Check for whale trade
    if (trade.sizeUsd >= 100000) {
      context.whaleTradeCount += 1;
    }

    // Check for off-hours trade (simplified: between 11pm and 6am UTC)
    const hour = trade.timestamp.getUTCHours();
    if (hour >= 23 || hour < 6) {
      const oldOffHours = context.offHoursRatio * (context.totalTrades - 1);
      context.offHoursRatio = (oldOffHours + 1) / context.totalTrades;
    }

    this.setWalletContext(context);
    return context;
  }

  // ============================================================================
  // Feature Extraction
  // ============================================================================

  /**
   * Extract features from trade data for scoring
   */
  extractFeatures(
    trade: TradeData,
    walletContext?: WalletContext,
    marketContext?: MarketContext
  ): Record<string, number> {
    const features: Record<string, number> = {};

    // Get contexts if not provided
    const wallet =
      walletContext ||
      (this.config.featureExtraction.useWalletContext
        ? this.walletContexts.get(trade.walletAddress)
        : undefined);

    const market =
      marketContext ||
      (this.config.featureExtraction.useMarketContext
        ? this.marketContexts.get(trade.marketId)
        : undefined);

    // Wallet behavior features
    features.wallet_age_days = wallet?.walletAgeDays ?? 0;
    features.total_trades = wallet?.totalTrades ?? 1;
    features.unique_markets = wallet?.uniqueMarkets ?? 1;

    // Trading pattern features
    features.avg_trade_size = wallet?.avgTradeSize ?? trade.sizeUsd;
    features.trade_size_stddev = wallet?.tradeSizeStdDev ?? 0;
    features.buy_sell_ratio = wallet?.buySellRatio ?? (trade.side === "BUY" ? 1 : 0);
    features.holding_period_avg = wallet?.holdingPeriodAvg ?? 24;

    // Volume features
    features.volume_spike_count = wallet?.volumeSpikeCount ?? 0;
    features.whale_trade_count = wallet?.whaleTradeCount ?? (trade.sizeUsd >= 100000 ? 1 : 0);
    features.total_volume_usd = wallet?.totalVolumeUsd ?? trade.sizeUsd;

    // Timing features
    features.off_hours_ratio = wallet?.offHoursRatio ?? 0;
    features.pre_event_trade_ratio = wallet?.preEventTradeRatio ?? 0;
    features.timing_consistency_score = wallet?.timingConsistencyScore ?? 0;

    // Market selection features
    features.market_concentration = wallet?.marketConcentration ?? 1;
    features.niche_market_ratio = wallet?.nicheMarketRatio ?? (market?.isNiche ? 1 : 0);
    features.political_market_ratio = wallet?.politicalMarketRatio ?? (market?.isPolitical ? 1 : 0);

    // Performance features
    features.win_rate = wallet?.winRate ?? 0.5;
    features.profit_factor = wallet?.profitFactor ?? 1;
    features.max_consecutive_wins = wallet?.maxConsecutiveWins ?? 0;

    // Network features
    features.coordination_score = wallet?.coordinationScore ?? 0;
    features.cluster_membership_count = wallet?.clusterMembershipCount ?? 0;
    features.sybil_risk_score = wallet?.sybilRiskScore ?? 0;

    // Apply default values for any missing features
    for (const [key, defaultValue] of Object.entries(
      this.config.featureExtraction.defaultValues
    )) {
      if (features[key] === undefined || features[key] === null) {
        features[key] = defaultValue;
      }
    }

    return features;
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  /**
   * Get cache key for a trade
   */
  private getCacheKey(trade: TradeData, modelId: string): string {
    return `${modelId}:${trade.id}:${trade.walletAddress}:${trade.sizeUsd}:${trade.timestamp.getTime()}`;
  }

  /**
   * Check cache for existing score
   */
  private checkCache(cacheKey: string): AnomalyScoreResult | null {
    if (!this.config.cacheConfig.enabled) {
      return null;
    }

    const entry = this.scoreCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      this.cacheHits++;
      this.emit("cache_hit", { tradeId: entry.result.tradeId, score: entry.result.score });
      return entry.result;
    }

    if (entry) {
      this.scoreCache.delete(cacheKey);
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Add score to cache
   */
  private addToCache(cacheKey: string, result: AnomalyScoreResult): void {
    if (!this.config.cacheConfig.enabled) {
      return;
    }

    // Evict oldest entries if cache is full
    if (this.scoreCache.size >= this.config.cacheConfig.maxSize) {
      const oldestKey = this.scoreCache.keys().next().value;
      if (oldestKey) {
        this.scoreCache.delete(oldestKey);
      }
    }

    this.scoreCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.config.cacheConfig.ttlMs,
    });
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): AnomalyRiskLevel {
    const thresholds = this.config.riskThresholds;

    if (score >= thresholds.critical) {
      return AnomalyRiskLevel.CRITICAL;
    } else if (score >= thresholds.high) {
      return AnomalyRiskLevel.HIGH;
    } else if (score >= thresholds.medium) {
      return AnomalyRiskLevel.MEDIUM;
    } else if (score >= thresholds.low) {
      return AnomalyRiskLevel.LOW;
    }
    return AnomalyRiskLevel.NONE;
  }

  /**
   * Calculate confidence based on feature availability
   */
  private calculateConfidence(
    features: Record<string, number>,
    featureDefinitions: FeatureDefinition[]
  ): number {
    let availableCount = 0;
    let totalWeight = 0;
    let weightedAvailable = 0;

    for (const def of featureDefinitions) {
      const value = features[def.name];
      totalWeight += def.weight;

      if (value !== undefined && value !== null && value !== def.defaultValue) {
        availableCount++;
        weightedAvailable += def.weight;
      }
    }

    // Base confidence from feature availability
    const availabilityRatio = totalWeight > 0 ? weightedAvailable / totalWeight : 0;

    // Adjust confidence based on total features available
    const featureRatio = featureDefinitions.length > 0
      ? availableCount / featureDefinitions.length
      : 0;

    // Combined confidence
    return 0.6 * availabilityRatio + 0.4 * featureRatio;
  }

  /**
   * Calculate contributing factors to the anomaly score
   */
  private calculateContributingFactors(
    features: Record<string, number>,
    featureImportances: Record<string, number>,
    featureDefinitions: FeatureDefinition[]
  ): ContributingFactor[] {
    const factors: ContributingFactor[] = [];

    for (const def of featureDefinitions) {
      const value = features[def.name];
      const importance = featureImportances[def.name] ?? 0;

      if (value === undefined || importance === 0) {
        continue;
      }

      // Calculate normalized contribution
      const range = def.max - def.min;
      const normalizedValue = range > 0 ? (value - def.min) / range : 0;
      const contribution = normalizedValue * importance * def.weight;

      factors.push({
        name: def.name,
        value,
        weight: def.weight,
        contribution,
        description: def.description,
      });
    }

    // Sort by contribution (descending)
    factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    // Return top 10 factors
    return factors.slice(0, 10);
  }

  /**
   * Score a single trade for anomaly
   */
  scoreTrade(
    trade: TradeData,
    modelId?: string,
    walletContext?: WalletContext,
    marketContext?: MarketContext
  ): AnomalyScoreResult {
    const startTime = Date.now();
    const effectiveModelId = modelId || this.config.defaultModelId;

    if (!effectiveModelId) {
      throw new Error("No model ID provided and no default model set");
    }

    // Check cache
    const cacheKey = this.getCacheKey(trade, effectiveModelId);
    const cachedResult = this.checkCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    this.emit("cache_miss", { tradeId: trade.id });

    // Ensure model is loaded
    let model = this.loadedModels.get(effectiveModelId);
    if (!model) {
      model = this.loadModel(effectiveModelId);
    }

    // Extract features
    const features = this.extractFeatures(trade, walletContext, marketContext);

    // Score using pipeline
    const score = this.pipeline.scoreAnomaly(effectiveModelId, features);
    const isAnomaly = this.pipeline.classifyAnomaly(effectiveModelId, features);

    // Calculate additional metrics
    const riskLevel = this.calculateRiskLevel(score);
    const confidence = this.calculateConfidence(features, model.featureDefinitions);
    const contributingFactors = this.calculateContributingFactors(
      features,
      model.featureImportances,
      model.featureDefinitions
    );

    const processingTimeMs = Date.now() - startTime;

    const result: AnomalyScoreResult = {
      tradeId: trade.id,
      walletAddress: trade.walletAddress,
      score,
      normalizedScore: score * 100,
      isAnomaly,
      confidence,
      riskLevel,
      contributingFactors,
      modelId: effectiveModelId,
      scoredAt: new Date(),
      processingTimeMs,
    };

    // Update statistics
    this.scoringCount++;
    if (isAnomaly) {
      this.anomalyCount++;
    }

    // Add to cache
    this.addToCache(cacheKey, result);

    // Emit events
    this.emit("trade_scored", result);

    if (isAnomaly) {
      this.emit("anomaly_detected", result);
    }

    return result;
  }

  /**
   * Score multiple trades in batch
   */
  scoreTradesBatch(
    trades: TradeData[],
    modelId?: string
  ): BatchScoringResult {
    const startTime = Date.now();
    const results: AnomalyScoreResult[] = [];
    let anomalyCount = 0;
    let totalScore = 0;

    const scoreDistribution: ScoreDistribution = {
      veryLow: 0,
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0,
    };

    for (const trade of trades) {
      try {
        const result = this.scoreTrade(trade, modelId);
        results.push(result);

        if (result.isAnomaly) {
          anomalyCount++;
        }

        totalScore += result.score;

        // Update distribution
        if (result.score < 0.2) {
          scoreDistribution.veryLow++;
        } else if (result.score < 0.4) {
          scoreDistribution.low++;
        } else if (result.score < 0.6) {
          scoreDistribution.medium++;
        } else if (result.score < 0.8) {
          scoreDistribution.high++;
        } else {
          scoreDistribution.veryHigh++;
        }
      } catch (error) {
        this.emit("error", {
          message: error instanceof Error ? error.message : String(error),
          tradeId: trade.id,
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const batchResult: BatchScoringResult = {
      totalScored: results.length,
      anomalyCount,
      results,
      processingTimeMs,
      averageScore: results.length > 0 ? totalScore / results.length : 0,
      scoreDistribution,
    };

    this.emit("batch_scored", batchResult);

    return batchResult;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Clear the score cache
   */
  clearCache(): void {
    this.scoreCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.scoreCache.entries()) {
      if (entry.expiresAt <= now) {
        this.scoreCache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get scoring statistics
   */
  getStatistics(): {
    scoringCount: number;
    anomalyCount: number;
    anomalyRate: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    cacheSize: number;
    loadedModelCount: number;
    walletContextCount: number;
    marketContextCount: number;
  } {
    const totalCacheOps = this.cacheHits + this.cacheMisses;

    return {
      scoringCount: this.scoringCount,
      anomalyCount: this.anomalyCount,
      anomalyRate: this.scoringCount > 0 ? this.anomalyCount / this.scoringCount : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalCacheOps > 0 ? this.cacheHits / totalCacheOps : 0,
      cacheSize: this.scoreCache.size,
      loadedModelCount: this.loadedModels.size,
      walletContextCount: this.walletContexts.size,
      marketContextCount: this.marketContexts.size,
    };
  }

  /**
   * Reset scorer state
   */
  reset(): void {
    this.loadedModels.clear();
    this.scoreCache.clear();
    this.walletContexts.clear();
    this.marketContexts.clear();
    this.scoringCount = 0;
    this.anomalyCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedScorer: RealtimeAnomalyScorer | null = null;

/**
 * Create a new real-time anomaly scorer
 */
export function createRealtimeAnomalyScorer(
  config?: Partial<RealtimeScoringConfig>
): RealtimeAnomalyScorer {
  return new RealtimeAnomalyScorer(config);
}

/**
 * Get the shared real-time anomaly scorer instance
 */
export function getSharedRealtimeAnomalyScorer(): RealtimeAnomalyScorer {
  if (!sharedScorer) {
    sharedScorer = new RealtimeAnomalyScorer();
  }
  return sharedScorer;
}

/**
 * Set the shared real-time anomaly scorer instance
 */
export function setSharedRealtimeAnomalyScorer(scorer: RealtimeAnomalyScorer): void {
  sharedScorer = scorer;
}

/**
 * Reset the shared real-time anomaly scorer instance
 */
export function resetSharedRealtimeAnomalyScorer(): void {
  if (sharedScorer) {
    sharedScorer.reset();
  }
  sharedScorer = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get risk level description
 */
export function getRiskLevelDescription(level: AnomalyRiskLevel): string {
  const descriptions: Record<AnomalyRiskLevel, string> = {
    [AnomalyRiskLevel.NONE]: "No significant anomaly risk detected",
    [AnomalyRiskLevel.LOW]: "Minor anomaly indicators present",
    [AnomalyRiskLevel.MEDIUM]: "Moderate anomaly risk requiring attention",
    [AnomalyRiskLevel.HIGH]: "High anomaly risk - likely suspicious activity",
    [AnomalyRiskLevel.CRITICAL]: "Critical anomaly - immediate attention required",
  };
  return descriptions[level];
}

/**
 * Get risk level color for UI display
 */
export function getRiskLevelColor(level: AnomalyRiskLevel): string {
  const colors: Record<AnomalyRiskLevel, string> = {
    [AnomalyRiskLevel.NONE]: "#10B981", // green
    [AnomalyRiskLevel.LOW]: "#6EE7B7", // light green
    [AnomalyRiskLevel.MEDIUM]: "#FCD34D", // yellow
    [AnomalyRiskLevel.HIGH]: "#F97316", // orange
    [AnomalyRiskLevel.CRITICAL]: "#EF4444", // red
  };
  return colors[level];
}

/**
 * Format anomaly score for display
 */
export function formatAnomalyScore(score: number, decimals: number = 2): string {
  return `${(score * 100).toFixed(decimals)}%`;
}

/**
 * Check if score result should trigger alert
 */
export function shouldTriggerAlert(
  result: AnomalyScoreResult,
  config: RealtimeScoringConfig
): boolean {
  if (!config.enableAlerting) {
    return false;
  }

  if (result.confidence < config.alertConfidenceThreshold) {
    return false;
  }

  const riskLevelOrder = [
    AnomalyRiskLevel.NONE,
    AnomalyRiskLevel.LOW,
    AnomalyRiskLevel.MEDIUM,
    AnomalyRiskLevel.HIGH,
    AnomalyRiskLevel.CRITICAL,
  ];

  const resultRiskIndex = riskLevelOrder.indexOf(result.riskLevel);
  const thresholdRiskIndex = riskLevelOrder.indexOf(config.alertRiskThreshold);

  return resultRiskIndex >= thresholdRiskIndex;
}

/**
 * Create a mock trade for testing
 */
export function createMockTrade(overrides: Partial<TradeData> = {}): TradeData {
  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    walletAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    marketId: `market_${Math.random().toString(36).substr(2, 6)}`,
    side: Math.random() > 0.5 ? "BUY" : "SELL",
    sizeUsd: Math.random() * 10000,
    price: Math.random(),
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create mock wallet context for testing
 */
export function createMockWalletContext(
  walletAddress: string,
  overrides: Partial<WalletContext> = {}
): WalletContext {
  return {
    walletAddress,
    walletAgeDays: Math.floor(Math.random() * 365),
    totalTrades: Math.floor(Math.random() * 1000),
    uniqueMarkets: Math.floor(Math.random() * 100),
    avgTradeSize: Math.random() * 5000,
    tradeSizeStdDev: Math.random() * 2000,
    buySellRatio: Math.random(),
    holdingPeriodAvg: Math.random() * 168,
    volumeSpikeCount: Math.floor(Math.random() * 10),
    whaleTradeCount: Math.floor(Math.random() * 5),
    totalVolumeUsd: Math.random() * 1000000,
    offHoursRatio: Math.random() * 0.3,
    preEventTradeRatio: Math.random() * 0.2,
    timingConsistencyScore: Math.random(),
    marketConcentration: Math.random(),
    nicheMarketRatio: Math.random() * 0.3,
    politicalMarketRatio: Math.random() * 0.2,
    winRate: 0.4 + Math.random() * 0.3,
    profitFactor: 0.5 + Math.random() * 2,
    maxConsecutiveWins: Math.floor(Math.random() * 10),
    coordinationScore: Math.random() * 20,
    clusterMembershipCount: Math.floor(Math.random() * 3),
    sybilRiskScore: Math.random() * 30,
    ...overrides,
  };
}

/**
 * Create mock market context for testing
 */
export function createMockMarketContext(
  marketId: string,
  overrides: Partial<MarketContext> = {}
): MarketContext {
  const categories = ["POLITICS", "CRYPTO", "SPORTS", "ENTERTAINMENT", "SCIENCE"];
  const category = categories[Math.floor(Math.random() * categories.length)] || "OTHER";

  return {
    marketId,
    category,
    isNiche: Math.random() > 0.7,
    isPolitical: category === "POLITICS",
    liquidityUsd: Math.random() * 1000000,
    avgDailyVolume: Math.random() * 100000,
    hoursUntilResolution: Math.random() > 0.3 ? Math.random() * 720 : null,
    probabilitySpread: Math.random() * 0.1,
    ...overrides,
  };
}
