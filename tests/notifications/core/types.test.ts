/**
 * Unit tests for notification queue types
 */

import { describe, it, expect } from "vitest";
import {
  // Enums
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  QueueProcessorStatus,
  // Types
  QueueItem,
  CreateQueueItemInput,
  // Utility functions
  generateQueueItemId,
  calculateBackoff,
  shouldRetry,
  shouldDeadLetter,
  isReadyForProcessing,
  getChannelFromPayload,
  createQueueItem,
  formatQueueItemForLog,
  isQueueOverloaded,
  DEFAULT_QUEUE_CONFIG,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
  QueueStats,
} from "../../../src/notifications/core/types";

describe("NotificationChannel enum", () => {
  it("should have correct values", () => {
    expect(NotificationChannel.EMAIL).toBe("email");
    expect(NotificationChannel.TELEGRAM).toBe("telegram");
    expect(NotificationChannel.DISCORD).toBe("discord");
    expect(NotificationChannel.PUSH).toBe("push");
    expect(NotificationChannel.SMS).toBe("sms");
  });
});

describe("NotificationPriority enum", () => {
  it("should have correct numeric values", () => {
    expect(NotificationPriority.LOW).toBe(1);
    expect(NotificationPriority.NORMAL).toBe(2);
    expect(NotificationPriority.HIGH).toBe(3);
    expect(NotificationPriority.CRITICAL).toBe(4);
  });

  it("should be orderable by priority", () => {
    expect(NotificationPriority.CRITICAL).toBeGreaterThan(NotificationPriority.HIGH);
    expect(NotificationPriority.HIGH).toBeGreaterThan(NotificationPriority.NORMAL);
    expect(NotificationPriority.NORMAL).toBeGreaterThan(NotificationPriority.LOW);
  });
});

describe("NotificationStatus enum", () => {
  it("should have correct values", () => {
    expect(NotificationStatus.PENDING).toBe("pending");
    expect(NotificationStatus.PROCESSING).toBe("processing");
    expect(NotificationStatus.SENT).toBe("sent");
    expect(NotificationStatus.FAILED).toBe("failed");
    expect(NotificationStatus.RETRYING).toBe("retrying");
    expect(NotificationStatus.DEAD_LETTER).toBe("dead_letter");
  });
});

describe("QueueProcessorStatus enum", () => {
  it("should have correct values", () => {
    expect(QueueProcessorStatus.IDLE).toBe("idle");
    expect(QueueProcessorStatus.RUNNING).toBe("running");
    expect(QueueProcessorStatus.PAUSED).toBe("paused");
    expect(QueueProcessorStatus.STOPPED).toBe("stopped");
  });
});

describe("generateQueueItemId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateQueueItemId();
    const id2 = generateQueueItemId();
    expect(id1).not.toBe(id2);
  });

  it("should start with notif_ prefix", () => {
    const id = generateQueueItemId();
    expect(id).toMatch(/^notif_/);
  });

  it("should have consistent format", () => {
    const id = generateQueueItemId();
    expect(id).toMatch(/^notif_[a-z0-9]+_[a-z0-9]+$/);
  });
});

describe("calculateBackoff", () => {
  it("should return base delay for first attempt", () => {
    const delay = calculateBackoff(1, 1000);
    // Should be around 1000 ± 10% jitter
    expect(delay).toBeGreaterThanOrEqual(900);
    expect(delay).toBeLessThanOrEqual(1100);
  });

  it("should double delay for each attempt", () => {
    // Second attempt should be ~2000
    const delay2 = calculateBackoff(2, 1000);
    expect(delay2).toBeGreaterThanOrEqual(1800);
    expect(delay2).toBeLessThanOrEqual(2200);

    // Third attempt should be ~4000
    const delay3 = calculateBackoff(3, 1000);
    expect(delay3).toBeGreaterThanOrEqual(3600);
    expect(delay3).toBeLessThanOrEqual(4400);
  });

  it("should not exceed max delay", () => {
    const delay = calculateBackoff(10, 1000, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it("should use default values when not provided", () => {
    const delay = calculateBackoff(1);
    expect(delay).toBeGreaterThanOrEqual(900);
    expect(delay).toBeLessThanOrEqual(1100);
  });
});

describe("shouldRetry", () => {
  it("should return true when status is FAILED and attempts < maxAttempts", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.FAILED,
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(shouldRetry(item)).toBe(true);
  });

  it("should return false when attempts >= maxAttempts", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.FAILED,
      attempts: 3,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(shouldRetry(item)).toBe(false);
  });

  it("should return false when status is not FAILED", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.SENT,
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(shouldRetry(item)).toBe(false);
  });
});

describe("shouldDeadLetter", () => {
  it("should return true when status is FAILED and attempts >= maxAttempts", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.FAILED,
      attempts: 3,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(shouldDeadLetter(item)).toBe(true);
  });

  it("should return false when attempts < maxAttempts", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.FAILED,
      attempts: 2,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(shouldDeadLetter(item)).toBe(false);
  });
});

describe("isReadyForProcessing", () => {
  it("should return true for pending items without scheduled time", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isReadyForProcessing(item)).toBe(true);
  });

  it("should return true when scheduled time has passed", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledAt: new Date(Date.now() - 1000), // 1 second ago
    };
    expect(isReadyForProcessing(item)).toBe(true);
  });

  it("should return false when scheduled time is in the future", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledAt: new Date(Date.now() + 60000), // 1 minute from now
    };
    expect(isReadyForProcessing(item)).toBe(false);
  });

  it("should return false when status is not PENDING", () => {
    const item: QueueItem = {
      id: "test",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.NORMAL,
      status: NotificationStatus.PROCESSING,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(isReadyForProcessing(item)).toBe(false);
  });
});

describe("getChannelFromPayload", () => {
  it("should return EMAIL channel for email payload", () => {
    const payload: EmailNotificationPayload = {
      channel: NotificationChannel.EMAIL,
      to: "test@test.com",
      title: "Test",
      body: "Test body",
    };
    expect(getChannelFromPayload(payload)).toBe(NotificationChannel.EMAIL);
  });

  it("should return TELEGRAM channel for telegram payload", () => {
    const payload: TelegramNotificationPayload = {
      channel: NotificationChannel.TELEGRAM,
      chatId: "123456",
      title: "Test",
      body: "Test body",
    };
    expect(getChannelFromPayload(payload)).toBe(NotificationChannel.TELEGRAM);
  });

  it("should return DISCORD channel for discord payload", () => {
    const payload: DiscordNotificationPayload = {
      channel: NotificationChannel.DISCORD,
      title: "Test",
      body: "Test body",
    };
    expect(getChannelFromPayload(payload)).toBe(NotificationChannel.DISCORD);
  });

  it("should return PUSH channel for push payload", () => {
    const payload: PushNotificationPayload = {
      channel: NotificationChannel.PUSH,
      target: "user123",
      title: "Test",
      body: "Test body",
    };
    expect(getChannelFromPayload(payload)).toBe(NotificationChannel.PUSH);
  });

  it("should return SMS channel for sms payload", () => {
    const payload: SmsNotificationPayload = {
      channel: NotificationChannel.SMS,
      phoneNumber: "+1234567890",
      title: "Test",
      body: "Test body",
    };
    expect(getChannelFromPayload(payload)).toBe(NotificationChannel.SMS);
  });
});

describe("createQueueItem", () => {
  it("should create a queue item with default values", () => {
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
    };
    const item = createQueueItem(input);

    expect(item.id).toMatch(/^notif_/);
    expect(item.payload).toEqual(input.payload);
    expect(item.priority).toBe(NotificationPriority.NORMAL);
    expect(item.status).toBe(NotificationStatus.PENDING);
    expect(item.attempts).toBe(0);
    expect(item.maxAttempts).toBe(3);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.updatedAt).toBeInstanceOf(Date);
    expect(item.scheduledAt).toBeNull();
    expect(item.processingStartedAt).toBeNull();
    expect(item.completedAt).toBeNull();
    expect(item.error).toBeNull();
  });

  it("should respect provided priority", () => {
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
      priority: NotificationPriority.CRITICAL,
    };
    const item = createQueueItem(input);
    expect(item.priority).toBe(NotificationPriority.CRITICAL);
  });

  it("should respect provided maxAttempts", () => {
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
      maxAttempts: 5,
    };
    const item = createQueueItem(input);
    expect(item.maxAttempts).toBe(5);
  });

  it("should respect provided scheduledAt", () => {
    const scheduledAt = new Date(Date.now() + 60000);
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
      scheduledAt,
    };
    const item = createQueueItem(input);
    expect(item.scheduledAt).toEqual(scheduledAt);
  });

  it("should include correlationId when provided", () => {
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
      correlationId: "correlation-123",
    };
    const item = createQueueItem(input);
    expect(item.correlationId).toBe("correlation-123");
  });

  it("should include context when provided", () => {
    const input: CreateQueueItemInput = {
      payload: {
        channel: NotificationChannel.EMAIL,
        to: "test@test.com",
        title: "Test",
        body: "Test body",
      } as EmailNotificationPayload,
      context: { alertId: "alert-123", source: "test" },
    };
    const item = createQueueItem(input);
    expect(item.context).toEqual({ alertId: "alert-123", source: "test" });
  });
});

describe("formatQueueItemForLog", () => {
  it("should format queue item for logging", () => {
    const item: QueueItem = {
      id: "notif_test123_abc",
      payload: { channel: NotificationChannel.EMAIL, to: "test@test.com", title: "Test", body: "Test" } as EmailNotificationPayload,
      priority: NotificationPriority.HIGH,
      status: NotificationStatus.PENDING,
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const formatted = formatQueueItemForLog(item);
    expect(formatted).toBe("[notif_test123_abc] email (HIGH) - pending (1/3)");
  });

  it("should handle different statuses", () => {
    const item: QueueItem = {
      id: "notif_test",
      payload: { channel: NotificationChannel.TELEGRAM, chatId: "123", title: "Test", body: "Test" } as TelegramNotificationPayload,
      priority: NotificationPriority.CRITICAL,
      status: NotificationStatus.PROCESSING,
      attempts: 2,
      maxAttempts: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const formatted = formatQueueItemForLog(item);
    expect(formatted).toBe("[notif_test] telegram (CRITICAL) - processing (2/5)");
  });
});

describe("isQueueOverloaded", () => {
  it("should return true when queue depth exceeds threshold", () => {
    const stats: QueueStats = {
      total: 1500,
      byStatus: {} as Record<NotificationStatus, number>,
      byChannel: {} as Record<NotificationChannel, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      avgProcessingTime: 100,
      successRate: 95,
      queueDepth: 1200,
      processedLastHour: 100,
      timestamp: new Date(),
    };
    expect(isQueueOverloaded(stats, 1000)).toBe(true);
  });

  it("should return false when queue depth is below threshold", () => {
    const stats: QueueStats = {
      total: 500,
      byStatus: {} as Record<NotificationStatus, number>,
      byChannel: {} as Record<NotificationChannel, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      avgProcessingTime: 100,
      successRate: 95,
      queueDepth: 500,
      processedLastHour: 100,
      timestamp: new Date(),
    };
    expect(isQueueOverloaded(stats, 1000)).toBe(false);
  });

  it("should use default threshold of 1000", () => {
    const stats: QueueStats = {
      total: 1001,
      byStatus: {} as Record<NotificationStatus, number>,
      byChannel: {} as Record<NotificationChannel, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      avgProcessingTime: 100,
      successRate: 95,
      queueDepth: 1001,
      processedLastHour: 100,
      timestamp: new Date(),
    };
    expect(isQueueOverloaded(stats)).toBe(true);
  });
});

describe("DEFAULT_QUEUE_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_QUEUE_CONFIG.concurrency).toBe(5);
    expect(DEFAULT_QUEUE_CONFIG.pollInterval).toBe(1000);
    expect(DEFAULT_QUEUE_CONFIG.batchSize).toBe(10);
    expect(DEFAULT_QUEUE_CONFIG.processingTimeout).toBe(30000);
    expect(DEFAULT_QUEUE_CONFIG.priorityProcessing).toBe(true);
    expect(DEFAULT_QUEUE_CONFIG.deadLetterEnabled).toBe(true);
    expect(DEFAULT_QUEUE_CONFIG.maxQueueAge).toBe(24 * 60 * 60 * 1000);
  });

  it("should have rate limits for all channels", () => {
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel).toBeDefined();
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel?.[NotificationChannel.EMAIL]).toBe(60);
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel?.[NotificationChannel.TELEGRAM]).toBe(30);
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel?.[NotificationChannel.DISCORD]).toBe(30);
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel?.[NotificationChannel.PUSH]).toBe(120);
    expect(DEFAULT_QUEUE_CONFIG.rateLimitPerChannel?.[NotificationChannel.SMS]).toBe(10);
  });

  it("should have a function for retryDelay", () => {
    expect(typeof DEFAULT_QUEUE_CONFIG.retryDelay).toBe("function");
    if (typeof DEFAULT_QUEUE_CONFIG.retryDelay === "function") {
      const delay1 = DEFAULT_QUEUE_CONFIG.retryDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(900);
      expect(delay1).toBeLessThanOrEqual(1100);
    }
  });
});
