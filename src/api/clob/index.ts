/**
 * Polymarket CLOB (Central Limit Order Book) API module
 *
 * Exports the API client and types for interacting with
 * the Polymarket CLOB API for order book data, trades, and trading operations.
 */

export { ClobClient, ClobApiException, clobClient, createClobClient, validateCredentials } from "./client";

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
