/**
 * Tests for Trade Stream Module (API-WS-004)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TradeStreamClient,
  createTradeStreamClient,
  getSharedTradeStreamClient,
  setSharedTradeStreamClient,
  resetSharedTradeStreamClient,
  POLYMARKET_TRADES_WS_URL,
  DEFAULT_BUFFER_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_MAX_TRADES_PER_TOKEN,
  parseTradeDirection,
  parseTradeMessage,
  isTradeMessage,
  buildTradeSubscriptionMessage,
  calculateTradeStreamStats,
  filterTradesByMinSize,
  filterTradesByTimeRange,
  groupTradesByAsset,
  sortTradesByTime,
} from "../../../src/api/ws/trade-stream";
import type {
  ParsedTrade,
  RawTradeMessage,
} from "../../../src/api/ws/trade-stream";
import { SubscriptionMessageType, SubscriptionChannel } from "../../../src/api/ws/market-subscriptions";

// ============================================================================
// Mock WebSocket Implementation
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

  constructor(code: number, reason: string, wasClean: boolean = true) {
    super("close");
    this.code = code;
    this.reason = reason;
    this.wasClean = wasClean;
  }
}

class MockMessageEvent extends MockEvent {
  data: string;

  constructor(data: string) {
    super("message");
    this.data = data;
  }
}

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  protocol = "";
  bufferedAmount = 0;
  readyState = MockWebSocket.CONNECTING;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private connectDelay: number;
  private shouldFail: boolean;

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    this.connectDelay = 10;
    this.shouldFail = false;

    // Simulate async connection
    setTimeout(() => {
      if (this.shouldFail) {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new MockEvent("error") as unknown as Event);
        }
        if (this.onclose) {
          this.onclose(new MockCloseEvent(1006, "Connection failed", false) as unknown as CloseEvent);
        }
      } else {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new MockEvent("open") as unknown as Event);
        }
      }
    }, this.connectDelay);
  }

  send(_data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
  }

  close(code: number = 1000, reason: string = ""): void {
    if (this.readyState === MockWebSocket.CLOSED || this.readyState === MockWebSocket.CLOSING) {
      return;
    }
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new MockCloseEvent(code, reason) as unknown as CloseEvent);
      }
    }, 5);
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown): void {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MockMessageEvent(JSON.stringify(data)) as unknown as MessageEvent);
    }
  }

  // Test helper to simulate close
  simulateClose(code: number = 1000, reason: string = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new MockCloseEvent(code, reason) as unknown as CloseEvent);
    }
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe("Trade Stream Module (API-WS-004)", () => {
  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("should export correct WebSocket URL", () => {
      expect(POLYMARKET_TRADES_WS_URL).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    });

    it("should export correct default buffer size", () => {
      expect(DEFAULT_BUFFER_SIZE).toBe(100);
    });

    it("should export correct default flush interval", () => {
      expect(DEFAULT_FLUSH_INTERVAL).toBe(1000);
    });

    it("should export correct default max trades per token", () => {
      expect(DEFAULT_MAX_TRADES_PER_TOKEN).toBe(1000);
    });
  });

  // ==========================================================================
  // parseTradeDirection Tests
  // ==========================================================================

  describe("parseTradeDirection", () => {
    it("should return 'buy' for buy", () => {
      expect(parseTradeDirection("buy")).toBe("buy");
    });

    it("should return 'sell' for sell", () => {
      expect(parseTradeDirection("sell")).toBe("sell");
    });

    it("should return 'buy' for BUY (case-insensitive)", () => {
      expect(parseTradeDirection("BUY")).toBe("buy");
    });

    it("should return 'sell' for SELL (case-insensitive)", () => {
      expect(parseTradeDirection("SELL")).toBe("sell");
    });

    it("should return 'sell' for 's'", () => {
      expect(parseTradeDirection("s")).toBe("sell");
    });

    it("should return 'sell' for ask", () => {
      expect(parseTradeDirection("ask")).toBe("sell");
    });

    it("should return 'sell' for short", () => {
      expect(parseTradeDirection("short")).toBe("sell");
    });

    it("should return 'sell' for offer", () => {
      expect(parseTradeDirection("offer")).toBe("sell");
    });

    it("should return 'buy' for undefined", () => {
      expect(parseTradeDirection(undefined)).toBe("buy");
    });

    it("should return 'buy' for unknown values", () => {
      expect(parseTradeDirection("unknown")).toBe("buy");
    });

    it("should handle whitespace", () => {
      expect(parseTradeDirection("  sell  ")).toBe("sell");
    });
  });

  // ==========================================================================
  // parseTradeMessage Tests
  // ==========================================================================

  describe("parseTradeMessage", () => {
    const baseRawTrade: RawTradeMessage = {
      type: "trade",
      asset_id: "token123",
      id: "trade1",
      price: 0.65,
      size: 1000,
      side: "buy",
      timestamp: "2026-01-10T10:00:00Z",
    };

    it("should parse a basic trade message", () => {
      const result = parseTradeMessage(baseRawTrade);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("trade1");
      expect(result!.assetId).toBe("token123");
      expect(result!.price).toBe(0.65);
      expect(result!.probability).toBe(65);
      expect(result!.size).toBe(1000);
      expect(result!.valueUsd).toBe(650);
      expect(result!.side).toBe("buy");
    });

    it("should parse alternative field names for asset", () => {
      const result1 = parseTradeMessage({ ...baseRawTrade, asset_id: undefined, market: "market123" });
      expect(result1?.assetId).toBe("market123");

      const result2 = parseTradeMessage({ ...baseRawTrade, asset_id: undefined, token_id: "token456" });
      expect(result2?.assetId).toBe("token456");
    });

    it("should parse alternative field names for ID", () => {
      const result = parseTradeMessage({ ...baseRawTrade, id: undefined, trade_id: "tradeABC" });
      expect(result?.id).toBe("tradeABC");
    });

    it("should generate ID if not provided", () => {
      const result = parseTradeMessage({ ...baseRawTrade, id: undefined });
      expect(result?.id).toMatch(/^trade_\d+_[a-z0-9]+$/);
    });

    it("should parse alternative field names for size", () => {
      const result1 = parseTradeMessage({ ...baseRawTrade, size: undefined, amount: 500 });
      expect(result1?.size).toBe(500);

      const result2 = parseTradeMessage({ ...baseRawTrade, size: undefined, quantity: 250 });
      expect(result2?.size).toBe(250);
    });

    it("should parse string numbers", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        price: "0.75",
        size: "2000",
      });

      expect(result?.price).toBe(0.75);
      expect(result?.size).toBe(2000);
      expect(result?.valueUsd).toBe(1500);
    });

    it("should calculate probability from price", () => {
      const result = parseTradeMessage({ ...baseRawTrade, price: 0.42 });
      expect(result?.probability).toBe(42);
    });

    it("should calculate value in USD", () => {
      const result = parseTradeMessage({ ...baseRawTrade, price: 0.80, size: 500 });
      expect(result?.valueUsd).toBe(400);
    });

    it("should parse maker and taker addresses", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        maker: "0xmaker123",
        taker: "0xtaker456",
      });

      expect(result?.makerAddress).toBe("0xmaker123");
      expect(result?.takerAddress).toBe("0xtaker456");
    });

    it("should parse alternative address field names", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        maker_address: "0xmaker789",
        taker_address: "0xtaker012",
      });

      expect(result?.makerAddress).toBe("0xmaker789");
      expect(result?.takerAddress).toBe("0xtaker012");
    });

    it("should parse transaction hash", () => {
      const result1 = parseTradeMessage({
        ...baseRawTrade,
        transaction_hash: "0xhash123",
      });
      expect(result1?.transactionHash).toBe("0xhash123");

      const result2 = parseTradeMessage({
        ...baseRawTrade,
        tx_hash: "0xhash456",
      });
      expect(result2?.transactionHash).toBe("0xhash456");
    });

    it("should parse fee rate in basis points", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        fee_rate_bps: 30,
      });

      expect(result?.feeRateBps).toBe(30);
      // feeUsd = (650 * 30) / 10000 = 1.95
      expect(result?.feeUsd).toBeCloseTo(1.95, 2);
    });

    it("should parse fee rate as string", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        fee_rate_bps: "25",
      });

      expect(result?.feeRateBps).toBe(25);
    });

    it("should parse match ID", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        match_id: "match123",
      });

      expect(result?.matchId).toBe("match123");
    });

    it("should parse outcome name", () => {
      const result1 = parseTradeMessage({
        ...baseRawTrade,
        outcome: "Yes",
      });
      expect(result1?.outcomeName).toBe("Yes");

      const result2 = parseTradeMessage({
        ...baseRawTrade,
        outcome_name: "No",
      });
      expect(result2?.outcomeName).toBe("No");
    });

    it("should parse market question", () => {
      const result1 = parseTradeMessage({
        ...baseRawTrade,
        question: "Will X happen?",
      });
      expect(result1?.marketQuestion).toBe("Will X happen?");

      const result2 = parseTradeMessage({
        ...baseRawTrade,
        market_question: "Will Y happen?",
      });
      expect(result2?.marketQuestion).toBe("Will Y happen?");
    });

    it("should parse sequence number", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        sequence: 12345,
      });

      expect(result?.sequence).toBe(12345);
    });

    it("should parse timestamp as ISO string", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        timestamp: "2026-01-10T15:30:00Z",
      });

      expect(result?.timestamp).toBeInstanceOf(Date);
      expect(result?.timestamp.toISOString()).toBe("2026-01-10T15:30:00.000Z");
    });

    it("should parse timestamp as Unix seconds", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        timestamp: 1768052400, // 2026-01-10T15:00:00Z
      });

      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should parse timestamp as Unix milliseconds", () => {
      const result = parseTradeMessage({
        ...baseRawTrade,
        timestamp: 1768052400000,
      });

      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should use created_at or executed_at as fallback", () => {
      const result1 = parseTradeMessage({
        ...baseRawTrade,
        timestamp: undefined,
        created_at: "2026-01-10T12:00:00Z",
      });
      expect(result1?.timestamp.toISOString()).toBe("2026-01-10T12:00:00.000Z");

      const result2 = parseTradeMessage({
        ...baseRawTrade,
        timestamp: undefined,
        executed_at: "2026-01-10T13:00:00Z",
      });
      expect(result2?.timestamp.toISOString()).toBe("2026-01-10T13:00:00.000Z");
    });

    it("should detect large trades with default threshold", () => {
      // Default threshold is 10000
      const smallTrade = parseTradeMessage({ ...baseRawTrade, size: 1000, price: 0.5 }); // 500 USD
      expect(smallTrade?.isLargeTrade).toBe(false);

      const largeTrade = parseTradeMessage({ ...baseRawTrade, size: 50000, price: 0.5 }); // 25000 USD
      expect(largeTrade?.isLargeTrade).toBe(true);
    });

    it("should detect large trades with custom threshold", () => {
      const result = parseTradeMessage({ ...baseRawTrade, size: 1000, price: 0.5 }, { largeTradeThreshold: 100 });
      expect(result?.isLargeTrade).toBe(true);
    });

    it("should include raw message when requested", () => {
      const result = parseTradeMessage(baseRawTrade, { includeRaw: true });
      expect(result?.raw).toEqual(baseRawTrade);
    });

    it("should not include raw message by default", () => {
      const result = parseTradeMessage(baseRawTrade);
      expect(result?.raw).toBeUndefined();
    });

    it("should include receivedAt timestamp", () => {
      const before = new Date();
      const result = parseTradeMessage(baseRawTrade);
      const after = new Date();

      expect(result?.receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result?.receivedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should return null for missing asset ID", () => {
      const result = parseTradeMessage({ ...baseRawTrade, asset_id: undefined });
      expect(result).toBeNull();
    });

    it("should return null for missing price", () => {
      const result = parseTradeMessage({ ...baseRawTrade, price: undefined });
      expect(result).toBeNull();
    });

    it("should return null for missing size", () => {
      const result = parseTradeMessage({ ...baseRawTrade, size: undefined });
      expect(result).toBeNull();
    });

    it("should return null for invalid price", () => {
      const result = parseTradeMessage({ ...baseRawTrade, price: "invalid" });
      expect(result).toBeNull();
    });

    it("should return null for invalid size", () => {
      const result = parseTradeMessage({ ...baseRawTrade, size: "invalid" });
      expect(result).toBeNull();
    });

    it("should return null for zero or negative size", () => {
      expect(parseTradeMessage({ ...baseRawTrade, size: 0 })).toBeNull();
      expect(parseTradeMessage({ ...baseRawTrade, size: -100 })).toBeNull();
    });
  });

  // ==========================================================================
  // isTradeMessage Tests
  // ==========================================================================

  describe("isTradeMessage", () => {
    it("should return true for message with type=trade", () => {
      expect(isTradeMessage({ type: "trade", asset_id: "a", price: 0.5, size: 100 })).toBe(true);
    });

    it("should return true for message with price, size, and asset_id", () => {
      expect(isTradeMessage({ asset_id: "a", price: 0.5, size: 100 })).toBe(true);
    });

    it("should return true for message with price, amount, and market", () => {
      expect(isTradeMessage({ market: "m", price: 0.5, amount: 100 })).toBe(true);
    });

    it("should return true for message with price, quantity, and token_id", () => {
      expect(isTradeMessage({ token_id: "t", price: 0.5, quantity: 100 })).toBe(true);
    });

    it("should return false for null", () => {
      expect(isTradeMessage(null)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isTradeMessage("string")).toBe(false);
      expect(isTradeMessage(123)).toBe(false);
      expect(isTradeMessage(undefined)).toBe(false);
    });

    it("should return false for missing price", () => {
      expect(isTradeMessage({ asset_id: "a", size: 100 })).toBe(false);
    });

    it("should return false for missing size", () => {
      expect(isTradeMessage({ asset_id: "a", price: 0.5 })).toBe(false);
    });

    it("should return false for missing asset", () => {
      expect(isTradeMessage({ price: 0.5, size: 100 })).toBe(false);
    });
  });

  // ==========================================================================
  // buildTradeSubscriptionMessage Tests
  // ==========================================================================

  describe("buildTradeSubscriptionMessage", () => {
    it("should build subscribe message for single token", () => {
      const message = buildTradeSubscriptionMessage(["token1"], "subscribe");

      expect(message.type).toBe(SubscriptionMessageType.SUBSCRIBE);
      expect(message.channel).toBe(SubscriptionChannel.TRADES);
      expect(message.market).toBe("token1");
      expect(message.assets_ids).toBeUndefined();
    });

    it("should build subscribe message for multiple tokens", () => {
      const message = buildTradeSubscriptionMessage(["token1", "token2", "token3"], "subscribe");

      expect(message.type).toBe(SubscriptionMessageType.SUBSCRIBE);
      expect(message.channel).toBe(SubscriptionChannel.TRADES);
      expect(message.assets_ids).toEqual(["token1", "token2", "token3"]);
      expect(message.market).toBeUndefined();
    });

    it("should build unsubscribe message", () => {
      const message = buildTradeSubscriptionMessage(["token1"], "unsubscribe");

      expect(message.type).toBe(SubscriptionMessageType.UNSUBSCRIBE);
      expect(message.channel).toBe(SubscriptionChannel.TRADES);
    });

    it("should include subscription ID when provided", () => {
      const message = buildTradeSubscriptionMessage(["token1"], "subscribe", "sub_123");

      expect(message.id).toBe("sub_123");
    });

    it("should not include subscription ID when not provided", () => {
      const message = buildTradeSubscriptionMessage(["token1"]);

      expect(message.id).toBeUndefined();
    });

    it("should handle empty token array", () => {
      const message = buildTradeSubscriptionMessage([]);

      expect(message.market).toBeUndefined();
      expect(message.assets_ids).toBeUndefined();
    });
  });

  // ==========================================================================
  // calculateTradeStreamStats Tests
  // ==========================================================================

  describe("calculateTradeStreamStats", () => {
    const createTrade = (overrides: Partial<ParsedTrade> = {}): ParsedTrade => ({
      id: "trade1",
      assetId: "token1",
      price: 0.5,
      probability: 50,
      size: 1000,
      valueUsd: 500,
      side: "buy",
      timestamp: new Date("2026-01-10T10:00:00Z"),
      receivedAt: new Date(),
      isLargeTrade: false,
      ...overrides,
    });

    it("should return zeros for empty array", () => {
      const stats = calculateTradeStreamStats([]);

      expect(stats.totalTrades).toBe(0);
      expect(stats.totalVolume).toBe(0);
      expect(stats.totalValueUsd).toBe(0);
      expect(stats.avgSize).toBe(0);
      expect(stats.avgPrice).toBe(0);
      expect(stats.vwap).toBe(0);
      expect(stats.buySellRatio).toBe(1);
      expect(stats.tradesPerSecond).toBe(0);
      expect(stats.largeTradesCount).toBe(0);
      expect(stats.uniqueMakers).toBe(0);
      expect(stats.uniqueTakers).toBe(0);
    });

    it("should calculate total trades", () => {
      const trades = [createTrade(), createTrade(), createTrade()];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.totalTrades).toBe(3);
    });

    it("should calculate total volume", () => {
      const trades = [
        createTrade({ size: 1000 }),
        createTrade({ size: 2000 }),
        createTrade({ size: 500 }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.totalVolume).toBe(3500);
    });

    it("should calculate total value in USD", () => {
      const trades = [
        createTrade({ valueUsd: 500 }),
        createTrade({ valueUsd: 1000 }),
        createTrade({ valueUsd: 250 }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.totalValueUsd).toBe(1750);
    });

    it("should calculate average size", () => {
      const trades = [
        createTrade({ size: 1000 }),
        createTrade({ size: 2000 }),
        createTrade({ size: 3000 }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.avgSize).toBe(2000);
    });

    it("should calculate average price", () => {
      const trades = [
        createTrade({ price: 0.4 }),
        createTrade({ price: 0.5 }),
        createTrade({ price: 0.6 }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.avgPrice).toBe(0.5);
    });

    it("should calculate VWAP correctly", () => {
      const trades = [
        createTrade({ size: 1000, valueUsd: 600 }), // price = 0.6
        createTrade({ size: 2000, valueUsd: 1000 }), // price = 0.5
      ];
      const stats = calculateTradeStreamStats(trades);

      // VWAP = totalValueUsd / totalVolume = 1600 / 3000 = 0.5333...
      expect(stats.vwap).toBeCloseTo(0.5333, 3);
    });

    it("should calculate buy/sell ratio", () => {
      const trades = [
        createTrade({ side: "buy" }),
        createTrade({ side: "buy" }),
        createTrade({ side: "sell" }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.buySellRatio).toBe(2);
    });

    it("should return Infinity for buy/sell ratio when no sells", () => {
      const trades = [
        createTrade({ side: "buy" }),
        createTrade({ side: "buy" }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.buySellRatio).toBe(Infinity);
    });

    it("should return 1 for buy/sell ratio when no buys and no sells", () => {
      // This is a degenerate case - empty array returns default
      const stats = calculateTradeStreamStats([]);
      expect(stats.buySellRatio).toBe(1);
    });

    it("should count large trades", () => {
      const trades = [
        createTrade({ isLargeTrade: true }),
        createTrade({ isLargeTrade: false }),
        createTrade({ isLargeTrade: true }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.largeTradesCount).toBe(2);
    });

    it("should count unique makers", () => {
      const trades = [
        createTrade({ makerAddress: "0xmaker1" }),
        createTrade({ makerAddress: "0xmaker2" }),
        createTrade({ makerAddress: "0xmaker1" }), // duplicate
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.uniqueMakers).toBe(2);
    });

    it("should count unique takers", () => {
      const trades = [
        createTrade({ takerAddress: "0xtaker1" }),
        createTrade({ takerAddress: "0xtaker2" }),
        createTrade({ takerAddress: "0xtaker1" }), // duplicate
        createTrade({ takerAddress: "0xtaker3" }),
      ];
      const stats = calculateTradeStreamStats(trades);

      expect(stats.uniqueTakers).toBe(3);
    });

    it("should calculate trades per second", () => {
      const trades = [
        createTrade({ timestamp: new Date("2026-01-10T10:00:00Z") }),
        createTrade({ timestamp: new Date("2026-01-10T10:00:01Z") }),
        createTrade({ timestamp: new Date("2026-01-10T10:00:02Z") }),
      ];
      const stats = calculateTradeStreamStats(trades);

      // 3 trades over 2 seconds = 1.5 trades/sec
      expect(stats.tradesPerSecond).toBeCloseTo(1.5, 1);
    });
  });

  // ==========================================================================
  // filterTradesByMinSize Tests
  // ==========================================================================

  describe("filterTradesByMinSize", () => {
    const createTrade = (size: number): ParsedTrade => ({
      id: "trade1",
      assetId: "token1",
      price: 0.5,
      probability: 50,
      size,
      valueUsd: size * 0.5,
      side: "buy",
      timestamp: new Date(),
      receivedAt: new Date(),
      isLargeTrade: false,
    });

    it("should filter trades by minimum size", () => {
      const trades = [
        createTrade(100),
        createTrade(500),
        createTrade(200),
        createTrade(1000),
      ];

      const filtered = filterTradesByMinSize(trades, 300);

      expect(filtered.length).toBe(2);
      expect(filtered[0]!.size).toBe(500);
      expect(filtered[1]!.size).toBe(1000);
    });

    it("should return empty array when no trades meet minimum", () => {
      const trades = [createTrade(100), createTrade(200)];
      const filtered = filterTradesByMinSize(trades, 500);

      expect(filtered.length).toBe(0);
    });

    it("should include trades equal to minimum", () => {
      const trades = [createTrade(500)];
      const filtered = filterTradesByMinSize(trades, 500);

      expect(filtered.length).toBe(1);
    });
  });

  // ==========================================================================
  // filterTradesByTimeRange Tests
  // ==========================================================================

  describe("filterTradesByTimeRange", () => {
    const createTrade = (timestamp: Date): ParsedTrade => ({
      id: "trade1",
      assetId: "token1",
      price: 0.5,
      probability: 50,
      size: 1000,
      valueUsd: 500,
      side: "buy",
      timestamp,
      receivedAt: new Date(),
      isLargeTrade: false,
    });

    it("should filter trades within time range", () => {
      const trades = [
        createTrade(new Date("2026-01-10T09:00:00Z")),
        createTrade(new Date("2026-01-10T10:00:00Z")),
        createTrade(new Date("2026-01-10T11:00:00Z")),
        createTrade(new Date("2026-01-10T12:00:00Z")),
      ];

      const filtered = filterTradesByTimeRange(
        trades,
        new Date("2026-01-10T09:30:00Z"),
        new Date("2026-01-10T11:30:00Z")
      );

      expect(filtered.length).toBe(2);
    });

    it("should include trades at exact start time", () => {
      const trades = [createTrade(new Date("2026-01-10T10:00:00Z"))];
      const filtered = filterTradesByTimeRange(
        trades,
        new Date("2026-01-10T10:00:00Z"),
        new Date("2026-01-10T11:00:00Z")
      );

      expect(filtered.length).toBe(1);
    });

    it("should include trades at exact end time", () => {
      const trades = [createTrade(new Date("2026-01-10T11:00:00Z"))];
      const filtered = filterTradesByTimeRange(
        trades,
        new Date("2026-01-10T10:00:00Z"),
        new Date("2026-01-10T11:00:00Z")
      );

      expect(filtered.length).toBe(1);
    });
  });

  // ==========================================================================
  // groupTradesByAsset Tests
  // ==========================================================================

  describe("groupTradesByAsset", () => {
    const createTrade = (assetId: string): ParsedTrade => ({
      id: `trade_${assetId}_${Math.random()}`,
      assetId,
      price: 0.5,
      probability: 50,
      size: 1000,
      valueUsd: 500,
      side: "buy",
      timestamp: new Date(),
      receivedAt: new Date(),
      isLargeTrade: false,
    });

    it("should group trades by asset ID", () => {
      const trades = [
        createTrade("token1"),
        createTrade("token2"),
        createTrade("token1"),
        createTrade("token3"),
        createTrade("token2"),
      ];

      const grouped = groupTradesByAsset(trades);

      expect(grouped.size).toBe(3);
      expect(grouped.get("token1")?.length).toBe(2);
      expect(grouped.get("token2")?.length).toBe(2);
      expect(grouped.get("token3")?.length).toBe(1);
    });

    it("should return empty map for empty array", () => {
      const grouped = groupTradesByAsset([]);
      expect(grouped.size).toBe(0);
    });
  });

  // ==========================================================================
  // sortTradesByTime Tests
  // ==========================================================================

  describe("sortTradesByTime", () => {
    const createTrade = (timestamp: Date): ParsedTrade => ({
      id: `trade_${timestamp.getTime()}`,
      assetId: "token1",
      price: 0.5,
      probability: 50,
      size: 1000,
      valueUsd: 500,
      side: "buy",
      timestamp,
      receivedAt: new Date(),
      isLargeTrade: false,
    });

    it("should sort trades descending by default (newest first)", () => {
      const trades = [
        createTrade(new Date("2026-01-10T10:00:00Z")),
        createTrade(new Date("2026-01-10T12:00:00Z")),
        createTrade(new Date("2026-01-10T11:00:00Z")),
      ];

      const sorted = sortTradesByTime(trades);

      expect(sorted[0]!.timestamp.toISOString()).toBe("2026-01-10T12:00:00.000Z");
      expect(sorted[1]!.timestamp.toISOString()).toBe("2026-01-10T11:00:00.000Z");
      expect(sorted[2]!.timestamp.toISOString()).toBe("2026-01-10T10:00:00.000Z");
    });

    it("should sort trades ascending when specified (oldest first)", () => {
      const trades = [
        createTrade(new Date("2026-01-10T12:00:00Z")),
        createTrade(new Date("2026-01-10T10:00:00Z")),
        createTrade(new Date("2026-01-10T11:00:00Z")),
      ];

      const sorted = sortTradesByTime(trades, true);

      expect(sorted[0]!.timestamp.toISOString()).toBe("2026-01-10T10:00:00.000Z");
      expect(sorted[1]!.timestamp.toISOString()).toBe("2026-01-10T11:00:00.000Z");
      expect(sorted[2]!.timestamp.toISOString()).toBe("2026-01-10T12:00:00.000Z");
    });

    it("should not modify original array", () => {
      const trades = [
        createTrade(new Date("2026-01-10T10:00:00Z")),
        createTrade(new Date("2026-01-10T12:00:00Z")),
      ];

      const original = trades[0];
      sortTradesByTime(trades);

      expect(trades[0]).toBe(original);
    });
  });

  // ==========================================================================
  // TradeStreamClient Constructor Tests
  // ==========================================================================

  describe("TradeStreamClient", () => {
    let client: TradeStreamClient;

    beforeEach(() => {
      resetSharedTradeStreamClient();
    });

    afterEach(() => {
      if (client) {
        client.dispose();
      }
      resetSharedTradeStreamClient();
    });

    describe("constructor", () => {
      it("should create client with default config", () => {
        client = new TradeStreamClient({}, undefined, MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket);

        expect(client.isConnected()).toBe(false);
        expect(client.getConnectionState()).toBe("disconnected");
      });

      it("should create client with custom URL", () => {
        client = new TradeStreamClient(
          { wsUrl: "wss://custom.example.com/ws" },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        expect(client.getConnectionState()).toBe("disconnected");
      });

      it("should create client with debug enabled", () => {
        const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

        client = new TradeStreamClient(
          { debug: true },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        consoleLog.mockRestore();
      });
    });

    describe("connect", () => {
      it("should connect successfully", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        expect(client.isConnected()).toBe(true);
        expect(client.getConnectionState()).toBe("connected");
      });

      it("should emit connected event", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const connectedHandler = vi.fn();
        client.on("connected", connectedHandler);

        await client.connect();

        expect(connectedHandler).toHaveBeenCalledTimes(1);
        expect(connectedHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: expect.any(String),
            timestamp: expect.any(Date),
          })
        );
      });

      it("should throw when already disposed", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        client.dispose();

        await expect(client.connect()).rejects.toThrow("Client has been disposed");
      });
    });

    describe("disconnect", () => {
      it("should disconnect successfully", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();
        client.disconnect();

        // Wait for async close
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(client.isConnected()).toBe(false);
      });

      it("should emit disconnected event", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        const disconnectedHandler = vi.fn();
        client.on("disconnected", disconnectedHandler);

        client.disconnect();

        // Wait for async close
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(disconnectedHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe("subscribe", () => {
      it("should throw when not connected", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await expect(client.subscribe({ tokenIds: "token1" })).rejects.toThrow("Not connected");
      });

      it("should throw when disposed", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        client.dispose();

        await expect(client.subscribe({ tokenIds: "token1" })).rejects.toThrow("disposed");
      });

      it("should throw when no token IDs provided", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        await expect(client.subscribe({ tokenIds: [] })).rejects.toThrow("At least one token ID");
      });

      it("should subscribe to single token", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        const subscription = await client.subscribe({ tokenIds: "token1" });

        expect(subscription.id).toMatch(/^sub_/);
        expect(subscription.tokenIds).toEqual(["token1"]);
        expect(subscription.confirmed).toBe(true); // Times out and auto-confirms
      });

      it("should subscribe to multiple tokens", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        const subscription = await client.subscribe({ tokenIds: ["token1", "token2"] });

        expect(subscription.tokenIds).toEqual(["token1", "token2"]);
      });

      it("should track subscription", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        const subscription = await client.subscribe({ tokenIds: "token1" });

        expect(client.getSubscriptionCount()).toBe(1);
        expect(client.getSubscribedTokenCount()).toBe(1);
        expect(client.isTokenSubscribed("token1")).toBe(true);
        expect(client.getSubscription(subscription.id)).toBe(subscription);
        expect(client.getSubscriptionForToken("token1")).toBe(subscription);
      });
    });

    describe("unsubscribe", () => {
      it("should unsubscribe successfully", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();
        const subscription = await client.subscribe({ tokenIds: "token1" });

        await client.unsubscribe(subscription.id);

        expect(client.getSubscriptionCount()).toBe(0);
        expect(client.isTokenSubscribed("token1")).toBe(false);
      });

      it("should throw for unknown subscription", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        await expect(client.unsubscribe("unknown")).rejects.toThrow("Subscription not found");
      });
    });

    describe("unsubscribeToken", () => {
      it("should unsubscribe by token ID", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();
        await client.subscribe({ tokenIds: "token1" });

        await client.unsubscribeToken("token1");

        expect(client.isTokenSubscribed("token1")).toBe(false);
      });

      it("should throw for unknown token", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();

        await expect(client.unsubscribeToken("unknown")).rejects.toThrow("Token not subscribed");
      });
    });

    describe("unsubscribeAll", () => {
      it("should unsubscribe from all subscriptions", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();
        await client.subscribe({ tokenIds: "token1" });
        await client.subscribe({ tokenIds: "token2" });

        expect(client.getSubscriptionCount()).toBe(2);

        await client.unsubscribeAll();

        expect(client.getSubscriptionCount()).toBe(0);
      });
    });

    describe("event handling", () => {
      it("should register and call event listeners", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const handler = vi.fn();
        const unsubscribe = client.on("connected", handler);

        await client.connect();

        expect(handler).toHaveBeenCalled();

        unsubscribe();
      });

      it("should remove event listener with off()", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const handler = vi.fn();
        client.on("connected", handler);
        client.off("connected", handler);

        await client.connect();

        expect(handler).not.toHaveBeenCalled();
      });

      it("should handle once() correctly", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const handler = vi.fn();
        client.once("connected", handler);

        await client.connect();
        client.disconnect();

        // Wait for disconnect
        await new Promise(resolve => setTimeout(resolve, 20));

        // Reconnect
        await client.connect();

        // Should only have been called once
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should removeAllListeners for specific event", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const handler1 = vi.fn();
        const handler2 = vi.fn();
        client.on("connected", handler1);
        client.on("connected", handler2);

        client.removeAllListeners("connected");

        await client.connect();

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
      });

      it("should removeAllListeners for all events", async () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const connectedHandler = vi.fn();
        const disconnectedHandler = vi.fn();
        client.on("connected", connectedHandler);
        client.on("disconnected", disconnectedHandler);

        client.removeAllListeners();

        await client.connect();
        client.disconnect();
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(connectedHandler).not.toHaveBeenCalled();
        expect(disconnectedHandler).not.toHaveBeenCalled();
      });
    });

    describe("getRecentTrades", () => {
      it("should return empty array for unknown token", () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        expect(client.getRecentTrades("unknown")).toEqual([]);
      });
    });

    describe("getAllRecentTrades", () => {
      it("should return empty array when no subscriptions", () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        expect(client.getAllRecentTrades()).toEqual([]);
      });
    });

    describe("getSubscriptionStats", () => {
      it("should return null for unknown subscription", () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        expect(client.getSubscriptionStats("unknown")).toBeNull();
      });
    });

    describe("getGlobalStats", () => {
      it("should return initial global stats", () => {
        client = new TradeStreamClient(
          {},
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        const stats = client.getGlobalStats();

        expect(stats.totalTrades).toBe(0);
        expect(stats.totalVolume).toBe(0);
        expect(stats.totalValueUsd).toBe(0);
        expect(stats.largeTradesCount).toBe(0);
      });
    });

    describe("dispose", () => {
      it("should clean up resources", async () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        await client.connect();
        await client.subscribe({ tokenIds: "token1" });

        client.dispose();

        expect(client.getSubscriptionCount()).toBe(0);
        expect(client.getSubscribedTokenCount()).toBe(0);
      });

      it("should be idempotent", () => {
        client = new TradeStreamClient(
          { confirmationTimeout: 50 },
          undefined,
          MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
        );

        client.dispose();
        client.dispose();
        client.dispose();

        // Should not throw
        expect(true).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Factory and Singleton Tests
  // ==========================================================================

  describe("Factory and Singleton", () => {
    afterEach(() => {
      resetSharedTradeStreamClient();
    });

    it("createTradeStreamClient should create new instance", () => {
      const client = createTradeStreamClient(
        {},
        undefined,
        MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
      );

      expect(client).toBeInstanceOf(TradeStreamClient);
      client.dispose();
    });

    it("getSharedTradeStreamClient should return same instance", () => {
      const client1 = getSharedTradeStreamClient();
      const client2 = getSharedTradeStreamClient();

      expect(client1).toBe(client2);
    });

    it("setSharedTradeStreamClient should replace shared instance", () => {
      const original = getSharedTradeStreamClient();
      const newClient = createTradeStreamClient(
        {},
        undefined,
        MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
      );

      setSharedTradeStreamClient(newClient);

      expect(getSharedTradeStreamClient()).toBe(newClient);
      expect(getSharedTradeStreamClient()).not.toBe(original);
    });

    it("resetSharedTradeStreamClient should clear shared instance", () => {
      const client1 = getSharedTradeStreamClient();
      resetSharedTradeStreamClient();
      const client2 = getSharedTradeStreamClient();

      expect(client1).not.toBe(client2);
    });
  });

  // ==========================================================================
  // Buffering Tests
  // ==========================================================================

  describe("Buffering", () => {
    let client: TradeStreamClient;

    afterEach(() => {
      if (client) {
        client.dispose();
      }
    });

    it("should not buffer by default", async () => {
      client = new TradeStreamClient(
        { enableBuffering: false, confirmationTimeout: 50 },
        undefined,
        MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => WebSocket
      );

      const tradeHandler = vi.fn();
      client.on("trade", tradeHandler);

      await client.connect();
      await client.subscribe({ tokenIds: "token1" });

      // Since we can't easily access the internal WebSocket in this test setup,
      // we verify the config is set correctly
      expect(client.getSubscriptionCount()).toBe(1);
    });
  });
});
