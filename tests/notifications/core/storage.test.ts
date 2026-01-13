/**
 * Unit tests for InMemoryQueueStorage
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryQueueStorage,
  getQueueStorage,
  resetQueueStorage,
  setQueueStorage,
} from "../../../src/notifications/core/storage";
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  createQueueItem,
  EmailNotificationPayload,
  TelegramNotificationPayload,
} from "../../../src/notifications/core/types";

describe("InMemoryQueueStorage", () => {
  let storage: InMemoryQueueStorage;

  beforeEach(() => {
    storage = new InMemoryQueueStorage();
  });

  describe("add", () => {
    it("should add an item to the queue", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const retrieved = await storage.get(item.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(item.id);
      expect(retrieved?.payload).toEqual(item.payload);
    });

    it("should store a copy of the item", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      item.status = NotificationStatus.SENT; // Modify original

      const retrieved = await storage.get(item.id);
      expect(retrieved?.status).toBe(NotificationStatus.PENDING); // Should not be modified
    });
  });

  describe("get", () => {
    it("should return null for non-existent item", async () => {
      const result = await storage.get("non-existent-id");
      expect(result).toBeNull();
    });

    it("should return a copy of the item", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const retrieved1 = await storage.get(item.id);
      const retrieved2 = await storage.get(item.id);

      expect(retrieved1).not.toBe(retrieved2); // Different objects
      expect(retrieved1).toEqual(retrieved2); // Same content
    });
  });

  describe("update", () => {
    it("should update item status", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      await storage.update(item.id, { status: NotificationStatus.PROCESSING });

      const retrieved = await storage.get(item.id);
      expect(retrieved?.status).toBe(NotificationStatus.PROCESSING);
    });

    it("should increment attempts", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      expect(item.attempts).toBe(0);

      await storage.update(item.id, { incrementAttempts: true });
      let retrieved = await storage.get(item.id);
      expect(retrieved?.attempts).toBe(1);

      await storage.update(item.id, { incrementAttempts: true });
      retrieved = await storage.get(item.id);
      expect(retrieved?.attempts).toBe(2);
    });

    it("should update error field", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      await storage.update(item.id, { error: "Connection failed" });

      const retrieved = await storage.get(item.id);
      expect(retrieved?.error).toBe("Connection failed");
    });

    it("should update processingStartedAt", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const now = new Date();
      await storage.update(item.id, { processingStartedAt: now });

      const retrieved = await storage.get(item.id);
      expect(retrieved?.processingStartedAt).toEqual(now);
    });

    it("should update completedAt", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const now = new Date();
      await storage.update(item.id, { completedAt: now });

      const retrieved = await storage.get(item.id);
      expect(retrieved?.completedAt).toEqual(now);
    });

    it("should return null for non-existent item", async () => {
      const result = await storage.update("non-existent", {
        status: NotificationStatus.SENT,
      });
      expect(result).toBeNull();
    });

    it("should return updated item", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const updated = await storage.update(item.id, {
        status: NotificationStatus.SENT,
      });

      expect(updated?.status).toBe(NotificationStatus.SENT);
    });
  });

  describe("remove", () => {
    it("should remove item from queue", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      await storage.add(item);
      const removed = await storage.remove(item.id);

      expect(removed).toBe(true);
      const retrieved = await storage.get(item.id);
      expect(retrieved).toBeNull();
    });

    it("should return false for non-existent item", async () => {
      const removed = await storage.remove("non-existent");
      expect(removed).toBe(false);
    });
  });

  describe("find", () => {
    beforeEach(async () => {
      // Add various items for testing
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test1@test.com",
            title: "Test 1",
            body: "Body 1",
          } as EmailNotificationPayload,
          priority: NotificationPriority.HIGH,
        })
      );
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test2@test.com",
            title: "Test 2",
            body: "Body 2",
          } as EmailNotificationPayload,
          priority: NotificationPriority.NORMAL,
        })
      );
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.TELEGRAM,
            chatId: "123",
            title: "Test 3",
            body: "Body 3",
          } as TelegramNotificationPayload,
          priority: NotificationPriority.LOW,
        })
      );
    });

    it("should find all items without filter", async () => {
      const items = await storage.find({});
      expect(items.length).toBe(3);
    });

    it("should filter by status", async () => {
      const items = await storage.find({ status: NotificationStatus.PENDING });
      expect(items.length).toBe(3);

      const sent = await storage.find({ status: NotificationStatus.SENT });
      expect(sent.length).toBe(0);
    });

    it("should filter by channel", async () => {
      const emailItems = await storage.find({
        channel: NotificationChannel.EMAIL,
      });
      expect(emailItems.length).toBe(2);

      const telegramItems = await storage.find({
        channel: NotificationChannel.TELEGRAM,
      });
      expect(telegramItems.length).toBe(1);
    });

    it("should filter by priority", async () => {
      const highPriority = await storage.find({
        priority: NotificationPriority.HIGH,
      });
      expect(highPriority.length).toBe(1);

      const normalPriority = await storage.find({
        priority: NotificationPriority.NORMAL,
      });
      expect(normalPriority.length).toBe(1);
    });

    it("should sort by priority (highest first)", async () => {
      const items = await storage.find({});
      expect(items[0]?.priority).toBe(NotificationPriority.HIGH);
      expect(items[1]?.priority).toBe(NotificationPriority.NORMAL);
      expect(items[2]?.priority).toBe(NotificationPriority.LOW);
    });

    it("should respect limit", async () => {
      const items = await storage.find({ limit: 2 });
      expect(items.length).toBe(2);
    });

    it("should respect offset", async () => {
      const items = await storage.find({ offset: 1 });
      expect(items.length).toBe(2);
    });

    it("should handle multiple filters", async () => {
      const items = await storage.find({
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.HIGH,
      });
      expect(items.length).toBe(1);
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test@test.com",
            title: "Test",
            body: "Body",
          } as EmailNotificationPayload,
        })
      );
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test2@test.com",
            title: "Test 2",
            body: "Body 2",
          } as EmailNotificationPayload,
        })
      );
    });

    it("should count all items", async () => {
      const count = await storage.count({});
      expect(count).toBe(2);
    });

    it("should count filtered items", async () => {
      const count = await storage.count({
        channel: NotificationChannel.EMAIL,
      });
      expect(count).toBe(2);

      const telegramCount = await storage.count({
        channel: NotificationChannel.TELEGRAM,
      });
      expect(telegramCount).toBe(0);
    });
  });

  describe("getReadyForProcessing", () => {
    it("should return pending items without scheduled time", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
      });
      await storage.add(item);

      const ready = await storage.getReadyForProcessing(10);
      expect(ready.length).toBe(1);
      expect(ready[0]?.id).toBe(item.id);
    });

    it("should not return items scheduled for the future", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
        scheduledAt: new Date(Date.now() + 60000), // 1 minute in future
      });
      await storage.add(item);

      const ready = await storage.getReadyForProcessing(10);
      expect(ready.length).toBe(0);
    });

    it("should return items with past scheduled time", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
        scheduledAt: new Date(Date.now() - 1000), // 1 second ago
      });
      await storage.add(item);

      const ready = await storage.getReadyForProcessing(10);
      expect(ready.length).toBe(1);
    });

    it("should respect limit", async () => {
      for (let i = 0; i < 5; i++) {
        await storage.add(
          createQueueItem({
            payload: {
              channel: NotificationChannel.EMAIL,
              to: `test${i}@test.com`,
              title: `Test ${i}`,
              body: "Body",
            } as EmailNotificationPayload,
          })
        );
      }

      const ready = await storage.getReadyForProcessing(3);
      expect(ready.length).toBe(3);
    });

    it("should sort by priority", async () => {
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "low@test.com",
            title: "Low",
            body: "Body",
          } as EmailNotificationPayload,
          priority: NotificationPriority.LOW,
        })
      );
      await storage.add(
        createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "critical@test.com",
            title: "Critical",
            body: "Body",
          } as EmailNotificationPayload,
          priority: NotificationPriority.CRITICAL,
        })
      );

      const ready = await storage.getReadyForProcessing(10);
      expect(ready[0]?.priority).toBe(NotificationPriority.CRITICAL);
      expect(ready[1]?.priority).toBe(NotificationPriority.LOW);
    });
  });

  describe("markProcessing", () => {
    it("should mark pending item as processing", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
      });
      await storage.add(item);

      const success = await storage.markProcessing(item.id);
      expect(success).toBe(true);

      const retrieved = await storage.get(item.id);
      expect(retrieved?.status).toBe(NotificationStatus.PROCESSING);
      expect(retrieved?.processingStartedAt).toBeInstanceOf(Date);
    });

    it("should return false for non-pending item", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
      });
      await storage.add(item);
      await storage.update(item.id, { status: NotificationStatus.PROCESSING });

      const success = await storage.markProcessing(item.id);
      expect(success).toBe(false);
    });

    it("should return false for non-existent item", async () => {
      const success = await storage.markProcessing("non-existent");
      expect(success).toBe(false);
    });
  });

  describe("getStats", () => {
    beforeEach(async () => {
      // Add items with different statuses and channels
      const pendingEmail = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
        priority: NotificationPriority.HIGH,
      });
      await storage.add(pendingEmail);

      const processingTelegram = createQueueItem({
        payload: {
          channel: NotificationChannel.TELEGRAM,
          chatId: "123",
          title: "Test",
          body: "Body",
        } as TelegramNotificationPayload,
        priority: NotificationPriority.NORMAL,
      });
      await storage.add(processingTelegram);
      await storage.update(processingTelegram.id, {
        status: NotificationStatus.PROCESSING,
      });
    });

    it("should return correct total", async () => {
      const stats = await storage.getStats();
      expect(stats.total).toBe(2);
    });

    it("should return correct counts by status", async () => {
      const stats = await storage.getStats();
      expect(stats.byStatus[NotificationStatus.PENDING]).toBe(1);
      expect(stats.byStatus[NotificationStatus.PROCESSING]).toBe(1);
    });

    it("should return correct counts by channel", async () => {
      const stats = await storage.getStats();
      expect(stats.byChannel[NotificationChannel.EMAIL]).toBe(1);
      expect(stats.byChannel[NotificationChannel.TELEGRAM]).toBe(1);
    });

    it("should return correct queue depth", async () => {
      const stats = await storage.getStats();
      expect(stats.queueDepth).toBe(2); // pending + processing
    });

    it("should return timestamp", async () => {
      const stats = await storage.getStats();
      expect(stats.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await storage.add(
          createQueueItem({
            payload: {
              channel: NotificationChannel.EMAIL,
              to: `test${i}@test.com`,
              title: `Test ${i}`,
              body: "Body",
            } as EmailNotificationPayload,
          })
        );
      }
    });

    it("should clear all items without filter", async () => {
      const cleared = await storage.clear();
      expect(cleared).toBe(5);

      const remaining = await storage.count({});
      expect(remaining).toBe(0);
    });

    it("should clear only matching items with filter", async () => {
      // Mark some as sent
      const items = await storage.find({ limit: 2 });
      for (const item of items) {
        await storage.update(item.id, { status: NotificationStatus.SENT });
      }

      const cleared = await storage.clear({ status: NotificationStatus.SENT });
      expect(cleared).toBe(2);

      const remaining = await storage.count({});
      expect(remaining).toBe(3);
    });
  });

  describe("getDeadLetter", () => {
    it("should return dead letter items", async () => {
      const item = createQueueItem({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Body",
        } as EmailNotificationPayload,
      });
      await storage.add(item);
      await storage.update(item.id, { status: NotificationStatus.DEAD_LETTER });

      const deadLetter = await storage.getDeadLetter();
      expect(deadLetter.length).toBe(1);
      expect(deadLetter[0]?.id).toBe(item.id);
    });

    it("should respect limit", async () => {
      for (let i = 0; i < 5; i++) {
        const item = createQueueItem({
          payload: {
            channel: NotificationChannel.EMAIL,
            to: `test${i}@test.com`,
            title: `Test ${i}`,
            body: "Body",
          } as EmailNotificationPayload,
        });
        await storage.add(item);
        await storage.update(item.id, { status: NotificationStatus.DEAD_LETTER });
      }

      const deadLetter = await storage.getDeadLetter(3);
      expect(deadLetter.length).toBe(3);
    });
  });
});

describe("Singleton management", () => {
  beforeEach(() => {
    resetQueueStorage();
  });

  it("getQueueStorage should return singleton", () => {
    const storage1 = getQueueStorage();
    const storage2 = getQueueStorage();
    expect(storage1).toBe(storage2);
  });

  it("resetQueueStorage should clear singleton", () => {
    const storage1 = getQueueStorage();
    resetQueueStorage();
    const storage2 = getQueueStorage();
    expect(storage1).not.toBe(storage2);
  });

  it("setQueueStorage should replace singleton", () => {
    const custom = new InMemoryQueueStorage();
    setQueueStorage(custom);
    const retrieved = getQueueStorage();
    expect(retrieved).toBe(custom);
  });
});
