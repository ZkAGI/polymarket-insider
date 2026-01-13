/**
 * Unit tests for Discord webhook client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DiscordClient,
  DiscordClientError,
  createDiscordClient,
  getDiscordClient,
  resetDiscordClient,
} from "../../../src/notifications/discord/client";
import {
  DiscordMessageStatus,
  DiscordEventType,
  DiscordMessage,
  DiscordEmbed,
  DiscordEmbedColor,
} from "../../../src/notifications/discord/types";

describe("DiscordClient", () => {
  const validWebhookUrl =
    "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz-1234567890";

  beforeEach(() => {
    resetDiscordClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetDiscordClient();
  });

  describe("constructor", () => {
    it("should create client with valid webhook URL", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      expect(client).toBeInstanceOf(DiscordClient);
      expect(client.isDevMode()).toBe(true);
    });

    it("should throw error for missing webhook URL in production mode", () => {
      expect(() =>
        createDiscordClient({
          webhookUrl: "",
          devMode: false,
        })
      ).toThrow(DiscordClientError);
    });

    it("should throw error for invalid webhook URL in production mode", () => {
      expect(() =>
        createDiscordClient({
          webhookUrl: "https://example.com/invalid",
          devMode: false,
        })
      ).toThrow(DiscordClientError);
    });

    it("should allow empty webhook URL in dev mode", () => {
      const client = createDiscordClient({
        webhookUrl: "",
        devMode: true,
      });

      expect(client.isDevMode()).toBe(true);
    });

    it("should use default configuration values", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const config = client.getConfig();
      expect(config.username).toBe("Polymarket Tracker");
      expect(config.rateLimit).toBe(5);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
      expect(config.timeout).toBe(30000);
    });

    it("should allow custom configuration", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
        username: "Custom Bot",
        rateLimit: 10,
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 60000,
      });

      const config = client.getConfig();
      expect(config.username).toBe("Custom Bot");
      expect(config.rateLimit).toBe(10);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
      expect(config.timeout).toBe(60000);
    });
  });

  describe("getConfig", () => {
    it("should return masked webhook URL", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const config = client.getConfig();
      expect(config.webhookUrl).toContain("****");
      expect(config.webhookUrl).not.toContain("abcdefghijklmnopqrstuvwxyz");
    });
  });

  describe("getStats", () => {
    it("should return initial stats as zero", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("resetStats", () => {
    it("should reset statistics", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      // Send a message to increment stats
      await client.sendMessage({ content: "Test" });

      let stats = client.getStats();
      expect(stats.sent).toBe(1);

      // Reset stats
      client.resetStats();

      stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("on (event subscription)", () => {
    it("should subscribe to events", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const handler = vi.fn();
      const unsubscribe = client.on("message:sending", handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should return unsubscribe function", () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const handler = vi.fn();
      const unsubscribe = client.on("message:sending", handler);

      // Unsubscribe should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("sendMessage", () => {
    it("should send message in dev mode", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const result = await client.sendMessage({
        content: "Hello, Discord!",
      });

      expect(result.status).toBe(DiscordMessageStatus.SENT);
      expect(result.id).toBeTruthy();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should emit events when sending message", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const events: DiscordEventType[] = [];
      client.on("message:sending", () => {
        events.push("message:sending");
      });
      client.on("message:sent", () => {
        events.push("message:sent");
      });

      await client.sendMessage({ content: "Test" });

      expect(events).toContain("message:sending");
      expect(events).toContain("message:sent");
    });

    it("should increment sent count on success", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      await client.sendMessage({ content: "Test 1" });
      await client.sendMessage({ content: "Test 2" });

      const stats = client.getStats();
      expect(stats.sent).toBe(2);
    });

    it("should throw error for empty message", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      await expect(
        client.sendMessage({
          content: "",
        })
      ).rejects.toThrow(DiscordClientError);
    });

    it("should throw error for content exceeding 2000 characters", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      await expect(
        client.sendMessage({
          content: "a".repeat(2001),
        })
      ).rejects.toThrow("Message content exceeds 2000 characters");
    });

    it("should throw error for more than 10 embeds", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const embeds: DiscordEmbed[] = Array(11)
        .fill(null)
        .map(() => ({
          title: "Test",
        }));

      await expect(
        client.sendMessage({
          embeds,
        })
      ).rejects.toThrow("Maximum 10 embeds allowed per message");
    });

    it("should throw error for embeds exceeding character limit", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      await expect(
        client.sendMessage({
          embeds: [
            {
              description: "a".repeat(6001),
            },
          ],
        })
      ).rejects.toThrow("Total embed characters exceed 6000");
    });

    it("should accept message with only embeds", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const result = await client.sendMessage({
        embeds: [
          {
            title: "Test Embed",
            description: "This is a test embed",
            color: DiscordEmbedColor.BLUE,
          },
        ],
      });

      expect(result.status).toBe(DiscordMessageStatus.SENT);
    });

    it("should accept message with content and embeds", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const result = await client.sendMessage({
        content: "Hello!",
        embeds: [
          {
            title: "Test",
          },
        ],
      });

      expect(result.status).toBe(DiscordMessageStatus.SENT);
    });

    it("should handle custom username", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const result = await client.sendMessage({
        content: "Test",
        username: "Custom Bot Name",
      });

      expect(result.status).toBe(DiscordMessageStatus.SENT);
    });
  });

  describe("sendBatch", () => {
    it("should send multiple messages in batch", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const messages: DiscordMessage[] = [
        { content: "Message 1" },
        { content: "Message 2" },
        { content: "Message 3" },
      ];

      const result = await client.sendBatch(messages);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle batch with errors", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const messages: DiscordMessage[] = [
        { content: "Valid message" },
        { content: "" }, // Invalid - empty
        { content: "Another valid message" },
      ];

      const result = await client.sendBatch(messages, { stopOnError: false });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.index).toBe(1);
    });

    it("should stop on error when configured", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const messages: DiscordMessage[] = [
        { content: "Valid" },
        { content: "" }, // Invalid
        { content: "Should not be sent" },
      ];

      const result = await client.sendBatch(messages, { stopOnError: true });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      // Third message should not have been attempted
      expect(result.results).toHaveLength(1);
    });

    it("should respect batch size", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const messages: DiscordMessage[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          content: `Message ${i + 1}`,
        }));

      const result = await client.sendBatch(messages, {
        batchSize: 3,
        batchDelay: 10,
      });

      expect(result.sent).toBe(10);
    });
  });

  describe("testConnection", () => {
    it("should return webhook info in dev mode", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const info = await client.testConnection();

      expect(info).toBeTruthy();
      expect(info?.id).toBe("123456789");
      expect(info?.name).toContain("Dev");
    });

    it("should set connected status on success", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      expect(client.isConnected()).toBe(false);

      await client.testConnection();

      expect(client.isConnected()).toBe(true);
    });

    it("should emit connected event on success", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const events: DiscordEventType[] = [];
      client.on("webhook:connected", () => {
        events.push("webhook:connected");
      });

      await client.testConnection();

      expect(events).toContain("webhook:connected");
    });
  });

  describe("getWebhookInfo", () => {
    it("should return mock info in dev mode", async () => {
      const client = createDiscordClient({
        webhookUrl: validWebhookUrl,
        devMode: true,
      });

      const info = await client.getWebhookInfo();

      expect(info).toBeTruthy();
      expect(info.id).toBeTruthy();
      expect(info.channel_id).toBeTruthy();
    });
  });

  describe("Singleton management", () => {
    it("should create singleton on first call", () => {
      const client1 = getDiscordClient();
      const client2 = getDiscordClient();

      expect(client1).toBe(client2);
    });

    it("should reset singleton", () => {
      const client1 = getDiscordClient();
      resetDiscordClient();
      const client2 = getDiscordClient();

      expect(client1).not.toBe(client2);
    });
  });

  describe("DiscordClientError", () => {
    it("should create error with all properties", () => {
      const error = new DiscordClientError("Test error", "TEST_CODE", {
        statusCode: 400,
        retryable: true,
        retryAfter: 5,
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5);
      expect(error.name).toBe("DiscordClientError");
    });

    it("should have default values", () => {
      const error = new DiscordClientError("Test error", "TEST_CODE");

      expect(error.retryable).toBe(false);
      expect(error.statusCode).toBeUndefined();
      expect(error.retryAfter).toBeUndefined();
    });

    it("should include cause when provided", () => {
      const cause = new Error("Original error");
      const error = new DiscordClientError("Wrapped error", "WRAP", {
        cause,
      });

      expect(error.cause).toBe(cause);
    });
  });
});

describe("Complex embed scenarios", () => {
  const validWebhookUrl =
    "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz-1234567890";

  beforeEach(() => {
    resetDiscordClient();
  });

  it("should handle embed with all fields", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const result = await client.sendMessage({
      embeds: [
        {
          title: "Alert: Whale Trade Detected",
          description: "A large trade has been detected on Polymarket",
          url: "https://polymarket.com/market/123",
          timestamp: new Date().toISOString(),
          color: DiscordEmbedColor.GOLD,
          footer: {
            text: "Polymarket Tracker",
            icon_url: "https://example.com/icon.png",
          },
          thumbnail: {
            url: "https://example.com/thumb.png",
          },
          image: {
            url: "https://example.com/image.png",
          },
          author: {
            name: "Whale Alert",
            url: "https://example.com",
            icon_url: "https://example.com/author.png",
          },
          fields: [
            { name: "Wallet", value: "0x1234...5678", inline: true },
            { name: "Amount", value: "$50,000", inline: true },
            { name: "Market", value: "Will BTC reach $100k?", inline: false },
          ],
        },
      ],
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });

  it("should handle multiple embeds", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const result = await client.sendMessage({
      content: "Multiple alerts detected:",
      embeds: [
        {
          title: "Alert 1",
          description: "First alert",
          color: DiscordEmbedColor.RED,
        },
        {
          title: "Alert 2",
          description: "Second alert",
          color: DiscordEmbedColor.ORANGE,
        },
        {
          title: "Alert 3",
          description: "Third alert",
          color: DiscordEmbedColor.YELLOW,
        },
      ],
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });

  it("should handle embed with many fields", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const fields = Array(25)
      .fill(null)
      .map((_, i) => ({
        name: `Field ${i + 1}`,
        value: `Value ${i + 1}`,
        inline: i % 3 !== 2, // Every third field is not inline
      }));

    const result = await client.sendMessage({
      embeds: [
        {
          title: "Many Fields",
          fields,
        },
      ],
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });
});

describe("Allowed mentions", () => {
  const validWebhookUrl =
    "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz-1234567890";

  beforeEach(() => {
    resetDiscordClient();
  });

  it("should handle allowed mentions configuration", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const result = await client.sendMessage({
      content: "@everyone Check this out!",
      allowed_mentions: {
        parse: [], // Don't ping anyone
      },
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });

  it("should handle specific user mentions", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const result = await client.sendMessage({
      content: "Hey <@123456789>!",
      allowed_mentions: {
        users: ["123456789"],
      },
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });

  it("should handle role mentions", async () => {
    const client = createDiscordClient({
      webhookUrl: validWebhookUrl,
      devMode: true,
    });

    const result = await client.sendMessage({
      content: "<@&987654321> Alert!",
      allowed_mentions: {
        roles: ["987654321"],
      },
    });

    expect(result.status).toBe(DiscordMessageStatus.SENT);
  });
});
