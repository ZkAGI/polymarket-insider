/**
 * Telegram Subscriber Database Service Tests
 *
 * Unit tests for the TelegramSubscriberService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TelegramSubscriber, PrismaClient } from "@prisma/client";
import { TelegramChatType, AlertSeverity } from "@prisma/client";
import {
  TelegramSubscriberService,
  createTelegramSubscriberService,
  type CreateSubscriberInput,
  type UpdateSubscriberInput,
  type SubscriberFilters,
  type AlertPreferences,
} from "../../src/db/telegram-subscribers";

// Mock subscriber data
const mockPrivateSubscriber: TelegramSubscriber = {
  id: "sub-1",
  chatId: BigInt(123456789),
  chatType: TelegramChatType.PRIVATE,
  username: "testuser",
  firstName: "Test",
  lastName: "User",
  title: null,
  languageCode: "en",
  isActive: true,
  isAdmin: false,
  alertPreferences: null,
  minSeverity: AlertSeverity.INFO,
  isBlocked: false,
  alertsSent: 10,
  lastAlertAt: new Date("2024-06-14T12:00:00Z"),
  deactivationReason: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
};

const mockGroupSubscriber: TelegramSubscriber = {
  id: "sub-2",
  chatId: BigInt(-987654321),
  chatType: TelegramChatType.GROUP,
  username: null,
  firstName: null,
  lastName: null,
  title: "Crypto Alerts Group",
  languageCode: null,
  isActive: true,
  isAdmin: false,
  alertPreferences: { whaleAlerts: true, minTradeValue: 10000 },
  minSeverity: AlertSeverity.MEDIUM,
  isBlocked: false,
  alertsSent: 50,
  lastAlertAt: new Date("2024-06-14T18:00:00Z"),
  deactivationReason: null,
  createdAt: new Date("2024-02-15T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
};

const mockAdminSubscriber: TelegramSubscriber = {
  ...mockPrivateSubscriber,
  id: "sub-admin",
  chatId: BigInt(999888777),
  username: "admin_user",
  firstName: "Admin",
  isAdmin: true,
  alertsSent: 100,
};

const mockBlockedSubscriber: TelegramSubscriber = {
  ...mockPrivateSubscriber,
  id: "sub-blocked",
  chatId: BigInt(111222333),
  username: "blocked_user",
  isActive: false,
  isBlocked: true,
  deactivationReason: "User blocked the bot",
};

// Mock Prisma client
function createMockPrismaClient() {
  return {
    telegramSubscriber: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe("TelegramSubscriberService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: TelegramSubscriberService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrismaClient();
    service = new TelegramSubscriberService(mockPrisma);
  });

  describe("constructor and factory", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new TelegramSubscriberService(customPrisma);
      expect(customService).toBeInstanceOf(TelegramSubscriberService);
    });

    it("should create service via factory function", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createTelegramSubscriberService(customPrisma);
      expect(customService).toBeInstanceOf(TelegramSubscriberService);
    });
  });

  describe("create", () => {
    it("should create a new private subscriber", async () => {
      const input: CreateSubscriberInput = {
        chatId: BigInt(123456789),
        chatType: TelegramChatType.PRIVATE,
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        languageCode: "en",
      };

      vi.mocked(mockPrisma.telegramSubscriber.create).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.create(input);

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          chatId: BigInt(123456789),
          chatType: TelegramChatType.PRIVATE,
          username: "testuser",
          isActive: true,
          isAdmin: false,
          minSeverity: AlertSeverity.INFO,
        }),
      });
    });

    it("should create a group subscriber", async () => {
      const input: CreateSubscriberInput = {
        chatId: BigInt(-987654321),
        chatType: TelegramChatType.GROUP,
        title: "Crypto Alerts Group",
      };

      vi.mocked(mockPrisma.telegramSubscriber.create).mockResolvedValue(mockGroupSubscriber);

      const result = await service.create(input);

      expect(result.chatType).toBe(TelegramChatType.GROUP);
      expect(result.title).toBe("Crypto Alerts Group");
    });

    it("should create subscriber with custom alert preferences", async () => {
      const preferences: AlertPreferences = {
        whaleAlerts: true,
        insiderAlerts: true,
        minTradeValue: 5000,
      };

      const input: CreateSubscriberInput = {
        chatId: BigInt(123456789),
        chatType: TelegramChatType.PRIVATE,
        alertPreferences: preferences,
        minSeverity: AlertSeverity.HIGH,
      };

      vi.mocked(mockPrisma.telegramSubscriber.create).mockResolvedValue({
        ...mockPrivateSubscriber,
        alertPreferences: preferences as unknown as TelegramSubscriber["alertPreferences"],
        minSeverity: AlertSeverity.HIGH,
      });

      const result = await service.create(input);

      expect(mockPrisma.telegramSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertPreferences: preferences,
          minSeverity: AlertSeverity.HIGH,
        }),
      });
      expect(result.minSeverity).toBe(AlertSeverity.HIGH);
    });

    it("should create an admin subscriber", async () => {
      const input: CreateSubscriberInput = {
        chatId: BigInt(999888777),
        chatType: TelegramChatType.PRIVATE,
        isAdmin: true,
      };

      vi.mocked(mockPrisma.telegramSubscriber.create).mockResolvedValue(mockAdminSubscriber);

      const result = await service.create(input);

      expect(result.isAdmin).toBe(true);
    });
  });

  describe("findById", () => {
    it("should find subscriber by ID", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.findById("sub-1");

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.findUnique).toHaveBeenCalledWith({
        where: { id: "sub-1" },
      });
    });

    it("should return null for non-existent subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(null);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByChatId", () => {
    it("should find subscriber by chat ID", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.findByChatId(BigInt(123456789));

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.findUnique).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
      });
    });

    it("should return null for non-existent chat ID", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(null);

      const result = await service.findByChatId(BigInt(999999999));

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update subscriber by ID", async () => {
      const input: UpdateSubscriberInput = {
        username: "newusername",
        isActive: false,
      };

      const updatedSubscriber = { ...mockPrivateSubscriber, username: "newusername", isActive: false };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(updatedSubscriber);

      const result = await service.update("sub-1", input);

      expect(result.username).toBe("newusername");
      expect(result.isActive).toBe(false);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          username: "newusername",
          isActive: false,
        }),
      });
    });
  });

  describe("updateByChatId", () => {
    it("should update subscriber by chat ID", async () => {
      const input: UpdateSubscriberInput = {
        minSeverity: AlertSeverity.HIGH,
      };

      const updatedSubscriber = { ...mockPrivateSubscriber, minSeverity: AlertSeverity.HIGH };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(updatedSubscriber);

      const result = await service.updateByChatId(BigInt(123456789), input);

      expect(result.minSeverity).toBe(AlertSeverity.HIGH);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        data: expect.objectContaining({
          minSeverity: AlertSeverity.HIGH,
        }),
      });
    });
  });

  describe("delete", () => {
    it("should delete subscriber by ID", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.delete).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.delete("sub-1");

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.delete).toHaveBeenCalledWith({
        where: { id: "sub-1" },
      });
    });
  });

  describe("deleteByChatId", () => {
    it("should delete subscriber by chat ID", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.delete).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.deleteByChatId(BigInt(123456789));

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.delete).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
      });
    });
  });

  describe("upsert", () => {
    it("should create new subscriber if not exists", async () => {
      const input: CreateSubscriberInput = {
        chatId: BigInt(123456789),
        chatType: TelegramChatType.PRIVATE,
        username: "testuser",
      };

      vi.mocked(mockPrisma.telegramSubscriber.upsert).mockResolvedValue(mockPrivateSubscriber);

      const result = await service.upsert(input);

      expect(result).toEqual(mockPrivateSubscriber);
      expect(mockPrisma.telegramSubscriber.upsert).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        create: expect.objectContaining({
          chatId: BigInt(123456789),
          chatType: TelegramChatType.PRIVATE,
        }),
        update: expect.objectContaining({
          username: "testuser",
        }),
      });
    });

    it("should update existing subscriber", async () => {
      const input: CreateSubscriberInput = {
        chatId: BigInt(123456789),
        chatType: TelegramChatType.PRIVATE,
        username: "updateduser",
        firstName: "Updated",
      };

      const updatedSubscriber = { ...mockPrivateSubscriber, username: "updateduser", firstName: "Updated" };
      vi.mocked(mockPrisma.telegramSubscriber.upsert).mockResolvedValue(updatedSubscriber);

      const result = await service.upsert(input);

      expect(result.username).toBe("updateduser");
      expect(result.firstName).toBe("Updated");
    });
  });

  describe("findMany", () => {
    it("should find subscribers with default options", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber, mockGroupSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(2);

      const result = await service.findMany();

      expect(result.subscribers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by chat type", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        chatType: TelegramChatType.PRIVATE,
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            chatType: TelegramChatType.PRIVATE,
          }),
        })
      );
    });

    it("should filter by multiple chat types", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber, mockGroupSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(2);

      const filters: SubscriberFilters = {
        chatTypes: [TelegramChatType.PRIVATE, TelegramChatType.GROUP],
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            chatType: { in: [TelegramChatType.PRIVATE, TelegramChatType.GROUP] },
          }),
        })
      );
    });

    it("should filter by active status", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        isActive: true,
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it("should filter by username contains", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        usernameContains: "test",
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            username: { contains: "test", mode: "insensitive" },
          }),
        })
      );
    });

    it("should support pagination", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(10);

      const result = await service.findMany({}, undefined, { skip: 0, take: 1 });

      expect(result.subscribers).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 1,
        })
      );
    });

    it("should support sorting", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      await service.findMany({}, { field: "alertsSent", direction: "desc" });

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { alertsSent: "desc" },
        })
      );
    });
  });

  describe("findActive", () => {
    it("should find all active non-blocked subscribers", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber, mockGroupSubscriber]);

      const result = await service.findActive();

      expect(result).toHaveLength(2);
      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isBlocked: false,
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findActiveByType", () => {
    it("should find active subscribers by chat type", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);

      const result = await service.findActiveByType(TelegramChatType.PRIVATE);

      expect(result).toHaveLength(1);
      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith({
        where: {
          chatType: TelegramChatType.PRIVATE,
          isActive: true,
          isBlocked: false,
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findAdmins", () => {
    it("should find all admin subscribers", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockAdminSubscriber]);

      const result = await service.findAdmins();

      expect(result).toHaveLength(1);
      expect(result[0]?.isAdmin).toBe(true);
      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith({
        where: {
          isAdmin: true,
          isActive: true,
          isBlocked: false,
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("activate", () => {
    it("should activate a subscriber", async () => {
      const activatedSubscriber = { ...mockBlockedSubscriber, isActive: true, deactivationReason: null };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(activatedSubscriber);

      const result = await service.activate(BigInt(111222333));

      expect(result.isActive).toBe(true);
      expect(result.deactivationReason).toBeNull();
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(111222333) },
        data: {
          isActive: true,
          deactivationReason: null,
        },
      });
    });
  });

  describe("deactivate", () => {
    it("should deactivate a subscriber", async () => {
      const deactivatedSubscriber = { ...mockPrivateSubscriber, isActive: false, deactivationReason: "User requested" };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(deactivatedSubscriber);

      const result = await service.deactivate(BigInt(123456789), "User requested");

      expect(result.isActive).toBe(false);
      expect(result.deactivationReason).toBe("User requested");
    });

    it("should deactivate without reason", async () => {
      const deactivatedSubscriber = { ...mockPrivateSubscriber, isActive: false, deactivationReason: null };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(deactivatedSubscriber);

      await service.deactivate(BigInt(123456789));

      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        data: {
          isActive: false,
          deactivationReason: undefined,
        },
      });
    });
  });

  describe("markBlocked", () => {
    it("should mark subscriber as blocked", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(mockBlockedSubscriber);

      const result = await service.markBlocked(BigInt(111222333));

      expect(result.isBlocked).toBe(true);
      expect(result.isActive).toBe(false);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(111222333) },
        data: {
          isBlocked: true,
          isActive: false,
          deactivationReason: "User blocked the bot",
        },
      });
    });
  });

  describe("incrementAlertsSent", () => {
    it("should increment alerts sent count", async () => {
      const updatedSubscriber = { ...mockPrivateSubscriber, alertsSent: 11, lastAlertAt: new Date() };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(updatedSubscriber);

      const result = await service.incrementAlertsSent(BigInt(123456789));

      expect(result.alertsSent).toBe(11);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        data: {
          alertsSent: { increment: 1 },
          lastAlertAt: expect.any(Date),
        },
      });
    });
  });

  describe("updateAlertPreferences", () => {
    it("should update alert preferences", async () => {
      const preferences: AlertPreferences = {
        whaleAlerts: true,
        insiderAlerts: false,
        minTradeValue: 25000,
      };

      const updatedSubscriber = { ...mockPrivateSubscriber, alertPreferences: preferences as unknown as TelegramSubscriber["alertPreferences"] };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(updatedSubscriber);

      const result = await service.updateAlertPreferences(BigInt(123456789), preferences);

      expect(result.alertPreferences).toEqual(preferences);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        data: {
          alertPreferences: preferences,
        },
      });
    });
  });

  describe("updateMinSeverity", () => {
    it("should update minimum severity", async () => {
      const updatedSubscriber = { ...mockPrivateSubscriber, minSeverity: AlertSeverity.CRITICAL };
      vi.mocked(mockPrisma.telegramSubscriber.update).mockResolvedValue(updatedSubscriber);

      const result = await service.updateMinSeverity(BigInt(123456789), AlertSeverity.CRITICAL);

      expect(result.minSeverity).toBe(AlertSeverity.CRITICAL);
      expect(mockPrisma.telegramSubscriber.update).toHaveBeenCalledWith({
        where: { chatId: BigInt(123456789) },
        data: {
          minSeverity: AlertSeverity.CRITICAL,
        },
      });
    });
  });

  describe("count", () => {
    it("should count all subscribers", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(5);

      const result = await service.count();

      expect(result).toBe(5);
    });

    it("should count with filters", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(3);

      const result = await service.count({ isActive: true });

      expect(result).toBe(3);
      expect(mockPrisma.telegramSubscriber.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  describe("getStats", () => {
    it("should return subscriber statistics", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.count)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8)  // active
        .mockResolvedValueOnce(2); // blocked

      vi.mocked(mockPrisma.telegramSubscriber.groupBy).mockResolvedValue([
        { chatType: TelegramChatType.PRIVATE, _count: 6 },
        { chatType: TelegramChatType.GROUP, _count: 3 },
        { chatType: TelegramChatType.SUPERGROUP, _count: 1 },
      ] as never);

      const result = await service.getStats();

      expect(result.total).toBe(10);
      expect(result.active).toBe(8);
      expect(result.blocked).toBe(2);
      expect(result.byType[TelegramChatType.PRIVATE]).toBe(6);
      expect(result.byType[TelegramChatType.GROUP]).toBe(3);
      expect(result.byType[TelegramChatType.SUPERGROUP]).toBe(1);
      expect(result.byType[TelegramChatType.CHANNEL]).toBe(0);
    });
  });

  describe("isSubscribed", () => {
    it("should return true for active non-blocked subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue({
        isActive: true,
        isBlocked: false,
      } as TelegramSubscriber);

      const result = await service.isSubscribed(BigInt(123456789));

      expect(result).toBe(true);
    });

    it("should return false for inactive subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue({
        isActive: false,
        isBlocked: false,
      } as TelegramSubscriber);

      const result = await service.isSubscribed(BigInt(123456789));

      expect(result).toBe(false);
    });

    it("should return false for blocked subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue({
        isActive: true,
        isBlocked: true,
      } as TelegramSubscriber);

      const result = await service.isSubscribed(BigInt(123456789));

      expect(result).toBe(false);
    });

    it("should return false for non-existent subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(null);

      const result = await service.isSubscribed(BigInt(999999999));

      expect(result).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("should return true for admin subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue({
        isAdmin: true,
      } as TelegramSubscriber);

      const result = await service.isAdmin(BigInt(999888777));

      expect(result).toBe(true);
    });

    it("should return false for non-admin subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue({
        isAdmin: false,
      } as TelegramSubscriber);

      const result = await service.isAdmin(BigInt(123456789));

      expect(result).toBe(false);
    });

    it("should return false for non-existent subscriber", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findUnique).mockResolvedValue(null);

      const result = await service.isAdmin(BigInt(999999999));

      expect(result).toBe(false);
    });
  });

  describe("date filters", () => {
    it("should filter by created after", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockGroupSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        createdAfter: new Date("2024-02-01T00:00:00Z"),
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: filters.createdAfter },
          }),
        })
      );
    });

    it("should filter by created before", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        createdBefore: new Date("2024-02-01T00:00:00Z"),
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lte: filters.createdBefore },
          }),
        })
      );
    });

    it("should filter by date range", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        createdAfter: new Date("2024-01-01T00:00:00Z"),
        createdBefore: new Date("2024-03-01T00:00:00Z"),
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: filters.createdAfter,
              lte: filters.createdBefore,
            },
          }),
        })
      );
    });
  });

  describe("hasReceivedAlerts filter", () => {
    it("should filter subscribers who have received alerts", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([mockPrivateSubscriber]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(1);

      const filters: SubscriberFilters = {
        hasReceivedAlerts: true,
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            alertsSent: { gt: 0 },
          }),
        })
      );
    });

    it("should filter subscribers who have not received alerts", async () => {
      vi.mocked(mockPrisma.telegramSubscriber.findMany).mockResolvedValue([]);
      vi.mocked(mockPrisma.telegramSubscriber.count).mockResolvedValue(0);

      const filters: SubscriberFilters = {
        hasReceivedAlerts: false,
      };

      await service.findMany(filters);

      expect(mockPrisma.telegramSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            alertsSent: 0,
          }),
        })
      );
    });
  });
});
