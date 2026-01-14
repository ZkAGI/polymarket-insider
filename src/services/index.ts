/**
 * Services Module
 *
 * Background services for the Polymarket Tracker application.
 */

export { MarketSyncService, marketSyncService, createMarketSyncService } from "./market-sync";
export type { MarketSyncConfig, SyncStats, VolumeChangeEvent } from "./market-sync";
