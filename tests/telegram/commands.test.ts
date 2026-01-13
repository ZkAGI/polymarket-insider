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
