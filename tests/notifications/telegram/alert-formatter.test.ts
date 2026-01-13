/**
 * Tests for Telegram alert message formatter
 */

import { describe, it, expect } from "vitest";
import {
  formatAlertMessageHtml,
  formatAlertMessagePlain,
  createAlertButtons,
  formatTelegramAlert,
  createAlertMessage,
  formatAlertSummary,
  createAlertSummaryMessage,
  getSeverityEmoji,
  getAlertTypeEmoji,
  getAlertTypeLabel,
  validateAlertData,
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  type TelegramAlertData,
  type AlertType,
  type AlertSeverity,
} from "../../../src/notifications/telegram/alert-formatter";
import { TelegramParseMode } from "../../../src/notifications/telegram/types";

// Sample alert data for testing
const createSampleAlert = (overrides: Partial<TelegramAlertData> = {}): TelegramAlertData => ({
  alertId: "alert-123",
  alertType: "whale_trade",
  severity: "high",
  title: "Large Whale Trade Detected",
  message: "A whale made a significant trade on the Bitcoin market.",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  marketId: "bitcoin-100k-2024",
  marketTitle: "Will Bitcoin reach $100k by end of 2024?",
  tradeSize: 50000,
  priceChange: 5.25,
  suspicionScore: 75,
  actionUrl: "https://example.com/alert/123",
  dashboardUrl: "https://example.com/dashboard",
  ...overrides,
});

describe("Alert Formatter", () => {
  describe("formatAlertMessageHtml", () => {
    it("should format alert with all fields", () => {
      const alert = createSampleAlert();
      const result = formatAlertMessageHtml(alert);

      // Check header
      expect(result).toContain("HIGH");
      expect(result).toContain("Whale Trade");

      // Check title
      expect(result).toContain("<b>Large Whale Trade Detected</b>");

      // Check message
      expect(result).toContain("A whale made a significant trade");

      // Check market
      expect(result).toContain("Market:");
      expect(result).toContain("Will Bitcoin reach");

      // Check wallet (truncated)
      expect(result).toContain("Wallet:");
      expect(result).toContain("<code>0x1234...5678</code>");

      // Check trade size
      expect(result).toContain("Trade Size:");
      expect(result).toContain("$50,000");

      // Check price change
      expect(result).toContain("Price Change:");
      expect(result).toContain("+5.25%");

      // Check suspicion score
      expect(result).toContain("Suspicion Score:");
      expect(result).toContain("75/100");

      // Check alert ID
      expect(result).toContain("Alert ID: alert-123");
    });

    it("should handle negative price change", () => {
      const alert = createSampleAlert({ priceChange: -3.5 });
      const result = formatAlertMessageHtml(alert);

      expect(result).toContain("-3.50%");
      expect(result).toContain("📉"); // Downward emoji
    });

    it("should escape HTML in user-provided content", () => {
      const alert = createSampleAlert({
        title: "Alert with <script>hack</script>",
        message: "Message with <b>bold</b> attempt",
      });
      const result = formatAlertMessageHtml(alert);

      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;b&gt;bold&lt;/b&gt;");
    });

    it("should respect options to hide fields", () => {
      const alert = createSampleAlert();
      const result = formatAlertMessageHtml(alert, {
        includeTimestamp: false,
        includeWallet: false,
        includeMarket: false,
        includeSuspicionScore: false,
      });

      expect(result).not.toContain("Wallet:");
      expect(result).not.toContain("Market:");
      expect(result).not.toContain("Suspicion Score:");
      expect(result).not.toContain("Time:");
    });

    it("should handle alert without optional fields", () => {
      const alert = createSampleAlert({
        walletAddress: undefined,
        marketId: undefined,
        marketTitle: undefined,
        tradeSize: undefined,
        priceChange: undefined,
        suspicionScore: undefined,
      });
      const result = formatAlertMessageHtml(alert);

      expect(result).toContain("Large Whale Trade Detected");
      expect(result).not.toContain("Wallet:");
      expect(result).not.toContain("Trade Size:");
    });

    it("should include severity emoji", () => {
      const criticalAlert = createSampleAlert({ severity: "critical" });
      const infoAlert = createSampleAlert({ severity: "info" });

      const criticalResult = formatAlertMessageHtml(criticalAlert);
      const infoResult = formatAlertMessageHtml(infoAlert);

      expect(criticalResult).toContain("🔴");
      expect(criticalResult).toContain("CRITICAL");
      expect(infoResult).toContain("🔵");
      expect(infoResult).toContain("INFO");
    });

    it("should include alert type emoji", () => {
      const freshWalletAlert = createSampleAlert({ alertType: "fresh_wallet" });
      const insiderAlert = createSampleAlert({ alertType: "insider_activity" });

      const freshResult = formatAlertMessageHtml(freshWalletAlert);
      const insiderResult = formatAlertMessageHtml(insiderAlert);

      expect(freshResult).toContain("🆕");
      expect(freshResult).toContain("Fresh Wallet");
      expect(insiderResult).toContain("🔍");
      expect(insiderResult).toContain("Insider Activity");
    });

    it("should truncate long market titles", () => {
      const alert = createSampleAlert({
        marketTitle: "A".repeat(100),
      });
      const result = formatAlertMessageHtml(alert);

      expect(result).toContain("A".repeat(47) + "...");
    });
  });

  describe("formatAlertMessagePlain", () => {
    it("should format alert without HTML tags", () => {
      const alert = createSampleAlert();
      const result = formatAlertMessagePlain(alert);

      // No HTML tags
      expect(result).not.toContain("<b>");
      expect(result).not.toContain("<code>");
      expect(result).not.toContain("<i>");

      // Content present
      expect(result).toContain("HIGH");
      expect(result).toContain("Whale Trade");
      expect(result).toContain("Large Whale Trade Detected");
      expect(result).toContain("$50,000");
    });

    it("should include all relevant data", () => {
      const alert = createSampleAlert();
      const result = formatAlertMessagePlain(alert);

      expect(result).toContain("Market:");
      expect(result).toContain("Wallet:");
      expect(result).toContain("Trade Size:");
      expect(result).toContain("Price Change:");
      expect(result).toContain("Suspicion Score:");
      expect(result).toContain("Alert ID:");
    });
  });

  describe("createAlertButtons", () => {
    it("should create buttons with action URLs", () => {
      const alert = createSampleAlert();
      const buttons = createAlertButtons(alert);

      // Should have multiple rows
      expect(buttons.buttons.length).toBeGreaterThan(0);

      // Find View Details button
      const allButtons = buttons.buttons.flat();
      const viewDetailsBtn = allButtons.find((b) => b.text.includes("View Details"));
      expect(viewDetailsBtn).toBeDefined();
      expect(viewDetailsBtn?.url).toBe("https://example.com/alert/123");

      // Find Dashboard button
      const dashboardBtn = allButtons.find((b) => b.text.includes("Dashboard"));
      expect(dashboardBtn).toBeDefined();
      expect(dashboardBtn?.url).toBe("https://example.com/dashboard");
    });

    it("should create market link button", () => {
      const alert = createSampleAlert();
      const buttons = createAlertButtons(alert);

      const allButtons = buttons.buttons.flat();
      const marketBtn = allButtons.find((b) => b.text.includes("View Market"));
      expect(marketBtn).toBeDefined();
      expect(marketBtn?.url).toContain("polymarket.com");
      expect(marketBtn?.url).toContain("bitcoin-100k-2024");
    });

    it("should create wallet link button", () => {
      const alert = createSampleAlert();
      const buttons = createAlertButtons(alert);

      const allButtons = buttons.buttons.flat();
      const walletBtn = allButtons.find((b) => b.text.includes("View Wallet"));
      expect(walletBtn).toBeDefined();
      expect(walletBtn?.url).toContain("polygonscan.com");
      expect(walletBtn?.url).toContain("0x1234567890abcdef");
    });

    it("should include callback action buttons", () => {
      const alert = createSampleAlert();
      const buttons = createAlertButtons(alert);

      const allButtons = buttons.buttons.flat();
      const ackBtn = allButtons.find((b) => b.text.includes("Acknowledge"));
      const muteBtn = allButtons.find((b) => b.text.includes("Mute"));

      expect(ackBtn).toBeDefined();
      expect(ackBtn?.callbackData).toBe("alert_ack:alert-123");

      expect(muteBtn).toBeDefined();
      expect(muteBtn?.callbackData).toBe("alert_mute:whale_trade");
    });

    it("should handle alert without optional URLs", () => {
      const alert = createSampleAlert({
        actionUrl: undefined,
        dashboardUrl: undefined,
        marketId: undefined,
        walletAddress: undefined,
      });
      const buttons = createAlertButtons(alert);

      // Should still have callback buttons
      const allButtons = buttons.buttons.flat();
      expect(allButtons.some((b) => b.text.includes("Acknowledge"))).toBe(true);
      expect(allButtons.some((b) => b.text.includes("Mute"))).toBe(true);
    });
  });

  describe("formatTelegramAlert", () => {
    it("should return formatted alert with default options", () => {
      const alert = createSampleAlert();
      const result = formatTelegramAlert(alert);

      expect(result.text).toContain("HIGH");
      expect(result.text).toContain("Large Whale Trade Detected");
      expect(result.parseMode).toBe(TelegramParseMode.HTML);
      expect(result.disableWebPagePreview).toBe(true);
      expect(result.inlineKeyboard).toBeDefined();
    });

    it("should respect parseMode option", () => {
      const alert = createSampleAlert();

      const htmlResult = formatTelegramAlert(alert, {
        parseMode: TelegramParseMode.HTML,
      });
      expect(htmlResult.text).toContain("<b>");
      expect(htmlResult.parseMode).toBe(TelegramParseMode.HTML);

      const plainResult = formatTelegramAlert(alert, {
        parseMode: TelegramParseMode.MARKDOWN,
      });
      expect(plainResult.text).not.toContain("<b>");
      expect(plainResult.parseMode).toBe(TelegramParseMode.MARKDOWN);
    });

    it("should exclude buttons when disabled", () => {
      const alert = createSampleAlert();
      const result = formatTelegramAlert(alert, { includeButtons: false });

      expect(result.inlineKeyboard).toBeUndefined();
    });

    it("should truncate message if too long", () => {
      const alert = createSampleAlert({
        message: "A".repeat(5000),
      });
      const result = formatTelegramAlert(alert, { maxLength: 1000 });

      expect(result.text.length).toBeLessThanOrEqual(1000);
      expect(result.text).toContain("...");
    });
  });

  describe("createAlertMessage", () => {
    it("should create TelegramMessage ready to send", () => {
      const alert = createSampleAlert();
      const message = createAlertMessage(123456789, alert);

      expect(message.chatId).toBe(123456789);
      expect(message.text).toContain("Large Whale Trade Detected");
      expect(message.options?.parseMode).toBe(TelegramParseMode.HTML);
      expect(message.options?.inlineKeyboard).toBeDefined();
    });

    it("should work with string chat ID", () => {
      const alert = createSampleAlert();
      const message = createAlertMessage("@channel", alert);

      expect(message.chatId).toBe("@channel");
    });

    it("should pass options through", () => {
      const alert = createSampleAlert();
      const message = createAlertMessage(123, alert, { includeButtons: false });

      expect(message.options?.inlineKeyboard).toBeUndefined();
    });
  });

  describe("formatAlertSummary", () => {
    it("should format summary for multiple alerts", () => {
      const alerts = [
        createSampleAlert({ severity: "critical", alertType: "whale_trade" }),
        createSampleAlert({ severity: "high", alertType: "whale_trade" }),
        createSampleAlert({ severity: "high", alertType: "insider_activity" }),
        createSampleAlert({ severity: "medium", alertType: "fresh_wallet" }),
      ];

      const result = formatAlertSummary(alerts);

      expect(result).toContain("Alert Summary");
      expect(result).toContain("4 alerts");

      // Severity counts
      expect(result).toContain("CRITICAL: 1");
      expect(result).toContain("HIGH: 2");
      expect(result).toContain("MEDIUM: 1");

      // Type counts
      expect(result).toContain("Whale Trade: 2");
      expect(result).toContain("Insider Activity: 1");
      expect(result).toContain("Fresh Wallet: 1");
    });

    it("should handle empty alerts array", () => {
      const result = formatAlertSummary([]);
      expect(result).toContain("No alerts to display");
    });

    it("should handle single alert", () => {
      const alerts = [createSampleAlert()];
      const result = formatAlertSummary(alerts);

      expect(result).toContain("1 alerts");
      expect(result).toContain("HIGH: 1");
      expect(result).toContain("Whale Trade: 1");
    });
  });

  describe("createAlertSummaryMessage", () => {
    it("should create summary message ready to send", () => {
      const alerts = [
        createSampleAlert(),
        createSampleAlert({ severity: "critical" }),
      ];
      const message = createAlertSummaryMessage(123, alerts);

      expect(message.chatId).toBe(123);
      expect(message.text).toContain("Alert Summary");
      expect(message.options?.parseMode).toBe(TelegramParseMode.HTML);
    });
  });

  describe("getSeverityEmoji", () => {
    it("should return correct emoji for each severity", () => {
      expect(getSeverityEmoji("critical")).toBe("🔴");
      expect(getSeverityEmoji("high")).toBe("🟠");
      expect(getSeverityEmoji("medium")).toBe("🟡");
      expect(getSeverityEmoji("low")).toBe("🟢");
      expect(getSeverityEmoji("info")).toBe("🔵");
    });
  });

  describe("getAlertTypeEmoji", () => {
    it("should return correct emoji for each alert type", () => {
      expect(getAlertTypeEmoji("whale_trade")).toBe("🐋");
      expect(getAlertTypeEmoji("price_movement")).toBe("📈");
      expect(getAlertTypeEmoji("insider_activity")).toBe("🔍");
      expect(getAlertTypeEmoji("fresh_wallet")).toBe("🆕");
      expect(getAlertTypeEmoji("coordinated_activity")).toBe("🔗");
      expect(getAlertTypeEmoji("market_resolved")).toBe("✅");
    });
  });

  describe("getAlertTypeLabel", () => {
    it("should return correct label for each alert type", () => {
      expect(getAlertTypeLabel("whale_trade")).toBe("Whale Trade");
      expect(getAlertTypeLabel("insider_activity")).toBe("Insider Activity");
      expect(getAlertTypeLabel("fresh_wallet")).toBe("Fresh Wallet");
      expect(getAlertTypeLabel("system")).toBe("System Alert");
    });
  });

  describe("validateAlertData", () => {
    it("should return empty array for valid alert", () => {
      const alert = createSampleAlert();
      const errors = validateAlertData(alert);

      expect(errors).toHaveLength(0);
    });

    it("should return errors for missing required fields", () => {
      const alert = {
        alertId: "",
        alertType: "" as AlertType,
        severity: "" as AlertSeverity,
        title: "",
        message: "",
        timestamp: null as unknown as Date,
      };

      const errors = validateAlertData(alert);

      expect(errors).toContain("alertId is required");
      expect(errors).toContain("Valid alertType is required");
      expect(errors).toContain("Valid severity is required");
      expect(errors).toContain("title is required");
      expect(errors).toContain("message is required");
      expect(errors).toContain("Valid timestamp is required");
    });

    it("should validate alertType value", () => {
      const alert = createSampleAlert({ alertType: "invalid_type" as AlertType });
      const errors = validateAlertData(alert);

      expect(errors).toContain("Valid alertType is required");
    });

    it("should validate severity value", () => {
      const alert = createSampleAlert({ severity: "invalid_severity" as AlertSeverity });
      const errors = validateAlertData(alert);

      expect(errors).toContain("Valid severity is required");
    });
  });

  describe("ALERT_TYPE_CONFIG", () => {
    it("should have config for all alert types", () => {
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

      for (const type of alertTypes) {
        expect(ALERT_TYPE_CONFIG[type]).toBeDefined();
        expect(ALERT_TYPE_CONFIG[type].emoji).toBeTruthy();
        expect(ALERT_TYPE_CONFIG[type].label).toBeTruthy();
        expect(ALERT_TYPE_CONFIG[type].description).toBeTruthy();
      }
    });
  });

  describe("SEVERITY_CONFIG", () => {
    it("should have config for all severity levels", () => {
      const severities: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

      for (const severity of severities) {
        expect(SEVERITY_CONFIG[severity]).toBeDefined();
        expect(SEVERITY_CONFIG[severity].emoji).toBeTruthy();
        expect(SEVERITY_CONFIG[severity].label).toBeTruthy();
      }
    });
  });
});
