/**
 * Continuous Polymarket Ingestion Worker (INGEST-CORE-001)
 *
 * Always-running background worker that continuously fetches Polymarket markets
 * and trades and writes normalized data to the database.
 *
 * Features:
 * - Runs continuously in an infinite loop with configurable sleep interval
 * - Graceful handling of network failures and retries
 * - Worker does not exit on single-cycle failure
 * - Restart-safe: can be stopped and started without data loss
 * - Tracks ingestion health and last successful sync times
 * - Emits events for downstream detection systems
 *
 * This worker is independent of API routes and UI. It must run
 * continuously in production and be restart-safe.
 */

import { EventEmitter } from "events";
import { PrismaClient, SyncStatus } from "@prisma/client";
import { createPrismaClient } from "../db/client";
import { MarketService, createMarketService } from "../db/markets";
import { TradeService, createTradeService } from "../db/trades";
import { WalletService, createWalletService } from "../db/wallets";
import { GammaClient, createGammaClient } from "../api/gamma";
import { ClobClient, createClobClient } from "../api/clob";

/**
 * Configuration for the ingestion worker
 */
export interface IngestionWorkerConfig {
  /** Interval between ingestion cycles in milliseconds (default: 60 seconds) */
  cycleIntervalMs?: number;

  /** Market sync interval in milliseconds (default: 5 minutes) */
  marketSyncIntervalMs?: number;

  /** Trade fetch interval in milliseconds (default: 30 seconds) */
  tradeFetchIntervalMs?: number;

  /** Maximum number of markets to fetch trades for per cycle (default: 50) */
  maxMarketsPerCycle?: number;

  /** Maximum trades to fetch per market (default: 100) */
  maxTradesPerMarket?: number;

  /** Retry delay base in milliseconds for exponential backoff (default: 1000) */
  retryDelayMs?: number;

  /** Maximum retry attempts per operation (default: 3) */
  maxRetries?: number;

  /** Worker ID for identification (default: auto-generated) */
  workerId?: string;

  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Custom Gamma client */
  gammaClient?: GammaClient;

  /** Custom CLOB client */
  clobClient?: ClobClient;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Ingestion health status
 */
export interface IngestionHealth {
  /** Whether the worker is currently running */
  isRunning: boolean;

  /** Whether the worker is currently in a cycle */
  isIngesting: boolean;

  /** Last successful market sync timestamp */
  lastMarketSyncAt: Date | null;

  /** Last successful trade ingestion timestamp */
  lastTradeIngestAt: Date | null;

  /** Total cycles completed */
  cyclesCompleted: number;

  /** Total cycles failed */
  cyclesFailed: number;

  /** Total markets synced */
  marketsSynced: number;

  /** Total trades ingested */
  tradesIngested: number;

  /** Total wallets created */
  walletsCreated: number;

  /** Current error count (resets on successful cycle) */
  consecutiveErrors: number;

  /** Last error message */
  lastError: string | null;

  /** Worker start time */
  startedAt: Date | null;

  /** Worker uptime in seconds */
  uptimeSeconds: number;
}

/**
 * Cycle result
 */
export interface CycleResult {
  /** Whether the cycle was successful */
  success: boolean;

  /** Markets synced in this cycle */
  marketsSynced: number;

  /** Trades ingested in this cycle */
  tradesIngested: number;

  /** Wallets created in this cycle */
  walletsCreated: number;

  /** Duration of cycle in milliseconds */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** Timestamp of cycle completion */
  completedAt: Date;
}

/**
 * Continuous Polymarket Ingestion Worker
 */
export class IngestionWorker extends EventEmitter {
  private readonly config: Required<
    Pick<
      IngestionWorkerConfig,
      | "cycleIntervalMs"
      | "marketSyncIntervalMs"
      | "tradeFetchIntervalMs"
      | "maxMarketsPerCycle"
      | "maxTradesPerMarket"
      | "retryDelayMs"
      | "maxRetries"
      | "workerId"
      | "debug"
    >
  >;
  private readonly prisma: PrismaClient;
  private readonly gammaClient: GammaClient;
  private readonly clobClient: ClobClient;
  private readonly marketService: MarketService;
  private readonly tradeService: TradeService;
  private readonly walletService: WalletService;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private isRunning = false;
  private isIngesting = false;
  private shouldStop = false;
  private cycleTimeout: ReturnType<typeof setTimeout> | null = null;

  private health: IngestionHealth = {
    isRunning: false,
    isIngesting: false,
    lastMarketSyncAt: null,
    lastTradeIngestAt: null,
    cyclesCompleted: 0,
    cyclesFailed: 0,
    marketsSynced: 0,
    tradesIngested: 0,
    walletsCreated: 0,
    consecutiveErrors: 0,
    lastError: null,
    startedAt: null,
    uptimeSeconds: 0,
  };

  private lastMarketSync = 0;
  private lastTradeFetch = 0;

  constructor(config: IngestionWorkerConfig = {}) {
    super();

    this.config = {
      cycleIntervalMs: config.cycleIntervalMs ?? 60 * 1000, // 1 minute
      marketSyncIntervalMs: config.marketSyncIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      tradeFetchIntervalMs: config.tradeFetchIntervalMs ?? 30 * 1000, // 30 seconds
      maxMarketsPerCycle: config.maxMarketsPerCycle ?? 50,
      maxTradesPerMarket: config.maxTradesPerMarket ?? 100,
      retryDelayMs: config.retryDelayMs ?? 1000,
      maxRetries: config.maxRetries ?? 3,
      workerId: config.workerId ?? `ingestion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      debug: config.debug ?? false,
    };

    // Initialize Prisma client inside worker (independent of app)
    this.prisma = config.prisma ?? createPrismaClient();
    this.gammaClient = config.gammaClient ?? createGammaClient();
    this.clobClient = config.clobClient ?? createClobClient();

    // Create service instances with the worker's prisma client
    this.marketService = createMarketService({ prisma: this.prisma });
    this.tradeService = createTradeService({ prisma: this.prisma });
    this.walletService = createWalletService({ prisma: this.prisma });

    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [IngestionWorker:${this.config.workerId.slice(-8)}]`;
    if (data && this.config.debug) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Start the ingestion worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger("Worker already running");
      return;
    }

    this.logger("Starting ingestion worker", {
      workerId: this.config.workerId,
      cycleIntervalMs: this.config.cycleIntervalMs,
      marketSyncIntervalMs: this.config.marketSyncIntervalMs,
      tradeFetchIntervalMs: this.config.tradeFetchIntervalMs,
    });

    this.isRunning = true;
    this.shouldStop = false;
    this.health.isRunning = true;
    this.health.startedAt = new Date();
    this.health.consecutiveErrors = 0;

    this.emit("started", { workerId: this.config.workerId });

    // Run the main loop
    await this.runLoop();
  }

  /**
   * Stop the ingestion worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger("Worker not running");
      return;
    }

    this.logger("Stopping ingestion worker...");
    this.shouldStop = true;

    // Clear any pending timeout
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }

    // Wait for current cycle to complete
    while (this.isIngesting) {
      await this.sleep(100);
    }

    this.isRunning = false;
    this.health.isRunning = false;

    // Disconnect Prisma
    await this.prisma.$disconnect();

    this.logger("Worker stopped");
    this.emit("stopped", { workerId: this.config.workerId });
  }

  /**
   * Main ingestion loop
   */
  private async runLoop(): Promise<void> {
    this.logger("Starting main ingestion loop");

    while (!this.shouldStop) {
      try {
        const result = await this.runCycle();

        if (result.success) {
          this.health.consecutiveErrors = 0;
          this.health.cyclesCompleted++;
          this.emit("cycle:complete", result);
        } else {
          this.health.consecutiveErrors++;
          this.health.cyclesFailed++;
          this.health.lastError = result.error ?? null;
          this.emit("cycle:error", result);
        }

        // Update uptime
        if (this.health.startedAt) {
          this.health.uptimeSeconds = Math.floor(
            (Date.now() - this.health.startedAt.getTime()) / 1000
          );
        }
      } catch (error) {
        // Catch any unexpected errors to prevent worker crash
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger("Unexpected error in cycle", { error: errorMessage });
        this.health.consecutiveErrors++;
        this.health.cyclesFailed++;
        this.health.lastError = errorMessage;
        this.emit("cycle:error", { error: errorMessage });
      }

      // Sleep before next cycle (unless stopping)
      if (!this.shouldStop) {
        await this.sleepWithTimeout(this.config.cycleIntervalMs);
      }
    }

    this.logger("Main loop exited");
  }

  /**
   * Run a single ingestion cycle
   */
  private async runCycle(): Promise<CycleResult> {
    const startTime = Date.now();
    this.isIngesting = true;
    this.health.isIngesting = true;

    const result: CycleResult = {
      success: false,
      marketsSynced: 0,
      tradesIngested: 0,
      walletsCreated: 0,
      durationMs: 0,
      completedAt: new Date(),
    };

    try {
      this.logger("Starting ingestion cycle");

      // Record sync start
      const syncLog = await this.recordSyncStart();

      // 1. Sync markets (if interval elapsed)
      const now = Date.now();
      if (now - this.lastMarketSync >= this.config.marketSyncIntervalMs) {
        const marketResult = await this.syncMarkets();
        result.marketsSynced = marketResult.synced;
        this.health.marketsSynced += marketResult.synced;
        this.lastMarketSync = now;
        this.health.lastMarketSyncAt = new Date();
      }

      // 2. Fetch and ingest trades (if interval elapsed)
      if (now - this.lastTradeFetch >= this.config.tradeFetchIntervalMs) {
        const tradeResult = await this.ingestTrades();
        result.tradesIngested = tradeResult.ingested;
        result.walletsCreated = tradeResult.walletsCreated;
        this.health.tradesIngested += tradeResult.ingested;
        this.health.walletsCreated += tradeResult.walletsCreated;
        this.lastTradeFetch = now;
        this.health.lastTradeIngestAt = new Date();
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      // Record sync completion
      await this.recordSyncComplete(syncLog.id, result);

      this.logger("Ingestion cycle completed", {
        marketsSynced: result.marketsSynced,
        tradesIngested: result.tradesIngested,
        walletsCreated: result.walletsCreated,
        durationMs: result.durationMs,
      });
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger("Ingestion cycle failed", { error: result.error });
    } finally {
      this.isIngesting = false;
      this.health.isIngesting = false;
    }

    return result;
  }

  /**
   * Sync markets from Polymarket Gamma API
   */
  private async syncMarkets(): Promise<{ synced: number; errors: number }> {
    this.logger("Syncing markets from Gamma API");

    let synced = 0;
    let errors = 0;

    try {
      // Fetch active markets from Gamma API
      const markets = await this.retryOperation(async () => {
        const response = await this.gammaClient.get<GammaMarketResponse[]>("/markets?active=true&limit=500");
        return response;
      });

      this.logger(`Fetched ${markets.length} markets from API`);

      // Process each market
      for (const market of markets) {
        const marketId = market.id || market.conditionId;
        if (!marketId) {
          errors++;
          continue;
        }

        try {
          await this.marketService.upsert({
            id: marketId,
            slug: market.slug,
            question: market.question,
            description: market.description || undefined,
            category: market.category || undefined,
            imageUrl: market.image || undefined,
            endDate: market.endDate ? new Date(market.endDate) : undefined,
            active: market.active ?? true,
            closed: market.closed ?? false,
            archived: market.archived ?? false,
            volume: market.volume ?? market.volumeNum ?? 0,
            liquidity: market.liquidity ?? 0,
          });
          synced++;
        } catch (error) {
          errors++;
          if (this.config.debug) {
            this.logger("Failed to upsert market", {
              marketId: market.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.emit("markets:synced", { synced, errors, total: markets.length });
    } catch (error) {
      this.logger("Failed to sync markets", {
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }

    return { synced, errors };
  }

  /**
   * Ingest trades from Polymarket CLOB API
   */
  private async ingestTrades(): Promise<{ ingested: number; walletsCreated: number; errors: number }> {
    this.logger("Ingesting trades from CLOB API");

    let ingested = 0;
    let walletsCreated = 0;
    let errors = 0;

    try {
      // Get active markets to fetch trades for
      const result = await this.marketService.findActive(
        { field: "volume", direction: "desc" },
        { take: this.config.maxMarketsPerCycle }
      );

      this.logger(`Fetching trades for ${result.markets.length} markets`);

      for (const market of result.markets) {
        if (this.shouldStop) break;

        try {
          // Get outcomes for this market
          const outcomes = await this.prisma.outcome.findMany({
            where: { marketId: market.id },
            select: { id: true, clobTokenId: true },
          });

          for (const outcome of outcomes) {
            if (!outcome.clobTokenId) continue;

            try {
              // Fetch trades for this token
              const trades = await this.retryOperation(async () => {
                const response = await this.clobClient.get<ClobTradeResponse[]>(
                  `/trades?token_id=${outcome.clobTokenId}&limit=${this.config.maxTradesPerMarket}`
                );
                return response;
              });

              for (const trade of trades) {
                try {
                  const result = await this.processTrade(trade, market.id, outcome.id);
                  if (result.ingested) ingested++;
                  if (result.walletCreated) walletsCreated++;
                } catch {
                  errors++;
                }
              }
            } catch {
              errors++;
            }
          }
        } catch {
          errors++;
        }
      }

      this.emit("trades:ingested", { ingested, walletsCreated, errors });
    } catch (error) {
      this.logger("Failed to ingest trades", {
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }

    return { ingested, walletsCreated, errors };
  }

  /**
   * Process a single trade
   */
  private async processTrade(
    trade: ClobTradeResponse,
    marketId: string,
    outcomeId: string
  ): Promise<{ ingested: boolean; walletCreated: boolean }> {
    // Determine wallet address
    const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
    if (!walletAddress) {
      return { ingested: false, walletCreated: false };
    }

    // Find or create wallet
    const { wallet, created: walletCreated } = await this.walletService.findOrCreate(
      walletAddress.toLowerCase()
    );

    // Generate a trade ID if not provided
    const tradeId = trade.id || `${marketId}-${outcomeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Check if trade already exists
    if (trade.id) {
      const existing = await this.tradeService.findByClobTradeId(trade.id);
      if (existing) {
        return { ingested: false, walletCreated };
      }
    }

    // Calculate USD value
    const amount = parseFloat(trade.size || trade.amount || "0");
    const price = parseFloat(trade.price || "0");
    const usdValue = amount * price;

    // Create trade
    await this.tradeService.create({
      marketId,
      outcomeId,
      walletId: wallet.id,
      clobTradeId: tradeId,
      matchId: trade.match_id,
      side: trade.side === "BUY" || trade.side === "buy" ? "BUY" : "SELL",
      amount,
      price,
      usdValue,
      feeUsd: parseFloat(trade.fee || "0"),
      makerAddress: trade.maker_address,
      takerAddress: trade.taker_address,
      isMaker: walletAddress.toLowerCase() === trade.maker_address?.toLowerCase(),
      timestamp: new Date(trade.timestamp || trade.created_at || Date.now()),
      txHash: trade.transaction_hash,
      isWhale: usdValue >= 10000, // $10k threshold
      isInsider: false,
      flags: [],
    });

    // Update wallet stats
    await this.walletService.incrementTradeStats(wallet.id, usdValue);

    return { ingested: true, walletCreated };
  }

  /**
   * Record sync start in database
   */
  private async recordSyncStart(): Promise<{ id: string }> {
    const log = await this.prisma.syncLog.create({
      data: {
        syncType: "INGESTION",
        entityType: "ALL",
        status: SyncStatus.RUNNING,
        startedAt: new Date(),
        metadata: {
          workerId: this.config.workerId,
        },
      },
    });
    return { id: log.id };
  }

  /**
   * Record sync completion in database
   */
  private async recordSyncComplete(syncLogId: string, result: CycleResult): Promise<void> {
    await this.prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: result.success ? SyncStatus.COMPLETED : SyncStatus.FAILED,
        completedAt: new Date(),
        durationMs: result.durationMs,
        recordsProcessed: result.marketsSynced + result.tradesIngested,
        recordsCreated: result.tradesIngested,
        errorCount: result.error ? 1 : 0,
        errors: result.error ? { message: result.error } : undefined,
      },
    });
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("Operation failed after all retries");
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sleep with ability to cancel on stop
   */
  private sleepWithTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.cycleTimeout = setTimeout(resolve, ms);
    });
  }

  /**
   * Get current health status
   */
  getHealth(): IngestionHealth {
    // Update uptime
    if (this.health.startedAt) {
      this.health.uptimeSeconds = Math.floor(
        (Date.now() - this.health.startedAt.getTime()) / 1000
      );
    }

    return { ...this.health };
  }

  /**
   * Get worker ID
   */
  getWorkerId(): string {
    return this.config.workerId;
  }

  /**
   * Check if worker is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if worker is currently ingesting
   */
  getIsIngesting(): boolean {
    return this.isIngesting;
  }

  /**
   * Force an immediate cycle (for testing)
   */
  async forceCycle(): Promise<CycleResult> {
    if (!this.isRunning) {
      throw new Error("Worker not running");
    }

    if (this.isIngesting) {
      throw new Error("Cycle already in progress");
    }

    return this.runCycle();
  }
}

/**
 * Gamma API market response type
 */
interface GammaMarketResponse {
  id?: string;
  conditionId?: string;
  slug: string;
  question: string;
  description?: string;
  category?: string;
  image?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  volume?: number;
  volumeNum?: number;
  liquidity?: number;
}

/**
 * CLOB API trade response type
 */
interface ClobTradeResponse {
  id?: string;
  match_id?: string;
  owner?: string;
  maker_address?: string;
  taker_address?: string;
  side: string;
  size?: string;
  amount?: string;
  price?: string;
  fee?: string;
  timestamp?: string;
  created_at?: string;
  transaction_hash?: string;
}

/**
 * Create a new ingestion worker instance
 */
export function createIngestionWorker(config: IngestionWorkerConfig = {}): IngestionWorker {
  return new IngestionWorker(config);
}

/**
 * Default ingestion worker instance
 */
export const ingestionWorker = new IngestionWorker();
