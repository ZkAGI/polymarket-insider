/**
 * Tests for Polymarket Gamma API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GammaClient,
  GammaApiException,
  createGammaClient,
  gammaClient,
} from "@/api/gamma/client";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GammaClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor and configuration", () => {
    it("should create client with default configuration", () => {
      const client = new GammaClient();
      expect(client.getBaseUrl()).toBe("https://gamma-api.polymarket.com");
      expect(client.getTimeout()).toBe(30000);
      expect(client.getRetries()).toBe(3);
      expect(client.hasApiKey()).toBe(false);
    });

    it("should create client with custom configuration", () => {
      const client = new GammaClient({
        baseUrl: "https://custom-api.example.com",
        apiKey: "test-api-key",
        timeout: 60000,
        retries: 5,
      });
      expect(client.getBaseUrl()).toBe("https://custom-api.example.com");
      expect(client.getTimeout()).toBe(60000);
      expect(client.getRetries()).toBe(5);
      expect(client.hasApiKey()).toBe(true);
    });

    it("should partially override configuration", () => {
      const client = new GammaClient({
        timeout: 10000,
      });
      expect(client.getBaseUrl()).toBe("https://gamma-api.polymarket.com");
      expect(client.getTimeout()).toBe(10000);
      expect(client.getRetries()).toBe(3);
    });
  });

  describe("createGammaClient factory", () => {
    it("should create a new client instance", () => {
      const client = createGammaClient();
      expect(client).toBeInstanceOf(GammaClient);
    });

    it("should create client with custom config", () => {
      const client = createGammaClient({ baseUrl: "https://test.com" });
      expect(client.getBaseUrl()).toBe("https://test.com");
    });
  });

  describe("singleton instance", () => {
    it("should export a default client instance", () => {
      expect(gammaClient).toBeInstanceOf(GammaClient);
      expect(gammaClient.getBaseUrl()).toBe("https://gamma-api.polymarket.com");
    });
  });

  describe("get method", () => {
    it("should make GET request with correct URL", async () => {
      const mockResponse = { data: "test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const client = new GammaClient();
      const result = await client.get<{ data: string }>("/test-endpoint");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gamma-api.polymarket.com/test-endpoint",
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

    it("should include Authorization header when API key is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("{}"),
      });

      const client = new GammaClient({ apiKey: "secret-key" });
      await client.get("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer secret-key",
          }),
        })
      );
    });

    it("should handle empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      const client = new GammaClient();
      const result = await client.get("/empty");

      expect(result).toEqual({});
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

      const client = new GammaClient();
      const result = await client.post<{ id: number }>("/create", requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://gamma-api.polymarket.com/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestBody),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("should throw GammaApiException on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(JSON.stringify({ message: "Market not found" })),
      });

      const client = new GammaClient({ retries: 1 });

      await expect(client.get("/nonexistent")).rejects.toThrow(GammaApiException);
      await expect(client.get("/nonexistent")).rejects.toMatchObject({
        statusCode: 404,
        message: "Market not found",
      });
    });

    it("should not retry on 4xx errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Bad request"),
      });

      const client = new GammaClient({ retries: 3 });

      await expect(client.get("/bad")).rejects.toThrow(GammaApiException);
      expect(mockFetch).toHaveBeenCalledTimes(1);
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

      const client = new GammaClient({ retries: 3 });
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

      const client = new GammaClient({ retries: 2 });

      await expect(client.get("/down")).rejects.toThrow(GammaApiException);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const client = new GammaClient({ retries: 1 });

      await expect(client.get("/test")).rejects.toThrow("Network error");
    });

    it("should parse error message from JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        text: () => Promise.resolve(JSON.stringify({ error: "Validation failed" })),
      });

      const client = new GammaClient({ retries: 1 });

      await expect(client.get("/validate")).rejects.toMatchObject({
        message: "Validation failed",
        statusCode: 422,
      });
    });

    it("should handle non-JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Plain text error"),
      });

      const client = new GammaClient({ retries: 1 });

      await expect(client.get("/error")).rejects.toMatchObject({
        message: "Plain text error",
        statusCode: 500,
      });
    });
  });

  describe("GammaApiException", () => {
    it("should have correct properties", () => {
      const error = new GammaApiException({
        message: "Test error",
        statusCode: 500,
        code: "ERR_TEST",
      });

      expect(error.name).toBe("GammaApiException");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("ERR_TEST");
    });

    it("should work without code", () => {
      const error = new GammaApiException({
        message: "Test error",
        statusCode: 404,
      });

      expect(error.code).toBeUndefined();
    });
  });
});
