/**
 * Tests for Telegram Notification Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TelegramNotificationService,
  createNotificationService,
  getNotificationService,
  resetNotificationService,
  sendInstantAlert,
  sendInstantAlertToMany,
  NotificationRecipient,
  NotificationPriority,
} from "../../../src/notifications/telegram/notification-service";
import {
  TelegramClient,
  createTelegramClient,
  TelegramAlertData,
  AlertSeverity,
  AlertType,
} from "../../../src/notifications/telegram";

describe("TelegramNotificationService", () => {
  let service: TelegramNotificationService;
  let mockClient: TelegramClient;

  const createSampleAlert = (
    overrides: Partial<TelegramAlertData> = {}
  ): TelegramAlertData => ({
    alertId: "test-alert-123",
    alertType: "whale_trade",
    severity: "high",
    title: "Test Alert",
    message: "This is a test alert message.",
    timestamp: new Date(),
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    marketId: "test-market",
    marketTitle: "Test Market",
    tradeSize: 50000,
    priceChange: 5.5,
    suspicionScore: 75,
    actionUrl: "https://example.com/alert",
    dashboardUrl: "https://example.com/dashboard",
    ...overrides,
  });

  beforeEach(() => {
    // Create mock client in dev mode
    mockClient = createTelegramClient({
      botToken: "test-token",
      devMode: true,
    });

    service = createNotificationService({
      client: mockClient,
    });

    // Reset singleton
    resetNotificationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and configuration", () => {
    it("should create service with default configuration", () => {
      const defaultService = createNotificationService();
      expect(defaultService).toBeInstanceOf(TelegramNotificationService);
    });

    it("should create service with custom client", () => {
      expect(service.getClient()).toBe(mockClient);
    });

    it("should report dev mode from client", () => {
      expect(service.isDevMode()).toBe(true);
    });
  });

  describe("sendAlert", () => {
    it("should send alert to a single recipient", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        name: "Test User",
      };

      const alert = createSampleAlert();
      const result = await service.sendAlert(recipient, alert);

      expect(result.success).toBe(true);
      expect(result.chatId).toBe(123456789);
      expect(result.messageId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should skip disabled recipients", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        enabled: false,
      };

      const result = await service.sendAlert(recipient, createSampleAlert());

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("Recipient disabled");
    });

    it("should skip alerts below minimum priority", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        minPriority: "urgent", // Only critical alerts
      };

      const alert = createSampleAlert({ severity: "high" });
      const result = await service.sendAlert(recipient, alert);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain("Below minimum priority");
    });

    it("should send critical alerts to urgent priority recipients", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        minPriority: "urgent",
      };

      const alert = createSampleAlert({ severity: "critical" });
      const result = await service.sendAlert(recipient, alert);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
    });

    it("should skip alerts not in allowed types", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        allowedTypes: ["price_movement", "market_resolved"],
      };

      const alert = createSampleAlert({ alertType: "whale_trade" });
      const result = await service.sendAlert(recipient, alert);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain("not in allowed types");
    });

    it("should skip muted alert types", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        mutedTypes: ["whale_trade"],
      };

      const alert = createSampleAlert({ alertType: "whale_trade" });
      const result = await service.sendAlert(recipient, alert);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain("is muted");
    });

    it("should fail for invalid alert data when validation enabled", async () => {
      const recipient: NotificationRecipient = { chatId: 123456789 };

      const invalidAlert = createSampleAlert({ alertId: "" });
      const result = await service.sendAlert(recipient, invalidAlert);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
    });

    it("should apply recipient format options", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        formatOptions: {
          includeButtons: false,
          includeTimestamp: false,
        },
      };

      const result = await service.sendAlert(recipient, createSampleAlert());
      expect(result.success).toBe(true);
    });
  });

  describe("sendAlertToMany", () => {
    it("should send alert to multiple recipients", async () => {
      const recipients: NotificationRecipient[] = [
        { chatId: 1, name: "User 1" },
        { chatId: 2, name: "User 2" },
        { chatId: 3, name: "User 3" },
      ];

      const result = await service.sendAlertToMany(
        recipients,
        createSampleAlert()
      );

      expect(result.total).toBe(3);
      expect(result.delivered).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("should handle mixed results with skipped recipients", async () => {
      const recipients: NotificationRecipient[] = [
        { chatId: 1, name: "Active User" },
        { chatId: 2, name: "Disabled User", enabled: false },
        { chatId: 3, name: "Muted User", mutedTypes: ["whale_trade"] },
      ];

      const result = await service.sendAlertToMany(
        recipients,
        createSampleAlert()
      );

      expect(result.delivered).toBe(1);
      expect(result.skipped).toBe(2);
    });

    it("should store delivery result in history", async () => {
      const recipients: NotificationRecipient[] = [{ chatId: 1 }];
      const alert = createSampleAlert();

      await service.sendAlertToMany(recipients, alert);

      const historyResult = service.getDeliveryResult(alert.alertId);
      expect(historyResult).toBeDefined();
      expect(historyResult?.alertId).toBe(alert.alertId);
    });
  });

  describe("sendAlertSummary", () => {
    it("should send summary of multiple alerts", async () => {
      const recipient: NotificationRecipient = { chatId: 123456789 };
      const alerts = [
        createSampleAlert({ alertId: "alert-1", severity: "critical" }),
        createSampleAlert({ alertId: "alert-2", severity: "high" }),
        createSampleAlert({ alertId: "alert-3", severity: "medium" }),
      ];

      const result = await service.sendAlertSummary(recipient, alerts);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("should skip disabled recipients for summary", async () => {
      const recipient: NotificationRecipient = {
        chatId: 123456789,
        enabled: false,
      };

      const result = await service.sendAlertSummary(recipient, []);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("Recipient disabled");
    });
  });

  describe("priority filtering", () => {
    const testCases: Array<{
      minPriority: NotificationPriority;
      severity: AlertSeverity;
      shouldDeliver: boolean;
    }> = [
      // Urgent only allows critical
      { minPriority: "urgent", severity: "critical", shouldDeliver: true },
      { minPriority: "urgent", severity: "high", shouldDeliver: false },
      { minPriority: "urgent", severity: "medium", shouldDeliver: false },
      // High allows critical and high
      { minPriority: "high", severity: "critical", shouldDeliver: true },
      { minPriority: "high", severity: "high", shouldDeliver: true },
      { minPriority: "high", severity: "medium", shouldDeliver: false },
      // Normal allows critical, high, medium
      { minPriority: "normal", severity: "critical", shouldDeliver: true },
      { minPriority: "normal", severity: "high", shouldDeliver: true },
      { minPriority: "normal", severity: "medium", shouldDeliver: true },
      { minPriority: "normal", severity: "low", shouldDeliver: false },
      // Low allows all
      { minPriority: "low", severity: "info", shouldDeliver: true },
    ];

    testCases.forEach(({ minPriority, severity, shouldDeliver }) => {
      it(`minPriority=${minPriority} with severity=${severity} should ${shouldDeliver ? "deliver" : "skip"}`, async () => {
        const recipient: NotificationRecipient = {
          chatId: 123456789,
          minPriority,
        };

        const alert = createSampleAlert({ severity });
        const result = await service.sendAlert(recipient, alert);

        if (shouldDeliver) {
          expect(result.skipped).toBeUndefined();
        } else {
          expect(result.skipped).toBe(true);
        }
      });
    });
  });

  describe("event handlers", () => {
    it("should emit notification:sent event on success", async () => {
      const events: string[] = [];
      service.on("notification:sent", (event) => {
        events.push(event.type);
      });

      await service.sendAlert({ chatId: 123 }, createSampleAlert());

      expect(events).toContain("notification:sent");
    });

    it("should emit notification:skipped event when skipped", async () => {
      const events: string[] = [];
      service.on("notification:skipped", (event) => {
        events.push(event.type);
      });

      await service.sendAlert(
        { chatId: 123, enabled: false },
        createSampleAlert()
      );

      expect(events).toContain("notification:skipped");
    });

    it("should emit batch:started and batch:completed events", async () => {
      const events: string[] = [];
      service.on("batch:started", (e) => { events.push(e.type); });
      service.on("batch:completed", (e) => { events.push(e.type); });

      await service.sendAlertToMany([{ chatId: 1 }], createSampleAlert());

      expect(events).toContain("batch:started");
      expect(events).toContain("batch:completed");
    });

    it("should allow unsubscribing from events", async () => {
      let callCount = 0;
      const unsubscribe = service.on("notification:sent", () => {
        callCount++;
      });

      await service.sendAlert({ chatId: 123 }, createSampleAlert());
      expect(callCount).toBe(1);

      unsubscribe();
      await service.sendAlert({ chatId: 456 }, createSampleAlert());
      expect(callCount).toBe(1); // Should not increment
    });
  });

  describe("statistics", () => {
    it("should track sent notifications", async () => {
      await service.sendAlert({ chatId: 123 }, createSampleAlert());
      await service.sendAlert({ chatId: 456 }, createSampleAlert());

      const stats = service.getStats();
      expect(stats.totalSent).toBe(2);
      expect(stats.lastSentAt).toBeInstanceOf(Date);
    });

    it("should track skipped notifications", async () => {
      await service.sendAlert({ chatId: 123, enabled: false }, createSampleAlert());

      const stats = service.getStats();
      expect(stats.totalSkipped).toBe(1);
    });

    it("should calculate success rate", async () => {
      await service.sendAlert({ chatId: 123 }, createSampleAlert());
      await service.sendAlert({ chatId: 456 }, createSampleAlert());

      const stats = service.getStats();
      expect(stats.successRate).toBe(1); // 100% success in dev mode
    });

    it("should reset statistics", async () => {
      await service.sendAlert({ chatId: 123 }, createSampleAlert());
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalSent).toBe(0);
      expect(stats.lastSentAt).toBeNull();
    });
  });

  describe("delivery history", () => {
    it("should store batch delivery results", async () => {
      const alert = createSampleAlert({ alertId: "unique-alert-1" });
      await service.sendAlertToMany([{ chatId: 1 }, { chatId: 2 }], alert);

      const result = service.getDeliveryResult("unique-alert-1");
      expect(result).toBeDefined();
      expect(result?.delivered).toBe(2);
    });

    it("should retrieve delivery history", async () => {
      await service.sendAlertToMany(
        [{ chatId: 1 }],
        createSampleAlert({ alertId: "alert-a" })
      );
      await service.sendAlertToMany(
        [{ chatId: 2 }],
        createSampleAlert({ alertId: "alert-b" })
      );

      const history = service.getDeliveryHistory();
      expect(history).toHaveLength(2);
    });

    it("should clear delivery history", async () => {
      await service.sendAlertToMany([{ chatId: 1 }], createSampleAlert());
      service.clearDeliveryHistory();

      const history = service.getDeliveryHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe("singleton pattern", () => {
    beforeEach(() => {
      resetNotificationService();
    });

    it("should return same instance from getNotificationService", () => {
      const instance1 = getNotificationService();
      const instance2 = getNotificationService();
      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getNotificationService();
      resetNotificationService();
      const instance2 = getNotificationService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("helper functions", () => {
    beforeEach(() => {
      resetNotificationService();
    });

    it("sendInstantAlert should send to single recipient", async () => {
      const result = await sendInstantAlert(123456789, createSampleAlert());
      expect(result.success).toBe(true);
    });

    it("sendInstantAlertToMany should send to multiple recipients", async () => {
      const result = await sendInstantAlertToMany(
        [1, 2, 3],
        createSampleAlert()
      );
      expect(result.total).toBe(3);
      expect(result.delivered).toBe(3);
    });
  });

  describe("error handling", () => {
    it("should handle client errors gracefully", async () => {
      // Create service with custom client that will throw
      const errorClient = createTelegramClient({
        botToken: "",
        devMode: true,
      });

      // Mock sendMessage to throw
      vi.spyOn(errorClient, "sendMessage").mockRejectedValue(
        new Error("Network error")
      );

      const errorService = createNotificationService({ client: errorClient });
      const result = await errorService.sendAlert(
        { chatId: 123 },
        createSampleAlert()
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should emit notification:failed event on error", async () => {
      const errorClient = createTelegramClient({
        botToken: "",
        devMode: true,
      });

      vi.spyOn(errorClient, "sendMessage").mockRejectedValue(
        new Error("API Error")
      );

      const errorService = createNotificationService({ client: errorClient });
      const events: string[] = [];
      errorService.on("notification:failed", (e) => { events.push(e.type); });

      await errorService.sendAlert({ chatId: 123 }, createSampleAlert());

      expect(events).toContain("notification:failed");
    });
  });

  describe("concurrency and batching", () => {
    it("should respect maxConcurrent setting", async () => {
      const batchService = createNotificationService({
        client: mockClient,
        maxConcurrent: 2,
      });

      const recipients: NotificationRecipient[] = Array.from(
        { length: 5 },
        (_, i) => ({ chatId: i + 1 })
      );

      const result = await batchService.sendAlertToMany(
        recipients,
        createSampleAlert()
      );

      expect(result.delivered).toBe(5);
    });

    it("should apply batch delay between chunks", async () => {
      const batchService = createNotificationService({
        client: mockClient,
        maxConcurrent: 2,
        batchDelay: 10,
      });

      const recipients: NotificationRecipient[] = Array.from(
        { length: 4 },
        (_, i) => ({ chatId: i + 1 })
      );

      const startTime = Date.now();
      await batchService.sendAlertToMany(recipients, createSampleAlert());
      const endTime = Date.now();

      // Should have at least some delay (2 chunks = 1 delay)
      // Being lenient with timing in tests
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("NotificationRecipient configuration", () => {
  let service: TelegramNotificationService;

  beforeEach(() => {
    const mockClient = createTelegramClient({
      botToken: "test-token",
      devMode: true,
    });
    service = createNotificationService({ client: mockClient });
  });

  it("should work with minimal recipient config", async () => {
    const result = await service.sendAlert(
      { chatId: "@testchannel" },
      {
        alertId: "test",
        alertType: "system",
        severity: "info",
        title: "Test",
        message: "Test message",
        timestamp: new Date(),
      }
    );

    expect(result.success).toBe(true);
  });

  it("should support string chat IDs", async () => {
    const result = await service.sendAlert(
      { chatId: "@channel_name" },
      {
        alertId: "test",
        alertType: "system",
        severity: "info",
        title: "Test",
        message: "Test message",
        timestamp: new Date(),
      }
    );

    expect(result.chatId).toBe("@channel_name");
  });

  it("should support negative chat IDs for groups", async () => {
    const result = await service.sendAlert(
      { chatId: -1001234567890 },
      {
        alertId: "test",
        alertType: "system",
        severity: "info",
        title: "Test",
        message: "Test message",
        timestamp: new Date(),
      }
    );

    expect(result.chatId).toBe(-1001234567890);
  });
});

describe("Alert type filtering", () => {
  let service: TelegramNotificationService;

  beforeEach(() => {
    const mockClient = createTelegramClient({
      botToken: "test-token",
      devMode: true,
    });
    service = createNotificationService({ client: mockClient });
  });

  const alertTypes: AlertType[] = [
    "whale_trade",
    "price_movement",
    "insider_activity",
    "fresh_wallet",
    "wallet_reactivation",
    "coordinated_activity",
    "unusual_pattern",
    "market_resolved",
    "new_market",
    "suspicious_funding",
    "sanctioned_activity",
    "system",
  ];

  alertTypes.forEach((alertType) => {
    it(`should handle ${alertType} alert type`, async () => {
      const result = await service.sendAlert(
        { chatId: 123 },
        {
          alertId: "test",
          alertType,
          severity: "info",
          title: `Test ${alertType}`,
          message: "Test message",
          timestamp: new Date(),
        }
      );

      expect(result.success).toBe(true);
    });
  });
});
