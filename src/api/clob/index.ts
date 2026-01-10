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

// CLOB Error Handler (API-CLOB-010)
export {
  // Enums
  ClobErrorType,
  ClobErrorSeverity,
  ClobErrorCodes,
  RecoveryAction,
  // Classification functions
  classifyClobError,
  getRecoveryAction,
  // Utility functions
  calculateClobBackoffDelay,
  shouldRetryClobError,
  createClobErrorContext,
  logClobError,
  // Type checking functions
  isClobErrorType,
  isRetryableClobError,
  hasRecoveryAction,
  // Error handler class
  ClobErrorHandler,
  createClobErrorHandler,
  // Shared handler management
  getSharedClobErrorHandler,
  resetSharedClobErrorHandler,
  setSharedClobErrorHandler,
  // Convenience wrappers
  withClobErrorHandling,
  withClobErrorHandlingOrThrow,
  // Formatting
  formatClobErrorMessage,
} from "./error-handler";

export type {
  ClobErrorCode,
  ClobErrorHandlerConfig,
  ClobErrorLogger,
  ClobErrorContext,
  ClobErrorHandlerResult,
  ClobWrapOptions,
} from "./error-handler";

// Trade Execution Parser (API-CLOB-011)
export {
  // Main parsing functions
  parseTradeExecution,
  tradeToExecution,
  parseTradeExecutions,
  tradesToExecutions,
  // Timestamp normalization
  parseTimestampToMs,
  normalizeTimestamp,
  isTimestampInRange,
  // Fee extraction and calculation
  extractFeeRateBps,
  calculateFeeFromRate,
  extractFeeUsd,
  calculateTotalFees,
  // Value extraction
  extractSizeUsd,
  extractPrice,
  extractSize,
  // Direction parsing
  parseTradeDirection,
  // Status parsing
  determineExecutionStatus,
  // Utility functions
  sortExecutionsByTime,
  filterExecutionsByTimeRange,
  filterExecutionsByMinSize,
  groupExecutionsByAsset,
  groupExecutionsBySide,
  calculateExecutionVWAP,
  isEnrichedTradeExecution,
} from "./trade-execution";

export type {
  RawTradeExecutionResponse,
  EnrichedTradeExecution,
  ExecutionStatus,
  FeeCalculationOptions,
  NormalizedTimestamp,
  ParseTradeExecutionsResult,
} from "./trade-execution";

// USD Calculator (API-CLOB-012)
export {
  // USDC price functions
  getUsdcPrice,
  validateUsdcPrice,
  createUsdcPriceFetcher,
  // Trade size calculations
  calculateTradeSizeUsd,
  calculateTradeValueWithFees,
  calculateTradeUsdValues,
  calculateTradesUsdValues,
  enrichTradeWithUsd,
  enrichTradesWithUsd,
  // Trade summary calculations
  calculateTradeUsdSummary,
  // Position value calculations
  calculatePositionValueUsd,
  calculatePotentialPayout,
  calculatePotentialProfit,
  calculatePotentialRoi,
  // Outcome token pricing
  getOutcomeTokenPrice,
  priceToImpliedProbability,
  impliedProbabilityToPrice,
  // Order book USD calculations
  addUsdToOrderBookLevels,
  calculateOrderBookSideValueUsd,
  calculateOrderBookTotalValueUsd,
  // Position tracking
  buildPositionFromTrades,
  // Utility functions
  formatUsdValue,
  isWhaleTrade,
  filterTradesByMinValueUsd,
  sortTradesByValueUsd,
  getTopTradesByValue,
} from "./usd-calculator";

export type {
  UsdCalculatorConfig,
  PositionValueResult,
  TradeWithUsdValues,
  OrderBookLevelUsd,
  TradeUsdSummary,
  OutcomeTokenPrice,
  Position,
} from "./usd-calculator";

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
