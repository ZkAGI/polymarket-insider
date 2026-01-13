/**
 * Unit tests for the Notification Rate Limiter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotificationRateLimiter,
  RateLimitKeyType,
  RateLimiterEvent,
  extractRecipientId,
  generateRateLimitKey,
  DEFAULT_RATE_LIMITER_CONFIG,
  getRateLimiter,
  resetRateLimiter,
  setRateLimiter,
  isNotificationRateLimited,
  checkNotificationRateLimit,
  checkQueueInputRateLimit,
  getRateLimiterStats,
} from "../../../src/notifications/core/rate-limiter";
import {
  NotificationChannel,
  NotificationPriority,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
  CreateQueueItemInput,
} from "../../../src/notifications/core/types";

// Helper to create test payloads
function createEmailPayload(to: string = "test@example.com"): EmailNotificationPayload {
  return {
    channel: NotificationChannel.EMAIL,
    to,
    title: "Test Alert",
    body: "This is a test notification",
  };
}

function createTelegramPayload(chatId: string | number = "123456789"): TelegramNotificationPayload {
  return {
    channel: NotificationChannel.TELEGRAM,
    chatId,
    title: "Test Alert",
    body: "This is a test notification",
  };
}

function createDiscordPayload(webhookUrl?: string): DiscordNotificationPayload {
  return {
    channel: NotificationChannel.DISCORD,
    webhookUrl,
    title: "Test Alert",
    body: "This is a test notification",
  };
}

function createPushPayload(target: string | string[] = "sub_123"): PushNotificationPayload {
  return {
    channel: NotificationChannel.PUSH,
    target,
    title: "Test Alert",
    body: "This is a test notification",
  };
}

function createSmsPayload(phoneNumber: string = "+1234567890"): SmsNotificationPayload {
  return {
    channel: NotificationChannel.SMS,
    phoneNumber,
    title: "Test Alert",
    body: "This is a test notification",
  };
}

describe("NotificationRateLimiter", () => {
  let limiter: NotificationRateLimiter;

  beforeEach(() => {
    // Reset shared instance before each test
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
    vi.useRealTimers();
  });

  describe("constructor and configuration", () => {
    it("should create with default config", () => {
      limiter = new NotificationRateLimiter();
      expect(limiter.isEnabled()).toBe(true);
      expect(limiter.getConfig()).toBeDefined();
    });

    it("should create with custom config", () => {
      limiter = new NotificationRateLimiter({
        enabled: false,
        globalLimit: {
          maxTokens: 50,
          refillRatePerSecond: 10,
        },
      });
      expect(limiter.isEnabled()).toBe(false);
      expect(limiter.getConfig().globalLimit?.maxTokens).toBe(50);
    });

    it("should merge custom config with defaults", () => {
      limiter = new NotificationRateLimiter({
        channelLimits: {
          [NotificationChannel.EMAIL]: {
            maxTokens: 200,
            refillRatePerSecond: 2,
          },
        },
      });
      const config = limiter.getConfig();
      expect(config.channelLimits?.[NotificationChannel.EMAIL]?.maxTokens).toBe(200);
      // Other channel limits should still have defaults
      expect(config.channelLimits?.[NotificationChannel.TELEGRAM]?.maxTokens).toBeDefined();
    });
  });

  describe("extractRecipientId", () => {
    it("should extract email recipient", () => {
      const payload = createEmailPayload("user@test.com");
      expect(extractRecipientId(payload)).toBe("user@test.com");
    });

    it("should extract multiple email recipients sorted", () => {
      const payload = createEmailPayload();
      (payload as EmailNotificationPayload).to = ["z@test.com", "a@test.com"];
      expect(extractRecipientId(payload)).toBe("a@test.com,z@test.com");
    });

    it("should extract Telegram chat ID", () => {
      const payload = createTelegramPayload(987654321);
      expect(extractRecipientId(payload)).toBe("987654321");
    });

    it("should extract Discord webhook URL", () => {
      const payload = createDiscordPayload("https://discord.com/webhook/123");
      expect(extractRecipientId(payload)).toBe("https://discord.com/webhook/123");
    });

    it("should return default for Discord without webhook", () => {
      const payload = createDiscordPayload();
      expect(extractRecipientId(payload)).toBe("default");
    });

    it("should extract Push target", () => {
      const payload = createPushPayload("subscription_endpoint");
      expect(extractRecipientId(payload)).toBe("subscription_endpoint");
    });

    it("should extract multiple Push targets sorted", () => {
      const payload = createPushPayload(["z_sub", "a_sub"]);
      expect(extractRecipientId(payload)).toBe("a_sub,z_sub");
    });

    it("should extract SMS phone number", () => {
      const payload = createSmsPayload("+1999888777");
      expect(extractRecipientId(payload)).toBe("+1999888777");
    });
  });

  describe("generateRateLimitKey", () => {
    it("should generate global key", () => {
      expect(generateRateLimitKey(RateLimitKeyType.GLOBAL)).toBe("global");
    });

    it("should generate channel key", () => {
      expect(generateRateLimitKey(RateLimitKeyType.CHANNEL, NotificationChannel.EMAIL)).toBe(
        "channel:email"
      );
    });

    it("should generate recipient key", () => {
      expect(
        generateRateLimitKey(RateLimitKeyType.RECIPIENT, undefined, "user@test.com")
      ).toBe("recipient:user@test.com");
    });

    it("should generate user key", () => {
      expect(
        generateRateLimitKey(RateLimitKeyType.USER, undefined, undefined, "user_123")
      ).toBe("user:user_123");
    });

    it("should generate channel_recipient key", () => {
      expect(
        generateRateLimitKey(
          RateLimitKeyType.CHANNEL_RECIPIENT,
          NotificationChannel.TELEGRAM,
          "chat_456"
        )
      ).toBe("channel_recipient:telegram:chat_456");
    });
  });

  describe("check method", () => {
    it("should allow notifications when disabled", () => {
      limiter = new NotificationRateLimiter({ enabled: false });
      const payload = createEmailPayload();

      for (let i = 0; i < 1000; i++) {
        const result = limiter.check(payload);
        expect(result.allowed).toBe(true);
      }
    });

    it("should allow notifications within limits", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 10, refillRatePerSecond: 1, windowMs: 60000, maxPerWindow: 10 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      for (let i = 0; i < 10; i++) {
        const result = limiter.check(payload);
        expect(result.allowed).toBe(true);
      }
    });

    it("should deny when global limit exceeded", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 5, refillRatePerSecond: 0.1, windowMs: 60000, maxPerWindow: 5 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Use up all tokens
      for (let i = 0; i < 5; i++) {
        limiter.check(payload);
      }

      const result = limiter.check(payload);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.GLOBAL);
    });

    it("should deny when channel limit exceeded", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 3, refillRatePerSecond: 0.01 },
        },
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Use up all email tokens
      for (let i = 0; i < 3; i++) {
        limiter.check(payload);
      }

      const result = limiter.check(payload);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.CHANNEL);
    });

    it("should deny when recipient limit exceeded", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        userLimit: undefined,
      });

      const payload = createEmailPayload("same@user.com");
      // Use up recipient tokens
      limiter.check(payload);
      limiter.check(payload);

      const result = limiter.check(payload);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.RECIPIENT);
    });

    it("should deny when user limit exceeded", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: { maxTokens: 3, refillRatePerSecond: 0.001 },
      });

      const payload = createEmailPayload();
      // Use up user tokens
      for (let i = 0; i < 3; i++) {
        limiter.check(payload, { userId: "user_999" });
      }

      const result = limiter.check(payload, { userId: "user_999" });
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.USER);
    });

    it("should track different recipients separately", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        userLimit: undefined,
      });

      // Exhaust recipient 1
      limiter.check(createEmailPayload("user1@test.com"));
      limiter.check(createEmailPayload("user1@test.com"));

      // User 1 should be rate limited
      const result1 = limiter.check(createEmailPayload("user1@test.com"));
      expect(result1.allowed).toBe(false);

      // User 2 should still be allowed
      const result2 = limiter.check(createEmailPayload("user2@test.com"));
      expect(result2.allowed).toBe(true);
    });
  });

  describe("priority override", () => {
    it("should allow CRITICAL priority to bypass limits", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
        priorityOverrideThreshold: NotificationPriority.CRITICAL,
      });

      const payload = createEmailPayload();
      // Exhaust limit
      limiter.check(payload);

      // Normal priority should be denied
      const normalResult = limiter.check(payload, { priority: NotificationPriority.NORMAL });
      expect(normalResult.allowed).toBe(false);

      // Critical priority should bypass
      const criticalResult = limiter.check(payload, { priority: NotificationPriority.CRITICAL });
      expect(criticalResult.allowed).toBe(true);
      expect(criticalResult.priorityOverride).toBe(true);
    });

    it("should respect priorityOverrideThreshold setting", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
        priorityOverrideThreshold: NotificationPriority.HIGH,
      });

      const payload = createEmailPayload();
      limiter.check(payload);

      // NORMAL should be denied
      expect(limiter.check(payload, { priority: NotificationPriority.NORMAL }).allowed).toBe(false);

      // HIGH should bypass (threshold is HIGH)
      expect(limiter.check(payload, { priority: NotificationPriority.HIGH }).allowed).toBe(true);
    });

    it("should not override when allowPriorityOverride is false", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: false,
      });

      const payload = createEmailPayload();
      limiter.check(payload);

      const result = limiter.check(payload, { priority: NotificationPriority.CRITICAL });
      expect(result.allowed).toBe(false);
    });
  });

  describe("token refill", () => {
    it("should refill tokens over time", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 5, refillRatePerSecond: 1 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.check(payload);
      }

      // Should be denied immediately
      expect(limiter.check(payload).allowed).toBe(false);

      // Advance time by 1 second (should refill 1 token)
      vi.advanceTimersByTime(1000);

      // Should be allowed now
      expect(limiter.check(payload).allowed).toBe(true);
    });

    it("should not exceed max tokens", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 3, refillRatePerSecond: 10 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Use 1 token
      limiter.check(payload);

      // Wait a long time
      vi.advanceTimersByTime(10000);

      // Should still only have max tokens (3), not more
      const remaining = limiter.getRemaining(RateLimitKeyType.GLOBAL);
      expect(remaining.tokens).toBeLessThanOrEqual(3);
    });
  });

  describe("sliding window", () => {
    it("should enforce sliding window limit", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: {
          maxTokens: 100,
          refillRatePerSecond: 10,
          windowMs: 5000, // 5 second window
          maxPerWindow: 3
        },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Use 3 in window
      limiter.check(payload);
      limiter.check(payload);
      limiter.check(payload);

      // 4th should be denied (window limit)
      expect(limiter.check(payload).allowed).toBe(false);

      // Advance past window
      vi.advanceTimersByTime(5001);

      // Should be allowed again
      expect(limiter.check(payload).allowed).toBe(true);
    });
  });

  describe("isRateLimited method", () => {
    it("should return boolean for rate limit status", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      expect(limiter.isRateLimited(payload)).toBe(false);
      limiter.check(payload);
      expect(limiter.isRateLimited(payload)).toBe(true);
    });
  });

  describe("checkQueueInput method", () => {
    it("should check rate limit from queue input", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const input: CreateQueueItemInput = {
        payload: createEmailPayload(),
        priority: NotificationPriority.HIGH,
        context: { userId: "user_123" },
      };

      const result = limiter.checkQueueInput(input);
      expect(result.allowed).toBe(true);
    });

    it("should extract userId from context", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
      });

      const input: CreateQueueItemInput = {
        payload: createEmailPayload(),
        context: { userId: "test_user" },
      };

      limiter.checkQueueInput(input);
      const result = limiter.checkQueueInput(input);
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.USER);
    });
  });

  describe("getRemaining method", () => {
    it("should return remaining capacity", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 10, refillRatePerSecond: 1, windowMs: 60000, maxPerWindow: 10 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      // Use 3 tokens
      limiter.check(payload);
      limiter.check(payload);
      limiter.check(payload);

      const remaining = limiter.getRemaining(RateLimitKeyType.GLOBAL);
      expect(remaining.tokens).toBe(7);
      expect(remaining.windowRemaining).toBe(7);
    });

    it("should return max capacity for non-existent bucket", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 50, refillRatePerSecond: 5 },
      });

      const remaining = limiter.getRemaining(RateLimitKeyType.GLOBAL);
      expect(remaining.tokens).toBe(50);
    });
  });

  describe("getResetTime method", () => {
    it("should return time until reset", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 3, refillRatePerSecond: 1, windowMs: 10000, maxPerWindow: 3 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      limiter.check(payload);

      const resetTime = limiter.getResetTime(RateLimitKeyType.GLOBAL);
      // Should be approximately 10 seconds
      expect(resetTime).toBeGreaterThan(9000);
      expect(resetTime).toBeLessThanOrEqual(10000);
    });

    it("should return 0 for non-existent bucket", () => {
      limiter = new NotificationRateLimiter();
      const resetTime = limiter.getResetTime(RateLimitKeyType.GLOBAL);
      expect(resetTime).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should clean up expired buckets", () => {
      limiter = new NotificationRateLimiter({
        bucketTTL: 1000, // 1 second TTL
        cleanupInterval: 100000, // Don't auto-cleanup
      });

      const payload = createEmailPayload();
      limiter.check(payload);
      expect(limiter.getAllBuckets().size).toBeGreaterThan(0);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      const removed = limiter.cleanup();
      expect(removed).toBeGreaterThan(0);
    });

    it("should emit cleanup events", () => {
      limiter = new NotificationRateLimiter({
        bucketTTL: 500,
        cleanupInterval: 100000,
      });

      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.check(createEmailPayload());
      vi.advanceTimersByTime(1000);
      limiter.cleanup();

      expect(events.some((e) => e.type === "ratelimit:cleanup")).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should track statistics correctly", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const payload = createEmailPayload();
      limiter.check(payload); // allowed
      limiter.check(payload); // allowed
      limiter.check(payload); // denied

      const stats = limiter.getStats();
      expect(stats.totalChecks).toBe(3);
      expect(stats.totalAllowed).toBe(2);
      expect(stats.totalDenied).toBe(1);
      expect(stats.denialsByKeyType[RateLimitKeyType.GLOBAL]).toBe(1);
    });

    it("should track priority overrides", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
      });

      const payload = createEmailPayload();
      limiter.check(payload); // use up token
      limiter.check(payload, { priority: NotificationPriority.CRITICAL }); // override

      const stats = limiter.getStats();
      expect(stats.priorityOverrides).toBe(1);
    });
  });

  describe("event emission", () => {
    it("should emit allowed events", () => {
      limiter = new NotificationRateLimiter();
      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.check(createEmailPayload());

      expect(events.some((e) => e.type === "ratelimit:allowed")).toBe(true);
    });

    it("should emit denied events", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload());

      expect(events.some((e) => e.type === "ratelimit:denied")).toBe(true);
    });

    it("should emit priority override events", () => {
      limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
      });

      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload(), { priority: NotificationPriority.CRITICAL });

      expect(events.some((e) => e.type === "ratelimit:priority_override")).toBe(true);
    });

    it("should emit bucket created events", () => {
      limiter = new NotificationRateLimiter();
      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.check(createEmailPayload());

      expect(events.some((e) => e.type === "ratelimit:bucket_created")).toBe(true);
    });

    it("should allow removing event handlers", () => {
      limiter = new NotificationRateLimiter();
      const events: RateLimiterEvent[] = [];
      const handler = (e: RateLimiterEvent) => { events.push(e); };

      limiter.on(handler);
      limiter.check(createEmailPayload());
      expect(events.length).toBeGreaterThan(0);

      const countBefore = events.length;
      limiter.off(handler);
      limiter.check(createEmailPayload());
      expect(events.length).toBe(countBefore); // No new events
    });
  });

  describe("configuration updates", () => {
    it("should update config", () => {
      limiter = new NotificationRateLimiter();
      limiter.updateConfig({ enabled: false });
      expect(limiter.isEnabled()).toBe(false);
    });

    it("should emit config updated event", () => {
      limiter = new NotificationRateLimiter();
      const events: RateLimiterEvent[] = [];
      limiter.on((e) => { events.push(e); });

      limiter.updateConfig({ enabled: false });

      expect(events.some((e) => e.type === "ratelimit:config_updated")).toBe(true);
    });
  });

  describe("enable/disable", () => {
    it("should enable rate limiting", () => {
      limiter = new NotificationRateLimiter({ enabled: false });
      expect(limiter.isEnabled()).toBe(false);
      limiter.enable();
      expect(limiter.isEnabled()).toBe(true);
    });

    it("should disable rate limiting", () => {
      limiter = new NotificationRateLimiter({ enabled: true });
      expect(limiter.isEnabled()).toBe(true);
      limiter.disable();
      expect(limiter.isEnabled()).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all buckets and stats", () => {
      limiter = new NotificationRateLimiter();
      limiter.check(createEmailPayload());
      limiter.check(createTelegramPayload());

      expect(limiter.getAllBuckets().size).toBeGreaterThan(0);
      expect(limiter.getStats().totalChecks).toBeGreaterThan(0);

      limiter.clear();

      expect(limiter.getAllBuckets().size).toBe(0);
      expect(limiter.getStats().totalChecks).toBe(0);
    });
  });

  describe("destroy", () => {
    it("should clean up resources", () => {
      limiter = new NotificationRateLimiter();
      limiter.check(createEmailPayload());

      limiter.destroy();

      expect(limiter.getAllBuckets().size).toBe(0);
    });
  });
});

describe("Singleton instance management", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRateLimiter();
    vi.useRealTimers();
  });

  describe("getRateLimiter", () => {
    it("should return the same instance", () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();
      expect(limiter1).toBe(limiter2);
    });

    it("should accept config on first call", () => {
      const limiter = getRateLimiter({ enabled: false });
      expect(limiter.isEnabled()).toBe(false);
    });
  });

  describe("setRateLimiter", () => {
    it("should set custom limiter instance", () => {
      const custom = new NotificationRateLimiter({ enabled: false });
      setRateLimiter(custom);

      const limiter = getRateLimiter();
      expect(limiter).toBe(custom);
      expect(limiter.isEnabled()).toBe(false);

      custom.destroy();
    });
  });

  describe("resetRateLimiter", () => {
    it("should reset shared instance", () => {
      const limiter1 = getRateLimiter();
      resetRateLimiter();
      const limiter2 = getRateLimiter();
      expect(limiter1).not.toBe(limiter2);

      limiter2.destroy();
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe("isNotificationRateLimited", () => {
    it("should check rate limit status", () => {
      const payload = createEmailPayload();
      expect(isNotificationRateLimited(payload)).toBe(false);
    });
  });

  describe("checkNotificationRateLimit", () => {
    it("should return full result", () => {
      const payload = createEmailPayload();
      const result = checkNotificationRateLimit(payload);
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("results");
    });
  });

  describe("checkQueueInputRateLimit", () => {
    it("should check queue input", () => {
      const input: CreateQueueItemInput = {
        payload: createEmailPayload(),
      };
      const result = checkQueueInputRateLimit(input);
      expect(result).toHaveProperty("allowed");
    });
  });

  describe("getRateLimiterStats", () => {
    it("should return stats", () => {
      const stats = getRateLimiterStats();
      expect(stats).toHaveProperty("totalChecks");
      expect(stats).toHaveProperty("totalAllowed");
      expect(stats).toHaveProperty("totalDenied");
    });
  });
});

describe("DEFAULT_RATE_LIMITER_CONFIG", () => {
  it("should have all required fields", () => {
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("enabled");
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("globalLimit");
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("channelLimits");
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("recipientLimit");
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("userLimit");
    expect(DEFAULT_RATE_LIMITER_CONFIG).toHaveProperty("allowPriorityOverride");
  });

  it("should have limits for all channels", () => {
    const limits = DEFAULT_RATE_LIMITER_CONFIG.channelLimits!;
    expect(limits[NotificationChannel.EMAIL]).toBeDefined();
    expect(limits[NotificationChannel.TELEGRAM]).toBeDefined();
    expect(limits[NotificationChannel.DISCORD]).toBeDefined();
    expect(limits[NotificationChannel.PUSH]).toBeDefined();
    expect(limits[NotificationChannel.SMS]).toBeDefined();
  });
});

describe("Multi-channel scenarios", () => {
  let limiter: NotificationRateLimiter;

  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
    vi.useRealTimers();
  });

  it("should track channels independently", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: undefined,
      channelLimits: {
        [NotificationChannel.EMAIL]: { maxTokens: 2, refillRatePerSecond: 0.001 },
        [NotificationChannel.TELEGRAM]: { maxTokens: 2, refillRatePerSecond: 0.001 },
      },
      recipientLimit: undefined,
      userLimit: undefined,
    });

    // Exhaust email
    limiter.check(createEmailPayload());
    limiter.check(createEmailPayload());
    expect(limiter.check(createEmailPayload()).allowed).toBe(false);

    // Telegram should still work
    expect(limiter.check(createTelegramPayload()).allowed).toBe(true);
    expect(limiter.check(createTelegramPayload()).allowed).toBe(true);
    expect(limiter.check(createTelegramPayload()).allowed).toBe(false);
  });

  it("should apply global limit across all channels", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 3, refillRatePerSecond: 0.001 },
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    limiter.check(createEmailPayload());
    limiter.check(createTelegramPayload());
    limiter.check(createDiscordPayload());

    // All channels should now be blocked due to global limit
    expect(limiter.check(createPushPayload()).allowed).toBe(false);
    expect(limiter.check(createSmsPayload()).allowed).toBe(false);
  });
});

describe("RetryAfterMs calculation", () => {
  let limiter: NotificationRateLimiter;

  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
    vi.useRealTimers();
  });

  it("should provide retryAfterMs when denied", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 1, refillRatePerSecond: 0.5 }, // 1 token every 2 seconds
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    const payload = createEmailPayload();
    limiter.check(payload);

    const result = limiter.check(payload);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBe(2000); // Should be ~2000ms (1/0.5 * 1000)
  });

  it("should provide window-based retryAfterMs", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: {
        maxTokens: 100,
        refillRatePerSecond: 10,
        windowMs: 5000,
        maxPerWindow: 2
      },
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    const payload = createEmailPayload();
    limiter.check(payload);
    limiter.check(payload);

    const result = limiter.check(payload);
    expect(result.allowed).toBe(false);
    // Should be approximately 5000ms (window length)
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBeGreaterThan(4000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
  });
});

describe("Edge cases", () => {
  let limiter: NotificationRateLimiter;

  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
    vi.useRealTimers();
  });

  it("should handle very high refill rates", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 1000, refillRatePerSecond: 1000 },
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    const payload = createEmailPayload();
    // Should handle rapid checks
    for (let i = 0; i < 100; i++) {
      limiter.check(payload);
    }

    const stats = limiter.getStats();
    expect(stats.totalChecks).toBe(100);
  });

  it("should handle very low refill rates", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 1, refillRatePerSecond: 0.0001 },
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    const payload = createEmailPayload();
    limiter.check(payload);

    expect(limiter.check(payload).allowed).toBe(false);
  });

  it("should handle concurrent checks to different recipients", () => {
    limiter = new NotificationRateLimiter({
      globalLimit: undefined,
      channelLimits: {},
      recipientLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
      userLimit: undefined,
    });

    // Each recipient should have their own limit
    expect(limiter.check(createEmailPayload("user1@test.com")).allowed).toBe(true);
    expect(limiter.check(createEmailPayload("user2@test.com")).allowed).toBe(true);
    expect(limiter.check(createEmailPayload("user3@test.com")).allowed).toBe(true);

    // But same recipient should be limited
    expect(limiter.check(createEmailPayload("user1@test.com")).allowed).toBe(false);
  });
});
