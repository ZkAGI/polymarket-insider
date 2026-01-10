/**
 * Connection Pool Configuration Tests
 *
 * Tests for the database connection pool configuration and monitoring utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PoolMonitor,
  HealthCheckResult,
  buildPooledDatabaseUrl,
  parsePoolConfigFromUrl,
  getDefaultPoolConfig,
  getRecommendedPoolConfig,
  validatePoolConfig,
  createPoolMonitor,
  poolMonitor,
  POOL_SIZE_RECOMMENDATIONS,
} from "../../src/db/pool";

describe("Pool Configuration", () => {
  describe("getDefaultPoolConfig", () => {
    it("should return default pool configuration", () => {
      const config = getDefaultPoolConfig();

      expect(config.connectionLimit).toBe(10);
      expect(config.poolTimeout).toBe(10000);
      expect(config.connectTimeout).toBe(10000);
      expect(config.idleTimeout).toBe(300);
      expect(config.applicationName).toBe("polymarket-tracker");
    });

    it("should return consistent values across multiple calls", () => {
      const config1 = getDefaultPoolConfig();
      const config2 = getDefaultPoolConfig();

      expect(config1).toEqual(config2);
    });
  });

  describe("buildPooledDatabaseUrl", () => {
    const baseUrl = "postgresql://user:pass@localhost:5432/testdb";

    it("should add connection_limit parameter", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { connectionLimit: 20 });

      expect(url).toContain("connection_limit=20");
    });

    it("should add pool_timeout parameter in seconds", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { poolTimeout: 15000 });

      expect(url).toContain("pool_timeout=15");
    });

    it("should add connect_timeout parameter in seconds", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { connectTimeout: 5000 });

      expect(url).toContain("connect_timeout=5");
    });

    it("should add application_name parameter", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { applicationName: "my-app" });

      expect(url).toContain("application_name=my-app");
    });

    it("should add schema parameter", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { schema: "public" });

      expect(url).toContain("schema=public");
    });

    it("should add idle_in_transaction_session_timeout parameter", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { idleTimeout: 600 });

      expect(url).toContain("idle_in_transaction_session_timeout=600000");
    });

    it("should add socket_timeout parameter in seconds", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { socketTimeout: 30000 });

      expect(url).toContain("socket_timeout=30");
    });

    it("should merge with default config", () => {
      const url = buildPooledDatabaseUrl(baseUrl, { connectionLimit: 50 });

      // Should have custom value
      expect(url).toContain("connection_limit=50");
      // Should have default values for other params
      expect(url).toContain("pool_timeout=");
      expect(url).toContain("connect_timeout=");
    });

    it("should preserve existing URL parameters", () => {
      const urlWithParams = "postgresql://user:pass@localhost:5432/testdb?sslmode=require";
      const url = buildPooledDatabaseUrl(urlWithParams, { connectionLimit: 10 });

      expect(url).toContain("sslmode=require");
      expect(url).toContain("connection_limit=10");
    });

    it("should handle URL with no path correctly", () => {
      const simpleUrl = "postgresql://localhost:5432";
      const url = buildPooledDatabaseUrl(simpleUrl, { connectionLimit: 5 });

      expect(url).toContain("connection_limit=5");
    });

    it("should use defaults when no config provided", () => {
      const url = buildPooledDatabaseUrl(baseUrl);
      const defaults = getDefaultPoolConfig();

      expect(url).toContain(`connection_limit=${defaults.connectionLimit}`);
      expect(url).toContain(`pool_timeout=${Math.floor(defaults.poolTimeout / 1000)}`);
    });
  });

  describe("parsePoolConfigFromUrl", () => {
    it("should parse connection_limit parameter", () => {
      const url = "postgresql://localhost:5432/db?connection_limit=25";
      const config = parsePoolConfigFromUrl(url);

      expect(config.connectionLimit).toBe(25);
    });

    it("should parse pool_timeout parameter and convert to ms", () => {
      const url = "postgresql://localhost:5432/db?pool_timeout=20";
      const config = parsePoolConfigFromUrl(url);

      expect(config.poolTimeout).toBe(20000);
    });

    it("should parse connect_timeout parameter and convert to ms", () => {
      const url = "postgresql://localhost:5432/db?connect_timeout=15";
      const config = parsePoolConfigFromUrl(url);

      expect(config.connectTimeout).toBe(15000);
    });

    it("should parse application_name parameter", () => {
      const url = "postgresql://localhost:5432/db?application_name=test-app";
      const config = parsePoolConfigFromUrl(url);

      expect(config.applicationName).toBe("test-app");
    });

    it("should parse schema parameter", () => {
      const url = "postgresql://localhost:5432/db?schema=myschema";
      const config = parsePoolConfigFromUrl(url);

      expect(config.schema).toBe("myschema");
    });

    it("should parse idle_in_transaction_session_timeout and convert to seconds", () => {
      const url = "postgresql://localhost:5432/db?idle_in_transaction_session_timeout=300000";
      const config = parsePoolConfigFromUrl(url);

      expect(config.idleTimeout).toBe(300);
    });

    it("should parse socket_timeout and convert to ms", () => {
      const url = "postgresql://localhost:5432/db?socket_timeout=30";
      const config = parsePoolConfigFromUrl(url);

      expect(config.socketTimeout).toBe(30000);
    });

    it("should handle multiple parameters", () => {
      const url =
        "postgresql://localhost:5432/db?connection_limit=10&pool_timeout=5&application_name=myapp";
      const config = parsePoolConfigFromUrl(url);

      expect(config.connectionLimit).toBe(10);
      expect(config.poolTimeout).toBe(5000);
      expect(config.applicationName).toBe("myapp");
    });

    it("should return empty object for URL without pool params", () => {
      const url = "postgresql://localhost:5432/db?sslmode=require";
      const config = parsePoolConfigFromUrl(url);

      expect(config.connectionLimit).toBeUndefined();
      expect(config.poolTimeout).toBeUndefined();
    });
  });

  describe("validatePoolConfig", () => {
    it("should validate valid configuration", () => {
      const result = validatePoolConfig({
        connectionLimit: 10,
        poolTimeout: 10000,
        connectTimeout: 5000,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject connectionLimit less than 1", () => {
      const result = validatePoolConfig({ connectionLimit: 0 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("connectionLimit must be at least 1");
    });

    it("should warn about connectionLimit over 100", () => {
      const result = validatePoolConfig({ connectionLimit: 150 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "connectionLimit should not exceed 100 (consider load balancing instead)"
      );
    });

    it("should reject negative poolTimeout", () => {
      const result = validatePoolConfig({ poolTimeout: -1000 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("poolTimeout must be non-negative");
    });

    it("should warn about poolTimeout over 60 seconds", () => {
      const result = validatePoolConfig({ poolTimeout: 120000 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("poolTimeout should not exceed 60 seconds");
    });

    it("should reject negative connectTimeout", () => {
      const result = validatePoolConfig({ connectTimeout: -1 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("connectTimeout must be non-negative");
    });

    it("should warn about connectTimeout over 60 seconds", () => {
      const result = validatePoolConfig({ connectTimeout: 90000 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("connectTimeout should not exceed 60 seconds");
    });

    it("should reject negative idleTimeout", () => {
      const result = validatePoolConfig({ idleTimeout: -10 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("idleTimeout must be non-negative");
    });

    it("should validate empty configuration", () => {
      const result = validatePoolConfig({});

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should collect multiple errors", () => {
      const result = validatePoolConfig({
        connectionLimit: 0,
        poolTimeout: -1000,
        connectTimeout: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("getRecommendedPoolConfig", () => {
    it("should return serverless config", () => {
      const config = getRecommendedPoolConfig("serverless");

      expect(config.connectionLimit).toBe(2);
      expect(config.poolTimeout).toBe(5000);
    });

    it("should return development config", () => {
      const config = getRecommendedPoolConfig("development");

      expect(config.connectionLimit).toBe(5);
      expect(config.poolTimeout).toBe(10000);
    });

    it("should return production config", () => {
      const config = getRecommendedPoolConfig("production");

      expect(config.connectionLimit).toBe(20);
      expect(config.poolTimeout).toBe(10000);
    });

    it("should return highTraffic config", () => {
      const config = getRecommendedPoolConfig("highTraffic");

      expect(config.connectionLimit).toBe(50);
      expect(config.poolTimeout).toBe(15000);
    });

    it("should return testing config", () => {
      const config = getRecommendedPoolConfig("testing");

      expect(config.connectionLimit).toBe(2);
      expect(config.poolTimeout).toBe(5000);
    });

    it("should include default config properties", () => {
      const config = getRecommendedPoolConfig("development");

      expect(config.applicationName).toBeDefined();
      expect(config.idleTimeout).toBeDefined();
    });
  });

  describe("POOL_SIZE_RECOMMENDATIONS", () => {
    it("should have serverless recommendation", () => {
      expect(POOL_SIZE_RECOMMENDATIONS.serverless).toBeDefined();
      expect(POOL_SIZE_RECOMMENDATIONS.serverless.connectionLimit).toBe(2);
    });

    it("should have development recommendation", () => {
      expect(POOL_SIZE_RECOMMENDATIONS.development).toBeDefined();
      expect(POOL_SIZE_RECOMMENDATIONS.development.connectionLimit).toBe(5);
    });

    it("should have production recommendation", () => {
      expect(POOL_SIZE_RECOMMENDATIONS.production).toBeDefined();
      expect(POOL_SIZE_RECOMMENDATIONS.production.connectionLimit).toBe(20);
    });

    it("should have highTraffic recommendation", () => {
      expect(POOL_SIZE_RECOMMENDATIONS.highTraffic).toBeDefined();
      expect(POOL_SIZE_RECOMMENDATIONS.highTraffic.connectionLimit).toBe(50);
    });

    it("should have testing recommendation", () => {
      expect(POOL_SIZE_RECOMMENDATIONS.testing).toBeDefined();
      expect(POOL_SIZE_RECOMMENDATIONS.testing.connectionLimit).toBe(2);
    });
  });
});

describe("PoolMonitor", () => {
  let monitor: PoolMonitor;

  beforeEach(() => {
    monitor = createPoolMonitor();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe("constructor", () => {
    it("should create monitor with default config", () => {
      const config = monitor.getConfig();

      expect(config.connectionLimit).toBe(10);
      expect(config.poolTimeout).toBe(10000);
    });

    it("should create monitor with custom config", () => {
      const customMonitor = createPoolMonitor({ connectionLimit: 25 });
      const config = customMonitor.getConfig();

      expect(config.connectionLimit).toBe(25);
      customMonitor.reset();
    });
  });

  describe("getConfig", () => {
    it("should return copy of config", () => {
      const config1 = monitor.getConfig();
      const config2 = monitor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });
  });

  describe("updateConfig", () => {
    it("should update config partially", () => {
      monitor.updateConfig({ connectionLimit: 30 });
      const config = monitor.getConfig();

      expect(config.connectionLimit).toBe(30);
      expect(config.poolTimeout).toBe(10000); // Unchanged
    });

    it("should update multiple config values", () => {
      monitor.updateConfig({
        connectionLimit: 15,
        poolTimeout: 5000,
        applicationName: "updated-app",
      });
      const config = monitor.getConfig();

      expect(config.connectionLimit).toBe(15);
      expect(config.poolTimeout).toBe(5000);
      expect(config.applicationName).toBe("updated-app");
    });
  });

  describe("getMetrics", () => {
    it("should return current metrics", () => {
      const metrics = monitor.getMetrics();

      expect(metrics.config).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.isConnected).toBe(false);
      expect(metrics.lastHealthCheck).toBeUndefined();
    });

    it("should include health check result after recording", () => {
      const healthCheck: HealthCheckResult = {
        healthy: true,
        responseTimeMs: 10,
        timestamp: new Date(),
      };

      monitor.recordHealthCheck(healthCheck);
      const metrics = monitor.getMetrics();

      expect(metrics.lastHealthCheck).toEqual(healthCheck);
      expect(metrics.isConnected).toBe(true);
    });
  });

  describe("recordHealthCheck", () => {
    it("should record healthy check", () => {
      const result: HealthCheckResult = {
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      };

      monitor.recordHealthCheck(result);

      expect(monitor.isHealthy()).toBe(true);
      expect(monitor.getConnectionStatus()).toBe(true);
      expect(monitor.getLastHealthCheck()).toEqual(result);
    });

    it("should record unhealthy check", () => {
      const result: HealthCheckResult = {
        healthy: false,
        responseTimeMs: 1000,
        error: "Connection refused",
        timestamp: new Date(),
      };

      monitor.recordHealthCheck(result);

      expect(monitor.isHealthy()).toBe(false);
      expect(monitor.getConnectionStatus()).toBe(false);
      expect(monitor.getLastHealthCheck()?.error).toBe("Connection refused");
    });

    it("should update status on subsequent checks", () => {
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      expect(monitor.isHealthy()).toBe(true);

      monitor.recordHealthCheck({
        healthy: false,
        responseTimeMs: 100,
        error: "Timeout",
        timestamp: new Date(),
      });

      expect(monitor.isHealthy()).toBe(false);
    });
  });

  describe("isHealthy", () => {
    it("should return false when no health check recorded", () => {
      expect(monitor.isHealthy()).toBe(false);
    });

    it("should return true after healthy check", () => {
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      expect(monitor.isHealthy()).toBe(true);
    });

    it("should return false after unhealthy check", () => {
      monitor.recordHealthCheck({
        healthy: false,
        responseTimeMs: 100,
        error: "Error",
        timestamp: new Date(),
      });

      expect(monitor.isHealthy()).toBe(false);
    });
  });

  describe("getConnectionStatus / setConnectionStatus", () => {
    it("should return false by default", () => {
      expect(monitor.getConnectionStatus()).toBe(false);
    });

    it("should update connection status", () => {
      monitor.setConnectionStatus(true);
      expect(monitor.getConnectionStatus()).toBe(true);

      monitor.setConnectionStatus(false);
      expect(monitor.getConnectionStatus()).toBe(false);
    });
  });

  describe("health check scheduling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should start periodic health checks", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn, 1000);

      // Advance time to trigger first check
      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(1);

      // Advance time again
      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(2);

      monitor.stopHealthChecks();
    });

    it("should stop health checks", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn, 1000);

      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(1);

      monitor.stopHealthChecks();

      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("should replace existing health check interval", async () => {
      const healthCheckFn1 = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });
      const healthCheckFn2 = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 10,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn1, 1000);
      monitor.startHealthChecks(healthCheckFn2, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      // Only the second function should be called
      expect(healthCheckFn1).not.toHaveBeenCalled();
      expect(healthCheckFn2).toHaveBeenCalledTimes(1);

      monitor.stopHealthChecks();
    });

    it("should record health check results from scheduled checks", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 7,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      expect(monitor.isHealthy()).toBe(true);
      expect(monitor.getLastHealthCheck()?.responseTimeMs).toBe(7);

      monitor.stopHealthChecks();
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should reset all state", () => {
      monitor.recordHealthCheck({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });
      monitor.setConnectionStatus(true);

      monitor.reset();

      expect(monitor.isHealthy()).toBe(false);
      expect(monitor.getConnectionStatus()).toBe(false);
      expect(monitor.getLastHealthCheck()).toBeUndefined();
    });

    it("should stop health checks on reset", async () => {
      const healthCheckFn = vi.fn().mockResolvedValue({
        healthy: true,
        responseTimeMs: 5,
        timestamp: new Date(),
      });

      monitor.startHealthChecks(healthCheckFn, 1000);
      monitor.reset();

      await vi.advanceTimersByTimeAsync(1000);
      expect(healthCheckFn).not.toHaveBeenCalled();
    });
  });
});

describe("poolMonitor singleton", () => {
  afterEach(() => {
    poolMonitor.reset();
  });

  it("should be a PoolMonitor instance", () => {
    expect(poolMonitor).toBeInstanceOf(PoolMonitor);
  });

  it("should have default configuration", () => {
    const config = poolMonitor.getConfig();
    expect(config.connectionLimit).toBe(10);
  });
});
