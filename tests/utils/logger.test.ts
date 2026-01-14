/**
 * Logger Utility Tests (MONITOR-001)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  createLogger,
  createServiceLogger,
  createRequestLogger,
  serviceLoggers,
  LOG_LEVELS,
  type LogLevel,
} from "../../src/utils/logger";

describe("Logger Utility", () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("LOG_LEVELS", () => {
    it("should have correct numeric values", () => {
      expect(LOG_LEVELS.trace).toBe(10);
      expect(LOG_LEVELS.debug).toBe(20);
      expect(LOG_LEVELS.info).toBe(30);
      expect(LOG_LEVELS.warn).toBe(40);
      expect(LOG_LEVELS.error).toBe(50);
      expect(LOG_LEVELS.fatal).toBe(60);
    });

    it("should have increasing values for severity", () => {
      const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
      for (let i = 1; i < levels.length; i++) {
        const currentLevel = levels[i] as LogLevel;
        const prevLevel = levels[i - 1] as LogLevel;
        expect(LOG_LEVELS[currentLevel]).toBeGreaterThan(LOG_LEVELS[prevLevel]);
      }
    });
  });

  describe("createLogger", () => {
    it("should create a logger with default configuration", () => {
      const log = createLogger();
      expect(log).toBeDefined();
      expect(log.level).toBeDefined();
      expect(typeof log.info).toBe("function");
      expect(typeof log.error).toBe("function");
      expect(typeof log.child).toBe("function");
    });

    it("should create a logger with custom level", () => {
      const log = createLogger({ level: "warn" });
      expect(log.level).toBe("warn");
    });

    it("should create a logger with name", () => {
      const log = createLogger({ name: "TestService" });
      log.info("Test message");

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("TestService");
    });
  });

  describe("Logging methods", () => {
    it("should log with trace level", () => {
      const log = createLogger({ level: "trace", prettyPrint: false });
      log.trace("Trace message");

      expect(consoleSpy.debug).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.debug.mock.calls[0][0]);
      expect(logOutput.level).toBe("trace");
      expect(logOutput.msg).toBe("Trace message");
    });

    it("should log with debug level", () => {
      const log = createLogger({ level: "debug", prettyPrint: false });
      log.debug("Debug message");

      expect(consoleSpy.debug).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.debug.mock.calls[0][0]);
      expect(logOutput.level).toBe("debug");
      expect(logOutput.msg).toBe("Debug message");
    });

    it("should log with info level", () => {
      const log = createLogger({ level: "info", prettyPrint: false });
      log.info("Info message");

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.level).toBe("info");
      expect(logOutput.msg).toBe("Info message");
    });

    it("should log with warn level", () => {
      const log = createLogger({ level: "warn", prettyPrint: false });
      log.warn("Warn message");

      expect(consoleSpy.warn).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(logOutput.level).toBe("warn");
      expect(logOutput.msg).toBe("Warn message");
    });

    it("should log with error level", () => {
      const log = createLogger({ level: "error", prettyPrint: false });
      log.error("Error message");

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logOutput.level).toBe("error");
      expect(logOutput.msg).toBe("Error message");
    });

    it("should log with fatal level", () => {
      const log = createLogger({ level: "fatal", prettyPrint: false });
      log.fatal("Fatal message");

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(logOutput.level).toBe("fatal");
      expect(logOutput.msg).toBe("Fatal message");
    });
  });

  describe("Log level filtering", () => {
    it("should not log below configured level", () => {
      const log = createLogger({ level: "warn", prettyPrint: false });

      log.trace("Trace");
      log.debug("Debug");
      log.info("Info");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    it("should log at and above configured level", () => {
      const log = createLogger({ level: "warn", prettyPrint: false });

      log.warn("Warn");
      log.error("Error");
      log.fatal("Fatal");

      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(2);
    });
  });

  describe("Context/metadata", () => {
    it("should include context in log output (msg, context)", () => {
      const log = createLogger({ prettyPrint: false });
      log.info("Test message", { userId: "123", action: "login" });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.msg).toBe("Test message");
      expect(logOutput.userId).toBe("123");
      expect(logOutput.action).toBe("login");
    });

    it("should include context in log output (context, msg)", () => {
      const log = createLogger({ prettyPrint: false });
      log.info({ userId: "123", action: "login" }, "Test message");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.msg).toBe("Test message");
      expect(logOutput.userId).toBe("123");
      expect(logOutput.action).toBe("login");
    });

    it("should handle empty context", () => {
      const log = createLogger({ prettyPrint: false });
      log.info("Test message");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.msg).toBe("Test message");
    });
  });

  describe("Timestamps", () => {
    it("should include ISO timestamp", () => {
      const log = createLogger({ prettyPrint: false });
      log.info("Test");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.time).toBeDefined();
      expect(new Date(logOutput.time).toString()).not.toBe("Invalid Date");
    });

    it("should include numeric level", () => {
      const log = createLogger({ prettyPrint: false });
      log.info("Test");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.levelNum).toBe(LOG_LEVELS.info);
    });
  });

  describe("Child loggers", () => {
    it("should create child logger with additional context", () => {
      const log = createLogger({ prettyPrint: false });
      const childLog = log.child({ service: "TestService", version: "1.0" });

      childLog.info("Test message");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.service).toBe("TestService");
      expect(logOutput.version).toBe("1.0");
    });

    it("should inherit parent context", () => {
      const log = createLogger({ prettyPrint: false, base: { app: "test-app" } });
      const childLog = log.child({ service: "TestService" });

      childLog.info("Test message");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.app).toBe("test-app");
      expect(logOutput.service).toBe("TestService");
    });

    it("should allow nested child loggers", () => {
      const log = createLogger({ prettyPrint: false });
      const childLog = log.child({ service: "Parent" });
      const grandchildLog = childLog.child({ component: "Child" });

      grandchildLog.info("Test message");

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput.service).toBe("Parent");
      expect(logOutput.component).toBe("Child");
    });
  });

  describe("createServiceLogger", () => {
    it("should create logger with service name", () => {
      const log = createServiceLogger("MarketSync");
      log.info("Sync started");

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(logOutput).toContain("MarketSync");
    });
  });

  describe("createRequestLogger", () => {
    it("should create logger with request ID", () => {
      const log = createRequestLogger("req-123");

      // The request logger is a child of the main logger
      expect(log).toBeDefined();
      expect(typeof log.info).toBe("function");
    });
  });

  describe("serviceLoggers", () => {
    it("should provide pre-configured service loggers", () => {
      expect(serviceLoggers.marketSync).toBeDefined();
      expect(serviceLoggers.tradeStream).toBeDefined();
      expect(serviceLoggers.walletProfiler).toBeDefined();
      expect(serviceLoggers.alertGenerator).toBeDefined();
      expect(serviceLoggers.telegram).toBeDefined();
      expect(serviceLoggers.database).toBeDefined();
      expect(serviceLoggers.api).toBeDefined();
      expect(serviceLoggers.ws).toBeDefined();
    });

    it("should return the same instance on multiple accesses (lazy singleton)", () => {
      const log1 = serviceLoggers.marketSync;
      const log2 = serviceLoggers.marketSync;
      expect(log1).toBe(log2);
    });
  });

  describe("Default logger", () => {
    it("should be a valid logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.child).toBe("function");
    });

    it("should log messages", () => {
      logger.info("Default logger test");
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe("JSON output format", () => {
    it("should output valid JSON when prettyPrint is false", () => {
      const log = createLogger({ prettyPrint: false });
      log.info("Test message", { key: "value" });

      const logOutput = consoleSpy.info.mock.calls[0][0];
      expect(() => JSON.parse(logOutput)).not.toThrow();
    });

    it("should include all required fields in JSON output", () => {
      const log = createLogger({ prettyPrint: false, name: "TestService" });
      log.info("Test message", { key: "value" });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(logOutput).toHaveProperty("time");
      expect(logOutput).toHaveProperty("level");
      expect(logOutput).toHaveProperty("levelNum");
      expect(logOutput).toHaveProperty("msg");
      expect(logOutput).toHaveProperty("service");
      expect(logOutput).toHaveProperty("key");
    });
  });

  describe("Pretty print format", () => {
    it("should not throw when pretty printing", () => {
      const log = createLogger({ prettyPrint: true });
      expect(() => log.info("Test message")).not.toThrow();
      expect(() => log.info("Test message", { key: "value" })).not.toThrow();
    });
  });
});
