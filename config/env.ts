import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable configuration with type safety and validation
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}

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

  // Polymarket API
  POLYMARKET_API_URL: getEnvVar("POLYMARKET_API_URL", "https://gamma-api.polymarket.com"),
  POLYMARKET_CLOB_API_URL: getEnvVar("POLYMARKET_CLOB_API_URL", "https://clob.polymarket.com"),
  POLYMARKET_API_KEY: getEnvVarOptional("POLYMARKET_API_KEY"),

  // Notifications (optional)
  DISCORD_WEBHOOK_URL: getEnvVarOptional("DISCORD_WEBHOOK_URL"),
  TELEGRAM_BOT_TOKEN: getEnvVarOptional("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_CHAT_ID: getEnvVarOptional("TELEGRAM_CHAT_ID"),

  // AI/ML (optional)
  OPENAI_API_KEY: getEnvVarOptional("OPENAI_API_KEY"),

  // Whale Detection
  WHALE_THRESHOLD_USD: getEnvVarAsNumber("WHALE_THRESHOLD_USD", 10000),
  INSIDER_DETECTION_ENABLED: getEnvVarAsBoolean("INSIDER_DETECTION_ENABLED", true),
} as const;

export type Env = typeof env;
