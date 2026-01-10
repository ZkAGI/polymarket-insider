/**
 * WebSocket Message Parser Module (API-WS-006)
 *
 * Provides centralized parsing and validation for incoming WebSocket messages:
 * - Parse raw message data (string, ArrayBuffer, Blob)
 * - Validate message schema against expected types
 * - Handle unknown message types gracefully
 * - Log parsing errors with context
 * - Support multiple message formats
 */

import type { WebSocketLogger } from "./types";
import { SubscriptionMessageType } from "./market-subscriptions";

// ============================================================================
// Constants
// ============================================================================

/**
 * Known message types in Polymarket WebSocket
 */
export const MessageType = {
  // Subscription lifecycle
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",

  // Market data
  PRICE_UPDATE: "price_update",
  BOOK_UPDATE: "book",
  TRADE: "trade",

  // System messages
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
  HEARTBEAT: "heartbeat",

  // Connection status
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",

  // Unknown/unrecognized
  UNKNOWN: "unknown",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Message categories for grouping
 */
export const MessageCategory = {
  SUBSCRIPTION: "subscription",
  MARKET_DATA: "market_data",
  SYSTEM: "system",
  CONNECTION: "connection",
  UNKNOWN: "unknown",
} as const;

export type MessageCategoryValue = (typeof MessageCategory)[keyof typeof MessageCategory];

/**
 * Parse error codes
 */
export const ParseErrorCode = {
  INVALID_JSON: "INVALID_JSON",
  INVALID_FORMAT: "INVALID_FORMAT",
  MISSING_TYPE: "MISSING_TYPE",
  UNKNOWN_TYPE: "UNKNOWN_TYPE",
  SCHEMA_VALIDATION: "SCHEMA_VALIDATION",
  EMPTY_MESSAGE: "EMPTY_MESSAGE",
  INVALID_DATA_TYPE: "INVALID_DATA_TYPE",
} as const;

export type ParseErrorCodeValue = (typeof ParseErrorCode)[keyof typeof ParseErrorCode];

// ============================================================================
// Types
// ============================================================================

/**
 * Base message structure that all messages should have
 */
export interface BaseMessage {
  /** Message type */
  type?: string;

  /** Optional channel */
  channel?: string;

  /** Optional message ID */
  id?: string;

  /** Optional timestamp */
  timestamp?: string | number;

  /** Optional sequence number */
  sequence?: number;
}

/**
 * Parse error details
 */
export interface ParseError {
  /** Error code */
  code: ParseErrorCodeValue;

  /** Human-readable error message */
  message: string;

  /** Raw data that failed to parse */
  rawData?: string;

  /** Position in the data where error occurred (for JSON errors) */
  position?: number;

  /** Expected format/type */
  expected?: string;

  /** Actual format/type received */
  actual?: string;

  /** Timestamp when error occurred */
  timestamp: Date;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Parsed message result
 */
export interface ParsedMessage<T = unknown> {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed message data (if successful) */
  data?: T;

  /** Message type */
  type: MessageTypeValue;

  /** Message category */
  category: MessageCategoryValue;

  /** Raw message string */
  raw: string;

  /** Parse error (if failed) */
  error?: ParseError;

  /** Timestamp when message was received */
  receivedAt: Date;

  /** Time taken to parse in milliseconds */
  parseTimeMs: number;
}

/**
 * Schema validation rule
 */
export interface ValidationRule {
  /** Field name */
  field: string;

  /** Whether field is required */
  required?: boolean;

  /** Expected type(s) */
  type?: string | string[];

  /** Custom validation function */
  validate?: (value: unknown) => boolean;

  /** Error message if validation fails */
  errorMessage?: string;
}

/**
 * Message schema for validation
 */
export interface MessageSchema {
  /** Message type this schema applies to */
  type: string;

  /** Validation rules for fields */
  rules: ValidationRule[];

  /** Allow unknown fields */
  allowUnknown?: boolean;
}

/**
 * Parser configuration
 */
export interface MessageParserConfig {
  /** Whether to validate messages against schemas */
  validateSchema?: boolean;

  /** Custom schemas for validation */
  schemas?: MessageSchema[];

  /** Whether to log parsing errors */
  logErrors?: boolean;

  /** Maximum message size in bytes (default: 1MB) */
  maxMessageSize?: number;

  /** Whether to track unknown message types */
  trackUnknownTypes?: boolean;

  /** Logger instance */
  logger?: WebSocketLogger;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Parser statistics
 */
export interface ParserStats {
  /** Total messages parsed */
  totalParsed: number;

  /** Successful parses */
  successfulParses: number;

  /** Failed parses */
  failedParses: number;

  /** Messages by type */
  messagesByType: Map<string, number>;

  /** Messages by category */
  messagesByCategory: Map<string, number>;

  /** Parse errors by code */
  errorsByCode: Map<string, number>;

  /** Unknown message types encountered */
  unknownTypes: Set<string>;

  /** Average parse time in ms */
  avgParseTimeMs: number;

  /** Maximum parse time in ms */
  maxParseTimeMs: number;

  /** When stats tracking started */
  startedAt: Date;

  /** Last message parsed at */
  lastMessageAt?: Date;
}

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
// Utility Functions
// ============================================================================

/**
 * Determine message type from parsed data
 */
export function determineMessageType(data: unknown): MessageTypeValue {
  if (typeof data !== "object" || data === null) {
    return MessageType.UNKNOWN;
  }

  const msg = data as Record<string, unknown>;
  const type = msg.type as string | undefined;

  if (!type) {
    // Try to infer type from message structure
    if ("price" in msg && ("asset_id" in msg || "market" in msg || "token_id" in msg)) {
      return MessageType.PRICE_UPDATE;
    }
    if ("bids" in msg || "asks" in msg) {
      return MessageType.BOOK_UPDATE;
    }
    if ("side" in msg && "size" in msg && ("price" in msg || "amount" in msg)) {
      return MessageType.TRADE;
    }
    return MessageType.UNKNOWN;
  }

  // Map known types
  const typeMap: Record<string, MessageTypeValue> = {
    subscribe: MessageType.SUBSCRIBE,
    unsubscribe: MessageType.UNSUBSCRIBE,
    subscribed: MessageType.SUBSCRIBED,
    unsubscribed: MessageType.UNSUBSCRIBED,
    price_update: MessageType.PRICE_UPDATE,
    book: MessageType.BOOK_UPDATE,
    trade: MessageType.TRADE,
    error: MessageType.ERROR,
    ping: MessageType.PING,
    pong: MessageType.PONG,
    heartbeat: MessageType.HEARTBEAT,
    connected: MessageType.CONNECTED,
    disconnected: MessageType.DISCONNECTED,
    reconnecting: MessageType.RECONNECTING,
  };

  return typeMap[type.toLowerCase()] ?? MessageType.UNKNOWN;
}

/**
 * Determine message category from type
 */
export function determineMessageCategory(type: MessageTypeValue): MessageCategoryValue {
  switch (type) {
    case MessageType.SUBSCRIBE:
    case MessageType.UNSUBSCRIBE:
    case MessageType.SUBSCRIBED:
    case MessageType.UNSUBSCRIBED:
      return MessageCategory.SUBSCRIPTION;

    case MessageType.PRICE_UPDATE:
    case MessageType.BOOK_UPDATE:
    case MessageType.TRADE:
      return MessageCategory.MARKET_DATA;

    case MessageType.ERROR:
    case MessageType.PING:
    case MessageType.PONG:
    case MessageType.HEARTBEAT:
      return MessageCategory.SYSTEM;

    case MessageType.CONNECTED:
    case MessageType.DISCONNECTED:
    case MessageType.RECONNECTING:
      return MessageCategory.CONNECTION;

    default:
      return MessageCategory.UNKNOWN;
  }
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe JSON parse with error details
 */
export function safeJsonParse(str: string): { success: true; data: unknown } | { success: false; error: ParseError } {
  try {
    const data = JSON.parse(str);
    return { success: true, data };
  } catch (e) {
    const error = e as SyntaxError;
    // Try to extract position from error message
    const posMatch = error.message.match(/position\s+(\d+)/i);
    const position = posMatch ? parseInt(posMatch[1] ?? "0", 10) : undefined;

    return {
      success: false,
      error: {
        code: ParseErrorCode.INVALID_JSON,
        message: error.message,
        rawData: str.substring(0, 500), // Truncate for logging
        position,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Convert ArrayBuffer to string
 */
export function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer);
}

/**
 * Convert Blob to string (async)
 * Uses Blob.text() which is available in both browser and Node.js 18+
 */
export async function blobToString(blob: Blob): Promise<string> {
  return blob.text();
}

/**
 * Validate a message against a schema
 */
export function validateMessageSchema(
  data: unknown,
  schema: MessageSchema
): { valid: true } | { valid: false; errors: string[] } {
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Message must be an object"] };
  }

  const msg = data as Record<string, unknown>;
  const errors: string[] = [];

  for (const rule of schema.rules) {
    const value = msg[rule.field];

    // Check required fields
    if (rule.required && value === undefined) {
      errors.push(rule.errorMessage ?? `Missing required field: ${rule.field}`);
      continue;
    }

    // Skip optional fields that are not present
    if (value === undefined) {
      continue;
    }

    // Check type
    if (rule.type) {
      const expectedTypes = Array.isArray(rule.type) ? rule.type : [rule.type];
      const actualType = Array.isArray(value) ? "array" : typeof value;

      if (!expectedTypes.includes(actualType)) {
        errors.push(
          rule.errorMessage ?? `Field ${rule.field}: expected ${expectedTypes.join(" | ")}, got ${actualType}`
        );
        continue;
      }
    }

    // Run custom validation
    if (rule.validate && !rule.validate(value)) {
      errors.push(rule.errorMessage ?? `Field ${rule.field} failed validation`);
    }
  }

  // Check for unknown fields
  if (!schema.allowUnknown) {
    const knownFields = new Set(schema.rules.map((r) => r.field));
    knownFields.add("type"); // Always allow type field
    for (const key of Object.keys(msg)) {
      if (!knownFields.has(key)) {
        // Only warn about unknown fields, don't fail validation
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Create a parse error
 */
export function createParseError(
  code: ParseErrorCodeValue,
  message: string,
  context?: Partial<ParseError>
): ParseError {
  return {
    code,
    message,
    timestamp: new Date(),
    ...context,
  };
}

/**
 * Check if a message is a ping/pong message
 */
export function isPingPongMessage(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  const type = String(msg.type ?? "").toLowerCase();
  return type === "ping" || type === "pong" || type === "heartbeat";
}

/**
 * Check if a message is a subscription message
 */
export function isSubscriptionMessage(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  const type = String(msg.type ?? "").toLowerCase();
  return (
    type === SubscriptionMessageType.SUBSCRIBE ||
    type === SubscriptionMessageType.UNSUBSCRIBE ||
    type === SubscriptionMessageType.SUBSCRIBED ||
    type === SubscriptionMessageType.UNSUBSCRIBED
  );
}

/**
 * Check if a message is a market data message
 */
export function isMarketDataMessage(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  const type = String(msg.type ?? "").toLowerCase();

  // Check explicit types
  if (type === "price_update" || type === "book" || type === "trade") {
    return true;
  }

  // Check by structure
  if ("price" in msg && ("asset_id" in msg || "market" in msg || "token_id" in msg)) {
    return true;
  }
  if ("bids" in msg || "asks" in msg) {
    return true;
  }
  if ("side" in msg && ("size" in msg || "amount" in msg)) {
    return true;
  }

  return false;
}

/**
 * Check if a message is an error message
 */
export function isErrorMessageType(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return msg.type === "error" || msg.error !== undefined;
}

/**
 * Extract message ID if present
 */
export function extractMessageId(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const msg = data as Record<string, unknown>;
  const id = msg.id ?? msg.message_id ?? msg.request_id;
  return typeof id === "string" ? id : typeof id === "number" ? String(id) : undefined;
}

/**
 * Extract timestamp from message
 */
export function extractTimestamp(data: unknown): Date {
  if (typeof data !== "object" || data === null) {
    return new Date();
  }
  const msg = data as Record<string, unknown>;
  const ts = msg.timestamp ?? msg.time ?? msg.ts ?? msg.created_at;

  if (!ts) {
    return new Date();
  }

  if (typeof ts === "number") {
    // Unix timestamp - could be seconds or milliseconds
    if (ts < 10000000000) {
      return new Date(ts * 1000);
    }
    return new Date(ts);
  }

  if (typeof ts === "string") {
    const parsed = new Date(ts);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  return new Date();
}

// ============================================================================
// Default Schemas
// ============================================================================

/**
 * Default schemas for common message types
 */
export const defaultSchemas: MessageSchema[] = [
  {
    type: "price_update",
    rules: [
      {
        field: "asset_id",
        required: false,
        type: "string",
      },
      {
        field: "price",
        required: true,
        type: ["number", "string"],
        validate: (v) => {
          const num = typeof v === "string" ? parseFloat(v) : v;
          return typeof num === "number" && !isNaN(num) && num >= 0 && num <= 1;
        },
        errorMessage: "Price must be a number between 0 and 1",
      },
    ],
    allowUnknown: true,
  },
  {
    type: "trade",
    rules: [
      {
        field: "price",
        required: true,
        type: ["number", "string"],
      },
      {
        field: "size",
        required: false,
        type: ["number", "string"],
      },
    ],
    allowUnknown: true,
  },
  {
    type: "book",
    rules: [
      {
        field: "bids",
        required: false,
        type: "array",
      },
      {
        field: "asks",
        required: false,
        type: "array",
      },
    ],
    allowUnknown: true,
  },
  {
    type: "error",
    rules: [
      {
        field: "error",
        required: false,
        type: "string",
      },
      {
        field: "message",
        required: false,
        type: "string",
      },
    ],
    allowUnknown: true,
  },
];

// ============================================================================
// MessageParser Class
// ============================================================================

/**
 * WebSocket message parser with validation and statistics tracking
 */
export class MessageParser {
  private config: Required<
    Omit<MessageParserConfig, "schemas" | "logger"> & {
      schemas: MessageSchema[];
      logger: WebSocketLogger;
    }
  >;
  private stats: ParserStats;
  private schemaMap: Map<string, MessageSchema>;
  private disposed: boolean = false;
  private totalParseTime: number = 0;

  constructor(config: MessageParserConfig = {}) {
    this.config = {
      validateSchema: config.validateSchema ?? true,
      schemas: [...defaultSchemas, ...(config.schemas ?? [])],
      logErrors: config.logErrors ?? true,
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB
      trackUnknownTypes: config.trackUnknownTypes ?? true,
      logger: config.logger ?? defaultLogger,
      debug: config.debug ?? false,
    };

    this.stats = this.createEmptyStats();
    this.schemaMap = new Map(this.config.schemas.map((s) => [s.type.toLowerCase(), s]));

    if (this.config.debug) {
      this.config.logger.debug("[MessageParser] Initialized with config:", this.config);
    }
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): ParserStats {
    return {
      totalParsed: 0,
      successfulParses: 0,
      failedParses: 0,
      messagesByType: new Map(),
      messagesByCategory: new Map(),
      errorsByCode: new Map(),
      unknownTypes: new Set(),
      avgParseTimeMs: 0,
      maxParseTimeMs: 0,
      startedAt: new Date(),
    };
  }

  /**
   * Parse a WebSocket message
   */
  parse<T = unknown>(rawData: string | ArrayBuffer): ParsedMessage<T> {
    const startTime = performance.now();
    const receivedAt = new Date();

    // Convert ArrayBuffer to string if needed
    let data: string;
    if (rawData instanceof ArrayBuffer) {
      data = arrayBufferToString(rawData);
    } else {
      data = rawData;
    }

    // Check message size
    if (data.length > this.config.maxMessageSize) {
      const error = createParseError(ParseErrorCode.INVALID_FORMAT, "Message exceeds maximum size", {
        expected: `<= ${this.config.maxMessageSize} bytes`,
        actual: `${data.length} bytes`,
      });
      return this.createFailedResult<T>(data, error, receivedAt, startTime);
    }

    // Check for empty message
    const trimmed = data.trim();
    if (!trimmed) {
      const error = createParseError(ParseErrorCode.EMPTY_MESSAGE, "Empty message received");
      return this.createFailedResult<T>(data, error, receivedAt, startTime);
    }

    // Try to parse JSON
    const parseResult = safeJsonParse(trimmed);
    if (!parseResult.success) {
      return this.createFailedResult<T>(data, parseResult.error, receivedAt, startTime);
    }

    const parsed = parseResult.data;

    // Determine message type and category
    const type = determineMessageType(parsed);
    const category = determineMessageCategory(type);

    // Track unknown types
    if (type === MessageType.UNKNOWN && this.config.trackUnknownTypes) {
      const rawType = (parsed as Record<string, unknown>).type;
      if (typeof rawType === "string") {
        this.stats.unknownTypes.add(rawType);
      }
    }

    // Validate schema if enabled
    if (this.config.validateSchema && type !== MessageType.UNKNOWN) {
      const schema = this.schemaMap.get(type.toLowerCase());
      if (schema) {
        const validation = validateMessageSchema(parsed, schema);
        if (!validation.valid) {
          // Log validation errors but still return the parsed data (don't fail on validation)
          if (this.config.logErrors) {
            this.config.logger.warn(
              `[MessageParser] Schema validation failed for ${type}: ${validation.errors.join("; ")}`
            );
          }
        }
      }
    }

    return this.createSuccessResult<T>(data, parsed as T, type, category, receivedAt, startTime);
  }

  /**
   * Parse a WebSocket message asynchronously (for Blob data)
   */
  async parseAsync<T = unknown>(rawData: string | ArrayBuffer | Blob): Promise<ParsedMessage<T>> {
    if (rawData instanceof Blob) {
      const str = await blobToString(rawData);
      return this.parse<T>(str);
    }
    return this.parse<T>(rawData);
  }

  /**
   * Create a successful parse result
   */
  private createSuccessResult<T>(
    raw: string,
    data: T,
    type: MessageTypeValue,
    category: MessageCategoryValue,
    receivedAt: Date,
    startTime: number
  ): ParsedMessage<T> {
    const parseTimeMs = performance.now() - startTime;

    // Update stats
    this.stats.totalParsed++;
    this.stats.successfulParses++;
    this.stats.lastMessageAt = receivedAt;
    this.incrementMapCount(this.stats.messagesByType, type);
    this.incrementMapCount(this.stats.messagesByCategory, category);
    this.updateParseTimeStats(parseTimeMs);

    if (this.config.debug) {
      this.config.logger.debug(`[MessageParser] Parsed ${type} message in ${parseTimeMs.toFixed(2)}ms`);
    }

    return {
      success: true,
      data,
      type,
      category,
      raw,
      receivedAt,
      parseTimeMs,
    };
  }

  /**
   * Create a failed parse result
   */
  private createFailedResult<T>(
    raw: string,
    error: ParseError,
    receivedAt: Date,
    startTime: number
  ): ParsedMessage<T> {
    const parseTimeMs = performance.now() - startTime;

    // Update stats
    this.stats.totalParsed++;
    this.stats.failedParses++;
    this.stats.lastMessageAt = receivedAt;
    this.incrementMapCount(this.stats.errorsByCode, error.code);
    this.updateParseTimeStats(parseTimeMs);

    if (this.config.logErrors) {
      this.config.logger.error(`[MessageParser] Parse error: ${error.code} - ${error.message}`);
    }

    return {
      success: false,
      type: MessageType.UNKNOWN,
      category: MessageCategory.UNKNOWN,
      raw,
      error,
      receivedAt,
      parseTimeMs,
    };
  }

  /**
   * Increment a count in a Map
   */
  private incrementMapCount(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  /**
   * Update parse time statistics
   */
  private updateParseTimeStats(parseTimeMs: number): void {
    this.totalParseTime += parseTimeMs;
    this.stats.avgParseTimeMs = this.totalParseTime / this.stats.totalParsed;
    if (parseTimeMs > this.stats.maxParseTimeMs) {
      this.stats.maxParseTimeMs = parseTimeMs;
    }
  }

  /**
   * Add a custom schema
   */
  addSchema(schema: MessageSchema): void {
    this.config.schemas.push(schema);
    this.schemaMap.set(schema.type.toLowerCase(), schema);
  }

  /**
   * Remove a schema by type
   */
  removeSchema(type: string): boolean {
    const index = this.config.schemas.findIndex((s) => s.type.toLowerCase() === type.toLowerCase());
    if (index !== -1) {
      this.config.schemas.splice(index, 1);
      this.schemaMap.delete(type.toLowerCase());
      return true;
    }
    return false;
  }

  /**
   * Get all schemas
   */
  getSchemas(): MessageSchema[] {
    return [...this.config.schemas];
  }

  /**
   * Get parser statistics
   */
  getStats(): ParserStats {
    return {
      ...this.stats,
      messagesByType: new Map(this.stats.messagesByType),
      messagesByCategory: new Map(this.stats.messagesByCategory),
      errorsByCode: new Map(this.stats.errorsByCode),
      unknownTypes: new Set(this.stats.unknownTypes),
    };
  }

  /**
   * Reset parser statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.totalParseTime = 0;
  }

  /**
   * Get unknown message types encountered
   */
  getUnknownTypes(): string[] {
    return Array.from(this.stats.unknownTypes);
  }

  /**
   * Check if parser is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose of the parser
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stats = this.createEmptyStats();
    this.schemaMap.clear();
    this.config.schemas = [];
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedParser: MessageParser | null = null;

/**
 * Create a new MessageParser instance
 */
export function createMessageParser(config?: MessageParserConfig): MessageParser {
  return new MessageParser(config);
}

/**
 * Get the shared MessageParser instance
 */
export function getSharedMessageParser(): MessageParser {
  if (!sharedParser) {
    sharedParser = new MessageParser();
  }
  return sharedParser;
}

/**
 * Set the shared MessageParser instance
 */
export function setSharedMessageParser(parser: MessageParser): void {
  sharedParser = parser;
}

/**
 * Reset the shared MessageParser instance
 */
export function resetSharedMessageParser(): void {
  if (sharedParser) {
    sharedParser.dispose();
    sharedParser = null;
  }
}
