/**
 * Polygon Chain API Exports (API-CHAIN-001)
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
} from "./types";

export { PolygonClientError } from "./types";

// Client
export {
  PolygonClient,
  createPolygonClient,
  getSharedPolygonClient,
  setSharedPolygonClient,
  resetSharedPolygonClient,
  DEFAULT_POLYGON_RPC_ENDPOINTS,
} from "./client";
