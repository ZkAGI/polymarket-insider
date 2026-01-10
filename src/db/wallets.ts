/**
 * Wallet Database Service
 *
 * CRUD operations and queries for the Wallet model.
 * Provides typed interfaces for interacting with wallet profile data in the database.
 */

import type { Wallet, Trade, Alert, WalletFundingSource, WalletSnapshot, WalletClusterMember, Prisma, PrismaClient } from "@prisma/client";
import { WalletType, RiskLevel, FundingSourceType } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { Wallet };
export { WalletType, RiskLevel, FundingSourceType };

/**
 * Wallet with related trades included
 */
export interface WalletWithTrades extends Wallet {
  trades: Trade[];
}

/**
 * Wallet with related alerts included
 */
export interface WalletWithAlerts extends Wallet {
  alerts: Alert[];
}

/**
 * Wallet with funding sources included
 */
export interface WalletWithFundingSources extends Wallet {
  fundingSources: WalletFundingSource[];
}

/**
 * Wallet with snapshots included
 */
export interface WalletWithSnapshots extends Wallet {
  snapshots: WalletSnapshot[];
}

/**
 * Wallet with cluster memberships included
 */
export interface WalletWithClusters extends Wallet {
  walletClusters: WalletClusterMember[];
}

/**
 * Wallet with all relations included
 */
export interface WalletWithRelations extends Wallet {
  trades: Trade[];
  alerts: Alert[];
  fundingSources: WalletFundingSource[];
  snapshots: WalletSnapshot[];
  walletClusters: WalletClusterMember[];
}

/**
 * Input for creating a new wallet
 */
export interface CreateWalletInput {
  /** Ethereum/Polygon wallet address (will be lowercased) */
  address: string;
  /** Human-readable label for the wallet */
  label?: string;
  /** Wallet type classification */
  walletType?: WalletType;
  /** Whether classified as a whale */
  isWhale?: boolean;
  /** Whether classified as potential insider */
  isInsider?: boolean;
  /** Whether this is a fresh/new wallet */
  isFresh?: boolean;
  /** Whether to monitor this wallet */
  isMonitored?: boolean;
  /** Whether flagged for suspicious activity */
  isFlagged?: boolean;
  /** Whether sanctioned (OFAC) */
  isSanctioned?: boolean;
  /** Suspicion score (0-100) */
  suspicionScore?: number;
  /** Risk level classification */
  riskLevel?: RiskLevel;
  /** Total trading volume in USD */
  totalVolume?: number;
  /** Total profit/loss in USD */
  totalPnl?: number;
  /** Total number of trades */
  tradeCount?: number;
  /** Number of winning trades */
  winCount?: number;
  /** Win rate percentage (0-100) */
  winRate?: number;
  /** Average trade size in USD */
  avgTradeSize?: number;
  /** Largest single trade in USD */
  maxTradeSize?: number;
  /** First Polymarket trade timestamp */
  firstTradeAt?: Date;
  /** Most recent trade timestamp */
  lastTradeAt?: Date;
  /** When the wallet was first seen on-chain */
  walletCreatedAt?: Date;
  /** Number of blockchain transactions */
  onChainTxCount?: number;
  /** Wallet age in days */
  walletAgeDays?: number;
  /** Primary funding source type */
  primaryFundingSource?: FundingSourceType;
  /** Additional metadata as JSON */
  metadata?: Prisma.InputJsonValue;
  /** Notes about the wallet */
  notes?: string;
}

/**
 * Input for updating an existing wallet
 */
export interface UpdateWalletInput {
  /** Human-readable label for the wallet */
  label?: string | null;
  /** Wallet type classification */
  walletType?: WalletType;
  /** Whether classified as a whale */
  isWhale?: boolean;
  /** Whether classified as potential insider */
  isInsider?: boolean;
  /** Whether this is a fresh/new wallet */
  isFresh?: boolean;
  /** Whether to monitor this wallet */
  isMonitored?: boolean;
  /** Whether flagged for suspicious activity */
  isFlagged?: boolean;
  /** Whether sanctioned (OFAC) */
  isSanctioned?: boolean;
  /** Suspicion score (0-100) */
  suspicionScore?: number;
  /** Risk level classification */
  riskLevel?: RiskLevel;
  /** Total trading volume in USD */
  totalVolume?: number;
  /** Total profit/loss in USD */
  totalPnl?: number;
  /** Total number of trades */
  tradeCount?: number;
  /** Number of winning trades */
  winCount?: number;
  /** Win rate percentage (0-100) */
  winRate?: number | null;
  /** Average trade size in USD */
  avgTradeSize?: number | null;
  /** Largest single trade in USD */
  maxTradeSize?: number | null;
  /** First Polymarket trade timestamp */
  firstTradeAt?: Date | null;
  /** Most recent trade timestamp */
  lastTradeAt?: Date | null;
  /** When the wallet was first seen on-chain */
  walletCreatedAt?: Date | null;
  /** Number of blockchain transactions */
  onChainTxCount?: number;
  /** Wallet age in days */
  walletAgeDays?: number | null;
  /** Primary funding source type */
  primaryFundingSource?: FundingSourceType | null;
  /** Additional metadata as JSON */
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  /** Notes about the wallet */
  notes?: string | null;
  /** Last time wallet data was synced */
  lastSyncedAt?: Date;
}

/**
 * Filters for querying wallets
 */
export interface WalletFilters {
  /** Filter by wallet type */
  walletType?: WalletType;
  /** Filter by whale status */
  isWhale?: boolean;
  /** Filter by insider status */
  isInsider?: boolean;
  /** Filter by fresh status */
  isFresh?: boolean;
  /** Filter by monitored status */
  isMonitored?: boolean;
  /** Filter by flagged status */
  isFlagged?: boolean;
  /** Filter by sanctioned status */
  isSanctioned?: boolean;
  /** Filter by risk level */
  riskLevel?: RiskLevel;
  /** Minimum suspicion score */
  minSuspicionScore?: number;
  /** Maximum suspicion score */
  maxSuspicionScore?: number;
  /** Minimum total volume */
  minTotalVolume?: number;
  /** Maximum total volume */
  maxTotalVolume?: number;
  /** Minimum trade count */
  minTradeCount?: number;
  /** Maximum trade count */
  maxTradeCount?: number;
  /** Minimum win rate */
  minWinRate?: number;
  /** Maximum win rate */
  maxWinRate?: number;
  /** First trade after this date */
  firstTradeAfter?: Date;
  /** First trade before this date */
  firstTradeBefore?: Date;
  /** Last trade after this date */
  lastTradeAfter?: Date;
  /** Last trade before this date */
  lastTradeBefore?: Date;
  /** Wallet created after this date */
  walletCreatedAfter?: Date;
  /** Wallet created before this date */
  walletCreatedBefore?: Date;
  /** Filter by primary funding source */
  primaryFundingSource?: FundingSourceType;
  /** Search by label (partial match) */
  labelContains?: string;
  /** Search by address (partial match) */
  addressContains?: string;
}

/**
 * Sorting options for wallet queries
 */
export interface WalletSortOptions {
  /** Field to sort by */
  field: "suspicionScore" | "totalVolume" | "totalPnl" | "tradeCount" | "winRate" | "firstTradeAt" | "lastTradeAt" | "walletCreatedAt" | "createdAt" | "updatedAt";
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
 * Result from paginated wallet queries
 */
export interface PaginatedWalletResult {
  /** Wallets matching the query */
  wallets: Wallet[];
  /** Total count of matching wallets */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Include options for wallet queries
 */
export interface WalletIncludeOptions {
  /** Include trades relation */
  trades?: boolean;
  /** Include alerts relation */
  alerts?: boolean;
  /** Include funding sources relation */
  fundingSources?: boolean;
  /** Include snapshots relation */
  snapshots?: boolean;
  /** Include cluster memberships relation */
  walletClusters?: boolean;
}

/**
 * Wallet service configuration
 */
export interface WalletServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
}

/**
 * Wallet aggregate statistics
 */
export interface WalletStats {
  /** Total number of wallets */
  count: number;
  /** Total trading volume across all wallets */
  totalVolume: number;
  /** Average suspicion score */
  avgSuspicionScore: number;
  /** Total trade count across all wallets */
  totalTradeCount: number;
  /** Number of whale wallets */
  whaleCount: number;
  /** Number of insider wallets */
  insiderCount: number;
  /** Number of fresh wallets */
  freshCount: number;
  /** Number of monitored wallets */
  monitoredCount: number;
  /** Number of flagged wallets */
  flaggedCount: number;
}

/**
 * Wallet Database Service
 *
 * Provides CRUD operations and queries for the Wallet model.
 */
export class WalletService {
  private prisma: PrismaClient;

  constructor(config: WalletServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
  }

  /**
   * Normalize wallet address to lowercase.
   */
  private normalizeAddress(address: string): string {
    return address.toLowerCase();
  }

  /**
   * Create a new wallet.
   *
   * @param input - Wallet data to create
   * @returns The created wallet
   * @throws If wallet with same address already exists
   *
   * @example
   * ```typescript
   * const wallet = await walletService.create({
   *   address: "0x1234567890abcdef1234567890abcdef12345678",
   *   label: "Known Whale",
   *   isWhale: true,
   * });
   * ```
   */
  async create(input: CreateWalletInput): Promise<Wallet> {
    return this.prisma.wallet.create({
      data: {
        address: this.normalizeAddress(input.address),
        label: input.label,
        walletType: input.walletType ?? WalletType.UNKNOWN,
        isWhale: input.isWhale ?? false,
        isInsider: input.isInsider ?? false,
        isFresh: input.isFresh ?? false,
        isMonitored: input.isMonitored ?? false,
        isFlagged: input.isFlagged ?? false,
        isSanctioned: input.isSanctioned ?? false,
        suspicionScore: input.suspicionScore ?? 0,
        riskLevel: input.riskLevel ?? RiskLevel.NONE,
        totalVolume: input.totalVolume ?? 0,
        totalPnl: input.totalPnl ?? 0,
        tradeCount: input.tradeCount ?? 0,
        winCount: input.winCount ?? 0,
        winRate: input.winRate,
        avgTradeSize: input.avgTradeSize,
        maxTradeSize: input.maxTradeSize,
        firstTradeAt: input.firstTradeAt,
        lastTradeAt: input.lastTradeAt,
        walletCreatedAt: input.walletCreatedAt,
        onChainTxCount: input.onChainTxCount ?? 0,
        walletAgeDays: input.walletAgeDays,
        primaryFundingSource: input.primaryFundingSource,
        metadata: input.metadata,
        notes: input.notes,
      },
    });
  }

  /**
   * Find a wallet by its unique ID.
   *
   * @param id - The wallet ID
   * @param include - Relations to include
   * @returns The wallet or null if not found
   *
   * @example
   * ```typescript
   * const wallet = await walletService.findById("wallet-1", { trades: true });
   * if (wallet) {
   *   console.log(`Wallet has ${wallet.trades.length} trades`);
   * }
   * ```
   */
  async findById(id: string, include?: WalletIncludeOptions): Promise<Wallet | WalletWithRelations | null> {
    return this.prisma.wallet.findUnique({
      where: { id },
      include: include ? {
        trades: include.trades ?? false,
        alerts: include.alerts ?? false,
        fundingSources: include.fundingSources ?? false,
        snapshots: include.snapshots ?? false,
        walletClusters: include.walletClusters ?? false,
      } : undefined,
    });
  }

  /**
   * Find a wallet by its address.
   *
   * @param address - The wallet address
   * @param include - Relations to include
   * @returns The wallet or null if not found
   *
   * @example
   * ```typescript
   * const wallet = await walletService.findByAddress("0x1234...");
   * ```
   */
  async findByAddress(
    address: string,
    include?: WalletIncludeOptions
  ): Promise<Wallet | WalletWithRelations | null> {
    return this.prisma.wallet.findUnique({
      where: { address: this.normalizeAddress(address) },
      include: include ? {
        trades: include.trades ?? false,
        alerts: include.alerts ?? false,
        fundingSources: include.fundingSources ?? false,
        snapshots: include.snapshots ?? false,
        walletClusters: include.walletClusters ?? false,
      } : undefined,
    });
  }

  /**
   * Find multiple wallets by their IDs.
   *
   * @param ids - Array of wallet IDs
   * @param include - Relations to include
   * @returns Array of found wallets
   */
  async findByIds(ids: string[], include?: WalletIncludeOptions): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({
      where: { id: { in: ids } },
      include: include ? {
        trades: include.trades ?? false,
        alerts: include.alerts ?? false,
        fundingSources: include.fundingSources ?? false,
        snapshots: include.snapshots ?? false,
        walletClusters: include.walletClusters ?? false,
      } : undefined,
    });
  }

  /**
   * Find multiple wallets by their addresses.
   *
   * @param addresses - Array of wallet addresses
   * @param include - Relations to include
   * @returns Array of found wallets
   */
  async findByAddresses(addresses: string[], include?: WalletIncludeOptions): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({
      where: { address: { in: addresses.map(a => this.normalizeAddress(a)) } },
      include: include ? {
        trades: include.trades ?? false,
        alerts: include.alerts ?? false,
        fundingSources: include.fundingSources ?? false,
        snapshots: include.snapshots ?? false,
        walletClusters: include.walletClusters ?? false,
      } : undefined,
    });
  }

  /**
   * Update an existing wallet.
   *
   * @param id - The wallet ID to update
   * @param input - Fields to update
   * @returns The updated wallet
   * @throws If wallet not found
   *
   * @example
   * ```typescript
   * const updated = await walletService.update("wallet-1", {
   *   isWhale: true,
   *   suspicionScore: 75,
   *   riskLevel: RiskLevel.HIGH,
   * });
   * ```
   */
  async update(id: string, input: UpdateWalletInput): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Update a wallet by its address.
   *
   * @param address - The wallet address to update
   * @param input - Fields to update
   * @returns The updated wallet
   * @throws If wallet not found
   */
  async updateByAddress(address: string, input: UpdateWalletInput): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { address: this.normalizeAddress(address) },
      data: input,
    });
  }

  /**
   * Upsert a wallet by address.
   *
   * @param address - The wallet address
   * @param input - Wallet data
   * @returns The created or updated wallet
   *
   * @example
   * ```typescript
   * const wallet = await walletService.upsertByAddress("0x1234...", {
   *   address: "0x1234...",
   *   label: "Known Whale",
   *   isWhale: true,
   * });
   * ```
   */
  async upsertByAddress(address: string, input: CreateWalletInput): Promise<Wallet> {
    const normalizedAddress = this.normalizeAddress(address);
    return this.prisma.wallet.upsert({
      where: { address: normalizedAddress },
      create: {
        address: normalizedAddress,
        label: input.label,
        walletType: input.walletType ?? WalletType.UNKNOWN,
        isWhale: input.isWhale ?? false,
        isInsider: input.isInsider ?? false,
        isFresh: input.isFresh ?? false,
        isMonitored: input.isMonitored ?? false,
        isFlagged: input.isFlagged ?? false,
        isSanctioned: input.isSanctioned ?? false,
        suspicionScore: input.suspicionScore ?? 0,
        riskLevel: input.riskLevel ?? RiskLevel.NONE,
        totalVolume: input.totalVolume ?? 0,
        totalPnl: input.totalPnl ?? 0,
        tradeCount: input.tradeCount ?? 0,
        winCount: input.winCount ?? 0,
        winRate: input.winRate,
        avgTradeSize: input.avgTradeSize,
        maxTradeSize: input.maxTradeSize,
        firstTradeAt: input.firstTradeAt,
        lastTradeAt: input.lastTradeAt,
        walletCreatedAt: input.walletCreatedAt,
        onChainTxCount: input.onChainTxCount ?? 0,
        walletAgeDays: input.walletAgeDays,
        primaryFundingSource: input.primaryFundingSource,
        metadata: input.metadata,
        notes: input.notes,
      },
      update: {
        label: input.label,
        walletType: input.walletType,
        isWhale: input.isWhale,
        isInsider: input.isInsider,
        isFresh: input.isFresh,
        isMonitored: input.isMonitored,
        isFlagged: input.isFlagged,
        isSanctioned: input.isSanctioned,
        suspicionScore: input.suspicionScore,
        riskLevel: input.riskLevel,
        totalVolume: input.totalVolume,
        totalPnl: input.totalPnl,
        tradeCount: input.tradeCount,
        winCount: input.winCount,
        winRate: input.winRate,
        avgTradeSize: input.avgTradeSize,
        maxTradeSize: input.maxTradeSize,
        firstTradeAt: input.firstTradeAt,
        lastTradeAt: input.lastTradeAt,
        walletCreatedAt: input.walletCreatedAt,
        onChainTxCount: input.onChainTxCount,
        walletAgeDays: input.walletAgeDays,
        primaryFundingSource: input.primaryFundingSource,
        metadata: input.metadata,
        notes: input.notes,
      },
    });
  }

  /**
   * Delete a wallet by ID.
   *
   * @param id - The wallet ID to delete
   * @returns The deleted wallet
   * @throws If wallet not found
   *
   * @example
   * ```typescript
   * await walletService.delete("wallet-1");
   * ```
   */
  async delete(id: string): Promise<Wallet> {
    return this.prisma.wallet.delete({
      where: { id },
    });
  }

  /**
   * Delete a wallet by address.
   *
   * @param address - The wallet address to delete
   * @returns The deleted wallet
   * @throws If wallet not found
   */
  async deleteByAddress(address: string): Promise<Wallet> {
    return this.prisma.wallet.delete({
      where: { address: this.normalizeAddress(address) },
    });
  }

  /**
   * Delete multiple wallets by IDs.
   *
   * @param ids - Array of wallet IDs to delete
   * @returns Count of deleted wallets
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.wallet.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Build Prisma where clause from filters.
   */
  private buildWhereClause(filters: WalletFilters): Prisma.WalletWhereInput {
    const where: Prisma.WalletWhereInput = {};

    if (filters.walletType) {
      where.walletType = filters.walletType;
    }

    if (filters.isWhale !== undefined) {
      where.isWhale = filters.isWhale;
    }

    if (filters.isInsider !== undefined) {
      where.isInsider = filters.isInsider;
    }

    if (filters.isFresh !== undefined) {
      where.isFresh = filters.isFresh;
    }

    if (filters.isMonitored !== undefined) {
      where.isMonitored = filters.isMonitored;
    }

    if (filters.isFlagged !== undefined) {
      where.isFlagged = filters.isFlagged;
    }

    if (filters.isSanctioned !== undefined) {
      where.isSanctioned = filters.isSanctioned;
    }

    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }

    if (filters.primaryFundingSource) {
      where.primaryFundingSource = filters.primaryFundingSource;
    }

    if (filters.minSuspicionScore !== undefined || filters.maxSuspicionScore !== undefined) {
      where.suspicionScore = {};
      if (filters.minSuspicionScore !== undefined) {
        where.suspicionScore.gte = filters.minSuspicionScore;
      }
      if (filters.maxSuspicionScore !== undefined) {
        where.suspicionScore.lte = filters.maxSuspicionScore;
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

    if (filters.minTradeCount !== undefined || filters.maxTradeCount !== undefined) {
      where.tradeCount = {};
      if (filters.minTradeCount !== undefined) {
        where.tradeCount.gte = filters.minTradeCount;
      }
      if (filters.maxTradeCount !== undefined) {
        where.tradeCount.lte = filters.maxTradeCount;
      }
    }

    if (filters.minWinRate !== undefined || filters.maxWinRate !== undefined) {
      where.winRate = {};
      if (filters.minWinRate !== undefined) {
        where.winRate.gte = filters.minWinRate;
      }
      if (filters.maxWinRate !== undefined) {
        where.winRate.lte = filters.maxWinRate;
      }
    }

    if (filters.firstTradeAfter || filters.firstTradeBefore) {
      where.firstTradeAt = {};
      if (filters.firstTradeAfter) {
        where.firstTradeAt.gte = filters.firstTradeAfter;
      }
      if (filters.firstTradeBefore) {
        where.firstTradeAt.lte = filters.firstTradeBefore;
      }
    }

    if (filters.lastTradeAfter || filters.lastTradeBefore) {
      where.lastTradeAt = {};
      if (filters.lastTradeAfter) {
        where.lastTradeAt.gte = filters.lastTradeAfter;
      }
      if (filters.lastTradeBefore) {
        where.lastTradeAt.lte = filters.lastTradeBefore;
      }
    }

    if (filters.walletCreatedAfter || filters.walletCreatedBefore) {
      where.walletCreatedAt = {};
      if (filters.walletCreatedAfter) {
        where.walletCreatedAt.gte = filters.walletCreatedAfter;
      }
      if (filters.walletCreatedBefore) {
        where.walletCreatedAt.lte = filters.walletCreatedBefore;
      }
    }

    if (filters.labelContains) {
      where.label = { contains: filters.labelContains, mode: "insensitive" };
    }

    if (filters.addressContains) {
      where.address = { contains: this.normalizeAddress(filters.addressContains), mode: "insensitive" };
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options.
   */
  private buildOrderByClause(
    sort?: WalletSortOptions
  ): Prisma.WalletOrderByWithRelationInput | undefined {
    if (!sort) {
      return { createdAt: "desc" }; // Default sort
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find wallets matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param include - Optional relations to include
   * @returns Paginated result of matching wallets
   *
   * @example
   * ```typescript
   * // Find whale wallets with high suspicion scores
   * const result = await walletService.findMany(
   *   {
   *     isWhale: true,
   *     minSuspicionScore: 50,
   *   },
   *   { field: "suspicionScore", direction: "desc" },
   *   { take: 20 }
   * );
   *
   * console.log(`Found ${result.total} suspicious whales`);
   * ```
   */
  async findMany(
    filters: WalletFilters = {},
    sort?: WalletSortOptions,
    pagination: PaginationOptions = {},
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [wallets, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        orderBy,
        skip,
        take,
        include: include ? {
          trades: include.trades ?? false,
          alerts: include.alerts ?? false,
          fundingSources: include.fundingSources ?? false,
          snapshots: include.snapshots ?? false,
          walletClusters: include.walletClusters ?? false,
        } : undefined,
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return {
      wallets,
      total,
      skip,
      take,
      hasMore: skip + wallets.length < total,
    };
  }

  /**
   * Find whale wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated whale wallets
   */
  async findWhales(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isWhale: true }, sort, pagination, include);
  }

  /**
   * Find insider wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated insider wallets
   */
  async findInsiders(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isInsider: true }, sort, pagination, include);
  }

  /**
   * Find fresh wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated fresh wallets
   */
  async findFresh(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isFresh: true }, sort, pagination, include);
  }

  /**
   * Find monitored wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated monitored wallets
   */
  async findMonitored(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isMonitored: true }, sort, pagination, include);
  }

  /**
   * Find flagged wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated flagged wallets
   */
  async findFlagged(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isFlagged: true }, sort, pagination, include);
  }

  /**
   * Find sanctioned wallets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated sanctioned wallets
   */
  async findSanctioned(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ isSanctioned: true }, sort, pagination, include);
  }

  /**
   * Find wallets by risk level.
   *
   * @param riskLevel - The risk level to filter by
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated wallets with the specified risk level
   */
  async findByRiskLevel(
    riskLevel: RiskLevel,
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    return this.findMany({ riskLevel }, sort, pagination, include);
  }

  /**
   * Find high-risk wallets (MEDIUM, HIGH, or CRITICAL risk levels).
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated high-risk wallets
   */
  async findHighRisk(
    sort?: WalletSortOptions,
    pagination?: PaginationOptions,
    include?: WalletIncludeOptions
  ): Promise<PaginatedWalletResult> {
    const where: Prisma.WalletWhereInput = {
      riskLevel: { in: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL] },
    };
    const orderBy = this.buildOrderByClause(sort);
    const skip = pagination?.skip ?? 0;
    const take = pagination?.take ?? 100;

    const [wallets, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        orderBy,
        skip,
        take,
        include: include ? {
          trades: include.trades ?? false,
          alerts: include.alerts ?? false,
          fundingSources: include.fundingSources ?? false,
          snapshots: include.snapshots ?? false,
          walletClusters: include.walletClusters ?? false,
        } : undefined,
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return {
      wallets,
      total,
      skip,
      take,
      hasMore: skip + wallets.length < total,
    };
  }

  /**
   * Get top wallets by volume.
   *
   * @param limit - Number of wallets to return
   * @param filters - Optional additional filters
   * @param include - Optional relations to include
   * @returns Top wallets sorted by total volume
   */
  async getTopByVolume(
    limit = 50,
    filters: WalletFilters = {},
    include?: WalletIncludeOptions
  ): Promise<Wallet[]> {
    const result = await this.findMany(
      filters,
      { field: "totalVolume", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Get top wallets by suspicion score.
   *
   * @param limit - Number of wallets to return
   * @param filters - Optional additional filters
   * @param include - Optional relations to include
   * @returns Top wallets sorted by suspicion score
   */
  async getTopBySuspicionScore(
    limit = 50,
    filters: WalletFilters = {},
    include?: WalletIncludeOptions
  ): Promise<Wallet[]> {
    const result = await this.findMany(
      filters,
      { field: "suspicionScore", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Get top wallets by trade count.
   *
   * @param limit - Number of wallets to return
   * @param filters - Optional additional filters
   * @param include - Optional relations to include
   * @returns Top wallets sorted by trade count
   */
  async getTopByTradeCount(
    limit = 50,
    filters: WalletFilters = {},
    include?: WalletIncludeOptions
  ): Promise<Wallet[]> {
    const result = await this.findMany(
      filters,
      { field: "tradeCount", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Get top wallets by PnL.
   *
   * @param limit - Number of wallets to return
   * @param filters - Optional additional filters
   * @param include - Optional relations to include
   * @returns Top wallets sorted by total PnL
   */
  async getTopByPnl(
    limit = 50,
    filters: WalletFilters = {},
    include?: WalletIncludeOptions
  ): Promise<Wallet[]> {
    const result = await this.findMany(
      filters,
      { field: "totalPnl", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Get recently active wallets.
   *
   * @param limit - Number of wallets to return
   * @param include - Optional relations to include
   * @returns Wallets sorted by last trade timestamp
   */
  async getRecentlyActive(limit = 50, include?: WalletIncludeOptions): Promise<Wallet[]> {
    const result = await this.findMany(
      {},
      { field: "lastTradeAt", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Get newest wallets.
   *
   * @param limit - Number of wallets to return
   * @param include - Optional relations to include
   * @returns Wallets sorted by creation timestamp
   */
  async getNewest(limit = 50, include?: WalletIncludeOptions): Promise<Wallet[]> {
    const result = await this.findMany(
      {},
      { field: "createdAt", direction: "desc" },
      { take: limit },
      include
    );
    return result.wallets;
  }

  /**
   * Count wallets matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching wallets
   */
  async count(filters: WalletFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.wallet.count({ where });
  }

  /**
   * Check if a wallet exists by ID.
   *
   * @param id - The wallet ID
   * @returns True if wallet exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.wallet.count({ where: { id } });
    return count > 0;
  }

  /**
   * Check if a wallet exists by address.
   *
   * @param address - The wallet address
   * @returns True if wallet exists
   */
  async existsByAddress(address: string): Promise<boolean> {
    const count = await this.prisma.wallet.count({
      where: { address: this.normalizeAddress(address) },
    });
    return count > 0;
  }

  /**
   * Bulk create wallets.
   *
   * @param wallets - Array of wallets to create
   * @returns Count of created wallets
   */
  async createMany(wallets: CreateWalletInput[]): Promise<{ count: number }> {
    return this.prisma.wallet.createMany({
      data: wallets.map((wallet) => ({
        address: this.normalizeAddress(wallet.address),
        label: wallet.label,
        walletType: wallet.walletType ?? WalletType.UNKNOWN,
        isWhale: wallet.isWhale ?? false,
        isInsider: wallet.isInsider ?? false,
        isFresh: wallet.isFresh ?? false,
        isMonitored: wallet.isMonitored ?? false,
        isFlagged: wallet.isFlagged ?? false,
        isSanctioned: wallet.isSanctioned ?? false,
        suspicionScore: wallet.suspicionScore ?? 0,
        riskLevel: wallet.riskLevel ?? RiskLevel.NONE,
        totalVolume: wallet.totalVolume ?? 0,
        totalPnl: wallet.totalPnl ?? 0,
        tradeCount: wallet.tradeCount ?? 0,
        winCount: wallet.winCount ?? 0,
        winRate: wallet.winRate,
        avgTradeSize: wallet.avgTradeSize,
        maxTradeSize: wallet.maxTradeSize,
        firstTradeAt: wallet.firstTradeAt,
        lastTradeAt: wallet.lastTradeAt,
        walletCreatedAt: wallet.walletCreatedAt,
        onChainTxCount: wallet.onChainTxCount ?? 0,
        walletAgeDays: wallet.walletAgeDays,
        primaryFundingSource: wallet.primaryFundingSource,
        metadata: wallet.metadata,
        notes: wallet.notes,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Mark a wallet as a whale.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsWhale(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isWhale: true },
    });
  }

  /**
   * Mark a wallet as an insider.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsInsider(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isInsider: true },
    });
  }

  /**
   * Mark a wallet as fresh.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsFresh(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isFresh: true },
    });
  }

  /**
   * Mark a wallet as monitored.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsMonitored(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isMonitored: true },
    });
  }

  /**
   * Mark a wallet as flagged.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsFlagged(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isFlagged: true },
    });
  }

  /**
   * Mark a wallet as sanctioned.
   *
   * @param id - The wallet ID
   * @returns The updated wallet
   */
  async markAsSanctioned(id: string): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { isSanctioned: true, riskLevel: RiskLevel.CRITICAL },
    });
  }

  /**
   * Unmark a wallet (remove a flag).
   *
   * @param id - The wallet ID
   * @param flag - The flag to remove
   * @returns The updated wallet
   */
  async unmark(id: string, flag: "isWhale" | "isInsider" | "isFresh" | "isMonitored" | "isFlagged" | "isSanctioned"): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { [flag]: false },
    });
  }

  /**
   * Update suspicion score for a wallet.
   *
   * @param id - The wallet ID
   * @param score - The new suspicion score (0-100)
   * @returns The updated wallet
   */
  async updateSuspicionScore(id: string, score: number): Promise<Wallet> {
    // Clamp score to 0-100 range
    const clampedScore = Math.max(0, Math.min(100, score));

    // Determine risk level based on score
    let riskLevel: RiskLevel;
    if (clampedScore >= 80) {
      riskLevel = RiskLevel.CRITICAL;
    } else if (clampedScore >= 60) {
      riskLevel = RiskLevel.HIGH;
    } else if (clampedScore >= 40) {
      riskLevel = RiskLevel.MEDIUM;
    } else if (clampedScore >= 20) {
      riskLevel = RiskLevel.LOW;
    } else {
      riskLevel = RiskLevel.NONE;
    }

    return this.prisma.wallet.update({
      where: { id },
      data: { suspicionScore: clampedScore, riskLevel },
    });
  }

  /**
   * Update risk level for a wallet.
   *
   * @param id - The wallet ID
   * @param riskLevel - The new risk level
   * @returns The updated wallet
   */
  async updateRiskLevel(id: string, riskLevel: RiskLevel): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: { riskLevel },
    });
  }

  /**
   * Increment trade statistics for a wallet.
   *
   * @param id - The wallet ID
   * @param tradeAmount - USD value of the trade
   * @param isWin - Whether this trade is a win (if known)
   * @returns The updated wallet
   */
  async incrementTradeStats(id: string, tradeAmount: number, isWin?: boolean): Promise<Wallet> {
    const wallet = await this.findById(id);
    if (!wallet) {
      throw new Error(`Wallet not found: ${id}`);
    }

    const newTradeCount = wallet.tradeCount + 1;
    const newTotalVolume = wallet.totalVolume + tradeAmount;
    const newMaxTradeSize = Math.max(wallet.maxTradeSize ?? 0, tradeAmount);
    const newAvgTradeSize = newTotalVolume / newTradeCount;

    let newWinCount = wallet.winCount;
    let newWinRate = wallet.winRate;
    if (isWin !== undefined) {
      if (isWin) {
        newWinCount = wallet.winCount + 1;
      }
      newWinRate = (newWinCount / newTradeCount) * 100;
    }

    return this.prisma.wallet.update({
      where: { id },
      data: {
        tradeCount: newTradeCount,
        totalVolume: newTotalVolume,
        maxTradeSize: newMaxTradeSize,
        avgTradeSize: newAvgTradeSize,
        winCount: newWinCount,
        winRate: newWinRate,
        lastTradeAt: new Date(),
        firstTradeAt: wallet.firstTradeAt ?? new Date(),
      },
    });
  }

  /**
   * Update wallet's on-chain data.
   *
   * @param id - The wallet ID
   * @param data - On-chain data to update
   * @returns The updated wallet
   */
  async updateOnChainData(
    id: string,
    data: {
      walletCreatedAt?: Date;
      onChainTxCount?: number;
      walletAgeDays?: number;
    }
  ): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { id },
      data: {
        walletCreatedAt: data.walletCreatedAt,
        onChainTxCount: data.onChainTxCount,
        walletAgeDays: data.walletAgeDays,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Get aggregate statistics for wallets.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregate statistics
   */
  async getStats(filters: WalletFilters = {}): Promise<WalletStats> {
    const where = this.buildWhereClause(filters);

    const [aggregates, whaleCount, insiderCount, freshCount, monitoredCount, flaggedCount] = await Promise.all([
      this.prisma.wallet.aggregate({
        where,
        _count: { id: true },
        _sum: { totalVolume: true, tradeCount: true },
        _avg: { suspicionScore: true },
      }),
      this.prisma.wallet.count({ where: { ...where, isWhale: true } }),
      this.prisma.wallet.count({ where: { ...where, isInsider: true } }),
      this.prisma.wallet.count({ where: { ...where, isFresh: true } }),
      this.prisma.wallet.count({ where: { ...where, isMonitored: true } }),
      this.prisma.wallet.count({ where: { ...where, isFlagged: true } }),
    ]);

    return {
      count: aggregates._count.id,
      totalVolume: aggregates._sum.totalVolume ?? 0,
      avgSuspicionScore: aggregates._avg.suspicionScore ?? 0,
      totalTradeCount: aggregates._sum.tradeCount ?? 0,
      whaleCount,
      insiderCount,
      freshCount,
      monitoredCount,
      flaggedCount,
    };
  }

  /**
   * Get wallet count grouped by risk level.
   *
   * @returns Wallet counts by risk level
   */
  async getCountByRiskLevel(): Promise<Record<RiskLevel, number>> {
    const groups = await this.prisma.wallet.groupBy({
      by: ["riskLevel"],
      _count: { id: true },
    });

    const result: Record<RiskLevel, number> = {
      [RiskLevel.NONE]: 0,
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0,
    };

    for (const group of groups) {
      result[group.riskLevel] = group._count.id;
    }

    return result;
  }

  /**
   * Get wallet count grouped by wallet type.
   *
   * @returns Wallet counts by wallet type
   */
  async getCountByWalletType(): Promise<Record<WalletType, number>> {
    const groups = await this.prisma.wallet.groupBy({
      by: ["walletType"],
      _count: { id: true },
    });

    const result: Record<WalletType, number> = {
      [WalletType.UNKNOWN]: 0,
      [WalletType.EOA]: 0,
      [WalletType.CONTRACT]: 0,
      [WalletType.EXCHANGE]: 0,
      [WalletType.DEFI]: 0,
      [WalletType.MARKET_MAKER]: 0,
      [WalletType.INSTITUTIONAL]: 0,
      [WalletType.BOT]: 0,
    };

    for (const group of groups) {
      result[group.walletType] = group._count.id;
    }

    return result;
  }

  /**
   * Search wallets by address or label.
   *
   * @param query - Search query
   * @param pagination - Optional pagination
   * @returns Paginated search results
   */
  async search(query: string, pagination?: PaginationOptions): Promise<PaginatedWalletResult> {
    const normalizedQuery = this.normalizeAddress(query);
    const where: Prisma.WalletWhereInput = {
      OR: [
        { address: { contains: normalizedQuery, mode: "insensitive" } },
        { label: { contains: query, mode: "insensitive" } },
      ],
    };

    const skip = pagination?.skip ?? 0;
    const take = pagination?.take ?? 100;

    const [wallets, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        orderBy: { totalVolume: "desc" },
        skip,
        take,
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return {
      wallets,
      total,
      skip,
      take,
      hasMore: skip + wallets.length < total,
    };
  }

  /**
   * Find or create a wallet by address.
   *
   * @param address - The wallet address
   * @param defaults - Default values for creation
   * @returns The found or created wallet, and whether it was created
   */
  async findOrCreate(
    address: string,
    defaults: Omit<CreateWalletInput, "address"> = {}
  ): Promise<{ wallet: Wallet; created: boolean }> {
    const normalizedAddress = this.normalizeAddress(address);
    const existing = await this.findByAddress(normalizedAddress);

    if (existing) {
      return { wallet: existing, created: false };
    }

    const wallet = await this.create({
      ...defaults,
      address: normalizedAddress,
    });

    return { wallet, created: true };
  }
}

/**
 * Default wallet service instance using the singleton Prisma client.
 */
export const walletService = new WalletService();

/**
 * Create a new wallet service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new WalletService instance
 */
export function createWalletService(config: WalletServiceConfig = {}): WalletService {
  return new WalletService(config);
}
