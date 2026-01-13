/**
 * E2E tests for the Notification Rate Limiter
 * Tests integration with the notification queue system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotificationRateLimiter,
  getRateLimiter,
  resetRateLimiter,
  checkNotificationRateLimit,
  checkQueueInputRateLimit,
  isNotificationRateLimited,
  getRateLimiterStats,
  RateLimitKeyType,
  RateLimiterEvent,
} from "../../src/notifications/core/rate-limiter";
import {
  NotificationChannel,
  NotificationPriority,
  CreateQueueItemInput,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
} from "../../src/notifications/core/types";
import { resetNotificationQueue } from "../../src/notifications/core/queue";

// Helper functions for creating test payloads
function createEmailPayload(to: string = "test@example.com"): EmailNotificationPayload {
  return {
    channel: NotificationChannel.EMAIL,
    to,
    title: "Test Alert",
    body: "This is a test notification",
    subject: "Test Alert Subject",
  };
}

function createTelegramPayload(chatId: string | number = "123456789"): TelegramNotificationPayload {
  return {
    channel: NotificationChannel.TELEGRAM,
    chatId,
    title: "Test Alert",
    body: "This is a test notification",
    parseMode: "HTML",
  };
}

function createDiscordPayload(webhookUrl?: string): DiscordNotificationPayload {
  return {
    channel: NotificationChannel.DISCORD,
    webhookUrl,
    title: "Test Alert",
    body: "This is a test notification",
    embeds: [{ title: "Alert", description: "Test embed" }],
  };
}

function createPushPayload(target: string = "sub_123"): PushNotificationPayload {
  return {
    channel: NotificationChannel.PUSH,
    target,
    title: "Test Alert",
    body: "This is a test notification",
    icon: "/icon.png",
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

describe("Rate Limiter E2E Integration Tests", () => {
  beforeEach(() => {
    resetRateLimiter();
    resetNotificationQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRateLimiter();
    resetNotificationQueue();
    vi.useRealTimers();
  });

  describe("Basic Rate Limiting", () => {
    it("should rate limit notifications under high load", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 50, refillRatePerSecond: 5, windowMs: 60000, maxPerWindow: 50 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Send 50 notifications - all should succeed
      for (let i = 0; i < 50; i++) {
        const result = limiter.check(createEmailPayload(`user${i}@test.com`));
        expect(result.allowed).toBe(true);
      }

      // 51st should be rate limited
      const result = limiter.check(createEmailPayload("extra@test.com"));
      expect(result.allowed).toBe(false);
      expect(result.deniedBy).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);

      limiter.destroy();
    });

    it("should allow notifications after rate limit window passes", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 5, refillRatePerSecond: 1, windowMs: 5000, maxPerWindow: 5 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        limiter.check(createEmailPayload());
      }
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(5001);

      // Should be allowed again
      expect(limiter.check(createEmailPayload()).allowed).toBe(true);

      limiter.destroy();
    });

    it("should allow CRITICAL priority notifications to bypass limits", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
        priorityOverrideThreshold: NotificationPriority.CRITICAL,
      });

      // Exhaust limit
      limiter.check(createEmailPayload());

      // Normal priority denied
      expect(limiter.check(createEmailPayload(), { priority: NotificationPriority.NORMAL }).allowed).toBe(false);

      // CRITICAL priority bypasses
      const criticalResult = limiter.check(createEmailPayload(), { priority: NotificationPriority.CRITICAL });
      expect(criticalResult.allowed).toBe(true);
      expect(criticalResult.priorityOverride).toBe(true);

      limiter.destroy();
    });
  });

  describe("Channel-Specific Rate Limiting", () => {
    it("should apply different limits per channel", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 10, refillRatePerSecond: 0.01 },
          [NotificationChannel.TELEGRAM]: { maxTokens: 5, refillRatePerSecond: 0.01 },
          [NotificationChannel.SMS]: { maxTokens: 2, refillRatePerSecond: 0.001 },
        },
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Use up email limit (10)
      for (let i = 0; i < 10; i++) {
        expect(limiter.check(createEmailPayload()).allowed).toBe(true);
      }
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      // Use up telegram limit (5) - separate from email
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(createTelegramPayload()).allowed).toBe(true);
      }
      expect(limiter.check(createTelegramPayload()).allowed).toBe(false);

      // Use up SMS limit (2) - separate from others
      expect(limiter.check(createSmsPayload()).allowed).toBe(true);
      expect(limiter.check(createSmsPayload()).allowed).toBe(true);
      expect(limiter.check(createSmsPayload()).allowed).toBe(false);

      limiter.destroy();
    });

    it("should allow more Discord messages than email when configured with different limits", () => {
      const limiter = new NotificationRateLimiter({
        enabled: true,
        globalLimit: undefined,
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 5, refillRatePerSecond: 0.01 },
          // Discord gets higher limit
          [NotificationChannel.DISCORD]: { maxTokens: 20, refillRatePerSecond: 1 },
        },
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Email is limited to 5
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(createEmailPayload()).allowed).toBe(true);
      }
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      // Discord has higher limit (20), verify we can send more
      for (let i = 0; i < 15; i++) {
        const result = limiter.check(createDiscordPayload());
        expect(result.allowed).toBe(true);
      }

      limiter.destroy();
    });
  });

  describe("Recipient-Based Rate Limiting", () => {
    it("should limit notifications per recipient", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: { maxTokens: 3, refillRatePerSecond: 0.001 },
        userLimit: undefined,
      });

      // User A can receive 3 notifications
      expect(limiter.check(createEmailPayload("userA@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userA@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userA@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userA@test.com")).allowed).toBe(false);

      // User B can also receive 3 (independent limit)
      expect(limiter.check(createEmailPayload("userB@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userB@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userB@test.com")).allowed).toBe(true);
      expect(limiter.check(createEmailPayload("userB@test.com")).allowed).toBe(false);

      limiter.destroy();
    });

    it("should track Telegram chat IDs independently", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        userLimit: undefined,
      });

      // Chat A limited
      expect(limiter.check(createTelegramPayload("chatA")).allowed).toBe(true);
      expect(limiter.check(createTelegramPayload("chatA")).allowed).toBe(true);
      expect(limiter.check(createTelegramPayload("chatA")).allowed).toBe(false);

      // Chat B separate
      expect(limiter.check(createTelegramPayload("chatB")).allowed).toBe(true);

      limiter.destroy();
    });
  });

  describe("User-Based Rate Limiting", () => {
    it("should limit notifications per user across all channels", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: { maxTokens: 4, refillRatePerSecond: 0.001 },
      });

      // User 1 across different channels
      expect(limiter.check(createEmailPayload(), { userId: "user1" }).allowed).toBe(true);
      expect(limiter.check(createTelegramPayload(), { userId: "user1" }).allowed).toBe(true);
      expect(limiter.check(createDiscordPayload(), { userId: "user1" }).allowed).toBe(true);
      expect(limiter.check(createPushPayload(), { userId: "user1" }).allowed).toBe(true);
      // 5th blocked
      expect(limiter.check(createSmsPayload(), { userId: "user1" }).allowed).toBe(false);

      // User 2 is separate
      expect(limiter.check(createEmailPayload(), { userId: "user2" }).allowed).toBe(true);

      limiter.destroy();
    });
  });

  describe("Combined Rate Limiting Scenarios", () => {
    it("should apply multiple rate limits hierarchically", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 100, refillRatePerSecond: 10 },
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 20, refillRatePerSecond: 1 },
        },
        recipientLimit: { maxTokens: 5, refillRatePerSecond: 0.1 },
        userLimit: undefined,
      });

      // Recipient limit should hit first (5 per recipient)
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(createEmailPayload("same@user.com")).allowed).toBe(true);
      }

      // 6th to same recipient blocked by recipient limit, not global or channel
      const result = limiter.check(createEmailPayload("same@user.com"));
      expect(result.allowed).toBe(false);
      expect(result.deniedBy?.keyType).toBe(RateLimitKeyType.RECIPIENT);

      limiter.destroy();
    });

    it("should handle real-world notification patterns", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 50, refillRatePerSecond: 1, windowMs: 60000, maxPerWindow: 50 },
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 30, refillRatePerSecond: 0.5 },
          [NotificationChannel.PUSH]: { maxTokens: 100, refillRatePerSecond: 5 },
        },
        recipientLimit: { maxTokens: 5, refillRatePerSecond: 0.1 },
        userLimit: { maxTokens: 20, refillRatePerSecond: 0.5 },
        allowPriorityOverride: true,
        priorityOverrideThreshold: NotificationPriority.CRITICAL,
      });

      // Simulate alert burst to multiple users
      const users = ["user1", "user2", "user3", "user4", "user5"];

      for (const userId of users) {
        // Each user gets email + push (within limits)
        expect(
          limiter.check(createEmailPayload(`${userId}@test.com`), { userId }).allowed
        ).toBe(true);
        expect(
          limiter.check(createPushPayload(`sub_${userId}`), { userId }).allowed
        ).toBe(true);
      }

      // CRITICAL alerts should bypass all limits
      expect(
        limiter.check(createEmailPayload("urgent@test.com"), {
          userId: "user1",
          priority: NotificationPriority.CRITICAL,
        }).allowed
      ).toBe(true);

      const stats = limiter.getStats();
      expect(stats.totalChecks).toBe(11); // 5 email + 5 push + 1 critical
      expect(stats.totalAllowed).toBe(11);
      expect(stats.priorityOverrides).toBe(1);

      limiter.destroy();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should track comprehensive statistics", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 3, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Make various checks
      limiter.check(createEmailPayload());
      limiter.check(createTelegramPayload());
      limiter.check(createDiscordPayload());
      limiter.check(createPushPayload()); // This should fail

      const stats = limiter.getStats();
      expect(stats.totalChecks).toBe(4);
      expect(stats.totalAllowed).toBe(3);
      expect(stats.totalDenied).toBe(1);
      expect(stats.denialsByKeyType[RateLimitKeyType.GLOBAL]).toBe(1);
      expect(stats.activeBuckets).toBeGreaterThan(0);

      limiter.destroy();
    });

    it("should track denials by channel", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: undefined,
        channelLimits: {
          [NotificationChannel.EMAIL]: { maxTokens: 1, refillRatePerSecond: 0.001 },
          [NotificationChannel.TELEGRAM]: { maxTokens: 1, refillRatePerSecond: 0.001 },
        },
        recipientLimit: undefined,
        userLimit: undefined,
      });

      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload()); // denied
      limiter.check(createTelegramPayload());
      limiter.check(createTelegramPayload()); // denied

      const stats = limiter.getStats();
      expect(stats.denialsByChannel[NotificationChannel.EMAIL]).toBe(1);
      expect(stats.denialsByChannel[NotificationChannel.TELEGRAM]).toBe(1);

      limiter.destroy();
    });
  });

  describe("Event System", () => {
    it("should emit events for all operations", () => {
      const events: RateLimiterEvent[] = [];
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      limiter.on((e) => { events.push(e); });

      // Should emit: bucket_created, allowed
      limiter.check(createEmailPayload());

      // Should emit: allowed (same bucket reused)
      limiter.check(createEmailPayload());

      // Should emit: denied
      limiter.check(createEmailPayload());

      expect(events.some((e) => e.type === "ratelimit:bucket_created")).toBe(true);
      expect(events.filter((e) => e.type === "ratelimit:allowed").length).toBe(2);
      expect(events.some((e) => e.type === "ratelimit:denied")).toBe(true);

      limiter.destroy();
    });

    it("should emit priority_override events", () => {
      const events: RateLimiterEvent[] = [];
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.001 },
        allowPriorityOverride: true,
      });

      limiter.on((e) => { events.push(e); });
      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload(), { priority: NotificationPriority.CRITICAL });

      expect(events.some((e) => e.type === "ratelimit:priority_override")).toBe(true);

      limiter.destroy();
    });
  });

  describe("Token Bucket Behavior", () => {
    it("should refill tokens over time", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 3, refillRatePerSecond: 1 }, // 1 token per second
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Use all tokens
      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload());
      limiter.check(createEmailPayload());
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      // Wait 2 seconds, should have 2 tokens
      vi.advanceTimersByTime(2000);

      expect(limiter.check(createEmailPayload()).allowed).toBe(true);
      expect(limiter.check(createEmailPayload()).allowed).toBe(true);
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      limiter.destroy();
    });

    it("should not exceed max tokens", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 5, refillRatePerSecond: 10 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Use 1 token
      limiter.check(createEmailPayload());

      // Wait a long time (should refill max 5, not more)
      vi.advanceTimersByTime(60000);

      // Should have max 5 tokens
      const remaining = limiter.getRemaining(RateLimitKeyType.GLOBAL);
      expect(remaining.tokens).toBeLessThanOrEqual(5);

      limiter.destroy();
    });
  });

  describe("Sliding Window Enforcement", () => {
    it("should enforce sliding window correctly", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: {
          maxTokens: 1000,
          refillRatePerSecond: 100,
          windowMs: 10000, // 10 second window
          maxPerWindow: 5,
        },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Send 5 notifications
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(createEmailPayload()).allowed).toBe(true);
        vi.advanceTimersByTime(1000); // 1 second between each
      }

      // Now at t=5000ms, window still has all 5, so 6th should fail
      expect(limiter.check(createEmailPayload()).allowed).toBe(false);

      // Wait for first notification to fall out of window
      vi.advanceTimersByTime(6000); // now at t=11000ms, first notification at t=0 is out

      // Should be allowed again
      expect(limiter.check(createEmailPayload()).allowed).toBe(true);

      limiter.destroy();
    });
  });

  describe("Cleanup Behavior", () => {
    it("should clean up expired buckets", () => {
      const limiter = new NotificationRateLimiter({
        bucketTTL: 500, // 0.5 second TTL
        cleanupInterval: 100000, // Don't auto-cleanup
        globalLimit: undefined,
        channelLimits: {},
        recipientLimit: { maxTokens: 10, refillRatePerSecond: 1 },
        userLimit: undefined,
      });

      // Create buckets for different recipients
      limiter.check(createEmailPayload("a@test.com"));
      limiter.check(createEmailPayload("b@test.com"));
      limiter.check(createEmailPayload("c@test.com"));

      const initialBucketCount = limiter.getAllBuckets().size;
      expect(initialBucketCount).toBeGreaterThan(0);

      // Wait for TTL to expire
      vi.advanceTimersByTime(1000);

      // Trigger cleanup
      const removed = limiter.cleanup();
      expect(removed).toBe(initialBucketCount);
      expect(limiter.getAllBuckets().size).toBe(0);

      limiter.destroy();
    });

    it("should not clean up recently accessed buckets", () => {
      const limiter = new NotificationRateLimiter({
        bucketTTL: 5000,
        cleanupInterval: 100000, // Don't auto-cleanup
      });

      limiter.check(createEmailPayload());

      // Access bucket periodically
      vi.advanceTimersByTime(2000);
      limiter.check(createEmailPayload());
      vi.advanceTimersByTime(2000);
      limiter.check(createEmailPayload());
      vi.advanceTimersByTime(2000);

      // Bucket should still exist because it's been accessed
      const removed = limiter.cleanup();
      expect(removed).toBe(0);
      expect(limiter.getAllBuckets().size).toBeGreaterThan(0);

      limiter.destroy();
    });
  });

  describe("Integration with Shared Instance", () => {
    it("should maintain state across calls to shared instance", () => {
      // Get shared instance with specific config
      getRateLimiter({
        globalLimit: { maxTokens: 3, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Use convenience functions
      checkNotificationRateLimit(createEmailPayload());
      checkNotificationRateLimit(createEmailPayload());
      checkNotificationRateLimit(createEmailPayload());

      // Should be rate limited now
      expect(isNotificationRateLimited(createEmailPayload())).toBe(true);

      // Stats should reflect usage
      const stats = getRateLimiterStats();
      expect(stats.totalChecks).toBe(4);
      expect(stats.totalAllowed).toBe(3);
      expect(stats.totalDenied).toBe(1);
    });

    it("should work with queue input", () => {
      getRateLimiter({
        globalLimit: { maxTokens: 2, refillRatePerSecond: 0.001 },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      const input: CreateQueueItemInput = {
        payload: createEmailPayload(),
        priority: NotificationPriority.HIGH,
        context: { userId: "test_user" },
      };

      expect(checkQueueInputRateLimit(input).allowed).toBe(true);
      expect(checkQueueInputRateLimit(input).allowed).toBe(true);
      expect(checkQueueInputRateLimit(input).allowed).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle event handler errors gracefully", () => {
      const limiter = new NotificationRateLimiter();

      // Add a handler that throws
      limiter.on(() => {
        throw new Error("Handler error");
      });

      // Should not throw, just continue
      expect(() => {
        limiter.check(createEmailPayload());
      }).not.toThrow();

      // Limiter should still function
      const stats = limiter.getStats();
      expect(stats.totalChecks).toBe(1);

      limiter.destroy();
    });

    it("should handle configuration updates", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 10, refillRatePerSecond: 1 },
      });

      // Check initial config
      expect(limiter.getConfig().globalLimit?.maxTokens).toBe(10);

      // Update config
      limiter.updateConfig({
        globalLimit: { maxTokens: 5, refillRatePerSecond: 0.5 },
      });

      expect(limiter.getConfig().globalLimit?.maxTokens).toBe(5);

      limiter.destroy();
    });
  });

  describe("RetryAfter Calculation", () => {
    it("should provide accurate retryAfterMs for token-based limits", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: { maxTokens: 1, refillRatePerSecond: 0.5 }, // 1 token every 2 seconds
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      limiter.check(createEmailPayload());

      const result = limiter.check(createEmailPayload());
      expect(result.allowed).toBe(false);
      // Should be ~2000ms (1/0.5 seconds * 1000)
      expect(result.retryAfterMs).toBe(2000);

      limiter.destroy();
    });

    it("should provide accurate retryAfterMs for window-based limits", () => {
      const limiter = new NotificationRateLimiter({
        globalLimit: {
          maxTokens: 100,
          refillRatePerSecond: 10,
          windowMs: 10000,
          maxPerWindow: 2,
        },
        channelLimits: {},
        recipientLimit: undefined,
        userLimit: undefined,
      });

      // Use up window
      limiter.check(createEmailPayload());
      vi.advanceTimersByTime(1000);
      limiter.check(createEmailPayload());

      const result = limiter.check(createEmailPayload());
      expect(result.allowed).toBe(false);
      // Should be close to window length minus elapsed time
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(8000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(10000);

      limiter.destroy();
    });
  });
});

describe("Burst Notification Scenarios", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRateLimiter();
    vi.useRealTimers();
  });

  it("should handle alert storm with graceful degradation", () => {
    const limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 20, refillRatePerSecond: 2, windowMs: 60000, maxPerWindow: 50 },
      channelLimits: {
        [NotificationChannel.EMAIL]: { maxTokens: 10, refillRatePerSecond: 1 },
        [NotificationChannel.PUSH]: { maxTokens: 50, refillRatePerSecond: 5 },
      },
      recipientLimit: { maxTokens: 3, refillRatePerSecond: 0.1 },
      userLimit: undefined,
      allowPriorityOverride: true,
    });

    const results = {
      allowed: 0,
      denied: 0,
      byChannel: {} as Record<string, { allowed: number; denied: number }>,
    };

    // Simulate burst of 100 notifications across channels and recipients
    for (let i = 0; i < 100; i++) {
      const channel = i % 2 === 0 ? NotificationChannel.EMAIL : NotificationChannel.PUSH;
      const recipient = `user${i % 10}@test.com`;

      const payload =
        channel === NotificationChannel.EMAIL
          ? createEmailPayload(recipient)
          : createPushPayload(`sub_${i % 10}`);

      const result = limiter.check(payload);

      if (result.allowed) {
        results.allowed++;
      } else {
        results.denied++;
      }

      if (!results.byChannel[channel]) {
        results.byChannel[channel] = { allowed: 0, denied: 0 };
      }
      if (result.allowed) {
        results.byChannel[channel].allowed++;
      } else {
        results.byChannel[channel].denied++;
      }
    }

    // Should have some allowed and some denied
    expect(results.allowed).toBeGreaterThan(0);
    expect(results.denied).toBeGreaterThan(0);

    // Critical notifications should still go through
    const criticalResult = limiter.check(createEmailPayload("urgent@test.com"), {
      priority: NotificationPriority.CRITICAL,
    });
    expect(criticalResult.allowed).toBe(true);

    limiter.destroy();
  });

  it("should recover after burst subsides", () => {
    const limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 10, refillRatePerSecond: 10 }, // Fast refill for testing
      channelLimits: {},
      recipientLimit: undefined,
      userLimit: undefined,
    });

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      limiter.check(createEmailPayload());
    }
    expect(limiter.check(createEmailPayload()).allowed).toBe(false);

    // Wait for full recovery (1 second = 10 tokens at 10/sec)
    vi.advanceTimersByTime(1000);

    // Should have recovered all 10 tokens
    for (let i = 0; i < 10; i++) {
      expect(limiter.check(createEmailPayload()).allowed).toBe(true);
    }

    limiter.destroy();
  });
});

describe("Real-World Use Cases", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRateLimiter();
    vi.useRealTimers();
  });

  it("should handle whale alert notifications appropriately", () => {
    const limiter = new NotificationRateLimiter({
      globalLimit: { maxTokens: 100, refillRatePerSecond: 10 },
      channelLimits: {
        [NotificationChannel.TELEGRAM]: { maxTokens: 30, refillRatePerSecond: 0.5 },
        [NotificationChannel.DISCORD]: { maxTokens: 30, refillRatePerSecond: 0.5 },
        [NotificationChannel.EMAIL]: { maxTokens: 20, refillRatePerSecond: 0.3 },
      },
      recipientLimit: { maxTokens: 10, refillRatePerSecond: 0.2 },
      userLimit: undefined,
      allowPriorityOverride: true,
    });

    // Normal whale alerts (HIGH priority)
    for (let i = 0; i < 20; i++) {
      const result = limiter.check(createTelegramPayload(`chat_${i % 5}`), {
        priority: NotificationPriority.HIGH,
      });
      // First 10 should work (2 per recipient * 5 recipients = 10 allowed by recipient limit)
      if (i < 10) {
        expect(result.allowed).toBe(true);
      }
    }

    // Major whale alert (CRITICAL) should bypass limits
    const majorWhaleResult = limiter.check(createTelegramPayload("chat_0"), {
      priority: NotificationPriority.CRITICAL,
    });
    expect(majorWhaleResult.allowed).toBe(true);
    expect(majorWhaleResult.priorityOverride).toBe(true);

    limiter.destroy();
  });

  it("should handle multi-channel notification for same alert", () => {
    const limiter = new NotificationRateLimiter({
      globalLimit: undefined,
      channelLimits: {
        [NotificationChannel.EMAIL]: { maxTokens: 5, refillRatePerSecond: 0.1 },
        [NotificationChannel.TELEGRAM]: { maxTokens: 10, refillRatePerSecond: 0.2 },
        [NotificationChannel.DISCORD]: { maxTokens: 10, refillRatePerSecond: 0.2 },
        [NotificationChannel.PUSH]: { maxTokens: 20, refillRatePerSecond: 0.5 },
      },
      recipientLimit: { maxTokens: 5, refillRatePerSecond: 0.1 },
      userLimit: { maxTokens: 10, refillRatePerSecond: 0.2 },
    });

    // User wants notifications on all channels
    const userId = "user_whale_tracker";
    const recipientEmail = `${userId}@test.com`;

    // Should be able to send to all channels
    expect(
      limiter.check(createEmailPayload(recipientEmail), { userId }).allowed
    ).toBe(true);
    expect(
      limiter.check(createTelegramPayload("chat_user"), { userId }).allowed
    ).toBe(true);
    expect(
      limiter.check(createDiscordPayload(), { userId }).allowed
    ).toBe(true);
    expect(
      limiter.check(createPushPayload(`sub_${userId}`), { userId }).allowed
    ).toBe(true);

    // User limit should eventually kick in
    for (let i = 0; i < 10; i++) {
      limiter.check(createPushPayload(`sub_${userId}`), { userId });
    }

    // Next push should be blocked by user limit
    const result = limiter.check(createPushPayload(`sub_${userId}`), { userId });
    expect(result.allowed).toBe(false);

    limiter.destroy();
  });
});
