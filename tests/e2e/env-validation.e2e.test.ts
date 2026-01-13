import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Environment Validation E2E", () => {
  const originalEnv = { ...process.env };
  // Cast to allow NODE_ENV modification in tests
  const env = process.env as { NODE_ENV?: string; [key: string]: string | undefined };

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

  describe("initializeEnv", () => {
    it("should initialize without errors in development mode", async () => {
      env.NODE_ENV = "development";

      const { initializeEnv } = await import("../../config/env");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => initializeEnv()).not.toThrow();

      // Should have logged config
      expect(consoleSpy).toHaveBeenCalled();
      // Should not have logged errors
      const errorCalls = consoleErrorSpy.mock.calls;
      const hasConfigError = errorCalls.some(call =>
        String(call[0]).includes("Configuration Errors")
      );
      expect(hasConfigError).toBe(false);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should validate and log all required API URLs", async () => {
      env.NODE_ENV = "development";

      const { logConfig } = await import("../../config/env");
      const logs: string[] = [];
      const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
        logs.push(args.map(a => String(a)).join(" "));
      });

      logConfig();

      const allLogs = logs.join("\n");

      // Verify API URLs are logged
      expect(allLogs).toContain("GAMMA_API_URL");
      expect(allLogs).toContain("CLOB_API_URL");
      expect(allLogs).toContain("CLOB_WS_URL");

      // Verify they contain expected values
      expect(allLogs).toContain("gamma-api.polymarket.com");
      expect(allLogs).toContain("clob.polymarket.com");
      expect(allLogs).toContain("ws-subscriptions-clob.polymarket.com");

      consoleSpy.mockRestore();
    });

    it("should validate and return warnings for missing optional config", async () => {
      env.NODE_ENV = "development";
      delete process.env.POLYGON_RPC_URL;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.DISCORD_WEBHOOK_URL;
      delete process.env.OPENAI_API_KEY;

      vi.resetModules();
      const { validateEnv } = await import("../../config/env");
      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);

      // Check for specific warnings
      const warningTexts = result.warnings.join(" ");
      expect(warningTexts).toContain("POLYGON_RPC_URL");
      expect(warningTexts).toContain("OPENAI_API_KEY");
    });

    it("should redact sensitive values in logs", async () => {
      env.NODE_ENV = "development";
      process.env.OPENAI_API_KEY = "sk-secret12345678secret";
      process.env.DATABASE_URL = "postgresql://user:supersecret@localhost:5432/db";

      vi.resetModules();
      const { logConfig } = await import("../../config/env");
      const logs: string[] = [];
      const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
        logs.push(args.map(a => String(a)).join(" "));
      });

      logConfig();

      const allLogs = logs.join("\n");

      // Should not contain full secrets
      expect(allLogs).not.toContain("sk-secret12345678secret");
      expect(allLogs).not.toContain("supersecret");

      // Should contain redacted versions
      expect(allLogs).toContain("****");

      consoleSpy.mockRestore();
    });

    it("should parse TELEGRAM_ADMIN_IDS correctly", async () => {
      env.NODE_ENV = "development";
      process.env.TELEGRAM_ADMIN_IDS = "123456789,987654321,111222333";

      vi.resetModules();
      const { env: envConfig } = await import("../../config/env");

      expect(envConfig.TELEGRAM_ADMIN_IDS).toEqual([123456789, 987654321, 111222333]);
    });

    it("should validate TELEGRAM_BOT_TOKEN format", async () => {
      env.NODE_ENV = "development";
      process.env.TELEGRAM_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";

      vi.resetModules();
      const { env: envConfig } = await import("../../config/env");

      expect(envConfig.TELEGRAM_BOT_TOKEN).toBe("123456789:ABCdefGHIjklMNOpqrsTUVwxyz");
    });

    it("should throw for invalid TELEGRAM_BOT_TOKEN format", async () => {
      env.NODE_ENV = "development";
      process.env.TELEGRAM_BOT_TOKEN = "invalid-token-format";

      vi.resetModules();

      await expect(async () => {
        await import("../../config/env");
      }).rejects.toThrow(/Invalid TELEGRAM_BOT_TOKEN format/);
    });

    it("should use default values when env vars not set", async () => {
      env.NODE_ENV = "development";
      delete process.env.GAMMA_API_URL;
      delete process.env.CLOB_API_URL;
      delete process.env.CLOB_WS_URL;

      vi.resetModules();
      const { env: envConfig } = await import("../../config/env");

      expect(envConfig.GAMMA_API_URL).toBe("https://gamma-api.polymarket.com");
      expect(envConfig.CLOB_API_URL).toBe("https://clob.polymarket.com");
      expect(envConfig.CLOB_WS_URL).toBe("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    });

    it("should throw for invalid URL format in GAMMA_API_URL", async () => {
      env.NODE_ENV = "development";
      process.env.GAMMA_API_URL = "not-a-valid-url";

      vi.resetModules();

      await expect(async () => {
        await import("../../config/env");
      }).rejects.toThrow(/must be a valid URL/);
    });

    it("should throw for non-WebSocket URL in CLOB_WS_URL", async () => {
      env.NODE_ENV = "development";
      process.env.CLOB_WS_URL = "https://example.com";

      vi.resetModules();

      await expect(async () => {
        await import("../../config/env");
      }).rejects.toThrow(/must be a valid WebSocket URL/);
    });

    it("should detect production environment issues", async () => {
      env.NODE_ENV = "production";
      process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/polymarket_tracker";

      vi.resetModules();
      const { validateEnv } = await import("../../config/env");
      const result = validateEnv();

      // Production with localhost database should be an error
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("localhost"))).toBe(true);
    });
  });
});
