/**
 * Polymarket CLOB (Central Limit Order Book) API Client
 *
 * HTTP client for interacting with the Polymarket CLOB API.
 * Provides access to order books, trades, and market data.
 *
 * The CLOB API has two types of endpoints:
 * - Public endpoints: No authentication required (market data, order books, trades)
 * - Private endpoints: Require API key authentication (placing orders, account data)
 *
 * @see https://docs.polymarket.com/#clob-api
 */

import {
  ClobClientConfig,
  ClobRequestOptions,
  ClobApiError,
  ClobCredentials,
  SignedHeaders,
} from "./types";

/**
 * Default configuration for the CLOB API client
 */
const DEFAULT_CONFIG: Required<Omit<ClobClientConfig, "apiSecret" | "apiPassphrase">> & {
  apiSecret: string;
  apiPassphrase: string;
} = {
  baseUrl: "https://clob.polymarket.com",
  apiKey: "",
  apiSecret: "",
  apiPassphrase: "",
  timeout: 30000, // 30 seconds
  retries: 3,
};

/**
 * Custom error class for CLOB API errors
 */
export class ClobApiException extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(error: ClobApiError) {
    super(error.message);
    this.name = "ClobApiException";
    this.statusCode = error.statusCode;
    this.code = error.code;
  }
}

/**
 * Generate HMAC-SHA256 signature for authenticated requests
 *
 * @param secret - API secret
 * @param timestamp - Request timestamp
 * @param method - HTTP method
 * @param path - Request path
 * @param body - Request body (optional)
 * @returns Base64 encoded signature
 */
async function generateSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body?: string
): Promise<string> {
  const message = timestamp + method.toUpperCase() + path + (body ?? "");

  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * CLOB API Client class
 *
 * Provides a typed interface for making requests to the Polymarket CLOB API.
 * Supports both authenticated and unauthenticated requests.
 *
 * @example
 * ```typescript
 * // Public endpoints (no authentication)
 * const client = new ClobClient();
 * const orderBook = await client.get<OrderBook>('/book?token_id=123');
 *
 * // Private endpoints (with authentication)
 * const authClient = new ClobClient({
 *   apiKey: 'your-api-key',
 *   apiSecret: 'your-api-secret',
 *   apiPassphrase: 'your-passphrase'
 * });
 * const orders = await authClient.get<Order[]>('/orders', { requiresAuth: true });
 * ```
 */
export class ClobClient {
  private readonly config: Required<Omit<ClobClientConfig, "apiSecret" | "apiPassphrase">> & {
    apiSecret: string;
    apiPassphrase: string;
  };

  constructor(config: ClobClientConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Get the base URL for API requests
   */
  public getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get the configured timeout in milliseconds
   */
  public getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get the number of retries configured
   */
  public getRetries(): number {
    return this.config.retries;
  }

  /**
   * Check if API credentials are configured
   */
  public hasCredentials(): boolean {
    return this.config.apiKey.length > 0 && this.config.apiSecret.length > 0;
  }

  /**
   * Check if an API key is configured (for basic auth)
   */
  public hasApiKey(): boolean {
    return this.config.apiKey.length > 0;
  }

  /**
   * Get the configured credentials (masked for security)
   */
  public getCredentials(): { apiKey: string; hasSecret: boolean; hasPassphrase: boolean } {
    return {
      apiKey: this.config.apiKey ? `${this.config.apiKey.slice(0, 4)}...` : "",
      hasSecret: this.config.apiSecret.length > 0,
      hasPassphrase: this.config.apiPassphrase.length > 0,
    };
  }

  /**
   * Build default headers for API requests
   */
  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...customHeaders,
    };

    return headers;
  }

  /**
   * Generate authentication headers for signed requests
   *
   * @param method - HTTP method
   * @param path - Request path (without base URL)
   * @param body - Request body (optional)
   * @returns Signed headers object
   */
  public async generateAuthHeaders(
    method: string,
    path: string,
    body?: string
  ): Promise<SignedHeaders> {
    if (!this.hasCredentials()) {
      throw new ClobApiException({
        message: "API credentials required for authenticated endpoints",
        statusCode: 401,
        code: "MISSING_CREDENTIALS",
      });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await generateSignature(
      this.config.apiSecret,
      timestamp,
      method,
      path,
      body
    );

    const headers: SignedHeaders = {
      "POLY-API-KEY": this.config.apiKey,
      "POLY-SIGNATURE": signature,
      "POLY-TIMESTAMP": timestamp,
    };

    if (this.config.apiPassphrase) {
      headers["POLY-PASSPHRASE"] = this.config.apiPassphrase;
    }

    return headers;
  }

  /**
   * Create an AbortController with timeout
   */
  private createAbortController(timeout: number): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller;
  }

  /**
   * Extract path from full URL for signing
   */
  private extractPath(endpoint: string): string {
    // If the endpoint starts with http, parse the URL to get path
    if (endpoint.startsWith("http")) {
      const url = new URL(endpoint);
      return url.pathname + url.search;
    }
    return endpoint;
  }

  /**
   * Make an HTTP request to the CLOB API
   *
   * @param endpoint - API endpoint (relative to base URL)
   * @param options - Request options
   * @returns Typed response data
   * @throws ClobApiException on API errors
   */
  public async request<T>(endpoint: string, options: ClobRequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      headers: customHeaders,
      body,
      timeout = this.config.timeout,
      requiresAuth = false,
    } = options;

    const url = endpoint.startsWith("http") ? endpoint : `${this.config.baseUrl}${endpoint}`;
    const path = this.extractPath(endpoint);
    const bodyString = body ? JSON.stringify(body) : undefined;

    let headers = this.buildHeaders(customHeaders);

    // Add authentication headers if required
    if (requiresAuth) {
      const authHeaders = await this.generateAuthHeaders(method, path, bodyString);
      headers = { ...headers, ...authHeaders };
    }

    const controller = this.createAbortController(timeout);

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (bodyString && method !== "GET") {
      fetchOptions.body = bodyString;
    }

    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts < this.config.retries) {
      attempts++;

      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          let errorCode: string | undefined;

          try {
            const errorJson = JSON.parse(errorBody) as {
              message?: string;
              error?: string;
              code?: string;
            };
            errorMessage = errorJson.message ?? errorJson.error ?? errorMessage;
            errorCode = errorJson.code;
          } catch {
            // If parsing fails, use the text as the message
            if (errorBody) {
              errorMessage = errorBody;
            }
          }

          throw new ClobApiException({
            message: errorMessage,
            statusCode: response.status,
            code: errorCode,
          });
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        return JSON.parse(text) as T;
      } catch (error) {
        if (error instanceof ClobApiException) {
          // Don't retry on client errors (4xx), except 429 (rate limit)
          if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
            throw error;
          }
        }

        if (error instanceof Error && error.name === "AbortError") {
          lastError = new Error(`Request timeout after ${timeout}ms`);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        // If this isn't the last attempt, wait before retrying
        if (attempts < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("Request failed after all retries");
  }

  /**
   * Make a GET request
   *
   * @param endpoint - API endpoint
   * @param options - Additional request options
   * @returns Typed response data
   */
  public async get<T>(
    endpoint: string,
    options: Omit<ClobRequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  /**
   * Make a POST request
   *
   * @param endpoint - API endpoint
   * @param body - Request body
   * @param options - Additional request options
   * @returns Typed response data
   */
  public async post<T>(
    endpoint: string,
    body?: unknown,
    options: Omit<ClobRequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  /**
   * Make a PUT request
   *
   * @param endpoint - API endpoint
   * @param body - Request body
   * @param options - Additional request options
   * @returns Typed response data
   */
  public async put<T>(
    endpoint: string,
    body?: unknown,
    options: Omit<ClobRequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  /**
   * Make a DELETE request
   *
   * @param endpoint - API endpoint
   * @param options - Additional request options
   * @returns Typed response data
   */
  public async delete<T>(
    endpoint: string,
    options: Omit<ClobRequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

/**
 * Singleton instance of the CLOB client with default configuration
 *
 * This can be imported directly for convenience:
 * ```typescript
 * import { clobClient } from '@/api/clob/client';
 * ```
 */
export const clobClient = new ClobClient();

/**
 * Create a new CLOB client with custom configuration
 *
 * @param config - Client configuration options
 * @returns New ClobClient instance
 *
 * @example
 * ```typescript
 * // Public endpoints only
 * const client = createClobClient();
 *
 * // With authentication for private endpoints
 * const authClient = createClobClient({
 *   apiKey: process.env.POLY_API_KEY,
 *   apiSecret: process.env.POLY_API_SECRET,
 *   apiPassphrase: process.env.POLY_API_PASSPHRASE,
 * });
 * ```
 */
export function createClobClient(config: ClobClientConfig = {}): ClobClient {
  return new ClobClient(config);
}

/**
 * Check if credentials are valid by making a test request
 *
 * @param credentials - API credentials to validate
 * @param config - Additional client configuration
 * @returns True if credentials are valid
 */
export async function validateCredentials(
  credentials: ClobCredentials,
  config: Omit<ClobClientConfig, "apiKey" | "apiSecret" | "apiPassphrase"> = {}
): Promise<boolean> {
  const client = createClobClient({
    ...config,
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    apiPassphrase: credentials.apiPassphrase,
  });

  try {
    // Try to fetch user's API key info (a simple authenticated endpoint)
    await client.get("/auth/api-key", { requiresAuth: true });
    return true;
  } catch (error) {
    if (error instanceof ClobApiException) {
      // 401/403 means invalid credentials
      if (error.statusCode === 401 || error.statusCode === 403) {
        return false;
      }
      // Other errors might be server issues, not credential issues
      throw error;
    }
    throw error;
  }
}
