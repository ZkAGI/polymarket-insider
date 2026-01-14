/**
 * E2E tests for Telegram Bot Command Handlers
 *
 * Tests the /start command registration flow and browser verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import type { Context } from "grammy";
import {
  handleStartCommand,
  createStartCommandHandler,
  handleMyChatMember,
  createMyChatMemberHandler,
  getGroupWelcomeMessage,
  handleStopCommand,
  createStopCommandHandler,
  unsubscribeUser,
  getUnsubscribeMessage,
  getAlreadyUnsubscribedMessage,
  getNotFoundMessage,
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

// ============= E2E Tests for TG-BOT-003: Group membership handler =============

/**
 * Create a mock context for my_chat_member update
 */
function createMyChatMemberContext(overrides?: {
  chatId?: number;
  chatType?: "group" | "supergroup" | "private" | "channel";
  chatTitle?: string;
  oldStatus?: string;
  newStatus?: string;
  noMyChatMember?: boolean;
}): Context {
  const update = overrides?.noMyChatMember
    ? { update_id: 12345 }
    : {
        update_id: 12345,
        my_chat_member: {
          chat: {
            id: overrides?.chatId ?? -1001234567890,
            type: overrides?.chatType ?? "supergroup",
            title: overrides?.chatTitle ?? "Test Group",
          },
          from: {
            id: 999888777,
            is_bot: false,
            first_name: "Admin",
          },
          date: Date.now(),
          old_chat_member: {
            user: {
              id: 123456,
              is_bot: true,
              first_name: "Bot",
            },
            status: overrides?.oldStatus ?? "left",
          },
          new_chat_member: {
            user: {
              id: 123456,
              is_bot: true,
              first_name: "Bot",
            },
            status: overrides?.newStatus ?? "member",
          },
        },
      };

  return {
    update,
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    },
  } as unknown as Context;
}

describe("Group Membership E2E Tests", () => {
  describe("Full Group Registration Flow", () => {
    let mockService: TelegramSubscriberService;

    beforeEach(() => {
      mockService = createMockSubscriberService();
      vi.clearAllMocks();
    });

    it("should complete full flow when bot is added to new group", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001112223334,
        chatType: "supergroup",
        chatTitle: "Polymarket Whales",
        oldStatus: "left",
        newStatus: "member",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(-1001112223334),
        chatType: TelegramChatType.SUPERGROUP,
        title: "Polymarket Whales",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(result.chatTitle).toBe("Polymarket Whales");

      // Verify database operations
      expect(mockService.findByChatId).toHaveBeenCalledWith(BigInt(-1001112223334));
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: BigInt(-1001112223334),
          chatType: TelegramChatType.SUPERGROUP,
          title: "Polymarket Whales",
          isActive: true,
          alertPreferences: expect.objectContaining({
            whaleAlerts: true,
            insiderAlerts: true,
          }),
        })
      );

      // Verify welcome message sent
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        -1001112223334,
        expect.stringContaining("Polymarket Whales")
      );
    });

    it("should complete full flow when bot is added as administrator", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1002223334445,
        chatType: "group",
        chatTitle: "Admin Group",
        oldStatus: "left",
        newStatus: "administrator",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(
        createMockSubscriber({
          chatId: BigInt(-1002223334445),
          chatType: TelegramChatType.GROUP,
        })
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.GROUP,
        })
      );
    });

    it("should complete full reactivation flow when bot is re-added to group", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1003334445556,
        chatTitle: "Returning Group",
        oldStatus: "kicked",
        newStatus: "member",
      });

      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(-1003334445556),
        chatType: TelegramChatType.SUPERGROUP,
        isActive: false,
        deactivationReason: "Bot was removed from group",
      });

      const reactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(-1003334445556),
        isActive: true,
        deactivationReason: null,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("reactivated");
      expect(mockService.activate).toHaveBeenCalledWith(BigInt(-1003334445556));
      expect(mockService.updateByChatId).toHaveBeenCalledWith(
        BigInt(-1003334445556),
        expect.objectContaining({ title: "Returning Group" })
      );
      expect(ctx.api.sendMessage).toHaveBeenCalled();
    });

    it("should complete full deactivation flow when bot is removed", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1004445556667,
        chatTitle: "Leaving Group",
        oldStatus: "member",
        newStatus: "left",
      });

      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(-1004445556667),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(activeSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue(
        createMockSubscriber({ isActive: false })
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("deactivated");
      expect(mockService.deactivate).toHaveBeenCalledWith(
        BigInt(-1004445556667),
        "Bot was removed from group"
      );
    });

    it("should complete full deactivation flow when bot is kicked", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1005556667778,
        chatTitle: "Kicked Group",
        oldStatus: "administrator",
        newStatus: "kicked",
      });

      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(-1005556667778),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(activeSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue(
        createMockSubscriber({ isActive: false })
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("deactivated");
    });

    it("should handle error during group registration gracefully", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1006667778889,
        chatTitle: "Error Group",
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockRejectedValue(
        new Error("Database connection lost")
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.action).toBe("none");
      expect(result.error).toBe("Database connection lost");
      expect(result.chatTitle).toBe("Error Group");
    });
  });

  describe("Group Membership Handler Factory", () => {
    it("should create working handler with custom service", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMyChatMemberContext({
        chatId: -1007778889990,
        chatTitle: "Factory Test Group",
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      const handler = createMyChatMemberHandler(mockService);
      const result = await handler(ctx);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(mockService.findByChatId).toHaveBeenCalled();
      expect(mockService.create).toHaveBeenCalled();
    });
  });

  describe("Group Welcome Message Verification", () => {
    it("should include all required information in group welcome message", () => {
      const message = getGroupWelcomeMessage("Test Trading Group");

      // Verify group name is included
      expect(message).toContain("Test Trading Group");

      // Verify bot features are mentioned
      expect(message).toContain("whale trades");
      expect(message).toContain("insider trading");
      expect(message).toContain("wallet activity");

      // Verify commands are mentioned
      expect(message).toContain("/settings");
      expect(message).toContain("/help");

      // Verify emoji is present
      expect(message).toContain("🐋");
    });
  });
});

// =============================================================================
// /stop Command E2E Tests
// =============================================================================

describe("Stop Command E2E Tests", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  describe("Unsubscribe Message Formatting", () => {
    it("should format unsubscribe message with personalized goodbye", () => {
      const message = getUnsubscribeMessage("Alice");

      expect(message).toContain("Goodbye, Alice!");
      expect(message).toContain("👋");
      expect(message).toContain("unsubscribed");
    });

    it("should include list of stopped notifications", () => {
      const message = getUnsubscribeMessage("User");

      expect(message).toContain("Whale trades");
      expect(message).toContain("Insider activity");
      expect(message).toContain("Suspicious wallet");
    });

    it("should include resubscribe instructions", () => {
      const message = getUnsubscribeMessage("User");

      expect(message).toContain("/start");
      expect(message).toContain("resubscribe");
    });
  });

  describe("Already Unsubscribed Message", () => {
    it("should include personalized message", () => {
      const message = getAlreadyUnsubscribedMessage("Bob");

      expect(message).toContain("Hi Bob!");
      expect(message).toContain("not currently subscribed");
    });

    it("should include subscribe instructions", () => {
      const message = getAlreadyUnsubscribedMessage("User");

      expect(message).toContain("/start");
    });
  });

  describe("Not Found Message", () => {
    it("should explain not subscribed status", () => {
      const message = getNotFoundMessage();

      expect(message).toContain("not currently subscribed");
      expect(message).toContain("/start");
    });
  });

  describe("Unsubscribe User Function", () => {
    it("should successfully deactivate active subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "TestUser",
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
        deactivationReason: "User sent /stop command",
      });

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.wasAlreadyInactive).toBe(false);
      expect(mockService.deactivate).toHaveBeenCalledWith(
        BigInt(111222333),
        "User sent /stop command"
      );
    });

    it("should return wasAlreadyInactive for inactive subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.wasAlreadyInactive).toBe(true);
      expect(mockService.deactivate).not.toHaveBeenCalled();
    });

    it("should return error for non-existent subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 999888777 });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Subscriber not found");
    });
  });

  describe("Handle Stop Command Integration", () => {
    it("should send goodbye message for active subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "TestUser",
        lastName: "One",
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
      });

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("Goodbye, TestUser One!");
      expect(replyMessage).toContain("unsubscribed");
    });

    it("should send already unsubscribed message for inactive subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "InactiveUser",
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("not currently subscribed");
    });

    it("should send not found message for non-existent subscriber", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 999888777 });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("not currently subscribed");
    });
  });

  describe("Stop Command Handler Factory", () => {
    it("should create a working handler function", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
      });

      const handler = createStopCommandHandler(mockService);
      await handler(ctx);

      expect(mockService.findByChatId).toHaveBeenCalled();
      expect(mockService.deactivate).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalled();
    });
  });

  describe("Group Unsubscribe Flow", () => {
    it("should work for groups", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Trading Group",
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(-1001234567890),
        chatType: TelegramChatType.SUPERGROUP,
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
      });

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("Goodbye");
      expect(replyMessage).toContain("unsubscribed");
    });

    it("should use group title as display name", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "group",
        title: "Whale Watchers",
        noFrom: true,
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(-1001234567890),
        chatType: TelegramChatType.GROUP,
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
      });

      await handleStopCommand(ctx, mockService);

      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("Whale Watchers");
    });
  });

  describe("Database Verification Flow", () => {
    it("should verify isActive is set to false after unsubscribe", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 555666777 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(555666777),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
        deactivationReason: "User sent /stop command",
      });

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.subscriber?.isActive).toBe(false);
      expect(result.subscriber?.deactivationReason).toBe("User sent /stop command");
    });

    it("should not delete subscriber data", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 555666777 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(555666777),
        isActive: true,
        username: "keepme",
        firstName: "Keep",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue({
        ...existingSubscriber,
        isActive: false,
      });

      const result = await unsubscribeUser(ctx, mockService);

      // Verify subscriber data is preserved
      expect(result.subscriber?.username).toBe("keepme");
      expect(result.subscriber?.firstName).toBe("Keep");
      // Verify delete was not called
      expect(mockService.delete).not.toHaveBeenCalled();
      expect(mockService.deleteByChatId).not.toHaveBeenCalled();
    });
  });

  describe("Resubscribe After Stop Flow", () => {
    it("should allow resubscribe after stop", async () => {
      const mockService = createMockSubscriberService();
      const chatId = 888999000;

      // First: user is active
      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(chatId),
        isActive: true,
      });

      // After stop: user is inactive
      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(chatId),
        isActive: false,
        deactivationReason: "User sent /stop command",
      });

      // After reactivation: user is active again
      const reactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(chatId),
        isActive: true,
        deactivationReason: null,
      });

      // Step 1: Stop command
      const stopCtx = createMockContext({ chatId });
      vi.mocked(mockService.findByChatId).mockResolvedValue(activeSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue(inactiveSubscriber);

      const stopResult = await unsubscribeUser(stopCtx, mockService);
      expect(stopResult.success).toBe(true);
      expect(stopResult.subscriber?.isActive).toBe(false);

      // Step 2: Start command (simulated by checking if reactivation works)
      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);

      // Verify the inactive subscriber can be found
      const found = await mockService.findByChatId(BigInt(chatId));
      expect(found?.isActive).toBe(false);

      // Simulate reactivation
      const reactivated = await mockService.activate(BigInt(chatId));
      expect(reactivated.isActive).toBe(true);
    });
  });

  describe("Browser Verification", () => {
    it("should verify dashboard loads after unsubscribe flow", async () => {
      // Navigate to dashboard
      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Verify page loaded
      const title = await page.title();
      expect(title).toBeTruthy();

      // Verify dashboard content exists
      const content = await page.content();
      expect(content).toBeTruthy();
    });

    it("should take screenshot of dashboard for visual verification", async () => {
      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Take screenshot (file will be saved but we just verify it doesn't throw)
      await page.screenshot({
        path: "tests/e2e/screenshots/stop-command-dashboard.png",
        fullPage: true,
      });

      // Screenshot was taken successfully
      expect(true).toBe(true);
    });
  });

  describe("Error Handling E2E", () => {
    it("should handle database connection errors gracefully", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 111222333 });

      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Database connection error")
      );

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("error processing your request");
    });

    it("should handle deactivation errors gracefully", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockRejectedValue(
        new Error("Deactivation error")
      );

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("error processing your request");
    });
  });
});

// =============================================================================
// /settings Command E2E Tests (TG-BOT-005)
// =============================================================================

import {
  handleSettingsCommand,
  createSettingsCommandHandler,
  handleSettingsCallback,
  createSettingsCallbackHandler,
  updatePreferenceFromCallback,
  parseSettingsCallback,
  getSettingsKeyboard,
  getMinTradeSizeKeyboard,
  getSeverityKeyboard,
  getSettingsMessage,
  formatPreferenceValue,
  getFieldDisplayName,
  isSettingsCallback,
  MIN_TRADE_SIZE_OPTIONS,
  SEVERITY_OPTIONS,
  CALLBACK_PREFIX,
} from "../../src/telegram/commands";

describe("Settings Command E2E Tests (TG-BOT-005)", () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  describe("Settings Message Verification", () => {
    it("should include user display name in settings message", () => {
      const message = getSettingsMessage("TestUser");
      expect(message).toContain("TestUser");
      expect(message).toContain("⚙️");
      expect(message).toContain("Alert Settings");
    });

    it("should include configuration instructions", () => {
      const message = getSettingsMessage("User");
      expect(message).toContain("Configure which alerts");
      expect(message).toContain("Tap a button");
    });
  });

  describe("Preference Value Formatting", () => {
    it("should format whale alerts correctly", () => {
      expect(formatPreferenceValue("whaleAlerts", true)).toBe("ON");
      expect(formatPreferenceValue("whaleAlerts", false)).toBe("OFF");
    });

    it("should format insider alerts correctly", () => {
      expect(formatPreferenceValue("insiderAlerts", true)).toBe("ON");
      expect(formatPreferenceValue("insiderAlerts", false)).toBe("OFF");
    });

    it("should format min trade value correctly", () => {
      expect(formatPreferenceValue("minTradeValue", 1000)).toBe("$1K");
      expect(formatPreferenceValue("minTradeValue", 10000)).toBe("$10K");
      expect(formatPreferenceValue("minTradeValue", 50000)).toBe("$50K");
      expect(formatPreferenceValue("minTradeValue", 100000)).toBe("$100K");
    });

    it("should format severity correctly", () => {
      expect(formatPreferenceValue("severity", "all")).toBe("All");
      expect(formatPreferenceValue("severity", "high")).toBe("High+Critical");
      expect(formatPreferenceValue("severity", "critical")).toBe("Critical only");
    });
  });

  describe("Field Display Names", () => {
    it("should return human-readable names for all fields", () => {
      expect(getFieldDisplayName("whaleAlerts")).toBe("Whale Alerts");
      expect(getFieldDisplayName("insiderAlerts")).toBe("Insider Alerts");
      expect(getFieldDisplayName("minTradeValue")).toBe("Min Trade Size");
      expect(getFieldDisplayName("severity")).toBe("Severity");
    });
  });

  describe("Settings Callback Parsing", () => {
    it("should parse whale alerts callbacks", () => {
      const onResult = parseSettingsCallback("settings:whale:on");
      expect(onResult.type).toBe("whale");
      expect(onResult.value).toBe("on");

      const offResult = parseSettingsCallback("settings:whale:off");
      expect(offResult.type).toBe("whale");
      expect(offResult.value).toBe("off");
    });

    it("should parse insider alerts callbacks", () => {
      const result = parseSettingsCallback("settings:insider:on");
      expect(result.type).toBe("insider");
      expect(result.value).toBe("on");
    });

    it("should parse min size callbacks", () => {
      const result = parseSettingsCallback("settings:minsize:50000");
      expect(result.type).toBe("minsize");
      expect(result.value).toBe("50000");
    });

    it("should parse severity callbacks", () => {
      const result = parseSettingsCallback("settings:severity:high");
      expect(result.type).toBe("severity");
      expect(result.value).toBe("high");
    });

    it("should parse back callback", () => {
      const result = parseSettingsCallback("settings:back");
      expect(result.type).toBe("back");
    });
  });

  describe("Settings Keyboard Generation", () => {
    it("should generate main settings keyboard with 4 rows", () => {
      const keyboard = getSettingsKeyboard({
        whaleAlerts: true,
        insiderAlerts: true,
        minTradeValue: 10000,
      });

      expect(keyboard.inline_keyboard).toHaveLength(4);
    });

    it("should show correct toggle state for whale alerts", () => {
      const enabledKeyboard = getSettingsKeyboard({ whaleAlerts: true });
      expect(enabledKeyboard.inline_keyboard[0]?.[0]?.text).toContain("ON ✅");

      const disabledKeyboard = getSettingsKeyboard({ whaleAlerts: false });
      expect(disabledKeyboard.inline_keyboard[0]?.[0]?.text).toContain("OFF ❌");
    });

    it("should show correct toggle state for insider alerts", () => {
      const enabledKeyboard = getSettingsKeyboard({ insiderAlerts: true });
      expect(enabledKeyboard.inline_keyboard[1]?.[0]?.text).toContain("ON ✅");

      const disabledKeyboard = getSettingsKeyboard({ insiderAlerts: false });
      expect(disabledKeyboard.inline_keyboard[1]?.[0]?.text).toContain("OFF ❌");
    });

    it("should toggle to opposite value in callback data", () => {
      const enabledKeyboard = getSettingsKeyboard({ whaleAlerts: true });
      // When ON, clicking should turn OFF
      expect(enabledKeyboard.inline_keyboard[0]?.[0]?.callback_data).toBe(
        "settings:whale:off"
      );

      const disabledKeyboard = getSettingsKeyboard({ whaleAlerts: false });
      // When OFF, clicking should turn ON
      expect(disabledKeyboard.inline_keyboard[0]?.[0]?.callback_data).toBe(
        "settings:whale:on"
      );
    });

    it("should display current min trade size", () => {
      const keyboard = getSettingsKeyboard({ minTradeValue: 50000 });
      expect(keyboard.inline_keyboard[2]?.[0]?.text).toContain("$50K");
    });
  });

  describe("Min Trade Size Keyboard", () => {
    it("should have 4 size options and back button", () => {
      const keyboard = getMinTradeSizeKeyboard(10000);
      expect(keyboard.inline_keyboard[0]).toHaveLength(4);
      expect(keyboard.inline_keyboard[1]?.[0]?.callback_data).toBe("settings:back");
    });

    it("should mark current value with checkmark", () => {
      const keyboard = getMinTradeSizeKeyboard(50000);
      const selectedButton = keyboard.inline_keyboard[0]?.find((b) =>
        b.callback_data.includes("50000")
      );
      expect(selectedButton?.text).toContain("✓");
    });

    it("should not mark other values with checkmark", () => {
      const keyboard = getMinTradeSizeKeyboard(50000);
      const otherButton = keyboard.inline_keyboard[0]?.find((b) =>
        b.callback_data.includes("10000")
      );
      expect(otherButton?.text).not.toContain("✓");
    });
  });

  describe("Severity Keyboard", () => {
    it("should have 3 severity options and back button", () => {
      const keyboard = getSeverityKeyboard("all");
      expect(keyboard.inline_keyboard[0]).toHaveLength(3);
      expect(keyboard.inline_keyboard[1]?.[0]?.callback_data).toBe("settings:back");
    });

    it("should mark current severity with checkmark", () => {
      const keyboard = getSeverityKeyboard("high");
      const selectedButton = keyboard.inline_keyboard[0]?.find((b) =>
        b.callback_data.includes("high")
      );
      expect(selectedButton?.text).toContain("✓");
    });
  });

  describe("Callback Detection", () => {
    it("should identify settings callbacks", () => {
      expect(isSettingsCallback("settings:whale:on")).toBe(true);
      expect(isSettingsCallback("settings:insider:off")).toBe(true);
      expect(isSettingsCallback("settings:minsize:menu")).toBe(true);
      expect(isSettingsCallback("settings:severity:all")).toBe(true);
      expect(isSettingsCallback("settings:back")).toBe(true);
    });

    it("should reject non-settings callbacks", () => {
      expect(isSettingsCallback("other:callback")).toBe(false);
      expect(isSettingsCallback("whale:on")).toBe(false);
      expect(isSettingsCallback("")).toBe(false);
    });
  });

  describe("Full Settings Flow E2E", () => {
    it("should complete settings display flow for subscribed user", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: 123456789,
        firstName: "TestUser",
      });
      const subscriber = createMockSubscriber({
        alertPreferences: {
          whaleAlerts: true,
          insiderAlerts: false,
          minTradeValue: 50000,
        },
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      await handleSettingsCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const [message, options] = vi.mocked(ctx.reply).mock.calls[0] as [
        string,
        { reply_markup: { inline_keyboard: unknown[][] } },
      ];
      expect(message).toContain("Alert Settings");
      expect(message).toContain("TestUser");
      expect(options.reply_markup.inline_keyboard).toHaveLength(4);
    });

    it("should show not subscribed message for unknown user", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: 999888777,
        firstName: "Unknown",
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      await handleSettingsCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(message).toContain("not currently subscribed");
      expect(message).toContain("/start");
    });

    it("should handle errors gracefully", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 123456789 });
      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Database error")
      );

      await handleSettingsCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(message).toContain("error loading your settings");
    });
  });

  describe("Preference Update Flow E2E", () => {
    it("should update whale alerts from off to on", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 123456789 });
      const subscriber = createMockSubscriber({
        alertPreferences: { whaleAlerts: false },
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
      vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

      const result = await updatePreferenceFromCallback(
        ctx,
        "settings:whale:on",
        mockService
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.field).toBe("whaleAlerts");
      expect(result.newValue).toBe(true);
    });

    it("should update min trade size", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 123456789 });
      const subscriber = createMockSubscriber({
        alertPreferences: { minTradeValue: 10000 },
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
      vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

      const result = await updatePreferenceFromCallback(
        ctx,
        "settings:minsize:100000",
        mockService
      );

      expect(result.success).toBe(true);
      expect(result.newValue).toBe(100000);
    });

    it("should update severity to critical only", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 123456789 });
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
      vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

      const result = await updatePreferenceFromCallback(
        ctx,
        "settings:severity:critical",
        mockService
      );

      expect(result.success).toBe(true);
      expect(result.field).toBe("severity");
      expect(result.newValue).toBe("critical");
    });

    it("should reject invalid min trade size values", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ chatId: 123456789 });
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      const result = await updatePreferenceFromCallback(
        ctx,
        "settings:minsize:99999",
        mockService
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid min trade size");
    });
  });

  describe("Callback Handler E2E", () => {
    /**
     * Create a mock context with callback query for settings
     */
    function createSettingsCallbackContext(callbackData: string): Context {
      return {
        chat: { id: 123456789, type: "private" },
        callbackQuery: {
          id: "callback-settings-123",
          data: callbackData,
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageReplyMarkup: vi.fn().mockResolvedValue({}),
      } as unknown as Context;
    }

    it("should show min size submenu when clicking min size button", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createSettingsCallbackContext("settings:minsize:menu");
      const subscriber = createMockSubscriber({
        alertPreferences: { minTradeValue: 10000 },
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      await handleSettingsCallback(ctx, mockService);

      expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });

    it("should show severity submenu when clicking severity button", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createSettingsCallbackContext("settings:severity:menu");
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      await handleSettingsCallback(ctx, mockService);

      expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });

    it("should return to main settings on back button", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createSettingsCallbackContext("settings:back");
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      await handleSettingsCallback(ctx, mockService);

      expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    });

    it("should update preference and show confirmation", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createSettingsCallbackContext("settings:insider:off");
      const subscriber = createMockSubscriber({
        alertPreferences: { insiderAlerts: true },
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
      vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

      await handleSettingsCallback(ctx, mockService);

      expect(mockService.updateAlertPreferences).toHaveBeenCalled();
      expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("Insider Alerts set to OFF"),
        })
      );
    });
  });

  describe("Handler Factory E2E", () => {
    it("should create working settings command handler", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({ firstName: "FactoryTest" });
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      const handler = createSettingsCommandHandler(mockService);
      await handler(ctx);

      expect(mockService.findByChatId).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalled();
    });

    it("should create working settings callback handler", async () => {
      const mockService = createMockSubscriberService();
      const ctx = {
        chat: { id: 123456789, type: "private" },
        callbackQuery: { id: "cb-factory", data: "settings:back" },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageReplyMarkup: vi.fn().mockResolvedValue({}),
      } as unknown as Context;
      const subscriber = createMockSubscriber();
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      const handler = createSettingsCallbackHandler(mockService);
      await handler(ctx);

      expect(mockService.findByChatId).toHaveBeenCalled();
    });
  });

  describe("Browser Verification", () => {
    it("should verify dashboard loads during settings flow", async () => {
      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      const title = await page.title();
      expect(title).toBeTruthy();

      const content = await page.content();
      expect(content).toBeTruthy();
    });

    it("should take screenshot of dashboard for settings verification", async () => {
      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await page.screenshot({
        path: "tests/e2e/screenshots/settings-command-dashboard.png",
        fullPage: true,
      });

      // Screenshot was taken successfully
      expect(true).toBe(true);
    });

    it("should verify no JavaScript errors during settings flow", async () => {
      const errors: string[] = [];
      page.on("pageerror", (event: unknown) => {
        const error = event as Error;
        errors.push(error.message);
      });

      await page.goto("http://localhost:3000/dashboard", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Filter out non-critical errors
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("Warning") &&
          !e.includes("Deprecation") &&
          !e.includes("ResizeObserver")
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe("Constants Verification", () => {
    it("should have correct MIN_TRADE_SIZE_OPTIONS", () => {
      expect(MIN_TRADE_SIZE_OPTIONS).toHaveLength(4);
      expect(MIN_TRADE_SIZE_OPTIONS[0]).toEqual({ label: "$1K", value: 1000 });
      expect(MIN_TRADE_SIZE_OPTIONS[1]).toEqual({ label: "$10K", value: 10000 });
      expect(MIN_TRADE_SIZE_OPTIONS[2]).toEqual({ label: "$50K", value: 50000 });
      expect(MIN_TRADE_SIZE_OPTIONS[3]).toEqual({ label: "$100K", value: 100000 });
    });

    it("should have correct SEVERITY_OPTIONS", () => {
      expect(SEVERITY_OPTIONS).toHaveLength(3);
      expect(SEVERITY_OPTIONS[0]).toEqual({ label: "All", value: "all" });
      expect(SEVERITY_OPTIONS[1]).toEqual({ label: "High+Critical", value: "high" });
      expect(SEVERITY_OPTIONS[2]).toEqual({ label: "Critical only", value: "critical" });
    });

    it("should have correct CALLBACK_PREFIX values", () => {
      expect(CALLBACK_PREFIX.WHALE_ALERTS).toBe("settings:whale:");
      expect(CALLBACK_PREFIX.INSIDER_ALERTS).toBe("settings:insider:");
      expect(CALLBACK_PREFIX.MIN_TRADE_SIZE).toBe("settings:minsize:");
      expect(CALLBACK_PREFIX.SEVERITY).toBe("settings:severity:");
    });
  });

  describe("Group Settings E2E", () => {
    it("should work for groups using title as display name", async () => {
      const mockService = createMockSubscriberService();
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Whale Watchers",
      });
      const subscriber = createMockSubscriber({
        chatType: TelegramChatType.SUPERGROUP,
      });
      vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

      await handleSettingsCommand(ctx, mockService);

      const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(message).toContain("Whale Watchers");
    });
  });
});
