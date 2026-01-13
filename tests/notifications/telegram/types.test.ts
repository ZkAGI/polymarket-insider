/**
 * Tests for Telegram notification types and helper functions
 */

import { describe, it, expect } from "vitest";
import {
  TelegramParseMode,
  TelegramMessageStatus,
  TelegramChatType,
  isValidBotToken,
  isValidChatId,
  escapeMarkdownV2,
  escapeHtml,
  formatChatId,
} from "../../../src/notifications/telegram/types";

describe("Telegram Types", () => {
  describe("TelegramParseMode enum", () => {
    it("should have HTML mode", () => {
      expect(TelegramParseMode.HTML).toBe("HTML");
    });

    it("should have Markdown mode", () => {
      expect(TelegramParseMode.MARKDOWN).toBe("Markdown");
    });

    it("should have MarkdownV2 mode", () => {
      expect(TelegramParseMode.MARKDOWN_V2).toBe("MarkdownV2");
    });
  });

  describe("TelegramMessageStatus enum", () => {
    it("should have all status values", () => {
      expect(TelegramMessageStatus.PENDING).toBe("pending");
      expect(TelegramMessageStatus.SENT).toBe("sent");
      expect(TelegramMessageStatus.DELIVERED).toBe("delivered");
      expect(TelegramMessageStatus.FAILED).toBe("failed");
    });
  });

  describe("TelegramChatType enum", () => {
    it("should have all chat types", () => {
      expect(TelegramChatType.PRIVATE).toBe("private");
      expect(TelegramChatType.GROUP).toBe("group");
      expect(TelegramChatType.SUPERGROUP).toBe("supergroup");
      expect(TelegramChatType.CHANNEL).toBe("channel");
    });
  });
});

describe("isValidBotToken", () => {
  it("should return true for valid bot tokens", () => {
    // Valid format: bot_id:secret (at least 35 chars in secret)
    expect(isValidBotToken("123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890")).toBe(
      true
    );
    expect(isValidBotToken("9876543210:ABC-def_GHI-jkl_MNO-pqr_STU-vwx_YZ12")).toBe(
      true
    );
  });

  it("should return false for empty or null tokens", () => {
    expect(isValidBotToken("")).toBe(false);
    expect(isValidBotToken(null as unknown as string)).toBe(false);
    expect(isValidBotToken(undefined as unknown as string)).toBe(false);
  });

  it("should return false for tokens without colon", () => {
    expect(isValidBotToken("123456789ABCdefGHIjklMNOpqrsTUVwxyz")).toBe(false);
  });

  it("should return false for tokens with non-numeric bot ID", () => {
    expect(isValidBotToken("abc:ABCdefGHIjklMNOpqrsTUVwxyz1234567890")).toBe(false);
  });

  it("should return false for tokens with too short secret", () => {
    expect(isValidBotToken("123456789:short")).toBe(false);
    expect(isValidBotToken("123456789:12345678901234567890123456789012")).toBe(false); // 34 chars
  });

  it("should return false for tokens with invalid characters in secret", () => {
    expect(isValidBotToken("123456789:ABC def GHI jkl MNO pqr STU vwx YZ")).toBe(false);
    expect(isValidBotToken("123456789:ABCdefGHIjklMNOpqrsTUVwxyz!@#$%^&")).toBe(false);
  });
});

describe("isValidChatId", () => {
  describe("numeric chat IDs", () => {
    it("should return true for positive integers (user chats)", () => {
      expect(isValidChatId(123456789)).toBe(true);
      expect(isValidChatId(1)).toBe(true);
      expect(isValidChatId(999999999)).toBe(true);
    });

    it("should return true for negative integers (group/channel chats)", () => {
      expect(isValidChatId(-123456789)).toBe(true);
      expect(isValidChatId(-1001234567890)).toBe(true);
    });

    it("should return false for zero", () => {
      expect(isValidChatId(0)).toBe(false);
    });

    it("should return false for non-integer numbers", () => {
      expect(isValidChatId(123.456)).toBe(false);
      expect(isValidChatId(NaN)).toBe(false);
      expect(isValidChatId(Infinity)).toBe(false);
    });
  });

  describe("string chat IDs", () => {
    it("should return true for valid usernames", () => {
      expect(isValidChatId("@username")).toBe(true);
      expect(isValidChatId("@valid_user")).toBe(true);
      expect(isValidChatId("@user12345")).toBe(true);
      expect(isValidChatId("@Channel_Name")).toBe(true);
    });

    it("should return true for numeric strings", () => {
      expect(isValidChatId("123456789")).toBe(true);
      expect(isValidChatId("-123456789")).toBe(true);
    });

    it("should return false for invalid usernames", () => {
      expect(isValidChatId("@ab")).toBe(false); // Too short
      expect(isValidChatId("@1abc")).toBe(false); // Starts with number
      expect(isValidChatId("@")).toBe(false); // Empty username
      expect(isValidChatId("username")).toBe(false); // Missing @
    });

    it("should return false for empty or whitespace strings", () => {
      expect(isValidChatId("")).toBe(false);
      expect(isValidChatId("   ")).toBe(false);
    });

    it("should return false for zero string", () => {
      expect(isValidChatId("0")).toBe(false);
    });
  });

  describe("invalid types", () => {
    it("should return false for null and undefined", () => {
      expect(isValidChatId(null as unknown as string)).toBe(false);
      expect(isValidChatId(undefined as unknown as string)).toBe(false);
    });
  });
});

describe("escapeMarkdownV2", () => {
  it("should escape underscore", () => {
    expect(escapeMarkdownV2("hello_world")).toBe("hello\\_world");
  });

  it("should escape asterisk", () => {
    expect(escapeMarkdownV2("*bold*")).toBe("\\*bold\\*");
  });

  it("should escape brackets", () => {
    expect(escapeMarkdownV2("[link](url)")).toBe("\\[link\\]\\(url\\)");
  });

  it("should escape multiple special characters", () => {
    expect(escapeMarkdownV2("Hello *world*! Check [this](link).")).toBe(
      "Hello \\*world\\*\\! Check \\[this\\]\\(link\\)\\."
    );
  });

  it("should escape all special characters", () => {
    const specialChars = "_*[]()~`>#+-=|{}.!";
    const escaped = escapeMarkdownV2(specialChars);
    for (const char of specialChars) {
      expect(escaped).toContain("\\" + char);
    }
  });

  it("should not modify text without special characters", () => {
    expect(escapeMarkdownV2("Hello World")).toBe("Hello World");
  });
});

describe("escapeHtml", () => {
  it("should escape ampersand", () => {
    expect(escapeHtml("Hello & World")).toBe("Hello &amp; World");
  });

  it("should escape less than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("should escape greater than", () => {
    expect(escapeHtml("value > 10")).toBe("value &gt; 10");
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('Say "Hello"')).toBe("Say &quot;Hello&quot;");
  });

  it("should escape multiple characters", () => {
    expect(escapeHtml('<a href="test">Link & More</a>')).toBe(
      "&lt;a href=&quot;test&quot;&gt;Link &amp; More&lt;/a&gt;"
    );
  });

  it("should not modify text without special characters", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("formatChatId", () => {
  it("should return username as-is if starts with @", () => {
    expect(formatChatId("@username")).toBe("@username");
  });

  it("should convert number to string", () => {
    expect(formatChatId(123456789)).toBe("123456789");
    expect(formatChatId(-123456789)).toBe("-123456789");
  });

  it("should return numeric string as-is", () => {
    expect(formatChatId("123456789")).toBe("123456789");
  });
});
