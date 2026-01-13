/**
 * AI Module
 *
 * Exports AI-related services for anomaly detection, pattern recognition,
 * and predictive analytics.
 */

// AI-PAT-001: Anomaly Detection Model Training Pipeline
export {
  // Enums
  FeatureCategory,
  ModelType,
  ModelStatus,
  JobStatus,
  TrainingStage,
  MissingValueStrategy,
  ScalingMethod,

  // Constants
  DEFAULT_FEATURE_DEFINITIONS,
  DEFAULT_MODEL_ARCHITECTURE,
  DEFAULT_TRAINING_CONFIG,

  // Classes
  AnomalyDetectionTrainingPipeline,

  // Factory functions
  createAnomalyDetectionTrainingPipeline,
  getSharedAnomalyDetectionTrainingPipeline,
  setSharedAnomalyDetectionTrainingPipeline,
  resetSharedAnomalyDetectionTrainingPipeline,

  // Utility functions
  getFeatureCategoryDescription,
  getModelTypeDescription,
  getTrainingStageDescription,
  getModelStatusDescription,
  getJobStatusDescription,
} from "./anomaly-detection-training";

export type {
  FeatureDefinition,
  TrainingSample,
  TrainingDataset,
  ModelArchitecture,
  TrainingMetrics,
  CrossValidationResults,
  TrainedModel,
  TrainingPipelineConfig,
  TrainingJobStatus,
  PipelineEvents,
} from "./anomaly-detection-training";

// AI-PAT-002: Real-time Anomaly Scoring
export {
  // Enums
  AnomalyRiskLevel,

  // Constants
  DEFAULT_SCORING_CONFIG,

  // Classes
  RealtimeAnomalyScorer,

  // Factory functions
  createRealtimeAnomalyScorer,
  getSharedRealtimeAnomalyScorer,
  setSharedRealtimeAnomalyScorer,
  resetSharedRealtimeAnomalyScorer,

  // Utility functions
  getRiskLevelDescription,
  getRiskLevelColor,
  formatAnomalyScore,
  shouldTriggerAlert,
  createMockTrade,
  createMockWalletContext,
  createMockMarketContext,
} from "./realtime-anomaly-scoring";

export type {
  TradeData,
  WalletContext,
  MarketContext,
  AnomalyScoreResult,
  ContributingFactor,
  BatchScoringResult,
  ScoreDistribution,
  RealtimeScoringConfig,
  RiskThresholds,
  CacheConfig,
  FeatureExtractionConfig,
  ScoringEvents,
} from "./realtime-anomaly-scoring";
