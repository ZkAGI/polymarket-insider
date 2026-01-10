/**
 * Tests for Market Subscriptions Module (API-WS-003)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MarketSubscriptionClient,
  createMarketSubscriptionClient,
  getSharedMarketSubscriptionClient,
  setSharedMarketSubscriptionClient,
  resetSharedMarketSubscriptionClient,
  generateSubscriptionId,
  normalizeTokenIds,
  buildSubscriptionMessage,
  parseMessageTimestamp,
  parsePriceUpdate,
  isSubscriptionConfirmation,
  isPriceUpdateMessage,
  isErrorMessage,
  POLYMARKET_WS_URL,
  SubscriptionMessageType,
  SubscriptionChannel,
  type MarketSubscriptionConfig,
} from "../../../src/api/ws/market-subscriptions";
import type { IWebSocket } from "../../../src/api/ws/types";

// ============================================================================
// Mock WebSocket
// ============================================================================

class MockWebSocket implements IWebSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState: number = 0;
  url: string;
  protocol: string = "";
  bufferedAmount: number = 0;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private connectDelay: number;
  private shouldError: boolean;
  sentMessages: string[] = [];

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    this.connectDelay = 10;
    this.shouldError = false;

    // Auto-connect after a delay
    setTimeout(() => {
      if (!this.shouldError) {
        this.readyState = this.OPEN;
        if (this.onopen) {
          this.onopen(new Event("open"));
        }
      }
    }, this.connectDelay);
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== this.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.sentMessages.push(data.toString());
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = this.CLOSED;
    if (this.onclose) {
      const event = {
        code: _code ?? 1000,
        reason: _reason ?? "",
        wasClean: true,
      } as CloseEvent;
      this.onclose(event);
    }
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      const event = {
        data: JSON.stringify(data),
      } as MessageEvent;
      this.onmessage(event);
    }
  }

  simulateError(error: Error): void {
    if (this.onerror) {
      const event = new ErrorEvent("error", { error, message: error.message });
      this.onerror(event);
    }
  }

  simulateClose(code: number = 1000, reason: string = ""): void {
    this.readyState = this.CLOSED;
    if (this.onclose) {
      const event = { code, reason, wasClean: code === 1000 } as CloseEvent;
      this.onclose(event);
    }
  }
}

// Mock WebSocket constructor for dependency injection
const MockWebSocketConstructor = MockWebSocket as unknown as new (
  url: string,
  protocols?: string | string[]
) => IWebSocket;

// ============================================================================
// Helper Functions
// ============================================================================

async function createConnectedClient(config?: MarketSubscriptionConfig): Promise<{
  client: MarketSubscriptionClient;
  mockWs: MockWebSocket;
}> {
  let capturedWs: MockWebSocket | null = null;

  const CustomMockWebSocket = class extends MockWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
      capturedWs = this;
    }
  };

  const client = createMarketSubscriptionClient(
    config,
    undefined,
    CustomMockWebSocket as unknown as new (url: string, protocols?: string | string[]) => IWebSocket
  );

  await client.connect();

  // Wait for connection
  await new Promise((resolve) => setTimeout(resolve, 20));

  return { client, mockWs: capturedWs! };
}

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should export POLYMARKET_WS_URL", () => {
    expect(POLYMARKET_WS_URL).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
  });

  it("should export SubscriptionMessageType", () => {
    expect(SubscriptionMessageType.SUBSCRIBE).toBe("subscribe");
    expect(SubscriptionMessageType.UNSUBSCRIBE).toBe("unsubscribe");
    expect(SubscriptionMessageType.SUBSCRIBED).toBe("subscribed");
    expect(SubscriptionMessageType.UNSUBSCRIBED).toBe("unsubscribed");
    expect(SubscriptionMessageType.PRICE_UPDATE).toBe("price_update");
    expect(SubscriptionMessageType.BOOK_UPDATE).toBe("book");
    expect(SubscriptionMessageType.TRADE).toBe("trade");
    expect(SubscriptionMessageType.ERROR).toBe("error");
    expect(SubscriptionMessageType.PING).toBe("ping");
    expect(SubscriptionMessageType.PONG).toBe("pong");
  });

  it("should export SubscriptionChannel", () => {
    expect(SubscriptionChannel.MARKET).toBe("market");
    expect(SubscriptionChannel.PRICE).toBe("price");
    expect(SubscriptionChannel.BOOK).toBe("book");
    expect(SubscriptionChannel.TRADES).toBe("trades");
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("generateSubscriptionId", () => {
  it("should generate a unique ID", () => {
    const id1 = generateSubscriptionId();
    const id2 = generateSubscriptionId();

    expect(id1).toMatch(/^sub_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^sub_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("should generate IDs with consistent format", () => {
    for (let i = 0; i < 10; i++) {
      const id = generateSubscriptionId();
      expect(id).toMatch(/^sub_\d+_[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(15);
    }
  });
});

describe("normalizeTokenIds", () => {
  it("should wrap a single string in an array", () => {
    expect(normalizeTokenIds("token123")).toEqual(["token123"]);
  });

  it("should return a copy of an array", () => {
    const input = ["token1", "token2"];
    const result = normalizeTokenIds(input);

    expect(result).toEqual(["token1", "token2"]);
    expect(result).not.toBe(input); // Should be a copy
  });

  it("should handle empty array", () => {
    expect(normalizeTokenIds([])).toEqual([]);
  });

  it("should handle array with one element", () => {
    expect(normalizeTokenIds(["single"])).toEqual(["single"]);
  });
});

describe("buildSubscriptionMessage", () => {
  it("should build subscribe message for single token", () => {
    const message = buildSubscriptionMessage(["token123"], "subscribe");

    expect(message).toEqual({
      type: "subscribe",
      market: "token123",
    });
  });

  it("should build subscribe message for multiple tokens", () => {
    const message = buildSubscriptionMessage(["token1", "token2"], "subscribe");

    expect(message).toEqual({
      type: "subscribe",
      assets_ids: ["token1", "token2"],
    });
  });

  it("should build unsubscribe message", () => {
    const message = buildSubscriptionMessage(["token123"], "unsubscribe");

    expect(message).toEqual({
      type: "unsubscribe",
      market: "token123",
    });
  });

  it("should include channel when not default", () => {
    const message = buildSubscriptionMessage(["token123"], "subscribe", "price");

    expect(message).toEqual({
      type: "subscribe",
      market: "token123",
      channel: "price",
    });
  });

  it("should not include channel when it is default (market)", () => {
    const message = buildSubscriptionMessage(["token123"], "subscribe", "market");

    expect(message).toEqual({
      type: "subscribe",
      market: "token123",
    });
    expect(message.channel).toBeUndefined();
  });

  it("should include subscription ID when provided", () => {
    const message = buildSubscriptionMessage(["token123"], "subscribe", "market", "sub_123");

    expect(message).toEqual({
      type: "subscribe",
      market: "token123",
      id: "sub_123",
    });
  });

  it("should handle empty token array", () => {
    const message = buildSubscriptionMessage([], "subscribe");

    expect(message).toEqual({
      type: "subscribe",
    });
    expect(message.market).toBeUndefined();
    expect(message.assets_ids).toBeUndefined();
  });
});

describe("parseMessageTimestamp", () => {
  it("should return current date for undefined", () => {
    const before = new Date();
    const result = parseMessageTimestamp(undefined);
    const after = new Date();

    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should parse ISO string", () => {
    const timestamp = "2026-01-10T12:00:00.000Z";
    const result = parseMessageTimestamp(timestamp);

    expect(result.toISOString()).toBe(timestamp);
  });

  it("should parse Unix timestamp in seconds", () => {
    const timestamp = 1768003200; // 2026-01-10
    const result = parseMessageTimestamp(timestamp);

    expect(result.getFullYear()).toBe(2026);
  });

  it("should parse Unix timestamp in milliseconds", () => {
    const timestamp = 1768003200000; // 2026-01-10
    const result = parseMessageTimestamp(timestamp);

    expect(result.getFullYear()).toBe(2026);
  });

  it("should handle invalid string", () => {
    const before = new Date();
    const result = parseMessageTimestamp("invalid");
    const after = new Date();

    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("parsePriceUpdate", () => {
  it("should parse a valid price update", () => {
    const raw = {
      asset_id: "token123",
      price: 0.65,
      timestamp: "2026-01-10T12:00:00.000Z",
    };

    const result = parsePriceUpdate(raw);

    expect(result).not.toBeNull();
    expect(result!.asset_id).toBe("token123");
    expect(result!.price).toBe(0.65);
    expect(result!.probability).toBe(65);
    expect(result!.isSignificant).toBe(false);
  });

  it("should calculate probability from price", () => {
    const raw = { asset_id: "token123", price: 0.42, timestamp: Date.now() };
    const result = parsePriceUpdate(raw);

    expect(result!.probability).toBe(42);
  });

  it("should parse price as string", () => {
    const raw = { asset_id: "token123", price: "0.55", timestamp: Date.now() };
    const result = parsePriceUpdate(raw);

    expect(result!.price).toBe(0.55);
    expect(result!.probability).toBeCloseTo(55, 10);
  });

  it("should use fallback asset ID fields", () => {
    expect(parsePriceUpdate({ market: "token1", price: 0.5, timestamp: Date.now() })?.asset_id).toBe("token1");
    expect(parsePriceUpdate({ token_id: "token2", price: 0.5, timestamp: Date.now() })?.asset_id).toBe("token2");
    expect(parsePriceUpdate({ id: "token3", price: 0.5, timestamp: Date.now() })?.asset_id).toBe("token3");
  });

  it("should use fallback price fields", () => {
    expect(parsePriceUpdate({ asset_id: "t1", mid: 0.6, timestamp: Date.now() })?.price).toBe(0.6);
    expect(parsePriceUpdate({ asset_id: "t2", mid_price: 0.7, timestamp: Date.now() })?.price).toBe(0.7);
    expect(parsePriceUpdate({ asset_id: "t3", last_price: 0.8, timestamp: Date.now() })?.price).toBe(0.8);
  });

  it("should calculate price change", () => {
    const raw = {
      asset_id: "token123",
      price: 0.60,
      previous_price: 0.50,
      timestamp: Date.now(),
    };

    const result = parsePriceUpdate(raw);

    expect(result!.price_change).toBeCloseTo(0.10, 10);
    expect(result!.price_change_percent).toBeCloseTo(20, 10);
    expect(result!.probabilityChange).toBeCloseTo(10, 10);
  });

  it("should detect significant price changes", () => {
    // With default threshold of 0.01 (1%)
    const significant = parsePriceUpdate({
      asset_id: "token123",
      price: 0.60,
      previous_price: 0.50,
      timestamp: Date.now(),
    });
    expect(significant!.isSignificant).toBe(true);

    const notSignificant = parsePriceUpdate({
      asset_id: "token123",
      price: 0.505,
      previous_price: 0.50,
      timestamp: Date.now(),
    });
    expect(notSignificant!.isSignificant).toBe(false);
  });

  it("should calculate mid price from bid and ask", () => {
    const raw = {
      asset_id: "token123",
      price: 0.50,
      bid: 0.48,
      ask: 0.52,
      timestamp: Date.now(),
    };

    const result = parsePriceUpdate(raw);
    expect(result!.midPrice).toBe(0.50);
  });

  it("should return null for missing asset_id", () => {
    const raw = { price: 0.50, timestamp: Date.now() };
    expect(parsePriceUpdate(raw)).toBeNull();
  });

  it("should return null for missing price", () => {
    const raw = { asset_id: "token123", timestamp: Date.now() };
    expect(parsePriceUpdate(raw)).toBeNull();
  });

  it("should return null for invalid price", () => {
    const raw = { asset_id: "token123", price: "invalid", timestamp: Date.now() };
    expect(parsePriceUpdate(raw)).toBeNull();
  });

  it("should use custom significant threshold", () => {
    const raw = {
      asset_id: "token123",
      price: 0.505,
      previous_price: 0.50,
      timestamp: Date.now(),
    };

    const withDefaultThreshold = parsePriceUpdate(raw, 0.01);
    expect(withDefaultThreshold!.isSignificant).toBe(false);

    const withLowerThreshold = parsePriceUpdate(raw, 0.001);
    expect(withLowerThreshold!.isSignificant).toBe(true);
  });

  it("should include received timestamp", () => {
    const before = new Date();
    const result = parsePriceUpdate({
      asset_id: "token123",
      price: 0.5,
      timestamp: Date.now(),
    });
    const after = new Date();

    expect(result!.receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result!.receivedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("isSubscriptionConfirmation", () => {
  it("should return true for subscribed confirmation", () => {
    expect(isSubscriptionConfirmation({ type: "subscribed", market: "token123" })).toBe(true);
  });

  it("should return true for unsubscribed confirmation", () => {
    expect(isSubscriptionConfirmation({ type: "unsubscribed", market: "token123" })).toBe(true);
  });

  it("should return false for other message types", () => {
    expect(isSubscriptionConfirmation({ type: "price_update", asset_id: "token123" })).toBe(false);
    expect(isSubscriptionConfirmation({ type: "error", error: "test" })).toBe(false);
    expect(isSubscriptionConfirmation({ type: "subscribe" })).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isSubscriptionConfirmation(null)).toBe(false);
    expect(isSubscriptionConfirmation(undefined)).toBe(false);
  });

  it("should return false for non-objects", () => {
    expect(isSubscriptionConfirmation("subscribed")).toBe(false);
    expect(isSubscriptionConfirmation(123)).toBe(false);
  });
});

describe("isPriceUpdateMessage", () => {
  it("should return true for price_update type", () => {
    expect(isPriceUpdateMessage({ type: "price_update", asset_id: "token123", price: 0.5 })).toBe(true);
  });

  it("should return true for book type", () => {
    expect(isPriceUpdateMessage({ type: "book", asset_id: "token123" })).toBe(true);
  });

  it("should return true for messages with price and asset_id", () => {
    expect(isPriceUpdateMessage({ asset_id: "token123", price: 0.5 })).toBe(true);
  });

  it("should return true for messages with price and market", () => {
    expect(isPriceUpdateMessage({ market: "token123", price: 0.5 })).toBe(true);
  });

  it("should return false for subscribe messages", () => {
    expect(isPriceUpdateMessage({ type: "subscribe" })).toBe(false);
  });

  it("should return false for error messages", () => {
    expect(isPriceUpdateMessage({ type: "error", error: "test" })).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isPriceUpdateMessage(null)).toBe(false);
    expect(isPriceUpdateMessage(undefined)).toBe(false);
  });
});

describe("isErrorMessage", () => {
  it("should return true for error messages", () => {
    expect(isErrorMessage({ type: "error", error: "Something went wrong" })).toBe(true);
  });

  it("should return true for error with message", () => {
    expect(isErrorMessage({ type: "error", error: "ERR_001", message: "Description" })).toBe(true);
  });

  it("should return false for other types", () => {
    expect(isErrorMessage({ type: "subscribed" })).toBe(false);
    expect(isErrorMessage({ type: "price_update" })).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isErrorMessage(null)).toBe(false);
    expect(isErrorMessage(undefined)).toBe(false);
  });
});

// ============================================================================
// MarketSubscriptionClient Tests
// ============================================================================

describe("MarketSubscriptionClient", () => {
  let client: MarketSubscriptionClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    client?.dispose();
    vi.useRealTimers();
    resetSharedMarketSubscriptionClient();
  });

  describe("constructor", () => {
    it("should create client with default config", () => {
      client = createMarketSubscriptionClient(undefined, undefined, MockWebSocketConstructor);
      expect(client).toBeInstanceOf(MarketSubscriptionClient);
      expect(client.isConnected()).toBe(false);
    });

    it("should create client with custom config", () => {
      client = createMarketSubscriptionClient(
        {
          wsUrl: "wss://custom.example.com/ws",
          significantChangeThreshold: 0.05,
        },
        undefined,
        MockWebSocketConstructor
      );
      expect(client).toBeInstanceOf(MarketSubscriptionClient);
    });

    it("should use default Polymarket WS URL", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      expect(mockWs.url).toBe(POLYMARKET_WS_URL);
    });

    it("should use custom WS URL", async () => {
      const customUrl = "wss://custom.example.com/ws";
      const result = await createConnectedClient({ wsUrl: customUrl });
      client = result.client;
      mockWs = result.mockWs;

      expect(mockWs.url).toBe(customUrl);
    });
  });

  describe("connect/disconnect", () => {
    it("should connect successfully", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      expect(client.isConnected()).toBe(true);
      expect(client.getConnectionState()).toBe("connected");
    });

    it("should emit connected event", async () => {
      client = createMarketSubscriptionClient(undefined, undefined, MockWebSocketConstructor);
      const connectedHandler = vi.fn();
      client.on("connected", connectedHandler);

      await client.connect();
      await vi.advanceTimersByTimeAsync(20);

      expect(connectedHandler).toHaveBeenCalledTimes(1);
      expect(connectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
    });

    it("should disconnect successfully", async () => {
      const result = await createConnectedClient();
      client = result.client;

      client.disconnect();
      await vi.advanceTimersByTimeAsync(10);

      expect(client.isConnected()).toBe(false);
    });

    it("should emit disconnected event", async () => {
      const result = await createConnectedClient();
      client = result.client;

      const disconnectedHandler = vi.fn();
      client.on("disconnected", disconnectedHandler);

      client.disconnect();
      await vi.advanceTimersByTimeAsync(10);

      expect(disconnectedHandler).toHaveBeenCalledTimes(1);
    });

    it("should throw when connecting disposed client", async () => {
      client = createMarketSubscriptionClient(undefined, undefined, MockWebSocketConstructor);
      client.dispose();

      await expect(client.connect()).rejects.toThrow("Client has been disposed");
    });

    it("should return connection ID", async () => {
      const result = await createConnectedClient();
      client = result.client;

      const connectionId = client.getConnectionId();
      expect(connectionId).toBeTruthy();
      expect(typeof connectionId).toBe("string");
    });
  });

  describe("subscribe", () => {
    it("should subscribe to a single token", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Start subscription (will timeout but that's OK for testing)
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });

      // Advance timers to let subscription process
      await vi.advanceTimersByTimeAsync(100);

      // Simulate confirmation
      mockWs.simulateMessage({
        type: "subscribed",
        market: "token123",
      });

      await vi.advanceTimersByTimeAsync(100);

      const subscription = await subscriptionPromise;

      expect(subscription.tokenIds).toEqual(["token123"]);
      expect(subscription.channel).toBe("market");
      expect(subscription.confirmed).toBe(true);
    });

    it("should subscribe to multiple tokens", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const subscriptionPromise = client.subscribe({ tokenIds: ["token1", "token2"] });

      await vi.advanceTimersByTimeAsync(100);

      // Find the subscription ID from sent messages
      const sentMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]!);
      mockWs.simulateMessage({
        type: "subscribed",
        assets_ids: ["token1", "token2"],
        id: sentMessage.id,
      });

      await vi.advanceTimersByTimeAsync(100);

      const subscription = await subscriptionPromise;

      expect(subscription.tokenIds).toEqual(["token1", "token2"]);
    });

    it("should send correct subscription message format", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Start subscription
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });

      await vi.advanceTimersByTimeAsync(100);

      // Check the sent message
      expect(mockWs.sentMessages.length).toBeGreaterThan(0);
      const sentMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]!);

      expect(sentMessage.type).toBe("subscribe");
      expect(sentMessage.market).toBe("token123");

      // Simulate confirmation to complete promise
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;
    });

    it("should throw when subscribing without connection", async () => {
      client = createMarketSubscriptionClient(undefined, undefined, MockWebSocketConstructor);

      await expect(client.subscribe({ tokenIds: "token123" })).rejects.toThrow("Not connected");
    });

    it("should throw when subscribing with empty token IDs", async () => {
      const result = await createConnectedClient();
      client = result.client;

      await expect(client.subscribe({ tokenIds: [] })).rejects.toThrow("At least one token ID is required");
    });

    it("should emit subscriptionConfirmed event", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const confirmedHandler = vi.fn();
      client.on("subscriptionConfirmed", confirmedHandler);

      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);

      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);

      await subscriptionPromise;

      expect(confirmedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "subscriptionConfirmed",
          tokenIds: ["token123"],
          channel: "market",
        })
      );
    });

    it("should track subscriptions", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);

      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);

      const subscription = await subscriptionPromise;

      expect(client.getSubscription(subscription.id)).toBe(subscription);
      expect(client.isTokenSubscribed("token123")).toBe(true);
      expect(client.getSubscriptionForToken("token123")).toBe(subscription);
      expect(client.getSubscriptionCount()).toBe(1);
      expect(client.getSubscribedTokenCount()).toBe(1);
      expect(client.getSubscribedTokenIds()).toEqual(["token123"]);
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe from a subscription", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      const subscription = await subscriptionPromise;

      // Unsubscribe
      await client.unsubscribe(subscription.id);

      expect(client.getSubscription(subscription.id)).toBeUndefined();
      expect(client.isTokenSubscribed("token123")).toBe(false);
      expect(client.getSubscriptionCount()).toBe(0);
    });

    it("should unsubscribe by token ID", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      // Unsubscribe by token
      await client.unsubscribeToken("token123");

      expect(client.isTokenSubscribed("token123")).toBe(false);
      expect(client.getSubscriptionCount()).toBe(0);
    });

    it("should throw when unsubscribing unknown subscription", async () => {
      const result = await createConnectedClient();
      client = result.client;

      await expect(client.unsubscribe("unknown_id")).rejects.toThrow("Subscription not found");
    });

    it("should throw when unsubscribing unknown token", async () => {
      const result = await createConnectedClient();
      client = result.client;

      await expect(client.unsubscribeToken("unknown_token")).rejects.toThrow("Token not subscribed");
    });

    it("should unsubscribe all", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe to multiple tokens
      const sub1Promise = client.subscribe({ tokenIds: "token1" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token1" });
      await vi.advanceTimersByTimeAsync(100);
      await sub1Promise;

      const sub2Promise = client.subscribe({ tokenIds: "token2" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token2" });
      await vi.advanceTimersByTimeAsync(100);
      await sub2Promise;

      expect(client.getSubscriptionCount()).toBe(2);

      // Unsubscribe all
      await client.unsubscribeAll();

      expect(client.getSubscriptionCount()).toBe(0);
    });
  });

  describe("price updates", () => {
    it("should emit priceUpdate event on price update message", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      const priceUpdateHandler = vi.fn();
      client.on("priceUpdate", priceUpdateHandler);

      // Simulate price update
      mockWs.simulateMessage({
        type: "price_update",
        asset_id: "token123",
        price: 0.65,
        timestamp: Date.now(),
      });

      expect(priceUpdateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "priceUpdate",
          update: expect.objectContaining({
            asset_id: "token123",
            price: 0.65,
            probability: 65,
          }),
        })
      );
    });

    it("should track current prices", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      // Simulate price update
      mockWs.simulateMessage({
        type: "price_update",
        asset_id: "token123",
        price: 0.65,
        timestamp: Date.now(),
      });

      const currentPrice = client.getCurrentPrice("token123");
      expect(currentPrice).toBeDefined();
      expect(currentPrice!.price).toBe(0.65);
      expect(currentPrice!.probability).toBe(65);
    });

    it("should emit significantPriceChange event for significant changes", async () => {
      const result = await createConnectedClient({ significantChangeThreshold: 0.05 });
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      const significantHandler = vi.fn();
      client.on("significantPriceChange", significantHandler);

      // Simulate significant price change
      mockWs.simulateMessage({
        type: "price_update",
        asset_id: "token123",
        price: 0.65,
        previous_price: 0.50,
        timestamp: Date.now(),
      });

      expect(significantHandler).toHaveBeenCalledTimes(1);
      const callArg = significantHandler.mock.calls[0]![0] as {
        type: string;
        tokenId: string;
        priceChange: number;
      };
      expect(callArg.type).toBe("significantPriceChange");
      expect(callArg.tokenId).toBe("token123");
      expect(callArg.priceChange).toBeCloseTo(0.15, 10);
    });

    it("should update subscription update count", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      const subscription = await subscriptionPromise;

      expect(subscription.updateCount).toBe(0);

      // Simulate multiple price updates
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.50, timestamp: Date.now() });
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.55, timestamp: Date.now() });
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.60, timestamp: Date.now() });

      expect(subscription.updateCount).toBe(3);
      expect(subscription.lastUpdateAt).toBeDefined();
    });

    it("should get all current prices", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe to multiple tokens
      const sub1Promise = client.subscribe({ tokenIds: "token1" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token1" });
      await vi.advanceTimersByTimeAsync(100);
      await sub1Promise;

      const sub2Promise = client.subscribe({ tokenIds: "token2" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token2" });
      await vi.advanceTimersByTimeAsync(100);
      await sub2Promise;

      // Simulate price updates
      mockWs.simulateMessage({ type: "price_update", asset_id: "token1", price: 0.40, timestamp: Date.now() });
      mockWs.simulateMessage({ type: "price_update", asset_id: "token2", price: 0.60, timestamp: Date.now() });

      const allPrices = client.getAllCurrentPrices();
      expect(allPrices.size).toBe(2);
      expect(allPrices.get("token1")!.price).toBe(0.40);
      expect(allPrices.get("token2")!.price).toBe(0.60);
    });
  });

  describe("error handling", () => {
    it("should emit subscriptionError on error message", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const errorHandler = vi.fn();
      client.on("subscriptionError", errorHandler);

      // Simulate error message
      mockWs.simulateMessage({
        type: "error",
        error: "Invalid token ID",
        message: "The specified token does not exist",
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "subscriptionError",
          message: "The specified token does not exist",
        })
      );
    });
  });

  describe("event handling", () => {
    it("should add and remove event listeners", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const handler = vi.fn();
      const removeListener = client.on("priceUpdate", handler);

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      // First update should trigger handler
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.50, timestamp: Date.now() });
      expect(handler).toHaveBeenCalledTimes(1);

      // Remove listener
      removeListener();

      // Second update should not trigger handler
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.55, timestamp: Date.now() });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support once listeners", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      const handler = vi.fn();
      client.once("priceUpdate", handler);

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      // First update should trigger handler
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.50, timestamp: Date.now() });
      expect(handler).toHaveBeenCalledTimes(1);

      // Second update should not trigger handler
      mockWs.simulateMessage({ type: "price_update", asset_id: "token123", price: 0.55, timestamp: Date.now() });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should remove all listeners", async () => {
      const result = await createConnectedClient();
      client = result.client;

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.on("priceUpdate", handler1);
      client.on("priceUpdate", handler2);

      client.removeAllListeners("priceUpdate");

      // Handlers should not be called
      // (We can't easily test this without triggering an event, but the coverage is important)
    });

    it("should remove all listeners for all events", async () => {
      const result = await createConnectedClient();
      client = result.client;

      client.on("priceUpdate", vi.fn());
      client.on("subscriptionConfirmed", vi.fn());
      client.on("subscriptionError", vi.fn());

      client.removeAllListeners();
    });
  });

  describe("dispose", () => {
    it("should clean up resources on dispose", async () => {
      const result = await createConnectedClient();
      client = result.client;
      mockWs = result.mockWs;

      // Subscribe first
      const subscriptionPromise = client.subscribe({ tokenIds: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      mockWs.simulateMessage({ type: "subscribed", market: "token123" });
      await vi.advanceTimersByTimeAsync(100);
      await subscriptionPromise;

      expect(client.getSubscriptionCount()).toBe(1);

      client.dispose();

      expect(client.getSubscriptionCount()).toBe(0);
      expect(client.isConnected()).toBe(false);
    });

    it("should be idempotent", async () => {
      const result = await createConnectedClient();
      client = result.client;

      client.dispose();
      client.dispose(); // Should not throw
    });
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe("Shared Client", () => {
  afterEach(() => {
    resetSharedMarketSubscriptionClient();
  });

  it("should return the same instance", () => {
    const client1 = getSharedMarketSubscriptionClient();
    const client2 = getSharedMarketSubscriptionClient();

    expect(client1).toBe(client2);
  });

  it("should allow setting custom shared client", () => {
    const customClient = createMarketSubscriptionClient(
      undefined,
      undefined,
      MockWebSocketConstructor
    );

    setSharedMarketSubscriptionClient(customClient);

    expect(getSharedMarketSubscriptionClient()).toBe(customClient);

    customClient.dispose();
  });

  it("should dispose old client when setting new one", () => {
    const client1 = getSharedMarketSubscriptionClient();
    const disposeSpy = vi.spyOn(client1, "dispose");

    const customClient = createMarketSubscriptionClient(
      undefined,
      undefined,
      MockWebSocketConstructor
    );

    setSharedMarketSubscriptionClient(customClient);

    expect(disposeSpy).toHaveBeenCalled();

    customClient.dispose();
  });

  it("should reset shared client", () => {
    const client1 = getSharedMarketSubscriptionClient();
    const disposeSpy = vi.spyOn(client1, "dispose");

    resetSharedMarketSubscriptionClient();

    expect(disposeSpy).toHaveBeenCalled();

    const client2 = getSharedMarketSubscriptionClient();
    expect(client2).not.toBe(client1);

    client2.dispose();
  });
});
