/**
 * Anomaly Detection Model Training Pipeline (AI-PAT-001)
 *
 * Pipeline to train anomaly detection models on historical trading data.
 * Uses statistical and ML-based approaches to identify suspicious patterns.
 *
 * Features:
 * - Prepare training data from historical trades
 * - Define model architecture with configurable features
 * - Train model using Isolation Forest algorithm
 * - Evaluate performance with cross-validation
 * - Export trained model for inference
 * - Support incremental training
 */

import { EventEmitter } from "events";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Training data feature categories
 */
export enum FeatureCategory {
  /** Wallet behavior features */
  WALLET_BEHAVIOR = "WALLET_BEHAVIOR",
  /** Trading pattern features */
  TRADING_PATTERN = "TRADING_PATTERN",
  /** Volume features */
  VOLUME = "VOLUME",
  /** Timing features */
  TIMING = "TIMING",
  /** Market selection features */
  MARKET_SELECTION = "MARKET_SELECTION",
  /** Performance features */
  PERFORMANCE = "PERFORMANCE",
  /** Network/coordination features */
  NETWORK = "NETWORK",
}

/**
 * Feature definition for model training
 */
export interface FeatureDefinition {
  /** Feature name */
  name: string;
  /** Feature category */
  category: FeatureCategory;
  /** Feature description */
  description: string;
  /** Default value when missing */
  defaultValue: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Weight for feature importance */
  weight: number;
  /** Whether feature is required */
  required: boolean;
}

/**
 * Default feature definitions for anomaly detection
 */
export const DEFAULT_FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Wallet behavior features
  {
    name: "wallet_age_days",
    category: FeatureCategory.WALLET_BEHAVIOR,
    description: "Age of wallet in days",
    defaultValue: 0,
    min: 0,
    max: 3650,
    weight: 1.0,
    required: false,
  },
  {
    name: "total_trades",
    category: FeatureCategory.WALLET_BEHAVIOR,
    description: "Total number of trades",
    defaultValue: 0,
    min: 0,
    max: 100000,
    weight: 1.0,
    required: true,
  },
  {
    name: "unique_markets",
    category: FeatureCategory.WALLET_BEHAVIOR,
    description: "Number of unique markets traded",
    defaultValue: 0,
    min: 0,
    max: 1000,
    weight: 0.8,
    required: false,
  },

  // Trading pattern features
  {
    name: "avg_trade_size",
    category: FeatureCategory.TRADING_PATTERN,
    description: "Average trade size in USD",
    defaultValue: 0,
    min: 0,
    max: 10000000,
    weight: 1.2,
    required: true,
  },
  {
    name: "trade_size_stddev",
    category: FeatureCategory.TRADING_PATTERN,
    description: "Standard deviation of trade sizes",
    defaultValue: 0,
    min: 0,
    max: 10000000,
    weight: 0.9,
    required: false,
  },
  {
    name: "buy_sell_ratio",
    category: FeatureCategory.TRADING_PATTERN,
    description: "Ratio of buy to sell orders",
    defaultValue: 0.5,
    min: 0,
    max: 1,
    weight: 0.7,
    required: false,
  },
  {
    name: "holding_period_avg",
    category: FeatureCategory.TRADING_PATTERN,
    description: "Average holding period in hours",
    defaultValue: 24,
    min: 0,
    max: 8760, // 1 year in hours
    weight: 1.0,
    required: false,
  },

  // Volume features
  {
    name: "volume_spike_count",
    category: FeatureCategory.VOLUME,
    description: "Number of volume spikes detected",
    defaultValue: 0,
    min: 0,
    max: 1000,
    weight: 1.3,
    required: false,
  },
  {
    name: "whale_trade_count",
    category: FeatureCategory.VOLUME,
    description: "Number of whale-sized trades",
    defaultValue: 0,
    min: 0,
    max: 1000,
    weight: 1.2,
    required: false,
  },
  {
    name: "total_volume_usd",
    category: FeatureCategory.VOLUME,
    description: "Total trading volume in USD",
    defaultValue: 0,
    min: 0,
    max: 100000000,
    weight: 1.1,
    required: false,
  },

  // Timing features
  {
    name: "off_hours_ratio",
    category: FeatureCategory.TIMING,
    description: "Ratio of trades during off-hours",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 0.8,
    required: false,
  },
  {
    name: "pre_event_trade_ratio",
    category: FeatureCategory.TIMING,
    description: "Ratio of trades before events",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.4,
    required: false,
  },
  {
    name: "timing_consistency_score",
    category: FeatureCategory.TIMING,
    description: "Consistency of trade timing patterns",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 0.9,
    required: false,
  },

  // Market selection features
  {
    name: "market_concentration",
    category: FeatureCategory.MARKET_SELECTION,
    description: "Concentration in specific markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.0,
    required: false,
  },
  {
    name: "niche_market_ratio",
    category: FeatureCategory.MARKET_SELECTION,
    description: "Ratio of trades in niche markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.2,
    required: false,
  },
  {
    name: "political_market_ratio",
    category: FeatureCategory.MARKET_SELECTION,
    description: "Ratio of trades in political markets",
    defaultValue: 0,
    min: 0,
    max: 1,
    weight: 1.1,
    required: false,
  },

  // Performance features
  {
    name: "win_rate",
    category: FeatureCategory.PERFORMANCE,
    description: "Win rate of resolved positions",
    defaultValue: 0.5,
    min: 0,
    max: 1,
    weight: 1.5,
    required: true,
  },
  {
    name: "profit_factor",
    category: FeatureCategory.PERFORMANCE,
    description: "Gross profit / gross loss",
    defaultValue: 1,
    min: 0,
    max: 100,
    weight: 1.3,
    required: false,
  },
  {
    name: "max_consecutive_wins",
    category: FeatureCategory.PERFORMANCE,
    description: "Maximum consecutive winning trades",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.1,
    required: false,
  },

  // Network features
  {
    name: "coordination_score",
    category: FeatureCategory.NETWORK,
    description: "Score indicating coordinated trading",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.4,
    required: false,
  },
  {
    name: "cluster_membership_count",
    category: FeatureCategory.NETWORK,
    description: "Number of wallet clusters involved in",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.2,
    required: false,
  },
  {
    name: "sybil_risk_score",
    category: FeatureCategory.NETWORK,
    description: "Risk score for sybil attack",
    defaultValue: 0,
    min: 0,
    max: 100,
    weight: 1.3,
    required: false,
  },
];

/**
 * Training data sample
 */
export interface TrainingSample {
  /** Sample ID */
  id: string;
  /** Wallet address */
  walletAddress: string;
  /** Feature vector */
  features: Record<string, number>;
  /** Label (true = anomaly, false = normal, null = unlabeled) */
  label: boolean | null;
  /** Timestamp of data collection */
  timestamp: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Training dataset
 */
export interface TrainingDataset {
  /** Dataset ID */
  id: string;
  /** Dataset name */
  name: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Number of samples */
  sampleCount: number;
  /** Number of labeled samples */
  labeledCount: number;
  /** Number of anomaly samples */
  anomalyCount: number;
  /** Feature definitions used */
  featureDefinitions: FeatureDefinition[];
  /** Samples */
  samples: TrainingSample[];
}

/**
 * Model architecture configuration
 */
export interface ModelArchitecture {
  /** Model type */
  type: ModelType;
  /** Number of estimators (trees) */
  nEstimators: number;
  /** Maximum samples per tree */
  maxSamples: number | "auto";
  /** Contamination rate (expected anomaly rate) */
  contamination: number | "auto";
  /** Random state for reproducibility */
  randomState: number | null;
  /** Maximum features per tree */
  maxFeatures: number | "auto";
  /** Bootstrap samples */
  bootstrap: boolean;
}

/**
 * Model types supported
 */
export enum ModelType {
  /** Isolation Forest algorithm */
  ISOLATION_FOREST = "ISOLATION_FOREST",
  /** Local Outlier Factor */
  LOCAL_OUTLIER_FACTOR = "LOCAL_OUTLIER_FACTOR",
  /** One-Class SVM */
  ONE_CLASS_SVM = "ONE_CLASS_SVM",
  /** Statistical (z-score based) */
  STATISTICAL = "STATISTICAL",
}

/**
 * Default model architecture
 */
export const DEFAULT_MODEL_ARCHITECTURE: ModelArchitecture = {
  type: ModelType.ISOLATION_FOREST,
  nEstimators: 100,
  maxSamples: "auto",
  contamination: 0.1, // 10% expected anomaly rate
  randomState: 42,
  maxFeatures: "auto",
  bootstrap: false,
};

/**
 * Training metrics from a single training run
 */
export interface TrainingMetrics {
  /** Training loss */
  loss: number;
  /** Training accuracy (if labels available) */
  accuracy: number | null;
  /** Precision score */
  precision: number | null;
  /** Recall score */
  recall: number | null;
  /** F1 score */
  f1Score: number | null;
  /** AUC-ROC score */
  aucRoc: number | null;
  /** Training duration in ms */
  trainingDurationMs: number;
  /** Number of samples used */
  samplesUsed: number;
}

/**
 * Cross-validation results
 */
export interface CrossValidationResults {
  /** Number of folds */
  nFolds: number;
  /** Metrics per fold */
  foldMetrics: TrainingMetrics[];
  /** Mean metrics across folds */
  meanMetrics: TrainingMetrics;
  /** Standard deviation of metrics */
  stdMetrics: Partial<TrainingMetrics>;
}

/**
 * Trained model
 */
export interface TrainedModel {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Model version */
  version: string;
  /** Architecture used */
  architecture: ModelArchitecture;
  /** Training metrics */
  trainingMetrics: TrainingMetrics;
  /** Cross-validation results */
  crossValidation?: CrossValidationResults;
  /** Feature importances */
  featureImportances: Record<string, number>;
  /** Decision threshold for anomaly classification */
  threshold: number;
  /** Trained weights/parameters (serialized) */
  serializedModel: string;
  /** Feature definitions used */
  featureDefinitions: FeatureDefinition[];
  /** Training timestamp */
  trainedAt: Date;
  /** Dataset ID used for training */
  datasetId: string;
  /** Model status */
  status: ModelStatus;
}

/**
 * Model status
 */
export enum ModelStatus {
  /** Model is training */
  TRAINING = "TRAINING",
  /** Model is trained and ready */
  READY = "READY",
  /** Model training failed */
  FAILED = "FAILED",
  /** Model is deprecated */
  DEPRECATED = "DEPRECATED",
}

/**
 * Training pipeline configuration
 */
export interface TrainingPipelineConfig {
  /** Feature definitions */
  featureDefinitions: FeatureDefinition[];
  /** Model architecture */
  architecture: ModelArchitecture;
  /** Train/test split ratio */
  trainTestSplit: number;
  /** Number of cross-validation folds */
  cvFolds: number;
  /** Enable data augmentation */
  augmentation: boolean;
  /** Missing value strategy */
  missingValueStrategy: MissingValueStrategy;
  /** Feature scaling method */
  scalingMethod: ScalingMethod;
  /** Minimum samples required for training */
  minSamples: number;
  /** Enable incremental training */
  incrementalTraining: boolean;
}

/**
 * Missing value handling strategies
 */
export enum MissingValueStrategy {
  /** Replace with default value */
  DEFAULT_VALUE = "DEFAULT_VALUE",
  /** Replace with mean */
  MEAN = "MEAN",
  /** Replace with median */
  MEDIAN = "MEDIAN",
  /** Drop samples with missing values */
  DROP = "DROP",
}

/**
 * Feature scaling methods
 */
export enum ScalingMethod {
  /** Min-max normalization */
  MIN_MAX = "MIN_MAX",
  /** Standard scaling (z-score) */
  STANDARD = "STANDARD",
  /** Robust scaling (using quartiles) */
  ROBUST = "ROBUST",
  /** No scaling */
  NONE = "NONE",
}

/**
 * Default training pipeline configuration
 */
export const DEFAULT_TRAINING_CONFIG: TrainingPipelineConfig = {
  featureDefinitions: DEFAULT_FEATURE_DEFINITIONS,
  architecture: DEFAULT_MODEL_ARCHITECTURE,
  trainTestSplit: 0.8,
  cvFolds: 5,
  augmentation: false,
  missingValueStrategy: MissingValueStrategy.DEFAULT_VALUE,
  scalingMethod: ScalingMethod.MIN_MAX,
  minSamples: 100,
  incrementalTraining: false,
};

/**
 * Training job status
 */
export interface TrainingJobStatus {
  /** Job ID */
  jobId: string;
  /** Current status */
  status: JobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current stage */
  stage: TrainingStage;
  /** Stage progress */
  stageProgress: number;
  /** Start time */
  startedAt: Date;
  /** End time (if complete) */
  completedAt?: Date;
  /** Error message (if failed) */
  error?: string;
  /** Model ID (if complete) */
  modelId?: string;
}

/**
 * Job status
 */
export enum JobStatus {
  /** Job is pending */
  PENDING = "PENDING",
  /** Job is running */
  RUNNING = "RUNNING",
  /** Job completed successfully */
  COMPLETED = "COMPLETED",
  /** Job failed */
  FAILED = "FAILED",
  /** Job was cancelled */
  CANCELLED = "CANCELLED",
}

/**
 * Training stages
 */
export enum TrainingStage {
  /** Data preparation */
  DATA_PREPARATION = "DATA_PREPARATION",
  /** Feature extraction */
  FEATURE_EXTRACTION = "FEATURE_EXTRACTION",
  /** Feature scaling */
  FEATURE_SCALING = "FEATURE_SCALING",
  /** Model training */
  MODEL_TRAINING = "MODEL_TRAINING",
  /** Cross-validation */
  CROSS_VALIDATION = "CROSS_VALIDATION",
  /** Model evaluation */
  MODEL_EVALUATION = "MODEL_EVALUATION",
  /** Model serialization */
  MODEL_SERIALIZATION = "MODEL_SERIALIZATION",
}

/**
 * Pipeline events
 */
export interface PipelineEvents {
  /** Training started */
  training_started: { jobId: string; datasetId: string };
  /** Training stage changed */
  stage_changed: { jobId: string; stage: TrainingStage; progress: number };
  /** Training completed */
  training_completed: { jobId: string; modelId: string; metrics: TrainingMetrics };
  /** Training failed */
  training_failed: { jobId: string; error: string };
  /** Model exported */
  model_exported: { modelId: string; path: string };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Isolation Forest Node for tree-based anomaly detection
 */
interface IsolationNode {
  /** Split feature index */
  featureIndex: number | null;
  /** Split value */
  splitValue: number | null;
  /** Left child */
  left: IsolationNode | null;
  /** Right child */
  right: IsolationNode | null;
  /** Number of samples at this node */
  size: number;
  /** Node depth */
  depth: number;
}

/**
 * Isolation Tree for anomaly detection
 */
interface IsolationTree {
  /** Root node */
  root: IsolationNode;
  /** Maximum depth */
  maxDepth: number;
  /** Feature indices used */
  featureIndices: number[];
}

/**
 * Anomaly Detection Model Training Pipeline
 */
export class AnomalyDetectionTrainingPipeline extends EventEmitter {
  private config: TrainingPipelineConfig;
  private datasets: Map<string, TrainingDataset>;
  private models: Map<string, TrainedModel>;
  private jobs: Map<string, TrainingJobStatus>;
  private featureStats: Map<string, { mean: number; std: number; min: number; max: number }>;
  private idCounter: number;

  constructor(config: Partial<TrainingPipelineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
    this.datasets = new Map();
    this.models = new Map();
    this.jobs = new Map();
    this.featureStats = new Map();
    this.idCounter = 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): TrainingPipelineConfig {
    return { ...this.config };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<TrainingPipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Data Preparation
  // ============================================================================

  /**
   * Create a new training dataset
   */
  createDataset(name: string): TrainingDataset {
    const dataset: TrainingDataset = {
      id: this.generateId("dataset"),
      name,
      createdAt: new Date(),
      sampleCount: 0,
      labeledCount: 0,
      anomalyCount: 0,
      featureDefinitions: [...this.config.featureDefinitions],
      samples: [],
    };
    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  /**
   * Add training sample to dataset
   */
  addSample(datasetId: string, sample: Omit<TrainingSample, "id">): TrainingSample {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const newSample: TrainingSample = {
      ...sample,
      id: this.generateId("sample"),
    };

    dataset.samples.push(newSample);
    dataset.sampleCount++;
    if (newSample.label !== null) {
      dataset.labeledCount++;
      if (newSample.label === true) {
        dataset.anomalyCount++;
      }
    }

    return newSample;
  }

  /**
   * Add multiple samples to dataset
   */
  addSamples(datasetId: string, samples: Omit<TrainingSample, "id">[]): TrainingSample[] {
    return samples.map((sample) => this.addSample(datasetId, sample));
  }

  /**
   * Get dataset by ID
   */
  getDataset(datasetId: string): TrainingDataset | undefined {
    return this.datasets.get(datasetId);
  }

  /**
   * Get all datasets
   */
  getAllDatasets(): TrainingDataset[] {
    return Array.from(this.datasets.values());
  }

  /**
   * Prepare features from raw sample data
   */
  private prepareFeatures(
    sample: TrainingSample,
    definitions: FeatureDefinition[]
  ): number[] {
    const features: number[] = [];

    for (const def of definitions) {
      let value = sample.features[def.name];

      // Handle missing values
      if (value === undefined || value === null || Number.isNaN(value)) {
        switch (this.config.missingValueStrategy) {
          case MissingValueStrategy.DEFAULT_VALUE:
            value = def.defaultValue;
            break;
          case MissingValueStrategy.MEAN:
            const stats = this.featureStats.get(def.name);
            value = stats?.mean ?? def.defaultValue;
            break;
          case MissingValueStrategy.MEDIAN:
            // Use default for median in this implementation
            value = def.defaultValue;
            break;
          case MissingValueStrategy.DROP:
            // Return empty array to indicate this sample should be dropped
            if (def.required) {
              return [];
            }
            value = def.defaultValue;
            break;
        }
      }

      // Clamp to valid range
      value = Math.max(def.min, Math.min(def.max, value));

      features.push(value);
    }

    return features;
  }

  /**
   * Calculate feature statistics from dataset
   */
  private calculateFeatureStats(samples: TrainingSample[], definitions: FeatureDefinition[]): void {
    this.featureStats.clear();

    for (const def of definitions) {
      const values = samples
        .map((s) => s.features[def.name])
        .filter((v) => v !== undefined && v !== null && !Number.isNaN(v)) as number[];

      if (values.length === 0) {
        this.featureStats.set(def.name, {
          mean: def.defaultValue,
          std: 1,
          min: def.min,
          max: def.max,
        });
        continue;
      }

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance) || 1;
      const min = Math.min(...values);
      const max = Math.max(...values);

      this.featureStats.set(def.name, { mean, std, min, max });
    }
  }

  /**
   * Scale features based on configured method
   */
  private scaleFeatures(
    features: number[],
    definitions: FeatureDefinition[]
  ): number[] {
    if (this.config.scalingMethod === ScalingMethod.NONE) {
      return features;
    }

    const scaled: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const def = definitions[i];
      if (!def) {
        scaled.push(features[i] ?? 0);
        continue;
      }
      const stats = this.featureStats.get(def.name);
      let value: number = features[i] ?? 0;

      if (!stats) {
        scaled.push(value);
        continue;
      }

      switch (this.config.scalingMethod) {
        case ScalingMethod.MIN_MAX:
          const range = stats.max - stats.min;
          value = range !== 0 ? (value - stats.min) / range : 0;
          break;
        case ScalingMethod.STANDARD:
          value = stats.std !== 0 ? (value - stats.mean) / stats.std : 0;
          break;
        case ScalingMethod.ROBUST:
          // Using min/max as approximation for quartiles
          const iqr = stats.max - stats.min;
          value = iqr !== 0 ? (value - stats.mean) / iqr : 0;
          break;
      }

      scaled.push(value);
    }

    return scaled;
  }

  /**
   * Prepare training data (features matrix)
   */
  prepareTrainingData(
    datasetId: string
  ): { features: number[][]; labels: (boolean | null)[]; sampleIds: string[] } {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // Calculate feature statistics
    this.calculateFeatureStats(dataset.samples, dataset.featureDefinitions);

    const features: number[][] = [];
    const labels: (boolean | null)[] = [];
    const sampleIds: string[] = [];

    for (const sample of dataset.samples) {
      const featureVector = this.prepareFeatures(sample, dataset.featureDefinitions);

      // Skip samples with missing required features
      if (featureVector.length === 0) {
        continue;
      }

      // Scale features
      const scaledFeatures = this.scaleFeatures(featureVector, dataset.featureDefinitions);

      features.push(scaledFeatures);
      labels.push(sample.label);
      sampleIds.push(sample.id);
    }

    return { features, labels, sampleIds };
  }

  // ============================================================================
  // Model Training
  // ============================================================================

  /**
   * Build an isolation tree
   */
  private buildIsolationTree(
    data: number[][],
    maxDepth: number,
    featureIndices: number[]
  ): IsolationTree {
    const buildNode = (
      samples: number[][],
      depth: number,
      usedFeatures: number[]
    ): IsolationNode => {
      // Terminal conditions
      if (depth >= maxDepth || samples.length <= 1) {
        return {
          featureIndex: null,
          splitValue: null,
          left: null,
          right: null,
          size: samples.length,
          depth,
        };
      }

      // Select random feature
      const featureIndex = usedFeatures[Math.floor(Math.random() * usedFeatures.length)] ?? 0;

      // Get min/max values for this feature
      const values = samples.map((s) => s[featureIndex] ?? 0);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      // If all values are the same, create leaf node
      if (minVal === maxVal) {
        return {
          featureIndex: null,
          splitValue: null,
          left: null,
          right: null,
          size: samples.length,
          depth,
        };
      }

      // Random split value between min and max
      const splitValue = minVal + Math.random() * (maxVal - minVal);

      // Partition samples
      const leftSamples = samples.filter((s) => (s[featureIndex] ?? 0) < splitValue);
      const rightSamples = samples.filter((s) => (s[featureIndex] ?? 0) >= splitValue);

      return {
        featureIndex,
        splitValue,
        left: buildNode(leftSamples, depth + 1, usedFeatures),
        right: buildNode(rightSamples, depth + 1, usedFeatures),
        size: samples.length,
        depth,
      };
    };

    return {
      root: buildNode(data, 0, featureIndices),
      maxDepth,
      featureIndices,
    };
  }

  /**
   * Calculate path length in isolation tree
   */
  private getPathLength(sample: number[], tree: IsolationTree): number {
    const traverse = (node: IsolationNode, depth: number): number => {
      // Leaf node
      if (node.left === null || node.right === null) {
        // Adjustment for unbuilt subtree
        if (node.size > 1) {
          return depth + this.averagePathLength(node.size);
        }
        return depth;
      }

      const value = sample[node.featureIndex!] ?? 0;
      if (value < (node.splitValue ?? 0)) {
        return traverse(node.left, depth + 1);
      }
      return traverse(node.right, depth + 1);
    };

    return traverse(tree.root, 0);
  }

  /**
   * Calculate average path length for binary search tree
   */
  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    // H(n-1) = ln(n-1) + 0.5772... (Euler's constant)
    const harmonicNumber = Math.log(n - 1) + 0.5772156649;
    return 2 * harmonicNumber - (2 * (n - 1)) / n;
  }

  /**
   * Calculate anomaly score for a sample
   */
  private calculateAnomalyScore(sample: number[], trees: IsolationTree[]): number {
    if (trees.length === 0 || !trees[0]) {
      return 0;
    }
    const pathLengths = trees.map((tree) => this.getPathLength(sample, tree));
    const avgPathLength = pathLengths.reduce((a, b) => a + b, 0) / trees.length;
    const n = trees[0].root.size;
    const c = this.averagePathLength(n);

    // Anomaly score: 2^(-avgPathLength / c)
    return Math.pow(2, -avgPathLength / c);
  }

  /**
   * Train Isolation Forest model
   */
  private trainIsolationForest(
    data: number[][],
    architecture: ModelArchitecture
  ): { trees: IsolationTree[]; threshold: number } {
    if (data.length === 0 || !data[0]) {
      return { trees: [], threshold: 0.5 };
    }
    const nEstimators = architecture.nEstimators;
    const maxSamples =
      architecture.maxSamples === "auto" ? Math.min(256, data.length) : architecture.maxSamples;
    const maxFeatures =
      architecture.maxFeatures === "auto" ? data[0].length : architecture.maxFeatures;
    const maxDepth = Math.ceil(Math.log2(maxSamples));

    const trees: IsolationTree[] = [];
    const featureIndices = Array.from({ length: data[0].length }, (_, i) => i);

    for (let i = 0; i < nEstimators; i++) {
      // Bootstrap sample
      const bootstrapIndices = Array.from({ length: maxSamples }, () =>
        Math.floor(Math.random() * data.length)
      );
      const bootstrapSample = bootstrapIndices
        .map((idx) => data[idx])
        .filter((sample): sample is number[] => sample !== undefined);

      if (bootstrapSample.length === 0) continue;

      // Select random features
      const shuffledFeatures = [...featureIndices].sort(() => Math.random() - 0.5);
      const selectedFeatures = shuffledFeatures.slice(0, maxFeatures);

      // Build tree
      const tree = this.buildIsolationTree(bootstrapSample, maxDepth, selectedFeatures);
      trees.push(tree);
    }

    // Calculate threshold based on contamination
    const scores = data.map((sample) => this.calculateAnomalyScore(sample, trees));
    scores.sort((a, b) => b - a); // Descending

    const contamination =
      architecture.contamination === "auto" ? 0.1 : architecture.contamination;
    const thresholdIndex = Math.floor(data.length * contamination);
    const threshold = scores[Math.max(0, thresholdIndex - 1)] ?? 0.5;

    return { trees, threshold };
  }

  /**
   * Calculate feature importances
   */
  private calculateFeatureImportances(
    trees: IsolationTree[],
    definitions: FeatureDefinition[]
  ): Record<string, number> {
    const importances: Record<string, number> = {};

    // Initialize
    for (const def of definitions) {
      importances[def.name] = 0;
    }

    // Count feature usage in splits
    const countSplits = (node: IsolationNode): void => {
      if (node.featureIndex !== null && node.featureIndex < definitions.length) {
        const def = definitions[node.featureIndex];
        if (def) {
          const currentVal = importances[def.name];
          importances[def.name] = (currentVal ?? 0) + 1;
        }
      }
      if (node.left) countSplits(node.left);
      if (node.right) countSplits(node.right);
    };

    for (const tree of trees) {
      countSplits(tree.root);
    }

    // Normalize
    const total = Object.values(importances).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const key of Object.keys(importances)) {
        const val = importances[key];
        importances[key] = (val ?? 0) / total;
      }
    }

    return importances;
  }

  /**
   * Evaluate model performance
   */
  private evaluateModel(
    predictions: boolean[],
    labels: (boolean | null)[],
    scores: number[]
  ): TrainingMetrics {
    // Filter to only labeled samples
    const labeled = labels
      .map((label, idx) => ({ label, pred: predictions[idx], score: scores[idx] }))
      .filter((item) => item.label !== null);

    if (labeled.length === 0) {
      return {
        loss: 0,
        accuracy: null,
        precision: null,
        recall: null,
        f1Score: null,
        aucRoc: null,
        trainingDurationMs: 0,
        samplesUsed: predictions.length,
      };
    }

    // Calculate metrics
    let tp = 0,
      fp = 0,
      tn = 0,
      fn = 0;

    for (const item of labeled) {
      if (item.pred && item.label) tp++;
      else if (item.pred && !item.label) fp++;
      else if (!item.pred && !item.label) tn++;
      else fn++;
    }

    const accuracy = (tp + tn) / labeled.length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Calculate loss (log loss approximation)
    const loss =
      -labeled.reduce((sum, item) => {
        const prob = Math.max(0.001, Math.min(0.999, item.score ?? 0.5));
        return sum + (item.label ? Math.log(prob) : Math.log(1 - prob));
      }, 0) / labeled.length;

    return {
      loss,
      accuracy,
      precision,
      recall,
      f1Score,
      aucRoc: null, // Would require proper ROC curve calculation
      trainingDurationMs: 0,
      samplesUsed: predictions.length,
    };
  }

  /**
   * Run cross-validation
   */
  private runCrossValidation(
    data: number[][],
    labels: (boolean | null)[],
    architecture: ModelArchitecture,
    _definitions: FeatureDefinition[],
    nFolds: number
  ): CrossValidationResults {
    const foldMetrics: TrainingMetrics[] = [];
    const foldSize = Math.floor(data.length / nFolds);

    for (let fold = 0; fold < nFolds; fold++) {
      const testStart = fold * foldSize;
      const testEnd = fold === nFolds - 1 ? data.length : (fold + 1) * foldSize;

      // Split data
      const trainData = [...data.slice(0, testStart), ...data.slice(testEnd)];
      const testData = data.slice(testStart, testEnd);
      const testLabels = labels.slice(testStart, testEnd);

      // Train on fold
      const { trees, threshold } = this.trainIsolationForest(trainData, architecture);

      // Predict on test set
      const scores = testData.map((sample) => this.calculateAnomalyScore(sample, trees));
      const predictions = scores.map((score) => score >= threshold);

      // Evaluate
      const metrics = this.evaluateModel(predictions, testLabels, scores);
      foldMetrics.push(metrics);
    }

    // Calculate mean metrics
    const meanMetrics: TrainingMetrics = {
      loss: foldMetrics.reduce((a, b) => a + b.loss, 0) / nFolds,
      accuracy:
        foldMetrics.filter((m) => m.accuracy !== null).length > 0
          ? foldMetrics
              .filter((m) => m.accuracy !== null)
              .reduce((a, b) => a + (b.accuracy || 0), 0) /
            foldMetrics.filter((m) => m.accuracy !== null).length
          : null,
      precision:
        foldMetrics.filter((m) => m.precision !== null).length > 0
          ? foldMetrics
              .filter((m) => m.precision !== null)
              .reduce((a, b) => a + (b.precision || 0), 0) /
            foldMetrics.filter((m) => m.precision !== null).length
          : null,
      recall:
        foldMetrics.filter((m) => m.recall !== null).length > 0
          ? foldMetrics.filter((m) => m.recall !== null).reduce((a, b) => a + (b.recall || 0), 0) /
            foldMetrics.filter((m) => m.recall !== null).length
          : null,
      f1Score:
        foldMetrics.filter((m) => m.f1Score !== null).length > 0
          ? foldMetrics
              .filter((m) => m.f1Score !== null)
              .reduce((a, b) => a + (b.f1Score || 0), 0) /
            foldMetrics.filter((m) => m.f1Score !== null).length
          : null,
      aucRoc: null,
      trainingDurationMs: foldMetrics.reduce((a, b) => a + b.trainingDurationMs, 0),
      samplesUsed: foldMetrics.reduce((a, b) => a + b.samplesUsed, 0) / nFolds,
    };

    // Calculate std deviation (simplified)
    const stdMetrics: Partial<TrainingMetrics> = {
      loss: Math.sqrt(
        foldMetrics.reduce((a, b) => a + Math.pow(b.loss - meanMetrics.loss, 2), 0) / nFolds
      ),
    };

    return {
      nFolds,
      foldMetrics,
      meanMetrics,
      stdMetrics,
    };
  }

  /**
   * Serialize trained model
   */
  private serializeModel(trees: IsolationTree[]): string {
    return JSON.stringify(trees);
  }

  /**
   * Deserialize trained model
   */
  deserializeModel(serialized: string): IsolationTree[] {
    return JSON.parse(serialized);
  }

  /**
   * Train model on dataset
   */
  async train(
    datasetId: string,
    modelName: string,
    version: string = "1.0.0"
  ): Promise<TrainedModel> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    if (dataset.sampleCount < this.config.minSamples) {
      throw new Error(
        `Insufficient samples: ${dataset.sampleCount} < ${this.config.minSamples} required`
      );
    }

    const jobId = this.generateId("job");
    const jobStatus: TrainingJobStatus = {
      jobId,
      status: JobStatus.RUNNING,
      progress: 0,
      stage: TrainingStage.DATA_PREPARATION,
      stageProgress: 0,
      startedAt: new Date(),
    };
    this.jobs.set(jobId, jobStatus);

    this.emit("training_started", { jobId, datasetId });

    try {
      const startTime = Date.now();

      // Stage 1: Data preparation
      this.updateJobStatus(jobId, TrainingStage.DATA_PREPARATION, 0, 10);
      const { features, labels } = this.prepareTrainingData(datasetId);

      // Stage 2: Feature extraction (already done in preparation)
      this.updateJobStatus(jobId, TrainingStage.FEATURE_EXTRACTION, 10, 20);

      // Stage 3: Feature scaling (already done in preparation)
      this.updateJobStatus(jobId, TrainingStage.FEATURE_SCALING, 20, 30);

      // Stage 4: Model training
      this.updateJobStatus(jobId, TrainingStage.MODEL_TRAINING, 30, 60);
      const { trees, threshold } = this.trainIsolationForest(features, this.config.architecture);

      // Stage 5: Cross-validation
      this.updateJobStatus(jobId, TrainingStage.CROSS_VALIDATION, 60, 80);
      const crossValidation = this.runCrossValidation(
        features,
        labels,
        this.config.architecture,
        dataset.featureDefinitions,
        this.config.cvFolds
      );

      // Stage 6: Model evaluation
      this.updateJobStatus(jobId, TrainingStage.MODEL_EVALUATION, 80, 90);
      const scores = features.map((sample) => this.calculateAnomalyScore(sample, trees));
      const predictions = scores.map((score) => score >= threshold);
      const trainingMetrics = this.evaluateModel(predictions, labels, scores);
      trainingMetrics.trainingDurationMs = Date.now() - startTime;

      // Stage 7: Model serialization
      this.updateJobStatus(jobId, TrainingStage.MODEL_SERIALIZATION, 90, 100);
      const featureImportances = this.calculateFeatureImportances(
        trees,
        dataset.featureDefinitions
      );

      const modelId = this.generateId("model");
      const model: TrainedModel = {
        id: modelId,
        name: modelName,
        version,
        architecture: this.config.architecture,
        trainingMetrics,
        crossValidation,
        featureImportances,
        threshold,
        serializedModel: this.serializeModel(trees),
        featureDefinitions: [...dataset.featureDefinitions],
        trainedAt: new Date(),
        datasetId,
        status: ModelStatus.READY,
      };

      this.models.set(modelId, model);

      // Update job status
      jobStatus.status = JobStatus.COMPLETED;
      jobStatus.progress = 100;
      jobStatus.completedAt = new Date();
      jobStatus.modelId = modelId;

      this.emit("training_completed", { jobId, modelId, metrics: trainingMetrics });

      return model;
    } catch (error) {
      jobStatus.status = JobStatus.FAILED;
      jobStatus.error = error instanceof Error ? error.message : String(error);
      this.emit("training_failed", { jobId, error: jobStatus.error });
      throw error;
    }
  }

  /**
   * Update job status
   */
  private updateJobStatus(
    jobId: string,
    stage: TrainingStage,
    stageProgress: number,
    totalProgress: number
  ): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stage = stage;
      job.stageProgress = stageProgress;
      job.progress = totalProgress;
      this.emit("stage_changed", { jobId, stage, progress: totalProgress });
    }
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Get trained model by ID
   */
  getModel(modelId: string): TrainedModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all trained models
   */
  getAllModels(): TrainedModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get training job status
   */
  getJobStatus(jobId: string): TrainingJobStatus | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all training jobs
   */
  getAllJobs(): TrainingJobStatus[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Export model to JSON format
   */
  exportModel(modelId: string): string {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const exportData = {
      ...model,
      exportedAt: new Date().toISOString(),
    };

    this.emit("model_exported", { modelId, path: "json_string" });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import model from JSON format
   */
  importModel(jsonString: string): TrainedModel {
    const modelData = JSON.parse(jsonString);

    // Validate required fields
    if (!modelData.id || !modelData.name || !modelData.serializedModel) {
      throw new Error("Invalid model format: missing required fields");
    }

    const model: TrainedModel = {
      id: modelData.id,
      name: modelData.name,
      version: modelData.version || "1.0.0",
      architecture: modelData.architecture || DEFAULT_MODEL_ARCHITECTURE,
      trainingMetrics: modelData.trainingMetrics,
      crossValidation: modelData.crossValidation,
      featureImportances: modelData.featureImportances || {},
      threshold: modelData.threshold || 0.5,
      serializedModel: modelData.serializedModel,
      featureDefinitions: modelData.featureDefinitions || DEFAULT_FEATURE_DEFINITIONS,
      trainedAt: new Date(modelData.trainedAt),
      datasetId: modelData.datasetId,
      status: ModelStatus.READY,
    };

    this.models.set(model.id, model);
    return model;
  }

  /**
   * Deprecate a model
   */
  deprecateModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      model.status = ModelStatus.DEPRECATED;
    }
  }

  /**
   * Delete a model
   */
  deleteModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /**
   * Delete a dataset
   */
  deleteDataset(datasetId: string): boolean {
    return this.datasets.delete(datasetId);
  }

  // ============================================================================
  // Inference
  // ============================================================================

  /**
   * Score a single sample using trained model
   */
  scoreAnomaly(modelId: string, sample: Record<string, number>): number {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status !== ModelStatus.READY) {
      throw new Error(`Model is not ready: ${model.status}`);
    }

    // Prepare features
    const trainingSample: TrainingSample = {
      id: "inference",
      walletAddress: "inference",
      features: sample,
      label: null,
      timestamp: new Date(),
    };

    const featureVector = this.prepareFeatures(trainingSample, model.featureDefinitions);
    if (featureVector.length === 0) {
      throw new Error("Could not prepare features: missing required values");
    }

    const scaledFeatures = this.scaleFeatures(featureVector, model.featureDefinitions);

    // Calculate anomaly score
    const trees = this.deserializeModel(model.serializedModel);
    return this.calculateAnomalyScore(scaledFeatures, trees);
  }

  /**
   * Classify a sample as anomaly or normal
   */
  classifyAnomaly(modelId: string, sample: Record<string, number>): boolean {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const score = this.scoreAnomaly(modelId, sample);
    return score >= model.threshold;
  }

  /**
   * Batch score samples
   */
  batchScoreAnomalies(
    modelId: string,
    samples: Record<string, number>[]
  ): { scores: number[]; predictions: boolean[] } {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const scores = samples.map((sample) => this.scoreAnomaly(modelId, sample));
    const predictions = scores.map((score) => score >= model.threshold);

    return { scores, predictions };
  }

  // ============================================================================
  // Summary
  // ============================================================================

  /**
   * Get pipeline summary
   */
  getSummary(): {
    config: TrainingPipelineConfig;
    datasetCount: number;
    totalSamples: number;
    modelCount: number;
    readyModels: number;
    activeJobs: number;
  } {
    const datasets = Array.from(this.datasets.values());
    const models = Array.from(this.models.values());
    const jobs = Array.from(this.jobs.values());

    return {
      config: this.config,
      datasetCount: datasets.length,
      totalSamples: datasets.reduce((a, b) => a + b.sampleCount, 0),
      modelCount: models.length,
      readyModels: models.filter((m) => m.status === ModelStatus.READY).length,
      activeJobs: jobs.filter((j) => j.status === JobStatus.RUNNING).length,
    };
  }

  /**
   * Reset pipeline state
   */
  reset(): void {
    this.datasets.clear();
    this.models.clear();
    this.jobs.clear();
    this.featureStats.clear();
    this.idCounter = 0;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedPipeline: AnomalyDetectionTrainingPipeline | null = null;

/**
 * Create a new anomaly detection training pipeline
 */
export function createAnomalyDetectionTrainingPipeline(
  config?: Partial<TrainingPipelineConfig>
): AnomalyDetectionTrainingPipeline {
  return new AnomalyDetectionTrainingPipeline(config);
}

/**
 * Get the shared anomaly detection training pipeline instance
 */
export function getSharedAnomalyDetectionTrainingPipeline(): AnomalyDetectionTrainingPipeline {
  if (!sharedPipeline) {
    sharedPipeline = new AnomalyDetectionTrainingPipeline();
  }
  return sharedPipeline;
}

/**
 * Set the shared anomaly detection training pipeline instance
 */
export function setSharedAnomalyDetectionTrainingPipeline(
  pipeline: AnomalyDetectionTrainingPipeline
): void {
  sharedPipeline = pipeline;
}

/**
 * Reset the shared anomaly detection training pipeline instance
 */
export function resetSharedAnomalyDetectionTrainingPipeline(): void {
  if (sharedPipeline) {
    sharedPipeline.reset();
  }
  sharedPipeline = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get feature category description
 */
export function getFeatureCategoryDescription(category: FeatureCategory): string {
  const descriptions: Record<FeatureCategory, string> = {
    [FeatureCategory.WALLET_BEHAVIOR]: "Wallet behavior and history characteristics",
    [FeatureCategory.TRADING_PATTERN]: "Trading pattern and execution features",
    [FeatureCategory.VOLUME]: "Volume and size-related features",
    [FeatureCategory.TIMING]: "Timing and temporal pattern features",
    [FeatureCategory.MARKET_SELECTION]: "Market selection and category features",
    [FeatureCategory.PERFORMANCE]: "Performance and profitability features",
    [FeatureCategory.NETWORK]: "Network and coordination features",
  };
  return descriptions[category] || "Unknown category";
}

/**
 * Get model type description
 */
export function getModelTypeDescription(type: ModelType): string {
  const descriptions: Record<ModelType, string> = {
    [ModelType.ISOLATION_FOREST]: "Isolation Forest - tree-based anomaly detection",
    [ModelType.LOCAL_OUTLIER_FACTOR]: "Local Outlier Factor - density-based detection",
    [ModelType.ONE_CLASS_SVM]: "One-Class SVM - boundary-based detection",
    [ModelType.STATISTICAL]: "Statistical - z-score based detection",
  };
  return descriptions[type] || "Unknown model type";
}

/**
 * Get training stage description
 */
export function getTrainingStageDescription(stage: TrainingStage): string {
  const descriptions: Record<TrainingStage, string> = {
    [TrainingStage.DATA_PREPARATION]: "Preparing training data",
    [TrainingStage.FEATURE_EXTRACTION]: "Extracting features from samples",
    [TrainingStage.FEATURE_SCALING]: "Scaling features for training",
    [TrainingStage.MODEL_TRAINING]: "Training the model",
    [TrainingStage.CROSS_VALIDATION]: "Running cross-validation",
    [TrainingStage.MODEL_EVALUATION]: "Evaluating model performance",
    [TrainingStage.MODEL_SERIALIZATION]: "Serializing trained model",
  };
  return descriptions[stage] || "Unknown stage";
}

/**
 * Get model status description
 */
export function getModelStatusDescription(status: ModelStatus): string {
  const descriptions: Record<ModelStatus, string> = {
    [ModelStatus.TRAINING]: "Model is currently being trained",
    [ModelStatus.READY]: "Model is trained and ready for inference",
    [ModelStatus.FAILED]: "Model training failed",
    [ModelStatus.DEPRECATED]: "Model has been deprecated",
  };
  return descriptions[status] || "Unknown status";
}

/**
 * Get job status description
 */
export function getJobStatusDescription(status: JobStatus): string {
  const descriptions: Record<JobStatus, string> = {
    [JobStatus.PENDING]: "Job is pending execution",
    [JobStatus.RUNNING]: "Job is currently running",
    [JobStatus.COMPLETED]: "Job completed successfully",
    [JobStatus.FAILED]: "Job failed",
    [JobStatus.CANCELLED]: "Job was cancelled",
  };
  return descriptions[status] || "Unknown status";
}
