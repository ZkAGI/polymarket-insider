// /**
//  * Market Sync Background Service
//  *
//  * Periodically fetches and stores live market data from the Gamma API.
//  * Runs every 5 minutes by default and emits events for significant changes.
//  */

// import { getAllActiveMarkets, GammaMarket, GammaClient, gammaClient } from "../api/gamma";
// import {
//   MarketService,
//   marketService as defaultMarketService,
//   CreateMarketInput,
// } from "../db/markets";
// import { EventEmitter } from "events";

// /**
//  * Configuration for the Market Sync Service
//  */
// export interface MarketSyncConfig {
//   /** Sync interval in milliseconds (default: 5 minutes) */
//   syncIntervalMs?: number;

//   /** Whether to emit events for market changes */
//   enableEvents?: boolean;

//   /** Minimum volume change percentage to trigger 'market:updated' event (default: 5%) */
//   volumeChangeThreshold?: number;

//   /** Custom Gamma client to use */
//   gammaClient?: GammaClient;

//   /** Custom market service to use */
//   marketService?: MarketService;

//   /** Logger function */
//   logger?: (message: string, data?: Record<string, unknown>) => void;
// }

// /**
//  * Stats from a sync operation
//  */
// export interface SyncStats {
//   /** Total markets synced */
//   totalSynced: number;

//   /** New markets discovered */
//   newMarkets: number;

//   /** Markets updated */
//   updatedMarkets: number;

//   /** Markets with significant volume change */
//   volumeChanges: number;

//   /** Markets that are now closed */
//   closedMarkets: number;

//   /** Duration of sync in milliseconds */
//   durationMs: number;

//   /** Timestamp of sync completion */
//   syncedAt: string;

//   /** Any errors encountered */
//   errors: string[];
// }

// /**
//  * Volume change event data
//  */
// export interface VolumeChangeEvent {
//   /** Market ID */
//   marketId: string;

//   /** Market slug */
//   slug: string;

//   /** Market question */
//   question: string;

//   /** Previous volume */
//   previousVolume: number;

//   /** Current volume */
//   currentVolume: number;

//   /** Absolute change */
//   volumeChange: number;

//   /** Percentage change */
//   volumeChangePercent: number;
// }

// /**
//  * Market Sync Service
//  *
//  * Background service that periodically syncs market data from Polymarket's Gamma API
//  * to the local database.
//  */
// export class MarketSyncService extends EventEmitter {
//   private config: Required<MarketSyncConfig>;
//   private syncInterval: ReturnType<typeof setInterval> | null = null;
//   private isRunning = false;
//   private isSyncing = false;
//   private lastSyncStats: SyncStats | null = null;

//   // Cache of previous volumes for change detection
//   private volumeCache: Map<string, number> = new Map();

//   constructor(config: MarketSyncConfig = {}) {
//     super();
//     this.config = {
//       syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000, // 5 minutes
//       enableEvents: config.enableEvents ?? true,
//       volumeChangeThreshold: config.volumeChangeThreshold ?? 5, // 5%
//       gammaClient: config.gammaClient ?? gammaClient,
//       marketService: config.marketService ?? defaultMarketService,
//       logger: config.logger ?? this.defaultLogger.bind(this),
//     };
//   }

//   /**
//    * Default logger that prefixes messages with service name
//    */
//   private defaultLogger(message: string, data?: Record<string, unknown>): void {
//     const timestamp = new Date().toISOString();
//     if (data) {
//       console.log(`[${timestamp}] [MarketSync] ${message}`, data);
//     } else {
//       console.log(`[${timestamp}] [MarketSync] ${message}`);
//     }
//   }

//   /**
//    * Start the sync service.
//    *
//    * This will immediately perform an initial sync and then schedule
//    * periodic syncs at the configured interval.
//    */
//   async start(): Promise<void> {
//     if (this.isRunning) {
//       this.config.logger("Service already running");
//       return;
//     }

//     this.config.logger("Starting market sync service", {
//       intervalMs: this.config.syncIntervalMs,
//       volumeChangeThreshold: this.config.volumeChangeThreshold,
//     });

//     this.isRunning = true;
//     this.emit("started");

//     // Perform initial sync
//     try {
//       await this.sync();
//     } catch (error) {
//       this.config.logger("Initial sync failed", {
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }

//     // Schedule periodic syncs
//     this.syncInterval = setInterval(async () => {
//       try {
//         await this.sync();
//       } catch (error) {
//         this.config.logger("Scheduled sync failed", {
//           error: error instanceof Error ? error.message : String(error),
//         });
//       }
//     }, this.config.syncIntervalMs);

//     this.config.logger("Service started");
//   }

//   /**
//    * Stop the sync service.
//    */
//   stop(): void {
//     if (!this.isRunning) {
//       this.config.logger("Service not running");
//       return;
//     }

//     this.config.logger("Stopping market sync service");

//     if (this.syncInterval) {
//       clearInterval(this.syncInterval);
//       this.syncInterval = null;
//     }

//     this.isRunning = false;
//     this.emit("stopped");
//     this.config.logger("Service stopped");
//   }

//   /**
//    * Check if the service is currently running.
//    */
//   getIsRunning(): boolean {
//     return this.isRunning;
//   }

//   /**
//    * Check if a sync is currently in progress.
//    */
//   getIsSyncing(): boolean {
//     return this.isSyncing;
//   }

//   /**
//    * Get stats from the last sync operation.
//    */
//   getLastSyncStats(): SyncStats | null {
//     return this.lastSyncStats;
//   }

//   /**
//    * Perform a single sync operation.
//    *
//    * This fetches all active markets from the Gamma API and upserts them
//    * into the database. It also emits events for significant changes.
//    */
//   async sync(): Promise<SyncStats> {
//     if (this.isSyncing) {
//       this.config.logger("Sync already in progress, skipping");
//       throw new Error("Sync already in progress");
//     }

//     this.isSyncing = true;
//     const startTime = Date.now();
//     const errors: string[] = [];

//     const stats: SyncStats = {
//       totalSynced: 0,
//       newMarkets: 0,
//       updatedMarkets: 0,
//       volumeChanges: 0,
//       closedMarkets: 0,
//       durationMs: 0,
//       syncedAt: new Date().toISOString(),
//       errors: [],
//     };

//     try {
//       this.config.logger("Starting sync");
//       this.emit("sync:start");

//       // Fetch all active markets from Gamma API
//       const markets = await getAllActiveMarkets({
//         client: this.config.gammaClient,
//       });

//       this.config.logger(`Fetched ${markets.length} markets from Gamma API`);

//       // Process each market
//       for (const gammaMarket of markets) {
//         try {
//           const result = await this.processMarket(gammaMarket);

//           if (result.isNew) {
//             stats.newMarkets++;
//           } else {
//             stats.updatedMarkets++;
//           }

//           if (result.volumeChange) {
//             stats.volumeChanges++;
//           }

//           if (result.isClosed) {
//             stats.closedMarkets++;
//           }

//           stats.totalSynced++;
//         } catch (error) {
//           const errorMessage = `Failed to process market ${gammaMarket.id}: ${
//             error instanceof Error ? error.message : String(error)
//           }`;
//           errors.push(errorMessage);
//           this.config.logger(errorMessage);
//         }
//       }

//       stats.durationMs = Date.now() - startTime;
//       stats.errors = errors;
//       stats.syncedAt = new Date().toISOString();
//       this.lastSyncStats = stats;

//       this.config.logger("Sync completed", {
//         totalSynced: stats.totalSynced,
//         newMarkets: stats.newMarkets,
//         updatedMarkets: stats.updatedMarkets,
//         volumeChanges: stats.volumeChanges,
//         durationMs: stats.durationMs,
//         errors: errors.length,
//       });

//       this.emit("sync:complete", stats);
//       return stats;
//     } finally {
//       this.isSyncing = false;
//     }
//   }

//   /**
//    * Process a single market from the Gamma API.
//    */
//   private async processMarket(
//     gammaMarket: GammaMarket
//   ): Promise<{ isNew: boolean; volumeChange: boolean; isClosed: boolean }> {
//     // Check if market already exists
//     const existingMarket = await this.config.marketService.findById(gammaMarket.id);
//     const isNew = !existingMarket;
//     const isClosed = gammaMarket.closed;

//     // Check for significant volume change
//     let volumeChange = false;
//     const previousVolume = this.volumeCache.get(gammaMarket.id);
//     const currentVolume = gammaMarket.volume ?? gammaMarket.volumeNum ?? 0;

//     if (previousVolume !== undefined && previousVolume > 0) {
//       const changePercent = Math.abs(
//         ((currentVolume - previousVolume) / previousVolume) * 100
//       );

//       if (changePercent >= this.config.volumeChangeThreshold) {
//         volumeChange = true;

//         if (this.config.enableEvents) {
//           const event: VolumeChangeEvent = {
//             marketId: gammaMarket.id,
//             slug: gammaMarket.slug,
//             question: gammaMarket.question,
//             previousVolume,
//             currentVolume,
//             volumeChange: currentVolume - previousVolume,
//             volumeChangePercent: changePercent,
//           };

//           this.emit("market:updated", event);
//           this.config.logger("Volume change detected", event as unknown as Record<string, unknown>);
//         }
//       }
//     }

//     // Update volume cache
//     this.volumeCache.set(gammaMarket.id, currentVolume);

//     // Convert Gamma market to database input
//     const marketInput = this.gammaMarketToDbInput(gammaMarket);

//     // Upsert the market
//     await this.config.marketService.upsert(marketInput);

//     // Emit event for new markets
//     if (isNew && this.config.enableEvents) {
//       this.emit("market:new", {
//         marketId: gammaMarket.id,
//         slug: gammaMarket.slug,
//         question: gammaMarket.question,
//         category: gammaMarket.category,
//         volume: currentVolume,
//       });
//     }

//     return { isNew, volumeChange, isClosed };
//   }

//   /**
//    * Convert a Gamma API market to database input format.
//    */
//   private gammaMarketToDbInput(market: GammaMarket): CreateMarketInput {
//     return {
//       id: market.id,
//       slug: market.slug,
//       question: market.question,
//       description: market.description || undefined,
//       category: market.category || undefined,
//       imageUrl: market.image || undefined,
//       iconUrl: market.icon || undefined,
//       resolutionSource: market.resolutionSource || undefined,
//       endDate: market.endDate ? new Date(market.endDate) : undefined,
//       active: market.active,
//       closed: market.closed,
//       archived: market.archived,
//       volume: market.volume ?? market.volumeNum ?? 0,
//       liquidity: market.liquidity ?? 0,
//     };
//   }

//   /**
//    * Force an immediate sync regardless of current state.
//    * This will wait for any in-progress sync to complete first.
//    */
//   async forceSync(): Promise<SyncStats> {
//     // Wait for any in-progress sync
//     while (this.isSyncing) {
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     }
//     return this.sync();
//   }

//   /**
//    * Clear the volume cache.
//    * This will cause the next sync to not detect volume changes.
//    */
//   clearVolumeCache(): void {
//     this.volumeCache.clear();
//     this.config.logger("Volume cache cleared");
//   }

//   /**
//    * Get the current volume cache size.
//    */
//   getVolumeCacheSize(): number {
//     return this.volumeCache.size;
//   }

//   /**
//    * Update service configuration.
//    */
//   updateConfig(config: Partial<MarketSyncConfig>): void {
//     if (config.syncIntervalMs !== undefined) {
//       this.config.syncIntervalMs = config.syncIntervalMs;

//       // If running, restart with new interval
//       if (this.isRunning && this.syncInterval) {
//         clearInterval(this.syncInterval);
//         this.syncInterval = setInterval(async () => {
//           try {
//             await this.sync();
//           } catch (error) {
//             this.config.logger("Scheduled sync failed", {
//               error: error instanceof Error ? error.message : String(error),
//             });
//           }
//         }, this.config.syncIntervalMs);
//       }
//     }

//     if (config.enableEvents !== undefined) {
//       this.config.enableEvents = config.enableEvents;
//     }

//     if (config.volumeChangeThreshold !== undefined) {
//       this.config.volumeChangeThreshold = config.volumeChangeThreshold;
//     }

//     if (config.logger !== undefined) {
//       this.config.logger = config.logger;
//     }

//     this.config.logger("Config updated", {
//       syncIntervalMs: this.config.syncIntervalMs,
//       enableEvents: this.config.enableEvents,
//       volumeChangeThreshold: this.config.volumeChangeThreshold,
//     });
//   }
// }

// /**
//  * Default market sync service instance.
//  */
// export const marketSyncService = new MarketSyncService();

// /**
//  * Create a new market sync service instance with custom configuration.
//  */
// export function createMarketSyncService(config: MarketSyncConfig = {}): MarketSyncService {
//   return new MarketSyncService(config);
// }

/**
 * Market Sync Background Service (Production - Filtered)
 *
 * Syncs ONLY active, relevant markets for insider/whale detection.
 * Categories: Politics, Crypto, Finance, Tech, Science, Sports, Entertainment
 * 
 * This prevents database bloat from old/inactive markets.
 */

import { EventEmitter } from "events";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/client";
import {
  MarketService,
  marketService as defaultMarketService,
  CreateMarketInput,
} from "../db/markets";

/**
 * Allowed categories for insider detection
 */
const ALLOWED_CATEGORIES = [
  "politics",
  "political",
  "elections",
  "crypto",
  "cryptocurrency",
  "finance",
  "economics",
  "tech",
  "technology",
  "science",
  "health",
  "sports",
  "entertainment",
  "business",
  "energy",
  "war",
  "geopolitics",
  "world",
  "us-politics",
  "us-elections",
];

/**
 * Configuration for the Market Sync Service
 */
export interface MarketSyncConfig {
  syncIntervalMs?: number;
  enableEvents?: boolean;
  volumeChangeThreshold?: number;
  marketService?: MarketService;
  prisma?: PrismaClient;
  logger?: (message: string, data?: Record<string, unknown>) => void;
  /** Max markets to sync (default: 2000) */
  maxMarkets?: number;
  /** Only sync markets with volume above this (default: 1000) */
  minVolume?: number;
}

export interface SyncStats {
  totalSynced: number;
  newMarkets: number;
  updatedMarkets: number;
  skippedMarkets: number;
  volumeChanges: number;
  closedMarkets: number;
  outcomesCreated: number;
  outcomesUpdated: number;
  durationMs: number;
  syncedAt: string;
  errors: string[];
}

export interface VolumeChangeEvent {
  marketId: string;
  slug: string;
  question: string;
  previousVolume: number;
  currentVolume: number;
  volumeChange: number;
  volumeChangePercent: number;
}

interface GammaMarket {
  id: string;
  question: string;
  slug?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  image?: string;
  icon?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  volume?: string | number;
  volume24hr?: string | number;
  liquidity?: string | number;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
}

export class MarketSyncService extends EventEmitter {
  private config: {
    syncIntervalMs: number;
    enableEvents: boolean;
    volumeChangeThreshold: number;
    maxMarkets: number;
    minVolume: number;
  };
  private readonly marketService: MarketService;
  private readonly prisma: PrismaClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;
  
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isSyncing = false;
  private lastSyncStats: SyncStats | null = null;
  private volumeCache: Map<string, number> = new Map();

  private readonly GAMMA_API = "https://gamma-api.polymarket.com";

  constructor(config: MarketSyncConfig = {}) {
    super();
    this.config = {
      syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000,
      enableEvents: config.enableEvents ?? true,
      volumeChangeThreshold: config.volumeChangeThreshold ?? 5,
      maxMarkets: config.maxMarkets ?? 2000,
      minVolume: config.minVolume ?? 1000,
    };
    this.marketService = config.marketService ?? defaultMarketService;
    this.prisma = config.prisma ?? defaultPrisma;
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [MarketSync] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [MarketSync] ${message}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger("Service already running");
      return;
    }

    this.logger("Starting market sync service", {
      intervalMs: this.config.syncIntervalMs,
      maxMarkets: this.config.maxMarkets,
      minVolume: this.config.minVolume,
    });

    this.isRunning = true;
    this.emit("started");

    try {
      await this.sync();
    } catch (error) {
      this.logger("Initial sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        this.logger("Scheduled sync failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.syncIntervalMs);

    this.logger("Service started");
  }

  stop(): void {
    if (!this.isRunning) return;
    this.logger("Stopping market sync service");
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    this.emit("stopped");
    this.logger("Service stopped");
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getLastSyncStats(): SyncStats | null {
    return this.lastSyncStats;
  }

  /**
   * Check if a market should be synced based on category and volume
   */
  private shouldSyncMarket(market: GammaMarket): boolean {
    // Must be active and not closed/archived
    if (market.closed || market.archived || market.active === false) {
      return false;
    }

    // Check volume threshold
    const volume = parseFloat(String(market.volume || 0)) || 0;
    if (volume < this.config.minVolume) {
      return false;
    }

    // Check category
    const category = (market.category || "").toLowerCase();
    const question = (market.question || "").toLowerCase();
    
    // Allow if category matches
    for (const allowed of ALLOWED_CATEGORIES) {
      if (category.includes(allowed)) {
        return true;
      }
    }

    // Also check question for keywords
    const keywords = ["election", "president", "congress", "senate", "bitcoin", "ethereum", "fed", "trump", "biden", "war", "ukraine", "russia", "china", "israel", "iran"];
    for (const keyword of keywords) {
      if (question.includes(keyword)) {
        return true;
      }
    }

    // Default: allow high volume markets regardless of category
    if (volume >= 100000) {
      return true;
    }

    return false;
  }

  /**
   * Main sync function - syncs filtered markets AND outcomes
   */
  async sync(): Promise<SyncStats> {
    if (this.isSyncing) {
      this.logger("Sync already in progress, skipping");
      return this.lastSyncStats ?? this.createEmptyStats();
    }

    this.isSyncing = true;
    const startTime = Date.now();
    this.logger("Starting sync");

    const stats: SyncStats = this.createEmptyStats();

    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore && stats.totalSynced < this.config.maxMarkets) {
        // Fetch only active markets, sorted by volume
        const url = `${this.GAMMA_API}/markets?limit=${limit}&offset=${offset}&active=true&closed=false`;
        
        const response = await fetch(url);
        if (!response.ok) {
          stats.errors.push(`API error: ${response.status}`);
          break;
        }

        const markets: GammaMarket[] = await response.json();
        
        if (!markets || markets.length === 0) {
          hasMore = false;
          break;
        }

        for (const market of markets) {
          // Stop if we've reached max
          if (stats.totalSynced >= this.config.maxMarkets) {
            hasMore = false;
            break;
          }

          // Filter markets
          if (!this.shouldSyncMarket(market)) {
            stats.skippedMarkets++;
            continue;
          }

          try {
            const result = await this.syncMarketWithOutcomes(market, stats);
            if (result.isNew) {
              stats.newMarkets++;
            } else {
              stats.updatedMarkets++;
            }
            stats.totalSynced++;
          } catch (error) {
            stats.errors.push(`Market ${market.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        offset += limit;
        if (markets.length < limit) {
          hasMore = false;
        }
      }
    } catch (error) {
      stats.errors.push(`Sync error: ${error instanceof Error ? error.message : String(error)}`);
    }

    stats.durationMs = Date.now() - startTime;
    stats.syncedAt = new Date().toISOString();
    
    this.lastSyncStats = stats;
    this.isSyncing = false;

    this.logger("Sync completed", {
      totalSynced: stats.totalSynced,
      newMarkets: stats.newMarkets,
      updatedMarkets: stats.updatedMarkets,
      skippedMarkets: stats.skippedMarkets,
      outcomesCreated: stats.outcomesCreated,
      outcomesUpdated: stats.outcomesUpdated,
      durationMs: stats.durationMs,
      errors: stats.errors.length,
    });

    this.emit("sync:completed", stats);
    return stats;
  }

  private async syncMarketWithOutcomes(
    market: GammaMarket,
    stats: SyncStats
  ): Promise<{ isNew: boolean }> {
    const existing = await this.prisma.market.findUnique({
      where: { id: market.id },
    });

    const isNew = !existing;

    const marketInput: CreateMarketInput = {
      id: market.id,
      slug: market.slug || market.id,
      question: market.question,
      description: market.description,
      category: market.category,
      subcategory: market.subcategory,
      imageUrl: market.image,
      iconUrl: market.icon,
      endDate: market.endDate ? new Date(market.endDate) : undefined,
      active: market.active ?? true,
      closed: market.closed ?? false,
      archived: market.archived ?? false,
      volume: parseFloat(String(market.volume || 0)) || 0,
      volume24h: parseFloat(String(market.volume24hr || 0)) || 0,
      liquidity: parseFloat(String(market.liquidity || 0)) || 0,
    };

    // Volume change detection
    if (!isNew && this.config.enableEvents) {
      const previousVolume = this.volumeCache.get(market.id) || 0;
      const currentVolume = marketInput.volume || 0;
      const volumeChange = currentVolume - previousVolume;
      const volumeChangePercent = previousVolume > 0 
        ? (volumeChange / previousVolume) * 100 
        : 0;

      if (Math.abs(volumeChangePercent) >= this.config.volumeChangeThreshold) {
        stats.volumeChanges++;
        this.emit("market:volumeChange", {
          marketId: market.id,
          slug: market.slug,
          question: market.question,
          previousVolume,
          currentVolume,
          volumeChange,
          volumeChangePercent,
        } as VolumeChangeEvent);
      }

      this.volumeCache.set(market.id, currentVolume);
    }

    await this.marketService.upsert(marketInput);

    // Sync outcomes
    const outcomeResult = await this.syncOutcomesForMarket(market);
    stats.outcomesCreated += outcomeResult.created;
    stats.outcomesUpdated += outcomeResult.updated;

    return { isNew };
  }

  private async syncOutcomesForMarket(
    market: GammaMarket
  ): Promise<{ created: number; updated: number }> {
    const result = { created: 0, updated: 0 };

    try {
      const outcomeNames = this.parseJsonArray(market.outcomes, ["Yes", "No"]);
      const tokenIds = this.parseJsonArray(market.clobTokenIds, []);
      const prices = this.parseJsonArray(market.outcomePrices, []);

      if (tokenIds.length === 0) return result;

      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        if (!tokenId || String(tokenId).length < 10) continue;

        const name = outcomeNames[i] || (i === 0 ? "Yes" : "No");
        const price = prices[i] ? parseFloat(String(prices[i])) : 0;

        const existing = await this.prisma.outcome.findFirst({
          where: { marketId: market.id, clobTokenId: tokenId },
        });

        if (existing) {
          await this.prisma.outcome.update({
            where: { id: existing.id },
            data: { name, price, probability: price * 100 },
          });
          result.updated++;
        } else {
          await this.prisma.outcome.create({
            data: {
              marketId: market.id,
              name,
              clobTokenId: tokenId,
              price,
              probability: price * 100,
              displayOrder: i,
            },
          });
          result.created++;
        }
      }
    } catch (error) {
      this.logger("Failed to sync outcomes", { marketId: market.id });
    }

    return result;
  }

  private parseJsonArray(value: unknown, defaultValue: string[]): string[] {
    if (!value) return defaultValue;
    if (Array.isArray(value)) return value.map(v => String(v));
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(v => String(v));
      } catch {}
    }
    return defaultValue;
  }

  private createEmptyStats(): SyncStats {
    return {
      totalSynced: 0,
      newMarkets: 0,
      updatedMarkets: 0,
      skippedMarkets: 0,
      volumeChanges: 0,
      closedMarkets: 0,
      outcomesCreated: 0,
      outcomesUpdated: 0,
      durationMs: 0,
      syncedAt: new Date().toISOString(),
      errors: [],
    };
  }
}

export const marketSyncService = new MarketSyncService();

export function createMarketSyncService(config?: MarketSyncConfig): MarketSyncService {
  return new MarketSyncService(config);
}