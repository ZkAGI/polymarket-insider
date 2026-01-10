/**
 * Polygon Chain API Exports (API-CHAIN-001, API-CHAIN-002)
 *
 * This module provides blockchain interaction capabilities for the Polygon network.
 */

// Types
export type {
  RpcEndpointConfig,
  PolygonClientConfig,
  PolygonClientLogger,
  ConnectionState,
  ConnectionEventType,
  ConnectionEvent,
  ConnectionEventListener,
  EndpointHealth,
  BlockInfo,
  TransactionInfo,
  TransactionReceipt,
  LogEntry,
  ClientStats,
  PolygonClientErrorCode,
  Disposable,
  // API-CHAIN-002: Wallet History Types
  WalletTransaction,
  InternalTransaction,
  WalletHistoryOptions,
  WalletHistoryResult,
  PolygonscanConfig,
} from "./types";

export { PolygonClientError, PolygonscanError } from "./types";

// Client
export {
  PolygonClient,
  createPolygonClient,
  getSharedPolygonClient,
  setSharedPolygonClient,
  resetSharedPolygonClient,
  DEFAULT_POLYGON_RPC_ENDPOINTS,
} from "./client";

// API-CHAIN-002: Wallet History
export {
  PolygonscanClient,
  createPolygonscanClient,
  getSharedPolygonscanClient,
  setSharedPolygonscanClient,
  resetSharedPolygonscanClient,
  getWalletHistory,
  getAllWalletHistory,
  getInternalTransactions,
  getTransactionCount,
} from "./history";
