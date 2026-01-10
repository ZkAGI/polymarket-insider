/**
 * Trade Database Service
 *
 * CRUD operations and queries for the Trade model.
 * Provides typed interfaces for interacting with trade data in the database.
 */

import type { Trade, Market, Outcome, Wallet, Prisma, PrismaClient } from "@prisma/client";
import { TradeSide } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { Trade };
export { TradeSide };

/**
 * Trade with related market included
 */
export interface TradeWithMarket extends Trade {
  market: Market;
}

/**
 * Trade with related outcome included
 */
export interface TradeWithOutcome extends Trade {
  outcome: Outcome;
}

/**
 * Trade with related wallet included
 */
export interface TradeWithWallet extends Trade {
  wallet: Wallet;
}

/**
 * Trade with all relations included
 */
export interface TradeWithRelations extends Trade {
  market: Market;
  outcome: Outcome;
  wallet: Wallet;
}

/**
 * Input for creating a new trade
 */
export interface CreateTradeInput {
  /** Market ID this trade belongs to */
  marketId: string;
  /** Outcome ID this trade is for */
  outcomeId: string;
  /** Wallet ID of the trader */
  walletId: string;
  /** Trade ID from CLOB API */
  clobTradeId?: string;
  /** Match ID linking maker and taker */
  matchId?: string;
  /** Trade side (BUY/SELL) */
  side: TradeSide;
  /** Share amount traded */
  amount: number;
  /** Execution price (0-1) */
  price: number;
  /** Trade value in USD */
  usdValue: number;
  /** Fee amount in USD */
  feeUsd?: number;
  /** Maker address */
  makerAddress?: string;
  /** Taker address */
  takerAddress?: string;
  /** Whether wallet was maker or taker */
  isMaker?: boolean;
  /** Execution timestamp */
  timestamp: Date;
  /** On-chain transaction hash */
  txHash?: string;
  /** Block number */
  blockNumber?: bigint;
  /** Whether classified as whale trade */
  isWhale?: boolean;
  /** Whether this appears to be insider activity */
  isInsider?: boolean;
  /** Trade flags */
  flags?: string[];
}

/**
 * Input for updating an existing trade
 */
export interface UpdateTradeInput {
  /** Trade ID from CLOB API */
  clobTradeId?: string | null;
  /** Match ID linking maker and taker */
  matchId?: string | null;
  /** Fee amount in USD */
  feeUsd?: number;
  /** Maker address */
  makerAddress?: string | null;
  /** Taker address */
  takerAddress?: string | null;
  /** Whether wallet was maker or taker */
  isMaker?: boolean | null;
  /** On-chain transaction hash */
  txHash?: string | null;
  /** Block number */
  blockNumber?: bigint | null;
  /** Whether classified as whale trade */
  isWhale?: boolean;
  /** Whether this appears to be insider activity */
  isInsider?: boolean;
  /** Trade flags */
  flags?: string[];
}

/**
 * Filters for querying trades
 */
export interface TradeFilters {
  /** Filter by market ID */
  marketId?: string;
  /** Filter by outcome ID */
  outcomeId?: string;
  /** Filter by wallet ID */
  walletId?: string;
  /** Filter by trade side */
  side?: TradeSide;
  /** Filter by whale status */
  isWhale?: boolean;
  /** Filter by insider status */
  isInsider?: boolean;
  /** Filter by match ID */
  matchId?: string;
  /** Filter by transaction hash */
  txHash?: string;
  /** Minimum USD value */
  minUsdValue?: number;
  /** Maximum USD value */
  maxUsdValue?: number;
  /** Trades after this timestamp */
  timestampAfter?: Date;
  /** Trades before this timestamp */
  timestampBefore?: Date;
  /** Filter by flags (any match) */
  flags?: string[];
  /** Filter by maker address */
  makerAddress?: string;
  /** Filter by taker address */
  takerAddress?: string;
}

/**
 * Sorting options for trade queries
 */
export interface TradeSortOptions {
  /** Field to sort by */
  field: "timestamp" | "usdValue" | "amount" | "price" | "createdAt";
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
 * Result from paginated trade queries
 */
export interface PaginatedTradeResult {
  /** Trades matching the query */
  trades: Trade[];
  /** Total count of matching trades */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Include options for trade queries
 */
export interface TradeIncludeOptions {
  /** Include market relation */
  market?: boolean;
  /** Include outcome relation */
  outcome?: boolean;
  /** Include wallet relation */
  wallet?: boolean;
}

/**
 * Trade service configuration
 */
export interface TradeServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
}

/**
 * Trade aggregate statistics
 */
export interface TradeStats {
  /** Total number of trades */
  count: number;
  /** Total USD volume */
  totalVolume: number;
  /** Average trade size in USD */
  avgTradeSize: number;
  /** Total fees in USD */
  totalFees: number;
}

/**
 * Trade Database Service
 *
 * Provides CRUD operations and queries for the Trade model.
 */
export class TradeService {
  private prisma: PrismaClient;

  constructor(config: TradeServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
  }

  /**
   * Create a new trade.
   *
   * @param input - Trade data to create
   * @returns The created trade
   * @throws If trade with same clobTradeId already exists
   *
   * @example
   * ```typescript
   * const trade = await tradeService.create({
   *   marketId: "0x1234...",
   *   outcomeId: "outcome-1",
   *   walletId: "wallet-1",
   *   side: TradeSide.BUY,
   *   amount: 100,
   *   price: 0.65,
   *   usdValue: 65,
   *   timestamp: new Date(),
   * });
   * ```
   */
  async create(input: CreateTradeInput): Promise<Trade> {
    return this.prisma.trade.create({
      data: {
        marketId: input.marketId,
        outcomeId: input.outcomeId,
        walletId: input.walletId,
        clobTradeId: input.clobTradeId,
        matchId: input.matchId,
        side: input.side,
        amount: input.amount,
        price: input.price,
        usdValue: input.usdValue,
        feeUsd: input.feeUsd ?? 0,
        makerAddress: input.makerAddress,
        takerAddress: input.takerAddress,
        isMaker: input.isMaker,
        timestamp: input.timestamp,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        isWhale: input.isWhale ?? false,
        isInsider: input.isInsider ?? false,
        flags: input.flags ?? [],
      },
    });
  }

  /**
   * Find a trade by its unique ID.
   *
   * @param id - The trade ID
   * @param include - Relations to include
   * @returns The trade or null if not found
   *
   * @example
   * ```typescript
   * const trade = await tradeService.findById("trade-1", { market: true });
   * if (trade) {
   *   console.log(trade.market.question);
   * }
   * ```
   */
  async findById(id: string, include?: TradeIncludeOptions): Promise<Trade | TradeWithRelations | null> {
    return this.prisma.trade.findUnique({
      where: { id },
      include: include ? {
        market: include.market ?? false,
        outcome: include.outcome ?? false,
        wallet: include.wallet ?? false,
      } : undefined,
    });
  }

  /**
   * Find a trade by its CLOB trade ID.
   *
   * @param clobTradeId - The CLOB trade ID
   * @param include - Relations to include
   * @returns The trade or null if not found
   *
   * @example
   * ```typescript
   * const trade = await tradeService.findByClobTradeId("clob-123");
   * ```
   */
  async findByClobTradeId(
    clobTradeId: string,
    include?: TradeIncludeOptions
  ): Promise<Trade | TradeWithRelations | null> {
    return this.prisma.trade.findUnique({
      where: { clobTradeId },
      include: include ? {
        market: include.market ?? false,
        outcome: include.outcome ?? false,
        wallet: include.wallet ?? false,
      } : undefined,
    });
  }

  /**
   * Find multiple trades by their IDs.
   *
   * @param ids - Array of trade IDs
   * @param include - Relations to include
   * @returns Array of found trades
   */
  async findByIds(ids: string[], include?: TradeIncludeOptions): Promise<Trade[]> {
    return this.prisma.trade.findMany({
      where: { id: { in: ids } },
      include: include ? {
        market: include.market ?? false,
        outcome: include.outcome ?? false,
        wallet: include.wallet ?? false,
      } : undefined,
    });
  }

  /**
   * Update an existing trade.
   *
   * @param id - The trade ID to update
   * @param input - Fields to update
   * @returns The updated trade
   * @throws If trade not found
   *
   * @example
   * ```typescript
   * const updated = await tradeService.update("trade-1", {
   *   isWhale: true,
   *   flags: ["large", "whale"],
   * });
   * ```
   */
  async update(id: string, input: UpdateTradeInput): Promise<Trade> {
    return this.prisma.trade.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Upsert a trade by CLOB trade ID.
   *
   * @param clobTradeId - The CLOB trade ID
   * @param input - Trade data
   * @returns The created or updated trade
   *
   * @example
   * ```typescript
   * const trade = await tradeService.upsertByClobTradeId("clob-123", {
   *   marketId: "market-1",
   *   outcomeId: "outcome-1",
   *   walletId: "wallet-1",
   *   side: TradeSide.BUY,
   *   amount: 100,
   *   price: 0.65,
   *   usdValue: 65,
   *   timestamp: new Date(),
   *   clobTradeId: "clob-123",
   * });
   * ```
   */
  async upsertByClobTradeId(clobTradeId: string, input: CreateTradeInput): Promise<Trade> {
    return this.prisma.trade.upsert({
      where: { clobTradeId },
      create: {
        marketId: input.marketId,
        outcomeId: input.outcomeId,
        walletId: input.walletId,
        clobTradeId,
        matchId: input.matchId,
        side: input.side,
        amount: input.amount,
        price: input.price,
        usdValue: input.usdValue,
        feeUsd: input.feeUsd ?? 0,
        makerAddress: input.makerAddress,
        takerAddress: input.takerAddress,
        isMaker: input.isMaker,
        timestamp: input.timestamp,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        isWhale: input.isWhale ?? false,
        isInsider: input.isInsider ?? false,
        flags: input.flags ?? [],
      },
      update: {
        matchId: input.matchId,
        feeUsd: input.feeUsd,
        makerAddress: input.makerAddress,
        takerAddress: input.takerAddress,
        isMaker: input.isMaker,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        isWhale: input.isWhale,
        isInsider: input.isInsider,
        flags: input.flags,
      },
    });
  }

  /**
   * Delete a trade by ID.
   *
   * @param id - The trade ID to delete
   * @returns The deleted trade
   * @throws If trade not found
   *
   * @example
   * ```typescript
   * await tradeService.delete("trade-1");
   * ```
   */
  async delete(id: string): Promise<Trade> {
    return this.prisma.trade.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple trades by IDs.
   *
   * @param ids - Array of trade IDs to delete
   * @returns Count of deleted trades
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.trade.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Delete trades by market ID.
   *
   * @param marketId - The market ID
   * @returns Count of deleted trades
   */
  async deleteByMarket(marketId: string): Promise<{ count: number }> {
    return this.prisma.trade.deleteMany({
      where: { marketId },
    });
  }

  /**
   * Delete trades by wallet ID.
   *
   * @param walletId - The wallet ID
   * @returns Count of deleted trades
   */
  async deleteByWallet(walletId: string): Promise<{ count: number }> {
    return this.prisma.trade.deleteMany({
      where: { walletId },
    });
  }

  /**
   * Build Prisma where clause from filters.
   */
  private buildWhereClause(filters: TradeFilters): Prisma.TradeWhereInput {
    const where: Prisma.TradeWhereInput = {};

    if (filters.marketId) {
      where.marketId = filters.marketId;
    }

    if (filters.outcomeId) {
      where.outcomeId = filters.outcomeId;
    }

    if (filters.walletId) {
      where.walletId = filters.walletId;
    }

    if (filters.side) {
      where.side = filters.side;
    }

    if (filters.isWhale !== undefined) {
      where.isWhale = filters.isWhale;
    }

    if (filters.isInsider !== undefined) {
      where.isInsider = filters.isInsider;
    }

    if (filters.matchId) {
      where.matchId = filters.matchId;
    }

    if (filters.txHash) {
      where.txHash = filters.txHash;
    }

    if (filters.makerAddress) {
      where.makerAddress = filters.makerAddress;
    }

    if (filters.takerAddress) {
      where.takerAddress = filters.takerAddress;
    }

    if (filters.minUsdValue !== undefined || filters.maxUsdValue !== undefined) {
      where.usdValue = {};
      if (filters.minUsdValue !== undefined) {
        where.usdValue.gte = filters.minUsdValue;
      }
      if (filters.maxUsdValue !== undefined) {
        where.usdValue.lte = filters.maxUsdValue;
      }
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

    if (filters.flags && filters.flags.length > 0) {
      where.flags = { hasSome: filters.flags };
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options.
   */
  private buildOrderByClause(
    sort?: TradeSortOptions
  ): Prisma.TradeOrderByWithRelationInput | undefined {
    if (!sort) {
      return { timestamp: "desc" }; // Default sort
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find trades matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param include - Optional relations to include
   * @returns Paginated result of matching trades
   *
   * @example
   * ```typescript
   * // Find whale trades for a market
   * const result = await tradeService.findMany(
   *   {
   *     marketId: "0x1234...",
   *     isWhale: true,
   *   },
   *   { field: "usdValue", direction: "desc" },
   *   { take: 20 }
   * );
   *
   * console.log(`Found ${result.total} whale trades`);
   * ```
   */
  async findMany(
    filters: TradeFilters = {},
    sort?: TradeSortOptions,
    pagination: PaginationOptions = {},
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy,
        skip,
        take,
        include: include ? {
          market: include.market ?? false,
          outcome: include.outcome ?? false,
          wallet: include.wallet ?? false,
        } : undefined,
      }),
      this.prisma.trade.count({ where }),
    ]);

    return {
      trades,
      total,
      skip,
      take,
      hasMore: skip + trades.length < total,
    };
  }

  /**
   * Find trades by wallet address.
   *
   * @param walletId - The wallet ID
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated trades for the wallet
   */
  async findByWallet(
    walletId: string,
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany({ walletId }, sort, pagination, include);
  }

  /**
   * Find trades by market ID.
   *
   * @param marketId - The market ID
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated trades for the market
   */
  async findByMarket(
    marketId: string,
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany({ marketId }, sort, pagination, include);
  }

  /**
   * Find trades by outcome ID.
   *
   * @param outcomeId - The outcome ID
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated trades for the outcome
   */
  async findByOutcome(
    outcomeId: string,
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany({ outcomeId }, sort, pagination, include);
  }

  /**
   * Find whale trades.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated whale trades
   */
  async findWhaleTrades(
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany({ isWhale: true }, sort, pagination, include);
  }

  /**
   * Find insider trades.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated insider trades
   */
  async findInsiderTrades(
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany({ isInsider: true }, sort, pagination, include);
  }

  /**
   * Get recent trades.
   *
   * @param limit - Number of trades to return
   * @param include - Optional relations to include
   * @returns Recent trades sorted by timestamp
   */
  async getRecent(limit = 50, include?: TradeIncludeOptions): Promise<Trade[]> {
    const result = await this.findMany(
      {},
      { field: "timestamp", direction: "desc" },
      { take: limit },
      include
    );
    return result.trades;
  }

  /**
   * Get largest trades by USD value.
   *
   * @param limit - Number of trades to return
   * @param filters - Optional additional filters
   * @param include - Optional relations to include
   * @returns Largest trades sorted by USD value
   */
  async getLargest(
    limit = 50,
    filters: TradeFilters = {},
    include?: TradeIncludeOptions
  ): Promise<Trade[]> {
    const result = await this.findMany(
      filters,
      { field: "usdValue", direction: "desc" },
      { take: limit },
      include
    );
    return result.trades;
  }

  /**
   * Find trades within a time range.
   *
   * @param startTime - Start of the time range
   * @param endTime - End of the time range
   * @param filters - Optional additional filters
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @param include - Optional relations to include
   * @returns Paginated trades within the time range
   */
  async findInTimeRange(
    startTime: Date,
    endTime: Date,
    filters: TradeFilters = {},
    sort?: TradeSortOptions,
    pagination?: PaginationOptions,
    include?: TradeIncludeOptions
  ): Promise<PaginatedTradeResult> {
    return this.findMany(
      {
        ...filters,
        timestampAfter: startTime,
        timestampBefore: endTime,
      },
      sort,
      pagination,
      include
    );
  }

  /**
   * Count trades matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching trades
   */
  async count(filters: TradeFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.trade.count({ where });
  }

  /**
   * Check if a trade exists by ID.
   *
   * @param id - The trade ID
   * @returns True if trade exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.trade.count({ where: { id } });
    return count > 0;
  }

  /**
   * Check if a trade exists by CLOB trade ID.
   *
   * @param clobTradeId - The CLOB trade ID
   * @returns True if trade exists
   */
  async existsByClobTradeId(clobTradeId: string): Promise<boolean> {
    const count = await this.prisma.trade.count({ where: { clobTradeId } });
    return count > 0;
  }

  /**
   * Bulk create trades.
   *
   * @param trades - Array of trades to create
   * @returns Count of created trades
   */
  async createMany(trades: CreateTradeInput[]): Promise<{ count: number }> {
    return this.prisma.trade.createMany({
      data: trades.map((trade) => ({
        marketId: trade.marketId,
        outcomeId: trade.outcomeId,
        walletId: trade.walletId,
        clobTradeId: trade.clobTradeId,
        matchId: trade.matchId,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        usdValue: trade.usdValue,
        feeUsd: trade.feeUsd ?? 0,
        makerAddress: trade.makerAddress,
        takerAddress: trade.takerAddress,
        isMaker: trade.isMaker,
        timestamp: trade.timestamp,
        txHash: trade.txHash,
        blockNumber: trade.blockNumber,
        isWhale: trade.isWhale ?? false,
        isInsider: trade.isInsider ?? false,
        flags: trade.flags ?? [],
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Mark a trade as a whale trade.
   *
   * @param id - The trade ID
   * @returns The updated trade
   */
  async markAsWhale(id: string): Promise<Trade> {
    return this.prisma.trade.update({
      where: { id },
      data: { isWhale: true },
    });
  }

  /**
   * Mark a trade as insider activity.
   *
   * @param id - The trade ID
   * @returns The updated trade
   */
  async markAsInsider(id: string): Promise<Trade> {
    return this.prisma.trade.update({
      where: { id },
      data: { isInsider: true },
    });
  }

  /**
   * Add flags to a trade.
   *
   * @param id - The trade ID
   * @param flags - Flags to add
   * @returns The updated trade
   */
  async addFlags(id: string, flags: string[]): Promise<Trade> {
    const trade = await this.findById(id);
    if (!trade) {
      throw new Error(`Trade not found: ${id}`);
    }

    const existingFlags = trade.flags || [];
    const newFlags = [...new Set([...existingFlags, ...flags])];

    return this.prisma.trade.update({
      where: { id },
      data: { flags: newFlags },
    });
  }

  /**
   * Get aggregate statistics for trades.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregate statistics
   */
  async getStats(filters: TradeFilters = {}): Promise<TradeStats> {
    const where = this.buildWhereClause(filters);

    const result = await this.prisma.trade.aggregate({
      where,
      _count: { id: true },
      _sum: { usdValue: true, feeUsd: true },
      _avg: { usdValue: true },
    });

    return {
      count: result._count.id,
      totalVolume: result._sum.usdValue ?? 0,
      avgTradeSize: result._avg.usdValue ?? 0,
      totalFees: result._sum.feeUsd ?? 0,
    };
  }

  /**
   * Get trade statistics by wallet.
   *
   * @param walletId - The wallet ID
   * @returns Trade statistics for the wallet
   */
  async getWalletStats(walletId: string): Promise<TradeStats & { winCount: number; buyCount: number; sellCount: number }> {
    const [stats, buyCounts, sellCounts] = await Promise.all([
      this.getStats({ walletId }),
      this.count({ walletId, side: TradeSide.BUY }),
      this.count({ walletId, side: TradeSide.SELL }),
    ]);

    return {
      ...stats,
      winCount: 0, // Requires resolution data to calculate
      buyCount: buyCounts,
      sellCount: sellCounts,
    };
  }

  /**
   * Get trade statistics by market.
   *
   * @param marketId - The market ID
   * @returns Trade statistics for the market
   */
  async getMarketStats(marketId: string): Promise<TradeStats & { uniqueTraders: number }> {
    const [stats, uniqueTradersResult] = await Promise.all([
      this.getStats({ marketId }),
      this.prisma.trade.groupBy({
        by: ["walletId"],
        where: { marketId },
        _count: { walletId: true },
      }),
    ]);

    return {
      ...stats,
      uniqueTraders: uniqueTradersResult.length,
    };
  }

  /**
   * Find the first trade for a wallet on Polymarket.
   *
   * @param walletId - The wallet ID
   * @param include - Optional relations to include
   * @returns The first trade or null
   */
  async findFirstTradeByWallet(walletId: string, include?: TradeIncludeOptions): Promise<Trade | null> {
    return this.prisma.trade.findFirst({
      where: { walletId },
      orderBy: { timestamp: "asc" },
      include: include ? {
        market: include.market ?? false,
        outcome: include.outcome ?? false,
        wallet: include.wallet ?? false,
      } : undefined,
    });
  }

  /**
   * Find the last trade for a wallet on Polymarket.
   *
   * @param walletId - The wallet ID
   * @param include - Optional relations to include
   * @returns The last trade or null
   */
  async findLastTradeByWallet(walletId: string, include?: TradeIncludeOptions): Promise<Trade | null> {
    return this.prisma.trade.findFirst({
      where: { walletId },
      orderBy: { timestamp: "desc" },
      include: include ? {
        market: include.market ?? false,
        outcome: include.outcome ?? false,
        wallet: include.wallet ?? false,
      } : undefined,
    });
  }

  /**
   * Get trades grouped by time interval for charting.
   *
   * @param filters - Filters to apply
   * @param intervalMinutes - Interval in minutes for grouping
   * @returns Array of time-bucketed trade summaries
   */
  async getTradesByInterval(
    filters: TradeFilters = {},
    intervalMinutes = 60
  ): Promise<Array<{
    timestamp: Date;
    count: number;
    volume: number;
    buyCount: number;
    sellCount: number;
  }>> {
    const where = this.buildWhereClause(filters);

    // For now, fetch trades and group in memory
    // In production, this would use a database-specific time bucketing function
    const trades = await this.prisma.trade.findMany({
      where,
      orderBy: { timestamp: "asc" },
      select: {
        timestamp: true,
        usdValue: true,
        side: true,
      },
    });

    const intervalMs = intervalMinutes * 60 * 1000;
    const buckets = new Map<number, {
      timestamp: Date;
      count: number;
      volume: number;
      buyCount: number;
      sellCount: number;
    }>();

    for (const trade of trades) {
      const bucketTime = Math.floor(trade.timestamp.getTime() / intervalMs) * intervalMs;

      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, {
          timestamp: new Date(bucketTime),
          count: 0,
          volume: 0,
          buyCount: 0,
          sellCount: 0,
        });
      }

      const bucket = buckets.get(bucketTime)!;
      bucket.count++;
      bucket.volume += trade.usdValue;
      if (trade.side === TradeSide.BUY) {
        bucket.buyCount++;
      } else {
        bucket.sellCount++;
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

/**
 * Default trade service instance using the singleton Prisma client.
 */
export const tradeService = new TradeService();

/**
 * Create a new trade service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new TradeService instance
 */
export function createTradeService(config: TradeServiceConfig = {}): TradeService {
  return new TradeService(config);
}
