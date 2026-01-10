/**
 * Polymarket CLOB (Central Limit Order Book) API module
 *
 * Exports the API client and types for interacting with
 * the Polymarket CLOB API for order book data, trades, and trading operations.
 */

export { ClobClient, ClobApiException, clobClient, createClobClient, validateCredentials } from "./client";

// Authentication module (API-CLOB-008)
export {
  // Auth header generation
  generateSignature,
  generateAuthHeaders,
  validateCredentialFormat,
  // Error classification
  classifyAuthError,
  isAuthError,
  isRetryableAuthError,
  AuthErrorType,
  // Credential storage
  CredentialStore,
  // Auth manager
  AuthManager,
  getSharedAuthManager,
  setSharedAuthManager,
  resetSharedAuthManager,
  createAuthManager,
  // Auth wrapper
  withAuth,
} from "./auth";

export type {
  ClassifiedAuthError,
  CredentialStorageConfig,
  KeyRotationConfig,
  AuthState,
} from "./auth";

export {
  getOrderBook,
  getOrderBooks,
  calculateLiquidityAtPrice,
  getMidPrice,
  getSpreadPercentage,
  getTotalBidVolume,
  getTotalAskVolume,
  getVolumeImbalance,
  // Order book depth functions (API-CLOB-007)
  getOrderBookDepth,
  getCumulativeVolumeAtPrice,
  getPriceForVolume,
  calculateMarketImpact,
  getDepthAtPercentages,
  checkLiquidity,
} from "./orderbook";

export type {
  GetOrderBookOptions,
  // Order book depth types (API-CLOB-007)
  OrderBookDepthLevel,
  GetOrderBookDepthOptions,
  DepthSideSummary,
  OrderBookDepth as ComputedOrderBookDepth,
} from "./orderbook";

export {
  getRecentTrades,
  getRecentTradesForTokens,
  calculateTotalVolume,
  calculateVWAP,
  getPriceRange,
  getTradeCounts,
  getVolumesBySide,
  filterTradesByTimeRange,
  filterTradesByMinSize,
  getUniqueWallets,
  // Wallet-specific trade functions (API-CLOB-004)
  getTradesByWallet,
  getAllTradesByWallet,
  getWalletActivitySummary,
  hasWalletTraded,
  getFirstWalletTrade,
  getTradesBetweenWallets,
  isValidWalletAddress,
  normalizeWalletAddress,
  // Filtered trades functions (API-CLOB-006)
  getFilteredTrades,
  getAllFilteredTrades,
  calculateFilteredTradesStats,
  getTradesInTimeWindow,
  getLargeTrades,
  getTradesInPriceRange,
  getTradesBySide,
} from "./trades";

export type {
  GetRecentTradesOptions,
  GetRecentTradesResult,
  // Wallet-specific types (API-CLOB-004)
  GetTradesByWalletOptions,
  GetTradesByWalletResult,
  WalletActivitySummary,
  WalletTradeRole,
  // Filtered trades types (API-CLOB-006)
  TradeFilterOptions,
  GetFilteredTradesResult,
  FilteredTradesStats,
} from "./trades";

// Open orders functions (API-CLOB-005)
export {
  getOpenOrders,
  getAllOpenOrders,
  getOpenOrdersSummary,
  hasOpenOrders,
  getOpenOrdersForMarket,
  calculateOpenOrdersValue,
  calculateRemainingOrdersValue,
  getOrderRemainingSize,
  getOrderFillPercentage,
  filterOrdersByMinRemainingSize,
  groupOrdersByToken,
  groupOrdersBySide,
} from "./orders";

export type {
  GetOpenOrdersOptions,
  GetOpenOrdersResult,
  OpenOrdersSummary,
} from "./orders";

// CLOB Rate Limiter (API-CLOB-009)
export {
  ClobRateLimiter,
  ClobEndpointCategory,
  getEndpointCategory,
  getSharedClobRateLimiter,
  setSharedClobRateLimiter,
  resetSharedClobRateLimiter,
  createClobRateLimiter,
  withClobRateLimit,
  executeWithClobRateLimit,
  // Re-exports from base rate limiter
  RateLimiter,
  RateLimiterError,
  createRateLimiter,
} from "./rate-limiter";

export type {
  ClobRateLimiterConfig,
  ClobRateLimiterStats,
  // Re-exports from base rate limiter
  RateLimiterConfig,
  RateLimiterStats,
} from "./rate-limiter";

export type {
  ClobClientConfig,
  ClobRequestOptions,
  ClobApiError,
  OrderSide,
  OrderType,
  OrderStatus,
  TradeDirection,
  Order,
  OrderBookLevel,
  OrderBook,
  Trade,
  TradeExecution,
  TradeFilter,
  TradesResponse,
  ClobCredentials,
  SignedHeaders,
  ClobMarket,
  TickSize,
  OrderBookDepth,
} from "./types";
