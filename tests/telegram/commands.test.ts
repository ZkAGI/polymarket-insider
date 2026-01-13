/**
 * Unit tests for Telegram Bot Command Handlers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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

// Mock the telegram-subscribers service
vi.mock("../../src/db/telegram-subscribers", async () => {
  const actual = await vi.importActual("../../src/db/telegram-subscribers");
  return {
    ...actual,
    telegramSubscriberService: {
      findByChatId: vi.fn(),
      create: vi.fn(),
      activate: vi.fn(),
      updateByChatId: vi.fn(),
    },
  };
});

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

describe("getWelcomeMessage", () => {
  it("should return welcome message for new user", () => {
    const message = getWelcomeMessage(true, "John");
    expect(message).toContain("Welcome to Polymarket Whale Tracker, John!");
    expect(message).toContain("🐋");
    expect(message).toContain("/start");
    expect(message).toContain("/stop");
    expect(message).toContain("/settings");
    expect(message).toContain("/status");
    expect(message).toContain("/help");
  });

  it("should return welcome back message for returning user", () => {
    const message = getWelcomeMessage(false, "Jane");
    expect(message).toContain("Welcome back, Jane!");
    expect(message).toContain("🐋");
  });

  it("should include all command descriptions", () => {
    const message = getWelcomeMessage(true, "User");
    expect(message).toContain("Subscribe to alerts");
    expect(message).toContain("Unsubscribe from alerts");
    expect(message).toContain("Configure alert preferences");
    expect(message).toContain("Check your subscription status");
    expect(message).toContain("Show this help message");
  });

  it("should mention whale alerts feature", () => {
    const message = getWelcomeMessage(true, "User");
    expect(message).toContain("whales make large trades");
  });

  it("should mention insider detection feature", () => {
    const message = getWelcomeMessage(true, "User");
    expect(message).toContain("insider trading patterns");
  });
});

describe("registerUserFromContext", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should return error when no chat information", async () => {
    const ctx = createMockContext({ noChat: true });
    const result = await registerUserFromContext(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat information available");
    expect(result.isNewUser).toBe(false);
    expect(result.wasReactivated).toBe(false);
  });

  describe("new user registration", () => {
    it("should create new subscriber for new user", async () => {
      const ctx = createMockContext({
        chatId: 111222333,
        username: "newuser",
        firstName: "New",
        lastName: "User",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        username: "newuser",
        firstName: "New",
        lastName: "User",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.wasReactivated).toBe(false);
      expect(result.subscriber).toEqual(newSubscriber);
    });

    it("should create subscriber with correct chat type for private chat", async () => {
      const ctx = createMockContext({ chatType: "private" });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.PRIVATE,
        })
      );
    });

    it("should create subscriber with correct chat type for group", async () => {
      const ctx = createMockContext({ chatType: "group", title: "Test Group" });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.GROUP,
          title: "Test Group",
        })
      );
    });

    it("should create subscriber with correct chat type for supergroup", async () => {
      const ctx = createMockContext({ chatType: "supergroup", title: "Super Group" });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.SUPERGROUP,
          title: "Super Group",
        })
      );
    });

    it("should create subscriber with correct chat type for channel", async () => {
      const ctx = createMockContext({ chatType: "channel", title: "My Channel" });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.CHANNEL,
          title: "My Channel",
        })
      );
    });

    it("should set default alert preferences for new user", async () => {
      const ctx = createMockContext();

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertPreferences: expect.objectContaining({
            whaleAlerts: true,
            insiderAlerts: true,
            marketResolutionAlerts: false,
            priceMovementAlerts: false,
            minTradeValue: 10000,
          }),
        })
      );
    });

    it("should set isActive true for new user", async () => {
      const ctx = createMockContext();

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          isAdmin: false,
        })
      );
    });

    it("should include user info from context", async () => {
      const ctx = createMockContext({
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        languageCode: "de",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          languageCode: "de",
        })
      );
    });

    it("should handle user without optional fields", async () => {
      const ctx = createMockContext({ noFrom: true });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await registerUserFromContext(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: undefined,
          firstName: undefined,
          lastName: undefined,
          languageCode: undefined,
        })
      );
    });
  });

  describe("existing user handling", () => {
    it("should return existing active subscriber without changes", async () => {
      const ctx = createMockContext({ noFrom: true });
      const existingSubscriber = createMockSubscriber({ isActive: true, isBlocked: false });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(result.wasReactivated).toBe(false);
      expect(result.subscriber).toEqual(existingSubscriber);
      expect(mockService.activate).not.toHaveBeenCalled();
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it("should update existing active subscriber with new user info", async () => {
      const ctx = createMockContext({
        username: "updateduser",
        firstName: "Updated",
      });
      const existingSubscriber = createMockSubscriber({ isActive: true, isBlocked: false });
      const updatedSubscriber = createMockSubscriber({
        ...existingSubscriber,
        username: "updateduser",
        firstName: "Updated",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(updatedSubscriber);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(result.wasReactivated).toBe(false);
      expect(mockService.updateByChatId).toHaveBeenCalledWith(
        existingSubscriber.chatId,
        expect.objectContaining({
          username: "updateduser",
          firstName: "Updated",
        })
      );
    });

    it("should reactivate inactive subscriber", async () => {
      const ctx = createMockContext();
      const inactiveSubscriber = createMockSubscriber({
        isActive: false,
        isBlocked: false,
        deactivationReason: "User unsubscribed",
      });
      const reactivatedSubscriber = createMockSubscriber({
        isActive: true,
        isBlocked: false,
        deactivationReason: null,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(result.wasReactivated).toBe(true);
      expect(mockService.activate).toHaveBeenCalledWith(inactiveSubscriber.chatId);
    });

    it("should reactivate blocked subscriber", async () => {
      const ctx = createMockContext();
      const blockedSubscriber = createMockSubscriber({
        isActive: false,
        isBlocked: true,
        deactivationReason: "User blocked the bot",
      });
      const reactivatedSubscriber = createMockSubscriber({
        isActive: true,
        isBlocked: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(blockedSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.wasReactivated).toBe(true);
      expect(mockService.activate).toHaveBeenCalled();
    });

    it("should update user info after reactivation", async () => {
      const ctx = createMockContext({
        username: "returneduser",
        firstName: "Returned",
      });
      const inactiveSubscriber = createMockSubscriber({
        isActive: false,
        username: "olduser",
      });
      const reactivatedSubscriber = createMockSubscriber({ isActive: true });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      await registerUserFromContext(ctx, mockService);

      expect(mockService.updateByChatId).toHaveBeenCalledWith(
        inactiveSubscriber.chatId,
        expect.objectContaining({
          username: "returneduser",
          firstName: "Returned",
        })
      );
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const ctx = createMockContext();
      const dbError = new Error("Database connection failed");

      vi.mocked(mockService.findByChatId).mockRejectedValue(dbError);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(result.isNewUser).toBe(false);
      expect(result.wasReactivated).toBe(false);
    });

    it("should handle create errors gracefully", async () => {
      const ctx = createMockContext();
      const createError = new Error("Unique constraint violation");

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockRejectedValue(createError);

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unique constraint violation");
    });

    it("should handle non-Error objects", async () => {
      const ctx = createMockContext();

      vi.mocked(mockService.findByChatId).mockRejectedValue("String error");

      const result = await registerUserFromContext(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");
    });
  });
});

describe("handleStartCommand", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should send welcome message for new user", async () => {
    const ctx = createMockContext({ firstName: "Alice" });
    const newSubscriber = createMockSubscriber();

    vi.mocked(mockService.findByChatId).mockResolvedValue(null);
    vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

    await handleStartCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Welcome to Polymarket Whale Tracker, Alice Doe!")
    );
  });

  it("should send welcome back message for returning user", async () => {
    const ctx = createMockContext({ firstName: "Bob" });
    const existingSubscriber = createMockSubscriber({ isActive: true });

    vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
    vi.mocked(mockService.updateByChatId).mockResolvedValue(existingSubscriber);

    await handleStartCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Welcome back, Bob Doe!")
    );
  });

  it("should send error message on failure", async () => {
    const ctx = createMockContext();

    vi.mocked(mockService.findByChatId).mockRejectedValue(new Error("DB Error"));

    await handleStartCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Sorry, there was an error")
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("DB Error")
    );
  });

  it("should use group title for display name in groups", async () => {
    const ctx = createMockContext({
      chatType: "group",
      title: "My Trading Group",
    });
    const newSubscriber = createMockSubscriber({ chatType: TelegramChatType.GROUP });

    vi.mocked(mockService.findByChatId).mockResolvedValue(null);
    vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

    await handleStartCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("My Trading Group")
    );
  });

  it("should handle missing from in private chat", async () => {
    const ctx = createMockContext({ noFrom: true });
    const newSubscriber = createMockSubscriber();

    vi.mocked(mockService.findByChatId).mockResolvedValue(null);
    vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

    await handleStartCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("User")
    );
  });
});

describe("createStartCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createStartCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = createMockContext();
    const newSubscriber = createMockSubscriber();

    vi.mocked(mockService.findByChatId).mockResolvedValue(null);
    vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

    const handler = createStartCommandHandler(mockService);
    await handler(ctx);

    expect(mockService.findByChatId).toHaveBeenCalled();
  });

  it("should work with default service", () => {
    const handler = createStartCommandHandler();
    expect(handler).toBeDefined();
  });
});
