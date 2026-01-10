/**
 * Tests for WebSocket Event Emitter (API-WS-010)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  WebSocketEventEmitter,
  createEventEmitter,
  getSharedEventEmitter,
  setSharedEventEmitter,
  resetSharedEventEmitter,
  EventCategory,
  EventPriority,
  WebSocketEventTypes,
  createFilteredListener,
  createDebouncedListener,
  createThrottledListener,
  createBatchingListener,
  createEventBuilder,
  BaseEvent,
  PriceUpdateEventData,
  TradeEventData,
  EventEmitterConfig,
} from "../../../src/api/ws/event-emitter";

describe("WebSocketEventEmitter", () => {
  let emitter: WebSocketEventEmitter;

  beforeEach(() => {
    emitter = new WebSocketEventEmitter();
  });

  afterEach(() => {
    emitter.dispose();
    resetSharedEventEmitter();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================
  describe("constructor", () => {
    it("should create emitter with default config", () => {
      const em = new WebSocketEventEmitter();
      expect(em.isDisposed()).toBe(false);
      expect(em.listenerCount()).toBe(0);
      em.dispose();
    });

    it("should create emitter with custom config", () => {
      const config: EventEmitterConfig = {
        maxListenersPerEvent: 50,
        enableHistory: true,
        maxHistorySize: 500,
        debug: true,
        catchHandlerErrors: false,
        asyncTimeout: 10000,
      };
      const em = new WebSocketEventEmitter(config);
      expect(em.isDisposed()).toBe(false);
      em.dispose();
    });

    it("should create emitter with custom logger", () => {
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const em = new WebSocketEventEmitter({ logger, debug: true });

      em.on("test", () => {});
      expect(logger.debug).toHaveBeenCalled();
      em.dispose();
    });
  });

  // ===========================================================================
  // Event Emission Tests
  // ===========================================================================
  describe("emit", () => {
    it("should emit event with auto-generated id and timestamp", () => {
      const callback = vi.fn();
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback);

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as BaseEvent;
      expect(event.id).toBeDefined();
      expect(event.id).toMatch(/^evt_/);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it("should preserve provided id and timestamp", () => {
      const callback = vi.fn();
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback);

      const customId = "custom_123";
      const customTimestamp = new Date("2025-01-01");

      emitter.emit({
        id: customId,
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        timestamp: customTimestamp,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as BaseEvent;
      expect(event.id).toBe(customId);
      expect(event.timestamp).toEqual(customTimestamp);
    });

    it("should return the emitted event", () => {
      const result = emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(result.type).toBe(WebSocketEventTypes.PRICE_UPDATE);
      expect(result.id).toBeDefined();
    });

    it("should throw when emitting on disposed emitter", () => {
      emitter.dispose();

      expect(() => {
        emitter.emit({
          type: WebSocketEventTypes.PRICE_UPDATE,
          category: EventCategory.MARKET_DATA,
          priority: EventPriority.NORMAL,
          tokenId: "abc",
          price: 0.75,
        });
      }).toThrow("EventEmitter has been disposed");
    });

    it("should call multiple listeners for the same event type", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on(WebSocketEventTypes.TRADE, callback1);
      emitter.on(WebSocketEventTypes.TRADE, callback2);

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should not call listeners for different event types", () => {
      const callback = vi.fn();
      emitter.on(WebSocketEventTypes.TRADE, callback);

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Listener Registration Tests
  // ===========================================================================
  describe("on / off", () => {
    it("should register and unregister listeners", () => {
      const callback = vi.fn();
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback);

      expect(emitter.listenerCount(WebSocketEventTypes.PRICE_UPDATE)).toBe(1);

      emitter.off(WebSocketEventTypes.PRICE_UPDATE, callback);

      expect(emitter.listenerCount(WebSocketEventTypes.PRICE_UPDATE)).toBe(0);
    });

    it("should return unsubscribe function from on()", () => {
      const callback = vi.fn();
      const unsubscribe = emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback);

      expect(emitter.listenerCount(WebSocketEventTypes.PRICE_UPDATE)).toBe(1);

      unsubscribe();

      expect(emitter.listenerCount(WebSocketEventTypes.PRICE_UPDATE)).toBe(0);
    });

    it("should return false when removing non-existent listener", () => {
      const callback = vi.fn();
      const result = emitter.off(WebSocketEventTypes.PRICE_UPDATE, callback);

      expect(result).toBe(false);
    });

    it("should return false when removing from non-existent event type", () => {
      const callback = vi.fn();
      const result = emitter.off("non-existent", callback);

      expect(result).toBe(false);
    });

    it("should throw when max listeners reached", () => {
      const em = new WebSocketEventEmitter({ maxListenersPerEvent: 2 });

      em.on("test", () => {});
      em.on("test", () => {});

      expect(() => em.on("test", () => {})).toThrow(
        "Max listeners reached for event type: test"
      );

      em.dispose();
    });

    it("should throw when registering on disposed emitter", () => {
      emitter.dispose();

      expect(() => emitter.on("test", () => {})).toThrow(
        "EventEmitter has been disposed"
      );
    });
  });

  // ===========================================================================
  // Category Listener Tests
  // ===========================================================================
  describe("onCategory / offCategory", () => {
    it("should register and call category listeners", () => {
      const callback = vi.fn();
      emitter.onCategory(EventCategory.TRADE, callback);

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should receive all events in category", () => {
      const callback = vi.fn();
      emitter.onCategory(EventCategory.TRADE, callback);

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      emitter.emit({
        type: WebSocketEventTypes.LARGE_TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.HIGH,
        tradeId: "t2",
        tokenId: "abc",
        price: 0.5,
        size: 10000,
        usdValue: 5000,
        side: "sell" as const,
      });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should unregister category listeners", () => {
      const callback = vi.fn();
      emitter.onCategory(EventCategory.TRADE, callback);
      emitter.offCategory(EventCategory.TRADE, callback);

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function from onCategory()", () => {
      const callback = vi.fn();
      const unsubscribe = emitter.onCategory(EventCategory.TRADE, callback);

      unsubscribe();

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Global Listener Tests
  // ===========================================================================
  describe("onAll / offAll", () => {
    it("should register and call global listeners for all events", () => {
      const callback = vi.fn();
      emitter.onAll(callback);

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should unregister global listeners", () => {
      const callback = vi.fn();
      emitter.onAll(callback);
      emitter.offAll(callback);

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function from onAll()", () => {
      const callback = vi.fn();
      const unsubscribe = emitter.onAll(callback);

      unsubscribe();

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw when max global listeners reached", () => {
      const em = new WebSocketEventEmitter({ maxListenersPerEvent: 2 });

      em.onAll(() => {});
      em.onAll(() => {});

      expect(() => em.onAll(() => {})).toThrow("Max global listeners reached");

      em.dispose();
    });
  });

  // ===========================================================================
  // Once Tests
  // ===========================================================================
  describe("once", () => {
    it("should call listener only once", () => {
      const callback = vi.fn();
      emitter.once(WebSocketEventTypes.PRICE_UPDATE, callback);

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.80,
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function that works before first call", () => {
      const callback = vi.fn();
      const unsubscribe = emitter.once(WebSocketEventTypes.PRICE_UPDATE, callback);

      unsubscribe();

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Filter Tests
  // ===========================================================================
  describe("filtering", () => {
    it("should filter events with listener filter option", () => {
      const callback = vi.fn();
      emitter.on<PriceUpdateEventData>(
        WebSocketEventTypes.PRICE_UPDATE,
        callback,
        {
          filter: (event) => event.price > 0.5,
        }
      );

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.25,
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect((callback.mock.calls[0][0] as PriceUpdateEventData).price).toBe(0.75);
    });

    it("should filter events for category listeners", () => {
      const callback = vi.fn();
      emitter.onCategory<TradeEventData>(EventCategory.TRADE, callback, {
        filter: (event) => event.size > 500,
      });

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t2",
        tokenId: "abc",
        price: 0.5,
        size: 1000,
        side: "sell" as const,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect((callback.mock.calls[0][0] as TradeEventData).size).toBe(1000);
    });

    it("should filter events for global listeners", () => {
      const callback = vi.fn();
      emitter.onAll(callback, {
        filter: (event) => event.category === EventCategory.TRADE,
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].type).toBe(WebSocketEventTypes.TRADE);
    });
  });

  // ===========================================================================
  // Priority Tests
  // ===========================================================================
  describe("listener priority", () => {
    it("should call listeners in priority order", () => {
      const callOrder: number[] = [];

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => callOrder.push(3), { priority: 3 });
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => callOrder.push(1), { priority: 1 });
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => callOrder.push(2), { priority: 2 });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should use default priority of 100 when not specified", () => {
      const callOrder: number[] = [];

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => callOrder.push(2));
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => callOrder.push(1), { priority: 50 });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callOrder).toEqual([1, 2]);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe("error handling", () => {
    it("should catch listener errors and continue calling other listeners", () => {
      const callback1 = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const callback2 = vi.fn();

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback1, { priority: 1 });
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, callback2, { priority: 2 });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should emit HANDLER_ERROR event when listener throws", () => {
      const errorCallback = vi.fn();
      emitter.on(WebSocketEventTypes.HANDLER_ERROR, errorCallback);

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {
        throw new Error("Test error");
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback.mock.calls[0][0].error.message).toBe("Test error");
    });

    it("should not emit HANDLER_ERROR for errors in HANDLER_ERROR handlers", () => {
      let handlerErrorCount = 0;
      emitter.on(WebSocketEventTypes.HANDLER_ERROR, () => {
        handlerErrorCount++;
        throw new Error("Error in error handler");
      });

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {
        throw new Error("Test error");
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(handlerErrorCount).toBe(1);
    });

    it("should track listener errors in stats", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {
        throw new Error("Test error");
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      const stats = emitter.getStats();
      expect(stats.totalListenerErrors).toBe(1);
    });
  });

  // ===========================================================================
  // Async Listener Tests
  // ===========================================================================
  describe("async listeners", () => {
    it("should handle async listeners", async () => {
      const results: number[] = [];

      emitter.on(WebSocketEventTypes.PRICE_UPDATE, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(1);
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      // Async listener won't have completed yet
      expect(results).toEqual([]);

      // Wait for async listener to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(results).toEqual([1]);
    });
  });

  // ===========================================================================
  // History Tests
  // ===========================================================================
  describe("event history", () => {
    it("should track event history when enabled", () => {
      const em = new WebSocketEventEmitter({ enableHistory: true });

      em.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      em.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      const history = em.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe(WebSocketEventTypes.PRICE_UPDATE);
      expect(history[1].type).toBe(WebSocketEventTypes.TRADE);

      em.dispose();
    });

    it("should limit history size", () => {
      const em = new WebSocketEventEmitter({
        enableHistory: true,
        maxHistorySize: 3,
      });

      for (let i = 0; i < 5; i++) {
        em.emit({
          type: WebSocketEventTypes.PRICE_UPDATE,
          category: EventCategory.MARKET_DATA,
          priority: EventPriority.NORMAL,
          tokenId: `token_${i}`,
          price: 0.5 + i * 0.1,
        });
      }

      const history = em.getHistory();
      expect(history.length).toBe(3);
      // Should have oldest events removed
      expect((history[0] as PriceUpdateEventData).tokenId).toBe("token_2");
      expect((history[2] as PriceUpdateEventData).tokenId).toBe("token_4");

      em.dispose();
    });

    it("should not track history when disabled", () => {
      const em = new WebSocketEventEmitter({ enableHistory: false });

      em.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      const history = em.getHistory();
      expect(history.length).toBe(0);

      em.dispose();
    });

    it("should filter history by type", () => {
      const em = new WebSocketEventEmitter({ enableHistory: true });

      em.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      em.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      const priceHistory = em.getHistoryByType(WebSocketEventTypes.PRICE_UPDATE);
      expect(priceHistory.length).toBe(1);
      expect(priceHistory[0].type).toBe(WebSocketEventTypes.PRICE_UPDATE);

      em.dispose();
    });

    it("should filter history by category", () => {
      const em = new WebSocketEventEmitter({ enableHistory: true });

      em.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      em.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      const tradeHistory = em.getHistoryByCategory(EventCategory.TRADE);
      expect(tradeHistory.length).toBe(1);
      expect(tradeHistory[0].category).toBe(EventCategory.TRADE);

      em.dispose();
    });

    it("should clear history", () => {
      const em = new WebSocketEventEmitter({ enableHistory: true });

      em.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      expect(em.getHistory().length).toBe(1);

      em.clearHistory();

      expect(em.getHistory().length).toBe(0);

      em.dispose();
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================
  describe("statistics", () => {
    it("should track emitted events", () => {
      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.emit({
        type: WebSocketEventTypes.TRADE,
        category: EventCategory.TRADE,
        priority: EventPriority.NORMAL,
        tradeId: "t1",
        tokenId: "abc",
        price: 0.5,
        size: 100,
        side: "buy" as const,
      });

      const stats = emitter.getStats();
      expect(stats.totalEmitted).toBe(2);
      expect(stats.emittedByType.get(WebSocketEventTypes.PRICE_UPDATE)).toBe(1);
      expect(stats.emittedByType.get(WebSocketEventTypes.TRADE)).toBe(1);
      expect(stats.emittedByCategory.get(EventCategory.MARKET_DATA)).toBe(1);
      expect(stats.emittedByCategory.get(EventCategory.TRADE)).toBe(1);
    });

    it("should track listener calls", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.80,
      });

      const stats = emitter.getStats();
      expect(stats.totalListenerCalls).toBe(2);
    });

    it("should track active listener count", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.TRADE, () => {});
      emitter.onCategory(EventCategory.ERROR, () => {});

      const stats = emitter.getStats();
      expect(stats.activeListenersCount).toBe(3);
    });

    it("should track listeners by type", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.TRADE, () => {});

      const stats = emitter.getStats();
      expect(stats.listenersByType.get(WebSocketEventTypes.PRICE_UPDATE)).toBe(2);
      expect(stats.listenersByType.get(WebSocketEventTypes.TRADE)).toBe(1);
    });

    it("should reset statistics", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});

      emitter.emit({
        type: WebSocketEventTypes.PRICE_UPDATE,
        category: EventCategory.MARKET_DATA,
        priority: EventPriority.NORMAL,
        tokenId: "abc",
        price: 0.75,
      });

      emitter.resetStats();

      const stats = emitter.getStats();
      expect(stats.totalEmitted).toBe(0);
      expect(stats.totalListenerCalls).toBe(0);
      expect(stats.emittedByType.size).toBe(0);
      // Active listeners count is still valid
      expect(stats.activeListenersCount).toBe(1);
    });
  });

  // ===========================================================================
  // Remove All Listeners Tests
  // ===========================================================================
  describe("removeAllListeners", () => {
    it("should remove all listeners for a specific event type", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.TRADE, () => {});

      emitter.removeAllListeners(WebSocketEventTypes.PRICE_UPDATE);

      expect(emitter.listenerCount(WebSocketEventTypes.PRICE_UPDATE)).toBe(0);
      expect(emitter.listenerCount(WebSocketEventTypes.TRADE)).toBe(1);
    });

    it("should remove all listeners when no event type specified", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.TRADE, () => {});
      emitter.onCategory(EventCategory.ERROR, () => {});
      emitter.onAll(() => {});

      emitter.removeAllListeners();

      expect(emitter.listenerCount()).toBe(0);
    });
  });

  // ===========================================================================
  // Helper Method Tests
  // ===========================================================================
  describe("helper methods", () => {
    it("should return event types with listeners", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.on(WebSocketEventTypes.TRADE, () => {});

      const types = emitter.eventTypes();
      expect(types).toContain(WebSocketEventTypes.PRICE_UPDATE);
      expect(types).toContain(WebSocketEventTypes.TRADE);
    });

    it("should check if event type has listeners", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});

      expect(emitter.hasListeners(WebSocketEventTypes.PRICE_UPDATE)).toBe(true);
      expect(emitter.hasListeners(WebSocketEventTypes.TRADE)).toBe(false);
    });

    it("should report global listeners as having listeners", () => {
      emitter.onAll(() => {});

      expect(emitter.hasListeners(WebSocketEventTypes.PRICE_UPDATE)).toBe(true);
      expect(emitter.hasListeners(WebSocketEventTypes.TRADE)).toBe(true);
    });
  });

  // ===========================================================================
  // Dispose Tests
  // ===========================================================================
  describe("dispose", () => {
    it("should dispose and clean up resources", () => {
      emitter.on(WebSocketEventTypes.PRICE_UPDATE, () => {});
      emitter.onCategory(EventCategory.TRADE, () => {});
      emitter.onAll(() => {});

      emitter.dispose();

      expect(emitter.isDisposed()).toBe(true);
      expect(emitter.listenerCount()).toBe(0);
    });

    it("should be idempotent", () => {
      emitter.dispose();
      emitter.dispose();

      expect(emitter.isDisposed()).toBe(true);
    });
  });
});

// ===========================================================================
// Factory Function Tests
// ===========================================================================
describe("createEventEmitter", () => {
  it("should create new emitter instances", () => {
    const em1 = createEventEmitter();
    const em2 = createEventEmitter();

    expect(em1).not.toBe(em2);

    em1.dispose();
    em2.dispose();
  });

  it("should pass config to emitter", () => {
    const em = createEventEmitter({ enableHistory: true });

    em.emit({
      type: WebSocketEventTypes.PRICE_UPDATE,
      category: EventCategory.MARKET_DATA,
      priority: EventPriority.NORMAL,
      tokenId: "abc",
      price: 0.75,
    });

    expect(em.getHistory().length).toBe(1);

    em.dispose();
  });
});

// ===========================================================================
// Singleton Tests
// ===========================================================================
describe("singleton management", () => {
  afterEach(() => {
    resetSharedEventEmitter();
  });

  it("should return shared emitter instance", () => {
    const em1 = getSharedEventEmitter();
    const em2 = getSharedEventEmitter();

    expect(em1).toBe(em2);
  });

  it("should set shared emitter", () => {
    const custom = createEventEmitter({ enableHistory: true });
    setSharedEventEmitter(custom);

    expect(getSharedEventEmitter()).toBe(custom);
  });

  it("should reset shared emitter", () => {
    const original = getSharedEventEmitter();
    resetSharedEventEmitter();
    const newInstance = getSharedEventEmitter();

    expect(newInstance).not.toBe(original);
    expect(original.isDisposed()).toBe(true);
  });
});

// ===========================================================================
// Utility Function Tests
// ===========================================================================
describe("createFilteredListener", () => {
  it("should only call callback when filter passes", () => {
    const callback = vi.fn();
    const filtered = createFilteredListener<PriceUpdateEventData>(
      callback,
      (event) => event.price > 0.5
    );

    const lowPriceEvent = {
      id: "1",
      type: WebSocketEventTypes.PRICE_UPDATE,
      category: EventCategory.MARKET_DATA,
      priority: EventPriority.NORMAL,
      timestamp: new Date(),
      tokenId: "abc",
      price: 0.3,
    } as PriceUpdateEventData;

    const highPriceEvent = {
      id: "2",
      type: WebSocketEventTypes.PRICE_UPDATE,
      category: EventCategory.MARKET_DATA,
      priority: EventPriority.NORMAL,
      timestamp: new Date(),
      tokenId: "abc",
      price: 0.75,
    } as PriceUpdateEventData;

    filtered(lowPriceEvent);
    filtered(highPriceEvent);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(highPriceEvent);
  });
});

describe("createDebouncedListener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce rapid events", () => {
    const callback = vi.fn();
    const debounced = createDebouncedListener<BaseEvent>(callback, 100);

    const event1 = { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    const event2 = { id: "2", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    const event3 = { id: "3", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };

    debounced(event1);
    debounced(event2);
    debounced(event3);

    vi.advanceTimersByTime(50);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event3);
  });

  it("should cancel pending debounce", () => {
    const callback = vi.fn();
    const debounced = createDebouncedListener<BaseEvent>(callback, 100);

    const event = { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };

    debounced(event);
    debounced.cancel();

    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("createThrottledListener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should throttle rapid events", () => {
    const callback = vi.fn();
    const throttled = createThrottledListener<BaseEvent>(callback, 100);

    const event1 = { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    const event2 = { id: "2", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    const event3 = { id: "3", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };

    throttled(event1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(event1);

    throttled(event2);
    throttled(event3);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    const event4 = { id: "4", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    throttled(event4);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(event4);
  });
});

describe("createBatchingListener", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should batch events up to maxBatchSize", () => {
    const callback = vi.fn();
    const batching = createBatchingListener<BaseEvent>(callback, {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    const events = [
      { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() },
      { id: "2", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() },
      { id: "3", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() },
    ];

    batching(events[0]);
    batching(events[1]);
    expect(callback).not.toHaveBeenCalled();

    batching(events[2]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(events);
  });

  it("should flush after maxWaitMs", () => {
    const callback = vi.fn();
    const batching = createBatchingListener<BaseEvent>(callback, {
      maxBatchSize: 10,
      maxWaitMs: 100,
    });

    const event = { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() };
    batching(event);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith([event]);
  });

  it("should support manual flush", () => {
    const callback = vi.fn();
    const batching = createBatchingListener<BaseEvent>(callback, {
      maxBatchSize: 10,
      maxWaitMs: 1000,
    });

    const events = [
      { id: "1", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() },
      { id: "2", type: "test", category: EventCategory.SYSTEM, priority: EventPriority.NORMAL, timestamp: new Date() },
    ];

    batching(events[0]);
    batching(events[1]);

    expect(callback).not.toHaveBeenCalled();

    batching.flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(events);
  });

  it("should not flush when empty", () => {
    const callback = vi.fn();
    const batching = createBatchingListener<BaseEvent>(callback, {});

    batching.flush();

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("createEventBuilder", () => {
  it("should create events with defaults", () => {
    const buildPriceUpdate = createEventBuilder<PriceUpdateEventData>({
      type: WebSocketEventTypes.PRICE_UPDATE,
      category: EventCategory.MARKET_DATA,
      priority: EventPriority.NORMAL,
    });

    const event = buildPriceUpdate({
      tokenId: "abc",
      price: 0.75,
    });

    expect(event.type).toBe(WebSocketEventTypes.PRICE_UPDATE);
    expect(event.category).toBe(EventCategory.MARKET_DATA);
    expect(event.priority).toBe(EventPriority.NORMAL);
    expect(event.tokenId).toBe("abc");
    expect(event.price).toBe(0.75);
  });

  it("should allow overriding priority", () => {
    const buildPriceUpdate = createEventBuilder<PriceUpdateEventData>({
      type: WebSocketEventTypes.PRICE_UPDATE,
      category: EventCategory.MARKET_DATA,
    });

    const event = buildPriceUpdate({
      tokenId: "abc",
      price: 0.75,
      priority: EventPriority.HIGH,
    });

    expect(event.priority).toBe(EventPriority.HIGH);
  });
});

// ===========================================================================
// Constants Tests
// ===========================================================================
describe("constants", () => {
  describe("EventCategory", () => {
    it("should have expected categories", () => {
      expect(EventCategory.CONNECTION).toBe("connection");
      expect(EventCategory.SUBSCRIPTION).toBe("subscription");
      expect(EventCategory.MARKET_DATA).toBe("marketData");
      expect(EventCategory.TRADE).toBe("trade");
      expect(EventCategory.ORDER_BOOK).toBe("orderBook");
      expect(EventCategory.SYSTEM).toBe("system");
      expect(EventCategory.ERROR).toBe("error");
    });
  });

  describe("EventPriority", () => {
    it("should have expected priority values", () => {
      expect(EventPriority.CRITICAL).toBe(0);
      expect(EventPriority.HIGH).toBe(1);
      expect(EventPriority.NORMAL).toBe(2);
      expect(EventPriority.LOW).toBe(3);
    });
  });

  describe("WebSocketEventTypes", () => {
    it("should have expected connection events", () => {
      expect(WebSocketEventTypes.CONNECTION_OPEN).toBe("ws:connection:open");
      expect(WebSocketEventTypes.CONNECTION_CLOSE).toBe("ws:connection:close");
      expect(WebSocketEventTypes.CONNECTION_ERROR).toBe("ws:connection:error");
      expect(WebSocketEventTypes.CONNECTION_RECONNECT).toBe("ws:connection:reconnect");
      expect(WebSocketEventTypes.CONNECTION_STATE_CHANGE).toBe("ws:connection:stateChange");
    });

    it("should have expected subscription events", () => {
      expect(WebSocketEventTypes.SUBSCRIPTION_CONFIRMED).toBe("ws:subscription:confirmed");
      expect(WebSocketEventTypes.SUBSCRIPTION_ERROR).toBe("ws:subscription:error");
      expect(WebSocketEventTypes.SUBSCRIPTION_ADDED).toBe("ws:subscription:added");
      expect(WebSocketEventTypes.SUBSCRIPTION_REMOVED).toBe("ws:subscription:removed");
    });

    it("should have expected market data events", () => {
      expect(WebSocketEventTypes.PRICE_UPDATE).toBe("ws:market:priceUpdate");
      expect(WebSocketEventTypes.SIGNIFICANT_PRICE_CHANGE).toBe("ws:market:significantChange");
    });

    it("should have expected trade events", () => {
      expect(WebSocketEventTypes.TRADE).toBe("ws:trade:trade");
      expect(WebSocketEventTypes.TRADE_BATCH).toBe("ws:trade:batch");
      expect(WebSocketEventTypes.LARGE_TRADE).toBe("ws:trade:large");
    });

    it("should have expected order book events", () => {
      expect(WebSocketEventTypes.ORDER_BOOK_UPDATE).toBe("ws:orderBook:update");
      expect(WebSocketEventTypes.ORDER_BOOK_SNAPSHOT).toBe("ws:orderBook:snapshot");
      expect(WebSocketEventTypes.SPREAD_CHANGE).toBe("ws:orderBook:spreadChange");
      expect(WebSocketEventTypes.BOOK_IMBALANCE).toBe("ws:orderBook:imbalance");
    });

    it("should have expected system events", () => {
      expect(WebSocketEventTypes.HEARTBEAT_PING).toBe("ws:system:ping");
      expect(WebSocketEventTypes.HEARTBEAT_PONG).toBe("ws:system:pong");
      expect(WebSocketEventTypes.HEARTBEAT_TIMEOUT).toBe("ws:system:heartbeatTimeout");
      expect(WebSocketEventTypes.QUEUE_BACKPRESSURE).toBe("ws:system:backpressure");
      expect(WebSocketEventTypes.QUEUE_EMPTY).toBe("ws:system:queueEmpty");
    });

    it("should have expected error events", () => {
      expect(WebSocketEventTypes.PARSE_ERROR).toBe("ws:error:parse");
      expect(WebSocketEventTypes.VALIDATION_ERROR).toBe("ws:error:validation");
      expect(WebSocketEventTypes.HANDLER_ERROR).toBe("ws:error:handler");
    });
  });
});
