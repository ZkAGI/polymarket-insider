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
