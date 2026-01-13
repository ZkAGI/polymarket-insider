/**
 * E2E integration tests for Web Push notification system
 * Tests the complete push notification workflow
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  // Types
  PushNotificationStatus,
  PushSubscriptionState,
  PushUrgency,
  type PushSubscription,
  type PushNotificationPayload,
  type PushServiceConfig,
  type PushEvent,
  // VAPID
  generateVapidKeys,
  resetVapidKeys,
  setVapidKeys,
  getVapidKeys,
  hasVapidKeys,
  base64urlEncode,
  base64urlDecode,
  createVapidAuthHeader,
  validateVapidKeys,
  // Client
  createPushClient,
  resetPushClient,
  // Storage
  createInMemoryStorage,
  createSubscriptionManager,
  resetStorage,
} from "../../../src/notifications/push";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a valid push subscription for testing
 */
function createTestSubscription(index?: number): PushSubscription {
  const i = index ?? Math.floor(Math.random() * 10000);
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/test-subscription-${i}`,
    keys: {
      p256dh:
        "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
      auth: "4vQK-SvRAN5eo-8ASlrwSg",
    },
  };
}

/**
 * Create a test notification payload
 */
function createTestPayload(title?: string, body?: string): PushNotificationPayload {
  return {
    title: title ?? "Test Notification",
    body: body ?? "This is a test notification message",
  };
}

/**
 * Create a test push service config
 */
function createTestConfig(overrides?: Partial<PushServiceConfig>): PushServiceConfig {
  const keys = generateVapidKeys("mailto:test@example.com");
  return {
    vapidKeys: keys,
    devMode: true, // Always use dev mode for tests
    maxRetries: 2,
    retryDelay: 100,
    timeout: 5000,
    ...overrides,
  };
}

// ============================================================================
// E2E Tests
// ============================================================================

describe("E2E: Push Notification System", () => {
  beforeEach(() => {
    resetPushClient();
    resetVapidKeys();
    resetStorage();
  });

  afterEach(() => {
    resetPushClient();
    resetVapidKeys();
    resetStorage();
  });

  describe("Complete Push Notification Workflow", () => {
    it("should complete full workflow: keys -> subscribe -> send -> unsubscribe", async () => {
      // 1. Generate VAPID keys
      const vapidKeys = generateVapidKeys("mailto:test@example.com");
      expect(validateVapidKeys(vapidKeys)).toBe(true);

      // 2. Create push client
      const config = createTestConfig({ vapidKeys });
      const client = createPushClient(config);

      // 3. Create subscription manager
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // 4. Subscribe a user
      const browserSubscription = createTestSubscription();
      const record = await manager.subscribe(browserSubscription, "user123", {
        device: "desktop",
        browser: "chrome",
      });

      expect(record.state).toBe(PushSubscriptionState.ACTIVE);
      expect(record.userId).toBe("user123");

      // 5. Send notification
      const payload = createTestPayload("New Alert!", "Important market activity detected");
      const result = await client.send(browserSubscription, payload);

      expect(result.status).toBe(PushNotificationStatus.SENT);

      // 6. Record success
      await manager.recordSuccess(browserSubscription.endpoint);
      const updatedRecord = await storage.getByEndpoint(browserSubscription.endpoint);
      expect(updatedRecord!.lastNotificationAt).toBeDefined();

      // 7. Unsubscribe
      await manager.unsubscribe(browserSubscription.endpoint);
      const isActive = await manager.isActive(browserSubscription.endpoint);
      expect(isActive).toBe(false);

      // 8. Cleanup
      client.stop();
    });

    it("should handle batch notifications to multiple users", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // Subscribe 5 users
      const subscriptions: PushSubscription[] = [];
      for (let i = 0; i < 5; i++) {
        const sub = createTestSubscription(i);
        await manager.subscribe(sub, `user${i}`);
        subscriptions.push(sub);
      }

      // Verify all subscribed
      expect(await manager.getActiveCount()).toBe(5);

      // Send batch notification
      const payload = createTestPayload("System Update", "New features available");
      const result = await client.sendBatch(subscriptions, payload, {
        concurrency: 3,
      });

      expect(result.total).toBe(5);
      expect(result.sent).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.expired).toBe(0);

      client.stop();
    });

    it("should track events throughout the workflow", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);
      const events: PushEvent[] = [];

      // Listen to all relevant events
      client.on("notification:sending", (e) => { events.push(e); });
      client.on("notification:sent", (e) => { events.push(e); });
      client.on("notification:failed", (e) => { events.push(e); });
      client.on("service:stopped", (e) => { events.push(e); });

      // Send a notification
      const sub = createTestSubscription();
      await client.send(sub, createTestPayload());

      // Verify events
      expect(events.length).toBe(2);
      expect(events[0]!.type).toBe("notification:sending");
      expect(events[1]!.type).toBe("notification:sent");

      // Stop client
      client.stop();
      expect(events.length).toBe(3);
      expect(events[2]!.type).toBe("service:stopped");
    });
  });

  describe("VAPID Key Generation and Usage", () => {
    it("should generate unique keys each time", () => {
      const keys1 = generateVapidKeys("mailto:test1@example.com");
      const keys2 = generateVapidKeys("mailto:test2@example.com");

      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
    });

    it("should create valid JWT for authorization", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      const jwt = createVapidAuthHeader(
        "https://fcm.googleapis.com",
        keys.subject,
        keys.publicKey,
        keys.privateKey
      );

      // JWT should have 3 parts
      const parts = jwt.split(".");
      expect(parts.length).toBe(3);

      // Header should be valid
      const header = JSON.parse(base64urlDecode(parts[0]!).toString());
      expect(header.typ).toBe("JWT");
      expect(header.alg).toBe("ES256");

      // Payload should have required claims
      const payload = JSON.parse(base64urlDecode(parts[1]!).toString());
      expect(payload.aud).toBe("https://fcm.googleapis.com");
      expect(payload.sub).toBe("mailto:test@example.com");
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("should store and retrieve VAPID keys", () => {
      expect(hasVapidKeys()).toBe(false);

      const keys = generateVapidKeys("mailto:test@example.com");
      setVapidKeys(keys);

      expect(hasVapidKeys()).toBe(true);
      expect(getVapidKeys()).toEqual(keys);
    });
  });

  describe("Subscription Management", () => {
    it("should manage subscription lifecycle", async () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);
      const sub = createTestSubscription();

      // Subscribe
      const record = await manager.subscribe(sub, "user1");
      expect(record.state).toBe(PushSubscriptionState.ACTIVE);

      // Check active
      expect(await manager.isActive(sub.endpoint)).toBe(true);

      // Unsubscribe
      await manager.unsubscribe(sub.endpoint);
      expect(await manager.isActive(sub.endpoint)).toBe(false);

      // Resubscribe
      const resubscribed = await manager.subscribe(sub, "user1");
      expect(resubscribed.state).toBe(PushSubscriptionState.ACTIVE);
    });

    it("should handle multiple subscriptions per user", async () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // User subscribes from multiple devices
      const sub1 = createTestSubscription(1);
      const sub2 = createTestSubscription(2);
      const sub3 = createTestSubscription(3);

      await manager.subscribe(sub1, "user1");
      await manager.subscribe(sub2, "user1");
      await manager.subscribe(sub3, "user1");

      // All subscriptions should be active
      const userSubs = await manager.getUserSubscriptions("user1");
      expect(userSubs.length).toBe(3);

      // Unsubscribe all
      await manager.unsubscribeUser("user1");
      expect((await manager.getUserSubscriptions("user1")).length).toBe(0);
    });

    it("should track failures and mark invalid", async () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);
      const sub = createTestSubscription();

      await manager.subscribe(sub);

      // Record failures
      await manager.recordFailure(sub.endpoint);
      await manager.recordFailure(sub.endpoint);
      await manager.recordFailure(sub.endpoint);

      // Should be marked invalid after 3 failures
      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.state).toBe(PushSubscriptionState.INVALID);
    });

    it("should clean up expired subscriptions", async () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // Create some subscriptions
      for (let i = 0; i < 5; i++) {
        await manager.subscribe(createTestSubscription(i));
      }

      // Mark some as expired
      await manager.markExpired(createTestSubscription(0).endpoint);
      await manager.markExpired(createTestSubscription(1).endpoint);

      // Cleanup
      const removed = await manager.cleanup(0);
      expect(removed).toBe(2);
      expect(await manager.getActiveCount()).toBe(3);
    });
  });

  describe("Push Client Operations", () => {
    it("should send notifications with different urgency levels", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);
      const sub = createTestSubscription();
      const payload = createTestPayload();

      // Test all urgency levels
      const urgencies = [
        PushUrgency.VERY_LOW,
        PushUrgency.LOW,
        PushUrgency.NORMAL,
        PushUrgency.HIGH,
      ];

      for (const urgency of urgencies) {
        const result = await client.send(sub, payload, { urgency });
        expect(result.status).toBe(PushNotificationStatus.SENT);
      }

      client.stop();
    });

    it("should handle rich notification payloads", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);
      const sub = createTestSubscription();

      const richPayload: PushNotificationPayload = {
        title: "Whale Alert!",
        body: "$500,000 trade on Presidential Election market",
        icon: "https://example.com/whale-icon.png",
        badge: "https://example.com/badge.png",
        image: "https://example.com/chart.png",
        tag: "whale-alert-123",
        requireInteraction: true,
        url: "https://polymarket.com/event/presidential-election",
        actions: [
          { action: "view", title: "View Market" },
          { action: "dismiss", title: "Dismiss" },
        ],
        data: {
          marketId: "123",
          tradeSize: 500000,
          walletAddress: "0x1234...5678",
        },
      };

      const result = await client.send(sub, richPayload);
      expect(result.status).toBe(PushNotificationStatus.SENT);

      client.stop();
    });

    it("should maintain accurate statistics", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);

      // Initial stats
      expect(client.getStats()).toEqual({ sent: 0, failed: 0, expired: 0 });

      // Send successful notifications
      for (let i = 0; i < 3; i++) {
        await client.send(createTestSubscription(i), createTestPayload());
      }

      // Send to invalid subscription
      await client.send(
        { endpoint: "invalid", keys: { p256dh: "x", auth: "y" } },
        createTestPayload()
      );

      expect(client.getStats()).toEqual({ sent: 3, failed: 1, expired: 0 });

      // Reset and verify
      client.resetStats();
      expect(client.getStats()).toEqual({ sent: 0, failed: 0, expired: 0 });

      client.stop();
    });

    it("should expose public key for frontend use", async () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      const config = createTestConfig({ vapidKeys: keys });
      const client = createPushClient(config);

      const publicKey = client.getPublicKey();
      expect(publicKey).toBe(keys.publicKey);

      // This key should be usable by the frontend for subscription
      expect(publicKey.length).toBeGreaterThan(80);

      client.stop();
    });
  });

  describe("Storage Operations", () => {
    it("should persist and retrieve subscriptions", async () => {
      const storage = createInMemoryStorage();
      const sub = createTestSubscription();

      // Save
      await storage.save({
        id: "test-id",
        subscription: sub,
        state: PushSubscriptionState.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedAttempts: 0,
        userId: "user1",
        metadata: { browser: "chrome" },
      });

      // Retrieve by different methods
      const byId = await storage.getById("test-id");
      const byEndpoint = await storage.getByEndpoint(sub.endpoint);
      const byUser = await storage.getByUserId("user1");

      expect(byId).not.toBeNull();
      expect(byEndpoint).not.toBeNull();
      expect(byUser.length).toBe(1);
      expect(byId!.metadata).toEqual({ browser: "chrome" });
    });

    it("should handle concurrent operations", async () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // Concurrently subscribe many users
      const promises = Array(20)
        .fill(null)
        .map((_, i) => manager.subscribe(createTestSubscription(i), `user${i}`));

      await Promise.all(promises);

      expect(await manager.getActiveCount()).toBe(20);
    });

    it("should update subscriptions correctly", async () => {
      const storage = createInMemoryStorage();
      const sub = createTestSubscription();

      await storage.save({
        id: "test-id",
        subscription: sub,
        state: PushSubscriptionState.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        failedAttempts: 0,
      });

      // Update
      await storage.update("test-id", {
        failedAttempts: 3,
        state: PushSubscriptionState.INVALID,
      });

      const updated = await storage.getById("test-id");
      expect(updated!.failedAttempts).toBe(3);
      expect(updated!.state).toBe(PushSubscriptionState.INVALID);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid subscription gracefully", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);

      const invalidSub: PushSubscription = {
        endpoint: "not-a-valid-url",
        keys: { p256dh: "short", auth: "short" },
      };

      const result = await client.send(invalidSub, createTestPayload());
      expect(result.status).toBe(PushNotificationStatus.FAILED);
      expect(result.error).toBeDefined();

      client.stop();
    });

    it("should handle invalid payload gracefully", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);

      const invalidPayload = {
        title: "", // Empty title is invalid
        body: "",
      } as PushNotificationPayload;

      const result = await client.send(createTestSubscription(), invalidPayload);
      expect(result.status).toBe(PushNotificationStatus.FAILED);

      client.stop();
    });

    it("should continue batch send on individual failures", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);

      const subscriptions = [
        createTestSubscription(1),
        { endpoint: "invalid", keys: { p256dh: "x", auth: "y" } } as PushSubscription,
        createTestSubscription(3),
      ];

      const result = await client.sendBatch(subscriptions, createTestPayload());

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);

      client.stop();
    });
  });

  describe("Integration: Client with Manager", () => {
    it("should work together seamlessly", async () => {
      // Setup
      const config = createTestConfig();
      const client = createPushClient(config);
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // Subscribe users
      const sub1 = createTestSubscription(1);
      const sub2 = createTestSubscription(2);
      await manager.subscribe(sub1, "user1");
      await manager.subscribe(sub2, "user2");

      // Get active subscriptions
      const activeSubscriptions = await manager.getActiveSubscriptions();
      expect(activeSubscriptions.length).toBe(2);

      // Send to all active subscribers
      const payload = createTestPayload("Market Update", "New activity detected");
      const result = await client.sendBatch(activeSubscriptions, payload);

      // Record results
      for (const sendResult of result.results) {
        if (sendResult.status === PushNotificationStatus.SENT) {
          await manager.recordSuccess(sendResult.endpoint);
        } else if (sendResult.subscriptionExpired) {
          await manager.recordFailure(sendResult.endpoint, true);
        } else {
          await manager.recordFailure(sendResult.endpoint);
        }
      }

      // Verify stats
      expect(result.sent).toBe(2);
      expect(client.getStats().sent).toBe(2);

      client.stop();
    });

    it("should handle expired subscriptions from batch results", async () => {
      const config = createTestConfig();
      const client = createPushClient(config);
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);

      // Subscribe
      const sub = createTestSubscription();
      await manager.subscribe(sub);

      // Send notification
      const result = await client.send(sub, createTestPayload());

      // Simulate handling expired subscription (in dev mode, none expire)
      if (result.subscriptionExpired) {
        await manager.markExpired(sub.endpoint);
      }

      // Verify subscription is still active (since dev mode doesn't expire)
      expect(await manager.isActive(sub.endpoint)).toBe(true);

      client.stop();
    });
  });

  describe("Base64url Encoding", () => {
    it("should roundtrip encode/decode correctly", () => {
      const testData = Buffer.from("Hello, Web Push!");
      const encoded = base64urlEncode(testData);
      const decoded = base64urlDecode(encoded);

      expect(decoded.equals(testData)).toBe(true);
    });

    it("should handle binary data with special characters", () => {
      // Create buffer with bytes that produce + and / in base64
      const binaryData = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        binaryData[i] = i * 8; // This should produce various base64 chars
      }

      const encoded = base64urlEncode(binaryData);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");

      const decoded = base64urlDecode(encoded);
      expect(decoded.equals(binaryData)).toBe(true);
    });
  });
});

describe("E2E: Alert Notification Scenarios", () => {
  beforeEach(() => {
    resetPushClient();
    resetVapidKeys();
    resetStorage();
  });

  afterEach(() => {
    resetPushClient();
    resetVapidKeys();
    resetStorage();
  });

  it("should send whale trade alert notification", async () => {
    const config = createTestConfig();
    const client = createPushClient(config);
    const manager = createSubscriptionManager(createInMemoryStorage());

    // User subscribes to alerts
    const sub = createTestSubscription();
    await manager.subscribe(sub, "whale-watcher-1");

    // Send whale alert
    const payload: PushNotificationPayload = {
      title: "Whale Trade Detected",
      body: "$1,250,000 trade on 'Will Trump win 2024?' market",
      icon: "https://polymarket.com/whale-icon.png",
      tag: "whale-trade-0x1234",
      requireInteraction: true,
      url: "https://polymarket.com/event/trump-2024",
      data: {
        alertType: "whale_trade",
        marketId: "trump-2024",
        tradeSize: 1250000,
        walletAddress: "0x1234...5678",
        outcome: "Yes",
        timestamp: Date.now(),
      },
    };

    const result = await client.send(sub, payload);
    expect(result.status).toBe(PushNotificationStatus.SENT);

    client.stop();
  });

  it("should send insider activity alert notification", async () => {
    const config = createTestConfig();
    const client = createPushClient(config);
    const manager = createSubscriptionManager(createInMemoryStorage());

    // User subscribes
    const sub = createTestSubscription();
    await manager.subscribe(sub, "insider-tracker-1");

    // Send insider alert
    const payload: PushNotificationPayload = {
      title: "Potential Insider Activity",
      body: "Fresh wallet made $50,000 bet on regulatory decision market",
      icon: "https://polymarket.com/alert-icon.png",
      tag: "insider-alert-123",
      requireInteraction: true,
      url: "https://polymarket.com/event/sec-decision",
      actions: [
        { action: "investigate", title: "View Details" },
        { action: "track-wallet", title: "Track Wallet" },
      ],
      data: {
        alertType: "insider_activity",
        suspicionScore: 87,
        walletAge: "2 days",
        tradeSize: 50000,
      },
    };

    const result = await client.send(sub, payload);
    expect(result.status).toBe(PushNotificationStatus.SENT);

    client.stop();
  });

  it("should broadcast market resolved notification to all subscribers", async () => {
    const config = createTestConfig();
    const client = createPushClient(config);
    const manager = createSubscriptionManager(createInMemoryStorage());

    // Multiple users subscribe
    const subs: PushSubscription[] = [];
    for (let i = 0; i < 10; i++) {
      const sub = createTestSubscription(i);
      await manager.subscribe(sub, `user${i}`);
      subs.push(sub);
    }

    // Market resolved - notify all
    const payload: PushNotificationPayload = {
      title: "Market Resolved",
      body: "'Will ETH hit $5000 by Dec 2024?' resolved to YES",
      icon: "https://polymarket.com/resolved-icon.png",
      tag: "market-resolved-eth5k",
      data: {
        alertType: "market_resolved",
        marketId: "eth-5000",
        outcome: "Yes",
        winningProbability: 0.62,
      },
    };

    const result = await client.sendBatch(subs, payload, { concurrency: 5 });
    expect(result.total).toBe(10);
    expect(result.sent).toBe(10);

    client.stop();
  });
});
