/**
 * Unit Tests for Anomaly Detection Model Training Pipeline (AI-PAT-001)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AnomalyDetectionTrainingPipeline,
  createAnomalyDetectionTrainingPipeline,
  getSharedAnomalyDetectionTrainingPipeline,
  setSharedAnomalyDetectionTrainingPipeline,
  resetSharedAnomalyDetectionTrainingPipeline,
  FeatureCategory,
  ModelType,
  ModelStatus,
  JobStatus,
  TrainingStage,
  MissingValueStrategy,
  ScalingMethod,
  DEFAULT_FEATURE_DEFINITIONS,
  DEFAULT_MODEL_ARCHITECTURE,
  DEFAULT_TRAINING_CONFIG,
  getFeatureCategoryDescription,
  getModelTypeDescription,
  getTrainingStageDescription,
  getModelStatusDescription,
  getJobStatusDescription,
} from "../../src/ai/anomaly-detection-training";

describe("AnomalyDetectionTrainingPipeline", () => {
  let pipeline: AnomalyDetectionTrainingPipeline;

  beforeEach(() => {
    pipeline = createAnomalyDetectionTrainingPipeline();
  });

  afterEach(() => {
    pipeline.reset();
    resetSharedAnomalyDetectionTrainingPipeline();
  });

  // ============================================================================
  // Construction and Configuration
  // ============================================================================

  describe("Construction and Configuration", () => {
    it("should create pipeline with default config", () => {
      expect(pipeline).toBeInstanceOf(AnomalyDetectionTrainingPipeline);
      const config = pipeline.getConfig();
      expect(config.featureDefinitions).toEqual(DEFAULT_FEATURE_DEFINITIONS);
      expect(config.architecture).toEqual(DEFAULT_MODEL_ARCHITECTURE);
    });

    it("should create pipeline with custom config", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        minSamples: 50,
        cvFolds: 3,
      });
      const config = customPipeline.getConfig();
      expect(config.minSamples).toBe(50);
      expect(config.cvFolds).toBe(3);
    });

    it("should update config", () => {
      pipeline.updateConfig({ minSamples: 200 });
      const config = pipeline.getConfig();
      expect(config.minSamples).toBe(200);
    });

    it("should handle singleton management", () => {
      const shared1 = getSharedAnomalyDetectionTrainingPipeline();
      const shared2 = getSharedAnomalyDetectionTrainingPipeline();
      expect(shared1).toBe(shared2);

      const newPipeline = createAnomalyDetectionTrainingPipeline();
      setSharedAnomalyDetectionTrainingPipeline(newPipeline);
      const shared3 = getSharedAnomalyDetectionTrainingPipeline();
      expect(shared3).toBe(newPipeline);
    });

    it("should reset shared pipeline", () => {
      const shared = getSharedAnomalyDetectionTrainingPipeline();
      shared.createDataset("test");
      expect(shared.getAllDatasets().length).toBe(1);

      resetSharedAnomalyDetectionTrainingPipeline();
      const newShared = getSharedAnomalyDetectionTrainingPipeline();
      expect(newShared.getAllDatasets().length).toBe(0);
    });
  });

  // ============================================================================
  // Dataset Management
  // ============================================================================

  describe("Dataset Management", () => {
    it("should create dataset", () => {
      const dataset = pipeline.createDataset("test-dataset");
      expect(dataset.id).toContain("dataset_");
      expect(dataset.name).toBe("test-dataset");
      expect(dataset.sampleCount).toBe(0);
      expect(dataset.samples).toEqual([]);
    });

    it("should add sample to dataset", () => {
      const dataset = pipeline.createDataset("test");
      const sample = pipeline.addSample(dataset.id, {
        walletAddress: "0x1234",
        features: {
          total_trades: 100,
          avg_trade_size: 500,
          win_rate: 0.6,
        },
        label: false,
        timestamp: new Date(),
      });

      expect(sample.id).toContain("sample_");
      expect(sample.walletAddress).toBe("0x1234");
      expect(dataset.sampleCount).toBe(1);
      expect(dataset.labeledCount).toBe(1);
      expect(dataset.anomalyCount).toBe(0);
    });

    it("should add anomaly sample", () => {
      const dataset = pipeline.createDataset("test");
      pipeline.addSample(dataset.id, {
        walletAddress: "0x1234",
        features: { total_trades: 100 },
        label: true, // anomaly
        timestamp: new Date(),
      });

      expect(dataset.anomalyCount).toBe(1);
    });

    it("should add unlabeled sample", () => {
      const dataset = pipeline.createDataset("test");
      pipeline.addSample(dataset.id, {
        walletAddress: "0x1234",
        features: { total_trades: 100 },
        label: null, // unlabeled
        timestamp: new Date(),
      });

      expect(dataset.labeledCount).toBe(0);
      expect(dataset.sampleCount).toBe(1);
    });

    it("should add multiple samples", () => {
      const dataset = pipeline.createDataset("test");
      const samples = pipeline.addSamples(dataset.id, [
        { walletAddress: "0x1", features: { total_trades: 10 }, label: false, timestamp: new Date() },
        { walletAddress: "0x2", features: { total_trades: 20 }, label: true, timestamp: new Date() },
        { walletAddress: "0x3", features: { total_trades: 30 }, label: null, timestamp: new Date() },
      ]);

      expect(samples.length).toBe(3);
      expect(dataset.sampleCount).toBe(3);
      expect(dataset.labeledCount).toBe(2);
      expect(dataset.anomalyCount).toBe(1);
    });

    it("should throw error for non-existent dataset", () => {
      expect(() => {
        pipeline.addSample("non-existent", {
          walletAddress: "0x1",
          features: {},
          label: null,
          timestamp: new Date(),
        });
      }).toThrow("Dataset not found");
    });

    it("should get dataset by ID", () => {
      const created = pipeline.createDataset("test");
      const retrieved = pipeline.getDataset(created.id);
      expect(retrieved).toBe(created);
    });

    it("should get all datasets", () => {
      pipeline.createDataset("test1");
      pipeline.createDataset("test2");
      const datasets = pipeline.getAllDatasets();
      expect(datasets.length).toBe(2);
    });

    it("should delete dataset", () => {
      const dataset = pipeline.createDataset("test");
      expect(pipeline.getAllDatasets().length).toBe(1);

      const deleted = pipeline.deleteDataset(dataset.id);
      expect(deleted).toBe(true);
      expect(pipeline.getAllDatasets().length).toBe(0);
    });
  });

  // ============================================================================
  // Data Preparation
  // ============================================================================

  describe("Data Preparation", () => {
    it("should prepare training data", () => {
      const dataset = pipeline.createDataset("test");
      for (let i = 0; i < 10; i++) {
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: i * 10,
            avg_trade_size: i * 100,
            win_rate: 0.5 + i * 0.05,
          },
          label: i % 2 === 0,
          timestamp: new Date(),
        });
      }

      const { features, labels, sampleIds } = pipeline.prepareTrainingData(dataset.id);
      expect(features.length).toBe(10);
      expect(labels.length).toBe(10);
      expect(sampleIds.length).toBe(10);
      expect(features[0]!.length).toBe(DEFAULT_FEATURE_DEFINITIONS.length);
    });

    it("should handle missing values with default strategy", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        missingValueStrategy: MissingValueStrategy.DEFAULT_VALUE,
      });
      const dataset = customPipeline.createDataset("test");
      customPipeline.addSample(dataset.id, {
        walletAddress: "0x1",
        features: { total_trades: 100 }, // missing other features
        label: false,
        timestamp: new Date(),
      });

      const { features } = customPipeline.prepareTrainingData(dataset.id);
      expect(features.length).toBe(1);
      // Missing values should be filled with defaults
      expect(features[0]!.length).toBe(DEFAULT_FEATURE_DEFINITIONS.length);
    });

    it("should scale features with min-max", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.MIN_MAX,
      });
      const dataset = customPipeline.createDataset("test");
      for (let i = 0; i < 10; i++) {
        customPipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: i * 10, // 0 to 90
            avg_trade_size: 1000,
            win_rate: 0.5,
          },
          label: false,
          timestamp: new Date(),
        });
      }

      const { features } = customPipeline.prepareTrainingData(dataset.id);
      // After min-max scaling, values should be between 0 and 1
      // Check the total_trades feature (index 1 in default definitions)
      const totalTradesIndex = DEFAULT_FEATURE_DEFINITIONS.findIndex(
        (f) => f.name === "total_trades"
      );
      const totalTradesValues = features.map((f) => f[totalTradesIndex] ?? 0);
      expect(Math.min(...totalTradesValues)).toBeCloseTo(0, 5);
      expect(Math.max(...totalTradesValues)).toBeCloseTo(1, 5);
    });

    it("should throw error for non-existent dataset in preparation", () => {
      expect(() => {
        pipeline.prepareTrainingData("non-existent");
      }).toThrow("Dataset not found");
    });
  });

  // ============================================================================
  // Model Training
  // ============================================================================

  describe("Model Training", () => {
    let datasetId: string;

    beforeEach(() => {
      // Create dataset with enough samples
      const dataset = pipeline.createDataset("training-test");
      datasetId = dataset.id;

      // Add 150 samples (more than minSamples default of 100)
      for (let i = 0; i < 150; i++) {
        const isAnomaly = i < 15; // 10% anomaly rate
        pipeline.addSample(datasetId, {
          walletAddress: `0x${i.toString(16).padStart(40, "0")}`,
          features: {
            wallet_age_days: isAnomaly ? Math.random() * 7 : Math.random() * 365 + 30,
            total_trades: isAnomaly ? Math.random() * 5 : Math.random() * 100 + 20,
            unique_markets: isAnomaly ? 1 : Math.floor(Math.random() * 20) + 5,
            avg_trade_size: isAnomaly ? Math.random() * 50000 + 10000 : Math.random() * 1000,
            trade_size_stddev: Math.random() * 500,
            buy_sell_ratio: 0.3 + Math.random() * 0.4,
            holding_period_avg: Math.random() * 168,
            volume_spike_count: isAnomaly ? Math.floor(Math.random() * 10) : 0,
            whale_trade_count: isAnomaly ? Math.floor(Math.random() * 5) : 0,
            total_volume_usd: Math.random() * 100000,
            off_hours_ratio: Math.random() * 0.3,
            pre_event_trade_ratio: isAnomaly ? 0.8 + Math.random() * 0.2 : Math.random() * 0.1,
            timing_consistency_score: Math.random(),
            market_concentration: isAnomaly ? 0.9 + Math.random() * 0.1 : Math.random() * 0.5,
            niche_market_ratio: isAnomaly ? 0.8 : Math.random() * 0.2,
            political_market_ratio: Math.random() * 0.3,
            win_rate: isAnomaly ? 0.9 + Math.random() * 0.1 : 0.4 + Math.random() * 0.2,
            profit_factor: isAnomaly ? 5 + Math.random() * 5 : 0.8 + Math.random() * 0.4,
            max_consecutive_wins: isAnomaly ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 5),
            coordination_score: isAnomaly ? Math.random() * 50 + 50 : Math.random() * 20,
            cluster_membership_count: isAnomaly ? Math.floor(Math.random() * 5) : 0,
            sybil_risk_score: isAnomaly ? Math.random() * 50 + 50 : Math.random() * 20,
          },
          label: isAnomaly,
          timestamp: new Date(),
        });
      }
    });

    it("should train model successfully", async () => {
      const model = await pipeline.train(datasetId, "test-model", "1.0.0");

      expect(model.id).toContain("model_");
      expect(model.name).toBe("test-model");
      expect(model.version).toBe("1.0.0");
      expect(model.status).toBe(ModelStatus.READY);
      expect(model.datasetId).toBe(datasetId);
      expect(model.serializedModel).toBeTruthy();
      expect(model.threshold).toBeGreaterThan(0);
      expect(model.featureImportances).toBeTruthy();
    });

    it("should calculate training metrics", async () => {
      const model = await pipeline.train(datasetId, "test-model");

      expect(model.trainingMetrics).toBeTruthy();
      expect(model.trainingMetrics.samplesUsed).toBe(150);
      expect(model.trainingMetrics.trainingDurationMs).toBeGreaterThan(0);
    });

    it("should run cross-validation", async () => {
      const model = await pipeline.train(datasetId, "test-model");

      expect(model.crossValidation).toBeTruthy();
      expect(model.crossValidation?.nFolds).toBe(5); // default
      expect(model.crossValidation?.foldMetrics.length).toBe(5);
      expect(model.crossValidation?.meanMetrics).toBeTruthy();
    });

    it("should calculate feature importances", async () => {
      const model = await pipeline.train(datasetId, "test-model");

      const importances = Object.values(model.featureImportances);
      const sum = importances.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1); // Should sum to ~1 (normalized)
    });

    it("should throw error for insufficient samples", async () => {
      const smallDataset = pipeline.createDataset("small");
      for (let i = 0; i < 50; i++) {
        pipeline.addSample(smallDataset.id, {
          walletAddress: `0x${i}`,
          features: { total_trades: i },
          label: false,
          timestamp: new Date(),
        });
      }

      await expect(pipeline.train(smallDataset.id, "test")).rejects.toThrow(
        "Insufficient samples"
      );
    });

    it("should throw error for non-existent dataset", async () => {
      await expect(pipeline.train("non-existent", "test")).rejects.toThrow("Dataset not found");
    });

    it("should emit training events", async () => {
      const events: string[] = [];
      pipeline.on("training_started", () => events.push("started"));
      pipeline.on("stage_changed", () => events.push("stage"));
      pipeline.on("training_completed", () => events.push("completed"));

      await pipeline.train(datasetId, "test-model");

      expect(events).toContain("started");
      expect(events).toContain("stage");
      expect(events).toContain("completed");
    });

    it("should track training job status", async () => {
      const trainPromise = pipeline.train(datasetId, "test-model");

      // Job should be created immediately
      const jobs = pipeline.getAllJobs();
      expect(jobs.length).toBe(1);

      await trainPromise;

      const completedJob = jobs[0]!;
      expect(completedJob.status).toBe(JobStatus.COMPLETED);
      expect(completedJob.progress).toBe(100);
      expect(completedJob.modelId).toBeTruthy();
    });
  });

  // ============================================================================
  // Model Management
  // ============================================================================

  describe("Model Management", () => {
    let modelId: string;

    beforeEach(async () => {
      const dataset = pipeline.createDataset("test");
      for (let i = 0; i < 150; i++) {
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: Math.random() * 100,
            avg_trade_size: Math.random() * 1000,
            win_rate: Math.random(),
          },
          label: i < 15,
          timestamp: new Date(),
        });
      }
      const model = await pipeline.train(dataset.id, "test-model");
      modelId = model.id;
    });

    it("should get model by ID", () => {
      const model = pipeline.getModel(modelId);
      expect(model).toBeTruthy();
      expect(model?.name).toBe("test-model");
    });

    it("should get all models", () => {
      const models = pipeline.getAllModels();
      expect(models.length).toBe(1);
    });

    it("should export model to JSON", () => {
      const exported = pipeline.exportModel(modelId);
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe(modelId);
      expect(parsed.name).toBe("test-model");
      expect(parsed.serializedModel).toBeTruthy();
      expect(parsed.exportedAt).toBeTruthy();
    });

    it("should import model from JSON", () => {
      const exported = pipeline.exportModel(modelId);
      pipeline.deleteModel(modelId);

      const imported = pipeline.importModel(exported);
      expect(imported.id).toBe(modelId);
      expect(imported.status).toBe(ModelStatus.READY);
    });

    it("should throw error exporting non-existent model", () => {
      expect(() => {
        pipeline.exportModel("non-existent");
      }).toThrow("Model not found");
    });

    it("should throw error importing invalid JSON", () => {
      expect(() => {
        pipeline.importModel('{"invalid": "model"}');
      }).toThrow("Invalid model format");
    });

    it("should deprecate model", () => {
      pipeline.deprecateModel(modelId);
      const model = pipeline.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.DEPRECATED);
    });

    it("should delete model", () => {
      const deleted = pipeline.deleteModel(modelId);
      expect(deleted).toBe(true);
      expect(pipeline.getModel(modelId)).toBeUndefined();
    });
  });

  // ============================================================================
  // Inference
  // ============================================================================

  describe("Inference", () => {
    let modelId: string;

    beforeEach(async () => {
      const dataset = pipeline.createDataset("test");
      for (let i = 0; i < 150; i++) {
        const isAnomaly = i < 15;
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: isAnomaly ? 2 : 50 + Math.random() * 50,
            avg_trade_size: isAnomaly ? 50000 : 500 + Math.random() * 500,
            win_rate: isAnomaly ? 0.95 : 0.45 + Math.random() * 0.1,
            pre_event_trade_ratio: isAnomaly ? 0.9 : Math.random() * 0.1,
          },
          label: isAnomaly,
          timestamp: new Date(),
        });
      }
      const model = await pipeline.train(dataset.id, "test-model");
      modelId = model.id;
    });

    it("should score single sample", () => {
      const score = pipeline.scoreAnomaly(modelId, {
        total_trades: 100,
        avg_trade_size: 500,
        win_rate: 0.5,
      });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should classify sample as anomaly or normal", () => {
      const normalSample = {
        total_trades: 80,
        avg_trade_size: 400,
        win_rate: 0.5,
        pre_event_trade_ratio: 0.05,
      };

      const anomalySample = {
        total_trades: 2,
        avg_trade_size: 60000,
        win_rate: 0.98,
        pre_event_trade_ratio: 0.95,
      };

      const normalResult = pipeline.classifyAnomaly(modelId, normalSample);
      const anomalyResult = pipeline.classifyAnomaly(modelId, anomalySample);

      // Results should be boolean
      expect(typeof normalResult).toBe("boolean");
      expect(typeof anomalyResult).toBe("boolean");
    });

    it("should batch score samples", () => {
      const samples = [
        { total_trades: 50, avg_trade_size: 400, win_rate: 0.5 },
        { total_trades: 80, avg_trade_size: 600, win_rate: 0.55 },
        { total_trades: 3, avg_trade_size: 50000, win_rate: 0.95 },
      ];

      const { scores, predictions } = pipeline.batchScoreAnomalies(modelId, samples);

      expect(scores.length).toBe(3);
      expect(predictions.length).toBe(3);
      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it("should throw error for non-existent model", () => {
      expect(() => {
        pipeline.scoreAnomaly("non-existent", { total_trades: 10 });
      }).toThrow("Model not found");
    });

    it("should throw error for deprecated model", () => {
      pipeline.deprecateModel(modelId);
      expect(() => {
        pipeline.scoreAnomaly(modelId, { total_trades: 10 });
      }).toThrow("Model is not ready");
    });
  });

  // ============================================================================
  // Summary and State
  // ============================================================================

  describe("Summary and State", () => {
    it("should return correct summary", async () => {
      const dataset = pipeline.createDataset("test");
      for (let i = 0; i < 150; i++) {
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: { total_trades: i },
          label: false,
          timestamp: new Date(),
        });
      }
      await pipeline.train(dataset.id, "test-model");

      const summary = pipeline.getSummary();

      expect(summary.datasetCount).toBe(1);
      expect(summary.totalSamples).toBe(150);
      expect(summary.modelCount).toBe(1);
      expect(summary.readyModels).toBe(1);
      expect(summary.config).toBeTruthy();
    });

    it("should reset pipeline state", async () => {
      const dataset = pipeline.createDataset("test");
      for (let i = 0; i < 150; i++) {
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: { total_trades: i },
          label: false,
          timestamp: new Date(),
        });
      }
      await pipeline.train(dataset.id, "test-model");

      pipeline.reset();

      const summary = pipeline.getSummary();
      expect(summary.datasetCount).toBe(0);
      expect(summary.modelCount).toBe(0);
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe("Utility Functions", () => {
    it("should return feature category descriptions", () => {
      expect(getFeatureCategoryDescription(FeatureCategory.WALLET_BEHAVIOR)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.TRADING_PATTERN)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.VOLUME)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.TIMING)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.MARKET_SELECTION)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.PERFORMANCE)).toBeTruthy();
      expect(getFeatureCategoryDescription(FeatureCategory.NETWORK)).toBeTruthy();
    });

    it("should return model type descriptions", () => {
      expect(getModelTypeDescription(ModelType.ISOLATION_FOREST)).toContain("Isolation Forest");
      expect(getModelTypeDescription(ModelType.LOCAL_OUTLIER_FACTOR)).toContain("Local Outlier");
      expect(getModelTypeDescription(ModelType.ONE_CLASS_SVM)).toContain("SVM");
      expect(getModelTypeDescription(ModelType.STATISTICAL)).toContain("Statistical");
    });

    it("should return training stage descriptions", () => {
      expect(getTrainingStageDescription(TrainingStage.DATA_PREPARATION)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.FEATURE_EXTRACTION)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.FEATURE_SCALING)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.MODEL_TRAINING)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.CROSS_VALIDATION)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.MODEL_EVALUATION)).toBeTruthy();
      expect(getTrainingStageDescription(TrainingStage.MODEL_SERIALIZATION)).toBeTruthy();
    });

    it("should return model status descriptions", () => {
      expect(getModelStatusDescription(ModelStatus.TRAINING)).toBeTruthy();
      expect(getModelStatusDescription(ModelStatus.READY)).toBeTruthy();
      expect(getModelStatusDescription(ModelStatus.FAILED)).toBeTruthy();
      expect(getModelStatusDescription(ModelStatus.DEPRECATED)).toBeTruthy();
    });

    it("should return job status descriptions", () => {
      expect(getJobStatusDescription(JobStatus.PENDING)).toBeTruthy();
      expect(getJobStatusDescription(JobStatus.RUNNING)).toBeTruthy();
      expect(getJobStatusDescription(JobStatus.COMPLETED)).toBeTruthy();
      expect(getJobStatusDescription(JobStatus.FAILED)).toBeTruthy();
      expect(getJobStatusDescription(JobStatus.CANCELLED)).toBeTruthy();
    });
  });

  // ============================================================================
  // Default Configurations
  // ============================================================================

  describe("Default Configurations", () => {
    it("should have valid default feature definitions", () => {
      expect(DEFAULT_FEATURE_DEFINITIONS.length).toBeGreaterThan(0);
      DEFAULT_FEATURE_DEFINITIONS.forEach((def) => {
        expect(def.name).toBeTruthy();
        expect(def.category).toBeTruthy();
        expect(typeof def.min).toBe("number");
        expect(typeof def.max).toBe("number");
        expect(def.max).toBeGreaterThanOrEqual(def.min);
        expect(def.weight).toBeGreaterThan(0);
      });
    });

    it("should have valid default model architecture", () => {
      expect(DEFAULT_MODEL_ARCHITECTURE.type).toBe(ModelType.ISOLATION_FOREST);
      expect(DEFAULT_MODEL_ARCHITECTURE.nEstimators).toBeGreaterThan(0);
      expect(DEFAULT_MODEL_ARCHITECTURE.contamination).toBeGreaterThan(0);
      expect(DEFAULT_MODEL_ARCHITECTURE.contamination).toBeLessThanOrEqual(0.5);
    });

    it("should have valid default training config", () => {
      expect(DEFAULT_TRAINING_CONFIG.trainTestSplit).toBeGreaterThan(0);
      expect(DEFAULT_TRAINING_CONFIG.trainTestSplit).toBeLessThan(1);
      expect(DEFAULT_TRAINING_CONFIG.cvFolds).toBeGreaterThan(1);
      expect(DEFAULT_TRAINING_CONFIG.minSamples).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle empty features gracefully", () => {
      const dataset = pipeline.createDataset("test");
      pipeline.addSample(dataset.id, {
        walletAddress: "0x1",
        features: {},
        label: false,
        timestamp: new Date(),
      });

      const { features } = pipeline.prepareTrainingData(dataset.id);
      // Should have one sample with all default values
      expect(features.length).toBe(1);
    });

    it("should handle NaN feature values", () => {
      const dataset = pipeline.createDataset("test");
      pipeline.addSample(dataset.id, {
        walletAddress: "0x1",
        features: {
          total_trades: NaN,
          avg_trade_size: 500,
        },
        label: false,
        timestamp: new Date(),
      });

      const { features } = pipeline.prepareTrainingData(dataset.id);
      // NaN should be replaced with default value
      expect(features[0]!.every((f) => !Number.isNaN(f))).toBe(true);
    });

    it("should clamp feature values to valid range", () => {
      const dataset = pipeline.createDataset("test");
      pipeline.addSample(dataset.id, {
        walletAddress: "0x1",
        features: {
          total_trades: -100, // below min
          avg_trade_size: 999999999, // above max
          win_rate: 2.0, // above max (0-1 range)
        },
        label: false,
        timestamp: new Date(),
      });

      const { features } = pipeline.prepareTrainingData(dataset.id);
      // All features should be within valid ranges
      features[0]!.forEach((value, idx) => {
        const def = DEFAULT_FEATURE_DEFINITIONS[idx];
        if (def) {
          expect(value).toBeGreaterThanOrEqual(def.min);
          expect(value).toBeLessThanOrEqual(def.max);
        }
      });
    });

    it("should handle metadata in samples", () => {
      const dataset = pipeline.createDataset("test");
      const sample = pipeline.addSample(dataset.id, {
        walletAddress: "0x1",
        features: { total_trades: 100 },
        label: false,
        timestamp: new Date(),
        metadata: {
          source: "test",
          version: 1,
        },
      });

      expect(sample.metadata?.source).toBe("test");
    });
  });

  // ============================================================================
  // Scaling Methods
  // ============================================================================

  describe("Scaling Methods", () => {
    let dataset: ReturnType<typeof pipeline.createDataset>;

    beforeEach(() => {
      dataset = pipeline.createDataset("test");
      // Add diverse samples
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: i * 10,
            avg_trade_size: 100 + i * 50,
            win_rate: 0.3 + (i / 100) * 0.4,
          },
          label: false,
          timestamp: new Date(),
        });
      }
    });

    it("should handle standard scaling", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.STANDARD,
      });

      // Rebuild dataset with same samples
      const newDataset = customPipeline.createDataset("test");
      for (let i = 0; i < 100; i++) {
        customPipeline.addSample(newDataset.id, {
          walletAddress: `0x${i}`,
          features: {
            total_trades: i * 10,
            avg_trade_size: 100 + i * 50,
            win_rate: 0.3 + (i / 100) * 0.4,
          },
          label: false,
          timestamp: new Date(),
        });
      }

      const { features } = customPipeline.prepareTrainingData(newDataset.id);
      expect(features.length).toBe(100);
      // Standard scaling should produce values centered around 0
    });

    it("should handle robust scaling", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.ROBUST,
      });

      const newDataset = customPipeline.createDataset("test");
      for (let i = 0; i < 100; i++) {
        customPipeline.addSample(newDataset.id, {
          walletAddress: `0x${i}`,
          features: { total_trades: i * 10 },
          label: false,
          timestamp: new Date(),
        });
      }

      const { features } = customPipeline.prepareTrainingData(newDataset.id);
      expect(features.length).toBe(100);
    });

    it("should handle no scaling", () => {
      const customPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.NONE,
      });

      const newDataset = customPipeline.createDataset("test");
      customPipeline.addSample(newDataset.id, {
        walletAddress: "0x1",
        features: { total_trades: 500 },
        label: false,
        timestamp: new Date(),
      });

      const { features } = customPipeline.prepareTrainingData(newDataset.id);
      // Without scaling, raw values should be preserved
      const totalTradesIdx = DEFAULT_FEATURE_DEFINITIONS.findIndex(
        (f) => f.name === "total_trades"
      );
      expect(features[0]![totalTradesIdx]).toBe(500);
    });
  });
});
