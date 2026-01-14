/**
 * Dashboard Whales API Endpoint
 *
 * Provides a paginated list of suspicious wallets ordered by suspicion score.
 *
 * Query parameters:
 * - limit: Number of results (1-50, default 10)
 * - offset: Pagination offset (default 0)
 * - minScore: Minimum suspicion score (0-100, default 0)
 * - isWhale: Filter by whale status (true/false)
 * - isInsider: Filter by insider status (true/false)
 * - isFlagged: Filter by flagged status (true/false)
 *
 * Returns wallet summaries with trading stats and flags.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { Prisma, RiskLevel, WalletType } from "@prisma/client";

/**
 * Wallet summary for dashboard display
 */
export interface WalletSummary {
  /** Wallet ID */
  id: string;
  /** Wallet address */
  address: string;
  /** Human-readable label */
  label: string | null;
  /** Wallet type classification */
  walletType: WalletType;
  /** Suspicion score (0-100) */
  suspicionScore: number;
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Total trading volume in USD */
  totalVolume: number;
  /** Total number of trades */
  tradeCount: number;
  /** Win rate percentage (0-100) */
  winRate: number | null;
  /** Total profit/loss in USD */
  totalPnl: number;
  /** Average trade size in USD */
  avgTradeSize: number | null;
  /** Largest single trade in USD */
  maxTradeSize: number | null;
  /** First trade timestamp */
  firstTradeAt: string | null;
  /** Most recent trade timestamp */
  lastTradeAt: string | null;
  /** Wallet age in days */
  walletAgeDays: number | null;
  /** Wallet flags */
  flags: {
    isWhale: boolean;
    isInsider: boolean;
    isFresh: boolean;
    isFlagged: boolean;
    isMonitored: boolean;
    isSanctioned: boolean;
  };
}

/**
 * Response type for dashboard whales endpoint
 */
export interface DashboardWhalesResponse {
  /** Array of wallet summaries */
  wallets: WalletSummary[];
  /** Pagination info */
  pagination: {
    /** Current offset */
    offset: number;
    /** Number of results returned */
    limit: number;
    /** Total number of matching wallets */
    total: number;
    /** Whether there are more results */
    hasMore: boolean;
  };
  /** Applied filters */
  filters: {
    minScore: number | null;
    isWhale: boolean | null;
    isInsider: boolean | null;
    isFlagged: boolean | null;
  };
  /** Timestamp of when the response was generated */
  generatedAt: string;
}

/**
 * Parse boolean query parameter
 */
function parseBoolean(value: string | null): boolean | null {
  if (!value) return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
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

/**
 * Parse float with bounds
 */
function parseFloatParam(
  value: string | null,
  min: number,
  max: number,
  defaultValue: number | null
): number | null {
  if (!value) return defaultValue;

  const parsed = Number.parseFloat(value);
  if (isNaN(parsed)) return defaultValue;

  return Math.max(min, Math.min(max, parsed));
}

// Simple in-memory cache
let cachedWhales: Map<string, { data: DashboardWhalesResponse; timestamp: number }> =
  new Map();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds
const MAX_CACHE_ENTRIES = 50;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(params: URLSearchParams): string {
  const keys = ["limit", "offset", "minScore", "isWhale", "isInsider", "isFlagged"];
  return keys.map((k) => `${k}:${params.get(k) || ""}`).join("|");
}

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of cachedWhales) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cachedWhales.delete(key);
    }
  }

  // If still too many entries, remove oldest
  if (cachedWhales.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(cachedWhales.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      cachedWhales.delete(key);
    }
  }
}

/**
 * Fetch wallets from the database with filters
 */
async function fetchWallets(params: {
  limit: number;
  offset: number;
  minScore: number | null;
  isWhale: boolean | null;
  isInsider: boolean | null;
  isFlagged: boolean | null;
}): Promise<{
  wallets: WalletSummary[];
  total: number;
}> {
  // Build where clause
  const where: Prisma.WalletWhereInput = {};

  // Always filter for wallets with some suspicion score by default
  // unless minScore is explicitly set to 0
  if (params.minScore !== null && params.minScore > 0) {
    where.suspicionScore = { gte: params.minScore };
  }

  if (params.isWhale !== null) {
    where.isWhale = params.isWhale;
  }

  if (params.isInsider !== null) {
    where.isInsider = params.isInsider;
  }

  if (params.isFlagged !== null) {
    where.isFlagged = params.isFlagged;
  }

  // Execute count and find in parallel
  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      orderBy: [
        { suspicionScore: "desc" },
        { totalVolume: "desc" },
      ],
      take: params.limit,
      skip: params.offset,
      select: {
        id: true,
        address: true,
        label: true,
        walletType: true,
        suspicionScore: true,
        riskLevel: true,
        totalVolume: true,
        tradeCount: true,
        winRate: true,
        totalPnl: true,
        avgTradeSize: true,
        maxTradeSize: true,
        firstTradeAt: true,
        lastTradeAt: true,
        walletAgeDays: true,
        isWhale: true,
        isInsider: true,
        isFresh: true,
        isFlagged: true,
        isMonitored: true,
        isSanctioned: true,
      },
    }),
    prisma.wallet.count({ where }),
  ]);

  // Transform to response format
  const walletSummaries: WalletSummary[] = wallets.map((wallet) => ({
    id: wallet.id,
    address: wallet.address,
    label: wallet.label,
    walletType: wallet.walletType,
    suspicionScore: wallet.suspicionScore,
    riskLevel: wallet.riskLevel,
    totalVolume: wallet.totalVolume,
    tradeCount: wallet.tradeCount,
    winRate: wallet.winRate,
    totalPnl: wallet.totalPnl,
    avgTradeSize: wallet.avgTradeSize,
    maxTradeSize: wallet.maxTradeSize,
    firstTradeAt: wallet.firstTradeAt?.toISOString() ?? null,
    lastTradeAt: wallet.lastTradeAt?.toISOString() ?? null,
    walletAgeDays: wallet.walletAgeDays,
    flags: {
      isWhale: wallet.isWhale,
      isInsider: wallet.isInsider,
      isFresh: wallet.isFresh,
      isFlagged: wallet.isFlagged,
      isMonitored: wallet.isMonitored,
      isSanctioned: wallet.isSanctioned,
    },
  }));

  return { wallets: walletSummaries, total };
}

/**
 * GET /api/dashboard/whales
 *
 * Returns paginated list of suspicious wallets ordered by suspicion score.
 *
 * Query parameters:
 * - limit: Number of results (1-50, default 10)
 * - offset: Pagination offset (default 0)
 * - minScore: Minimum suspicion score (0-100, default 0)
 * - isWhale: Filter by whale status (true/false)
 * - isInsider: Filter by insider status (true/false)
 * - isFlagged: Filter by flagged status (true/false)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<DashboardWhalesResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseIntParam(searchParams.get("limit"), 1, 50, 10);
    const offset = parseIntParam(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER, 0);
    const minScore = parseFloatParam(searchParams.get("minScore"), 0, 100, null);
    const isWhale = parseBoolean(searchParams.get("isWhale"));
    const isInsider = parseBoolean(searchParams.get("isInsider"));
    const isFlagged = parseBoolean(searchParams.get("isFlagged"));

    // Check cache
    const cacheKey = generateCacheKey(searchParams);
    const cached = cachedWhales.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch data
    const { wallets, total } = await fetchWallets({
      limit,
      offset,
      minScore,
      isWhale,
      isInsider,
      isFlagged,
    });

    const response: DashboardWhalesResponse = {
      wallets,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + wallets.length < total,
      },
      filters: {
        minScore,
        isWhale,
        isInsider,
        isFlagged,
      },
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    cachedWhales.set(cacheKey, { data: response, timestamp: now });
    cleanupCache();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard whales:", error);

    return NextResponse.json(
      { error: "Failed to fetch dashboard whales" },
      { status: 500 }
    );
  }
}
