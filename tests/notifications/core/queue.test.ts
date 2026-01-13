/**
 * Unit tests for NotificationQueue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotificationQueue,
  getNotificationQueue,
  resetNotificationQueue,
  setNotificationQueue,
  queueNotification,
  queueEmail,
  queueTelegram,
  queueDiscord,
  queuePush,
} from "../../../src/notifications/core/queue";
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  QueueProcessorStatus,
  ChannelHandler,
  ChannelSendResult,
  NotificationPayload,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  QueueEvent,
} from "../../../src/notifications/core/types";

// Mock channel handler for testing
class MockChannelHandler implements ChannelHandler {
  channel: NotificationChannel;
  sendMock = vi.fn<(payload: NotificationPayload) => Promise<ChannelSendResult>>();
  available: boolean = true;
  status: "available" | "unavailable" | "rate_limited" = "available";

  constructor(channel: NotificationChannel) {
    this.channel = channel;
    this.sendMock.mockResolvedValue({
      success: true,
      channel,
      externalId: "mock-123",
      timestamp: new Date(),
      duration: 100,
    } as ChannelSendResult);
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
}

describe("NotificationQueue", () => {
  let queue: NotificationQueue;

  beforeEach(() => {
    resetNotificationQueue();
    queue = new NotificationQueue();
  });

  afterEach(async () => {
    await queue.stop();
    resetNotificationQueue();
  });

  describe("constructor", () => {
    it("should create queue with default config", () => {
      expect(queue).toBeInstanceOf(NotificationQueue);
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.IDLE);
    });

    it("should auto-start when configured", async () => {
      const autoStartQueue = new NotificationQueue({ autoStart: true });
      expect(autoStartQueue.isRunning()).toBe(true);
      await autoStartQueue.stop();
    });

    it("should register provided handlers", () => {
      const handler = new MockChannelHandler(NotificationChannel.EMAIL);
      const handlerQueue = new NotificationQueue({ handlers: [handler] });
      const handlers = handlerQueue.getHandlers();
      expect(handlers.get(NotificationChannel.EMAIL)).toBe(handler);
    });
  });

  describe("add", () => {
    it("should add notification to queue", async () => {
      const item = await queue.add({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
      });

      expect(item.id).toMatch(/^notif_/);
      expect(item.status).toBe(NotificationStatus.PENDING);

      const retrieved = await queue.get(item.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(item.id);
    });

    it("should respect priority setting", async () => {
      const item = await queue.add({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
        priority: NotificationPriority.CRITICAL,
      });

      expect(item.priority).toBe(NotificationPriority.CRITICAL);
    });

    it("should respect scheduledAt setting", async () => {
      const scheduledAt = new Date(Date.now() + 60000);
      const item = await queue.add({
        payload: {
          channel: NotificationChannel.EMAIL,
          to: "test@test.com",
          title: "Test",
          body: "Test body",
        } as EmailNotificationPayload,
        scheduledAt,
      });

      expect(item.scheduledAt).toEqual(scheduledAt);
    });
  });

  describe("addEmail", () => {
    it("should add email notification with correct payload", async () => {
      const item = await queue.addEmail(
        "test@test.com",
        "Test Subject",
        "Test body"
      );

      const retrieved = await queue.get(item.id);
      expect(retrieved).not.toBeNull();

      const payload = retrieved?.payload as EmailNotificationPayload;
      expect(payload.channel).toBe(NotificationChannel.EMAIL);
      expect(payload.to).toBe("test@test.com");
      expect(payload.subject).toBe("Test Subject");
      expect(payload.body).toBe("Test body");
    });

    it("should accept array of recipients", async () => {
      const item = await queue.addEmail(
        ["user1@test.com", "user2@test.com"],
        "Test Subject",
        "Test body"
      );

      const retrieved = await queue.get(item.id);
      const payload = retrieved?.payload as EmailNotificationPayload;
      expect(payload.to).toEqual(["user1@test.com", "user2@test.com"]);
    });

    it("should include optional fields", async () => {
      const item = await queue.addEmail(
        "test@test.com",
        "Test Subject",
        "Test body",
        {
          html: "<p>Test</p>",
          priority: NotificationPriority.HIGH,
          templateId: "template-123",
          templateVars: { name: "Test" },
          correlationId: "corr-123",
        }
      );

      expect(item.priority).toBe(NotificationPriority.HIGH);
      expect(item.correlationId).toBe("corr-123");

      const payload = item.payload as EmailNotificationPayload;
      expect(payload.html).toBe("<p>Test</p>");
      expect(payload.templateId).toBe("template-123");
      expect(payload.templateVars).toEqual({ name: "Test" });
    });
  });

  describe("addTelegram", () => {
    it("should add telegram notification with correct payload", async () => {
      const item = await queue.addTelegram("123456789", "Test message");

      const retrieved = await queue.get(item.id);
      const payload = retrieved?.payload as TelegramNotificationPayload;
      expect(payload.channel).toBe(NotificationChannel.TELEGRAM);
      expect(payload.chatId).toBe("123456789");
      expect(payload.body).toBe("Test message");
    });

    it("should support numeric chatId", async () => {
      const item = await queue.addTelegram(123456789, "Test message");

      const payload = item.payload as TelegramNotificationPayload;
      expect(payload.chatId).toBe(123456789);
    });

    it("should include optional telegram options", async () => {
      const item = await queue.addTelegram("123456789", "Test message", {
        parseMode: "HTML",
        buttons: [[{ text: "Click me", url: "https://example.com" }]],
        disableWebPagePreview: true,
        disableNotification: true,
      });

      const payload = item.payload as TelegramNotificationPayload;
      expect(payload.parseMode).toBe("HTML");
      expect(payload.buttons).toHaveLength(1);
      expect(payload.disableWebPagePreview).toBe(true);
      expect(payload.disableNotification).toBe(true);
    });
  });

  describe("addDiscord", () => {
    it("should add discord notification with correct payload", async () => {
      const item = await queue.addDiscord("Test content");

      const retrieved = await queue.get(item.id);
      const payload = retrieved?.payload as DiscordNotificationPayload;
      expect(payload.channel).toBe(NotificationChannel.DISCORD);
      expect(payload.body).toBe("Test content");
    });

    it("should support embeds", async () => {
      const item = await queue.addDiscord("Test content", {
        embeds: [
          {
            title: "Alert",
            description: "Something happened",
            color: 0xff0000,
            fields: [{ name: "Field", value: "Value", inline: true }],
          },
        ],
      });

      const payload = item.payload as DiscordNotificationPayload;
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds?.[0]?.title).toBe("Alert");
    });

    it("should support custom webhook URL", async () => {
      const item = await queue.addDiscord("Test content", {
        webhookUrl: "https://discord.com/api/webhooks/123/token",
      });

      const payload = item.payload as DiscordNotificationPayload;
      expect(payload.webhookUrl).toBe(
        "https://discord.com/api/webhooks/123/token"
      );
    });
  });

  describe("addPush", () => {
    it("should add push notification with correct payload", async () => {
      const item = await queue.addPush("user-123", "Alert", "Something happened");

      const retrieved = await queue.get(item.id);
      const payload = retrieved?.payload as PushNotificationPayload;
      expect(payload.channel).toBe(NotificationChannel.PUSH);
      expect(payload.target).toBe("user-123");
      expect(payload.title).toBe("Alert");
      expect(payload.body).toBe("Something happened");
    });

    it("should support multiple targets", async () => {
      const item = await queue.addPush(
        ["user-1", "user-2"],
        "Alert",
        "Something happened"
      );

      const payload = item.payload as PushNotificationPayload;
      expect(payload.target).toEqual(["user-1", "user-2"]);
    });

    it("should include optional push options", async () => {
      const item = await queue.addPush("user-123", "Alert", "Something happened", {
        icon: "https://example.com/icon.png",
        badge: "https://example.com/badge.png",
        url: "https://example.com/alert",
        tag: "alert-123",
        requireInteraction: true,
        actions: [{ action: "view", title: "View Details" }],
      });

      const payload = item.payload as PushNotificationPayload;
      expect(payload.icon).toBe("https://example.com/icon.png");
      expect(payload.badge).toBe("https://example.com/badge.png");
      expect(payload.url).toBe("https://example.com/alert");
      expect(payload.tag).toBe("alert-123");
      expect(payload.requireInteraction).toBe(true);
      expect(payload.actions).toHaveLength(1);
    });
  });

  describe("addBatch", () => {
    it("should add multiple notifications", async () => {
      const items = await queue.addBatch([
        {
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test1@test.com",
            title: "Test 1",
            body: "Body 1",
          } as EmailNotificationPayload,
        },
        {
          payload: {
            channel: NotificationChannel.EMAIL,
            to: "test2@test.com",
            title: "Test 2",
            body: "Body 2",
          } as EmailNotificationPayload,
        },
      ]);

      expect(items.length).toBe(2);
      expect(items[0]?.id).not.toBe(items[1]?.id);
    });
  });

  describe("find and count", () => {
    beforeEach(async () => {
      await queue.addEmail("test1@test.com", "Test 1", "Body 1", {
        priority: NotificationPriority.HIGH,
      });
      await queue.addEmail("test2@test.com", "Test 2", "Body 2");
      await queue.addTelegram("123", "Test 3");
    });

    it("should find items by channel", async () => {
      const emails = await queue.find({ channel: NotificationChannel.EMAIL });
      expect(emails.length).toBe(2);
    });

    it("should count items", async () => {
      const count = await queue.count({});
      expect(count).toBe(3);
    });

    it("should count by filter", async () => {
      const emailCount = await queue.count({
        channel: NotificationChannel.EMAIL,
      });
      expect(emailCount).toBe(2);
    });
  });

  describe("remove", () => {
    it("should remove item from queue", async () => {
      const item = await queue.addEmail("test@test.com", "Test", "Body");
      const removed = await queue.remove(item.id);

      expect(removed).toBe(true);
      const retrieved = await queue.get(item.id);
      expect(retrieved).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear all items", async () => {
      await queue.addEmail("test1@test.com", "Test 1", "Body 1");
      await queue.addEmail("test2@test.com", "Test 2", "Body 2");

      const cleared = await queue.clear();
      expect(cleared).toBe(2);

      const count = await queue.count({});
      expect(count).toBe(0);
    });
  });

  describe("processor control", () => {
    it("should start and stop processor", async () => {
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.IDLE);

      await queue.start();
      expect(queue.isRunning()).toBe(true);
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.RUNNING);

      await queue.stop();
      expect(queue.isRunning()).toBe(false);
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.STOPPED);
    });

    it("should pause and resume processor", async () => {
      await queue.start();

      await queue.pause();
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.PAUSED);

      await queue.resume();
      expect(queue.getProcessorStatus()).toBe(QueueProcessorStatus.RUNNING);
    });
  });

  describe("handler management", () => {
    it("should register and unregister handlers", () => {
      const handler = new MockChannelHandler(NotificationChannel.EMAIL);
      queue.registerHandler(handler);

      let handlers = queue.getHandlers();
      expect(handlers.get(NotificationChannel.EMAIL)).toBe(handler);

      queue.unregisterHandler(NotificationChannel.EMAIL);
      handlers = queue.getHandlers();
      expect(handlers.get(NotificationChannel.EMAIL)).toBeUndefined();
    });
  });

  describe("events", () => {
    it("should emit events to listeners", async () => {
      const events: QueueEvent[] = [];
      queue.on((event) => {
        events.push(event);
      });

      await queue.start();

      // Wait a bit for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.some((e) => e.type === "queue:processor_started")).toBe(true);
    });

    it("should remove event listeners", async () => {
      const events: QueueEvent[] = [];
      const handler = (event: QueueEvent) => {
        events.push(event);
      };

      queue.on(handler);
      queue.off(handler);

      await queue.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.length).toBe(0);
    });
  });

  describe("statistics", () => {
    it("should return queue statistics", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");
      const stats = await queue.getStats();

      expect(stats.total).toBe(1);
      expect(stats.queueDepth).toBe(1);
      expect(stats.timestamp).toBeInstanceOf(Date);
    });

    it("should return pending count", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");
      const pending = await queue.getPendingCount();
      expect(pending).toBe(1);
    });

    it("should return queue depth", async () => {
      await queue.addEmail("test@test.com", "Test", "Body");
      const depth = await queue.getQueueDepth();
      expect(depth).toBe(1);
    });
  });
});

describe("Singleton management", () => {
  beforeEach(() => {
    resetNotificationQueue();
  });

  afterEach(() => {
    resetNotificationQueue();
  });

  it("getNotificationQueue should return singleton", () => {
    const queue1 = getNotificationQueue();
    const queue2 = getNotificationQueue();
    expect(queue1).toBe(queue2);
  });

  it("resetNotificationQueue should clear singleton", async () => {
    const queue1 = getNotificationQueue();
    await queue1.stop();
    resetNotificationQueue();
    const queue2 = getNotificationQueue();
    expect(queue1).not.toBe(queue2);
  });

  it("setNotificationQueue should replace singleton", () => {
    const custom = new NotificationQueue();
    setNotificationQueue(custom);
    const retrieved = getNotificationQueue();
    expect(retrieved).toBe(custom);
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    resetNotificationQueue();
  });

  afterEach(() => {
    resetNotificationQueue();
  });

  it("queueNotification should add to shared queue", async () => {
    const item = await queueNotification({
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Body",
      } as EmailNotificationPayload,
    });

    const queue = getNotificationQueue();
    const retrieved = await queue.get(item.id);
    expect(retrieved).not.toBeNull();
  });

  it("queueEmail should add email to shared queue", async () => {
    const item = await queueEmail("test@test.com", "Subject", "Body");
    expect(item.payload.channel).toBe(NotificationChannel.EMAIL);
  });

  it("queueTelegram should add telegram to shared queue", async () => {
    const item = await queueTelegram("123", "Message");
    expect(item.payload.channel).toBe(NotificationChannel.TELEGRAM);
  });

  it("queueDiscord should add discord to shared queue", async () => {
    const item = await queueDiscord("Content");
    expect(item.payload.channel).toBe(NotificationChannel.DISCORD);
  });

  it("queuePush should add push to shared queue", async () => {
    const item = await queuePush("user-123", "Title", "Body");
    expect(item.payload.channel).toBe(NotificationChannel.PUSH);
  });
});
