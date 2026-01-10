/**
 * WebSocket Connection Manager for Polymarket API (API-WS-001)
 *
 * Provides a robust WebSocket connection manager with:
 * - Connection lifecycle management
 * - Multiple connection support
 * - Event emission for connection events
 * - Automatic reconnection with exponential backoff
 * - Ping/pong heartbeat support
 */

import {
  ConnectionState,
  WebSocketConfig,
  WebSocketManagerConfig,
  EventListenerMap,
  ListenerOptions,
  ConnectionStats,
  ConnectionInfo,
  WebSocketLogger,
  IWebSocket,
  WebSocketConstructor,
  WebSocketReadyState,
  CloseCode,
} from "./types";

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_CONNECTION_TIMEOUT = 30000;
const DEFAULT_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_DELAY = 30000;
const DEFAULT_RECONNECT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_PING_INTERVAL = 30000;
const DEFAULT_PONG_TIMEOUT = 10000;
const DEFAULT_MAX_CONNECTIONS = 10;

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger: WebSocketLogger = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const debugLogger: WebSocketLogger = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ============================================================================
// WebSocket Connection Class
// ============================================================================

/**
 * Represents a single WebSocket connection with full lifecycle management
 */
/**
 * Internal config type with all required fields except protocols
 */
type InternalWebSocketConfig = Required<Omit<WebSocketConfig, "protocols">> & {
  protocols?: string | string[];
};

export class WebSocketConnection {
  private readonly id: string;
  private readonly config: InternalWebSocketConfig;
  private readonly logger: WebSocketLogger;
  private readonly WebSocketClass: WebSocketConstructor;

  private socket: IWebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private stats: ConnectionStats;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPong = false;

  private readonly createdAt: Date;
  private connectedAt?: Date;
  private disconnectedAt?: Date;
  private lastError?: Error;

  private readonly listeners: EventListenerMap = {
    open: [],
    close: [],
    error: [],
    message: [],
    reconnect: [],
    stateChange: [],
  };

  constructor(
    config: WebSocketConfig,
    logger: WebSocketLogger = defaultLogger,
    WebSocketClass?: WebSocketConstructor
  ) {
    this.id = config.id ?? generateConnectionId();
    this.config = {
      url: config.url,
      id: this.id,
      protocols: config.protocols,
      connectionTimeout: config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: config.reconnectDelay ?? DEFAULT_RECONNECT_DELAY,
      maxReconnectDelay: config.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY,
      reconnectBackoffMultiplier: config.reconnectBackoffMultiplier ?? DEFAULT_RECONNECT_BACKOFF_MULTIPLIER,
      pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
      pongTimeout: config.pongTimeout ?? DEFAULT_PONG_TIMEOUT,
      headers: config.headers ?? {},
      debug: config.debug ?? false,
    };

    this.logger = config.debug ? debugLogger : logger;
    this.WebSocketClass = WebSocketClass ?? (typeof WebSocket !== "undefined" ? WebSocket : null!);
    this.createdAt = new Date();

    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      uptime: 0,
      reconnectAttempts: 0,
    };
  }

  // ==========================================================================
  // Public Properties
  // ==========================================================================

  /**
   * Get connection ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection URL
   */
  getUrl(): string {
    return this.config.url;
  }

  /**
   * Get connection configuration
   */
  getConfig(): Readonly<WebSocketConfig> {
    return { ...this.config };
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      uptime: this.connectedAt ? Date.now() - this.connectedAt.getTime() : 0,
    };
  }

  /**
   * Get full connection info
   */
  getInfo(): ConnectionInfo {
    return {
      id: this.id,
      url: this.config.url,
      state: this.state,
      config: this.getConfig(),
      stats: this.getStats(),
      createdAt: this.createdAt,
      connectedAt: this.connectedAt,
      disconnectedAt: this.disconnectedAt,
      lastError: this.lastError,
    };
  }

  /**
   * Check if connection is open
   */
  isConnected(): boolean {
    return this.state === "connected" && this.socket?.readyState === WebSocketReadyState.OPEN;
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === "connecting" || this.state === "connected") {
      this.logger.debug(`[${this.id}] Already ${this.state}`);
      return;
    }

    this.setState("connecting", "Initiating connection");
    this.clearTimers();

    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.WebSocketClass) {
          throw new Error("WebSocket is not available in this environment");
        }

        this.socket = new this.WebSocketClass(this.config.url, this.config.protocols);

        // Set up connection timeout
        this.connectionTimer = setTimeout(() => {
          const error = new Error(`Connection timeout after ${this.config.connectionTimeout}ms`);
          this.handleError(error);
          reject(error);
        }, this.config.connectionTimeout);

        // Handle open event
        this.socket.onopen = () => {
          this.clearConnectionTimer();
          this.connectedAt = new Date();
          this.reconnectAttempts = 0;
          this.setState("connected", "Connection established");

          this.emit("open", {
            type: "open",
            connectionId: this.id,
            timestamp: new Date(),
            url: this.config.url,
          });

          this.startPingInterval();
          resolve();
        };

        // Handle close event
        this.socket.onclose = (event: CloseEvent) => {
          this.clearTimers();
          this.disconnectedAt = new Date();

          const wasConnected = this.state === "connected";
          this.setState("disconnected", `Connection closed: ${event.reason || "No reason"}`);

          this.emit("close", {
            type: "close",
            connectionId: this.id,
            timestamp: new Date(),
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          // Auto reconnect if enabled and not a clean close
          if (
            wasConnected &&
            this.config.autoReconnect &&
            !event.wasClean &&
            event.code !== CloseCode.NORMAL
          ) {
            this.scheduleReconnect();
          }
        };

        // Handle error event
        this.socket.onerror = () => {
          const error = new Error("WebSocket error");
          // Save state before handleError changes it
          const wasConnecting = this.state === "connecting";
          this.handleError(error);

          // Only reject if we were connecting
          if (wasConnecting) {
            this.clearConnectionTimer();
            reject(error);
          }
        };

        // Handle message event
        this.socket.onmessage = (event: globalThis.MessageEvent) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.clearConnectionTimer();
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleError(err);
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(code: number = CloseCode.NORMAL, reason: string = "Client disconnect"): void {
    if (this.state === "disconnected" || this.state === "disconnecting") {
      return;
    }

    this.setState("disconnecting", reason);
    this.clearTimers();

    if (this.socket && this.socket.readyState !== WebSocketReadyState.CLOSED) {
      try {
        this.socket.close(code, reason);
      } catch (error) {
        this.logger.warn(`[${this.id}] Error closing socket:`, error);
      }
    }

    this.socket = null;
    this.setState("disconnected", reason);
  }

  /**
   * Send a message through the WebSocket
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): boolean {
    if (!this.isConnected() || !this.socket) {
      this.logger.warn(`[${this.id}] Cannot send: not connected`);
      return false;
    }

    try {
      this.socket.send(data);
      this.stats.messagesSent++;
      this.stats.lastMessageSent = new Date();

      if (typeof data === "string") {
        this.stats.bytesSent += data.length;
      } else if (data instanceof ArrayBuffer) {
        this.stats.bytesSent += data.byteLength;
      } else if (data instanceof Blob) {
        this.stats.bytesSent += data.size;
      }

      return true;
    } catch (error) {
      this.logger.error(`[${this.id}] Send error:`, error);
      return false;
    }
  }

  /**
   * Send a JSON message
   */
  sendJson(data: unknown): boolean {
    try {
      const json = JSON.stringify(data);
      return this.send(json);
    } catch (error) {
      this.logger.error(`[${this.id}] JSON serialization error:`, error);
      return false;
    }
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<T extends keyof EventListenerMap>(
    event: T,
    listener: EventListenerMap[T][number],
    options?: ListenerOptions
  ): () => void {
    const wrappedListener = options?.once
      ? ((e: Parameters<EventListenerMap[T][number]>[0]) => {
          this.off(event, wrappedListener as EventListenerMap[T][number]);
          (listener as (e: Parameters<EventListenerMap[T][number]>[0]) => void)(e);
        }) as EventListenerMap[T][number]
      : listener;

    this.listeners[event].push(wrappedListener as never);

    // Return unsubscribe function
    return () => this.off(event, wrappedListener);
  }

  /**
   * Remove an event listener
   */
  off<T extends keyof EventListenerMap>(event: T, listener: EventListenerMap[T][number]): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<T extends keyof EventListenerMap>(
    event: T,
    listener: EventListenerMap[T][number]
  ): () => void {
    return this.on(event, listener, { once: true });
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: keyof EventListenerMap): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as Array<keyof EventListenerMap>) {
        this.listeners[key] = [];
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
    this.disconnect(CloseCode.GOING_AWAY, "Connection disposed");
    this.removeAllListeners();
    this.clearTimers();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setState(newState: ConnectionState, reason?: string): void {
    const previousState = this.state;
    if (previousState === newState) {
      return;
    }

    this.state = newState;
    this.logger.debug(`[${this.id}] State: ${previousState} -> ${newState}${reason ? ` (${reason})` : ""}`);

    this.emit("stateChange", {
      type: "stateChange",
      connectionId: this.id,
      timestamp: new Date(),
      previousState,
      currentState: newState,
      reason,
    });
  }

  private emit<T extends keyof EventListenerMap>(
    event: T,
    data: Parameters<EventListenerMap[T][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`[${this.id}] Error in ${event} listener:`, error);
      }
    }
  }

  private handleMessage(data: string | ArrayBuffer | Blob): void {
    this.stats.messagesReceived++;
    this.stats.lastMessageReceived = new Date();

    if (typeof data === "string") {
      this.stats.bytesReceived += data.length;
    } else if (data instanceof ArrayBuffer) {
      this.stats.bytesReceived += data.byteLength;
    } else if (data instanceof Blob) {
      this.stats.bytesReceived += data.size;
    }

    // Handle pong response
    if (typeof data === "string" && data === "pong") {
      this.handlePong();
      return;
    }

    // Parse JSON if possible
    let json: unknown;
    if (typeof data === "string") {
      try {
        json = JSON.parse(data);

        // Check for pong in JSON format
        if (json && typeof json === "object" && "type" in json && (json as Record<string, unknown>).type === "pong") {
          this.handlePong();
          return;
        }
      } catch {
        // Not JSON, that's fine
      }
    }

    this.emit("message", {
      type: "message",
      connectionId: this.id,
      timestamp: new Date(),
      data,
      json,
    });
  }

  private handleError(error: Error): void {
    this.lastError = error;
    this.setState("error", error.message);

    this.emit("error", {
      type: "error",
      connectionId: this.id,
      timestamp: new Date(),
      error,
      message: error.message,
    });
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.pendingPong = false;
    this.stats.lastPong = new Date();

    // Calculate latency
    if (this.stats.lastPing) {
      const latency = Date.now() - this.stats.lastPing.getTime();
      this.stats.avgLatency = this.stats.avgLatency
        ? (this.stats.avgLatency + latency) / 2
        : latency;
    }
  }

  private startPingInterval(): void {
    if (this.config.pingInterval <= 0) {
      return;
    }

    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.config.pingInterval);
  }

  private sendPing(): void {
    if (!this.isConnected()) {
      return;
    }

    if (this.pendingPong) {
      this.logger.warn(`[${this.id}] Previous ping not acknowledged`);
    }

    this.pendingPong = true;
    this.stats.lastPing = new Date();

    // Try to send ping
    const sent = this.send("ping");
    if (!sent) {
      return;
    }

    // Set up pong timeout
    this.pongTimer = setTimeout(() => {
      this.logger.warn(`[${this.id}] Pong timeout`);
      this.pendingPong = false;
      // Consider connection stale
      if (this.isConnected()) {
        this.disconnect(CloseCode.ABNORMAL, "Pong timeout");
      }
    }, this.config.pongTimeout);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error(`[${this.id}] Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`);
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );

    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;
    this.setState("reconnecting", `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.emit("reconnect", {
      type: "reconnect",
      connectionId: this.id,
      timestamp: new Date(),
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error(`[${this.id}] Reconnect failed:`, error);
        // Schedule another reconnect
        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private clearTimers(): void {
    this.clearConnectionTimer();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }
}

// ============================================================================
// WebSocket Manager Class
// ============================================================================

/**
 * Manages multiple WebSocket connections
 */
export class WebSocketManager {
  private readonly config: Required<WebSocketManagerConfig>;
  private readonly connections: Map<string, WebSocketConnection> = new Map();
  private readonly logger: WebSocketLogger;
  private readonly WebSocketClass: WebSocketConstructor | null;

  constructor(config: WebSocketManagerConfig = {}, WebSocketClass?: WebSocketConstructor) {
    this.config = {
      maxConnections: config.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
      defaultConnectionConfig: config.defaultConnectionConfig ?? {},
      debug: config.debug ?? false,
      logger: config.logger ?? (config.debug ? debugLogger : defaultLogger),
    };

    this.logger = this.config.logger;
    this.WebSocketClass = WebSocketClass ?? (typeof WebSocket !== "undefined" ? WebSocket : null);
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Create and connect a new WebSocket connection
   */
  async connect(config: WebSocketConfig): Promise<WebSocketConnection> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Maximum connections (${this.config.maxConnections}) reached`);
    }

    const mergedConfig: WebSocketConfig = {
      ...this.config.defaultConnectionConfig,
      ...config,
      debug: config.debug ?? this.config.debug,
    };

    const connection = new WebSocketConnection(
      mergedConfig,
      this.logger,
      this.WebSocketClass ?? undefined
    );

    const id = connection.getId();

    if (this.connections.has(id)) {
      throw new Error(`Connection with ID "${id}" already exists`);
    }

    this.connections.set(id, connection);

    try {
      await connection.connect();
      return connection;
    } catch (error) {
      this.connections.delete(id);
      throw error;
    }
  }

  /**
   * Get a connection by ID
   */
  get(id: string): WebSocketConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Check if a connection exists
   */
  has(id: string): boolean {
    return this.connections.has(id);
  }

  /**
   * Disconnect and remove a connection
   */
  disconnect(id: string, code?: number, reason?: string): boolean {
    const connection = this.connections.get(id);
    if (!connection) {
      return false;
    }

    connection.disconnect(code, reason);
    this.connections.delete(id);
    return true;
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(code?: number, reason?: string): void {
    for (const [id, connection] of this.connections) {
      connection.disconnect(code, reason);
      this.connections.delete(id);
    }
  }

  /**
   * Get all connections
   */
  getAll(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all connection IDs
   */
  getIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get number of connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection info for all connections
   */
  getAllInfo(): ConnectionInfo[] {
    return this.getAll().map((conn) => conn.getInfo());
  }

  // ==========================================================================
  // Broadcast
  // ==========================================================================

  /**
   * Send a message to all connected WebSockets
   */
  broadcast(data: string | ArrayBuffer | Blob | ArrayBufferView): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.send(data)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Send a JSON message to all connected WebSockets
   */
  broadcastJson(data: unknown): number {
    try {
      const json = JSON.stringify(data);
      return this.broadcast(json);
    } catch (error) {
      this.logger.error("Broadcast JSON serialization error:", error);
      return 0;
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all connections and clean up resources
   */
  dispose(): void {
    for (const connection of this.connections.values()) {
      connection.dispose();
    }
    this.connections.clear();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Singleton and Factory Functions
// ============================================================================

let sharedManager: WebSocketManager | null = null;

/**
 * Get the shared WebSocket manager instance
 */
export function getSharedWebSocketManager(): WebSocketManager {
  if (!sharedManager) {
    sharedManager = new WebSocketManager();
  }
  return sharedManager;
}

/**
 * Set the shared WebSocket manager instance
 */
export function setSharedWebSocketManager(manager: WebSocketManager): void {
  sharedManager = manager;
}

/**
 * Reset the shared WebSocket manager instance
 */
export function resetSharedWebSocketManager(): void {
  if (sharedManager) {
    sharedManager.dispose();
    sharedManager = null;
  }
}

/**
 * Create a new WebSocket manager
 */
export function createWebSocketManager(
  config?: WebSocketManagerConfig,
  WebSocketClass?: WebSocketConstructor
): WebSocketManager {
  return new WebSocketManager(config, WebSocketClass);
}

/**
 * Create a new WebSocket connection (standalone, not managed)
 */
export function createWebSocketConnection(
  config: WebSocketConfig,
  logger?: WebSocketLogger,
  WebSocketClass?: WebSocketConstructor
): WebSocketConnection {
  return new WebSocketConnection(config, logger, WebSocketClass);
}

// ============================================================================
// Exports
// ============================================================================

export { CloseCode, WebSocketReadyState };
