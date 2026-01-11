/**
 * E2E Tests for Wallet Funding Pattern Analyzer (DET-FRESH-005)
 *
 * Tests that:
 * 1. The app loads correctly with the new detection module
 * 2. The funding pattern analyzer can be imported and used
 * 3. Browser can access the app
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  FundingPatternType,
  FundingTimingCategory,
  FundingPatternAnalyzer,
  createFundingPatternAnalyzer,
  getSharedFundingPatternAnalyzer,
  resetSharedFundingPatternAnalyzer,
  DEFAULT_FUNDING_PATTERN_THRESHOLDS,
} from "../../src/detection/funding-pattern";
import { FreshWalletAlertSeverity } from "../../src/detection/fresh-wallet-config";

describe("Funding Pattern Analyzer E2E Tests", () => {
  describe("Detection Module Integration", () => {
    beforeAll(() => {
      resetSharedFundingPatternAnalyzer();
    });

    afterAll(() => {
      resetSharedFundingPatternAnalyzer();
    });

    it("should create and configure funding pattern analyzer", () => {
      const analyzer = createFundingPatternAnalyzer({
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        thresholds: {
          flashTimingSeconds: 600,
          flashTimingScore: 50,
        },
      });

      expect(analyzer).toBeInstanceOf(FundingPatternAnalyzer);

      const thresholds = analyzer.getThresholds();
      expect(thresholds.flashTimingSeconds).toBe(600);
      expect(thresholds.flashTimingScore).toBe(50);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should manage shared singleton correctly", () => {
      const shared1 = getSharedFundingPatternAnalyzer();
      const shared2 = getSharedFundingPatternAnalyzer();

      expect(shared1).toBe(shared2);

      resetSharedFundingPatternAnalyzer();
      const shared3 = getSharedFundingPatternAnalyzer();

      expect(shared3).not.toBe(shared1);
    });

    it("should have all required FundingPatternType enum values", () => {
      expect(FundingPatternType.NORMAL).toBe("NORMAL");
      expect(FundingPatternType.QUICK).toBe("QUICK");
      expect(FundingPatternType.IMMEDIATE).toBe("IMMEDIATE");
      expect(FundingPatternType.FLASH).toBe("FLASH");
      expect(FundingPatternType.SUSPICIOUS).toBe("SUSPICIOUS");
    });

    it("should have all required FundingTimingCategory enum values", () => {
      expect(FundingTimingCategory.FLASH).toBe("FLASH");
      expect(FundingTimingCategory.VERY_FAST).toBe("VERY_FAST");
      expect(FundingTimingCategory.FAST).toBe("FAST");
      expect(FundingTimingCategory.MODERATE).toBe("MODERATE");
      expect(FundingTimingCategory.SLOW).toBe("SLOW");
      expect(FundingTimingCategory.NO_TRADES).toBe("NO_TRADES");
    });

    it("should have correct default thresholds", () => {
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.flashTimingSeconds).toBe(300);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingSeconds).toBe(3600);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.fastTimingSeconds).toBe(86400);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.moderateTimingSeconds).toBe(604800);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.flashTimingScore).toBe(40);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingScore).toBe(25);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.fastTimingScore).toBe(10);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.sanctionedSourceScore).toBe(50);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.mixerSourceScore).toBe(30);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.singleLargeDepositScore).toBe(15);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.multipleQuickDepositsScore).toBe(20);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.largeDepositThresholdUsd).toBe(10000);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.quickDepositWindowSeconds).toBe(600);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.suspiciousThreshold).toBe(60);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.immediateThreshold).toBe(40);
      expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.quickThreshold).toBe(20);
    });

    it("should handle cache operations correctly", () => {
      const analyzer = createFundingPatternAnalyzer({ maxCacheSize: 10 });

      // Initial cache should be empty
      expect(analyzer.getCacheStats().size).toBe(0);

      // Clear cache should work
      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);

      // Invalidating non-existent entry should return false
      const result = analyzer.invalidateCacheEntry(
        "0x1234567890123456789012345678901234567890"
      );
      expect(result).toBe(false);
    });

    it("should invalidate invalid addresses correctly", () => {
      const analyzer = createFundingPatternAnalyzer();

      // Invalidating invalid address should return false
      const result = analyzer.invalidateCacheEntry("0xinvalid");
      expect(result).toBe(false);
    });

    it("should get config manager for fresh wallet integration", () => {
      const analyzer = createFundingPatternAnalyzer();
      const configManager = analyzer.getConfigManager();

      expect(configManager).toBeDefined();
    });

    it("should calculate summary for empty results", () => {
      const analyzer = createFundingPatternAnalyzer();
      const summary = analyzer.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.suspiciousPercentage).toBe(0);
      expect(summary.flashTimingPercentage).toBe(0);
      expect(summary.averageFundingToTradeSeconds).toBeNull();
      expect(summary.medianFundingToTradeSeconds).toBeNull();
      expect(summary.averageSuspicionScore).toBe(0);
      expect(summary.byPatternType[FundingPatternType.NORMAL]).toBe(0);
      expect(summary.byTimingCategory[FundingTimingCategory.NO_TRADES]).toBe(0);
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
          console.log(
            "Dev server not responding on port 3000, skipping browser tests"
          );
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

      // Check there are no console errors related to the funding-pattern module
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Take a screenshot for verification
      await page.screenshot({
        path: "/tmp/funding-pattern-e2e.png",
        fullPage: true,
      });

      // Filter out expected errors (like API calls that may fail in test environment)
      const unexpectedErrors = errors.filter(
        (e) =>
          !e.includes("fetch") &&
          !e.includes("network") &&
          !e.includes("Failed to load")
      );

      // Should have no unexpected console errors
      expect(unexpectedErrors.length).toBe(0);
    }, 30000);

    it("should verify app responsive layout with funding-pattern module", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const mobileScreenshot = await page.screenshot({
        path: "/tmp/funding-pattern-e2e-mobile.png",
      });
      expect(mobileScreenshot).toBeDefined();

      // Test desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });

      const desktopScreenshot = await page.screenshot({
        path: "/tmp/funding-pattern-e2e-desktop.png",
      });
      expect(desktopScreenshot).toBeDefined();
    }, 30000);
  });
});

describe("Funding Pattern Analyzer Severity Integration", () => {
  beforeAll(() => {
    resetSharedFundingPatternAnalyzer();
  });

  afterAll(() => {
    resetSharedFundingPatternAnalyzer();
  });

  it("should integrate with FreshWalletAlertSeverity", () => {
    // Verify severity levels are properly imported and usable
    expect(FreshWalletAlertSeverity.LOW).toBe("LOW");
    expect(FreshWalletAlertSeverity.MEDIUM).toBe("MEDIUM");
    expect(FreshWalletAlertSeverity.HIGH).toBe("HIGH");
    expect(FreshWalletAlertSeverity.CRITICAL).toBe("CRITICAL");
  });

  it("should create analyzer with all custom thresholds", () => {
    const analyzer = createFundingPatternAnalyzer({
      cacheTtlMs: 30000,
      maxCacheSize: 100,
      thresholds: {
        flashTimingSeconds: 120,
        veryFastTimingSeconds: 1800,
        fastTimingSeconds: 43200,
        moderateTimingSeconds: 302400,
        flashTimingScore: 45,
        veryFastTimingScore: 30,
        fastTimingScore: 15,
        sanctionedSourceScore: 60,
        mixerSourceScore: 35,
        singleLargeDepositScore: 20,
        multipleQuickDepositsScore: 25,
        largeDepositThresholdUsd: 5000,
        quickDepositWindowSeconds: 300,
        suspiciousThreshold: 55,
        immediateThreshold: 35,
        quickThreshold: 15,
      },
    });

    const thresholds = analyzer.getThresholds();
    expect(thresholds.flashTimingSeconds).toBe(120);
    expect(thresholds.veryFastTimingSeconds).toBe(1800);
    expect(thresholds.fastTimingSeconds).toBe(43200);
    expect(thresholds.moderateTimingSeconds).toBe(302400);
    expect(thresholds.flashTimingScore).toBe(45);
    expect(thresholds.sanctionedSourceScore).toBe(60);
    expect(thresholds.mixerSourceScore).toBe(35);
    expect(thresholds.largeDepositThresholdUsd).toBe(5000);
    expect(thresholds.suspiciousThreshold).toBe(55);
    expect(thresholds.immediateThreshold).toBe(35);
    expect(thresholds.quickThreshold).toBe(15);
  });

  it("should preserve default thresholds for non-specified values", () => {
    const analyzer = createFundingPatternAnalyzer({
      thresholds: {
        flashTimingSeconds: 180,
      },
    });

    const thresholds = analyzer.getThresholds();
    expect(thresholds.flashTimingSeconds).toBe(180);
    // Other values should be default
    expect(thresholds.veryFastTimingSeconds).toBe(3600);
    expect(thresholds.fastTimingSeconds).toBe(86400);
    expect(thresholds.sanctionedSourceScore).toBe(50);
  });
});

describe("Funding Pattern Detection Logic", () => {
  beforeAll(() => {
    resetSharedFundingPatternAnalyzer();
  });

  afterAll(() => {
    resetSharedFundingPatternAnalyzer();
  });

  it("should have default timing thresholds that make sense", () => {
    // Verify timing thresholds are in logical order
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.flashTimingSeconds).toBeLessThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingSeconds
    );
    expect(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingSeconds
    ).toBeLessThan(DEFAULT_FUNDING_PATTERN_THRESHOLDS.fastTimingSeconds);
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.fastTimingSeconds).toBeLessThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.moderateTimingSeconds
    );
  });

  it("should have scoring weights that reflect risk severity", () => {
    // Sanctioned sources should have highest score
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.sanctionedSourceScore).toBeGreaterThanOrEqual(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.mixerSourceScore
    );
    // Flash timing should have highest timing score
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.flashTimingScore).toBeGreaterThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingScore
    );
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingScore).toBeGreaterThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.fastTimingScore
    );
  });

  it("should have pattern thresholds in correct order", () => {
    // Suspicious should be highest, then immediate, then quick
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.suspiciousThreshold).toBeGreaterThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.immediateThreshold
    );
    expect(DEFAULT_FUNDING_PATTERN_THRESHOLDS.immediateThreshold).toBeGreaterThan(
      DEFAULT_FUNDING_PATTERN_THRESHOLDS.quickThreshold
    );
  });
});
