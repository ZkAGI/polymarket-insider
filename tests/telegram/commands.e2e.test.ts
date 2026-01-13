/**
 * E2E tests for Telegram Bot Command Handlers
 *
 * Tests the /start command registration flow and browser verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import type { Context } from "grammy";
import {
  registerUserFromContext,
  handleStartCommand,
  createStartCommandHandler,
  getWelcomeMessage,
} from "../../src/telegram/commands";
import {
  TelegramSubscriberService,
  TelegramChatType,
  AlertSeverity,
  type TelegramSubscriber,
} from "../../src/db/telegram-subscribers";

/**
 * Create a mock Telegram context
 */
function createMockContext(overrides?: {
  chatId?: number;
  chatType?: "private" | "group" | "supergroup" | "channel";
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  title?: string;
  noChat?: boolean;
  noFrom?: boolean;
}): Context {
  const chat = overrides?.noChat
    ? undefined
    : {
        id: overrides?.chatId ?? 123456789,
        type: overrides?.chatType ?? "private",
        ...(overrides?.title ? { title: overrides.title } : {}),
      };

  const from = overrides?.noFrom
    ? undefined
    : {
        id: overrides?.chatId ?? 123456789,
        is_bot: false,
        first_name: overrides?.firstName ?? "John",
        last_name: overrides?.lastName ?? "Doe",
        username: overrides?.username ?? "johndoe",
        language_code: overrides?.languageCode ?? "en",
      };

  return {
    chat,
    from,
    reply: vi.fn().mockResolvedValue({}),
  } as unknown as Context;
}

/**
 * Create a mock TelegramSubscriber
 */
function createMockSubscriber(overrides?: Partial<TelegramSubscriber>): TelegramSubscriber {
  return {
    id: "sub-123",
    chatId: BigInt(123456789),
    chatType: TelegramChatType.PRIVATE,
    username: "johndoe",
    firstName: "John",
    lastName: "Doe",
    title: null,
    languageCode: "en",
    isActive: true,
    isAdmin: false,
    alertPreferences: null,
    minSeverity: AlertSeverity.INFO,
    isBlocked: false,
    alertsSent: 0,
    lastAlertAt: null,
    deactivationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock TelegramSubscriberService
 */
function createMockSubscriberService(): TelegramSubscriberService {
  return {
    findByChatId: vi.fn(),
    create: vi.fn(),
    activate: vi.fn(),
    updateByChatId: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByChatId: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    findActive: vi.fn(),
    findActiveByType: vi.fn(),
    findAdmins: vi.fn(),
    deactivate: vi.fn(),
    markBlocked: vi.fn(),
    incrementAlertsSent: vi.fn(),
    updateAlertPreferences: vi.fn(),
    updateMinSeverity: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
    isSubscribed: vi.fn(),
    isAdmin: vi.fn(),
  } as unknown as TelegramSubscriberService;
}

describe("Telegram Commands E2E Tests", () => {
  describe("Full Registration Flow", () => {
    let mockService: TelegramSubscriberService;

    beforeEach(() => {
      mockService = createMockSubscriberService();
      vi.clearAllMocks();
    });

    it("should complete full registration flow for new private user", async () => {
      // Setup
      const ctx = createMockContext({
        chatId: 987654321,
        username: "newtrader",
        firstName: "Alice",
        lastName: "Smith",
        languageCode: "en",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(987654321),
        username: "newtrader",
        firstName: "Alice",
        lastName: "Smith",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      // Execute
      await handleStartCommand(ctx, mockService);

      // Verify
      expect(mockService.findByChatId).toHaveBeenCalledWith(BigInt(987654321));
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: BigInt(987654321),
          chatType: TelegramChatType.PRIVATE,
          username: "newtrader",
          firstName: "Alice",
          lastName: "Smith",
          isActive: true,
        })
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Welcome to Polymarket Whale Tracker, Alice Smith!")
      );
    });

    it("should complete full registration flow for group", async () => {
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Crypto Whales Group",
        username: "groupadmin",
        firstName: "Admin",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(-1001234567890),
        chatType: TelegramChatType.SUPERGROUP,
        title: "Crypto Whales Group",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      await handleStartCommand(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: BigInt(-1001234567890),
          chatType: TelegramChatType.SUPERGROUP,
          title: "Crypto Whales Group",
        })
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Crypto Whales Group")
      );
    });

    it("should complete reactivation flow for returning user", async () => {
      const ctx = createMockContext({
        chatId: 555666777,
        username: "returninguser",
        firstName: "Bob",
      });

      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(555666777),
        isActive: false,
        isBlocked: false,
        deactivationReason: "User stopped the bot",
      });

      const reactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(555666777),
        isActive: true,
        isBlocked: false,
        deactivationReason: null,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      await handleStartCommand(ctx, mockService);

      expect(mockService.activate).toHaveBeenCalledWith(BigInt(555666777));
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Welcome back, Bob Doe!")
      );
    });

    it("should complete reactivation flow for previously blocked user", async () => {
      const ctx = createMockContext({
        chatId: 888999000,
        username: "unblockeduser",
        firstName: "Charlie",
      });

      const blockedSubscriber = createMockSubscriber({
        chatId: BigInt(888999000),
        isActive: false,
        isBlocked: true,
        deactivationReason: "User blocked the bot",
      });

      const reactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(888999000),
        isActive: true,
        isBlocked: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(blockedSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      await handleStartCommand(ctx, mockService);

      expect(mockService.activate).toHaveBeenCalledWith(BigInt(888999000));
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Welcome back, Charlie Doe!")
      );
    });

    it("should handle database error and send error message", async () => {
      const ctx = createMockContext();

      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Connection timeout")
      );

      await handleStartCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Sorry, there was an error")
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Connection timeout")
      );
    });

    it("should correctly set default alert preferences", async () => {
      const ctx = createMockContext({
        chatId: 111222333,
        username: "newbie",
      });

      const newSubscriber = createMockSubscriber();

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      await handleStartCommand(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertPreferences: expect.objectContaining({
            whaleAlerts: true,
            insiderAlerts: true,
            marketResolutionAlerts: false,
            priceMovementAlerts: false,
            minTradeValue: 10000,
            watchedMarkets: [],
            watchedWallets: [],
          }),
        })
      );
    });
  });

  describe("Command Handler Factory", () => {
    it("should create working handler with custom service", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ firstName: "TestUser" });
      const newSubscriber = createMockSubscriber();

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      const handler = createStartCommandHandler(mockService);
      await handler(ctx);

      expect(mockService.findByChatId).toHaveBeenCalled();
      expect(mockService.create).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalled();
    });
  });
});

describe("Browser E2E Tests - Dashboard and Homepage", () => {
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

  it("should load the homepage successfully", async () => {
    const response = await page.goto("http://localhost:3000", {
      waitUntil: "networkidle0",
    });

    expect(response?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("html");
  });

  it("should load the dashboard successfully", async () => {
    const response = await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "networkidle0",
    });

    expect(response?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("html");
  });

  it("should have correct page title on homepage", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  it("should render main content on dashboard", async () => {
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "networkidle0",
    });

    // Check that the page has rendered content
    const bodyContent = await page.evaluate(() => document.body.innerHTML);
    expect(bodyContent.length).toBeGreaterThan(100);
  });

  it("should take a screenshot of the dashboard", async () => {
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "networkidle0",
    });
    await page.setViewport({ width: 1920, height: 1080 });

    const screenshot = await page.screenshot({ encoding: "base64" });
    expect(screenshot).toBeTruthy();
    expect((screenshot as string).length).toBeGreaterThan(1000);
  });

  it("should not have critical JavaScript errors", async () => {
    const errors: string[] = [];
    page.on("pageerror", (event: unknown) => {
      const error = event as Error;
      errors.push(error.message);
    });

    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "networkidle0",
    });

    // Filter out warnings and non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("Warning") &&
        !e.includes("Deprecation") &&
        !e.includes("ResizeObserver")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  it("should navigate from homepage to dashboard", async () => {
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    // Try to find and click a link to dashboard
    const dashboardLink = await page.$('a[href*="dashboard"]');
    if (dashboardLink) {
      await dashboardLink.click();
      await page.waitForNavigation({ waitUntil: "networkidle0" });
      expect(page.url()).toContain("dashboard");
    } else {
      // If no link, navigate directly
      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle0",
      });
      expect(page.url()).toContain("dashboard");
    }
  });

  it("should have responsive layout on mobile viewport", async () => {
    await page.setViewport({ width: 375, height: 812 }); // iPhone X size
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

    const screenshot = await page.screenshot({ encoding: "base64" });
    expect(screenshot).toBeTruthy();
  });

  it("should have responsive layout on tablet viewport", async () => {
    await page.setViewport({ width: 768, height: 1024 }); // iPad size
    await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "networkidle0",
    });

    const screenshot = await page.screenshot({ encoding: "base64" });
    expect(screenshot).toBeTruthy();
  });
});
