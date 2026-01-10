/**
 * WebSocket Auto-Reconnection Module (API-WS-002)
 *
 * Provides enhanced auto-reconnection with:
 * - Disconnection detection
 * - Exponential backoff (reuses connection-manager implementation)
 * - Subscription restoration after reconnect
 * - Reconnection events
 */

import {
  WebSocketConnection,
  createWebSocketConnection,
  CloseCode,
} from "./connection-manager";
import type {
  WebSocketConfig,
  ConnectionState,
  WebSocketLogger,
  WebSocketConstructor,
  ConnectionOpenEvent,
  ConnectionCloseEvent,
  ReconnectEvent,
} from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Subscription information for restoration
 */
export interface Subscription {
  /** Unique subscription ID */
  id: string;

  /** Subscription channel/topic */
  channel: string;

  /** Original subscription message */
  message: unknown;

  /** When the subscription was created */
  createdAt: Date;

  /** Whether the subscription is currently active */
  active: boolean;

  /** Subscription metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Subscription event when a subscription is restored
 */
export interface SubscriptionRestoredEvent {
  type: "subscriptionRestored";
  connectionId: string;
  timestamp: Date;
  subscriptionId: string;
  channel: string;
  success: boolean;
  error?: Error;
}

/**
 * All subscriptions restored event
 */
export interface SubscriptionsRestoredEvent {
  type: "subscriptionsRestored";
  connectionId: string;
  timestamp: Date;
  total: number;
  successful: number;
  failed: number;
  subscriptions: Array<{
    id: string;
    channel: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
  /** Whether to automatically reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;

  /** Initial reconnection delay in milliseconds (default: 1000) */
  reconnectDelay?: number;

  /** Maximum reconnection delay in milliseconds (default: 30000) */
  maxReconnectDelay?: number;

  /** Reconnection backoff multiplier (default: 2) */
  reconnectBackoffMultiplier?: number;

  /** Whether to restore subscriptions after reconnect (default: true) */
  restoreSubscriptions?: boolean;

  /** Delay after reconnect before restoring subscriptions (default: 100ms) */
  subscriptionRestoreDelay?: number;

  /** Timeout for subscription restoration (default: 5000ms) */
  subscriptionRestoreTimeout?: number;
}

/**
 * Extended connection configuration with reconnection options
 */
export interface ReconnectableConnectionConfig extends WebSocketConfig {
  /** Reconnection configuration */
  reconnectConfig?: ReconnectConfig;
}

/**
 * Reconnection state information
 */
export interface ReconnectionState {
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;

  /** Current reconnection attempt number */
  attempt: number;

  /** Total reconnection attempts since last successful connect */
  totalAttempts: number;

  /** Last reconnection timestamp */
  lastReconnectAt?: Date;

  /** Last successful reconnection timestamp */
  lastSuccessfulReconnectAt?: Date;

  /** Next reconnection delay in milliseconds */
  nextDelay: number;

  /** Whether max attempts have been exhausted */
  exhausted: boolean;
}

/**
 * Event listener map with subscription events
 */
export interface ReconnectEventListenerMap {
  open: ((event: ConnectionOpenEvent) => void)[];
  close: ((event: ConnectionCloseEvent) => void)[];
  error: ((event: { type: "error"; connectionId: string; timestamp: Date; error: Error; message: string }) => void)[];
  message: ((event: { type: "message"; connectionId: string; timestamp: Date; data: string | ArrayBuffer | Blob; json?: unknown }) => void)[];
  reconnect: ((event: ReconnectEvent) => void)[];
  stateChange: ((event: { type: "stateChange"; connectionId: string; timestamp: Date; previousState: ConnectionState; currentState: ConnectionState; reason?: string }) => void)[];
  subscriptionRestored: ((event: SubscriptionRestoredEvent) => void)[];
  subscriptionsRestored: ((event: SubscriptionsRestoredEvent) => void)[];
  reconnectExhausted: ((event: { type: "reconnectExhausted"; connectionId: string; timestamp: Date; attempts: number }) => void)[];
}

type ReconnectEventKey = keyof ReconnectEventListenerMap;

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger: WebSocketLogger = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ============================================================================
// ReconnectableConnection Class
// ============================================================================

/**
 * WebSocket connection with enhanced auto-reconnection and subscription restoration
 */
export class ReconnectableConnection {
  private connection: WebSocketConnection;
  private readonly config: Required<ReconnectConfig>;
  private readonly logger: WebSocketLogger;

  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectionState: ReconnectionState;
  private disposed = false;

  private readonly listeners: ReconnectEventListenerMap = {
    open: [],
    close: [],
    error: [],
    message: [],
    reconnect: [],
    stateChange: [],
    subscriptionRestored: [],
    subscriptionsRestored: [],
    reconnectExhausted: [],
  };

  constructor(
    connectionConfig: ReconnectableConnectionConfig,
    logger: WebSocketLogger = defaultLogger,
    WebSocketClass?: WebSocketConstructor
  ) {
    this.logger = logger;

    const reconnectConfig = connectionConfig.reconnectConfig ?? {};
    this.config = {
      autoReconnect: reconnectConfig.autoReconnect ?? true,
      maxReconnectAttempts: reconnectConfig.maxReconnectAttempts ?? 10,
      reconnectDelay: reconnectConfig.reconnectDelay ?? 1000,
      maxReconnectDelay: reconnectConfig.maxReconnectDelay ?? 30000,
      reconnectBackoffMultiplier: reconnectConfig.reconnectBackoffMultiplier ?? 2,
      restoreSubscriptions: reconnectConfig.restoreSubscriptions ?? true,
      subscriptionRestoreDelay: reconnectConfig.subscriptionRestoreDelay ?? 100,
      subscriptionRestoreTimeout: reconnectConfig.subscriptionRestoreTimeout ?? 5000,
    };

    this.reconnectionState = {
      isReconnecting: false,
      attempt: 0,
      totalAttempts: 0,
      nextDelay: this.config.reconnectDelay,
      exhausted: false,
    };

    // Create underlying connection with config
    this.connection = createWebSocketConnection(
      {
        ...connectionConfig,
        autoReconnect: this.config.autoReconnect,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        reconnectDelay: this.config.reconnectDelay,
        maxReconnectDelay: this.config.maxReconnectDelay,
        reconnectBackoffMultiplier: this.config.reconnectBackoffMultiplier,
      },
      logger,
      WebSocketClass
    );

    this.setupEventProxying();
  }

  // ==========================================================================
  // Event Proxying
  // ==========================================================================

  private setupEventProxying(): void {
    // Proxy all events from underlying connection
    this.connection.on("open", (event) => {
      this.reconnectionState.isReconnecting = false;
      this.reconnectionState.attempt = 0;
      this.reconnectionState.exhausted = false;

      if (this.reconnectionState.totalAttempts > 0) {
        this.reconnectionState.lastSuccessfulReconnectAt = new Date();
      }

      this.emit("open", event);

      // Restore subscriptions after successful reconnect
      if (this.config.restoreSubscriptions && this.reconnectionState.totalAttempts > 0) {
        setTimeout(() => {
          this.restoreSubscriptions();
        }, this.config.subscriptionRestoreDelay);
      }
    });

    this.connection.on("close", (event) => {
      this.emit("close", event);
    });

    this.connection.on("error", (event) => {
      this.emit("error", event);
    });

    this.connection.on("message", (event) => {
      this.emit("message", event);
    });

    this.connection.on("reconnect", (event) => {
      this.reconnectionState.isReconnecting = true;
      this.reconnectionState.attempt = event.attempt;
      this.reconnectionState.totalAttempts++;
      this.reconnectionState.lastReconnectAt = new Date();
      this.reconnectionState.nextDelay = event.delay;

      // Check if exhausted
      if (event.attempt >= event.maxAttempts) {
        this.reconnectionState.exhausted = true;
        this.emit("reconnectExhausted", {
          type: "reconnectExhausted",
          connectionId: this.connection.getId(),
          timestamp: new Date(),
          attempts: event.attempt,
        });
      }

      this.emit("reconnect", event);
    });

    this.connection.on("stateChange", (event) => {
      this.emit("stateChange", event);
    });
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Connection has been disposed");
    }
    return this.connection.connect();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(code: number = CloseCode.NORMAL, reason: string = "Client disconnect"): void {
    this.connection.disconnect(code, reason);
  }

  /**
   * Send a message through the WebSocket
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): boolean {
    return this.connection.send(data);
  }

  /**
   * Send a JSON message
   */
  sendJson(data: unknown): boolean {
    return this.connection.sendJson(data);
  }

  /**
   * Get connection ID
   */
  getId(): string {
    return this.connection.getId();
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connection.getState();
  }

  /**
   * Check if connection is open
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Get connection info
   */
  getInfo() {
    return this.connection.getInfo();
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return this.connection.getStats();
  }

  // ==========================================================================
  // Reconnection Management
  // ==========================================================================

  /**
   * Get current reconnection state
   */
  getReconnectionState(): Readonly<ReconnectionState> {
    return { ...this.reconnectionState };
  }

  /**
   * Reset reconnection attempts counter
   */
  resetReconnectionAttempts(): void {
    this.reconnectionState.attempt = 0;
    this.reconnectionState.totalAttempts = 0;
    this.reconnectionState.exhausted = false;
    this.reconnectionState.nextDelay = this.config.reconnectDelay;
  }

  /**
   * Force a reconnection attempt
   */
  async forceReconnect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Connection has been disposed");
    }

    if (this.isConnected()) {
      this.disconnect(CloseCode.NORMAL, "Force reconnect");
    }

    // Reset state for forced reconnect
    this.reconnectionState.exhausted = false;

    return this.connect();
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Add a subscription to track for restoration
   */
  addSubscription(
    id: string,
    channel: string,
    message: unknown,
    metadata?: Record<string, unknown>
  ): Subscription {
    const subscription: Subscription = {
      id,
      channel,
      message,
      createdAt: new Date(),
      active: this.isConnected(),
      metadata,
    };

    this.subscriptions.set(id, subscription);
    this.logger.debug(`[${this.getId()}] Added subscription: ${id} (${channel})`);

    return subscription;
  }

  /**
   * Remove a subscription from tracking
   */
  removeSubscription(id: string): boolean {
    const removed = this.subscriptions.delete(id);
    if (removed) {
      this.logger.debug(`[${this.getId()}] Removed subscription: ${id}`);
    }
    return removed;
  }

  /**
   * Get a subscription by ID
   */
  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscriptions by channel
   */
  getSubscriptionsByChannel(channel: string): Subscription[] {
    return this.getAllSubscriptions().filter((sub) => sub.channel === channel);
  }

  /**
   * Check if a subscription exists
   */
  hasSubscription(id: string): boolean {
    return this.subscriptions.has(id);
  }

  /**
   * Get number of subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.logger.debug(`[${this.getId()}] Cleared all subscriptions`);
  }

  /**
   * Restore all subscriptions after reconnect
   */
  async restoreSubscriptions(): Promise<SubscriptionsRestoredEvent> {
    const results: SubscriptionsRestoredEvent["subscriptions"] = [];
    let successful = 0;
    let failed = 0;

    this.logger.info(`[${this.getId()}] Restoring ${this.subscriptions.size} subscriptions`);

    for (const [id, subscription] of this.subscriptions) {
      try {
        // Send the subscription message
        const sent = this.sendJson(subscription.message);

        if (sent) {
          subscription.active = true;
          successful++;
          results.push({ id, channel: subscription.channel, success: true });

          this.emit("subscriptionRestored", {
            type: "subscriptionRestored",
            connectionId: this.getId(),
            timestamp: new Date(),
            subscriptionId: id,
            channel: subscription.channel,
            success: true,
          });
        } else {
          throw new Error("Failed to send subscription message");
        }
      } catch (error) {
        subscription.active = false;
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ id, channel: subscription.channel, success: false, error: errorMessage });

        this.emit("subscriptionRestored", {
          type: "subscriptionRestored",
          connectionId: this.getId(),
          timestamp: new Date(),
          subscriptionId: id,
          channel: subscription.channel,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const event: SubscriptionsRestoredEvent = {
      type: "subscriptionsRestored",
      connectionId: this.getId(),
      timestamp: new Date(),
      total: this.subscriptions.size,
      successful,
      failed,
      subscriptions: results,
    };

    this.emit("subscriptionsRestored", event);
    this.logger.info(
      `[${this.getId()}] Subscription restoration complete: ${successful}/${this.subscriptions.size} successful`
    );

    return event;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<K extends ReconnectEventKey>(
    event: K,
    listener: ReconnectEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends ReconnectEventKey>(
    event: K,
    listener: ReconnectEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends ReconnectEventKey>(
    event: K,
    listener: ReconnectEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as ReconnectEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as ReconnectEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: ReconnectEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as ReconnectEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  private emit<K extends ReconnectEventKey>(
    event: K,
    data: Parameters<ReconnectEventListenerMap[K][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`[${this.getId()}] Error in ${event} listener:`, error);
      }
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of the connection and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.connection.dispose();
    this.subscriptions.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new reconnectable WebSocket connection
 */
export function createReconnectableConnection(
  config: ReconnectableConnectionConfig,
  logger?: WebSocketLogger,
  WebSocketClass?: WebSocketConstructor
): ReconnectableConnection {
  return new ReconnectableConnection(config, logger, WebSocketClass);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 2
): number {
  const delay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate delay with jitter to prevent thundering herd
 */
export function calculateBackoffDelayWithJitter(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 2,
  jitterFactor: number = 0.2
): number {
  const baseBackoff = calculateBackoffDelay(attempt, baseDelay, maxDelay, multiplier);
  const jitter = baseBackoff * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.min(baseBackoff + jitter, maxDelay));
}

/**
 * Check if a close code indicates an abnormal closure that should trigger reconnection
 */
export function shouldReconnectOnClose(code: number, wasClean: boolean): boolean {
  // Don't reconnect on clean/normal closures
  if (wasClean || code === CloseCode.NORMAL) {
    return false;
  }

  // Don't reconnect on certain client error codes
  const noReconnectCodes: number[] = [
    CloseCode.PROTOCOL_ERROR,
    CloseCode.UNSUPPORTED_DATA,
    CloseCode.INVALID_PAYLOAD,
    CloseCode.POLICY_VIOLATION,
    CloseCode.MESSAGE_TOO_BIG,
    CloseCode.MISSING_EXTENSION,
  ];

  if (noReconnectCodes.includes(code)) {
    return false;
  }

  // Reconnect on all other codes (abnormal, server errors, etc.)
  return true;
}

/**
 * Determine the appropriate reconnect delay based on the close code
 */
export function getReconnectDelayForCloseCode(
  code: number,
  baseDelay: number = 1000
): number {
  switch (code) {
    case CloseCode.SERVICE_RESTART:
    case CloseCode.TRY_AGAIN_LATER:
      // Server explicitly asking us to wait
      return baseDelay * 5;

    case CloseCode.INTERNAL_ERROR:
    case CloseCode.BAD_GATEWAY:
      // Server errors - give it some time to recover
      return baseDelay * 3;

    case CloseCode.ABNORMAL:
      // Network issue - standard delay
      return baseDelay;

    default:
      return baseDelay;
  }
}
