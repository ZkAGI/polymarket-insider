/**
 * Workers Module
 *
 * Background workers for continuous data processing.
 */

export {
  IngestionWorker,
  createIngestionWorker,
  ingestionWorker,
  type IngestionWorkerConfig,
  type IngestionHealth,
  type CycleResult,
} from "./ingestion-worker";

export {
  DetectionTrigger,
  createDetectionTrigger,
  getSharedDetectionTrigger,
  setSharedDetectionTrigger,
  resetSharedDetectionTrigger,
  type DetectionTriggerConfig,
  type DetectionCycleResult,
} from "./detection-trigger";
