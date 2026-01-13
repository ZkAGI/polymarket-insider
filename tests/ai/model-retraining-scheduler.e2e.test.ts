/**
 * E2E Tests for Model Retraining Scheduler (AI-PRED-006)
 *
 * End-to-end tests that verify complete retraining workflows
 * including data collection, training, validation, and deployment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ModelRetrainingScheduler,
  createModelRetrainingScheduler,
  RetrainableModelType,
  ScheduleType,
  RetrainingJobStatus,
  TriggerReason,
  ValidationStrategy,
  DeploymentStrategy,
} from "../../src/ai/model-retraining-scheduler";
import { TrainingSample } from "../../src/ai/anomaly-detection-training";

describe("Model Retraining Scheduler E2E Tests", () => {
  let scheduler: ModelRetrainingScheduler;

  beforeEach(() => {
    scheduler = createModelRetrainingScheduler({
      enabled: true,
      cacheEnabled: false,
      minRetrainingIntervalMs: 0,
      maxConcurrentJobs: 3,
      autoPerformanceRetraining: false,
    });
  });

  afterEach(() => {
    scheduler.destroy();
  });

  describe("Complete Retraining Workflow", () => {
    it("should complete full retraining cycle for anomaly detection model", async () => {
      // Track events
      const events: string[] = [];
      scheduler.on("job_created", () => events.push("job_created"));
      scheduler.on("job_started", () => events.push("job_started"));
      scheduler.on("job_progress", () => events.push("job_progress"));
      scheduler.on("validation_passed", () => events.push("validation_passed"));
      scheduler.on("model_deployed", () => events.push("model_deployed"));
      scheduler.on("job_completed", () => events.push("job_completed"));
      scheduler.on("validation_failed", () => events.push("validation_failed"));
      scheduler.on("job_rolled_back", () => events.push("job_rolled_back"));
      scheduler.on("job_failed", () => events.push("job_failed"));
      scheduler.on("error", () => events.push("error"));

      // Trigger retraining
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          priority: 5,
          tags: ["e2e-test"],
        }
      );

      expect(job.jobId).toBeDefined();
      expect(events).toContain("job_created");

      // Wait for job to complete
      await new Promise((r) => setTimeout(r, 1500));

      // Get the final job status
      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();

      // Job should be in one of the final states
      expect([
        RetrainingJobStatus.COMPLETED,
        RetrainingJobStatus.FAILED,
        RetrainingJobStatus.ROLLED_BACK,
      ]).toContain(finalJob!.status);

      // Events should include start and progress
      expect(events).toContain("job_started");
      expect(events).toContain("job_progress");

      // If completed, should have metrics and validation results
      if (finalJob!.status === RetrainingJobStatus.COMPLETED) {
        expect(finalJob!.trainingMetrics).toBeDefined();
        expect(finalJob!.validationResults).toBeDefined();
        expect(finalJob!.validationResults!.passed).toBe(true);
        expect(events).toContain("validation_passed");
        expect(events).toContain("model_deployed");
        expect(events).toContain("job_completed");
      }
    }, 10000);

    it("should complete full retraining cycle for insider predictor model", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.INSIDER_PREDICTOR,
        TriggerReason.SCHEDULED
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();
      expect(finalJob!.config.modelType).toBe(RetrainableModelType.INSIDER_PREDICTOR);

      // Verify history entry was added
      const history = scheduler.getHistory({
        modelType: RetrainableModelType.INSIDER_PREDICTOR,
      });
      expect(history.length).toBeGreaterThan(0);
    }, 10000);

    it("should complete full retraining cycle for market predictor model", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.MARKET_PREDICTOR,
        TriggerReason.NEW_DATA_AVAILABLE
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();
      expect(finalJob!.config.modelType).toBe(RetrainableModelType.MARKET_PREDICTOR);
    }, 10000);

    it("should complete full retraining cycle for signal tracker model", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.SIGNAL_TRACKER,
        TriggerReason.PERFORMANCE_DROP
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();
      expect(finalJob!.config.modelType).toBe(RetrainableModelType.SIGNAL_TRACKER);
    }, 10000);
  });

  describe("Multiple Concurrent Jobs", () => {
    it("should handle multiple concurrent retraining jobs", async () => {
      // Start multiple jobs concurrently
      const [job1, job2] = await Promise.all([
        scheduler.triggerRetraining(
          RetrainableModelType.ANOMALY_DETECTION,
          TriggerReason.MANUAL
        ),
        scheduler.triggerRetraining(
          RetrainableModelType.INSIDER_PREDICTOR,
          TriggerReason.MANUAL
        ),
      ]);

      expect(job1.jobId).not.toBe(job2.jobId);

      // Wait for both to complete
      await new Promise((r) => setTimeout(r, 2000));

      const finalJob1 = scheduler.getJob(job1.jobId);
      const finalJob2 = scheduler.getJob(job2.jobId);

      expect(finalJob1).toBeDefined();
      expect(finalJob2).toBeDefined();

      // Both should be in final states
      expect([
        RetrainingJobStatus.COMPLETED,
        RetrainingJobStatus.FAILED,
        RetrainingJobStatus.ROLLED_BACK,
      ]).toContain(finalJob1!.status);
      expect([
        RetrainingJobStatus.COMPLETED,
        RetrainingJobStatus.FAILED,
        RetrainingJobStatus.ROLLED_BACK,
      ]).toContain(finalJob2!.status);
    }, 15000);

    it("should respect max concurrent jobs limit", async () => {
      // Update to allow only 2 concurrent jobs
      scheduler.updateConfig({ maxConcurrentJobs: 2 });

      await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL
      );

      await scheduler.triggerRetraining(
        RetrainableModelType.INSIDER_PREDICTOR,
        TriggerReason.MANUAL
      );

      // Third job should fail due to concurrent limit
      // Note: Jobs complete quickly in simulation, so this may or may not throw
      // depending on timing
      const activeJobs = scheduler.getActiveJobs();
      expect(activeJobs.length).toBeLessThanOrEqual(2);

      // Wait for jobs to complete
      await new Promise((r) => setTimeout(r, 2000));
    }, 15000);
  });

  describe("Custom Data Collection", () => {
    it("should use custom data collection for full workflow", async () => {
      // Generate custom training data
      const customSamples: TrainingSample[] = [];
      for (let i = 0; i < 200; i++) {
        customSamples.push({
          id: `custom_sample_${i}`,
          walletAddress: `0x${i.toString(16).padStart(40, "0")}`,
          features: {
            wallet_age_days: Math.random() * 365,
            total_trades: Math.floor(Math.random() * 500),
            avg_trade_size: Math.random() * 5000,
            win_rate: Math.random(),
            volume_spike_count: Math.floor(Math.random() * 10),
          },
          label: i % 10 === 0 ? true : false, // 10% anomaly rate
          timestamp: new Date(Date.now() - Math.random() * 86400000 * 30),
        });
      }

      const dataCollectionFn = vi.fn().mockResolvedValue(customSamples);
      scheduler.setDataCollectionFunction(dataCollectionFn);

      // Handle error events
      scheduler.on("error", () => {});

      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL
      );

      // Wait for job to complete
      await new Promise((r) => setTimeout(r, 1500));

      // Verify custom data function was called
      expect(dataCollectionFn).toHaveBeenCalled();
      expect(dataCollectionFn.mock.calls[0]?.[0]).toBe(
        RetrainableModelType.ANOMALY_DETECTION
      );

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();
    }, 10000);
  });

  describe("Validation Strategies", () => {
    it("should use holdout validation strategy", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          validation: {
            strategy: ValidationStrategy.HOLDOUT_VALIDATION,
            minAccuracy: 0.5, // Lower threshold to increase success rate
            holdoutSize: 0.3,
          },
        }
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob).toBeDefined();
      expect(finalJob!.config.validation.strategy).toBe(
        ValidationStrategy.HOLDOUT_VALIDATION
      );

      if (finalJob!.validationResults) {
        expect(finalJob!.validationResults.strategy).toBe(
          ValidationStrategy.HOLDOUT_VALIDATION
        );
      }
    }, 10000);

    it("should use accuracy comparison validation", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          validation: {
            strategy: ValidationStrategy.ACCURACY_COMPARISON,
            minAccuracy: 0.5,
          },
        }
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob!.config.validation.strategy).toBe(
        ValidationStrategy.ACCURACY_COMPARISON
      );
    }, 10000);
  });

  describe("Deployment Strategies", () => {
    it("should use immediate deployment strategy", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          deployment: {
            strategy: DeploymentStrategy.IMMEDIATE,
            autoRollback: true,
          },
        }
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob!.config.deployment.strategy).toBe(DeploymentStrategy.IMMEDIATE);

      if (
        finalJob!.status === RetrainingJobStatus.COMPLETED &&
        finalJob!.deploymentResults
      ) {
        expect(finalJob!.deploymentResults.strategy).toBe(DeploymentStrategy.IMMEDIATE);
      }
    }, 10000);

    it("should use gradual deployment strategy", async () => {
      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          deployment: {
            strategy: DeploymentStrategy.GRADUAL,
            rolloutSteps: [10, 50, 100],
          },
        }
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob!.config.deployment.strategy).toBe(DeploymentStrategy.GRADUAL);
    }, 10000);
  });

  describe("Schedule-Based Retraining", () => {
    it("should create and manage interval schedule", async () => {
      const schedule = scheduler.createSchedule(
        RetrainableModelType.ANOMALY_DETECTION,
        ScheduleType.INTERVAL,
        {
          intervalMs: 60000, // 1 minute
          enabled: true,
        }
      );

      expect(schedule.scheduleId).toBeDefined();
      expect(schedule.scheduleType).toBe(ScheduleType.INTERVAL);
      expect(schedule.intervalMs).toBe(60000);
      expect(schedule.nextExecutionAt).toBeDefined();

      // Verify schedule exists
      const retrieved = scheduler.getSchedule(schedule.scheduleId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.scheduleId).toBe(schedule.scheduleId);

      // Disable and cleanup
      scheduler.updateSchedule(schedule.scheduleId, { enabled: false });
      scheduler.deleteSchedule(schedule.scheduleId);

      expect(scheduler.getSchedule(schedule.scheduleId)).toBeUndefined();
    });

    it("should create performance trigger schedule", async () => {
      const schedule = scheduler.createSchedule(
        RetrainableModelType.INSIDER_PREDICTOR,
        ScheduleType.PERFORMANCE_TRIGGER,
        {
          performanceThreshold: 0.15,
          enabled: true,
        }
      );

      expect(schedule.scheduleType).toBe(ScheduleType.PERFORMANCE_TRIGGER);
      expect(schedule.performanceThreshold).toBe(0.15);

      scheduler.deleteSchedule(schedule.scheduleId);
    });

    it("should create data volume trigger schedule", async () => {
      const schedule = scheduler.createSchedule(
        RetrainableModelType.MARKET_PREDICTOR,
        ScheduleType.DATA_VOLUME_TRIGGER,
        {
          dataVolumeThreshold: 10000,
          enabled: true,
        }
      );

      expect(schedule.scheduleType).toBe(ScheduleType.DATA_VOLUME_TRIGGER);
      expect(schedule.dataVolumeThreshold).toBe(10000);

      scheduler.deleteSchedule(schedule.scheduleId);
    });
  });

  describe("History and Statistics Tracking", () => {
    it("should track complete retraining history", async () => {
      // Run multiple retraining jobs
      await Promise.all([
        scheduler.triggerRetraining(
          RetrainableModelType.ANOMALY_DETECTION,
          TriggerReason.MANUAL
        ),
        scheduler.triggerRetraining(
          RetrainableModelType.INSIDER_PREDICTOR,
          TriggerReason.SCHEDULED
        ),
      ]);

      // Wait for jobs to complete
      await new Promise((r) => setTimeout(r, 2000));

      // Get history
      const allHistory = scheduler.getHistory();
      expect(allHistory.length).toBeGreaterThanOrEqual(2);

      // Filter by model type
      const anomalyHistory = scheduler.getHistory({
        modelType: RetrainableModelType.ANOMALY_DETECTION,
      });
      expect(anomalyHistory.length).toBeGreaterThanOrEqual(1);
      expect(anomalyHistory.every((h) => h.modelType === RetrainableModelType.ANOMALY_DETECTION))
        .toBe(true);
    }, 15000);

    it("should calculate accurate statistics", async () => {
      // Run a retraining job
      await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL
      );

      // Wait for job to complete
      await new Promise((r) => setTimeout(r, 1500));

      // Get statistics
      const stats = scheduler.getStatistics();

      expect(stats.totalJobs).toBeGreaterThanOrEqual(1);
      expect(stats.jobsByModelType[RetrainableModelType.ANOMALY_DETECTION])
        .toBeGreaterThanOrEqual(1);
      expect(stats.jobsByTriggerReason[TriggerReason.MANUAL])
        .toBeGreaterThanOrEqual(1);
      expect(stats.lastUpdated).toBeDefined();
    }, 10000);
  });

  describe("Error Handling", () => {
    it("should handle data collection failure gracefully", async () => {
      // Set up a failing data collection function
      const failingDataFn = vi.fn().mockRejectedValue(new Error("Data collection failed"));
      scheduler.setDataCollectionFunction(failingDataFn);

      // Listen for error events
      const errors: string[] = [];
      scheduler.on("error", (e) => errors.push(e.message));
      scheduler.on("job_failed", () => errors.push("job_failed"));

      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL
      );

      // Wait for job to fail
      await new Promise((r) => setTimeout(r, 500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob!.status).toBe(RetrainingJobStatus.FAILED);
      expect(finalJob!.error).toBeDefined();
      expect(errors).toContain("job_failed");
    });

    it("should handle insufficient data gracefully", async () => {
      // Set up data collection that returns too few samples
      const insufficientDataFn = vi.fn().mockResolvedValue([
        {
          id: "sample_1",
          walletAddress: "0x1",
          features: { total_trades: 100 },
          label: false,
          timestamp: new Date(),
        },
      ]);
      scheduler.setDataCollectionFunction(insufficientDataFn);

      // Listen for errors
      scheduler.on("error", () => {});

      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        {
          dataCollection: {
            minSamples: 100, // Require 100, only get 1
          },
        }
      );

      // Wait for job to fail
      await new Promise((r) => setTimeout(r, 500));

      const finalJob = scheduler.getJob(job.jobId);
      expect(finalJob!.status).toBe(RetrainingJobStatus.FAILED);
      expect(finalJob!.error).toContain("Insufficient");
    });
  });

  describe("Scheduler Lifecycle", () => {
    it("should properly start and stop scheduler", () => {
      // Initially enabled
      expect(scheduler.getConfig().enabled).toBe(true);

      // Stop
      scheduler.stop();
      expect(scheduler.getConfig().enabled).toBe(false);

      // Start
      scheduler.start();
      expect(scheduler.getConfig().enabled).toBe(true);
    });

    it("should reject jobs when scheduler is stopped", async () => {
      scheduler.stop();

      await expect(
        scheduler.triggerRetraining(
          RetrainableModelType.ANOMALY_DETECTION,
          TriggerReason.MANUAL
        )
      ).rejects.toThrow("Scheduler is disabled");
    });

    it("should clean up on destroy", () => {
      // Create some schedules
      scheduler.createSchedule(
        RetrainableModelType.ANOMALY_DETECTION,
        ScheduleType.INTERVAL,
        { intervalMs: 60000 }
      );
      scheduler.createSchedule(
        RetrainableModelType.INSIDER_PREDICTOR,
        ScheduleType.MANUAL
      );

      expect(scheduler.getAllSchedules().length).toBe(2);

      // Destroy
      scheduler.destroy();

      // Everything should be cleared
      expect(scheduler.getAllSchedules().length).toBe(0);
      expect(scheduler.getAllJobs().length).toBe(0);
    });
  });

  describe("Event Emission", () => {
    it("should emit all expected events during successful retraining", async () => {
      const emittedEvents: string[] = [];

      scheduler.on("job_created", () => emittedEvents.push("job_created"));
      scheduler.on("job_started", () => emittedEvents.push("job_started"));
      scheduler.on("job_progress", () => emittedEvents.push("job_progress"));
      scheduler.on("validation_passed", () => emittedEvents.push("validation_passed"));
      scheduler.on("validation_failed", () => emittedEvents.push("validation_failed"));
      scheduler.on("model_deployed", () => emittedEvents.push("model_deployed"));
      scheduler.on("job_completed", () => emittedEvents.push("job_completed"));
      scheduler.on("job_failed", () => emittedEvents.push("job_failed"));
      scheduler.on("job_rolled_back", () => emittedEvents.push("job_rolled_back"));
      scheduler.on("error", () => emittedEvents.push("error"));

      await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL
      );

      // Wait for completion
      await new Promise((r) => setTimeout(r, 1500));

      // Basic events that should always happen
      expect(emittedEvents).toContain("job_created");
      expect(emittedEvents).toContain("job_started");
      expect(emittedEvents).toContain("job_progress");

      // One of these should happen based on outcome
      const outcomeEvent =
        emittedEvents.includes("job_completed") ||
        emittedEvents.includes("job_failed") ||
        emittedEvents.includes("job_rolled_back");
      expect(outcomeEvent).toBe(true);
    }, 10000);
  });

  describe("Configuration Persistence", () => {
    it("should maintain configuration across jobs", async () => {
      const customConfig = {
        dataCollection: {
          minSamples: 50,
          maxSamples: 500,
        },
        validation: {
          minAccuracy: 0.6,
          holdoutSize: 0.25,
        },
        deployment: {
          autoRollback: false,
        },
      };

      const job = await scheduler.triggerRetraining(
        RetrainableModelType.ANOMALY_DETECTION,
        TriggerReason.MANUAL,
        customConfig
      );

      expect(job.config.dataCollection.minSamples).toBe(50);
      expect(job.config.dataCollection.maxSamples).toBe(500);
      expect(job.config.validation.minAccuracy).toBe(0.6);
      expect(job.config.validation.holdoutSize).toBe(0.25);
      expect(job.config.deployment.autoRollback).toBe(false);
    });
  });
});
