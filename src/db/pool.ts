/**
 * Database Connection Pool Configuration and Monitoring
 *
 * This module provides:
 * - Connection pool configuration management
 * - Pool metrics and monitoring utilities
 * - Health checks for the database connection
 * - Utilities for building connection strings with pool parameters
 *
 * Prisma uses a connection pool internally to manage database connections.
 * The pool size and timeout settings can be configured via:
 * 1. URL parameters (?connection_limit=N&pool_timeout=N)
 * 2. Environment variables
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool
 */

import { env } from "../../config/env";

/**
 * Connection pool configuration options
 */
export interface PoolConfig {
  /**
   * Maximum number of connections in the pool.
   * Recommended: 2-10 for serverless, higher for long-running servers.
   * Default: 10
   */
  connectionLimit: number;

  /**
   * Maximum time (in ms) to wait for a connection from the pool.
   * If no connection is available within this time, an error is thrown.
   * Default: 10000 (10 seconds)
   */
  poolTimeout: number;

  /**
   * Maximum time (in ms) to wait for a new connection to be established.
   * Default: 10000 (10 seconds)
   */
  connectTimeout: number;

  /**
   * Idle timeout (in seconds) for connections in the pool.
   * Connections idle longer than this are closed.
   * Default: 300 (5 minutes)
   */
  idleTimeout?: number;

  /**
   * Socket timeout (in ms) for database operations.
   * Default: undefined (no timeout)
   */
  socketTimeout?: number;

  /**
   * Application name for database connection identification.
   * Useful for monitoring and debugging.
   */
  applicationName?: string;

  /**
   * Schema to use for the connection.
   */
  schema?: string;
}

/**
 * Default pool configuration based on environment
 */
export function getDefaultPoolConfig(): PoolConfig {
  return {
    connectionLimit: env.DB_POOL_SIZE,
    poolTimeout: env.DB_POOL_TIMEOUT,
    connectTimeout: env.DB_CONNECT_TIMEOUT,
    idleTimeout: 300,
    applicationName: "polymarket-tracker",
  };
}

/**
 * Build a database URL with connection pool parameters.
 *
 * @param baseUrl - The base database URL (without pool params)
 * @param config - Pool configuration options
 * @returns The database URL with pool parameters appended
 *
 * @example
 * ```typescript
 * const url = buildPooledDatabaseUrl(
 *   "postgresql://user:pass@localhost:5432/db",
 *   { connectionLimit: 20, poolTimeout: 5000 }
 * );
 * // Returns: postgresql://user:pass@localhost:5432/db?connection_limit=20&pool_timeout=5
 * ```
 */
export function buildPooledDatabaseUrl(
  baseUrl: string,
  config: Partial<PoolConfig> = {}
): string {
  const poolConfig = { ...getDefaultPoolConfig(), ...config };

  const url = new URL(baseUrl);
  const params = url.searchParams;

  // Prisma pool parameters (connection_limit is in count, pool_timeout is in seconds)
  params.set("connection_limit", poolConfig.connectionLimit.toString());
  params.set("pool_timeout", Math.floor(poolConfig.poolTimeout / 1000).toString());
  params.set("connect_timeout", Math.floor(poolConfig.connectTimeout / 1000).toString());

  if (poolConfig.idleTimeout !== undefined) {
    params.set("idle_in_transaction_session_timeout", (poolConfig.idleTimeout * 1000).toString());
  }

  if (poolConfig.socketTimeout !== undefined) {
    params.set("socket_timeout", Math.floor(poolConfig.socketTimeout / 1000).toString());
  }

  if (poolConfig.applicationName) {
    params.set("application_name", poolConfig.applicationName);
  }

  if (poolConfig.schema) {
    params.set("schema", poolConfig.schema);
  }

  return url.toString();
}

/**
 * Parse pool configuration from a database URL.
 *
 * @param url - The database URL to parse
 * @returns Partial pool configuration extracted from the URL
 */
export function parsePoolConfigFromUrl(url: string): Partial<PoolConfig> {
  const parsedUrl = new URL(url);
  const params = parsedUrl.searchParams;
  const config: Partial<PoolConfig> = {};

  const connectionLimit = params.get("connection_limit");
  if (connectionLimit) {
    config.connectionLimit = parseInt(connectionLimit, 10);
  }

  const poolTimeout = params.get("pool_timeout");
  if (poolTimeout) {
    // Convert from seconds to milliseconds
    config.poolTimeout = parseInt(poolTimeout, 10) * 1000;
  }

  const connectTimeout = params.get("connect_timeout");
  if (connectTimeout) {
    config.connectTimeout = parseInt(connectTimeout, 10) * 1000;
  }

  const idleTimeout = params.get("idle_in_transaction_session_timeout");
  if (idleTimeout) {
    config.idleTimeout = parseInt(idleTimeout, 10) / 1000;
  }

  const socketTimeout = params.get("socket_timeout");
  if (socketTimeout) {
    config.socketTimeout = parseInt(socketTimeout, 10) * 1000;
  }

  const applicationName = params.get("application_name");
  if (applicationName) {
    config.applicationName = applicationName;
  }

  const schema = params.get("schema");
  if (schema) {
    config.schema = schema;
  }

  return config;
}

/**
 * Pool metrics for monitoring connection pool health
 */
export interface PoolMetrics {
  /**
   * Current pool configuration
   */
  config: PoolConfig;

  /**
   * Timestamp when metrics were collected
   */
  timestamp: Date;

  /**
   * Whether the database is connected
   */
  isConnected: boolean;

  /**
   * Last health check result
   */
  lastHealthCheck?: HealthCheckResult;
}

/**
 * Health check result for database connection
 */
export interface HealthCheckResult {
  /**
   * Whether the health check passed
   */
  healthy: boolean;

  /**
   * Response time in milliseconds
   */
  responseTimeMs: number;

  /**
   * Error message if unhealthy
   */
  error?: string;

  /**
   * Timestamp of the health check
   */
  timestamp: Date;
}

/**
 * Pool monitor for tracking connection pool health
 */
export class PoolMonitor {
  private config: PoolConfig;
  private lastHealthCheck?: HealthCheckResult;
  private isConnected = false;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...getDefaultPoolConfig(), ...config };
  }

  /**
   * Get the current pool configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * Update the pool configuration
   */
  updateConfig(config: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return {
      config: this.getConfig(),
      timestamp: new Date(),
      isConnected: this.isConnected,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Record a health check result
   */
  recordHealthCheck(result: HealthCheckResult): void {
    this.lastHealthCheck = result;
    this.isConnected = result.healthy;
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): HealthCheckResult | undefined {
    return this.lastHealthCheck;
  }

  /**
   * Check if the pool is currently healthy
   */
  isHealthy(): boolean {
    if (!this.lastHealthCheck) {
      return false;
    }
    return this.lastHealthCheck.healthy;
  }

  /**
   * Get the connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Set the connection status
   */
  setConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
  }

  /**
   * Start periodic health checks
   *
   * @param healthCheckFn - Function to perform health check
   * @param intervalMs - Interval between checks in milliseconds (default: 30000)
   */
  startHealthChecks(
    healthCheckFn: () => Promise<HealthCheckResult>,
    intervalMs = 30000
  ): void {
    this.stopHealthChecks();
    this.healthCheckInterval = setInterval(async () => {
      const result = await healthCheckFn();
      this.recordHealthCheck(result);
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Reset the monitor state
   */
  reset(): void {
    this.stopHealthChecks();
    this.lastHealthCheck = undefined;
    this.isConnected = false;
  }
}

/**
 * Recommended pool sizes based on deployment environment
 */
export const POOL_SIZE_RECOMMENDATIONS = {
  /**
   * Serverless environments (Lambda, Vercel, etc.)
   * Lower pool size to avoid connection exhaustion
   */
  serverless: {
    connectionLimit: 2,
    poolTimeout: 5000,
    connectTimeout: 5000,
  },

  /**
   * Development environment
   * Moderate pool size for local development
   */
  development: {
    connectionLimit: 5,
    poolTimeout: 10000,
    connectTimeout: 10000,
  },

  /**
   * Production server (long-running)
   * Higher pool size for sustained traffic
   */
  production: {
    connectionLimit: 20,
    poolTimeout: 10000,
    connectTimeout: 10000,
  },

  /**
   * High traffic production
   * Maximum pool size for high concurrency
   */
  highTraffic: {
    connectionLimit: 50,
    poolTimeout: 15000,
    connectTimeout: 15000,
  },

  /**
   * Testing environment
   * Minimal pool for tests
   */
  testing: {
    connectionLimit: 2,
    poolTimeout: 5000,
    connectTimeout: 5000,
  },
} as const;

/**
 * Get recommended pool configuration based on environment
 */
export function getRecommendedPoolConfig(
  environment?: "serverless" | "development" | "production" | "highTraffic" | "testing"
): PoolConfig {
  const envType = environment ?? (env.isProduction ? "production" : env.isTest ? "testing" : "development");

  const recommendation = POOL_SIZE_RECOMMENDATIONS[envType] ?? POOL_SIZE_RECOMMENDATIONS.development;

  return {
    ...getDefaultPoolConfig(),
    ...recommendation,
  };
}

/**
 * Validate pool configuration values
 */
export function validatePoolConfig(config: Partial<PoolConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.connectionLimit !== undefined) {
    if (config.connectionLimit < 1) {
      errors.push("connectionLimit must be at least 1");
    }
    if (config.connectionLimit > 100) {
      errors.push("connectionLimit should not exceed 100 (consider load balancing instead)");
    }
  }

  if (config.poolTimeout !== undefined) {
    if (config.poolTimeout < 0) {
      errors.push("poolTimeout must be non-negative");
    }
    if (config.poolTimeout > 60000) {
      errors.push("poolTimeout should not exceed 60 seconds");
    }
  }

  if (config.connectTimeout !== undefined) {
    if (config.connectTimeout < 0) {
      errors.push("connectTimeout must be non-negative");
    }
    if (config.connectTimeout > 60000) {
      errors.push("connectTimeout should not exceed 60 seconds");
    }
  }

  if (config.idleTimeout !== undefined) {
    if (config.idleTimeout < 0) {
      errors.push("idleTimeout must be non-negative");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Default pool monitor instance
 */
export const poolMonitor = new PoolMonitor();

/**
 * Create a new pool monitor instance
 */
export function createPoolMonitor(config?: Partial<PoolConfig>): PoolMonitor {
  return new PoolMonitor(config);
}
