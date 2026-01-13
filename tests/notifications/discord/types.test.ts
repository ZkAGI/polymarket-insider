/**
 * Unit tests for Discord notification types
 */

import { describe, it, expect } from "vitest";
import {
  DiscordEmbedColor,
  DiscordMessageStatus,
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
} from "../../../src/notifications/discord/types";

describe("Discord Types", () => {
  describe("DiscordEmbedColor", () => {
    it("should have correct color values", () => {
      expect(DiscordEmbedColor.RED).toBe(15548997);
      expect(DiscordEmbedColor.GREEN).toBe(5763719);
      expect(DiscordEmbedColor.BLUE).toBe(3447003);
      expect(DiscordEmbedColor.GOLD).toBe(15844367);
      expect(DiscordEmbedColor.YELLOW).toBe(16776960);
      expect(DiscordEmbedColor.WHITE).toBe(16777215);
      expect(DiscordEmbedColor.BLACK).toBe(0);
    });
  });

  describe("DiscordMessageStatus", () => {
    it("should have all status values", () => {
      expect(DiscordMessageStatus.PENDING).toBe("pending");
      expect(DiscordMessageStatus.SENT).toBe("sent");
      expect(DiscordMessageStatus.FAILED).toBe("failed");
      expect(DiscordMessageStatus.RATE_LIMITED).toBe("rate_limited");
    });
  });

  describe("isValidWebhookUrl", () => {
    it("should accept valid Discord webhook URLs", () => {
      expect(
        isValidWebhookUrl(
          "https://discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(true);
      expect(
        isValidWebhookUrl(
          "https://discordapp.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(true);
      expect(
        isValidWebhookUrl(
          "https://canary.discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(true);
      expect(
        isValidWebhookUrl(
          "https://ptb.discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(true);
    });

    it("should reject invalid webhook URLs", () => {
      // Not HTTPS
      expect(
        isValidWebhookUrl(
          "http://discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(false);

      // Wrong host
      expect(
        isValidWebhookUrl(
          "https://example.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe(false);

      // Missing path
      expect(isValidWebhookUrl("https://discord.com/api/webhooks")).toBe(false);

      // Invalid path format
      expect(
        isValidWebhookUrl("https://discord.com/api/webhooks/invalid")
      ).toBe(false);

      // Empty string
      expect(isValidWebhookUrl("")).toBe(false);

      // Not a string
      expect(isValidWebhookUrl(null as unknown as string)).toBe(false);
      expect(isValidWebhookUrl(undefined as unknown as string)).toBe(false);
      expect(isValidWebhookUrl(123 as unknown as string)).toBe(false);
    });

    it("should reject malformed URLs", () => {
      expect(isValidWebhookUrl("not-a-url")).toBe(false);
      expect(isValidWebhookUrl("discord.com/api/webhooks/123/abc")).toBe(false);
    });
  });

  describe("extractWebhookId", () => {
    it("should extract webhook ID from valid URLs", () => {
      expect(
        extractWebhookId(
          "https://discord.com/api/webhooks/1234567890/abcdefghijk-lmnopqrst"
        )
      ).toBe("1234567890");
      expect(
        extractWebhookId(
          "https://discordapp.com/api/webhooks/9876543210/xyz123"
        )
      ).toBe("9876543210");
    });

    it("should return null for invalid URLs", () => {
      expect(extractWebhookId("")).toBe(null);
      expect(extractWebhookId("not-a-url")).toBe(null);
      expect(extractWebhookId("https://example.com/api/webhooks/123/abc")).toBe(
        null
      );
    });
  });

  describe("maskWebhookUrl", () => {
    it("should mask the webhook token", () => {
      const masked = maskWebhookUrl(
        "https://discord.com/api/webhooks/1234567890/secret-token-here"
      );
      expect(masked).toBe("https://discord.com/api/webhooks/1234567890/****");
      expect(masked).not.toContain("secret-token-here");
    });

    it("should handle invalid input", () => {
      expect(maskWebhookUrl("")).toBe("****");
      expect(maskWebhookUrl(null as unknown as string)).toBe("****");
      expect(maskWebhookUrl("not-a-url")).toBe("****");
    });
  });

  describe("isValidFieldValue", () => {
    it("should accept valid field values", () => {
      expect(isValidFieldValue("test")).toBe(true);
      expect(isValidFieldValue("a")).toBe(true);
      expect(isValidFieldValue("a".repeat(1024))).toBe(true);
    });

    it("should reject invalid field values", () => {
      expect(isValidFieldValue("")).toBe(false);
      expect(isValidFieldValue("a".repeat(1025))).toBe(false);
      expect(isValidFieldValue(null as unknown as string)).toBe(false);
      expect(isValidFieldValue(123 as unknown as string)).toBe(false);
    });
  });

  describe("isValidFieldName", () => {
    it("should accept valid field names", () => {
      expect(isValidFieldName("Test Field")).toBe(true);
      expect(isValidFieldName("a")).toBe(true);
      expect(isValidFieldName("a".repeat(256))).toBe(true);
    });

    it("should reject invalid field names", () => {
      expect(isValidFieldName("")).toBe(false);
      expect(isValidFieldName("a".repeat(257))).toBe(false);
      expect(isValidFieldName(null as unknown as string)).toBe(false);
    });
  });

  describe("isValidEmbedTitle", () => {
    it("should accept valid embed titles", () => {
      expect(isValidEmbedTitle("Test Title")).toBe(true);
      expect(isValidEmbedTitle("")).toBe(true); // Empty title is OK
      expect(isValidEmbedTitle("a".repeat(256))).toBe(true);
    });

    it("should reject invalid embed titles", () => {
      expect(isValidEmbedTitle("a".repeat(257))).toBe(false);
      expect(isValidEmbedTitle(null as unknown as string)).toBe(false);
    });
  });

  describe("isValidEmbedDescription", () => {
    it("should accept valid embed descriptions", () => {
      expect(isValidEmbedDescription("Test description")).toBe(true);
      expect(isValidEmbedDescription("")).toBe(true);
      expect(isValidEmbedDescription("a".repeat(4096))).toBe(true);
    });

    it("should reject invalid embed descriptions", () => {
      expect(isValidEmbedDescription("a".repeat(4097))).toBe(false);
      expect(isValidEmbedDescription(null as unknown as string)).toBe(false);
    });
  });

  describe("isValidMessageContent", () => {
    it("should accept valid message content", () => {
      expect(isValidMessageContent("Hello!")).toBe(true);
      expect(isValidMessageContent("")).toBe(true);
      expect(isValidMessageContent("a".repeat(2000))).toBe(true);
    });

    it("should reject invalid message content", () => {
      expect(isValidMessageContent("a".repeat(2001))).toBe(false);
      expect(isValidMessageContent(null as unknown as string)).toBe(false);
    });
  });

  describe("calculateEmbedCharacterCount", () => {
    it("should calculate character count correctly", () => {
      expect(calculateEmbedCharacterCount({})).toBe(0);

      expect(
        calculateEmbedCharacterCount({
          title: "Hello", // 5
        })
      ).toBe(5);

      expect(
        calculateEmbedCharacterCount({
          title: "Hello", // 5
          description: "World", // 5
        })
      ).toBe(10);

      expect(
        calculateEmbedCharacterCount({
          title: "Test", // 4
          description: "Description", // 11
          footer: { text: "Footer" }, // 6
          author: { name: "Author" }, // 6
        })
      ).toBe(27);

      expect(
        calculateEmbedCharacterCount({
          fields: [
            { name: "Field1", value: "Value1" }, // 6 + 6 = 12
            { name: "Field2", value: "Value2" }, // 6 + 6 = 12
          ],
        })
      ).toBe(24);
    });
  });

  describe("isValidEmbedTotal", () => {
    it("should accept valid embed totals", () => {
      expect(isValidEmbedTotal([])).toBe(true);
      expect(
        isValidEmbedTotal([
          { title: "Test", description: "a".repeat(5990) }, // ~6000 chars
        ])
      ).toBe(true);
    });

    it("should reject exceeding embed totals", () => {
      expect(
        isValidEmbedTotal([
          { description: "a".repeat(6001) }, // Over limit
        ])
      ).toBe(false);
    });
  });

  describe("truncateForDiscord", () => {
    it("should not truncate short strings", () => {
      expect(truncateForDiscord("Hello", 100)).toBe("Hello");
      expect(truncateForDiscord("", 100)).toBe("");
    });

    it("should truncate long strings with default suffix", () => {
      expect(truncateForDiscord("Hello World", 8)).toBe("Hello...");
      expect(truncateForDiscord("abcdefghij", 7)).toBe("abcd...");
    });

    it("should truncate with custom suffix", () => {
      expect(truncateForDiscord("Hello World", 8, "…")).toBe("Hello W…");
      expect(truncateForDiscord("Hello World", 10, "[more]")).toBe("Hell[more]");
    });

    it("should handle edge cases", () => {
      expect(truncateForDiscord("Hi", 5)).toBe("Hi");
      expect(truncateForDiscord(null as unknown as string, 100)).toBeFalsy();
    });
  });

  describe("formatTimestampForEmbed", () => {
    it("should format date as ISO 8601", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      expect(formatTimestampForEmbed(date)).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should handle different dates", () => {
      const date = new Date("2023-12-25T00:00:00.000Z");
      expect(formatTimestampForEmbed(date)).toBe("2023-12-25T00:00:00.000Z");
    });
  });

  describe("generateResultId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateResultId();
      const id2 = generateResultId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^discord_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^discord_\d+_[a-z0-9]+$/);
    });

    it("should include discord prefix", () => {
      const id = generateResultId();
      expect(id.startsWith("discord_")).toBe(true);
    });
  });
});
