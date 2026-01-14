/**
 * Structured Logging Utility (MONITOR-001)
 *
 * Provides a consistent logging interface throughout the application.
 * Uses pino-style API for easy migration to pino when needed.
 *
 * Features:
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Structured logging with context/metadata
 * - Child loggers for service-specific logging
 * - Environment-based log level configuration
 * - Pretty printing in development
 * - JSON output in production
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('Server started', { port: 3000 });
 *   logger.error('Failed to connect', { error: err.message });
 *
 *   // Create child logger for a service
 *   const log = logger.child({ service: 'MarketSync' });
 *   log.info('Sync started');
 */

// ============================================================================
// Types
// ============================================================================

/** Log levels in order of severity */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** Numeric log level values (pino-compatible) */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/** Log context/metadata */
export interface LogContext {
  /** Service or component name */
  service?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** User ID if available */
  userId?: string;
  /** Additional context */
  [key: string]: unknown;
}

/** Log entry structure */
export interface LogEntry {
  /** ISO timestamp */
  time: string;
  /** Log level */
  level: LogLevel;
  /** Numeric level (pino-compatible) */
  levelNum: number;
  /** Log message */
  msg: string;
  /** Additional context */
  [key: string]: unknown;
}

/** Logger configuration */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Service/component name for this logger */
  name?: string;
  /** Pretty print in development */
  prettyPrint: boolean;
  /** Include timestamp */
  timestamp: boolean;
  /** Base context for all log entries */
  base?: LogContext;
}

/** Logger interface (pino-compatible) */
export interface Logger {
  level: LogLevel;
  trace(msg: string, context?: LogContext): void;
  trace(context: LogContext, msg: string): void;
  debug(msg: string, context?: LogContext): void;
  debug(context: LogContext, msg: string): void;
  info(msg: string, context?: LogContext): void;
  info(context: LogContext, msg: string): void;
  warn(msg: string, context?: LogContext): void;
  warn(context: LogContext, msg: string): void;
  error(msg: string, context?: LogContext): void;
  error(context: LogContext, msg: string): void;
  fatal(msg: string, context?: LogContext): void;
  fatal(context: LogContext, msg: string): void;
  child(bindings: LogContext): Logger;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get log level from environment variable
 */
function getLogLevelFromEnv(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (level && level in LOG_LEVELS) {
    return level;
  }
  // Default: debug in development, info in production
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Check if we should pretty print
 */
function shouldPrettyPrint(): boolean {
  // Pretty print in development unless explicitly disabled
  if (process.env.LOG_PRETTY === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

// ============================================================================
// Color utilities for pretty printing
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: COLORS.gray,
  debug: COLORS.cyan,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: COLORS.red + COLORS.bold,
};

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Create a structured logger instance
 */
function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  const fullConfig: LoggerConfig = {
    level: config.level ?? getLogLevelFromEnv(),
    name: config.name,
    prettyPrint: config.prettyPrint ?? shouldPrettyPrint(),
    timestamp: config.timestamp ?? true,
    base: config.base ?? {},
  };

  const currentLevelNum = LOG_LEVELS[fullConfig.level];

  /**
   * Check if a log level should be output
   */
  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= currentLevelNum;
  }

  /**
   * Format a log entry as JSON
   */
  function formatJson(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Format a log entry for pretty printing
   */
  function formatPretty(entry: LogEntry): string {
    const timeParts = entry.time.split("T");
    const time = COLORS.dim + (timeParts[1]?.replace("Z", "") ?? entry.time) + COLORS.reset;
    const levelColor = LEVEL_COLORS[entry.level];
    const level = levelColor + entry.level.toUpperCase().padEnd(5) + COLORS.reset;
    const name = entry.service
      ? COLORS.cyan + `[${entry.service}]` + COLORS.reset + " "
      : "";
    const msg = entry.msg;

    // Extract context (everything except time, level, msg, service, levelNum)
    const context: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (!["time", "level", "levelNum", "msg", "service"].includes(key)) {
        context[key] = value;
      }
    }

    const contextStr =
      Object.keys(context).length > 0
        ? " " + COLORS.dim + JSON.stringify(context) + COLORS.reset
        : "";

    return `${time} ${level} ${name}${msg}${contextStr}`;
  }

  /**
   * Output a log entry
   */
  function output(level: LogLevel, msg: string, context: LogContext = {}): void {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      time: new Date().toISOString(),
      level,
      levelNum: LOG_LEVELS[level],
      msg,
      ...fullConfig.base,
      ...context,
    };

    if (fullConfig.name) {
      entry.service = fullConfig.name;
    }

    const formatted = fullConfig.prettyPrint ? formatPretty(entry) : formatJson(entry);

    // Use appropriate console method
    switch (level) {
      case "trace":
      case "debug":
        // eslint-disable-next-line no-console
        console.debug(formatted);
        break;
      case "info":
        // eslint-disable-next-line no-console
        console.info(formatted);
        break;
      case "warn":
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      case "error":
      case "fatal":
        // eslint-disable-next-line no-console
        console.error(formatted);
        break;
    }
  }

  /**
   * Parse arguments to support both (msg, context) and (context, msg) patterns
   */
  function parseArgs(
    arg1: string | LogContext,
    arg2?: string | LogContext
  ): { msg: string; context: LogContext } {
    if (typeof arg1 === "string") {
      return {
        msg: arg1,
        context: (arg2 as LogContext) ?? {},
      };
    } else {
      return {
        msg: (arg2 as string) ?? "",
        context: arg1,
      };
    }
  }

  /**
   * Create a child logger with additional context
   */
  function child(bindings: LogContext): Logger {
    return createLogger({
      ...fullConfig,
      name: bindings.service ?? fullConfig.name,
      base: { ...fullConfig.base, ...bindings },
    });
  }

  return {
    level: fullConfig.level,

    trace(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("trace", msg, context);
    },

    debug(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("debug", msg, context);
    },

    info(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("info", msg, context);
    },

    warn(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("warn", msg, context);
    },

    error(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("error", msg, context);
    },

    fatal(arg1: string | LogContext, arg2?: string | LogContext): void {
      const { msg, context } = parseArgs(arg1, arg2);
      output("fatal", msg, context);
    },

    child,
  };
}

// ============================================================================
// Singleton logger instance
// ============================================================================

/**
 * Default logger instance for the application
 */
export const logger = createLogger({
  name: "polymarket-tracker",
});

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create a logger for a specific service
 */
export function createServiceLogger(serviceName: string): Logger {
  return logger.child({ service: serviceName });
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}

// ============================================================================
// Pre-configured service loggers (lazy initialization)
// ============================================================================

let _marketSyncLogger: Logger | null = null;
let _tradeStreamLogger: Logger | null = null;
let _walletProfilerLogger: Logger | null = null;
let _alertGeneratorLogger: Logger | null = null;
let _telegramLogger: Logger | null = null;
let _databaseLogger: Logger | null = null;
let _apiLogger: Logger | null = null;
let _wsLogger: Logger | null = null;

export const serviceLoggers = {
  get marketSync(): Logger {
    if (!_marketSyncLogger) {
      _marketSyncLogger = createServiceLogger("MarketSync");
    }
    return _marketSyncLogger;
  },

  get tradeStream(): Logger {
    if (!_tradeStreamLogger) {
      _tradeStreamLogger = createServiceLogger("TradeStream");
    }
    return _tradeStreamLogger;
  },

  get walletProfiler(): Logger {
    if (!_walletProfilerLogger) {
      _walletProfilerLogger = createServiceLogger("WalletProfiler");
    }
    return _walletProfilerLogger;
  },

  get alertGenerator(): Logger {
    if (!_alertGeneratorLogger) {
      _alertGeneratorLogger = createServiceLogger("AlertGenerator");
    }
    return _alertGeneratorLogger;
  },

  get telegram(): Logger {
    if (!_telegramLogger) {
      _telegramLogger = createServiceLogger("Telegram");
    }
    return _telegramLogger;
  },

  get database(): Logger {
    if (!_databaseLogger) {
      _databaseLogger = createServiceLogger("Database");
    }
    return _databaseLogger;
  },

  get api(): Logger {
    if (!_apiLogger) {
      _apiLogger = createServiceLogger("API");
    }
    return _apiLogger;
  },

  get ws(): Logger {
    if (!_wsLogger) {
      _wsLogger = createServiceLogger("WebSocket");
    }
    return _wsLogger;
  },
};

// ============================================================================
// Export utilities
// ============================================================================

export {
  createLogger,
  getLogLevelFromEnv,
  shouldPrettyPrint,
};

export default logger;
