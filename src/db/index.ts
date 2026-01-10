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

// Trade service exports
export {
  TradeService,
  tradeService,
  createTradeService,
  TradeSide,
} from "./trades";
export type {
  Trade,
  TradeWithMarket,
  TradeWithOutcome,
  TradeWithWallet,
  TradeWithRelations,
  CreateTradeInput,
  UpdateTradeInput,
  TradeFilters,
  TradeSortOptions,
  PaginatedTradeResult,
  TradeIncludeOptions,
  TradeServiceConfig,
  TradeStats,
} from "./trades";
