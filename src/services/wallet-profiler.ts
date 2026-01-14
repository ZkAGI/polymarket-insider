/**
 * Wallet Profiler Service (API-LIVE-003)
 *
 * Background service that profiles wallets as trades come in.
 * Listens for trade events and updates wallet profiles with suspicion scores.
 *
 * Features:
 * - Listen for 'trade:processed' events from TradeStreamService
 * - Check if wallet exists in database
 * - Fetch on-chain data for new wallets (age, tx count, funding source)
 * - Use detection modules to calculate suspicion score
 * - Store/update wallet profile in database
 * - Emit 'wallet:profiled' events for new/updated wallets
 * - Cache recent profiles to avoid redundant lookups
 */

import { EventEmitter } from "events";
import type { PrismaClient, Wallet } from "@prisma/client";
import { RiskLevel } from "@prisma/client";
import {
  TradeStreamService,
  type TradeProcessedEvent,
  type NewWalletEvent,
} from "./trade-stream";
import {
  WalletService,
  walletService as defaultWalletService,
} from "../db/wallets";
// Detection modules
import {
  getSharedWalletAgeCalculator,
  type WalletAgeCalculator,
  type WalletAgeResult,
} from "../detection/wallet-age";
import {
  getSharedFreshWalletConfidenceScorer,
  type FreshWalletConfidenceScorer,
  type FreshWalletConfidenceResult,
  ConfidenceLevel,
} from "../detection/fresh-wallet-confidence";
import {
  getSharedWalletBehaviorProfiler,
  type WalletBehaviorProfiler,
  type WalletBehaviorProfile,
  type ProfileTrade,
} from "../detection/wallet-behavior-profiler";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the Wallet Profiler Service
 */
export interface WalletProfilerServiceConfig {
  /** TradeStreamService to listen to */
  tradeStreamService?: TradeStreamService;

  /** Custom WalletService */
  walletService?: WalletService;

  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Custom wallet age calculator */
  ageCalculator?: WalletAgeCalculator;

  /** Custom fresh wallet confidence scorer */
  confidenceScorer?: FreshWalletConfidenceScorer;

  /** Custom wallet behavior profiler */
  behaviorProfiler?: WalletBehaviorProfiler;

  /** Enable emitting events */
  enableEvents?: boolean;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;

  /** Maximum cache size (default: 1000) */
  maxCacheSize?: number;

  /** Minimum trades required to build behavior profile */
  minTradesForProfile?: number;

  /** Whether to fetch on-chain data for new wallets */
  fetchOnChainData?: boolean;

  /** Suspicion score threshold to flag wallet */
  suspicionThreshold?: number;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Wallet profile event emitted when a wallet is profiled
 */
export interface WalletProfiledEvent {
  type: "wallet:profiled";
  walletId: string;
  address: string;
  suspicionScore: number;
  riskLevel: RiskLevel;
  isFresh: boolean;
  isNew: boolean;
  confidenceLevel: ConfidenceLevel | null;
  profilingTimeMs: number;
  timestamp: Date;
}

/**
 * Error event emitted when profiling fails
 */
export interface ProfileErrorEvent {
  type: "profile:error";
  address: string;
  walletId?: string;
  error: Error;
  message: string;
}

/**
 * Statistics for the profiler service
 */
export interface WalletProfilerStats {
  /** Total wallets profiled */
  totalProfiled: number;

  /** New wallets profiled */
  newWalletsProfiled: number;

  /** Existing wallets updated */
  existingWalletsUpdated: number;

  /** High suspicion wallets detected */
  highSuspicionCount: number;

  /** Fresh wallets detected */
  freshWalletsCount: number;

  /** Cache hits */
  cacheHits: number;

  /** Cache misses */
  cacheMisses: number;

  /** Errors encountered */
  errorCount: number;

  /** Service start time */
  startedAt: Date | null;

  /** Last profile time */
  lastProfiledAt: Date | null;

  /** Average profiling time in ms */
  avgProfilingTimeMs: number;
}

/**
 * Cached profile entry
 */
interface CachedProfile {
  walletId: string;
  address: string;
  suspicionScore: number;
  riskLevel: RiskLevel;
  isFresh: boolean;
  lastProfiledAt: Date;
  expiresAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default cache TTL: 5 minutes */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache size */
const DEFAULT_MAX_CACHE_SIZE = 1000;

/** Default minimum trades for behavior profile */
const DEFAULT_MIN_TRADES_FOR_PROFILE = 5;

/** Default suspicion threshold to flag wallet */
const DEFAULT_SUSPICION_THRESHOLD = 60;

// ============================================================================
// WalletProfilerService Class
// ============================================================================

/**
 * Wallet Profiler Service
 *
 * Profiles wallets in real-time as trades come in.
 */
export class WalletProfilerService extends EventEmitter {
  private config: {
    enableEvents: boolean;
    cacheTtlMs: number;
    maxCacheSize: number;
    minTradesForProfile: number;
    fetchOnChainData: boolean;
    suspicionThreshold: number;
  };

  private readonly tradeStreamService: TradeStreamService | null;
  private readonly walletService: WalletService;
  private readonly ageCalculator: WalletAgeCalculator;
  private readonly confidenceScorer: FreshWalletConfidenceScorer;
  private readonly behaviorProfiler: WalletBehaviorProfiler;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private isRunning = false;
  private cache: Map<string, CachedProfile> = new Map();
  private stats: WalletProfilerStats = {
    totalProfiled: 0,
    newWalletsProfiled: 0,
    existingWalletsUpdated: 0,
    highSuspicionCount: 0,
    freshWalletsCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    startedAt: null,
    lastProfiledAt: null,
    avgProfilingTimeMs: 0,
  };

  private profilingTimes: number[] = [];
  private readonly MAX_PROFILING_TIMES = 100;

  // Event listener cleanup
  private tradeProcessedHandler?: (event: TradeProcessedEvent) => void;
  private newWalletHandler?: (event: NewWalletEvent) => void;

  constructor(config: WalletProfilerServiceConfig = {}) {
    super();

    this.config = {
      enableEvents: config.enableEvents ?? true,
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      minTradesForProfile: config.minTradesForProfile ?? DEFAULT_MIN_TRADES_FOR_PROFILE,
      fetchOnChainData: config.fetchOnChainData ?? true,
      suspicionThreshold: config.suspicionThreshold ?? DEFAULT_SUSPICION_THRESHOLD,
    };

    this.tradeStreamService = config.tradeStreamService ?? null;
    this.walletService = config.walletService ?? defaultWalletService;
    this.ageCalculator = config.ageCalculator ?? getSharedWalletAgeCalculator();
    this.confidenceScorer = config.confidenceScorer ?? getSharedFreshWalletConfidenceScorer();
    this.behaviorProfiler = config.behaviorProfiler ?? getSharedWalletBehaviorProfiler();
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [WalletProfilerService] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [WalletProfilerService] ${message}`);
    }
  }

  /**
   * Start the wallet profiler service.
   *
   * If tradeStreamService is provided, it will listen for trade events.
   */
  start(): void {
    if (this.isRunning) {
      this.logger("Service already running");
      return;
    }

    this.logger("Starting wallet profiler service", {
      cacheTtlMs: this.config.cacheTtlMs,
      suspicionThreshold: this.config.suspicionThreshold,
      fetchOnChainData: this.config.fetchOnChainData,
    });

    this.isRunning = true;
    this.stats.startedAt = new Date();

    // Set up event listeners if tradeStreamService is provided
    if (this.tradeStreamService) {
      this.setupEventListeners();
      this.logger("Listening for trade stream events");
    }

    this.emit("started");
  }

  /**
   * Stop the wallet profiler service.
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger("Service not running");
      return;
    }

    this.logger("Stopping wallet profiler service");

    // Clean up event listeners
    if (this.tradeStreamService && this.tradeProcessedHandler) {
      this.tradeStreamService.off("trade:processed", this.tradeProcessedHandler);
      this.tradeProcessedHandler = undefined;
    }
    if (this.tradeStreamService && this.newWalletHandler) {
      this.tradeStreamService.off("wallet:new", this.newWalletHandler);
      this.newWalletHandler = undefined;
    }

    this.isRunning = false;
    this.emit("stopped");
    this.logger("Service stopped");
  }

  /**
   * Check if the service is running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current statistics.
   */
  getStats(): WalletProfilerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalProfiled: 0,
      newWalletsProfiled: 0,
      existingWalletsUpdated: 0,
      highSuspicionCount: 0,
      freshWalletsCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      startedAt: this.isRunning ? new Date() : null,
      lastProfiledAt: null,
      avgProfilingTimeMs: 0,
    };
    this.profilingTimes = [];
    this.logger("Statistics reset");
  }

  /**
   * Clear the profile cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.logger("Cache cleared");
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number; hitRate: number } {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      ttlMs: this.config.cacheTtlMs,
      hitRate,
    };
  }

  /**
   * Profile a wallet by address.
   *
   * This is the main entry point for profiling a wallet.
   * It will fetch on-chain data, calculate suspicion score, and update the database.
   *
   * @param address - Wallet address to profile
   * @param options - Optional profiling options
   * @returns Profile result or null if failed
   */
  async profileWallet(
    address: string,
    options: {
      walletId?: string;
      isNew?: boolean;
      bypassCache?: boolean;
      tradeEvent?: TradeProcessedEvent;
    } = {}
  ): Promise<WalletProfiledEvent | null> {
    const startTime = Date.now();
    const normalizedAddress = address.toLowerCase();

    try {
      // Check cache first
      if (!options.bypassCache) {
        const cached = this.getCachedProfile(normalizedAddress);
        if (cached) {
          this.stats.cacheHits++;
          return {
            type: "wallet:profiled",
            walletId: cached.walletId,
            address: cached.address,
            suspicionScore: cached.suspicionScore,
            riskLevel: cached.riskLevel,
            isFresh: cached.isFresh,
            isNew: false,
            confidenceLevel: null,
            profilingTimeMs: Date.now() - startTime,
            timestamp: new Date(),
          };
        }
        this.stats.cacheMisses++;
      }

      // Get or create wallet from database
      let wallet: Wallet;
      let isNew = options.isNew ?? false;

      if (options.walletId) {
        const existingWallet = await this.walletService.findById(options.walletId);
        if (!existingWallet) {
          throw new Error(`Wallet not found: ${options.walletId}`);
        }
        wallet = existingWallet;
      } else {
        const result = await this.walletService.findOrCreate(normalizedAddress);
        wallet = result.wallet;
        isNew = result.created;
      }

      // Fetch on-chain data for new wallets
      let ageResult: WalletAgeResult | null = null;
      if (this.config.fetchOnChainData && isNew) {
        try {
          ageResult = await this.ageCalculator.calculateAge(normalizedAddress);

          // Update wallet with on-chain data
          if (ageResult) {
            await this.walletService.updateOnChainData(wallet.id, {
              walletCreatedAt: ageResult.firstTransactionDate ?? undefined,
              walletAgeDays: ageResult.ageInDays ?? undefined,
            });
          }
        } catch (error) {
          this.logger("Failed to fetch on-chain data", {
            address: normalizedAddress,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Calculate fresh wallet confidence score
      let confidenceResult: FreshWalletConfidenceResult | null = null;
      try {
        confidenceResult = await this.confidenceScorer.scoreWallet(normalizedAddress);
      } catch (error) {
        this.logger("Failed to calculate confidence score", {
          address: normalizedAddress,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Determine suspicion score
      let suspicionScore = wallet.suspicionScore;
      let confidenceLevel: ConfidenceLevel | null = null;

      if (confidenceResult) {
        suspicionScore = confidenceResult.confidenceScore;
        confidenceLevel = confidenceResult.confidenceLevel;
      }

      // Determine risk level based on suspicion score
      const riskLevel = this.getRiskLevel(suspicionScore);

      // Determine if wallet is fresh
      const isFresh = confidenceResult?.isSuspicious ??
        (ageResult?.isFresh ?? false);

      // Update wallet in database
      const updatedWallet = await this.walletService.update(wallet.id, {
        suspicionScore,
        riskLevel,
        isFresh,
        isFlagged: suspicionScore >= this.config.suspicionThreshold,
        lastSyncedAt: new Date(),
      });

      // Update cache
      this.setCachedProfile({
        walletId: updatedWallet.id,
        address: normalizedAddress,
        suspicionScore,
        riskLevel,
        isFresh,
        lastProfiledAt: new Date(),
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });

      // Update statistics
      this.stats.totalProfiled++;
      if (isNew) {
        this.stats.newWalletsProfiled++;
      } else {
        this.stats.existingWalletsUpdated++;
      }
      if (suspicionScore >= this.config.suspicionThreshold) {
        this.stats.highSuspicionCount++;
      }
      if (isFresh) {
        this.stats.freshWalletsCount++;
      }
      this.stats.lastProfiledAt = new Date();
      this.updateAvgProfilingTime(Date.now() - startTime);

      // Create profile event
      const profileEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId: updatedWallet.id,
        address: normalizedAddress,
        suspicionScore,
        riskLevel,
        isFresh,
        isNew,
        confidenceLevel,
        profilingTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };

      // Emit event if enabled
      if (this.config.enableEvents) {
        this.emit("wallet:profiled", profileEvent);
      }

      return profileEvent;
    } catch (error) {
      this.stats.errorCount++;

      const err = error instanceof Error ? error : new Error(String(error));
      this.logger("Profiling error", {
        address: normalizedAddress,
        error: err.message,
      });

      if (this.config.enableEvents) {
        this.emit("profile:error", {
          type: "profile:error",
          address: normalizedAddress,
          walletId: options.walletId,
          error: err,
          message: err.message,
        } as ProfileErrorEvent);
      }

      return null;
    }
  }

  /**
   * Profile multiple wallets.
   *
   * @param addresses - Array of wallet addresses to profile
   * @returns Array of profile results
   */
  async profileWallets(addresses: string[]): Promise<(WalletProfiledEvent | null)[]> {
    const results: (WalletProfiledEvent | null)[] = [];

    for (const address of addresses) {
      const result = await this.profileWallet(address);
      results.push(result);
    }

    return results;
  }

  /**
   * Update wallet behavior profile with new trades.
   *
   * @param address - Wallet address
   * @param trades - New trades to add to the profile
   */
  async updateBehaviorProfile(
    address: string,
    trades: ProfileTrade[]
  ): Promise<WalletBehaviorProfile | null> {
    const normalizedAddress = address.toLowerCase();

    try {
      // Get existing profile or build new one
      const existingProfile = this.behaviorProfiler.getProfile(normalizedAddress);

      if (existingProfile) {
        // Update with new trades
        return this.behaviorProfiler.updateProfile(normalizedAddress, {
          newTrades: trades,
          fullRebuild: false,
        });
      } else if (trades.length >= this.config.minTradesForProfile) {
        // Build new profile
        return this.behaviorProfiler.buildProfile(normalizedAddress, {
          trades,
          includeTradeIds: true,
        });
      }

      return null;
    } catch (error) {
      this.logger("Failed to update behavior profile", {
        address: normalizedAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get a wallet's behavior profile.
   *
   * @param address - Wallet address
   * @returns Behavior profile or null
   */
  getBehaviorProfile(address: string): WalletBehaviorProfile | null {
    return this.behaviorProfiler.getProfile(address.toLowerCase());
  }

  /**
   * Get all high suspicion wallets from cache.
   *
   * @param threshold - Suspicion score threshold (default: config.suspicionThreshold)
   * @returns Array of high suspicion wallet profiles
   */
  getHighSuspicionWalletsFromCache(
    threshold?: number
  ): CachedProfile[] {
    const effectiveThreshold = threshold ?? this.config.suspicionThreshold;
    const result: CachedProfile[] = [];
    const now = Date.now();

    for (const [, profile] of this.cache) {
      if (profile.expiresAt > now && profile.suspicionScore >= effectiveThreshold) {
        result.push(profile);
      }
    }

    return result.sort((a, b) => b.suspicionScore - a.suspicionScore);
  }

  /**
   * Update configuration.
   *
   * @param config - Partial configuration to update
   */
  updateConfig(
    config: Partial<Pick<
      WalletProfilerServiceConfig,
      "enableEvents" | "cacheTtlMs" | "suspicionThreshold" | "fetchOnChainData" | "minTradesForProfile"
    >>
  ): void {
    if (config.enableEvents !== undefined) {
      this.config.enableEvents = config.enableEvents;
    }
    if (config.cacheTtlMs !== undefined) {
      this.config.cacheTtlMs = config.cacheTtlMs;
    }
    if (config.suspicionThreshold !== undefined) {
      this.config.suspicionThreshold = config.suspicionThreshold;
    }
    if (config.fetchOnChainData !== undefined) {
      this.config.fetchOnChainData = config.fetchOnChainData;
    }
    if (config.minTradesForProfile !== undefined) {
      this.config.minTradesForProfile = config.minTradesForProfile;
    }

    this.logger("Config updated", {
      enableEvents: this.config.enableEvents,
      cacheTtlMs: this.config.cacheTtlMs,
      suspicionThreshold: this.config.suspicionThreshold,
      fetchOnChainData: this.config.fetchOnChainData,
      minTradesForProfile: this.config.minTradesForProfile,
    });
  }

  /**
   * Dispose of the service and clean up resources.
   */
  dispose(): void {
    this.stop();
    this.cache.clear();
    this.removeAllListeners();
    this.logger("Service disposed");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up event listeners for the trade stream.
   */
  private setupEventListeners(): void {
    if (!this.tradeStreamService) {
      return;
    }

    // Handle processed trades
    this.tradeProcessedHandler = (event: TradeProcessedEvent) => {
      this.handleTradeProcessed(event).catch((error) => {
        this.logger("Error handling trade processed event", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };
    this.tradeStreamService.on("trade:processed", this.tradeProcessedHandler);

    // Handle new wallets
    this.newWalletHandler = (event: NewWalletEvent) => {
      this.handleNewWallet(event).catch((error) => {
        this.logger("Error handling new wallet event", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };
    this.tradeStreamService.on("wallet:new", this.newWalletHandler);
  }

  /**
   * Handle a trade processed event.
   */
  private async handleTradeProcessed(event: TradeProcessedEvent): Promise<void> {
    // Profile the wallet that made the trade
    await this.profileWallet(event.walletId, {
      walletId: event.walletId,
      isNew: false,
      tradeEvent: event,
    });
  }

  /**
   * Handle a new wallet event.
   */
  private async handleNewWallet(event: NewWalletEvent): Promise<void> {
    // Profile the new wallet
    await this.profileWallet(event.address, {
      walletId: event.walletId,
      isNew: true,
    });
  }

  /**
   * Get cached profile if valid.
   */
  private getCachedProfile(address: string): CachedProfile | null {
    const cached = this.cache.get(address);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(address);
      return null;
    }

    return cached;
  }

  /**
   * Set cached profile.
   */
  private setCachedProfile(profile: CachedProfile): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, cached] of this.cache) {
        if (cached.expiresAt < oldestTime) {
          oldestTime = cached.expiresAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(profile.address, profile);
  }

  /**
   * Get risk level from suspicion score.
   */
  private getRiskLevel(suspicionScore: number): RiskLevel {
    if (suspicionScore >= 80) {
      return RiskLevel.CRITICAL;
    }
    if (suspicionScore >= 60) {
      return RiskLevel.HIGH;
    }
    if (suspicionScore >= 40) {
      return RiskLevel.MEDIUM;
    }
    if (suspicionScore >= 20) {
      return RiskLevel.LOW;
    }
    return RiskLevel.NONE;
  }

  /**
   * Update average profiling time.
   */
  private updateAvgProfilingTime(timeMs: number): void {
    this.profilingTimes.push(timeMs);

    // Keep only last N times
    if (this.profilingTimes.length > this.MAX_PROFILING_TIMES) {
      this.profilingTimes.shift();
    }

    // Calculate average
    const sum = this.profilingTimes.reduce((a, b) => a + b, 0);
    this.stats.avgProfilingTimeMs = Math.round(sum / this.profilingTimes.length);
  }
}

// ============================================================================
// Singleton and Factory
// ============================================================================

/**
 * Default wallet profiler service instance.
 */
export const walletProfilerService = new WalletProfilerService();

/**
 * Create a new wallet profiler service instance with custom configuration.
 */
export function createWalletProfilerService(
  config: WalletProfilerServiceConfig = {}
): WalletProfilerService {
  return new WalletProfilerService(config);
}
