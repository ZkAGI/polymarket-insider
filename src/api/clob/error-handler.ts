/**
 * Error Handler for Polymarket CLOB API
 *
 * Provides CLOB-specific error handling with retry logic, exponential backoff,
 * recovery strategies, and comprehensive logging for API operations.
 *
 * This module handles CLOB-specific errors including:
 * - Order placement failures
 * - Market/token not found errors
 * - Insufficient balance errors
 * - Order validation errors
 * - Nonce errors and signature issues
 */

import { ClobApiException } from "./client";

/**
 * CLOB-specific error types
 */
export enum ClobErrorType {
  /** Network-level errors (connection refused, DNS failure, etc.) */
  NETWORK = "NETWORK",

  /** Request timeout */
  TIMEOUT = "TIMEOUT",

  /** Server errors (5xx status codes) */
  SERVER = "SERVER",

  /** Rate limiting (429 status code) */
  RATE_LIMIT = "RATE_LIMIT",

  /** Authentication errors (401, missing/invalid credentials) */
  AUTH = "AUTH",

  /** Authorization errors (403, insufficient permissions) */
  FORBIDDEN = "FORBIDDEN",

  /** Resource not found (404, market/order not found) */
  NOT_FOUND = "NOT_FOUND",

  /** Order validation errors (invalid price, size, etc.) */
  VALIDATION = "VALIDATION",

  /** Insufficient balance for order */
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",

  /** Order already exists or duplicate */
  DUPLICATE_ORDER = "DUPLICATE_ORDER",

  /** Order not found or already cancelled */
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",

  /** Market closed or not tradeable */
  MARKET_CLOSED = "MARKET_CLOSED",

  /** Nonce errors (expired, already used) */
  NONCE_ERROR = "NONCE_ERROR",

  /** Signature verification failed */
  SIGNATURE_ERROR = "SIGNATURE_ERROR",

  /** Price out of valid range */
  INVALID_PRICE = "INVALID_PRICE",

  /** Size below minimum or above maximum */
  INVALID_SIZE = "INVALID_SIZE",

  /** Invalid response format (JSON parsing errors, etc.) */
  PARSE = "PARSE",

  /** Client errors not covered above (4xx) */
  CLIENT = "CLIENT",

  /** Unknown or unexpected errors */
  UNKNOWN = "UNKNOWN",
}

/**
 * Severity level for CLOB errors
 */
export enum ClobErrorSeverity {
  /** Informational, operation succeeded with warnings */
  INFO = "INFO",

  /** Warning, something unexpected happened but operation may continue */
  WARN = "WARN",

  /** Error, operation failed but may be retried */
  ERROR = "ERROR",

  /** Critical error, operation failed and should not be retried */
  CRITICAL = "CRITICAL",
}

/**
 * Known CLOB API error codes
 */
export const ClobErrorCodes = {
  // Authentication errors
  MISSING_CREDENTIALS: "MISSING_CREDENTIALS",
  INVALID_API_KEY: "INVALID_API_KEY",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  EXPIRED_TIMESTAMP: "EXPIRED_TIMESTAMP",
  INVALID_PASSPHRASE: "INVALID_PASSPHRASE",

  // Order errors
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  DUPLICATE_ORDER: "DUPLICATE_ORDER",
  ORDER_ALREADY_FILLED: "ORDER_ALREADY_FILLED",
  ORDER_ALREADY_CANCELLED: "ORDER_ALREADY_CANCELLED",

  // Balance errors
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INSUFFICIENT_ALLOWANCE: "INSUFFICIENT_ALLOWANCE",

  // Validation errors
  INVALID_PRICE: "INVALID_PRICE",
  INVALID_SIZE: "INVALID_SIZE",
  INVALID_SIDE: "INVALID_SIDE",
  INVALID_TOKEN_ID: "INVALID_TOKEN_ID",
  PRICE_OUT_OF_RANGE: "PRICE_OUT_OF_RANGE",
  SIZE_TOO_SMALL: "SIZE_TOO_SMALL",
  SIZE_TOO_LARGE: "SIZE_TOO_LARGE",

  // Market errors
  MARKET_NOT_FOUND: "MARKET_NOT_FOUND",
  MARKET_CLOSED: "MARKET_CLOSED",
  MARKET_PAUSED: "MARKET_PAUSED",
  MARKET_NOT_TRADEABLE: "MARKET_NOT_TRADEABLE",

  // Nonce errors
  INVALID_NONCE: "INVALID_NONCE",
  NONCE_TOO_LOW: "NONCE_TOO_LOW",
  NONCE_ALREADY_USED: "NONCE_ALREADY_USED",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ClobErrorCode = (typeof ClobErrorCodes)[keyof typeof ClobErrorCodes];

/**
 * Configuration for CLOB error handler
 */
export interface ClobErrorHandlerConfig {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for exponential backoff
   * @default 1000
   */
  baseDelay?: number;

  /**
   * Maximum delay in milliseconds for exponential backoff
   * @default 30000
   */
  maxDelay?: number;

  /**
   * Jitter factor (0-1) to add randomness to delays
   * @default 0.2
   */
  jitterFactor?: number;

  /**
   * Error types that should be retried
   * @default [SERVER, RATE_LIMIT, NETWORK, TIMEOUT, NONCE_ERROR]
   */
  retryableErrors?: ClobErrorType[];

  /**
   * Custom logger function
   */
  logger?: ClobErrorLogger;

  /**
   * Whether to enable logging
   * @default true
   */
  enableLogging?: boolean;

  /**
   * Callback when an error occurs (before retry)
   */
  onError?: (context: ClobErrorContext) => void;

  /**
   * Callback when all retries are exhausted
   */
  onMaxRetriesExceeded?: (context: ClobErrorContext) => void;

  /**
   * Callback when a recoverable error is detected
   * Return true to attempt recovery, false to proceed with retry
   */
  onRecoverableError?: (context: ClobErrorContext) => Promise<boolean>;
}

/**
 * Logger interface for CLOB error handler
 */
export interface ClobErrorLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Context information about a CLOB error
 */
export interface ClobErrorContext {
  /** The original error that occurred */
  originalError: Error;

  /** Classified error type */
  errorType: ClobErrorType;

  /** Error severity level */
  severity: ClobErrorSeverity;

  /** HTTP status code (if available) */
  statusCode?: number;

  /** Error code from API (if available) */
  errorCode?: string;

  /** Current retry attempt (0-based) */
  attempt: number;

  /** Maximum retries configured */
  maxRetries: number;

  /** Whether this error will be retried */
  willRetry: boolean;

  /** Delay before next retry (in ms, if will retry) */
  retryDelay?: number;

  /** Operation being performed (optional description) */
  operation?: string;

  /** Timestamp when error occurred */
  timestamp: string;

  /** Request URL (if available) */
  url?: string;

  /** Request method (if available) */
  method?: string;

  /** Token ID involved (if available) */
  tokenId?: string;

  /** Order ID involved (if available) */
  orderId?: string;

  /** Suggested recovery action */
  recoveryAction?: RecoveryAction;

  /** Whether recovery was attempted */
  recoveryAttempted?: boolean;

  /** Whether recovery succeeded */
  recoverySucceeded?: boolean;
}

/**
 * Recovery actions that can be taken for certain errors
 */
export enum RecoveryAction {
  /** No recovery action needed */
  NONE = "NONE",

  /** Refresh authentication credentials */
  REFRESH_AUTH = "REFRESH_AUTH",

  /** Wait for rate limit to reset */
  WAIT_RATE_LIMIT = "WAIT_RATE_LIMIT",

  /** Generate new nonce */
  REFRESH_NONCE = "REFRESH_NONCE",

  /** Re-sign the request */
  RESIGN_REQUEST = "RESIGN_REQUEST",

  /** Refresh balance/allowance data */
  REFRESH_BALANCE = "REFRESH_BALANCE",

  /** Fetch fresh market data */
  REFRESH_MARKET = "REFRESH_MARKET",

  /** Cancel and resubmit order */
  RESUBMIT_ORDER = "RESUBMIT_ORDER",
}

/**
 * Result of an error handling operation
 */
export interface ClobErrorHandlerResult<T> {
  /** Whether the operation was successful */
  success: boolean;

  /** Result data (if successful) */
  data?: T;

  /** Error context (if failed) */
  error?: ClobErrorContext;

  /** Total attempts made */
  attempts: number;

  /** Total time spent including retries (in ms) */
  totalTime: number;

  /** Whether recovery was attempted */
  recoveryAttempted?: boolean;
}

/**
 * Options for wrapping a function with error handling
 */
export interface ClobWrapOptions {
  /** Description of the operation for logging */
  operation?: string;

  /** URL being accessed (for logging) */
  url?: string;

  /** HTTP method (for logging) */
  method?: string;

  /** Token ID involved (for logging) */
  tokenId?: string;

  /** Order ID involved (for logging) */
  orderId?: string;

  /** Override config for this specific call */
  config?: Partial<ClobErrorHandlerConfig>;
}

/**
 * Default retryable errors for CLOB API
 */
const DEFAULT_RETRYABLE_ERRORS: ClobErrorType[] = [
  ClobErrorType.SERVER,
  ClobErrorType.RATE_LIMIT,
  ClobErrorType.NETWORK,
  ClobErrorType.TIMEOUT,
  ClobErrorType.NONCE_ERROR, // Nonce errors can often be recovered by refreshing
];

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: Required<Omit<ClobErrorHandlerConfig, "logger" | "onError" | "onMaxRetriesExceeded" | "onRecoverableError">> & {
  logger: ClobErrorLogger;
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.2,
  retryableErrors: DEFAULT_RETRYABLE_ERRORS,
  enableLogging: true,
  logger: {
    info: (message, context) => console.log(`[CLOB-INFO] ${message}`, context ?? ""),
    warn: (message, context) => console.warn(`[CLOB-WARN] ${message}`, context ?? ""),
    error: (message, context) => console.error(`[CLOB-ERROR] ${message}`, context ?? ""),
  },
};

/**
 * Map error codes to error types
 */
const ERROR_CODE_MAP: Record<string, ClobErrorType> = {
  // Auth errors
  [ClobErrorCodes.MISSING_CREDENTIALS]: ClobErrorType.AUTH,
  [ClobErrorCodes.INVALID_API_KEY]: ClobErrorType.AUTH,
  [ClobErrorCodes.INVALID_SIGNATURE]: ClobErrorType.SIGNATURE_ERROR,
  [ClobErrorCodes.EXPIRED_TIMESTAMP]: ClobErrorType.AUTH,
  [ClobErrorCodes.INVALID_PASSPHRASE]: ClobErrorType.AUTH,

  // Order errors
  [ClobErrorCodes.ORDER_NOT_FOUND]: ClobErrorType.ORDER_NOT_FOUND,
  [ClobErrorCodes.DUPLICATE_ORDER]: ClobErrorType.DUPLICATE_ORDER,
  [ClobErrorCodes.ORDER_ALREADY_FILLED]: ClobErrorType.ORDER_NOT_FOUND,
  [ClobErrorCodes.ORDER_ALREADY_CANCELLED]: ClobErrorType.ORDER_NOT_FOUND,

  // Balance errors
  [ClobErrorCodes.INSUFFICIENT_BALANCE]: ClobErrorType.INSUFFICIENT_BALANCE,
  [ClobErrorCodes.INSUFFICIENT_ALLOWANCE]: ClobErrorType.INSUFFICIENT_BALANCE,

  // Validation errors
  [ClobErrorCodes.INVALID_PRICE]: ClobErrorType.INVALID_PRICE,
  [ClobErrorCodes.INVALID_SIZE]: ClobErrorType.INVALID_SIZE,
  [ClobErrorCodes.INVALID_SIDE]: ClobErrorType.VALIDATION,
  [ClobErrorCodes.INVALID_TOKEN_ID]: ClobErrorType.NOT_FOUND,
  [ClobErrorCodes.PRICE_OUT_OF_RANGE]: ClobErrorType.INVALID_PRICE,
  [ClobErrorCodes.SIZE_TOO_SMALL]: ClobErrorType.INVALID_SIZE,
  [ClobErrorCodes.SIZE_TOO_LARGE]: ClobErrorType.INVALID_SIZE,

  // Market errors
  [ClobErrorCodes.MARKET_NOT_FOUND]: ClobErrorType.NOT_FOUND,
  [ClobErrorCodes.MARKET_CLOSED]: ClobErrorType.MARKET_CLOSED,
  [ClobErrorCodes.MARKET_PAUSED]: ClobErrorType.MARKET_CLOSED,
  [ClobErrorCodes.MARKET_NOT_TRADEABLE]: ClobErrorType.MARKET_CLOSED,

  // Nonce errors
  [ClobErrorCodes.INVALID_NONCE]: ClobErrorType.NONCE_ERROR,
  [ClobErrorCodes.NONCE_TOO_LOW]: ClobErrorType.NONCE_ERROR,
  [ClobErrorCodes.NONCE_ALREADY_USED]: ClobErrorType.NONCE_ERROR,

  // Rate limiting
  [ClobErrorCodes.RATE_LIMITED]: ClobErrorType.RATE_LIMIT,
  [ClobErrorCodes.TOO_MANY_REQUESTS]: ClobErrorType.RATE_LIMIT,

  // Server errors
  [ClobErrorCodes.INTERNAL_ERROR]: ClobErrorType.SERVER,
  [ClobErrorCodes.SERVICE_UNAVAILABLE]: ClobErrorType.SERVER,
};

/**
 * Map error types to recovery actions
 */
const RECOVERY_ACTION_MAP: Record<ClobErrorType, RecoveryAction> = {
  [ClobErrorType.NETWORK]: RecoveryAction.NONE,
  [ClobErrorType.TIMEOUT]: RecoveryAction.NONE,
  [ClobErrorType.SERVER]: RecoveryAction.NONE,
  [ClobErrorType.RATE_LIMIT]: RecoveryAction.WAIT_RATE_LIMIT,
  [ClobErrorType.AUTH]: RecoveryAction.REFRESH_AUTH,
  [ClobErrorType.FORBIDDEN]: RecoveryAction.REFRESH_AUTH,
  [ClobErrorType.NOT_FOUND]: RecoveryAction.NONE,
  [ClobErrorType.VALIDATION]: RecoveryAction.NONE,
  [ClobErrorType.INSUFFICIENT_BALANCE]: RecoveryAction.REFRESH_BALANCE,
  [ClobErrorType.DUPLICATE_ORDER]: RecoveryAction.NONE,
  [ClobErrorType.ORDER_NOT_FOUND]: RecoveryAction.NONE,
  [ClobErrorType.MARKET_CLOSED]: RecoveryAction.REFRESH_MARKET,
  [ClobErrorType.NONCE_ERROR]: RecoveryAction.REFRESH_NONCE,
  [ClobErrorType.SIGNATURE_ERROR]: RecoveryAction.RESIGN_REQUEST,
  [ClobErrorType.INVALID_PRICE]: RecoveryAction.NONE,
  [ClobErrorType.INVALID_SIZE]: RecoveryAction.NONE,
  [ClobErrorType.PARSE]: RecoveryAction.NONE,
  [ClobErrorType.CLIENT]: RecoveryAction.NONE,
  [ClobErrorType.UNKNOWN]: RecoveryAction.NONE,
};

/**
 * Classify a CLOB API error into a ClobErrorType
 */
export function classifyClobError(error: unknown): {
  type: ClobErrorType;
  severity: ClobErrorSeverity;
  statusCode?: number;
  errorCode?: string;
} {
  // Handle ClobApiException
  if (error instanceof ClobApiException) {
    const statusCode = error.statusCode;
    const errorCode = error.code;

    // First check error code if available
    if (errorCode && errorCode in ERROR_CODE_MAP) {
      const type = ERROR_CODE_MAP[errorCode]!;
      return {
        type,
        severity: getSeverityForType(type),
        statusCode,
        errorCode,
      };
    }

    // Check error message for known patterns
    const message = error.message.toLowerCase();
    const typeFromMessage = getTypeFromMessage(message);
    if (typeFromMessage) {
      return {
        type: typeFromMessage,
        severity: getSeverityForType(typeFromMessage),
        statusCode,
        errorCode,
      };
    }

    // Fall back to status code classification
    if (statusCode === 429) {
      return { type: ClobErrorType.RATE_LIMIT, severity: ClobErrorSeverity.WARN, statusCode, errorCode };
    }
    if (statusCode === 401) {
      return { type: ClobErrorType.AUTH, severity: ClobErrorSeverity.CRITICAL, statusCode, errorCode };
    }
    if (statusCode === 403) {
      return { type: ClobErrorType.FORBIDDEN, severity: ClobErrorSeverity.CRITICAL, statusCode, errorCode };
    }
    if (statusCode === 404) {
      return { type: ClobErrorType.NOT_FOUND, severity: ClobErrorSeverity.ERROR, statusCode, errorCode };
    }
    if (statusCode >= 500) {
      return { type: ClobErrorType.SERVER, severity: ClobErrorSeverity.ERROR, statusCode, errorCode };
    }
    if (statusCode >= 400) {
      return { type: ClobErrorType.CLIENT, severity: ClobErrorSeverity.ERROR, statusCode, errorCode };
    }
  }

  // Handle standard Error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for timeout errors
    if (message.includes("timeout") || message.includes("aborted") || error.name === "AbortError") {
      return { type: ClobErrorType.TIMEOUT, severity: ClobErrorSeverity.WARN };
    }

    // Check for network errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("fetch failed") ||
      (error.name === "TypeError" && message.includes("fetch"))
    ) {
      return { type: ClobErrorType.NETWORK, severity: ClobErrorSeverity.WARN };
    }

    // Check for parse errors
    if (message.includes("json") || message.includes("parse") || error instanceof SyntaxError) {
      return { type: ClobErrorType.PARSE, severity: ClobErrorSeverity.ERROR };
    }

    // Check for CLOB-specific error patterns in generic errors
    const typeFromMessage = getTypeFromMessage(message);
    if (typeFromMessage) {
      return {
        type: typeFromMessage,
        severity: getSeverityForType(typeFromMessage),
      };
    }
  }

  // Default to unknown
  return { type: ClobErrorType.UNKNOWN, severity: ClobErrorSeverity.ERROR };
}

/**
 * Get error type from error message patterns
 */
function getTypeFromMessage(message: string): ClobErrorType | null {
  const lowerMessage = message.toLowerCase();

  // Balance errors
  if (lowerMessage.includes("insufficient balance") || lowerMessage.includes("not enough balance")) {
    return ClobErrorType.INSUFFICIENT_BALANCE;
  }
  if (lowerMessage.includes("insufficient allowance") || lowerMessage.includes("not enough allowance")) {
    return ClobErrorType.INSUFFICIENT_BALANCE;
  }

  // Order errors
  if (lowerMessage.includes("order not found") || lowerMessage.includes("order does not exist")) {
    return ClobErrorType.ORDER_NOT_FOUND;
  }
  if (lowerMessage.includes("duplicate") || lowerMessage.includes("already exists")) {
    return ClobErrorType.DUPLICATE_ORDER;
  }

  // Market errors
  if (lowerMessage.includes("market closed") || lowerMessage.includes("market is closed")) {
    return ClobErrorType.MARKET_CLOSED;
  }
  if (lowerMessage.includes("market not found") || lowerMessage.includes("token not found")) {
    return ClobErrorType.NOT_FOUND;
  }
  if (lowerMessage.includes("market paused") || lowerMessage.includes("trading paused")) {
    return ClobErrorType.MARKET_CLOSED;
  }

  // Nonce errors
  if (lowerMessage.includes("nonce") || lowerMessage.includes("nonce too low") || lowerMessage.includes("nonce already used")) {
    return ClobErrorType.NONCE_ERROR;
  }

  // Signature errors
  if (lowerMessage.includes("invalid signature") || lowerMessage.includes("signature verification failed")) {
    return ClobErrorType.SIGNATURE_ERROR;
  }

  // Price errors
  if (lowerMessage.includes("invalid price") || lowerMessage.includes("price out of range")) {
    return ClobErrorType.INVALID_PRICE;
  }

  // Size errors
  if (lowerMessage.includes("invalid size") || lowerMessage.includes("size too small") || lowerMessage.includes("size too large")) {
    return ClobErrorType.INVALID_SIZE;
  }

  // Auth errors
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("authentication") || lowerMessage.includes("invalid api key")) {
    return ClobErrorType.AUTH;
  }

  // Rate limit
  if (lowerMessage.includes("rate limit") || lowerMessage.includes("too many requests")) {
    return ClobErrorType.RATE_LIMIT;
  }

  return null;
}

/**
 * Get severity level for an error type
 */
function getSeverityForType(type: ClobErrorType): ClobErrorSeverity {
  switch (type) {
    case ClobErrorType.RATE_LIMIT:
    case ClobErrorType.TIMEOUT:
    case ClobErrorType.NETWORK:
      return ClobErrorSeverity.WARN;

    case ClobErrorType.AUTH:
    case ClobErrorType.FORBIDDEN:
    case ClobErrorType.SIGNATURE_ERROR:
      return ClobErrorSeverity.CRITICAL;

    case ClobErrorType.SERVER:
    case ClobErrorType.NOT_FOUND:
    case ClobErrorType.VALIDATION:
    case ClobErrorType.INSUFFICIENT_BALANCE:
    case ClobErrorType.DUPLICATE_ORDER:
    case ClobErrorType.ORDER_NOT_FOUND:
    case ClobErrorType.MARKET_CLOSED:
    case ClobErrorType.NONCE_ERROR:
    case ClobErrorType.INVALID_PRICE:
    case ClobErrorType.INVALID_SIZE:
    case ClobErrorType.PARSE:
    case ClobErrorType.CLIENT:
    case ClobErrorType.UNKNOWN:
      return ClobErrorSeverity.ERROR;
  }
}

/**
 * Get suggested recovery action for an error type
 */
export function getRecoveryAction(errorType: ClobErrorType): RecoveryAction {
  return RECOVERY_ACTION_MAP[errorType] ?? RecoveryAction.NONE;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateClobBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Apply max cap
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter: random value between (1 - jitterFactor) and (1 + jitterFactor)
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * jitterFactor;
  const finalDelay = Math.round(cappedDelay * jitterMultiplier);

  return Math.max(0, finalDelay);
}

/**
 * Check if an error should be retried based on its type
 */
export function shouldRetryClobError(
  errorType: ClobErrorType,
  attempt: number,
  maxRetries: number,
  retryableErrors: ClobErrorType[]
): boolean {
  // Don't retry if we've exceeded max attempts
  if (attempt >= maxRetries) {
    return false;
  }

  // Check if this error type is retryable
  return retryableErrors.includes(errorType);
}

/**
 * Create an error context object from an error
 */
export function createClobErrorContext(
  error: unknown,
  attempt: number,
  config: Required<Omit<ClobErrorHandlerConfig, "onError" | "onMaxRetriesExceeded" | "onRecoverableError" | "logger">> & {
    logger: ClobErrorLogger;
  },
  options?: ClobWrapOptions
): ClobErrorContext {
  const classified = classifyClobError(error);
  const willRetry = shouldRetryClobError(classified.type, attempt, config.maxRetries, config.retryableErrors);
  const retryDelay = willRetry
    ? calculateClobBackoffDelay(attempt, config.baseDelay, config.maxDelay, config.jitterFactor)
    : undefined;
  const recoveryAction = getRecoveryAction(classified.type);

  return {
    originalError: error instanceof Error ? error : new Error(String(error)),
    errorType: classified.type,
    severity: classified.severity,
    statusCode: classified.statusCode,
    errorCode: classified.errorCode,
    attempt,
    maxRetries: config.maxRetries,
    willRetry,
    retryDelay,
    operation: options?.operation,
    url: options?.url,
    method: options?.method,
    tokenId: options?.tokenId,
    orderId: options?.orderId,
    timestamp: new Date().toISOString(),
    recoveryAction: recoveryAction !== RecoveryAction.NONE ? recoveryAction : undefined,
  };
}

/**
 * Log a CLOB error context using the configured logger
 */
export function logClobError(
  context: ClobErrorContext,
  logger: ClobErrorLogger,
  enableLogging: boolean
): void {
  if (!enableLogging) {
    return;
  }

  const logData: Record<string, unknown> = {
    errorType: context.errorType,
    statusCode: context.statusCode,
    errorCode: context.errorCode,
    attempt: context.attempt + 1,
    maxRetries: context.maxRetries,
    willRetry: context.willRetry,
    retryDelay: context.retryDelay,
    operation: context.operation,
    url: context.url,
    method: context.method,
    message: context.originalError.message,
  };

  // Add optional context fields if present
  if (context.tokenId) logData.tokenId = context.tokenId;
  if (context.orderId) logData.orderId = context.orderId;
  if (context.recoveryAction) logData.recoveryAction = context.recoveryAction;
  if (context.recoveryAttempted !== undefined) logData.recoveryAttempted = context.recoveryAttempted;
  if (context.recoverySucceeded !== undefined) logData.recoverySucceeded = context.recoverySucceeded;

  const message = context.operation
    ? `${context.operation} failed: ${context.originalError.message}`
    : `CLOB API call failed: ${context.originalError.message}`;

  switch (context.severity) {
    case ClobErrorSeverity.INFO:
      logger.info(message, logData);
      break;
    case ClobErrorSeverity.WARN:
      logger.warn(message, logData);
      break;
    case ClobErrorSeverity.ERROR:
    case ClobErrorSeverity.CRITICAL:
      logger.error(message, logData);
      break;
  }
}

/**
 * Check if an error is a CLOB error of a specific type
 */
export function isClobErrorType(error: unknown, ...types: ClobErrorType[]): boolean {
  const classified = classifyClobError(error);
  return types.includes(classified.type);
}

/**
 * Check if an error is retryable by default
 */
export function isRetryableClobError(error: unknown): boolean {
  const classified = classifyClobError(error);
  return DEFAULT_RETRYABLE_ERRORS.includes(classified.type);
}

/**
 * Check if an error has a recovery action
 */
export function hasRecoveryAction(error: unknown): boolean {
  const classified = classifyClobError(error);
  return getRecoveryAction(classified.type) !== RecoveryAction.NONE;
}

/**
 * CLOB Error Handler class
 *
 * Provides a configurable error handling wrapper with retry logic,
 * exponential backoff, recovery strategies, and comprehensive logging.
 *
 * @example
 * ```typescript
 * const handler = new ClobErrorHandler({ maxRetries: 3 });
 *
 * const result = await handler.execute(
 *   async () => await client.get('/book?token_id=123'),
 *   { operation: 'Fetch order book', tokenId: '123' }
 * );
 *
 * if (result.success) {
 *   console.log('Order book:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export class ClobErrorHandler {
  private readonly config: Required<Omit<ClobErrorHandlerConfig, "onError" | "onMaxRetriesExceeded" | "onRecoverableError" | "logger">> & {
    logger: ClobErrorLogger;
    onError?: (context: ClobErrorContext) => void;
    onMaxRetriesExceeded?: (context: ClobErrorContext) => void;
    onRecoverableError?: (context: ClobErrorContext) => Promise<boolean>;
  };

  constructor(config: ClobErrorHandlerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      logger: config.logger ?? DEFAULT_CONFIG.logger,
      onError: config.onError,
      onMaxRetriesExceeded: config.onMaxRetriesExceeded,
      onRecoverableError: config.onRecoverableError,
    };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ClobErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Execute an async function with error handling and retry logic
   *
   * @param fn - The async function to execute
   * @param options - Options for this specific execution
   * @returns Result object with success status, data, and error context
   */
  public async execute<T>(
    fn: () => Promise<T>,
    options?: ClobWrapOptions
  ): Promise<ClobErrorHandlerResult<T>> {
    const startTime = Date.now();
    const mergedConfig = {
      ...this.config,
      ...options?.config,
      logger: options?.config?.logger ?? this.config.logger,
    };

    let attempt = 0;
    let recoveryAttempted = false;

    while (true) {
      try {
        const data = await fn();
        return {
          success: true,
          data,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
          recoveryAttempted,
        };
      } catch (error) {
        const context = createClobErrorContext(error, attempt, mergedConfig, options);

        // Log the error
        logClobError(context, mergedConfig.logger, mergedConfig.enableLogging);

        // Call error callback
        if (this.config.onError) {
          this.config.onError(context);
        }

        // Check if we should attempt recovery
        if (
          context.recoveryAction &&
          context.recoveryAction !== RecoveryAction.NONE &&
          this.config.onRecoverableError
        ) {
          try {
            context.recoveryAttempted = true;
            recoveryAttempted = true;
            const shouldRecover = await this.config.onRecoverableError(context);
            context.recoverySucceeded = shouldRecover;

            if (shouldRecover) {
              // Recovery succeeded, retry immediately (don't increment attempt for recovery)
              continue;
            }
          } catch {
            // Recovery failed, proceed with normal retry logic
            context.recoverySucceeded = false;
          }
        }

        // Check if we should retry
        if (context.willRetry && context.retryDelay !== undefined) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, context.retryDelay));
          attempt++;
          continue;
        }

        // Max retries exceeded or non-retryable error
        if (this.config.onMaxRetriesExceeded && attempt >= mergedConfig.maxRetries) {
          this.config.onMaxRetriesExceeded(context);
        }

        return {
          success: false,
          error: context,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
          recoveryAttempted,
        };
      }
    }
  }

  /**
   * Execute an async function with error handling, throwing on failure
   *
   * This is a convenience method that throws the original error if all
   * retries are exhausted, instead of returning an error result.
   *
   * @param fn - The async function to execute
   * @param options - Options for this specific execution
   * @returns The result of the function
   * @throws The original error if all retries fail
   */
  public async executeOrThrow<T>(
    fn: () => Promise<T>,
    options?: ClobWrapOptions
  ): Promise<T> {
    const result = await this.execute(fn, options);

    if (!result.success && result.error) {
      throw result.error.originalError;
    }

    return result.data as T;
  }

  /**
   * Wrap an async function with error handling
   *
   * Returns a new function that will automatically retry on failure.
   *
   * @param fn - The async function to wrap
   * @param options - Default options for all executions
   * @returns Wrapped function with error handling
   */
  public wrap<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options?: ClobWrapOptions
  ): (...args: TArgs) => Promise<ClobErrorHandlerResult<TResult>> {
    return async (...args: TArgs) => {
      return this.execute(() => fn(...args), options);
    };
  }

  /**
   * Wrap an async function with error handling that throws on failure
   *
   * @param fn - The async function to wrap
   * @param options - Default options for all executions
   * @returns Wrapped function that throws on failure
   */
  public wrapOrThrow<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options?: ClobWrapOptions
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs) => {
      return this.executeOrThrow(() => fn(...args), options);
    };
  }
}

/**
 * Create a new CLOB error handler with the specified configuration
 */
export function createClobErrorHandler(config: ClobErrorHandlerConfig = {}): ClobErrorHandler {
  return new ClobErrorHandler(config);
}

/**
 * Shared/default CLOB error handler instance
 */
let sharedClobErrorHandler: ClobErrorHandler | null = null;

/**
 * Get the shared CLOB error handler instance
 *
 * Creates the shared instance on first call if it doesn't exist.
 */
export function getSharedClobErrorHandler(): ClobErrorHandler {
  if (sharedClobErrorHandler === null) {
    sharedClobErrorHandler = new ClobErrorHandler();
  }
  return sharedClobErrorHandler;
}

/**
 * Reset the shared CLOB error handler instance
 *
 * This allows reconfiguring the shared handler or clearing its state.
 */
export function resetSharedClobErrorHandler(): void {
  sharedClobErrorHandler = null;
}

/**
 * Set the shared CLOB error handler to a custom instance
 */
export function setSharedClobErrorHandler(handler: ClobErrorHandler): void {
  sharedClobErrorHandler = handler;
}

/**
 * Convenience function to wrap an async function with the shared CLOB error handler
 *
 * @example
 * ```typescript
 * const result = await withClobErrorHandling(
 *   async () => await client.get('/book?token_id=123'),
 *   { operation: 'Fetch order book', tokenId: '123' }
 * );
 * ```
 */
export async function withClobErrorHandling<T>(
  fn: () => Promise<T>,
  options?: ClobWrapOptions
): Promise<ClobErrorHandlerResult<T>> {
  return getSharedClobErrorHandler().execute(fn, options);
}

/**
 * Convenience function that throws on failure
 *
 * @example
 * ```typescript
 * try {
 *   const orderBook = await withClobErrorHandlingOrThrow(
 *     async () => await client.get('/book?token_id=123'),
 *     { operation: 'Fetch order book', tokenId: '123' }
 *   );
 * } catch (error) {
 *   // Handle error
 * }
 * ```
 */
export async function withClobErrorHandlingOrThrow<T>(
  fn: () => Promise<T>,
  options?: ClobWrapOptions
): Promise<T> {
  return getSharedClobErrorHandler().executeOrThrow(fn, options);
}

/**
 * Create a user-friendly error message from a CLOB error context
 */
export function formatClobErrorMessage(context: ClobErrorContext): string {
  const parts: string[] = [];

  // Error type description
  switch (context.errorType) {
    case ClobErrorType.AUTH:
      parts.push("Authentication failed");
      break;
    case ClobErrorType.FORBIDDEN:
      parts.push("Access denied");
      break;
    case ClobErrorType.NOT_FOUND:
      parts.push("Resource not found");
      break;
    case ClobErrorType.RATE_LIMIT:
      parts.push("Rate limit exceeded");
      break;
    case ClobErrorType.SERVER:
      parts.push("Server error");
      break;
    case ClobErrorType.TIMEOUT:
      parts.push("Request timeout");
      break;
    case ClobErrorType.NETWORK:
      parts.push("Network error");
      break;
    case ClobErrorType.INSUFFICIENT_BALANCE:
      parts.push("Insufficient balance");
      break;
    case ClobErrorType.DUPLICATE_ORDER:
      parts.push("Duplicate order");
      break;
    case ClobErrorType.ORDER_NOT_FOUND:
      parts.push("Order not found");
      break;
    case ClobErrorType.MARKET_CLOSED:
      parts.push("Market closed");
      break;
    case ClobErrorType.NONCE_ERROR:
      parts.push("Nonce error");
      break;
    case ClobErrorType.SIGNATURE_ERROR:
      parts.push("Signature error");
      break;
    case ClobErrorType.INVALID_PRICE:
      parts.push("Invalid price");
      break;
    case ClobErrorType.INVALID_SIZE:
      parts.push("Invalid size");
      break;
    case ClobErrorType.VALIDATION:
      parts.push("Validation error");
      break;
    case ClobErrorType.PARSE:
      parts.push("Parse error");
      break;
    default:
      parts.push("Error");
  }

  // Add original message if available and different from type description
  const originalMessage = context.originalError.message;
  if (originalMessage && !parts[0]?.toLowerCase().includes(originalMessage.toLowerCase().substring(0, 10))) {
    parts.push(`- ${originalMessage}`);
  }

  // Add context info
  if (context.tokenId) {
    parts.push(`(token: ${context.tokenId})`);
  }
  if (context.orderId) {
    parts.push(`(order: ${context.orderId})`);
  }

  return parts.join(" ");
}
