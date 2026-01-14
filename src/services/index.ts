/**
 * Services Module
 *
 * Background services for the Polymarket Tracker application.
 */

export { MarketSyncService, marketSyncService, createMarketSyncService } from "./market-sync";
export type { MarketSyncConfig, SyncStats, VolumeChangeEvent } from "./market-sync";

export {
  TradeStreamService,
  tradeStreamService,
  createTradeStreamService,
} from "./trade-stream";
export type {
  TradeStreamServiceConfig,
  TradeProcessingStats,
  TradeProcessedEvent,
  WhaleTradeEvent,
  NewWalletEvent,
  ProcessingErrorEvent,
} from "./trade-stream";

export {
  WalletProfilerService,
  walletProfilerService,
  createWalletProfilerService,
} from "./wallet-profiler";
export type {
  WalletProfilerServiceConfig,
  WalletProfiledEvent,
  WalletProfilerStats,
} from "./wallet-profiler";

export {
  AlertGeneratorService,
  alertGeneratorService,
  createAlertGeneratorService,
} from "./alert-generator";
export type {
  AlertGeneratorConfig,
  AlertCreatedEvent,
  AlertSuppressedEvent,
  AlertGeneratorStats,
} from "./alert-generator";

export {
  StartupOrchestrator,
  startupOrchestrator,
  createStartupOrchestrator,
  startAllServices,
  stopAllServices,
} from "./startup";
export type {
  StartupConfig,
  ServiceStatus,
  ServiceInfo,
  StartupStatus,
  StartupEvents,
} from "./startup";

export {
  IngestionHealthService,
  getIngestionHealthService,
  createIngestionHealthService,
  resetIngestionHealthService,
} from "./ingestion-health";
export type {
  IngestionHealthServiceConfig,
  PersistedHealth,
  IngestionHealthStatus,
} from "./ingestion-health";
