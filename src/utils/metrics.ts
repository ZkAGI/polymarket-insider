/**
 * Application Metrics Collector (MONITOR-002)
 *
 * Collects and exposes application metrics for monitoring.
 * Supports both JSON and Prometheus exposition formats.
 *
 * Tracked Metrics:
 * - trades_processed_total: Total trades processed by trade stream
 * - alerts_generated_total: Total alerts generated
 * - wallets_profiled_total: Total wallets profiled
 * - markets_synced_total: Total markets synced
 * - websocket_messages_total: WebSocket messages received
 * - api_requests_total: API requests by endpoint and status
 * - api_request_duration_ms: API request duration histogram
 * - active_websocket_subscriptions: Current WebSocket subscriptions
 *
 * Usage:
 *   import { metrics, recordApiRequest } from '@/utils/metrics';
 *
 *   // Record an API request
 *   recordApiRequest('/api/dashboard/stats', 'GET', 200, 45);
 *
 *   // Get metrics JSON
 *   const data = metrics.getMetrics();
 *
 *   // Get Prometheus format
 *   const prom = metrics.toPrometheus();
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Counter metric - monotonically increasing value
 */
export interface CounterMetric {
  type: "counter";
  value: number;
  help: string;
  labels?: Record<string, string>;
}

/**
 * Gauge metric - value that can go up or down
 */
export interface GaugeMetric {
  type: "gauge";
  value: number;
  help: string;
  labels?: Record<string, string>;
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  le: number;
  count: number;
}

/**
 * Histogram metric - distribution of values
 */
export interface HistogramMetric {
  type: "histogram";
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  help: string;
  labels?: Record<string, string>;
}

/**
 * API request metrics by endpoint
 */
export interface ApiEndpointMetrics {
  requests: number;
  errors: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
}

/**
 * All collected metrics
 */
export interface ApplicationMetrics {
  // Trade Stream Metrics
  tradesProcessedTotal: number;
  tradesStoredTotal: number;
  tradesErrorTotal: number;
  whaleTradesTotal: number;
  newWalletsFromTradesTotal: number;
  tradesPerSecond: number;

  // Alert Metrics
  alertsGeneratedTotal: number;
  alertsBroadcastTotal: number;
  alertsSuppressedTotal: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;

  // Wallet Profiler Metrics
  walletsProfiledTotal: number;
  newWalletsProfiledTotal: number;
  highSuspicionWalletsTotal: number;
  freshWalletsTotal: number;
  walletCacheHits: number;
  walletCacheMisses: number;

  // Market Sync Metrics
  marketsSyncedTotal: number;
  newMarketsTotal: number;
  marketSyncDurationMs: number;
  lastSyncAt: string | null;

  // WebSocket Metrics
  websocketMessagesTotal: number;
  websocketReconnectsTotal: number;
  activeSubscriptions: number;

  // API Metrics
  apiRequestsTotal: number;
  apiErrorsTotal: number;
  apiRequestsByEndpoint: Record<string, ApiEndpointMetrics>;

  // System Metrics
  uptimeSeconds: number;
  memoryUsageMb: number;
  heapUsedMb: number;
  heapTotalMb: number;

  // Timestamps
  collectedAt: string;
  startedAt: string;
}

/**
 * Metrics output format
 */
export type MetricsFormat = "json" | "prometheus";

// ============================================================================
// Internal State
// ============================================================================

/** When the metrics collector started */
const startedAt = new Date();

/** WebSocket message counter (tracked separately as no service reference) */
let websocketMessagesTotal = 0;

/** WebSocket reconnection counter */
let websocketReconnectsTotal = 0;

/** Active subscriptions count */
let activeSubscriptions = 0;

/** API metrics by endpoint */
const apiMetricsByEndpoint: Map<string, ApiEndpointMetrics> = new Map();

/** Total API requests */
let apiRequestsTotal = 0;

/** Total API errors */
let apiErrorsTotal = 0;

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Record an API request
 */
export function recordApiRequest(
  endpoint: string,
  _method: string,
  statusCode: number,
  durationMs: number
): void {
  apiRequestsTotal++;

  const isError = statusCode >= 400;
  if (isError) {
    apiErrorsTotal++;
  }

  // Get or create endpoint metrics
  let metrics = apiMetricsByEndpoint.get(endpoint);
  if (!metrics) {
    metrics = {
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      avgDurationMs: 0,
    };
    apiMetricsByEndpoint.set(endpoint, metrics);
  }

  // Update metrics
  metrics.requests++;
  if (isError) {
    metrics.errors++;
  }
  metrics.totalDurationMs += durationMs;
  metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
  metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
  metrics.avgDurationMs = metrics.totalDurationMs / metrics.requests;
}

/**
 * Record a WebSocket message received
 */
export function recordWebSocketMessage(): void {
  websocketMessagesTotal++;
}

/**
 * Record a WebSocket reconnection
 */
export function recordWebSocketReconnect(): void {
  websocketReconnectsTotal++;
}

/**
 * Update active subscriptions count
 */
export function setActiveSubscriptions(count: number): void {
  activeSubscriptions = count;
}

/**
 * Increment active subscriptions
 */
export function incrementSubscriptions(): void {
  activeSubscriptions++;
}

/**
 * Decrement active subscriptions
 */
export function decrementSubscriptions(): void {
  if (activeSubscriptions > 0) {
    activeSubscriptions--;
  }
}

// ============================================================================
// Metrics Collector Class
// ============================================================================

/**
 * Interface for the startup orchestrator to allow dependency injection
 */
export interface StartupOrchestratorInterface {
  getTradeStreamService(): {
    getStats(): {
      totalProcessed: number;
      storedCount: number;
      errorCount: number;
      whaleTradesCount: number;
      newWalletsCount: number;
      tradesPerSecond: number;
    };
  };
  getAlertGeneratorService(): {
    getStats(): {
      totalGenerated: number;
      broadcastCount: number;
      suppressedCount: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
    };
  };
  getWalletProfilerService(): {
    getStats(): {
      totalProfiled: number;
      newWalletsProfiled: number;
      highSuspicionCount: number;
      freshWalletsCount: number;
      cacheHits: number;
      cacheMisses: number;
    };
  };
  getMarketSyncService(): {
    getLastSyncStats(): {
      totalSynced: number;
      newMarkets: number;
      durationMs: number;
      syncedAt: string;
    } | null;
  };
}

/** Global reference to startup orchestrator (set during app initialization) */
let _startupOrchestrator: StartupOrchestratorInterface | null = null;

/**
 * Set the startup orchestrator reference for metrics collection
 */
export function setStartupOrchestrator(orchestrator: StartupOrchestratorInterface): void {
  _startupOrchestrator = orchestrator;
}

/**
 * Get the startup orchestrator, lazily loading if not set
 */
function getStartupOrchestrator(): StartupOrchestratorInterface | null {
  if (_startupOrchestrator) {
    return _startupOrchestrator;
  }

  // Try to dynamically import - this will work in the actual app environment
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startupOrchestrator } = require("../services/startup");
    _startupOrchestrator = startupOrchestrator;
    return _startupOrchestrator;
  } catch {
    // Services not available
    return null;
  }
}

/**
 * Metrics collector that aggregates metrics from all services
 */
export class MetricsCollector {
  /**
   * Get all collected metrics
   */
  getMetrics(): ApplicationMetrics {
    const orchestrator = getStartupOrchestrator();

    // Get service stats safely
    let tradeStreamStats = {
      totalProcessed: 0,
      storedCount: 0,
      errorCount: 0,
      whaleTradesCount: 0,
      newWalletsCount: 0,
      tradesPerSecond: 0,
    };

    let alertStats = {
      totalGenerated: 0,
      broadcastCount: 0,
      suppressedCount: 0,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    let walletStats = {
      totalProfiled: 0,
      newWalletsProfiled: 0,
      highSuspicionCount: 0,
      freshWalletsCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    let marketSyncStats = {
      totalSynced: 0,
      newMarkets: 0,
      durationMs: 0,
      syncedAt: null as string | null,
    };

    if (orchestrator) {
      try {
        const tradeStream = orchestrator.getTradeStreamService();
        const stats = tradeStream.getStats();
        tradeStreamStats = {
          totalProcessed: stats.totalProcessed,
          storedCount: stats.storedCount,
          errorCount: stats.errorCount,
          whaleTradesCount: stats.whaleTradesCount,
          newWalletsCount: stats.newWalletsCount,
          tradesPerSecond: stats.tradesPerSecond,
        };
      } catch {
        // Service not available
      }

      try {
        const alertGenerator = orchestrator.getAlertGeneratorService();
        const stats = alertGenerator.getStats();
        alertStats = {
          totalGenerated: stats.totalGenerated,
          broadcastCount: stats.broadcastCount,
          suppressedCount: stats.suppressedCount,
          byType: stats.byType,
          bySeverity: stats.bySeverity,
        };
      } catch {
        // Service not available
      }

      try {
        const walletProfiler = orchestrator.getWalletProfilerService();
        const stats = walletProfiler.getStats();
        walletStats = {
          totalProfiled: stats.totalProfiled,
          newWalletsProfiled: stats.newWalletsProfiled,
          highSuspicionCount: stats.highSuspicionCount,
          freshWalletsCount: stats.freshWalletsCount,
          cacheHits: stats.cacheHits,
          cacheMisses: stats.cacheMisses,
        };
      } catch {
        // Service not available
      }
      try {
        const marketSync = orchestrator.getMarketSyncService();
        const stats = marketSync.getLastSyncStats();
        if (stats) {
          marketSyncStats = {
            totalSynced: stats.totalSynced,
            newMarkets: stats.newMarkets,
            durationMs: stats.durationMs,
            syncedAt: stats.syncedAt,
          };
        }
      } catch {
        // Service not available
      }
    }

    // Get memory usage
    const memUsage = process.memoryUsage();

    // Calculate uptime
    const uptimeMs = Date.now() - startedAt.getTime();

    // Build API metrics by endpoint
    const apiRequestsByEndpoint: Record<string, ApiEndpointMetrics> = {};
    apiMetricsByEndpoint.forEach((metrics, endpoint) => {
      apiRequestsByEndpoint[endpoint] = {
        ...metrics,
        // Fix Infinity for min if no requests
        minDurationMs: metrics.minDurationMs === Infinity ? 0 : metrics.minDurationMs,
      };
    });

    return {
      // Trade Stream Metrics
      tradesProcessedTotal: tradeStreamStats.totalProcessed,
      tradesStoredTotal: tradeStreamStats.storedCount,
      tradesErrorTotal: tradeStreamStats.errorCount,
      whaleTradesTotal: tradeStreamStats.whaleTradesCount,
      newWalletsFromTradesTotal: tradeStreamStats.newWalletsCount,
      tradesPerSecond: tradeStreamStats.tradesPerSecond,

      // Alert Metrics
      alertsGeneratedTotal: alertStats.totalGenerated,
      alertsBroadcastTotal: alertStats.broadcastCount,
      alertsSuppressedTotal: alertStats.suppressedCount,
      alertsByType: alertStats.byType,
      alertsBySeverity: alertStats.bySeverity,

      // Wallet Profiler Metrics
      walletsProfiledTotal: walletStats.totalProfiled,
      newWalletsProfiledTotal: walletStats.newWalletsProfiled,
      highSuspicionWalletsTotal: walletStats.highSuspicionCount,
      freshWalletsTotal: walletStats.freshWalletsCount,
      walletCacheHits: walletStats.cacheHits,
      walletCacheMisses: walletStats.cacheMisses,

      // Market Sync Metrics
      marketsSyncedTotal: marketSyncStats.totalSynced,
      newMarketsTotal: marketSyncStats.newMarkets,
      marketSyncDurationMs: marketSyncStats.durationMs,
      lastSyncAt: marketSyncStats.syncedAt,

      // WebSocket Metrics
      websocketMessagesTotal,
      websocketReconnectsTotal,
      activeSubscriptions,

      // API Metrics
      apiRequestsTotal,
      apiErrorsTotal,
      apiRequestsByEndpoint,

      // System Metrics
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      memoryUsageMb: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,

      // Timestamps
      collectedAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
    };
  }

  /**
   * Convert metrics to Prometheus exposition format
   */
  toPrometheus(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Helper to add a metric
    const addCounter = (name: string, help: string, value: number, labels?: Record<string, string>) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} counter`);
      const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}` : "";
      lines.push(`${name}${labelStr} ${value}`);
    };

    const addGauge = (name: string, help: string, value: number, labels?: Record<string, string>) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} gauge`);
      const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}` : "";
      lines.push(`${name}${labelStr} ${value}`);
    };

    // Trade Stream Metrics
    addCounter("polymarket_trades_processed_total", "Total number of trades processed", metrics.tradesProcessedTotal);
    addCounter("polymarket_trades_stored_total", "Total number of trades stored in database", metrics.tradesStoredTotal);
    addCounter("polymarket_trades_error_total", "Total number of trade processing errors", metrics.tradesErrorTotal);
    addCounter("polymarket_whale_trades_total", "Total number of whale trades detected", metrics.whaleTradesTotal);
    addCounter("polymarket_new_wallets_from_trades_total", "Total number of new wallets discovered from trades", metrics.newWalletsFromTradesTotal);
    addGauge("polymarket_trades_per_second", "Current trades per second rate", metrics.tradesPerSecond);

    // Alert Metrics
    addCounter("polymarket_alerts_generated_total", "Total number of alerts generated", metrics.alertsGeneratedTotal);
    addCounter("polymarket_alerts_broadcast_total", "Total number of alerts broadcast via Telegram", metrics.alertsBroadcastTotal);
    addCounter("polymarket_alerts_suppressed_total", "Total number of alerts suppressed due to deduplication", metrics.alertsSuppressedTotal);

    // Add alerts by type
    for (const [type, count] of Object.entries(metrics.alertsByType)) {
      addCounter("polymarket_alerts_by_type", "Alerts by type", count, { type });
    }

    // Add alerts by severity
    for (const [severity, count] of Object.entries(metrics.alertsBySeverity)) {
      addCounter("polymarket_alerts_by_severity", "Alerts by severity", count, { severity });
    }

    // Wallet Profiler Metrics
    addCounter("polymarket_wallets_profiled_total", "Total number of wallets profiled", metrics.walletsProfiledTotal);
    addCounter("polymarket_new_wallets_profiled_total", "Total number of new wallets profiled", metrics.newWalletsProfiledTotal);
    addGauge("polymarket_high_suspicion_wallets_total", "Total number of high suspicion wallets", metrics.highSuspicionWalletsTotal);
    addGauge("polymarket_fresh_wallets_total", "Total number of fresh wallets", metrics.freshWalletsTotal);
    addCounter("polymarket_wallet_cache_hits_total", "Wallet profile cache hits", metrics.walletCacheHits);
    addCounter("polymarket_wallet_cache_misses_total", "Wallet profile cache misses", metrics.walletCacheMisses);

    // Market Sync Metrics
    addCounter("polymarket_markets_synced_total", "Total number of markets synced", metrics.marketsSyncedTotal);
    addCounter("polymarket_new_markets_total", "Total number of new markets discovered", metrics.newMarketsTotal);
    addGauge("polymarket_market_sync_duration_ms", "Duration of last market sync in milliseconds", metrics.marketSyncDurationMs);

    // WebSocket Metrics
    addCounter("polymarket_websocket_messages_total", "Total WebSocket messages received", metrics.websocketMessagesTotal);
    addCounter("polymarket_websocket_reconnects_total", "Total WebSocket reconnections", metrics.websocketReconnectsTotal);
    addGauge("polymarket_active_subscriptions", "Number of active WebSocket subscriptions", metrics.activeSubscriptions);

    // API Metrics
    addCounter("polymarket_api_requests_total", "Total API requests", metrics.apiRequestsTotal);
    addCounter("polymarket_api_errors_total", "Total API errors", metrics.apiErrorsTotal);

    // API metrics by endpoint
    for (const [endpoint, endpointMetrics] of Object.entries(metrics.apiRequestsByEndpoint)) {
      addCounter("polymarket_api_endpoint_requests_total", "Total requests by endpoint", endpointMetrics.requests, { endpoint });
      addCounter("polymarket_api_endpoint_errors_total", "Total errors by endpoint", endpointMetrics.errors, { endpoint });
      addGauge("polymarket_api_endpoint_avg_duration_ms", "Average request duration by endpoint", endpointMetrics.avgDurationMs, { endpoint });
      addGauge("polymarket_api_endpoint_min_duration_ms", "Min request duration by endpoint", endpointMetrics.minDurationMs, { endpoint });
      addGauge("polymarket_api_endpoint_max_duration_ms", "Max request duration by endpoint", endpointMetrics.maxDurationMs, { endpoint });
    }

    // System Metrics
    addGauge("polymarket_uptime_seconds", "Application uptime in seconds", metrics.uptimeSeconds);
    addGauge("polymarket_memory_usage_mb", "Memory usage in megabytes", metrics.memoryUsageMb);
    addGauge("polymarket_heap_used_mb", "Heap used in megabytes", metrics.heapUsedMb);
    addGauge("polymarket_heap_total_mb", "Total heap size in megabytes", metrics.heapTotalMb);

    return lines.join("\n");
  }

  /**
   * Reset all collected metrics
   */
  reset(): void {
    websocketMessagesTotal = 0;
    websocketReconnectsTotal = 0;
    activeSubscriptions = 0;
    apiMetricsByEndpoint.clear();
    apiRequestsTotal = 0;
    apiErrorsTotal = 0;
  }

  /**
   * Get metrics in specified format
   */
  getFormattedMetrics(format: MetricsFormat = "json"): string | ApplicationMetrics {
    if (format === "prometheus") {
      return this.toPrometheus();
    }
    return this.getMetrics();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default metrics collector instance
 */
export const metrics = new MetricsCollector();

/**
 * Reset the startup orchestrator reference (for testing)
 */
export function resetStartupOrchestrator(): void {
  _startupOrchestrator = null;
}

// ============================================================================
// Exports
// ============================================================================

export default metrics;
