// /**
//  * Market Sync Background Service (Production - Filtered)
//  *
//  * Syncs ONLY active, relevant markets for insider/whale detection.
//  * Categories: Politics, Crypto, Finance, Tech, Science, Sports, Entertainment
//  * 
//  * This prevents database bloat from old/inactive markets.
//  */

// import { EventEmitter } from "events";
// import { PrismaClient } from "@prisma/client";
// import { prisma as defaultPrisma } from "../db/client";
// import {
//   MarketService,
//   marketService as defaultMarketService,
//   CreateMarketInput,
// } from "../db/markets";

// /**
//  * Allowed categories for insider detection
//  */
// const ALLOWED_CATEGORIES = [
//   "politics",
//   "political",
//   "elections",
//   "crypto",
//   "cryptocurrency",
//   "finance",
//   "economics",
//   "tech",
//   "technology",
//   "science",
//   "health",
//   "sports",
//   "entertainment",
//   "business",
//   "energy",
//   "war",
//   "geopolitics",
//   "world",
//   "us-politics",
//   "us-elections",
// ];

// /**
//  * Configuration for the Market Sync Service
//  */
// export interface MarketSyncConfig {
//   syncIntervalMs?: number;
//   enableEvents?: boolean;
//   volumeChangeThreshold?: number;
//   marketService?: MarketService;
//   prisma?: PrismaClient;
//   logger?: (message: string, data?: Record<string, unknown>) => void;
//   /** Max markets to sync (default: 2000) */
//   maxMarkets?: number;
//   /** Only sync markets with volume above this (default: 1000) */
//   minVolume?: number;
// }

// export interface SyncStats {
//   totalSynced: number;
//   newMarkets: number;
//   updatedMarkets: number;
//   skippedMarkets: number;
//   volumeChanges: number;
//   closedMarkets: number;
//   outcomesCreated: number;
//   outcomesUpdated: number;
//   durationMs: number;
//   syncedAt: string;
//   errors: string[];
// }

// export interface VolumeChangeEvent {
//   marketId: string;
//   slug: string;
//   question: string;
//   previousVolume: number;
//   currentVolume: number;
//   volumeChange: number;
//   volumeChangePercent: number;
// }

// interface GammaMarket {
//   id: string;
//   question: string;
//   slug?: string;
//   description?: string;
//   category?: string;
//   subcategory?: string;
//   image?: string;
//   icon?: string;
//   endDate?: string;
//   active?: boolean;
//   closed?: boolean;
//   archived?: boolean;
//   volume?: string | number;
//   volume24hr?: string | number;
//   liquidity?: string | number;
//   outcomes?: string | string[];
//   outcomePrices?: string | string[];
//   clobTokenIds?: string | string[];
// }

// export class MarketSyncService extends EventEmitter {
//   private config: {
//     syncIntervalMs: number;
//     enableEvents: boolean;
//     volumeChangeThreshold: number;
//     maxMarkets: number;
//     minVolume: number;
//   };
//   private readonly marketService: MarketService;
//   private readonly prisma: PrismaClient;
//   private readonly logger: (message: string, data?: Record<string, unknown>) => void;
  
//   private syncInterval: ReturnType<typeof setInterval> | null = null;
//   private isRunning = false;
//   private isSyncing = false;
//   private lastSyncStats: SyncStats | null = null;
//   private volumeCache: Map<string, number> = new Map();

//   private readonly GAMMA_API = "https://gamma-api.polymarket.com";

//   constructor(config: MarketSyncConfig = {}) {
//     super();
//     this.config = {
//       syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000,
//       enableEvents: config.enableEvents ?? true,
//       volumeChangeThreshold: config.volumeChangeThreshold ?? 5,
//       maxMarkets: config.maxMarkets ?? 2000,
//       minVolume: config.minVolume ?? 1000,
//     };
//     this.marketService = config.marketService ?? defaultMarketService;
//     this.prisma = config.prisma ?? defaultPrisma;
//     this.logger = config.logger ?? this.defaultLogger.bind(this);
//   }

//   private defaultLogger(message: string, data?: Record<string, unknown>): void {
//     const timestamp = new Date().toISOString();
//     if (data) {
//       console.log(`[${timestamp}] [MarketSync] ${message}`, data);
//     } else {
//       console.log(`[${timestamp}] [MarketSync] ${message}`);
//     }
//   }

//   async start(): Promise<void> {
//     if (this.isRunning) {
//       this.logger("Service already running");
//       return;
//     }

//     this.logger("Starting market sync service", {
//       intervalMs: this.config.syncIntervalMs,
//       maxMarkets: this.config.maxMarkets,
//       minVolume: this.config.minVolume,
//     });

//     this.isRunning = true;
//     this.emit("started");

//     try {
//       await this.sync();
//     } catch (error) {
//       this.logger("Initial sync failed", {
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }

//     this.syncInterval = setInterval(async () => {
//       try {
//         await this.sync();
//       } catch (error) {
//         this.logger("Scheduled sync failed", {
//           error: error instanceof Error ? error.message : String(error),
//         });
//       }
//     }, this.config.syncIntervalMs);

//     this.logger("Service started");
//   }

//   stop(): void {
//     if (!this.isRunning) return;
//     this.logger("Stopping market sync service");
//     if (this.syncInterval) {
//       clearInterval(this.syncInterval);
//       this.syncInterval = null;
//     }
//     this.isRunning = false;
//     this.emit("stopped");
//     this.logger("Service stopped");
//   }

//   getIsRunning(): boolean {
//     return this.isRunning;
//   }

//   getLastSyncStats(): SyncStats | null {
//     return this.lastSyncStats;
//   }

//   /**
//    * Check if a market should be synced based on category and volume
//    */
//   private shouldSyncMarket(market: GammaMarket): boolean {
//     // Must be active and not closed/archived
//     if (market.closed || market.archived || market.active === false) {
//       return false;
//     }

//     // Check volume threshold
//     const volume = parseFloat(String(market.volume || 0)) || 0;
//     if (volume < this.config.minVolume) {
//       return false;
//     }

//     // Check category
//     const category = (market.category || "").toLowerCase();
//     const question = (market.question || "").toLowerCase();
    
//     // Allow if category matches
//     for (const allowed of ALLOWED_CATEGORIES) {
//       if (category.includes(allowed)) {
//         return true;
//       }
//     }

//     // Also check question for keywords
//     const keywords = ["election", "president", "congress", "senate", "bitcoin", "ethereum", "fed", "trump", "biden", "war", "ukraine", "russia", "china", "israel", "iran"];
//     for (const keyword of keywords) {
//       if (question.includes(keyword)) {
//         return true;
//       }
//     }

//     // Default: allow high volume markets regardless of category
//     if (volume >= 100000) {
//       return true;
//     }

//     return false;
//   }

//   /**
//    * Main sync function - syncs filtered markets AND outcomes
//    */
//   async sync(): Promise<SyncStats> {
//     if (this.isSyncing) {
//       this.logger("Sync already in progress, skipping");
//       return this.lastSyncStats ?? this.createEmptyStats();
//     }

//     this.isSyncing = true;
//     const startTime = Date.now();
//     this.logger("Starting sync");

//     const stats: SyncStats = this.createEmptyStats();

//     try {
//       let offset = 0;
//       const limit = 100;
//       let hasMore = true;

//       while (hasMore && stats.totalSynced < this.config.maxMarkets) {
//         // Fetch only active markets, sorted by volume
//         const url = `${this.GAMMA_API}/markets?limit=${limit}&offset=${offset}&active=true&closed=false`;
        
//         const response = await fetch(url);
//         if (!response.ok) {
//           stats.errors.push(`API error: ${response.status}`);
//           break;
//         }

//         const markets: GammaMarket[] = await response.json();
        
//         if (!markets || markets.length === 0) {
//           hasMore = false;
//           break;
//         }

//         for (const market of markets) {
//           // Stop if we've reached max
//           if (stats.totalSynced >= this.config.maxMarkets) {
//             hasMore = false;
//             break;
//           }

//           // Filter markets
//           if (!this.shouldSyncMarket(market)) {
//             stats.skippedMarkets++;
//             continue;
//           }

//           try {
//             const result = await this.syncMarketWithOutcomes(market, stats);
//             if (result.isNew) {
//               stats.newMarkets++;
//             } else {
//               stats.updatedMarkets++;
//             }
//             stats.totalSynced++;
//           } catch (error) {
//             stats.errors.push(`Market ${market.id}: ${error instanceof Error ? error.message : String(error)}`);
//           }
//         }

//         offset += limit;
//         if (markets.length < limit) {
//           hasMore = false;
//         }
//       }
//     } catch (error) {
//       stats.errors.push(`Sync error: ${error instanceof Error ? error.message : String(error)}`);
//     }

//     stats.durationMs = Date.now() - startTime;
//     stats.syncedAt = new Date().toISOString();
    
//     this.lastSyncStats = stats;
//     this.isSyncing = false;

//     this.logger("Sync completed", {
//       totalSynced: stats.totalSynced,
//       newMarkets: stats.newMarkets,
//       updatedMarkets: stats.updatedMarkets,
//       skippedMarkets: stats.skippedMarkets,
//       outcomesCreated: stats.outcomesCreated,
//       outcomesUpdated: stats.outcomesUpdated,
//       durationMs: stats.durationMs,
//       errors: stats.errors.length,
//     });

//     this.emit("sync:completed", stats);
//     return stats;
//   }

//   private async syncMarketWithOutcomes(
//     market: GammaMarket,
//     stats: SyncStats
//   ): Promise<{ isNew: boolean }> {
//     const existing = await this.prisma.market.findUnique({
//       where: { id: market.id },
//     });

//     const isNew = !existing;

//     const marketInput: CreateMarketInput = {
//       id: market.id,
//       slug: market.slug || market.id,
//       question: market.question,
//       description: market.description,
//       category: market.category,
//       subcategory: market.subcategory,
//       imageUrl: market.image,
//       iconUrl: market.icon,
//       endDate: market.endDate ? new Date(market.endDate) : undefined,
//       active: market.active ?? true,
//       closed: market.closed ?? false,
//       archived: market.archived ?? false,
//       volume: parseFloat(String(market.volume || 0)) || 0,
//       volume24h: parseFloat(String(market.volume24hr || 0)) || 0,
//       liquidity: parseFloat(String(market.liquidity || 0)) || 0,
//     };

//     // Volume change detection
//     if (!isNew && this.config.enableEvents) {
//       const previousVolume = this.volumeCache.get(market.id) || 0;
//       const currentVolume = marketInput.volume || 0;
//       const volumeChange = currentVolume - previousVolume;
//       const volumeChangePercent = previousVolume > 0 
//         ? (volumeChange / previousVolume) * 100 
//         : 0;

//       if (Math.abs(volumeChangePercent) >= this.config.volumeChangeThreshold) {
//         stats.volumeChanges++;
//         this.emit("market:volumeChange", {
//           marketId: market.id,
//           slug: market.slug,
//           question: market.question,
//           previousVolume,
//           currentVolume,
//           volumeChange,
//           volumeChangePercent,
//         } as VolumeChangeEvent);
//       }

//       this.volumeCache.set(market.id, currentVolume);
//     }

//     await this.marketService.upsert(marketInput);

//     // Sync outcomes
//     const outcomeResult = await this.syncOutcomesForMarket(market);
//     stats.outcomesCreated += outcomeResult.created;
//     stats.outcomesUpdated += outcomeResult.updated;

//     return { isNew };
//   }

//   private async syncOutcomesForMarket(
//     market: GammaMarket
//   ): Promise<{ created: number; updated: number }> {
//     const result = { created: 0, updated: 0 };

//     try {
//       const outcomeNames = this.parseJsonArray(market.outcomes, ["Yes", "No"]);
//       const tokenIds = this.parseJsonArray(market.clobTokenIds, []);
//       const prices = this.parseJsonArray(market.outcomePrices, []);

//       if (tokenIds.length === 0) return result;

//       for (let i = 0; i < tokenIds.length; i++) {
//         const tokenId = tokenIds[i];
//         if (!tokenId || String(tokenId).length < 10) continue;

//         const name = outcomeNames[i] || (i === 0 ? "Yes" : "No");
//         const price = prices[i] ? parseFloat(String(prices[i])) : 0;

//         const existing = await this.prisma.outcome.findFirst({
//           where: { marketId: market.id, clobTokenId: tokenId },
//         });

//         if (existing) {
//           await this.prisma.outcome.update({
//             where: { id: existing.id },
//             data: { name, price, probability: price * 100 },
//           });
//           result.updated++;
//         } else {
//           await this.prisma.outcome.create({
//             data: {
//               marketId: market.id,
//               name,
//               clobTokenId: tokenId,
//               price,
//               probability: price * 100,
//               displayOrder: i,
//             },
//           });
//           result.created++;
//         }
//       }
//     } catch (error) {
//       this.logger("Failed to sync outcomes", { marketId: market.id });
//     }

//     return result;
//   }

//   private parseJsonArray(value: unknown, defaultValue: string[]): string[] {
//     if (!value) return defaultValue;
//     if (Array.isArray(value)) return value.map(v => String(v));
//     if (typeof value === "string") {
//       try {
//         const parsed = JSON.parse(value);
//         if (Array.isArray(parsed)) return parsed.map(v => String(v));
//       } catch {}
//     }
//     return defaultValue;
//   }

//   private createEmptyStats(): SyncStats {
//     return {
//       totalSynced: 0,
//       newMarkets: 0,
//       updatedMarkets: 0,
//       skippedMarkets: 0,
//       volumeChanges: 0,
//       closedMarkets: 0,
//       outcomesCreated: 0,
//       outcomesUpdated: 0,
//       durationMs: 0,
//       syncedAt: new Date().toISOString(),
//       errors: [],
//     };
//   }
// }

// export const marketSyncService = new MarketSyncService();

// export function createMarketSyncService(config?: MarketSyncConfig): MarketSyncService {
//   return new MarketSyncService(config);
// }

/**
 * Market Sync Background Service (Production - Active Markets Only)
 *
 * Syncs ONLY active, open markets with eventSlug for proper Polymarket URLs.
 * Filters out ended, closed, and archived markets.
 */

import { EventEmitter } from "events";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/client";

export interface MarketSyncConfig {
  syncIntervalMs?: number;
  enableEvents?: boolean;
  volumeChangeThreshold?: number;
  prisma?: PrismaClient;
  logger?: (message: string, data?: Record<string, unknown>) => void;
  maxMarkets?: number;
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
  private readonly prisma: PrismaClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;
  
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isSyncing = false;
  private lastSyncStats: SyncStats | null = null;
  private volumeCache: Map<string, number> = new Map();

  private readonly GAMMA_API = "https://gamma-api.polymarket.com";
  private readonly DATA_API = "https://data-api.polymarket.com";

  constructor(config: MarketSyncConfig = {}) {
    super();
    this.config = {
      syncIntervalMs: config.syncIntervalMs ?? 5 * 60 * 1000,
      enableEvents: config.enableEvents ?? true,
      volumeChangeThreshold: config.volumeChangeThreshold ?? 5,
      maxMarkets: config.maxMarkets ?? 5000,
      minVolume: config.minVolume ?? 100,
    };
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
   * Check if a market is currently active and open (not ended)
   */
  private isMarketActive(market: GammaMarket): boolean {
    // Must not be closed or archived
    if (market.closed || market.archived) {
      return false;
    }

    // Must be marked as active
    if (market.active === false) {
      return false;
    }

    // Check if end date has passed
    if (market.endDate) {
      const endDate = new Date(market.endDate);
      const now = new Date();
      if (endDate < now) {
        return false; // Market has ended
      }
    }

    // Check minimum volume
    const volume = parseFloat(String(market.volume || 0)) || 0;
    if (volume < this.config.minVolume) {
      return false;
    }

    return true;
  }

  /**
   * Fetch eventSlug from Data API for a market
   */
  private async fetchEventSlug(slug: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.DATA_API}/markets?slug=${slug}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data[0]?.eventSlug || null;
    } catch {
      return null;
    }
  }

  /**
   * Main sync function - syncs only active, open markets with eventSlug
   */
  async sync(): Promise<SyncStats> {
    if (this.isSyncing) {
      this.logger("Sync already in progress, skipping");
      return this.lastSyncStats ?? this.createEmptyStats();
    }

    this.isSyncing = true;
    const startTime = Date.now();
    this.logger("Starting sync - active markets only");

    const stats: SyncStats = this.createEmptyStats();

    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore && stats.totalSynced < this.config.maxMarkets) {
        // Fetch only active, non-closed markets
        const url = `${this.GAMMA_API}/markets?limit=${limit}&offset=${offset}&active=true&closed=false&archived=false`;
        
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
          if (stats.totalSynced >= this.config.maxMarkets) {
            hasMore = false;
            break;
          }

          // Only sync active, open markets
          if (!this.isMarketActive(market)) {
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

      // Clean up old/ended markets - mark them as inactive
      await this.markEndedMarketsInactive();

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

  /**
   * Mark markets with past end dates as inactive
   */
  private async markEndedMarketsInactive(): Promise<void> {
    try {
      const result = await this.prisma.market.updateMany({
        where: {
          active: true,
          endDate: { lt: new Date() },
        },
        data: { active: false },
      });
      
      if (result.count > 0) {
        this.logger(`Marked ${result.count} ended markets as inactive`);
      }
    } catch (error) {
      this.logger("Failed to mark ended markets inactive", { error: String(error) });
    }
  }

  private async syncMarketWithOutcomes(
    market: GammaMarket,
    stats: SyncStats
  ): Promise<{ isNew: boolean }> {
    const existing = await this.prisma.market.findUnique({
      where: { id: market.id },
    });

    const isNew = !existing;

    // Fetch eventSlug from Data API (Gamma API doesn't have it)
    let eventSlug = existing?.eventSlug || null;
    if (!eventSlug && market.slug) {
      eventSlug = await this.fetchEventSlug(market.slug);
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
    }

    const volume = parseFloat(String(market.volume || 0)) || 0;
    const volume24h = parseFloat(String(market.volume24hr || 0)) || 0;
    const liquidity = parseFloat(String(market.liquidity || 0)) || 0;

    // Volume change detection
    if (!isNew && this.config.enableEvents) {
      const previousVolume = this.volumeCache.get(market.id) || 0;
      const volumeChange = volume - previousVolume;
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
          currentVolume: volume,
          volumeChange,
          volumeChangePercent,
        } as VolumeChangeEvent);
      }

      this.volumeCache.set(market.id, volume);
    }

    // Upsert market with eventSlug
    if (isNew) {
      await this.prisma.market.create({
        data: {
          id: market.id,
          slug: market.slug || market.id,
          eventSlug: eventSlug,
          question: market.question,
          description: market.description || "",
          category: market.category,
          subcategory: market.subcategory,
          imageUrl: market.image,
          iconUrl: market.icon,
          endDate: market.endDate ? new Date(market.endDate) : null,
          active: true,
          closed: false,
          archived: false,
          volume,
          volume24h,
          liquidity,
          tradeCount: 0,
          uniqueTraders: 0,
        },
      });
    } else {
      await this.prisma.market.update({
        where: { id: market.id },
        data: {
          slug: market.slug || market.id,
          eventSlug: eventSlug || existing?.eventSlug,
          question: market.question,
          description: market.description || existing?.description,
          category: market.category || existing?.category,
          subcategory: market.subcategory || existing?.subcategory,
          imageUrl: market.image || existing?.imageUrl,
          iconUrl: market.icon || existing?.iconUrl,
          endDate: market.endDate ? new Date(market.endDate) : existing?.endDate,
          active: true,
          closed: false,
          archived: false,
          volume,
          volume24h,
          liquidity,
          lastSyncedAt: new Date(),
        },
      });
    }

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