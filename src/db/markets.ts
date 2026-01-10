/**
 * Market Database Service
 *
 * CRUD operations and queries for the Market model.
 * Provides typed interfaces for interacting with market data in the database.
 */

import type { Market, Outcome, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for convenience
export type { Market, Outcome };

/**
 * Market with its outcomes included
 */
export interface MarketWithOutcomes extends Market {
  outcomes: Outcome[];
}

/**
 * Input for creating a new market
 */
export interface CreateMarketInput {
  /** Unique market ID (condition ID from Polymarket) */
  id: string;
  /** URL-friendly slug */
  slug: string;
  /** Main question being predicted */
  question: string;
  /** Optional description */
  description?: string;
  /** Category classification */
  category?: string;
  /** Subcategory */
  subcategory?: string;
  /** Tags for filtering */
  tags?: string[];
  /** Image URL */
  imageUrl?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Resolution source */
  resolutionSource?: string;
  /** End date */
  endDate?: Date;
  /** Whether market is active */
  active?: boolean;
  /** Whether market is closed */
  closed?: boolean;
  /** Whether market is archived */
  archived?: boolean;
  /** Total volume in USD */
  volume?: number;
  /** 24-hour volume in USD */
  volume24h?: number;
  /** Liquidity in USD */
  liquidity?: number;
  /** Trade count */
  tradeCount?: number;
  /** Unique traders count */
  uniqueTraders?: number;
}

/**
 * Input for updating an existing market
 */
export interface UpdateMarketInput {
  /** URL-friendly slug */
  slug?: string;
  /** Main question being predicted */
  question?: string;
  /** Optional description */
  description?: string | null;
  /** Category classification */
  category?: string | null;
  /** Subcategory */
  subcategory?: string | null;
  /** Tags for filtering */
  tags?: string[];
  /** Image URL */
  imageUrl?: string | null;
  /** Icon URL */
  iconUrl?: string | null;
  /** Resolution source */
  resolutionSource?: string | null;
  /** Who resolved the market */
  resolvedBy?: string | null;
  /** Resolution outcome */
  resolution?: string | null;
  /** End date */
  endDate?: Date | null;
  /** Resolved at timestamp */
  resolvedAt?: Date | null;
  /** Whether market is active */
  active?: boolean;
  /** Whether market is closed */
  closed?: boolean;
  /** Whether market is archived */
  archived?: boolean;
  /** Total volume in USD */
  volume?: number;
  /** 24-hour volume in USD */
  volume24h?: number;
  /** Liquidity in USD */
  liquidity?: number;
  /** Trade count */
  tradeCount?: number;
  /** Unique traders count */
  uniqueTraders?: number;
  /** Last synced timestamp */
  lastSyncedAt?: Date | null;
}

/**
 * Input for creating an outcome
 */
export interface CreateOutcomeInput {
  /** Market ID this outcome belongs to */
  marketId: string;
  /** Outcome name (e.g., "Yes", "No") */
  name: string;
  /** CLOB token ID */
  clobTokenId?: string;
  /** Current price (0-1) */
  price?: number;
  /** Probability percentage (0-100) */
  probability?: number;
  /** 24-hour price change percentage */
  priceChange24h?: number;
  /** Trading volume for this outcome */
  volume?: number;
  /** Display order */
  displayOrder?: number;
}

/**
 * Filters for querying markets
 */
export interface MarketFilters {
  /** Filter by active status */
  active?: boolean;
  /** Filter by closed status */
  closed?: boolean;
  /** Filter by archived status */
  archived?: boolean;
  /** Filter by category */
  category?: string;
  /** Filter by subcategory */
  subcategory?: string;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Search in question text */
  search?: string;
  /** Minimum volume */
  minVolume?: number;
  /** Maximum volume */
  maxVolume?: number;
  /** End date before */
  endDateBefore?: Date;
  /** End date after */
  endDateAfter?: Date;
  /** Created after */
  createdAfter?: Date;
  /** Created before */
  createdBefore?: Date;
}

/**
 * Sorting options for market queries
 */
export interface MarketSortOptions {
  /** Field to sort by */
  field: "volume" | "volume24h" | "liquidity" | "createdAt" | "updatedAt" | "endDate" | "tradeCount";
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
 * Result from paginated market queries
 */
export interface PaginatedMarketResult {
  /** Markets matching the query */
  markets: Market[];
  /** Total count of matching markets */
  total: number;
  /** Number of items skipped */
  skip: number;
  /** Number of items returned */
  take: number;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Market service configuration
 */
export interface MarketServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
}

/**
 * Market Database Service
 *
 * Provides CRUD operations and queries for the Market model.
 */
export class MarketService {
  private prisma: PrismaClient;

  constructor(config: MarketServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
  }

  /**
   * Create a new market.
   *
   * @param input - Market data to create
   * @returns The created market
   * @throws If market with same ID or slug already exists
   *
   * @example
   * ```typescript
   * const market = await marketService.create({
   *   id: "0x1234...",
   *   slug: "will-bitcoin-reach-100k",
   *   question: "Will Bitcoin reach $100k by end of 2024?",
   *   category: "crypto",
   *   active: true,
   * });
   * ```
   */
  async create(input: CreateMarketInput): Promise<Market> {
    return this.prisma.market.create({
      data: {
        id: input.id,
        slug: input.slug,
        question: input.question,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        tags: input.tags ?? [],
        imageUrl: input.imageUrl,
        iconUrl: input.iconUrl,
        resolutionSource: input.resolutionSource,
        endDate: input.endDate,
        active: input.active ?? true,
        closed: input.closed ?? false,
        archived: input.archived ?? false,
        volume: input.volume ?? 0,
        volume24h: input.volume24h ?? 0,
        liquidity: input.liquidity ?? 0,
        tradeCount: input.tradeCount ?? 0,
        uniqueTraders: input.uniqueTraders ?? 0,
      },
    });
  }

  /**
   * Create a market with its outcomes in a single transaction.
   *
   * @param input - Market data to create
   * @param outcomes - Outcomes to create for this market
   * @returns The created market with outcomes
   *
   * @example
   * ```typescript
   * const market = await marketService.createWithOutcomes(
   *   {
   *     id: "0x1234...",
   *     slug: "will-bitcoin-reach-100k",
   *     question: "Will Bitcoin reach $100k?",
   *   },
   *   [
   *     { name: "Yes", price: 0.65 },
   *     { name: "No", price: 0.35 },
   *   ]
   * );
   * ```
   */
  async createWithOutcomes(
    input: CreateMarketInput,
    outcomes: Omit<CreateOutcomeInput, "marketId">[]
  ): Promise<MarketWithOutcomes> {
    return this.prisma.market.create({
      data: {
        id: input.id,
        slug: input.slug,
        question: input.question,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        tags: input.tags ?? [],
        imageUrl: input.imageUrl,
        iconUrl: input.iconUrl,
        resolutionSource: input.resolutionSource,
        endDate: input.endDate,
        active: input.active ?? true,
        closed: input.closed ?? false,
        archived: input.archived ?? false,
        volume: input.volume ?? 0,
        volume24h: input.volume24h ?? 0,
        liquidity: input.liquidity ?? 0,
        tradeCount: input.tradeCount ?? 0,
        uniqueTraders: input.uniqueTraders ?? 0,
        outcomes: {
          create: outcomes.map((outcome, index) => ({
            name: outcome.name,
            clobTokenId: outcome.clobTokenId,
            price: outcome.price ?? 0,
            probability: outcome.probability ?? (outcome.price ? outcome.price * 100 : 0),
            priceChange24h: outcome.priceChange24h ?? 0,
            volume: outcome.volume ?? 0,
            displayOrder: outcome.displayOrder ?? index,
          })),
        },
      },
      include: {
        outcomes: true,
      },
    });
  }

  /**
   * Find a market by its unique ID.
   *
   * @param id - The market ID
   * @param includeOutcomes - Whether to include outcomes
   * @returns The market or null if not found
   *
   * @example
   * ```typescript
   * const market = await marketService.findById("0x1234...");
   * if (market) {
   *   console.log(market.question);
   * }
   * ```
   */
  async findById(id: string, includeOutcomes = false): Promise<Market | MarketWithOutcomes | null> {
    return this.prisma.market.findUnique({
      where: { id },
      include: includeOutcomes ? { outcomes: true } : undefined,
    });
  }

  /**
   * Find a market by its slug.
   *
   * @param slug - The market slug
   * @param includeOutcomes - Whether to include outcomes
   * @returns The market or null if not found
   *
   * @example
   * ```typescript
   * const market = await marketService.findBySlug("will-bitcoin-reach-100k");
   * ```
   */
  async findBySlug(
    slug: string,
    includeOutcomes = false
  ): Promise<Market | MarketWithOutcomes | null> {
    return this.prisma.market.findUnique({
      where: { slug },
      include: includeOutcomes ? { outcomes: true } : undefined,
    });
  }

  /**
   * Find multiple markets by their IDs.
   *
   * @param ids - Array of market IDs
   * @param includeOutcomes - Whether to include outcomes
   * @returns Array of found markets
   */
  async findByIds(ids: string[], includeOutcomes = false): Promise<Market[]> {
    return this.prisma.market.findMany({
      where: { id: { in: ids } },
      include: includeOutcomes ? { outcomes: true } : undefined,
    });
  }

  /**
   * Update an existing market.
   *
   * @param id - The market ID to update
   * @param input - Fields to update
   * @returns The updated market
   * @throws If market not found
   *
   * @example
   * ```typescript
   * const updated = await marketService.update("0x1234...", {
   *   volume: 1500000,
   *   active: false,
   *   closed: true,
   * });
   * ```
   */
  async update(id: string, input: UpdateMarketInput): Promise<Market> {
    return this.prisma.market.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Upsert a market (create if not exists, update if exists).
   *
   * @param input - Market data
   * @returns The created or updated market
   *
   * @example
   * ```typescript
   * const market = await marketService.upsert({
   *   id: "0x1234...",
   *   slug: "will-bitcoin-reach-100k",
   *   question: "Will Bitcoin reach $100k?",
   *   volume: 1000000,
   * });
   * ```
   */
  async upsert(input: CreateMarketInput): Promise<Market> {
    return this.prisma.market.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        slug: input.slug,
        question: input.question,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        tags: input.tags ?? [],
        imageUrl: input.imageUrl,
        iconUrl: input.iconUrl,
        resolutionSource: input.resolutionSource,
        endDate: input.endDate,
        active: input.active ?? true,
        closed: input.closed ?? false,
        archived: input.archived ?? false,
        volume: input.volume ?? 0,
        volume24h: input.volume24h ?? 0,
        liquidity: input.liquidity ?? 0,
        tradeCount: input.tradeCount ?? 0,
        uniqueTraders: input.uniqueTraders ?? 0,
      },
      update: {
        slug: input.slug,
        question: input.question,
        description: input.description,
        category: input.category,
        subcategory: input.subcategory,
        tags: input.tags ?? [],
        imageUrl: input.imageUrl,
        iconUrl: input.iconUrl,
        resolutionSource: input.resolutionSource,
        endDate: input.endDate,
        active: input.active,
        closed: input.closed,
        archived: input.archived,
        volume: input.volume,
        volume24h: input.volume24h,
        liquidity: input.liquidity,
        tradeCount: input.tradeCount,
        uniqueTraders: input.uniqueTraders,
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Delete a market by ID.
   *
   * @param id - The market ID to delete
   * @returns The deleted market
   * @throws If market not found
   *
   * @example
   * ```typescript
   * await marketService.delete("0x1234...");
   * ```
   */
  async delete(id: string): Promise<Market> {
    return this.prisma.market.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple markets by IDs.
   *
   * @param ids - Array of market IDs to delete
   * @returns Count of deleted markets
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    return this.prisma.market.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Build Prisma where clause from filters.
   */
  private buildWhereClause(filters: MarketFilters): Prisma.MarketWhereInput {
    const where: Prisma.MarketWhereInput = {};

    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    if (filters.closed !== undefined) {
      where.closed = filters.closed;
    }

    if (filters.archived !== undefined) {
      where.archived = filters.archived;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.subcategory) {
      where.subcategory = filters.subcategory;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.search) {
      where.question = { contains: filters.search, mode: "insensitive" };
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

    if (filters.endDateBefore || filters.endDateAfter) {
      where.endDate = {};
      if (filters.endDateBefore) {
        where.endDate.lte = filters.endDateBefore;
      }
      if (filters.endDateAfter) {
        where.endDate.gte = filters.endDateAfter;
      }
    }

    if (filters.createdBefore || filters.createdAfter) {
      where.createdAt = {};
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options.
   */
  private buildOrderByClause(
    sort?: MarketSortOptions
  ): Prisma.MarketOrderByWithRelationInput | undefined {
    if (!sort) {
      return { volume: "desc" }; // Default sort
    }

    return { [sort.field]: sort.direction };
  }

  /**
   * Find markets matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @param sort - Optional sort options
   * @param pagination - Optional pagination options
   * @param includeOutcomes - Whether to include outcomes
   * @returns Paginated result of matching markets
   *
   * @example
   * ```typescript
   * // Find active crypto markets with volume > 10000
   * const result = await marketService.findMany(
   *   {
   *     active: true,
   *     category: "crypto",
   *     minVolume: 10000,
   *   },
   *   { field: "volume", direction: "desc" },
   *   { take: 20 }
   * );
   *
   * console.log(`Found ${result.total} markets`);
   * for (const market of result.markets) {
   *   console.log(`${market.question}: $${market.volume}`);
   * }
   * ```
   */
  async findMany(
    filters: MarketFilters = {},
    sort?: MarketSortOptions,
    pagination: PaginationOptions = {},
    includeOutcomes = false
  ): Promise<PaginatedMarketResult> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sort);
    const skip = pagination.skip ?? 0;
    const take = pagination.take ?? 100;

    const [markets, total] = await Promise.all([
      this.prisma.market.findMany({
        where,
        orderBy,
        skip,
        take,
        include: includeOutcomes ? { outcomes: true } : undefined,
      }),
      this.prisma.market.count({ where }),
    ]);

    return {
      markets,
      total,
      skip,
      take,
      hasMore: skip + markets.length < total,
    };
  }

  /**
   * Find all active markets.
   *
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @returns Paginated active markets
   */
  async findActive(
    sort?: MarketSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedMarketResult> {
    return this.findMany({ active: true, closed: false }, sort, pagination);
  }

  /**
   * Find markets by category.
   *
   * @param category - The category to filter by
   * @param activeOnly - Whether to only return active markets
   * @param sort - Optional sort options
   * @param pagination - Optional pagination
   * @returns Paginated markets in the category
   */
  async findByCategory(
    category: string,
    activeOnly = true,
    sort?: MarketSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedMarketResult> {
    const filters: MarketFilters = { category };
    if (activeOnly) {
      filters.active = true;
      filters.closed = false;
    }
    return this.findMany(filters, sort, pagination);
  }

  /**
   * Search markets by question text.
   *
   * @param query - Search query
   * @param activeOnly - Whether to only search active markets
   * @param pagination - Optional pagination
   * @returns Paginated search results
   */
  async search(
    query: string,
    activeOnly = true,
    pagination?: PaginationOptions
  ): Promise<PaginatedMarketResult> {
    const filters: MarketFilters = { search: query };
    if (activeOnly) {
      filters.active = true;
      filters.closed = false;
    }
    return this.findMany(filters, { field: "volume", direction: "desc" }, pagination);
  }

  /**
   * Get trending markets (highest volume).
   *
   * @param limit - Number of markets to return
   * @param category - Optional category filter
   * @returns Top markets by volume
   */
  async getTrending(limit = 10, category?: string): Promise<Market[]> {
    const filters: MarketFilters = { active: true, closed: false };
    if (category) {
      filters.category = category;
    }

    const result = await this.findMany(
      filters,
      { field: "volume", direction: "desc" },
      { take: limit }
    );

    return result.markets;
  }

  /**
   * Get recently created markets.
   *
   * @param limit - Number of markets to return
   * @param activeOnly - Whether to only return active markets
   * @returns Recently created markets
   */
  async getRecent(limit = 10, activeOnly = true): Promise<Market[]> {
    const filters: MarketFilters = {};
    if (activeOnly) {
      filters.active = true;
      filters.closed = false;
    }

    const result = await this.findMany(
      filters,
      { field: "createdAt", direction: "desc" },
      { take: limit }
    );

    return result.markets;
  }

  /**
   * Count markets matching the given filters.
   *
   * @param filters - Optional filters to apply
   * @returns Count of matching markets
   */
  async count(filters: MarketFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.market.count({ where });
  }

  /**
   * Check if a market exists by ID.
   *
   * @param id - The market ID
   * @returns True if market exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.market.count({ where: { id } });
    return count > 0;
  }

  /**
   * Check if a market exists by slug.
   *
   * @param slug - The market slug
   * @returns True if market exists
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.prisma.market.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Bulk create markets.
   *
   * @param markets - Array of markets to create
   * @returns Count of created markets
   */
  async createMany(markets: CreateMarketInput[]): Promise<{ count: number }> {
    return this.prisma.market.createMany({
      data: markets.map((market) => ({
        id: market.id,
        slug: market.slug,
        question: market.question,
        description: market.description,
        category: market.category,
        subcategory: market.subcategory,
        tags: market.tags ?? [],
        imageUrl: market.imageUrl,
        iconUrl: market.iconUrl,
        resolutionSource: market.resolutionSource,
        endDate: market.endDate,
        active: market.active ?? true,
        closed: market.closed ?? false,
        archived: market.archived ?? false,
        volume: market.volume ?? 0,
        volume24h: market.volume24h ?? 0,
        liquidity: market.liquidity ?? 0,
        tradeCount: market.tradeCount ?? 0,
        uniqueTraders: market.uniqueTraders ?? 0,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Update last synced timestamp for a market.
   *
   * @param id - The market ID
   * @returns The updated market
   */
  async markSynced(id: string): Promise<Market> {
    return this.prisma.market.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }

  /**
   * Get markets that need syncing (haven't been synced recently).
   *
   * @param maxAge - Maximum age since last sync in milliseconds
   * @param limit - Maximum number of markets to return
   * @returns Markets that need syncing
   */
  async getNeedingSync(maxAge: number, limit = 100): Promise<Market[]> {
    const cutoff = new Date(Date.now() - maxAge);

    return this.prisma.market.findMany({
      where: {
        active: true,
        closed: false,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
      },
      orderBy: { lastSyncedAt: "asc" },
      take: limit,
    });
  }

  /**
   * Get aggregate statistics for markets.
   *
   * @param filters - Optional filters to apply
   * @returns Aggregate statistics
   */
  async getStats(filters: MarketFilters = {}): Promise<{
    count: number;
    totalVolume: number;
    totalLiquidity: number;
    avgVolume: number;
  }> {
    const where = this.buildWhereClause(filters);

    const result = await this.prisma.market.aggregate({
      where,
      _count: { id: true },
      _sum: { volume: true, liquidity: true },
      _avg: { volume: true },
    });

    return {
      count: result._count.id,
      totalVolume: result._sum.volume ?? 0,
      totalLiquidity: result._sum.liquidity ?? 0,
      avgVolume: result._avg.volume ?? 0,
    };
  }
}

/**
 * Default market service instance using the singleton Prisma client.
 */
export const marketService = new MarketService();

/**
 * Create a new market service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new MarketService instance
 */
export function createMarketService(config: MarketServiceConfig = {}): MarketService {
  return new MarketService(config);
}
