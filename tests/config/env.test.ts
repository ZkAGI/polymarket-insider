import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { envUtils } from "../../config/env";

describe("Environment Configuration", () => {
  describe("isValidUrl", () => {
    it("should return true for valid HTTP URLs", () => {
      expect(envUtils.isValidUrl("http://example.com")).toBe(true);
      expect(envUtils.isValidUrl("https://example.com")).toBe(true);
      expect(envUtils.isValidUrl("https://api.example.com/v1")).toBe(true);
      expect(envUtils.isValidUrl("https://example.com:3000")).toBe(true);
      expect(envUtils.isValidUrl("https://example.com/path?query=value")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(envUtils.isValidUrl("not-a-url")).toBe(false);
      expect(envUtils.isValidUrl("")).toBe(false);
      expect(envUtils.isValidUrl("//example.com")).toBe(false);
      expect(envUtils.isValidUrl("example.com")).toBe(false);
    });
  });

  describe("isValidWsUrl", () => {
    it("should return true for valid WebSocket URLs", () => {
      expect(envUtils.isValidWsUrl("ws://example.com")).toBe(true);
      expect(envUtils.isValidWsUrl("wss://example.com")).toBe(true);
      expect(envUtils.isValidWsUrl("wss://example.com/socket")).toBe(true);
      expect(envUtils.isValidWsUrl("wss://example.com:8080/ws")).toBe(true);
    });

    it("should return false for non-WebSocket URLs", () => {
      expect(envUtils.isValidWsUrl("http://example.com")).toBe(false);
      expect(envUtils.isValidWsUrl("https://example.com")).toBe(false);
      expect(envUtils.isValidWsUrl("ftp://example.com")).toBe(false);
    });

    it("should return false for invalid URLs", () => {
      expect(envUtils.isValidWsUrl("not-a-url")).toBe(false);
      expect(envUtils.isValidWsUrl("")).toBe(false);
      // Note: "wss:example.com" is technically a valid URL in JS (protocol-only with path)
      // but we're checking for WebSocket URLs which need a host
      expect(envUtils.isValidWsUrl("just-text")).toBe(false);
    });
  });

  describe("validateTelegramBotToken", () => {
    it("should return undefined for empty or undefined token", () => {
      expect(envUtils.validateTelegramBotToken(undefined)).toBe(undefined);
      expect(envUtils.validateTelegramBotToken("")).toBe(undefined);
    });

    it("should return token for valid format", () => {
      const validToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";
      expect(envUtils.validateTelegramBotToken(validToken)).toBe(validToken);
    });

    it("should accept tokens with underscores and hyphens", () => {
      const tokenWithUnderscore = "123456789:ABC_def_GHI-jkl";
      expect(envUtils.validateTelegramBotToken(tokenWithUnderscore)).toBe(tokenWithUnderscore);
    });

    it("should throw for invalid token formats", () => {
      expect(() => envUtils.validateTelegramBotToken("invalid")).toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
      expect(() => envUtils.validateTelegramBotToken("no-colon")).toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
      expect(() => envUtils.validateTelegramBotToken("abc:secret")).toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
      expect(() => envUtils.validateTelegramBotToken(":secret")).toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
      expect(() => envUtils.validateTelegramBotToken("123:")).toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
    });
  });

  describe("redactSecret", () => {
    it("should return (not set) for undefined or empty values", () => {
      expect(envUtils.redactSecret(undefined)).toBe("(not set)");
      expect(envUtils.redactSecret("")).toBe("(not set)");
    });

    it("should return **** for short values", () => {
      expect(envUtils.redactSecret("abc")).toBe("****");
      expect(envUtils.redactSecret("12345678")).toBe("****");
    });

    it("should show first and last 4 characters for longer values", () => {
      expect(envUtils.redactSecret("1234567890abcdef")).toBe("1234****cdef");
      expect(envUtils.redactSecret("secretpassword")).toBe("secr****word");
    });
  });

  describe("getEnvVarAsList", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      // Restore original env
      Object.keys(process.env).forEach(key => {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      });
      Object.assign(process.env, originalEnv);
    });

    it("should return empty array for undefined env var", () => {
      delete process.env.TEST_LIST;
      expect(envUtils.getEnvVarAsList("TEST_LIST")).toEqual([]);
    });

    it("should return default value when provided and env var is undefined", () => {
      delete process.env.TEST_LIST;
      expect(envUtils.getEnvVarAsList("TEST_LIST", ["default"])).toEqual(["default"]);
    });

    it("should parse comma-separated values", () => {
      process.env.TEST_LIST = "a,b,c";
      expect(envUtils.getEnvVarAsList("TEST_LIST")).toEqual(["a", "b", "c"]);
    });

    it("should trim whitespace from values", () => {
      process.env.TEST_LIST = "a , b , c";
      expect(envUtils.getEnvVarAsList("TEST_LIST")).toEqual(["a", "b", "c"]);
    });

    it("should filter out empty values", () => {
      process.env.TEST_LIST = "a,,b,,,c";
      expect(envUtils.getEnvVarAsList("TEST_LIST")).toEqual(["a", "b", "c"]);
    });
  });

  describe("getEnvVarAsNumberList", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      // Restore original env
      Object.keys(process.env).forEach(key => {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      });
      Object.assign(process.env, originalEnv);
    });

    it("should return empty array for undefined env var", () => {
      delete process.env.TEST_NUMS;
      expect(envUtils.getEnvVarAsNumberList("TEST_NUMS")).toEqual([]);
    });

    it("should return default value when provided and env var is undefined", () => {
      delete process.env.TEST_NUMS;
      expect(envUtils.getEnvVarAsNumberList("TEST_NUMS", [1, 2, 3])).toEqual([1, 2, 3]);
    });

    it("should parse comma-separated numbers", () => {
      process.env.TEST_NUMS = "1,2,3";
      expect(envUtils.getEnvVarAsNumberList("TEST_NUMS")).toEqual([1, 2, 3]);
    });

    it("should trim whitespace from values", () => {
      process.env.TEST_NUMS = "1 , 2 , 3";
      expect(envUtils.getEnvVarAsNumberList("TEST_NUMS")).toEqual([1, 2, 3]);
    });

    it("should throw for non-numeric values", () => {
      process.env.TEST_NUMS = "1,abc,3";
      expect(() => envUtils.getEnvVarAsNumberList("TEST_NUMS")).toThrow(/must be a number/);
    });

    it("should handle negative numbers", () => {
      process.env.TEST_NUMS = "-1,0,1";
      expect(envUtils.getEnvVarAsNumberList("TEST_NUMS")).toEqual([-1, 0, 1]);
    });
  });
});

describe("Environment Configuration - env object", () => {
  it("should have GAMMA_API_URL with valid default", async () => {
    const { env } = await import("../../config/env");
    expect(env.GAMMA_API_URL).toBe("https://gamma-api.polymarket.com");
    expect(envUtils.isValidUrl(env.GAMMA_API_URL)).toBe(true);
  });

  it("should have CLOB_API_URL with valid default", async () => {
    const { env } = await import("../../config/env");
    expect(env.CLOB_API_URL).toBe("https://clob.polymarket.com");
    expect(envUtils.isValidUrl(env.CLOB_API_URL)).toBe(true);
  });

  it("should have CLOB_WS_URL with valid default", async () => {
    const { env } = await import("../../config/env");
    expect(env.CLOB_WS_URL).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    expect(envUtils.isValidWsUrl(env.CLOB_WS_URL)).toBe(true);
  });

  it("should have TELEGRAM_ADMIN_IDS as array", async () => {
    const { env } = await import("../../config/env");
    expect(Array.isArray(env.TELEGRAM_ADMIN_IDS)).toBe(true);
  });

  it("should have boolean isDevelopment, isProduction, isTest", async () => {
    const { env } = await import("../../config/env");
    expect(typeof env.isDevelopment).toBe("boolean");
    expect(typeof env.isProduction).toBe("boolean");
    expect(typeof env.isTest).toBe("boolean");
  });

  it("should have numeric PORT and WHALE_THRESHOLD_USD", async () => {
    const { env } = await import("../../config/env");
    expect(typeof env.PORT).toBe("number");
    expect(typeof env.WHALE_THRESHOLD_USD).toBe("number");
  });
});

describe("validateEnv", () => {
  it("should return valid:true with no errors when configuration is valid", async () => {
    const { validateEnv } = await import("../../config/env");
    const result = validateEnv();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should have warnings array", async () => {
    const { validateEnv } = await import("../../config/env");
    const result = validateEnv();

    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("should validate URL formats in result", async () => {
    const { validateEnv, env } = await import("../../config/env");
    const result = validateEnv();

    // Since we're using default values, URLs should be valid
    expect(result.valid).toBe(true);

    // Verify URLs are properly formatted
    expect(env.GAMMA_API_URL.startsWith("http")).toBe(true);
    expect(env.CLOB_API_URL.startsWith("http")).toBe(true);
    expect(env.CLOB_WS_URL.startsWith("wss://")).toBe(true);
  });
});

describe("logConfig", () => {
  it("should be a function", async () => {
    const { logConfig } = await import("../../config/env");
    expect(typeof logConfig).toBe("function");
  });

  it("should not throw when called", async () => {
    const { logConfig } = await import("../../config/env");
    const originalLog = console.log;
    console.log = vi.fn();

    expect(() => logConfig()).not.toThrow();

    console.log = originalLog;
  });

  it("should call console.log multiple times", async () => {
    const { logConfig } = await import("../../config/env");
    const mockLog = vi.fn();
    const originalLog = console.log;
    console.log = mockLog;

    logConfig();

    expect(mockLog).toHaveBeenCalled();
    expect(mockLog.mock.calls.length).toBeGreaterThan(5);

    console.log = originalLog;
  });
});

describe("initializeEnv", () => {
  it("should be a function", async () => {
    const { initializeEnv } = await import("../../config/env");
    expect(typeof initializeEnv).toBe("function");
  });

  it("should not throw for valid configuration", async () => {
    const { initializeEnv } = await import("../../config/env");
    const originalLog = console.log;
    console.log = vi.fn();

    expect(() => initializeEnv()).not.toThrow();

    console.log = originalLog;
  });
});

describe("getEnvVarWsUrlOptional", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it("should return undefined for undefined env var", async () => {
    delete process.env.TEST_WS_URL;
    const { getEnvVarWsUrlOptional } = await import("../../config/env");
    expect(getEnvVarWsUrlOptional("TEST_WS_URL")).toBe(undefined);
  });

  it("should return undefined for empty string", async () => {
    process.env.TEST_WS_URL = "";
    const { getEnvVarWsUrlOptional } = await import("../../config/env");
    expect(getEnvVarWsUrlOptional("TEST_WS_URL")).toBe(undefined);
  });

  it("should return valid WebSocket URL", async () => {
    process.env.TEST_WS_URL = "wss://example.com/socket";
    // Need to re-import to pick up the new env value
    vi.resetModules();
    const { getEnvVarWsUrlOptional } = await import("../../config/env");
    expect(getEnvVarWsUrlOptional("TEST_WS_URL")).toBe("wss://example.com/socket");
  });

  it("should throw for invalid WebSocket URL", async () => {
    process.env.TEST_WS_URL = "http://example.com";
    vi.resetModules();
    const { getEnvVarWsUrlOptional } = await import("../../config/env");
    expect(() => getEnvVarWsUrlOptional("TEST_WS_URL")).toThrow(/must be a valid WebSocket URL/);
  });
});
