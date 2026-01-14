/**
 * E2E Browser Tests for Ingestion Health API (INGEST-HEALTH-001)
 *
 * Tests the ingestion health API endpoint using Puppeteer browser automation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const SCREENSHOT_DIR = join(__dirname, "screenshots", "ingestion-health");
const TIMEOUT = 30000;

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let browser: Browser;
let page: Page;

describe("Ingestion Health API E2E Tests", () => {
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set a longer timeout for API calls
    page.setDefaultTimeout(TIMEOUT);
  }, TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe("GET /api/ingestion-health", () => {
    it("should return ingestion health status", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      expect(response?.status()).toBeLessThanOrEqual(503); // 200 or 503 are valid

      const body = await response?.json();

      // Check required fields
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("isStalled");
      expect(body).toHaveProperty("isMarketSyncStalled");
      expect(body).toHaveProperty("isTradeIngestStalled");
      expect(body).toHaveProperty("totals");

      // Check status is valid
      expect(["healthy", "degraded", "unhealthy", "unknown"]).toContain(body.status);

      // Check totals structure
      expect(body.totals).toHaveProperty("cyclesCompleted");
      expect(body.totals).toHaveProperty("cyclesFailed");
      expect(body.totals).toHaveProperty("marketsSynced");
      expect(body.totals).toHaveProperty("tradesIngested");
      expect(body.totals).toHaveProperty("walletsCreated");

      // Take screenshot of JSON response
      await page.screenshot({
        path: join(SCREENSHOT_DIR, "api-full-response.png"),
        fullPage: true,
      });
    }, TIMEOUT);

    it("should return simple status when simple=true", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health?simple=true`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      expect(response?.status()).toBeLessThanOrEqual(503);

      const body = await response?.json();

      // Simple response should only have status
      expect(body).toHaveProperty("status");
      expect(["healthy", "degraded", "unhealthy", "unknown"]).toContain(body.status);

      // Should not have detailed fields
      expect(body).not.toHaveProperty("totals");
      expect(body).not.toHaveProperty("runtime");
    }, TIMEOUT);

    it("should include stats when stats=true", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health?stats=true`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const body = await response?.json();

      // Should have stats object
      if (body.status !== "unknown") {
        expect(body).toHaveProperty("stats");
        if (body.stats) {
          expect(body.stats).toHaveProperty("totalSyncs");
          expect(body.stats).toHaveProperty("successfulSyncs");
          expect(body.stats).toHaveProperty("failedSyncs");
          expect(body.stats).toHaveProperty("successRate");
          expect(body.stats).toHaveProperty("lastHourSyncs");
          expect(body.stats).toHaveProperty("last24HourSyncs");
        }
      }
    }, TIMEOUT);

    it("should include logs when logs=true", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health?logs=true&limit=5`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const body = await response?.json();

      // Should have recentLogs array (may be empty)
      expect(body).toHaveProperty("recentLogs");
      expect(Array.isArray(body.recentLogs)).toBe(true);

      // If there are logs, check structure
      if (body.recentLogs && body.recentLogs.length > 0) {
        const log = body.recentLogs[0];
        expect(log).toHaveProperty("id");
        expect(log).toHaveProperty("syncType");
        expect(log).toHaveProperty("status");
        expect(log).toHaveProperty("recordsProcessed");
        expect(log).toHaveProperty("startedAt");
      }
    }, TIMEOUT);

    it("should include all optional data when requested", async () => {
      const response = await page.goto(
        `${BASE_URL}/api/ingestion-health?stats=true&logs=true&limit=3`,
        { waitUntil: "networkidle0" }
      );

      expect(response).not.toBeNull();
      const body = await response?.json();

      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("stall");
      expect(body).toHaveProperty("totals");
      expect(body).toHaveProperty("recentLogs");

      // Take screenshot
      await page.screenshot({
        path: join(SCREENSHOT_DIR, "api-with-stats-logs.png"),
        fullPage: true,
      });
    }, TIMEOUT);

    it("should return proper HTTP status codes", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const statusCode = response?.status();
      const body = await response?.json();

      // Status code should match body status
      if (body.status === "unhealthy") {
        expect(statusCode).toBe(503);
      } else {
        expect(statusCode).toBe(200);
      }
    }, TIMEOUT);

    it("should have no-cache headers", async () => {
      const response = await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const headers = response?.headers();

      expect(headers?.["cache-control"]).toContain("no-store");
    }, TIMEOUT);

    it("should return valid timestamp", async () => {
      const before = new Date();
      const response = await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });
      const after = new Date();

      expect(response).not.toBeNull();
      const body = await response?.json();

      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    }, TIMEOUT);
  });

  describe("GET /api/health (integrated ingestion health)", () => {
    it("should include ingestion in health check services", async () => {
      const response = await page.goto(`${BASE_URL}/api/health`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const body = await response?.json();

      expect(body).toHaveProperty("services");
      expect(Array.isArray(body.services)).toBe(true);

      // Find ingestion service
      const ingestionService = body.services.find(
        (s: { name: string }) => s.name === "ingestion"
      );

      expect(ingestionService).toBeDefined();
      expect(ingestionService).toHaveProperty("status");
      expect(ingestionService).toHaveProperty("lastCheck");

      // Take screenshot
      await page.screenshot({
        path: join(SCREENSHOT_DIR, "health-api-with-ingestion.png"),
        fullPage: true,
      });
    }, TIMEOUT);

    it("should show ingestion health metadata when available", async () => {
      const response = await page.goto(`${BASE_URL}/api/health`, {
        waitUntil: "networkidle0",
      });

      expect(response).not.toBeNull();
      const body = await response?.json();

      const ingestionService = body.services.find(
        (s: { name: string }) => s.name === "ingestion"
      );

      // If ingestion is healthy, should have metadata
      if (ingestionService && ingestionService.status === "healthy") {
        expect(ingestionService).toHaveProperty("metadata");
        expect(ingestionService.metadata).toHaveProperty("totalMarketsSynced");
        expect(ingestionService.metadata).toHaveProperty("totalTradesIngested");
      }
    }, TIMEOUT);
  });

  describe("Health endpoint stress test", () => {
    it("should handle rapid sequential requests", async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          page.evaluate(async (url) => {
            const response = await fetch(url);
            return {
              status: response.status,
              ok: response.ok,
            };
          }, `${BASE_URL}/api/ingestion-health?simple=true`)
        );
      }

      const results = await Promise.all(requests);

      // All requests should succeed
      for (const result of results) {
        expect([200, 503]).toContain(result.status);
      }
    }, TIMEOUT);

    it("should respond within reasonable time", async () => {
      const start = Date.now();
      const response = await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });
      const duration = Date.now() - start;

      expect(response).not.toBeNull();
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    }, TIMEOUT);
  });

  describe("Browser console errors", () => {
    it("should not have console errors when accessing health endpoint", async () => {
      const consoleErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/api/ingestion-health`, {
        waitUntil: "networkidle0",
      });

      // Filter out expected/benign errors
      const actualErrors = consoleErrors.filter(
        (error) => !error.includes("favicon") && !error.includes("net::ERR")
      );

      expect(actualErrors).toHaveLength(0);
    }, TIMEOUT);
  });
});
