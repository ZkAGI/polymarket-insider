/**
 * Tests for WebSocket Message Queue (API-WS-008)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MessageQueue,
  createMessageQueue,
  getSharedMessageQueue,
  setSharedMessageQueue,
  resetSharedMessageQueue,
  createFilteredProcessor,
  createBatchProcessor,
  calculateQueueHealth,
  QueueEventType,
  PRIORITY_VALUES,
  type QueuedMessage,
  type MessageProcessor,
  type QueueStats,
} from "../../../src/api/ws/message-queue";

describe("MessageQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSharedMessageQueue();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSharedMessageQueue();
  });

  describe("constructor", () => {
    it("should create queue with default config", () => {
      const queue = createMessageQueue();
      const config = queue.getConfig();

      expect(config.maxSize).toBe(10000);
      expect(config.batchSize).toBe(100);
      expect(config.processingInterval).toBe(10);
      expect(config.backpressureStrategy).toBe("dropOldest");
      expect(config.enablePriority).toBe(false);
    });

    it("should create queue with custom config", () => {
      const queue = createMessageQueue({
        maxSize: 5000,
        batchSize: 50,
        processingInterval: 20,
        backpressureStrategy: "dropNewest",
        enablePriority: true,
      });
      const config = queue.getConfig();

      expect(config.maxSize).toBe(5000);
      expect(config.batchSize).toBe(50);
      expect(config.processingInterval).toBe(20);
      expect(config.backpressureStrategy).toBe("dropNewest");
      expect(config.enablePriority).toBe(true);
    });

    it("should calculate high/low water marks from maxSize", () => {
      const queue = createMessageQueue({ maxSize: 1000 });
      const config = queue.getConfig();

      expect(config.highWaterMark).toBe(800); // 80% of 1000
      expect(config.lowWaterMark).toBe(500); // 50% of 1000
    });

    it("should use custom water marks if provided", () => {
      const queue = createMessageQueue({
        maxSize: 1000,
        highWaterMark: 900,
        lowWaterMark: 100,
      });
      const config = queue.getConfig();

      expect(config.highWaterMark).toBe(900);
      expect(config.lowWaterMark).toBe(100);
    });
  });

  describe("enqueue", () => {
    it("should enqueue a message", async () => {
      const queue = createMessageQueue<string>();
      const result = await queue.enqueue("test message");

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.position).toBe(1);
      expect(queue.size()).toBe(1);
    });

    it("should enqueue with custom options", async () => {
      const queue = createMessageQueue<string>();
      const result = await queue.enqueue("test message", {
        id: "custom-id",
        priority: "high",
        metadata: { source: "test" },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("custom-id");

      const message = queue.peek();
      expect(message?.id).toBe("custom-id");
      expect(message?.priority).toBe("high");
      expect(message?.metadata?.source).toBe("test");
    });

    it("should enqueue multiple messages", async () => {
      const queue = createMessageQueue<string>();

      await queue.enqueue("message 1");
      await queue.enqueue("message 2");
      await queue.enqueue("message 3");

      expect(queue.size()).toBe(3);
    });

    it("should fail when queue is disposed", async () => {
      const queue = createMessageQueue<string>();
      queue.dispose();

      const result = await queue.enqueue("test");

      expect(result.success).toBe(false);
      expect(result.reason).toBe("disposed");
    });

    it("should emit messageEnqueued event", async () => {
      const queue = createMessageQueue<string>();
      const listener = vi.fn();

      queue.on(QueueEventType.MESSAGE_ENQUEUED, listener);
      await queue.enqueue("test");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.MESSAGE_ENQUEUED,
          queueSize: 1,
        })
      );
    });

    it("should auto-generate message ID if not provided", async () => {
      const queue = createMessageQueue<string>();
      const result = await queue.enqueue("test");

      expect(result.messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });
  });

  describe("enqueueBatch", () => {
    it("should enqueue multiple messages at once", async () => {
      const queue = createMessageQueue<string>();

      const results = await queue.enqueueBatch([
        { data: "message 1" },
        { data: "message 2" },
        { data: "message 3", options: { priority: "high" } },
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(queue.size()).toBe(3);
    });

    it("should apply options to individual messages", async () => {
      const queue = createMessageQueue<string>({ enablePriority: true });

      await queue.enqueueBatch([
        { data: "low", options: { priority: "low" } },
        { data: "high", options: { priority: "high" } },
        { data: "normal" },
      ]);

      // With priority queue, high should be first
      const first = queue.peek();
      expect(first?.data).toBe("high");
    });
  });

  describe("priority queue", () => {
    it("should order messages by priority when enabled", async () => {
      const queue = createMessageQueue<string>({ enablePriority: true });

      await queue.enqueue("low", { priority: "low" });
      await queue.enqueue("normal", { priority: "normal" });
      await queue.enqueue("high", { priority: "high" });
      await queue.enqueue("high2", { priority: "high" });

      const messages = queue.getMessages();
      // High priority messages should be at the front
      expect(messages[0]?.priority).toBe("high");
      expect(messages[1]?.priority).toBe("high");
      expect(messages[2]?.priority).toBe("normal");
      expect(messages[3]?.priority).toBe("low");
    });

    it("should insert high priority before lower priority", async () => {
      const queue = createMessageQueue<string>({ enablePriority: true });

      await queue.enqueue("normal1", { priority: "normal" });
      await queue.enqueue("normal2", { priority: "normal" });
      await queue.enqueue("high", { priority: "high" });

      const messages = queue.getMessages();
      // High priority should be inserted before normal priority messages
      expect(messages[0]?.data).toBe("high");
    });

    it("should not reorder when priority disabled", async () => {
      const queue = createMessageQueue<string>({ enablePriority: false });

      await queue.enqueue("low", { priority: "low" });
      await queue.enqueue("high", { priority: "high" });
      await queue.enqueue("normal", { priority: "normal" });

      const messages = queue.getMessages();
      expect(messages[0]?.data).toBe("low");
      expect(messages[1]?.data).toBe("high");
      expect(messages[2]?.data).toBe("normal");
    });
  });

  describe("processing", () => {
    it("should process messages with processor", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const processed: string[] = [];
      const processor: MessageProcessor<string> = (msg) => {
        processed.push(msg.data);
      };

      queue.setProcessor(processor);
      await queue.enqueue("message 1");
      await queue.enqueue("message 2");
      await queue.enqueue("message 3");

      queue.start();

      // Advance timer to trigger processing
      await vi.advanceTimersByTimeAsync(20);

      expect(processed).toEqual(["message 1", "message 2", "message 3"]);
      expect(queue.size()).toBe(0);
    });

    it("should emit messageProcessed events", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const listener = vi.fn();

      queue.on(QueueEventType.MESSAGE_PROCESSED, listener);
      queue.setProcessor(() => {});

      await queue.enqueue("test");
      queue.start();

      await vi.advanceTimersByTimeAsync(20);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.MESSAGE_PROCESSED,
          waitTime: expect.any(Number),
          processingTime: expect.any(Number),
        })
      );
    });

    it("should handle async processors", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const processed: string[] = [];

      queue.setProcessor(async (msg) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        processed.push(msg.data);
      });

      await queue.enqueue("async message");
      queue.start();

      await vi.advanceTimersByTimeAsync(50);

      expect(processed).toEqual(["async message"]);
    });

    it("should emit processingError on processor error", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const listener = vi.fn();

      queue.on(QueueEventType.PROCESSING_ERROR, listener);
      queue.setProcessor(() => {
        throw new Error("Test error");
      });

      await queue.enqueue("test");
      queue.start();

      await vi.advanceTimersByTimeAsync(20);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.PROCESSING_ERROR,
          error: expect.any(Error),
        })
      );
    });

    it("should process in batches", async () => {
      const queue = createMessageQueue<number>({
        batchSize: 3,
        processingInterval: 10,
      });
      const batchListener = vi.fn();

      queue.on(QueueEventType.BATCH_PROCESSED, batchListener);
      queue.setProcessor(() => {});

      // Enqueue 5 messages
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(i);
      }

      queue.start();

      // First batch of 3
      await vi.advanceTimersByTimeAsync(15);
      expect(batchListener).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: 3 })
      );

      // Second batch of 2
      await vi.advanceTimersByTimeAsync(15);
      expect(batchListener).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: 2 })
      );
    });

    it("should emit queueEmpty when queue becomes empty", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const listener = vi.fn();

      queue.on(QueueEventType.QUEUE_EMPTY, listener);
      queue.setProcessor(() => {});

      await queue.enqueue("test");
      queue.start();

      await vi.advanceTimersByTimeAsync(30);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.QUEUE_EMPTY,
          queueSize: 0,
        })
      );
    });
  });

  describe("pause/resume", () => {
    it("should pause processing", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const processed: string[] = [];

      queue.setProcessor((msg) => {
        processed.push(msg.data);
      });

      await queue.enqueue("message 1");
      queue.start();
      queue.pause();

      await vi.advanceTimersByTimeAsync(50);

      // Message should not be processed when paused
      expect(processed).toHaveLength(0);
      expect(queue.getState()).toBe("paused");
    });

    it("should resume processing", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const processed: string[] = [];

      queue.setProcessor((msg) => {
        processed.push(msg.data);
      });

      await queue.enqueue("message 1");
      queue.start();
      queue.pause();

      await vi.advanceTimersByTimeAsync(20);
      expect(processed).toHaveLength(0);

      queue.resume();
      await vi.advanceTimersByTimeAsync(20);

      expect(processed).toEqual(["message 1"]);
    });
  });

  describe("backpressure - dropOldest", () => {
    it("should activate backpressure at high water mark", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 100,
        highWaterMark: 80,
        lowWaterMark: 50,
        backpressureStrategy: "dropOldest",
      });
      const listener = vi.fn();

      queue.on(QueueEventType.BACKPRESSURE_START, listener);

      // Fill to high water mark
      for (let i = 0; i < 81; i++) {
        await queue.enqueue(i);
      }

      expect(queue.isBackpressureActive()).toBe(true);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.BACKPRESSURE_START,
          strategy: "dropOldest",
        })
      );
    });

    it("should drop oldest message when full", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 5,
        highWaterMark: 4,
        lowWaterMark: 2,
        backpressureStrategy: "dropOldest",
      });
      const dropListener = vi.fn();

      queue.on(QueueEventType.MESSAGE_DROPPED, dropListener);

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(i);
      }

      // Add one more - should drop oldest (0)
      await queue.enqueue(999);

      expect(dropListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.MESSAGE_DROPPED,
          reason: "backpressure",
        })
      );

      // Queue should still be at max size
      expect(queue.size()).toBe(5);

      // First message should now be 1 (0 was dropped)
      const messages = queue.getMessages();
      expect(messages[0]?.data).toBe(1);
    });

    it("should end backpressure at low water mark", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 100,
        highWaterMark: 80,
        lowWaterMark: 50,
        batchSize: 50,
        processingInterval: 10,
        backpressureStrategy: "dropOldest",
      });
      const endListener = vi.fn();

      queue.on(QueueEventType.BACKPRESSURE_END, endListener);
      queue.setProcessor(() => {});

      // Fill to trigger backpressure
      for (let i = 0; i < 81; i++) {
        await queue.enqueue(i);
      }

      expect(queue.isBackpressureActive()).toBe(true);

      // Start processing to drain
      queue.start();
      await vi.advanceTimersByTimeAsync(50);

      expect(queue.isBackpressureActive()).toBe(false);
      expect(endListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.BACKPRESSURE_END,
          duration: expect.any(Number),
        })
      );
    });
  });

  describe("backpressure - dropNewest", () => {
    it("should drop new messages when full", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 5,
        highWaterMark: 4,
        lowWaterMark: 2,
        backpressureStrategy: "dropNewest",
      });
      const dropListener = vi.fn();

      queue.on(QueueEventType.MESSAGE_DROPPED, dropListener);

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(i);
      }

      // Add one more - should fail and drop the new message
      const result = await queue.enqueue(999);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("queueFull");
      expect(dropListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.MESSAGE_DROPPED,
          reason: "backpressure",
        })
      );

      // Queue should still contain original messages
      expect(queue.size()).toBe(5);
      const messages = queue.getMessages();
      expect(messages[0]?.data).toBe(0);
    });
  });

  describe("backpressure - block", () => {
    it("should block enqueue until space available", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 5,
        highWaterMark: 4,
        lowWaterMark: 2,
        batchSize: 3,
        processingInterval: 10,
        backpressureStrategy: "block",
      });

      queue.setProcessor(() => {});

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(i);
      }

      // Start async enqueue that will block
      let enqueueResolved = false;
      const enqueuePromise = queue.enqueue(999).then(() => {
        enqueueResolved = true;
      });

      expect(queue.getState()).toBe("blocked");
      expect(enqueueResolved).toBe(false);

      // Start processing to make space
      queue.start();
      await vi.advanceTimersByTimeAsync(50);

      // Wait for enqueue to resolve
      await enqueuePromise;

      expect(enqueueResolved).toBe(true);
    });
  });

  describe("backpressure - error", () => {
    it("should throw error when queue is full", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 5,
        highWaterMark: 4,
        lowWaterMark: 2,
        backpressureStrategy: "error",
      });

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(i);
      }

      // Should throw on full queue
      await expect(queue.enqueue(999)).rejects.toThrow("Queue is full");
    });
  });

  describe("clear", () => {
    it("should clear all messages", async () => {
      const queue = createMessageQueue<string>();

      await queue.enqueue("message 1");
      await queue.enqueue("message 2");
      await queue.enqueue("message 3");

      const count = queue.clear();

      expect(count).toBe(3);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it("should end backpressure on clear", async () => {
      const queue = createMessageQueue<number>({
        maxSize: 10,
        highWaterMark: 8,
      });

      // Fill to trigger backpressure
      for (let i = 0; i < 9; i++) {
        await queue.enqueue(i);
      }

      expect(queue.isBackpressureActive()).toBe(true);

      queue.clear();

      expect(queue.isBackpressureActive()).toBe(false);
    });
  });

  describe("peek", () => {
    it("should return next message without removing it", async () => {
      const queue = createMessageQueue<string>();

      await queue.enqueue("first");
      await queue.enqueue("second");

      const peeked = queue.peek();

      expect(peeked?.data).toBe("first");
      expect(queue.size()).toBe(2);
    });

    it("should return undefined for empty queue", () => {
      const queue = createMessageQueue<string>();

      expect(queue.peek()).toBeUndefined();
    });
  });

  describe("getMessages", () => {
    it("should return readonly copy of messages", async () => {
      const queue = createMessageQueue<string>();

      await queue.enqueue("a");
      await queue.enqueue("b");

      const messages = queue.getMessages();

      expect(messages).toHaveLength(2);
      expect(messages[0]?.data).toBe("a");
      expect(messages[1]?.data).toBe("b");
    });
  });

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      const queue = createMessageQueue<string>();

      await queue.enqueue("a");
      await queue.enqueue("b");

      const stats = queue.getStats();

      expect(stats.currentSize).toBe(2);
      expect(stats.totalEnqueued).toBe(2);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalDropped).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.state).toBe("idle");
      expect(stats.backpressureActive).toBe(false);
    });

    it("should track processing statistics", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });

      queue.setProcessor(() => {});

      await queue.enqueue("a");
      await queue.enqueue("b");

      queue.start();
      await vi.advanceTimersByTimeAsync(30);

      const stats = queue.getStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.currentSize).toBe(0);
    });

    it("should track error statistics", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });

      queue.setProcessor(() => {
        throw new Error("Test error");
      });

      await queue.enqueue("a");
      queue.start();
      await vi.advanceTimersByTimeAsync(20);

      const stats = queue.getStats();

      expect(stats.totalErrors).toBe(1);
    });

    it("should calculate utilization", async () => {
      const queue = createMessageQueue<number>({ maxSize: 100 });

      for (let i = 0; i < 50; i++) {
        await queue.enqueue(i);
      }

      const stats = queue.getStats();

      expect(stats.utilization).toBe(50);
    });
  });

  describe("state management", () => {
    it("should track state changes", () => {
      const queue = createMessageQueue<string>();
      const listener = vi.fn();

      queue.on(QueueEventType.STATE_CHANGE, listener);

      queue.setProcessor(() => {});
      queue.start();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueEventType.STATE_CHANGE,
          previousState: "idle",
          currentState: "processing",
        })
      );

      queue.pause();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          previousState: "processing",
          currentState: "paused",
        })
      );
    });

    it("should return correct state", () => {
      const queue = createMessageQueue<string>();

      expect(queue.getState()).toBe("idle");

      queue.setProcessor(() => {});
      queue.start();
      expect(queue.getState()).toBe("processing");

      queue.pause();
      expect(queue.getState()).toBe("paused");

      queue.resume();
      expect(queue.getState()).toBe("processing");

      queue.stop();
      expect(queue.getState()).toBe("idle");

      queue.dispose();
      expect(queue.getState()).toBe("disposed");
    });
  });

  describe("event listeners", () => {
    it("should add and remove listeners", async () => {
      const queue = createMessageQueue<string>();
      const listener = vi.fn();

      const unsubscribe = queue.on(QueueEventType.MESSAGE_ENQUEUED, listener);

      await queue.enqueue("test1");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await queue.enqueue("test2");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support once listeners", async () => {
      const queue = createMessageQueue<string>();
      const listener = vi.fn();

      queue.once(QueueEventType.MESSAGE_ENQUEUED, listener);

      await queue.enqueue("test1");
      await queue.enqueue("test2");

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should remove all listeners for specific event", async () => {
      const queue = createMessageQueue<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      queue.on(QueueEventType.MESSAGE_ENQUEUED, listener1);
      queue.on(QueueEventType.MESSAGE_ENQUEUED, listener2);

      queue.removeAllListeners(QueueEventType.MESSAGE_ENQUEUED);

      await queue.enqueue("test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should remove all listeners", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const enqueueListener = vi.fn();
      const processedListener = vi.fn();

      queue.on(QueueEventType.MESSAGE_ENQUEUED, enqueueListener);
      queue.on(QueueEventType.MESSAGE_PROCESSED, processedListener);

      queue.removeAllListeners();

      queue.setProcessor(() => {});
      await queue.enqueue("test");
      queue.start();
      await vi.advanceTimersByTimeAsync(20);

      expect(enqueueListener).not.toHaveBeenCalled();
      expect(processedListener).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should clean up on dispose", async () => {
      const queue = createMessageQueue<string>();

      queue.setProcessor(() => {});
      await queue.enqueue("test");
      queue.start();

      queue.dispose();

      expect(queue.getState()).toBe("disposed");
      expect(queue.size()).toBe(0);
    });

    it("should not process after dispose", async () => {
      const queue = createMessageQueue<string>({
        batchSize: 10,
        processingInterval: 10,
      });
      const processed: string[] = [];

      queue.setProcessor((msg) => {
        processed.push(msg.data);
      });

      await queue.enqueue("test");
      queue.dispose();

      await vi.advanceTimersByTimeAsync(50);

      expect(processed).toHaveLength(0);
    });
  });
});

describe("Singleton functions", () => {
  beforeEach(() => {
    resetSharedMessageQueue();
  });

  afterEach(() => {
    resetSharedMessageQueue();
  });

  it("should create shared queue on first access", () => {
    const queue = getSharedMessageQueue();

    expect(queue).toBeInstanceOf(MessageQueue);
  });

  it("should return same instance", () => {
    const queue1 = getSharedMessageQueue();
    const queue2 = getSharedMessageQueue();

    expect(queue1).toBe(queue2);
  });

  it("should allow setting custom shared queue", () => {
    const customQueue = createMessageQueue({ maxSize: 5000 });
    setSharedMessageQueue(customQueue);

    const retrieved = getSharedMessageQueue();

    expect(retrieved).toBe(customQueue);
    expect(retrieved.getConfig().maxSize).toBe(5000);
  });

  it("should dispose on reset", () => {
    const queue = getSharedMessageQueue();
    const disposeSpy = vi.spyOn(queue, "dispose");

    resetSharedMessageQueue();

    expect(disposeSpy).toHaveBeenCalled();
  });
});

describe("createFilteredProcessor", () => {
  it("should route messages by type", async () => {
    interface TypedMessage {
      type: string;
      data: unknown;
    }

    const tradeHandler = vi.fn();
    const priceHandler = vi.fn();

    const processor = createFilteredProcessor<TypedMessage>({
      trade: tradeHandler,
      price: priceHandler,
    });

    const tradeMessage: QueuedMessage<TypedMessage> = {
      id: "1",
      data: { type: "trade", data: { amount: 100 } },
      priority: "normal",
      queuedAt: new Date(),
    };

    const priceMessage: QueuedMessage<TypedMessage> = {
      id: "2",
      data: { type: "price", data: { value: 50 } },
      priority: "normal",
      queuedAt: new Date(),
    };

    await processor(tradeMessage);
    await processor(priceMessage);

    expect(tradeHandler).toHaveBeenCalledTimes(1);
    expect(tradeHandler).toHaveBeenCalledWith(tradeMessage);
    expect(priceHandler).toHaveBeenCalledTimes(1);
    expect(priceHandler).toHaveBeenCalledWith(priceMessage);
  });

  it("should ignore unknown message types", async () => {
    interface TypedMessage {
      type: string;
    }

    const handler = vi.fn();

    const processor = createFilteredProcessor<TypedMessage>({
      known: handler,
    });

    const message: QueuedMessage<TypedMessage> = {
      id: "1",
      data: { type: "unknown" },
      priority: "normal",
      queuedAt: new Date(),
    };

    await processor(message);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("createBatchProcessor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should batch messages", async () => {
    const batchHandler = vi.fn();
    const { processor, dispose } = createBatchProcessor<string>(
      batchHandler,
      3,
      100
    );

    const messages: QueuedMessage<string>[] = [
      { id: "1", data: "a", priority: "normal", queuedAt: new Date() },
      { id: "2", data: "b", priority: "normal", queuedAt: new Date() },
      { id: "3", data: "c", priority: "normal", queuedAt: new Date() },
    ];

    for (const msg of messages) {
      await processor(msg);
    }

    expect(batchHandler).toHaveBeenCalledTimes(1);
    expect(batchHandler).toHaveBeenCalledWith(messages);

    dispose();
  });

  it("should flush on interval", async () => {
    const batchHandler = vi.fn();
    const { processor, dispose } = createBatchProcessor<string>(
      batchHandler,
      10,
      50
    );

    const msg: QueuedMessage<string> = {
      id: "1",
      data: "a",
      priority: "normal",
      queuedAt: new Date(),
    };

    await processor(msg);

    expect(batchHandler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60);

    expect(batchHandler).toHaveBeenCalledTimes(1);
    expect(batchHandler).toHaveBeenCalledWith([msg]);

    dispose();
  });

  it("should allow manual flush", async () => {
    const batchHandler = vi.fn();
    const { processor, flush, dispose } = createBatchProcessor<string>(
      batchHandler,
      10,
      1000
    );

    const msg: QueuedMessage<string> = {
      id: "1",
      data: "a",
      priority: "normal",
      queuedAt: new Date(),
    };

    await processor(msg);
    await flush();

    expect(batchHandler).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("should dispose properly", async () => {
    const batchHandler = vi.fn();
    const { processor, dispose } = createBatchProcessor<string>(
      batchHandler,
      10,
      50
    );

    const msg: QueuedMessage<string> = {
      id: "1",
      data: "a",
      priority: "normal",
      queuedAt: new Date(),
    };

    await processor(msg);
    dispose();

    await vi.advanceTimersByTimeAsync(100);

    expect(batchHandler).not.toHaveBeenCalled();
  });
});

describe("calculateQueueHealth", () => {
  it("should return 100 for healthy queue", () => {
    const stats: QueueStats = {
      currentSize: 10,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 100,
      totalDropped: 0,
      totalErrors: 0,
      processingRate: 100,
      avgWaitTime: 10,
      maxWaitTime: 50,
      state: "processing",
      backpressureActive: false,
      backpressureTime: 0,
      utilization: 1,
    };

    expect(calculateQueueHealth(stats)).toBe(100);
  });

  it("should penalize high utilization", () => {
    const stats: QueueStats = {
      currentSize: 950,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 100,
      totalDropped: 0,
      totalErrors: 0,
      processingRate: 100,
      avgWaitTime: 10,
      maxWaitTime: 50,
      state: "processing",
      backpressureActive: false,
      backpressureTime: 0,
      utilization: 95,
    };

    expect(calculateQueueHealth(stats)).toBe(60); // -40 for >90% utilization
  });

  it("should penalize errors", () => {
    const stats: QueueStats = {
      currentSize: 10,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 100,
      totalDropped: 0,
      totalErrors: 15, // 15% error rate
      processingRate: 100,
      avgWaitTime: 10,
      maxWaitTime: 50,
      state: "processing",
      backpressureActive: false,
      backpressureTime: 0,
      utilization: 1,
    };

    expect(calculateQueueHealth(stats)).toBe(70); // -30 for >10% error rate
  });

  it("should penalize high wait times", () => {
    const stats: QueueStats = {
      currentSize: 10,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 100,
      totalDropped: 0,
      totalErrors: 0,
      processingRate: 100,
      avgWaitTime: 6000, // >5000ms
      maxWaitTime: 10000,
      state: "processing",
      backpressureActive: false,
      backpressureTime: 0,
      utilization: 1,
    };

    expect(calculateQueueHealth(stats)).toBe(80); // -20 for >5000ms wait
  });

  it("should penalize active backpressure", () => {
    const stats: QueueStats = {
      currentSize: 800,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 100,
      totalDropped: 0,
      totalErrors: 0,
      processingRate: 100,
      avgWaitTime: 10,
      maxWaitTime: 50,
      state: "processing",
      backpressureActive: true,
      backpressureTime: 1000,
      utilization: 80,
    };

    // -20 for >70% utilization, -15 for backpressure
    expect(calculateQueueHealth(stats)).toBe(65);
  });

  it("should clamp score between 0 and 100", () => {
    const badStats: QueueStats = {
      currentSize: 990,
      maxSize: 1000,
      totalEnqueued: 100,
      totalProcessed: 50,
      totalDropped: 50,
      totalErrors: 50, // 100% error rate
      processingRate: 0,
      avgWaitTime: 10000,
      maxWaitTime: 30000,
      state: "processing",
      backpressureActive: true,
      backpressureTime: 60000,
      utilization: 99,
    };

    expect(calculateQueueHealth(badStats)).toBe(0);
  });
});

describe("PRIORITY_VALUES", () => {
  it("should have correct priority ordering", () => {
    expect(PRIORITY_VALUES.high).toBeLessThan(PRIORITY_VALUES.normal);
    expect(PRIORITY_VALUES.normal).toBeLessThan(PRIORITY_VALUES.low);
  });
});
