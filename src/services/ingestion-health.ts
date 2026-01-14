/**
 * Ingestion Health Service (INGEST-HEALTH-001)
 *
 * Tracks and exposes ingestion health and last successful sync times.
 * Persists health data to the database and provides alerting when ingestion stalls.
 *
 * Features:
 * - Persists last successful market ingestion timestamp
 * - Persists last successful trade ingestion timestamp
 * - Exposes ingestion health via internal API
 * - Generates SYSTEM alerts if ingestion stalls beyond threshold
 */

import { EventEmitter } from "events";
import { PrismaClient, AlertType, AlertSeverity, SyncStatus, Prisma } from "@prisma/client";
import { createPrismaClient } from "../db/client";
import type { IngestionHealth } from "../workers/ingestion-worker";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the ingestion health service
 */
export interface IngestionHealthServiceConfig {
  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Market sync stall threshold in milliseconds (default: 15 minutes) */
  marketStallThresholdMs?: number;

  /** Trade ingestion stall threshold in milliseconds (default: 5 minutes) */
  tradeStallThresholdMs?: number;

  /** Health check interval in milliseconds (default: 60 seconds) */
  healthCheckIntervalMs?: number;

  /** Whether to generate alerts on stall detection (default: true) */
  enableAlerts?: boolean;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Persisted health record structure
 */
export interface PersistedHealth {
  /** Worker ID that last updated health */
  workerId: string | null;

  /** Last successful market sync timestamp */
  lastMarketSyncAt: Date | null;

  /** Last successful trade ingestion timestamp */
  lastTradeIngestAt: Date | null;

  /** Last health update timestamp */
  lastUpdatedAt: Date | null;

  /** Total cycles completed */
  cyclesCompleted: number;

  /** Total cycles failed */
  cyclesFailed: number;

  /** Total markets synced */
  marketsSynced: number;

  /** Total trades ingested */
  tradesIngested: number;

  /** Total wallets created */
  walletsCreated: number;

  /** Last error message */
  lastError: string | null;
}

/**
 * Full health status combining persisted and runtime data
 */
export interface IngestionHealthStatus {
  /** Overall health status */
  status: "healthy" | "degraded" | "unhealthy" | "unknown";

  /** Whether ingestion is currently stalled */
  isStalled: boolean;

  /** Whether market sync is stalled */
  isMarketSyncStalled: boolean;

  /** Whether trade ingestion is stalled */
  isTradeIngestStalled: boolean;

  /** Persisted health data */
  persisted: PersistedHealth;

  /** Runtime health from worker (if available) */
  runtime: IngestionHealth | null;

  /** Stall details */
  stall: {
    marketSyncStalledForMs: number | null;
    tradeIngestStalledForMs: number | null;
    stalledSince: Date | null;
  };

  /** Last check timestamp */
  checkedAt: Date;
}

/**
 * Config key for storing ingestion health in SystemConfig
 */
const INGESTION_HEALTH_CONFIG_KEY = "ingestion_health";

// ============================================================================
// IngestionHealthService Class
// ============================================================================

/**
 * Service for tracking and exposing ingestion health
 */
export class IngestionHealthService extends EventEmitter {
  private readonly config: Required<
    Pick<
      IngestionHealthServiceConfig,
      | "marketStallThresholdMs"
      | "tradeStallThresholdMs"
      | "healthCheckIntervalMs"
      | "enableAlerts"
      | "debug"
    >
  >;
  private readonly prisma: PrismaClient;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastAlertedAt: Date | null = null;
  private lastStallDetectedAt: Date | null = null;

  // Cache for runtime health from worker
  private runtimeHealth: IngestionHealth | null = null;

  constructor(config: IngestionHealthServiceConfig = {}) {
    super();

    this.config = {
      marketStallThresholdMs: config.marketStallThresholdMs ?? 15 * 60 * 1000, // 15 minutes
      tradeStallThresholdMs: config.tradeStallThresholdMs ?? 5 * 60 * 1000, // 5 minutes
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 60 * 1000, // 1 minute
      enableAlerts: config.enableAlerts ?? true,
      debug: config.debug ?? false,
    };

    this.prisma = config.prisma ?? createPrismaClient();
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [IngestionHealthService]`;
    if (data && this.config.debug) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Start the health monitoring service
   */
  start(): void {
    if (this.isRunning) {
      this.logger("Health service already running");
      return;
    }

    this.isRunning = true;
    this.logger("Starting ingestion health service", {
      marketStallThresholdMs: this.config.marketStallThresholdMs,
      tradeStallThresholdMs: this.config.tradeStallThresholdMs,
      healthCheckIntervalMs: this.config.healthCheckIntervalMs,
    });

    // Run initial health check
    this.checkHealth().catch((error) => {
      this.logger("Initial health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Start periodic health checks
    this.checkInterval = setInterval(() => {
      this.checkHealth().catch((error) => {
        this.logger("Health check failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.healthCheckIntervalMs);

    this.emit("started");
  }

  /**
   * Stop the health monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger("Health service not running");
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    this.logger("Ingestion health service stopped");
    this.emit("stopped");
  }

  /**
   * Update runtime health from ingestion worker
   */
  updateRuntimeHealth(health: IngestionHealth): void {
    this.runtimeHealth = health;
  }

  /**
   * Persist health data to database
   */
  async persistHealth(health: Partial<PersistedHealth>): Promise<void> {
    try {
      const existing = await this.getPersistedHealth();

      const updatedHealth: PersistedHealth = {
        workerId: health.workerId ?? existing.workerId,
        lastMarketSyncAt: health.lastMarketSyncAt ?? existing.lastMarketSyncAt,
        lastTradeIngestAt: health.lastTradeIngestAt ?? existing.lastTradeIngestAt,
        lastUpdatedAt: new Date(),
        cyclesCompleted: health.cyclesCompleted ?? existing.cyclesCompleted,
        cyclesFailed: health.cyclesFailed ?? existing.cyclesFailed,
        marketsSynced: health.marketsSynced ?? existing.marketsSynced,
        tradesIngested: health.tradesIngested ?? existing.tradesIngested,
        walletsCreated: health.walletsCreated ?? existing.walletsCreated,
        lastError: health.lastError ?? existing.lastError,
      };

      // Convert health data to JSON-safe format for Prisma
      const jsonValue: Prisma.InputJsonValue = {
        workerId: updatedHealth.workerId,
        lastMarketSyncAt: updatedHealth.lastMarketSyncAt?.toISOString() ?? null,
        lastTradeIngestAt: updatedHealth.lastTradeIngestAt?.toISOString() ?? null,
        lastUpdatedAt: updatedHealth.lastUpdatedAt?.toISOString() ?? null,
        cyclesCompleted: updatedHealth.cyclesCompleted,
        cyclesFailed: updatedHealth.cyclesFailed,
        marketsSynced: updatedHealth.marketsSynced,
        tradesIngested: updatedHealth.tradesIngested,
        walletsCreated: updatedHealth.walletsCreated,
        lastError: updatedHealth.lastError,
      };

      await this.prisma.systemConfig.upsert({
        where: { key: INGESTION_HEALTH_CONFIG_KEY },
        create: {
          key: INGESTION_HEALTH_CONFIG_KEY,
          value: jsonValue,
          description: "Ingestion worker health tracking data",
        },
        update: {
          value: jsonValue,
        },
      });

      if (this.config.debug) {
        this.logger("Persisted health data", updatedHealth as unknown as Record<string, unknown>);
      }
    } catch (error) {
      this.logger("Failed to persist health", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get persisted health data from database
   */
  async getPersistedHealth(): Promise<PersistedHealth> {
    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: INGESTION_HEALTH_CONFIG_KEY },
      });

      if (config?.value && typeof config.value === "object") {
        const value = config.value as Record<string, unknown>;
        return {
          workerId: (value.workerId as string) ?? null,
          lastMarketSyncAt: value.lastMarketSyncAt
            ? new Date(value.lastMarketSyncAt as string)
            : null,
          lastTradeIngestAt: value.lastTradeIngestAt
            ? new Date(value.lastTradeIngestAt as string)
            : null,
          lastUpdatedAt: value.lastUpdatedAt
            ? new Date(value.lastUpdatedAt as string)
            : null,
          cyclesCompleted: (value.cyclesCompleted as number) ?? 0,
          cyclesFailed: (value.cyclesFailed as number) ?? 0,
          marketsSynced: (value.marketsSynced as number) ?? 0,
          tradesIngested: (value.tradesIngested as number) ?? 0,
          walletsCreated: (value.walletsCreated as number) ?? 0,
          lastError: (value.lastError as string) ?? null,
        };
      }

      return this.getDefaultPersistedHealth();
    } catch (error) {
      this.logger("Failed to get persisted health", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultPersistedHealth();
    }
  }

  /**
   * Get default persisted health values
   */
  private getDefaultPersistedHealth(): PersistedHealth {
    return {
      workerId: null,
      lastMarketSyncAt: null,
      lastTradeIngestAt: null,
      lastUpdatedAt: null,
      cyclesCompleted: 0,
      cyclesFailed: 0,
      marketsSynced: 0,
      tradesIngested: 0,
      walletsCreated: 0,
      lastError: null,
    };
  }

  /**
   * Get full health status
   */
  async getHealthStatus(): Promise<IngestionHealthStatus> {
    const persisted = await this.getPersistedHealth();
    const now = new Date();

    // Calculate stall durations
    let marketSyncStalledForMs: number | null = null;
    let tradeIngestStalledForMs: number | null = null;

    if (persisted.lastMarketSyncAt) {
      marketSyncStalledForMs = now.getTime() - persisted.lastMarketSyncAt.getTime();
    }

    if (persisted.lastTradeIngestAt) {
      tradeIngestStalledForMs = now.getTime() - persisted.lastTradeIngestAt.getTime();
    }

    // Determine if stalled
    const isMarketSyncStalled =
      marketSyncStalledForMs !== null &&
      marketSyncStalledForMs > this.config.marketStallThresholdMs;

    const isTradeIngestStalled =
      tradeIngestStalledForMs !== null &&
      tradeIngestStalledForMs > this.config.tradeStallThresholdMs;

    const isStalled = isMarketSyncStalled || isTradeIngestStalled;

    // Determine overall status
    let status: IngestionHealthStatus["status"] = "unknown";

    if (!persisted.lastMarketSyncAt && !persisted.lastTradeIngestAt) {
      status = "unknown"; // No data yet
    } else if (isStalled) {
      status = "unhealthy";
    } else if (persisted.cyclesFailed > 0 && persisted.lastError) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    // Calculate stalled since
    let stalledSince: Date | null = null;
    if (isStalled) {
      // The stall started after the threshold was exceeded
      if (isMarketSyncStalled && persisted.lastMarketSyncAt) {
        const marketStallStart = new Date(
          persisted.lastMarketSyncAt.getTime() + this.config.marketStallThresholdMs
        );
        stalledSince = marketStallStart;
      }
      if (isTradeIngestStalled && persisted.lastTradeIngestAt) {
        const tradeStallStart = new Date(
          persisted.lastTradeIngestAt.getTime() + this.config.tradeStallThresholdMs
        );
        if (!stalledSince || tradeStallStart < stalledSince) {
          stalledSince = tradeStallStart;
        }
      }
    }

    return {
      status,
      isStalled,
      isMarketSyncStalled,
      isTradeIngestStalled,
      persisted,
      runtime: this.runtimeHealth,
      stall: {
        marketSyncStalledForMs,
        tradeIngestStalledForMs,
        stalledSince,
      },
      checkedAt: now,
    };
  }

  /**
   * Check health and generate alerts if stalled
   */
  async checkHealth(): Promise<IngestionHealthStatus> {
    const status = await this.getHealthStatus();

    if (status.isStalled && this.config.enableAlerts) {
      await this.handleStallDetected(status);
    } else if (!status.isStalled && this.lastStallDetectedAt) {
      // Stall recovered
      this.lastStallDetectedAt = null;
      this.emit("stall:recovered", status);
      this.logger("Ingestion stall recovered", {
        status: status.status,
      });
    }

    this.emit("health:checked", status);
    return status;
  }

  /**
   * Handle stall detection
   */
  private async handleStallDetected(status: IngestionHealthStatus): Promise<void> {
    const now = new Date();

    // Only alert once per stall period (wait 5 minutes between alerts)
    const shouldAlert =
      !this.lastAlertedAt ||
      now.getTime() - this.lastAlertedAt.getTime() > 5 * 60 * 1000;

    if (!this.lastStallDetectedAt) {
      this.lastStallDetectedAt = now;
    }

    this.emit("stall:detected", status);

    if (shouldAlert) {
      this.logger("Ingestion stall detected", {
        isMarketSyncStalled: status.isMarketSyncStalled,
        isTradeIngestStalled: status.isTradeIngestStalled,
        marketSyncStalledForMs: status.stall.marketSyncStalledForMs,
        tradeIngestStalledForMs: status.stall.tradeIngestStalledForMs,
      });

      await this.createStallAlert(status);
      this.lastAlertedAt = now;
    }
  }

  /**
   * Create a stall alert in the database
   */
  private async createStallAlert(status: IngestionHealthStatus): Promise<void> {
    try {
      const stallDetails: string[] = [];

      if (status.isMarketSyncStalled && status.stall.marketSyncStalledForMs) {
        const minutes = Math.round(status.stall.marketSyncStalledForMs / 60000);
        stallDetails.push(`Market sync stalled for ${minutes} minutes`);
      }

      if (status.isTradeIngestStalled && status.stall.tradeIngestStalledForMs) {
        const minutes = Math.round(status.stall.tradeIngestStalledForMs / 60000);
        stallDetails.push(`Trade ingestion stalled for ${minutes} minutes`);
      }

      const message = stallDetails.join(". ");

      await this.prisma.alert.create({
        data: {
          type: AlertType.SYSTEM,
          severity: AlertSeverity.HIGH,
          title: "Ingestion Worker Stalled",
          message: message || "Ingestion worker has not reported successful sync recently",
          data: {
            status: status.status,
            isMarketSyncStalled: status.isMarketSyncStalled,
            isTradeIngestStalled: status.isTradeIngestStalled,
            marketSyncStalledForMs: status.stall.marketSyncStalledForMs,
            tradeIngestStalledForMs: status.stall.tradeIngestStalledForMs,
            lastMarketSyncAt: status.persisted.lastMarketSyncAt?.toISOString(),
            lastTradeIngestAt: status.persisted.lastTradeIngestAt?.toISOString(),
            lastError: status.persisted.lastError,
          },
          tags: ["ingestion", "stall", "system"],
        },
      });

      this.logger("Created stall alert");
    } catch (error) {
      this.logger("Failed to create stall alert", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the last successful sync log from database
   */
  async getLastSuccessfulSync(): Promise<{
    marketSync: Date | null;
    tradeSync: Date | null;
    lastSync: Date | null;
  }> {
    try {
      // Get the most recent successful ingestion sync
      const lastSync = await this.prisma.syncLog.findFirst({
        where: {
          syncType: "INGESTION",
          status: SyncStatus.COMPLETED,
        },
        orderBy: {
          completedAt: "desc",
        },
      });

      // Also check persisted health for more granular timestamps
      const persisted = await this.getPersistedHealth();

      return {
        marketSync: persisted.lastMarketSyncAt,
        tradeSync: persisted.lastTradeIngestAt,
        lastSync: lastSync?.completedAt ?? null,
      };
    } catch (error) {
      this.logger("Failed to get last successful sync", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        marketSync: null,
        tradeSync: null,
        lastSync: null,
      };
    }
  }

  /**
   * Get recent sync logs
   */
  async getRecentSyncLogs(limit = 10): Promise<
    Array<{
      id: string;
      syncType: string;
      status: SyncStatus;
      recordsProcessed: number;
      errorCount: number;
      startedAt: Date;
      completedAt: Date | null;
      durationMs: number | null;
    }>
  > {
    try {
      const logs = await this.prisma.syncLog.findMany({
        where: {
          syncType: "INGESTION",
        },
        orderBy: {
          startedAt: "desc",
        },
        take: limit,
        select: {
          id: true,
          syncType: true,
          status: true,
          recordsProcessed: true,
          errorCount: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
        },
      });

      return logs;
    } catch (error) {
      this.logger("Failed to get recent sync logs", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    avgDurationMs: number | null;
    lastHourSyncs: number;
    last24HourSyncs: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [total, successful, failed, lastHour, lastDay, avgDuration] = await Promise.all([
        this.prisma.syncLog.count({ where: { syncType: "INGESTION" } }),
        this.prisma.syncLog.count({
          where: { syncType: "INGESTION", status: SyncStatus.COMPLETED },
        }),
        this.prisma.syncLog.count({
          where: { syncType: "INGESTION", status: SyncStatus.FAILED },
        }),
        this.prisma.syncLog.count({
          where: { syncType: "INGESTION", startedAt: { gte: oneHourAgo } },
        }),
        this.prisma.syncLog.count({
          where: { syncType: "INGESTION", startedAt: { gte: oneDayAgo } },
        }),
        this.prisma.syncLog.aggregate({
          where: { syncType: "INGESTION", status: SyncStatus.COMPLETED },
          _avg: { durationMs: true },
        }),
      ]);

      return {
        totalSyncs: total,
        successfulSyncs: successful,
        failedSyncs: failed,
        successRate: total > 0 ? (successful / total) * 100 : 0,
        avgDurationMs: avgDuration._avg.durationMs,
        lastHourSyncs: lastHour,
        last24HourSyncs: lastDay,
      };
    } catch (error) {
      this.logger("Failed to get sync stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        successRate: 0,
        avgDurationMs: null,
        lastHourSyncs: 0,
        last24HourSyncs: 0,
      };
    }
  }

  /**
   * Check if the service is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current runtime health (cached from worker)
   */
  getRuntimeHealth(): IngestionHealth | null {
    return this.runtimeHealth;
  }
}

// ============================================================================
// Singleton and Factory
// ============================================================================

/**
 * Default ingestion health service instance
 */
let ingestionHealthService: IngestionHealthService | null = null;

/**
 * Get or create the shared ingestion health service instance
 */
export function getIngestionHealthService(
  config?: IngestionHealthServiceConfig
): IngestionHealthService {
  if (!ingestionHealthService) {
    ingestionHealthService = new IngestionHealthService(config);
  }
  return ingestionHealthService;
}

/**
 * Create a new ingestion health service instance
 */
export function createIngestionHealthService(
  config?: IngestionHealthServiceConfig
): IngestionHealthService {
  return new IngestionHealthService(config);
}

/**
 * Reset the shared instance (for testing)
 */
export function resetIngestionHealthService(): void {
  if (ingestionHealthService?.getIsRunning()) {
    ingestionHealthService.stop();
  }
  ingestionHealthService = null;
}
