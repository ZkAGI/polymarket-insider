/**
 * Tests for Polymarket CLOB API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClobClient, ClobApiException, createClobClient, clobClient, validateCredentials } from "@/api/clob/client";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock crypto.subtle for HMAC signature generation
const mockSign = vi.fn();
const mockImportKey = vi.fn();

vi.stubGlobal("crypto", {
  subtle: {
    importKey: mockImportKey,
    sign: mockSign,
  },
});

describe("ClobClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockSign.mockReset();
    mockImportKey.mockReset();

    // Default mock for crypto.subtle.importKey
    mockImportKey.mockResolvedValue({ type: "secret" });

    // Default mock for crypto.subtle.sign - returns a dummy signature
    mockSign.mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor and configuration", () => {
    it("should create client with default configuration", () => {
      const client = new ClobClient();
      expect(client.getBaseUrl()).toBe("https://clob.polymarket.com");
      expect(client.getTimeout()).toBe(30000);
      expect(client.getRetries()).toBe(3);
      expect(client.hasApiKey()).toBe(false);
      expect(client.hasCredentials()).toBe(false);
    });

    it("should create client with custom configuration", () => {
      const client = new ClobClient({
        baseUrl: "https://custom-clob.example.com",
        apiKey: "test-api-key",
        apiSecret: "test-secret",
        apiPassphrase: "test-passphrase",
        timeout: 60000,
        retries: 5,
      });
      expect(client.getBaseUrl()).toBe("https://custom-clob.example.com");
      expect(client.getTimeout()).toBe(60000);
      expect(client.getRetries()).toBe(5);
      expect(client.hasApiKey()).toBe(true);
      expect(client.hasCredentials()).toBe(true);
    });

    it("should partially override configuration", () => {
      const client = new ClobClient({
        timeout: 10000,
      });
      expect(client.getBaseUrl()).toBe("https://clob.polymarket.com");
      expect(client.getTimeout()).toBe(10000);
      expect(client.getRetries()).toBe(3);
    });

    it("should report hasCredentials false when only apiKey is set", () => {
      const client = new ClobClient({
        apiKey: "test-key",
      });
      expect(client.hasApiKey()).toBe(true);
      expect(client.hasCredentials()).toBe(false);
    });

    it("should report hasCredentials true when both apiKey and apiSecret are set", () => {
      const client = new ClobClient({
        apiKey: "test-key",
        apiSecret: "test-secret",
      });
      expect(client.hasApiKey()).toBe(true);
      expect(client.hasCredentials()).toBe(true);
    });

    it("should return masked credentials info", () => {
      const client = new ClobClient({
        apiKey: "my-long-api-key",
        apiSecret: "secret",
        apiPassphrase: "passphrase",
      });
      const creds = client.getCredentials();
      expect(creds.apiKey).toBe("my-l...");
      expect(creds.hasSecret).toBe(true);
      expect(creds.hasPassphrase).toBe(true);
    });

    it("should return empty credentials info when not configured", () => {
      const client = new ClobClient();
      const creds = client.getCredentials();
      expect(creds.apiKey).toBe("");
      expect(creds.hasSecret).toBe(false);
      expect(creds.hasPassphrase).toBe(false);
    });
  });

  describe("createClobClient factory", () => {
    it("should create a new client instance", () => {
      const client = createClobClient();
      expect(client).toBeInstanceOf(ClobClient);
    });

    it("should create client with custom config", () => {
      const client = createClobClient({ baseUrl: "https://test.com" });
      expect(client.getBaseUrl()).toBe("https://test.com");
    });
  });

  describe("singleton instance", () => {
    it("should export a default client instance", () => {
      expect(clobClient).toBeInstanceOf(ClobClient);
      expect(clobClient.getBaseUrl()).toBe("https://clob.polymarket.com");
    });
  });

  describe("get method", () => {
    it("should make GET request with correct URL", async () => {
      const mockResponse = { data: "test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await client.get<{ data: string }>("/test-endpoint");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://clob.polymarket.com/test-endpoint",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const client = new ClobClient();
      const result = await client.get("/empty");

      expect(result).toEqual({});
    });

    it("should handle full URL endpoints", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"data": "test"}'),
      });

      const client = new ClobClient();
      await client.get("https://other-api.com/endpoint");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://other-api.com/endpoint",
        expect.any(Object)
      );
    });
  });

  describe("post method", () => {
    it("should make POST request with body", async () => {
      const requestBody = { name: "test" };
      const mockResponse = { id: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new ClobClient();
      const result = await client.post<{ id: number }>("/create", requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://clob.polymarket.com/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestBody),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should make POST request without body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"success": true}'),
      });

      const client = new ClobClient();
      await client.post("/action");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://clob.polymarket.com/action",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("put method", () => {
    it("should make PUT request with body", async () => {
      const requestBody = { updated: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"success": true}'),
      });

      const client = new ClobClient();
      await client.put("/update", requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://clob.polymarket.com/update",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(requestBody),
        })
      );
    });
  });

  describe("delete method", () => {
    it("should make DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"deleted": true}'),
      });

      const client = new ClobClient();
      await client.delete("/remove");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://clob.polymarket.com/remove",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("authentication", () => {
    it("should generate auth headers for authenticated requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"data": "protected"}'),
      });

      const client = new ClobClient({
        apiKey: "test-api-key",
        apiSecret: "test-secret",
        apiPassphrase: "test-pass",
      });

      await client.get("/protected", { requiresAuth: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "POLY-API-KEY": "test-api-key",
            "POLY-SIGNATURE": expect.any(String),
            "POLY-TIMESTAMP": expect.any(String),
            "POLY-PASSPHRASE": "test-pass",
          }),
        })
      );
    });

    it("should not include passphrase header if not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"data": "protected"}'),
      });

      const client = new ClobClient({
        apiKey: "test-api-key",
        apiSecret: "test-secret",
      });

      await client.get("/protected", { requiresAuth: true });

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers["POLY-API-KEY"]).toBe("test-api-key");
      expect(headers["POLY-SIGNATURE"]).toBeDefined();
      expect(headers["POLY-TIMESTAMP"]).toBeDefined();
      expect(headers["POLY-PASSPHRASE"]).toBeUndefined();
    });

    it("should throw error when requiresAuth is true but no credentials", async () => {
      const client = new ClobClient();

      await expect(client.get("/protected", { requiresAuth: true })).rejects.toMatchObject({
        name: "ClobApiException",
        statusCode: 401,
        code: "MISSING_CREDENTIALS",
      });
    });

    it("should call crypto.subtle for signature generation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const client = new ClobClient({
        apiKey: "key",
        apiSecret: "secret",
      });

      await client.get("/test", { requiresAuth: true });

      expect(mockImportKey).toHaveBeenCalled();
      const importKeyCall = mockImportKey.mock.calls[0];
      expect(importKeyCall?.[0]).toBe("raw");
      // Check it's a typed array with numeric elements (handles jsdom/node Uint8Array mismatch)
      const keyData = importKeyCall?.[1];
      expect(keyData).toBeDefined();
      expect(ArrayBuffer.isView(keyData)).toBe(true);
      expect(importKeyCall?.[2]).toEqual({ name: "HMAC", hash: "SHA-256" });
      expect(importKeyCall?.[3]).toBe(false);
      expect(importKeyCall?.[4]).toEqual(["sign"]);
      expect(mockSign).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should throw ClobApiException on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Resource not found" })),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(client.get("/nonexistent")).rejects.toThrow(ClobApiException);
      await expect(client.get("/nonexistent")).rejects.toMatchObject({
        statusCode: 404,
        message: "Resource not found",
      });
    });

    it("should extract error code from response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve(JSON.stringify({ message: "Invalid param", code: "INVALID_PARAM" })),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(client.get("/bad")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid param",
        code: "INVALID_PARAM",
      });
    });

    it("should not retry on 4xx errors (except 429)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Bad request"),
      });

      const client = new ClobClient({ retries: 3 });

      await expect(client.get("/bad")).rejects.toThrow(ClobApiException);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on 429 rate limit errors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: () => Promise.resolve("Rate limited"),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('{"success": true}'),
        });

      const client = new ClobClient({ retries: 3 });
      const result = await client.get<{ success: boolean }>("/rate-limited");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it("should retry on 5xx errors", async () => {
      // First two calls fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Server error"),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Server error"),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('{"success": true}'),
        });

      const client = new ClobClient({ retries: 3 });
      const result = await client.get<{ success: boolean }>("/flaky");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });

    it("should throw after all retries exhausted", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: () => Promise.resolve("Service down"),
      });

      const client = new ClobClient({ retries: 2 });

      await expect(client.get("/down")).rejects.toThrow(ClobApiException);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const client = new ClobClient({ retries: 1 });

      await expect(client.get("/test")).rejects.toThrow("Network error");
    });

    it("should handle non-JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Plain text error"),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(client.get("/error")).rejects.toMatchObject({
        message: "Plain text error",
        statusCode: 500,
      });
    });

    it("should use status text when no body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        statusText: "Gateway Timeout",
        text: () => Promise.resolve(""),
      });

      const client = new ClobClient({ retries: 1 });

      await expect(client.get("/timeout")).rejects.toMatchObject({
        message: "HTTP 504: Gateway Timeout",
        statusCode: 504,
      });
    });
  });

  describe("ClobApiException", () => {
    it("should have correct properties", () => {
      const error = new ClobApiException({
        message: "Test error",
        statusCode: 500,
        code: "ERR_TEST",
      });

      expect(error.name).toBe("ClobApiException");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("ERR_TEST");
    });

    it("should work without code", () => {
      const error = new ClobApiException({
        message: "Test error",
        statusCode: 404,
      });

      expect(error.code).toBeUndefined();
    });

    it("should be instance of Error", () => {
      const error = new ClobApiException({
        message: "Test",
        statusCode: 400,
      });

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("validateCredentials", () => {
    it("should return true for valid credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"valid": true}'),
      });

      const result = await validateCredentials({
        apiKey: "valid-key",
        apiSecret: "valid-secret",
      });

      expect(result).toBe(true);
    });

    it("should return false for invalid credentials (401)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid credentials"),
      });

      const result = await validateCredentials({
        apiKey: "invalid-key",
        apiSecret: "invalid-secret",
      });

      expect(result).toBe(false);
    });

    it("should return false for forbidden credentials (403)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Access denied"),
      });

      const result = await validateCredentials({
        apiKey: "blocked-key",
        apiSecret: "blocked-secret",
      });

      expect(result).toBe(false);
    });

    it("should throw on server errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error"),
      });

      await expect(
        validateCredentials({
          apiKey: "key",
          apiSecret: "secret",
        })
      ).rejects.toThrow(ClobApiException);
    });

    it("should accept passphrase in credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      await validateCredentials({
        apiKey: "key",
        apiSecret: "secret",
        apiPassphrase: "passphrase",
      });

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers["POLY-PASSPHRASE"]).toBe("passphrase");
    });

    it("should accept custom config options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      await validateCredentials(
        { apiKey: "key", apiSecret: "secret" },
        { baseUrl: "https://custom.api.com" }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.api.com/auth/api-key",
        expect.any(Object)
      );
    });
  });

  describe("request with custom headers", () => {
    it("should merge custom headers with defaults", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const client = new ClobClient();
      await client.get("/test", {
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });

    it("should allow overriding default headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const client = new ClobClient();
      await client.get("/test", {
        headers: { "Content-Type": "text/plain" },
      });

      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("text/plain");
    });
  });

  describe("timeout handling", () => {
    it("should use configured timeout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const client = new ClobClient({ timeout: 5000 });
      await client.get("/test");

      // Verify abort controller was created (we can't easily test the timeout value directly)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("should allow timeout override per request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const client = new ClobClient({ timeout: 30000 });
      await client.get("/test", { timeout: 5000 });

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
