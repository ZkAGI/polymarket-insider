/**
 * Market Sync Background Service
 *
 * Periodically fetches and stores live market data from the Gamma API.
 * Runs every 5 minutes by default and emits events for significant changes.
 */

import { getAllActiveMarkets, GammaMarket, GammaClient, gammaClient } from "../api/gamma";
import {
  MarketService,
  marketService as defaultMarketService,
  CreateMarketInput,
} from "../db/markets";
import { EventEmitter } from "events";

/**
 * Configuration for the Market Sync Service
 */
export interface MarketSyncConfig {
  /** Sync interval in milliseconds (default: 5 minutes) */
  syncIntervalMs?: number;

  /** Whether to emit events for market changes */
  enableEvents?: boolean;

  /** Minimum volume change percentage to trigger 'market:updated' event (default: 5%) */
  volumeChangeThreshold?: number;

  /** Custom Gamma client to use */
  gammaClient?: GammaClient;

  /** Custom market service to use */
  marketService?: MarketService;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Stats from a sync operation
 */
export interface SyncStats {
  /** Total markets synced */
  totalSynced: number;

  /** New markets discovered */
  newMarkets: number;

  /** Markets updated */
  updatedMarkets: number;

  /** Markets with significant volume change */
  volumeChanges: number;

  /** Markets that are now closed */
  closedMarkets: number;

  /** Duration of sync in milliseconds */
  durationMs: number;

  /** Timestamp of sync completion */
  syncedAt: string;

  /** Any errors encountered */
  errors: string[];
}

/**
 * Volume change event data
 */
export interface VolumeChangeEvent {
  /** Market ID */
  marketId: string;

  /** Market slug */
  slug: string;

  /** Market question */
  question: string;

  /** Previous volume */
  previousVolume: number;

  /** Current volume */
  currentVolume: number;

  /** Absolute change */
  volumeChange: number;

  /** Percentage change */
  volumeChangePercent: number;
}

/**
 * Market Sync Service
 *
 * Background service that periodically syncs market data from Polymarket's Gamma API
 * to the local database.
 */
export class MarketSyncService extends EventEmitter {
  private config: Required<MarketSyncConfig>;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isSyncing = false;
  private lastSyncStats: SyncStats | null = null;

  // Cache of previous volumes for change detection
  private volumeCache: Map<string, number> = new Map();

  constructor(config: MarketSyncConfig = {}) {
    super();
    this.config = {
      syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      enableEvents: config.enableEvents ?? true,
      volumeChangeThreshold: config.volumeChangeThreshold ?? 5, // 5%
      gammaClient: config.gammaClient ?? gammaClient,
      marketService: config.marketService ?? defaultMarketService,
      logger: config.logger ?? this.defaultLogger.bind(this),
    };
  }

  /**
   * Default logger that prefixes messages with service name
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [MarketSync] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [MarketSync] ${message}`);
    }
  }

  /**
   * Start the sync service.
   *
   * This will immediately perform an initial sync and then schedule
   * periodic syncs at the configured interval.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.config.logger("Service already running");
      return;
    }

    this.config.logger("Starting market sync service", {
      intervalMs: this.config.syncIntervalMs,
      volumeChangeThreshold: this.config.volumeChangeThreshold,
    });

    this.isRunning = true;
    this.emit("started");

    // Perform initial sync
    try {
      await this.sync();
    } catch (error) {
      this.config.logger("Initial sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Schedule periodic syncs
    this.syncInterval = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        this.config.logger("Scheduled sync failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.syncIntervalMs);

    this.config.logger("Service started");
  }

  /**
   * Stop the sync service.
   */
  stop(): void {
    if (!this.isRunning) {
      this.config.logger("Service not running");
      return;
    }

    this.config.logger("Stopping market sync service");

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
    this.emit("stopped");
    this.config.logger("Service stopped");
  }

  /**
   * Check if the service is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if a sync is currently in progress.
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Get stats from the last sync operation.
   */
  getLastSyncStats(): SyncStats | null {
    return this.lastSyncStats;
  }

  /**
   * Perform a single sync operation.
   *
   * This fetches all active markets from the Gamma API and upserts them
   * into the database. It also emits events for significant changes.
   */
  async sync(): Promise<SyncStats> {
    if (this.isSyncing) {
      this.config.logger("Sync already in progress, skipping");
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];

    const stats: SyncStats = {
      totalSynced: 0,
      newMarkets: 0,
      updatedMarkets: 0,
      volumeChanges: 0,
      closedMarkets: 0,
      durationMs: 0,
      syncedAt: new Date().toISOString(),
      errors: [],
    };

    try {
      this.config.logger("Starting sync");
      this.emit("sync:start");

      // Fetch all active markets from Gamma API
      const markets = await getAllActiveMarkets({
        client: this.config.gammaClient,
      });

      this.config.logger(`Fetched ${markets.length} markets from Gamma API`);

      // Process each market
      for (const gammaMarket of markets) {
        try {
          const result = await this.processMarket(gammaMarket);

          if (result.isNew) {
            stats.newMarkets++;
          } else {
            stats.updatedMarkets++;
          }

          if (result.volumeChange) {
            stats.volumeChanges++;
          }

          if (result.isClosed) {
            stats.closedMarkets++;
          }

          stats.totalSynced++;
        } catch (error) {
          const errorMessage = `Failed to process market ${gammaMarket.id}: ${
            error instanceof Error ? error.message : String(error)
          }`;
          errors.push(errorMessage);
          this.config.logger(errorMessage);
        }
      }

      stats.durationMs = Date.now() - startTime;
      stats.errors = errors;
      stats.syncedAt = new Date().toISOString();
      this.lastSyncStats = stats;

      this.config.logger("Sync completed", {
        totalSynced: stats.totalSynced,
        newMarkets: stats.newMarkets,
        updatedMarkets: stats.updatedMarkets,
        volumeChanges: stats.volumeChanges,
        durationMs: stats.durationMs,
        errors: errors.length,
      });

      this.emit("sync:complete", stats);
      return stats;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a single market from the Gamma API.
   */
  private async processMarket(
    gammaMarket: GammaMarket
  ): Promise<{ isNew: boolean; volumeChange: boolean; isClosed: boolean }> {
    // Check if market already exists
    const existingMarket = await this.config.marketService.findById(gammaMarket.id);
    const isNew = !existingMarket;
    const isClosed = gammaMarket.closed;

    // Check for significant volume change
    let volumeChange = false;
    const previousVolume = this.volumeCache.get(gammaMarket.id);
    const currentVolume = gammaMarket.volume ?? gammaMarket.volumeNum ?? 0;

    if (previousVolume !== undefined && previousVolume > 0) {
      const changePercent = Math.abs(
        ((currentVolume - previousVolume) / previousVolume) * 100
      );

      if (changePercent >= this.config.volumeChangeThreshold) {
        volumeChange = true;

        if (this.config.enableEvents) {
          const event: VolumeChangeEvent = {
            marketId: gammaMarket.id,
            slug: gammaMarket.slug,
            question: gammaMarket.question,
            previousVolume,
            currentVolume,
            volumeChange: currentVolume - previousVolume,
            volumeChangePercent: changePercent,
          };

          this.emit("market:updated", event);
          this.config.logger("Volume change detected", event as unknown as Record<string, unknown>);
        }
      }
    }

    // Update volume cache
    this.volumeCache.set(gammaMarket.id, currentVolume);

    // Convert Gamma market to database input
    const marketInput = this.gammaMarketToDbInput(gammaMarket);

    // Upsert the market
    await this.config.marketService.upsert(marketInput);

    // Emit event for new markets
    if (isNew && this.config.enableEvents) {
      this.emit("market:new", {
        marketId: gammaMarket.id,
        slug: gammaMarket.slug,
        question: gammaMarket.question,
        category: gammaMarket.category,
        volume: currentVolume,
      });
    }

    return { isNew, volumeChange, isClosed };
  }

  /**
   * Convert a Gamma API market to database input format.
   */
  private gammaMarketToDbInput(market: GammaMarket): CreateMarketInput {
    return {
      id: market.id,
      slug: market.slug,
      question: market.question,
      description: market.description || undefined,
      category: market.category || undefined,
      imageUrl: market.image || undefined,
      iconUrl: market.icon || undefined,
      resolutionSource: market.resolutionSource || undefined,
      endDate: market.endDate ? new Date(market.endDate) : undefined,
      active: market.active,
      closed: market.closed,
      archived: market.archived,
      volume: market.volume ?? market.volumeNum ?? 0,
      liquidity: market.liquidity ?? 0,
    };
  }

  /**
   * Force an immediate sync regardless of current state.
   * This will wait for any in-progress sync to complete first.
   */
  async forceSync(): Promise<SyncStats> {
    // Wait for any in-progress sync
    while (this.isSyncing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.sync();
  }

  /**
   * Clear the volume cache.
   * This will cause the next sync to not detect volume changes.
   */
  clearVolumeCache(): void {
    this.volumeCache.clear();
    this.config.logger("Volume cache cleared");
  }

  /**
   * Get the current volume cache size.
   */
  getVolumeCacheSize(): number {
    return this.volumeCache.size;
  }

  /**
   * Update service configuration.
   */
  updateConfig(config: Partial<MarketSyncConfig>): void {
    if (config.syncIntervalMs !== undefined) {
      this.config.syncIntervalMs = config.syncIntervalMs;

      // If running, restart with new interval
      if (this.isRunning && this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = setInterval(async () => {
          try {
            await this.sync();
          } catch (error) {
            this.config.logger("Scheduled sync failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }, this.config.syncIntervalMs);
      }
    }

    if (config.enableEvents !== undefined) {
      this.config.enableEvents = config.enableEvents;
    }

    if (config.volumeChangeThreshold !== undefined) {
      this.config.volumeChangeThreshold = config.volumeChangeThreshold;
    }

    if (config.logger !== undefined) {
      this.config.logger = config.logger;
    }

    this.config.logger("Config updated", {
      syncIntervalMs: this.config.syncIntervalMs,
      enableEvents: this.config.enableEvents,
      volumeChangeThreshold: this.config.volumeChangeThreshold,
    });
  }
}

/**
 * Default market sync service instance.
 */
export const marketSyncService = new MarketSyncService();

/**
 * Create a new market sync service instance with custom configuration.
 */
export function createMarketSyncService(config: MarketSyncConfig = {}): MarketSyncService {
  return new MarketSyncService(config);
}
