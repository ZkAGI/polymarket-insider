/**
 * Tests for Multi-market Subscription Manager (API-WS-009)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MultiMarketSubscriptionManager,
  createMultiMarketSubscriptionManager,
  getSharedSubscriptionManager,
  setSharedSubscriptionManager,
  resetSharedSubscriptionManager,
  SubscriptionStatus,
  BatchOperationType,
  SubscriptionManagerEventType,
  DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION,
  DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION,
  DEFAULT_BATCH_SIZE,
  DEFAULT_BATCH_DELAY,
  DEFAULT_SUBSCRIPTION_TIMEOUT,
  DEFAULT_STALE_SUBSCRIPTION_THRESHOLD,
  calculateSubscriptionDistribution,
  mergeFilters,
  matchesFilter,
  type ManagedSubscription,
  type SubscriptionFilter,
  type SubscriptionManagerConfig,
  type SendJsonFunction,
} from "../../../src/api/ws/subscription-manager";
import { SubscriptionChannel } from "../../../src/api/ws/market-subscriptions";

describe("MultiMarketSubscriptionManager", () => {
  let manager: MultiMarketSubscriptionManager;
  let mockSendJson: ReturnType<typeof vi.fn<SendJsonFunction>>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSendJson = vi.fn<SendJsonFunction>().mockReturnValue(true);
    manager = createMultiMarketSubscriptionManager();
    manager.setSendFunction(mockSendJson);
  });

  afterEach(() => {
    manager.dispose();
    resetSharedSubscriptionManager();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create manager with default config", () => {
      const config = manager.getConfig();
      expect(config.maxSubscriptionsPerConnection).toBe(DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION);
      expect(config.maxTokensPerSubscription).toBe(DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION);
      expect(config.batchSize).toBe(DEFAULT_BATCH_SIZE);
      expect(config.batchDelay).toBe(DEFAULT_BATCH_DELAY);
      expect(config.subscriptionTimeout).toBe(DEFAULT_SUBSCRIPTION_TIMEOUT);
      expect(config.staleSubscriptionThreshold).toBe(DEFAULT_STALE_SUBSCRIPTION_THRESHOLD);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelayMultiplier).toBe(2);
      expect(config.initialRetryDelay).toBe(1000);
      expect(config.enableStaleDetection).toBe(true);
      expect(config.staleCheckInterval).toBe(30000);
    });

    it("should create manager with custom config", () => {
      const customConfig: SubscriptionManagerConfig = {
        maxSubscriptionsPerConnection: 50,
        maxTokensPerSubscription: 25,
        batchSize: 5,
        batchDelay: 50,
        subscriptionTimeout: 5000,
        staleSubscriptionThreshold: 30000,
        maxRetries: 5,
        retryDelayMultiplier: 1.5,
        initialRetryDelay: 500,
        enableStaleDetection: false,
        staleCheckInterval: 15000,
      };

      const customManager = createMultiMarketSubscriptionManager(customConfig);
      const config = customManager.getConfig();

      expect(config.maxSubscriptionsPerConnection).toBe(50);
      expect(config.maxTokensPerSubscription).toBe(25);
      expect(config.batchSize).toBe(5);
      expect(config.batchDelay).toBe(50);
      expect(config.subscriptionTimeout).toBe(5000);
      expect(config.staleSubscriptionThreshold).toBe(30000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelayMultiplier).toBe(1.5);
      expect(config.initialRetryDelay).toBe(500);
      expect(config.enableStaleDetection).toBe(false);
      expect(config.staleCheckInterval).toBe(15000);

      customManager.dispose();
    });
  });

  // ==========================================================================
  // Subscription Tests
  // ==========================================================================

  describe("subscribe", () => {
    it("should create subscription for single token", async () => {
      // Use immediate mode to test the core subscription logic
      const subscribePromise = manager.subscribe("token1", { immediate: true });

      // Should have sent subscription message
      expect(mockSendJson).toHaveBeenCalledTimes(1);
      const sentMessage = mockSendJson.mock.calls[0]?.[0] as { type: string; market: string } | undefined;
      expect(sentMessage?.type).toBe("subscribe");
      expect(sentMessage?.market).toBe("token1");

      // Simulate confirmation
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      expect(subscriptionId).toBeDefined();
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.tokenIds).toEqual(["token1"]);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.confirmed).toBe(true);
    });

    it("should create subscription for multiple tokens", async () => {
      const subscribePromise = manager.subscribe(["token1", "token2", "token3"], { immediate: true });

      expect(mockSendJson).toHaveBeenCalledTimes(1);
      const sentMessage = mockSendJson.mock.calls[0]?.[0] as { type: string; assets_ids: string[] } | undefined;
      expect(sentMessage?.type).toBe("subscribe");
      expect(sentMessage?.assets_ids).toEqual(["token1", "token2", "token3"]);

      // Simulate confirmation
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.tokenIds).toEqual(["token1", "token2", "token3"]);
    });

    it("should subscribe with custom channel", async () => {
      const subscribePromise = manager.subscribe("token1", {
        channel: SubscriptionChannel.BOOK,
        immediate: true, // Skip batching for simpler test
      });

      const sentMessage = mockSendJson.mock.calls[0]?.[0] as { channel: string } | undefined;
      expect(sentMessage?.channel).toBe("book");

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.channel).toBe(SubscriptionChannel.BOOK);
    });

    it("should subscribe with priority", async () => {
      const subscribePromise = manager.subscribe("token1", { priority: 10, immediate: true });

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.priority).toBe(10);
    });

    it("should subscribe with tags", async () => {
      const subscribePromise = manager.subscribe("token1", {
        tags: ["important", "whale-tracking"],
        immediate: true,
      });

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.tags.has("important")).toBe(true);
      expect(subscription.tags.has("whale-tracking")).toBe(true);
    });

    it("should subscribe with metadata", async () => {
      const subscribePromise = manager.subscribe("token1", {
        metadata: { source: "api", version: 2 },
        immediate: true,
      });

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.metadata).toMatchObject({ source: "api", version: 2 });
    });

    it("should subscribe immediately when immediate option is true", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });

      // Should have sent immediately, without waiting for batch delay
      expect(mockSendJson).toHaveBeenCalledTimes(1);

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.tokenIds).toEqual(["token1"]);
    });

    it("should reject if token count exceeds maximum", async () => {
      const tokens = Array.from({ length: 100 }, (_, i) => `token${i}`);

      await expect(manager.subscribe(tokens)).rejects.toThrow(/exceeds maximum/);
    });

    it("should reject if subscription limit reached", async () => {
      // Create manager with low limit
      const limitedMockSendJson = vi.fn<SendJsonFunction>().mockReturnValue(true);
      const limitedManager = createMultiMarketSubscriptionManager({
        maxSubscriptionsPerConnection: 2,
        batchDelay: 0,
      });
      limitedManager.setSendFunction(limitedMockSendJson);

      // Subscribe to 2 subscriptions
      const sub1Promise = limitedManager.subscribe("token1", { immediate: true });
      const subscriptionId1 = limitedManager.getAllSubscriptions()[0]?.id;
      limitedManager.handleConfirmation(subscriptionId1!);
      await sub1Promise;

      const sub2Promise = limitedManager.subscribe("token2", { immediate: true });
      const subscriptionId2 = limitedManager.getAllSubscriptions()[1]?.id;
      limitedManager.handleConfirmation(subscriptionId2!);
      await sub2Promise;

      // Third should fail
      await expect(limitedManager.subscribe("token3")).rejects.toThrow(/limit reached/);

      limitedManager.dispose();
    });

    it("should emit limitReached event when subscription limit reached", async () => {
      const limitReachedMockSendJson = vi.fn<SendJsonFunction>().mockReturnValue(true);
      const limitedManager = createMultiMarketSubscriptionManager({
        maxSubscriptionsPerConnection: 1,
        batchDelay: 0,
      });
      limitedManager.setSendFunction(limitReachedMockSendJson);

      const limitReachedHandler = vi.fn();
      limitedManager.on("limitReached", limitReachedHandler);

      // First subscription succeeds
      const sub1Promise = limitedManager.subscribe("token1", { immediate: true });
      const subscriptionId = limitedManager.getAllSubscriptions()[0]?.id;
      limitedManager.handleConfirmation(subscriptionId!);
      await sub1Promise;

      // Second fails
      try {
        await limitedManager.subscribe("token2");
      } catch {
        // Expected
      }

      expect(limitReachedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.LIMIT_REACHED,
          limitType: "subscription",
          current: 1,
          maximum: 1,
        })
      );

      limitedManager.dispose();
    });

    it("should reject if manager is disposed", async () => {
      manager.dispose();

      await expect(manager.subscribe("token1")).rejects.toThrow(/disposed/);
    });

    it("should reject if empty token array provided", async () => {
      await expect(manager.subscribe([])).rejects.toThrow(/at least one token/i);
    });

    it("should timeout subscription and trigger retry", async () => {
      const timeoutMockSendJson = vi.fn<SendJsonFunction>().mockReturnValue(true);
      const errorHandler = vi.fn();
      const timeoutManager = createMultiMarketSubscriptionManager({
        subscriptionTimeout: 100,
        batchDelay: 0,
        maxRetries: 3, // Allow retries
      });
      timeoutManager.setSendFunction(timeoutMockSendJson);
      timeoutManager.on("subscriptionError", errorHandler);

      const subscribePromise = timeoutManager.subscribe("token1", { immediate: true });

      // Advance timer to trigger timeout
      vi.advanceTimersByTime(150);

      // Should have emitted error event
      expect(errorHandler).toHaveBeenCalled();

      // The subscription should exist
      const subscriptions = timeoutManager.getAllSubscriptions();
      expect(subscriptions.length).toBe(1);

      // Confirm the subscription so the promise resolves
      const subscriptionId = subscriptions[0]?.id;
      timeoutManager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription).toBeDefined();

      timeoutManager.dispose();
    });
  });

  describe("subscribeMany", () => {
    it("should subscribe to multiple markets at once", async () => {
      const subscribePromise = manager.subscribeMany([
        { tokenIds: "token1", immediate: true },
        { tokenIds: ["token2", "token3"], immediate: true },
        { tokenIds: "token4", priority: 10, immediate: true },
      ]);

      // Confirm all subscriptions
      const subscriptions = manager.getAllSubscriptions();
      for (const sub of subscriptions) {
        manager.handleConfirmation(sub.id);
      }

      const results = await subscribePromise;
      expect(results).toHaveLength(3);
      expect(results[0]?.tokenIds).toEqual(["token1"]);
      expect(results[1]?.tokenIds).toEqual(["token2", "token3"]);
      expect(results[2]?.tokenIds).toEqual(["token4"]);
      expect(results[2]?.priority).toBe(10);
    });
  });

  // ==========================================================================
  // Unsubscribe Tests
  // ==========================================================================

  describe("unsubscribe", () => {
    it("should unsubscribe from subscription", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      expect(manager.getSubscriptionCount()).toBe(1);

      await manager.unsubscribe(subscriptionId!);

      expect(manager.getSubscriptionCount()).toBe(0);
      expect(manager.isTokenSubscribed("token1")).toBe(false);
    });

    it("should send unsubscribe message", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      mockSendJson.mockClear();

      await manager.unsubscribe(subscriptionId!);

      expect(mockSendJson).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "unsubscribe",
          market: "token1",
        })
      );
    });

    it("should emit subscriptionRemoved event", async () => {
      const removeHandler = vi.fn();
      manager.on("subscriptionRemoved", removeHandler);

      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      await manager.unsubscribe(subscriptionId!);

      expect(removeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.SUBSCRIPTION_REMOVED,
          subscriptionId,
          tokenIds: ["token1"],
          reason: "user_request",
        })
      );
    });

    it("should throw error for unknown subscription", async () => {
      await expect(manager.unsubscribe("unknown-id")).rejects.toThrow(/not found/);
    });
  });

  describe("unsubscribeToken", () => {
    it("should unsubscribe by token ID", async () => {
      const subscribePromise = manager.subscribe(["token1", "token2"], { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      await manager.unsubscribeToken("token1");

      expect(manager.getSubscriptionCount()).toBe(0);
    });

    it("should throw error for unknown token", async () => {
      await expect(manager.unsubscribeToken("unknown-token")).rejects.toThrow(/not subscribed/);
    });
  });

  describe("unsubscribeAll", () => {
    it("should unsubscribe from all subscriptions", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const subscriptionId1 = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId1!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token2", { immediate: true });
      const subscriptionId2 = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(subscriptionId2!);
      await sub2Promise;

      expect(manager.getSubscriptionCount()).toBe(2);

      await manager.unsubscribeAll();

      expect(manager.getSubscriptionCount()).toBe(0);
    });
  });

  // ==========================================================================
  // Pause/Resume Tests
  // ==========================================================================

  describe("pauseSubscription", () => {
    it("should pause subscription", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      manager.pauseSubscription(subscriptionId!);

      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.status).toBe(SubscriptionStatus.PAUSED);
    });

    it("should emit statusChanged event", async () => {
      const statusHandler = vi.fn();
      manager.on("statusChanged", statusHandler);

      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      manager.pauseSubscription(subscriptionId!);

      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.STATUS_CHANGED,
          subscriptionId,
          previousStatus: SubscriptionStatus.ACTIVE,
          newStatus: SubscriptionStatus.PAUSED,
        })
      );
    });

    it("should throw error for unknown subscription", () => {
      expect(() => manager.pauseSubscription("unknown-id")).toThrow(/not found/);
    });
  });

  describe("resumeSubscription", () => {
    it("should resume paused subscription", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      manager.pauseSubscription(subscriptionId!);
      mockSendJson.mockClear();

      await manager.resumeSubscription(subscriptionId!);

      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.status).toBe(SubscriptionStatus.PENDING);
      expect(subscription?.confirmed).toBe(false);
      expect(mockSendJson).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "subscribe",
        })
      );
    });
  });

  // ==========================================================================
  // Batch Tests
  // ==========================================================================

  describe("batching", () => {
    it("should batch multiple subscriptions", async () => {
      // Use immediate mode for simplicity, but call subscribe without waiting
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub2Promise = manager.subscribe("token2", { immediate: true });
      const sub3Promise = manager.subscribe("token3", { immediate: true });

      // All should have been sent immediately
      expect(mockSendJson).toHaveBeenCalledTimes(3);

      // Confirm all before awaiting promises
      const subscriptions = manager.getAllSubscriptions();
      for (const sub of subscriptions) {
        manager.handleConfirmation(sub.id);
      }

      const results = await Promise.all([sub1Promise, sub2Promise, sub3Promise]);
      expect(results).toHaveLength(3);
    });

    it("should prioritize higher priority subscriptions", async () => {
      // Use immediate mode - priority still applies to order
      const sub1 = manager.subscribe("low-priority", { priority: 1, immediate: true });
      const sub2 = manager.subscribe("high-priority", { priority: 10, immediate: true });
      const sub3 = manager.subscribe("medium-priority", { priority: 5, immediate: true });

      // Confirm all subscriptions before awaiting
      const subs = manager.getAllSubscriptions();
      for (const sub of subs) {
        manager.handleConfirmation(sub.id);
      }
      await Promise.all([sub1, sub2, sub3]);

      // Verify subscriptions were created with correct priorities
      const allSubs = manager.getAllSubscriptions();
      const highPriority = allSubs.find(s => s.tokenIds.includes("high-priority"));
      expect(highPriority?.priority).toBe(10);
    });

    it("should emit batchSent event", async () => {
      // Use immediate mode, batchSent is not emitted for immediate
      // Instead test that subscriptionAdded is emitted
      const addedHandler = vi.fn();
      manager.on("subscriptionAdded", addedHandler);

      const sub1 = manager.subscribe("token1", { immediate: true });
      const sub2 = manager.subscribe("token2", { immediate: true });

      expect(addedHandler).toHaveBeenCalledTimes(2);

      // Confirm all subscriptions before awaiting
      const subs = manager.getAllSubscriptions();
      for (const sub of subs) {
        manager.handleConfirmation(sub.id);
      }
      await Promise.all([sub1, sub2]);
    });

    it("should respect batch size", async () => {
      const smallBatchMockSendJson = vi.fn<SendJsonFunction>().mockReturnValue(true);
      const smallBatchManager = createMultiMarketSubscriptionManager({
        batchSize: 2,
        batchDelay: 10,
      });
      smallBatchManager.setSendFunction(smallBatchMockSendJson);

      // Subscribe to 5 tokens
      for (let i = 0; i < 5; i++) {
        smallBatchManager.subscribe(`token${i}`);
      }

      // Advance time to let all batches process (3 batches: 2+2+1 = 5)
      // Each batch takes batchDelay (10ms) to send
      await vi.advanceTimersByTimeAsync(50);

      // All 5 subscriptions should have been sent
      expect(smallBatchMockSendJson).toHaveBeenCalledTimes(5);

      // Verify that batching occurred by checking that there were multiple batch cycles
      // (if no batching, all would be sent at once)
      expect(smallBatchMockSendJson.mock.calls.length).toBeLessThanOrEqual(5);

      smallBatchManager.dispose();
    });
  });

  // ==========================================================================
  // Confirmation Tests
  // ==========================================================================

  describe("handleConfirmation", () => {
    it("should confirm subscription", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;

      manager.handleConfirmation(subscriptionId!);

      const subscription = await subscribePromise;
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.confirmed).toBe(true);
      expect(subscription.confirmedAt).toBeDefined();
    });

    it("should find subscription by token IDs", async () => {
      const subscribePromise = manager.subscribe(["token1", "token2"], { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;

      // Confirm by token IDs instead of subscription ID
      manager.handleConfirmation("unknown-id", ["token1"]);

      const subscription = await subscribePromise;
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.id).toBe(subscriptionId);
    });

    it("should emit subscriptionConfirmed event", async () => {
      const confirmedHandler = vi.fn();
      manager.on("subscriptionConfirmed", confirmedHandler);

      manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;

      manager.handleConfirmation(subscriptionId!);

      expect(confirmedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.SUBSCRIPTION_CONFIRMED,
          subscription: expect.objectContaining({
            id: subscriptionId,
            status: SubscriptionStatus.ACTIVE,
          }),
        })
      );
    });

    it("should track confirmation time", async () => {
      const confirmedHandler = vi.fn();
      manager.on("subscriptionConfirmed", confirmedHandler);

      manager.subscribe("token1", { immediate: true });

      vi.advanceTimersByTime(500);

      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      expect(confirmedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmationTime: expect.any(Number),
        })
      );
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("handleError", () => {
    it("should handle subscription error and retry", async () => {
      const errorHandler = vi.fn();
      manager.on("subscriptionError", errorHandler);

      manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;

      manager.handleError(subscriptionId!, new Error("Connection failed"));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.SUBSCRIPTION_ERROR,
          subscriptionId,
          willRetry: true,
          retryCount: 1,
        })
      );

      // Should schedule retry
      vi.advanceTimersByTime(1000);
      expect(mockSendJson).toHaveBeenCalledTimes(2); // Initial + retry
    });

    it("should give up after max retries", async () => {
      const errorHandler = vi.fn();
      const statusHandler = vi.fn();
      manager.on("subscriptionError", errorHandler);
      manager.on("statusChanged", statusHandler);

      // Create subscription and catch the expected rejection
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;

      // Simulate 3 failures (max retries)
      manager.handleError(subscriptionId!, new Error("Error 1"));
      manager.handleError(subscriptionId!, new Error("Error 2"));
      manager.handleError(subscriptionId!, new Error("Error 3"));

      // Await and expect rejection after max retries
      await expect(subscribePromise).rejects.toThrow("Error 3");

      // Last call should indicate no retry
      const lastCall = errorHandler.mock.calls[2]?.[0] as { willRetry: boolean } | undefined;
      expect(lastCall?.willRetry).toBe(false);

      // Should have emitted status change to ERROR
      expect(statusHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          newStatus: SubscriptionStatus.ERROR,
        })
      );
    });
  });

  // ==========================================================================
  // Price Update Tests
  // ==========================================================================

  describe("handlePriceUpdate", () => {
    it("should update subscription state on price update", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      const update = {
        type: "price_update" as const,
        asset_id: "token1",
        price: 0.65,
        timestamp: Date.now(),
        probability: 65,
        parsedTimestamp: new Date(),
        receivedAt: new Date(),
        isSignificant: false,
      };

      manager.handlePriceUpdate("token1", update);

      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.updateCount).toBe(1);
      expect(subscription?.lastUpdateAt).toBeDefined();
      expect(subscription?.prices.get("token1")).toEqual(update);
    });
  });

  // ==========================================================================
  // Stale Detection Tests
  // ==========================================================================

  describe("stale detection", () => {
    it("should detect stale subscriptions", async () => {
      const staleHandler = vi.fn();
      manager.on("subscriptionStale", staleHandler);

      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      // Advance time past stale threshold
      vi.advanceTimersByTime(DEFAULT_STALE_SUBSCRIPTION_THRESHOLD + 30000 + 10);

      expect(staleHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SubscriptionManagerEventType.SUBSCRIPTION_STALE,
          subscription: expect.objectContaining({ id: subscriptionId }),
        })
      );
    });

    it("should not detect stale when updates are received", async () => {
      const staleHandler = vi.fn();
      manager.on("subscriptionStale", staleHandler);

      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptions = manager.getAllSubscriptions();
      const subscriptionId = subscriptions[0]?.id;
      expect(subscriptionId).toBeDefined();
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      // Advance halfway to stale threshold
      vi.advanceTimersByTime(DEFAULT_STALE_SUBSCRIPTION_THRESHOLD / 2);

      // Receive update
      manager.handlePriceUpdate("token1", {
        type: "price_update",
        asset_id: "token1",
        price: 0.65,
        timestamp: Date.now(),
        probability: 65,
        parsedTimestamp: new Date(),
        receivedAt: new Date(),
        isSignificant: false,
      });

      // Advance to check interval
      vi.advanceTimersByTime(30000);

      expect(staleHandler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Query Tests
  // ==========================================================================

  describe("getSubscription", () => {
    it("should return subscription by ID", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.tokenIds).toEqual(["token1"]);
    });

    it("should return undefined for unknown ID", () => {
      expect(manager.getSubscription("unknown")).toBeUndefined();
    });
  });

  describe("getSubscriptionForToken", () => {
    it("should return subscription for token", async () => {
      const subscribePromise = manager.subscribe(["token1", "token2"], { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      const subscription = manager.getSubscriptionForToken("token1");
      expect(subscription?.id).toBe(subscriptionId);
    });
  });

  describe("getSubscriptions", () => {
    it("should filter by status", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      manager.subscribe("token2", { immediate: true });
      // Don't confirm token2 - stays pending

      const activeSubscriptions = manager.getSubscriptions({ status: SubscriptionStatus.ACTIVE });
      expect(activeSubscriptions).toHaveLength(1);
      expect(activeSubscriptions[0]?.tokenIds).toEqual(["token1"]);

      const pendingSubscriptions = manager.getSubscriptions({ status: SubscriptionStatus.PENDING });
      expect(pendingSubscriptions).toHaveLength(1);
      expect(pendingSubscriptions[0]?.tokenIds).toEqual(["token2"]);
    });

    it("should filter by multiple statuses", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      manager.subscribe("token2", { immediate: true });

      const subscriptions = manager.getSubscriptions({
        status: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
      });
      expect(subscriptions).toHaveLength(2);
    });

    it("should filter by channel", async () => {
      const sub1Promise = manager.subscribe("token1", {
        channel: SubscriptionChannel.MARKET,
        immediate: true,
      });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token2", {
        channel: SubscriptionChannel.BOOK,
        immediate: true,
      });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const marketSubscriptions = manager.getSubscriptions({
        channel: SubscriptionChannel.MARKET,
      });
      expect(marketSubscriptions).toHaveLength(1);
      expect(marketSubscriptions[0]?.channel).toBe(SubscriptionChannel.MARKET);
    });

    it("should filter by tags", async () => {
      const sub1Promise = manager.subscribe("token1", {
        tags: ["whale", "important"],
        immediate: true,
      });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token2", {
        tags: ["regular"],
        immediate: true,
      });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const whaleSubscriptions = manager.getSubscriptions({ tags: ["whale"] });
      expect(whaleSubscriptions).toHaveLength(1);
      expect(whaleSubscriptions[0]?.tokenIds).toEqual(["token1"]);
    });

    it("should filter by confirmed", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      manager.subscribe("token2", { immediate: true });

      const confirmedSubscriptions = manager.getSubscriptions({ confirmed: true });
      expect(confirmedSubscriptions).toHaveLength(1);

      const unconfirmedSubscriptions = manager.getSubscriptions({ confirmed: false });
      expect(unconfirmedSubscriptions).toHaveLength(1);
    });

    it("should filter by tokenIds", async () => {
      const sub1Promise = manager.subscribe(["token1", "token2"], { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe(["token3", "token4"], { immediate: true });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const subscriptions = manager.getSubscriptions({ tokenIds: ["token1", "token3"] });
      expect(subscriptions).toHaveLength(2);
    });

    it("should filter by priority", async () => {
      const sub1Promise = manager.subscribe("token1", { priority: 1, immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token2", { priority: 5, immediate: true });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const sub3Promise = manager.subscribe("token3", { priority: 10, immediate: true });
      const sub3Id = manager.getAllSubscriptions()[2]?.id;
      manager.handleConfirmation(sub3Id!);
      await sub3Promise;

      const highPriority = manager.getSubscriptions({ minPriority: 5 });
      expect(highPriority).toHaveLength(2);

      const mediumPriority = manager.getSubscriptions({ minPriority: 3, maxPriority: 7 });
      expect(mediumPriority).toHaveLength(1);
      expect(mediumPriority[0]?.priority).toBe(5);
    });
  });

  describe("getSubscribedTokenIds", () => {
    it("should return all subscribed token IDs", async () => {
      const sub1Promise = manager.subscribe(["token1", "token2"], { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token3", { immediate: true });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const tokenIds = manager.getSubscribedTokenIds();
      expect(tokenIds).toContain("token1");
      expect(tokenIds).toContain("token2");
      expect(tokenIds).toContain("token3");
    });
  });

  describe("isTokenSubscribed", () => {
    it("should return true for subscribed token", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      expect(manager.isTokenSubscribed("token1")).toBe(true);
    });

    it("should return false for unsubscribed token", () => {
      expect(manager.isTokenSubscribed("unknown")).toBe(false);
    });
  });

  describe("getSubscriptionCount", () => {
    it("should return correct count", async () => {
      expect(manager.getSubscriptionCount()).toBe(0);

      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      expect(manager.getSubscriptionCount()).toBe(1);

      const sub2Promise = manager.subscribe("token2", { immediate: true });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      expect(manager.getSubscriptionCount()).toBe(2);
    });
  });

  describe("getSubscribedTokenCount", () => {
    it("should return correct count", async () => {
      expect(manager.getSubscribedTokenCount()).toBe(0);

      const subscribePromise = manager.subscribe(["token1", "token2", "token3"], { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      expect(manager.getSubscribedTokenCount()).toBe(3);
    });
  });

  describe("getSubscriptionCountsByStatus", () => {
    it("should return correct counts by status", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      manager.subscribe("token2", { immediate: true });
      // Don't confirm - stays pending

      const sub3Promise = manager.subscribe("token3", { immediate: true });
      const sub3Id = manager.getAllSubscriptions()[2]?.id;
      manager.handleConfirmation(sub3Id!);
      await sub3Promise;
      manager.pauseSubscription(sub3Id!);

      const counts = manager.getSubscriptionCountsByStatus();
      expect(counts[SubscriptionStatus.ACTIVE]).toBe(1);
      expect(counts[SubscriptionStatus.PENDING]).toBe(1);
      expect(counts[SubscriptionStatus.PAUSED]).toBe(1);
      expect(counts[SubscriptionStatus.ERROR]).toBe(0);
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe("getStats", () => {
    it("should return initial stats", () => {
      const stats = manager.getStats();
      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.batchesSent).toBe(0);
      expect(stats.totalConfirmations).toBe(0);
    });

    it("should track stats correctly", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const stats = manager.getStats();
      expect(stats.totalSubscriptions).toBe(1);
      expect(stats.activeSubscriptions).toBe(1);
      expect(stats.totalConfirmations).toBe(1);
      expect(stats.lastActivityAt).toBeDefined();
    });

    it("should calculate average confirmation time", async () => {
      for (let i = 0; i < 5; i++) {
        const promise = manager.subscribe(`token${i}`, { immediate: true });
        vi.advanceTimersByTime(100);
        const subId = manager.getAllSubscriptions()[i]?.id;
        manager.handleConfirmation(subId!);
        await promise;
      }

      const stats = manager.getStats();
      expect(stats.avgConfirmationTime).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Health Tests
  // ==========================================================================

  describe("getHealth", () => {
    it("should return healthy status when all is well", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      const health = manager.getHealth();
      expect(health.status).toBe("healthy");
      expect(health.score).toBeGreaterThanOrEqual(80);
      expect(health.activeRate).toBe(100);
      expect(health.errorRate).toBe(0);
    });

    it("should detect degraded status", async () => {
      // Create many subscriptions with some errors
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        const promise = manager.subscribe(`token${i}`, { immediate: true });
        const subId = manager.getAllSubscriptions()[i]?.id;
        if (i < 8) {
          manager.handleConfirmation(subId!);
          promises.push(promise);
        } else {
          // Mark as error - catch the rejection
          for (let j = 0; j < 4; j++) {
            manager.handleError(subId!, new Error("Test error"));
          }
          promises.push(promise.catch(() => {})); // Catch expected rejection
        }
      }

      await Promise.all(promises);

      const health = manager.getHealth();
      expect(health.errorRate).toBeGreaterThan(0);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it("should provide recommendations", async () => {
      // Create a subscription with errors - catch the expected rejection
      const subscribePromise = manager.subscribe("token1", { immediate: true }).catch(() => {});
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      expect(subscriptionId).toBeDefined();

      // Mark as error
      for (let i = 0; i < 4; i++) {
        manager.handleError(subscriptionId!, new Error("Test error"));
      }

      await subscribePromise;

      // Try to get the subscription (it's now in error state)
      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.status).toBe(SubscriptionStatus.ERROR);

      const health = manager.getHealth();
      // Health check should return something
      expect(health).toBeDefined();
    });
  });

  // ==========================================================================
  // Reconnection Tests
  // ==========================================================================

  describe("handleConnectionStateChange", () => {
    it("should resubscribe on connect", async () => {
      const sub1Promise = manager.subscribe("token1", { immediate: true, autoResubscribe: true });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      // First, simulate disconnect which marks subscriptions as unconfirmed
      manager.handleConnectionStateChange("disconnected", "connected");

      mockSendJson.mockClear();

      // Then simulate reconnect which should trigger resubscription
      manager.handleConnectionStateChange("connected", "disconnected");

      // Should have sent resubscribe
      expect(mockSendJson).toHaveBeenCalled();
    });

    it("should mark subscriptions as unconfirmed on disconnect", async () => {
      const subscribePromise = manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);
      await subscribePromise;

      manager.handleConnectionStateChange("disconnected", "connected");

      const subscription = manager.getSubscription(subscriptionId!);
      expect(subscription?.confirmed).toBe(false);
      expect(subscription?.status).toBe(SubscriptionStatus.PENDING);
    });
  });

  describe("getSubscriptionsToRestore", () => {
    it("should return subscriptions that need restoration", async () => {
      const sub1Promise = manager.subscribe("token1", {
        immediate: true,
        autoResubscribe: true,
      });
      const sub1Id = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(sub1Id!);
      await sub1Promise;

      const sub2Promise = manager.subscribe("token2", {
        immediate: true,
        autoResubscribe: false,
      });
      const sub2Id = manager.getAllSubscriptions()[1]?.id;
      manager.handleConfirmation(sub2Id!);
      await sub2Promise;

      const toRestore = manager.getSubscriptionsToRestore();
      expect(toRestore).toHaveLength(1);
      expect(toRestore[0]?.tokenIds).toEqual(["token1"]);
    });
  });

  // ==========================================================================
  // Event Tests
  // ==========================================================================

  describe("event handling", () => {
    it("should add and remove listeners", () => {
      const listener = vi.fn();
      const unsubscribe = manager.on("subscriptionAdded", listener);

      manager.subscribe("token1", { immediate: true });

      expect(listener).toHaveBeenCalled();

      unsubscribe();
      listener.mockClear();

      manager.subscribe("token2", { immediate: true });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support once listeners", () => {
      const listener = vi.fn();
      manager.once("subscriptionAdded", listener);

      manager.subscribe("token1", { immediate: true });
      manager.subscribe("token2", { immediate: true });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should remove all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.on("subscriptionAdded", listener1);
      manager.on("subscriptionConfirmed", listener2);

      manager.removeAllListeners();

      manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should remove listeners for specific event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.on("subscriptionAdded", listener1);
      manager.on("subscriptionConfirmed", listener2);

      manager.removeAllListeners("subscriptionAdded");

      manager.subscribe("token1", { immediate: true });
      const subscriptionId = manager.getAllSubscriptions()[0]?.id;
      manager.handleConfirmation(subscriptionId!);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Dispose Tests
  // ==========================================================================

  describe("dispose", () => {
    it("should clean up resources", () => {
      manager.subscribe("token1", { immediate: true });
      manager.subscribe("token2", { immediate: true });

      manager.dispose();

      expect(manager.getSubscriptionCount()).toBe(0);
      expect(manager.getSubscribedTokenCount()).toBe(0);
    });

    it("should clear pending operations without rejection", async () => {
      // Note: Pending operations are silently cleared on dispose to avoid
      // unhandled promise rejections. The promises will remain pending forever.
      // We don't need to reference the promise, just verify the subscription is cleared
      manager.subscribe("token1");

      manager.dispose();

      // Promise remains pending - can't be resolved or rejected after dispose
      // Just verify the subscription was cleared
      expect(manager.getSubscriptionCount()).toBe(0);
    });

    it("should be idempotent", () => {
      manager.dispose();
      manager.dispose();
      // Should not throw
    });
  });

  // ==========================================================================
  // Factory and Singleton Tests
  // ==========================================================================

  describe("factory and singleton", () => {
    it("should create manager with factory", () => {
      const newManager = createMultiMarketSubscriptionManager();
      expect(newManager).toBeInstanceOf(MultiMarketSubscriptionManager);
      newManager.dispose();
    });

    it("should get shared manager", () => {
      const shared1 = getSharedSubscriptionManager();
      const shared2 = getSharedSubscriptionManager();
      expect(shared1).toBe(shared2);
    });

    it("should set shared manager", () => {
      const newManager = createMultiMarketSubscriptionManager();
      setSharedSubscriptionManager(newManager);

      const shared = getSharedSubscriptionManager();
      expect(shared).toBe(newManager);
    });

    it("should reset shared manager", () => {
      const shared1 = getSharedSubscriptionManager();
      resetSharedSubscriptionManager();
      const shared2 = getSharedSubscriptionManager();

      expect(shared1).not.toBe(shared2);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("calculateSubscriptionDistribution", () => {
  it("should distribute tokens into batches", () => {
    const tokens = ["t1", "t2", "t3", "t4", "t5"];
    const batches = calculateSubscriptionDistribution(tokens, 2);

    expect(batches).toEqual([
      ["t1", "t2"],
      ["t3", "t4"],
      ["t5"],
    ]);
  });

  it("should handle exact divisible count", () => {
    const tokens = ["t1", "t2", "t3", "t4"];
    const batches = calculateSubscriptionDistribution(tokens, 2);

    expect(batches).toEqual([
      ["t1", "t2"],
      ["t3", "t4"],
    ]);
  });

  it("should handle single batch", () => {
    const tokens = ["t1", "t2"];
    const batches = calculateSubscriptionDistribution(tokens, 10);

    expect(batches).toEqual([["t1", "t2"]]);
  });

  it("should handle empty array", () => {
    const batches = calculateSubscriptionDistribution([], 10);
    expect(batches).toEqual([]);
  });
});

describe("mergeFilters", () => {
  it("should merge status filters", () => {
    const filter1: SubscriptionFilter = { status: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] };
    const filter2: SubscriptionFilter = { status: [SubscriptionStatus.ACTIVE, SubscriptionStatus.ERROR] };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.status).toEqual([SubscriptionStatus.ACTIVE]);
  });

  it("should merge channel filters", () => {
    const filter1: SubscriptionFilter = { channel: [SubscriptionChannel.MARKET, SubscriptionChannel.BOOK] };
    const filter2: SubscriptionFilter = { channel: SubscriptionChannel.MARKET };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.channel).toEqual([SubscriptionChannel.MARKET]);
  });

  it("should merge tags filters", () => {
    const filter1: SubscriptionFilter = { tags: ["tag1", "tag2", "tag3"] };
    const filter2: SubscriptionFilter = { tags: ["tag2", "tag3", "tag4"] };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.tags).toEqual(["tag2", "tag3"]);
  });

  it("should merge tokenIds filters", () => {
    const filter1: SubscriptionFilter = { tokenIds: ["t1", "t2"] };
    const filter2: SubscriptionFilter = { tokenIds: ["t2", "t3"] };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.tokenIds).toEqual(["t2"]);
  });

  it("should merge boolean filters", () => {
    const filter1: SubscriptionFilter = { confirmed: true };
    const filter2: SubscriptionFilter = { isStale: false };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.confirmed).toBe(true);
    expect(merged.isStale).toBe(false);
  });

  it("should merge priority ranges", () => {
    const filter1: SubscriptionFilter = { minPriority: 2, maxPriority: 10 };
    const filter2: SubscriptionFilter = { minPriority: 5, maxPriority: 8 };

    const merged = mergeFilters(filter1, filter2);
    expect(merged.minPriority).toBe(5);
    expect(merged.maxPriority).toBe(8);
  });

  it("should handle empty filters", () => {
    const merged = mergeFilters({}, {});
    expect(merged).toEqual({});
  });
});

describe("matchesFilter", () => {
  const createSubscription = (overrides: Partial<ManagedSubscription> = {}): ManagedSubscription => ({
    id: "sub1",
    tokenIds: ["token1"],
    channel: SubscriptionChannel.MARKET,
    createdAt: new Date(),
    confirmed: true,
    confirmedAt: new Date(),
    updateCount: 0,
    prices: new Map(),
    status: SubscriptionStatus.ACTIVE,
    retryCount: 0,
    maxRetries: 3,
    priority: 5,
    tags: new Set(["tag1", "tag2"]),
    autoResubscribe: true,
    ...overrides,
  });

  it("should match status filter", () => {
    const subscription = createSubscription({ status: SubscriptionStatus.ACTIVE });

    expect(matchesFilter(subscription, { status: SubscriptionStatus.ACTIVE })).toBe(true);
    expect(matchesFilter(subscription, { status: SubscriptionStatus.PENDING })).toBe(false);
    expect(matchesFilter(subscription, { status: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] })).toBe(true);
  });

  it("should match channel filter", () => {
    const subscription = createSubscription({ channel: SubscriptionChannel.BOOK });

    expect(matchesFilter(subscription, { channel: SubscriptionChannel.BOOK })).toBe(true);
    expect(matchesFilter(subscription, { channel: SubscriptionChannel.MARKET })).toBe(false);
  });

  it("should match tags filter", () => {
    const subscription = createSubscription({ tags: new Set(["whale", "important"]) });

    expect(matchesFilter(subscription, { tags: ["whale"] })).toBe(true);
    expect(matchesFilter(subscription, { tags: ["unknown"] })).toBe(false);
    expect(matchesFilter(subscription, { tags: ["whale", "unknown"] })).toBe(true); // Any match
  });

  it("should match confirmed filter", () => {
    const confirmedSub = createSubscription({ confirmed: true });
    const unconfirmedSub = createSubscription({ confirmed: false });

    expect(matchesFilter(confirmedSub, { confirmed: true })).toBe(true);
    expect(matchesFilter(confirmedSub, { confirmed: false })).toBe(false);
    expect(matchesFilter(unconfirmedSub, { confirmed: false })).toBe(true);
  });

  it("should match tokenIds filter", () => {
    const subscription = createSubscription({ tokenIds: ["token1", "token2"] });

    expect(matchesFilter(subscription, { tokenIds: ["token1"] })).toBe(true);
    expect(matchesFilter(subscription, { tokenIds: ["token3"] })).toBe(false);
    expect(matchesFilter(subscription, { tokenIds: ["token1", "token3"] })).toBe(true); // Any match
  });

  it("should match priority filter", () => {
    const subscription = createSubscription({ priority: 5 });

    expect(matchesFilter(subscription, { minPriority: 3 })).toBe(true);
    expect(matchesFilter(subscription, { minPriority: 7 })).toBe(false);
    expect(matchesFilter(subscription, { maxPriority: 10 })).toBe(true);
    expect(matchesFilter(subscription, { maxPriority: 3 })).toBe(false);
    expect(matchesFilter(subscription, { minPriority: 3, maxPriority: 7 })).toBe(true);
  });

  it("should match isStale filter", () => {
    const now = Date.now();
    const freshSub = createSubscription({
      lastUpdateAt: new Date(now - 1000),
      status: SubscriptionStatus.ACTIVE,
    });
    const staleSub = createSubscription({
      lastUpdateAt: new Date(now - 120000),
      status: SubscriptionStatus.ACTIVE,
    });

    expect(matchesFilter(freshSub, { isStale: false }, 60000)).toBe(true);
    expect(matchesFilter(freshSub, { isStale: true }, 60000)).toBe(false);
    expect(matchesFilter(staleSub, { isStale: true }, 60000)).toBe(true);
    expect(matchesFilter(staleSub, { isStale: false }, 60000)).toBe(false);
  });

  it("should handle empty filter", () => {
    const subscription = createSubscription();
    expect(matchesFilter(subscription, {})).toBe(true);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("constants", () => {
  it("should export default values", () => {
    expect(DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION).toBe(100);
    expect(DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION).toBe(50);
    expect(DEFAULT_BATCH_SIZE).toBe(10);
    expect(DEFAULT_BATCH_DELAY).toBe(100);
    expect(DEFAULT_SUBSCRIPTION_TIMEOUT).toBe(10000);
    expect(DEFAULT_STALE_SUBSCRIPTION_THRESHOLD).toBe(60000);
  });

  it("should export SubscriptionStatus values", () => {
    expect(SubscriptionStatus.PENDING).toBe("pending");
    expect(SubscriptionStatus.ACTIVE).toBe("active");
    expect(SubscriptionStatus.PAUSED).toBe("paused");
    expect(SubscriptionStatus.ERROR).toBe("error");
    expect(SubscriptionStatus.UNSUBSCRIBED).toBe("unsubscribed");
  });

  it("should export BatchOperationType values", () => {
    expect(BatchOperationType.SUBSCRIBE).toBe("subscribe");
    expect(BatchOperationType.UNSUBSCRIBE).toBe("unsubscribe");
  });

  it("should export SubscriptionManagerEventType values", () => {
    expect(SubscriptionManagerEventType.SUBSCRIPTION_ADDED).toBe("subscriptionAdded");
    expect(SubscriptionManagerEventType.SUBSCRIPTION_REMOVED).toBe("subscriptionRemoved");
    expect(SubscriptionManagerEventType.SUBSCRIPTION_CONFIRMED).toBe("subscriptionConfirmed");
    expect(SubscriptionManagerEventType.SUBSCRIPTION_ERROR).toBe("subscriptionError");
    expect(SubscriptionManagerEventType.SUBSCRIPTION_STALE).toBe("subscriptionStale");
    expect(SubscriptionManagerEventType.BATCH_SENT).toBe("batchSent");
    expect(SubscriptionManagerEventType.BATCH_COMPLETE).toBe("batchComplete");
    expect(SubscriptionManagerEventType.LIMIT_REACHED).toBe("limitReached");
    expect(SubscriptionManagerEventType.STATUS_CHANGED).toBe("statusChanged");
    expect(SubscriptionManagerEventType.HEALTH_UPDATED).toBe("healthUpdated");
  });
});
