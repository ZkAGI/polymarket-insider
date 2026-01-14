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
  handleMyChatMember,
  createMyChatMemberHandler,
  getGroupWelcomeMessage,
  getGroupFarewellMessage,
  isBotMember,
  isBotRemoved,
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

// Mock the database client to prevent actual DB connection
vi.mock("../../src/db/client", () => ({
  prisma: {
    telegramSubscriber: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock the env module
vi.mock("../../config/env", () => ({
  env: {
    TELEGRAM_ADMIN_IDS: [12345, 67890],
  },
}));

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
      deactivate: vi.fn(),
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

  // Handle lastName: undefined means no last name, null means use null, otherwise use value or default
  const lastName = "lastName" in (overrides ?? {}) ? overrides?.lastName : "Doe";

  const from = overrides?.noFrom
    ? undefined
    : {
        id: overrides?.chatId ?? 123456789,
        is_bot: false,
        first_name: overrides?.firstName ?? "John",
        ...(lastName !== undefined ? { last_name: lastName } : {}),
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
    markBlockedWithReason: vi.fn(),
    incrementAlertsSent: vi.fn(),
    updateAlertPreferences: vi.fn(),
    updateMinSeverity: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
    isSubscribed: vi.fn(),
    isAdmin: vi.fn(),
    findInactiveSubscribers: vi.fn(),
    cleanupInactiveSubscribers: vi.fn(),
    reactivate: vi.fn(),
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

// ============= Tests for TG-BOT-003: Group membership handler =============

describe("isBotMember", () => {
  it("should return true for 'member' status", () => {
    expect(isBotMember("member")).toBe(true);
  });

  it("should return true for 'administrator' status", () => {
    expect(isBotMember("administrator")).toBe(true);
  });

  it("should return false for 'left' status", () => {
    expect(isBotMember("left")).toBe(false);
  });

  it("should return false for 'kicked' status", () => {
    expect(isBotMember("kicked")).toBe(false);
  });

  it("should return false for 'restricted' status", () => {
    expect(isBotMember("restricted")).toBe(false);
  });

  it("should return false for 'creator' status", () => {
    expect(isBotMember("creator")).toBe(false);
  });
});

describe("isBotRemoved", () => {
  it("should return true for 'left' status", () => {
    expect(isBotRemoved("left")).toBe(true);
  });

  it("should return true for 'kicked' status", () => {
    expect(isBotRemoved("kicked")).toBe(true);
  });

  it("should return false for 'member' status", () => {
    expect(isBotRemoved("member")).toBe(false);
  });

  it("should return false for 'administrator' status", () => {
    expect(isBotRemoved("administrator")).toBe(false);
  });

  it("should return false for 'restricted' status", () => {
    expect(isBotRemoved("restricted")).toBe(false);
  });
});

describe("getGroupWelcomeMessage", () => {
  it("should include group name in welcome message", () => {
    const message = getGroupWelcomeMessage("Crypto Traders");
    expect(message).toContain("Crypto Traders");
  });

  it("should include whale tracking info", () => {
    const message = getGroupWelcomeMessage("Test Group");
    expect(message).toContain("whale trades");
  });

  it("should include insider trading info", () => {
    const message = getGroupWelcomeMessage("Test Group");
    expect(message).toContain("insider trading");
  });

  it("should include /settings command info", () => {
    const message = getGroupWelcomeMessage("Test Group");
    expect(message).toContain("/settings");
  });

  it("should include /help command info", () => {
    const message = getGroupWelcomeMessage("Test Group");
    expect(message).toContain("/help");
  });

  it("should have whale emoji", () => {
    const message = getGroupWelcomeMessage("Test Group");
    expect(message).toContain("🐋");
  });
});

describe("getGroupFarewellMessage", () => {
  it("should include group name in farewell message", () => {
    const message = getGroupFarewellMessage("Departing Group");
    expect(message).toContain("Departing Group");
  });

  it("should indicate bot was removed", () => {
    const message = getGroupFarewellMessage("Test Group");
    expect(message).toContain("removed");
  });
});

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

describe("handleMyChatMember", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  describe("update validation", () => {
    it("should return error when no my_chat_member update", async () => {
      const ctx = createMyChatMemberContext({ noMyChatMember: true });
      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.action).toBe("none");
      expect(result.error).toBe("Not a my_chat_member update");
    });

    it("should ignore private chat updates", async () => {
      const ctx = createMyChatMemberContext({ chatType: "private" });
      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });

    it("should ignore channel updates", async () => {
      const ctx = createMyChatMemberContext({ chatType: "channel" });
      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });
  });

  describe("bot added to group", () => {
    it("should register new group when bot is added", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001111111111,
        chatTitle: "New Trading Group",
        oldStatus: "left",
        newStatus: "member",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(-1001111111111),
        chatType: TelegramChatType.SUPERGROUP,
        title: "New Trading Group",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(result.chatTitle).toBe("New Trading Group");
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: BigInt(-1001111111111),
          chatType: TelegramChatType.SUPERGROUP,
          title: "New Trading Group",
          isActive: true,
        })
      );
    });

    it("should register group when bot becomes administrator", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1002222222222,
        chatTitle: "Admin Group",
        oldStatus: "left",
        newStatus: "administrator",
      });

      const newSubscriber = createMockSubscriber({
        chatId: BigInt(-1002222222222),
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(newSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(mockService.create).toHaveBeenCalled();
    });

    it("should send welcome message when group is registered", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1003333333333,
        chatTitle: "Welcome Group",
        oldStatus: "kicked",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await handleMyChatMember(ctx, mockService);

      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        -1003333333333,
        expect.stringContaining("Welcome Group")
      );
    });

    it("should set default alert preferences for new group", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1004444444444,
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      await handleMyChatMember(ctx, mockService);

      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alertPreferences: expect.objectContaining({
            whaleAlerts: true,
            insiderAlerts: true,
            minTradeValue: 10000,
          }),
        })
      );
    });

    it("should handle regular group (not supergroup)", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -100555555,
        chatType: "group",
        chatTitle: "Regular Group",
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("registered");
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: TelegramChatType.GROUP,
        })
      );
    });

    it("should reactivate previously deactivated group", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1006666666666,
        chatTitle: "Reactivated Group",
        oldStatus: "left",
        newStatus: "member",
      });

      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(-1006666666666),
        isActive: false,
        deactivationReason: "Bot was removed from group",
      });

      const reactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(-1006666666666),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(reactivatedSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(reactivatedSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("reactivated");
      expect(mockService.activate).toHaveBeenCalledWith(BigInt(-1006666666666));
    });

    it("should send welcome message when group is reactivated", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1007777777777,
        chatTitle: "Reactivated Again",
        oldStatus: "kicked",
        newStatus: "administrator",
      });

      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(-1007777777777),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);
      vi.mocked(mockService.activate).mockResolvedValue(
        createMockSubscriber({ isActive: true })
      );
      vi.mocked(mockService.updateByChatId).mockResolvedValue(
        createMockSubscriber({ isActive: true })
      );

      await handleMyChatMember(ctx, mockService);

      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        -1007777777777,
        expect.stringContaining("Reactivated Again")
      );
    });

    it("should update title when already active group", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1008888888888,
        chatTitle: "Updated Title",
        oldStatus: "left",
        newStatus: "member",
      });

      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(-1008888888888),
        isActive: true,
        title: "Old Title",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(activeSubscriber);
      vi.mocked(mockService.updateByChatId).mockResolvedValue(activeSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
      expect(mockService.updateByChatId).toHaveBeenCalledWith(
        BigInt(-1008888888888),
        expect.objectContaining({ title: "Updated Title" })
      );
    });
  });

  describe("bot removed from group", () => {
    it("should deactivate group when bot is removed", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1009999999999,
        chatTitle: "Leaving Group",
        oldStatus: "member",
        newStatus: "left",
      });

      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(-1009999999999),
        isActive: true,
      });

      const deactivatedSubscriber = createMockSubscriber({
        chatId: BigInt(-1009999999999),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(activeSubscriber);
      vi.mocked(mockService.deactivate).mockResolvedValue(deactivatedSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("deactivated");
      expect(mockService.deactivate).toHaveBeenCalledWith(
        BigInt(-1009999999999),
        "Bot was removed from group"
      );
    });

    it("should deactivate group when bot is kicked", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001010101010,
        chatTitle: "Kicked Group",
        oldStatus: "administrator",
        newStatus: "kicked",
      });

      const activeSubscriber = createMockSubscriber({
        chatId: BigInt(-1001010101010),
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

    it("should return none if group already deactivated", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001111111111,
        oldStatus: "member",
        newStatus: "left",
      });

      const inactiveSubscriber = createMockSubscriber({
        chatId: BigInt(-1001111111111),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(inactiveSubscriber);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
      expect(mockService.deactivate).not.toHaveBeenCalled();
    });

    it("should return none if group not in database", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001212121212,
        oldStatus: "member",
        newStatus: "kicked",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });
  });

  describe("no relevant status change", () => {
    it("should return none for member to administrator change", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "member",
        newStatus: "administrator",
      });

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });

    it("should return none for administrator to member change", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "administrator",
        newStatus: "member",
      });

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });

    it("should return none for left to kicked change", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "left",
        newStatus: "kicked",
      });

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.action).toBe("none");
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.action).toBe("none");
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle create errors gracefully", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockRejectedValue(
        new Error("Create failed")
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Create failed");
    });

    it("should handle sendMessage errors gracefully", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);
      vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());
      // Make sendMessage throw an error
      (ctx.api.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Message send failed")
      );

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Message send failed");
    });

    it("should include chatId and chatTitle in error result", async () => {
      const ctx = createMyChatMemberContext({
        chatId: -1001313131313,
        chatTitle: "Error Group",
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockRejectedValue(new Error("Oops"));

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.chatId).toBe(BigInt(-1001313131313));
      expect(result.chatTitle).toBe("Error Group");
    });

    it("should handle non-Error objects", async () => {
      const ctx = createMyChatMemberContext({
        oldStatus: "left",
        newStatus: "member",
      });

      vi.mocked(mockService.findByChatId).mockRejectedValue("String error");

      const result = await handleMyChatMember(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");
    });
  });
});

describe("createMyChatMemberHandler", () => {
  it("should create a handler function", () => {
    const handler = createMyChatMemberHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = createMyChatMemberContext({
      oldStatus: "left",
      newStatus: "member",
    });

    vi.mocked(mockService.findByChatId).mockResolvedValue(null);
    vi.mocked(mockService.create).mockResolvedValue(createMockSubscriber());

    const handler = createMyChatMemberHandler(mockService);
    await handler(ctx);

    expect(mockService.findByChatId).toHaveBeenCalled();
  });

  it("should work with default service", () => {
    const handler = createMyChatMemberHandler();
    expect(handler).toBeDefined();
  });
});

// =============================================================================
// /stop Command Tests
// =============================================================================

describe("getUnsubscribeMessage", () => {
  it("should include personalized goodbye", () => {
    const message = getUnsubscribeMessage("John");
    expect(message).toContain("Goodbye, John!");
    expect(message).toContain("👋");
  });

  it("should mention unsubscription", () => {
    const message = getUnsubscribeMessage("User");
    expect(message).toContain("unsubscribed");
    expect(message).toContain("Polymarket Whale Tracker");
  });

  it("should list what notifications are stopped", () => {
    const message = getUnsubscribeMessage("User");
    expect(message).toContain("Whale trades");
    expect(message).toContain("Insider activity");
    expect(message).toContain("Suspicious wallet");
  });

  it("should mention how to resubscribe", () => {
    const message = getUnsubscribeMessage("User");
    expect(message).toContain("/start");
    expect(message).toContain("resubscribe");
  });
});

describe("getAlreadyUnsubscribedMessage", () => {
  it("should include personalized greeting", () => {
    const message = getAlreadyUnsubscribedMessage("Jane");
    expect(message).toContain("Hi Jane!");
  });

  it("should mention not currently subscribed", () => {
    const message = getAlreadyUnsubscribedMessage("User");
    expect(message).toContain("not currently subscribed");
  });

  it("should mention how to subscribe", () => {
    const message = getAlreadyUnsubscribedMessage("User");
    expect(message).toContain("/start");
  });
});

describe("getNotFoundMessage", () => {
  it("should mention not subscribed", () => {
    const message = getNotFoundMessage();
    expect(message).toContain("not currently subscribed");
  });

  it("should mention how to subscribe", () => {
    const message = getNotFoundMessage();
    expect(message).toContain("/start");
  });
});

describe("unsubscribeUser", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should return error when no chat information", async () => {
    const ctx = createMockContext({ noChat: true });
    const result = await unsubscribeUser(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat information available");
    expect(result.wasAlreadyInactive).toBe(false);
  });

  describe("active subscriber unsubscribe", () => {
    it("should deactivate an active subscriber", async () => {
      const ctx = createMockContext({ chatId: 111222333 });
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
      expect(result.subscriber?.isActive).toBe(false);
      expect(mockService.deactivate).toHaveBeenCalledWith(
        BigInt(111222333),
        "User sent /stop command"
      );
    });

    it("should work for groups", async () => {
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Test Group",
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

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(mockService.deactivate).toHaveBeenCalled();
    });
  });

  describe("already inactive subscriber", () => {
    it("should return wasAlreadyInactive for inactive subscriber", async () => {
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: false,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.wasAlreadyInactive).toBe(true);
      expect(result.subscriber).toEqual(existingSubscriber);
      expect(mockService.deactivate).not.toHaveBeenCalled();
    });

    it("should not call deactivate for blocked subscriber", async () => {
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: false,
        isBlocked: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(true);
      expect(result.wasAlreadyInactive).toBe(true);
      expect(mockService.deactivate).not.toHaveBeenCalled();
    });
  });

  describe("subscriber not found", () => {
    it("should return error when subscriber not found", async () => {
      const ctx = createMockContext({ chatId: 999888777 });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Subscriber not found");
      expect(result.wasAlreadyInactive).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const ctx = createMockContext({ chatId: 111222333 });

      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle deactivate errors", async () => {
      const ctx = createMockContext({ chatId: 111222333 });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(111222333),
        isActive: true,
      });

      vi.mocked(mockService.findByChatId).mockResolvedValue(existingSubscriber);
      vi.mocked(mockService.deactivate).mockRejectedValue(
        new Error("Deactivation failed")
      );

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Deactivation failed");
    });

    it("should handle non-Error objects", async () => {
      const ctx = createMockContext({ chatId: 111222333 });

      vi.mocked(mockService.findByChatId).mockRejectedValue("String error");

      const result = await unsubscribeUser(ctx, mockService);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");
    });
  });
});

describe("handleStopCommand", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  describe("successful unsubscribe", () => {
    it("should send unsubscribe message for active subscriber", async () => {
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "John",
        lastName: "Doe",
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
      expect(replyMessage).toContain("Goodbye, John Doe!");
      expect(replyMessage).toContain("unsubscribed");
    });

    it("should send message with first name only when no last name", async () => {
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "Jane",
        lastName: undefined,
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

      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("Goodbye, Jane!");
    });
  });

  describe("already inactive subscriber", () => {
    it("should send already unsubscribed message", async () => {
      const ctx = createMockContext({
        chatId: 111222333,
        firstName: "John",
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
      expect(replyMessage).toContain("/start");
    });
  });

  describe("subscriber not found", () => {
    it("should send not found message", async () => {
      const ctx = createMockContext({ chatId: 999888777 });

      vi.mocked(mockService.findByChatId).mockResolvedValue(null);

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("not currently subscribed");
      expect(replyMessage).toContain("/start");
    });
  });

  describe("error handling", () => {
    it("should send error message on database failure", async () => {
      const ctx = createMockContext({ chatId: 111222333 });

      vi.mocked(mockService.findByChatId).mockRejectedValue(
        new Error("Database error")
      );

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("error processing your request");
      expect(replyMessage).toContain("Database error");
    });

    it("should send error message on no chat info", async () => {
      const ctx = createMockContext({ noChat: true });

      await handleStopCommand(ctx, mockService);

      expect(ctx.reply).toHaveBeenCalledTimes(1);
      const replyMessage = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
      expect(replyMessage).toContain("error processing your request");
      expect(replyMessage).toContain("No chat information available");
    });
  });

  describe("groups", () => {
    it("should work in groups", async () => {
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "supergroup",
        title: "Test Group",
      });
      const existingSubscriber = createMockSubscriber({
        chatId: BigInt(-1001234567890),
        chatType: TelegramChatType.SUPERGROUP,
        isActive: true,
        title: "Test Group",
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
      const ctx = createMockContext({
        chatId: -1001234567890,
        chatType: "group",
        title: "Trading Alerts",
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
      expect(replyMessage).toContain("Trading Alerts");
    });
  });
});

describe("createStopCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createStopCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
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
  });

  it("should work with default service", () => {
    const handler = createStopCommandHandler();
    expect(handler).toBeDefined();
  });
});

// =============================================================================
// /settings Command Tests
// =============================================================================

import {
  handleSettingsCommand,
  createSettingsCommandHandler,
  handleSettingsCallback,
  createSettingsCallbackHandler,
  getAlertPreferences,
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

describe("Settings Constants", () => {
  describe("MIN_TRADE_SIZE_OPTIONS", () => {
    it("should have 4 options", () => {
      expect(MIN_TRADE_SIZE_OPTIONS).toHaveLength(4);
    });

    it("should include $1K, $10K, $50K, $100K options", () => {
      const values = MIN_TRADE_SIZE_OPTIONS.map((o) => o.value);
      expect(values).toContain(1000);
      expect(values).toContain(10000);
      expect(values).toContain(50000);
      expect(values).toContain(100000);
    });
  });

  describe("SEVERITY_OPTIONS", () => {
    it("should have 3 options", () => {
      expect(SEVERITY_OPTIONS).toHaveLength(3);
    });

    it("should include all, high, critical options", () => {
      const values = SEVERITY_OPTIONS.map((o) => o.value);
      expect(values).toContain("all");
      expect(values).toContain("high");
      expect(values).toContain("critical");
    });
  });

  describe("CALLBACK_PREFIX", () => {
    it("should have whale, insider, minsize, severity prefixes", () => {
      expect(CALLBACK_PREFIX.WHALE_ALERTS).toBe("settings:whale:");
      expect(CALLBACK_PREFIX.INSIDER_ALERTS).toBe("settings:insider:");
      expect(CALLBACK_PREFIX.MIN_TRADE_SIZE).toBe("settings:minsize:");
      expect(CALLBACK_PREFIX.SEVERITY).toBe("settings:severity:");
    });
  });
});

describe("formatPreferenceValue", () => {
  it("should format boolean values for whaleAlerts", () => {
    expect(formatPreferenceValue("whaleAlerts", true)).toBe("ON");
    expect(formatPreferenceValue("whaleAlerts", false)).toBe("OFF");
  });

  it("should format boolean values for insiderAlerts", () => {
    expect(formatPreferenceValue("insiderAlerts", true)).toBe("ON");
    expect(formatPreferenceValue("insiderAlerts", false)).toBe("OFF");
  });

  it("should format minTradeValue", () => {
    expect(formatPreferenceValue("minTradeValue", 1000)).toBe("$1K");
    expect(formatPreferenceValue("minTradeValue", 10000)).toBe("$10K");
    expect(formatPreferenceValue("minTradeValue", 50000)).toBe("$50K");
    expect(formatPreferenceValue("minTradeValue", 100000)).toBe("$100K");
    expect(formatPreferenceValue("minTradeValue", 150000)).toBe("$100K");
  });

  it("should format severity values", () => {
    expect(formatPreferenceValue("severity", "all")).toBe("All");
    expect(formatPreferenceValue("severity", "high")).toBe("High+Critical");
    expect(formatPreferenceValue("severity", "critical")).toBe("Critical only");
  });

  it("should handle default minTradeValue", () => {
    expect(formatPreferenceValue("minTradeValue", undefined)).toBe("$10K");
    expect(formatPreferenceValue("minTradeValue", "invalid")).toBe("$10K");
  });
});

describe("getFieldDisplayName", () => {
  it("should return human-readable names", () => {
    expect(getFieldDisplayName("whaleAlerts")).toBe("Whale Alerts");
    expect(getFieldDisplayName("insiderAlerts")).toBe("Insider Alerts");
    expect(getFieldDisplayName("minTradeValue")).toBe("Min Trade Size");
    expect(getFieldDisplayName("severity")).toBe("Severity");
  });

  it("should return field name for unknown fields", () => {
    expect(getFieldDisplayName("unknownField")).toBe("unknownField");
  });
});

describe("getSettingsMessage", () => {
  it("should include display name", () => {
    const message = getSettingsMessage("John");
    expect(message).toContain("John");
  });

  it("should include settings emoji", () => {
    const message = getSettingsMessage("User");
    expect(message).toContain("⚙️");
  });

  it("should include instructions", () => {
    const message = getSettingsMessage("User");
    expect(message).toContain("Configure which alerts");
    expect(message).toContain("Tap a button");
  });
});

describe("isSettingsCallback", () => {
  it("should return true for settings callbacks", () => {
    expect(isSettingsCallback("settings:whale:on")).toBe(true);
    expect(isSettingsCallback("settings:insider:off")).toBe(true);
    expect(isSettingsCallback("settings:minsize:10000")).toBe(true);
    expect(isSettingsCallback("settings:severity:high")).toBe(true);
    expect(isSettingsCallback("settings:back")).toBe(true);
  });

  it("should return false for non-settings callbacks", () => {
    expect(isSettingsCallback("other:data")).toBe(false);
    expect(isSettingsCallback("whale:on")).toBe(false);
    expect(isSettingsCallback("")).toBe(false);
  });
});

describe("parseSettingsCallback", () => {
  it("should parse whale alerts callback", () => {
    expect(parseSettingsCallback("settings:whale:on")).toEqual({
      type: "whale",
      value: "on",
    });
    expect(parseSettingsCallback("settings:whale:off")).toEqual({
      type: "whale",
      value: "off",
    });
  });

  it("should parse insider alerts callback", () => {
    expect(parseSettingsCallback("settings:insider:on")).toEqual({
      type: "insider",
      value: "on",
    });
    expect(parseSettingsCallback("settings:insider:off")).toEqual({
      type: "insider",
      value: "off",
    });
  });

  it("should parse min trade size callback", () => {
    expect(parseSettingsCallback("settings:minsize:1000")).toEqual({
      type: "minsize",
      value: "1000",
    });
    expect(parseSettingsCallback("settings:minsize:menu")).toEqual({
      type: "minsize",
      value: "menu",
    });
  });

  it("should parse severity callback", () => {
    expect(parseSettingsCallback("settings:severity:all")).toEqual({
      type: "severity",
      value: "all",
    });
    expect(parseSettingsCallback("settings:severity:menu")).toEqual({
      type: "severity",
      value: "menu",
    });
  });

  it("should parse back callback", () => {
    expect(parseSettingsCallback("settings:back")).toEqual({
      type: "back",
      value: "",
    });
  });

  it("should return unknown for unrecognized callbacks", () => {
    expect(parseSettingsCallback("settings:unknown:value")).toEqual({
      type: "unknown",
      value: "",
    });
    expect(parseSettingsCallback("other:data")).toEqual({
      type: "unknown",
      value: "",
    });
  });
});

describe("getSettingsKeyboard", () => {
  it("should create keyboard with all settings options", () => {
    const keyboard = getSettingsKeyboard({
      whaleAlerts: true,
      insiderAlerts: true,
      minTradeValue: 10000,
    });

    expect(keyboard.inline_keyboard).toHaveLength(4);
  });

  it("should show ON for enabled whale alerts", () => {
    const keyboard = getSettingsKeyboard({ whaleAlerts: true });
    const whaleRow = keyboard.inline_keyboard[0]?.[0];
    expect(whaleRow).toBeDefined();
    expect(whaleRow?.text).toContain("ON ✅");
    expect(whaleRow?.callback_data).toBe("settings:whale:off");
  });

  it("should show OFF for disabled whale alerts", () => {
    const keyboard = getSettingsKeyboard({ whaleAlerts: false });
    const whaleRow = keyboard.inline_keyboard[0]?.[0];
    expect(whaleRow).toBeDefined();
    expect(whaleRow?.text).toContain("OFF ❌");
    expect(whaleRow?.callback_data).toBe("settings:whale:on");
  });

  it("should show current min trade size", () => {
    const keyboard = getSettingsKeyboard({ minTradeValue: 50000 });
    const sizeRow = keyboard.inline_keyboard[2]?.[0];
    expect(sizeRow).toBeDefined();
    expect(sizeRow?.text).toContain("$50K");
  });

  it("should use default values when not provided", () => {
    const keyboard = getSettingsKeyboard({});
    // Default: whaleAlerts true, insiderAlerts true, minTradeValue 10000, severity all
    expect(keyboard.inline_keyboard[0]?.[0]?.text).toContain("ON");
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toContain("ON");
    expect(keyboard.inline_keyboard[2]?.[0]?.text).toContain("$10K");
  });
});

describe("getMinTradeSizeKeyboard", () => {
  it("should create keyboard with all size options", () => {
    const keyboard = getMinTradeSizeKeyboard(10000);
    // First row should have 4 size options
    expect(keyboard.inline_keyboard[0]).toHaveLength(4);
    // Second row should have back button
    expect(keyboard.inline_keyboard[1]).toHaveLength(1);
    expect(keyboard.inline_keyboard[1]?.[0]?.callback_data).toBe("settings:back");
  });

  it("should mark current value with checkmark", () => {
    const keyboard = getMinTradeSizeKeyboard(50000);
    const $50kButton = keyboard.inline_keyboard[0]?.find((b) =>
      b.text.includes("$50K")
    );
    expect($50kButton?.text).toContain("✓");
  });

  it("should not mark other values with checkmark", () => {
    const keyboard = getMinTradeSizeKeyboard(50000);
    const $10kButton = keyboard.inline_keyboard[0]?.find((b) =>
      b.text.includes("$10K")
    );
    expect($10kButton?.text).not.toContain("✓");
  });
});

describe("getSeverityKeyboard", () => {
  it("should create keyboard with all severity options", () => {
    const keyboard = getSeverityKeyboard("all");
    // First row should have 3 severity options
    expect(keyboard.inline_keyboard[0]).toHaveLength(3);
    // Second row should have back button
    expect(keyboard.inline_keyboard[1]).toHaveLength(1);
  });

  it("should mark current value with checkmark", () => {
    const keyboard = getSeverityKeyboard("high");
    const highButton = keyboard.inline_keyboard[0]?.find((b) =>
      b.text.includes("High")
    );
    expect(highButton?.text).toContain("✓");
  });
});

describe("getAlertPreferences", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should return error when no chat information", async () => {
    const ctx = createMockContext({ noChat: true });
    const result = await getAlertPreferences(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat information available");
  });

  it("should return error when subscriber not found", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    const result = await getAlertPreferences(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should return preferences for existing subscriber", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber({
      alertPreferences: {
        whaleAlerts: false,
        insiderAlerts: true,
        minTradeValue: 50000,
      },
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await getAlertPreferences(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.preferences?.whaleAlerts).toBe(false);
    expect(result.preferences?.insiderAlerts).toBe(true);
    expect(result.preferences?.minTradeValue).toBe(50000);
  });

  it("should return default preferences when none set", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber({
      alertPreferences: null,
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await getAlertPreferences(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.preferences?.whaleAlerts).toBe(true);
    expect(result.preferences?.insiderAlerts).toBe(true);
    expect(result.preferences?.minTradeValue).toBe(10000);
  });

  it("should handle database errors gracefully", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    vi.mocked(mockService.findByChatId).mockRejectedValue(
      new Error("Database error")
    );

    const result = await getAlertPreferences(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });
});

describe("updatePreferenceFromCallback", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should return error when no chat information", async () => {
    const ctx = createMockContext({ noChat: true });
    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:whale:on",
      mockService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat information available");
  });

  it("should return error when subscriber not found", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:whale:on",
      mockService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Subscriber not found");
  });

  it("should update whale alerts to on", async () => {
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
    expect(mockService.updateAlertPreferences).toHaveBeenCalledWith(
      BigInt(123456789),
      expect.objectContaining({ whaleAlerts: true })
    );
  });

  it("should update whale alerts to off", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber({
      alertPreferences: { whaleAlerts: true },
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
    vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:whale:off",
      mockService
    );

    expect(result.success).toBe(true);
    expect(result.newValue).toBe(false);
  });

  it("should update insider alerts", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
    vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:insider:on",
      mockService
    );

    expect(result.success).toBe(true);
    expect(result.field).toBe("insiderAlerts");
  });

  it("should update min trade size", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
    vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:minsize:50000",
      mockService
    );

    expect(result.success).toBe(true);
    expect(result.field).toBe("minTradeValue");
    expect(result.newValue).toBe(50000);
  });

  it("should reject invalid min trade size", async () => {
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

  it("should update severity", async () => {
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

  it("should reject invalid severity", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:severity:invalid",
      mockService
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid severity");
  });

  it("should return success without update for back callback", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:back",
      mockService
    );

    expect(result.success).toBe(true);
    expect(result.updated).toBe(false);
  });

  it("should return success without update for menu callback", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:minsize:menu",
      mockService
    );

    expect(result.success).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.field).toBe("minsize");
  });

  it("should handle database update errors", async () => {
    const ctx = createMockContext({ chatId: 123456789 });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
    vi.mocked(mockService.updateAlertPreferences).mockRejectedValue(
      new Error("Update failed")
    );

    const result = await updatePreferenceFromCallback(
      ctx,
      "settings:whale:on",
      mockService
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Update failed");
  });
});

describe("handleSettingsCommand", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should send settings message with inline keyboard", async () => {
    const ctx = createMockContext({ firstName: "John" });
    const subscriber = createMockSubscriber({
      alertPreferences: {
        whaleAlerts: true,
        insiderAlerts: true,
        minTradeValue: 10000,
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
    expect(message).toContain("John");
    expect(options.reply_markup.inline_keyboard).toBeDefined();
  });

  it("should send not subscribed message when subscriber not found", async () => {
    const ctx = createMockContext({ firstName: "Unknown" });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    await handleSettingsCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
    expect(message).toContain("not currently subscribed");
    expect(message).toContain("/start");
  });

  it("should send error message on database failure", async () => {
    const ctx = createMockContext({ firstName: "John" });
    vi.mocked(mockService.findByChatId).mockRejectedValue(
      new Error("DB connection failed")
    );

    await handleSettingsCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
    expect(message).toContain("error loading your settings");
    expect(message).toContain("DB connection failed");
  });

  it("should use group title as display name for groups", async () => {
    const ctx = createMockContext({
      chatType: "supergroup",
      title: "Trading Group",
    });
    const subscriber = createMockSubscriber({
      chatType: TelegramChatType.SUPERGROUP,
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    await handleSettingsCommand(ctx, mockService);

    const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
    expect(message).toContain("Trading Group");
  });
});

describe("handleSettingsCallback", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  /**
   * Create a mock context with callback query
   */
  function createCallbackContext(callbackData: string): Context {
    return {
      chat: { id: 123456789, type: "private" },
      callbackQuery: {
        id: "callback-123",
        data: callbackData,
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageReplyMarkup: vi.fn().mockResolvedValue({}),
    } as unknown as Context;
  }

  it("should do nothing without callback query", async () => {
    const ctx = {
      chat: { id: 123456789 },
      callbackQuery: undefined,
    } as unknown as Context;

    await handleSettingsCallback(ctx, mockService);

    expect(mockService.findByChatId).not.toHaveBeenCalled();
  });

  it("should show min size menu when minsize:menu callback", async () => {
    const ctx = createCallbackContext("settings:minsize:menu");
    const subscriber = createMockSubscriber({
      alertPreferences: { minTradeValue: 10000 },
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    await handleSettingsCallback(ctx, mockService);

    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("should show severity menu when severity:menu callback", async () => {
    const ctx = createCallbackContext("settings:severity:menu");
    const subscriber = createMockSubscriber({
      alertPreferences: {},
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    await handleSettingsCallback(ctx, mockService);

    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("should go back to main settings on back callback", async () => {
    const ctx = createCallbackContext("settings:back");
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    await handleSettingsCallback(ctx, mockService);

    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });

  it("should update whale alerts and refresh keyboard", async () => {
    const ctx = createCallbackContext("settings:whale:on");
    const subscriber = createMockSubscriber({
      alertPreferences: { whaleAlerts: false },
    });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);
    vi.mocked(mockService.updateAlertPreferences).mockResolvedValue(subscriber);

    await handleSettingsCallback(ctx, mockService);

    expect(mockService.updateAlertPreferences).toHaveBeenCalled();
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Whale Alerts set to ON"),
      })
    );
  });

  it("should show error alert on update failure", async () => {
    const ctx = createCallbackContext("settings:whale:on");
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    await handleSettingsCallback(ctx, mockService);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.any(String),
        show_alert: true,
      })
    );
  });

  it("should show error when getting preferences fails", async () => {
    const ctx = createCallbackContext("settings:whale:on");
    vi.mocked(mockService.findByChatId).mockRejectedValue(
      new Error("DB error")
    );

    await handleSettingsCallback(ctx, mockService);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Error loading settings",
        show_alert: true,
      })
    );
  });
});

describe("createSettingsCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createSettingsCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = createMockContext({ firstName: "John" });
    const subscriber = createMockSubscriber();
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const handler = createSettingsCommandHandler(mockService);
    await handler(ctx);

    expect(mockService.findByChatId).toHaveBeenCalled();
  });
});

describe("createSettingsCallbackHandler", () => {
  it("should create a handler function", () => {
    const handler = createSettingsCallbackHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = {
      chat: { id: 123456789, type: "private" },
      callbackQuery: { id: "cb-1", data: "settings:back" },
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

// =============================================================================
// /help Command Tests
// =============================================================================

import {
  handleHelpCommand,
  createHelpCommandHandler,
  getHelpMessage,
  handleStatusCommand,
  createStatusCommandHandler,
  getSubscriptionStatus,
  getStatusMessage,
  formatDate,
  escapeMarkdown,
  handleStatsCommand,
  createStatsCommandHandler,
  checkIsAdmin,
  getUnauthorizedMessage,
  getStatsMessage,
  getUptimeString,
  // Broadcast command imports
  handleBroadcastCommand,
  createBroadcastCommandHandler,
  broadcastMessage,
  parseBroadcastMessage,
  getBroadcastReportMessage,
  getEmptyBroadcastMessage,
  // Test command imports
  handleTestCommand,
  createTestCommandHandler,
  getTestAlertMessage,
  type AdminBroadcastResult,
} from "../../src/telegram/commands";

describe("getHelpMessage", () => {
  it("should return help message with markdown", () => {
    const message = getHelpMessage();
    expect(message).toContain("Polymarket Whale Tracker");
    expect(message).toContain("*Available Commands:*");
  });

  it("should include all basic commands", () => {
    const message = getHelpMessage();
    expect(message).toContain("/start");
    expect(message).toContain("/stop");
    expect(message).toContain("/status");
    expect(message).toContain("/settings");
    expect(message).toContain("/help");
  });

  it("should include what the bot tracks", () => {
    const message = getHelpMessage();
    expect(message).toContain("whale trades");
    expect(message).toContain("insider trading");
    expect(message).toContain("wallet activity");
  });

  it("should include alert settings info", () => {
    const message = getHelpMessage();
    expect(message).toContain("Alert Settings");
    expect(message).toContain("whale alerts");
    expect(message).toContain("insider alerts");
    expect(message).toContain("minimum trade size");
  });

  it("should include tips", () => {
    const message = getHelpMessage();
    expect(message).toContain("Tips");
    expect(message).toContain("/settings");
  });
});

describe("handleHelpCommand", () => {
  it("should reply with help message", async () => {
    const ctx = createMockContext({ firstName: "John" });

    await handleHelpCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Polymarket Whale Tracker"),
      { parse_mode: "Markdown" }
    );
  });

  it("should include parse_mode Markdown", async () => {
    const ctx = createMockContext();

    await handleHelpCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ parse_mode: "Markdown" })
    );
  });
});

describe("createHelpCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createHelpCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should return help message when called", async () => {
    const ctx = createMockContext();
    const handler = createHelpCommandHandler();

    await handler(ctx);

    expect(ctx.reply).toHaveBeenCalled();
    const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
    expect(message).toContain("Polymarket Whale Tracker");
  });
});

// =============================================================================
// /status Command Tests
// =============================================================================

describe("formatDate", () => {
  it("should return Never for null date", () => {
    expect(formatDate(null)).toBe("Never");
  });

  it("should format valid date", () => {
    const date = new Date("2024-01-15T14:30:00Z");
    const formatted = formatDate(date);
    expect(formatted).toContain("Jan");
    expect(formatted).toContain("15");
    expect(formatted).toContain("2024");
  });

  it("should include time in formatted date", () => {
    const date = new Date("2024-01-15T14:30:00Z");
    const formatted = formatDate(date);
    // Should include time (AM/PM format)
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("escapeMarkdown", () => {
  it("should escape underscores", () => {
    expect(escapeMarkdown("hello_world")).toBe("hello\\_world");
  });

  it("should escape asterisks", () => {
    expect(escapeMarkdown("hello*world")).toBe("hello\\*world");
  });

  it("should escape brackets", () => {
    expect(escapeMarkdown("hello[world]")).toBe("hello\\[world\\]");
  });

  it("should not modify plain text", () => {
    expect(escapeMarkdown("hello world")).toBe("hello world");
  });

  it("should escape multiple special characters", () => {
    const input = "hello_world *bold* [link]";
    const result = escapeMarkdown(input);
    expect(result).toContain("\\_");
    expect(result).toContain("\\*");
    expect(result).toContain("\\[");
    expect(result).toContain("\\]");
  });
});

describe("getStatusMessage", () => {
  it("should show not subscribed message when not subscribed", () => {
    const message = getStatusMessage("John", false);
    expect(message).toContain("Not Subscribed");
    expect(message).toContain("/start");
    expect(message).toContain("John");
  });

  it("should show subscribed status when subscribed", () => {
    const subscriber = createMockSubscriber({
      isActive: true,
      alertsSent: 42,
      alertPreferences: { whaleAlerts: true, insiderAlerts: false, minTradeValue: 50000 },
    });
    const message = getStatusMessage("John", true, subscriber);
    expect(message).toContain("Subscribed");
    expect(message).toContain("42");
    expect(message).toContain("Whale Alerts");
    expect(message).toContain("Insider Alerts");
  });

  it("should show alert preferences", () => {
    const subscriber = createMockSubscriber({
      isActive: true,
      alertPreferences: { whaleAlerts: true, insiderAlerts: false, minTradeValue: 50000 },
    });
    const message = getStatusMessage("John", true, subscriber);
    expect(message).toContain("ON");
    expect(message).toContain("OFF");
    expect(message).toContain("$50K");
  });

  it("should show statistics", () => {
    const subscriber = createMockSubscriber({
      isActive: true,
      alertsSent: 100,
      lastAlertAt: new Date("2024-01-15T14:30:00Z"),
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    const message = getStatusMessage("John", true, subscriber);
    expect(message).toContain("100");
    expect(message).toContain("Statistics");
    expect(message).toContain("Alerts Received");
  });

  it("should escape display name", () => {
    const message = getStatusMessage("John_Doe", false);
    expect(message).toContain("John\\_Doe");
  });
});

describe("getSubscriptionStatus", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should return error when no chat", async () => {
    const ctx = createMockContext({ noChat: true });

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat information available");
  });

  it("should return not subscribed when subscriber not found", async () => {
    const ctx = createMockContext();
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.isSubscribed).toBe(false);
  });

  it("should return subscribed when subscriber is active", async () => {
    const ctx = createMockContext();
    const subscriber = createMockSubscriber({ isActive: true, isBlocked: false });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.isSubscribed).toBe(true);
    expect(result.subscriber).toBe(subscriber);
  });

  it("should return not subscribed when subscriber is inactive", async () => {
    const ctx = createMockContext();
    const subscriber = createMockSubscriber({ isActive: false });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.isSubscribed).toBe(false);
    expect(result.subscriber).toBe(subscriber);
  });

  it("should return not subscribed when subscriber is blocked", async () => {
    const ctx = createMockContext();
    const subscriber = createMockSubscriber({ isActive: true, isBlocked: true });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(true);
    expect(result.isSubscribed).toBe(false);
  });

  it("should handle database errors", async () => {
    const ctx = createMockContext();
    vi.mocked(mockService.findByChatId).mockRejectedValue(new Error("DB error"));

    const result = await getSubscriptionStatus(ctx, mockService);

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB error");
  });
});

describe("handleStatusCommand", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should reply with subscribed status", async () => {
    const ctx = createMockContext({ firstName: "John" });
    const subscriber = createMockSubscriber({ isActive: true, alertsSent: 5 });
    vi.mocked(mockService.findByChatId).mockResolvedValue(subscriber);

    await handleStatusCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Subscribed"),
      { parse_mode: "Markdown" }
    );
  });

  it("should reply with not subscribed status", async () => {
    const ctx = createMockContext({ firstName: "John" });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    await handleStatusCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Not Subscribed"),
      { parse_mode: "Markdown" }
    );
  });

  it("should show error on database failure", async () => {
    const ctx = createMockContext();
    vi.mocked(mockService.findByChatId).mockRejectedValue(new Error("DB error"));

    await handleStatusCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("error")
    );
  });

  it("should use display name from context", async () => {
    const ctx = createMockContext({ firstName: "Jane", lastName: "Smith" });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    await handleStatusCommand(ctx, mockService);

    const message = vi.mocked(ctx.reply).mock.calls[0]?.[0] as string;
    expect(message).toContain("Jane");
  });
});

describe("createStatusCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createStatusCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = createMockContext({ firstName: "John" });
    vi.mocked(mockService.findByChatId).mockResolvedValue(null);

    const handler = createStatusCommandHandler(mockService);
    await handler(ctx);

    expect(mockService.findByChatId).toHaveBeenCalled();
  });
});

// =============================================================================
// /stats Command Tests (Admin Only)
// =============================================================================

describe("checkIsAdmin", () => {
  it("should return not admin when no from", () => {
    const ctx = createMockContext({ noFrom: true });

    const result = checkIsAdmin(ctx);

    expect(result.isAdmin).toBe(false);
    expect(result.reason).toBe("No user information available");
  });

  it("should return admin for user in admin list", () => {
    const ctx = createMockContext({ chatId: 12345 });

    const result = checkIsAdmin(ctx);

    expect(result.isAdmin).toBe(true);
    expect(result.userId).toBe(12345);
  });

  it("should return not admin for user not in admin list", () => {
    const ctx = createMockContext({ chatId: 99999 });

    const result = checkIsAdmin(ctx);

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe(99999);
    expect(result.reason).toBe("User ID not in admin list");
  });
});

describe("getUnauthorizedMessage", () => {
  it("should return access denied message", () => {
    const message = getUnauthorizedMessage();
    expect(message).toContain("Access Denied");
    expect(message).toContain("administrators");
  });
});

describe("getStatsMessage", () => {
  it("should include subscriber stats", () => {
    const stats = {
      total: 100,
      active: 80,
      blocked: 5,
      byType: {
        PRIVATE: 50,
        GROUP: 20,
        SUPERGROUP: 25,
        CHANNEL: 5,
      },
    };
    const message = getStatsMessage(stats, "1d 2h");

    expect(message).toContain("100");
    expect(message).toContain("80");
    expect(message).toContain("5");
  });

  it("should calculate inactive subscribers", () => {
    const stats = {
      total: 100,
      active: 80,
      blocked: 5,
      byType: { PRIVATE: 0, GROUP: 0, SUPERGROUP: 0, CHANNEL: 0 },
    };
    const message = getStatsMessage(stats, "1h");

    // Inactive = total - active - blocked = 100 - 80 - 5 = 15
    expect(message).toContain("15");
  });

  it("should include by type breakdown", () => {
    const stats = {
      total: 100,
      active: 80,
      blocked: 0,
      byType: {
        PRIVATE: 50,
        GROUP: 20,
        SUPERGROUP: 25,
        CHANNEL: 5,
      },
    };
    const message = getStatsMessage(stats, "1h");

    expect(message).toContain("Private Chats: 50");
    expect(message).toContain("Groups: 20");
    expect(message).toContain("Supergroups: 25");
    expect(message).toContain("Channels: 5");
  });

  it("should include uptime", () => {
    const stats = {
      total: 0,
      active: 0,
      blocked: 0,
      byType: { PRIVATE: 0, GROUP: 0, SUPERGROUP: 0, CHANNEL: 0 },
    };
    const message = getStatsMessage(stats, "2d 5h 30m");

    expect(message).toContain("2d 5h 30m");
  });

  it("should show online status", () => {
    const stats = {
      total: 0,
      active: 0,
      blocked: 0,
      byType: { PRIVATE: 0, GROUP: 0, SUPERGROUP: 0, CHANNEL: 0 },
    };
    const message = getStatsMessage(stats, "1h");

    expect(message).toContain("Online");
  });

  it("should mention broadcast command", () => {
    const stats = {
      total: 0,
      active: 0,
      blocked: 0,
      byType: { PRIVATE: 0, GROUP: 0, SUPERGROUP: 0, CHANNEL: 0 },
    };
    const message = getStatsMessage(stats, "1h");

    expect(message).toContain("/broadcast");
  });
});

describe("getUptimeString", () => {
  it("should return formatted uptime", () => {
    // Note: This tests the function returns a string in expected format
    const uptime = getUptimeString();
    expect(typeof uptime).toBe("string");
    expect(uptime.length).toBeGreaterThan(0);
  });

  it("should return < 1m for very short uptime", () => {
    // process.uptime() returns seconds, mock a very short process
    // In practice this is hard to test without mocking process.uptime
    const uptime = getUptimeString();
    // Should return something like "< 1m" or "Xm" or "Xh Xm" etc
    expect(uptime).toMatch(/^(\d+d\s*)?(\d+h\s*)?(\d+m)?$|^< 1m$/);
  });
});

describe("handleStatsCommand", () => {
  let mockService: TelegramSubscriberService;

  beforeEach(() => {
    mockService = createMockSubscriberService();
    vi.clearAllMocks();
  });

  it("should deny access to non-admin users", async () => {
    const ctx = createMockContext({ chatId: 99999 }); // Not in admin list

    await handleStatsCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Access Denied"),
      { parse_mode: "Markdown" }
    );
    expect(mockService.getStats).not.toHaveBeenCalled();
  });

  it("should show stats for admin users", async () => {
    const ctx = createMockContext({ chatId: 12345 }); // In admin list
    vi.mocked(mockService.getStats).mockResolvedValue({
      total: 100,
      active: 80,
      blocked: 5,
      byType: {
        PRIVATE: 50,
        GROUP: 20,
        SUPERGROUP: 25,
        CHANNEL: 5,
      },
    });

    await handleStatsCommand(ctx, mockService);

    expect(mockService.getStats).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Bot Statistics"),
      { parse_mode: "Markdown" }
    );
  });

  it("should show error on database failure", async () => {
    const ctx = createMockContext({ chatId: 12345 });
    vi.mocked(mockService.getStats).mockRejectedValue(new Error("DB error"));

    await handleStatsCommand(ctx, mockService);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("error")
    );
  });
});

describe("createStatsCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createStatsCommandHandler();
    expect(typeof handler).toBe("function");
  });

  it("should use provided subscriber service", async () => {
    const mockService = createMockSubscriberService();
    const ctx = createMockContext({ chatId: 12345 });
    vi.mocked(mockService.getStats).mockResolvedValue({
      total: 0,
      active: 0,
      blocked: 0,
      byType: { PRIVATE: 0, GROUP: 0, SUPERGROUP: 0, CHANNEL: 0 },
    });

    const handler = createStatsCommandHandler(mockService);
    await handler(ctx);

    expect(mockService.getStats).toHaveBeenCalled();
  });
});

// =============================================================================
// /broadcast Command Tests (Admin Only)
// =============================================================================

describe("parseBroadcastMessage", () => {
  it("should parse simple broadcast message", () => {
    const result = parseBroadcastMessage("/broadcast Hello World!");
    expect(result).toBe("Hello World!");
  });

  it("should parse multiline broadcast message", () => {
    const result = parseBroadcastMessage("/broadcast Line 1\nLine 2\nLine 3");
    expect(result).toBe("Line 1\nLine 2\nLine 3");
  });

  it("should parse broadcast with bot mention", () => {
    const result = parseBroadcastMessage("/broadcast@mybot Hello!");
    expect(result).toBe("Hello!");
  });

  it("should return null for empty broadcast", () => {
    const result = parseBroadcastMessage("/broadcast");
    expect(result).toBeNull();
  });

  it("should return null for broadcast with only whitespace", () => {
    const result = parseBroadcastMessage("/broadcast   ");
    expect(result).toBeNull();
  });

  it("should return null for non-broadcast commands", () => {
    const result = parseBroadcastMessage("/start");
    expect(result).toBeNull();
  });

  it("should trim leading and trailing whitespace", () => {
    const result = parseBroadcastMessage("/broadcast   Hello!   ");
    expect(result).toBe("Hello!");
  });
});

describe("getBroadcastReportMessage", () => {
  it("should show success emoji when no failures", () => {
    const result: AdminBroadcastResult = {
      success: true,
      sent: 10,
      failed: 0,
      total: 10,
      errors: [],
      duration: 100,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("✅");
    expect(message).toContain("Broadcast Complete");
  });

  it("should show warning emoji when there are failures", () => {
    const result: AdminBroadcastResult = {
      success: false,
      sent: 8,
      failed: 2,
      total: 10,
      errors: [
        { chatId: BigInt(1), error: "Error 1" },
        { chatId: BigInt(2), error: "Error 2" },
      ],
      duration: 100,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("⚠️");
  });

  it("should include statistics", () => {
    const result: AdminBroadcastResult = {
      success: true,
      sent: 10,
      failed: 0,
      total: 10,
      errors: [],
      duration: 500,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("Total subscribers: 10");
    expect(message).toContain("Successfully sent: 10");
    expect(message).toContain("Failed: 0");
    expect(message).toContain("100%");
    expect(message).toContain("500ms");
  });

  it("should show errors when present (5 or fewer)", () => {
    const result: AdminBroadcastResult = {
      success: false,
      sent: 3,
      failed: 2,
      total: 5,
      errors: [
        { chatId: BigInt(111), error: "User blocked" },
        { chatId: BigInt(222), error: "Chat not found" },
      ],
      duration: 100,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("Errors:");
    expect(message).toContain("Chat 111");
    expect(message).toContain("Chat 222");
  });

  it("should limit errors shown to 5 when more than 5 failures", () => {
    const errors = Array.from({ length: 10 }, (_, i) => ({
      chatId: BigInt(i + 1),
      error: `Error ${i + 1}`,
    }));
    const result: AdminBroadcastResult = {
      success: false,
      sent: 0,
      failed: 10,
      total: 10,
      errors,
      duration: 100,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("10 failures (showing first 5)");
    expect(message).toContain("Chat 1");
    expect(message).toContain("Chat 5");
    expect(message).not.toContain("Chat 6");
  });

  it("should calculate success rate correctly", () => {
    const result: AdminBroadcastResult = {
      success: false,
      sent: 7,
      failed: 3,
      total: 10,
      errors: [],
      duration: 100,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("70%");
  });

  it("should handle zero total subscribers", () => {
    const result: AdminBroadcastResult = {
      success: true,
      sent: 0,
      failed: 0,
      total: 0,
      errors: [],
      duration: 50,
    };
    const message = getBroadcastReportMessage(result);
    expect(message).toContain("Success rate: 0%");
  });
});

describe("getEmptyBroadcastMessage", () => {
  it("should include usage instructions", () => {
    const message = getEmptyBroadcastMessage();
    expect(message).toContain("/broadcast <message>");
    expect(message).toContain("Usage");
  });

  it("should include example", () => {
    const message = getEmptyBroadcastMessage();
    expect(message).toContain("Example");
    expect(message).toContain("/broadcast");
  });
});

describe("handleBroadcastCommand", () => {
  let mockService: TelegramSubscriberService;
  let mockBotClient: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockService = createMockSubscriberService();
    mockBotClient = {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 1 }),
    };
    vi.clearAllMocks();
  });

  it("should deny access to non-admin users", async () => {
    const ctx = createMockContext({ chatId: 99999 }); // Not in admin list
    (ctx as { message?: { text?: string } }).message = { text: "/broadcast Hello" };

    await handleBroadcastCommand(ctx, mockService, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Access Denied"),
      { parse_mode: "Markdown" }
    );
    expect(mockService.findActive).not.toHaveBeenCalled();
  });

  it("should show usage for empty broadcast message", async () => {
    const ctx = createMockContext({ chatId: 12345 }); // Admin user
    (ctx as { message?: { text?: string } }).message = { text: "/broadcast" };

    await handleBroadcastCommand(ctx, mockService, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Usage"),
      { parse_mode: "Markdown" }
    );
  });

  it("should broadcast message to active subscribers", async () => {
    const ctx = createMockContext({ chatId: 12345 });
    (ctx as { message?: { text?: string } }).message = { text: "/broadcast Hello everyone!" };
    (ctx as unknown as { api: { editMessageText: ReturnType<typeof vi.fn> } }).api = {
      editMessageText: vi.fn().mockResolvedValue({}),
    };

    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
    ];
    vi.mocked(mockService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockService.incrementAlertsSent).mockResolvedValue(createMockSubscriber());

    await handleBroadcastCommand(ctx, mockService, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    // Should send to both subscribers
    expect(mockBotClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "1",
      expect.stringContaining("Hello everyone!"),
      expect.any(Object)
    );
    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "2",
      expect.stringContaining("Hello everyone!"),
      expect.any(Object)
    );
  });

  it("should increment alerts sent counter on success", async () => {
    const ctx = createMockContext({ chatId: 12345 });
    (ctx as { message?: { text?: string } }).message = { text: "/broadcast Test" };
    (ctx as unknown as { api: { editMessageText: ReturnType<typeof vi.fn> } }).api = {
      editMessageText: vi.fn().mockResolvedValue({}),
    };

    const subscribers = [createMockSubscriber({ chatId: BigInt(1) })];
    vi.mocked(mockService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockService.incrementAlertsSent).mockResolvedValue(createMockSubscriber());

    await handleBroadcastCommand(ctx, mockService, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(mockService.incrementAlertsSent).toHaveBeenCalledWith(BigInt(1));
  });
});

describe("createBroadcastCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createBroadcastCommandHandler();
    expect(typeof handler).toBe("function");
  });
});

// =============================================================================
// /test Command Tests (Admin Only)
// =============================================================================

describe("getTestAlertMessage", () => {
  it("should return test alert message with markdown", () => {
    const message = getTestAlertMessage();
    expect(message).toContain("Test Whale Trade Alert");
    expect(message).toContain("$1,234,567");
    expect(message).toContain("0xTest...1234");
  });

  it("should include severity and type", () => {
    const message = getTestAlertMessage();
    expect(message).toContain("Critical");
    expect(message).toContain("Whale Trade");
  });

  it("should include test disclaimer", () => {
    const message = getTestAlertMessage();
    expect(message).toContain("test alert");
    expect(message).toContain("alerts are working correctly");
  });

  it("should include timestamp", () => {
    const message = getTestAlertMessage();
    // Should have a timestamp
    expect(message).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("handleTestCommand", () => {
  let mockBotClient: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockBotClient = {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 123 }),
    };
    vi.clearAllMocks();
  });

  it("should deny access to non-admin users", async () => {
    const ctx = createMockContext({ chatId: 99999 }); // Not in admin list

    const result = await handleTestCommand(ctx, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Access Denied"),
      { parse_mode: "Markdown" }
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });

  it("should send test alert for admin users", async () => {
    const ctx = createMockContext({ chatId: 12345 }); // Admin user

    const result = await handleTestCommand(ctx, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "12345",
      expect.stringContaining("Test Whale Trade Alert"),
      expect.objectContaining({ parseMode: "MarkdownV2" })
    );
    expect(result.success).toBe(true);
    expect(result.messageId).toBe(123);
  });

  it("should return error when bot client fails", async () => {
    const ctx = createMockContext({ chatId: 12345 });
    mockBotClient.sendMessage.mockResolvedValue({ success: false, error: "Network error" });

    const result = await handleTestCommand(ctx, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("should return error when no chat ID", async () => {
    const ctx = createMockContext({ noChat: true, chatId: 12345 });
    // Make sure from has admin ID even though chat is null
    (ctx as unknown as { from: { id: number } }).from = { id: 12345, is_bot: false, first_name: "Admin" } as unknown as { id: number };

    const result = await handleTestCommand(ctx, mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No chat ID available");
  });
});

describe("createTestCommandHandler", () => {
  it("should create a handler function", () => {
    const handler = createTestCommandHandler();
    expect(typeof handler).toBe("function");
  });
});

describe("broadcastMessage", () => {
  let mockService: TelegramSubscriberService;
  let mockBotClient: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockService = createMockSubscriberService();
    mockBotClient = {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 1 }),
    };
    vi.clearAllMocks();
  });

  it("should broadcast to all active subscribers", async () => {
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
      createMockSubscriber({ chatId: BigInt(3) }),
    ];
    vi.mocked(mockService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockService.incrementAlertsSent).mockResolvedValue(createMockSubscriber());

    const result = await broadcastMessage(
      "Test message",
      mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient,
      mockService
    );

    expect(result.total).toBe(3);
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
  });

  it("should handle send failures gracefully", async () => {
    const subscribers = [
      createMockSubscriber({ chatId: BigInt(1) }),
      createMockSubscriber({ chatId: BigInt(2) }),
    ];
    vi.mocked(mockService.findActive).mockResolvedValue(subscribers);
    mockBotClient.sendMessage
      .mockResolvedValueOnce({ success: true, messageId: 1 })
      .mockResolvedValueOnce({ success: false, error: "User blocked" });

    const result = await broadcastMessage(
      "Test message",
      mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient,
      mockService
    );

    expect(result.total).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      chatId: BigInt(2),
      error: "User blocked",
    });
  });

  it("should format message with announcement header", async () => {
    const subscribers = [createMockSubscriber({ chatId: BigInt(1) })];
    vi.mocked(mockService.findActive).mockResolvedValue(subscribers);
    vi.mocked(mockService.incrementAlertsSent).mockResolvedValue(createMockSubscriber());

    await broadcastMessage(
      "Test message",
      mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient,
      mockService
    );

    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "1",
      expect.stringContaining("Announcement"),
      expect.any(Object)
    );
    expect(mockBotClient.sendMessage).toHaveBeenCalledWith(
      "1",
      expect.stringContaining("Test message"),
      expect.any(Object)
    );
  });

  it("should return duration in milliseconds", async () => {
    vi.mocked(mockService.findActive).mockResolvedValue([]);

    const result = await broadcastMessage(
      "Test",
      mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient,
      mockService
    );

    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty subscriber list", async () => {
    vi.mocked(mockService.findActive).mockResolvedValue([]);

    const result = await broadcastMessage(
      "Test",
      mockBotClient as unknown as import("../../src/telegram/bot").TelegramBotClient,
      mockService
    );

    expect(result.total).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
  });
});
