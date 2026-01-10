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

// Wallet service exports
export {
  WalletService,
  walletService,
  createWalletService,
  WalletType,
  RiskLevel,
  FundingSourceType,
} from "./wallets";
export type {
  Wallet,
  WalletWithTrades,
  WalletWithAlerts,
  WalletWithFundingSources,
  WalletWithSnapshots,
  WalletWithClusters,
  WalletWithRelations,
  CreateWalletInput,
  UpdateWalletInput,
  WalletFilters,
  WalletSortOptions,
  PaginatedWalletResult,
  WalletIncludeOptions,
  WalletServiceConfig,
  WalletStats,
} from "./wallets";

// Alert service exports
export {
  AlertService,
  alertService,
  createAlertService,
  AlertType,
  AlertSeverity,
} from "./alerts";
export type {
  Alert,
  AlertWithMarket,
  AlertWithWallet,
  AlertWithRelations,
  CreateAlertInput,
  UpdateAlertInput,
  AlertFilters,
  AlertSortOptions,
  PaginatedAlertResult,
  AlertIncludeOptions,
  AlertServiceConfig,
  AlertStats,
} from "./alerts";
