/**
 * Dashboard Stats API Endpoint
 *
 * Provides aggregated statistics for the dashboard including:
 * - Total alerts (24h)
 * - Critical alerts count
 * - Suspicious wallets count
 * - Hot markets count
 * - Total volume (24h)
 * - Whale trades count
 * - Trend calculations vs previous period
 */

import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { AlertSeverity } from "@prisma/client";

/**
 * Response type for dashboard stats
 */
export interface DashboardStatsResponse {
  /** Total alerts in the last 24 hours */
  alerts: number;
  /** Number of CRITICAL and HIGH severity alerts */
  criticalAlerts: number;
  /** Number of wallets with suspicion score >= 50 */
  suspiciousWallets: number;
  /** Number of markets with alerts in last 24h */
  hotMarkets: number;
  /** Total USD volume from trades in last 24h */
  volume24h: number;
  /** Number of whale trades in last 24h */
  whaleTrades: number;
  /** Trend percentages compared to previous period */
  trends: {
    alerts: number;
    criticalAlerts: number;
    suspiciousWallets: number;
    hotMarkets: number;
    volume24h: number;
    whaleTrades: number;
  };
  /** Timestamp of when the stats were generated */
  generatedAt: string;
}

// Simple in-memory cache
let cachedStats: DashboardStatsResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Calculate trend percentage between two values
 */
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Fetch dashboard statistics from the database
 */
async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Execute all queries in parallel for efficiency
  const [
    // Current period stats (last 24h)
    alertsCount,
    criticalAlertsCount,
    suspiciousWalletsCount,
    hotMarketsCount,
    volumeResult,
    whaleTradesCount,
    // Previous period stats (24-48h ago) for trend calculation
    prevAlertsCount,
    prevCriticalAlertsCount,
    prevSuspiciousWalletsCount,
    prevHotMarketsCount,
    prevVolumeResult,
    prevWhaleTradesCount,
  ] = await Promise.all([
    // Current period: Alerts in last 24h
    prisma.alert.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),

    // Current period: Critical alerts (HIGH + CRITICAL severity)
    prisma.alert.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
      },
    }),

    // Current period: Suspicious wallets (suspicion score >= 50)
    prisma.wallet.count({
      where: {
        suspicionScore: { gte: 50 },
      },
    }),

    // Current period: Hot markets (markets with alerts in last 24h)
    prisma.alert.groupBy({
      by: ["marketId"],
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        marketId: { not: null },
      },
    }).then((groups: { marketId: string | null }[]) => groups.length),

    // Current period: Total volume from trades in last 24h
    prisma.trade.aggregate({
      where: {
        timestamp: { gte: twentyFourHoursAgo },
      },
      _sum: { usdValue: true },
    }),

    // Current period: Whale trades in last 24h
    prisma.trade.count({
      where: {
        timestamp: { gte: twentyFourHoursAgo },
        isWhale: true,
      },
    }),

    // Previous period: Alerts (24-48h ago)
    prisma.alert.count({
      where: {
        createdAt: {
          gte: fortyEightHoursAgo,
          lt: twentyFourHoursAgo,
        },
      },
    }),

    // Previous period: Critical alerts
    prisma.alert.count({
      where: {
        createdAt: {
          gte: fortyEightHoursAgo,
          lt: twentyFourHoursAgo,
        },
        severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
      },
    }),

    // Previous period: Suspicious wallets (count as of 24h ago)
    // Since we don't have historical snapshots, we use current count as baseline
    // In a production system, you'd query wallet snapshots from 24h ago
    prisma.wallet.count({
      where: {
        suspicionScore: { gte: 50 },
        updatedAt: { lt: twentyFourHoursAgo },
      },
    }),

    // Previous period: Hot markets (24-48h ago)
    prisma.alert.groupBy({
      by: ["marketId"],
      where: {
        createdAt: {
          gte: fortyEightHoursAgo,
          lt: twentyFourHoursAgo,
        },
        marketId: { not: null },
      },
    }).then((groups: { marketId: string | null }[]) => groups.length),

    // Previous period: Volume (24-48h ago)
    prisma.trade.aggregate({
      where: {
        timestamp: {
          gte: fortyEightHoursAgo,
          lt: twentyFourHoursAgo,
        },
      },
      _sum: { usdValue: true },
    }),

    // Previous period: Whale trades (24-48h ago)
    prisma.trade.count({
      where: {
        timestamp: {
          gte: fortyEightHoursAgo,
          lt: twentyFourHoursAgo,
        },
        isWhale: true,
      },
    }),
  ]);

  const currentVolume = volumeResult._sum.usdValue ?? 0;
  const previousVolume = prevVolumeResult._sum.usdValue ?? 0;

  return {
    alerts: alertsCount,
    criticalAlerts: criticalAlertsCount,
    suspiciousWallets: suspiciousWalletsCount,
    hotMarkets: hotMarketsCount,
    volume24h: currentVolume,
    whaleTrades: whaleTradesCount,
    trends: {
      alerts: calculateTrend(alertsCount, prevAlertsCount),
      criticalAlerts: calculateTrend(criticalAlertsCount, prevCriticalAlertsCount),
      suspiciousWallets: calculateTrend(suspiciousWalletsCount, prevSuspiciousWalletsCount),
      hotMarkets: calculateTrend(hotMarketsCount, prevHotMarketsCount),
      volume24h: calculateTrend(currentVolume, previousVolume),
      whaleTrades: calculateTrend(whaleTradesCount, prevWhaleTradesCount),
    },
    generatedAt: now.toISOString(),
  };
}

/**
 * GET /api/dashboard/stats
 *
 * Returns aggregated dashboard statistics with 30-second caching.
 */
export async function GET(): Promise<NextResponse<DashboardStatsResponse | { error: string }>> {
  try {
    const now = Date.now();

    // Check if we have valid cached data
    if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedStats, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch fresh data
    const stats = await fetchDashboardStats();

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);

    // If we have stale cached data, return it with a warning
    if (cachedStats) {
      return NextResponse.json(cachedStats, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Cache": "STALE",
          "X-Cache-Error": "Database query failed, serving stale data",
        },
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
