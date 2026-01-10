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

// Trade Stream (API-WS-004)
export {
  TradeStreamClient,
  createTradeStreamClient,
  getSharedTradeStreamClient,
  setSharedTradeStreamClient,
  resetSharedTradeStreamClient,
  // Constants
  POLYMARKET_TRADES_WS_URL,
  DEFAULT_BUFFER_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_MAX_TRADES_PER_TOKEN,
  // Utility functions
  parseTradeDirection,
  parseTradeMessage,
  isTradeMessage,
  buildTradeSubscriptionMessage,
  calculateTradeStreamStats,
  filterTradesByMinSize,
  filterTradesByTimeRange,
  groupTradesByAsset,
  sortTradesByTime,
} from "./trade-stream";

// Trade Stream Types (API-WS-004)
export type {
  TradeStreamDirection,
  RawTradeMessage,
  ParsedTrade,
  TradeStreamSubscriptionRequest,
  TradeStreamSubscriptionInfo,
  TradeEvent,
  TradeBatchEvent,
  LargeTradeEvent,
  TradeStreamConfirmedEvent,
  TradeStreamErrorEvent,
  TradeStreamStats,
  TradeStreamConfig,
  TradeStreamEventListenerMap,
} from "./trade-stream";

// Order Book Stream (API-WS-005)
export {
  OrderBookStreamClient,
  createOrderBookStreamClient,
  getSharedOrderBookStreamClient,
  setSharedOrderBookStreamClient,
  resetSharedOrderBookStreamClient,
  // Constants
  POLYMARKET_BOOK_WS_URL,
  DEFAULT_MAX_BOOK_LEVELS,
  DEFAULT_SNAPSHOT_INTERVAL,
  // Utility functions
  parseBookLevel,
  parseBookSide,
  isOrderBookMessage,
  buildBookSubscriptionMessage,
  calculateOrderBookStats,
  createEmptyOrderBook,
  applyDeltaUpdate,
  parseOrderBookMessage,
  getCumulativeVolumeAtPrice,
  getPriceForVolume,
  calculateMarketImpact,
} from "./orderbook-stream";

// Order Book Stream Types (API-WS-005)
export type {
  BookSide,
  DeltaType,
  RawBookLevel,
  RawBookUpdateMessage,
  ParsedBookLevel,
  OrderBookState,
  OrderBookSubscriptionRequest,
  OrderBookSubscriptionInfo,
  OrderBookUpdateEvent,
  OrderBookSnapshotEvent,
  SpreadChangeEvent,
  BookImbalanceEvent,
  OrderBookConfirmedEvent,
  OrderBookErrorEvent,
  OrderBookStats,
  OrderBookStreamConfig,
  OrderBookStreamEventListenerMap,
} from "./orderbook-stream";
