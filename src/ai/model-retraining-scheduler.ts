/**
 * Model Retraining Scheduler (AI-PRED-006)
 *
 * Automated retraining of models on new data.
 * Schedules retraining jobs, collects new training data,
 * retrains models, and validates before deployment.
 *
 * Features:
 * - Schedule retraining jobs (cron-like or interval-based)
 * - Collect new training data from various sources
 * - Retrain models with configurable strategies
 * - Validate model performance before deployment
 * - Rollback to previous model on validation failure
 * - Track retraining history and metrics
 * - Support multiple model types
 * - Event-driven architecture for notifications
 */

import { EventEmitter } from "events";
import {
  AnomalyDetectionTrainingPipeline,
  TrainingSample,
  TrainingMetrics,
  getSharedAnomalyDetectionTrainingPipeline,
} from "./anomaly-detection-training";
import {
  ModelPerformanceDashboard,
  ModelType as DashboardModelType,
} from "./model-performance-dashboard";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Model types that can be retrained
 */
export enum RetrainableModelType {
  /** Anomaly detection model */
  ANOMALY_DETECTION = "ANOMALY_DETECTION",
  /** Insider probability model */
  INSIDER_PREDICTOR = "INSIDER_PREDICTOR",
  /** Market outcome model */
  MARKET_PREDICTOR = "MARKET_PREDICTOR",
  /** Signal effectiveness model */
  SIGNAL_TRACKER = "SIGNAL_TRACKER",
}

/**
 * Retraining schedule type
 */
export enum ScheduleType {
  /** Run at fixed intervals */
  INTERVAL = "INTERVAL",
  /** Run on cron schedule */
  CRON = "CRON",
  /** Run on performance trigger */
  PERFORMANCE_TRIGGER = "PERFORMANCE_TRIGGER",
  /** Run on data volume trigger */
  DATA_VOLUME_TRIGGER = "DATA_VOLUME_TRIGGER",
  /** Manual trigger only */
  MANUAL = "MANUAL",
}

/**
 * Retraining job status
 */
export enum RetrainingJobStatus {
  /** Job is scheduled */
  SCHEDULED = "SCHEDULED",
  /** Job is pending execution */
  PENDING = "PENDING",
  /** Collecting training data */
  COLLECTING_DATA = "COLLECTING_DATA",
  /** Training in progress */
  TRAINING = "TRAINING",
  /** Validating new model */
  VALIDATING = "VALIDATING",
  /** Deploying new model */
  DEPLOYING = "DEPLOYING",
  /** Job completed successfully */
  COMPLETED = "COMPLETED",
  /** Job failed */
  FAILED = "FAILED",
  /** Job was cancelled */
  CANCELLED = "CANCELLED",
  /** Rolled back due to validation failure */
  ROLLED_BACK = "ROLLED_BACK",
}

/**
 * Data source type for training data
 */
export enum DataSourceType {
  /** Historical database records */
  DATABASE = "DATABASE",
  /** Real-time stream data */
  STREAM = "STREAM",
  /** Cached data */
  CACHE = "CACHE",
  /** External API */
  EXTERNAL_API = "EXTERNAL_API",
  /** Manual upload */
  MANUAL_UPLOAD = "MANUAL_UPLOAD",
}

/**
 * Validation strategy for new models
 */
export enum ValidationStrategy {
  /** Compare accuracy metrics */
  ACCURACY_COMPARISON = "ACCURACY_COMPARISON",
  /** A/B test with production traffic */
  AB_TEST = "AB_TEST",
  /** Shadow mode comparison */
  SHADOW_MODE = "SHADOW_MODE",
  /** Holdout validation set */
  HOLDOUT_VALIDATION = "HOLDOUT_VALIDATION",
  /** Cross-validation */
  CROSS_VALIDATION = "CROSS_VALIDATION",
}

/**
 * Deployment strategy for new models
 */
export enum DeploymentStrategy {
  /** Replace old model immediately */
  IMMEDIATE = "IMMEDIATE",
  /** Gradual rollout */
  GRADUAL = "GRADUAL",
  /** Canary deployment */
  CANARY = "CANARY",
  /** Blue-green deployment */
  BLUE_GREEN = "BLUE_GREEN",
}

/**
 * Retraining trigger reason
 */
export enum TriggerReason {
  /** Scheduled retraining */
  SCHEDULED = "SCHEDULED",
  /** Performance drop detected */
  PERFORMANCE_DROP = "PERFORMANCE_DROP",
  /** New data available */
  NEW_DATA_AVAILABLE = "NEW_DATA_AVAILABLE",
  /** Data drift detected */
  DATA_DRIFT_DETECTED = "DATA_DRIFT_DETECTED",
  /** Manual trigger */
  MANUAL = "MANUAL",
  /** Model expiry */
  MODEL_EXPIRED = "MODEL_EXPIRED",
}

/**
 * Retraining schedule configuration
 */
export interface RetrainingSchedule {
  /** Schedule ID */
  scheduleId: string;
  /** Model type */
  modelType: RetrainableModelType;
  /** Schedule type */
  scheduleType: ScheduleType;
  /** Interval in milliseconds (for INTERVAL type) */
  intervalMs?: number;
  /** Cron expression (for CRON type) */
  cronExpression?: string;
  /** Performance threshold for trigger (for PERFORMANCE_TRIGGER) */
  performanceThreshold?: number;
  /** Data volume threshold (for DATA_VOLUME_TRIGGER) */
  dataVolumeThreshold?: number;
  /** Is schedule enabled */
  enabled: boolean;
  /** Last execution time */
  lastExecutedAt?: Date;
  /** Next scheduled execution */
  nextExecutionAt?: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Training data collection configuration
 */
export interface DataCollectionConfig {
  /** Data sources to use */
  sources: DataSourceType[];
  /** Time window for data collection */
  timeWindowMs: number;
  /** Minimum samples required */
  minSamples: number;
  /** Maximum samples to collect */
  maxSamples: number;
  /** Include labeled data only */
  labeledOnly: boolean;
  /** Sample filtering criteria */
  filterCriteria?: {
    minConfidence?: number;
    categories?: string[];
    excludeAnomalies?: boolean;
  };
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Validation strategy */
  strategy: ValidationStrategy;
  /** Minimum accuracy required */
  minAccuracy: number;
  /** Minimum improvement required over previous model */
  minImprovement: number;
  /** Maximum accuracy degradation allowed (negative value) */
  maxDegradation: number;
  /** Holdout set size (percentage) */
  holdoutSize: number;
  /** Number of validation samples */
  validationSamples: number;
  /** A/B test duration in ms (for AB_TEST strategy) */
  abTestDurationMs?: number;
  /** Traffic percentage for new model in A/B test */
  abTestTrafficPercent?: number;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /** Deployment strategy */
  strategy: DeploymentStrategy;
  /** Gradual rollout steps (for GRADUAL strategy) */
  rolloutSteps?: number[];
  /** Canary percentage (for CANARY strategy) */
  canaryPercent?: number;
  /** Rollback on failure */
  autoRollback: boolean;
  /** Deployment timeout in ms */
  timeoutMs: number;
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
}

/**
 * Retraining job configuration
 */
export interface RetrainingJobConfig {
  /** Model type to retrain */
  modelType: RetrainableModelType;
  /** Data collection configuration */
  dataCollection: DataCollectionConfig;
  /** Validation configuration */
  validation: ValidationConfig;
  /** Deployment configuration */
  deployment: DeploymentConfig;
  /** Trigger reason */
  triggerReason: TriggerReason;
  /** Schedule ID (if triggered by schedule) */
  scheduleId?: string;
  /** Priority (higher = more urgent) */
  priority: number;
  /** Tags for organization */
  tags?: string[];
}

/**
 * Retraining job
 */
export interface RetrainingJob {
  /** Job ID */
  jobId: string;
  /** Job configuration */
  config: RetrainingJobConfig;
  /** Current status */
  status: RetrainingJobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current stage message */
  stageMessage: string;
  /** Previous model ID */
  previousModelId?: string;
  /** New model ID (if training completed) */
  newModelId?: string;
  /** Training metrics */
  trainingMetrics?: TrainingMetrics;
  /** Validation results */
  validationResults?: ValidationResults;
  /** Deployment results */
  deploymentResults?: DeploymentResults;
  /** Error message (if failed) */
  error?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Started timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Duration in ms */
  durationMs?: number;
}

/**
 * Validation results
 */
export interface ValidationResults {
  /** Validation strategy used */
  strategy: ValidationStrategy;
  /** Is validation passed */
  passed: boolean;
  /** Old model accuracy */
  oldModelAccuracy: number;
  /** New model accuracy */
  newModelAccuracy: number;
  /** Accuracy improvement */
  improvement: number;
  /** Improvement percentage */
  improvementPercent: number;
  /** Validation samples used */
  samplesUsed: number;
  /** Detailed metrics */
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    aucRoc: number;
  };
  /** Validation timestamp */
  validatedAt: Date;
  /** Failure reason (if not passed) */
  failureReason?: string;
}

/**
 * Deployment results
 */
export interface DeploymentResults {
  /** Deployment strategy used */
  strategy: DeploymentStrategy;
  /** Is deployment successful */
  success: boolean;
  /** Deployed model ID */
  deployedModelId: string;
  /** Previous model ID */
  previousModelId?: string;
  /** Deployment timestamp */
  deployedAt: Date;
  /** Rollback performed */
  rolledBack: boolean;
  /** Rollback reason (if rolled back) */
  rollbackReason?: string;
  /** Health check results */
  healthCheckResults?: {
    healthy: boolean;
    latencyMs: number;
    errorRate: number;
  };
}

/**
 * Retraining history entry
 */
export interface RetrainingHistoryEntry {
  /** Entry ID */
  entryId: string;
  /** Job ID */
  jobId: string;
  /** Model type */
  modelType: RetrainableModelType;
  /** Trigger reason */
  triggerReason: TriggerReason;
  /** Final status */
  status: RetrainingJobStatus;
  /** Previous model accuracy */
  previousAccuracy: number;
  /** New model accuracy (if successful) */
  newAccuracy?: number;
  /** Improvement (if successful) */
  improvement?: number;
  /** Training samples used */
  trainingSamples: number;
  /** Duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: Date;
  /** Notes */
  notes?: string;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStatistics {
  /** Total jobs created */
  totalJobs: number;
  /** Jobs completed successfully */
  successfulJobs: number;
  /** Jobs failed */
  failedJobs: number;
  /** Jobs rolled back */
  rolledBackJobs: number;
  /** Average training duration in ms */
  avgTrainingDurationMs: number;
  /** Average improvement percentage */
  avgImprovementPercent: number;
  /** Total training samples used */
  totalSamplesUsed: number;
  /** Active schedules */
  activeSchedules: number;
  /** Jobs by model type */
  jobsByModelType: Record<RetrainableModelType, number>;
  /** Jobs by trigger reason */
  jobsByTriggerReason: Record<TriggerReason, number>;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Maximum concurrent retraining jobs */
  maxConcurrentJobs: number;
  /** Default data collection config */
  defaultDataCollection: Partial<DataCollectionConfig>;
  /** Default validation config */
  defaultValidation: Partial<ValidationConfig>;
  /** Default deployment config */
  defaultDeployment: Partial<DeploymentConfig>;
  /** Enable automatic performance-based retraining */
  autoPerformanceRetraining: boolean;
  /** Performance drop threshold for automatic retraining */
  performanceDropThreshold: number;
  /** Minimum time between retraining jobs for same model (ms) */
  minRetrainingIntervalMs: number;
  /** Enable scheduler */
  enabled: boolean;
  /** Enable caching */
  cacheEnabled: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
}

/**
 * Scheduler events
 */
export interface SchedulerEvents {
  /** Schedule created */
  schedule_created: RetrainingSchedule;
  /** Schedule updated */
  schedule_updated: RetrainingSchedule;
  /** Schedule deleted */
  schedule_deleted: { scheduleId: string };
  /** Job created */
  job_created: RetrainingJob;
  /** Job started */
  job_started: { jobId: string; modelType: RetrainableModelType };
  /** Job progress updated */
  job_progress: { jobId: string; progress: number; stage: string };
  /** Job completed */
  job_completed: {
    jobId: string;
    modelId: string;
    metrics: TrainingMetrics;
    improvement: number;
  };
  /** Job failed */
  job_failed: { jobId: string; error: string };
  /** Job rolled back */
  job_rolled_back: { jobId: string; reason: string };
  /** Validation passed */
  validation_passed: { jobId: string; results: ValidationResults };
  /** Validation failed */
  validation_failed: { jobId: string; results: ValidationResults };
  /** Model deployed */
  model_deployed: { jobId: string; modelId: string };
  /** Performance trigger activated */
  performance_trigger: {
    modelType: RetrainableModelType;
    currentAccuracy: number;
    threshold: number;
  };
  /** Data volume trigger activated */
  data_volume_trigger: {
    modelType: RetrainableModelType;
    dataVolume: number;
    threshold: number;
  };
  /** Error occurred */
  error: { message: string; context?: string };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default data collection configuration
 */
export const DEFAULT_DATA_COLLECTION_CONFIG: DataCollectionConfig = {
  sources: [DataSourceType.DATABASE, DataSourceType.CACHE],
  timeWindowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  minSamples: 100,
  maxSamples: 10000,
  labeledOnly: false,
  filterCriteria: {
    minConfidence: 0.5,
  },
};

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  strategy: ValidationStrategy.HOLDOUT_VALIDATION,
  minAccuracy: 0.7,
  minImprovement: 0.0, // Allow same accuracy
  maxDegradation: -0.05, // Max 5% degradation
  holdoutSize: 0.2,
  validationSamples: 1000,
  abTestDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  abTestTrafficPercent: 10,
};

/**
 * Default deployment configuration
 */
export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  strategy: DeploymentStrategy.IMMEDIATE,
  rolloutSteps: [10, 25, 50, 75, 100],
  canaryPercent: 5,
  autoRollback: true,
  timeoutMs: 5 * 60 * 1000, // 5 minutes
  healthCheckIntervalMs: 30 * 1000, // 30 seconds
};

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrentJobs: 2,
  defaultDataCollection: DEFAULT_DATA_COLLECTION_CONFIG,
  defaultValidation: DEFAULT_VALIDATION_CONFIG,
  defaultDeployment: DEFAULT_DEPLOYMENT_CONFIG,
  autoPerformanceRetraining: true,
  performanceDropThreshold: 0.1, // 10% drop triggers retraining
  minRetrainingIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
  enabled: true,
  cacheEnabled: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Schedule type descriptions
 */
export const SCHEDULE_TYPE_DESCRIPTIONS: Record<ScheduleType, string> = {
  [ScheduleType.INTERVAL]: "Run at fixed time intervals",
  [ScheduleType.CRON]: "Run on cron schedule",
  [ScheduleType.PERFORMANCE_TRIGGER]:
    "Run when performance drops below threshold",
  [ScheduleType.DATA_VOLUME_TRIGGER]: "Run when new data volume reaches threshold",
  [ScheduleType.MANUAL]: "Manual trigger only",
};

/**
 * Model type descriptions
 */
export const MODEL_TYPE_DESCRIPTIONS: Record<RetrainableModelType, string> = {
  [RetrainableModelType.ANOMALY_DETECTION]: "Anomaly Detection Model",
  [RetrainableModelType.INSIDER_PREDICTOR]: "Insider Probability Predictor",
  [RetrainableModelType.MARKET_PREDICTOR]: "Market Outcome Predictor",
  [RetrainableModelType.SIGNAL_TRACKER]: "Signal Effectiveness Tracker",
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Model Retraining Scheduler
 *
 * Manages automated retraining of AI models based on schedules,
 * performance metrics, and data volume triggers.
 */
export class ModelRetrainingScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private schedules: Map<string, RetrainingSchedule>;
  private jobs: Map<string, RetrainingJob>;
  private history: RetrainingHistoryEntry[];
  private activeJobs: Set<string>;
  private schedulerIntervals: Map<string, NodeJS.Timeout>;
  private trainingPipeline: AnomalyDetectionTrainingPipeline | null;
  private performanceDashboard: ModelPerformanceDashboard | null;
  private cache: Map<string, { data: unknown; expiresAt: number }>;
  private idCounter: number;
  private lastRetrainingByModel: Map<RetrainableModelType, Date>;
  private collectDataFn:
    | ((
        modelType: RetrainableModelType,
        config: DataCollectionConfig
      ) => Promise<TrainingSample[]>)
    | null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.schedules = new Map();
    this.jobs = new Map();
    this.history = [];
    this.activeJobs = new Set();
    this.schedulerIntervals = new Map();
    this.trainingPipeline = null;
    this.performanceDashboard = null;
    this.cache = new Map();
    this.idCounter = 0;
    this.lastRetrainingByModel = new Map();
    this.collectDataFn = null;
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set training pipeline
   */
  setTrainingPipeline(pipeline: AnomalyDetectionTrainingPipeline): void {
    this.trainingPipeline = pipeline;
  }

  /**
   * Set performance dashboard
   */
  setPerformanceDashboard(dashboard: ModelPerformanceDashboard): void {
    this.performanceDashboard = dashboard;
  }

  /**
   * Set custom data collection function
   */
  setDataCollectionFunction(
    fn: (
      modelType: RetrainableModelType,
      config: DataCollectionConfig
    ) => Promise<TrainingSample[]>
  ): void {
    this.collectDataFn = fn;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.config.cacheEnabled) return null;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.emit("cache_hit", { key });
      return cached.data as T;
    }

    if (cached) {
      this.cache.delete(key);
    }

    this.emit("cache_miss", { key });
    return null;
  }

  /**
   * Set in cache
   */
  private setInCache(key: string, data: unknown): void {
    if (!this.config.cacheEnabled) return;

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Schedule Management
  // ============================================================================

  /**
   * Create a retraining schedule
   */
  createSchedule(
    modelType: RetrainableModelType,
    scheduleType: ScheduleType,
    options: {
      intervalMs?: number;
      cronExpression?: string;
      performanceThreshold?: number;
      dataVolumeThreshold?: number;
      enabled?: boolean;
    } = {}
  ): RetrainingSchedule {
    const schedule: RetrainingSchedule = {
      scheduleId: this.generateId("schedule"),
      modelType,
      scheduleType,
      intervalMs: options.intervalMs,
      cronExpression: options.cronExpression,
      performanceThreshold: options.performanceThreshold ?? 0.1,
      dataVolumeThreshold: options.dataVolumeThreshold ?? 1000,
      enabled: options.enabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Calculate next execution time
    if (scheduleType === ScheduleType.INTERVAL && options.intervalMs) {
      schedule.nextExecutionAt = new Date(Date.now() + options.intervalMs);
    } else if (scheduleType === ScheduleType.CRON && options.cronExpression) {
      schedule.nextExecutionAt = this.calculateNextCronExecution(
        options.cronExpression
      );
    }

    this.schedules.set(schedule.scheduleId, schedule);

    // Start schedule if enabled
    if (schedule.enabled && scheduleType === ScheduleType.INTERVAL) {
      this.startIntervalSchedule(schedule);
    }

    this.emit("schedule_created", schedule);
    return schedule;
  }

  /**
   * Update a schedule
   */
  updateSchedule(
    scheduleId: string,
    updates: Partial<
      Pick<
        RetrainingSchedule,
        | "enabled"
        | "intervalMs"
        | "cronExpression"
        | "performanceThreshold"
        | "dataVolumeThreshold"
      >
    >
  ): RetrainingSchedule | null {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return null;

    const wasEnabled = schedule.enabled;

    Object.assign(schedule, updates, { updatedAt: new Date() });

    // Handle enable/disable
    if (wasEnabled && !schedule.enabled) {
      this.stopSchedule(scheduleId);
    } else if (!wasEnabled && schedule.enabled) {
      if (schedule.scheduleType === ScheduleType.INTERVAL) {
        this.startIntervalSchedule(schedule);
      }
    }

    this.emit("schedule_updated", schedule);
    return schedule;
  }

  /**
   * Delete a schedule
   */
  deleteSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    this.stopSchedule(scheduleId);
    this.schedules.delete(scheduleId);

    this.emit("schedule_deleted", { scheduleId });
    return true;
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): RetrainingSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): RetrainingSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get schedules for a model type
   */
  getSchedulesForModel(modelType: RetrainableModelType): RetrainingSchedule[] {
    return Array.from(this.schedules.values()).filter(
      (s) => s.modelType === modelType
    );
  }

  /**
   * Start interval-based schedule
   */
  private startIntervalSchedule(schedule: RetrainingSchedule): void {
    if (!schedule.intervalMs) return;

    // Stop existing interval if any
    this.stopSchedule(schedule.scheduleId);

    const interval = setInterval(async () => {
      if (!schedule.enabled) return;

      // Check minimum retraining interval
      if (this.shouldSkipRetraining(schedule.modelType)) {
        return;
      }

      await this.triggerRetraining(schedule.modelType, TriggerReason.SCHEDULED, {
        scheduleId: schedule.scheduleId,
      });

      schedule.lastExecutedAt = new Date();
      schedule.nextExecutionAt = new Date(Date.now() + schedule.intervalMs!);
    }, schedule.intervalMs);

    this.schedulerIntervals.set(schedule.scheduleId, interval);
  }

  /**
   * Stop a schedule
   */
  private stopSchedule(scheduleId: string): void {
    const interval = this.schedulerIntervals.get(scheduleId);
    if (interval) {
      clearInterval(interval);
      this.schedulerIntervals.delete(scheduleId);
    }
  }

  /**
   * Calculate next cron execution (simplified)
   */
  private calculateNextCronExecution(_cronExpression: string): Date {
    // Simplified: just return next hour for now
    // In production, use a proper cron parser library like 'cron-parser'
    // The _cronExpression would be parsed to determine the next execution time
    const next = new Date();
    next.setMinutes(0);
    next.setSeconds(0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  /**
   * Check if retraining should be skipped due to minimum interval
   */
  private shouldSkipRetraining(modelType: RetrainableModelType): boolean {
    const lastRetraining = this.lastRetrainingByModel.get(modelType);
    if (!lastRetraining) return false;

    const timeSinceLastRetraining = Date.now() - lastRetraining.getTime();
    return timeSinceLastRetraining < this.config.minRetrainingIntervalMs;
  }

  // ============================================================================
  // Job Management
  // ============================================================================

  /**
   * Trigger retraining for a model
   */
  async triggerRetraining(
    modelType: RetrainableModelType,
    triggerReason: TriggerReason,
    options: {
      scheduleId?: string;
      priority?: number;
      dataCollection?: Partial<DataCollectionConfig>;
      validation?: Partial<ValidationConfig>;
      deployment?: Partial<DeploymentConfig>;
      tags?: string[];
    } = {}
  ): Promise<RetrainingJob> {
    // Check if scheduler is enabled
    if (!this.config.enabled) {
      throw new Error("Scheduler is disabled");
    }

    // Check concurrent job limit
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      throw new Error(
        `Maximum concurrent jobs (${this.config.maxConcurrentJobs}) reached`
      );
    }

    // Create job configuration
    const jobConfig: RetrainingJobConfig = {
      modelType,
      dataCollection: {
        ...DEFAULT_DATA_COLLECTION_CONFIG,
        ...this.config.defaultDataCollection,
        ...options.dataCollection,
      },
      validation: {
        ...DEFAULT_VALIDATION_CONFIG,
        ...this.config.defaultValidation,
        ...options.validation,
      },
      deployment: {
        ...DEFAULT_DEPLOYMENT_CONFIG,
        ...this.config.defaultDeployment,
        ...options.deployment,
      },
      triggerReason,
      scheduleId: options.scheduleId,
      priority: options.priority ?? 1,
      tags: options.tags,
    };

    // Create job
    const job: RetrainingJob = {
      jobId: this.generateId("job"),
      config: jobConfig,
      status: RetrainingJobStatus.PENDING,
      progress: 0,
      stageMessage: "Job created",
      createdAt: new Date(),
    };

    this.jobs.set(job.jobId, job);
    this.emit("job_created", job);

    // Execute job asynchronously
    this.executeJob(job).catch((error) => {
      this.handleJobError(job, error);
    });

    return job;
  }

  /**
   * Execute a retraining job
   */
  private async executeJob(job: RetrainingJob): Promise<void> {
    this.activeJobs.add(job.jobId);
    job.status = RetrainingJobStatus.COLLECTING_DATA;
    job.startedAt = new Date();
    this.updateJobProgress(job, 5, "Starting retraining job");

    this.emit("job_started", {
      jobId: job.jobId,
      modelType: job.config.modelType,
    });

    try {
      // Step 1: Collect training data
      this.updateJobProgress(job, 10, "Collecting training data");
      job.status = RetrainingJobStatus.COLLECTING_DATA;
      const trainingSamples = await this.collectTrainingData(job);

      if (trainingSamples.length < job.config.dataCollection.minSamples) {
        throw new Error(
          `Insufficient training samples: ${trainingSamples.length} < ${job.config.dataCollection.minSamples}`
        );
      }

      // Step 2: Train model
      this.updateJobProgress(job, 30, "Training model");
      job.status = RetrainingJobStatus.TRAINING;
      const { modelId, metrics } = await this.trainModel(job, trainingSamples);
      job.newModelId = modelId;
      job.trainingMetrics = metrics;

      // Step 3: Validate model
      this.updateJobProgress(job, 60, "Validating model");
      job.status = RetrainingJobStatus.VALIDATING;
      const validationResults = await this.validateModel(job, trainingSamples);
      job.validationResults = validationResults;

      if (!validationResults.passed) {
        job.status = RetrainingJobStatus.ROLLED_BACK;
        job.error = validationResults.failureReason;
        this.emit("validation_failed", { jobId: job.jobId, results: validationResults });
        this.emit("job_rolled_back", {
          jobId: job.jobId,
          reason: validationResults.failureReason || "Validation failed",
        });
        this.finalizeJob(job);
        return;
      }

      this.emit("validation_passed", { jobId: job.jobId, results: validationResults });

      // Step 4: Deploy model
      this.updateJobProgress(job, 80, "Deploying model");
      job.status = RetrainingJobStatus.DEPLOYING;
      const deploymentResults = await this.deployModel(job);
      job.deploymentResults = deploymentResults;

      if (!deploymentResults.success) {
        if (job.config.deployment.autoRollback) {
          job.status = RetrainingJobStatus.ROLLED_BACK;
          job.error = deploymentResults.rollbackReason;
          this.emit("job_rolled_back", {
            jobId: job.jobId,
            reason: deploymentResults.rollbackReason || "Deployment failed",
          });
        } else {
          job.status = RetrainingJobStatus.FAILED;
          job.error = "Deployment failed";
        }
        this.finalizeJob(job);
        return;
      }

      // Success!
      this.updateJobProgress(job, 100, "Retraining completed successfully");
      job.status = RetrainingJobStatus.COMPLETED;
      this.lastRetrainingByModel.set(job.config.modelType, new Date());

      this.emit("model_deployed", { jobId: job.jobId, modelId: modelId });
      this.emit("job_completed", {
        jobId: job.jobId,
        modelId,
        metrics,
        improvement: validationResults.improvement,
      });

      this.finalizeJob(job);
    } catch (error) {
      this.handleJobError(job, error);
    }
  }

  /**
   * Update job progress
   */
  private updateJobProgress(
    job: RetrainingJob,
    progress: number,
    message: string
  ): void {
    job.progress = progress;
    job.stageMessage = message;
    this.emit("job_progress", { jobId: job.jobId, progress, stage: message });
  }

  /**
   * Collect training data
   */
  private async collectTrainingData(job: RetrainingJob): Promise<TrainingSample[]> {
    const config = job.config.dataCollection;

    // Use custom data collection function if provided
    if (this.collectDataFn) {
      return this.collectDataFn(job.config.modelType, config);
    }

    // Generate mock training data for testing
    return this.generateMockTrainingData(config);
  }

  /**
   * Generate mock training data
   */
  private generateMockTrainingData(config: DataCollectionConfig): TrainingSample[] {
    const samples: TrainingSample[] = [];
    const count = Math.min(
      config.maxSamples,
      Math.max(config.minSamples, 500)
    );

    for (let i = 0; i < count; i++) {
      const isAnomaly = Math.random() < 0.1; // 10% anomaly rate
      const sample: TrainingSample = {
        id: `sample_${Date.now()}_${i}`,
        walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        features: {
          wallet_age_days: Math.random() * 365,
          total_trades: Math.floor(Math.random() * 1000),
          unique_markets: Math.floor(Math.random() * 50),
          avg_trade_size: Math.random() * 10000,
          trade_size_stddev: Math.random() * 5000,
          buy_sell_ratio: Math.random(),
          holding_period_avg: Math.random() * 168,
          volume_spike_count: isAnomaly ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 3),
          whale_trade_count: isAnomaly ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 2),
          total_volume_usd: Math.random() * 100000,
          off_hours_ratio: Math.random(),
          pre_event_trade_ratio: isAnomaly ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3,
          timing_consistency_score: Math.random(),
          market_concentration: Math.random(),
          niche_market_ratio: isAnomaly ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3,
          political_market_ratio: Math.random(),
          win_rate: isAnomaly ? Math.random() * 0.3 + 0.7 : Math.random() * 0.6 + 0.2,
          profit_factor: isAnomaly ? Math.random() * 3 + 2 : Math.random() * 2 + 0.5,
          max_consecutive_wins: isAnomaly ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 5),
          coordination_score: isAnomaly ? Math.random() * 50 + 50 : Math.random() * 30,
          cluster_membership_count: Math.floor(Math.random() * 5),
          sybil_risk_score: isAnomaly ? Math.random() * 50 + 30 : Math.random() * 30,
        },
        label: config.labeledOnly ? isAnomaly : Math.random() > 0.3 ? isAnomaly : null,
        timestamp: new Date(Date.now() - Math.random() * config.timeWindowMs),
      };
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Train model
   */
  private async trainModel(
    job: RetrainingJob,
    samples: TrainingSample[]
  ): Promise<{ modelId: string; metrics: TrainingMetrics }> {
    // Get or create training pipeline
    const pipeline =
      this.trainingPipeline ?? getSharedAnomalyDetectionTrainingPipeline();

    if (!pipeline) {
      // Simulate training for testing
      return this.simulateTraining(samples);
    }

    // Create dataset
    const dataset = pipeline.createDataset(
      `retraining_${job.config.modelType}_${Date.now()}`
    );

    // Add samples
    pipeline.addSamples(dataset.id, samples);

    // Train model using the pipeline's train method
    const model = await pipeline.train(
      dataset.id,
      `model_${job.config.modelType}_${Date.now()}`,
      "1.0.0"
    );

    return {
      modelId: model.id,
      metrics: model.trainingMetrics,
    };
  }

  /**
   * Simulate training for testing
   */
  private simulateTraining(
    samples: TrainingSample[]
  ): { modelId: string; metrics: TrainingMetrics } {
    const labeledSamples = samples.filter((s) => s.label !== null);

    const accuracy = 0.75 + Math.random() * 0.2; // 75-95%
    const precision = 0.7 + Math.random() * 0.25;
    const recall = 0.65 + Math.random() * 0.3;
    const f1Score = (2 * precision * recall) / (precision + recall);

    return {
      modelId: this.generateId("model"),
      metrics: {
        loss: 0.1 + Math.random() * 0.1,
        accuracy: labeledSamples.length > 0 ? accuracy : null,
        precision: labeledSamples.length > 0 ? precision : null,
        recall: labeledSamples.length > 0 ? recall : null,
        f1Score: labeledSamples.length > 0 ? f1Score : null,
        aucRoc: labeledSamples.length > 0 ? 0.8 + Math.random() * 0.15 : null,
        trainingDurationMs: 1000 + Math.random() * 5000,
        samplesUsed: samples.length,
      },
    };
  }

  /**
   * Validate model
   */
  private async validateModel(
    job: RetrainingJob,
    samples: TrainingSample[]
  ): Promise<ValidationResults> {
    const config = job.config.validation;

    // Calculate validation set size
    const validationSize = Math.floor(samples.length * config.holdoutSize);
    const validationSamples = samples.slice(-validationSize);

    // Get old model accuracy (simulated or from dashboard)
    const oldAccuracy = await this.getOldModelAccuracy(job.config.modelType);

    // Calculate new model accuracy (from training metrics or simulation)
    const newAccuracy =
      job.trainingMetrics?.accuracy ?? 0.75 + Math.random() * 0.2;

    const improvement = newAccuracy - oldAccuracy;
    const improvementPercent = oldAccuracy > 0 ? (improvement / oldAccuracy) * 100 : 0;

    // Check validation criteria
    let passed = true;
    let failureReason: string | undefined;

    if (newAccuracy < config.minAccuracy) {
      passed = false;
      failureReason = `New model accuracy (${(newAccuracy * 100).toFixed(1)}%) below minimum threshold (${(config.minAccuracy * 100).toFixed(1)}%)`;
    } else if (improvement < config.minImprovement) {
      passed = false;
      failureReason = `Improvement (${(improvement * 100).toFixed(2)}%) below minimum required (${(config.minImprovement * 100).toFixed(2)}%)`;
    } else if (improvement < config.maxDegradation) {
      passed = false;
      failureReason = `Model degradation (${(improvement * 100).toFixed(2)}%) exceeds maximum allowed (${(config.maxDegradation * 100).toFixed(2)}%)`;
    }

    return {
      strategy: config.strategy,
      passed,
      oldModelAccuracy: oldAccuracy,
      newModelAccuracy: newAccuracy,
      improvement,
      improvementPercent,
      samplesUsed: validationSamples.length,
      metrics: {
        precision: job.trainingMetrics?.precision ?? 0.8,
        recall: job.trainingMetrics?.recall ?? 0.75,
        f1Score: job.trainingMetrics?.f1Score ?? 0.77,
        aucRoc: job.trainingMetrics?.aucRoc ?? 0.85,
      },
      validatedAt: new Date(),
      failureReason,
    };
  }

  /**
   * Get old model accuracy
   */
  private async getOldModelAccuracy(
    modelType: RetrainableModelType
  ): Promise<number> {
    // Try to get from performance dashboard
    if (this.performanceDashboard) {
      const dashboardModelType = this.mapToDashboardModelType(modelType);
      if (dashboardModelType) {
        const metrics = await this.performanceDashboard.getModelMetrics(
          dashboardModelType
        );
        if (metrics) {
          return metrics.accuracy;
        }
      }
    }

    // Return simulated value
    return 0.75 + Math.random() * 0.1;
  }

  /**
   * Map retrainable model type to dashboard model type
   */
  private mapToDashboardModelType(
    modelType: RetrainableModelType
  ): DashboardModelType | null {
    const mapping: Record<RetrainableModelType, DashboardModelType | null> = {
      [RetrainableModelType.ANOMALY_DETECTION]: null,
      [RetrainableModelType.INSIDER_PREDICTOR]: DashboardModelType.INSIDER_PREDICTOR,
      [RetrainableModelType.MARKET_PREDICTOR]: DashboardModelType.MARKET_PREDICTOR,
      [RetrainableModelType.SIGNAL_TRACKER]: DashboardModelType.SIGNAL_TRACKER,
    };
    return mapping[modelType];
  }

  /**
   * Deploy model
   */
  private async deployModel(job: RetrainingJob): Promise<DeploymentResults> {
    const config = job.config.deployment;

    // Simulate deployment
    const success = Math.random() > 0.05; // 95% success rate

    const results: DeploymentResults = {
      strategy: config.strategy,
      success,
      deployedModelId: job.newModelId!,
      previousModelId: job.previousModelId,
      deployedAt: new Date(),
      rolledBack: false,
    };

    if (!success && config.autoRollback) {
      results.rolledBack = true;
      results.rollbackReason = "Health check failed after deployment";
    }

    if (success) {
      results.healthCheckResults = {
        healthy: true,
        latencyMs: 10 + Math.random() * 50,
        errorRate: Math.random() * 0.01,
      };
    }

    return results;
  }

  /**
   * Handle job error
   */
  private handleJobError(job: RetrainingJob, error: unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    job.status = RetrainingJobStatus.FAILED;
    job.error = errorMessage;

    this.emit("job_failed", { jobId: job.jobId, error: errorMessage });
    this.emit("error", { message: errorMessage, context: `Job ${job.jobId}` });

    this.finalizeJob(job);
  }

  /**
   * Finalize job
   */
  private finalizeJob(job: RetrainingJob): void {
    job.completedAt = new Date();
    if (job.startedAt) {
      job.durationMs = job.completedAt.getTime() - job.startedAt.getTime();
    }

    this.activeJobs.delete(job.jobId);

    // Add to history
    const historyEntry: RetrainingHistoryEntry = {
      entryId: this.generateId("history"),
      jobId: job.jobId,
      modelType: job.config.modelType,
      triggerReason: job.config.triggerReason,
      status: job.status,
      previousAccuracy: job.validationResults?.oldModelAccuracy ?? 0,
      newAccuracy:
        job.status === RetrainingJobStatus.COMPLETED
          ? job.validationResults?.newModelAccuracy
          : undefined,
      improvement:
        job.status === RetrainingJobStatus.COMPLETED
          ? job.validationResults?.improvement
          : undefined,
      trainingSamples: job.trainingMetrics?.samplesUsed ?? 0,
      durationMs: job.durationMs ?? 0,
      timestamp: new Date(),
    };

    this.history.push(historyEntry);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): RetrainingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): RetrainingJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): RetrainingJob[] {
    return Array.from(this.jobs.values()).filter((job) =>
      this.activeJobs.has(job.jobId)
    );
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: RetrainingJobStatus): RetrainingJob[] {
    return Array.from(this.jobs.values()).filter((job) => job.status === status);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (
      job.status === RetrainingJobStatus.COMPLETED ||
      job.status === RetrainingJobStatus.FAILED ||
      job.status === RetrainingJobStatus.CANCELLED
    ) {
      return false;
    }

    job.status = RetrainingJobStatus.CANCELLED;
    job.error = "Job cancelled by user";
    this.activeJobs.delete(jobId);
    job.completedAt = new Date();

    return true;
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Check performance and trigger retraining if needed
   */
  async checkPerformanceAndTrigger(): Promise<RetrainingJob | null> {
    if (!this.config.autoPerformanceRetraining) return null;

    // Check each model type
    for (const modelType of Object.values(RetrainableModelType)) {
      const currentAccuracy = await this.getCurrentModelAccuracy(modelType);
      const threshold = 1 - this.config.performanceDropThreshold;

      // Find baseline accuracy (from history or default)
      const baselineAccuracy = this.getBaselineAccuracy(modelType);

      if (currentAccuracy < baselineAccuracy * threshold) {
        this.emit("performance_trigger", {
          modelType,
          currentAccuracy,
          threshold: baselineAccuracy * threshold,
        });

        // Check if we should skip due to recent retraining
        if (!this.shouldSkipRetraining(modelType)) {
          return this.triggerRetraining(
            modelType,
            TriggerReason.PERFORMANCE_DROP,
            { priority: 10 } // High priority for performance drops
          );
        }
      }
    }

    return null;
  }

  /**
   * Get current model accuracy
   */
  private async getCurrentModelAccuracy(
    modelType: RetrainableModelType
  ): Promise<number> {
    return this.getOldModelAccuracy(modelType);
  }

  /**
   * Get baseline accuracy from history
   */
  private getBaselineAccuracy(modelType: RetrainableModelType): number {
    const relevantHistory = this.history.filter(
      (h) =>
        h.modelType === modelType &&
        h.status === RetrainingJobStatus.COMPLETED &&
        h.newAccuracy !== undefined
    );

    if (relevantHistory.length === 0) {
      return 0.8; // Default baseline
    }

    // Return average of last 5 successful retrainings
    const recent = relevantHistory.slice(-5);
    const sum = recent.reduce((acc, h) => acc + (h.newAccuracy ?? 0), 0);
    return sum / recent.length;
  }

  // ============================================================================
  // Statistics and History
  // ============================================================================

  /**
   * Get retraining history
   */
  getHistory(
    options: {
      modelType?: RetrainableModelType;
      status?: RetrainingJobStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): RetrainingHistoryEntry[] {
    let history = [...this.history];

    if (options.modelType) {
      history = history.filter((h) => h.modelType === options.modelType);
    }

    if (options.status) {
      history = history.filter((h) => h.status === options.status);
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.offset) {
      history = history.slice(options.offset);
    }

    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Get scheduler statistics
   */
  getStatistics(): SchedulerStatistics {
    const cacheKey = "scheduler_statistics";
    const cached = this.getFromCache<SchedulerStatistics>(cacheKey);
    if (cached) return cached;

    const stats: SchedulerStatistics = {
      totalJobs: this.jobs.size,
      successfulJobs: Array.from(this.jobs.values()).filter(
        (j) => j.status === RetrainingJobStatus.COMPLETED
      ).length,
      failedJobs: Array.from(this.jobs.values()).filter(
        (j) => j.status === RetrainingJobStatus.FAILED
      ).length,
      rolledBackJobs: Array.from(this.jobs.values()).filter(
        (j) => j.status === RetrainingJobStatus.ROLLED_BACK
      ).length,
      avgTrainingDurationMs: this.calculateAverageDuration(),
      avgImprovementPercent: this.calculateAverageImprovement(),
      totalSamplesUsed: this.calculateTotalSamples(),
      activeSchedules: Array.from(this.schedules.values()).filter((s) => s.enabled)
        .length,
      jobsByModelType: this.countJobsByModelType(),
      jobsByTriggerReason: this.countJobsByTriggerReason(),
      lastUpdated: new Date(),
    };

    this.setInCache(cacheKey, stats);
    return stats;
  }

  /**
   * Calculate average training duration
   */
  private calculateAverageDuration(): number {
    const completedJobs = Array.from(this.jobs.values()).filter(
      (j) => j.durationMs !== undefined
    );

    if (completedJobs.length === 0) return 0;

    const sum = completedJobs.reduce((acc, j) => acc + (j.durationMs ?? 0), 0);
    return sum / completedJobs.length;
  }

  /**
   * Calculate average improvement
   */
  private calculateAverageImprovement(): number {
    const successfulJobs = Array.from(this.jobs.values()).filter(
      (j) =>
        j.status === RetrainingJobStatus.COMPLETED &&
        j.validationResults?.improvementPercent !== undefined
    );

    if (successfulJobs.length === 0) return 0;

    const sum = successfulJobs.reduce(
      (acc, j) => acc + (j.validationResults?.improvementPercent ?? 0),
      0
    );
    return sum / successfulJobs.length;
  }

  /**
   * Calculate total samples used
   */
  private calculateTotalSamples(): number {
    return Array.from(this.jobs.values()).reduce(
      (acc, j) => acc + (j.trainingMetrics?.samplesUsed ?? 0),
      0
    );
  }

  /**
   * Count jobs by model type
   */
  private countJobsByModelType(): Record<RetrainableModelType, number> {
    const counts = {} as Record<RetrainableModelType, number>;

    for (const type of Object.values(RetrainableModelType)) {
      counts[type] = 0;
    }

    for (const job of this.jobs.values()) {
      counts[job.config.modelType]++;
    }

    return counts;
  }

  /**
   * Count jobs by trigger reason
   */
  private countJobsByTriggerReason(): Record<TriggerReason, number> {
    const counts = {} as Record<TriggerReason, number>;

    for (const reason of Object.values(TriggerReason)) {
      counts[reason] = 0;
    }

    for (const job of this.jobs.values()) {
      counts[job.config.triggerReason]++;
    }

    return counts;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the scheduler
   */
  start(): void {
    this.config.enabled = true;

    // Start all enabled interval schedules
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled && schedule.scheduleType === ScheduleType.INTERVAL) {
        this.startIntervalSchedule(schedule);
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.config.enabled = false;

    // Stop all intervals
    for (const [scheduleId] of this.schedulerIntervals) {
      this.stopSchedule(scheduleId);
    }
  }

  /**
   * Destroy the scheduler
   */
  destroy(): void {
    this.stop();
    this.schedules.clear();
    this.jobs.clear();
    this.history = [];
    this.cache.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ModelRetrainingScheduler instance
 */
export function createModelRetrainingScheduler(
  config?: Partial<SchedulerConfig>
): ModelRetrainingScheduler {
  return new ModelRetrainingScheduler(config);
}

// Shared instance management
let sharedScheduler: ModelRetrainingScheduler | null = null;

/**
 * Get the shared scheduler instance
 */
export function getSharedModelRetrainingScheduler(): ModelRetrainingScheduler {
  if (!sharedScheduler) {
    sharedScheduler = createModelRetrainingScheduler();
  }
  return sharedScheduler;
}

/**
 * Set the shared scheduler instance
 */
export function setSharedModelRetrainingScheduler(
  scheduler: ModelRetrainingScheduler
): void {
  sharedScheduler = scheduler;
}

/**
 * Reset the shared scheduler instance
 */
export function resetSharedModelRetrainingScheduler(): void {
  if (sharedScheduler) {
    sharedScheduler.destroy();
    sharedScheduler = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get schedule type description
 */
export function getScheduleTypeDescription(type: ScheduleType): string {
  return SCHEDULE_TYPE_DESCRIPTIONS[type];
}

/**
 * Get model type description
 */
export function getModelTypeDescription(type: RetrainableModelType): string {
  return MODEL_TYPE_DESCRIPTIONS[type];
}

/**
 * Get job status description
 */
export function getJobStatusDescription(status: RetrainingJobStatus): string {
  const descriptions: Record<RetrainingJobStatus, string> = {
    [RetrainingJobStatus.SCHEDULED]: "Scheduled for execution",
    [RetrainingJobStatus.PENDING]: "Pending execution",
    [RetrainingJobStatus.COLLECTING_DATA]: "Collecting training data",
    [RetrainingJobStatus.TRAINING]: "Training model",
    [RetrainingJobStatus.VALIDATING]: "Validating model",
    [RetrainingJobStatus.DEPLOYING]: "Deploying model",
    [RetrainingJobStatus.COMPLETED]: "Completed successfully",
    [RetrainingJobStatus.FAILED]: "Failed",
    [RetrainingJobStatus.CANCELLED]: "Cancelled",
    [RetrainingJobStatus.ROLLED_BACK]: "Rolled back",
  };
  return descriptions[status];
}

/**
 * Get job status color
 */
export function getJobStatusColor(status: RetrainingJobStatus): string {
  const colors: Record<RetrainingJobStatus, string> = {
    [RetrainingJobStatus.SCHEDULED]: "#9CA3AF",
    [RetrainingJobStatus.PENDING]: "#60A5FA",
    [RetrainingJobStatus.COLLECTING_DATA]: "#F59E0B",
    [RetrainingJobStatus.TRAINING]: "#F59E0B",
    [RetrainingJobStatus.VALIDATING]: "#F59E0B",
    [RetrainingJobStatus.DEPLOYING]: "#F59E0B",
    [RetrainingJobStatus.COMPLETED]: "#10B981",
    [RetrainingJobStatus.FAILED]: "#EF4444",
    [RetrainingJobStatus.CANCELLED]: "#6B7280",
    [RetrainingJobStatus.ROLLED_BACK]: "#F97316",
  };
  return colors[status];
}

/**
 * Get trigger reason description
 */
export function getTriggerReasonDescription(reason: TriggerReason): string {
  const descriptions: Record<TriggerReason, string> = {
    [TriggerReason.SCHEDULED]: "Scheduled retraining",
    [TriggerReason.PERFORMANCE_DROP]: "Performance drop detected",
    [TriggerReason.NEW_DATA_AVAILABLE]: "New training data available",
    [TriggerReason.DATA_DRIFT_DETECTED]: "Data drift detected",
    [TriggerReason.MANUAL]: "Manual trigger",
    [TriggerReason.MODEL_EXPIRED]: "Model expired",
  };
  return descriptions[reason];
}

/**
 * Get validation strategy description
 */
export function getValidationStrategyDescription(
  strategy: ValidationStrategy
): string {
  const descriptions: Record<ValidationStrategy, string> = {
    [ValidationStrategy.ACCURACY_COMPARISON]: "Compare accuracy metrics",
    [ValidationStrategy.AB_TEST]: "A/B test with production traffic",
    [ValidationStrategy.SHADOW_MODE]: "Shadow mode comparison",
    [ValidationStrategy.HOLDOUT_VALIDATION]: "Holdout validation set",
    [ValidationStrategy.CROSS_VALIDATION]: "Cross-validation",
  };
  return descriptions[strategy];
}

/**
 * Get deployment strategy description
 */
export function getDeploymentStrategyDescription(
  strategy: DeploymentStrategy
): string {
  const descriptions: Record<DeploymentStrategy, string> = {
    [DeploymentStrategy.IMMEDIATE]: "Immediate replacement",
    [DeploymentStrategy.GRADUAL]: "Gradual rollout",
    [DeploymentStrategy.CANARY]: "Canary deployment",
    [DeploymentStrategy.BLUE_GREEN]: "Blue-green deployment",
  };
  return descriptions[strategy];
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format improvement
 */
export function formatImprovement(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create mock retraining job
 */
export function createMockRetrainingJob(
  overrides: Partial<RetrainingJob> = {}
): RetrainingJob {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const statuses: RetrainingJobStatus[] = [
    RetrainingJobStatus.PENDING,
    RetrainingJobStatus.TRAINING,
    RetrainingJobStatus.COMPLETED,
    RetrainingJobStatus.FAILED,
  ];
  const status: RetrainingJobStatus =
    overrides.status ?? statuses[Math.floor(Math.random() * statuses.length)]!;

  const isCompleted = status === RetrainingJobStatus.COMPLETED;

  return {
    jobId,
    config: {
      modelType: RetrainableModelType.ANOMALY_DETECTION,
      dataCollection: DEFAULT_DATA_COLLECTION_CONFIG,
      validation: DEFAULT_VALIDATION_CONFIG,
      deployment: DEFAULT_DEPLOYMENT_CONFIG,
      triggerReason: TriggerReason.SCHEDULED,
      priority: 1,
    },
    status,
    progress: isCompleted ? 100 : Math.floor(Math.random() * 80),
    stageMessage: getJobStatusDescription(status),
    createdAt: new Date(Date.now() - Math.random() * 86400000),
    startedAt: new Date(Date.now() - Math.random() * 3600000),
    completedAt: isCompleted ? new Date() : undefined,
    durationMs: isCompleted ? Math.floor(Math.random() * 300000) + 60000 : undefined,
    trainingMetrics: isCompleted
      ? {
          loss: 0.1 + Math.random() * 0.1,
          accuracy: 0.8 + Math.random() * 0.15,
          precision: 0.75 + Math.random() * 0.2,
          recall: 0.7 + Math.random() * 0.25,
          f1Score: 0.72 + Math.random() * 0.2,
          aucRoc: 0.85 + Math.random() * 0.1,
          trainingDurationMs: Math.floor(Math.random() * 60000) + 10000,
          samplesUsed: Math.floor(Math.random() * 5000) + 500,
        }
      : undefined,
    validationResults: isCompleted
      ? {
          strategy: ValidationStrategy.HOLDOUT_VALIDATION,
          passed: true,
          oldModelAccuracy: 0.75 + Math.random() * 0.1,
          newModelAccuracy: 0.8 + Math.random() * 0.15,
          improvement: 0.02 + Math.random() * 0.08,
          improvementPercent: 2 + Math.random() * 10,
          samplesUsed: 1000,
          metrics: {
            precision: 0.8,
            recall: 0.75,
            f1Score: 0.77,
            aucRoc: 0.88,
          },
          validatedAt: new Date(),
        }
      : undefined,
    ...overrides,
  };
}

/**
 * Create mock retraining schedule
 */
export function createMockRetrainingSchedule(
  overrides: Partial<RetrainingSchedule> = {}
): RetrainingSchedule {
  return {
    scheduleId: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    modelType: RetrainableModelType.ANOMALY_DETECTION,
    scheduleType: ScheduleType.INTERVAL,
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
    createdAt: new Date(Date.now() - Math.random() * 604800000),
    updatedAt: new Date(),
    lastExecutedAt: new Date(Date.now() - Math.random() * 86400000),
    nextExecutionAt: new Date(Date.now() + Math.random() * 86400000),
    ...overrides,
  };
}

/**
 * Create mock history entry
 */
export function createMockHistoryEntry(
  overrides: Partial<RetrainingHistoryEntry> = {}
): RetrainingHistoryEntry {
  const isSuccessful = Math.random() > 0.2;
  return {
    entryId: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    modelType: RetrainableModelType.ANOMALY_DETECTION,
    triggerReason: TriggerReason.SCHEDULED,
    status: isSuccessful
      ? RetrainingJobStatus.COMPLETED
      : RetrainingJobStatus.FAILED,
    previousAccuracy: 0.75 + Math.random() * 0.1,
    newAccuracy: isSuccessful ? 0.8 + Math.random() * 0.15 : undefined,
    improvement: isSuccessful ? 0.02 + Math.random() * 0.08 : undefined,
    trainingSamples: Math.floor(Math.random() * 5000) + 500,
    durationMs: Math.floor(Math.random() * 300000) + 60000,
    timestamp: new Date(Date.now() - Math.random() * 604800000),
    ...overrides,
  };
}

/**
 * Create mock scheduler statistics
 */
export function createMockSchedulerStatistics(
  overrides: Partial<SchedulerStatistics> = {}
): SchedulerStatistics {
  return {
    totalJobs: Math.floor(Math.random() * 100) + 10,
    successfulJobs: Math.floor(Math.random() * 80) + 5,
    failedJobs: Math.floor(Math.random() * 10),
    rolledBackJobs: Math.floor(Math.random() * 5),
    avgTrainingDurationMs: Math.floor(Math.random() * 180000) + 60000,
    avgImprovementPercent: Math.random() * 10 + 2,
    totalSamplesUsed: Math.floor(Math.random() * 500000) + 50000,
    activeSchedules: Math.floor(Math.random() * 5) + 1,
    jobsByModelType: {
      [RetrainableModelType.ANOMALY_DETECTION]: Math.floor(Math.random() * 30) + 5,
      [RetrainableModelType.INSIDER_PREDICTOR]: Math.floor(Math.random() * 25) + 3,
      [RetrainableModelType.MARKET_PREDICTOR]: Math.floor(Math.random() * 20) + 2,
      [RetrainableModelType.SIGNAL_TRACKER]: Math.floor(Math.random() * 15) + 1,
    },
    jobsByTriggerReason: {
      [TriggerReason.SCHEDULED]: Math.floor(Math.random() * 50) + 10,
      [TriggerReason.PERFORMANCE_DROP]: Math.floor(Math.random() * 10) + 1,
      [TriggerReason.NEW_DATA_AVAILABLE]: Math.floor(Math.random() * 15) + 2,
      [TriggerReason.DATA_DRIFT_DETECTED]: Math.floor(Math.random() * 5),
      [TriggerReason.MANUAL]: Math.floor(Math.random() * 10) + 1,
      [TriggerReason.MODEL_EXPIRED]: Math.floor(Math.random() * 3),
    },
    lastUpdated: new Date(),
    ...overrides,
  };
}
