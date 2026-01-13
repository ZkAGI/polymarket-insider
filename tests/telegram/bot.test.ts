/**
 * Unit tests for Telegram Bot Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TelegramBotClient,
  createTelegramBot,
  getTelegramBot,
} from "../../src/telegram/bot";

// Mock grammy
vi.mock("grammy", () => {
  const mockBot = {
    api: {
      getMe: vi.fn().mockResolvedValue({
        id: 123456789,
        is_bot: true,
        first_name: "TestBot",
        username: "test_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      }),
      sendMessage: vi.fn().mockResolvedValue({
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 123, type: "private" },
        text: "test",
      }),
    },
    start: vi.fn().mockImplementation((options) => {
      if (options?.onStart) {
        options.onStart({ username: "test_bot" });
      }
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    catch: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
    callbackQuery: vi.fn(),
  };

  // Using a factory function pattern for the mock
  const MockBot = function(this: typeof mockBot, _token: string) {
    return Object.assign(this, mockBot);
  } as unknown as new (token: string) => typeof mockBot;

  return {
    Bot: MockBot,
    GrammyError: class GrammyError extends Error {
      description: string;
      constructor(message: string) {
        super(message);
        this.description = message;
      }
    },
    HttpError: class HttpError extends Error {},
    Context: class Context {},
  };
});

// Mock env module
vi.mock("../../config/env", () => ({
  env: {
    TELEGRAM_BOT_TOKEN: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    TELEGRAM_ADMIN_IDS: [111111111, 222222222],
  },
}));

describe("TelegramBotClient", () => {
  let client: TelegramBotClient;

  beforeEach(() => {
    client = createTelegramBot();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor and initial state", () => {
    it("should create a new instance", () => {
      expect(client).toBeInstanceOf(TelegramBotClient);
    });

    it("should have stopped status initially", () => {
      expect(client.getStatus()).toBe("stopped");
    });

    it("should have null bot initially", () => {
      expect(client.getRawBot()).toBeNull();
    });

    it("should have null last error initially", () => {
      expect(client.getLastError()).toBeNull();
    });

    it("should have null started at initially", () => {
      expect(client.getStartedAt()).toBeNull();
    });

    it("should have zero uptime when not running", () => {
      expect(client.getUptime()).toBe(0);
    });
  });

  describe("hasToken", () => {
    it("should return true when token is configured", () => {
      expect(client.hasToken()).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should initialize successfully with valid token", async () => {
      const result = await client.initialize();

      expect(result.success).toBe(true);
      expect(result.botInfo).toBeDefined();
      expect(result.botInfo?.id).toBe(123456789);
      expect(result.botInfo?.username).toBe("test_bot");
      expect(result.botInfo?.firstName).toBe("TestBot");
      expect(result.botInfo?.canJoinGroups).toBe(true);
      expect(result.botInfo?.canReadAllGroupMessages).toBe(false);
      expect(result.botInfo?.supportsInlineQueries).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("should create bot instance after initialization", async () => {
      await client.initialize();
      expect(client.getRawBot()).not.toBeNull();
    });

    it("should allow getBot() after initialization", async () => {
      await client.initialize();
      expect(() => client.getBot()).not.toThrow();
    });
  });

  describe("getBot", () => {
    it("should throw error if not initialized", () => {
      expect(() => client.getBot()).toThrow(
        "Bot is not initialized. Call initialize() first."
      );
    });

    it("should return bot instance after initialization", async () => {
      await client.initialize();
      const bot = client.getBot();
      expect(bot).toBeDefined();
    });
  });

  describe("start", () => {
    it("should throw error if not initialized", async () => {
      await expect(client.start()).rejects.toThrow(
        "Bot is not initialized. Call initialize() first."
      );
    });

    it("should start successfully after initialization", async () => {
      await client.initialize();
      await expect(client.start()).resolves.toBeUndefined();
    });

    it("should set status to running after start", async () => {
      await client.initialize();
      await client.start();
      expect(client.getStatus()).toBe("running");
    });

    it("should set startedAt after start", async () => {
      await client.initialize();
      await client.start();
      expect(client.getStartedAt()).not.toBeNull();
    });

    it("should not start again if already running", async () => {
      await client.initialize();
      await client.start();
      await client.start(); // Should not throw
      expect(client.getStatus()).toBe("running");
    });
  });

  describe("stop", () => {
    it("should do nothing if not initialized", async () => {
      await expect(client.stop()).resolves.toBeUndefined();
    });

    it("should stop successfully after start", async () => {
      await client.initialize();
      await client.start();
      await client.stop();
      expect(client.getStatus()).toBe("stopped");
    });

    it("should clear startedAt after stop", async () => {
      await client.initialize();
      await client.start();
      await client.stop();
      expect(client.getStartedAt()).toBeNull();
    });
  });

  describe("sendMessage", () => {
    it("should return error if not initialized", async () => {
      const result = await client.sendMessage(123, "test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bot is not initialized");
    });

    it("should send message successfully", async () => {
      await client.initialize();
      const result = await client.sendMessage(123, "test message");

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should send message with parse mode", async () => {
      await client.initialize();
      const result = await client.sendMessage(123, "<b>bold</b>", {
        parseMode: "HTML",
      });

      expect(result.success).toBe(true);
    });

    it("should send message with notification disabled", async () => {
      await client.initialize();
      const result = await client.sendMessage(123, "silent message", {
        disableNotification: true,
      });

      expect(result.success).toBe(true);
    });

    it("should send message with web preview disabled", async () => {
      await client.initialize();
      const result = await client.sendMessage(123, "https://example.com", {
        disableWebPagePreview: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("command handlers", () => {
    it("should throw if onCommand called before initialization", () => {
      expect(() => client.onCommand("start", vi.fn())).toThrow(
        "Bot is not initialized. Call initialize() first."
      );
    });

    it("should register command handler after initialization", async () => {
      await client.initialize();
      const handler = vi.fn();
      expect(() => client.onCommand("start", handler)).not.toThrow();
    });

    it("should throw if onMessage called before initialization", () => {
      expect(() => client.onMessage(vi.fn())).toThrow(
        "Bot is not initialized. Call initialize() first."
      );
    });

    it("should register message handler after initialization", async () => {
      await client.initialize();
      const handler = vi.fn();
      expect(() => client.onMessage(handler)).not.toThrow();
    });

    it("should throw if onCallbackQuery called before initialization", () => {
      expect(() => client.onCallbackQuery("pattern", vi.fn())).toThrow(
        "Bot is not initialized. Call initialize() first."
      );
    });

    it("should register callback query handler after initialization", async () => {
      await client.initialize();
      const handler = vi.fn();
      expect(() => client.onCallbackQuery("pattern", handler)).not.toThrow();
    });

    it("should register callback query handler with regex", async () => {
      await client.initialize();
      const handler = vi.fn();
      expect(() => client.onCallbackQuery(/^action:/, handler)).not.toThrow();
    });
  });

  describe("isAdmin", () => {
    it("should return true for admin user", () => {
      expect(client.isAdmin(111111111)).toBe(true);
    });

    it("should return true for second admin user", () => {
      expect(client.isAdmin(222222222)).toBe(true);
    });

    it("should return false for non-admin user", () => {
      expect(client.isAdmin(333333333)).toBe(false);
    });
  });

  describe("getHealthInfo", () => {
    it("should return health info when not initialized", () => {
      const info = client.getHealthInfo();

      expect(info.status).toBe("stopped");
      expect(info.hasToken).toBe(true);
      expect(info.uptime).toBe(0);
      expect(info.lastError).toBeNull();
      expect(info.startedAt).toBeNull();
    });

    it("should return health info when running", async () => {
      await client.initialize();
      await client.start();

      const info = client.getHealthInfo();

      expect(info.status).toBe("running");
      expect(info.hasToken).toBe(true);
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(info.lastError).toBeNull();
      expect(info.startedAt).not.toBeNull();
    });
  });

  describe("getUptime", () => {
    it("should return 0 when not running", () => {
      expect(client.getUptime()).toBe(0);
    });

    it("should return positive value when running", async () => {
      await client.initialize();
      await client.start();

      // Small delay to ensure uptime > 0
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(client.getUptime()).toBeGreaterThan(0);
    });
  });
});

describe("getTelegramBot", () => {
  it("should return the same instance on multiple calls", () => {
    const bot1 = getTelegramBot();
    const bot2 = getTelegramBot();
    expect(bot1).toBe(bot2);
  });
});

describe("createTelegramBot", () => {
  it("should create a new instance each time", () => {
    const bot1 = createTelegramBot();
    const bot2 = createTelegramBot();
    expect(bot1).not.toBe(bot2);
  });
});
