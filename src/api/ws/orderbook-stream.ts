/**
 * Order Book Stream Module (API-WS-005)
 *
 * Provides real-time order book update subscription:
 * - Subscribe to order book changes for specific markets
 * - Handle delta updates to maintain local order book state
 * - Emit order book events to listeners
 * - Track order book statistics
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
 * Polymarket WebSocket URL for order book streams
 */
export const POLYMARKET_BOOK_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

/**
 * Default max levels to track in order book
 */
export const DEFAULT_MAX_BOOK_LEVELS = 100;

/**
 * Default snapshot interval in milliseconds
 */
export const DEFAULT_SNAPSHOT_INTERVAL = 30000;

// ============================================================================
// Types
// ============================================================================

/**
 * Order book side
 */
export type BookSide = "bid" | "ask";

/**
 * Delta update type
 */
export type DeltaType = "add" | "update" | "remove";

/**
 * Raw order book level from WebSocket
 */
export interface RawBookLevel {
  /** Price (0-1) */
  price?: number | string;
  p?: number | string;

  /** Size */
  size?: number | string;
  s?: number | string;
  quantity?: number | string;
  q?: number | string;

  /** Side (bid/ask, buy/sell) */
  side?: string;

  /** Number of orders at this level */
  count?: number;
  num_orders?: number;
  orders?: number;
}

/**
 * Raw order book update message
 */
export interface RawBookUpdateMessage {
  /** Message type */
  type?: "book" | "book_update" | "orderbook" | string;

  /** Asset/token ID */
  asset_id?: string;
  market?: string;
  token_id?: string;

  /** Bids array */
  bids?: RawBookLevel[];
  buys?: RawBookLevel[];

  /** Asks array */
  asks?: RawBookLevel[];
  sells?: RawBookLevel[];

  /** Full snapshot flag */
  is_snapshot?: boolean;
  snapshot?: boolean;

  /** Delta updates (alternative format) */
  deltas?: {
    side: string;
    price: number | string;
    size: number | string;
    type?: DeltaType;
  }[];

  /** Timestamp */
  timestamp?: string | number;

  /** Sequence number */
  sequence?: number;

  /** Hash of the order book state */
  hash?: string;
  checksum?: string;
}

/**
 * Parsed order book level
 */
export interface ParsedBookLevel {
  /** Price (0-1) */
  price: number;

  /** Size at this level */
  size: number;

  /** Number of orders at this level */
  orderCount: number;

  /** Cumulative size from best price to this level */
  cumulativeSize: number;

  /** Cumulative value (price * size) from best price */
  cumulativeValue: number;

  /** Percentage of total side volume */
  percentOfTotal: number;
}

/**
 * Local order book state
 */
export interface OrderBookState {
  /** Asset/token ID */
  assetId: string;

  /** Bid levels (sorted by price descending) */
  bids: ParsedBookLevel[];

  /** Ask levels (sorted by price ascending) */
  asks: ParsedBookLevel[];

  /** Best bid price */
  bestBid?: number;

  /** Best ask price */
  bestAsk?: number;

  /** Mid price */
  midPrice?: number;

  /** Spread */
  spread?: number;

  /** Spread percentage */
  spreadPercent?: number;

  /** Total bid volume */
  totalBidVolume: number;

  /** Total ask volume */
  totalAskVolume: number;

  /** Volume imbalance ratio (bid / ask) */
  volumeImbalance: number;

  /** Last update timestamp */
  lastUpdate: Date;

  /** Sequence number */
  sequence?: number;

  /** Hash/checksum */
  hash?: string;

  /** Whether this is from a full snapshot */
  isSnapshot: boolean;

  /** Number of updates applied */
  updateCount: number;
}

/**
 * Order book subscription request
 */
export interface OrderBookSubscriptionRequest {
  /** Token ID(s) to subscribe to */
  tokenIds: string | string[];

  /** Maximum levels to track per side (default: 100) */
  maxLevels?: number;

  /** Whether to request full snapshots periodically */
  enableSnapshots?: boolean;

  /** Snapshot interval in ms (default: 30000) */
  snapshotInterval?: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Order book subscription info
 */
export interface OrderBookSubscriptionInfo {
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

  /** Last update received */
  lastUpdateAt?: Date;

  /** Total updates received */
  updateCount: number;

  /** Total snapshots received */
  snapshotCount: number;

  /** Current order book states by token ID */
  orderBooks: Map<string, OrderBookState>;

  /** Max levels to track */
  maxLevels: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Order book update event
 */
export interface OrderBookUpdateEvent {
  type: "orderBookUpdate";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  assetId: string;
  orderBook: OrderBookState;
  isSnapshot: boolean;
  levelChanges: {
    side: BookSide;
    price: number;
    oldSize: number;
    newSize: number;
    deltaType: DeltaType;
  }[];
}

/**
 * Order book snapshot event
 */
export interface OrderBookSnapshotEvent {
  type: "orderBookSnapshot";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  assetId: string;
  orderBook: OrderBookState;
}

/**
 * Spread change event
 */
export interface SpreadChangeEvent {
  type: "spreadChange";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  assetId: string;
  oldSpread?: number;
  newSpread: number;
  oldSpreadPercent?: number;
  newSpreadPercent: number;
  significantChange: boolean;
}

/**
 * Book imbalance event (significant volume imbalance)
 */
export interface BookImbalanceEvent {
  type: "bookImbalance";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  assetId: string;
  imbalanceRatio: number;
  totalBidVolume: number;
  totalAskVolume: number;
  direction: "bid_heavy" | "ask_heavy" | "balanced";
}

/**
 * Order book confirmed event
 */
export interface OrderBookConfirmedEvent {
  type: "orderBookConfirmed";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  tokenIds: string[];
}

/**
 * Order book error event
 */
export interface OrderBookErrorEvent {
  type: "orderBookError";
  connectionId: string;
  timestamp: Date;
  subscriptionId?: string;
  error: Error;
  message: string;
}

/**
 * Order book statistics
 */
export interface OrderBookStats {
  /** Asset ID */
  assetId: string;

  /** Best bid */
  bestBid?: number;

  /** Best ask */
  bestAsk?: number;

  /** Mid price */
  midPrice?: number;

  /** Spread */
  spread?: number;

  /** Spread percentage */
  spreadPercent?: number;

  /** Total bid volume */
  totalBidVolume: number;

  /** Total ask volume */
  totalAskVolume: number;

  /** Volume imbalance */
  volumeImbalance: number;

  /** Bid levels count */
  bidLevelsCount: number;

  /** Ask levels count */
  askLevelsCount: number;

  /** Volume at top 5 levels (bids) */
  topBidVolume: number;

  /** Volume at top 5 levels (asks) */
  topAskVolume: number;

  /** Weighted average bid price */
  weightedAvgBid?: number;

  /** Weighted average ask price */
  weightedAvgAsk?: number;

  /** Updates received */
  updateCount: number;

  /** Last update timestamp */
  lastUpdate: Date;
}

/**
 * Order book stream configuration
 */
export interface OrderBookStreamConfig extends Partial<WebSocketConfig> {
  /** WebSocket URL */
  wsUrl?: string;

  /** Max levels to track per side (default: 100) */
  maxLevels?: number;

  /** Spread change threshold for events (default: 0.001 = 0.1%) */
  spreadChangeThreshold?: number;

  /** Imbalance threshold for events (default: 2.0 = 2:1 ratio) */
  imbalanceThreshold?: number;

  /** Timeout for subscription confirmation in ms (default: 10000) */
  confirmationTimeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event listener map for order book stream
 */
export interface OrderBookStreamEventListenerMap {
  orderBookUpdate: ((event: OrderBookUpdateEvent) => void)[];
  orderBookSnapshot: ((event: OrderBookSnapshotEvent) => void)[];
  spreadChange: ((event: SpreadChangeEvent) => void)[];
  bookImbalance: ((event: BookImbalanceEvent) => void)[];
  orderBookConfirmed: ((event: OrderBookConfirmedEvent) => void)[];
  orderBookError: ((event: OrderBookErrorEvent) => void)[];
  connected: ((event: { connectionId: string; timestamp: Date }) => void)[];
  disconnected: ((event: { connectionId: string; timestamp: Date; code: number; reason: string }) => void)[];
  reconnecting: ((event: { connectionId: string; timestamp: Date; attempt: number }) => void)[];
}

type OrderBookStreamEventKey = keyof OrderBookStreamEventListenerMap;

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
 * Parse a raw book level into a ParsedBookLevel
 */
export function parseBookLevel(raw: RawBookLevel): ParsedBookLevel | null {
  // Extract price
  const priceRaw = raw.price ?? raw.p;
  if (priceRaw === undefined || priceRaw === null) {
    return null;
  }
  const price = typeof priceRaw === "string" ? parseFloat(priceRaw) : priceRaw;
  if (isNaN(price)) {
    return null;
  }

  // Extract size
  const sizeRaw = raw.size ?? raw.s ?? raw.quantity ?? raw.q;
  if (sizeRaw === undefined || sizeRaw === null) {
    return null;
  }
  const size = typeof sizeRaw === "string" ? parseFloat(sizeRaw) : sizeRaw;
  if (isNaN(size) || size < 0) {
    return null;
  }

  // Extract order count
  const orderCount = raw.count ?? raw.num_orders ?? raw.orders ?? 1;

  return {
    price,
    size,
    orderCount,
    cumulativeSize: 0, // Will be calculated later
    cumulativeValue: 0, // Will be calculated later
    percentOfTotal: 0, // Will be calculated later
  };
}

/**
 * Parse side from various formats
 */
export function parseBookSide(side: string | undefined): BookSide | null {
  if (!side) return null;

  const normalized = side.toLowerCase().trim();

  if (normalized === "bid" || normalized === "buy" || normalized === "b") {
    return "bid";
  }

  if (normalized === "ask" || normalized === "sell" || normalized === "s" || normalized === "offer") {
    return "ask";
  }

  return null;
}

/**
 * Check if a message is an order book update
 */
export function isOrderBookMessage(message: unknown): message is RawBookUpdateMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;

  // Check for book message type
  if (msg.type === "book" || msg.type === "book_update" || msg.type === "orderbook") {
    return true;
  }

  // Check for order book data structure
  const hasBids = Array.isArray(msg.bids) || Array.isArray(msg.buys);
  const hasAsks = Array.isArray(msg.asks) || Array.isArray(msg.sells);
  const hasDeltas = Array.isArray(msg.deltas);

  return (hasBids || hasAsks || hasDeltas);
}

/**
 * Build an order book subscription message
 */
export function buildBookSubscriptionMessage(
  tokenIds: string[],
  type: "subscribe" | "unsubscribe" = "subscribe",
  subscriptionId?: string
): SubscriptionMessage {
  const message: SubscriptionMessage = {
    type: type === "subscribe" ? SubscriptionMessageType.SUBSCRIBE : SubscriptionMessageType.UNSUBSCRIBE,
    channel: SubscriptionChannel.BOOK,
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
 * Calculate order book statistics
 */
export function calculateOrderBookStats(orderBook: OrderBookState): OrderBookStats {
  let topBidVolume = 0;
  let topAskVolume = 0;
  let weightedBidSum = 0;
  let weightedAskSum = 0;

  // Calculate top 5 levels volume
  for (let i = 0; i < Math.min(5, orderBook.bids.length); i++) {
    const level = orderBook.bids[i];
    if (level) {
      topBidVolume += level.size;
    }
  }

  for (let i = 0; i < Math.min(5, orderBook.asks.length); i++) {
    const level = orderBook.asks[i];
    if (level) {
      topAskVolume += level.size;
    }
  }

  // Calculate weighted average prices
  for (const level of orderBook.bids) {
    weightedBidSum += level.price * level.size;
  }

  for (const level of orderBook.asks) {
    weightedAskSum += level.price * level.size;
  }

  const weightedAvgBid = orderBook.totalBidVolume > 0
    ? weightedBidSum / orderBook.totalBidVolume
    : undefined;

  const weightedAvgAsk = orderBook.totalAskVolume > 0
    ? weightedAskSum / orderBook.totalAskVolume
    : undefined;

  return {
    assetId: orderBook.assetId,
    bestBid: orderBook.bestBid,
    bestAsk: orderBook.bestAsk,
    midPrice: orderBook.midPrice,
    spread: orderBook.spread,
    spreadPercent: orderBook.spreadPercent,
    totalBidVolume: orderBook.totalBidVolume,
    totalAskVolume: orderBook.totalAskVolume,
    volumeImbalance: orderBook.volumeImbalance,
    bidLevelsCount: orderBook.bids.length,
    askLevelsCount: orderBook.asks.length,
    topBidVolume,
    topAskVolume,
    weightedAvgBid,
    weightedAvgAsk,
    updateCount: orderBook.updateCount,
    lastUpdate: orderBook.lastUpdate,
  };
}

/**
 * Create an empty order book state
 */
export function createEmptyOrderBook(assetId: string): OrderBookState {
  return {
    assetId,
    bids: [],
    asks: [],
    totalBidVolume: 0,
    totalAskVolume: 0,
    volumeImbalance: 1,
    lastUpdate: new Date(),
    isSnapshot: false,
    updateCount: 0,
  };
}

/**
 * Apply levels and recalculate cumulative values
 */
function applyLevelsToSide(
  levels: ParsedBookLevel[],
  side: BookSide,
  maxLevels: number
): ParsedBookLevel[] {
  // Sort levels
  const sorted = [...levels].sort((a, b) =>
    side === "bid" ? b.price - a.price : a.price - b.price
  );

  // Trim to max levels
  const trimmed = sorted.slice(0, maxLevels);

  // Calculate totals
  let totalSize = 0;
  for (const level of trimmed) {
    totalSize += level.size;
  }

  // Calculate cumulative values
  let cumSize = 0;
  let cumValue = 0;

  for (const level of trimmed) {
    cumSize += level.size;
    cumValue += level.price * level.size;
    level.cumulativeSize = cumSize;
    level.cumulativeValue = cumValue;
    level.percentOfTotal = totalSize > 0 ? (level.size / totalSize) * 100 : 0;
  }

  return trimmed;
}

/**
 * Apply a delta update to an order book
 */
export function applyDeltaUpdate(
  orderBook: OrderBookState,
  side: BookSide,
  price: number,
  size: number,
  maxLevels: number
): { updatedBook: OrderBookState; deltaType: DeltaType; oldSize: number } {
  const levels = side === "bid" ? [...orderBook.bids] : [...orderBook.asks];

  // Find existing level at this price
  const existingIndex = levels.findIndex((l) => Math.abs(l.price - price) < 0.0000001);
  let deltaType: DeltaType;
  let oldSize = 0;

  if (existingIndex !== -1) {
    const existing = levels[existingIndex];
    if (existing) {
      oldSize = existing.size;
    }

    if (size === 0) {
      // Remove level
      deltaType = "remove";
      levels.splice(existingIndex, 1);
    } else {
      // Update level
      deltaType = "update";
      levels[existingIndex] = {
        price,
        size,
        orderCount: 1, // We don't get order count in delta updates
        cumulativeSize: 0,
        cumulativeValue: 0,
        percentOfTotal: 0,
      };
    }
  } else if (size > 0) {
    // Add new level
    deltaType = "add";
    levels.push({
      price,
      size,
      orderCount: 1,
      cumulativeSize: 0,
      cumulativeValue: 0,
      percentOfTotal: 0,
    });
  } else {
    // Size is 0 and level doesn't exist - no-op
    deltaType = "remove";
  }

  // Recalculate
  const updatedLevels = applyLevelsToSide(levels, side, maxLevels);

  // Create updated order book
  const updatedBook = {
    ...orderBook,
    bids: side === "bid" ? updatedLevels : orderBook.bids,
    asks: side === "ask" ? updatedLevels : orderBook.asks,
    lastUpdate: new Date(),
    updateCount: orderBook.updateCount + 1,
    isSnapshot: false,
  };

  // Recalculate derived values
  recalculateOrderBookDerivedValues(updatedBook);

  return { updatedBook, deltaType, oldSize };
}

/**
 * Recalculate derived values (best bid/ask, spread, etc.)
 */
function recalculateOrderBookDerivedValues(orderBook: OrderBookState): void {
  // Calculate totals
  let totalBidVolume = 0;
  let totalAskVolume = 0;

  for (const level of orderBook.bids) {
    totalBidVolume += level.size;
  }

  for (const level of orderBook.asks) {
    totalAskVolume += level.size;
  }

  orderBook.totalBidVolume = totalBidVolume;
  orderBook.totalAskVolume = totalAskVolume;

  // Best bid/ask
  const firstBid = orderBook.bids[0];
  const firstAsk = orderBook.asks[0];
  orderBook.bestBid = firstBid?.price;
  orderBook.bestAsk = firstAsk?.price;

  // Mid price and spread
  if (orderBook.bestBid !== undefined && orderBook.bestAsk !== undefined) {
    orderBook.midPrice = (orderBook.bestBid + orderBook.bestAsk) / 2;
    orderBook.spread = orderBook.bestAsk - orderBook.bestBid;
    orderBook.spreadPercent = orderBook.midPrice > 0
      ? (orderBook.spread / orderBook.midPrice) * 100
      : 0;
  } else {
    orderBook.midPrice = undefined;
    orderBook.spread = undefined;
    orderBook.spreadPercent = undefined;
  }

  // Volume imbalance
  orderBook.volumeImbalance = totalAskVolume > 0
    ? totalBidVolume / totalAskVolume
    : totalBidVolume > 0 ? Infinity : 1;
}

/**
 * Parse a raw order book message and apply to state
 */
export function parseOrderBookMessage(
  raw: RawBookUpdateMessage,
  existingState: OrderBookState | undefined,
  maxLevels: number
): { orderBook: OrderBookState; levelChanges: { side: BookSide; price: number; oldSize: number; newSize: number; deltaType: DeltaType }[] } | null {
  // Extract asset ID
  const assetId = raw.asset_id ?? raw.market ?? raw.token_id;
  if (!assetId) {
    return null;
  }

  const isSnapshot = raw.is_snapshot === true || raw.snapshot === true;
  const levelChanges: { side: BookSide; price: number; oldSize: number; newSize: number; deltaType: DeltaType }[] = [];

  // Start with existing state or create new
  let orderBook: OrderBookState = existingState ? { ...existingState } : createEmptyOrderBook(assetId);

  // Handle delta updates
  if (raw.deltas && !isSnapshot) {
    for (const delta of raw.deltas) {
      const side = parseBookSide(delta.side);
      if (!side) continue;

      const price = typeof delta.price === "string" ? parseFloat(delta.price) : delta.price;
      const size = typeof delta.size === "string" ? parseFloat(delta.size) : delta.size;

      if (isNaN(price) || isNaN(size)) continue;

      const { updatedBook, deltaType, oldSize } = applyDeltaUpdate(orderBook, side, price, size, maxLevels);
      orderBook = updatedBook;

      levelChanges.push({
        side,
        price,
        oldSize,
        newSize: size,
        deltaType,
      });
    }

    return { orderBook, levelChanges };
  }

  // Handle full snapshot or bid/ask arrays
  const rawBids = raw.bids ?? raw.buys;
  const rawAsks = raw.asks ?? raw.sells;

  if (rawBids || rawAsks) {
    const oldBids = new Map<number, number>();
    const oldAsks = new Map<number, number>();

    // Store old state for change tracking
    if (!isSnapshot && existingState) {
      for (const level of existingState.bids) {
        oldBids.set(level.price, level.size);
      }
      for (const level of existingState.asks) {
        oldAsks.set(level.price, level.size);
      }
    }

    // Parse new bids
    const newBids: ParsedBookLevel[] = [];
    if (rawBids) {
      for (const rawLevel of rawBids) {
        const parsed = parseBookLevel(rawLevel);
        if (parsed && parsed.size > 0) {
          newBids.push(parsed);
        }
      }
    }

    // Parse new asks
    const newAsks: ParsedBookLevel[] = [];
    if (rawAsks) {
      for (const rawLevel of rawAsks) {
        const parsed = parseBookLevel(rawLevel);
        if (parsed && parsed.size > 0) {
          newAsks.push(parsed);
        }
      }
    }

    // Apply levels
    orderBook.bids = applyLevelsToSide(newBids, "bid", maxLevels);
    orderBook.asks = applyLevelsToSide(newAsks, "ask", maxLevels);
    orderBook.lastUpdate = new Date();
    orderBook.updateCount = isSnapshot ? 0 : orderBook.updateCount + 1;
    orderBook.isSnapshot = isSnapshot;
    orderBook.sequence = raw.sequence;
    orderBook.hash = raw.hash ?? raw.checksum;

    // Recalculate derived values
    recalculateOrderBookDerivedValues(orderBook);

    // Track changes
    if (!isSnapshot) {
      // Track bid changes
      for (const [price, oldSize] of oldBids) {
        const newLevel = orderBook.bids.find((b) => Math.abs(b.price - price) < 0.0000001);
        if (!newLevel) {
          levelChanges.push({ side: "bid", price, oldSize, newSize: 0, deltaType: "remove" });
        } else if (newLevel.size !== oldSize) {
          levelChanges.push({ side: "bid", price, oldSize, newSize: newLevel.size, deltaType: "update" });
        }
      }
      for (const level of orderBook.bids) {
        if (!oldBids.has(level.price)) {
          levelChanges.push({ side: "bid", price: level.price, oldSize: 0, newSize: level.size, deltaType: "add" });
        }
      }

      // Track ask changes
      for (const [price, oldSize] of oldAsks) {
        const newLevel = orderBook.asks.find((a) => Math.abs(a.price - price) < 0.0000001);
        if (!newLevel) {
          levelChanges.push({ side: "ask", price, oldSize, newSize: 0, deltaType: "remove" });
        } else if (newLevel.size !== oldSize) {
          levelChanges.push({ side: "ask", price, oldSize, newSize: newLevel.size, deltaType: "update" });
        }
      }
      for (const level of orderBook.asks) {
        if (!oldAsks.has(level.price)) {
          levelChanges.push({ side: "ask", price: level.price, oldSize: 0, newSize: level.size, deltaType: "add" });
        }
      }
    }

    return { orderBook, levelChanges };
  }

  return null;
}

/**
 * Get cumulative volume at a specific price
 */
export function getCumulativeVolumeAtPrice(
  orderBook: OrderBookState,
  side: BookSide,
  price: number
): number {
  const levels = side === "bid" ? orderBook.bids : orderBook.asks;
  let cumulative = 0;

  for (const level of levels) {
    if (side === "bid" && level.price >= price) {
      cumulative += level.size;
    } else if (side === "ask" && level.price <= price) {
      cumulative += level.size;
    }
  }

  return cumulative;
}

/**
 * Get the price needed to fill a specific volume
 */
export function getPriceForVolume(
  orderBook: OrderBookState,
  side: BookSide,
  targetVolume: number
): number | null {
  const levels = side === "bid" ? orderBook.asks : orderBook.bids; // Opposite side for fills
  let cumulative = 0;

  for (const level of levels) {
    cumulative += level.size;
    if (cumulative >= targetVolume) {
      return level.price;
    }
  }

  return null; // Not enough liquidity
}

/**
 * Calculate market impact for a given volume
 */
export function calculateMarketImpact(
  orderBook: OrderBookState,
  side: BookSide,
  volume: number
): { avgPrice: number; impact: number; worstPrice: number } | null {
  const levels = side === "bid" ? orderBook.asks : orderBook.bids;

  if (levels.length === 0) {
    return null;
  }

  const bestPrice = levels[0]?.price;
  if (bestPrice === undefined) {
    return null;
  }

  let cumVolume = 0;
  let cumValue = 0;
  let worstPrice = bestPrice;

  for (const level of levels) {
    const fillSize = Math.min(level.size, volume - cumVolume);
    cumVolume += fillSize;
    cumValue += fillSize * level.price;
    worstPrice = level.price;

    if (cumVolume >= volume) {
      break;
    }
  }

  if (cumVolume === 0) {
    return null;
  }

  const avgPrice = cumValue / cumVolume;
  const impact = Math.abs(avgPrice - bestPrice) / bestPrice;

  return { avgPrice, impact, worstPrice };
}

// ============================================================================
// OrderBookStreamClient Class
// ============================================================================

/**
 * Client for subscribing to real-time order book updates
 */
export class OrderBookStreamClient {
  private connection: ReconnectableConnection;
  private readonly config: Required<Pick<
    OrderBookStreamConfig,
    "maxLevels" | "spreadChangeThreshold" | "imbalanceThreshold" | "confirmationTimeout" | "debug"
  >>;
  private readonly logger: WebSocketLogger;

  private readonly subscriptions: Map<string, OrderBookSubscriptionInfo> = new Map();
  private readonly tokenToSubscription: Map<string, string> = new Map();
  private pendingConfirmations: Map<string, { resolve: () => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private disposed = false;

  private readonly listeners: OrderBookStreamEventListenerMap = {
    orderBookUpdate: [],
    orderBookSnapshot: [],
    spreadChange: [],
    bookImbalance: [],
    orderBookConfirmed: [],
    orderBookError: [],
    connected: [],
    disconnected: [],
    reconnecting: [],
  };

  constructor(
    config: OrderBookStreamConfig = {},
    logger: WebSocketLogger = defaultLogger,
    WebSocketClass?: WebSocketConstructor
  ) {
    this.logger = config.debug ? {
      debug: console.log.bind(console, "[OrderBookStream]"),
      info: console.log.bind(console, "[OrderBookStream]"),
      warn: console.warn.bind(console, "[OrderBookStream]"),
      error: console.error.bind(console, "[OrderBookStream]"),
    } : logger;

    this.config = {
      maxLevels: config.maxLevels ?? DEFAULT_MAX_BOOK_LEVELS,
      spreadChangeThreshold: config.spreadChangeThreshold ?? 0.001,
      imbalanceThreshold: config.imbalanceThreshold ?? 2.0,
      confirmationTimeout: config.confirmationTimeout ?? 10000,
      debug: config.debug ?? false,
    };

    // Create the WebSocket connection
    this.connection = createReconnectableConnection(
      {
        url: config.wsUrl ?? POLYMARKET_BOOK_WS_URL,
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

    // Handle order book messages
    if (isOrderBookMessage(data)) {
      this.handleOrderBookMessage(data);
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
    let subscription: OrderBookSubscriptionInfo | undefined;

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

      this.logger.info(`Order book subscription confirmed: ${subscriptionId}`);

      const pending = this.pendingConfirmations.get(subscriptionId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingConfirmations.delete(subscriptionId);
      }

      this.emit("orderBookConfirmed", {
        type: "orderBookConfirmed",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        tokenIds: subscription.tokenIds,
      });
    } else if (confirmation.type === "unsubscribed") {
      this.logger.info(`Order book unsubscribed: ${subscriptionId}`);

      for (const tokenId of subscription.tokenIds) {
        this.tokenToSubscription.delete(tokenId);
      }
      this.subscriptions.delete(subscriptionId);
      this.connection.removeSubscription(subscriptionId);
    }
  }

  private handleOrderBookMessage(raw: RawBookUpdateMessage): void {
    const assetId = raw.asset_id ?? raw.market ?? raw.token_id;
    if (!assetId) {
      return;
    }

    // Find the subscription
    const subscriptionId = this.tokenToSubscription.get(assetId);
    if (!subscriptionId) {
      this.logger.debug("Order book update for unknown token:", assetId);
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Get existing state
    const existingState = subscription.orderBooks.get(assetId);
    const oldSpread = existingState?.spread;
    const oldSpreadPercent = existingState?.spreadPercent;

    // Parse the update
    const result = parseOrderBookMessage(raw, existingState, subscription.maxLevels);
    if (!result) {
      this.logger.debug("Failed to parse order book message:", raw);
      return;
    }

    const { orderBook, levelChanges } = result;

    // Store updated state
    subscription.orderBooks.set(assetId, orderBook);
    subscription.lastUpdateAt = new Date();
    subscription.updateCount++;

    if (orderBook.isSnapshot) {
      subscription.snapshotCount++;

      // Emit snapshot event
      this.emit("orderBookSnapshot", {
        type: "orderBookSnapshot",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        assetId,
        orderBook,
      });
    }

    // Emit update event
    this.emit("orderBookUpdate", {
      type: "orderBookUpdate",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      subscriptionId,
      assetId,
      orderBook,
      isSnapshot: orderBook.isSnapshot,
      levelChanges,
    });

    // Check for spread change
    if (orderBook.spread !== undefined) {
      const spreadChange = oldSpread !== undefined
        ? Math.abs(orderBook.spread - oldSpread)
        : orderBook.spread;
      const significantChange = spreadChange >= this.config.spreadChangeThreshold;

      if (significantChange || oldSpread === undefined) {
        this.emit("spreadChange", {
          type: "spreadChange",
          connectionId: this.connection.getId(),
          timestamp: new Date(),
          subscriptionId,
          assetId,
          oldSpread,
          newSpread: orderBook.spread,
          oldSpreadPercent,
          newSpreadPercent: orderBook.spreadPercent ?? 0,
          significantChange,
        });
      }
    }

    // Check for imbalance
    if (orderBook.volumeImbalance >= this.config.imbalanceThreshold ||
        orderBook.volumeImbalance <= 1 / this.config.imbalanceThreshold) {
      const direction: "bid_heavy" | "ask_heavy" | "balanced" =
        orderBook.volumeImbalance > this.config.imbalanceThreshold
          ? "bid_heavy"
          : orderBook.volumeImbalance < 1 / this.config.imbalanceThreshold
            ? "ask_heavy"
            : "balanced";

      this.emit("bookImbalance", {
        type: "bookImbalance",
        connectionId: this.connection.getId(),
        timestamp: new Date(),
        subscriptionId,
        assetId,
        imbalanceRatio: orderBook.volumeImbalance,
        totalBidVolume: orderBook.totalBidVolume,
        totalAskVolume: orderBook.totalAskVolume,
        direction,
      });
    }
  }

  private handleError(error: { type: "error"; error: string; message?: string }): void {
    const errorMessage = error.message ?? error.error;
    this.logger.error("Order book stream error:", errorMessage);

    this.emit("orderBookError", {
      type: "orderBookError",
      connectionId: this.connection.getId(),
      timestamp: new Date(),
      error: new Error(errorMessage),
      message: errorMessage,
    });
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

  async subscribe(request: OrderBookSubscriptionRequest): Promise<OrderBookSubscriptionInfo> {
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
    const maxLevels = request.maxLevels ?? this.config.maxLevels;

    const subscription: OrderBookSubscriptionInfo = {
      id: subscriptionId,
      tokenIds,
      createdAt: new Date(),
      confirmed: false,
      updateCount: 0,
      snapshotCount: 0,
      orderBooks: new Map(),
      maxLevels,
      metadata: request.metadata,
    };

    // Initialize empty order books
    for (const tokenId of tokenIds) {
      subscription.orderBooks.set(tokenId, createEmptyOrderBook(tokenId));
    }

    this.subscriptions.set(subscriptionId, subscription);
    for (const tokenId of tokenIds) {
      this.tokenToSubscription.set(tokenId, subscriptionId);
    }

    const message = buildBookSubscriptionMessage(tokenIds, "subscribe", subscriptionId);

    this.connection.addSubscription(subscriptionId, SubscriptionChannel.BOOK, message, {
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

    this.logger.info(`Subscribing to order book for ${tokenIds.length} token(s)`);

    await this.waitForConfirmation(subscriptionId, this.config.confirmationTimeout);

    return subscription;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const message = buildBookSubscriptionMessage(
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

    this.logger.info(`Unsubscribed from order book: ${subscriptionId}`);
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
        const message = buildBookSubscriptionMessage(
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
        this.logger.warn(`Order book confirmation timeout for ${subscriptionId}, proceeding anyway`);
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

  getSubscription(subscriptionId: string): OrderBookSubscriptionInfo | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getSubscriptionForToken(tokenId: string): OrderBookSubscriptionInfo | undefined {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    return subscriptionId ? this.subscriptions.get(subscriptionId) : undefined;
  }

  getAllSubscriptions(): OrderBookSubscriptionInfo[] {
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
   * Get the current order book state for a token
   */
  getOrderBook(tokenId: string): OrderBookState | undefined {
    const subscription = this.getSubscriptionForToken(tokenId);
    return subscription?.orderBooks.get(tokenId);
  }

  /**
   * Get order book statistics for a token
   */
  getStats(tokenId: string): OrderBookStats | null {
    const orderBook = this.getOrderBook(tokenId);
    return orderBook ? calculateOrderBookStats(orderBook) : null;
  }

  /**
   * Get all order book states
   */
  getAllOrderBooks(): Map<string, OrderBookState> {
    const all = new Map<string, OrderBookState>();
    for (const subscription of this.subscriptions.values()) {
      for (const [tokenId, orderBook] of subscription.orderBooks) {
        all.set(tokenId, orderBook);
      }
    }
    return all;
  }

  /**
   * Get the best bid for a token
   */
  getBestBid(tokenId: string): number | undefined {
    return this.getOrderBook(tokenId)?.bestBid;
  }

  /**
   * Get the best ask for a token
   */
  getBestAsk(tokenId: string): number | undefined {
    return this.getOrderBook(tokenId)?.bestAsk;
  }

  /**
   * Get the mid price for a token
   */
  getMidPrice(tokenId: string): number | undefined {
    return this.getOrderBook(tokenId)?.midPrice;
  }

  /**
   * Get the spread for a token
   */
  getSpread(tokenId: string): number | undefined {
    return this.getOrderBook(tokenId)?.spread;
  }

  /**
   * Get cumulative volume at a price
   */
  getCumulativeVolume(tokenId: string, side: BookSide, price: number): number {
    const orderBook = this.getOrderBook(tokenId);
    return orderBook ? getCumulativeVolumeAtPrice(orderBook, side, price) : 0;
  }

  /**
   * Get price to fill a specific volume
   */
  getPriceToFill(tokenId: string, side: BookSide, volume: number): number | null {
    const orderBook = this.getOrderBook(tokenId);
    return orderBook ? getPriceForVolume(orderBook, side, volume) : null;
  }

  /**
   * Calculate market impact for a volume
   */
  getMarketImpact(tokenId: string, side: BookSide, volume: number): { avgPrice: number; impact: number; worstPrice: number } | null {
    const orderBook = this.getOrderBook(tokenId);
    return orderBook ? calculateMarketImpact(orderBook, side, volume) : null;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  on<K extends OrderBookStreamEventKey>(
    event: K,
    listener: OrderBookStreamEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  off<K extends OrderBookStreamEventKey>(
    event: K,
    listener: OrderBookStreamEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  once<K extends OrderBookStreamEventKey>(
    event: K,
    listener: OrderBookStreamEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as OrderBookStreamEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as OrderBookStreamEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  removeAllListeners(event?: OrderBookStreamEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as OrderBookStreamEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  private emit<K extends OrderBookStreamEventKey>(
    event: K,
    data: Parameters<OrderBookStreamEventListenerMap[K][number]>[0]
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
 * Create a new order book stream client
 */
export function createOrderBookStreamClient(
  config?: OrderBookStreamConfig,
  logger?: WebSocketLogger,
  WebSocketClass?: WebSocketConstructor
): OrderBookStreamClient {
  return new OrderBookStreamClient(config, logger, WebSocketClass);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedClient: OrderBookStreamClient | null = null;

/**
 * Get the shared order book stream client
 */
export function getSharedOrderBookStreamClient(): OrderBookStreamClient {
  if (!sharedClient) {
    sharedClient = createOrderBookStreamClient();
  }
  return sharedClient;
}

/**
 * Set the shared order book stream client
 */
export function setSharedOrderBookStreamClient(client: OrderBookStreamClient): void {
  if (sharedClient && sharedClient !== client) {
    sharedClient.dispose();
  }
  sharedClient = client;
}

/**
 * Reset the shared order book stream client
 */
export function resetSharedOrderBookStreamClient(): void {
  if (sharedClient) {
    sharedClient.dispose();
    sharedClient = null;
  }
}
