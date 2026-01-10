/**
 * Tests for CLOB API Authentication Module
 *
 * @see API-CLOB-008
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSignature,
  generateAuthHeaders,
  validateCredentialFormat,
  classifyAuthError,
  isAuthError,
  isRetryableAuthError,
  AuthErrorType,
  CredentialStore,
  getSharedAuthManager,
  setSharedAuthManager,
  resetSharedAuthManager,
  createAuthManager,
  withAuth,
} from "../../../src/api/clob/auth";
import { ClobApiException } from "../../../src/api/clob/client";
import { ClobCredentials } from "../../../src/api/clob/types";

describe("generateSignature", () => {
  it("should generate a base64 encoded signature", async () => {
    const signature = await generateSignature(
      "test-secret",
      "1234567890",
      "GET",
      "/test",
      undefined
    );

    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    // Base64 pattern: alphanumeric + / and +, optionally ending with =
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("should generate different signatures for different secrets", async () => {
    const sig1 = await generateSignature("secret1", "1234567890", "GET", "/test");
    const sig2 = await generateSignature("secret2", "1234567890", "GET", "/test");

    expect(sig1).not.toBe(sig2);
  });

  it("should generate different signatures for different methods", async () => {
    const sigGet = await generateSignature("secret", "1234567890", "GET", "/test");
    const sigPost = await generateSignature("secret", "1234567890", "POST", "/test");

    expect(sigGet).not.toBe(sigPost);
  });

  it("should generate different signatures for different paths", async () => {
    const sig1 = await generateSignature("secret", "1234567890", "GET", "/path1");
    const sig2 = await generateSignature("secret", "1234567890", "GET", "/path2");

    expect(sig1).not.toBe(sig2);
  });

  it("should generate different signatures for different timestamps", async () => {
    const sig1 = await generateSignature("secret", "1111111111", "GET", "/test");
    const sig2 = await generateSignature("secret", "2222222222", "GET", "/test");

    expect(sig1).not.toBe(sig2);
  });

  it("should include body in signature when provided", async () => {
    const sigWithBody = await generateSignature(
      "secret",
      "1234567890",
      "POST",
      "/test",
      '{"key":"value"}'
    );
    const sigWithoutBody = await generateSignature(
      "secret",
      "1234567890",
      "POST",
      "/test"
    );

    expect(sigWithBody).not.toBe(sigWithoutBody);
  });

  it("should be case-insensitive for HTTP method", async () => {
    const sigUpper = await generateSignature("secret", "1234567890", "GET", "/test");
    const sigLower = await generateSignature("secret", "1234567890", "get", "/test");

    expect(sigUpper).toBe(sigLower);
  });

  it("should generate consistent signatures for same inputs", async () => {
    const sig1 = await generateSignature("secret", "1234567890", "GET", "/test");
    const sig2 = await generateSignature("secret", "1234567890", "GET", "/test");

    expect(sig1).toBe(sig2);
  });
});

describe("generateAuthHeaders", () => {
  const validCredentials: ClobCredentials = {
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
    apiPassphrase: "test-passphrase",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should generate all required headers", async () => {
    const headers = await generateAuthHeaders(
      validCredentials,
      "GET",
      "/test"
    );

    expect(headers).toHaveProperty("POLY-API-KEY");
    expect(headers).toHaveProperty("POLY-SIGNATURE");
    expect(headers).toHaveProperty("POLY-TIMESTAMP");
    expect(headers).toHaveProperty("POLY-PASSPHRASE");
  });

  it("should include API key in headers", async () => {
    const headers = await generateAuthHeaders(
      validCredentials,
      "GET",
      "/test"
    );

    expect(headers["POLY-API-KEY"]).toBe("test-api-key");
  });

  it("should include timestamp as unix seconds", async () => {
    const headers = await generateAuthHeaders(
      validCredentials,
      "GET",
      "/test"
    );

    const expectedTimestamp = Math.floor(new Date("2026-01-10T00:00:00.000Z").getTime() / 1000);
    expect(headers["POLY-TIMESTAMP"]).toBe(expectedTimestamp.toString());
  });

  it("should include signature", async () => {
    const headers = await generateAuthHeaders(
      validCredentials,
      "GET",
      "/test"
    );

    expect(headers["POLY-SIGNATURE"]).toBeDefined();
    expect(headers["POLY-SIGNATURE"].length).toBeGreaterThan(0);
  });

  it("should include passphrase when provided", async () => {
    const headers = await generateAuthHeaders(
      validCredentials,
      "GET",
      "/test"
    );

    expect(headers["POLY-PASSPHRASE"]).toBe("test-passphrase");
  });

  it("should not include passphrase when not provided", async () => {
    const credentialsWithoutPassphrase: ClobCredentials = {
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
    };

    const headers = await generateAuthHeaders(
      credentialsWithoutPassphrase,
      "GET",
      "/test"
    );

    expect(headers["POLY-PASSPHRASE"]).toBeUndefined();
  });

  it("should throw on missing API key", async () => {
    const invalidCredentials: ClobCredentials = {
      apiKey: "",
      apiSecret: "test-api-secret",
    };

    await expect(
      generateAuthHeaders(invalidCredentials, "GET", "/test")
    ).rejects.toThrow("API key is required");
  });

  it("should throw on missing API secret", async () => {
    const invalidCredentials: ClobCredentials = {
      apiKey: "test-api-key",
      apiSecret: "",
    };

    await expect(
      generateAuthHeaders(invalidCredentials, "GET", "/test")
    ).rejects.toThrow("API secret is required");
  });
});

describe("validateCredentialFormat", () => {
  it("should not throw for valid credentials", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "valid-api-key-123",
        apiSecret: "valid-secret-456",
      })
    ).not.toThrow();
  });

  it("should throw for empty API key", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "",
        apiSecret: "valid-secret",
      })
    ).toThrow("API key is required");
  });

  it("should throw for whitespace-only API key", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "   ",
        apiSecret: "valid-secret",
      })
    ).toThrow("API key is required");
  });

  it("should throw for empty API secret", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "valid-key",
        apiSecret: "",
      })
    ).toThrow("API secret is required");
  });

  it("should throw for whitespace-only API secret", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "valid-key",
        apiSecret: "   ",
      })
    ).toThrow("API secret is required");
  });

  it("should throw for invalid API key format with special characters", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "invalid key with spaces",
        apiSecret: "valid-secret",
      })
    ).toThrow("Invalid API key format");
  });

  it("should accept API key with underscores and hyphens", () => {
    expect(() =>
      validateCredentialFormat({
        apiKey: "valid_key-with-123",
        apiSecret: "valid-secret",
      })
    ).not.toThrow();
  });
});

describe("classifyAuthError", () => {
  it("should classify missing credentials error", () => {
    const error = new ClobApiException({
      message: "Missing credentials",
      statusCode: 401,
      code: "MISSING_CREDENTIALS",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.MISSING_CREDENTIALS);
    expect(classified.retryable).toBe(false);
    expect(classified.statusCode).toBe(401);
  });

  it("should classify invalid signature error", () => {
    const error = new ClobApiException({
      message: "Invalid signature",
      statusCode: 401,
      code: "INVALID_SIGNATURE",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.INVALID_SIGNATURE);
    expect(classified.retryable).toBe(false);
  });

  it("should classify timestamp expired error", () => {
    const error = new ClobApiException({
      message: "Timestamp expired",
      statusCode: 401,
      code: "TIMESTAMP_EXPIRED",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.TIMESTAMP_EXPIRED);
    expect(classified.retryable).toBe(true);
  });

  it("should classify key revoked error", () => {
    const error = new ClobApiException({
      message: "API key revoked",
      statusCode: 401,
      code: "KEY_REVOKED",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.KEY_REVOKED);
    expect(classified.retryable).toBe(false);
  });

  it("should classify key expired error", () => {
    const error = new ClobApiException({
      message: "API key expired",
      statusCode: 401,
      code: "KEY_EXPIRED",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.KEY_EXPIRED);
    expect(classified.retryable).toBe(false);
  });

  it("should classify invalid passphrase error", () => {
    const error = new ClobApiException({
      message: "Invalid passphrase",
      statusCode: 401,
      code: "INVALID_PASSPHRASE",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.INVALID_PASSPHRASE);
    expect(classified.retryable).toBe(false);
  });

  it("should classify IP not whitelisted error (403)", () => {
    const error = new ClobApiException({
      message: "IP not whitelisted",
      statusCode: 403,
      code: "IP_NOT_WHITELISTED",
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.IP_NOT_WHITELISTED);
    expect(classified.retryable).toBe(false);
    expect(classified.statusCode).toBe(403);
  });

  it("should classify permission denied error (403)", () => {
    const error = new ClobApiException({
      message: "Permission denied",
      statusCode: 403,
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.PERMISSION_DENIED);
    expect(classified.retryable).toBe(false);
  });

  it("should classify rate limit error (429)", () => {
    const error = new ClobApiException({
      message: "Rate limit exceeded",
      statusCode: 429,
    });

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.RATE_LIMITED);
    expect(classified.retryable).toBe(true);
  });

  it("should classify standard error with signature keyword", () => {
    const error = new Error("Invalid HMAC signature");

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.INVALID_SIGNATURE);
  });

  it("should classify standard error with timestamp keyword", () => {
    const error = new Error("Request timestamp has expired");

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.TIMESTAMP_EXPIRED);
    expect(classified.retryable).toBe(true);
  });

  it("should classify unknown errors", () => {
    const error = new Error("Something went wrong");

    const classified = classifyAuthError(error);

    expect(classified.type).toBe(AuthErrorType.UNKNOWN);
  });

  it("should handle non-Error objects", () => {
    const classified = classifyAuthError("string error");

    expect(classified.type).toBe(AuthErrorType.UNKNOWN);
    expect(classified.message).toBe("string error");
  });

  it("should include suggested action", () => {
    const error = new ClobApiException({
      message: "Invalid signature",
      statusCode: 401,
    });

    const classified = classifyAuthError(error);

    expect(classified.suggestedAction).toBeDefined();
    expect(classified.suggestedAction.length).toBeGreaterThan(0);
  });

  it("should preserve original error code", () => {
    const error = new ClobApiException({
      message: "Auth failed",
      statusCode: 401,
      code: "CUSTOM_CODE",
    });

    const classified = classifyAuthError(error);

    expect(classified.originalCode).toBe("CUSTOM_CODE");
  });
});

describe("isAuthError", () => {
  it("should return true for 401 errors", () => {
    const error = new ClobApiException({
      message: "Unauthorized",
      statusCode: 401,
    });

    expect(isAuthError(error)).toBe(true);
  });

  it("should return true for 403 errors", () => {
    const error = new ClobApiException({
      message: "Forbidden",
      statusCode: 403,
    });

    expect(isAuthError(error)).toBe(true);
  });

  it("should return false for other status codes", () => {
    const error = new ClobApiException({
      message: "Not found",
      statusCode: 404,
    });

    expect(isAuthError(error)).toBe(false);
  });

  it("should return false for non-ClobApiException errors", () => {
    const error = new Error("Regular error");

    expect(isAuthError(error)).toBe(false);
  });
});

describe("isRetryableAuthError", () => {
  it("should return true for timestamp errors", () => {
    const error = new ClobApiException({
      message: "Timestamp expired",
      statusCode: 401,
      code: "TIMESTAMP_EXPIRED",
    });

    expect(isRetryableAuthError(error)).toBe(true);
  });

  it("should return true for rate limit errors", () => {
    const error = new ClobApiException({
      message: "Rate limited",
      statusCode: 429,
    });

    expect(isRetryableAuthError(error)).toBe(true);
  });

  it("should return false for invalid signature errors", () => {
    const error = new ClobApiException({
      message: "Invalid signature",
      statusCode: 401,
      code: "INVALID_SIGNATURE",
    });

    expect(isRetryableAuthError(error)).toBe(false);
  });

  it("should return false for missing credentials errors", () => {
    const error = new ClobApiException({
      message: "Missing credentials",
      statusCode: 401,
      code: "MISSING_CREDENTIALS",
    });

    expect(isRetryableAuthError(error)).toBe(false);
  });
});

describe("CredentialStore", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.POLY_API_KEY;
    delete process.env.POLY_API_SECRET;
    delete process.env.POLY_API_PASSPHRASE;
  });

  it("should create an empty store", () => {
    const store = new CredentialStore({ allowEnvVars: false });

    expect(store.hasCredentials()).toBe(false);
    expect(store.getCredentials()).toBeNull();
  });

  it("should store and retrieve credentials", () => {
    const store = new CredentialStore({ allowEnvVars: false });
    const creds: ClobCredentials = {
      apiKey: "test-key",
      apiSecret: "test-secret",
      apiPassphrase: "test-passphrase",
    };

    store.setCredentials(creds);

    expect(store.hasCredentials()).toBe(true);
    expect(store.getCredentials()).toEqual(creds);
  });

  it("should clear credentials", () => {
    const store = new CredentialStore({ allowEnvVars: false });
    store.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    store.clearCredentials();

    expect(store.hasCredentials()).toBe(false);
    expect(store.getCredentials()).toBeNull();
  });

  it("should track credentials age", () => {
    vi.useFakeTimers();
    const store = new CredentialStore({ allowEnvVars: false });

    store.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    expect(store.getCredentialsAge()).toBe(0);

    vi.advanceTimersByTime(5000);

    expect(store.getCredentialsAge()).toBe(5000);

    vi.useRealTimers();
  });

  it("should return masked credentials", () => {
    const store = new CredentialStore({ allowEnvVars: false });
    store.setCredentials({
      apiKey: "test-api-key-12345678",
      apiSecret: "test-secret",
      apiPassphrase: "passphrase",
    });

    const masked = store.getMaskedCredentials();

    expect(masked.apiKey).toBe("test...5678");
    expect(masked.hasSecret).toBe(true);
    expect(masked.hasPassphrase).toBe(true);
  });

  it("should load from environment variables when allowed", () => {
    process.env.POLY_API_KEY = "env-api-key";
    process.env.POLY_API_SECRET = "env-api-secret";
    process.env.POLY_API_PASSPHRASE = "env-passphrase";

    const store = new CredentialStore({ allowEnvVars: true });

    expect(store.hasCredentials()).toBe(true);
    const creds = store.getCredentials();
    expect(creds?.apiKey).toBe("env-api-key");
    expect(creds?.apiSecret).toBe("env-api-secret");
    expect(creds?.apiPassphrase).toBe("env-passphrase");
  });

  it("should use custom env var prefix", () => {
    process.env.CUSTOM_API_KEY = "custom-key";
    process.env.CUSTOM_API_SECRET = "custom-secret";

    const store = new CredentialStore({
      allowEnvVars: true,
      envVarPrefix: "CUSTOM_",
    });

    expect(store.hasCredentials()).toBe(true);
    expect(store.getCredentials()?.apiKey).toBe("custom-key");

    delete process.env.CUSTOM_API_KEY;
    delete process.env.CUSTOM_API_SECRET;
  });

  it("should not load from env vars when disabled", () => {
    process.env.POLY_API_KEY = "env-api-key";
    process.env.POLY_API_SECRET = "env-api-secret";

    const store = new CredentialStore({ allowEnvVars: false });

    expect(store.hasCredentials()).toBe(false);
  });

  it("should support in-memory encryption", () => {
    const store = new CredentialStore({
      allowEnvVars: false,
      encryptInMemory: true,
      encryptionKey: "my-secret-key",
    });

    const creds: ClobCredentials = {
      apiKey: "test-key",
      apiSecret: "test-secret",
    };

    store.setCredentials(creds);

    // Should be able to retrieve decrypted credentials
    expect(store.getCredentials()).toEqual(creds);
  });

  it("should validate credentials on set", () => {
    const store = new CredentialStore({ allowEnvVars: false });

    expect(() =>
      store.setCredentials({
        apiKey: "",
        apiSecret: "test-secret",
      })
    ).toThrow("API key is required");
  });
});

describe("AuthManager", () => {
  beforeEach(() => {
    resetSharedAuthManager();
    delete process.env.POLY_API_KEY;
    delete process.env.POLY_API_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create manager without credentials", () => {
    const manager = createAuthManager({ allowEnvVars: false });

    expect(manager.hasCredentials()).toBe(false);
  });

  it("should set and get credentials", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    const creds: ClobCredentials = {
      apiKey: "test-key",
      apiSecret: "test-secret",
    };

    manager.setCredentials(creds);

    expect(manager.hasCredentials()).toBe(true);
    expect(manager.getCredentials()).toEqual(creds);
  });

  it("should generate auth headers", async () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const headers = await manager.generateHeaders("GET", "/test");

    expect(headers["POLY-API-KEY"]).toBe("test-key");
    expect(headers["POLY-SIGNATURE"]).toBeDefined();
    expect(headers["POLY-TIMESTAMP"]).toBeDefined();
  });

  it("should throw when generating headers without credentials", async () => {
    const manager = createAuthManager({ allowEnvVars: false });

    await expect(manager.generateHeaders("GET", "/test")).rejects.toThrow(
      "No credentials stored"
    );
  });

  it("should track auth success", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    manager.recordSuccess();

    const state = manager.getState();
    expect(state.authFailures).toBe(0);
    expect(state.lastSuccessfulAuth).toBeDefined();
    expect(state.lastError).toBeUndefined();
  });

  it("should track auth failures", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const error = new ClobApiException({
      message: "Auth failed",
      statusCode: 401,
    });

    manager.recordFailure(error);

    const state = manager.getState();
    expect(state.authFailures).toBe(1);
    expect(state.lastFailedAuth).toBeDefined();
    expect(state.lastError).toBeDefined();
    expect(state.lastError?.type).toBe(AuthErrorType.INVALID_SIGNATURE);
  });

  it("should reset failures on success", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    manager.recordFailure(new Error("fail1"));
    manager.recordFailure(new Error("fail2"));
    expect(manager.getState().authFailures).toBe(2);

    manager.recordSuccess();
    expect(manager.getState().authFailures).toBe(0);
  });

  it("should detect rotation needed after max failures", () => {
    const manager = createAuthManager(
      { allowEnvVars: false },
      { maxAuthFailures: 3 }
    );
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    manager.recordFailure(new Error("fail1"));
    manager.recordFailure(new Error("fail2"));
    expect(manager.isRotationNeeded().needed).toBe(false);

    manager.recordFailure(new Error("fail3"));
    expect(manager.isRotationNeeded().needed).toBe(true);
    expect(manager.isRotationNeeded().reason).toContain("3 consecutive");
  });

  it("should detect rotation needed for expired credentials", () => {
    vi.useFakeTimers();
    const manager = createAuthManager(
      { allowEnvVars: false },
      { maxCredentialAge: 1000 } // 1 second
    );

    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    expect(manager.isRotationNeeded().needed).toBe(false);

    vi.advanceTimersByTime(2000);

    expect(manager.isRotationNeeded().needed).toBe(true);
    expect(manager.isRotationNeeded().reason).toContain("exceeded maximum age");
  });

  it("should detect rotation needed for revoked key error", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const error = new ClobApiException({
      message: "Key has been revoked",
      statusCode: 401,
      code: "KEY_REVOKED",
    });

    manager.recordFailure(error);

    expect(manager.isRotationNeeded().needed).toBe(true);
    expect(manager.isRotationNeeded().reason).toContain("revoked");
  });

  it("should call rotation callback when rotating", async () => {
    const rotationCallback = vi.fn().mockResolvedValue({
      apiKey: "new-key",
      apiSecret: "new-secret",
    });

    const manager = createAuthManager(
      { allowEnvVars: false },
      { maxAuthFailures: 1, onRotationNeeded: rotationCallback }
    );

    manager.setCredentials({
      apiKey: "old-key",
      apiSecret: "old-secret",
    });

    manager.recordFailure(new Error("fail"));

    const rotated = await manager.rotateCredentials();

    expect(rotated).toBe(true);
    expect(rotationCallback).toHaveBeenCalled();
    expect(manager.getCredentials()?.apiKey).toBe("new-key");
  });

  it("should not rotate when callback returns null", async () => {
    const rotationCallback = vi.fn().mockResolvedValue(null);

    const manager = createAuthManager(
      { allowEnvVars: false },
      { maxAuthFailures: 1, onRotationNeeded: rotationCallback }
    );

    manager.setCredentials({
      apiKey: "old-key",
      apiSecret: "old-secret",
    });

    manager.recordFailure(new Error("fail"));

    const rotated = await manager.rotateCredentials();

    expect(rotated).toBe(false);
    expect(manager.getCredentials()?.apiKey).toBe("old-key");
  });

  it("should reset all state", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });
    manager.recordFailure(new Error("fail"));
    manager.recordSuccess();

    manager.reset();

    expect(manager.hasCredentials()).toBe(false);
    expect(manager.getState().authFailures).toBe(0);
    expect(manager.getState().lastSuccessfulAuth).toBeUndefined();
    expect(manager.getState().lastError).toBeUndefined();
  });

  it("should return masked credentials", () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-api-key-12345678",
      apiSecret: "test-secret",
      apiPassphrase: "passphrase",
    });

    const masked = manager.getMaskedCredentials();

    expect(masked.apiKey).toBe("test...5678");
    expect(masked.hasSecret).toBe(true);
    expect(masked.hasPassphrase).toBe(true);
  });
});

describe("Shared AuthManager", () => {
  beforeEach(() => {
    resetSharedAuthManager();
    delete process.env.POLY_API_KEY;
    delete process.env.POLY_API_SECRET;
  });

  it("should return singleton instance", () => {
    const manager1 = getSharedAuthManager();
    const manager2 = getSharedAuthManager();

    expect(manager1).toBe(manager2);
  });

  it("should allow setting custom shared manager", () => {
    const customManager = createAuthManager({ allowEnvVars: false });
    customManager.setCredentials({
      apiKey: "custom-key",
      apiSecret: "custom-secret",
    });

    setSharedAuthManager(customManager);

    expect(getSharedAuthManager().getCredentials()?.apiKey).toBe("custom-key");
  });

  it("should reset shared manager", () => {
    const manager = getSharedAuthManager();
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    resetSharedAuthManager();

    // New instance should be created
    const newManager = getSharedAuthManager();
    expect(newManager.hasCredentials()).toBe(false);
  });
});

describe("withAuth", () => {
  beforeEach(() => {
    resetSharedAuthManager();
    delete process.env.POLY_API_KEY;
    delete process.env.POLY_API_SECRET;
  });

  it("should execute function with auth headers", async () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const mockFn = vi.fn().mockResolvedValue("success");

    const result = await withAuth(mockFn, "GET", "/test", undefined, manager);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        "POLY-API-KEY": "test-key",
      })
    );
  });

  it("should record success on successful execution", async () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    await withAuth(() => Promise.resolve("ok"), "GET", "/test", undefined, manager);

    expect(manager.getState().lastSuccessfulAuth).toBeDefined();
  });

  it("should record failure on error", async () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const error = new ClobApiException({
      message: "Auth failed",
      statusCode: 401,
    });

    await expect(
      withAuth(() => Promise.reject(error), "GET", "/test", undefined, manager)
    ).rejects.toThrow();

    expect(manager.getState().authFailures).toBe(1);
  });

  it("should attempt rotation on repeated failures", async () => {
    const rotationCallback = vi.fn().mockResolvedValue({
      apiKey: "new-key",
      apiSecret: "new-secret",
    });

    const manager = createAuthManager(
      { allowEnvVars: false },
      { maxAuthFailures: 1, onRotationNeeded: rotationCallback }
    );

    manager.setCredentials({
      apiKey: "old-key",
      apiSecret: "old-secret",
    });

    // First call fails
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(
        new ClobApiException({ message: "fail", statusCode: 401 })
      )
      .mockResolvedValueOnce("success after rotation");

    // This should fail, trigger rotation, then succeed
    const result = await withAuth(mockFn, "GET", "/test", undefined, manager);

    expect(result).toBe("success after rotation");
    expect(rotationCallback).toHaveBeenCalled();
  });

  it("should use shared manager when none provided", async () => {
    const sharedManager = getSharedAuthManager();
    sharedManager.setCredentials({
      apiKey: "shared-key",
      apiSecret: "shared-secret",
    });

    const mockFn = vi.fn().mockResolvedValue("ok");

    await withAuth(mockFn, "GET", "/test");

    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        "POLY-API-KEY": "shared-key",
      })
    );
  });

  it("should pass body to signature generation", async () => {
    const manager = createAuthManager({ allowEnvVars: false });
    manager.setCredentials({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    const mockFn = vi.fn().mockResolvedValue("ok");

    await withAuth(mockFn, "POST", "/test", '{"data":"value"}', manager);

    // The signature should be different with body
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        "POLY-SIGNATURE": expect.any(String),
      })
    );
  });
});

describe("AuthErrorType enum", () => {
  it("should have all expected error types", () => {
    expect(AuthErrorType.MISSING_CREDENTIALS).toBe("MISSING_CREDENTIALS");
    expect(AuthErrorType.INVALID_KEY_FORMAT).toBe("INVALID_KEY_FORMAT");
    expect(AuthErrorType.KEY_REVOKED).toBe("KEY_REVOKED");
    expect(AuthErrorType.KEY_EXPIRED).toBe("KEY_EXPIRED");
    expect(AuthErrorType.INVALID_SIGNATURE).toBe("INVALID_SIGNATURE");
    expect(AuthErrorType.TIMESTAMP_EXPIRED).toBe("TIMESTAMP_EXPIRED");
    expect(AuthErrorType.INVALID_PASSPHRASE).toBe("INVALID_PASSPHRASE");
    expect(AuthErrorType.IP_NOT_WHITELISTED).toBe("IP_NOT_WHITELISTED");
    expect(AuthErrorType.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(AuthErrorType.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
    expect(AuthErrorType.UNKNOWN).toBe("UNKNOWN");
  });
});
