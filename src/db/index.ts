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
  // Pool and health check exports
  getPoolMonitor,
  setPoolMonitor,
  performHealthCheck,
  startHealthChecks,
  stopHealthChecks,
  getPoolMetrics,
  isConnectionHealthy,
} from "./client";
export type { PrismaClientConfig } from "./client";

// Connection pool configuration exports
export {
  PoolMonitor,
  poolMonitor,
  createPoolMonitor,
  getDefaultPoolConfig,
  getRecommendedPoolConfig,
  buildPooledDatabaseUrl,
  parsePoolConfigFromUrl,
  validatePoolConfig,
  POOL_SIZE_RECOMMENDATIONS,
} from "./pool";
export type {
  PoolConfig,
  PoolMetrics,
  HealthCheckResult,
} from "./pool";

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

// Snapshot service exports
export {
  SnapshotService,
  snapshotService,
  createSnapshotService,
} from "./snapshots";
export type {
  MarketSnapshot,
  WalletSnapshot,
  MarketSnapshotWithMarket,
  WalletSnapshotWithWallet,
  CreateMarketSnapshotInput,
  CreateWalletSnapshotInput,
  MarketSnapshotFilters,
  WalletSnapshotFilters,
  MarketSnapshotSortOptions,
  WalletSnapshotSortOptions,
  SnapshotPaginationOptions,
  PaginatedMarketSnapshotResult,
  PaginatedWalletSnapshotResult,
  SnapshotServiceConfig,
  TimeRange,
  MarketSnapshotStats,
  WalletSnapshotStats,
} from "./snapshots";
