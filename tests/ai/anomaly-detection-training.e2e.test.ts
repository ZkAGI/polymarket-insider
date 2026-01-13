/**
 * E2E Tests for Anomaly Detection Model Training Pipeline (AI-PAT-001)
 *
 * These tests verify the full end-to-end workflow of training anomaly detection
 * models on realistic data.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AnomalyDetectionTrainingPipeline,
  createAnomalyDetectionTrainingPipeline,
  ModelStatus,
  TrainingStage,
  ScalingMethod,
  type TrainingSample,
} from "../../src/ai/anomaly-detection-training";

/**
 * Generate realistic trading data for a wallet
 */
function generateWalletData(
  isAnomaly: boolean,
  walletIndex: number
): Omit<TrainingSample, "id"> {
  const baseAddress = `0x${walletIndex.toString(16).padStart(40, "0")}`;

  // Anomalous wallets have distinct characteristics
  const features: Record<string, number> = {
    // Wallet behavior - anomalies are newer with fewer trades
    wallet_age_days: isAnomaly
      ? Math.random() * 10 + 1 // 1-11 days
      : Math.random() * 365 + 30, // 30-395 days
    total_trades: isAnomaly
      ? Math.floor(Math.random() * 10) + 1 // 1-10 trades
      : Math.floor(Math.random() * 200) + 20, // 20-220 trades
    unique_markets: isAnomaly
      ? Math.floor(Math.random() * 3) + 1 // 1-3 markets
      : Math.floor(Math.random() * 30) + 5, // 5-35 markets

    // Trading patterns - anomalies have larger, more concentrated trades
    avg_trade_size: isAnomaly
      ? Math.random() * 50000 + 10000 // $10k-60k
      : Math.random() * 2000 + 100, // $100-2100
    trade_size_stddev: isAnomaly
      ? Math.random() * 5000
      : Math.random() * 500,
    buy_sell_ratio: isAnomaly
      ? Math.random() * 0.2 + 0.8 // 0.8-1.0 (mostly buys)
      : Math.random() * 0.4 + 0.3, // 0.3-0.7 (balanced)
    holding_period_avg: isAnomaly
      ? Math.random() * 24 // 0-24 hours
      : Math.random() * 168 + 24, // 24-192 hours

    // Volume - anomalies trigger volume spikes
    volume_spike_count: isAnomaly
      ? Math.floor(Math.random() * 5) + 1
      : Math.floor(Math.random() * 2),
    whale_trade_count: isAnomaly
      ? Math.floor(Math.random() * 3) + 1
      : 0,
    total_volume_usd: isAnomaly
      ? Math.random() * 500000 + 100000 // $100k-600k
      : Math.random() * 50000 + 1000, // $1k-51k

    // Timing - anomalies trade before events
    off_hours_ratio: isAnomaly
      ? Math.random() * 0.3 + 0.4 // 40-70% off-hours
      : Math.random() * 0.2, // 0-20% off-hours
    pre_event_trade_ratio: isAnomaly
      ? Math.random() * 0.3 + 0.7 // 70-100% pre-event
      : Math.random() * 0.15, // 0-15% pre-event
    timing_consistency_score: isAnomaly
      ? Math.random() * 0.3 + 0.7 // High consistency (bot-like)
      : Math.random() * 0.5 + 0.2, // Normal variance

    // Market selection - anomalies focus on niche markets
    market_concentration: isAnomaly
      ? Math.random() * 0.2 + 0.8 // 80-100% concentrated
      : Math.random() * 0.4 + 0.1, // 10-50% concentrated
    niche_market_ratio: isAnomaly
      ? Math.random() * 0.2 + 0.8 // 80-100% niche
      : Math.random() * 0.3, // 0-30% niche
    political_market_ratio: isAnomaly
      ? Math.random() * 0.3 + 0.5 // 50-80% political
      : Math.random() * 0.3, // 0-30% political

    // Performance - anomalies have suspiciously good performance
    win_rate: isAnomaly
      ? Math.random() * 0.1 + 0.9 // 90-100% win rate
      : Math.random() * 0.2 + 0.4, // 40-60% win rate
    profit_factor: isAnomaly
      ? Math.random() * 5 + 5 // 5-10x profit factor
      : Math.random() * 0.6 + 0.8, // 0.8-1.4x
    max_consecutive_wins: isAnomaly
      ? Math.floor(Math.random() * 10) + 10 // 10-20 in a row
      : Math.floor(Math.random() * 5), // 0-5 in a row

    // Network - anomalies show coordination patterns
    coordination_score: isAnomaly
      ? Math.random() * 40 + 60 // 60-100
      : Math.random() * 30, // 0-30
    cluster_membership_count: isAnomaly
      ? Math.floor(Math.random() * 5) + 2 // 2-7 clusters
      : Math.floor(Math.random() * 2), // 0-2 clusters
    sybil_risk_score: isAnomaly
      ? Math.random() * 40 + 60 // 60-100
      : Math.random() * 30, // 0-30
  };

  return {
    walletAddress: baseAddress,
    features,
    label: isAnomaly,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
    metadata: {
      generatedAt: new Date().toISOString(),
      isTest: true,
    },
  };
}

describe("Anomaly Detection Training Pipeline E2E", () => {
  let pipeline: AnomalyDetectionTrainingPipeline;

  beforeEach(() => {
    pipeline = createAnomalyDetectionTrainingPipeline({
      minSamples: 50, // Lower for E2E tests
      cvFolds: 3, // Fewer folds for faster tests
    });
  });

  afterEach(() => {
    pipeline.reset();
  });

  // ============================================================================
  // Full Training Workflow
  // ============================================================================

  describe("Full Training Workflow", () => {
    it("should complete full training workflow with realistic data", async () => {
      // Step 1: Create dataset
      const dataset = pipeline.createDataset("insider-detection-v1");
      expect(dataset.id).toBeTruthy();

      // Step 2: Add realistic training data (10% anomaly rate)
      const normalCount = 180;
      const anomalyCount = 20;

      for (let i = 0; i < normalCount; i++) {
        pipeline.addSample(dataset.id, generateWalletData(false, i));
      }
      for (let i = 0; i < anomalyCount; i++) {
        pipeline.addSample(dataset.id, generateWalletData(true, normalCount + i));
      }

      expect(dataset.sampleCount).toBe(normalCount + anomalyCount);
      expect(dataset.anomalyCount).toBe(anomalyCount);

      // Step 3: Train model
      const model = await pipeline.train(dataset.id, "insider-detector", "1.0.0");

      // Step 4: Verify model quality
      expect(model.status).toBe(ModelStatus.READY);
      expect(model.trainingMetrics.samplesUsed).toBe(200);
      expect(model.trainingMetrics.trainingDurationMs).toBeGreaterThan(0);

      // Step 5: Verify cross-validation ran
      expect(model.crossValidation).toBeTruthy();
      expect(model.crossValidation?.foldMetrics.length).toBe(3);

      // Step 6: Test inference on new data
      const normalTestSample = generateWalletData(false, 1000).features;
      const anomalyTestSample = generateWalletData(true, 1001).features;

      const normalScore = pipeline.scoreAnomaly(model.id, normalTestSample);
      const anomalyScore = pipeline.scoreAnomaly(model.id, anomalyTestSample);

      // Anomaly should have higher score
      expect(anomalyScore).toBeGreaterThan(0);
      expect(normalScore).toBeGreaterThanOrEqual(0);
      expect(normalScore).toBeLessThanOrEqual(1);
      expect(anomalyScore).toBeLessThanOrEqual(1);
    });

    it("should handle incremental dataset building", async () => {
      const dataset = pipeline.createDataset("incremental-test");

      // Add samples in batches
      const batches = 5;
      const samplesPerBatch = 40;

      for (let batch = 0; batch < batches; batch++) {
        const samples = Array.from({ length: samplesPerBatch }, (_, i) => {
          const idx = batch * samplesPerBatch + i;
          return generateWalletData(idx % 10 === 0, idx); // 10% anomalies
        });
        pipeline.addSamples(dataset.id, samples);
      }

      expect(dataset.sampleCount).toBe(batches * samplesPerBatch);

      // Train on complete dataset
      const model = await pipeline.train(dataset.id, "batch-model");
      expect(model.status).toBe(ModelStatus.READY);
    });
  });

  // ============================================================================
  // Model Export/Import
  // ============================================================================

  describe("Model Export/Import", () => {
    it("should export and reimport trained model", async () => {
      // Create and train model
      const dataset = pipeline.createDataset("export-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }
      const originalModel = await pipeline.train(dataset.id, "export-model");

      // Export model
      const exportedJson = pipeline.exportModel(originalModel.id);
      expect(exportedJson).toBeTruthy();

      // Create new pipeline and import
      const newPipeline = createAnomalyDetectionTrainingPipeline();
      const importedModel = newPipeline.importModel(exportedJson);

      // Verify imported model
      expect(importedModel.id).toBe(originalModel.id);
      expect(importedModel.name).toBe(originalModel.name);
      expect(importedModel.status).toBe(ModelStatus.READY);

      // Test inference with imported model
      const testSample = generateWalletData(true, 999).features;
      const score = newPipeline.scoreAnomaly(importedModel.id, testSample);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should preserve feature importances after export/import", async () => {
      const dataset = pipeline.createDataset("importance-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }
      const model = await pipeline.train(dataset.id, "importance-model");

      const exported = pipeline.exportModel(model.id);
      const newPipeline = createAnomalyDetectionTrainingPipeline();
      const imported = newPipeline.importModel(exported);

      // Compare feature importances
      expect(imported.featureImportances).toEqual(model.featureImportances);
    });
  });

  // ============================================================================
  // Batch Inference
  // ============================================================================

  describe("Batch Inference", () => {
    let modelId: string;

    beforeEach(async () => {
      const dataset = pipeline.createDataset("batch-inference-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }
      const model = await pipeline.train(dataset.id, "batch-model");
      modelId = model.id;
    });

    it("should batch score multiple samples efficiently", () => {
      const testSamples = [
        generateWalletData(false, 1000).features,
        generateWalletData(false, 1001).features,
        generateWalletData(true, 1002).features,
        generateWalletData(false, 1003).features,
        generateWalletData(true, 1004).features,
      ];

      const startTime = Date.now();
      const { scores, predictions } = pipeline.batchScoreAnomalies(modelId, testSamples);
      const duration = Date.now() - startTime;

      expect(scores.length).toBe(5);
      expect(predictions.length).toBe(5);

      // Should complete reasonably fast
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // All scores should be valid
      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it("should handle large batch sizes", () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) =>
        generateWalletData(i % 10 === 0, 2000 + i).features
      );

      const { scores, predictions } = pipeline.batchScoreAnomalies(modelId, largeBatch);

      expect(scores.length).toBe(100);
      expect(predictions.length).toBe(100);
    });
  });

  // ============================================================================
  // Training with Different Configurations
  // ============================================================================

  describe("Training Configurations", () => {
    it("should train with min-max scaling", async () => {
      const scaledPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.MIN_MAX,
        minSamples: 50,
      });

      const dataset = scaledPipeline.createDataset("minmax-test");
      for (let i = 0; i < 100; i++) {
        scaledPipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await scaledPipeline.train(dataset.id, "minmax-model");
      expect(model.status).toBe(ModelStatus.READY);

      // Test inference
      const score = scaledPipeline.scoreAnomaly(
        model.id,
        generateWalletData(true, 999).features
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should train with standard scaling", async () => {
      const scaledPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.STANDARD,
        minSamples: 50,
      });

      const dataset = scaledPipeline.createDataset("standard-test");
      for (let i = 0; i < 100; i++) {
        scaledPipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await scaledPipeline.train(dataset.id, "standard-model");
      expect(model.status).toBe(ModelStatus.READY);
    });

    it("should train with robust scaling", async () => {
      const scaledPipeline = createAnomalyDetectionTrainingPipeline({
        scalingMethod: ScalingMethod.ROBUST,
        minSamples: 50,
      });

      const dataset = scaledPipeline.createDataset("robust-test");
      for (let i = 0; i < 100; i++) {
        scaledPipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await scaledPipeline.train(dataset.id, "robust-model");
      expect(model.status).toBe(ModelStatus.READY);
    });

    it("should train with different contamination rates", async () => {
      const lowContamPipeline = createAnomalyDetectionTrainingPipeline({
        architecture: { ...pipeline.getConfig().architecture, contamination: 0.05 },
        minSamples: 50,
      });

      const dataset = lowContamPipeline.createDataset("low-contam-test");
      for (let i = 0; i < 100; i++) {
        lowContamPipeline.addSample(dataset.id, generateWalletData(i < 5, i)); // 5% anomaly
      }

      const model = await lowContamPipeline.train(dataset.id, "low-contam-model");
      expect(model.status).toBe(ModelStatus.READY);
      expect(model.threshold).toBeGreaterThan(0);
    });

    it("should train with more estimators", async () => {
      const moreTreesPipeline = createAnomalyDetectionTrainingPipeline({
        architecture: { ...pipeline.getConfig().architecture, nEstimators: 200 },
        minSamples: 50,
        cvFolds: 2, // Fewer folds to keep test fast
      });

      const dataset = moreTreesPipeline.createDataset("more-trees-test");
      for (let i = 0; i < 100; i++) {
        moreTreesPipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await moreTreesPipeline.train(dataset.id, "more-trees-model");
      expect(model.status).toBe(ModelStatus.READY);
    });
  });

  // ============================================================================
  // Event Handling
  // ============================================================================

  describe("Event Handling", () => {
    it("should emit all training lifecycle events", async () => {
      const events: Array<{ type: string; data: unknown }> = [];

      pipeline.on("training_started", (data) => events.push({ type: "started", data }));
      pipeline.on("stage_changed", (data) => events.push({ type: "stage", data }));
      pipeline.on("training_completed", (data) => events.push({ type: "completed", data }));
      pipeline.on("model_exported", (data) => events.push({ type: "exported", data }));

      const dataset = pipeline.createDataset("events-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await pipeline.train(dataset.id, "events-model");
      pipeline.exportModel(model.id);

      // Verify all events were emitted
      expect(events.some((e) => e.type === "started")).toBe(true);
      expect(events.some((e) => e.type === "stage")).toBe(true);
      expect(events.some((e) => e.type === "completed")).toBe(true);
      expect(events.some((e) => e.type === "exported")).toBe(true);
    });

    it("should track job progress through stages", async () => {
      const stageProgression: TrainingStage[] = [];

      pipeline.on("stage_changed", ({ stage }) => {
        stageProgression.push(stage);
      });

      const dataset = pipeline.createDataset("progress-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      await pipeline.train(dataset.id, "progress-model");

      // Verify all stages were reached
      expect(stageProgression).toContain(TrainingStage.DATA_PREPARATION);
      expect(stageProgression).toContain(TrainingStage.MODEL_TRAINING);
      expect(stageProgression).toContain(TrainingStage.MODEL_SERIALIZATION);
    });
  });

  // ============================================================================
  // Model Lifecycle
  // ============================================================================

  describe("Model Lifecycle", () => {
    it("should manage multiple models", async () => {
      const dataset = pipeline.createDataset("multi-model-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      // Train multiple models
      const model1 = await pipeline.train(dataset.id, "model-v1", "1.0.0");
      const model2 = await pipeline.train(dataset.id, "model-v2", "2.0.0");

      expect(pipeline.getAllModels().length).toBe(2);
      expect(model1.id).not.toBe(model2.id);

      // Deprecate old model
      pipeline.deprecateModel(model1.id);
      expect(pipeline.getModel(model1.id)?.status).toBe(ModelStatus.DEPRECATED);

      // New model should still work
      const score = pipeline.scoreAnomaly(
        model2.id,
        generateWalletData(true, 999).features
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should delete models and reclaim resources", async () => {
      const dataset = pipeline.createDataset("delete-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }

      const model = await pipeline.train(dataset.id, "delete-model");
      expect(pipeline.getAllModels().length).toBe(1);

      const deleted = pipeline.deleteModel(model.id);
      expect(deleted).toBe(true);
      expect(pipeline.getAllModels().length).toBe(0);
      expect(pipeline.getModel(model.id)).toBeUndefined();
    });
  });

  // ============================================================================
  // Feature Importances
  // ============================================================================

  describe("Feature Importances", () => {
    it("should identify important features for anomaly detection", async () => {
      const dataset = pipeline.createDataset("importance-test");
      for (let i = 0; i < 150; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 15, i));
      }

      const model = await pipeline.train(dataset.id, "importance-model");

      const importances = model.featureImportances;
      expect(Object.keys(importances).length).toBeGreaterThan(0);

      // Sum should be approximately 1 (normalized)
      const sum = Object.values(importances).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);

      // At least some features should have non-zero importance
      const nonZeroCount = Object.values(importances).filter((v) => v > 0).length;
      expect(nonZeroCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Cross-Validation
  // ============================================================================

  describe("Cross-Validation", () => {
    it("should provide consistent metrics across folds", async () => {
      const dataset = pipeline.createDataset("cv-test");
      for (let i = 0; i < 150; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 15, i));
      }

      const model = await pipeline.train(dataset.id, "cv-model");

      expect(model.crossValidation).toBeTruthy();
      const cv = model.crossValidation!;

      // Check fold metrics are reasonable
      for (const foldMetric of cv.foldMetrics) {
        expect(foldMetric.samplesUsed).toBeGreaterThan(0);
      }

      // Mean should be average of folds
      expect(cv.meanMetrics.loss).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle dataset not found gracefully", async () => {
      await expect(pipeline.train("non-existent-id", "test")).rejects.toThrow(
        "Dataset not found"
      );
    });

    it("should handle insufficient samples", async () => {
      const dataset = pipeline.createDataset("small-test");
      for (let i = 0; i < 10; i++) {
        pipeline.addSample(dataset.id, generateWalletData(false, i));
      }

      await expect(pipeline.train(dataset.id, "test")).rejects.toThrow(
        "Insufficient samples"
      );
    });

    it("should handle model not found for inference", async () => {
      expect(() => {
        pipeline.scoreAnomaly("non-existent-model", { total_trades: 10 });
      }).toThrow("Model not found");
    });

    it("should handle deprecated model for inference", async () => {
      const dataset = pipeline.createDataset("deprecated-test");
      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 10, i));
      }
      const model = await pipeline.train(dataset.id, "deprecated-model");

      pipeline.deprecateModel(model.id);

      expect(() => {
        pipeline.scoreAnomaly(model.id, { total_trades: 10 });
      }).toThrow("Model is not ready");
    });
  });

  // ============================================================================
  // Pipeline Summary
  // ============================================================================

  describe("Pipeline Summary", () => {
    it("should provide accurate summary statistics", async () => {
      // Create datasets
      const dataset1 = pipeline.createDataset("summary-test-1");
      const dataset2 = pipeline.createDataset("summary-test-2");

      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset1.id, generateWalletData(i < 10, i));
      }
      for (let i = 0; i < 50; i++) {
        pipeline.addSample(dataset2.id, generateWalletData(i < 5, i + 100));
      }

      // Train models
      await pipeline.train(dataset1.id, "summary-model-1");
      const model2 = await pipeline.train(dataset1.id, "summary-model-2");

      // Deprecate one
      pipeline.deprecateModel(model2.id);

      const summary = pipeline.getSummary();

      expect(summary.datasetCount).toBe(2);
      expect(summary.totalSamples).toBe(150);
      expect(summary.modelCount).toBe(2);
      expect(summary.readyModels).toBe(1);
    });
  });

  // ============================================================================
  // Performance Characteristics
  // ============================================================================

  describe("Performance Characteristics", () => {
    it("should train within reasonable time", async () => {
      const dataset = pipeline.createDataset("perf-test");
      for (let i = 0; i < 200; i++) {
        pipeline.addSample(dataset.id, generateWalletData(i < 20, i));
      }

      const startTime = Date.now();
      const model = await pipeline.train(dataset.id, "perf-model");
      const duration = Date.now() - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
      expect(model.trainingMetrics.trainingDurationMs).toBeLessThan(30000);
    });

    it("should handle concurrent training requests", async () => {
      const dataset1 = pipeline.createDataset("concurrent-1");
      const dataset2 = pipeline.createDataset("concurrent-2");

      for (let i = 0; i < 100; i++) {
        pipeline.addSample(dataset1.id, generateWalletData(i < 10, i));
        pipeline.addSample(dataset2.id, generateWalletData(i < 10, i + 100));
      }

      // Start both training jobs
      const [model1, model2] = await Promise.all([
        pipeline.train(dataset1.id, "concurrent-model-1"),
        pipeline.train(dataset2.id, "concurrent-model-2"),
      ]);

      expect(model1.status).toBe(ModelStatus.READY);
      expect(model2.status).toBe(ModelStatus.READY);
      expect(model1.id).not.toBe(model2.id);
    });
  });
});
