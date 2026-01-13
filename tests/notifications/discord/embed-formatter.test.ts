/**
 * Unit tests for Discord embed formatter
 */

import { describe, it, expect } from "vitest";
import {
  AlertSeverity,
  AlertType,
  DiscordAlertData,
  ALERT_TYPE_CONFIG,
  SEVERITY_CONFIG,
  formatCurrency,
  formatPercentage,
  truncateWallet,
  getAlertColor,
  createEmbedField,
  createAlertFields,
  buildAlertEmbed,
  formatDiscordAlert,
  createAlertMessage,
  createAlertEmbeds,
  createAlertSummaryEmbed,
  createAlertSummaryMessage,
  getSeverityEmoji,
  getSeverityColor,
  getAlertTypeEmoji,
  getAlertTypeLabel,
  getAlertTypeColor,
  validateAlertData,
  createSimpleEmbed,
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed,
  createWarningEmbed,
} from "../../../src/notifications/discord/embed-formatter";
import { DiscordEmbedColor } from "../../../src/notifications/discord/types";

/**
 * Create a sample alert for testing
 */
function createSampleAlert(overrides: Partial<DiscordAlertData> = {}): DiscordAlertData {
  return {
    alertId: "alert-123",
    alertType: "whale_trade",
    severity: "high",
    title: "Large Trade Detected",
    message: "A whale has made a significant trade on the presidential election market.",
    timestamp: new Date("2026-01-13T10:00:00Z"),
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    marketId: "market-456",
    marketTitle: "Will the incumbent win the 2026 election?",
    tradeSize: 50000,
    priceChange: 5.25,
    suspicionScore: 75,
    actionUrl: "https://tracker.example.com/alert/alert-123",
    dashboardUrl: "https://tracker.example.com/dashboard",
    ...overrides,
  };
}

describe("Discord Embed Formatter", () => {
  describe("formatCurrency", () => {
    it("formats positive numbers as USD", () => {
      expect(formatCurrency(1000)).toBe("$1,000");
      expect(formatCurrency(50000)).toBe("$50,000");
      expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0");
    });

    it("formats decimal values", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(0.99)).toBe("$0.99");
    });

    it("formats negative numbers", () => {
      expect(formatCurrency(-500)).toBe("-$500");
    });

    it("respects locale parameter", () => {
      // German locale uses different separators
      const result = formatCurrency(1234.56, "de-DE");
      expect(result).toContain("1.234");
    });
  });

  describe("formatPercentage", () => {
    it("formats positive percentages with + sign", () => {
      expect(formatPercentage(5.25)).toBe("+5.25%");
      expect(formatPercentage(100)).toBe("+100.00%");
    });

    it("formats negative percentages", () => {
      expect(formatPercentage(-3.5)).toBe("-3.50%");
    });

    it("formats zero", () => {
      expect(formatPercentage(0)).toBe("+0.00%");
    });

    it("formats small decimals", () => {
      expect(formatPercentage(0.01)).toBe("+0.01%");
    });
  });

  describe("truncateWallet", () => {
    it("truncates long wallet addresses", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      expect(truncateWallet(address)).toBe("0x1234...5678");
    });

    it("preserves short addresses", () => {
      expect(truncateWallet("0x123")).toBe("0x123");
      expect(truncateWallet("0x1234567890")).toBe("0x1234567890");
    });

    it("handles empty string", () => {
      expect(truncateWallet("")).toBe("");
    });

    it("handles exactly 13 character address", () => {
      expect(truncateWallet("0x123456789ab")).toBe("0x123456789ab");
    });
  });

  describe("getAlertColor", () => {
    it("returns severity color for critical severity", () => {
      expect(getAlertColor("critical", "whale_trade")).toBe(DiscordEmbedColor.RED);
    });

    it("returns severity color for high severity", () => {
      expect(getAlertColor("high", "whale_trade")).toBe(DiscordEmbedColor.ORANGE);
    });

    it("returns type color for medium severity", () => {
      expect(getAlertColor("medium", "whale_trade")).toBe(ALERT_TYPE_CONFIG.whale_trade.color);
    });

    it("returns type color for low severity", () => {
      expect(getAlertColor("low", "fresh_wallet")).toBe(ALERT_TYPE_CONFIG.fresh_wallet.color);
    });

    it("returns type color for info severity", () => {
      expect(getAlertColor("info", "system")).toBe(ALERT_TYPE_CONFIG.system.color);
    });
  });

  describe("createEmbedField", () => {
    it("creates a valid embed field", () => {
      const field = createEmbedField("Test Name", "Test Value");
      expect(field).toEqual({
        name: "Test Name",
        value: "Test Value",
        inline: false,
      });
    });

    it("creates an inline field when specified", () => {
      const field = createEmbedField("Name", "Value", true);
      expect(field?.inline).toBe(true);
    });

    it("truncates long names", () => {
      const longName = "a".repeat(300);
      const field = createEmbedField(longName, "Value");
      expect(field?.name.length).toBeLessThanOrEqual(256);
    });

    it("truncates long values", () => {
      const longValue = "b".repeat(1100);
      const field = createEmbedField("Name", longValue);
      expect(field?.value.length).toBeLessThanOrEqual(1024);
    });

    it("returns null for empty name", () => {
      const field = createEmbedField("", "Value");
      expect(field).toBeNull();
    });

    it("returns null for empty value", () => {
      const field = createEmbedField("Name", "");
      expect(field).toBeNull();
    });
  });

  describe("createAlertFields", () => {
    it("creates fields with all data present", () => {
      const alert = createSampleAlert();
      const fields = createAlertFields(alert);

      expect(fields.length).toBeGreaterThan(0);

      // Check for severity field
      const severityField = fields.find((f) => f.name === "Severity");
      expect(severityField).toBeDefined();
      expect(severityField?.value).toContain("HIGH");

      // Check for type field
      const typeField = fields.find((f) => f.name === "Type");
      expect(typeField).toBeDefined();
      expect(typeField?.value).toContain("Whale Trade");
    });

    it("includes market field when market title is present", () => {
      const alert = createSampleAlert({ marketTitle: "Test Market" });
      const fields = createAlertFields(alert);

      const marketField = fields.find((f) => f.name.includes("Market"));
      expect(marketField).toBeDefined();
    });

    it("excludes market field when disabled", () => {
      const alert = createSampleAlert({ marketTitle: "Test Market" });
      const fields = createAlertFields(alert, { includeMarket: false });

      const marketField = fields.find((f) => f.name.includes("Market"));
      expect(marketField).toBeUndefined();
    });

    it("includes wallet field when address is present", () => {
      const alert = createSampleAlert();
      const fields = createAlertFields(alert);

      const walletField = fields.find((f) => f.name.includes("Wallet"));
      expect(walletField).toBeDefined();
      expect(walletField?.value).toContain("0x1234");
    });

    it("excludes wallet field when disabled", () => {
      const alert = createSampleAlert();
      const fields = createAlertFields(alert, { includeWallet: false });

      const walletField = fields.find((f) => f.name.includes("Wallet"));
      expect(walletField).toBeUndefined();
    });

    it("includes trade size field", () => {
      const alert = createSampleAlert({ tradeSize: 25000 });
      const fields = createAlertFields(alert);

      const tradeSizeField = fields.find((f) => f.name.includes("Trade Size"));
      expect(tradeSizeField).toBeDefined();
      expect(tradeSizeField?.value).toContain("$25,000");
    });

    it("excludes trade size when zero", () => {
      const alert = createSampleAlert({ tradeSize: 0 });
      const fields = createAlertFields(alert);

      const tradeSizeField = fields.find((f) => f.name.includes("Trade Size"));
      expect(tradeSizeField).toBeUndefined();
    });

    it("includes price change field", () => {
      const alert = createSampleAlert({ priceChange: 10.5 });
      const fields = createAlertFields(alert);

      const priceField = fields.find((f) => f.name.includes("Price Change"));
      expect(priceField).toBeDefined();
      expect(priceField?.value).toContain("+10.50%");
    });

    it("includes suspicion score field", () => {
      const alert = createSampleAlert({ suspicionScore: 85 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField).toBeDefined();
      expect(scoreField?.value).toContain("85/100");
    });

    it("shows high suspicion emoji for scores >= 70", () => {
      const alert = createSampleAlert({ suspicionScore: 75 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField?.value).toContain("🚨");
    });

    it("shows medium suspicion emoji for scores 40-69", () => {
      const alert = createSampleAlert({ suspicionScore: 50 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField?.value).toContain("⚠️");
    });

    it("shows low suspicion emoji for scores < 40", () => {
      const alert = createSampleAlert({ suspicionScore: 20 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField?.value).toContain("✓");
    });

    it("includes metadata fields", () => {
      const alert = createSampleAlert({
        metadata: {
          customField: "Custom Value",
          numericField: 123,
        },
      });
      const fields = createAlertFields(alert);

      const customField = fields.find((f) => f.name === "customField");
      expect(customField).toBeDefined();
      expect(customField?.value).toBe("Custom Value");
    });
  });

  describe("buildAlertEmbed", () => {
    it("builds a complete embed", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert);

      expect(embed.title).toBeDefined();
      expect(embed.description).toBe(alert.message);
      expect(embed.color).toBeDefined();
      expect(embed.fields).toBeDefined();
      expect(embed.fields?.length).toBeGreaterThan(0);
    });

    it("includes emoji in title", () => {
      const alert = createSampleAlert({ alertType: "whale_trade" });
      const embed = buildAlertEmbed(alert);

      expect(embed.title).toContain("🐋");
    });

    it("includes URL when actionUrl is present", () => {
      const alert = createSampleAlert({ actionUrl: "https://example.com" });
      const embed = buildAlertEmbed(alert);

      expect(embed.url).toBe("https://example.com");
    });

    it("includes timestamp when enabled", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, { includeTimestamp: true });

      expect(embed.timestamp).toBeDefined();
    });

    it("excludes timestamp when disabled", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, { includeTimestamp: false });

      expect(embed.timestamp).toBeUndefined();
    });

    it("includes author when enabled", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, { includeAuthor: true });

      expect(embed.author).toBeDefined();
      expect(embed.author?.name).toBe("Polymarket Tracker");
    });

    it("uses custom author name", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, {
        includeAuthor: true,
        authorName: "Custom Bot",
      });

      expect(embed.author?.name).toBe("Custom Bot");
    });

    it("includes footer when enabled", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, { includeFooter: true });

      expect(embed.footer).toBeDefined();
      expect(embed.footer?.text).toContain(alert.alertId);
    });

    it("excludes footer when disabled", () => {
      const alert = createSampleAlert();
      const embed = buildAlertEmbed(alert, { includeFooter: false });

      expect(embed.footer).toBeUndefined();
    });

    it("includes thumbnail when present and enabled", () => {
      const alert = createSampleAlert({ thumbnailUrl: "https://example.com/img.png" });
      const embed = buildAlertEmbed(alert, { includeThumbnail: true });

      expect(embed.thumbnail).toBeDefined();
      expect(embed.thumbnail?.url).toBe("https://example.com/img.png");
    });

    it("truncates long descriptions", () => {
      const longMessage = "a".repeat(5000);
      const alert = createSampleAlert({ message: longMessage });
      const embed = buildAlertEmbed(alert, { maxDescriptionLength: 1000 });

      expect(embed.description?.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("formatDiscordAlert", () => {
    it("returns an embed", () => {
      const alert = createSampleAlert();
      const result = formatDiscordAlert(alert);

      expect(result.embed).toBeDefined();
      expect(result.embed.title).toBeDefined();
    });

    it("includes content for critical alerts", () => {
      const alert = createSampleAlert({ severity: "critical" });
      const result = formatDiscordAlert(alert);

      expect(result.content).toBeDefined();
      expect(result.content).toContain("Critical");
    });

    it("excludes content for non-critical alerts", () => {
      const alert = createSampleAlert({ severity: "medium" });
      const result = formatDiscordAlert(alert);

      expect(result.content).toBeUndefined();
    });
  });

  describe("createAlertMessage", () => {
    it("creates a valid Discord message", () => {
      const alert = createSampleAlert();
      const message = createAlertMessage(alert);

      expect(message.embeds).toBeDefined();
      expect(message.embeds?.length).toBe(1);
    });

    it("includes content for critical alerts", () => {
      const alert = createSampleAlert({ severity: "critical" });
      const message = createAlertMessage(alert);

      expect(message.content).toBeDefined();
    });
  });

  describe("createAlertEmbeds", () => {
    it("creates embeds for multiple alerts", () => {
      const alerts = [
        createSampleAlert({ alertId: "1" }),
        createSampleAlert({ alertId: "2" }),
        createSampleAlert({ alertId: "3" }),
      ];
      const embeds = createAlertEmbeds(alerts);

      expect(embeds.length).toBe(3);
    });

    it("limits to 10 embeds max", () => {
      const alerts = Array.from({ length: 15 }, (_, i) =>
        createSampleAlert({ alertId: `alert-${i}` })
      );
      const embeds = createAlertEmbeds(alerts);

      expect(embeds.length).toBe(10);
    });

    it("returns empty array for empty input", () => {
      const embeds = createAlertEmbeds([]);
      expect(embeds.length).toBe(0);
    });
  });

  describe("createAlertSummaryEmbed", () => {
    it("creates a summary embed for multiple alerts", () => {
      const alerts = [
        createSampleAlert({ severity: "critical", alertType: "insider_activity" }),
        createSampleAlert({ severity: "high", alertType: "whale_trade" }),
        createSampleAlert({ severity: "medium", alertType: "whale_trade" }),
      ];
      const embed = createAlertSummaryEmbed(alerts);

      expect(embed.title).toContain("Alert Summary");
      expect(embed.title).toContain("3 alerts");
      expect(embed.fields).toBeDefined();
    });

    it("groups alerts by severity", () => {
      const alerts = [
        createSampleAlert({ severity: "critical" }),
        createSampleAlert({ severity: "critical" }),
        createSampleAlert({ severity: "high" }),
      ];
      const embed = createAlertSummaryEmbed(alerts);

      const severityField = embed.fields?.find((f) => f.name === "By Severity");
      expect(severityField).toBeDefined();
      expect(severityField?.value).toContain("CRITICAL");
      expect(severityField?.value).toContain("HIGH");
    });

    it("groups alerts by type", () => {
      const alerts = [
        createSampleAlert({ alertType: "whale_trade" }),
        createSampleAlert({ alertType: "fresh_wallet" }),
        createSampleAlert({ alertType: "whale_trade" }),
      ];
      const embed = createAlertSummaryEmbed(alerts);

      const typeField = embed.fields?.find((f) => f.name === "By Type");
      expect(typeField).toBeDefined();
      expect(typeField?.value).toContain("Whale Trade");
      expect(typeField?.value).toContain("Fresh Wallet");
    });

    it("uses highest severity color", () => {
      const alerts = [
        createSampleAlert({ severity: "low" }),
        createSampleAlert({ severity: "critical" }),
        createSampleAlert({ severity: "medium" }),
      ];
      const embed = createAlertSummaryEmbed(alerts);

      expect(embed.color).toBe(SEVERITY_CONFIG.critical.color);
    });

    it("handles empty alerts array", () => {
      const embed = createAlertSummaryEmbed([]);

      expect(embed.title).toBe("📊 Alert Summary");
      expect(embed.description).toBe("No alerts to display.");
    });
  });

  describe("createAlertSummaryMessage", () => {
    it("creates a valid Discord message", () => {
      const alerts = [createSampleAlert()];
      const message = createAlertSummaryMessage(alerts);

      expect(message.embeds).toBeDefined();
      expect(message.embeds?.length).toBe(1);
    });
  });

  describe("getSeverityEmoji", () => {
    it("returns correct emoji for each severity", () => {
      expect(getSeverityEmoji("critical")).toBe("🔴");
      expect(getSeverityEmoji("high")).toBe("🟠");
      expect(getSeverityEmoji("medium")).toBe("🟡");
      expect(getSeverityEmoji("low")).toBe("🟢");
      expect(getSeverityEmoji("info")).toBe("🔵");
    });
  });

  describe("getSeverityColor", () => {
    it("returns correct color for each severity", () => {
      expect(getSeverityColor("critical")).toBe(DiscordEmbedColor.RED);
      expect(getSeverityColor("high")).toBe(DiscordEmbedColor.ORANGE);
      expect(getSeverityColor("medium")).toBe(DiscordEmbedColor.GOLD);
      expect(getSeverityColor("low")).toBe(DiscordEmbedColor.GREEN);
      expect(getSeverityColor("info")).toBe(DiscordEmbedColor.BLUE);
    });
  });

  describe("getAlertTypeEmoji", () => {
    it("returns correct emoji for each type", () => {
      expect(getAlertTypeEmoji("whale_trade")).toBe("🐋");
      expect(getAlertTypeEmoji("insider_activity")).toBe("🔍");
      expect(getAlertTypeEmoji("fresh_wallet")).toBe("🆕");
      expect(getAlertTypeEmoji("system")).toBe("ℹ️");
    });
  });

  describe("getAlertTypeLabel", () => {
    it("returns correct label for each type", () => {
      expect(getAlertTypeLabel("whale_trade")).toBe("Whale Trade");
      expect(getAlertTypeLabel("insider_activity")).toBe("Insider Activity");
      expect(getAlertTypeLabel("fresh_wallet")).toBe("Fresh Wallet");
    });
  });

  describe("getAlertTypeColor", () => {
    it("returns correct color for each type", () => {
      expect(getAlertTypeColor("whale_trade")).toBe(DiscordEmbedColor.BLUE);
      expect(getAlertTypeColor("insider_activity")).toBe(DiscordEmbedColor.RED);
      expect(getAlertTypeColor("fresh_wallet")).toBe(DiscordEmbedColor.AQUA);
    });
  });

  describe("validateAlertData", () => {
    it("returns empty array for valid data", () => {
      const alert = createSampleAlert();
      const errors = validateAlertData(alert);

      expect(errors.length).toBe(0);
    });

    it("returns error for missing alertId", () => {
      const alert = createSampleAlert({ alertId: "" });
      const errors = validateAlertData(alert);

      expect(errors).toContain("alertId is required");
    });

    it("returns error for invalid alertType", () => {
      const alert = createSampleAlert();
      // @ts-expect-error Testing invalid type
      alert.alertType = "invalid_type";
      const errors = validateAlertData(alert);

      expect(errors).toContain("Valid alertType is required");
    });

    it("returns error for invalid severity", () => {
      const alert = createSampleAlert();
      // @ts-expect-error Testing invalid severity
      alert.severity = "invalid_severity";
      const errors = validateAlertData(alert);

      expect(errors).toContain("Valid severity is required");
    });

    it("returns error for missing title", () => {
      const alert = createSampleAlert({ title: "" });
      const errors = validateAlertData(alert);

      expect(errors).toContain("title is required");
    });

    it("returns error for missing message", () => {
      const alert = createSampleAlert({ message: "" });
      const errors = validateAlertData(alert);

      expect(errors).toContain("message is required");
    });

    it("returns error for invalid timestamp", () => {
      const alert = createSampleAlert();
      // @ts-expect-error Testing invalid timestamp
      alert.timestamp = "not a date";
      const errors = validateAlertData(alert);

      expect(errors).toContain("Valid timestamp is required");
    });

    it("returns multiple errors for multiple issues", () => {
      const alert = createSampleAlert({
        alertId: "",
        title: "",
        message: "",
      });
      const errors = validateAlertData(alert);

      expect(errors.length).toBe(3);
    });
  });

  describe("createSimpleEmbed", () => {
    it("creates a simple embed with title and description", () => {
      const embed = createSimpleEmbed("Test Title", "Test description");

      expect(embed.title).toBe("Test Title");
      expect(embed.description).toBe("Test description");
      expect(embed.color).toBe(DiscordEmbedColor.BLUE);
    });

    it("uses custom color", () => {
      const embed = createSimpleEmbed("Title", "Description", DiscordEmbedColor.PURPLE);

      expect(embed.color).toBe(DiscordEmbedColor.PURPLE);
    });

    it("includes optional URL", () => {
      const embed = createSimpleEmbed("Title", "Description", DiscordEmbedColor.BLUE, {
        url: "https://example.com",
      });

      expect(embed.url).toBe("https://example.com");
    });

    it("includes optional thumbnail", () => {
      const embed = createSimpleEmbed("Title", "Description", DiscordEmbedColor.BLUE, {
        thumbnail: "https://example.com/img.png",
      });

      expect(embed.thumbnail?.url).toBe("https://example.com/img.png");
    });

    it("includes optional footer", () => {
      const embed = createSimpleEmbed("Title", "Description", DiscordEmbedColor.BLUE, {
        footer: "Footer text",
      });

      expect(embed.footer?.text).toBe("Footer text");
    });

    it("truncates long titles", () => {
      const longTitle = "a".repeat(300);
      const embed = createSimpleEmbed(longTitle, "Description");

      expect(embed.title?.length).toBeLessThanOrEqual(256);
    });

    it("truncates long descriptions", () => {
      const longDesc = "b".repeat(5000);
      const embed = createSimpleEmbed("Title", longDesc);

      expect(embed.description?.length).toBeLessThanOrEqual(4096);
    });
  });

  describe("createErrorEmbed", () => {
    it("creates an error embed with red color", () => {
      const embed = createErrorEmbed("Error Title", "Something went wrong");

      expect(embed.title).toContain("❌");
      expect(embed.title).toContain("Error Title");
      expect(embed.color).toBe(DiscordEmbedColor.RED);
    });

    it("includes error message field", () => {
      const embed = createErrorEmbed("Title", "Error message");

      const errorField = embed.fields?.find((f) => f.name === "Error");
      expect(errorField).toBeDefined();
      expect(errorField?.value).toBe("Error message");
    });

    it("includes optional details field", () => {
      const embed = createErrorEmbed("Title", "Error message", "Additional details");

      const detailsField = embed.fields?.find((f) => f.name === "Details");
      expect(detailsField).toBeDefined();
      expect(detailsField?.value).toBe("Additional details");
    });
  });

  describe("createSuccessEmbed", () => {
    it("creates a success embed with green color", () => {
      const embed = createSuccessEmbed("Success!", "Operation completed");

      expect(embed.title).toContain("✅");
      expect(embed.title).toContain("Success!");
      expect(embed.description).toBe("Operation completed");
      expect(embed.color).toBe(DiscordEmbedColor.GREEN);
    });
  });

  describe("createInfoEmbed", () => {
    it("creates an info embed with blue color", () => {
      const embed = createInfoEmbed("Info", "Some information");

      expect(embed.title).toContain("ℹ️");
      expect(embed.title).toContain("Info");
      expect(embed.description).toBe("Some information");
      expect(embed.color).toBe(DiscordEmbedColor.BLUE);
    });
  });

  describe("createWarningEmbed", () => {
    it("creates a warning embed with gold color", () => {
      const embed = createWarningEmbed("Warning", "Be careful!");

      expect(embed.title).toContain("⚠️");
      expect(embed.title).toContain("Warning");
      expect(embed.description).toBe("Be careful!");
      expect(embed.color).toBe(DiscordEmbedColor.GOLD);
    });
  });

  describe("ALERT_TYPE_CONFIG", () => {
    it("has configuration for all alert types", () => {
      const types: AlertType[] = [
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

      for (const type of types) {
        expect(ALERT_TYPE_CONFIG[type]).toBeDefined();
        expect(ALERT_TYPE_CONFIG[type].emoji).toBeDefined();
        expect(ALERT_TYPE_CONFIG[type].label).toBeDefined();
        expect(ALERT_TYPE_CONFIG[type].color).toBeDefined();
      }
    });
  });

  describe("SEVERITY_CONFIG", () => {
    it("has configuration for all severities", () => {
      const severities: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

      for (const severity of severities) {
        expect(SEVERITY_CONFIG[severity]).toBeDefined();
        expect(SEVERITY_CONFIG[severity].emoji).toBeDefined();
        expect(SEVERITY_CONFIG[severity].label).toBeDefined();
        expect(SEVERITY_CONFIG[severity].color).toBeDefined();
      }
    });
  });

  describe("Edge cases", () => {
    it("handles alert with minimal data", () => {
      const minimalAlert: DiscordAlertData = {
        alertId: "minimal-123",
        alertType: "system",
        severity: "info",
        title: "Test",
        message: "Test message",
        timestamp: new Date(),
      };

      const embed = buildAlertEmbed(minimalAlert);
      expect(embed.title).toBeDefined();
      expect(embed.description).toBeDefined();
    });

    it("handles alert with all optional fields", () => {
      const fullAlert = createSampleAlert({
        thumbnailUrl: "https://example.com/thumb.png",
        metadata: {
          key1: "value1",
          key2: 123,
          key3: true,
        },
      });

      const embed = buildAlertEmbed(fullAlert);
      expect(embed.thumbnail).toBeDefined();
      expect(embed.fields?.length).toBeGreaterThan(5);
    });

    it("handles negative price changes", () => {
      const alert = createSampleAlert({ priceChange: -15.5 });
      const fields = createAlertFields(alert);

      const priceField = fields.find((f) => f.name.includes("Price Change"));
      expect(priceField?.value).toContain("-15.50%");
      expect(priceField?.name).toContain("📉");
    });

    it("handles very large trade sizes", () => {
      const alert = createSampleAlert({ tradeSize: 1000000000 });
      const fields = createAlertFields(alert);

      const tradeSizeField = fields.find((f) => f.name.includes("Trade Size"));
      expect(tradeSizeField?.value).toContain("$1,000,000,000");
    });

    it("handles suspicion score of 0", () => {
      const alert = createSampleAlert({ suspicionScore: 0 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField?.value).toContain("0/100");
    });

    it("handles suspicion score of 100", () => {
      const alert = createSampleAlert({ suspicionScore: 100 });
      const fields = createAlertFields(alert);

      const scoreField = fields.find((f) => f.name === "Suspicion Score");
      expect(scoreField?.value).toContain("100/100");
      expect(scoreField?.value).toContain("🚨");
    });
  });
});
