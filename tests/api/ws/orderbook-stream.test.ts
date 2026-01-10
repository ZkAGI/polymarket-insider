/**
 * Tests for Order Book Stream Module (API-WS-005)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Constants
  POLYMARKET_BOOK_WS_URL,
  DEFAULT_MAX_BOOK_LEVELS,
  DEFAULT_SNAPSHOT_INTERVAL,
  // Utility functions
  parseBookLevel,
  parseBookSide,
  isOrderBookMessage,
  buildBookSubscriptionMessage,
  calculateOrderBookStats,
  createEmptyOrderBook,
  applyDeltaUpdate,
  parseOrderBookMessage,
  getCumulativeVolumeAtPrice,
  getPriceForVolume,
  calculateMarketImpact,
  // Client
  OrderBookStreamClient,
  createOrderBookStreamClient,
  getSharedOrderBookStreamClient,
  setSharedOrderBookStreamClient,
  resetSharedOrderBookStreamClient,
} from "@/api/ws/orderbook-stream";
import type {
  RawBookLevel,
  RawBookUpdateMessage,
  OrderBookState,
} from "@/api/ws/orderbook-stream";
import { SubscriptionChannel, SubscriptionMessageType } from "@/api/ws/market-subscriptions";
import type { IWebSocket } from "@/api/ws/types";

// ============================================================================
// Mock WebSocket
// ============================================================================

class MockEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class MockCloseEvent extends MockEvent {
  code: number;
  reason: string;
  wasClean: boolean;
  constructor(type: string, code: number, reason: string, wasClean: boolean) {
    super(type);
    this.code = code;
    this.reason = reason;
    this.wasClean = wasClean;
  }
}

class MockMessageEvent extends MockEvent {
  data: string;
  constructor(type: string, data: string) {
    super(type);
    this.data = data;
  }
}

class MockWebSocket implements IWebSocket {
  readonly url: string;
  readonly protocol: string = "";
  readonly bufferedAmount: number = 0;
  readyState: number = 0;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: globalThis.MessageEvent) => void) | null = null;

  private connectDelay: number;
  private shouldFail: boolean;

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    this.connectDelay = 10;
    this.shouldFail = false;
  }

  setConnectDelay(delay: number): void {
    this.connectDelay = delay;
  }

  setConnectFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  connect(): void {
    this.readyState = 0; // CONNECTING
    setTimeout(() => {
      if (this.shouldFail) {
        this.readyState = 3; // CLOSED
        if (this.onerror) {
          this.onerror(new MockEvent("error") as Event);
        }
        if (this.onclose) {
          this.onclose(new MockCloseEvent("close", 1006, "Connection failed", false) as CloseEvent);
        }
      } else {
        this.readyState = 1; // OPEN
        if (this.onopen) {
          this.onopen(new MockEvent("open") as Event);
        }
      }
    }, this.connectDelay);
  }

  send(_data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
  }

  close(code: number = 1000, reason: string = ""): void {
    const wasClean = code === 1000;
    this.readyState = 2; // CLOSING
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose(new MockCloseEvent("close", code, reason, wasClean) as CloseEvent);
      }
    }, 5);
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      const messageData = typeof data === "string" ? data : JSON.stringify(data);
      this.onmessage(new MockMessageEvent("message", messageData) as globalThis.MessageEvent);
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new MockEvent("error") as Event);
    }
  }
}

// Helper to create mock WebSocket class
function createMockWebSocketClass(): new (url: string, protocols?: string | string[]) => MockWebSocket {
  return class extends MockWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
      setTimeout(() => this.connect(), 0);
    }
  };
}

// ============================================================================
// Constants Tests
// ============================================================================

describe("Order Book Stream Constants", () => {
  it("should export POLYMARKET_BOOK_WS_URL", () => {
    expect(POLYMARKET_BOOK_WS_URL).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
  });

  it("should export DEFAULT_MAX_BOOK_LEVELS", () => {
    expect(DEFAULT_MAX_BOOK_LEVELS).toBe(100);
  });

  it("should export DEFAULT_SNAPSHOT_INTERVAL", () => {
    expect(DEFAULT_SNAPSHOT_INTERVAL).toBe(30000);
  });
});

// ============================================================================
// parseBookLevel Tests
// ============================================================================

describe("parseBookLevel", () => {
  it("should parse a level with price and size", () => {
    const raw: RawBookLevel = { price: 0.65, size: 1000 };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.price).toBe(0.65);
    expect(result!.size).toBe(1000);
    expect(result!.orderCount).toBe(1);
  });

  it("should parse string price and size", () => {
    const raw: RawBookLevel = { price: "0.75", size: "500" };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.price).toBe(0.75);
    expect(result!.size).toBe(500);
  });

  it("should parse using p and s shorthand", () => {
    const raw: RawBookLevel = { p: 0.5, s: 200 };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.price).toBe(0.5);
    expect(result!.size).toBe(200);
  });

  it("should parse using quantity field", () => {
    const raw: RawBookLevel = { price: 0.4, quantity: 300 };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.size).toBe(300);
  });

  it("should parse order count", () => {
    const raw: RawBookLevel = { price: 0.6, size: 100, count: 5 };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.orderCount).toBe(5);
  });

  it("should parse num_orders field", () => {
    const raw: RawBookLevel = { price: 0.6, size: 100, num_orders: 3 };
    const result = parseBookLevel(raw);

    expect(result).not.toBeNull();
    expect(result!.orderCount).toBe(3);
  });

  it("should return null for missing price", () => {
    const raw: RawBookLevel = { size: 100 };
    expect(parseBookLevel(raw)).toBeNull();
  });

  it("should return null for missing size", () => {
    const raw: RawBookLevel = { price: 0.5 };
    expect(parseBookLevel(raw)).toBeNull();
  });

  it("should return null for NaN price", () => {
    const raw: RawBookLevel = { price: "invalid", size: 100 };
    expect(parseBookLevel(raw)).toBeNull();
  });

  it("should return null for negative size", () => {
    const raw: RawBookLevel = { price: 0.5, size: -100 };
    expect(parseBookLevel(raw)).toBeNull();
  });

  it("should allow zero size", () => {
    const raw: RawBookLevel = { price: 0.5, size: 0 };
    const result = parseBookLevel(raw);
    expect(result).not.toBeNull();
    expect(result!.size).toBe(0);
  });
});

// ============================================================================
// parseBookSide Tests
// ============================================================================

describe("parseBookSide", () => {
  it("should parse 'bid' as bid", () => {
    expect(parseBookSide("bid")).toBe("bid");
  });

  it("should parse 'buy' as bid", () => {
    expect(parseBookSide("buy")).toBe("bid");
  });

  it("should parse 'b' as bid", () => {
    expect(parseBookSide("b")).toBe("bid");
  });

  it("should parse 'ask' as ask", () => {
    expect(parseBookSide("ask")).toBe("ask");
  });

  it("should parse 'sell' as ask", () => {
    expect(parseBookSide("sell")).toBe("ask");
  });

  it("should parse 's' as ask", () => {
    expect(parseBookSide("s")).toBe("ask");
  });

  it("should parse 'offer' as ask", () => {
    expect(parseBookSide("offer")).toBe("ask");
  });

  it("should be case insensitive", () => {
    expect(parseBookSide("BID")).toBe("bid");
    expect(parseBookSide("ASK")).toBe("ask");
    expect(parseBookSide("Buy")).toBe("bid");
    expect(parseBookSide("SELL")).toBe("ask");
  });

  it("should return null for undefined", () => {
    expect(parseBookSide(undefined)).toBeNull();
  });

  it("should return null for unknown side", () => {
    expect(parseBookSide("unknown")).toBeNull();
  });
});

// ============================================================================
// isOrderBookMessage Tests
// ============================================================================

describe("isOrderBookMessage", () => {
  it("should return true for book type message", () => {
    expect(isOrderBookMessage({ type: "book" })).toBe(true);
  });

  it("should return true for book_update type", () => {
    expect(isOrderBookMessage({ type: "book_update" })).toBe(true);
  });

  it("should return true for orderbook type", () => {
    expect(isOrderBookMessage({ type: "orderbook" })).toBe(true);
  });

  it("should return true for message with bids array", () => {
    expect(isOrderBookMessage({ bids: [{ price: 0.5, size: 100 }] })).toBe(true);
  });

  it("should return true for message with asks array", () => {
    expect(isOrderBookMessage({ asks: [{ price: 0.6, size: 200 }] })).toBe(true);
  });

  it("should return true for message with buys array", () => {
    expect(isOrderBookMessage({ buys: [{ price: 0.5, size: 100 }] })).toBe(true);
  });

  it("should return true for message with sells array", () => {
    expect(isOrderBookMessage({ sells: [{ price: 0.6, size: 200 }] })).toBe(true);
  });

  it("should return true for message with deltas", () => {
    expect(isOrderBookMessage({
      deltas: [{ side: "bid", price: 0.5, size: 100 }]
    })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isOrderBookMessage(null)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isOrderBookMessage("string")).toBe(false);
    expect(isOrderBookMessage(123)).toBe(false);
  });

  it("should return false for message without book data", () => {
    expect(isOrderBookMessage({ type: "trade" })).toBe(false);
  });
});

// ============================================================================
// buildBookSubscriptionMessage Tests
// ============================================================================

describe("buildBookSubscriptionMessage", () => {
  it("should build subscribe message for single token", () => {
    const message = buildBookSubscriptionMessage(["token123"], "subscribe");

    expect(message.type).toBe(SubscriptionMessageType.SUBSCRIBE);
    expect(message.channel).toBe(SubscriptionChannel.BOOK);
    expect(message.market).toBe("token123");
    expect(message.assets_ids).toBeUndefined();
  });

  it("should build subscribe message for multiple tokens", () => {
    const message = buildBookSubscriptionMessage(["token1", "token2"], "subscribe");

    expect(message.type).toBe(SubscriptionMessageType.SUBSCRIBE);
    expect(message.channel).toBe(SubscriptionChannel.BOOK);
    expect(message.assets_ids).toEqual(["token1", "token2"]);
    expect(message.market).toBeUndefined();
  });

  it("should build unsubscribe message", () => {
    const message = buildBookSubscriptionMessage(["token123"], "unsubscribe");

    expect(message.type).toBe(SubscriptionMessageType.UNSUBSCRIBE);
    expect(message.channel).toBe(SubscriptionChannel.BOOK);
  });

  it("should include subscription ID when provided", () => {
    const message = buildBookSubscriptionMessage(["token123"], "subscribe", "sub_123");

    expect(message.id).toBe("sub_123");
  });
});

// ============================================================================
// createEmptyOrderBook Tests
// ============================================================================

describe("createEmptyOrderBook", () => {
  it("should create an empty order book with correct defaults", () => {
    const book = createEmptyOrderBook("asset123");

    expect(book.assetId).toBe("asset123");
    expect(book.bids).toEqual([]);
    expect(book.asks).toEqual([]);
    expect(book.totalBidVolume).toBe(0);
    expect(book.totalAskVolume).toBe(0);
    expect(book.volumeImbalance).toBe(1);
    expect(book.isSnapshot).toBe(false);
    expect(book.updateCount).toBe(0);
    expect(book.lastUpdate).toBeInstanceOf(Date);
  });
});

// ============================================================================
// applyDeltaUpdate Tests
// ============================================================================

describe("applyDeltaUpdate", () => {
  let orderBook: OrderBookState;

  beforeEach(() => {
    orderBook = createEmptyOrderBook("asset123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 50 },
      { price: 0.50, size: 100, orderCount: 1, cumulativeSize: 200, cumulativeValue: 105, percentOfTotal: 50 },
    ];
    orderBook.asks = [
      { price: 0.60, size: 80, orderCount: 1, cumulativeSize: 80, cumulativeValue: 48, percentOfTotal: 50 },
      { price: 0.65, size: 80, orderCount: 1, cumulativeSize: 160, cumulativeValue: 100, percentOfTotal: 50 },
    ];
    orderBook.totalBidVolume = 200;
    orderBook.totalAskVolume = 160;
  });

  it("should add a new bid level", () => {
    const { updatedBook, deltaType, oldSize } = applyDeltaUpdate(orderBook, "bid", 0.52, 50, 100);

    expect(deltaType).toBe("add");
    expect(oldSize).toBe(0);
    expect(updatedBook.bids.length).toBe(3);
    expect(updatedBook.bids.find(b => Math.abs(b.price - 0.52) < 0.0001)?.size).toBe(50);
  });

  it("should update an existing bid level", () => {
    const { updatedBook, deltaType, oldSize } = applyDeltaUpdate(orderBook, "bid", 0.55, 150, 100);

    expect(deltaType).toBe("update");
    expect(oldSize).toBe(100);
    expect(updatedBook.bids.length).toBe(2);
    expect(updatedBook.bids[0]?.size).toBe(150);
  });

  it("should remove a bid level when size is 0", () => {
    const { updatedBook, deltaType, oldSize } = applyDeltaUpdate(orderBook, "bid", 0.55, 0, 100);

    expect(deltaType).toBe("remove");
    expect(oldSize).toBe(100);
    expect(updatedBook.bids.length).toBe(1);
    expect(updatedBook.bids[0]?.price).toBe(0.5);
  });

  it("should add a new ask level", () => {
    const { updatedBook, deltaType } = applyDeltaUpdate(orderBook, "ask", 0.62, 100, 100);

    expect(deltaType).toBe("add");
    expect(updatedBook.asks.length).toBe(3);
    expect(updatedBook.asks.find(a => Math.abs(a.price - 0.62) < 0.0001)?.size).toBe(100);
  });

  it("should maintain bid sorting (descending)", () => {
    applyDeltaUpdate(orderBook, "bid", 0.52, 50, 100);
    const { updatedBook } = applyDeltaUpdate(orderBook, "bid", 0.58, 75, 100);

    // Bids should be sorted descending by price
    for (let i = 1; i < updatedBook.bids.length; i++) {
      const prev = updatedBook.bids[i - 1];
      const curr = updatedBook.bids[i];
      if (prev && curr) {
        expect(prev.price).toBeGreaterThan(curr.price);
      }
    }
  });

  it("should maintain ask sorting (ascending)", () => {
    applyDeltaUpdate(orderBook, "ask", 0.62, 50, 100);
    const { updatedBook } = applyDeltaUpdate(orderBook, "ask", 0.58, 75, 100);

    // Asks should be sorted ascending by price
    for (let i = 1; i < updatedBook.asks.length; i++) {
      const prev = updatedBook.asks[i - 1];
      const curr = updatedBook.asks[i];
      if (prev && curr) {
        expect(prev.price).toBeLessThan(curr.price);
      }
    }
  });

  it("should recalculate cumulative values", () => {
    const { updatedBook } = applyDeltaUpdate(orderBook, "bid", 0.58, 50, 100);

    // Check cumulative size
    let cumSize = 0;
    for (const level of updatedBook.bids) {
      cumSize += level.size;
      expect(level.cumulativeSize).toBe(cumSize);
    }
  });

  it("should update best bid/ask", () => {
    const { updatedBook } = applyDeltaUpdate(orderBook, "bid", 0.60, 100, 100);

    expect(updatedBook.bestBid).toBe(0.60);
  });

  it("should trim to max levels", () => {
    // Add many levels
    let book = orderBook;
    for (let i = 0; i < 10; i++) {
      const { updatedBook } = applyDeltaUpdate(book, "bid", 0.40 + i * 0.01, 50, 5);
      book = updatedBook;
    }

    expect(book.bids.length).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// parseOrderBookMessage Tests
// ============================================================================

describe("parseOrderBookMessage", () => {
  it("should parse a snapshot message", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      asset_id: "token123",
      is_snapshot: true,
      bids: [
        { price: 0.55, size: 100 },
        { price: 0.50, size: 200 },
      ],
      asks: [
        { price: 0.60, size: 150 },
        { price: 0.65, size: 100 },
      ],
      timestamp: Date.now(),
    };

    const result = parseOrderBookMessage(raw, undefined, 100);

    expect(result).not.toBeNull();
    expect(result!.orderBook.assetId).toBe("token123");
    expect(result!.orderBook.isSnapshot).toBe(true);
    expect(result!.orderBook.bids.length).toBe(2);
    expect(result!.orderBook.asks.length).toBe(2);
    expect(result!.orderBook.bids[0]?.price).toBe(0.55);
    expect(result!.orderBook.asks[0]?.price).toBe(0.60);
  });

  it("should parse delta updates", () => {
    const existing = createEmptyOrderBook("token123");
    existing.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 100 },
    ];

    const raw: RawBookUpdateMessage = {
      type: "book_update",
      asset_id: "token123",
      deltas: [
        { side: "bid", price: 0.50, size: 200 },
        { side: "ask", price: 0.60, size: 150 },
      ],
    };

    const result = parseOrderBookMessage(raw, existing, 100);

    expect(result).not.toBeNull();
    expect(result!.orderBook.bids.length).toBe(2);
    expect(result!.orderBook.asks.length).toBe(1);
    expect(result!.levelChanges.length).toBe(2);
  });

  it("should track level changes for non-snapshot updates", () => {
    const existing = createEmptyOrderBook("token123");
    existing.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 100 },
    ];

    const raw: RawBookUpdateMessage = {
      type: "book",
      asset_id: "token123",
      bids: [
        { price: 0.55, size: 150 }, // Updated
        { price: 0.50, size: 200 }, // Added
      ],
      asks: [
        { price: 0.60, size: 100 }, // Added
      ],
    };

    const result = parseOrderBookMessage(raw, existing, 100);

    expect(result).not.toBeNull();
    expect(result!.levelChanges.length).toBeGreaterThan(0);

    // Find the update change
    const updateChange = result!.levelChanges.find(c => c.deltaType === "update");
    expect(updateChange).toBeDefined();
    expect(updateChange!.oldSize).toBe(100);
    expect(updateChange!.newSize).toBe(150);
  });

  it("should return null for missing asset ID", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      bids: [{ price: 0.5, size: 100 }],
    };

    expect(parseOrderBookMessage(raw, undefined, 100)).toBeNull();
  });

  it("should use market field as asset ID fallback", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      market: "token456",
      bids: [{ price: 0.5, size: 100 }],
    };

    const result = parseOrderBookMessage(raw, undefined, 100);
    expect(result).not.toBeNull();
    expect(result!.orderBook.assetId).toBe("token456");
  });

  it("should calculate derived values", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      asset_id: "token123",
      is_snapshot: true,
      bids: [{ price: 0.55, size: 100 }],
      asks: [{ price: 0.60, size: 200 }],
    };

    const result = parseOrderBookMessage(raw, undefined, 100);

    expect(result).not.toBeNull();
    expect(result!.orderBook.bestBid).toBe(0.55);
    expect(result!.orderBook.bestAsk).toBe(0.60);
    expect(result!.orderBook.midPrice).toBeCloseTo(0.575, 3);
    expect(result!.orderBook.spread).toBeCloseTo(0.05, 3);
    expect(result!.orderBook.totalBidVolume).toBe(100);
    expect(result!.orderBook.totalAskVolume).toBe(200);
    expect(result!.orderBook.volumeImbalance).toBeCloseTo(0.5, 2);
  });

  it("should store hash/checksum", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      asset_id: "token123",
      bids: [{ price: 0.5, size: 100 }],
      hash: "abc123",
    };

    const result = parseOrderBookMessage(raw, undefined, 100);
    expect(result!.orderBook.hash).toBe("abc123");
  });

  it("should store sequence number", () => {
    const raw: RawBookUpdateMessage = {
      type: "book",
      asset_id: "token123",
      bids: [{ price: 0.5, size: 100 }],
      sequence: 12345,
    };

    const result = parseOrderBookMessage(raw, undefined, 100);
    expect(result!.orderBook.sequence).toBe(12345);
  });
});

// ============================================================================
// calculateOrderBookStats Tests
// ============================================================================

describe("calculateOrderBookStats", () => {
  it("should calculate statistics for an order book", () => {
    const orderBook = createEmptyOrderBook("token123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 2, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 40 },
      { price: 0.50, size: 150, orderCount: 3, cumulativeSize: 250, cumulativeValue: 130, percentOfTotal: 60 },
    ];
    orderBook.asks = [
      { price: 0.60, size: 80, orderCount: 1, cumulativeSize: 80, cumulativeValue: 48, percentOfTotal: 40 },
      { price: 0.65, size: 120, orderCount: 2, cumulativeSize: 200, cumulativeValue: 126, percentOfTotal: 60 },
    ];
    orderBook.bestBid = 0.55;
    orderBook.bestAsk = 0.60;
    orderBook.midPrice = 0.575;
    orderBook.spread = 0.05;
    orderBook.spreadPercent = 8.7;
    orderBook.totalBidVolume = 250;
    orderBook.totalAskVolume = 200;
    orderBook.volumeImbalance = 1.25;
    orderBook.updateCount = 10;

    const stats = calculateOrderBookStats(orderBook);

    expect(stats.assetId).toBe("token123");
    expect(stats.bestBid).toBe(0.55);
    expect(stats.bestAsk).toBe(0.60);
    expect(stats.midPrice).toBe(0.575);
    expect(stats.spread).toBe(0.05);
    expect(stats.totalBidVolume).toBe(250);
    expect(stats.totalAskVolume).toBe(200);
    expect(stats.volumeImbalance).toBe(1.25);
    expect(stats.bidLevelsCount).toBe(2);
    expect(stats.askLevelsCount).toBe(2);
    expect(stats.updateCount).toBe(10);
  });

  it("should calculate top 5 volume", () => {
    const orderBook = createEmptyOrderBook("token123");
    orderBook.bids = Array.from({ length: 10 }, (_, i) => ({
      price: 0.55 - i * 0.01,
      size: 100,
      orderCount: 1,
      cumulativeSize: 0,
      cumulativeValue: 0,
      percentOfTotal: 0,
    }));
    orderBook.asks = Array.from({ length: 10 }, (_, i) => ({
      price: 0.60 + i * 0.01,
      size: 50,
      orderCount: 1,
      cumulativeSize: 0,
      cumulativeValue: 0,
      percentOfTotal: 0,
    }));
    orderBook.totalBidVolume = 1000;
    orderBook.totalAskVolume = 500;

    const stats = calculateOrderBookStats(orderBook);

    expect(stats.topBidVolume).toBe(500); // 5 levels * 100
    expect(stats.topAskVolume).toBe(250); // 5 levels * 50
  });

  it("should calculate weighted average prices", () => {
    const orderBook = createEmptyOrderBook("token123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 0, cumulativeValue: 0, percentOfTotal: 0 },
      { price: 0.50, size: 100, orderCount: 1, cumulativeSize: 0, cumulativeValue: 0, percentOfTotal: 0 },
    ];
    orderBook.totalBidVolume = 200;

    const stats = calculateOrderBookStats(orderBook);

    // Weighted avg = (0.55 * 100 + 0.50 * 100) / 200 = 0.525
    expect(stats.weightedAvgBid).toBeCloseTo(0.525, 3);
  });
});

// ============================================================================
// getCumulativeVolumeAtPrice Tests
// ============================================================================

describe("getCumulativeVolumeAtPrice", () => {
  let orderBook: OrderBookState;

  beforeEach(() => {
    orderBook = createEmptyOrderBook("token123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 40 },
      { price: 0.50, size: 150, orderCount: 1, cumulativeSize: 250, cumulativeValue: 130, percentOfTotal: 60 },
    ];
    orderBook.asks = [
      { price: 0.60, size: 80, orderCount: 1, cumulativeSize: 80, cumulativeValue: 48, percentOfTotal: 40 },
      { price: 0.65, size: 120, orderCount: 1, cumulativeSize: 200, cumulativeValue: 126, percentOfTotal: 60 },
    ];
  });

  it("should get cumulative bid volume at price", () => {
    // All bids at or above 0.50
    expect(getCumulativeVolumeAtPrice(orderBook, "bid", 0.50)).toBe(250);

    // Only top bid
    expect(getCumulativeVolumeAtPrice(orderBook, "bid", 0.55)).toBe(100);

    // Above all bids
    expect(getCumulativeVolumeAtPrice(orderBook, "bid", 0.60)).toBe(0);
  });

  it("should get cumulative ask volume at price", () => {
    // All asks at or below 0.65
    expect(getCumulativeVolumeAtPrice(orderBook, "ask", 0.65)).toBe(200);

    // Only best ask
    expect(getCumulativeVolumeAtPrice(orderBook, "ask", 0.60)).toBe(80);

    // Below all asks
    expect(getCumulativeVolumeAtPrice(orderBook, "ask", 0.55)).toBe(0);
  });
});

// ============================================================================
// getPriceForVolume Tests
// ============================================================================

describe("getPriceForVolume", () => {
  let orderBook: OrderBookState;

  beforeEach(() => {
    orderBook = createEmptyOrderBook("token123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 40 },
      { price: 0.50, size: 150, orderCount: 1, cumulativeSize: 250, cumulativeValue: 130, percentOfTotal: 60 },
    ];
    orderBook.asks = [
      { price: 0.60, size: 80, orderCount: 1, cumulativeSize: 80, cumulativeValue: 48, percentOfTotal: 40 },
      { price: 0.65, size: 120, orderCount: 1, cumulativeSize: 200, cumulativeValue: 126, percentOfTotal: 60 },
    ];
  });

  it("should get price to fill buy volume from asks", () => {
    // Fill 50 from first ask level
    expect(getPriceForVolume(orderBook, "bid", 50)).toBe(0.60);

    // Fill 100 needs both ask levels
    expect(getPriceForVolume(orderBook, "bid", 100)).toBe(0.65);
  });

  it("should get price to fill sell volume from bids", () => {
    // Fill 50 from first bid level
    expect(getPriceForVolume(orderBook, "ask", 50)).toBe(0.55);

    // Fill 150 needs both bid levels
    expect(getPriceForVolume(orderBook, "ask", 150)).toBe(0.50);
  });

  it("should return null for insufficient liquidity", () => {
    expect(getPriceForVolume(orderBook, "bid", 500)).toBeNull();
    expect(getPriceForVolume(orderBook, "ask", 500)).toBeNull();
  });
});

// ============================================================================
// calculateMarketImpact Tests
// ============================================================================

describe("calculateMarketImpact", () => {
  let orderBook: OrderBookState;

  beforeEach(() => {
    orderBook = createEmptyOrderBook("token123");
    orderBook.bids = [
      { price: 0.55, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 55, percentOfTotal: 40 },
      { price: 0.50, size: 100, orderCount: 1, cumulativeSize: 200, cumulativeValue: 105, percentOfTotal: 60 },
    ];
    orderBook.asks = [
      { price: 0.60, size: 100, orderCount: 1, cumulativeSize: 100, cumulativeValue: 60, percentOfTotal: 50 },
      { price: 0.65, size: 100, orderCount: 1, cumulativeSize: 200, cumulativeValue: 125, percentOfTotal: 50 },
    ];
  });

  it("should calculate market impact for a buy", () => {
    // Buy 50 at 0.60
    const result = calculateMarketImpact(orderBook, "bid", 50);

    expect(result).not.toBeNull();
    expect(result!.avgPrice).toBe(0.60);
    expect(result!.impact).toBe(0); // No impact, all at best price
    expect(result!.worstPrice).toBe(0.60);
  });

  it("should calculate market impact across multiple levels", () => {
    // Buy 150 - 100 at 0.60, 50 at 0.65
    const result = calculateMarketImpact(orderBook, "bid", 150);

    expect(result).not.toBeNull();
    // avgPrice = (100 * 0.60 + 50 * 0.65) / 150 = (60 + 32.5) / 150 = 0.6167
    expect(result!.avgPrice).toBeCloseTo(0.6167, 3);
    expect(result!.worstPrice).toBe(0.65);
    expect(result!.impact).toBeGreaterThan(0);
  });

  it("should calculate market impact for a sell", () => {
    // Sell 150 - 100 at 0.55, 50 at 0.50
    const result = calculateMarketImpact(orderBook, "ask", 150);

    expect(result).not.toBeNull();
    // avgPrice = (100 * 0.55 + 50 * 0.50) / 150 = (55 + 25) / 150 = 0.5333
    expect(result!.avgPrice).toBeCloseTo(0.5333, 3);
    expect(result!.worstPrice).toBe(0.50);
  });

  it("should return null for empty order book", () => {
    const emptyBook = createEmptyOrderBook("empty");
    expect(calculateMarketImpact(emptyBook, "bid", 100)).toBeNull();
  });
});

// ============================================================================
// OrderBookStreamClient Tests
// ============================================================================

describe("OrderBookStreamClient", () => {
  let client: OrderBookStreamClient;
  const MockWebSocketClass = createMockWebSocketClass();

  beforeEach(() => {
    resetSharedOrderBookStreamClient();
    client = new OrderBookStreamClient(
      { confirmationTimeout: 100, debug: false },
      undefined,
      MockWebSocketClass as unknown as new (url: string, protocols?: string | string[]) => IWebSocket
    );
  });

  afterEach(() => {
    client.dispose();
    resetSharedOrderBookStreamClient();
  });

  describe("constructor", () => {
    it("should create client with default config", () => {
      const defaultClient = new OrderBookStreamClient({}, undefined, MockWebSocketClass as unknown as new (url: string, protocols?: string | string[]) => IWebSocket);
      expect(defaultClient).toBeInstanceOf(OrderBookStreamClient);
      defaultClient.dispose();
    });

    it("should create client with custom config", () => {
      const customClient = new OrderBookStreamClient(
        { maxLevels: 50, spreadChangeThreshold: 0.002 },
        undefined,
        MockWebSocketClass as unknown as new (url: string, protocols?: string | string[]) => IWebSocket
      );
      expect(customClient).toBeInstanceOf(OrderBookStreamClient);
      customClient.dispose();
    });
  });

  describe("connect/disconnect", () => {
    it("should connect successfully", async () => {
      const connectedPromise = new Promise<void>((resolve) => {
        client.on("connected", () => resolve());
      });

      await client.connect();
      await connectedPromise;

      expect(client.isConnected()).toBe(true);
    });

    it("should emit connected event", async () => {
      const listener = vi.fn();
      client.on("connected", listener);

      await client.connect();
      await new Promise((r) => setTimeout(r, 50));

      expect(listener).toHaveBeenCalled();
    });

    it("should disconnect successfully", async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));

      const disconnectedPromise = new Promise<void>((resolve) => {
        client.on("disconnected", () => resolve());
      });

      client.disconnect();
      await disconnectedPromise;

      expect(client.isConnected()).toBe(false);
    });

    it("should throw when connecting disposed client", async () => {
      client.dispose();
      await expect(client.connect()).rejects.toThrow("Client has been disposed");
    });
  });

  describe("subscribe", () => {
    beforeEach(async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));
    });

    it("should subscribe to single token", async () => {
      const subscription = await client.subscribe({ tokenIds: "token123" });

      expect(subscription.id).toBeDefined();
      expect(subscription.tokenIds).toEqual(["token123"]);
      expect(subscription.confirmed).toBe(true);
    });

    it("should subscribe to multiple tokens", async () => {
      const subscription = await client.subscribe({ tokenIds: ["token1", "token2"] });

      expect(subscription.tokenIds).toEqual(["token1", "token2"]);
    });

    it("should track subscription", async () => {
      await client.subscribe({ tokenIds: "token123" });

      expect(client.isTokenSubscribed("token123")).toBe(true);
      expect(client.getSubscriptionCount()).toBe(1);
      expect(client.getSubscribedTokenCount()).toBe(1);
    });

    it("should throw when not connected", async () => {
      client.disconnect();
      await new Promise((r) => setTimeout(r, 50));

      await expect(client.subscribe({ tokenIds: "token123" })).rejects.toThrow("Not connected");
    });

    it("should throw for empty token IDs", async () => {
      await expect(client.subscribe({ tokenIds: [] })).rejects.toThrow("At least one token ID is required");
    });
  });

  describe("unsubscribe", () => {
    beforeEach(async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));
    });

    it("should unsubscribe by subscription ID", async () => {
      const subscription = await client.subscribe({ tokenIds: "token123" });
      await client.unsubscribe(subscription.id);

      expect(client.isTokenSubscribed("token123")).toBe(false);
    });

    it("should unsubscribe by token ID", async () => {
      await client.subscribe({ tokenIds: "token123" });
      await client.unsubscribeToken("token123");

      expect(client.isTokenSubscribed("token123")).toBe(false);
    });

    it("should throw for unknown subscription", async () => {
      await expect(client.unsubscribe("unknown")).rejects.toThrow("Subscription not found");
    });

    it("should throw for unknown token", async () => {
      await expect(client.unsubscribeToken("unknown")).rejects.toThrow("Token not subscribed");
    });

    it("should unsubscribe all", async () => {
      await client.subscribe({ tokenIds: "token1" });
      await client.subscribe({ tokenIds: "token2" });

      await client.unsubscribeAll();

      expect(client.getSubscriptionCount()).toBe(0);
    });
  });

  describe("order book getters", () => {
    beforeEach(async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));
      await client.subscribe({ tokenIds: "token123" });
    });

    it("should return empty order book initially", () => {
      const book = client.getOrderBook("token123");
      expect(book).toBeDefined();
      expect(book!.bids).toEqual([]);
      expect(book!.asks).toEqual([]);
    });

    it("should return undefined for unknown token", () => {
      expect(client.getOrderBook("unknown")).toBeUndefined();
    });

    it("should return stats for token", () => {
      const stats = client.getStats("token123");
      expect(stats).not.toBeNull();
      expect(stats!.assetId).toBe("token123");
    });

    it("should return null stats for unknown token", () => {
      expect(client.getStats("unknown")).toBeNull();
    });

    it("should get best bid/ask", () => {
      expect(client.getBestBid("token123")).toBeUndefined();
      expect(client.getBestAsk("token123")).toBeUndefined();
    });
  });

  describe("event handling", () => {
    it("should add and remove event listeners", () => {
      const listener = vi.fn();
      const unsubscribe = client.on("orderBookUpdate", listener);

      expect(client["listeners"].orderBookUpdate).toContain(listener);

      unsubscribe();
      expect(client["listeners"].orderBookUpdate).not.toContain(listener);
    });

    it("should handle once listeners", async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));

      const listener = vi.fn();
      // Use connected event which is reliably emitted
      client.once("connected", listener);

      // Trigger a reconnect scenario by disconnecting and reconnecting
      client.disconnect();
      await new Promise((r) => setTimeout(r, 50));
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));

      // Should have been called once
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should remove all listeners for event", () => {
      client.on("orderBookUpdate", vi.fn());
      client.on("orderBookUpdate", vi.fn());

      client.removeAllListeners("orderBookUpdate");

      expect(client["listeners"].orderBookUpdate.length).toBe(0);
    });

    it("should remove all listeners", () => {
      client.on("orderBookUpdate", vi.fn());
      client.on("spreadChange", vi.fn());

      client.removeAllListeners();

      expect(client["listeners"].orderBookUpdate.length).toBe(0);
      expect(client["listeners"].spreadChange.length).toBe(0);
    });
  });

  describe("dispose", () => {
    it("should clean up on dispose", async () => {
      await client.connect();
      await new Promise((r) => setTimeout(r, 50));
      await client.subscribe({ tokenIds: "token123" });

      client.dispose();

      expect(client["disposed"]).toBe(true);
      expect(client.getSubscriptionCount()).toBe(0);
    });

    it("should be idempotent", () => {
      client.dispose();
      client.dispose();
      // Should not throw
    });
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe("Shared OrderBookStreamClient", () => {
  afterEach(() => {
    resetSharedOrderBookStreamClient();
  });

  it("should return same instance on multiple calls", () => {
    const client1 = getSharedOrderBookStreamClient();
    const client2 = getSharedOrderBookStreamClient();

    expect(client1).toBe(client2);
  });

  it("should set custom shared client", () => {
    const customClient = createOrderBookStreamClient();
    setSharedOrderBookStreamClient(customClient);

    expect(getSharedOrderBookStreamClient()).toBe(customClient);
  });

  it("should reset shared client", () => {
    const client1 = getSharedOrderBookStreamClient();
    resetSharedOrderBookStreamClient();
    const client2 = getSharedOrderBookStreamClient();

    expect(client1).not.toBe(client2);
  });

  it("should dispose old client when setting new one", () => {
    const client1 = getSharedOrderBookStreamClient();
    const disposeSpy = vi.spyOn(client1, "dispose");

    const newClient = createOrderBookStreamClient();
    setSharedOrderBookStreamClient(newClient);

    expect(disposeSpy).toHaveBeenCalled();
  });
});

// ============================================================================
// createOrderBookStreamClient Tests
// ============================================================================

describe("createOrderBookStreamClient", () => {
  it("should create a new client instance", () => {
    const client = createOrderBookStreamClient();
    expect(client).toBeInstanceOf(OrderBookStreamClient);
    client.dispose();
  });

  it("should accept custom config", () => {
    const client = createOrderBookStreamClient({ maxLevels: 50 });
    expect(client).toBeInstanceOf(OrderBookStreamClient);
    client.dispose();
  });
});
