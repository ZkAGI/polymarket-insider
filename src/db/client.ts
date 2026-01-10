/**
 * Prisma Database Client with Connection Pooling
 *
 * Singleton instance of the Prisma client for database operations.
 * Uses lazy initialization to avoid connection issues during imports.
 *
 * Connection pooling is configured via:
 * - Environment variables (DB_POOL_SIZE, DB_POOL_TIMEOUT, DB_CONNECT_TIMEOUT)
 * - URL parameters in DATABASE_URL
 * - PrismaClientConfig options
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool
 */

import { PrismaClient } from "@prisma/client";
import {
  PoolConfig,
  PoolMonitor,
  HealthCheckResult,
  buildPooledDatabaseUrl,
  getDefaultPoolConfig,
  poolMonitor,
} from "./pool";

// Declare global type for singleton pattern
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaPoolMonitor: PoolMonitor | undefined;
}

/**
 * Configuration options for the Prisma client
 */
export interface PrismaClientConfig {
  /**
   * Enable query logging for debugging.
   * Default: false in production, true in development
   */
  logQueries?: boolean;

  /**
   * Datasource URL override (useful for testing)
   */
  datasourceUrl?: string;

  /**
   * Connection pool configuration.
   * If provided, pool parameters will be appended to the database URL.
   */
  poolConfig?: Partial<PoolConfig>;

  /**
   * Enable connection pooling.
   * When true, pool configuration is applied to the database URL.
   * Default: true
   */
  enablePooling?: boolean;

  /**
   * Enable periodic health checks.
   * Default: true in production, false otherwise
   */
  enableHealthChecks?: boolean;

  /**
   * Health check interval in milliseconds.
   * Default: 30000 (30 seconds)
   */
  healthCheckIntervalMs?: number;
}

/**
 * Create a new Prisma client instance with the given configuration.
 *
 * @param config - Optional configuration
 * @returns A new PrismaClient instance
 *
 * @example
 * ```typescript
 * // Basic client
 * const client = createPrismaClient();
 *
 * // With custom pool settings
 * const client = createPrismaClient({
 *   poolConfig: {
 *     connectionLimit: 20,
 *     poolTimeout: 5000,
 *   },
 * });
 *
 * // With custom database URL
 * const client = createPrismaClient({
 *   datasourceUrl: "postgresql://user:pass@localhost:5432/testdb",
 *   poolConfig: { connectionLimit: 2 },
 * });
 * ```
 */
export function createPrismaClient(config: PrismaClientConfig = {}): PrismaClient {
  const logQueries = config.logQueries ?? process.env.NODE_ENV === "development";
  const enablePooling = config.enablePooling ?? true;

  let datasourceUrl = config.datasourceUrl ?? process.env.DATABASE_URL;

  // Apply pool configuration to the URL if pooling is enabled
  if (enablePooling && datasourceUrl) {
    const poolConfig = config.poolConfig ?? getDefaultPoolConfig();
    datasourceUrl = buildPooledDatabaseUrl(datasourceUrl, poolConfig);
  }

  const client = new PrismaClient({
    log: logQueries ? ["query", "info", "warn", "error"] : ["error"],
    datasourceUrl,
  });

  return client;
}

/**
 * Get the singleton Prisma client instance.
 *
 * In development, the client is stored globally to persist across hot reloads.
 * In production, a new client is created if one doesn't exist.
 *
 * @param config - Optional configuration (only used when creating new client)
 * @returns The Prisma client singleton
 */
export function getPrismaClient(config?: PrismaClientConfig): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    // In production, create a new client if needed
    if (!global.__prisma) {
      global.__prisma = createPrismaClient(config);
    }
    return global.__prisma;
  }

  // In development, use global to persist across hot reloads
  if (!global.__prisma) {
    global.__prisma = createPrismaClient(config);
  }

  return global.__prisma;
}

/**
 * Get the pool monitor for the Prisma client.
 *
 * @returns The pool monitor instance
 */
export function getPoolMonitor(): PoolMonitor {
  if (!global.__prismaPoolMonitor) {
    global.__prismaPoolMonitor = poolMonitor;
  }
  return global.__prismaPoolMonitor;
}

/**
 * Default Prisma client singleton for convenience imports.
 */
export const prisma = getPrismaClient();

/**
 * Perform a health check on the database connection.
 *
 * @param client - The Prisma client to check (defaults to singleton)
 * @returns Health check result with timing information
 *
 * @example
 * ```typescript
 * const result = await performHealthCheck();
 * if (result.healthy) {
 *   console.log(`Database healthy, response time: ${result.responseTimeMs}ms`);
 * } else {
 *   console.error(`Database unhealthy: ${result.error}`);
 * }
 * ```
 */
export async function performHealthCheck(
  client: PrismaClient = prisma
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Execute a simple query to check connectivity
    await client.$queryRaw`SELECT 1`;

    const result: HealthCheckResult = {
      healthy: true,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date(),
    };

    // Update the pool monitor
    getPoolMonitor().recordHealthCheck(result);

    return result;
  } catch (error) {
    const result: HealthCheckResult = {
      healthy: false,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
    };

    // Update the pool monitor
    getPoolMonitor().recordHealthCheck(result);

    return result;
  }
}

/**
 * Start periodic health checks on the database connection.
 *
 * @param client - The Prisma client to check (defaults to singleton)
 * @param intervalMs - Interval between checks in milliseconds (default: 30000)
 *
 * @example
 * ```typescript
 * // Start health checks every 30 seconds
 * startHealthChecks();
 *
 * // Start health checks every 10 seconds
 * startHealthChecks(prisma, 10000);
 * ```
 */
export function startHealthChecks(
  client: PrismaClient = prisma,
  intervalMs = 30000
): void {
  getPoolMonitor().startHealthChecks(() => performHealthCheck(client), intervalMs);
}

/**
 * Stop periodic health checks.
 */
export function stopHealthChecks(): void {
  getPoolMonitor().stopHealthChecks();
}

/**
 * Get current pool metrics including health status.
 *
 * @returns Pool metrics and health information
 */
export function getPoolMetrics() {
  return getPoolMonitor().getMetrics();
}

/**
 * Check if the database connection is healthy.
 *
 * @returns True if the last health check passed
 */
export function isConnectionHealthy(): boolean {
  return getPoolMonitor().isHealthy();
}

/**
 * Disconnect the Prisma client.
 * Should be called when the application is shutting down.
 */
export async function disconnectPrisma(): Promise<void> {
  stopHealthChecks();

  if (global.__prisma) {
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
  }

  if (global.__prismaPoolMonitor) {
    global.__prismaPoolMonitor.reset();
    global.__prismaPoolMonitor = undefined;
  }
}

/**
 * Reset the Prisma client (useful for testing).
 * Disconnects the current client and clears the singleton.
 */
export async function resetPrismaClient(): Promise<void> {
  await disconnectPrisma();
}

/**
 * Set a custom Prisma client (useful for testing with mocks).
 *
 * @param client - The Prisma client to use
 */
export function setPrismaClient(client: PrismaClient): void {
  global.__prisma = client;
}

/**
 * Set a custom pool monitor (useful for testing).
 *
 * @param monitor - The pool monitor to use
 */
export function setPoolMonitor(monitor: PoolMonitor): void {
  global.__prismaPoolMonitor = monitor;
}

export { PrismaClient };
