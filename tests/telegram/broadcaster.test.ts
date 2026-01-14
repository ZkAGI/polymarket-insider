/**
 * Unit tests for Telegram Alert Broadcaster Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertType, AlertSeverity } from "@prisma/client";
import type { Alert, TelegramSubscriber } from "@prisma/client";
import {
  formatAlertMessage,
  formatAlertType,
  formatNumber,
  formatTimestamp,
  escapeMarkdown,
  getSeverityEmoji,
  getAlertTypeEmoji,
  meetsSeverityRequirement,
  matchesAlertPreferences,
  filterEligibleSubscribers,
  shouldDeactivateOnError,
  sendAlertToSubscriber,
  broadcastAlert,
  AlertBroadcaster,
  createAlertBroadcaster,
} from "../../src/telegram/broadcaster";
import { TelegramSubscriberService, TelegramChatType } from "../../src/db/telegram-subscribers";
import { TelegramBotClient } from "../../src/telegram/bot";

// Mock the database client
vi.mock("../../src/db/client", () => ({
  prisma: {
    alert: {
      findUnique: vi.fn(),
    },
    telegramSubscriber: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the env module
vi.mock("../../config/env", () => ({
  env: {
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_ADMIN_IDS: [12345],
  },
}));

/**
 * Create a mock Alert
 */
function createMockAlert(overrides?: Partial<Alert>): Alert {
  return {
    id: "alert-123",
    type: AlertType.WHALE_TRADE,
    severity: AlertSeverity.HIGH,
    marketId: "market-123",
    walletId: "wallet-123",
    title: "Large Whale Trade Detected",
    message: "A whale just made a $50,000 trade on the US Election market",
    data: {
      tradeValue: 50000,
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      marketQuestion: "Will Trump win the 2024 election?",
    },
    tags: ["whale", "election"],
    read: false,
    acknowledged: false,
    dismissed: false,
    actionBy: null,
    actionAt: null,
    createdAt: new Date("2026-01-14T10:00:00Z"),
    expiresAt: null,
    ...overrides,
  };
}

/**
 * Create a mock TelegramSubscriber
 */
function createMockSubscriber(overrides?: Partial<TelegramSubscriber>): TelegramSubscriber {
  return {
    id: "sub-123",
    chatId: BigInt(123456789),
    chatType: TelegramChatType.PRIVATE,
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    title: null,
    languageCode: "en",
    isActive: true,
    isAdmin: false,
    alertPreferences: null,
    minSeverity: AlertSeverity.INFO,
    isBlocked: false,
    alertsSent: 0,
    lastAlertAt: null,
    deactivationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock TelegramSubscriberService
 */
function createMockSubscriberService(): TelegramSubscriberService {
  return {
    findByChatId: vi.fn(),
    create: vi.fn(),
    activate: vi.fn(),
    updateByChatId: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByChatId: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    findActive: vi.fn().mockResolvedValue([]),
    findActiveByType: vi.fn(),
    findAdmins: vi.fn(),
    deactivate: vi.fn(),
    markBlocked: vi.fn(),
    markBlockedWithReason: vi.fn(),
    incrementAlertsSent: vi.fn(),
    updateAlertPreferences: vi.fn(),
    updateMinSeverity: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ total: 0, active: 0, blocked: 0, byType: {} }),
    isSubscribed: vi.fn(),
    isAdmin: vi.fn(),
    cleanupInactiveSubscribers: vi.fn().mockResolvedValue([]),
    findInactiveSubscribers: vi.fn().mockResolvedValue([]),
    reactivate: vi.fn(),
  } as unknown as TelegramSubscriberService;
}

/**
 * Create a mock TelegramBotClient
 */
function createMockBotClient(): TelegramBotClient {
  return {
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 12345 }),
    getStatus: vi.fn().mockReturnValue("running"),
    hasToken: vi.fn().mockReturnValue(true),
  } as unknown as TelegramBotClient;
}

describe("Broadcaster Helper Functions", () => {
  describe("getSeverityEmoji", () => {
    it("should return correct emoji for INFO", () => {
      expect(getSeverityEmoji(AlertSeverity.INFO)).toBe("ℹ️");
    });

    it("should return correct emoji for LOW", () => {
      expect(getSeverityEmoji(AlertSeverity.LOW)).toBe("🔵");
    });

    it("should return correct emoji for MEDIUM", () => {
      expect(getSeverityEmoji(AlertSeverity.MEDIUM)).toBe("🟡");
    });

    it("should return correct emoji for HIGH", () => {
      expect(getSeverityEmoji(AlertSeverity.HIGH)).toBe("🟠");
    });

    it("should return correct emoji for CRITICAL", () => {
      expect(getSeverityEmoji(AlertSeverity.CRITICAL)).toBe("🔴");
    });
  });

  describe("getAlertTypeEmoji", () => {
    it("should return whale emoji for WHALE_TRADE", () => {
      expect(getAlertTypeEmoji(AlertType.WHALE_TRADE)).toBe("🐋");
    });

    it("should return detective emoji for INSIDER_ACTIVITY", () => {
      expect(getAlertTypeEmoji(AlertType.INSIDER_ACTIVITY)).toBe("🕵️");
    });

    it("should return chart emoji for PRICE_MOVEMENT", () => {
      expect(getAlertTypeEmoji(AlertType.PRICE_MOVEMENT)).toBe("📈");
    });

    it("should return new emoji for FRESH_WALLET", () => {
      expect(getAlertTypeEmoji(AlertType.FRESH_WALLET)).toBe("🆕");
    });

    it("should return clock emoji for WALLET_REACTIVATION", () => {
      expect(getAlertTypeEmoji(AlertType.WALLET_REACTIVATION)).toBe("⏰");
    });

    it("should return link emoji for COORDINATED_ACTIVITY", () => {
      expect(getAlertTypeEmoji(AlertType.COORDINATED_ACTIVITY)).toBe("🔗");
    });

    it("should return warning emoji for UNUSUAL_PATTERN", () => {
      expect(getAlertTypeEmoji(AlertType.UNUSUAL_PATTERN)).toBe("⚠️");
    });

    it("should return check emoji for MARKET_RESOLVED", () => {
      expect(getAlertTypeEmoji(AlertType.MARKET_RESOLVED)).toBe("✅");
    });

    it("should return new emoji for NEW_MARKET", () => {
      expect(getAlertTypeEmoji(AlertType.NEW_MARKET)).toBe("🆕");
    });

    it("should return money emoji for SUSPICIOUS_FUNDING", () => {
      expect(getAlertTypeEmoji(AlertType.SUSPICIOUS_FUNDING)).toBe("💰");
    });
  });

  describe("formatAlertType", () => {
    it("should format WHALE_TRADE correctly", () => {
      expect(formatAlertType(AlertType.WHALE_TRADE)).toBe("Whale Trade");
    });

    it("should format INSIDER_ACTIVITY correctly", () => {
      expect(formatAlertType(AlertType.INSIDER_ACTIVITY)).toBe("Insider Activity");
    });

    it("should format PRICE_MOVEMENT correctly", () => {
      expect(formatAlertType(AlertType.PRICE_MOVEMENT)).toBe("Price Movement");
    });

    it("should format COORDINATED_ACTIVITY correctly", () => {
      expect(formatAlertType(AlertType.COORDINATED_ACTIVITY)).toBe("Coordinated Activity");
    });
  });

  describe("formatNumber", () => {
    it("should format integer correctly", () => {
      expect(formatNumber(1000)).toBe("1,000");
    });

    it("should format decimal correctly", () => {
      expect(formatNumber(1234.56)).toBe("1,234.56");
    });

    it("should format large number correctly", () => {
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    it("should handle zero", () => {
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("formatTimestamp", () => {
    it("should format date correctly", () => {
      const date = new Date("2026-01-14T10:30:00Z");
      const formatted = formatTimestamp(date);
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("14");
    });
  });

  describe("escapeMarkdown", () => {
    it("should escape underscores", () => {
      expect(escapeMarkdown("hello_world")).toBe("hello\\_world");
    });

    it("should escape asterisks", () => {
      expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*");
    });

    it("should escape brackets", () => {
      expect(escapeMarkdown("[link](url)")).toBe("\\[link\\]\\(url\\)");
    });

    it("should escape backticks", () => {
      expect(escapeMarkdown("`code`")).toBe("\\`code\\`");
    });

    it("should not modify plain text", () => {
      expect(escapeMarkdown("hello world")).toBe("hello world");
    });
  });
});

describe("Severity Comparison", () => {
  describe("meetsSeverityRequirement", () => {
    it("should return true when alert severity meets minimum", () => {
      expect(meetsSeverityRequirement(AlertSeverity.HIGH, AlertSeverity.HIGH)).toBe(true);
    });

    it("should return true when alert severity exceeds minimum", () => {
      expect(meetsSeverityRequirement(AlertSeverity.CRITICAL, AlertSeverity.HIGH)).toBe(true);
    });

    it("should return false when alert severity is below minimum", () => {
      expect(meetsSeverityRequirement(AlertSeverity.LOW, AlertSeverity.HIGH)).toBe(false);
    });

    it("should return true when minimum is INFO and alert is any severity", () => {
      expect(meetsSeverityRequirement(AlertSeverity.INFO, AlertSeverity.INFO)).toBe(true);
      expect(meetsSeverityRequirement(AlertSeverity.LOW, AlertSeverity.INFO)).toBe(true);
      expect(meetsSeverityRequirement(AlertSeverity.MEDIUM, AlertSeverity.INFO)).toBe(true);
      expect(meetsSeverityRequirement(AlertSeverity.HIGH, AlertSeverity.INFO)).toBe(true);
      expect(meetsSeverityRequirement(AlertSeverity.CRITICAL, AlertSeverity.INFO)).toBe(true);
    });

    it("should return true only for CRITICAL when minimum is CRITICAL", () => {
      expect(meetsSeverityRequirement(AlertSeverity.INFO, AlertSeverity.CRITICAL)).toBe(false);
      expect(meetsSeverityRequirement(AlertSeverity.LOW, AlertSeverity.CRITICAL)).toBe(false);
      expect(meetsSeverityRequirement(AlertSeverity.MEDIUM, AlertSeverity.CRITICAL)).toBe(false);
      expect(meetsSeverityRequirement(AlertSeverity.HIGH, AlertSeverity.CRITICAL)).toBe(false);
      expect(meetsSeverityRequirement(AlertSeverity.CRITICAL, AlertSeverity.CRITICAL)).toBe(true);
    });
  });
});

describe("Alert Preference Matching", () => {
  describe("matchesAlertPreferences", () => {
    it("should match when subscriber has no preferences set", () => {
      const alert = createMockAlert({ severity: AlertSeverity.HIGH });
      const subscriber = createMockSubscriber({ alertPreferences: null });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject when alert severity is below minimum", () => {
      const alert = createMockAlert({ severity: AlertSeverity.LOW });
      const subscriber = createMockSubscriber({ minSeverity: AlertSeverity.HIGH });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should accept when alert severity meets minimum", () => {
      const alert = createMockAlert({ severity: AlertSeverity.HIGH });
      const subscriber = createMockSubscriber({ minSeverity: AlertSeverity.HIGH });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject whale alerts when whaleAlerts is false", () => {
      const alert = createMockAlert({ type: AlertType.WHALE_TRADE });
      const subscriber = createMockSubscriber({
        alertPreferences: { whaleAlerts: false },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should accept whale alerts when whaleAlerts is true", () => {
      const alert = createMockAlert({ type: AlertType.WHALE_TRADE });
      const subscriber = createMockSubscriber({
        alertPreferences: { whaleAlerts: true },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject insider alerts when insiderAlerts is false", () => {
      const alert = createMockAlert({ type: AlertType.INSIDER_ACTIVITY });
      const subscriber = createMockSubscriber({
        alertPreferences: { insiderAlerts: false },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should reject fresh wallet alerts when insiderAlerts is false", () => {
      const alert = createMockAlert({ type: AlertType.FRESH_WALLET });
      const subscriber = createMockSubscriber({
        alertPreferences: { insiderAlerts: false },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should reject coordinated activity alerts when insiderAlerts is false", () => {
      const alert = createMockAlert({ type: AlertType.COORDINATED_ACTIVITY });
      const subscriber = createMockSubscriber({
        alertPreferences: { insiderAlerts: false },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should reject alerts with trade value below minimum", () => {
      const alert = createMockAlert({
        data: { tradeValue: 5000 },
      });
      const subscriber = createMockSubscriber({
        alertPreferences: { minTradeValue: 10000 },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should accept alerts with trade value above minimum", () => {
      const alert = createMockAlert({
        data: { tradeValue: 50000 },
      });
      const subscriber = createMockSubscriber({
        alertPreferences: { minTradeValue: 10000 },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should accept alerts when trade value equals minimum", () => {
      const alert = createMockAlert({
        data: { tradeValue: 10000 },
      });
      const subscriber = createMockSubscriber({
        alertPreferences: { minTradeValue: 10000 },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject alerts for markets not in watchedMarkets list", () => {
      const alert = createMockAlert({ marketId: "market-456" });
      const subscriber = createMockSubscriber({
        alertPreferences: { watchedMarkets: ["market-123", "market-789"] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should accept alerts for markets in watchedMarkets list", () => {
      const alert = createMockAlert({ marketId: "market-123" });
      const subscriber = createMockSubscriber({
        alertPreferences: { watchedMarkets: ["market-123", "market-789"] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should accept all markets when watchedMarkets is empty", () => {
      const alert = createMockAlert({ marketId: "market-123" });
      const subscriber = createMockSubscriber({
        alertPreferences: { watchedMarkets: [] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject alerts when type is in disabledTypes", () => {
      const alert = createMockAlert({ type: AlertType.PRICE_MOVEMENT });
      const subscriber = createMockSubscriber({
        alertPreferences: { disabledTypes: [AlertType.PRICE_MOVEMENT] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });

    it("should accept alerts when type is not in disabledTypes", () => {
      const alert = createMockAlert({ type: AlertType.WHALE_TRADE });
      const subscriber = createMockSubscriber({
        alertPreferences: { disabledTypes: [AlertType.PRICE_MOVEMENT] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should accept alerts when type is in enabledTypes", () => {
      const alert = createMockAlert({ type: AlertType.WHALE_TRADE });
      const subscriber = createMockSubscriber({
        alertPreferences: { enabledTypes: [AlertType.WHALE_TRADE] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(true);
    });

    it("should reject alerts when type is not in enabledTypes and list is non-empty", () => {
      const alert = createMockAlert({ type: AlertType.PRICE_MOVEMENT });
      const subscriber = createMockSubscriber({
        alertPreferences: { enabledTypes: [AlertType.WHALE_TRADE] },
      });
      expect(matchesAlertPreferences(alert, subscriber)).toBe(false);
    });
  });

  describe("filterEligibleSubscribers", () => {
    it("should return empty array when all subscribers are filtered out", () => {
      const alert = createMockAlert({ severity: AlertSeverity.LOW });
      const subscribers = [
        createMockSubscriber({ minSeverity: AlertSeverity.HIGH, chatId: BigInt(1) }),
        createMockSubscriber({ minSeverity: AlertSeverity.CRITICAL, chatId: BigInt(2) }),
      ];
      expect(filterEligibleSubscribers(alert, subscribers)).toHaveLength(0);
    });

    it("should return all subscribers when none are filtered", () => {
      const alert = createMockAlert({ severity: AlertSeverity.HIGH });
      const subscribers = [
        createMockSubscriber({ minSeverity: AlertSeverity.INFO, chatId: BigInt(1) }),
        createMockSubscriber({ minSeverity: AlertSeverity.LOW, chatId: BigInt(2) }),
      ];
      expect(filterEligibleSubscribers(alert, subscribers)).toHaveLength(2);
    });

    it("should return only eligible subscribers", () => {
      const alert = createMockAlert({ severity: AlertSeverity.MEDIUM });
      const subscribers = [
        createMockSubscriber({ minSeverity: AlertSeverity.INFO, chatId: BigInt(1) }),
        createMockSubscriber({ minSeverity: AlertSeverity.HIGH, chatId: BigInt(2) }),
        createMockSubscriber({ minSeverity: AlertSeverity.MEDIUM, chatId: BigInt(3) }),
      ];
      const eligible = filterEligibleSubscribers(alert, subscribers);
      expect(eligible).toHaveLength(2);
      expect(eligible[0]!.chatId).toBe(BigInt(1));
      expect(eligible[1]!.chatId).toBe(BigInt(3));
    });
  });
});

describe("Error Handling", () => {
  describe("shouldDeactivateOnError", () => {
    it("should return true for forbidden errors", () => {
      const result = shouldDeactivateOnError("Forbidden: bot was blocked by the user");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("User blocked the bot");
    });

    it("should return true for 403 errors", () => {
      const result = shouldDeactivateOnError("Error 403: Access denied");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("User blocked the bot");
    });

    it("should return true for chat not found errors", () => {
      const result = shouldDeactivateOnError("Bad Request: chat not found");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("Chat not found");
    });

    it("should return true for 400 errors", () => {
      const result = shouldDeactivateOnError("Error 400: Bad request");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("Chat not found");
    });

    it("should return true for user deactivated errors", () => {
      const result = shouldDeactivateOnError("user is deactivated");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("User account is deactivated");
    });

    it("should return true for kicked errors", () => {
      const result = shouldDeactivateOnError("bot was kicked from the group");
      expect(result.shouldDeactivate).toBe(true);
      expect(result.reason).toBe("Bot was kicked from chat");
    });

    it("should return false for network errors", () => {
      const result = shouldDeactivateOnError("Network timeout");
      expect(result.shouldDeactivate).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should return false for rate limit errors", () => {
      const result = shouldDeactivateOnError("Too many requests: retry after 10");
      expect(result.shouldDeactivate).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should return false for internal server errors", () => {
      const result = shouldDeactivateOnError("Internal Server Error");
      expect(result.shouldDeactivate).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });
});

describe("formatAlertMessage", () => {
  it("should format alert message with all components", () => {
    const alert = createMockAlert();
    const message = formatAlertMessage(alert);

    expect(message).toContain("🟠"); // HIGH severity
    expect(message).toContain("🐋"); // WHALE_TRADE type
    expect(message).toContain("Large Whale Trade Detected");
    expect(message).toContain("$50,000 trade");
    expect(message).toContain("Severity: High");
    expect(message).toContain("Type: Whale Trade");
  });

  it("should include trade value when present", () => {
    const alert = createMockAlert({
      data: { tradeValue: 100000 },
    });
    const message = formatAlertMessage(alert);
    expect(message).toContain("$100,000");
  });

  it("should include wallet address when present", () => {
    const alert = createMockAlert({
      data: { walletAddress: "0x1234567890abcdef1234567890abcdef12345678" },
    });
    const message = formatAlertMessage(alert);
    expect(message).toContain("0x1234");
    expect(message).toContain("5678");
  });

  it("should include market question when present", () => {
    const alert = createMockAlert({
      data: { marketQuestion: "Will BTC reach $100k?" },
    });
    const message = formatAlertMessage(alert);
    // The escapeMarkdown function escapes $ and ?
    expect(message).toContain("Market:");
    expect(message).toContain("BTC reach");
  });

  it("should handle alert with no data", () => {
    const alert = createMockAlert({ data: null });
    const message = formatAlertMessage(alert);
    expect(message).toContain("Large Whale Trade Detected");
    expect(message).not.toContain("Trade Value:");
  });

  it("should format different severity levels correctly", () => {
    const infoAlert = createMockAlert({ severity: AlertSeverity.INFO });
    expect(formatAlertMessage(infoAlert)).toContain("ℹ️");

    const criticalAlert = createMockAlert({ severity: AlertSeverity.CRITICAL });
    expect(formatAlertMessage(criticalAlert)).toContain("🔴");
  });
});

describe("sendAlertToSubscriber", () => {
  let mockBotClient: TelegramBotClient;
  let mockSubscriberService: TelegramSubscriberService;

  beforeEach(() => {
    mockBotClient = createMockBotClient();
    mockSubscriberService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should send alert and increment counter on success", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      false
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(12345);
    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "123456789",
      expect.any(String),
      expect.objectContaining({ parseMode: "Markdown" })
    );
    expect(mockSubscriberService.incrementAlertsSent).toHaveBeenCalledWith(BigInt(123456789));
  });

  it("should return success in dry run mode without sending", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      true // dry run
    );

    expect(result.success).toBe(true);
    expect(mockBotClient.sendMessage).not.toHaveBeenCalled();
    expect(mockSubscriberService.incrementAlertsSent).not.toHaveBeenCalled();
  });

  it("should mark user as blocked on forbidden error", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();
    vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
      success: false,
      error: "Forbidden: bot was blocked by the user",
    });

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      false
    );

    expect(result.success).toBe(false);
    expect(result.shouldDeactivate).toBe(true);
    expect(result.deactivationReason).toBe("User blocked the bot");
    expect(mockSubscriberService.markBlockedWithReason).toHaveBeenCalledWith(
      BigInt(123456789),
      "User blocked the bot",
      "BLOCKED_BY_USER"
    );
  });

  it("should mark user as blocked on chat not found error", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();
    vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
      success: false,
      error: "Bad Request: chat not found",
    });

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      false
    );

    expect(result.success).toBe(false);
    expect(result.shouldDeactivate).toBe(true);
    expect(result.deactivationReason).toBe("Chat not found");
    expect(mockSubscriberService.markBlockedWithReason).toHaveBeenCalledWith(
      BigInt(123456789),
      "Chat not found",
      "CHAT_NOT_FOUND"
    );
  });

  it("should not deactivate on network error", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();
    vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
      success: false,
      error: "Network timeout",
    });

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      false
    );

    expect(result.success).toBe(false);
    expect(result.shouldDeactivate).toBeUndefined();
    expect(mockSubscriberService.markBlocked).not.toHaveBeenCalled();
  });

  it("should handle exceptions gracefully", async () => {
    const alert = createMockAlert();
    const subscriber = createMockSubscriber();
    vi.mocked(mockBotClient.sendMessage).mockRejectedValue(new Error("Connection failed"));

    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      mockBotClient,
      mockSubscriberService,
      false
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection failed");
  });
});

describe("broadcastAlert", () => {
  let mockBotClient: TelegramBotClient;
  let mockSubscriberService: TelegramSubscriberService;

  beforeEach(() => {
    mockBotClient = createMockBotClient();
    mockSubscriberService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should broadcast to all eligible subscribers", async () => {
    const alert = createMockAlert();
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
      createMockSubscriber({ chatId: BigInt(3) }),
    ];
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue(subscribers);

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
      sendDelay: 0,
    });

    expect(result.totalSubscribers).toBe(3);
    expect(result.eligibleSubscribers).toBe(3);
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(mockBotClient.sendMessage).toHaveBeenCalledTimes(3);
  });

  it("should filter subscribers by preferences", async () => {
    const alert = createMockAlert({ type: AlertType.WHALE_TRADE });
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1), alertPreferences: { whaleAlerts: true } }),
      createMockSubscriber({ chatId: BigInt(2), alertPreferences: { whaleAlerts: false } }),
      createMockSubscriber({ chatId: BigInt(3), alertPreferences: null }),
    ];
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue(subscribers);

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
      sendDelay: 0,
    });

    expect(result.totalSubscribers).toBe(3);
    expect(result.eligibleSubscribers).toBe(2);
    expect(result.sent).toBe(2);
    expect(mockBotClient.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("should track failed sends", async () => {
    const alert = createMockAlert();
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
    ];
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockBotClient.sendMessage)
      .mockResolvedValueOnce({ success: true, messageId: 1 })
      .mockResolvedValueOnce({ success: false, error: "Network error" });

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
      sendDelay: 0,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("should track deactivated users", async () => {
    const alert = createMockAlert();
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
    ];
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockBotClient.sendMessage)
      .mockResolvedValueOnce({ success: true, messageId: 1 })
      .mockResolvedValueOnce({ success: false, error: "Forbidden: bot was blocked" });

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
      sendDelay: 0,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.deactivated).toBe(1);
  });

  it("should handle dry run mode", async () => {
    const alert = createMockAlert();
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
    ];
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue(subscribers);

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
      dryRun: true,
      sendDelay: 0,
    });

    expect(result.sent).toBe(2);
    expect(mockBotClient.sendMessage).not.toHaveBeenCalled();
  });

  it("should return correct statistics", async () => {
    const alert = createMockAlert();
    vi.mocked(mockSubscriberService.findActive).mockResolvedValue([]);

    const result = await broadcastAlert(alert, {
      botClient: mockBotClient,
      subscriberService: mockSubscriberService,
    });

    expect(result.alertId).toBe("alert-123");
    expect(result.totalSubscribers).toBe(0);
    expect(result.eligibleSubscribers).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.deactivated).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("AlertBroadcaster Class", () => {
  let mockBotClient: TelegramBotClient;
  let mockSubscriberService: TelegramSubscriberService;

  beforeEach(() => {
    mockBotClient = createMockBotClient();
    mockSubscriberService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  describe("createAlertBroadcaster", () => {
    it("should create a new AlertBroadcaster instance", () => {
      const broadcaster = createAlertBroadcaster({
        botClient: mockBotClient,
        subscriberService: mockSubscriberService,
      });
      expect(broadcaster).toBeInstanceOf(AlertBroadcaster);
    });
  });

  describe("broadcast", () => {
    it("should broadcast an alert", async () => {
      const broadcaster = createAlertBroadcaster({
        botClient: mockBotClient,
        subscriberService: mockSubscriberService,
      });
      vi.mocked(mockSubscriberService.findActive).mockResolvedValue([]);

      const alert = createMockAlert();
      const result = await broadcaster.broadcast(alert);

      expect(result.alertId).toBe("alert-123");
    });
  });

  describe("getStats", () => {
    it("should return broadcast statistics", async () => {
      vi.mocked(mockSubscriberService.getStats).mockResolvedValue({
        total: 100,
        active: 80,
        blocked: 20,
        byType: {
          PRIVATE: 50,
          GROUP: 30,
          SUPERGROUP: 15,
          CHANNEL: 5,
        },
      });

      const broadcaster = createAlertBroadcaster({
        botClient: mockBotClient,
        subscriberService: mockSubscriberService,
      });

      const stats = await broadcaster.getStats();

      expect(stats.totalSubscribers).toBe(100);
      expect(stats.activeSubscribers).toBe(80);
      expect(stats.blockedSubscribers).toBe(20);
    });
  });
});

// Import new functions for TG-BROADCAST-002 tests
import {
  logDeactivation,
  SubscriberCleanupService,
  createSubscriberCleanupService,
} from "../../src/telegram/broadcaster";

describe("TG-BROADCAST-002: Blocked User Handling", () => {
  describe("logDeactivation", () => {
    const originalConsoleLog = console.log;
    let logOutput: string[] = [];

    beforeEach(() => {
      logOutput = [];
      console.log = (...args: unknown[]) => {
        logOutput.push(args.map(String).join(" "));
      };
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it("should log deactivation with chatId and reason", () => {
      logDeactivation(BigInt(123456789), "User blocked the bot", "BLOCKED_BY_USER");

      expect(logOutput.length).toBe(1);
      expect(logOutput[0]).toContain("[TG-BROADCAST]");
      expect(logOutput[0]).toContain("chatId=123456789");
      expect(logOutput[0]).toContain("reason=\"User blocked the bot\"");
      expect(logOutput[0]).toContain("type=BLOCKED_BY_USER");
    });

    it("should include error message when provided", () => {
      logDeactivation(
        BigInt(987654321),
        "Chat not found",
        "CHAT_NOT_FOUND",
        "Bad Request: chat not found"
      );

      expect(logOutput.length).toBe(1);
      expect(logOutput[0]).toContain("error=\"Bad Request: chat not found\"");
    });

    it("should not include error when not provided", () => {
      logDeactivation(BigInt(123), "Bot was kicked", "BOT_KICKED");

      expect(logOutput[0]).not.toContain("error=");
    });

    it("should include timestamp in ISO format", () => {
      logDeactivation(BigInt(123), "Test", "BLOCKED_BY_USER");

      // Check for ISO timestamp pattern
      expect(logOutput[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("shouldDeactivateOnError - Extended Response", () => {
    it("should return BLOCKED_BY_USER for 403 forbidden errors", () => {
      const result = shouldDeactivateOnError("Forbidden: bot was blocked by the user");

      expect(result.shouldDeactivate).toBe(true);
      expect(result.reasonType).toBe("BLOCKED_BY_USER");
      expect(result.errorCode).toBe(403);
    });

    it("should return USER_DEACTIVATED for deactivated user errors", () => {
      const result = shouldDeactivateOnError("User is deactivated");

      expect(result.shouldDeactivate).toBe(true);
      expect(result.reasonType).toBe("USER_DEACTIVATED");
      expect(result.errorCode).toBe(403);
    });

    it("should return CHAT_NOT_FOUND for 400 chat not found errors", () => {
      const result = shouldDeactivateOnError("Bad Request: chat not found");

      expect(result.shouldDeactivate).toBe(true);
      expect(result.reasonType).toBe("CHAT_NOT_FOUND");
      expect(result.errorCode).toBe(400);
    });

    it("should return BOT_KICKED for kicked errors", () => {
      const result = shouldDeactivateOnError("Bot was kicked from the group");

      expect(result.shouldDeactivate).toBe(true);
      expect(result.reasonType).toBe("BOT_KICKED");
      expect(result.errorCode).toBe(403);
    });

    it("should not deactivate for network errors", () => {
      const result = shouldDeactivateOnError("Network timeout");

      expect(result.shouldDeactivate).toBe(false);
      expect(result.reasonType).toBeUndefined();
    });

    it("should not deactivate for rate limit errors", () => {
      const result = shouldDeactivateOnError("Too Many Requests: retry after 30");

      expect(result.shouldDeactivate).toBe(false);
    });
  });

  describe("sendAlertToSubscriber - Blocked User Handling", () => {
    let mockBotClient: TelegramBotClient;
    let mockSubscriberService: TelegramSubscriberService;
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    let logOutput: string[] = [];

    beforeEach(() => {
      mockBotClient = createMockBotClient();
      mockSubscriberService = createMockSubscriberService();
      logOutput = [];
      console.log = (...args: unknown[]) => {
        logOutput.push(args.map(String).join(" "));
      };
      console.error = (...args: unknown[]) => {
        logOutput.push("ERROR: " + args.map(String).join(" "));
      };
      vi.clearAllMocks();
    });

    afterEach(() => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    });

    it("should log deactivation when user blocks the bot", async () => {
      const alert = createMockAlert();
      const subscriber = createMockSubscriber({ chatId: BigInt(12345) });
      vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
        success: false,
        error: "Forbidden: bot was blocked by the user",
      });

      const result = await sendAlertToSubscriber(
        alert,
        subscriber,
        mockBotClient,
        mockSubscriberService,
        false
      );

      expect(result.shouldDeactivate).toBe(true);
      expect(result.deactivationReason).toBe("User blocked the bot");
      expect(logOutput.some(log => log.includes("[TG-BROADCAST]"))).toBe(true);
      expect(logOutput.some(log => log.includes("chatId=12345"))).toBe(true);
    });

    it("should call markBlockedWithReason with correct parameters", async () => {
      const alert = createMockAlert();
      const subscriber = createMockSubscriber({ chatId: BigInt(99999) });
      vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
        success: false,
        error: "Bad Request: chat not found",
      });

      await sendAlertToSubscriber(
        alert,
        subscriber,
        mockBotClient,
        mockSubscriberService,
        false
      );

      expect(mockSubscriberService.markBlockedWithReason).toHaveBeenCalledWith(
        BigInt(99999),
        "Chat not found",
        "CHAT_NOT_FOUND"
      );
    });

    it("should handle exception and log deactivation", async () => {
      const alert = createMockAlert();
      const subscriber = createMockSubscriber({ chatId: BigInt(77777) });
      vi.mocked(mockBotClient.sendMessage).mockRejectedValue(
        new Error("403 Forbidden: bot was blocked")
      );

      const result = await sendAlertToSubscriber(
        alert,
        subscriber,
        mockBotClient,
        mockSubscriberService,
        false
      );

      expect(result.shouldDeactivate).toBe(true);
      expect(logOutput.some(log => log.includes("chatId=77777"))).toBe(true);
    });

    it("should not log deactivation for non-block errors", async () => {
      const alert = createMockAlert();
      const subscriber = createMockSubscriber();
      vi.mocked(mockBotClient.sendMessage).mockResolvedValue({
        success: false,
        error: "Network timeout",
      });

      const result = await sendAlertToSubscriber(
        alert,
        subscriber,
        mockBotClient,
        mockSubscriberService,
        false
      );

      expect(result.shouldDeactivate).toBeUndefined();
      expect(logOutput.some(log => log.includes("Subscriber deactivated"))).toBe(false);
    });
  });
});

describe("SubscriberCleanupService", () => {
  let mockSubscriberService: TelegramSubscriberService;
  const originalConsoleLog = console.log;
  let logOutput: string[] = [];

  beforeEach(() => {
    mockSubscriberService = createMockSubscriberService();
    logOutput = [];
    console.log = (...args: unknown[]) => {
      logOutput.push(args.map(String).join(" "));
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe("createSubscriberCleanupService", () => {
    it("should create a cleanup service instance", () => {
      const service = createSubscriberCleanupService(mockSubscriberService);
      expect(service).toBeInstanceOf(SubscriberCleanupService);
    });

    it("should use default config when not provided", () => {
      const service = createSubscriberCleanupService(mockSubscriberService);
      const config = service.getConfig();

      expect(config.inactiveDays).toBe(90);
      expect(config.intervalMs).toBe(24 * 60 * 60 * 1000);
      expect(config.enabled).toBe(false);
    });

    it("should accept custom config", () => {
      const service = createSubscriberCleanupService(mockSubscriberService, {
        inactiveDays: 30,
        intervalMs: 60000,
        enabled: true,
      });
      const config = service.getConfig();

      expect(config.inactiveDays).toBe(30);
      expect(config.intervalMs).toBe(60000);
      expect(config.enabled).toBe(true);
    });
  });

  describe("runCleanup", () => {
    it("should run cleanup and return result", async () => {
      const deactivatedSubs = [
        createMockSubscriber({ chatId: BigInt(1) }),
        createMockSubscriber({ chatId: BigInt(2) }),
      ];
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue(deactivatedSubs);

      const service = createSubscriberCleanupService(mockSubscriberService);
      const result = await service.runCleanup();

      expect(result.deactivatedCount).toBe(2);
      expect(result.deactivatedChatIds).toHaveLength(2);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should log cleanup start and completion", async () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService);
      await service.runCleanup();

      expect(logOutput.some(log => log.includes("[TG-CLEANUP] Starting cleanup"))).toBe(true);
      expect(logOutput.some(log => log.includes("[TG-CLEANUP] Cleanup completed"))).toBe(true);
    });

    it("should log each deactivation", async () => {
      const deactivatedSubs = [
        createMockSubscriber({ chatId: BigInt(123) }),
        createMockSubscriber({ chatId: BigInt(456) }),
      ];
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue(deactivatedSubs);

      const service = createSubscriberCleanupService(mockSubscriberService);
      await service.runCleanup();

      expect(logOutput.some(log => log.includes("chatId=123"))).toBe(true);
      expect(logOutput.some(log => log.includes("chatId=456"))).toBe(true);
      expect(logOutput.some(log => log.includes("INACTIVE_CLEANUP"))).toBe(true);
    });

    it("should call cleanupInactiveSubscribers with configured days", async () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService, {
        inactiveDays: 60,
      });
      await service.runCleanup();

      expect(mockSubscriberService.cleanupInactiveSubscribers).toHaveBeenCalledWith(60);
    });

    it("should update lastCleanup result", async () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService);
      expect(service.getLastCleanupResult()).toBeNull();

      await service.runCleanup();

      const lastResult = service.getLastCleanupResult();
      expect(lastResult).not.toBeNull();
      expect(lastResult?.deactivatedCount).toBe(0);
    });
  });

  describe("previewCleanup", () => {
    it("should return inactive subscribers without deactivating", async () => {
      const inactiveSubscribers = [
        createMockSubscriber({ chatId: BigInt(1) }),
        createMockSubscriber({ chatId: BigInt(2) }),
        createMockSubscriber({ chatId: BigInt(3) }),
      ];
      vi.mocked(mockSubscriberService.findInactiveSubscribers).mockResolvedValue(inactiveSubscribers);

      const service = createSubscriberCleanupService(mockSubscriberService);
      const preview = await service.previewCleanup();

      expect(preview.count).toBe(3);
      expect(preview.subscribers).toHaveLength(3);
      expect(mockSubscriberService.cleanupInactiveSubscribers).not.toHaveBeenCalled();
    });
  });

  describe("start/stop", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should not start if disabled", () => {
      const service = createSubscriberCleanupService(mockSubscriberService, {
        enabled: false,
      });

      service.start();

      expect(service.isRunning()).toBe(false);
      expect(logOutput.some(log => log.includes("disabled in config"))).toBe(true);
    });

    it("should start if enabled", () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService, {
        enabled: true,
        intervalMs: 1000,
      });

      service.start();

      expect(service.isRunning()).toBe(true);
    });

    it("should stop cleanly", () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService, {
        enabled: true,
      });

      service.start();
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
      expect(logOutput.some(log => log.includes("stopped"))).toBe(true);
    });

    it("should not start twice", () => {
      vi.mocked(mockSubscriberService.cleanupInactiveSubscribers).mockResolvedValue([]);

      const service = createSubscriberCleanupService(mockSubscriberService, {
        enabled: true,
      });

      service.start();
      service.start(); // Second start

      expect(logOutput.some(log => log.includes("already running"))).toBe(true);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration values", () => {
      const service = createSubscriberCleanupService(mockSubscriberService);

      service.updateConfig({
        inactiveDays: 45,
        intervalMs: 3600000,
      });

      const config = service.getConfig();
      expect(config.inactiveDays).toBe(45);
      expect(config.intervalMs).toBe(3600000);
    });

    it("should only update provided values", () => {
      const service = createSubscriberCleanupService(mockSubscriberService, {
        inactiveDays: 100,
        intervalMs: 5000,
        enabled: true,
      });

      service.updateConfig({ inactiveDays: 50 });

      const config = service.getConfig();
      expect(config.inactiveDays).toBe(50);
      expect(config.intervalMs).toBe(5000);
      expect(config.enabled).toBe(true);
    });
  });
});
