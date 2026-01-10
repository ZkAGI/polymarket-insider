/**
 * CLOB API Authentication Module
 *
 * Provides comprehensive authentication functionality for the Polymarket CLOB API:
 * - Auth header generation with HMAC-SHA256 signatures
 * - Secure credential storage with encryption support
 * - API key rotation support
 * - Auth error handling and classification
 *
 * @see API-CLOB-008
 */

import { ClobCredentials, SignedHeaders } from "./types";
import { ClobApiException } from "./client";

/**
 * Authentication error types for classified error handling
 */
export enum AuthErrorType {
  /** Missing API key or secret */
  MISSING_CREDENTIALS = "MISSING_CREDENTIALS",
  /** Invalid API key format */
  INVALID_KEY_FORMAT = "INVALID_KEY_FORMAT",
  /** API key has been revoked or disabled */
  KEY_REVOKED = "KEY_REVOKED",
  /** API key has expired */
  KEY_EXPIRED = "KEY_EXPIRED",
  /** Invalid signature - possibly wrong secret */
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  /** Timestamp is too far from server time */
  TIMESTAMP_EXPIRED = "TIMESTAMP_EXPIRED",
  /** Invalid or missing passphrase */
  INVALID_PASSPHRASE = "INVALID_PASSPHRASE",
  /** IP address not whitelisted */
  IP_NOT_WHITELISTED = "IP_NOT_WHITELISTED",
  /** Rate limit exceeded for this API key */
  RATE_LIMITED = "RATE_LIMITED",
  /** Permission denied for this operation */
  PERMISSION_DENIED = "PERMISSION_DENIED",
  /** Unknown authentication error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Classified authentication error with type and details
 */
export interface ClassifiedAuthError {
  /** Error type for programmatic handling */
  type: AuthErrorType;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Whether this error might be resolved by retrying */
  retryable: boolean;
  /** Suggested action for the user */
  suggestedAction: string;
  /** Original error code from API (if available) */
  originalCode?: string;
}

/**
 * Configuration options for credential storage
 */
export interface CredentialStorageConfig {
  /** Whether to encrypt credentials in memory */
  encryptInMemory?: boolean;
  /** Encryption key (required if encryptInMemory is true) */
  encryptionKey?: string;
  /** Whether to allow storing credentials in environment variables */
  allowEnvVars?: boolean;
  /** Environment variable prefix for credential keys */
  envVarPrefix?: string;
}

/**
 * Configuration for key rotation
 */
export interface KeyRotationConfig {
  /** Callback when key rotation is needed */
  onRotationNeeded?: (reason: string) => Promise<ClobCredentials | null>;
  /** Maximum age of credentials in milliseconds before rotation is suggested */
  maxCredentialAge?: number;
  /** Number of consecutive auth failures before suggesting rotation */
  maxAuthFailures?: number;
}

/**
 * Authentication state tracked by the auth manager
 */
export interface AuthState {
  /** Whether credentials are currently set */
  hasCredentials: boolean;
  /** When credentials were last set */
  credentialsSetAt?: Date;
  /** Number of consecutive auth failures */
  authFailures: number;
  /** Last successful auth timestamp */
  lastSuccessfulAuth?: Date;
  /** Last failed auth timestamp */
  lastFailedAuth?: Date;
  /** Last error encountered */
  lastError?: ClassifiedAuthError;
}

/**
 * Default storage configuration
 */
const DEFAULT_STORAGE_CONFIG: Required<CredentialStorageConfig> = {
  encryptInMemory: false,
  encryptionKey: "",
  allowEnvVars: true,
  envVarPrefix: "POLY_",
};

/**
 * Default key rotation configuration
 */
const DEFAULT_ROTATION_CONFIG: Required<KeyRotationConfig> = {
  onRotationNeeded: async () => null,
  maxCredentialAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxAuthFailures: 5,
};

/**
 * Generate HMAC-SHA256 signature for API authentication
 *
 * Creates a signature following the Polymarket CLOB API specification:
 * message = timestamp + method + path + body
 *
 * @param secret - API secret for signing
 * @param timestamp - Unix timestamp (seconds)
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path including query string
 * @param body - Request body (optional, empty string if none)
 * @returns Base64 encoded HMAC-SHA256 signature
 */
export async function generateSignature(
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
 * Generate authentication headers for a CLOB API request
 *
 * Creates the required headers for authenticated endpoints:
 * - POLY-API-KEY: The API key
 * - POLY-SIGNATURE: HMAC-SHA256 signature
 * - POLY-TIMESTAMP: Unix timestamp (seconds)
 * - POLY-PASSPHRASE: Optional passphrase
 *
 * @param credentials - API credentials
 * @param method - HTTP method
 * @param path - Request path including query string
 * @param body - Request body (optional)
 * @returns Signed headers object
 */
export async function generateAuthHeaders(
  credentials: ClobCredentials,
  method: string,
  path: string,
  body?: string
): Promise<SignedHeaders> {
  validateCredentialFormat(credentials);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await generateSignature(credentials.apiSecret, timestamp, method, path, body);

  const headers: SignedHeaders = {
    "POLY-API-KEY": credentials.apiKey,
    "POLY-SIGNATURE": signature,
    "POLY-TIMESTAMP": timestamp,
  };

  if (credentials.apiPassphrase) {
    headers["POLY-PASSPHRASE"] = credentials.apiPassphrase;
  }

  return headers;
}

/**
 * Validate credential format before use
 *
 * @param credentials - Credentials to validate
 * @throws ClobApiException if credentials are invalid
 */
export function validateCredentialFormat(credentials: ClobCredentials): void {
  if (!credentials.apiKey || credentials.apiKey.trim().length === 0) {
    throw new ClobApiException({
      message: "API key is required",
      statusCode: 401,
      code: "MISSING_API_KEY",
    });
  }

  if (!credentials.apiSecret || credentials.apiSecret.trim().length === 0) {
    throw new ClobApiException({
      message: "API secret is required",
      statusCode: 401,
      code: "MISSING_API_SECRET",
    });
  }

  // Basic format validation - API keys are typically alphanumeric
  if (!/^[a-zA-Z0-9_-]+$/.test(credentials.apiKey)) {
    throw new ClobApiException({
      message: "Invalid API key format",
      statusCode: 401,
      code: "INVALID_KEY_FORMAT",
    });
  }
}

/**
 * Classify an authentication error for programmatic handling
 *
 * @param error - Error to classify
 * @returns Classified error with type, message, and suggested action
 */
export function classifyAuthError(error: unknown): ClassifiedAuthError {
  // Handle ClobApiException
  if (error instanceof ClobApiException) {
    return classifyFromStatusAndCode(error.statusCode, error.code, error.message);
  }

  // Handle standard Error
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes("missing") && message.includes("credential")) {
      return {
        type: AuthErrorType.MISSING_CREDENTIALS,
        message: error.message,
        statusCode: 401,
        retryable: false,
        suggestedAction: "Provide valid API credentials",
      };
    }

    if (message.includes("signature") || message.includes("hmac")) {
      return {
        type: AuthErrorType.INVALID_SIGNATURE,
        message: error.message,
        statusCode: 401,
        retryable: false,
        suggestedAction: "Verify your API secret is correct",
      };
    }

    if (message.includes("timestamp") || message.includes("expired")) {
      return {
        type: AuthErrorType.TIMESTAMP_EXPIRED,
        message: error.message,
        statusCode: 401,
        retryable: true,
        suggestedAction: "Synchronize your system clock and retry",
      };
    }
  }

  // Unknown error
  return {
    type: AuthErrorType.UNKNOWN,
    message: error instanceof Error ? error.message : String(error),
    statusCode: 500,
    retryable: false,
    suggestedAction: "Contact support if the error persists",
  };
}

/**
 * Classify error from HTTP status code and error code
 */
function classifyFromStatusAndCode(
  statusCode: number,
  code?: string,
  message?: string
): ClassifiedAuthError {
  const lowerCode = code?.toLowerCase() ?? "";
  const lowerMessage = message?.toLowerCase() ?? "";

  // 401 Unauthorized
  if (statusCode === 401) {
    if (lowerCode.includes("missing") || lowerCode.includes("required")) {
      return {
        type: AuthErrorType.MISSING_CREDENTIALS,
        message: message ?? "API credentials are missing",
        statusCode,
        retryable: false,
        suggestedAction: "Provide valid API key and secret",
        originalCode: code,
      };
    }

    if (lowerCode.includes("invalid_key") || lowerCode.includes("key_format")) {
      return {
        type: AuthErrorType.INVALID_KEY_FORMAT,
        message: message ?? "API key format is invalid",
        statusCode,
        retryable: false,
        suggestedAction: "Check your API key format",
        originalCode: code,
      };
    }

    if (lowerCode.includes("signature") || lowerMessage.includes("signature")) {
      return {
        type: AuthErrorType.INVALID_SIGNATURE,
        message: message ?? "Request signature is invalid",
        statusCode,
        retryable: false,
        suggestedAction: "Verify your API secret is correct",
        originalCode: code,
      };
    }

    if (lowerCode.includes("timestamp") || lowerMessage.includes("timestamp")) {
      return {
        type: AuthErrorType.TIMESTAMP_EXPIRED,
        message: message ?? "Request timestamp is invalid or expired",
        statusCode,
        retryable: true,
        suggestedAction: "Synchronize your system clock and retry",
        originalCode: code,
      };
    }

    if (lowerCode.includes("passphrase") || lowerMessage.includes("passphrase")) {
      return {
        type: AuthErrorType.INVALID_PASSPHRASE,
        message: message ?? "API passphrase is invalid",
        statusCode,
        retryable: false,
        suggestedAction: "Check your API passphrase",
        originalCode: code,
      };
    }

    if (lowerCode.includes("revoked") || lowerCode.includes("disabled")) {
      return {
        type: AuthErrorType.KEY_REVOKED,
        message: message ?? "API key has been revoked or disabled",
        statusCode,
        retryable: false,
        suggestedAction: "Generate a new API key from Polymarket",
        originalCode: code,
      };
    }

    if (lowerCode.includes("expired")) {
      return {
        type: AuthErrorType.KEY_EXPIRED,
        message: message ?? "API key has expired",
        statusCode,
        retryable: false,
        suggestedAction: "Renew your API key from Polymarket",
        originalCode: code,
      };
    }

    // Default 401
    return {
      type: AuthErrorType.INVALID_SIGNATURE,
      message: message ?? "Authentication failed",
      statusCode,
      retryable: false,
      suggestedAction: "Verify your API credentials are correct",
      originalCode: code,
    };
  }

  // 403 Forbidden
  if (statusCode === 403) {
    if (lowerCode.includes("ip") || lowerMessage.includes("ip")) {
      return {
        type: AuthErrorType.IP_NOT_WHITELISTED,
        message: message ?? "IP address not whitelisted",
        statusCode,
        retryable: false,
        suggestedAction: "Add your IP address to the API key whitelist",
        originalCode: code,
      };
    }

    return {
      type: AuthErrorType.PERMISSION_DENIED,
      message: message ?? "Permission denied for this operation",
      statusCode,
      retryable: false,
      suggestedAction: "Check your API key permissions",
      originalCode: code,
    };
  }

  // 429 Rate Limited
  if (statusCode === 429) {
    return {
      type: AuthErrorType.RATE_LIMITED,
      message: message ?? "API rate limit exceeded",
      statusCode,
      retryable: true,
      suggestedAction: "Wait before making more requests",
      originalCode: code,
    };
  }

  // Unknown
  return {
    type: AuthErrorType.UNKNOWN,
    message: message ?? "Unknown authentication error",
    statusCode,
    retryable: statusCode >= 500,
    suggestedAction: "Contact support if the error persists",
    originalCode: code,
  };
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ClobApiException) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  return false;
}

/**
 * Check if an authentication error is retryable
 */
export function isRetryableAuthError(error: unknown): boolean {
  const classified = classifyAuthError(error);
  return classified.retryable;
}

/**
 * Simple XOR encryption for in-memory credential protection
 * Note: This is not cryptographically secure, just obfuscation
 */
function xorEncrypt(text: string, key: string): string {
  if (!key) return text;
  return Array.from(text)
    .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join("");
}

/**
 * Secure credential storage with optional encryption
 */
export class CredentialStore {
  private encryptedApiKey: string = "";
  private encryptedApiSecret: string = "";
  private encryptedPassphrase: string = "";
  private readonly config: Required<CredentialStorageConfig>;
  private credentialsSetAt?: Date;

  constructor(config: CredentialStorageConfig = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };

    // Load from environment variables if allowed
    if (this.config.allowEnvVars) {
      this.loadFromEnv();
    }
  }

  /**
   * Load credentials from environment variables
   */
  private loadFromEnv(): void {
    const prefix = this.config.envVarPrefix;
    const apiKey = process.env[`${prefix}API_KEY`];
    const apiSecret = process.env[`${prefix}API_SECRET`];
    const passphrase = process.env[`${prefix}API_PASSPHRASE`];

    if (apiKey && apiSecret) {
      this.setCredentials({
        apiKey,
        apiSecret,
        apiPassphrase: passphrase,
      });
    }
  }

  /**
   * Store credentials securely
   */
  public setCredentials(credentials: ClobCredentials): void {
    validateCredentialFormat(credentials);

    const key = this.config.encryptInMemory ? this.config.encryptionKey : "";

    this.encryptedApiKey = xorEncrypt(credentials.apiKey, key);
    this.encryptedApiSecret = xorEncrypt(credentials.apiSecret, key);
    this.encryptedPassphrase = xorEncrypt(credentials.apiPassphrase ?? "", key);
    this.credentialsSetAt = new Date();
  }

  /**
   * Retrieve credentials
   */
  public getCredentials(): ClobCredentials | null {
    if (!this.encryptedApiKey || !this.encryptedApiSecret) {
      return null;
    }

    const key = this.config.encryptInMemory ? this.config.encryptionKey : "";

    return {
      apiKey: xorEncrypt(this.encryptedApiKey, key),
      apiSecret: xorEncrypt(this.encryptedApiSecret, key),
      apiPassphrase: this.encryptedPassphrase
        ? xorEncrypt(this.encryptedPassphrase, key)
        : undefined,
    };
  }

  /**
   * Check if credentials are stored
   */
  public hasCredentials(): boolean {
    return this.encryptedApiKey.length > 0 && this.encryptedApiSecret.length > 0;
  }

  /**
   * Get when credentials were set
   */
  public getCredentialsAge(): number | null {
    if (!this.credentialsSetAt) return null;
    return Date.now() - this.credentialsSetAt.getTime();
  }

  /**
   * Clear stored credentials
   */
  public clearCredentials(): void {
    this.encryptedApiKey = "";
    this.encryptedApiSecret = "";
    this.encryptedPassphrase = "";
    this.credentialsSetAt = undefined;
  }

  /**
   * Get masked credentials for display
   */
  public getMaskedCredentials(): { apiKey: string; hasSecret: boolean; hasPassphrase: boolean } {
    const creds = this.getCredentials();
    return {
      apiKey: creds?.apiKey ? `${creds.apiKey.slice(0, 4)}...${creds.apiKey.slice(-4)}` : "",
      hasSecret: !!creds?.apiSecret,
      hasPassphrase: !!creds?.apiPassphrase,
    };
  }
}

/**
 * Authentication manager with state tracking and key rotation support
 */
export class AuthManager {
  private readonly store: CredentialStore;
  private readonly rotationConfig: Required<KeyRotationConfig>;
  private authFailures: number = 0;
  private lastSuccessfulAuth?: Date;
  private lastFailedAuth?: Date;
  private lastError?: ClassifiedAuthError;

  constructor(storeConfig: CredentialStorageConfig = {}, rotationConfig: KeyRotationConfig = {}) {
    this.store = new CredentialStore(storeConfig);
    this.rotationConfig = { ...DEFAULT_ROTATION_CONFIG, ...rotationConfig };
  }

  /**
   * Set API credentials
   */
  public setCredentials(credentials: ClobCredentials): void {
    this.store.setCredentials(credentials);
    this.authFailures = 0;
    this.lastError = undefined;
  }

  /**
   * Get stored credentials
   */
  public getCredentials(): ClobCredentials | null {
    return this.store.getCredentials();
  }

  /**
   * Check if credentials are available
   */
  public hasCredentials(): boolean {
    return this.store.hasCredentials();
  }

  /**
   * Generate auth headers using stored credentials
   */
  public async generateHeaders(
    method: string,
    path: string,
    body?: string
  ): Promise<SignedHeaders> {
    const credentials = this.store.getCredentials();
    if (!credentials) {
      throw new ClobApiException({
        message: "No credentials stored",
        statusCode: 401,
        code: "NO_CREDENTIALS",
      });
    }
    return generateAuthHeaders(credentials, method, path, body);
  }

  /**
   * Record a successful authentication
   */
  public recordSuccess(): void {
    this.authFailures = 0;
    this.lastSuccessfulAuth = new Date();
    this.lastError = undefined;
  }

  /**
   * Record an authentication failure
   */
  public recordFailure(error: unknown): void {
    this.authFailures++;
    this.lastFailedAuth = new Date();
    this.lastError = classifyAuthError(error);
  }

  /**
   * Check if key rotation is needed
   */
  public isRotationNeeded(): { needed: boolean; reason?: string } {
    // Check for too many consecutive failures
    if (this.authFailures >= this.rotationConfig.maxAuthFailures) {
      return {
        needed: true,
        reason: `${this.authFailures} consecutive auth failures`,
      };
    }

    // Check credential age
    const age = this.store.getCredentialsAge();
    if (age !== null && age > this.rotationConfig.maxCredentialAge) {
      return {
        needed: true,
        reason: "Credentials have exceeded maximum age",
      };
    }

    // Check for revoked/expired key errors
    if (
      this.lastError?.type === AuthErrorType.KEY_REVOKED ||
      this.lastError?.type === AuthErrorType.KEY_EXPIRED
    ) {
      return {
        needed: true,
        reason: this.lastError.message,
      };
    }

    return { needed: false };
  }

  /**
   * Attempt to rotate credentials using the configured callback
   */
  public async rotateCredentials(): Promise<boolean> {
    const rotationCheck = this.isRotationNeeded();
    if (!rotationCheck.needed) {
      return false;
    }

    const newCredentials = await this.rotationConfig.onRotationNeeded(
      rotationCheck.reason ?? "Rotation requested"
    );

    if (newCredentials) {
      this.setCredentials(newCredentials);
      return true;
    }

    return false;
  }

  /**
   * Get current authentication state
   */
  public getState(): AuthState {
    return {
      hasCredentials: this.store.hasCredentials(),
      credentialsSetAt: this.store.getCredentialsAge()
        ? new Date(Date.now() - (this.store.getCredentialsAge() ?? 0))
        : undefined,
      authFailures: this.authFailures,
      lastSuccessfulAuth: this.lastSuccessfulAuth,
      lastFailedAuth: this.lastFailedAuth,
      lastError: this.lastError,
    };
  }

  /**
   * Get masked credentials for display
   */
  public getMaskedCredentials(): { apiKey: string; hasSecret: boolean; hasPassphrase: boolean } {
    return this.store.getMaskedCredentials();
  }

  /**
   * Clear all credentials and reset state
   */
  public reset(): void {
    this.store.clearCredentials();
    this.authFailures = 0;
    this.lastSuccessfulAuth = undefined;
    this.lastFailedAuth = undefined;
    this.lastError = undefined;
  }
}

/**
 * Singleton auth manager instance
 */
let sharedAuthManager: AuthManager | null = null;

/**
 * Get the shared auth manager instance
 */
export function getSharedAuthManager(): AuthManager {
  if (!sharedAuthManager) {
    sharedAuthManager = new AuthManager();
  }
  return sharedAuthManager;
}

/**
 * Set the shared auth manager instance
 */
export function setSharedAuthManager(manager: AuthManager): void {
  sharedAuthManager = manager;
}

/**
 * Reset the shared auth manager
 */
export function resetSharedAuthManager(): void {
  sharedAuthManager?.reset();
  sharedAuthManager = null;
}

/**
 * Create a new auth manager with configuration
 */
export function createAuthManager(
  storeConfig?: CredentialStorageConfig,
  rotationConfig?: KeyRotationConfig
): AuthManager {
  return new AuthManager(storeConfig, rotationConfig);
}

/**
 * Wrapper to execute a function with authentication and error handling
 *
 * @param fn - Function to execute
 * @param manager - Auth manager to use (defaults to shared)
 * @returns Result of the function
 */
export async function withAuth<T>(
  fn: (headers: SignedHeaders) => Promise<T>,
  method: string,
  path: string,
  body?: string,
  manager?: AuthManager
): Promise<T> {
  const authManager = manager ?? getSharedAuthManager();

  try {
    const headers = await authManager.generateHeaders(method, path, body);
    const result = await fn(headers);
    authManager.recordSuccess();
    return result;
  } catch (error) {
    authManager.recordFailure(error);

    // Check if rotation is needed
    const rotationCheck = authManager.isRotationNeeded();
    if (rotationCheck.needed) {
      const rotated = await authManager.rotateCredentials();
      if (rotated) {
        // Retry with new credentials
        const headers = await authManager.generateHeaders(method, path, body);
        const result = await fn(headers);
        authManager.recordSuccess();
        return result;
      }
    }

    throw error;
  }
}
