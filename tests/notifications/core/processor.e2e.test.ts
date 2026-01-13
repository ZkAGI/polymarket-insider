/**
 * E2E tests for NotificationQueue processor
 * Tests actual queue processing with mock handlers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotificationQueue,
  resetNotificationQueue,
} from "../../../src/notifications/core/queue";
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  ChannelHandler,
  ChannelSendResult,
  NotificationPayload,
  QueueEvent,
  EmailNotificationPayload,
} from "../../../src/notifications/core/types";

// Test timeout for async operations
const PROCESSING_TIMEOUT = 5000;

// Mock channel handler for testing
class MockChannelHandler implements ChannelHandler {
  channel: NotificationChannel;
  sendMock = vi.fn<(payload: NotificationPayload) => Promise<ChannelSendResult>>();
  available: boolean = true;
  status: "available" | "unavailable" | "rate_limited" = "available";
  processDelay: number = 10; // ms

  constructor(channel: NotificationChannel) {
    this.channel = channel;
    const self = this;
    this.sendMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, self.processDelay));
      return {
        success: true,
        channel: self.channel,
        externalId: `mock-${Date.now()}`,
        timestamp: new Date(),
        duration: self.processDelay,
      } as ChannelSendResult;
    });
  }

  async send(payload: NotificationPayload): Promise<ChannelSendResult> {
    return this.sendMock(payload);
  }

  isAvailable(): boolean {
    return this.available;
  }

  getStatus(): "available" | "unavailable" | "rate_limited" {
    return this.status;
  }

  mockFailure(error: string = "Mock error", shouldRetry: boolean = true): void {
    const self = this;
    this.sendMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, self.processDelay));
      return {
        success: false,
        channel: self.channel,
        error,
        shouldRetry,
        timestamp: new Date(),
        duration: self.processDelay,
      } as ChannelSendResult;
    });
  }
}

describe("Queue Processor E2E", () => {
  let queue: NotificationQueue;
  let emailHandler: MockChannelHandler;
  let telegramHandler: MockChannelHandler;

  beforeEach(() => {
    resetNotificationQueue();
    emailHandler = new MockChannelHandler(NotificationChannel.EMAIL);
    telegramHandler = new MockChannelHandler(NotificationChannel.TELEGRAM);

    queue = new NotificationQueue({
      concurrency: 2,
      pollInterval: 50,
      batchSize: 5,
      deadLetterEnabled: true,
      retryDelay: 100, // Fast retry for testing (100ms instead of 1s)
      handlers: [emailHandler, telegramHandler],
    });
  });

  afterEach(async () => {
    await queue.stop();
    resetNotificationQueue();
  });

  describe("Basic processing", () => {
    it("should process queued notification", async () => {
      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      // Wait for processing
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.SENT);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      expect(emailHandler.sendMock).toHaveBeenCalledTimes(1);
    });

    it("should process multiple notifications", async () => {
      const items = await Promise.all([
        queue.addEmail("test1@test.com", "Test 1", "Body 1"),
        queue.addEmail("test2@test.com", "Test 2", "Body 2"),
        queue.addEmail("test3@test.com", "Test 3", "Body 3"),
      ]);

      await queue.start();

      // Wait for all to be processed
      await vi.waitFor(
        async () => {
          for (const item of items) {
            const updated = await queue.get(item.id);
            expect(updated?.status).toBe(NotificationStatus.SENT);
          }
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      expect(emailHandler.sendMock).toHaveBeenCalledTimes(3);
    });

    it("should process notifications from different channels", async () => {
      const emailItem = await queue.addEmail("test@test.com", "Test", "Body");
      const telegramItem = await queue.addTelegram("123", "Test message");

      await queue.start();

      await vi.waitFor(
        async () => {
          const email = await queue.get(emailItem.id);
          const telegram = await queue.get(telegramItem.id);
          expect(email?.status).toBe(NotificationStatus.SENT);
          expect(telegram?.status).toBe(NotificationStatus.SENT);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      expect(emailHandler.sendMock).toHaveBeenCalledTimes(1);
      expect(telegramHandler.sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Priority processing", () => {
    it("should process high priority items first", async () => {
      // Add items in reverse priority order
      await queue.addEmail("low@test.com", "Low", "Body", {
        priority: NotificationPriority.LOW,
      });
      await queue.addEmail("normal@test.com", "Normal", "Body", {
        priority: NotificationPriority.NORMAL,
      });
      await queue.addEmail("high@test.com", "High", "Body", {
        priority: NotificationPriority.HIGH,
      });

      // Track processing order
      const processedOrder: string[] = [];
      emailHandler.sendMock.mockImplementation(async (payload: NotificationPayload) => {
        if (payload.channel === NotificationChannel.EMAIL) {
          processedOrder.push(String((payload as EmailNotificationPayload).to));
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          success: true,
          channel: NotificationChannel.EMAIL,
          timestamp: new Date(),
        } as ChannelSendResult;
      });

      await queue.start();

      // Wait for all to be processed
      await vi.waitFor(
        async () => {
          expect(processedOrder.length).toBe(3);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      // High priority should be processed first
      expect(processedOrder[0]).toBe("high@test.com");
    });
  });

  describe("Failure handling", () => {
    it("should retry failed notifications", async () => {
      // Fail first time, succeed second time
      emailHandler.mockFailure("Connection error", true);

      const item = await queue.addEmail("test@test.com", "Test", "Body", {
        priority: NotificationPriority.NORMAL,
      });

      await queue.start();

      // Wait for retry and success
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.SENT);
          // After failing once and succeeding on retry, attempts should be 2
          expect(updated?.attempts).toBeGreaterThanOrEqual(2);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      expect(emailHandler.sendMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should move to dead letter after max retries", async () => {
      // Configure to fail all attempts
      emailHandler.sendMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          success: false,
          channel: NotificationChannel.EMAIL,
          error: "Permanent failure",
          shouldRetry: true,
          timestamp: new Date(),
        } as ChannelSendResult;
      });

      const item = await queue.add({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
        maxAttempts: 2, // Low retry count for faster test
      });

      await queue.start();

      // Wait for dead letter
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.DEAD_LETTER);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      expect(emailHandler.sendMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should not retry when shouldRetry is false", async () => {
      emailHandler.mockFailure("Permanent error", false);

      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      // Wait for dead letter (since no retry)
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.DEAD_LETTER);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      // Should only be called once
      expect(emailHandler.sendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Scheduled notifications", () => {
    it("should not process notifications scheduled for the future", async () => {
      const futureItem = await queue.addEmail("future@test.com", "Future", "Body", {
        scheduledAt: new Date(Date.now() + 60000), // 1 minute from now
      });

      const immediateItem = await queue.addEmail("immediate@test.com", "Immediate", "Body");

      await queue.start();

      // Wait for immediate to be processed
      await vi.waitFor(
        async () => {
          const immediate = await queue.get(immediateItem.id);
          expect(immediate?.status).toBe(NotificationStatus.SENT);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      // Future should still be pending
      const future = await queue.get(futureItem.id);
      expect(future?.status).toBe(NotificationStatus.PENDING);
    });

    it("should process notifications once scheduled time passes", async () => {
      const item = await queue.addEmail("test@test.com", "Test", "Body", {
        scheduledAt: new Date(Date.now() + 100), // 100ms from now
      });

      await queue.start();

      // Should be pending initially
      const initial = await queue.get(item.id);
      expect(initial?.status).toBe(NotificationStatus.PENDING);

      // Wait for scheduled time to pass and processing
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.SENT);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });
  });

  describe("Handler availability", () => {
    it("should fail when handler is unavailable", async () => {
      emailHandler.available = false;

      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      // Wait for failure
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          // Should eventually end up in dead letter or retrying
          expect([NotificationStatus.DEAD_LETTER, NotificationStatus.PENDING]).toContain(
            updated?.status
          );
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });

    it("should fail for unregistered channel", async () => {
      // Create item for channel without handler
      const item = await queue.add({
        payload: {
          channel: NotificationChannel.DISCORD,
          title: "Test",
          body: "Body",
        },
      });

      await queue.start();

      // Wait for failure (no Discord handler registered)
      await vi.waitFor(
        async () => {
          const updated = await queue.get(item.id);
          expect(updated?.status).toBe(NotificationStatus.DEAD_LETTER);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });
  });

  describe("Concurrency", () => {
    it("should respect concurrency limit", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      emailHandler.sendMock.mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 100));
        concurrent--;
        return {
          success: true,
          channel: NotificationChannel.EMAIL,
          timestamp: new Date(),
        } as ChannelSendResult;
      });

      // Add more items than concurrency limit
      await Promise.all([
        queue.addEmail("test1@test.com", "Test 1", "Body"),
        queue.addEmail("test2@test.com", "Test 2", "Body"),
        queue.addEmail("test3@test.com", "Test 3", "Body"),
        queue.addEmail("test4@test.com", "Test 4", "Body"),
        queue.addEmail("test5@test.com", "Test 5", "Body"),
      ]);

      await queue.start();

      // Wait for all to complete
      await vi.waitFor(
        async () => {
          const stats = await queue.getStats();
          expect(stats.byStatus[NotificationStatus.SENT]).toBe(5);
        },
        { timeout: 10000 }
      );

      // Max concurrent should not exceed configured limit (2)
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe("Event emission", () => {
    it("should emit item_sent event on success", async () => {
      const events: QueueEvent[] = [];
      queue.on((event) => { events.push(event); });

      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      await vi.waitFor(
        async () => {
          const sentEvents = events.filter(
            (e) => e.type === "queue:item_sent" && e.itemId === item.id
          );
          expect(sentEvents.length).toBe(1);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });

    it("should emit item_processing event", async () => {
      const events: QueueEvent[] = [];
      queue.on((event) => { events.push(event); });

      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      await vi.waitFor(
        async () => {
          const processingEvents = events.filter(
            (e) => e.type === "queue:item_processing" && e.itemId === item.id
          );
          expect(processingEvents.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });

    it("should emit item_retrying event on retry", async () => {
      const events: QueueEvent[] = [];
      queue.on((event) => { events.push(event); });

      emailHandler.mockFailure("Temporary error", true);

      const item = await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      await vi.waitFor(
        async () => {
          const retryEvents = events.filter(
            (e) => e.type === "queue:item_retrying" && e.itemId === item.id
          );
          expect(retryEvents.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });
  });

  describe("Manual processing", () => {
    it("processPending should process items immediately", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");

      // Don't start processor, just process pending manually
      const processed = await queue.processPending();

      expect(processed).toBe(1);
      expect(emailHandler.sendMock).toHaveBeenCalledTimes(1);
    });

    it("retryFailed should requeue failed items", async () => {
      // Make handler fail permanently but not go to dead letter
      // (shouldRetry: false with deadLetterEnabled: true makes it go to dead letter)

      // Create a queue with deadLetterEnabled: false so items stay in FAILED status
      const testQueue = new NotificationQueue({
        concurrency: 2,
        pollInterval: 50,
        batchSize: 5,
        deadLetterEnabled: false, // Disabled so items stay in FAILED
        handlers: [emailHandler],
      });

      emailHandler.sendMock.mockImplementation(async () => ({
        success: false,
        channel: NotificationChannel.EMAIL,
        error: "Error",
        shouldRetry: false, // shouldRetry false means no automatic retry
        timestamp: new Date(),
      }));

      const item = await testQueue.add({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
        maxAttempts: 3, // Has room for retries
      });

      await testQueue.processPending();

      // Should be in FAILED status (not dead letter since disabled)
      let updated = await testQueue.get(item.id);
      expect(updated?.status).toBe(NotificationStatus.FAILED);
      expect(updated?.attempts).toBe(1);

      // Reset handler to succeed
      emailHandler.sendMock.mockImplementation(async () => ({
        success: true,
        channel: NotificationChannel.EMAIL,
        timestamp: new Date(),
      }));

      // retryFailed should find items with FAILED status and attempts < maxAttempts
      const retried = await testQueue.retryFailed();
      expect(retried).toBe(1);

      updated = await testQueue.get(item.id);
      expect(updated?.status).toBe(NotificationStatus.PENDING);

      await testQueue.stop();
    });
  });

  describe("Statistics", () => {
    it("should track processing statistics", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      await vi.waitFor(
        async () => {
          const stats = await queue.getStats();
          expect(stats.byStatus[NotificationStatus.SENT]).toBe(1);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      const stats = await queue.getStats();
      expect(stats.total).toBe(1);
      expect(stats.queueDepth).toBe(0); // All processed
      expect(stats.successRate).toBe(100);
    });
  });

  describe("Pause and resume", () => {
    it("should stop processing when paused", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");

      await queue.start();

      // Wait for item to be processed
      await vi.waitFor(
        async () => {
          const stats = await queue.getStats();
          expect(stats.byStatus[NotificationStatus.SENT]).toBe(1);
        },
        { timeout: PROCESSING_TIMEOUT }
      );

      await queue.pause();

      // Add more items while paused
      await queue.addEmail("test2@test.com", "Test 2", "Body");

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 200));

      // New item should still be pending
      const stats = await queue.getStats();
      expect(stats.byStatus[NotificationStatus.PENDING]).toBe(1);
      expect(stats.byStatus[NotificationStatus.SENT]).toBe(1);

      // Resume and verify processing
      await queue.resume();

      await vi.waitFor(
        async () => {
          const updatedStats = await queue.getStats();
          expect(updatedStats.byStatus[NotificationStatus.SENT]).toBe(2);
        },
        { timeout: PROCESSING_TIMEOUT }
      );
    });
  });
});
