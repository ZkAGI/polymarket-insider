/**
 * Trade Stream Module (API-WS-004)
 *
 * Provides real-time trade execution feed subscription:
 * - Subscribe to trade streams for specific markets
 * - Parse and normalize trade messages
 * - Emit trade events to listeners
 * - Handle high-volume trade streams efficiently
 */

import {
  ReconnectableConnection,
  createReconnectableConnection,
} from "./auto-reconnect";
import type {
  WebSocketConfig,
  WebSocketLogger,
  WebSocketConstructor,
  ConnectionState,
} from "./types";
import {
  SubscriptionMessageType,
  SubscriptionChannel,
  generateSubscriptionId,
  normalizeTokenIds,
  parseMessageTimestamp,
  isSubscriptionConfirmation,
  isErrorMessage,
} from "./market-subscriptions";
import type {
  SubscriptionMessage,
  SubscriptionConfirmation,
} from "./market-subscriptions";

// ============================================================================
// Constants
// ============================================================================

/**
 * Polymarket WebSocket URL for trade streams
 */
export const POLYMARKET_TRADES_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

/**
 * Default buffer size for trade batching
 */
export const DEFAULT_BUFFER_SIZE = 100;

/**
 * Default flush interval in milliseconds
 */
export const DEFAULT_FLUSH_INTERVAL = 1000;

/**
 * Maximum trades to store per token
 */
export const DEFAULT_MAX_TRADES_PER_TOKEN = 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Trade direction
 */
export type TradeStreamDirection = "buy" | "sell";

/**
 * Raw trade message from WebSocket
 */
export interface RawTradeMessage {
  /** Message type */
  type?: "trade" | string;

  /** Asset/token ID */
  asset_id?: string;
  market?: string;
  token_id?: string;

  /** Trade ID */
  id?: string;
  trade_id?: string;

  /** Price (0-1) */
  price?: number | string;

  /** Size/amount */
  size?: number | string;
  amount?: number | string;
  quantity?: number | string;

  /** Trade direction */
  side?: string;
  direction?: string;

  /** Maker address */
  maker?: string;
  maker_address?: string;

  /** Taker address */
  taker?: string;
  taker_address?: string;

  /** Transaction hash */
  transaction_hash?: string;
  tx_hash?: string;

  /** Fee rate in basis points */
  fee_rate_bps?: number | string;

  /** Timestamp */
  timestamp?: string | number;
  created_at?: string;
  executed_at?: string;

  /** Match ID */
  match_id?: string;

  /** Outcome name */
  outcome?: string;
  outcome_name?: string;

  /** Market question */
  question?: string;
  market_question?: string;

  /** Sequence number for ordering */
  sequence?: number;
}

/**
 * Parsed trade with computed fields
 */
export interface ParsedTrade {
  /** Unique trade ID */
  id: string;

  /** Asset/token ID */
  assetId: string;

  /** Price (0-1) */
  price: number;

  /** Price as probability (0-100%) */
  probability: number;

  /** Trade size */
  size: number;

  /** Trade value in USD (size * price for binary markets) */
  valueUsd: number;

  /** Trade direction */
  side: TradeStreamDirection;

  /** Maker address */
  makerAddress?: string;

  /** Taker address */
  takerAddress?: string;

  /** Transaction hash */
  transactionHash?: string;

  /** Fee rate in basis points */
  feeRateBps?: number;

  /** Fee amount in USD */
  feeUsd?: number;

  /** Parsed timestamp */
  timestamp: Date;

  /** When this trade was received */
  receivedAt: Date;

  /** Match ID */
  matchId?: string;

  /** Outcome name */
  outcomeName?: string;

  /** Market question */
  marketQuestion?: string;

  /** Sequence number */
  sequence?: number;

  /** Whether this is a large trade (whale activity) */
  isLargeTrade: boolean;

  /** Raw message data for debugging */
  raw?: RawTradeMessage;
}

/**
 * Trade stream subscription request
 */
export interface TradeStreamSubscriptionRequest {
  /** Token ID(s) to subscribe to */
  tokenIds: string | string[];

  /** Minimum trade size to emit (filter out small trades) */
  minSize?: number;

  /** Whether to include raw message in parsed trade */
  includeRaw?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Trade stream subscription info
 */
export interface TradeStreamSubscriptionInfo {
  /** Subscription ID */
  id: string;

  /** Subscribed token IDs */
  tokenIds: string[];

  /** When the subscription was created */
  createdAt: Date;

  /** Whether confirmed */
  confirmed: boolean;

  /** When confirmed */
  confirmedAt?: Date;

  /** Last trade received */
  lastTradeAt?: Date;

  /** Total trades received */
  tradeCount: number;

  /** Total volume (in size units) */
  totalVolume: number;

  /** Total value (in USD) */
  totalValueUsd: number;

  /** Buy trades count */
  buyCount: number;

  /** Sell trades count */
  sellCount: number;

  /** Buy volume */
  buyVolume: number;

  /** Sell volume */
  sellVolume: number;

  /** Recent trades per token (limited to maxTradesPerToken) */
  recentTrades: Map<string, ParsedTrade[]>;

  /** Minimum size filter */
  minSize?: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Trade event
 */
export interface TradeEvent {
  type: "trade";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  trade: ParsedTrade;
}

/**
 * Trade batch event (for high-volume streams)
 */
export interface TradeBatchEvent {
  type: "tradeBatch";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  trades: ParsedTrade[];
  count: number;
}

/**
 * Large trade event (whale activity)
 */
export interface LargeTradeEvent {
  type: "largeTrade";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  trade: ParsedTrade;
  sizeUsd: number;
}

/**
 * Trade stream confirmed event
 */
export interface TradeStreamConfirmedEvent {
  type: "tradeStreamConfirmed";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  tokenIds: string[];
}

/**
 * Trade stream error event
 */
export interface TradeStreamErrorEvent {
  type: "tradeStreamError";
  connectionId: string;
  timestamp: Date;
  subscriptionId?: string;
  error: Error;
  message: string;
}

/**
 * Trade stream statistics
 */
export interface TradeStreamStats {
  /** Total trades received */
  totalTrades: number;

  /** Total volume */
  totalVolume: number;

  /** Total value in USD */
  totalValueUsd: number;

  /** Average trade size */
  avgSize: number;

  /** Average price */
  avgPrice: number;

  /** VWAP (Volume Weighted Average Price) */
  vwap: number;

  /** Buy/sell ratio */
  buySellRatio: number;

  /** Trades per second (recent) */
  tradesPerSecond: number;

  /** Large trades count */
  largeTradesCount: number;

  /** Unique makers */
  uniqueMakers: number;

  /** Unique takers */
  uniqueTakers: number;
}

/**
 * Trade stream configuration
 */
export interface TradeStreamConfig extends Partial<WebSocketConfig> {
  /** WebSocket URL */
  wsUrl?: string;

  /** Large trade threshold in USD (default: 10000) */
  largeTradeThreshold?: number;

  /** Whether to buffer trades (for high volume) */
  enableBuffering?: boolean;

  /** Buffer size (max trades before flush) */
  bufferSize?: number;

  /** Flush interval in milliseconds */
  flushInterval?: number;

  /** Max trades to store per token */
  maxTradesPerToken?: number;

  /** Timeout for subscription confirmation in ms (default: 10000) */
  confirmationTimeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event listener map for trade stream
 */
export interface TradeStreamEventListenerMap {
  trade: ((event: TradeEvent) => void)[];
  tradeBatch: ((event: TradeBatchEvent) => void)[];
  largeTrade: ((event: LargeTradeEvent) => void)[];
  tradeStreamConfirmed: ((event: TradeStreamConfirmedEvent) => void)[];
  tradeStreamError: ((event: TradeStreamErrorEvent) => void)[];
  connected: ((event: { connectionId: string; timestamp: Date }) => void)[];
  disconnected: ((event: { connectionId: string; timestamp: Date; code: number; reason: string }) => void)[];
  reconnecting: ((event: { connectionId: string; timestamp: Date; attempt: number }) => void)[];
}

type TradeStreamEventKey = keyof TradeStreamEventListenerMap;

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger: WebSocketLogger = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse trade direction from various formats
 */
export function parseTradeDirection(side: string | undefined): TradeStreamDirection {
  if (!side) return "buy";

  const normalized = side.toLowerCase().trim();

  if (normalized === "sell" || normalized === "s" || normalized === "ask" ||
      normalized === "short" || normalized === "offer") {
    return "sell";
  }

  return "buy";
}

/**
 * Parse a raw trade message into a ParsedTrade
 */
export function parseTradeMessage(
  raw: RawTradeMessage,
  options: {
    largeTradeThreshold?: number;
    includeRaw?: boolean;
  } = {}
): ParsedTrade | null {
  // Extract asset ID
  const assetId = raw.asset_id ?? raw.market ?? raw.token_id;
  if (!assetId) {
    return null;
  }

  // Extract trade ID
  const id = raw.id ?? raw.trade_id ?? `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Extract price
  const priceRaw = raw.price;
  if (priceRaw === undefined || priceRaw === null) {
    return null;
  }
  const price = typeof priceRaw === "string" ? parseFloat(priceRaw) : priceRaw;
  if (isNaN(price)) {
    return null;
  }

  // Extract size
  const sizeRaw = raw.size ?? raw.amount ?? raw.quantity;
  if (sizeRaw === undefined || sizeRaw === null) {
    return null;
  }
  const size = typeof sizeRaw === "string" ? parseFloat(sizeRaw) : sizeRaw;
  if (isNaN(size) || size <= 0) {
    return null;
  }

  // Calculate value (for binary markets, value = size * price)
  const valueUsd = size * price;

  // Parse direction
  const side = parseTradeDirection(raw.side ?? raw.direction);

  // Parse timestamp
  const timestamp = parseMessageTimestamp(raw.timestamp ?? raw.created_at ?? raw.executed_at);

  // Extract fee
  const feeRateBps = raw.fee_rate_bps !== undefined
    ? (typeof raw.fee_rate_bps === "string" ? parseFloat(raw.fee_rate_bps) : raw.fee_rate_bps)
    : undefined;
  const feeUsd = feeRateBps !== undefined ? (valueUsd * feeRateBps) / 10000 : undefined;

  // Determine if large trade
  const threshold = options.largeTradeThreshold ?? 10000;
  const isLargeTrade = valueUsd >= threshold;

  const parsed: ParsedTrade = {
    id,
    assetId,
    price,
    probability: price * 100,
    size,
    valueUsd,
    side,
    makerAddress: raw.maker ?? raw.maker_address,
    takerAddress: raw.taker ?? raw.taker_address,
    transactionHash: raw.transaction_hash ?? raw.tx_hash,
    feeRateBps,
    feeUsd,
    timestamp,
    receivedAt: new Date(),
    matchId: raw.match_id,
    outcomeName: raw.outcome ?? raw.outcome_name,
    marketQuestion: raw.question ?? raw.market_question,
    sequence: raw.sequence,
    isLargeTrade,
  };

  if (options.includeRaw) {
    parsed.raw = raw;
  }

  return parsed;
}

/**
 * Check if a message is a trade message
 */
export function isTradeMessage(message: unknown): message is RawTradeMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check for trade message type
  if (msg.type === "trade") {
    return true;
  }

  // Check for trade data (has price and size)
  const hasPrice = msg.price !== undefined;
  const hasSize = msg.size !== undefined || msg.amount !== undefined || msg.quantity !== undefined;
  const hasAsset = msg.asset_id !== undefined || msg.market !== undefined || msg.token_id !== undefined;

  // Must have at least price, size, and asset
  return hasPrice && hasSize && hasAsset;
}

/**
 * Build a trade stream subscription message
 */
export function buildTradeSubscriptionMessage(
  tokenIds: string[],
  type: "subscribe" | "unsubscribe" = "subscribe",
  subscriptionId?: string
): SubscriptionMessage {
  const message: SubscriptionMessage = {
    type: type === "subscribe" ? SubscriptionMessageType.SUBSCRIBE : SubscriptionMessageType.UNSUBSCRIBE,
    channel: SubscriptionChannel.TRADES,
  };

  if (tokenIds.length === 1 && tokenIds[0]) {
    message.market = tokenIds[0];
  } else if (tokenIds.length > 0) {
    message.assets_ids = tokenIds;
  }

  if (subscriptionId) {
    message.id = subscriptionId;
  }

  return message;
}

/**
 * Calculate statistics from trades
 */
export function calculateTradeStreamStats(trades: ParsedTrade[]): TradeStreamStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      totalVolume: 0,
      totalValueUsd: 0,
      avgSize: 0,
      avgPrice: 0,
      vwap: 0,
      buySellRatio: 1,
      tradesPerSecond: 0,
      largeTradesCount: 0,
      uniqueMakers: 0,
      uniqueTakers: 0,
    };
  }

  let totalVolume = 0;
  let totalValueUsd = 0;
  let priceSum = 0;
  let buyCount = 0;
  let sellCount = 0;
  let largeTradesCount = 0;
  const makers = new Set<string>();
  const takers = new Set<string>();

  for (const trade of trades) {
    totalVolume += trade.size;
    totalValueUsd += trade.valueUsd;
    priceSum += trade.price;

    if (trade.side === "buy") {
      buyCount++;
    } else {
      sellCount++;
    }

    if (trade.isLargeTrade) {
      largeTradesCount++;
    }

    if (trade.makerAddress) {
      makers.add(trade.makerAddress);
    }
    if (trade.takerAddress) {
      takers.add(trade.takerAddress);
    }
  }

  // Calculate VWAP
  const vwap = totalVolume > 0 ? totalValueUsd / totalVolume : 0;

  // Calculate trades per second
  const firstTrade = trades[0];
  const lastTrade = trades[trades.length - 1];
  const timeSpanMs = lastTrade && firstTrade
    ? Math.abs(lastTrade.timestamp.getTime() - firstTrade.timestamp.getTime())
    : 0;
  const tradesPerSecond = timeSpanMs > 0 ? (trades.length * 1000) / timeSpanMs : 0;

  return {
    totalTrades: trades.length,
    totalVolume,
    totalValueUsd,
    avgSize: totalVolume / trades.length,
    avgPrice: priceSum / trades.length,
    vwap,
    buySellRatio: sellCount > 0 ? buyCount / sellCount : buyCount > 0 ? Infinity : 1,
    tradesPerSecond,
    largeTradesCount,
    uniqueMakers: makers.size,
    uniqueTakers: takers.size,
  };
}

/**
 * Filter trades by minimum size
 */
export function filterTradesByMinSize(trades: ParsedTrade[], minSize: number): ParsedTrade[] {
  return trades.filter(t => t.size >= minSize);
}

/**
 * Filter trades by time range
 */
export function filterTradesByTimeRange(
  trades: ParsedTrade[],
  startTime: Date,
  endTime: Date
): ParsedTrade[] {
  return trades.filter(t =>
    t.timestamp >= startTime && t.timestamp <= endTime
  );
}

/**
 * Group trades by asset ID
 */
export function groupTradesByAsset(trades: ParsedTrade[]): Map<string, ParsedTrade[]> {
  const grouped = new Map<string, ParsedTrade[]>();

  for (const trade of trades) {
    const existing = grouped.get(trade.assetId);
    if (existing) {
      existing.push(trade);
    } else {
      grouped.set(trade.assetId, [trade]);
    }
  }

  return grouped;
}

/**
 * Sort trades by timestamp
 */
export function sortTradesByTime(trades: ParsedTrade[], ascending: boolean = false): ParsedTrade[] {
  return [...trades].sort((a, b) =>
    ascending
      ? a.timestamp.getTime() - b.timestamp.getTime()
      : b.timestamp.getTime() - a.timestamp.getTime()
  );
}

// ============================================================================
// TradeStreamClient Class
// ============================================================================

/**
 * Client for subscribing to real-time trade execution feed
 */
export class TradeStreamClient {
  private connection: ReconnectableConnection;
  private readonly config: Required<Pick<
    TradeStreamConfig,
    "largeTradeThreshold" | "enableBuffering" | "bufferSize" | "flushInterval" | "maxTradesPerToken" | "confirmationTimeout" | "debug"
  >>;
  private readonly logger: WebSocketLogger;

  private readonly subscriptions: Map<string, TradeStreamSubscriptionInfo> = new Map();
  private readonly tokenToSubscription: Map<string, string> = new Map();
  private pendingConfirmations: Map<string, { resolve: () => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private disposed = false;

  // Trade buffering for high-volume streams
  private tradeBuffer: Map<string, ParsedTrade[]> = new Map();
  private flushTimer?: ReturnType<typeof setInterval>;

  // Global statistics
  private globalStats = {
    totalTrades: 0,
    totalVolume: 0,
    totalValueUsd: 0,
    largeTradesCount: 0,
  };

  private readonly listeners: TradeStreamEventListenerMap = {
    trade: [],
    tradeBatch: [],
    largeTrade: [],
    tradeStreamConfirmed: [],
    tradeStreamError: [],
    connected: [],
    disconnected: [],
    reconnecting: [],
  };

  constructor(
    config: TradeStreamConfig = {},
    logger: WebSocketLogger = defaultLogger,
    WebSocketClass?: WebSocketConstructor
  ) {
    this.logger = config.debug ? {
      debug: console.log.bind(console, "[TradeStream]"),
      info: console.log.bind(console, "[TradeStream]"),
      warn: console.warn.bind(console, "[TradeStream]"),
      error: console.error.bind(console, "[TradeStream]"),
    } : logger;

    this.config = {
      largeTradeThreshold: config.largeTradeThreshold ?? 10000,
      enableBuffering: config.enableBuffering ?? false,
      bufferSize: config.bufferSize ?? DEFAULT_BUFFER_SIZE,
      flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
      maxTradesPerToken: config.maxTradesPerToken ?? DEFAULT_MAX_TRADES_PER_TOKEN,
      confirmationTimeout: config.confirmationTimeout ?? 10000,
      debug: config.debug ?? false,
    };

    // Create the WebSocket connection
    this.connection = createReconnectableConnection(
      {
        url: config.wsUrl ?? POLYMARKET_TRADES_WS_URL,
        ...config,
        pingInterval: config.pingInterval ?? 30000,
        autoReconnect: config.autoReconnect ?? true,
        maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
        reconnectDelay: config.reconnectDelay ?? 1000,
        reconnectConfig: {
          restoreSubscriptions: true,
        },
      },
      this.logger,
      WebSocketClass
    );

    this.setupEventHandlers();

    // Start flush timer if buffering is enabled
    if (this.config.enableBuffering) {
      this.startFlushTimer();
    }
  }

  // ==========================================================================
  // Event Setup
  // ==========================================================================

  private setupEventHandlers(): void {
    this.connection.on("open", (event) => {
      this.logger.info(`Connected to ${event.url}`);
      this.emit("connected", {
        connectionId: event.connectionId,
        timestamp: event.timestamp,
      });
    });

    this.connection.on("close", (event) => {
      this.logger.info(`Disconnected: ${event.reason} (code: ${event.code})`);

      // Mark subscriptions as unconfirmed
      for (const subscription of this.subscriptions.values()) {
        subscription.confirmed = false;
      }

      this.emit("disconnected", {
        connectionId: event.connectionId,
        timestamp: event.timestamp,
        code: event.code,
        reason: event.reason,
      });
    });

    this.connection.on("reconnect", (event) => {
      this.logger.info(`Reconnecting... attempt ${event.attempt}/${event.maxAttempts}`);
      this.emit("reconnecting", {
        connectionId: event.connectionId,
        timestamp: event.timestamp,
        attempt: event.attempt,
      });
    });

    this.connection.on("message", (event) => {
      this.handleMessage(event.json);
    });

    this.connection.on("subscriptionsRestored", (event) => {
      this.logger.info(`Subscriptions restored: ${event.successful}/${event.total}`);
    });

    this.connection.on("error", (event) => {
      this.logger.error(`WebSocket error: ${event.message}`);
    });
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  private handleMessage(data: unknown): void {
    if (!data || typeof data !== "object") {
      return;
    }

    // Handle subscription confirmations
    if (isSubscriptionConfirmation(data)) {
      this.handleSubscriptionConfirmation(data);
      return;
    }

    // Handle trade messages
    if (isTradeMessage(data)) {
      this.handleTradeMessage(data);
      return;
    }

    // Handle errors
    if (isErrorMessage(data)) {
      this.handleError(data);
      return;
    }

    this.logger.debug("Unknown message type:", data);
  }

  private handleSubscriptionConfirmation(confirmation: SubscriptionConfirmation): void {
    let subscriptionId = confirmation.id;
    let subscription: TradeStreamSubscriptionInfo | undefined;

    if (subscriptionId) {
      subscription = this.subscriptions.get(subscriptionId);
    } else {
      const tokenIds = confirmation.assets_ids ?? (confirmation.market ? [confirmation.market] : []);
      for (const tokenId of tokenIds) {
        const subId = this.tokenToSubscription.get(tokenId);
        if (subId) {
          subscriptionId = subId;
          subscription = this.subscriptions.get(subId);
          break;
        }
      }
    }

    if (!subscription || !subscriptionId) {
      this.logger.warn("Received confirmation for unknown subscription:", confirmation);
      return;
    }

    if (confirmation.type === "subscribed") {
      subscription.confirmed = true;
      subscription.confirmedAt = new Date();

      this.logger.info(`Trade stream confirmed: ${subscriptionId}`);

      const pending = this.pendingConfirmations.get(subscriptionId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingConfirmations.delete(subscriptionId);
      }

      this.emit("tradeStreamConfirmed", {
        type: "tradeStreamConfirmed",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        tokenIds: subscription.tokenIds,
      });
    } else if (confirmation.type === "unsubscribed") {
      this.logger.info(`Trade stream unsubscribed: ${subscriptionId}`);

      for (const tokenId of subscription.tokenIds) {
        this.tokenToSubscription.delete(tokenId);
      }
      this.subscriptions.delete(subscriptionId);
      this.connection.removeSubscription(subscriptionId);
      this.tradeBuffer.delete(subscriptionId);
    }
  }

  private handleTradeMessage(raw: RawTradeMessage): void {
    const trade = parseTradeMessage(raw, {
      largeTradeThreshold: this.config.largeTradeThreshold,
    });

    if (!trade) {
      this.logger.debug("Failed to parse trade message:", raw);
      return;
    }

    // Find the subscription
    const subscriptionId = this.tokenToSubscription.get(trade.assetId);
    if (!subscriptionId) {
      this.logger.debug("Trade for unknown token:", trade.assetId);
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Apply minimum size filter
    if (subscription.minSize !== undefined && trade.size < subscription.minSize) {
      return;
    }

    // Update subscription statistics
    subscription.lastTradeAt = new Date();
    subscription.tradeCount++;
    subscription.totalVolume += trade.size;
    subscription.totalValueUsd += trade.valueUsd;

    if (trade.side === "buy") {
      subscription.buyCount++;
      subscription.buyVolume += trade.size;
    } else {
      subscription.sellCount++;
      subscription.sellVolume += trade.size;
    }

    // Update global stats
    this.globalStats.totalTrades++;
    this.globalStats.totalVolume += trade.size;
    this.globalStats.totalValueUsd += trade.valueUsd;
    if (trade.isLargeTrade) {
      this.globalStats.largeTradesCount++;
    }

    // Store recent trades
    let recentTrades = subscription.recentTrades.get(trade.assetId);
    if (!recentTrades) {
      recentTrades = [];
      subscription.recentTrades.set(trade.assetId, recentTrades);
    }
    recentTrades.unshift(trade);

    // Trim to max
    if (recentTrades.length > this.config.maxTradesPerToken) {
      recentTrades.length = this.config.maxTradesPerToken;
    }

    // Emit large trade event if applicable
    if (trade.isLargeTrade) {
      this.emit("largeTrade", {
        type: "largeTrade",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        trade,
        sizeUsd: trade.valueUsd,
      });
    }

    // Handle buffering
    if (this.config.enableBuffering) {
      let buffer = this.tradeBuffer.get(subscriptionId);
      if (!buffer) {
        buffer = [];
        this.tradeBuffer.set(subscriptionId, buffer);
      }
      buffer.push(trade);

      // Flush if buffer is full
      if (buffer.length >= this.config.bufferSize) {
        this.flushBuffer(subscriptionId);
      }
    } else {
      // Emit immediately
      this.emit("trade", {
        type: "trade",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        trade,
      });
    }
  }

  private handleError(error: { type: "error"; error: string; message?: string }): void {
    const errorMessage = error.message ?? error.error;
    this.logger.error("Trade stream error:", errorMessage);

    this.emit("tradeStreamError", {
      type: "tradeStreamError",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      error: new Error(errorMessage),
      message: errorMessage,
    });
  }

  // ==========================================================================
  // Buffering
  // ==========================================================================

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushAllBuffers();
    }, this.config.flushInterval);
  }

  private flushBuffer(subscriptionId: string): void {
    const buffer = this.tradeBuffer.get(subscriptionId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const trades = [...buffer];
    buffer.length = 0;

    this.emit("tradeBatch", {
      type: "tradeBatch",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      subscriptionId,
      trades,
      count: trades.length,
    });
  }

  private flushAllBuffers(): void {
    for (const subscriptionId of this.tradeBuffer.keys()) {
      this.flushBuffer(subscriptionId);
    }
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Client has been disposed");
    }
    return this.connection.connect();
  }

  disconnect(): void {
    // Flush any remaining buffered trades
    this.flushAllBuffers();
    this.connection.disconnect();
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  getConnectionState(): ConnectionState {
    return this.connection.getState();
  }

  getConnectionId(): string {
    return this.connection.getId();
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  async subscribe(request: TradeStreamSubscriptionRequest): Promise<TradeStreamSubscriptionInfo> {
    if (this.disposed) {
      throw new Error("Client has been disposed");
    }

    if (!this.isConnected()) {
      throw new Error("Not connected. Call connect() first.");
    }

    const tokenIds = normalizeTokenIds(request.tokenIds);
    if (tokenIds.length === 0) {
      throw new Error("At least one token ID is required");
    }

    const subscriptionId = generateSubscriptionId();

    const subscription: TradeStreamSubscriptionInfo = {
      id: subscriptionId,
      tokenIds,
      createdAt: new Date(),
      confirmed: false,
      tradeCount: 0,
      totalVolume: 0,
      totalValueUsd: 0,
      buyCount: 0,
      sellCount: 0,
      buyVolume: 0,
      sellVolume: 0,
      recentTrades: new Map(),
      minSize: request.minSize,
      metadata: request.metadata,
    };

    this.subscriptions.set(subscriptionId, subscription);
    for (const tokenId of tokenIds) {
      this.tokenToSubscription.set(tokenId, subscriptionId);
    }

    const message = buildTradeSubscriptionMessage(tokenIds, "subscribe", subscriptionId);

    this.connection.addSubscription(subscriptionId, SubscriptionChannel.TRADES, message, {
      tokenIds,
      ...request.metadata,
    });

    const sent = this.connection.sendJson(message);
    if (!sent) {
      this.subscriptions.delete(subscriptionId);
      for (const tokenId of tokenIds) {
        this.tokenToSubscription.delete(tokenId);
      }
      this.connection.removeSubscription(subscriptionId);
      throw new Error("Failed to send subscription message");
    }

    this.logger.info(`Subscribing to trade stream for ${tokenIds.length} token(s)`);

    await this.waitForConfirmation(subscriptionId, this.config.confirmationTimeout);

    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Flush any buffered trades
    this.flushBuffer(subscriptionId);

    const message = buildTradeSubscriptionMessage(
      subscription.tokenIds,
      "unsubscribe",
      subscriptionId
    );

    this.connection.sendJson(message);

    for (const tokenId of subscription.tokenIds) {
      this.tokenToSubscription.delete(tokenId);
    }
    this.subscriptions.delete(subscriptionId);
    this.connection.removeSubscription(subscriptionId);
    this.tradeBuffer.delete(subscriptionId);

    this.logger.info(`Unsubscribed from trade stream: ${subscriptionId}`);
  }

  async unsubscribeToken(tokenId: string): Promise<void> {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    if (!subscriptionId) {
      throw new Error(`Token not subscribed: ${tokenId}`);
    }
    return this.unsubscribe(subscriptionId);
  }

  async unsubscribeAll(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const id of subscriptionIds) {
      await this.unsubscribe(id);
    }
  }

  async resubscribeAll(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.confirmed) {
        const message = buildTradeSubscriptionMessage(
          subscription.tokenIds,
          "subscribe",
          subscription.id
        );
        this.connection.sendJson(message);
      }
    }
  }

  private waitForConfirmation(subscriptionId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        reject(new Error(`Subscription not found: ${subscriptionId}`));
        return;
      }

      if (subscription.confirmed) {
        resolve();
        return;
      }

      const timeoutHandle = setTimeout(() => {
        this.pendingConfirmations.delete(subscriptionId);
        this.logger.warn(`Trade stream confirmation timeout for ${subscriptionId}, proceeding anyway`);
        subscription.confirmed = true;
        subscription.confirmedAt = new Date();
        resolve();
      }, timeout);

      this.pendingConfirmations.set(subscriptionId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });
    });
  }

  // ==========================================================================
  // Subscription Info
  // ==========================================================================

  getSubscription(subscriptionId: string): TradeStreamSubscriptionInfo | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getSubscriptionForToken(tokenId: string): TradeStreamSubscriptionInfo | undefined {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    return subscriptionId ? this.subscriptions.get(subscriptionId) : undefined;
  }

  getAllSubscriptions(): TradeStreamSubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }

  getSubscribedTokenIds(): string[] {
    return Array.from(this.tokenToSubscription.keys());
  }

  isTokenSubscribed(tokenId: string): boolean {
    return this.tokenToSubscription.has(tokenId);
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getSubscribedTokenCount(): number {
    return this.tokenToSubscription.size;
  }

  /**
   * Get recent trades for a token
   */
  getRecentTrades(tokenId: string, limit?: number): ParsedTrade[] {
    const subscription = this.getSubscriptionForToken(tokenId);
    if (!subscription) {
      return [];
    }

    const trades = subscription.recentTrades.get(tokenId) ?? [];
    return limit !== undefined ? trades.slice(0, limit) : trades;
  }

  /**
   * Get all recent trades across all tokens
   */
  getAllRecentTrades(limit?: number): ParsedTrade[] {
    const allTrades: ParsedTrade[] = [];

    for (const subscription of this.subscriptions.values()) {
      for (const trades of subscription.recentTrades.values()) {
        allTrades.push(...trades);
      }
    }

    // Sort by timestamp descending
    allTrades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit !== undefined ? allTrades.slice(0, limit) : allTrades;
  }

  /**
   * Get statistics for a subscription
   */
  getSubscriptionStats(subscriptionId: string): TradeStreamStats | null {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return null;
    }

    // Collect all trades
    const allTrades: ParsedTrade[] = [];
    for (const trades of subscription.recentTrades.values()) {
      allTrades.push(...trades);
    }

    return calculateTradeStreamStats(allTrades);
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): typeof this.globalStats {
    return { ...this.globalStats };
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  on<K extends TradeStreamEventKey>(
    event: K,
    listener: TradeStreamEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  off<K extends TradeStreamEventKey>(
    event: K,
    listener: TradeStreamEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  once<K extends TradeStreamEventKey>(
    event: K,
    listener: TradeStreamEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as TradeStreamEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as TradeStreamEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  removeAllListeners(event?: TradeStreamEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as TradeStreamEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  private emit<K extends TradeStreamEventKey>(
    event: K,
    data: Parameters<TradeStreamEventListenerMap[K][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`Error in ${event} listener:`, error);
      }
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining trades
    this.flushAllBuffers();

    // Clear pending confirmations
    for (const pending of this.pendingConfirmations.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingConfirmations.clear();

    // Clear subscriptions
    this.subscriptions.clear();
    this.tokenToSubscription.clear();
    this.tradeBuffer.clear();

    // Dispose connection
    this.connection.dispose();

    // Clear listeners
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new trade stream client
 */
export function createTradeStreamClient(
  config?: TradeStreamConfig,
  logger?: WebSocketLogger,
  WebSocketClass?: WebSocketConstructor
): TradeStreamClient {
  return new TradeStreamClient(config, logger, WebSocketClass);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedClient: TradeStreamClient | null = null;

/**
 * Get the shared trade stream client
 */
export function getSharedTradeStreamClient(): TradeStreamClient {
  if (!sharedClient) {
    sharedClient = createTradeStreamClient();
  }
  return sharedClient;
}

/**
 * Set the shared trade stream client
 */
export function setSharedTradeStreamClient(client: TradeStreamClient): void {
  if (sharedClient && sharedClient !== client) {
    sharedClient.dispose();
  }
  sharedClient = client;
}

/**
 * Reset the shared trade stream client
 */
export function resetSharedTradeStreamClient(): void {
  if (sharedClient) {
    sharedClient.dispose();
    sharedClient = null;
  }
}
