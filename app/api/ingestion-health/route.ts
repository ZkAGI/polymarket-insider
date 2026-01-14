/**
 * Ingestion Health API Endpoint (INGEST-HEALTH-001)
 *
 * Exposes ingestion worker health status and sync statistics.
 *
 * GET /api/ingestion-health - Get full ingestion health status
 * GET /api/ingestion-health?simple=true - Simple status check (200/503)
 * GET /api/ingestion-health?stats=true - Include sync statistics
 * GET /api/ingestion-health?logs=true&limit=10 - Include recent sync logs
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getIngestionHealthService,
  type IngestionHealthStatus,
} from "@/services/ingestion-health";

// ============================================================================
// Types
// ============================================================================

/**
 * Simple health response
 */
interface SimpleHealthResponse {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
}

/**
 * Full health response
 */
interface FullHealthResponse {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  timestamp: string;
  isStalled: boolean;
  isMarketSyncStalled: boolean;
  isTradeIngestStalled: boolean;
  lastMarketSyncAt: string | null;
  lastTradeIngestAt: string | null;
  lastUpdatedAt: string | null;
  stall: {
    marketSyncStalledForMs: number | null;
    tradeIngestStalledForMs: number | null;
    stalledSince: string | null;
  };
  totals: {
    cyclesCompleted: number;
    cyclesFailed: number;
    marketsSynced: number;
    tradesIngested: number;
    walletsCreated: number;
  };
  lastError: string | null;
  runtime: {
    isRunning: boolean;
    isIngesting: boolean;
    uptimeSeconds: number;
    consecutiveErrors: number;
  } | null;
  stats?: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    avgDurationMs: number | null;
    lastHourSyncs: number;
    last24HourSyncs: number;
  };
  recentLogs?: Array<{
    id: string;
    syncType: string;
    status: string;
    recordsProcessed: number;
    errorCount: number;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Type aliases for better readability
type SyncStatsResult = Awaited<ReturnType<InstanceType<typeof import("@/services/ingestion-health").IngestionHealthService>["getSyncStats"]>>;
type SyncLogsResult = Awaited<ReturnType<InstanceType<typeof import("@/services/ingestion-health").IngestionHealthService>["getRecentSyncLogs"]>>;

/**
 * Format health status for API response
 */
function formatHealthResponse(
  status: IngestionHealthStatus,
  includeStats = false,
  stats?: SyncStatsResult,
  includeLogs = false,
  logs?: SyncLogsResult
): FullHealthResponse {
  const response: FullHealthResponse = {
    status: status.status,
    timestamp: status.checkedAt.toISOString(),
    isStalled: status.isStalled,
    isMarketSyncStalled: status.isMarketSyncStalled,
    isTradeIngestStalled: status.isTradeIngestStalled,
    lastMarketSyncAt: status.persisted.lastMarketSyncAt?.toISOString() ?? null,
    lastTradeIngestAt: status.persisted.lastTradeIngestAt?.toISOString() ?? null,
    lastUpdatedAt: status.persisted.lastUpdatedAt?.toISOString() ?? null,
    stall: {
      marketSyncStalledForMs: status.stall.marketSyncStalledForMs,
      tradeIngestStalledForMs: status.stall.tradeIngestStalledForMs,
      stalledSince: status.stall.stalledSince?.toISOString() ?? null,
    },
    totals: {
      cyclesCompleted: status.persisted.cyclesCompleted,
      cyclesFailed: status.persisted.cyclesFailed,
      marketsSynced: status.persisted.marketsSynced,
      tradesIngested: status.persisted.tradesIngested,
      walletsCreated: status.persisted.walletsCreated,
    },
    lastError: status.persisted.lastError,
    runtime: status.runtime
      ? {
          isRunning: status.runtime.isRunning,
          isIngesting: status.runtime.isIngesting,
          uptimeSeconds: status.runtime.uptimeSeconds,
          consecutiveErrors: status.runtime.consecutiveErrors,
        }
      : null,
  };

  if (includeStats && stats) {
    response.stats = stats;
  }

  if (includeLogs && logs) {
    response.recentLogs = logs.map((log) => ({
      id: log.id,
      syncType: log.syncType,
      status: log.status,
      recordsProcessed: log.recordsProcessed,
      errorCount: log.errorCount,
      startedAt: log.startedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
      durationMs: log.durationMs,
    }));
  }

  return response;
}

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * GET /api/ingestion-health
 *
 * Returns ingestion health status and optionally sync statistics.
 *
 * Query parameters:
 * - simple: If "true", returns simple 200/503 response without details
 * - stats: If "true", includes sync statistics
 * - logs: If "true", includes recent sync logs
 * - limit: Number of recent logs to include (default: 10, max: 50)
 *
 * Response codes:
 * - 200: Ingestion healthy or degraded
 * - 503: Ingestion unhealthy (stalled)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SimpleHealthResponse | FullHealthResponse>> {
  const { searchParams } = new URL(request.url);
  const isSimple = searchParams.get("simple") === "true";
  const includeStats = searchParams.get("stats") === "true";
  const includeLogs = searchParams.get("logs") === "true";
  const logLimit = Math.min(
    parseInt(searchParams.get("limit") ?? "10", 10) || 10,
    50
  );

  try {
    const healthService = getIngestionHealthService();
    const status = await healthService.getHealthStatus();

    // Simple mode: just return status
    if (isSimple) {
      const httpStatus = status.status === "unhealthy" ? 503 : 200;
      return NextResponse.json(
        { status: status.status },
        { status: httpStatus }
      );
    }

    // Get additional data if requested
    const [stats, logs] = await Promise.all([
      includeStats ? healthService.getSyncStats() : undefined,
      includeLogs ? healthService.getRecentSyncLogs(logLimit) : undefined,
    ]);

    const response = formatHealthResponse(
      status,
      includeStats,
      stats,
      includeLogs,
      logs
    );

    const httpStatus = status.status === "unhealthy" ? 503 : 200;

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[IngestionHealth API] Error:", error);

    return NextResponse.json(
      {
        status: "unhealthy" as const,
        timestamp: new Date().toISOString(),
        isStalled: true,
        isMarketSyncStalled: false,
        isTradeIngestStalled: false,
        lastMarketSyncAt: null,
        lastTradeIngestAt: null,
        lastUpdatedAt: null,
        stall: {
          marketSyncStalledForMs: null,
          tradeIngestStalledForMs: null,
          stalledSince: null,
        },
        totals: {
          cyclesCompleted: 0,
          cyclesFailed: 0,
          marketsSynced: 0,
          tradesIngested: 0,
          walletsCreated: 0,
        },
        lastError: error instanceof Error ? error.message : "Unknown error",
        runtime: null,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
