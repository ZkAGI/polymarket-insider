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
});
