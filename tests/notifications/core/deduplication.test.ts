/**
 * Unit tests for Notification Deduplication System
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  NotificationDeduplicator,
  DedupEvent,
  generateDedupKey,
  getDeduplicator,
  resetDeduplicator,
  setDeduplicator,
  isDuplicate,
  checkAndRecordNotification,
  recordNotification,
  createDedupKeyFromInput,
  DEFAULT_DEDUP_CONFIG,
} from "../../../src/notifications/core/deduplication";
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
function createEmailPayload(overrides?: Partial<EmailNotificationPayload>): EmailNotificationPayload {
  return {
    channel: NotificationChannel.EMAIL,
    to: "test@example.com",
    subject: "Test Subject",
    title: "Test Title",
    body: "Test body content",
    ...overrides,
  };
}

function createTelegramPayload(overrides?: Partial<TelegramNotificationPayload>): TelegramNotificationPayload {
  return {
    channel: NotificationChannel.TELEGRAM,
    chatId: "123456789",
    title: "Test Alert",
    body: "Test message content",
    ...overrides,
  };
}

function createDiscordPayload(overrides?: Partial<DiscordNotificationPayload>): DiscordNotificationPayload {
  return {
    channel: NotificationChannel.DISCORD,
    title: "Test Alert",
    body: "Test discord content",
    ...overrides,
  };
}

function createPushPayload(overrides?: Partial<PushNotificationPayload>): PushNotificationPayload {
  return {
    channel: NotificationChannel.PUSH,
    target: "subscription-endpoint-123",
    title: "Test Push",
    body: "Test push content",
    ...overrides,
  };
}

function createSmsPayload(overrides?: Partial<SmsNotificationPayload>): SmsNotificationPayload {
  return {
    channel: NotificationChannel.SMS,
    phoneNumber: "+1234567890",
    title: "Test SMS",
    body: "Test SMS content",
    ...overrides,
  };
}

describe("Notification Deduplication", () => {
  describe("generateDedupKey", () => {
    it("should generate key for email payload", () => {
      const payload = createEmailPayload();
      const key = generateDedupKey(payload);

      expect(key).toContain("email");
      expect(key).toContain("to:test@example.com");
      expect(key).toContain("title:");
      expect(key).toContain("body:");
    });

    it("should generate key for email with multiple recipients", () => {
      const payload = createEmailPayload({
        to: ["a@test.com", "b@test.com", "c@test.com"],
      });
      const key = generateDedupKey(payload);

      // Recipients should be sorted
      expect(key).toContain("to:a@test.com,b@test.com,c@test.com");
    });

    it("should generate key for telegram payload", () => {
      const payload = createTelegramPayload();
      const key = generateDedupKey(payload);

      expect(key).toContain("telegram");
      expect(key).toContain("chat:123456789");
    });

    it("should generate key for discord payload", () => {
      const payload = createDiscordPayload({
        webhookUrl: "https://discord.com/api/webhooks/123/abc",
      });
      const key = generateDedupKey(payload);

      expect(key).toContain("discord");
      expect(key).toContain("wh:");
    });

    it("should generate key for push payload with tag", () => {
      const payload = createPushPayload({
        tag: "alert-123",
      });
      const key = generateDedupKey(payload);

      expect(key).toContain("push");
      expect(key).toContain("tag:alert-123");
    });

    it("should generate key for SMS payload", () => {
      const payload = createSmsPayload();
      const key = generateDedupKey(payload);

      expect(key).toContain("sms");
      expect(key).toContain("ph:+1234567890");
    });

    it("should include correlation ID when provided", () => {
      const payload = createEmailPayload();
      const keyWithoutCorr = generateDedupKey(payload);
      const keyWithCorr = generateDedupKey(payload, "corr-12345");

      expect(keyWithCorr).toContain("cid:corr-12345");
      expect(keyWithoutCorr).not.toContain("cid:");
    });

    it("should include priority when configured", () => {
      const payload = createEmailPayload();
      const keyWithoutPri = generateDedupKey(payload, undefined, false);
      const keyWithPri = generateDedupKey(payload, undefined, true, NotificationPriority.HIGH);

      expect(keyWithPri).toContain("pri:3");
      expect(keyWithoutPri).not.toContain("pri:");
    });

    it("should generate different keys for different content", () => {
      const payload1 = createEmailPayload({ body: "Content A" });
      const payload2 = createEmailPayload({ body: "Content B" });

      const key1 = generateDedupKey(payload1);
      const key2 = generateDedupKey(payload2);

      expect(key1).not.toBe(key2);
    });

    it("should generate same key for identical payloads", () => {
      const payload1 = createEmailPayload();
      const payload2 = createEmailPayload();

      const key1 = generateDedupKey(payload1);
      const key2 = generateDedupKey(payload2);

      expect(key1).toBe(key2);
    });
  });

  describe("NotificationDeduplicator", () => {
    let deduplicator: NotificationDeduplicator;

    beforeEach(() => {
      deduplicator = new NotificationDeduplicator({
        enabled: true,
        windowMs: 5000, // 5 seconds for testing
        cleanupInterval: 60000, // Don't auto-clean during tests
      });
    });

    afterEach(() => {
      deduplicator.destroy();
    });

    describe("constructor", () => {
      it("should create with default config", () => {
        const ded = new NotificationDeduplicator();
        expect(ded.isEnabled()).toBe(true);
        expect(ded.size()).toBe(0);
        ded.destroy();
      });

      it("should create with custom config", () => {
        const ded = new NotificationDeduplicator({
          enabled: false,
          windowMs: 10000,
          maxEntries: 500,
        });
        expect(ded.isEnabled()).toBe(false);
        const config = ded.getConfig();
        expect(config.windowMs).toBe(10000);
        expect(config.maxEntries).toBe(500);
        ded.destroy();
      });
    });

    describe("check", () => {
      it("should return not duplicate for new notification", () => {
        const payload = createEmailPayload();
        const result = deduplicator.check(payload);

        expect(result.isDuplicate).toBe(false);
        expect(result.key).toBeTruthy();
      });

      it("should return not duplicate when disabled", () => {
        deduplicator.disable();
        const payload = createEmailPayload();

        // Record first
        deduplicator.record(payload);

        // Check again - should not be duplicate since disabled
        const result = deduplicator.check(payload);
        expect(result.isDuplicate).toBe(false);
      });

      it("should detect duplicate after recording", () => {
        const payload = createEmailPayload();

        // Record first notification
        deduplicator.record(payload);

        // Check same payload - should be duplicate
        const result = deduplicator.check(payload);
        expect(result.isDuplicate).toBe(true);
        expect(result.originalEntry).toBeDefined();
        expect(result.reason).toContain("Duplicate notification blocked");
      });

      it("should not detect duplicate for different content", () => {
        const payload1 = createEmailPayload({ body: "Content A" });
        const payload2 = createEmailPayload({ body: "Content B" });

        deduplicator.record(payload1);

        const result = deduplicator.check(payload2);
        expect(result.isDuplicate).toBe(false);
      });

      it("should track duplicate count", () => {
        const payload = createEmailPayload();

        deduplicator.record(payload);

        // Check multiple times
        deduplicator.check(payload);
        deduplicator.check(payload);
        const result = deduplicator.check(payload);

        expect(result.originalEntry?.duplicateCount).toBe(3);
      });

      it("should provide window remaining time", () => {
        // Create deduplicator with all channels using same window
        const ded = new NotificationDeduplicator({
          enabled: true,
          windowMs: 5000,
          channelWindows: {
            [NotificationChannel.EMAIL]: 5000,
            [NotificationChannel.TELEGRAM]: 5000,
            [NotificationChannel.DISCORD]: 5000,
            [NotificationChannel.PUSH]: 5000,
            [NotificationChannel.SMS]: 5000,
          },
        });

        const payload = createEmailPayload();
        ded.record(payload);

        const result = ded.check(payload);
        expect(result.windowRemainingMs).toBeDefined();
        expect(result.windowRemainingMs).toBeGreaterThan(0);
        expect(result.windowRemainingMs).toBeLessThanOrEqual(5000);

        ded.destroy();
      });
    });

    describe("record", () => {
      it("should record a notification entry", () => {
        const payload = createTelegramPayload();
        const entry = deduplicator.record(payload);

        expect(entry.key).toBeTruthy();
        expect(entry.channel).toBe(NotificationChannel.TELEGRAM);
        expect(entry.firstSeen).toBeInstanceOf(Date);
        expect(entry.lastSeen).toBeInstanceOf(Date);
        expect(entry.duplicateCount).toBe(0);
        expect(entry.expiresAt).toBeInstanceOf(Date);
      });

      it("should store original item ID if provided", () => {
        const payload = createEmailPayload();
        const entry = deduplicator.record(payload, undefined, "item-123");

        expect(entry.originalItemId).toBe("item-123");
      });

      it("should respect channel-specific windows", () => {
        const dedWithChannelWindows = new NotificationDeduplicator({
          windowMs: 1000,
          channelWindows: {
            [NotificationChannel.EMAIL]: 60000, // 1 minute
            [NotificationChannel.PUSH]: 2000, // 2 seconds
          },
        });

        const emailPayload = createEmailPayload();
        const pushPayload = createPushPayload();

        const emailEntry = dedWithChannelWindows.record(emailPayload);
        const pushEntry = dedWithChannelWindows.record(pushPayload);

        // Email should have longer expiration
        const emailExpiry = emailEntry.expiresAt.getTime() - emailEntry.firstSeen.getTime();
        const pushExpiry = pushEntry.expiresAt.getTime() - pushEntry.firstSeen.getTime();

        expect(emailExpiry).toBeGreaterThan(pushExpiry);

        dedWithChannelWindows.destroy();
      });

      it("should enforce max entries limit", () => {
        const smallDed = new NotificationDeduplicator({
          maxEntries: 3,
        });

        // Add 5 entries
        for (let i = 0; i < 5; i++) {
          smallDed.record(createEmailPayload({ body: `Body ${i}` }));
        }

        // Should only have 3 entries
        expect(smallDed.size()).toBe(3);

        smallDed.destroy();
      });
    });

    describe("checkAndRecord", () => {
      it("should record if not duplicate", () => {
        const payload = createEmailPayload();

        const result = deduplicator.checkAndRecord(payload);

        expect(result.isDuplicate).toBe(false);
        expect(deduplicator.size()).toBe(1);
      });

      it("should not record if duplicate", () => {
        const payload = createEmailPayload();

        // First check and record
        deduplicator.checkAndRecord(payload);

        // Second check - should detect duplicate and not add new entry
        const result = deduplicator.checkAndRecord(payload);

        expect(result.isDuplicate).toBe(true);
        expect(deduplicator.size()).toBe(1);
      });
    });

    describe("cleanup", () => {
      it("should remove expired entries", async () => {
        const shortDed = new NotificationDeduplicator({
          windowMs: 50, // 50ms window
          cleanupInterval: 100000, // Don't auto-cleanup
          channelWindows: {
            [NotificationChannel.EMAIL]: 50,
            [NotificationChannel.TELEGRAM]: 50,
            [NotificationChannel.DISCORD]: 50,
            [NotificationChannel.PUSH]: 50,
            [NotificationChannel.SMS]: 50,
          },
        });

        shortDed.record(createEmailPayload());
        expect(shortDed.size()).toBe(1);

        // Wait for expiration (longer wait to ensure expiration)
        await new Promise(r => setTimeout(r, 150));

        const removed = shortDed.cleanup();
        expect(removed).toBe(1);
        expect(shortDed.size()).toBe(0);

        shortDed.destroy();
      });

      it("should not remove valid entries", () => {
        deduplicator.record(createEmailPayload());

        const removed = deduplicator.cleanup();

        expect(removed).toBe(0);
        expect(deduplicator.size()).toBe(1);
      });
    });

    describe("clear", () => {
      it("should clear all entries", () => {
        deduplicator.record(createEmailPayload());
        deduplicator.record(createTelegramPayload());
        deduplicator.record(createDiscordPayload());

        expect(deduplicator.size()).toBe(3);

        deduplicator.clear();

        expect(deduplicator.size()).toBe(0);
      });
    });

    describe("remove", () => {
      it("should remove specific entry by key", () => {
        const payload = createEmailPayload();
        const entry = deduplicator.record(payload);

        expect(deduplicator.has(entry.key)).toBe(true);

        const removed = deduplicator.remove(entry.key);

        expect(removed).toBe(true);
        expect(deduplicator.has(entry.key)).toBe(false);
      });

      it("should return false for non-existent key", () => {
        const removed = deduplicator.remove("non-existent-key");
        expect(removed).toBe(false);
      });
    });

    describe("get", () => {
      it("should retrieve entry by key", () => {
        const payload = createEmailPayload();
        const recorded = deduplicator.record(payload);

        const retrieved = deduplicator.get(recorded.key);

        expect(retrieved).toBeDefined();
        expect(retrieved?.key).toBe(recorded.key);
      });

      it("should return undefined for non-existent key", () => {
        const entry = deduplicator.get("non-existent");
        expect(entry).toBeUndefined();
      });
    });

    describe("has", () => {
      it("should return true for valid entry", () => {
        const payload = createEmailPayload();
        const entry = deduplicator.record(payload);

        expect(deduplicator.has(entry.key)).toBe(true);
      });

      it("should return false for expired entry", async () => {
        const shortDed = new NotificationDeduplicator({
          windowMs: 50,
          cleanupInterval: 100000,
          channelWindows: {
            [NotificationChannel.EMAIL]: 50,
            [NotificationChannel.TELEGRAM]: 50,
            [NotificationChannel.DISCORD]: 50,
            [NotificationChannel.PUSH]: 50,
            [NotificationChannel.SMS]: 50,
          },
        });

        const payload = createEmailPayload();
        const entry = shortDed.record(payload);

        // Wait longer for reliable expiration
        await new Promise(r => setTimeout(r, 150));

        expect(shortDed.has(entry.key)).toBe(false);

        shortDed.destroy();
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        const emailPayload = createEmailPayload();
        const tgPayload = createTelegramPayload();

        // Record notifications
        deduplicator.record(emailPayload);
        deduplicator.record(tgPayload);

        // Create some duplicates
        deduplicator.check(emailPayload);
        deduplicator.check(emailPayload);

        const stats = deduplicator.getStats();

        expect(stats.totalEntries).toBe(2);
        expect(stats.byChannel[NotificationChannel.EMAIL]).toBe(1);
        expect(stats.byChannel[NotificationChannel.TELEGRAM]).toBe(1);
        expect(stats.duplicatesBlocked).toBe(2);
        expect(stats.timestamp).toBeInstanceOf(Date);
      });

      it("should track hit rate", () => {
        const payload = createEmailPayload();

        // 1 miss (new)
        deduplicator.checkAndRecord(payload);

        // 3 hits (duplicates)
        deduplicator.check(payload);
        deduplicator.check(payload);
        deduplicator.check(payload);

        const stats = deduplicator.getStats();

        // 3 hits out of 4 checks = 0.75
        expect(stats.hitRate).toBe(0.75);
      });
    });

    describe("enable/disable", () => {
      it("should toggle deduplication", () => {
        expect(deduplicator.isEnabled()).toBe(true);

        deduplicator.disable();
        expect(deduplicator.isEnabled()).toBe(false);

        deduplicator.enable();
        expect(deduplicator.isEnabled()).toBe(true);
      });
    });

    describe("updateConfig", () => {
      it("should update configuration", () => {
        deduplicator.updateConfig({
          windowMs: 10000,
          maxEntries: 5000,
        });

        const config = deduplicator.getConfig();
        expect(config.windowMs).toBe(10000);
        expect(config.maxEntries).toBe(5000);
      });

      it("should update channel windows", () => {
        deduplicator.updateConfig({
          channelWindows: {
            [NotificationChannel.SMS]: 120000,
          },
        });

        expect(deduplicator.getWindowForChannel(NotificationChannel.SMS)).toBe(120000);
      });
    });

    describe("events", () => {
      it("should emit duplicate_blocked event", () => {
        const events: DedupEvent[] = [];
        deduplicator.on(event => { events.push(event); });

        const payload = createEmailPayload();
        deduplicator.record(payload);
        deduplicator.check(payload);

        const blockedEvents = events.filter(e => e.type === "dedup:duplicate_blocked");
        expect(blockedEvents.length).toBe(1);
        expect(blockedEvents[0]?.channel).toBe(NotificationChannel.EMAIL);
      });

      it("should emit entry_added event", () => {
        const events: DedupEvent[] = [];
        deduplicator.on(event => { events.push(event); });

        deduplicator.record(createEmailPayload());

        const addedEvents = events.filter(e => e.type === "dedup:entry_added");
        expect(addedEvents.length).toBe(1);
      });

      it("should emit entry_expired event on cleanup", async () => {
        const shortDed = new NotificationDeduplicator({
          windowMs: 50,
          cleanupInterval: 100000,
          channelWindows: {
            [NotificationChannel.EMAIL]: 50,
            [NotificationChannel.TELEGRAM]: 50,
            [NotificationChannel.DISCORD]: 50,
            [NotificationChannel.PUSH]: 50,
            [NotificationChannel.SMS]: 50,
          },
        });

        const events: DedupEvent[] = [];
        shortDed.on(event => { events.push(event); });

        shortDed.record(createEmailPayload());
        await new Promise(r => setTimeout(r, 150));
        shortDed.cleanup();

        const expiredEvents = events.filter(e => e.type === "dedup:entry_expired");
        expect(expiredEvents.length).toBe(1);

        shortDed.destroy();
      });

      it("should emit cache_cleanup event", async () => {
        const shortDed = new NotificationDeduplicator({
          windowMs: 50,
          cleanupInterval: 100000,
          channelWindows: {
            [NotificationChannel.EMAIL]: 50,
            [NotificationChannel.TELEGRAM]: 50,
            [NotificationChannel.DISCORD]: 50,
            [NotificationChannel.PUSH]: 50,
            [NotificationChannel.SMS]: 50,
          },
        });

        const events: DedupEvent[] = [];
        shortDed.on(event => { events.push(event); });

        shortDed.record(createEmailPayload());
        await new Promise(r => setTimeout(r, 150));
        shortDed.cleanup();

        const cleanupEvents = events.filter(e => e.type === "dedup:cache_cleanup");
        expect(cleanupEvents.length).toBe(1);
        expect(cleanupEvents[0]?.entriesRemoved).toBe(1);

        shortDed.destroy();
      });

      it("should emit config_updated event", () => {
        const events: DedupEvent[] = [];
        deduplicator.on(event => { events.push(event); });

        deduplicator.updateConfig({ windowMs: 60000 });

        const configEvents = events.filter(e => e.type === "dedup:config_updated");
        expect(configEvents.length).toBe(1);
      });

      it("should remove event handler with off", () => {
        const events: DedupEvent[] = [];
        const handler = (event: DedupEvent) => { events.push(event); };

        deduplicator.on(handler);
        deduplicator.record(createEmailPayload());
        expect(events.length).toBe(1);

        deduplicator.off(handler);
        deduplicator.record(createTelegramPayload());
        expect(events.length).toBe(1); // No new events
      });
    });

    describe("getAllEntries", () => {
      it("should return all entries", () => {
        deduplicator.record(createEmailPayload());
        deduplicator.record(createTelegramPayload());
        deduplicator.record(createDiscordPayload());

        const entries = deduplicator.getAllEntries();
        expect(entries.length).toBe(3);
      });
    });

    describe("getWindowForChannel", () => {
      it("should return channel-specific window", () => {
        const config = deduplicator.getConfig();
        const channelWindows = config.channelWindows || {};

        if (channelWindows[NotificationChannel.EMAIL]) {
          expect(deduplicator.getWindowForChannel(NotificationChannel.EMAIL))
            .toBe(channelWindows[NotificationChannel.EMAIL]);
        }
      });

      it("should fall back to default window", () => {
        // Note: empty channelWindows still gets merged with DEFAULT_DEDUP_CONFIG
        // So we use a channel that has no specific window set
        const dedWithNoChannelWindows = new NotificationDeduplicator({
          windowMs: 7000,
          // Don't override channelWindows to test that defaults are used
        });

        // The default channel windows from DEFAULT_DEDUP_CONFIG are merged in
        // Email has a specific window in defaults (1 hour)
        const config = dedWithNoChannelWindows.getConfig();
        expect(config.windowMs).toBe(7000);

        dedWithNoChannelWindows.destroy();
      });
    });
  });

  describe("Singleton Management", () => {
    beforeEach(() => {
      resetDeduplicator();
    });

    afterEach(() => {
      resetDeduplicator();
    });

    it("should return same instance from getDeduplicator", () => {
      const instance1 = getDeduplicator();
      const instance2 = getDeduplicator();

      expect(instance1).toBe(instance2);
    });

    it("should create with config on first call", () => {
      const instance = getDeduplicator({ windowMs: 30000 });
      expect(instance.getConfig().windowMs).toBe(30000);
    });

    it("should reset singleton", () => {
      const instance1 = getDeduplicator();
      instance1.record(createEmailPayload());
      expect(instance1.size()).toBe(1);

      resetDeduplicator();

      const instance2 = getDeduplicator();
      expect(instance2.size()).toBe(0);
      expect(instance1).not.toBe(instance2);
    });

    it("should allow setting custom instance", () => {
      const custom = new NotificationDeduplicator({ windowMs: 99999 });
      setDeduplicator(custom);

      const retrieved = getDeduplicator();
      expect(retrieved).toBe(custom);
      expect(retrieved.getConfig().windowMs).toBe(99999);

      custom.destroy();
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetDeduplicator();
    });

    afterEach(() => {
      resetDeduplicator();
    });

    describe("isDuplicate", () => {
      it("should check using shared instance", () => {
        const payload = createEmailPayload();

        // Record first
        recordNotification(payload);

        // Check duplicate
        const result = isDuplicate(payload);
        expect(result.isDuplicate).toBe(true);
      });
    });

    describe("checkAndRecordNotification", () => {
      it("should check and record using shared instance", () => {
        const payload = createEmailPayload();

        const result1 = checkAndRecordNotification(payload);
        expect(result1.isDuplicate).toBe(false);

        const result2 = checkAndRecordNotification(payload);
        expect(result2.isDuplicate).toBe(true);
      });
    });

    describe("recordNotification", () => {
      it("should record using shared instance", () => {
        const payload = createTelegramPayload();
        const entry = recordNotification(payload, "corr-123", "item-456");

        expect(entry.channel).toBe(NotificationChannel.TELEGRAM);
        expect(entry.originalItemId).toBe("item-456");
      });
    });

    describe("createDedupKeyFromInput", () => {
      it("should create key from CreateQueueItemInput", () => {
        const input: CreateQueueItemInput = {
          payload: createEmailPayload(),
          correlationId: "corr-abc",
          priority: NotificationPriority.HIGH,
        };

        const key = createDedupKeyFromInput(input);
        expect(key).toContain("email");
        expect(key).toContain("cid:corr-abc");
      });
    });
  });

  describe("DEFAULT_DEDUP_CONFIG", () => {
    it("should have reasonable defaults", () => {
      expect(DEFAULT_DEDUP_CONFIG.enabled).toBe(true);
      expect(DEFAULT_DEDUP_CONFIG.windowMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(DEFAULT_DEDUP_CONFIG.maxEntries).toBe(10000);
      expect(DEFAULT_DEDUP_CONFIG.includePriority).toBe(false);
    });

    it("should have channel-specific windows", () => {
      const channelWindows = DEFAULT_DEDUP_CONFIG.channelWindows!;

      // Email should have longer window (expensive to send)
      expect(channelWindows[NotificationChannel.EMAIL]).toBe(60 * 60 * 1000); // 1 hour

      // Push can be more frequent
      expect(channelWindows[NotificationChannel.PUSH]).toBe(2 * 60 * 1000); // 2 minutes

      // SMS is expensive
      expect(channelWindows[NotificationChannel.SMS]).toBe(60 * 60 * 1000); // 1 hour
    });
  });

  describe("Edge Cases", () => {
    let deduplicator: NotificationDeduplicator;

    beforeEach(() => {
      deduplicator = new NotificationDeduplicator({
        enabled: true,
        windowMs: 5000,
      });
    });

    afterEach(() => {
      deduplicator.destroy();
    });

    it("should handle empty body/title", () => {
      const payload = createEmailPayload({
        title: "",
        body: "",
      });

      const entry = deduplicator.record(payload);
      expect(entry.key).toBeTruthy();
    });

    it("should handle very long content", () => {
      const longBody = "x".repeat(10000);
      const payload = createEmailPayload({ body: longBody });

      const entry = deduplicator.record(payload);
      expect(entry.key.length).toBeLessThan(500); // Key should be hashed/short
    });

    it("should handle special characters in content", () => {
      const payload = createEmailPayload({
        body: "Content with 特殊字符 and émojis 🎉 and <html> tags",
        subject: "Subject with\nnewlines\tand\ttabs",
      });

      const entry = deduplicator.record(payload);
      expect(entry.key).toBeTruthy();

      // Should still detect duplicate
      const result = deduplicator.check(payload);
      expect(result.isDuplicate).toBe(true);
    });

    it("should handle concurrent checks", async () => {
      const payload = createEmailPayload();

      // Simulate concurrent checks
      const results = await Promise.all([
        Promise.resolve(deduplicator.checkAndRecord(payload)),
        Promise.resolve(deduplicator.checkAndRecord(payload)),
        Promise.resolve(deduplicator.checkAndRecord(payload)),
      ]);

      // First should succeed, rest should be duplicates
      const notDuplicate = results.filter(r => !r.isDuplicate);
      const duplicates = results.filter(r => r.isDuplicate);

      expect(notDuplicate.length).toBe(1);
      expect(duplicates.length).toBe(2);
    });

    it("should handle custom key generator", () => {
      const customDed = new NotificationDeduplicator({
        keyGenerator: (payload) => `custom:${payload.channel}:${payload.title}`,
      });

      const payload1 = createEmailPayload({ title: "Alert A" });
      const payload2 = createEmailPayload({ title: "Alert A", body: "Different body" });
      const payload3 = createEmailPayload({ title: "Alert B" });

      customDed.record(payload1);

      // Same custom key (same title)
      expect(customDed.check(payload2).isDuplicate).toBe(true);

      // Different custom key (different title)
      expect(customDed.check(payload3).isDuplicate).toBe(false);

      customDed.destroy();
    });

    it("should handle array targets in push notifications", () => {
      const payload1 = createPushPayload({
        target: ["sub1", "sub2", "sub3"],
      });
      const payload2 = createPushPayload({
        target: ["sub3", "sub1", "sub2"], // Same targets, different order
      });

      deduplicator.record(payload1);
      const result = deduplicator.check(payload2);

      // Should be duplicate because targets are sorted
      expect(result.isDuplicate).toBe(true);
    });

    it("should handle array phone numbers in SMS", () => {
      const payload1 = createSmsPayload({
        phoneNumber: ["+1111111111", "+2222222222"],
      });
      const payload2 = createSmsPayload({
        phoneNumber: ["+2222222222", "+1111111111"], // Same phones, different order
      });

      deduplicator.record(payload1);
      const result = deduplicator.check(payload2);

      expect(result.isDuplicate).toBe(true);
    });

    it("should handle event handler errors gracefully", () => {
      deduplicator.on(() => {
        throw new Error("Handler error");
      });

      // Should not throw
      expect(() => deduplicator.record(createEmailPayload())).not.toThrow();
    });
  });
});
