/**
 * Snapshot Database Service
 *
 * CRUD operations and queries for MarketSnapshot and WalletSnapshot models.
 * Provides typed interfaces for storing and retrieving periodic snapshots of
 * market and wallet state for historical analysis.
 */

import type {
  MarketSnapshot,
  WalletSnapshot,
  Market,
  Wallet,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { MarketSnapshot, WalletSnapshot };

// ===========================================================================
// MARKET SNAPSHOT TYPES
// ===========================================================================

/**
 * Market snapshot with market relation included
 */
export interface MarketSnapshotWithMarket extends MarketSnapshot {
  market: Market;
}

/**
 * Input for creating a market snapshot
 */
export interface CreateMarketSnapshotInput {
  /** Market ID this snapshot belongs to */
  marketId: string;
  /** Full market state as JSON */
  state: Prisma.InputJsonValue;
  /** Outcome prices at snapshot time */
  outcomePrices: Prisma.InputJsonValue;
  /** Total volume at snapshot time */
  volume: number;
  /** Liquidity at snapshot time */
  liquidity: number;
  /** Snapshot timestamp (defaults to now) */
  timestamp?: Date;
}

/**
 * Filters for querying market snapshots
 */
export interface MarketSnapshotFilters {
  /** Filter by market ID */
  marketId?: string;
  /** Filter by multiple market IDs */
  marketIds?: string[];
  /** Snapshots after this timestamp */
  timestampAfter?: Date;
  /** Snapshots before this timestamp */
  timestampBefore?: Date;
  /** Minimum volume */
  minVolume?: number;
  /** Maximum volume */
  maxVolume?: number;
  /** Minimum liquidity */
  minLiquidity?: number;
  /** Maximum liquidity */
  maxLiquidity?: number;
}

/**
 * Sorting options for market snapshot queries
 */
export interface MarketSnapshotSortOptions {
  /** Field to sort by */
  field: "timestamp" | "volume" | "liquidity";
  /** Sort direction */
  direction: "asc" | "desc";
}

// ===========================================================================
// WALLET SNAPSHOT TYPES
// ===========================================================================

/**
 * Wallet snapshot with wallet relation included
 */
export interface WalletSnapshotWithWallet extends WalletSnapshot {
  wallet: Wallet;
}

/**
 * Input for creating a wallet snapshot
 */
export interface CreateWalletSnapshotInput {
  /** Wallet ID this snapshot belongs to */
  walletId: string;
  /** Total volume at snapshot time */
  totalVolume: number;
  /** Total P&L at snapshot time */
  totalPnl: number;
  /** Trade count at snapshot time */
  tradeCount: number;
  /** Win rate at snapshot time (optional) */
  winRate?: number | null;
  /** Suspicion score at snapshot time */
  suspicionScore: number;
  /** Active positions as JSON (optional) */
  positions?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  /** Snapshot timestamp (defaults to now) */
  timestamp?: Date;
}

/**
 * Filters for querying wallet snapshots
 */
export interface WalletSnapshotFilters {
  /** Filter by wallet ID */
  walletId?: string;
  /** Filter by multiple wallet IDs */
  walletIds?: string[];
  /** Snapshots after this timestamp */
  timestampAfter?: Date;
  /** Snapshots before this timestamp */
  timestampBefore?: Date;
  /** Minimum total volume */
  minTotalVolume?: number;
  /** Maximum total volume */
  maxTotalVolume?: number;
  /** Minimum suspicion score */
  minSuspicionScore?: number;
  /** Maximum suspicion score */
  maxSuspicionScore?: number;
  /** Minimum P&L */
  minPnl?: number;
  /** Maximum P&L */
  maxPnl?: number;
}

/**
 * Sorting options for wallet snapshot queries
 */
export interface WalletSnapshotSortOptions {
  /** Field to sort by */
  field: "timestamp" | "totalVolume" | "totalPnl" | "tradeCount" | "suspicionScore";
  /** Sort direction */
  direction: "asc" | "desc";
}

// ===========================================================================
// SHARED TYPES
// ===========================================================================

/**
 * Pagination options for snapshot queries
 */
export interface SnapshotPaginationOptions {
  /** Number of items to skip */
  skip?: number;
  /** Maximum number of items to return */
  take?: number;
}

/**
 * Result from paginated market snapshot queries
 */
export interface PaginatedMarketSnapshotResult {
  /** Snapshots matching the query */
  snapshots: MarketSnapshot[];
  /** Total count of matching snapshots */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Result from paginated wallet snapshot queries
 */
export interface PaginatedWalletSnapshotResult {
  /** Snapshots matching the query */
  snapshots: WalletSnapshot[];
  /** Total count of matching snapshots */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Snapshot service configuration
 */
export interface SnapshotServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
  /** Default retention period in days for cleanup */
  defaultRetentionDays?: number;
}

/**
 * Time range for snapshot queries
 */
export interface TimeRange {
  /** Start of time range */
  start: Date;
  /** End of time range */
  end: Date;
}

/**
 * Aggregated statistics for market snapshots
 */
export interface MarketSnapshotStats {
  /** Number of snapshots */
  count: number;
  /** Earliest snapshot timestamp */
  earliest: Date | null;
  /** Latest snapshot timestamp */
  latest: Date | null;
  /** Average volume across snapshots */
  avgVolume: number;
  /** Average liquidity across snapshots */
  avgLiquidity: number;
  /** Maximum volume */
  maxVolume: number;
  /** Minimum volume */
  minVolume: number;
}

/**
 * Aggregated statistics for wallet snapshots
 */
export interface WalletSnapshotStats {
  /** Number of snapshots */
  count: number;
  /** Earliest snapshot timestamp */
  earliest: Date | null;
  /** Latest snapshot timestamp */
  latest: Date | null;
  /** Average total volume across snapshots */
  avgTotalVolume: number;
  /** Average P&L across snapshots */
  avgPnl: number;
  /** Average suspicion score across snapshots */
  avgSuspicionScore: number;
  /** Maximum total volume */
  maxTotalVolume: number;
  /** Maximum P&L */
  maxPnl: number;
}

// ===========================================================================
// SNAPSHOT SERVICE
// ===========================================================================

/**
 * Snapshot Database Service
 *
 * Provides CRUD operations and queries for MarketSnapshot and WalletSnapshot models.
 * Used for storing periodic snapshots of market and wallet state for historical analysis.
 */
export class SnapshotService {
  private prisma: PrismaClient;
  private defaultRetentionDays: number;

  constructor(config: SnapshotServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
    this.defaultRetentionDays = config.defaultRetentionDays ?? 90;
  }

  // =========================================================================
  // MARKET SNAPSHOT CRUD
  // =========================================================================

  /**
   * Create a new market snapshot.
   *
   * @param input - Snapshot data to create
   * @returns The created snapshot
   *
   * @example
   * ```typescript
   * const snapshot = await snapshotService.createMarketSnapshot({
   *   marketId: "0x1234...",
   *   state: { question: "...", outcomes: [...] },
   *   outcomePrices: { Yes: 0.65, No: 0.35 },
   *   volume: 1500000,
   *   liquidity: 250000,
   * });
   * ```
   */
  async createMarketSnapshot(input: CreateMarketSnapshotInput): Promise<MarketSnapshot> {
    return this.prisma.marketSnapshot.create({
      data: {
        marketId: input.marketId,
        state: input.state,
        outcomePrices: input.outcomePrices,
        volume: input.volume,
        liquidity: input.liquidity,
        timestamp: input.timestamp ?? new Date(),
      },
    });
  }

  /**
   * Create multiple market snapshots in a batch.
   *
   * @param inputs - Array of snapshot data to create
   * @returns Count of created snapshots
   *
   * @example
   * ```typescript
   * const result = await snapshotService.createManyMarketSnapshots([
   *   { marketId: "0x1234...", state: {...}, outcomePrices: {...}, volume: 1000, liquidity: 500 },
   *   { marketId: "0x5678...", state: {...}, outcomePrices: {...}, volume: 2000, liquidity: 800 },
   * ]);
   * ```
   */
  async createManyMarketSnapshots(
    inputs: CreateMarketSnapshotInput[]
  ): Promise<{ count: number }> {
    return this.prisma.marketSnapshot.createMany({
      data: inputs.map((input) => ({
        marketId: input.marketId,
        state: input.state,
        outcomePrices: input.outcomePrices,
        volume: input.volume,
        liquidity: input.liquidity,
        timestamp: input.timestamp ?? new Date(),
      })),
    });
  }

  /**
   * Find a market snapshot by ID.
   *
   * @param id - Snapshot ID
   * @param includeMarket - Whether to include the market relation
   * @returns The snapshot or null if not found
   */
  async findMarketSnapshotById(
    id: string,
    includeMarket = false
  ): Promise<MarketSnapshot | MarketSnapshotWithMarket | null> {
    return this.prisma.marketSnapshot.findUnique({
      where: { id },
      include: includeMarket ? { market: true } : undefined,
    });
  }

  /**
   * Find multiple market snapshots by IDs.
   *
   * @param ids - Array of snapshot IDs
   * @param includeMarket - Whether to include the market relation
   * @returns Array of found snapshots
   */
  async findMarketSnapshotsByIds(
    ids: string[],
    includeMarket = false
  ): Promise<MarketSnapshot[]> {
    return this.prisma.marketSnapshot.findMany({
      where: { id: { in: ids } },
      include: includeMarket ? { market: true } : undefined,
    });
  }

  /**
   * Delete a market snapshot by ID.
   *
   * @param id - Snapshot ID to delete
   * @returns The deleted snapshot
   */
  async deleteMarketSnapshot(id: string): Promise<MarketSnapshot> {
    return this.prisma.marketSnapshot.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple market snapshots by IDs.
   *
   * @param ids - Array of snapshot IDs to delete
   * @returns Count of deleted snapshots
   */
  async deleteManyMarketSnapshots(ids: string[]): Promise<{ count: number }> {
    return this.prisma.marketSnapshot.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Build Prisma where clause from market snapshot filters.
   */
  private buildMarketSnapshotWhereClause(
    filters: MarketSnapshotFilters
  ): Prisma.MarketSnapshotWhereInput {
    const where: Prisma.MarketSnapshotWhereInput = {};

    if (filters.marketId) {
      where.marketId = filters.marketId;
    }

    if (filters.marketIds && filters.marketIds.length > 0) {
      where.marketId = { in: filters.marketIds };
    }

    if (filters.timestampAfter || filters.timestampBefore) {
      where.timestamp = {};
      if (filters.timestampAfter) {
        where.timestamp.gte = filters.timestampAfter;
      }
      if (filters.timestampBefore) {
        where.timestamp.lte = filters.timestampBefore;
      }
    }

    if (filters.minVolume !== undefined || filters.maxVolume !== undefined) {
      where.volume = {};
      if (filters.minVolume !== undefined) {
        where.volume.gte = filters.minVolume;
      }
      if (filters.maxVolume !== undefined) {
        where.volume.lte = filters.maxVolume;
      }
    }

    if (filters.minLiquidity !== undefined || filters.maxLiquidity !== undefined) {
      where.liquidity = {};
      if (filters.minLiquidity !== undefined) {
        where.liquidity.gte = filters.minLiquidity;
      }
      if (filters.maxLiquidity !== undefined) {
        where.liquidity.lte = filters.maxLiquidity;
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from market snapshot sort options.
   */
  private buildMarketSnapshotOrderByClause(
    sort?: MarketSnapshotSortOptions
  ): Prisma.MarketSnapshotOrderByWithRelationInput | undefined {
    if (!sort) {
      return { timestamp: "desc" }; // Default sort by newest first
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find market snapshots matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param includeMarket - Whether to include the market relation
   * @returns Paginated result of matching snapshots
   *
   * @example
   * ```typescript
   * const result = await snapshotService.findManyMarketSnapshots(
   *   { marketId: "0x1234...", timestampAfter: new Date("2024-01-01") },
   *   { field: "timestamp", direction: "asc" },
   *   { take: 100 }
   * );
   * ```
   */
  async findManyMarketSnapshots(
    filters: MarketSnapshotFilters = {},
    sort?: MarketSnapshotSortOptions,
    pagination: SnapshotPaginationOptions = {},
    includeMarket = false
  ): Promise<PaginatedMarketSnapshotResult> {
    const where = this.buildMarketSnapshotWhereClause(filters);
    const orderBy = this.buildMarketSnapshotOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [snapshots, total] = await Promise.all([
      this.prisma.marketSnapshot.findMany({
        where,
        orderBy,
        skip,
        take,
        include: includeMarket ? { market: true } : undefined,
      }),
      this.prisma.marketSnapshot.count({ where }),
    ]);

    return {
      snapshots,
      total,
      skip,
      take,
      hasMore: skip + snapshots.length < total,
    };
  }

  /**
   * Find market snapshots for a specific market.
   *
   * @param marketId - Market ID
   * @param timeRange - Optional time range
   * @param pagination - Optional pagination
   * @returns Paginated snapshots for the market
   */
  async findMarketSnapshotsByMarket(
    marketId: string,
    timeRange?: TimeRange,
    pagination?: SnapshotPaginationOptions
  ): Promise<PaginatedMarketSnapshotResult> {
    const filters: MarketSnapshotFilters = { marketId };
    if (timeRange) {
      filters.timestampAfter = timeRange.start;
      filters.timestampBefore = timeRange.end;
    }
    return this.findManyMarketSnapshots(
      filters,
      { field: "timestamp", direction: "asc" },
      pagination
    );
  }

  /**
   * Get the latest snapshot for a market.
   *
   * @param marketId - Market ID
   * @param includeMarket - Whether to include the market relation
   * @returns The latest snapshot or null if none exist
   */
  async getLatestMarketSnapshot(
    marketId: string,
    includeMarket = false
  ): Promise<MarketSnapshot | MarketSnapshotWithMarket | null> {
    return this.prisma.marketSnapshot.findFirst({
      where: { marketId },
      orderBy: { timestamp: "desc" },
      include: includeMarket ? { market: true } : undefined,
    });
  }

  /**
   * Get the latest snapshots for multiple markets.
   *
   * @param marketIds - Array of market IDs
   * @returns Map of market ID to latest snapshot
   */
  async getLatestMarketSnapshots(
    marketIds: string[]
  ): Promise<Map<string, MarketSnapshot>> {
    const snapshots = await this.prisma.marketSnapshot.findMany({
      where: { marketId: { in: marketIds } },
      orderBy: { timestamp: "desc" },
      distinct: ["marketId"],
    });

    const snapshotMap = new Map<string, MarketSnapshot>();
    for (const snapshot of snapshots) {
      snapshotMap.set(snapshot.marketId, snapshot);
    }

    return snapshotMap;
  }

  /**
   * Count market snapshots matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching snapshots
   */
  async countMarketSnapshots(filters: MarketSnapshotFilters = {}): Promise<number> {
    const where = this.buildMarketSnapshotWhereClause(filters);
    return this.prisma.marketSnapshot.count({ where });
  }

  /**
   * Get aggregated statistics for market snapshots.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregated statistics
   */
  async getMarketSnapshotStats(
    filters: MarketSnapshotFilters = {}
  ): Promise<MarketSnapshotStats> {
    const where = this.buildMarketSnapshotWhereClause(filters);

    const [aggregate, earliest, latest] = await Promise.all([
      this.prisma.marketSnapshot.aggregate({
        where,
        _count: { id: true },
        _avg: { volume: true, liquidity: true },
        _max: { volume: true },
        _min: { volume: true },
      }),
      this.prisma.marketSnapshot.findFirst({
        where,
        orderBy: { timestamp: "asc" },
        select: { timestamp: true },
      }),
      this.prisma.marketSnapshot.findFirst({
        where,
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      }),
    ]);

    return {
      count: aggregate._count.id,
      earliest: earliest?.timestamp ?? null,
      latest: latest?.timestamp ?? null,
      avgVolume: aggregate._avg.volume ?? 0,
      avgLiquidity: aggregate._avg.liquidity ?? 0,
      maxVolume: aggregate._max.volume ?? 0,
      minVolume: aggregate._min.volume ?? 0,
    };
  }

  /**
   * Delete market snapshots older than a certain date.
   *
   * @param olderThan - Delete snapshots older than this date
   * @param marketId - Optional market ID to limit deletion to specific market
   * @returns Count of deleted snapshots
   */
  async deleteOldMarketSnapshots(
    olderThan: Date,
    marketId?: string
  ): Promise<{ count: number }> {
    const where: Prisma.MarketSnapshotWhereInput = {
      timestamp: { lt: olderThan },
    };

    if (marketId) {
      where.marketId = marketId;
    }

    return this.prisma.marketSnapshot.deleteMany({ where });
  }

  /**
   * Delete market snapshots older than the retention period.
   *
   * @param retentionDays - Number of days to retain (defaults to service config)
   * @param marketId - Optional market ID to limit deletion to specific market
   * @returns Count of deleted snapshots
   */
  async cleanupOldMarketSnapshots(
    retentionDays?: number,
    marketId?: string
  ): Promise<{ count: number }> {
    const days = retentionDays ?? this.defaultRetentionDays;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.deleteOldMarketSnapshots(cutoffDate, marketId);
  }

  // =========================================================================
  // WALLET SNAPSHOT CRUD
  // =========================================================================

  /**
   * Create a new wallet snapshot.
   *
   * @param input - Snapshot data to create
   * @returns The created snapshot
   *
   * @example
   * ```typescript
   * const snapshot = await snapshotService.createWalletSnapshot({
   *   walletId: "wallet-1234",
   *   totalVolume: 500000,
   *   totalPnl: 25000,
   *   tradeCount: 150,
   *   winRate: 62.5,
   *   suspicionScore: 15,
   * });
   * ```
   */
  async createWalletSnapshot(input: CreateWalletSnapshotInput): Promise<WalletSnapshot> {
    return this.prisma.walletSnapshot.create({
      data: {
        walletId: input.walletId,
        totalVolume: input.totalVolume,
        totalPnl: input.totalPnl,
        tradeCount: input.tradeCount,
        winRate: input.winRate ?? null,
        suspicionScore: input.suspicionScore,
        positions: input.positions ?? Prisma.DbNull,
        timestamp: input.timestamp ?? new Date(),
      },
    });
  }

  /**
   * Create multiple wallet snapshots in a batch.
   *
   * @param inputs - Array of snapshot data to create
   * @returns Count of created snapshots
   */
  async createManyWalletSnapshots(
    inputs: CreateWalletSnapshotInput[]
  ): Promise<{ count: number }> {
    return this.prisma.walletSnapshot.createMany({
      data: inputs.map((input) => ({
        walletId: input.walletId,
        totalVolume: input.totalVolume,
        totalPnl: input.totalPnl,
        tradeCount: input.tradeCount,
        winRate: input.winRate ?? null,
        suspicionScore: input.suspicionScore,
        positions: input.positions ?? Prisma.DbNull,
        timestamp: input.timestamp ?? new Date(),
      })),
    });
  }

  /**
   * Find a wallet snapshot by ID.
   *
   * @param id - Snapshot ID
   * @param includeWallet - Whether to include the wallet relation
   * @returns The snapshot or null if not found
   */
  async findWalletSnapshotById(
    id: string,
    includeWallet = false
  ): Promise<WalletSnapshot | WalletSnapshotWithWallet | null> {
    return this.prisma.walletSnapshot.findUnique({
      where: { id },
      include: includeWallet ? { wallet: true } : undefined,
    });
  }

  /**
   * Find multiple wallet snapshots by IDs.
   *
   * @param ids - Array of snapshot IDs
   * @param includeWallet - Whether to include the wallet relation
   * @returns Array of found snapshots
   */
  async findWalletSnapshotsByIds(
    ids: string[],
    includeWallet = false
  ): Promise<WalletSnapshot[]> {
    return this.prisma.walletSnapshot.findMany({
      where: { id: { in: ids } },
      include: includeWallet ? { wallet: true } : undefined,
    });
  }

  /**
   * Delete a wallet snapshot by ID.
   *
   * @param id - Snapshot ID to delete
   * @returns The deleted snapshot
   */
  async deleteWalletSnapshot(id: string): Promise<WalletSnapshot> {
    return this.prisma.walletSnapshot.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple wallet snapshots by IDs.
   *
   * @param ids - Array of snapshot IDs to delete
   * @returns Count of deleted snapshots
   */
  async deleteManyWalletSnapshots(ids: string[]): Promise<{ count: number }> {
    return this.prisma.walletSnapshot.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Build Prisma where clause from wallet snapshot filters.
   */
  private buildWalletSnapshotWhereClause(
    filters: WalletSnapshotFilters
  ): Prisma.WalletSnapshotWhereInput {
    const where: Prisma.WalletSnapshotWhereInput = {};

    if (filters.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters.walletIds && filters.walletIds.length > 0) {
      where.walletId = { in: filters.walletIds };
    }

    if (filters.timestampAfter || filters.timestampBefore) {
      where.timestamp = {};
      if (filters.timestampAfter) {
        where.timestamp.gte = filters.timestampAfter;
      }
      if (filters.timestampBefore) {
        where.timestamp.lte = filters.timestampBefore;
      }
    }

    if (filters.minTotalVolume !== undefined || filters.maxTotalVolume !== undefined) {
      where.totalVolume = {};
      if (filters.minTotalVolume !== undefined) {
        where.totalVolume.gte = filters.minTotalVolume;
      }
      if (filters.maxTotalVolume !== undefined) {
        where.totalVolume.lte = filters.maxTotalVolume;
      }
    }

    if (
      filters.minSuspicionScore !== undefined ||
      filters.maxSuspicionScore !== undefined
    ) {
      where.suspicionScore = {};
      if (filters.minSuspicionScore !== undefined) {
        where.suspicionScore.gte = filters.minSuspicionScore;
      }
      if (filters.maxSuspicionScore !== undefined) {
        where.suspicionScore.lte = filters.maxSuspicionScore;
      }
    }

    if (filters.minPnl !== undefined || filters.maxPnl !== undefined) {
      where.totalPnl = {};
      if (filters.minPnl !== undefined) {
        where.totalPnl.gte = filters.minPnl;
      }
      if (filters.maxPnl !== undefined) {
        where.totalPnl.lte = filters.maxPnl;
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from wallet snapshot sort options.
   */
  private buildWalletSnapshotOrderByClause(
    sort?: WalletSnapshotSortOptions
  ): Prisma.WalletSnapshotOrderByWithRelationInput | undefined {
    if (!sort) {
      return { timestamp: "desc" }; // Default sort by newest first
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find wallet snapshots matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param includeWallet - Whether to include the wallet relation
   * @returns Paginated result of matching snapshots
   *
   * @example
   * ```typescript
   * const result = await snapshotService.findManyWalletSnapshots(
   *   { walletId: "wallet-1234", minSuspicionScore: 50 },
   *   { field: "timestamp", direction: "desc" },
   *   { take: 100 }
   * );
   * ```
   */
  async findManyWalletSnapshots(
    filters: WalletSnapshotFilters = {},
    sort?: WalletSnapshotSortOptions,
    pagination: SnapshotPaginationOptions = {},
    includeWallet = false
  ): Promise<PaginatedWalletSnapshotResult> {
    const where = this.buildWalletSnapshotWhereClause(filters);
    const orderBy = this.buildWalletSnapshotOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [snapshots, total] = await Promise.all([
      this.prisma.walletSnapshot.findMany({
        where,
        orderBy,
        skip,
        take,
        include: includeWallet ? { wallet: true } : undefined,
      }),
      this.prisma.walletSnapshot.count({ where }),
    ]);

    return {
      snapshots,
      total,
      skip,
      take,
      hasMore: skip + snapshots.length < total,
    };
  }

  /**
   * Find wallet snapshots for a specific wallet.
   *
   * @param walletId - Wallet ID
   * @param timeRange - Optional time range
   * @param pagination - Optional pagination
   * @returns Paginated snapshots for the wallet
   */
  async findWalletSnapshotsByWallet(
    walletId: string,
    timeRange?: TimeRange,
    pagination?: SnapshotPaginationOptions
  ): Promise<PaginatedWalletSnapshotResult> {
    const filters: WalletSnapshotFilters = { walletId };
    if (timeRange) {
      filters.timestampAfter = timeRange.start;
      filters.timestampBefore = timeRange.end;
    }
    return this.findManyWalletSnapshots(
      filters,
      { field: "timestamp", direction: "asc" },
      pagination
    );
  }

  /**
   * Get the latest snapshot for a wallet.
   *
   * @param walletId - Wallet ID
   * @param includeWallet - Whether to include the wallet relation
   * @returns The latest snapshot or null if none exist
   */
  async getLatestWalletSnapshot(
    walletId: string,
    includeWallet = false
  ): Promise<WalletSnapshot | WalletSnapshotWithWallet | null> {
    return this.prisma.walletSnapshot.findFirst({
      where: { walletId },
      orderBy: { timestamp: "desc" },
      include: includeWallet ? { wallet: true } : undefined,
    });
  }

  /**
   * Get the latest snapshots for multiple wallets.
   *
   * @param walletIds - Array of wallet IDs
   * @returns Map of wallet ID to latest snapshot
   */
  async getLatestWalletSnapshots(
    walletIds: string[]
  ): Promise<Map<string, WalletSnapshot>> {
    const snapshots = await this.prisma.walletSnapshot.findMany({
      where: { walletId: { in: walletIds } },
      orderBy: { timestamp: "desc" },
      distinct: ["walletId"],
    });

    const snapshotMap = new Map<string, WalletSnapshot>();
    for (const snapshot of snapshots) {
      snapshotMap.set(snapshot.walletId, snapshot);
    }

    return snapshotMap;
  }

  /**
   * Count wallet snapshots matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching snapshots
   */
  async countWalletSnapshots(filters: WalletSnapshotFilters = {}): Promise<number> {
    const where = this.buildWalletSnapshotWhereClause(filters);
    return this.prisma.walletSnapshot.count({ where });
  }

  /**
   * Get aggregated statistics for wallet snapshots.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregated statistics
   */
  async getWalletSnapshotStats(
    filters: WalletSnapshotFilters = {}
  ): Promise<WalletSnapshotStats> {
    const where = this.buildWalletSnapshotWhereClause(filters);

    const [aggregate, earliest, latest] = await Promise.all([
      this.prisma.walletSnapshot.aggregate({
        where,
        _count: { id: true },
        _avg: { totalVolume: true, totalPnl: true, suspicionScore: true },
        _max: { totalVolume: true, totalPnl: true },
      }),
      this.prisma.walletSnapshot.findFirst({
        where,
        orderBy: { timestamp: "asc" },
        select: { timestamp: true },
      }),
      this.prisma.walletSnapshot.findFirst({
        where,
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      }),
    ]);

    return {
      count: aggregate._count.id,
      earliest: earliest?.timestamp ?? null,
      latest: latest?.timestamp ?? null,
      avgTotalVolume: aggregate._avg.totalVolume ?? 0,
      avgPnl: aggregate._avg.totalPnl ?? 0,
      avgSuspicionScore: aggregate._avg.suspicionScore ?? 0,
      maxTotalVolume: aggregate._max.totalVolume ?? 0,
      maxPnl: aggregate._max.totalPnl ?? 0,
    };
  }

  /**
   * Delete wallet snapshots older than a certain date.
   *
   * @param olderThan - Delete snapshots older than this date
   * @param walletId - Optional wallet ID to limit deletion to specific wallet
   * @returns Count of deleted snapshots
   */
  async deleteOldWalletSnapshots(
    olderThan: Date,
    walletId?: string
  ): Promise<{ count: number }> {
    const where: Prisma.WalletSnapshotWhereInput = {
      timestamp: { lt: olderThan },
    };

    if (walletId) {
      where.walletId = walletId;
    }

    return this.prisma.walletSnapshot.deleteMany({ where });
  }

  /**
   * Delete wallet snapshots older than the retention period.
   *
   * @param retentionDays - Number of days to retain (defaults to service config)
   * @param walletId - Optional wallet ID to limit deletion to specific wallet
   * @returns Count of deleted snapshots
   */
  async cleanupOldWalletSnapshots(
    retentionDays?: number,
    walletId?: string
  ): Promise<{ count: number }> {
    const days = retentionDays ?? this.defaultRetentionDays;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.deleteOldWalletSnapshots(cutoffDate, walletId);
  }

  // =========================================================================
  // COMBINED OPERATIONS
  // =========================================================================

  /**
   * Create snapshots for both a market and related wallets in a transaction.
   *
   * @param marketSnapshot - Market snapshot input
   * @param walletSnapshots - Array of wallet snapshot inputs
   * @returns Object containing created market and wallet snapshots
   *
   * @example
   * ```typescript
   * const result = await snapshotService.createCombinedSnapshots(
   *   { marketId: "0x1234...", state: {...}, outcomePrices: {...}, volume: 1000, liquidity: 500 },
   *   [
   *     { walletId: "wallet-1", totalVolume: 5000, totalPnl: 250, tradeCount: 10, suspicionScore: 5 },
   *     { walletId: "wallet-2", totalVolume: 8000, totalPnl: -100, tradeCount: 15, suspicionScore: 20 },
   *   ]
   * );
   * ```
   */
  async createCombinedSnapshots(
    marketSnapshot: CreateMarketSnapshotInput,
    walletSnapshots: CreateWalletSnapshotInput[]
  ): Promise<{
    marketSnapshot: MarketSnapshot;
    walletSnapshots: WalletSnapshot[];
  }> {
    const timestamp = new Date();

    return this.prisma.$transaction(async (tx) => {
      const createdMarketSnapshot = await tx.marketSnapshot.create({
        data: {
          marketId: marketSnapshot.marketId,
          state: marketSnapshot.state,
          outcomePrices: marketSnapshot.outcomePrices,
          volume: marketSnapshot.volume,
          liquidity: marketSnapshot.liquidity,
          timestamp: marketSnapshot.timestamp ?? timestamp,
        },
      });

      const createdWalletSnapshots: WalletSnapshot[] = [];
      for (const input of walletSnapshots) {
        const snapshot = await tx.walletSnapshot.create({
          data: {
            walletId: input.walletId,
            totalVolume: input.totalVolume,
            totalPnl: input.totalPnl,
            tradeCount: input.tradeCount,
            winRate: input.winRate ?? null,
            suspicionScore: input.suspicionScore,
            positions: input.positions ?? Prisma.DbNull,
            timestamp: input.timestamp ?? timestamp,
          },
        });
        createdWalletSnapshots.push(snapshot);
      }

      return {
        marketSnapshot: createdMarketSnapshot,
        walletSnapshots: createdWalletSnapshots,
      };
    });
  }

  /**
   * Cleanup old snapshots for both markets and wallets.
   *
   * @param retentionDays - Number of days to retain (defaults to service config)
   * @returns Counts of deleted market and wallet snapshots
   */
  async cleanupAllOldSnapshots(retentionDays?: number): Promise<{
    marketSnapshots: { count: number };
    walletSnapshots: { count: number };
  }> {
    const [marketSnapshots, walletSnapshots] = await Promise.all([
      this.cleanupOldMarketSnapshots(retentionDays),
      this.cleanupOldWalletSnapshots(retentionDays),
    ]);

    return { marketSnapshots, walletSnapshots };
  }

  /**
   * Get total counts of all snapshots.
   *
   * @returns Counts of market and wallet snapshots
   */
  async getTotalSnapshotCounts(): Promise<{
    marketSnapshots: number;
    walletSnapshots: number;
    total: number;
  }> {
    const [marketSnapshots, walletSnapshots] = await Promise.all([
      this.prisma.marketSnapshot.count(),
      this.prisma.walletSnapshot.count(),
    ]);

    return {
      marketSnapshots,
      walletSnapshots,
      total: marketSnapshots + walletSnapshots,
    };
  }

  /**
   * Check if a market has any snapshots.
   *
   * @param marketId - Market ID
   * @returns True if market has snapshots
   */
  async marketHasSnapshots(marketId: string): Promise<boolean> {
    const count = await this.prisma.marketSnapshot.count({
      where: { marketId },
    });
    return count > 0;
  }

  /**
   * Check if a wallet has any snapshots.
   *
   * @param walletId - Wallet ID
   * @returns True if wallet has snapshots
   */
  async walletHasSnapshots(walletId: string): Promise<boolean> {
    const count = await this.prisma.walletSnapshot.count({
      where: { walletId },
    });
    return count > 0;
  }
}

/**
 * Default snapshot service instance using the singleton Prisma client.
 */
export const snapshotService = new SnapshotService();

/**
 * Create a new snapshot service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new SnapshotService instance
 */
export function createSnapshotService(config: SnapshotServiceConfig = {}): SnapshotService {
  return new SnapshotService(config);
}
