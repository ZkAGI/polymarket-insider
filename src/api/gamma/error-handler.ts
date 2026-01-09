/**
 * Error Handler for Polymarket Gamma API
 *
 * Provides robust error handling with retry logic, exponential backoff,
 * and comprehensive logging for API operations.
 */

import { GammaApiException } from "./client";

/**
 * Error types that can occur during API operations
 */
export enum GammaErrorType {
  /** Network-level errors (connection refused, DNS failure, etc.) */
  NETWORK = "NETWORK",

  /** Request timeout */
  TIMEOUT = "TIMEOUT",

  /** Server errors (5xx status codes) */
  SERVER = "SERVER",

  /** Rate limiting (429 status code) */
  RATE_LIMIT = "RATE_LIMIT",

  /** Authentication/authorization errors (401, 403) */
  AUTH = "AUTH",

  /** Client errors (4xx status codes, except rate limit and auth) */
  CLIENT = "CLIENT",

  /** Invalid response format (JSON parsing errors, etc.) */
  PARSE = "PARSE",

  /** Unknown or unexpected errors */
  UNKNOWN = "UNKNOWN",
}

/**
 * Severity level for errors
 */
export enum ErrorSeverity {
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
 * Configuration for error handler
 */
export interface ErrorHandlerConfig {
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
   * Whether to retry on specific error types
   * By default, only SERVER and RATE_LIMIT errors are retried
   */
  retryableErrors?: GammaErrorType[];

  /**
   * Custom logger function
   * @default console.error for errors, console.warn for warnings
   */
  logger?: ErrorLogger;

  /**
   * Whether to enable logging
   * @default true
   */
  enableLogging?: boolean;

  /**
   * Callback when an error occurs (before retry)
   */
  onError?: (context: ErrorContext) => void;

  /**
   * Callback when all retries are exhausted
   */
  onMaxRetriesExceeded?: (context: ErrorContext) => void;
}

/**
 * Logger interface for error handler
 */
export interface ErrorLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Context information about an error
 */
export interface ErrorContext {
  /** The original error that occurred */
  originalError: Error;

  /** Classified error type */
  errorType: GammaErrorType;

  /** Error severity level */
  severity: ErrorSeverity;

  /** HTTP status code (if available) */
  statusCode?: number;

  /** Error code/message from API (if available) */
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
}

/**
 * Result of an error handling operation
 */
export interface ErrorHandlerResult<T> {
  /** Whether the operation was successful */
  success: boolean;

  /** Result data (if successful) */
  data?: T;

  /** Error context (if failed) */
  error?: ErrorContext;

  /** Total attempts made */
  attempts: number;

  /** Total time spent including retries (in ms) */
  totalTime: number;
}

/**
 * Options for wrapping a function with error handling
 */
export interface WrapWithErrorHandlingOptions {
  /** Description of the operation for logging */
  operation?: string;

  /** URL being accessed (for logging) */
  url?: string;

  /** HTTP method (for logging) */
  method?: string;

  /** Override config for this specific call */
  config?: Partial<ErrorHandlerConfig>;
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: Required<Omit<ErrorHandlerConfig, "logger" | "onError" | "onMaxRetriesExceeded">> & {
  logger: ErrorLogger;
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.2,
  retryableErrors: [GammaErrorType.SERVER, GammaErrorType.RATE_LIMIT, GammaErrorType.NETWORK, GammaErrorType.TIMEOUT],
  enableLogging: true,
  logger: {
    info: (message, context) => console.log(`[INFO] ${message}`, context ?? ""),
    warn: (message, context) => console.warn(`[WARN] ${message}`, context ?? ""),
    error: (message, context) => console.error(`[ERROR] ${message}`, context ?? ""),
  },
};

/**
 * Classify an error into a GammaErrorType
 */
export function classifyError(error: unknown): { type: GammaErrorType; severity: ErrorSeverity; statusCode?: number; errorCode?: string } {
  // Handle GammaApiException
  if (error instanceof GammaApiException) {
    const statusCode = error.statusCode;

    if (statusCode === 429) {
      return { type: GammaErrorType.RATE_LIMIT, severity: ErrorSeverity.WARN, statusCode, errorCode: error.code };
    }
    if (statusCode === 401 || statusCode === 403) {
      return { type: GammaErrorType.AUTH, severity: ErrorSeverity.CRITICAL, statusCode, errorCode: error.code };
    }
    if (statusCode >= 500) {
      return { type: GammaErrorType.SERVER, severity: ErrorSeverity.ERROR, statusCode, errorCode: error.code };
    }
    if (statusCode >= 400) {
      return { type: GammaErrorType.CLIENT, severity: ErrorSeverity.ERROR, statusCode, errorCode: error.code };
    }
  }

  // Handle standard Error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for timeout errors
    if (message.includes("timeout") || message.includes("aborted") || error.name === "AbortError") {
      return { type: GammaErrorType.TIMEOUT, severity: ErrorSeverity.WARN };
    }

    // Check for network errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("fetch failed") ||
      error.name === "TypeError" && message.includes("fetch")
    ) {
      return { type: GammaErrorType.NETWORK, severity: ErrorSeverity.WARN };
    }

    // Check for parse errors
    if (message.includes("json") || message.includes("parse") || error instanceof SyntaxError) {
      return { type: GammaErrorType.PARSE, severity: ErrorSeverity.ERROR };
    }
  }

  // Default to unknown
  return { type: GammaErrorType.UNKNOWN, severity: ErrorSeverity.ERROR };
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
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
export function shouldRetry(
  errorType: GammaErrorType,
  attempt: number,
  maxRetries: number,
  retryableErrors: GammaErrorType[]
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
export function createErrorContext(
  error: unknown,
  attempt: number,
  config: Required<Omit<ErrorHandlerConfig, "onError" | "onMaxRetriesExceeded" | "logger">> & { logger: ErrorLogger },
  options?: WrapWithErrorHandlingOptions
): ErrorContext {
  const classified = classifyError(error);
  const willRetry = shouldRetry(classified.type, attempt, config.maxRetries, config.retryableErrors);
  const retryDelay = willRetry
    ? calculateBackoffDelay(attempt, config.baseDelay, config.maxDelay, config.jitterFactor)
    : undefined;

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
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log an error context using the configured logger
 */
export function logError(
  context: ErrorContext,
  logger: ErrorLogger,
  enableLogging: boolean
): void {
  if (!enableLogging) {
    return;
  }

  const logData = {
    errorType: context.errorType,
    statusCode: context.statusCode,
    attempt: context.attempt + 1,
    maxRetries: context.maxRetries,
    willRetry: context.willRetry,
    retryDelay: context.retryDelay,
    operation: context.operation,
    url: context.url,
    method: context.method,
    message: context.originalError.message,
  };

  const message = context.operation
    ? `${context.operation} failed: ${context.originalError.message}`
    : `API call failed: ${context.originalError.message}`;

  switch (context.severity) {
    case ErrorSeverity.INFO:
      logger.info(message, logData);
      break;
    case ErrorSeverity.WARN:
      logger.warn(message, logData);
      break;
    case ErrorSeverity.ERROR:
    case ErrorSeverity.CRITICAL:
      logger.error(message, logData);
      break;
  }
}

/**
 * Error Handler class for Gamma API operations
 *
 * Provides a configurable error handling wrapper with retry logic,
 * exponential backoff, and comprehensive logging.
 *
 * @example
 * ```typescript
 * const handler = new ErrorHandler({ maxRetries: 3 });
 *
 * const result = await handler.execute(
 *   async () => await client.get('/markets'),
 *   { operation: 'Fetch markets' }
 * );
 *
 * if (result.success) {
 *   console.log('Markets:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export class ErrorHandler {
  private readonly config: Required<Omit<ErrorHandlerConfig, "onError" | "onMaxRetriesExceeded" | "logger">> & {
    logger: ErrorLogger;
    onError?: (context: ErrorContext) => void;
    onMaxRetriesExceeded?: (context: ErrorContext) => void;
  };

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      logger: config.logger ?? DEFAULT_CONFIG.logger,
      onError: config.onError,
      onMaxRetriesExceeded: config.onMaxRetriesExceeded,
    };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ErrorHandlerConfig {
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
    options?: WrapWithErrorHandlingOptions
  ): Promise<ErrorHandlerResult<T>> {
    const startTime = Date.now();
    const mergedConfig = {
      ...this.config,
      ...options?.config,
      logger: options?.config?.logger ?? this.config.logger,
    };

    let attempt = 0;

    while (true) {
      try {
        const data = await fn();
        return {
          success: true,
          data,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        const context = createErrorContext(error, attempt, mergedConfig, options);

        // Log the error
        logError(context, mergedConfig.logger, mergedConfig.enableLogging);

        // Call error callback
        if (this.config.onError) {
          this.config.onError(context);
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
    options?: WrapWithErrorHandlingOptions
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
    options?: WrapWithErrorHandlingOptions
  ): (...args: TArgs) => Promise<ErrorHandlerResult<TResult>> {
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
    options?: WrapWithErrorHandlingOptions
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs) => {
      return this.executeOrThrow(() => fn(...args), options);
    };
  }
}

/**
 * Create a new error handler with the specified configuration
 */
export function createErrorHandler(config: ErrorHandlerConfig = {}): ErrorHandler {
  return new ErrorHandler(config);
}

/**
 * Shared/default error handler instance
 */
let sharedErrorHandler: ErrorHandler | null = null;

/**
 * Get the shared error handler instance
 *
 * Creates the shared instance on first call if it doesn't exist.
 */
export function getSharedErrorHandler(): ErrorHandler {
  if (sharedErrorHandler === null) {
    sharedErrorHandler = new ErrorHandler();
  }
  return sharedErrorHandler;
}

/**
 * Reset the shared error handler instance
 *
 * This allows reconfiguring the shared handler or clearing its state.
 */
export function resetSharedErrorHandler(): void {
  sharedErrorHandler = null;
}

/**
 * Set the shared error handler to a custom instance
 */
export function setSharedErrorHandler(handler: ErrorHandler): void {
  sharedErrorHandler = handler;
}

/**
 * Convenience function to wrap an async function with the shared error handler
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   async () => await client.get('/markets'),
 *   { operation: 'Fetch markets' }
 * );
 * ```
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: WrapWithErrorHandlingOptions
): Promise<ErrorHandlerResult<T>> {
  return getSharedErrorHandler().execute(fn, options);
}

/**
 * Convenience function that throws on failure
 *
 * @example
 * ```typescript
 * try {
 *   const markets = await withErrorHandlingOrThrow(
 *     async () => await client.get('/markets'),
 *     { operation: 'Fetch markets' }
 *   );
 * } catch (error) {
 *   // Handle error
 * }
 * ```
 */
export async function withErrorHandlingOrThrow<T>(
  fn: () => Promise<T>,
  options?: WrapWithErrorHandlingOptions
): Promise<T> {
  return getSharedErrorHandler().executeOrThrow(fn, options);
}
