/**
 * Tests for Gamma API Error Handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ErrorHandler,
  GammaErrorType,
  ErrorSeverity,
  classifyError,
  calculateBackoffDelay,
  shouldRetry,
  createErrorContext,
  logError,
  createErrorHandler,
  getSharedErrorHandler,
  resetSharedErrorHandler,
  setSharedErrorHandler,
  withErrorHandling,
  withErrorHandlingOrThrow,
  ErrorLogger,
  ErrorContext,
} from "../../../src/api/gamma/error-handler";
import { GammaApiException } from "../../../src/api/gamma/client";

describe("classifyError", () => {
  describe("GammaApiException classification", () => {
    it("should classify 429 as RATE_LIMIT with WARN severity", () => {
      const error = new GammaApiException({ message: "Too many requests", statusCode: 429 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.RATE_LIMIT);
      expect(result.severity).toBe(ErrorSeverity.WARN);
      expect(result.statusCode).toBe(429);
    });

    it("should classify 401 as AUTH with CRITICAL severity", () => {
      const error = new GammaApiException({ message: "Unauthorized", statusCode: 401 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.AUTH);
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.statusCode).toBe(401);
    });

    it("should classify 403 as AUTH with CRITICAL severity", () => {
      const error = new GammaApiException({ message: "Forbidden", statusCode: 403 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.AUTH);
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.statusCode).toBe(403);
    });

    it("should classify 500 as SERVER with ERROR severity", () => {
      const error = new GammaApiException({ message: "Internal server error", statusCode: 500 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.SERVER);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.statusCode).toBe(500);
    });

    it("should classify 502 as SERVER with ERROR severity", () => {
      const error = new GammaApiException({ message: "Bad gateway", statusCode: 502 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.SERVER);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.statusCode).toBe(502);
    });

    it("should classify 503 as SERVER with ERROR severity", () => {
      const error = new GammaApiException({ message: "Service unavailable", statusCode: 503 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.SERVER);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.statusCode).toBe(503);
    });

    it("should classify 400 as CLIENT with ERROR severity", () => {
      const error = new GammaApiException({ message: "Bad request", statusCode: 400 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.CLIENT);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.statusCode).toBe(400);
    });

    it("should classify 404 as CLIENT with ERROR severity", () => {
      const error = new GammaApiException({ message: "Not found", statusCode: 404 });
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.CLIENT);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.statusCode).toBe(404);
    });

    it("should preserve error code from GammaApiException", () => {
      const error = new GammaApiException({ message: "Error", statusCode: 500, code: "SERVER_ERROR" });
      const result = classifyError(error);

      expect(result.errorCode).toBe("SERVER_ERROR");
    });
  });

  describe("Standard Error classification", () => {
    it("should classify timeout errors as TIMEOUT", () => {
      const error = new Error("Request timeout after 30000ms");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify aborted errors as TIMEOUT", () => {
      const error = new Error("The operation was aborted");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify AbortError as TIMEOUT", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify network errors as NETWORK", () => {
      const error = new Error("Network request failed");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify connection errors as NETWORK", () => {
      const error = new Error("ECONNREFUSED");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify DNS errors as NETWORK", () => {
      const error = new Error("ENOTFOUND");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify fetch failed as NETWORK", () => {
      const error = new Error("fetch failed");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.WARN);
    });

    it("should classify JSON parse errors as PARSE", () => {
      const error = new Error("Unexpected token in JSON");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.PARSE);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });

    it("should classify SyntaxError as PARSE", () => {
      const error = new SyntaxError("Unexpected token");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.PARSE);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });

    it("should classify unknown errors as UNKNOWN", () => {
      const error = new Error("Something went wrong");
      const result = classifyError(error);

      expect(result.type).toBe(GammaErrorType.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });
  });

  describe("Non-Error classification", () => {
    it("should classify non-Error values as UNKNOWN", () => {
      const result = classifyError("string error");

      expect(result.type).toBe(GammaErrorType.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });

    it("should classify null as UNKNOWN", () => {
      const result = classifyError(null);

      expect(result.type).toBe(GammaErrorType.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });

    it("should classify undefined as UNKNOWN", () => {
      const result = classifyError(undefined);

      expect(result.type).toBe(GammaErrorType.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
    });
  });
});

describe("calculateBackoffDelay", () => {
  it("should return base delay for attempt 0", () => {
    // With jitter set to 0, we should get exactly the base delay
    const delay = calculateBackoffDelay(0, 1000, 30000, 0);
    expect(delay).toBe(1000);
  });

  it("should double delay for each attempt", () => {
    const delay0 = calculateBackoffDelay(0, 1000, 30000, 0);
    const delay1 = calculateBackoffDelay(1, 1000, 30000, 0);
    const delay2 = calculateBackoffDelay(2, 1000, 30000, 0);

    expect(delay0).toBe(1000);
    expect(delay1).toBe(2000);
    expect(delay2).toBe(4000);
  });

  it("should cap delay at maxDelay", () => {
    const delay = calculateBackoffDelay(10, 1000, 5000, 0);
    expect(delay).toBe(5000);
  });

  it("should add jitter within expected range", () => {
    const baseDelay = 1000;
    const jitterFactor = 0.2;

    // Run multiple times to check jitter varies
    const delays = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoffDelay(0, baseDelay, 30000, jitterFactor);
      delays.add(delay);
      // With 0.2 jitter, delay should be between 800 and 1200
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(1200);
    }

    // Should have some variation (not all the same)
    expect(delays.size).toBeGreaterThan(1);
  });

  it("should never return negative values", () => {
    const delay = calculateBackoffDelay(0, 0, 0, 0.5);
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

describe("shouldRetry", () => {
  const defaultRetryable = [GammaErrorType.SERVER, GammaErrorType.RATE_LIMIT, GammaErrorType.NETWORK, GammaErrorType.TIMEOUT];

  it("should return true for retryable errors within retry limit", () => {
    expect(shouldRetry(GammaErrorType.SERVER, 0, 3, defaultRetryable)).toBe(true);
    expect(shouldRetry(GammaErrorType.RATE_LIMIT, 1, 3, defaultRetryable)).toBe(true);
    expect(shouldRetry(GammaErrorType.NETWORK, 2, 3, defaultRetryable)).toBe(true);
  });

  it("should return false when max retries exceeded", () => {
    expect(shouldRetry(GammaErrorType.SERVER, 3, 3, defaultRetryable)).toBe(false);
    expect(shouldRetry(GammaErrorType.SERVER, 4, 3, defaultRetryable)).toBe(false);
  });

  it("should return false for non-retryable errors", () => {
    expect(shouldRetry(GammaErrorType.AUTH, 0, 3, defaultRetryable)).toBe(false);
    expect(shouldRetry(GammaErrorType.CLIENT, 0, 3, defaultRetryable)).toBe(false);
    expect(shouldRetry(GammaErrorType.PARSE, 0, 3, defaultRetryable)).toBe(false);
  });

  it("should respect custom retryable errors list", () => {
    const customRetryable = [GammaErrorType.AUTH];
    expect(shouldRetry(GammaErrorType.AUTH, 0, 3, customRetryable)).toBe(true);
    expect(shouldRetry(GammaErrorType.SERVER, 0, 3, customRetryable)).toBe(false);
  });

  it("should return false for empty retryable list", () => {
    expect(shouldRetry(GammaErrorType.SERVER, 0, 3, [])).toBe(false);
  });
});

describe("createErrorContext", () => {
  const defaultConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0,
    retryableErrors: [GammaErrorType.SERVER, GammaErrorType.RATE_LIMIT],
    enableLogging: true,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  it("should create context with all required fields", () => {
    const error = new GammaApiException({ message: "Server error", statusCode: 500 });
    const context = createErrorContext(error, 0, defaultConfig);

    expect(context.originalError).toBe(error);
    expect(context.errorType).toBe(GammaErrorType.SERVER);
    expect(context.severity).toBe(ErrorSeverity.ERROR);
    expect(context.statusCode).toBe(500);
    expect(context.attempt).toBe(0);
    expect(context.maxRetries).toBe(3);
    expect(context.willRetry).toBe(true);
    expect(context.retryDelay).toBe(1000);
    expect(context.timestamp).toBeDefined();
  });

  it("should include options when provided", () => {
    const error = new Error("Test error");
    const options = {
      operation: "Fetch markets",
      url: "/markets",
      method: "GET" as const,
    };
    const context = createErrorContext(error, 0, defaultConfig, options);

    expect(context.operation).toBe("Fetch markets");
    expect(context.url).toBe("/markets");
    expect(context.method).toBe("GET");
  });

  it("should set willRetry to false when max retries exceeded", () => {
    const error = new GammaApiException({ message: "Server error", statusCode: 500 });
    const context = createErrorContext(error, 3, defaultConfig);

    expect(context.willRetry).toBe(false);
    expect(context.retryDelay).toBeUndefined();
  });

  it("should set willRetry to false for non-retryable errors", () => {
    const error = new GammaApiException({ message: "Bad request", statusCode: 400 });
    const context = createErrorContext(error, 0, defaultConfig);

    expect(context.willRetry).toBe(false);
    expect(context.retryDelay).toBeUndefined();
  });

  it("should convert non-Error to Error", () => {
    const context = createErrorContext("string error", 0, defaultConfig);

    expect(context.originalError).toBeInstanceOf(Error);
    expect(context.originalError.message).toBe("string error");
  });
});

describe("logError", () => {
  let mockLogger: ErrorLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it("should log to error for ERROR severity", () => {
    const context: ErrorContext = {
      originalError: new Error("Test error"),
      errorType: GammaErrorType.SERVER,
      severity: ErrorSeverity.ERROR,
      statusCode: 500,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    logError(context, mockLogger, true);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should log to warn for WARN severity", () => {
    const context: ErrorContext = {
      originalError: new Error("Rate limited"),
      errorType: GammaErrorType.RATE_LIMIT,
      severity: ErrorSeverity.WARN,
      statusCode: 429,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    logError(context, mockLogger, true);

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should log to info for INFO severity", () => {
    const context: ErrorContext = {
      originalError: new Error("Info message"),
      errorType: GammaErrorType.UNKNOWN,
      severity: ErrorSeverity.INFO,
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    logError(context, mockLogger, true);

    expect(mockLogger.info).toHaveBeenCalled();
  });

  it("should not log when enableLogging is false", () => {
    const context: ErrorContext = {
      originalError: new Error("Test error"),
      errorType: GammaErrorType.SERVER,
      severity: ErrorSeverity.ERROR,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    logError(context, mockLogger, false);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should include operation in message when provided", () => {
    const context: ErrorContext = {
      originalError: new Error("Test error"),
      errorType: GammaErrorType.SERVER,
      severity: ErrorSeverity.ERROR,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      operation: "Fetch markets",
      timestamp: new Date().toISOString(),
    };

    logError(context, mockLogger, true);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Fetch markets"),
      expect.any(Object)
    );
  });
});

describe("ErrorHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should use default config when none provided", () => {
      const handler = new ErrorHandler();
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.maxDelay).toBe(30000);
    });

    it("should merge custom config with defaults", () => {
      const handler = new ErrorHandler({ maxRetries: 5 });
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(1000); // default preserved
    });
  });

  describe("execute", () => {
    it("should return success result on successful execution", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const fn = vi.fn().mockResolvedValue({ data: "test" });

      const result = await handler.execute(fn);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "test" });
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const handler = new ErrorHandler({
        maxRetries: 3,
        baseDelay: 100,
        jitterFactor: 0,
        enableLogging: false,
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new GammaApiException({ message: "Server error", statusCode: 500 }))
        .mockRejectedValueOnce(new GammaApiException({ message: "Server error", statusCode: 500 }))
        .mockResolvedValue({ data: "success" });

      const resultPromise = handler.execute(fn);

      // Advance through the backoff delays
      await vi.advanceTimersByTimeAsync(100); // First retry delay
      await vi.advanceTimersByTimeAsync(200); // Second retry delay

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "success" });
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should return failure when max retries exceeded", async () => {
      const handler = new ErrorHandler({
        maxRetries: 2,
        baseDelay: 100,
        jitterFactor: 0,
        enableLogging: false,
      });

      const serverError = new GammaApiException({ message: "Server error", statusCode: 500 });
      const fn = vi.fn().mockRejectedValue(serverError);

      const resultPromise = handler.execute(fn);

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(GammaErrorType.SERVER);
      expect(result.attempts).toBe(3); // Initial + 2 retries
    });

    it("should not retry on non-retryable errors", async () => {
      const handler = new ErrorHandler({ enableLogging: false });

      const clientError = new GammaApiException({ message: "Bad request", statusCode: 400 });
      const fn = vi.fn().mockRejectedValue(clientError);

      const result = await handler.execute(fn);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(GammaErrorType.CLIENT);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should call onError callback on each error", async () => {
      const onError = vi.fn();
      const handler = new ErrorHandler({
        maxRetries: 2,
        baseDelay: 100,
        jitterFactor: 0,
        enableLogging: false,
        onError,
      });

      const fn = vi.fn().mockRejectedValue(new GammaApiException({ message: "Server error", statusCode: 500 }));

      const resultPromise = handler.execute(fn);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;

      expect(onError).toHaveBeenCalledTimes(3);
    });

    it("should call onMaxRetriesExceeded when retries exhausted", async () => {
      const onMaxRetriesExceeded = vi.fn();
      const handler = new ErrorHandler({
        maxRetries: 1,
        baseDelay: 100,
        jitterFactor: 0,
        enableLogging: false,
        onMaxRetriesExceeded,
      });

      const fn = vi.fn().mockRejectedValue(new GammaApiException({ message: "Server error", statusCode: 500 }));

      const resultPromise = handler.execute(fn);
      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;

      expect(onMaxRetriesExceeded).toHaveBeenCalledTimes(1);
    });

    it("should include operation info in error context", async () => {
      const handler = new ErrorHandler({ enableLogging: false });

      const fn = vi.fn().mockRejectedValue(new GammaApiException({ message: "Error", statusCode: 400 }));

      const result = await handler.execute(fn, {
        operation: "Fetch markets",
        url: "/markets",
        method: "GET",
      });

      expect(result.error?.operation).toBe("Fetch markets");
      expect(result.error?.url).toBe("/markets");
      expect(result.error?.method).toBe("GET");
    });
  });

  describe("executeOrThrow", () => {
    it("should return data on success", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const fn = vi.fn().mockResolvedValue({ data: "test" });

      const result = await handler.executeOrThrow(fn);

      expect(result).toEqual({ data: "test" });
    });

    it("should throw original error on failure", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const error = new GammaApiException({ message: "Bad request", statusCode: 400 });
      const fn = vi.fn().mockRejectedValue(error);

      await expect(handler.executeOrThrow(fn)).rejects.toThrow(error);
    });
  });

  describe("wrap", () => {
    it("should return wrapped function that uses error handling", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const fn = vi.fn(async (x: number) => x * 2);

      const wrapped = handler.wrap(fn);
      const result = await wrapped(5);

      expect(result.success).toBe(true);
      expect(result.data).toBe(10);
    });

    it("should pass arguments to wrapped function", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const fn = vi.fn(async (a: string, b: number) => `${a}-${b}`);

      const wrapped = handler.wrap(fn);
      const result = await wrapped("test", 123);

      expect(result.data).toBe("test-123");
      expect(fn).toHaveBeenCalledWith("test", 123);
    });
  });

  describe("wrapOrThrow", () => {
    it("should return wrapped function that throws on failure", async () => {
      const handler = new ErrorHandler({ enableLogging: false });
      const error = new Error("Test error");
      const fn = vi.fn().mockRejectedValue(error);

      const wrapped = handler.wrapOrThrow(fn);

      await expect(wrapped()).rejects.toThrow(error);
    });
  });
});

describe("createErrorHandler", () => {
  it("should create error handler with default config", () => {
    const handler = createErrorHandler();
    const config = handler.getConfig();

    expect(config.maxRetries).toBe(3);
  });

  it("should create error handler with custom config", () => {
    const handler = createErrorHandler({ maxRetries: 5 });
    const config = handler.getConfig();

    expect(config.maxRetries).toBe(5);
  });
});

describe("Shared error handler", () => {
  afterEach(() => {
    resetSharedErrorHandler();
  });

  it("should return same instance from getSharedErrorHandler", () => {
    const handler1 = getSharedErrorHandler();
    const handler2 = getSharedErrorHandler();

    expect(handler1).toBe(handler2);
  });

  it("should reset shared handler on resetSharedErrorHandler", () => {
    const handler1 = getSharedErrorHandler();
    resetSharedErrorHandler();
    const handler2 = getSharedErrorHandler();

    expect(handler1).not.toBe(handler2);
  });

  it("should allow setting custom shared handler", () => {
    const customHandler = createErrorHandler({ maxRetries: 10 });
    setSharedErrorHandler(customHandler);

    expect(getSharedErrorHandler()).toBe(customHandler);
  });
});

describe("withErrorHandling", () => {
  afterEach(() => {
    resetSharedErrorHandler();
  });

  it("should use shared error handler", async () => {
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withErrorHandling(fn);

    expect(result.success).toBe(true);
    expect(result.data).toBe("result");
  });

  it("should pass options to handler", async () => {
    const fn = vi.fn().mockRejectedValue(new GammaApiException({ message: "Error", statusCode: 400 }));

    const result = await withErrorHandling(fn, { operation: "Test operation" });

    expect(result.error?.operation).toBe("Test operation");
  });
});

describe("withErrorHandlingOrThrow", () => {
  afterEach(() => {
    resetSharedErrorHandler();
  });

  it("should return data on success", async () => {
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withErrorHandlingOrThrow(fn);

    expect(result).toBe("result");
  });

  it("should throw on failure", async () => {
    const error = new GammaApiException({ message: "Error", statusCode: 400 });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withErrorHandlingOrThrow(fn)).rejects.toThrow(error);
  });
});

describe("GammaErrorType enum", () => {
  it("should have all expected error types", () => {
    expect(GammaErrorType.NETWORK).toBe("NETWORK");
    expect(GammaErrorType.TIMEOUT).toBe("TIMEOUT");
    expect(GammaErrorType.SERVER).toBe("SERVER");
    expect(GammaErrorType.RATE_LIMIT).toBe("RATE_LIMIT");
    expect(GammaErrorType.AUTH).toBe("AUTH");
    expect(GammaErrorType.CLIENT).toBe("CLIENT");
    expect(GammaErrorType.PARSE).toBe("PARSE");
    expect(GammaErrorType.UNKNOWN).toBe("UNKNOWN");
  });
});

describe("ErrorSeverity enum", () => {
  it("should have all expected severity levels", () => {
    expect(ErrorSeverity.INFO).toBe("INFO");
    expect(ErrorSeverity.WARN).toBe("WARN");
    expect(ErrorSeverity.ERROR).toBe("ERROR");
    expect(ErrorSeverity.CRITICAL).toBe("CRITICAL");
  });
});
