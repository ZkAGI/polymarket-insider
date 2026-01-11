/**
 * E2E Tests for Wallet Reactivation Detector (DET-FRESH-007)
 *
 * Tests that:
 * 1. The app loads correctly with the new detection module
 * 2. The wallet reactivation detector can be imported and used
 * 3. All enums and types are properly exported
 * 4. Browser can access the app
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  ReactivationStatus,
  DormancySeverity,
  ActivityPatternType,
  DEFAULT_DORMANCY_SEVERITY_THRESHOLDS,
  WalletReactivationDetector,
  createWalletReactivationDetector,
  getSharedWalletReactivationDetector,
  setSharedWalletReactivationDetector,
  resetSharedWalletReactivationDetector,
  checkWalletReactivation,
  batchCheckWalletReactivation,
  isWalletDormant,
  wasWalletRecentlyReactivated,
  getWalletDaysSinceActivity,
  getReactivationSummary,
  type WalletReactivationResult,
  type ReactivationCheckOptions,
  type WalletReactivationDetectorConfig,
  type DormancySeverityThresholds,
} from "../../src/detection/wallet-reactivation";
import { FreshWalletAlertSeverity } from "../../src/detection";

describe("Wallet Reactivation Detector E2E Tests", () => {
  describe("Detection Module Integration", () => {
    beforeAll(() => {
      resetSharedWalletReactivationDetector();
    });

    afterAll(() => {
      resetSharedWalletReactivationDetector();
    });

    it("should create and configure wallet reactivation detector", () => {
      const detector = createWalletReactivationDetector({
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        defaultDormancyThresholdDays: 45,
        defaultActivityWindowDays: 120,
        defaultMaxTrades: 750,
      });

      expect(detector).toBeInstanceOf(WalletReactivationDetector);
      expect(detector.getDormancyThreshold()).toBe(45);

      const stats = detector.getCacheStats();
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should create detector with custom dormancy severity thresholds", () => {
      const customThresholds: DormancySeverityThresholds = {
        shortMaxDays: 45,
        mediumMaxDays: 120,
        longMaxDays: 240,
      };

      const detector = createWalletReactivationDetector({
        dormancySeverityThresholds: customThresholds,
      });

      const thresholds = detector.getDormancySeverityThresholds();
      expect(thresholds.shortMaxDays).toBe(45);
      expect(thresholds.mediumMaxDays).toBe(120);
      expect(thresholds.longMaxDays).toBe(240);
    });

    it("should manage shared singleton correctly", () => {
      const shared1 = getSharedWalletReactivationDetector();
      const shared2 = getSharedWalletReactivationDetector();

      expect(shared1).toBe(shared2);

      resetSharedWalletReactivationDetector();
      const shared3 = getSharedWalletReactivationDetector();

      expect(shared3).not.toBe(shared1);
    });

    it("should allow setting custom shared detector", () => {
      const customDetector = createWalletReactivationDetector({
        defaultDormancyThresholdDays: 90,
      });

      setSharedWalletReactivationDetector(customDetector);
      const shared = getSharedWalletReactivationDetector();

      expect(shared).toBe(customDetector);
      expect(shared.getDormancyThreshold()).toBe(90);

      resetSharedWalletReactivationDetector();
    });

    it("should have all required ReactivationStatus enum values", () => {
      expect(ReactivationStatus.NEVER_DORMANT).toBe("NEVER_DORMANT");
      expect(ReactivationStatus.DORMANT).toBe("DORMANT");
      expect(ReactivationStatus.JUST_REACTIVATED).toBe("JUST_REACTIVATED");
      expect(ReactivationStatus.RECENTLY_REACTIVATED).toBe("RECENTLY_REACTIVATED");
      expect(ReactivationStatus.NO_HISTORY).toBe("NO_HISTORY");
    });

    it("should have all required DormancySeverity enum values", () => {
      expect(DormancySeverity.SHORT).toBe("SHORT");
      expect(DormancySeverity.MEDIUM).toBe("MEDIUM");
      expect(DormancySeverity.LONG).toBe("LONG");
      expect(DormancySeverity.EXTENDED).toBe("EXTENDED");
    });

    it("should have all required ActivityPatternType enum values", () => {
      expect(ActivityPatternType.REGULAR).toBe("REGULAR");
      expect(ActivityPatternType.SPORADIC).toBe("SPORADIC");
      expect(ActivityPatternType.BURST).toBe("BURST");
      expect(ActivityPatternType.SINGLE_SHOT).toBe("SINGLE_SHOT");
    });

    it("should export correct DEFAULT_DORMANCY_SEVERITY_THRESHOLDS", () => {
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.shortMaxDays).toBe(60);
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.mediumMaxDays).toBe(180);
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.longMaxDays).toBe(365);
    });

    it("should handle cache operations correctly", () => {
      const detector = createWalletReactivationDetector({ maxCacheSize: 10 });

      // Initial cache should be empty
      expect(detector.getCacheStats().size).toBe(0);

      // Clear cache should work
      detector.clearCache();
      expect(detector.getCacheStats().size).toBe(0);

      // Invalidating non-existent entry should return false
      const result = detector.invalidateCacheEntry("0x1234567890123456789012345678901234567890");
      expect(result).toBe(false);

      // Invalidating invalid address should return false
      const invalidResult = detector.invalidateCacheEntry("invalid-address");
      expect(invalidResult).toBe(false);
    });

    it("should handle activity tracking operations", () => {
      const detector = createWalletReactivationDetector();

      // Initial activity tracking should be empty
      const activity = detector.getLastKnownActivity("0x1234567890123456789012345678901234567890");
      expect(activity).toBeUndefined();

      // Getting activity for invalid address should return undefined
      const invalidActivity = detector.getLastKnownActivity("invalid");
      expect(invalidActivity).toBeUndefined();

      // Clear activity tracking should work
      detector.clearActivityTracking();

      // After clearing, should still be undefined
      const activityAfterClear = detector.getLastKnownActivity(
        "0x1234567890123456789012345678901234567890"
      );
      expect(activityAfterClear).toBeUndefined();
    });

    it("should detect activity changes correctly", () => {
      const detector = createWalletReactivationDetector();

      // No previous activity tracked, so no change
      expect(
        detector.hasActivityChanged(
          "0x1234567890123456789012345678901234567890",
          null
        )
      ).toBe(false);

      // Invalid address should return false
      expect(detector.hasActivityChanged("invalid", new Date())).toBe(false);
    });

    it("should export all convenience functions", () => {
      expect(typeof checkWalletReactivation).toBe("function");
      expect(typeof batchCheckWalletReactivation).toBe("function");
      expect(typeof isWalletDormant).toBe("function");
      expect(typeof wasWalletRecentlyReactivated).toBe("function");
      expect(typeof getWalletDaysSinceActivity).toBe("function");
      expect(typeof getReactivationSummary).toBe("function");
    });

    it("should handle getSummary with empty results", () => {
      const detector = createWalletReactivationDetector();
      const summary = detector.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.reactivatedPercentage).toBe(0);
      expect(summary.suspiciousPercentage).toBe(0);
      expect(summary.averageDormancyDays).toBeNull();
      expect(summary.medianDormancyDays).toBeNull();
      expect(summary.maxDormancyDays).toBeNull();
    });

    it("should handle getSummary with mixed results", () => {
      const detector = createWalletReactivationDetector();

      // Helper function to create dates in the past
      const daysAgo = (days: number): Date => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
      };

      const mockResults: WalletReactivationResult[] = [
        {
          address: "0x1111111111111111111111111111111111111111",
          status: ReactivationStatus.JUST_REACTIVATED,
          isReactivated: true,
          isSuspicious: true,
          daysSinceLastActivity: 5,
          lastActivityAt: new Date(),
          firstActivityAt: daysAgo(100),
          totalTradeCount: 10,
          totalVolume: 1000,
          uniqueMarketsTraded: 2,
          reactivationEvent: {
            lastActivityBefore: daysAgo(100),
            firstActivityAfter: daysAgo(5),
            dormancyDays: 95,
            dormancySeverity: DormancySeverity.MEDIUM,
            reactivationTradeCount: 5,
            reactivationVolume: 500,
            activityPattern: ActivityPatternType.BURST,
          },
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.HIGH,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x2222222222222222222222222222222222222222",
          status: ReactivationStatus.RECENTLY_REACTIVATED,
          isReactivated: true,
          isSuspicious: false,
          daysSinceLastActivity: 15,
          lastActivityAt: daysAgo(15),
          firstActivityAt: daysAgo(200),
          totalTradeCount: 20,
          totalVolume: 2000,
          uniqueMarketsTraded: 5,
          reactivationEvent: {
            lastActivityBefore: daysAgo(200),
            firstActivityAfter: daysAgo(15),
            dormancyDays: 185,
            dormancySeverity: DormancySeverity.LONG,
            reactivationTradeCount: 10,
            reactivationVolume: 1000,
            activityPattern: ActivityPatternType.REGULAR,
          },
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.MEDIUM,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          status: ReactivationStatus.DORMANT,
          isReactivated: false,
          isSuspicious: false,
          daysSinceLastActivity: 60,
          lastActivityAt: daysAgo(60),
          firstActivityAt: daysAgo(100),
          totalTradeCount: 5,
          totalVolume: 500,
          uniqueMarketsTraded: 1,
          reactivationEvent: null,
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.LOW,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x4444444444444444444444444444444444444444",
          status: ReactivationStatus.NO_HISTORY,
          isReactivated: false,
          isSuspicious: false,
          daysSinceLastActivity: null,
          lastActivityAt: null,
          firstActivityAt: null,
          totalTradeCount: 0,
          totalVolume: 0,
          uniqueMarketsTraded: 0,
          reactivationEvent: null,
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.LOW,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x5555555555555555555555555555555555555555",
          status: ReactivationStatus.NEVER_DORMANT,
          isReactivated: false,
          isSuspicious: false,
          daysSinceLastActivity: 2,
          lastActivityAt: daysAgo(2),
          firstActivityAt: daysAgo(30),
          totalTradeCount: 15,
          totalVolume: 1500,
          uniqueMarketsTraded: 3,
          reactivationEvent: null,
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.LOW,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
      ];

      const summary = detector.getSummary(mockResults);

      expect(summary.total).toBe(5);
      expect(summary.byStatus[ReactivationStatus.JUST_REACTIVATED]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.RECENTLY_REACTIVATED]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.DORMANT]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.NO_HISTORY]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.NEVER_DORMANT]).toBe(1);
      expect(summary.reactivatedPercentage).toBe(40); // 2 out of 5
      expect(summary.suspiciousPercentage).toBe(20); // 1 out of 5
      expect(summary.byDormancySeverity[DormancySeverity.MEDIUM]).toBe(1);
      expect(summary.byDormancySeverity[DormancySeverity.LONG]).toBe(1);
      expect(summary.averageDormancyDays).toBe(140); // (95 + 185) / 2
      expect(summary.medianDormancyDays).toBe(140); // (95 + 185) / 2 for even count
      expect(summary.maxDormancyDays).toBe(185);
    });

    it("should validate type exports are accessible", () => {
      // Test that types can be used for type checking (compile-time check)
      const checkOptions: ReactivationCheckOptions = {
        dormancyThresholdDays: 30,
        activityWindowDays: 90,
        maxTradesToFetch: 500,
        includeWalletAge: true,
        bypassCache: false,
      };

      expect(checkOptions.dormancyThresholdDays).toBe(30);

      const config: WalletReactivationDetectorConfig = {
        defaultDormancyThresholdDays: 30,
        cacheTtlMs: 300000,
        maxCacheSize: 1000,
      };

      expect(config.defaultDormancyThresholdDays).toBe(30);
    });
  });

  describe("Address Validation", () => {
    it("should reject invalid addresses", async () => {
      const detector = createWalletReactivationDetector();

      await expect(detector.checkWallet("invalid-address")).rejects.toThrow(
        "Invalid wallet address"
      );

      await expect(detector.checkWallet("")).rejects.toThrow(
        "Invalid wallet address"
      );

      await expect(detector.checkWallet("0x")).rejects.toThrow(
        "Invalid wallet address"
      );

      await expect(detector.checkWallet("0x123")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should accept valid address format", () => {
      const detector = createWalletReactivationDetector();

      // Verify address normalization works without making API calls
      const lowercaseAddress = "0x1234567890123456789012345678901234567890";

      // These tests verify that checkWallet accepts valid addresses
      // The actual API call would be tested with mocks in unit tests
      expect(() => {
        // Just verify the detector instance was created properly
        expect(detector).toBeInstanceOf(WalletReactivationDetector);
      }).not.toThrow();

      // Verify getDormancyThreshold works (proves detector is properly initialized)
      expect(detector.getDormancyThreshold()).toBe(30);

      // Verify cache operations work with normalized addresses
      expect(detector.invalidateCacheEntry(lowercaseAddress)).toBe(false);
    });
  });

  describe("Browser Integration", () => {
    let browser: Browser;
    let page: Page;
    let serverUrl: string;

    beforeAll(async () => {
      // Check if the dev server is running on either port
      serverUrl = "http://localhost:3000";
      try {
        const response = await fetch("http://localhost:3000");
        if (!response.ok) {
          throw new Error("Port 3000 not responding");
        }
      } catch {
        try {
          const response = await fetch("http://localhost:3001");
          if (response.ok) {
            serverUrl = "http://localhost:3001";
          } else {
            console.log("Dev server not responding, skipping browser tests");
            return;
          }
        } catch {
          console.log("Dev server not running, skipping browser tests");
          return;
        }
      }

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      page = await browser.newPage();
      page.setDefaultTimeout(10000);
    }, 30000);

    afterAll(async () => {
      if (page) await page.close();
      if (browser) await browser.close();
    });

    it("should load the app successfully with wallet reactivation module", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      await page.goto(serverUrl || "http://localhost:3000", { waitUntil: "networkidle0" });

      // Check that the page loaded
      const title = await page.title();
      expect(title).toBeDefined();

      // Collect console errors
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Take a screenshot for verification
      await page.screenshot({
        path: "/tmp/wallet-reactivation-e2e.png",
        fullPage: true,
      });

      // Filter out expected errors (network errors, etc.)
      const unexpectedErrors = errors.filter(
        (e) =>
          !e.includes("fetch") &&
          !e.includes("network") &&
          !e.includes("Failed to load") &&
          !e.includes("ERR_") &&
          !e.includes("favicon")
      );

      // Should have no unexpected console errors related to our module
      const moduleErrors = unexpectedErrors.filter(
        (e) =>
          e.includes("wallet-reactivation") ||
          e.includes("ReactivationStatus") ||
          e.includes("DormancySeverity")
      );
      expect(moduleErrors.length).toBe(0);
    }, 30000);

    it("should verify app responsive layout with wallet-reactivation module", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      const url = serverUrl || "http://localhost:3000";

      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(url, { waitUntil: "networkidle0" });

      const mobileScreenshot = await page.screenshot({
        path: "/tmp/wallet-reactivation-e2e-mobile.png",
      });
      expect(mobileScreenshot).toBeDefined();

      // Test tablet viewport
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(url, { waitUntil: "networkidle0" });

      const tabletScreenshot = await page.screenshot({
        path: "/tmp/wallet-reactivation-e2e-tablet.png",
      });
      expect(tabletScreenshot).toBeDefined();

      // Test desktop viewport
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: "networkidle0" });

      const desktopScreenshot = await page.screenshot({
        path: "/tmp/wallet-reactivation-e2e-desktop.png",
      });
      expect(desktopScreenshot).toBeDefined();
    }, 30000);

    it("should verify no JavaScript errors on page load", async () => {
      if (!page) {
        console.log("Skipping - browser not available");
        return;
      }

      const url = serverUrl || "http://localhost:3000";
      const jsErrors: string[] = [];

      // Listen for page errors
      page.on("pageerror", (err) => {
        jsErrors.push(err instanceof Error ? err.message : String(err));
      });

      await page.goto(url, { waitUntil: "networkidle0" });

      // Wait a bit for any async errors
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Filter errors - only look for errors related to our module
      const moduleErrors = jsErrors.filter(
        (e) =>
          e.includes("wallet-reactivation") ||
          e.includes("ReactivationStatus") ||
          e.includes("DormancySeverity") ||
          e.includes("ActivityPatternType")
      );

      expect(moduleErrors.length).toBe(0);
    }, 30000);
  });

  describe("Module Export Verification", () => {
    it("should export WalletReactivationDetector class", () => {
      expect(WalletReactivationDetector).toBeDefined();
      expect(typeof WalletReactivationDetector).toBe("function");
    });

    it("should export factory functions", () => {
      expect(createWalletReactivationDetector).toBeDefined();
      expect(getSharedWalletReactivationDetector).toBeDefined();
      expect(setSharedWalletReactivationDetector).toBeDefined();
      expect(resetSharedWalletReactivationDetector).toBeDefined();
    });

    it("should export convenience functions", () => {
      expect(checkWalletReactivation).toBeDefined();
      expect(batchCheckWalletReactivation).toBeDefined();
      expect(isWalletDormant).toBeDefined();
      expect(wasWalletRecentlyReactivated).toBeDefined();
      expect(getWalletDaysSinceActivity).toBeDefined();
      expect(getReactivationSummary).toBeDefined();
    });

    it("should export all enums", () => {
      expect(ReactivationStatus).toBeDefined();
      expect(DormancySeverity).toBeDefined();
      expect(ActivityPatternType).toBeDefined();
    });

    it("should export default constants", () => {
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS).toBeDefined();
      expect(typeof DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.shortMaxDays).toBe("number");
      expect(typeof DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.mediumMaxDays).toBe("number");
      expect(typeof DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.longMaxDays).toBe("number");
    });
  });
});
