/**
 * Market Subscriptions Module (API-WS-003)
 *
 * Provides subscription management for real-time market price updates:
 * - Subscribe to market price updates
 * - Build Polymarket-compatible subscription messages
 * - Handle subscription confirmations
 * - Process and emit price update events
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

// ============================================================================
// Constants
// ============================================================================

/**
 * Polymarket WebSocket URL
 */
export const POLYMARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

/**
 * Subscription message types
 */
export const SubscriptionMessageType = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",
  PRICE_UPDATE: "price_update",
  BOOK_UPDATE: "book",
  TRADE: "trade",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
} as const;

export type SubscriptionMessageTypeValue = typeof SubscriptionMessageType[keyof typeof SubscriptionMessageType];

/**
 * Subscription channels
 */
export const SubscriptionChannel = {
  MARKET: "market",
  PRICE: "price",
  BOOK: "book",
  TRADES: "trades",
} as const;

export type SubscriptionChannelValue = typeof SubscriptionChannel[keyof typeof SubscriptionChannel];

// ============================================================================
// Types
// ============================================================================

/**
 * Market subscription request
 */
export interface MarketSubscriptionRequest {
  /** Market token ID(s) to subscribe to */
  tokenIds: string | string[];

  /** Subscription channel (default: "market") */
  channel?: SubscriptionChannelValue;

  /** Whether to include order book data */
  includeBook?: boolean;

  /** Whether to include trade data */
  includeTrades?: boolean;

  /** Custom metadata for the subscription */
  metadata?: Record<string, unknown>;
}

/**
 * Subscription message sent to the WebSocket
 */
export interface SubscriptionMessage {
  /** Message type (subscribe/unsubscribe) */
  type: SubscriptionMessageTypeValue;

  /** Channel to subscribe to */
  channel?: SubscriptionChannelValue;

  /** Market/token IDs */
  assets_ids?: string[];

  /** Single market/token ID (legacy format) */
  market?: string;

  /** Subscription ID for tracking */
  id?: string;
}

/**
 * Subscription confirmation response
 */
export interface SubscriptionConfirmation {
  /** Confirmation type */
  type: "subscribed" | "unsubscribed";

  /** Channel that was subscribed/unsubscribed */
  channel?: string;

  /** Market IDs that were subscribed/unsubscribed */
  assets_ids?: string[];

  /** Single market ID (legacy format) */
  market?: string;

  /** Subscription ID */
  id?: string;

  /** Timestamp */
  timestamp?: string | number;

  /** Whether the subscription was successful */
  success?: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Price update message from the WebSocket
 */
export interface PriceUpdate {
  /** Message type */
  type: "price_update";

  /** Market/token ID */
  asset_id: string;

  /** Current price (0-1) */
  price: number;

  /** Previous price (0-1) */
  previous_price?: number;

  /** Price change (0-1) */
  price_change?: number;

  /** Price change percentage */
  price_change_percent?: number;

  /** Current bid price */
  bid?: number;

  /** Current ask price */
  ask?: number;

  /** Spread */
  spread?: number;

  /** Last trade price */
  last_trade_price?: number;

  /** Volume */
  volume?: number;

  /** Volume in the last 24 hours */
  volume_24h?: number;

  /** Timestamp */
  timestamp: string | number;

  /** Sequence number for ordering */
  sequence?: number;
}

/**
 * Parsed price update with computed fields
 */
export interface ParsedPriceUpdate extends PriceUpdate {
  /** Price as probability (0-100%) */
  probability: number;

  /** Previous probability (0-100%) */
  previousProbability?: number;

  /** Probability change */
  probabilityChange?: number;

  /** Mid price (average of bid and ask) */
  midPrice?: number;

  /** Parsed timestamp as Date */
  parsedTimestamp: Date;

  /** Received timestamp */
  receivedAt: Date;

  /** Whether this is a significant price change (>1%) */
  isSignificant: boolean;
}

/**
 * Market subscription info
 */
export interface MarketSubscriptionInfo {
  /** Subscription ID */
  id: string;

  /** Subscribed token IDs */
  tokenIds: string[];

  /** Subscription channel */
  channel: SubscriptionChannelValue;

  /** When the subscription was created */
  createdAt: Date;

  /** Whether the subscription is confirmed */
  confirmed: boolean;

  /** When the subscription was confirmed */
  confirmedAt?: Date;

  /** Last update received */
  lastUpdateAt?: Date;

  /** Number of updates received */
  updateCount: number;

  /** Current prices by token ID */
  prices: Map<string, ParsedPriceUpdate>;

  /** Subscription metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Price update event
 */
export interface PriceUpdateEvent {
  type: "priceUpdate";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  update: ParsedPriceUpdate;
}

/**
 * Subscription confirmed event
 */
export interface SubscriptionConfirmedEvent {
  type: "subscriptionConfirmed";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  tokenIds: string[];
  channel: SubscriptionChannelValue;
}

/**
 * Subscription error event
 */
export interface SubscriptionErrorEvent {
  type: "subscriptionError";
  connectionId: string;
  timestamp: Date;
  subscriptionId?: string;
  tokenIds?: string[];
  error: Error;
  message: string;
}

/**
 * Significant price change event
 */
export interface SignificantPriceChangeEvent {
  type: "significantPriceChange";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  tokenId: string;
  update: ParsedPriceUpdate;
  priceChange: number;
  probabilityChange: number;
}

/**
 * Market subscription configuration
 */
export interface MarketSubscriptionConfig extends Partial<WebSocketConfig> {
  /** Polymarket WebSocket URL (default: wss://ws-subscriptions-clob.polymarket.com/ws/market) */
  wsUrl?: string;

  /** Significant price change threshold (0-1, default: 0.01 = 1%) */
  significantChangeThreshold?: number;

  /** Whether to auto-subscribe on connect (default: false) */
  autoSubscribe?: boolean;

  /** Token IDs to auto-subscribe to */
  autoSubscribeTokenIds?: string[];

  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event listener map for market subscriptions
 */
export interface MarketSubscriptionEventListenerMap {
  priceUpdate: ((event: PriceUpdateEvent) => void)[];
  subscriptionConfirmed: ((event: SubscriptionConfirmedEvent) => void)[];
  subscriptionError: ((event: SubscriptionErrorEvent) => void)[];
  significantPriceChange: ((event: SignificantPriceChangeEvent) => void)[];
  connected: ((event: { connectionId: string; timestamp: Date }) => void)[];
  disconnected: ((event: { connectionId: string; timestamp: Date; code: number; reason: string }) => void)[];
  reconnecting: ((event: { connectionId: string; timestamp: Date; attempt: number }) => void)[];
}

type MarketSubscriptionEventKey = keyof MarketSubscriptionEventListenerMap;

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
 * Generate a unique subscription ID
 */
export function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Normalize token IDs to an array
 */
export function normalizeTokenIds(tokenIds: string | string[]): string[] {
  if (typeof tokenIds === "string") {
    return [tokenIds];
  }
  return [...tokenIds];
}

/**
 * Build a subscription message for the Polymarket WebSocket
 */
export function buildSubscriptionMessage(
  tokenIds: string[],
  type: "subscribe" | "unsubscribe" = "subscribe",
  channel: SubscriptionChannelValue = "market",
  subscriptionId?: string
): SubscriptionMessage {
  const message: SubscriptionMessage = {
    type: type === "subscribe" ? SubscriptionMessageType.SUBSCRIBE : SubscriptionMessageType.UNSUBSCRIBE,
  };

  // Use assets_ids for multiple tokens, market for single token
  if (tokenIds.length === 1 && tokenIds[0]) {
    message.market = tokenIds[0];
  } else if (tokenIds.length > 0) {
    message.assets_ids = tokenIds;
  }

  if (channel !== "market") {
    message.channel = channel;
  }

  if (subscriptionId) {
    message.id = subscriptionId;
  }

  return message;
}

/**
 * Parse a timestamp from a message
 */
export function parseMessageTimestamp(timestamp: string | number | undefined): Date {
  if (!timestamp) {
    return new Date();
  }

  if (typeof timestamp === "number") {
    // Unix timestamp - could be seconds or milliseconds
    if (timestamp < 10000000000) {
      return new Date(timestamp * 1000);
    }
    return new Date(timestamp);
  }

  // ISO string
  const parsed = new Date(timestamp);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parse a raw price update message into a ParsedPriceUpdate
 */
export function parsePriceUpdate(
  raw: Record<string, unknown>,
  significantThreshold: number = 0.01
): ParsedPriceUpdate | null {
  // Extract asset_id with fallbacks
  const assetId = (raw.asset_id ?? raw.market ?? raw.token_id ?? raw.id) as string | undefined;
  if (!assetId) {
    return null;
  }

  // Extract price with fallbacks
  let price: number | string | undefined = raw.price as number | string | undefined;
  if (price === undefined) {
    price = (raw.mid ?? raw.mid_price ?? raw.last_price) as number | string | undefined;
  }
  if (price === undefined) {
    return null;
  }

  const priceNum = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(priceNum)) {
    return null;
  }

  // Extract other fields
  const previousPrice = raw.previous_price ?? raw.prev_price ?? raw.last_price;
  const previousPriceNum = previousPrice !== undefined
    ? (typeof previousPrice === "string" ? parseFloat(previousPrice as string) : previousPrice as number)
    : undefined;

  const bid = raw.bid as number | undefined;
  const ask = raw.ask as number | undefined;
  const midPrice = (bid !== undefined && ask !== undefined) ? (bid + ask) / 2 : undefined;

  const timestamp = parseMessageTimestamp(raw.timestamp as string | number | undefined);
  const receivedAt = new Date();

  // Calculate probability (price is 0-1, probability is 0-100)
  const probability = priceNum * 100;
  const previousProbability = previousPriceNum !== undefined && !isNaN(previousPriceNum)
    ? previousPriceNum * 100
    : undefined;

  // Calculate changes
  let priceChange: number | undefined;
  let priceChangePercent: number | undefined;
  let probabilityChange: number | undefined;

  if (previousPriceNum !== undefined && !isNaN(previousPriceNum)) {
    priceChange = priceNum - previousPriceNum;
    priceChangePercent = previousPriceNum !== 0 ? (priceChange / previousPriceNum) * 100 : 0;
    probabilityChange = probability - (previousProbability ?? 0);
  } else if (raw.price_change !== undefined) {
    priceChange = raw.price_change as number;
    priceChangePercent = raw.price_change_percent as number;
    probabilityChange = priceChange !== undefined ? priceChange * 100 : undefined;
  }

  // Determine if this is a significant change
  const isSignificant = priceChange !== undefined && Math.abs(priceChange) >= significantThreshold;

  const parsed: ParsedPriceUpdate = {
    type: "price_update",
    asset_id: assetId,
    price: priceNum,
    previous_price: previousPriceNum,
    price_change: priceChange,
    price_change_percent: priceChangePercent,
    bid: bid,
    ask: ask,
    spread: raw.spread as number | undefined,
    last_trade_price: raw.last_trade_price as number | undefined,
    volume: raw.volume as number | undefined,
    volume_24h: raw.volume_24h as number | undefined,
    timestamp: raw.timestamp as string | number ?? timestamp.toISOString(),
    sequence: raw.sequence as number | undefined,
    probability,
    previousProbability,
    probabilityChange,
    midPrice,
    parsedTimestamp: timestamp,
    receivedAt,
    isSignificant,
  };

  return parsed;
}

/**
 * Check if a message is a subscription confirmation
 */
export function isSubscriptionConfirmation(message: unknown): message is SubscriptionConfirmation {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const msg = message as Record<string, unknown>;
  return msg.type === "subscribed" || msg.type === "unsubscribed";
}

/**
 * Check if a message is a price update
 */
export function isPriceUpdateMessage(message: unknown): boolean {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const msg = message as Record<string, unknown>;
  return (
    msg.type === "price_update" ||
    msg.type === "book" ||
    // Some messages don't have type but have price data
    (msg.price !== undefined && (msg.asset_id !== undefined || msg.market !== undefined))
  );
}

/**
 * Check if a message is an error
 */
export function isErrorMessage(message: unknown): message is { type: "error"; error: string; message?: string } {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const msg = message as Record<string, unknown>;
  return msg.type === "error";
}

// ============================================================================
// MarketSubscriptionClient Class
// ============================================================================

/**
 * Client for subscribing to real-time market price updates from Polymarket
 */
export class MarketSubscriptionClient {
  private connection: ReconnectableConnection;
  private readonly config: Required<Pick<MarketSubscriptionConfig, "significantChangeThreshold" | "autoSubscribe" | "debug">>;
  private readonly logger: WebSocketLogger;

  private readonly subscriptions: Map<string, MarketSubscriptionInfo> = new Map();
  private readonly tokenToSubscription: Map<string, string> = new Map();
  private pendingConfirmations: Map<string, { resolve: () => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private disposed = false;

  private readonly listeners: MarketSubscriptionEventListenerMap = {
    priceUpdate: [],
    subscriptionConfirmed: [],
    subscriptionError: [],
    significantPriceChange: [],
    connected: [],
    disconnected: [],
    reconnecting: [],
  };

  constructor(
    config: MarketSubscriptionConfig = {},
    logger: WebSocketLogger = defaultLogger,
    WebSocketClass?: WebSocketConstructor
  ) {
    this.logger = config.debug ? {
      debug: console.log.bind(console, "[MarketSubscription]"),
      info: console.log.bind(console, "[MarketSubscription]"),
      warn: console.warn.bind(console, "[MarketSubscription]"),
      error: console.error.bind(console, "[MarketSubscription]"),
    } : logger;

    this.config = {
      significantChangeThreshold: config.significantChangeThreshold ?? 0.01,
      autoSubscribe: config.autoSubscribe ?? false,
      debug: config.debug ?? false,
    };

    // Create the WebSocket connection
    this.connection = createReconnectableConnection(
      {
        url: config.wsUrl ?? POLYMARKET_WS_URL,
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
  }

  // ==========================================================================
  // Event Setup
  // ==========================================================================

  private setupEventHandlers(): void {
    // Handle successful connection
    this.connection.on("open", (event) => {
      this.logger.info(`Connected to ${event.url}`);
      this.emit("connected", {
        connectionId: event.connectionId,
        timestamp: event.timestamp,
      });

      // Auto-subscribe if configured
      if (this.config.autoSubscribe) {
        this.resubscribeAll();
      }
    });

    // Handle disconnection
    this.connection.on("close", (event) => {
      this.logger.info(`Disconnected: ${event.reason} (code: ${event.code})`);

      // Mark all subscriptions as unconfirmed
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

    // Handle reconnection attempts
    this.connection.on("reconnect", (event) => {
      this.logger.info(`Reconnecting... attempt ${event.attempt}/${event.maxAttempts}`);
      this.emit("reconnecting", {
        connectionId: event.connectionId,
        timestamp: event.timestamp,
        attempt: event.attempt,
      });
    });

    // Handle incoming messages
    this.connection.on("message", (event) => {
      this.handleMessage(event.json);
    });

    // Handle subscription restoration
    this.connection.on("subscriptionsRestored", (event) => {
      this.logger.info(`Subscriptions restored: ${event.successful}/${event.total}`);
    });

    // Handle errors
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

    // Handle price updates
    if (isPriceUpdateMessage(data)) {
      this.handlePriceUpdate(data as Record<string, unknown>);
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
    // Find the subscription by ID or token IDs
    let subscriptionId = confirmation.id;
    let subscription: MarketSubscriptionInfo | undefined;

    if (subscriptionId) {
      subscription = this.subscriptions.get(subscriptionId);
    } else {
      // Try to find by token IDs
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

      this.logger.info(`Subscription confirmed: ${subscriptionId} (${subscription.tokenIds.join(", ")})`);

      // Resolve pending confirmation promise
      const pending = this.pendingConfirmations.get(subscriptionId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingConfirmations.delete(subscriptionId);
      }

      this.emit("subscriptionConfirmed", {
        type: "subscriptionConfirmed",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        tokenIds: subscription.tokenIds,
        channel: subscription.channel,
      });
    } else if (confirmation.type === "unsubscribed") {
      // Handle unsubscription
      this.logger.info(`Unsubscribed: ${subscriptionId}`);

      // Clean up
      for (const tokenId of subscription.tokenIds) {
        this.tokenToSubscription.delete(tokenId);
      }
      this.subscriptions.delete(subscriptionId);
      this.connection.removeSubscription(subscriptionId);
    }
  }

  private handlePriceUpdate(raw: Record<string, unknown>): void {
    const update = parsePriceUpdate(raw, this.config.significantChangeThreshold);
    if (!update) {
      this.logger.debug("Failed to parse price update:", raw);
      return;
    }

    // Find the subscription for this token
    const subscriptionId = this.tokenToSubscription.get(update.asset_id);
    if (!subscriptionId) {
      // Could be a broadcast update not tied to a specific subscription
      this.logger.debug("Price update for unknown token:", update.asset_id);
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Update subscription state
    subscription.lastUpdateAt = new Date();
    subscription.updateCount++;
    subscription.prices.set(update.asset_id, update);

    // Emit price update event
    this.emit("priceUpdate", {
      type: "priceUpdate",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      subscriptionId,
      update,
    });

    // Emit significant price change event if applicable
    if (update.isSignificant) {
      this.emit("significantPriceChange", {
        type: "significantPriceChange",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        tokenId: update.asset_id,
        update,
        priceChange: update.price_change ?? 0,
        probabilityChange: update.probabilityChange ?? 0,
      });
    }
  }

  private handleError(error: { type: "error"; error: string; message?: string }): void {
    const errorMessage = error.message ?? error.error;
    this.logger.error("Subscription error:", errorMessage);

    this.emit("subscriptionError", {
      type: "subscriptionError",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      error: new Error(errorMessage),
      message: errorMessage,
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Client has been disposed");
    }
    return this.connection.connect();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.connection.disconnect();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connection.getState();
  }

  /**
   * Get connection ID
   */
  getConnectionId(): string {
    return this.connection.getId();
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Subscribe to real-time price updates for one or more markets
   */
  async subscribe(request: MarketSubscriptionRequest): Promise<MarketSubscriptionInfo> {
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

    const channel = request.channel ?? SubscriptionChannel.MARKET;
    const subscriptionId = generateSubscriptionId();

    // Create subscription info
    const subscription: MarketSubscriptionInfo = {
      id: subscriptionId,
      tokenIds,
      channel,
      createdAt: new Date(),
      confirmed: false,
      updateCount: 0,
      prices: new Map(),
      metadata: request.metadata,
    };

    // Track subscription
    this.subscriptions.set(subscriptionId, subscription);
    for (const tokenId of tokenIds) {
      this.tokenToSubscription.set(tokenId, subscriptionId);
    }

    // Build and send subscription message
    const message = buildSubscriptionMessage(tokenIds, "subscribe", channel, subscriptionId);

    // Register with the underlying connection for auto-restore
    this.connection.addSubscription(subscriptionId, channel, message, {
      tokenIds,
      ...request.metadata,
    });

    // Send the subscription message
    const sent = this.connection.sendJson(message);
    if (!sent) {
      // Clean up on failure
      this.subscriptions.delete(subscriptionId);
      for (const tokenId of tokenIds) {
        this.tokenToSubscription.delete(tokenId);
      }
      this.connection.removeSubscription(subscriptionId);
      throw new Error("Failed to send subscription message");
    }

    this.logger.info(`Subscribing to ${tokenIds.length} token(s): ${tokenIds.join(", ")}`);

    // Wait for confirmation with timeout
    await this.waitForConfirmation(subscriptionId, 10000);

    return subscription;
  }

  /**
   * Unsubscribe from a market subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const message = buildSubscriptionMessage(
      subscription.tokenIds,
      "unsubscribe",
      subscription.channel,
      subscriptionId
    );

    this.connection.sendJson(message);

    // Clean up immediately (don't wait for confirmation)
    for (const tokenId of subscription.tokenIds) {
      this.tokenToSubscription.delete(tokenId);
    }
    this.subscriptions.delete(subscriptionId);
    this.connection.removeSubscription(subscriptionId);

    this.logger.info(`Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Unsubscribe from a specific token
   */
  async unsubscribeToken(tokenId: string): Promise<void> {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    if (!subscriptionId) {
      throw new Error(`Token not subscribed: ${tokenId}`);
    }
    return this.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe from all subscriptions
   */
  async unsubscribeAll(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const id of subscriptionIds) {
      await this.unsubscribe(id);
    }
  }

  /**
   * Re-subscribe to all active subscriptions (e.g., after reconnect)
   */
  async resubscribeAll(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.confirmed) {
        const message = buildSubscriptionMessage(
          subscription.tokenIds,
          "subscribe",
          subscription.channel,
          subscription.id
        );
        this.connection.sendJson(message);
      }
    }
  }

  /**
   * Wait for subscription confirmation
   */
  private waitForConfirmation(subscriptionId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        reject(new Error(`Subscription not found: ${subscriptionId}`));
        return;
      }

      // Check if already confirmed
      if (subscription.confirmed) {
        resolve();
        return;
      }

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingConfirmations.delete(subscriptionId);
        // Don't reject - just resolve since the subscription might still work
        // Some WebSocket servers don't send explicit confirmations
        this.logger.warn(`Subscription confirmation timeout for ${subscriptionId}, proceeding anyway`);
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

  /**
   * Get a subscription by ID
   */
  getSubscription(subscriptionId: string): MarketSubscriptionInfo | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get subscription for a token
   */
  getSubscriptionForToken(tokenId: string): MarketSubscriptionInfo | undefined {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    return subscriptionId ? this.subscriptions.get(subscriptionId) : undefined;
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): MarketSubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get all subscribed token IDs
   */
  getSubscribedTokenIds(): string[] {
    return Array.from(this.tokenToSubscription.keys());
  }

  /**
   * Check if a token is subscribed
   */
  isTokenSubscribed(tokenId: string): boolean {
    return this.tokenToSubscription.has(tokenId);
  }

  /**
   * Get the current price for a token
   */
  getCurrentPrice(tokenId: string): ParsedPriceUpdate | undefined {
    const subscription = this.getSubscriptionForToken(tokenId);
    return subscription?.prices.get(tokenId);
  }

  /**
   * Get all current prices
   */
  getAllCurrentPrices(): Map<string, ParsedPriceUpdate> {
    const prices = new Map<string, ParsedPriceUpdate>();
    for (const subscription of this.subscriptions.values()) {
      for (const [tokenId, price] of subscription.prices) {
        prices.set(tokenId, price);
      }
    }
    return prices;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscribed token count
   */
  getSubscribedTokenCount(): number {
    return this.tokenToSubscription.size;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<K extends MarketSubscriptionEventKey>(
    event: K,
    listener: MarketSubscriptionEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends MarketSubscriptionEventKey>(
    event: K,
    listener: MarketSubscriptionEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends MarketSubscriptionEventKey>(
    event: K,
    listener: MarketSubscriptionEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as MarketSubscriptionEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as MarketSubscriptionEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: MarketSubscriptionEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as MarketSubscriptionEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  private emit<K extends MarketSubscriptionEventKey>(
    event: K,
    data: Parameters<MarketSubscriptionEventListenerMap[K][number]>[0]
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

  /**
   * Dispose of the client and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clear pending confirmations
    for (const pending of this.pendingConfirmations.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingConfirmations.clear();

    // Clear subscriptions
    this.subscriptions.clear();
    this.tokenToSubscription.clear();

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
 * Create a new market subscription client
 */
export function createMarketSubscriptionClient(
  config?: MarketSubscriptionConfig,
  logger?: WebSocketLogger,
  WebSocketClass?: WebSocketConstructor
): MarketSubscriptionClient {
  return new MarketSubscriptionClient(config, logger, WebSocketClass);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedClient: MarketSubscriptionClient | null = null;

/**
 * Get the shared market subscription client
 */
export function getSharedMarketSubscriptionClient(): MarketSubscriptionClient {
  if (!sharedClient) {
    sharedClient = createMarketSubscriptionClient();
  }
  return sharedClient;
}

/**
 * Set the shared market subscription client
 */
export function setSharedMarketSubscriptionClient(client: MarketSubscriptionClient): void {
  if (sharedClient && sharedClient !== client) {
    sharedClient.dispose();
  }
  sharedClient = client;
}

/**
 * Reset the shared market subscription client
 */
export function resetSharedMarketSubscriptionClient(): void {
  if (sharedClient) {
    sharedClient.dispose();
    sharedClient = null;
  }
}
