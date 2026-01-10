/**
 * Type definitions for Polymarket WebSocket API
 *
 * Types for WebSocket connection management, message handling, and subscriptions.
 */

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * WebSocket connection states
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnecting"
  | "error";

/**
 * Connection state change event
 */
export interface ConnectionStateChange {
  /** Previous state */
  previousState: ConnectionState;

  /** New state */
  currentState: ConnectionState;

  /** Connection ID */
  connectionId: string;

  /** Timestamp of state change */
  timestamp: Date;

  /** Error if state is 'error' */
  error?: Error;

  /** Reason for state change */
  reason?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * WebSocket connection configuration
 */
export interface WebSocketConfig {
  /** WebSocket URL to connect to */
  url: string;

  /** Connection ID (auto-generated if not provided) */
  id?: string;

  /** Protocols to use (optional) */
  protocols?: string | string[];

  /** Connection timeout in milliseconds (default: 30000) */
  connectionTimeout?: number;

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

  /** Ping interval in milliseconds (default: 30000, 0 to disable) */
  pingInterval?: number;

  /** Pong timeout in milliseconds (default: 10000) */
  pongTimeout?: number;

  /** Custom headers for the connection (if supported) */
  headers?: Record<string, string>;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * WebSocket manager configuration
 */
export interface WebSocketManagerConfig {
  /** Maximum concurrent connections (default: 10) */
  maxConnections?: number;

  /** Default connection configuration */
  defaultConnectionConfig?: Partial<WebSocketConfig>;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom logger */
  logger?: WebSocketLogger;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base WebSocket event
 */
export interface WebSocketEvent {
  /** Event type */
  type: string;

  /** Connection ID */
  connectionId: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Connection opened event
 */
export interface ConnectionOpenEvent extends WebSocketEvent {
  type: "open";

  /** WebSocket URL */
  url: string;
}

/**
 * Connection closed event
 */
export interface ConnectionCloseEvent extends WebSocketEvent {
  type: "close";

  /** Close code */
  code: number;

  /** Close reason */
  reason: string;

  /** Whether the close was clean */
  wasClean: boolean;
}

/**
 * Connection error event
 */
export interface ConnectionErrorEvent extends WebSocketEvent {
  type: "error";

  /** Error object */
  error: Error;

  /** Error message */
  message: string;
}

/**
 * Message received event
 */
export interface MessageEvent extends WebSocketEvent {
  type: "message";

  /** Raw message data */
  data: string | ArrayBuffer | Blob;

  /** Parsed JSON data (if applicable) */
  json?: unknown;
}

/**
 * Reconnection attempt event
 */
export interface ReconnectEvent extends WebSocketEvent {
  type: "reconnect";

  /** Current attempt number */
  attempt: number;

  /** Maximum attempts */
  maxAttempts: number;

  /** Delay until next attempt in ms */
  delay: number;
}

/**
 * State change event
 */
export interface StateChangeEvent extends WebSocketEvent {
  type: "stateChange";

  /** Previous state */
  previousState: ConnectionState;

  /** New state */
  currentState: ConnectionState;

  /** Reason for change */
  reason?: string;
}

/**
 * All WebSocket event types
 */
export type WebSocketEventType =
  | ConnectionOpenEvent
  | ConnectionCloseEvent
  | ConnectionErrorEvent
  | MessageEvent
  | ReconnectEvent
  | StateChangeEvent;

// ============================================================================
// Listener Types
// ============================================================================

/**
 * Event listener function
 */
export type EventListener<T extends WebSocketEvent = WebSocketEvent> = (event: T) => void;

/**
 * Event listener map
 */
export interface EventListenerMap {
  open: EventListener<ConnectionOpenEvent>[];
  close: EventListener<ConnectionCloseEvent>[];
  error: EventListener<ConnectionErrorEvent>[];
  message: EventListener<MessageEvent>[];
  reconnect: EventListener<ReconnectEvent>[];
  stateChange: EventListener<StateChangeEvent>[];
}

/**
 * Event listener registration options
 */
export interface ListenerOptions {
  /** Only fire once then remove */
  once?: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Outgoing message structure
 */
export interface OutgoingMessage {
  /** Message type/action */
  type: string;

  /** Message payload */
  payload?: unknown;

  /** Optional message ID for tracking */
  id?: string;
}

/**
 * Incoming message structure
 */
export interface IncomingMessage {
  /** Message type */
  type: string;

  /** Message payload */
  data?: unknown;

  /** Message ID if present */
  id?: string;

  /** Timestamp */
  timestamp?: string | number;
}

// ============================================================================
// Connection Info Types
// ============================================================================

/**
 * Connection statistics
 */
export interface ConnectionStats {
  /** Total messages sent */
  messagesSent: number;

  /** Total messages received */
  messagesReceived: number;

  /** Total bytes sent */
  bytesSent: number;

  /** Total bytes received */
  bytesReceived: number;

  /** Connection uptime in milliseconds */
  uptime: number;

  /** Number of reconnection attempts */
  reconnectAttempts: number;

  /** Last message sent timestamp */
  lastMessageSent?: Date;

  /** Last message received timestamp */
  lastMessageReceived?: Date;

  /** Last ping timestamp */
  lastPing?: Date;

  /** Last pong timestamp */
  lastPong?: Date;

  /** Average latency in milliseconds */
  avgLatency?: number;
}

/**
 * Connection information
 */
export interface ConnectionInfo {
  /** Connection ID */
  id: string;

  /** WebSocket URL */
  url: string;

  /** Current connection state */
  state: ConnectionState;

  /** Connection configuration */
  config: WebSocketConfig;

  /** Connection statistics */
  stats: ConnectionStats;

  /** When the connection was created */
  createdAt: Date;

  /** When the connection was established */
  connectedAt?: Date;

  /** When the connection was last disconnected */
  disconnectedAt?: Date;

  /** Last error encountered */
  lastError?: Error;
}

// ============================================================================
// Logger Types
// ============================================================================

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger interface
 */
export interface WebSocketLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// ============================================================================
// WebSocket Interface (for testing/abstraction)
// ============================================================================

/**
 * WebSocket interface for abstraction
 * Matches the browser WebSocket API
 */
export interface IWebSocket {
  readonly readyState: number;
  readonly url: string;
  readonly protocol: string;
  readonly bufferedAmount: number;

  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: globalThis.MessageEvent) => void) | null;

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

/**
 * WebSocket constructor type for dependency injection
 */
export type WebSocketConstructor = new (
  url: string,
  protocols?: string | string[]
) => IWebSocket;

// ============================================================================
// Constants
// ============================================================================

/**
 * WebSocket ready states
 */
export const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * Default close codes
 */
export const CloseCode = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS: 1005,
  ABNORMAL: 1006,
  INVALID_PAYLOAD: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MISSING_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  BAD_GATEWAY: 1014,
  TLS_HANDSHAKE: 1015,
} as const;
