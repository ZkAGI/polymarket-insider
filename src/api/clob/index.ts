/**
 * Polymarket CLOB (Central Limit Order Book) API module
 *
 * Exports the API client and types for interacting with
 * the Polymarket CLOB API for order book data, trades, and trading operations.
 */

export { ClobClient, ClobApiException, clobClient, createClobClient, validateCredentials } from "./client";

export {
  getOrderBook,
  getOrderBooks,
  calculateLiquidityAtPrice,
  getMidPrice,
  getSpreadPercentage,
  getTotalBidVolume,
  getTotalAskVolume,
  getVolumeImbalance,
} from "./orderbook";

export type { GetOrderBookOptions } from "./orderbook";

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
} from "./trades";

export type {
  GetRecentTradesOptions,
  GetRecentTradesResult,
  // Wallet-specific types (API-CLOB-004)
  GetTradesByWalletOptions,
  GetTradesByWalletResult,
  WalletActivitySummary,
  WalletTradeRole,
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
