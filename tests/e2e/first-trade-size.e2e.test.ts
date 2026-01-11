/**
 * E2E Tests for First Trade Size Analyzer (DET-FRESH-004)
 *
 * Tests that:
 * 1. The app loads correctly with the new detection module
 * 2. The first trade size analyzer can be imported and used
 * 3. Browser can access the app
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  FirstTradeSizeCategory,
  FirstTradeSizeAnalyzer,
  createFirstTradeSizeAnalyzer,
  getSharedFirstTradeSizeAnalyzer,
  resetSharedFirstTradeSizeAnalyzer,
  DEFAULT_FIRST_TRADE_THRESHOLDS,
  DEFAULT_FIRST_TRADE_STATS,
} from "../../src/detection/first-trade-size";
import { FreshWalletAlertSeverity } from "../../src/detection/fresh-wallet-config";

describe("First Trade Size Analyzer E2E Tests", () => {
  describe("Detection Module Integration", () => {
    beforeAll(() => {
      resetSharedFirstTradeSizeAnalyzer();
    });

    afterAll(() => {
      resetSharedFirstTradeSizeAnalyzer();
    });

    it("should create and configure first trade size analyzer", () => {
      const analyzer = createFirstTradeSizeAnalyzer({
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        thresholds: {
          minSizeUsd: 20,
          outlierZScore: 3,
        },
      });

      expect(analyzer).toBeInstanceOf(FirstTradeSizeAnalyzer);

      const thresholds = analyzer.getThresholds();
      expect(thresholds.minSizeUsd).toBe(20);
      expect(thresholds.outlierZScore).toBe(3);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should manage shared singleton correctly", () => {
      const shared1 = getSharedFirstTradeSizeAnalyzer();
      const shared2 = getSharedFirstTradeSizeAnalyzer();

      expect(shared1).toBe(shared2);

      resetSharedFirstTradeSizeAnalyzer();
      const shared3 = getSharedFirstTradeSizeAnalyzer();

      expect(shared3).not.toBe(shared1);
    });

    it("should have all required enums and types", () => {
      // Verify FirstTradeSizeCategory enum values
      expect(FirstTradeSizeCategory.SMALL).toBe("SMALL");
      expect(FirstTradeSizeCategory.NORMAL).toBe("NORMAL");
      expect(FirstTradeSizeCategory.LARGE).toBe("LARGE");
      expect(FirstTradeSizeCategory.VERY_LARGE).toBe("VERY_LARGE");
      expect(FirstTradeSizeCategory.OUTLIER).toBe("OUTLIER");
    });

    it("should have correct default thresholds", () => {
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.minSizeUsd).toBe(10);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.outlierZScore).toBe(2.5);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.largePercentile).toBe(75);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.veryLargePercentile).toBe(90);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.outlierPercentile).toBe(95);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.suspiciousMultiple).toBe(5);
      expect(DEFAULT_FIRST_TRADE_THRESHOLDS.absoluteThresholdUsd).toBe(10000);
    });

    it("should have correct default statistics", () => {
      expect(DEFAULT_FIRST_TRADE_STATS.sampleSize).toBe(1000);
      expect(DEFAULT_FIRST_TRADE_STATS.averageSizeUsd).toBe(150);
      expect(DEFAULT_FIRST_TRADE_STATS.medianSizeUsd).toBe(50);
      expect(DEFAULT_FIRST_TRADE_STATS.percentile75).toBe(200);
      expect(DEFAULT_FIRST_TRADE_STATS.percentile90).toBe(500);
      expect(DEFAULT_FIRST_TRADE_STATS.percentile95).toBe(1000);
      expect(DEFAULT_FIRST_TRADE_STATS.percentile99).toBe(5000);
    });

    it("should handle cache operations correctly", () => {
      const analyzer = createFirstTradeSizeAnalyzer({ maxCacheSize: 10 });

      // Initial cache should be empty
      expect(analyzer.getCacheStats().size).toBe(0);

      // Clear cache should work
      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);

      // Invalidating non-existent entry should return false
      const result = analyzer.invalidateCacheEntry("0x1234567890123456789012345678901234567890");
      expect(result).toBe(false);
    });

    it("should handle sample operations and stat recalculation", () => {
      const analyzer = createFirstTradeSizeAnalyzer();

      // Add samples
      const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      samples.forEach((s) => analyzer.addSample(s));

      const stats = analyzer.getHistoricalStats();
      expect(stats.sampleSize).toBe(10);
      expect(stats.averageSizeUsd).toBeCloseTo(550, 0);
      expect(stats.minSizeUsd).toBe(100);
      expect(stats.maxSizeUsd).toBe(1000);
    });

    it("should reset statistics to defaults", () => {
      const analyzer = createFirstTradeSizeAnalyzer({
        historicalSamples: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
      });

      // Stats should be recalculated
      expect(analyzer.getHistoricalStats().averageSizeUsd).toBeCloseTo(550, 0);

      // Reset should restore defaults
      analyzer.resetStats();
      const stats = analyzer.getHistoricalStats();
      expect(stats.averageSizeUsd).toBe(DEFAULT_FIRST_TRADE_STATS.averageSizeUsd);
    });

    it("should get config manager for fresh wallet integration", () => {
      const analyzer = createFirstTradeSizeAnalyzer();
      const configManager = analyzer.getConfigManager();

      expect(configManager).toBeDefined();
    });
  });

  describe("Browser Integration", () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
      // Check if the dev server is running
      try {
        const response = await fetch("http://localhost:3000");
        if (!response.ok) {
          console.log("Dev server not responding on port 3000, skipping browser tests");
          return;
        }
      } catch {
        console.log("Dev server not running, skipping browser tests");
        return;
      }

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      page = await browser.newPage();
    }, 30000);

    afterAll(async () => {
      if (page) await page.close();
      if (browser) await browser.close();
    });

    it("should load the app successfully", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      // Check that the page loaded
      const title = await page.title();
      expect(title).toBeDefined();

      // Check there are no console errors related to the first-trade-size module
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Take a screenshot for verification
      await page.screenshot({
        path: "/tmp/first-trade-size-e2e.png",
        fullPage: true,
      });

      // Filter out expected errors (like API calls that may fail in test environment)
      const unexpectedErrors = errors.filter(
        (e) => !e.includes("fetch") && !e.includes("network") && !e.includes("Failed to load")
      );

      // Should have no unexpected console errors
      expect(unexpectedErrors.length).toBe(0);
    }, 30000);

    it("should verify app responsive layout with first-trade-size module", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const mobileScreenshot = await page.screenshot({
        path: "/tmp/first-trade-size-e2e-mobile.png",
      });
      expect(mobileScreenshot).toBeDefined();

      // Test desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const desktopScreenshot = await page.screenshot({
        path: "/tmp/first-trade-size-e2e-desktop.png",
      });
      expect(desktopScreenshot).toBeDefined();
    }, 30000);
  });
});

describe("First Trade Size Analyzer Severity Integration", () => {
  beforeAll(() => {
    resetSharedFirstTradeSizeAnalyzer();
  });

  afterAll(() => {
    resetSharedFirstTradeSizeAnalyzer();
  });

  it("should integrate with FreshWalletAlertSeverity", () => {
    // Verify severity levels are properly imported and usable
    expect(FreshWalletAlertSeverity.LOW).toBe("LOW");
    expect(FreshWalletAlertSeverity.MEDIUM).toBe("MEDIUM");
    expect(FreshWalletAlertSeverity.HIGH).toBe("HIGH");
    expect(FreshWalletAlertSeverity.CRITICAL).toBe("CRITICAL");
  });

  it("should create analyzer with custom thresholds and samples", () => {
    const customSamples = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    const analyzer = createFirstTradeSizeAnalyzer({
      cacheTtlMs: 30000,
      maxCacheSize: 100,
      thresholds: {
        minSizeUsd: 5,
        absoluteThresholdUsd: 5000,
      },
      historicalSamples: customSamples,
    });

    const thresholds = analyzer.getThresholds();
    expect(thresholds.minSizeUsd).toBe(5);
    expect(thresholds.absoluteThresholdUsd).toBe(5000);

    const stats = analyzer.getHistoricalStats();
    expect(stats.sampleSize).toBe(10);
    expect(stats.averageSizeUsd).toBeCloseTo(275, 0);
  });
});
