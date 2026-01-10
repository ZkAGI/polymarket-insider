/**
 * Tests for WebSocket Auto-Reconnection (API-WS-002)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createReconnectableConnection,
  calculateBackoffDelay,
  calculateBackoffDelayWithJitter,
  shouldReconnectOnClose,
  getReconnectDelayForCloseCode,
} from "../../../src/api/ws/auto-reconnect";
import { CloseCode, WebSocketReadyState } from "../../../src/api/ws/connection-manager";
import type {
  IWebSocket,
  WebSocketConstructor,
} from "../../../src/api/ws/types";
import type {
  SubscriptionsRestoredEvent,
} from "../../../src/api/ws/auto-reconnect";

// ============================================================================
// Mock Browser Events (not always available in Node.js)
// ============================================================================

class MockEvent {
  readonly type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class MockCloseEvent extends MockEvent {
  readonly code: number;
  readonly reason: string;
  readonly wasClean: boolean;

  constructor(type: string, init?: { code?: number; reason?: string; wasClean?: boolean }) {
    super(type);
    this.code = init?.code ?? 1000;
    this.reason = init?.reason ?? "";
    this.wasClean = init?.wasClean ?? true;
  }
}

// Use the mocks if browser classes are not defined
const EventClass = typeof Event !== "undefined" ? Event : MockEvent;
const CloseEventClass = typeof CloseEvent !== "undefined" ? CloseEvent : MockCloseEvent;

// ============================================================================
// Mock WebSocket Class
// ============================================================================

class MockWebSocket implements IWebSocket {
  static instances: MockWebSocket[] = [];
  static nextOpenDelay = 0;
  static nextErrorOnConnect = false;
  static nextCloseCode = CloseCode.NORMAL;
  static nextCloseReason = "";
  static nextCloseClean = true;

  readonly url: string;
  readonly protocol: string = "";
  readonly bufferedAmount: number = 0;

  private _readyState: number = WebSocketReadyState.CONNECTING;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: globalThis.MessageEvent) => void) | null = null;

  private messages: Array<string | ArrayBuffer | Blob | ArrayBufferView> = [];

  constructor(url: string, _protocols?: string | string[]) {
    this.url = url;
    MockWebSocket.instances.push(this);

    if (MockWebSocket.nextErrorOnConnect) {
      MockWebSocket.nextErrorOnConnect = false;
      setTimeout(() => {
        if (this.onerror) {
          this.onerror(new EventClass("error") as Event);
        }
      }, 0);
    } else {
      setTimeout(() => {
        this._readyState = WebSocketReadyState.OPEN;
        if (this.onopen) {
          this.onopen(new EventClass("open") as Event);
        }
      }, MockWebSocket.nextOpenDelay);
    }
  }

  get readyState(): number {
    return this._readyState;
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this._readyState !== WebSocketReadyState.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.messages.push(data);

    // Auto-respond to ping with pong
    if (data === "ping") {
      setTimeout(() => {
        if (this.onmessage && this._readyState === WebSocketReadyState.OPEN) {
          this.onmessage(new globalThis.MessageEvent("message", { data: "pong" }));
        }
      }, 10);
    }
  }

  close(code?: number, reason?: string): void {
    if (this._readyState === WebSocketReadyState.CLOSED) {
      return;
    }

    this._readyState = WebSocketReadyState.CLOSING;
    setTimeout(() => {
      this._readyState = WebSocketReadyState.CLOSED;
      if (this.onclose) {
        const closeEvent = new CloseEventClass("close", {
          code: code ?? MockWebSocket.nextCloseCode,
          reason: reason ?? MockWebSocket.nextCloseReason,
          wasClean: MockWebSocket.nextCloseClean,
        }) as CloseEvent;
        this.onclose(closeEvent);
      }
    }, 0);
  }

  // Test helpers
  simulateMessage(data: string): void {
    if (this.onmessage && this._readyState === WebSocketReadyState.OPEN) {
      this.onmessage(new globalThis.MessageEvent("message", { data }));
    }
  }

  simulateClose(code: number = CloseCode.NORMAL, reason: string = "", wasClean: boolean = true): void {
    this._readyState = WebSocketReadyState.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEventClass("close", { code, reason, wasClean }) as CloseEvent);
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new EventClass("error") as Event);
    }
  }

  getSentMessages(): Array<string | ArrayBuffer | Blob | ArrayBufferView> {
    return [...this.messages];
  }

  static reset(): void {
    MockWebSocket.instances = [];
    MockWebSocket.nextOpenDelay = 0;
    MockWebSocket.nextErrorOnConnect = false;
    MockWebSocket.nextCloseCode = CloseCode.NORMAL;
    MockWebSocket.nextCloseReason = "";
    MockWebSocket.nextCloseClean = true;
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// ============================================================================
// Test Setup
// ============================================================================

describe("WebSocket Auto-Reconnection (API-WS-002)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // ReconnectableConnection Tests
  // ==========================================================================

  describe("ReconnectableConnection", () => {
    describe("constructor", () => {
      it("should create a connection with default config", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        expect(connection.getId()).toBeDefined();
        expect(connection.getState()).toBe("disconnected");
      });

      it("should accept custom reconnect config", () => {
        const connection = createReconnectableConnection(
          {
            url: "wss://example.com",
            reconnectConfig: {
              maxReconnectAttempts: 5,
              reconnectDelay: 500,
              restoreSubscriptions: false,
            },
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const state = connection.getReconnectionState();
        expect(state.nextDelay).toBe(500);
      });
    });

    describe("connect and disconnect", () => {
      it("should establish connection successfully", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(connection.getState()).toBe("connected");
        expect(connection.isConnected()).toBe(true);
      });

      it("should emit open event on connection", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const openHandler = vi.fn();
        connection.on("open", openHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(openHandler).toHaveBeenCalledTimes(1);
        expect(openHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "open",
            url: "wss://example.com",
          })
        );
      });

      it("should disconnect cleanly", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        connection.disconnect();
        await vi.advanceTimersByTimeAsync(10);

        expect(connection.getState()).toBe("disconnected");
        expect(connection.isConnected()).toBe(false);
      });

      it("should throw when connecting after dispose", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.dispose();

        await expect(connection.connect()).rejects.toThrow("disposed");
      });
    });

    describe("send messages", () => {
      it("should send string message", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const result = connection.send("test message");
        expect(result).toBe(true);

        const ws = MockWebSocket.getLastInstance();
        expect(ws?.getSentMessages()).toContain("test message");
      });

      it("should send JSON message", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const data = { type: "subscribe", channel: "market" };
        const result = connection.sendJson(data);
        expect(result).toBe(true);

        const ws = MockWebSocket.getLastInstance();
        expect(ws?.getSentMessages()).toContain(JSON.stringify(data));
      });
    });

    describe("reconnection state", () => {
      it("should track reconnection attempts", async () => {
        const connection = createReconnectableConnection(
          {
            url: "wss://example.com",
            reconnectConfig: {
              autoReconnect: true,
              reconnectDelay: 100,
            },
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Initial state
        let state = connection.getReconnectionState();
        expect(state.isReconnecting).toBe(false);
        expect(state.attempt).toBe(0);
        expect(state.totalAttempts).toBe(0);
        expect(state.exhausted).toBe(false);

        // Connect first
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        // Simulate abnormal close to trigger reconnection
        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "Connection lost", false);
        await vi.advanceTimersByTimeAsync(10);

        // Check reconnection state
        state = connection.getReconnectionState();
        expect(state.isReconnecting).toBe(true);
        expect(state.attempt).toBe(1);
      });

      it("should reset reconnection attempts on successful connect", async () => {
        const connection = createReconnectableConnection(
          {
            url: "wss://example.com",
            reconnectConfig: {
              autoReconnect: true,
              reconnectDelay: 100,
            },
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Connect
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        // Simulate abnormal close
        let ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "", false);
        await vi.advanceTimersByTimeAsync(10);

        // State should show reconnecting
        let state = connection.getReconnectionState();
        expect(state.isReconnecting).toBe(true);

        // Wait for reconnect to succeed
        await vi.advanceTimersByTimeAsync(150);

        // State should be reset
        state = connection.getReconnectionState();
        expect(state.isReconnecting).toBe(false);
        expect(state.attempt).toBe(0);
        expect(state.exhausted).toBe(false);
      });

      it("should emit reconnectExhausted when max attempts reached", async () => {
        const connection = createReconnectableConnection(
          {
            url: "wss://example.com",
            reconnectConfig: {
              autoReconnect: true,
              maxReconnectAttempts: 2,
              reconnectDelay: 100,
            },
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const exhaustedHandler = vi.fn();
        connection.on("reconnectExhausted", exhaustedHandler);

        // Connect
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        // Make reconnects fail
        MockWebSocket.nextErrorOnConnect = true;

        // Trigger reconnection
        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "", false);

        // First reconnect attempt
        await vi.advanceTimersByTimeAsync(110);

        // Second reconnect attempt (max reached)
        await vi.advanceTimersByTimeAsync(210);

        expect(exhaustedHandler).toHaveBeenCalledTimes(1);
        expect(exhaustedHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "reconnectExhausted",
            attempts: 2,
          })
        );
      });

      it("should allow manual reset of reconnection attempts", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Connect
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        // Simulate some reconnection history
        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "", false);
        await vi.advanceTimersByTimeAsync(10);

        let state = connection.getReconnectionState();
        expect(state.totalAttempts).toBeGreaterThan(0);

        // Reset
        connection.resetReconnectionAttempts();

        state = connection.getReconnectionState();
        expect(state.attempt).toBe(0);
        expect(state.totalAttempts).toBe(0);
        expect(state.exhausted).toBe(false);
      });
    });

    describe("force reconnect", () => {
      it("should disconnect and reconnect", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Connect
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(connection.isConnected()).toBe(true);
        const firstInstanceCount = MockWebSocket.instances.length;

        // Force reconnect
        const reconnectPromise = connection.forceReconnect();
        await vi.advanceTimersByTimeAsync(20);
        await reconnectPromise;

        expect(connection.isConnected()).toBe(true);
        expect(MockWebSocket.instances.length).toBeGreaterThan(firstInstanceCount);
      });

      it("should throw when force reconnecting after dispose", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.dispose();

        await expect(connection.forceReconnect()).rejects.toThrow("disposed");
      });
    });
  });

  // ==========================================================================
  // Subscription Management Tests
  // ==========================================================================

  describe("Subscription Management", () => {
    describe("addSubscription", () => {
      it("should add a subscription", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const sub = connection.addSubscription(
          "sub-1",
          "market",
          { type: "subscribe", channel: "market", asset: "BTC" }
        );

        expect(sub.id).toBe("sub-1");
        expect(sub.channel).toBe("market");
        expect(sub.active).toBe(false); // Not connected yet
        expect(connection.hasSubscription("sub-1")).toBe(true);
      });

      it("should mark subscription as active when connected", async () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Connect first
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const sub = connection.addSubscription(
          "sub-1",
          "market",
          { type: "subscribe", channel: "market" }
        );

        expect(sub.active).toBe(true);
      });

      it("should store metadata with subscription", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const sub = connection.addSubscription(
          "sub-1",
          "market",
          { type: "subscribe" },
          { priority: "high", userId: "123" }
        );

        expect(sub.metadata).toEqual({ priority: "high", userId: "123" });
      });
    });

    describe("removeSubscription", () => {
      it("should remove a subscription", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.addSubscription("sub-1", "market", {});
        expect(connection.hasSubscription("sub-1")).toBe(true);

        const result = connection.removeSubscription("sub-1");
        expect(result).toBe(true);
        expect(connection.hasSubscription("sub-1")).toBe(false);
      });

      it("should return false when removing non-existent subscription", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const result = connection.removeSubscription("non-existent");
        expect(result).toBe(false);
      });
    });

    describe("getSubscription and getAllSubscriptions", () => {
      it("should get subscription by id", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.addSubscription("sub-1", "market", { type: "subscribe" });
        connection.addSubscription("sub-2", "trades", { type: "subscribe" });

        const sub = connection.getSubscription("sub-1");
        expect(sub?.id).toBe("sub-1");
        expect(sub?.channel).toBe("market");

        expect(connection.getSubscription("non-existent")).toBeUndefined();
      });

      it("should get all subscriptions", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.addSubscription("sub-1", "market", {});
        connection.addSubscription("sub-2", "trades", {});
        connection.addSubscription("sub-3", "orderbook", {});

        const subs = connection.getAllSubscriptions();
        expect(subs).toHaveLength(3);
        expect(subs.map((s) => s.id)).toEqual(["sub-1", "sub-2", "sub-3"]);
      });

      it("should get subscriptions by channel", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.addSubscription("sub-1", "market", {});
        connection.addSubscription("sub-2", "market", {});
        connection.addSubscription("sub-3", "trades", {});

        const marketSubs = connection.getSubscriptionsByChannel("market");
        expect(marketSubs).toHaveLength(2);

        const tradeSubs = connection.getSubscriptionsByChannel("trades");
        expect(tradeSubs).toHaveLength(1);
      });
    });

    describe("getSubscriptionCount and clearSubscriptions", () => {
      it("should return subscription count", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        expect(connection.getSubscriptionCount()).toBe(0);

        connection.addSubscription("sub-1", "market", {});
        expect(connection.getSubscriptionCount()).toBe(1);

        connection.addSubscription("sub-2", "trades", {});
        expect(connection.getSubscriptionCount()).toBe(2);
      });

      it("should clear all subscriptions", () => {
        const connection = createReconnectableConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.addSubscription("sub-1", "market", {});
        connection.addSubscription("sub-2", "trades", {});

        connection.clearSubscriptions();

        expect(connection.getSubscriptionCount()).toBe(0);
        expect(connection.hasSubscription("sub-1")).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Subscription Restoration Tests
  // ==========================================================================

  describe("Subscription Restoration", () => {
    it("should restore subscriptions after reconnect", async () => {
      const connection = createReconnectableConnection(
        {
          url: "wss://example.com",
          reconnectConfig: {
            autoReconnect: true,
            reconnectDelay: 100,
            subscriptionRestoreDelay: 50,
          },
        },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      // Add event handlers
      const subscriptionRestoredHandler = vi.fn();
      const subscriptionsRestoredHandler = vi.fn();
      connection.on("subscriptionRestored", subscriptionRestoredHandler);
      connection.on("subscriptionsRestored", subscriptionsRestoredHandler);

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Add subscriptions
      connection.addSubscription("sub-1", "market", { type: "subscribe", channel: "market" });
      connection.addSubscription("sub-2", "trades", { type: "subscribe", channel: "trades" });

      // Simulate abnormal close
      const ws = MockWebSocket.getLastInstance();
      ws?.simulateClose(CloseCode.ABNORMAL, "", false);
      await vi.advanceTimersByTimeAsync(10);

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(150);

      // Wait for subscription restoration delay
      await vi.advanceTimersByTimeAsync(100);

      // Check subscriptions were restored
      expect(subscriptionRestoredHandler).toHaveBeenCalledTimes(2);
      expect(subscriptionsRestoredHandler).toHaveBeenCalledTimes(1);

      const restoredEvent = subscriptionsRestoredHandler.mock.calls[0]?.[0] as SubscriptionsRestoredEvent;
      expect(restoredEvent.total).toBe(2);
      expect(restoredEvent.successful).toBe(2);
      expect(restoredEvent.failed).toBe(0);
    });

    it("should not restore subscriptions if disabled", async () => {
      const connection = createReconnectableConnection(
        {
          url: "wss://example.com",
          reconnectConfig: {
            autoReconnect: true,
            reconnectDelay: 100,
            restoreSubscriptions: false,
          },
        },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const subscriptionsRestoredHandler = vi.fn();
      connection.on("subscriptionsRestored", subscriptionsRestoredHandler);

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Add subscription
      connection.addSubscription("sub-1", "market", { type: "subscribe" });

      // Simulate abnormal close
      const ws = MockWebSocket.getLastInstance();
      ws?.simulateClose(CloseCode.ABNORMAL, "", false);
      await vi.advanceTimersByTimeAsync(10);

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(150);

      // Wait some more for subscription restore (which shouldn't happen)
      await vi.advanceTimersByTimeAsync(200);

      expect(subscriptionsRestoredHandler).not.toHaveBeenCalled();
    });

    it("should handle subscription restoration failure gracefully", async () => {
      const connection = createReconnectableConnection(
        {
          url: "wss://example.com",
          reconnectConfig: {
            autoReconnect: false, // Disable auto-reconnect for manual control
          },
        },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const subscriptionRestoredHandler = vi.fn();
      const subscriptionsRestoredHandler = vi.fn();
      connection.on("subscriptionRestored", subscriptionRestoredHandler);
      connection.on("subscriptionsRestored", subscriptionsRestoredHandler);

      // Don't connect - so sendJson will fail when restoring
      // Add subscription while disconnected
      connection.addSubscription("sub-1", "market", { type: "subscribe" });

      // Try to restore - should fail because not connected
      const result = await connection.restoreSubscriptions();

      // The subscription restoration should have failed
      expect(result.failed).toBe(1);
      expect(result.successful).toBe(0);

      // The subscription should be marked as inactive
      const sub = connection.getSubscription("sub-1");
      expect(sub?.active).toBe(false);

      // Events should have been emitted
      expect(subscriptionRestoredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it("should restore subscriptions manually", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const subscriptionsRestoredHandler = vi.fn();
      connection.on("subscriptionsRestored", subscriptionsRestoredHandler);

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Add subscriptions
      connection.addSubscription("sub-1", "market", { type: "subscribe" });
      connection.addSubscription("sub-2", "trades", { type: "subscribe" });

      // Manually restore subscriptions
      const result = await connection.restoreSubscriptions();

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(subscriptionsRestoredHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Event Listener Tests
  // ==========================================================================

  describe("Event Listeners", () => {
    it("should proxy events from underlying connection", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const messageHandler = vi.fn();
      const closeHandler = vi.fn();
      const stateChangeHandler = vi.fn();

      connection.on("message", messageHandler);
      connection.on("close", closeHandler);
      connection.on("stateChange", stateChangeHandler);

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Send a message
      const ws = MockWebSocket.getLastInstance();
      ws?.simulateMessage('{"data":"test"}');

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "message",
          data: '{"data":"test"}',
        })
      );

      // Close
      ws?.simulateClose(CloseCode.NORMAL, "Test close", true);
      await vi.advanceTimersByTimeAsync(10);

      expect(closeHandler).toHaveBeenCalled();
      expect(stateChangeHandler).toHaveBeenCalled();
    });

    it("should support once listeners", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const messageHandler = vi.fn();
      connection.once("message", messageHandler);

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Send multiple messages
      const ws = MockWebSocket.getLastInstance();
      ws?.simulateMessage("first");
      ws?.simulateMessage("second");

      expect(messageHandler).toHaveBeenCalledTimes(1);
    });

    it("should remove listeners with off()", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const handler = vi.fn();
      connection.on("open", handler);

      // Connect and verify handler called
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;
      expect(handler).toHaveBeenCalledTimes(1);

      // Remove handler
      connection.off("open", handler);

      // Reconnect and verify handler NOT called
      connection.disconnect();
      await vi.advanceTimersByTimeAsync(10);

      const reconnectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await reconnectPromise;

      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should remove all listeners", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const openHandler = vi.fn();
      const messageHandler = vi.fn();

      connection.on("open", openHandler);
      connection.on("message", messageHandler);

      connection.removeAllListeners();

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      const ws = MockWebSocket.getLastInstance();
      ws?.simulateMessage("test");

      expect(openHandler).not.toHaveBeenCalled();
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should remove listeners for specific event", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      const openHandler = vi.fn();
      const messageHandler = vi.fn();

      connection.on("open", openHandler);
      connection.on("message", messageHandler);

      connection.removeAllListeners("message");

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      const ws = MockWebSocket.getLastInstance();
      ws?.simulateMessage("test");

      expect(openHandler).toHaveBeenCalled();
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("calculateBackoffDelay", () => {
    it("should calculate exponential backoff", () => {
      expect(calculateBackoffDelay(0)).toBe(1000);
      expect(calculateBackoffDelay(1)).toBe(2000);
      expect(calculateBackoffDelay(2)).toBe(4000);
      expect(calculateBackoffDelay(3)).toBe(8000);
    });

    it("should respect max delay", () => {
      expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);
      expect(calculateBackoffDelay(20, 1000, 5000)).toBe(5000);
    });

    it("should use custom base delay and multiplier", () => {
      expect(calculateBackoffDelay(0, 500, 30000, 3)).toBe(500);
      expect(calculateBackoffDelay(1, 500, 30000, 3)).toBe(1500);
      expect(calculateBackoffDelay(2, 500, 30000, 3)).toBe(4500);
    });
  });

  describe("calculateBackoffDelayWithJitter", () => {
    it("should add jitter to delay", () => {
      // Run multiple times to check jitter is applied
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateBackoffDelayWithJitter(1, 1000));
      }
      // With jitter, we should get different values (very unlikely to get same value 10 times)
      expect(delays.size).toBeGreaterThan(1);
    });

    it("should not exceed max delay with jitter", () => {
      for (let i = 0; i < 100; i++) {
        const delay = calculateBackoffDelayWithJitter(10, 1000, 30000);
        expect(delay).toBeLessThanOrEqual(30000);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("shouldReconnectOnClose", () => {
    it("should not reconnect on clean close", () => {
      expect(shouldReconnectOnClose(CloseCode.NORMAL, true)).toBe(false);
    });

    it("should not reconnect on normal close code", () => {
      expect(shouldReconnectOnClose(CloseCode.NORMAL, false)).toBe(false);
    });

    it("should not reconnect on protocol errors", () => {
      expect(shouldReconnectOnClose(CloseCode.PROTOCOL_ERROR, false)).toBe(false);
      expect(shouldReconnectOnClose(CloseCode.UNSUPPORTED_DATA, false)).toBe(false);
      expect(shouldReconnectOnClose(CloseCode.INVALID_PAYLOAD, false)).toBe(false);
      expect(shouldReconnectOnClose(CloseCode.POLICY_VIOLATION, false)).toBe(false);
    });

    it("should reconnect on abnormal close", () => {
      expect(shouldReconnectOnClose(CloseCode.ABNORMAL, false)).toBe(true);
    });

    it("should reconnect on server errors", () => {
      expect(shouldReconnectOnClose(CloseCode.INTERNAL_ERROR, false)).toBe(true);
      expect(shouldReconnectOnClose(CloseCode.SERVICE_RESTART, false)).toBe(true);
      expect(shouldReconnectOnClose(CloseCode.TRY_AGAIN_LATER, false)).toBe(true);
    });

    it("should reconnect on going away", () => {
      expect(shouldReconnectOnClose(CloseCode.GOING_AWAY, false)).toBe(true);
    });
  });

  describe("getReconnectDelayForCloseCode", () => {
    it("should return longer delay for service restart", () => {
      expect(getReconnectDelayForCloseCode(CloseCode.SERVICE_RESTART)).toBe(5000);
      expect(getReconnectDelayForCloseCode(CloseCode.TRY_AGAIN_LATER)).toBe(5000);
    });

    it("should return medium delay for server errors", () => {
      expect(getReconnectDelayForCloseCode(CloseCode.INTERNAL_ERROR)).toBe(3000);
      expect(getReconnectDelayForCloseCode(CloseCode.BAD_GATEWAY)).toBe(3000);
    });

    it("should return base delay for abnormal close", () => {
      expect(getReconnectDelayForCloseCode(CloseCode.ABNORMAL)).toBe(1000);
    });

    it("should return base delay for unknown codes", () => {
      expect(getReconnectDelayForCloseCode(9999)).toBe(1000);
    });

    it("should use custom base delay", () => {
      expect(getReconnectDelayForCloseCode(CloseCode.SERVICE_RESTART, 500)).toBe(2500);
      expect(getReconnectDelayForCloseCode(CloseCode.INTERNAL_ERROR, 500)).toBe(1500);
      expect(getReconnectDelayForCloseCode(CloseCode.ABNORMAL, 500)).toBe(500);
    });
  });

  // ==========================================================================
  // Dispose Tests
  // ==========================================================================

  describe("dispose", () => {
    it("should clean up resources", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      // Connect
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(10);
      await connectPromise;

      // Add subscriptions
      connection.addSubscription("sub-1", "market", {});
      connection.addSubscription("sub-2", "trades", {});

      // Dispose
      connection.dispose();

      // Verify cleanup
      expect(connection.isConnected()).toBe(false);
      expect(connection.getSubscriptionCount()).toBe(0);
    });

    it("should be idempotent", async () => {
      const connection = createReconnectableConnection(
        { url: "wss://example.com" },
        undefined,
        MockWebSocket as unknown as WebSocketConstructor
      );

      // Should not throw when called multiple times
      connection.dispose();
      connection.dispose();
      connection.dispose();
    });
  });
});
