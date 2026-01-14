/**
 * Health Check API Endpoint (STARTUP-002)
 *
 * Provides comprehensive health status for all application services.
 * Used for monitoring, load balancer health checks, and debugging.
 *
 * GET /api/health - Full health check
 * GET /api/health?simple=true - Simple status check (200 OK or 503 Unavailable)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, performHealthCheck } from "@/db/client";
import { startupOrchestrator } from "@/services/startup";
import { getIngestionHealthService } from "@/services/ingestion-health";
import { env } from "../../../config/env";

// Get version from package.json at build time or fallback
const VERSION = process.env.npm_package_version || "1.0.0";

// ============================================================================
// Types
// ============================================================================

/**
 * Health status for an individual service
 */
export interface ServiceHealth {
  /** Service name */
  name: string;
  /** Health status */
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  /** Optional message */
  message?: string;
  /** Last check timestamp */
  lastCheck?: string;
  /** Response time in ms (for services that support it) */
  responseTimeMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Overall health check response
 */
export interface HealthCheckResponse {
  /** Overall status */
  status: "healthy" | "degraded" | "unhealthy";
  /** Timestamp of health check */
  timestamp: string;
  /** Application version */
  version: string;
  /** Environment */
  environment: string;
  /** Uptime in seconds (approximate) */
  uptimeSeconds: number;
  /** Individual service health statuses */
  services: ServiceHealth[];
  /** Summary counts */
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    disabled: number;
    total: number;
  };
}

// Track when the server started for uptime calculation
const serverStartTime = Date.now();

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  try {
    const result = await performHealthCheck(prisma);

    if (result.healthy) {
      return {
        name: "database",
        status: "healthy",
        message: "PostgreSQL connection active",
        lastCheck: result.timestamp?.toISOString() ?? new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
      };
    } else {
      return {
        name: "database",
        status: "unhealthy",
        message: result.error ?? "Database health check failed",
        lastCheck: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
      };
    }
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database check failed",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check WebSocket connection health via trade stream service
 */
function checkWebSocketHealth(): ServiceHealth {
  try {
    const tradeStreamService = startupOrchestrator.getTradeStreamService();
    const isRunning = tradeStreamService.getIsRunning();
    const stats = tradeStreamService.getStats();

    if (!isRunning) {
      return {
        name: "websocket",
        status: "disabled",
        message: "Trade stream service not running",
        lastCheck: new Date().toISOString(),
      };
    }

    // Check if we're processing trades (indicates active connection)
    const isHealthy = stats.totalProcessed > 0 || stats.startedAt !== null;

    if (isHealthy) {
      return {
        name: "websocket",
        status: "healthy",
        message: "WebSocket connected to Polymarket",
        lastCheck: new Date().toISOString(),
        metadata: {
          totalProcessed: stats.totalProcessed,
          whaleTradesCount: stats.whaleTradesCount,
          errorCount: stats.errorCount,
        },
      };
    } else {
      return {
        name: "websocket",
        status: "degraded",
        message: "WebSocket waiting for trades",
        lastCheck: new Date().toISOString(),
        metadata: {
          startedAt: stats.startedAt?.toISOString(),
        },
      };
    }
  } catch {
    return {
      name: "websocket",
      status: "disabled",
      message: "Trade stream service unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check Telegram bot health
 */
function checkTelegramHealth(): ServiceHealth {
  try {
    const telegramBot = startupOrchestrator.getTelegramBot();
    const status = telegramBot.getStatus();

    if (!telegramBot.hasToken()) {
      return {
        name: "telegram",
        status: "disabled",
        message: "Telegram bot token not configured",
        lastCheck: new Date().toISOString(),
      };
    }

    switch (status) {
      case "running":
        return {
          name: "telegram",
          status: "healthy",
          message: "Telegram bot active and polling",
          lastCheck: new Date().toISOString(),
        };
      case "stopped":
        return {
          name: "telegram",
          status: "degraded",
          message: "Telegram bot stopped",
          lastCheck: new Date().toISOString(),
        };
      case "error":
        return {
          name: "telegram",
          status: "unhealthy",
          message: "Telegram bot in error state",
          lastCheck: new Date().toISOString(),
        };
      default:
        return {
          name: "telegram",
          status: "degraded",
          message: `Telegram bot status: ${status}`,
          lastCheck: new Date().toISOString(),
        };
    }
  } catch {
    return {
      name: "telegram",
      status: "disabled",
      message: "Telegram bot unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check market sync service health
 */
function checkMarketSyncHealth(): ServiceHealth {
  try {
    const marketSyncService = startupOrchestrator.getMarketSyncService();
    const isRunning = marketSyncService.getIsRunning();
    const lastSyncStats = marketSyncService.getLastSyncStats();

    if (!isRunning) {
      return {
        name: "marketSync",
        status: "disabled",
        message: "Market sync service not running",
        lastCheck: new Date().toISOString(),
      };
    }

    // Check if there was a recent sync (within last 10 minutes)
    const lastSyncAt = lastSyncStats?.syncedAt;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    if (lastSyncAt && new Date(lastSyncAt) > tenMinutesAgo) {
      return {
        name: "marketSync",
        status: "healthy",
        message: "Market sync running normally",
        lastCheck: new Date().toISOString(),
        metadata: {
          lastSyncAt: lastSyncAt,
          totalSynced: lastSyncStats?.totalSynced,
          newMarkets: lastSyncStats?.newMarkets,
        },
      };
    } else {
      return {
        name: "marketSync",
        status: "degraded",
        message: lastSyncAt ? "Last sync was more than 10 minutes ago" : "No sync has completed yet",
        lastCheck: new Date().toISOString(),
        metadata: {
          lastSyncAt: lastSyncAt ?? null,
          totalSynced: lastSyncStats?.totalSynced ?? 0,
        },
      };
    }
  } catch {
    return {
      name: "marketSync",
      status: "disabled",
      message: "Market sync service unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check wallet profiler service health
 */
function checkWalletProfilerHealth(): ServiceHealth {
  try {
    const walletProfilerService = startupOrchestrator.getWalletProfilerService();
    const isRunning = walletProfilerService.getIsRunning();
    const stats = walletProfilerService.getStats();

    if (!isRunning) {
      return {
        name: "walletProfiler",
        status: "disabled",
        message: "Wallet profiler service not running",
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      name: "walletProfiler",
      status: "healthy",
      message: "Wallet profiler running normally",
      lastCheck: new Date().toISOString(),
      metadata: {
        totalProfiled: stats.totalProfiled,
        newWalletsProfiled: stats.newWalletsProfiled,
        highSuspicionCount: stats.highSuspicionCount,
      },
    };
  } catch {
    return {
      name: "walletProfiler",
      status: "disabled",
      message: "Wallet profiler service unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check alert generator service health
 */
function checkAlertGeneratorHealth(): ServiceHealth {
  try {
    const alertGeneratorService = startupOrchestrator.getAlertGeneratorService();
    const isRunning = alertGeneratorService.getIsRunning();
    const stats = alertGeneratorService.getStats();

    if (!isRunning) {
      return {
        name: "alertGenerator",
        status: "disabled",
        message: "Alert generator service not running",
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      name: "alertGenerator",
      status: "healthy",
      message: "Alert generator running normally",
      lastCheck: new Date().toISOString(),
      metadata: {
        totalGenerated: stats.totalGenerated,
        broadcastCount: stats.broadcastCount,
        suppressedCount: stats.suppressedCount,
      },
    };
  } catch {
    return {
      name: "alertGenerator",
      status: "disabled",
      message: "Alert generator service unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check ingestion worker health
 */
async function checkIngestionHealth(): Promise<ServiceHealth> {
  try {
    const healthService = getIngestionHealthService();
    const status = await healthService.getHealthStatus();

    if (status.status === "unknown") {
      return {
        name: "ingestion",
        status: "disabled",
        message: "Ingestion worker not yet started",
        lastCheck: new Date().toISOString(),
      };
    }

    if (status.isStalled) {
      const stallMessages: string[] = [];
      if (status.isMarketSyncStalled) {
        const mins = Math.round((status.stall.marketSyncStalledForMs ?? 0) / 60000);
        stallMessages.push(`Market sync stalled for ${mins}m`);
      }
      if (status.isTradeIngestStalled) {
        const mins = Math.round((status.stall.tradeIngestStalledForMs ?? 0) / 60000);
        stallMessages.push(`Trade ingestion stalled for ${mins}m`);
      }
      return {
        name: "ingestion",
        status: "unhealthy",
        message: stallMessages.join(", ") || "Ingestion stalled",
        lastCheck: new Date().toISOString(),
        metadata: {
          lastMarketSyncAt: status.persisted.lastMarketSyncAt?.toISOString(),
          lastTradeIngestAt: status.persisted.lastTradeIngestAt?.toISOString(),
          cyclesCompleted: status.persisted.cyclesCompleted,
          cyclesFailed: status.persisted.cyclesFailed,
        },
      };
    }

    if (status.status === "degraded") {
      return {
        name: "ingestion",
        status: "degraded",
        message: status.persisted.lastError ?? "Some ingestion errors",
        lastCheck: new Date().toISOString(),
        metadata: {
          lastMarketSyncAt: status.persisted.lastMarketSyncAt?.toISOString(),
          lastTradeIngestAt: status.persisted.lastTradeIngestAt?.toISOString(),
          cyclesCompleted: status.persisted.cyclesCompleted,
          cyclesFailed: status.persisted.cyclesFailed,
        },
      };
    }

    return {
      name: "ingestion",
      status: "healthy",
      message: "Ingestion running normally",
      lastCheck: new Date().toISOString(),
      metadata: {
        lastMarketSyncAt: status.persisted.lastMarketSyncAt?.toISOString(),
        lastTradeIngestAt: status.persisted.lastTradeIngestAt?.toISOString(),
        totalMarketsSynced: status.persisted.marketsSynced,
        totalTradesIngested: status.persisted.tradesIngested,
      },
    };
  } catch {
    return {
      name: "ingestion",
      status: "disabled",
      message: "Ingestion health check unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Get orchestrator overall status
 */
function checkOrchestratorHealth(): ServiceHealth {
  try {
    const status = startupOrchestrator.getStatus();

    if (status.allRunning) {
      return {
        name: "orchestrator",
        status: "healthy",
        message: "All services running",
        lastCheck: new Date().toISOString(),
        metadata: {
          startupTimeMs: status.startupTimeMs,
          startupCompletedAt: status.startupCompletedAt?.toISOString(),
        },
      };
    } else if (status.hasErrors) {
      return {
        name: "orchestrator",
        status: "degraded",
        message: "Some services have errors",
        lastCheck: new Date().toISOString(),
        metadata: {
          errorServices: status.services
            .filter((s) => s.status === "error")
            .map((s) => s.name),
        },
      };
    } else {
      return {
        name: "orchestrator",
        status: "degraded",
        message: `Orchestrator status: ${status.status}`,
        lastCheck: new Date().toISOString(),
      };
    }
  } catch {
    return {
      name: "orchestrator",
      status: "unhealthy",
      message: "Orchestrator unavailable",
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Determine overall status from individual service statuses
 */
function calculateOverallStatus(services: ServiceHealth[]): "healthy" | "degraded" | "unhealthy" {
  // Filter out disabled services for status calculation
  const activeServices = services.filter((s) => s.status !== "disabled");

  if (activeServices.length === 0) {
    return "degraded"; // No active services is concerning
  }

  const hasUnhealthy = activeServices.some((s) => s.status === "unhealthy");
  const hasDegraded = activeServices.some((s) => s.status === "degraded");

  if (hasUnhealthy) {
    return "unhealthy";
  } else if (hasDegraded) {
    return "degraded";
  } else {
    return "healthy";
  }
}

/**
 * Calculate summary counts from service statuses
 */
function calculateSummary(
  services: ServiceHealth[]
): HealthCheckResponse["summary"] {
  return {
    healthy: services.filter((s) => s.status === "healthy").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    unhealthy: services.filter((s) => s.status === "unhealthy").length,
    disabled: services.filter((s) => s.status === "disabled").length,
    total: services.length,
  };
}

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * GET /api/health
 *
 * Returns comprehensive health status for all services.
 *
 * Query parameters:
 * - simple: If "true", returns simple 200/503 response without details
 *
 * Response codes:
 * - 200: All services healthy
 * - 503: One or more services unhealthy
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<HealthCheckResponse | { status: string }>> {
  const { searchParams } = new URL(request.url);
  const isSimple = searchParams.get("simple") === "true";

  // Gather all health checks in parallel
  const [
    databaseHealth,
    websocketHealth,
    telegramHealth,
    marketSyncHealth,
    walletProfilerHealth,
    alertGeneratorHealth,
    orchestratorHealth,
    ingestionHealth,
  ] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(checkWebSocketHealth()),
    Promise.resolve(checkTelegramHealth()),
    Promise.resolve(checkMarketSyncHealth()),
    Promise.resolve(checkWalletProfilerHealth()),
    Promise.resolve(checkAlertGeneratorHealth()),
    Promise.resolve(checkOrchestratorHealth()),
    checkIngestionHealth(),
  ]);

  const services = [
    databaseHealth,
    websocketHealth,
    telegramHealth,
    marketSyncHealth,
    walletProfilerHealth,
    alertGeneratorHealth,
    orchestratorHealth,
    ingestionHealth,
  ];

  const overallStatus = calculateOverallStatus(services);
  const summary = calculateSummary(services);
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

  // Simple mode: just return 200 or 503
  if (isSimple) {
    const httpStatus = overallStatus === "unhealthy" ? 503 : 200;
    return NextResponse.json(
      { status: overallStatus },
      { status: httpStatus }
    );
  }

  // Full response
  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: VERSION,
    environment: env.NODE_ENV,
    uptimeSeconds,
    services,
    summary,
  };

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
