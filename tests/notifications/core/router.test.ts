/**
 * Tests for the Multi-channel Notification Router
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotificationRouter,
  getNotificationRouter,
  resetNotificationRouter,
  setNotificationRouter,
  routeNotification,
  setUserNotificationPreferences,
  registerChannelHandler,
  DEFAULT_ROUTER_CONFIG,
  UserNotificationPreferences,
  ChannelConfig,
  RouterEvent,
} from "../../../src/notifications/core/router";
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  ChannelHandler,
  ChannelSendResult,
  NotificationPayload,
  EmailNotificationPayload,
} from "../../../src/notifications/core/types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock channel handler
 */
function createMockHandler(
  channel: NotificationChannel,
  options: {
    available?: boolean;
    sendSuccess?: boolean;
    sendError?: string;
    shouldRetry?: boolean;
    delay?: number;
  } = {}
): ChannelHandler {
  const {
    available = true,
    sendSuccess = true,
    sendError,
    shouldRetry = false,
    delay = 0,
  } = options;

  return {
    channel,
    isAvailable: vi.fn().mockReturnValue(available),
    getStatus: vi.fn().mockReturnValue(available ? "available" : "unavailable"),
    send: vi.fn().mockImplementation(async (): Promise<ChannelSendResult> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      return {
        success: sendSuccess,
        channel,
        error: sendSuccess ? undefined : sendError || "Mock error",
        shouldRetry,
        timestamp: new Date(),
        duration: delay || 10,
      };
    }),
  };
}

/**
 * Create a test email payload
 */
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

/**
 * Create user preferences
 */
function createUserPreferences(
  userId: string,
  channels: Partial<Record<NotificationChannel, ChannelConfig>>,
  options?: Partial<UserNotificationPreferences>
): UserNotificationPreferences {
  return {
    userId,
    enabled: true,
    channels,
    ...options,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("NotificationRouter", () => {
  let router: NotificationRouter;

  beforeEach(() => {
    resetNotificationRouter();
    router = new NotificationRouter({
      enableLogging: false,
      defaultMaxRetries: 1,
      retryDelay: 10,
    });
  });

  afterEach(() => {
    resetNotificationRouter();
  });

  describe("Constructor and Configuration", () => {
    it("should create router with default config", () => {
      const defaultRouter = new NotificationRouter();
      const stats = defaultRouter.getStats();

      expect(stats.totalRouted).toBe(0);
      expect(stats.totalSuccess).toBe(0);
      expect(stats.totalFailed).toBe(0);
    });

    it("should merge custom config with defaults", () => {
      const customRouter = new NotificationRouter({
        maxConcurrency: 10,
        defaultMaxRetries: 5,
      });

      expect(customRouter).toBeDefined();
    });

    it("should initialize channel stats for all channels", () => {
      const stats = router.getStats();

      for (const channel of Object.values(NotificationChannel)) {
        expect(stats.channelStats[channel]).toBeDefined();
        expect(stats.channelStats[channel].success).toBe(0);
        expect(stats.channelStats[channel].failed).toBe(0);
      }
    });
  });

  describe("Handler Management", () => {
    it("should register a channel handler", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      expect(router.hasHandler(NotificationChannel.EMAIL)).toBe(true);
      expect(router.getHandlers().get(NotificationChannel.EMAIL)).toBe(handler);
    });

    it("should unregister a channel handler", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);
      router.unregisterHandler(NotificationChannel.EMAIL);

      expect(router.hasHandler(NotificationChannel.EMAIL)).toBe(false);
    });

    it("should return false for hasHandler when handler is unavailable", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL, { available: false });
      router.registerHandler(handler);

      expect(router.hasHandler(NotificationChannel.EMAIL)).toBe(false);
    });

    it("should return a copy of handlers map", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const handlers = router.getHandlers();
      handlers.delete(NotificationChannel.EMAIL);

      // Original should still have the handler
      expect(router.getHandlers().has(NotificationChannel.EMAIL)).toBe(true);
    });
  });

  describe("User Preferences Management", () => {
    it("should set and get user preferences", () => {
      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
      });

      router.setUserPreferences(preferences);
      const retrieved = router.getUserPreferences("user1");

      expect(retrieved).toEqual(preferences);
    });

    it("should return undefined for non-existent user", () => {
      expect(router.getUserPreferences("nonexistent")).toBeUndefined();
    });

    it("should remove user preferences", () => {
      const preferences = createUserPreferences("user1", {});
      router.setUserPreferences(preferences);

      expect(router.removeUserPreferences("user1")).toBe(true);
      expect(router.getUserPreferences("user1")).toBeUndefined();
    });

    it("should create default preferences", () => {
      const defaults = router.createDefaultPreferences("user1");

      expect(defaults.userId).toBe("user1");
      expect(defaults.enabled).toBe(true);
      expect(defaults.defaultChannels).toEqual(DEFAULT_ROUTER_CONFIG.defaultChannels);
    });
  });

  describe("Routing Decision", () => {
    it("should route to payload channel when handler is available", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload);

      expect(decision.shouldRoute).toBe(true);
      expect(decision.targetChannels).toContain(NotificationChannel.EMAIL);
    });

    it("should use default channels when payload channel has no handler", () => {
      const handler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(handler);

      // Override defaults to include telegram
      const customRouter = new NotificationRouter({
        enableLogging: false,
        defaultChannels: [NotificationChannel.TELEGRAM],
      });
      customRouter.registerHandler(handler);

      const payload = createEmailPayload(); // Email payload but no email handler
      const decision = customRouter.getRoutingDecision(payload);

      expect(decision.shouldRoute).toBe(true);
      expect(decision.targetChannels).toContain(NotificationChannel.TELEGRAM);
    });

    it("should not route when user notifications are disabled", () => {
      const preferences = createUserPreferences(
        "user1",
        { [NotificationChannel.EMAIL]: { enabled: true } },
        { enabled: false }
      );
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1");

      expect(decision.shouldRoute).toBe(false);
      expect(decision.reason).toBe("User notifications disabled");
    });

    it("should skip channels below priority threshold", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: {
          enabled: true,
          minPriority: NotificationPriority.HIGH,
        },
      });
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1", NotificationPriority.NORMAL);

      expect(decision.skippedChannels).toContainEqual({
        channel: NotificationChannel.EMAIL,
        reason: expect.stringContaining("Below priority threshold"),
      });
    });

    it("should identify fallback channels", () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL);
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(emailHandler);
      router.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true, isFallback: true },
      });
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1");

      expect(decision.targetChannels).toContain(NotificationChannel.EMAIL);
      expect(decision.fallbackChannels).toContain(NotificationChannel.TELEGRAM);
    });

    it("should skip disabled channels", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: false },
      });
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1");

      expect(decision.skippedChannels).toContainEqual({
        channel: NotificationChannel.EMAIL,
        reason: "Disabled",
      });
    });
  });

  describe("Quiet Hours", () => {
    it("should block notifications during quiet hours", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      // Set quiet hours to cover current time in UTC
      // We use 00:00 - 23:59 to ensure we're always within quiet hours
      const preferences = createUserPreferences(
        "user1",
        { [NotificationChannel.EMAIL]: { enabled: true } },
        {
          defaultChannels: [NotificationChannel.EMAIL],
          quietHours: {
            enabled: true,
            start: "00:00",
            end: "23:59",
            timezone: "UTC",
          },
        }
      );
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1");

      expect(decision.shouldRoute).toBe(false);
      expect(decision.quietHoursActive).toBe(true);
    });

    it("should allow critical priority to bypass quiet hours", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      // Set quiet hours to cover all day
      const preferences = createUserPreferences(
        "user1",
        { [NotificationChannel.EMAIL]: { enabled: true } },
        {
          defaultChannels: [NotificationChannel.EMAIL],
          quietHours: {
            enabled: true,
            start: "00:00",
            end: "23:59",
            timezone: "UTC",
            bypassPriority: NotificationPriority.HIGH,
          },
        }
      );
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1", NotificationPriority.HIGH);

      expect(decision.quietHoursActive).toBe(true);
      expect(decision.shouldRoute).toBe(true);
    });
  });

  describe("Routing Notifications", () => {
    it("should route notification to single channel successfully", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload);

      expect(result.success).toBe(true);
      expect(result.channelResults).toHaveLength(1);
      expect(result.channelResults[0]?.channel).toBe(NotificationChannel.EMAIL);
      expect(result.channelResults[0]?.success).toBe(true);
      expect(handler.send).toHaveBeenCalledTimes(1);
    });

    it("should route notification to multiple channels", async () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL);
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(emailHandler);
      router.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true },
      });
      preferences.defaultChannels = [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM];
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload, "user1");

      expect(result.success).toBe(true);
      expect(result.summary.attempted).toBe(2);
      expect(result.summary.succeeded).toBe(2);
    });

    it("should use fallback channels on failure", async () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL, {
        sendSuccess: false,
        sendError: "Primary failed",
      });
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(emailHandler);
      router.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true, isFallback: true },
      });
      preferences.defaultChannels = [NotificationChannel.EMAIL];
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload, "user1");

      expect(result.success).toBe(true);
      expect(result.summary.fallbacksUsed).toBe(1);
      expect(telegramHandler.send).toHaveBeenCalled();
    });

    it("should retry on failure with shouldRetry flag", async () => {
      let callCount = 0;
      const handler: ChannelHandler = {
        channel: NotificationChannel.EMAIL,
        isAvailable: () => true,
        getStatus: () => "available",
        send: vi.fn().mockImplementation(async (): Promise<ChannelSendResult> => {
          callCount++;
          if (callCount < 2) {
            return {
              success: false,
              channel: NotificationChannel.EMAIL,
              error: "Temporary failure",
              shouldRetry: true,
              timestamp: new Date(),
            };
          }
          return {
            success: true,
            channel: NotificationChannel.EMAIL,
            timestamp: new Date(),
          };
        }),
      };

      const retryRouter = new NotificationRouter({
        enableLogging: false,
        defaultMaxRetries: 3,
        retryDelay: 10,
      });
      retryRouter.registerHandler(handler);

      const payload = createEmailPayload();
      const result = await retryRouter.route("notif-1", payload);

      expect(result.success).toBe(true);
      expect(handler.send).toHaveBeenCalledTimes(2);
    });

    it("should update statistics on routing", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const payload = createEmailPayload();
      await router.route("notif-1", payload);
      await router.route("notif-2", payload);

      const stats = router.getStats();
      expect(stats.totalRouted).toBe(2);
      expect(stats.totalSuccess).toBe(2);
      expect(stats.channelStats[NotificationChannel.EMAIL].success).toBe(2);
    });

    it("should track failed routing", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL, { sendSuccess: false });
      router.registerHandler(handler);

      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload);

      expect(result.success).toBe(false);
      const stats = router.getStats();
      expect(stats.totalFailed).toBe(1);
      expect(stats.channelStats[NotificationChannel.EMAIL].failed).toBe(1);
    });

    it("should not route when no channels available", async () => {
      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload);

      expect(result.success).toBe(false);
      expect(result.decision.shouldRoute).toBe(false);
    });
  });

  describe("Payload Adaptation", () => {
    it("should adapt email payload to other channels", async () => {
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.TELEGRAM]: { enabled: true },
      });
      preferences.defaultChannels = [NotificationChannel.TELEGRAM];
      router.setUserPreferences(preferences);

      const payload = createEmailPayload({
        metadata: { telegramChatId: "999" },
      });
      await router.route("notif-1", payload, "user1");

      // Handler should be called with adapted payload
      expect(telegramHandler.send).toHaveBeenCalled();
      const mockCalls = (telegramHandler.send as ReturnType<typeof vi.fn>).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const sentPayload = mockCalls[0]![0] as NotificationPayload;
      expect(sentPayload.channel).toBe(NotificationChannel.TELEGRAM);
    });
  });

  describe("Events", () => {
    it("should emit routing events", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const events: RouterEvent[] = [];
      router.on((event) => {
        events.push(event);
      });

      const payload = createEmailPayload();
      await router.route("notif-1", payload);

      expect(events.some((e) => e.type === "router:routing_started")).toBe(true);
      expect(events.some((e) => e.type === "router:channel_sending")).toBe(true);
      expect(events.some((e) => e.type === "router:channel_success")).toBe(true);
      expect(events.some((e) => e.type === "router:routing_completed")).toBe(true);
    });

    it("should emit fallback event when fallback is triggered", async () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL, {
        sendSuccess: false,
      });
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);
      router.registerHandler(emailHandler);
      router.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true, isFallback: true },
      });
      preferences.defaultChannels = [NotificationChannel.EMAIL];
      router.setUserPreferences(preferences);

      const events: RouterEvent[] = [];
      router.on((event) => {
        events.push(event);
      });

      const payload = createEmailPayload();
      await router.route("notif-1", payload, "user1");

      expect(events.some((e) => e.type === "router:fallback_triggered")).toBe(true);
    });

    it("should allow removing event handlers", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const events: RouterEvent[] = [];
      const eventHandler = (event: RouterEvent) => {
        events.push(event);
      };

      router.on(eventHandler);
      router.off(eventHandler);

      const payload = createEmailPayload();
      await router.route("notif-1", payload);

      expect(events).toHaveLength(0);
    });
  });

  describe("Statistics", () => {
    it("should reset statistics", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const payload = createEmailPayload();
      await router.route("notif-1", payload);

      let stats = router.getStats();
      expect(stats.totalRouted).toBe(1);

      router.resetStats();
      stats = router.getStats();

      expect(stats.totalRouted).toBe(0);
      expect(stats.totalSuccess).toBe(0);
      expect(stats.channelStats[NotificationChannel.EMAIL].success).toBe(0);
    });
  });

  describe("Singleton Management", () => {
    beforeEach(() => {
      resetNotificationRouter();
    });

    it("should return same instance from getNotificationRouter", () => {
      const router1 = getNotificationRouter();
      const router2 = getNotificationRouter();

      expect(router1).toBe(router2);
    });

    it("should reset singleton with resetNotificationRouter", () => {
      const router1 = getNotificationRouter();
      resetNotificationRouter();
      const router2 = getNotificationRouter();

      expect(router1).not.toBe(router2);
    });

    it("should set custom instance with setNotificationRouter", () => {
      const customRouter = new NotificationRouter();
      setNotificationRouter(customRouter);

      expect(getNotificationRouter()).toBe(customRouter);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetNotificationRouter();
    });

    it("should route notification via convenience function", async () => {
      const sharedRouter = getNotificationRouter({ enableLogging: false });
      const handler = createMockHandler(NotificationChannel.EMAIL);
      sharedRouter.registerHandler(handler);

      const payload = createEmailPayload();
      const result = await routeNotification("notif-1", payload);

      expect(result.success).toBe(true);
    });

    it("should set user preferences via convenience function", () => {
      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
      });

      setUserNotificationPreferences(preferences);
      const sharedRouter = getNotificationRouter();

      expect(sharedRouter.getUserPreferences("user1")).toEqual(preferences);
    });

    it("should register handler via convenience function", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      registerChannelHandler(handler);

      const sharedRouter = getNotificationRouter();
      expect(sharedRouter.hasHandler(NotificationChannel.EMAIL)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty preferences channels", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const preferences = createUserPreferences("user1", {});
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const decision = router.getRoutingDecision(payload, "user1");

      // Should fall back to default behavior
      expect(decision.shouldRoute).toBe(false);
    });

    it("should handle handler throwing exception", async () => {
      const handler: ChannelHandler = {
        channel: NotificationChannel.EMAIL,
        isAvailable: () => true,
        getStatus: () => "available",
        send: vi.fn().mockRejectedValue(new Error("Handler crashed")),
      };
      router.registerHandler(handler);

      const payload = createEmailPayload();
      const result = await router.route("notif-1", payload);

      expect(result.success).toBe(false);
      expect(result.channelResults[0]?.error).toBe("Handler crashed");
    });

    it("should continue routing on failure when configured", async () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL, {
        sendSuccess: false,
      });
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);

      const continueRouter = new NotificationRouter({
        enableLogging: false,
        continueOnFailure: true,
      });
      continueRouter.registerHandler(emailHandler);
      continueRouter.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true },
      });
      preferences.defaultChannels = [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM];
      continueRouter.setUserPreferences(preferences);

      const payload = createEmailPayload();
      const result = await continueRouter.route("notif-1", payload, "user1");

      // Should have attempted both channels
      expect(result.summary.attempted).toBe(2);
      expect(emailHandler.send).toHaveBeenCalled();
      expect(telegramHandler.send).toHaveBeenCalled();
    });

    it("should stop routing on failure when configured", async () => {
      const emailHandler = createMockHandler(NotificationChannel.EMAIL, {
        sendSuccess: false,
      });
      const telegramHandler = createMockHandler(NotificationChannel.TELEGRAM);

      const stopRouter = new NotificationRouter({
        enableLogging: false,
        continueOnFailure: false,
      });
      stopRouter.registerHandler(emailHandler);
      stopRouter.registerHandler(telegramHandler);

      const preferences = createUserPreferences("user1", {
        [NotificationChannel.EMAIL]: { enabled: true },
        [NotificationChannel.TELEGRAM]: { enabled: true },
      });
      preferences.defaultChannels = [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM];
      stopRouter.setUserPreferences(preferences);

      const payload = createEmailPayload();
      await stopRouter.route("notif-1", payload, "user1");

      // Should have stopped after first failure (excluding fallback attempts)
      expect(emailHandler.send).toHaveBeenCalled();
    });

    it("should handle invalid timezone in quiet hours gracefully", () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const preferences = createUserPreferences(
        "user1",
        { [NotificationChannel.EMAIL]: { enabled: true } },
        {
          defaultChannels: [NotificationChannel.EMAIL],
          quietHours: {
            enabled: true,
            start: "22:00",
            end: "08:00",
            timezone: "Invalid/Timezone",
          },
        }
      );
      router.setUserPreferences(preferences);

      const payload = createEmailPayload();
      // Should not throw
      const decision = router.getRoutingDecision(payload, "user1");

      // Invalid timezone should not block
      expect(decision).toBeDefined();
    });

    it("should handle async event handlers", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      let asyncHandlerCalled = false;
      router.on(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        asyncHandlerCalled = true;
      });

      const payload = createEmailPayload();
      await router.route("notif-1", payload);

      // Give async handler time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asyncHandlerCalled).toBe(true);
    });

    it("should handle event handler errors gracefully", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      router.on(() => {
        throw new Error("Event handler error");
      });

      const payload = createEmailPayload();
      // Should not throw despite event handler error
      const result = await router.route("notif-1", payload);

      expect(result.success).toBe(true);
    });
  });

  describe("RouteQueueItem", () => {
    it("should route a queue item", async () => {
      const handler = createMockHandler(NotificationChannel.EMAIL);
      router.registerHandler(handler);

      const queueItem = {
        id: "queue-1",
        payload: createEmailPayload(),
        priority: NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await router.routeQueueItem(queueItem);

      expect(result.notificationId).toBe("queue-1");
      expect(result.success).toBe(true);
    });
  });
});
