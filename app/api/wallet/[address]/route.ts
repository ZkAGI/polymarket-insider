/**
 * Wallet Detail API Endpoint
 *
 * Provides complete wallet profile data including trading history and P&L calculations.
 *
 * Route: GET /api/wallet/[address]
 *
 * Query parameters:
 * - tradesLimit: Number of trades per page (1-100, default 25)
 * - tradesOffset: Pagination offset for trades (default 0)
 * - sortField: Sort field for trades (timestamp, size, price, profitLoss) (default: timestamp)
 * - sortDirection: Sort direction (asc, desc) (default: desc)
 *
 * Returns:
 * - Wallet profile with metadata and flags
 * - Trading statistics and P&L calculations
 * - Paginated trade history
 * - P&L data points for charting
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { Prisma, RiskLevel, WalletType, TradeSide } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

/**
 * Trade data for display in wallet profile
 */
export interface WalletTradeResponse {
  /** Unique trade ID */
  id: string;
  /** Trade timestamp */
  timestamp: string;
  /** Market ID */
  marketId: string;
  /** Market question/title */
  marketTitle: string;
  /** Outcome name (YES/NO or other) */
  outcome: string;
  /** Trade side (BUY/SELL) */
  side: TradeSide;
  /** Trade size in USD */
  size: number;
  /** Execution price (0-1) */
  price: number;
  /** Number of shares traded */
  shares: number;
  /** Fee paid in USD */
  fee: number;
  /** Transaction hash */
  txHash: string | null;
  /** Profit/loss for resolved trades */
  profitLoss: number | null;
  /** Whether this is a whale trade */
  isWhale: boolean;
}

/**
 * P&L data point for charting
 */
export interface PnLDataPoint {
  /** Data point timestamp */
  timestamp: string;
  /** Cumulative P&L at this point */
  cumulativePnL: number;
  /** Daily P&L for this day */
  dailyPnL: number;
}

/**
 * Complete wallet profile response
 */
export interface WalletDetailResponse {
  /** Wallet profile data */
  wallet: {
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
    /** Total profit/loss in USD */
    totalPnl: number;
    /** Total number of trades */
    tradeCount: number;
    /** Number of winning trades */
    winCount: number;
    /** Win rate percentage (0-100) */
    winRate: number | null;
    /** Average trade size in USD */
    avgTradeSize: number | null;
    /** Largest single trade in USD */
    maxTradeSize: number | null;
    /** First trade timestamp */
    firstTradeAt: string | null;
    /** Most recent trade timestamp */
    lastTradeAt: string | null;
    /** When the wallet was first seen on-chain */
    walletCreatedAt: string | null;
    /** Number of blockchain transactions */
    onChainTxCount: number;
    /** Wallet age in days */
    walletAgeDays: number | null;
    /** Primary funding source type */
    primaryFundingSource: string | null;
    /** Notes about the wallet */
    notes: string | null;
    /** Record creation timestamp */
    createdAt: string;
    /** Record update timestamp */
    updatedAt: string;
    /** Wallet flags */
    flags: {
      isWhale: boolean;
      isInsider: boolean;
      isFresh: boolean;
      isFlagged: boolean;
      isMonitored: boolean;
      isSanctioned: boolean;
    };
  };
  /** Paginated trade history */
  trades: {
    items: WalletTradeResponse[];
    pagination: {
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
    sort: {
      field: string;
      direction: string;
    };
  };
  /** P&L data for charting */
  pnlHistory: PnLDataPoint[];
  /** Response metadata */
  generatedAt: string;
}

/**
 * Error response type
 */
export interface WalletDetailErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
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
 * Parse sort field parameter
 */
function parseSortField(value: string | null): string {
  const validFields = ["timestamp", "size", "price", "profitLoss"];
  if (value && validFields.includes(value)) {
    return value;
  }
  return "timestamp";
}

/**
 * Parse sort direction parameter
 */
function parseSortDirection(value: string | null): "asc" | "desc" {
  if (value === "asc") return "asc";
  return "desc";
}

/**
 * Map sort field to Prisma field name
 */
function mapSortFieldToPrisma(field: string): string {
  switch (field) {
    case "timestamp":
      return "timestamp";
    case "size":
      return "usdValue";
    case "price":
      return "price";
    case "profitLoss":
      return "usdValue"; // We'll sort by value as a proxy
    default:
      return "timestamp";
  }
}

// ============================================================================
// Cache
// ============================================================================

// Simple in-memory cache for wallet data
const walletCache: Map<string, { data: WalletDetailResponse; timestamp: number }> =
  new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const MAX_CACHE_ENTRIES = 100;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(
  address: string,
  params: { limit: number; offset: number; sortField: string; sortDirection: string }
): string {
  return `${address}:${params.limit}:${params.offset}:${params.sortField}:${params.sortDirection}`;
}

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of walletCache) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      walletCache.delete(key);
    }
  }

  // If still too many entries, remove oldest
  if (walletCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(walletCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      walletCache.delete(key);
    }
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch wallet profile from database
 */
async function fetchWalletProfile(address: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { address: address.toLowerCase() },
    select: {
      id: true,
      address: true,
      label: true,
      walletType: true,
      suspicionScore: true,
      riskLevel: true,
      totalVolume: true,
      totalPnl: true,
      tradeCount: true,
      winCount: true,
      winRate: true,
      avgTradeSize: true,
      maxTradeSize: true,
      firstTradeAt: true,
      lastTradeAt: true,
      walletCreatedAt: true,
      onChainTxCount: true,
      walletAgeDays: true,
      primaryFundingSource: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      isWhale: true,
      isInsider: true,
      isFresh: true,
      isFlagged: true,
      isMonitored: true,
      isSanctioned: true,
    },
  });

  return wallet;
}

/**
 * Fetch wallet trades with pagination and sorting
 */
async function fetchWalletTrades(
  walletId: string,
  params: {
    limit: number;
    offset: number;
    sortField: string;
    sortDirection: "asc" | "desc";
  }
) {
  const orderBy: Prisma.TradeOrderByWithRelationInput = {
    [mapSortFieldToPrisma(params.sortField)]: params.sortDirection,
  };

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where: { walletId },
      orderBy,
      take: params.limit,
      skip: params.offset,
      include: {
        market: {
          select: {
            id: true,
            question: true,
          },
        },
        outcome: {
          select: {
            name: true,
            winner: true,
            payout: true,
          },
        },
      },
    }),
    prisma.trade.count({ where: { walletId } }),
  ]);

  return { trades, total };
}

/**
 * Calculate P&L history from trades
 * Returns daily P&L data points for charting
 */
async function calculatePnLHistory(walletId: string): Promise<PnLDataPoint[]> {
  // Fetch all trades for the wallet, ordered by timestamp
  const trades = await prisma.trade.findMany({
    where: { walletId },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      side: true,
      usdValue: true,
      price: true,
      outcome: {
        select: {
          winner: true,
          payout: true,
        },
      },
    },
  });

  if (trades.length === 0) {
    return [];
  }

  // Group trades by day and calculate daily P&L
  const dailyPnL: Map<string, number> = new Map();

  for (const trade of trades) {
    const dateKey = trade.timestamp.toISOString().split("T")[0];
    if (!dateKey) continue;

    const currentPnL = dailyPnL.get(dateKey) ?? 0;

    // Calculate P&L for this trade
    let tradePnL = 0;

    if (trade.outcome?.winner !== null && trade.outcome?.winner !== undefined) {
      // Resolved trade - calculate actual P&L
      if (trade.side === TradeSide.BUY) {
        // If bought and outcome won, profit = (payout - price) * value / price
        // If bought and outcome lost, loss = -value
        if (trade.outcome.winner) {
          tradePnL = trade.usdValue * ((trade.outcome.payout ?? 1) / trade.price - 1);
        } else {
          tradePnL = -trade.usdValue;
        }
      } else {
        // SELL - inverse of BUY
        if (trade.outcome.winner) {
          tradePnL = -trade.usdValue * ((trade.outcome.payout ?? 1) / trade.price - 1);
        } else {
          tradePnL = trade.usdValue;
        }
      }
    }

    dailyPnL.set(dateKey, currentPnL + tradePnL);
  }

  // Convert to array and calculate cumulative P&L
  const sortedDates = Array.from(dailyPnL.keys()).sort();
  let cumulativePnL = 0;

  const pnlHistory: PnLDataPoint[] = sortedDates.map((dateKey) => {
    const dailyValue = dailyPnL.get(dateKey) ?? 0;
    cumulativePnL += dailyValue;

    return {
      timestamp: new Date(dateKey).toISOString(),
      dailyPnL: dailyValue,
      cumulativePnL,
    };
  });

  return pnlHistory;
}

/**
 * Transform database trade to API response format
 */
function transformTrade(
  trade: Prisma.TradeGetPayload<{
    include: {
      market: { select: { id: true; question: true } };
      outcome: { select: { name: true; winner: true; payout: true } };
    };
  }>
): WalletTradeResponse {
  // Calculate profit/loss for resolved trades
  let profitLoss: number | null = null;

  if (trade.outcome?.winner !== null && trade.outcome?.winner !== undefined) {
    if (trade.side === TradeSide.BUY) {
      if (trade.outcome.winner) {
        profitLoss = trade.usdValue * ((trade.outcome.payout ?? 1) / trade.price - 1);
      } else {
        profitLoss = -trade.usdValue;
      }
    } else {
      if (trade.outcome.winner) {
        profitLoss = -trade.usdValue * ((trade.outcome.payout ?? 1) / trade.price - 1);
      } else {
        profitLoss = trade.usdValue;
      }
    }
  }

  return {
    id: trade.id,
    timestamp: trade.timestamp.toISOString(),
    marketId: trade.marketId,
    marketTitle: trade.market?.question ?? "Unknown Market",
    outcome: trade.outcome?.name ?? "Unknown",
    side: trade.side,
    size: trade.usdValue,
    price: trade.price,
    shares: trade.amount,
    fee: trade.feeUsd,
    txHash: trade.txHash,
    profitLoss,
    isWhale: trade.isWhale,
  };
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/wallet/[address]
 *
 * Returns complete wallet profile with trading history and P&L data.
 *
 * URL Parameters:
 * - address: Wallet address (42-character hex string starting with 0x)
 *
 * Query Parameters:
 * - tradesLimit: Number of trades per page (1-100, default 25)
 * - tradesOffset: Pagination offset for trades (default 0)
 * - sortField: Sort field for trades (timestamp, size, price, profitLoss)
 * - sortDirection: Sort direction (asc, desc)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<WalletDetailResponse | WalletDetailErrorResponse>> {
  try {
    const { address } = await params;

    // Validate address format
    if (!address || !isValidAddress(address)) {
      return NextResponse.json(
        {
          error: "Invalid wallet address",
          details: "Address must be a 42-character hex string starting with 0x",
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const tradesLimit = parseIntParam(searchParams.get("tradesLimit"), 1, 100, 25);
    const tradesOffset = parseIntParam(
      searchParams.get("tradesOffset"),
      0,
      Number.MAX_SAFE_INTEGER,
      0
    );
    const sortField = parseSortField(searchParams.get("sortField"));
    const sortDirection = parseSortDirection(searchParams.get("sortDirection"));

    // Check cache
    const cacheKey = generateCacheKey(address, {
      limit: tradesLimit,
      offset: tradesOffset,
      sortField,
      sortDirection,
    });
    const cached = walletCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch wallet profile
    const wallet = await fetchWalletProfile(address);

    if (!wallet) {
      return NextResponse.json(
        {
          error: "Wallet not found",
          details: `No wallet found with address ${address}`,
        },
        { status: 404 }
      );
    }

    // Fetch trades and P&L history in parallel
    const [tradesResult, pnlHistory] = await Promise.all([
      fetchWalletTrades(wallet.id, {
        limit: tradesLimit,
        offset: tradesOffset,
        sortField,
        sortDirection,
      }),
      calculatePnLHistory(wallet.id),
    ]);

    // Transform trades to response format
    const tradeItems = tradesResult.trades.map(transformTrade);

    // Build response
    const response: WalletDetailResponse = {
      wallet: {
        id: wallet.id,
        address: wallet.address,
        label: wallet.label,
        walletType: wallet.walletType,
        suspicionScore: wallet.suspicionScore,
        riskLevel: wallet.riskLevel,
        totalVolume: wallet.totalVolume,
        totalPnl: wallet.totalPnl,
        tradeCount: wallet.tradeCount,
        winCount: wallet.winCount,
        winRate: wallet.winRate,
        avgTradeSize: wallet.avgTradeSize,
        maxTradeSize: wallet.maxTradeSize,
        firstTradeAt: wallet.firstTradeAt?.toISOString() ?? null,
        lastTradeAt: wallet.lastTradeAt?.toISOString() ?? null,
        walletCreatedAt: wallet.walletCreatedAt?.toISOString() ?? null,
        onChainTxCount: wallet.onChainTxCount,
        walletAgeDays: wallet.walletAgeDays,
        primaryFundingSource: wallet.primaryFundingSource,
        notes: wallet.notes,
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
        flags: {
          isWhale: wallet.isWhale,
          isInsider: wallet.isInsider,
          isFresh: wallet.isFresh,
          isFlagged: wallet.isFlagged,
          isMonitored: wallet.isMonitored,
          isSanctioned: wallet.isSanctioned,
        },
      },
      trades: {
        items: tradeItems,
        pagination: {
          offset: tradesOffset,
          limit: tradesLimit,
          total: tradesResult.total,
          hasMore: tradesOffset + tradeItems.length < tradesResult.total,
        },
        sort: {
          field: sortField,
          direction: sortDirection,
        },
      },
      pnlHistory,
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    walletCache.set(cacheKey, { data: response, timestamp: now });
    cleanupCache();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching wallet details:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch wallet details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
