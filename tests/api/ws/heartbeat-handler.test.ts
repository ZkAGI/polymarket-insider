/**
 * Tests for WebSocket Heartbeat Handler Module (API-WS-007)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Constants
  DEFAULT_PING_INTERVAL,
  DEFAULT_PONG_TIMEOUT,
  DEFAULT_MISSED_PONGS_THRESHOLD,
  DEFAULT_LATENCY_HISTORY_SIZE,
  DEFAULT_STALE_THRESHOLD,
  HeartbeatMessageType,
  HeartbeatEventType,
  // Utility functions
  isPingMessage,
  isPongMessage,
  createPingMessage,
  createPongMessage,
  calculateAverage,
  // Class and factory
  HeartbeatHandler,
  createHeartbeatHandler,
  getSharedHeartbeatHandler,
  setSharedHeartbeatHandler,
  resetSharedHeartbeatHandler,
  attachHeartbeatHandler,
} from "../../../src/api/ws/heartbeat-handler";
import type { SendFunction } from "../../../src/api/ws/heartbeat-handler";

// ============================================================================
// Constants Tests
// ============================================================================

describe("Default constants", () => {
  it("should have correct default ping interval", () => {
    expect(DEFAULT_PING_INTERVAL).toBe(30000);
  });

  it("should have correct default pong timeout", () => {
    expect(DEFAULT_PONG_TIMEOUT).toBe(10000);
  });

  it("should have correct default missed pongs threshold", () => {
    expect(DEFAULT_MISSED_PONGS_THRESHOLD).toBe(2);
  });

  it("should have correct default latency history size", () => {
    expect(DEFAULT_LATENCY_HISTORY_SIZE).toBe(10);
  });

  it("should have correct default stale threshold", () => {
    expect(DEFAULT_STALE_THRESHOLD).toBe(60000);
  });
});

describe("HeartbeatMessageType constants", () => {
  it("should have correct message types", () => {
    expect(HeartbeatMessageType.PING).toBe("ping");
    expect(HeartbeatMessageType.PONG).toBe("pong");
    expect(HeartbeatMessageType.HEARTBEAT).toBe("heartbeat");
  });
});

describe("HeartbeatEventType constants", () => {
  it("should have correct event types", () => {
    expect(HeartbeatEventType.PING_SENT).toBe("pingSent");
    expect(HeartbeatEventType.PONG_RECEIVED).toBe("pongReceived");
    expect(HeartbeatEventType.PONG_TIMEOUT).toBe("pongTimeout");
    expect(HeartbeatEventType.STALE_DETECTED).toBe("staleDetected");
    expect(HeartbeatEventType.HEARTBEAT_FAILURE).toBe("heartbeatFailure");
    expect(HeartbeatEventType.HEARTBEAT_STARTED).toBe("heartbeatStarted");
    expect(HeartbeatEventType.HEARTBEAT_STOPPED).toBe("heartbeatStopped");
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe("isPingMessage", () => {
  it("should return true for plain ping string", () => {
    expect(isPingMessage("ping")).toBe(true);
  });

  it("should return true for ping string case insensitive", () => {
    expect(isPingMessage("PING")).toBe(true);
    expect(isPingMessage("Ping")).toBe(true);
  });

  it("should return true for JSON ping message", () => {
    expect(isPingMessage('{"type":"ping"}')).toBe(true);
    expect(isPingMessage('{"type":"PING"}')).toBe(true);
  });

  it("should return true for JSON heartbeat message", () => {
    expect(isPingMessage('{"type":"heartbeat"}')).toBe(true);
    expect(isPingMessage('{"type":"HEARTBEAT"}')).toBe(true);
  });

  it("should return false for non-ping messages", () => {
    expect(isPingMessage("pong")).toBe(false);
    expect(isPingMessage("hello")).toBe(false);
    expect(isPingMessage('{"type":"message"}')).toBe(false);
  });

  it("should return false for invalid JSON", () => {
    expect(isPingMessage("{invalid}")).toBe(false);
  });

  it("should return false for non-object JSON", () => {
    expect(isPingMessage('"ping"')).toBe(false);
    expect(isPingMessage("123")).toBe(false);
  });
});

describe("isPongMessage", () => {
  it("should return true for plain pong string", () => {
    expect(isPongMessage("pong")).toBe(true);
  });

  it("should return true for pong string case insensitive", () => {
    expect(isPongMessage("PONG")).toBe(true);
    expect(isPongMessage("Pong")).toBe(true);
  });

  it("should return true for JSON pong message", () => {
    expect(isPongMessage('{"type":"pong"}')).toBe(true);
    expect(isPongMessage('{"type":"PONG"}')).toBe(true);
  });

  it("should return false for non-pong messages", () => {
    expect(isPongMessage("ping")).toBe(false);
    expect(isPongMessage("hello")).toBe(false);
    expect(isPongMessage('{"type":"message"}')).toBe(false);
  });

  it("should return false for heartbeat (only ping)", () => {
    expect(isPongMessage('{"type":"heartbeat"}')).toBe(false);
  });

  it("should return false for invalid JSON", () => {
    expect(isPongMessage("{invalid}")).toBe(false);
  });
});

describe("createPingMessage", () => {
  it("should return plain ping for non-JSON format", () => {
    expect(createPingMessage(false)).toBe("ping");
  });

  it("should return JSON ping for JSON format", () => {
    const message = createPingMessage(true);
    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("ping");
    expect(typeof parsed.timestamp).toBe("number");
  });
});

describe("createPongMessage", () => {
  it("should return plain pong for non-JSON format", () => {
    expect(createPongMessage(false)).toBe("pong");
  });

  it("should return JSON pong for JSON format", () => {
    const message = createPongMessage(true);
    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("pong");
    expect(typeof parsed.timestamp).toBe("number");
  });
});

describe("calculateAverage", () => {
  it("should return 0 for empty array", () => {
    expect(calculateAverage([])).toBe(0);
  });

  it("should return the value for single element", () => {
    expect(calculateAverage([42])).toBe(42);
  });

  it("should calculate average correctly", () => {
    expect(calculateAverage([10, 20, 30])).toBe(20);
    expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
  });

  it("should handle decimal averages", () => {
    expect(calculateAverage([1, 2])).toBe(1.5);
    expect(calculateAverage([10, 15, 20])).toBe(15);
  });
});

// ============================================================================
// HeartbeatHandler Constructor Tests
// ============================================================================

describe("HeartbeatHandler constructor", () => {
  afterEach(() => {
    resetSharedHeartbeatHandler();
    vi.useRealTimers();
  });

  it("should create handler with default configuration", () => {
    const handler = new HeartbeatHandler();
    const config = handler.getConfig();

    expect(config.pingInterval).toBe(DEFAULT_PING_INTERVAL);
    expect(config.pongTimeout).toBe(DEFAULT_PONG_TIMEOUT);
    expect(config.missedPongsThreshold).toBe(DEFAULT_MISSED_PONGS_THRESHOLD);
    expect(config.latencyHistorySize).toBe(DEFAULT_LATENCY_HISTORY_SIZE);
    expect(config.staleThreshold).toBe(DEFAULT_STALE_THRESHOLD);
    expect(config.autoStart).toBe(false);
    expect(config.useJsonFormat).toBe(false);
    expect(config.debug).toBe(false);

    handler.dispose();
  });

  it("should create handler with custom configuration", () => {
    const handler = new HeartbeatHandler({
      pingInterval: 5000,
      pongTimeout: 2000,
      missedPongsThreshold: 3,
      latencyHistorySize: 20,
      staleThreshold: 120000,
      useJsonFormat: true,
    });

    const config = handler.getConfig();
    expect(config.pingInterval).toBe(5000);
    expect(config.pongTimeout).toBe(2000);
    expect(config.missedPongsThreshold).toBe(3);
    expect(config.latencyHistorySize).toBe(20);
    expect(config.staleThreshold).toBe(120000);
    expect(config.useJsonFormat).toBe(true);

    handler.dispose();
  });

  it("should accept custom ping message as string", () => {
    const handler = new HeartbeatHandler({
      pingMessage: "custom-ping",
    });

    const config = handler.getConfig();
    expect(config.pingMessage).toBe("custom-ping");

    handler.dispose();
  });

  it("should accept custom ping message as function", () => {
    const pingFn = () => "dynamic-ping";
    const handler = new HeartbeatHandler({
      pingMessage: pingFn,
    });

    const config = handler.getConfig();
    expect(typeof config.pingMessage).toBe("function");

    handler.dispose();
  });

  it("should accept custom pong matcher", () => {
    const customMatcher = (msg: string) => msg === "custom-pong";
    const handler = new HeartbeatHandler({
      pongMatcher: customMatcher,
    });

    const config = handler.getConfig();
    expect(typeof config.pongMatcher).toBe("function");

    handler.dispose();
  });
});

// ============================================================================
// HeartbeatHandler Lifecycle Tests
// ============================================================================

describe("HeartbeatHandler lifecycle", () => {
  let handler: HeartbeatHandler;
  let sendFn: SendFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({ pingInterval: 1000 });
    sendFn = vi.fn(() => true) as unknown as SendFunction;
    handler.setSendFunction(sendFn);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should not start without send function", () => {
    const noSendHandler = new HeartbeatHandler();
    expect(noSendHandler.start()).toBe(false);
    expect(noSendHandler.getIsActive()).toBe(false);
    noSendHandler.dispose();
  });

  it("should start successfully with send function", () => {
    expect(handler.start()).toBe(true);
    expect(handler.getIsActive()).toBe(true);
  });

  it("should return true when already active", () => {
    handler.start();
    expect(handler.start()).toBe(true);
    expect(handler.getIsActive()).toBe(true);
  });

  it("should stop successfully", () => {
    handler.start();
    handler.stop("Test stop");
    expect(handler.getIsActive()).toBe(false);
  });

  it("should restart successfully", () => {
    handler.start();
    expect(handler.restart()).toBe(true);
    expect(handler.getIsActive()).toBe(true);
  });

  it("should not start after dispose", () => {
    handler.dispose();
    expect(handler.start()).toBe(false);
    expect(handler.getIsDisposed()).toBe(true);
  });

  it("should emit heartbeatStarted event", () => {
    const startListener = vi.fn();
    handler.on("heartbeatStarted", startListener);

    handler.start();

    expect(startListener).toHaveBeenCalledTimes(1);
    expect(startListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "heartbeatStarted",
        pingInterval: 1000,
      })
    );
  });

  it("should emit heartbeatStopped event", () => {
    const stopListener = vi.fn();
    handler.on("heartbeatStopped", stopListener);

    handler.start();
    handler.stop("Testing");

    expect(stopListener).toHaveBeenCalledTimes(1);
    expect(stopListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "heartbeatStopped",
        reason: "Testing",
      })
    );
  });
});

// ============================================================================
// HeartbeatHandler Ping/Pong Tests
// ============================================================================

describe("HeartbeatHandler ping/pong", () => {
  let handler: HeartbeatHandler;
  let sendFn: SendFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
    });
    sendFn = vi.fn(() => true) as unknown as SendFunction;
    handler.setSendFunction(sendFn);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should send ping at intervals", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sendFn).toHaveBeenCalledWith("ping");

    vi.advanceTimersByTime(1000);
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("should emit pingSent event", () => {
    const pingSentListener = vi.fn();
    handler.on("pingSent", pingSentListener);

    handler.start();
    vi.advanceTimersByTime(1000);

    expect(pingSentListener).toHaveBeenCalledTimes(1);
    expect(pingSentListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pingSent",
        message: "ping",
      })
    );
  });

  it("should handle pong response", () => {
    const pongListener = vi.fn();
    handler.on("pongReceived", pongListener);

    handler.start();
    vi.advanceTimersByTime(1000); // Trigger ping

    // Simulate pong response after 50ms
    vi.advanceTimersByTime(50);
    const handled = handler.handleMessage("pong");

    expect(handled).toBe(true);
    expect(pongListener).toHaveBeenCalledTimes(1);
    expect(pongListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pongReceived",
        latencyMs: 50,
        message: "pong",
      })
    );
  });

  it("should handle JSON pong response", () => {
    const pongListener = vi.fn();
    handler.on("pongReceived", pongListener);

    handler.start();
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(100);

    const handled = handler.handleMessage('{"type":"pong"}');
    expect(handled).toBe(true);
    expect(pongListener).toHaveBeenCalledTimes(1);
  });

  it("should track latency", () => {
    handler.start();
    vi.advanceTimersByTime(1000); // Ping 1
    vi.advanceTimersByTime(100);
    handler.handleMessage("pong");

    expect(handler.getCurrentLatency()).toBe(100);
    expect(handler.getAverageLatency()).toBe(100);

    vi.advanceTimersByTime(900); // Ping 2
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    expect(handler.getCurrentLatency()).toBe(50);
    expect(handler.getAverageLatency()).toBe(75); // (100 + 50) / 2
  });

  it("should use JSON ping when configured", () => {
    handler.dispose();

    handler = new HeartbeatHandler({
      pingInterval: 1000,
      useJsonFormat: true,
    });
    handler.setSendFunction(sendFn);
    handler.start();

    vi.advanceTimersByTime(1000);

    expect(sendFn).toHaveBeenCalledWith(expect.stringContaining('"type":"ping"'));
  });

  it("should use custom ping message", () => {
    handler.dispose();

    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pingMessage: "custom-ping-msg",
    });
    handler.setSendFunction(sendFn);
    handler.start();

    vi.advanceTimersByTime(1000);

    expect(sendFn).toHaveBeenCalledWith("custom-ping-msg");
  });

  it("should use custom ping message function", () => {
    handler.dispose();
    let counter = 0;

    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pingMessage: () => `ping-${++counter}`,
    });
    handler.setSendFunction(sendFn);
    handler.start();

    vi.advanceTimersByTime(1000);
    expect(sendFn).toHaveBeenCalledWith("ping-1");

    vi.advanceTimersByTime(1000);
    expect(sendFn).toHaveBeenCalledWith("ping-2");
  });

  it("should use custom pong matcher", () => {
    handler.dispose();

    const customMatcher = (msg: string) => msg === "ack";
    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongMatcher: customMatcher,
    });
    handler.setSendFunction(sendFn);

    const pongListener = vi.fn();
    handler.on("pongReceived", pongListener);

    handler.start();
    vi.advanceTimersByTime(1000);

    // Normal pong should not match
    expect(handler.handleMessage("pong")).toBe(false);
    expect(pongListener).not.toHaveBeenCalled();

    // Custom message should match
    expect(handler.handleMessage("ack")).toBe(true);
    expect(pongListener).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// HeartbeatHandler Pong Timeout Tests
// ============================================================================

describe("HeartbeatHandler pong timeout", () => {
  let handler: HeartbeatHandler;
  let sendFn: SendFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
      missedPongsThreshold: 2,
    });
    sendFn = vi.fn(() => true) as unknown as SendFunction;
    handler.setSendFunction(sendFn);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should emit pongTimeout event when no response", () => {
    const timeoutListener = vi.fn();
    handler.on("pongTimeout", timeoutListener);

    handler.start();
    vi.advanceTimersByTime(1000); // Send ping
    vi.advanceTimersByTime(500); // Pong timeout

    expect(timeoutListener).toHaveBeenCalledTimes(1);
    expect(timeoutListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pongTimeout",
        consecutiveMissed: 1,
        threshold: 2,
      })
    );
  });

  it("should track consecutive missed pongs", () => {
    const timeoutListener = vi.fn();
    handler.on("pongTimeout", timeoutListener);

    handler.start();

    // First ping + timeout
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    expect(timeoutListener).toHaveBeenCalledTimes(1);

    // Second ping + timeout
    vi.advanceTimersByTime(500); // Next ping interval
    vi.advanceTimersByTime(500);
    expect(timeoutListener).toHaveBeenCalledTimes(2);
  });

  it("should emit heartbeatFailure when threshold exceeded", () => {
    const failureListener = vi.fn();
    handler.on("heartbeatFailure", failureListener);

    handler.start();

    // First ping + timeout (1/2)
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    expect(failureListener).not.toHaveBeenCalled();

    // Second ping + timeout (2/2) - threshold met
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    expect(failureListener).toHaveBeenCalledTimes(1);
    expect(failureListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "heartbeatFailure",
        reason: "missedPongs",
      })
    );
  });

  it("should stop heartbeat on failure", () => {
    handler.start();
    expect(handler.getIsActive()).toBe(true);

    // Trigger two timeouts
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(handler.getIsActive()).toBe(false);
  });

  it("should call reconnect function on failure", () => {
    const reconnectFn = vi.fn();
    handler.setReconnectFunction(reconnectFn);

    handler.start();

    // Trigger failure
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(reconnectFn).toHaveBeenCalledTimes(1);
  });

  it("should reset consecutive missed count on pong received", () => {
    const timeoutListener = vi.fn();
    handler.on("pongTimeout", timeoutListener);

    handler.start();

    // First ping + timeout
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    expect(handler.getStats().consecutiveMissedPongs).toBe(1);

    // Second ping + pong (before timeout)
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(100);
    handler.handleMessage("pong");

    expect(handler.getStats().consecutiveMissedPongs).toBe(0);
  });
});

// ============================================================================
// HeartbeatHandler Stale Detection Tests
// ============================================================================

describe("HeartbeatHandler stale detection", () => {
  let handler: HeartbeatHandler;
  let sendFn: SendFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
      staleThreshold: 3000,
    });
    sendFn = vi.fn(() => true) as unknown as SendFunction;
    handler.setSendFunction(sendFn);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should detect stale connection when no activity", () => {
    // Create handler with longer ping interval to isolate stale detection
    handler.dispose();
    handler = new HeartbeatHandler({
      pingInterval: 60000, // Long interval so pings don't interfere
      pongTimeout: 30000,
      staleThreshold: 2000,
      missedPongsThreshold: 10, // High threshold so it doesn't trigger
    });
    handler.setSendFunction(sendFn);

    const staleListener = vi.fn();
    handler.on("staleDetected", staleListener);

    handler.start();

    // Wait for stale check
    // Stale check runs at threshold / 2 = 1000ms intervals
    // At 1000ms: 1000ms inactivity < 2000ms threshold - no stale
    // At 2000ms: 2000ms inactivity (not >) - no stale yet
    // At 3000ms: 3000ms inactivity > 2000ms threshold - STALE!
    vi.advanceTimersByTime(3100);

    expect(staleListener).toHaveBeenCalled();
    expect(staleListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "staleDetected",
        threshold: 2000,
      })
    );
  });

  it("should emit heartbeatFailure with stale reason", () => {
    // Create handler with longer ping interval to isolate stale detection
    handler.dispose();
    handler = new HeartbeatHandler({
      pingInterval: 60000, // Long interval so pings don't interfere
      pongTimeout: 30000,
      staleThreshold: 2000,
      missedPongsThreshold: 10, // High threshold so it doesn't trigger
    });
    handler.setSendFunction(sendFn);

    const failureListener = vi.fn();
    handler.on("heartbeatFailure", failureListener);

    handler.start();
    // Need to wait longer than threshold + check interval
    vi.advanceTimersByTime(3100);

    expect(failureListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "heartbeatFailure",
        reason: "stale",
      })
    );
  });

  it("should not detect stale when activity occurs", () => {
    const staleListener = vi.fn();
    handler.on("staleDetected", staleListener);

    handler.start();

    // Activity keeps resetting
    vi.advanceTimersByTime(1000);
    handler.notifyActivity();
    vi.advanceTimersByTime(1000);
    handler.notifyActivity();
    vi.advanceTimersByTime(1000);
    handler.notifyActivity();

    expect(staleListener).not.toHaveBeenCalled();
  });

  it("should reset activity on message handling", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    handler.handleMessage("some-message");

    const stats = handler.getStats();
    expect(stats.lastActivityAt).not.toBeNull();
  });

  it("should correctly report stale status", () => {
    handler.start();

    expect(handler.isConnectionStale()).toBe(false);

    vi.advanceTimersByTime(4000);

    expect(handler.isConnectionStale()).toBe(true);
  });
});

// ============================================================================
// HeartbeatHandler Statistics Tests
// ============================================================================

describe("HeartbeatHandler statistics", () => {
  let handler: HeartbeatHandler;
  let sendFn: SendFunction;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
      latencyHistorySize: 5,
    });
    sendFn = vi.fn(() => true) as unknown as SendFunction;
    handler.setSendFunction(sendFn);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should track total pings sent", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    expect(handler.getStats().totalPingsSent).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(handler.getStats().totalPingsSent).toBe(2);
  });

  it("should track total pongs received", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");
    expect(handler.getStats().totalPongsReceived).toBe(1);

    vi.advanceTimersByTime(950);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");
    expect(handler.getStats().totalPongsReceived).toBe(2);
  });

  it("should track total missed pongs", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    expect(handler.getStats().totalMissedPongs).toBe(1);

    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    expect(handler.getStats().totalMissedPongs).toBe(2);
  });

  it("should track min/max latency", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    vi.advanceTimersByTime(950);
    vi.advanceTimersByTime(100);
    handler.handleMessage("pong");

    vi.advanceTimersByTime(900);
    vi.advanceTimersByTime(30);
    handler.handleMessage("pong");

    const stats = handler.getStats();
    expect(stats.minLatencyMs).toBe(30);
    expect(stats.maxLatencyMs).toBe(100);
  });

  it("should limit latency history size", () => {
    handler.start();

    // Generate 7 latency entries (history size is 5)
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(10 * (i + 1));
      handler.handleMessage("pong");
    }

    const stats = handler.getStats();
    expect(stats.latencyHistory.length).toBe(5);
  });

  it("should reset statistics", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    expect(handler.getStats().totalPingsSent).toBe(1);
    expect(handler.getStats().totalPongsReceived).toBe(1);

    handler.resetStats();

    expect(handler.getStats().totalPingsSent).toBe(0);
    expect(handler.getStats().totalPongsReceived).toBe(0);
    expect(handler.getStats().latencyHistory).toHaveLength(0);
  });

  it("should track ping/pong timestamps", () => {
    handler.start();

    vi.advanceTimersByTime(1000);
    expect(handler.getStats().lastPingAt).not.toBeNull();

    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");
    expect(handler.getStats().lastPongAt).not.toBeNull();
  });

  it("should report active and pending status", () => {
    expect(handler.getStats().isActive).toBe(false);

    handler.start();
    expect(handler.getStats().isActive).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(handler.getStats().isPongPending).toBe(true);

    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");
    expect(handler.getStats().isPongPending).toBe(false);
  });
});

// ============================================================================
// HeartbeatHandler Event Handling Tests
// ============================================================================

describe("HeartbeatHandler event handling", () => {
  let handler: HeartbeatHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler();
    handler.setSendFunction(() => true);
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should add and remove event listeners", () => {
    const listener = vi.fn();
    const unsubscribe = handler.on("pingSent", listener);

    handler.start();
    vi.advanceTimersByTime(30000);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();

    vi.advanceTimersByTime(30000);
    expect(listener).not.toHaveBeenCalled();
  });

  it("should support once listeners", () => {
    const listener = vi.fn();
    handler.once("pingSent", listener);

    handler.start();
    vi.advanceTimersByTime(30000);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should remove all listeners for specific event", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    handler.on("pingSent", listener1);
    handler.on("pingSent", listener2);
    handler.removeAllListeners("pingSent");

    handler.start();
    vi.advanceTimersByTime(30000);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it("should remove all listeners for all events", () => {
    const pingSentListener = vi.fn();
    const startListener = vi.fn();

    handler.on("pingSent", pingSentListener);
    handler.on("heartbeatStarted", startListener);
    handler.removeAllListeners();

    handler.start();
    vi.advanceTimersByTime(30000);

    expect(pingSentListener).not.toHaveBeenCalled();
    expect(startListener).not.toHaveBeenCalled();
  });

  it("should handle listener errors gracefully", () => {
    const errorListener = vi.fn(() => {
      throw new Error("Listener error");
    });
    const goodListener = vi.fn();

    handler.on("pingSent", errorListener);
    handler.on("pingSent", goodListener);

    handler.start();
    vi.advanceTimersByTime(30000);

    expect(errorListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalled();
  });
});

// ============================================================================
// HeartbeatHandler Send Failure Tests
// ============================================================================

describe("HeartbeatHandler send failure", () => {
  let handler: HeartbeatHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new HeartbeatHandler({
      pingInterval: 1000,
    });
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  it("should handle send function returning false", () => {
    const sendFn = vi.fn(() => false);
    handler.setSendFunction(sendFn);

    const pingSentListener = vi.fn();
    handler.on("pingSent", pingSentListener);

    handler.start();
    vi.advanceTimersByTime(1000);

    expect(sendFn).toHaveBeenCalled();
    expect(pingSentListener).not.toHaveBeenCalled();
  });

  it("should not start pong timer when send fails", () => {
    handler.setSendFunction(() => false);

    const timeoutListener = vi.fn();
    handler.on("pongTimeout", timeoutListener);

    handler.start();
    vi.advanceTimersByTime(1500);

    expect(timeoutListener).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Factory and Singleton Tests
// ============================================================================

describe("createHeartbeatHandler factory", () => {
  afterEach(() => {
    resetSharedHeartbeatHandler();
  });

  it("should create handler with default config", () => {
    const handler = createHeartbeatHandler();
    expect(handler).toBeInstanceOf(HeartbeatHandler);
    expect(handler.getConfig().pingInterval).toBe(DEFAULT_PING_INTERVAL);
    handler.dispose();
  });

  it("should create handler with custom config", () => {
    const handler = createHeartbeatHandler({ pingInterval: 5000 });
    expect(handler.getConfig().pingInterval).toBe(5000);
    handler.dispose();
  });
});

describe("Shared handler singleton", () => {
  afterEach(() => {
    resetSharedHeartbeatHandler();
  });

  it("should get shared handler instance", () => {
    const handler1 = getSharedHeartbeatHandler();
    const handler2 = getSharedHeartbeatHandler();
    expect(handler1).toBe(handler2);
  });

  it("should set shared handler instance", () => {
    const customHandler = createHeartbeatHandler({ pingInterval: 5000 });
    setSharedHeartbeatHandler(customHandler);

    const shared = getSharedHeartbeatHandler();
    expect(shared.getConfig().pingInterval).toBe(5000);
  });

  it("should reset shared handler instance", () => {
    const handler1 = getSharedHeartbeatHandler();
    resetSharedHeartbeatHandler();
    const handler2 = getSharedHeartbeatHandler();

    expect(handler1).not.toBe(handler2);
    expect(handler1.getIsDisposed()).toBe(true);
  });
});

describe("attachHeartbeatHandler helper", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetSharedHeartbeatHandler();
  });

  it("should create and configure handler", () => {
    const sendFn = vi.fn(() => true);
    const reconnectFn = vi.fn();

    const handler = attachHeartbeatHandler({
      send: sendFn,
      reconnect: reconnectFn,
      config: { pingInterval: 5000 },
    });

    expect(handler).toBeInstanceOf(HeartbeatHandler);
    expect(handler.getConfig().pingInterval).toBe(5000);
    expect(handler.getIsActive()).toBe(true);

    handler.dispose();
  });

  it("should not auto-start when specified", () => {
    const sendFn = vi.fn(() => true);

    const handler = attachHeartbeatHandler({
      send: sendFn,
      autoStart: false,
    });

    expect(handler.getIsActive()).toBe(false);

    handler.dispose();
  });

  it("should connect send function", () => {
    vi.useFakeTimers();
    const sendFn = vi.fn(() => true);

    const handler = attachHeartbeatHandler({
      send: sendFn,
      config: { pingInterval: 1000 },
    });

    vi.advanceTimersByTime(1000);
    expect(sendFn).toHaveBeenCalledWith("ping");

    handler.dispose();
  });

  it("should connect reconnect function", () => {
    vi.useFakeTimers();
    const sendFn = vi.fn(() => true);
    const reconnectFn = vi.fn();

    const handler = attachHeartbeatHandler({
      send: sendFn,
      reconnect: reconnectFn,
      config: {
        pingInterval: 1000,
        pongTimeout: 500,
        missedPongsThreshold: 1,
      },
    });

    // Trigger failure
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);

    expect(reconnectFn).toHaveBeenCalled();

    handler.dispose();
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("HeartbeatHandler edge cases", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetSharedHeartbeatHandler();
  });

  it("should handle pong without pending ping (identifies as pong but no event)", () => {
    vi.useFakeTimers();
    const handler = new HeartbeatHandler();
    handler.setSendFunction(() => true);

    const pongListener = vi.fn();
    handler.on("pongReceived", pongListener);

    handler.start();
    // Don't wait for ping, just send pong
    // The handler still recognizes the pong message format (returns true)
    // but doesn't emit the event since no ping was pending
    const result = handler.handleMessage("pong");

    expect(result).toBe(true); // Message is recognized as pong format
    expect(pongListener).not.toHaveBeenCalled(); // But no event since no pending ping

    handler.dispose();
  });

  it("should handle non-pong message", () => {
    const handler = new HeartbeatHandler();
    handler.setSendFunction(() => true);

    const result = handler.handleMessage("some-other-message");
    expect(result).toBe(false);

    handler.dispose();
  });

  it("should handle multiple disposes gracefully", () => {
    const handler = new HeartbeatHandler();
    handler.dispose();
    handler.dispose();
    expect(handler.getIsDisposed()).toBe(true);
  });

  it("should handle stop when not active", () => {
    const handler = new HeartbeatHandler();
    const stopListener = vi.fn();
    handler.on("heartbeatStopped", stopListener);

    handler.stop("Not active");

    expect(stopListener).not.toHaveBeenCalled();

    handler.dispose();
  });

  it("should update activity on handleMessage even for non-pong", () => {
    vi.useFakeTimers();
    const handler = new HeartbeatHandler();
    handler.setSendFunction(() => true);
    handler.start();

    vi.advanceTimersByTime(1000);
    const before = handler.getStats().lastActivityAt;

    vi.advanceTimersByTime(1000);
    handler.handleMessage("random-message");
    const after = handler.getStats().lastActivityAt;

    expect(after!.getTime()).toBeGreaterThan(before!.getTime());

    handler.dispose();
  });

  it("should handle getCurrentLatency when no history", () => {
    const handler = new HeartbeatHandler();
    expect(handler.getCurrentLatency()).toBeNull();
    handler.dispose();
  });

  it("should handle getAverageLatency when no history", () => {
    const handler = new HeartbeatHandler();
    expect(handler.getAverageLatency()).toBe(0);
    handler.dispose();
  });

  it("should report isConnectionStale as false when no activity recorded", () => {
    const handler = new HeartbeatHandler();
    expect(handler.isConnectionStale()).toBe(false);
    handler.dispose();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("HeartbeatHandler integration tests", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetSharedHeartbeatHandler();
  });

  it("should handle realistic ping-pong sequence", () => {
    vi.useFakeTimers();

    const sendFn = vi.fn(() => true);
    const handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
    });
    handler.setSendFunction(sendFn);

    const events: string[] = [];
    handler.on("pingSent", () => events.push("ping"));
    handler.on("pongReceived", () => events.push("pong"));

    handler.start();

    // Simulate 3 successful ping-pong exchanges
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(50);
      handler.handleMessage("pong");
    }

    expect(events).toEqual(["ping", "pong", "ping", "pong", "ping", "pong"]);

    const stats = handler.getStats();
    expect(stats.totalPingsSent).toBe(3);
    expect(stats.totalPongsReceived).toBe(3);
    expect(stats.totalMissedPongs).toBe(0);

    handler.dispose();
  });

  it("should handle intermittent failures", () => {
    vi.useFakeTimers();

    const sendFn = vi.fn(() => true);
    const handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
      missedPongsThreshold: 3,
    });
    handler.setSendFunction(sendFn);

    handler.start();

    // Ping 1 - success
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    // Ping 2 - timeout
    vi.advanceTimersByTime(950);
    vi.advanceTimersByTime(500);

    // Ping 3 - success (resets consecutive)
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    const stats = handler.getStats();
    expect(stats.totalPingsSent).toBe(3);
    expect(stats.totalPongsReceived).toBe(2);
    expect(stats.totalMissedPongs).toBe(1);
    expect(stats.consecutiveMissedPongs).toBe(0);

    handler.dispose();
  });

  it("should handle connection recovery workflow", () => {
    vi.useFakeTimers();

    const sendFn = vi.fn(() => true);
    const reconnectFn = vi.fn();

    const handler = new HeartbeatHandler({
      pingInterval: 1000,
      pongTimeout: 500,
      missedPongsThreshold: 2,
    });
    handler.setSendFunction(sendFn);
    handler.setReconnectFunction(reconnectFn);

    handler.start();

    // Cause failure
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(reconnectFn).toHaveBeenCalled();
    expect(handler.getIsActive()).toBe(false);

    // Simulate reconnection
    reconnectFn.mockClear();
    handler.resetStats();
    handler.start();

    expect(handler.getIsActive()).toBe(true);

    // Verify working again
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(50);
    handler.handleMessage("pong");

    expect(handler.getStats().totalPongsReceived).toBe(1);

    handler.dispose();
  });
});
