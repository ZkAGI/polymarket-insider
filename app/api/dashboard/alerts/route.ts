/**
 * Dashboard Alerts API Endpoint
 *
 * Provides paginated, filterable list of alerts for the dashboard.
 * Supports filtering by:
 * - severity (comma-separated list of severities)
 * - type (comma-separated list of alert types)
 * - since (ISO timestamp for alerts created after)
 * - read (true/false to filter by read status)
 * - limit (number of results, default 20, max 100)
 * - offset (pagination offset, default 0)
 *
 * Returns alerts with related market and wallet data.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { AlertSeverity, AlertType, Prisma } from "@prisma/client";

/**
 * Alert summary for dashboard display
 */
export interface AlertSummary {
  /** Unique alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Alert tags */
  tags: string[];
  /** Whether the alert has been read */
  read: boolean;
  /** Whether the alert has been acknowledged */
  acknowledged: boolean;
  /** Alert creation timestamp */
  createdAt: string;
  /** Related market info (if applicable) */
  market: {
    id: string;
    question: string;
    slug: string;
    category: string | null;
  } | null;
  /** Related wallet info (if applicable) */
  wallet: {
    id: string;
    address: string;
    label: string | null;
    suspicionScore: number;
  } | null;
}

/**
 * Response type for dashboard alerts
 */
export interface DashboardAlertsResponse {
  /** Array of alert summaries */
  alerts: AlertSummary[];
  /** Pagination info */
  pagination: {
    /** Current offset */
    offset: number;
    /** Number of results returned */
    limit: number;
    /** Total number of matching alerts */
    total: number;
    /** Whether there are more results */
    hasMore: boolean;
  };
  /** Applied filters */
  filters: {
    severity: AlertSeverity[] | null;
    type: AlertType[] | null;
    since: string | null;
    read: boolean | null;
  };
  /** Timestamp of when the response was generated */
  generatedAt: string;
}

/**
 * Validate severity values
 */
function parseSeverities(value: string | null): AlertSeverity[] | null {
  if (!value) return null;

  const validSeverities = Object.values(AlertSeverity);
  const severities = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => validSeverities.includes(s as AlertSeverity)) as AlertSeverity[];

  return severities.length > 0 ? severities : null;
}

/**
 * Validate alert type values
 */
function parseTypes(value: string | null): AlertType[] | null {
  if (!value) return null;

  const validTypes = Object.values(AlertType);
  const types = value
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => validTypes.includes(t as AlertType)) as AlertType[];

  return types.length > 0 ? types : null;
}

/**
 * Parse date string to Date object
 */
function parseDate(value: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Parse boolean value
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
function parseInt(value: string | null, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;

  return Math.max(min, Math.min(max, parsed));
}

// Simple in-memory cache
let cachedAlerts: Map<string, { data: DashboardAlertsResponse; timestamp: number }> = new Map();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds
const MAX_CACHE_ENTRIES = 100;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(params: URLSearchParams): string {
  const keys = ["severity", "type", "since", "read", "limit", "offset"];
  return keys.map((k) => `${k}:${params.get(k) || ""}`).join("|");
}

/**
 * Clean up old cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of cachedAlerts) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cachedAlerts.delete(key);
    }
  }

  // If still too many entries, remove oldest
  if (cachedAlerts.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(cachedAlerts.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      cachedAlerts.delete(key);
    }
  }
}

/**
 * Fetch alerts from the database with filters
 */
async function fetchAlerts(params: {
  severities: AlertSeverity[] | null;
  types: AlertType[] | null;
  since: Date | null;
  read: boolean | null;
  limit: number;
  offset: number;
}): Promise<{
  alerts: AlertSummary[];
  total: number;
}> {
  // Build where clause
  const where: Prisma.AlertWhereInput = {};

  if (params.severities && params.severities.length > 0) {
    where.severity = { in: params.severities };
  }

  if (params.types && params.types.length > 0) {
    where.type = { in: params.types };
  }

  if (params.since) {
    where.createdAt = { gte: params.since };
  }

  if (params.read !== null) {
    where.read = params.read;
  }

  // Execute count and find in parallel
  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
      include: {
        market: {
          select: {
            id: true,
            question: true,
            slug: true,
            category: true,
          },
        },
        wallet: {
          select: {
            id: true,
            address: true,
            label: true,
            suspicionScore: true,
          },
        },
      },
    }),
    prisma.alert.count({ where }),
  ]);

  // Transform to response format
  const alertSummaries: AlertSummary[] = alerts.map((alert) => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    tags: alert.tags,
    read: alert.read,
    acknowledged: alert.acknowledged,
    createdAt: alert.createdAt.toISOString(),
    market: alert.market
      ? {
          id: alert.market.id,
          question: alert.market.question,
          slug: alert.market.slug,
          category: alert.market.category,
        }
      : null,
    wallet: alert.wallet
      ? {
          id: alert.wallet.id,
          address: alert.wallet.address,
          label: alert.wallet.label,
          suspicionScore: alert.wallet.suspicionScore,
        }
      : null,
  }));

  return { alerts: alertSummaries, total };
}

/**
 * GET /api/dashboard/alerts
 *
 * Returns paginated, filterable list of alerts with related data.
 *
 * Query parameters:
 * - limit: Number of results (1-100, default 20)
 * - offset: Pagination offset (default 0)
 * - severity: Comma-separated list of severities (e.g., "HIGH,CRITICAL")
 * - type: Comma-separated list of alert types (e.g., "WHALE_TRADE,FRESH_WALLET")
 * - since: ISO timestamp for alerts created after this time
 * - read: Filter by read status (true/false)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<DashboardAlertsResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseInt(searchParams.get("limit"), 1, 100, 20);
    const offset = parseInt(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER, 0);
    const severities = parseSeverities(searchParams.get("severity"));
    const types = parseTypes(searchParams.get("type"));
    const since = parseDate(searchParams.get("since"));
    const read = parseBoolean(searchParams.get("read"));

    // Check cache
    const cacheKey = generateCacheKey(searchParams);
    const cached = cachedAlerts.get(cacheKey);
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
    const { alerts, total } = await fetchAlerts({
      severities,
      types,
      since,
      read,
      limit,
      offset,
    });

    const response: DashboardAlertsResponse = {
      alerts,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + alerts.length < total,
      },
      filters: {
        severity: severities,
        type: types,
        since: since?.toISOString() ?? null,
        read,
      },
      generatedAt: new Date().toISOString(),
    };

    // Update cache
    cachedAlerts.set(cacheKey, { data: response, timestamp: now });
    cleanupCache();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard alerts:", error);

    return NextResponse.json(
      { error: "Failed to fetch dashboard alerts" },
      { status: 500 }
    );
  }
}
