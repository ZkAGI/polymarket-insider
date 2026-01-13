/**
 * Tests for Telegram bot client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TelegramClient,
  TelegramClientError,
  createTelegramClient,
  getTelegramClient,
  resetTelegramClient,
} from "../../../src/notifications/telegram/client";
import {
  TelegramParseMode,
  TelegramMessageStatus,
} from "../../../src/notifications/telegram/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TelegramClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTelegramClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with valid token", () => {
      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: true,
      });

      expect(client).toBeInstanceOf(TelegramClient);
    });

    it("should throw error for missing token in production mode", () => {
      expect(() => {
        new TelegramClient({
          botToken: "",
          devMode: false,
        });
      }).toThrow(TelegramClientError);
      expect(() => {
        new TelegramClient({
          botToken: "",
          devMode: false,
        });
      }).toThrow("Bot token is required");
    });

    it("should allow empty token in dev mode", () => {
      const client = new TelegramClient({
        botToken: "",
        devMode: true,
      });

      expect(client).toBeInstanceOf(TelegramClient);
      expect(client.isDevMode()).toBe(true);
    });

    it("should throw error for invalid token format in production mode", () => {
      expect(() => {
        new TelegramClient({
          botToken: "invalid-token",
          devMode: false,
        });
      }).toThrow(TelegramClientError);
      expect(() => {
        new TelegramClient({
          botToken: "invalid-token",
          devMode: false,
        });
      }).toThrow("Invalid bot token format");
    });

    it("should allow any token in dev mode", () => {
      const client = new TelegramClient({
        botToken: "any-token",
        devMode: true,
      });

      expect(client).toBeInstanceOf(TelegramClient);
      expect(client.isDevMode()).toBe(true);
    });

    it("should use default configuration values", () => {
      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: true,
      });

      const config = client.getConfig();
      expect(config.defaultParseMode).toBe(TelegramParseMode.HTML);
      expect(config.rateLimit).toBe(30);
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(30000);
    });

    it("should allow custom configuration", () => {
      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: true,
        defaultParseMode: TelegramParseMode.MARKDOWN_V2,
        rateLimit: 10,
        maxRetries: 5,
        timeout: 60000,
      });

      const config = client.getConfig();
      expect(config.defaultParseMode).toBe(TelegramParseMode.MARKDOWN_V2);
      expect(config.rateLimit).toBe(10);
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(60000);
    });
  });

  describe("getConfig", () => {
    it("should mask the bot token", () => {
      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: true,
      });

      const config = client.getConfig();
      expect(config.botToken).toBe("123456789:****");
      expect(config.botToken).not.toContain("ABCdef");
    });
  });

  describe("isDevMode", () => {
    it("should return true when devMode is enabled", () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      expect(client.isDevMode()).toBe(true);
    });

    it("should return false when devMode is disabled", () => {
      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: false,
      });

      expect(client.isDevMode()).toBe(false);
    });
  });

  describe("getStats and resetStats", () => {
    it("should return initial zero stats", () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(0);
    });

    it("should track sent messages in dev mode", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      await client.sendMessage({
        chatId: 123456789,
        text: "Test message",
      });

      const stats = client.getStats();
      expect(stats.sent).toBe(1);
      expect(stats.total).toBe(1);
    });

    it("should reset stats", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      await client.sendMessage({
        chatId: 123456789,
        text: "Test message",
      });

      client.resetStats();

      const stats = client.getStats();
      expect(stats.sent).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe("sendMessage", () => {
    describe("validation", () => {
      it("should throw error for invalid chat ID", async () => {
        const client = new TelegramClient({
          botToken: "test-token",
          devMode: true,
        });

        await expect(
          client.sendMessage({
            chatId: 0,
            text: "Test message",
          })
        ).rejects.toThrow("Invalid chat ID");
      });

      it("should throw error for empty message text", async () => {
        const client = new TelegramClient({
          botToken: "test-token",
          devMode: true,
        });

        await expect(
          client.sendMessage({
            chatId: 123456789,
            text: "",
          })
        ).rejects.toThrow("Message text is required");

        await expect(
          client.sendMessage({
            chatId: 123456789,
            text: "   ",
          })
        ).rejects.toThrow("Message text is required");
      });
    });

    describe("dev mode", () => {
      it("should return successful result in dev mode", async () => {
        const client = new TelegramClient({
          botToken: "test-token",
          devMode: true,
        });

        const result = await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(result.status).toBe(TelegramMessageStatus.SENT);
        expect(result.chatId).toBe(123456789);
        expect(result.messageId).toBeGreaterThan(0);
        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it("should log message details in dev mode", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const client = new TelegramClient({
          botToken: "test-token",
          devMode: true,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          "[TELEGRAM DEV MODE] Would send message:",
          expect.objectContaining({
            chatId: "123456789",
            text: "Hello, World!",
            parseMode: TelegramParseMode.HTML,
          })
        );
      });

      it("should accept username as chat ID", async () => {
        const client = new TelegramClient({
          botToken: "test-token",
          devMode: true,
        });

        const result = await client.sendMessage({
          chatId: "@testchannel",
          text: "Hello, Channel!",
        });

        expect(result.status).toBe(TelegramMessageStatus.SENT);
        expect(result.chatId).toBe("@testchannel");
      });
    });

    describe("production mode", () => {
      it("should make API call with correct payload", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: Math.floor(Date.now() / 1000),
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/sendMessage"),
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining('"chat_id":123456789'),
          })
        );
      });

      it("should include parse mode in API call", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: Math.floor(Date.now() / 1000),
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
          defaultParseMode: TelegramParseMode.MARKDOWN_V2,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        const callArgs = mockFetch.mock.calls[0];
        const callBody = JSON.parse((callArgs?.[1] as RequestInit)?.body as string);
        expect(callBody.parse_mode).toBe("MarkdownV2");
      });

      it("should handle API success response", async () => {
        const timestamp = Math.floor(Date.now() / 1000);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: timestamp,
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
        });

        const result = await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(result.status).toBe(TelegramMessageStatus.SENT);
        expect(result.messageId).toBe(12345);
      });

      it("should handle API error response", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: false,
              error_code: 400,
              description: "Bad Request: chat not found",
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
          maxRetries: 1,
        });

        const result = await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(result.status).toBe(TelegramMessageStatus.FAILED);
        expect(result.error).toContain("chat not found");
      });

      it("should retry on server error", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: false,
                error_code: 500,
                description: "Internal Server Error",
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                result: {
                  message_id: 12345,
                  date: Math.floor(Date.now() / 1000),
                  chat: { id: 123456789, type: "private" },
                },
              }),
          });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
          maxRetries: 2,
          retryDelay: 10, // Fast retry for tests
        });

        const result = await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.status).toBe(TelegramMessageStatus.SENT);
      });

      it("should not retry on client error (4xx)", async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: false,
              error_code: 400,
              description: "Bad Request",
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
          maxRetries: 3,
        });

        const result = await client.sendMessage({
          chatId: 123456789,
          text: "Hello, World!",
        });

        // Should only try once for 4xx errors
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result.status).toBe(TelegramMessageStatus.FAILED);
      });
    });

    describe("message options", () => {
      it("should include inline keyboard in payload", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: Math.floor(Date.now() / 1000),
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Choose an option:",
          options: {
            inlineKeyboard: {
              buttons: [
                [
                  { text: "Option 1", callbackData: "opt_1" },
                  { text: "Option 2", callbackData: "opt_2" },
                ],
                [{ text: "Visit Website", url: "https://example.com" }],
              ],
            },
          },
        });

        const callArgs = mockFetch.mock.calls[0];
        const callBody = JSON.parse((callArgs?.[1] as RequestInit)?.body as string);
        expect(callBody.reply_markup).toBeDefined();
        expect(callBody.reply_markup.inline_keyboard).toHaveLength(2);
        expect(callBody.reply_markup.inline_keyboard[0]).toHaveLength(2);
      });

      it("should include disable notification option", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: Math.floor(Date.now() / 1000),
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Silent message",
          options: {
            disableNotification: true,
          },
        });

        const callArgs = mockFetch.mock.calls[0];
        const callBody = JSON.parse((callArgs?.[1] as RequestInit)?.body as string);
        expect(callBody.disable_notification).toBe(true);
      });

      it("should include reply to message ID", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              result: {
                message_id: 12345,
                date: Math.floor(Date.now() / 1000),
                chat: { id: 123456789, type: "private" },
              },
            }),
        });

        const client = new TelegramClient({
          botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
          devMode: false,
        });

        await client.sendMessage({
          chatId: 123456789,
          text: "Reply message",
          options: {
            replyToMessageId: 9999,
          },
        });

        const callArgs = mockFetch.mock.calls[0];
        const callBody = JSON.parse((callArgs?.[1] as RequestInit)?.body as string);
        expect(callBody.reply_to_message_id).toBe(9999);
      });
    });
  });

  describe("sendBatch", () => {
    it("should send multiple messages in dev mode", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const messages = [
        { chatId: 1, text: "Message 1" },
        { chatId: 2, text: "Message 2" },
        { chatId: 3, text: "Message 3" },
      ];

      const result = await client.sendBatch(messages);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it("should respect batch size", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const messages = [
        { chatId: 1, text: "Message 1" },
        { chatId: 2, text: "Message 2" },
        { chatId: 3, text: "Message 3" },
        { chatId: 4, text: "Message 4" },
        { chatId: 5, text: "Message 5" },
      ];

      const result = await client.sendBatch(messages, { batchSize: 2, batchDelay: 10 });

      expect(result.total).toBe(5);
      expect(result.sent).toBe(5);
    });

    it("should track errors", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const messages = [
        { chatId: 1, text: "Message 1" },
        { chatId: 0, text: "Invalid" }, // Invalid chat ID
        { chatId: 3, text: "Message 3" },
      ];

      const result = await client.sendBatch(messages, { stopOnError: false });

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it("should stop on error when stopOnError is true", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const messages = [
        { chatId: 0, text: "Invalid" }, // Will fail
        { chatId: 2, text: "Message 2" }, // Won't be reached
      ];

      const result = await client.sendBatch(messages, { stopOnError: true });

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
    });
  });

  describe("event handling", () => {
    it("should emit sending event", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const events: string[] = [];
      client.on("message:sending", (event) => {
        events.push(event.type);
      });

      await client.sendMessage({
        chatId: 123456789,
        text: "Hello!",
      });

      expect(events).toContain("message:sending");
    });

    it("should emit sent event on success", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const events: string[] = [];
      client.on("message:sent", (event) => {
        events.push(event.type);
      });

      await client.sendMessage({
        chatId: 123456789,
        text: "Hello!",
      });

      expect(events).toContain("message:sent");
    });

    it("should emit failed event on error", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            error_code: 400,
            description: "Bad Request",
          }),
      });

      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: false,
        maxRetries: 1,
      });

      const events: string[] = [];
      client.on("message:failed", (event) => {
        events.push(event.type);
      });

      await client.sendMessage({
        chatId: 123456789,
        text: "Hello!",
      });

      expect(events).toContain("message:failed");
    });

    it("should return unsubscribe function", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      let callCount = 0;
      const unsubscribe = client.on("message:sent", () => {
        callCount++;
      });

      await client.sendMessage({ chatId: 1, text: "Test 1" });
      expect(callCount).toBe(1);

      unsubscribe();

      await client.sendMessage({ chatId: 2, text: "Test 2" });
      expect(callCount).toBe(1); // Should not increase
    });
  });

  describe("command handling", () => {
    it("should register command handler", () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const handler = vi.fn();
      const unsubscribe = client.onCommand("start", handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should return unsubscribe function for commands", () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const handler = vi.fn();
      const unsubscribe = client.onCommand("start", handler);

      unsubscribe();
      // Handler should be removed (can't test directly without mocking internal state)
    });
  });

  describe("getMe", () => {
    it("should return mock bot info in dev mode", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const me = await client.getMe();

      expect(me.is_bot).toBe(true);
      expect(me.id).toBe(123456789);
      expect(me.first_name).toBe("Test Bot");
    });

    it("should call API in production mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            result: {
              id: 987654321,
              is_bot: true,
              first_name: "Real Bot",
              username: "real_bot",
            },
          }),
      });

      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: false,
      });

      const me = await client.getMe();

      expect(me.is_bot).toBe(true);
      expect(me.id).toBe(987654321);
      expect(me.username).toBe("real_bot");
    });
  });

  describe("setCommands", () => {
    it("should return true in dev mode", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const result = await client.setCommands([
        { command: "start", description: "Start the bot" },
        { command: "help", description: "Get help" },
      ]);

      expect(result).toBe(true);
    });

    it("should call API in production mode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            result: true,
          }),
      });

      const client = new TelegramClient({
        botToken: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890",
        devMode: false,
      });

      const result = await client.setCommands([
        { command: "/start", description: "Start the bot" },
      ]);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/setMyCommands"),
        expect.any(Object)
      );
    });
  });

  describe("polling", () => {
    it("should track polling state", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      expect(client.isPolling()).toBe(false);

      await client.startPolling();
      expect(client.isPolling()).toBe(true);

      await client.stopPolling();
      expect(client.isPolling()).toBe(false);
    });

    it("should emit bot:started event", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const events: string[] = [];
      client.on("bot:started", (event) => {
        events.push(event.type);
      });

      await client.startPolling();

      expect(events).toContain("bot:started");

      await client.stopPolling();
    });

    it("should emit bot:stopped event", async () => {
      const client = new TelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      const events: string[] = [];
      client.on("bot:stopped", (event) => {
        events.push(event.type);
      });

      await client.startPolling();
      await client.stopPolling();

      expect(events).toContain("bot:stopped");
    });
  });
});

describe("TelegramClientError", () => {
  it("should create error with message and code", () => {
    const error = new TelegramClientError("Test error", "TEST_CODE");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("TelegramClientError");
    expect(error.retryable).toBe(false);
  });

  it("should set retryable flag", () => {
    const error = new TelegramClientError("Test error", "TEST_CODE", {
      retryable: true,
    });

    expect(error.retryable).toBe(true);
  });

  it("should set status code", () => {
    const error = new TelegramClientError("Test error", "TEST_CODE", {
      statusCode: 429,
    });

    expect(error.statusCode).toBe(429);
  });
});

describe("factory functions", () => {
  beforeEach(() => {
    resetTelegramClient();
  });

  describe("createTelegramClient", () => {
    it("should create new client instance", () => {
      const client = createTelegramClient({
        botToken: "test-token",
        devMode: true,
      });

      expect(client).toBeInstanceOf(TelegramClient);
    });
  });

  describe("getTelegramClient", () => {
    it("should return singleton instance", () => {
      const client1 = getTelegramClient();
      const client2 = getTelegramClient();

      expect(client1).toBe(client2);
    });

    it("should create client with environment variables", () => {
      const client = getTelegramClient();

      expect(client).toBeInstanceOf(TelegramClient);
      // In test environment, should be in dev mode (no token)
      expect(client.isDevMode()).toBe(true);
    });
  });

  describe("resetTelegramClient", () => {
    it("should clear singleton instance", () => {
      const client1 = getTelegramClient();
      resetTelegramClient();
      const client2 = getTelegramClient();

      expect(client1).not.toBe(client2);
    });
  });
});
