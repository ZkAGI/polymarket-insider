/**
 * E2E tests for Telegram Bot Client
 *
 * These tests verify the bot initialization and lifecycle
 * without actually connecting to Telegram API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";

// Mock grammy for E2E tests
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

describe("Telegram Bot E2E Tests", () => {
  describe("Bot Lifecycle", () => {
    it("should complete full lifecycle: initialize -> start -> stop", async () => {
      const { createTelegramBot } = await import("../../src/telegram/bot");
      const client = createTelegramBot();

      // Initial state
      expect(client.getStatus()).toBe("stopped");
      expect(client.hasToken()).toBe(true);

      // Initialize
      const initResult = await client.initialize();
      expect(initResult.success).toBe(true);
      expect(initResult.botInfo?.username).toBe("test_bot");

      // Start
      await client.start();
      expect(client.getStatus()).toBe("running");
      expect(client.getStartedAt()).not.toBeNull();
      expect(client.getUptime()).toBeGreaterThanOrEqual(0);

      // Stop
      await client.stop();
      expect(client.getStatus()).toBe("stopped");
      expect(client.getStartedAt()).toBeNull();
    });

    it("should handle message sending after initialization", async () => {
      const { createTelegramBot } = await import("../../src/telegram/bot");
      const client = createTelegramBot();

      await client.initialize();

      // Send various message types
      const result1 = await client.sendMessage(123, "Hello World");
      expect(result1.success).toBe(true);

      const result2 = await client.sendMessage(123, "<b>Bold</b>", {
        parseMode: "HTML",
      });
      expect(result2.success).toBe(true);

      const result3 = await client.sendMessage(123, "Silent", {
        disableNotification: true,
      });
      expect(result3.success).toBe(true);
    });

    it("should correctly identify admin users", async () => {
      const { createTelegramBot } = await import("../../src/telegram/bot");
      const client = createTelegramBot();

      expect(client.isAdmin(111111111)).toBe(true);
      expect(client.isAdmin(222222222)).toBe(true);
      expect(client.isAdmin(999999999)).toBe(false);
    });

    it("should provide health information", async () => {
      const { createTelegramBot } = await import("../../src/telegram/bot");
      const client = createTelegramBot();

      // Before initialization
      let health = client.getHealthInfo();
      expect(health.status).toBe("stopped");
      expect(health.hasToken).toBe(true);
      expect(health.uptime).toBe(0);

      // After start
      await client.initialize();
      await client.start();
      health = client.getHealthInfo();
      expect(health.status).toBe("running");
      expect(health.startedAt).not.toBeNull();
    });
  });
});

describe("Browser E2E Tests", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  it("should load the homepage", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    const title = await page.title();
    expect(title).toBeTruthy();

    const content = await page.content();
    expect(content).toContain("html");
  });

  it("should load the dashboard page", async () => {
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle0" });

    const content = await page.content();
    expect(content).toContain("html");
  });

  it("should take a screenshot of the homepage", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
    await page.setViewport({ width: 1920, height: 1080 });

    const screenshot = await page.screenshot({ encoding: "base64" });
    expect(screenshot).toBeTruthy();
  });

  it("should not have any console errors on page load", async () => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    // Allow some acceptable warnings but no critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes("Warning") && !e.includes("Deprecation")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
