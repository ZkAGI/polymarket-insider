/**
 * Trade Stream Service (API-LIVE-002)
 *
 * Background service that processes incoming trades from WebSocket and stores
 * them in the database. Emits events for downstream detection systems.
 *
 * Features:
 * - Processes real-time trade data from TradeStreamClient
 * - Stores trades in the database via TradeService
 * - Creates/updates wallets via WalletService
 * - Emits events for whale detection and insider analysis
 * - Supports configurable whale threshold
 * - Tracks processing statistics
 */

import { EventEmitter } from "events";
import type { PrismaClient } from "@prisma/client";
import { TradeSide } from "@prisma/client";
import {
  TradeStreamClient,
  createTradeStreamClient,
  type TradeStreamConfig,
  type ParsedTrade,
  type TradeEvent,
  type TradeBatchEvent,
  type LargeTradeEvent,
} from "../api/ws/trade-stream";
import {
  TradeService,
  tradeService as defaultTradeService,
  type CreateTradeInput,
} from "../db/trades";
import {
  WalletService,
  walletService as defaultWalletService,
} from "../db/wallets";
import { prisma as defaultPrisma } from "../db/client";
import { env } from "../../config/env";

/**
 * Configuration for the Trade Stream Service
 */
export interface TradeStreamServiceConfig {
  /** WebSocket configuration */
  wsConfig?: TradeStreamConfig;

  /** USD value threshold to consider a trade as a whale trade */
  whaleThreshold?: number;

  /** Whether to auto-create wallets for new addresses */
  autoCreateWallets?: boolean;

  /** Whether to emit events for processed trades */
  enableEvents?: boolean;

  /** Batch size for processing trades (for batch mode) */
  batchSize?: number;

  /** Custom TradeStreamClient */
  tradeStreamClient?: TradeStreamClient;

  /** Custom TradeService */
  tradeService?: TradeService;

  /** Custom WalletService */
  walletService?: WalletService;

  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Statistics from trade processing
 */
export interface TradeProcessingStats {
  /** Total trades processed */
  totalProcessed: number;

  /** Trades successfully stored */
  storedCount: number;

  /** Trades that failed to store */
  errorCount: number;

  /** Whale trades detected */
  whaleTradesCount: number;

  /** New wallets created */
  newWalletsCount: number;

  /** Duplicate trades skipped */
  duplicateCount: number;

  /** Processing start time */
  startedAt: Date | null;

  /** Last trade processed at */
  lastProcessedAt: Date | null;

  /** Trades per second (rolling average) */
  tradesPerSecond: number;
}

/**
 * Trade processed event
 */
export interface TradeProcessedEvent {
  type: "trade:processed";
  tradeId: string;
  clobTradeId?: string;
  marketId: string;
  walletId: string;
  side: TradeSide;
  amount: number;
  price: number;
  usdValue: number;
  isWhale: boolean;
  timestamp: Date;
  processingTimeMs: number;
}

/**
 * Whale trade event
 */
export interface WhaleTradeEvent {
  type: "trade:whale";
  tradeId: string;
  clobTradeId?: string;
  marketId: string;
  walletId: string;
  walletAddress: string;
  side: TradeSide;
  amount: number;
  price: number;
  usdValue: number;
  timestamp: Date;
}

/**
 * New wallet event
 */
export interface NewWalletEvent {
  type: "wallet:new";
  walletId: string;
  address: string;
  fromTrade: string;
}

/**
 * Processing error event
 */
export interface ProcessingErrorEvent {
  type: "processing:error";
  error: Error;
  trade?: ParsedTrade;
  message: string;
}

/**
 * Trade Stream Service
 *
 * Processes incoming trades from WebSocket and stores them in the database.
 */
export class TradeStreamService extends EventEmitter {
  private config: Required<
    Pick<
      TradeStreamServiceConfig,
      | "whaleThreshold"
      | "autoCreateWallets"
      | "enableEvents"
      | "batchSize"
    >
  >;
  private readonly tradeStreamClient: TradeStreamClient;
  private readonly tradeService: TradeService;
  private readonly walletService: WalletService;
  private readonly prisma: PrismaClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private isRunning = false;
  private stats: TradeProcessingStats = {
    totalProcessed: 0,
    storedCount: 0,
    errorCount: 0,
    whaleTradesCount: 0,
    newWalletsCount: 0,
    duplicateCount: 0,
    startedAt: null,
    lastProcessedAt: null,
    tradesPerSecond: 0,
  };

  // For calculating trades per second
  private recentTradeTimestamps: number[] = [];
  private readonly TRADES_PER_SECOND_WINDOW = 60000; // 1 minute window

  // Cleanup for event listeners
  private tradeUnsubscribe?: () => void;
  private tradeBatchUnsubscribe?: () => void;
  private largeTradeUnsubscribe?: () => void;
  private errorUnsubscribe?: () => void;

  constructor(config: TradeStreamServiceConfig = {}) {
    super();

    this.config = {
      whaleThreshold: config.whaleThreshold ?? env.WHALE_THRESHOLD_USD,
      autoCreateWallets: config.autoCreateWallets ?? true,
      enableEvents: config.enableEvents ?? true,
      batchSize: config.batchSize ?? 100,
    };

    this.tradeStreamClient =
      config.tradeStreamClient ??
      createTradeStreamClient({
        ...config.wsConfig,
        largeTradeThreshold: this.config.whaleThreshold,
      });

    this.tradeService = config.tradeService ?? defaultTradeService;
    this.walletService = config.walletService ?? defaultWalletService;
    this.prisma = config.prisma ?? defaultPrisma;
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [TradeStreamService] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [TradeStreamService] ${message}`);
    }
  }

  /**
   * Start the trade stream service.
   *
   * This connects to the WebSocket and begins processing trades.
   */
  async start(): Promise<void> {
  if (this.isRunning) {
    this.logger("Service already running");
    return;
  }

  this.logger("Starting trade stream service", {
    whaleThreshold: this.config.whaleThreshold,
    autoCreateWallets: this.config.autoCreateWallets,
  });

  this.isRunning = true;
  this.stats.startedAt = new Date();
  this.setupEventHandlers();

  try {
    await this.tradeStreamClient.connect();
    this.logger("Connected to trade stream");

    // AUTO-SUBSCRIBE to all outcome tokens
    await this.subscribeToAllMarkets();

    this.emit("started");
  } catch (error) {
    this.isRunning = false;
    this.logger("Failed to connect", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

private async subscribeToAllMarkets(): Promise<void> {
  try {
    // Get recent active markets with outcomes (limit to prevent overload)
    const recentOutcomes = await this.prisma.outcome.findMany({
      where: { 
        clobTokenId: { not: null },
        market: {
          active: true,
          closed: false,
        }
      },
      select: { clobTokenId: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const tokenIds = recentOutcomes
      .map(o => o.clobTokenId)
      .filter((id): id is string => id !== null && id.length > 10);

    if (tokenIds.length === 0) {
      this.logger("No tokens to subscribe to");
      return;
    }

    this.logger("Subscribing to active market tokens", { count: tokenIds.length });

    // Subscribe in smaller batches with delay
    const batchSize = 20;
    let subscribed = 0;

    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      
      try {
        await this.tradeStreamClient.subscribe({ tokenIds: batch });
        subscribed += batch.length;
        
        // Small delay between batches to avoid overwhelming the WebSocket
        if (i + batchSize < tokenIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {
        this.logger("Batch subscription failed, continuing", { 
          batch: i / batchSize,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    this.logger("Subscription complete", { subscribed, total: tokenIds.length });
  } catch (error) {
    this.logger("Failed to subscribe to markets", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

  /**
   * Stop the trade stream service.
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger("Service not running");
      return;
    }

    this.logger("Stopping trade stream service");

    // Clean up event handlers
    if (this.tradeUnsubscribe) {
      this.tradeUnsubscribe();
      this.tradeUnsubscribe = undefined;
    }
    if (this.tradeBatchUnsubscribe) {
      this.tradeBatchUnsubscribe();
      this.tradeBatchUnsubscribe = undefined;
    }
    if (this.largeTradeUnsubscribe) {
      this.largeTradeUnsubscribe();
      this.largeTradeUnsubscribe = undefined;
    }
    if (this.errorUnsubscribe) {
      this.errorUnsubscribe();
      this.errorUnsubscribe = undefined;
    }

    this.tradeStreamClient.disconnect();
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
   * Get current processing statistics.
   */
  getStats(): TradeProcessingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      storedCount: 0,
      errorCount: 0,
      whaleTradesCount: 0,
      newWalletsCount: 0,
      duplicateCount: 0,
      startedAt: this.isRunning ? new Date() : null,
      lastProcessedAt: null,
      tradesPerSecond: 0,
    };
    this.recentTradeTimestamps = [];
    this.logger("Statistics reset");
  }

  /**
   * Subscribe to a market's trade stream.
   *
   * @param tokenIds - Token ID(s) to subscribe to
   */
  async subscribeToMarket(tokenIds: string | string[]): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Service not running. Call start() first.");
    }

    const ids = Array.isArray(tokenIds) ? tokenIds : [tokenIds];
    this.logger("Subscribing to market", { tokenIds: ids });

    await this.tradeStreamClient.subscribe({ tokenIds: ids });
  }

  /**
   * Unsubscribe from a market's trade stream.
   *
   * @param tokenId - Token ID to unsubscribe from
   */
  async unsubscribeFromMarket(tokenId: string): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger("Unsubscribing from market", { tokenId });
    await this.tradeStreamClient.unsubscribeToken(tokenId);
  }

  /**
   * Get the underlying TradeStreamClient.
   */
  getTradeStreamClient(): TradeStreamClient {
    return this.tradeStreamClient;
  }

  /**
   * Set up event handlers for the trade stream.
   */
  private setupEventHandlers(): void {
    // Handle individual trades
    this.tradeUnsubscribe = this.tradeStreamClient.on("trade", (event: TradeEvent) => {
      this.processTrade(event.trade).catch((error) => {
        this.handleProcessingError(error, event.trade);
      });
    });

    // Handle trade batches
    this.tradeBatchUnsubscribe = this.tradeStreamClient.on("tradeBatch", (event: TradeBatchEvent) => {
      this.processTradeBatch(event.trades).catch((error) => {
        this.handleProcessingError(error);
      });
    });

    // Handle large trades (whale activity)
    this.largeTradeUnsubscribe = this.tradeStreamClient.on("largeTrade", (event: LargeTradeEvent) => {
      this.logger("Large trade detected", {
        assetId: event.trade.assetId,
        usdValue: event.sizeUsd,
        side: event.trade.side,
      });
    });

    // Handle errors
    this.errorUnsubscribe = this.tradeStreamClient.on("tradeStreamError", (event) => {
      this.logger("Trade stream error", { message: event.message });
      this.emit("error", event.error);
    });
  }

  /**
   * Process a single trade.
   */
  async processTrade(trade: ParsedTrade): Promise<void> {
    const startTime = Date.now();
    this.stats.totalProcessed++;
    this.updateTradesPerSecond();

    try {
      // Determine the wallet address (prefer taker, fallback to maker)
      const walletAddress = trade.takerAddress ?? trade.makerAddress;
      if (!walletAddress) {
        this.logger("Trade missing wallet address, skipping", { tradeId: trade.id });
        return;
      }

      // Find or create the wallet
      const { wallet, isNew } = await this.findOrCreateWallet(walletAddress);

      if (isNew) {
        this.stats.newWalletsCount++;
        if (this.config.enableEvents) {
          this.emit("wallet:new", {
            type: "wallet:new",
            walletId: wallet.id,
            address: walletAddress,
            fromTrade: trade.id,
          } as NewWalletEvent);
        }
      }

      // Check if trade is a whale trade
      const isWhale = trade.valueUsd >= this.config.whaleThreshold;
      if (isWhale) {
        this.stats.whaleTradesCount++;
      }

      // Find the outcome by clobTokenId
      const outcome = await this.findOutcomeByClobTokenId(trade.assetId);
      if (!outcome) {
        this.logger("Outcome not found for asset, skipping", { assetId: trade.assetId });
        return;
      }

      // Create trade input
      const tradeInput: CreateTradeInput = {
        marketId: outcome.marketId,
        outcomeId: outcome.id,
        walletId: wallet.id,
        clobTradeId: trade.id,
        matchId: trade.matchId,
        side: trade.side === "buy" ? TradeSide.BUY : TradeSide.SELL,
        amount: trade.size,
        price: trade.price,
        usdValue: trade.valueUsd,
        feeUsd: trade.feeUsd,
        makerAddress: trade.makerAddress,
        takerAddress: trade.takerAddress,
        isMaker: trade.makerAddress === walletAddress,
        timestamp: trade.timestamp,
        txHash: trade.transactionHash,
        isWhale,
        isInsider: false, // Will be determined by detection service
        flags: trade.isLargeTrade ? ["large"] : [],
      };

      // Upsert trade (handles duplicates)
      const storedTrade = await this.tradeService.upsertByClobTradeId(trade.id, tradeInput);
      this.stats.storedCount++;
      this.stats.lastProcessedAt = new Date();

      // Update wallet stats
      await this.walletService.incrementTradeStats(wallet.id, trade.valueUsd);

      // Emit events
      if (this.config.enableEvents) {
        const processingTimeMs = Date.now() - startTime;

        this.emit("trade:processed", {
          type: "trade:processed",
          tradeId: storedTrade.id,
          clobTradeId: trade.id,
          marketId: outcome.marketId,
          walletId: wallet.id,
          side: tradeInput.side,
          amount: trade.size,
          price: trade.price,
          usdValue: trade.valueUsd,
          isWhale,
          timestamp: trade.timestamp,
          processingTimeMs,
        } as TradeProcessedEvent);

        if (isWhale) {
          this.emit("trade:whale", {
            type: "trade:whale",
            tradeId: storedTrade.id,
            clobTradeId: trade.id,
            marketId: outcome.marketId,
            walletId: wallet.id,
            walletAddress,
            side: tradeInput.side,
            amount: trade.size,
            price: trade.price,
            usdValue: trade.valueUsd,
            timestamp: trade.timestamp,
          } as WhaleTradeEvent);
        }
      }
    } catch (error) {
      // Check if it's a duplicate key error
      if (this.isDuplicateError(error)) {
        this.stats.duplicateCount++;
        return;
      }

      this.stats.errorCount++;
      throw error;
    }
  }

  /**
   * Process a batch of trades.
   */
  async processTradeBatch(trades: ParsedTrade[]): Promise<void> {
    this.logger("Processing trade batch", { count: trades.length });

    for (const trade of trades) {
      try {
        await this.processTrade(trade);
      } catch (error) {
        this.handleProcessingError(error, trade);
      }
    }
  }

  /**
   * Find or create a wallet by address.
   */
  private async findOrCreateWallet(
    address: string
  ): Promise<{ wallet: { id: string; address: string }; isNew: boolean }> {
    if (!this.config.autoCreateWallets) {
      const wallet = await this.walletService.findByAddress(address);
      if (!wallet) {
        throw new Error(`Wallet not found: ${address}`);
      }
      return { wallet, isNew: false };
    }

    const result = await this.walletService.findOrCreate(address);
    return { wallet: result.wallet, isNew: result.created };
  }

  /**
   * Find outcome by CLOB token ID.
   */
  private async findOutcomeByClobTokenId(
    clobTokenId: string
  ): Promise<{ id: string; marketId: string } | null> {
    const outcome = await this.prisma.outcome.findUnique({
      where: { clobTokenId },
      select: { id: true, marketId: true },
    });

    return outcome;
  }

  /**
   * Check if error is a duplicate key error.
   */
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes("Unique constraint") ||
        error.message.includes("duplicate key") ||
        error.message.includes("P2002")
      );
    }
    return false;
  }

  /**
   * Handle processing errors.
   */
  private handleProcessingError(error: unknown, trade?: ParsedTrade): void {
    const err = error instanceof Error ? error : new Error(String(error));

    this.logger("Processing error", {
      error: err.message,
      tradeId: trade?.id,
    });

    this.stats.errorCount++;

    if (this.config.enableEvents) {
      this.emit("processing:error", {
        type: "processing:error",
        error: err,
        trade,
        message: err.message,
      } as ProcessingErrorEvent);
    }
  }

  /**
   * Update the trades per second metric.
   */
  private updateTradesPerSecond(): void {
    const now = Date.now();
    this.recentTradeTimestamps.push(now);

    // Remove timestamps older than the window
    const cutoff = now - this.TRADES_PER_SECOND_WINDOW;
    this.recentTradeTimestamps = this.recentTradeTimestamps.filter((t) => t > cutoff);

    // Calculate trades per second
    const windowSeconds = this.TRADES_PER_SECOND_WINDOW / 1000;
    this.stats.tradesPerSecond = this.recentTradeTimestamps.length / windowSeconds;
  }

  /**
   * Update configuration.
   */
  updateConfig(
    config: Partial<Pick<TradeStreamServiceConfig, "whaleThreshold" | "autoCreateWallets" | "enableEvents">>
  ): void {
    if (config.whaleThreshold !== undefined) {
      this.config.whaleThreshold = config.whaleThreshold;
    }
    if (config.autoCreateWallets !== undefined) {
      this.config.autoCreateWallets = config.autoCreateWallets;
    }
    if (config.enableEvents !== undefined) {
      this.config.enableEvents = config.enableEvents;
    }

    this.logger("Config updated", {
      whaleThreshold: this.config.whaleThreshold,
      autoCreateWallets: this.config.autoCreateWallets,
      enableEvents: this.config.enableEvents,
    });
  }

  /**
   * Dispose of the service and clean up resources.
   */
  dispose(): void {
    this.stop();
    this.tradeStreamClient.dispose();
    this.removeAllListeners();
    this.logger("Service disposed");
  }
}

/**
 * Default trade stream service instance.
 */
export const tradeStreamService = new TradeStreamService();

/**
 * Create a new trade stream service instance with custom configuration.
 */
export function createTradeStreamService(
  config: TradeStreamServiceConfig = {}
): TradeStreamService {
  return new TradeStreamService(config);
}
