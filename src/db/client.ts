/**
 * Prisma Database Client
 *
 * Singleton instance of the Prisma client for database operations.
 * Uses lazy initialization to avoid connection issues during imports.
 */

import { PrismaClient } from "@prisma/client";

// Declare global type for singleton pattern
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
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
}

/**
 * Create a new Prisma client instance with the given configuration.
 *
 * @param config - Optional configuration
 * @returns A new PrismaClient instance
 */
export function createPrismaClient(config: PrismaClientConfig = {}): PrismaClient {
  const logQueries = config.logQueries ?? process.env.NODE_ENV === "development";

  const client = new PrismaClient({
    log: logQueries ? ["query", "info", "warn", "error"] : ["error"],
    datasourceUrl: config.datasourceUrl,
  });

  return client;
}

/**
 * Get the singleton Prisma client instance.
 *
 * In development, the client is stored globally to persist across hot reloads.
 * In production, a new client is created if one doesn't exist.
 *
 * @returns The Prisma client singleton
 */
export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    // In production, create a new client if needed
    if (!global.__prisma) {
      global.__prisma = createPrismaClient();
    }
    return global.__prisma;
  }

  // In development, use global to persist across hot reloads
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }

  return global.__prisma;
}

/**
 * Default Prisma client singleton for convenience imports.
 */
export const prisma = getPrismaClient();

/**
 * Disconnect the Prisma client.
 * Should be called when the application is shutting down.
 */
export async function disconnectPrisma(): Promise<void> {
  if (global.__prisma) {
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
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

export { PrismaClient };
