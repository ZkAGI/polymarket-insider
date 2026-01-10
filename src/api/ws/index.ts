/**
 * Polymarket WebSocket API module
 *
 * Provides WebSocket connection management for real-time data streaming
 * from the Polymarket API.
 */

// Connection Manager (API-WS-001)
export {
  WebSocketConnection,
  WebSocketManager,
  getSharedWebSocketManager,
  setSharedWebSocketManager,
  resetSharedWebSocketManager,
  createWebSocketManager,
  createWebSocketConnection,
  CloseCode,
  WebSocketReadyState,
} from "./connection-manager";

// Auto-Reconnection (API-WS-002)
export {
  ReconnectableConnection,
  createReconnectableConnection,
  calculateBackoffDelay,
  calculateBackoffDelayWithJitter,
  shouldReconnectOnClose,
  getReconnectDelayForCloseCode,
} from "./auto-reconnect";

// Types
export type {
  // Connection state types
  ConnectionState,
  ConnectionStateChange,
  // Configuration types
  WebSocketConfig,
  WebSocketManagerConfig,
  // Event types
  WebSocketEvent,
  ConnectionOpenEvent,
  ConnectionCloseEvent,
  ConnectionErrorEvent,
  MessageEvent,
  ReconnectEvent,
  StateChangeEvent,
  WebSocketEventType,
  // Listener types
  EventListener,
  EventListenerMap,
  ListenerOptions,
  // Message types
  OutgoingMessage,
  IncomingMessage,
  // Connection info types
  ConnectionStats,
  ConnectionInfo,
  // Logger types
  LogLevel,
  WebSocketLogger,
  // WebSocket interface types
  IWebSocket,
  WebSocketConstructor,
} from "./types";

// Auto-Reconnection Types (API-WS-002)
export type {
  Subscription,
  SubscriptionRestoredEvent,
  SubscriptionsRestoredEvent,
  ReconnectConfig,
  ReconnectableConnectionConfig,
  ReconnectionState,
  ReconnectEventListenerMap,
} from "./auto-reconnect";

// Market Subscriptions (API-WS-003)
export {
  MarketSubscriptionClient,
  createMarketSubscriptionClient,
  getSharedMarketSubscriptionClient,
  setSharedMarketSubscriptionClient,
  resetSharedMarketSubscriptionClient,
  // Constants
  POLYMARKET_WS_URL,
  SubscriptionMessageType,
  SubscriptionChannel,
  // Utility functions
  generateSubscriptionId,
  normalizeTokenIds,
  buildSubscriptionMessage,
  parseMessageTimestamp,
  parsePriceUpdate,
  isSubscriptionConfirmation,
  isPriceUpdateMessage,
  isErrorMessage,
} from "./market-subscriptions";

// Market Subscription Types (API-WS-003)
export type {
  SubscriptionMessageTypeValue,
  SubscriptionChannelValue,
  MarketSubscriptionRequest,
  SubscriptionMessage,
  SubscriptionConfirmation,
  PriceUpdate,
  ParsedPriceUpdate,
  MarketSubscriptionInfo,
  PriceUpdateEvent,
  SubscriptionConfirmedEvent,
  SubscriptionErrorEvent,
  SignificantPriceChangeEvent,
  MarketSubscriptionConfig,
  MarketSubscriptionEventListenerMap,
} from "./market-subscriptions";
