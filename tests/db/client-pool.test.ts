/**
 * Prisma Client Connection Pool Tests
 *
 * Tests for the Prisma client pool helper functions.
 * Note: These tests focus on pool monitoring and configuration,
 * not on actual Prisma client creation (which requires a real database).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPoolMonitor,
  setPoolMonitor,
  getPoolMetrics,
  isConnectionHealthy,
  stopHealthChecks,
  PrismaClientConfig,
} from "../../src/db/client";
import {
  PoolMonitor,
  createPoolMonitor,
  buildPooledDatabaseUrl,
  getDefaultPoolConfig,
} from "../../src/db/pool";

describe("Pool Monitor Integration", () => {
  beforeEach(() => {
    // Reset the pool monitor before each test
    global.__prismaPoolMonitor = undefined;
  });

  afterEach(() => {
    stopHealthChecks();
    if (global.__prismaPoolMonitor) {
      global.__prismaPoolMonitor.reset();
    }
    global.__prismaPoolMonitor = undefined;
  });

  describe("getPoolMonitor", () => {
    it("should return pool monitor instance", () => {
      const monitor = getPoolMonitor();

      expect(monitor).toBeInstanceOf(PoolMonitor);
    });

    it("should return same instance on multiple calls", () => {
      const monitor1 = getPoolMonitor();
      const monitor2 = getPoolMonitor();

      expect(monitor1).toBe(monitor2);
    });

    it("should create monitor with default config", () => {
      const monitor = getPoolMonitor();
      const config = monitor.getConfig();

      expect(config.connectionLimit).toBe(10);
      expect(config.poolTimeout).toBe(10000);
    });
  });

  describe("setPoolMonitor", () => {
    it("should set custom pool monitor", () => {
      const customMonitor = createPoolMonitor({ connectionLimit: 50 });
      setPoolMonitor(customMonitor);

      const monitor = getPoolMonitor();
      expect(monitor.getConfig().connectionLimit).toBe(50);
    });

    it("should replace existing monitor", () => {
      const monitor1 = createPoolMonitor({ connectionLimit: 10 });
      const monitor2 = createPoolMonitor({ connectionLimit: 20 });

      setPoolMonitor(monitor1);
      expect(getPoolMonitor().getConfig().connectionLimit).toBe(10);

      setPoolMonitor(monitor2);
      expect(getPoolMonitor().getConfig().connectionLimit).toBe(20);
    });
  });

  describe("getPoolMetrics", () => {
    it("should return pool metrics", () => {
      const metrics = getPoolMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.config).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(typeof metrics.isConnected).toBe("boolean");
    });

    it("should include config values", () => {
      const metrics = getPoolMetrics();

      expect(metrics.config.connectionLimit).toBeDefined();
      expect(metrics.config.poolTimeout).toBeDefined();
      expect(metrics.config.connectTimeout).toBeDefined();
    });
  });

  describe("isConnectionHealthy", () => {
    it("should return false initially", () => {
      expect(isConnectionHealthy()).toBe(false);
    });

    it("should return true after healthy check recorded", () => {
      const monitor = getPoolMonitor();
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      expect(isConnectionHealthy()).toBe(true);
    });

    it("should return false after unhealthy check recorded", () => {
      const monitor = getPoolMonitor();
      monitor.recordHealthCheck({
        healthy: false,
        responseTimeMs: 1000,
        error: "Connection failed",
        timestamp: new Date(),
      });

      expect(isConnectionHealthy()).toBe(false);
    });

    it("should reflect latest health check status", () => {
      const monitor = getPoolMonitor();

      // Initially healthy
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });
      expect(isConnectionHealthy()).toBe(true);

      // Becomes unhealthy
      monitor.recordHealthCheck({
        healthy: false,
        responseTimeMs: 100,
        error: "Timeout",
        timestamp: new Date(),
      });
      expect(isConnectionHealthy()).toBe(false);

      // Recovers
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 10,
        timestamp: new Date(),
      });
      expect(isConnectionHealthy()).toBe(true);
    });
  });

  describe("stopHealthChecks", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should stop scheduled health checks", async () => {
      const monitor = getPoolMonitor();
      const healthCheckFn = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn, 1000);

      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(1);

      stopHealthChecks();

      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(1); // No additional calls
    });
  });
});

describe("Pool URL Building", () => {
  describe("buildPooledDatabaseUrl", () => {
    const baseUrl = "postgresql://user:pass@localhost:5432/testdb";

    it("should build URL with all pool parameters", () => {
      const url = buildPooledDatabaseUrl(baseUrl, {
        connectionLimit: 15,
        poolTimeout: 8000,
        connectTimeout: 6000,
        applicationName: "test-app",
      });

      expect(url).toContain("connection_limit=15");
      expect(url).toContain("pool_timeout=8");
      expect(url).toContain("connect_timeout=6");
      expect(url).toContain("application_name=test-app");
    });

    it("should preserve existing URL parameters", () => {
      const urlWithParams = "postgresql://user:pass@localhost:5432/db?sslmode=require&schema=public";
      const url = buildPooledDatabaseUrl(urlWithParams, {
        connectionLimit: 10,
      });

      expect(url).toContain("sslmode=require");
      expect(url).toContain("schema=public");
      expect(url).toContain("connection_limit=10");
    });

    it("should use default config when no config provided", () => {
      const url = buildPooledDatabaseUrl(baseUrl);
      const defaults = getDefaultPoolConfig();

      expect(url).toContain(`connection_limit=${defaults.connectionLimit}`);
    });

    it("should handle URL with user credentials", () => {
      const urlWithAuth = "postgresql://admin:secret@localhost:5432/db";
      const url = buildPooledDatabaseUrl(urlWithAuth, { connectionLimit: 5 });

      expect(url).toContain("admin:secret");
      expect(url).toContain("connection_limit=5");
    });

    it("should handle URL with special characters in password", () => {
      const urlWithSpecialChars = "postgresql://user:p%40ss@localhost:5432/db";
      const url = buildPooledDatabaseUrl(urlWithSpecialChars, { connectionLimit: 3 });

      expect(url).toContain("p%40ss");
      expect(url).toContain("connection_limit=3");
    });
  });
});

describe("PrismaClientConfig type", () => {
  it("should support pool configuration", () => {
    // Type test - ensure the config type accepts pool settings
    const config: PrismaClientConfig = {
      logQueries: false,
      datasourceUrl: "postgresql://localhost:5432/db",
      poolConfig: {
        connectionLimit: 20,
        poolTimeout: 5000,
        connectTimeout: 5000,
      },
      enablePooling: true,
      enableHealthChecks: true,
      healthCheckIntervalMs: 30000,
    };

    expect(config.poolConfig?.connectionLimit).toBe(20);
    expect(config.enablePooling).toBe(true);
  });

  it("should have optional fields", () => {
    // Type test - minimal config should be valid
    const config: PrismaClientConfig = {};

    expect(config.poolConfig).toBeUndefined();
    expect(config.enablePooling).toBeUndefined();
  });
});
