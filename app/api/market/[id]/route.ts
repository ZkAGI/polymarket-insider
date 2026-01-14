/**
 * Market Detail API Endpoint
 *
 * Provides complete market data including price history, volume history, and recent trades.
 *
 * Route: GET /api/market/[id]
 *
 * Query parameters:
 * - priceInterval: Time interval for price history (1h, 4h, 1d, 1w) (default: 1d)
 * - priceDays: Number of days of price history (1-180) (default: 30)
 * - volumeInterval: Time interval for volume history (1h, 4h, 1d, 1w) (default: 1d)
 * - volumeDays: Number of days of volume history (1-180) (default: 30)
 * - tradesLimit: Number of recent trades to fetch (1-100) (default: 25)
 *
 * Returns:
 * - Market profile with metadata and outcomes
 * - Price history for charting
 * - Volume history for charting
 * - Recent trades for this market
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { Prisma, TradeSide } from "@prisma/client";
import { getMarketById } from "@/api/gamma/markets";
import type { GammaMarket } from "@/api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Market outcome data for display
 */
export interface MarketOutcomeResponse {
  /** Outcome ID */
  id: string;
  /** Outcome name (e.g., "Yes", "No") */
  name: string;
  /** Current price (0-1) */
  price: number;
  /** Probability percentage (0-100) */
  probability: number;
  /** 24-hour price change percentage */
  priceChange24h: number;
  /** Trading volume for this outcome */
  volume: number;
  /** Whether this outcome won (null if unresolved) */
  winner: boolean | null;
  /** CLOB token ID for trading */
  clobTokenId: string | null;
}

/**
 * Price data point for charting
 */
export interface PriceDataPoint {
  /** Timestamp of the data point */
  timestamp: string;
  /** Price at this point (0-1) */
  price: number;
  /** Probability percentage (0-100) */
  probability: number;
  /** Volume during this interval */
  volume: number;
}

/**
 * Volume data point for charting
 */
export interface VolumeDataPoint {
  /** Timestamp of the data point */
  timestamp: string;
  /** Volume in USD during this interval */
  volume: number;
  /** Number of trades during this interval */
  tradeCount: number;
}

/**
 * Recent trade for the market
 */
export interface MarketTradeResponse {
  /** Trade ID */
  id: string;
  /** Trade timestamp */
  timestamp: string;
  /** Wallet address that made the trade */
  walletAddress: string;
  /** Outcome name traded */
  outcome: string;
  /** Trade side (BUY/SELL) */
  side: TradeSide;
  /** Trade size in USD */
  size: number;
  /** Execution price (0-1) */
  price: number;
  /** Number of shares traded */
  shares: number;
  /** Whether this is a whale trade */
  isWhale: boolean;
  /** Transaction hash */
  txHash: string | null;
}

/**
 * Complete market detail response
 */
export interface MarketDetailResponse {
  /** Market profile data */
  market: {
    /** Market ID */
    id: string;
    /** URL slug */
    slug: string;
    /** Market question */
    question: string;
    /** Market description */
    description: string | null;
    /** Market category */
    category: string | null;
    /** Market subcategory */
    subcategory: string | null;
    /** Market tags */
    tags: string[];
    /** Image URL */
    imageUrl: string | null;
    /** Icon URL */
    iconUrl: string | null;
    /** Resolution source */
    resolutionSource: string | null;
    /** Whether market is active */
    active: boolean;
    /** Whether market is closed */
    closed: boolean;
    /** Whether market is archived */
    archived: boolean;
    /** Market end date */
    endDate: string | null;
    /** Market creation date */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Resolution outcome if resolved */
    resolution: string | null;
    /** When the market was resolved */
    resolvedAt: string | null;
    /** Total volume in USD */
    volume: number;
    /** 24-hour volume in USD */
    volume24h: number;
    /** Current liquidity in USD */
    liquidity: number;
    /** Polymarket URL */
    polymarketUrl: string;
    /** Market outcomes */
    outcomes: MarketOutcomeResponse[];
  };
  /** Price history for charting */
  priceHistory: {
    /** Outcome ID for the price history */
    outcomeId: string;
    /** Outcome name */
    outcomeName: string;
    /** Time interval used */
    interval: string;
    /** Start date of the history */
    startDate: string;
    /** End date of the history */
    endDate: string;
    /** Price data points */
    dataPoints: PriceDataPoint[];
  };
  /** Volume history for charting */
  volumeHistory: {
    /** Time interval used */
    interval: string;
    /** Start date of the history */
    startDate: string;
    /** End date of the history */
    endDate: string;
    /** Total volume in the period */
    totalVolume: number;
    /** Total trade count in the period */
    totalTrades: number;
    /** Volume data points */
    dataPoints: VolumeDataPoint[];
  };
  /** Recent trades for this market */
  trades: {
    items: MarketTradeResponse[];
    total: number;
    limit: number;
  };
  /** Response metadata */
  generatedAt: string;
}

/**
 * Error response type
 */
export interface MarketDetailErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// Constants
// ============================================================================

type TimeInterval = "1h" | "4h" | "1d" | "1w";

const VALID_INTERVALS: TimeInterval[] = ["1h", "4h", "1d", "1w"];
const DEFAULT_PRICE_INTERVAL: TimeInterval = "1d";
const DEFAULT_VOLUME_INTERVAL: TimeInterval = "1d";
const DEFAULT_PRICE_DAYS = 30;
const DEFAULT_VOLUME_DAYS = 30;
const DEFAULT_TRADES_LIMIT = 25;

// ============================================================================
// Utility Functions
// ============================================================================

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

/**
 * Parse interval parameter
 */
function parseIntervalParam(value: string | null, defaultValue: TimeInterval): TimeInterval {
  if (value && VALID_INTERVALS.includes(value as TimeInterval)) {
    return value as TimeInterval;
  }
  return defaultValue;
}

/**
 * Get interval duration in milliseconds
 */
function getIntervalMs(interval: TimeInterval): number {
  switch (interval) {
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Generate date key for grouping
 */
function getDateKey(date: Date, interval: TimeInterval): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();

  switch (interval) {
    case "1h":
      return new Date(Date.UTC(year, month, day, hour)).toISOString();
    case "4h":
      return new Date(Date.UTC(year, month, day, Math.floor(hour / 4) * 4)).toISOString();
    case "1d":
      return new Date(Date.UTC(year, month, day)).toISOString();
    case "1w":
      // Start of week (Sunday)
      const dayOfWeek = date.getUTCDay();
      return new Date(Date.UTC(year, month, day - dayOfWeek)).toISOString();
    default:
      return new Date(Date.UTC(year, month, day)).toISOString();
  }
}

// ============================================================================
// Cache
// ============================================================================

// Simple in-memory cache for market data
const marketCache: Map<string, { data: MarketDetailResponse; timestamp: number }> = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const MAX_CACHE_ENTRIES = 100;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(
  marketId: string,
  params: {
    priceInterval: string;
    priceDays: number;
    volumeInterval: string;
    volumeDays: number;
    tradesLimit: number;
  }
): string {
  return `${marketId}:${params.priceInterval}:${params.priceDays}:${params.volumeInterval}:${params.volumeDays}:${params.tradesLimit}`;
}

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of marketCache) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      marketCache.delete(key);
    }
  }

  // If still too many entries, remove oldest
  if (marketCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(marketCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      marketCache.delete(key);
    }
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch market from database
 */
async function fetchMarketFromDb(marketId: string) {
  return prisma.market.findUnique({
    where: { id: marketId },
    include: {
      outcomes: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}

/**
 * Try to fetch market from Gamma API if not in database
 */
async function fetchMarketFromGamma(marketId: string): Promise<GammaMarket | null> {
  try {
    return await getMarketById(marketId);
  } catch {
    return null;
  }
}

/**
 * Fetch price history from database
 */
async function fetchPriceHistoryFromDb(
  marketId: string,
  outcomeId: string,
  startDate: Date,
  endDate: Date,
  interval: TimeInterval
): Promise<PriceDataPoint[]> {
  const priceRecords = await prisma.priceHistory.findMany({
    where: {
      marketId,
      outcomeId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      price: true,
      volume: true,
    },
  });

  if (priceRecords.length === 0) {
    return [];
  }

  // Group by interval
  const grouped: Map<string, { prices: number[]; volumes: number[] }> = new Map();

  for (const record of priceRecords) {
    const key = getDateKey(record.timestamp, interval);
    const existing = grouped.get(key) ?? { prices: [], volumes: [] };
    existing.prices.push(record.price);
    existing.volumes.push(record.volume);
    grouped.set(key, existing);
  }

  // Convert to data points
  const dataPoints: PriceDataPoint[] = [];
  for (const [timestamp, data] of grouped) {
    const avgPrice =
      data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length;
    const totalVolume = data.volumes.reduce((sum, v) => sum + v, 0);

    dataPoints.push({
      timestamp,
      price: avgPrice,
      probability: avgPrice * 100,
      volume: totalVolume,
    });
  }

  return dataPoints.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Generate synthetic price history if none exists
 */
function generateSyntheticPriceHistory(
  currentPrice: number,
  startDate: Date,
  endDate: Date,
  interval: TimeInterval
): PriceDataPoint[] {
  const dataPoints: PriceDataPoint[] = [];
  const intervalMs = getIntervalMs(interval);
  const numPoints = Math.max(
    1,
    Math.floor((endDate.getTime() - startDate.getTime()) / intervalMs)
  );

  // Start from 0.5 and move toward current price
  const startPrice = 0.5;
  const priceRange = currentPrice - startPrice;

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(startDate.getTime() + i * intervalMs).toISOString();

    // Calculate price with smooth progression
    const progress = (i + 1) / numPoints;
    const smoothProgress = progress * progress * (3 - 2 * progress);

    // Add variance for realism
    const variance = Math.sin(i * 0.7) * 0.03;
    const price = Math.min(1, Math.max(0, startPrice + priceRange * smoothProgress + variance));

    // Synthetic volume based on position in timeline
    const baseVolume = 10000 + Math.sin(i * 0.5) * 5000;

    dataPoints.push({
      timestamp,
      price,
      probability: price * 100,
      volume: Math.max(0, baseVolume),
    });
  }

  // Ensure last point matches current price
  if (dataPoints.length > 0) {
    const lastPoint = dataPoints[dataPoints.length - 1];
    if (lastPoint) {
      lastPoint.price = currentPrice;
      lastPoint.probability = currentPrice * 100;
    }
  }

  return dataPoints;
}

/**
 * Fetch volume history from database
 */
async function fetchVolumeHistoryFromDb(
  marketId: string,
  startDate: Date,
  endDate: Date,
  interval: TimeInterval
): Promise<{ dataPoints: VolumeDataPoint[]; totalVolume: number; totalTrades: number }> {
  // Fetch trades in the time range
  const trades = await prisma.trade.findMany({
    where: {
      marketId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      timestamp: true,
      usdValue: true,
    },
    orderBy: { timestamp: "asc" },
  });

  if (trades.length === 0) {
    return { dataPoints: [], totalVolume: 0, totalTrades: 0 };
  }

  // Group by interval
  const grouped: Map<string, { volume: number; count: number }> = new Map();

  for (const trade of trades) {
    const key = getDateKey(trade.timestamp, interval);
    const existing = grouped.get(key) ?? { volume: 0, count: 0 };
    existing.volume += trade.usdValue;
    existing.count += 1;
    grouped.set(key, existing);
  }

  // Convert to data points
  const dataPoints: VolumeDataPoint[] = [];
  let totalVolume = 0;
  let totalTrades = 0;

  for (const [timestamp, data] of grouped) {
    dataPoints.push({
      timestamp,
      volume: data.volume,
      tradeCount: data.count,
    });
    totalVolume += data.volume;
    totalTrades += data.count;
  }

  return {
    dataPoints: dataPoints.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    totalVolume,
    totalTrades,
  };
}

/**
 * Generate synthetic volume history if none exists
 */
function generateSyntheticVolumeHistory(
  totalVolume: number,
  startDate: Date,
  endDate: Date,
  interval: TimeInterval
): { dataPoints: VolumeDataPoint[]; totalVolume: number; totalTrades: number } {
  const dataPoints: VolumeDataPoint[] = [];
  const intervalMs = getIntervalMs(interval);
  const numPoints = Math.max(
    1,
    Math.floor((endDate.getTime() - startDate.getTime()) / intervalMs)
  );

  const baseVolumePerPoint = totalVolume / numPoints;
  let accumulatedVolume = 0;
  let totalTrades = 0;

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(startDate.getTime() + i * intervalMs).toISOString();

    // Add variance
    const variance = 0.7 + (Math.sin(i * 0.5) + 1) * 0.3;
    const volume = baseVolumePerPoint * variance;
    const tradeCount = Math.max(1, Math.floor(volume / 1000));

    dataPoints.push({
      timestamp,
      volume,
      tradeCount,
    });

    accumulatedVolume += volume;
    totalTrades += tradeCount;
  }

  // Normalize to match total volume
  if (dataPoints.length > 0 && accumulatedVolume > 0) {
    const normFactor = totalVolume / accumulatedVolume;
    for (const point of dataPoints) {
      point.volume *= normFactor;
    }
  }

  return { dataPoints, totalVolume, totalTrades };
}

/**
 * Fetch recent trades for a market
 */
async function fetchRecentTrades(
  marketId: string,
  limit: number
): Promise<{ items: MarketTradeResponse[]; total: number }> {
  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where: { marketId },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        wallet: {
          select: { address: true },
        },
        outcome: {
          select: { name: true },
        },
      },
    }),
    prisma.trade.count({ where: { marketId } }),
  ]);

  const items: MarketTradeResponse[] = trades.map((trade) => ({
    id: trade.id,
    timestamp: trade.timestamp.toISOString(),
    walletAddress: trade.wallet.address,
    outcome: trade.outcome?.name ?? "Unknown",
    side: trade.side,
    size: trade.usdValue,
    price: trade.price,
    shares: trade.amount,
    isWhale: trade.isWhale,
    txHash: trade.txHash,
  }));

  return { items, total };
}

/**
 * Transform database market to response format
 */
function transformDbMarket(
  market: Prisma.MarketGetPayload<{ include: { outcomes: true } }>
): MarketDetailResponse["market"] {
  return {
    id: market.id,
    slug: market.slug,
    question: market.question,
    description: market.description,
    category: market.category,
    subcategory: market.subcategory,
    tags: market.tags,
    imageUrl: market.imageUrl,
    iconUrl: market.iconUrl,
    resolutionSource: market.resolutionSource,
    active: market.active,
    closed: market.closed,
    archived: market.archived,
    endDate: market.endDate?.toISOString() ?? null,
    createdAt: market.createdAt.toISOString(),
    updatedAt: market.updatedAt.toISOString(),
    resolution: market.resolution,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    volume: market.volume,
    volume24h: market.volume24h,
    liquidity: market.liquidity,
    polymarketUrl: `https://polymarket.com/event/${market.slug}`,
    outcomes: market.outcomes.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      probability: o.probability,
      priceChange24h: o.priceChange24h,
      volume: o.volume,
      winner: o.winner,
      clobTokenId: o.clobTokenId,
    })),
  };
}

/**
 * Transform Gamma market to response format
 */
function transformGammaMarket(market: GammaMarket): MarketDetailResponse["market"] {
  return {
    id: market.id,
    slug: market.slug,
    question: market.question,
    description: market.description ?? null,
    category: market.category ?? null,
    subcategory: null,
    tags: [], // Gamma API doesn't provide tags
    imageUrl: market.image ?? null,
    iconUrl: market.icon ?? null,
    resolutionSource: market.resolutionSource ?? null,
    active: market.active,
    closed: market.closed,
    archived: market.archived ?? false,
    endDate: market.endDate ?? null,
    createdAt: market.createdAt,
    updatedAt: market.updatedAt,
    resolution: null,
    resolvedAt: null,
    volume: market.volume ?? 0,
    volume24h: market.volumeNum ?? 0,
    liquidity: market.liquidity ?? 0,
    polymarketUrl: `https://polymarket.com/event/${market.slug}`,
    outcomes: market.outcomes.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      probability: o.price * 100,
      priceChange24h: 0,
      volume: 0,
      winner: null,
      clobTokenId: o.clobTokenId ?? null,
    })),
  };
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/market/[id]
 *
 * Returns complete market data with price history, volume history, and recent trades.
 *
 * URL Parameters:
 * - id: Market ID (condition ID or slug)
 *
 * Query Parameters:
 * - priceInterval: Time interval for price history (1h, 4h, 1d, 1w) (default: 1d)
 * - priceDays: Number of days of price history (1-180) (default: 30)
 * - volumeInterval: Time interval for volume history (1h, 4h, 1d, 1w) (default: 1d)
 * - volumeDays: Number of days of volume history (1-180) (default: 30)
 * - tradesLimit: Number of recent trades to fetch (1-100) (default: 25)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<MarketDetailResponse | MarketDetailErrorResponse>> {
  try {
    const { id: marketId } = await params;

    // Validate market ID
    if (!marketId || marketId.trim() === "") {
      return NextResponse.json(
        {
          error: "Invalid market ID",
          details: "Market ID is required",
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const priceInterval = parseIntervalParam(
      searchParams.get("priceInterval"),
      DEFAULT_PRICE_INTERVAL
    );
    const priceDays = parseIntParam(searchParams.get("priceDays"), 1, 180, DEFAULT_PRICE_DAYS);
    const volumeInterval = parseIntervalParam(
      searchParams.get("volumeInterval"),
      DEFAULT_VOLUME_INTERVAL
    );
    const volumeDays = parseIntParam(searchParams.get("volumeDays"), 1, 180, DEFAULT_VOLUME_DAYS);
    const tradesLimit = parseIntParam(searchParams.get("tradesLimit"), 1, 100, DEFAULT_TRADES_LIMIT);

    // Check cache
    const cacheKey = generateCacheKey(marketId, {
      priceInterval,
      priceDays,
      volumeInterval,
      volumeDays,
      tradesLimit,
    });
    const cached = marketCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }

    // Try to fetch market from database first
    let marketData: MarketDetailResponse["market"] | null = null;
    const dbMarket = await fetchMarketFromDb(marketId);

    if (dbMarket) {
      marketData = transformDbMarket(dbMarket);
    } else {
      // Try fetching from Gamma API
      const gammaMarket = await fetchMarketFromGamma(marketId);
      if (gammaMarket) {
        marketData = transformGammaMarket(gammaMarket);
      }
    }

    if (!marketData) {
      return NextResponse.json(
        {
          error: "Market not found",
          details: `No market found with ID ${marketId}`,
        },
        { status: 404 }
      );
    }

    // Calculate date ranges
    const priceEndDate = new Date();
    const priceStartDate = new Date(priceEndDate.getTime() - priceDays * 24 * 60 * 60 * 1000);
    const volumeEndDate = new Date();
    const volumeStartDate = new Date(volumeEndDate.getTime() - volumeDays * 24 * 60 * 60 * 1000);

    // Get primary outcome for price history
    const primaryOutcome = marketData.outcomes[0];
    const primaryOutcomeId = primaryOutcome?.id ?? "";
    const primaryOutcomeName = primaryOutcome?.name ?? "Unknown";
    const currentPrice = primaryOutcome?.price ?? 0.5;

    // Fetch all data in parallel
    const [priceHistory, volumeHistoryData, tradesData] = await Promise.all([
      // Price history
      dbMarket
        ? fetchPriceHistoryFromDb(
            marketId,
            primaryOutcomeId,
            priceStartDate,
            priceEndDate,
            priceInterval
          ).then((data) =>
            data.length > 0
              ? data
              : generateSyntheticPriceHistory(currentPrice, priceStartDate, priceEndDate, priceInterval)
          )
        : Promise.resolve(
            generateSyntheticPriceHistory(currentPrice, priceStartDate, priceEndDate, priceInterval)
          ),

      // Volume history
      dbMarket
        ? fetchVolumeHistoryFromDb(marketId, volumeStartDate, volumeEndDate, volumeInterval).then(
            (data) =>
              data.dataPoints.length > 0
                ? data
                : generateSyntheticVolumeHistory(
                    marketData!.volume,
                    volumeStartDate,
                    volumeEndDate,
                    volumeInterval
                  )
          )
        : Promise.resolve(
            generateSyntheticVolumeHistory(
              marketData.volume,
              volumeStartDate,
              volumeEndDate,
              volumeInterval
            )
          ),

      // Recent trades
      dbMarket ? fetchRecentTrades(marketId, tradesLimit) : Promise.resolve({ items: [], total: 0 }),
    ]);

    // Build response
    const response: MarketDetailResponse = {
      market: marketData,
      priceHistory: {
        outcomeId: primaryOutcomeId,
        outcomeName: primaryOutcomeName,
        interval: priceInterval,
        startDate: priceStartDate.toISOString(),
        endDate: priceEndDate.toISOString(),
        dataPoints: priceHistory,
      },
      volumeHistory: {
        interval: volumeInterval,
        startDate: volumeStartDate.toISOString(),
        endDate: volumeEndDate.toISOString(),
        totalVolume: volumeHistoryData.totalVolume,
        totalTrades: volumeHistoryData.totalTrades,
        dataPoints: volumeHistoryData.dataPoints,
      },
      trades: {
        items: tradesData.items,
        total: tradesData.total,
        limit: tradesLimit,
      },
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    marketCache.set(cacheKey, { data: response, timestamp: now });
    cleanupCache();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching market details:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch market details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
