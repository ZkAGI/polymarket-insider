/**
 * Telegram Subscriber Database Service
 *
 * CRUD operations and queries for the TelegramSubscriber model.
 * Provides typed interfaces for managing Telegram bot subscribers.
 */

import type { TelegramSubscriber, Prisma, PrismaClient } from "@prisma/client";
import { TelegramChatType, AlertSeverity } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { TelegramSubscriber };
export { TelegramChatType, AlertSeverity };

/**
 * Alert preferences structure for subscribers
 */
export interface AlertPreferences {
  /** Array of enabled alert types */
  enabledTypes?: string[];
  /** Array of disabled alert types */
  disabledTypes?: string[];
  /** Whether to receive whale alerts */
  whaleAlerts?: boolean;
  /** Whether to receive insider alerts */
  insiderAlerts?: boolean;
  /** Whether to receive market resolution alerts */
  marketResolutionAlerts?: boolean;
  /** Whether to receive price movement alerts */
  priceMovementAlerts?: boolean;
  /** Minimum trade value to alert on (in USD) */
  minTradeValue?: number;
  /** Markets to monitor (empty = all) */
  watchedMarkets?: string[];
  /** Wallets to monitor (empty = none specific) */
  watchedWallets?: string[];
}

/**
 * Input for creating a new subscriber
 */
export interface CreateSubscriberInput {
  /** Telegram chat ID */
  chatId: bigint;
  /** Type of chat */
  chatType: TelegramChatType;
  /** Username (without @) */
  username?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Group/channel title */
  title?: string;
  /** Language code */
  languageCode?: string;
  /** Whether active */
  isActive?: boolean;
  /** Whether admin */
  isAdmin?: boolean;
  /** Alert preferences */
  alertPreferences?: AlertPreferences;
  /** Minimum severity */
  minSeverity?: AlertSeverity;
}

/**
 * Input for updating an existing subscriber
 */
export interface UpdateSubscriberInput {
  /** Username (without @) */
  username?: string | null;
  /** First name */
  firstName?: string | null;
  /** Last name */
  lastName?: string | null;
  /** Group/channel title */
  title?: string | null;
  /** Language code */
  languageCode?: string | null;
  /** Whether active */
  isActive?: boolean;
  /** Whether admin */
  isAdmin?: boolean;
  /** Alert preferences */
  alertPreferences?: AlertPreferences | Prisma.NullableJsonNullValueInput;
  /** Minimum severity */
  minSeverity?: AlertSeverity;
  /** Whether blocked */
  isBlocked?: boolean;
  /** Alerts sent count */
  alertsSent?: number;
  /** Last alert timestamp */
  lastAlertAt?: Date | null;
  /** Deactivation reason */
  deactivationReason?: string | null;
}

/**
 * Filters for querying subscribers
 */
export interface SubscriberFilters {
  /** Filter by chat type */
  chatType?: TelegramChatType;
  /** Filter by multiple chat types */
  chatTypes?: TelegramChatType[];
  /** Filter by active status */
  isActive?: boolean;
  /** Filter by admin status */
  isAdmin?: boolean;
  /** Filter by blocked status */
  isBlocked?: boolean;
  /** Filter by minimum severity */
  minSeverity?: AlertSeverity;
  /** Username contains (partial match) */
  usernameContains?: string;
  /** Created after this date */
  createdAfter?: Date;
  /** Created before this date */
  createdBefore?: Date;
  /** Has received at least one alert */
  hasReceivedAlerts?: boolean;
  /** Last alert before this date */
  lastAlertBefore?: Date;
}

/**
 * Sorting options for subscriber queries
 */
export interface SubscriberSortOptions {
  /** Field to sort by */
  field: "createdAt" | "updatedAt" | "alertsSent" | "lastAlertAt" | "chatId";
  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Number of records to skip */
  skip?: number;
  /** Number of records to take */
  take?: number;
}

/**
 * Result of a paginated query
 */
export interface PaginatedSubscribers {
  /** Array of subscribers */
  subscribers: TelegramSubscriber[];
  /** Total count of matching records */
  total: number;
  /** Whether there are more records */
  hasMore: boolean;
}

/**
 * Telegram Subscriber Service
 *
 * Provides CRUD operations and queries for managing Telegram bot subscribers.
 */
export class TelegramSubscriberService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Create a new subscriber
   */
  async create(input: CreateSubscriberInput): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.create({
      data: {
        chatId: input.chatId,
        chatType: input.chatType,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        languageCode: input.languageCode,
        isActive: input.isActive ?? true,
        isAdmin: input.isAdmin ?? false,
        alertPreferences: input.alertPreferences as Prisma.InputJsonValue | undefined,
        minSeverity: input.minSeverity ?? AlertSeverity.INFO,
      },
    });
  }

  /**
   * Find a subscriber by ID
   */
  async findById(id: string): Promise<TelegramSubscriber | null> {
    return this.prisma.telegramSubscriber.findUnique({
      where: { id },
    });
  }

  /**
   * Find a subscriber by chat ID
   */
  async findByChatId(chatId: bigint): Promise<TelegramSubscriber | null> {
    return this.prisma.telegramSubscriber.findUnique({
      where: { chatId },
    });
  }

  /**
   * Update a subscriber by ID
   */
  async update(id: string, input: UpdateSubscriberInput): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { id },
      data: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        languageCode: input.languageCode,
        isActive: input.isActive,
        isAdmin: input.isAdmin,
        alertPreferences: input.alertPreferences as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
        minSeverity: input.minSeverity,
        isBlocked: input.isBlocked,
        alertsSent: input.alertsSent,
        lastAlertAt: input.lastAlertAt,
        deactivationReason: input.deactivationReason,
      },
    });
  }

  /**
   * Update a subscriber by chat ID
   */
  async updateByChatId(chatId: bigint, input: UpdateSubscriberInput): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        languageCode: input.languageCode,
        isActive: input.isActive,
        isAdmin: input.isAdmin,
        alertPreferences: input.alertPreferences as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
        minSeverity: input.minSeverity,
        isBlocked: input.isBlocked,
        alertsSent: input.alertsSent,
        lastAlertAt: input.lastAlertAt,
        deactivationReason: input.deactivationReason,
      },
    });
  }

  /**
   * Delete a subscriber by ID
   */
  async delete(id: string): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.delete({
      where: { id },
    });
  }

  /**
   * Delete a subscriber by chat ID
   */
  async deleteByChatId(chatId: bigint): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.delete({
      where: { chatId },
    });
  }

  /**
   * Upsert a subscriber (create or update)
   */
  async upsert(input: CreateSubscriberInput): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.upsert({
      where: { chatId: input.chatId },
      create: {
        chatId: input.chatId,
        chatType: input.chatType,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        languageCode: input.languageCode,
        isActive: input.isActive ?? true,
        isAdmin: input.isAdmin ?? false,
        alertPreferences: input.alertPreferences as Prisma.InputJsonValue | undefined,
        minSeverity: input.minSeverity ?? AlertSeverity.INFO,
      },
      update: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        languageCode: input.languageCode,
        isActive: input.isActive ?? true,
        isAdmin: input.isAdmin,
        alertPreferences: input.alertPreferences as Prisma.InputJsonValue | undefined,
        minSeverity: input.minSeverity,
      },
    });
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters: SubscriberFilters): Prisma.TelegramSubscriberWhereInput {
    const where: Prisma.TelegramSubscriberWhereInput = {};

    if (filters.chatType !== undefined) {
      where.chatType = filters.chatType;
    }

    if (filters.chatTypes !== undefined && filters.chatTypes.length > 0) {
      where.chatType = { in: filters.chatTypes };
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isAdmin !== undefined) {
      where.isAdmin = filters.isAdmin;
    }

    if (filters.isBlocked !== undefined) {
      where.isBlocked = filters.isBlocked;
    }

    if (filters.minSeverity !== undefined) {
      where.minSeverity = filters.minSeverity;
    }

    if (filters.usernameContains !== undefined) {
      where.username = { contains: filters.usernameContains, mode: "insensitive" };
    }

    if (filters.createdAfter !== undefined || filters.createdBefore !== undefined) {
      where.createdAt = {};
      if (filters.createdAfter !== undefined) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore !== undefined) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    if (filters.hasReceivedAlerts !== undefined) {
      if (filters.hasReceivedAlerts) {
        where.alertsSent = { gt: 0 };
      } else {
        where.alertsSent = 0;
      }
    }

    if (filters.lastAlertBefore !== undefined) {
      where.lastAlertAt = { lte: filters.lastAlertBefore };
    }

    return where;
  }

  /**
   * Build order by clause from sort options
   */
  private buildOrderByClause(
    sort?: SubscriberSortOptions
  ): Prisma.TelegramSubscriberOrderByWithRelationInput {
    if (!sort) {
      return { createdAt: "desc" };
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find subscribers with filters and pagination
   */
  async findMany(
    filters: SubscriberFilters = {},
    sort?: SubscriberSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedSubscribers> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sort);

    const [subscribers, total] = await Promise.all([
      this.prisma.telegramSubscriber.findMany({
        where,
        orderBy,
        skip: pagination?.skip,
        take: pagination?.take,
      }),
      this.prisma.telegramSubscriber.count({ where }),
    ]);

    const skip = pagination?.skip ?? 0;
    const hasMore = skip + subscribers.length < total;

    return { subscribers, total, hasMore };
  }

  /**
   * Find all active subscribers
   */
  async findActive(): Promise<TelegramSubscriber[]> {
    return this.prisma.telegramSubscriber.findMany({
      where: {
        isActive: true,
        isBlocked: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find all active subscribers of a specific chat type
   */
  async findActiveByType(chatType: TelegramChatType): Promise<TelegramSubscriber[]> {
    return this.prisma.telegramSubscriber.findMany({
      where: {
        chatType,
        isActive: true,
        isBlocked: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find all admin subscribers
   */
  async findAdmins(): Promise<TelegramSubscriber[]> {
    return this.prisma.telegramSubscriber.findMany({
      where: {
        isAdmin: true,
        isActive: true,
        isBlocked: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Activate a subscriber
   */
  async activate(chatId: bigint): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        isActive: true,
        deactivationReason: null,
      },
    });
  }

  /**
   * Deactivate a subscriber
   */
  async deactivate(chatId: bigint, reason?: string): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        isActive: false,
        deactivationReason: reason,
      },
    });
  }

  /**
   * Mark subscriber as blocked (by user)
   */
  async markBlocked(chatId: bigint): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        isBlocked: true,
        isActive: false,
        deactivationReason: "User blocked the bot",
      },
    });
  }

  /**
   * Increment alerts sent count
   */
  async incrementAlertsSent(chatId: bigint): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        alertsSent: { increment: 1 },
        lastAlertAt: new Date(),
      },
    });
  }

  /**
   * Update alert preferences
   */
  async updateAlertPreferences(
    chatId: bigint,
    preferences: AlertPreferences
  ): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        alertPreferences: preferences as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update minimum severity
   */
  async updateMinSeverity(chatId: bigint, severity: AlertSeverity): Promise<TelegramSubscriber> {
    return this.prisma.telegramSubscriber.update({
      where: { chatId },
      data: {
        minSeverity: severity,
      },
    });
  }

  /**
   * Count subscribers by filters
   */
  async count(filters: SubscriberFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.telegramSubscriber.count({ where });
  }

  /**
   * Get subscriber statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    blocked: number;
    byType: Record<TelegramChatType, number>;
  }> {
    const [total, active, blocked, byType] = await Promise.all([
      this.prisma.telegramSubscriber.count(),
      this.prisma.telegramSubscriber.count({ where: { isActive: true, isBlocked: false } }),
      this.prisma.telegramSubscriber.count({ where: { isBlocked: true } }),
      this.prisma.telegramSubscriber.groupBy({
        by: ["chatType"],
        _count: true,
      }),
    ]);

    const byTypeMap: Record<TelegramChatType, number> = {
      [TelegramChatType.PRIVATE]: 0,
      [TelegramChatType.GROUP]: 0,
      [TelegramChatType.SUPERGROUP]: 0,
      [TelegramChatType.CHANNEL]: 0,
    };

    for (const item of byType) {
      byTypeMap[item.chatType] = item._count;
    }

    return { total, active, blocked, byType: byTypeMap };
  }

  /**
   * Check if a chat ID is subscribed
   */
  async isSubscribed(chatId: bigint): Promise<boolean> {
    const subscriber = await this.prisma.telegramSubscriber.findUnique({
      where: { chatId },
      select: { isActive: true, isBlocked: true },
    });
    return subscriber !== null && subscriber.isActive && !subscriber.isBlocked;
  }

  /**
   * Check if a chat ID is an admin
   */
  async isAdmin(chatId: bigint): Promise<boolean> {
    const subscriber = await this.prisma.telegramSubscriber.findUnique({
      where: { chatId },
      select: { isAdmin: true },
    });
    return subscriber?.isAdmin ?? false;
  }
}

/**
 * Factory function to create a new TelegramSubscriberService
 */
export function createTelegramSubscriberService(
  prisma: PrismaClient = defaultPrisma
): TelegramSubscriberService {
  return new TelegramSubscriberService(prisma);
}

/**
 * Default service instance
 */
export const telegramSubscriberService = new TelegramSubscriberService();
