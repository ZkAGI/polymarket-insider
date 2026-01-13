/**
 * Unit tests for push notification subscription storage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryPushStorage,
  PushSubscriptionManager,
  StorageError,
  getDefaultStorage,
  getSubscriptionManager,
  resetStorage,
  createInMemoryStorage,
  createSubscriptionManager,
  PushSubscriptionState,
  generateSubscriptionId,
  type PushSubscription,
  type PushSubscriptionRecord,
} from "../../../src/notifications/push";

// Helper to create a valid subscription
function createValidSubscription(endpoint?: string): PushSubscription {
  return {
    endpoint:
      endpoint || `https://fcm.googleapis.com/fcm/send/${Math.random().toString(36)}`,
    keys: {
      p256dh:
        "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
      auth: "4vQK-SvRAN5eo-8ASlrwSg",
    },
  };
}

// Helper to create a subscription record
function createSubscriptionRecord(
  subscription?: PushSubscription,
  overrides?: Partial<PushSubscriptionRecord>
): PushSubscriptionRecord {
  const sub = subscription || createValidSubscription();
  return {
    id: generateSubscriptionId(sub.endpoint),
    subscription: sub,
    state: PushSubscriptionState.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    failedAttempts: 0,
    ...overrides,
  };
}

describe("InMemoryPushStorage", () => {
  let storage: InMemoryPushStorage;

  beforeEach(() => {
    storage = new InMemoryPushStorage();
  });

  describe("save", () => {
    it("should save a subscription", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      const retrieved = await storage.getById(record.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(record.id);
    });

    it("should replace existing subscription with same endpoint", async () => {
      const sub = createValidSubscription("https://fcm.googleapis.com/same");
      const record1 = createSubscriptionRecord(sub, { id: "id1" });
      const record2 = createSubscriptionRecord(sub, { id: "id2" });

      await storage.save(record1);
      await storage.save(record2);

      const count = await storage.getActiveCount();
      expect(count).toBe(1);

      const retrieved = await storage.getByEndpoint(sub.endpoint);
      expect(retrieved!.id).toBe("id2");
    });

    it("should update endpoint index", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      const byEndpoint = await storage.getByEndpoint(
        record.subscription.endpoint
      );
      expect(byEndpoint).not.toBeNull();
      expect(byEndpoint!.id).toBe(record.id);
    });

    it("should update user index", async () => {
      const record = createSubscriptionRecord(undefined, { userId: "user123" });
      await storage.save(record);

      const byUser = await storage.getByUserId("user123");
      expect(byUser.length).toBe(1);
      expect(byUser[0]!.id).toBe(record.id);
    });
  });

  describe("getById", () => {
    it("should return subscription by ID", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      const retrieved = await storage.getById(record.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.subscription.endpoint).toBe(record.subscription.endpoint);
    });

    it("should return null for non-existent ID", async () => {
      const retrieved = await storage.getById("non-existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("getByEndpoint", () => {
    it("should return subscription by endpoint", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      const retrieved = await storage.getByEndpoint(record.subscription.endpoint);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(record.id);
    });

    it("should return null for non-existent endpoint", async () => {
      const retrieved = await storage.getByEndpoint("https://non-existent.com");
      expect(retrieved).toBeNull();
    });
  });

  describe("getByUserId", () => {
    it("should return all subscriptions for a user", async () => {
      const record1 = createSubscriptionRecord(undefined, { userId: "user1" });
      const record2 = createSubscriptionRecord(undefined, { userId: "user1" });
      const record3 = createSubscriptionRecord(undefined, { userId: "user2" });

      await storage.save(record1);
      await storage.save(record2);
      await storage.save(record3);

      const user1Subs = await storage.getByUserId("user1");
      expect(user1Subs.length).toBe(2);

      const user2Subs = await storage.getByUserId("user2");
      expect(user2Subs.length).toBe(1);
    });

    it("should return empty array for non-existent user", async () => {
      const subs = await storage.getByUserId("non-existent");
      expect(subs).toEqual([]);
    });
  });

  describe("getAllActive", () => {
    it("should return only active subscriptions", async () => {
      const activeRecord = createSubscriptionRecord();
      const expiredRecord = createSubscriptionRecord(undefined, {
        state: PushSubscriptionState.EXPIRED,
      });

      await storage.save(activeRecord);
      await storage.save(expiredRecord);

      const active = await storage.getAllActive();
      expect(active.length).toBe(1);
      expect(active[0]!.state).toBe(PushSubscriptionState.ACTIVE);
    });
  });

  describe("update", () => {
    it("should update subscription fields", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      await storage.update(record.id, { failedAttempts: 5 });

      const retrieved = await storage.getById(record.id);
      expect(retrieved!.failedAttempts).toBe(5);
    });

    it("should update timestamp", async () => {
      const record = createSubscriptionRecord();
      const originalUpdatedAt = record.updatedAt;
      await storage.save(record);

      // Wait a bit to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await storage.update(record.id, { failedAttempts: 1 });

      const retrieved = await storage.getById(record.id);
      expect(retrieved!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it("should throw error for non-existent subscription", async () => {
      await expect(
        storage.update("non-existent", { failedAttempts: 1 })
      ).rejects.toThrow(StorageError);
    });

    it("should not allow ID change", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      await storage.update(record.id, { id: "new-id" } as any);

      // ID should remain unchanged
      const retrieved = await storage.getById(record.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(record.id);

      // New ID should not exist
      const newIdRetrieved = await storage.getById("new-id");
      expect(newIdRetrieved).toBeNull();
    });

    it("should update endpoint index on endpoint change", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      const newEndpoint = "https://fcm.googleapis.com/new-endpoint";
      const newSub = { ...record.subscription, endpoint: newEndpoint };
      await storage.update(record.id, { subscription: newSub });

      // Old endpoint should no longer find it
      const oldEndpointResult = await storage.getByEndpoint(
        record.subscription.endpoint
      );
      expect(oldEndpointResult).toBeNull();

      // New endpoint should find it
      const newEndpointResult = await storage.getByEndpoint(newEndpoint);
      expect(newEndpointResult).not.toBeNull();
    });

    it("should update user index on user change", async () => {
      const record = createSubscriptionRecord(undefined, { userId: "user1" });
      await storage.save(record);

      await storage.update(record.id, { userId: "user2" });

      // Old user should not have it
      const user1Subs = await storage.getByUserId("user1");
      expect(user1Subs.length).toBe(0);

      // New user should have it
      const user2Subs = await storage.getByUserId("user2");
      expect(user2Subs.length).toBe(1);
    });
  });

  describe("delete", () => {
    it("should delete subscription by ID", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      await storage.delete(record.id);

      const retrieved = await storage.getById(record.id);
      expect(retrieved).toBeNull();
    });

    it("should clean up indexes on delete", async () => {
      const record = createSubscriptionRecord(undefined, { userId: "user1" });
      await storage.save(record);

      await storage.delete(record.id);

      // Endpoint index should be cleared
      const byEndpoint = await storage.getByEndpoint(record.subscription.endpoint);
      expect(byEndpoint).toBeNull();

      // User index should be cleared
      const byUser = await storage.getByUserId("user1");
      expect(byUser.length).toBe(0);
    });

    it("should do nothing for non-existent ID", async () => {
      await expect(storage.delete("non-existent")).resolves.not.toThrow();
    });
  });

  describe("deleteByEndpoint", () => {
    it("should delete subscription by endpoint", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      await storage.deleteByEndpoint(record.subscription.endpoint);

      const retrieved = await storage.getById(record.id);
      expect(retrieved).toBeNull();
    });

    it("should do nothing for non-existent endpoint", async () => {
      await expect(
        storage.deleteByEndpoint("https://non-existent.com")
      ).resolves.not.toThrow();
    });
  });

  describe("markExpired", () => {
    it("should mark subscription as expired", async () => {
      const record = createSubscriptionRecord();
      await storage.save(record);

      await storage.markExpired(record.id);

      const retrieved = await storage.getById(record.id);
      expect(retrieved!.state).toBe(PushSubscriptionState.EXPIRED);
    });
  });

  describe("getActiveCount", () => {
    it("should return count of active subscriptions", async () => {
      await storage.save(createSubscriptionRecord());
      await storage.save(createSubscriptionRecord());
      await storage.save(
        createSubscriptionRecord(undefined, {
          state: PushSubscriptionState.EXPIRED,
        })
      );

      const count = await storage.getActiveCount();
      expect(count).toBe(2);
    });

    it("should return 0 for empty storage", async () => {
      const count = await storage.getActiveCount();
      expect(count).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should remove expired subscriptions", async () => {
      const active = createSubscriptionRecord();
      const expired = createSubscriptionRecord(undefined, {
        state: PushSubscriptionState.EXPIRED,
      });

      await storage.save(active);
      await storage.save(expired);

      const removed = await storage.cleanup(30);

      expect(removed).toBe(1);
      const count = await storage.getActiveCount();
      expect(count).toBe(1);
    });

    it("should remove invalid subscriptions", async () => {
      const invalid = createSubscriptionRecord(undefined, {
        state: PushSubscriptionState.INVALID,
      });

      await storage.save(invalid);

      const removed = await storage.cleanup(30);

      expect(removed).toBe(1);
    });

    it("should return count of removed subscriptions", async () => {
      await storage.save(
        createSubscriptionRecord(undefined, {
          state: PushSubscriptionState.EXPIRED,
        })
      );
      await storage.save(
        createSubscriptionRecord(undefined, {
          state: PushSubscriptionState.INVALID,
        })
      );

      const removed = await storage.cleanup(30);

      expect(removed).toBe(2);
    });
  });

  describe("getAll", () => {
    it("should return all subscriptions", async () => {
      await storage.save(createSubscriptionRecord());
      await storage.save(createSubscriptionRecord());
      await storage.save(
        createSubscriptionRecord(undefined, {
          state: PushSubscriptionState.EXPIRED,
        })
      );

      const all = await storage.getAll();
      expect(all.length).toBe(3);
    });
  });

  describe("getTotalCount", () => {
    it("should return total count including inactive", async () => {
      await storage.save(createSubscriptionRecord());
      await storage.save(
        createSubscriptionRecord(undefined, {
          state: PushSubscriptionState.EXPIRED,
        })
      );

      const count = await storage.getTotalCount();
      expect(count).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all subscriptions", async () => {
      await storage.save(createSubscriptionRecord());
      await storage.save(createSubscriptionRecord());

      await storage.clear();

      const count = await storage.getTotalCount();
      expect(count).toBe(0);
    });
  });
});

describe("PushSubscriptionManager", () => {
  let storage: InMemoryPushStorage;
  let manager: PushSubscriptionManager;

  beforeEach(() => {
    storage = new InMemoryPushStorage();
    manager = new PushSubscriptionManager(storage);
  });

  describe("subscribe", () => {
    it("should create new subscription", async () => {
      const sub = createValidSubscription();
      const record = await manager.subscribe(sub);

      expect(record.subscription).toEqual(sub);
      expect(record.state).toBe(PushSubscriptionState.ACTIVE);
    });

    it("should associate with userId", async () => {
      const sub = createValidSubscription();
      const record = await manager.subscribe(sub, "user123");

      expect(record.userId).toBe("user123");
    });

    it("should store metadata", async () => {
      const sub = createValidSubscription();
      const metadata = { device: "mobile", browser: "chrome" };
      const record = await manager.subscribe(sub, undefined, metadata);

      expect(record.metadata).toEqual(metadata);
    });

    it("should update existing subscription", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub, "user1");
      const updated = await manager.subscribe(sub, "user2");

      expect(updated.userId).toBe("user2");

      // Should not create duplicate
      const count = await storage.getActiveCount();
      expect(count).toBe(1);
    });
  });

  describe("unsubscribe", () => {
    it("should mark subscription as unsubscribed", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      await manager.unsubscribe(sub.endpoint);

      const isActive = await manager.isActive(sub.endpoint);
      expect(isActive).toBe(false);
    });

    it("should do nothing for non-existent endpoint", async () => {
      await expect(
        manager.unsubscribe("https://non-existent.com")
      ).resolves.not.toThrow();
    });
  });

  describe("unsubscribeUser", () => {
    it("should unsubscribe all user subscriptions", async () => {
      const sub1 = createValidSubscription();
      const sub2 = createValidSubscription();
      await manager.subscribe(sub1, "user1");
      await manager.subscribe(sub2, "user1");

      await manager.unsubscribeUser("user1");

      const isActive1 = await manager.isActive(sub1.endpoint);
      const isActive2 = await manager.isActive(sub2.endpoint);
      expect(isActive1).toBe(false);
      expect(isActive2).toBe(false);
    });
  });

  describe("markExpired", () => {
    it("should mark subscription as expired", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      await manager.markExpired(sub.endpoint);

      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.state).toBe(PushSubscriptionState.EXPIRED);
    });
  });

  describe("recordSuccess", () => {
    it("should update lastNotificationAt and reset failures", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      // Record a failure first
      await manager.recordFailure(sub.endpoint);

      // Then success
      await manager.recordSuccess(sub.endpoint);

      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.failedAttempts).toBe(0);
      expect(record!.lastNotificationAt).toBeDefined();
    });
  });

  describe("recordFailure", () => {
    it("should increment failedAttempts", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      await manager.recordFailure(sub.endpoint);

      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.failedAttempts).toBe(1);
    });

    it("should mark as invalid after multiple failures", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      await manager.recordFailure(sub.endpoint);
      await manager.recordFailure(sub.endpoint);
      await manager.recordFailure(sub.endpoint);

      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.state).toBe(PushSubscriptionState.INVALID);
    });

    it("should mark as expired when expired flag is true", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      await manager.recordFailure(sub.endpoint, true);

      const record = await storage.getByEndpoint(sub.endpoint);
      expect(record!.state).toBe(PushSubscriptionState.EXPIRED);
    });
  });

  describe("getActiveSubscriptions", () => {
    it("should return all active subscriptions", async () => {
      const sub1 = createValidSubscription();
      const sub2 = createValidSubscription();
      await manager.subscribe(sub1);
      await manager.subscribe(sub2);
      await manager.unsubscribe(sub2.endpoint);

      const active = await manager.getActiveSubscriptions();

      expect(active.length).toBe(1);
      expect(active[0]!.endpoint).toBe(sub1.endpoint);
    });
  });

  describe("getUserSubscriptions", () => {
    it("should return active subscriptions for user", async () => {
      const sub1 = createValidSubscription();
      const sub2 = createValidSubscription();
      await manager.subscribe(sub1, "user1");
      await manager.subscribe(sub2, "user1");
      await manager.unsubscribe(sub2.endpoint);

      const subs = await manager.getUserSubscriptions("user1");

      expect(subs.length).toBe(1);
    });
  });

  describe("isActive", () => {
    it("should return true for active subscription", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);

      const isActive = await manager.isActive(sub.endpoint);

      expect(isActive).toBe(true);
    });

    it("should return false for unsubscribed", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);
      await manager.unsubscribe(sub.endpoint);

      const isActive = await manager.isActive(sub.endpoint);

      expect(isActive).toBe(false);
    });

    it("should return false for non-existent", async () => {
      const isActive = await manager.isActive("https://non-existent.com");

      expect(isActive).toBe(false);
    });
  });

  describe("getActiveCount", () => {
    it("should return count of active subscriptions", async () => {
      await manager.subscribe(createValidSubscription());
      await manager.subscribe(createValidSubscription());

      const count = await manager.getActiveCount();

      expect(count).toBe(2);
    });
  });

  describe("cleanup", () => {
    it("should clean up old subscriptions", async () => {
      const sub = createValidSubscription();
      await manager.subscribe(sub);
      await manager.markExpired(sub.endpoint);

      const removed = await manager.cleanup(30);

      expect(removed).toBe(1);
    });
  });

  describe("getStorage", () => {
    it("should return the underlying storage", () => {
      const storageRef = manager.getStorage();
      expect(storageRef).toBe(storage);
    });
  });
});

describe("StorageError", () => {
  it("should have correct name", () => {
    const error = new StorageError("test", "TEST_CODE");
    expect(error.name).toBe("StorageError");
  });

  it("should have correct message and code", () => {
    const error = new StorageError("test message", "TEST_CODE");
    expect(error.message).toBe("test message");
    expect(error.code).toBe("TEST_CODE");
  });
});

describe("Singleton Functions", () => {
  beforeEach(() => {
    resetStorage();
  });

  afterEach(() => {
    resetStorage();
  });

  describe("getDefaultStorage", () => {
    it("should return same instance", () => {
      const storage1 = getDefaultStorage();
      const storage2 = getDefaultStorage();
      expect(storage1).toBe(storage2);
    });
  });

  describe("getSubscriptionManager", () => {
    it("should return manager with default storage", () => {
      const manager = getSubscriptionManager();
      expect(manager).toBeInstanceOf(PushSubscriptionManager);
    });

    it("should return same instance", () => {
      const manager1 = getSubscriptionManager();
      const manager2 = getSubscriptionManager();
      expect(manager1).toBe(manager2);
    });

    it("should accept custom storage", () => {
      const customStorage = new InMemoryPushStorage();
      const manager = getSubscriptionManager(customStorage);
      expect(manager.getStorage()).toBe(customStorage);
    });
  });

  describe("resetStorage", () => {
    it("should reset all singleton instances", async () => {
      const storage = getDefaultStorage();
      await storage.save(createSubscriptionRecord());

      resetStorage();

      const newStorage = getDefaultStorage();
      const count = await newStorage.getTotalCount();
      expect(count).toBe(0);
    });
  });

  describe("createInMemoryStorage", () => {
    it("should create new instance", () => {
      const storage1 = createInMemoryStorage();
      const storage2 = createInMemoryStorage();
      expect(storage1).not.toBe(storage2);
    });
  });

  describe("createSubscriptionManager", () => {
    it("should create manager with given storage", () => {
      const storage = createInMemoryStorage();
      const manager = createSubscriptionManager(storage);
      expect(manager.getStorage()).toBe(storage);
    });
  });
});
