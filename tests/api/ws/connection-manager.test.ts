/**
 * Tests for WebSocket Connection Manager (API-WS-001)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WebSocketConnection,
  createWebSocketConnection,
  createWebSocketManager,
  getSharedWebSocketManager,
  resetSharedWebSocketManager,
  CloseCode,
  WebSocketReadyState,
} from "../../../src/api/ws/connection-manager";
import type {
  IWebSocket,
  WebSocketConstructor,
  ConnectionState,
  StateChangeEvent,
  ReconnectEvent,
} from "../../../src/api/ws/types";

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

describe("WebSocket Connection Manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSharedWebSocketManager();
  });

  // ==========================================================================
  // WebSocketConnection Tests
  // ==========================================================================

  describe("WebSocketConnection", () => {
    describe("constructor", () => {
      it("should create a connection with default config", () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        expect(connection.getId()).toBeDefined();
        expect(connection.getUrl()).toBe("wss://example.com");
        expect(connection.getState()).toBe("disconnected");
      });

      it("should use custom connection ID if provided", () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com", id: "custom-id" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        expect(connection.getId()).toBe("custom-id");
      });

      it("should merge config with defaults", () => {
        const connection = createWebSocketConnection(
          {
            url: "wss://example.com",
            connectionTimeout: 5000,
            maxReconnectAttempts: 5,
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const config = connection.getConfig();
        expect(config.connectionTimeout).toBe(5000);
        expect(config.maxReconnectAttempts).toBe(5);
        expect(config.autoReconnect).toBe(true); // Default
      });
    });

    describe("connect", () => {
      it("should establish connection successfully", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);

        await expect(connectPromise).resolves.toBeUndefined();
        expect(connection.getState()).toBe("connected");
        expect(connection.isConnected()).toBe(true);
      });

      it("should transition through connecting state", async () => {
        const states: ConnectionState[] = [];
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        connection.on("stateChange", (event: StateChangeEvent) => {
          states.push(event.currentState);
        });

        const connectPromise = connection.connect();
        expect(connection.getState()).toBe("connecting");

        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(states).toContain("connecting");
        expect(states).toContain("connected");
      });

      it("should emit open event on connection", async () => {
        const connection = createWebSocketConnection(
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

      it("should timeout on slow connection", async () => {
        MockWebSocket.nextOpenDelay = 50000; // 50 seconds
        const connection = createWebSocketConnection(
          { url: "wss://example.com", connectionTimeout: 1000, autoReconnect: false },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        // Catch rejection to prevent unhandled rejection
        const connectPromise = connection.connect().catch((error) => error);

        await vi.advanceTimersByTimeAsync(1500);

        const result = await connectPromise;
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain("Connection timeout");
        expect(connection.getState()).toBe("error");

        // Clean up the connection to prevent lingering timers
        connection.dispose();
      });

      it("should handle connection error", async () => {
        MockWebSocket.nextErrorOnConnect = true;
        const connection = createWebSocketConnection(
          { url: "wss://example.com", autoReconnect: false },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const errorHandler = vi.fn();
        connection.on("error", errorHandler);

        // Catch rejection immediately to prevent unhandled rejection
        const connectPromise = connection.connect().catch((error) => error);

        // Advance timers to trigger the error
        await vi.advanceTimersByTimeAsync(10);

        const result = await connectPromise;
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe("WebSocket error");
        expect(errorHandler).toHaveBeenCalled();

        // Clean up
        connection.dispose();
      });

      it("should not connect twice if already connected", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise1 = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise1;

        const instanceCount = MockWebSocket.instances.length;

        await connection.connect();
        await vi.advanceTimersByTimeAsync(10);

        expect(MockWebSocket.instances.length).toBe(instanceCount);
      });
    });

    describe("disconnect", () => {
      it("should disconnect cleanly", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const closeHandler = vi.fn();
        connection.on("close", closeHandler);

        connection.disconnect();
        await vi.advanceTimersByTimeAsync(10);

        expect(connection.getState()).toBe("disconnected");
        expect(connection.isConnected()).toBe(false);
      });

      it("should emit close event with code and reason", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const closeHandler = vi.fn();
        connection.on("close", closeHandler);

        connection.disconnect(CloseCode.GOING_AWAY, "Test reason");
        await vi.advanceTimersByTimeAsync(10);

        expect(closeHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "close",
            code: CloseCode.GOING_AWAY,
            reason: "Test reason",
          })
        );
      });

      it("should not error when disconnecting already disconnected connection", () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        expect(() => connection.disconnect()).not.toThrow();
      });
    });

    describe("send", () => {
      it("should send string message", async () => {
        const connection = createWebSocketConnection(
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
        const connection = createWebSocketConnection(
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

      it("should return false when not connected", () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const result = connection.send("test message");
        expect(result).toBe(false);
      });

      it("should update stats on send", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        connection.send("hello");
        connection.send("world");

        const stats = connection.getStats();
        expect(stats.messagesSent).toBe(2);
        expect(stats.bytesSent).toBe(10); // "hello" + "world"
      });
    });

    describe("message handling", () => {
      it("should emit message event on incoming message", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const messageHandler = vi.fn();
        connection.on("message", messageHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage('{"type":"update","data":"test"}');

        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "message",
            data: '{"type":"update","data":"test"}',
            json: { type: "update", data: "test" },
          })
        );
      });

      it("should parse JSON messages", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const messageHandler = vi.fn();
        connection.on("message", messageHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage('{"key":"value"}');

        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            json: { key: "value" },
          })
        );
      });

      it("should handle non-JSON messages", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const messageHandler = vi.fn();
        connection.on("message", messageHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage("plain text message");

        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: "plain text message",
            json: undefined,
          })
        );
      });

      it("should update stats on received message", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage("hello");
        ws?.simulateMessage("world");

        const stats = connection.getStats();
        expect(stats.messagesReceived).toBe(2);
        expect(stats.bytesReceived).toBe(10);
      });
    });

    describe("event listeners", () => {
      it("should add and remove event listeners", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const handler = vi.fn();
        const unsubscribe = connection.on("open", handler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(handler).toHaveBeenCalledTimes(1);

        // Disconnect and reconnect
        connection.disconnect();
        await vi.advanceTimersByTimeAsync(10);

        unsubscribe();

        const connectPromise2 = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise2;

        // Handler should not be called again
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should support once listeners", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const handler = vi.fn();
        connection.once("message", handler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage("first");
        ws?.simulateMessage("second");

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should remove all listeners", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const openHandler = vi.fn();
        const messageHandler = vi.fn();
        connection.on("open", openHandler);
        connection.on("message", messageHandler);

        connection.removeAllListeners();

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage("test");

        expect(openHandler).not.toHaveBeenCalled();
        expect(messageHandler).not.toHaveBeenCalled();
      });

      it("should remove listeners for specific event", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const openHandler = vi.fn();
        const messageHandler = vi.fn();
        connection.on("open", openHandler);
        connection.on("message", messageHandler);

        connection.removeAllListeners("message");

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateMessage("test");

        expect(openHandler).toHaveBeenCalled();
        expect(messageHandler).not.toHaveBeenCalled();
      });
    });

    describe("reconnection", () => {
      it("should reconnect on abnormal close", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com", autoReconnect: true, reconnectDelay: 100 },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const reconnectHandler = vi.fn();
        connection.on("reconnect", reconnectHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "Connection lost", false);
        await vi.advanceTimersByTimeAsync(10);

        expect(connection.getState()).toBe("reconnecting");
        expect(reconnectHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "reconnect",
            attempt: 1,
          })
        );

        // Wait for reconnect
        await vi.advanceTimersByTimeAsync(200);
        expect(connection.getState()).toBe("connected");
      });

      it("should not reconnect on clean close", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com", autoReconnect: true },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const reconnectHandler = vi.fn();
        connection.on("reconnect", reconnectHandler);

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.NORMAL, "Clean close", true);
        await vi.advanceTimersByTimeAsync(10);

        expect(reconnectHandler).not.toHaveBeenCalled();
      });

      it("should respect maxReconnectAttempts", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com", autoReconnect: true, maxReconnectAttempts: 2, reconnectDelay: 100 },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const reconnectHandler = vi.fn();
        connection.on("reconnect", reconnectHandler);

        // First connect successfully
        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        // Simulate abnormal close - this triggers reconnection
        MockWebSocket.nextErrorOnConnect = true;
        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "", false);

        // First reconnect event fires immediately after close
        expect(reconnectHandler).toHaveBeenCalledTimes(1);

        // First reconnect attempt (100ms delay) - will fail due to nextErrorOnConnect
        await vi.advanceTimersByTimeAsync(110);

        // Second reconnect event fires after first attempt fails (200ms delay from backoff)
        expect(reconnectHandler).toHaveBeenCalledTimes(2);

        // Second reconnect attempt - will fail again
        await vi.advanceTimersByTimeAsync(210);

        // Should not exceed max attempts - no third reconnect event
        await vi.advanceTimersByTimeAsync(1000);
        expect(reconnectHandler).toHaveBeenCalledTimes(2);
      });

      it("should use exponential backoff for reconnection", async () => {
        const connection = createWebSocketConnection(
          {
            url: "wss://example.com",
            autoReconnect: true,
            reconnectDelay: 100,
            reconnectBackoffMultiplier: 2,
            maxReconnectAttempts: 5,
          },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const delays: number[] = [];
        connection.on("reconnect", (event: ReconnectEvent) => {
          delays.push(event.delay);
        });

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        MockWebSocket.nextErrorOnConnect = true;
        const ws = MockWebSocket.getLastInstance();
        ws?.simulateClose(CloseCode.ABNORMAL, "", false);

        // First reconnect event fires immediately with delay=100
        expect(delays).toEqual([100]);

        // First reconnect attempt after 100ms - will fail and schedule second
        await vi.advanceTimersByTimeAsync(110);
        expect(delays).toEqual([100, 200]);

        // Verify the backoff formula: delay = baseDelay * multiplier^attempt
        // First: 100 * 2^0 = 100
        // Second: 100 * 2^1 = 200
        // This confirms exponential backoff is working
      });
    });

    describe("getInfo", () => {
      it("should return connection info", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com", id: "test-conn" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const info = connection.getInfo();

        expect(info.id).toBe("test-conn");
        expect(info.url).toBe("wss://example.com");
        expect(info.state).toBe("connected");
        expect(info.createdAt).toBeInstanceOf(Date);
        expect(info.connectedAt).toBeInstanceOf(Date);
      });
    });

    describe("dispose", () => {
      it("should clean up connection", async () => {
        const connection = createWebSocketConnection(
          { url: "wss://example.com" },
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = connection.connect();
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        connection.dispose();
        await vi.advanceTimersByTimeAsync(10);

        expect(connection.getState()).toBe("disconnected");
        expect(connection.isConnected()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // WebSocketManager Tests
  // ==========================================================================

  describe("WebSocketManager", () => {
    describe("constructor", () => {
      it("should create manager with default config", () => {
        const manager = createWebSocketManager();
        expect(manager.getConnectionCount()).toBe(0);
      });

      it("should create manager with custom config", () => {
        const manager = createWebSocketManager({
          maxConnections: 5,
          debug: true,
        });
        expect(manager).toBeDefined();
      });
    });

    describe("connect", () => {
      it("should create and connect a new connection", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com" });
        await vi.advanceTimersByTimeAsync(10);
        const connection = await connectPromise;

        expect(connection).toBeInstanceOf(WebSocketConnection);
        expect(connection.isConnected()).toBe(true);
        expect(manager.getConnectionCount()).toBe(1);
      });

      it("should enforce maxConnections limit", async () => {
        const manager = createWebSocketManager(
          { maxConnections: 2 },
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com/1", id: "conn1" });
        await vi.advanceTimersByTimeAsync(10);
        await connect1;

        const connect2 = manager.connect({ url: "wss://example.com/2", id: "conn2" });
        await vi.advanceTimersByTimeAsync(10);
        await connect2;

        await expect(
          manager.connect({ url: "wss://example.com/3", id: "conn3" })
        ).rejects.toThrow("Maximum connections");
      });

      it("should reject duplicate connection IDs", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com", id: "same-id" });
        await vi.advanceTimersByTimeAsync(10);
        await connect1;

        await expect(
          manager.connect({ url: "wss://example.com", id: "same-id" })
        ).rejects.toThrow("already exists");
      });
    });

    describe("get and has", () => {
      it("should get connection by ID", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com", id: "test-id" });
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const connection = manager.get("test-id");
        expect(connection).toBeDefined();
        expect(connection?.getId()).toBe("test-id");
      });

      it("should return undefined for non-existent connection", () => {
        const manager = createWebSocketManager();
        expect(manager.get("non-existent")).toBeUndefined();
      });

      it("should check if connection exists", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com", id: "test-id" });
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        expect(manager.has("test-id")).toBe(true);
        expect(manager.has("other-id")).toBe(false);
      });
    });

    describe("disconnect", () => {
      it("should disconnect and remove connection", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com", id: "test-id" });
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const result = manager.disconnect("test-id");
        await vi.advanceTimersByTimeAsync(10);

        expect(result).toBe(true);
        expect(manager.has("test-id")).toBe(false);
        expect(manager.getConnectionCount()).toBe(0);
      });

      it("should return false for non-existent connection", () => {
        const manager = createWebSocketManager();
        expect(manager.disconnect("non-existent")).toBe(false);
      });
    });

    describe("disconnectAll", () => {
      it("should disconnect all connections", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com/1", id: "conn1" });
        const connect2 = manager.connect({ url: "wss://example.com/2", id: "conn2" });
        await vi.advanceTimersByTimeAsync(10);
        await Promise.all([connect1, connect2]);

        expect(manager.getConnectionCount()).toBe(2);

        manager.disconnectAll();
        await vi.advanceTimersByTimeAsync(10);

        expect(manager.getConnectionCount()).toBe(0);
      });
    });

    describe("getAll and getIds", () => {
      it("should return all connections", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com/1", id: "conn1" });
        const connect2 = manager.connect({ url: "wss://example.com/2", id: "conn2" });
        await vi.advanceTimersByTimeAsync(10);
        await Promise.all([connect1, connect2]);

        const connections = manager.getAll();
        expect(connections).toHaveLength(2);

        const ids = manager.getIds();
        expect(ids).toContain("conn1");
        expect(ids).toContain("conn2");
      });

      it("should return all connection info", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com", id: "test-id" });
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const allInfo = manager.getAllInfo();
        expect(allInfo).toHaveLength(1);
        expect(allInfo[0]?.id).toBe("test-id");
        expect(allInfo[0]?.state).toBe("connected");
      });
    });

    describe("broadcast", () => {
      it("should broadcast to all connected WebSockets", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com/1", id: "conn1" });
        const connect2 = manager.connect({ url: "wss://example.com/2", id: "conn2" });
        await vi.advanceTimersByTimeAsync(10);
        await Promise.all([connect1, connect2]);

        const count = manager.broadcast("hello all");

        expect(count).toBe(2);
        for (const instance of MockWebSocket.instances) {
          expect(instance.getSentMessages()).toContain("hello all");
        }
      });

      it("should broadcast JSON to all connections", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connectPromise = manager.connect({ url: "wss://example.com", id: "conn1" });
        await vi.advanceTimersByTimeAsync(10);
        await connectPromise;

        const data = { type: "broadcast", message: "test" };
        const count = manager.broadcastJson(data);

        expect(count).toBe(1);
        const ws = MockWebSocket.getLastInstance();
        expect(ws?.getSentMessages()).toContain(JSON.stringify(data));
      });
    });

    describe("dispose", () => {
      it("should dispose all connections", async () => {
        const manager = createWebSocketManager(
          undefined,
          MockWebSocket as unknown as WebSocketConstructor
        );

        const connect1 = manager.connect({ url: "wss://example.com/1", id: "conn1" });
        const connect2 = manager.connect({ url: "wss://example.com/2", id: "conn2" });
        await vi.advanceTimersByTimeAsync(10);
        await Promise.all([connect1, connect2]);

        manager.dispose();
        await vi.advanceTimersByTimeAsync(10);

        expect(manager.getConnectionCount()).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Shared Manager Tests
  // ==========================================================================

  describe("Shared WebSocket Manager", () => {
    it("should return shared instance", () => {
      const manager1 = getSharedWebSocketManager();
      const manager2 = getSharedWebSocketManager();

      expect(manager1).toBe(manager2);
    });

    it("should reset shared instance", () => {
      const manager1 = getSharedWebSocketManager();
      resetSharedWebSocketManager();
      const manager2 = getSharedWebSocketManager();

      expect(manager1).not.toBe(manager2);
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("should export CloseCode constants", () => {
      expect(CloseCode.NORMAL).toBe(1000);
      expect(CloseCode.GOING_AWAY).toBe(1001);
      expect(CloseCode.ABNORMAL).toBe(1006);
    });

    it("should export WebSocketReadyState constants", () => {
      expect(WebSocketReadyState.CONNECTING).toBe(0);
      expect(WebSocketReadyState.OPEN).toBe(1);
      expect(WebSocketReadyState.CLOSING).toBe(2);
      expect(WebSocketReadyState.CLOSED).toBe(3);
    });
  });
});
