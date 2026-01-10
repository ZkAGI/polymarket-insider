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

// Message Parser (API-WS-006)
export {
  MessageParser,
  createMessageParser,
  getSharedMessageParser,
  setSharedMessageParser,
  resetSharedMessageParser,
  // Constants
  MessageType,
  MessageCategory,
  ParseErrorCode,
  // Utility functions
  determineMessageType,
  determineMessageCategory,
  isValidJson,
  safeJsonParse,
  arrayBufferToString,
  blobToString,
  validateMessageSchema,
  createParseError,
  isPingPongMessage,
  isSubscriptionMessage,
  isMarketDataMessage,
  isErrorMessageType,
  extractMessageId,
  extractTimestamp,
  // Default schemas
  defaultSchemas,
} from "./message-parser";

// Message Parser Types (API-WS-006)
export type {
  MessageTypeValue,
  MessageCategoryValue,
  ParseErrorCodeValue,
  BaseMessage,
  ParseError,
  ParsedMessage,
  ValidationRule,
  MessageSchema,
  MessageParserConfig,
  ParserStats,
} from "./message-parser";

// Heartbeat Handler (API-WS-007)
export {
  HeartbeatHandler,
  createHeartbeatHandler,
  getSharedHeartbeatHandler,
  setSharedHeartbeatHandler,
  resetSharedHeartbeatHandler,
  attachHeartbeatHandler,
  // Constants
  DEFAULT_PING_INTERVAL,
  DEFAULT_PONG_TIMEOUT,
  DEFAULT_MISSED_PONGS_THRESHOLD,
  DEFAULT_LATENCY_HISTORY_SIZE,
  DEFAULT_STALE_THRESHOLD,
  HeartbeatMessageType,
  HeartbeatEventType,
  // Utility functions
  isPingMessage,
  isPongMessage,
  createPingMessage,
  createPongMessage,
  calculateAverage,
} from "./heartbeat-handler";

// Heartbeat Handler Types (API-WS-007)
export type {
  HeartbeatMessageTypeValue,
  HeartbeatConfig,
  HeartbeatStats,
  HeartbeatEventTypeValue,
  HeartbeatEvent,
  PingSentEvent,
  PongReceivedEvent,
  PongTimeoutEvent,
  StaleDetectedEvent,
  HeartbeatFailureEvent,
  HeartbeatStartedEvent,
  HeartbeatStoppedEvent,
  HeartbeatEventUnion,
  HeartbeatEventListenerMap,
  SendFunction,
  ReconnectFunction,
  AttachHeartbeatOptions,
} from "./heartbeat-handler";

// Message Queue (API-WS-008)
export {
  MessageQueue,
  createMessageQueue,
  getSharedMessageQueue,
  setSharedMessageQueue,
  resetSharedMessageQueue,
  // Constants
  PRIORITY_VALUES,
  QueueEventType,
  // Utility functions
  createFilteredProcessor,
  createBatchProcessor,
  calculateQueueHealth,
} from "./message-queue";

// Message Queue Types (API-WS-008)
export type {
  MessagePriority,
  QueuedMessage,
  MessageProcessor,
  BackpressureStrategy,
  QueueState,
  MessageQueueConfig,
  QueueStats,
  QueueEventTypeValue,
  QueueEvent,
  MessageEnqueuedEvent,
  MessageProcessedEvent,
  MessageDroppedEvent,
  ProcessingErrorEvent,
  BackpressureStartEvent,
  BackpressureEndEvent,
  QueueEmptyEvent,
  QueueFullEvent,
  StateChangeEvent as QueueStateChangeEvent,
  BatchProcessedEvent,
  QueueEventUnion,
  QueueEventListenerMap,
  QueueLogger,
  EnqueueOptions,
  EnqueueResult,
} from "./message-queue";

// Multi-market Subscription Manager (API-WS-009)
export {
  MultiMarketSubscriptionManager,
  createMultiMarketSubscriptionManager,
  getSharedSubscriptionManager,
  setSharedSubscriptionManager,
  resetSharedSubscriptionManager,
  // Constants
  DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION,
  DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION,
  DEFAULT_BATCH_SIZE,
  DEFAULT_BATCH_DELAY,
  DEFAULT_SUBSCRIPTION_TIMEOUT,
  DEFAULT_STALE_SUBSCRIPTION_THRESHOLD,
  SubscriptionStatus,
  BatchOperationType,
  SubscriptionManagerEventType,
  // Utility functions
  calculateSubscriptionDistribution,
  mergeFilters,
  matchesFilter,
} from "./subscription-manager";

// Subscription Manager Types (API-WS-009)
export type {
  SubscriptionStatusValue,
  BatchOperationTypeValue,
  SubscriptionManagerEventTypeValue,
  ManagedSubscription,
  PendingOperation,
  BatchOperation,
  SubscriptionFilter,
  SubscriptionManagerConfig,
  SubscriptionManagerStats,
  SubscriptionHealth,
  SubscriptionManagerEvent,
  SubscriptionAddedEvent,
  SubscriptionRemovedEvent,
  SubscriptionConfirmedEvent as ManagerSubscriptionConfirmedEvent,
  SubscriptionErrorEvent as ManagerSubscriptionErrorEvent,
  SubscriptionStaleEvent,
  BatchSentEvent,
  BatchCompleteEvent,
  LimitReachedEvent,
  StatusChangedEvent as ManagerStatusChangedEvent,
  HealthUpdatedEvent,
  SubscriptionManagerEventUnion,
  SubscriptionManagerEventListenerMap,
  SendJsonFunction,
} from "./subscription-manager";

// WebSocket Event Emitter (API-WS-010)
export {
  WebSocketEventEmitter,
  createEventEmitter,
  getSharedEventEmitter,
  setSharedEventEmitter,
  resetSharedEventEmitter,
  // Constants
  EventCategory,
  EventPriority,
  WebSocketEventTypes,
  // Utility functions
  createFilteredListener,
  createDebouncedListener,
  createThrottledListener,
  createBatchingListener,
  createEventBuilder,
} from "./event-emitter";

// Event Emitter Types (API-WS-010)
export type {
  EventCategoryValue,
  EventPriorityValue,
  WebSocketEventTypeValue,
  BaseEvent,
  ConnectionOpenEventData,
  ConnectionCloseEventData,
  ConnectionErrorEventData,
  PriceUpdateEventData,
  TradeEventData,
  LargeTradeEventData,
  OrderBookUpdateEventData,
  HandlerErrorEventData,
  GenericEvent,
  WebSocketEvent as EmitterWebSocketEvent,
  EventListenerFn,
  EventFilter,
  ListenerOptions as EmitterListenerOptions,
  EventEmitterConfig,
  EventEmitterStats,
  EventEmitterLogger,
} from "./event-emitter";
