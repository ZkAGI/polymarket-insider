/**
 * Polygon Chain API Exports (API-CHAIN-001, API-CHAIN-002, API-CHAIN-003)
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
  // API-CHAIN-003: Token Balance Types
  TokenBalance,
  NativeBalance,
  NFTToken,
  ERC1155Balance,
  WalletBalanceSummary,
  TokenBalanceOptions,
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

// API-CHAIN-003: Token Balances
export {
  TokenBalanceClient,
  createTokenBalanceClient,
  getSharedTokenBalanceClient,
  setSharedTokenBalanceClient,
  resetSharedTokenBalanceClient,
  getNativeBalance,
  getTokenBalance,
  getTokenBalances,
  getNFTTokens,
  getERC1155Balances,
  getWalletBalanceSummary,
} from "./balances";

// API-CHAIN-004: Wallet Creation Date
export type {
  WalletCreationDate,
  WalletCreationDateOptions,
  WalletCreationDateCacheConfig,
} from "./creation-date";

export {
  WalletCreationDateClient,
  createWalletCreationDateClient,
  getSharedWalletCreationDateClient,
  setSharedWalletCreationDateClient,
  resetSharedWalletCreationDateClient,
  getWalletCreationDate,
  getWalletAgeInDays,
  isWalletFresh,
  batchGetCreationDates,
} from "./creation-date";

// API-CHAIN-005: Wallet Monitor
export type {
  TransactionType,
  WalletMonitorEventTypeValue,
  WalletMonitorEvent,
  NewTransactionEvent,
  NewInternalTransactionEvent,
  MonitorStartedEvent,
  MonitorStoppedEvent,
  WalletAddedEvent,
  WalletRemovedEvent,
  MonitorErrorEvent,
  PollCompleteEvent,
  WalletMonitorEventData,
  WalletMonitorEventListener,
  WalletMonitorListenerOptions,
  WalletMonitorConfig,
  WalletMonitorLogger,
  WalletMonitorStats,
} from "./wallet-monitor";

export {
  WalletMonitorEventType,
  WalletMonitor,
  createWalletMonitor,
  getSharedWalletMonitor,
  setSharedWalletMonitor,
  resetSharedWalletMonitor,
  startMonitoringWallet,
  monitorWallets,
} from "./wallet-monitor";
