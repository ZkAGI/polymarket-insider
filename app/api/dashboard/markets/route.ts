/**
 * Dashboard Markets API Endpoint
 *
 * Provides a list of "hot" markets with most alerts/activity in the last 24 hours.
 *
 * Query parameters:
 * - limit: Number of results (1-50, default 10)
 * - offset: Pagination offset (default 0)
 * - category: Filter by market category (e.g., "politics", "crypto", "sports")
 *
 * Returns market summaries ordered by alert count and recent activity.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { AlertType, Prisma } from "@prisma/client";

/**
 * Market summary for dashboard display
 */
export interface MarketSummary {
  /** Market ID */
  id: string;
  /** Market question */
  question: string;
  /** URL slug */
  slug: string;
  /** Market category */
  category: string | null;
  /** Market subcategory */
  subcategory: string | null;
  /** Total volume in USD */
  volume: number;
  /** 24-hour volume in USD */
  volume24h: number;
  /** Current liquidity in USD */
  liquidity: number;
  /** Number of alerts in last 24h */
  alertCount: number;
  /** Most common alert type */
  topAlertType: AlertType | null;
  /** Whether market is active */
  active: boolean;
  /** Whether market is closed */
  closed: boolean;
  /** Market end date */
  endDate: string | null;
  /** Market image URL */
  imageUrl: string | null;
  /** Outcome summaries */
  outcomes: {
    name: string;
    price: number;
    priceChange24h: number;
  }[];
}

/**
 * Response type for dashboard markets endpoint
 */
export interface DashboardMarketsResponse {
  /** Array of market summaries */
  markets: MarketSummary[];
  /** Pagination info */
  pagination: {
    /** Current offset */
    offset: number;
    /** Number of results returned */
    limit: number;
    /** Total number of matching markets */
    total: number;
    /** Whether there are more results */
    hasMore: boolean;
  };
  /** Applied filters */
  filters: {
    category: string | null;
  };
  /** Timestamp of when the response was generated */
  generatedAt: string;
}

/**
 * Parse integer with bounds
 */
function parseIntParam(
  value: string | null,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;

  return Math.max(min, Math.min(max, parsed));
}

// Simple in-memory cache
let cachedMarkets: Map<string, { data: DashboardMarketsResponse; timestamp: number }> =
  new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const MAX_CACHE_ENTRIES = 50;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(params: URLSearchParams): string {
  const keys = ["limit", "offset", "category"];
  return keys.map((k) => `${k}:${params.get(k) || ""}`).join("|");
}

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of cachedMarkets) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cachedMarkets.delete(key);
    }
  }

  // If still too many entries, remove oldest
  if (cachedMarkets.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(cachedMarkets.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      cachedMarkets.delete(key);
    }
  }
}

/**
 * Fetch hot markets from the database
 */
async function fetchHotMarkets(params: {
  limit: number;
  offset: number;
  category: string | null;
}): Promise<{
  markets: MarketSummary[];
  total: number;
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Build where clause for markets
  const marketWhere: Prisma.MarketWhereInput = {};

  if (params.category) {
    marketWhere.category = {
      equals: params.category,
      mode: "insensitive",
    };
  }

  // First, get markets with alert counts in the last 24h
  // We'll use a raw query approach via aggregation
  const alertsByMarket = await prisma.alert.groupBy({
    by: ["marketId"],
    where: {
      createdAt: { gte: twentyFourHoursAgo },
      marketId: { not: null },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
  });

  // Get the top alert type for each market
  const topAlertTypes = await prisma.alert.groupBy({
    by: ["marketId", "type"],
    where: {
      createdAt: { gte: twentyFourHoursAgo },
      marketId: { not: null },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
  });

  // Build a map of marketId -> topAlertType
  const topAlertTypeMap = new Map<string, AlertType>();
  for (const item of topAlertTypes) {
    if (item.marketId && !topAlertTypeMap.has(item.marketId)) {
      topAlertTypeMap.set(item.marketId, item.type);
    }
  }

  // Build a map of marketId -> alertCount
  const alertCountMap = new Map<string, number>();
  for (const item of alertsByMarket) {
    if (item.marketId) {
      alertCountMap.set(item.marketId, item._count.id);
    }
  }

  // Get market IDs ordered by alert count
  const marketIdsWithAlerts = alertsByMarket
    .filter((a) => a.marketId !== null)
    .map((a) => a.marketId as string);

  // Build where clause to include category filter if provided
  const finalMarketWhere: Prisma.MarketWhereInput = {
    ...marketWhere,
  };

  // If we have markets with alerts, prioritize those
  // Otherwise, just get markets ordered by volume24h
  let marketIds: string[] = [];
  let totalWithAlerts = 0;

  if (marketIdsWithAlerts.length > 0) {
    // Count markets with alerts that match category filter
    if (params.category) {
      const marketsWithAlertsAndCategory = await prisma.market.findMany({
        where: {
          id: { in: marketIdsWithAlerts },
          ...marketWhere,
        },
        select: { id: true },
      });
      totalWithAlerts = marketsWithAlertsAndCategory.length;
      marketIds = marketsWithAlertsAndCategory.map((m) => m.id);
    } else {
      totalWithAlerts = marketIdsWithAlerts.length;
      marketIds = marketIdsWithAlerts;
    }
  }

  // Total count for pagination
  const total = totalWithAlerts > 0
    ? totalWithAlerts
    : await prisma.market.count({ where: finalMarketWhere });

  // Define the type for markets with outcomes included
  type MarketWithOutcomes = Awaited<ReturnType<typeof prisma.market.findMany>>[number] & {
    outcomes: { name: string; price: number; priceChange24h: number }[];
  };

  // Fetch markets with their outcomes
  // If we have markets with alerts, fetch those in alert-count order
  // Otherwise, fetch by volume24h
  let markets: MarketWithOutcomes[];

  if (marketIds.length > 0) {
    // Fetch in the order of alert count
    const orderedIds = marketIds.slice(params.offset, params.offset + params.limit);

    const fetchedMarkets = await prisma.market.findMany({
      where: {
        id: { in: orderedIds },
        ...marketWhere,
      },
      include: {
        outcomes: {
          select: {
            name: true,
            price: true,
            priceChange24h: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
        },
      },
    });

    // Sort by the order of orderedIds
    const marketMap = new Map(fetchedMarkets.map((m) => [m.id, m]));
    markets = orderedIds
      .map((id) => marketMap.get(id))
      .filter((m): m is MarketWithOutcomes => m !== undefined);
  } else {
    // No markets with alerts, fall back to volume24h ordering
    markets = await prisma.market.findMany({
      where: finalMarketWhere,
      include: {
        outcomes: {
          select: {
            name: true,
            price: true,
            priceChange24h: true,
          },
          orderBy: {
            displayOrder: "asc",
          },
        },
      },
      orderBy: [{ volume24h: "desc" }, { volume: "desc" }],
      take: params.limit,
      skip: params.offset,
    });
  }

  // Transform to response format
  const marketSummaries: MarketSummary[] = markets.map((market) => ({
    id: market.id,
    question: market.question,
    slug: market.slug,
    category: market.category,
    subcategory: market.subcategory,
    volume: market.volume,
    volume24h: market.volume24h,
    liquidity: market.liquidity,
    alertCount: alertCountMap.get(market.id) ?? 0,
    topAlertType: topAlertTypeMap.get(market.id) ?? null,
    active: market.active,
    closed: market.closed,
    endDate: market.endDate?.toISOString() ?? null,
    imageUrl: market.imageUrl,
    outcomes: market.outcomes.map((o) => ({
      name: o.name,
      price: o.price,
      priceChange24h: o.priceChange24h,
    })),
  }));

  return { markets: marketSummaries, total };
}

/**
 * GET /api/dashboard/markets
 *
 * Returns list of hot markets ordered by alert count and activity.
 *
 * Query parameters:
 * - limit: Number of results (1-50, default 10)
 * - offset: Pagination offset (default 0)
 * - category: Filter by market category
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<DashboardMarketsResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseIntParam(searchParams.get("limit"), 1, 50, 10);
    const offset = parseIntParam(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER, 0);
    const category = searchParams.get("category") || null;

    // Check cache
    const cacheKey = generateCacheKey(searchParams);
    const cached = cachedMarkets.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch data
    const { markets, total } = await fetchHotMarkets({
      limit,
      offset,
      category,
    });

    const response: DashboardMarketsResponse = {
      markets,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + markets.length < total,
      },
      filters: {
        category,
      },
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    cachedMarkets.set(cacheKey, { data: response, timestamp: now });
    cleanupCache();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard markets:", error);

    return NextResponse.json(
      { error: "Failed to fetch dashboard markets" },
      { status: 500 }
    );
  }
}
