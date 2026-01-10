/**
 * Alert Database Service
 *
 * CRUD operations and queries for the Alert model.
 * Provides typed interfaces for interacting with alert data in the database.
 */

import type { Alert, Market, Wallet, Prisma, PrismaClient } from "@prisma/client";
import { AlertType, AlertSeverity } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { Alert };
export { AlertType, AlertSeverity };

/**
 * Alert with related market included
 */
export interface AlertWithMarket extends Alert {
  market: Market | null;
}

/**
 * Alert with related wallet included
 */
export interface AlertWithWallet extends Alert {
  wallet: Wallet | null;
}

/**
 * Alert with all relations included
 */
export interface AlertWithRelations extends Alert {
  market: Market | null;
  wallet: Wallet | null;
}

/**
 * Input for creating a new alert
 */
export interface CreateAlertInput {
  /** Alert type classification */
  type: AlertType;
  /** Alert severity level */
  severity?: AlertSeverity;
  /** Reference to related market (optional) */
  marketId?: string;
  /** Reference to related wallet (optional) */
  walletId?: string;
  /** Alert title/headline */
  title: string;
  /** Detailed alert message */
  message: string;
  /** Structured alert data as JSON */
  data?: Prisma.InputJsonValue;
  /** Alert tags for filtering */
  tags?: string[];
  /** Whether the alert has been read */
  read?: boolean;
  /** Whether the alert has been acknowledged */
  acknowledged?: boolean;
  /** Whether the alert has been dismissed */
  dismissed?: boolean;
  /** When the alert expires (for time-sensitive alerts) */
  expiresAt?: Date;
}

/**
 * Input for updating an existing alert
 */
export interface UpdateAlertInput {
  /** Alert type classification */
  type?: AlertType;
  /** Alert severity level */
  severity?: AlertSeverity;
  /** Reference to related market (optional) */
  marketId?: string | null;
  /** Reference to related wallet (optional) */
  walletId?: string | null;
  /** Alert title/headline */
  title?: string;
  /** Detailed alert message */
  message?: string;
  /** Structured alert data as JSON */
  data?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  /** Alert tags for filtering */
  tags?: string[];
  /** Whether the alert has been read */
  read?: boolean;
  /** Whether the alert has been acknowledged */
  acknowledged?: boolean;
  /** Whether the alert has been dismissed */
  dismissed?: boolean;
  /** User who acknowledged/dismissed */
  actionBy?: string | null;
  /** When the alert was acknowledged */
  actionAt?: Date | null;
  /** When the alert expires */
  expiresAt?: Date | null;
}

/**
 * Filters for querying alerts
 */
export interface AlertFilters {
  /** Filter by alert type */
  type?: AlertType;
  /** Filter by multiple alert types */
  types?: AlertType[];
  /** Filter by severity */
  severity?: AlertSeverity;
  /** Filter by multiple severities */
  severities?: AlertSeverity[];
  /** Filter by market ID */
  marketId?: string;
  /** Filter by wallet ID */
  walletId?: string;
  /** Filter by read status */
  read?: boolean;
  /** Filter by acknowledged status */
  acknowledged?: boolean;
  /** Filter by dismissed status */
  dismissed?: boolean;
  /** Filter by tag (any match) */
  hasTag?: string;
  /** Filter by multiple tags (any match) */
  hasTags?: string[];
  /** Created after this date */
  createdAfter?: Date;
  /** Created before this date */
  createdBefore?: Date;
  /** Expires after this date */
  expiresAfter?: Date;
  /** Expires before this date */
  expiresBefore?: Date;
  /** Filter to only non-expired alerts */
  notExpired?: boolean;
  /** Search in title (partial match) */
  titleContains?: string;
  /** Search in message (partial match) */
  messageContains?: string;
}

/**
 * Sorting options for alert queries
 */
export interface AlertSortOptions {
  /** Field to sort by */
  field: "createdAt" | "severity" | "type" | "expiresAt";
  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Number of items to skip */
  skip?: number;
  /** Maximum number of items to return */
  take?: number;
}

/**
 * Result from paginated alert queries
 */
export interface PaginatedAlertResult {
  /** Alerts matching the query */
  alerts: Alert[];
  /** Total count of matching alerts */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Include options for alert queries
 */
export interface AlertIncludeOptions {
  /** Include market relation */
  market?: boolean;
  /** Include wallet relation */
  wallet?: boolean;
}

/**
 * Alert service configuration
 */
export interface AlertServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
}

/**
 * Alert aggregate statistics
 */
export interface AlertStats {
  /** Total number of alerts */
  count: number;
  /** Number of unread alerts */
  unreadCount: number;
  /** Number of unacknowledged alerts */
  unacknowledgedCount: number;
  /** Number of dismissed alerts */
  dismissedCount: number;
  /** Count by severity */
  bySeverity: Record<AlertSeverity, number>;
  /** Count by type */
  byType: Partial<Record<AlertType, number>>;
}

/**
 * Severity order for sorting (higher = more severe)
 */
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  [AlertSeverity.INFO]: 1,
  [AlertSeverity.LOW]: 2,
  [AlertSeverity.MEDIUM]: 3,
  [AlertSeverity.HIGH]: 4,
  [AlertSeverity.CRITICAL]: 5,
};

/**
 * Alert Database Service
 *
 * Provides CRUD operations and queries for the Alert model.
 */
export class AlertService {
  private prisma: PrismaClient;

  constructor(config: AlertServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
  }

  /**
   * Create a new alert.
   *
   * @param input - Alert data to create
   * @returns The created alert
   *
   * @example
   * ```typescript
   * const alert = await alertService.create({
   *   type: AlertType.WHALE_TRADE,
   *   severity: AlertSeverity.HIGH,
   *   title: "Large Trade Detected",
   *   message: "Whale wallet made a $500k trade",
   *   walletId: "wallet-1",
   *   tags: ["whale", "large-trade"],
   * });
   * ```
   */
  async create(input: CreateAlertInput): Promise<Alert> {
    return this.prisma.alert.create({
      data: {
        type: input.type,
        severity: input.severity ?? AlertSeverity.INFO,
        marketId: input.marketId,
        walletId: input.walletId,
        title: input.title,
        message: input.message,
        data: input.data,
        tags: input.tags ?? [],
        read: input.read ?? false,
        acknowledged: input.acknowledged ?? false,
        dismissed: input.dismissed ?? false,
        expiresAt: input.expiresAt,
      },
    });
  }

  /**
   * Find an alert by its unique ID.
   *
   * @param id - The alert ID
   * @param include - Relations to include
   * @returns The alert or null if not found
   *
   * @example
   * ```typescript
   * const alert = await alertService.findById("alert-1", { wallet: true });
   * if (alert) {
   *   console.log(`Alert for wallet: ${alert.wallet?.address}`);
   * }
   * ```
   */
  async findById(id: string, include?: AlertIncludeOptions): Promise<Alert | AlertWithRelations | null> {
    return this.prisma.alert.findUnique({
      where: { id },
      include: include
        ? {
            market: include.market ?? false,
            wallet: include.wallet ?? false,
          }
        : undefined,
    });
  }

  /**
   * Find multiple alerts by their IDs.
   *
   * @param ids - Array of alert IDs
   * @param include - Relations to include
   * @returns Array of found alerts
   */
  async findByIds(ids: string[], include?: AlertIncludeOptions): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: { id: { in: ids } },
      include: include
        ? {
            market: include.market ?? false,
            wallet: include.wallet ?? false,
          }
        : undefined,
    });
  }

  /**
   * Update an existing alert.
   *
   * @param id - The alert ID to update
   * @param input - Fields to update
   * @returns The updated alert
   * @throws If alert not found
   *
   * @example
   * ```typescript
   * const updated = await alertService.update("alert-1", {
   *   read: true,
   *   acknowledged: true,
   *   actionBy: "user@example.com",
   *   actionAt: new Date(),
   * });
   * ```
   */
  async update(id: string, input: UpdateAlertInput): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete an alert by ID.
   *
   * @param id - The alert ID to delete
   * @returns The deleted alert
   * @throws If alert not found
   */
  async delete(id: string): Promise<Alert> {
    return this.prisma.alert.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple alerts by IDs.
   *
   * @param ids - Array of alert IDs to delete
   * @returns Count of deleted alerts
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.alert.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Build Prisma where clause from filters.
   */
  private buildWhereClause(filters: AlertFilters): Prisma.AlertWhereInput {
    const where: Prisma.AlertWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.types && filters.types.length > 0) {
      where.type = { in: filters.types };
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.severities && filters.severities.length > 0) {
      where.severity = { in: filters.severities };
    }

    if (filters.marketId) {
      where.marketId = filters.marketId;
    }

    if (filters.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters.read !== undefined) {
      where.read = filters.read;
    }

    if (filters.acknowledged !== undefined) {
      where.acknowledged = filters.acknowledged;
    }

    if (filters.dismissed !== undefined) {
      where.dismissed = filters.dismissed;
    }

    if (filters.hasTag) {
      where.tags = { has: filters.hasTag };
    }

    if (filters.hasTags && filters.hasTags.length > 0) {
      where.tags = { hasSome: filters.hasTags };
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    if (filters.expiresAfter || filters.expiresBefore) {
      where.expiresAt = {};
      if (filters.expiresAfter) {
        where.expiresAt.gte = filters.expiresAfter;
      }
      if (filters.expiresBefore) {
        where.expiresAt.lte = filters.expiresBefore;
      }
    }

    if (filters.notExpired) {
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
    }

    if (filters.titleContains) {
      where.title = { contains: filters.titleContains, mode: "insensitive" };
    }

    if (filters.messageContains) {
      where.message = { contains: filters.messageContains, mode: "insensitive" };
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options.
   */
  private buildOrderByClause(sort?: AlertSortOptions): Prisma.AlertOrderByWithRelationInput | undefined {
    if (!sort) {
      return { createdAt: "desc" }; // Default sort
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find alerts matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param include - Optional relations to include
   * @returns Paginated result of matching alerts
   *
   * @example
   * ```typescript
   * // Find unread high-severity alerts
   * const result = await alertService.findMany(
   *   {
   *     read: false,
   *     severities: [AlertSeverity.HIGH, AlertSeverity.CRITICAL],
   *   },
   *   { field: "createdAt", direction: "desc" },
   *   { take: 20 }
   * );
   *
   * console.log(`Found ${result.total} unread critical alerts`);
   * ```
   */
  async findMany(
    filters: AlertFilters = {},
    sort?: AlertSortOptions,
    pagination: PaginationOptions = {},
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [alerts, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy,
        skip,
        take,
        include: include
          ? {
              market: include.market ?? false,
              wallet: include.wallet ?? false,
            }
          : undefined,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      alerts,
      total,
      skip,
      take,
      hasMore: skip + alerts.length < total,
    };
  }

  /**
   * Find alerts by type.
   *
   * @param type - The alert type to filter by
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated alerts of the specified type
   */
  async findByType(
    type: AlertType,
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ type }, sort, pagination, include);
  }

  /**
   * Find alerts by severity.
   *
   * @param severity - The severity level to filter by
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated alerts of the specified severity
   */
  async findBySeverity(
    severity: AlertSeverity,
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ severity }, sort, pagination, include);
  }

  /**
   * Find unread alerts.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated unread alerts
   */
  async findUnread(
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ read: false }, sort, pagination, include);
  }

  /**
   * Find unacknowledged alerts.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated unacknowledged alerts
   */
  async findUnacknowledged(
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ acknowledged: false }, sort, pagination, include);
  }

  /**
   * Find active (non-dismissed, non-expired) alerts.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated active alerts
   */
  async findActive(
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ dismissed: false, notExpired: true }, sort, pagination, include);
  }

  /**
   * Find critical alerts (HIGH and CRITICAL severity).
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated critical alerts
   */
  async findCritical(
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany(
      { severities: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
      sort,
      pagination,
      include
    );
  }

  /**
   * Find alerts for a specific wallet.
   *
   * @param walletId - The wallet ID
   * @param filters - Optional additional filters
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated alerts for the wallet
   */
  async findByWallet(
    walletId: string,
    filters: Omit<AlertFilters, "walletId"> = {},
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ ...filters, walletId }, sort, pagination, include);
  }

  /**
   * Find alerts for a specific market.
   *
   * @param marketId - The market ID
   * @param filters - Optional additional filters
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated alerts for the market
   */
  async findByMarket(
    marketId: string,
    filters: Omit<AlertFilters, "marketId"> = {},
    sort?: AlertSortOptions,
    pagination?: PaginationOptions,
    include?: AlertIncludeOptions
  ): Promise<PaginatedAlertResult> {
    return this.findMany({ ...filters, marketId }, sort, pagination, include);
  }

  /**
   * Get recent alerts.
   *
   * @param limit - Number of alerts to return
   * @param include - Optional relations to include
   * @returns Recent alerts sorted by creation time
   */
  async getRecent(limit = 50, include?: AlertIncludeOptions): Promise<Alert[]> {
    const result = await this.findMany(
      {},
      { field: "createdAt", direction: "desc" },
      { take: limit },
      include
    );
    return result.alerts;
  }

  /**
   * Get recent unread alerts.
   *
   * @param limit - Number of alerts to return
   * @param include - Optional relations to include
   * @returns Recent unread alerts
   */
  async getRecentUnread(limit = 50, include?: AlertIncludeOptions): Promise<Alert[]> {
    const result = await this.findMany(
      { read: false },
      { field: "createdAt", direction: "desc" },
      { take: limit },
      include
    );
    return result.alerts;
  }

  /**
   * Count alerts matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching alerts
   */
  async count(filters: AlertFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.alert.count({ where });
  }

  /**
   * Check if an alert exists by ID.
   *
   * @param id - The alert ID
   * @returns True if alert exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.alert.count({ where: { id } });
    return count > 0;
  }

  /**
   * Bulk create alerts.
   *
   * @param alerts - Array of alerts to create
   * @returns Count of created alerts
   */
  async createMany(alerts: CreateAlertInput[]): Promise<{ count: number }> {
    return this.prisma.alert.createMany({
      data: alerts.map((alert) => ({
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.INFO,
        marketId: alert.marketId,
        walletId: alert.walletId,
        title: alert.title,
        message: alert.message,
        data: alert.data,
        tags: alert.tags ?? [],
        read: alert.read ?? false,
        acknowledged: alert.acknowledged ?? false,
        dismissed: alert.dismissed ?? false,
        expiresAt: alert.expiresAt,
      })),
    });
  }

  /**
   * Mark an alert as read.
   *
   * @param id - The alert ID
   * @returns The updated alert
   */
  async markAsRead(id: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: { read: true },
    });
  }

  /**
   * Mark multiple alerts as read.
   *
   * @param ids - Array of alert IDs
   * @returns Count of updated alerts
   */
  async markManyAsRead(ids: string[]): Promise<{ count: number }> {
    return this.prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: { read: true },
    });
  }

  /**
   * Mark all unread alerts as read.
   *
   * @param filters - Optional filters to apply
   * @returns Count of updated alerts
   */
  async markAllAsRead(filters: AlertFilters = {}): Promise<{ count: number }> {
    const where = this.buildWhereClause({ ...filters, read: false });
    return this.prisma.alert.updateMany({
      where,
      data: { read: true },
    });
  }

  /**
   * Acknowledge an alert.
   *
   * @param id - The alert ID
   * @param actionBy - User who acknowledged (optional)
   * @returns The updated alert
   */
  async acknowledge(id: string, actionBy?: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: {
        acknowledged: true,
        read: true,
        actionBy,
        actionAt: new Date(),
      },
    });
  }

  /**
   * Acknowledge multiple alerts.
   *
   * @param ids - Array of alert IDs
   * @param actionBy - User who acknowledged (optional)
   * @returns Count of updated alerts
   */
  async acknowledgeMany(ids: string[], actionBy?: string): Promise<{ count: number }> {
    return this.prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: {
        acknowledged: true,
        read: true,
        actionBy,
        actionAt: new Date(),
      },
    });
  }

  /**
   * Dismiss an alert.
   *
   * @param id - The alert ID
   * @param actionBy - User who dismissed (optional)
   * @returns The updated alert
   */
  async dismiss(id: string, actionBy?: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: {
        dismissed: true,
        read: true,
        actionBy,
        actionAt: new Date(),
      },
    });
  }

  /**
   * Dismiss multiple alerts.
   *
   * @param ids - Array of alert IDs
   * @param actionBy - User who dismissed (optional)
   * @returns Count of updated alerts
   */
  async dismissMany(ids: string[], actionBy?: string): Promise<{ count: number }> {
    return this.prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: {
        dismissed: true,
        read: true,
        actionBy,
        actionAt: new Date(),
      },
    });
  }

  /**
   * Delete expired alerts.
   *
   * @returns Count of deleted alerts
   */
  async deleteExpired(): Promise<{ count: number }> {
    return this.prisma.alert.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  /**
   * Delete old dismissed alerts.
   *
   * @param olderThan - Delete alerts dismissed before this date
   * @returns Count of deleted alerts
   */
  async deleteOldDismissed(olderThan: Date): Promise<{ count: number }> {
    return this.prisma.alert.deleteMany({
      where: {
        dismissed: true,
        createdAt: { lt: olderThan },
      },
    });
  }

  /**
   * Get aggregate statistics for alerts.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregate statistics
   */
  async getStats(filters: AlertFilters = {}): Promise<AlertStats> {
    const where = this.buildWhereClause(filters);

    const [countResult, unreadCount, unacknowledgedCount, dismissedCount, bySeverity, byType] =
      await Promise.all([
        this.prisma.alert.count({ where }),
        this.prisma.alert.count({ where: { ...where, read: false } }),
        this.prisma.alert.count({ where: { ...where, acknowledged: false } }),
        this.prisma.alert.count({ where: { ...where, dismissed: true } }),
        this.prisma.alert.groupBy({
          by: ["severity"],
          where,
          _count: { id: true },
        }),
        this.prisma.alert.groupBy({
          by: ["type"],
          where,
          _count: { id: true },
        }),
      ]);

    const bySeverityMap: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    for (const group of bySeverity) {
      bySeverityMap[group.severity] = group._count.id;
    }

    const byTypeMap: Partial<Record<AlertType, number>> = {};
    for (const group of byType) {
      byTypeMap[group.type] = group._count.id;
    }

    return {
      count: countResult,
      unreadCount,
      unacknowledgedCount,
      dismissedCount,
      bySeverity: bySeverityMap,
      byType: byTypeMap,
    };
  }

  /**
   * Get alert count grouped by severity.
   *
   * @returns Alert counts by severity
   */
  async getCountBySeverity(): Promise<Record<AlertSeverity, number>> {
    const groups = await this.prisma.alert.groupBy({
      by: ["severity"],
      _count: { id: true },
    });

    const result: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    for (const group of groups) {
      result[group.severity] = group._count.id;
    }

    return result;
  }

  /**
   * Get alert count grouped by type.
   *
   * @returns Alert counts by type
   */
  async getCountByType(): Promise<Partial<Record<AlertType, number>>> {
    const groups = await this.prisma.alert.groupBy({
      by: ["type"],
      _count: { id: true },
    });

    const result: Partial<Record<AlertType, number>> = {};
    for (const group of groups) {
      result[group.type] = group._count.id;
    }

    return result;
  }

  /**
   * Search alerts by title or message.
   *
   * @param query - Search query
   * @param pagination - Optional pagination
   * @returns Paginated search results
   */
  async search(query: string, pagination?: PaginationOptions): Promise<PaginatedAlertResult> {
    const where: Prisma.AlertWhereInput = {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { message: { contains: query, mode: "insensitive" } },
      ],
    };

    const skip = pagination?.skip ?? 0;
    const take = pagination?.take ?? 100;

    const [alerts, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      alerts,
      total,
      skip,
      take,
      hasMore: skip + alerts.length < total,
    };
  }

  /**
   * Get severity priority (higher number = more critical).
   *
   * @param severity - The severity level
   * @returns Priority number
   */
  getSeverityPriority(severity: AlertSeverity): number {
    return SEVERITY_ORDER[severity];
  }

  /**
   * Compare two alerts by severity.
   *
   * @param a - First alert
   * @param b - Second alert
   * @returns Negative if a < b, positive if a > b, 0 if equal
   */
  compareBySeverity(a: Alert, b: Alert): number {
    return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  }
}

/**
 * Default alert service instance using the singleton Prisma client.
 */
export const alertService = new AlertService();

/**
 * Create a new alert service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new AlertService instance
 */
export function createAlertService(config: AlertServiceConfig = {}): AlertService {
  return new AlertService(config);
}
