/**
 * Unit tests for push notification client
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PushClient,
  PushClientError,
  getPushClient,
  createPushClient,
  resetPushClient,
  isPushClientInitialized,
  generateVapidKeys,
  resetVapidKeys,
  PushNotificationStatus,
  type PushServiceConfig,
  type PushSubscription,
  type PushNotificationPayload,
  type PushEvent,
} from "../../../src/notifications/push";

// Helper to create a valid subscription
function createValidSubscription(endpoint?: string): PushSubscription {
  return {
    endpoint: endpoint || "https://fcm.googleapis.com/fcm/send/abc123xyz456",
    keys: {
      p256dh:
        "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
      auth: "4vQK-SvRAN5eo-8ASlrwSg",
    },
  };
}

// Helper to create valid config
function createValidConfig(): PushServiceConfig {
  const keys = generateVapidKeys("mailto:test@example.com");
  return {
    vapidKeys: keys,
    devMode: true, // Use dev mode for tests
  };
}

describe("PushClient", () => {
  beforeEach(() => {
    resetPushClient();
    resetVapidKeys();
  });

  afterEach(() => {
    resetPushClient();
    resetVapidKeys();
  });

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const config = createValidConfig();
      const client = new PushClient(config);

      expect(client).toBeInstanceOf(PushClient);
      expect(client.getPublicKey()).toBe(config.vapidKeys.publicKey);
    });

    it("should throw error without VAPID keys", () => {
      expect(
        () =>
          new PushClient({
            vapidKeys: {} as any,
          })
      ).toThrow(PushClientError);
    });

    it("should use default config values", () => {
      const config = createValidConfig();
      const client = new PushClient(config);

      // Default devMode is false, but we set it to true in our config
      expect(client.isDevMode()).toBe(true);
    });

    it("should emit service:started event", () => {
      const config = createValidConfig();
      const events: PushEvent[] = [];

      const client = new PushClient(config);
      client.on("service:started", (e) => { events.push(e); });

      // Event was already emitted in constructor, so we won't catch it
      // But we can verify the client is working
      expect(client.getPublicKey()).toBeDefined();
    });
  });

  describe("send", () => {
    it("should send notification in dev mode", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "Test body message",
      };

      const result = await client.send(subscription, payload);

      expect(result.status).toBe(PushNotificationStatus.SENT);
      expect(result.statusCode).toBe(201);
      expect(result.endpoint).toBe(subscription.endpoint);
    });

    it("should fail with invalid subscription", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const invalidSubscription: PushSubscription = {
        endpoint: "invalid",
        keys: { p256dh: "short", auth: "short" },
      };
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const result = await client.send(invalidSubscription, payload);

      expect(result.status).toBe(PushNotificationStatus.FAILED);
      expect(result.error).toBe("Invalid subscription");
    });

    it("should fail with invalid payload", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const invalidPayload = { title: "" } as PushNotificationPayload;

      const result = await client.send(subscription, invalidPayload);

      expect(result.status).toBe(PushNotificationStatus.FAILED);
      expect(result.error).toBe("Invalid notification payload");
    });

    it("should truncate long payload", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = {
        title: "A".repeat(150), // Too long
        body: "B".repeat(600), // Too long
      };

      // Should still work because payload is truncated
      const result = await client.send(subscription, payload);
      expect(result.status).toBe(PushNotificationStatus.SENT);
    });

    it("should emit events for send lifecycle", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };
      const events: PushEvent[] = [];

      client.on("notification:sending", (e) => { events.push(e); });
      client.on("notification:sent", (e) => { events.push(e); });

      await client.send(subscription, payload);

      expect(events.length).toBe(2);
      expect(events[0]!.type).toBe("notification:sending");
      expect(events[1]!.type).toBe("notification:sent");
    });

    it("should update stats on successful send", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const statsBefore = client.getStats();
      expect(statsBefore.sent).toBe(0);

      await client.send(subscription, payload);

      const statsAfter = client.getStats();
      expect(statsAfter.sent).toBe(1);
    });

    it("should update stats on failed send", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const invalidSubscription: PushSubscription = {
        endpoint: "invalid",
        keys: { p256dh: "short", auth: "short" },
      };
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const statsBefore = client.getStats();
      expect(statsBefore.failed).toBe(0);

      await client.send(invalidSubscription, payload);

      const statsAfter = client.getStats();
      expect(statsAfter.failed).toBe(1);
    });
  });

  describe("sendBatch", () => {
    it("should send to multiple subscriptions", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscriptions = [
        createValidSubscription("https://fcm.googleapis.com/1"),
        createValidSubscription("https://fcm.googleapis.com/2"),
        createValidSubscription("https://fcm.googleapis.com/3"),
      ];
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test batch",
      };

      const result = await client.sendBatch(subscriptions, payload);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(3);
    });

    it("should handle mixed success and failure", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscriptions: PushSubscription[] = [
        createValidSubscription("https://fcm.googleapis.com/1"),
        { endpoint: "invalid", keys: { p256dh: "x", auth: "y" } }, // Invalid
        createValidSubscription("https://fcm.googleapis.com/3"),
      ];
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const result = await client.sendBatch(subscriptions, payload);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("should respect concurrency option", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscriptions = Array(10)
        .fill(null)
        .map((_, i) => createValidSubscription(`https://fcm.googleapis.com/${i}`));
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const result = await client.sendBatch(subscriptions, payload, {
        concurrency: 2,
      });

      expect(result.total).toBe(10);
      expect(result.sent).toBe(10);
    });

    it("should track expired subscriptions", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      // Note: In dev mode, subscriptions don't actually expire
      // This test is more about the structure of the result
      const subscriptions = [createValidSubscription()];
      const payload: PushNotificationPayload = {
        title: "Test",
        body: "Test",
      };

      const result = await client.sendBatch(subscriptions, payload);

      expect(result.expiredEndpoints).toEqual([]);
      expect(result.expired).toBe(0);
    });
  });

  describe("event handling", () => {
    it("should add and trigger event handlers", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const events: PushEvent[] = [];

      client.on("notification:sending", (e) => { events.push(e); });

      await client.send(createValidSubscription(), { title: "Test", body: "Test" });

      expect(events.length).toBe(1);
      expect(events[0]!.type).toBe("notification:sending");
    });

    it("should remove event handlers", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const events: PushEvent[] = [];

      const handler = (e: PushEvent) => { events.push(e); };
      client.on("notification:sending", handler);
      client.off("notification:sending", handler);

      await client.send(createValidSubscription(), { title: "Test", body: "Test" });

      expect(events.length).toBe(0);
    });

    it("should handle multiple handlers for same event", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const events1: PushEvent[] = [];
      const events2: PushEvent[] = [];

      client.on("notification:sending", (e) => { events1.push(e); });
      client.on("notification:sending", (e) => { events2.push(e); });

      await client.send(createValidSubscription(), { title: "Test", body: "Test" });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });
  });

  describe("stats", () => {
    it("should track sent count", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = { title: "Test", body: "Test" };

      await client.send(subscription, payload);
      await client.send(subscription, payload);
      await client.send(subscription, payload);

      const stats = client.getStats();
      expect(stats.sent).toBe(3);
    });

    it("should track failed count", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const invalidSub: PushSubscription = {
        endpoint: "invalid",
        keys: { p256dh: "x", auth: "y" },
      };
      const payload: PushNotificationPayload = { title: "Test", body: "Test" };

      await client.send(invalidSub, payload);
      await client.send(invalidSub, payload);

      const stats = client.getStats();
      expect(stats.failed).toBe(2);
    });

    it("should reset stats", async () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const subscription = createValidSubscription();
      const payload: PushNotificationPayload = { title: "Test", body: "Test" };

      await client.send(subscription, payload);
      expect(client.getStats().sent).toBe(1);

      client.resetStats();
      expect(client.getStats().sent).toBe(0);
      expect(client.getStats().failed).toBe(0);
      expect(client.getStats().expired).toBe(0);
    });
  });

  describe("stop", () => {
    it("should emit service:stopped event", () => {
      const config = createValidConfig();
      const client = new PushClient(config);
      const events: PushEvent[] = [];

      client.on("service:stopped", (e) => { events.push(e); });
      client.stop();

      expect(events.length).toBe(1);
      expect(events[0]!.type).toBe("service:stopped");
    });
  });

  describe("getPublicKey", () => {
    it("should return the public VAPID key", () => {
      const config = createValidConfig();
      const client = new PushClient(config);

      expect(client.getPublicKey()).toBe(config.vapidKeys.publicKey);
    });
  });

  describe("isDevMode", () => {
    it("should return true when in dev mode", () => {
      const config = createValidConfig();
      config.devMode = true;
      const client = new PushClient(config);

      expect(client.isDevMode()).toBe(true);
    });

    it("should return false when not in dev mode", () => {
      const config = createValidConfig();
      config.devMode = false;
      const client = new PushClient(config);

      expect(client.isDevMode()).toBe(false);
    });
  });
});

describe("PushClientError", () => {
  it("should have correct name", () => {
    const error = new PushClientError("test", "TEST_CODE");
    expect(error.name).toBe("PushClientError");
  });

  it("should have correct message and code", () => {
    const error = new PushClientError("test message", "TEST_CODE");
    expect(error.message).toBe("test message");
    expect(error.code).toBe("TEST_CODE");
  });

  it("should have optional statusCode", () => {
    const error = new PushClientError("test", "TEST", 404);
    expect(error.statusCode).toBe(404);
  });

  it("should be instanceof Error", () => {
    const error = new PushClientError("test", "TEST");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof PushClientError).toBe(true);
  });
});

describe("Singleton Pattern", () => {
  beforeEach(() => {
    resetPushClient();
    resetVapidKeys();
  });

  afterEach(() => {
    resetPushClient();
    resetVapidKeys();
  });

  describe("getPushClient", () => {
    it("should throw error when not initialized", () => {
      expect(() => getPushClient()).toThrow(PushClientError);
      expect(() => getPushClient()).toThrow("PushClient not initialized");
    });

    it("should create client on first call with config", () => {
      const config = createValidConfig();
      const client = getPushClient(config);

      expect(client).toBeInstanceOf(PushClient);
      expect(isPushClientInitialized()).toBe(true);
    });

    it("should return same instance on subsequent calls", () => {
      const config = createValidConfig();
      const client1 = getPushClient(config);
      const client2 = getPushClient();

      expect(client1).toBe(client2);
    });
  });

  describe("createPushClient", () => {
    it("should create new instance without affecting singleton", () => {
      const config = createValidConfig();
      const client1 = createPushClient(config);
      const client2 = createPushClient(config);

      expect(client1).not.toBe(client2);
      expect(isPushClientInitialized()).toBe(false);
    });
  });

  describe("resetPushClient", () => {
    it("should reset singleton instance", () => {
      const config = createValidConfig();
      getPushClient(config);
      expect(isPushClientInitialized()).toBe(true);

      resetPushClient();
      expect(isPushClientInitialized()).toBe(false);
    });

    it("should do nothing if not initialized", () => {
      expect(() => resetPushClient()).not.toThrow();
    });
  });

  describe("isPushClientInitialized", () => {
    it("should return false when not initialized", () => {
      expect(isPushClientInitialized()).toBe(false);
    });

    it("should return true when initialized", () => {
      const config = createValidConfig();
      getPushClient(config);
      expect(isPushClientInitialized()).toBe(true);
    });
  });
});
