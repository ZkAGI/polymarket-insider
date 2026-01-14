import { EventEmitter } from "events";
import { PrismaClient, TradeSide } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/client";
import { env } from "../../config/env";
import { randomUUID } from "crypto";

export interface TradePollingConfig {
  pollIntervalMs?: number;
  whaleThreshold?: number;
  autoCreateWallets?: boolean;
  prisma?: PrismaClient;
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

export interface TradePollingStats {
  totalPolls: number;
  totalTradesProcessed: number;
  whaleTradesDetected: number;
  newWalletsCreated: number;
  errors: number;
  lastPollAt: Date | null;
  startedAt: Date | null;
}

interface DataApiTrade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  name: string;
  pseudonym: string;
  transactionHash: string;
}

export class TradePollingService extends EventEmitter {
  private config: {
    pollIntervalMs: number;
    whaleThreshold: number;
    autoCreateWallets: boolean;
  };
  private readonly prisma: PrismaClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;
  
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isPolling = false;
  private processedTradeIds: Set<string> = new Set();
  private lastTimestamp: number = Math.floor(Date.now() / 1000) - 300; // 5 min ago
  
  private stats: TradePollingStats = {
    totalPolls: 0,
    totalTradesProcessed: 0,
    whaleTradesDetected: 0,
    newWalletsCreated: 0,
    errors: 0,
    lastPollAt: null,
    startedAt: null,
  };

  // PUBLIC Data API - no authentication needed!
  private readonly DATA_API = "https://data-api.polymarket.com";

  constructor(config: TradePollingConfig = {}) {
    super();
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 30000,
      whaleThreshold: config.whaleThreshold ?? env.WHALE_THRESHOLD_USD,
      autoCreateWallets: config.autoCreateWallets ?? true,
    };
    this.prisma = config.prisma ?? defaultPrisma;
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [TradePolling] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [TradePolling] ${message}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger("Service already running");
      return;
    }

    this.logger("Starting trade polling service (using PUBLIC Data API)", {
      pollIntervalMs: this.config.pollIntervalMs,
      whaleThreshold: this.config.whaleThreshold,
    });

    this.isRunning = true;
    this.stats.startedAt = new Date();
    this.emit("started");

    // Do initial poll
    await this.poll();

    // Start polling interval
    this.pollInterval = setInterval(async () => {
      await this.poll();
    }, this.config.pollIntervalMs);

    this.logger("Service started");
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.logger("Stopping trade polling service");
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.isRunning = false;
    this.emit("stopped");
    this.logger("Service stopped");
  }

  getStats(): TradePollingStats {
    return { ...this.stats };
  }

  /**
   * Main polling function - fetches ALL recent trades from public API
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.stats.totalPolls++;
    this.stats.lastPollAt = new Date();

    try {
      // Fetch recent large trades (whale-sized)
      // filterType=CASH&filterAmount=1000 means trades > $1000
      const minTradeSize = Math.min(this.config.whaleThreshold / 10, 1000); // At least $1000
      
      const url = `${this.DATA_API}/trades?limit=100&filterType=CASH&filterAmount=${minTradeSize}`;
      
      this.logger(`Fetching trades from Data API...`);
      
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Data API error: ${response.status} ${response.statusText}`);
      }

      const trades: DataApiTrade[] = await response.json();
      
      if (!trades || !Array.isArray(trades) || trades.length === 0) {
        this.logger("No trades returned from API");
        this.isPolling = false;
        return;
      }

      this.logger(`Fetched ${trades.length} trades from Data API`);

      let tradesProcessed = 0;
      let whalesFound = 0;

      for (const trade of trades) {
        // Create unique ID for deduplication
        const tradeId = `${trade.transactionHash}-${trade.proxyWallet}-${trade.timestamp}`;
        
        if (this.processedTradeIds.has(tradeId)) continue;
        this.processedTradeIds.add(tradeId);

        // Skip if older than last poll
        if (trade.timestamp < this.lastTimestamp) continue;

        const processed = await this.processTrade(trade);
        if (processed) {
          tradesProcessed++;
          
          const usdValue = trade.size * trade.price;
          if (usdValue >= this.config.whaleThreshold) {
            whalesFound++;
          }
        }
      }

      // Update last timestamp
      if (trades.length > 0 && trades[0]) {
        this.lastTimestamp = Math.max(this.lastTimestamp, trades[0].timestamp);
      }

      this.logger(`Poll complete: ${tradesProcessed} new trades, ${whalesFound} whales`);

      // Clean up old processed IDs
      if (this.processedTradeIds.size > 10000) {
        const idsArray = Array.from(this.processedTradeIds);
        this.processedTradeIds = new Set(idsArray.slice(-5000));
      }

    } catch (error) {
      this.stats.errors++;
      this.logger("Poll failed", { error: error instanceof Error ? error.message : String(error) });
    }

    this.isPolling = false;
  }

  /**
   * Process a single trade from the Data API
   */
  private async processTrade(trade: DataApiTrade): Promise<boolean> {
    try {
      const usdValue = trade.size * trade.price;

      if (usdValue < 100) return false; // Skip tiny trades

      // Get or create wallet
      const walletAddress = trade.proxyWallet;
      if (!walletAddress) return false;

      let wallet = await this.prisma.wallet.findUnique({
        where: { address: walletAddress },
      });

      if (!wallet && this.config.autoCreateWallets) {
        wallet = await this.prisma.wallet.create({
          data: {
            address: walletAddress,
            firstTradeAt: new Date(trade.timestamp * 1000),
            totalVolume: 0,
            tradeCount: 0,
            winRate: 0,
          },
        });
        this.stats.newWalletsCreated++;
        this.emit("wallet:new", { walletId: wallet.id, address: walletAddress });
      }

      if (!wallet) return false;

      // Try to find market by slug
      let market = await this.prisma.market.findFirst({
        where: { slug: trade.slug },
      });

      // If no market found, create a placeholder with required id
      if (!market) {
        const marketId = trade.conditionId || randomUUID();
        market = await this.prisma.market.create({
          data: {
            id: marketId,
            slug: trade.slug || `market-${marketId.slice(0, 16)}`,
            eventSlug: trade.eventSlug || null,
            question: trade.title || `Market ${marketId.slice(0, 16)}`,
            description: "",
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            active: true,
            closed: false,
            archived: false,
            volume: 0,
            volume24h: 0,
            liquidity: 0,
            tradeCount: 0,
            uniqueTraders: 0,
          },
        });
      }else if (!market.eventSlug && trade.eventSlug) {
        // Update existing market with eventSlug if missing
        market = await this.prisma.market.update({
          where: { id: market.id },
          data: { eventSlug: trade.eventSlug },
        });
    }

      // Find or create outcome
      let outcome = await this.prisma.outcome.findFirst({
        where: {
          marketId: market.id,
          name: trade.outcome,
        },
      });

      if (!outcome) {
        outcome = await this.prisma.outcome.create({
          data: {
            marketId: market.id,
            name: trade.outcome || "Yes",
            clobTokenId: trade.asset,
            price: trade.price,
            probability: trade.price * 100,
          },
        });
      }

      // Create unique trade ID
      const clobTradeId = trade.transactionHash 
        ? `${trade.transactionHash}-${trade.timestamp}`
        : `data-api-${trade.timestamp}-${walletAddress.slice(-8)}`;

      // Check if trade already exists
      const existingTrade = await this.prisma.trade.findFirst({
        where: { clobTradeId: clobTradeId },
      });

      if (existingTrade) return false;

      const isWhale = usdValue >= this.config.whaleThreshold;

      // Create trade record

const savedTrade = await this.prisma.trade.create({
  data: {
    clobTradeId: clobTradeId,
    marketId: market.id,
    outcomeId: outcome.id,
    walletId: wallet.id,
    side: trade.side === "BUY" ? TradeSide.BUY : TradeSide.SELL,
    amount: trade.size,
    price: trade.price,
    usdValue: usdValue,
    feeUsd: 0,
    timestamp: new Date(trade.timestamp * 1000),
    txHash: trade.transactionHash || null,  // CHANGED
    isWhale: isWhale,
  },
});

      this.stats.totalTradesProcessed++;

      // Update wallet stats
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          totalVolume: { increment: usdValue },
          tradeCount: { increment: 1 },
          lastTradeAt: new Date(),
        },
      });

      this.emit("trade:processed", {
        tradeId: savedTrade.id,
        marketId: market.id,
        walletId: wallet.id,
        usdValue,
        isWhale,
      });

      if (isWhale) {
        this.stats.whaleTradesDetected++;
        this.logger("🐋 WHALE TRADE DETECTED", {
          tradeId: savedTrade.id,
          wallet: walletAddress,
          usdValue: usdValue.toFixed(2),
          side: trade.side,
          market: trade.title,
        });

        this.emit("trade:whale", {
          tradeId: savedTrade.id,
          marketId: market.id,
          walletId: wallet.id,
          walletAddress,
          side: trade.side,
          amount: trade.size,
          price: trade.price,
          usdValue,
          marketTitle: trade.title,
          timestamp: new Date(trade.timestamp * 1000),
        });

        // Create alert
        await this.createWhaleAlert(savedTrade.id, wallet.id, market.id, usdValue, walletAddress, trade.title);
      }
      
      return true;

    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Create whale alert
   */
  private async createWhaleAlert(
    tradeId: string,
    walletId: string,
    marketId: string,
    usdValue: number,
    walletAddress: string,
    marketTitle: string
  ): Promise<void> {
    try {
      const severity = usdValue >= 50000 ? "CRITICAL" : usdValue >= 25000 ? "HIGH" : "MEDIUM";
      const title = `🐋 Whale Trade: $${usdValue.toFixed(0)}`;

      const alert = await this.prisma.alert.create({
  data: {
    type: "WHALE_TRADE",
    severity: severity,
    title: title,
    message: `Large trade of $${usdValue.toFixed(0)} detected on "${marketTitle}" by wallet ${walletAddress.slice(0, 10)}...`,
    market: { connect: { id: marketId } },
    wallet: { connect: { id: walletId } },
    data: {
      tradeId,
      usdValue,
      walletAddress,
      marketTitle,
    },
  },
});

      this.emit("alert:created", alert);

    } catch (error) {
      this.logger("Failed to create alert", { error: String(error) });
    }
  }
}

// Default instance
export const tradePollingService = new TradePollingService();

// Factory
export function createTradePollingService(config?: TradePollingConfig): TradePollingService {
  return new TradePollingService(config);
}