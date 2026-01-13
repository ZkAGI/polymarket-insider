/**
 * E2E tests for Notification Deduplication System
 * Tests realistic scenarios of notification deduplication
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  NotificationDeduplicator,
  getDeduplicator,
  resetDeduplicator,
  checkAndRecordNotification,
  isDuplicate,
  generateDedupKey,
} from "../../../src/notifications/core/deduplication";
import {
  NotificationChannel,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
} from "../../../src/notifications/core/types";
import {
  NotificationQueue,
} from "../../../src/notifications/core/index";

// Helper functions
function createEmailPayload(overrides?: Partial<EmailNotificationPayload>): EmailNotificationPayload {
  return {
    channel: NotificationChannel.EMAIL,
    to: "user@example.com",
    subject: "Alert: Whale Activity Detected",
    title: "Alert: Whale Activity Detected",
    body: "Large trade detected on market XYZ",
    ...overrides,
  };
}

function createTelegramPayload(overrides?: Partial<TelegramNotificationPayload>): TelegramNotificationPayload {
  return {
    channel: NotificationChannel.TELEGRAM,
    chatId: "-1001234567890",
    title: "Whale Alert",
    body: "Whale activity detected on Polymarket",
    ...overrides,
  };
}

function createDiscordPayload(overrides?: Partial<DiscordNotificationPayload>): DiscordNotificationPayload {
  return {
    channel: NotificationChannel.DISCORD,
    title: "Market Alert",
    body: "New insider activity detected",
    ...overrides,
  };
}

function createPushPayload(overrides?: Partial<PushNotificationPayload>): PushNotificationPayload {
  return {
    channel: NotificationChannel.PUSH,
    target: "push-subscription-endpoint",
    title: "Price Alert",
    body: "Market odds changed significantly",
    ...overrides,
  };
}

function createSmsPayload(overrides?: Partial<SmsNotificationPayload>): SmsNotificationPayload {
  return {
    channel: NotificationChannel.SMS,
    phoneNumber: "+14155551234",
    title: "Urgent Alert",
    body: "Critical market movement",
    ...overrides,
  };
}

describe("Deduplication E2E Tests", () => {
  describe("Real-world Alert Scenarios", () => {
    let deduplicator: NotificationDeduplicator;

    beforeEach(() => {
      deduplicator = new NotificationDeduplicator({
        enabled: true,
        windowMs: 5 * 60 * 1000, // 5 minutes
        channelWindows: {
          [NotificationChannel.EMAIL]: 60 * 60 * 1000, // 1 hour
          [NotificationChannel.TELEGRAM]: 5 * 60 * 1000, // 5 minutes
          [NotificationChannel.DISCORD]: 5 * 60 * 1000, // 5 minutes
          [NotificationChannel.PUSH]: 2 * 60 * 1000, // 2 minutes
          [NotificationChannel.SMS]: 60 * 60 * 1000, // 1 hour
        },
      });
    });

    afterEach(() => {
      deduplicator.destroy();
    });

    it("should deduplicate repeated whale alerts for the same market", () => {
      const alertPayload = createTelegramPayload({
        body: "🐋 Whale Alert: $500K position on 'Will Bitcoin hit $100K by 2026?'",
        metadata: { marketId: "btc-100k-2026", walletAddress: "0x1234" },
      });

      // First alert should go through
      const first = deduplicator.checkAndRecord(alertPayload, "btc-100k-2026");
      expect(first.isDuplicate).toBe(false);

      // Repeated alerts within window should be blocked
      const second = deduplicator.checkAndRecord(alertPayload, "btc-100k-2026");
      expect(second.isDuplicate).toBe(true);

      const third = deduplicator.checkAndRecord(alertPayload, "btc-100k-2026");
      expect(third.isDuplicate).toBe(true);

      // Stats should show duplicates blocked
      const stats = deduplicator.getStats();
      expect(stats.duplicatesBlocked).toBe(2);
    });

    it("should allow different alerts for the same market", () => {
      const correlationId = "market-xyz";

      const priceAlert = createTelegramPayload({
        body: "Price moved from 0.65 to 0.72",
      });

      const volumeAlert = createTelegramPayload({
        body: "Volume spike detected: 10x normal",
      });

      const whaleAlert = createTelegramPayload({
        body: "New whale entered position",
      });

      // All should be allowed (different content)
      expect(deduplicator.checkAndRecord(priceAlert, correlationId).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(volumeAlert, correlationId).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(whaleAlert, correlationId).isDuplicate).toBe(false);

      expect(deduplicator.size()).toBe(3);
    });

    it("should deduplicate across multiple notification channels for same alert", () => {
      const alertId = "alert-12345";
      const baseContent = "Major price movement detected";

      // Send same alert to multiple channels
      const emailAlert = createEmailPayload({ body: baseContent });
      const telegramAlert = createTelegramPayload({ body: baseContent });
      const discordAlert = createDiscordPayload({ body: baseContent });
      const pushAlert = createPushPayload({ body: baseContent });

      // Each channel should allow first notification
      expect(deduplicator.checkAndRecord(emailAlert, alertId).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(telegramAlert, alertId).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(discordAlert, alertId).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(pushAlert, alertId).isDuplicate).toBe(false);

      // Repeats on each channel should be blocked
      expect(deduplicator.checkAndRecord(emailAlert, alertId).isDuplicate).toBe(true);
      expect(deduplicator.checkAndRecord(telegramAlert, alertId).isDuplicate).toBe(true);
      expect(deduplicator.checkAndRecord(discordAlert, alertId).isDuplicate).toBe(true);
      expect(deduplicator.checkAndRecord(pushAlert, alertId).isDuplicate).toBe(true);
    });

    it("should handle burst of notifications for trending market", () => {
      const marketId = "trending-market-123";
      const alerts: Array<{ body: string; blocked: boolean }> = [];

      // Simulate burst of 100 notifications
      for (let i = 0; i < 100; i++) {
        const payload = createPushPayload({
          body: `Alert #${Math.floor(i / 10) + 1} for trending market`, // 10 unique messages
        });

        const result = deduplicator.checkAndRecord(payload, marketId);
        alerts.push({ body: payload.body, blocked: result.isDuplicate });
      }

      // Should only allow 10 unique alerts
      const allowed = alerts.filter(a => !a.blocked);
      const blocked = alerts.filter(a => a.blocked);

      expect(allowed.length).toBe(10);
      expect(blocked.length).toBe(90);
    });

    it("should handle notifications for multiple users", () => {
      const alertContent = "Market outcome resolved";

      // Different users receiving the same alert
      const user1Email = createEmailPayload({ to: "user1@example.com", body: alertContent });
      const user2Email = createEmailPayload({ to: "user2@example.com", body: alertContent });
      const user3Email = createEmailPayload({ to: "user3@example.com", body: alertContent });

      // Each user should receive their notification
      expect(deduplicator.checkAndRecord(user1Email).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(user2Email).isDuplicate).toBe(false);
      expect(deduplicator.checkAndRecord(user3Email).isDuplicate).toBe(false);

      // Same user shouldn't receive duplicate
      expect(deduplicator.checkAndRecord(user1Email).isDuplicate).toBe(true);
    });

    it("should prevent SMS spam for expensive channel", () => {
      const smsAlert = createSmsPayload({
        body: "Critical: Your position is at risk",
        phoneNumber: "+14155551234",
      });

      // First SMS goes through
      expect(deduplicator.checkAndRecord(smsAlert).isDuplicate).toBe(false);

      // Simulate 10 retry attempts (should all be blocked)
      for (let i = 0; i < 10; i++) {
        expect(deduplicator.checkAndRecord(smsAlert).isDuplicate).toBe(true);
      }

      // Check stats
      const stats = deduplicator.getStats();
      expect(stats.byChannel[NotificationChannel.SMS]).toBe(1);
      expect(stats.duplicatesBlocked).toBeGreaterThanOrEqual(10);
    });
  });

  describe("Integration with Queue System", () => {
    let deduplicator: NotificationDeduplicator;
    let queue: NotificationQueue;

    beforeEach(() => {
      deduplicator = new NotificationDeduplicator({
        enabled: true,
        windowMs: 60000, // 1 minute
        channelWindows: {
          [NotificationChannel.EMAIL]: 60000,
          [NotificationChannel.TELEGRAM]: 60000,
          [NotificationChannel.DISCORD]: 60000,
          [NotificationChannel.PUSH]: 60000,
          [NotificationChannel.SMS]: 60000,
        },
      });
      queue = new NotificationQueue();
    });

    afterEach(() => {
      deduplicator.destroy();
      queue.stop();
    });

    it("should deduplicate before adding to queue", async () => {
      const payload = createTelegramPayload({
        body: "Test queue integration",
      });
      const correlationId = "test-corr-123";

      // Check dedup before adding to queue
      const check1 = deduplicator.checkAndRecord(payload, correlationId);
      if (!check1.isDuplicate) {
        await queue.add({ payload, correlationId });
      }

      // Second attempt should be blocked
      const check2 = deduplicator.checkAndRecord(payload, correlationId);
      expect(check2.isDuplicate).toBe(true);

      // Queue should only have 1 item
      const count = await queue.count({});
      expect(count).toBe(1);
    });

    it("should track original queue item ID for duplicates", async () => {
      const payload = createEmailPayload({
        body: "Important alert",
      });

      // Add to queue first
      const queueItem = await queue.add({ payload });

      // Record in deduplicator with item ID
      deduplicator.record(payload, undefined, queueItem.id);

      // Check duplicate - should have reference to original
      const check = deduplicator.check(payload);
      expect(check.isDuplicate).toBe(true);
      expect(check.originalEntry?.originalItemId).toBe(queueItem.id);
    });

    it("should allow retries of failed notifications", async () => {
      const payload = createEmailPayload({
        body: "Alert that might fail",
      });
      const correlationId = "retry-test";

      // First attempt - record in dedup
      const entry = deduplicator.record(payload, correlationId, "item-1");
      expect(entry).toBeDefined();

      // If sending fails and we need to retry, we should be able to
      // remove from dedup and retry
      deduplicator.remove(entry.key);

      // Now retry should be allowed
      const retryCheck = deduplicator.checkAndRecord(payload, correlationId, undefined, "item-2");
      expect(retryCheck.isDuplicate).toBe(false);
    });
  });

  describe("Concurrent Notification Scenarios", () => {
    let deduplicator: NotificationDeduplicator;

    beforeEach(() => {
      deduplicator = new NotificationDeduplicator({
        enabled: true,
        windowMs: 60000,
        channelWindows: {
          [NotificationChannel.EMAIL]: 60000,
          [NotificationChannel.TELEGRAM]: 60000,
          [NotificationChannel.DISCORD]: 60000,
          [NotificationChannel.PUSH]: 60000,
          [NotificationChannel.SMS]: 60000,
        },
      });
    });

    afterEach(() => {
      deduplicator.destroy();
    });

    it("should handle concurrent checks for same notification", async () => {
      const payload = createTelegramPayload({
        body: "Concurrent test alert",
      });

      // Simulate concurrent checks (race condition scenario)
      const results = await Promise.all([
        Promise.resolve(deduplicator.checkAndRecord(payload, "concurrent-1")),
        Promise.resolve(deduplicator.checkAndRecord(payload, "concurrent-1")),
        Promise.resolve(deduplicator.checkAndRecord(payload, "concurrent-1")),
        Promise.resolve(deduplicator.checkAndRecord(payload, "concurrent-1")),
        Promise.resolve(deduplicator.checkAndRecord(payload, "concurrent-1")),
      ]);

      // Only one should succeed
      const passed = results.filter(r => !r.isDuplicate);
      const blocked = results.filter(r => r.isDuplicate);

      expect(passed.length).toBe(1);
      expect(blocked.length).toBe(4);
    });

    it("should handle concurrent checks for different notifications", async () => {
      // Different notifications should all pass
      const results = await Promise.all([
        Promise.resolve(deduplicator.checkAndRecord(createTelegramPayload({ body: "Alert 1" }), "a1")),
        Promise.resolve(deduplicator.checkAndRecord(createTelegramPayload({ body: "Alert 2" }), "a2")),
        Promise.resolve(deduplicator.checkAndRecord(createTelegramPayload({ body: "Alert 3" }), "a3")),
        Promise.resolve(deduplicator.checkAndRecord(createTelegramPayload({ body: "Alert 4" }), "a4")),
        Promise.resolve(deduplicator.checkAndRecord(createTelegramPayload({ body: "Alert 5" }), "a5")),
      ]);

      const passed = results.filter(r => !r.isDuplicate);
      expect(passed.length).toBe(5);
    });
  });

  describe("Memory Management", () => {
    it("should respect max entries limit under load", () => {
      const deduplicator = new NotificationDeduplicator({
        maxEntries: 100,
        windowMs: 60000,
        channelWindows: {
          [NotificationChannel.EMAIL]: 60000,
          [NotificationChannel.TELEGRAM]: 60000,
          [NotificationChannel.DISCORD]: 60000,
          [NotificationChannel.PUSH]: 60000,
          [NotificationChannel.SMS]: 60000,
        },
      });

      // Add 200 entries
      for (let i = 0; i < 200; i++) {
        deduplicator.record(createEmailPayload({ body: `Unique message ${i}` }));
      }

      // Should be capped at 100
      expect(deduplicator.size()).toBe(100);

      deduplicator.destroy();
    });

    it("should cleanup expired entries", async () => {
      const deduplicator = new NotificationDeduplicator({
        windowMs: 50,
        cleanupInterval: 100000, // Manual cleanup
        channelWindows: {
          [NotificationChannel.EMAIL]: 50,
          [NotificationChannel.TELEGRAM]: 50,
          [NotificationChannel.DISCORD]: 50,
          [NotificationChannel.PUSH]: 50,
          [NotificationChannel.SMS]: 50,
        },
      });

      // Add entries
      for (let i = 0; i < 10; i++) {
        deduplicator.record(createEmailPayload({ body: `Message ${i}` }));
      }

      expect(deduplicator.size()).toBe(10);

      // Wait for expiration
      await new Promise(r => setTimeout(r, 150));

      // Cleanup
      const removed = deduplicator.cleanup();
      expect(removed).toBe(10);
      expect(deduplicator.size()).toBe(0);

      deduplicator.destroy();
    });
  });

  describe("Shared Instance (Singleton)", () => {
    beforeEach(() => {
      resetDeduplicator();
    });

    afterEach(() => {
      resetDeduplicator();
    });

    it("should work with shared instance across module", () => {
      const payload = createDiscordPayload({
        body: "Shared instance test",
      });

      // Use convenience functions
      const result1 = checkAndRecordNotification(payload, "shared-test");
      expect(result1.isDuplicate).toBe(false);

      const result2 = isDuplicate(payload, "shared-test");
      expect(result2.isDuplicate).toBe(true);
    });

    it("should maintain state across multiple calls", () => {
      // Add multiple notifications
      checkAndRecordNotification(createEmailPayload({ body: "Email 1" }), "e1");
      checkAndRecordNotification(createTelegramPayload({ body: "TG 1" }), "t1");
      checkAndRecordNotification(createDiscordPayload({ body: "DC 1" }), "d1");

      // Get the shared instance and check state
      const instance = getDeduplicator();
      expect(instance.size()).toBe(3);

      // Stats should reflect all entries
      const stats = instance.getStats();
      expect(stats.totalEntries).toBe(3);
    });
  });

  describe("Key Generation Stability", () => {
    it("should generate consistent keys for same content", () => {
      const payload1 = createTelegramPayload({
        chatId: "123456789",
        body: "Same content",
        title: "Same title",
      });

      const payload2 = createTelegramPayload({
        chatId: "123456789",
        body: "Same content",
        title: "Same title",
      });

      const key1 = generateDedupKey(payload1);
      const key2 = generateDedupKey(payload2);

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different content", () => {
      const basePayload = createTelegramPayload({
        chatId: "123456789",
        body: "Original content",
      });

      const variations = [
        createTelegramPayload({ chatId: "123456789", body: "Different content" }),
        createTelegramPayload({ chatId: "987654321", body: "Original content" }),
        createTelegramPayload({ chatId: "123456789", body: "Original content", title: "Different title" }),
      ];

      const baseKey = generateDedupKey(basePayload);
      const variationKeys = variations.map(p => generateDedupKey(p));

      // All keys should be different from base
      variationKeys.forEach(key => {
        expect(key).not.toBe(baseKey);
      });
    });

    it("should handle unicode and special characters consistently", () => {
      const payload1 = createTelegramPayload({
        body: "🚨 Alert: 大量交易 detected! €1,000,000 position",
      });

      const payload2 = createTelegramPayload({
        body: "🚨 Alert: 大量交易 detected! €1,000,000 position",
      });

      const key1 = generateDedupKey(payload1);
      const key2 = generateDedupKey(payload2);

      expect(key1).toBe(key2);
    });
  });

  describe("Event Tracking", () => {
    it("should emit events for monitoring integration", () => {
      const deduplicator = new NotificationDeduplicator({
        windowMs: 60000,
        channelWindows: {
          [NotificationChannel.EMAIL]: 60000,
          [NotificationChannel.TELEGRAM]: 60000,
          [NotificationChannel.DISCORD]: 60000,
          [NotificationChannel.PUSH]: 60000,
          [NotificationChannel.SMS]: 60000,
        },
      });

      const events: { type: string; timestamp: Date }[] = [];
      deduplicator.on(event => {
        events.push({ type: event.type, timestamp: event.timestamp });
      });

      const payload = createTelegramPayload({ body: "Event tracking test" });

      // Record first - should emit entry_added
      deduplicator.record(payload);

      // Check duplicate - should emit duplicate_blocked
      deduplicator.check(payload);
      deduplicator.check(payload);

      // Verify events
      const addedEvents = events.filter(e => e.type === "dedup:entry_added");
      const blockedEvents = events.filter(e => e.type === "dedup:duplicate_blocked");

      expect(addedEvents.length).toBe(1);
      expect(blockedEvents.length).toBe(2);

      deduplicator.destroy();
    });

    it("should provide accurate statistics", () => {
      const deduplicator = new NotificationDeduplicator({
        windowMs: 60000,
        channelWindows: {
          [NotificationChannel.EMAIL]: 60000,
          [NotificationChannel.TELEGRAM]: 60000,
          [NotificationChannel.DISCORD]: 60000,
          [NotificationChannel.PUSH]: 60000,
          [NotificationChannel.SMS]: 60000,
        },
      });

      // Add various notifications
      const emailPayload = createEmailPayload({ body: "Email test" });
      const telegramPayload = createTelegramPayload({ body: "TG test" });
      const discordPayload = createDiscordPayload({ body: "Discord test" });

      deduplicator.checkAndRecord(emailPayload);
      deduplicator.checkAndRecord(telegramPayload);
      deduplicator.checkAndRecord(discordPayload);

      // Create some duplicates
      deduplicator.checkAndRecord(emailPayload);
      deduplicator.checkAndRecord(emailPayload);
      deduplicator.checkAndRecord(telegramPayload);

      const stats = deduplicator.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.byChannel[NotificationChannel.EMAIL]).toBe(1);
      expect(stats.byChannel[NotificationChannel.TELEGRAM]).toBe(1);
      expect(stats.byChannel[NotificationChannel.DISCORD]).toBe(1);
      expect(stats.duplicatesBlocked).toBe(3);
      expect(stats.hitRate).toBe(0.5); // 3 hits out of 6 checks

      deduplicator.destroy();
    });
  });
});
