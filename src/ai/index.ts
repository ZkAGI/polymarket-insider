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

// AI-PAT-003: Wallet Clustering Algorithm
export {
  // Enums
  ClusterFeatureCategory,
  ClusteringAlgorithm,
  DistanceMetric,
  ClusterQuality,
  WalletClusterRiskLevel,

  // Constants
  DEFAULT_CLUSTER_FEATURE_DEFINITIONS,
  DEFAULT_CLUSTERING_CONFIG,
  DEFAULT_CACHE_CONFIG,

  // Classes
  WalletClustering,

  // Factory functions
  createWalletClustering,
  getSharedWalletClustering,
  setSharedWalletClustering,
  resetSharedWalletClustering,

  // Utility functions
  getClusterQualityDescription,
  getRiskLevelDescription as getClusterRiskLevelDescription,
  getRiskLevelColor as getClusterRiskLevelColor,
  getAlgorithmDescription,
  createMockWalletData,
  createMockWalletDataBatch,
} from "./wallet-clustering";

export type {
  ClusterFeatureDefinition,
  WalletFeatureVector,
  ClusterCentroid,
  WalletClusterMembership,
  WalletCluster,
  DominantFeature,
  ClusteringResult,
  ClusteringConfig,
  RiskThresholds as ClusterRiskThresholds,
  CacheConfig as ClusterCacheConfig,
  ClusteringEvents,
  WalletData,
} from "./wallet-clustering";

// AI-NLP-001: Alert Summary Generator
export {
  // Enums
  AlertType as SummaryAlertType,
  AlertSeverity as SummaryAlertSeverity,
  SummaryStyle,
  SummaryLanguage,

  // Constants
  DEFAULT_SUMMARY_CONFIG,
  ALERT_TYPE_DESCRIPTIONS,
  SEVERITY_DESCRIPTORS,
  RISK_THRESHOLDS,

  // Classes
  AlertSummaryGenerator,

  // Factory functions
  createAlertSummaryGenerator,
  getSharedAlertSummaryGenerator,
  setSharedAlertSummaryGenerator,
  resetSharedAlertSummaryGenerator,

  // Convenience functions
  generateAlertSummary,
  getBriefSummary,
  getStandardSummary,
  getDetailedSummary,
  getTechnicalSummary,
  getCasualSummary,

  // Utility functions
  truncateAddress,
  truncateText,
  formatNumber,
  capitalize,
  formatTimestamp,
  getSeverityEmoji,
  getTypeVerb,
  calculateConfidence,
  validateAlertData,
  parseAlertType,
  parseAlertSeverity,

  // Mock data generators
  createMockAlert,
  createMockAlertBatch,
} from "./alert-summary-generator";

export type {
  AlertData,
  AlertSummary,
  SummaryOptions,
  BatchSummaryResult,
  SummaryGeneratorConfig,
  SummaryGeneratorEvents,
} from "./alert-summary-generator";

// AI-NLP-002: Market Context Analyzer
export {
  // Enums
  ContentSourceType,
  Sentiment,
  RelevanceLevel,
  ImpactPrediction,
  AnalysisStatus,
  EntityType,

  // Constants
  DEFAULT_CONTENT_SOURCES,
  DEFAULT_ANALYZER_CONFIG,
  SENTIMENT_THRESHOLDS,
  IMPACT_THRESHOLDS,
  RELEVANCE_THRESHOLDS,
  CATEGORY_KEYWORDS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,

  // Classes
  MarketContextAnalyzer,

  // Factory functions
  createMarketContextAnalyzer,
  getSharedMarketContextAnalyzer,
  setSharedMarketContextAnalyzer,
  resetSharedMarketContextAnalyzer,

  // Convenience functions
  analyzeMarketContext,
  getSentiment,
  isContentRelevant,

  // Utility functions
  scoreToSentiment,
  scoreToImpact,
  scoreToRelevance,
  getSentimentDescription,
  getSentimentColor,
  getImpactDescription,
  getImpactEmoji,
  getRelevanceDescription,
  extractMarketKeywords,
  calculateKeywordMatch,
  escapeRegex,
  calculateEngagementScore,
  generateSnippet,
  truncateText as contextTruncateText,
  formatTimestamp as contextFormatTimestamp,
  isWithinAgeLimit,
  calculateContentAge,

  // Mock data generators
  createMockContentItem,
  createMockMarketMention,
  createMockContextResult,
} from "./market-context-analyzer";

export type {
  ContentSource,
  ContentItem,
  ContentEngagement,
  ExtractedEntity,
  MarketMention,
  SentimentAnalysis,
  ActivityCorrelation,
  MarketContextResult,
  BatchAnalysisResult,
  MarketContextAnalyzerConfig,
  MarketContextAnalyzerEvents,
} from "./market-context-analyzer";

// AI-PRED-001: Insider Probability Predictor
export {
  // Enums
  InsiderConfidenceLevel,
  InsiderSignalCategory,
  PredictionStatus,
  CalibrationMethod,

  // Constants
  DEFAULT_INSIDER_FEATURES,
  DEFAULT_PREDICTOR_CONFIG,
  CONFIDENCE_THRESHOLDS,

  // Classes
  InsiderProbabilityPredictor,

  // Factory functions
  createInsiderProbabilityPredictor,
  getSharedInsiderProbabilityPredictor,
  setSharedInsiderProbabilityPredictor,
  resetSharedInsiderProbabilityPredictor,

  // Utility functions
  getConfidenceLevelDescription,
  getConfidenceLevelColor,
  getSignalCategoryDescription,
  formatProbability,
  getProbabilityLevelDescription,
  getProbabilityLevelColor,
  getCalibrationMethodDescription,

  // Mock data generators
  createMockWalletActivityData,
  createMockWalletBehaviorFeatures,
  createMockTimingFeatures,
  createMockMarketSelectionFeatures,
  createMockTradingPatternFeatures,
  createMockPerformanceFeatures,
  createMockNetworkFeatures,
  createMockInsiderFeatureSet,
  createMockInsiderFeatureSetBatch,
  createSuspiciousMockFeatureSet,
  createNormalMockFeatureSet,
} from "./insider-probability-predictor";

export type {
  InsiderFeatureDefinition,
  WalletActivityData,
  WalletBehaviorFeatures,
  TimingFeatures,
  MarketSelectionFeatures,
  TradingPatternFeatures,
  PerformanceFeatures,
  NetworkFeatures,
  InsiderFeatureSet,
  SignalContribution,
  InsiderPredictionResult,
  BatchPredictionResult,
  ProbabilityDistribution,
  CalibrationParameters,
  ModelAccuracyMetrics,
  InsiderPredictorConfig,
  InsiderPredictorEvents,
} from "./insider-probability-predictor";
