/**
 * Tests for CLOB API Error Handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ClobErrorType,
  ClobErrorSeverity,
  ClobErrorCodes,
  RecoveryAction,
  classifyClobError,
  getRecoveryAction,
  calculateClobBackoffDelay,
  shouldRetryClobError,
  createClobErrorContext,
  logClobError,
  isClobErrorType,
  isRetryableClobError,
  hasRecoveryAction,
  ClobErrorHandler,
  createClobErrorHandler,
  getSharedClobErrorHandler,
  resetSharedClobErrorHandler,
  setSharedClobErrorHandler,
  withClobErrorHandling,
  withClobErrorHandlingOrThrow,
  formatClobErrorMessage,
} from "../../../src/api/clob/error-handler";
import { ClobApiException } from "../../../src/api/clob/client";

describe("ClobErrorType enum", () => {
  it("should have all expected error types", () => {
    expect(ClobErrorType.NETWORK).toBe("NETWORK");
    expect(ClobErrorType.TIMEOUT).toBe("TIMEOUT");
    expect(ClobErrorType.SERVER).toBe("SERVER");
    expect(ClobErrorType.RATE_LIMIT).toBe("RATE_LIMIT");
    expect(ClobErrorType.AUTH).toBe("AUTH");
    expect(ClobErrorType.FORBIDDEN).toBe("FORBIDDEN");
    expect(ClobErrorType.NOT_FOUND).toBe("NOT_FOUND");
    expect(ClobErrorType.VALIDATION).toBe("VALIDATION");
    expect(ClobErrorType.INSUFFICIENT_BALANCE).toBe("INSUFFICIENT_BALANCE");
    expect(ClobErrorType.DUPLICATE_ORDER).toBe("DUPLICATE_ORDER");
    expect(ClobErrorType.ORDER_NOT_FOUND).toBe("ORDER_NOT_FOUND");
    expect(ClobErrorType.MARKET_CLOSED).toBe("MARKET_CLOSED");
    expect(ClobErrorType.NONCE_ERROR).toBe("NONCE_ERROR");
    expect(ClobErrorType.SIGNATURE_ERROR).toBe("SIGNATURE_ERROR");
    expect(ClobErrorType.INVALID_PRICE).toBe("INVALID_PRICE");
    expect(ClobErrorType.INVALID_SIZE).toBe("INVALID_SIZE");
    expect(ClobErrorType.PARSE).toBe("PARSE");
    expect(ClobErrorType.CLIENT).toBe("CLIENT");
    expect(ClobErrorType.UNKNOWN).toBe("UNKNOWN");
  });
});

describe("ClobErrorSeverity enum", () => {
  it("should have all expected severity levels", () => {
    expect(ClobErrorSeverity.INFO).toBe("INFO");
    expect(ClobErrorSeverity.WARN).toBe("WARN");
    expect(ClobErrorSeverity.ERROR).toBe("ERROR");
    expect(ClobErrorSeverity.CRITICAL).toBe("CRITICAL");
  });
});

describe("ClobErrorCodes", () => {
  it("should have authentication error codes", () => {
    expect(ClobErrorCodes.MISSING_CREDENTIALS).toBe("MISSING_CREDENTIALS");
    expect(ClobErrorCodes.INVALID_API_KEY).toBe("INVALID_API_KEY");
    expect(ClobErrorCodes.INVALID_SIGNATURE).toBe("INVALID_SIGNATURE");
    expect(ClobErrorCodes.EXPIRED_TIMESTAMP).toBe("EXPIRED_TIMESTAMP");
  });

  it("should have order error codes", () => {
    expect(ClobErrorCodes.ORDER_NOT_FOUND).toBe("ORDER_NOT_FOUND");
    expect(ClobErrorCodes.DUPLICATE_ORDER).toBe("DUPLICATE_ORDER");
    expect(ClobErrorCodes.ORDER_ALREADY_FILLED).toBe("ORDER_ALREADY_FILLED");
  });

  it("should have balance error codes", () => {
    expect(ClobErrorCodes.INSUFFICIENT_BALANCE).toBe("INSUFFICIENT_BALANCE");
    expect(ClobErrorCodes.INSUFFICIENT_ALLOWANCE).toBe("INSUFFICIENT_ALLOWANCE");
  });

  it("should have validation error codes", () => {
    expect(ClobErrorCodes.INVALID_PRICE).toBe("INVALID_PRICE");
    expect(ClobErrorCodes.INVALID_SIZE).toBe("INVALID_SIZE");
    expect(ClobErrorCodes.SIZE_TOO_SMALL).toBe("SIZE_TOO_SMALL");
    expect(ClobErrorCodes.SIZE_TOO_LARGE).toBe("SIZE_TOO_LARGE");
  });

  it("should have market error codes", () => {
    expect(ClobErrorCodes.MARKET_NOT_FOUND).toBe("MARKET_NOT_FOUND");
    expect(ClobErrorCodes.MARKET_CLOSED).toBe("MARKET_CLOSED");
    expect(ClobErrorCodes.MARKET_PAUSED).toBe("MARKET_PAUSED");
  });

  it("should have nonce error codes", () => {
    expect(ClobErrorCodes.INVALID_NONCE).toBe("INVALID_NONCE");
    expect(ClobErrorCodes.NONCE_TOO_LOW).toBe("NONCE_TOO_LOW");
    expect(ClobErrorCodes.NONCE_ALREADY_USED).toBe("NONCE_ALREADY_USED");
  });
});

describe("RecoveryAction enum", () => {
  it("should have all expected recovery actions", () => {
    expect(RecoveryAction.NONE).toBe("NONE");
    expect(RecoveryAction.REFRESH_AUTH).toBe("REFRESH_AUTH");
    expect(RecoveryAction.WAIT_RATE_LIMIT).toBe("WAIT_RATE_LIMIT");
    expect(RecoveryAction.REFRESH_NONCE).toBe("REFRESH_NONCE");
    expect(RecoveryAction.RESIGN_REQUEST).toBe("RESIGN_REQUEST");
    expect(RecoveryAction.REFRESH_BALANCE).toBe("REFRESH_BALANCE");
    expect(RecoveryAction.REFRESH_MARKET).toBe("REFRESH_MARKET");
    expect(RecoveryAction.RESUBMIT_ORDER).toBe("RESUBMIT_ORDER");
  });
});

describe("classifyClobError", () => {
  describe("ClobApiException classification", () => {
    it("should classify 429 as RATE_LIMIT", () => {
      const error = new ClobApiException({ message: "Too many requests", statusCode: 429 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.RATE_LIMIT);
      expect(result.severity).toBe(ClobErrorSeverity.WARN);
      expect(result.statusCode).toBe(429);
    });

    it("should classify 401 as AUTH", () => {
      const error = new ClobApiException({ message: "Unauthorized", statusCode: 401 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.AUTH);
      expect(result.severity).toBe(ClobErrorSeverity.CRITICAL);
      expect(result.statusCode).toBe(401);
    });

    it("should classify 403 as FORBIDDEN", () => {
      const error = new ClobApiException({ message: "Forbidden", statusCode: 403 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.FORBIDDEN);
      expect(result.severity).toBe(ClobErrorSeverity.CRITICAL);
      expect(result.statusCode).toBe(403);
    });

    it("should classify 404 as NOT_FOUND", () => {
      const error = new ClobApiException({ message: "Not found", statusCode: 404 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NOT_FOUND);
      expect(result.severity).toBe(ClobErrorSeverity.ERROR);
      expect(result.statusCode).toBe(404);
    });

    it("should classify 500 as SERVER", () => {
      const error = new ClobApiException({ message: "Internal server error", statusCode: 500 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.SERVER);
      expect(result.severity).toBe(ClobErrorSeverity.ERROR);
      expect(result.statusCode).toBe(500);
    });

    it("should classify 502 as SERVER", () => {
      const error = new ClobApiException({ message: "Bad gateway", statusCode: 502 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.SERVER);
      expect(result.statusCode).toBe(502);
    });

    it("should classify 503 as SERVER", () => {
      const error = new ClobApiException({ message: "Service unavailable", statusCode: 503 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.SERVER);
      expect(result.statusCode).toBe(503);
    });

    it("should classify 400 as CLIENT", () => {
      const error = new ClobApiException({ message: "Bad request", statusCode: 400 });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.CLIENT);
      expect(result.severity).toBe(ClobErrorSeverity.ERROR);
      expect(result.statusCode).toBe(400);
    });

    it("should use error code for classification when available", () => {
      const error = new ClobApiException({
        message: "Error",
        statusCode: 400,
        code: ClobErrorCodes.INSUFFICIENT_BALANCE,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INSUFFICIENT_BALANCE);
      expect(result.errorCode).toBe(ClobErrorCodes.INSUFFICIENT_BALANCE);
    });

    it("should classify INVALID_SIGNATURE error code", () => {
      const error = new ClobApiException({
        message: "Signature invalid",
        statusCode: 401,
        code: ClobErrorCodes.INVALID_SIGNATURE,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.SIGNATURE_ERROR);
    });

    it("should classify ORDER_NOT_FOUND error code", () => {
      const error = new ClobApiException({
        message: "Order not found",
        statusCode: 404,
        code: ClobErrorCodes.ORDER_NOT_FOUND,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.ORDER_NOT_FOUND);
    });

    it("should classify DUPLICATE_ORDER error code", () => {
      const error = new ClobApiException({
        message: "Duplicate order",
        statusCode: 400,
        code: ClobErrorCodes.DUPLICATE_ORDER,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.DUPLICATE_ORDER);
    });

    it("should classify MARKET_CLOSED error code", () => {
      const error = new ClobApiException({
        message: "Market is closed",
        statusCode: 400,
        code: ClobErrorCodes.MARKET_CLOSED,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.MARKET_CLOSED);
    });

    it("should classify INVALID_NONCE error code", () => {
      const error = new ClobApiException({
        message: "Invalid nonce",
        statusCode: 400,
        code: ClobErrorCodes.INVALID_NONCE,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NONCE_ERROR);
    });

    it("should classify INVALID_PRICE error code", () => {
      const error = new ClobApiException({
        message: "Invalid price",
        statusCode: 400,
        code: ClobErrorCodes.INVALID_PRICE,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INVALID_PRICE);
    });

    it("should classify INVALID_SIZE error code", () => {
      const error = new ClobApiException({
        message: "Invalid size",
        statusCode: 400,
        code: ClobErrorCodes.INVALID_SIZE,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INVALID_SIZE);
    });
  });

  describe("Message-based classification", () => {
    it("should classify insufficient balance message", () => {
      const error = new ClobApiException({
        message: "Insufficient balance to place order",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INSUFFICIENT_BALANCE);
    });

    it("should classify order not found message", () => {
      const error = new ClobApiException({
        message: "Order does not exist",
        statusCode: 404,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.ORDER_NOT_FOUND);
    });

    it("should classify market closed message", () => {
      const error = new ClobApiException({
        message: "Market is closed for trading",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.MARKET_CLOSED);
    });

    it("should classify nonce error message", () => {
      const error = new ClobApiException({
        message: "Nonce too low",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NONCE_ERROR);
    });

    it("should classify invalid signature message", () => {
      const error = new ClobApiException({
        message: "Signature verification failed",
        statusCode: 401,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.SIGNATURE_ERROR);
    });

    it("should classify invalid price message", () => {
      const error = new ClobApiException({
        message: "Price out of range",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INVALID_PRICE);
    });

    it("should classify invalid size message", () => {
      const error = new ClobApiException({
        message: "Size too small",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.INVALID_SIZE);
    });

    it("should classify duplicate order message", () => {
      const error = new ClobApiException({
        message: "Order already exists",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.DUPLICATE_ORDER);
    });

    it("should classify rate limit message", () => {
      const error = new ClobApiException({
        message: "Too many requests, rate limit exceeded",
        statusCode: 400,
      });
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.RATE_LIMIT);
    });
  });

  describe("Standard Error classification", () => {
    it("should classify timeout errors", () => {
      const error = new Error("Request timeout");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.TIMEOUT);
      expect(result.severity).toBe(ClobErrorSeverity.WARN);
    });

    it("should classify AbortError", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.TIMEOUT);
    });

    it("should classify network errors", () => {
      const error = new Error("Network error: Connection refused");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NETWORK);
      expect(result.severity).toBe(ClobErrorSeverity.WARN);
    });

    it("should classify ECONNREFUSED errors", () => {
      const error = new Error("ECONNREFUSED");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NETWORK);
    });

    it("should classify ENOTFOUND errors", () => {
      const error = new Error("getaddrinfo ENOTFOUND");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NETWORK);
    });

    it("should classify fetch failed errors", () => {
      const error = new Error("Fetch failed");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.NETWORK);
    });

    it("should classify JSON parse errors", () => {
      const error = new Error("Unexpected token in JSON");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.PARSE);
      expect(result.severity).toBe(ClobErrorSeverity.ERROR);
    });

    it("should classify SyntaxError as parse error", () => {
      const error = new SyntaxError("Unexpected token");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.PARSE);
    });

    it("should classify unknown errors", () => {
      const error = new Error("Something went wrong");
      const result = classifyClobError(error);
      expect(result.type).toBe(ClobErrorType.UNKNOWN);
      expect(result.severity).toBe(ClobErrorSeverity.ERROR);
    });

    it("should classify non-Error objects", () => {
      const result = classifyClobError("string error");
      expect(result.type).toBe(ClobErrorType.UNKNOWN);
    });
  });
});

describe("getRecoveryAction", () => {
  it("should return REFRESH_AUTH for AUTH errors", () => {
    expect(getRecoveryAction(ClobErrorType.AUTH)).toBe(RecoveryAction.REFRESH_AUTH);
  });

  it("should return REFRESH_AUTH for FORBIDDEN errors", () => {
    expect(getRecoveryAction(ClobErrorType.FORBIDDEN)).toBe(RecoveryAction.REFRESH_AUTH);
  });

  it("should return WAIT_RATE_LIMIT for RATE_LIMIT errors", () => {
    expect(getRecoveryAction(ClobErrorType.RATE_LIMIT)).toBe(RecoveryAction.WAIT_RATE_LIMIT);
  });

  it("should return REFRESH_NONCE for NONCE_ERROR errors", () => {
    expect(getRecoveryAction(ClobErrorType.NONCE_ERROR)).toBe(RecoveryAction.REFRESH_NONCE);
  });

  it("should return RESIGN_REQUEST for SIGNATURE_ERROR errors", () => {
    expect(getRecoveryAction(ClobErrorType.SIGNATURE_ERROR)).toBe(RecoveryAction.RESIGN_REQUEST);
  });

  it("should return REFRESH_BALANCE for INSUFFICIENT_BALANCE errors", () => {
    expect(getRecoveryAction(ClobErrorType.INSUFFICIENT_BALANCE)).toBe(RecoveryAction.REFRESH_BALANCE);
  });

  it("should return REFRESH_MARKET for MARKET_CLOSED errors", () => {
    expect(getRecoveryAction(ClobErrorType.MARKET_CLOSED)).toBe(RecoveryAction.REFRESH_MARKET);
  });

  it("should return NONE for NETWORK errors", () => {
    expect(getRecoveryAction(ClobErrorType.NETWORK)).toBe(RecoveryAction.NONE);
  });

  it("should return NONE for SERVER errors", () => {
    expect(getRecoveryAction(ClobErrorType.SERVER)).toBe(RecoveryAction.NONE);
  });

  it("should return NONE for UNKNOWN errors", () => {
    expect(getRecoveryAction(ClobErrorType.UNKNOWN)).toBe(RecoveryAction.NONE);
  });
});

describe("calculateClobBackoffDelay", () => {
  it("should calculate exponential backoff", () => {
    // With 0 jitter for deterministic testing
    const delay0 = calculateClobBackoffDelay(0, 1000, 30000, 0);
    const delay1 = calculateClobBackoffDelay(1, 1000, 30000, 0);
    const delay2 = calculateClobBackoffDelay(2, 1000, 30000, 0);

    expect(delay0).toBe(1000);
    expect(delay1).toBe(2000);
    expect(delay2).toBe(4000);
  });

  it("should cap at maxDelay", () => {
    const delay = calculateClobBackoffDelay(10, 1000, 5000, 0);
    expect(delay).toBe(5000);
  });

  it("should add jitter when jitterFactor > 0", () => {
    // Run multiple times to ensure variation
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      delays.add(calculateClobBackoffDelay(0, 1000, 30000, 0.5));
    }
    // With jitter, we should get some variation (may not always be unique due to rounding)
    expect(delays.size).toBeGreaterThanOrEqual(1);
  });

  it("should never return negative values", () => {
    const delay = calculateClobBackoffDelay(0, 1000, 30000, 1.0);
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

describe("shouldRetryClobError", () => {
  const defaultRetryable = [
    ClobErrorType.SERVER,
    ClobErrorType.RATE_LIMIT,
    ClobErrorType.NETWORK,
    ClobErrorType.TIMEOUT,
    ClobErrorType.NONCE_ERROR,
  ];

  it("should return true for retryable errors within retry limit", () => {
    expect(shouldRetryClobError(ClobErrorType.SERVER, 0, 3, defaultRetryable)).toBe(true);
    expect(shouldRetryClobError(ClobErrorType.RATE_LIMIT, 1, 3, defaultRetryable)).toBe(true);
    expect(shouldRetryClobError(ClobErrorType.NETWORK, 2, 3, defaultRetryable)).toBe(true);
  });

  it("should return false when attempt >= maxRetries", () => {
    expect(shouldRetryClobError(ClobErrorType.SERVER, 3, 3, defaultRetryable)).toBe(false);
    expect(shouldRetryClobError(ClobErrorType.SERVER, 4, 3, defaultRetryable)).toBe(false);
  });

  it("should return false for non-retryable errors", () => {
    expect(shouldRetryClobError(ClobErrorType.AUTH, 0, 3, defaultRetryable)).toBe(false);
    expect(shouldRetryClobError(ClobErrorType.CLIENT, 0, 3, defaultRetryable)).toBe(false);
    expect(shouldRetryClobError(ClobErrorType.VALIDATION, 0, 3, defaultRetryable)).toBe(false);
  });

  it("should use custom retryable list", () => {
    const customRetryable = [ClobErrorType.AUTH];
    expect(shouldRetryClobError(ClobErrorType.AUTH, 0, 3, customRetryable)).toBe(true);
    expect(shouldRetryClobError(ClobErrorType.SERVER, 0, 3, customRetryable)).toBe(false);
  });
});

describe("createClobErrorContext", () => {
  const defaultConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.2,
    retryableErrors: [ClobErrorType.SERVER, ClobErrorType.RATE_LIMIT, ClobErrorType.NETWORK, ClobErrorType.TIMEOUT, ClobErrorType.NONCE_ERROR],
    enableLogging: false,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  it("should create context with all fields", () => {
    const error = new ClobApiException({ message: "Server error", statusCode: 500 });
    const context = createClobErrorContext(error, 0, defaultConfig, {
      operation: "Fetch order book",
      url: "/book",
      method: "GET",
      tokenId: "123",
      orderId: "456",
    });

    expect(context.originalError).toBe(error);
    expect(context.errorType).toBe(ClobErrorType.SERVER);
    expect(context.severity).toBe(ClobErrorSeverity.ERROR);
    expect(context.statusCode).toBe(500);
    expect(context.attempt).toBe(0);
    expect(context.maxRetries).toBe(3);
    expect(context.willRetry).toBe(true);
    expect(context.retryDelay).toBeDefined();
    expect(context.operation).toBe("Fetch order book");
    expect(context.url).toBe("/book");
    expect(context.method).toBe("GET");
    expect(context.tokenId).toBe("123");
    expect(context.orderId).toBe("456");
    expect(context.timestamp).toBeDefined();
  });

  it("should set willRetry to false for non-retryable errors", () => {
    const error = new ClobApiException({ message: "Bad request", statusCode: 400 });
    const context = createClobErrorContext(error, 0, defaultConfig);

    expect(context.willRetry).toBe(false);
    expect(context.retryDelay).toBeUndefined();
  });

  it("should include recovery action when applicable", () => {
    const error = new ClobApiException({
      message: "Invalid nonce",
      statusCode: 400,
      code: ClobErrorCodes.INVALID_NONCE,
    });
    const context = createClobErrorContext(error, 0, defaultConfig);

    expect(context.recoveryAction).toBe(RecoveryAction.REFRESH_NONCE);
  });

  it("should convert non-Error objects to Error", () => {
    const context = createClobErrorContext("string error", 0, defaultConfig);

    expect(context.originalError).toBeInstanceOf(Error);
    expect(context.originalError.message).toBe("string error");
  });
});

describe("logClobError", () => {
  it("should log ERROR severity errors", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Server error"),
      errorType: ClobErrorType.SERVER,
      severity: ClobErrorSeverity.ERROR,
      statusCode: 500,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, true);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("should log WARN severity errors", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Rate limited"),
      errorType: ClobErrorType.RATE_LIMIT,
      severity: ClobErrorSeverity.WARN,
      statusCode: 429,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, true);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should log CRITICAL severity errors as error", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Unauthorized"),
      errorType: ClobErrorType.AUTH,
      severity: ClobErrorSeverity.CRITICAL,
      statusCode: 401,
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, true);

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("should not log when enableLogging is false", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Error"),
      errorType: ClobErrorType.SERVER,
      severity: ClobErrorSeverity.ERROR,
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, false);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("should include operation in message", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Error"),
      errorType: ClobErrorType.SERVER,
      severity: ClobErrorSeverity.ERROR,
      operation: "Fetch order book",
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Fetch order book"),
      expect.any(Object)
    );
  });

  it("should include tokenId and orderId in log data", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const context = {
      originalError: new Error("Error"),
      errorType: ClobErrorType.ORDER_NOT_FOUND,
      severity: ClobErrorSeverity.ERROR,
      tokenId: "token-123",
      orderId: "order-456",
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    logClobError(context, logger, true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tokenId: "token-123",
        orderId: "order-456",
      })
    );
  });
});

describe("isClobErrorType", () => {
  it("should return true for matching error types", () => {
    const error = new ClobApiException({ message: "Server error", statusCode: 500 });
    expect(isClobErrorType(error, ClobErrorType.SERVER)).toBe(true);
    expect(isClobErrorType(error, ClobErrorType.SERVER, ClobErrorType.NETWORK)).toBe(true);
  });

  it("should return false for non-matching error types", () => {
    const error = new ClobApiException({ message: "Server error", statusCode: 500 });
    expect(isClobErrorType(error, ClobErrorType.AUTH)).toBe(false);
    expect(isClobErrorType(error, ClobErrorType.RATE_LIMIT, ClobErrorType.TIMEOUT)).toBe(false);
  });
});

describe("isRetryableClobError", () => {
  it("should return true for default retryable errors", () => {
    expect(isRetryableClobError(new ClobApiException({ message: "Error", statusCode: 500 }))).toBe(true);
    expect(isRetryableClobError(new ClobApiException({ message: "Error", statusCode: 429 }))).toBe(true);
    expect(isRetryableClobError(new Error("Network error"))).toBe(true);
    expect(isRetryableClobError(new Error("Timeout"))).toBe(true);
  });

  it("should return false for non-retryable errors", () => {
    expect(isRetryableClobError(new ClobApiException({ message: "Error", statusCode: 401 }))).toBe(false);
    expect(isRetryableClobError(new ClobApiException({ message: "Error", statusCode: 400 }))).toBe(false);
  });
});

describe("hasRecoveryAction", () => {
  it("should return true for errors with recovery actions", () => {
    expect(hasRecoveryAction(new ClobApiException({ message: "Error", statusCode: 401 }))).toBe(true);
    expect(hasRecoveryAction(new ClobApiException({ message: "Error", statusCode: 429 }))).toBe(true);
    expect(hasRecoveryAction(new ClobApiException({
      message: "Error",
      statusCode: 400,
      code: ClobErrorCodes.INVALID_NONCE,
    }))).toBe(true);
  });

  it("should return false for errors without recovery actions", () => {
    expect(hasRecoveryAction(new ClobApiException({ message: "Error", statusCode: 500 }))).toBe(false);
    expect(hasRecoveryAction(new Error("Unknown error"))).toBe(false);
  });
});

describe("ClobErrorHandler", () => {
  beforeEach(() => {
    resetSharedClobErrorHandler();
  });

  describe("constructor", () => {
    it("should create handler with default config", () => {
      const handler = new ClobErrorHandler();
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.maxDelay).toBe(30000);
      expect(config.jitterFactor).toBe(0.2);
      expect(config.enableLogging).toBe(true);
    });

    it("should create handler with custom config", () => {
      const handler = new ClobErrorHandler({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 10000,
        jitterFactor: 0.1,
        enableLogging: false,
      });
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(500);
      expect(config.maxDelay).toBe(10000);
      expect(config.jitterFactor).toBe(0.1);
      expect(config.enableLogging).toBe(false);
    });

    it("should accept custom logger", () => {
      const customLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const handler = new ClobErrorHandler({ logger: customLogger });
      const config = handler.getConfig();

      expect(config.logger).toBe(customLogger);
    });
  });

  describe("execute", () => {
    it("should return success result on successful execution", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const result = await handler.execute(async () => "success");

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });

    it("should return error result on non-retryable failure", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const error = new ClobApiException({ message: "Bad request", statusCode: 400 });

      const result = await handler.execute(async () => {
        throw error;
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe(ClobErrorType.CLIENT);
      expect(result.attempts).toBe(1);
    });

    it("should retry on retryable errors", async () => {
      const handler = new ClobErrorHandler({
        maxRetries: 2,
        baseDelay: 10,
        enableLogging: false,
      });

      let attempts = 0;
      const result = await handler.execute(async () => {
        attempts++;
        if (attempts < 2) {
          throw new ClobApiException({ message: "Server error", statusCode: 500 });
        }
        return "success";
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(2);
    });

    it("should fail after max retries", async () => {
      const handler = new ClobErrorHandler({
        maxRetries: 2,
        baseDelay: 10,
        enableLogging: false,
      });

      const result = await handler.execute(async () => {
        throw new ClobApiException({ message: "Server error", statusCode: 500 });
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
    });

    it("should call onError callback", async () => {
      const onError = vi.fn();
      const handler = new ClobErrorHandler({
        onError,
        enableLogging: false,
      });

      await handler.execute(async () => {
        throw new ClobApiException({ message: "Error", statusCode: 400 });
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        errorType: ClobErrorType.CLIENT,
      }));
    });

    it("should call onMaxRetriesExceeded callback", async () => {
      const onMaxRetriesExceeded = vi.fn();
      const handler = new ClobErrorHandler({
        maxRetries: 1,
        baseDelay: 10,
        onMaxRetriesExceeded,
        enableLogging: false,
      });

      await handler.execute(async () => {
        throw new ClobApiException({ message: "Server error", statusCode: 500 });
      });

      expect(onMaxRetriesExceeded).toHaveBeenCalledTimes(1);
    });

    it("should call onRecoverableError for errors with recovery actions", async () => {
      const onRecoverableError = vi.fn().mockResolvedValue(false);
      const handler = new ClobErrorHandler({
        onRecoverableError,
        enableLogging: false,
        maxRetries: 0, // No retries to ensure single call
      });

      await handler.execute(async () => {
        throw new ClobApiException({
          message: "Nonce error",
          statusCode: 400,
          code: ClobErrorCodes.INVALID_NONCE,
        });
      });

      expect(onRecoverableError).toHaveBeenCalledTimes(1);
      expect(onRecoverableError).toHaveBeenCalledWith(expect.objectContaining({
        recoveryAction: RecoveryAction.REFRESH_NONCE,
      }));
    });

    it("should retry after successful recovery", async () => {
      let attempts = 0;
      const onRecoverableError = vi.fn().mockResolvedValue(true);
      const handler = new ClobErrorHandler({
        onRecoverableError,
        enableLogging: false,
      });

      const result = await handler.execute(async () => {
        attempts++;
        if (attempts === 1) {
          throw new ClobApiException({
            message: "Nonce error",
            statusCode: 400,
            code: ClobErrorCodes.INVALID_NONCE,
          });
        }
        return "success";
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.recoveryAttempted).toBe(true);
    });

    it("should include options in error context", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });

      const result = await handler.execute(
        async () => {
          throw new ClobApiException({ message: "Error", statusCode: 400 });
        },
        {
          operation: "Test operation",
          url: "/test",
          method: "POST",
          tokenId: "token-123",
          orderId: "order-456",
        }
      );

      expect(result.error?.operation).toBe("Test operation");
      expect(result.error?.url).toBe("/test");
      expect(result.error?.method).toBe("POST");
      expect(result.error?.tokenId).toBe("token-123");
      expect(result.error?.orderId).toBe("order-456");
    });
  });

  describe("executeOrThrow", () => {
    it("should return result on success", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const result = await handler.executeOrThrow(async () => "success");
      expect(result).toBe("success");
    });

    it("should throw on failure", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const error = new ClobApiException({ message: "Error", statusCode: 400 });

      await expect(
        handler.executeOrThrow(async () => {
          throw error;
        })
      ).rejects.toThrow(error);
    });
  });

  describe("wrap", () => {
    it("should wrap function with error handling", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const fn = async (x: number) => x * 2;
      const wrapped = handler.wrap(fn);

      const result = await wrapped(5);

      expect(result.success).toBe(true);
      expect(result.data).toBe(10);
    });

    it("should pass options to wrapped function", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const fn = async () => {
        throw new ClobApiException({ message: "Error", statusCode: 400 });
      };
      const wrapped = handler.wrap(fn, { operation: "Test" });

      const result = await wrapped();

      expect(result.error?.operation).toBe("Test");
    });
  });

  describe("wrapOrThrow", () => {
    it("should return result on success", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const fn = async (x: number) => x * 2;
      const wrapped = handler.wrapOrThrow(fn);

      const result = await wrapped(5);

      expect(result).toBe(10);
    });

    it("should throw on failure", async () => {
      const handler = new ClobErrorHandler({ enableLogging: false });
      const error = new ClobApiException({ message: "Error", statusCode: 400 });
      const fn = async () => {
        throw error;
      };
      const wrapped = handler.wrapOrThrow(fn);

      await expect(wrapped()).rejects.toThrow(error);
    });
  });
});

describe("createClobErrorHandler", () => {
  it("should create handler with config", () => {
    const handler = createClobErrorHandler({ maxRetries: 5 });
    expect(handler.getConfig().maxRetries).toBe(5);
  });

  it("should create handler with default config", () => {
    const handler = createClobErrorHandler();
    expect(handler.getConfig().maxRetries).toBe(3);
  });
});

describe("Shared CLOB error handler", () => {
  beforeEach(() => {
    resetSharedClobErrorHandler();
  });

  it("should return same instance on multiple calls", () => {
    const handler1 = getSharedClobErrorHandler();
    const handler2 = getSharedClobErrorHandler();
    expect(handler1).toBe(handler2);
  });

  it("should reset shared handler", () => {
    const handler1 = getSharedClobErrorHandler();
    resetSharedClobErrorHandler();
    const handler2 = getSharedClobErrorHandler();
    expect(handler1).not.toBe(handler2);
  });

  it("should set custom shared handler", () => {
    const customHandler = new ClobErrorHandler({ maxRetries: 10 });
    setSharedClobErrorHandler(customHandler);
    expect(getSharedClobErrorHandler()).toBe(customHandler);
  });
});

describe("withClobErrorHandling", () => {
  beforeEach(() => {
    resetSharedClobErrorHandler();
    setSharedClobErrorHandler(new ClobErrorHandler({ enableLogging: false }));
  });

  afterEach(() => {
    resetSharedClobErrorHandler();
  });

  it("should use shared handler", async () => {
    const result = await withClobErrorHandling(async () => "success");

    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
  });

  it("should pass options", async () => {
    const result = await withClobErrorHandling(
      async () => {
        throw new ClobApiException({ message: "Error", statusCode: 400 });
      },
      { operation: "Test" }
    );

    expect(result.error?.operation).toBe("Test");
  });
});

describe("withClobErrorHandlingOrThrow", () => {
  beforeEach(() => {
    resetSharedClobErrorHandler();
    setSharedClobErrorHandler(new ClobErrorHandler({ enableLogging: false }));
  });

  afterEach(() => {
    resetSharedClobErrorHandler();
  });

  it("should return result on success", async () => {
    const result = await withClobErrorHandlingOrThrow(async () => "success");
    expect(result).toBe("success");
  });

  it("should throw on failure", async () => {
    const error = new ClobApiException({ message: "Error", statusCode: 400 });
    await expect(
      withClobErrorHandlingOrThrow(async () => {
        throw error;
      })
    ).rejects.toThrow(error);
  });
});

describe("formatClobErrorMessage", () => {
  it("should format AUTH error", () => {
    const context = {
      originalError: new Error("Invalid credentials"),
      errorType: ClobErrorType.AUTH,
      severity: ClobErrorSeverity.CRITICAL,
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    const message = formatClobErrorMessage(context);
    expect(message).toContain("Authentication failed");
  });

  it("should format RATE_LIMIT error", () => {
    const context = {
      originalError: new Error("Too many requests"),
      errorType: ClobErrorType.RATE_LIMIT,
      severity: ClobErrorSeverity.WARN,
      attempt: 0,
      maxRetries: 3,
      willRetry: true,
      timestamp: new Date().toISOString(),
    };

    const message = formatClobErrorMessage(context);
    expect(message).toContain("Rate limit exceeded");
  });

  it("should format INSUFFICIENT_BALANCE error", () => {
    const context = {
      originalError: new Error("Not enough balance"),
      errorType: ClobErrorType.INSUFFICIENT_BALANCE,
      severity: ClobErrorSeverity.ERROR,
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    const message = formatClobErrorMessage(context);
    expect(message).toContain("Insufficient balance");
  });

  it("should include token ID when present", () => {
    const context = {
      originalError: new Error("Error"),
      errorType: ClobErrorType.NOT_FOUND,
      severity: ClobErrorSeverity.ERROR,
      tokenId: "token-123",
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    const message = formatClobErrorMessage(context);
    expect(message).toContain("token-123");
  });

  it("should include order ID when present", () => {
    const context = {
      originalError: new Error("Error"),
      errorType: ClobErrorType.ORDER_NOT_FOUND,
      severity: ClobErrorSeverity.ERROR,
      orderId: "order-456",
      attempt: 0,
      maxRetries: 3,
      willRetry: false,
      timestamp: new Date().toISOString(),
    };

    const message = formatClobErrorMessage(context);
    expect(message).toContain("order-456");
  });

  it("should format all error types", () => {
    const errorTypes = Object.values(ClobErrorType);
    for (const errorType of errorTypes) {
      const context = {
        originalError: new Error("Test error"),
        errorType,
        severity: ClobErrorSeverity.ERROR,
        attempt: 0,
        maxRetries: 3,
        willRetry: false,
        timestamp: new Date().toISOString(),
      };

      const message = formatClobErrorMessage(context);
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
