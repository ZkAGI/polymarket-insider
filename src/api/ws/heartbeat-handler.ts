/**
 * WebSocket Heartbeat Handler (API-WS-007)
 *
 * Provides robust heartbeat management for WebSocket connections:
 * - Configurable ping interval
 * - Pong response handling with timeout detection
 * - Stale connection detection
 * - Automatic reconnection on heartbeat failure
 * - Latency tracking and statistics
 */

import type { WebSocketLogger } from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Default ping interval in milliseconds */
export const DEFAULT_PING_INTERVAL = 30000;

/** Default pong timeout in milliseconds */
export const DEFAULT_PONG_TIMEOUT = 10000;

/** Default number of missed pongs before considering connection stale */
export const DEFAULT_MISSED_PONGS_THRESHOLD = 2;

/** Default latency history size for averaging */
export const DEFAULT_LATENCY_HISTORY_SIZE = 10;

/** Default stale connection threshold in milliseconds */
export const DEFAULT_STALE_THRESHOLD = 60000;

/** Heartbeat message types */
export const HeartbeatMessageType = {
  PING: "ping",
  PONG: "pong",
  HEARTBEAT: "heartbeat",
} as const;

export type HeartbeatMessageTypeValue = (typeof HeartbeatMessageType)[keyof typeof HeartbeatMessageType];

// ============================================================================
// Types
// ============================================================================

/**
 * Heartbeat configuration options
 */
export interface HeartbeatConfig {
  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;

  /** Pong timeout in milliseconds (default: 10000) */
  pongTimeout?: number;

  /** Number of missed pongs before considering connection stale (default: 2) */
  missedPongsThreshold?: number;

  /** Latency history size for averaging (default: 10) */
  latencyHistorySize?: number;

  /** Stale connection threshold in ms - no activity considered stale (default: 60000) */
  staleThreshold?: number;

  /** Whether to auto-start heartbeat on creation (default: false) */
  autoStart?: boolean;

  /** Custom ping message to send (default: "ping" or JSON {"type": "ping"}) */
  pingMessage?: string | (() => string);

  /** Use JSON format for ping/pong messages (default: false) */
  useJsonFormat?: boolean;

  /** Custom pong message matcher (default: matches "pong" or {"type": "pong"}) */
  pongMatcher?: (message: string) => boolean;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: WebSocketLogger;
}

/**
 * Heartbeat statistics
 */
export interface HeartbeatStats {
  /** Total pings sent */
  totalPingsSent: number;

  /** Total pongs received */
  totalPongsReceived: number;

  /** Total missed pongs (timeout) */
  totalMissedPongs: number;

  /** Consecutive missed pongs */
  consecutiveMissedPongs: number;

  /** Current average latency in ms */
  avgLatencyMs: number;

  /** Minimum latency observed in ms */
  minLatencyMs: number;

  /** Maximum latency observed in ms */
  maxLatencyMs: number;

  /** Last ping timestamp */
  lastPingAt: Date | null;

  /** Last pong timestamp */
  lastPongAt: Date | null;

  /** Last activity timestamp (any message) */
  lastActivityAt: Date | null;

  /** Whether heartbeat is currently active */
  isActive: boolean;

  /** Whether a pong is currently pending */
  isPongPending: boolean;

  /** Whether connection is considered stale */
  isStale: boolean;

  /** Latency history (most recent first) */
  latencyHistory: number[];
}

/**
 * Heartbeat event types
 */
export const HeartbeatEventType = {
  PING_SENT: "pingSent",
  PONG_RECEIVED: "pongReceived",
  PONG_TIMEOUT: "pongTimeout",
  STALE_DETECTED: "staleDetected",
  HEARTBEAT_FAILURE: "heartbeatFailure",
  HEARTBEAT_STARTED: "heartbeatStarted",
  HEARTBEAT_STOPPED: "heartbeatStopped",
} as const;

export type HeartbeatEventTypeValue = (typeof HeartbeatEventType)[keyof typeof HeartbeatEventType];

/**
 * Base heartbeat event
 */
export interface HeartbeatEvent {
  /** Event type */
  type: HeartbeatEventTypeValue;

  /** Timestamp of event */
  timestamp: Date;

  /** Current stats at time of event */
  stats: HeartbeatStats;
}

/**
 * Ping sent event
 */
export interface PingSentEvent extends HeartbeatEvent {
  type: "pingSent";
  /** The ping message that was sent */
  message: string;
}

/**
 * Pong received event
 */
export interface PongReceivedEvent extends HeartbeatEvent {
  type: "pongReceived";
  /** Round-trip latency in ms */
  latencyMs: number;
  /** The pong message received */
  message: string;
}

/**
 * Pong timeout event
 */
export interface PongTimeoutEvent extends HeartbeatEvent {
  type: "pongTimeout";
  /** How many consecutive pongs have been missed */
  consecutiveMissed: number;
  /** Threshold for heartbeat failure */
  threshold: number;
}

/**
 * Stale connection detected event
 */
export interface StaleDetectedEvent extends HeartbeatEvent {
  type: "staleDetected";
  /** Milliseconds since last activity */
  inactivityMs: number;
  /** Stale threshold in ms */
  threshold: number;
}

/**
 * Heartbeat failure event (should trigger reconnection)
 */
export interface HeartbeatFailureEvent extends HeartbeatEvent {
  type: "heartbeatFailure";
  /** Reason for failure */
  reason: "missedPongs" | "stale" | "error";
  /** Additional error info if applicable */
  error?: Error;
}

/**
 * Heartbeat started event
 */
export interface HeartbeatStartedEvent extends HeartbeatEvent {
  type: "heartbeatStarted";
  /** Ping interval in ms */
  pingInterval: number;
}

/**
 * Heartbeat stopped event
 */
export interface HeartbeatStoppedEvent extends HeartbeatEvent {
  type: "heartbeatStopped";
  /** Reason for stopping */
  reason: string;
}

/**
 * All heartbeat event types
 */
export type HeartbeatEventUnion =
  | PingSentEvent
  | PongReceivedEvent
  | PongTimeoutEvent
  | StaleDetectedEvent
  | HeartbeatFailureEvent
  | HeartbeatStartedEvent
  | HeartbeatStoppedEvent;

/**
 * Event listener map for heartbeat events
 */
export interface HeartbeatEventListenerMap {
  pingSent: ((event: PingSentEvent) => void)[];
  pongReceived: ((event: PongReceivedEvent) => void)[];
  pongTimeout: ((event: PongTimeoutEvent) => void)[];
  staleDetected: ((event: StaleDetectedEvent) => void)[];
  heartbeatFailure: ((event: HeartbeatFailureEvent) => void)[];
  heartbeatStarted: ((event: HeartbeatStartedEvent) => void)[];
  heartbeatStopped: ((event: HeartbeatStoppedEvent) => void)[];
}

type HeartbeatEventKey = keyof HeartbeatEventListenerMap;

/**
 * Send function type - provided by the WebSocket connection
 */
export type SendFunction = (data: string) => boolean;

/**
 * Reconnect function type - called when heartbeat failure detected
 */
export type ReconnectFunction = () => void;

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
// Utility Functions
// ============================================================================

/**
 * Check if a message is a ping message
 */
export function isPingMessage(message: string): boolean {
  if (message.toLowerCase() === "ping") {
    return true;
  }

  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const type = parsed.type?.toString().toLowerCase();
      return type === "ping" || type === "heartbeat";
    }
  } catch {
    // Not JSON
  }

  return false;
}

/**
 * Check if a message is a pong message
 */
export function isPongMessage(message: string): boolean {
  if (message.toLowerCase() === "pong") {
    return true;
  }

  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object") {
      const type = parsed.type?.toString().toLowerCase();
      return type === "pong";
    }
  } catch {
    // Not JSON
  }

  return false;
}

/**
 * Create a default ping message
 */
export function createPingMessage(useJson: boolean): string {
  if (useJson) {
    return JSON.stringify({ type: "ping", timestamp: Date.now() });
  }
  return "ping";
}

/**
 * Create a default pong message
 */
export function createPongMessage(useJson: boolean): string {
  if (useJson) {
    return JSON.stringify({ type: "pong", timestamp: Date.now() });
  }
  return "pong";
}

/**
 * Calculate average from an array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

// ============================================================================
// HeartbeatHandler Class
// ============================================================================

/**
 * Heartbeat handler for WebSocket connections
 *
 * Manages ping/pong heartbeats to detect stale connections and trigger reconnection.
 */
export class HeartbeatHandler {
  private readonly config: Required<Omit<HeartbeatConfig, "logger" | "pingMessage" | "pongMatcher">> & {
    logger: WebSocketLogger;
    pingMessage: string | (() => string);
    pongMatcher: (message: string) => boolean;
  };

  private readonly logger: WebSocketLogger;

  // Callbacks
  private sendFn: SendFunction | null = null;
  private reconnectFn: ReconnectFunction | null = null;

  // Timers
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;

  // State
  private isActive = false;
  private isPongPending = false;
  private isDisposed = false;
  private lastPingSentAt: Date | null = null;
  private lastPongReceivedAt: Date | null = null;
  private lastActivityAt: Date | null = null;
  private consecutiveMissedPongs = 0;
  private totalPingsSent = 0;
  private totalPongsReceived = 0;
  private totalMissedPongs = 0;
  private latencyHistory: number[] = [];

  // Event listeners
  private readonly listeners: HeartbeatEventListenerMap = {
    pingSent: [],
    pongReceived: [],
    pongTimeout: [],
    staleDetected: [],
    heartbeatFailure: [],
    heartbeatStarted: [],
    heartbeatStopped: [],
  };

  constructor(config: HeartbeatConfig = {}) {
    const debug = config.debug ?? false;

    this.config = {
      pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
      pongTimeout: config.pongTimeout ?? DEFAULT_PONG_TIMEOUT,
      missedPongsThreshold: config.missedPongsThreshold ?? DEFAULT_MISSED_PONGS_THRESHOLD,
      latencyHistorySize: config.latencyHistorySize ?? DEFAULT_LATENCY_HISTORY_SIZE,
      staleThreshold: config.staleThreshold ?? DEFAULT_STALE_THRESHOLD,
      autoStart: config.autoStart ?? false,
      pingMessage: config.pingMessage ?? createPingMessage(config.useJsonFormat ?? false),
      useJsonFormat: config.useJsonFormat ?? false,
      pongMatcher: config.pongMatcher ?? isPongMessage,
      debug,
      logger: config.logger ?? (debug ? debugLogger : defaultLogger),
    };

    this.logger = this.config.logger;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set the send function for sending ping messages
   */
  setSendFunction(fn: SendFunction): void {
    this.sendFn = fn;
  }

  /**
   * Set the reconnect function to call on heartbeat failure
   */
  setReconnectFunction(fn: ReconnectFunction): void {
    this.reconnectFn = fn;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<HeartbeatConfig> {
    return { ...this.config };
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the heartbeat handler
   */
  start(): boolean {
    if (this.isDisposed) {
      this.logger.warn("HeartbeatHandler: Cannot start - handler is disposed");
      return false;
    }

    if (this.isActive) {
      this.logger.debug("HeartbeatHandler: Already active");
      return true;
    }

    if (!this.sendFn) {
      this.logger.warn("HeartbeatHandler: Cannot start - no send function set");
      return false;
    }

    this.isActive = true;
    this.lastActivityAt = new Date();

    // Start ping interval
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.config.pingInterval);

    // Start stale connection check
    this.staleCheckTimer = setInterval(() => {
      this.checkStale();
    }, this.config.staleThreshold / 2);

    this.logger.debug(`HeartbeatHandler: Started with ${this.config.pingInterval}ms interval`);

    this.emit("heartbeatStarted", {
      type: "heartbeatStarted",
      timestamp: new Date(),
      stats: this.getStats(),
      pingInterval: this.config.pingInterval,
    });

    return true;
  }

  /**
   * Stop the heartbeat handler
   */
  stop(reason: string = "Manual stop"): void {
    if (!this.isActive) {
      return;
    }

    this.clearTimers();
    this.isActive = false;
    this.isPongPending = false;

    this.logger.debug(`HeartbeatHandler: Stopped - ${reason}`);

    this.emit("heartbeatStopped", {
      type: "heartbeatStopped",
      timestamp: new Date(),
      stats: this.getStats(),
      reason,
    });
  }

  /**
   * Restart the heartbeat handler
   */
  restart(): boolean {
    this.stop("Restart");
    return this.start();
  }

  /**
   * Dispose of the handler and clean up resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.stop("Dispose");
    this.isDisposed = true;
    this.sendFn = null;
    this.reconnectFn = null;
    this.removeAllListeners();
    this.latencyHistory = [];
  }

  /**
   * Check if handler is disposed
   */
  getIsDisposed(): boolean {
    return this.isDisposed;
  }

  // ==========================================================================
  // Heartbeat Operations
  // ==========================================================================

  /**
   * Send a ping message
   */
  sendPing(): boolean {
    if (!this.isActive || !this.sendFn) {
      return false;
    }

    if (this.isPongPending) {
      this.logger.debug("HeartbeatHandler: Previous pong still pending");
    }

    const pingMessage =
      typeof this.config.pingMessage === "function"
        ? this.config.pingMessage()
        : this.config.pingMessage;

    const sent = this.sendFn(pingMessage);

    if (!sent) {
      this.logger.warn("HeartbeatHandler: Failed to send ping");
      return false;
    }

    this.isPongPending = true;
    this.lastPingSentAt = new Date();
    this.totalPingsSent++;

    // Start pong timeout
    this.clearPongTimer();
    this.pongTimer = setTimeout(() => {
      this.handlePongTimeout();
    }, this.config.pongTimeout);

    this.logger.debug("HeartbeatHandler: Ping sent");

    this.emit("pingSent", {
      type: "pingSent",
      timestamp: new Date(),
      stats: this.getStats(),
      message: pingMessage,
    });

    return true;
  }

  /**
   * Handle an incoming message - check if it's a pong
   */
  handleMessage(message: string): boolean {
    // Update last activity
    this.lastActivityAt = new Date();

    // Check if it's a pong message
    if (this.config.pongMatcher(message)) {
      return this.handlePong(message);
    }

    return false;
  }

  /**
   * Manually notify of activity (for non-pong messages)
   */
  notifyActivity(): void {
    this.lastActivityAt = new Date();
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get current heartbeat statistics
   */
  getStats(): HeartbeatStats {
    return {
      totalPingsSent: this.totalPingsSent,
      totalPongsReceived: this.totalPongsReceived,
      totalMissedPongs: this.totalMissedPongs,
      consecutiveMissedPongs: this.consecutiveMissedPongs,
      avgLatencyMs: calculateAverage(this.latencyHistory),
      minLatencyMs: this.latencyHistory.length > 0 ? Math.min(...this.latencyHistory) : 0,
      maxLatencyMs: this.latencyHistory.length > 0 ? Math.max(...this.latencyHistory) : 0,
      lastPingAt: this.lastPingSentAt,
      lastPongAt: this.lastPongReceivedAt,
      lastActivityAt: this.lastActivityAt,
      isActive: this.isActive,
      isPongPending: this.isPongPending,
      isStale: this.isConnectionStale(),
      latencyHistory: [...this.latencyHistory],
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalPingsSent = 0;
    this.totalPongsReceived = 0;
    this.totalMissedPongs = 0;
    this.consecutiveMissedPongs = 0;
    this.latencyHistory = [];
    this.lastPingSentAt = null;
    this.lastPongReceivedAt = null;
  }

  /**
   * Get current latency (last measured)
   */
  getCurrentLatency(): number | null {
    const latency = this.latencyHistory[0];
    return latency !== undefined ? latency : null;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    return calculateAverage(this.latencyHistory);
  }

  /**
   * Check if connection is considered stale
   */
  isConnectionStale(): boolean {
    if (!this.lastActivityAt) {
      return false;
    }

    const inactivity = Date.now() - this.lastActivityAt.getTime();
    return inactivity > this.config.staleThreshold;
  }

  /**
   * Check if heartbeat is currently active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<K extends HeartbeatEventKey>(
    event: K,
    listener: HeartbeatEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends HeartbeatEventKey>(
    event: K,
    listener: HeartbeatEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends HeartbeatEventKey>(
    event: K,
    listener: HeartbeatEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as HeartbeatEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as HeartbeatEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: HeartbeatEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as HeartbeatEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private handlePong(message: string): boolean {
    if (!this.isPongPending) {
      this.logger.debug("HeartbeatHandler: Unexpected pong received");
      return true;
    }

    this.clearPongTimer();
    this.isPongPending = false;
    this.consecutiveMissedPongs = 0;
    this.totalPongsReceived++;
    this.lastPongReceivedAt = new Date();

    // Calculate latency
    let latencyMs = 0;
    if (this.lastPingSentAt) {
      latencyMs = Date.now() - this.lastPingSentAt.getTime();

      // Add to history
      this.latencyHistory.unshift(latencyMs);
      if (this.latencyHistory.length > this.config.latencyHistorySize) {
        this.latencyHistory.pop();
      }
    }

    this.logger.debug(`HeartbeatHandler: Pong received, latency=${latencyMs}ms`);

    this.emit("pongReceived", {
      type: "pongReceived",
      timestamp: new Date(),
      stats: this.getStats(),
      latencyMs,
      message,
    });

    return true;
  }

  private handlePongTimeout(): void {
    this.isPongPending = false;
    this.consecutiveMissedPongs++;
    this.totalMissedPongs++;

    this.logger.warn(
      `HeartbeatHandler: Pong timeout (${this.consecutiveMissedPongs}/${this.config.missedPongsThreshold})`
    );

    this.emit("pongTimeout", {
      type: "pongTimeout",
      timestamp: new Date(),
      stats: this.getStats(),
      consecutiveMissed: this.consecutiveMissedPongs,
      threshold: this.config.missedPongsThreshold,
    });

    // Check if threshold exceeded
    if (this.consecutiveMissedPongs >= this.config.missedPongsThreshold) {
      this.handleHeartbeatFailure("missedPongs");
    }
  }

  private checkStale(): void {
    if (!this.isActive || !this.lastActivityAt) {
      return;
    }

    const inactivityMs = Date.now() - this.lastActivityAt.getTime();

    if (inactivityMs > this.config.staleThreshold) {
      this.logger.warn(`HeartbeatHandler: Stale connection detected (${inactivityMs}ms inactive)`);

      this.emit("staleDetected", {
        type: "staleDetected",
        timestamp: new Date(),
        stats: this.getStats(),
        inactivityMs,
        threshold: this.config.staleThreshold,
      });

      this.handleHeartbeatFailure("stale");
    }
  }

  private handleHeartbeatFailure(reason: "missedPongs" | "stale" | "error", error?: Error): void {
    this.logger.error(`HeartbeatHandler: Heartbeat failure - ${reason}`);

    this.emit("heartbeatFailure", {
      type: "heartbeatFailure",
      timestamp: new Date(),
      stats: this.getStats(),
      reason,
      error,
    });

    // Stop heartbeat
    this.stop(`Heartbeat failure: ${reason}`);

    // Trigger reconnection if callback is set
    if (this.reconnectFn) {
      this.logger.info("HeartbeatHandler: Triggering reconnection");
      try {
        this.reconnectFn();
      } catch (err) {
        this.logger.error("HeartbeatHandler: Reconnect callback error:", err);
      }
    }
  }

  private emit<K extends HeartbeatEventKey>(
    event: K,
    data: Parameters<HeartbeatEventListenerMap[K][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`HeartbeatHandler: Error in ${event} listener:`, error);
      }
    }
  }

  private clearTimers(): void {
    this.clearPingTimer();
    this.clearPongTimer();
    this.clearStaleTimer();
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearStaleTimer(): void {
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new heartbeat handler
 */
export function createHeartbeatHandler(config?: HeartbeatConfig): HeartbeatHandler {
  return new HeartbeatHandler(config);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedHeartbeatHandler: HeartbeatHandler | null = null;

/**
 * Get the shared heartbeat handler instance
 */
export function getSharedHeartbeatHandler(): HeartbeatHandler {
  if (!sharedHeartbeatHandler) {
    sharedHeartbeatHandler = new HeartbeatHandler();
  }
  return sharedHeartbeatHandler;
}

/**
 * Set the shared heartbeat handler instance
 */
export function setSharedHeartbeatHandler(handler: HeartbeatHandler): void {
  sharedHeartbeatHandler = handler;
}

/**
 * Reset the shared heartbeat handler instance
 */
export function resetSharedHeartbeatHandler(): void {
  if (sharedHeartbeatHandler) {
    sharedHeartbeatHandler.dispose();
    sharedHeartbeatHandler = null;
  }
}

// ============================================================================
// Integration Helper
// ============================================================================

/**
 * Options for attaching heartbeat handler to a connection
 */
export interface AttachHeartbeatOptions {
  /** Heartbeat configuration */
  config?: HeartbeatConfig;

  /** Function to send data through the connection */
  send: SendFunction;

  /** Function to trigger reconnection */
  reconnect?: ReconnectFunction;

  /** Whether to auto-start the heartbeat */
  autoStart?: boolean;
}

/**
 * Create and attach a heartbeat handler to a WebSocket connection
 *
 * @param options - Attachment options
 * @returns The created heartbeat handler
 */
export function attachHeartbeatHandler(options: AttachHeartbeatOptions): HeartbeatHandler {
  const handler = createHeartbeatHandler({
    ...options.config,
    autoStart: false, // We'll start manually after setup
  });

  handler.setSendFunction(options.send);

  if (options.reconnect) {
    handler.setReconnectFunction(options.reconnect);
  }

  if (options.autoStart !== false) {
    handler.start();
  }

  return handler;
}
