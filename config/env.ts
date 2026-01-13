import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable configuration with type safety and validation
 */

/**
 * Validates that a URL string is properly formatted
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a URL is a valid WebSocket URL (ws:// or wss://)
 */
function isValidWsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}

/**
 * Get a required environment variable
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get an optional environment variable
 */
function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get a required URL environment variable with validation
 */
function getEnvVarUrl(key: string, defaultValue?: string): string {
  const value = getEnvVar(key, defaultValue);
  if (!isValidUrl(value)) {
    throw new Error(`Environment variable ${key} must be a valid URL, got: ${value}`);
  }
  return value;
}

/**
 * Get an optional URL environment variable with validation
 */
function getEnvVarUrlOptional(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return undefined;
  }
  if (!isValidUrl(value)) {
    throw new Error(`Environment variable ${key} must be a valid URL, got: ${value}`);
  }
  return value;
}

/**
 * Get a WebSocket URL environment variable with validation
 */
function getEnvVarWsUrl(key: string, defaultValue?: string): string {
  const value = getEnvVar(key, defaultValue);
  if (!isValidWsUrl(value)) {
    throw new Error(`Environment variable ${key} must be a valid WebSocket URL (ws:// or wss://), got: ${value}`);
  }
  return value;
}

/**
 * Get an optional WebSocket URL environment variable with validation
 */
export function getEnvVarWsUrlOptional(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return undefined;
  }
  if (!isValidWsUrl(value)) {
    throw new Error(`Environment variable ${key} must be a valid WebSocket URL (ws:// or wss://), got: ${value}`);
  }
  return value;
}

/**
 * Get an environment variable as a number
 */
function getEnvVarAsNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

/**
 * Get an environment variable as a boolean
 */
function getEnvVarAsBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Parse a comma-separated list of values
 */
function getEnvVarAsList(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
}

/**
 * Parse a comma-separated list of numbers
 */
function getEnvVarAsNumberList(key: string, defaultValue?: number[]): number[] {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return [];
  }
  const items = value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  return items.map((item, index) => {
    const parsed = parseInt(item, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key}[${index}] must be a number, got: ${item}`);
    }
    return parsed;
  });
}

/**
 * Validate Telegram bot token format
 * Token format: <bot_id>:<secret>
 * Example: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 */
function validateTelegramBotToken(token: string | undefined): string | undefined {
  if (token === undefined || token === "") {
    return undefined;
  }
  // Telegram bot tokens are in format: <bot_id>:<secret>
  // bot_id is numeric, secret is alphanumeric with underscores and hyphens
  const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
  if (!tokenRegex.test(token)) {
    throw new Error(
      `Invalid TELEGRAM_BOT_TOKEN format. Expected format: <bot_id>:<secret> (e.g., 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)`
    );
  }
  return token;
}

/**
 * Redact sensitive values for logging
 */
function redactSecret(value: string | undefined): string {
  if (value === undefined || value === "") {
    return "(not set)";
  }
  if (value.length <= 8) {
    return "****";
  }
  return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
}

/**
 * All environment configuration with validation
 */
export const env = {
  // Application
  NODE_ENV: getEnvVar("NODE_ENV", "development"),
  PORT: getEnvVarAsNumber("PORT", 3000),
  isDevelopment: getEnvVar("NODE_ENV", "development") === "development",
  isProduction: getEnvVar("NODE_ENV", "development") === "production",
  isTest: getEnvVar("NODE_ENV", "development") === "test",

  // Database
  DATABASE_URL: getEnvVar(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/polymarket_tracker"
  ),

  // Database Connection Pool Settings
  DB_POOL_SIZE: getEnvVarAsNumber("DB_POOL_SIZE", 10),
  DB_POOL_TIMEOUT: getEnvVarAsNumber("DB_POOL_TIMEOUT", 10000),
  DB_CONNECT_TIMEOUT: getEnvVarAsNumber("DB_CONNECT_TIMEOUT", 10000),

  // Polymarket Gamma API (REST API for markets data)
  GAMMA_API_URL: getEnvVarUrl("GAMMA_API_URL", "https://gamma-api.polymarket.com"),

  // Polymarket CLOB API (Central Limit Order Book API)
  CLOB_API_URL: getEnvVarUrl("CLOB_API_URL", "https://clob.polymarket.com"),

  // Polymarket CLOB WebSocket (real-time trade and order book streams)
  CLOB_WS_URL: getEnvVarWsUrl("CLOB_WS_URL", "wss://ws-subscriptions-clob.polymarket.com/ws/market"),

  // Legacy aliases for backwards compatibility
  POLYMARKET_API_URL: getEnvVarUrl("POLYMARKET_API_URL", "https://gamma-api.polymarket.com"),
  POLYMARKET_CLOB_API_URL: getEnvVarUrl("POLYMARKET_CLOB_API_URL", "https://clob.polymarket.com"),
  POLYMARKET_API_KEY: getEnvVarOptional("POLYMARKET_API_KEY"),

  // Polygon Network RPC
  POLYGON_RPC_URL: getEnvVarUrlOptional("POLYGON_RPC_URL"),
  POLYGONSCAN_API_KEY: getEnvVarOptional("POLYGONSCAN_API_KEY"),

  // Telegram Notifications
  TELEGRAM_BOT_TOKEN: validateTelegramBotToken(getEnvVarOptional("TELEGRAM_BOT_TOKEN")),
  TELEGRAM_CHAT_ID: getEnvVarOptional("TELEGRAM_CHAT_ID"),
  TELEGRAM_ADMIN_IDS: getEnvVarAsNumberList("TELEGRAM_ADMIN_IDS", []),

  // Discord Notifications
  DISCORD_WEBHOOK_URL: getEnvVarUrlOptional("DISCORD_WEBHOOK_URL"),

  // Email Notifications (Resend)
  RESEND_API_KEY: getEnvVarOptional("RESEND_API_KEY"),
  EMAIL_FROM: getEnvVarOptional("EMAIL_FROM"),
  EMAIL_FROM_NAME: getEnvVar("EMAIL_FROM_NAME", "Polymarket Tracker"),

  // Web Push Notifications (VAPID)
  VAPID_PUBLIC_KEY: getEnvVarOptional("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: getEnvVarOptional("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: getEnvVarOptional("VAPID_SUBJECT"),

  // AI/ML (optional)
  OPENAI_API_KEY: getEnvVarOptional("OPENAI_API_KEY"),

  // Whale Detection
  WHALE_THRESHOLD_USD: getEnvVarAsNumber("WHALE_THRESHOLD_USD", 10000),
  INSIDER_DETECTION_ENABLED: getEnvVarAsBoolean("INSIDER_DETECTION_ENABLED", true),
} as const;

export type Env = typeof env;

/**
 * Log the current configuration (with sensitive values redacted)
 */
export function logConfig(): void {
  const config = {
    // Application
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,

    // Database
    DATABASE_URL: redactSecret(env.DATABASE_URL),
    DB_POOL_SIZE: env.DB_POOL_SIZE,
    DB_POOL_TIMEOUT: env.DB_POOL_TIMEOUT,
    DB_CONNECT_TIMEOUT: env.DB_CONNECT_TIMEOUT,

    // Polymarket APIs
    GAMMA_API_URL: env.GAMMA_API_URL,
    CLOB_API_URL: env.CLOB_API_URL,
    CLOB_WS_URL: env.CLOB_WS_URL,
    POLYMARKET_API_KEY: redactSecret(env.POLYMARKET_API_KEY),

    // Polygon Network
    POLYGON_RPC_URL: env.POLYGON_RPC_URL ?? "(not set - using public RPC)",
    POLYGONSCAN_API_KEY: redactSecret(env.POLYGONSCAN_API_KEY),

    // Notifications
    TELEGRAM_BOT_TOKEN: redactSecret(env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID ?? "(not set)",
    TELEGRAM_ADMIN_IDS: env.TELEGRAM_ADMIN_IDS.length > 0
      ? `[${env.TELEGRAM_ADMIN_IDS.length} admin(s)]`
      : "(not set)",
    DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL ? "(set)" : "(not set)",
    RESEND_API_KEY: redactSecret(env.RESEND_API_KEY),

    // Web Push
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY ? "(set)" : "(not set)",
    VAPID_PRIVATE_KEY: redactSecret(env.VAPID_PRIVATE_KEY),

    // AI/ML
    OPENAI_API_KEY: redactSecret(env.OPENAI_API_KEY),

    // Detection Settings
    WHALE_THRESHOLD_USD: env.WHALE_THRESHOLD_USD,
    INSIDER_DETECTION_ENABLED: env.INSIDER_DETECTION_ENABLED,
  };

  console.log("=".repeat(60));
  console.log("Environment Configuration (secrets redacted):");
  console.log("=".repeat(60));
  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log("=".repeat(60));
}

/**
 * Validate that the environment is properly configured
 * Returns an object with validation results
 */
export function validateEnv(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required database configuration
  if (!env.DATABASE_URL || env.DATABASE_URL === "postgresql://user:password@localhost:5432/polymarket_tracker") {
    warnings.push("DATABASE_URL is using default value - configure for production");
  }

  // Check Polymarket API URLs are accessible (format only, not connectivity)
  try {
    new URL(env.GAMMA_API_URL);
  } catch {
    errors.push(`GAMMA_API_URL is not a valid URL: ${env.GAMMA_API_URL}`);
  }

  try {
    new URL(env.CLOB_API_URL);
  } catch {
    errors.push(`CLOB_API_URL is not a valid URL: ${env.CLOB_API_URL}`);
  }

  try {
    const wsUrl = new URL(env.CLOB_WS_URL);
    if (wsUrl.protocol !== "ws:" && wsUrl.protocol !== "wss:") {
      errors.push(`CLOB_WS_URL must use ws:// or wss:// protocol: ${env.CLOB_WS_URL}`);
    }
  } catch {
    errors.push(`CLOB_WS_URL is not a valid WebSocket URL: ${env.CLOB_WS_URL}`);
  }

  // Warn about optional but recommended configuration
  if (!env.POLYGON_RPC_URL) {
    warnings.push("POLYGON_RPC_URL not set - using public RPC (may be rate limited)");
  }

  if (!env.TELEGRAM_BOT_TOKEN && !env.DISCORD_WEBHOOK_URL) {
    warnings.push("No notification channels configured (TELEGRAM_BOT_TOKEN or DISCORD_WEBHOOK_URL)");
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_IDS.length === 0) {
    warnings.push("TELEGRAM_BOT_TOKEN set but TELEGRAM_ADMIN_IDS not configured");
  }

  if (!env.POLYGONSCAN_API_KEY) {
    warnings.push("POLYGONSCAN_API_KEY not set - transaction history lookups may be limited");
  }

  if (!env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY not set - AI-powered features will be disabled");
  }

  // Production-specific checks
  if (env.isProduction) {
    if (env.DATABASE_URL.includes("localhost")) {
      errors.push("Production environment cannot use localhost DATABASE_URL");
    }
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      warnings.push("Web push notifications not configured for production");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Initialize and validate environment configuration
 * Logs config and throws if critical errors are found
 */
export function initializeEnv(): void {
  // Log configuration on startup (non-test environment)
  if (!env.isTest) {
    logConfig();
  }

  // Validate configuration
  const validation = validateEnv();

  // Log warnings
  if (validation.warnings.length > 0 && !env.isTest) {
    console.log("\nConfiguration Warnings:");
    for (const warning of validation.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
  }

  // Log errors and throw if any critical errors
  if (validation.errors.length > 0) {
    console.error("\nConfiguration Errors:");
    for (const error of validation.errors) {
      console.error(`  ❌  ${error}`);
    }
    throw new Error(`Environment validation failed with ${validation.errors.length} error(s)`);
  }

  if (!env.isTest) {
    console.log("\n✅ Environment configuration validated successfully\n");
  }
}

// Export utility functions for testing
export const envUtils = {
  isValidUrl,
  isValidWsUrl,
  validateTelegramBotToken,
  redactSecret,
  getEnvVarAsList,
  getEnvVarAsNumberList,
};
