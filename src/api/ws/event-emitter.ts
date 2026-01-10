/**
 * WebSocket Event Emitter (API-WS-010)
 *
 * A typed event emitter for emitting parsed WebSocket events to an internal event bus.
 * Provides centralized event management for all WebSocket modules with:
 * - Strongly typed events with TypeScript generics
 * - Event filtering capabilities
 * - One-time event listeners
 * - Event listener management
 * - Event history tracking
 * - Error handling for listeners
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Event categories for filtering
 */
export const EventCategory = {
  /** Connection-related events */
  CONNECTION: "connection",
  /** Subscription-related events */
  SUBSCRIPTION: "subscription",
  /** Market data events */
  MARKET_DATA: "marketData",
  /** Trade events */
  TRADE: "trade",
  /** Order book events */
  ORDER_BOOK: "orderBook",
  /** System events (heartbeat, queue, etc.) */
  SYSTEM: "system",
  /** Error events */
  ERROR: "error",
} as const;

export type EventCategoryValue = (typeof EventCategory)[keyof typeof EventCategory];

/**
 * Event priority levels
 */
export const EventPriority = {
  /** Critical events that should be processed immediately */
  CRITICAL: 0,
  /** High priority events */
  HIGH: 1,
  /** Normal priority events */
  NORMAL: 2,
  /** Low priority events (can be delayed) */
  LOW: 3,
} as const;

export type EventPriorityValue = (typeof EventPriority)[keyof typeof EventPriority];

/**
 * Predefined event types for the WebSocket system
 */
export const WebSocketEventTypes = {
  // Connection events
  CONNECTION_OPEN: "ws:connection:open",
  CONNECTION_CLOSE: "ws:connection:close",
  CONNECTION_ERROR: "ws:connection:error",
  CONNECTION_RECONNECT: "ws:connection:reconnect",
  CONNECTION_STATE_CHANGE: "ws:connection:stateChange",

  // Subscription events
  SUBSCRIPTION_CONFIRMED: "ws:subscription:confirmed",
  SUBSCRIPTION_ERROR: "ws:subscription:error",
  SUBSCRIPTION_ADDED: "ws:subscription:added",
  SUBSCRIPTION_REMOVED: "ws:subscription:removed",

  // Market data events
  PRICE_UPDATE: "ws:market:priceUpdate",
  SIGNIFICANT_PRICE_CHANGE: "ws:market:significantChange",

  // Trade events
  TRADE: "ws:trade:trade",
  TRADE_BATCH: "ws:trade:batch",
  LARGE_TRADE: "ws:trade:large",

  // Order book events
  ORDER_BOOK_UPDATE: "ws:orderBook:update",
  ORDER_BOOK_SNAPSHOT: "ws:orderBook:snapshot",
  SPREAD_CHANGE: "ws:orderBook:spreadChange",
  BOOK_IMBALANCE: "ws:orderBook:imbalance",

  // System events
  HEARTBEAT_PING: "ws:system:ping",
  HEARTBEAT_PONG: "ws:system:pong",
  HEARTBEAT_TIMEOUT: "ws:system:heartbeatTimeout",
  QUEUE_BACKPRESSURE: "ws:system:backpressure",
  QUEUE_EMPTY: "ws:system:queueEmpty",

  // Error events
  PARSE_ERROR: "ws:error:parse",
  VALIDATION_ERROR: "ws:error:validation",
  HANDLER_ERROR: "ws:error:handler",
} as const;

export type WebSocketEventTypeValue =
  (typeof WebSocketEventTypes)[keyof typeof WebSocketEventTypes];

/**
 * Base event interface that all events extend
 */
export interface BaseEvent {
  /** Unique event ID */
  id: string;

  /** Event type */
  type: string;

  /** Event category for filtering */
  category: EventCategoryValue;

  /** Event priority */
  priority: EventPriorityValue;

  /** Event timestamp */
  timestamp: Date;

  /** Optional source identifier (connection ID, subscription ID, etc.) */
  source?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Connection open event
 */
export interface ConnectionOpenEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.CONNECTION_OPEN;
  category: typeof EventCategory.CONNECTION;
  url: string;
  connectionId: string;
}

/**
 * Connection close event
 */
export interface ConnectionCloseEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.CONNECTION_CLOSE;
  category: typeof EventCategory.CONNECTION;
  code: number;
  reason: string;
  wasClean: boolean;
  connectionId: string;
}

/**
 * Connection error event
 */
export interface ConnectionErrorEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.CONNECTION_ERROR;
  category: typeof EventCategory.ERROR;
  error: Error;
  message: string;
  connectionId: string;
}

/**
 * Price update event
 */
export interface PriceUpdateEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.PRICE_UPDATE;
  category: typeof EventCategory.MARKET_DATA;
  tokenId: string;
  price: number;
  previousPrice?: number;
  change?: number;
  changePercent?: number;
}

/**
 * Trade event
 */
export interface TradeEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.TRADE;
  category: typeof EventCategory.TRADE;
  tradeId: string;
  tokenId: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  maker?: string;
  taker?: string;
}

/**
 * Large trade event
 */
export interface LargeTradeEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.LARGE_TRADE;
  category: typeof EventCategory.TRADE;
  tradeId: string;
  tokenId: string;
  price: number;
  size: number;
  usdValue: number;
  side: "buy" | "sell";
  maker?: string;
  taker?: string;
}

/**
 * Order book update event
 */
export interface OrderBookUpdateEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.ORDER_BOOK_UPDATE;
  category: typeof EventCategory.ORDER_BOOK;
  tokenId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread?: number;
}

/**
 * Handler error event
 */
export interface HandlerErrorEventData extends BaseEvent {
  type: typeof WebSocketEventTypes.HANDLER_ERROR;
  category: typeof EventCategory.ERROR;
  handlerName: string;
  originalEvent: BaseEvent;
  error: Error;
}

/**
 * Generic event with any payload
 */
export interface GenericEvent extends BaseEvent {
  payload?: unknown;
}

/**
 * Union of all predefined event types
 */
export type WebSocketEvent =
  | ConnectionOpenEventData
  | ConnectionCloseEventData
  | ConnectionErrorEventData
  | PriceUpdateEventData
  | TradeEventData
  | LargeTradeEventData
  | OrderBookUpdateEventData
  | HandlerErrorEventData
  | GenericEvent;

/**
 * Event listener function type
 */
export type EventListenerFn<T extends BaseEvent = BaseEvent> = (event: T) => void | Promise<void>;

/**
 * Event filter function type
 */
export type EventFilter<T extends BaseEvent = BaseEvent> = (event: T) => boolean;

/**
 * Listener options
 */
export interface ListenerOptions {
  /** Only fire once then remove */
  once?: boolean;

  /** Filter function to selectively receive events */
  filter?: EventFilter;

  /** Priority for listener execution order (lower = higher priority) */
  priority?: number;

  /** Listener name for debugging */
  name?: string;
}

/**
 * Registered listener with metadata
 */
interface RegisteredListener<T extends BaseEvent = BaseEvent> {
  id: string;
  callback: EventListenerFn<T>;
  options: ListenerOptions;
  addedAt: Date;
  callCount: number;
}

/**
 * Event emitter configuration
 */
export interface EventEmitterConfig {
  /** Maximum number of listeners per event type (default: 100) */
  maxListenersPerEvent?: number;

  /** Enable event history tracking (default: false) */
  enableHistory?: boolean;

  /** Maximum history size (default: 1000) */
  maxHistorySize?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: EventEmitterLogger;

  /** Whether to catch and emit errors from handlers (default: true) */
  catchHandlerErrors?: boolean;

  /** Async listener execution timeout in ms (default: 5000) */
  asyncTimeout?: number;
}

/**
 * Event emitter statistics
 */
export interface EventEmitterStats {
  /** Total events emitted */
  totalEmitted: number;

  /** Events emitted per type */
  emittedByType: Map<string, number>;

  /** Events emitted per category */
  emittedByCategory: Map<EventCategoryValue, number>;

  /** Total listener calls */
  totalListenerCalls: number;

  /** Total listener errors */
  totalListenerErrors: number;

  /** Active listeners count */
  activeListenersCount: number;

  /** Listeners count per event type */
  listenersByType: Map<string, number>;

  /** Average emit time in ms */
  avgEmitTime: number;

  /** Maximum emit time in ms */
  maxEmitTime: number;

  /** History size (if enabled) */
  historySize: number;
}

/**
 * Logger interface for event emitter
 */
export interface EventEmitterLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// ============================================================================
// WebSocketEventEmitter Class
// ============================================================================

/**
 * A typed event emitter for WebSocket events
 *
 * @example
 * ```typescript
 * const emitter = new WebSocketEventEmitter();
 *
 * // Listen to specific event type
 * emitter.on(WebSocketEventTypes.PRICE_UPDATE, (event) => {
 *   console.log(`Price updated: ${event.tokenId} = ${event.price}`);
 * });
 *
 * // Listen with filter
 * emitter.on(WebSocketEventTypes.TRADE, (event) => {
 *   console.log(`Large trade: ${event.size}`);
 * }, { filter: (e) => e.size > 1000 });
 *
 * // Listen to all events in a category
 * emitter.onCategory(EventCategory.TRADE, (event) => {
 *   console.log(`Trade event: ${event.type}`);
 * });
 *
 * // Emit an event
 * emitter.emit({
 *   type: WebSocketEventTypes.PRICE_UPDATE,
 *   category: EventCategory.MARKET_DATA,
 *   tokenId: 'abc123',
 *   price: 0.75,
 * });
 * ```
 */
export class WebSocketEventEmitter {
  // Configuration
  private readonly config: Required<EventEmitterConfig>;

  // Listeners by event type
  private readonly typeListeners: Map<string, RegisteredListener[]> = new Map();

  // Listeners by category
  private readonly categoryListeners: Map<EventCategoryValue, RegisteredListener[]> = new Map();

  // Global listeners (receive all events)
  private readonly globalListeners: RegisteredListener[] = [];

  // Event history (if enabled)
  private readonly eventHistory: BaseEvent[] = [];

  // Statistics
  private totalEmitted = 0;
  private totalListenerCalls = 0;
  private totalListenerErrors = 0;
  private readonly emittedByType: Map<string, number> = new Map();
  private readonly emittedByCategory: Map<EventCategoryValue, number> = new Map();
  private totalEmitTime = 0;
  private maxEmitTime = 0;
  private emitCount = 0;

  // State
  private disposed = false;
  private listenerIdCounter = 0;

  // Logger
  private readonly logger: EventEmitterLogger;

  constructor(config: EventEmitterConfig = {}) {
    this.config = {
      maxListenersPerEvent: config.maxListenersPerEvent ?? 100,
      enableHistory: config.enableHistory ?? false,
      maxHistorySize: config.maxHistorySize ?? 1000,
      debug: config.debug ?? false,
      logger: config.logger ?? console,
      catchHandlerErrors: config.catchHandlerErrors ?? true,
      asyncTimeout: config.asyncTimeout ?? 5000,
    };

    this.logger = this.config.logger;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a unique listener ID
   */
  private generateListenerId(): string {
    return `lst_${++this.listenerIdCounter}`;
  }

  /**
   * Log debug message
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      this.logger.debug(`[EventEmitter] ${message}`, ...args);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit<T extends BaseEvent = BaseEvent>(
    eventOrPartial: T | (Omit<T, "id" | "timestamp"> & Record<string, unknown>)
  ): T {
    if (this.disposed) {
      throw new Error("EventEmitter has been disposed");
    }

    const startTime = Date.now();

    // Ensure event has id and timestamp
    const event = {
      ...eventOrPartial,
      id: (eventOrPartial as T).id ?? this.generateEventId(),
      timestamp: (eventOrPartial as T).timestamp ?? new Date(),
    } as T;

    this.debug(`Emitting event: ${event.type}`, event);

    // Track statistics
    this.totalEmitted++;
    this.emittedByType.set(event.type, (this.emittedByType.get(event.type) ?? 0) + 1);
    this.emittedByCategory.set(
      event.category,
      (this.emittedByCategory.get(event.category) ?? 0) + 1
    );

    // Add to history if enabled
    if (this.config.enableHistory) {
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.config.maxHistorySize) {
        this.eventHistory.shift();
      }
    }

    // Collect all applicable listeners
    const listenersToCall: RegisteredListener[] = [];

    // Add type-specific listeners
    const typeSpecific = this.typeListeners.get(event.type);
    if (typeSpecific) {
      listenersToCall.push(...typeSpecific);
    }

    // Add category listeners
    const categorySpecific = this.categoryListeners.get(event.category);
    if (categorySpecific) {
      listenersToCall.push(...categorySpecific);
    }

    // Add global listeners
    listenersToCall.push(...this.globalListeners);

    // Sort by priority (lower = higher priority)
    listenersToCall.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));

    // Remove duplicates (a listener might be in multiple lists)
    const uniqueListeners = new Map<string, RegisteredListener>();
    for (const listener of listenersToCall) {
      uniqueListeners.set(listener.id, listener);
    }

    // Execute listeners
    const listenersToRemove: { id: string; source: "type" | "category" | "global" }[] = [];

    for (const [, listener] of uniqueListeners) {
      // Apply filter if present
      if (listener.options.filter && !listener.options.filter(event)) {
        continue;
      }

      try {
        this.totalListenerCalls++;
        listener.callCount++;

        const result = listener.callback(event);

        // Handle async listeners
        if (result instanceof Promise) {
          this.handleAsyncListener(result, listener.id, event);
        }

        // Mark for removal if once
        if (listener.options.once) {
          // Determine which collection the listener belongs to
          if (this.typeListeners.get(event.type)?.some((l) => l.id === listener.id)) {
            listenersToRemove.push({ id: listener.id, source: "type" });
          } else if (
            this.categoryListeners.get(event.category)?.some((l) => l.id === listener.id)
          ) {
            listenersToRemove.push({ id: listener.id, source: "category" });
          } else if (this.globalListeners.some((l) => l.id === listener.id)) {
            listenersToRemove.push({ id: listener.id, source: "global" });
          }
        }
      } catch (error) {
        this.totalListenerErrors++;
        this.handleListenerError(listener, event, error as Error);
      }
    }

    // Remove once listeners
    for (const { id, source } of listenersToRemove) {
      this.removeListenerById(id, source, source === "type" ? event.type : undefined);
    }

    // Track emit time
    const emitTime = Date.now() - startTime;
    this.totalEmitTime += emitTime;
    this.emitCount++;
    if (emitTime > this.maxEmitTime) {
      this.maxEmitTime = emitTime;
    }

    return event;
  }

  /**
   * Handle async listener with timeout
   */
  private handleAsyncListener(
    promise: Promise<void>,
    listenerId: string,
    event: BaseEvent
  ): void {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Listener ${listenerId} timed out after ${this.config.asyncTimeout}ms`));
      }, this.config.asyncTimeout);
    });

    Promise.race([promise, timeoutPromise]).catch((error) => {
      this.totalListenerErrors++;
      this.logger.warn(`Async listener error for event ${event.type}:`, error);
    });
  }

  /**
   * Handle listener error
   */
  private handleListenerError(listener: RegisteredListener, event: BaseEvent, error: Error): void {
    const listenerName = listener.options.name ?? listener.id;
    this.logger.error(`Listener ${listenerName} error for event ${event.type}:`, error);

    if (this.config.catchHandlerErrors) {
      // Emit a handler error event (but don't recurse infinitely)
      if (event.type !== WebSocketEventTypes.HANDLER_ERROR) {
        try {
          this.emit<HandlerErrorEventData>({
            type: WebSocketEventTypes.HANDLER_ERROR,
            category: EventCategory.ERROR,
            priority: EventPriority.HIGH,
            handlerName: listenerName,
            originalEvent: event,
            error,
          });
        } catch {
          // Ignore errors from error handler
        }
      }
    }
  }

  /**
   * Register a listener for a specific event type
   */
  on<T extends BaseEvent = BaseEvent>(
    eventType: string,
    callback: EventListenerFn<T>,
    options: ListenerOptions = {}
  ): () => void {
    if (this.disposed) {
      throw new Error("EventEmitter has been disposed");
    }

    const listeners = this.typeListeners.get(eventType) ?? [];

    if (listeners.length >= this.config.maxListenersPerEvent) {
      this.logger.warn(
        `Max listeners (${this.config.maxListenersPerEvent}) reached for event type: ${eventType}`
      );
      throw new Error(`Max listeners reached for event type: ${eventType}`);
    }

    const listener: RegisteredListener<T> = {
      id: this.generateListenerId(),
      callback,
      options,
      addedAt: new Date(),
      callCount: 0,
    };

    listeners.push(listener as RegisteredListener);
    this.typeListeners.set(eventType, listeners);

    this.debug(`Added listener ${listener.id} for event type: ${eventType}`);

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Register a listener for all events in a category
   */
  onCategory<T extends BaseEvent = BaseEvent>(
    category: EventCategoryValue,
    callback: EventListenerFn<T>,
    options: ListenerOptions = {}
  ): () => void {
    if (this.disposed) {
      throw new Error("EventEmitter has been disposed");
    }

    const listeners = this.categoryListeners.get(category) ?? [];

    if (listeners.length >= this.config.maxListenersPerEvent) {
      this.logger.warn(
        `Max listeners (${this.config.maxListenersPerEvent}) reached for category: ${category}`
      );
      throw new Error(`Max listeners reached for category: ${category}`);
    }

    const listener: RegisteredListener<T> = {
      id: this.generateListenerId(),
      callback,
      options,
      addedAt: new Date(),
      callCount: 0,
    };

    listeners.push(listener as RegisteredListener);
    this.categoryListeners.set(category, listeners);

    this.debug(`Added listener ${listener.id} for category: ${category}`);

    // Return unsubscribe function
    return () => this.offCategory(category, callback);
  }

  /**
   * Register a global listener for all events
   */
  onAll<T extends BaseEvent = BaseEvent>(
    callback: EventListenerFn<T>,
    options: ListenerOptions = {}
  ): () => void {
    if (this.disposed) {
      throw new Error("EventEmitter has been disposed");
    }

    if (this.globalListeners.length >= this.config.maxListenersPerEvent) {
      this.logger.warn(
        `Max global listeners (${this.config.maxListenersPerEvent}) reached`
      );
      throw new Error("Max global listeners reached");
    }

    const listener: RegisteredListener<T> = {
      id: this.generateListenerId(),
      callback,
      options,
      addedAt: new Date(),
      callCount: 0,
    };

    this.globalListeners.push(listener as RegisteredListener);

    this.debug(`Added global listener ${listener.id}`);

    // Return unsubscribe function
    return () => this.offAll(callback);
  }

  /**
   * Register a one-time listener for a specific event type
   */
  once<T extends BaseEvent = BaseEvent>(
    eventType: string,
    callback: EventListenerFn<T>,
    options: Omit<ListenerOptions, "once"> = {}
  ): () => void {
    return this.on(eventType, callback, { ...options, once: true });
  }

  /**
   * Remove a listener for a specific event type
   */
  off<T extends BaseEvent = BaseEvent>(eventType: string, callback: EventListenerFn<T>): boolean {
    const listeners = this.typeListeners.get(eventType);
    if (!listeners) {
      return false;
    }

    const index = listeners.findIndex((l) => l.callback === callback);
    if (index === -1) {
      return false;
    }

    listeners.splice(index, 1);
    this.debug(`Removed listener for event type: ${eventType}`);
    return true;
  }

  /**
   * Remove a listener for a category
   */
  offCategory<T extends BaseEvent = BaseEvent>(
    category: EventCategoryValue,
    callback: EventListenerFn<T>
  ): boolean {
    const listeners = this.categoryListeners.get(category);
    if (!listeners) {
      return false;
    }

    const index = listeners.findIndex((l) => l.callback === callback);
    if (index === -1) {
      return false;
    }

    listeners.splice(index, 1);
    this.debug(`Removed listener for category: ${category}`);
    return true;
  }

  /**
   * Remove a global listener
   */
  offAll<T extends BaseEvent = BaseEvent>(callback: EventListenerFn<T>): boolean {
    const index = this.globalListeners.findIndex((l) => l.callback === callback);
    if (index === -1) {
      return false;
    }

    this.globalListeners.splice(index, 1);
    this.debug("Removed global listener");
    return true;
  }

  /**
   * Remove a listener by ID
   */
  private removeListenerById(
    id: string,
    source: "type" | "category" | "global",
    eventType?: string
  ): void {
    if (source === "type" && eventType) {
      const listeners = this.typeListeners.get(eventType);
      if (listeners) {
        const index = listeners.findIndex((l) => l.id === id);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    } else if (source === "category") {
      for (const [, listeners] of this.categoryListeners) {
        const index = listeners.findIndex((l) => l.id === id);
        if (index !== -1) {
          listeners.splice(index, 1);
          return;
        }
      }
    } else if (source === "global") {
      const index = this.globalListeners.findIndex((l) => l.id === id);
      if (index !== -1) {
        this.globalListeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.typeListeners.delete(eventType);
      this.debug(`Removed all listeners for event type: ${eventType}`);
    } else {
      this.typeListeners.clear();
      this.categoryListeners.clear();
      this.globalListeners.length = 0;
      this.debug("Removed all listeners");
    }
  }

  /**
   * Get listener count for a specific event type
   */
  listenerCount(eventType?: string): number {
    if (eventType) {
      return this.typeListeners.get(eventType)?.length ?? 0;
    }

    let count = 0;
    for (const [, listeners] of this.typeListeners) {
      count += listeners.length;
    }
    for (const [, listeners] of this.categoryListeners) {
      count += listeners.length;
    }
    count += this.globalListeners.length;
    return count;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): string[] {
    return Array.from(this.typeListeners.keys());
  }

  /**
   * Check if there are listeners for an event type
   */
  hasListeners(eventType: string): boolean {
    const typeListeners = this.typeListeners.get(eventType);
    return (typeListeners?.length ?? 0) > 0 || this.globalListeners.length > 0;
  }

  /**
   * Get event history (if enabled)
   */
  getHistory(): readonly BaseEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events from history by type
   */
  getHistoryByType(eventType: string): BaseEvent[] {
    return this.eventHistory.filter((e) => e.type === eventType);
  }

  /**
   * Get events from history by category
   */
  getHistoryByCategory(category: EventCategoryValue): BaseEvent[] {
    return this.eventHistory.filter((e) => e.category === category);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Get emitter statistics
   */
  getStats(): EventEmitterStats {
    return {
      totalEmitted: this.totalEmitted,
      emittedByType: new Map(this.emittedByType),
      emittedByCategory: new Map(this.emittedByCategory),
      totalListenerCalls: this.totalListenerCalls,
      totalListenerErrors: this.totalListenerErrors,
      activeListenersCount: this.listenerCount(),
      listenersByType: new Map(
        Array.from(this.typeListeners.entries()).map(([type, listeners]) => [
          type,
          listeners.length,
        ])
      ),
      avgEmitTime: this.emitCount > 0 ? this.totalEmitTime / this.emitCount : 0,
      maxEmitTime: this.maxEmitTime,
      historySize: this.eventHistory.length,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalEmitted = 0;
    this.totalListenerCalls = 0;
    this.totalListenerErrors = 0;
    this.emittedByType.clear();
    this.emittedByCategory.clear();
    this.totalEmitTime = 0;
    this.maxEmitTime = 0;
    this.emitCount = 0;
  }

  /**
   * Check if the emitter is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the event emitter and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.typeListeners.clear();
    this.categoryListeners.clear();
    this.globalListeners.length = 0;
    this.eventHistory.length = 0;

    this.debug("EventEmitter disposed");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new WebSocket event emitter
 */
export function createEventEmitter(config?: EventEmitterConfig): WebSocketEventEmitter {
  return new WebSocketEventEmitter(config);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedEmitter: WebSocketEventEmitter | null = null;

/**
 * Get the shared event emitter instance
 */
export function getSharedEventEmitter(): WebSocketEventEmitter {
  if (!sharedEmitter) {
    sharedEmitter = createEventEmitter();
  }
  return sharedEmitter;
}

/**
 * Set the shared event emitter instance
 */
export function setSharedEventEmitter(emitter: WebSocketEventEmitter): void {
  sharedEmitter = emitter;
}

/**
 * Reset the shared event emitter instance
 */
export function resetSharedEventEmitter(): void {
  if (sharedEmitter) {
    sharedEmitter.dispose();
  }
  sharedEmitter = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a filtered event listener that only receives events matching a filter
 */
export function createFilteredListener<T extends BaseEvent>(
  callback: EventListenerFn<T>,
  filter: EventFilter<T>
): EventListenerFn<T> {
  return (event: T) => {
    if (filter(event)) {
      return callback(event);
    }
  };
}

/**
 * Create a debounced event listener
 */
export function createDebouncedListener<T extends BaseEvent>(
  callback: EventListenerFn<T>,
  delayMs: number
): EventListenerFn<T> & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let latestEvent: T | null = null;

  const listener = ((event: T) => {
    latestEvent = event;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (latestEvent) {
        callback(latestEvent);
      }
      timeoutId = null;
    }, delayMs);
  }) as EventListenerFn<T> & { cancel: () => void };

  listener.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return listener;
}

/**
 * Create a throttled event listener
 */
export function createThrottledListener<T extends BaseEvent>(
  callback: EventListenerFn<T>,
  intervalMs: number
): EventListenerFn<T> {
  let lastCall = 0;

  return (event: T) => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      return callback(event);
    }
  };
}

/**
 * Create a batching event listener that collects events and calls the callback with batches
 */
export function createBatchingListener<T extends BaseEvent>(
  callback: (events: T[]) => void | Promise<void>,
  options: {
    maxBatchSize?: number;
    maxWaitMs?: number;
  } = {}
): EventListenerFn<T> & { flush: () => void } {
  const { maxBatchSize = 100, maxWaitMs = 100 } = options;
  const batch: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (batch.length > 0) {
      const events = [...batch];
      batch.length = 0;
      callback(events);
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const listener = ((event: T) => {
    batch.push(event);

    if (batch.length >= maxBatchSize) {
      flush();
    } else if (!timeoutId) {
      timeoutId = setTimeout(flush, maxWaitMs);
    }
  }) as EventListenerFn<T> & { flush: () => void };

  listener.flush = flush;

  return listener;
}

/**
 * Create a type-safe event builder for a specific event type
 */
export function createEventBuilder<T extends BaseEvent>(
  defaults: Pick<T, "type" | "category"> & Partial<Omit<T, "type" | "category">>
): (data: Omit<T, "type" | "category" | "id" | "timestamp" | "priority"> & { priority?: EventPriorityValue }) => Omit<T, "id" | "timestamp"> {
  return (data) => ({
    ...defaults,
    priority: data.priority ?? defaults.priority ?? EventPriority.NORMAL,
    ...data,
  }) as Omit<T, "id" | "timestamp">;
}
