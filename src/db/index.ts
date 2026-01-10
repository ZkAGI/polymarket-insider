/**
 * Database Module
 *
 * Exports database clients and services for interacting with the database.
 */

// Prisma client exports
export {
  prisma,
  getPrismaClient,
  createPrismaClient,
  disconnectPrisma,
  resetPrismaClient,
  setPrismaClient,
  PrismaClient,
} from "./client";
export type { PrismaClientConfig } from "./client";

// Market service exports
export {
  MarketService,
  marketService,
  createMarketService,
} from "./markets";
export type {
  Market,
  Outcome,
  MarketWithOutcomes,
  CreateMarketInput,
  UpdateMarketInput,
  CreateOutcomeInput,
  MarketFilters,
  MarketSortOptions,
  PaginationOptions,
  PaginatedMarketResult,
  MarketServiceConfig,
} from "./markets";
