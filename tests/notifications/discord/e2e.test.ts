/**
 * E2E Integration tests for Discord notification module
 * Tests that the Discord module can be imported and used correctly end-to-end
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  // Types and enums
  DiscordEmbedColor,
  DiscordMessageStatus,
  // Validation functions
  isValidWebhookUrl,
  extractWebhookId,
  maskWebhookUrl,
  isValidFieldValue,
  isValidFieldName,
  isValidEmbedTitle,
  isValidEmbedDescription,
  isValidMessageContent,
  calculateEmbedCharacterCount,
  isValidEmbedTotal,
  truncateForDiscord,
  formatTimestampForEmbed,
  generateResultId,
  // Client
  DiscordClient,
  DiscordClientError,
  getDiscordClient,
  createDiscordClient,
  resetDiscordClient,
  // Embed Formatter
  type AlertSeverity,
  type AlertType,
  type DiscordAlertData,
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
  // Types for type checking
  type DiscordWebhookConfig,
  type DiscordEmbed,
  type DiscordMessage,
} from "../../../src/notifications/discord";

describe("Discord E2E Integration Tests", () => {
  // Reset singleton after each test
  afterEach(() => {
    resetDiscordClient();
  });

  describe("Module Exports", () => {
    it("should export all enums correctly", () => {
      expect(DiscordEmbedColor).toBeDefined();
      expect(DiscordEmbedColor.RED).toBe(15548997);
      expect(DiscordEmbedColor.GREEN).toBe(5763719);
      expect(DiscordEmbedColor.BLUE).toBe(3447003);
      expect(DiscordEmbedColor.GOLD).toBe(15844367);

      expect(DiscordMessageStatus).toBeDefined();
      expect(DiscordMessageStatus.PENDING).toBe("pending");
      expect(DiscordMessageStatus.SENT).toBe("sent");
      expect(DiscordMessageStatus.FAILED).toBe("failed");
      expect(DiscordMessageStatus.RATE_LIMITED).toBe("rate_limited");
    });

    it("should export all validation functions", () => {
      expect(typeof isValidWebhookUrl).toBe("function");
      expect(typeof extractWebhookId).toBe("function");
      expect(typeof maskWebhookUrl).toBe("function");
      expect(typeof isValidFieldValue).toBe("function");
      expect(typeof isValidFieldName).toBe("function");
      expect(typeof isValidEmbedTitle).toBe("function");
      expect(typeof isValidEmbedDescription).toBe("function");
      expect(typeof isValidMessageContent).toBe("function");
      expect(typeof calculateEmbedCharacterCount).toBe("function");
      expect(typeof isValidEmbedTotal).toBe("function");
      expect(typeof truncateForDiscord).toBe("function");
      expect(typeof formatTimestampForEmbed).toBe("function");
      expect(typeof generateResultId).toBe("function");
    });

    it("should export DiscordClient class and helpers", () => {
      expect(DiscordClient).toBeDefined();
      expect(DiscordClientError).toBeDefined();
      expect(typeof getDiscordClient).toBe("function");
      expect(typeof createDiscordClient).toBe("function");
      expect(typeof resetDiscordClient).toBe("function");
    });
  });

  describe("Validation Functions E2E", () => {
    it("should validate webhook URLs correctly", () => {
      const validUrl =
        "https://discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst";
      const invalidUrl = "https://example.com/webhook";

      expect(isValidWebhookUrl(validUrl)).toBe(true);
      expect(isValidWebhookUrl(invalidUrl)).toBe(false);
    });

    it("should extract webhook IDs correctly", () => {
      const url =
        "https://discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst";
      expect(extractWebhookId(url)).toBe("1234567890");
    });

    it("should mask webhook URLs for security", () => {
      const url =
        "https://discord.com/api/webhooks/1234567890/secret-token-here";
      const masked = maskWebhookUrl(url);

      expect(masked).toContain("1234567890");
      expect(masked).not.toContain("secret-token-here");
      expect(masked).toContain("****");
    });

    it("should validate field lengths correctly", () => {
      expect(isValidFieldName("Test Field")).toBe(true);
      expect(isValidFieldName("a".repeat(257))).toBe(false);
      expect(isValidFieldValue("Test Value")).toBe(true);
      expect(isValidFieldValue("a".repeat(1025))).toBe(false);
    });

    it("should truncate strings correctly", () => {
      const longString = "This is a very long string that needs truncation";
      const truncated = truncateForDiscord(longString, 20);

      expect(truncated.length).toBeLessThanOrEqual(20);
      expect(truncated).toContain("...");
    });

    it("should calculate embed character counts", () => {
      const embed: DiscordEmbed = {
        title: "Test Title",
        description: "Test Description",
        fields: [{ name: "Field1", value: "Value1" }],
      };

      const count = calculateEmbedCharacterCount(embed);
      expect(count).toBe(
        "Test Title".length +
          "Test Description".length +
          "Field1".length +
          "Value1".length
      );
    });
  });

  describe("Client Creation E2E", () => {
    const testConfig: DiscordWebhookConfig = {
      webhookUrl:
        "https://discord.com/api/webhooks/1234567890/test-token-abc123",
      username: "E2E Test Bot",
      devMode: true,
    };

    it("should create client with valid configuration", () => {
      const client = new DiscordClient(testConfig);

      expect(client).toBeInstanceOf(DiscordClient);
      expect(client.getConfig().devMode).toBe(true);
      expect(client.getConfig().username).toBe("E2E Test Bot");
    });

    it("should reject invalid webhook URL in production mode", () => {
      // Invalid URL is only rejected when NOT in dev mode
      expect(() => {
        new DiscordClient({
          webhookUrl: "invalid-url",
          devMode: false, // Production mode requires valid URL
        });
      }).toThrow(DiscordClientError);
    });

    it("should use singleton pattern correctly", () => {
      // Ensure clean state first
      resetDiscordClient();

      // getDiscordClient returns the same singleton instance on repeated calls
      const client1 = getDiscordClient();
      const client2 = getDiscordClient();

      expect(client1).toBe(client2);

      // Reset clears the singleton, so a new instance is created on next call
      resetDiscordClient();
      const client3 = getDiscordClient();
      expect(client3).not.toBe(client1);
    });

    it("should create new instances with createDiscordClient", () => {
      // createDiscordClient always creates NEW instances (not singletons)
      const client1 = createDiscordClient(testConfig);
      const client2 = createDiscordClient(testConfig);

      expect(client1).not.toBe(client2);
      expect(client1).toBeInstanceOf(DiscordClient);
      expect(client2).toBeInstanceOf(DiscordClient);
    });
  });

  describe("Message Sending E2E (Dev Mode)", () => {
    let client: DiscordClient;

    beforeEach(() => {
      client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });
    });

    it("should send simple message in dev mode", async () => {
      const message: DiscordMessage = {
        content: "Hello from E2E test!",
      };

      const result = await client.sendMessage(message);

      expect(result.status).toBe(DiscordMessageStatus.SENT);
      expect(result.id).toMatch(/^discord_\d+_[a-z0-9]+$/);
    });

    it("should send message with embed in dev mode", async () => {
      const message: DiscordMessage = {
        embeds: [
          {
            title: "E2E Test Embed",
            description: "This is a test embed from E2E tests",
            color: DiscordEmbedColor.GREEN,
            fields: [
              { name: "Status", value: "Testing", inline: true },
              { name: "Environment", value: "E2E", inline: true },
            ],
            footer: { text: "E2E Test Footer" },
            timestamp: formatTimestampForEmbed(new Date()),
          },
        ],
      };

      const result = await client.sendMessage(message);

      expect(result.status).toBe(DiscordMessageStatus.SENT);
    });

    it("should send batch messages in dev mode", async () => {
      const messages: DiscordMessage[] = [
        { content: "Batch message 1" },
        { content: "Batch message 2" },
        { content: "Batch message 3" },
      ];

      const result = await client.sendBatch(messages);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });
  });

  describe("Event System E2E", () => {
    it("should emit events during message sending", async () => {
      const events: string[] = [];

      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      client.on("message:sending", () => {
        events.push("sending");
      });
      client.on("message:sent", () => {
        events.push("sent");
      });

      await client.sendMessage({ content: "Event test" });

      expect(events).toContain("sending");
      expect(events).toContain("sent");
    });

    it("should support event unsubscription via returned function", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      let callCount = 0;
      const handler = () => {
        callCount++;
      };

      // on() returns an unsubscribe function
      const unsubscribe = client.on("message:sent", handler);
      unsubscribe();

      // Send message after unsubscription
      await client.sendMessage({ content: "Test" });

      // Event should not be called after unsubscription
      expect(callCount).toBe(0);
    });
  });

  describe("Connection Testing E2E", () => {
    it("should test connection in dev mode", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      const result = await client.testConnection();

      // testConnection returns DiscordWebhookInfo in dev mode
      expect(result).not.toBeNull();
      expect(result?.id).toBeDefined();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe("Statistics Tracking E2E", () => {
    it("should track message statistics", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      // Initial stats
      const initialStats = client.getStats();
      expect(initialStats.sent).toBe(0);
      expect(initialStats.failed).toBe(0);
      expect(initialStats.total).toBe(0);

      // Send messages
      await client.sendMessage({ content: "Test 1" });
      await client.sendMessage({ content: "Test 2" });

      // Check updated stats
      const updatedStats = client.getStats();
      expect(updatedStats.sent).toBe(2);
      expect(updatedStats.total).toBe(2);
    });
  });

  describe("Complex Embed E2E", () => {
    it("should handle complex embed with all fields", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      const complexMessage: DiscordMessage = {
        content: "Main content",
        username: "Custom Bot Name",
        embeds: [
          {
            title: "Complex Embed Title",
            description: "A detailed description of the embed content",
            url: "https://polymarket.com",
            color: DiscordEmbedColor.GOLD,
            author: {
              name: "Polymarket Tracker",
              url: "https://polymarket.com",
              icon_url: "https://example.com/icon.png",
            },
            thumbnail: {
              url: "https://example.com/thumb.png",
            },
            fields: [
              { name: "Market", value: "Bitcoin > $100k", inline: true },
              { name: "Probability", value: "75%", inline: true },
              { name: "Volume", value: "$1.2M", inline: true },
              { name: "Change", value: "+5.2%", inline: false },
            ],
            image: {
              url: "https://example.com/chart.png",
            },
            footer: {
              text: "Polymarket Tracker • E2E Test",
              icon_url: "https://example.com/footer-icon.png",
            },
            timestamp: formatTimestampForEmbed(new Date()),
          },
        ],
        allowed_mentions: {
          parse: [],
        },
      };

      const result = await client.sendMessage(complexMessage);

      expect(result.status).toBe(DiscordMessageStatus.SENT);
    });
  });

  describe("Error Handling E2E", () => {
    it("should throw on message content exceeding limit", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      // Message with content exceeding limit should throw
      await expect(
        client.sendMessage({
          content: "a".repeat(2001),
        })
      ).rejects.toThrow(DiscordClientError);
    });

    it("should throw on empty message", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      // Empty message should throw
      await expect(client.sendMessage({})).rejects.toThrow(DiscordClientError);
    });

    it("should not increment failed count for validation errors", async () => {
      const client = new DiscordClient({
        webhookUrl:
          "https://discord.com/api/webhooks/1234567890/test-token-abc123",
        devMode: true,
      });

      // Validation errors throw before sending, so they don't increment failed count
      try {
        await client.sendMessage({ content: "a".repeat(2001) });
      } catch {
        // Expected to throw
      }

      const stats = client.getStats();
      // Validation errors don't count as "failed sends" since no send was attempted
      expect(stats.failed).toBe(0);
      expect(stats.sent).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("Result ID Generation E2E", () => {
    it("should generate unique result IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateResultId());
      }
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it("should format result IDs correctly", () => {
      const id = generateResultId();
      expect(id).toMatch(/^discord_\d+_[a-z0-9]+$/);
    });
  });

  describe("Timestamp Formatting E2E", () => {
    it("should format timestamps in ISO 8601", () => {
      const date = new Date("2024-06-15T12:30:45.000Z");
      const formatted = formatTimestampForEmbed(date);

      expect(formatted).toBe("2024-06-15T12:30:45.000Z");
    });
  });

  describe("Embed Formatter E2E", () => {
    /**
     * Create a sample alert for E2E testing
     */
    function createSampleAlert(overrides: Partial<DiscordAlertData> = {}): DiscordAlertData {
      return {
        alertId: "e2e-alert-123",
        alertType: "whale_trade",
        severity: "high",
        title: "Large Whale Trade Detected",
        message: "A significant trade has been detected on the Presidential Election 2026 market.",
        timestamp: new Date("2026-01-13T10:00:00Z"),
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        marketId: "election-2026",
        marketTitle: "Presidential Election 2026",
        tradeSize: 100000,
        priceChange: 12.5,
        suspicionScore: 85,
        actionUrl: "https://tracker.example.com/alert/e2e-alert-123",
        dashboardUrl: "https://tracker.example.com/dashboard",
        ...overrides,
      };
    }

    describe("Module Exports for Embed Formatter", () => {
      it("should export all embed formatter functions", () => {
        expect(typeof formatCurrency).toBe("function");
        expect(typeof formatPercentage).toBe("function");
        expect(typeof truncateWallet).toBe("function");
        expect(typeof getAlertColor).toBe("function");
        expect(typeof createEmbedField).toBe("function");
        expect(typeof createAlertFields).toBe("function");
        expect(typeof buildAlertEmbed).toBe("function");
        expect(typeof formatDiscordAlert).toBe("function");
        expect(typeof createAlertMessage).toBe("function");
        expect(typeof createAlertEmbeds).toBe("function");
        expect(typeof createAlertSummaryEmbed).toBe("function");
        expect(typeof createAlertSummaryMessage).toBe("function");
        expect(typeof getSeverityEmoji).toBe("function");
        expect(typeof getSeverityColor).toBe("function");
        expect(typeof getAlertTypeEmoji).toBe("function");
        expect(typeof getAlertTypeLabel).toBe("function");
        expect(typeof getAlertTypeColor).toBe("function");
        expect(typeof validateAlertData).toBe("function");
        expect(typeof createSimpleEmbed).toBe("function");
        expect(typeof createErrorEmbed).toBe("function");
        expect(typeof createSuccessEmbed).toBe("function");
        expect(typeof createInfoEmbed).toBe("function");
        expect(typeof createWarningEmbed).toBe("function");
      });

      it("should export alert type and severity configs", () => {
        expect(ALERT_TYPE_CONFIG).toBeDefined();
        expect(SEVERITY_CONFIG).toBeDefined();
        expect(Object.keys(ALERT_TYPE_CONFIG).length).toBe(12);
        expect(Object.keys(SEVERITY_CONFIG).length).toBe(5);
      });
    });

    describe("Full Alert Embed Creation E2E", () => {
      it("should create a complete alert embed ready for sending", () => {
        const alert = createSampleAlert();
        const message = createAlertMessage(alert);

        expect(message.embeds).toBeDefined();
        expect(message.embeds?.length).toBe(1);
        expect(message.embeds?.[0]?.title).toContain("🐋");
        expect(message.embeds?.[0]?.title).toContain("Large Whale Trade Detected");
        expect(message.embeds?.[0]?.color).toBeDefined();
        expect(message.embeds?.[0]?.fields?.length).toBeGreaterThan(0);
      });

      it("should create critical alert with content warning", () => {
        const alert = createSampleAlert({ severity: "critical" });
        const message = createAlertMessage(alert);

        expect(message.content).toBeDefined();
        expect(message.content).toContain("Critical");
      });

      it("should create batch embeds for multiple alerts", () => {
        const alerts = [
          createSampleAlert({ alertId: "1", alertType: "whale_trade" }),
          createSampleAlert({ alertId: "2", alertType: "insider_activity" }),
          createSampleAlert({ alertId: "3", alertType: "fresh_wallet" }),
          createSampleAlert({ alertId: "4", alertType: "coordinated_activity" }),
          createSampleAlert({ alertId: "5", alertType: "price_movement" }),
        ];

        const embeds = createAlertEmbeds(alerts);

        expect(embeds.length).toBe(5);
        embeds.forEach((embed) => {
          expect(embed.title).toBeDefined();
          expect(embed.description).toBeDefined();
          expect(embed.color).toBeDefined();
        });
      });

      it("should create summary embed with severity and type breakdown", () => {
        const alerts = [
          createSampleAlert({ severity: "critical", alertType: "insider_activity" }),
          createSampleAlert({ severity: "critical", alertType: "whale_trade" }),
          createSampleAlert({ severity: "high", alertType: "whale_trade" }),
          createSampleAlert({ severity: "medium", alertType: "fresh_wallet" }),
          createSampleAlert({ severity: "low", alertType: "price_movement" }),
        ];

        const embed = createAlertSummaryEmbed(alerts);

        expect(embed.title).toContain("5 alerts");
        expect(embed.fields).toBeDefined();
        expect(embed.fields?.length).toBeGreaterThan(0);

        const severityField = embed.fields?.find((f) => f.name === "By Severity");
        const typeField = embed.fields?.find((f) => f.name === "By Type");

        expect(severityField).toBeDefined();
        expect(typeField).toBeDefined();
      });
    });

    describe("Alert Type Integration E2E", () => {
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

      it.each(alertTypes)("should handle alert type: %s", (alertType) => {
        const alert = createSampleAlert({ alertType });
        const embed = buildAlertEmbed(alert);

        const typeConfig = ALERT_TYPE_CONFIG[alertType];
        expect(embed.title).toContain(typeConfig.emoji);
        expect(embed.color).toBeDefined();
      });
    });

    describe("Severity Integration E2E", () => {
      const severities: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

      it.each(severities)("should handle severity: %s", (severity) => {
        const alert = createSampleAlert({ severity });
        const embed = buildAlertEmbed(alert);
        const fields = embed.fields || [];

        const severityField = fields.find((f) => f.name === "Severity");
        const severityConfig = SEVERITY_CONFIG[severity];

        expect(severityField).toBeDefined();
        expect(severityField?.value).toContain(severityConfig.emoji);
        expect(severityField?.value).toContain(severityConfig.label);
      });
    });

    describe("Client Integration with Embed Formatter E2E", () => {
      let client: DiscordClient;

      beforeEach(() => {
        client = new DiscordClient({
          webhookUrl:
            "https://discord.com/api/webhooks/1234567890/test-token-abc123",
          devMode: true,
        });
      });

      it("should send formatted alert via client", async () => {
        const alert = createSampleAlert();
        const message = createAlertMessage(alert);

        const result = await client.sendMessage(message);

        expect(result.status).toBe(DiscordMessageStatus.SENT);
      });

      it("should send summary message via client", async () => {
        const alerts = [
          createSampleAlert({ alertId: "1" }),
          createSampleAlert({ alertId: "2" }),
        ];
        const message = createAlertSummaryMessage(alerts);

        const result = await client.sendMessage(message);

        expect(result.status).toBe(DiscordMessageStatus.SENT);
      });

      it("should send utility embeds via client", async () => {
        const embeds = [
          createSuccessEmbed("Success", "Operation completed"),
          createErrorEmbed("Error", "Something failed"),
          createInfoEmbed("Info", "Information message"),
          createWarningEmbed("Warning", "Be careful"),
        ];

        for (const embed of embeds) {
          const message: DiscordMessage = { embeds: [embed] };
          const result = await client.sendMessage(message);
          expect(result.status).toBe(DiscordMessageStatus.SENT);
        }
      });
    });

    describe("Currency and Formatting E2E", () => {
      it("should format various trade sizes correctly", () => {
        const testCases = [
          { value: 100, expected: "$100" },
          { value: 1000, expected: "$1,000" },
          { value: 10000, expected: "$10,000" },
          { value: 100000, expected: "$100,000" },
          { value: 1000000, expected: "$1,000,000" },
          { value: 1234567.89, expected: "$1,234,567.89" },
        ];

        for (const { value, expected } of testCases) {
          expect(formatCurrency(value)).toBe(expected);
        }
      });

      it("should format various percentages correctly", () => {
        const testCases = [
          { value: 0, expected: "+0.00%" },
          { value: 5.5, expected: "+5.50%" },
          { value: -3.25, expected: "-3.25%" },
          { value: 100, expected: "+100.00%" },
          { value: -50.5, expected: "-50.50%" },
        ];

        for (const { value, expected } of testCases) {
          expect(formatPercentage(value)).toBe(expected);
        }
      });

      it("should truncate wallet addresses consistently", () => {
        const testCases = [
          {
            address: "0x1234567890abcdef1234567890abcdef12345678",
            expected: "0x1234...5678"
          },
          {
            address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            expected: "0xabcd...abcd"
          },
          {
            address: "0x123",
            expected: "0x123"
          },
        ];

        for (const { address, expected } of testCases) {
          expect(truncateWallet(address)).toBe(expected);
        }
      });
    });

    describe("Validation E2E", () => {
      it("should validate complete alert data", () => {
        const alert = createSampleAlert();
        const errors = validateAlertData(alert);

        expect(errors.length).toBe(0);
      });

      it("should report all validation errors", () => {
        const invalidAlert: DiscordAlertData = {
          alertId: "",
          alertType: "invalid_type" as AlertType,
          severity: "invalid_severity" as AlertSeverity,
          title: "",
          message: "",
          timestamp: "not-a-date" as unknown as Date,
        };

        const errors = validateAlertData(invalidAlert);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors).toContain("alertId is required");
        expect(errors).toContain("title is required");
        expect(errors).toContain("message is required");
      });
    });

    describe("Color Selection E2E", () => {
      it("should return severity color for critical/high alerts", () => {
        expect(getAlertColor("critical", "whale_trade")).toBe(getSeverityColor("critical"));
        expect(getAlertColor("high", "fresh_wallet")).toBe(getSeverityColor("high"));
      });

      it("should return type color for medium/low/info alerts", () => {
        expect(getAlertColor("medium", "whale_trade")).toBe(getAlertTypeColor("whale_trade"));
        expect(getAlertColor("low", "fresh_wallet")).toBe(getAlertTypeColor("fresh_wallet"));
        expect(getAlertColor("info", "system")).toBe(getAlertTypeColor("system"));
      });
    });

    describe("Edge Cases E2E", () => {
      it("should handle alert with missing optional fields", () => {
        const minimalAlert: DiscordAlertData = {
          alertId: "minimal-123",
          alertType: "system",
          severity: "info",
          title: "Simple Alert",
          message: "A simple system message",
          timestamp: new Date(),
        };

        const embed = buildAlertEmbed(minimalAlert);

        expect(embed.title).toBeDefined();
        expect(embed.description).toBeDefined();
        expect(embed.fields?.length).toBeGreaterThan(0);
      });

      it("should handle very long alert messages", () => {
        const longMessage = "A".repeat(5000);
        const alert = createSampleAlert({ message: longMessage });

        const embed = buildAlertEmbed(alert, { maxDescriptionLength: 1000 });

        expect(embed.description?.length).toBeLessThanOrEqual(1000);
      });

      it("should handle alert with metadata", () => {
        const alert = createSampleAlert({
          metadata: {
            customKey1: "Custom Value 1",
            customKey2: 42,
            customKey3: true,
          },
        });

        const fields = createAlertFields(alert);
        const customField = fields.find((f) => f.name === "customKey1");

        expect(customField).toBeDefined();
        expect(customField?.value).toBe("Custom Value 1");
      });

      it("should limit batch embeds to 10 maximum", () => {
        const alerts = Array.from({ length: 15 }, (_, i) =>
          createSampleAlert({ alertId: `alert-${i}` })
        );

        const embeds = createAlertEmbeds(alerts);

        expect(embeds.length).toBe(10);
      });

      it("should handle empty alerts array for summary", () => {
        const embed = createAlertSummaryEmbed([]);

        expect(embed.title).toBe("📊 Alert Summary");
        expect(embed.description).toBe("No alerts to display.");
      });
    });
  });
});
