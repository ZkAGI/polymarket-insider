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
} from "./trades";

export type { GetRecentTradesOptions, GetRecentTradesResult } from "./trades";

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
