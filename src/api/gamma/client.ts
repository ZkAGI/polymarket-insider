/**
 * Polymarket Gamma API Client
 *
 * HTTP client for interacting with the Polymarket Gamma API.
 * Uses native fetch with typed responses and error handling.
 */

import { GammaClientConfig, GammaRequestOptions, GammaApiError } from "./types";

/**
 * Default configuration for the Gamma API client
 */
const DEFAULT_CONFIG: Required<GammaClientConfig> = {
  baseUrl: "https://gamma-api.polymarket.com",
  apiKey: "",
  timeout: 30000, // 30 seconds
  retries: 3,
};

/**
 * Custom error class for Gamma API errors
 */
export class GammaApiException extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(error: GammaApiError) {
    super(error.message);
    this.name = "GammaApiException";
    this.statusCode = error.statusCode;
    this.code = error.code;
  }
}

/**
 * Gamma API Client class
 *
 * Provides a typed interface for making requests to the Polymarket Gamma API.
 *
 * @example
 * ```typescript
 * const client = new GammaClient();
 * const response = await client.get<GammaMarket[]>('/markets');
 * ```
 */
export class GammaClient {
  private readonly config: Required<GammaClientConfig>;

  constructor(config: GammaClientConfig = {}) {
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
   * Check if an API key is configured
   */
  public hasApiKey(): boolean {
    return this.config.apiKey.length > 0;
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

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
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
   * Make an HTTP request to the Gamma API
   *
   * @param endpoint - API endpoint (relative to base URL)
   * @param options - Request options
   * @returns Typed response data
   * @throws GammaApiException on API errors
   */
  public async request<T>(endpoint: string, options: GammaRequestOptions = {}): Promise<T> {
    const { method = "GET", headers: customHeaders, body, timeout = this.config.timeout } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = this.buildHeaders(customHeaders);
    const controller = this.createAbortController(timeout);

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
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

          try {
            const errorJson = JSON.parse(errorBody) as { message?: string; error?: string };
            errorMessage = errorJson.message ?? errorJson.error ?? errorMessage;
          } catch {
            // If parsing fails, use the text as the message
            if (errorBody) {
              errorMessage = errorBody;
            }
          }

          throw new GammaApiException({
            message: errorMessage,
            statusCode: response.status,
          });
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        return JSON.parse(text) as T;
      } catch (error) {
        if (error instanceof GammaApiException) {
          // Don't retry on client errors (4xx)
          if (error.statusCode >= 400 && error.statusCode < 500) {
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
    options: Omit<GammaRequestOptions, "method" | "body"> = {}
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
    options: Omit<GammaRequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }
}

/**
 * Create a singleton instance of the Gamma client with default configuration
 *
 * This can be imported directly for convenience:
 * ```typescript
 * import { gammaClient } from '@/api/gamma/client';
 * ```
 */
export const gammaClient = new GammaClient();

/**
 * Create a new Gamma client with custom configuration
 *
 * @param config - Client configuration options
 * @returns New GammaClient instance
 *
 * @example
 * ```typescript
 * const client = createGammaClient({
 *   apiKey: 'your-api-key',
 *   timeout: 60000,
 * });
 * ```
 */
export function createGammaClient(config: GammaClientConfig = {}): GammaClient {
  return new GammaClient(config);
}
